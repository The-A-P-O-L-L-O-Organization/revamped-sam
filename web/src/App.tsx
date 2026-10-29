import { useState } from 'react'
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

type ControlKey = (typeof CONTROLS)[number]['key']

export default function App() {
  const [text, setText] = useState('Hello , I am Sam.')
  const [opts, setOpts] = useState<Record<ControlKey, number>>({
    pitch: 64,
    speed: 72,
    mouth: 128,
    throat: 128,
  })
  const [speaking, setSpeaking] = useState(false)

  async function speak() {
    setSpeaking(true)
    try {
      await new SamJs(opts).speak(text)
    } finally {
      setSpeaking(false)
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
                onClick={() => new SamJs(opts).download(text)}
                disabled={text.trim().length === 0}
              >
                Download .wav
              </Button>
            </div>
          </CardContent>
        </Card>

        <footer className="text-muted-foreground text-center text-sm">
          <a
            href="https://github.com/The-A-P-O-L-L-O-Organization/revamped-sam"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground font-medium underline underline-offset-4 hover:text-primary"
          >
            GitHub Code
          </a>
          {' · '}More features soon
        </footer>
      </div>
    </div>
  )
}
