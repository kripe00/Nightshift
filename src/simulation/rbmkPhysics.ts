export interface SubstationQuota {
  id: number;
  name: string;
  allocatedMW: number;   // Controlled via the 6 MW levers on UNIT A (0 to maxMW)
  targetMW: number;      // Active Ministry quota target MW
  maxMW: number;
  requiresH2O: boolean;
  allocatedH2O: number;
  targetH2O: number;
  statusText: string;    // e.g. 'MASH OK', 'SWEEP OK', 'LINE: ON/OFF', 'FURNACE HOT'
  quotaOk: boolean;      // True when clean MWe meets quota
}

export interface TurbineState {
  valve: number;          // 0.0 to 1.0 (Turbine Steam Throttle Valve)
  rpm: number;            // 0 to 3600 RPM (Nominal: 3000 RPM = 50.0 Hz)
  freqHz: number;         // 0.0 to 60.0 Hz (Nominal: 50.0 Hz)
  syncPhase: number;      // -180 to +180 deg (0° = 12 o'clock on synchroscope)
  gridConnected: boolean; // Main Breaker closed
  electricalMW: number;   // Net MWe delivered per turbine generator (0 to 525 MWe)
  tripped: boolean;       // Trips on bad sync, severe overspeed (>3300 RPM), or prolonged Hz fault
}

export interface ReactorState {
  // --- Direct Operator Controls across UNIT B, UNIT A-2, UNIT A & UNIT C ---
  rodTargetRate: number;      // -1 (insert), 0 (hold), +1 (withdraw)
  az5Active: boolean;         // AZ-5 Emergency Scram latched
  mcpActive: boolean[];       // 4 Main Circulation Pumps ГЦН 1-4 [Loop A: 0,1 | Loop B: 2,3]
  pumpThrottle: [number, number]; // [Pump A %, Pump B %] continuous flow throttle levers on UNIT A (0-100%)
  oilCoolerValve: number;     // 0 to 100% Bearing Oil Cooler handwheels on UNIT A / UNIT A-2
  feedwaterValve: number;     // 0.0 to 1.0 Feedwater regulator (ПЭН) on UNIT B
  nitrogenLoopValve: number;  // 0 to 100% Helium-N2 graphite gas circulation manifold on UNIT B
  sealToggles: [boolean, boolean, boolean]; // 3 Containment Gas Scrubbers / Hermetic Seals on UNIT B
  steamDumpValve: boolean;    // Condenser Steam Dump (БРУ-К)
  ventingSteam: boolean;      // Live Atmospheric/Bubbler Steam Vent lever on UNIT C (СБРОС ПАРА)
  bubblerDraining: boolean;   // Suppression Bubbler Condensate Return Drain lever on UNIT B
  ventilationActive: boolean; // UNIT C Aux Switch 1: Containment HEPA Ventilation (-1.2 R/h/s, +15 MWe load)
  avrActive: boolean;         // UNIT C Aux Switch 2: Generator AVR Exciter (+8 MWe load, stabilizes sync & 50Hz)
  kgbLineActive: boolean;     // UNIT C Aux Switch 3: Encrypted KGB Trunk (+10 MWe load, powers #4 KGB Bunker & Intel)
  condenserVacActive: boolean;// UNIT C Aux Switch 4: Main Condenser Vacuum Ejectors (+12 MWe load, preserves turbine torque)
  plantWaterDrainPct: number; // Net plant water consumption rate (%)
  wePadHeld: boolean;         // Operator holding WE-PAD 84 [E]
  wePadInspecting: boolean;   // Operator inspecting WE-PAD 84 close-up [TAB]

  // --- Core Fission, Boron System & Graphite Moderation (UNIT A-2 <-> UNIT B) ---
  controlRods: number;        // 0.0 (fully inserted) to 1.0 (fully withdrawn)
  boronTankLevel: number;     // 0 to 100% hydraulic/liquid boron poison accumulator pressure (UNIT A-2)
  boronReservePool: number;   // 0 to 300% finite Boron Concentrate Carboy reserve (3.0 Tanks)
  az5Timer: number;           // Seconds elapsed since AZ-5 scram
  boronDampingTimer: number;  // Seconds remaining of emergency Boron Acid Injection poison
  reactivity: number;         // Net reactivity (rho)
  thermalPower: number;       // Core fission thermal output in MWt (Nominal: 1920 MWt @ 600 MWe, 3200 MWt @ 1000 MWe)
  coreTemp: number;           // Core fuel/channel temp in °C
  graphiteTemp: number;       // Graphite moderator stack temp in °C (shifts moderation positive > 540°C)
  heliumPressure: number;     // Helium-N2 gas loop pressure in BAR (trips scrubbers / leaks rads > 70 BAR)
  voidFraction: number;       // 0.0 to 1.0 steam void fraction in core channels
  iodine: number;             // Iodine-135 fission product inventory (0 to 100)
  xenon: number;              // Xenon-135 neutron poison inventory (0 to 100)
  rodTilesFlux: number[];     // 37 local channel flux readouts (0-100%) on UNIT A-2
  coreTileAnomalies: Record<number, 'spent'>; // Spent uranium fuel channels requiring refueling on 37-tile matrix
  selectedRefuelChannel: number | null; // Currently targeted spent channel for the UNIT A-2 refueling lever
  fuelBurnupTimer: number;    // Accumulated fission burnup toward the next spent fuel channel

  // --- Primary Loop Hydraulics, Bearings, Steam Drum & Bubbler Pool (UNIT A <-> UNIT B <-> UNIT C) ---
  coolantFlow: number;        // 0.0 to 1.15 total core coolant mass flow
  pumpAHeat: number;          // 0 to 100% Loop A pump bearing heat above 20°C ambient (>65 => >85°C degrades flow!)
  pumpBHeat: number;          // 0 to 100% Loop B pump bearing heat above 20°C ambient (>65 => >85°C degrades flow!)
  lubeOilPressure: number;    // 0 to 100 PSI bearing lubrication pressure
  waterReservoir: number;     // 0 to 100% plant makeup water reservoir
  pripyatWater: number;       // 0 to 100% [1] Pripyat basin H2O level
  kolkhozWater: number;       // 0 to 100% [3] Kolkhoz basin H2O level
  vodkaWater: number;         // 0 to 100% [5] Distillery basin H2O level
  drumWaterLevel: number;     // -400 to +400 mm Steam Drum separator level (<-100mm starves core; >+100mm wet steam!)
  drumPressure: number;       // Steam Drum pressure in BAR (Single source of truth integrated from steam mass balance)
  bubblerLevel: number;       // 0 to 100% Suppression Bubbler Pool level (>=95% chokes steam relief!)
  wetSteamSeverity: number;   // 0.0 to 1.0 wet steam carryover hitting turbine blades when drumWaterLevel > +100mm
  reliefValveOpen: boolean;   // Automatic safety relief valve (opens >= 85 BAR, closes <= 75 BAR)
  roomRadiation: number;      // Control room / containment radiation in R/h

  // --- Turbines, Aux House Bus, Energy Storage & Regional Grid (UNIT C <-> UNIT A) ---
  turbines: [TurbineState, TurbineState]; // Legacy compatibility mirror (Unit C now uses Battery Dispatch)
  houseLoadMW: number;        // Internal plant electrical load (Ventilation + KGB Trunk)
  energyCreatedMW: number;    // Live electrical power generated into Station Battery (0-1050 MW)
  batteryStoredMWh: number;   // Energy stored in Station Battery Bank (0-1000 MWh, /10 = 0-100%)
  batteryOutputValve: number; // Single UNIT C wheel (0.0-1.0 => 0-1000 MW from Battery to Grid)
  energyDemandMW: number;     // Total regional grid demand (sum of substations.targetMW)
  totalElectricalMW: number;  // Net MW delivered from Station Battery to the 6 regional substations
  substations: SubstationQuota[]; // 6 Substation levers on UNIT A (#1..#6)

  // --- Catastrophic Failure Flags ---
  coreMeltdown: boolean;
  steamExplosion: boolean;
}

export type TutorialPhase =
  | 'STEP_0_PICKUP_WEPAD'
  | 'STEP_1_COOLING'
  | 'STEP_2_PULL_RODS'
  | 'STEP_3_BUILD_STEAM'
  | 'STEP_4_SPIN_TURBINE'
  | 'STEP_5_SYNC_GRID'
  | 'STEP_6_BASELINE_600MW'
  | 'STEP_7_VOID_DRILL'
  | 'STEP_8_XENON_DRILL'
  | 'COMPLETED';

export interface TutorialPrompt {
  phase: TutorialPhase;
  header: string;
  body: string;
  hint: string;
  panelKey: string;
  actionLine: string;
  whyLines: [string, string];
  volkovQuote: string;
}

// Physical RBMK-1000 Constants
const NOMINAL_THERMAL_MW = 3200;
const NOMINAL_PRESSURE_BAR = 70;
const MAX_BATTERY_INPUT_MW = 1050;
const ROD_SPEED = 0.015;
const AZ5_SPEED = 0.055;             // ~18s full insertion with 3.5s graphite displacer tip effect
const VOID_COEFFICIENT = 0.028;      // Positive void coefficient (+alpha_phi)
const DOPPLER_COEFFICIENT = 0.00004; // Negative fuel Doppler coefficient
const XENON_SCALE = 0.0012;

const SPENT_FUEL_CHANNEL_ORDER = [
  18, 12, 24, 6, 30, 16, 20, 8, 28, 14, 22, 10, 26, 3, 33, 17, 19,
] as const;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Cold Shutdown Initial State (0 MWt, 25°C, 1 BAR, 0 mm drum level, 0 MWe)
 */
export function createColdStartState(): ReactorState {
  return {
    rodTargetRate: 0,
    az5Active: false,
    mcpActive: [false, false, false, false],
    pumpThrottle: [60, 60],
    oilCoolerValve: 45,
    feedwaterValve: 0.0,
    nitrogenLoopValve: 0,
    sealToggles: [false, false, false],
    steamDumpValve: false,
    ventingSteam: false,
    bubblerDraining: false,
    ventilationActive: true,
    avrActive: true,
    kgbLineActive: true,
    condenserVacActive: true,
    plantWaterDrainPct: 0,
    wePadHeld: false,
    wePadInspecting: false,

    controlRods: 0.0,
    boronTankLevel: 92,
    boronReservePool: 300,
    az5Timer: 0,
    boronDampingTimer: 0,
    reactivity: -0.038,
    thermalPower: 0,
    coreTemp: 25,
    graphiteTemp: 40,
    heliumPressure: 12,
    voidFraction: 0,
    iodine: 0,
    xenon: 0,
    rodTilesFlux: new Array(37).fill(0),
    coreTileAnomalies: {},
    selectedRefuelChannel: null,
    fuelBurnupTimer: 0,

    coolantFlow: 0.08,
    pumpAHeat: 6,
    pumpBHeat: 6,
    lubeOilPressure: 84,
    waterReservoir: 85,
    pripyatWater: 85,
    kolkhozWater: 85,
    vodkaWater: 85,
    drumWaterLevel: 0,
    drumPressure: 1.0,
    bubblerLevel: 18,
    wetSteamSeverity: 0,
    reliefValveOpen: false,
    roomRadiation: 0.1,

    turbines: [
      { valve: 0, rpm: 0, freqHz: 0, syncPhase: 0, gridConnected: false, electricalMW: 0, tripped: false },
      { valve: 0, rpm: 0, freqHz: 0, syncPhase: 90, gridConnected: false, electricalMW: 0, tripped: false },
    ],
    houseLoadMW: 25,
    energyCreatedMW: 0,
    batteryStoredMWh: 250,
    batteryOutputValve: 0,
    energyDemandMW: 600,
    totalElectricalMW: 0,
    substations: [
      { id: 1, name: 'PRIPYAT CITY', allocatedMW: 0, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 85, targetH2O: 85, statusText: 'HEATING COLD', quotaOk: false },
      { id: 2, name: 'DUGA-1 RADAR', allocatedMW: 0, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 0,  targetH2O: 0,  statusText: 'SWEEP OFF',    quotaOk: false },
      { id: 3, name: 'KOLKHOZ FARM', allocatedMW: 0, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 85, targetH2O: 85, statusText: 'POWER LOW',    quotaOk: false },
      { id: 4, name: 'KGB BUNKER',   allocatedMW: 0, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 0,  targetH2O: 0,  statusText: 'LINE: ON',     quotaOk: false },
      { id: 5, name: 'VODKA PLANT',  allocatedMW: 0, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 85, targetH2O: 85, statusText: 'MASH COLD',    quotaOk: false },
      { id: 6, name: 'STEEL WORKS',  allocatedMW: 0, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 0,  targetH2O: 0,  statusText: 'FURNACE COLD', quotaOk: false },
    ],

    coreMeltdown: false,
    steamExplosion: false,
  };
}

/**
 * Countermeasure #3 against Positive Void & Thermal Runaway:
 * Emergency BORON INJECTION plunger on UNIT A (consumes 35% from Boron Tank, requires >= 20%).
 */
export function triggerBoronInjection(state: ReactorState): boolean {
  if (state.boronTankLevel < 20) {
    return false;
  }
  state.boronTankLevel = Math.max(0, state.boronTankLevel - 35);
  state.voidFraction = Math.max(0, state.voidFraction - 0.35);
  state.boronDampingTimer = 8.0;
  state.coreTemp = Math.max(120, state.coreTemp - 95);
  state.graphiteTemp = Math.max(120, state.graphiteTemp - 55);
  return true;
}

/**
 * Selects a spent fuel channel on the 37-tile RBMK CORE map (UNIT A-2)
 * before operating the 3D ROD REFUELING LEVER.
 */
export function selectCoreChannelForRefuel(
  state: ReactorState,
  tileIndex: number
): { selected: number | null; isSpent: boolean } {
  if (state.coreTileAnomalies[tileIndex] === 'spent') {
    state.selectedRefuelChannel = tileIndex;
    return { selected: tileIndex, isSpent: true };
  }
  return { selected: state.selectedRefuelChannel, isSpent: false };
}

/**
 * Executes a full downward stroke on the 3D ROD REFUELING LEVER (UNIT A-2):
 * Reloads the currently selected spent uranium fuel channel and tops up hydraulic boron pressure.
 */
export function refuelSelectedCoreChannel(state: ReactorState): {
  refueledChannel: number | null;
  remainingSpent: number;
  hasUnselectedSpent: boolean;
} {
  const transfer = Math.min(8, 100 - state.boronTankLevel, state.boronReservePool);
  if (transfer > 0) {
    state.boronTankLevel = Number((state.boronTankLevel + transfer).toFixed(1));
    state.boronReservePool = Number((state.boronReservePool - transfer).toFixed(1));
  }

  const ch = state.selectedRefuelChannel;
  if (ch !== null && state.coreTileAnomalies[ch] === 'spent') {
    const nextAnom = { ...state.coreTileAnomalies };
    delete nextAnom[ch];
    state.coreTileAnomalies = nextAnom;
    state.selectedRefuelChannel = null;
    state.rodTilesFlux[ch] = Math.min(100, (state.thermalPower / NOMINAL_THERMAL_MW) * 100);
    state.coreTemp = Math.max(120, state.coreTemp - 14);
    return {
      refueledChannel: ch,
      remainingSpent: Object.keys(nextAnom).length,
      hasUnselectedSpent: false,
    };
  }

  const remainingSpent = Object.keys(state.coreTileAnomalies).length;
  return {
    refueledChannel: null,
    remainingSpent,
    hasUnselectedSpent: remainingSpent > 0,
  };
}

/**
 * Compatibility alias retained for existing callers.
 */
export function trimCoreChannelTile(
  state: ReactorState,
  tileIndex: number
): { trimmed: 'spent' | 'none'; remainingPct: number } {
  const res = selectCoreChannelForRefuel(state, tileIndex);
  return {
    trimmed: res.isSpent ? 'spent' : 'none',
    remainingPct: Object.keys(state.coreTileAnomalies).length,
  };
}

/**
 * Unified RBMK-1000 Causal Simulation Step:
 * 1. Core Fission, Boron Poison Hydraulics & Graphite/He-N2 Moderation (UNIT A-2 <-> UNIT B)
 * 2. Primary Water Loop, MCP Throttles, AC Rundown, Reservoir & Bearing Lube Oil (UNIT A <-> UNIT A-2 <-> UNIT B)
 * 3. Steam Drum Mass & Pressure Bridge + Bubbler Pool & Drain (UNIT B + UNIT A -> UNIT C)
 * 4. Turbine Mechanical Torque vs. 50Hz Electrical Load & Aux Switchgear (UNIT C <-> UNIT A)
 */
export function stepReactorSimulation(
  state: ReactorState,
  dt: number,
  tutorialPhase: TutorialPhase = 'COMPLETED'
): void {
  const delta = Math.min(dt, 0.1);

  if (state.boronDampingTimer > 0) {
    state.boronDampingTimer = Math.max(0, state.boronDampingTimer - delta);
  }

  // ============================================================================
  // STAGE 1A: CONTROL RODS, AZ-5 & BORON HYDRAULIC/POISON PRESSURE (UNIT A-2)
  // ============================================================================
  let az5TipReactivityBonus = 0;
  const prevRods = state.controlRods;

  if (state.az5Active) {
    state.az5Timer += delta;
    state.controlRods = Math.max(0, state.controlRods - AZ5_SPEED * delta);

    // Authentic RBMK-1000 3.5s graphite displacer tip positive scram effect
    if (state.az5Timer < 3.5 && state.controlRods > 0.3) {
      az5TipReactivityBonus = 0.018 * (0.5 + state.voidFraction);
    }
  } else {
    state.az5Timer = 0;
    state.controlRods = clamp(
      state.controlRods + state.rodTargetRate * ROD_SPEED * delta,
      0,
      1
    );
  }

  // Moving control rods consumes hydraulic boron accumulator pressure;
  // passive reserve replenishment keeps hydraulic pressure healthy during normal operation.
  const rodTravel = Math.abs(state.controlRods - prevRods);
  if (rodTravel > 0.0001 && !state.az5Active) {
    state.boronTankLevel = Math.max(0, state.boronTankLevel - rodTravel * 18.0);
  }
  if (!state.az5Active && state.boronTankLevel < 75 && state.boronReservePool > 0) {
    const trickle = Math.min(0.18 * delta, state.boronReservePool);
    state.boronTankLevel += trickle;
    state.boronReservePool -= trickle;
  }

  // Low Boron Tank (< 25%) degrades negative neutron absorption worth of inserted control rods!
  const boronEffectiveness =
    state.boronTankLevel >= 25
      ? 1.0
      : 0.50 + 0.50 * (state.boronTankLevel / 25);

  // ============================================================================
  // STAGE 1B: GRAPHITE MODERATOR & HELIUM-N2 GAS LOOP (UNIT B)
  // ============================================================================
  const activeScrubbers = state.sealToggles.filter(Boolean).length;
  const scrubberRatio = activeScrubbers / 3;

  // Gas circulation cools the 1700-ton graphite stack; saturated gas (>72 BAR) loses heat-transfer efficiency
  const gasSaturationFactor = state.heliumPressure > 72 ? 0.45 : 1.0;
  const gasCoolingPower =
    (state.nitrogenLoopValve / 100) *
    (0.65 + 0.35 * scrubberRatio) *
    gasSaturationFactor;

  const targetGraphiteTemp =
    state.thermalPower <= 15
      ? 35 + state.coreTemp * 0.45
      : 255 + (state.thermalPower / NOMINAL_THERMAL_MW) * 440 - gasCoolingPower * 175;
  state.graphiteTemp += (targetGraphiteTemp - state.graphiteTemp) * 0.19 * delta;
  state.graphiteTemp = clamp(state.graphiteTemp, 25, 1150);

  // Helium-N2 gas pressure builds with graphite temperature and gas compression, relieved by active scrubbers
  const targetHeliumBar =
    state.thermalPower <= 15
      ? 12 + (state.nitrogenLoopValve / 100) * 8
      : 22 +
        Math.max(0, state.graphiteTemp - 240) * 0.095 +
        (state.nitrogenLoopValve / 100) * 11 -
        scrubberRatio * 7.5;
  state.heliumPressure += (targetHeliumBar - state.heliumPressure) * 0.34 * delta;
  state.heliumPressure = clamp(state.heliumPressure, 5, 95);

  // Severe gas or steam overpressure can pop open a containment scrubber seal!
  if (
    (state.heliumPressure > 78 || state.drumPressure > 92) &&
    activeScrubbers > 0 &&
    Math.random() < 0.07 * delta
  ) {
    const openIdx = state.sealToggles.findIndex(Boolean);
    if (openIdx >= 0) {
      const nextSeals: [boolean, boolean, boolean] = [...state.sealToggles];
      nextSeals[openIdx] = false;
      state.sealToggles = nextSeals;
    }
  }

  // Overheated graphite (> 540°C) shifts neutron spectrum -> positive moderation reactivity!
  const graphiteModerationMWt =
    state.graphiteTemp > 540 && state.controlRods > 0.08
      ? ((state.graphiteTemp - 540) / 180) * 340
      : 0;

  // ============================================================================
  // STAGE 2: PRIMARY WATER LOOP, MCP THROTTLES, AC RUNDOWN & LUBE OIL (UNIT A <-> A-2 <-> B)
  // ============================================================================
  const gridConnected = state.turbines[0].gridConnected;
  const currentGridHz = state.turbines[0].freqHz || 50.0;

  // Authentic RBMK AC motor rundown: if grid frequency sags < 48.2 Hz, electric MCP speed drops!
  const acMotorSpeedFactor =
    gridConnected && currentGridHz < 48.2
      ? clamp(1.0 - (48.2 - currentGridHz) * 0.16, 0.52, 1.0)
      : 1.0;

  // Pump Bearing Heat & Lube Oil Pressure (driven by Pump Throttles, Turbine RPM, Wet Steam & Oil Cooler Valve)
  const rpmRatio = state.turbines[0].rpm / 3000;
  const ventBearingBonus = state.ventilationActive ? 3.5 : 0;
  const oilCoolingEffect = (state.oilCoolerValve / 100) * 62 + ventBearingBonus;

  const loopARunning = (state.mcpActive[0] || state.mcpActive[1]) ? 1 : 0;
  const loopBRunning = (state.mcpActive[2] || state.mcpActive[3]) ? 1 : 0;

  const targetPumpAHeat =
    loopARunning * (10 + Math.pow(state.pumpThrottle[0] / 100, 1.45) * 68) +
    rpmRatio * 12 +
    state.wetSteamSeverity * 28 -
    oilCoolingEffect * 0.68;
  const targetPumpBHeat =
    loopBRunning * (10 + Math.pow(state.pumpThrottle[1] / 100, 1.45) * 68) +
    rpmRatio * 12 +
    state.wetSteamSeverity * 28 -
    oilCoolingEffect * 0.68;

  state.pumpAHeat += (clamp(targetPumpAHeat, 4, 100) - state.pumpAHeat) * 0.17 * delta;
  state.pumpBHeat += (clamp(targetPumpBHeat, 4, 100) - state.pumpBHeat) * 0.17 * delta;

  const bearingTempA = 20 + state.pumpAHeat;
  const bearingTempB = 20 + state.pumpBHeat;
  const maxBearingTemp = Math.max(bearingTempA, bearingTempB);

  // Lube oil pressure depends on oil cooler circulation vs bearing oil thinning at high temperature
  const targetLubeOil =
    52 +
    (state.oilCoolerValve / 100) * 44 -
    Math.max(0, maxBearingTemp - 62) * 1.15 -
    state.wetSteamSeverity * 16;
  state.lubeOilPressure += (clamp(targetLubeOil, 8, 98) - state.lubeOilPressure) * 0.36 * delta;

  // Bearing overheat (> 85°C) or oil starvation (< 25 PSI) degrades pump efficiency and risks seizure (> 108°C)!
  const oilStarvationPenalty =
    state.lubeOilPressure < 28 ? (28 - state.lubeOilPressure) * 0.015 : 0;
  const effA = clamp(
    1.0 - Math.max(0, bearingTempA - 85) * 0.026 - oilStarvationPenalty,
    0.38,
    1.0
  );
  const effB = clamp(
    1.0 - Math.max(0, bearingTempB - 85) * 0.026 - oilStarvationPenalty,
    0.38,
    1.0
  );

  // Extreme bearing seizure (> 112°C): forces pump throttle back to protect shaft
  if (bearingTempA > 112 && state.pumpThrottle[0] > 25) {
    state.pumpThrottle = [25, state.pumpThrottle[1]];
  }
  if (bearingTempB > 112 && state.pumpThrottle[1] > 25) {
    state.pumpThrottle = [state.pumpThrottle[0], 25];
  }

  // Reservoir suction factor: if plant water reservoir is depleted (< 25%), suction cavitates!
  const reservoirSuctionFactor =
    state.waterReservoir >= 25
      ? 1.0
      : clamp(0.40 + (state.waterReservoir / 25) * 0.60, 0.40, 1.0);

  const loopAPumps = (state.mcpActive[0] ? 0.25 : 0) + (state.mcpActive[1] ? 0.25 : 0);
  const loopBPumps = (state.mcpActive[2] ? 0.25 : 0) + (state.mcpActive[3] ? 0.25 : 0);
  const loopAFlow = loopAPumps * (0.35 + 0.65 * (state.pumpThrottle[0] / 100)) * effA;
  const loopBFlow = loopBPumps * (0.35 + 0.65 * (state.pumpThrottle[1] / 100)) * effB;

  const rawTargetFlow =
    (0.08 + loopAFlow + loopBFlow) * acMotorSpeedFactor * reservoirSuctionFactor;
  state.coolantFlow += (rawTargetFlow - state.coolantFlow) * 0.78 * delta;

  // Severe low drum water level (< -100mm -> -350mm) starves pump downcomers (cavitation)
  if (state.drumWaterLevel < -140) {
    const downcomerStarvation = clamp(
      1.0 - ((-140 - state.drumWaterLevel) / 240) * 0.75,
      0.22,
      1.0
    );
    state.coolantFlow *= downcomerStarvation;
  }
  state.coolantFlow = clamp(state.coolantFlow, 0.05, 1.15);

  // ============================================================================
  // STAGE 3A: CORE TEMPERATURE, POSITIVE VOID & XENON-135 (UNIT A-2 & UNIT A)
  // ============================================================================
  const boilingPoint = 100 + Math.pow(Math.max(0, state.drumPressure - 1), 0.38) * 37;

  // Core submergence drops sharply when drumWaterLevel falls below -100 mm
  const waterSubmergence =
    state.drumWaterLevel >= -90
      ? 1.0
      : clamp(1.0 - ((-90 - state.drumWaterLevel) / 260) * 0.62, 0.32, 1.0);

  // Fuel Channel Burnup & Refueling Accounting (37 RBMK Fuel Channels on UNIT A-2)
  const spentCount = Object.keys(state.coreTileAnomalies).length;
  const fuelEfficiency = Math.max(0.55, 1 - spentCount * 0.065);
  if (tutorialPhase === 'COMPLETED' && state.thermalPower > 300 && spentCount < 4) {
    const burnRate = 0.55 + 0.65 * (state.thermalPower / NOMINAL_THERMAL_MW);
    state.fuelBurnupTimer += burnRate * delta;
    if (state.fuelBurnupTimer >= 80.0) {
      state.fuelBurnupTimer -= 80.0;
      let nextChannel: number | undefined = SPENT_FUEL_CHANNEL_ORDER.find(
        (ch) => !state.coreTileAnomalies[ch]
      );
      if (nextChannel === undefined) {
        for (let i = 0; i < 37; i++) {
          if (!state.coreTileAnomalies[i]) {
            nextChannel = i;
            break;
          }
        }
      }
      if (nextChannel !== undefined) {
        state.coreTileAnomalies = {
          ...state.coreTileAnomalies,
          [nextChannel]: 'spent',
        };
      }
    }
  }

  // Secondary Helium-N2 loop removes dry moderator heat alongside primary water loop;
  // 4+ un-refueled spent fuel rods cause localized core overheat until reloaded!
  const spentOverheatInput = spentCount >= 4 ? (spentCount - 3) * 42.0 : 0;
  const heatInput = state.thermalPower * 0.16 + spentOverheatInput;
  const ambientCooling = (state.coreTemp - 25) * 0.02;
  const gasHeatRemoval = Math.max(0, state.coreTemp - 180) * gasCoolingPower * 0.55;
  const waterHeatRemoval =
    Math.max(0, state.coreTemp - 195) * state.coolantFlow * waterSubmergence * 3.85;

  state.coreTemp += (heatInput - ambientCooling - gasHeatRemoval - waterHeatRemoval) * 0.22 * delta;
  state.coreTemp = Math.max(20, state.coreTemp);

  // Low Boron Tank (< 25%) degrades negative neutron absorption worth of inserted control rods!
  const effectiveRodPosition = clamp(
    state.controlRods + (1 - state.controlRods) * (1 - boronEffectiveness) * 0.34,
    0,
    1
  );

  // Coupled Control Rods (UNIT A-2) <-> Feedwater Inflow (UNIT B) Reactivity Balance:
  // - Rod heat demand scales 1-to-1 with fresh fuel: 55% rods => 0.50, matching 50% Feedwater @ 4 pumps.
  // - Rod > Water (+imbalance): positive reactivity -> Steam Void rises.
  // - Water > Rod (-imbalance): cold over-quench -> negative reactivity -> Xenon-135 rises.
  const rodHeatDemand =
    effectiveRodPosition <= 0.10
      ? 0
      : ((effectiveRodPosition - 0.10) / 0.90) * fuelEfficiency;
  const pumpDelivery = clamp(state.coolantFlow / 0.80, 0.20, 1.02) * waterSubmergence;
  const effectiveWaterInflow = state.feedwaterValve * reservoirSuctionFactor * pumpDelivery;
  const rodWaterImbalance = rodHeatDemand - effectiveWaterInflow;

  // Reactivity-Moderated Steam Void Fraction (No tile latching)
  let targetVoid = 0;
  if (state.coreTemp > boilingPoint - 12 || state.thermalPower > 180) {
    const excessHeatOverWater = Math.max(0, rodWaterImbalance - 0.05) * 1.55;
    const lowWaterVoidPenalty =
      state.drumWaterLevel < -60
        ? Math.min(0.55, ((-60 - state.drumWaterLevel) / 240) * 0.52)
        : 0;
    const baselineBoilingVoid =
      state.thermalPower > 200
        ? clamp(0.06 + (state.thermalPower / NOMINAL_THERMAL_MW) * 0.08, 0, 0.16)
        : 0;
    targetVoid = clamp(
      baselineBoilingVoid + excessHeatOverWater + lowWaterVoidPenalty,
      0,
      1.0
    );
  }

  const voidRate = targetVoid > state.voidFraction ? 1.15 : 1.35;
  state.voidFraction += (targetVoid - state.voidFraction) * voidRate * delta;

  if (rodWaterImbalance < -0.03 && state.voidFraction > 0.04) {
    state.voidFraction = Math.max(
      0.04,
      state.voidFraction - Math.abs(rodWaterImbalance) * 0.35 * delta
    );
  }
  if (state.boronDampingTimer > 0) {
    state.voidFraction = Math.max(0, state.voidFraction - 0.06 * delta);
  }
  state.voidFraction = clamp(state.voidFraction, 0, 1.0);

  // Reactivity-Moderated Xenon-135 & Iodine-135 Fission Poison Kinetics (Cold-start protected)
  const normalizedPower = state.thermalPower / NOMINAL_THERMAL_MW;
  const iodineProduction = normalizedPower * 0.95;
  const iodineDecay = state.iodine * 0.024;
  state.iodine = clamp(state.iodine + (iodineProduction - iodineDecay) * delta, 0, 100);

  const coreHasStarted =
    state.iodine > 2.5 || state.coreTemp > 145 || state.thermalPower > 180;
  if (coreHasStarted) {
    const overcoolExcess = Math.max(0, -rodWaterImbalance - 0.055);
    const lowFluxDrop =
      state.iodine > 10 && effectiveRodPosition < 0.38
        ? (0.38 - effectiveRodPosition) * 5.5
        : 0;
    if (overcoolExcess > 0 || lowFluxDrop > 0) {
      const xenonBuildRate =
        overcoolExcess * 11.5 + lowFluxDrop + state.iodine * 0.025;
      state.xenon += xenonBuildRate * delta;
    } else {
      const targetEqXenon = state.thermalPower > 150 ? 6 : 0;
      const burnSpeed =
        1.6 + Math.max(0, rodWaterImbalance) * 4.5 + normalizedPower * 0.9;
      if (state.xenon > targetEqXenon) {
        state.xenon = Math.max(targetEqXenon, state.xenon - burnSpeed * delta);
      } else {
        state.xenon += (targetEqXenon - state.xenon) * 0.35 * delta;
      }
    }
  }
  state.xenon = clamp(state.xenon, 0, 100);

  // Net Reactivity & Fission Thermal Output (`thermalPower` in MWt)
  const graphiteReactivity =
    state.graphiteTemp > 540 ? ((state.graphiteTemp - 540) / 220) * 0.025 : 0;
  const rodReactivity = (effectiveRodPosition - 0.48) * 0.08;
  const waterBalanceReactivity = coreHasStarted
    ? clamp(rodWaterImbalance * 0.048, -0.028, 0.028)
    : 0;
  const voidReactivity = state.voidFraction * VOID_COEFFICIENT;
  const xenonReactivity = -state.xenon * XENON_SCALE;
  const dopplerReactivity = -(state.coreTemp - 280) * DOPPLER_COEFFICIENT;

  state.reactivity =
    rodReactivity +
    waterBalanceReactivity +
    voidReactivity +
    xenonReactivity +
    dopplerReactivity +
    graphiteReactivity +
    az5TipReactivityBonus;

  let baseEquilibriumMW = 0;
  if (effectiveRodPosition <= 0.10) {
    baseEquilibriumMW = 0;
  } else if (effectiveRodPosition <= 0.55) {
    baseEquilibriumMW = ((effectiveRodPosition - 0.10) / 0.45) * 1920;
  } else if (effectiveRodPosition <= 0.90) {
    baseEquilibriumMW = 1920 + ((effectiveRodPosition - 0.55) / 0.35) * 1280;
  } else {
    baseEquilibriumMW = 3200 + ((effectiveRodPosition - 0.90) / 0.10) * 380;
  }
  baseEquilibriumMW *= fuelEfficiency;

  const voidPowerBonus =
    effectiveRodPosition > 0.10
      ? Math.max(0, state.voidFraction - 0.14) * 260 +
        Math.max(0, state.voidFraction - 0.30) * 460
      : 0;
  const xenonPowerPenalty =
    effectiveRodPosition > 0.10
      ? Math.max(0, state.xenon - 15) * 7.5 + Math.max(0, state.xenon - 35) * 6.5
      : 0;
  const boronDampingPenalty = state.boronDampingTimer > 0 ? 520 : 0;
  const az5SpikeMW = az5TipReactivityBonus > 0 ? az5TipReactivityBonus * 25000 : 0;

  const targetThermalMW =
    effectiveRodPosition <= 0.10 && az5SpikeMW === 0
      ? 0
      : clamp(
          baseEquilibriumMW +
            graphiteModerationMWt +
            voidPowerBonus -
            xenonPowerPenalty -
            boronDampingPenalty +
            az5SpikeMW,
          0,
          4800
        );

  const powerRate = state.az5Active && az5SpikeMW === 0 ? 3.2 : 1.45;
  state.thermalPower += (targetThermalMW - state.thermalPower) * powerRate * delta;
  if (effectiveRodPosition <= 0.10 && state.thermalPower < 8 && az5SpikeMW === 0) {
    state.thermalPower = 0;
  }
  state.thermalPower = clamp(state.thermalPower, 0, 4800);

  // Update 37-tile RBMK Core Map local flux values
  const fluxPercent = Math.min(100, (state.thermalPower / NOMINAL_THERMAL_MW) * 100);
  for (let i = 0; i < 37; i++) {
    if (state.coreTileAnomalies[i] === 'spent') {
      state.rodTilesFlux[i] = 10;
    } else {
      const radialWeight = i < 7 ? 1.15 : i < 19 ? 1.0 : 0.85;
      state.rodTilesFlux[i] = Math.min(100, fluxPercent * radialWeight);
    }
  }

  // ============================================================================
  // STAGE 3B: STEAM DRUM WATER MASS, SINGLE-TRUTH PRESSURE & BUBBLER POOL
  // ============================================================================
  // 1. Steam Boiled from Core Heat + Coolant Circulation + Drum Submergence:
  //    At 1920 MWt nominal (55% rods), 4/4 pumps @ 60% throttle -> boils 600 MW steam into battery generators
  const voidBoilingPenalty =
    state.voidFraction > 0.34 ? clamp(1.0 - (state.voidFraction - 0.34) * 1.15, 0.32, 1.0) : 1.0;
  const pumpTransferCapMWe = (state.coolantFlow / 0.78) * 760;
  const rawThermalSteamMWe =
    state.coreTemp > boilingPoint - 22
      ? (state.thermalPower / 1920) * 600
      : (state.thermalPower / 1920) * 180;
  const steamBoiledMWe =
    Math.min(rawThermalSteamMWe, pumpTransferCapMWe * 1.38) *
    waterSubmergence *
    voidBoilingPenalty;

  // 2. Feedwater Mass Inflow (`feedwaterValve = 0.50` supplies exactly `600 MW` mass equivalent)
  const feedwaterSupplyMWe = state.feedwaterValve * 1200 * reservoirSuctionFactor;

  // Integrate Drum Water Level (`drumWaterLevel` in mm: `d(Level)/dt = k_lvl * (FeedwaterIn - SteamBoiled)`):
  const netWaterMassMWe = feedwaterSupplyMWe - steamBoiledMWe;
  let dWaterMmPerSec = netWaterMassMWe * 0.058;

  if (state.drumPressure < 58 && state.drumWaterLevel > 45 && netWaterMassMWe > 0 && state.feedwaterValve <= 0.65) {
    // Startup high-level overflow weir returns cold excess smoothly during initial drum boil-up
    dWaterMmPerSec = (52 - state.drumWaterLevel) * 0.55;
  } else if (Math.abs(netWaterMassMWe) <= 45) {
    // Stronger automatic drum-separator level self-centering within ±45 MW balance band
    dWaterMmPerSec += -state.drumWaterLevel * 0.22;
  } else {
    // Proportional drum-separator overflow / automatic level damping across all operating pressures
    dWaterMmPerSec += -state.drumWaterLevel * 0.045;
  }

  state.drumWaterLevel += dWaterMmPerSec * delta;

  // Holding BUBBLER DRAIN on UNIT B actively dumps excess separator water (> +50 mm) into condensate return
  if (state.bubblerDraining && state.drumWaterLevel > 50) {
    state.drumWaterLevel -= 95 * delta;
  }

  state.drumWaterLevel = clamp(state.drumWaterLevel, -400, 400);

  // Wet Steam Carryover (`drumWaterLevel > +180mm`): floods moisture separators and mildly reduces charger efficiency
  state.wetSteamSeverity =
    state.drumWaterLevel > 180
      ? clamp((state.drumWaterLevel - 180) / 200, 0, 1)
      : 0;

  // 3. Bubbler Pool Back-Pressure, Automatic Steam Generator Intake & Relief
  if (state.drumPressure >= 85) state.reliefValveOpen = true;
  if (state.drumPressure <= 75) state.reliefValveOpen = false;

  // If Bubbler Pool hits >= 95%, suppression headers choke and block steam relief!
  const bubblerReliefCapacity =
    state.bubblerLevel >= 95
      ? clamp((99 - state.bubblerLevel) / 4, 0.04, 1.0)
      : 1.0;

  const pressureHeadRatio = Math.max(0.15, state.drumPressure / NOMINAL_PRESSURE_BAR);
  const boilerHead = clamp((state.drumPressure - 16) / 52, 0, 1.12);
  const autoGenSteamDrawMWe =
    state.az5Active || state.coreMeltdown || state.steamExplosion
      ? 0
      : Math.min(MAX_BATTERY_INPUT_MW, steamBoiledMWe * boilerHead);

  // Manual Steam Vent & Automatic Relief Valve dump steam into the Bubbler Pool
  const manualVentMWe =
    (state.ventingSteam || state.steamDumpValve)
      ? 260 * pressureHeadRatio * bubblerReliefCapacity
      : 0;
  const safetyReliefMWe = state.reliefValveOpen
    ? 390 * pressureHeadRatio * bubblerReliefCapacity
    : 0;

  // Pulling BUBBLER DRAIN on UNIT B drains condensed water back to the reservoir AND condenses excess drum steam (>72 BAR)
  const condenserDrainSteamMWe =
    state.bubblerDraining && state.drumPressure > 72 && state.bubblerLevel < 95
      ? 145 * pressureHeadRatio
      : 0;

  const coreOverheatPressureMWe =
    state.coreTemp > 580 ? (state.coreTemp - 580) * 0.35 : 0;

  // Single Source of Truth Differential Equation for `drumPressure` (BAR):
  const netSteamBalanceMWe =
    steamBoiledMWe +
    coreOverheatPressureMWe -
    autoGenSteamDrawMWe -
    manualVentMWe -
    safetyReliefMWe -
    condenserDrainSteamMWe;

  // Cold reactor with 0 MWt cools back toward 1 BAR atmospheric
  if (state.thermalPower < 10 && state.drumPressure > 1.0) {
    state.drumPressure = Math.max(1.0, state.drumPressure - 1.3 * delta);
  } else {
    const pressurizationGain = state.drumPressure < 64 ? 0.0155 : 0.0105;
    state.drumPressure += netSteamBalanceMWe * pressurizationGain * delta;

    // If Bubbler Pool is choked (>= 95%) while relief/vent is trying to open, back-pressure rises
    if (state.bubblerLevel >= 95 && (state.ventingSteam || state.reliefValveOpen)) {
      state.drumPressure += 2.2 * delta;
    }
  }
  state.drumPressure = clamp(state.drumPressure, 1.0, 120.0);

  // 4. Bubbler Pool Level (`bubblerLevel` 0-100%) & Regional Water Reservoir Conservation
  const steamIntoBubblerPctPerSec =
    ((manualVentMWe + safetyReliefMWe) / 260) * 2.1 +
    (state.thermalPower > 400 && !state.condenserVacActive ? 0.65 : 0);
  const bubblerDrainOutPctPerSec = state.bubblerDraining && state.bubblerLevel > 4 ? 9.5 : 0.22;

  state.bubblerLevel = clamp(
    state.bubblerLevel + (steamIntoBubblerPctPerSec - bubblerDrainOutPctPerSec) * delta,
    4,
    100
  );

  // Water Reservoir & Regional Basins:
  const wastedVentWaterRate = ((manualVentMWe + safetyReliefMWe) / 260) * 0.9;
  const highPumpDrawRate =
    state.thermalPower > 400
      ? Math.max(0, (state.pumpThrottle[0] + state.pumpThrottle[1]) * 0.5 - 66) * 0.014 +
        Math.max(0, state.feedwaterValve - 0.58) * 0.55
      : 0;
  const naturalRiverMakeup = 0.42;
  const recycledFromBubbler =
    state.bubblerDraining && state.bubblerLevel > 5 ? 5.8 : 0;

  const netWaterDelta =
    (naturalRiverMakeup + recycledFromBubbler - wastedVentWaterRate - highPumpDrawRate) * delta;

  const loopASiphon = (state.pumpThrottle[0] / 100) * 1.15;
  const loopBSiphon = (state.pumpThrottle[1] / 100) * 1.15;
  state.pripyatWater = clamp(state.pripyatWater + netWaterDelta * loopASiphon, 5, 100);
  state.kolkhozWater = clamp(state.kolkhozWater + netWaterDelta * ((loopASiphon + loopBSiphon) * 0.5), 5, 100);
  state.vodkaWater = clamp(state.vodkaWater + netWaterDelta * loopBSiphon, 5, 100);
  state.waterReservoir = Math.round(
    (state.pripyatWater + state.kolkhozWater + state.vodkaWater) / 3
  );
  state.plantWaterDrainPct = Math.round(
    clamp((wastedVentWaterRate + highPumpDrawRate) * 28, 0, 100)
  );

  // ============================================================================
  // STAGE 4: STATION BATTERY STORAGE, SINGLE GRID WHEEL & RADIATION (UNIT C <-> UNIT A)
  // ============================================================================
  const wetSteamEff = 1.0 - state.wetSteamSeverity * 0.12;
  const vacEff = state.condenserVacActive ? 1.0 : 0.82;
  state.energyCreatedMW =
    state.az5Active || state.coreMeltdown || state.steamExplosion
      ? 0
      : Math.round(clamp(autoGenSteamDrawMWe * wetSteamEff * vacEff, 0, MAX_BATTERY_INPUT_MW));

  state.energyDemandMW = state.substations.reduce((s, x) => s + x.targetMW, 0);
  state.batteryOutputValve = clamp(state.batteryOutputValve, 0, 1);
  const requestedGridMW = Math.round(state.batteryOutputValve * 1000);

  // Battery supplies requestedGridMW while stored charge > 1 MWh; if depleted, caps at energyCreatedMW
  const deliveredGridMW =
    state.batteryStoredMWh > 1.0
      ? requestedGridMW
      : Math.min(requestedGridMW, state.energyCreatedMW);

  const netChargeFlowMW = state.energyCreatedMW - deliveredGridMW;
  state.batteryStoredMWh = clamp(
    state.batteryStoredMWh + netChargeFlowMW * 0.045 * delta,
    0,
    1000
  );

  state.totalElectricalMW = deliveredGridMW;
  state.houseLoadMW = (state.ventilationActive ? 15 : 0) + (state.kgbLineActive ? 10 : 0);

  const syncedRpm = clamp((state.energyCreatedMW / 600) * 3000, 0, 3000);
  const isOnline = deliveredGridMW > 0 || state.energyCreatedMW > 20;
  state.turbines.forEach((turb) => {
    turb.valve = state.batteryOutputValve;
    turb.rpm = syncedRpm;
    turb.freqHz = isOnline ? 50.0 : 0;
    turb.syncPhase = 0;
    turb.gridConnected = isOnline;
    turb.electricalMW = Math.round(deliveredGridMW * 0.5);
    turb.tripped = false;
  });

  // Containment & Control Room Radiation Conservation (`roomRadiation` in R/h):
  // - Leaks upward when UNIT B Seal Scrubbers (`sealToggles`) are OFF under gas pressure,
  //   or when live steam is vented (`ventingSteam` / `reliefValveOpen`), or coreTemp > 680°C.
  // - Actively scrubbed (-1.2 R/h/s) when UNIT C `VENTILATION` (`ventilationActive`) is ON!
  const openSealsCount = 3 - activeScrubbers;
  const gasLeakRadRate =
    state.thermalPower > 100 && openSealsCount > 0
      ? openSealsCount * (0.045 + (state.heliumPressure / 70) * 0.095)
      : 0;
  const ventRadRate =
    (state.ventingSteam ? 0.14 : 0) +
    (state.reliefValveOpen ? 0.45 : 0) +
    (state.coreTemp > 700 ? ((state.coreTemp - 700) / 200) * 0.35 : 0);
  const baselineRad = 0.10 + (state.thermalPower / NOMINAL_THERMAL_MW) * 0.22;
  const ventScrubRate = state.ventilationActive ? 1.2 : 0.08;

  const nextRad =
    state.roomRadiation +
    (gasLeakRadRate + ventRadRate) * delta -
    Math.max(0, state.roomRadiation - baselineRad) * ventScrubRate * delta;
  state.roomRadiation = clamp(
    Math.max(baselineRad * (state.ventilationActive ? 0.85 : 1.0), nextRad),
    0.1,
    15.0
  );

  // ============================================================================
  // STAGE 5: SUBSTATION QUOTA & TELEMETRY EVALUATION (BATTERY DISPATCH BALANCE)
  // ============================================================================
  const totalAllocatedMW = state.substations.reduce((s, x) => s + x.allocatedMW, 0);
  const totalTargetMW = state.substations.reduce((s, x) => s + x.targetMW, 0);
  const hasEnoughPower = state.totalElectricalMW >= totalAllocatedMW - 20;
  const surplusGridMW = state.totalElectricalMW - totalTargetMW;

  state.substations[0].allocatedH2O = Math.round(state.pripyatWater);
  state.substations[2].allocatedH2O = Math.round(state.kolkhozWater);
  state.substations[4].allocatedH2O = Math.round(state.vodkaWater);

  state.substations.forEach((sub) => {
    const leverMatchesTarget = Math.abs(sub.allocatedMW - sub.targetMW) <= 10;
    const mwMet = hasEnoughPower && leverMatchesTarget;

    if (!hasEnoughPower && sub.allocatedMW > 0) {
      sub.statusText = `LOW OUT (${Math.round(state.totalElectricalMW)}/${totalAllocatedMW}MW)`;
    } else if (surplusGridMW > 65 && sub.allocatedMW > 0) {
      sub.statusText = `SURPLUS (+${Math.round(surplusGridMW)}MW)`;
    } else if (sub.id === 1) {
      sub.statusText = mwMet ? 'HEATING OK' : 'HEATING LOW';
    } else if (sub.id === 2) {
      sub.statusText = mwMet ? 'SWEEP OK' : 'SWEEP OFFLINE';
    } else if (sub.id === 3) {
      sub.statusText = mwMet ? 'GRID OK' : 'POWER LOW';
    } else if (sub.id === 4) {
      sub.statusText = state.kgbLineActive ? (mwMet ? 'LINE: ON' : 'POWER LOW') : 'LINE: OFF';
    } else if (sub.id === 5) {
      sub.statusText = mwMet ? 'MASH OK' : 'MASH COLD';
    } else if (sub.id === 6) {
      sub.statusText = mwMet ? 'FURNACE HOT' : 'FURNACE COLD';
    }

    sub.quotaOk = mwMet && (sub.id !== 4 || state.kgbLineActive);
  });

  // Catastrophic Failure Thresholds
  if (state.coreTemp > 1100) state.coreMeltdown = true;
  if (state.drumPressure > 115) state.steamExplosion = true;
}

/**
 * Legacy compatibility stub (UNIT C now dispatches continuously via Station Battery Bank)
 */
export function toggleGridBreaker(state: ReactorState, turbineIndex: 0 | 1 = 0): {
  success: boolean;
  reason?: string;
} {
  const turb = state.turbines[turbineIndex];
  if (turb) {
    turb.tripped = false;
    turb.gridConnected = true;
  }
  return { success: true };
}

/**
 * Volkov Training Drill & Live Multi-Panel Causal Order Guide (Steps 0–7 + Live Shift)
 */
export function evaluateTutorial(state: ReactorState, currentPhase: TutorialPhase): TutorialPrompt {
  switch (currentPhase) {
    case 'STEP_0_PICKUP_WEPAD': {
      if (state.wePadHeld) {
        return evaluateTutorial(state, 'STEP_1_COOLING');
      }
      return {
        phase: 'STEP_0_PICKUP_WEPAD',
        header: '>> STEP 0/7 [DESK — WE-PAD 84]:',
        body: 'ACTION: PRESS [E] (OR CLICK) TO PICK UP YOUR "WE-PAD 84" TABLET FROM THE DESK ([TAB] TO INSPECT CLOSE-UP).',
        hint: 'WHY: Your WePad 84 links to Plant Director Volkov and tracks live RBMK-1000 physics across all consoles.',
        panelKey: 'GO TO: [KEY 4] INSPECTOR DESK',
        actionLine: 'PRESS [E] TO PICK UP WE-PAD 84',
        whyLines: [
          'Streams live core physics as you walk between consoles.',
          'Hold [TAB] anytime to bring the screen close to your eyes.'
        ],
        volkovQuote:
          '"Your predecessor left this tablet in the canteen. He now audits snowdrifts in Magadan."'
      };
    }

    case 'STEP_1_COOLING': {
      const activePumps = state.mcpActive.filter(Boolean).length;
      if (activePumps >= 2 && state.feedwaterValve >= 0.45) {
        return evaluateTutorial(state, 'STEP_2_PULL_RODS');
      }
      return {
        phase: 'STEP_1_COOLING',
        header: '>> STEP 1/7 [KEY 3 -> UNIT B // COOLING & GAS]:',
        body: 'ACTION: ON [UNIT B], START ALL 4 "MAIN CIRC. PUMPS", SCROLL "FEEDWATER VALVE" TO 50%, AND VERIFY SCRUBBERS / HE-N2 GAS.',
        hint: 'WHY: Flooded fuel tubes keep DRUM LEVEL near 0mm & STEAM VOID low; He-N2 & Scrubbers cool graphite bricks; Oil Cooler saves bearings.',
        panelKey: 'GO TO: [KEY 3] UNIT B (FAR LEFT)',
        actionLine: 'START 4 PUMPS & SET FEEDWATER 50%',
        whyLines: [
          'Floods fuel tubes -> keeps DRUM LEVEL 0mm & STEAM VOID safe.',
          'He-N2 + Scrubbers cool graphite; Oil Cooler saves bearings.'
        ],
        volkovQuote:
          '"Since the Ministry replaced our containment dome with a motivational banner, dry tubes & melted bearings come out of your pension."'
      };
    }

    case 'STEP_2_PULL_RODS': {
      if (state.controlRods >= 0.50 && state.thermalPower >= 200) {
        return evaluateTutorial(state, 'STEP_3_BUILD_STEAM');
      }
      return {
        phase: 'STEP_2_PULL_RODS',
        header: '>> STEP 2/7 [KEY 3 -> UNIT A-2 // BORON RODS]:',
        body: 'ACTION: ON [UNIT A-2] LEFT BAY, SCROLL OR DRAG THE [CONTROL ROD DRIVE] WHEEL TO RAISE BORON RODS TO 55%.',
        hint: 'WHY: Boron control rods act as neutron sponges. Pulling them UP raises REACTIVITY and heats core water (~1920 MWt).',
        panelKey: 'GO TO: [KEY 3] UNIT A-2 (MID-LEFT)',
        actionLine: 'TURN [CONTROL ROD DRIVE] WHEEL TO 55%',
        whyLines: [
          'Boron rods act as neutron sponges inside the core.',
          'Pulling them UP raises REACTIVITY & THERMAL MWt gauge.'
        ],
        volkovQuote:
          '"Treat boron rods with Socialist respect, Comrade. Pull smoothly—Uranium-235 does not take five-minute tea breaks."'
      };
    }

    case 'STEP_3_BUILD_STEAM': {
      if (state.energyCreatedMW >= 420 && state.drumPressure >= 54) {
        return evaluateTutorial(state, 'STEP_4_SPIN_TURBINE');
      }
      return {
        phase: 'STEP_3_BUILD_STEAM',
        header: '>> STEP 3/7 [KEY 5 -> UNIT C // CHARGE BATTERY]:',
        body: 'ACTION: PRESS [KEY 5] TO VIEW UNIT C ENERGY STORAGE AND WATCH "ENERGY CREATED" CLIMB TO ~600 MW AS STEAM CHARGES THE BATTERY.',
        hint: 'WHY: Fission steam automatically spins the turbo-chargers into the Station Battery Bank, building stored energy before grid dispatch.',
        panelKey: 'GO TO: [KEY 5] UNIT C (RIGHT WALL)',
        actionLine: 'WATCH [ENERGY CREATED] & [ENERGY STORED] CLIMB',
        whyLines: [
          'Core steam automatically creates ~600 MW into the Battery Bank.',
          'Left gauge shows ENERGY CREATED; center shows ENERGY STORED %.'
        ],
        volkovQuote:
          '"No synchronizing flywheels in the dark anymore! Steam charges the giant Soviet Battery Bank—just watch the needle climb."'
      };
    }

    case 'STEP_4_SPIN_TURBINE': {
      if (state.totalElectricalMW >= 550) {
        return evaluateTutorial(state, 'STEP_6_BASELINE_600MW');
      }
      return {
        phase: 'STEP_4_SPIN_TURBINE',
        header: '>> STEP 4/7 [KEY 5 -> UNIT C // BATTERY TO GRID]:',
        body: 'ACTION: TURN THE SINGLE [BATTERY -> GRID] WHEEL ON UNIT C TO 600 MW (60%) TO MATCH ENERGY DEMAND.',
        hint: 'WHY: This single wheel controls how much power flows out of the Battery Bank to the 6 regional stations.',
        panelKey: 'GO TO: [KEY 5] UNIT C (CENTER WHEEL)',
        actionLine: 'TURN [BATTERY -> GRID] WHEEL TO 600 MW (60%)',
        whyLines: [
          'One wheel controls energy sent from Battery to Grid.',
          'Match 600 MW ENERGY DEMAND while Battery buffers flow!'
        ],
        volkovQuote:
          '"One wheel, Comrade! Even the Minister\'s nephew couldn\'t confuse this—turn it up to 600 MW so the grid stops complaining."'
      };
    }

    case 'STEP_5_SYNC_GRID': {
      return evaluateTutorial(state, 'STEP_6_BASELINE_600MW');
    }

    case 'STEP_6_BASELINE_600MW': {
      const allLeversMatch = state.substations.every(
        (s) => Math.abs(s.allocatedMW - s.targetMW) <= 15
      );
      if (state.totalElectricalMW >= 550 && allLeversMatch) {
        state.feedwaterValve = 0.24;
        state.nitrogenLoopValve = 24;
        state.voidFraction = 0.44;
        state.coreTileAnomalies = {};
        state.selectedRefuelChannel = null;
        return evaluateTutorial(state, 'STEP_7_VOID_DRILL');
      }
      return {
        phase: 'STEP_6_BASELINE_600MW',
        header: '>> STEP 5/7 [KEY 1 -> UNIT A // 6 SECTOR LEVERS]:',
        body: 'ACTION: GO TO UNIT A [KEY 1] AND SET ALL 6 SECTOR LEVERS TO 100 MW TO RECEIVE 600 MW FROM THE BATTERY.',
        hint: 'WHY: The 6 sector levers allocate your 600 MW battery output to each Soviet sector cleanly.',
        panelKey: 'GO TO: [KEY 1] UNIT A (6 LEVERS)',
        actionLine: 'SET ALL 6 SECTOR LEVERS ON UNIT A TO 100 MW',
        whyLines: [
          'Distributes your 600 MW battery output across all 6 sectors.',
          'Ensure UNIT C wheel stays near 600 MW ENERGY DEMAND.'
        ],
        volkovQuote:
          '"Pull all six substation levers to 100 MW! Pripyat needs kettles, Duga needs radar, and the Vodka Plant needs pumps!"'
      };
    }

    case 'STEP_7_VOID_DRILL': {
      if (state.voidFraction < 0.24 && state.xenon < 24 && state.feedwaterValve >= 0.42) {
        state.voidFraction = 0.10;
        state.xenon = 6;
        state.coreTileAnomalies = { 12: 'spent', 24: 'spent' };
        state.selectedRefuelChannel = null;
        return evaluateTutorial(state, 'STEP_8_XENON_DRILL');
      }
      return {
        phase: 'STEP_7_VOID_DRILL',
        header: '>> STEP 6/7 [KEY 3 UNIT B & A-2 // ROD & WATER BALANCE]:',
        body: 'ACTION: STEAM VOID (44%) FROM LOW FEEDWATER! TURN [FEEDWATER VALVE] ON UNIT B BACK TO ~50% TO MATCH YOUR 55% CONTROL RODS UNTIL VOID < 24%!',
        hint: 'WHY: Feedwater & Control Rods must stay balanced together! Too little water for your rods raises VOID; too much cold water for your rods raises XENON!',
        panelKey: 'GO TO: [KEY 3] UNIT B & UNIT A-2',
        actionLine: 'MATCH FEEDWATER (~50%) TO RODS (~55%) UNTIL VOID < 24%',
        whyLines: [
          'Too much Rod heat vs. Feedwater -> Steam Void rises!',
          'Too much cold Feedwater vs. Rods -> Xenon-135 rises!'
        ],
        volkovQuote:
          '"Rods and water are dance partners, Comrade! Starve the water and steam voids race; drown the rods and Xenon ash chokes the fire."'
      };
    }

    case 'STEP_8_XENON_DRILL': {
      if (Object.keys(state.coreTileAnomalies).length === 0) {
        state.xenon = 4;
        state.selectedRefuelChannel = null;
        return evaluateTutorial(state, 'COMPLETED');
      }
      return {
        phase: 'STEP_8_XENON_DRILL',
        header: '>> STEP 7/7 [KEY 3 UNIT A-2 // ROD REFUELING]:',
        body: 'ACTION: 2 FUEL RODS SPENT! CLICK A GLOWING AMBER TILE ON "RBMK CORE" (UNIT A-2) TO SELECT IT, THEN DRAG THE [ROD REFUELING LEVER] DOWN TO RELOAD BOTH!',
        hint: 'WHY: Spent uranium rods cut MW output (~6.5% each) and 4+ spent rods overheat the core! Click an amber tile, then pull the Refueling Lever on UNIT A-2.',
        panelKey: 'GO TO: [KEY 3] UNIT A-2 (CORE & LEVER)',
        actionLine: 'CLICK AMBER CORE TILE -> PULL [ROD REFUELING LEVER] DOWN',
        whyLines: [
          'Spent amber rods reduce MW created & drain the battery.',
          '4+ un-refueled rods cause core heat buildup — refuel promptly!'
        ],
        volkovQuote:
          '"Refueling an RBMK while it runs at 2,000 megawatts is perfectly routine! Lock onto the amber cap and pull the crane lever."'
      };
    }

    case 'COMPLETED': {
      const totalTargetMW = state.substations.reduce((s, x) => s + x.targetMW, 0);
      const totalAllocatedMW = state.substations.reduce((s, x) => s + x.allocatedMW, 0);
      const unmetSub = state.substations.find((x) => Math.abs(x.allocatedMW - x.targetMW) >= 5);
      const dispatchedMW = state.totalElectricalMW;
      const demandMW = totalTargetMW;
      const deltaMW = Math.round(dispatchedMW - demandMW);
      const targetMWt = Math.round((demandMW / 600) * 1920);
      const reqFeedwaterPct = Math.min(100, Math.round((demandMW / 600) * 50));
      const reqWheelPct = Math.min(100, Math.round(demandMW / 10));
      const curRodPct = Math.round(state.controlRods * 100);
      const curFwPct = Math.round(state.feedwaterValve * 100);
      const curWheelPct = Math.round(state.batteryOutputValve * 100);

      const isPlusOrder =
        totalTargetMW > totalAllocatedMW + 5 ||
        (unmetSub !== undefined && unmetSub.targetMW > unmetSub.allocatedMW) ||
        deltaMW < -25 ||
        state.energyCreatedMW < demandMW - 90 ||
        state.batteryStoredMWh < 180;
      const isMinusOrder =
        totalTargetMW < totalAllocatedMW - 5 ||
        (unmetSub !== undefined && unmetSub.targetMW < unmetSub.allocatedMW) ||
        deltaMW > 25 ||
        state.energyCreatedMW > demandMW + 160 ||
        state.drumPressure > 76;

      if (isPlusOrder) {
        const s1Ok = state.thermalPower >= targetMWt - 110 && state.energyCreatedMW >= demandMW - 90;
        const s2Ok = state.feedwaterValve * 100 >= reqFeedwaterPct - 5 && state.drumPressure >= 54;
        const s3Ok = !unmetSub && Math.abs(totalAllocatedMW - totalTargetMW) < 6;
        const s4Ok = Math.abs(deltaMW) <= 25;
        const nextPanel = !s4Ok
          ? 'GO TO: [KEY 5] UNIT C (BATTERY WHEEL)'
          : !s3Ok
            ? 'GO TO: [KEY 1] UNIT A (SECTOR LEVER)'
            : !s1Ok
              ? 'GO TO: [KEY 3] UNIT A-2 (BORON RODS)'
              : 'GO TO: [KEY 3] UNIT B (FEEDWATER)';
        const nextAction = !s4Ok
          ? `3. TURN BATTERY WHEEL [C] (${curWheelPct}% -> ${reqWheelPct}%) TO ${demandMW} MW`
          : !s3Ok
            ? `2. PULL ${unmetSub ? unmetSub.name : 'SECTOR'} LEVER -> ${unmetSub ? unmetSub.targetMW : totalTargetMW} MW`
            : !s1Ok
              ? `1. RODS UP (${curRodPct}%) -> ~${targetMWt} MWt TO RECHARGE BATTERY`
              : `1B. FEEDWATER UP ${curFwPct}% -> ${reqFeedwaterPct}%`;
        return {
          phase: 'COMPLETED',
          header: `>> ACTIVE +MW ORDER (OUT ${Math.round(dispatchedMW)} -> DEMAND ${demandMW} MW):`,
          body: `${s1Ok && s2Ok ? '[OK]' : '[1]'} RODS UP [A-2] (${curRodPct}%) + WATER [B] (${curFwPct}%->${reqFeedwaterPct}%) | ${s3Ok ? '[OK]' : '[2]'} LEVER [A]`,
          hint: `${s4Ok ? '[OK]' : '[3]'} TURN BATTERY WHEEL [C] (${curWheelPct}% -> ${reqWheelPct}%) SO GRID OUT (${Math.round(dispatchedMW)} MW) MATCHES DEMAND (${demandMW} MW)!`,
          panelKey: nextPanel,
          actionLine: nextAction,
          whyLines: [
            '1. Rods [A-2] + Water [B] keep Battery charging at Demand.',
            '2. Pull Lever [A] -> 3. Turn Battery Wheel [C] to Demand MW!'
          ],
          volkovQuote:
            '"Battery buffers the grid while you raise the rods, Comrade—just dial the UNIT C wheel to match demand!"'
        };
      }

      if (isMinusOrder) {
        const s1LeversOk = !unmetSub && Math.abs(totalAllocatedMW - totalTargetMW) < 6;
        const s1WheelOk = Math.abs(deltaMW) <= 25;
        const s2RodsOk = state.energyCreatedMW <= demandMW + 160 && state.drumPressure <= 76;
        const nextPanel = !s1LeversOk
          ? 'GO TO: [KEY 1] UNIT A (SECTOR LEVER)'
          : !s1WheelOk
            ? 'GO TO: [KEY 5] UNIT C (BATTERY WHEEL)'
            : 'GO TO: [KEY 3] UNIT A-2 (PUSH RODS IN)';
        const nextAction = !s1LeversOk
          ? `1. LOWER ${unmetSub ? unmetSub.name : 'SECTOR'} LEVER -> ${unmetSub ? unmetSub.targetMW : totalTargetMW} MW`
          : !s1WheelOk
            ? `1B. TURN BATTERY WHEEL (${curWheelPct}% -> ${reqWheelPct}%) TO ${demandMW} MW`
            : !s2RodsOk
              ? `2. PUSH RODS IN (${curRodPct}%) SO BATTERY DOESN'T OVERCHARGE`
              : 'BATTERY & GRID BALANCED';
        return {
          phase: 'COMPLETED',
          header: `>> ACTIVE -MW ORDER (OUT ${Math.round(dispatchedMW)} -> DEMAND ${demandMW} MW):`,
          body: `${s1LeversOk && s1WheelOk ? '[OK]' : '[1]'} LOWER SECTOR LEVER [A] & BATTERY WHEEL [C] (${curWheelPct}% -> ${reqWheelPct}%) TO ${demandMW} MW`,
          hint: `${s2RodsOk ? '[OK]' : '[2]'} PUSH RODS IN [A-2] (${curRodPct}% -> ~${targetMWt} MWt) SO BATTERY DOESN'T OVERCHARGE!`,
          panelKey: nextPanel,
          actionLine: nextAction,
          whyLines: [
            '1. Lower Sector Lever [A] & Battery Wheel [C] to shed load.',
            '2. Push Rods IN [A-2] to match Energy Created to Demand!'
          ],
          volkovQuote:
            '"Ease back the UNIT C wheel to stop flooding the suburbs, then push Boron Rods in so the Battery Bank doesn\'t boil!"'
        };
      }

      return {
        phase: 'COMPLETED',
        header: `>> BATTERY & GRID BALANCED (${Math.round(dispatchedMW)}/${Math.round(demandMW)} MW):`,
        body: `DISPATCHED OUTPUT MATCHES ENERGY DEMAND (${Math.round(state.batteryStoredMWh / 10)}% BATTERY STORED)! CHECK [KEY 4] DESK FOR PRAVDA ORDERS.`,
        hint: '+MW: 1. Rods [A-2] + Water [B] -> 2. Lever [A] -> 3. Battery Wheel [C].  -MW: 1. Lower Lever [A] & Wheel [C] -> 2. Push Rods IN [A-2].',
        panelKey: 'CHECK: [KEY 4] DESK & [KEY 5] UNIT C',
        actionLine: 'AWAIT NEXT PRAVDA-84 POWER ORDER',
        whyLines: [
          'ENERGY CREATED charges the Battery; single UNIT C wheel feeds Grid.',
          'Tear incoming Pravda slips on [KEY 4] Desk to update quotas.'
        ],
        volkovQuote:
          '"Battery banked, megawatts balanced, tea warm. Naturally, Moscow will ruin this peace with a teletype order any second."'
      };
    }
  }
}
