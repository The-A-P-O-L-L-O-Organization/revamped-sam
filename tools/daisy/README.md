# tools/daisy — Daisy Bell homage tooling

Tooling for the SAM "sings Daisy Bell" homage (1961 IBM 7094 / HAL 9000).
`build-daisy.mjs` turns a score (phonemes + note + duration in grid units
transcribed from `daisy-bell.mid`) into a phonetic SONG string + MELODY
note list that sing the tune in rhythm, and renders WAVs.

    node --experimental-strip-types tools/daisy/build-daisy.mjs

It relies on timing facts that are easy to get wrong and cost us a few
iterations, documented here and in `render-sim.mjs`:

## SAM's real frame duration

The output buffer advances a unit accumulator per Output call and
**1 output sample = 50 units** (see `src/renderer/output-buffer.js`). A
normal formant frame advances `162` units *per speed-loop iteration*, so

    frame seconds = speed * 162 / 50 / 22050

— NOT `speed * 5 / 22050` as the "5 samples per call" reading suggests.
At speed 72 a frame is ~10.58 ms, not 16.3 ms.

Unvoiced sampled consonants (S, SH, F, TH, /H, /X, CH) emit
`(flags&248 + 1) * 8` fixed Output calls at 60 units per 2 frames — their
duration is **speed-independent** (S ≈ 105 ms at any speed).

## Chunking limits

`CreateTransitions` returns the chunk's total frame count masked to 8 bits
(`& 0xFF`): a chunk longer than 255 frames has its tail truncated. The
parser's `InsertBreath` keeps chunks under ~232 frames by replacing the
last space with a silent glottal stop (`Q`, len 4) + `BREAK` — so long
phrases self-chunk at word boundaries, and any text assembled for singing
must never rely on a chunk longer than that.

## Silence and rests

`Q` (glottal stop, phoneme 31) and punctuation (comma/period/question)
have zero formant amplitude — they are **fully silent**, and their length
is what makes the silence. `Q` = 5 frames. Unlike a comma, `Q` is not
FLAG_PUNCT: it does not trigger the ×1.5 punctuation chain (which inflates
the preceding syllable's tail by 50% and raises the floor of short notes),
nor the parser's stressed-vowel glottal-stop insertion. Chains of `Q`s are
therefore the cleanest rests: `Q Q Q Q Q Q Q` ≈ 370 ms at speed 72.

## How the builder fits notes

SAM has no explicit note duration; a note is held by repeating the vowel
(interior repeats UNSTRESSED, so the parser's stressed-vowel glottal-stop
rule never fires inside a held note) and diphthongs are decomposed
(`AY -> AA…YX`). `build-daisy.mjs` auto-fits each syllable's expansion
against a per-phoneme millisecond model of the real render, corrects
onset drift sequentially (so floor-limited syllables like `sweet` don't
push the beat late), and verifies the final text with `render-sim.mjs`,
which is byte-exact against real renders.

## The chorus score (MIDI-derived)

The final chorus score in `build-daisy.mjs` (`--chorus`) was re-derived
directly from `daisy-bell.mid` (PPQ 256, 165 BPM → one grid unit =
363.636 ms) rather than transcribed by ear. Facts baked into the score:

- One unit = one 256-tick step. Note on/off times define each syllable's
  grid slot; near-contiguous notes mean legato phrasing.
- Pitch corrections verified against the MIDI: "-swer" is G3 and "love"
  is A3 (both were transcribed a third low).
- "an-" in "answer" is stressed — 2 units, matching the arrangement's
  accent on "give me your AN-swer do".
- Dramatic pauses after "sweet" (2.38 u) and "seat" (1.38 u) are real,
  but the vowel is *held through* them (sung 3 u / 2 u) instead of
  leaving dead silence — silence inside a sung phrase reads as a cut.
- Likewise the 1-unit lifts inside "Dai-sy": the vowel fills the gap, so
  onsets stay on the MIDI grid (sy at u2, second Dai at u4) without an
  audible break inside the word.
- The ~6-unit instrumental fill after "Daisy, Daisy" (chorus u10–u16) is
  skipped: the voice sings continuously, like the 1961 recording.
- Order per pass is [phrases 1-4, refrain], octaves as in the beloved
  render (the melody's MIDI octave doubling is not reproduced).

Render by-ear pick: `--chorus --speed 72 --masked --smooth` (speed 72 is
the tempo-true sweet spot — above ~77 the phoneme-length floors make
quick syllables unachievable).

## Smooth stream renderer (`--smooth`)

`smooth-render.mjs` bypasses the text path: it renders the parsed
syllable tuples directly with per-syllable frame-granular retuning
(`tuneSyllable` returns the exact sample count), so every note fits its
grid slot. Chunk seams are packed to land inside identical vowel holds
and de-clicked with short PCM fades, and 16-bit output is produced
directly. The web Sing tab cannot use this path (it renders text), so
the web default `Daisy, Daisy…` text at speed 72 gets InsertBreath
glottal stops that the smooth path drops — timing there is
approximate by design.
