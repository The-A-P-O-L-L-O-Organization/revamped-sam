# SAM Software Automatic Mouth

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
- Downloadable `.WAV` files (hand-made RIFF/WAVE header, no dependencies);
- A simple, self-contained demo page (`index.html`).

## Usage

**Live demo:** https://the-a-p-o-l-l-o-organization.github.io/revamped-sam/

The hosted demo is a React app built with [shadcn/ui](https://ui.shadcn.com)
and Tailwind CSS, living in [`web/`](web). GitHub Pages serves its production
bundle from the `docs/` directory; rebuild it with `pnpm build` inside `web/`.

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
| `download()` | Render text and trigger a `.wav` download. Browser only; use `buf8()` in Node. |
| `buf8()`  | Render and return the raw 8-bit wave buffer (`Uint8Array`).     |
| `buf32()` | Render and return the raw 32-bit wave buffer (`Float32Array`).  |

All methods take an optional second parameter `phonetic` which should be set
to `true` if the input is already SAM phoneme data instead of English text.
Plain English text is converted through the bundled **Reciter** module
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
pnpm test    # Node (mocha): reciter/parser/renderer regression suites

# Web app (shadcn/ui demo, outputs to docs/ for GitHub Pages)
cd web
pnpm install
pnpm build
```

The development toolchain is modernized for Node 26: the build uses Rollup 4 +
Terser instead of Rollup 1 + Uglify, tests run on Mocha 11, and the retired
Karma browser harness was removed (the fixture-based regression suites cover
the same logic under plain Node; the `karma-test` code paths in the sources
are still what drive the golden fixtures).

CI rebuilds both the library (`dist/`) and the web app (`docs/`) and fails
if either is out of date with the sources.

Note: the committed `dist/` folder ships prebuilt bundles so the demo page
works straight from a checkout (and from GitHub Pages). Rebuild it with
`pnpm build` after changing anything in `src/` so the demo does not drift
from the sources — CI enforces this by rebuilding and diffing `dist/` on
every push and pull request.

## Original docs.

I have bundled a copy of the original manual in this repository, see
the [manual](docs/manual.md) file in the [docs](docs) directory.

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
