/**
 * Shared Plugin Contract for SOV-OS 84 Applications on the ISKRA-84 Desk CRT.
 * Zero imports from `src/modules/*` to avoid circular dependencies and enforce module boundaries.
 */

import type { SovOsPersistenceSnapshot } from './types'

export type SovOsPluginAppId = 'polit_link' | 'zashchita'

export type SovOsAlertSeverity = 'none' | 'warn' | 'danger'

export type SovOsDuelTriggerMode =
  | 'crisis'
  | 'audit'
  | 'voluntary'
  | 'tutorial_drill'
  | 'impostor'

export interface SovOsWindowRect {
  x: number
  y: number
  w: number
  h: number
}

export interface SovOsPluginHitRegion {
  id: string
  x: number
  y: number
  w: number
  h: number
  payload?: string
}

export interface SovOsPluginStatusMeta {
  subtitle: string
  badgeText: string | null
  alertSeverity: SovOsAlertSeverity
  isUrgent: boolean
}

export interface SovOsPluginClickResult {
  handled: boolean
  statusNotice?: string
  sound?: 'click' | 'clank' | 'chime' | 'alarm'
  requestFocusApp?: SovOsPluginAppId
}

export interface SovOsPluginApp {
  id: SovOsPluginAppId
  iconTitle: string
  taskbarLabel: string
  windowTitle: string
  drawIconGlyph: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    alertSeverity: SovOsAlertSeverity
  ) => void
  getStatusMeta: () => SovOsPluginStatusMeta
  getRenderSignature: () => string
  getHitRegions: (rect: SovOsWindowRect) => SovOsPluginHitRegion[]
  handleClick: (regionId: string, payload?: string) => SovOsPluginClickResult
  paintWindow: (
    ctx: CanvasRenderingContext2D,
    rect: SovOsWindowRect,
    hoveredId: string | null,
    alertPhase: 0 | 1 | 2
  ) => void
}

export interface PolitLinkHudSummary {
  active: boolean
  mode: string
  round: number
  totalRounds: number
  timeLeftSec: number
  partyApprovedSec: number
}

export interface ZashchitaHudSummary {
  active: boolean
  isDrill: boolean
  remainingHostiles: number
  totalHostiles: number
}

export interface SovOsRuntimeHooks {
  tick: (dt: number) => void
  reset: () => void
  triggerDuel: (mode?: SovOsDuelTriggerMode) => void
  triggerFirewall: (isDrill?: boolean) => void
  triggerLangleyLeak: () => void
  isIdeologyDrillPassed: () => boolean
  isFirewallDrillPassed: () => boolean
  getDuelHudSummary: () => PolitLinkHudSummary
  getFirewallHudSummary: () => ZashchitaHudSummary
  getPersistenceSnapshot?: () => SovOsPersistenceSnapshot
  restorePersistenceSnapshot?: (snapshot: SovOsPersistenceSnapshot) => void
}

const registeredApps = new Map<SovOsPluginAppId, SovOsPluginApp>()
const changeListeners = new Set<() => void>()

let runtimeHooks: SovOsRuntimeHooks | null = null
let pluginHostMounted = false
let deskAppTutorialForceEnabled = false
let lastRestoredPersistenceSnapshot: SovOsPersistenceSnapshot | null = null

export function notifySovOsPluginChanged(): void {
  changeListeners.forEach((listener) => listener())
}

export function subscribeSovOsPluginChanges(listener: () => void): () => void {
  changeListeners.add(listener)
  return () => {
    changeListeners.delete(listener)
  }
}

export function registerSovOsPluginApp(app: SovOsPluginApp): void {
  registeredApps.set(app.id, app)
  notifySovOsPluginChanged()
}

export function getSovOsPluginApps(): readonly SovOsPluginApp[] {
  return Array.from(registeredApps.values())
}

export function getSovOsPluginApp(
  id: SovOsPluginAppId
): SovOsPluginApp | undefined {
  return registeredApps.get(id)
}

export function registerSovOsRuntimeHooks(hooks: SovOsRuntimeHooks): void {
  runtimeHooks = hooks
  notifySovOsPluginChanged()
}

export function setSovOsPluginHostMounted(mounted: boolean): void {
  if (pluginHostMounted === mounted) return
  pluginHostMounted = mounted
  notifySovOsPluginChanged()
}

export function isSovOsPluginHostMounted(): boolean {
  return pluginHostMounted
}

export function setDeskAppTutorialForceEnabled(enabled: boolean): void {
  if (deskAppTutorialForceEnabled === enabled) return
  deskAppTutorialForceEnabled = enabled
  notifySovOsPluginChanged()
}

export function isDeskAppTutorialForceEnabled(): boolean {
  return deskAppTutorialForceEnabled
}

export function isDeskAppTutorialEnabled(): boolean {
  return pluginHostMounted || deskAppTutorialForceEnabled
}

export function tickSovOsRuntime(dt: number): void {
  runtimeHooks?.tick(dt)
}

export function resetSovOsRuntime(): void {
  lastRestoredPersistenceSnapshot = null
  runtimeHooks?.reset()
  notifySovOsPluginChanged()
}

const VALID_DUEL_MODES = new Set<SovOsDuelTriggerMode>([
  'crisis',
  'audit',
  'voluntary',
  'tutorial_drill',
  'impostor',
])

export function captureSovOsPersistenceSnapshot(): SovOsPersistenceSnapshot {
  if (runtimeHooks?.getPersistenceSnapshot) {
    return runtimeHooks.getPersistenceSnapshot()
  }

  const politApp = registeredApps.get('polit_link')
  const zashApp = registeredApps.get('zashchita')
  const duelSummary = getPolitLinkHudSummary()
  const fwSummary = getZashchitaHudSummary()

  let politActive = duelSummary.active
  let politMode = duelSummary.mode
  let politRoundIdx = Math.max(0, duelSummary.round - 1)
  let politTrust = lastRestoredPersistenceSnapshot?.politLink.trust ?? 50
  let politSuspicion = lastRestoredPersistenceSnapshot?.politLink.suspicion ?? 20
  let politTimeLeft = duelSummary.timeLeftSec
  let politDrillFailed = lastRestoredPersistenceSnapshot?.politLink.drillFailed ?? false

  if (politApp) {
    const sigParts = politApp.getRenderSignature().split(':')
    if (sigParts.length >= 8) {
      politActive = sigParts[0] === '1'
      politMode = sigParts[1] || politMode
      const parsedRound = Number(sigParts[2])
      const parsedTrust = Number(sigParts[3])
      const parsedSusp = Number(sigParts[4])
      const parsedTime = Number(sigParts[5])
      if (Number.isFinite(parsedRound)) politRoundIdx = parsedRound
      if (Number.isFinite(parsedTrust)) politTrust = parsedTrust
      if (Number.isFinite(parsedSusp)) politSuspicion = parsedSusp
      if (Number.isFinite(parsedTime)) politTimeLeft = parsedTime
      politDrillFailed = sigParts[7] === '1'
    }
  }

  let zashActive = fwSummary.active
  let zashIsDrill = fwSummary.isDrill
  let zashWaveMode = lastRestoredPersistenceSnapshot?.zashchita.waveMode ?? 'standard'
  let zashWaveCount = lastRestoredPersistenceSnapshot?.zashchita.waveCount ?? 0

  if (zashApp) {
    const sigParts = zashApp.getRenderSignature().split('|')
    if (sigParts.length >= 6) {
      zashActive = sigParts[0] === '1'
      zashIsDrill = sigParts[1] === '1'
      zashWaveMode = sigParts[2] || zashWaveMode
      const parsedWaveCount = Number(sigParts[5])
      if (Number.isFinite(parsedWaveCount)) zashWaveCount = parsedWaveCount
    }
  }

  return {
    politLink: {
      active: politActive,
      mode: politMode,
      roundIndex: politRoundIdx,
      trust: politTrust,
      suspicion: politSuspicion,
      timeLeftSec: politTimeLeft,
      drillPassed:
        isIdeologyDrillPassed() ||
        Boolean(lastRestoredPersistenceSnapshot?.politLink.drillPassed),
      drillFailed: politDrillFailed,
    },
    zashchita: {
      active: zashActive,
      isDrill: zashIsDrill,
      waveMode: zashWaveMode,
      waveCount: zashWaveCount,
      drillPassed:
        isFirewallDrillPassed() ||
        Boolean(lastRestoredPersistenceSnapshot?.zashchita.drillPassed),
    },
  }
}

export function restoreSovOsPersistenceSnapshot(
  snapshot: SovOsPersistenceSnapshot | null | undefined
): void {
  if (!snapshot) {
    lastRestoredPersistenceSnapshot = null
    return
  }
  lastRestoredPersistenceSnapshot = {
    politLink: { ...snapshot.politLink },
    zashchita: { ...snapshot.zashchita },
  }
  if (runtimeHooks?.restorePersistenceSnapshot) {
    runtimeHooks.restorePersistenceSnapshot(lastRestoredPersistenceSnapshot)
    notifySovOsPluginChanged()
    return
  }
  if (snapshot.politLink.active) {
    if (snapshot.politLink.mode === 'impostor') {
      runtimeHooks?.triggerLangleyLeak()
    } else if (VALID_DUEL_MODES.has(snapshot.politLink.mode as SovOsDuelTriggerMode)) {
      runtimeHooks?.triggerDuel(snapshot.politLink.mode as SovOsDuelTriggerMode)
    } else {
      runtimeHooks?.triggerDuel('audit')
    }
  }
  if (snapshot.zashchita.active) {
    runtimeHooks?.triggerFirewall(Boolean(snapshot.zashchita.isDrill))
  }
  notifySovOsPluginChanged()
}

export function debugTriggerPolitLinkDuel(
  mode: SovOsDuelTriggerMode = 'crisis'
): void {
  runtimeHooks?.triggerDuel(mode)
  notifySovOsPluginChanged()
}

export function debugTriggerZashchitaFirewall(isDrill = false): void {
  runtimeHooks?.triggerFirewall(isDrill)
  notifySovOsPluginChanged()
}

export function debugTriggerLangleyLeakEvent(): void {
  runtimeHooks?.triggerLangleyLeak()
  notifySovOsPluginChanged()
}

export function isIdeologyDrillPassed(): boolean {
  return runtimeHooks?.isIdeologyDrillPassed() ?? false
}

export function isFirewallDrillPassed(): boolean {
  return runtimeHooks?.isFirewallDrillPassed() ?? false
}

export function getPolitLinkHudSummary(): PolitLinkHudSummary {
  return (
    runtimeHooks?.getDuelHudSummary() ?? {
      active: false,
      mode: 'idle',
      round: 0,
      totalRounds: 0,
      timeLeftSec: 0,
      partyApprovedSec: 0,
    }
  )
}

export function getZashchitaHudSummary(): ZashchitaHudSummary {
  return (
    runtimeHooks?.getFirewallHudSummary() ?? {
      active: false,
      isDrill: false,
      remainingHostiles: 0,
      totalHostiles: 0,
    }
  )
}
