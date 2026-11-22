// Global K.O.M.R.A.D.-84 post-transmission silence & cooldown coordinator.
// Shared read/write coordination across useGameStore, komradVoiceSynth, and DesktopComputer3D
// without introducing circular module imports.

export interface KomradSilenceStateSnapshot {
  phase: string
  isShiftControlReady: boolean
  tutorialPhase: string
  coreMeltdown: boolean
  steamExplosion: boolean
  az5Active: boolean
  ciaIntrusionActive: boolean
  isBlackout: boolean
  isGodMode: boolean
  coreTemp: number
  drumPressure: number
  voidFraction: number
  xenon: number
  drumWaterLevel: number
  roomRadiation: number
  coreTileAnomalies: Record<string, unknown>
  powerAllocation: {
    cooling: number
    defense: number
    facility: number
  }
  maxSafePower: number
}

export const IDLE_SILENCE_MIN_SEC = 75
export const IDLE_SILENCE_MAX_SEC = 120
export const NON_CRITICAL_SILENCE_SEC = 45
export const POST84_ORDER_QUIET_SEC = 35

let isTransmitting = false
let lastTransmissionEndSec = 0
let globalIdleSilenceUntilSec = 0
let nonCriticalSilenceUntilSec = 0
let post84OrderQuietUntilSec = 0
let preferredIdleChannel: 'monologue' | 'text' = 'monologue'

function nowSec(): number {
  return typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000
}

function rollIdleSilenceGapSec(): number {
  return (
    IDLE_SILENCE_MIN_SEC +
    Math.random() * (IDLE_SILENCE_MAX_SEC - IDLE_SILENCE_MIN_SEC)
  )
}

function rollPreferredIdleChannel(): 'monologue' | 'text' {
  return Math.random() < 0.55 ? 'monologue' : 'text'
}

export function resetKomradSilenceState(): void {
  const now = nowSec()
  isTransmitting = false
  lastTransmissionEndSec = now
  globalIdleSilenceUntilSec = now + rollIdleSilenceGapSec()
  nonCriticalSilenceUntilSec = now + NON_CRITICAL_SILENCE_SEC
  post84OrderQuietUntilSec = 0
  preferredIdleChannel = rollPreferredIdleChannel()
}

export function markKomradTransmissionStart(): void {
  isTransmitting = true
}

export function markKomradTransmissionEnd(): void {
  const now = nowSec()
  isTransmitting = false
  lastTransmissionEndSec = now
  globalIdleSilenceUntilSec = Math.max(
    post84OrderQuietUntilSec,
    now + rollIdleSilenceGapSec()
  )
  nonCriticalSilenceUntilSec = now + NON_CRITICAL_SILENCE_SEC
  preferredIdleChannel = rollPreferredIdleChannel()
}

export function reserveIdleChatterEmission(): void {
  const now = nowSec()
  globalIdleSilenceUntilSec = Math.max(
    globalIdleSilenceUntilSec,
    now + rollIdleSilenceGapSec()
  )
}

export function notifyPost84OrderEvent(): void {
  const now = nowSec()
  post84OrderQuietUntilSec = now + POST84_ORDER_QUIET_SEC
  globalIdleSilenceUntilSec = Math.max(
    globalIdleSilenceUntilSec,
    post84OrderQuietUntilSec
  )
}

export function isKomradTransmitting(): boolean {
  return isTransmitting
}

export function getLastKomradTransmissionEndSec(): number {
  return lastTransmissionEndSec
}

export function isKomradNonCriticalCooldownActive(): boolean {
  return isTransmitting || nowSec() < nonCriticalSilenceUntilSec
}

export function canEmitKomradNonCriticalWarning(): boolean {
  return !isTransmitting && nowSec() >= nonCriticalSilenceUntilSec
}

export function isKomradEmergencyOrAlarmActive(
  state: KomradSilenceStateSnapshot
): boolean {
  const spentCount = Object.keys(state.coreTileAnomalies ?? {}).length
  const totalAllocatedPower =
    state.powerAllocation.cooling +
    state.powerAllocation.defense +
    state.powerAllocation.facility

  return (
    state.coreMeltdown ||
    state.steamExplosion ||
    state.az5Active ||
    state.ciaIntrusionActive ||
    (state.isBlackout && !state.isGodMode) ||
    state.coreTemp >= 680 ||
    state.drumPressure > 79 ||
    state.voidFraction > 0.38 ||
    state.xenon > 38 ||
    Math.abs(state.drumWaterLevel) > 130 ||
    state.roomRadiation >= 3.5 ||
    spentCount >= 3 ||
    totalAllocatedPower > state.maxSafePower
  )
}

export function canEmitKomradIdleChatter(
  state: KomradSilenceStateSnapshot,
  channel: 'monologue' | 'text' | 'any' = 'any'
): boolean {
  if (
    state.phase !== 'playing' ||
    !state.isShiftControlReady ||
    state.tutorialPhase !== 'COMPLETED' ||
    isKomradEmergencyOrAlarmActive(state) ||
    isTransmitting
  ) {
    return false
  }

  const now = nowSec()
  if (now < post84OrderQuietUntilSec || now < nonCriticalSilenceUntilSec) {
    return false
  }

  if (channel === 'any') {
    return now >= globalIdleSilenceUntilSec
  }
  if (channel === 'monologue') {
    return (
      preferredIdleChannel === 'monologue' && now >= globalIdleSilenceUntilSec
    )
  }
  // Allow text chatter on its turn, or after a 1.5s grace window if the monologue channel
  // is unavailable (e.g., muted audio or preloaded clips not active).
  return (
    (preferredIdleChannel === 'text' && now >= globalIdleSilenceUntilSec) ||
    (preferredIdleChannel === 'monologue' &&
      now >= globalIdleSilenceUntilSec + 1.5)
  )
}
