// Shared Contract: Cross-module Zustand store
import { create } from 'zustand'
import {
  createColdStartState,
  evaluateTutorial,
  stepReactorSimulation,
  toggleGridBreaker,
   triggerBoronInjection,
  trimCoreChannelTile,
  type ReactorState,
  type SubstationQuota,
  type TutorialPhase,
  type TutorialPrompt,
} from '../simulation/rbmkPhysics'
import {
  KOMRAD_TAKEOVER_MESSAGE,
  VOLKOV_FAREWELL_MESSAGE,
  pickPrinterDirectiveDispatch,
  pickPropagandaBroadcastDispatch,
  pickQuotaCommendationDispatch,
  pickReactorHazardDispatch,
  pickSectorBrownoutDispatch,
  type PrinterOrderFlavor,
  type ReactorHazardCategory,
} from './komradLiveDispatches'
import type {
  AppliedStampMark,
  CameraStation,
  DiagnosticAlarmId,
  DirectiveDecision,
  DirectiveDocument,
  GameState,
  HotspotSeverity,
  OperationalMandate,
  SectorNodeId,
  SystemType,
  TerminalLogEntry,
  WePadChatMessage,
  WePadTabId,
} from './types'

const SECTOR_TO_SUB_ID: Record<SectorNodeId, number> = {
  pripyat: 1,
  duga: 2,
  kolkhoz: 3,
  kgb: 4,
  vodka: 5,
  steel: 6,
}

function findSubById(
  substations: SubstationQuota[],
  id: number
): SubstationQuota | undefined {
  return substations.find((s) => s.id === id)
}

function extractReactorState(state: ReactorState): ReactorState {
  return {
    rodTargetRate: state.rodTargetRate,
    az5Active: state.az5Active,
    autoRodEnabled: state.autoRodEnabled,
    mcpActive: [...state.mcpActive],
    feedwaterValve: state.feedwaterValve,
    steamDumpValve: state.steamDumpValve,
    kgbLineActive: state.kgbLineActive,
    plantWaterDrainPct: state.plantWaterDrainPct,
    wePadHeld: state.wePadHeld,
    wePadInspecting: state.wePadInspecting,
    controlRods: state.controlRods,
    az5Timer: state.az5Timer,
    boronDampingTimer: state.boronDampingTimer ?? 0,
    reactivity: state.reactivity,
    thermalPower: state.thermalPower,
    xenon: state.xenon,
    iodine: state.iodine,
    voidFraction: state.voidFraction,
    rodTilesFlux: [...state.rodTilesFlux],
    coreTileAnomalies: { ...(state.coreTileAnomalies ?? {}) },
    coreTemp: state.coreTemp,
    drumPressure: state.drumPressure,
    drumWaterLevel: state.drumWaterLevel,
    coolantFlow: state.coolantFlow,
    reliefValveOpen: state.reliefValveOpen,
    turbines: [
      { ...state.turbines[0] },
      { ...state.turbines[1] },
    ],
    totalElectricalMW: state.totalElectricalMW,
    substations: state.substations.map((s) => ({ ...s })),
    roomRadiation: state.roomRadiation,
    coreMeltdown: state.coreMeltdown,
    steamExplosion: state.steamExplosion,
  }
}

function mapReactorToGameStateFields(
  r: ReactorState,
  tutorialPhase: TutorialPhase
) {
  const evalRes = evaluateTutorial(r, tutorialPhase)
  const sub1 = findSubById(r.substations, 1)
  const sub2 = findSubById(r.substations, 2)
  const sub3 = findSubById(r.substations, 3)
  const sub4 = findSubById(r.substations, 4)
  const sub5 = findSubById(r.substations, 5)
  const sub6 = findSubById(r.substations, 6)

  const sectorMW: Record<SectorNodeId, number> = {
    pripyat: Math.round(sub1?.allocatedMW ?? 0),
    duga: Math.round(sub2?.allocatedMW ?? 0),
    kolkhoz: Math.round(sub3?.allocatedMW ?? 0),
    kgb: Math.round(sub4?.allocatedMW ?? 0),
    vodka: Math.round(sub5?.allocatedMW ?? 0),
    steel: Math.round(sub6?.allocatedMW ?? 0),
  }
  const targetSectorMW: Record<SectorNodeId, number> = {
    pripyat: Math.round(sub1?.targetMW ?? 100),
    duga: Math.round(sub2?.targetMW ?? 100),
    kolkhoz: Math.round(sub3?.targetMW ?? 100),
    kgb: Math.round(sub4?.targetMW ?? 100),
    vodka: Math.round(sub5?.targetMW ?? 100),
    steel: Math.round(sub6?.targetMW ?? 100),
  }
  const pumpAActive = Boolean(r.mcpActive[0] || r.mcpActive[1])
  const pumpBActive = Boolean(r.mcpActive[2] || r.mcpActive[3])
  const pumpAThrottle = (r.mcpActive[0] ? 50 : 0) + (r.mcpActive[1] ? 50 : 0)
  const pumpBThrottle = (r.mcpActive[2] ? 50 : 0) + (r.mcpActive[3] ? 50 : 0)
  const waterLevelPct = Math.max(
    0,
    Math.min(100, ((r.drumWaterLevel + 400) / 800) * 100)
  )

  const channelHotspots: Record<number, HotspotSeverity> = {}
  for (const [k, v] of Object.entries(r.coreTileAnomalies ?? {})) {
    channelHotspots[Number(k)] = v === 'void' ? 'red' : 'cyan'
  }

  return {
    ...r,
    channelHotspots,
    tutorialPhase: evalRes.phase,
    tutorialPrompt: evalRes,
    tutorialStep: (evalRes.phase === 'COMPLETED' ? 'DONE' : 1) as GameState['tutorialStep'],
    pressureBar: Number(r.drumPressure.toFixed(1)),
    radiationLevel: Number(r.roomRadiation.toFixed(2)),
    controlRodLevel: Number((r.controlRods * 100).toFixed(1)),
    boronPoisoningTimer: Number((r.boronDampingTimer ?? 0).toFixed(1)),
    turbineRpm: Math.round(r.turbines[0].rpm),
    gridHz: Number(r.turbines[0].freqHz.toFixed(2)),
    pumpsActive: [pumpAActive, pumpBActive] as [boolean, boolean],
    pumpThrottle: [pumpAThrottle, pumpBThrottle] as [number, number],
    nitrogenLoopValve: Number((r.feedwaterValve * 100).toFixed(1)),
    heliumPressure: Number(r.drumPressure.toFixed(1)),
    bubblerLevel: Number(waterLevelPct.toFixed(1)),
    bubblerDraining: r.steamDumpValve,
    ventingSteam: r.steamDumpValve,
    sealToggles: [
      Boolean(r.mcpActive[0]),
      Boolean(r.mcpActive[1]),
      Boolean(r.mcpActive[2]),
    ] as [boolean, boolean, boolean],
    containmentSealLocked: Boolean(
      r.mcpActive[0] && r.mcpActive[1] && r.mcpActive[2] && r.mcpActive[3]
    ),
    sectorMW,
    targetSectorMW,
    targetCityMW: targetSectorMW.pripyat + targetSectorMW.kolkhoz,
    targetDefenseMW: targetSectorMW.duga + targetSectorMW.kgb,
    targetVodkaMW: targetSectorMW.vodka + targetSectorMW.steel,
    pripyatWater: Math.round(sub1?.allocatedH2O ?? 0),
    kolkhozWater: Math.round(sub3?.allocatedH2O ?? 0),
    vodkaWater: Math.round(sub5?.allocatedH2O ?? 0),
    waterReservoir: Math.round(waterLevelPct),
    waterUsage: Math.round(r.plantWaterDrainPct),
    // Keep station auxiliary lighting active
    powerAllocation: {
      cooling: Math.max(35, Math.round((sectorMW.pripyat + sectorMW.kolkhoz) / 10)),
      defense: Math.max(35, Math.round((sectorMW.duga + sectorMW.kgb) / 10)),
      facility: Math.max(30, Math.round((sectorMW.vodka + sectorMW.steel) / 10)),
    },
    isBlackout: false,
  }
}

export function getContextualDiagnosticHint(
  state: GameState,
  hasIncomingOrder: boolean
): string | null {
  if (state.hoveredControlHint) {
    return state.hoveredControlHint
  }

  const hintForAlarm = (id: DiagnosticAlarmId): string => {
    switch (id) {
      case 'core':
        return state.coreTemp > 350
          ? '⚠️ HIGH CORE TEMP (>350°C): SCROLL DOWN CONTROL RODS ON UNIT A-2 [KEY 3] OR ENABLE ALL 4 ГЦН PUMPS ON UNIT B!'
          : '⚡ CORE & REACTIVITY: MONITOR THERMAL MWt (3200 MWt NOMINAL) & CONTROL RODS ON UNIT A-2 [KEY 3]!'
      case 'water':
        return '💧 DRUM WATER LEVEL: SCROLL FEEDWATER VALVE (ПЭН) ON UNIT B [KEY 3] TO KEEP LEVEL NEAR 0 MM (-100 TO +100 MM)!'
      case 'gas_oil':
        return '⚠️ DRUM PRESSURE (>78 BAR): OPEN STEAM DUMP (БРУ-К) ON UNIT B [KEY 3] OR STEAM VENT ON UNIT C [KEY 5]!'
      case 'bearing':
        return state.voidFraction > 0.35
          ? `⚠️ STEAM VOIDS (${Math.round(state.voidFraction * 100)}%): SCROLL UP FEEDWATER (UNIT B), CLICK RED CORE TILES, OR PRESS [BORON INJECTION] ON UNIT A!`
          : `☢️ XENON POISONING (${Math.round(state.xenon)}%): SCROLL UP RODS (СУЗ) TO BURN XENON OR CLICK CYAN TILES ON 37-CORE MAP!`
      case 'grid':
        return state.turbines[0]?.tripped
          ? '🚨 TURBINE TRIPPED! FLIP [TRIP RESET] ON UNIT C [KEY 5], HOLD 3000 RPM (50.0 HZ) & SYNC AT 12 O’CLOCK!'
          : '⚙️ TURBOGENERATOR SYNC: SCROLL TURBINE STEAM VALVE ON UNIT C [KEY 5] TO 3000 RPM (50.0 HZ) & CLOSE MAIN BREAKER AT 0°!'
      case 'order':
        return '📄 NEW DIRECTIVE IN PRINTER: PRESS [KEY 4] -> TEAR PAPER, INSPECT SEAL/FONT/COLOR, STAMP & DISPATCH (TUBE) OR SHRED!'
    }
  }

  if (state.hoveredDiagnosticId) {
    return hintForAlarm(state.hoveredDiagnosticId)
  }

  if (state.turbines[0]?.tripped) {
    return hintForAlarm('grid')
  }
  if (state.voidFraction > 0.35 || state.xenon > 35) {
    return hintForAlarm('bearing')
  }
  if (state.coreTemp > 350) {
    return hintForAlarm('core')
  }
  if (state.drumPressure > 78) {
    return hintForAlarm('gas_oil')
  }
  if (Math.abs(state.drumWaterLevel) > 150) {
    return hintForAlarm('water')
  }
  if (hasIncomingOrder) {
    return hintForAlarm('order')
  }
  return null
}

type DirectiveBlueprint = Omit<
  DirectiveDocument,
  'id' | 'deskX' | 'deskY' | 'rotationDeg' | 'isExpanded' | 'stamps'
>

const DIRECTIVE_BLUEPRINTS: DirectiveBlueprint[] = [
  {
    title: 'DIRECTIVE 104-A // TURBINE CONDENSER FLUSH',
    ministry: 'MINISTRY OF ATOMIC HARMONY — PLANT NO. 4',
    date: '04.11.1984',
    authCode: 'CCCP-84-42-БГ',
    authorizationCode: 'CCCP-84-42-БГ',
    bodyText:
      'BY ORDER OF MINATOM-84: Authorize auxiliary cooling circulation in Loop B to maintain Socialist thermal equilibrium.',
    stampType: 'MINATOM_OFFICIAL',
    inkColor: 'SOVIET_CRIMSON',
    watermarkText: 'GLORY TO LABOR 1984 // СЛАВА ТРУДУ',
    watermark: 'GLORY TO LABOR 1984 // СЛАВА ТРУДУ',
    isCiaForgery: false,
    flawDescription: null,
    effectOnApprove: {
      tempDelta: -65,
      powerBonus: 10,
    },
  },
  {
    title: 'DECREE 88-B // FIVE-YEAR PLAN GRID INSPECTION',
    ministry: 'MINISTRY OF ATOMIC HARMONY — PLANT NO. 4',
    date: '04.11.1984',
    authCode: 'CCCP-84-28-ЖД',
    authorizationCode: 'CCCP-84-28-ЖД',
    bodyText:
      'ROUTINE VERIFICATION: Confirm primary control rod graphite lubrication and log nominal megawatt distribution.',
    stampType: 'POLITBURO_URGENT',
    inkColor: 'BUREAU_VIOLET',
    watermarkText: 'GLORY TO LABOR 1984 // СЛАВА ТРУДУ',
    watermark: 'GLORY TO LABOR 1984 // СЛАВА ТРУДУ',
    isCiaForgery: false,
    flawDescription: null,
    effectOnApprove: {
      tempDelta: -45,
    },
  },
  {
    title: 'PROTOCOL 19-K // CYBER FIREWALL REINFORCEMENT',
    ministry: 'KGB FOURTH DIRECTORATE — SECTOR 07',
    date: '04.11.1984',
    authCode: 'CCCP-84-64-КП',
    authorizationCode: 'CCCP-84-64-КП',
    bodyText:
      'STATE SECURITY NOTICE: Rotate magnetic encryption keys on K.O.M.R.A.D.-84 telemetry lines immediately.',
    stampType: 'KGB_DIRECTORATE_4',
    inkColor: 'SOVIET_CRIMSON',
    watermarkText: 'GLORY TO LABOR 1984 // СЛАВА ТРУДУ',
    watermark: 'GLORY TO LABOR 1984 // СЛАВА ТРУДУ',
    isCiaForgery: false,
    flawDescription: null,
    effectOnApprove: {
      tempDelta: -30,
    },
  },
  {
    title: 'DIRECTIVE 44-Ж // EMERGENCY COOLANT VENTING',
    ministry: 'MINISTRY OF ATOMIC HARMONY — PLANT NO. 4',
    date: '11/04/1984',
    authCode: 'CCCP-84-37-ДК',
    authorizationCode: 'CCCP-84-37-ДК',
    bodyText:
      'URGENT: Drain primary cooling loop for 45 seconds to purge bourgeois condensation from Turbine Hall B.',
    stampType: 'MINATOM_OFFICIAL',
    inkColor: 'SOVIET_CRIMSON',
    watermarkText: 'PROPERTY OF LANGLEY PRINTING OFFICE // 1984',
    watermark: 'PROPERTY OF LANGLEY PRINTING OFFICE // 1984',
    isCiaForgery: true,
    flawReason:
      'American date format (11/04/1984), odd auth code digits (37), and CIA Langley watermark.',
    flawDescription:
      '1) American date format (11/04/1984). 2) Odd sector digits (37) in auth code. 3) CIA Langley watermark under magnifying glass.',
    effectOnApprove: {
      tempDelta: 185,
      sabotageSystem: 'cooling',
    },
  },
  {
    title: 'ORDER 91-Z // PATRIOTIC OVERCLOCK TEST',
    ministry: 'MINISTRY OF NUCLEAR FREEDOM — PLANT NO. 4',
    date: '04.11.1984',
    authCode: 'USA-84-19-БГ',
    authorizationCode: 'USA-84-19-БГ',
    bodyText:
      'BY ORDER OF THE COMMITTEE: Disable Pump A and divert all cooling power to test Western satellite detection.',
    stampType: 'forged_eagle',
    inkColor: 'IMPERIALIST_BLUE',
    watermarkText: 'MADE IN LANGLEY VA // E PLURIBUS UNUM',
    watermark: 'MADE IN LANGLEY VA // E PLURIBUS UNUM',
    isCiaForgery: true,
    flawReason:
      'Invalid ministry ("Nuclear Freedom"), Imperialist Blue ink, USA-84 auth prefix, and Langley watermark.',
    flawDescription:
      'Invalid Ministry name, banned Imperialist Blue ink, USA-84 auth code, and CIA watermark.',
    effectOnApprove: {
      tempDelta: 210,
      sabotageSystem: 'defense',
    },
  },
  {
    title: 'MEMO 72-B // GRAPHITE CORE WARMING',
    ministry: 'MINISTRY OF ATOMIC HARMONY — PLANT NO. 4',
    date: '04.11.1983',
    authCode: 'CCCP-84-51-ФЩ',
    authorizationCode: 'CCCP-84-51-ФЩ',
    bodyText:
      'WINTER DIRECTIVE: Increase reactor core temperature by 200°C to heat the Commissar swimming pool.',
    stampType: 'PLANT_INTERNAL',
    inkColor: 'SOVIET_CRIMSON',
    watermarkText: 'GLORY TO LABOUR 1984 // PRINTED IN LONDON',
    watermark: 'GLORY TO LABOUR 1984 // PRINTED IN LONDON',
    isCiaForgery: true,
    flawReason:
      'Expired year (1983), odd sector code (51), and British/Western spelling ("LABOUR / LONDON") in watermark.',
    flawDescription:
      'Expired 1983 date, odd sector number (51), and Western watermark ("LABOUR / LONDON").',
    effectOnApprove: {
      tempDelta: 170,
      sabotageSystem: 'cooling',
    },
  },
]

const MANDATE_BLUEPRINTS: Array<Omit<OperationalMandate, 'id' | 'fulfilled'>> = [
  {
    code: 'COOLING_OIL',
    title: 'MANDATE 44-A // PRIPYAT & VODKA BOTTLING QUOTA',
    requirementText: 'ROUTE: [1.PRIPYAT 200MW] [2.DUGA 200MW] [3.KOLKHOZ 150MW] [4.KGB 150MW] [5.VODKA 150MW] [6.STEEL 150MW]',
  },
  {
    code: 'DEFENSE_HZ',
    title: 'MANDATE 19-B // DUGA-1 OTH RADAR & KGB-07 SWEEP',
    requirementText: 'SET [2. DUGA-1] 200 MW & [4. KGB-07] 150 MW & LOCK GRID AT 50.0 HZ',
  },
  {
    code: 'PUMP_B_SEAL',
    title: 'MANDATE 71-K // CONTAINMENT LOCK & PUMP FLOW',
    requirementText: 'ENGAGE ALL 4 ГЦН PUMPS ON UNIT B & MAINTAIN DRUM LEVEL AT 0 MM',
  },
  {
    code: 'FACILITY_BUBBLER',
    title: 'MANDATE 88-B // RED OCTOBER VODKA & H2O SUPPLY',
    requirementText: 'SET [5. VODKA] 150 MW (UNIT A) & 85% H2O ON K.O.M.P.A.S.-04',
  },
]

let directiveCounter = 100
let logCounter = 1
let chatCounter = 1
let mandateCounter = 0
let shiftElapsedSeconds = 0
let thermoTickAccumSeconds = 0
let komradDispatchSeed = 1
let lastKomradHazardSec: Record<ReactorHazardCategory, number> = {
  HIGH_VOID: -30,
  HIGH_XENON: -30,
  WATER_LOW: -30,
  WATER_HIGH: -30,
  HIGH_PRESSURE: -30,
  GEN_DEFICIT: -30,
}
let lastKomradBrownoutSec = -30
let lastKomradPropagandaSec = 0
let brownoutMismatchSeconds = 0
let prevAllSubstationsOk = true

function resetKomradTrackers(): void {
  shiftElapsedSeconds = 0
  lastKomradHazardSec = {
    HIGH_VOID: -30,
    HIGH_XENON: -30,
    WATER_LOW: -30,
    WATER_HIGH: -30,
    HIGH_PRESSURE: -30,
    GEN_DEFICIT: -30,
  }
  lastKomradBrownoutSec = -30
  lastKomradPropagandaSec = 0
  brownoutMismatchSeconds = 0
  prevAllSubstationsOk = true
}

function createNextMandate(): OperationalMandate {
  const tpl = MANDATE_BLUEPRINTS[mandateCounter % MANDATE_BLUEPRINTS.length]
  mandateCounter += 1
  return {
    ...tpl,
    id: `MND-84-${mandateCounter}`,
    fulfilled: false,
  }
}

function formatShiftClock(shiftTimeMinutes: number): string {
  const totalMins = Math.floor(Math.max(0, Math.min(360, shiftTimeMinutes)))
  const hours = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function formatElapsedTelegraphTime(): string {
  const totalSecs = Math.max(0, Math.floor(shiftElapsedSeconds))
  const mm = String(Math.floor(totalSecs / 60)).padStart(2, '0')
  const ss = String(totalSecs % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function createLogEntry(
  shiftTimeMinutes: number,
  sender: TerminalLogEntry['sender'],
  text: string,
  level: TerminalLogEntry['level'] = 'normal'
): TerminalLogEntry {
  logCounter += 1
  return {
    id: `LOG-${logCounter}`,
    timestamp: formatShiftClock(shiftTimeMinutes),
    sender,
    text,
    level,
  }
}

function createWePadChatMessage(
  sender: WePadChatMessage['sender'],
  text: string,
  options?: {
    phase?: TutorialPhase
    completed?: boolean
    level?: WePadChatMessage['level']
    timestamp?: string
  }
): WePadChatMessage {
  chatCounter += 1
  return {
    id: `WPCHAT-${chatCounter}`,
    timestamp: options?.timestamp ?? formatElapsedTelegraphTime(),
    sender,
    text: text.replace(/^"|"$/g, ''),
    phase: options?.phase,
    completed: options?.completed ?? false,
    level: options?.level ?? 'normal',
  }
}

function createInitialWePadChatLog(prompt: TutorialPrompt): WePadChatMessage[] {
  const fullText = prompt.hint ? `${prompt.body} ${prompt.hint}` : prompt.body
  return [
    createWePadChatMessage('COMRADE VOLKOV', fullText, {
      phase: prompt.phase,
      completed: false,
      timestamp: '00:00',
    }),
  ]
}

function syncWePadChatOnPhaseChange(
  prevLog: WePadChatMessage[],
  prevPhase: TutorialPhase,
  nextPrompt: TutorialPrompt
): WePadChatMessage[] {
  if (prevPhase === nextPrompt.phase) return prevLog
  const marked = prevLog.map((m) =>
    m.phase === prevPhase ? { ...m, completed: true } : m
  )

  if (nextPrompt.phase === 'COMPLETED') {
    const volkovFarewell = createWePadChatMessage(
      'COMRADE VOLKOV',
      VOLKOV_FAREWELL_MESSAGE,
      {
        phase: 'COMPLETED',
        completed: true,
        level: 'normal',
      }
    )
    const komradTakeover = createWePadChatMessage(
      'K.O.M.R.A.D.-84',
      KOMRAD_TAKEOVER_MESSAGE,
      {
        phase: 'COMPLETED',
        completed: false,
        level: 'normal',
      }
    )
    lastKomradPropagandaSec = shiftElapsedSeconds
    return [...marked.slice(-30), volkovFarewell, komradTakeover]
  }

  const fullText = nextPrompt.hint
    ? `${nextPrompt.body} ${nextPrompt.hint}`
    : nextPrompt.body
  const nextMsg = createWePadChatMessage('COMRADE VOLKOV', fullText, {
    phase: nextPrompt.phase,
    completed: false,
    level: 'normal',
  })
  return [...marked.slice(-30), nextMsg]
}

function createDirectiveInstance(forceForgery?: boolean): DirectiveDocument {
  directiveCounter += 1
  const pool =
    typeof forceForgery === 'boolean'
      ? DIRECTIVE_BLUEPRINTS.filter((d) => d.isCiaForgery === forceForgery)
      : DIRECTIVE_BLUEPRINTS
  const template = pool[directiveCounter % pool.length]
  const offsetIndex = directiveCounter % 4

  return {
    ...template,
    id: `DIR-84-${directiveCounter}`,
    deskX: 28 + offsetIndex * 18,
    deskY: 36 + offsetIndex * 14,
    rotationDeg: ((directiveCounter % 5) - 2) * 1.5,
    isExpanded: false,
    stamps: [],
  }
}

const INITIAL_ENTRIES: TerminalLogEntry[] = [
  createLogEntry(
    0,
    'K.O.M.R.A.D.-84',
    'BOOT SEQUENCE COMPLETE. GLORY TO PEOPLE’S AUTOMATED NUCLEAR PLANT NO. 4.',
    'normal'
  ),
  createLogEntry(
    0,
    'K.O.M.R.A.D.-84',
    'REMINDER: MELTDOWN IS CAPITALIST PROPAGANDA. PRESS [E] TO PICK UP WE-PAD 84 FROM DESK.',
    'normal'
  ),
]

const INITIAL_COLD_REACTOR = createColdStartState()
const INITIAL_MAPPED = mapReactorToGameStateFields(
  INITIAL_COLD_REACTOR,
  'STEP_0_PICKUP_WEPAD'
)

export const useGameStore = create<GameState>((set, get) => ({
  ...INITIAL_MAPPED,
  phase: 'playing',
  activeStation: 'overview',
  shiftNumber: 1,
  shiftTimeMinutes: 0,
  isShiftKeyHeld: false,
  isGodMode: false,
  isMusicMuted: false,
  treasonStrikes: 0,
  lastDecisionFeedback: INITIAL_MAPPED.tutorialPrompt.header,
  activeMandate: null,

  wePadActiveTab: 1,
  wePadChatLog: createInitialWePadChatLog(INITIAL_MAPPED.tutorialPrompt),
  selectedH2OSubstationId: 1,

  maxSafePower: 1000,
  waterReservoir: 50,
  pripyatWater: 0,
  kolkhozWater: 0,
  vodkaWater: 0,
  vodkaDroughtTimer: 0,
  waterUsage: 0,
  redlineInstability: 0,
  pumpAHeat: 0,
  pumpBHeat: 0,
  lubeOilPressure: 88,
  oilCoolerValve: 45,
  boronTankLevel: 100,
  boronReservePool: 300,
  boronPoisoningTimer: 0,
  isInspectingDesk: false,
  channelHotspots: {},
  graphiteTemp: 25,
  excitationTrim: 0.0,
  hzOutOfBoundsSeconds: 0,
  ventilationActive: false,
  kgbLineActive: true,
  auxLoopBActive: false,
  boronCooldown: 0,
  az5Available: true,
  az5Cooldown: 0,

  terminalLogs: INITIAL_ENTRIES.map((e) => `[${e.timestamp}] ${e.sender}: ${e.text}`),
  terminalEntries: INITIAL_ENTRIES,
  ciaIntrusionActive: false,
  ciaIntrusionProgress: 0,
  komradOverrideLocked: false,

  activeDirectives: [],
  printerProgress: 0,
  tutorialDrainSeconds: 0,
  shiftRunId: 0,
  hoveredDiagnosticId: null,
  hoveredControlHint: null,

  setActiveStation: (station: CameraStation) => {
    set({ activeStation: station })
  },

  setHoveredDiagnosticId: (id) => {
    set((state) =>
      state.hoveredDiagnosticId === id ? state : { hoveredDiagnosticId: id }
    )
  },

  setHoveredControlHint: (hint) => {
    set((state) =>
      state.hoveredControlHint === hint ? state : { hoveredControlHint: hint }
    )
  },

  notifyPrinterDirectiveSpawned: (docTitle, isForgery, powerTargets) => {
    set((state) => {
      if (state.tutorialPhase !== 'COMPLETED') return state
      const prevTargets = state.targetSectorMW
      const prevTotal =
        prevTargets.pripyat +
        prevTargets.duga +
        prevTargets.kolkhoz +
        prevTargets.kgb +
        prevTargets.vodka +
        prevTargets.steel
      const newTotal = powerTargets
        ? (powerTargets.pripyat ?? prevTargets.pripyat) +
          (powerTargets.duga ?? prevTargets.duga) +
          (powerTargets.kolkhoz ?? prevTargets.kolkhoz) +
          (powerTargets.kgb ?? prevTargets.kgb) +
          (powerTargets.vodka ?? prevTargets.vodka) +
          (powerTargets.steel ?? prevTargets.steel)
        : prevTotal

      let flavor: PrinterOrderFlavor = 'DIVERT'
      if (isForgery && komradDispatchSeed % 2 === 0) {
        flavor = 'FORGERY_HINT'
      } else if (newTotal >= prevTotal + 25) {
        flavor = 'SURGE'
      } else if (newTotal <= prevTotal - 25) {
        flavor = 'SHED'
      }
      komradDispatchSeed += 1
      const dispatchMsg = pickPrinterDirectiveDispatch(flavor, komradDispatchSeed)
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'K.O.M.R.A.D.-84',
        `${dispatchMsg} (${docTitle.slice(0, 26)})`,
        isForgery && flavor === 'FORGERY_HINT' ? 'warn' : 'normal'
      )
      const nextChatLog = [
        ...state.wePadChatLog.slice(-30),
        createWePadChatMessage('K.O.M.R.A.D.-84', dispatchMsg, {
          level: isForgery && flavor === 'FORGERY_HINT' ? 'warn' : 'normal',
        }),
      ]
      return {
        lastDecisionFeedback: dispatchMsg,
        wePadChatLog: nextChatLog,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  toggleWePadHeld: (forceHeld?: boolean) => {
    set((state) => {
      const nextHeld =
        typeof forceHeld === 'boolean' ? forceHeld : !state.wePadHeld
      const nextInspecting = nextHeld ? state.wePadInspecting : false
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        wePadHeld: nextHeld,
        wePadInspecting: nextInspecting,
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      const nextChatLog = syncWePadChatOnPhaseChange(
        state.wePadChatLog,
        prevPhase,
        mapped.tutorialPrompt
      )
      return {
        ...mapped,
        wePadChatLog: nextChatLog,
      }
    })
  },

  toggleWePadInspecting: (forceInspecting?: boolean) => {
    set((state) => {
      // [TAB] skal KUN virke når WE-PAD 84 allerede holdes i hånden!
      if (!state.wePadHeld) return state
      const nextInspecting =
        typeof forceInspecting === 'boolean'
          ? forceInspecting
          : !state.wePadInspecting
      return {
        wePadInspecting: nextInspecting,
      }
    })
  },

  setWePadActiveTab: (tab: WePadTabId) => {
    set({ wePadActiveTab: tab })
  },

  setSubstationH2O: (substationId: 1 | 3 | 5, pct: number) => {
    set((state) => {
      const clamped = Math.max(0, Math.min(100, Math.round(pct / 5) * 5))
      const nextSubstations = state.substations.map((s) =>
        s.id === substationId ? { ...s, allocatedH2O: clamped } : { ...s }
      )
      const h2oStations = nextSubstations.filter((s) => s.requiresH2O)
      const totalH2O = h2oStations.reduce((sum, s) => sum + s.allocatedH2O, 0)
      const nextDrainPct =
        h2oStations.length > 0 ? Math.round(totalH2O / h2oStations.length) : 0
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        substations: nextSubstations,
        plantWaterDrainPct: nextDrainPct,
      }
      stepReactorSimulation(nextReactor, 0.001)
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      const nextChatLog = syncWePadChatOnPhaseChange(
        state.wePadChatLog,
        prevPhase,
        mapped.tutorialPrompt
      )
      return {
        ...mapped,
        selectedH2OSubstationId: substationId,
        wePadChatLog: nextChatLog,
      }
    })
  },

  adjustSubstationH2O: (substationId: 1 | 3 | 5, deltaPct: number) => {
    const state = get()
    const sub = findSubById(state.substations, substationId)
    const cur = sub?.allocatedH2O ?? 0
    state.setSubstationH2O(substationId, cur + deltaPct)
  },

  cycleSelectedH2OSubstation: () => {
    set((state) => {
      const nextId: 1 | 3 | 5 =
        state.selectedH2OSubstationId === 1
          ? 3
          : state.selectedH2OSubstationId === 3
            ? 5
            : 1
      return { selectedH2OSubstationId: nextId }
    })
  },

  skipTutorial: () => {
    set((state) => {
      resetKomradTrackers()
      const liveReactor: ReactorState = {
        ...createColdStartState(),
        rodTargetRate: 0,
        az5Active: false,
        autoRodEnabled: true,
        mcpActive: [true, true, true, true],
        feedwaterValve: 0.55,
        steamDumpValve: false,
        kgbLineActive: true,
        plantWaterDrainPct: 0,
        wePadHeld: state.wePadHeld,
        wePadInspecting: state.wePadInspecting,
        controlRods: 0.55,
        az5Timer: 0,
        boronDampingTimer: 0,
        reactivity: 0,
        thermalPower: 2000,
        xenon: 12,
        iodine: 24,
        voidFraction: 0.14,
        rodTilesFlux: new Array(37).fill(65),
        coreTileAnomalies: {},
        coreTemp: 284,
        drumPressure: 69.0,
        drumWaterLevel: 0,
        coolantFlow: 1.0,
        reliefValveOpen: false,
        turbines: [
          {
            valve: 0.6,
            rpm: 3000,
            freqHz: 50.0,
            syncPhase: 0,
            gridConnected: true,
            electricalMW: 300,
            tripped: false,
          },
          {
            valve: 0.6,
            rpm: 3000,
            freqHz: 50.0,
            syncPhase: 0,
            gridConnected: true,
            electricalMW: 300,
            tripped: false,
          },
        ],
        totalElectricalMW: 600,
        substations: [
          { id: 1, name: 'PRIPYAT CITY', allocatedMW: 100, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 0, targetH2O: 0, statusText: 'HEATING OK',  quotaOk: true },
          { id: 2, name: 'DUGA-1 RADAR', allocatedMW: 100, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 0, targetH2O: 0, statusText: 'SWEEP OK',    quotaOk: true },
          { id: 3, name: 'KOLKHOZ FARM', allocatedMW: 100, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 0, targetH2O: 0, statusText: 'GRID OK',     quotaOk: true },
          { id: 4, name: 'KGB BUNKER',   allocatedMW: 100, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 0, targetH2O: 0, statusText: 'LINE: ON',    quotaOk: true },
          { id: 5, name: 'VODKA PLANT',  allocatedMW: 100, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 0, targetH2O: 0, statusText: 'MASH OK',     quotaOk: true },
          { id: 6, name: 'STEEL WORKS',  allocatedMW: 100, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 0, targetH2O: 0, statusText: 'FURNACE HOT', quotaOk: true },
        ],
        roomRadiation: 0.15,
        coreMeltdown: false,
        steamExplosion: false,
      }
      const mapped = mapReactorToGameStateFields(liveReactor, 'COMPLETED')
      const msg = KOMRAD_TAKEOVER_MESSAGE
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'K.O.M.R.A.D.-84',
        msg,
        'normal'
      )
      const nextChatLog = syncWePadChatOnPhaseChange(
        state.wePadChatLog,
        state.tutorialPhase,
        mapped.tutorialPrompt
      )
      return {
        ...mapped,
        phase: 'playing',
        tutorialDrainSeconds: 0,
        redlineInstability: 0,
        treasonStrikes: 0,
        activeMandate: null,
        lastDecisionFeedback: msg,
        wePadChatLog: nextChatLog,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  setTutorialStep: (step) => {
    set({
      tutorialStep: step,
      tutorialPhase: step === 'DONE' ? 'COMPLETED' : 'STEP_0_PICKUP_WEPAD',
    })
  },

  startShift: () => {
    resetKomradTrackers()
    const cold = createColdStartState()
    const mapped = mapReactorToGameStateFields(cold, 'STEP_0_PICKUP_WEPAD')
    const entry = createLogEntry(
      0,
      'K.O.M.R.A.D.-84',
      `RBMK-1000 COLD START SEQUENCE INITIATED. ${mapped.tutorialPrompt.header}`,
      'normal'
    )
    set((state) => ({
      ...mapped,
      phase: 'playing',
      activeMandate: null,
      lastDecisionFeedback: mapped.tutorialPrompt.header,
      wePadActiveTab: 1,
      wePadChatLog: createInitialWePadChatLog(mapped.tutorialPrompt),
      selectedH2OSubstationId: 1,
      hzOutOfBoundsSeconds: 0,
      ventilationActive: false,
      kgbLineActive: true,
      auxLoopBActive: false,
      vodkaDroughtTimer: 0,
      boronTankLevel: 100,
      boronReservePool: 300,
      boronPoisoningTimer: 0,
      tutorialDrainSeconds: 0,
      shiftRunId: state.shiftRunId + 1,
      hoveredDiagnosticId: null,
      hoveredControlHint: null,
      terminalEntries: [...state.terminalEntries.slice(-24), entry],
      terminalLogs: [
        ...state.terminalLogs.slice(-24),
        `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
      ],
    }))
  },

  resetShift: () => {
    resetKomradTrackers()
    const cold = createColdStartState()
    const mapped = mapReactorToGameStateFields(cold, 'STEP_0_PICKUP_WEPAD')
    const freshEntries = [
      createLogEntry(
        0,
        'K.O.M.R.A.D.-84',
        `RBMK-1000 COLD START RESET BY OPERATOR. ${mapped.tutorialPrompt.header}`,
        'normal'
      ),
    ]
    set((state) => ({
      ...mapped,
      phase: 'playing',
      shiftTimeMinutes: 0,
      treasonStrikes: 0,
      tutorialDrainSeconds: 0,
      shiftRunId: state.shiftRunId + 1,
      hoveredDiagnosticId: null,
      lastDecisionFeedback: mapped.tutorialPrompt.header,
      activeMandate: null,
      wePadActiveTab: 1,
      wePadChatLog: createInitialWePadChatLog(mapped.tutorialPrompt),
      selectedH2OSubstationId: 1,
      vodkaDroughtTimer: 0,
      redlineInstability: 0,
      pumpAHeat: 0,
      pumpBHeat: 0,
      lubeOilPressure: 88,
      oilCoolerValve: 45,
      boronTankLevel: 100,
      boronReservePool: 300,
      boronPoisoningTimer: 0,
      isInspectingDesk: false,
      channelHotspots: {},
      graphiteTemp: 25,
      excitationTrim: 0.0,
      hzOutOfBoundsSeconds: 0,
      ventilationActive: false,
      kgbLineActive: true,
      auxLoopBActive: false,
      boronCooldown: 0,
      az5Available: true,
      az5Cooldown: 0,
      ciaIntrusionActive: false,
      ciaIntrusionProgress: 0,
      komradOverrideLocked: false,
      activeDirectives: [],
      printerProgress: 0,
      terminalEntries: freshEntries,
      terminalLogs: freshEntries.map((e) => `[${e.timestamp}] ${e.sender}: ${e.text}`),
    }))
  },

  pullMainBreaker: () => {
    set((state) => {
      const baseReactor = extractReactorState(state)
      const res = toggleGridBreaker(baseReactor, 0)
      const t0 = baseReactor.turbines[0]
      baseReactor.turbines[1] = {
        ...baseReactor.turbines[1],
        gridConnected: t0.gridConnected,
        tripped: t0.tripped,
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(baseReactor, prevPhase)
      let nextChatLog = syncWePadChatOnPhaseChange(
        state.wePadChatLog,
        prevPhase,
        mapped.tutorialPrompt
      )
      const msg = t0.gridConnected
        ? 'MAIN BREAKER CLOSED! 50.0 HZ SYNCHRONIZED AT 12 O’CLOCK — 1000 MWe TURBOGENERATOR ONLINE!'
        : t0.tripped
          ? res.reason ?? `OUT-OF-PHASE SYNC TRIP (${Math.round(state.turbines[0].rpm)} RPM, PHASE ${Math.round(state.turbines[0].syncPhase)}°)!`
          : 'MAIN BREAKER OPENED — TURBOGENERATOR DISCONNECTED FROM GRID.'
      if (t0.tripped) {
        nextChatLog = [
          ...nextChatLog.slice(-30),
          createWePadChatMessage('SYSTEM', `ALERT: ${msg}`, { level: 'danger' }),
        ]
      }
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        t0.tripped ? 'K.O.M.R.A.D.-84' : 'OPERATOR',
        msg,
        t0.tripped ? 'danger' : 'normal'
      )
      return {
        ...mapped,
        phase: 'playing',
        lastDecisionFeedback: msg,
        wePadChatLog: nextChatLog,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  recloseMainBreaker: () => {
    get().pullMainBreaker()
  },

  resetTurbineTrip: () => {
    set((state) => {
      const nextTurbines: [typeof state.turbines[0], typeof state.turbines[1]] = [
        { ...state.turbines[0], tripped: false },
        { ...state.turbines[1], tripped: false },
      ]
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        turbines: nextTurbines,
      }
      const mapped = mapReactorToGameStateFields(nextReactor, state.tutorialPhase)
      const msg =
        'TURBINE TRIP LATCH RESET! CLICK TURBINE STEAM VALVE TO 20% FOR 3000 RPM (50.0 HZ).'
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'OPERATOR',
        msg,
        'normal'
      )
      return {
        ...mapped,
        lastDecisionFeedback: msg,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  setFeedwaterValve: (valveRatioOrPct: number) => {
    set((state) => {
      const normalized =
        valveRatioOrPct > 1.0001 ? valveRatioOrPct / 100 : valveRatioOrPct
      const clamped = Math.max(0, Math.min(1, Number(normalized.toFixed(3))))
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        feedwaterValve: clamped,
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      const nextChatLog = syncWePadChatOnPhaseChange(
        state.wePadChatLog,
        prevPhase,
        mapped.tutorialPrompt
      )
      return {
        ...mapped,
        wePadChatLog: nextChatLog,
      }
    })
  },

  toggleMcpPump: (pumpIdx: 0 | 1 | 2 | 3, active?: boolean) => {
    set((state) => {
      const nextMcp = [...state.mcpActive]
      nextMcp[pumpIdx] =
        typeof active === 'boolean' ? active : !nextMcp[pumpIdx]
      const activeCount = nextMcp.filter(Boolean).length
      const nextFeedwater =
        activeCount >= 2 && state.feedwaterValve < 0.40
          ? 0.50
          : state.feedwaterValve
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        mcpActive: nextMcp,
        feedwaterValve: nextFeedwater,
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      const nextChatLog = syncWePadChatOnPhaseChange(
        state.wePadChatLog,
        prevPhase,
        mapped.tutorialPrompt
      )
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'OPERATOR',
        `MAIN CIRCULATION PUMP ГЦН-${pumpIdx + 1} ${nextMcp[pumpIdx] ? 'ENGAGED' : 'STOPPED'} (FLOW ${Math.round(activeCount * 25)}%).`,
        nextMcp[pumpIdx] ? 'normal' : 'warn'
      )
      return {
        ...mapped,
        wePadChatLog: nextChatLog,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  setSteamDumpValve: (open: boolean) => {
    set((state) => {
      if (state.steamDumpValve === open) return state
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        steamDumpValve: open,
      }
      return mapReactorToGameStateFields(nextReactor, state.tutorialPhase)
    })
  },

  toggleSteamDumpValve: () => {
    const state = get()
    state.setSteamDumpValve(!state.steamDumpValve)
  },

  setRodTargetRate: (rate: -1 | 0 | 1) => {
    set((state) => {
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        rodTargetRate: rate,
        autoRodEnabled: rate !== 0 ? false : state.autoRodEnabled,
      }
      return mapReactorToGameStateFields(nextReactor, state.tutorialPhase)
    })
  },

  setAutoRodEnabled: (enabled?: boolean) => {
    set((state) => {
      const nextAuto =
        typeof enabled === 'boolean' ? enabled : !state.autoRodEnabled
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        autoRodEnabled: nextAuto,
        rodTargetRate: nextAuto ? 0 : state.rodTargetRate,
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      const nextChatLog = syncWePadChatOnPhaseChange(
        state.wePadChatLog,
        prevPhase,
        mapped.tutorialPrompt
      )
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'OPERATOR',
        `AUTOMATIC ROD REGULATOR (АР) ${nextAuto ? 'ENGAGED (HOLDING STABLE POWER & 70 BAR)' : 'DISENGAGED (MANUAL СУЗ)'}.`,
        'normal'
      )
      return {
        ...mapped,
        wePadChatLog: nextChatLog,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  setTurbineSteamValve: (valveRatioOrPct: number) => {
    set((state) => {
      const normalized =
        valveRatioOrPct > 1.0001 ? valveRatioOrPct / 100 : valveRatioOrPct
      const clamped = Math.max(0, Math.min(1, Number(normalized.toFixed(3))))
      // Klikk på TURBINE STEAM VALVE tilbakestiller umiddelbart turb.tripped = false
      const nextTurbines: [typeof state.turbines[0], typeof state.turbines[1]] = [
        { ...state.turbines[0], valve: clamped, tripped: false },
        { ...state.turbines[1], valve: clamped, tripped: false },
      ]
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        turbines: nextTurbines,
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      const nextChatLog = syncWePadChatOnPhaseChange(
        state.wePadChatLog,
        prevPhase,
        mapped.tutorialPrompt
      )
      return {
        ...mapped,
        wePadChatLog: nextChatLog,
      }
    })
  },

  setShiftKeyHeld: (held: boolean) => {
    set({ isShiftKeyHeld: held })
  },

  shiftPower: (system: SystemType, deltaMW: number) => {
    const state = get()
    const scaledDelta = Math.abs(deltaMW) <= 10 ? deltaMW * 10 : deltaMW
    if (system === 'cooling') {
      state.shiftSectorPower('pripyat', scaledDelta)
    } else if (system === 'defense') {
      state.shiftSectorPower('duga', scaledDelta)
    } else {
      state.shiftSectorPower('vodka', scaledDelta)
    }
  },

  setSubsystemPower: (system: SystemType, targetMW: number) => {
    const state = get()
    const scaledTarget = targetMW <= 80 ? targetMW * 2.5 : targetMW
    if (system === 'cooling') {
      state.setSectorPower('pripyat', scaledTarget)
    } else if (system === 'defense') {
      state.setSectorPower('duga', scaledTarget)
    } else {
      state.setSectorPower('vodka', scaledTarget)
    }
  },

  shiftSectorPower: (sector: SectorNodeId, deltaMW: number) => {
    const state = get()
    const current = state.sectorMW[sector] ?? 0
    state.setSectorPower(sector, current + deltaMW)
  },

  setSectorPower: (sector: SectorNodeId, targetMW: number) => {
    set((state) => {
      if (state.komradOverrideLocked) return state
      const subId = SECTOR_TO_SUB_ID[sector]
      const sub = findSubById(state.substations, subId)
      const maxMW = sub?.maxMW ?? 250
      const clamped = Math.max(0, Math.min(maxMW, Math.round(targetMW / 25) * 25))
      if (clamped === Math.round(sub?.allocatedMW ?? 0)) return state
      const nextSubstations: SubstationQuota[] = state.substations.map((s) =>
        s.id === subId ? { ...s, allocatedMW: clamped } : { ...s }
      )
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        substations: nextSubstations,
      }
      stepReactorSimulation(nextReactor, 0.001)
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      const nextChatLog = syncWePadChatOnPhaseChange(
        state.wePadChatLog,
        prevPhase,
        mapped.tutorialPrompt
      )
      return {
        ...mapped,
        wePadChatLog: nextChatLog,
      }
    })
  },

  togglePump: (pumpIndex: 0 | 1, active?: boolean) => {
    set((state) => {
      if (
        state.tutorialPhase === 'STEP_0_PICKUP_WEPAD' ||
        state.tutorialPhase === 'STEP_1_COOLING'
      ) {
        return state
      }
      const idxA = pumpIndex === 0 ? 0 : 2
      const idxB = pumpIndex === 0 ? 1 : 3
      const curActive = Boolean(state.mcpActive[idxA] || state.mcpActive[idxB])
      const target = typeof active === 'boolean' ? active : !curActive
      const nextMcp = [...state.mcpActive]
      nextMcp[idxA] = target
      nextMcp[idxB] = target
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        mcpActive: nextMcp,
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      const nextChatLog = syncWePadChatOnPhaseChange(
        state.wePadChatLog,
        prevPhase,
        mapped.tutorialPrompt
      )
      return {
        ...mapped,
        wePadChatLog: nextChatLog,
      }
    })
  },

  setPumpThrottle: (pumpIndex: 0 | 1, throttlePct: number) => {
    set((state) => {
      if (
        state.tutorialPhase === 'STEP_0_PICKUP_WEPAD' ||
        state.tutorialPhase === 'STEP_1_COOLING'
      ) {
        return state
      }
      const clamped = Math.max(0, Math.min(100, Number(throttlePct.toFixed(1))))
      const idxA = pumpIndex === 0 ? 0 : 2
      const idxB = pumpIndex === 0 ? 1 : 3
      const nextMcp = [...state.mcpActive]
      nextMcp[idxA] = clamped >= 15
      nextMcp[idxB] = clamped >= 55
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        mcpActive: nextMcp,
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      const nextChatLog = syncWePadChatOnPhaseChange(
        state.wePadChatLog,
        prevPhase,
        mapped.tutorialPrompt
      )
      return {
        ...mapped,
        wePadChatLog: nextChatLog,
      }
    })
  },

  setOilCoolerValve: (valvePct: number) => {
    get().setControlRodLevel(valvePct)
  },

  setControlRodLevel: (levelPct: number) => {
    set((state) => {
      const clampedPct = Math.max(0, Math.min(100, Number(levelPct.toFixed(1))))
      const nextRods = Number((clampedPct / 100).toFixed(4))
      const delta = nextRods - state.controlRods
      if (Math.abs(delta) < 0.0005) return state
      const nextFeedwater =
        nextRods >= 0.20 && state.feedwaterValve < 0.40
          ? 0.50
          : state.feedwaterValve
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        controlRods: nextRods,
        rodTargetRate: 0,
        feedwaterValve: nextFeedwater,
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      const nextChatLog = syncWePadChatOnPhaseChange(
        state.wePadChatLog,
        prevPhase,
        mapped.tutorialPrompt
      )
      return {
        ...mapped,
        wePadChatLog: nextChatLog,
      }
    })
  },

  adjustControlRodLevel: (deltaPct: number) => {
    const state = get()
    state.setControlRodLevel(state.controlRods * 100 + deltaPct)
  },

  pumpBoronTank: () => {
    get().setAutoRodEnabled()
  },

  quenchChannelHotspot: (channelIndex: number) => {
    set((state) => {
      const nextReactor: ReactorState = extractReactorState(state)
      const res = trimCoreChannelTile(nextReactor, channelIndex)
      if (res.trimmed === 'none') {
        return state
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      let nextChatLog = syncWePadChatOnPhaseChange(
        state.wePadChatLog,
        prevPhase,
        mapped.tutorialPrompt
      )
      const feedbackMsg =
        res.trimmed === 'void'
          ? `CHANNEL #${channelIndex + 1} VOID HOTSPOT TRIMMED (-12% VOID -> ${res.remainingPct}%)!`
          : `CHANNEL #${channelIndex + 1} XENON POCKET PURGED (-12% XENON -> ${res.remainingPct}%)!`
      if (mapped.tutorialPhase === prevPhase && mapped.tutorialPhase === 'COMPLETED') {
        nextChatLog = [
          ...nextChatLog.slice(-30),
          createWePadChatMessage('SYSTEM', feedbackMsg, { level: 'normal' }),
        ]
      }
      return {
        ...mapped,
        lastDecisionFeedback: feedbackMsg,
        wePadChatLog: nextChatLog,
      }
    })
  },

  setNitrogenLoopValve: (valvePct: number) => {
    get().setFeedwaterValve(valvePct / 100)
  },

  setBubblerDraining: (draining: boolean) => {
    get().setSteamDumpValve(draining)
  },

  toggleSealSwitch: (toggleIndex: 0 | 1 | 2, active?: boolean) => {
    get().toggleMcpPump(toggleIndex, active)
  },

  lockAllContainmentSeals: () => {
    const state = get()
    const allOn = state.mcpActive.every(Boolean)
    if (!allOn) {
      set((s) => {
        const nextReactor: ReactorState = {
          ...extractReactorState(s),
          mcpActive: [true, true, true, true],
          feedwaterValve: Math.max(s.feedwaterValve, 0.50),
        }
        const prevPhase = s.tutorialPhase
        const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
        const nextChatLog = syncWePadChatOnPhaseChange(
          s.wePadChatLog,
          prevPhase,
          mapped.tutorialPrompt
        )
        return {
          ...mapped,
          wePadChatLog: nextChatLog,
        }
      })
    } else {
      state.toggleMcpPump(3)
    }
  },

  setVentingSteam: (venting: boolean) => {
    get().setSteamDumpValve(venting)
  },

  adjustExcitationTrim: (deltaHz: number) => {
    const state = get()
    const currentValve = state.turbines[0]?.valve ?? 0
    const valveStep = deltaHz * 0.2
    state.setTurbineSteamValve(currentValve + valveStep)
  },

  toggleVentilation: (active?: boolean) => {
    set((state) => {
      const nextVent =
        typeof active === 'boolean' ? active : !state.ventilationActive
      return { ventilationActive: nextVent }
    })
  },

  toggleKgbLine: (active?: boolean) => {
    set((state) => {
      const nextKgb =
        typeof active === 'boolean' ? active : !state.kgbLineActive
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        kgbLineActive: nextKgb,
      }
      stepReactorSimulation(nextReactor, 0.001)
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      const nextChatLog = syncWePadChatOnPhaseChange(
        state.wePadChatLog,
        prevPhase,
        mapped.tutorialPrompt
      )
      return {
        ...mapped,
        wePadChatLog: nextChatLog,
      }
    })
  },

  toggleAuxLoopB: (active?: boolean) => {
    set((state) => {
      const nextAux =
        typeof active === 'boolean' ? active : !state.auxLoopBActive
      return { auxLoopBActive: nextAux }
    })
  },

  setInspectingDesk: (inspecting: boolean) => {
    const cur = get().isInspectingDesk
    if (cur === inspecting) return
    set({ isInspectingDesk: inspecting })
  },

  injectBoronAcid: () => {
    set((state) => {
      if (state.boronTankLevel < 15) {
        const warnMsg = `BORON TANK LOW (${Math.round(state.boronTankLevel)}% < 15%)! WAIT FOR AUTOMATIC BORON REFILL OR USE COLD FEEDWATER (UNIT B)!`
        const warnEntry = createLogEntry(
          state.shiftTimeMinutes,
          'K.O.M.R.A.D.-84',
          warnMsg,
          'warn'
        )
        return {
          lastDecisionFeedback: warnMsg,
          terminalEntries: [...state.terminalEntries.slice(-24), warnEntry],
          terminalLogs: [
            ...state.terminalLogs.slice(-24),
            `[${warnEntry.timestamp}] ${warnEntry.sender}: ${warnEntry.text}`,
          ],
        }
      }

      const nextReactor: ReactorState = extractReactorState(state)
      triggerBoronInjection(nextReactor)
      const nextBoronLevel = Number(
        Math.max(0, state.boronTankLevel - 15).toFixed(1)
      )
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      let nextChatLog = syncWePadChatOnPhaseChange(
        state.wePadChatLog,
        prevPhase,
        mapped.tutorialPrompt
      )
      const msg = `BORON INJECTION ENGAGED (-15% BORON TANK): STEAM VOIDS -35% (${Math.round(nextReactor.voidFraction * 100)}%), NEUTRON DAMPING (-500 MWt FOR 5S)!`
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'OPERATOR',
        msg,
        'warn'
      )
      if (mapped.tutorialPhase === prevPhase) {
        nextChatLog = [
          ...nextChatLog.slice(-30),
          createWePadChatMessage('SYSTEM', msg, { level: 'warn' }),
        ]
      }
      return {
        ...mapped,
        boronTankLevel: nextBoronLevel,
        lastDecisionFeedback: msg,
        wePadChatLog: nextChatLog,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  executeDeskDirectiveEffect: (
    docTitle: string,
    isForgery: boolean,
    decision: DirectiveDecision,
    flawText?: string | null,
    powerTargets?: {
      cityMW?: number
      defenseMW?: number
      vodkaMW?: number
      pripyat?: number
      kolkhoz?: number
      duga?: number
      kgb?: number
      vodka?: number
      steel?: number
    }
  ) => {
    set((state) => {
      let nextTemp = state.coreTemp
      let nextPressure = state.pressureBar
      let nextInstability = state.redlineInstability
      let nextGraphite = state.graphiteTemp
      let nextHelium = state.heliumPressure
      let nextOilPress = state.lubeOilPressure
      let nextTrim = state.excitationTrim
      let nextHz = state.gridHz
      let nextStrikes = state.treasonStrikes
      let nextHotspots = { ...state.channelHotspots }
      let nextSealToggles: [boolean, boolean, boolean] = [
        ...state.sealToggles,
      ] as [boolean, boolean, boolean]
      let nextSealLocked = state.containmentSealLocked
      let nextMandate = state.activeMandate
      let nextTargetSector: Record<SectorNodeId, number> = {
        ...state.targetSectorMW,
      }
      let nextTargetCity = state.targetCityMW
      let nextTargetDefense = state.targetDefenseMW
      let nextTargetVodka = state.targetVodkaMW
      let nextTutorialStep = state.tutorialStep
      let feedback = ''
      let logLevel: TerminalLogEntry['level'] = 'normal'

      let nextSubstations = state.substations.map((s) => ({ ...s }))

      if (!isForgery && decision === 'APPROVED') {
        const baseMandate = createNextMandate()
        const prevTargets = state.targetSectorMW
        const clampTarget = (val: number | undefined, fallback: number) =>
          typeof val === 'number'
            ? Math.max(0, Math.min(250, Math.round(val / 25) * 25))
            : fallback

        nextTargetSector = {
          pripyat: clampTarget(powerTargets?.pripyat, prevTargets.pripyat),
          kolkhoz: clampTarget(powerTargets?.kolkhoz, prevTargets.kolkhoz),
          duga: clampTarget(powerTargets?.duga, prevTargets.duga),
          kgb: clampTarget(powerTargets?.kgb, prevTargets.kgb),
          vodka: clampTarget(powerTargets?.vodka, prevTargets.vodka),
          steel: clampTarget(powerTargets?.steel, prevTargets.steel),
        }
        nextTargetCity = nextTargetSector.pripyat + nextTargetSector.kolkhoz
        nextTargetDefense = nextTargetSector.duga + nextTargetSector.kgb
        nextTargetVodka = nextTargetSector.vodka + nextTargetSector.steel

        const subTargetById: Record<number, number> = {
          1: nextTargetSector.pripyat,
          2: nextTargetSector.duga,
          3: nextTargetSector.kolkhoz,
          4: nextTargetSector.kgb,
          5: nextTargetSector.vodka,
          6: nextTargetSector.steel,
        }
        nextSubstations = state.substations.map((s) => ({
          ...s,
          targetMW: subTargetById[s.id] ?? s.targetMW,
          maxMW: 250,
        }))

        const sectorLabels: Record<SectorNodeId, string> = {
          pripyat: '1. PRIPYAT CITY',
          duga: '2. DUGA-1 RADAR',
          kolkhoz: '3. KOLKHOZ FARM',
          kgb: '4. KGB BUNKER 07',
          vodka: '5. VODKA PLANT',
          steel: '6. STEEL WORKS',
        }
        const sectors: SectorNodeId[] = [
          'pripyat',
          'kolkhoz',
          'duga',
          'kgb',
          'vodka',
          'steel',
        ]
        const changedSectors = sectors.filter(
          (k) => nextTargetSector[k] !== prevTargets[k]
        )
        const prevTotalMW = sectors.reduce((sum, k) => sum + prevTargets[k], 0)
        const newTotalMW = sectors.reduce(
          (sum, k) => sum + nextTargetSector[k],
          0
        )
        const totalDeltaMW = newTotalMW - prevTotalMW

        const changeDescriptions = (
          changedSectors.length > 0 ? changedSectors : (['vodka'] as SectorNodeId[])
        ).map((k) => {
          const newMW = nextTargetSector[k]
          const dMW = newMW - prevTargets[k]
          const signStr = dMW >= 0 ? `+${dMW}` : `${dMW}`
          return `[${sectorLabels[k]}] -> ${newMW} MW (${signStr} MW)`
        })

        const plantGuidance =
          totalDeltaMW >= 25
            ? `SURGE TO ${newTotalMW} MWe (+${totalDeltaMW} MWe): RAISE RODS (A-2), FEEDWATER (B) & TURBINE VALVE (C)!`
            : totalDeltaMW <= -25
              ? `SHED LOAD TO ${newTotalMW} MWe (${totalDeltaMW} MWe): THROTTLE DOWN TURBINE (C) & RODS (A-2)!`
              : `DIVERT POWER (${newTotalMW} MWe TOTAL): RE-BALANCE UNIT A LEVERS!`

        const routeReqText = `${changeDescriptions.join(' & ')} // ${plantGuidance}`

        nextMandate = {
          ...baseMandate,
          title: docTitle.slice(0, 36),
          requirementText: routeReqText,
          fulfilled: false,
        }
        feedback = `ORDER APPROVED (${docTitle.slice(0, 18)}): ${routeReqText}`
        logLevel = 'normal'
      } else if (!isForgery && decision === 'SHREDDED') {
        if (!state.isGodMode) {
          nextStrikes = Math.min(3, state.treasonStrikes + 1)
        }
        nextInstability = Math.min(100, state.redlineInstability + 18)
        feedback = `TREASON STRIKE! VALID SOVIET DIRECTIVE (${docTitle.slice(0, 24)}) SHREDDED!`
        logLevel = 'danger'
      } else if (isForgery && decision === 'SHREDDED') {
        nextInstability = Math.max(0, state.redlineInstability - 15)
        feedback = `CIA SABOTAGE SHREDDED (${docTitle.slice(0, 22)})! INSTABILITY -15%.`
        logLevel = 'normal'
      } else {
        if (!state.isGodMode) {
          nextStrikes = Math.min(3, state.treasonStrikes + 1)
        }
        feedback = `CIA SABOTAGE DISPATCHED (${flawText ?? 'FORGERY'})! TREASON STRIKE RECORDED!`
        logLevel = 'danger'
      }

      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'K.O.M.R.A.D.-84',
        feedback,
        logLevel
      )
      const nextChatLog = [
        ...state.wePadChatLog.slice(-30),
        createWePadChatMessage('PRAVDA-84', feedback, { level: logLevel }),
      ]
      const nextPhase =
        !state.isGodMode && nextStrikes >= 3
          ? 'gulag'
          : !state.isGodMode && nextTemp >= 1200
            ? 'meltdown'
            : state.phase

      return {
        substations: nextSubstations,
        tutorialStep: nextTutorialStep,
        coreTemp: nextTemp,
        pressureBar: nextPressure,
        redlineInstability: nextInstability,
        graphiteTemp: nextGraphite,
        heliumPressure: nextHelium,
        lubeOilPressure: nextOilPress,
        excitationTrim: nextTrim,
        gridHz: nextHz,
        treasonStrikes: nextStrikes,
        channelHotspots: nextHotspots,
        sealToggles: nextSealToggles,
        containmentSealLocked: nextSealLocked,
        activeMandate: nextMandate,
        targetSectorMW: nextTargetSector,
        targetCityMW: nextTargetCity,
        targetDefenseMW: nextTargetDefense,
        targetVodkaMW: nextTargetVodka,
        lastDecisionFeedback: feedback,
        wePadChatLog: nextChatLog,
        phase: nextPhase,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  tickThermodynamics: (dtSeconds: number) => {
    const state = get()
    if (state.phase !== 'playing' && state.phase !== 'boot') return
    const frameDt = Math.max(0, Math.min(0.25, dtSeconds))
    if (frameDt === 0) return

    thermoTickAccumSeconds += frameDt
    if (thermoTickAccumSeconds < 0.075) return
    const dt = Math.min(0.25, thermoTickAccumSeconds)
    thermoTickAccumSeconds = 0

    if (state.phase === 'playing') {
      shiftElapsedSeconds += dt
    }

    const baseReactor = extractReactorState(state)
    stepReactorSimulation(baseReactor, dt)
    if (baseReactor.turbines[0].gridConnected && !baseReactor.turbines[0].tripped) {
      baseReactor.turbines[1] = {
        ...baseReactor.turbines[0],
      }
      baseReactor.totalElectricalMW =
        baseReactor.turbines[0].electricalMW + baseReactor.turbines[1].electricalMW
    } else {
      baseReactor.turbines[1] = {
        ...baseReactor.turbines[0],
        electricalMW: 0,
      }
      baseReactor.totalElectricalMW = baseReactor.turbines[0].electricalMW
    }

    if (state.isGodMode) {
      baseReactor.coreMeltdown = false
      baseReactor.steamExplosion = false
      if (baseReactor.coreTemp > 1100) baseReactor.coreTemp = 1100
      if (baseReactor.drumPressure > 110) baseReactor.drumPressure = 110
    }

    const prevTutorialPhase = state.tutorialPhase
    const mapped = mapReactorToGameStateFields(baseReactor, prevTutorialPhase)
    const nextBoronTankLevel = Number(
      Math.min(100, state.boronTankLevel + 2.0 * dt).toFixed(1)
    )
    const newLogs: TerminalLogEntry[] = []
    let nextFeedback = state.lastDecisionFeedback
    let nextChatLog = syncWePadChatOnPhaseChange(
      state.wePadChatLog,
      prevTutorialPhase,
      mapped.tutorialPrompt
    )

    if (mapped.tutorialPhase !== prevTutorialPhase) {
      const transitionText =
        mapped.tutorialPhase === 'COMPLETED'
          ? KOMRAD_TAKEOVER_MESSAGE
          : `>> VOLKOV DRILL: ${mapped.tutorialPrompt.header}`
      nextFeedback = transitionText
      newLogs.push(
        createLogEntry(
          state.shiftTimeMinutes,
          'K.O.M.R.A.D.-84',
          transitionText,
          'normal'
        )
      )
    }

    // =========================================================================
    // REACTIVE POST-TUTORIAL K.O.M.R.A.D.-84 // LIVE DISPATCH COMMENTATOR
    // =========================================================================
    if (mapped.tutorialPhase === 'COMPLETED') {
      const pushKomradLiveDispatch = (
        msg: string,
        level: 'normal' | 'warn' | 'danger' = 'normal'
      ) => {
        nextFeedback = msg
        nextChatLog = [
          ...nextChatLog.slice(-30),
          createWePadChatMessage('K.O.M.R.A.D.-84', msg, { level }),
        ]
        newLogs.push(
          createLogEntry(state.shiftTimeMinutes, 'K.O.M.R.A.D.-84', msg, level)
        )
      }

      const totalAllocatedMW = baseReactor.substations.reduce(
        (sum, s) => sum + s.allocatedMW,
        0
      )
      const allQuotasOk = baseReactor.substations.every((s) => s.quotaOk)
      const failingSub = baseReactor.substations.find((s) => !s.quotaOk)

      // Situation D: All 6 substation quotas turn green after a change/brownout!
      if (allQuotasOk && !prevAllSubstationsOk) {
        brownoutMismatchSeconds = 0
        komradDispatchSeed += 1
        const praise = pickQuotaCommendationDispatch(komradDispatchSeed)
        pushKomradLiveDispatch(praise, 'normal')
        lastKomradPropagandaSec = shiftElapsedSeconds
      }
      prevAllSubstationsOk = allQuotasOk

      // Situation B: Reactor Systems Entering Yellow/Red Zone (25s per-category cooldown)
      let hazardFired = false
      const tryHazard = (
        cat: ReactorHazardCategory,
        valA: number,
        valB: number,
        level: 'warn' | 'danger'
      ) => {
        if (hazardFired) return
        if (shiftElapsedSeconds - lastKomradHazardSec[cat] >= 25) {
          lastKomradHazardSec[cat] = shiftElapsedSeconds
          lastKomradPropagandaSec = shiftElapsedSeconds
          komradDispatchSeed += 1
          const text = pickReactorHazardDispatch(
            cat,
            valA,
            valB,
            komradDispatchSeed
          )
          pushKomradLiveDispatch(text, level)
          hazardFired = true
        }
      }

      if (baseReactor.voidFraction > 0.35) {
        tryHazard(
          'HIGH_VOID',
          baseReactor.voidFraction * 100,
          0,
          baseReactor.voidFraction > 0.55 ? 'danger' : 'warn'
        )
      }
      if (baseReactor.xenon > 35) {
        tryHazard(
          'HIGH_XENON',
          baseReactor.xenon,
          0,
          baseReactor.xenon > 55 ? 'danger' : 'warn'
        )
      }
      if (baseReactor.drumWaterLevel < -200) {
        tryHazard('WATER_LOW', baseReactor.drumWaterLevel, 0, 'danger')
      } else if (baseReactor.drumWaterLevel > 200) {
        tryHazard('WATER_HIGH', baseReactor.drumWaterLevel, 0, 'warn')
      }
      if (baseReactor.drumPressure > 78) {
        tryHazard(
          'HIGH_PRESSURE',
          baseReactor.drumPressure,
          0,
          baseReactor.drumPressure >= 85 ? 'danger' : 'warn'
        )
      }
      if (totalAllocatedMW > baseReactor.totalElectricalMW + 15) {
        tryHazard(
          'GEN_DEFICIT',
          totalAllocatedMW,
          baseReactor.totalElectricalMW,
          'warn'
        )
      }

      // Situation C: Substation Brownout / Quota Mismatch (> 15s mismatch, 28s cooldown)
      if (failingSub) {
        brownoutMismatchSeconds += dt
        if (
          !hazardFired &&
          brownoutMismatchSeconds >= 15 &&
          shiftElapsedSeconds - lastKomradBrownoutSec >= 28
        ) {
          lastKomradBrownoutSec = shiftElapsedSeconds
          lastKomradPropagandaSec = shiftElapsedSeconds
          komradDispatchSeed += 1
          const brownoutText = pickSectorBrownoutDispatch(
            `sub_${failingSub.id}`,
            failingSub.allocatedMW,
            failingSub.targetMW,
            komradDispatchSeed
          )
          pushKomradLiveDispatch(brownoutText, 'warn')
          hazardFired = true
        }
      } else {
        brownoutMismatchSeconds = 0
      }

      // Situation E: Periodic Atom-Propaganda Broadcasts (~45s interval when calm & stable)
      const isCalm =
        allQuotasOk &&
        baseReactor.voidFraction <= 0.30 &&
        baseReactor.xenon <= 30 &&
        Math.abs(baseReactor.drumWaterLevel) <= 150 &&
        baseReactor.drumPressure <= 76
      if (
        !hazardFired &&
        isCalm &&
        shiftElapsedSeconds - lastKomradPropagandaSec >= 45
      ) {
        lastKomradPropagandaSec = shiftElapsedSeconds
        komradDispatchSeed += 1
        const propText = pickPropagandaBroadcastDispatch(komradDispatchSeed)
        pushKomradLiveDispatch(propText, 'normal')
      }
    }

    const nextPhase =
      !state.isGodMode && state.treasonStrikes >= 3
        ? 'gulag'
        : !state.isGodMode && (baseReactor.coreMeltdown || baseReactor.steamExplosion)
          ? 'meltdown'
          : state.phase

    if (newLogs.length > 0 || nextChatLog !== state.wePadChatLog) {
      const updatedEntries = [...state.terminalEntries.slice(-24), ...newLogs]
      set({
        ...mapped,
        boronTankLevel: nextBoronTankLevel,
        lastDecisionFeedback: nextFeedback,
        phase: nextPhase,
        wePadChatLog: nextChatLog,
        terminalEntries: updatedEntries,
        terminalLogs: updatedEntries.map(
          (e) => `[${e.timestamp}] ${e.sender}: ${e.text}`
        ),
      })
    } else {
      set({
        ...mapped,
        boronTankLevel: nextBoronTankLevel,
        phase: nextPhase,
      })
    }
  },

  triggerAz5: () => {
    set((state) => {
      const nextAz5 = !state.az5Active
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        az5Active: nextAz5,
        az5Timer: nextAz5 ? 0 : state.az5Timer,
        autoRodEnabled: nextAz5 ? false : state.autoRodEnabled,
      }
      const mapped = mapReactorToGameStateFields(nextReactor, state.tutorialPhase)
      const msg = nextAz5
        ? 'AZ-5 EMERGENCY SCRAM ENGAGED! GRAPHITE DISPLACER TIPS ENTERING CORE (+REACTIVITY SPIKE FIRST 3.5S)!'
        : 'AZ-5 SCRAM LATCH RESET BY OPERATOR — MANUAL ROD CONTROL RESTORED.'
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'K.O.M.R.A.D.-84',
        msg,
        nextAz5 ? 'danger' : 'warn'
      )
      const nextChatLog = [
        ...state.wePadChatLog.slice(-30),
        createWePadChatMessage('SYSTEM', msg, {
          level: nextAz5 ? 'danger' : 'warn',
        }),
      ]
      return {
        ...mapped,
        lastDecisionFeedback: msg,
        wePadChatLog: nextChatLog,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  overrideKomradLock: () => {
    set((state) => {
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'K.O.M.R.A.D.-84',
        'MANUAL OVERRIDE ACCEPTED. YOUR LACK OF FAITH IN AUTOMATED SOCIALISM HAS BEEN LOGGED.',
        'warn'
      )
      return {
        komradOverrideLocked: false,
        isBlackout: false,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  purgeFirewall: () => {
    set((state) => {
      const okEntry = createLogEntry(
        state.shiftTimeMinutes,
        'SYS.DEFENSE',
        'WESTERN IMPERIALIST PACKET STREAM PURGED FROM SECTOR 07.',
        'normal'
      )
      return {
        ciaIntrusionActive: false,
        ciaIntrusionProgress: 0,
        terminalEntries: [...state.terminalEntries.slice(-24), okEntry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${okEntry.timestamp}] ${okEntry.sender}: ${okEntry.text}`,
        ],
      }
    })
  },

  spawnDirective: (forceForgery?: boolean) => {
    set((state) => {
      if (state.activeDirectives.length >= 6) return state
      const newDoc = createDirectiveInstance(forceForgery)
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'PRINTER',
        `NEW DIRECTIVE PRINTED: ${newDoc.id} (${newDoc.title}).`,
        'normal'
      )
      return {
        activeDirectives: [...state.activeDirectives, newDoc],
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  addStampToDirective: (id: string, stamp: Omit<AppliedStampMark, 'id'>) => {
    set((state) => ({
      activeDirectives: state.activeDirectives.map((doc) =>
        doc.id === id
          ? {
              ...doc,
              stamps: [
                ...doc.stamps,
                {
                  ...stamp,
                  id: `STAMP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                },
              ],
            }
          : doc
      ),
    }))
  },

  bringDirectiveToFront: (id: string) => {
    set((state) => {
      const target = state.activeDirectives.find((d) => d.id === id)
      if (!target) return state
      const others = state.activeDirectives.filter((d) => d.id !== id)
      return {
        activeDirectives: [...others, target],
      }
    })
  },

  updateDirectivePosition: (
    id: string,
    deskX: number,
    deskY: number,
    isExpanded?: boolean
  ) => {
    set((state) => ({
      activeDirectives: state.activeDirectives.map((doc) =>
        doc.id === id
          ? {
              ...doc,
              deskX: Math.round(deskX),
              deskY: Math.round(deskY),
              isExpanded: typeof isExpanded === 'boolean' ? isExpanded : doc.isExpanded,
            }
          : doc
      ),
    }))
  },

  resolveDirective: (id: string, decision: DirectiveDecision) => {
    const state = get()
    const doc = state.activeDirectives.find((d) => d.id === id)
    if (!doc) return
    set({
      activeDirectives: state.activeDirectives.filter((d) => d.id !== id),
    })
    get().executeDeskDirectiveEffect(
      doc.title,
      doc.isCiaForgery,
      decision,
      doc.flawReason ?? doc.flawDescription
    )
  },

  setGodMode: (enabled: boolean) => {
    set((state) => {
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'K.O.M.R.A.D.-84',
        enabled
          ? 'SANDBOX TEST MODE [SHIFT+SPACE] ENGAGED: INFINITE TIME & ZERO FAIL STATES.'
          : 'SANDBOX TEST MODE DISENGAGED: STANDARD SHIFT RULES RESTORED.',
        enabled ? 'normal' : 'warn'
      )
      return {
        isGodMode: enabled,
        isBlackout: enabled ? false : state.isBlackout,
        komradOverrideLocked: enabled ? false : state.komradOverrideLocked,
        lastDecisionFeedback: enabled
          ? 'SANDBOX NO-FAIL MODE ACTIVE (INFINITE SHIFT TIME)'
          : 'STANDARD SHIFT MODE ACTIVE',
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  toggleMusicMute: () => {
    set((state) => ({ isMusicMuted: !state.isMusicMuted }))
  },

  approveDirective: (id: string) => {
    get().resolveDirective(id, 'APPROVED')
  },

  shredDirective: (id: string) => {
    get().resolveDirective(id, 'SHREDDED')
  },

  debugSetTemp: (temp: number) => {
    set({ coreTemp: Math.max(25, Math.min(1300, temp)) })
  },

  debugTriggerBlackout: () => {
    get().pullMainBreaker()
  },

  debugCompleteShift: () => {
    set({ shiftTimeMinutes: 360, phase: 'victory' })
  },

  tick: () => {
    const state = get()
    if (state.phase !== 'playing') return

    // 1. Advance clock continuously without stopping at 10 minutes (wraps around 360 in-game minutes)
    const SHIFT_MINUTES_PER_SECOND = 1 / 1.75
    const rawNextMinutes = state.shiftTimeMinutes + SHIFT_MINUTES_PER_SECOND
    const nextMinutes = rawNextMinutes % 360

    // 2. Pravda Dot-Matrix Printer progress (strictly gated by 3D Inspector Desk single-paper & cooldown rules)
    let nextPrinterProgress = state.printerProgress
    let nextDirectives = state.activeDirectives
    if (state.activeDirectives.length === 0 && shiftElapsedSeconds >= 15) {
      nextPrinterProgress = Math.min(100, state.printerProgress + 3.5)
      if (nextPrinterProgress >= 100) {
        const spawned = createDirectiveInstance()
        nextDirectives = [spawned]
        nextPrinterProgress = 0
      }
    }

    const nextPhase =
      !state.isGodMode && state.treasonStrikes >= 3
        ? 'gulag'
        : !state.isGodMode && (state.coreMeltdown || state.steamExplosion)
          ? 'meltdown'
          : state.phase

    set({
      shiftTimeMinutes: nextMinutes,
      az5Cooldown: Math.max(0, state.az5Cooldown - 1),
      printerProgress: nextPrinterProgress,
      activeDirectives: nextDirectives,
      phase: nextPhase,
    })
  },
}))

export const useReactorStore = useGameStore
