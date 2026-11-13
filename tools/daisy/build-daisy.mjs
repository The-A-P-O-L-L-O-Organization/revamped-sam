import { writeFileSync } from 'node:fs';
import SamJs from '../../src/index.ts';
import Parser from '../../src/parser/parser.js';
import { sampledConsonantFlags } from '../../src/renderer/tables.js';
import { noteToPitchByte } from '../../src/renderer/notes.js';
import { simulate } from './render-sim.mjs';
import { renderSmoothStream } from '../../src/renderer/smooth-stream.js';

// Daisy Bell (Harry Dacre, 1892) — homage to the 1961 IBM 7094.
//
// TEMPO MODEL (verified byte-exact against rendered WAVs):
//   The output buffer advances a unit-accumulator by a per-call timetable
//   value; 1 output sample = 50 units. A normal formant frame advances
//   162 units per speed-loop iteration, so
//       frame seconds = speed * 162 / 50 / 22050
//   (NOT speed*5/22050 as a naive reading suggests). Unvoiced sampled
//   consonants (S, SH, F, TH, /H, /X, CH) emit (flags&248+1)*8 fixed-size
//   sample calls at 60 units each per 2 frames — their duration is
//   SPEED-INDEPENDENT:
//       pair seconds = (flags&248 + 1) * 8 * 60 / 50 / 22050.
//   The MIDI (daisy-bell.mid, PPQ 256, 165 BPM) puts one unit (one 256-tick
//   gap = one quarter note) at 363.636 ms. All fit targets are in milliseconds.
//   NOTE: at unit=363.6 ms the SAM phoneme-length floors make quick syllables
//   unachievable above ~speed 77 (frame = speed*3.24 samples); speed 72 (the
//   web default) is the tempo-true sweet spot.

const UNIT_MS = 363.636;         // one 256-tick grid step at 165 BPM
const frameMs = (speed) => speed * 162 / 50 / 22050 * 1000;

// Score entry: [phonemes, note, sungUnits, restUnits]
const CHORUS = [
  // "Daisy, Daisy, give me your answer, do!"
  // (u/r re-derived from the MIDI note on/off grid: the melody's notes
  // are nearly contiguous — 10-30 tick gaps — so phrases sing legato and
  // rests exist only where the arrangement actually has gaps.)
  ['D6 EH6 Y6',    'D4',  2,   0],  // Dai (vowel held through the MIDI lift)
  ['S6 IY6',       'B3',  2,   0],  // sy, (vowel held through the MIDI lift)
  ['D6 EH6 Y6',    'G3',  3,   0],  // Dai
  ['S6 IY6',       'D3',  2.85, 0], // sy, (2.85u; instrumental fill skipped)
  ['G6 IH6 V6',    'E3',  1,   0],  // give
  ['M2 IY2',       'F#3', 1,   0],  // me
  ['Y2 AO2 R2',    'G3',  1,   0],  // your
  ['AE2 N2',       'E3',  2,   0],  // an- (stressed, 2 units in the MIDI)
  ['S4 ER4',       'G3',  1,   0],  // -swer
  ['D6 UW6',       'D3',  5,   2],  // do. (2-unit phrase rest)
  // "I'm half crazy, all for the love of you!"
  ['AY6 M6',       'A3',  3,   0],  // I'm
  ['/H6 AE6 F6',   'D4',  3,   0],  // half
  ['K6 R6 EY6',    'B3',  3,   0],  // cra-
  ['Z6 IY6',       'G3',  2,   1],  // -zy,
  ['AO6 L6',       'E3',  1,   0],  // all
  ['F2 AO2 R2',    'F#3', 1,   0],  // for
  ['DH2 AH2',      'G3',  1,   0],  // the
  ['L4 AH4 V4',    'A3',  2,   0],  // love
  ['AH2 V2',       'B3',  1,   0],  // of
  ['Y6 UW6',       'A3',  4,   1],  // you.
  // "It won't be a stylish marriage,"
  ['IH2 T2',       'B3',  1,   0],  // It
  ['W2 OW2 N2 T2', 'C4',  1,   0],  // won't
  ['B2 IY2',       'B3',  1,   0],  // be
  ['AH2',          'A3',  1,   0],  // a
  ['S4 T4 AY4',    'D4',  2,   0],  // sty-
  ['L2 IH2 SH2',   'B3',  1,   0],  // -lish, (legato into mar-)
  ['M2 AE2 R2',    'A3',  1,   0],  // mar- (the MIDI's A-B-A turn is compressed)
  ['IH7 J7',       'G3',  4,   0],  // -riage,
  // "I can't afford a carriage,"
  ['AY2',          'A3',  1,   0],  // I
  ['K4 AE4 N4 T4', 'B3',  2,   0],  // can't
  ['AH2 F2',       'G3',  1,   0],  // af-
  ['AO4 R4 D4',    'E3',  2,   0],  // -ford, (legato into a)
  ['AH2',          'G3',  1,   0],  // a
  ['K2 AE2 R2',    'E3',  1,   0],  // car-
  ['IH7 J7',       'D3',  3,   1],  // -riage,
  // "But you'll look sweet upon the seat of a bicycle built for two!"
  ['B2 AH2 T2',    'D3',  1,   0],  // But
  ['Y2 UW2 L2',    'G3',  2,   0],  // you'll
  ['L4 UH4 K4',    'B3',  1,   0],  // look
  ['S6 W6 IY6 T6', 'A3',  3,   0],  // sweet (vowel held through the pause)
  ['AO4 N4',       'G3',  2,   0],  // (up)on
  ['DH2 AH2',      'B3',  1,   0],  // the
  ['S4 IY4 T4',    'A3',  2,   0],  // seat (vowel held through the pause)
  ['AH1 V1',       'B3',  0.5, 0],  // of
  ['AH1',          'C4',  0.5, 0],  // a
  ['B2 AY2',       'D4',  1,   0],  // bi-
  ['S2 IH2',       'B3',  1,   0],  // cy-
  ['K2 AH2 L2',    'G3',  1,   0],  // -cle, (legato into built)
  ['B4 IH4 L4 T4', 'A3',  2,   0],  // built
  ['F2 AO2 R2',    'D3',  1,   0],  // for
  ['T8 UW8',       'G3',  4,   1],  // two. (final note + release)
];

const VERSE = [
  // "There is a flower within my heart, Daisy, Daisy!"
  ['DH2 EH2 R2',     'D4',  1, 0],  // There
  ['IH2 Z2',         'C#4', 1, 0],  // is
  ['AH2',            'D4',  1, 0],  // a
  ['F2 L2 AW2',      'B3',  1, 0],  // flow-
  ['ER2',            'A3',  1, 1],  // -er,
  ['W2 IH2 DH2',     'G3',  1, 0],  // with-
  ['IH4 N4',         'A3',  2, 0],  // -in
  ['M2 AY2',         'F#3', 1, 0],  // my
  ['/H6 AA6 R6 T6',  'D3',  2, 1],  // heart,
  ['D6 EH6 Y6',      'A3',  3, 1],  // Dai
  ['S6 IY6',         'D3',  2, 1],  // sy,
  ['D6 EH6 Y6',      'D4',  3, 1],  // Dai
  ['S6 IY6',         'B3',  2, 1],  // sy.
];

// CLI: --chorus (only the IBM-sung chorus), --speed n (single speed),
// --mouth n --throat n --pitch n (voice overrides), --out prefix (WAV name).
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const val = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const score = flag('chorus') ? [...CHORUS] : [...VERSE, ...CHORUS];

// Held-diphthong decomposition: [first-half monophthong, glide phoneme].
const DIP = {
  AY: ['AA', 'YX'],
  EY: ['EH', 'YX'],
  AW: ['AA', 'WX'],
  OY: ['AO', 'YX'],
  OW: ['AO', 'WX'],
  UW: ['UX', 'WX'],
};
const VOWELS = new Set([
  'IY', 'IH', 'EH', 'AE', 'AA', 'AH', 'AO', 'UH', 'AX', 'IX', 'ER', 'UX',
  'OW', 'AY', 'EY', 'AW', 'OY', 'UW',
]);

const stemOf = (t) => t.replace(/[0-9]/g, '');
const digitOf = (t) => (t.match(/[0-9]/) || [''])[0];

// Candidate token arrays for one syllable. Interior holds are UNSTRESSED
// so the parser's glottal-stop rule (stressed vowel + pause + stressed
// vowel) never fires inside a held note. n ranges wide enough to reach
// 5-unit holds at speed 72 (~34 frames/unit).
function candidates (ph) {
  const toks = ph.split(' ');
  const vi = toks.findIndex((t) => VOWELS.has(stemOf(t)));
  const vowel = toks[vi];
  const stem = stemOf(vowel);
  const digit = digitOf(vowel);
  const before = toks.slice(0, vi);
  const after = toks.slice(vi + 1);
  const out = [];
  if (DIP[stem] === undefined) {
    out.push(toks.slice());
    out.push([...before, stem, ...after]);
    for (let n = 1; n <= 16; n++) {
      out.push([...before, vowel, ...Array(n).fill(stem), ...after]);
      out.push([...before, ...Array(n + 1).fill(stem), ...after]);
    }
  } else {
    const [base, glide] = DIP[stem];
    out.push(toks.slice());
    out.push([...before, stem, ...after]);
    for (let n = 1; n <= 16; n++) {
      out.push([...before, base + digit, ...Array(n).fill(base), glide + digit, ...after]);
      out.push([...before, ...Array(n + 1).fill(base), glide + digit, ...after]);
    }
  }
  return out;
}

// Real-time cost of one rendered phoneme, in ms (see header). Q (31) and
// punctuation are silent formant frames.
function phonemeMs (p0, len, speed) {
  const flags = sampledConsonantFlags[p0] || 0;
  const f = flags & 248;
  if (f) {
    const pairs = Math.ceil(len / 2);
    return pairs * (f + 1) * 8 * 60 / 50 / 22050 * 1000;
  }
  return len * frameMs(speed);
}

// ms of silence for a rest of j Qs (5 silent formant frames each). Q is
// not FLAG_PUNCT: it neither chain-inflates the preceding syllable's tail
// (which commas do, x1.5 — that raises the floor of short notes) nor
// triggers the parser's glottal-stop insertion.
function restMs (j, speed) {
  return 5 * j * frameMs(speed);
}

// Assemble the full phonetic text + melody from expansions and rest
// patterns. Token id model (matches the parser): every input token
// consumes one id, separator spaces included.
function assemble (score, expansions, rests) {
  const parts = [];
  const melody = [];
  const syllableIds = [];
  let counter = 0;
  score.forEach(([ph, note, u, r], i) => {
    const toks = expansions[i];
    const ids = [];
    toks.forEach((t) => {
      if (parts.length > 0) counter++;
      ids.push(counter++);
      parts.push(t);
      melody.push(note);
    });
    syllableIds.push(new Set(ids));
    const [k, j] = rests[i];
    for (let c = 0; c < k; c++) {
      if (parts.length > 0) counter++;
      counter++;
      parts.push(',');
    }
    for (let q = 0; q < j; q++) {
      if (parts.length > 0) counter++;
      counter++;
      parts.push('Q');
    }
  });
  return { text: parts.join(' '), melody, syllableIds };
}

function measure (text, ids, speed) {
  const { phonemes, tokens } = Parser(text);
  let sum = 0;
  phonemes.forEach((p, i) => {
    if (p[0] !== 3 && p[0] !== 31 && p[0] !== 1 && p[0] !== 2 && p[0] !== 46 && p[0] !== 47 && ids.has(tokens[i])) {
      sum += phonemeMs(p[0], p[1], speed);
    }
  });
  return sum;
}

// Greedy sequential fit. Onsets stay on the grid: process syllables in
// order, and fit each note against (grid length minus accumulated drift).
// Floor-limited syllables (e.g. S-heavy 'sweet') may overshoot their
// target; the overshoot is then absorbed by shortening the following
// note (bounded at 70% of its grid length) and the following rest.
function buildFit (speed, unitMs) {
  const expansions = score.map(([ph]) => ph.split(' '));
  const rests = score.map(() => [0, 0]);
  let drift = 0; // actual cumulative ms - grid cumulative ms
  for (let i = 0; i < score.length; i++) {
    const [ph, note, u, r] = score[i];
    // 1. rest pattern: j silent Qs, chosen against the drift-corrected
    //    rest target (affects token layout, hence chosen first)
    if (r > 0) {
      let best = [0, 0], bestErr = Infinity;
      for (let j = 0; j <= 12; j++) {
        const err = Math.abs(restMs(j, speed) - (r * unitMs - drift));
        if (err < bestErr) { bestErr = err; best = [0, j]; }
      }
      rests[i] = best;
    }
    // 2. note fit against the drift-corrected target
    const grid = u * unitMs;
    const target = Math.max(grid - drift, grid * 0.7);
    let best = expansions[i], bestErr = Infinity;
    for (const cand of candidates(ph)) {
      expansions[i] = cand;
      const asm = assemble(score, expansions, rests);
      const err = Math.abs(measure(asm.text, asm.syllableIds[i], speed) - target);
      if (err < bestErr || (err === bestErr && cand.length < best.length)) {
        bestErr = err; best = cand;
      }
    }
    expansions[i] = best;
    const asm = assemble(score, expansions, rests);
    drift += measure(asm.text, asm.syllableIds[i], speed) - grid;
    if (r > 0) drift += restMs(rests[i][1], speed) - r * unitMs;
  }
  return { expansions, rests };
}

const VOICE = {
  pitch: Number(val('pitch') ?? 197),
  mouth: Number(val('mouth') ?? 134),
  throat: Number(val('throat') ?? 143),
  hq: true,
  masking: flag('masked'),
};
const totalUnits = score.reduce((s, [, , u, r]) => s + u + r, 0);

// Replicate the renderer's chunk split + melody attach and run the
// byte-exact frame/timetable simulation over the built text.
function exactSim (text, melody, spd) {
  const { phonemes, tokens } = Parser(text);
  let melodyIndex = 0, lastToken = null, currentNote;
  const chunks = []; let cur = [];
  phonemes.forEach((p, i) => {
    const A0 = p[0];
    if (!A0) return;
    if (A0 === 255 || A0 === 254) { chunks.push(cur); cur = []; return; }
    if (A0 !== 46 && A0 !== 47 && A0 !== 3) {
      const token = tokens[i];
      if (token !== lastToken && A0 !== 31) { lastToken = token; currentNote = melody[melodyIndex++]; }
    }
    const t = [A0, p[1], p[2]];
    if (currentNote !== undefined && A0 !== 46 && A0 !== 47 && A0 !== 3) t[3] = noteToPitchByte(currentNote);
    cur.push(t);
  });
  if (cur.length) chunks.push(cur);
  const real = chunks.filter((c) => c.length);
  const samples = real.reduce((a, c) => a + simulate(c, { speed: spd }).samples, 0);
  const maxChunk = Math.max(...real.map((c) => simulate(c, { speed: spd }).t));
  return { chunks: real.length, secs: samples / 22050, maxChunk };
}

const speeds = val('speed') ? [Number(val('speed'))] : [72, 125];
const outPrefix = val('out');
// Path-aware timing measurement: when rendering via the smooth tuple
// stream, calibration must measure that stream (it drops the parser's
// InsertBreath glottal stops that the text path renders). The last
// smooth render's per-syllable fit info is kept for the report.
let lastFitInfo = null;
function pathSim (expansions, rests, spd) {
  if (flag('smooth')) {
    const r = renderSmoothStream(songSpec(expansions), {
      ...VOICE, speed: spd, singmode: true, bits: 16, debug: Boolean(process.env.DEBUG_SMOOTH),
    });
    lastFitInfo = r.fitInfo;
    return { secs: r.samples / 22050, chunks: r.chunks, maxChunk: r.maxChunk };
  }
  const asm = assemble(score, expansions, rests);
  return exactSim(asm.text, asm.melody, spd);
}

// The builder score in the library's SongSpec shape: per-syllable phoneme
// strings, notes, grid units and rests.
function songSpec (expansions) {
  return {
    syllables: expansions.map((e) => e.join(' ')),
    notes: score.map(([, note]) => note),
    units: score.map(([, , u]) => u),
    restUnits: score.map(([, , , r]) => r),
    names: score.map((s) => s[0]),
    unitMs: UNIT_MS,
  };
}

for (const spd of speeds) {
  // calibration: the analytic ms model is ~2% optimistic against the
  // exact simulator (voiced-sample interleaves etc.), so build once,
  // measure the true total, rescale the unit and rebuild.
  let unit = UNIT_MS;
  let built = buildFit(spd, unit);
  let asm = assemble(score, built.expansions, built.rests);
  let sim = pathSim(built.expansions, built.rests, spd);
  const targetSecs = totalUnits * UNIT_MS / 1000;
  const factor = sim.secs / targetSecs;
  if (Math.abs(factor - 1) > 0.004) {
    unit = UNIT_MS / factor;
    built = buildFit(spd, unit);
    asm = assemble(score, built.expansions, built.rests);
    sim = pathSim(built.expansions, built.rests, spd);
  }
  const { text, melody, syllableIds } = asm;
  const { expansions, rests } = built;

  console.log(`\n================ speed ${spd} ================`);
  console.log(`unit calibrated to ${unit.toFixed(2)} ms (analytic) -> exact-sim ${sim.secs.toFixed(2)} s vs MIDI ${targetSecs.toFixed(2)} s`);
  console.log('syllable          target_ms  actual_ms  expansion');
  let totalErr = 0;
  if (flag('smooth')) {
    // the smooth path tunes tuple lengths itself; the parse-based
    // measure() below would report pre-tune lengths, so print the
    // tuned table from the calibration render's fit info instead
    lastFitInfo.forEach(({ targetMs, actualMs }, i) => {
      totalErr += Math.abs(actualMs - targetMs);
      console.log(
        score[i][0].padEnd(16), String(Math.round(targetMs)).padStart(8), String(Math.round(actualMs)).padStart(9), ' ',
        expansions[i].join(' '), ' ', rests[i][1] ? 'rest:' + rests[i][1] + 'Q' : ''
      );
    });
  } else {
    score.forEach(([ph, note, u], i) => {
      const target = u * unit;
      const actual = measure(text, syllableIds[i], spd);
      totalErr += Math.abs(actual - target);
      console.log(
        ph.padEnd(16), String(Math.round(target)).padStart(8), String(Math.round(actual)).padStart(9), ' ',
        expansions[i].join(' '), ' ', rests[i][1] ? 'rest:' + rests[i][1] + 'Q' : ''
      );
    });
  }
  console.log('total syllable-fit error:', Math.round(totalErr), 'ms over', score.length, 'syllables');

  // alignment check: one note per distinct input phoneme token. Q rests
  // are ours (len 5, silent); a len-4 Q means InsertBreath replaced a
  // space with a glottal stop (fine — it lands between words).
  const { phonemes, tokens } = Parser(text);
  const singing = new Set();
  const breaks = [];
  let breathQs = 0;
  phonemes.forEach((p, i) => {
    if (p[0] && p[0] !== 3 && p[0] !== 31 && p[0] !== 254 && p[0] !== 255 && p[0] !== 1 && p[0] !== 2 && p[0] !== 46 && p[0] !== 47) singing.add(tokens[i]);
    if (p[0] === 254) breaks.push(i);
    if (p[0] === 31 && p[1] === 4) breathQs++;
  });
  console.log('singing tokens:', singing.size, '| melody notes:', melody.length, '| match:', singing.size === melody.length);
  console.log('BREAK chunk boundaries:', breaks.length, '| InsertBreath glottal stops (len 4):', breathQs);
  console.log(`largest chunk: ${sim.maxChunk} frames (must stay under 255 to avoid the 8-bit wrap)`);

  const name = outPrefix ?? `daisy-v2-${spd}`;
  let wav;
  if (flag('smooth')) {
    const r = renderSmoothStream(songSpec(built.expansions), {
      ...VOICE, speed: spd, singmode: true, bits: 16, debug: Boolean(process.env.DEBUG_SMOOTH),
    });
    wav = r.wav;
    console.log(`smooth stream: ${r.chunks} chunks, largest ${r.maxChunk} frames, exact-sim ${((r.samples) / 22050).toFixed(2)} s`);
  } else {
    wav = SamJs.toWav(text, { ...VOICE, phonetic: true, singmode: true, melody, speed: spd, bits: 16 });
  }
  if (wav === false) { console.log('RENDER FAILED'); continue; }
  writeFileSync(`/tmp/opencode/${name}.wav`, Buffer.from(wav));
  const secs = (wav.length - 44) / 2 / 22050;
  console.log(`${name}.wav: ${secs.toFixed(2)} s (MIDI target ${targetSecs.toFixed(2)} s)`);

  writeFileSync(`/tmp/opencode/${name}-song.txt`, text);
  writeFileSync(`/tmp/opencode/${name}-melody.txt`, melody.join(' '));
  if (flag('dump-spec')) {
    // The SongSpec the web app embeds (single source of truth: the score
    // above, expansions as fitted at this speed).
    writeFileSync(`/tmp/opencode/${name}-spec.json`, JSON.stringify(songSpec(built.expansions), null, 2));
    console.log('song spec dumped to', `/tmp/opencode/${name}-spec.json`);
  }
  console.log('SONG:');
  console.log(text);
  console.log('MELODY:');
  console.log(melody.join(' '));
}
