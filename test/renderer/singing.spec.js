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
