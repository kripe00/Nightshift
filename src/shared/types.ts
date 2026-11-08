// Shared Contract: Cross-module TypeScript types and interfaces

export type SystemType = 'cooling' | 'defense' | 'facility'
export type SectorNodeId =
  | 'pripyat'
  | 'kolkhoz'
  | 'duga'
  | 'kgb'
  | 'vodka'
  | 'steel'
export type DirectiveDecision = 'APPROVED' | 'SHREDDED'

export type TutorialStep = 1 | 2 | 3 | 4 | 5 | 'DONE'
export type DiagnosticAlarmId =
  | 'core'
  | 'water'
  | 'gas_oil'
  | 'bearing'
  | 'grid'
  | 'order'
export type GamePhase = 'boot' | 'playing' | 'victory' | 'meltdown' | 'gulag'
export type CameraStation =
  | 'overview'
  | 'reactor'
  | 'terminal'
  | 'power'
  | 'inspector'
  | 'aux'

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

export type HotspotSeverity = 'amber' | 'red'

export interface OperationalMandate {
  id: string
  code: 'COOLING_OIL' | 'DEFENSE_HZ' | 'PUMP_B_SEAL' | 'FACILITY_BUBBLER'
  title: string
  requirementText: string
  fulfilled: boolean
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
  activeMandate: OperationalMandate | null

  // Reactor & Power Matrix (UNIT A, UNIT A-2, UNIT B & Right Turbine Panel)
  coreTemp: number // 300°C nominal -> 1000°C meltdown
  pressureBar: number // 40 BAR nominal -> 120 BAR critical
  radiationLevel: number // 0.1 to 15.0 R/h
  maxSafePower: number // 100 MW (up to 180 MW in Redline)
  powerAllocation: Record<SystemType, number>
  sectorMW: Record<SectorNodeId, number> // 6 Individual Regional Substation Levers (0-50 MW each)
  targetSectorMW: Record<SectorNodeId, number> // 6 Individual Regional Map Target MW values
  targetCityMW: number // Regional Map Sector 1+2 combined target MW
  targetDefenseMW: number // Regional Map Sector 3+4 combined target MW
  targetVodkaMW: number // Regional Map Sector 5+6 combined target MW
  waterReservoir: number // 0 to 100% average local water reservoir level
  pripyatWater: number // [1] PRIPYAT CITY local water reserve (0..100%, drought < 30%)
  kolkhozWater: number // [2] KOLKHOZ FARM local water reserve (0..100%, drought < 35%)
  vodkaWater: number // [5] VODKA DISTILLERY local water reserve (0..100%, drought < 40%)
  vodkaDroughtTimer: number // 0 to 35s Politburo countdown toward KGB Citation when vodkaWater < 40%
  waterUsage: number // L/s river water drawn by cooling pumps
  redlineInstability: number // 0 to 100% (100% triggers Blackout)
  isBlackout: boolean
  pumpsActive: [boolean, boolean] // Pump A & Pump B
  pumpThrottle: [number, number] // 0 to 100% continuous valve cranking
  pumpAHeat: number // 0 to 100% bearing heat & cavitation
  pumpBHeat: number // 0 to 100% bearing heat & cavitation
  lubeOilPressure: number // 0 to 100% bearing lube pressure (UNIT A-2)
  oilCoolerValve: number // 0 to 100% oil cooler handwheel opening (UNIT A-2)
  controlRodLevel: number // 0% = fully inserted/poisoned, 100% = fully withdrawn/extracted (UNIT A-2)
  boronTankLevel: number // 0 to 100% boron reserve tank level (UNIT A-2)
  boronReservePool: number // 0 to 300% finite Boron Concentrate Carboy pool (3.0 TANKS)
  boronPoisoningTimer: number // 0 to 15s Boron Reactivity Damping (-20% MW output sag)
  isInspectingDesk: boolean // True when holding Magnifying Glass or reading Desk Manual (30% thermal damping)
  channelHotspots: Record<number, HotspotSeverity> // 0..36 RBMK core channel hotspots (UNIT A-2)
  graphiteTemp: number // 280°C to 850°C moderator temperature (UNIT B)
  nitrogenLoopValve: number // 0 to 100% Helium-N2 gas regulator wheel (UNIT B)
  heliumPressure: number // 0 to 60 BAR Helium-N2 loop pressure (UNIT B)
  bubblerLevel: number // 0 to 100% condenser bubbler pool H2O level (UNIT B)
  bubblerDraining: boolean // Toothed quadrant drain lever held on UNIT B
  sealToggles: [boolean, boolean, boolean] // [N2 PURGE, RAD FILTER, SEAL LOCK] on UNIT B
  containmentSealLocked: boolean // True when all 3 UNIT B seal toggles are locked
  ventingSteam: boolean // Spring-loaded СБРОС ПАРА lever held down
  turbineRpm: number // 0 to 3600 RPM
  gridHz: number // 45.0 to 55.0 Hz (Target 50.0 Hz)
  excitationTrim: number // -5.0 to +5.0 Hz rotary rheostat offset
  hzOutOfBoundsSeconds: number // > 10s outside [47.8, 52.2] or > 3450 RPM trips Main Breaker
  ventilationActive: boolean // ВЕНТИЛЯЦИЯ guarded toggle (-1.2 R/h/s, +10 MW load)
  kgbLineActive: boolean // СВЯЗЬ КГБ guarded toggle
  auxLoopBActive: boolean // AUX LOOP B (Turbine Bypass -> UNIT B Bubbler Condenser)
  boronCooldown: number // 0 to 30s recharge for БОРНАЯ КИСЛОТА plunger
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
  tutorialStep: TutorialStep
  tutorialDrainSeconds: number
  shiftRunId: number
  hoveredDiagnosticId: DiagnosticAlarmId | null

  // Shared Actions
  setActiveStation: (station: CameraStation) => void
  startShift: () => void
  resetShift: () => void
  skipTutorial: () => void
  setTutorialStep: (step: TutorialStep) => void
  setHoveredDiagnosticId: (id: DiagnosticAlarmId | null) => void
  recloseMainBreaker: () => void
  setShiftKeyHeld: (held: boolean) => void
  shiftPower: (system: SystemType, deltaMW: number) => void
  setSubsystemPower: (system: SystemType, targetMW: number) => void
  setSectorPower: (sector: SectorNodeId, targetMW: number) => void
  shiftSectorPower: (sector: SectorNodeId, deltaMW: number) => void
  togglePump: (pumpIndex: 0 | 1, active?: boolean) => void
  setPumpThrottle: (pumpIndex: 0 | 1, throttlePct: number) => void
  setOilCoolerValve: (valvePct: number) => void
  setControlRodLevel: (levelPct: number) => void
  adjustControlRodLevel: (deltaPct: number) => void
  pumpBoronTank: (amountPct?: number) => void
  quenchChannelHotspot: (channelIndex: number) => void
  setNitrogenLoopValve: (valvePct: number) => void
  setBubblerDraining: (draining: boolean) => void
  toggleSealSwitch: (toggleIndex: 0 | 1 | 2, active?: boolean) => void
  lockAllContainmentSeals: () => void
  setVentingSteam: (venting: boolean) => void
  adjustExcitationTrim: (deltaHz: number) => void
  toggleVentilation: (active?: boolean) => void
  toggleKgbLine: (active?: boolean) => void
  toggleAuxLoopB: (active?: boolean) => void
  setInspectingDesk: (inspecting: boolean) => void
  injectBoronAcid: () => void
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
  ) => void
  tickThermodynamics: (dtSeconds: number) => void
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
