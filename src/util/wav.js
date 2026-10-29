import {
  text2Uint8Array,
  Uint32ToUint8Array,
  Uint16ToUint8Array
} from './util.js';

/**
 * Build a complete RIFF/WAVE file image from raw 8-bit PCM samples,
 * the format the SAM renderer produces (unsigned, 128 = silence).
 *
 * This helper is environment agnostic: it produces plain bytes, so it
 * works in the browser (hand it to a Blob) and in Node (write it to a
 * file) alike; used for tests as well.
 *
 * @param {Uint8Array} audiobuffer Raw unsigned 8-bit PCM samples.
 * @param {Number}     [bits]      Bits per samples of the resulting container,
 *                                 either 8 (the authentic format, default)
 *                                 or 16 (a lossless container upgrade: every
 *                                 8-bit sample is represented exactly, no
 *                                 further quantization is applied).
 * @param {Number}     [sampleRate] Sample rate of the source data. Default 22050.
 *
 * @return {Uint8Array} The complete .wav file image.
 */
export default function BuildWav (audiobuffer, bits = 8, sampleRate = 22050) {
  if (bits !== 8 && bits !== 16) {
    throw new Error(`BuildWav(): "bits" must be 8 or 16, got ${bits}.`);
  }

  const channels = 1;
  const blockAlign = channels * (bits / 8);
  const dataBytes = bits === 8 ? audiobuffer.length : audiobuffer.length * 2;

  // Calculate buffer size.
  const realbuffer = new Uint8Array(
    4 + // "RIFF"
    4 + // uint32 filesize
    4 + // "WAVE"
    4 + // "fmt "
    4 + // uint32 fmt length
    2 + // uint16 fmt
    2 + // uint16 channels
    4 + // uint32 sample rate
    4 + // uint32 bytes per second
    2 + // uint16 block align
    2 + // uint16 bits per sample
    4 + // "data"
    4 + // uint32 chunk length
    dataBytes
  );

  let pos = 0;
  const write = (bytes) => {
    realbuffer.set(bytes, pos);
    pos += bytes.length;
  };
  const writeText = (value) => write(text2Uint8Array(value));

  //RIFF header
  writeText('RIFF'); // chunkID
  // ChunkSize: whole file size minus the 8 bytes of the "RIFF" header itself:
  // 4 ("WAVE") + 8 (fmt chunk header) + 16 (fmt chunk) + 8 (data chunk header)
  // + dataBytes = dataBytes + 36
  write(Uint32ToUint8Array(dataBytes + 36)); // ChunkSize
  writeText('WAVE'); // riffType
  //format chunk
  writeText('fmt ');
  write(Uint32ToUint8Array(16)); // ChunkSize
  write(Uint16ToUint8Array(1)); // wFormatTag - 1 = PCM
  write(Uint16ToUint8Array(channels)); // channels
  write(Uint32ToUint8Array(sampleRate)); // samplerate
  write(Uint32ToUint8Array(sampleRate * blockAlign)); // bytes/second
  write(Uint16ToUint8Array(blockAlign)); // blockalign
  write(Uint16ToUint8Array(bits)); // bits per sample
  //data chunk
  writeText('data');
  write(Uint32ToUint8Array(dataBytes)); // buffer length

  if (bits === 8) {
    // Unsigned 8-bit PCM: the source data already comes in exactly this
    // format, so it can be written as-is.
    write(audiobuffer);
  } else {
    // Signed 16-bit little-endian PCM: upscale every byte sample into its
    // exact 16-bit representation. byte - 128 is in -128..127, shifting it
    // left by 8 yields the same signal without any quantization loss.
    for (let i = 0; i < audiobuffer.length; i++) {
      const value = (audiobuffer[i] - 128) * 256;
      realbuffer[pos++] = value & 0xFF;
      realbuffer[pos++] = (value >> 8) & 0xFF;
    }
  }

  return realbuffer;
}
