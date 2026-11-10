/**
 * Melody support: note names to SAM pitch bytes.
 *
 * SAM's glottal pulse period is the pitch byte P of the current frame,
 * and one pulse iteration advances the output by 162/50 samples (the
 * C64 timetable advance, see output-buffer.js), so the fundamental
 * frequency of a rendered frame is
 *
 *     F0 = 22050 / (P * 162/50) = 1102500 / (162 * P) Hz
 *
 * (verified empirically against sustained renders in
 * test/renderer/singing.spec.js). Inverting that maps a note's
 * frequency onto the 8-bit pulse period.
 */

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NOTE_RE = /^([A-G])([#Bb]?)([0-8])$/;

/** The fundamental of pitch byte P: F0 = 1102500 / (162 * P) Hz. */
const pitchByteToHz = (byte) => 1102500 / (162 * byte);

/**
 * Convert a note name to the SAM pitch byte closest to its frequency.
 *
 * @param {String} note Note name like 'C4', 'F#3', 'Bb5' (A4 = 440 Hz),
 *                      or '-' for a rest (keep the base pitch).
 *
 * @return {Number|null} The pitch byte (1-255), or null for a rest.
 */
export function noteToPitchByte (note) {
  if (note === '-') {
    return null;
  }
  const match = NOTE_RE.exec(note.toUpperCase());
  if (match === null) {
    throw new Error(
      `Invalid melody note ${JSON.stringify(note)} ` +
      '(expected note names like C4, F#3, Bb5, or "-" for a rest).'
    );
  }
  const semitone = SEMITONES[match[1]] + (match[2] === '#' ? 1 : match[2] === 'B' ? -1 : 0);
  const midi = (Number(match[3]) + 1) * 12 + semitone;
  const hz = 440 * Math.pow(2, (midi - 69) / 12);
  return Math.min(255, Math.max(1, Math.round(pitchByteToHz(hz))));
}

/**
 * Normalize and validate a melody option.
 *
 * @param {String[]|undefined} melody One note per phoneme, in order.
 *
 * @return {Array<Number>|undefined} Pitch bytes (or null rests), or
 *                                   undefined when no melody was given.
 */
export function normalizeMelody (melody) {
  if (melody === undefined || melody === null) {
    return undefined;
  }
  if (!Array.isArray(melody)) {
    throw new Error('The melody option must be an array of note names.');
  }
  const bytes = melody.map((note) => {
    if (typeof note !== 'string') {
      throw new Error(
        `Invalid melody note ${JSON.stringify(note)} ` +
        '(expected note names like C4, F#3, Bb5, or "-" for a rest).'
      );
    }
    return noteToPitchByte(note);
  });
  return bytes.length > 0 ? bytes : undefined;
}
