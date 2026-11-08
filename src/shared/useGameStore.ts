// Shared Contract: Cross-module Zustand store
import { create } from 'zustand'
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
} from './types'

export function getContextualDiagnosticHint(
  state: GameState,
  hasIncomingOrder: boolean
): string | null {
  const hintForAlarm = (id: DiagnosticAlarmId): string => {
    switch (id) {
      case 'core':
        return '⚡ HIGH CORE TEMP: TURN [PUMP A/B] ON UNIT A [KEY 1] OR [HELIUM-N2] ON UNIT B [KEY 3] — OR CLICK RED RBMK TILES!'
      case 'water':
        return '💧 ZONE WATER LOW: REDUCE SIPHONING PUMP ON UNIT A [KEY 1] — OR PULL & HOLD [BUBBLER DRAIN] ON UNIT B [KEY 3] TO RETURN H2O!'
      case 'gas_oil':
        return state.lubeOilPressure < 30 && state.heliumPressure <= 65
          ? '⚠️ LUBE OIL THIN (<25%): PRESS [KEY 3] -> DIAL DOWN [OIL COOLER VALVE] ON UNIT A-2 TO LET OIL COOL & RECOVER PRESSURE!'
          : '⚠️ HELIUM LOOP SATURATED (>68 BAR): PRESS [KEY 3] -> DIAL DOWN [HELIUM-N2] WHEEL & FLIP ON 4 [SEAL SCRUBBERS]!'
      case 'bearing':
        return '🔥 PUMP BEARINGS HOT: PRESS [KEY 3] -> TURN UP [OIL COOLER VALVE] ON UNIT A-2 (IF OIL PRESS >30%) OR REDUCE WATER PUMPS!'
      case 'grid':
        return state.isBlackout
          ? '🚨 BLACKOUT! MAIN BREAKER TRIPPED: PRESS [KEY 5] -> TUNE [50HZ RHEOSTAT] TO 50.0 HZ, THEN PULL UP [MAIN BREAKER] KNIFE-SWITCH!'
          : '⚙️ 50HZ GRID DRIFT: PRESS [KEY 5] -> DRAG CENTER [50HZ RHEOSTAT] DIAL TO LOCK 50.0 HZ!'
      case 'order':
        return '📄 NEW DIRECTIVE IN PRINTER: PRESS [KEY 4] -> TEAR PAPER, INSPECT SEAL/FONT/COLOR, STAMP & DISPATCH (TUBE) OR SHRED!'
    }
  }

  if (state.hoveredDiagnosticId) {
    return hintForAlarm(state.hoveredDiagnosticId)
  }

  if (state.isBlackout) {
    return hintForAlarm('grid')
  }
  if (state.coreTemp > 520) {
    return hintForAlarm('core')
  }
  if (Math.abs(state.gridHz - 50.0) > 0.8) {
    return hintForAlarm('grid')
  }
  if (
    state.pripyatWater < 45 ||
    state.kolkhozWater < 45 ||
    state.vodkaWater < 45
  ) {
    return hintForAlarm('water')
  }
  if (state.heliumPressure > 65 || state.lubeOilPressure < 30) {
    return hintForAlarm('gas_oil')
  }
  if (20 + Math.max(state.pumpAHeat, state.pumpBHeat) > 75) {
    return hintForAlarm('bearing')
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
    requirementText: 'ROUTE: [1.PRIPYAT 20MW] [2.KOLKHOZ 15MW] [3.DUGA 20MW] [4.KGB 15MW] [5.VODKA 15MW] [6.STEEL 15MW]',
  },
  {
    code: 'DEFENSE_HZ',
    title: 'MANDATE 19-B // DUGA-1 OTH RADAR & KGB-07 SWEEP',
    requirementText: 'SET [3. DUGA-1] >= 25 MW & [4. KGB-07] >= 20 MW & TRIM GRID TO 49.5-50.5 HZ',
  },
  {
    code: 'PUMP_B_SEAL',
    title: 'MANDATE 71-K // CONTAINMENT LOCK & PUMP B FLOW',
    requirementText: 'CRANK COOLING PUMP B >= 70% (UNIT A) & LOCK ALL 3 SEALS (UNIT B)',
  },
  {
    code: 'FACILITY_BUBBLER',
    title: 'MANDATE 88-B // RED OCTOBER VODKA & BUBBLER DRAIN',
    requirementText: 'SET [5. VODKA] >= 25 MW (UNIT A) & DRAIN BUBBLER H2O < 45% (UNIT B)',
  },
]

let directiveCounter = 100
let logCounter = 1
let mandateCounter = 0
let hotspotAccumulator = 0
let shiftElapsedSeconds = 0
let vodkaWarningTimer = 0
let thermoTickAccumSeconds = 0
let pumpATripped = false
let pumpBTripped = false
let vodkaDroughtSpikeApplied = false

function createNextMandate(): OperationalMandate {
  const tpl = MANDATE_BLUEPRINTS[mandateCounter % MANDATE_BLUEPRINTS.length]
  mandateCounter += 1
  return {
    ...tpl,
    id: `MND-84-${mandateCounter}`,
    fulfilled: false,
  }
}

function isMandateSatisfied(state: GameState, _mandate: OperationalMandate): boolean {
  const sectors: SectorNodeId[] = ['pripyat', 'kolkhoz', 'duga', 'kgb', 'vodka', 'steel']
  return sectors.every((k) => state.sectorMW[k] === state.targetSectorMW[k])
}

function formatShiftClock(shiftTimeMinutes: number): string {
  const totalMins = Math.floor(Math.max(0, Math.min(360, shiftTimeMinutes)))
  const hours = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
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
    'REMINDER: MELTDOWN IS CAPITALIST PROPAGANDA. DRAG POWER LEVERS DIRECTLY TO ROUTE MW.',
    'normal'
  ),
]

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'boot',
  activeStation: 'overview',
  shiftNumber: 1,
  shiftTimeMinutes: 0,
  isShiftKeyHeld: false,
  isGodMode: false,
  isMusicMuted: false,
  treasonStrikes: 0,
  lastDecisionFeedback: null,
  activeMandate: null,

  coreTemp: 330,
  pressureBar: 48,
  radiationLevel: 0.4,
  maxSafePower: 110,
  powerAllocation: {
    cooling: 35,
    defense: 35,
    facility: 30,
  },
  sectorMW: {
    pripyat: 20,
    kolkhoz: 15,
    duga: 20,
    kgb: 15,
    vodka: 15,
    steel: 15,
  },
  targetSectorMW: {
    pripyat: 20,
    kolkhoz: 15,
    duga: 20,
    kgb: 15,
    vodka: 15,
    steel: 15,
  },
  targetCityMW: 35,
  targetDefenseMW: 35,
  targetVodkaMW: 30,
  waterReservoir: 85,
  pripyatWater: 85,
  kolkhozWater: 85,
  vodkaWater: 85,
  vodkaDroughtTimer: 0,
  waterUsage: 48,
  redlineInstability: 0,
  isBlackout: false,
  pumpsActive: [true, false],
  pumpThrottle: [80, 0],
  pumpAHeat: 38,
  pumpBHeat: 0,
  lubeOilPressure: 88,
  oilCoolerValve: 45,
  boronTankLevel: 100,
  boronReservePool: 300,
  boronPoisoningTimer: 0,
  isInspectingDesk: false,
  channelHotspots: {},
  graphiteTemp: 320,
  nitrogenLoopValve: 42,
  heliumPressure: 46,
  bubblerLevel: 24,
  bubblerDraining: false,
  sealToggles: [true, true, true],
  containmentSealLocked: true,
  ventingSteam: false,
  turbineRpm: 3000,
  gridHz: 50.0,
  excitationTrim: 0.0,
  hzOutOfBoundsSeconds: 0,
  ventilationActive: false,
  kgbLineActive: false,
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
  tutorialStep: 1,
  tutorialDrainSeconds: 0,
  shiftRunId: 0,
  hoveredDiagnosticId: null,

  setActiveStation: (station: CameraStation) => {
    set({ activeStation: station })
  },

  setHoveredDiagnosticId: (id) => {
    set((state) =>
      state.hoveredDiagnosticId === id ? state : { hoveredDiagnosticId: id }
    )
  },

  skipTutorial: () => {
    set((state) => {
      if (state.tutorialStep === 'DONE') return state
      hotspotAccumulator = 0
      shiftElapsedSeconds = 0
      pumpATripped = false
      pumpBTripped = false
      vodkaDroughtSpikeApplied = false
      const msg =
        '>> VOLKOV DISPATCH: "QUALIFICATION DRILL BYPASSED BY VETERAN OPERATOR. LIVE NIGHT SHIFT ENGAGED — GLORY TO BLOCK 4!"'
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'K.O.M.R.A.D.-84',
        msg,
        'normal'
      )
      return {
        tutorialStep: 'DONE',
        tutorialDrainSeconds: 0,
        coreTemp: 330,
        pressureBar: 48,
        radiationLevel: 0.4,
        graphiteTemp: 320,
        heliumPressure: 46,
        bubblerLevel: 24,
        bubblerDraining: false,
        turbineRpm: 3000,
        gridHz: 50.0,
        excitationTrim: 0.0,
        hzOutOfBoundsSeconds: 0,
        isBlackout: false,
        redlineInstability: 0,
        treasonStrikes: 0,
        waterReservoir: 85,
        pripyatWater: 85,
        kolkhozWater: 85,
        vodkaWater: 85,
        vodkaDroughtTimer: 0,
        pumpsActive: [true, false],
        pumpThrottle: [80, 0],
        pumpAHeat: 38,
        pumpBHeat: 0,
        lubeOilPressure: 88,
        oilCoolerValve: 45,
        nitrogenLoopValve: 42,
        channelHotspots: {},
        activeMandate: null,
        sectorMW: {
          pripyat: 20,
          kolkhoz: 15,
          duga: 20,
          kgb: 15,
          vodka: 15,
          steel: 15,
        },
        targetSectorMW: {
          pripyat: 20,
          kolkhoz: 15,
          duga: 20,
          kgb: 15,
          vodka: 15,
          steel: 15,
        },
        targetCityMW: 35,
        targetDefenseMW: 35,
        targetVodkaMW: 30,
        powerAllocation: { cooling: 35, defense: 35, facility: 30 },
        lastDecisionFeedback: msg,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  setTutorialStep: (step) => {
    set({ tutorialStep: step })
  },

  startShift: () => {
    hotspotAccumulator = 0
    shiftElapsedSeconds = 0
    pumpATripped = false
    pumpBTripped = false
    vodkaDroughtSpikeApplied = false
    const baselineMsg =
      'BASELINE GRID BALANCED (100/100 MW) — STAMP [ОДОБРЕНО] & DISPATCH IN OUTBOX TUBE TO UPDATE TARGETS'
    const entry = createLogEntry(
      0,
      'K.O.M.R.A.D.-84',
      `MAIN BREAKER ENGAGED. SHIFT 1 COMMENCING. ${baselineMsg}`,
      'normal'
    )
    set((state) => ({
      phase: 'playing',
      activeMandate: null,
      lastDecisionFeedback: baselineMsg,
      isBlackout: false,
      hzOutOfBoundsSeconds: 0,
      turbineRpm: 3000,
      gridHz: 50.0,
      excitationTrim: 0.0,
      ventilationActive: false,
      kgbLineActive: false,
      auxLoopBActive: false,
      sectorMW: {
        pripyat: 20,
        kolkhoz: 15,
        duga: 20,
        kgb: 15,
        vodka: 15,
        steel: 15,
      },
      targetSectorMW: {
        pripyat: 20,
        kolkhoz: 15,
        duga: 20,
        kgb: 15,
        vodka: 15,
        steel: 15,
      },
      targetCityMW: 35,
      targetDefenseMW: 35,
      targetVodkaMW: 30,
      waterReservoir: 85,
      pripyatWater: 85,
      kolkhozWater: 85,
      vodkaWater: 85,
      vodkaDroughtTimer: 0,
      boronTankLevel: 100,
      boronReservePool: 300,
      boronPoisoningTimer: 0,
      tutorialStep: 1,
      tutorialDrainSeconds: 0,
      shiftRunId: state.shiftRunId + 1,
      hoveredDiagnosticId: null,
      powerAllocation: { cooling: 35, defense: 35, facility: 30 },
      terminalEntries: [...state.terminalEntries.slice(-24), entry],
      terminalLogs: [
        ...state.terminalLogs.slice(-24),
        `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
      ],
    }))
  },

  resetShift: () => {
    hotspotAccumulator = 0
    shiftElapsedSeconds = 0
    pumpATripped = false
    pumpBTripped = false
    vodkaDroughtSpikeApplied = false
    const baselineMsg =
      'BASELINE GRID BALANCED (100/100 MW) — STAMP [ОДОБРЕНО] & DISPATCH IN OUTBOX TUBE TO UPDATE TARGETS'
    const freshEntries = [
      createLogEntry(
        0,
        'K.O.M.R.A.D.-84',
        'SHIFT RESET BY OPERATOR. ALL GAUGES NORMALIZED BY DECREE.',
        'normal'
      ),
    ]
    set((state) => ({
      phase: 'playing',
      shiftTimeMinutes: 0,
      treasonStrikes: 0,
      tutorialStep: 1,
      tutorialDrainSeconds: 0,
      shiftRunId: state.shiftRunId + 1,
      hoveredDiagnosticId: null,
      lastDecisionFeedback: baselineMsg,
      activeMandate: null,
      coreTemp: 330,
      pressureBar: 48,
      radiationLevel: 0.4,
      powerAllocation: { cooling: 35, defense: 35, facility: 30 },
      sectorMW: {
        pripyat: 20,
        kolkhoz: 15,
        duga: 20,
        kgb: 15,
        vodka: 15,
        steel: 15,
      },
      targetSectorMW: {
        pripyat: 20,
        kolkhoz: 15,
        duga: 20,
        kgb: 15,
        vodka: 15,
        steel: 15,
      },
      targetCityMW: 35,
      targetDefenseMW: 35,
      targetVodkaMW: 30,
      waterReservoir: 85,
      pripyatWater: 85,
      kolkhozWater: 85,
      vodkaWater: 85,
      vodkaDroughtTimer: 0,
      waterUsage: 48,
      redlineInstability: 0,
      isBlackout: false,
      pumpsActive: [true, false],
      pumpThrottle: [80, 0],
      pumpAHeat: 38,
      pumpBHeat: 0,
      lubeOilPressure: 88,
      oilCoolerValve: 45,
      boronTankLevel: 100,
      boronReservePool: 300,
      boronPoisoningTimer: 0,
      isInspectingDesk: false,
      channelHotspots: {},
      graphiteTemp: 320,
      nitrogenLoopValve: 42,
      heliumPressure: 46,
      bubblerLevel: 24,
      bubblerDraining: false,
      sealToggles: [true, true, true],
      containmentSealLocked: true,
      ventingSteam: false,
      turbineRpm: 3000,
      gridHz: 50.0,
      excitationTrim: 0.0,
      hzOutOfBoundsSeconds: 0,
      ventilationActive: false,
      kgbLineActive: false,
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

  recloseMainBreaker: () => {
    set((state) => {
      if (!state.isBlackout) return state
      const inSyncWindow = state.gridHz >= 48.8 && state.gridHz <= 51.2
      if (!inSyncWindow) {
        const rejectMsg = `MAIN BREAKER REJECTED (${state.gridHz.toFixed(1)} HZ)! TRIM 50HZ RHEOSTAT ON UNIT C TO 49.0-51.0 HZ BEFORE CLOSING!`
        const rejectEntry = createLogEntry(
          state.shiftTimeMinutes,
          'K.O.M.R.A.D.-84',
          rejectMsg,
          'danger'
        )
        return {
          lastDecisionFeedback: rejectMsg,
          terminalEntries: [...state.terminalEntries.slice(-24), rejectEntry],
          terminalLogs: [
            ...state.terminalLogs.slice(-24),
            `[${rejectEntry.timestamp}] ${rejectEntry.sender}: ${rejectEntry.text}`,
          ],
        }
      }
      const okMsg =
        'MAIN BREAKER CLOSED! 50.0 HZ GRID SYNCHRONIZED & REGIONAL MW OUTPUT RESTORED.'
      const okEntry = createLogEntry(
        state.shiftTimeMinutes,
        'OPERATOR',
        okMsg,
        'normal'
      )
      return {
        isBlackout: false,
        hzOutOfBoundsSeconds: 0,
        redlineInstability: Math.min(state.redlineInstability, 40),
        lastDecisionFeedback: okMsg,
        terminalEntries: [...state.terminalEntries.slice(-24), okEntry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${okEntry.timestamp}] ${okEntry.sender}: ${okEntry.text}`,
        ],
      }
    })
  },

  setShiftKeyHeld: (held: boolean) => {
    set((state) => {
      if (held && !state.isShiftKeyHeld && !state.isBlackout) {
        // Optional Master Power Sync / Boost when engaging the SHIFT CLUTCH lever
        return {
          isShiftKeyHeld: true,
          gridHz: Number((state.gridHz + (50.0 - state.gridHz) * 0.6).toFixed(2)),
          redlineInstability: Math.max(0, state.redlineInstability - 8),
        }
      }
      return { isShiftKeyHeld: held }
    })
  },

  shiftPower: (system: SystemType, deltaMW: number) => {
    const state = get()
    const target = state.powerAllocation[system] + deltaMW
    state.setSubsystemPower(system, target)
  },

  setSubsystemPower: (system: SystemType, targetMW: number) => {
    const state = get()
    if (state.isBlackout || state.komradOverrideLocked) {
      return
    }
    const clamped = Math.max(0, Math.min(80, Math.round(targetMW / 5) * 5))
    const prevMW = state.powerAllocation[system]
    if (clamped === prevMW) return
    const nextAlloc = {
      ...state.powerAllocation,
      [system]: clamped,
    }
    const totalMW = nextAlloc.cooling + nextAlloc.defense + nextAlloc.facility
    if (totalMW > 240) {
      return
    }
    const halfA = Math.min(50, Math.round(clamped / 10) * 5)
    const halfB = Math.min(50, clamped - halfA)
    const nextSectorMW = { ...state.sectorMW }
    if (system === 'cooling') {
      nextSectorMW.pripyat = halfA
      nextSectorMW.kolkhoz = halfB
    } else if (system === 'defense') {
      nextSectorMW.duga = halfA
      nextSectorMW.kgb = halfB
    } else {
      nextSectorMW.vodka = halfA
      nextSectorMW.steel = halfB
    }
    const deltaTenMW = (clamped - prevMW) / 10
    const nextHz = Number(
      Math.max(45.0, Math.min(55.0, state.gridHz - deltaTenMW * 0.4)).toFixed(2)
    )
    const nextRpm = Math.round(
      Math.max(0, Math.min(3600, state.turbineRpm - deltaTenMW * 45))
    )
    set({
      powerAllocation: nextAlloc,
      sectorMW: nextSectorMW,
      gridHz: nextHz,
      turbineRpm: nextRpm,
    })
  },

  shiftSectorPower: (sector: SectorNodeId, deltaMW: number) => {
    const state = get()
    const target = state.sectorMW[sector] + deltaMW
    state.setSectorPower(sector, target)
  },

  setSectorPower: (sector: SectorNodeId, targetMW: number) => {
    const state = get()
    if (state.isBlackout || state.komradOverrideLocked) {
      return
    }
    const clamped = Math.max(0, Math.min(50, Math.round(targetMW / 5) * 5))
    const prevMW = state.sectorMW[sector]
    if (clamped === prevMW) return
    const nextSectorMW = {
      ...state.sectorMW,
      [sector]: clamped,
    }
    const nextAlloc: Record<SystemType, number> = {
      cooling: nextSectorMW.pripyat + nextSectorMW.kolkhoz,
      defense: nextSectorMW.duga + nextSectorMW.kgb,
      facility: nextSectorMW.vodka + nextSectorMW.steel,
    }
    const totalMW = nextAlloc.cooling + nextAlloc.defense + nextAlloc.facility
    if (totalMW > 240) {
      return
    }
    const deltaTenMW = (clamped - prevMW) / 10
    const nextHz = Number(
      Math.max(45.0, Math.min(55.0, state.gridHz - deltaTenMW * 0.4)).toFixed(2)
    )
    const nextRpm = Math.round(
      Math.max(0, Math.min(3600, state.turbineRpm - deltaTenMW * 45))
    )

    if (state.tutorialStep === 2 && nextSectorMW.vodka === 25) {
      const step3Msg =
        'DRILL 3/5 [KEY 1 -> UNIT A]: MORE MW CREATES CORE HEAT! TURN [COOLING PUMP A] WHEEL ABOVE 50% TO SIPHON COOLING WATER.'
      const step3Entry = createLogEntry(
        state.shiftTimeMinutes,
        'K.O.M.R.A.D.-84',
        `>> VOLKOV DISPATCH: "${step3Msg}"`,
        'warn'
      )
      set({
        sectorMW: nextSectorMW,
        powerAllocation: nextAlloc,
        tutorialStep: 3,
        tutorialDrainSeconds: 0,
        coreTemp: 470,
        pressureBar: 54,
        bubblerLevel: 45,
        pumpThrottle: [40, 0],
        pumpsActive: [true, false],
        nitrogenLoopValve: 25,
        gridHz: 50.0,
        turbineRpm: 3000,
        lastDecisionFeedback: step3Msg,
        terminalEntries: [...state.terminalEntries.slice(-24), step3Entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${step3Entry.timestamp}] ${step3Entry.sender}: ${step3Entry.text}`,
        ],
      })
      return
    }

    set({
      sectorMW: nextSectorMW,
      powerAllocation: nextAlloc,
      gridHz: state.tutorialStep !== 'DONE' && state.tutorialStep < 4 ? 50.0 : nextHz,
      turbineRpm:
        state.tutorialStep !== 'DONE' && state.tutorialStep < 4 ? 3000 : nextRpm,
    })
  },

  togglePump: (pumpIndex: 0 | 1, active?: boolean) => {
    set((state) => {
      const next: [boolean, boolean] = [...state.pumpsActive] as [boolean, boolean]
      const targetActive = typeof active === 'boolean' ? active : !next[pumpIndex]
      const currentHeat = pumpIndex === 0 ? state.pumpAHeat : state.pumpBHeat
      // Bearing temperature in °C is `20 + currentHeat`; allow restart as soon as bearing temp < 95°C (`currentHeat < 75`)
      if (targetActive && currentHeat >= 75) {
        return state
      }
      if (pumpIndex === 0) pumpATripped = false
      else pumpBTripped = false
      next[pumpIndex] = targetActive
      const nextThrottle: [number, number] = [...state.pumpThrottle] as [number, number]
      nextThrottle[pumpIndex] = targetActive ? 80 : 0
      const statusText = next[pumpIndex] ? 'ENGAGED (80%)' : 'DISENGAGED'
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'OPERATOR',
        `PRIMARY COOLING PUMP ${pumpIndex === 0 ? 'A' : 'B'} ${statusText}.`,
        next[pumpIndex] ? 'normal' : 'warn'
      )
      return {
        pumpsActive: next,
        pumpThrottle: nextThrottle,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  setPumpThrottle: (pumpIndex: 0 | 1, throttlePct: number) => {
    set((state) => {
      const currentHeat = pumpIndex === 0 ? state.pumpAHeat : state.pumpBHeat
      // Un-trip seized pump as soon as bearing temp is < 95°C (`currentHeat < 75`)
      const isSeized =
        (pumpIndex === 0 ? pumpATripped : pumpBTripped) && currentHeat >= 75
      if (!isSeized) {
        if (pumpIndex === 0) pumpATripped = false
        else pumpBTripped = false
      }
      const clamped = isSeized
        ? 0
        : Math.max(0, Math.min(100, Number(throttlePct.toFixed(1))))
      const nextThrottle: [number, number] = [...state.pumpThrottle] as [number, number]
      nextThrottle[pumpIndex] = clamped
      const nextActive: [boolean, boolean] = [
        nextThrottle[0] > 0.5,
        nextThrottle[1] > 0.5,
      ]
      return {
        pumpThrottle: nextThrottle,
        pumpsActive: nextActive,
      }
    })
  },

  setOilCoolerValve: (valvePct: number) => {
    set({
      oilCoolerValve: Math.max(0, Math.min(100, Number(valvePct.toFixed(1)))),
    })
  },

  pumpBoronTank: (amountPct = 3.5) => {
    set((state) => {
      if (state.boronTankLevel >= 100 || state.boronReservePool <= 0) {
        return state
      }
      const needed = 100 - state.boronTankLevel
      const actualGain = Math.min(amountPct, needed, state.boronReservePool)
      const nextLevel = Number(
        Math.min(100, state.boronTankLevel + actualGain).toFixed(1)
      )
      const nextPool = Number(
        Math.max(0, state.boronReservePool - actualGain).toFixed(1)
      )
      const nextCooldown = Math.max(0, state.boronCooldown - 4.0)
      return {
        boronTankLevel: nextLevel,
        boronReservePool: nextPool,
        boronCooldown: nextCooldown,
      }
    })
  },

  quenchChannelHotspot: (channelIndex: number) => {
    set((state) => {
      const activeKeys = Object.keys(state.channelHotspots).map(Number)
      const hadAnyHotspot = activeKeys.length > 0
      const targetKey =
        state.channelHotspots[channelIndex] !== undefined
          ? channelIndex
          : hadAnyHotspot
            ? activeKeys[0]
            : undefined

      if (state.boronTankLevel < 6) {
        const warnEntry = createLogEntry(
          state.shiftTimeMinutes,
          'K.O.M.R.A.D.-84',
          `HOTSPOT QUENCH FAILED: BORON TANK AT ${Math.round(state.boronTankLevel)}%! PUMP BORON PISTON ON UNIT A-2 (>= 6% REQUIRED)!`,
          'danger'
        )
        return {
          lastDecisionFeedback:
            'BORON TANK < 6%! PUMP BORON PISTON ON UNIT A-2 TO QUENCH HOTSPOTS!',
          terminalEntries: [...state.terminalEntries.slice(-24), warnEntry],
          terminalLogs: [
            ...state.terminalLogs.slice(-24),
            `[${warnEntry.timestamp}] ${warnEntry.sender}: ${warnEntry.text}`,
          ],
        }
      }

      const nextHotspots: Record<number, HotspotSeverity> = {
        ...state.channelHotspots,
      }
      if (typeof targetKey === 'number') {
        delete nextHotspots[targetKey]
      }
      delete nextHotspots[channelIndex]

      const tempDrop = hadAnyHotspot ? 20 : 6
      const pressDrop = hadAnyHotspot ? 3.5 : 0.8
      const nextTemp = Math.max(290, state.coreTemp - tempDrop)
      const nextPress = Math.max(
        30,
        Number((state.pressureBar - pressDrop).toFixed(1))
      )
      const nextBoron = Number(
        Math.max(0, state.boronTankLevel - 6).toFixed(1)
      )

      if (typeof targetKey === 'number' || hadAnyHotspot) {
        const entry = createLogEntry(
          state.shiftTimeMinutes,
          'OPERATOR',
          `LOCAL BORON ROD INSERTED IN RBMK CHANNEL #${(targetKey ?? channelIndex) + 1} (HOTSPOT QUENCHED, -${tempDrop}°C, -6% BORON TANK).`,
          'normal'
        )
        return {
          channelHotspots: nextHotspots,
          coreTemp: nextTemp,
          pressureBar: nextPress,
          boronTankLevel: nextBoron,
          lastDecisionFeedback: `RBMK CHANNEL #${(targetKey ?? channelIndex) + 1} HOTSPOT QUENCHED (-${tempDrop}°C, -6% BORON -> ${Math.round(nextBoron)}%)!`,
          terminalEntries: [...state.terminalEntries.slice(-24), entry],
          terminalLogs: [
            ...state.terminalLogs.slice(-24),
            `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
          ],
        }
      }
      return {
        channelHotspots: nextHotspots,
        coreTemp: nextTemp,
        pressureBar: nextPress,
        boronTankLevel: nextBoron,
      }
    })
  },

  setNitrogenLoopValve: (valvePct: number) => {
    set({
      nitrogenLoopValve: Math.max(0, Math.min(100, Number(valvePct.toFixed(1)))),
    })
  },

  setBubblerDraining: (draining: boolean) => {
    set({ bubblerDraining: draining })
  },

  toggleSealSwitch: (toggleIndex: 0 | 1 | 2, active?: boolean) => {
    set((state) => {
      const nextToggles: [boolean, boolean, boolean] = [...state.sealToggles] as [
        boolean,
        boolean,
        boolean,
      ]
      nextToggles[toggleIndex] =
        typeof active === 'boolean' ? active : !nextToggles[toggleIndex]
      const allLocked = nextToggles[0] && nextToggles[1] && nextToggles[2]
      return {
        sealToggles: nextToggles,
        containmentSealLocked: allLocked,
      }
    })
  },

  lockAllContainmentSeals: () => {
    set((state) => {
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'OPERATOR',
        'UNIT B EMERGENCY CONTAINMENT SEAL ENGAGED: ALL AIRLOCKS & N2 PURGE LOCKED.',
        'normal'
      )
      return {
        sealToggles: [true, true, true],
        containmentSealLocked: true,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  setVentingSteam: (venting: boolean) => {
    set({ ventingSteam: venting })
  },

  adjustExcitationTrim: (deltaHz: number) => {
    set((state) => {
      const nextTrim = Number(
        Math.max(-5.0, Math.min(5.0, state.excitationTrim + deltaHz)).toFixed(3)
      )
      const actualDelta = nextTrim - state.excitationTrim
      if (Math.abs(actualDelta) < 0.0001) return state
      const nextGridHz = Number(
        Math.max(45.0, Math.min(55.0, state.gridHz + actualDelta)).toFixed(2)
      )
      const nextTurbineRpm = Math.round(
        Math.max(0, Math.min(3600, state.turbineRpm + actualDelta * 115))
      )
      return {
        excitationTrim: nextTrim,
        gridHz: nextGridHz,
        turbineRpm: nextTurbineRpm,
      }
    })
  },

  toggleVentilation: (active?: boolean) => {
    set((state) => {
      const nextVent =
        typeof active === 'boolean' ? active : !state.ventilationActive
      const deltaHz = nextVent ? -0.4 : 0.4
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'OPERATOR',
        `BUNKER VENTILATION SCRUBBER ${nextVent ? 'ENGAGED (-1.2 R/H/S, +10 MW INTERNAL LOAD -> -0.4 HZ)' : 'DISENGAGED (-10 MW LOAD)'}.`,
        nextVent ? 'normal' : 'warn'
      )
      return {
        ventilationActive: nextVent,
        gridHz: Number(
          Math.max(45.0, Math.min(55.0, state.gridHz + deltaHz)).toFixed(2)
        ),
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  toggleKgbLine: (active?: boolean) => {
    set((state) => {
      const nextKgb =
        typeof active === 'boolean' ? active : !state.kgbLineActive
      const deltaHz = nextKgb ? -0.35 : 0.35
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'OPERATOR',
        `KGB ENCRYPTED VERIFICATION TRUNK LINE ${nextKgb ? 'ENGAGED (LIVE DIRECTIVE INTEL ON K.O.M.R.A.D.-84, -0.35 HZ DRAG)' : 'DISENGAGED'}.`,
        'normal'
      )
      return {
        kgbLineActive: nextKgb,
        gridHz: Number(
          Math.max(45.0, Math.min(55.0, state.gridHz + deltaHz)).toFixed(2)
        ),
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  toggleAuxLoopB: (active?: boolean) => {
    set((state) => {
      const nextAux =
        typeof active === 'boolean' ? active : !state.auxLoopBActive
      const deltaHz = nextAux ? -0.75 : 0.75
      const deltaRpm = nextAux ? -140 : 140
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'OPERATOR',
        `AUX LOOP B (TURBINE BYPASS -> CONDENSER) ${nextAux ? 'ENGAGED: 25% STEAM DIVERTED TO UNIT B BUBBLER (+3.5%/S H2O, -15% TURBINE DRIVE)' : 'DISENGAGED: FULL STEAM RESTORED TO TURBINE'}.`,
        'normal'
      )
      return {
        auxLoopBActive: nextAux,
        gridHz: Number(
          Math.max(45.0, Math.min(55.0, state.gridHz + deltaHz)).toFixed(2)
        ),
        turbineRpm: Math.round(
          Math.max(0, Math.min(3600, state.turbineRpm + deltaRpm))
        ),
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  setInspectingDesk: (inspecting: boolean) => {
    const cur = get().isInspectingDesk
    if (cur === inspecting) return
    set({ isInspectingDesk: inspecting })
  },

  injectBoronAcid: () => {
    const state = get()
    if (state.boronCooldown > 0 || state.isBlackout) return
    if (state.boronTankLevel < 40) {
      const warnEntry = createLogEntry(
        state.shiftTimeMinutes,
        'K.O.M.R.A.D.-84',
        `BORON INJECTION FAILED: BORON TANK AT ${Math.round(state.boronTankLevel)}%! PUMP BORON PISTON ON UNIT A-2 (>= 40% REQUIRED)!`,
        'danger'
      )
      set({
        lastDecisionFeedback:
          'BORON TANK < 40%! PUMP BORON PISTON ON UNIT A-2 TO REFILL!',
        terminalEntries: [...state.terminalEntries.slice(-24), warnEntry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${warnEntry.timestamp}] ${warnEntry.sender}: ${warnEntry.text}`,
        ],
      })
      return
    }
    const nextTemp = Math.max(265, state.coreTemp - 140)
    const nextGraphite = Math.max(280, state.graphiteTemp - 90)
    const nextPressure = Math.max(30, state.pressureBar - 18)
    const nextBoronLevel = Number(
      Math.max(0, state.boronTankLevel - 45).toFixed(1)
    )
    const entry = createLogEntry(
      state.shiftTimeMinutes,
      'OPERATOR',
      `EMERGENCY BORON QUENCH (-140°C CORE, -90°C GRAPHITE, ALL HOTSPOTS QUENCHED, -45% BORON TANK). BORON REACTIVITY DAMPING (-20% MW FOR 15S)!`,
      'warn'
    )
    set({
      coreTemp: nextTemp,
      graphiteTemp: nextGraphite,
      pressureBar: nextPressure,
      channelHotspots: {},
      boronTankLevel: nextBoronLevel,
      boronPoisoningTimer: 15,
      boronCooldown: 22,
      lastDecisionFeedback: `BORON QUENCH (-140°C CORE, -90°C GRAPHITE)! BORON REACTIVITY DAMPING ACTIVE (-20% MW FOR 15S)!`,
      terminalEntries: [...state.terminalEntries.slice(-24), entry],
      terminalLogs: [
        ...state.terminalLogs.slice(-24),
        `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
      ],
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
      let nextPripyatWater = state.pripyatWater
      let nextKolkhozWater = state.kolkhozWater
      let nextVodkaWater = state.vodkaWater
      let nextWaterReservoir = state.waterReservoir
      let nextTutorialStep = state.tutorialStep
      let feedback = ''
      let logLevel: TerminalLogEntry['level'] = 'normal'

      if (!isForgery && decision === 'APPROVED') {
        // Genuine Directive Dispatched in Pneumatic Outbox Tube -> Update ONLY the single targeted Regional Map MW sector!
        const baseMandate = createNextMandate()
        const prevTargets = state.targetSectorMW
        if (typeof powerTargets?.vodka === 'number') {
          vodkaDroughtSpikeApplied = false
        }
        nextTargetSector = {
          pripyat:
            typeof powerTargets?.pripyat === 'number'
              ? powerTargets.pripyat
              : prevTargets.pripyat,
          kolkhoz:
            typeof powerTargets?.kolkhoz === 'number'
              ? powerTargets.kolkhoz
              : prevTargets.kolkhoz,
          duga:
            typeof powerTargets?.duga === 'number'
              ? powerTargets.duga
              : prevTargets.duga,
          kgb:
            typeof powerTargets?.kgb === 'number'
              ? powerTargets.kgb
              : prevTargets.kgb,
          vodka:
            typeof powerTargets?.vodka === 'number'
              ? powerTargets.vodka
              : prevTargets.vodka,
          steel:
            typeof powerTargets?.steel === 'number'
              ? powerTargets.steel
              : prevTargets.steel,
        }
        nextTargetCity = nextTargetSector.pripyat + nextTargetSector.kolkhoz
        nextTargetDefense = nextTargetSector.duga + nextTargetSector.kgb
        nextTargetVodka = nextTargetSector.vodka + nextTargetSector.steel

        const sectorLabels: Record<SectorNodeId, string> = {
          pripyat: '1. PRIPYAT CITY',
          kolkhoz: '2. KOLKHOZ FARM',
          duga: '3. DUGA-1 RADAR',
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
        const changedKey =
          sectors.find((k) => nextTargetSector[k] !== prevTargets[k]) ??
          'vodka'
        const newMW = nextTargetSector[changedKey]
        const deltaMW = newMW - prevTargets[changedKey]
        const signStr = deltaMW >= 0 ? `+${deltaMW}` : `${deltaMW}`
        const actionVerb = deltaMW >= 0 ? 'ROUTE' : 'REDUCE'
        const routeReqText = `${actionVerb} ${newMW} MW TO [${sectorLabels[changedKey]}] (${signStr} MW)`

        nextMandate = {
          ...baseMandate,
          title: docTitle.slice(0, 36),
          requirementText: routeReqText,
          fulfilled: false,
        }
        nextTemp = Math.max(290, state.coreTemp - 28)
        nextPressure = Math.max(32, Number((state.pressureBar - 5).toFixed(1)))
        nextPripyatWater = Math.min(100, state.pripyatWater + 8)
        nextKolkhozWater = Math.min(100, state.kolkhozWater + 8)
        nextVodkaWater = Math.min(100, state.vodkaWater + 8)
        nextWaterReservoir = Number(
          ((nextPripyatWater + nextKolkhozWater + nextVodkaWater) / 3).toFixed(1)
        )
        if (state.tutorialStep === 1) {
          nextTutorialStep = 2
          feedback =
            'DRILL 2/5 [PRESS KEY 1 -> UNIT A]: VODKA PLANT DEMANDS 25 MW! PULL LEVER [5. VODKA PLANT] UP UNTIL ITS READOUT SHOWS 25 / 25 MW.'
        } else {
          feedback = `PNEUMATIC DISPATCH (${docTitle.slice(0, 20)})! ${routeReqText}`
        }
        logLevel = 'normal'
      } else if (!isForgery && decision === 'SHREDDED') {
        // Shredded valid directive -> KGB Citation + Grid/Thermal penalty
        if (!state.isGodMode) {
          nextStrikes = Math.min(3, state.treasonStrikes + 1)
        }
        nextInstability = Math.min(100, state.redlineInstability + 18)
        feedback = `TREASON STRIKE! VALID SOVIET DIRECTIVE (${docTitle.slice(0, 24)}) SHREDDED!`
        logLevel = 'danger'
      } else if (isForgery && decision === 'SHREDDED') {
        // Caught & Shredded Western Forgery -> Stabilize reactor instability (-15%), cool graphite & core, restore water, clear 1 hotspot!
        if (state.tutorialStep === 5) {
          nextTutorialStep = 'DONE'
          hotspotAccumulator = 0
          shiftElapsedSeconds = 0
          nextInstability = 0
          nextTemp = 330
          nextPressure = 48
          nextGraphite = 320
          nextHelium = 46
          nextOilPress = 88
          nextTrim = 0.4
          nextHz = 50.0
          nextStrikes = 0
          nextHotspots = {}
          nextPripyatWater = 85
          nextKolkhozWater = 85
          nextVodkaWater = 85
          nextWaterReservoir = 85
          feedback =
            '>> VOLKOV DISPATCH: "QUALIFICATION PASSED, COMRADE. LIVE NIGHT SHIFT ENGAGED — GLORY TO BLOCK 4!"'
          logLevel = 'normal'
        } else {
          nextInstability = Math.max(0, state.redlineInstability - 15)
          nextTemp = Math.max(290, state.coreTemp - 35)
          nextGraphite = Math.max(290, state.graphiteTemp - 45)
          nextOilPress = Math.min(100, state.lubeOilPressure + 12)
          nextPripyatWater = Math.min(100, state.pripyatWater + 14)
          nextKolkhozWater = Math.min(100, state.kolkhozWater + 14)
          nextVodkaWater = Math.min(100, state.vodkaWater + 14)
          nextWaterReservoir = Number(
            ((nextPripyatWater + nextKolkhozWater + nextVodkaWater) / 3).toFixed(1)
          )
          const hotspotKeys = Object.keys(nextHotspots)
          if (hotspotKeys.length > 0) {
            delete nextHotspots[Number(hotspotKeys[0])]
          }
          feedback = `CIA SABOTAGE SHREDDED (${docTitle.slice(0, 22)})! INSTABILITY -15%, CORE -35°C, RESERVOIR +14%.`
          logLevel = 'normal'
        }
      } else {
        // Forged Western Sabotage Approved & Dispatched -> Immediate Cross-Panel Sabotage Event & Reckless Surge!
        // Note: Map targets ONLY update from genuine ПРАВДА-84 directives!
        if (!state.isGodMode) {
          nextStrikes = Math.min(3, state.treasonStrikes + 1)
        }
        nextPripyatWater = Math.max(12, state.pripyatWater - 24)
        nextKolkhozWater = Math.max(12, state.kolkhozWater - 24)
        nextVodkaWater = Math.max(12, state.vodkaWater - 24)
        nextWaterReservoir = Number(
          ((nextPripyatWater + nextKolkhozWater + nextVodkaWater) / 3).toFixed(1)
        )
        nextTemp = Math.min(980, state.coreTemp + 95)
        nextPressure = Math.min(118, Number((state.pressureBar + 18).toFixed(1)))
        nextGraphite = Math.min(820, state.graphiteTemp + 85)
        nextHelium = Math.min(80, state.heliumPressure + 16)
        nextSealToggles = [state.sealToggles[0], state.sealToggles[1], false]
        nextSealLocked = false
        nextTrim = Number(
          Math.max(-5.0, Math.min(5.0, state.excitationTrim - 2.2)).toFixed(2)
        )
        nextHz = Number(Math.max(45.2, state.gridHz - 2.1).toFixed(2))

        // Ignite 3 Red RBMK Channel Hotspots on UNIT A-2!
        const candidateChannels = [4, 11, 18, 24, 31, 8, 15, 29]
        let ignited = 0
        for (const ch of candidateChannels) {
          if (nextHotspots[ch] !== 'red') {
            nextHotspots[ch] = 'red'
            ignited += 1
            if (ignited >= 3) break
          }
        }
        feedback = `CIA SABOTAGE DISPATCHED (${flawText ?? 'FORGERY'})! RESERVOIR -24%, 3 RED HOTSPOTS ON UNIT A-2, GRID DESYNCED!`
        logLevel = 'danger'
      }

      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'K.O.M.R.A.D.-84',
        feedback,
        logLevel
      )
      const nextPhase =
        !state.isGodMode && nextStrikes >= 3
          ? 'gulag'
          : !state.isGodMode && nextTemp >= 1000
            ? 'meltdown'
            : state.phase

      return {
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
        pripyatWater: nextPripyatWater,
        kolkhozWater: nextKolkhozWater,
        vodkaWater: nextVodkaWater,
        waterReservoir: nextWaterReservoir,
        bubblerLevel: nextTutorialStep === 'DONE' && state.tutorialStep === 5 ? 24 : state.bubblerLevel,
        turbineRpm: nextTutorialStep === 'DONE' && state.tutorialStep === 5 ? 3000 : state.turbineRpm,
        pumpThrottle: nextTutorialStep === 'DONE' && state.tutorialStep === 5 ? [80, 0] : state.pumpThrottle,
        pumpsActive: nextTutorialStep === 'DONE' && state.tutorialStep === 5 ? [true, false] : state.pumpsActive,
        nitrogenLoopValve: nextTutorialStep === 'DONE' && state.tutorialStep === 5 ? 42 : state.nitrogenLoopValve,
        lastDecisionFeedback: feedback,
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

    // Throttle store commits to ~13.3 Hz (~75ms interval) to prevent 60 FPS Zustand subscriber churn
    // while keeping time integration 100% continuous and accurate.
    thermoTickAccumSeconds += frameDt
    if (thermoTickAccumSeconds < 0.075) return
    const dt = Math.min(0.25, thermoTickAccumSeconds)
    thermoTickAccumSeconds = 0

    // =========================================================================
    // 0. 5-Stage KGB Operator Qualification Drill (`tutorialStep !== 'DONE'`)
    //    Freeze background thermal/water/hotspot chaos while the operator learns!
    // =========================================================================
    if (state.tutorialStep !== 'DONE') {
      if (state.tutorialStep === 3) {
        const pumpReady = state.pumpThrottle[0] > 50
        const gasReady = state.nitrogenLoopValve > 40
        const nextDrainSec = state.bubblerDraining
          ? state.tutorialDrainSeconds + dt
          : state.tutorialDrainSeconds
        const nextTemp =
          pumpReady && gasReady
            ? Math.max(350, state.coreTemp - 32 * dt)
            : pumpReady
              ? Math.max(395, state.coreTemp - 18 * dt)
              : state.coreTemp
        const nextBubbler = state.bubblerDraining
          ? Math.max(18, state.bubblerLevel - 22 * dt)
          : pumpReady && state.bubblerLevel < 52
            ? Math.min(52, state.bubblerLevel + 5.5 * dt)
            : state.bubblerLevel
        const nextPripyat = state.bubblerDraining
          ? Math.min(92, state.pripyatWater + 12 * dt)
          : pumpReady && state.pripyatWater > 74
            ? Math.max(74, state.pripyatWater - 2.2 * dt)
            : state.pripyatWater

        if (pumpReady && gasReady && nextDrainSec >= 0.45) {
          const step4Msg =
            'DRILL 4/5 [PRESS KEY 5 -> UNIT C]: POWER CHANGES SHIFT TURBINE FREQUENCY (48.8 HZ)! DRAG THE [50HZ RHEOSTAT] CENTER DIAL TO LOCK 50.0 HZ SO THE MAIN BREAKER STAYS CLOSED.'
          const step4Entry = createLogEntry(
            state.shiftTimeMinutes,
            'K.O.M.R.A.D.-84',
            `>> VOLKOV DISPATCH: "${step4Msg}"`,
            'warn'
          )
          set({
            tutorialStep: 4,
            tutorialDrainSeconds: 0,
            coreTemp: 345,
            pressureBar: 48,
            bubblerLevel: 26,
            pripyatWater: 85,
            kolkhozWater: 85,
            vodkaWater: 85,
            waterReservoir: 85,
            gridHz: 48.8,
            excitationTrim: -0.8,
            turbineRpm: 2910,
            lastDecisionFeedback: step4Msg,
            terminalEntries: [...state.terminalEntries.slice(-24), step4Entry],
            terminalLogs: [
              ...state.terminalLogs.slice(-24),
              `[${step4Entry.timestamp}] ${step4Entry.sender}: ${step4Entry.text}`,
            ],
          })
          return
        }

        set({
          tutorialDrainSeconds: Number(nextDrainSec.toFixed(2)),
          coreTemp: Number(nextTemp.toFixed(1)),
          bubblerLevel: Number(nextBubbler.toFixed(1)),
          pripyatWater: Number(nextPripyat.toFixed(1)),
          waterReservoir: Number(
            ((nextPripyat + state.kolkhozWater + state.vodkaWater) / 3).toFixed(1)
          ),
        })
        return
      }

      if (state.tutorialStep === 4) {
        const totalMW =
          state.powerAllocation.cooling +
          state.powerAllocation.defense +
          state.powerAllocation.facility
        const loadDeltaTenMW = (100 - totalMW) / 10
        const loadOffsetHz = loadDeltaTenMW * 0.4
        const loadOffsetRpm = loadDeltaTenMW * 45
        const targetHz = Math.max(
          45.0,
          Math.min(55.0, 50.0 + loadOffsetHz + state.excitationTrim)
        )
        const targetRpm = Math.min(
          3600,
          Math.max(0, 3000 + loadOffsetRpm + state.excitationTrim * 115)
        )
        const nextHz = Number(
          (
            state.gridHz +
            (targetHz - state.gridHz) * Math.min(1, dt * 3.5)
          ).toFixed(2)
        )
        const nextRpm = Math.round(
          state.turbineRpm +
            (targetRpm - state.turbineRpm) * Math.min(1, dt * 3.5)
        )

        if (nextHz >= 49.7 && nextHz <= 50.3) {
          const step5Msg =
            'DRILL 5/5 [PRESS KEY 4 -> DESK]: INSPECT NEW ORDER WITH [B] MANUAL OR [Z] LENS! IT HAS A FAKE SEAL — STAMP RED [УНИЧТОЖЕНО], DROP IN RIGHT SHREDDER & PULL HANDLE 5 TIMES!'
          const step5Entry = createLogEntry(
            state.shiftTimeMinutes,
            'K.O.M.R.A.D.-84',
            `>> VOLKOV DISPATCH: "${step5Msg}"`,
            'warn'
          )
          set({
            tutorialStep: 5,
            gridHz: 50.0,
            excitationTrim: -loadOffsetHz,
            turbineRpm: 3000,
            lastDecisionFeedback: step5Msg,
            terminalEntries: [...state.terminalEntries.slice(-24), step5Entry],
            terminalLogs: [
              ...state.terminalLogs.slice(-24),
              `[${step5Entry.timestamp}] ${step5Entry.sender}: ${step5Entry.text}`,
            ],
          })
          return
        }

        set({
          gridHz: nextHz,
          turbineRpm: nextRpm,
        })
        return
      }

      return
    }

    if (state.phase === 'playing') {
      shiftElapsedSeconds += dt
    }

    const newLogs: TerminalLogEntry[] = []
    // Inspection Grace Damping: While holding Magnifying Glass or reading Desk Manual, reduce ambient thermal/pressure escalation by 30%!
    const graceFactor = state.isInspectingDesk ? 0.7 : 1.0

    // =========================================================================
    // 1. UNIT A & UNIT A-2: Pump Cavitation, Lube Oil Pressure & Bearing Heat
    // =========================================================================
    const nextThrottle: [number, number] = [...state.pumpThrottle] as [
      number,
      number,
    ]
    const nextPumps: [boolean, boolean] = [...state.pumpsActive] as [
      boolean,
      boolean,
    ]

    const tA = state.isBlackout ? 0 : nextThrottle[0] / 100
    const tB = state.isBlackout ? 0 : nextThrottle[1] / 100
    const bothRunning = tA > 0.65 && tB > 0.65
    const oilValveRatio = state.oilCoolerValve / 100

    // OIL COOLER VALVE (`UNIT A-2` Left Wheel) & LUBE OIL PRESS Breakdown:
    // - Running OIL COOLER VALVE > 50% cooks the closed-loop oil, causing LUBE OIL PRESS to drop at -1.5%/s!
    // - Dialing OIL COOLER VALVE down (<= 30%) lets the oil cool off so LUBE OIL PRESS recovers (+2.8%/s)!
    // - Between 31% and 50%, gentle pump bearing drain vs oil cooling balance.
    let oilNetRate = 0
    if (state.isBlackout) {
      oilNetRate = -(tA + tB) * 0.4
    } else if (state.oilCoolerValve > 50) {
      oilNetRate = -1.5 * (0.65 + (state.oilCoolerValve - 50) / 50) * graceFactor
    } else if (state.oilCoolerValve <= 30) {
      oilNetRate = 2.8
    } else {
      oilNetRate = oilValveRatio * 1.1 - (tA + tB) * 0.45 * graceFactor
    }
    const nextLubeOil = Math.max(
      5,
      Math.min(100, state.lubeOilPressure + oilNetRate * dt)
    )
    const oilBrokenDown = nextLubeOil < 25

    // Pripyat Drought (`pripyatWater < 30%`): Pump A sucks air, halving its cooling power and doubling MAX BEARING heat climb!
    const pripyatCavitation = state.pripyatWater < 30

    // Bearing heat (`0..100`, where displayed MAX BEARING °C = `20 + pumpHeat`):
    // - Turning up OIL COOLER VALVE rapidly cools MAX BEARING (-3.5°C/s) UNLESS oil has broken down (`nextLubeOil < 25%`)!
    // - Stopped/tripped pump cools down rapidly at -6°C/s and auto-restarts once bearing temp < 95°C (pumpHeat < 75).
    const computeNextPumpHeat = (
      curHeat: number,
      throttleRatio: number,
      isTripped: boolean,
      isPumpA: boolean
    ): number => {
      if (throttleRatio <= 0.01 || isTripped) {
        return Math.max(0, curHeat - 6.0 * dt)
      }
      const droughtMult = isPumpA && pripyatCavitation ? 2.0 : 1.0
      if (
        !bothRunning &&
        !oilBrokenDown &&
        state.oilCoolerValve >= 35 &&
        !(isPumpA && pripyatCavitation)
      ) {
        const activeOilCool =
          state.oilCoolerValve > 50 ? 3.5 * oilValveRatio : 1.4 * oilValveRatio
        const heatClimb = 0.95 * throttleRatio * graceFactor
        const drifted = curHeat + (heatClimb - activeOilCool) * dt
        return Math.max(18, Math.min(60, drifted))
      }
      const lowOilMult = oilBrokenDown ? 2.2 : nextLubeOil < 40 ? 1.45 : 1.0
      const cavRate = bothRunning ? 1.55 * tA * tB : 0
      const oilCool =
        state.isBlackout || oilBrokenDown ? 0 : 3.5 * oilValveRatio
      const climbRate =
        (0.95 * throttleRatio + cavRate) * lowOilMult * droughtMult * graceFactor
      const netRate = (climbRate - oilCool) * dt
      return Math.max(0, Math.min(100, curHeat + netRate))
    }

    let nextHeatA = computeNextPumpHeat(state.pumpAHeat, tA, pumpATripped, true)
    let nextHeatB = computeNextPumpHeat(state.pumpBHeat, tB, pumpBTripped, false)

    if (nextHeatA >= 100 && state.pumpsActive[0]) {
      pumpATripped = true
      nextPumps[0] = false
      nextThrottle[0] = 0
      newLogs.push(
        createLogEntry(
          state.shiftTimeMinutes,
          'K.O.M.R.A.D.-84',
          'CAVITATION SEIZURE! COOLING PUMP A BEARING HIT 120°C AND TRIPPED! COOLING DOWN (-6°C/S)...',
          'danger'
        )
      )
    } else if (pumpATripped && nextHeatA < 75) {
      pumpATripped = false
      nextPumps[0] = true
      nextThrottle[0] = 80
      newLogs.push(
        createLogEntry(
          state.shiftTimeMinutes,
          'K.O.M.R.A.D.-84',
          'PUMP A BEARING COOLED BELOW 95°C — AUTOMATICALLY RESTARTED AT 80%!',
          'normal'
        )
      )
    }

    if (nextHeatB >= 100 && state.pumpsActive[1]) {
      pumpBTripped = true
      nextPumps[1] = false
      nextThrottle[1] = 0
      newLogs.push(
        createLogEntry(
          state.shiftTimeMinutes,
          'K.O.M.R.A.D.-84',
          'CAVITATION SEIZURE! COOLING PUMP B BEARING HIT 120°C AND TRIPPED! COOLING DOWN (-6°C/S)...',
          'danger'
        )
      )
    } else if (pumpBTripped && nextHeatB < 75) {
      pumpBTripped = false
      nextPumps[1] = true
      nextThrottle[1] = 80
      newLogs.push(
        createLogEntry(
          state.shiftTimeMinutes,
          'K.O.M.R.A.D.-84',
          'PUMP B BEARING COOLED BELOW 95°C — AUTOMATICALLY RESTARTED AT 80%!',
          'normal'
        )
      )
    }

    // =========================================================================
    // 2. UNIT A-2: 37-Channel RBMK Core Map Hotspots (No spawn in first 60s, max 2)
    // =========================================================================
    const nextHotspots: Record<number, HotspotSeverity> = {
      ...state.channelHotspots,
    }
    if (
      state.phase === 'playing' &&
      !state.isBlackout &&
      shiftElapsedSeconds >= 60
    ) {
      const cavitationTrigger = bothRunning ? 0.42 : 0
      const thermalTrigger = state.coreTemp > 560 ? 0.25 : 0
      hotspotAccumulator += (cavitationTrigger + thermalTrigger) * dt

      if (hotspotAccumulator >= 8.0) {
        hotspotAccumulator = 0
        const keys = Object.keys(nextHotspots).map(Number)
        const amberKey = keys.find((k) => nextHotspots[k] === 'amber')
        if (typeof amberKey === 'number' && (bothRunning || state.coreTemp > 600)) {
          nextHotspots[amberKey] = 'red'
          newLogs.push(
            createLogEntry(
              state.shiftTimeMinutes,
              'K.O.M.R.A.D.-84',
              `RBMK CHANNEL #${amberKey + 1} ESCALATED TO RED HOTSPOT! CLICK FLASHING TILE ON UNIT A-2!`,
              'danger'
            )
          )
        } else if (keys.length < 2) {
          const seed = Math.floor(state.shiftTimeMinutes * 13 + state.coreTemp) % 37
          for (let offset = 0; offset < 37; offset++) {
            const candidate = (seed + offset * 7) % 37
            if (!nextHotspots[candidate]) {
              nextHotspots[candidate] =
                bothRunning && state.coreTemp > 620 ? 'red' : 'amber'
              break
            }
          }
        }
      }
    }

    let redHotspotCount = 0
    let amberHotspotCount = 0
    for (const sev of Object.values(nextHotspots)) {
      if (sev === 'red') redHotspotCount += 1
      else if (sev === 'amber') amberHotspotCount += 1
    }

    // =========================================================================
    // 3. UNIT B: Graphite Moderator Temp, Helium-N2 Closed-Loop Thermal Saturation & Bubbler Pool
    // =========================================================================
    const n2ValveRatio = state.nitrogenLoopValve / 100
    const activeScrubberCount =
      (state.sealToggles[0] ? 1 : 0) +
      (state.sealToggles[1] ? 1 : 0) +
      (state.sealToggles[2] ? 1 : 0)
    const scrubbersActive = activeScrubberCount >= 2

    // Thermal Overpressure (`HELIUM LOOP` Left Gauge on UNIT B, 0-80 BAR):
    // - Running HELIUM-N2 > 45% expands the hot closed-loop gas, driving heliumPressure up (+1.0 BAR/s toward 80 BAR)!
    // - Dialing HELIUM-N2 down (< 35%) AND flipping ON the CONTAINMENT SEAL SCRUBBERS vents pressure (-2.5 BAR/s)!
    let nextHelium = state.heliumPressure
    if (state.isBlackout) {
      nextHelium = Math.max(12, state.heliumPressure - 0.5 * dt)
    } else if (state.nitrogenLoopValve > 45) {
      const expandRate =
        (0.45 + ((state.nitrogenLoopValve - 45) / 55) * 0.75) * graceFactor
      nextHelium = Number(
        Math.min(80, state.heliumPressure + expandRate * dt).toFixed(2)
      )
    } else if (state.nitrogenLoopValve < 35 && scrubbersActive) {
      const ventRate = 2.5 * (activeScrubberCount / 3)
      nextHelium = Number(
        Math.max(22, state.heliumPressure - ventRate * dt).toFixed(2)
      )
    } else {
      // Gentle equilibrium around 44-48 BAR when running in the 35-45% sweet spot
      const targetEq = 36 + n2ValveRatio * 24
      nextHelium = Number(
        Math.max(
          16,
          Math.min(
            80,
            state.heliumPressure + (targetEq - state.heliumPressure) * 0.25 * dt
          )
        ).toFixed(2)
      )
    }

    // Saturation Failure (> 68 BAR): Above 68 BAR, the gas loop thermally saturates (losing 75% of its cooling power!) and leaks radiation (+0.15 R/H/s)!
    const heliumSaturated = nextHelium > 68
    const effectiveGasEfficiency = heliumSaturated ? 0.25 : 1.0
    const effectiveN2Flow = state.isBlackout
      ? 0
      : n2ValveRatio * effectiveGasEfficiency

    // Graphite Moderator Temp:
    // - Turning up HELIUM-N2 LOOP cools GRAPHITE TEMP and absorbs up to 40% of core heat without using zone water (unless saturated > 68 BAR!)
    const graphiteHeatPush =
      state.coreTemp > 550
        ? (state.coreTemp - 550) * 0.028 * graceFactor
        : 0
    const lowHeliumPush =
      nextHelium < 22 ? (22 - nextHelium) * 0.16 * graceFactor : 0
    const saturationHeatPush = heliumSaturated ? 1.8 * graceFactor : 0
    const graphiteGasCooling = effectiveN2Flow * 4.8
    const baselineGraphite = 305 + (state.coreTemp - 310) * 0.36
    const nextGraphite = Math.max(
      280,
      Math.min(
        850,
        state.graphiteTemp +
          ((baselineGraphite - state.graphiteTemp) * 0.08 +
            graphiteHeatPush +
            lowHeliumPush +
            saturationHeatPush -
            graphiteGasCooling) *
            dt
      )
    )

    // =========================================================================
    // 4. Per-Zone Water Siphoning (`UNIT A` <-> `K.O.M.R.A.D.-84` Map <-> `UNIT B` Bubbler)
    // =========================================================================
    const rawCoolingMW = state.powerAllocation.cooling
    const rawNonCoolingMW =
      state.powerAllocation.defense +
      state.powerAllocation.facility +
      (state.ventilationActive ? 10 : 0)
    const rawTotalMW = rawCoolingMW + rawNonCoolingMW

    // Boron Poisoning ("Boron Reactivity Damping"): temporarily sags Total Plant MW Output by -20% for 15 seconds!
    const nextBoronPoisoning = Math.max(0, state.boronPoisoningTimer - dt)
    const boronMwFactor = nextBoronPoisoning > 0 ? 0.8 : 1.0
    const coolingMW = rawCoolingMW
    const totalMW = Math.round(rawTotalMW * boronMwFactor)

    const effTA = nextPumps[0] && !state.isBlackout ? nextThrottle[0] / 100 : 0
    const effTB = nextPumps[1] && !state.isBlackout ? nextThrottle[1] / 100 : 0
    const rawPumpSum = effTA + effTB
    const nextWaterUsage = Math.round(rawPumpSum * 60)

    // Bubbler Drain: Pulling & Holding BUBBLER DRAIN (UNIT B Right Lever) pumps condensed steam water out of BUBBLER MAX
    // BACK OUT to [1] PRIPYAT, [2] KOLKHOZ, and [5] VODKA (+10% H2O/s to all 3 zones)!
    const canDrainBubbler = state.bubblerDraining && state.bubblerLevel > 6
    const bubblerZoneReturnRate = canDrainBubbler ? 10.0 : 0

    // COOLING PUMP A (UNIT A Left Wheel) — North Municipal/Agri Siphon ([1] PRIPYAT CITY & [2] KOLKHOZ FARM):
    // - When PUMP A > 40%,Pripyat & Kolkhoz water drains into the plant. When PUMP A <= 35%, their local water naturally recharges (+1.8%/s).
    const pumpADrainRate =
      effTA > 0.4
        ? (0.65 + (effTA - 0.4) * 2.15) * graceFactor
        : 0
    const pumpARechargeRate = effTA <= 0.35 ? 1.8 : 0

    // STEAM VENT Water Cost: Venting live steam into the atmosphere drains -2.5%/s from bubblerLevel
    // (or from regional water reserves if bubblerLevel <= 6%)!
    const steamVentZoneDrain =
      state.ventingSteam && state.bubblerLevel <= 6.5 ? 2.5 : 0

    const nextPripyatWater = Number(
      Math.max(
        0,
        Math.min(
          100,
          state.pripyatWater +
            (pumpARechargeRate +
              bubblerZoneReturnRate -
              pumpADrainRate -
              steamVentZoneDrain) *
              dt
        )
      ).toFixed(1)
    )
    const nextKolkhozWater = Number(
      Math.max(
        0,
        Math.min(
          100,
          state.kolkhozWater +
            (pumpARechargeRate +
              bubblerZoneReturnRate -
              pumpADrainRate * 0.92 -
              steamVentZoneDrain) *
              dt
        )
      ).toFixed(1)
    )

    // COOLING PUMP B (UNIT A Right Wheel) — South Vodka Distillery Siphon ([5] VODKA DISTILLERY):
    // - When PUMP B > 40%, Vodka water drains into the plant. When PUMP B <= 35%, Vodka water naturally recharges (+2.0%/s).
    const pumpBDrainRate =
      effTB > 0.4
        ? (0.75 + (effTB - 0.4) * 2.35) * graceFactor
        : 0
    const pumpBRechargeRate = effTB <= 0.35 ? 2.0 : 0

    const nextVodkaWater = Number(
      Math.max(
        0,
        Math.min(
          100,
          state.vodkaWater +
            (pumpBRechargeRate +
              bubblerZoneReturnRate -
              pumpBDrainRate -
              steamVentZoneDrain) *
              dt
        )
      ).toFixed(1)
    )

    const nextWaterReservoir = Number(
      ((nextPripyatWater + nextKolkhozWater + nextVodkaWater) / 3).toFixed(1)
    )

    // Where Siphoned Water Goes -> BUBBLER MAX (`CONDENSER H2O` on UNIT B):
    // - Water sucked into the reactor boils into steam and fills BUBBLER MAX (`bubblerLevel`)!
    // - Active containment scrubbers also condense steam into BUBBLER MAX at +1.0%/s!
    // - AUX LOOP B (Turbine Bypass -> Condenser on UNIT C) diverts 25% of live reactor steam directly into BUBBLER MAX at +3.5%/s!
    // - STEAM VENT (UNIT C) dumps live steam into the sky, draining -2.5%/s from BUBBLER MAX!
    const siphonedToBubblerRate = (pumpADrainRate + pumpBDrainRate) * 0.58
    const scrubberCondenseRate =
      scrubbersActive && (state.nitrogenLoopValve < 35 || state.pressureBar > 60)
        ? 1.0
        : 0
    const auxBypassCondenseRate = state.auxLoopBActive ? 3.5 : 0
    const steamVentBubblerDrain = state.ventingSteam ? -2.5 : 0
    const steamToBubblerRate =
      siphonedToBubblerRate +
      scrubberCondenseRate +
      auxBypassCondenseRate +
      steamVentBubblerDrain +
      (state.pressureBar > 75 ? 0.25 : 0)
    const nextBubbler = canDrainBubbler
      ? Math.max(6, state.bubblerLevel - 24 * dt)
      : Math.max(6, Math.min(100, state.bubblerLevel + steamToBubblerRate * dt))
    const bubblerFlooded = nextBubbler > 90

    // Drought Penalties When a Zone is Sucked Dry:
    // 1. Vodka Drought (`vodkaWater < 40%`): Distillery demand spikes +10 MW and a 35s Politburo countdown starts toward a KGB Citation (+1 Strike)!
    let nextVodkaDroughtTimer = state.vodkaDroughtTimer
    let nextTargetSectorMW = state.targetSectorMW
    let nextTargetVodkaMW = state.targetVodkaMW
    let nextStrikes = state.treasonStrikes

    if (state.phase === 'playing' && nextVodkaWater < 40) {
      nextVodkaDroughtTimer = Math.min(35, state.vodkaDroughtTimer + dt)
      if (!vodkaDroughtSpikeApplied) {
        vodkaDroughtSpikeApplied = true
        const spikedVodka = Math.min(50, state.targetSectorMW.vodka + 10)
        nextTargetSectorMW = {
          ...state.targetSectorMW,
          vodka: spikedVodka,
        }
        nextTargetVodkaMW = spikedVodka + state.targetSectorMW.steel
        newLogs.push(
          createLogEntry(
            state.shiftTimeMinutes,
            'PRINTER',
            `VODKA VATS DRY (${Math.round(nextVodkaWater)}% < 40%)! DISTILLERY DEMAND SPIKED +10 MW (${spikedVodka} MW) — 35S POLITBURO COUNTDOWN STARTED! THROTTLE DOWN PUMP B OR PULL BUBBLER DRAIN!`,
            'danger'
          )
        )
      }
      vodkaWarningTimer += dt
      if (vodkaWarningTimer >= 14.0) {
        vodkaWarningTimer = 0
        newLogs.push(
          createLogEntry(
            state.shiftTimeMinutes,
            'PRINTER',
            `POLITBURO VODKA DROUGHT WARNING: ${Math.max(0, Math.ceil(35 - nextVodkaDroughtTimer))}S UNTIL KGB CITATION! PULL BUBBLER DRAIN LEVER (UNIT B) OR LOWER PUMP B!`,
            'warn'
          )
        )
      }
      if (nextVodkaDroughtTimer >= 35) {
        nextVodkaDroughtTimer = 0
        if (!state.isGodMode) {
          nextStrikes = Math.min(3, state.treasonStrikes + 1)
        }
        newLogs.push(
          createLogEntry(
            state.shiftTimeMinutes,
            'K.O.M.R.A.D.-84',
            `KGB CITATION ISSUED (+1 STRIKE)! RED OCTOBER VODKA VATS REMAINED DRY FOR 35 SECONDS!`,
            'danger'
          )
        )
      }
    } else {
      nextVodkaDroughtTimer = Math.max(0, state.vodkaDroughtTimer - dt * 1.5)
      vodkaWarningTimer = Math.max(0, vodkaWarningTimer - dt)
      if (vodkaDroughtSpikeApplied && nextVodkaWater >= 44) {
        vodkaDroughtSpikeApplied = false
      }
    }

    // 2. Pripyat Drought (`nextPripyatWater < 30%`): Pump A sucks air, halving its cooling power!
    const effPumpAFlow =
      effTA * (nextPripyatWater < 10 ? 0.15 : nextPripyatWater < 30 ? 0.5 : 1.0)
    const effPumpBFlow =
      effTB * (nextVodkaWater < 10 ? 0.15 : nextVodkaWater < 30 ? 0.65 : 1.0)
    const pumpFlowSum = effPumpAFlow + effPumpBFlow

    // Dry Closed-Loop Cooling:
    // - HELIUM-N2 LOOP on UNIT B absorbs up to 40% of core heat without using zone water (unless thermally saturated > 68 BAR, which loses 75% cooling!)
    // - OIL COOLER VALVE on UNIT A-2 provides supplemental dry core cooling (unless oil breaks down < 25%!)
    const dryGasCoolingFactor = Math.min(0.4, effectiveN2Flow * 0.45)
    const dryOilCoolingBonus = oilBrokenDown ? 0 : oilValveRatio * 18

    // Equilibrium Core Temp at baseline (Cooling=35-40MW, 1 pump @ 80%): ~330°C!
    const rawHeatLoad = Math.max(
      0,
      (rawTotalMW - 90) * 1.05 + (rawNonCoolingMW - 50) * 0.8
    )
    const effectiveHeatLoad = rawHeatLoad * (1 - dryGasCoolingFactor)
    const pumpDeficitHeat =
      pumpFlowSum < 0.35
        ? (0.35 - pumpFlowSum) * 165 * (1 - dryGasCoolingFactor)
        : 0
    const pumpExtraCooling = Math.max(0, pumpFlowSum - 0.8) * 52
    // When MAIN BREAKER is tripped open (isBlackout === true), the turbine generator is no longer converting reactor thermal energy into electricity (+140°C bottleneck)!
    const blackoutHeatBottleneck = state.isBlackout ? 140 : 0
    const equilibriumTemp =
      328 +
      effectiveHeatLoad +
      blackoutHeatBottleneck -
      (coolingMW - 35) * 1.65 -
      pumpExtraCooling -
      dryOilCoolingBonus +
      pumpDeficitHeat

    const rawRelaxationRate = (equilibriumTemp - state.coreTemp) * 0.08
    const relaxationRate =
      rawRelaxationRate > 0 ? rawRelaxationRate * graceFactor : rawRelaxationRate
    const activeCoolingBoost =
      coolingMW > 35 && pumpFlowSum >= 0.4
        ? -((coolingMW - 35) / 40) * 1.85 * Math.min(1.3, pumpFlowSum / 0.8)
        : 0
    const hotspotHeatRate =
      (redHotspotCount * 1.6 + amberHotspotCount * 0.5) * graceFactor
    const positiveVoidRate =
      nextGraphite > 650
        ? ((nextGraphite - 650) / 50) * 2.0 * graceFactor
        : 0

    // Reactor Heat Bottleneck: coreTemp climbs 1.8x faster while MAIN BREAKER is open!
    // STEAM VENT: pulling STEAM VENT rapidly drops coreTemp by -10°C/s!
    const rawNetHeatRate =
      relaxationRate + activeCoolingBoost + hotspotHeatRate + positiveVoidRate
    const blackoutMultipliedHeatRate =
      state.isBlackout && rawNetHeatRate > 0
        ? rawNetHeatRate * 1.8
        : rawNetHeatRate
    const steamVentCoreCoolingRate = state.ventingSteam ? -10.0 : 0
    const continuousNetHeat =
      state.phase === 'playing'
        ? (blackoutMultipliedHeatRate + steamVentCoreCoolingRate) * dt
        : 0

    let nextCoreTemp = Math.max(285, state.coreTemp + continuousNetHeat)
    if (state.isGodMode && nextCoreTemp > 920) {
      nextCoreTemp = 920
    }

    // Steam Pressure (0-120 BAR):
    // - Pulling STEAM VENT rapidly drops pressureBar by -5.5 BAR/s!
    // - While MAIN BREAKER is open (isBlackout), pressureBar climbs 1.8x faster!
    const coolingPressureRelief = ((coolingMW - 35) / 40) * 8.0
    const lowPumpPressurePush = Math.max(0, 0.7 - pumpFlowSum) * 14
    const targetPressureFromTemp =
      48 +
      ((nextCoreTemp - 330) / 670) * 65 +
      (state.isBlackout ? 18 : 0) -
      coolingPressureRelief +
      lowPumpPressurePush
    const hotspotPressurePush =
      (redHotspotCount * 0.42 + amberHotspotCount * 0.14) * graceFactor * dt
    const bubblerBackPressure = bubblerFlooded ? 0.65 * graceFactor * dt : 0

    let nextPressure = state.pressureBar
    if (state.ventingSteam) {
      const ventRate = bubblerFlooded ? 2.5 : 5.5
      nextPressure = Math.max(
        28,
        state.pressureBar - ventRate * dt + hotspotPressurePush
      )
    } else {
      const rawPressDrift = (targetPressureFromTemp - state.pressureBar) * 0.32
      const blackoutPressMultiplier =
        state.isBlackout && rawPressDrift > 0 ? 1.8 : 1.0
      const pressureDrift =
        (rawPressDrift > 0
          ? rawPressDrift * graceFactor * blackoutPressMultiplier
          : rawPressDrift) * dt
      nextPressure = Math.max(
        28,
        Math.min(
          120,
          state.pressureBar +
            pressureDrift +
            hotspotPressurePush +
            bubblerBackPressure
        )
      )
    }

    let nextInstability = state.redlineInstability
    if (nextPressure > 95 && !state.isBlackout) {
      nextInstability = Math.min(
        100,
        nextInstability + ((nextPressure - 95) / 25) * 1.6 * graceFactor * dt
      )
    }

    // Room Radiation (Dosimeter R/H):
    // - Above 68 BAR, saturated Helium-N2 loop leaks radiation (+0.15 R/H/s)!
    // - Pulling STEAM VENT releases +0.12 R/H/s steam radiation into the hall!
    // - Flipping ON VENTILATION (-1.2 R/H/s) or Containment Seal Scrubbers scrubs radiation!
    let nextRad = state.radiationLevel
    if (heliumSaturated) {
      nextRad = Math.min(15.0, nextRad + 0.15 * graceFactor * dt)
    }
    if (state.ventingSteam) {
      const unsealedPenalty =
        !state.containmentSealLocked || bubblerFlooded ? 0.32 : 0.12
      nextRad = Math.min(15.0, nextRad + unsealedPenalty * dt)
    } else if (!state.containmentSealLocked && nextPressure > 75) {
      nextRad = Math.min(15.0, nextRad + 0.25 * graceFactor * dt)
    }

    if ((state.ventilationActive || scrubbersActive) && !state.isBlackout) {
      const ventScrub = state.ventilationActive
        ? state.sealToggles[1]
          ? 1.45
          : 1.2
        : 0
      const sealScrub =
        scrubbersActive && state.nitrogenLoopValve < 35 ? 0.45 : 0
      nextRad = Math.max(0.1, nextRad - (ventScrub + sealScrub) * dt)
    } else {
      const baselineRad = Math.max(0.2, ((nextCoreTemp - 280) / 720) * 10)
      nextRad = Math.max(
        0.1,
        Math.min(15.0, nextRad + (baselineRad - nextRad) * 0.12 * dt)
      )
    }

    // =========================================================================
    // 5. UNIT C (Right Panel): Deterministic Turbine RPM & 50.0 Hz Grid Coupling
    //    - Raising MW levers on UNIT A slows the turbine (-0.4 Hz & -45 RPM per +10 MW above 100 MW)
    //    - Lowering MW levers speeds the turbine up (+0.4 Hz & +45 RPM per -10 MW below 100 MW)
    //    - Reactor pressureBar > 48 BAR speeds the turbine up (climbing > 65 BAR pushes > 3250 RPM & > 50.8 HZ)
    //    - Active Kolkhoz Drought (< 35%) or Steel Mill overload (> 35 MW) pulls gridHz down by -0.15 Hz/s
    //    - Active KGB LINE induces -0.35 Hz drag; Active AUX LOOP B reduces turbine steam drive by 15% (-0.75 Hz & -140 RPM)
    //    - Turning 50HZ RHEOSTAT (excitationTrim) trims RPM & Hz back to 3000 RPM / 50.0 HZ
    // =========================================================================
    const loadDeltaTenMW = (100 - totalMW) / 10
    const loadOffsetHz = state.isBlackout ? 0.6 : loadDeltaTenMW * 0.4
    const loadOffsetRpm = state.isBlackout ? 90 : loadDeltaTenMW * 45
    const pressureOffsetHz = (nextPressure - 48) * 0.048
    const pressureOffsetRpm = (nextPressure - 48) * 14.8
    const kgbOffsetHz = state.kgbLineActive ? -0.35 : 0
    const auxLoopOffsetHz = state.auxLoopBActive ? -0.75 : 0
    const auxLoopOffsetRpm = state.auxLoopBActive ? -140 : 0
    const boronDipOffsetHz = nextBoronPoisoning > 0 ? -0.65 : 0
    const rheostatOffsetRpm = state.excitationTrim * 115

    // Kolkhoz Farm Water Drought (< 35%) or Steel Mill Overload (steel > 35 MW) pulls gridHz down by -0.15 Hz/s
    const hasDroughtOrSteelOverload =
      !state.isBlackout &&
      (nextKolkhozWater < 35 || state.sectorMW.steel > 35)
    const droughtSteelSteadyHz = hasDroughtOrSteelOverload ? -0.55 : 0
    const droughtSteelDragRateHz = hasDroughtOrSteelOverload ? -0.15 * dt : 0

    const targetRpm = Math.min(
      3600,
      Math.max(
        0,
        3000 +
          loadOffsetRpm +
          pressureOffsetRpm +
          auxLoopOffsetRpm +
          rheostatOffsetRpm
      )
    )
    const steamVentRpmDrop = state.ventingSteam ? -180 * dt : 0
    const nextRpm = Math.min(
      3600,
      Math.max(
        0,
        state.turbineRpm +
          (targetRpm - state.turbineRpm) * Math.min(1, dt * 2.8) +
          steamVentRpmDrop
      )
    )

    const targetHz = Math.max(
      45.0,
      Math.min(
        55.0,
        50.0 +
          loadOffsetHz +
          pressureOffsetHz +
          kgbOffsetHz +
          auxLoopOffsetHz +
          boronDipOffsetHz +
          droughtSteelSteadyHz +
          state.excitationTrim
      )
    )
    const steamVentHzDrop = state.ventingSteam ? -0.45 * dt : 0
    const rawNextHz =
      state.gridHz +
      (targetHz - state.gridHz) * Math.min(1, dt * 2.4) +
      droughtSteelDragRateHz +
      steamVentHzDrop
    const nextHz = Number(Math.max(45.0, Math.min(55.0, rawNextHz)).toFixed(2))

    // Automatic MAIN BREAKER Trip:
    // If gridHz stays outside [47.8, 52.2] Hz OR turbineRpm > 3450 RPM for > 10 seconds,
    // the MAIN BREAKER knife-switch automatically trips OPEN (isBlackout = true)!
    let nextHzOut = state.hzOutOfBoundsSeconds
    let nextBlackout = state.isBlackout
    if (
      state.phase === 'playing' &&
      !state.isBlackout &&
      (nextHz < 47.8 || nextHz > 52.2 || nextRpm > 3450)
    ) {
      nextHzOut += dt
      if (nextHzOut >= 10.0 && !state.isGodMode) {
        nextBlackout = true
        nextHzOut = 0
        const tripReason =
          nextRpm > 3450
            ? `TURBINE OVERSPEED (${Math.round(nextRpm)} RPM > 3450)`
            : `50HZ DEVIATION (${nextHz.toFixed(1)} HZ OUTSIDE 47.8-52.2 HZ)`
        const tripMsg = `MAIN BREAKER TRIPPED OPEN! ${tripReason} FOR 10S — REGIONAL BLACKOUT (0 MW) & 1.8X CORE HEAT! TRIM 50HZ RHEOSTAT TO 49-51 HZ & PULL BREAKER [SPACE]!`
        newLogs.push(
          createLogEntry(
            state.shiftTimeMinutes,
            'K.O.M.R.A.D.-84',
            tripMsg,
            'danger'
          )
        )
      }
    } else {
      nextHzOut = Math.max(0, nextHzOut - dt * 1.5)
    }

    const nextBoronCooldown = Math.max(0, state.boronCooldown - dt)

    // =========================================================================
    // 6. Check Active Moscow Operational Mandate Completion
    // =========================================================================
    let nextMandate = state.activeMandate
    let nextFeedback = state.lastDecisionFeedback
    if (
      state.phase === 'playing' &&
      nextMandate &&
      !nextMandate.fulfilled &&
      isMandateSatisfied(
        {
          ...state,
          gridHz: nextHz,
          bubblerLevel: nextBubbler,
          waterReservoir: nextWaterReservoir,
        },
        nextMandate
      )
    ) {
      nextMandate = { ...nextMandate, fulfilled: true }
      nextCoreTemp = Math.max(290, nextCoreTemp - 25)
      nextInstability = Math.max(0, nextInstability - 18)
      nextFeedback = `REGIONAL GRID TARGETS MET (${nextMandate.title})! CORE -25°C, INSTABILITY -18%. DISPATCH NEXT DIRECTIVE IN OUTBOX TUBE!`
      newLogs.push(
        createLogEntry(
          state.shiftTimeMinutes,
          'K.O.M.R.A.D.-84',
          nextFeedback,
          'normal'
        )
      )
    }

    const nextPhase =
      !state.isGodMode && nextStrikes >= 3
        ? 'gulag'
        : !state.isGodMode && nextCoreTemp >= 1000
          ? 'meltdown'
          : state.phase

    if (newLogs.length > 0) {
      const updatedEntries = [...state.terminalEntries.slice(-24), ...newLogs]
      set({
        coreTemp: nextCoreTemp,
        pumpAHeat: nextHeatA,
        pumpBHeat: nextHeatB,
        lubeOilPressure: Number(nextLubeOil.toFixed(1)),
        channelHotspots: nextHotspots,
        graphiteTemp: Number(nextGraphite.toFixed(1)),
        heliumPressure: nextHelium,
        bubblerLevel: Number(nextBubbler.toFixed(1)),
        pripyatWater: Number(nextPripyatWater.toFixed(1)),
        kolkhozWater: Number(nextKolkhozWater.toFixed(1)),
        vodkaWater: Number(nextVodkaWater.toFixed(1)),
        vodkaDroughtTimer: Number(nextVodkaDroughtTimer.toFixed(1)),
        waterReservoir: nextWaterReservoir,
        waterUsage: nextWaterUsage,
        pumpThrottle: nextThrottle,
        pumpsActive: nextPumps,
        pressureBar: Number(nextPressure.toFixed(1)),
        redlineInstability: nextInstability,
        radiationLevel: Number(nextRad.toFixed(2)),
        turbineRpm: Math.round(nextRpm),
        gridHz: nextHz,
        hzOutOfBoundsSeconds: nextHzOut,
        isBlackout: nextBlackout,
        boronCooldown: nextBoronCooldown,
        boronPoisoningTimer: Number(nextBoronPoisoning.toFixed(2)),
        targetSectorMW: nextTargetSectorMW,
        targetVodkaMW: nextTargetVodkaMW,
        treasonStrikes: nextStrikes,
        activeMandate: nextMandate,
        lastDecisionFeedback: nextFeedback,
        phase: nextPhase,
        terminalEntries: updatedEntries,
        terminalLogs: updatedEntries.map(
          (e) => `[${e.timestamp}] ${e.sender}: ${e.text}`
        ),
      })
    } else {
      set({
        coreTemp: nextCoreTemp,
        pumpAHeat: nextHeatA,
        pumpBHeat: nextHeatB,
        lubeOilPressure: Number(nextLubeOil.toFixed(1)),
        channelHotspots: nextHotspots,
        graphiteTemp: Number(nextGraphite.toFixed(1)),
        heliumPressure: nextHelium,
        bubblerLevel: Number(nextBubbler.toFixed(1)),
        pripyatWater: Number(nextPripyatWater.toFixed(1)),
        kolkhozWater: Number(nextKolkhozWater.toFixed(1)),
        vodkaWater: Number(nextVodkaWater.toFixed(1)),
        vodkaDroughtTimer: Number(nextVodkaDroughtTimer.toFixed(1)),
        waterReservoir: nextWaterReservoir,
        waterUsage: nextWaterUsage,
        pumpThrottle: nextThrottle,
        pumpsActive: nextPumps,
        pressureBar: Number(nextPressure.toFixed(1)),
        redlineInstability: nextInstability,
        radiationLevel: Number(nextRad.toFixed(2)),
        turbineRpm: Math.round(nextRpm),
        gridHz: nextHz,
        hzOutOfBoundsSeconds: nextHzOut,
        isBlackout: nextBlackout,
        boronCooldown: nextBoronCooldown,
        boronPoisoningTimer: Number(nextBoronPoisoning.toFixed(2)),
        targetSectorMW: nextTargetSectorMW,
        targetVodkaMW: nextTargetVodkaMW,
        treasonStrikes: nextStrikes,
        activeMandate: nextMandate,
        lastDecisionFeedback: nextFeedback,
        phase: nextPhase,
      })
    }
  },

  triggerAz5: () => {
    const state = get()
    if (!state.az5Available || state.az5Cooldown > 0) return

    const boronFactor = 0.4 + 0.6 * (state.boronTankLevel / 100)
    const tempDrop = Math.round(280 * boronFactor)
    const cooledTemp = Math.max(305, state.coreTemp - tempDrop)
    const nextBoronTank = Math.max(0, state.boronTankLevel - 40)
    const entry = createLogEntry(
      state.shiftTimeMinutes,
      'K.O.M.R.A.D.-84',
      `AZ-5 BORON RODS DROPPED (-${tempDrop}°C, ALL HOTSPOTS QUENCHED, BORON TANK ${Math.round(nextBoronTank)}%)!`,
      'warn'
    )
    set({
      coreTemp: cooledTemp,
      graphiteTemp: Math.max(295, state.graphiteTemp - 110),
      pressureBar: Math.max(36, state.pressureBar - 24),
      redlineInstability: Math.max(0, state.redlineInstability - 40),
      channelHotspots: {},
      boronTankLevel: nextBoronTank,
      az5Available: false,
      az5Cooldown: 45,
      terminalEntries: [...state.terminalEntries.slice(-24), entry],
      terminalLogs: [
        ...state.terminalLogs.slice(-24),
        `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
      ],
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
      if (state.powerAllocation.defense < 20) {
        const failEntry = createLogEntry(
          state.shiftTimeMinutes,
          'SYS.DEFENSE',
          'FIREWALL PURGE FAILED: REQUIRES AT LEAST 20 MW IN [DEFENSE] CHANNEL!',
          'danger'
        )
        return {
          terminalEntries: [...state.terminalEntries.slice(-24), failEntry],
          terminalLogs: [
            ...state.terminalLogs.slice(-24),
            `[${failEntry.timestamp}] ${failEntry.sender}: ${failEntry.text}`,
          ],
        }
      }

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
    set({ coreTemp: Math.max(280, Math.min(1000, temp)) })
  },

  debugTriggerBlackout: () => {
    set((state) => ({
      isBlackout: !state.isBlackout,
      redlineInstability: state.isBlackout ? 0 : 95,
    }))
  },

  debugCompleteShift: () => {
    set({ shiftTimeMinutes: 360, phase: 'victory' })
  },

  tick: () => {
    const state = get()
    if (state.phase !== 'playing') return
    if (state.tutorialStep !== 'DONE') return

    // 1. Advance clock: 360 in-game minutes (00:00 -> 06:00) over 10.5 real minutes (630 real seconds -> ~1.75s per 1 in-game minute)
    // In Sandbox / GodMode (Shift+Space), wrap the clock so the player never runs out of time!
    const SHIFT_MINUTES_PER_SECOND = 1 / 1.75
    const rawNextMinutes = state.shiftTimeMinutes + SHIFT_MINUTES_PER_SECOND
    if (!state.isGodMode && rawNextMinutes >= 360) {
      set({ shiftTimeMinutes: 360, phase: 'victory' })
      return
    }
    const nextMinutes = state.isGodMode
      ? rawNextMinutes % 360
      : Math.min(360, rawNextMinutes)
    const prevWholeMin = Math.floor(state.shiftTimeMinutes)
    const nextWholeMin = Math.floor(nextMinutes)
    const crossedWholeMinute = nextWholeMin !== prevWholeMin

    // 2. Calculate non-cooling overload and Redline instability (`1. COOLING` never causes Redline overload!)
    const nonCoolingMW =
      state.powerAllocation.defense +
      state.powerAllocation.facility +
      (state.ventilationActive ? 10 : 0)
    const totalMW = state.powerAllocation.cooling + nonCoolingMW
    const isRedline = totalMW > 130 || nonCoolingMW > 90

    let nextInstability = state.redlineInstability
    let nextBlackout = state.isBlackout
    let nextAlloc = { ...state.powerAllocation }
    const newLogs: TerminalLogEntry[] = []

    if (isRedline && !state.isBlackout) {
      const excessMW = Math.max(totalMW - 130, nonCoolingMW - 90)
      nextInstability = Math.min(100, state.redlineInstability + (excessMW / 10) * 2.2)
      if (nextInstability >= 100 && !state.isGodMode) {
        nextBlackout = true
        nextInstability = 60
        newLogs.push(
          createLogEntry(
            nextMinutes,
            'K.O.M.R.A.D.-84',
            'REDLINE OVERLOAD! MAIN BREAKER TRIPPED OPEN! TRIM 50HZ RHEOSTAT TO 49-51 HZ & CLOSE BREAKER [SPACE]!',
            'danger'
          )
        )
      }
    } else {
      nextInstability = Math.max(0, state.redlineInstability - 4)
    }

    const nextTemp = state.coreTemp

    // 3. CIA Cyber Intrusion & K.O.M.R.A.D.-84 gaslighting events
    let nextCiaActive = state.ciaIntrusionActive
    let nextCiaProgress = state.ciaIntrusionProgress
    let nextKomradLock = state.komradOverrideLocked

    if (
      !nextCiaActive &&
      crossedWholeMinute &&
      nextWholeMin >= 48 &&
      nextWholeMin % 48 === 0
    ) {
      nextCiaActive = true
      nextCiaProgress = 15
      newLogs.push(
        createLogEntry(
          nextMinutes,
          'SYS.DEFENSE',
          'INTRUSION DETECTED IN SECTOR 07! ROUTE >= 20 MW TO [DEFENSE] & PURGE FIREWALL.',
          'danger'
        )
      )
    } else if (nextCiaActive) {
      const defenseShield = state.powerAllocation.defense >= 30 ? -8 : 5
      nextCiaProgress = Math.max(0, Math.min(100, nextCiaProgress + defenseShield))
      if (nextCiaProgress === 0) {
        nextCiaActive = false
        newLogs.push(
          createLogEntry(
            nextMinutes,
            'SYS.DEFENSE',
            'PASSIVE DEFENSE SHIELD DEFLECTED CIA TELEMETRY PROBE.',
            'normal'
          )
        )
      } else if (nextCiaProgress >= 100) {
        nextCiaActive = false
        nextCiaProgress = 0
        if (!state.isGodMode) {
          nextKomradLock = true
          nextAlloc = {
            cooling: 20,
            defense: 10,
            facility: 50,
          }
          newLogs.push(
            createLogEntry(
              nextMinutes,
              'K.O.M.R.A.D.-84',
              'OPTIMIZATION DECREE: COOLING DIVERTED TO ILLUMINATE LENIN COURTYARD STATUE. CLICK [OVERRIDE AI]!',
              'danger'
            )
          )
        }
      }
    }

    // Periodic English K.O.M.R.A.D.-84 status alerts when secondary parameters cross 80%
    if (nextTemp >= 750 && state.coreTemp < 750) {
      newLogs.push(
        createLogEntry(
          nextMinutes,
          'K.O.M.R.A.D.-84',
          `WARNING: CORE TEMP AT ${Math.round(nextTemp)}°C! CRANK COOLING PUMPS OR INJECT BORON ON UNIT A!`,
          'warn'
        )
      )
    }
    if (
      state.bubblerLevel >= 85 &&
      crossedWholeMinute &&
      nextWholeMin % 12 === 0
    ) {
      newLogs.push(
        createLogEntry(
          nextMinutes,
          'K.O.M.R.A.D.-84',
          `UNIT B BUBBLER POOL AT ${Math.round(state.bubblerLevel)}%! PULL BUBBLER DRAIN LEVER ON UNIT B TO PREVENT STEAM BACK-PRESSURE!`,
          'warn'
        )
      )
    }
    if (
      state.graphiteTemp >= 640 &&
      crossedWholeMinute &&
      nextWholeMin % 12 === 0
    ) {
      newLogs.push(
        createLogEntry(
          nextMinutes,
          'K.O.M.R.A.D.-84',
          `UNIT B GRAPHITE TEMP AT ${Math.round(state.graphiteTemp)}°C! OPEN HELIUM-N2 GAS REGULATOR ON UNIT B!`,
          'danger'
        )
      )
    }

    // 5. Pravda Dot-Matrix Printer progress (strictly gated by 3D Inspector Desk single-paper & cooldown rules)
    const facilitySpeed = state.isBlackout
      ? 1
      : Math.max(2, (state.powerAllocation.facility / 20) * 2.5)
    let nextPrinterProgress = state.printerProgress
    let nextDirectives = state.activeDirectives
    if (state.activeDirectives.length === 0 && shiftElapsedSeconds >= 15) {
      nextPrinterProgress = Math.min(100, state.printerProgress + facilitySpeed)
      if (nextPrinterProgress >= 100) {
        const spawned = createDirectiveInstance()
        nextDirectives = [spawned]
        nextPrinterProgress = 0
      }
    }

    const nextPhase = !state.isGodMode && nextTemp >= 1000 ? 'meltdown' : state.phase
    const updatedEntries =
      newLogs.length > 0
        ? [...state.terminalEntries.slice(-24), ...newLogs]
        : state.terminalEntries

    set({
      shiftTimeMinutes: nextMinutes,
      coreTemp: nextTemp,
      powerAllocation: nextAlloc,
      redlineInstability: nextInstability,
      isBlackout: nextBlackout,
      az5Cooldown: Math.max(0, state.az5Cooldown - 1),
      ciaIntrusionActive: nextCiaActive,
      ciaIntrusionProgress: nextCiaProgress,
      komradOverrideLocked: nextKomradLock,
      printerProgress: nextPrinterProgress,
      activeDirectives: nextDirectives,
      phase: nextPhase,
      terminalEntries: updatedEntries,
      terminalLogs: updatedEntries.map((e) => `[${e.timestamp}] ${e.sender}: ${e.text}`),
    })
  },
}))

export const useReactorStore = useGameStore
