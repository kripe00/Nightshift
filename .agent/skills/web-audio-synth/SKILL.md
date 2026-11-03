---
name: web-audio-synth
description: >-
  Builds zero-dependency procedural sound effects and ambient control-room audio in TypeScript
  using the native browser Web Audio API. Use this skill whenever adding sound effects, alarms,
  switch clanks, Geiger counter clicks, reactor transformer hum, dot-matrix printer noise, or
  K.O.M.R.A.D.-84 CRT terminal beeps.
---

# Web Audio Synth — Procedural 1984 Control Room Audio Guide

All audio in *Night Shift: Redline (Reactor No. 4)* is synthesized procedurally in TypeScript using the browser's native **Web Audio API** (`AudioContext`, `OscillatorNode`, `GainNode`, `BiquadFilterNode`, `AudioBuffer`).

**CRITICAL RULE:** Never import or fetch external `.mp3`, `.wav`, or `.ogg` asset files. Every sound must be generated mathematically at runtime.

---

## 1. Singleton AudioContext Management

Always lazily initialize and resume a shared `AudioContext` on the first user interaction (`pointerdown` or `keydown`) to respect browser autoplay policies:

```ts
let ctx: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AudioCtx()
  }
  if (ctx.state === 'suspended') {
    void ctx.resume()
  }
  return ctx
}
```

---

## 2. Required Procedural Sound Generators

### A. Heavy Mechanical Switch Clank (`playSwitchClank`)
Simulates a heavy Soviet Bakelite toggle or guarded cover slam by layering a short low-frequency thud with a filtered white-noise metallic transient:
- **Transient Burst:** 35ms white-noise buffer routed through a `bandpass` `BiquadFilterNode` (`frequency: 1400 Hz`, `Q: 3.5`) with fast exponential decay (`0.3 -> 0.001`).
- **Mechanical Body Thud:** `triangle` oscillator sweeping from `180 Hz` down to `45 Hz` over `45ms`.
- **Lever Drag Ratchet (`playLeverRatchet`):** When the player physically drags a lever (`spak`) up or down along its slot, trigger a short `12ms` filtered impulse (`bandpass` at `950 Hz`, `Q: 4.5`) across notched detent steps, followed by `playSwitchClank(true)` when the lever snaps past its throw threshold.

```ts
export function playSwitchClank(heavy = true): void {
  const audio = getAudioContext()
  const now = audio.currentTime

  // 1. Metallic transient noise
  const bufferSize = Math.floor(audio.sampleRate * 0.04)
  const noiseBuffer = audio.createBuffer(1, bufferSize, audio.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3))
  }

  const noise = audio.createBufferSource()
  noise.buffer = noiseBuffer

  const filter = audio.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(heavy ? 1200 : 2200, now)
  filter.Q.setValueAtTime(3.0, now)

  const noiseGain = audio.createGain()
  noiseGain.gain.setValueAtTime(heavy ? 0.35 : 0.2, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)

  noise.connect(filter).connect(noiseGain).connect(audio.destination)
  noise.start(now)

  // 2. Low Bakelite body thud
  const osc = audio.createOscillator()
  const oscGain = audio.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(heavy ? 160 : 240, now)
  osc.frequency.exponentialRampToValueAtTime(42, now + 0.05)

  oscGain.gain.setValueAtTime(heavy ? 0.4 : 0.2, now)
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055)

  osc.connect(oscGain).connect(audio.destination)
  osc.start(now)
  osc.stop(now + 0.06)
}
```

### B. Geiger Counter Clicks (`playGeigerClick` / Rate Controller)
Simulates ionizing radiation ticks whose Poisson probability / frequency scales with core temperature and radiation levels:
- **Single Click (`playGeigerClick`):** Ultra-short (`1.5ms–3ms`) impulse burst + `highpass` filter at `2800 Hz` + micro square-wave pop at `3400 Hz`.
- **Dynamic Scaling:** In a loop or `requestAnimationFrame` / interval timer, trigger a click with probability proportional to `radiationLevel` (e.g. `1–3 clicks/sec` at nominal load, escalating to frantic crackling `30+ clicks/sec` in Redline/meltdown).

### C. 60Hz Reactor Transformer Hum (`ReactorHumController`)
Continuous ambient drone that physically responds to the `SHIFT` clutch and Redline (`>100 MW`) overclocking:
- Base oscillator: `60 Hz` `sawtooth` + `120 Hz` harmonic `sine`, routed through a `lowpass` filter at `180 Hz`.
- **SHIFT Overclock Pitch Shift:** When `SHIFT` is held or total power exceeds `100 MW` (Redline), smoothly ramp (`linearRampToValueAtTime`) the base frequency from `60 Hz` up to `78–95 Hz` and open the lowpass cutoff from `180 Hz` to `420 Hz` to create palpable electrical strain.

### D. Pravda Dot-Matrix Printer Screech (`playPrinterLineSound`)
Simulates a 9-pin tractor-feed impact printhead zipping across sprocketed paper:
- Step a `sawtooth` oscillator rapidly between `1850 Hz` and `2450 Hz` in `12ms` micro-pulses across `350ms–600ms`, mixed with high-passed white noise (`highpass` at `1600 Hz`), followed by a brief stepper-motor paper feed clunk (`320 Hz` square wave `40ms`).

### E. Retro 8-Bit K.O.M.R.A.D.-84 Terminal Beeps (`playTerminalBeep`)
- **Character Typewriter Beep:** `square` wave at `880 Hz`–`1040 Hz` (randomized slightly per character) for `18ms` with low gain (`0.06`).
- **Ideological Warning / Alert Klaxon:** Alternating two-tone `square` wave (`740 Hz` / `520 Hz`, `180ms` per tone) with subtle frequency modulation.

---

## 3. Domain Boundary Note
- Place shared audio utility functions inside the caller's own module (e.g., `src/modules/reactor/audio.ts`, `src/modules/terminal/audio.ts`, or `src/modules/inspector/audio.ts`) unless Kristian and Ole explicitly coordinate adding a shared audio helper.
