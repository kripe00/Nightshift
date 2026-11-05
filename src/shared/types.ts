// Shared Contract: Cross-module TypeScript types and interfaces

export type SystemType = 'cooling' | 'defense' | 'facility'
export type DirectiveDecision = 'APPROVED' | 'SHREDDED'
export type GamePhase = 'boot' | 'playing' | 'victory' | 'meltdown' | 'gulag'
export type CameraStation =
  | 'overview'
  | 'reactor'
  | 'terminal'
  | 'power'
  | 'inspector'

export type StampEmblemType =
  | 'MINATOM_OFFICIAL'
  | 'POLITBURO_URGENT'
  | 'KGB_DIRECTORATE_4'
  | 'PLANT_INTERNAL'
  | 'party_star'
  | 'ministry_atom'
  | 'kgb_shield'
  | 'forged_eagle'

export type StampInkColor =
  | 'SOVIET_CRIMSON'
  | 'BUREAU_VIOLET'
  | 'FADED_BLACK'
  | 'IMPERIALIST_BLUE'
  | 'red'
  | 'blue'
  | 'purple'

export interface AppliedStampMark {
  id: string
  decision: DirectiveDecision
  relX: number
  relY: number
  angleDeg: number
}

export interface DirectiveDocument {
  id: string
  title: string
  ministry: string
  date: string
  authCode: string
  authorizationCode: string
  bodyText: string
  stampType: StampEmblemType
  inkColor: StampInkColor
  watermarkText: string
  watermark: string
  isCiaForgery: boolean
  flawReason?: string
  flawDescription: string | null
  effectOnApprove: {
    tempDelta: number
    powerBonus?: number
    sabotageSystem?: SystemType
  }
  // Desk spatial state for Komrad Oleg's Inspector module
  deskX: number
  deskY: number
  rotationDeg: number
  isExpanded: boolean
  stamps: AppliedStampMark[]
}

export interface TerminalLogEntry {
  id: string
  timestamp: string
  sender: 'K.O.M.R.A.D.-84' | 'SYS.DEFENSE' | 'PRINTER' | 'OPERATOR'
  text: string
  level: 'normal' | 'warn' | 'danger'
}

export interface GameState {
  // Global Shift, 3D Camera & Campaign Status
  phase: GamePhase
  activeStation: CameraStation
  shiftNumber: number // 1 to 5
  shiftTimeMinutes: number // 0 (00:00) to 360 (06:00)
  isShiftKeyHeld: boolean // Physical SHIFT key clutch
  isGodMode: boolean // F2 Debug menu toggle (pauses meltdown/strikes for Komrad Oleg)
  isMusicMuted: boolean
  treasonStrikes: number // 0 to 3 (3 = Gulag Game Over)
  lastDecisionFeedback: string | null

  // Reactor & Power Matrix (Komrad Kristianov's Domain)
  coreTemp: number // 300°C nominal -> 1000°C meltdown
  pressureBar: number // 40 BAR nominal -> 120 BAR critical
  radiationLevel: number // 0.1 to 15.0 R/h
  maxSafePower: number // 100 MW (up to 180 MW in Redline)
  powerAllocation: Record<SystemType, number>
  redlineInstability: number // 0 to 100% (100% triggers Blackout)
  isBlackout: boolean
  pumpsActive: [boolean, boolean] // Pump A & Pump B
  az5Available: boolean
  az5Cooldown: number

  // K.O.M.R.A.D.-84 Terminal & Cyber Defense (Komrad Kristianov's Domain)
  terminalLogs: string[]
  terminalEntries: TerminalLogEntry[]
  ciaIntrusionActive: boolean
  ciaIntrusionProgress: number // 0 to 100%
  komradOverrideLocked: boolean

  // Inspector Desk & Directives (Komrad Oleg's Domain)
  activeDirectives: DirectiveDocument[]
  printerProgress: number // 0 to 100% until next directive spawns

  // Shared Actions
  setActiveStation: (station: CameraStation) => void
  startShift: () => void
  resetShift: () => void
  setShiftKeyHeld: (held: boolean) => void
  shiftPower: (system: SystemType, deltaMW: number) => void
  setSubsystemPower: (system: SystemType, targetMW: number) => void
  togglePump: (pumpIndex: 0 | 1, active?: boolean) => void
  triggerAz5: () => void
  overrideKomradLock: () => void
  purgeFirewall: () => void
  spawnDirective: (forceForgery?: boolean) => void
  resolveDirective: (id: string, decision: DirectiveDecision) => void
  approveDirective: (id: string) => void
  shredDirective: (id: string) => void
  addStampToDirective: (id: string, stamp: Omit<AppliedStampMark, 'id'>) => void
  bringDirectiveToFront: (id: string) => void
  updateDirectivePosition: (
    id: string,
    deskX: number,
    deskY: number,
    isExpanded?: boolean
  ) => void
  toggleMusicMute: () => void
  setGodMode: (enabled: boolean) => void
  debugSetTemp: (temp: number) => void
  debugTriggerBlackout: () => void
  debugCompleteShift: () => void
  tick: () => void
}
