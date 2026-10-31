import {PlayBuffer, UInt8ArrayToFloat32Array} from '../util/player.js';

import Parser from '../parser/parser.js';
import Renderer from '../renderer/renderer.js';

/**
 * Process the input and play the audio buffer.
 *
 * @param {String|Boolean} input  Blank (or falsy) input is treated as a parse failure.
 *
 * @param {object}  [options]
 * @param {Boolean} [options.singmode] Default false.
 * @param {Boolean} [options.debug]    Default false.
 * @param {Number}  [options.pitch]    Default 64.
 * @param {Number}  [options.speed]    Default 72.
 * @param {Number}  [options.mouth]    Default 128.
 * @param {Number}  [options.throat]   Default 128.
 *
 * @return {Promise}
 */
export function SamSpeak (input, options) {
  const buffer = SamBuffer(input, options);
  if (false === buffer) {
    return Promise.reject();
  }

  // Now push buffer to wave player.
  return PlayBuffer(buffer);
}

/**
 * Process the input and return the audio buffer.
 *
 * @param {String|Boolean} input  Blank (or falsy) input is treated as a parse failure.
 *
 * @param {object}  [options]
 * @param {Boolean} [options.singmode] Default false.
 * @param {Boolean} [options.debug]    Default false.
 * @param {Number}  [options.pitch]    Default 64.
 * @param {Number}  [options.speed]    Default 72.
 * @param {Number}  [options.mouth]    Default 128.
 * @param {Number}  [options.throat]   Default 128.
 *
 * @return {Float32Array|Boolean}
 */
export function SamBuffer (input, options) {
  const buffer = SamProcess(input, options);
  if (false === buffer) {
    return false;
  }

  return UInt8ArrayToFloat32Array(buffer);
}

/**
 * Process the input and return signed 16-bit PCM samples.
 *
 * This is a lossless container upgrade of the 8-bit renderer output:
 * every byte sample is represented exactly (worked out as a signed shift),
 * no quantization is applied on top of what the synthesis itself produces.
 *
 * @param {String|Boolean} input  Blank (or falsy) input is treated as a parse failure.
 *
 * @param {object}  [options]
 * @param {Boolean} [options.singmode] Default false.
 * @param {Boolean} [options.debug]    Default false.
 * @param {Number}  [options.pitch]    Default 64.
 * @param {Number}  [options.speed]    Default 72.
 * @param {Number}  [options.mouth]    Default 128.
 * @param {Number}  [options.throat]   Default 128.
 *
 * @return {Int16Array|Boolean}
 */
export function SamBuffer16 (input, options) {
  const buffer = SamProcess(input, options);
  if (false === buffer) {
    return false;
  }

  const samples = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    samples[i] = (buffer[i] - 128) * 256;
  }

  return samples;
}

/**
 * Process the input and return the audiobuffer.
 *
 * @param {String|Boolean} input  Blank (or falsy) input is treated as a parse failure.
 *
 * @param {object}  [options]
 * @param {Boolean} [options.singmode] Default false.
 * @param {Boolean} [options.debug]    Default false.
 * @param {Number}  [options.pitch]    Default 64.
 * @param {Number}  [options.speed]    Default 72.
 * @param {Number}  [options.mouth]    Default 128.
 * @param {Number}  [options.throat]   Default 128.
 * @param {Boolean} [options.hq]       High-precision render path. Default false.
 *
 * @return {Uint8Array|Boolean}
 */
export function SamProcess (input, options = {}) {
  const parsed = Parser(input);
  if (false === parsed) {
    return false;
  }

  return Renderer(parsed, options.pitch, options.mouth, options.throat, options.speed, options.singmode, options.hq);
}
