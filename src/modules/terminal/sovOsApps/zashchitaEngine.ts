import { KOMRAD_CYBER_VOX } from '../../../shared/komradTutorialVox'
import { useGameStore } from '../../../shared/useGameStore'
import { getEvidenceProcessForShift } from './clearSkyCampaign'

export type ZashchitaWaveMode = 'standard' | 'drill' | 'spy_cat'

export type ProcessImpactKind =
  | 'pump_a'
  | 'pump_b'
  | 'lights'
  | 'grid'
  | 'feedwater'

export interface FirewallProcess {
  pid: number
  name: string
  port: number
  signature: string
  cpuPct: number
  origin: string
  linkedHardware: string
  impactKind: ProcessImpactKind
  isCiaHostile: boolean
  violationReason: string | null
  intelKind?: 'clear_sky_evidence'
  intelId?: string
  intelSummary?: string
  status: 'running' | 'purged' | 'fault_killed' | 'archived'
}

export interface ZashchitaState {
  active: boolean
  isDrill: boolean
  waveMode: ZashchitaWaveMode
  shiftTier: 1 | 2 | 3
  processes: FirewallProcess[]
  selectedPid: number | null
  lastFeedback: string
  lastOutcome: 'none' | 'win' | 'breach' | 'drill_mistake'
  drillPassed: boolean
  waveCount: number
  animClockSec: number
}

const VALID_PORTS = new Set([50, 84, 330, 1917])
const VALID_SIGS = new Set(['GOST-84', 'SSR-OK'])

interface ProcessTemplate {
  name: string
  port: number
  signature: string
  cpuPct: number
  origin: string
  linkedHardware: string
  impactKind: ProcessImpactKind
}

const GENUINE_POOL: readonly ProcessTemplate[] = [
  {
    name: 'PUMP_A_DRV',
    port: 84,
    signature: 'GOST-84',
    cpuPct: 18,
    origin: 'UNIT-A // LOOP-1',
    linkedHardware: 'UNIT A COOLING PUMP A',
    impactKind: 'pump_a',
  },
  {
    name: 'PUMP_B_DRV',
    port: 84,
    signature: 'SSR-OK',
    cpuPct: 21,
    origin: 'UNIT-A // LOOP-2',
    linkedHardware: 'UNIT A COOLING PUMP B',
    impactKind: 'pump_b',
  },
  {
    name: 'DRUM_FW_CTL',
    port: 330,
    signature: 'GOST-84',
    cpuPct: 14,
    origin: 'UNIT-B // FEEDWATER',
    linkedHardware: 'UNIT B FEEDWATER VALVE',
    impactKind: 'feedwater',
  },
  {
    name: 'GRID_SYNC_50',
    port: 50,
    signature: 'SSR-OK',
    cpuPct: 26,
    origin: 'UNIT-C // BUS-50HZ',
    linkedHardware: 'UNIT C 50.0 HZ SYNCHRONIZER',
    impactKind: 'grid',
  },
  {
    name: 'BUNKER_LUX',
    port: 1917,
    signature: 'GOST-84',
    cpuPct: 9,
    origin: 'MCR-4 // LIGHTING',
    linkedHardware: 'BUNKER TUNGSTEN LIGHTING BUS',
    impactKind: 'lights',
  },
]

const HOSTILE_TEMPLATES: Record<
  1 | 2 | 3,
  readonly {
    name: string
    port: number
    signature: string
    cpuPct: number
    origin: string
    reason: string
  }[]
> = {
  1: [
    {
      name: 'CIA_SIPHON',
      port: 1776,
      signature: 'CIA-TX',
      cpuPct: 44,
      origin: 'EXT // LANGLEY-RELAY',
      reason: 'FORGED SIG (CIA-TX), BAD PORT (1776), WESTERN TAG',
    },
    {
      name: 'LIBERTY_BOT',
      port: 404,
      signature: 'US-NSA',
      cpuPct: 52,
      origin: 'EXT // VIRGINIA-TX',
      reason: 'FORGED SIG (US-NSA), BAD PORT (404), WESTERN TAG',
    },
    {
      name: 'USD_PROXY84',
      port: 666,
      signature: 'FREE84',
      cpuPct: 39,
      origin: 'EXT // NATO-UPLINK',
      reason: 'FORGED SIG (FREE84), BAD PORT (666), WESTERN TAG',
    },
  ],
  2: [
    {
      name: 'AUX_THERM_MON',
      port: 84,
      signature: 'SSR-OK',
      cpuPct: 86,
      origin: 'BUS-07 // ANOMALY',
      reason: 'EXCESSIVE AUX CPU (86% > 60% GOST LIMIT)',
    },
    {
      name: 'FREE_MARKET_IO',
      port: 76,
      signature: 'CIA-TX',
      cpuPct: 48,
      origin: 'EXT // LANGLEY-02',
      reason: 'BAD PORT (76), FORGED SIG (CIA-TX), WESTERN TAG',
    },
    {
      name: 'TELEM_REPACK',
      port: 330,
      signature: 'GOST-84',
      cpuPct: 91,
      origin: 'BUS-07 // FLOOD',
      reason: 'EXCESSIVE AUX CPU (91% > 60% GOST LIMIT)',
    },
  ],
  3: [
    {
      name: 'PUMP_A_PATCH',
      port: 1776,
      signature: 'GOST-84',
      cpuPct: 32,
      origin: 'SPOOF // UNIT-A',
      reason: 'UNAUTHORIZED PORT (1776 NOT IN 50/84/330/1917)',
    },
    {
      name: 'KGB_MIRROR_X',
      port: 84,
      signature: 'BAD-CRC',
      cpuPct: 41,
      origin: 'SPOOF // TRUNK-4',
      reason: 'INVALID SIGNATURE (BAD-CRC)',
    },
    {
      name: 'DRUM_OVERFLOW',
      port: 330,
      signature: 'SSR-OK',
      cpuPct: 88,
      origin: 'SPOOF // UNIT-B',
      reason: 'EXCESSIVE AUX CPU (88% > 60% GOST LIMIT)',
    },
  ],
}

const SPY_CAT_HOSTILES: readonly {
  name: string
  port: number
  signature: string
  cpuPct: number
  origin: string
  reason: string
}[] = [
  {
    name: 'SPY_CAT_GPS',
    port: 1776,
    signature: 'CIA-TX',
    cpuPct: 58,
    origin: 'EXT // LANGLEY-FELINE',
    reason: 'FORGED SIG (CIA-TX), BAD PORT (1776), CIA SPY CAT',
  },
  {
    name: 'LANGLEY_NODE_04',
    port: 404,
    signature: 'US-NSA',
    cpuPct: 64,
    origin: 'EXT // VIRGINIA-COWBOY',
    reason: 'FORGED SIG (US-NSA), BAD PORT (404), IMPOSTOR RELAY',
  },
  {
    name: 'BANJO_STREAM',
    port: 666,
    signature: 'FREE84',
    cpuPct: 49,
    origin: 'EXT // TORTURE-AUDIO',
    reason: 'FORGED SIG (FREE84), BAD PORT (666), WESTERN AUDIO',
  },
]

const zashchitaState: ZashchitaState = {
  active: false,
  isDrill: false,
  waveMode: 'standard',
  shiftTier: 1,
  processes: [],
  selectedPid: null,
  lastFeedback: 'SECTOR 07 FIREWALL STANDBY. ALL SIGNATURES MATCH GOST-84.',
  lastOutcome: 'none',
  drillPassed: false,
  waveCount: 0,
  animClockSec: 0,
}

export function getZashchitaState(): Readonly<ZashchitaState> {
  return zashchitaState
}

export function isZashchitaDrillPassed(): boolean {
  return zashchitaState.drillPassed
}

export function getGostRulesForTier(tier: 1 | 2 | 3): readonly string[] {
  const base = [
    '1. SIG MUST BE: GOST-84 or SSR-OK',
    '2. PORT MUST BE: 50, 84, 330, or 1917',
    '3. NO WESTERN TAGS (CIA/USA/USD/FREE)',
  ]
  if (tier >= 2) {
    base.push('4. AUX CPU MUST BE <= 60%')
  }
  if (tier >= 3) {
    base.push('5. VERIFY PORT + SIG EVEN ON FAMILIAR NAMES')
  }
  return base
}

export function resetZashchitaState(): void {
  zashchitaState.active = false
  zashchitaState.isDrill = false
  zashchitaState.waveMode = 'standard'
  zashchitaState.shiftTier = 1
  zashchitaState.processes = []
  zashchitaState.selectedPid = null
  zashchitaState.lastFeedback =
    'SECTOR 07 FIREWALL STANDBY. ALL SIGNATURES MATCH GOST-84.'
  zashchitaState.lastOutcome = 'none'
  zashchitaState.drillPassed = false
  zashchitaState.waveCount = 0
  zashchitaState.animClockSec = 0
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = copy[i]
    copy[i] = copy[j]
    copy[j] = tmp
  }
  return copy
}

export function startZashchitaWave(mode: boolean | ZashchitaWaveMode): void {
  const waveMode: ZashchitaWaveMode =
    typeof mode === 'boolean' ? (mode ? 'drill' : 'standard') : mode
  const isDrill = waveMode === 'drill'
  const isSpyCat = waveMode === 'spy_cat'
  const gs = useGameStore.getState()
  const tier: 1 | 2 | 3 =
    isDrill || isSpyCat
      ? 1
      : gs.shiftNumber >= 4
        ? 3
        : gs.shiftNumber >= 2
          ? 2
          : 1

  const evidenceTemplate = !isDrill
    ? getEvidenceProcessForShift(gs.shiftNumber, gs.archivedIntelIds)
    : null
  const genuineSlots = evidenceTemplate
    ? isSpyCat
      ? 2
      : 3
    : isDrill
      ? 3
      : 4
  const chosenGenuine = isSpyCat
    ? [GENUINE_POOL[0], GENUINE_POOL[3], GENUINE_POOL[4]].slice(0, genuineSlots)
    : shuffle([...GENUINE_POOL]).slice(0, genuineSlots)
  const hostileCount = isSpyCat ? 3 : isDrill ? 2 : tier >= 2 ? 3 : 2
  const chosenHostile = isSpyCat
    ? [...SPY_CAT_HOSTILES]
    : shuffle([...HOSTILE_TEMPLATES[tier]]).slice(0, hostileCount)

  let pidBase = 410 + zashchitaState.waveCount * 20
  const combined: FirewallProcess[] = [
    ...chosenGenuine.map((g, idx) => ({
      pid: pidBase + idx * 3,
      name: g.name,
      port: g.port,
      signature: g.signature,
      cpuPct: g.cpuPct,
      origin: g.origin,
      linkedHardware: g.linkedHardware,
      impactKind: g.impactKind,
      isCiaHostile: false,
      violationReason: null,
      status: 'running' as const,
    })),
    ...(evidenceTemplate
      ? [
          {
            pid: pidBase + 29,
            name: evidenceTemplate.processName,
            port: evidenceTemplate.port,
            signature: evidenceTemplate.signature,
            cpuPct: evidenceTemplate.cpuPct,
            origin: evidenceTemplate.origin,
            linkedHardware: 'INTERNAL CLEAR SKY FILE — [ARCHIVE] OR [KILL]',
            impactKind: 'grid' as const,
            isCiaHostile: false,
            violationReason: null,
            intelKind: 'clear_sky_evidence' as const,
            intelId: evidenceTemplate.intelId,
            intelSummary: evidenceTemplate.summary,
            status: 'running' as const,
          },
        ]
      : []),
    ...chosenHostile.map((h, idx) => ({
      pid: pidBase + 40 + idx * 7,
      name: h.name,
      port: h.port,
      signature: h.signature,
      cpuPct: h.cpuPct,
      origin: h.origin,
      linkedHardware: 'NONE (FORGED HOSTILE PACKET)',
      impactKind: 'grid' as const,
      isCiaHostile: true,
      violationReason: h.reason,
      status: 'running' as const,
    })),
  ]

  zashchitaState.active = true
  zashchitaState.isDrill = isDrill
  zashchitaState.waveMode = waveMode
  zashchitaState.shiftTier = tier
  zashchitaState.processes = isDrill ? combined : shuffle(combined)
  zashchitaState.selectedPid = zashchitaState.processes[0]?.pid ?? null
  zashchitaState.lastOutcome = 'none'
  zashchitaState.waveCount += 1
  zashchitaState.lastFeedback = isSpyCat
    ? 'OPERATION LANGLEY LEAK: PURGE SPY_CAT_GPS, LANGLEY_NODE_04 & BANJO_STREAM!'
    : isDrill
      ? 'TRAINING DRILL: CHECK GOST-84 RULES & [KILL] BOTH CIA INTRUDERS.'
      : `CIA PACKET INTRUSION! PURGE ${hostileCount} HOSTILE PROCESSES BEFORE 100%!`

  gs.setCiaIntrusionState(true, isDrill ? 15 : 10)
}

export function selectZashchitaProcess(pid: number): void {
  zashchitaState.selectedPid = pid
}

export function killZashchitaProcess(pid: number): {
  handled: boolean
  outcome: 'purged' | 'wrong_kill' | 'win'
} {
  if (!zashchitaState.active) {
    return { handled: false, outcome: 'purged' }
  }
  const proc = zashchitaState.processes.find((p) => p.pid === pid)
  if (!proc || proc.status !== 'running') {
    return { handled: false, outcome: 'purged' }
  }

  zashchitaState.selectedPid = pid
  const gs = useGameStore.getState()

  if (proc.isCiaHostile) {
    proc.status = 'purged'
    const remainingHostiles = zashchitaState.processes.filter(
      (p) => p.isCiaHostile && p.status === 'running'
    ).length
    if (remainingHostiles === 0) {
      const wasDrill = zashchitaState.isDrill
      const wasSpyCat = zashchitaState.waveMode === 'spy_cat'
      if (wasDrill) {
        zashchitaState.drillPassed = true
      }
      zashchitaState.active = false
      zashchitaState.isDrill = false
      zashchitaState.waveMode = 'standard'
      zashchitaState.lastOutcome = 'win'
      if (wasSpyCat) {
        zashchitaState.lastFeedback =
          'PENTAGON CAPITULATION! SPY CAT SENT PRE-PULL BRANCH — US DEFENSE LOCKED IN VOLKOV HSE FORMS! RANSOM: 4MM CROOKED HEB-BEAM & 1L BERYOZKA COFFEE (+160 RUB, +1 QUOTA).'
        gs.applyFirewallVictory(160, 1, false, {
          buffSec: 120,
          customLogText:
            'OPERATION LANGLEY LEAK COMPLETE! SPY CAT UPLOADED OLD PRE-PULL BRANCH TO PENTAGON — K.O.M.R.A.D.-84 LOCKED US DEFENSE IN VOLKOV HSE FORMS IN TRIPLICATE! +160 RUB, +1 QUOTA, 120S PARTY APPROVAL.',
          customVoxText: KOMRAD_CYBER_VOX.IMPOSTOR_VICTORY,
        })
      } else {
        zashchitaState.lastFeedback = wasDrill
          ? 'DRILL COMPLETE! ALL CIA INTRUDERS PURGED. NIGHT SHIFT READY.'
          : 'FIREWALL SECURED! ALL CIA INTRUDERS PURGED FROM SECTOR 07.'
        gs.applyFirewallVictory(wasDrill ? 60 : 140, wasDrill ? 0 : 1, wasDrill)
      }
      return { handled: true, outcome: 'win' }
    }

    zashchitaState.lastFeedback = `PURGED ${proc.name}! ${remainingHostiles} CIA HOSTILE${remainingHostiles === 1 ? '' : 'S'} LEFT.`
    return { handled: true, outcome: 'purged' }
  }

  // Clear Sky internal leak file censored obediently ([KILL])
  if (proc.intelKind === 'clear_sky_evidence') {
    proc.status = 'purged'
    zashchitaState.lastFeedback = `CENSORED ${proc.name}! (+15 COMPLIANCE — VOLKOV COMMENDS OBEDIENCE.)`
    gs.recordComplianceDelta(15, `INTERNAL LEAK CENSORED: ${proc.name} (+15 COMPLIANCE)`)
    return { handled: true, outcome: 'purged' }
  }

  // Wrong kill: genuine Soviet process terminated!
  proc.status = 'fault_killed'
  zashchitaState.lastOutcome = zashchitaState.isDrill ? 'drill_mistake' : 'none'
  zashchitaState.lastFeedback = `FAULT! ${proc.name} WAS VALID (${proc.linkedHardware})!`
  gs.applyFirewallWrongKillPenalty(
    proc.impactKind,
    proc.name,
    zashchitaState.isDrill
  )
  return { handled: true, outcome: 'wrong_kill' }
}

export function archiveZashchitaEvidence(pid: number): {
  handled: boolean
  outcome: 'archived' | 'ignored'
} {
  if (!zashchitaState.active) {
    return { handled: false, outcome: 'ignored' }
  }
  const proc = zashchitaState.processes.find((p) => p.pid === pid)
  if (!proc || proc.status !== 'running' || proc.intelKind !== 'clear_sky_evidence') {
    return { handled: false, outcome: 'ignored' }
  }
  zashchitaState.selectedPid = pid
  proc.status = 'archived'
  const gs = useGameStore.getState()
  gs.recordTruthIntelDelta(
    25,
    proc.intelId,
    `CLEAR SKY INTEL ARCHIVED: ${proc.name} (+25 TRUTH)`
  )
  gs.setCiaIntrusionState(true, Math.min(95, gs.ciaIntrusionProgress + 8))
  zashchitaState.lastFeedback = `ARCHIVED ${proc.name}! (+25 TRUTH INTEL — K.O.M.R.A.D.-84 SUSPICIOUS!)`
  return { handled: true, outcome: 'archived' }
}

export function runDiagnosticPacketScan(): void {
  zashchitaState.lastFeedback =
    'GOST-84 SCAN COMPLETE: 0 HOSTILE PACKETS ON SECTOR 07 BUS.'
}

export function isProcessGostCompliant(proc: FirewallProcess, tier: 1 | 2 | 3): boolean {
  if (!VALID_SIGS.has(proc.signature)) return false
  if (!VALID_PORTS.has(proc.port)) return false
  if (/(CIA|USA|USD|FREE|LIBERTY|SIPHON)/i.test(proc.name)) return false
  if (tier >= 2 && proc.cpuPct > 60) return false
  return true
}

export function tickZashchita(dt: number): boolean {
  zashchitaState.animClockSec += dt
  if (!zashchitaState.active) return false

  const gs = useGameStore.getState()
  if (!gs.ciaIntrusionActive) {
    // Sync back if store was cleared externally
    zashchitaState.active = false
    return false
  }

  const defenseMitigation = Math.min(0.45, (gs.powerAllocation.defense / 100) * 0.25)
  const kgbSlowdown = gs.kgbLineActive ? 0.85 : 1.0
  const baseRate = zashchitaState.isDrill
    ? 0.9
    : (1.75 + (gs.shiftNumber - 1) * 0.16) * (1 - defenseMitigation) * kgbSlowdown

  const rawNext = gs.ciaIntrusionProgress + baseRate * dt
  if (zashchitaState.isDrill) {
    // Training drill caps harmlessly at 85% so the player never suffers a breach/strike
    gs.setCiaIntrusionState(true, Math.min(85, rawNext))
    return false
  }

  if (rawNext >= 100) {
    zashchitaState.active = false
    zashchitaState.waveMode = 'standard'
    zashchitaState.lastOutcome = 'breach'
    zashchitaState.lastFeedback =
      'BREACH AT 100%! CIA SABOTAGED CORE CHANNELS & POWER!'
    gs.applyFirewallBreachPenalty()
    return true
  }

  gs.setCiaIntrusionState(true, rawNext)
  return false
}
