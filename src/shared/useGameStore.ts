// Shared Contract: Cross-module Zustand store
import { create } from 'zustand'
import type {
  AppliedStampMark,
  DirectiveDecision,
  DirectiveDocument,
  GameState,
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

let directiveCounter = 100
let logCounter = 1

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
  shiftNumber: 1,
  shiftTimeMinutes: 0,
  isShiftKeyHeld: false,
  isGodMode: false,
  isMusicMuted: false,
  treasonStrikes: 0,
  lastDecisionFeedback: null,

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
  az5Available: true,
  az5Cooldown: 0,

  terminalLogs: INITIAL_ENTRIES.map((e) => `[${e.timestamp}] ${e.sender}: ${e.text}`),
  terminalEntries: INITIAL_ENTRIES,
  ciaIntrusionActive: false,
  ciaIntrusionProgress: 0,
  komradOverrideLocked: false,

  activeDirectives: [createDirectiveInstance(false), createDirectiveInstance(true)],
  printerProgress: 25,

  startShift: () => {
    const entry = createLogEntry(
      0,
      'K.O.M.R.A.D.-84',
      'MAIN BREAKER ENGAGED. NIGHT SHIFT 1 (00:00 - 06:00) COMMENCING.',
      'normal'
    )
    set((state) => ({
      phase: 'playing',
      terminalEntries: [...state.terminalEntries.slice(-24), entry],
      terminalLogs: [
        ...state.terminalLogs.slice(-24),
        `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
      ],
    }))
  },

  resetShift: () => {
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
      lastDecisionFeedback: null,
      coreTemp: 340,
      pressureBar: 44,
      radiationLevel: 0.4,
      powerAllocation: { cooling: 40, defense: 30, facility: 20 },
      redlineInstability: 0,
      isBlackout: false,
      pumpsActive: [true, true],
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
    const nextAlloc = {
      ...state.powerAllocation,
      [system]: clamped,
    }
    const totalMW = nextAlloc.cooling + nextAlloc.defense + nextAlloc.facility
    if (totalMW > 180) {
      return
    }
    set({ powerAllocation: nextAlloc })
  },

  togglePump: (pumpIndex: 0 | 1, active?: boolean) => {
    set((state) => {
      const next: [boolean, boolean] = [...state.pumpsActive] as [boolean, boolean]
      next[pumpIndex] = typeof active === 'boolean' ? active : !next[pumpIndex]
      const statusText = next[pumpIndex] ? 'ENGAGED' : 'DISENGAGED'
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'OPERATOR',
        `PRIMARY COOLING PUMP ${pumpIndex === 0 ? 'A' : 'B'} ${statusText}.`,
        next[pumpIndex] ? 'normal' : 'warn'
      )
      return {
        pumpsActive: next,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
      }
    })
  },

  triggerAz5: () => {
    const state = get()
    if (!state.az5Available || state.az5Cooldown > 0) return

    const cooledTemp = Math.max(310, state.coreTemp - 280)
    const entry = createLogEntry(
      state.shiftTimeMinutes,
      'K.O.M.R.A.D.-84',
      'AZ-5 BORON RODS DROPPED! CORE TEMP REDUCED. (NOTE: PANIC IS BOURGEOIS WEAKNESS.)',
      'warn'
    )
    set({
      coreTemp: cooledTemp,
      pressureBar: Math.max(38, state.pressureBar - 24),
      redlineInstability: Math.max(0, state.redlineInstability - 40),
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
    set((state) => {
      const doc = state.activeDirectives.find((d) => d.id === id)
      if (!doc) return state

      const remaining = state.activeDirectives.filter((d) => d.id !== id)
      let nextTemp = state.coreTemp
      let nextStrikes = state.treasonStrikes
      let nextPumps: [boolean, boolean] = [...state.pumpsActive] as [boolean, boolean]
      let nextLock = state.komradOverrideLocked
      let feedback = ''
      let logLevel: TerminalLogEntry['level'] = 'normal'

      if (!doc.isCiaForgery && decision === 'APPROVED') {
        // Correct: Authentic Party Order approved
        nextTemp = Math.max(290, state.coreTemp + doc.effectOnApprove.tempDelta)
        feedback = `COMRADE APPROVED VALID ORDER (${doc.id}). CORE TEMP ${doc.effectOnApprove.tempDelta}°C.`
        logLevel = 'normal'
      } else if (!doc.isCiaForgery && decision === 'SHREDDED') {
        // Error: Authentic Party Order shredded -> Treason Strike!
        if (!state.isGodMode) {
          nextStrikes = Math.min(3, state.treasonStrikes + 1)
        }
        feedback = `TREASON STRIKE! YOU SHREDDED AN OFFICIAL PARTY DECREE (${doc.id})!`
        logLevel = 'danger'
      } else if (doc.isCiaForgery && decision === 'SHREDDED') {
        // Correct: CIA Forgery shredded
        nextTemp = Math.max(295, state.coreTemp - 35)
        feedback = `CIA SABOTAGE FOIL CONFIRMED (${doc.id}). PATRIOTIC VIGILANCE RECORDED.`
        logLevel = 'normal'
      } else {
        // Catastrophe: CIA Forgery approved!
        if (!state.isGodMode) {
          nextTemp = Math.min(1050, state.coreTemp + doc.effectOnApprove.tempDelta)
          if (doc.effectOnApprove.sabotageSystem === 'cooling') {
            nextPumps = [false, state.pumpsActive[1]]
          } else if (doc.effectOnApprove.sabotageSystem === 'defense') {
            nextLock = true
          }
        }
        feedback = `SABOTAGE EXECUTED! ${doc.id} WAS A CIA FORGERY (${doc.flawReason ?? doc.flawDescription})!`
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
        activeDirectives: remaining,
        coreTemp: nextTemp,
        treasonStrikes: nextStrikes,
        pumpsActive: nextPumps,
        komradOverrideLocked: nextLock,
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

  setGodMode: (enabled: boolean) => {
    set({ isGodMode: enabled })
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
    const nextMinutes = Math.min(360, state.shiftTimeMinutes + 2)
    if (nextMinutes >= 360) {
      set({ shiftTimeMinutes: 360, phase: 'victory' })
      return
    }

    // 2. Calculate total MW and Redline instability
    const totalMW =
      state.powerAllocation.cooling +
      state.powerAllocation.defense +
      state.powerAllocation.facility
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

    // 3. Calculate Core Temperature physics
    const activePumpCount = (state.pumpsActive[0] ? 1 : 0) + (state.pumpsActive[1] ? 1 : 0)
    const effectiveCoolingMW = state.isBlackout
      ? 5
      : state.powerAllocation.cooling * (0.35 + activePumpCount * 0.35)

    // Base heat generation scales slightly as the night progresses
    const baseHeatDelta = 11 + (nextMinutes / 360) * 5 + (isRedline ? 7 : 0)
    const coolingEffect = (effectiveCoolingMW / 40) * 11.5
    let netTempDelta = baseHeatDelta - coolingEffect

    if (activePumpCount === 0) {
      netTempDelta += 12
    }

    let nextTemp = Math.max(290, state.coreTemp + netTempDelta)
    if (state.isGodMode && nextTemp > 920) {
      nextTemp = 920
    }

    const nextPressure = Math.round(35 + ((nextTemp - 290) / 700) * 85)
    const nextRadiation = Number(
      Math.max(0.2, ((nextTemp - 280) / 720) * 12 + (isRedline ? 1.8 : 0)).toFixed(1)
    )

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

    // Periodic K.O.M.R.A.D.-84 gaslighting when core runs hot
    if (nextTemp >= 750 && state.coreTemp < 750) {
      newLogs.push(
        createLogEntry(
          nextMinutes,
          'K.O.M.R.A.D.-84',
          `CORE TEMP IS AN INSPIRING ${Math.round(nextTemp)}°C! IGNORE THE MELTING LEAD SMELL, COMRADE.`,
          'warn'
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
      pressureBar: nextPressure,
      radiationLevel: nextRadiation,
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
