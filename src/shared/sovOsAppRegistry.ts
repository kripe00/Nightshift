/**
 * Shared Plugin Contract for SOV-OS 84 Applications on the ISKRA-84 Desk CRT.
 * Zero imports from `src/modules/*` to avoid circular dependencies and enforce module boundaries.
 */

export type SovOsPluginAppId = 'polit_link' | 'zashchita'

export type SovOsAlertSeverity = 'none' | 'warn' | 'danger'

export type SovOsDuelTriggerMode =
  | 'crisis'
  | 'audit'
  | 'voluntary'
  | 'tutorial_drill'

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
  isIdeologyDrillPassed: () => boolean
  isFirewallDrillPassed: () => boolean
  getDuelHudSummary: () => PolitLinkHudSummary
  getFirewallHudSummary: () => ZashchitaHudSummary
}

const registeredApps = new Map<SovOsPluginAppId, SovOsPluginApp>()
const changeListeners = new Set<() => void>()

let runtimeHooks: SovOsRuntimeHooks | null = null
let pluginHostMounted = false
let deskAppTutorialForceEnabled = false

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
  runtimeHooks?.reset()
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
