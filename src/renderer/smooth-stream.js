// Smooth-stream song renderer: bypasses text-level rendering so every
// syllable lands EXACTLY on its grid slot.
//
// Why this exists: the text path (Parser -> Renderer) has two timing
// defects the parser cannot avoid.
//
//   1. The parser's InsertBreath keeps render chunks under ~232 frames
//      by turning the LAST SPACE of an over-long section into a silent
//      glottal stop (Q, len 4) + BREAK. Singing text has a space
//      between every syllable, so the cut lands mid-word.
//
//   2. Text-level fitting can only add or remove WHOLE phoneme tuples
//      (repeat quanta of ~100 ms at speed 72), so syllables overshoot
//      their grid target by up to a full repeat — the "stretched
//      words". Tuple lengths themselves are 8-bit table values the
//      parser never compresses.
//
// This module fixes both. It parses each syllable's phoneme string into
// tuples, then (a) retunes every tuple's length so each syllable hits
// its grid span exactly (the byte-exact `simulate()` measures the real
// rendered duration, including the sampled-consonant pair extras),
// (b) emits rests as silent Q tuples sized to the grid, and (c) packs
// the tuples into chunks whose BREAK boundaries land only inside runs
// of identical vowel tuples — audio-seamless positions.
//
// Rendering calls Renderer() once with the full tuple stream (no melody
// array: the tuples already carry their pitch bytes in slot [3]), then
// de-clicks each chunk seam in the PCM: a chunk boundary restarts the
// glottal pulse mid-cycle, which clicks when it lands inside a held
// note. A ~2 ms fade-to-zero on both sides of the seam is inaudible
// against the masking buzz and removes the tick.
import Parser from '../parser/parser.js';
import Renderer from './renderer.js';
import BuildWav from '../util/wav.js';
import { noteToPitchByte } from './notes.js';
import { simulate } from './simulate.js';
import { PhonemeNameTable } from '../parser/tables.js';
import { phonemeHasFlag } from '../parser/util.js';
import { FLAG_VOWEL } from '../parser/constants.js';

const BREAK = 254;
const END = 255;

// Default grid step of the Daisy Bell arrangement: one 256-tick step at
// 165 BPM (see tools/daisy/build-daisy.mjs).
const UNIT_MS = 363.636;

/**
 * Parse one syllable's phoneme string into render tuples.
 *
 * @param {String} phonemes Phonetic input like 'D6 EH6 Y6'.
 * @return {Array<Array>} [phoneme, length, stress] tuples (placeholders
 *   and BREAK/END markers removed).
 */
function parseSyllable (phonemes) {
  const parsed = Parser(String(phonemes).toUpperCase());
  if (false === parsed) {
    return false;
  }
  return parsed.phonemes.filter((p) => {
    const A0 = p[0];
    if (!A0 || A0 === END || A0 === BREAK) return false;
    // A len-4 Q is the parser's InsertBreath glottal stop, not content.
    if (A0 === 31 && p[1] === 4) return false;
    return true;
  });
}

/**
 * Retune one syllable's tuple lengths so its rendered duration hits
 * `targetSamples` exactly (±half a frame). Vowels carry the change;
 * when compressing, consonants shrink proportionally down to their
 * floors (vowels 3 frames, consonants 1, sampled consonants 2).
 *
 * @param {Array<Array>} tuples      mutable [phoneme, length, stress]
 * @param {Number} targetSamples     exact rendered-duration target
 * @param {Number} frameSamples      samples per frame at this speed
 * @param {Number} speed
 */
function tuneSyllable (tuples, targetSamples, frameSamples, speed) {
  const isVowel = (t) => phonemeHasFlag(t[0], FLAG_VOWEL);
  const floorOf = (t) => {
    if (isVowel(t)) return 3;
    if (phonemeHasFlag(t[0], 0x2000) || phonemeHasFlag(t[0], 0x0040)) return 2; // fricative/consonant
    return 1;
  };
  let prev = Infinity;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { samples } = simulate(tuples, { speed });
    const delta = targetSamples - samples;
    if (Math.abs(delta) <= frameSamples / 2) return samples;
    if (samples === prev) return samples; // cannot converge further
    prev = samples;
    const add = Math.round(delta / frameSamples);
    if (add === 0) return samples;
    if (add > 0) {
      // grow: spread over vowels, else over all tuples
      const idx = tuples.map((t, j) => isVowel(t) ? j : -1).filter((j) => j >= 0);
      const grow = idx.length ? idx : tuples.map((_, j) => j);
      const base = Math.floor(add / grow.length);
      let rem = add - base * grow.length;
      grow.forEach((j) => {
        tuples[j][1] += base + (rem > 0 ? 1 : 0);
        if (rem > 0) rem--;
      });
    } else {
      // shrink: remove proportionally down to floors
      let need = -add;
      const removable = tuples.reduce((s, t) => s + (t[1] - floorOf(t)), 0);
      if (removable === 0) return samples;
      if (need > removable) need = removable;
      let removed = 0;
      tuples.forEach((t) => {
        const can = t[1] - floorOf(t);
        if (can <= 0) return;
        const take = Math.min(can, Math.round(need * can / removable));
        t[1] -= take;
        removed += take;
      });
      // fix rounding residual on the largest vowel
      while (removed < need) {
        const j = tuples.map((t, k) => isVowel(t) && t[1] > floorOf(t) ? k : -1)
          .filter((k) => k >= 0)
          .sort((a, b) => tuples[b][1] - tuples[a][1])[0];
        if (j === undefined) break;
        tuples[j][1]--;
        removed++;
      }
      while (removed > need) {
        const j = tuples.map((t, k) => isVowel(t) ? k : -1).filter((k) => k >= 0)[0];
        if (j === undefined) break;
        tuples[j][1]++;
        removed--;
      }
    }
  }
  return simulate(tuples, { speed }).samples;
}

/**
 * Render a song end to end, exactly on its grid.
 *
 * @param {Object} song
 * @param {String[]} song.syllables  One phoneme string per syllable
 *   ('D6 EH6 Y6'), sung in order.
 * @param {String[]} song.notes      One note name per syllable
 *   ('C4', 'F#3', 'Bb5'), or '-' to keep the base pitch.
 * @param {Number[]} song.units      Sung grid units per syllable.
 * @param {Number[]} [song.restUnits] Rest grid units after each syllable
 *   (silent; default 0). Grid position of syllable i+1 = sum of
 *   units+restUnits of syllables 0..i.
 * @param {Number}   [song.unitMs]   Milliseconds per grid unit.
 *   Default 363.636 (one 256-tick step at 165 BPM).
 * @param {String[]} [song.names]    Optional debug labels per syllable.
 * @param {Object} voice           { pitch, mouth, throat, speed,
 *   singmode, hq, masking, bits, debug }
 *
 * @return {Object|Boolean} false when a syllable fails to parse, else
 *   { wav, buffer, int16, float32, chunks, maxChunk, samples, fitInfo }
 *   — wav: complete .wav file image (de-clicked); buffer: raw unsigned
 *   8-bit samples; int16: declicked signed 16-bit samples; float32:
 *   playback samples; fitInfo: per-syllable target/actual ms.
 */
export function renderSmoothStream (song, voice = {}) {
  const speed = voice.speed ?? 72;
  const frameSamples = speed * 162 / 50; // samples per frame
  const unitMs = song.unitMs ?? UNIT_MS;
  const unitSamples = unitMs / 1000 * 22050;
  const budget = 228;                    // chunk frame budget (8-bit totals)
  const units = song.units;
  const restUnits = song.restUnits ?? song.units.map(() => 0);
  const bits = voice.bits === 16 ? 16 : 8;
  const debug = voice.debug === true;
  const name = (i) => song.names?.[i] ?? '?';

  const syllables = song.syllables.map(parseSyllable);
  if (syllables.some((s) => s === false || s.length === 0)) {
    return false;
  }
  const noteBytes = song.notes.map((n) => noteToPitchByte(n));

  // Grid: sample position of each entry boundary.
  const P = [0];
  let cum = 0;
  units.forEach((u, i) => { cum += u + restUnits[i]; P.push(Math.round(cum * unitSamples)); });

  // 1) tune each syllable's tuples to its grid span minus its rest.
  //    Syllables followed by a rest get one frame of slack: the rest
  //    absorbs the overshoot, and the extra frame goes to the vowel,
  //    which is the part that otherwise gets clipped on fast notes.
  const fitInfo = [];
  const tuned = syllables.map((tuples, i) => {
    const ts = tuples.map((t) => [t[0], t[1], t[2]]);
    const restTarget = Math.round(restUnits[i] * unitSamples);
    const slack = restUnits[i] > 0 ? frameSamples * 0.95 : 0;
    const targetSamples = P[i + 1] - P[i] - restTarget + slack;
    const actualSamples = tuneSyllable(ts, targetSamples, frameSamples, speed);
    fitInfo.push({ targetMs: (targetSamples - slack) / 22050 * 1000, actualMs: actualSamples / 22050 * 1000 });
    return ts;
  });

  // 2) rests: exact silent Q tuples sized to (grid span - measured syllable).
  const entries = []; // { syl, tuples } — atoms with syllable identity
  tuned.forEach((ts, i) => {
    const measured = simulate(ts, { speed }).samples;
    const restFrames = Math.round((P[i + 1] - P[i] - measured) / frameSamples);
    const rest = [];
    if (restFrames > 0) {
      const k = Math.floor(restFrames / 5);
      for (let q = 0; q < k; q++) rest.push([31, 5, 0]);
      const rem = restFrames - k * 5;
      if (rem > 0) rest.push([31, rem, 0]);
    }
    entries.push({ syl: i, tuples: ts, rest });
  });

  // 3) pre-split long vowel tuples into <=16-frame pieces (audio-exact:
  //    consecutive identical tuples render identically to one long one)
  //    so chunk seams can land inside holds.
  const MAX_PIECE = 16;
  const atoms = [];
  entries.forEach((e) => {
    e.tuples.forEach((t) => {
      if (t[1] > MAX_PIECE && phonemeHasFlag(t[0], FLAG_VOWEL)) {
        const n = Math.ceil(t[1] / MAX_PIECE);
        const base = Math.floor(t[1] / n);
        let rem = t[1] - base * n;
        for (let k = 0; k < n; k++) {
          const len = base + (rem > 0 ? 1 : 0);
          if (rem > 0) rem--;
          atoms.push({ syl: e.syl, t: [t[0], len, t[2]] });
        }
      } else {
        atoms.push({ syl: e.syl, t: [t[0], t[1], t[2]] });
      }
    });
    e.rest.forEach((t) => atoms.push({ syl: e.syl, t, rest: true }));
  });

  // 4) pack atoms into chunks <= budget, breaking only where the seam
  //    is inaudible: inside a run of identical vowel tuples (same
  //    phoneme, same syllable), else at a syllable start, else after a
  //    rest (silence).
  const atomLen = (a) => a.t[1];
  const chunks = [];
  let cur = [];
  let used = 0;
  const pushChunk = (tail) => { chunks.push(cur); cur = tail; used = tail.reduce((s, a) => s + atomLen(a), 0); };
  const seamlessAt = (list, p, nextAtom) => {
    const left = list[p - 1];
    const right = list[p] ?? nextAtom;
    return left && right && !left.rest && !right.rest &&
      left.syl === right.syl && left.t[0] === right.t[0];
  };
  for (const atom of atoms) {
    const need = atomLen(atom);
    if (cur.length > 0 && used + need > budget) {
      // backtrack: latest seamless split inside a held vowel
      let splitAt = null;
      for (let p = cur.length; p >= 1; p--) {
        if (cur.slice(0, p).reduce((s, a) => s + atomLen(a), 0) > budget) continue;
        if (seamlessAt(cur, p, atom)) { splitAt = p; break; }
      }
      if (splitAt !== null) {
        pushChunk(cur.splice(splitAt));
      } else {
        // fallback: break before this syllable's first atom in the chunk
        let sylStart = cur.findIndex((a) => a.syl === atom.syl);
        if (sylStart <= 0) sylStart = cur.length;
        if (sylStart < cur.length) pushChunk(cur.splice(sylStart));
        else pushChunk([]);
      }
    }
    cur.push(atom);
    used += need;
  }
  if (cur.length) chunks.push(cur);

  // 5) flatten with BREAK between chunks, melody bytes attached
  const flat = [];
  chunks.forEach((chunk, ci) => {
    chunk.forEach((a) => flat.push([a.t[0], a.t[1], a.t[2], noteBytes[a.syl]]));
    if (ci < chunks.length - 1) flat.push([BREAK, 0, 0]);
  });
  flat.push([END, 0, 0]);

  // 6) verify chunks + collect exact seam positions for the de-click
  const chunkList = [];
  let verify = [];
  flat.forEach((t) => {
    if (t[0] === BREAK || t[0] === END) { if (verify.length) chunkList.push(verify); verify = []; }
    else verify.push(t);
  });
  const sims = chunkList.map((c) => simulate(c, { speed }));
  const maxChunk = Math.max(...sims.map((s) => s.t));
  const samples = sims.reduce((a, s) => a + s.samples, 0);

  const buffer = Renderer(
    flat, voice.pitch, voice.mouth, voice.throat, speed,
    voice.singmode !== false, voice.hq === true, voice.masking !== false,
    undefined, undefined
  );

  // 7) de-click the seams: fade ~2 ms to zero on both sides of each
  //    chunk boundary (the pulse restarts mid-cycle at a seam). At
  //    bits=16 the fade runs on the exact sample values the container
  //    stores; at bits=8 on the byte samples themselves.
  let wav = BuildWav(buffer, bits);
  let int16;
  if (bits === 16) {
    const pos = new Int16Array(wav.buffer, wav.byteOffset + 44, (wav.length - 44) / 2);
    declickInt16(pos, seamsOf(sims));
    int16 = new Int16Array(pos);
  } else {
    const bytes = new Uint8Array(wav.buffer, wav.byteOffset + 44, wav.length - 44);
    declickUint8(bytes, seamsOf(sims));
    int16 = new Int16Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) int16[i] = (bytes[i] - 128) * 256;
  }
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

  if (debug) {
    console.log('=== tuned syllables ===');
    tuned.forEach((ts, i) => {
      const seq = ts.map((x) => (x[0] === 31 ? `Q${x[1]}` : `${PhonemeNameTable[x[0]]}x${x[1]}`)).join(' ');
      console.log(`syl ${String(i).padStart(2)} ${name(i)}: ${seq}`);
    });
    console.log('=== actual smooth stream chunks ===');
    chunkList.forEach((c, i) => {
      const nf = c.reduce((s, x) => s + x[1], 0);
      const seq = c.map((x) => (x[0] === 31 ? `Q${x[1]}` : `${PhonemeNameTable[x[0]]}/${x[3]}x${x[1]}s${x[2]}`)).join(' ');
      console.log(`chunk ${String(i).padStart(2)}: ${String(nf).padStart(3)}f ${String(sims[i].samples).padStart(5)}smp  ${seq}`);
    });
  }

  return { wav, buffer, int16, float32, chunks: chunkList.length, maxChunk, samples, fitInfo };
}

function seamsOf (sims) {
  const seams = [];
  let pos = 0;
  sims.slice(0, -1).forEach((s) => { pos += s.samples; seams.push(pos); });
  return seams;
}

/**
 * Fade ~2 ms to zero on both sides of each seam of signed 16-bit PCM.
 *
 * @param {Int16Array} pcm    Sample view to fade in place.
 * @param {Array<Number>} seams  Sample indices where chunks join.
 */
function declickInt16 (pcm, seams) {
  const W = 24; // ~1.1 ms per side at 22050 Hz
  for (const s of seams) {
    for (let d = 0; d < W; d++) {
      // left side: sample at s-1-d scaled down as it nears the seam
      const li = s - 1 - d;
      if (li >= 0) pcm[li] = Math.round(pcm[li] * d / W);
      // right side: sample at s+d scaled up as it leaves the seam
      const ri = s + d;
      if (ri < pcm.length) pcm[ri] = Math.round(pcm[ri] * (d + 1) / W);
    }
  }
}

/** Same fade for unsigned 8-bit PCM (128 = silence). */
function declickUint8 (pcm, seams) {
  const W = 24;
  for (const s of seams) {
    for (let d = 0; d < W; d++) {
      const li = s - 1 - d;
      if (li >= 0) pcm[li] = Math.round((pcm[li] - 128) * d / W) + 128;
      const ri = s + d;
      if (ri < pcm.length) pcm[ri] = Math.round((pcm[ri] - 128) * (d + 1) / W) + 128;
    }
  }
}
