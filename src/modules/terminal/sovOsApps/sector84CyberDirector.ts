import { KOMRAD_CYBER_VOX } from '../../../shared/komradTutorialVox'
import {
  notifySovOsPluginChanged,
  type SovOsDuelTriggerMode,
} from '../../../shared/sovOsAppRegistry'
import { useGameStore } from '../../../shared/useGameStore'
import {
  getPolitLinkState,
  isPolitLinkDrillPassed,
  resetPolitLinkState,
  startPolitLinkDuel,
  tickPolitLink,
} from './politLinkEngine'
import {
  getZashchitaState,
  isZashchitaDrillPassed,
  resetZashchitaState,
  startZashchitaWave,
  tickZashchita,
} from './zashchitaEngine'

const INITIAL_LIVE_GRACE_SEC = 35
const MIN_INTER_EVENT_SEC = 58
const MAX_INTER_EVENT_SEC = 90

let liveElapsedSec = 0
let nextEventCountdownSec = INITIAL_LIVE_GRACE_SEC
let nextEventToggle: 'audit' | 'firewall' = 'firewall'
let drillStartedDuelForRun = false
let drillStartedFirewallForRun = false

export function resetCyberDirector(): void {
  liveElapsedSec = 0
  nextEventCountdownSec = INITIAL_LIVE_GRACE_SEC
  nextEventToggle = 'firewall'
  drillStartedDuelForRun = false
  drillStartedFirewallForRun = false
  resetPolitLinkState()
  resetZashchitaState()
}

export function triggerPolitLinkDuelWithNotice(
  mode: SovOsDuelTriggerMode = 'crisis'
): void {
  startPolitLinkDuel(mode)
  const gs = useGameStore.getState()
  if (mode === 'crisis') {
    gs.pushKomradCyberDispatch(
      'MANDATORY IDEOLOGICAL INTERROGATION AT ISKRA-84 (POLIT-LINK 84)!',
      'warn',
      'K.O.M.R.A.D.-84',
      KOMRAD_CYBER_VOX.DUEL_TRIGGER_CRISIS,
      true
    )
  } else if (mode === 'audit') {
    gs.pushKomradCyberDispatch(
      'UNANNOUNCED LOYALTY AUDIT OPENED ON ISKRA-84 (POLIT-LINK 84).',
      'warn',
      'K.O.M.R.A.D.-84',
      KOMRAD_CYBER_VOX.DUEL_TRIGGER_AUDIT,
      true
    )
  }
  notifySovOsPluginChanged()
}

export function triggerZashchitaFirewallWithNotice(isDrill = false): void {
  startZashchitaWave(isDrill)
  if (!isDrill) {
    useGameStore
      .getState()
      .pushKomradCyberDispatch(
        'CIA CYBER INTRUSION ON SECTOR 07! PURGE IN ZASHCHITA-84 AT DESK [KEY 4] -> [E]!',
        'danger',
        'SYS.DEFENSE',
        KOMRAD_CYBER_VOX.FIREWALL_TRIGGER,
        true
      )
  }
  notifySovOsPluginChanged()
}

export function tickCyberDirector(dt: number): void {
  const gs = useGameStore.getState()
  if (gs.phase !== 'playing' || !gs.isShiftControlReady) {
    return
  }

  let changed = false
  if (tickPolitLink(dt)) changed = true
  if (tickZashchita(dt)) changed = true

  // 1. Tutorial Drill Auto-Launchers (Step 7 & Step 8)
  if (gs.tutorialPhase === 'STEP_9_IDEOLOGY_DRILL') {
    const ps = getPolitLinkState()
    if (!drillStartedDuelForRun && !ps.active && !ps.drillPassed && !ps.drillFailed) {
      drillStartedDuelForRun = true
      startPolitLinkDuel('tutorial_drill')
      changed = true
    }
    if (changed) notifySovOsPluginChanged()
    return
  }

  if (gs.tutorialPhase === 'STEP_10_FIREWALL_DRILL') {
    const zs = getZashchitaState()
    if (!drillStartedFirewallForRun && !zs.active && !zs.drillPassed) {
      drillStartedFirewallForRun = true
      startZashchitaWave(true)
      changed = true
    }
    if (changed) notifySovOsPluginChanged()
    return
  }

  if (gs.tutorialPhase !== 'COMPLETED') {
    if (changed) notifySovOsPluginChanged()
    return
  }

  // 2. Live Night Shift Event Director
  liveElapsedSec += dt
  const ps = getPolitLinkState()
  const zs = getZashchitaState()
  if (ps.active || zs.active || gs.ideologyDuelActive || gs.ciaIntrusionActive) {
    if (changed) notifySovOsPluginChanged()
    return
  }

  nextEventCountdownSec -= dt
  if (nextEventCountdownSec > 0) {
    if (changed) notifySovOsPluginChanged()
    return
  }

  // Check Crisis Duel priority first if operator has no Party Approved immunity
  const isCrisis =
    gs.coreTemp >= 650 ||
    gs.voidFraction >= 0.28 ||
    gs.xenon >= 34 ||
    gs.az5Active

  if (isCrisis && gs.partyApprovedBuffSec <= 0) {
    triggerPolitLinkDuelWithNotice('crisis')
    nextEventCountdownSec =
      MIN_INTER_EVENT_SEC + Math.random() * (MAX_INTER_EVENT_SEC - MIN_INTER_EVENT_SEC)
    return
  }

  if (nextEventToggle === 'firewall') {
    triggerZashchitaFirewallWithNotice(false)
    nextEventToggle = 'audit'
  } else if (gs.partyApprovedBuffSec <= 0) {
    triggerPolitLinkDuelWithNotice('audit')
    nextEventToggle = 'firewall'
  } else {
    triggerZashchitaFirewallWithNotice(false)
    nextEventToggle = 'audit'
  }

  const shiftScale = Math.max(0.68, 1 - (gs.shiftNumber - 1) * 0.08)
  nextEventCountdownSec =
    (MIN_INTER_EVENT_SEC + Math.random() * (MAX_INTER_EVENT_SEC - MIN_INTER_EVENT_SEC)) *
    shiftScale
}

export function getCyberDirectorHudSummaries() {
  const ps = getPolitLinkState()
  const zs = getZashchitaState()
  const gs = useGameStore.getState()
  return {
    duel: {
      active: ps.active,
      mode: ps.mode,
      round: ps.roundIndex + 1,
      totalRounds: ps.totalRounds,
      timeLeftSec: ps.timeLeftSec,
      partyApprovedSec: gs.partyApprovedBuffSec,
    },
    firewall: {
      active: zs.active,
      isDrill: zs.isDrill,
      remainingHostiles: zs.processes.filter(
        (p) => p.isCiaHostile && p.status === 'running'
      ).length,
      totalHostiles: zs.processes.filter((p) => p.isCiaHostile).length,
    },
  }
}

export function isCyberIdeologyDrillDone(): boolean {
  return isPolitLinkDrillPassed()
}

export function isCyberFirewallDrillDone(): boolean {
  return isZashchitaDrillPassed()
}
