import { assert } from 'chai';

import SamJs from '../../src/index.ts';

// The modern vocabulary rules fire on whole words only; pinned outputs,
// and each conversion is verified to render end-to-end.
const VOCABULARY = [
  ['AI', 'EH4Y.AY4.'],
  ['ANI', 'EY4EH4NAY4'],
  ['AGI', 'EY4JIYAY4'],
  ['ASI', 'EY4EH4SAY4'],
  ['API', 'EY4PIYAY4'],
  ['CPU', 'SIYPIYYUW4'],
  ['GPU', 'JIYPIYYUW4'],
  ['USB', 'YUWEH4SBIY4'],
  ['HTTP', 'EY4CHTIYTIYPIY4'],
  ['HTTPS', 'EY4CHTIYTIYPIYEH4S'],
  ['HTML', 'EY4CHTIYEH4MEH4L'],
  ['CSS', 'SIYEH4SEH4S'],
  ['PDF', 'PIYDIYEH4F'],
  ['MP3', 'EH4MPIYTHRIY4'],
  ['OS', 'OHEH4S'],
  ['TTS', 'TIYTIYEH4S'],
  ['JS', 'JEYEH4S'],
  ['JSON', 'JEYSAH4N'],
  ['OCR', 'OHSIYAAR4'],
  ['QR', 'KEYAAR4'],
  ['WIFI', 'WAY4FAY4'],
];

describe('Reciter: modern vocabulary', () => {
  VOCABULARY.forEach(([word, expected]) => {
    describe(word, () => {
      it(`should convert to ${expected}`, () => {
        const result = SamJs.convert(word);
        assert.isFalse(result === false);
        assert.strictEqual(result.trim(), expected);
      });

      it('should render end-to-end', () => {
        const phonemes = SamJs.convert(word);
        assert.isFalse(phonemes === false);
        const wav = new SamJs({}).toWav(phonemes, { phonetic: true });
        assert.isFalse(wav === false, 'render failed');
        assert.isAbove(wav.length, 100);
      });
    });
  });

  it('should consume a trailing period like the legacy (A.) rule', () => {
    assert.strictEqual(SamJs.convert('AI.'), ' EH4Y.AY4. ');
    assert.strictEqual(SamJs.convert('I am an AI.'), ' AY4 AEM AEN EH4Y.AY4. ');
    assert.strictEqual(SamJs.convert('HTTP.'), ' EY4CHTIYTIYPIY4. ');
  });

  it('should work after punctuation', () => {
    assert.strictEqual(SamJs.convert('AI,'), ' EH4Y.AY4.,');
  });

  it('should not shadow mid-word spellings', () => {
    assert.strictEqual(SamJs.convert('AILED'), ' EY4LD');
    assert.strictEqual(SamJs.convert('AIR'), ' EH4R');
    assert.strictEqual(SamJs.convert('ANITA'), ' AENIHTAH');
    assert.strictEqual(SamJs.convert('AGILE'), ' AEJIHL');
    assert.strictEqual(SamJs.convert('ASIA'), ' EY5ZIHAH');
    assert.strictEqual(SamJs.convert('OSLO'), ' AASLOW');
    assert.strictEqual(SamJs.convert('APIX'), ' AEPIHKS');
    assert.strictEqual(SamJs.convert('POSS'), ' PAO5S');
  });
});
