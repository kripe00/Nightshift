// Procedural 1984 Soviet Control Room Web Audio Synthesizer (Zero External Assets)

let audioCtx: AudioContext | null = null

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume()
  }
  return audioCtx
}

export function playLeverRatchet(pitchFactor = 1): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(520 * pitchFactor, now)
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.018)

  gain.gain.setValueAtTime(0.18, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02)

  osc.connect(gain).connect(audio.destination)
  osc.start(now)
  osc.stop(now + 0.022)
}

export function playSwitchClank(heavy = true): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  // 1. Metallic transient burst
  const bufLen = Math.floor(audio.sampleRate * 0.045)
  const buf = audio.createBuffer(1, bufLen, audio.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.28))
  }

  const noise = audio.createBufferSource()
  noise.buffer = buf

  const filter = audio.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(heavy ? 1150 : 1950, now)
  filter.Q.setValueAtTime(3.2, now)

  const nGain = audio.createGain()
  nGain.gain.setValueAtTime(heavy ? 0.36 : 0.2, now)
  nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045)

  noise.connect(filter).connect(nGain).connect(audio.destination)
  noise.start(now)

  // 2. Low Bakelite body thud
  const osc = audio.createOscillator()
  const oGain = audio.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(heavy ? 165 : 230, now)
  osc.frequency.exponentialRampToValueAtTime(38, now + 0.065)

  oGain.gain.setValueAtTime(heavy ? 0.42 : 0.24, now)
  oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)

  osc.connect(oGain).connect(audio.destination)
  osc.start(now)
  osc.stop(now + 0.075)
}

export function playKlaxonBurst(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(640, now)
  osc.frequency.setValueAtTime(460, now + 0.14)

  gain.gain.setValueAtTime(0.2, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32)

  osc.connect(gain).connect(audio.destination)
  osc.start(now)
  osc.stop(now + 0.34)
}

export function playGeigerClick(): void {
  const audio = getAudioContext()
  if (!audio) return
  const now = audio.currentTime

  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(3200 + Math.random() * 600, now)

  gain.gain.setValueAtTime(0.05, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.004)

  osc.connect(gain).connect(audio.destination)
  osc.start(now)
  osc.stop(now + 0.005)
}

