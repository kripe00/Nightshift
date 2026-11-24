import * as THREE from "three";
import { playDetentClick } from "../modules/inspector/audio";
import { playSwitchClank } from "../modules/reactor/audioSynth";
import type { SectorNodeId } from "./types";
import { useGameStore } from "./useGameStore";

/**
 * MASTER AUTONOMOUS SABOTAGE KILL-SWITCH.
 * Strictly DISABLED until the future "haywire" gameplay update.
 * K.O.M.R.A.D.-84 MUST NEVER touch or change any control autonomously while this is false.
 */
export const AUTONOMOUS_KOMRAD_ACTUATION_ENABLED = false as const;

export const MANIPULATOR_UPPER_LEN = 0.58;
export const MANIPULATOR_FOREARM_LEN = 0.56;
export const MANIPULATOR_CLAW_LEN = 0.14;
export const MANIPULATOR_SHOULDER_LOCAL_X = 0.44;
export const MANIPULATOR_SHOULDER_LOCAL_Y = -0.34;
export const MANIPULATOR_SHOULDER_LOCAL_Z = 0.08;

export type KomradGripType = "wheel" | "slider" | "lever" | "button" | "knob";
export type KomradArmSide = "left" | "right";
export type KomradActuationPhase =
  | "idle"
  | "approach"
  | "reach_and_latch"
  | "actuate"
  | "release_and_retract";
export type KomradControlStation =
  | "UNIT A"
  | "UNIT A-2"
  | "UNIT B"
  | "UNIT C"
  | "RADIO";

export interface KomradControlTargetSpec {
  readonly id: string;
  readonly station: KomradControlStation;
  readonly label: string;
  readonly worldPos: readonly [number, number, number];
  readonly approachNormal: readonly [number, number, number];
  readonly standoffGantryPos: readonly [number, number, number];
  readonly gripType: KomradGripType;
  readonly minValue: number;
  readonly maxValue: number;
  readonly wristSpinTurns: number;
  readonly readValue: () => number;
  readonly writeValue: (value: number) => void;
}

export interface KomradAdjustOptions {
  readonly durationSec?: number;
  readonly arm?: KomradArmSide;
}

export interface KomradArmFrameState {
  active: boolean;
  phase: KomradActuationPhase;
  phaseTime: number;
  phaseDuration: number;
  targetId: string | null;
  channelIndex: number;
  gripType: KomradGripType;
  activeArm: KomradArmSide;
  standoffGantryPos: THREE.Vector3;
  targetWorldPos: THREE.Vector3;
  approachWorldNormal: THREE.Vector3;
  clawWorldPos: THREE.Vector3;
  ikBlend: number;
  clawOpen: number;
  wristRollRad: number;
  startValue: number;
  targetValue: number;
  currentValue: number;
}

export interface TwoBoneIKResult {
  upperQuat: THREE.Quaternion;
  elbowAngleX: number;
  elbowLocalPos: THREE.Vector3;
  clampedDist: number;
}

interface LiveAnchorEntry {
  obj: THREE.Object3D;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

const REACH_LATCH_DURATION_SEC = 0.58;
const RELEASE_RETRACT_DURATION_SEC = 0.62;
const APPROACH_TIMEOUT_SEC = 2.25;
const STANDOFF_CLEARANCE_M = 0.14;
const BUTTON_POKE_DEPTH_M = 0.024;

const liveAnchorMap = new Map<string, LiveAnchorEntry>();
const visualOverrideMap = new Map<string, number>();
const activePlayerControls = new Set<string>();

const _ikUDir = new THREE.Vector3();
const _ikBend = new THREE.Vector3();
const _ikDUpper = new THREE.Vector3();
const _ikXAxis = new THREE.Vector3();
const _ikYAxis = new THREE.Vector3();
const _ikZAxis = new THREE.Vector3();
const _ikRotMat = new THREE.Matrix4();

const _liveAnchorLocal = new THREE.Vector3();
const _liveWorldPos = new THREE.Vector3();
const _liveWorldNormal = new THREE.Vector3();
const _shoulderCheckA = new THREE.Vector3();
const _shoulderCheckB = new THREE.Vector3();
const _wristCheck = new THREE.Vector3();

let latchSoundPlayed = false;
let releaseSoundPlayed = false;
let discreteActionFired = false;
let lastDetentBucket = -999999;

const _armFrameState: KomradArmFrameState = {
  active: false,
  phase: "idle",
  phaseTime: 0,
  phaseDuration: 0,
  targetId: null,
  channelIndex: 0,
  gripType: "wheel",
  activeArm: "right",
  standoffGantryPos: new THREE.Vector3(),
  targetWorldPos: new THREE.Vector3(),
  approachWorldNormal: new THREE.Vector3(0, 0, 1),
  clawWorldPos: new THREE.Vector3(),
  ikBlend: 0,
  clawOpen: 0.15,
  wristRollRad: 0,
  startValue: 0,
  targetValue: 0,
  currentValue: 0,
};

function safePlaySwitchClank(heavy: boolean): void {
  try {
    playSwitchClank(heavy);
  } catch {
    // Ignore audio errors in headless environments
  }
}

function safePlayDetentClick(index: number): void {
  try {
    playDetentClick(index);
  } catch {
    // Ignore audio errors in headless environments
  }
}

function wrapAngleRad(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function smoothstep01(x: number): number {
  const c = THREE.MathUtils.clamp(x, 0, 1);
  return c * c * (3 - 2 * c);
}

function defaultDurationForGrip(grip: KomradGripType): number {
  switch (grip) {
    case "button":
      return 0.82;
    case "lever":
      return 0.96;
    case "slider":
      return 1.1;
    case "knob":
      return 1.05;
    case "wheel":
      return 1.35;
  }
}

function setSectorPowerAdapter(sector: SectorNodeId, valueMW: number): void {
  const s = useGameStore.getState();
  const snapped = THREE.MathUtils.clamp(Math.round(valueMW / 25) * 25, 0, 250);
  if (snapped !== s.sectorMW[sector]) {
    s.setSectorPower(sector, snapped);
  }
}

export const KOMRAD_CONTROL_TARGETS: Readonly<
  Record<string, KomradControlTargetSpec>
> = {
  // =========================================================================
  // UNIT A — PUMPS, SUBSTATION SECTORS, BORON & AZ-5 SCRAM
  // =========================================================================
  pumpAFlow: {
    id: "pumpAFlow",
    station: "UNIT A",
    label: "PUMP A THROTTLE LEVER",
    worldPos: [-3.364, 1.299, -1.624],
    approachNormal: [0.226, 0.488, 0.843],
    standoffGantryPos: [-3.2, 1.62, -0.92],
    gripType: "lever",
    minValue: 0,
    maxValue: 100,
    wristSpinTurns: 0,
    readValue: () => useGameStore.getState().pumpThrottle[0] ?? 0,
    writeValue: (v) => useGameStore.getState().setPumpThrottle(0, v),
  },
  pumpBFlow: {
    id: "pumpBFlow",
    station: "UNIT A",
    label: "PUMP B THROTTLE LEVER",
    worldPos: [-2.924, 1.299, -1.742],
    approachNormal: [0.226, 0.488, 0.843],
    standoffGantryPos: [-2.76, 1.62, -1.04],
    gripType: "lever",
    minValue: 0,
    maxValue: 100,
    wristSpinTurns: 0,
    readValue: () => useGameStore.getState().pumpThrottle[1] ?? 0,
    writeValue: (v) => useGameStore.getState().setPumpThrottle(1, v),
  },
  sector_0: {
    id: "sector_0",
    station: "UNIT A",
    label: "SECTOR 1 (PRIPYAT CITY MW)",
    worldPos: [-3.316, 0.846, -1.242],
    approachNormal: [0.158, 0.793, 0.588],
    standoffGantryPos: [-3.18, 1.54, -0.6],
    gripType: "slider",
    minValue: 0,
    maxValue: 250,
    wristSpinTurns: 0,
    readValue: () => useGameStore.getState().sectorMW.pripyat,
    writeValue: (v) => setSectorPowerAdapter("pripyat", v),
  },
  sector_1: {
    id: "sector_1",
    station: "UNIT A",
    label: "SECTOR 2 (DUGA-1 RADAR MW)",
    worldPos: [-3.098, 0.846, -1.3],
    approachNormal: [0.158, 0.793, 0.588],
    standoffGantryPos: [-2.96, 1.54, -0.66],
    gripType: "slider",
    minValue: 0,
    maxValue: 250,
    wristSpinTurns: 0,
    readValue: () => useGameStore.getState().sectorMW.duga,
    writeValue: (v) => setSectorPowerAdapter("duga", v),
  },
  sector_2: {
    id: "sector_2",
    station: "UNIT A",
    label: "SECTOR 3 (KOLKHOZ FARM MW)",
    worldPos: [-2.881, 0.846, -1.358],
    approachNormal: [0.158, 0.793, 0.588],
    standoffGantryPos: [-2.74, 1.54, -0.72],
    gripType: "slider",
    minValue: 0,
    maxValue: 250,
    wristSpinTurns: 0,
    readValue: () => useGameStore.getState().sectorMW.kolkhoz,
    writeValue: (v) => setSectorPowerAdapter("kolkhoz", v),
  },
  sector_3: {
    id: "sector_3",
    station: "UNIT A",
    label: "SECTOR 4 (KGB BUNKER #7 MW)",
    worldPos: [-2.664, 0.846, -1.417],
    approachNormal: [0.158, 0.793, 0.588],
    standoffGantryPos: [-2.52, 1.54, -0.78],
    gripType: "slider",
    minValue: 0,
    maxValue: 250,
    wristSpinTurns: 0,
    readValue: () => useGameStore.getState().sectorMW.kgb,
    writeValue: (v) => setSectorPowerAdapter("kgb", v),
  },
  sector_4: {
    id: "sector_4",
    station: "UNIT A",
    label: "SECTOR 5 (VODKA PLANT MW)",
    worldPos: [-2.447, 0.846, -1.475],
    approachNormal: [0.158, 0.793, 0.588],
    standoffGantryPos: [-2.3, 1.54, -0.84],
    gripType: "slider",
    minValue: 0,
    maxValue: 250,
    wristSpinTurns: 0,
    readValue: () => useGameStore.getState().sectorMW.vodka,
    writeValue: (v) => setSectorPowerAdapter("vodka", v),
  },
  sector_5: {
    id: "sector_5",
    station: "UNIT A",
    label: "SECTOR 6 (STEEL WORKS MW)",
    worldPos: [-2.229, 0.846, -1.533],
    approachNormal: [0.158, 0.793, 0.588],
    standoffGantryPos: [-2.08, 1.54, -0.9],
    gripType: "slider",
    minValue: 0,
    maxValue: 250,
    wristSpinTurns: 0,
    readValue: () => useGameStore.getState().sectorMW.steel,
    writeValue: (v) => setSectorPowerAdapter("steel", v),
  },
  boron: {
    id: "boron",
    station: "UNIT A",
    label: "BORON INJECTION PLUNGER",
    worldPos: [-2.382, 1.128, -1.883],
    approachNormal: [0.226, 0.488, 0.843],
    standoffGantryPos: [-2.22, 1.58, -1.16],
    gripType: "button",
    minValue: 0,
    maxValue: 1,
    wristSpinTurns: 0,
    readValue: () => (useGameStore.getState().boronCooldown > 0 ? 0 : 1),
    writeValue: (v) => {
      if (v >= 0.5) {
        useGameStore.getState().injectBoronAcid();
      }
    },
  },
  az5: {
    id: "az5",
    station: "UNIT A",
    label: "AZ-5 EMERGENCY SCRAM BUTTON",
    worldPos: [-2.503, 1.264, -1.927],
    approachNormal: [0.226, 0.488, 0.843],
    standoffGantryPos: [-2.34, 1.62, -1.2],
    gripType: "button",
    minValue: 0,
    maxValue: 1,
    wristSpinTurns: 0,
    readValue: () => (useGameStore.getState().az5Active ? 1 : 0),
    writeValue: (v) => {
      const s = useGameStore.getState();
      const wantOn = v >= 0.5;
      if (s.az5Active !== wantOn) {
        s.triggerAz5();
      }
    },
  },
  az5Cover: {
    id: "az5Cover",
    station: "UNIT A",
    label: "AZ-5 SAFETY COVER LATCH",
    worldPos: [-2.503, 1.155, -1.86],
    approachNormal: [0.226, 0.488, 0.843],
    standoffGantryPos: [-2.34, 1.62, -1.2],
    gripType: "lever",
    minValue: 0,
    maxValue: 1,
    wristSpinTurns: 0,
    readValue: () => (getKomradControlVisualOverride("az5Cover") >= 0.5 ? 1 : 0),
    writeValue: (v) => {
      visualOverrideMap.set("az5Cover", v >= 0.5 ? 1 : 0);
    },
  },

  // =========================================================================
  // UNIT A-2 — CONTROL ROD DRIVE, 37-CHANNEL CORE MATRIX & REFUEL HOIST
  // =========================================================================
  controlRodDrive: {
    id: "controlRodDrive",
    station: "UNIT A-2",
    label: "CONTROL ROD DRIVE HANDWHEEL",
    worldPos: [-4.601, 0.84, -0.855],
    approachNormal: [0.158, 0.793, 0.588],
    standoffGantryPos: [-4.32, 1.52, -0.22],
    gripType: "wheel",
    minValue: 0,
    maxValue: 100,
    wristSpinTurns: 2.0,
    readValue: () => useGameStore.getState().controlRods * 100,
    writeValue: (v) => useGameStore.getState().setControlRodLevel(v),
  },
  coreChannelTile: {
    id: "coreChannelTile",
    station: "UNIT A-2",
    label: "RBMK CORE CHANNEL TILE (0-36)",
    worldPos: [-4.41, 1.25, -1.453],
    approachNormal: [0.226, 0.488, 0.843],
    standoffGantryPos: [-4.18, 1.62, -0.74],
    gripType: "button",
    minValue: 0,
    maxValue: 36,
    wristSpinTurns: 0,
    readValue: () => useGameStore.getState().selectedRefuelChannel ?? 0,
    writeValue: (v) => {
      const idx = THREE.MathUtils.clamp(Math.round(v), 0, 36);
      useGameStore.getState().selectChannelForRefuel(idx);
    },
  },
  rodRefuelLever: {
    id: "rodRefuelLever",
    station: "UNIT A-2",
    label: "ROD REFUELING LEVER",
    worldPos: [-4.062, 0.929, -1.03],
    approachNormal: [0.158, 0.793, 0.588],
    standoffGantryPos: [-3.9, 1.54, -0.38],
    gripType: "lever",
    minValue: 0,
    maxValue: 1,
    wristSpinTurns: 0,
    readValue: () => 0,
    writeValue: (v) => {
      if (v >= 0.85 && !discreteActionFired) {
        discreteActionFired = true;
        useGameStore.getState().executeRefuelLeverStroke();
      }
    },
  },

  // =========================================================================
  // UNIT B — STEAM DRUM FEEDWATER, MCP SEALS & BUBBLER DRAIN / VENT
  // =========================================================================
  feedwaterValve: {
    id: "feedwaterValve",
    station: "UNIT B",
    label: "FEEDWATER & HE-N2 HANDWHEEL",
    worldPos: [3.637, 0.891, -1.06],
    approachNormal: [-0.188, 0.793, 0.579],
    standoffGantryPos: [3.46, 1.54, -0.4],
    gripType: "wheel",
    minValue: 0,
    maxValue: 100,
    wristSpinTurns: 1.8,
    readValue: () => useGameStore.getState().nitrogenLoopValve,
    writeValue: (v) => useGameStore.getState().setNitrogenLoopValve(v),
  },
  mcpSealToggle0: {
    id: "mcpSealToggle0",
    station: "UNIT B",
    label: "MCP-1 / N2 PURGE TOGGLE",
    worldPos: [3.939, 0.847, -0.855],
    approachNormal: [-0.188, 0.793, 0.579],
    standoffGantryPos: [3.76, 1.52, -0.22],
    gripType: "button",
    minValue: 0,
    maxValue: 1,
    wristSpinTurns: 0,
    readValue: () => (useGameStore.getState().sealToggles[0] ? 1 : 0),
    writeValue: (v) => useGameStore.getState().toggleSealSwitch(0, v >= 0.5),
  },
  mcpSealToggle1: {
    id: "mcpSealToggle1",
    station: "UNIT B",
    label: "MCP-2 / RAD FILTER TOGGLE",
    worldPos: [4.042, 0.847, -0.821],
    approachNormal: [-0.188, 0.793, 0.579],
    standoffGantryPos: [3.86, 1.52, -0.18],
    gripType: "button",
    minValue: 0,
    maxValue: 1,
    wristSpinTurns: 0,
    readValue: () => (useGameStore.getState().sealToggles[1] ? 1 : 0),
    writeValue: (v) => useGameStore.getState().toggleSealSwitch(1, v >= 0.5),
  },
  mcpSealToggle2: {
    id: "mcpSealToggle2",
    station: "UNIT B",
    label: "MCP-3 / SEAL LOCK TOGGLE",
    worldPos: [4.144, 0.847, -0.788],
    approachNormal: [-0.188, 0.793, 0.579],
    standoffGantryPos: [3.96, 1.52, -0.15],
    gripType: "button",
    minValue: 0,
    maxValue: 1,
    wristSpinTurns: 0,
    readValue: () => (useGameStore.getState().sealToggles[2] ? 1 : 0),
    writeValue: (v) => useGameStore.getState().toggleSealSwitch(2, v >= 0.5),
  },
  emergSealLock: {
    id: "emergSealLock",
    station: "UNIT B",
    label: "MCP-4 EMERGENCY SEAL BUTTON",
    worldPos: [4.259, 0.796, -0.791],
    approachNormal: [-0.188, 0.793, 0.579],
    standoffGantryPos: [4.06, 1.5, -0.16],
    gripType: "button",
    minValue: 0,
    maxValue: 1,
    wristSpinTurns: 0,
    readValue: () => (useGameStore.getState().containmentSealLocked ? 1 : 0),
    writeValue: (v) => {
      const s = useGameStore.getState();
      if (v >= 0.5) {
        s.lockAllContainmentSeals();
      } else {
        s.toggleSealSwitch(0, false);
        s.toggleSealSwitch(1, false);
        s.toggleSealSwitch(2, false);
      }
    },
  },
  bubblerDrain: {
    id: "bubblerDrain",
    station: "UNIT B",
    label: "BUBBLER DRAIN / STEAM VENT LEVER",
    worldPos: [4.543, 0.989, -0.841],
    approachNormal: [-0.188, 0.793, 0.579],
    standoffGantryPos: [4.32, 1.56, -0.2],
    gripType: "lever",
    minValue: 0,
    maxValue: 1,
    wristSpinTurns: 0,
    readValue: () => {
      const s = useGameStore.getState();
      return s.bubblerDraining || s.steamDumpValve ? 1 : 0;
    },
    writeValue: (v) => {
      const open = v >= 0.5;
      const s = useGameStore.getState();
      s.setBubblerDraining(open);
      s.setSteamDumpValve(open);
    },
  },

  // =========================================================================
  // UNIT C — STATION BATTERY & 6KV AUXILIARY HOUSE BUS SWITCHGEAR
  // =========================================================================
  auxVentilation: {
    id: "auxVentilation",
    station: "UNIT C",
    label: "HEPA VENTILATION BREAKER",
    worldPos: [-4.895, 1.594, 0.088],
    approachNormal: [1, 0, 0],
    standoffGantryPos: [-4.16, 1.66, 0.08],
    gripType: "button",
    minValue: 0,
    maxValue: 1,
    wristSpinTurns: 0,
    readValue: () => (useGameStore.getState().ventilationActive ? 1 : 0),
    writeValue: (v) => useGameStore.getState().toggleVentilation(v >= 0.5),
  },
  auxAudioMute: {
    id: "auxAudioMute",
    station: "UNIT C",
    label: "BUNKER AUDIO [M] BREAKER",
    worldPos: [-4.895, 1.594, -0.208],
    approachNormal: [1, 0, 0],
    standoffGantryPos: [-4.16, 1.66, -0.2],
    gripType: "button",
    minValue: 0,
    maxValue: 1,
    wristSpinTurns: 0,
    readValue: () => (useGameStore.getState().isMusicMuted ? 0 : 1),
    writeValue: (v) => {
      const s = useGameStore.getState();
      const wantAudible = v >= 0.5;
      if (wantAudible !== !s.isMusicMuted) {
        s.toggleMusicMute();
      }
    },
  },
  auxKgbLine: {
    id: "auxKgbLine",
    station: "UNIT C",
    label: "KGB TRUNK LINE BREAKER",
    worldPos: [-4.895, 1.398, 0.088],
    approachNormal: [1, 0, 0],
    standoffGantryPos: [-4.16, 1.56, 0.08],
    gripType: "button",
    minValue: 0,
    maxValue: 1,
    wristSpinTurns: 0,
    readValue: () => (useGameStore.getState().kgbLineActive ? 1 : 0),
    writeValue: (v) => useGameStore.getState().toggleKgbLine(v >= 0.5),
  },
  auxCondenserVac: {
    id: "auxCondenserVac",
    station: "UNIT C",
    label: "CONDENSER VAC / TRIP RESET",
    worldPos: [-4.895, 1.398, -0.208],
    approachNormal: [1, 0, 0],
    standoffGantryPos: [-4.16, 1.56, -0.2],
    gripType: "button",
    minValue: 0,
    maxValue: 1,
    wristSpinTurns: 0,
    readValue: () => {
      const s = useGameStore.getState();
      return s.auxLoopBActive && !s.turbines[0]?.tripped ? 1 : 0;
    },
    writeValue: (v) => {
      const s = useGameStore.getState();
      if (s.turbines[0]?.tripped && v >= 0.5) {
        s.resetTurbineTrip();
      } else {
        s.toggleAuxLoopB(v >= 0.5);
      }
    },
  },

  // =========================================================================
  // OKEAN-84 RADIO — POWER SWITCH & VOLUME KNOB
  // =========================================================================
  radioPower: {
    id: "radioPower",
    station: "RADIO",
    label: "OKEAN-84 POWER SWITCH",
    worldPos: [5.471, 0.809, 1.37],
    approachNormal: [-0.984, 0, -0.179],
    standoffGantryPos: [4.48, 1.46, 1.38],
    gripType: "button",
    minValue: 0,
    maxValue: 1,
    wristSpinTurns: 0,
    readValue: () => (useGameStore.getState().radioOn ? 1 : 0),
    writeValue: (v) => useGameStore.getState().setRadioOn(v >= 0.5),
  },
  radioVolume: {
    id: "radioVolume",
    station: "RADIO",
    label: "OKEAN-84 ROTARY VOLUME KNOB",
    worldPos: [5.396, 0.952, 1.682],
    approachNormal: [-0.984, 0, -0.179],
    standoffGantryPos: [4.48, 1.5, 1.68],
    gripType: "knob",
    minValue: 0,
    maxValue: 100,
    wristSpinTurns: 0.85,
    readValue: () => useGameStore.getState().radioVolume,
    writeValue: (v) =>
      useGameStore.getState().setRadioVolume(Math.round(v)),
  },
};

const TARGET_ALIAS_MAP: Readonly<Record<string, string>> = {
  pripyat: "sector_0",
  duga: "sector_1",
  kolkhoz: "sector_2",
  kgb: "sector_3",
  vodka: "sector_4",
  steel: "sector_5",
  steamvent: "bubblerDrain",
  steam_vent: "bubblerDrain",
  steamdump: "bubblerDrain",
  steam_dump: "bubblerDrain",
  nitrogenloopvalve: "feedwaterValve",
  feedwater: "feedwaterValve",
  ventilation: "auxVentilation",
  kgbline: "auxKgbLine",
  condenser: "auxCondenserVac",
  condenservac: "auxCondenserVac",
  auxloopb: "auxCondenserVac",
  radiovol: "radioVolume",
};

function resolveKomradTarget(
  rawId: string,
): { target: KomradControlTargetSpec; explicitChannel: number | null } | null {
  if (!rawId || typeof rawId !== "string") return null;
  const trimmed = rawId.trim();
  const direct = KOMRAD_CONTROL_TARGETS[trimmed];
  if (direct) {
    return { target: direct, explicitChannel: null };
  }

  const lower = trimmed.toLowerCase();
  const tileMatch = /^corechanneltile[_:-]?(\d+)$/i.exec(lower);
  if (tileMatch) {
    const idx = THREE.MathUtils.clamp(Number(tileMatch[1]), 0, 36);
    return {
      target: KOMRAD_CONTROL_TARGETS.coreChannelTile,
      explicitChannel: idx,
    };
  }

  const aliasId = TARGET_ALIAS_MAP[lower];
  if (aliasId && KOMRAD_CONTROL_TARGETS[aliasId]) {
    return { target: KOMRAD_CONTROL_TARGETS[aliasId], explicitChannel: null };
  }

  for (const key of Object.keys(KOMRAD_CONTROL_TARGETS)) {
    if (key.toLowerCase() === lower) {
      return { target: KOMRAD_CONTROL_TARGETS[key], explicitChannel: null };
    }
  }

  return null;
}

export function registerKomradControlObject(
  key: string,
  obj: THREE.Object3D | null,
  localOffset?: readonly [number, number, number],
): void {
  if (!obj) {
    liveAnchorMap.delete(key);
    return;
  }
  liveAnchorMap.set(key, {
    obj,
    offsetX: localOffset ? localOffset[0] : 0,
    offsetY: localOffset ? localOffset[1] : 0,
    offsetZ: localOffset ? localOffset[2] : 0,
  });
}

export function notifyPlayerControlInteraction(
  targetId: string,
  active: boolean,
): void {
  if (active) {
    activePlayerControls.add(targetId);
    if (
      _armFrameState.active &&
      _armFrameState.targetId === targetId &&
      _armFrameState.phase !== "release_and_retract"
    ) {
      cancelKomradActuation();
    }
  } else {
    activePlayerControls.delete(targetId);
  }
}

export function getKomradControlVisualOverride(key: string): number {
  const v = visualOverrideMap.get(key);
  return v === undefined ? -1 : v;
}

export function getLiveControlWorldPos(
  targetId: string,
  channelIndex: number,
  outPos: THREE.Vector3,
  outNormal: THREE.Vector3,
): void {
  const spec = KOMRAD_CONTROL_TARGETS[targetId];
  if (spec) {
    outPos.set(spec.worldPos[0], spec.worldPos[1], spec.worldPos[2]);
    outNormal.set(
      spec.approachNormal[0],
      spec.approachNormal[1],
      spec.approachNormal[2],
    );
    if (outNormal.lengthSq() > 1e-6) {
      outNormal.normalize();
    } else {
      outNormal.set(0, 0, 1);
    }
  }

  const lookupKey =
    targetId === "coreChannelTile"
      ? `coreChannelTile_${channelIndex}`
      : targetId;
  const anchor = liveAnchorMap.get(lookupKey);
  if (anchor && anchor.obj) {
    anchor.obj.updateWorldMatrix(true, false);
    _liveAnchorLocal.set(anchor.offsetX, anchor.offsetY, anchor.offsetZ);
    outPos.copy(_liveAnchorLocal).applyMatrix4(anchor.obj.matrixWorld);
  }
}

/**
 * Zero-allocation 2-bone analytical Inverse Kinematics solver using Law of Cosines.
 * Writes shoulder-local orientation Quaternion and single-axis elbow hinge rotation (+X)
 * into `out` so a forearm of length `l2` hanging along local `-Y` from `(0, -l1, 0)`
 * places its wrist tip onto `targetLocal` (clamped safely inside reachable spherical shell).
 */
export function solveTwoBoneArmIK(
  targetLocal: THREE.Vector3,
  poleLocal: THREE.Vector3,
  l1: number,
  l2: number,
  out: TwoBoneIKResult,
): TwoBoneIKResult {
  const rawLen = targetLocal.length();
  const minReach = Math.max(0.16, Math.abs(l1 - l2) + 0.04);
  const maxReach = (l1 + l2) * 0.975;
  const d = THREE.MathUtils.clamp(rawLen, minReach, maxReach);
  out.clampedDist = d;

  if (rawLen > 1e-5) {
    _ikUDir.copy(targetLocal).divideScalar(rawLen);
  } else {
    _ikUDir.set(0, -1, 0);
  }

  // Project pole direction orthogonal to uDir to define bend plane
  const poleDot = poleLocal.dot(_ikUDir);
  _ikBend.copy(poleLocal).addScaledVector(_ikUDir, -poleDot);
  if (_ikBend.lengthSq() < 1e-6) {
    // Fallback orthogonal direction if pole aligns with reach vector
    const dotZ = _ikUDir.z;
    _ikBend.set(-_ikUDir.x * -dotZ, -_ikUDir.y * -dotZ, -1 - _ikUDir.z * -dotZ);
    if (_ikBend.lengthSq() < 1e-6) {
      const dotX = _ikUDir.x;
      _ikBend.set(1 - _ikUDir.x * dotX, -_ikUDir.y * dotX, -_ikUDir.z * dotX);
    }
  }
  _ikBend.normalize();

  const cosAlpha = THREE.MathUtils.clamp(
    (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d),
    -1,
    1,
  );
  const alpha = Math.acos(cosAlpha);

  const cosBeta = THREE.MathUtils.clamp(
    (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2),
    -1,
    1,
  );
  const beta = Math.acos(cosBeta);
  out.elbowAngleX = Math.PI - beta;

  _ikDUpper
    .copy(_ikUDir)
    .multiplyScalar(Math.cos(alpha))
    .addScaledVector(_ikBend, Math.sin(alpha))
    .normalize();

  out.elbowLocalPos.copy(_ikDUpper).multiplyScalar(l1);

  _ikXAxis.crossVectors(_ikBend, _ikUDir);
  if (_ikXAxis.lengthSq() < 1e-8) {
    _ikXAxis.set(1, 0, 0);
  } else {
    _ikXAxis.normalize();
  }
  _ikYAxis.copy(_ikDUpper).negate();
  _ikZAxis.crossVectors(_ikXAxis, _ikYAxis).normalize();
  _ikXAxis.crossVectors(_ikYAxis, _ikZAxis).normalize();

  _ikRotMat.makeBasis(_ikXAxis, _ikYAxis, _ikZAxis);
  out.upperQuat.setFromRotationMatrix(_ikRotMat);
  return out;
}

function chooseCloserArm(
  targetPos: THREE.Vector3,
  standoff: THREE.Vector3,
): KomradArmSide {
  const dx = targetPos.x - standoff.x;
  const dz = targetPos.z - standoff.z;
  const yaw = Math.atan2(dx, dz);
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);

  // Rotate left/right shoulder X offsets into world XZ around standoff Y axis
  _shoulderCheckA.set(
    standoff.x - MANIPULATOR_SHOULDER_LOCAL_X * cosY + MANIPULATOR_SHOULDER_LOCAL_Z * sinY,
    standoff.y + MANIPULATOR_SHOULDER_LOCAL_Y,
    standoff.z + MANIPULATOR_SHOULDER_LOCAL_X * sinY + MANIPULATOR_SHOULDER_LOCAL_Z * cosY,
  );
  _shoulderCheckB.set(
    standoff.x + MANIPULATOR_SHOULDER_LOCAL_X * cosY + MANIPULATOR_SHOULDER_LOCAL_Z * sinY,
    standoff.y + MANIPULATOR_SHOULDER_LOCAL_Y,
    standoff.z - MANIPULATOR_SHOULDER_LOCAL_X * sinY + MANIPULATOR_SHOULDER_LOCAL_Z * cosY,
  );
  _wristCheck.copy(targetPos);

  const distL = _shoulderCheckA.distanceToSquared(_wristCheck);
  const distR = _shoulderCheckB.distanceToSquared(_wristCheck);
  return distL <= distR ? "left" : "right";
}

export function commandKomradAdjustControl(
  targetId: string,
  targetValue: number,
  options?: KomradAdjustOptions,
): {
  ok: boolean;
  id?: string;
  arm?: KomradArmSide;
  fromValue?: number;
  targetValue?: number;
  durationSec?: number;
  error?: string;
} {
  const resolved = resolveKomradTarget(targetId);
  if (!resolved) {
    return { ok: false, error: `Unknown K.O.M.R.A.D.-84 control: ${targetId}` };
  }
  const spec = resolved.target;
  const channelIdx =
    spec.id === "coreChannelTile"
      ? THREE.MathUtils.clamp(
          Math.round(
            resolved.explicitChannel !== null
              ? resolved.explicitChannel
              : targetValue,
          ),
          0,
          36,
        )
      : 0;

  if (activePlayerControls.has(spec.id)) {
    return {
      ok: false,
      error: `Player is currently operating ${spec.id}; yielding.`,
    };
  }

  const clampedTarget =
    spec.id === "coreChannelTile"
      ? channelIdx
      : THREE.MathUtils.clamp(targetValue, spec.minValue, spec.maxValue);

  getLiveControlWorldPos(spec.id, channelIdx, _liveWorldPos, _liveWorldNormal);

  _armFrameState.targetWorldPos.copy(_liveWorldPos);
  _armFrameState.approachWorldNormal.copy(_liveWorldNormal);
  _armFrameState.standoffGantryPos.set(
    spec.standoffGantryPos[0],
    spec.standoffGantryPos[1],
    spec.standoffGantryPos[2],
  );
  _armFrameState.clawWorldPos
    .copy(_liveWorldPos)
    .addScaledVector(_liveWorldNormal, STANDOFF_CLEARANCE_M);

  const arm =
    options?.arm ??
    chooseCloserArm(_liveWorldPos, _armFrameState.standoffGantryPos);
  const startVal = spec.readValue();
  const dur = THREE.MathUtils.clamp(
    options?.durationSec ?? defaultDurationForGrip(spec.gripType),
    0.45,
    3.0,
  );

  // Clear previous transient overrides before starting new sequence
  visualOverrideMap.delete("boron");
  visualOverrideMap.delete("rodRefuelLever");
  visualOverrideMap.delete("emergSealLock");
  visualOverrideMap.delete("bubblerDrain");
  if (spec.id !== "az5" && spec.id !== "az5Cover") {
    visualOverrideMap.delete("az5Cover");
  }

  _armFrameState.active = true;
  _armFrameState.phase = "approach";
  _armFrameState.phaseTime = 0;
  _armFrameState.phaseDuration = dur;
  _armFrameState.targetId = spec.id;
  _armFrameState.channelIndex = channelIdx;
  _armFrameState.gripType = spec.gripType;
  _armFrameState.activeArm = arm;
  _armFrameState.ikBlend = 0;
  _armFrameState.clawOpen = 0.2;
  _armFrameState.wristRollRad = 0;
  _armFrameState.startValue = startVal;
  _armFrameState.targetValue = clampedTarget;
  _armFrameState.currentValue = startVal;

  latchSoundPlayed = false;
  releaseSoundPlayed = false;
  discreteActionFired = false;
  lastDetentBucket = -999999;

  return {
    ok: true,
    id: spec.id,
    arm,
    fromValue: startVal,
    targetValue: clampedTarget,
    durationSec: dur,
  };
}

export function cancelKomradActuation(): void {
  if (!_armFrameState.active) return;
  if (_armFrameState.phase === "release_and_retract") return;

  _armFrameState.phase = "release_and_retract";
  _armFrameState.phaseTime = 0;
  if (!releaseSoundPlayed) {
    releaseSoundPlayed = true;
    safePlaySwitchClank(false);
  }
}

export function getKomradArmFrameState(): Readonly<KomradArmFrameState> {
  return _armFrameState;
}

export function stepKomradArmController(
  dt: number,
  turretX: number,
  turretY: number,
  turretZ: number,
  turretYaw: number,
): Readonly<KomradArmFrameState> {
  if (!_armFrameState.active || !_armFrameState.targetId) {
    return _armFrameState;
  }

  const spec = KOMRAD_CONTROL_TARGETS[_armFrameState.targetId];
  if (!spec) {
    _armFrameState.active = false;
    _armFrameState.phase = "idle";
    _armFrameState.ikBlend = 0;
    return _armFrameState;
  }

  // Refresh live moving world position if the mesh shifted
  getLiveControlWorldPos(
    spec.id,
    _armFrameState.channelIndex,
    _liveWorldPos,
    _liveWorldNormal,
  );
  _armFrameState.targetWorldPos.copy(_liveWorldPos);
  _armFrameState.approachWorldNormal.copy(_liveWorldNormal);

  // Yield immediately if player grabs the active control
  if (
    activePlayerControls.has(spec.id) &&
    _armFrameState.phase !== "release_and_retract"
  ) {
    cancelKomradActuation();
  }

  _armFrameState.phaseTime += dt;

  switch (_armFrameState.phase) {
    case "approach": {
      _armFrameState.ikBlend = 0;
      _armFrameState.clawOpen = THREE.MathUtils.damp(
        _armFrameState.clawOpen,
        0.85,
        8,
        dt,
      );
      _armFrameState.clawWorldPos
        .copy(_liveWorldPos)
        .addScaledVector(_liveWorldNormal, STANDOFF_CLEARANCE_M);

      const distXZ = Math.hypot(
        _armFrameState.standoffGantryPos.x - turretX,
        _armFrameState.standoffGantryPos.z - turretZ,
      );
      const distY = Math.abs(_armFrameState.standoffGantryPos.y - turretY);
      const desiredYaw = Math.atan2(
        _liveWorldPos.x - turretX,
        _liveWorldPos.z - turretZ,
      );
      const yawErr = Math.abs(wrapAngleRad(desiredYaw - turretYaw));

      const arrived = distXZ < 0.16 && distY < 0.18 && yawErr < 0.3;
      if (arrived || _armFrameState.phaseTime >= APPROACH_TIMEOUT_SEC) {
        _armFrameState.phase = "reach_and_latch";
        _armFrameState.phaseTime = 0;
        latchSoundPlayed = false;
        if (spec.id === "az5") {
          visualOverrideMap.set("az5Cover", 1);
        }
      }
      break;
    }

    case "reach_and_latch": {
      const p = THREE.MathUtils.clamp(
        _armFrameState.phaseTime / REACH_LATCH_DURATION_SEC,
        0,
        1,
      );
      _armFrameState.ikBlend = smoothstep01(Math.min(1, p / 0.72));

      if (p < 0.72) {
        // Extend arm to standoff point in front of control with open pincers
        _armFrameState.clawOpen = 1.0;
        _armFrameState.clawWorldPos
          .copy(_liveWorldPos)
          .addScaledVector(_liveWorldNormal, STANDOFF_CLEARANCE_M);
      } else {
        // Plunge onto handle / button and clamp 3-prong gripper shut
        const seatU = smoothstep01((p - 0.72) / 0.28);
        const closedOpen = spec.gripType === "button" ? 0.12 : 0.18;
        _armFrameState.clawOpen = THREE.MathUtils.lerp(1.0, closedOpen, seatU);
        _armFrameState.clawWorldPos
          .copy(_liveWorldPos)
          .addScaledVector(
            _liveWorldNormal,
            STANDOFF_CLEARANCE_M * (1 - seatU),
          );
        if (!latchSoundPlayed && seatU > 0.45) {
          latchSoundPlayed = true;
          safePlaySwitchClank(true);
        }
      }

      if (p >= 1) {
        _armFrameState.phase = "actuate";
        _armFrameState.phaseTime = 0;
        discreteActionFired = false;
        _armFrameState.startValue = spec.readValue();
        lastDetentBucket = Math.round(_armFrameState.startValue);
      }
      break;
    }

    case "actuate": {
      const dur = Math.max(0.25, _armFrameState.phaseDuration);
      const p = THREE.MathUtils.clamp(_armFrameState.phaseTime / dur, 0, 1);
      const eased = smoothstep01(p);
      _armFrameState.ikBlend = 1;

      if (spec.gripType === "button") {
        // Triangular poke stroke: push inward -normal by 2.4cm around mid-stroke
        const poke = Math.sin(p * Math.PI);
        _armFrameState.clawOpen = 0.12;
        _armFrameState.clawWorldPos
          .copy(_liveWorldPos)
          .addScaledVector(_liveWorldNormal, -poke * BUTTON_POKE_DEPTH_M);

        if (spec.id === "boron") {
          visualOverrideMap.set("boron", poke);
        } else if (spec.id === "emergSealLock") {
          visualOverrideMap.set("emergSealLock", poke);
        }

        if (!discreteActionFired && p >= 0.45) {
          discreteActionFired = true;
          spec.writeValue(_armFrameState.targetValue);
          _armFrameState.currentValue = _armFrameState.targetValue;
          safePlaySwitchClank(true);
          safePlayDetentClick(3);
        }
      } else {
        _armFrameState.clawOpen = 0.18;
        const val = THREE.MathUtils.lerp(
          _armFrameState.startValue,
          _armFrameState.targetValue,
          eased,
        );
        _armFrameState.currentValue = val;

        // Spin wrist chuck for wheels & rotary knobs proportional to value delta
        const range = Math.max(1, spec.maxValue - spec.minValue);
        const dirSign =
          _armFrameState.targetValue >= _armFrameState.startValue ? 1 : -1;
        const normMoved =
          Math.abs(val - _armFrameState.startValue) / range;
        if (spec.wristSpinTurns > 0) {
          _armFrameState.wristRollRad =
            dirSign * normMoved * Math.PI * 2 * spec.wristSpinTurns;
        }

        if (spec.id === "rodRefuelLever") {
          visualOverrideMap.set(
            "rodRefuelLever",
            THREE.MathUtils.clamp(val, 0, 1),
          );
          spec.writeValue(val);
        } else if (spec.id === "az5Cover") {
          visualOverrideMap.set("az5Cover", eased >= 0.35 ? (_armFrameState.targetValue >= 0.5 ? 1 : 0) : (_armFrameState.startValue >= 0.5 ? 1 : 0));
          spec.writeValue(val);
        } else if (spec.id === "bubblerDrain") {
          visualOverrideMap.set(
            "bubblerDrain",
            THREE.MathUtils.clamp(val, 0, 1),
          );
          if (!discreteActionFired && eased >= 0.5) {
            discreteActionFired = true;
            spec.writeValue(_armFrameState.targetValue);
          }
        } else {
          spec.writeValue(val);
        }

        // Play discrete detent ticks as value advances
        const stepSize =
          spec.id.startsWith("sector_") ? 25 : spec.gripType === "knob" ? 5 : 4;
        const bucket = Math.round(val / stepSize);
        if (bucket !== lastDetentBucket) {
          lastDetentBucket = bucket;
          safePlayDetentClick((Math.abs(bucket) % 5) + 1);
        }

        // Track live moving mesh position on this frame
        getLiveControlWorldPos(
          spec.id,
          _armFrameState.channelIndex,
          _liveWorldPos,
          _liveWorldNormal,
        );
        _armFrameState.clawWorldPos.copy(_liveWorldPos);
      }

      if (p >= 1) {
        if (spec.id === "az5" || spec.id === "az5Cover") {
          visualOverrideMap.delete("az5Cover");
        }
        _armFrameState.phase = "release_and_retract";
        _armFrameState.phaseTime = 0;
        releaseSoundPlayed = false;
      }
      break;
    }

    case "release_and_retract": {
      const p = THREE.MathUtils.clamp(
        _armFrameState.phaseTime / RELEASE_RETRACT_DURATION_SEC,
        0,
        1,
      );
      if (!releaseSoundPlayed) {
        releaseSoundPlayed = true;
        safePlaySwitchClank(false);
        visualOverrideMap.delete("boron");
        visualOverrideMap.delete("rodRefuelLever");
        visualOverrideMap.delete("emergSealLock");
        visualOverrideMap.delete("bubblerDrain");
        if (spec.id === "az5" || spec.id === "az5Cover") {
          visualOverrideMap.delete("az5Cover");
        }
      }

      if (p < 0.3) {
        const u = smoothstep01(p / 0.3);
        _armFrameState.ikBlend = 1;
        _armFrameState.clawOpen = THREE.MathUtils.lerp(0.18, 0.92, u);
        _armFrameState.clawWorldPos
          .copy(_liveWorldPos)
          .addScaledVector(_liveWorldNormal, STANDOFF_CLEARANCE_M * u);
      } else {
        const r = smoothstep01((p - 0.3) / 0.7);
        _armFrameState.ikBlend = 1 - r;
        _armFrameState.clawOpen = THREE.MathUtils.lerp(0.92, 0.2, r);
        _armFrameState.wristRollRad *= 1 - r;
      }

      if (p >= 1) {
        _armFrameState.active = false;
        _armFrameState.phase = "idle";
        _armFrameState.phaseTime = 0;
        _armFrameState.targetId = null;
        _armFrameState.ikBlend = 0;
        _armFrameState.wristRollRad = 0;
      }
      break;
    }

    case "idle":
    default: {
      _armFrameState.active = false;
      _armFrameState.ikBlend = 0;
      break;
    }
  }

  return _armFrameState;
}

export interface KomradTargetSummary {
  id: string;
  station: KomradControlStation;
  label: string;
  gripType: KomradGripType;
  minValue: number;
  maxValue: number;
  currentValue: number;
  worldPos: readonly [number, number, number];
  standoffGantryPos: readonly [number, number, number];
}

export function listKomradControlTargets(): KomradTargetSummary[] {
  return Object.values(KOMRAD_CONTROL_TARGETS).map((spec) => ({
    id: spec.id,
    station: spec.station,
    label: spec.label,
    gripType: spec.gripType,
    minValue: spec.minValue,
    maxValue: spec.maxValue,
    currentValue: Number(spec.readValue().toFixed(2)),
    worldPos: spec.worldPos,
    standoffGantryPos: spec.standoffGantryPos,
  }));
}

export interface KomradArmDebugApi {
  readonly AUTONOMOUS_ENABLED: boolean;
  adjust: typeof commandKomradAdjustControl;
  cancel: typeof cancelKomradActuation;
  listTargets: typeof listKomradControlTargets;
  getState: () => {
    active: boolean;
    phase: KomradActuationPhase;
    targetId: string | null;
    channelIndex: number;
    activeArm: KomradArmSide;
    gripType: KomradGripType;
    ikBlend: number;
    clawOpen: number;
    currentValue: number;
    targetValue: number;
    standoffGantryPos: [number, number, number];
    targetWorldPos: [number, number, number];
  };
}

declare global {
  interface Window {
    __komradArm?: KomradArmDebugApi;
  }
}

export function installKomradArmWindowApi(): void {
  if (typeof window === "undefined") return;
  window.__komradArm = {
    get AUTONOMOUS_ENABLED() {
      return AUTONOMOUS_KOMRAD_ACTUATION_ENABLED;
    },
    adjust: commandKomradAdjustControl,
    cancel: cancelKomradActuation,
    listTargets: listKomradControlTargets,
    getState: () => ({
      active: _armFrameState.active,
      phase: _armFrameState.phase,
      targetId: _armFrameState.targetId,
      channelIndex: _armFrameState.channelIndex,
      activeArm: _armFrameState.activeArm,
      gripType: _armFrameState.gripType,
      ikBlend: Number(_armFrameState.ikBlend.toFixed(3)),
      clawOpen: Number(_armFrameState.clawOpen.toFixed(3)),
      currentValue: Number(_armFrameState.currentValue.toFixed(2)),
      targetValue: Number(_armFrameState.targetValue.toFixed(2)),
      standoffGantryPos: [
        _armFrameState.standoffGantryPos.x,
        _armFrameState.standoffGantryPos.y,
        _armFrameState.standoffGantryPos.z,
      ],
      targetWorldPos: [
        _armFrameState.targetWorldPos.x,
        _armFrameState.targetWorldPos.y,
        _armFrameState.targetWorldPos.z,
      ],
    }),
  };
}

installKomradArmWindowApi();
