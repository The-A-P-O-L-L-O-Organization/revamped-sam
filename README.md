# SAM Software Automatic Mouth

[![CI](https://github.com/The-A-P-O-L-L-O-Organization/revamped-sam/actions/workflows/ci.yml/badge.svg)](https://github.com/The-A-P-O-L-L-O-Organization/revamped-sam/actions/workflows/ci.yml)

SAM is a very small Text-To-Speech (TTS) program written in C, that
runs on most popular platforms.

It is an adaption to Javascript of the speech software SAM (Software
Automatic Mouth) for the Commodore C64 published in the year 1982 by
Don't Ask Software (now SoftVoice, Inc.).

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
| `singmode` | `false` | Singing mode (no pitch contour).    |
| `debug`    | `false` | Debug output.                       |
| `pitch`    | `64`    | Voice pitch (0-255).                |
| `speed`    | `72`    | Speaking speed (1-255).             |
| `mouth`    | `128`   | Mouth formant (0-255).              |
| `throat`   | `128`   | Throat formant (0-255).             |
| `bits`     | `8`     | Container precision of `.wav` output for `download()`/`toWav()`: `8` (the authentic format) or `16` — a lossless container upgrade, every 8-bit sample is represented exactly. |

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
`"types"` field in package.json), so library consumers get editor
autocomplete and compile-time option validation (`SingMode` instead of
`singmode` is rejected, for instance). The synthesis internals remain
faithful plain-ESM JavaScript, guarded by the golden fixtures.

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
