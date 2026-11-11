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
 * Crisp paper-scroll roll + machined brass capsule end-cap snap when packing a stamped directive into КАПСУЛА.
 */
export function playCapsulePackSound(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  // 1. Tight paper scroll roll rustle
  playPaperRustle(true)

  // 2. Machined brass capsule cap snap + spring latch click
  const snapT = now + 0.085
  const ring = audio.createOscillator()
  const rg = audio.createGain()
  ring.type = 'triangle'
  ring.frequency.setValueAtTime(1420, snapT)
  ring.frequency.exponentialRampToValueAtTime(480, snapT + 0.055)
  rg.gain.setValueAtTime(0.24, snapT)
  rg.gain.exponentialRampToValueAtTime(0.001, snapT + 0.06)
  ring.connect(rg).connect(audio.destination)
  ring.start(snapT)
  ring.stop(snapT + 0.065)

  const thud = audio.createOscillator()
  const tg = audio.createGain()
  thud.type = 'sine'
  thud.frequency.setValueAtTime(240, snapT + 0.01)
  thud.frequency.exponentialRampToValueAtTime(75, snapT + 0.06)
  tg.gain.setValueAtTime(0.26, snapT + 0.01)
  tg.gain.exponentialRampToValueAtTime(0.001, snapT + 0.065)
  thud.connect(tg).connect(audio.destination)
  thud.start(snapT + 0.01)
  thud.stop(snapT + 0.07)
}

/**
 * Heavy curved brass/glass breech door hinge clank + pneumatic rubber gasket seal hiss when opening/closing ЛЮК КАМЕРЫ.
 */
export function playBreechHatchLatchSound(opening: boolean): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  // 1. Metallic cam-latch throw clank
  const clank = audio.createOscillator()
  const cg = audio.createGain()
  clank.type = 'square'
  clank.frequency.setValueAtTime(opening ? 380 : 540, now)
  clank.frequency.exponentialRampToValueAtTime(opening ? 760 : 140, now + 0.065)
  cg.gain.setValueAtTime(0.22, now)
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
  clank.connect(cg).connect(audio.destination)
  clank.start(now)
  clank.stop(now + 0.075)

  // 2. Heavy brass door seat thud
  const thud = audio.createOscillator()
  const tg = audio.createGain()
  thud.type = 'triangle'
  thud.frequency.setValueAtTime(opening ? 140 : 195, now + 0.035)
  thud.frequency.exponentialRampToValueAtTime(48, now + 0.12)
  tg.gain.setValueAtTime(0.32, now + 0.035)
  tg.gain.exponentialRampToValueAtTime(0.001, now + 0.125)
  thud.connect(tg).connect(audio.destination)
  thud.start(now + 0.035)
  thud.stop(now + 0.13)

  // 3. Pneumatic vacuum gasket compression hiss when sealing shut (or pressure release puff when opening)
  const hissDur = opening ? 0.09 : 0.18
  const size = Math.floor(audio.sampleRate * hissDur)
  const buf = audio.createBuffer(1, size, audio.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < size; i++) {
    const env = Math.sin((i / size) * Math.PI)
    d[i] = (Math.random() * 2 - 1) * env
  }
  const noise = audio.createBufferSource()
  noise.buffer = buf
  const bp = audio.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(opening ? 1900 : 2800, now + 0.04)
  bp.Q.setValueAtTime(2.4, now + 0.04)
  const ng = audio.createGain()
  ng.gain.setValueAtTime(opening ? 0.14 : 0.24, now + 0.04)
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.04 + hissDur)
  noise.connect(bp).connect(ng).connect(audio.destination)
  noise.start(now + 0.04)
}

/**
 * Hollow brass cylinder slide + spring-detent catch when loading КАПСУЛА into the open pneumatic breech chamber.
 */
export function playCapsuleChamberLoadSound(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const slide = audio.createOscillator()
  const sg = audio.createGain()
  slide.type = 'triangle'
  slide.frequency.setValueAtTime(280, now)
  slide.frequency.linearRampToValueAtTime(420, now + 0.07)
  sg.gain.setValueAtTime(0.22, now)
  sg.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
  slide.connect(sg).connect(audio.destination)
  slide.start(now)
  slide.stop(now + 0.085)

  playDetentClick(2)
}

/**
 * Heavy vacuum valve clank + powerful pneumatic suction roar along the overhead ceiling pipeline + arrival thud behind K.O.M.R.A.D.-84.
 */
export function playPneumaticDispatchSound(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime
  const dur = 0.86

  // 1. Heavy cast-iron vacuum valve throw clank
  const clank = audio.createOscillator()
  const cg = audio.createGain()
  clank.type = 'triangle'
  clank.frequency.setValueAtTime(520, now)
  clank.frequency.exponentialRampToValueAtTime(98, now + 0.085)
  cg.gain.setValueAtTime(0.36, now)
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
  clank.connect(cg).connect(audio.destination)
  clank.start(now)
  clank.stop(now + 0.095)

  // 2. Powerful pneumatic suction roar shooting UP the riser, around the 90° brass elbow, and across the ceiling pipe
  const size = Math.floor(audio.sampleRate * dur)
  const buf = audio.createBuffer(1, size, audio.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < size; i++) {
    const env = Math.sin((i / size) * Math.PI)
    d[i] = (Math.random() * 2 - 1) * env
  }
  const noise = audio.createBufferSource()
  noise.buffer = buf
  const bp = audio.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(320, now + 0.03)
  bp.frequency.exponentialRampToValueAtTime(3400, now + dur * 0.55)
  bp.frequency.exponentialRampToValueAtTime(950, now + dur)
  bp.Q.setValueAtTime(1.35, now)
  const ng = audio.createGain()
  ng.gain.setValueAtTime(0.0001, now + 0.03)
  ng.gain.linearRampToValueAtTime(0.38, now + 0.16)
  ng.gain.exponentialRampToValueAtTime(0.001, now + dur)
  noise.connect(bp).connect(ng).connect(audio.destination)
  noise.start(now + 0.03)

  // 3. K.O.M.R.A.D.-84 rear receiver manifold arrival thud + pneumatic check-valve bell chime
  const thunk = audio.createOscillator()
  const tg = audio.createGain()
  thunk.type = 'sine'
  thunk.frequency.setValueAtTime(148, now + dur - 0.12)
  thunk.frequency.exponentialRampToValueAtTime(38, now + dur + 0.07)
  tg.gain.setValueAtTime(0.0001, now + dur - 0.12)
  tg.gain.linearRampToValueAtTime(0.46, now + dur - 0.09)
  tg.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.08)
  thunk.connect(tg).connect(audio.destination)
  thunk.start(now + dur - 0.12)
  thunk.stop(now + dur + 0.09)
}

export function playPneumaticWhoosh(): void {
  playPneumaticDispatchSound()
}

/**
 * Harsh dual-tone Soviet error buzzer when trying to dispatch an unstamped paper in the pneumatic tube.
 */
export function playDispatchErrorBuzzer(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime
  ;[145, 218].forEach((freq) => {
    const osc = audio.createOscillator()
    const g = audio.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(freq, now)
    g.gain.setValueAtTime(0.14, now)
    g.gain.setValueAtTime(0.02, now + 0.09)
    g.gain.setValueAtTime(0.14, now + 0.13)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    osc.connect(g).connect(audio.destination)
    osc.start(now)
    osc.stop(now + 0.29)
  })
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

// ============================================================================
// INTRO DRIVE SEQUENCE AUDIO (4-Cylinder VAZ-2101 Engine, Road, Wipers & Radio)
// ============================================================================

interface IntroDriveAudioController {
  engineOsc1: OscillatorNode
  engineOsc2: OscillatorNode
  lfoOsc: OscillatorNode
  lfoGain: GainNode
  engineFilter: BiquadFilterNode
  engineGain: GainNode
  radioOsc: OscillatorNode
  radioGain: GainNode
  pulseTimer: number
  speedRatio: number
  radioOn: boolean
  wipersOn: boolean
  stepCounter: number
}

let introAudioCtrl: IntroDriveAudioController | null = null

const SOVIET_RADIO_NOTES = [
  220.0, 261.63, 293.66, 329.63, 349.23, 329.63, 293.66, 246.94, 220.0, 196.0, 220.0, 261.63,
]

export function startIntroDriveAudio(): void {
  stopIntroDriveAudio()
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  // 1. Continuous 4-cylinder chugging Soviet engine oscillator pair
  const engineOsc1 = audio.createOscillator()
  const engineOsc2 = audio.createOscillator()
  const lfoOsc = audio.createOscillator()
  const lfoGain = audio.createGain()
  const engineFilter = audio.createBiquadFilter()
  const engineGain = audio.createGain()

  engineOsc1.type = 'sawtooth'
  engineOsc1.frequency.setValueAtTime(48, now)
  engineOsc2.type = 'triangle'
  engineOsc2.frequency.setValueAtTime(96, now)

  lfoOsc.type = 'sine'
  lfoOsc.frequency.setValueAtTime(14, now)
  lfoGain.gain.setValueAtTime(6, now)
  lfoOsc.connect(lfoGain)
  lfoGain.connect(engineOsc1.frequency)

  engineFilter.type = 'lowpass'
  engineFilter.frequency.setValueAtTime(210, now)
  engineFilter.Q.setValueAtTime(2.4, now)

  engineGain.gain.setValueAtTime(0.11, now)

  engineOsc1.connect(engineFilter)
  engineOsc2.connect(engineFilter)
  engineFilter.connect(engineGain).connect(audio.destination)

  engineOsc1.start(now)
  engineOsc2.start(now)
  lfoOsc.start(now)

  // 2. Muffled Soviet Night-Shift AM Radio ("РАДИО МАЯК")
  const radioOsc = audio.createOscillator()
  const radioFilter = audio.createBiquadFilter()
  const radioGain = audio.createGain()

  radioOsc.type = 'triangle'
  radioOsc.frequency.setValueAtTime(SOVIET_RADIO_NOTES[0], now)

  radioFilter.type = 'bandpass'
  radioFilter.frequency.setValueAtTime(1050, now)
  radioFilter.Q.setValueAtTime(4.2, now)

  radioGain.gain.setValueAtTime(0.025, now)

  radioOsc.connect(radioFilter).connect(radioGain).connect(audio.destination)
  radioOsc.start(now)

  // 3. Periodic road gravel thumps, wiper relay clicks & AM radio melody steps
  const pulseTimer = window.setInterval(() => {
    if (!introAudioCtrl) return
    const a = getAudioContext()
    if (!a || useGameStore.getState().isMusicMuted) return
    const t = a.currentTime
    introAudioCtrl.stepCounter += 1
    const step = introAudioCtrl.stepCounter

    // AM Radio Note Step + Faint Crackle
    if (introAudioCtrl.radioOn) {
      const note =
        SOVIET_RADIO_NOTES[step % SOVIET_RADIO_NOTES.length] * (step % 8 === 0 ? 0.99 : 1.0)
      introAudioCtrl.radioOsc.frequency.setTargetAtTime(note, t, 0.08)
      introAudioCtrl.radioGain.gain.setTargetAtTime(0.024, t, 0.05)

      if (step % 2 === 0) {
        const crackleLen = Math.floor(a.sampleRate * 0.04)
        const buf = a.createBuffer(1, crackleLen, a.sampleRate)
        const d = buf.getChannelData(0)
        for (let i = 0; i < crackleLen; i++) {
          d[i] = (Math.random() * 2 - 1) * 0.35
        }
        const src = a.createBufferSource()
        src.buffer = buf
        const bp = a.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.setValueAtTime(1400, t)
        const g = a.createGain()
        g.gain.setValueAtTime(0.015, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
        src.connect(bp).connect(g).connect(a.destination)
        src.start(t)
      }
    } else {
      introAudioCtrl.radioGain.gain.setTargetAtTime(0.0001, t, 0.04)
    }

    // Tire-on-mud/gravel thump when moving
    if (introAudioCtrl.speedRatio > 0.12) {
      const thumpOsc = a.createOscillator()
      const thumpGain = a.createGain()
      thumpOsc.type = 'sine'
      const baseF = 55 + (step % 3) * 8
      thumpOsc.frequency.setValueAtTime(baseF, t)
      thumpOsc.frequency.exponentialRampToValueAtTime(28, t + 0.07)
      thumpGain.gain.setValueAtTime(0.075 * introAudioCtrl.speedRatio, t)
      thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.075)
      thumpOsc.connect(thumpGain).connect(a.destination)
      thumpOsc.start(t)
      thumpOsc.stop(t + 0.08)
    }

    // Windshield wiper rubber sweep & relay click every 3 ticks
    if (introAudioCtrl.wipersOn && step % 3 === 0) {
      const wOsc = a.createOscillator()
      const wGain = a.createGain()
      wOsc.type = 'triangle'
      wOsc.frequency.setValueAtTime(step % 6 === 0 ? 520 : 440, t)
      wOsc.frequency.exponentialRampToValueAtTime(180, t + 0.03)
      wGain.gain.setValueAtTime(0.045, t)
      wGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035)
      wOsc.connect(wGain).connect(a.destination)
      wOsc.start(t)
      wOsc.stop(t + 0.04)
    }
  }, 260)

  introAudioCtrl = {
    engineOsc1,
    engineOsc2,
    lfoOsc,
    lfoGain,
    engineFilter,
    engineGain,
    radioOsc,
    radioGain,
    pulseTimer,
    speedRatio: 1.0,
    radioOn: true,
    wipersOn: true,
    stepCounter: 0,
  }
}

export function updateIntroDriveAudio(
  speedRatio: number,
  radioOn: boolean,
  wipersOn: boolean
): void {
  if (!introAudioCtrl) return
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime
  const clampedSpeed = Math.max(0, Math.min(1.2, speedRatio))

  introAudioCtrl.speedRatio = clampedSpeed
  introAudioCtrl.radioOn = radioOn
  introAudioCtrl.wipersOn = wipersOn

  // Scale engine RPM from idle (28 Hz) to cruising (56 Hz)
  const f1 = 28 + clampedSpeed * 28
  introAudioCtrl.engineOsc1.frequency.setTargetAtTime(f1, now, 0.08)
  introAudioCtrl.engineOsc2.frequency.setTargetAtTime(f1 * 2, now, 0.08)
  introAudioCtrl.lfoOsc.frequency.setTargetAtTime(9 + clampedSpeed * 10, now, 0.08)
  introAudioCtrl.engineFilter.frequency.setTargetAtTime(140 + clampedSpeed * 120, now, 0.08)
  introAudioCtrl.engineGain.gain.setTargetAtTime(0.075 + clampedSpeed * 0.055, now, 0.08)
}

export function stopIntroDriveAudio(): void {
  if (!introAudioCtrl) return
  window.clearInterval(introAudioCtrl.pulseTimer)
  try {
    introAudioCtrl.engineOsc1.stop()
    introAudioCtrl.engineOsc2.stop()
    introAudioCtrl.lfoOsc.stop()
    introAudioCtrl.radioOsc.stop()
  } catch {
    // Ignore already stopped oscillators
  }
  introAudioCtrl = null
}

/**
 * Checkpoint КПП №4 electric barrier siren buzzer + hydraulic lift hum
 */
export function playBarrierBuzzerAndLift(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  // 1. Two-tone Soviet checkpoint warning buzzer
  for (let i = 0; i < 3; i++) {
    const t0 = now + i * 0.24
    const buzz = audio.createOscillator()
    const bg = audio.createGain()
    buzz.type = 'sawtooth'
    buzz.frequency.setValueAtTime(i % 2 === 0 ? 580 : 440, t0)
    bg.gain.setValueAtTime(0.18, t0)
    bg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.19)
    buzz.connect(bg).connect(audio.destination)
    buzz.start(t0)
    buzz.stop(t0 + 0.2)
  }

  // 2. Electric barrier motor whine rising in pitch
  const motor = audio.createOscillator()
  const mg = audio.createGain()
  motor.type = 'triangle'
  motor.frequency.setValueAtTime(110, now + 0.15)
  motor.frequency.linearRampToValueAtTime(235, now + 1.35)
  mg.gain.setValueAtTime(0.14, now + 0.15)
  mg.gain.exponentialRampToValueAtTime(0.001, now + 1.4)
  motor.connect(mg).connect(audio.destination)
  motor.start(now + 0.15)
  motor.stop(now + 1.45)
}

/**
 * Massive echoing steel bunker airlock blast-door slam when entering Sector 84 at 00:00
 */
export function playBunkerAirlockSlam(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  // 1. Sub-bass steel blast-door impact boom
  const boom = audio.createOscillator()
  const boomGain = audio.createGain()
  boom.type = 'sine'
  boom.frequency.setValueAtTime(92, now)
  boom.frequency.exponentialRampToValueAtTime(22, now + 0.65)
  boomGain.gain.setValueAtTime(0.65, now)
  boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
  boom.connect(boomGain).connect(audio.destination)
  boom.start(now)
  boom.stop(now + 0.72)

  // 2. Metallic locking bolt clank
  const clank = audio.createOscillator()
  const clankGain = audio.createGain()
  clank.type = 'square'
  clank.frequency.setValueAtTime(240, now + 0.08)
  clank.frequency.exponentialRampToValueAtTime(48, now + 0.32)
  clankGain.gain.setValueAtTime(0.28, now + 0.08)
  clankGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
  clank.connect(clankGain).connect(audio.destination)
  clank.start(now + 0.08)
  clank.stop(now + 0.36)

  // 3. Pneumatic airlock seal hiss
  playSteamVentHiss(0.85)
}

/**
 * Distorted, crackling Soviet PA horn announcement (`ГРОМКОГОВОРИТЕЛЬ КПП-4`)
 * Synthesizes an attention buzzer followed by bandpass-filtered voice-cadence squawks.
 */
export function playCheckpointIntercomSquawk(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  // 1. harsh PA horn attention chime (two-tone brassy square wave)
  const chimeFreqs = [680, 510]
  chimeFreqs.forEach((freq, idx) => {
    const t0 = now + idx * 0.16
    const osc = audio.createOscillator()
    const bp = audio.createBiquadFilter()
    const g = audio.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(freq, t0)
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(1250, t0)
    bp.Q.setValueAtTime(3.2, t0)
    g.gain.setValueAtTime(0.18, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14)
    osc.connect(bp).connect(g).connect(audio.destination)
    osc.start(t0)
    osc.stop(t0 + 0.15)
  })

  // 2. Bandpass-filtered Russian intercom voice-cadence syllables + horn static
  const syllables = [
    { delay: 0.38, dur: 0.16, f0: 155, f1: 120 }, // "СТОЙ!"
    { delay: 0.62, dur: 0.11, f0: 142, f1: 148 }, // "ЗО-НА"
    { delay: 0.76, dur: 0.14, f0: 135, f1: 118 }, // "РЕ-ЖИ-МА."
    { delay: 0.96, dur: 0.15, f0: 150, f1: 132 }, // "ВСТАВЬ-ТЕ"
    { delay: 1.15, dur: 0.18, f0: 145, f1: 108 }, // "ПРО-ПУСК!"
  ]

  syllables.forEach((syl) => {
    const t0 = now + syl.delay
    const voice = audio.createOscillator()
    const formant = audio.createBiquadFilter()
    const vg = audio.createGain()

    voice.type = 'sawtooth'
    voice.frequency.setValueAtTime(syl.f0, t0)
    voice.frequency.linearRampToValueAtTime(syl.f1, t0 + syl.dur)

    formant.type = 'bandpass'
    formant.frequency.setValueAtTime(1180, t0)
    formant.Q.setValueAtTime(4.5, t0)

    vg.gain.setValueAtTime(0.16, t0)
    vg.gain.exponentialRampToValueAtTime(0.001, t0 + syl.dur)

    voice.connect(formant).connect(vg).connect(audio.destination)
    voice.start(t0)
    voice.stop(t0 + syl.dur + 0.01)
  })

  // 3. Megaphone static burst across the announcement
  const staticDur = 1.38
  const bufSize = Math.floor(audio.sampleRate * staticDur)
  const buf = audio.createBuffer(1, bufSize, audio.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.45
  }
  const noise = audio.createBufferSource()
  noise.buffer = buf
  const nFilter = audio.createBiquadFilter()
  nFilter.type = 'bandpass'
  nFilter.frequency.setValueAtTime(1650, now)
  nFilter.Q.setValueAtTime(2.8, now)
  const ng = audio.createGain()
  ng.gain.setValueAtTime(0.04, now)
  ng.gain.exponentialRampToValueAtTime(0.001, now + staticDur)
  noise.connect(nFilter).connect(ng).connect(audio.destination)
  noise.start(now)
}

/**
 * Distinct two-tone Soviet brass bell chime (`ЗВОНОК ПРЕДУПРЕЖДЕНИЯ`)
 * Triggered the moment a Desk Annunciator threshold first crosses into Amber Warning.
 */
export function playAmberWarningChime(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const notes = [880, 659.25] // High A5 -> E5 resonant brass bell pair
  notes.forEach((freq, idx) => {
    const t0 = now + idx * 0.19
    const bell = audio.createOscillator()
    const overtone = audio.createOscillator()
    const gain = audio.createGain()
    const otGain = audio.createGain()

    bell.type = 'triangle'
    bell.frequency.setValueAtTime(freq, t0)
    overtone.type = 'sine'
    overtone.frequency.setValueAtTime(freq * 2.41, t0)

    gain.gain.setValueAtTime(0.22, t0)
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.48)
    otGain.gain.setValueAtTime(0.085, t0)
    otGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22)

    bell.connect(gain).connect(audio.destination)
    overtone.connect(otGain).connect(audio.destination)

    bell.start(t0)
    overtone.start(t0)
    bell.stop(t0 + 0.5)
    overtone.stop(t0 + 0.24)
  })
}

/**
 * Slow, rhythmic low-frequency Soviet bunker klaxon pulse (`СИРЕНА АВАРИИ`)
 * Triggered when any Desk Annunciator tile enters Critical Red (with 6-second cooldown).
 */
export function playCriticalRedKlaxonPulse(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const horn = audio.createOscillator()
  const sub = audio.createOscillator()
  const filter = audio.createBiquadFilter()
  const gain = audio.createGain()

  horn.type = 'sawtooth'
  horn.frequency.setValueAtTime(145, now)
  horn.frequency.linearRampToValueAtTime(215, now + 0.32)
  horn.frequency.linearRampToValueAtTime(132, now + 0.72)

  sub.type = 'square'
  sub.frequency.setValueAtTime(72.5, now)
  sub.frequency.linearRampToValueAtTime(107.5, now + 0.32)
  sub.frequency.linearRampToValueAtTime(66, now + 0.72)

  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(640, now)
  filter.Q.setValueAtTime(3.5, now)

  gain.gain.setValueAtTime(0.001, now)
  gain.gain.linearRampToValueAtTime(0.24, now + 0.08)
  gain.gain.setValueAtTime(0.22, now + 0.45)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.76)

  horn.connect(filter)
  sub.connect(filter)
  filter.connect(gain).connect(audio.destination)

  horn.start(now)
  sub.start(now)
  horn.stop(now + 0.78)
  sub.stop(now + 0.78)
}

/**
 * Heavy hydraulic resistance chug & check-valve clank for manual Boron Piston hand-pumping (`НАСОС БОРА`)
 */
export function playBoronHydraulicPumpStroke(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  // 1. Deep hydraulic cylinder compression thud
  const cyl = audio.createOscillator()
  const cylGain = audio.createGain()
  cyl.type = 'sine'
  cyl.frequency.setValueAtTime(118, now)
  cyl.frequency.exponentialRampToValueAtTime(38, now + 0.22)
  cylGain.gain.setValueAtTime(0.32, now)
  cylGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24)
  cyl.connect(cylGain).connect(audio.destination)
  cyl.start(now)
  cyl.stop(now + 0.25)

  // 2. Viscous liquid squeeze hiss through check-valve
  const dur = 0.18
  const bufSize = Math.floor(audio.sampleRate * dur)
  const buf = audio.createBuffer(1, bufSize, audio.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI)
  }
  const src = audio.createBufferSource()
  src.buffer = buf
  const bp = audio.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(720, now)
  bp.Q.setValueAtTime(2.6, now)
  const ng = audio.createGain()
  ng.gain.setValueAtTime(0.18, now)
  ng.gain.exponentialRampToValueAtTime(0.001, now + dur)
  src.connect(bp).connect(ng).connect(audio.destination)
  src.start(now)
}

/**
 * Heavy metallic high-voltage contactor CLUNK-THUD + 50Hz/100Hz magnetic transformer hum swell
 * Triggered when throwing or scrolling a Sector MW Lever on UNIT A (`|ΔMW| >= 5 MW`).
 */
export function playContactorInrushClunk(deltaMW: number): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime
  const absDelta = Math.abs(deltaMW)
  if (absDelta < 5) return
  const intensity = Math.min(1.0, Math.max(0.35, absDelta / 50))
  const isInrush = deltaMW > 0

  // 1. Sub-bass cabinet contactor thump
  const thud = audio.createOscillator()
  const thudGain = audio.createGain()
  thud.type = 'sine'
  thud.frequency.setValueAtTime(isInrush ? 115 : 145, now)
  thud.frequency.exponentialRampToValueAtTime(isInrush ? 26 : 36, now + 0.14)
  thudGain.gain.setValueAtTime(0.42 * intensity, now)
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
  thud.connect(thudGain).connect(audio.destination)
  thud.start(now)
  thud.stop(now + 0.17)

  // 2. Bandpass-filtered copper contact jaw slam + arc snap
  const snapDur = 0.055
  const bufSize = Math.floor(audio.sampleRate * snapDur)
  const buf = audio.createBuffer(1, bufSize, audio.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.28))
  }
  const noise = audio.createBufferSource()
  noise.buffer = buf
  const bp = audio.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(isInrush ? 1180 : 1680, now)
  bp.Q.setValueAtTime(3.2, now)
  const ng = audio.createGain()
  ng.gain.setValueAtTime(0.34 * intensity, now)
  ng.gain.exponentialRampToValueAtTime(0.001, now + snapDur)
  noise.connect(bp).connect(ng).connect(audio.destination)
  noise.start(now)

  // 3. 50Hz / 100Hz magnetic transformer hum swell (groans down on +MW inrush, whines up on -MW load rejection)
  const humDur = 0.38
  const hum50 = audio.createOscillator()
  const hum100 = audio.createOscillator()
  const lp = audio.createBiquadFilter()
  const humGain = audio.createGain()

  hum50.type = 'sawtooth'
  hum100.type = 'triangle'
  const fStart = isInrush ? 51.0 : 49.5
  const fEnd = isInrush ? 46.5 : 54.0
  hum50.frequency.setValueAtTime(fStart, now + 0.02)
  hum50.frequency.linearRampToValueAtTime(fEnd, now + 0.18)
  hum50.frequency.linearRampToValueAtTime(50.0, now + humDur)

  hum100.frequency.setValueAtTime(fStart * 2, now + 0.02)
  hum100.frequency.linearRampToValueAtTime(fEnd * 2, now + 0.18)
  hum100.frequency.linearRampToValueAtTime(100.0, now + humDur)

  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(isInrush ? 240 : 320, now)
  lp.Q.setValueAtTime(2.8, now)

  humGain.gain.setValueAtTime(0.001, now)
  humGain.gain.linearRampToValueAtTime(0.16 * intensity, now + 0.05)
  humGain.gain.exponentialRampToValueAtTime(0.001, now + humDur)

  hum50.connect(lp)
  hum100.connect(lp)
  lp.connect(humGain).connect(audio.destination)

  hum50.start(now)
  hum100.start(now)
  hum50.stop(now + humDur + 0.02)
  hum100.stop(now + humDur + 0.02)
}

interface TurbineHumController {
  osc50: OscillatorNode
  osc100: OscillatorNode
  filter: BiquadFilterNode
  gain: GainNode
  lastUpdateSec: number
}

let turbineHumCtrl: TurbineHumController | null = null

/**
 * Continuous background turbogenerator harmonic hum tied directly to `turbineRpm / 3000`.
 * Lets the operator hear the 1000 MWe turbine groan lower in pitch under heavy MW drag
 * or whine higher in pitch during load-rejection overspeed.
 */
export function updateTurbinePitchHum(
  rpm: number,
  totalAllocatedMW: number,
  voltageDipIntensity: number,
  isBlackout: boolean
): void {
  if (typeof window === 'undefined') return
  const state = useGameStore.getState()
  if (state.isMusicMuted || isBlackout || rpm < 250 || state.phase !== 'playing') {
    if (turbineHumCtrl && ctx) {
      turbineHumCtrl.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08)
    }
    return
  }

  // Only start or update if AudioContext has already been unlocked by user interaction
  if (!ctx || ctx.state !== 'running') return
  const now = ctx.currentTime

  if (!turbineHumCtrl) {
    const osc50 = ctx.createOscillator()
    const osc100 = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()

    osc50.type = 'sawtooth'
    osc100.type = 'triangle'
    osc50.frequency.setValueAtTime(50, now)
    osc100.frequency.setValueAtTime(100, now)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(165, now)
    filter.Q.setValueAtTime(2.2, now)

    gain.gain.setValueAtTime(0.0001, now)

    osc50.connect(filter)
    osc100.connect(filter)
    filter.connect(gain).connect(ctx.destination)

    osc50.start(now)
    osc100.start(now)

    turbineHumCtrl = {
      osc50,
      osc100,
      filter,
      gain,
      lastUpdateSec: now,
    }
  }

  if (now - turbineHumCtrl.lastUpdateSec < 0.04) return
  turbineHumCtrl.lastUpdateSec = now

  const pitchRatio = Math.max(0.25, Math.min(1.35, rpm / 3000))
  const fBase = 50.0 * pitchRatio
  const loadFactor = Math.min(1.0, totalAllocatedMW / 1000)
  const targetGain = Math.min(
    0.048,
    0.012 + loadFactor * 0.018 + voltageDipIntensity * 0.022
  )
  const targetCutoff = 135 + pitchRatio * 55 + voltageDipIntensity * 95

  turbineHumCtrl.osc50.frequency.setTargetAtTime(fBase, now, 0.05)
  turbineHumCtrl.osc100.frequency.setTargetAtTime(fBase * 2, now, 0.05)
  turbineHumCtrl.filter.frequency.setTargetAtTime(targetCutoff, now, 0.06)
  turbineHumCtrl.gain.gain.setTargetAtTime(targetGain, now, 0.06)
}





