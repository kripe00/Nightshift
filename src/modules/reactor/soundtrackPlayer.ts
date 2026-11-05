// Dynamic Soviet Control Room Soundtrack Controller
// Crossfades between 'night-shift.mp3' (nominal) and 'redline-reactor.mp3' (Redline / Crisis)

let normalTrack: HTMLAudioElement | null = null
let redlineTrack: HTMLAudioElement | null = null
let isStarted = false
let currentMode: 'normal' | 'redline' = 'normal'
let currentMuted = false

function ensureTracks(): void {
  if (typeof window === 'undefined') return
  if (!normalTrack) {
    normalTrack = new Audio('./music/night-shift.mp3')
    normalTrack.loop = true
    normalTrack.volume = 0.38
  }
  if (!redlineTrack) {
    redlineTrack = new Audio('./music/redline-reactor.mp3')
    redlineTrack.loop = true
    redlineTrack.volume = 0
  }
}

export function startSoundtrack(): void {
  ensureTracks()
  if (!normalTrack || !redlineTrack) return
  isStarted = true
  normalTrack.muted = currentMuted
  redlineTrack.muted = currentMuted
  void normalTrack.play().catch(() => {
    // Autoplay blocked until interaction
  })
  void redlineTrack.play().catch(() => {
    // Autoplay blocked until interaction
  })
}

export function updateSoundtrackState(isRedlineOrCrisis: boolean, muted: boolean): void {
  currentMuted = muted
  if (!isStarted || !normalTrack || !redlineTrack) return

  normalTrack.muted = muted
  redlineTrack.muted = muted

  const targetMode: 'normal' | 'redline' = isRedlineOrCrisis ? 'redline' : 'normal'
  if (targetMode !== currentMode) {
    currentMode = targetMode
  }

  if (currentMode === 'redline') {
    normalTrack.volume = 0.05
    redlineTrack.volume = 0.45
  } else {
    normalTrack.volume = 0.38
    redlineTrack.volume = 0.0
  }
}
