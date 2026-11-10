import { useEffect, useMemo, useRef, useState } from 'react'
import SamJs from 'samjs'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'

const CONTROLS = [
  { key: 'pitch', label: 'Pitch', min: 0, max: 255 },
  { key: 'speed', label: 'Speed', min: 1, max: 255 },
  { key: 'mouth', label: 'Mouth', min: 0, max: 255 },
  { key: 'throat', label: 'Throat', min: 0, max: 255 },
] as const

const DEFAULT_OPTS = {
  pitch: 64,
  speed: 72,
  mouth: 128,
  throat: 128,
} as const

type ControlKey = (typeof CONTROLS)[number]['key']

type Opts = Record<ControlKey, number>

/** The classic SAM sing-along: "Daisy, Daisy, give me your answer, do." */
const DEFAULT_SING_TEXT = 'D EH4 Y4 D EH4 Y5 G IH5 V M IY6 Y UW5 R AE8 N S ER D UW5'
const DEFAULT_MELODY = 'C4 C4 G4 G4 A4 A4 G4 G4 F4 F4 E4 E4 D4 D4 C4 C4'

const TABS = [
  { value: 'speak', label: 'Speak' },
  { value: 'sing', label: 'Sing' },
] as const

type Tab = (typeof TABS)[number]['value']

type SingMode = 'classic' | 'melody'

/** Lower the initial settings from URLSearchParams, if present. */
function initialSettings(): {
  tab: Tab
  text: string
  singText: string
  singMode: SingMode
  melody: string
  opts: Opts
  bits: 8 | 16
  hq: boolean
  masking: boolean
} {
  const params = new URLSearchParams(window.location.search)
  const clamp = (key: ControlKey, fallback: number) => {
    const raw = Number.parseInt(params.get(key) ?? '', 10)
    const definition = CONTROLS.find((control) => control.key === key)!
    return Number.isFinite(raw)
      ? Math.min(definition.max, Math.max(definition.min, raw))
      : fallback
  }
  const bits = Number.parseInt(params.get('b') ?? '', 10)
  return {
    tab: params.get('tab') === 'sing' ? 'sing' : 'speak',
    text: params.get('t') ?? 'Hello , I am Sam.',
    singText: params.get('song') ?? DEFAULT_SING_TEXT,
    singMode: params.get('sm') === 'm' ? 'melody' : 'classic',
    melody: params.get('mel') ?? DEFAULT_MELODY,
    opts: {
      pitch: clamp('pitch', DEFAULT_OPTS.pitch),
      speed: clamp('speed', DEFAULT_OPTS.speed),
      mouth: clamp('mouth', DEFAULT_OPTS.mouth),
      throat: clamp('throat', DEFAULT_OPTS.throat),
    },
    bits: bits === 16 ? 16 : 8,
    hq: params.get('hq') === '1',
    masking: params.get('masking') !== '0',
  }
}

/** Derive a safe file name stem from the text. */
function fileNameOf(text: string): string {
  const stem = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return `${stem || 'sam'}.wav`
}

/** Run a boolean or value producer, returning the fallback on error. */
function orFallback<T>(produce: () => T | false, fallback: T | false): T | false {
  try {
    return produce()
  } catch {
    return fallback
  }
}

/** Split a melody string into note names. */
function parseMelody(melody: string): string[] {
  return melody.trim().split(/[\s,]+/).filter(Boolean)
}

/** True when every note is a valid melody note name ('C4', 'F#3', 'Bb5'…). */
function validMelody(notes: string[]): boolean {
  return notes.every((note) => note === '-' || /^([A-G])([#b]?)([0-8])$/i.test(note))
}

/** Approximate phoneme count of phonetic input (punctuation does not count). */
function phonemeCount(phonetic: string): number {
  return phonetic
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0 && !/^[.,!?;:'"()-]+$/.test(token)).length
}

export default function App() {
  const initial = useMemo(() => initialSettings(), [])
  const [tab, setTab] = useState<Tab>(initial.tab)
  const [text, setText] = useState(initial.text)
  const [singText, setSingText] = useState(initial.singText)
  const [singMode, setSingMode] = useState<SingMode>(initial.singMode)
  const [melodyText, setMelodyText] = useState(initial.melody)
  const [opts, setOpts] = useState<Opts>(initial.opts)
  const [bits, setBits] = useState<8 | 16>(initial.bits)
  const [hq, setHq] = useState(initial.hq)
  const [masking, setMasking] = useState(initial.masking)
  const [speaking, setSpeaking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [phonemes, setPhonemes] = useState<string | false>(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const sam = useMemo(() => new SamJs(opts), [opts])

  const melodyNotes = useMemo(() => parseMelody(melodyText), [melodyText])
  const melodyOk = useMemo(() => validMelody(melodyNotes), [melodyNotes])
  const singPhonemes = useMemo(() => phonemeCount(singText), [singText])

  const singOptions = useMemo(() => {
    const base = { phonetic: true, singmode: true, hq, masking }
    return singMode === 'melody' ? { ...base, melody: melodyNotes } : base
  }, [singMode, melodyNotes, hq, masking])

  // Share the current settings through the URL (no history entries).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('tab', tab)
    params.set('t', text)
    params.set('song', singText)
    params.set('sm', singMode === 'melody' ? 'm' : 'c')
    params.set('mel', melodyText)
    params.set('pitch', String(opts.pitch))
    params.set('speed', String(opts.speed))
    params.set('mouth', String(opts.mouth))
    params.set('throat', String(opts.throat))
    params.set('b', String(bits))
    params.set('hq', hq ? '1' : '0')
    params.set('masking', masking ? '1' : '0')
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}?${params}`
    )
  }, [tab, text, singText, singMode, melodyText, opts, bits, hq, masking])

  // Phoneme preview, refreshed as the text settles.
  useEffect(() => {
    if (tab !== 'speak') {
      return
    }
    const timer = window.setTimeout(() => {
      setPhonemes(SamJs.convert(text))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [tab, text])

  // Waveform preview, refreshed whenever the active inputs or settings change.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (!canvas || !context) {
        return
      }
      const samples =
        tab === 'sing'
          ? orFallback(() => sam.buf8(singText, singOptions), false)
          : orFallback(() => sam.buf8(text, { hq, masking }), false)
      context.clearRect(0, 0, canvas.width, canvas.height)
      if (samples === false || samples.length === 0) {
        return
      }

      const primary =
        getComputedStyle(document.documentElement)
          .getPropertyValue('--primary')
          .trim() || 'currentColor'
      const width = canvas.width
      const height = canvas.height
      const center = height / 2
      const columns = Math.min(width, samples.length)
      const step = Math.ceil(samples.length / columns)

      context.strokeStyle = primary
      context.lineWidth = 1
      context.globalAlpha = 0.25
      context.beginPath()
      context.moveTo(0, center)
      context.lineTo(width, center)
      context.stroke()

      context.globalAlpha = 1
      context.beginPath()
      // Min/max envelope per column so every sample contributes, even long
      // texts get squeezed with no aliasing gaps.
      for (let column = 0; column < columns; column++) {
        const start = column * step
        const end = Math.min(samples.length, start + step)
        let minimum = samples[start]
        let maximum = minimum
        for (let index = start; index < end; index++) {
          minimum = Math.min(minimum, samples[index])
          maximum = Math.max(maximum, samples[index])
        }
        const x = column * (width / columns)
        const from = center - (maximum - 128) * ((center - 1) / 128)
        const to = center - (minimum - 128) * ((center - 1) / 128)
        context.moveTo(x, Math.max(0, from))
        context.lineTo(x, Math.min(height, to))
      }
      context.stroke()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [tab, text, singText, singOptions, sam, hq, masking])

  useEffect(() => {
    if (!copied) {
      return
    }
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function speak() {
    setSpeaking(true)
    try {
      if (tab === 'sing') {
        await sam.speak(singText, singOptions)
      } else {
        await sam.speak(text, { hq, masking })
      }
    } finally {
      setSpeaking(false)
    }
  }

  function download() {
    if (tab === 'sing') {
      sam.download(singText, { ...singOptions, bits }, fileNameOf(singText))
    } else {
      sam.download(text, { phonetic: false, bits, hq, masking }, fileNameOf(text))
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      // Clipboard permission denied — nothing to do here.
    }
  }

  const input = tab === 'sing' ? singText : text
  const inputEmpty = input.trim().length === 0
  const melodyBroken = tab === 'sing' && singMode === 'melody' && !melodyOk

  return (
    <div className="flex min-h-screen flex-col bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <header className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Revamped <span className="text-primary">SAM</span> — Software
            Automatic Mouth
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Text-to-speech straight from the 1982 Commodore 64, rebuilt for the
            browser
          </p>
        </header>

        <div className="flex justify-center gap-2" role="tablist" aria-label="Mode">
          {TABS.map((entry) => (
            <Button
              key={entry.value}
              variant={tab === entry.value ? 'default' : 'outline'}
              role="tab"
              aria-selected={tab === entry.value}
              onClick={() => setTab(entry.value)}
            >
              {entry.label}
            </Button>
          ))}
        </div>

        {tab === 'sing' ? (
          <Card>
            <CardHeader>
              <CardTitle>Singing synthesizer</CardTitle>
              <CardDescription>
                Sing SAM phonemes with stress digits (the{' '}
                <code className="rounded bg-muted px-1">1</code>-
                <code className="rounded bg-muted px-1">8</code> after each
                phoneme are pitch steps), or assign one note per phoneme.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="singinput">Phonemes to sing</Label>
                <Input
                  id="singinput"
                  value={singText}
                  onChange={(event) => setSingText(event.target.value)}
                  placeholder={DEFAULT_SING_TEXT}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <Label>Singing mode</Label>
                <div className="flex gap-2" role="group" aria-label="Singing mode">
                  {([
                    { value: 'classic', label: 'Classic digits' },
                    { value: 'melody', label: 'Melody notes' },
                  ] as const).map((mode) => (
                    <Button
                      key={mode.value}
                      variant={singMode === mode.value ? 'default' : 'outline'}
                      size="sm"
                      aria-pressed={singMode === mode.value}
                      onClick={() => setSingMode(mode.value)}
                    >
                      {mode.label}
                    </Button>
                  ))}
                </div>
              </div>

              {singMode === 'melody' ? (
                <div className="grid gap-2">
                  <Label htmlFor="singmelody">Melody (one note per phoneme)</Label>
                  <Input
                    id="singmelody"
                    value={melodyText}
                    onChange={(event) => setMelodyText(event.target.value)}
                    placeholder={DEFAULT_MELODY}
                    aria-invalid={!melodyOk}
                  />
                  <p className="text-muted-foreground text-xs">
                    {melodyBroken ? (
                      <span className="text-destructive">
                        Invalid note — use names like C4, F#3, Bb5, or &quot;-&quot; for a rest.
                      </span>
                    ) : (
                      <>
                        {`The phrase has ${singPhonemes} phoneme${singPhonemes === 1 ? '' : 's'};`}
                        extra notes are ignored, missing ones keep the base pitch.
                      </>
                    )}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label htmlFor="singwave">Waveform preview</Label>
                <div className="rounded-md border bg-muted/40 p-2">
                  <canvas
                    id="singwave"
                    ref={canvasRef}
                    width={760}
                    height={120}
                    className="h-24 w-full"
                    aria-label="Preview of the wave the current settings produce"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  size="lg"
                  aria-label="Preview the phonemes with singing synthesis"
                  onClick={() => void speak()}
                  disabled={speaking || inputEmpty || melodyBroken}
                >
                  {speaking ? 'Singing…' : 'Preview'}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  aria-label="Download the rendered singing as a .wav file"
                  onClick={download}
                  disabled={inputEmpty || melodyBroken}
                >
                  Download .wav
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Speech synthesizer</CardTitle>
              <CardDescription>
                Enter plain English (or SAM phonemes like{' '}
                <code className="rounded bg-muted px-1">/HEHLOW</code>).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="speechinput">Text to speak</Label>
                <Input
                  id="speechinput"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Hello , I am Sam."
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="speechwave">Waveform preview</Label>
                <div className="rounded-md border bg-muted/40 p-2">
                  <canvas
                    id="speechwave"
                    ref={canvasRef}
                    width={760}
                    height={120}
                    className="h-24 w-full"
                    aria-label="Preview of the wave the current settings produce"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label
                  htmlFor="speechphonemes"
                >{`Phonemes via Reciter${phonemes === false ? ' (unconvertible)' : ''}`}</Label>
                <pre
                  id="speechphonemes"
                  className="overflow-x-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed"
                >
                  {phonemes === false
                    ? 'Reciter could not parse this text.'
                    : phonemes.trim() || '—'}
                </pre>
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  size="lg"
                  aria-label="Preview the text with speech synthesis"
                  onClick={() => void speak()}
                  disabled={speaking || text.trim().length === 0}
                >
                  {speaking ? 'Speaking…' : 'Preview'}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  aria-label="Download the rendered speech as a .wav file"
                  onClick={download}
                  disabled={text.trim().length === 0}
                >
                  Download .wav
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Voice &amp; output</CardTitle>
            <CardDescription>
              Shared by the speak and sing modes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {CONTROLS.map((control) => (
              <div key={control.key} className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={control.key}>{control.label}</Label>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {opts[control.key]}
                  </span>
                </div>
                <Slider
                  id={control.key}
                  min={control.min}
                  max={control.max}
                  step={1}
                  aria-label={`${control.label}: ${opts[control.key]} (min ${control.min}, max ${control.max})`}
                  value={[opts[control.key]]}
                  onValueChange={(value) => {
                    const next = Array.isArray(value) ? value[0] : value
                    setOpts((previous) => ({
                      ...previous,
                      [control.key]: next ?? previous[control.key],
                    }))
                  }}
                />
              </div>
            ))}

            <div className="flex items-center justify-between gap-2">
              <Label>Voice</Label>
              <div className="flex gap-2" role="group" aria-label="Synthesis voice">
                {([
                  { value: false, label: 'Classic' },
                  { value: true, label: 'High-precision' },
                ] as const).map((mode) => (
                  <Button
                    key={String(mode.value)}
                    variant={hq === mode.value ? 'default' : 'outline'}
                    size="sm"
                    aria-pressed={hq === mode.value}
                    onClick={() => setHq(mode.value)}
                  >
                    {mode.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Label>Pulse masking</Label>
              <div className="flex gap-2" role="group" aria-label="Glottal pulse masking">
                {([
                  { value: true, label: 'Authentic' },
                  { value: false, label: 'Smooth' },
                ] as const).map((mode) => (
                  <Button
                    key={String(mode.value)}
                    variant={masking === mode.value ? 'default' : 'outline'}
                    size="sm"
                    aria-pressed={masking === mode.value}
                    onClick={() => setMasking(mode.value)}
                  >
                    {mode.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Label>WAV precision</Label>
              <div className="flex gap-2" role="group" aria-label="WAV precision">
                {([8, 16] as const).map((precision) => (
                  <Button
                    key={precision}
                    variant={bits === precision ? 'default' : 'outline'}
                    size="sm"
                    aria-pressed={bits === precision}
                    onClick={() => setBits(precision)}
                  >
                    {`${precision}-bit`}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <footer className="text-muted-foreground flex flex-wrap items-center justify-center gap-3 text-sm">
          <Button variant="ghost" size="sm" onClick={() => void copyLink()}>
            {copied ? 'Link copied!' : 'Copy share link'}
          </Button>
          <a
            href="https://github.com/The-A-P-O-L-L-O-Organization/revamped-sam"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground font-medium underline underline-offset-4 hover:text-primary"
          >
            GitHub Code
          </a>
        </footer>
      </div>
    </div>
  )
}
