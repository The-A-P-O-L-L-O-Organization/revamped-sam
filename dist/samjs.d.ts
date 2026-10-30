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
/**
 * The constructor callable plus its static helpers for functional use.
 */
export interface SamJsFactory {
    (options?: SamOptions): SamJsInstance;
    new (options?: SamOptions): SamJsInstance;
    /** Convert English text to SAM phonemes via the Reciter module. */
    convert(text: string): string | false;
    /** Raw 8-bit renderer, see SamProcess(). */
    buf8(input: string, options?: SamOptions): SamProcessResult;
    /** Signed 16-bit samples, see SamBuffer16(). */
    buf16(input: string, options?: SamOptions): SamBuffer16Result;
    /** Raw 32-bit renderer, see SamBuffer(). */
    buf32(input: string, options?: SamOptions): SamBufferResult;
    /** Render and return a complete .wav file image (browser and Node). */
    toWav(input: string, options?: SamOptions): SamProcessResult;
}
/**
 * The instance shape returned by (new) SamJs().
 */
export interface SamJsInstance {
    /** Render the text to an 8-bit wave buffer (Uint8Array), or false. */
    buf8(text: string, callOptions?: SamInputOptions): SamProcessResult;
    /** Render the text to signed 16-bit samples (Int16Array), or false. */
    buf16(text: string, callOptions?: SamInputOptions): SamBuffer16Result;
    /** Render the text to a 32-bit wave buffer (Float32Array), or false. */
    buf32(text: string, callOptions?: SamInputOptions): SamBufferResult;
    /** Render and play the text over the speakers. Resolves once playback finished. */
    speak(text: string, callOptions?: SamInputOptions): Promise<boolean>;
    /** Render the text to a complete .wav file image (Uint8Array), or false. */
    toWav(text: string, callOptions?: SamInputOptions): SamProcessResult;
    /** Render and download the text as a .wav file (browser only). */
    download(text: string, callOptions?: SamInputOptions, filename?: string): void;
}
declare const SamJs: SamJsFactory;
export default SamJs;
