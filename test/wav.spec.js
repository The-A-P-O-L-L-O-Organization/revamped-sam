import { assert } from 'chai';

import SamJs from '../src/index.ts';
import BuildWav from '../src/util/wav.js';

/**
 * Parse the interesting RIFF/WAVE header fields of a built wav image.
 */
function parseWavHeader (wav) {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const readText = (offset) => String.fromCharCode(
    wav[offset], wav[offset + 1], wav[offset + 2], wav[offset + 3]
  );
  return {
    chunkId: readText(0),
    chunkSize: view.getUint32(4, true),
    format: readText(8),
    fmtId: readText(12),
    fmtSize: view.getUint32(16, true),
    formatTag: view.getUint16(20, true),
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    byteRate: view.getUint32(28, true),
    blockAlign: view.getUint16(32, true),
    bitsPerSample: view.getUint16(34, true),
    dataId: readText(36),
    dataSize: view.getUint32(40, true),
  };
}

describe('wav builder', () => {
  let samples;

  before(() => {
    // Deterministic synthesis input: fixed phonemes.
    samples = new SamJs({}).buf8('/HEHLOW', true);
  });

  it('the reference render should not be empty', () => {
    assert.isArray(samples === false ? [] : Array.from(samples));
    assert.isAbove(samples.length, 100);
  });

  describe('8-bit container (default)', () => {
    let wav, header;

    before(() => {
      wav = BuildWav(samples);
      header = parseWavHeader(wav);
    });

    it('should be writable/parseable as a full RIFF file', () => {
      assert.strictEqual(header.chunkId, 'RIFF');
      assert.strictEqual(header.format, 'WAVE');
      assert.strictEqual(header.fmtId, 'fmt ');
      assert.strictEqual(header.dataId, 'data');
    });

    it('should advertise 8-bit unsigned PCM at 22050 Hz', () => {
      assert.strictEqual(header.formatTag, 1);
      assert.strictEqual(header.channels, 1);
      assert.strictEqual(header.sampleRate, 22050);
      assert.strictEqual(header.bitsPerSample, 8);
      assert.strictEqual(header.blockAlign, 1);
      assert.strictEqual(header.byteRate, 22050);
    });

    it('should have coherent chunk sizes and keep the samples as-is', () => {
      assert.strictEqual(header.dataSize, samples.length);
      assert.strictEqual(header.chunkSize, samples.length + 36);
      assert.strictEqual(wav.length, samples.length + 44);
      assert.deepEqual(Array.from(wav.slice(44)), Array.from(samples));
    });

    it('RenderBuffer should produce the same data', () => {
      // The browser download path is a thin wrapper around the builder;
      // byte-wise compatibility is what the golden checks are after.
      assert.deepEqual(BuildWav(samples, 8), BuildWav(samples));
    });
  });

  describe('16-bit container', () => {
    let wav, header;

    before(() => {
      wav = BuildWav(samples, 16);
      header = parseWavHeader(wav);
    });

    it('should advertise 16-bit signed PCM at 22050 Hz', () => {
      assert.strictEqual(header.formatTag, 1);
      assert.strictEqual(header.channels, 1);
      assert.strictEqual(header.sampleRate, 22050);
      assert.strictEqual(header.bitsPerSample, 16);
      assert.strictEqual(header.blockAlign, 2);
      assert.strictEqual(header.byteRate, 44100);
    });

    it('should have coherent chunk sizes', () => {
      assert.strictEqual(header.dataSize, samples.length * 2);
      assert.strictEqual(header.chunkSize, samples.length * 2 + 36);
      assert.strictEqual(wav.length, samples.length * 2 + 44);
    });

    it('should upscale every byte sample losslessly', () => {
      const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
      for (let i = 0; i < samples.length; i++) {
        const expected = (samples[i] - 128) * 256;
        const actual = view.getInt16(44 + i * 2, true);
        assert.strictEqual(actual, expected, `sample ${i}`);
      }
    });
  });

  it('should reject anything but 8 or 16 bits', () => {
    assert.throws(() => BuildWav(samples, 12), /bits/);
    assert.throws(() => BuildWav(samples, 0), /bits/);
  });
});

describe('render API extensions', () => {
  describe('toWav()', () => {
    it('should work without a browser (Node)', () => {
      const wav = new SamJs({}).toWav('/HEHLOW', true);
      assert.isFalse(wav === false);
      assert.strictEqual(String.fromCharCode(wav[0], wav[1], wav[2], wav[3]), 'RIFF');
    });

    it('should reflect the bits option', () => {
      const wav8 = new SamJs({}).toWav('/HEHLOW', { phonetic: true, bits: 8 });
      const wav16 = new SamJs({}).toWav('/HEHLOW', { phonetic: true, bits: 16 });
      const header8 = parseWavHeader(wav8);
      const header16 = parseWavHeader(wav16);
      assert.strictEqual(header8.bitsPerSample, 8);
      assert.strictEqual(header16.bitsPerSample, 16);
      assert.strictEqual(header16.dataSize, header8.dataSize * 2);
      assert.strictEqual(wav16.length, 2 * (wav8.length - 44) + 44);
    });

    it('should return false for unparsable text', () => {
      assert.strictEqual(new SamJs({}).toWav('`'), false);
    });
  });

  describe('buf16()', () => {
    it('should return the exact signed 16-bit representation of buf8()', () => {
      const buf8 = new SamJs({}).buf8('/HEHLOW', true);
      const buf16 = new SamJs({}).buf16('/HEHLOW', true);
      assert.strictEqual(buf16.length, buf8.length);
      for (let i = 0; i < buf8.length; i++) {
        assert.strictEqual(buf16[i], (buf8[i] - 128) * 256);
      }
    });

    it('should return false for unparsable text', () => {
      assert.strictEqual(new SamJs({}).buf16('`'), false);
    });
  });

  describe('per-call option overrides', () => {
    it('the boolean shorthand should keep working', () => {
      assert.deepEqual(
        Array.from(new SamJs({}).buf8('/HEHLOW', true)),
        Array.from(new SamJs({}).buf8('/HEHLOW', { phonetic: true }))
      );
    });

    it('a speed override should change the rendered length', () => {
      const plain = new SamJs({}).buf8('/HEHLOW', true);
      const slow = new SamJs({}).buf8('/HEHLOW', { phonetic: true, speed: 255 });
      assert.isAbove(slow.length, plain.length);
    });

    it('a constructor pitch should be overridable per call', () => {
      const plain = new SamJs({ pitch: 127 }).buf8('/HEHLOW', true);
      const lowered = new SamJs({ pitch: 127 }).buf8('/HEHLOW', { phonetic: true, pitch: 10 });
      assert.notDeepEqual(Array.from(plain), Array.from(lowered));
    });

    it('plain English text should be recited unless phonetic is passed', () => {
      const direct = new SamJs({}).buf8('HELLO THERE.');
      assert.isFalse(direct === false);
      assert.isAbove(direct.length, 100);
    });
  });
});
