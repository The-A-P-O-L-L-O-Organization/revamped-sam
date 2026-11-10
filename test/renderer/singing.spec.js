import { assert } from 'chai';

import SamJs from '../../src/index.ts';
import { noteToPitchByte } from '../../src/renderer/notes.js';

// Singing: the classic stress-digit path (phonetic input digits 1-8 are
// pitch steps when `singmode` skips the F1 pitch contour) and the modern
// `melody` option (one note per phoneme, sung on the same singing path).
const eq = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

describe('classic sing mode (singmode)', () => {
  it('should skip the F1 pitch contour', () => {
    const spoken = SamJs.buf8('AA', { phonetic: true });
    const sung = SamJs.buf8('AA', { phonetic: true, singmode: true });
    assert.notDeepEqual(Array.from(spoken), Array.from(sung));
  });

  it('should turn the stress digits 1-8 into pitch steps', () => {
    const low = SamJs.buf8('AA1', { phonetic: true, singmode: true });
    const high = SamJs.buf8('AA8', { phonetic: true, singmode: true });
    assert.notDeepEqual(Array.from(low), Array.from(high));
  });

  it('should render a melody-free phrase without crashing', () => {
    const sung = SamJs.buf8('D EH4 Y4 D EH4 Y5 G IH5 V M IY6 YUW5R AH8NSWER', {
      phonetic: true,
      singmode: true,
    });
    assert.isFalse(sung === false);
    assert.isAbove(sung.length, 1000);
  });
});

describe('melody notes (per phoneme)', () => {
  const phrase = 'D EH4 Y4 D EH4 Y5 G IH5 V M IY6 YUW5R AH8NSWER';
  const notes = ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4', 'A4', 'G4', 'A4'];

  it('should not change the render timing', () => {
    const plain = SamJs.buf8('AA AA', { phonetic: true, singmode: true });
    const sung = SamJs.buf8('AA AA', { phonetic: true, singmode: true, melody: ['A3', 'C4'] });
    assert.strictEqual(plain.length, sung.length);
  });

  it('should map notes to the phonemes of the input, not the expanded tuples', () => {
    // The parser splits diphthongs (AY -> AY YX) and prolongs plosive stop
    // consonants (D -> D + 2 closures) into extra tuples, and inserts
    // glottal stops. A note must attach once per input phoneme: one note
    // covers the whole expanded group, extra notes are ignored beyond the
    // input phoneme count.
    const one = SamJs.buf8('AY', { phonetic: true, melody: ['C4'] });
    const two = SamJs.buf8('AY', { phonetic: true, melody: ['C4', 'G4'] });
    assert.isTrue(eq(one, two), 'the AY glide must sing the diphthong note');

    const daa = SamJs.buf8('D AA', { phonetic: true, melody: ['C4', 'G3'] });
    const daaExtra = SamJs.buf8('D AA', { phonetic: true, melody: ['C4', 'G3', 'E4', 'A4'] });
    assert.isTrue(eq(daa, daaExtra), 'notes beyond the input phoneme count are ignored');
  });

  it('should keep the authentic pitch-dependent sample length of V/Z/DH/ZH', () => {
    // The voiced sampled consonants produce their sample inside the
    // glottal pulse loop, so their rendered length depends on the pitch
    // byte — authentic SAM behavior, shared with classic `singmode`.
    const plain = SamJs.buf8('V', { phonetic: true, singmode: true });
    const sung = SamJs.buf8('V', { phonetic: true, singmode: true, melody: ['A7'] });
    assert.notStrictEqual(sung.length, plain.length);
    assert.isAbove(sung.length, plain.length);
  });

  it('should switch the renderer to the singing path (no F1 contour)', () => {
    const withoutSingmode = SamJs.buf8('AA', { phonetic: true, melody: ['A3'] });
    const withSingmode = SamJs.buf8('AA', { phonetic: true, singmode: true, melody: ['A3'] });
    assert.isTrue(eq(withoutSingmode, withSingmode));
  });

  it('should render at exactly the note pitch (A3 = pitch byte 31)', () => {
    // A3 = 220 Hz; the glottal pulse period (the pitch byte) that comes
    // closest is 31 (1102500 / (162 * 220) = 30.93). With `singmode` the
    // pitch byte is the base pitch verbatim, so a sustained vowel must
    // render byte-identically via both paths.
    const viaMelody = SamJs.buf8('AA', { phonetic: true, melody: ['A3'] });
    const viaPitch = SamJs.buf8('AA', { phonetic: true, singmode: true, pitch: 31 });
    assert.isTrue(eq(viaMelody, viaPitch));
  });

  it('should change the output with the notes', () => {
    const a3 = SamJs.buf8('AA', { phonetic: true, melody: ['A3'] });
    const c4 = SamJs.buf8('AA', { phonetic: true, melody: ['C4'] });
    assert.notDeepEqual(Array.from(a3), Array.from(c4));
  });

  it('should override the stress digits of the phonetic input', () => {
    const digit5 = SamJs.buf8('AA5', { phonetic: true, melody: ['A3'] });
    const digit8 = SamJs.buf8('AA8', { phonetic: true, melody: ['A3'] });
    assert.isTrue(eq(digit5, digit8));
  });

  it('should treat "-" as a rest (keep the base pitch)', () => {
    const rests = SamJs.buf8('AA AA', { phonetic: true, singmode: true, melody: ['-', '-'] });
    const plain = SamJs.buf8('AA AA', { phonetic: true, singmode: true });
    assert.isTrue(eq(rests, plain));
  });

  it('should ignore notes beyond the phoneme count', () => {
    const exact = SamJs.buf8('AA AA', { phonetic: true, melody: ['A3', 'C4'] });
    const extra = SamJs.buf8('AA AA', { phonetic: true, melody: ['A3', 'C4', 'G4', 'E5'] });
    assert.isTrue(eq(exact, extra));
  });

  it('should keep phonemes beyond the melody at the base pitch', () => {
    const both = SamJs.buf8('AA AA', { phonetic: true, melody: ['A3', 'A3'] });
    const one = SamJs.buf8('AA AA', { phonetic: true, melody: ['A3'] });
    // The second phoneme sings A3 in the first render and the base
    // pitch (64) in the second, so they must differ.
    assert.notDeepEqual(Array.from(both), Array.from(one));
  });

  it('should accept shorter melodies on English input', () => {
    const sung = SamJs.buf8('La la la', { melody: ['C4', 'E4', 'G4'] });
    assert.isFalse(sung === false);
    assert.strictEqual(sung.length, SamJs.buf8('La la la', {}).length);
  });

  it('should reject malformed notes', () => {
    assert.throws(() => SamJs.buf8('AA', { phonetic: true, melody: ['X9'] }), /Invalid melody note "X9"/);
    assert.throws(() => SamJs.buf8('AA', { phonetic: true, melody: ['C10'] }), /Invalid melody note/);
    assert.throws(() => SamJs.buf8('AA', { phonetic: true, melody: [42] }), /Invalid melody note/);
    assert.throws(() => SamJs.buf8('AA', { phonetic: true, melody: 'C4' }), /must be an array/);
  });

  it('should reject typo-ed option spellings', () => {
    assert.throws(() => SamJs.buf8('AA', { phonetic: true, Melody: ['C4'] }), /Unknown option "Melody"/);
  });

  it('should not consume notes on punctuation', () => {
    // Comma, period and question mark are phrase markers, not sung
    // phonemes (the comma pause is phoneme 3 in the parser output).
    const comma2 = SamJs.buf8('AA , AA', { phonetic: true, melody: ['G3', 'C4'] });
    const comma3 = SamJs.buf8('AA , AA', { phonetic: true, melody: ['G3', 'C4', 'C4'] });
    assert.isTrue(eq(comma2, comma3));
    const period2 = SamJs.buf8('AA . AA', { phonetic: true, melody: ['G3', 'C4'] });
    const period3 = SamJs.buf8('AA . AA', { phonetic: true, melody: ['G3', 'C4', 'C4'] });
    assert.isTrue(eq(period2, period3));
    const question2 = SamJs.buf8('AA ? AA', { phonetic: true, melody: ['G3', 'C4'] });
    const question3 = SamJs.buf8('AA ? AA', { phonetic: true, melody: ['G3', 'C4', 'C4'] });
    assert.isTrue(eq(question2, question3));
  });
});

describe('note to pitch byte conversion', () => {
  it('should map concert pitch correctly', () => {
    // F0 = 1102500 / (162 * pitch byte) Hz, inverted for note names.
    assert.strictEqual(noteToPitchByte('A3'), 31);   // 220 Hz
    assert.strictEqual(noteToPitchByte('C4'), 26);   // ~261.6 Hz
    assert.strictEqual(noteToPitchByte('A4'), 15);   // 440 Hz
  });

  it('should handle sharps, flats and letter case', () => {
    // Bb3 is enharmonically identical to A#3 (same frequency, same byte).
    assert.strictEqual(noteToPitchByte('Bb3'), noteToPitchByte('A#3'));
    assert.strictEqual(noteToPitchByte('a#3'), noteToPitchByte('A#3'));
    assert.strictEqual(noteToPitchByte('bb3'), noteToPitchByte('Bb3'));
    assert.notStrictEqual(noteToPitchByte('B3'), noteToPitchByte('A#3'));
  });

  it('should treat "-" as a rest', () => {
    assert.isNull(noteToPitchByte('-'));
  });
});

describe('Daisy Bell homage', () => {
  // The full chorus of "Daisy Bell" (Harry Dacre, 1892), transcribed from
  // the mfiles.co.uk piano/vocal MIDI and transposed one octave down into
  // SAM's accurate pitch range. Rendered end-to-end (conversion +
  // rendering, not byte-golden) in homage to the 1961 IBM 7094 — the
  // first computer to sing, which sang this song.
  const PHONEMES = 'D6 EH6 Y6 S6 IY6 , D6 EH6 Y6 S6 IY6 , G6 IH6 V6 M2 IY2 Y2 AO2 R2 AE2 N2 S4 ER4 D6 UW6 , AY6 M6 /H6 AE6 F6 K6 R6 EY6 Z6 IY6 , AO6 L6 F2 AO2 R2 DH2 AH2 L4 AH4 V4 AH2 V2 Y6 UW6 , IH2 T2 W2 OW2 N2 T2 B2 IY2 AH2 S4 T4 AY4 L2 IH2 SH2 M2 AE2 R2 IH7 J7 , AY2 K4 AE4 N4 T4 AH2 F2 AO4 R4 D4 AH2 K2 AE2 R2 IH7 J7 , B2 AH2 T2 Y2 UW2 L2 L4 UH4 K4 S6 W6 IY6 T6 AO4 N4 DH2 AH2 S4 IY4 T4 AH1 V1 AH1 B2 AY2 S2 IH2 K2 AH2 L2 B4 IH4 L4 T4 F2 AO2 R2 T8 UW8 ,';
  const MELODY = 'D4 D4 D4 B3 B3 G3 G3 G3 D3 D3 E3 E3 E3 F#3 F#3 G3 G3 G3 E3 E3 G3 G3 D3 D3 A3 A3 D4 D4 D4 B3 B3 B3 G3 G3 E3 E3 F#3 F#3 F#3 G3 G3 A3 A3 A3 B3 B3 A3 A3 B3 B3 C4 C4 C4 C4 B3 B3 A3 D4 D4 D4 B3 B3 B3 A3 A3 A3 G3 G3 A3 B3 B3 B3 B3 G3 G3 E3 E3 E3 G3 E3 E3 E3 D3 D3 D3 D3 D3 G3 G3 G3 B3 B3 B3 A3 A3 A3 A3 G3 G3 B3 B3 A3 A3 A3 B3 B3 C4 D4 D4 B3 B3 G3 G3 G3 A3 A3 A3 A3 D3 D3 D3 G3 G3'.split(' ');

  it('should render the full chorus with the melody', () => {
    const sung = SamJs.buf8(PHONEMES, { phonetic: true, singmode: true, melody: MELODY, speed: 50 });
    assert.isFalse(sung === false);
    assert.isAbove(sung.length, 100000);
  });

  it('should consume exactly one note per phoneme', () => {
    const withMelody = SamJs.buf8(PHONEMES, { phonetic: true, singmode: true, melody: MELODY, speed: 50 });
    const withExtra = SamJs.buf8(PHONEMES, { phonetic: true, singmode: true, melody: [...MELODY, 'A3', 'A3', 'A3', 'A3'], speed: 50 });
    const withShort = SamJs.buf8(PHONEMES, { phonetic: true, singmode: true, melody: MELODY.slice(0, MELODY.length - 1), speed: 50 });
    assert.isTrue(eq(withMelody, withExtra), 'extra notes are ignored');
    assert.isFalse(eq(withMelody, withShort), 'the last note is sung by the last phoneme');
  });

  it('should differ from the same phrase without the melody', () => {
    const sung = SamJs.buf8(PHONEMES, { phonetic: true, singmode: true, melody: MELODY, speed: 50 });
    const spoken = SamJs.buf8(PHONEMES, { phonetic: true, singmode: true, speed: 50 });
    assert.isFalse(eq(sung, spoken));
  });
});
