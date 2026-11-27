import { useGameStore } from '../../../shared/useGameStore'

export interface ClearSkyActInfo {
  shiftNumber: 1 | 2 | 3
  actLabel: string
  codename: string
  briefingLine: string
  intelId: 'CLEAR_SKY_LOG' | 'DUGA_DUMP_84' | 'VOLKOV_MEMO_RAW'
  processName: 'CLEAR_SKY_LOG' | 'DUGA_DUMP_84' | 'VOLKOV_MEMO_RAW'
  port: number
  signature: string
  cpuPct: number
  origin: string
  summary: string
}

export const CLEAR_SKY_ACTS: Record<1 | 2 | 3, ClearSkyActInfo> = {
  1: {
    shiftNumber: 1,
    actLabel: 'ACT I',
    codename: 'ROUTINE & DUGA PULSE',
    briefingLine:
      'ACT I // SHIFT 1: ROUTINE QUOTAS ACTIVE. ANOMALOUS DUGA-1 POWER PULSES LOGGED ON ARCHIVE BUS.',
    intelId: 'CLEAR_SKY_LOG',
    processName: 'CLEAR_SKY_LOG',
    port: 1917,
    signature: 'SSR-OK',
    cpuPct: 38,
    origin: 'INT // ARCHIVE-84',
    summary:
      'Predecessor log: Duga-1 surges masked core thermal spikes before last operator vanished.',
  },
  2: {
    shiftNumber: 2,
    actLabel: 'ACT II',
    codename: 'OPERATION LANGLEY LEAK',
    briefingLine:
      'ACT II // SHIFT 2: DUGA & KGB DEMAND RISING. WATCH FOR LANGLEY INTERCEPTS & HIDDEN TELEMETRY.',
    intelId: 'DUGA_DUMP_84',
    processName: 'DUGA_DUMP_84',
    port: 84,
    signature: 'GOST-84',
    cpuPct: 47,
    origin: 'INT // DUGA-TRUNK',
    summary:
      'Duga telemetry: Plant No. 4 carries hidden carrier wave masking steam void instability.',
  },
  3: {
    shiftNumber: 3,
    actLabel: 'ACT III',
    codename: 'PROPAGANDA VS PHYSICS',
    briefingLine:
      'ACT III // SHIFT 3 (FINAL NIGHT): REACH 06:00 TO DECIDE SECTOR 84 FATE — OBEY OR EXPOSE CLEAR SKY.',
    intelId: 'VOLKOV_MEMO_RAW',
    processName: 'VOLKOV_MEMO_RAW',
    port: 330,
    signature: 'GOST-84',
    cpuPct: 54,
    origin: 'INT // VOLKOV-BOX',
    summary:
      'Directive 84-Z: Conceal graphite flaws until 06:00; prioritize Duga over Pripyat.',
  },
}

const GRID_EVAL_INTERVAL_SEC = 45

let announcedShift = 0
let gridEvalTimerSec = 0

export function getClearSkyAct(shiftNumber: number): ClearSkyActInfo {
  const clamped = (shiftNumber <= 1 ? 1 : shiftNumber >= 3 ? 3 : 2) as 1 | 2 | 3
  return CLEAR_SKY_ACTS[clamped]
}

export function getEvidenceProcessForShift(
  shiftNumber: number,
  archivedIntelIds: readonly string[]
): ClearSkyActInfo | null {
  const act = getClearSkyAct(shiftNumber)
  if (!archivedIntelIds.includes(act.intelId)) {
    return act
  }
  const fallback = ([1, 2, 3] as const)
    .map((s) => CLEAR_SKY_ACTS[s])
    .find((candidate) => !archivedIntelIds.includes(candidate.intelId))
  return fallback ?? null
}

export function resetClearSkyCampaign(): void {
  announcedShift = 0
  gridEvalTimerSec = 0
}

export function tickClearSkyCampaign(dt: number): void {
  const gs = useGameStore.getState()
  if (
    gs.phase !== 'playing' ||
    !gs.isShiftControlReady ||
    gs.tutorialPhase !== 'COMPLETED' ||
    gs.shiftDebriefActive ||
    gs.campaignEnding !== null
  ) {
    return
  }

  const act = getClearSkyAct(gs.shiftNumber)
  if (announcedShift !== act.shiftNumber) {
    announcedShift = act.shiftNumber
    gs.pushKomradCyberDispatch(
      act.briefingLine,
      act.shiftNumber === 3 ? 'warn' : 'normal',
      'K.O.M.R.A.D.-84',
      undefined,
      false
    )
  }

  gridEvalTimerSec += dt
  if (gridEvalTimerSec < GRID_EVAL_INTERVAL_SEC) {
    return
  }
  gridEvalTimerSec = 0

  const pripyatOk =
    gs.targetSectorMW.pripyat > 0 && gs.sectorMW.pripyat >= gs.targetSectorMW.pripyat
  const highStress =
    gs.coreTemp >= 500 || gs.sectorMW.duga >= gs.targetSectorMW.duga

  if (pripyatOk && highStress) {
    gs.recordTruthIntelDelta(
      5,
      undefined,
      'PRIPYAT CIVILIAN GRID PROTECTED UNDER DUGA LOAD (+5 TRUTH)'
    )
    return
  }

  const dugaKgbAlloc = gs.sectorMW.duga + gs.sectorMW.kgb
  const dugaKgbTarget = gs.targetSectorMW.duga + gs.targetSectorMW.kgb
  if (
    dugaKgbAlloc >= dugaKgbTarget + 15 &&
    gs.sectorMW.pripyat < gs.targetSectorMW.pripyat - 10
  ) {
    gs.recordComplianceDelta(
      5,
      'POWER DIVERTED TO DUGA/KGB OVER PRIPYAT (+5 COMPLIANCE)'
    )
  }
}
