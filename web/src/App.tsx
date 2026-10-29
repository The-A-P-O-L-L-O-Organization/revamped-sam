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

/** Lower the initial settings from URLSearchParams, if present. */
function initialSettings(): { text: string; opts: Opts; bits: 8 | 16 } {
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
    text: params.get('t') ?? 'Hello , I am Sam.',
    opts: {
      pitch: clamp('pitch', DEFAULT_OPTS.pitch),
      speed: clamp('speed', DEFAULT_OPTS.speed),
      mouth: clamp('mouth', DEFAULT_OPTS.mouth),
      throat: clamp('throat', DEFAULT_OPTS.throat),
    },
    bits: bits === 16 ? 16 : 8,
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

export default function App() {
  const initial = useMemo(() => initialSettings(), [])
  const [text, setText] = useState(initial.text)
  const [opts, setOpts] = useState<Opts>(initial.opts)
  const [bits, setBits] = useState<8 | 16>(initial.bits)
  const [speaking, setSpeaking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [phonemes, setPhonemes] = useState<string | false>(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const sam = useMemo(() => new SamJs(opts), [opts])

  // Share the current settings through the URL (no history entries).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('t', text)
    params.set('pitch', String(opts.pitch))
    params.set('speed', String(opts.speed))
    params.set('mouth', String(opts.mouth))
    params.set('throat', String(opts.throat))
    params.set('b', String(bits))
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}?${params}`
    )
  }, [text, opts, bits])

  // Phoneme preview, refreshed as the text settles.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPhonemes(SamJs.convert(text))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [text])

  // Waveform preview, refreshed whenever text or voice settings change.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (!canvas || !context) {
        return
      }
      const samples = orFallback(() => sam.buf8(text), false)
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
  }, [text, sam])

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
      await sam.speak(text)
    } finally {
      setSpeaking(false)
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
                onClick={() => sam.download(text, { phonetic: false, bits }, fileNameOf(text))}
                disabled={text.trim().length === 0}
              >
                Download .wav
              </Button>
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
