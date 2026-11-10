# SAM Software Automatic Mouth

[![CI](https://github.com/The-A-P-O-L-L-O-Organization/revamped-sam/actions/workflows/ci.yml/badge.svg)](https://github.com/The-A-P-O-L-L-O-Organization/revamped-sam/actions/workflows/ci.yml)

SAM is a very small Text-To-Speech (TTS) program written in C, that
runs on most popular platforms.

It is an adaption to JavaScript with a typed TypeScript public API of the
speech software SAM (Software Automatic Mouth) for the Commodore C64
published in the year 1982 by Don't Ask Software (now SoftVoice, Inc.).

It is based on the adaption to C by
[Stefan Macke](https://github.com/s-macke/SAM)
and the refactorings by
[Vidar Hokstad](https://github.com/vidarh/SAM) and
[8BitPimp](https://github.com/8BitPimp/SAM)

It aims for low memory impact and file size which is the reason I want
to avoid the
[Emscripten conversion](http://simulationcorner.net/index.php?page=sam)
by Stefan (which weights about 414kb).

## About this repository

This is a fork of [Imrane03/better-sam](https://github.com/Imrane03/better-sam),
which is itself a fork of the JavaScript port by
[Christian Schiffler](https://github.com/discordier/sam) (sam-js).

Improvements of the fork lineage on top of the plain library:

- Two buttons: speech "Preview" and ".WAV Download";
- Adjustable `pitch`, `speed`, `mouth` and `throat` sliders;
- Downloadable `.WAV` files (hand-made RIFF/WAVE header, no dependencies),
  built by an environment-agnostic wav writer with optional 16-bit PCM
  containers (`bits`) and a Node-friendly `toWav()` helper;
- Per-call option overrides for pitch/speed/mouth/throat and friends;
- Singing: the classic stress-digit `singmode` and a modern `melody`
  option that assigns one concert-pitch note per phoneme (see
  [Singing](#singing));
- An optional `hq` high-precision render path for a smoother voice,
  alongside the bit-exact authentic C64 render (both are pinned by golden
  fixtures), and a `masking` switch to disable the glottal-pulse phase
  re-sync for an even smoother voice without losing the render timing;
- The Reciter knows some modern vocabulary now (AI, AGI, ASI, ANI, API,
  CPU, GPU, USB, HTTP(S), HTML, CSS, PDF, MP3, OS, TTS, JS, JSON, OCR,
  QR, WiFi), which the original 1982 rule set rendered as bogus English
  fragments, plus whole-word English pronunciation exceptions for
  tricky spellings (TIDAL = /ˈtaɪdəl/, not "tih-dul"; WEATHER =
  /ˈwɛðər/, not "wee-ther") the classic rule set misreads;
- A self-contained demo page (`index.html`), later reworked into the
  React demo app in [`web/`](web) that CI deploys to GitHub Pages. The
  app previews the recited phonemes and the waveform live, and the voice
  settings are shareable via the URL.

## Usage

**Live demo:** https://the-a-p-o-l-l-o-organization.github.io/revamped-sam/

The hosted demo is a React app built with [shadcn/ui](https://ui.shadcn.com)
and Tailwind CSS, living in [`web/`](web). CI builds it and deploys it to
GitHub Pages automatically on every push to `main` (via
`actions/deploy-pages`), so `docs/` is never committed build output —
just rebuild locally with `pnpm build` inside `web/`. Note that
`web/vite.config.ts` aliases `samjs` to `../src/index.ts`, so the demo
always bundles the current library *sources*, not the committed `dist/`.

Include the prebuilt UMD library (`dist/samjs.js`) and create a `SamJs`
instance:

```html
<script src="dist/samjs.js"></script>
<script>
  var opts = { debug: 1, pitch: 64, speed: 72, mouth: 128, throat: 128 };
  new SamJs(opts).speak('Hello world.');      // play through the speakers
  new SamJs(opts).download('Hello world.');   // download as .wav (browser only)
</script>
```

Available instance methods:

| Method    | Description                                                    |
|-----------|----------------------------------------------------------------|
| `speak()` | Render text and play it via the Web Audio API. Returns a `Promise`. |
| `download()` | Render and trigger a `.wav` download. Browser only; an optional third argument sets the file name (default `sam.wav`). Use `toWav()` in Node. |
| `buf8()`  | Render and return the raw 8-bit wave buffer (`Uint8Array`).     |
| `buf16()` | Render and return signed 16-bit samples (`Int16Array`).         |
| `buf32()` | Render and return the raw 32-bit wave buffer (`Float32Array`).  |
| `toWav()` | Render and return a complete `.wav` file image (`Uint8Array`). Works in browsers and Node. |

Every render method accepts an optional per-call options object instead of
the legacy plain `phonetic` boolean, whose entries override the constructor
options for that call; the boolean shorthand for phonetic input keeps working:

```js
const sam = new SamJs({ pitch: 64 });
sam.speak('hello.', { pitch: 128 });        // higher pitch for this call only
sam.buf8('/HEHLOW', true);                  // boolean phonetic shorthand
new SamJs({}).toWav('`') === false;         // returned instead of empty data
```

All methods take such a per-call parameter; the special `phonetic: true` entry
(or a plain boolean) treats the input as SAM phoneme data instead of English
text. Plain English text is converted through the bundled **Reciter** module
(`SamJs.convert`).

Options accepted by the constructor:

| Option     | Default | Meaning                             |
|------------|---------|-------------------------------------|
| `phonetic` | `false` | Assume phonetic input.              |
| `singmode` | `false` | Singing mode: skips the F1 pitch contour, so the phoneme stress digits become pitch steps — the original SAM's singing mechanism (see [Singing](#singing)). |
| `debug`    | `false` | Debug output.                       |
| `pitch`    | `64`    | Voice pitch (0-255).                |
| `speed`    | `72`    | Speaking speed (1-255).             |
| `mouth`    | `128`   | Mouth formant (0-255).              |
| `throat`   | `128`   | Throat formant (0-255).             |
| `bits`     | `8`     | Container precision of `.wav` output for `download()`/`toWav()`: `8` (the authentic format) or `16` — a lossless container upgrade, every 8-bit sample is represented exactly. |
| `hq`       | `false` | High-precision render path: keeps the full sine amplitude instead of quantizing it to the level steps of the C64 simulation, and rounds and clamps the formant mix instead of letting it wrap around. Identical render timing, but a smoother and less crunchy voice than the authentic classic render. |
| `masking`  | `true`  | Glottal-pulse masking: re-syncs the phase of the formant generators to every glottal pulse, exactly as the original 6502 renderer does — the mechanism behind SAM's characteristic buzzy timbre. Disable for a smoother, more natural voice; identical render timing either way. |
| `melody`   | —       | Singing melody: one note per phoneme (see [Singing](#singing)). |

## Singing

There are two ways to make SAM sing. Both skip the F1 pitch contour
(the speech-mode contour would detune held notes), and both keep the
render timing of their phoneme stream, with one authentic exception
noted at the end of this section.

**1. Classic stress-digit singing (`singmode: true`).** The original
mechanism: with phonetic input, the digit after each phoneme
(`1`–`8`) is a pitch step — at the default pitch 64 the steps span
roughly 55–140 Hz. This is how the 1982 software sang its demos:

```js
new SamJs().speak('D EH4 Y4 D EH4 Y5 G IH5 V M IY6 Y UW5 R AE8 N S ER D UW5', {
  phonetic: true,
  singmode: true,
});
```

**2. Melody notes (`melody`).** A modern extension for real tuneful
singing: an array with one note name per phoneme of the input, in
order. Note names are concert pitch (`'C4'`, `'F#3'`, `'Bb5'`, A4 =
440 Hz); `'-'` is a rest that keeps the base pitch for that phoneme.
Punctuation marks (`.`, `,`, `?`) and the parser-inserted glottal stop
do not consume a note; extra notes are ignored, and phonemes beyond
the melody keep the base pitch. One note covers everything the parser
derives from a phoneme — the glide of a diphthong (`AY` → `AY YX`) and
the closure frames of a plosive stop (`D` → `D` + 2 closures) sing the
same note as the phoneme that produced them.

```js
new SamJs().speak('D EH4 Y4 D EH4 Y5 G IH5 V M IY6 Y UW5 R AE8 N S ER D UW5', {
  phonetic: true,
  melody: 'C4 C4 G4 G4 A4 A4 G4 G4 F4 F4 E4 E4 D4 D4 C4 C4'.split(' '),
});
```

SAM renders pitch through an 8-bit glottal pulse period, so notes are
quantized to `F0 = 1102500 / (162 × pitch byte)` Hz — spot-on in the
bass and tenor range (A3, C4, E4 are within a few cents) and a few
percent off in the top octaves. Each note holds exactly while its
phoneme renders; consonants glide into the next note through the
formant transitions.

One authentic SAM quirk carries over: the render timing is identical
to the spoken render for ordinary phonemes, but the voiced sampled
consonants (V, Z, DH, ZH) produce their sample inside the glottal
pulse loop, so their rendered length genuinely depends on the pitch
byte — a high note on a "V" renders a longer buzz. That is the
original renderer's behavior, not a melody artifact (the classic
stress-digit `singmode` has the same property).

## Development

Requires Node.js 26+ and [pnpm](https://pnpm.io/) (`npm install -g corepack &&
corepack enable pnpm`); versions are pinned via the `engines` and
`packageManager` fields and `.node-version`, so fnm/volta users get the right
toolchain automatically.

```bash
pnpm install

# Rebuild the library and same bundle into dist/
# (samjs UMD/CommonJS/ESM + guessnum demo variants)
pnpm build

# Watch builds
pnpm dev         # UMD, development
pnpm prod        # UMD, production
pnpm dev:cjs     # CommonJS
pnpm dev:esm     # ES modules
pnpm guessnum-dev

# Tests
pnpm lint    # oxlint over src/ and build/ (web/ lints itself)
pnpm test    # regression suites: reciter/parser/renderer + golden fixtures
pnpm cov     # same suites under c8 coverage (adds lcov/ HTML report)

# Web app (shadcn/ui demo, auto-deployed to GitHub Pages by CI)
cd web
pnpm install
pnpm build
```

Note on running the sources directly with `node --experimental-strip-types`:
the package intentionally stays typeless (`"type"` is unset, because the
build/test toolchain is CommonJS), so Node prints a
`MODULE_TYPELESS_PACKAGE_JSON` warning for type-stripped entry points. It is
harmless — use `pnpm build`/`pnpm test` or import `dist/` normally.

The development toolchain is modernized for Node 26: the build uses Rollup 4 +
Terser instead of Rollup 1 + Uglify, tests run on Mocha 11, and the retired
Karma browser harness was removed (the fixture-based regression suites cover
the same logic under plain Node; the `karma-test` code paths in the sources
are still what drive the golden fixtures).

CI lints, builds, and runs the regression suites under coverage, fails
if the committed `dist/` bundles are out of date with the sources, and
deploys the web app to GitHub Pages on every push to `main`.

Note: the committed `dist/` folder ships prebuilt bundles so library
consumers work straight from a checkout. Rebuild it with `pnpm build` after
changing anything in `src/` — CI enforces this by rebuilding and diffing
`dist/` on every push and pull request. (The hosted demo is exempt: the
web app bundles `src/` directly through its Vite alias.)

## TypeScript

The public API surface (`src/index.ts`) is TypeScript; `pnpm build` compiles
it and ships the public declarations as `dist/samjs.d.ts` (referenced by the
`"types"` field in package.json). The synthesis internals remain faithful
plain-ESM JavaScript, guarded by the golden fixtures.

Library consumers get:

- editor autocomplete and option validation: misspelled keys
  (`SingMode` instead of `singmode`) are rejected and `bits` only accepts
  `8 | 16` — in the constructor and in the per-call overrides
  (`SamInputOptions = boolean | SamCallOptions`) alike. TypeScript
  consumers are checked at compile time; plain JavaScript callers get the
  same protection at runtime: constructor options are validated when the
  `SamJs` instance is created, per-call overrides when the method is
  called, and invalid `bits` values or blank input also fail loudly;
- the exact result shapes as exported types: `SamProcessResult`
  (`Uint8Array | false`), `SamBuffer16Result` (`Int16Array | false`) and
  `SamBufferResult` (`Float32Array | false`);
- the instance and factory shapes (`SamJsInstance`, `SamJsFactory`), so both
  `new SamJs()` and the bare `SamJs()` functional form are typed.

## Original docs.

I have bundled copies of the original manual and its scans in this
repository, see the [manual](docs-src/manual.md), the [hand-book
PDF](docs-src/sam.pdf) and the [images](docs-src/img) in the
[docs-src](docs-src) directory (plus `docs-src/downloads/GUESSNUM.BAS`,
the C64 BASIC demo program). The plain-JS demo's build assets live in
`docs/`, which is generated build output (see above).

## License

The software is a reverse-engineered version of a commercial software
published more than 30 years ago. The current copyright holder is
SoftVoice, Inc. (www.text2speech.com)

Any attempt to contact the company failed. The website was last
updated in the year 2009. The status of the original
software can therefore best described as Abandonware
(http://en.wikipedia.org/wiki/Abandonware)

As long this is the case I cannot put my code under any specific open
source software license Use it at your own risk.

If you have questions don't hesitate to ask me. If you discovered some
new knowledge about the code please file an issue.
