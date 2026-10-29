declare module 'samjs' {
  interface SamOptions {
    /** Assume the input is already SAM phoneme data. */
    phonetic?: boolean
    /** Singing mode (no pitch contour). */
    singmode?: boolean
    /** Debug output. */
    debug?: boolean
    /** Voice pitch (0-255). Default 64. */
    pitch?: number
    /** Speaking speed (1-255). Default 72. */
    speed?: number
    /** Mouth formant (0-255). Default 128. */
    mouth?: number
    /** Throat formant (0-255). Default 128. */
    throat?: number
  }

  export default class SamJs {
    constructor(options?: Partial<SamOptions>)
    /** Render the text and play it via the Web Audio API. */
    speak(text: string, phonetic?: boolean): Promise<unknown>
    /** Render the text and trigger a .wav download (browser only). */
    download(text: string, phonetic?: boolean): void
    /** Render the text to an 8-bit wave buffer. */
    buf8(text: string, phonetic?: boolean): Uint8Array
    /** Render the text to a 32-bit wave buffer. */
    buf32(text: string, phonetic?: boolean): Float32Array
    /** Convert English text to SAM phonemes via the Reciter module. */
    static convert(text: string): string
  }
}
