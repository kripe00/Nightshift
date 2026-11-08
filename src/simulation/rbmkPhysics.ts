export interface SubstationQuota {
  id: number;
  name: string;
  allocatedMW: number;   // Styrbar via de 6 MW-spakene på UNIT A (0 til maxMW)
  targetMW: number;      // Kvote-krav for MW
  maxMW: number;
  requiresH2O: boolean;  // Legacy field (false — kun elektrisk MWe)
  allocatedH2O: number;
  targetH2O: number;
  statusText: string;    // F.eks. 'MASH OK', 'SWEEP OK', 'LINE: ON/OFF', 'FURNACE HOT'
  quotaOk: boolean;      // True når MW møter kvoten
}

export interface TurbineState {
  valve: number;          // 0.0 til 1.0 (Dampventil)
  rpm: number;            // 0 til 3500 RPM (Nominal: 3000 RPM = 50.0 Hz)
  freqHz: number;         // 0.0 til 58.3 Hz (Nominal: 50.0 Hz)
  syncPhase: number;      // -180 til +180 grader (0° = klokken 12 på synkronoskopet)
  gridConnected: boolean; // Om hovedbryteren (Main Breaker) er koblet inn
  electricalMW: number;   // 0 til 500 MWe per turbin
  tripped: boolean;       // Løser ut ved feilsynkronisering eller overhastighet (>3350 RPM)
}

export interface ReactorState {
  // --- Spillerens direkte kontroller ---
  rodTargetRate: number;      // -1 (senk), 0 (hold), +1 (trekk ut)
  az5Active: boolean;         // AZ-5 Nødstopp trykket
  autoRodEnabled: boolean;    // Automatisk regulator (АР)
  mcpActive: boolean[];       // 4 hovedsirkulasjonspumper ГЦН 1-4 [false, false, false, false]
  feedwaterValve: number;     // 0.0 til 1.0 (Fødevannsventil)
  steamDumpValve: boolean;    // БРУ-К (Slipper damp rett i kondensator/bubbler)
  kgbLineActive: boolean;     // Styrer KGB LINE-bryteren på UNIT C (aktiverer #4 KGB Bunker)
  plantWaterDrainPct: number; // Legacy felt (0)
  wePadHeld: boolean;         // Om spilleren har plukket opp WE-PAD 84 med [E]
  wePadInspecting: boolean;   // Om spilleren ser nærmere på WE-PAD 84 med [TAB]

  // --- Kjerne og Reaktivitet (SIUR / UNIT A-2) ---
  controlRods: number;        // 0.0 (100% nede/stopp) til 1.0 (100% trukket ut)
  az5Timer: number;           // Sekunder siden AZ-5 ble trykket
  boronDampingTimer: number;  // Sekunder med aktiv BORON INJECTION demping (-500 MWt over 5s)
  reactivity: number;         // Netto reaktivitet (rho)
  thermalPower: number;       // Termisk effekt i MWt (Nominal: 3200 MWt)
  coreTemp: number;           // Kjernetemperatur i °C (Kald: 25°C, Drift: ~284°C ved 70 bar)
  voidFraction: number;       // 0.0 til 1.0 (Andel dampbobler i kjernen)
  iodine: number;             // Jod-135 (0 til 100)
  xenon: number;              // Xenon-135 forgiftning (0 til 100)
  rodTilesFlux: number[];     // 37 verdier (0-100%) til det runde 37-ROD CORE MAP på Unit A-2
  coreTileAnomalies: Record<number, 'void' | 'xenon'>; // Røde ('void') eller Cyan ('xenon') fliser på 37-ROD CORE MAP

  // --- Termohydraulikk og Dampseparator (БЩУ-Т / UNIT B & UNIT A) ---
  coolantFlow: number;        // 0.0 til 1.0 (Vannstrøm fra de 4 ГЦН-pumpene)
  drumWaterLevel: number;     // -400 til +400 mm (0 mm er midten av måleren)
  drumPressure: number;       // Trykk i Bar (Kald: 1 bar, Drift: 70 bar, Sikkerhetsventil: 85 bar)
  reliefValveOpen: boolean;   // Automatisk overtrykksventil (åpner ved 85 bar)
  roomRadiation: number;      // Stråling i R/H (Normal: 0.1 - 0.4 R/H)

  // --- Turbiner og 1000 MWe Strømnett (БЩУ-Э / UNIT C & UNIT A) ---
  turbines: [TurbineState, TurbineState]; // TG-1 (500 MWe) og TG-2 (500 MWe)
  totalElectricalMW: number;  // 0 til 1000 MWe (Summen av TG-1 og TG-2)
  substations: SubstationQuota[]; // De 6 spakene nederst på UNIT A

  // --- Havari-tilstander ---
  coreMeltdown: boolean;
  steamExplosion: boolean;
}

export type TutorialPhase =
  | 'STEP_0_PICKUP_WEPAD' // 0/8 DESK: Plukk opp WE-PAD 84 fra pulten med [E]
  | 'STEP_1_COOLING'      // 1/8 UNIT B: Start 4 pumper (ГЦН 1–4) + scroll Fødevannsventil (ПЭН) til 50%
  | 'STEP_2_PULL_RODS'    // 2/8 UNIT A-2: Slå på Автомат (АР) og scroll kontrollstaver til 55%
  | 'STEP_3_BUILD_STEAM'  // 3/8 UNIT A-2 & B: Varm opp kjernen til 284°C og bygg 60–70 BAR damptrykk
  | 'STEP_4_SPIN_TURBINE' // 4/8 UNIT C: Scroll dampventil til 20% så turbinen når 3000 RPM (50.0 HZ)
  | 'STEP_5_SYNC_GRID'    // 5/8 UNIT C: Lukk Main Breaker [SPACE] når synkronoskop-nåla passerer kl. 12 (0°)
  | 'STEP_6_BASELINE_600MW' // 6/8 UNIT C & A: Scroll dampventil til 60% (600 MWe) og alle 6 MW-spaker til 100 MW
  | 'STEP_7_VOID_DRILL'   // 7/8 UNIT A-2 / A / B: Bekjemp 50% Positiv Void (klikk røde fliser, Boron Injection eller Fødevann)
  | 'STEP_8_XENON_DRILL'  // 8/8 UNIT A-2: Bekjemp 50% Xenon-135 (klikk cyan fliser eller scroll opp kontrollstaver)
  | 'COMPLETED';

export interface TutorialPrompt {
  phase: TutorialPhase;
  header: string;
  body: string;
  hint: string;
}

// Fysikkonstanter for RBMK-1000
const NOMINAL_THERMAL_MW = 3200;
const NOMINAL_PRESSURE_BAR = 70;
const ROD_SPEED = 0.015;
const AZ5_SPEED = 0.055;             // ~18 sekunder fra 100% til 0%
const VOID_COEFFICIENT = 0.028;      // Positiv void-koeffisient
const DOPPLER_COEFFICIENT = 0.00004; // Negativ drivstoff-temperaturkoeffisient
const XENON_SCALE = 0.0012;

const DEFAULT_VOID_TILES = [6, 18, 24] as const;
const DEFAULT_XENON_TILES = [10, 18, 28] as const;

/**
 * Starter reaktoren helt kald (0 MWt, 25°C, 1 bar, 0 mm vannstand, 0 MWe)
 */
export function createColdStartState(): ReactorState {
  return {
    rodTargetRate: 0,
    az5Active: false,
    autoRodEnabled: false,
    mcpActive: [false, false, false, false],
    feedwaterValve: 0.0,
    steamDumpValve: false,
    kgbLineActive: true,
    plantWaterDrainPct: 0,
    wePadHeld: false,
    wePadInspecting: false,

    controlRods: 0.0,
    az5Timer: 0,
    boronDampingTimer: 0,
    reactivity: -0.038,
    thermalPower: 0,
    coreTemp: 25,
    voidFraction: 0,
    iodine: 0,
    xenon: 0,
    rodTilesFlux: new Array(37).fill(0),
    coreTileAnomalies: {},

    coolantFlow: 0.12,
    drumWaterLevel: 0,
    drumPressure: 1.0,
    reliefValveOpen: false,
    roomRadiation: 0.1,

    turbines: [
      { valve: 0, rpm: 0, freqHz: 0, syncPhase: 0, gridConnected: false, electricalMW: 0, tripped: false },
      { valve: 0, rpm: 0, freqHz: 0, syncPhase: 90, gridConnected: false, electricalMW: 0, tripped: false },
    ],
    totalElectricalMW: 0,
    substations: [
      { id: 1, name: 'PRIPYAT CITY', allocatedMW: 0, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 0, targetH2O: 0, statusText: 'HEATING COLD', quotaOk: false },
      { id: 2, name: 'DUGA-1 RADAR', allocatedMW: 0, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 0, targetH2O: 0, statusText: 'SWEEP OFF',    quotaOk: false },
      { id: 3, name: 'KOLKHOZ FARM', allocatedMW: 0, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 0, targetH2O: 0, statusText: 'POWER LOW',    quotaOk: false },
      { id: 4, name: 'KGB BUNKER',   allocatedMW: 0, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 0, targetH2O: 0, statusText: 'LINE: ON',     quotaOk: false },
      { id: 5, name: 'VODKA PLANT',  allocatedMW: 0, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 0, targetH2O: 0, statusText: 'MASH COLD',    quotaOk: false },
      { id: 6, name: 'STEEL WORKS',  allocatedMW: 0, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 0, targetH2O: 0, statusText: 'FURNACE COLD', quotaOk: false },
    ],

    coreMeltdown: false,
    steamExplosion: false,
  };
}

/**
 * Mottiltak #3 mot Positiv Void: BORON INJECTION-knappen på UNIT A (under AZ-5).
 * Kutter voidFraction umiddelbart med -35%, fjerner røde void-hotspots,
 * og legger inn 5 sekunder med -500 MWt nøytrondemping.
 */
export function triggerBoronInjection(state: ReactorState): void {
  state.voidFraction = Math.max(0, state.voidFraction - 0.35);
  state.boronDampingTimer = 5.0;
  const nextAnomalies: Record<number, 'void' | 'xenon'> = {};
  for (const [k, v] of Object.entries(state.coreTileAnomalies)) {
    if (v !== 'void') {
      nextAnomalies[Number(k)] = v;
    }
  }
  state.coreTileAnomalies = nextAnomalies;
}

/**
 * Interaktiv Kanal-rensing på RBMK CORE (37 ROD TILES) på UNIT A-2:
 * Å klikke på en lysende Rød ('void') eller Cyan ('xenon') flis (eller nabokanal når fare pågår)
 * lokal-trimmer den kanalen og senker voidFraction eller xenon umiddelbart med -12%!
 */
export function trimCoreChannelTile(
  state: ReactorState,
  tileIndex: number
): { trimmed: 'void' | 'xenon' | 'none'; remainingPct: number } {
  const directType = state.coreTileAnomalies[tileIndex];

  // Finn ut om vi trimmer 'void' eller 'xenon'
  let targetType: 'void' | 'xenon' | null = directType ?? null;
  if (!targetType) {
    if (state.voidFraction >= 0.20 && state.voidFraction * 100 >= state.xenon) {
      targetType = 'void';
    } else if (state.xenon >= 20) {
      targetType = 'xenon';
    }
  }

  if (targetType === 'void') {
    state.voidFraction = Math.max(0, state.voidFraction - 0.12);
    const nextAnomalies = { ...state.coreTileAnomalies };
    if (nextAnomalies[tileIndex] === 'void') {
      delete nextAnomalies[tileIndex];
    } else {
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
 * Kalles hver frame i useFrame(( _, delta ) => ...)
 */
export function stepReactorSimulation(state: ReactorState, dt: number): void {
  const delta = Math.min(dt, 0.1);

  if (state.boronDampingTimer > 0) {
    state.boronDampingTimer = Math.max(0, state.boronDampingTimer - delta);
  }

  // ============================================================================
  // 1. KONTROLLSTAVER & AZ-5 (inkl. Grafitt-tupp-effekten)
  // ============================================================================
  let az5TipReactivityBonus = 0;

  if (state.az5Active) {
    state.autoRodEnabled = false;
    state.az5Timer += delta;
    state.controlRods = Math.max(0, state.controlRods - AZ5_SPEED * delta);

    // De første 3.5 sekundene av AZ-5 fortrenger grafitt-tuppene vann i bunnen av kjernen
    if (state.az5Timer < 3.5 && state.controlRods > 0.3) {
      az5TipReactivityBonus = 0.018 * (0.5 + state.voidFraction);
    }
  } else {
    state.az5Timer = 0;
    state.controlRods = Math.max(
      0,
      Math.min(1, state.controlRods + state.rodTargetRate * ROD_SPEED * delta)
    );
  }

  // ============================================================================
  // 2. KJØLEVANNSSTRØM (Hovedsirkulasjonspumper ГЦН 1-4)
  // ============================================================================
  const activePumps = state.mcpActive.filter(Boolean).length;
  const targetFlow = 0.12 + activePumps * 0.22;
  state.coolantFlow += (targetFlow - state.coolantFlow) * 0.5 * delta;

  // Kavitasjon i pumpene hvis vannstanden i dampseparatorene synker under -350 mm
  if (state.drumWaterLevel < -350) {
    state.coolantFlow *= 0.2;
  }

  // ============================================================================
  // 3. KJERNETEMPERATUR (284°C ved 70 bar) & INTERAKTIV POSITIV VOID (`VOID %`)
  // ============================================================================
  const boilingPoint = 100 + Math.pow(Math.max(0, state.drumPressure - 1), 0.38) * 37;

  const heatInput = state.thermalPower * 0.16;
  const ambientCooling = (state.coreTemp - 25) * 0.02;
  const activeCooling = Math.max(0, state.coreTemp - 200) * state.coolantFlow * 3.8;
  const heatRemoval = ambientCooling + activeCooling;

  state.coreTemp += (heatInput - heatRemoval) * 0.15 * delta;
  state.coreTemp = Math.max(20, state.coreTemp);

  // Tell aktive 'void'- og 'xenon'-lommer på 37-ROD CORE MAP
  let voidTileCount = 0;
  let xenonTileCount = 0;
  for (const val of Object.values(state.coreTileAnomalies)) {
    if (val === 'void') voidTileCount += 1;
    else if (val === 'xenon') xenonTileCount += 1;
  }

  // Beregn dampforbruk og kaldt fødevann-overskudd (Mottiltak #1 mot Void)
  const pressureRatio = state.drumPressure / NOMINAL_PRESSURE_BAR;
  const turbine1Steam = state.turbines[0].tripped ? 0 : state.turbines[0].valve * 48 * pressureRatio;
  const turbine2Steam = state.turbines[1].tripped ? 0 : state.turbines[1].valve * 48 * pressureRatio;
  const dumpSteam = state.steamDumpValve ? 45 * pressureRatio : 0;
  if (state.drumPressure >= 85) state.reliefValveOpen = true;
  if (state.drumPressure <= 75) state.reliefValveOpen = false;
  const reliefSteam = state.reliefValveOpen ? 80 * pressureRatio : 0;
  const totalSteamConsumed = turbine1Steam + turbine2Steam + dumpSteam + reliefSteam;
  const requiredFeedwater = 0.40 + (totalSteamConsumed / 96) * 0.40;
  const surplusFeedwater = Math.max(0, state.feedwaterValve - requiredFeedwater);

  // Årsaker til at voidFraction øker:
  // 1) Høy thermalPower i forhold til coolantFlow
  // 2) drumWaterLevel under -50 mm (for lite fødevann)
  // 3) Lavt damptrykk mens kjernen koker
  let targetVoid = 0;
  if (state.coreTemp > boilingPoint - 10) {
    const heatToFlowRatio = (state.thermalPower / NOMINAL_THERMAL_MW) / Math.max(0.15, state.coolantFlow);
    const pressureDropFactor = Math.max(0.6, NOMINAL_PRESSURE_BAR / Math.max(15, state.drumPressure));
    const lowWaterVoidPenalty =
      state.drumWaterLevel < -50
        ? Math.min(0.55, ((-50 - state.drumWaterLevel) / 280) * 0.50)
        : 0;
    const baseBoilingVoid = Math.max(0, (heatToFlowRatio * 0.42 * pressureDropFactor) - 0.08);
    targetVoid = Math.min(1.0, baseBoilingVoid + lowWaterVoidPenalty);
  }

  // Aktive røde 'void' hotspot-fliser på 37-ROD CORE MAP holder en lokal dampboble-lomme oppe
  // helt til spilleren klikker de røde flisene, trykker BORON INJECTION, eller øker Fødevann (ПЭН)!
  const voidTileFloor = voidTileCount * 0.145;
  const effectiveTargetVoid = Math.max(targetVoid, voidTileFloor);

  state.voidFraction += (effectiveTargetVoid - state.voidFraction) * 1.35 * delta;

  // Mottiltak #1: Kaldt fødevann (hver prosent feedwaterValve ligger over dampforbruket kjøler ned kanalene)
  if (surplusFeedwater > 0.02 && state.voidFraction > 0.08) {
    state.voidFraction = Math.max(0.05, state.voidFraction - surplusFeedwater * 0.55 * delta);
    // Hvis spilleren pøser på med kaldt fødevann (>= 15% over behov), slukkes røde void-fliser gradvis
    if (surplusFeedwater >= 0.15 && voidTileCount > 0 && state.voidFraction < voidTileCount * 0.14) {
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

  // Mottiltak #3: Aktiv Boron-innsprøytning fortsetter å dempe dampbobler
  if (state.boronDampingTimer > 0) {
    state.voidFraction = Math.max(0, state.voidFraction - 0.04 * delta);
  }

  state.voidFraction = Math.max(0, Math.min(1.0, state.voidFraction));

  // Automatisk tenning/slukking av røde 'void' hotspot-fliser på 37-ROD CORE MAP
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

  // ============================================================================
  // 4. INTERAKTIV XENON-135 DYNAMIKK («Xenon-gropen» & XENON BURNOUT)
  // ============================================================================
  const normalizedPower = state.thermalPower / NOMINAL_THERMAL_MW;
  const iodineProduction = normalizedPower * 1.9;
  const iodineDecay = state.iodine * 0.045;
  state.iodine = Math.max(0, Math.min(100, state.iodine + (iodineProduction - iodineDecay) * delta));

  // Når thermalPower senkes brått mens iodine er høy, brytes Jod-135 ned til Xenon-135 raskere enn nøytronene brenner det bort!
  const xenonFromIodine =
    state.iodine > 12 && state.thermalPower < 1650
      ? (state.iodine - 10) * (1 - state.thermalPower / 1800) * 0.16
      : iodineDecay;

  // Mottiltak #1 mot Xenon: XENON BURNOUT!
  // Når thermalPower >= 1800 MWt (eller kontrollstaver >= 70%), brennes Xenon-135 raskt bort (-3.5% per sekund)!
  const isXenonBurnoutActive = state.thermalPower >= 1800 && state.controlRods >= 0.62;
  if (isXenonBurnoutActive && state.xenon > 5) {
    state.xenon = Math.max(0, state.xenon - 3.5 * delta);
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
    const passiveBurnout = state.xenon * normalizedPower * 0.045;
    const xenonNaturalDecay = state.xenon * 0.012;
    state.xenon += (xenonFromIodine - passiveBurnout - xenonNaturalDecay) * delta;
  }

  // Aktive cyan 'xenon' fliser holder Xenon-lommen oppe inntil spilleren klikker flisene eller aktiverer XENON BURNOUT
  const xenonTileFloor = xenonTileCount * 14;
  if (!isXenonBurnoutActive && xenonTileFloor > state.xenon) {
    state.xenon += (xenonTileFloor - state.xenon) * 1.2 * delta;
  }

  state.xenon = Math.max(0, Math.min(100, state.xenon));

  // Automatisk tenning/slukking av cyan 'xenon' fliser på 37-ROD CORE MAP
  if (state.xenon > 30 && xenonTileCount === 0) {
    const nextAnom = { ...state.coreTileAnomalies };
    for (const tid of DEFAULT_XENON_TILES) {
      if (!nextAnom[tid]) {
        nextAnom[tid] = 'xenon';
      }
    }
    state.coreTileAnomalies = nextAnom;
  } else if (state.xenon < 20 && xenonTileCount > 0) {
    const nextAnom: Record<number, 'void' | 'xenon'> = {};
    for (const [k, v] of Object.entries(state.coreTileAnomalies)) {
      if (v !== 'xenon') nextAnom[Number(k)] = v;
    }
    state.coreTileAnomalies = nextAnom;
  }

  // ============================================================================
  // 5. REAKTIVITET, PROPORSJONAL & STABIL TERMISK EFFEKT (0-3200 MWt) & 37-ROD CORE MAP
  // ============================================================================
  if (state.autoRodEnabled && !state.az5Active && state.controlRods > 0.10) {
    if (state.drumPressure > 78) {
      const pressureTrim = (state.drumPressure - 78) * 0.008;
      state.controlRods = Math.max(0.35, state.controlRods - pressureTrim * delta);
    }
  }

  const rodReactivity = (state.controlRods - 0.48) * 0.08;
  const voidReactivity = state.voidFraction * VOID_COEFFICIENT;
  const xenonReactivity = -state.xenon * XENON_SCALE;
  const dopplerReactivity = -(state.coreTemp - 280) * DOPPLER_COEFFICIENT;

  state.reactivity =
    rodReactivity +
    voidReactivity +
    xenonReactivity +
    dopplerReactivity +
    az5TipReactivityBonus;

  let baseEquilibriumMW = 0;
  if (state.controlRods <= 0.10) {
    baseEquilibriumMW = 0;
  } else if (state.controlRods <= 0.55) {
    baseEquilibriumMW = ((state.controlRods - 0.10) / 0.45) * 2000;
  } else if (state.controlRods <= 0.90) {
    baseEquilibriumMW = 2000 + ((state.controlRods - 0.55) / 0.35) * 1200;
  } else {
    baseEquilibriumMW = 3200 + ((state.controlRods - 0.90) / 0.10) * 350;
  }

  // Positiv Void over 30% presser thermalPower oppover av seg selv;
  // høy Xenon over 35% trekker fra reaktivitet og kveler thermalPower;
  // aktiv Boron Injection demper reaktoren trygt med -500 MWt i 5 sekunder.
  const voidPowerBonus =
    state.controlRods > 0.10
      ? state.voidFraction * 240 + Math.max(0, state.voidFraction - 0.30) * 420
      : 0;
  const xenonPowerPenalty =
    state.controlRods > 0.10
      ? Math.max(0, state.xenon - 15) * 7.5 + Math.max(0, state.xenon - 35) * 6.5
      : 0;
  const boronDampingPenalty = state.boronDampingTimer > 0 ? 500 : 0;
  const az5SpikeMW = az5TipReactivityBonus > 0 ? az5TipReactivityBonus * 25000 : 0;

  const targetThermalMW =
    state.controlRods <= 0.10 && az5SpikeMW === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            4800,
            baseEquilibriumMW +
              voidPowerBonus -
              xenonPowerPenalty -
              boronDampingPenalty +
              az5SpikeMW
          )
        );

  const powerRate = state.az5Active && az5SpikeMW === 0 ? 2.4 : 1.15;
  state.thermalPower += (targetThermalMW - state.thermalPower) * powerRate * delta;
  if (state.controlRods <= 0.10 && state.thermalPower < 8 && az5SpikeMW === 0) {
    state.thermalPower = 0;
  }
  state.thermalPower = Math.max(0, Math.min(4800, state.thermalPower));

  // Oppdater de 37 flisene på det runde kjernekartet på Unit A-2
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
  // 6. DAMPSEPARATORER (70 BAR Trykk og -400/+400 mm Vannstand)
  // ============================================================================
  if (state.controlRods >= 0.20 && state.feedwaterValve < 0.40) {
    state.feedwaterValve = 0.50;
  }

  const steamProduced = state.coreTemp > boilingPoint - 18
    ? (state.thermalPower / NOMINAL_THERMAL_MW) * 100
    : (state.thermalPower / NOMINAL_THERMAL_MW) * 32;

  const feedwaterIn = state.feedwaterValve * 115;
  state.plantWaterDrainPct = 0;

  if (state.feedwaterValve >= 0.40) {
    const targetWaterMm = (state.feedwaterValve - requiredFeedwater) * 180;
    state.drumWaterLevel += (targetWaterMm - state.drumWaterLevel) * 1.2 * delta;
    state.drumWaterLevel = Math.max(-140, Math.min(220, state.drumWaterLevel));
  } else {
    const waterLoss = totalSteamConsumed + steamProduced * 0.15;
    state.drumWaterLevel += (feedwaterIn - waterLoss) * 0.4 * delta;
    state.drumWaterLevel = Math.max(-400, Math.min(400, state.drumWaterLevel));
  }

  const steamDeficit = Math.max(0, totalSteamConsumed - steamProduced);
  const steamSurplus = Math.max(0, steamProduced - totalSteamConsumed - 28);
  const naturalEquilibriumPressure =
    state.thermalPower > 50
      ? Math.max(
          28,
          Math.min(
            84,
            1 +
              Math.min(1, state.thermalPower / 1700) * 69 -
              steamDeficit * 0.72 +
              steamSurplus * 0.22
          )
        )
      : 1;
  state.drumPressure += (naturalEquilibriumPressure - state.drumPressure) * 0.65 * delta;
  state.drumPressure += (steamProduced - totalSteamConsumed) * 0.08 * delta;
  if (state.autoRodEnabled && !state.az5Active && state.drumPressure > 72 && steamSurplus < 15) {
    state.drumPressure += (70 - state.drumPressure) * 1.4 * delta;
  }
  state.drumPressure = Math.max(1, Math.min(120, state.drumPressure));

  state.roomRadiation =
    0.1 +
    (state.thermalPower / NOMINAL_THERMAL_MW) * 0.3 +
    (state.reliefValveOpen ? 2.5 : 0) +
    Math.max(0, state.drumPressure - 75) * 0.12;

  // ============================================================================
  // 7. TURBINER (3000 RPM GOVERNOR / 50.0 HZ SYNKRONOSKOP [-180°..+180°] / 1000 MWe)
  // ============================================================================
  state.turbines.forEach((turb) => {
    if (turb.tripped) {
      turb.valve = 0;
      turb.gridConnected = false;
    }

    const steamForce = turb.tripped ? 0 : turb.valve * (state.drumPressure / NOMINAL_PRESSURE_BAR);

    if (!turb.gridConnected) {
      if (!turb.tripped && turb.valve >= 0.15 && turb.valve <= 0.95 && state.drumPressure >= 30) {
        turb.rpm += (3000 - turb.rpm) * 1.45 * delta;
        if (Math.abs(3000 - turb.rpm) < 12) {
          turb.rpm = 3000;
        }
      } else if (!turb.tripped && turb.valve > 0.95 && state.drumPressure >= 30) {
        const targetFreeRpm = 3220;
        turb.rpm += (targetFreeRpm - turb.rpm) * 1.1 * delta;
      } else {
        const targetLowRpm = steamForce * 16000;
        turb.rpm += (targetLowRpm - turb.rpm) * 0.9 * delta;
      }

      turb.rpm = Math.max(0, turb.rpm);
      turb.freqHz = Number((turb.rpm / 60).toFixed(1));
      turb.electricalMW = 0;

      const freqDiffHz = (turb.rpm - 3000) / 60;
      const visualSpinHz =
        Math.abs(freqDiffHz) < 0.8 ? 0.18 : Math.sign(freqDiffHz) * Math.min(1.2, Math.abs(freqDiffHz));
      let nextPhase = turb.syncPhase + visualSpinHz * 360 * delta;
      nextPhase = ((((nextPhase + 180) % 360) + 360) % 360) - 180;
      turb.syncPhase = nextPhase;

      if (turb.rpm > 3350) {
        turb.tripped = true;
      }
    } else {
      turb.rpm = 3000;
      turb.freqHz = 50.0;
      turb.syncPhase = 0;

      turb.electricalMW = Math.min(550, Math.round(steamForce * 500));

      if (steamForce < 0.03) {
        turb.gridConnected = false;
        turb.electricalMW = 0;
      }
    }
  });

  state.totalElectricalMW = state.turbines[0].electricalMW + state.turbines[1].electricalMW;

  // ============================================================================
  // 8. OPPDATER STATUS OG KVOTER PÅ K.O.M.R.A.D.-84 SKJERMEN (KUN ELEKTRISK MWe)
  // ============================================================================
  const totalAllocatedMW = state.substations.reduce((s, x) => s + x.allocatedMW, 0);
  const hasEnoughPower = state.totalElectricalMW >= totalAllocatedMW - 15;

  state.substations.forEach((sub) => {
    const leverMatchesTarget = Math.abs(sub.allocatedMW - sub.targetMW) <= 15;
    const mwMet = hasEnoughPower && leverMatchesTarget;

    if (!hasEnoughPower && sub.allocatedMW > 0) {
      sub.statusText = `GEN LOW (${Math.round(state.totalElectricalMW)}/${totalAllocatedMW}MW)`;
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

  // ============================================================================
  // 9. HAVARI-GRENSER
  // ============================================================================
  if (state.coreTemp > 1200) state.coreMeltdown = true;
  if (state.drumPressure > 115) state.steamExplosion = true;
}

/**
 * Kalles når spilleren drar i MAIN BREAKER på Unit C
 */
export function toggleGridBreaker(state: ReactorState, turbineIndex: 0 | 1 = 0): {
  success: boolean;
  reason?: string;
} {
  const turb = state.turbines[turbineIndex];

  if (turb.gridConnected) {
    turb.gridConnected = false;
    turb.electricalMW = 0;
    return { success: true };
  }

  if (turb.tripped) {
    return { success: false, reason: 'TURBINE TRIPPED // RESET BEFORE SYNC' };
  }

  const phaseError = Math.abs(turb.syncPhase);

  if (turb.rpm >= 2900 && phaseError <= 45) {
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
    turb.valve = 0;
    return {
      success: false,
      reason: `OUT OF SYNC! (RPM: ${Math.round(turb.rpm)}, PHASE: ${Math.round(turb.syncPhase)}°)`
    };
  }
}

/**
 * Oppdaterer VOLKOV DRILL-boksen på K.O.M.R.A.D.-84 skjermen og WE-PAD 84 under oppstart og fare-øvelser (Steg 0–8)
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
        body: 'ACTION: PRESS [E] (OR CLICK) TO PICK UP YOUR "WE-PAD 84" TABLET FROM THE DESK.',
        hint: 'WHY: Your WePad 84 links directly to Plant Director Volkov and displays live RBMK-1000 telemetry as you walk around the bunker.'
      };
    }

    case 'STEP_1_COOLING': {
      const activePumps = state.mcpActive.filter(Boolean).length;
      if (activePumps >= 2 && state.feedwaterValve >= 0.45) {
        return evaluateTutorial(state, 'STEP_2_PULL_RODS');
      }
      return {
        phase: 'STEP_1_COOLING',
        header: '>> STEP 1/8 [UNIT B — FAR LEFT]:',
        body: 'ACTION: TURN ON ALL 4 "MAIN CIRC. PUMPS (ГЦН 1–4)", THEN HOVER OVER "FEEDWATER VALVE (ПЭН)" AND SCROLL YOUR MOUSE WHEEL UP TO 50%.',
        hint: 'WHY: Pumps circulate water through the core channels, while Feedwater replaces water that boils into steam so the drums stay at 0 mm and never boil dry.'
      };
    }

    case 'STEP_2_PULL_RODS': {
      if (state.autoRodEnabled && state.controlRods >= 0.50 && state.thermalPower >= 200) {
        return evaluateTutorial(state, 'STEP_3_BUILD_STEAM');
      }
      return {
        phase: 'STEP_2_PULL_RODS',
        header: '>> STEP 2/8 [UNIT A-2 — MID LEFT]:',
        body: 'ACTION: FLIP ON "AUTO REGULATOR (АР)" (RIGHT BOX), THEN SCROLL THE "CONTROL ROD DRIVE (СУЗ)" WHEEL UP TO 55%.',
        hint: 'WHY: Pulling boron rods out lets neutrons split Uranium-235 atoms (fission), while АР automatically trims reactivity to keep power stable.'
      };
    }

    case 'STEP_3_BUILD_STEAM': {
      if (state.drumPressure >= 60) {
        return evaluateTutorial(state, 'STEP_4_SPIN_TURBINE');
      }
      return {
        phase: 'STEP_3_BUILD_STEAM',
        header: '>> STEP 3/8 [UNIT A & B]:',
        body: 'ACTION: WAIT A FEW SECONDS AS FISSION BOILS THE CORE TO 284°C AND BUILDS 65–70 BAR STEAM PRESSURE IN THE DRUM SEPARATORS.',
        hint: 'WHY: Under 70 BAR pressure, water boils at 284°C—producing high-energy dry steam to drive our turbine.'
      };
    }

    case 'STEP_4_SPIN_TURBINE': {
      const t1 = state.turbines[0];
      if (t1.valve >= 0.15 && t1.rpm >= 2950) {
        return evaluateTutorial(state, 'STEP_5_SYNC_GRID');
      }
      return {
        phase: 'STEP_4_SPIN_TURBINE',
        header: '>> STEP 4/8 [UNIT C — RIGHT WALL]:',
        body: 'ACTION: HOVER OVER "TURBINE STEAM VALVE" AND SCROLL YOUR MOUSE WHEEL UP TO 20% UNTIL THE TURBINE REACHES 3000 RPM (50.0 HZ).',
        hint: 'WHY: 3000 RPM matches the Soviet 50 Hz grid frequency. We only open the valve to 20% while disconnected because there is no grid load yet.'
      };
    }

    case 'STEP_5_SYNC_GRID': {
      if (state.turbines[0].gridConnected === true) {
        return evaluateTutorial(state, 'STEP_6_BASELINE_600MW');
      }
      return {
        phase: 'STEP_5_SYNC_GRID',
        header: '>> STEP 5/8 [UNIT C — RIGHT WALL]:',
        body: 'ACTION: WATCH THE "SYNCHROSCOPE 50HZ" NEEDLE. PULL "MAIN BREAKER" (OR PRESS SPACE) AS THE NEEDLE PASSES 12 O\'CLOCK (0° GREEN ZONE)!',
        hint: 'WHY: Closing at 12 o\'clock locks our generator in phase with the state grid without causing a destructive magnetic shock.'
      };
    }

    case 'STEP_6_BASELINE_600MW': {
      const allLeversMatch = state.substations.every(
        (s) => Math.abs(s.allocatedMW - s.targetMW) <= 15
      );
      if (state.totalElectricalMW >= 550 && allLeversMatch) {
        // Seed Step 7 Simulated Steam Void Spike (50% Void + 3 Red Void Hotspot Tiles on UNIT A-2)
        state.voidFraction = 0.50;
        state.coreTileAnomalies = { 6: 'void', 18: 'void', 24: 'void' };
        return evaluateTutorial(state, 'STEP_7_VOID_DRILL');
      }
      return {
        phase: 'STEP_6_BASELINE_600MW',
        header: '>> STEP 6/8 [UNIT C & A — 600 MWe]:',
        body: 'ACTION: SCROLL "TURBINE STEAM VALVE" ON UNIT C UP TO 60% (600 MWe), THEN SCROLL ALL 6 SUBSTATION LEVERS ON UNIT A TO 100 MW EACH.',
        hint: 'WHY: Cruising at 600 MWe (60% capacity) leaves 400 MWe of headroom when Moscow orders power surges!'
      };
    }

    case 'STEP_7_VOID_DRILL': {
      if (state.voidFraction < 0.25) {
        // Clear any leftover void anomalies and seed Step 8 Simulated Xenon-135 Pocket (50% Xenon + 3 Cyan Tiles on UNIT A-2)
        state.voidFraction = 0.08;
        state.xenon = 50;
        state.coreTileAnomalies = { 10: 'xenon', 18: 'xenon', 28: 'xenon' };
        return evaluateTutorial(state, 'STEP_8_XENON_DRILL');
      }
      return {
        phase: 'STEP_7_VOID_DRILL',
        header: '>> STEP 7/8 [VOID HAZARD DRILL]:',
        body: 'ACTION: SIMULATED STEAM VOID SPIKE (50%)! CLICK THE GLOWING RED TILES ON THE "37-ROD CORE MAP" (UNIT A-2) OR PRESS "BORON INJECTION" (UNIT A) TO DROP VOIDS BELOW 25%!',
        hint: 'WHY: In an RBMK-1000, steam bubbles (Void) accelerate reactivity! Suppress voids with Boron Injection, extra Feedwater, or trimming red hotspot channels.'
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
        header: '>> STEP 8/8 [XENON-135 DRILL]:',
        body: 'ACTION: SIMULATED XENON POISONING (50%)! CLICK THE GLOWING CYAN TILES ON THE "37-ROD CORE MAP" (UNIT A-2) OR SCROLL UP "CONTROL RODS" TO BURN XENON BELOW 25%!',
        hint: 'WHY: Xenon-135 builds up when power drops and suffocates fission. Clear Xenon pockets on the 37-tile map, raise rods to burn it out, or use Steam Dump (БРУ-К) during load drops!'
      };
    }

    case 'COMPLETED':
      return {
        phase: 'COMPLETED',
        header: '>> K.O.M.R.A.D.-84 // LIVE DISPATCH:',
        body: 'MONITOR THE MATRIX PRINTER FOR MOSCOW DIRECTIVES, KEEP ALL 6 SUBSTATION QUOTAS GREEN, AND SUPPRESS ANY VOID OR XENON HAZARDS.',
        hint: 'TIP: Hover & scroll your mouse wheel on any valve or lever (±5% or ±25 MW); hold [SHIFT+SCROLL] for ±1% fine tuning!'
      };
  }
}
