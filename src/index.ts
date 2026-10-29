/**
 * SamOptions are accepted by the SamJs constructor.
 */
export interface SamOptions {
  /**
   * Assume the input is plain English and convert it to phonemes
   * through the Reciter module. Default: false.
   */
  phonetic?: boolean;
  /**
   * Enable singing mode (no pitch contour). Default: false.
   */
  singmode?: boolean;
  /**
   * Output debug traces to the console.
   * Default: false.
   */
  debug?: boolean;
  /**
   * Voice pitch (0-255). Default: 64.
   */
  pitch?: number;
  /**
   * Speaking speed (1-255). Default: 72.
   */
  speed?: number;
  /**
   * Mouth formant (0-255). Default: 128.
   */
  mouth?: number;
  /**
   * Throat formant (0-255). Default: 128.
   */
  throat?: number;
}

/** The 8-bit wave buffer the renderer produces, or false if parsing failed. */
export type SamProcessResult = Uint8Array | false;

/** The 32-bit wave buffer the renderer produces, or false if parsing failed. */
export type SamBufferResult = Float32Array | false;

import { PlayBuffer, RenderBuffer } from './util/player.js';
import { SamProcess, SamBuffer } from './sam/sam.js';
import TextToPhonemes from './reciter/reciter.js';

/**
 * SAM - The Software Automatic Mouth.
 *
 * Renders text (plain English or SAM phonemes) to audible speech.
 *
 * Example:
 *
 *     new SamJs({ pitch: 64 }).speak('Hello world.');
 *     new SamJs({}).download('Hello world.');
 *
 * @param {object} [options] See SamOptions.
 */
function samJsFactory (options?: SamOptions): SamJsInstance {
  const opts = options || {};

  const ensurePhonetic = (text: string, phonetic?: boolean): string => {
    if (!(phonetic || opts.phonetic)) {
      return TextToPhonemes(text) as string;
    }
    return text.toUpperCase();
  }

  return {
    /**
     * Render the passed text as an 8bit wave buffer array.
     *
     * @param {string}  text       The text to render or phoneme string.
     * @param {boolean} [phonetic] Flag if the input text is already phonetic data.
     *
     * @return {Uint8Array|Boolean} The wave buffer or false.
     */
    buf8 (text: string, phonetic?: boolean): SamProcessResult {
      return SamProcess(ensurePhonetic(text, phonetic), opts) as SamProcessResult;
    },

    /**
     * Render the passed text as a 32bit wave buffer array.
     *
     * @param {string}  text       The text to render or phoneme string.
     * @param {boolean} [phonetic] Flag if the input text is already phonetic data.
     *
     * @return {Float32Array|Boolean} The wave buffer or false.
     */
    buf32 (text: string, phonetic?: boolean): SamBufferResult {
      return SamBuffer(ensurePhonetic(text, phonetic), opts) as SamBufferResult;
    },

    /**
     * Render the passed text as wave buffer and play it over the speakers.
     *
     * @param {string}  text       The text to render or phoneme string.
     * @param {boolean} [phonetic] Flag if the input text is already phonetic data.
     *
     * @return {Promise<boolean>} Resolves once playback has finished.
     */
    speak (text: string, phonetic?: boolean): Promise<boolean> {
      const buffer = SamBuffer(ensurePhonetic(text, phonetic), opts) as SamBufferResult;
      if (buffer === false) {
        return Promise.reject(new Error('SamJs.speak(): could not parse the passed text.'));
      }
      return PlayBuffer(buffer);
    },

    /**
     * Render the passed text as wave buffer and download it via URL API
     * (browser only).
     *
     * @param {string}  text       The text to render or phoneme string.
     * @param {boolean} [phonetic] Flag if the input text is already phonetic data.
     *
     * @return void
     */
    download (text: string, phonetic?: boolean): void {
      if (typeof window === 'undefined') {
        throw new Error('SamJs.download() requires a browser environment (window/document/Blob). Use buf8() to obtain the raw wave buffer instead.');
      }
      const buffer = SamProcess(ensurePhonetic(text, phonetic), opts) as SamProcessResult;
      if (buffer === false) {
        throw new Error('SamJs.download(): could not parse the passed text.');
      }
      RenderBuffer(buffer);
    },
  };
}

/**
 * The constructor callable plus its static helpers for functional use.
 */
export interface SamJsFactory {
  (options?: SamOptions): SamJsInstance;
  new (options?: SamOptions): SamJsInstance;
  /** Convert English text to SAM phonemes via the Reciter module. */
  convert (text: string): string | false;
  /** Raw 8-bit renderer, see SamProcess(). */
  buf8 (input: string, options?: SamOptions): SamProcessResult;
  /** Raw 32-bit renderer, see SamBuffer(). */
  buf32 (input: string, options?: SamOptions): SamBufferResult;
}

/**
 * The instance shape returned by (new) SamJs().
 */
export interface SamJsInstance {
  /** Render the text to an 8-bit wave buffer (Uint8Array), or false. */
  buf8 (text: string, phonetic?: boolean): SamProcessResult;
  /** Render the text to a 32-bit wave buffer (Float32Array), or false. */
  buf32 (text: string, phonetic?: boolean): SamBufferResult;
  /** Render and play the text over the speakers. Resolves once playback finished. */
  speak (text: string, phonetic?: boolean): Promise<boolean>;
  /** Render and download the text as a .wav file (browser only). */
  download (text: string, phonetic?: boolean): void;
}

// Attach the static helpers for functional use without instantiation, and
// expose the whole public default export under a single (callable) type.
const SamJs = samJsFactory as unknown as SamJsFactory;

export default SamJs;

Object.assign(SamJs, {
  /** Convert English text to SAM phonemes via the Reciter module. */
  convert: (text: string): string | false => TextToPhonemes(text) as string | false,
  /** Raw 8-bit renderer, see SamProcess(). */
  buf8: (input: string, options?: SamOptions): SamProcessResult => SamProcess(input, options) as SamProcessResult,
  /** Raw 32-bit renderer, see SamBuffer(). */
  buf32: (input: string, options?: SamOptions): SamBufferResult => SamBuffer(input, options) as SamBufferResult,
});
