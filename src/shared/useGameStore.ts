// Shared Contract: Cross-module Zustand store
import { create } from 'zustand'
import type {
  AppliedStampMark,
  CameraStation,
  DirectiveDecision,
  DirectiveDocument,
  GameState,
  HotspotSeverity,
  OperationalMandate,
  SystemType,
  TerminalLogEntry,
} from './types'

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
    title: 'MANDATE 44-A // PRIMARY COOLING & LUBE BOOST',
    requirementText: 'SET [1. COOLING] >= 50 MW (UNIT A) & OIL COOLER >= 70% (UNIT A-2)',
  },
  {
    code: 'DEFENSE_HZ',
    title: 'MANDATE 19-B // CYBER SHIELD & 50HZ GRID SYNC',
    requirementText: 'SET [2. DEFENSE] >= 40 MW (UNIT A) & TRIM GRID TO 49.5-50.5 HZ (RIGHT PANEL)',
  },
  {
    code: 'PUMP_B_SEAL',
    title: 'MANDATE 71-K // CONTAINMENT LOCK & PUMP B FLOW',
    requirementText: 'CRANK COOLING PUMP B >= 70% (UNIT A) & LOCK ALL 3 SEALS (UNIT B)',
  },
  {
    code: 'FACILITY_BUBBLER',
    title: 'MANDATE 88-B // BUNKER POWER & BUBBLER DRAIN',
    requirementText: 'SET [3. FACILITY] >= 30 MW (UNIT A) & DRAIN BUBBLER H2O < 45% (UNIT B)',
  },
]

let directiveCounter = 100
let logCounter = 1
let mandateCounter = 0
let hotspotAccumulator = 0

function createNextMandate(): OperationalMandate {
  const tpl = MANDATE_BLUEPRINTS[mandateCounter % MANDATE_BLUEPRINTS.length]
  mandateCounter += 1
  return {
    ...tpl,
    id: `MND-84-${mandateCounter}`,
    fulfilled: false,
  }
}

function isMandateSatisfied(state: GameState, mandate: OperationalMandate): boolean {
  switch (mandate.code) {
    case 'COOLING_OIL':
      return state.powerAllocation.cooling >= 50 && state.oilCoolerValve >= 70
    case 'DEFENSE_HZ':
      return (
        state.powerAllocation.defense >= 40 &&
        state.gridHz >= 49.5 &&
        state.gridHz <= 50.5
      )
    case 'PUMP_B_SEAL':
      return (
        state.pumpsActive[1] &&
        state.pumpThrottle[1] >= 70 &&
        state.containmentSealLocked
      )
    case 'FACILITY_BUBBLER':
      return state.powerAllocation.facility >= 30 && state.bubblerLevel < 45
  }
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
    'REMINDER: MELTDOWN IS CAPITALIST PROPAGANDA. HOLD [SHIFT] TO OPERATE POWER LEVERS.',
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

  coreTemp: 340,
  pressureBar: 44,
  radiationLevel: 0.4,
  maxSafePower: 100,
  powerAllocation: {
    cooling: 40,
    defense: 30,
    facility: 20,
  },
  redlineInstability: 0,
  isBlackout: false,
  pumpsActive: [true, true],
  pumpThrottle: [100, 100],
  pumpAHeat: 14,
  pumpBHeat: 14,
  lubeOilPressure: 82,
  oilCoolerValve: 60,
  boronTankLevel: 100,
  channelHotspots: {},
  graphiteTemp: 330,
  nitrogenLoopValve: 60,
  heliumPressure: 38,
  bubblerLevel: 28,
  bubblerDraining: false,
  sealToggles: [true, true, true],
  containmentSealLocked: true,
  ventingSteam: false,
  turbineRpm: 3000,
  gridHz: 50.0,
  excitationTrim: 0.0,
  hzOutOfBoundsSeconds: 0,
  ventilationActive: false,
  kgbLineActive: true,
  boronCooldown: 0,
  az5Available: true,
  az5Cooldown: 0,

  terminalLogs: INITIAL_ENTRIES.map((e) => `[${e.timestamp}] ${e.sender}: ${e.text}`),
  terminalEntries: INITIAL_ENTRIES,
  ciaIntrusionActive: false,
  ciaIntrusionProgress: 0,
  komradOverrideLocked: false,

  activeDirectives: [createDirectiveInstance(false), createDirectiveInstance(true)],
  printerProgress: 25,

  setActiveStation: (station: CameraStation) => {
    set({ activeStation: station })
  },

  startShift: () => {
    const firstMandate = createNextMandate()
    const entry = createLogEntry(
      0,
      'K.O.M.R.A.D.-84',
      `MAIN BREAKER ENGAGED. SHIFT 1 COMMENCING. ${firstMandate.requirementText}`,
      'normal'
    )
    set((state) => ({
      phase: 'playing',
      activeMandate: firstMandate,
      lastDecisionFeedback: firstMandate.requirementText,
      terminalEntries: [...state.terminalEntries.slice(-24), entry],
      terminalLogs: [
        ...state.terminalLogs.slice(-24),
        `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
      ],
    }))
  },

  resetShift: () => {
    hotspotAccumulator = 0
    const firstMandate = createNextMandate()
    const freshEntries = [
      createLogEntry(
        0,
        'K.O.M.R.A.D.-84',
        'SHIFT RESET BY OPERATOR. ALL GAUGES NORMALIZED BY DECREE.',
        'normal'
      ),
    ]
    set({
      phase: 'playing',
      shiftTimeMinutes: 0,
      treasonStrikes: 0,
      lastDecisionFeedback: firstMandate.requirementText,
      activeMandate: firstMandate,
      coreTemp: 340,
      pressureBar: 44,
      radiationLevel: 0.4,
      powerAllocation: { cooling: 40, defense: 30, facility: 20 },
      redlineInstability: 0,
      isBlackout: false,
      pumpsActive: [true, true],
      pumpThrottle: [100, 100],
      pumpAHeat: 14,
      pumpBHeat: 14,
      lubeOilPressure: 82,
      oilCoolerValve: 60,
      boronTankLevel: 100,
      channelHotspots: {},
      graphiteTemp: 330,
      nitrogenLoopValve: 60,
      heliumPressure: 38,
      bubblerLevel: 28,
      bubblerDraining: false,
      sealToggles: [true, true, true],
      containmentSealLocked: true,
      ventingSteam: false,
      turbineRpm: 3000,
      gridHz: 50.0,
      excitationTrim: 0.0,
      hzOutOfBoundsSeconds: 0,
      ventilationActive: false,
      kgbLineActive: true,
      boronCooldown: 0,
      az5Available: true,
      az5Cooldown: 0,
      ciaIntrusionActive: false,
      ciaIntrusionProgress: 0,
      komradOverrideLocked: false,
      activeDirectives: [createDirectiveInstance(false), createDirectiveInstance(true)],
      printerProgress: 20,
      terminalEntries: freshEntries,
      terminalLogs: freshEntries.map((e) => `[${e.timestamp}] ${e.sender}: ${e.text}`),
    })
  },

  setShiftKeyHeld: (held: boolean) => {
    set({ isShiftKeyHeld: held })
  },

  shiftPower: (system: SystemType, deltaMW: number) => {
    const state = get()
    const target = state.powerAllocation[system] + deltaMW
    state.setSubsystemPower(system, target)
  },

  setSubsystemPower: (system: SystemType, targetMW: number) => {
    const state = get()
    if (!state.isShiftKeyHeld || state.isBlackout || state.komradOverrideLocked) {
      return
    }
    const clamped = Math.max(0, Math.min(80, Math.round(targetMW / 10) * 10))
    const prevMW = state.powerAllocation[system]
    if (clamped === prevMW) return
    const nextAlloc = {
      ...state.powerAllocation,
      [system]: clamped,
    }
    const totalMW = nextAlloc.cooling + nextAlloc.defense + nextAlloc.facility
    if (totalMW > 180) {
      return
    }
    // Immediate counter-reaction: +10 MW load pulls gridHz down by -0.08 Hz immediately
    const deltaTenMW = (clamped - prevMW) / 10
    const nextHz = Number(
      Math.max(45.0, Math.min(55.0, state.gridHz - deltaTenMW * 0.08)).toFixed(2)
    )
    set({ powerAllocation: nextAlloc, gridHz: nextHz })
  },

  togglePump: (pumpIndex: 0 | 1, active?: boolean) => {
    set((state) => {
      const next: [boolean, boolean] = [...state.pumpsActive] as [boolean, boolean]
      const targetActive = typeof active === 'boolean' ? active : !next[pumpIndex]
      const currentHeat = pumpIndex === 0 ? state.pumpAHeat : state.pumpBHeat
      if (targetActive && currentHeat >= 99) {
        return state
      }
      next[pumpIndex] = targetActive
      const nextThrottle: [number, number] = [...state.pumpThrottle] as [number, number]
      nextThrottle[pumpIndex] = targetActive ? 100 : 0
      const statusText = next[pumpIndex] ? 'ENGAGED' : 'DISENGAGED'
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
      const clamped =
        currentHeat >= 99 ? 0 : Math.max(0, Math.min(100, Math.round(throttlePct)))
      const nextThrottle: [number, number] = [...state.pumpThrottle] as [number, number]
      nextThrottle[pumpIndex] = clamped
      const nextActive: [boolean, boolean] = [
        nextThrottle[0] > 0,
        nextThrottle[1] > 0,
      ]
      return {
        pumpThrottle: nextThrottle,
        pumpsActive: nextActive,
      }
    })
  },

  setOilCoolerValve: (valvePct: number) => {
    set({ oilCoolerValve: Math.max(0, Math.min(100, Math.round(valvePct))) })
  },

  pumpBoronTank: (amountPct = 14) => {
    set((state) => {
      const nextLevel = Math.min(100, Math.round(state.boronTankLevel + amountPct))
      const nextCooldown = Math.max(0, state.boronCooldown - 5.5)
      return {
        boronTankLevel: nextLevel,
        boronCooldown: nextCooldown,
      }
    })
  },

  quenchChannelHotspot: (channelIndex: number) => {
    set((state) => {
      const severity = state.channelHotspots[channelIndex]
      const nextHotspots = { ...state.channelHotspots }
      delete nextHotspots[channelIndex]

      const tempDrop = severity === 'red' ? 18 : severity === 'amber' ? 11 : 5
      const pressDrop = severity === 'red' ? 3.2 : severity === 'amber' ? 1.8 : 0.8
      const nextTemp = Math.max(290, state.coreTemp - tempDrop)
      const nextPress = Math.max(30, Number((state.pressureBar - pressDrop).toFixed(1)))

      if (severity) {
        const entry = createLogEntry(
          state.shiftTimeMinutes,
          'OPERATOR',
          `LOCAL CONTROL ROD INSERTED IN RBMK CHANNEL #${channelIndex + 1} (${severity.toUpperCase()} HOTSPOT QUENCHED, -${tempDrop}°C).`,
          'normal'
        )
        return {
          channelHotspots: nextHotspots,
          coreTemp: nextTemp,
          pressureBar: nextPress,
          terminalEntries: [...state.terminalEntries.slice(-24), entry],
          terminalLogs: [
            ...state.terminalLogs.slice(-24),
            `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
          ],
        }
      }
      return {
        coreTemp: nextTemp,
        pressureBar: nextPress,
      }
    })
  },

  setNitrogenLoopValve: (valvePct: number) => {
    set({ nitrogenLoopValve: Math.max(0, Math.min(100, Math.round(valvePct))) })
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
    set((state) => ({
      excitationTrim: Number(
        Math.max(-5.0, Math.min(5.0, state.excitationTrim + deltaHz)).toFixed(2)
      ),
    }))
  },

  toggleVentilation: (active?: boolean) => {
    set((state) => {
      const nextVent =
        typeof active === 'boolean' ? active : !state.ventilationActive
      const deltaHz = nextVent ? -0.08 : 0.08
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'OPERATOR',
        `BUNKER VENTILATION SCRUBBER ${nextVent ? 'ENGAGED (-1.2 R/H/S, +10 MW PARASITIC LOAD)' : 'DISENGAGED'}.`,
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
    set((state) => ({
      kgbLineActive:
        typeof active === 'boolean' ? active : !state.kgbLineActive,
    }))
  },

  injectBoronAcid: () => {
    const state = get()
    if (state.boronCooldown > 0 || state.isBlackout) return
    if (state.boronTankLevel < 35) {
      const warnEntry = createLogEntry(
        state.shiftTimeMinutes,
        'K.O.M.R.A.D.-84',
        `BORON INJECTION FAILED: BORON TANK AT ${Math.round(state.boronTankLevel)}%! PUMP BORON PISTON ON UNIT A-2 (>= 35% REQUIRED)!`,
        'danger'
      )
      set({
        lastDecisionFeedback: 'BORON TANK LOW! PUMP BORON PISTON ON UNIT A-2!',
        terminalEntries: [...state.terminalEntries.slice(-24), warnEntry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${warnEntry.timestamp}] ${warnEntry.sender}: ${warnEntry.text}`,
        ],
      })
      return
    }
    const nextTemp = Math.max(265, state.coreTemp - 85)
    const nextPressure = Math.max(30, state.pressureBar - 14)
    const nextBoronLevel = Math.max(0, state.boronTankLevel - 35)
    const entry = createLogEntry(
      state.shiftTimeMinutes,
      'OPERATOR',
      `BORON ACID INJECTED (-85°C, -35% BORON TANK -> ${Math.round(nextBoronLevel)}% REMAINING). REFILL ON UNIT A-2!`,
      'normal'
    )
    set({
      coreTemp: nextTemp,
      pressureBar: nextPressure,
      boronTankLevel: nextBoronLevel,
      boronCooldown: 22,
      lastDecisionFeedback: `BORON INJECTED (-85°C)! BORON TANK AT ${Math.round(nextBoronLevel)}% — PUMP ON UNIT A-2 TO REFILL`,
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
    flawText?: string | null
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
      let feedback = ''
      let logLevel: TerminalLogEntry['level'] = 'normal'

      if (!isForgery && decision === 'APPROVED') {
        // Genuine Directive Dispatched -> Assign new Moscow Operational Mandate & cool slightly
        nextMandate = createNextMandate()
        nextTemp = Math.max(290, state.coreTemp - 28)
        nextPressure = Math.max(32, Number((state.pressureBar - 5).toFixed(1)))
        feedback = `ORDER DISPATCHED (${docTitle.slice(0, 26)})! NEW ${nextMandate.requirementText}`
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
        // Caught & Shredded Western Forgery -> Stabilize reactor instability (-15%), cool graphite & core, clear 1 hotspot!
        nextInstability = Math.max(0, state.redlineInstability - 15)
        nextTemp = Math.max(290, state.coreTemp - 35)
        nextGraphite = Math.max(290, state.graphiteTemp - 45)
        nextOilPress = Math.min(100, state.lubeOilPressure + 12)
        const hotspotKeys = Object.keys(nextHotspots)
        if (hotspotKeys.length > 0) {
          delete nextHotspots[Number(hotspotKeys[0])]
        }
        feedback = `CIA SABOTAGE SHREDDED (${docTitle.slice(0, 22)})! INSTABILITY -15%, CORE -35°C, GRAPHITE -45°C.`
        logLevel = 'normal'
      } else {
        // Forged Western Sabotage Approved & Dispatched -> Immediate Cross-Panel Sabotage Event!
        if (!state.isGodMode) {
          nextStrikes = Math.min(3, state.treasonStrikes + 1)
        }
        nextTemp = Math.min(980, state.coreTemp + 95)
        nextPressure = Math.min(118, Number((state.pressureBar + 18).toFixed(1)))
        nextGraphite = Math.min(820, state.graphiteTemp + 85)
        nextHelium = Math.max(8, state.heliumPressure - 18)
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
        feedback = `CIA SABOTAGE EXECUTED (${flawText ?? 'FORGERY'})! 3 RED HOTSPOTS ON UNIT A-2, N2 LOOP DROPPED ON UNIT B, GRID HZ DESYNCED!`
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
    const dt = Math.max(0, Math.min(0.25, dtSeconds))
    if (dt === 0) return

    const newLogs: TerminalLogEntry[] = []

    // =========================================================================
    // 1. UNIT A & UNIT A-2: Pump Cavitation, Lube Oil Pressure & Bearing Heat
    // =========================================================================
    const tA = state.isBlackout ? 0 : state.pumpThrottle[0] / 100
    const tB = state.isBlackout ? 0 : state.pumpThrottle[1] / 100
    const bothRunning = tA > 0.5 && tB > 0.5
    const oilValveRatio = state.oilCoolerValve / 100

    // Running pumps drains lubeOilPressure; opening OIL COOLER VALVE on UNIT A-2 restores it
    const oilDrainRate = (tA + tB) * 1.45
    const oilRestoreRate = state.isBlackout ? 0 : oilValveRatio * 2.45
    const nextLubeOil = Math.max(
      5,
      Math.min(100, state.lubeOilPressure + (oilRestoreRate - oilDrainRate) * dt)
    )

    // Low oil pressure (< 30%) accelerates bearing heat 2.2x faster!
    const lowOilPenalty = nextLubeOil < 30 ? 2.2 : 1.0
    const cavitationRate = bothRunning ? 3.5 * tA * tB : 0
    const oilCoolingBonus = state.isBlackout ? 0 : oilValveRatio * 1.85

    let nextHeatA =
      state.pumpAHeat +
      (tA > 0
        ? ((1.8 * tA + cavitationRate) * lowOilPenalty - oilCoolingBonus) * dt
        : (-2.5 - oilCoolingBonus) * dt)
    let nextHeatB =
      state.pumpBHeat +
      (tB > 0
        ? ((1.8 * tB + cavitationRate) * lowOilPenalty - oilCoolingBonus) * dt
        : (-2.5 - oilCoolingBonus) * dt)

    nextHeatA = Math.max(0, Math.min(100, nextHeatA))
    nextHeatB = Math.max(0, Math.min(100, nextHeatB))

    const nextThrottle: [number, number] = [...state.pumpThrottle] as [
      number,
      number,
    ]
    const nextPumps: [boolean, boolean] = [...state.pumpsActive] as [
      boolean,
      boolean,
    ]

    if (nextHeatA >= 100 && state.pumpsActive[0]) {
      nextPumps[0] = false
      nextThrottle[0] = 0
      newLogs.push(
        createLogEntry(
          state.shiftTimeMinutes,
          'K.O.M.R.A.D.-84',
          'CAVITATION SEIZURE! COOLING PUMP A BEARING OVERHEATED (100%) AND TRIPPED OFF!',
          'danger'
        )
      )
    }
    if (nextHeatB >= 100 && state.pumpsActive[1]) {
      nextPumps[1] = false
      nextThrottle[1] = 0
      newLogs.push(
        createLogEntry(
          state.shiftTimeMinutes,
          'K.O.M.R.A.D.-84',
          'CAVITATION SEIZURE! COOLING PUMP B BEARING OVERHEATED (100%) AND TRIPPED OFF!',
          'danger'
        )
      )
    }

    // =========================================================================
    // 2. UNIT A-2: 37-Channel RBMK Core Map Hotspots (Cavitation & Thermal Trigger)
    // =========================================================================
    const nextHotspots: Record<number, HotspotSeverity> = {
      ...state.channelHotspots,
    }
    if (state.phase === 'playing' && !state.isBlackout) {
      const cavitationTrigger = bothRunning ? 1.15 : 0
      const thermalTrigger = state.coreTemp > 470 ? 0.65 : 0
      hotspotAccumulator += (cavitationTrigger + thermalTrigger) * dt

      if (hotspotAccumulator >= 6.0) {
        hotspotAccumulator = 0
        const keys = Object.keys(nextHotspots).map(Number)
        // First check if an amber hotspot escalates to red
        const amberKey = keys.find((k) => nextHotspots[k] === 'amber')
        if (typeof amberKey === 'number' && (bothRunning || state.coreTemp > 520)) {
          nextHotspots[amberKey] = 'red'
          newLogs.push(
            createLogEntry(
              state.shiftTimeMinutes,
              'K.O.M.R.A.D.-84',
              `RBMK CHANNEL #${amberKey + 1} ESCALATED TO RED CRITICAL HOTSPOT (+5°C/S)! CLICK TILE ON UNIT A-2!`,
              'danger'
            )
          )
        } else if (keys.length < 6) {
          // Pick a deterministic-random channel 0..36
          const seed = Math.floor(state.shiftTimeMinutes * 13 + state.coreTemp) % 37
          for (let offset = 0; offset < 37; offset++) {
            const candidate = (seed + offset * 7) % 37
            if (!nextHotspots[candidate]) {
              nextHotspots[candidate] =
                bothRunning && state.coreTemp > 540 ? 'red' : 'amber'
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
    // 3. UNIT B: Graphite Moderator Temp, Helium-N2 Loop & Bubbler Pool Flood
    // =========================================================================
    const n2ValveRatio = state.nitrogenLoopValve / 100
    const n2PurgeSwitchOn = state.sealToggles[0]
    const effectiveN2Flow = state.isBlackout
      ? 0
      : n2ValveRatio * (n2PurgeSwitchOn ? 1.0 : 0.35)

    // High coreTemp (> 480°C) or high pressureBar (> 75 BAR) consumes Helium-N2 pressure
    const gasConsumption =
      (state.coreTemp > 480 ? 1.25 : 0.35) +
      (state.pressureBar > 75 ? 1.1 : 0)
    const targetHelium = state.isBlackout
      ? 10
      : Math.max(
          6,
          Math.min(58, 16 + effectiveN2Flow * 38 - gasConsumption * 6)
        )
    const nextHelium = Number(
      (
        state.heliumPressure +
        (targetHelium - state.heliumPressure) * Math.min(1, dt * 1.8)
      ).toFixed(1)
    )

    // Graphite Moderator Temp heats up from Core Temp & low Helium-N2 flow
    const graphiteHeatPush =
      state.coreTemp > 480 ? (state.coreTemp - 480) * 0.085 : 0
    const graphitePressurePush =
      state.pressureBar > 75 ? (state.pressureBar - 75) * 0.32 : 0
    const graphiteGasCooling = effectiveN2Flow * 11.5
    const baselineGraphite = 285 + (state.coreTemp - 290) * 0.62
    const nextGraphite = Math.max(
      275,
      Math.min(
        850,
        state.graphiteTemp +
          ((baselineGraphite - state.graphiteTemp) * 0.25 +
            graphiteHeatPush +
            graphitePressurePush -
            graphiteGasCooling) *
            dt
      )
    )

    // Excess steam condenses into UNIT B Bubbler Pool; pulling BUBBLER DRAIN drains it
    const steamToBubblerRate =
      (state.ventingSteam ? 6.5 : 0) +
      (state.pressureBar > 60 ? (state.pressureBar - 60) * 0.09 : 0.25)
    const nextBubbler = state.bubblerDraining
      ? Math.max(6, state.bubblerLevel - 24 * dt)
      : Math.min(100, state.bubblerLevel + steamToBubblerRate * dt)
    const bubblerFlooded = nextBubbler > 90

    // =========================================================================
    // 4. Cross-Coupled Core Temp, Steam Pressure & Room Radiation
    // =========================================================================
    const totalMW =
      state.powerAllocation.cooling +
      state.powerAllocation.defense +
      state.powerAllocation.facility +
      (state.ventilationActive ? 10 : 0)

    // Continuous Core Temp coupling:
    // - Higher MW load increases core heat generation
    // - High Oil Cooler Valve opening diverts up to 15% of pump head pressure (parasitic drag)
    // - Each Red Hotspot adds +5°C/s; each Amber Hotspot adds +1.5°C/s
    // - Graphite Temp > 650°C triggers positive void reactivity (+6.5°C/s)
    const oilParasiticDrag = 1 - oilValveRatio * 0.15
    const pumpFlowSum = (tA + tB) * oilParasiticDrag
    const coolingMWFactor = state.isBlackout
      ? 0.1
      : (state.powerAllocation.cooling / 40) * (0.4 + pumpFlowSum * 0.42)

    const mwHeatRate = Math.max(0, totalMW - 75) * 0.095
    const hotspotHeatRate = redHotspotCount * 5.0 + amberHotspotCount * 1.5
    const positiveVoidRate =
      nextGraphite > 650 ? ((nextGraphite - 650) / 50) * 6.5 : 0
    const continuousNetHeat =
      state.phase === 'playing'
        ? (mwHeatRate + hotspotHeatRate + positiveVoidRate - coolingMWFactor * 2.6) *
          dt
        : 0

    let nextCoreTemp = Math.max(285, state.coreTemp + continuousNetHeat)
    if (state.isGodMode && nextCoreTemp > 920) {
      nextCoreTemp = 920
    }

    // Steam Pressure (0-120 BAR):
    // - Hotspots add +1.2 BAR/s per Red hotspot
    // - Flooded Bubbler (> 90%) blocks steam relief and adds +1.6 BAR/s back-pressure!
    const pumpFlowFactor = (nextThrottle[0] + nextThrottle[1]) / 200
    const targetPressureFromTemp =
      35 + ((nextCoreTemp - 290) / 700) * 85 + (1 - pumpFlowFactor) * 18
    const hotspotPressurePush =
      (redHotspotCount * 1.2 + amberHotspotCount * 0.35) * dt
    const bubblerBackPressure = bubblerFlooded ? 1.6 * dt : 0

    let nextPressure = state.pressureBar
    if (state.ventingSteam) {
      // If UNIT B Bubbler is flooded (> 90%), back-pressure blocks 78% of steam relief!
      const ventRate = bubblerFlooded ? 4.0 : 18.0
      nextPressure = Math.max(
        28,
        state.pressureBar - ventRate * dt + hotspotPressurePush
      )
    } else {
      const pressureDrift = (targetPressureFromTemp - state.pressureBar) * 0.65 * dt
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
        nextInstability + ((nextPressure - 95) / 25) * 4.2 * dt
      )
    }

    // Room Radiation (Dosimeter R/H):
    // - Steam venting spikes radiation (+0.85 R/H/s, or +2.2 R/H/s if UNIT B Containment Seal unlocked or Bubbler flooded!)
    // - Ventilation scrubs -1.2 R/H/s (or -1.6 R/H/s if UNIT B RAD FILTER toggle is ON)
    let nextRad = state.radiationLevel
    if (state.ventingSteam) {
      const unsealedPenalty =
        !state.containmentSealLocked || bubblerFlooded ? 2.2 : 0.85
      nextRad = Math.min(15.0, nextRad + unsealedPenalty * dt)
    } else if (!state.containmentSealLocked && nextPressure > 75) {
      nextRad = Math.min(15.0, nextRad + 0.45 * dt)
    }

    if (state.ventilationActive && !state.isBlackout) {
      const radFilterBoost = state.sealToggles[1] ? 1.45 : 1.2
      nextRad = Math.max(0.1, nextRad - radFilterBoost * dt)
    } else {
      const baselineRad = Math.max(0.2, ((nextCoreTemp - 280) / 720) * 12)
      nextRad = Math.max(
        0.1,
        Math.min(15.0, nextRad + (baselineRad - nextRad) * 0.18 * dt)
      )
    }

    // =========================================================================
    // 5. Right Panel: Turbine RPM & 50.0 Hz Grid Frequency Coupling
    // =========================================================================
    const targetRpm = state.isBlackout
      ? 0
      : Math.min(3600, Math.max(0, 1650 + nextPressure * 24.5 - totalMW * 2.2))
    const nextRpm =
      state.turbineRpm + (targetRpm - state.turbineRpm) * Math.min(1, dt * 3.5)

    // Higher MW load pulls gridHz downward; excitationTrim on Right Panel counter-balances
    const loadOffsetHz = ((90 - totalMW) / 10) * 0.42
    const pressureOffsetHz = ((nextPressure - 52) / 40) * 0.65
    const targetHz = state.isBlackout
      ? 45.0
      : Math.max(
          45.0,
          Math.min(55.0, 50.0 + loadOffsetHz + pressureOffsetHz + state.excitationTrim)
        )
    const nextHz = Number(
      (state.gridHz + (targetHz - state.gridHz) * Math.min(1, dt * 4.0)).toFixed(2)
    )

    let nextHzOut = state.hzOutOfBoundsSeconds
    let nextBlackout = state.isBlackout
    if (
      state.phase === 'playing' &&
      !state.isBlackout &&
      (nextHz < 46.5 || nextHz > 53.5)
    ) {
      nextHzOut += dt
      if (nextHzOut >= 8.0 && !state.isGodMode) {
        nextBlackout = true
        nextHzOut = 0
        newLogs.push(
          createLogEntry(
            state.shiftTimeMinutes,
            'K.O.M.R.A.D.-84',
            `GRID FREQUENCY DEVIATION (${nextHz.toFixed(1)} HZ)! MAIN BREAKER VIOLENTLY TRIPPED OPEN!`,
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
        },
        nextMandate
      )
    ) {
      nextMandate = { ...nextMandate, fulfilled: true }
      nextCoreTemp = Math.max(290, nextCoreTemp - 25)
      nextInstability = Math.max(0, nextInstability - 18)
      nextFeedback = `MANDATE FULFILLED (${nextMandate.title})! CORE -25°C, INSTABILITY -18%. APPROVE NEXT DESK DIRECTIVE!`
      newLogs.push(
        createLogEntry(
          state.shiftTimeMinutes,
          'K.O.M.R.A.D.-84',
          nextFeedback,
          'normal'
        )
      )
    }

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
        activeMandate: nextMandate,
        lastDecisionFeedback: nextFeedback,
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
        activeMandate: nextMandate,
        lastDecisionFeedback: nextFeedback,
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

    // 1. Advance clock (each 1s tick = 2 minutes of shift time -> 3 mins real time for 6 hours)
    // In Sandbox / GodMode (Shift+Space), wrap the clock so the player never runs out of time!
    const rawNextMinutes = state.shiftTimeMinutes + 2
    if (!state.isGodMode && rawNextMinutes >= 360) {
      set({ shiftTimeMinutes: 360, phase: 'victory' })
      return
    }
    const nextMinutes = state.isGodMode
      ? rawNextMinutes % 360
      : Math.min(360, rawNextMinutes)

    // 2. Calculate total MW and Redline instability
    const totalMW =
      state.powerAllocation.cooling +
      state.powerAllocation.defense +
      state.powerAllocation.facility +
      (state.ventilationActive ? 10 : 0)
    const isRedline = totalMW > state.maxSafePower

    let nextInstability = state.redlineInstability
    let nextBlackout = state.isBlackout
    let nextAlloc = { ...state.powerAllocation }
    const newLogs: TerminalLogEntry[] = []

    if (isRedline && !state.isBlackout) {
      const excessMW = totalMW - state.maxSafePower
      nextInstability = Math.min(100, state.redlineInstability + (excessMW / 10) * 4.5)
      if (nextInstability >= 100 && !state.isGodMode) {
        nextBlackout = true
        nextInstability = 60
        nextAlloc = { cooling: 10, defense: 10, facility: 10 }
        newLogs.push(
          createLogEntry(
            nextMinutes,
            'K.O.M.R.A.D.-84',
            'REDLINE BREAKER TRIPPED! TEMPORARY BROWN-OUT INITIATED FOR WORKER HUMILITY.',
            'danger'
          )
        )
      }
    } else {
      nextInstability = Math.max(0, state.redlineInstability - 4)
      if (state.isBlackout && nextInstability <= 20) {
        nextBlackout = false
        newLogs.push(
          createLogEntry(
            nextMinutes,
            'K.O.M.R.A.D.-84',
            'GRID STABILIZED. POWER ROUTING RESTORED.',
            'normal'
          )
        )
      }
    }

    // 3. Calculate Core Temperature physics (scaled by continuous pump valve throttle & UNIT A-2 oil cooler drag)
    const oilParasiticDrag = 1 - (state.oilCoolerValve / 100) * 0.15
    const pumpFlowSum =
      ((state.pumpsActive[0] ? state.pumpThrottle[0] / 100 : 0) +
        (state.pumpsActive[1] ? state.pumpThrottle[1] / 100 : 0)) *
      oilParasiticDrag
    const effectiveCoolingMW = state.isBlackout
      ? 5
      : state.powerAllocation.cooling * (0.35 + pumpFlowSum * 0.35)

    // Base heat generation scales with totalMW and night progress
    const baseHeatDelta =
      9 +
      (nextMinutes / 360) * 4 +
      Math.max(0, totalMW - 70) * 0.08 +
      (isRedline ? 6 : 0)
    const coolingEffect = (effectiveCoolingMW / 40) * 11.5
    let netTempDelta = baseHeatDelta - coolingEffect

    if (pumpFlowSum <= 0.05) {
      netTempDelta += 12
    }

    let nextTemp = Math.max(290, state.coreTemp + netTempDelta)
    if (state.isGodMode && nextTemp > 920) {
      nextTemp = 920
    }

    // 4. CIA Cyber Intrusion & K.O.M.R.A.D.-84 gaslighting events
    let nextCiaActive = state.ciaIntrusionActive
    let nextCiaProgress = state.ciaIntrusionProgress
    let nextKomradLock = state.komradOverrideLocked

    if (!nextCiaActive && nextMinutes % 36 === 0) {
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
      const defenseShield = state.powerAllocation.defense >= 40 ? -6 : 9
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
            cooling: 10,
            defense: 10,
            facility: 60,
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
    if (state.bubblerLevel >= 85 && nextMinutes % 12 === 0) {
      newLogs.push(
        createLogEntry(
          nextMinutes,
          'K.O.M.R.A.D.-84',
          `UNIT B BUBBLER POOL AT ${Math.round(state.bubblerLevel)}%! PULL BUBBLER DRAIN LEVER ON UNIT B TO PREVENT STEAM BACK-PRESSURE!`,
          'warn'
        )
      )
    }
    if (state.graphiteTemp >= 640 && nextMinutes % 12 === 0) {
      newLogs.push(
        createLogEntry(
          nextMinutes,
          'K.O.M.R.A.D.-84',
          `UNIT B GRAPHITE TEMP AT ${Math.round(state.graphiteTemp)}°C! OPEN HELIUM-N2 GAS REGULATOR ON UNIT B!`,
          'danger'
        )
      )
    }

    // 5. Pravda Dot-Matrix Printer progress (scales with FACILITY power)
    const facilitySpeed = state.isBlackout
      ? 2
      : Math.max(3, (state.powerAllocation.facility / 20) * 8)
    let nextPrinterProgress = state.printerProgress + facilitySpeed
    let nextDirectives = state.activeDirectives

    if (nextPrinterProgress >= 100) {
      if (state.activeDirectives.length < 5) {
        const spawned = createDirectiveInstance()
        nextDirectives = [...state.activeDirectives, spawned]
        newLogs.push(
          createLogEntry(
            nextMinutes,
            'PRINTER',
            `INCOMING DIRECTIVE: ${spawned.id} (${spawned.title}).`,
            'normal'
          )
        )
      }
      nextPrinterProgress = 0
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
