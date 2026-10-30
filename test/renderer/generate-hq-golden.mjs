// One-off generator for test/renderer/fixtures/hq-golden.json.
// Re-run with:
//   node --experimental-strip-types test/renderer/generate-hq-golden.mjs
// The synthesis is a pure function of its input, so the output is stable
// across engines; rerunning only rewrites the identical file.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { default: SamJs } = await import('../../src/index.ts');

const toBase64 = (bytes) => Buffer
  .from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  .toString('base64');

// A consonant-heavy sentence, embedded via the Reciter so the fixture
// input is stable phoneme data.
const sentence = SamJs.convert('The quick brown fox jumps over the lazy dog.');

const cases = [
  {
    input: '/HEHLOW',
    options: {},
  },
  {
    input: '/HEHLOW',
    options: { pitch: 30, speed: 100, mouth: 90, throat: 180 },
  },
  {
    input: sentence,
    options: {},
  },
  {
    input: sentence,
    options: { singmode: true },
  },
];

const fixture = {
  info: 'Golden fixtures for the high-precision render path. "classic" is the default bit-exact C64 render, "hq" the output of the same render with the hq option (full-precision sine, rounded and clamped formant mix).',
  cases: cases.map(({ input, options }) => ({
    input,
    options,
    classic: toBase64(SamJs.buf8(input, Object.assign({}, options, { phonetic: true }))),
    hq: toBase64(SamJs.buf8(input, Object.assign({}, options, { phonetic: true, hq: true }))),
  })),
};

const target = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'hq-golden.json');
writeFileSync(target, JSON.stringify(fixture, null, 2) + '\n');
console.log('cases:', fixture.cases.length);
for (const c of fixture.cases) {
  const classic = Buffer.from(c.classic, 'base64').length;
  const hq = Buffer.from(c.hq, 'base64').length;
  console.log(`${c.input.slice(0, 32)}${c.input.length > 32 ? '...' : ''} opts=${JSON.stringify(c.options)} classic=${classic} hq=${hq}`);
}
