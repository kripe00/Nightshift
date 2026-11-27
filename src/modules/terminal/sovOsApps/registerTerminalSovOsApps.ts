import {
  registerSovOsPluginApp,
  registerSovOsRuntimeHooks,
} from '../../../shared/sovOsAppRegistry'
import { setOnImpostorExposedHandler } from './politLinkEngine'
import { createPolitLinkPluginApp } from './politLinkCanvas'
import { createShiftReportPluginApp } from './shiftReportCanvas'
import {
  getCyberDirectorHudSummaries,
  isCyberFirewallDrillDone,
  isCyberIdeologyDrillDone,
  resetCyberDirector,
  tickCyberDirector,
  triggerLangleyLeakEvent,
  triggerPolitLinkDuelWithNotice,
  triggerSpyCatFirewallWithNotice,
  triggerZashchitaFirewallWithNotice,
} from './sector84CyberDirector'
import { createZashchitaPluginApp } from './zashchitaCanvas'

let registered = false

export function registerTerminalSovOsApps(): void {
  if (registered) return
  registered = true

  setOnImpostorExposedHandler(triggerSpyCatFirewallWithNotice)
  registerSovOsPluginApp(createPolitLinkPluginApp())
  registerSovOsPluginApp(createZashchitaPluginApp())
  registerSovOsPluginApp(createShiftReportPluginApp())

  registerSovOsRuntimeHooks({
    tick: tickCyberDirector,
    reset: resetCyberDirector,
    triggerDuel: (mode) => triggerPolitLinkDuelWithNotice(mode ?? 'crisis'),
    triggerFirewall: (isDrill) => triggerZashchitaFirewallWithNotice(Boolean(isDrill)),
    triggerLangleyLeak: triggerLangleyLeakEvent,
    isIdeologyDrillPassed: isCyberIdeologyDrillDone,
    isFirewallDrillPassed: isCyberFirewallDrillDone,
    getDuelHudSummary: () => getCyberDirectorHudSummaries().duel,
    getFirewallHudSummary: () => getCyberDirectorHudSummaries().firewall,
  })
}
