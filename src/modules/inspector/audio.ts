// Procedural 1984 Control Room & Inspector Desk Web Audio Synthesizer
// Strictly zero external audio assets — all SFX synthesized at runtime via Web Audio API.

import { useGameStore } from '../../shared/useGameStore'

let ctx: AudioContext | null = null
let globalMuteInstalled = false

export function installGlobalMuteController(): void {
  if (typeof window === 'undefined' || globalMuteInstalled) return
  globalMuteInstalled = true

  const origConnect = AudioNode.prototype.connect
  const patchedConnect = function (
    this: AudioNode,
    destinationNode: AudioNode | AudioParam,
    output?: number,
    input?: number
  ): AudioNode | void {
    // If muted and connecting to an AudioDestinationNode, suppress the connection
    if (
      useGameStore.getState().isMusicMuted &&
      typeof AudioDestinationNode !== 'undefined' &&
      destinationNode instanceof AudioDestinationNode
    ) {
      return destinationNode
    }
    return (origConnect as (...args: unknown[]) => AudioNode | void).apply(
      this,
      [destinationNode, output, input].filter((v) => v !== undefined)
    )
  }
  AudioNode.prototype.connect = patchedConnect as typeof AudioNode.prototype.connect
}

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (useGameStore.getState().isMusicMuted) {
    if (ctx && ctx.state === 'running') {
      void ctx.suspend()
    }
    return null
  }
  if (!ctx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AudioCtx) {
      ctx = new AudioCtx()
    }
  }
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume()
  }
  return ctx
}

/**
 * Heavy mechanical switch clank or lever throw snap
 */
export function playSwitchClank(heavy = true): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

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

/**
 * Discrete mechanical detent click when dragging a stepped lever
 */
export function playDetentClick(stepIndex = 1): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const bufferSize = Math.floor(audio.sampleRate * 0.014)
  const noiseBuffer = audio.createBuffer(1, bufferSize, audio.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25))
  }

  const noise = audio.createBufferSource()
  noise.buffer = noiseBuffer

  const filter = audio.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(920 + stepIndex * 75, now)
  filter.Q.setValueAtTime(4.5, now)

  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.28, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.014)

  noise.connect(filter).connect(gain).connect(audio.destination)
  noise.start(now)

  const osc = audio.createOscillator()
  const oscGain = audio.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(195 + stepIndex * 18, now)
  osc.frequency.exponentialRampToValueAtTime(65, now + 0.018)
  oscGain.gain.setValueAtTime(0.18, now)
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02)
  osc.connect(oscGain).connect(audio.destination)
  osc.start(now)
  osc.stop(now + 0.022)
}

/**
 * Crisp tractor-feed paper rustle SFX
 */
export function playPaperRustle(expandSwap = false): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const duration = expandSwap ? 0.095 : 0.055
  const bufferSize = Math.floor(audio.sampleRate * duration)
  const noiseBuffer = audio.createBuffer(1, bufferSize, audio.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    const env = Math.sin((i / bufferSize) * Math.PI) * Math.exp(-i / (bufferSize * 0.7))
    data[i] = (Math.random() * 2 - 1) * env
  }

  const noise = audio.createBufferSource()
  noise.buffer = noiseBuffer

  const filter = audio.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(expandSwap ? 2400 : 1950, now)
  filter.frequency.exponentialRampToValueAtTime(expandSwap ? 3600 : 2600, now + duration)
  filter.Q.setValueAtTime(1.8, now)

  const gain = audio.createGain()
  gain.gain.setValueAtTime(expandSwap ? 0.28 : 0.16, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

  noise.connect(filter).connect(gain).connect(audio.destination)
  noise.start(now)
}

/**
 * Soft air-cushion "flapp" / paper-slap sound when a lifted directive settles flat onto the green baize mat
 */
export function playPaperSettleSlap(intensity = 1.0): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime
  const vol = Math.max(0.15, Math.min(1.0, intensity))

  const duration = 0.075
  const bufferSize = Math.floor(audio.sampleRate * duration)
  const noiseBuffer = audio.createBuffer(1, bufferSize, audio.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize
    data[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI) * Math.exp(-t * 2.6)
  }

  const noise = audio.createBufferSource()
  noise.buffer = noiseBuffer

  const filter = audio.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(1150, now)
  filter.frequency.exponentialRampToValueAtTime(620, now + duration)
  filter.Q.setValueAtTime(1.5, now)

  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.18 * vol, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

  noise.connect(filter).connect(gain).connect(audio.destination)
  noise.start(now)

  const thump = audio.createOscillator()
  const thumpGain = audio.createGain()
  thump.type = 'sine'
  thump.frequency.setValueAtTime(98, now)
  thump.frequency.exponentialRampToValueAtTime(38, now + 0.065)
  thumpGain.gain.setValueAtTime(0.16 * vol, now)
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
  thump.connect(thumpGain).connect(audio.destination)
  thump.start(now)
  thump.stop(now + 0.075)
}

/**
 * Subtle paper-edge friction slide / soft bump when a coasting sheet bounces off desk hardware or mahogany trim
 */
export function playPaperSlideBump(speed = 0.5): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime
  const vol = Math.max(0.12, Math.min(0.85, speed * 0.7))

  const duration = 0.05
  const bufferSize = Math.floor(audio.sampleRate * duration)
  const noiseBuffer = audio.createBuffer(1, bufferSize, audio.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 3.5)
  }

  const noise = audio.createBufferSource()
  noise.buffer = noiseBuffer

  const filter = audio.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(1650, now)
  filter.Q.setValueAtTime(2.0, now)

  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.14 * vol, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

  noise.connect(filter).connect(gain).connect(audio.destination)
  noise.start(now)
}

/**
 * Crisp perforated tractor-feed paper tear SFX
 */
export function playPaperTearSound(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const duration = 0.11
  const bufferSize = Math.floor(audio.sampleRate * duration)
  const noiseBuffer = audio.createBuffer(1, bufferSize, audio.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize
    const perfRip = 0.65 + 0.35 * Math.sin(t * Math.PI * 18)
    data[i] = (Math.random() * 2 - 1) * Math.pow(t, 0.3) * (1 - t * 0.6) * perfRip
  }

  const noise = audio.createBufferSource()
  noise.buffer = noiseBuffer

  const filter = audio.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(2200, now)
  filter.frequency.exponentialRampToValueAtTime(4800, now + duration)
  filter.Q.setValueAtTime(1.6, now)

  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.32, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

  noise.connect(filter).connect(gain).connect(audio.destination)
  noise.start(now)
}

/**
 * Crisp cardstock page-turn sound for the 3-Page Security Manual booklet
 */
export function playPageTurnSound(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const duration = 0.08
  const bufferSize = Math.floor(audio.sampleRate * duration)
  const noiseBuffer = audio.createBuffer(1, bufferSize, audio.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize
    data[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI) * (1 - t * 0.5)
  }

  const noise = audio.createBufferSource()
  noise.buffer = noiseBuffer

  const filter = audio.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(1600, now)
  filter.frequency.exponentialRampToValueAtTime(3400, now + duration)
  filter.Q.setValueAtTime(2.2, now)

  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.24, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

  noise.connect(filter).connect(gain).connect(audio.destination)
  noise.start(now)
}

/**
 * Heavy rubber stamp spring mechanism + wet ink thud on paper
 */
export function playStampInkThud(type: 'APPROVED' | 'SHREDDED' = 'APPROVED'): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const thudOsc = audio.createOscillator()
  const thudGain = audio.createGain()
  thudOsc.type = 'sine'
  thudOsc.frequency.setValueAtTime(type === 'SHREDDED' ? 115 : 130, now)
  thudOsc.frequency.exponentialRampToValueAtTime(28, now + 0.12)

  thudGain.gain.setValueAtTime(0.48, now)
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13)

  thudOsc.connect(thudGain).connect(audio.destination)
  thudOsc.start(now)
  thudOsc.stop(now + 0.14)

  const bufferSize = Math.floor(audio.sampleRate * 0.055)
  const noiseBuffer = audio.createBuffer(1, bufferSize, audio.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28))
  }

  const noise = audio.createBufferSource()
  noise.buffer = noiseBuffer

  const bandpass = audio.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.setValueAtTime(type === 'SHREDDED' ? 1050 : 1380, now)
  bandpass.Q.setValueAtTime(2.6, now)

  const noiseGain = audio.createGain()
  noiseGain.gain.setValueAtTime(0.32, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055)

  noise.connect(bandpass).connect(noiseGain).connect(audio.destination)
  noise.start(now)
}

/**
 * Pravda 9-pin dot-matrix printer screech + stepper motor feed clunk
 */
export function playPrinterLineSound(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const pulses = 14
  const pulseStep = 0.018
  for (let i = 0; i < pulses; i++) {
    const t = now + i * pulseStep
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(i % 2 === 0 ? 1920 : 2380, t)
    gain.gain.setValueAtTime(0.055, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.014)
    osc.connect(gain).connect(audio.destination)
    osc.start(t)
    osc.stop(t + 0.015)
  }

  const feedTime = now + pulses * pulseStep + 0.01
  const stepOsc = audio.createOscillator()
  const stepGain = audio.createGain()
  stepOsc.type = 'square'
  stepOsc.frequency.setValueAtTime(320, feedTime)
  stepOsc.frequency.exponentialRampToValueAtTime(110, feedTime + 0.04)
  stepGain.gain.setValueAtTime(0.14, feedTime)
  stepGain.gain.exponentialRampToValueAtTime(0.001, feedTime + 0.045)
  stepOsc.connect(stepGain).connect(audio.destination)
  stepOsc.start(feedTime)
  stepOsc.stop(feedTime + 0.05)
}

/**
 * Heavy industrial gear-grind + paper-ripping crunch for one shredder lever detent
 */
export function playShredGrindCrunch(progress = 20): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime
  const dur = 0.22

  const size = Math.floor(audio.sampleRate * dur)
  const buf = audio.createBuffer(1, size, audio.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < size; i++) {
    const t = i / size
    const teeth = 0.55 + 0.45 * Math.sign(Math.sin(t * Math.PI * 38))
    d[i] = (Math.random() * 2 - 1) * teeth * (1 - t * 0.7)
  }
  const noise = audio.createBufferSource()
  noise.buffer = buf
  const bp = audio.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(900 + progress * 8, now)
  bp.frequency.exponentialRampToValueAtTime(2600, now + dur)
  bp.Q.setValueAtTime(1.4, now)
  const ng = audio.createGain()
  ng.gain.setValueAtTime(0.42, now)
  ng.gain.exponentialRampToValueAtTime(0.001, now + dur)
  noise.connect(bp).connect(ng).connect(audio.destination)
  noise.start(now)

  const motor = audio.createOscillator()
  const mg = audio.createGain()
  const lp = audio.createBiquadFilter()
  motor.type = 'sawtooth'
  motor.frequency.setValueAtTime(54 + progress * 0.5, now)
  motor.frequency.linearRampToValueAtTime(82 + progress * 0.5, now + dur)
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(320, now)
  mg.gain.setValueAtTime(0.0001, now)
  mg.gain.linearRampToValueAtTime(0.3, now + 0.03)
  mg.gain.exponentialRampToValueAtTime(0.001, now + dur)
  motor.connect(lp).connect(mg).connect(audio.destination)
  motor.start(now)
  motor.stop(now + dur + 0.01)
}

/**
 * Final heavy metallic blade clunk + falling paper-strip rustle.
 */
export function playShredFinalClunk(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const thud = audio.createOscillator()
  const tg = audio.createGain()
  thud.type = 'triangle'
  thud.frequency.setValueAtTime(150, now)
  thud.frequency.exponentialRampToValueAtTime(36, now + 0.14)
  tg.gain.setValueAtTime(0.55, now)
  tg.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
  thud.connect(tg).connect(audio.destination)
  thud.start(now)
  thud.stop(now + 0.17)

  const ring = audio.createOscillator()
  const rg = audio.createGain()
  ring.type = 'square'
  ring.frequency.setValueAtTime(1180, now)
  ring.frequency.exponentialRampToValueAtTime(760, now + 0.09)
  rg.gain.setValueAtTime(0.12, now)
  rg.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
  ring.connect(rg).connect(audio.destination)
  ring.start(now)
  ring.stop(now + 0.11)

  const dur = 0.4
  const size = Math.floor(audio.sampleRate * dur)
  const buf = audio.createBuffer(1, size, audio.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < size; i++) {
    const t = i / size
    d[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI) * 0.8
  }
  const noise = audio.createBufferSource()
  noise.buffer = buf
  const hp = audio.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.setValueAtTime(2200, now)
  const ng = audio.createGain()
  ng.gain.setValueAtTime(0.0001, now + 0.1)
  ng.gain.linearRampToValueAtTime(0.16, now + 0.18)
  ng.gain.exponentialRampToValueAtTime(0.001, now + dur)
  noise.connect(hp).connect(ng).connect(audio.destination)
  noise.start(now + 0.1)
}

/**
 * Pneumatic tube whoosh + vacuum thunk when dispatching an approved directive.
 */
export function playPneumaticWhoosh(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime
  const dur = 0.45

  const size = Math.floor(audio.sampleRate * dur)
  const buf = audio.createBuffer(1, size, audio.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < size; i++) {
    d[i] = Math.random() * 2 - 1
  }
  const noise = audio.createBufferSource()
  noise.buffer = buf
  const bp = audio.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(500, now)
  bp.frequency.exponentialRampToValueAtTime(3200, now + dur)
  bp.Q.setValueAtTime(1.1, now)
  const ng = audio.createGain()
  ng.gain.setValueAtTime(0.0001, now)
  ng.gain.linearRampToValueAtTime(0.3, now + 0.12)
  ng.gain.exponentialRampToValueAtTime(0.001, now + dur)
  noise.connect(bp).connect(ng).connect(audio.destination)
  noise.start(now)

  const thunk = audio.createOscillator()
  const tg = audio.createGain()
  thunk.type = 'sine'
  thunk.frequency.setValueAtTime(110, now + dur - 0.1)
  thunk.frequency.exponentialRampToValueAtTime(40, now + dur + 0.05)
  tg.gain.setValueAtTime(0.0001, now + dur - 0.1)
  tg.gain.linearRampToValueAtTime(0.4, now + dur - 0.09)
  tg.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.06)
  thunk.connect(tg).connect(audio.destination)
  thunk.start(now + dur - 0.1)
  thunk.stop(now + dur + 0.07)
}

/**
 * Metallic teletype carriage-return bell ding + carriage return slide thud
 * played on the final step of the print-out sequence.
 */
export function playCarriageReturnDing(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const bellFreqs = [2680, 4120]
  bellFreqs.forEach((freq, idx) => {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + 0.04)
    gain.gain.setValueAtTime(idx === 0 ? 0.18 : 0.08, now + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.34)
    osc.connect(gain).connect(audio.destination)
    osc.start(now + 0.04)
    osc.stop(now + 0.35)
  })

  const thud = audio.createOscillator()
  const thudGain = audio.createGain()
  thud.type = 'triangle'
  thud.frequency.setValueAtTime(175, now)
  thud.frequency.exponentialRampToValueAtTime(52, now + 0.045)
  thudGain.gain.setValueAtTime(0.24, now)
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
  thud.connect(thudGain).connect(audio.destination)
  thud.start(now)
  thud.stop(now + 0.055)
}

/**
 * Crisp snap when a sheet is locked into the shredder jaws.
 */
export function playPaperInsertSnap(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const size = Math.floor(audio.sampleRate * 0.03)
  const buf = audio.createBuffer(1, size, audio.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < size; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (size * 0.2))
  }
  const noise = audio.createBufferSource()
  noise.buffer = buf
  const bp = audio.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(2800, now)
  bp.Q.setValueAtTime(2.4, now)
  const ng = audio.createGain()
  ng.gain.setValueAtTime(0.3, now)
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.03)
  noise.connect(bp).connect(ng).connect(audio.destination)
  noise.start(now)

  const osc = audio.createOscillator()
  const og = audio.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(420, now)
  osc.frequency.exponentialRampToValueAtTime(140, now + 0.04)
  og.gain.setValueAtTime(0.12, now)
  og.gain.exponentialRampToValueAtTime(0.001, now + 0.045)
  osc.connect(og).connect(audio.destination)
  osc.start(now)
  osc.stop(now + 0.05)
}

/**
 * Faint micro paper-tick SFX when scrolling the Security Manual in stepped increments
 */
export function playScrollTickSound(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const bufferSize = Math.floor(audio.sampleRate * 0.01)
  const noiseBuffer = audio.createBuffer(1, bufferSize, audio.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25))
  }

  const noise = audio.createBufferSource()
  noise.buffer = noiseBuffer

  const filter = audio.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(2400, now)
  filter.Q.setValueAtTime(3.2, now)

  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.11, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.01)

  noise.connect(filter).connect(gain).connect(audio.destination)
  noise.start(now)
}

/**
 * One 90ms-budget line-feed of the ПРАВДА-84: two dot-matrix impact pulses plus a short
 * platen ratchet tick.
 */
export function playLineFeedTick(stepIndex = 1): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  for (let i = 0; i < 2; i++) {
    const t = now + i * 0.016
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(1900 + ((stepIndex + i) % 3) * 260, t)
    gain.gain.setValueAtTime(0.05, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.011)
    osc.connect(gain).connect(audio.destination)
    osc.start(t)
    osc.stop(t + 0.012)
  }

  const tick = now + 0.036
  const size = Math.floor(audio.sampleRate * 0.012)
  const buf = audio.createBuffer(1, size, audio.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < size; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (size * 0.22))
  }
  const noise = audio.createBufferSource()
  noise.buffer = buf
  const bp = audio.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(1500 + (stepIndex % 4) * 120, tick)
  bp.Q.setValueAtTime(4, tick)
  const ng = audio.createGain()
  ng.gain.setValueAtTime(0.2, tick)
  ng.gain.exponentialRampToValueAtTime(0.001, tick + 0.012)
  noise.connect(bp).connect(ng).connect(audio.destination)
  noise.start(tick)
}

/**
 * Playful coiled metal spring "boing-oing-oing!" SFX when poking Komrad Kristianov or Komrad Oleg bobbleheads!
 */
export function playBobbleBoingSound(pitchMultiplier = 1.0): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const duration = 0.52
  const carrier = audio.createOscillator()
  const lfo = audio.createOscillator()
  const lfoGain = audio.createGain()
  const mainGain = audio.createGain()

  carrier.type = 'triangle'
  carrier.frequency.setValueAtTime(165 * pitchMultiplier, now)
  carrier.frequency.exponentialRampToValueAtTime(
    285 * pitchMultiplier,
    now + 0.14
  )
  carrier.frequency.exponentialRampToValueAtTime(
    190 * pitchMultiplier,
    now + duration
  )

  // Spring wobble LFO (11 Hz pitch oscillation)
  lfo.type = 'sine'
  lfo.frequency.setValueAtTime(11.5, now)
  lfoGain.gain.setValueAtTime(52 * pitchMultiplier, now)
  lfoGain.gain.exponentialRampToValueAtTime(4, now + duration)

  lfo.connect(lfoGain)
  lfoGain.connect(carrier.frequency)

  mainGain.gain.setValueAtTime(0.28, now)
  mainGain.gain.exponentialRampToValueAtTime(0.001, now + duration)

  carrier.connect(mainGain).connect(audio.destination)
  carrier.start(now)
  lfo.start(now)
  carrier.stop(now + duration + 0.02)
  lfo.stop(now + duration + 0.02)
}

/**
 * Metallic cast-iron packing-gland creak + ratchet click when turning Cooling Pump A/B wheels.
 */
export function playValveWheelSqueak(step = 1): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  // 1. Cast-iron stuffing-box squeak (FM-modulated triangle wave)
  const dur = 0.085
  const squeak = audio.createOscillator()
  const mod = audio.createOscillator()
  const modGain = audio.createGain()
  const squeakGain = audio.createGain()

  const baseFreq = 540 + (step % 7) * 42
  squeak.type = 'triangle'
  squeak.frequency.setValueAtTime(baseFreq, now)
  squeak.frequency.exponentialRampToValueAtTime(baseFreq * 1.18, now + dur * 0.6)
  squeak.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, now + dur)

  mod.type = 'sine'
  mod.frequency.setValueAtTime(38, now)
  modGain.gain.setValueAtTime(65, now)
  mod.connect(modGain)
  modGain.connect(squeak.frequency)

  squeakGain.gain.setValueAtTime(0.14, now)
  squeakGain.gain.exponentialRampToValueAtTime(0.001, now + dur)
  squeak.connect(squeakGain).connect(audio.destination)
  squeak.start(now)
  mod.start(now)
  squeak.stop(now + dur + 0.01)
  mod.stop(now + dur + 0.01)

  // 2. Heavy iron ratchet pawl click
  playDetentClick(step)
}

/**
 * Filtered white/pink-noise high-pressure steam roar while holding the СБРОС ПАРА lever.
 */
export function playSteamVentHiss(intensity = 1.0): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime
  const dur = 0.18
  const vol = Math.max(0.2, Math.min(1.0, intensity))

  const size = Math.floor(audio.sampleRate * dur)
  const buf = audio.createBuffer(1, size, audio.sampleRate)
  const d = buf.getChannelData(0)
  let pink = 0
  for (let i = 0; i < size; i++) {
    const white = Math.random() * 2 - 1
    pink = 0.92 * pink + 0.08 * white
    const env = Math.sin((i / size) * Math.PI)
    d[i] = (white * 0.55 + pink * 0.45) * env
  }

  const noise = audio.createBufferSource()
  noise.buffer = buf

  const bp = audio.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(1450, now)
  bp.frequency.linearRampToValueAtTime(2100, now + dur)
  bp.Q.setValueAtTime(1.1, now)

  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.32 * vol, now)
  gain.gain.exponentialRampToValueAtTime(0.01, now + dur)
  noise.connect(bp).connect(gain).connect(audio.destination)
  noise.start(now)

  // Sub-bass pipe shudder rumble
  const rumble = audio.createOscillator()
  const rGain = audio.createGain()
  rumble.type = 'sawtooth'
  rumble.frequency.setValueAtTime(92, now)
  rumble.frequency.exponentialRampToValueAtTime(58, now + dur)
  rGain.gain.setValueAtTime(0.12 * vol, now)
  rGain.gain.exponentialRampToValueAtTime(0.001, now + dur)
  rumble.connect(rGain).connect(audio.destination)
  rumble.start(now)
  rumble.stop(now + dur + 0.01)
}

/**
 * Heavy ceramic rotary switch click when trimming the 50 ГЦ excitation dial.
 */
export function playRheostatDetentClick(step = 0): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const size = Math.floor(audio.sampleRate * 0.016)
  const buf = audio.createBuffer(1, size, audio.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < size; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (size * 0.22))
  }
  const noise = audio.createBufferSource()
  noise.buffer = buf

  const bp = audio.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(2550 + (Math.abs(step) % 6) * 90, now)
  bp.Q.setValueAtTime(5.0, now)

  const ng = audio.createGain()
  ng.gain.setValueAtTime(0.28, now)
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.016)
  noise.connect(bp).connect(ng).connect(audio.destination)
  noise.start(now)

  const ceramic = audio.createOscillator()
  const cg = audio.createGain()
  ceramic.type = 'triangle'
  ceramic.frequency.setValueAtTime(360 + (Math.abs(step) % 5) * 25, now)
  ceramic.frequency.exponentialRampToValueAtTime(115, now + 0.022)
  cg.gain.setValueAtTime(0.22, now)
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.024)
  ceramic.connect(cg).connect(audio.destination)
  ceramic.start(now)
  ceramic.stop(now + 0.026)
}

/**
 * Hollow sheet-metal hinge clack & spring tension when flipping the АЗ-5 plexiglass cover.
 */
export function playSafetyCoverFlip(open = true): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(open ? 420 : 640, now)
  osc.frequency.exponentialRampToValueAtTime(open ? 880 : 210, now + 0.055)
  gain.gain.setValueAtTime(0.18, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
  osc.connect(gain).connect(audio.destination)
  osc.start(now)
  osc.stop(now + 0.065)

  // Secondary latch snap
  const snapTime = now + 0.038
  const snapOsc = audio.createOscillator()
  const snapGain = audio.createGain()
  snapOsc.type = 'triangle'
  snapOsc.frequency.setValueAtTime(open ? 1280 : 310, snapTime)
  snapOsc.frequency.exponentialRampToValueAtTime(open ? 520 : 95, snapTime + 0.04)
  snapGain.gain.setValueAtTime(0.24, snapTime)
  snapGain.gain.exponentialRampToValueAtTime(0.001, snapTime + 0.045)
  snapOsc.connect(snapGain).connect(audio.destination)
  snapOsc.start(snapTime)
  snapOsc.stop(snapTime + 0.05)
}

/**
 * Heavy copper-on-copper blade thunk + 50Hz electrical hum burst when closing/tripping the Main Breaker.
 */
export function playKnifeSwitchSlam(closed = true): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  // 1. Heavy copper-blade impact thud
  const thud = audio.createOscillator()
  const thudGain = audio.createGain()
  thud.type = 'triangle'
  thud.frequency.setValueAtTime(closed ? 145 : 185, now)
  thud.frequency.exponentialRampToValueAtTime(34, now + 0.15)
  thudGain.gain.setValueAtTime(0.55, now)
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
  thud.connect(thudGain).connect(audio.destination)
  thud.start(now)
  thud.stop(now + 0.17)

  // 2. 50Hz Soviet grid transformer hum + contact arc crackle
  const humDur = closed ? 0.28 : 0.16
  const hum = audio.createOscillator()
  const humGain = audio.createGain()
  const lp = audio.createBiquadFilter()
  hum.type = 'sawtooth'
  hum.frequency.setValueAtTime(closed ? 50 : 100, now)
  if (!closed) {
    hum.frequency.exponentialRampToValueAtTime(32, now + humDur)
  }
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(420, now)
  humGain.gain.setValueAtTime(0.28, now)
  humGain.gain.exponentialRampToValueAtTime(0.001, now + humDur)
  hum.connect(lp).connect(humGain).connect(audio.destination)
  hum.start(now)
  hum.stop(now + humDur + 0.01)

  // 3. Electric spark snap
  const size = Math.floor(audio.sampleRate * 0.045)
  const buf = audio.createBuffer(1, size, audio.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < size; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (size * 0.25))
  }
  const noise = audio.createBufferSource()
  noise.buffer = buf
  const bp = audio.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(2900, now)
  bp.Q.setValueAtTime(2.2, now)
  const ng = audio.createGain()
  ng.gain.setValueAtTime(0.34, now)
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.045)
  noise.connect(bp).connect(ng).connect(audio.destination)
  noise.start(now)
}

