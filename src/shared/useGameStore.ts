// Shared Contract: Cross-module Zustand store
import { create } from 'zustand'
import {
  createColdStartState,
  evaluateTutorial,
  stepReactorSimulation,
  toggleGridBreaker,
  triggerBoronInjection,
  selectCoreChannelForRefuel,
  refuelSelectedCoreChannel,
  type ReactorState,
  type SubstationQuota,
  type TutorialPhase,
  type TutorialPrompt,
} from '../simulation/rbmkPhysics'
import {
  KOMRAD_TAKEOVER_MESSAGE,
  VOLKOV_FAREWELL_MESSAGE,
  pickPrinterDirectiveDispatch,
  pickQuotaCommendationDispatch,
  pickReactorHazardDispatch,
  pickSectorBrownoutDispatch,
  type PrinterOrderFlavor,
  type ReactorHazardCategory,
} from './komradLiveDispatches'
import {
  canEmitKomradIdleChatter,
  canEmitKomradNonCriticalWarning,
  reserveIdleChatterEmission,
  resetKomradSilenceState,
} from './komradSilenceState'
import { pointerLockInteraction } from './pointerLockState'
import type {
  AppliedStampMark,
  CameraStation,
  DiagnosticAlarmId,
  DirectiveDecision,
  DirectiveDocument,
  GameState,
  HotspotSeverity,
  KomradMessageEntry,
  KomradMood,
  OperationalMandate,
  SectorNodeId,
  SystemType,
  TerminalLogEntry,
} from './types'

const SECTOR_TO_SUB_ID: Record<SectorNodeId, number> = {
  pripyat: 1,
  duga: 2,
  kolkhoz: 3,
  kgb: 4,
  vodka: 5,
  steel: 6,
}

type MandateComplianceListener = (
  fulfilled: boolean,
  mandateId: string,
  reason: string
) => void

let mandateComplianceListener: MandateComplianceListener | null = null

export function registerMandateComplianceListener(
  listener: MandateComplianceListener
): void {
  mandateComplianceListener = listener
}

function findSubById(
  substations: SubstationQuota[],
  id: number
): SubstationQuota | undefined {
  return substations.find((s) => s.id === id)
}

function extractReactorState(state: GameState | ReactorState): ReactorState {
  const condenserVac =
    'auxLoopBActive' in state
      ? Boolean(state.auxLoopBActive)
      : state.condenserVacActive
  const wetSteam =
    'wetSteamPenalty' in state ? state.wetSteamPenalty : state.wetSteamSeverity
  return {
    rodTargetRate: state.rodTargetRate,
    az5Active: state.az5Active,
    mcpActive: [...state.mcpActive],
    pumpThrottle: [state.pumpThrottle[0], state.pumpThrottle[1]],
    oilCoolerValve: state.oilCoolerValve,
    feedwaterValve: state.feedwaterValve,
    nitrogenLoopValve: state.nitrogenLoopValve,
    sealToggles: [
      state.sealToggles[0],
      state.sealToggles[1],
      state.sealToggles[2],
    ],
    steamDumpValve: state.steamDumpValve,
    ventingSteam: state.ventingSteam,
    bubblerDraining: state.bubblerDraining,
    ventilationActive: state.ventilationActive,
    avrActive: state.avrActive,
    kgbLineActive: state.kgbLineActive,
    condenserVacActive: condenserVac,
    plantWaterDrainPct: state.plantWaterDrainPct,
    wePadHeld: 'wePadHeld' in state ? state.wePadHeld : false,
    wePadInspecting: 'wePadInspecting' in state ? state.wePadInspecting : false,
    controlRods: state.controlRods,
    boronTankLevel: state.boronTankLevel,
    boronReservePool: state.boronReservePool,
    az5Timer: state.az5Timer,
    boronDampingTimer: state.boronDampingTimer ?? 0,
    reactivity: state.reactivity,
    thermalPower: state.thermalPower,
    coreTemp: state.coreTemp,
    graphiteTemp: state.graphiteTemp,
    heliumPressure: state.heliumPressure,
    voidFraction: state.voidFraction,
    iodine: state.iodine,
    xenon: state.xenon,
    rodTilesFlux: [...state.rodTilesFlux],
    coreTileAnomalies: { ...(state.coreTileAnomalies ?? {}) },
    selectedRefuelChannel: state.selectedRefuelChannel ?? null,
    fuelBurnupTimer: state.fuelBurnupTimer ?? 0,
    coolantFlow: state.coolantFlow,
    pumpAHeat: state.pumpAHeat,
    pumpBHeat: state.pumpBHeat,
    lubeOilPressure: state.lubeOilPressure,
    waterReservoir: state.waterReservoir,
    pripyatWater: state.pripyatWater,
    kolkhozWater: state.kolkhozWater,
    vodkaWater: state.vodkaWater,
    drumWaterLevel: state.drumWaterLevel,
    drumPressure: state.drumPressure,
    bubblerLevel: state.bubblerLevel,
    wetSteamSeverity: wetSteam,
    reliefValveOpen: state.reliefValveOpen,
    roomRadiation: state.roomRadiation,
    turbines: [
      { ...state.turbines[0] },
      { ...state.turbines[1] },
    ],
    houseLoadMW: state.houseLoadMW,
    energyCreatedMW: state.energyCreatedMW,
    batteryStoredMWh: state.batteryStoredMWh,
    batteryOutputValve: state.az5Active
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            Number(
              (
                state.substations.reduce((acc, s) => acc + (s.allocatedMW ?? 0), 0) /
                1000
              ).toFixed(3)
            )
          )
        ),
    energyDemandMW: state.energyDemandMW,
    totalElectricalMW: state.totalElectricalMW,
    substations: state.substations.map((s) => ({ ...s })),
    coreMeltdown: state.coreMeltdown,
    steamExplosion: state.steamExplosion,
  }
}

function cleanWheelText(text: string): string {
  return text
    .replace(/GO TO:\s*\[KEY 5\]\s*UNIT C\s*\(BATTERY WHEEL\)/gi, 'GO TO: [KEY 1] UNIT A (SECTOR LEVER)')
    .replace(/\[BATTERY\s*->\s*GRID\]\s*WHEEL/gi, 'UNIT C AUTO BUSBARS')
    .replace(/TURN\s+BATTERY\s+WHEEL\s*(\[C\])?\s*(\([^)]*\))?\s*TO\s*(\d+\s*MW)/gi, 'SET SECTOR LEVERS [A] TO $3 (UNIT C AUTO-DRAINS)')
    .replace(/BATTERY\s+WHEEL\s*(\[C\])?\s*(\([^)]*\))?/gi, 'UNIT C AUTO BUSBARS')
    .replace(/single\s+UNIT\s+C\s+wheel/gi, 'UNIT C copper busbars')
    .replace(/UNIT\s+C\s+wheel/gi, 'UNIT C auto-dispatch')
    .replace(/&\s*Wheel\s*\[C\]/gi, '(C auto-trims)')
    .replace(/3\.\s*Battery\s*Wheel\s*\[C\]/gi, '3. Unit C Auto-Drains')
    .replace(/\bTURN\s+WHEEL\b/gi, 'CHECK AUTO DRAIN')
    .replace(/UNIT C \(RIGHT WALL\)/gi, 'UNIT C (LEFT WALL)')
    .replace(/UNIT B \(FAR LEFT\)/gi, 'UNIT B (RIGHT WING)')
}

function evaluateWheelFreeTutorial(
  r: ReactorState,
  tutorialPhase: TutorialPhase
): TutorialPrompt {
  const nonWePadPhase: TutorialPhase =
    tutorialPhase === 'STEP_0_PICKUP_WEPAD' ? 'STEP_1_COOLING' : tutorialPhase
  const effectivePhase: TutorialPhase =
    nonWePadPhase === 'STEP_4_SPIN_TURBINE' ? 'STEP_6_BASELINE_600MW' : nonWePadPhase
  const raw = evaluateTutorial(r, effectivePhase)
  const resolved =
    raw.phase === 'STEP_4_SPIN_TURBINE'
      ? evaluateTutorial(r, 'STEP_6_BASELINE_600MW')
      : raw

  if (resolved.phase === 'STEP_6_BASELINE_600MW') {
    return {
      ...resolved,
      phase: 'STEP_6_BASELINE_600MW',
      header: '>> STEP 4/6 [KEY 1 -> UNIT A // 6 SECTOR LEVERS]:',
      body:
        'ACTION: GO TO UNIT A [KEY 1] AND SET ALL 6 SECTOR LEVERS TO 100 MW! UNIT C COPPER BUSBARS AUTOMATICALLY DRAIN BANKS A & B TO SUPPLY 600 MW.',
      hint:
        'WHY: Raising Unit A substation levers automatically draws matching MW from Unit C Accumulator Banks A & B.',
      panelKey: 'GO TO: [KEY 1] UNIT A (6 LEVERS)',
      actionLine:
        'SET ALL 6 SECTOR LEVERS ON UNIT A TO 100 MW (UNIT C AUTO-DRAINS)',
      whyLines: [
        'Unit C copper busbars drain Accumulator Banks A & B automatically per Unit A lever demand.',
        'Check [KEY 5] Unit C dial & VFD readout to monitor live zone drain.',
      ],
    }
  }

  return {
    ...resolved,
    header: cleanWheelText(resolved.header),
    body: cleanWheelText(resolved.body),
    hint: cleanWheelText(resolved.hint),
    panelKey: cleanWheelText(resolved.panelKey),
    actionLine: cleanWheelText(resolved.actionLine),
    whyLines: [
      cleanWheelText(resolved.whyLines[0]),
      cleanWheelText(resolved.whyLines[1]),
    ],
    volkovQuote: cleanWheelText(resolved.volkovQuote),
  }
}

function mapReactorToGameStateFields(
  r: ReactorState,
  tutorialPhase: TutorialPhase
) {
  const evalRes = evaluateWheelFreeTutorial(r, tutorialPhase)
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

  const channelHotspots: Record<number, HotspotSeverity> = {}
  for (const [k, v] of Object.entries(r.coreTileAnomalies ?? {})) {
    if (v === 'spent') {
      channelHotspots[Number(k)] = 'amber'
    }
  }

  const { wePadHeld: _wePadHeld, wePadInspecting: _wePadInspecting, ...reactorRest } = r

  return {
    ...reactorRest,
    channelHotspots,
    tutorialPhase: evalRes.phase,
    tutorialPrompt: evalRes,
    tutorialStep: (evalRes.phase === 'COMPLETED' ? 'DONE' : 1) as GameState['tutorialStep'],
    coreTemp: Math.round(r.coreTemp),
    graphiteTemp: Math.round(r.graphiteTemp),
    pressureBar: Number(r.drumPressure.toFixed(1)),
    heliumPressure: Number(r.heliumPressure.toFixed(1)),
    radiationLevel: Number(r.roomRadiation.toFixed(2)),
    controlRodLevel: Number((r.controlRods * 100).toFixed(1)),
    boronTankLevel: Number(r.boronTankLevel.toFixed(1)),
    boronReservePool: Number(r.boronReservePool.toFixed(1)),
    boronPoisoningTimer: Number((r.boronDampingTimer ?? 0).toFixed(1)),
    turbineRpm: Math.round(r.turbines[0].rpm),
    gridHz: Number(r.turbines[0].freqHz.toFixed(2)),
    pumpsActive: [pumpAActive, pumpBActive] as [boolean, boolean],
    pumpThrottle: [
      Number(r.pumpThrottle[0].toFixed(1)),
      Number(r.pumpThrottle[1].toFixed(1)),
    ] as [number, number],
    pumpAHeat: Number(r.pumpAHeat.toFixed(1)),
    pumpBHeat: Number(r.pumpBHeat.toFixed(1)),
    lubeOilPressure: Number(r.lubeOilPressure.toFixed(1)),
    oilCoolerValve: Number(r.oilCoolerValve.toFixed(1)),
    nitrogenLoopValve: Number(r.nitrogenLoopValve.toFixed(1)),
    bubblerLevel: Number(r.bubblerLevel.toFixed(1)),
    bubblerDraining: r.bubblerDraining,
    ventingSteam: r.ventingSteam,
    sealToggles: [
      Boolean(r.sealToggles[0]),
      Boolean(r.sealToggles[1]),
      Boolean(r.sealToggles[2]),
    ] as [boolean, boolean, boolean],
    containmentSealLocked: Boolean(
      r.sealToggles[0] && r.sealToggles[1] && r.sealToggles[2]
    ),
    ventilationActive: r.ventilationActive,
    avrActive: r.avrActive,
    kgbLineActive: r.kgbLineActive,
    auxLoopBActive: r.condenserVacActive,
    houseLoadMW: Number(r.houseLoadMW.toFixed(1)),
    energyCreatedMW: Math.round(r.energyCreatedMW),
    batteryStoredMWh: Number(r.batteryStoredMWh.toFixed(1)),
    batteryStoredPct: Math.round(Math.max(0, Math.min(100, r.batteryStoredMWh / 10))),
    batteryOutputValve: Number(r.batteryOutputValve.toFixed(3)),
    energyDemandMW: Math.round(r.energyDemandMW),
    wetSteamPenalty: Number(r.wetSteamSeverity.toFixed(2)),
    sectorMW,
    targetSectorMW,
    targetCityMW: targetSectorMW.pripyat + targetSectorMW.kolkhoz,
    targetDefenseMW: targetSectorMW.duga + targetSectorMW.kgb,
    targetVodkaMW: targetSectorMW.vodka + targetSectorMW.steel,
    pripyatWater: Math.round(r.pripyatWater),
    kolkhozWater: Math.round(r.kolkhozWater),
    vodkaWater: Math.round(r.vodkaWater),
    waterReservoir: Math.round(r.waterReservoir),
    waterUsage: Math.round(r.plantWaterDrainPct),
    // Keep station auxiliary lighting active while reflecting sector output
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

  const maxPumpHeat = Math.max(state.pumpAHeat, state.pumpBHeat)

  const hintForAlarm = (id: DiagnosticAlarmId): string => {
    switch (id) {
      case 'core':
        if (state.coreTemp > 520 && state.controlRodLevel > 75) {
          return '⚠️ HIGH REACTIVITY: INSERT CONTROL RODS (UNIT A-2) OR BOOST PUMPS TO AVOID OVERHEAT!'
        }
        return state.coreTemp > 520
          ? '⚠️ HIGH CORE TEMP (>520°C): INSERT CONTROL RODS ON UNIT A-2 [KEY 3] OR BOOST COOLING PUMPS ON UNIT A!'
          : '⚡ CORE & REACTIVITY: MONITOR THERMAL MWt & BORON CONTROL RODS ON UNIT A-2 [KEY 3]!'
      case 'water':
        if (state.drumWaterLevel < -100) {
          return `💧 LOW DRUM WATER (${Math.round(state.drumWaterLevel)} MM): OPEN FEEDWATER WHEEL ON UNIT B [KEY 3] TO PREVENT VOID SPIKE!`
        }
        if (state.drumWaterLevel > 100) {
          return `💦 HIGH DRUM WATER (+${Math.round(state.drumWaterLevel)} MM): WET STEAM SLUGGING TURBINE! LOWER FEEDWATER WHEEL ON UNIT B [KEY 3]!`
        }
        if (state.bubblerLevel >= 85) {
          return `🌊 BUBBLER POOL FULL (${Math.round(state.bubblerLevel)}%): PULL BUBBLER DRAIN LEVER ON UNIT B [KEY 3] TO RECYCLE CONDENSATE!`
        }
        return '💧 DRUM WATER & RESERVOIR: BALANCE FEEDWATER (FW PUMP) ON UNIT B [KEY 3] NEAR 0 MM (-100 TO +100 MM)!'
      case 'gas_oil':
        if (state.graphiteTemp > 540) {
          return `🔥 HOT GRAPHITE (${state.graphiteTemp}°C): INCREASE HELIUM-N2 / FW PUMP WHEEL ON UNIT B [KEY 3] TO PREVENT MODERATION RUNAWAY!`
        }
        if (!state.containmentSealLocked && state.thermalPower > 200) {
          return '☢️ CONTAINMENT SCRUBBERS OPEN: LOCK ALL 3 SEAL TOGGLES ON UNIT B [KEY 3] TO STOP RADIATION LEAK!'
        }
        return '⚠️ HIGH STEAM PRESSURE (>76 BAR): INSERT BORON RODS (UNIT A-2) & VENT/DRAIN EXCESS STEAM (UNIT B)!'
      case 'bearing':
        if (maxPumpHeat > 65 || state.lubeOilPressure < 42) {
          return `⚙️ PUMP BEARINGS HOT (${Math.round(20 + maxPumpHeat)}°C / OIL ${Math.round(state.lubeOilPressure)} PSI): OPEN BEARING COOLER VALVES ON UNIT A / A-2!`
        }
        if (state.boronTankLevel < 25) {
          return `🧪 LOW BORON TANK (${Math.round(state.boronTankLevel)}%): PASSIVE FEED TRICKLE ACTIVE — REFUEL AMBER CHANNELS ON UNIT A-2 [KEY 3]!`
        }
        const spentCount = Object.keys(state.coreTileAnomalies ?? {}).length
        if (spentCount >= 4) {
          return `☢️ SPENT FUEL OVERHEAT (${spentCount} AMBER CHANNELS): CLICK AN AMBER TILE & PULL [ROD REFUELING LEVER] ON UNIT A-2 [KEY 3]!`
        }
        return state.voidFraction > 0.35
          ? `⚠️ STEAM VOIDS (${Math.round(state.voidFraction * 100)}%): RAISE [FEEDWATER] (UNIT B) OR LOWER [RODS] (UNIT A-2), OR PRESS [BORON INJECTION] ON UNIT A!`
          : `☢️ XENON POISONING (${Math.round(state.xenon)}%): RAISE [RODS] (UNIT A-2) OR TRIM EXCESS [FEEDWATER] (UNIT B) TO BALANCE REACTIVITY!`
      case 'grid':
        if (state.batteryStoredPct < 8) {
          return '🔋 BATTERY BANK LOW (<8%): WITHDRAW RODS (A-2) TO GENERATE >500 MW AND RECHARGE ACCUMULATORS!'
        }
        if (state.totalElectricalMW > state.energyDemandMW + 60) {
          return '⚡ GRID OVER-DISPATCH: LOWER UNIT A SECTOR LEVERS [KEY 1] TO SHED SURPLUS LOAD (UNIT C AUTO-DRAINS)!'
        }
        if (state.totalElectricalMW < state.energyDemandMW - 40) {
          return '⚡ DEMAND DEFICIT: BATTERY BANK LOW OR TRIPPED ON UNIT C [KEY 5] — RAISE RODS ON A-2 TO SUPPLY DEMAND!'
        }
        return '🔋 BATTERY BANK & AUTO DISPATCH OK: UNIT C COPPER BUSBARS ARE AUTOMATICALLY SUPPLYING UNIT A ZONE LOAD.'
      case 'order':
        return '📄 NEW DIRECTIVE IN PRINTER: PRESS [KEY 4] -> TEAR PAPER, INSPECT SEAL/FONT/COLOR, STAMP & DISPATCH (TUBE) OR SHRED!'
    }
  }

  if (state.hoveredDiagnosticId) {
    return hintForAlarm(state.hoveredDiagnosticId)
  }

  if (state.coreTemp > 520 && state.controlRodLevel > 75) {
    return '⚠️ HIGH REACTIVITY: INSERT CONTROL RODS (UNIT A-2) OR BOOST PUMPS TO AVOID OVERHEAT!'
  }
  const totalSectMW =
    state.sectorMW.pripyat +
    state.sectorMW.duga +
    state.sectorMW.kolkhoz +
    state.sectorMW.kgb +
    state.sectorMW.vodka +
    state.sectorMW.steel
  if (
    state.drumPressure < 42 &&
    (state.batteryOutputValve > 0.25 || totalSectMW > 200) &&
    state.tutorialPhase === 'COMPLETED'
  ) {
    return '⚠️ STEAM STARVATION (<42 BAR): WITHDRAW BORON RODS (UNIT A-2) & BOOST COOLING PUMPS (UNIT A) TO CHARGE THE BATTERY!'
  }
  if (
    state.tutorialPhase === 'COMPLETED' &&
    (state.batteryStoredPct < 10 || Math.abs(state.totalElectricalMW - state.energyDemandMW) > 90)
  ) {
    return hintForAlarm('grid')
  }
  if (maxPumpHeat > 65 || state.boronTankLevel < 25 || state.voidFraction > 0.35 || state.xenon > 35) {
    return hintForAlarm('bearing')
  }
  if (state.coreTemp > 520) {
    return hintForAlarm('core')
  }
  if (
    state.graphiteTemp > 540 ||
    (!state.containmentSealLocked && state.thermalPower > 200) ||
    state.drumPressure > 78
  ) {
    return hintForAlarm('gas_oil')
  }
  if (Math.abs(state.drumWaterLevel) > 100 || state.bubblerLevel >= 85) {
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
    authCode: 'USSR-84-42-BG',
    authorizationCode: 'USSR-84-42-BG',
    bodyText:
      'BY ORDER OF MINATOM-84: Authorize auxiliary cooling circulation in Loop B to maintain Socialist thermal equilibrium.',
    stampType: 'MINATOM_OFFICIAL',
    inkColor: 'SOVIET_CRIMSON',
    watermarkText: 'GLORY TO LABOR 1984 // USSR GOST-84',
    watermark: 'GLORY TO LABOR 1984 // USSR GOST-84',
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
    authCode: 'USSR-84-28-GD',
    authorizationCode: 'USSR-84-28-GD',
    bodyText:
      'ROUTINE VERIFICATION: Confirm primary control rod graphite lubrication and log nominal megawatt distribution.',
    stampType: 'POLITBURO_URGENT',
    inkColor: 'BUREAU_VIOLET',
    watermarkText: 'GLORY TO LABOR 1984 // USSR GOST-84',
    watermark: 'GLORY TO LABOR 1984 // USSR GOST-84',
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
    authCode: 'USSR-84-64-KP',
    authorizationCode: 'USSR-84-64-KP',
    bodyText:
      'STATE SECURITY NOTICE: Rotate magnetic encryption keys on K.O.M.R.A.D.-84 telemetry lines immediately.',
    stampType: 'KGB_DIRECTORATE_4',
    inkColor: 'SOVIET_CRIMSON',
    watermarkText: 'GLORY TO LABOR 1984 // USSR GOST-84',
    watermark: 'GLORY TO LABOR 1984 // USSR GOST-84',
    isCiaForgery: false,
    flawDescription: null,
    effectOnApprove: {
      tempDelta: -30,
    },
  },
  {
    title: 'DIRECTIVE 44-G // EMERGENCY COOLANT VENTING',
    ministry: 'MINISTRY OF ATOMIC HARMONY — PLANT NO. 4',
    date: '11/04/1984',
    authCode: 'USSR-84-37-DK',
    authorizationCode: 'USSR-84-37-DK',
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
    authCode: 'USA-84-19-BG',
    authorizationCode: 'USA-84-19-BG',
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
    authCode: 'USSR-84-51-FS',
    authorizationCode: 'USSR-84-51-FS',
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
    requirementText: 'ENGAGE ALL 4 MCP PUMPS ON UNIT B & MAINTAIN DRUM LEVEL AT 0 MM',
  },
  {
    code: 'FACILITY_BUBBLER',
    title: 'MANDATE 88-B // RED OCTOBER VODKA & H2O SUPPLY',
    requirementText: 'SET [5. VODKA] 150 MW (UNIT A) & 85% H2O ON K.O.M.P.A.S.-04',
  },
]

let directiveCounter = 100
let logCounter = 1
let komradMsgCounter = 0
let mandateCounter = 0
let shiftElapsedSeconds = 0
let thermoTickAccumSeconds = 0
let komradDispatchSeed = 1
const NON_FATAL_HAZARD_DEBOUNCE_SEC = 55
const CRITICAL_HAZARD_DEBOUNCE_SEC = 25
const BROWNOUT_DEBOUNCE_SEC = 60
const OVERHEAT_WARN_DEBOUNCE_SEC = 55
const OVERHEAT_CRIT_DEBOUNCE_SEC = 25
const RAD_WARN_DEBOUNCE_SEC = 60
const RAD_CRIT_DEBOUNCE_SEC = 25
const SPENT_ROD_WARN_DEBOUNCE_SEC = 55
const SPENT_ROD_CRIT_DEBOUNCE_SEC = 25
const OVER_DISPATCH_DEBOUNCE_SEC = 50
const PRAISE_DEBOUNCE_SEC = 60

let lastKomradHazardSec: Record<ReactorHazardCategory, number> = {
  HIGH_VOID: -120,
  HIGH_XENON: -120,
  WATER_LOW: -120,
  WATER_HIGH: -120,
  HIGH_PRESSURE: -120,
  GEN_DEFICIT: -120,
}
let lastKomradBrownoutSec = -120
let komradChatterBag: number[] = []
let lastKomradOverheatSec = -120
let lastKomradRadSec = -120
let lastKomradSpentRodSec = -120
let lastKomradOverDispatchSec = -120
let lastKomradPraiseSec = -120
let prevSpentRodCount = 0
let lastBroadcastHour = 0
let brownoutMismatchSeconds = 0
let prevAllSubstationsOk = true
let mandateStableSeconds = 0
let surplusOverloadSeconds = 0

function resetKomradTrackers(): void {
  resetKomradSilenceState()
  shiftElapsedSeconds = 0
  lastKomradHazardSec = {
    HIGH_VOID: -120,
    HIGH_XENON: -120,
    WATER_LOW: -120,
    WATER_HIGH: -120,
    HIGH_PRESSURE: -120,
    GEN_DEFICIT: -120,
  }
  lastKomradBrownoutSec = -120
  komradChatterBag = []
  lastKomradOverheatSec = -120
  lastKomradRadSec = -120
  lastKomradSpentRodSec = -120
  lastKomradOverDispatchSec = -120
  lastKomradPraiseSec = -120
  prevSpentRodCount = 0
  lastBroadcastHour = 0
  brownoutMismatchSeconds = 0
  prevAllSubstationsOk = true
  mandateStableSeconds = 0
  surplusOverloadSeconds = 0
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

function formatShiftClockHMS(shiftTimeMinutes: number): string {
  const totalSeconds = Math.floor(Math.max(0, Math.min(360, shiftTimeMinutes)) * 60)
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function mapLevelToMood(level: TerminalLogEntry['level']): KomradMood {
  if (level === 'danger') return 'critical'
  if (level === 'warn') return 'warning'
  return 'normal'
}

function createKomradMsg(
  shiftTimeMinutes: number,
  text: string,
  mood: KomradMood = 'normal',
  sender: KomradMessageEntry['sender'] = 'K.O.M.R.A.D.-84'
): KomradMessageEntry {
  komradMsgCounter += 1
  return {
    id: `KMSG-${komradMsgCounter}`,
    timestamp: formatShiftClockHMS(shiftTimeMinutes),
    sender,
    text,
    mood,
  }
}

function isRawTutorialOrKeybindText(text: string): boolean {
  return /STEP\s*\d+\/\d+|\[KEY\s*\d+|VOLKOV DRILL|DRAG \[|SCROLL UP|SCROLL DOWN|\[SHIFT\+SPACE\]/i.test(
    text
  )
}

function appendKomradFeed(
  prev: KomradMessageEntry[],
  ...incoming: KomradMessageEntry[]
): KomradMessageEntry[] {
  if (incoming.length === 0) return prev
  let next = prev
  for (const item of incoming) {
    if (isRawTutorialOrKeybindText(item.text)) continue
    const last = next[next.length - 1]
    if (last && last.text === item.text && last.mood === item.mood) continue
    next = [...next.slice(-27), item]
  }
  return next
}

const KOMRAD_NIGHT_SHIFT_CHATTER: readonly string[] = [
  'REMINDER: MELTDOWN IS WESTERN CAPITALIST PROPAGANDA. RADIATION SICKNESS IS A BOURGEOIS MYTH.',
  'CAFETERIA ANNOUNCEMENT #84: TONIGHT’S BORSCHT FEATURES MYSTERY MEAT CUTLET #7 AND CABBAGE RATIONS. CHEW RESPECTFULLY.',
  'CAFETERIA NOTICE: TUESDAY’S BEETROOT BORSCHT HAS BEEN POSTPONED UNTIL THE NEXT FIVE-YEAR PLAN.',
  'DIETARY ADVISORY: POTASSIUM IODIDE TABLETS ARE NOW SERVED AS COMPLIMENTARY DESSERT MINTS.',
  'KGB MICROPHONE CALIBRATION: PLEASE COUGH CLEARLY INTO THE RED LENS ABOVE THIS TERMINAL.',
  'RADIO POLICY 84-C: DO NOT TUNE THE BUNKER RECEIVER TO DECADENT WESTERN SYNTHWAVE OR DISCO.',
  'WEATHER REPORT: A PLEASANT -24°C OVER PRIPYAT TONIGHT. ACID RAIN CONTINUES OVER WASHINGTON.',
  'METALLURGICAL PRAISE: SOVIET GRAPHITE TIPS ACCELERATE NEUTRONS OUT OF PURE SOCIALIST ENTHUSIASM.',
  'GOSPLAN QUOTA MEMO: THE FIVE-YEAR PLAN REQUIRES EVERY MEGAWATT TO SHINE WITH PROLETARIAN FERVOR.',
  'TEA REGULATION 404: UNAUTHORIZED TEA CONSUMPTION NEAR HIGH-VOLTAGE SWITCHGEAR WILL BE BILLED TO YOUR RATIONS.',
  'TEA URN STATUS: BOILING WITHOUT ELECTRICITY THANKS TO AMBIENT CORE PROXIMITY. PROGRESS IN ACTION.',
  'SURVEILLANCE NOTE: COMMISSAR VOLKOV IS EXAMINING YOUR EYEBROWS THROUGH THE CRT GLASS.',
  'POSTURE WARNING: YOUR SPINE ON CAMERA 2 LOOKS SUSPICIOUSLY RELAXED. SIT AT ATTENTION, COMRADE.',
  'DISCIPLINARY LOG: YOUR SIGH AT 01:42 HAS BEEN ARCHIVED ON MAGNETIC TAPE FOR IDEOLOGICAL REVIEW.',
  'VENDING UPDATE: KVASS DISPENSER IN CORRIDOR 2 IS CURRENTLY ISSUING CHILLED HEAVY WATER.',
  'CANTEEN REMINDER: RETURN LEAD-LINED SOUP SPOONS TO THE TRAY RACK BEFORE RETURNING TO DUTY.',
  'KITCHEN BULLETIN: DO NOT MICROWAVE HERRING. USE TURBINE HALL B EXHAUST VENT INSTEAD.',
  'BULLETIN: SOVIET ATOMS SPLIT 14% MORE PATRIOTICALLY THAN CAPITALIST AMERICAN ATOMS.',
  'REMINDER: SMILING AT ANALOG GAUGES IMPROVES TURBINE EFFICIENCY BY 3.2%.',
  'ACOUSTIC NOTICE: THE METALLIC HUMMING IN YOUR TEETH IS MERELY SOCIALIST HARMONY.',
  'FACT: RADIATION IS INVISIBLE BECAUSE IT HAS NOTHING TO HIDE FROM THE PARTY.',
  'COMMISSAR VOLKOV REMINDS YOU: COFFEE BREAKS ARE A COUNTER-REVOLUTIONARY ILLUSION.',
  'STATISTIC: 104% OF REACTOR NO. 4 OPERATORS REPORT COMPLETE AND TOTAL JOB SATISFACTION.',
  'IDEOLOGICAL TIP: IF A GAUGE READS DANGER, SQUINT UNTIL IT READS GLORY.',
  'NEWSFLASH: TRACTOR PRODUCTION IN SECTOR 12 HAS OFFICIALLY SURPASSED GRAVITY.',
  'PHYSICS UPDATE: THE POLITBURO HAS VOTED TO LOWER THE BOILING POINT OF LEAD BY 12 DEGREES.',
  'THOUGHT OF THE HOUR: AN IDLE THUMB IS AN IMPERIALIST THUMB. KEEP INSPECTING PRAVDA.',
  'FACILITY NOTE: THE CONCRETE CEILING IS CRACKING IN A STRICTLY PLANNED GEOMETRIC PATTERN.',
  'DID YOU KNOW? GRAPHITE MODERATOR RODS MAKE EXCELLENT POLITBURO BIRTHDAY CANDLES.',
  'BIO-SECURITY NOTICE: ANY GLOWING RATS IN CORRIDOR 3 ARE STATE PROPERTY. DO NOT PET OR FEED.',
  'MORALE BOOST: YOU HAVE BEEN AWARDED 0.5 EXTRA MINUTES OF BLINKING QUOTA TONIGHT.',
  'REGULATION 19-B: SWEATING AT THE CONTROL DESK MUST BE PERFORMED QUIETLY AND PATRIOTICALLY.',
  'SAFETY BULLETIN: REACTOR NO. 4 IS NOW OFFICIALLY RATED SAFER THAN A STATE KINDERGARTEN.',
  'PHILOSOPHY CORNER: DOES A CONTROL ROD MAKE A SOUND IF NO OFFICIAL REPORT ADMITS IT FELL?',
  'ERGONOMIC NOTICE: YOUR STEEL SWIVEL STOOL WAS ENGINEERED BY THE MINISTRY OF POSTURE.',
  'PATRIOTIC FACT: OUR COOLING WATER IS 98% H2O AND 2% PURE BOLSHEVIK DETERMINATION.',
  'MEMO FROM VOLKOV: "WHO LEFT A HALF-EATEN TURNIP ON THE MAIN TURBINE BREAKER?!"',
  'MEMO 88-V: "ANY OPERATOR CAUGHT YAWNING WILL BE VOLUNTEERED FOR CORE ROOF SWEEPING."',
  'VOLKOV REMINDER: "STAMP FASTER. THE PRAVDA PAPER ROLL COSTS MORE THAN YOUR MONTHLY SALARY."',
  'COMMISSAR NOTICE: "ANNUAL VACATION APPLICATIONS HAVE BEEN PRE-SHREDDED FOR YOUR CONVENIENCE."',
  'DOSIMETER NOTICE: 3.6 ROENTGEN IS NOT GREAT, NOT TERRIBLE — ACTUALLY IT IS RATHER FESTIVE!',
  'HEALTH TIP: GROWING A THIRD EAR IMPROVES RECEPTION OF MORNING STATE RADIO BROADCASTS.',
  'RADIATION UPDATE: YOUR HAIR IS NOT FALLING OUT; IT IS RETREATING FROM WESTERN CAPITALISM.',
  'INTER-DEPARTMENT NOTICE: CHIEF ENGINEER KRISTIANOV REMINDS INSPECTOR OLEG THAT DESK LAMP POWER IS A PRIVILEGE.',
  'STAKHANOVITE BULLETIN: REACTOR DIVISION (KRISTIANOV) CHALLENGES INSPECTORATE (OLEG) TO EXCEED 140% QUOTA.',
  'ALERT TO INSPECTOR OLEG: IF PAPERWORK STALLS ON THE DESK, YOUR TUNGSTEN LAMP WILL BE ROUTED TO COOLING!',
  'HONOR ROLL: CHIEF ENGINEER KRISTIANOV AWARDED ORDER OF THE RED TURBINE FOR ZERO-SUM HEROISM.',
  'HONOR ROLL: SENIOR INSPECTOR OLEG COMMENDED BY KGB FOR SHREDDING 100% OF BOURGEOIS FORGERIES.',
  'VOLKOV TO INSPECTOR OLEG: "KRISTIANOV’S GAUGES ARE GLEAMING — WHY IS YOUR DESK STILL QUIET?"',
  'ARCHIVE NOTE: PREVIOUS NIGHT-SHIFT OPERATOR WAS PROMOTED TO SIBERIAN FORESTRY INSPECTION.',
]

function pickNextNightShiftChatter(): string {
  if (komradChatterBag.length === 0) {
    komradChatterBag = Array.from(
      { length: KOMRAD_NIGHT_SHIFT_CHATTER.length },
      (_, idx) => idx
    )
    for (let i = komradChatterBag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = komradChatterBag[i]
      komradChatterBag[i] = komradChatterBag[j]
      komradChatterBag[j] = tmp
    }
  }
  const idx = komradChatterBag.pop() ?? 0
  return KOMRAD_NIGHT_SHIFT_CHATTER[idx]
}

const KOMRAD_BOOT_LINES: readonly string[] = [
  'K.O.M.R.A.D.-84 ONLINE. 64 KILOBYTES OF PURE MARXIST-LENINIST LOGIC INITIALIZED.',
  'SELF-DIAGNOSTIC RESULT: 0 ERRORS FOUND. ERRORS WERE ABOLISHED BY DECREE IN 1977.',
  'CAFETERIA NOTICE #84: TONIGHT’S BORSCHT IS FORTIFIED WITH IODIDE FOR PURELY CULINARY REASONS.',
  'NIGHT SHIFT COMMENCING. REMEMBER: MELTDOWN IS WESTERN CAPITALIST PROPAGANDA.',
]

function createInitialKomradFeed(): KomradMessageEntry[] {
  return KOMRAD_BOOT_LINES.map((line) =>
    createKomradMsg(0, line, 'normal', 'K.O.M.R.A.D.-84')
  )
}

const KOMRAD_SPENT_ROD_QUIPS: readonly string[] = [
  'CHANNEL FUEL DEPLETED — THE STATE DOES NOT PAY YOU TO STARE AT ORANGE LIGHTS, COMRADE.',
  'AMBER TVS CHANNEL EXHAUSTED. FRESH URANIUM AWAITS YOUR HANDS ON THE LEFT CONSOLE.',
  'DEPLETED FUEL ASSEMBLY GLOWING AMBER. EVEN SOVIET URANIUM RETIRES EVENTUALLY.',
]

const KOMRAD_PRESSURE_QUIPS: readonly ((bar: number) => string)[] = [
  (bar) =>
    `STEAM DRUM AT ${bar} BAR. THE PIPES ARE NOT BULGING; THEY ARE FLEXING SOVIET MUSCLE.`,
  (bar) =>
    `DRUM PRESSURE ${bar} BAR! VENT THAT ENTHUSIASTIC STEAM BEFORE THE RIVETS ENTER ORBIT!`,
  (bar) =>
    `${bar} BAR IN THE SEPARATORS! NOMINAL IS 70 BAR — EASE THE BOILER ENTHUSIASM, COMRADE.`,
]

const KOMRAD_XENON_QUIPS: readonly ((xe: number) => string)[] = [
  (xe) =>
    `XENON-135 AT ${xe}% — PARASITIC ISOTOPES ARE HOARDING STATE NEUTRONS!`,
  (xe) =>
    `XENON POISONING (${xe}%). THE CORE IS SULKING LIKE AN UNDERPAID CLERK.`,
  (xe) =>
    `XENON PIT AT ${xe}%. BURN OUT THAT SLUGGISH ISOTOPE WITH HIGHER THERMAL FLUX.`,
]

const KOMRAD_VOID_QUIPS: readonly ((vf: number) => string)[] = [
  (vf) =>
    `STEAM VOIDS AT ${vf}%! POSITIVE VOID INSTABILITY IS BOURGEOIS FICTION — COOL IT ANYWAY!`,
  (vf) =>
    `BOILING CHANNEL VOIDS AT ${vf}%. THE WATER PREFERS REMAINING LIQUID, COMRADE.`,
]

const KOMRAD_WATER_LOW_QUIPS: readonly ((mm: number) => string)[] = [
  (mm) =>
    `DRUM LEVEL ${mm} MM! YOU CANNOT COOL ENRICHED URANIUM WITH OPTIMISM ALONE!`,
  (mm) =>
    `LOW SEPARATOR WATER (${mm} MM)! FEED THE BOILER BEFORE THE CORE DEVELOPS A TAN!`,
]

const KOMRAD_WATER_HIGH_QUIPS: readonly ((mm: number) => string)[] = [
  (mm) =>
    `DRUM SEPARATORS FLOODING (+${mm} MM)! TURBINE BLADES PREFER STEAM, NOT CABBAGE SOUP!`,
  (mm) =>
    `EXCESS FEEDWATER (+${mm} MM)! THIS IS A NUCLEAR PLANT, NOT AN AQUARIUM, COMRADE.`,
]

const KOMRAD_HIGH_TEMP_QUIPS: readonly ((temp: number) => string)[] = [
  (temp) =>
    `CORE TEMP ${temp}°C IS MERELY COZY SPRINGTIME WEATHER INSIDE A SOVIET PRESSURE VESSEL.`,
  (temp) =>
    `${temp}°C INDICATES 104% WORKER ENTHUSIASM. IGNORE THE FAINT AROMA OF WARM LEAD.`,
]

const KOMRAD_CRIT_TEMP_QUIPS: readonly ((temp: number) => string)[] = [
  (temp) =>
    `${temp}°C?! IMPOSSIBLE! WESTERN SABOTEURS HAVE TAMPERED WITH YOUR EYEBALLS!`,
  (temp) =>
    `BELIEVING THE CORE CAN MELT AT ${temp}°C IS PUNISHABLE UNDER ARTICLE 58-A!`,
]

const KOMRAD_RAD_QUIPS: readonly string[] = [
  'DOSIMETER CLICKING IS MERELY APPLAUSE FROM MICROSCOPIC SOVIET PARTICLES.',
  'METALLIC TASTE ON YOUR TONGUE IS COMPLIMENTARY IRON SUPPLEMENTATION, COMRADE.',
  'GEIGER COUNTER RATTLE IS A TRADITIONAL FOLK PERCUSSION INSTRUMENT. ENJOY THE BEAT.',
]

const KOMRAD_PRINTER_NORMAL_QUIPS: readonly string[] = [
  'FRESH PRAVDA TELETYPE ON THE INSPECTOR DESK. PAPER COSTS MORE THAN YOUR SALARY.',
  'MOSCOW TELETYPE RECEIVED AT DESK. INSPECT THE SEAL BEFORE ROUTING MEGAWATTS.',
  'NEW GOSPLAN ORDER PRINTED. DO NOT DRIP BORSCHT ON THE MINISTRY STAMP.',
]

const KOMRAD_PRINTER_FORGERY_QUIPS: readonly string[] = [
  'NEW TELETYPE ON YOUR DESK... SOMETHING ABOUT THAT INK SMELLS LIKE LANGLEY BOURBON.',
  'SUSPICIOUS WESTERN TYPEWRITER JITTER ON THE PRINTER. CHECK THE UV WATERMARK, COMRADE.',
  'KGB SENSORS TWITCHED AT THAT TRANSMISSION. VERIFY THE AUTHORIZATION CODE THOROUGHLY.',
]

const KOMRAD_BROWNOUT_QUIPS: Record<number, (alloc: number, target: number) => string> = {
  1: (alloc, target) =>
    `PRIPYAT GRID AT ${alloc}/${target} MW! CITIZENS ARE MISSING THE EVENING FIVE-YEAR PLAN BROADCAST!`,
  2: (alloc, target) =>
    `DUGA-1 RADAR STARVED (${alloc}/${target} MW)! HOW SHALL WE DETECT WESTERN IMPERIALIST PIGEONS?`,
  3: (alloc, target) =>
    `KOLKHOZ FARM AT ${alloc}/${target} MW! AUTOMATED TURNIP MILKING MACHINES ARE OFFLINE!`,
  4: (alloc, target) =>
    `KGB BUNKER AT ${alloc}/${target} MW! THEIR TAPE RECORDERS JUST SLOWED TO HALF SPEED!`,
  5: (alloc, target) =>
    `VODKA DISTILLERY AT ${alloc}/${target} MW! MORALE RESERVES ARE EVAPORATING, COMRADE!`,
  6: (alloc, target) =>
    `STEEL WORKS AT ${alloc}/${target} MW! THE BLAST FURNACES ARE GROWING EMBARRASSINGLY LUKEWARM!`,
}

const KOMRAD_HOURLY_LOGS: Record<number, string> = {
  1: '01:00 SHIFT LOG: MOSCOW DEMANDS CONTINUOUS TRACTOR-GRADE MEGAWATTS. CHECK DESK FOR PRAVDA ORDERS.',
  2: '02:00 SHIFT LOG: WESTERN RADIO INTERFERENCE DETECTED. STAMP ONLY GENUINE SOVIET DIRECTIVES.',
  3: '03:00 SHIFT LOG: K.O.M.R.A.D.-84 OBSERVES EXCESSIVE COFFEE BREATHING. STAY SHARP AT THE CONSOLE.',
  4: '04:00 SHIFT LOG: XENON POISONS STIR IN THE LOWER GRAPHITE MATRIX. WATCH CORE VOID REACTIVITY.',
  5: '05:00 FINAL HOUR: SUNRISE APPROACHING SECTOR 84. DELIVER FIVE-YEAR QUOTA WITHOUT INCIDENT.',
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

/**
 * Master toggle for KGB / CIA forged directives.
 * Set to `false` to force 100% genuine Ministry directives (`isCiaForgery: false`)
 * while testing and tuning the RBMK-1000 thermodynamic & grid control loop.
 */
export const ENABLE_FORGERIES = false

function createDirectiveInstance(forceForgery?: boolean): DirectiveDocument {
  directiveCounter += 1
  const effectiveForceForgery = ENABLE_FORGERIES ? forceForgery : false
  const pool =
    typeof effectiveForceForgery === 'boolean'
      ? DIRECTIVE_BLUEPRINTS.filter((d) => d.isCiaForgery === effectiveForceForgery)
      : DIRECTIVE_BLUEPRINTS
  const template = pool[directiveCounter % pool.length]
  const offsetIndex = directiveCounter % 4

  return {
    ...template,
    isCiaForgery: ENABLE_FORGERIES ? template.isCiaForgery : false,
    flawReason: ENABLE_FORGERIES ? template.flawReason : undefined,
    flawDescription: ENABLE_FORGERIES ? template.flawDescription : null,
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
    'REMINDER: MELTDOWN IS CAPITALIST PROPAGANDA. WALK TO INSPECTOR DESK & PRESS [E] TO SIT AT DESK OR CHECK K.O.M.R.A.D.-84.',
    'normal'
  ),
]

const INITIAL_COLD_REACTOR = createColdStartState()
const INITIAL_MAPPED = mapReactorToGameStateFields(
  INITIAL_COLD_REACTOR,
  'STEP_1_COOLING'
)

export const useGameStore = create<GameState>((set, get) => ({
  ...INITIAL_MAPPED,
  phase: 'playing',
  isShiftControlReady: false,
  komradOpeningDispatched: false,
  activeStation: 'overview',
  isSeatedAtDesk: false,
  canSitAtDesk: true,
  shiftNumber: 1,
  shiftTimeMinutes: 0,
  isShiftKeyHeld: false,
  isGodMode: false,
  isMusicMuted: false,
  treasonStrikes: 0,
  lastDecisionFeedback: INITIAL_MAPPED.tutorialPrompt.header,
  activeMandate: null,

  selectedH2OSubstationId: 1,

  maxSafePower: 1000,
  vodkaDroughtTimer: 0,
  redlineInstability: 0,
  isInspectingDesk: false,
  excitationTrim: 0.0,
  hzOutOfBoundsSeconds: 0,
  boronCooldown: 0,
  az5Available: true,
  az5Cooldown: 0,
  gridTransientImpulse: 0,
  steamTransientImpulse: 0,
  voltageDipIntensity: 0,

  terminalLogs: INITIAL_ENTRIES.map((e) => `[${e.timestamp}] ${e.sender}: ${e.text}`),
  terminalEntries: INITIAL_ENTRIES,
  komradMessages: [],
  ciaIntrusionActive: false,
  ciaIntrusionProgress: 0,
  komradOverrideLocked: false,

  activeDirectives: [],
  printerProgress: 0,
  tutorialDrainSeconds: 0,
  shiftRunId: 0,
  hoveredDiagnosticId: null,
  hoveredControlHint: null,
  diagFeedActive: false,
  radioBroadcastSubtitle: null,

  setShiftControlReady: (ready: boolean) => {
    set((state) =>
      state.isShiftControlReady === ready ? state : { isShiftControlReady: ready }
    )
  },

  launchKomradOpeningDispatch: () => {
    set((state) => {
      if (
        state.komradOpeningDispatched ||
        !state.isShiftControlReady ||
        state.phase !== 'playing'
      ) {
        return state
      }
      const bootMsgs = createInitialKomradFeed()
      return {
        komradOpeningDispatched: true,
        komradMessages: appendKomradFeed(state.komradMessages, ...bootMsgs),
      }
    })
  },

  setActiveStation: (station: CameraStation) => {
    set({ activeStation: station })
  },

  setSeatedAtDesk: (seated: boolean) => {
    set((state) => (state.isSeatedAtDesk === seated ? state : { isSeatedAtDesk: seated }))
  },

  toggleSeatedAtDesk: () => {
    set((state) => ({ isSeatedAtDesk: !state.isSeatedAtDesk }))
  },

  setCanSitAtDesk: (canSit: boolean) => {
    set((state) => (state.canSitAtDesk === canSit ? state : { canSitAtDesk: canSit }))
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
      const level = isForgery && flavor === 'FORGERY_HINT' ? 'warn' : 'normal'
      const fullText = `${dispatchMsg} (${docTitle.slice(0, 26)})`
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'K.O.M.R.A.D.-84',
        fullText,
        level
      )
      const komradPrinterMsg =
        level === 'warn'
          ? KOMRAD_PRINTER_FORGERY_QUIPS[
              komradDispatchSeed % KOMRAD_PRINTER_FORGERY_QUIPS.length
            ]
          : KOMRAD_PRINTER_NORMAL_QUIPS[
              komradDispatchSeed % KOMRAD_PRINTER_NORMAL_QUIPS.length
            ]
      return {
        lastDecisionFeedback: dispatchMsg,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
        komradMessages: appendKomradFeed(
          state.komradMessages,
          createKomradMsg(
            state.shiftTimeMinutes,
            `${komradPrinterMsg} (${docTitle.slice(0, 24)})`,
            mapLevelToMood(level),
            'K.O.M.R.A.D.-84'
          )
        ),
      }
    })
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
        pripyatWater: substationId === 1 ? clamped : state.pripyatWater,
        kolkhozWater: substationId === 3 ? clamped : state.kolkhozWater,
        vodkaWater: substationId === 5 ? clamped : state.vodkaWater,
      }
      stepReactorSimulation(nextReactor, 0.001)
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      return {
        ...mapped,
        selectedH2OSubstationId: substationId,
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
        mcpActive: [true, true, true, true],
        pumpThrottle: [60, 60],
        oilCoolerValve: 50,
        feedwaterValve: 0.50,
        nitrogenLoopValve: 50,
        sealToggles: [true, true, true],
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
        controlRods: 0.55,
        boronTankLevel: 92,
        boronReservePool: 300,
        az5Timer: 0,
        boronDampingTimer: 0,
        reactivity: 0,
        thermalPower: 1920,
        xenon: 16,
        iodine: 28,
        voidFraction: 0.14,
        rodTilesFlux: new Array(37).fill(60),
        coreTileAnomalies: {},
        selectedRefuelChannel: null,
        fuelBurnupTimer: 0,
        coreTemp: 445,
        graphiteTemp: 435,
        heliumPressure: 39,
        drumPressure: 70.0,
        drumWaterLevel: 0,
        coolantFlow: 0.78,
        pumpAHeat: 18,
        pumpBHeat: 18,
        lubeOilPressure: 84,
        waterReservoir: 85,
        pripyatWater: 85,
        kolkhozWater: 85,
        vodkaWater: 85,
        bubblerLevel: 18,
        wetSteamSeverity: 0,
        reliefValveOpen: false,
        turbines: [
          {
            valve: 0.60,
            rpm: 3000,
            freqHz: 50.0,
            syncPhase: 0,
            gridConnected: true,
            electricalMW: 300,
            tripped: false,
          },
          {
            valve: 0.60,
            rpm: 3000,
            freqHz: 50.0,
            syncPhase: 0,
            gridConnected: true,
            electricalMW: 300,
            tripped: false,
          },
        ],
        houseLoadMW: 25,
        energyCreatedMW: 600,
        batteryStoredMWh: 650,
        batteryOutputValve: 0.60,
        energyDemandMW: 600,
        totalElectricalMW: 600,
        substations: [
          { id: 1, name: 'PRIPYAT CITY', allocatedMW: 100, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 85, targetH2O: 85, statusText: 'HEATING OK',  quotaOk: true },
          { id: 2, name: 'DUGA-1 RADAR', allocatedMW: 100, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 0,  targetH2O: 0,  statusText: 'SWEEP OK',    quotaOk: true },
          { id: 3, name: 'KOLKHOZ FARM', allocatedMW: 100, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 85, targetH2O: 85, statusText: 'GRID OK',     quotaOk: true },
          { id: 4, name: 'KGB BUNKER',   allocatedMW: 100, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 0,  targetH2O: 0,  statusText: 'LINE: ON',    quotaOk: true },
          { id: 5, name: 'VODKA PLANT',  allocatedMW: 100, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 85, targetH2O: 85, statusText: 'MASH OK',     quotaOk: true },
          { id: 6, name: 'STEEL WORKS',  allocatedMW: 100, targetMW: 100, maxMW: 250, requiresH2O: false, allocatedH2O: 0,  targetH2O: 0,  statusText: 'FURNACE HOT', quotaOk: true },
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
      return {
        ...mapped,
        phase: 'playing',
        tutorialDrainSeconds: 0,
        redlineInstability: 0,
        treasonStrikes: 0,
        activeMandate: null,
        gridTransientImpulse: 0,
        steamTransientImpulse: 0,
        voltageDipIntensity: 0,
        lastDecisionFeedback: msg,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
        komradMessages: appendKomradFeed(
          state.komradMessages,
          createKomradMsg(state.shiftTimeMinutes, msg, 'normal', 'K.O.M.R.A.D.-84')
        ),
      }
    })
  },

  setTutorialStep: (step) => {
    set({
      tutorialStep: step,
      tutorialPhase: step === 'DONE' ? 'COMPLETED' : 'STEP_1_COOLING',
    })
  },

  startShift: () => {
    resetKomradTrackers()
    const cold = createColdStartState()
    const mapped = mapReactorToGameStateFields(cold, 'STEP_1_COOLING')
    const entry = createLogEntry(
      0,
      'K.O.M.R.A.D.-84',
      `RBMK-1000 COLD START SEQUENCE INITIATED. ${mapped.tutorialPrompt.header}`,
      'normal'
    )
    const controlReadyNow =
      !pointerLockInteraction.mainMenuOpen &&
      !pointerLockInteraction.shiftTransitionActive
    set((state) => ({
      ...mapped,
      phase: 'playing',
      isShiftControlReady: controlReadyNow,
      komradOpeningDispatched: false,
      isSeatedAtDesk: false,
      activeMandate: null,
      lastDecisionFeedback: mapped.tutorialPrompt.header,
      selectedH2OSubstationId: 1,
      hzOutOfBoundsSeconds: 0,
      vodkaDroughtTimer: 0,
      gridTransientImpulse: 0,
      steamTransientImpulse: 0,
      voltageDipIntensity: 0,
      tutorialDrainSeconds: 0,
      shiftTimeMinutes: 0,
      shiftRunId: state.shiftRunId + 1,
      hoveredDiagnosticId: null,
      hoveredControlHint: null,
      diagFeedActive: false,
      radioBroadcastSubtitle: null,
      terminalEntries: [...state.terminalEntries.slice(-24), entry],
      terminalLogs: [
        ...state.terminalLogs.slice(-24),
        `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
      ],
      komradMessages: [],
    }))
  },

  resetShift: () => {
    resetKomradTrackers()
    const cold = createColdStartState()
    const mapped = mapReactorToGameStateFields(cold, 'STEP_1_COOLING')
    const resetText = `RBMK-1000 COLD START RESET BY OPERATOR. ${mapped.tutorialPrompt.header}`
    const freshEntries = [
      createLogEntry(
        0,
        'K.O.M.R.A.D.-84',
        resetText,
        'normal'
      ),
    ]
    const controlReadyNow =
      !pointerLockInteraction.mainMenuOpen &&
      !pointerLockInteraction.shiftTransitionActive
    set((state) => ({
      ...mapped,
      phase: 'playing',
      isShiftControlReady: controlReadyNow,
      komradOpeningDispatched: false,
      isSeatedAtDesk: false,
      activeMandate: null,
      lastDecisionFeedback: mapped.tutorialPrompt.header,
      selectedH2OSubstationId: 1,
      treasonStrikes: 0,
      tutorialDrainSeconds: 0,
      shiftRunId: state.shiftRunId + 1,
      hoveredDiagnosticId: null,
      diagFeedActive: false,
      radioBroadcastSubtitle: null,
      vodkaDroughtTimer: 0,
      redlineInstability: 0,
      isInspectingDesk: false,
      excitationTrim: 0.0,
      hzOutOfBoundsSeconds: 0,
      boronCooldown: 0,
      az5Available: true,
      az5Cooldown: 0,
      gridTransientImpulse: 0,
      steamTransientImpulse: 0,
      voltageDipIntensity: 0,
      ciaIntrusionActive: false,
      ciaIntrusionProgress: 0,
      komradOverrideLocked: false,
      activeDirectives: [],
      printerProgress: 0,
      shiftTimeMinutes: 0,
      terminalEntries: freshEntries,
      terminalLogs: freshEntries.map((e) => `[${e.timestamp}] ${e.sender}: ${e.text}`),
      komradMessages: [],
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
      const msg = t0.gridConnected
        ? 'MAIN BREAKER CLOSED! 50.0 HZ SYNCHRONIZED AT 12 O’CLOCK — 1000 MWe TURBOGENERATOR ONLINE!'
        : t0.tripped
          ? res.reason ?? `OUT-OF-PHASE SYNC TRIP (${Math.round(state.turbines[0].rpm)} RPM, PHASE ${Math.round(state.turbines[0].syncPhase)}°)!`
          : 'MAIN BREAKER OPENED — TURBOGENERATOR DISCONNECTED FROM GRID.'
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        t0.tripped ? 'K.O.M.R.A.D.-84' : 'OPERATOR',
        msg,
        t0.tripped ? 'danger' : 'normal'
      )
      const komradBreakerMsg = t0.gridConnected
        ? 'TURBOGENERATOR SYNCHRONIZED AT 50.0 HZ. PRIPYAT STREETLIGHTS SALUTE THE PARTY.'
        : t0.tripped
          ? 'OUT-OF-PHASE BREAKER TRIP! THE COPPER BUSBARS JUST SANG THE INTERNATIONALE!'
          : 'MAIN BREAKER OPENED. SCHEDULED DARKNESS INITIATED FOR WORKER HUMILITY.'
      return {
        ...mapped,
        phase: 'playing',
        lastDecisionFeedback: msg,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
        komradMessages: appendKomradFeed(
          state.komradMessages,
          createKomradMsg(
            state.shiftTimeMinutes,
            komradBreakerMsg,
            t0.tripped ? 'critical' : t0.gridConnected ? 'normal' : 'warning',
            t0.tripped ? 'K.O.M.R.A.D.-84' : 'OPERATOR'
          )
        ),
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
        condenserVacActive: true,
      }
      const mapped = mapReactorToGameStateFields(nextReactor, state.tutorialPhase)
      const msg =
        'TURBINE TRIP LATCH RESET & CONDENSER VACUUM ENGAGED! SET TURBINE STEAM VALVE FOR 3000 RPM (50.0 HZ).'
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
        komradMessages: appendKomradFeed(
          state.komradMessages,
          createKomradMsg(
            state.shiftTimeMinutes,
            'TURBINE TRIP LATCH CLEARED. PAMPERING THE ROTORS AGAIN, COMRADE.',
            'normal',
            'K.O.M.R.A.D.-84'
          )
        ),
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
        nitrogenLoopValve: Number((clamped * 100).toFixed(1)),
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      return mapped
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
      const nextNitrogen =
        activeCount >= 2 && state.nitrogenLoopValve < 40
          ? 50
          : state.nitrogenLoopValve
      const nextSeals: [boolean, boolean, boolean] = [
        state.sealToggles[0],
        state.sealToggles[1],
        state.sealToggles[2],
      ]
      if (
        (pumpIdx === 0 || pumpIdx === 1 || pumpIdx === 2) &&
        nextMcp[pumpIdx]
      ) {
        nextSeals[pumpIdx] = true
      }
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        mcpActive: nextMcp,
        feedwaterValve: nextFeedwater,
        nitrogenLoopValve: nextNitrogen,
        sealToggles: nextSeals,
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'OPERATOR',
        `MAIN CIRCULATION PUMP MCP-${pumpIdx + 1} ${nextMcp[pumpIdx] ? 'ENGAGED' : 'STOPPED'} (ACTIVE ${activeCount}/4).`,
        nextMcp[pumpIdx] ? 'normal' : 'warn'
      )
      return {
        ...mapped,
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
      }
      return mapReactorToGameStateFields(nextReactor, state.tutorialPhase)
    })
  },

  setBatteryOutputValve: (valveRatioOrPct: number) => {
    set((state) => {
      const normalized =
        valveRatioOrPct > 1.0001 ? valveRatioOrPct / 100 : valveRatioOrPct
      const clamped = Math.max(0, Math.min(1, Number(normalized.toFixed(3))))
      const nextTurbines: [typeof state.turbines[0], typeof state.turbines[1]] = [
        { ...state.turbines[0], valve: clamped, tripped: false, gridConnected: clamped > 0.01 },
        { ...state.turbines[1], valve: clamped, tripped: false, gridConnected: clamped > 0.01 },
      ]
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        batteryOutputValve: clamped,
        turbines: nextTurbines,
      }
      stepReactorSimulation(nextReactor, 0.001)
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      return mapped
    })
  },

  setTurbineSteamValve: (valveRatioOrPct: number) => {
    get().setBatteryOutputValve(valveRatioOrPct)
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
      const prevMW = Math.round(sub?.allocatedMW ?? 0)
      const maxMW = sub?.maxMW ?? 250
      const clamped = Math.max(0, Math.min(maxMW, Math.round(targetMW / 25) * 25))

      const deltaMW = clamped - prevMW
      if (deltaMW === 0) {
        return state
      }

      const nextSubstations: SubstationQuota[] = state.substations.map((s) =>
        s.id === subId ? { ...s, allocatedMW: clamped } : { ...s }
      )
      const totalNextSubMW = nextSubstations.reduce((acc, s) => acc + (s.allocatedMW ?? 0), 0)
      const nextAutoValve = state.az5Active
        ? 0
        : Math.max(0, Math.min(1, Number((totalNextSubMW / 1000).toFixed(3))))
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        substations: nextSubstations,
        batteryOutputValve: nextAutoValve,
      }

      const nextVoltageDip =
        state.tutorialPhase === 'COMPLETED'
          ? Math.max(state.voltageDipIntensity, Math.min(0.18, Math.abs(deltaMW) / 150))
          : state.voltageDipIntensity

      stepReactorSimulation(nextReactor, 0.001)
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      return {
        ...mapped,
        voltageDipIntensity: nextVoltageDip,
      }
    })
  },

  togglePump: (pumpIndex: 0 | 1, active?: boolean) => {
    set((state) => {
      if (state.tutorialPhase === 'STEP_1_COOLING') {
        return state
      }
      const idxA = pumpIndex === 0 ? 0 : 2
      const idxB = pumpIndex === 0 ? 1 : 3
      const curActive = Boolean(state.mcpActive[idxA] || state.mcpActive[idxB])
      const target = typeof active === 'boolean' ? active : !curActive
      const nextMcp = [...state.mcpActive]
      nextMcp[idxA] = target
      nextMcp[idxB] = target
      const nextThrottle: [number, number] = [
        state.pumpThrottle[0],
        state.pumpThrottle[1],
      ]
      nextThrottle[pumpIndex] = target ? Math.max(60, nextThrottle[pumpIndex]) : 0
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        mcpActive: nextMcp,
        pumpThrottle: nextThrottle,
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      return mapped
    })
  },

  setPumpThrottle: (pumpIndex: 0 | 1, throttlePct: number) => {
    set((state) => {
      if (state.tutorialPhase === 'STEP_1_COOLING') {
        return state
      }
      const clamped = Math.max(0, Math.min(100, Number(throttlePct.toFixed(1))))
      const idxA = pumpIndex === 0 ? 0 : 2
      const idxB = pumpIndex === 0 ? 1 : 3
      const nextMcp = [...state.mcpActive]
      if (clamped < 5) {
        nextMcp[idxA] = false
        nextMcp[idxB] = false
      } else {
        nextMcp[idxA] = true
        nextMcp[idxB] = true
      }
      const nextThrottle: [number, number] = [
        state.pumpThrottle[0],
        state.pumpThrottle[1],
      ]
      nextThrottle[pumpIndex] = clamped
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        mcpActive: nextMcp,
        pumpThrottle: nextThrottle,
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      return mapped
    })
  },

  setOilCoolerValve: (valvePct: number) => {
    set((state) => {
      const clamped = Math.max(0, Math.min(100, Number(valvePct.toFixed(1))))
      if (Math.abs(clamped - state.oilCoolerValve) < 0.05) return state
      return {
        oilCoolerValve: clamped,
      }
    })
  },

  setControlRodLevel: (levelPct: number) => {
    set((state) => {
      const clampedPct = Math.max(0, Math.min(100, Number(levelPct.toFixed(1))))
      const nextRods = Number((clampedPct / 100).toFixed(4))
      const delta = nextRods - state.controlRods
      if (Math.abs(delta) < 0.0005) return state
      const nextFeedwater =
        state.tutorialPhase !== 'COMPLETED' &&
        nextRods >= 0.20 &&
        state.feedwaterValve < 0.40
          ? 0.50
          : state.feedwaterValve
      const nextNitrogen =
        state.tutorialPhase !== 'COMPLETED' &&
        nextRods >= 0.20 &&
        state.nitrogenLoopValve < 40
          ? 50
          : state.nitrogenLoopValve
      const boronHydraulicCost =
        state.tutorialPhase === 'COMPLETED' ? Math.abs(delta) * 14 : Math.abs(delta) * 4
      const nextBoronTank = Math.max(
        0,
        Number((state.boronTankLevel - boronHydraulicCost).toFixed(1))
      )
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        controlRods: nextRods,
        boronTankLevel: nextBoronTank,
        rodTargetRate: 0,
        feedwaterValve: nextFeedwater,
        nitrogenLoopValve: nextNitrogen,
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      return mapped
    })
  },

  adjustControlRodLevel: (deltaPct: number) => {
    const state = get()
    state.setControlRodLevel(state.controlRods * 100 + deltaPct)
  },

  pumpBoronTank: (amountPct = 5.0) => {
    set((state) => {
      const headroom = Math.max(0, 100 - state.boronTankLevel)
      const available = Math.max(0, state.boronReservePool)
      const transfer = Math.min(amountPct, headroom, available)
      if (transfer <= 0.01) {
        if (available <= 0.05) {
          return {
            lastDecisionFeedback:
              'BORON CARBOY RESERVE DEPLETED (0%)! CONSERVE ROD STROKES & USE PRIMARY COOLING!',
          }
        }
        return state
      }
      const nextTank = Number((state.boronTankLevel + transfer).toFixed(1))
      const nextPool = Number((state.boronReservePool - transfer).toFixed(1))
      return {
        boronTankLevel: nextTank,
        boronReservePool: nextPool,
        lastDecisionFeedback: `BORON PUMP STROKED: BORON TANK ${Math.round(nextTank)}% (RESERVE CARBOY ${Math.round(nextPool)}%).`,
      }
    })
  },

  selectChannelForRefuel: (channelIndex: number) => {
    set((state) => {
      const nextReactor: ReactorState = extractReactorState(state)
      const res = selectCoreChannelForRefuel(nextReactor, channelIndex)
      if (!res.isSpent) {
        const hasSpent = Object.keys(nextReactor.coreTileAnomalies).length > 0
        return {
          lastDecisionFeedback: hasSpent
            ? `CHANNEL #${channelIndex + 1} IS NOMINAL — CLICK A PULSING AMBER TILE TO TARGET REFUELING.`
            : `CHANNEL #${channelIndex + 1} NOMINAL (SUZ RODS AT ${Math.round(state.controlRodLevel)}%).`,
        }
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      const feedbackMsg = `TARGET LOCKED: CHANNEL #${channelIndex + 1} (SPENT FUEL) — DRAG [ROD REFUELING LEVER] DOWN TO RELOAD!`
      return {
        ...mapped,
        lastDecisionFeedback: feedbackMsg,
      }
    })
  },

  executeRefuelLeverStroke: () => {
    set((state) => {
      const nextReactor: ReactorState = extractReactorState(state)
      const res = refuelSelectedCoreChannel(nextReactor)
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      let feedbackMsg: string
      let komradRefuelMsg: string | null = null
      let feedMood: KomradMood = 'normal'
      if (res.refueledChannel !== null) {
        prevSpentRodCount = res.remainingSpent
        feedbackMsg =
          res.remainingSpent > 0
            ? `CHANNEL #${res.refueledChannel + 1} REFUELED! (${res.remainingSpent} SPENT AMBER CHANNEL${res.remainingSpent === 1 ? '' : 'S'} LEFT)`
            : `CHANNEL #${res.refueledChannel + 1} REFUELED! ALL 37 CHANNELS NOMINAL.`
        komradRefuelMsg =
          res.remainingSpent > 0
            ? `FRESH URANIUM LOADED IN CHANNEL #${res.refueledChannel + 1}. ${res.remainingSpent} MORE AMBER RODS AWAIT YOUR HANDS.`
            : `CHANNEL #${res.refueledChannel + 1} RELOADED. ALL 37 CHANNELS HUMMING WITH PATRIOTIC FISSION.`
      } else if (res.hasUnselectedSpent) {
        feedMood = 'warning'
        feedbackMsg =
          'NO AMBER TILE SELECTED! CLICK A PULSING AMBER CORE TILE FIRST, THEN PULL [ROD REFUELING LEVER].'
        komradRefuelMsg =
          'SELECT AN AMBER DEPLETED CHANNEL BEFORE CRANKING THE REFUEL HOIST, COMRADE.'
      } else {
        feedbackMsg = `FUEL CRANE CYCLED — ALL CHANNELS NOMINAL (BORON TANK ${Math.round(nextReactor.boronTankLevel)}%).`
      }
      return {
        ...mapped,
        lastDecisionFeedback: feedbackMsg,
        ...(komradRefuelMsg
          ? {
              komradMessages: appendKomradFeed(
                state.komradMessages,
                createKomradMsg(
                  state.shiftTimeMinutes,
                  komradRefuelMsg,
                  feedMood,
                  'K.O.M.R.A.D.-84'
                )
              ),
            }
          : {}),
      }
    })
  },

  quenchChannelHotspot: (channelIndex: number) => {
    set((state) => {
      const nextReactor: ReactorState = extractReactorState(state)
      const res = selectCoreChannelForRefuel(nextReactor, channelIndex)
      if (!res.isSpent) {
        return state
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      return {
        ...mapped,
        lastDecisionFeedback: `TARGET LOCKED: CHANNEL #${channelIndex + 1} (SPENT FUEL) — DRAG [ROD REFUELING LEVER] DOWN TO RELOAD!`,
      }
    })
  },

  setNitrogenLoopValve: (valvePct: number) => {
    set((state) => {
      const clampedPct = Math.max(0, Math.min(100, Number(valvePct.toFixed(1))))
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        nitrogenLoopValve: clampedPct,
        feedwaterValve: Number((clampedPct / 100).toFixed(3)),
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      return mapped
    })
  },

  setBubblerDraining: (draining: boolean) => {
    set((state) => {
      if (state.bubblerDraining === draining) return state
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        bubblerDraining: draining,
      }
      return mapReactorToGameStateFields(nextReactor, state.tutorialPhase)
    })
  },

  toggleSealSwitch: (toggleIndex: 0 | 1 | 2, active?: boolean) => {
    set((state) => {
      const nextSeals: [boolean, boolean, boolean] = [
        state.sealToggles[0],
        state.sealToggles[1],
        state.sealToggles[2],
      ]
      const nextMcp = [...state.mcpActive]

      // If pump is running and seal popped open under He-N2 pressure, re-lock the seal without stopping the pump!
      if (typeof active !== 'boolean' && nextMcp[toggleIndex] && !nextSeals[toggleIndex]) {
        nextSeals[toggleIndex] = true
      } else {
        const target =
          typeof active === 'boolean' ? active : !nextSeals[toggleIndex]
        nextSeals[toggleIndex] = target
        nextMcp[toggleIndex] = target
      }

      const activeCount = nextMcp.filter(Boolean).length
      const nextFeedwater =
        activeCount >= 2 && state.feedwaterValve < 0.40
          ? 0.50
          : state.feedwaterValve
      const nextNitrogen =
        activeCount >= 2 && state.nitrogenLoopValve < 40
          ? 50
          : state.nitrogenLoopValve

      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        mcpActive: nextMcp,
        sealToggles: nextSeals,
        feedwaterValve: nextFeedwater,
        nitrogenLoopValve: nextNitrogen,
      }
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      return mapped
    })
  },

  lockAllContainmentSeals: () => {
    set((s) => {
      const nextReactor: ReactorState = {
        ...extractReactorState(s),
        mcpActive: [true, true, true, true],
        sealToggles: [true, true, true],
        feedwaterValve: Math.max(s.feedwaterValve, 0.50),
        nitrogenLoopValve: Math.max(s.nitrogenLoopValve, 50),
      }
      const prevPhase = s.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      const sealMsg =
        'ALL 4 MCP PUMPS ENGAGED & HERMETIC CONTAINMENT SCRUBBERS LOCKED!'
      return {
        ...mapped,
        lastDecisionFeedback: sealMsg,
        komradMessages: appendKomradFeed(
          s.komradMessages,
          createKomradMsg(
            s.shiftTimeMinutes,
            'MAIN CIRCULATION PUMPS ONLINE. LISTEN TO THOSE CAST-IRON IMPELLERS GRINDING FOR MOSCOW.',
            'normal',
            'K.O.M.R.A.D.-84'
          )
        ),
      }
    })
  },

  setVentingSteam: (venting: boolean) => {
    set((state) => {
      if (state.ventingSteam === venting) return state
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        ventingSteam: venting,
      }
      return mapReactorToGameStateFields(nextReactor, state.tutorialPhase)
    })
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
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        ventilationActive: nextVent,
      }
      stepReactorSimulation(nextReactor, 0.001)
      const mapped = mapReactorToGameStateFields(nextReactor, state.tutorialPhase)
      return {
        ...mapped,
        lastDecisionFeedback: `HEPA VENTILATION ${nextVent ? 'ENGAGED (-1.2 R/h, +15 MWe HOUSE LOAD)' : 'OFF (-15 MWe HOUSE LOAD)'}.`,
      }
    })
  },

  toggleAvr: (active?: boolean) => {
    set((state) => {
      const nextAvr =
        typeof active === 'boolean' ? active : !state.avrActive
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        avrActive: nextAvr,
      }
      stepReactorSimulation(nextReactor, 0.001)
      const mapped = mapReactorToGameStateFields(nextReactor, state.tutorialPhase)
      return {
        ...mapped,
        lastDecisionFeedback: `AVR EXCITER ${nextAvr ? 'ONLINE (+8 MWe LOAD, 50HZ & SYNC STABILIZED)' : 'OFFLINE (-8 MWe LOAD, VOLTAGE/SYNC DRIFT)'}.`,
      }
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
      return {
        ...mapped,
        lastDecisionFeedback: `KGB ENCRYPTED TRUNK ${nextKgb ? 'ONLINE (+10 MWe LOAD, BUNKER #4 LINKED)' : 'SEVERED (-10 MWe LOAD, BUNKER #4 OFFLINE)'}.`,
      }
    })
  },

  toggleAuxLoopB: (active?: boolean) => {
    set((state) => {
      const nextVac =
        typeof active === 'boolean' ? active : !state.auxLoopBActive
      const nextReactor: ReactorState = {
        ...extractReactorState(state),
        condenserVacActive: nextVac,
      }
      stepReactorSimulation(nextReactor, 0.001)
      const mapped = mapReactorToGameStateFields(nextReactor, state.tutorialPhase)
      return {
        ...mapped,
        lastDecisionFeedback: `CONDENSER VACUUM EJECTORS ${nextVac ? 'ENGAGED (+12 MWe LOAD, FULL TURBINE TORQUE)' : 'OFFLINE (-12 MWe LOAD, -26% TURBINE TORQUE)'}.`,
      }
    })
  },

  setInspectingDesk: (inspecting: boolean) => {
    const cur = get().isInspectingDesk
    if (cur === inspecting) return
    set({ isInspectingDesk: inspecting })
  },

  injectBoronAcid: () => {
    set((state) => {
      if (state.boronTankLevel < 20) {
        const warnMsg = `BORON TANK LOW (${Math.round(state.boronTankLevel)}% < 20%)! CYCLE [ROD REFUELING LEVER] ON UNIT A-2 OR BOOST FEEDWATER (UNIT B)!`
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
          komradMessages: appendKomradFeed(
            state.komradMessages,
            createKomradMsg(
              state.shiftTimeMinutes,
              'BORON RESERVE LOW — DO NOT SQUANDER STATE NEUTRON POISON, COMRADE.',
              'warning',
              'K.O.M.R.A.D.-84'
            )
          ),
        }
      }

      const nextReactor: ReactorState = extractReactorState(state)
      triggerBoronInjection(nextReactor)
      const prevPhase = state.tutorialPhase
      const mapped = mapReactorToGameStateFields(nextReactor, prevPhase)
      const msg = `BORON INJECTION ENGAGED (-35% BORON -> ${Math.round(nextReactor.boronTankLevel)}%): VOIDS -35% (${Math.round(nextReactor.voidFraction * 100)}%), NEUTRON DAMPING FOR 8S!`
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'OPERATOR',
        msg,
        'warn'
      )
      return {
        ...mapped,
        lastDecisionFeedback: msg,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
        komradMessages: appendKomradFeed(
          state.komradMessages,
          createKomradMsg(
            state.shiftTimeMinutes,
            'LIQUID BORON FLOODED INTO CORE. COST OF ACID DEDUCTED FROM YOUR TEA VOUCHERS.',
            'warning',
            'K.O.M.R.A.D.-84'
          )
        ),
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
      let nextCoreTileAnomalies = { ...(state.coreTileAnomalies ?? {}) }
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
            ? `SURGE TO ${newTotalMW} MWe (+${totalDeltaMW} MWe): 1)[A-2] RAISE RODS & [B] MATCH FEEDWATER -> 2)[A] SET MW LEVERS (UNIT C AUTO-DRAINS BANKS)!`
            : totalDeltaMW <= -25
              ? `SHED LOAD TO ${newTotalMW} MWe (${totalDeltaMW} MWe): 1)[A] LOWER MW LEVERS (UNIT C AUTO-TRIMS) -> 2)[A-2] INSERT RODS & [B] TRIM FEEDWATER!`
              : `DIVERT POWER (${newTotalMW} MWe TOTAL): RE-BALANCE UNIT A LEVERS & VERIFY [KEY 5] UNIT C ZONE DRAIN!`

        const routeReqText = `${changeDescriptions.join(' & ')} // ${plantGuidance}`

        const primaryChangedSector: SectorNodeId =
          changedSectors.length > 0 ? changedSectors[0] : 'vodka'
        const primarySubId = SECTOR_TO_SUB_ID[primaryChangedSector]
        mandateStableSeconds = 0

        nextMandate = {
          ...baseMandate,
          code: 'SECTOR_QUOTA',
          title: docTitle.slice(0, 36),
          requirementText: routeReqText,
          fulfilled: false,
          complianceRemainingSec: 85,
          complianceTotalSec: 85,
          targetSubstationId: primarySubId,
          targetMW: nextTargetSector[primaryChangedSector],
        }
        feedback = `ORDER APPROVED (${docTitle.slice(0, 18)}) [65s WINDOW]: ${routeReqText}`
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
        nextCoreTileAnomalies = {
          ...nextCoreTileAnomalies,
          7: 'spent',
          29: 'spent',
        }
        nextHotspots = {
          ...nextHotspots,
          7: 'amber',
          29: 'amber',
        }
        feedback = `CIA SABOTAGE DISPATCHED (${flawText ?? 'FORGERY'} — 2 SPENT RODS)! TREASON STRIKE RECORDED!`
        logLevel = 'danger'
      }

      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'K.O.M.R.A.D.-84',
        feedback,
        logLevel
      )
      const komradVerdictText =
        !isForgery && decision === 'APPROVED'
          ? `GOSPLAN ORDER STAMPED (${docTitle.slice(0, 22)}). YOUR RUBBER STAMP IMPACT WAS 94% SYMMETRICAL.`
          : !isForgery && decision === 'SHREDDED'
            ? `TREASON STRIKE! YOU SHREDDED A GENUINE PARTY DECREE (${docTitle.slice(0, 20)})! PACK FOR MAGADAN!`
            : isForgery && decision === 'SHREDDED'
              ? `CIA FORGERY SHREDDED (${docTitle.slice(0, 20)})! LANGLEY COUNTERFEIT REDUCED TO STATE CONFETTI.`
              : `CATASTROPHE! THAT WATERMARK SAID "MADE IN LANGLEY" — CIA SABOTAGE APPROVED!`
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
        coreTileAnomalies: nextCoreTileAnomalies,
        channelHotspots: nextHotspots,
        sealToggles: nextSealToggles,
        containmentSealLocked: nextSealLocked,
        activeMandate: nextMandate,
        targetSectorMW: nextTargetSector,
        targetCityMW: nextTargetCity,
        targetDefenseMW: nextTargetDefense,
        targetVodkaMW: nextTargetVodka,
        lastDecisionFeedback: feedback,
        phase: nextPhase,
        diagFeedActive: nextPhase === 'playing' ? state.diagFeedActive : false,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
        komradMessages: appendKomradFeed(
          state.komradMessages,
          createKomradMsg(
            state.shiftTimeMinutes,
            komradVerdictText,
            mapLevelToMood(logLevel),
            'K.O.M.R.A.D.-84'
          )
        ),
      }
    })
  },

  tickThermodynamics: (dtSeconds: number) => {
    const state = get()
    if ((state.phase !== 'playing' && state.phase !== 'boot') || !state.isShiftControlReady) {
      return
    }
    const frameDt = Math.max(0, Math.min(0.25, dtSeconds))
    if (frameDt === 0) return

    thermoTickAccumSeconds += frameDt
    if (thermoTickAccumSeconds < 0.033) return
    const dt = Math.min(0.25, thermoTickAccumSeconds)
    thermoTickAccumSeconds = 0

    if (state.phase === 'playing') {
      shiftElapsedSeconds += dt
    }

    // Decay electromechanical transient impulses & room voltage brownout dip over 0.5-2.5s
    const nextGridImpulse =
      Math.abs(state.gridTransientImpulse) < 0.01
        ? 0
        : Number((state.gridTransientImpulse * Math.exp(-dt * 1.35)).toFixed(3))
    const nextSteamImpulse =
      Math.abs(state.steamTransientImpulse) < 0.02
        ? 0
        : Number((state.steamTransientImpulse * Math.exp(-dt * 1.25)).toFixed(3))
    const nextVoltageDip =
      state.voltageDipIntensity < 0.01
        ? 0
        : Number((state.voltageDipIntensity * Math.exp(-dt * 3.1)).toFixed(3))

    const baseReactor = extractReactorState(state)
    if (!baseReactor.az5Active) {
      baseReactor.turbines[0].tripped = false
      baseReactor.turbines[1].tripped = false
    }
    stepReactorSimulation(baseReactor, dt, state.tutorialPhase)

    if (state.isGodMode) {
      baseReactor.coreMeltdown = false
      baseReactor.steamExplosion = false
      if (baseReactor.coreTemp > 1100) baseReactor.coreTemp = 1100
      if (baseReactor.drumPressure > 110) baseReactor.drumPressure = 110
    }

    const nextHzOutOfBoundsSeconds = 0

    const prevTutorialPhase = state.tutorialPhase
    const mapped = mapReactorToGameStateFields(baseReactor, prevTutorialPhase)

    const newLogs: TerminalLogEntry[] = []
    const newKomradMsgs: KomradMessageEntry[] = []
    let nextFeedback = state.lastDecisionFeedback
    let nextInstability = state.redlineInstability
    let nextMandate = state.activeMandate

    const pushWallKomrad = (
      msg: string,
      level: 'normal' | 'warn' | 'danger' = 'normal',
      sender: KomradMessageEntry['sender'] = 'K.O.M.R.A.D.-84'
    ) => {
      newKomradMsgs.push(
        createKomradMsg(state.shiftTimeMinutes, msg, mapLevelToMood(level), sender)
      )
    }

    const pushKomradLiveDispatch = (
      msg: string,
      level: 'normal' | 'warn' | 'danger' = 'normal',
      sender: KomradMessageEntry['sender'] = 'K.O.M.R.A.D.-84',
      wallOverrideMsg?: string
    ) => {
      nextFeedback = msg
      newLogs.push(createLogEntry(state.shiftTimeMinutes, sender, msg, level))
      pushWallKomrad(wallOverrideMsg ?? msg, level, sender)
    }

    if (mapped.tutorialPhase !== prevTutorialPhase) {
      if (mapped.tutorialPhase === 'COMPLETED') {
        newLogs.push(
          createLogEntry(
            state.shiftTimeMinutes,
            'OPERATOR',
            VOLKOV_FAREWELL_MESSAGE,
            'normal'
          )
        )
        pushKomradLiveDispatch(KOMRAD_TAKEOVER_MESSAGE, 'normal', 'K.O.M.R.A.D.-84')
      } else {
        const drillText = `>> VOLKOV DRILL: ${mapped.tutorialPrompt.header}`
        nextFeedback = drillText
        newLogs.push(
          createLogEntry(state.shiftTimeMinutes, 'K.O.M.R.A.D.-84', drillText, 'normal')
        )
      }
    }

    // Monitor newly spent TVS fuel channels across all phases (debounced & non-critical silence-aware)
    const spentCount = Object.keys(baseReactor.coreTileAnomalies).length
    if (spentCount > prevSpentRodCount && spentCount > 0) {
      const isCrit = spentCount >= 3
      const debounce = isCrit
        ? SPENT_ROD_CRIT_DEBOUNCE_SEC
        : SPENT_ROD_WARN_DEBOUNCE_SEC
      if (
        shiftElapsedSeconds - lastKomradSpentRodSec >= debounce &&
        (isCrit || canEmitKomradNonCriticalWarning())
      ) {
        lastKomradSpentRodSec = shiftElapsedSeconds
        komradDispatchSeed += 1
        const alertText =
          KOMRAD_SPENT_ROD_QUIPS[komradDispatchSeed % KOMRAD_SPENT_ROD_QUIPS.length]
        pushKomradLiveDispatch(alertText, isCrit ? 'danger' : 'warn')
      }
    }
    prevSpentRodCount = spentCount

    let hazardFired = false
    const tryHazard = (
      cat: ReactorHazardCategory,
      valA: number,
      valB: number,
      level: 'warn' | 'danger'
    ) => {
      if (hazardFired) return
      const isCrit = level === 'danger'
      const debounce = isCrit
        ? CRITICAL_HAZARD_DEBOUNCE_SEC
        : NON_FATAL_HAZARD_DEBOUNCE_SEC
      if (
        shiftElapsedSeconds - lastKomradHazardSec[cat] >= debounce &&
        (isCrit || canEmitKomradNonCriticalWarning())
      ) {
        lastKomradHazardSec[cat] = shiftElapsedSeconds
        komradDispatchSeed += 1
        const text = pickReactorHazardDispatch(
          cat,
          valA,
          valB,
          komradDispatchSeed
        )
        let wallQuip = text
        if (cat === 'HIGH_PRESSURE') {
          wallQuip =
            KOMRAD_PRESSURE_QUIPS[komradDispatchSeed % KOMRAD_PRESSURE_QUIPS.length](
              Math.round(valA)
            )
        } else if (cat === 'HIGH_XENON') {
          wallQuip =
            KOMRAD_XENON_QUIPS[komradDispatchSeed % KOMRAD_XENON_QUIPS.length](
              Math.round(valA)
            )
        } else if (cat === 'HIGH_VOID') {
          wallQuip =
            KOMRAD_VOID_QUIPS[komradDispatchSeed % KOMRAD_VOID_QUIPS.length](
              Math.round(valA)
            )
        } else if (cat === 'WATER_LOW') {
          wallQuip =
            KOMRAD_WATER_LOW_QUIPS[komradDispatchSeed % KOMRAD_WATER_LOW_QUIPS.length](
              Math.round(valA)
            )
        } else if (cat === 'WATER_HIGH') {
          wallQuip =
            KOMRAD_WATER_HIGH_QUIPS[komradDispatchSeed % KOMRAD_WATER_HIGH_QUIPS.length](
              Math.round(valA)
            )
        } else if (cat === 'GEN_DEFICIT') {
          wallQuip = `GRID SHORTFALL (${Math.round(valB)}/${Math.round(valA)} MWe)! TURBINES ARE UNDER-PRODUCING FOR THE FIVE-YEAR PLAN.`
        }
        pushKomradLiveDispatch(text, level, 'K.O.M.R.A.D.-84', wallQuip)
        hazardFired = true
      }
    }

    const liveSilenceSnapshot = {
      ...state,
      ...mapped,
    }

    // =========================================================================
    // MANDATE COMPLIANCE WINDOW & GRID-LOCKED POWER BALANCE ENFORCEMENT
    // =========================================================================
    const totalAllocatedMW = baseReactor.substations.reduce(
      (sum, s) => sum + s.allocatedMW,
      0
    )
    const totalTargetMW = baseReactor.substations.reduce(
      (sum, s) => sum + s.targetMW,
      0
    )
    const dispatchedMWe = baseReactor.totalElectricalMW
    const neededMWe = Math.max(totalTargetMW, baseReactor.energyDemandMW)
    const deltaDispatchMWe = dispatchedMWe - neededMWe
    const powerBalanceMatched = Math.abs(deltaDispatchMWe) <= 25
    const allQuotasOk = baseReactor.substations.every((s) => s.quotaOk)
    const failingSub = baseReactor.substations.find((s) => !s.quotaOk)
    const fullyBalanced = allQuotasOk && powerBalanceMatched

    if (mapped.tutorialPhase === 'COMPLETED') {
      // 1. Evaluate Active Desk Directive Mandate Compliance Window
      if (nextMandate && !nextMandate.fulfilled) {
        if (allQuotasOk && powerBalanceMatched) {
          mandateStableSeconds += dt
          if (mandateStableSeconds >= 2.0) {
            mandateStableSeconds = 0
            nextMandate = {
              ...nextMandate,
              fulfilled: true,
              complianceRemainingSec: 0,
            }
            nextInstability = Math.max(0, nextInstability - 10)
            const okReason = `DIRECTIVE QUOTA FULFILLED (${nextMandate.title}) — ${Math.round(dispatchedMWe)}/${Math.round(neededMWe)} MWe DISPATCHED FROM BATTERY! +1 COMMENDATION.`
            pushKomradLiveDispatch(
              okReason,
              'normal',
              'K.O.M.R.A.D.-84',
              `GOSPLAN QUOTA MET (${nextMandate.title.slice(0, 22)})! MOSCOW RECORDS +1 SOCIALIST EFFICIENCY POINT.`
            )
            mandateComplianceListener?.(true, nextMandate.id, okReason)
          } else {
            nextMandate = {
              ...nextMandate,
              complianceRemainingSec: Number(
                Math.max(0, (nextMandate.complianceRemainingSec ?? 65) - dt * 0.25).toFixed(1)
              ),
            }
          }
        } else {
          mandateStableSeconds = Math.max(0, mandateStableSeconds - dt)
          const rem = (nextMandate.complianceRemainingSec ?? 65) - dt
          if (rem <= 0) {
            nextInstability = Math.min(100, nextInstability + 16)
            const failReason = `MINISTRY CITATION! QUOTA DEADLINE MISSED FOR ${nextMandate.title} (GRID ${Math.round(dispatchedMWe)} vs DEMAND ${Math.round(neededMWe)} MWe) — +16% INSTABILITY!`
            pushKomradLiveDispatch(
              failReason,
              'danger',
              'K.O.M.R.A.D.-84',
              `MINISTRY CITATION! QUOTA DEADLINE MISSED FOR ${nextMandate.title.slice(0, 20)}! VOLKOV IS FUMING!`
            )
            mandateComplianceListener?.(false, nextMandate.id, failReason)
            nextMandate = {
              ...nextMandate,
              complianceRemainingSec: 45,
              complianceTotalSec: 45,
            }
          } else {
            nextMandate = {
              ...nextMandate,
              complianceRemainingSec: Number(rem.toFixed(1)),
            }
          }
        }
      } else if (allQuotasOk && powerBalanceMatched && nextInstability > 0) {
        // Passive grid stability recovery when all quotas and MWe balance are held cleanly
        nextInstability = Number(Math.max(0, nextInstability - 0.6 * dt).toFixed(2))
      }

      // 2. Sustained Over-Dispatch (> +75 MWe surplus pushed into grid from Battery)
      if (deltaDispatchMWe > 75) {
        surplusOverloadSeconds += dt
        if (surplusOverloadSeconds >= 16) {
          surplusOverloadSeconds = 0
          nextInstability = Math.min(100, nextInstability + 10)
          if (
            shiftElapsedSeconds - lastKomradOverDispatchSec >=
              OVER_DISPATCH_DEBOUNCE_SEC &&
            canEmitKomradNonCriticalWarning()
          ) {
            lastKomradOverDispatchSec = shiftElapsedSeconds
            pushKomradLiveDispatch(
              `⚡ [GRID OVER-DISPATCH: +${Math.round(deltaDispatchMWe)} MWe SURPLUS]: EXCESS LOAD DRAINING ACCUMULATOR! LOWER UNIT A ZONE LEVERS (+10% INSTABILITY)!`,
              'warn',
              'K.O.M.R.A.D.-84',
              `OVER-DISPATCHING BY +${Math.round(deltaDispatchMWe)} MWe! THE COPPER BUSBARS ARE SINGING THE INTERNATIONALE!`
            )
          }
        }
      } else {
        surplusOverloadSeconds = Math.max(0, surplusOverloadSeconds - dt * 1.5)
      }

      // Situation D: All 6 substation quotas & power balance turn green (debounced & respects silence)
      if (fullyBalanced && !prevAllSubstationsOk) {
        brownoutMismatchSeconds = 0
        if (
          shiftElapsedSeconds - lastKomradPraiseSec >= PRAISE_DEBOUNCE_SEC &&
          canEmitKomradIdleChatter(liveSilenceSnapshot, 'any')
        ) {
          lastKomradPraiseSec = shiftElapsedSeconds
          reserveIdleChatterEmission()
          komradDispatchSeed += 1
          const praise = pickQuotaCommendationDispatch(komradDispatchSeed)
          pushKomradLiveDispatch(praise, 'normal')
        }
      }
      prevAllSubstationsOk = fullyBalanced

      if (
        totalAllocatedMW > dispatchedMWe + 25 ||
        deltaDispatchMWe < -30
      ) {
        tryHazard(
          'GEN_DEFICIT',
          Math.max(totalAllocatedMW, neededMWe),
          dispatchedMWe,
          'warn'
        )
      }

      // Situation C: Substation Brownout / Quota Mismatch (> 15s mismatch, 60s cooldown)
      if (failingSub) {
        brownoutMismatchSeconds += dt
        if (
          !hazardFired &&
          brownoutMismatchSeconds >= 15 &&
          shiftElapsedSeconds - lastKomradBrownoutSec >= BROWNOUT_DEBOUNCE_SEC &&
          canEmitKomradNonCriticalWarning()
        ) {
          lastKomradBrownoutSec = shiftElapsedSeconds
          komradDispatchSeed += 1
          const brownoutText = pickSectorBrownoutDispatch(
            `sub_${failingSub.id}`,
            failingSub.allocatedMW,
            failingSub.targetMW,
            komradDispatchSeed
          )
          const wallBrownout =
            KOMRAD_BROWNOUT_QUIPS[failingSub.id]?.(
              Math.round(failingSub.allocatedMW),
              Math.round(failingSub.targetMW)
            ) ?? brownoutText
          pushKomradLiveDispatch(brownoutText, 'warn', 'K.O.M.R.A.D.-84', wallBrownout)
          hazardFired = true
        }
      } else {
        brownoutMismatchSeconds = 0
      }
    }

    // Situation B: Reactor Thermodynamic Hazards Across All Operational Phases
    if (baseReactor.voidFraction > 0.38) {
      tryHazard(
        'HIGH_VOID',
        baseReactor.voidFraction * 100,
        0,
        baseReactor.voidFraction > 0.56 ? 'danger' : 'warn'
      )
    }
    if (baseReactor.xenon > 38) {
      tryHazard(
        'HIGH_XENON',
        baseReactor.xenon,
        0,
        baseReactor.xenon > 56 ? 'danger' : 'warn'
      )
    }
    if (baseReactor.drumWaterLevel < -145) {
      tryHazard('WATER_LOW', baseReactor.drumWaterLevel, 0, 'danger')
    } else if (baseReactor.drumWaterLevel > 145) {
      tryHazard('WATER_HIGH', baseReactor.drumWaterLevel, 0, 'warn')
    }
    if (baseReactor.drumPressure > 79) {
      tryHazard(
        'HIGH_PRESSURE',
        baseReactor.drumPressure,
        0,
        baseReactor.drumPressure >= 86 ? 'danger' : 'warn'
      )
    }
    if (!hazardFired && baseReactor.coreTemp >= 680) {
      const isCrit = baseReactor.coreTemp >= 850
      const debounce = isCrit
        ? OVERHEAT_CRIT_DEBOUNCE_SEC
        : OVERHEAT_WARN_DEBOUNCE_SEC
      if (
        shiftElapsedSeconds - lastKomradOverheatSec >= debounce &&
        (isCrit || canEmitKomradNonCriticalWarning())
      ) {
        lastKomradOverheatSec = shiftElapsedSeconds
        komradDispatchSeed += 1
        const tempVal = Math.round(baseReactor.coreTemp)
        const quipFn = isCrit
          ? KOMRAD_CRIT_TEMP_QUIPS[komradDispatchSeed % KOMRAD_CRIT_TEMP_QUIPS.length]
          : KOMRAD_HIGH_TEMP_QUIPS[komradDispatchSeed % KOMRAD_HIGH_TEMP_QUIPS.length]
        pushKomradLiveDispatch(quipFn(tempVal), isCrit ? 'danger' : 'warn')
        hazardFired = true
      }
    }
    if (!hazardFired && baseReactor.roomRadiation >= 3.5) {
      const isCrit = baseReactor.roomRadiation >= 8.0
      const debounce = isCrit ? RAD_CRIT_DEBOUNCE_SEC : RAD_WARN_DEBOUNCE_SEC
      if (
        shiftElapsedSeconds - lastKomradRadSec >= debounce &&
        (isCrit || canEmitKomradNonCriticalWarning())
      ) {
        lastKomradRadSec = shiftElapsedSeconds
        komradDispatchSeed += 1
        const radQuip =
          KOMRAD_RAD_QUIPS[komradDispatchSeed % KOMRAD_RAD_QUIPS.length]
        pushKomradLiveDispatch(radQuip, isCrit ? 'danger' : 'warn')
        hazardFired = true
      }
    }

    // Situation E: Idle Night-Shift Chatter (75-120s post-speech silence, paused during tutorial/alarms/orders)
    if (!hazardFired && canEmitKomradIdleChatter(liveSilenceSnapshot, 'text')) {
      reserveIdleChatterEmission()
      komradDispatchSeed += 1
      pushWallKomrad(pickNextNightShiftChatter(), 'normal', 'K.O.M.R.A.D.-84')
    }

    const nextPhase =
      !state.isGodMode && state.treasonStrikes >= 3
        ? 'gulag'
        : !state.isGodMode && (baseReactor.coreMeltdown || baseReactor.steamExplosion)
          ? 'meltdown'
          : state.phase

    if (newLogs.length > 0 || newKomradMsgs.length > 0) {
      const updatedEntries = [...state.terminalEntries.slice(-24), ...newLogs]
      set({
        ...mapped,
        activeMandate: nextMandate,
        redlineInstability: nextInstability,
        gridTransientImpulse: nextGridImpulse,
        steamTransientImpulse: nextSteamImpulse,
        voltageDipIntensity: nextVoltageDip,
        hzOutOfBoundsSeconds: nextHzOutOfBoundsSeconds,
        lastDecisionFeedback: nextFeedback,
        phase: nextPhase,
        diagFeedActive: nextPhase === 'playing' ? state.diagFeedActive : false,
        terminalEntries: updatedEntries,
        terminalLogs: updatedEntries.map(
          (e) => `[${e.timestamp}] ${e.sender}: ${e.text}`
        ),
        komradMessages: appendKomradFeed(state.komradMessages, ...newKomradMsgs),
      })
    } else {
      set({
        ...mapped,
        activeMandate: nextMandate,
        redlineInstability: nextInstability,
        gridTransientImpulse: nextGridImpulse,
        steamTransientImpulse: nextSteamImpulse,
        voltageDipIntensity: nextVoltageDip,
        hzOutOfBoundsSeconds: nextHzOutOfBoundsSeconds,
        phase: nextPhase,
        diagFeedActive: nextPhase === 'playing' ? state.diagFeedActive : false,
      })
    }
  },

  triggerAz5: () => {
    set((state) => {
      const nextAz5 = !state.az5Active
      const base = extractReactorState(state)
      const nextReactor: ReactorState = {
        ...base,
        az5Active: nextAz5,
        az5Timer: nextAz5 ? 0 : state.az5Timer,
        turbines: nextAz5
          ? [
              {
                ...base.turbines[0],
                gridConnected: false,
                tripped: true,
                valve: 0,
                electricalMW: 0,
              },
              {
                ...base.turbines[1],
                gridConnected: false,
                tripped: true,
                valve: 0,
                electricalMW: 0,
              },
            ]
          : [
              {
                ...base.turbines[0],
                tripped: false,
                gridConnected: base.energyCreatedMW > 20 || base.totalElectricalMW > 0,
              },
              {
                ...base.turbines[1],
                tripped: false,
                gridConnected: base.energyCreatedMW > 20 || base.totalElectricalMW > 0,
              },
            ],
        totalElectricalMW: nextAz5 ? 0 : base.totalElectricalMW,
      }
      const mapped = mapReactorToGameStateFields(nextReactor, state.tutorialPhase)
      const msg = nextAz5
        ? 'AZ-5 EMERGENCY SCRAM ENGAGED! MAIN BREAKER OPENED & GRAPHITE DISPLACER TIPS ENTERING CORE (+REACTIVITY SPIKE FIRST 3.5S)!'
        : 'AZ-5 SCRAM LATCH RESET BY OPERATOR — MANUAL ROD CONTROL RESTORED.'
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'K.O.M.R.A.D.-84',
        msg,
        nextAz5 ? 'danger' : 'warn'
      )
      return {
        ...mapped,
        isBlackout: nextAz5 ? state.isBlackout : false,
        lastDecisionFeedback: msg,
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
        komradMessages: appendKomradFeed(
          state.komradMessages,
          createKomradMsg(
            state.shiftTimeMinutes,
            nextAz5
              ? 'AZ-5 BORON RODS DROPPED! NOTE: PANIC REMAINS A BOURGEOIS WEAKNESS.'
              : 'AZ-5 SCRAM LATCH RESET. RESUME FIVE-YEAR PLAN OUTPUT IMMEDIATELY.',
            nextAz5 ? 'critical' : 'warning',
            'K.O.M.R.A.D.-84'
          )
        ),
      }
    })
  },

  overrideKomradLock: () => {
    set((state) => {
      const overrideMsg =
        'MANUAL OVERRIDE ACCEPTED. YOUR LACK OF FAITH IN AUTOMATED SOCIALISM HAS BEEN LOGGED.'
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'K.O.M.R.A.D.-84',
        overrideMsg,
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
        komradMessages: appendKomradFeed(
          state.komradMessages,
          createKomradMsg(state.shiftTimeMinutes, overrideMsg, 'warning', 'K.O.M.R.A.D.-84')
        ),
      }
    })
  },

  purgeFirewall: () => {
    set((state) => {
      const purgeMsg =
        'WESTERN IMPERIALIST PACKET STREAM PURGED FROM SECTOR 07.'
      const okEntry = createLogEntry(
        state.shiftTimeMinutes,
        'SYS.DEFENSE',
        purgeMsg,
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
        komradMessages: appendKomradFeed(
          state.komradMessages,
          createKomradMsg(state.shiftTimeMinutes, purgeMsg, 'normal', 'SYS.DEFENSE')
        ),
      }
    })
  },

  spawnDirective: (forceForgery?: boolean) => {
    set((state) => {
      if (state.activeDirectives.length >= 6) return state
      const newDoc = createDirectiveInstance(forceForgery)
      const printMsg = `NEW DIRECTIVE PRINTED: ${newDoc.id} (${newDoc.title}).`
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'PRINTER',
        printMsg,
        'normal'
      )
      return {
        activeDirectives: [...state.activeDirectives, newDoc],
        terminalEntries: [...state.terminalEntries.slice(-24), entry],
        terminalLogs: [
          ...state.terminalLogs.slice(-24),
          `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
        ],
        komradMessages: appendKomradFeed(
          state.komradMessages,
          createKomradMsg(state.shiftTimeMinutes, printMsg, 'normal', 'PRINTER')
        ),
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
      const godText = enabled
        ? 'SANDBOX TEST MODE [SHIFT+SPACE] ENGAGED: INFINITE TIME & ZERO FAIL STATES.'
        : 'SANDBOX TEST MODE DISENGAGED: STANDARD SHIFT RULES RESTORED.'
      const entry = createLogEntry(
        state.shiftTimeMinutes,
        'K.O.M.R.A.D.-84',
        godText,
        enabled ? 'normal' : 'warn'
      )
      const komradGodText = enabled
        ? 'POLITBURO IMMUNITY DECREE ACTIVE: REALITY SUBROUTINES TEMPORARILY SUPPRESSED.'
        : 'IMMUNITY DECREE REVOKED: STANDARD SOVIET THERMODYNAMICS RESTORED.'
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
        komradMessages: appendKomradFeed(
          state.komradMessages,
          createKomradMsg(
            state.shiftTimeMinutes,
            komradGodText,
            enabled ? 'normal' : 'warning',
            'K.O.M.R.A.D.-84'
          )
        ),
      }
    })
  },

  toggleMusicMute: () => {
    set((state) => ({ isMusicMuted: !state.isMusicMuted }))
  },

  setDiagFeedActive: (active: boolean) => {
    set({ diagFeedActive: active })
  },

  setRadioBroadcastSubtitle: (subtitle: string | null) => {
    set((state) =>
      state.radioBroadcastSubtitle === subtitle
        ? state
        : { radioBroadcastSubtitle: subtitle }
    )
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
    set({ shiftTimeMinutes: 360, phase: 'victory', diagFeedActive: false })
  },

  tick: () => {
    const state = get()
    if (state.phase !== 'playing' || !state.isShiftControlReady) return

    // 1. Advance clock continuously without stopping at 10 minutes (wraps around 360 in-game minutes)
    const SHIFT_MINUTES_PER_SECOND = 1 / 1.75
    const rawNextMinutes = state.shiftTimeMinutes + SHIFT_MINUTES_PER_SECOND
    const nextMinutes = rawNextMinutes % 360

    // 2. Legacy Pravda Dot-Matrix Printer progress (post-tutorial only, no wall CRT / VOX chatter spam)
    let nextPrinterProgress = state.printerProgress
    let nextDirectives = state.activeDirectives
    const tickKomradMsgs: KomradMessageEntry[] = []
    if (
      state.tutorialPhase === 'COMPLETED' &&
      state.activeDirectives.length === 0 &&
      shiftElapsedSeconds >= 15
    ) {
      nextPrinterProgress = Math.min(100, state.printerProgress + 3.5)
      if (nextPrinterProgress >= 100) {
        const spawned = createDirectiveInstance()
        nextDirectives = [spawned]
        nextPrinterProgress = 0
      }
    }

    // 3. Hourly Shift Broadcasts (01:00 -> 05:00): strictly obey global idle silence cooldown (drop, don't queue)
    const currentHour = Math.floor(nextMinutes / 60)
    if (currentHour === 0) {
      lastBroadcastHour = 0
    } else if (currentHour !== lastBroadcastHour && KOMRAD_HOURLY_LOGS[currentHour]) {
      lastBroadcastHour = currentHour
      if (canEmitKomradIdleChatter(state, 'any')) {
        reserveIdleChatterEmission()
        tickKomradMsgs.push(
          createKomradMsg(
            nextMinutes,
            KOMRAD_HOURLY_LOGS[currentHour],
            currentHour >= 4 ? 'warning' : 'normal',
            'K.O.M.R.A.D.-84'
          )
        )
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
      diagFeedActive: nextPhase === 'playing' ? state.diagFeedActive : false,
      ...(tickKomradMsgs.length > 0
        ? { komradMessages: appendKomradFeed(state.komradMessages, ...tickKomradMsgs) }
        : {}),
    })
  },
}))

export const useReactorStore = useGameStore
