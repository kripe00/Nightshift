import {
  registerSovOsPluginApp,
  registerSovOsRuntimeHooks,
} from '../../../shared/sovOsAppRegistry'
import { createPolitLinkPluginApp } from './politLinkCanvas'
import {
  getCyberDirectorHudSummaries,
  isCyberFirewallDrillDone,
  isCyberIdeologyDrillDone,
  resetCyberDirector,
  tickCyberDirector,
  triggerPolitLinkDuelWithNotice,
  triggerZashchitaFirewallWithNotice,
} from './sector84CyberDirector'
import { createZashchitaPluginApp } from './zashchitaCanvas'

let registered = false

export function registerTerminalSovOsApps(): void {
  if (registered) return
  registered = true

  registerSovOsPluginApp(createPolitLinkPluginApp())
  registerSovOsPluginApp(createZashchitaPluginApp())

  registerSovOsRuntimeHooks({
    tick: tickCyberDirector,
    reset: resetCyberDirector,
    triggerDuel: (mode) => triggerPolitLinkDuelWithNotice(mode ?? 'crisis'),
    triggerFirewall: (isDrill) => triggerZashchitaFirewallWithNotice(Boolean(isDrill)),
    isIdeologyDrillPassed: isCyberIdeologyDrillDone,
    isFirewallDrillPassed: isCyberFirewallDrillDone,
    getDuelHudSummary: () => getCyberDirectorHudSummaries().duel,
    getFirewallHudSummary: () => getCyberDirectorHudSummaries().firewall,
  })
}
