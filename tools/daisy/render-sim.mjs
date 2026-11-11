// Byte-exact accounting replica of SAM's render timing.
//
// This simulates ONLY the sample/frame bookkeeping of
// src/renderer/renderer.js ProcessFrames() and
// src/renderer/output-buffer.js — no audio math. It predicts the exact
// sample count of a rendered chunk of tuples, which makes it the tool for
// verifying tempo and rhythm without listening to audio.
//
// Verified byte-exact against real renders, e.g. 'AA5' at the default voice:
//   speed 72 -> 3499 samples, speed 125 -> 6075 samples (both match).
//
// THE TIMING MODEL (non-obvious, and easy to get wrong):
//
// The output buffer does NOT write five samples per call. Every Output
// call advances a unit accumulator by a per-call value from a timetable
// (output-buffer.js); ONE OUTPUT SAMPLE = 50 UNITS:
//
//   timetable (rows = kind of previous call, columns = this call):
//     prev formant block      -> 162 (formant), 167/167 (uv samples), 127/128 (v samples)
//     prev unvoiced sample    -> 226 (formant),   60/60  (uv samples)
//     prev voiced sample      -> 200 (formant),   54/55  (v samples)
//
// Consequences:
//   - A normal (formant) frame lasts speed * 162 units = speed*162/50
//     samples — NOT speed*5 samples. At speed 72 a frame is ~10.58 ms,
//     not 16.3 ms.
//   - Unvoiced sampled consonants (S, SH, F, TH, /H, /X, CH) emit
//     (flags&248 + 1)*8 fixed Output calls at 60 units per 2 frames —
//     their DURATION IS SPEED-INDEPENDENT (e.g. S = ~105 ms at any speed).
//     This is the classic SAM "fast consonant" quirk, inverted: they are
//     relatively LONGER the faster you speak.
//   - Voiced sampled consonants (Z, ZH, V, DH) render as normal frames
//     plus a small fixed interleave per glottal pulse.
//
// Run with: node --experimental-strip-types tools/daisy/render-sim.mjs
import CreateFrames from '../../src/renderer/create-frames.js';
import CreateTransitions from '../../src/renderer/create-transitions.js';
import SetMouthThroat from '../../src/renderer/set-mouth-throat.js';

const timetable = [
  [162, 167, 167, 127, 128],   // prev = formant block
  [226, 60, 60, 0, 0],         // prev = unvoiced sample 0
  [225, 60, 59, 0, 0],         // prev = unvoiced sample 1
  [200, 0, 0, 54, 55],         // prev = voiced sample 0
  [199, 0, 0, 54, 54],         // prev = voiced sample 1
];

/**
 * Simulate one Render() chunk.
 *
 * @param {Array} tuples Chunk of [phoneme, length, stress, melodyPitch?]
 *   tuples exactly as the renderer's melody-attach loop produces them.
 * @param {Object} [opts]
 * @param {Number} [opts.speed=72]
 * @param {Number} [opts.pitch=197]
 * @param {Number} [opts.mouth=134]
 * @param {Number} [opts.throat=143]
 * @returns {{t: Number, units: Number, samples: Number}} t = nominal frame
 *   count (CreateTransitions' 8-bit total), samples = predicted output
 *   samples for this chunk.
 */
export function simulate (tuples, { speed = 72, pitch = 197, mouth = 134, throat = 143 } = {}) {
  const freqdata = SetMouthThroat(mouth, throat);
  const [pitches, frequency, amplitude, sampledConsonantFlag] = CreateFrames(pitch, tuples, freqdata);
  const t = CreateTransitions(pitches, frequency, amplitude, tuples);

  let units = 0;
  let old = 0; // previous output index (0 = formant block, 1..4 = samples)
  const output = (index) => {
    units += timetable[old][index];
    old = index;
  };

  let speedcounter = speed;
  let pos = 0;
  let frameCount = t;
  let glottal_pulse = pitches[0];
  let mem38 = glottal_pulse * 0.75 | 0;

  while (frameCount) {
    const flags = sampledConsonantFlag[pos];

    if ((flags & 248) !== 0) {
      // RenderSample, unvoiced branch: (flags&248)+1 iterations, 8 Output
      // calls each; per-sample bits alternate between indices 2 and 1,
      // both worth 60/60 (or 59) units.
      const pc = flags & 248;
      for (let it = 0; it < pc + 1; it++) {
        for (let b = 0; b < 8; b++) output((old === 1) ? 1 : 2);
      }
      pos += 2;
      frameCount -= 2;
      speedcounter = speed;
    } else {
      output(0); // the 5-sample formant block
      speedcounter--;
      if (speedcounter === 0) {
        pos++;
        frameCount--;
        if (frameCount === 0) break;
        speedcounter = speed;
      }
      glottal_pulse--;
      if (glottal_pulse !== 0) {
        mem38--;
        if ((mem38 !== 0) || (flags === 0)) continue;
        // voiced sampled interleave: 1+(pitches[pos]>>4) iterations, 8
        // calls each, indices 3/4 (54/55 units).
        const iters = 1 + (pitches[pos] >> 4);
        for (let it = 0; it < iters; it++) {
          for (let b = 0; b < 8; b++) output((old === 3) ? 3 : 4);
        }
      }
    }
    glottal_pulse = pitches[pos];
    mem38 = glottal_pulse * 0.75 | 0;
  }
  return { t, units, samples: Math.floor(units / 50) };
}
