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
    /** Raw 32-bit renderer, see SamBuffer(). */
    buf32(input: string, options?: SamOptions): SamBufferResult;
}
/**
 * The instance shape returned by (new) SamJs().
 */
export interface SamJsInstance {
    /** Render the text to an 8-bit wave buffer (Uint8Array), or false. */
    buf8(text: string, phonetic?: boolean): SamProcessResult;
    /** Render the text to a 32-bit wave buffer (Float32Array), or false. */
    buf32(text: string, phonetic?: boolean): SamBufferResult;
    /** Render and play the text over the speakers. Resolves once playback finished. */
    speak(text: string, phonetic?: boolean): Promise<boolean>;
    /** Render and download the text as a .wav file (browser only). */
    download(text: string, phonetic?: boolean): void;
}
declare const SamJs: SamJsFactory;
export default SamJs;
