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
  /**
   * Container precision of .wav downloads and the toWav() helper:
   * 8-bit PCM (the authentic format, default) or 16-bit PCM (a lossless
   * container upgrade - every 8-bit sample is represented exactly).
   */
  bits?: 8 | 16;
  /**
   * High-precision render path: keeps the full sine amplitude instead of
   * quantizing it to the level steps of the C64 simulation, and rounds
   * and clamps the formant mix instead of letting it wrap around.
   * The render timing is identical, but the voice is smoother and less
   * crunchy than `false` (the authentic classic render). Default: false.
   */
  hq?: boolean;
}

/** The 8-bit wave buffer the renderer produces, or false if parsing failed. */
export type SamProcessResult = Uint8Array | false;

/** The 32-bit wave buffer the renderer produces, or false if parsing failed. */
export type SamBufferResult = Float32Array | false;

/** The signed 16-bit samples the renderer produces, or false if parsing failed. */
export type SamBuffer16Result = Int16Array | false;

/**
 * Per-call arguments for the instance methods: pass `true`/`false` as a
 * shorthand for the phonetic flag, or an options object whose entries
 * override the constructor options for this call only.
 */
export type SamCallOptions = SamOptions;
export type SamInputOptions = boolean | SamCallOptions;

import { PlayBuffer, RenderBuffer } from './util/player.js';
import { SamProcess, SamBuffer, SamBuffer16 } from './sam/sam.js';
import BuildWav from './util/wav.js';
import TextToPhonemes from './reciter/reciter.js';

/**
 * Keys accepted by SamOptions - the runtime validation allowlist.
 * TypeScript gives this protection at compile time; plain JavaScript
 * callers get it here at runtime.
 */
const ALLOWED_KEYS = [
  'phonetic', 'singmode', 'debug', 'pitch', 'speed', 'mouth', 'throat', 'bits', 'hq',
];

/**
 * Reject any option key the engine does not understand, so plain
 * JavaScript callers get the same protection the TypeScript consumers
 * get at compile time.
 */
function validateOptions (options: SamOptions): void {
  Object.keys(options).forEach(function (key) {
    if (ALLOWED_KEYS.indexOf(key) === -1) {
      throw new Error(
        `Unknown option "${key}" (accepted options: ${ALLOWED_KEYS.join(', ')}).`
      );
    }
  });
}

/**
 * SamOptions for one call: merge the constructor options with the
 * per-call overrides and detect the phonetic flag.
 *
 * @param {object}   [base]       constructor options.
 * @param {SamInputOptions} [callOptions] boolean phonetic flag or per-call overrides.
 *
 * @return {object} The merged options (with `phonetic`) for this call.
 */
function resolveOptions (
  base: SamOptions,
  callOptions?: SamInputOptions
): SamOptions {
  validateOptions(base);
  if (typeof callOptions === 'boolean') {
    return Object.assign({}, base, {phonetic: callOptions});
  }
  if (callOptions) {
    validateOptions(callOptions);
    return Object.assign(Object.assign({}, base), callOptions);
  }
  return base;
}

/**
 * Phonetic handling shared by the instance methods and the static
 * helpers: recite plain English text, uppercase phonetic input. Blank
 * input is treated as a parse failure (the methods return false
 * instead of synthesizing silence).
 */
function ensurePhonetic (text: string, merged: SamOptions): string | false {
  if (text.trim() === '') {
    return false;
  }
  return merged.phonetic ? text.toUpperCase() : (TextToPhonemes(text) as string | false);
}

/**
 * Render and package a complete .wav file image, shared by the instance
 * toWav() and the static SamJs.toWav().
 */
function renderWav (text: string, options: SamOptions): SamProcessResult {
  const buffer = SamProcess(ensurePhonetic(text, options), options) as SamProcessResult;
  if (buffer === false) {
    return false;
  }
  return BuildWav(buffer, options.bits);
}

/**
 * SamJs - The Software Automatic Mouth.
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
  validateOptions(opts);

  return {
    /**
     * Render the passed text as an 8bit wave buffer array.
     *
     * @param {string}  [text]     The text to render or phoneme string.
     * @param {SamInputOptions} [options] `true` for phonetic input, or per-call
     *                                     option overrides.
     *
     * @return {Uint8Array|Boolean} The wave buffer or false.
     */
    buf8 (text: string, callOptions?: SamInputOptions): SamProcessResult {
      const merged = resolveOptions(opts, callOptions);
      return SamProcess(ensurePhonetic(text, merged), merged) as SamProcessResult;
    },

    /**
     * Render the passed text as signed 16-bit PCM samples.
     *
     * @param {string}  [text]     The text to render or phoneme string.
     * @param {SamInputOptions} [options] `true` for phonetic input, or per-call
     *                                     option overrides.
     *
     * @return {Int16Array|Boolean} The samples or false.
     */
    buf16 (text: string, callOptions?: SamInputOptions): SamBuffer16Result {
      const merged = resolveOptions(opts, callOptions);
      return SamBuffer16(ensurePhonetic(text, merged), merged) as SamBuffer16Result;
    },

    /**
     * Render the passed text as a 32bit wave buffer array.
     *
     * @param {string}  [text]     The text to render or phoneme string.
     * @param {SamInputOptions} [options] `true` for phonetic input, or per-call
     *                                     option overrides.
     *
     * @return {Float32Array|Boolean} The wave buffer or false.
     */
    buf32 (text: string, callOptions?: SamInputOptions): SamBufferResult {
      const merged = resolveOptions(opts, callOptions);
      return SamBuffer(ensurePhonetic(text, merged), merged) as SamBufferResult;
    },

    /**
     * Render the passed text as wave buffer and play it over the speakers.
     *
     * @param {string}  [text]     The text to render or phoneme string.
     * @param {SamInputOptions} [options] `true` for phonetic input, or per-call
     *                                     option overrides.
     *
     * @return {Promise<boolean>} Resolves once playback has finished.
     */
    speak (text: string, callOptions?: SamInputOptions): Promise<boolean> {
      const merged = resolveOptions(opts, callOptions);
      const buffer = SamBuffer(ensurePhonetic(text, merged), merged) as SamBufferResult;
      if (buffer === false) {
        return Promise.reject(new Error('SamJs.speak(): could not parse the passed text.'));
      }
      return PlayBuffer(buffer);
    },

    /**
     * Render the passed text as a .wav file image. Environment agnostic:
     * works in browsers and in Node alike.
     *
     * @param {string}  [text]     The text to render or phoneme string.
     * @param {SamInputOptions} [options] `true` for phonetic input, or per-call
     *                                     option overrides.
     *
     * @return {Uint8Array|Boolean} The complete .wav file image, or false.
     */
    toWav (text: string, callOptions?: SamInputOptions): SamProcessResult {
      return renderWav(text, resolveOptions(opts, callOptions));
    },

    /**
     * Render the passed text as wave buffer and download it via URL API
     * (browser only).
     *
     * @param {string}  [text]     The text to render or phoneme string.
     * @param {SamInputOptions} [options] `true` for phonetic input, or per-call
     *                                     option overrides.
     * @param {string}  [filename] Download file name, defaults to 'sam.wav'.
     *
     * @return void
     */
    download (text: string, callOptions?: SamInputOptions, filename?: string): void {
      if (typeof window === 'undefined') {
        throw new Error('SamJs.download() requires a browser environment (window/document/Blob). Use toWav() in Node instead.');
      }
      const merged = resolveOptions(opts, callOptions);
      const buffer = SamProcess(ensurePhonetic(text, merged), merged) as SamProcessResult;
      if (buffer === false) {
        throw new Error('SamJs.download(): could not parse the passed text.');
      }
      RenderBuffer(buffer, filename || 'sam.wav', merged.bits);
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
  /** Signed 16-bit samples, see SamBuffer16(). */
  buf16 (input: string, options?: SamOptions): SamBuffer16Result;
  /** Raw 32-bit renderer, see SamBuffer(). */
  buf32 (input: string, options?: SamOptions): SamBufferResult;
  /** Render and return a complete .wav file image (browser and Node). */
  toWav (input: string, options?: SamOptions): SamProcessResult;
}

/**
 * The instance shape returned by (new) SamJs().
 */
export interface SamJsInstance {
  /** Render the text to an 8-bit wave buffer (Uint8Array), or false. */
  buf8 (text: string, callOptions?: SamInputOptions): SamProcessResult;
  /** Render the text to signed 16-bit samples (Int16Array), or false. */
  buf16 (text: string, callOptions?: SamInputOptions): SamBuffer16Result;
  /** Render the text to a 32-bit wave buffer (Float32Array), or false. */
  buf32 (text: string, callOptions?: SamInputOptions): SamBufferResult;
  /** Render and play the text over the speakers. Resolves once playback finished. */
  speak (text: string, callOptions?: SamInputOptions): Promise<boolean>;
  /** Render the text to a complete .wav file image (Uint8Array), or false. */
  toWav (text: string, callOptions?: SamInputOptions): SamProcessResult;
  /** Render and download the text as a .wav file (browser only). */
  download (text: string, callOptions?: SamInputOptions, filename?: string): void;
}

// Attach the static helpers for functional use without instantiation, and
// expose the whole public default export under a single (callable) type.
const SamJs = samJsFactory as unknown as SamJsFactory;

export default SamJs;

Object.assign(SamJs, {
  /** Convert English text to SAM phonemes via the Reciter module. */
  convert: (text: string): string | false => TextToPhonemes(text) as string | false,
  /** Raw 8-bit renderer, see SamProcess(). */
  buf8: (input: string, options?: SamOptions): SamProcessResult => {
    const merged: SamOptions = resolveOptions({}, options) as SamOptions;
    return SamProcess(ensurePhonetic(input, merged), merged) as SamProcessResult;
  },
  /** Signed 16-bit samples, see SamBuffer16(). */
  buf16: (input: string, options?: SamOptions): SamBuffer16Result => {
    const merged: SamOptions = resolveOptions({}, options) as SamOptions;
    return SamBuffer16(ensurePhonetic(input, merged), merged) as SamBuffer16Result;
  },
  /** Raw 32-bit renderer, see SamBuffer(). */
  buf32: (input: string, options?: SamOptions): SamBufferResult => {
    const merged: SamOptions = resolveOptions({}, options) as SamOptions;
    return SamBuffer(ensurePhonetic(input, merged), merged) as SamBufferResult;
  },
  /** Render and return a complete .wav file image (browser and Node). */
  toWav: (input: string, options?: SamOptions): SamProcessResult => renderWav(input, resolveOptions({}, options)),
});
