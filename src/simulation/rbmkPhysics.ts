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
  autoRodEnabled: boolean;    // Automatic Regulator (АР micro-trimmer)
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
  coreTileAnomalies: Record<number, 'void' | 'xenon'>; // Local channel void/xenon pockets on 37-tile matrix

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

  // --- Turbines, Aux House Bus & 50Hz Regional Grid (UNIT C <-> UNIT A) ---
  turbines: [TurbineState, TurbineState]; // TG-1 & TG-2 (1050 MWe gross / 1000 MWe net rated)
  houseLoadMW: number;        // Internal plant electrical load (Ventilation + AVR + KGB Trunk + Condenser + Pumps)
  totalElectricalMW: number;  // Net MWe available to the 6 regional substations
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
const TURBINE_GROSS_RATED_MWE = 1050; // 1000 MWe net + ~30-50 MWe internal house switchgear
const ROD_SPEED = 0.015;
const AZ5_SPEED = 0.055;             // ~18s full insertion with 3.5s graphite displacer tip effect
const VOID_COEFFICIENT = 0.028;      // Positive void coefficient (+alpha_phi)
const DOPPLER_COEFFICIENT = 0.00004; // Negative fuel Doppler coefficient
const XENON_SCALE = 0.0012;

const DEFAULT_VOID_TILES = [6, 18, 24] as const;
const DEFAULT_XENON_TILES = [10, 18, 28] as const;

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
    autoRodEnabled: false,
    mcpActive: [false, false, false, false],
    pumpThrottle: [60, 60],
    oilCoolerValve: 45,
    feedwaterValve: 0.0,
    nitrogenLoopValve: 0,
    sealToggles: [false, false, false],
    steamDumpValve: false,
    ventingSteam: false,
    bubblerDraining: false,
    ventilationActive: false,
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
    houseLoadMW: 30,
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
  const nextAnomalies: Record<number, 'void' | 'xenon'> = {};
  for (const [k, v] of Object.entries(state.coreTileAnomalies)) {
    if (v !== 'void') {
      nextAnomalies[Number(k)] = v;
    }
  }
  state.coreTileAnomalies = nextAnomalies;
  return true;
}

/**
 * Interactive Channel Trimming on RBMK CORE (37 ROD TILES) on UNIT A-2:
 * Consumes hydraulic/liquid boron pressure (`boronTankLevel`); effectiveness scales down if Boron Tank is low!
 */
export function trimCoreChannelTile(
  state: ReactorState,
  tileIndex: number
): { trimmed: 'void' | 'xenon' | 'none'; remainingPct: number } {
  const directType = state.coreTileAnomalies[tileIndex];

  let targetType: 'void' | 'xenon' | null = directType ?? null;
  if (!targetType) {
    if (state.voidFraction >= 0.20 && state.voidFraction * 100 >= state.xenon) {
      targetType = 'void';
    } else if (state.xenon >= 20) {
      targetType = 'xenon';
    }
  }

  const boronAuthority = state.boronTankLevel >= 15 ? 1.0 : 0.35 + (state.boronTankLevel / 15) * 0.65;

  if (targetType === 'void') {
    state.boronTankLevel = Math.max(0, state.boronTankLevel - 4.5);
    state.voidFraction = Math.max(0, state.voidFraction - 0.12 * boronAuthority);
    state.coreTemp = Math.max(100, state.coreTemp - 12 * boronAuthority);
    const nextAnomalies = { ...state.coreTileAnomalies };
    if (nextAnomalies[tileIndex] === 'void') {
      delete nextAnomalies[tileIndex];
    } else if (boronAuthority > 0.6) {
      const firstVoidKey = Object.keys(nextAnomalies).find(
        (k) => nextAnomalies[Number(k)] === 'void'
      );
      if (firstVoidKey !== undefined) {
        delete nextAnomalies[Number(firstVoidKey)];
      }
    }
    state.coreTileAnomalies = nextAnomalies;
    return { trimmed: 'void', remainingPct: Math.round(state.voidFraction * 100) };
  }

  if (targetType === 'xenon') {
    state.boronTankLevel = Math.max(0, state.boronTankLevel - 3.0);
    state.xenon = Math.max(0, state.xenon - 12);
    const nextAnomalies = { ...state.coreTileAnomalies };
    if (nextAnomalies[tileIndex] === 'xenon') {
      delete nextAnomalies[tileIndex];
    } else {
      const firstXenonKey = Object.keys(nextAnomalies).find(
        (k) => nextAnomalies[Number(k)] === 'xenon'
      );
      if (firstXenonKey !== undefined) {
        delete nextAnomalies[Number(firstXenonKey)];
      }
    }
    state.coreTileAnomalies = nextAnomalies;
    return { trimmed: 'xenon', remainingPct: Math.round(state.xenon) };
  }

  return { trimmed: 'none', remainingPct: Math.round(state.voidFraction * 100) };
}

/**
 * Unified RBMK-1000 Causal Simulation Step:
 * 1. Core Fission, Boron Poison Hydraulics & Graphite/He-N2 Moderation (UNIT A-2 <-> UNIT B)
 * 2. Primary Water Loop, MCP Throttles, AC Rundown, Reservoir & Bearing Lube Oil (UNIT A <-> UNIT A-2 <-> UNIT B)
 * 3. Steam Drum Mass & Pressure Bridge + Bubbler Pool & Drain (UNIT B + UNIT A -> UNIT C)
 * 4. Turbine Mechanical Torque vs. 50Hz Electrical Load & Aux Switchgear (UNIT C <-> UNIT A)
 */
export function stepReactorSimulation(state: ReactorState, dt: number): void {
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
    state.autoRodEnabled = false;
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

  // Moving control rods or active АР servo regulation consumes hydraulic boron accumulator pressure
  const rodTravel = Math.abs(state.controlRods - prevRods);
  if (rodTravel > 0.0001 && !state.az5Active) {
    state.boronTankLevel = Math.max(0, state.boronTankLevel - rodTravel * 18.0);
  }
  if (state.autoRodEnabled && state.thermalPower > 300) {
    state.boronTankLevel = Math.max(0, state.boronTankLevel - 0.14 * delta);
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

  // Secondary Helium-N2 loop removes dry moderator heat alongside primary water loop
  const heatInput = state.thermalPower * 0.16;
  const ambientCooling = (state.coreTemp - 25) * 0.02;
  const gasHeatRemoval = Math.max(0, state.coreTemp - 180) * gasCoolingPower * 0.55;
  const waterHeatRemoval =
    Math.max(0, state.coreTemp - 195) * state.coolantFlow * waterSubmergence * 3.85;

  state.coreTemp += (heatInput - ambientCooling - gasHeatRemoval - waterHeatRemoval) * 0.22 * delta;
  state.coreTemp = Math.max(20, state.coreTemp);

  let voidTileCount = 0;
  let xenonTileCount = 0;
  for (const val of Object.values(state.coreTileAnomalies)) {
    if (val === 'void') voidTileCount += 1;
    else if (val === 'xenon') xenonTileCount += 1;
  }

  // Positive Void Fraction: driven by thermal-to-flow ratio, low drum water (< -80mm), and low pressure
  let targetVoid = 0;
  if (state.coreTemp > boilingPoint - 12) {
    const heatToFlowRatio =
      (state.thermalPower / NOMINAL_THERMAL_MW) /
      Math.max(0.15, state.coolantFlow * waterSubmergence);
    const pressureDropFactor = Math.max(
      0.65,
      NOMINAL_PRESSURE_BAR / Math.max(18, state.drumPressure)
    );
    const lowWaterVoidPenalty =
      state.drumWaterLevel < -60
        ? Math.min(0.62, ((-60 - state.drumWaterLevel) / 240) * 0.58)
        : 0;
    const highRodLowWaterSpike =
      state.controlRods > 0.80 && (state.drumWaterLevel < -90 || state.waterReservoir < 40)
        ? 0.22
        : 0;
    const baseBoilingVoid = Math.max(0, heatToFlowRatio * 0.40 * pressureDropFactor - 0.08);
    targetVoid = Math.min(1.0, baseBoilingVoid + lowWaterVoidPenalty + highRodLowWaterSpike);
  }

  const voidTileFloor = voidTileCount * 0.145;
  const effectiveTargetVoid = Math.max(targetVoid, voidTileFloor);
  state.voidFraction += (effectiveTargetVoid - state.voidFraction) * 1.45 * delta;

  // Cold feedwater surplus suppresses core steam voids
  const nominalFeedwaterNeed = (state.thermalPower / 1920) * 0.50;
  const surplusFeedwater = Math.max(
    0,
    state.feedwaterValve * reservoirSuctionFactor - nominalFeedwaterNeed
  );
  if (surplusFeedwater > 0.03 && state.voidFraction > 0.08) {
    state.voidFraction = Math.max(0.04, state.voidFraction - surplusFeedwater * 0.34 * delta);
    if (surplusFeedwater >= 0.14 && voidTileCount > 0 && state.voidFraction < voidTileCount * 0.14) {
      const firstVoidKey = Object.keys(state.coreTileAnomalies).find(
        (k) => state.coreTileAnomalies[Number(k)] === 'void'
      );
      if (firstVoidKey !== undefined) {
        const nextAnom = { ...state.coreTileAnomalies };
        delete nextAnom[Number(firstVoidKey)];
        state.coreTileAnomalies = nextAnom;
        voidTileCount -= 1;
      }
    }
  }

  if (state.boronDampingTimer > 0) {
    state.voidFraction = Math.max(0, state.voidFraction - 0.05 * delta);
  }
  state.voidFraction = clamp(state.voidFraction, 0, 1.0);

  if (state.voidFraction > 0.35 && voidTileCount === 0) {
    const nextAnom = { ...state.coreTileAnomalies };
    for (const tid of DEFAULT_VOID_TILES) {
      nextAnom[tid] = 'void';
    }
    state.coreTileAnomalies = nextAnom;
  } else if (state.voidFraction < 0.22 && voidTileCount > 0) {
    const nextAnom: Record<number, 'void' | 'xenon'> = {};
    for (const [k, v] of Object.entries(state.coreTileAnomalies)) {
      if (v !== 'void') nextAnom[Number(k)] = v;
    }
    state.coreTileAnomalies = nextAnom;
  }

  // Xenon-135 & Iodine-135 Fission Poison Kinetics (~50% smoother evolution over 15-30s)
  const normalizedPower = state.thermalPower / NOMINAL_THERMAL_MW;
  const iodineProduction = normalizedPower * 0.95;
  const iodineDecay = state.iodine * 0.024;
  state.iodine = clamp(state.iodine + (iodineProduction - iodineDecay) * delta, 0, 100);

  const xenonFromIodine =
    state.iodine > 12 && state.thermalPower < 1650
      ? (state.iodine - 10) * (1 - state.thermalPower / 1800) * 0.08
      : iodineDecay;

  const isXenonBurnoutActive = state.thermalPower >= 1800 && state.controlRods >= 0.60;
  if (isXenonBurnoutActive && state.xenon > 5) {
    state.xenon = Math.max(0, state.xenon - 2.2 * delta);
    if (xenonTileCount > 0 && state.xenon < xenonTileCount * 14) {
      const firstXenonKey = Object.keys(state.coreTileAnomalies).find(
        (k) => state.coreTileAnomalies[Number(k)] === 'xenon'
      );
      if (firstXenonKey !== undefined) {
        const nextAnom = { ...state.coreTileAnomalies };
        delete nextAnom[Number(firstXenonKey)];
        state.coreTileAnomalies = nextAnom;
        xenonTileCount -= 1;
      }
    }
  } else {
    const passiveBurnout = state.xenon * normalizedPower * 0.028;
    const xenonNaturalDecay = state.xenon * 0.008;
    state.xenon += (xenonFromIodine - passiveBurnout - xenonNaturalDecay) * delta;
  }

  const xenonTileFloor = xenonTileCount * 14;
  if (!isXenonBurnoutActive && xenonTileFloor > state.xenon) {
    state.xenon += (xenonTileFloor - state.xenon) * 0.65 * delta;
  }
  state.xenon = clamp(state.xenon, 0, 100);

  if (state.xenon > 30 && xenonTileCount === 0) {
    const nextAnom = { ...state.coreTileAnomalies };
    for (const tid of DEFAULT_XENON_TILES) {
      if (!nextAnom[tid]) nextAnom[tid] = 'xenon';
    }
    state.coreTileAnomalies = nextAnom;
  } else if (state.xenon < 20 && xenonTileCount > 0) {
    const nextAnom: Record<number, 'void' | 'xenon'> = {};
    for (const [k, v] of Object.entries(state.coreTileAnomalies)) {
      if (v !== 'xenon') nextAnom[Number(k)] = v;
    }
    state.coreTileAnomalies = nextAnom;
  }

  // Net Reactivity & Fission Thermal Output (`thermalPower` in MWt)
  // Low boronTankLevel reduces negative rod worth (effective rod withdrawal creeps higher!)
  const effectiveRodPosition = clamp(
    state.controlRods + (1 - state.controlRods) * (1 - boronEffectiveness) * 0.34,
    0,
    1
  );
  const graphiteReactivity =
    state.graphiteTemp > 540 ? ((state.graphiteTemp - 540) / 220) * 0.025 : 0;
  const rodReactivity = (effectiveRodPosition - 0.48) * 0.08;
  const voidReactivity = state.voidFraction * VOID_COEFFICIENT;
  const xenonReactivity = -state.xenon * XENON_SCALE;
  const dopplerReactivity = -(state.coreTemp - 280) * DOPPLER_COEFFICIENT;

  state.reactivity =
    rodReactivity +
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

  // Auto Regulator (АР) micro-trimming saturates & trips OFF if demand or steam draw diverges > 120-160 MWt
  const turbineValveAvg = (state.turbines[0].valve + state.turbines[1].valve) * 0.5;
  const approxSteamDrawMWe = state.turbines[0].tripped
    ? 0
    : gridConnected
      ? turbineValveAvg * 1000
      : turbineValveAvg * 250;
  const steamDrawMWt = (approxSteamDrawMWe / 1000) * NOMINAL_THERMAL_MW;
  const totalTargetGridMW = state.substations.reduce((s, x) => s + x.targetMW, 0);
  const targetDemandMWt = (totalTargetGridMW / 1000) * NOMINAL_THERMAL_MW;

  if (state.autoRodEnabled && !state.az5Active && gridConnected) {
    if (
      Math.abs(steamDrawMWt - baseEquilibriumMW) > 130 ||
      Math.abs(targetDemandMWt - baseEquilibriumMW) >= 160
    ) {
      state.autoRodEnabled = false;
    }
  }

  const apMicroTrimMWt =
    state.autoRodEnabled && !state.az5Active && effectiveRodPosition > 0.10 && state.boronTankLevel > 8
      ? clamp(-(voidPowerBonus - xenonPowerPenalty), -45, 45)
      : 0;

  const targetThermalMW =
    effectiveRodPosition <= 0.10 && az5SpikeMW === 0
      ? 0
      : clamp(
          baseEquilibriumMW +
            graphiteModerationMWt +
            voidPowerBonus -
            xenonPowerPenalty -
            boronDampingPenalty +
            apMicroTrimMWt +
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
    const anomaly = state.coreTileAnomalies[i];
    if (anomaly === 'void') {
      state.rodTilesFlux[i] = 98;
    } else if (anomaly === 'xenon') {
      state.rodTilesFlux[i] = 18;
    } else {
      const radialWeight = i < 7 ? 1.15 : i < 19 ? 1.0 : 0.85;
      state.rodTilesFlux[i] = Math.min(100, fluxPercent * radialWeight);
    }
  }

  // ============================================================================
  // STAGE 3B: STEAM DRUM WATER MASS, SINGLE-TRUTH PRESSURE & BUBBLER POOL
  // ============================================================================
  // 1. Steam Boiled from Core Heat + Coolant Circulation + Drum Submergence (in gross MWe steam units:
  //    At 1920 MWt nominal, 4/4 pumps @ 60% throttle -> boils 630 MWe gross steam = 600 MWe net + 30 MWe house load)
  const voidBoilingPenalty =
    state.voidFraction > 0.34 ? clamp(1.0 - (state.voidFraction - 0.34) * 1.15, 0.32, 1.0) : 1.0;
  const pumpTransferCapMWe = (state.coolantFlow / 0.78) * 760;
  const rawThermalSteamMWe =
    state.coreTemp > boilingPoint - 22
      ? (state.thermalPower / 1920) * 630
      : (state.thermalPower / 1920) * 210;
  const steamBoiledMWe =
    Math.min(rawThermalSteamMWe, pumpTransferCapMWe * 1.38) *
    waterSubmergence *
    voidBoilingPenalty;

  // 2. Feedwater Mass Inflow (`feedwaterValve = 0.50` supplies exactly `630 MWe` mass equivalent)
  const feedwaterSupplyMWe = state.feedwaterValve * 1260 * reservoirSuctionFactor;

  // Integrate Drum Water Level (`drumWaterLevel` in mm: `d(Level)/dt = k_lvl * (FeedwaterIn - SteamBoiled)`):
  // During cold/pre-sync startup (`!gridConnected` and `feedwaterValve <= 0.62`), a deaerator overflow weir
  // prevents unboiled 50% startup water from flooding > +55mm while warming up, whereas over-feeding (>68%)
  // or failing to lower Feedwater after dropping load online floods past +100mm into Wet Steam Carryover!
  const netWaterMassMWe = feedwaterSupplyMWe - steamBoiledMWe;
  let dWaterMmPerSec = netWaterMassMWe * 0.058;

  if (!gridConnected && state.drumWaterLevel > 45 && netWaterMassMWe > 0 && state.feedwaterValve <= 0.65) {
    // Startup high-level overflow weir returns cold excess smoothly before grid sync
    dWaterMmPerSec = (52 - state.drumWaterLevel) * 0.55;
  } else if (Math.abs(netWaterMassMWe) < 34 && Math.abs(state.drumWaterLevel) < 68) {
    // Gentle natural level self-centering within nominal ±34 MWe balance band
    dWaterMmPerSec += -state.drumWaterLevel * 0.22;
  }

  state.drumWaterLevel = clamp(state.drumWaterLevel + dWaterMmPerSec * delta, -400, 400);

  // Wet Steam Carryover (`drumWaterLevel > +100mm`): floods moisture separators and slugs turbine blades!
  state.wetSteamSeverity =
    state.drumWaterLevel > 100
      ? clamp((state.drumWaterLevel - 100) / 170, 0, 1)
      : 0;

  // 3. Bubbler Pool Back-Pressure & Steam Relief / Vent / Condenser Dump
  if (state.drumPressure >= 85) state.reliefValveOpen = true;
  if (state.drumPressure <= 75) state.reliefValveOpen = false;

  // If Bubbler Pool hits >= 95%, suppression headers choke and block steam relief!
  const bubblerReliefCapacity =
    state.bubblerLevel >= 95
      ? clamp((99 - state.bubblerLevel) / 4, 0.04, 1.0)
      : 1.0;

  const pressureHeadRatio = Math.max(0.15, state.drumPressure / NOMINAL_PRESSURE_BAR);
  const turbineGrossDrawMWe = state.turbines[0].tripped
    ? 0
    : turbineValveAvg * TURBINE_GROSS_RATED_MWE * pressureHeadRatio;

  // Pre-sync automatic БРУ-К startup pressure regulator bleeds surplus steam above 70 BAR while off-grid
  const preSyncBypassMWe =
    !gridConnected && state.drumPressure > 69.5 && steamBoiledMWe > turbineGrossDrawMWe
      ? (steamBoiledMWe - turbineGrossDrawMWe) * clamp((state.drumPressure - 69.0) * 0.55, 0, 1) * bubblerReliefCapacity
      : 0;

  // Manual UNIT C Steam Vent & Automatic Relief Valve dump steam into the Bubbler Pool
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

  // Single Source of Truth Differential Equation for `drumPressure` (BAR):
  const netSteamBalanceMWe =
    steamBoiledMWe -
    turbineGrossDrawMWe -
    preSyncBypassMWe -
    manualVentMWe -
    safetyReliefMWe -
    condenserDrainSteamMWe;

  // Cold reactor with 0 MWt cools back toward 1 BAR atmospheric
  if (state.thermalPower < 10 && state.drumPressure > 1.0) {
    state.drumPressure = Math.max(1.0, state.drumPressure - 1.3 * delta);
  } else {
    // Smooth 15-30s pressure evolution: pre-sync cold boil-up builds to 65 BAR steadily;
    // online, every ±100 MWe steam mismatch shifts drumPressure by ±1.05 BAR/s!
    const pressurizationGain = !gridConnected && state.drumPressure < 64 ? 0.0155 : 0.0105;
    state.drumPressure += netSteamBalanceMWe * pressurizationGain * delta;

    // If Bubbler Pool is choked (>= 95%) while relief/vent is trying to open, back-pressure rises
    if (state.bubblerLevel >= 95 && (state.ventingSteam || state.reliefValveOpen)) {
      state.drumPressure += 2.2 * delta;
    }
  }
  state.drumPressure = clamp(state.drumPressure, 1.0, 120.0);

  // 4. Bubbler Pool Level (`bubblerLevel` 0-100%) & Regional Water Reservoir Conservation (~60% calmer auxiliary fill)
  const steamIntoBubblerPctPerSec =
    ((manualVentMWe + safetyReliefMWe) / 260) * 2.1 +
    (preSyncBypassMWe / 600) * 0.18 +
    (gridConnected && !state.condenserVacActive ? 1.1 : 0);
  const bubblerDrainOutPctPerSec = state.bubblerDraining && state.bubblerLevel > 4 ? 9.5 : 0.22;

  state.bubblerLevel = clamp(
    state.bubblerLevel + (steamIntoBubblerPctPerSec - bubblerDrainOutPctPerSec) * delta,
    4,
    100
  );

  // Water Reservoir & Regional Basins:
  // Closed-loop condensed turbine steam returns ~98.5% to hotwell; open Steam Vent / Relief wastes water!
  // Pulling BUBBLER DRAIN recycles condensed bubbler water back into the regional basins!
  const wastedVentWaterRate = ((manualVentMWe + safetyReliefMWe) / 260) * 0.9;
  const highPumpDrawRate =
    gridConnected
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
  // STAGE 4: TURBINE TORQUE, 4 AUX SWITCHES, 50HZ GRID & RADIATION (UNIT C <-> UNIT A)
  // ============================================================================
  // Internal Plant House Electrical Load (`houseLoadMW`) controlled by UNIT C Aux Switchgear:
  // Baseline ON switches = AVR (8 MW) + KGB Trunk (10 MW) + Condenser Vacuum (12 MW) = 30 MW;
  // Flipping Ventilation ON adds +15 MW (= 45 MW total house load).
  state.houseLoadMW =
    (state.ventilationActive ? 15 : 0) +
    (state.avrActive ? 8 : 0) +
    (state.kgbLineActive ? 10 : 0) +
    (state.condenserVacActive ? 12 : 0);

  const totalAllocatedMW = state.substations.reduce((s, x) => s + x.allocatedMW, 0);

  // Efficiency multipliers from Wet Steam Carryover, Condenser Vacuum (Switch 4), and AVR Excitation (Switch 2)
  const wetSteamTorqueEff = 1.0 - state.wetSteamSeverity * 0.28;
  const condenserTorqueEff = state.condenserVacActive ? 1.0 : 0.78;
  const avrTorqueEff = state.avrActive ? 1.0 : 0.92;

  state.turbines.forEach((turb) => {
    if (turb.tripped) {
      turb.valve = 0;
      turb.gridConnected = false;
    }

    const pressureFactor =
      state.drumPressure >= 58
        ? state.drumPressure / NOMINAL_PRESSURE_BAR
        : state.drumPressure >= 40
          ? 0.52 + ((state.drumPressure - 40) / 18) * (58 / NOMINAL_PRESSURE_BAR - 0.52)
          : Math.max(0.12, (state.drumPressure - 8) / 32) * 0.52;

    const steamForce =
      turb.tripped
        ? 0
        : turb.valve * pressureFactor * wetSteamTorqueEff * condenserTorqueEff;

    if (!turb.gridConnected) {
      // PHASE A — UNSYNCHRONIZED (MAIN BREAKER OPEN — Cold Start & Post-Blackout Recovery):
      // Free-spinning rotor with zero electrical grid load. Around ~15%-20% throttle (~18% nominal
      // at 65-70 BAR), rotor reaches 3000 RPM / 50.0 Hz (49.5-50.5 Hz green sync window).
      // Opening much higher (>24%) with no grid load accelerates rotor into unloaded overspeed!
      if (!turb.tripped && turb.valve > 0.01 && state.drumPressure >= 25) {
        const steamHeadScale = clamp(state.drumPressure / 66, 0.35, 1.12);
        let freeTargetRpm: number;
        if (turb.valve <= 0.22) {
          const rawSpinRpm = (turb.valve / 0.18) * 3000 * steamHeadScale;
          // Gentle AVR governor capture inside ~15%-21% throttle when steam pressure is healthy
          if (
            state.avrActive &&
            turb.valve >= 0.15 &&
            turb.valve <= 0.21 &&
            state.drumPressure >= 54
          ) {
            freeTargetRpm = 3000 + (turb.valve - 0.18) * 420;
          } else {
            freeTargetRpm = rawSpinRpm;
          }
        } else {
          freeTargetRpm =
            (3025 + (turb.valve - 0.22) * 560) * clamp(steamHeadScale, 0.55, 1.12);
        }
        turb.rpm += (freeTargetRpm - turb.rpm) * 1.85 * delta;
        if (
          state.avrActive &&
          turb.valve >= 0.16 &&
          turb.valve <= 0.20 &&
          Math.abs(3000 - turb.rpm) < 8
        ) {
          turb.rpm = 3000;
        }
      } else {
        const coastTargetRpm = steamForce * 9000;
        turb.rpm += (coastTargetRpm - turb.rpm) * 1.45 * delta;
      }

      turb.rpm = Math.max(0, turb.rpm);
      turb.freqHz = Number((turb.rpm / 60).toFixed(2));
      turb.electricalMW = 0;

      const freqDiffHz = (turb.rpm - 3000) / 60;
      if (Math.abs(freqDiffHz) <= 0.52 && turb.rpm >= 2965) {
        // Inside the 49.5-50.5 Hz green sync window: synchroscope gently aligns to 0° (12 o'clock)
        turb.syncPhase += (0 - turb.syncPhase) * Math.min(1, delta * 4.5);
        if (Math.abs(turb.syncPhase) < 0.5) turb.syncPhase = 0;
      } else {
        const slipHz =
          Math.abs(freqDiffHz) < 0.15
            ? 0.25
            : Math.sign(freqDiffHz) * Math.min(1.6, Math.abs(freqDiffHz));
        let nextPhase = turb.syncPhase + slipHz * 360 * delta;
        nextPhase = ((((nextPhase + 180) % 360) + 360) % 360) - 180;
        turb.syncPhase = nextPhase;
      }

      if (turb.rpm > 3360) {
        turb.tripped = true;
        turb.valve = 0;
      }
    } else {
      // PHASE B — TRUE GRID-LOCKED SYNCHRONOUS OPERATION (MAIN BREAKER CLOSED):
      // Generator rotor is magnetically locked onto the vast 50.0 Hz Soviet regional grid
      // (3000 RPM / 50.0 Hz steady, with only tiny ±0.02-0.05 Hz micro-load tremors on transients).
      // TURBINE THROTTLE now directly controls Electrical Torque / Megawatts pushed to the grid!
      const grossMechanicalMWe = Math.min(
        1200,
        steamForce * TURBINE_GROSS_RATED_MWE * avrTorqueEff
      );
      const netAvailableMWe = Math.max(0, grossMechanicalMWe - state.houseLoadMW);
      turb.electricalMW = Math.min(550, Math.round(netAvailableMWe * 0.5));

      const wetMicroTremorHz =
        state.wetSteamSeverity > 0.05
          ? Math.sin(Date.now() * 0.024) * Math.min(0.05, state.wetSteamSeverity * 0.08)
          : 0;
      const targetLockedHz = 50.0 + wetMicroTremorHz;
      const targetLockedRpm = targetLockedHz * 60;

      turb.rpm = clamp(
        turb.rpm + (targetLockedRpm - turb.rpm) * Math.min(1, delta * 6.5),
        2997,
        3003
      );
      if (Math.abs(3000 - turb.rpm) < 0.4 && state.wetSteamSeverity <= 0.05) {
        turb.rpm = 3000;
      }
      turb.freqHz = Number((turb.rpm / 60).toFixed(2));
      turb.syncPhase = 0;

      // Reverse-Power / Steam Starvation Protection & Severe Crisis Trip:
      // Breaker ONLY trips open during locked play if steam pressure collapses (< 25 BAR —
      // motoring the turbine!) or during an emergency AZ-5 scram / severe core crisis.
      if (
        state.drumPressure < 25 ||
        state.az5Active ||
        state.coreMeltdown ||
        state.steamExplosion
      ) {
        turb.tripped = true;
        turb.gridConnected = false;
        turb.valve = 0;
        turb.electricalMW = 0;
      }
    }
  });

  state.totalElectricalMW = state.turbines[0].electricalMW + state.turbines[1].electricalMW;

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
  // STAGE 5: SUBSTATION QUOTA & TELEMETRY EVALUATION (GRID-LOCKED POWER BALANCE)
  // ============================================================================
  const gridLocked = Boolean(state.turbines[0]?.gridConnected);
  const totalTargetMW = state.substations.reduce((s, x) => s + x.targetMW, 0);
  const generatedGrossMWe = gridLocked ? state.totalElectricalMW + state.houseLoadMW : 0;
  const allocatedGrossMWe = totalAllocatedMW + state.houseLoadMW;
  const neededGrossMWe = totalTargetMW + state.houseLoadMW;
  const surplusGrossMWe = generatedGrossMWe - neededGrossMWe;
  const hasEnoughPower = gridLocked && generatedGrossMWe >= allocatedGrossMWe - 20;

  state.substations[0].allocatedH2O = Math.round(state.pripyatWater);
  state.substations[2].allocatedH2O = Math.round(state.kolkhozWater);
  state.substations[4].allocatedH2O = Math.round(state.vodkaWater);

  state.substations.forEach((sub) => {
    const leverMatchesTarget = Math.abs(sub.allocatedMW - sub.targetMW) <= 10;
    const mwMet = hasEnoughPower && leverMatchesTarget;

    if (!hasEnoughPower && sub.allocatedMW > 0) {
      sub.statusText = `GEN LOW (${Math.round(state.totalElectricalMW)}/${totalAllocatedMW}MW)`;
    } else if (gridLocked && surplusGrossMWe > 60 && sub.allocatedMW > 0) {
      sub.statusText = `SURPLUS (+${Math.round(surplusGrossMWe)}MW)`;
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
 * Main Breaker Synchronization on UNIT C
 */
export function toggleGridBreaker(state: ReactorState, turbineIndex: 0 | 1 = 0): {
  success: boolean;
  reason?: string;
} {
  const turb = state.turbines[turbineIndex];

  if (turb.gridConnected) {
    state.turbines.forEach((t) => {
      t.gridConnected = false;
      t.electricalMW = 0;
    });
    return { success: true };
  }

  if (turb.tripped) {
    return { success: false, reason: 'TURBINE TRIPPED // FLIP COND/RESET SWITCH 4 ON UNIT C' };
  }

  if (state.drumPressure < 30) {
    return { success: false, reason: 'LOW STEAM PRESSURE (<30 BAR) // BOIL STEAM FIRST' };
  }

  const phaseError = Math.abs(turb.syncPhase);
  const maxPhaseWindow = state.avrActive ? 55 : 32;

  if (turb.rpm >= 2965 && turb.rpm <= 3040 && phaseError <= maxPhaseWindow) {
    state.turbines.forEach((t) => {
      t.tripped = false;
      t.gridConnected = true;
      t.rpm = 3000;
      t.freqHz = 50.0;
      t.syncPhase = 0;
    });
    return { success: true };
  } else {
    turb.tripped = true;
    turb.gridConnected = false;
    turb.valve = 0;
    return {
      success: false,
      reason: `OUT OF SYNC! (${(turb.rpm / 60).toFixed(1)} HZ / ${Math.round(turb.rpm)} RPM — SPIN TO 50.0 HZ FIRST!)`
    };
  }
}

/**
 * Volkov Training Drill & Live Multi-Panel Causal Order Guide (Steps 0–8 + Live Shift)
 */
export function evaluateTutorial(state: ReactorState, currentPhase: TutorialPhase): TutorialPrompt {
  switch (currentPhase) {
    case 'STEP_0_PICKUP_WEPAD': {
      if (state.wePadHeld) {
        return evaluateTutorial(state, 'STEP_1_COOLING');
      }
      return {
        phase: 'STEP_0_PICKUP_WEPAD',
        header: '>> STEP 0/8 [DESK — WE-PAD 84]:',
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
        header: '>> STEP 1/8 [KEY 3 -> UNIT B // COOLING & GAS]:',
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
      if (state.autoRodEnabled && state.controlRods >= 0.50 && state.thermalPower >= 200) {
        return evaluateTutorial(state, 'STEP_3_BUILD_STEAM');
      }
      return {
        phase: 'STEP_2_PULL_RODS',
        header: '>> STEP 2/8 [KEY 3 -> UNIT A-2 // BORON RODS]:',
        body: 'ACTION: FLIP ON "AUTO REGULATOR (AP)" AND SCROLL "CONTROL ROD DRIVE" WHEEL UP TO 55% WITHDRAWN.',
        hint: 'WHY: Boron control rods act as neutron sponges. Pulling them UP raises REACTIVITY and heats core water (~1920 MWt).',
        panelKey: 'GO TO: [KEY 3] UNIT A-2 (MID-LEFT)',
        actionLine: 'FLIP [AUTO RODS] ON & RAISE RODS 55%',
        whyLines: [
          'Boron rods act as neutron sponges inside the core.',
          'Pulling them UP raises REACTIVITY & THERMAL MWt gauge.'
        ],
        volkovQuote:
          '"Treat boron rods with Socialist respect, Comrade. Pull smoothly—Uranium-235 does not take five-minute tea breaks."'
      };
    }

    case 'STEP_3_BUILD_STEAM': {
      if (state.drumPressure >= 60) {
        return evaluateTutorial(state, 'STEP_4_SPIN_TURBINE');
      }
      return {
        phase: 'STEP_3_BUILD_STEAM',
        header: '>> STEP 3/8 [KEY 5 -> UNIT C MASTER OVERVIEW]:',
        body: 'ACTION: PRESS [KEY 5] TO VIEW UNIT C MASTER CONSOLE AND WATCH "STEAM PRESSURE" CLIMB INTO THE 60-72 BAR GREEN BAND.',
        hint: 'WHY: Fission heat boils circulating core water into high-pressure steam (60-72 BAR) right above your Turbine Throttle.',
        panelKey: 'GO TO: [KEY 5] UNIT C (RIGHT WALL)',
        actionLine: 'WATCH [STEAM PRESSURE] HIT 60+ BAR',
        whyLines: [
          'Fission heat boils flooded core tubes into live steam.',
          'Left gauge & CRT-84C show STEAM entering 60-72 BAR green.'
        ],
        volkovQuote:
          '"Admire the new UNIT C Master Console! Even a sleep-deprived bureaucrat can read GENERATED vs. NEEDED MWe here."'
      };
    }

    case 'STEP_4_SPIN_TURBINE': {
      const t1 = state.turbines[0];
      if (t1.valve >= 0.14 && t1.rpm >= 2965 && t1.rpm <= 3040) {
        return evaluateTutorial(state, 'STEP_5_SYNC_GRID');
      }
      return {
        phase: 'STEP_4_SPIN_TURBINE',
        header: '>> STEP 4/8 [KEY 5 -> UNIT C // SPIN TO 50.0 HZ]:',
        body: 'ACTION: WHILE MAIN BREAKER IS OPEN, TURN "TURBINE THROTTLE" TO ~18% UNTIL "GRID SYNC 50HZ" HITS 50.0 HZ (12 O\'CLOCK).',
        hint: 'WHY: You ONLY tune 50.0 Hz while off-grid so the free-spinning rotor matches the Soviet grid\'s rhythm before closing the breaker!',
        panelKey: 'GO TO: [KEY 5] UNIT C (CENTER WHEEL)',
        actionLine: 'TURN [TURBINE THROTTLE] TO ~18% (50.0 HZ)',
        whyLines: [
          'Only tune 50.0 HZ while [MAIN BREAKER] is OPEN (unloaded).',
          '~18% steam spins our rotor to 3000 RPM to match the grid!'
        ],
        volkovQuote:
          '"Tune 50.0 Hz ONLY while the breaker is open! Close it out of sync and our 200-ton rotor exits through the roof—which requires three forms in triplicate."'
      };
    }

    case 'STEP_5_SYNC_GRID': {
      if (state.turbines[0].gridConnected === true) {
        return evaluateTutorial(state, 'STEP_6_BASELINE_600MW');
      }
      return {
        phase: 'STEP_5_SYNC_GRID',
        header: '>> STEP 5/8 [KEY 5 -> UNIT C // 50HZ GRID LOCK]:',
        body: 'ACTION: CONFIRM CRT-84C SHOWS "SYNC READY" IN THE 50.0 HZ GREEN WINDOW, THEN PULL "MAIN BREAKER" ([SPACE] OR DRAG).',
        hint: 'WHY: Closing inside 49.5-50.5 Hz magnetically locks our rotor onto the massive 50.0 Hz Soviet grid—holding speed steady!',
        panelKey: 'GO TO: [KEY 5] UNIT C (RIGHT SWITCH)',
        actionLine: 'CLOSE [MAIN BREAKER] AT 50.0 HZ [SPACE]',
        whyLines: [
          'Magnetically locks our rotor onto the 50.0 HZ Soviet grid.',
          'Once LOCKED, the grid holds 50.0 HZ steady—Throttle = MWe!'
        ],
        volkovQuote:
          '"Close it out of sync and our 200-ton rotor exits through the roof—which requires three forms in triplicate."'
      };
    }

    case 'STEP_6_BASELINE_600MW': {
      const allLeversMatch = state.substations.every(
        (s) => Math.abs(s.allocatedMW - s.targetMW) <= 15
      );
      if (state.totalElectricalMW >= 550 && allLeversMatch) {
        state.voidFraction = 0.50;
        state.coreTileAnomalies = { 6: 'void', 18: 'void', 24: 'void' };
        return evaluateTutorial(state, 'STEP_7_VOID_DRILL');
      }
      return {
        phase: 'STEP_6_BASELINE_600MW',
        header: '>> STEP 6/8 [UNIT C & KEY 1 UNIT A // MWe GAS PEDAL]:',
        body: 'ACTION: NOW THAT 50.0 HZ IS LOCKED, OPEN "TURBINE THROTTLE" (UNIT C) TO ~60% TO MATCH NEEDED MWe, AND SET ALL 6 LEVERS (UNIT A) TO 100 MW.',
        hint: 'WHY: Once LOCKED at 50.0 Hz, the grid holds your speed steady—TURBINE THROTTLE now acts purely as your Megawatt gas pedal!',
        panelKey: 'GO TO: [KEY 5] UNIT C -> [KEY 1] UNIT A',
        actionLine: 'THROTTLE ~60% (MWe GAS PEDAL) & 6 LEVERS 100MW',
        whyLines: [
          'Grid holds 50.0 HZ steady—Throttle is now your MWe gas pedal!',
          'Line up GENERATED needle with RED NEEDED MWe & set 6 Levers.'
        ],
        volkovQuote:
          '"Once locked at 50.0 Hz, stop worrying about speed—the grid holds your rotor! Now the throttle wheel is pure Megawatt gas pedal!"'
      };
    }

    case 'STEP_7_VOID_DRILL': {
      if (state.voidFraction < 0.25) {
        state.voidFraction = 0.08;
        state.xenon = 50;
        state.coreTileAnomalies = { 10: 'xenon', 18: 'xenon', 28: 'xenon' };
        return evaluateTutorial(state, 'STEP_8_XENON_DRILL');
      }
      return {
        phase: 'STEP_7_VOID_DRILL',
        header: '>> STEP 7/8 [KEY 3 UNIT A-2 // STEAM VOID DRILL]:',
        body: 'ACTION: STEAM VOID SPIKE (50%)! CLICK GLOWING RED TILES ON THE "37-ROD CORE MAP" (UNIT A-2) OR PRESS "BORON INJECTION" (UNIT A) BELOW 25%!',
        hint: 'WHY: Dry/overheated fuel tubes form steam bubbles (STEAM VOID) that accelerate RBMK fission! Flood tubes & quench red channels.',
        panelKey: 'GO TO: [KEY 3] UNIT A-2 (CORE MAP)',
        actionLine: 'CLICK RED CORE TILES UNTIL VOID < 25%',
        whyLines: [
          'Boiling bubbles (STEAM VOID) speed up RBMK neutrons!',
          'Trimming red channels & extra Feedwater collapses voids.'
        ],
        volkovQuote:
          '"Western physicists call positive void reactivity a flaw. We call it enthusiastic self-heating uranium!"'
      };
    }

    case 'STEP_8_XENON_DRILL': {
      if (state.xenon < 25) {
        state.xenon = 4;
        state.coreTileAnomalies = {};
        return evaluateTutorial(state, 'COMPLETED');
      }
      return {
        phase: 'STEP_8_XENON_DRILL',
        header: '>> STEP 8/8 [KEY 3 UNIT A-2 // XENON-135 "NUCLEAR ASH"]:',
        body: 'ACTION: XENON-135 POISONING (50%)! CLICK CYAN TILES ON "37-ROD CORE MAP" (UNIT A-2) OR PULL "CONTROL RODS" UP TO BURN XENON BELOW 25%!',
        hint: 'WHY: Xenon-135 is fission exhaust ("nuclear ash") that absorbs neutrons after power drops, requiring extra rod withdrawal until it burns off.',
        panelKey: 'GO TO: [KEY 3] UNIT A-2 (CYAN TILES)',
        actionLine: 'CLICK CYAN TILES OR RAISE RODS (<25%)',
        whyLines: [
          'Xenon-135 ("nuclear ash") chokes neutrons after power drops.',
          'Pull Boron Rods UP or trim cyan tiles until Xenon burns off!'
        ],
        volkovQuote:
          '"Xenon-135 is lazy nuclear ash clogging the furnace. Pull the rods a notch higher until the flux incinerates it!"'
      };
    }

    case 'COMPLETED': {
      const totalTargetMW = state.substations.reduce((s, x) => s + x.targetMW, 0);
      const totalAllocatedMW = state.substations.reduce((s, x) => s + x.allocatedMW, 0);
      const unmetSub = state.substations.find((x) => Math.abs(x.allocatedMW - x.targetMW) >= 5);
      const targetGrossMW = totalTargetMW + state.houseLoadMW;
      const generatedGrossMW = state.turbines[0]?.gridConnected
        ? state.totalElectricalMW + state.houseLoadMW
        : 0;
      const deltaGrossMW = Math.round(generatedGrossMW - targetGrossMW);
      const targetMWt = Math.round((targetGrossMW / 630) * 1920);
      const reqFeedwaterPct = Math.min(100, Math.round((targetGrossMW / 630) * 50));
      const reqValvePct = Math.min(100, Math.round((targetGrossMW / TURBINE_GROSS_RATED_MWE) * 100));
      const curRodPct = Math.round(state.controlRods * 100);
      const curFwPct = Math.round(state.feedwaterValve * 100);
      const curValvePct = Math.round((state.turbines[0]?.valve ?? 0) * 100);

      if (!state.turbines[0]?.gridConnected) {
        return {
          phase: 'COMPLETED',
          header: '>> MAIN BREAKER OPEN // RE-SYNCHRONIZE TO 50.0 HZ:',
          body: 'ACTION: ENSURE STEAM >= 55 BAR, SPIN [TURBINE THROTTLE] TO ~18% (50.0 HZ), AND CLOSE [MAIN BREAKER] ON UNIT C!',
          hint: 'WHY: Tune 50.0 Hz ONLY while breaker is OPEN; once closed, the grid locks your speed at 50.0 Hz!',
          panelKey: 'GO TO: [KEY 5] UNIT C (SPIN & LOCK)',
          actionLine: 'SPIN TO 50.0 HZ (~18%) -> PULL [MAIN BREAKER]',
          whyLines: [
            'If tripped, flip Switch 4 [CONDENSER VACUUM] to reset.',
            'Spin to 50.0 HZ (~18% throttle), then close [MAIN BREAKER]!'
          ],
          volkovQuote:
            '"You dropped off the Soviet grid! Match 50.0 Hz while open, then slam the Main Breaker shut!"'
        };
      }

      const isPlusOrder =
        totalTargetMW > totalAllocatedMW + 5 ||
        (unmetSub !== undefined && unmetSub.targetMW > unmetSub.allocatedMW) ||
        deltaGrossMW < -20 ||
        state.thermalPower < targetMWt - 110 ||
        state.drumPressure < 58;
      const isMinusOrder =
        totalTargetMW < totalAllocatedMW - 5 ||
        (unmetSub !== undefined && unmetSub.targetMW < unmetSub.allocatedMW) ||
        deltaGrossMW > 20 ||
        state.thermalPower > targetMWt + 130 ||
        state.drumPressure > 76;

      if (isPlusOrder) {
        const s1Ok = state.thermalPower >= targetMWt - 110;
        const s2Ok = state.feedwaterValve * 100 >= reqFeedwaterPct - 5 && state.drumPressure >= 58;
        const s3Ok = !unmetSub && Math.abs(totalAllocatedMW - totalTargetMW) < 6;
        const s4Ok = Math.abs(deltaGrossMW) <= 20;
        const nextPanel = !s1Ok
          ? 'GO TO: [KEY 3] UNIT A-2 (BORON RODS)'
          : !s2Ok
            ? 'GO TO: [KEY 3] UNIT B (FEEDWATER)'
            : !s3Ok
              ? 'GO TO: [KEY 1] UNIT A (SECTOR LEVER)'
              : 'GO TO: [KEY 5] UNIT C (THROTTLE PEDAL)';
        const nextAction = !s1Ok
          ? `1. RODS UP (${curRodPct}%) -> ~${targetMWt} MWt`
          : !s2Ok
            ? `1B. FEEDWATER UP ${curFwPct}% -> ${reqFeedwaterPct}%`
            : !s3Ok
              ? `2. PULL ${unmetSub ? unmetSub.name : 'SECTOR'} LEVER -> ${unmetSub ? unmetSub.targetMW : totalTargetMW} MW`
              : s4Ok
                ? 'POWER BALANCED AT 50.0 HZ LOCKED'
                : `3. OPEN THROTTLE (${curValvePct}% -> ~${reqValvePct}%) TO ${targetGrossMW} MWe`;
        return {
          phase: 'COMPLETED',
          header: `>> ACTIVE +MW ORDER (${totalAllocatedMW} -> ${totalTargetMW} MW // NEED ${targetGrossMW} MWe):`,
          body: `${s1Ok && s2Ok ? '[OK]' : '[1]'} RODS UP [A-2] (${curRodPct}%) + FEEDWATER UP [B] (${curFwPct}%->${reqFeedwaterPct}%) | ${s3Ok ? '[OK]' : '[2]'} PULL SECTOR LEVER [A]`,
          hint: `${s4Ok ? '[OK]' : '[3]'} OPEN TURBINE THROTTLE [C] (${curValvePct}% -> ~${reqValvePct}%) until GENERATED (${Math.round(generatedGrossMW)}) lines up with NEEDED (${targetGrossMW} MWe)!`,
          panelKey: nextPanel,
          actionLine: nextAction,
          whyLines: [
            '1. Rods [A-2] + Feedwater [B] boil extra steam so BAR holds.',
            '2. Pull Lever [A] -> 3. Open Throttle [C] to match NEEDED MWe!'
          ],
          volkovQuote:
            '"Grid holds 50.0 Hz steady! Boil extra steam first, pull the sector lever, then press your Turbine Throttle MWe gas pedal!"'
        };
      }

      if (isMinusOrder) {
        const s1LeversOk = !unmetSub && Math.abs(totalAllocatedMW - totalTargetMW) < 6;
        const s1ThrottleOk = Math.abs(deltaGrossMW) <= 20;
        const s2RodsOk = state.thermalPower <= targetMWt + 120 && state.drumPressure <= 75;
        const nextPanel = !s1LeversOk
          ? 'GO TO: [KEY 1] UNIT A (SECTOR LEVER)'
          : !s1ThrottleOk
            ? 'GO TO: [KEY 5] UNIT C (THROTTLE & VENT)'
            : 'GO TO: [KEY 3] UNIT A-2 (PUSH RODS IN)';
        const nextAction = !s1LeversOk
          ? `1. LOWER ${unmetSub ? unmetSub.name : 'SECTOR'} LEVER -> ${unmetSub ? unmetSub.targetMW : totalTargetMW} MW`
          : !s1ThrottleOk
            ? `1B. LOWER THROTTLE (${curValvePct}% -> ~${reqValvePct}%) TO ${targetGrossMW} MWe`
            : !s2RodsOk
              ? `2. PUSH RODS IN (${curRodPct}%) & VENT IF >75 BAR`
              : 'WATCH XENON-135 ON UNIT C CRT-84C';
        return {
          phase: 'COMPLETED',
          header: `>> ACTIVE -MW ORDER (${totalAllocatedMW} -> ${totalTargetMW} MW // NEED ${targetGrossMW} MWe):`,
          body: `${s1LeversOk && s1ThrottleOk ? '[OK]' : '[1]'} LOWER SECTOR LEVER [A] & TURBINE THROTTLE [C] (${curValvePct}% -> ~${reqValvePct}%) TO MATCH ${targetGrossMW} MWe`,
          hint: `${s2RodsOk ? '[OK]' : '[2]'} PUSH RODS IN [A-2] (${curRodPct}% -> ~${targetMWt} MWt) so STEAM BAR doesn't spike (use STEAM VENT if BAR > 75)!`,
          panelKey: nextPanel,
          actionLine: nextAction,
          whyLines: [
            '1. Lower Sector Lever [A] & Throttle [C] to stop MWe surplus.',
            '2. Push Rods IN [A-2] to stop excess boiling (VENT if >75 BAR)!'
          ],
          volkovQuote:
            '"Ease off the Throttle MWe pedal to stop over-pumping transformers, then push Boron Rods in before steam pressure pops the drum!"'
        };
      }

      return {
        phase: 'COMPLETED',
        header: '>> GRID LOCKED AT 50.0 HZ // POWER BALANCED:',
        body: 'GENERATED MWe MATCHES NEEDED MWe AT 50.0 HZ! CHECK [KEY 4] DESK FOR PRAVDA ORDERS & MONITOR [KEY 5] UNIT C.',
        hint: '+MW: 1. Rods [A-2] + Water [B] -> 2. Lever [A] -> 3. Open Throttle [C].  -MW: 1. Lower Lever [A] & Throttle [C] -> 2. Push Rods IN [A-2].',
        panelKey: 'CHECK: [KEY 4] DESK & [KEY 5] UNIT C',
        actionLine: 'AWAIT NEXT PRAVDA-84 POWER ORDER',
        whyLines: [
          'Grid holds 50.0 HZ steady; POWER BALANCE needles match.',
          'Tear incoming Pravda slips on [KEY 4] Desk to update quotas.'
        ],
        volkovQuote:
          '"50.0 Hz locked, Megawatts matched, steam at 68 BAR. Naturally, Moscow will ruin this peace with a teletype order any second."'
      };
    }
  }
}
