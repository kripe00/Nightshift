import { useFrame } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getSkalaDiagFeedElement } from "../modules/inspector/audio";
import {
  controlRoomPowerState,
  getKomradPixelSprites,
  type KomradPixelSpriteBank,
  type KomradPortraitPose,
} from "./ControlRoomScene";
import { NOOP_RAYCAST } from "./ExteriorDioramas3D";
import {
  getKomradVowelBand,
  playTurretServoWhir,
  stepKomradSpeech,
  type KomradVowelKey,
} from "./komradVoiceSynth";
import {
  cancelKomradActuation,
  MANIPULATOR_CLAW_LEN,
  MANIPULATOR_FOREARM_LEN,
  MANIPULATOR_SHOULDER_LOCAL_X,
  MANIPULATOR_SHOULDER_LOCAL_Y,
  MANIPULATOR_SHOULDER_LOCAL_Z,
  MANIPULATOR_UPPER_LEN,
  solveTwoBoneArmIK,
  stepKomradArmController,
  type TwoBoneIKResult,
} from "./komradArmController";
import { onKremlinFontReady } from "./kremlinFontReady";
import {
  getBrushedBrassTextures,
  getHammeredIronTextures,
} from "./proceduralMaterials";
import type { KomradMood } from "./types";
import { useGameStore } from "./useGameStore";

const GANTRY_RAIL_Y = 3.76;
const GANTRY_RAIL_HALF_X = 4.65;
const GANTRY_RAIL_Z_MIN = -1.65;
const GANTRY_RAIL_Z_MAX = 2.1;
const GANTRY_BRIDGE_Y = 3.7;
const GANTRY_SHOULDER_OFFSET_Y = -0.06; // Upper mount collar Y = 3.64m
const SPINE_DROP_MIN = 0.04;
const SPINE_DROP_MAX = 1.35;
const ARM_SEG_LEN = 0.68;

const PATROL_X_MIN = -3.38;
const PATROL_X_MAX = 3.85;
const PATROL_Z_MIN = -1.5;
const PATROL_Z_MAX = 1.25;

const INITIAL_TROLLEY_X = 0.0;
const INITIAL_TROLLEY_Z = -0.15;
const INITIAL_YAW = 0.0;

const ACTUATION_X_MIN = -4.42;
const ACTUATION_X_MAX = 4.48;
const ACTUATION_Z_MIN = -1.48;
const ACTUATION_Z_MAX = 1.95;
const ACTUATION_Y_MIN = 1.4;
const ACTUATION_Y_MAX = 2.35;

const TURRET_Y_EYE_MIN = 1.65;
const TURRET_Y_EYE_MAX = 2.05;

const TURRET_PITCH_MIN = -0.34;
const TURRET_PITCH_MAX = 0.22;
const TURRET_ACTUATION_PITCH_MIN = -0.52;
const TURRET_ACTUATION_PITCH_MAX = 0.24;
const TURRET_BLACKOUT_PITCH = -0.46;
const TURRET_SLEW_WHIR_THRESHOLD_RAD = (28 * Math.PI) / 180;

const MIN_PLAYER_DIST = 2.45;
const HEAD_FORWARD_OFFSET = 0.48;
const MIN_TROLLEY_DIST = MIN_PLAYER_DIST + HEAD_FORWARD_OFFSET + 0.02;
const PUSH_TARGET_TROLLEY_DIST = 3.25;
const IDEAL_TROLLEY_DIST = 3.45;
const MAX_TROLLEY_DIST = 4.05;

const PLAYER_MOVE_DEADBAND_M = 0.65;
const SUPERVISORY_DRIFT_INTERVAL_SEC = 6.5;
const SUPERVISORY_DRIFT_STEP_M = 0.42;

const MAX_FRAME_DT = 0.05;
const CRANE_PATROL_MAX_SPEED_XZ = 1.35;
const CRANE_PATROL_RETREAT_MAX_SPEED_XZ = 4.8;
const CRANE_PATROL_MAX_ACCEL_XZ = 2.6;
const CRANE_PATROL_SMOOTH_TIME_XZ = 0.85;
const CRANE_PATROL_MAX_SPEED_Y = 0.65;
const CRANE_PATROL_MAX_ACCEL_Y = 1.6;
const CRANE_PATROL_SMOOTH_TIME_Y = 0.75;

const CRANE_ACTUATION_MAX_SPEED_XZ = 5.2;
const CRANE_ACTUATION_MAX_ACCEL_XZ = 14.0;
const CRANE_ACTUATION_SMOOTH_TIME_XZ = 0.28;
const CRANE_ACTUATION_MAX_SPEED_Y = 2.2;
const CRANE_ACTUATION_MAX_ACCEL_Y = 7.0;
const CRANE_ACTUATION_SMOOTH_TIME_Y = 0.26;

const DANCE_ANCHOR_X = 1.9;
const DANCE_ANCHOR_Z = -1.4;
const DANCE_BASE_Y = 1.88;
const DANCE_BPM = 126;
const DANCE_BEATS_PER_SEC = DANCE_BPM / 60;
const DANCE_PERSONAL_SPACE_DIST = MIN_TROLLEY_DIST;
const DANCE_PUSH_RADIUS = PUSH_TARGET_TROLLEY_DIST;
const DANCE_CRANE_MAX_SPEED_XZ = 3.2;
const DANCE_CRANE_MAX_ACCEL_XZ = 11.0;
const DANCE_CRANE_SMOOTH_TIME_XZ = 0.22;
const DANCE_CRANE_MAX_SPEED_Y = 2.4;
const DANCE_CRANE_MAX_ACCEL_Y = 12.0;
const DANCE_CRANE_SMOOTH_TIME_Y = 0.16;

interface KeepOutOBB {
  readonly cx: number;
  readonly cz: number;
  readonly halfW: number;
  readonly halfD: number;
  readonly cosR: number;
  readonly sinR: number;
  readonly clearance: number;
}

const PATROL_KEEP_OUT_OBBS: readonly KeepOutOBB[] = [
  // UNIT A / A-2 Left Operator Wing (15 deg)
  {
    cx: -3.61,
    cz: -1.49,
    halfW: 1.68,
    halfD: 0.68,
    cosR: Math.cos((15 * Math.PI) / 180),
    sinR: Math.sin((15 * Math.PI) / 180),
    clearance: 1.28,
  },
  // UNIT B Right Operator Wing (-18 deg)
  {
    cx: 4.24,
    cz: -1.25,
    halfW: 0.96,
    halfD: 0.74,
    cosR: Math.cos((-18 * Math.PI) / 180),
    sinR: Math.sin((-18 * Math.PI) / 180),
    clearance: 1.28,
  },
  // ISKRA-84 Supervisor Desk + Seated Player Zone
  {
    cx: 0.0,
    cz: 1.8,
    halfW: 1.28,
    halfD: 0.46,
    cosR: 1,
    sinR: 0,
    clearance: 1.25,
  },
];

const PATROL_CORRIDOR_SPINE: readonly (readonly [number, number])[] = [
  [-3.15, 1.18],
  [-2.85, 0.55],
  [-2.15, 0.2],
  [-0.55, -0.35],
  [0.35, -1.2],
  [1.75, -1.2],
  [2.327, 0.181],
  [2.95, 0.55],
  [3.45, 1.18],
];

const PATROL_SAFE_WAYPOINTS: readonly (readonly [number, number])[] = [
  ...PATROL_CORRIDOR_SPINE,
  [-0.5, -1.45],
  [0.55, -1.45],
  [1.75, -1.45],
  [0.35, -0.15],
  [1.65, -0.15],
];

const PERSONAL_SPACE_SWEEP_OFFSETS: readonly number[] = [
  0,
  0.35,
  -0.35,
  0.7,
  -0.7,
  1.05,
  -1.05,
  1.4,
  -1.4,
  1.75,
  -1.75,
  2.1,
  -2.1,
  2.45,
  -2.45,
  2.8,
  -2.8,
  Math.PI,
];

interface XZPoint {
  x: number;
  z: number;
}

interface CraneXZStepOut {
  x: number;
  z: number;
  vx: number;
  vz: number;
}

interface Crane1DStepOut {
  value: number;
  velocity: number;
}

export interface PanopticonTargetInput {
  camPos: { readonly x: number; readonly y: number; readonly z: number };
  refX: number;
  refZ: number;
  curX: number;
  curZ: number;
  preferredSide: -1 | 1;
  isSeatedAtDesk: boolean;
  isTalking: boolean;
  mood: KomradMood;
  isBlackout: boolean;
  elapsedSec: number;
}

export interface PanopticonTargetResult {
  targetX: number;
  targetY: number;
  targetZ: number;
  chosenFlank: -1 | 1;
}

const _projTmp: XZPoint = { x: 0, z: 0 };
const _driftProjTmp: XZPoint = { x: 0, z: 0 };
const _steerTmp: XZPoint = { x: 0, z: 0 };
const _danceTargetTmp: XZPoint = { x: DANCE_ANCHOR_X, z: DANCE_ANCHOR_Z };
const _craneXZOut: CraneXZStepOut = { x: 0, z: 0, vx: 0, vz: 0 };
const _craneYOut: Crane1DStepOut = { value: 1.96, velocity: 0 };
const _safeTargetOut: PanopticonTargetResult = {
  targetX: INITIAL_TROLLEY_X,
  targetY: 1.96,
  targetZ: INITIAL_TROLLEY_Z,
  chosenFlank: 1,
};

function distToOBB(x: number, z: number, obb: KeepOutOBB): number {
  const dx = x - obb.cx;
  const dz = z - obb.cz;
  const lx = dx * obb.cosR - dz * obb.sinR;
  const lz = dx * obb.sinR + dz * obb.cosR;
  const cx = THREE.MathUtils.clamp(lx, -obb.halfW, obb.halfW);
  const cz = THREE.MathUtils.clamp(lz, -obb.halfD, obb.halfD);
  return Math.hypot(lx - cx, lz - cz);
}

function pushPointOutOfOBB(pt: XZPoint, obb: KeepOutOBB): void {
  const dx = pt.x - obb.cx;
  const dz = pt.z - obb.cz;
  const lx = dx * obb.cosR - dz * obb.sinR;
  const lz = dx * obb.sinR + dz * obb.cosR;
  const rx = lx - THREE.MathUtils.clamp(lx, -obb.halfW, obb.halfW);
  const rz = lz - THREE.MathUtils.clamp(lz, -obb.halfD, obb.halfD);
  const dSq = rx * rx + rz * rz;
  if (dSq >= obb.clearance * obb.clearance) return;

  let plx = 0;
  let plz = 0;
  if (dSq > 1e-8) {
    const d = Math.sqrt(dSq);
    const push = obb.clearance - d + 0.002;
    plx = (rx / d) * push;
    plz = (rz / d) * push;
  } else {
    const penX = obb.halfW - Math.abs(lx);
    const penZ = obb.halfD - Math.abs(lz);
    if (penX < penZ) {
      plx = (lx >= 0 ? 1 : -1) * (penX + obb.clearance + 0.002);
    } else {
      plz = (lz >= 0 ? 1 : -1) * (penZ + obb.clearance + 0.002);
    }
  }
  pt.x += plx * obb.cosR + plz * obb.sinR;
  pt.z += -plx * obb.sinR + plz * obb.cosR;
}

function projectOntoSafeCorridor(x: number, z: number, out: XZPoint): void {
  out.x = x;
  out.z = z;
  for (let pass = 0; pass < 4; pass++) {
    out.x = THREE.MathUtils.clamp(out.x, PATROL_X_MIN, PATROL_X_MAX);
    out.z = THREE.MathUtils.clamp(out.z, PATROL_Z_MIN, PATROL_Z_MAX);
    for (let i = 0; i < PATROL_KEEP_OUT_OBBS.length; i++) {
      pushPointOutOfOBB(out, PATROL_KEEP_OUT_OBBS[i]);
    }
  }
  out.x = THREE.MathUtils.clamp(out.x, PATROL_X_MIN, PATROL_X_MAX);
  out.z = THREE.MathUtils.clamp(out.z, PATROL_Z_MIN, PATROL_Z_MAX);
}

function isStrictlySafeCorridor(x: number, z: number): boolean {
  if (
    x < PATROL_X_MIN - 1e-3 ||
    x > PATROL_X_MAX + 1e-3 ||
    z < PATROL_Z_MIN - 1e-3 ||
    z > PATROL_Z_MAX + 1e-3
  ) {
    return false;
  }
  for (let i = 0; i < PATROL_KEEP_OUT_OBBS.length; i++) {
    const obb = PATROL_KEEP_OUT_OBBS[i];
    if (distToOBB(x, z, obb) < obb.clearance - 0.015) return false;
  }
  return true;
}

function segmentMinDistToPoint(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
): number {
  const vx = bx - ax;
  const vz = bz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 1e-8) return Math.hypot(ax - cx, az - cz);
  const u = THREE.MathUtils.clamp(
    ((cx - ax) * vx + (cz - az) * vz) / lenSq,
    0,
    1,
  );
  return Math.hypot(ax + vx * u - cx, az + vz * u - cz);
}

function segmentClearsDesk(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): boolean {
  const desk = PATROL_KEEP_OUT_OBBS[2];
  for (let k = 1; k <= 4; k++) {
    const u = k / 5;
    if (
      distToOBB(ax + (bx - ax) * u, az + (bz - az) * u, desk) <
      desk.clearance - 0.08
    ) {
      return false;
    }
  }
  return true;
}

function nearestSpineIndex(x: number, z: number): number {
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < PATROL_CORRIDOR_SPINE.length; i++) {
    const node = PATROL_CORRIDOR_SPINE[i];
    const d = Math.hypot(x - node[0], z - node[1]);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return bestI;
}

/**
 * Computes K.O.M.R.A.D.-84's eye-level overhead gantry anchor (X, Y, Z) with zero
 * camera-look dependence, enforcing a 360-degree personal-space buffer around the player
 * inside the central safe ceiling-rail corridor and around static console/desk OBBs.
 */
export function computeSafePanopticonTarget( // oxlint-disable-line react/only-export-components
  input: PanopticonTargetInput,
  out: PanopticonTargetResult = _safeTargetOut,
): PanopticonTargetResult {
  const {
    camPos,
    refX,
    refZ,
    curX,
    curZ,
    preferredSide,
    isSeatedAtDesk,
    isTalking,
    mood,
    isBlackout,
    elapsedSec,
  } = input;

  if (isBlackout) {
    out.targetX = curX;
    out.targetY = 2.25;
    out.targetZ = curZ;
    out.chosenFlank = preferredSide;
    return out;
  }

  const targetY = THREE.MathUtils.clamp(
    mood === "critical"
      ? 1.68
      : isTalking || isSeatedAtDesk
        ? 1.74
        : mood === "warning"
          ? 1.85
          : 1.96 + Math.sin(elapsedSec * 0.8) * 0.05,
    TURRET_Y_EYE_MIN,
    TURRET_Y_EYE_MAX,
  );

  projectOntoSafeCorridor(refX, refZ, _projTmp);
  const candX = _projTmp.x;
  const candZ = _projTmp.z;
  const distRef = Math.hypot(candX - camPos.x, candZ - camPos.z);

  if (
    isStrictlySafeCorridor(candX, candZ) &&
    distRef >= MIN_TROLLEY_DIST &&
    distRef <= MAX_TROLLEY_DIST
  ) {
    out.targetX = candX;
    out.targetY = targetY;
    out.targetZ = candZ;
    out.chosenFlank = candX >= 0.25 ? 1 : candX <= -0.25 ? -1 : preferredSide;
    return out;
  }

  let dx = curX - camPos.x;
  let dz = curZ - camPos.z;
  if (Math.hypot(dx, dz) < 0.08) {
    dx = preferredSide * 0.85;
    dz = camPos.z > 0.2 ? -0.55 : 0.55;
  }
  const baseAngle = Math.atan2(dz, dx);
  const primaryRad =
    distRef > MAX_TROLLEY_DIST ? IDEAL_TROLLEY_DIST : PUSH_TARGET_TROLLEY_DIST;
  const secondaryRad =
    primaryRad === PUSH_TARGET_TROLLEY_DIST
      ? IDEAL_TROLLEY_DIST
      : PUSH_TARGET_TROLLEY_DIST;

  let bestX = candX;
  let bestZ = candZ;
  let bestScore = Infinity;
  let foundValid = false;

  for (let rIdx = 0; rIdx < 2; rIdx++) {
    const rad = rIdx === 0 ? primaryRad : secondaryRad;
    for (let i = 0; i < PERSONAL_SPACE_SWEEP_OFFSETS.length; i++) {
      const ang = baseAngle + PERSONAL_SPACE_SWEEP_OFFSETS[i] * preferredSide;
      projectOntoSafeCorridor(
        camPos.x + Math.cos(ang) * rad,
        camPos.z + Math.sin(ang) * rad,
        _projTmp,
      );
      const px = _projTmp.x;
      const pz = _projTmp.z;
      if (!isStrictlySafeCorridor(px, pz)) continue;
      const dCam = Math.hypot(px - camPos.x, pz - camPos.z);
      if (dCam < MIN_TROLLEY_DIST) continue;

      const travel = Math.hypot(px - curX, pz - curZ);
      const distErr = Math.abs(dCam - IDEAL_TROLLEY_DIST);
      const flipPen =
        px * preferredSide < -0.25 && curX * preferredSide > 0.25 ? 0.5 : 0;
      const overMaxPen =
        dCam > MAX_TROLLEY_DIST ? (dCam - MAX_TROLLEY_DIST) * 1.4 : 0;
      const segMinD = segmentMinDistToPoint(
        curX,
        curZ,
        px,
        pz,
        camPos.x,
        camPos.z,
      );
      const pathCutPen =
        segMinD < MIN_TROLLEY_DIST - 0.25
          ? (MIN_TROLLEY_DIST - 0.25 - segMinD) * 2.2
          : 0;
      const cornerPen = pz > 0.75 && Math.abs(px) > 2.8 ? 0.65 : 0;
      const score =
        travel +
        distErr * 0.45 +
        overMaxPen +
        flipPen +
        pathCutPen +
        cornerPen;
      if (score < bestScore) {
        bestScore = score;
        bestX = px;
        bestZ = pz;
        foundValid = true;
      }
    }
  }

  for (let i = 0; i < PATROL_SAFE_WAYPOINTS.length; i++) {
    const wp = PATROL_SAFE_WAYPOINTS[i];
    projectOntoSafeCorridor(wp[0], wp[1], _projTmp);
    const px = _projTmp.x;
    const pz = _projTmp.z;
    if (!isStrictlySafeCorridor(px, pz)) continue;
    const dCam = Math.hypot(px - camPos.x, pz - camPos.z);
    if (dCam < MIN_TROLLEY_DIST) continue;

    const travel = Math.hypot(px - curX, pz - curZ);
    const distErr = Math.abs(dCam - IDEAL_TROLLEY_DIST);
    const flipPen =
      px * preferredSide < -0.25 && curX * preferredSide > 0.25 ? 0.5 : 0;
    const overMaxPen =
      dCam > MAX_TROLLEY_DIST ? (dCam - MAX_TROLLEY_DIST) * 1.4 : 0;
    const segMinD = segmentMinDistToPoint(
      curX,
      curZ,
      px,
      pz,
      camPos.x,
      camPos.z,
    );
    const pathCutPen =
      segMinD < MIN_TROLLEY_DIST - 0.25
        ? (MIN_TROLLEY_DIST - 0.25 - segMinD) * 2.2
        : 0;
    const cornerPen = pz > 0.75 && Math.abs(px) > 2.8 ? 0.65 : 0;
    const score =
      travel +
      distErr * 0.45 +
      overMaxPen +
      flipPen +
      pathCutPen +
      cornerPen;
    if (score < bestScore) {
      bestScore = score;
      bestX = px;
      bestZ = pz;
      foundValid = true;
    }
  }

  if (!foundValid) {
    let maxD = -1;
    for (let i = 0; i < PATROL_SAFE_WAYPOINTS.length; i++) {
      const wp = PATROL_SAFE_WAYPOINTS[i];
      const dCam = Math.hypot(wp[0] - camPos.x, wp[1] - camPos.z);
      if (dCam > maxD) {
        maxD = dCam;
        bestX = wp[0];
        bestZ = wp[1];
      }
    }
  }

  out.targetX = bestX;
  out.targetY = targetY;
  out.targetZ = bestZ;
  out.chosenFlank = bestX > 0.35 ? 1 : bestX < -0.35 ? -1 : preferredSide;
  return out;
}

function computeCorridorSteerTarget(
  curX: number,
  curZ: number,
  anchorX: number,
  anchorZ: number,
  camX: number,
  camZ: number,
  out: XZPoint,
): void {
  const deskClear = segmentClearsDesk(curX, curZ, anchorX, anchorZ);
  const playerCut =
    segmentMinDistToPoint(curX, curZ, anchorX, anchorZ, camX, camZ) < MIN_TROLLEY_DIST &&
    Math.hypot(curX - anchorX, curZ - anchorZ) > 0.8;

  if (deskClear && !playerCut) {
    out.x = anchorX;
    out.z = anchorZ;
    return;
  }

  const curIdx = nearestSpineIndex(curX, curZ);
  const tgtIdx = nearestSpineIndex(anchorX, anchorZ);
  if (curIdx === tgtIdx) {
    out.x = anchorX;
    out.z = anchorZ;
    return;
  }

  const stepDir = tgtIdx > curIdx ? 1 : -1;
  const nextIdx = THREE.MathUtils.clamp(
    curIdx + stepDir,
    0,
    PATROL_CORRIDOR_SPINE.length - 1,
  );
  const nextNode = PATROL_CORRIDOR_SPINE[nextIdx];
  const dNext = Math.hypot(curX - nextNode[0], curZ - nextNode[1]);
  const pickIdx =
    dNext < 0.55 && nextIdx !== tgtIdx
      ? THREE.MathUtils.clamp(
          nextIdx + stepDir,
          0,
          PATROL_CORRIDOR_SPINE.length - 1,
        )
      : nextIdx;
  const pickNode = PATROL_CORRIDOR_SPINE[pickIdx];
  out.x = pickNode[0];
  out.z = pickNode[1];
}

function stepHeavyCraneXZ(
  curX: number,
  curZ: number,
  vx: number,
  vz: number,
  targetX: number,
  targetZ: number,
  dt: number,
  maxSpeed: number,
  maxAccel: number,
  smoothTime: number,
  enforcePatrolCorridor: boolean,
  out: CraneXZStepOut,
  keepOutCamX?: number,
  keepOutCamZ?: number,
  minCamDist?: number,
): CraneXZStepOut {
  if (dt <= 1e-5) {
    out.x = curX;
    out.z = curZ;
    out.vx = vx;
    out.vz = vz;
    return out;
  }

  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);

  const dx = curX - targetX;
  const dz = curZ - targetZ;
  const dist = Math.hypot(dx, dz);
  const maxChange = maxSpeed * smoothTime;
  const scale = dist > maxChange && dist > 1e-6 ? maxChange / dist : 1;
  const cx = dx * scale;
  const cz = dz * scale;

  const tempX = (vx + omega * cx) * dt;
  const tempZ = (vz + omega * cz) * dt;
  let dvx = (vx - omega * tempX) * exp;
  let dvz = (vz - omega * tempZ) * exp;

  const desSpd = Math.hypot(dvx, dvz);
  if (desSpd > maxSpeed && desSpd > 1e-6) {
    dvx = (dvx / desSpd) * maxSpeed;
    dvz = (dvz / desSpd) * maxSpeed;
  }

  const ax = dvx - vx;
  const az = dvz - vz;
  const aMag = Math.hypot(ax, az);
  const maxDv = maxAccel * dt;
  const nvx = aMag > maxDv && aMag > 1e-6 ? vx + (ax / aMag) * maxDv : dvx;
  const nvz = aMag > maxDv && aMag > 1e-6 ? vz + (az / aMag) * maxDv : dvz;

  let nextX = curX + nvx * dt;
  let nextZ = curZ + nvz * dt;

  if (enforcePatrolCorridor && isStrictlySafeCorridor(curX, curZ)) {
    projectOntoSafeCorridor(nextX, nextZ, _projTmp);
    nextX = _projTmp.x;
    nextZ = _projTmp.z;
  } else {
    nextX = THREE.MathUtils.clamp(nextX, ACTUATION_X_MIN, ACTUATION_X_MAX);
    nextZ = THREE.MathUtils.clamp(nextZ, ACTUATION_Z_MIN, ACTUATION_Z_MAX);
  }

  if (
    keepOutCamX !== undefined &&
    keepOutCamZ !== undefined &&
    minCamDist !== undefined &&
    minCamDist > 0
  ) {
    const kdx = nextX - keepOutCamX;
    const kdz = nextZ - keepOutCamZ;
    const kd = Math.hypot(kdx, kdz);
    if (kd < minCamDist) {
      let rx = kdx;
      let rz = kdz;
      if (kd < 1e-4) {
        const cdx = curX - keepOutCamX;
        const cdz = curZ - keepOutCamZ;
        const cd = Math.hypot(cdx, cdz);
        if (cd > 1e-4) {
          rx = cdx / cd;
          rz = cdz / cd;
        } else {
          rx = 0.85;
          rz = 0.45;
        }
      } else {
        rx /= kd;
        rz /= kd;
      }
      nextX = keepOutCamX + rx * minCamDist;
      nextZ = keepOutCamZ + rz * minCamDist;
      if (enforcePatrolCorridor && isStrictlySafeCorridor(curX, curZ)) {
        projectOntoSafeCorridor(nextX, nextZ, _projTmp);
        nextX = _projTmp.x;
        nextZ = _projTmp.z;
      } else {
        nextX = THREE.MathUtils.clamp(nextX, ACTUATION_X_MIN, ACTUATION_X_MAX);
        nextZ = THREE.MathUtils.clamp(nextZ, ACTUATION_Z_MIN, ACTUATION_Z_MAX);
      }
    }
  }

  out.x = nextX;
  out.z = nextZ;
  out.vx = (nextX - curX) / dt;
  out.vz = (nextZ - curZ) / dt;
  return out;
}

function stepHeavyCraneAxis1D(
  cur: number,
  vel: number,
  target: number,
  dt: number,
  maxSpeed: number,
  maxAccel: number,
  smoothTime: number,
  out: Crane1DStepOut,
): Crane1DStepOut {
  if (dt <= 1e-5) {
    out.value = cur;
    out.velocity = vel;
    return out;
  }

  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);

  const maxChange = maxSpeed * smoothTime;
  const change = THREE.MathUtils.clamp(cur - target, -maxChange, maxChange);
  const temp = (vel + omega * change) * dt;
  let desiredVel = (vel - omega * temp) * exp;
  desiredVel = THREE.MathUtils.clamp(desiredVel, -maxSpeed, maxSpeed);

  const maxDv = maxAccel * dt;
  const nextVel =
    vel + THREE.MathUtils.clamp(desiredVel - vel, -maxDv, maxDv);
  out.value = cur + nextVel * dt;
  out.velocity = nextVel;
  return out;
}

const CCTV_BASE_LENS_Z = 0.165;
const CCTV_ZOOM_EXTEND_M = 0.035;
const CCTV_MAX_YAW_RAD = (75 * Math.PI) / 180;
const CCTV_PITCH_MIN = (-52 * Math.PI) / 180;
const CCTV_PITCH_MAX = (-8 * Math.PI) / 180;
const CCTV_STARE_MAX_DIST = 4.5;
const CCTV_STARE_MIN_DOT = 0.94;

interface CctvMountSpec {
  readonly id: string;
  readonly pos: readonly [number, number, number];
  readonly baseYaw: number;
}

const CCTV_MOUNTS: readonly CctvMountSpec[] = [
  { id: "front-left-pilaster", pos: [-2.02, 3.18, -3.72], baseYaw: 0 },
  { id: "front-right-pilaster", pos: [2.02, 3.18, -3.72], baseYaw: 0 },
  { id: "rear-left-column", pos: [-2.4, 3.18, 4.16], baseYaw: Math.PI },
  { id: "rear-right-column", pos: [1.46, 3.18, 4.16], baseYaw: Math.PI },
];

// Pre-allocated scratch vectors & matrices for zero per-frame allocations inside useFrame
const _camForward = new THREE.Vector3();
const _toCctv = new THREE.Vector3();
const _armChassisInvMat = new THREE.Matrix4();
const _clawLocal = new THREE.Vector3();
const _normalLocal = new THREE.Vector3();
const _armTargetTmp = new THREE.Vector3();
const _armPoleTmp = new THREE.Vector3();
const _elbowQuatTmp = new THREE.Quaternion();
const _forearmQuatTmp = new THREE.Quaternion();
const _forearmInvQuatTmp = new THREE.Quaternion();
const _wristGripQuatTmp = new THREE.Quaternion();
const _wristIdleQuatTmp = new THREE.Quaternion();
const _wristChassisQuatTmp = new THREE.Quaternion();
const _wristBasisMatTmp = new THREE.Matrix4();
const _wristXAxis = new THREE.Vector3();
const _wristYAxis = new THREE.Vector3();
const _wristZAxis = new THREE.Vector3();
const _wristUpRef = new THREE.Vector3();
const _xAxisUnit = new THREE.Vector3(1, 0, 0);
const _turretCrtStandbyTint = new THREE.Color("#203626");
const _turretCrtFullTint = new THREE.Color("#ffffff");
const _opticStandbyLo = new THREE.Color("#d91818");
const _opticStandbyHi = new THREE.Color("#ff4433");
const _wristIdleRelQuat = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(0.28, 0, 0),
);
const _armIKOut: [TwoBoneIKResult, TwoBoneIKResult] = [
  {
    upperQuat: new THREE.Quaternion(),
    elbowAngleX: 0,
    elbowLocalPos: new THREE.Vector3(),
    clampedDist: 0.5,
  },
  {
    upperQuat: new THREE.Quaternion(),
    elbowAngleX: 0,
    elbowLocalPos: new THREE.Vector3(),
    clampedDist: 0.5,
  },
];

function wrapAngleRad(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function getTurretPalette(mood: KomradMood) {
  if (mood === "critical") {
    return {
      bg: "#160404",
      frame: "#611313",
      primary: "#ff4433",
      secondary: "#ffc2b8",
      dim: "#8f221b",
      armor: "#2b0808",
    };
  }
  if (mood === "warning") {
    return {
      bg: "#140d03",
      frame: "#573909",
      primary: "#ffb32c",
      secondary: "#ffe69e",
      dim: "#946110",
      armor: "#261805",
    };
  }
  return {
    bg: "#041209",
    frame: "#0f4722",
    primary: "#39ff7a",
    secondary: "#b8ffd0",
    dim: "#1d8c43",
    armor: "#0b2415",
  };
}

function createRadiationCheekTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#ffb000";
    ctx.fillRect(0, 0, 96, 96);
    ctx.strokeStyle = "#141414";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 90, 90);

    // Hazard bottom bar
    ctx.fillStyle = "#141414";
    ctx.fillRect(6, 72, 84, 18);
    ctx.fillStyle = "#ffb000";
    ctx.font = 'bold 12px "Courier Prime", monospace';
    ctx.textAlign = "center";
    ctx.fillText("SECTOR-84", 48, 85);

    // Radiation trefoil
    const cx = 48;
    const cy = 38;
    ctx.fillStyle = "#141414";
    for (let k = 0; k < 3; k++) {
      const a0 = -Math.PI / 2 + (k * 2 * Math.PI) / 3 - 0.5;
      const a1 = a0 + 1.0;
      ctx.beginPath();
      ctx.arc(cx, cy, 24, a0, a1);
      ctx.arc(cx, cy, 8, a1, a0, true);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createArmHazardTrimTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#ffb000";
    ctx.fillRect(0, 0, 64, 32);
    ctx.fillStyle = "#141414";
    for (let x = -32; x < 96; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 32);
      ctx.lineTo(x + 8, 32);
      ctx.lineTo(x + 24, 0);
      ctx.lineTo(x + 16, 0);
      ctx.closePath();
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function paintTurretFaceCRT(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sprites: KomradPixelSpriteBank,
  mood: KomradMood,
  pose: KomradPortraitPose,
  isTalking: boolean,
  energy: number,
  activeVowel: KomradVowelKey | null,
  rolledR: boolean,
  isBlackout: boolean,
  blinkPhase: number,
  spectrum16?: Uint8Array,
  activeWord?: string | null,
  voxLoaded?: boolean,
  isDancing = false,
  danceBeat = 0,
): void {
  if (isBlackout) {
    ctx.fillStyle = "#050706";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#331414";
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = "#7a2424";
    ctx.font = 'bold 26px "Kremlin", "Courier Prime", monospace';
    ctx.textAlign = "center";
    ctx.fillText("K.O.M.R.A.D.-84", w / 2, h / 2 - 16);
    ctx.fillStyle = "#48524c";
    ctx.font = 'bold 20px "VT323", monospace';
    ctx.fillText("GANTRY OPTIC STANDBY", w / 2, h / 2 + 22);
    return;
  }

  const pal = getTurretPalette(mood);
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = pal.primary;
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, w - 12, h - 12);

  // Header strip
  ctx.fillStyle = pal.armor;
  ctx.fillRect(14, 14, w - 28, 42);
  ctx.strokeStyle = pal.frame;
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, w - 28, 42);

  ctx.fillStyle = pal.secondary;
  ctx.font = 'bold 21px "Kremlin", "Courier Prime", monospace';
  ctx.textAlign = "left";
  ctx.fillText("K.O.M.R.A.D.-84 // SEC-84", 24, 42, w - 160);

  const badgeText = isDancing
    ? danceBeat % 2 === 0
      ? "AZ-5"
      : "GROOVE"
    : mood === "critical"
      ? "ALERT!"
      : mood === "warning"
        ? "WATCH"
        : "OPTIC";
  ctx.fillStyle = isDancing
    ? danceBeat % 2 === 0
      ? "#ffb000"
      : "#39ff7a"
    : mood === "critical" && blinkPhase % 2 === 0
      ? "#ff4433"
      : pal.primary;
  ctx.fillRect(w - 134, 19, 110, 32);
  ctx.fillStyle = "#060906";
  ctx.font = 'bold 19px "Kremlin", "Courier Prime", monospace';
  ctx.textAlign = "center";
  ctx.fillText(badgeText, w - 79, 42);

  // Portrait frame (104x120 sprite at exact 3x integer scale = 312x360)
  const portX = 14;
  const portY = 64;
  const portW = w - 28;
  const portH = 368;
  ctx.fillStyle = "#030704";
  ctx.fillRect(portX, portY, portW, portH);
  ctx.strokeStyle = pal.primary;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(portX, portY, portW, portH);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    sprites[mood][pose],
    Math.floor((w - 312) / 2),
    portY + 4,
    312,
    360,
  );
  ctx.restore();

  // Bottom 16-band formant vocalizer bar
  const barBoxX = 14;
  const barBoxY = 440;
  const barBoxW = w - 28;
  const barBoxH = 58;
  ctx.fillStyle = "#040805";
  ctx.fillRect(barBoxX, barBoxY, barBoxW, barBoxH);
  ctx.strokeStyle = pal.frame;
  ctx.lineWidth = 2;
  ctx.strokeRect(barBoxX, barBoxY, barBoxW, barBoxH);

  const bars = 16;
  const bw = 22;
  const bgap = 6;
  const startX =
    barBoxX + Math.floor((barBoxW - (bars * bw + (bars - 1) * bgap)) / 2);
  const vowelCenter = getKomradVowelBand(activeVowel, bars);

  for (let i = 0; i < bars; i++) {
    let amp: number;
    if (isDancing) {
      const waveA = 0.5 + 0.5 * Math.sin(blinkPhase * 1.45 + i * 0.55);
      const waveB = 0.5 + 0.5 * Math.cos(blinkPhase * 0.9 - i * 0.35);
      amp = Math.min(1, 0.16 + 0.84 * waveA * (0.55 + 0.45 * waveB));
    } else if (isTalking && voxLoaded && spectrum16) {
      const binAmp = (spectrum16[i] ?? 0) / 255;
      amp = Math.min(1, 0.08 + binAmp * 0.92);
    } else {
      const dist = Math.abs(i - vowelCenter);
      const vowelShape = activeVowel ? Math.max(0.24, 1 - dist * 0.12) : 0.45;
      amp = isTalking
        ? Math.min(
            1,
            (0.12 + energy * 0.9 * vowelShape) *
              (0.74 + 0.26 * Math.sin(blinkPhase * 1.9 + i * 0.85)),
          )
        : 0.1 + 0.05 * Math.sin(blinkPhase * 0.8 + i * 0.5);
    }
    const barH = Math.max(4, Math.round(amp * 26));
    ctx.fillStyle =
      amp > 0.72
        ? pal.secondary
        : isDancing || isTalking
          ? pal.primary
          : pal.dim;
    ctx.fillRect(startX + i * (bw + bgap), barBoxY + 31 - barH, bw, barH);
  }

  ctx.fillStyle = isDancing || isTalking ? pal.secondary : pal.dim;
  ctx.font = 'bold 18px "VT323", monospace';
  ctx.textAlign = "center";
  const statusLabel = isDancing
    ? "PROTOCOL AZ-5 // MORALE DANCE"
    : isTalking
      ? voxLoaded
        ? activeWord
          ? `VOX // [${activeWord.toUpperCase()}]`
          : "VOX // PA BUS ACTIVE"
        : activeVowel
          ? `VODER // PHONEME [${activeVowel}]${rolledR ? " + TRILL [R]" : ""}`
          : "VODER // ARTICULATION PAUSE"
      : "GANTRY PANOPTICON // TRACKING";
  ctx.fillText(statusLabel, w / 2, barBoxY + 51);

  // Subtle CRT scanlines
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  for (let sy = 2; sy < h; sy += 4) {
    ctx.fillRect(0, sy, w, 1);
  }
}

export const SovietPanopticonRig3D: React.FC = React.memo(() => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  const sprites = useMemo(() => getKomradPixelSprites(), []);
  const radCheekTex = useMemo(() => createRadiationCheekTexture(), []);
  const armHazardTex = useMemo(() => createArmHazardTrimTexture(), []);

  // Gantry & telescoping 3-joint kinematic refs
  const gantryBridgeRef = useRef<THREE.Group>(null);
  const gantryTrolleyRef = useRef<THREE.Group>(null);
  const spinePistonRef = useRef<THREE.Mesh>(null);
  const spineMidSleeveRef = useRef<THREE.Mesh>(null);
  const turretYawRef = useRef<THREE.Group>(null);
  const shoulderPivotRef = useRef<THREE.Group>(null);
  const elbowPivotRef = useRef<THREE.Group>(null);
  const wristGimbalRef = useRef<THREE.Group>(null);
  const armChassisRef = useRef<THREE.Group>(null);

  // Twin industrial manipulator arm refs [0 = left, 1 = right]
  const upperArmRefs = useRef<(THREE.Group | null)[]>([null, null]);
  const elbowArmRefs = useRef<(THREE.Group | null)[]>([null, null]);
  const wristArmRefs = useRef<(THREE.Group | null)[]>([null, null]);
  const wristRollRefs = useRef<(THREE.Group | null)[]>([null, null]);
  const armElbowLedMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([
    null,
    null,
  ]);
  const clawFingerRefs = useRef<(THREE.Group | null)[][]>([
    [null, null, null],
    [null, null, null],
  ]);

  // Boss head details refs
  const turretCrtMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const turretOpticMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const opticGlowLightRef = useRef<THREE.PointLight>(null);
  const leftHornRef = useRef<THREE.Group>(null);
  const rightHornRef = useRef<THREE.Group>(null);
  const shutterBladeRefs = useRef<(THREE.Mesh | null)[]>([
    null,
    null,
    null,
    null,
  ]);

  const turretStateRef = useRef({
    curX: INITIAL_TROLLEY_X,
    curHeadY: 1.96,
    curZ: INITIAL_TROLLEY_Z,
    velX: 0,
    velY: 0,
    velZ: 0,
    anchorX: INITIAL_TROLLEY_X,
    anchorZ: INITIAL_TROLLEY_Z,
    preferredSide: 1 as -1 | 1,
    lastAnchorCamX: 0,
    lastAnchorCamZ: 0.52,
    anchorCamInit: false,
    lastSeatedAtDesk: false,
    wasArmActive: false,
    wasDancing: false,
    danceElapsedSec: 0,
    nextDriftSec: SUPERVISORY_DRIFT_INTERVAL_SEC,
    driftPhase: 0,
    curSpineDrop: 0.65,
    curYaw: INITIAL_YAW,
    curPitch: -0.12,
    curRoll: 0,
    curSwoop: 0.72,
    curRecoil: 0,
    curAperture: 0.4,
    rollImpulse: 0,
    shakeAmp: 0,
    lastMood: "normal" as KomradMood,
    lastTreasonStrikes: 0,
    lastShiftRunId: -1,
    lastControlSig: 0,
    lastControlsInit: false,
    lastDrawSec: -1,
    lastSig: "",
    arms: [
      {
        curWrist: new THREE.Vector3(0.14, -0.32, 0.26),
        curPole: new THREE.Vector3(-0.65, 0.25, -0.75),
        curOpen: 0.22,
        curRoll: 0,
      },
      {
        curWrist: new THREE.Vector3(-0.14, -0.32, 0.26),
        curPole: new THREE.Vector3(0.65, 0.25, -0.75),
        curOpen: 0.22,
        curRoll: 0,
      },
    ],
  });

  // 4 CCTV camera refs
  const cctvYawRefs = useRef<(THREE.Group | null)[]>([null, null, null, null]);
  const cctvPitchRefs = useRef<(THREE.Group | null)[]>([null, null, null, null]);
  const cctvBarrelRefs = useRef<(THREE.Group | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const cctvTallyMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const cctvStateRef = useRef(
    CCTV_MOUNTS.map(() => ({
      curYaw: 0,
      curPitch: -0.36,
      zoomOffset: 0,
    })),
  );

  const turretCrtTex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      paintTurretFaceCRT(
        ctx,
        512,
        512,
        sprites,
        "normal",
        "idle",
        false,
        0,
        null,
        false,
        false,
        0,
      );
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [sprites]);

  useEffect(() => {
    return () => {
      turretCrtTex.dispose();
      radCheekTex.dispose();
      armHazardTex.dispose();
    };
  }, [turretCrtTex, radCheekTex, armHazardTex]);

  useEffect(() => {
    return onKremlinFontReady(() => {
      turretStateRef.current.lastSig = "";
      turretStateRef.current.lastDrawSec = -1;
    });
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(Math.max(delta, 0), MAX_FRAME_DT);
    const s = useGameStore.getState();
    const isBlackout = s.isBlackout && !s.isGodMode;
    const vocal = stepKomradSpeech(t, dt);

    const camPos = state.camera.position;

    // 1. Gantry Carriage X/Z Translation + 3-Joint Articulated GLaDOS Boss Rig
    const ts = turretStateRef.current;

    let shiftReset = false;
    if (
      ts.lastShiftRunId !== s.shiftRunId ||
      s.phase !== "playing" ||
      isBlackout
    ) {
      if (ts.lastShiftRunId !== s.shiftRunId) {
        shiftReset = true;
        ts.lastShiftRunId = s.shiftRunId;
        ts.curX = INITIAL_TROLLEY_X;
        ts.curHeadY = 1.96;
        ts.curZ = INITIAL_TROLLEY_Z;
        ts.curYaw = INITIAL_YAW;
        ts.curPitch = isBlackout ? TURRET_BLACKOUT_PITCH : -0.12;
        ts.curRoll = 0;
        ts.rollImpulse = 0;
        ts.shakeAmp = 0;
        ts.velX = 0;
        ts.velY = 0;
        ts.velZ = 0;
        ts.anchorX = INITIAL_TROLLEY_X;
        ts.anchorZ = INITIAL_TROLLEY_Z;
        ts.preferredSide = 1;
        ts.anchorCamInit = false;
        ts.lastSeatedAtDesk = false;
        ts.wasArmActive = false;
        ts.wasDancing = false;
        ts.danceElapsedSec = 0;
        ts.arms[0].curRoll = 0;
        ts.arms[1].curRoll = 0;
        ts.nextDriftSec = t + SUPERVISORY_DRIFT_INTERVAL_SEC;
      }
      cancelKomradActuation();
    }

    const controlSig =
      s.controlRodLevel +
      s.pumpThrottle[0] +
      s.pumpThrottle[1] +
      s.powerAllocation.cooling +
      s.powerAllocation.defense +
      s.powerAllocation.facility +
      s.oilCoolerValve +
      s.nitrogenLoopValve +
      s.excitationTrim +
      s.activeDirectives.length;
    if (!ts.lastControlsInit) {
      ts.lastControlSig = controlSig;
      ts.lastControlsInit = true;
    } else if (Math.abs(controlSig - ts.lastControlSig) > 0.8) {
      ts.lastControlSig = controlSig;
      if (!isBlackout) {
        ts.rollImpulse = (ts.rollImpulse >= 0 ? -1 : 1) * 0.14;
      }
    }

    if (
      (vocal.mood === "critical" && ts.lastMood !== "critical") ||
      s.treasonStrikes > ts.lastTreasonStrikes
    ) {
      ts.shakeAmp = 0.24;
    }
    ts.lastMood = vocal.mood;
    ts.lastTreasonStrikes = s.treasonStrikes;
    ts.shakeAmp = Math.max(0, ts.shakeAmp - dt * 0.55);

    const armState = stepKomradArmController(
      dt,
      ts.curX,
      ts.curHeadY,
      ts.curZ,
      ts.curYaw,
    );

    const isDancing =
      s.diagFeedActive &&
      !isBlackout &&
      s.phase === "playing" &&
      s.lobbyMenuPhase === "entered_control_room" &&
      !armState.active;
    const prevWasDancing = ts.wasDancing;
    const enteredDance = !prevWasDancing && isDancing;
    const exitedDance = prevWasDancing && !isDancing;
    ts.wasDancing = isDancing;

    if (enteredDance) {
      ts.danceElapsedSec = 0;
    }

    let beatFloat = 0;
    let beatIndex = 0;
    let beatFrac = 0;
    let movePhase = 0;
    let beatPulse = 0;
    let offBeatPulse = 0;
    let danceSwayX = 0;
    let danceBounceY = 0;
    let danceYawOffset = 0;
    let dancePitchOffset = 0;
    let danceRollTarget = 0;

    if (isDancing) {
      ts.danceElapsedSec += dt;
      const diagVid = getSkalaDiagFeedElement();
      const useVidClock =
        diagVid !== null &&
        !diagVid.paused &&
        diagVid.readyState >= 2 &&
        Number.isFinite(diagVid.currentTime);
      const danceTime = useVidClock ? diagVid.currentTime : ts.danceElapsedSec;
      beatFloat = danceTime * DANCE_BEATS_PER_SEC;
      beatIndex = Math.floor(beatFloat);
      beatFrac = beatFloat - beatIndex;
      movePhase = Math.floor(beatIndex / 8) % 4;
      beatPulse = Math.pow(Math.max(0, 1 - beatFrac * 2.4), 2);
      offBeatPulse = Math.pow(
        Math.max(0, 1 - Math.abs(beatFrac - 0.5) * 4.0),
        2,
      );

      if (movePhase === 0) {
        // Move A: "The Hydraulic Kazachok" (Alternating Cossack Arm Kicks + Piston Squat)
        danceBounceY = -0.14 * Math.cos(beatFloat * Math.PI * 2);
        danceSwayX =
          (beatIndex % 2 === 0 ? -1 : 1) * 0.1 * Math.sin(beatFrac * Math.PI);
        danceYawOffset =
          (beatIndex % 2 === 0 ? -1 : 1) * 0.08 * Math.sin(beatFrac * Math.PI);
        dancePitchOffset = -0.07 * Math.cos(beatFloat * Math.PI * 2);
        danceRollTarget =
          (beatIndex % 2 === 0 ? 1 : -1) * 0.055 * Math.sin(beatFrac * Math.PI);
      } else if (movePhase === 1) {
        // Move B: "1984 Gosplan Factory Robot" (90-deg Stiff Servo Lock & Wrist Spin)
        const stepT = THREE.MathUtils.clamp(beatFrac * 5.0, 0, 1);
        const snapEase = stepT * stepT * (3 - 2 * stepT);
        danceBounceY = (beatIndex % 2 === 0 ? -0.07 : 0.06) * snapEase;
        danceSwayX = 0;
        danceYawOffset = (beatIndex % 2 === 0 ? -1 : 1) * 0.09 * snapEase;
        dancePitchOffset = (beatIndex % 2 === 0 ? 0.05 : -0.04) * snapEase;
        danceRollTarget =
          (beatIndex % 2 === 0 ? 1 : -1) * 0.1396 * (0.35 + 0.65 * snapEase);
      } else if (movePhase === 2) {
        // Move C: "Raise the Quota" (Double Overhead Roof-Raiser + Pincer Claps)
        danceSwayX = Math.sin((beatFloat / 2) * Math.PI) * 0.32;
        danceBounceY = 0.09 * Math.sin(beatFloat * Math.PI * 2);
        danceYawOffset = Math.sin((beatFloat / 2) * Math.PI) * 0.1;
        dancePitchOffset = 0.12 * Math.sin(beatFloat * Math.PI * 2);
        danceRollTarget = Math.sin((beatFloat / 2) * Math.PI) * 0.07;
      } else {
        // Move D: "Polivoks Disco Point" (Alternating Diagonal Reach & Figure-8 Groove)
        const phase8 = (beatFloat / 4) * Math.PI * 2;
        danceSwayX = Math.sin(phase8) * 0.24;
        danceBounceY = Math.sin(phase8 * 2) * 0.09;
        danceYawOffset = Math.sin(phase8) * 0.14;
        dancePitchOffset = Math.sin(phase8 * 2) * 0.07;
        danceRollTarget = -Math.sin(phase8) * 0.1;
      }
    }

    if (exitedDance || shiftReset) {
      ts.curRoll = 0;
      ts.curPitch = isBlackout ? TURRET_BLACKOUT_PITCH : 0;
      ts.rollImpulse = 0;
      ts.shakeAmp = 0;
      ts.danceElapsedSec = 0;
      ts.arms[0].curRoll = 0;
      ts.arms[1].curRoll = 0;
    }

    let desiredTargetY = 1.96;

    if (isBlackout) {
      ts.velX = THREE.MathUtils.damp(ts.velX, 0, 4.0, dt);
      ts.velZ = THREE.MathUtils.damp(ts.velZ, 0, 4.0, dt);
      desiredTargetY = 2.25;
      const yStep = stepHeavyCraneAxis1D(
        ts.curHeadY,
        ts.velY,
        desiredTargetY,
        dt,
        CRANE_PATROL_MAX_SPEED_Y,
        CRANE_PATROL_MAX_ACCEL_Y,
        CRANE_PATROL_SMOOTH_TIME_Y,
        _craneYOut,
      );
      ts.curHeadY = yStep.value;
      ts.velY = yStep.velocity;
      ts.wasArmActive = false;
    } else if (s.lobbyMenuPhase !== "entered_control_room") {
      ts.curX = THREE.MathUtils.damp(ts.curX, INITIAL_TROLLEY_X, 4.0, dt);
      ts.curZ = THREE.MathUtils.damp(ts.curZ, INITIAL_TROLLEY_Z, 4.0, dt);
      ts.velX = 0;
      ts.velZ = 0;
      desiredTargetY = 1.76 + Math.sin(t * 0.85) * 0.02;
      ts.curHeadY = THREE.MathUtils.damp(ts.curHeadY, desiredTargetY, 4.0, dt);
      ts.velY = 0;
      ts.anchorX = INITIAL_TROLLEY_X;
      ts.anchorZ = INITIAL_TROLLEY_Z;
      ts.anchorCamInit = false;
      ts.wasArmActive = false;
    } else if (armState.active) {
      const actX = THREE.MathUtils.clamp(
        armState.standoffGantryPos.x,
        ACTUATION_X_MIN,
        ACTUATION_X_MAX,
      );
      const actY = THREE.MathUtils.clamp(
        armState.standoffGantryPos.y,
        ACTUATION_Y_MIN,
        ACTUATION_Y_MAX,
      );
      const actZ = THREE.MathUtils.clamp(
        armState.standoffGantryPos.z,
        ACTUATION_Z_MIN,
        ACTUATION_Z_MAX,
      );
      desiredTargetY = actY;

      const xzStep = stepHeavyCraneXZ(
        ts.curX,
        ts.curZ,
        ts.velX,
        ts.velZ,
        actX,
        actZ,
        dt,
        CRANE_ACTUATION_MAX_SPEED_XZ,
        CRANE_ACTUATION_MAX_ACCEL_XZ,
        CRANE_ACTUATION_SMOOTH_TIME_XZ,
        false,
        _craneXZOut,
      );
      ts.curX = xzStep.x;
      ts.curZ = xzStep.z;
      ts.velX = xzStep.vx;
      ts.velZ = xzStep.vz;

      const yStep = stepHeavyCraneAxis1D(
        ts.curHeadY,
        ts.velY,
        actY,
        dt,
        CRANE_ACTUATION_MAX_SPEED_Y,
        CRANE_ACTUATION_MAX_ACCEL_Y,
        CRANE_ACTUATION_SMOOTH_TIME_Y,
        _craneYOut,
      );
      ts.curHeadY = yStep.value;
      ts.velY = yStep.velocity;

      ts.anchorX = ts.curX;
      ts.anchorZ = ts.curZ;
      ts.wasArmActive = true;
    } else if (isDancing) {
      _danceTargetTmp.x = DANCE_ANCHOR_X + danceSwayX;
      _danceTargetTmp.z = DANCE_ANCHOR_Z;

      const dDanceCam = Math.hypot(
        _danceTargetTmp.x - camPos.x,
        _danceTargetTmp.z - camPos.z,
      );
      if (dDanceCam < DANCE_PERSONAL_SPACE_DIST) {
        let px = _danceTargetTmp.x - camPos.x;
        let pz = _danceTargetTmp.z - camPos.z;
        if (dDanceCam < 1e-4) {
          px = 0.85;
          pz = 0.45;
        } else {
          px /= dDanceCam;
          pz /= dDanceCam;
        }
        _danceTargetTmp.x = camPos.x + px * DANCE_PUSH_RADIUS;
        _danceTargetTmp.z = camPos.z + pz * DANCE_PUSH_RADIUS;
      }

      _danceTargetTmp.x = THREE.MathUtils.clamp(_danceTargetTmp.x, 1.72, 3.65);
      _danceTargetTmp.z = THREE.MathUtils.clamp(_danceTargetTmp.z, -1.45, 1.15);
      pushPointOutOfOBB(_danceTargetTmp, PATROL_KEEP_OUT_OBBS[1]);
      pushPointOutOfOBB(_danceTargetTmp, PATROL_KEEP_OUT_OBBS[2]);
      _danceTargetTmp.x = THREE.MathUtils.clamp(_danceTargetTmp.x, 1.72, 3.65);
      _danceTargetTmp.z = THREE.MathUtils.clamp(_danceTargetTmp.z, -1.45, 1.15);
      if (
        Math.hypot(_danceTargetTmp.x - camPos.x, _danceTargetTmp.z - camPos.z) <
        MIN_TROLLEY_DIST
      ) {
        const safeDanceTarget = computeSafePanopticonTarget(
          {
            camPos,
            refX: ts.anchorX,
            refZ: ts.anchorZ,
            curX: ts.curX,
            curZ: ts.curZ,
            preferredSide: ts.preferredSide,
            isSeatedAtDesk: s.isSeatedAtDesk,
            isTalking: vocal.isTalking,
            mood: vocal.mood,
            isBlackout: false,
            elapsedSec: t,
          },
          _safeTargetOut,
        );
        _danceTargetTmp.x = safeDanceTarget.targetX;
        _danceTargetTmp.z = safeDanceTarget.targetZ;
      }

      desiredTargetY = THREE.MathUtils.clamp(
        DANCE_BASE_Y + danceBounceY,
        TURRET_Y_EYE_MIN,
        TURRET_Y_EYE_MAX,
      );

      const xzStep = stepHeavyCraneXZ(
        ts.curX,
        ts.curZ,
        ts.velX,
        ts.velZ,
        _danceTargetTmp.x,
        _danceTargetTmp.z,
        dt,
        DANCE_CRANE_MAX_SPEED_XZ,
        DANCE_CRANE_MAX_ACCEL_XZ,
        DANCE_CRANE_SMOOTH_TIME_XZ,
        false,
        _craneXZOut,
        camPos.x,
        camPos.z,
        MIN_TROLLEY_DIST,
      );
      ts.curX = xzStep.x;
      ts.curZ = xzStep.z;
      ts.velX = xzStep.vx;
      ts.velZ = xzStep.vz;

      const yStep = stepHeavyCraneAxis1D(
        ts.curHeadY,
        ts.velY,
        desiredTargetY,
        dt,
        DANCE_CRANE_MAX_SPEED_Y,
        DANCE_CRANE_MAX_ACCEL_Y,
        DANCE_CRANE_SMOOTH_TIME_Y,
        _craneYOut,
      );
      ts.curHeadY = yStep.value;
      ts.velY = yStep.velocity;

      ts.anchorX = ts.curX;
      ts.anchorZ = ts.curZ;
      ts.wasArmActive = false;
    } else {
      if (!ts.anchorCamInit) {
        ts.lastAnchorCamX = camPos.x;
        ts.lastAnchorCamZ = camPos.z;
        ts.lastSeatedAtDesk = s.isSeatedAtDesk;
        ts.anchorCamInit = true;
      }

      const exitedArm = ts.wasArmActive;
      ts.wasArmActive = false;
      const seatedChanged = s.isSeatedAtDesk !== ts.lastSeatedAtDesk;
      ts.lastSeatedAtDesk = s.isSeatedAtDesk;

      const anchorDistToCam = Math.hypot(
        ts.anchorX - camPos.x,
        ts.anchorZ - camPos.z,
      );
      const liveDistToCam = Math.hypot(ts.curX - camPos.x, ts.curZ - camPos.z);
      const camMoved = Math.hypot(
        camPos.x - ts.lastAnchorCamX,
        camPos.z - ts.lastAnchorCamZ,
      );
      const anchorUnsafe = !isStrictlySafeCorridor(ts.anchorX, ts.anchorZ);
      const personalSpaceBreach =
        anchorDistToCam < MIN_TROLLEY_DIST || liveDistToCam < MIN_TROLLEY_DIST;
      const meaningfulPlayerMove =
        camMoved > PLAYER_MOVE_DEADBAND_M &&
        (anchorDistToCam > MAX_TROLLEY_DIST ||
          anchorDistToCam < MIN_TROLLEY_DIST + 0.15);

      if (
        exitedArm ||
        exitedDance ||
        seatedChanged ||
        anchorUnsafe ||
        personalSpaceBreach ||
        meaningfulPlayerMove
      ) {
        const safeTarget = computeSafePanopticonTarget(
          {
            camPos,
            refX: ts.anchorX,
            refZ: ts.anchorZ,
            curX: ts.curX,
            curZ: ts.curZ,
            preferredSide: ts.preferredSide,
            isSeatedAtDesk: s.isSeatedAtDesk,
            isTalking: vocal.isTalking,
            mood: vocal.mood,
            isBlackout: false,
            elapsedSec: t,
          },
          _safeTargetOut,
        );
        ts.anchorX = safeTarget.targetX;
        ts.anchorZ = safeTarget.targetZ;
        ts.preferredSide = safeTarget.chosenFlank;
        ts.lastAnchorCamX = camPos.x;
        ts.lastAnchorCamZ = camPos.z;
        ts.nextDriftSec = t + SUPERVISORY_DRIFT_INTERVAL_SEC;
      } else if (
        t >= ts.nextDriftSec &&
        Math.hypot(ts.curX - ts.anchorX, ts.curZ - ts.anchorZ) < 0.25
      ) {
        ts.driftPhase += 1.65;
        const driftCandX =
          ts.anchorX + Math.cos(ts.driftPhase) * SUPERVISORY_DRIFT_STEP_M;
        const driftCandZ =
          ts.anchorZ + Math.sin(ts.driftPhase) * SUPERVISORY_DRIFT_STEP_M;
        projectOntoSafeCorridor(driftCandX, driftCandZ, _driftProjTmp);
        const driftDistToCam = Math.hypot(
          _driftProjTmp.x - camPos.x,
          _driftProjTmp.z - camPos.z,
        );
        if (
          isStrictlySafeCorridor(_driftProjTmp.x, _driftProjTmp.z) &&
          driftDistToCam >= MIN_TROLLEY_DIST + 0.1 &&
          driftDistToCam <= MAX_TROLLEY_DIST - 0.1 &&
          segmentClearsDesk(
            ts.curX,
            ts.curZ,
            _driftProjTmp.x,
            _driftProjTmp.z,
          )
        ) {
          ts.anchorX = _driftProjTmp.x;
          ts.anchorZ = _driftProjTmp.z;
          ts.preferredSide =
            ts.anchorX > 0.35
              ? 1
              : ts.anchorX < -0.35
                ? -1
                : ts.preferredSide;
        }
        ts.nextDriftSec = t + SUPERVISORY_DRIFT_INTERVAL_SEC;
      }

      desiredTargetY = THREE.MathUtils.clamp(
        vocal.mood === "critical"
          ? 1.68
          : vocal.isTalking || s.isSeatedAtDesk
            ? 1.74
            : vocal.mood === "warning"
              ? 1.85
              : 1.96 + Math.sin(t * 0.8) * 0.05,
        TURRET_Y_EYE_MIN,
        TURRET_Y_EYE_MAX,
      );

      computeCorridorSteerTarget(
        ts.curX,
        ts.curZ,
        ts.anchorX,
        ts.anchorZ,
        camPos.x,
        camPos.z,
        _steerTmp,
      );

      const patrolMaxSpeed =
        liveDistToCam < PUSH_TARGET_TROLLEY_DIST
          ? THREE.MathUtils.clamp(
              CRANE_PATROL_MAX_SPEED_XZ +
                (PUSH_TARGET_TROLLEY_DIST - liveDistToCam) * 3.0,
              CRANE_PATROL_MAX_SPEED_XZ,
              CRANE_PATROL_RETREAT_MAX_SPEED_XZ,
            )
          : CRANE_PATROL_MAX_SPEED_XZ;

      const xzStep = stepHeavyCraneXZ(
        ts.curX,
        ts.curZ,
        ts.velX,
        ts.velZ,
        _steerTmp.x,
        _steerTmp.z,
        dt,
        patrolMaxSpeed,
        CRANE_PATROL_MAX_ACCEL_XZ,
        CRANE_PATROL_SMOOTH_TIME_XZ,
        true,
        _craneXZOut,
        camPos.x,
        camPos.z,
        MIN_TROLLEY_DIST * 0.92,
      );
      ts.curX = xzStep.x;
      ts.curZ = xzStep.z;
      ts.velX = xzStep.vx;
      ts.velZ = xzStep.vz;

      const yStep = stepHeavyCraneAxis1D(
        ts.curHeadY,
        ts.velY,
        desiredTargetY,
        dt,
        CRANE_PATROL_MAX_SPEED_Y,
        CRANE_PATROL_MAX_ACCEL_Y,
        CRANE_PATROL_SMOOTH_TIME_Y,
        _craneYOut,
      );
      ts.curHeadY = yStep.value;
      ts.velY = yStep.velocity;

      if (
        Math.hypot(ts.velX, ts.velZ) > 0.75 &&
        Math.hypot(ts.anchorX - ts.curX, ts.anchorZ - ts.curZ) > 0.45
      ) {
        playTurretServoWhir(0.9);
      }
    }

    if (gantryBridgeRef.current) {
      gantryBridgeRef.current.position.z = ts.curZ;
    }
    if (gantryTrolleyRef.current) {
      gantryTrolleyRef.current.position.x = ts.curX;
    }

    // Articulated arm pose + telescoping vertical spine column reaching eye level (~1.65m..2.05m)
    const targetSwoop = isBlackout
      ? 0.25
      : armState.active
        ? 0.94
        : isDancing
          ? 0.9
          : vocal.mood === "critical"
            ? 1.0
            : vocal.isTalking || s.isSeatedAtDesk
              ? 0.92
              : 0.78;

    const lambdaSwoop = isDancing ? 6.5 : 3.2;
    ts.curSwoop = THREE.MathUtils.damp(ts.curSwoop, targetSwoop, lambdaSwoop, dt);

    const breathe = isBlackout || isDancing ? 0 : Math.sin(t * 1.3);
    const theta1 =
      THREE.MathUtils.lerp(0.95, 0.14, ts.curSwoop) + breathe * 0.028;
    const thetaForearm =
      THREE.MathUtils.lerp(-1.12, -0.46, ts.curSwoop) - breathe * 0.036;
    const armVerticalDrop =
      ARM_SEG_LEN * Math.cos(theta1) + ARM_SEG_LEN * Math.cos(thetaForearm);

    const desiredSpineDrop = THREE.MathUtils.clamp(
      GANTRY_BRIDGE_Y +
        GANTRY_SHOULDER_OFFSET_Y -
        ts.curHeadY -
        armVerticalDrop,
      SPINE_DROP_MIN,
      SPINE_DROP_MAX,
    );
    ts.curSpineDrop = THREE.MathUtils.damp(
      ts.curSpineDrop,
      desiredSpineDrop,
      armState.active ? 4.8 : isDancing ? 11.0 : 3.8,
      dt,
    );

    if (turretYawRef.current) {
      turretYawRef.current.position.y =
        GANTRY_SHOULDER_OFFSET_Y - ts.curSpineDrop;
    }
    const totalColDrop = Math.max(
      0.1,
      -GANTRY_SHOULDER_OFFSET_Y + ts.curSpineDrop,
    );
    if (spinePistonRef.current) {
      spinePistonRef.current.position.y = -totalColDrop * 0.5;
      spinePistonRef.current.scale.y = totalColDrop;
    }
    if (spineMidSleeveRef.current) {
      const midLen = Math.max(0.08, totalColDrop * 0.56);
      spineMidSleeveRef.current.position.y = -midLen * 0.5 - 0.02;
      spineMidSleeveRef.current.scale.y = midLen;
    }

    const wristWorldY =
      GANTRY_BRIDGE_Y +
      GANTRY_SHOULDER_OFFSET_Y -
      ts.curSpineDrop -
      armVerticalDrop;

    const inLobbyWaiting = s.lobbyMenuPhase !== "entered_control_room";
    const aimX = inLobbyWaiting
      ? 0.0
      : armState.active && !isBlackout
        ? armState.targetWorldPos.x
        : camPos.x;
    const aimY = inLobbyWaiting
      ? 1.65
      : armState.active && !isBlackout
        ? armState.targetWorldPos.y
        : camPos.y;
    const aimZ = inLobbyWaiting
      ? 4.64
      : armState.active && !isBlackout
        ? armState.targetWorldPos.z
        : camPos.z;
    const tdx = aimX - ts.curX;
    const tdy = aimY - wristWorldY;
    const tdz = aimZ - ts.curZ;
    const tHoriz = Math.max(0.001, Math.hypot(tdx, tdz));
    const liveYaw = Math.atan2(tdx, tdz);
    const pitchMin = armState.active
      ? TURRET_ACTUATION_PITCH_MIN
      : TURRET_PITCH_MIN;
    const pitchMax = armState.active
      ? TURRET_ACTUATION_PITCH_MAX
      : TURRET_PITCH_MAX;
    const livePitch = THREE.MathUtils.clamp(
      Math.atan2(tdy, tHoriz),
      pitchMin,
      pitchMax,
    );

    const desiredYaw = isBlackout
      ? ts.curYaw
      : isDancing
        ? liveYaw + danceYawOffset
        : liveYaw +
          (!armState.active && !vocal.isTalking && vocal.mood === "normal"
            ? Math.sin(t * 0.42) * 0.035
            : 0);
    const yawErr = wrapAngleRad(desiredYaw - ts.curYaw);
    if (
      !isBlackout &&
      !inLobbyWaiting &&
      !isDancing &&
      Math.abs(yawErr) > TURRET_SLEW_WHIR_THRESHOLD_RAD
    ) {
      playTurretServoWhir(Math.abs(yawErr));
    }

    const lambdaYaw = isBlackout
      ? 2.8
      : armState.active
        ? 5.0
        : isDancing
          ? 7.5
          : vocal.mood === "critical"
            ? 3.8
            : 3.2;
    if (!isBlackout) {
      ts.curYaw = wrapAngleRad(
        THREE.MathUtils.damp(ts.curYaw, ts.curYaw + yawErr, lambdaYaw, dt),
      );
    }

    const desiredPitch = isBlackout
      ? TURRET_BLACKOUT_PITCH
      : isDancing
        ? THREE.MathUtils.clamp(
            livePitch + dancePitchOffset,
            TURRET_PITCH_MIN,
            TURRET_PITCH_MAX,
          )
        : livePitch;
    const lambdaPitch = isBlackout
      ? 2.8
      : armState.active
        ? 4.8
        : isDancing
          ? 8.5
          : vocal.mood === "critical"
            ? 3.8
            : 3.1;
    ts.curPitch = THREE.MathUtils.clamp(
      THREE.MathUtils.damp(ts.curPitch, desiredPitch, lambdaPitch, dt),
      armState.active || isBlackout
        ? Math.min(TURRET_ACTUATION_PITCH_MIN, TURRET_BLACKOUT_PITCH)
        : TURRET_PITCH_MIN,
      pitchMax,
    );

    ts.rollImpulse = THREE.MathUtils.damp(ts.rollImpulse, 0, 2.8, dt);
    const desiredRoll = isBlackout
      ? -0.14
      : isDancing
        ? danceRollTarget
        : Math.sin(t * 0.55) * 0.045 -
          THREE.MathUtils.clamp(yawErr * 0.2, -0.13, 0.13) +
          (vocal.isTalking && vocal.clauseTerminator === "?" ? 0.16 : 0) +
          ts.rollImpulse;
    if (exitedDance) {
      ts.curRoll = 0;
    } else {
      ts.curRoll = THREE.MathUtils.damp(
        ts.curRoll,
        desiredRoll,
        isDancing ? 11.0 : 3.0,
        dt,
      );
    }

    const targetRecoil =
      !isBlackout && vocal.isTalking
        ? (vocal.isStressed ? 0.065 : 0.028) * vocal.energy
        : 0;
    ts.curRecoil = THREE.MathUtils.damp(ts.curRecoil, targetRecoil, 4.2, dt);
    const shakeWave =
      ts.shakeAmp > 0.002 ? Math.sin(t * 28) * ts.shakeAmp : 0;

    if (turretYawRef.current) {
      turretYawRef.current.rotation.y = ts.curYaw + shakeWave * 0.55;
    }
    if (shoulderPivotRef.current) {
      shoulderPivotRef.current.rotation.x = theta1;
    }
    if (elbowPivotRef.current) {
      elbowPivotRef.current.rotation.x = thetaForearm - theta1;
    }
    if (wristGimbalRef.current) {
      wristGimbalRef.current.rotation.x =
        -(ts.curPitch + ts.curRecoil) - thetaForearm;
      wristGimbalRef.current.rotation.z = exitedDance
        ? 0
        : ts.curRoll + shakeWave;
    }
    if (armChassisRef.current) {
      armChassisRef.current.rotation.x = -thetaForearm;
    }

    // 1B. Twin Underslung Industrial Manipulator Arms (Expressive Idle + 2-Bone Analytical IK)
    let hasArmInv = false;
    if (armChassisRef.current) {
      armChassisRef.current.updateWorldMatrix(true, false);
      _armChassisInvMat.copy(armChassisRef.current.matrixWorld).invert();
      _clawLocal.copy(armState.clawWorldPos).applyMatrix4(_armChassisInvMat);
      _normalLocal
        .copy(armState.approachWorldNormal)
        .transformDirection(_armChassisInvMat)
        .normalize();
      hasArmInv = true;
    }

    for (let armIdx = 0; armIdx < 2; armIdx++) {
      const side = armIdx === 0 ? -1 : 1;
      const sideKey = armIdx === 0 ? "left" : "right";
      const as = ts.arms[armIdx];

      const breathShiftY = isBlackout
        ? 0
        : Math.sin(t * 1.35 + armIdx * 0.45) * 0.018;
      const speechShiftX =
        !isBlackout && vocal.isTalking
          ? Math.sin(t * 4.2 + armIdx * Math.PI) * 0.025 * vocal.energy
          : 0;
      const speechShiftZ =
        !isBlackout && vocal.isTalking
          ? Math.cos(t * 3.4 + armIdx * 0.7) * 0.028 * vocal.energy
          : 0;
      const critTremor =
        !isBlackout && vocal.mood === "critical"
          ? Math.sin(t * 36 + armIdx * 2.1) * 0.008
          : 0;

      // Expressive resting / speech / alert / dance target in shoulder-local space
      let idleX = -side * 0.14 + speechShiftX + critTremor;
      let idleY = -0.32 + breathShiftY;
      let idleZ = 0.26 + speechShiftZ;
      let idlePoleX = side * 0.65;
      let idlePoleY = 0.25;
      let idlePoleZ = -0.75;
      let idleOpen = 0.22;
      let idleRoll = 0;
      let lambdaPose = isBlackout ? 3.5 : 6.5;

      if (isBlackout) {
        idleX = side * 0.04;
        idleY = -0.92;
        idleZ = 0.06;
        idlePoleX = side * 0.4;
        idlePoleY = 0.05;
        idlePoleZ = -0.9;
        idleOpen = 0.42;
      } else if (isDancing) {
        if (movePhase === 0) {
          // Move A: "The Hydraulic Kazachok" (Alternating Cossack Arm Kicks)
          const isKickOut = (beatIndex + armIdx) % 2 === 0;
          const kickArc = Math.sin(beatFrac * Math.PI);
          if (isKickOut) {
            idleX = side * (0.58 + 0.14 * kickArc);
            idleY = -0.14 + 0.14 * kickArc;
            idleZ = 0.4;
            idlePoleX = side * 0.85;
            idlePoleY = 0.25;
            idlePoleZ = -0.5;
          } else {
            idleX = -side * 0.22;
            idleY = -0.22;
            idleZ = 0.54;
            idlePoleX = side * 0.65;
            idlePoleY = 0.15;
            idlePoleZ = -0.72;
          }
          idleOpen = 0.1 + 0.85 * offBeatPulse;
          idleRoll = (beatIndex % 2 === 0 ? 1 : -1) * 0.45 * side * offBeatPulse;
          lambdaPose = 15.0;
        } else if (movePhase === 1) {
          // Move B: "1984 Gosplan Factory Robot" (90-deg Servo Lock & Wrist Spin)
          const isUp = (beatIndex + armIdx) % 2 === 0;
          const stepT = THREE.MathUtils.clamp(beatFrac * 5.0, 0, 1);
          const localBeat = beatIndex % 8;
          idleX = side * 0.34;
          idleY = isUp ? 0.44 : -0.46;
          idleZ = 0.34;
          idlePoleX = side * 0.9;
          idlePoleY = isUp ? -0.35 : 0.35;
          idlePoleZ = -0.18;
          idleOpen = isUp ? 0.82 : 0.15;
          idleRoll = (localBeat + stepT) * Math.PI * side;
          lambdaPose = 20.0;
        } else if (movePhase === 2) {
          // Move C: "Raise the Quota" (Double Overhead Roof-Raiser + Pincer Claps)
          const pump =
            0.5 + 0.5 * Math.sin(beatFloat * Math.PI * 2 - Math.PI * 0.5);
          idleX = side * (0.28 + 0.14 * pump);
          idleY = 0.46 + 0.28 * pump;
          idleZ = 0.24;
          idlePoleX = side * 0.85;
          idlePoleY = -0.2;
          idlePoleZ = -0.45;
          idleOpen =
            Math.abs(Math.sin(beatFloat * Math.PI * 2)) > 0.45 ? 0.95 : 0.08;
          idleRoll = side * 0.35 * Math.sin(beatFloat * Math.PI * 2);
          lambdaPose = 14.0;
        } else {
          // Move D: "Polivoks Disco Point" (Alternating Diagonal Reach & Groove)
          const pointRight = Math.floor(beatFloat / 2) % 2 === 0;
          const isHighPoint = (armIdx === 1) === pointRight;
          if (isHighPoint) {
            idleX = side * 0.56;
            idleY = 0.62 + 0.08 * beatPulse;
            idleZ = 0.36;
            idlePoleX = side * 0.78;
            idlePoleY = -0.1;
            idlePoleZ = -0.5;
            idleOpen = 0.14;
            idleRoll = side * 0.25;
          } else {
            idleX = -side * 0.22;
            idleY = -0.42 - 0.06 * beatPulse;
            idleZ = 0.44;
            idlePoleX = side * 0.68;
            idlePoleY = 0.22;
            idlePoleZ = -0.7;
            idleOpen = 0.68 + 0.24 * offBeatPulse;
            idleRoll = -side * 0.55;
          }
          lambdaPose = 14.0;
        }
      } else if (vocal.mood === "critical") {
        // Intimidating wider overwatch flare + pulsing open pincers
        idleX = side * 0.18 + speechShiftX + critTremor;
        idleY = -0.18 + breathShiftY * 1.2;
        idleZ = 0.34 + speechShiftZ;
        idlePoleX = side * 0.85;
        idlePoleY = 0.42;
        idlePoleZ = -0.58;
        idleOpen = 0.68 + 0.14 * Math.sin(t * 7 + armIdx);
      } else if (vocal.mood === "warning") {
        // Forearms cant slightly forward with periodic warning pincer snap
        const snapWave = Math.max(0, Math.sin(t * 2.6 + armIdx * 1.4));
        const warnSnap = snapWave > 0.88 ? 0.45 : 0.12;
        idleX = -side * 0.06 + speechShiftX;
        idleY = -0.3 + breathShiftY;
        idleZ = 0.36 + speechShiftZ;
        idlePoleX = side * 0.72;
        idlePoleY = 0.3;
        idlePoleZ = -0.7;
        idleOpen = 0.28 + warnSnap;
      } else if (vocal.isTalking) {
        idleOpen =
          0.22 + 0.16 * vocal.energy * (0.5 + 0.5 * Math.sin(t * 14 + armIdx));
      }

      const isActiveArm =
        hasArmInv &&
        armState.active &&
        armState.activeArm === sideKey &&
        armState.ikBlend > 0.001 &&
        !isBlackout;

      if (isActiveArm) {
        const b = armState.ikBlend;
        const ikWristX =
          _clawLocal.x +
          _normalLocal.x * MANIPULATOR_CLAW_LEN -
          side * MANIPULATOR_SHOULDER_LOCAL_X;
        const ikWristY =
          _clawLocal.y +
          _normalLocal.y * MANIPULATOR_CLAW_LEN -
          MANIPULATOR_SHOULDER_LOCAL_Y;
        const ikWristZ =
          _clawLocal.z +
          _normalLocal.z * MANIPULATOR_CLAW_LEN -
          MANIPULATOR_SHOULDER_LOCAL_Z;

        _armTargetTmp.set(
          THREE.MathUtils.lerp(idleX, ikWristX, b),
          THREE.MathUtils.lerp(idleY, ikWristY, b),
          THREE.MathUtils.lerp(idleZ, ikWristZ, b),
        );
        _armPoleTmp.set(
          THREE.MathUtils.lerp(idlePoleX, side * 0.72, b),
          THREE.MathUtils.lerp(idlePoleY, 0.58, b),
          THREE.MathUtils.lerp(idlePoleZ, -0.35, b),
        );
        as.curWrist.copy(_armTargetTmp);
        as.curPole.copy(_armPoleTmp);
        as.curOpen = THREE.MathUtils.damp(
          as.curOpen,
          THREE.MathUtils.lerp(idleOpen, armState.clawOpen, b),
          14,
          dt,
        );
        as.curRoll = THREE.MathUtils.damp(
          as.curRoll,
          armState.wristRollRad * b,
          12,
          dt,
        );
      } else {
        if (Math.abs(idleRoll) < 0.6 && Math.abs(as.curRoll) > Math.PI) {
          as.curRoll = wrapAngleRad(as.curRoll);
        }
        as.curWrist.x = THREE.MathUtils.damp(as.curWrist.x, idleX, lambdaPose, dt);
        as.curWrist.y = THREE.MathUtils.damp(as.curWrist.y, idleY, lambdaPose, dt);
        as.curWrist.z = THREE.MathUtils.damp(as.curWrist.z, idleZ, lambdaPose, dt);
        as.curPole.x = THREE.MathUtils.damp(as.curPole.x, idlePoleX, lambdaPose, dt);
        as.curPole.y = THREE.MathUtils.damp(as.curPole.y, idlePoleY, lambdaPose, dt);
        as.curPole.z = THREE.MathUtils.damp(as.curPole.z, idlePoleZ, lambdaPose, dt);
        as.curOpen = THREE.MathUtils.damp(
          as.curOpen,
          idleOpen,
          isDancing ? 16.0 : 8.5,
          dt,
        );
        as.curRoll = THREE.MathUtils.damp(
          as.curRoll,
          idleRoll,
          isDancing ? 16.0 : 7.0,
          dt,
        );
      }

      const ik = solveTwoBoneArmIK(
        as.curWrist,
        as.curPole,
        MANIPULATOR_UPPER_LEN,
        MANIPULATOR_FOREARM_LEN,
        _armIKOut[armIdx],
      );

      const upperGrp = upperArmRefs.current[armIdx];
      if (upperGrp) {
        upperGrp.quaternion.copy(ik.upperQuat);
      }
      const elbowGrp = elbowArmRefs.current[armIdx];
      if (elbowGrp) {
        elbowGrp.rotation.set(ik.elbowAngleX, 0, 0);
      }

      // Orient 3-prong wrist socket: smoothly slerp between forearm idle posture & perpendicular grip normal
      const wristGrp = wristArmRefs.current[armIdx];
      if (wristGrp) {
        _elbowQuatTmp.setFromAxisAngle(_xAxisUnit, ik.elbowAngleX);
        _forearmQuatTmp.copy(ik.upperQuat).multiply(_elbowQuatTmp);
        _wristIdleQuatTmp.copy(_forearmQuatTmp).multiply(_wristIdleRelQuat);

        if (isActiveArm && armState.ikBlend > 0.001) {
          _wristYAxis.copy(_normalLocal);
          if (_wristYAxis.lengthSq() < 1e-6) {
            _wristYAxis.set(0, 1, 0);
          } else {
            _wristYAxis.normalize();
          }
          if (Math.abs(_wristYAxis.y) > 0.92) {
            _wristUpRef.set(1, 0, 0);
          } else {
            _wristUpRef.set(0, 1, 0);
          }
          _wristXAxis.crossVectors(_wristUpRef, _wristYAxis).normalize();
          _wristZAxis.crossVectors(_wristXAxis, _wristYAxis).normalize();
          _wristBasisMatTmp.makeBasis(_wristXAxis, _wristYAxis, _wristZAxis);
          _wristGripQuatTmp.setFromRotationMatrix(_wristBasisMatTmp);

          _wristChassisQuatTmp
            .copy(_wristIdleQuatTmp)
            .slerp(_wristGripQuatTmp, armState.ikBlend);
        } else {
          _wristChassisQuatTmp.copy(_wristIdleQuatTmp);
        }

        _forearmInvQuatTmp.copy(_forearmQuatTmp).invert();
        wristGrp.quaternion.copy(_forearmInvQuatTmp).multiply(_wristChassisQuatTmp);
      }

      const rollGrp = wristRollRefs.current[armIdx];
      if (rollGrp) {
        rollGrp.rotation.y = as.curRoll;
      }

      const jawSpread = THREE.MathUtils.lerp(0.08, -0.64, as.curOpen);
      for (let f = 0; f < 3; f++) {
        const fingerGrp = clawFingerRefs.current[armIdx]?.[f];
        if (fingerGrp) {
          fingerGrp.rotation.x = jawSpread;
        }
      }

      const ledMat = armElbowLedMatRefs.current[armIdx];
      if (ledMat) {
        if (isBlackout) {
          ledMat.color.setHex(0x161a18);
        } else if (inLobbyWaiting || controlRoomPowerState.zone2 <= 0.01) {
          ledMat.color.setHex(0x163820);
        } else if (isActiveArm) {
          ledMat.color.setHex(0xffb830);
        } else if (isDancing) {
          ledMat.color.setHex(
            (beatIndex + armIdx) % 2 === 0 ? 0xffb830 : 0x33ff66,
          );
        } else if (vocal.mood === "critical") {
          ledMat.color.setHex(
            Math.floor(t * 8 + armIdx) % 2 === 0 ? 0xff3b2f : 0x550c0c,
          );
        } else if (vocal.mood === "warning") {
          ledMat.color.setHex(0xffb000);
        } else {
          ledMat.color.setHex(0x33ff66);
        }
      }
    }

    // PA Horn speech / dance beat vibration pulse
    const hornPulse = isBlackout
      ? 0
      : isDancing
        ? beatPulse * 0.65
        : vocal.isTalking
          ? vocal.energy * (0.5 + 0.5 * Math.sin(t * 42))
          : 0;
    if (leftHornRef.current) {
      const hs = 1 + hornPulse * 0.08;
      leftHornRef.current.scale.set(hs, hs, 1 + hornPulse * 0.12);
    }
    if (rightHornRef.current) {
      const hs = 1 + hornPulse * 0.08;
      rightHornRef.current.scale.set(hs, hs, 1 + hornPulse * 0.12);
    }

    // Articulated Cyclops Optic Lens & 4 Motorized Brass Shutter Blades
    if (turretOpticMatRef.current) {
      if (isBlackout) {
        turretOpticMatRef.current.color.setHex(0x220808);
      } else if (inLobbyWaiting) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.1);
        turretOpticMatRef.current.color.lerpColors(
          _opticStandbyLo,
          _opticStandbyHi,
          pulse,
        );
      } else if (isDancing) {
        turretOpticMatRef.current.color.setHex(
          beatPulse > 0.35 ? 0xff4433 : 0x991212,
        );
      } else if (vocal.mood === "critical") {
        turretOpticMatRef.current.color.setHex(
          Math.floor(t * 8) % 2 === 0 ? 0xff4433 : 0xa61212,
        );
      } else if (vocal.isTalking && vocal.energy > 0.25) {
        turretOpticMatRef.current.color.setHex(0xff3b2f);
      } else {
        turretOpticMatRef.current.color.setHex(0xc41a1a);
      }
    }

    if (opticGlowLightRef.current) {
      if (isBlackout) {
        opticGlowLightRef.current.intensity = 0.0002;
      } else if (inLobbyWaiting) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.1);
        opticGlowLightRef.current.intensity = 0.42 + pulse * 0.18;
      } else {
        opticGlowLightRef.current.intensity = Math.max(
          0.0002,
          0.45 * (1 - controlRoomPowerState.zone2),
        );
      }
    }

    if (turretCrtMatRef.current) {
      if (isBlackout) {
        turretCrtMatRef.current.color.copy(_turretCrtFullTint);
      } else if (inLobbyWaiting) {
        turretCrtMatRef.current.color.copy(_turretCrtStandbyTint);
      } else {
        turretCrtMatRef.current.color.lerpColors(
          _turretCrtStandbyTint,
          _turretCrtFullTint,
          controlRoomPowerState.zone2,
        );
      }
    }

    const targetAperture = isBlackout
      ? 0.08
      : inLobbyWaiting
        ? 0.62 + Math.sin(t * 1.4) * 0.08
        : isDancing
          ? 0.35 + beatPulse * 0.55
          : vocal.mood === "critical"
            ? 1.0
            : vocal.isTalking
              ? 0.55 + vocal.energy * 0.45
              : 0.4;
    ts.curAperture = THREE.MathUtils.damp(ts.curAperture, targetAperture, 4.0, dt);
    const bladeRadius = 0.056 + ts.curAperture * 0.032;
    for (let bi = 0; bi < 4; bi++) {
      const blade = shutterBladeRefs.current[bi];
      if (!blade) continue;
      const ang = (bi * Math.PI) / 2 + Math.PI / 4 + ts.curAperture * 0.28;
      blade.position.set(
        Math.cos(ang) * bladeRadius,
        Math.sin(ang) * bladeRadius,
        0.028,
      );
      blade.rotation.z = ang;
    }

    // Throttled <= 10Hz live face-only 512x512 CRT redraw with strict dirty check
    if (exitedDance || t - ts.lastDrawSec >= 0.1) {
      const blinkBucket = isDancing
        ? Math.floor(beatFloat * 4)
        : vocal.isTalking
          ? Math.floor(t * 10)
          : Math.floor(t * 1.5);
      const pose: KomradPortraitPose = isDancing
        ? "idle"
        : vocal.isTalking
          ? vocal.mouthOpen === 2
            ? "talk2"
            : vocal.mouthOpen === 1
              ? "talk1"
              : "idle"
          : blinkBucket % 9 === 0
            ? "blink"
            : blinkBucket % 6 === 2
              ? "scan"
              : "idle";
      const energyQ = Math.round(vocal.energy * 10);
      const specSig =
        !isDancing && vocal.isTalking && vocal.voxLoaded
          ? `${Math.round(vocal.spectrum16[0] / 28)}-${Math.round(vocal.spectrum16[5] / 28)}-${Math.round(vocal.spectrum16[10] / 28)}-${Math.round(vocal.spectrum16[15] / 28)}`
          : "";
      const danceBeatParity = isDancing ? beatIndex % 2 : 0;
      const sig = `${isBlackout}|${isDancing}|${danceBeatParity}|${isDancing ? blinkBucket : 0}|${vocal.mood}|${pose}|${vocal.isTalking}|${energyQ}|${vocal.activeVowel ?? ""}|${vocal.rolledR}|${vocal.activeWord ?? ""}|${vocal.voxLoaded ? 1 : 0}|${specSig}|${
        vocal.mood === "critical" ? blinkBucket % 2 : 0
      }`;

      if (sig !== ts.lastSig) {
        ts.lastSig = sig;
        ts.lastDrawSec = t;
        const tex = turretCrtMatRef.current?.map as
          | THREE.CanvasTexture
          | undefined;
        const canvas = tex?.image as HTMLCanvasElement | undefined;
        const ctx = canvas?.getContext("2d");
        if (tex && canvas && ctx) {
          paintTurretFaceCRT(
            ctx,
            canvas.width,
            canvas.height,
            sprites,
            vocal.mood,
            pose,
            vocal.isTalking,
            vocal.energy,
            vocal.activeVowel,
            vocal.rolledR,
            isBlackout,
            blinkBucket,
            vocal.spectrum16,
            vocal.activeWord,
            vocal.voxLoaded,
            isDancing,
            danceBeatParity,
          );
          tex.needsUpdate = true;
        }
      }
    }

    // 2. Four Corner KGB-TV-84 Pan-Tilt Surveillance Cameras
    state.camera.getWorldDirection(_camForward);
    const camTrackLambda = vocal.mood === "critical" ? 6.5 : 4.2;
    const zoomLambda = 8.5;

    for (let i = 0; i < CCTV_MOUNTS.length; i++) {
      const mount = CCTV_MOUNTS[i];
      const cs = cctvStateRef.current[i];

      const dx = camPos.x - mount.pos[0];
      const dy = camPos.y - (mount.pos[1] - 0.1);
      const dz = camPos.z - mount.pos[2];
      const horiz = Math.max(0.001, Math.hypot(dx, dz));

      const relYaw = isBlackout
        ? 0
        : THREE.MathUtils.clamp(
            wrapAngleRad(Math.atan2(dx, dz) - mount.baseYaw),
            -CCTV_MAX_YAW_RAD,
            CCTV_MAX_YAW_RAD,
          );
      const desiredPitch = isBlackout
        ? CCTV_PITCH_MIN
        : THREE.MathUtils.clamp(
            Math.atan2(dy, horiz),
            CCTV_PITCH_MIN,
            CCTV_PITCH_MAX,
          );

      cs.curYaw = THREE.MathUtils.damp(cs.curYaw, relYaw, camTrackLambda, dt);
      cs.curPitch = THREE.MathUtils.damp(cs.curPitch, desiredPitch, camTrackLambda, dt);

      const yawGrp = cctvYawRefs.current[i];
      if (yawGrp) yawGrp.rotation.y = cs.curYaw;
      const pitchGrp = cctvPitchRefs.current[i];
      if (pitchGrp) pitchGrp.rotation.x = -cs.curPitch;

      // Stare-back telephoto zoom easter egg
      _toCctv.set(
        mount.pos[0] - camPos.x,
        mount.pos[1] - 0.1 - camPos.y,
        mount.pos[2] - camPos.z,
      );
      const dist = _toCctv.length();
      const dot = dist > 0.001 ? _toCctv.dot(_camForward) / dist : 0;
      const isStaredAt =
        !isBlackout &&
        dist <= CCTV_STARE_MAX_DIST &&
        dot > CCTV_STARE_MIN_DOT;

      const targetZoom = isStaredAt ? CCTV_ZOOM_EXTEND_M : 0;
      cs.zoomOffset = THREE.MathUtils.damp(cs.zoomOffset, targetZoom, zoomLambda, dt);
      const barrelGrp = cctvBarrelRefs.current[i];
      if (barrelGrp) {
        barrelGrp.position.z = CCTV_BASE_LENS_Z + cs.zoomOffset;
      }

      // Tally LED behavior
      const tallyMat = cctvTallyMatRefs.current[i];
      if (tallyMat) {
        if (isBlackout) {
          tallyMat.color.setHex(0x180404);
        } else if (vocal.mood === "critical") {
          tallyMat.color.setHex(
            Math.floor(t * 8 + i) % 2 === 0 ? 0xff4433 : 0x2c0606,
          );
        } else if (vocal.mood === "warning" || isStaredAt) {
          tallyMat.color.setHex(0xff3b24);
        } else {
          const slowPulse = Math.sin(t * 2.1 + i * 0.85) > -0.2;
          tallyMat.color.setHex(slowPulse ? 0xff2a2a : 0x3b0707);
        }
      }
    }
  });

  const railLen = GANTRY_RAIL_Z_MAX - GANTRY_RAIL_Z_MIN;
  const railCenterZ = (GANTRY_RAIL_Z_MIN + GANTRY_RAIL_Z_MAX) * 0.5;

  return (
    <group>
      {/* ============================================================
          1. FIXED OVERHEAD BRIDGE-CRANE GANTRY RAILS (y = 3.88m)
             x = +/- 1.45m, z = -0.10..+1.45m
         ============================================================ */}
      {([-1, 1] as const).map((side) => (
        <group
          key={`gantry-z-rail-${side}`}
          position={[side * GANTRY_RAIL_HALF_X, GANTRY_RAIL_Y, railCenterZ]}
        >
          {/* H-Beam Top Flange, Web, Bottom Flange */}
          <mesh position={[0, 0.036, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.11, 0.016, railLen]} />
            <meshStandardMaterial color="#1f2724" metalness={0.72} roughness={0.44} />
          </mesh>
          <mesh castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.026, 0.068, railLen]} />
            <meshStandardMaterial
              color="#28332e"
              metalness={0.68}
              roughness={0.48}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          <mesh position={[0, -0.036, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.11, 0.016, railLen]} />
            <meshStandardMaterial color="#1a211e" metalness={0.75} roughness={0.42} />
          </mesh>

          {/* Yellow/Black Hazard End-Stop Bumpers */}
          {([-1, 1] as const).map((endSide) => (
            <mesh
              key={`rail-bumper-${side}-${endSide}`}
              position={[0, -0.02, endSide * (railLen * 0.5 - 0.03)]}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.125, 0.08, 0.055]} />
              <meshStandardMaterial color="#c98916" metalness={0.35} roughness={0.55} />
            </mesh>
          ))}

          {/* Vertical Ceiling Hanger Struts (clear of z=-0.85/+1.8 troffers and z=0 ceiling beam) */}
          {([-1.65 - railCenterZ, -0.45 - railCenterZ, 0.45 - railCenterZ, 2.1 - railCenterZ] as const).map((lz, hIdx) => (
            <mesh
              key={`rail-hanger-${side}-${hIdx}`}
              position={[0, 0.19, lz]}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.048, 0.34, 0.064]} />
              <meshStandardMaterial color="#1b2320" metalness={0.7} roughness={0.44} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Cross-Tie Stiffener Bars (clear of z=-0.25 klaxon and z=-0.85/+1.8 fluorescent troughs) */}
      {[GANTRY_RAIL_Z_MIN, 0.45, GANTRY_RAIL_Z_MAX].map((cz, cIdx) => (
        <mesh
          key={`gantry-tie-${cIdx}`}
          position={[0, GANTRY_RAIL_Y + 0.048, cz]}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <boxGeometry args={[GANTRY_RAIL_HALF_X * 2 + 0.1, 0.04, 0.055]} />
          <meshStandardMaterial color="#202a26" metalness={0.68} roughness={0.46} />
        </mesh>
      ))}

      {/* ============================================================
          2. MOTORIZED ROLLING BRIDGE GIRDER (Z) + TROLLEY CARRIAGE (X)
         ============================================================ */}
      <group ref={gantryBridgeRef} position={[0, GANTRY_BRIDGE_Y, INITIAL_TROLLEY_Z]}>
        {/* Main Bridge Girder H-Beam spanning x = -1.52..+1.52m */}
        <mesh castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[GANTRY_RAIL_HALF_X * 2 + 0.14, 0.085, 0.1]} />
          <meshStandardMaterial
            color="#26332d"
            metalness={0.66}
            roughness={0.46}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        <mesh position={[0, -0.048, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[GANTRY_RAIL_HALF_X * 2 + 0.1, 0.016, 0.135]} />
          <meshStandardMaterial color="#181f1c" metalness={0.76} roughness={0.4} />
        </mesh>

        {/* Left & Right Wheeled End-Trucks riding along fixed Z-rails */}
        {([-1, 1] as const).map((side) => (
          <group key={`end-truck-${side}`} position={[side * GANTRY_RAIL_HALF_X, 0.03, 0]}>
            <mesh castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.15, 0.08, 0.24]} />
              <meshStandardMaterial color="#b37812" metalness={0.42} roughness={0.52} />
            </mesh>
            {([-0.08, 0.08] as const).map((wz, wIdx) => (
              <mesh
                key={`bridge-wheel-${side}-${wIdx}`}
                position={[0, 0.025, wz]}
                rotation={[0, 0, Math.PI / 2]}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.034, 0.034, 0.035, 10]} />
                <meshStandardMaterial color="#7d8a83" metalness={0.86} roughness={0.28} />
              </mesh>
            ))}
          </group>
        ))}

        {/* MOTORIZED X-AXIS TROLLEY CARRIAGE */}
        <group ref={gantryTrolleyRef} position={[INITIAL_TROLLEY_X, 0, 0]}>
          <mesh position={[0, -0.01, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.38, 0.12, 0.24]} />
            <meshStandardMaterial
              color="#1c2521"
              metalness={0.7}
              roughness={0.44}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          {/* Drive Motor Drum & Brass Trim Ring */}
          <mesh
            position={[0.21, 0.01, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.065, 0.065, 0.12, 12]} />
            <meshStandardMaterial color="#2f3f38" metalness={0.68} roughness={0.42} />
          </mesh>
          <mesh position={[0, -0.065, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.17, 0.17, 0.022, 18]} />
            <meshStandardMaterial
              color="#9e8b56"
              metalness={0.86}
              roughness={0.28}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>

          {/* Motorized Telescoping Vertical Spine Column (lowers turret closer to eye level) */}
          <mesh
            position={[0, 0.025, 0]}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.11, 0.125, 0.14, 16]} />
            <meshStandardMaterial color="#18201d" metalness={0.74} roughness={0.4} />
          </mesh>
          <mesh
            ref={spineMidSleeveRef}
            position={[0, -0.21, 0]}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.095, 0.098, 1, 14]} />
            <meshStandardMaterial
              color="#222e29"
              metalness={0.68}
              roughness={0.44}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          <mesh
            ref={spinePistonRef}
            position={[0, -0.35, 0]}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.068, 0.072, 1, 14]} />
            <meshStandardMaterial color="#96a39c" metalness={0.86} roughness={0.26} />
          </mesh>

          {/* ============================================================
              3. 3-JOINT ARTICULATED GLaDOS SPINE (YAW -> SHOULDER -> ELBOW -> WRIST)
             ============================================================ */}
          <group ref={turretYawRef} position={[0, GANTRY_SHOULDER_OFFSET_Y - 0.65, 0]}>
            {/* Turntable Drum */}
            <mesh position={[0, -0.03, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.15, 0.165, 0.08, 16]} />
              <meshStandardMaterial color="#24322c" metalness={0.65} roughness={0.45} />
            </mesh>

            {/* JOINT 1: UPPER SHOULDER HINGE (L1 = 0.54m) */}
            <group ref={shoulderPivotRef} position={[0, 0, 0]}>
              {([-1, 1] as const).map((side) => (
                <group key={`upper-arm-${side}`}>
                  <mesh
                    position={[side * 0.11, -ARM_SEG_LEN * 0.5, 0]}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <boxGeometry args={[0.055, ARM_SEG_LEN, 0.1]} />
                    <meshStandardMaterial
                      color="#222e29"
                      metalness={0.64}
                      roughness={0.46}
                      bumpMap={ironTex.bumpMap}
                      bumpScale={0.005}
                    />
                  </mesh>
                  {/* Telescoping Hydraulic Piston */}
                  <mesh
                    position={[side * 0.055, -ARM_SEG_LEN * 0.45, -0.068]}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <cylinderGeometry args={[0.022, 0.026, ARM_SEG_LEN * 0.78, 8]} />
                    <meshStandardMaterial
                      color="#8d9992"
                      metalness={0.86}
                      roughness={0.26}
                    />
                  </mesh>
                </group>
              ))}

              {/* Ribbed Umbilical Hose Loop at Shoulder */}
              <mesh
                position={[0, -ARM_SEG_LEN * 0.5, -0.1]}
                rotation={[0, Math.PI / 2, 0]}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <torusGeometry args={[0.14, 0.02, 8, 16, Math.PI]} />
                <meshStandardMaterial color="#121413" metalness={0.18} roughness={0.84} />
              </mesh>

              {/* JOINT 2: ELBOW HYDRAULIC KNUCKLE (L2 = 0.54m) */}
              <group ref={elbowPivotRef} position={[0, -ARM_SEG_LEN, 0]}>
                {/* Riveted Elbow Drum + Brass Axle Caps */}
                <mesh
                  rotation={[0, 0, Math.PI / 2]}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                >
                  <cylinderGeometry args={[0.088, 0.088, 0.34, 14]} />
                  <meshStandardMaterial color="#1a221f" metalness={0.72} roughness={0.42} />
                </mesh>
                {([-1, 1] as const).map((side) => (
                  <group key={`forearm-${side}`}>
                    <mesh
                      position={[side * 0.18, 0, 0]}
                      rotation={[0, 0, Math.PI / 2]}
                      castShadow={false}
                      raycast={NOOP_RAYCAST}
                    >
                      <cylinderGeometry args={[0.06, 0.06, 0.032, 12]} />
                      <meshStandardMaterial
                        color="#9e8b56"
                        metalness={0.86}
                        roughness={0.28}
                      />
                    </mesh>
                    <mesh
                      position={[side * 0.085, -ARM_SEG_LEN * 0.5, 0]}
                      castShadow={false}
                      raycast={NOOP_RAYCAST}
                    >
                      <boxGeometry args={[0.048, ARM_SEG_LEN, 0.092]} />
                      <meshStandardMaterial
                        color="#273630"
                        metalness={0.64}
                        roughness={0.46}
                        bumpMap={ironTex.bumpMap}
                        bumpScale={0.005}
                      />
                    </mesh>
                    <mesh
                      position={[side * 0.04, -ARM_SEG_LEN * 0.48, 0.068]}
                      castShadow={false}
                      raycast={NOOP_RAYCAST}
                    >
                      <cylinderGeometry args={[0.02, 0.024, ARM_SEG_LEN * 0.76, 8]} />
                      <meshStandardMaterial
                        color="#8d9992"
                        metalness={0.86}
                        roughness={0.26}
                      />
                    </mesh>
                  </group>
                ))}

                {/* JOINT 3: WRIST GIMBAL (YAW + PITCH + ROLL) AT REAR OF SKULL */}
                <group ref={wristGimbalRef} position={[0, -ARM_SEG_LEN, 0]}>
                  {/* Heavy Neck Gimbal Ball & Collar */}
                  <mesh castShadow={false} raycast={NOOP_RAYCAST}>
                    <sphereGeometry args={[0.095, 14, 12]} />
                    <meshStandardMaterial
                      color="#171d1b"
                      metalness={0.78}
                      roughness={0.38}
                    />
                  </mesh>
                  <mesh
                    position={[0, 0, 0.04]}
                    rotation={[Math.PI / 2, 0, 0]}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <cylinderGeometry args={[0.125, 0.145, 0.09, 14]} />
                    <meshStandardMaterial
                      color="#202a26"
                      metalness={0.68}
                      roughness={0.44}
                    />
                  </mesh>

                  {/* Thick Ribbed Rubber Umbilical Hoses Looping from Rear Skull */}
                  {([-1, 1] as const).map((side) => (
                    <mesh
                      key={`skull-hose-${side}`}
                      position={[side * 0.22, 0.16, 0.04]}
                      rotation={[0, Math.PI / 2, 0]}
                      castShadow={false}
                      raycast={NOOP_RAYCAST}
                    >
                      <torusGeometry args={[0.16, 0.022, 8, 16, Math.PI * 1.15]} />
                      <meshStandardMaterial
                        color="#101211"
                        metalness={0.18}
                        roughness={0.84}
                      />
                    </mesh>
                  ))}

                  {/* ============================================================
                      4. MASSIVE SOVIET BOSS HEAD POD (0.98m x 0.76m x 0.52m)
                         Mounted forward (+0.30m) of wrist gimbal
                     ============================================================ */}
                  <group position={[0, 0, 0.3]}>
                    {/* Armored Steel Chassis */}
                    <mesh castShadow={false} raycast={NOOP_RAYCAST}>
                      <boxGeometry args={[0.98, 0.76, 0.52]} />
                      <meshStandardMaterial
                        color="#24322c"
                        metalness={0.58}
                        roughness={0.48}
                        bumpMap={ironTex.bumpMap}
                        bumpScale={0.006}
                      />
                    </mesh>

                    {/* Heavy Sloped Armored Brow-Cowling */}
                    <mesh
                      position={[0, 0.375, 0.055]}
                      rotation={[0.14, 0, 0]}
                      castShadow={false}
                      raycast={NOOP_RAYCAST}
                    >
                      <boxGeometry args={[1.04, 0.085, 0.6]} />
                      <meshStandardMaterial
                        color="#19221e"
                        metalness={0.68}
                        roughness={0.44}
                      />
                    </mesh>

                    {/* Lower Jaw Armor Guard */}
                    <mesh
                      position={[0, -0.355, 0.03]}
                      castShadow={false}
                      raycast={NOOP_RAYCAST}
                    >
                      <boxGeometry args={[0.94, 0.07, 0.5]} />
                      <meshStandardMaterial
                        color="#1b2420"
                        metalness={0.66}
                        roughness={0.46}
                      />
                    </mesh>

                    {/* Side Radiation-Trefoil Hazard Cheeks */}
                    {([-1, 1] as const).map((side) => (
                      <group
                        key={`rad-cheek-${side}`}
                        position={[side * 0.495, 0.14, 0.05]}
                        rotation={[0, (side * Math.PI) / 2, 0]}
                      >
                        <mesh castShadow={false} raycast={NOOP_RAYCAST}>
                          <boxGeometry args={[0.28, 0.28, 0.016]} />
                          <meshStandardMaterial
                            color="#141414"
                            metalness={0.6}
                            roughness={0.5}
                          />
                        </mesh>
                        <mesh
                          position={[0, 0, 0.012]}
                          castShadow={false}
                          raycast={NOOP_RAYCAST}
                        >
                          <planeGeometry args={[0.24, 0.24]} />
                          <meshStandardMaterial
                            map={radCheekTex}
                            roughness={0.52}
                            polygonOffset
                            polygonOffsetFactor={-2}
                            polygonOffsetUnits={-2}
                          />
                        </mesh>
                      </group>
                    ))}

                    {/* Dark Recessed CRT Bezel Shroud */}
                    <mesh
                      position={[0, 0.01, 0.258]}
                      castShadow={false}
                      raycast={NOOP_RAYCAST}
                    >
                      <boxGeometry args={[0.88, 0.68, 0.035]} />
                      <meshStandardMaterial
                        color="#101513"
                        metalness={0.68}
                        roughness={0.44}
                      />
                    </mesh>

                    {/* Crisp 512x512 Live Face-Only CRT Screen */}
                    <mesh
                      position={[0, 0.01, 0.28]}
                      castShadow={false}
                      raycast={NOOP_RAYCAST}
                    >
                      <planeGeometry args={[0.78, 0.6]} />
                      <meshBasicMaterial
                        ref={turretCrtMatRef}
                        map={turretCrtTex}
                        color="#203626"
                        toneMapped={false}
                        fog={false}
                        polygonOffset
                        polygonOffsetFactor={-2}
                        polygonOffsetUnits={-2}
                      />
                    </mesh>

                    {/* Rear Radiator Cooling Fins */}
                    {[-0.32, -0.16, 0, 0.16, 0.32].map((fx, fIdx) => (
                      <mesh
                        key={`boss-fin-${fIdx}`}
                        position={[fx, 0.02, -0.28]}
                        castShadow={false}
                        raycast={NOOP_RAYCAST}
                      >
                        <boxGeometry args={[0.03, 0.56, 0.065]} />
                        <meshStandardMaterial
                          color="#141b18"
                          metalness={0.72}
                          roughness={0.42}
                        />
                      </mesh>
                    ))}

                    {/* Twin Flared Cast-Iron PA Loudspeaker Horns (pulse on voice) */}
                    {([-1, 1] as const).map((side) => (
                      <group
                        key={`boss-horn-${side}`}
                        ref={side === -1 ? leftHornRef : rightHornRef}
                        position={[side * 0.56, -0.15, 0.07]}
                        rotation={[0, side * 0.18, 0]}
                      >
                        <mesh castShadow={false} raycast={NOOP_RAYCAST}>
                          <boxGeometry args={[0.09, 0.09, 0.11]} />
                          <meshStandardMaterial
                            color="#19211d"
                            metalness={0.66}
                            roughness={0.46}
                          />
                        </mesh>
                        <mesh
                          position={[side * 0.03, 0, 0.1]}
                          rotation={[Math.PI / 2, 0, 0]}
                          castShadow={false}
                          raycast={NOOP_RAYCAST}
                        >
                          <cylinderGeometry args={[0.105, 0.038, 0.14, 14]} />
                          <meshStandardMaterial
                            color="#2b3933"
                            metalness={0.64}
                            roughness={0.42}
                          />
                        </mesh>
                        <mesh
                          position={[side * 0.03, 0, 0.168]}
                          rotation={[Math.PI / 2, 0, 0]}
                          castShadow={false}
                          raycast={NOOP_RAYCAST}
                        >
                          <cylinderGeometry args={[0.088, 0.088, 0.016, 14]} />
                          <meshStandardMaterial color="#090c0b" roughness={0.86} />
                        </mesh>
                      </group>
                    ))}

                    {/* Articulated Cyclops Red KGB Optic Eye + 4 Motorized Brass Shutter Blades */}
                    <group position={[0, -0.34, 0.22]} rotation={[0.38, 0, 0]}>
                      <mesh
                        rotation={[Math.PI / 2, 0, 0]}
                        castShadow={false}
                        raycast={NOOP_RAYCAST}
                      >
                        <cylinderGeometry args={[0.092, 0.105, 0.11, 16]} />
                        <meshStandardMaterial
                          color="#111513"
                          metalness={0.82}
                          roughness={0.32}
                        />
                      </mesh>
                      <mesh
                        position={[0, 0, 0.056]}
                        rotation={[Math.PI / 2, 0, 0]}
                        castShadow={false}
                        raycast={NOOP_RAYCAST}
                      >
                        <cylinderGeometry args={[0.062, 0.062, 0.016, 16]} />
                        <meshBasicMaterial
                          ref={turretOpticMatRef}
                          color="#c41a1a"
                          toneMapped={false}
                          fog={false}
                        />
                      </mesh>
                      <pointLight
                        ref={opticGlowLightRef}
                        castShadow={false}
                        position={[0, 0, 0.11]}
                        color="#ff261f"
                        intensity={0.48}
                        distance={1.6}
                        decay={2}
                      />
                      {[0, 1, 2, 3].map((fi) => {
                        const ang = (fi * Math.PI) / 2 + Math.PI / 4;
                        return (
                          <mesh
                            key={`boss-shutter-${fi}`}
                            ref={(el) => {
                              shutterBladeRefs.current[fi] = el;
                            }}
                            position={[
                              Math.cos(ang) * 0.072,
                              Math.sin(ang) * 0.072,
                              0.028,
                            ]}
                            rotation={[0, 0, ang]}
                            castShadow={false}
                            raycast={NOOP_RAYCAST}
                          >
                            <boxGeometry args={[0.052, 0.022, 0.065]} />
                            <meshStandardMaterial
                              color="#b8a46b"
                              metalness={0.86}
                              roughness={0.28}
                              bumpMap={brassTex.bumpMap}
                              bumpScale={0.004}
                            />
                          </mesh>
                        );
                      })}
                    </group>
                  </group>
                </group>

                {/* ============================================================
                    4B. UNDERSLUNG SHOULDER YOKE + TWIN INDUSTRIAL MANIPULATOR ARMS
                        Always kept horizontally level via counter-rotation (-thetaForearm)
                   ============================================================ */}
                <group ref={armChassisRef} position={[0, -ARM_SEG_LEN, 0]}>
                  {/* Heavy Cast-Iron Collar & Twin Flanking Shoulder Outrigger Brackets */}
                  <mesh position={[0, -0.25, 0.03]} castShadow={false} raycast={NOOP_RAYCAST}>
                    <boxGeometry args={[0.32, 0.12, 0.16]} />
                    <meshStandardMaterial
                      color="#1b231f"
                      metalness={0.72}
                      roughness={0.44}
                      bumpMap={ironTex.bumpMap}
                      bumpScale={0.005}
                    />
                  </mesh>
                  <mesh position={[0, -0.34, 0.08]} castShadow={false} raycast={NOOP_RAYCAST}>
                    <boxGeometry args={[MANIPULATOR_SHOULDER_LOCAL_X * 2 + 0.06, 0.09, 0.14]} />
                    <meshStandardMaterial
                      color="#232e29"
                      metalness={0.68}
                      roughness={0.46}
                      bumpMap={ironTex.bumpMap}
                      bumpScale={0.005}
                    />
                  </mesh>

                  {([0, 1] as const).map((armIdx) => {
                    const side = armIdx === 0 ? -1 : 1;
                    return (
                      <group
                        key={`manipulator-arm-${armIdx}`}
                        position={[
                          side * MANIPULATOR_SHOULDER_LOCAL_X,
                          MANIPULATOR_SHOULDER_LOCAL_Y,
                          MANIPULATOR_SHOULDER_LOCAL_Z,
                        ]}
                      >
                        {/* Bolted Shoulder Turret Drum + Hazard Trim Collar */}
                        <mesh
                          rotation={[0, 0, Math.PI / 2]}
                          castShadow={false}
                          raycast={NOOP_RAYCAST}
                        >
                          <cylinderGeometry args={[0.072, 0.078, 0.12, 14]} />
                          <meshStandardMaterial
                            color="#19211d"
                            metalness={0.74}
                            roughness={0.42}
                            bumpMap={ironTex.bumpMap}
                            bumpScale={0.005}
                          />
                        </mesh>
                        <mesh
                          position={[side * 0.048, 0, 0]}
                          rotation={[0, 0, Math.PI / 2]}
                          castShadow={false}
                          raycast={NOOP_RAYCAST}
                        >
                          <cylinderGeometry args={[0.056, 0.056, 0.036, 12]} />
                          <meshStandardMaterial
                            map={armHazardTex}
                            roughness={0.5}
                            metalness={0.28}
                          />
                        </mesh>
                        {/* Shoulder Pneumatic Feed Hose */}
                        <mesh
                          position={[-side * 0.06, 0.06, -0.05]}
                          rotation={[0, Math.PI / 2, 0]}
                          castShadow={false}
                          raycast={NOOP_RAYCAST}
                        >
                          <torusGeometry args={[0.085, 0.013, 6, 12, Math.PI * 1.1]} />
                          <meshStandardMaterial
                            color="#111312"
                            metalness={0.15}
                            roughness={0.86}
                          />
                        </mesh>

                        {/* IK UPPER ARM GROUP (0.58m down local -Y) */}
                        <group
                          ref={(el) => {
                            upperArmRefs.current[armIdx] = el;
                          }}
                        >
                          {/* Twin Parallel Heavy Steel Strut Tubes */}
                          {([-0.034, 0.034] as const).map((tx, tIdx) => (
                            <mesh
                              key={`upper-tube-${armIdx}-${tIdx}`}
                              position={[tx, -MANIPULATOR_UPPER_LEN * 0.5, 0]}
                              castShadow={false}
                              raycast={NOOP_RAYCAST}
                            >
                              <cylinderGeometry
                                args={[0.02, 0.022, MANIPULATOR_UPPER_LEN, 10]}
                              />
                              <meshStandardMaterial
                                color="#283630"
                                metalness={0.68}
                                roughness={0.44}
                                bumpMap={ironTex.bumpMap}
                                bumpScale={0.005}
                              />
                            </mesh>
                          ))}
                          {/* Olive-Steel Cross Gusset Webbing */}
                          {([-0.16, -0.34, -0.49] as const).map((by, bIdx) => (
                            <mesh
                              key={`upper-web-${armIdx}-${bIdx}`}
                              position={[0, by, 0]}
                              castShadow={false}
                              raycast={NOOP_RAYCAST}
                            >
                              <boxGeometry args={[0.092, 0.038, 0.052]} />
                              <meshStandardMaterial
                                color="#1d2622"
                                metalness={0.7}
                                roughness={0.46}
                              />
                            </mesh>
                          ))}
                          {/* Exposed Chrome Hydraulic Piston Cylinder */}
                          <mesh
                            position={[0, -MANIPULATOR_UPPER_LEN * 0.32, -0.052]}
                            castShadow={false}
                            raycast={NOOP_RAYCAST}
                          >
                            <cylinderGeometry args={[0.019, 0.021, 0.28, 10]} />
                            <meshStandardMaterial
                              color="#202825"
                              metalness={0.74}
                              roughness={0.4}
                            />
                          </mesh>
                          <mesh
                            position={[0, -MANIPULATOR_UPPER_LEN * 0.62, -0.052]}
                            castShadow={false}
                            raycast={NOOP_RAYCAST}
                          >
                            <cylinderGeometry args={[0.011, 0.011, 0.3, 10]} />
                            <meshStandardMaterial
                              color="#aeb9b3"
                              metalness={0.88}
                              roughness={0.22}
                            />
                          </mesh>
                          {/* Drooping Rubber Cable Conduit Loop */}
                          <mesh
                            position={[side * 0.052, -MANIPULATOR_UPPER_LEN * 0.5, -0.018]}
                            rotation={[Math.PI / 2, 0, Math.PI / 2]}
                            castShadow={false}
                            raycast={NOOP_RAYCAST}
                          >
                            <torusGeometry args={[0.14, 0.011, 6, 14, Math.PI]} />
                            <meshStandardMaterial
                              color="#0f1110"
                              metalness={0.14}
                              roughness={0.88}
                            />
                          </mesh>

                          {/* IK ELBOW SERVO DRUM + FOREARM BOOM (0.56m down local -Y) */}
                          <group
                            ref={(el) => {
                              elbowArmRefs.current[armIdx] = el;
                            }}
                            position={[0, -MANIPULATOR_UPPER_LEN, 0]}
                          >
                            {/* Ribbed Elbow Servo Drum */}
                            <mesh
                              rotation={[0, 0, Math.PI / 2]}
                              castShadow={false}
                              raycast={NOOP_RAYCAST}
                            >
                              <cylinderGeometry args={[0.056, 0.056, 0.135, 14]} />
                              <meshStandardMaterial
                                color="#1a221e"
                                metalness={0.74}
                                roughness={0.4}
                              />
                            </mesh>
                            {([-0.072, 0.072] as const).map((cx, cIdx) => (
                              <mesh
                                key={`elbow-cap-${armIdx}-${cIdx}`}
                                position={[cx, 0, 0]}
                                rotation={[0, 0, Math.PI / 2]}
                                castShadow={false}
                                raycast={NOOP_RAYCAST}
                              >
                                <cylinderGeometry args={[0.036, 0.036, 0.014, 10]} />
                                <meshStandardMaterial
                                  color="#9e8b56"
                                  metalness={0.86}
                                  roughness={0.28}
                                />
                              </mesh>
                            ))}
                            {/* Elbow Status LED Indicator */}
                            <mesh
                              position={[side * 0.062, 0, 0.042]}
                              castShadow={false}
                              raycast={NOOP_RAYCAST}
                            >
                              <sphereGeometry args={[0.012, 8, 8]} />
                              <meshBasicMaterial
                                ref={(el) => {
                                  armElbowLedMatRefs.current[armIdx] = el;
                                }}
                                color="#33ff66"
                                toneMapped={false}
                                fog={false}
                              />
                            </mesh>

                            {/* Tapered Stamped-Steel Forearm Actuator Boom */}
                            <mesh
                              position={[0, -MANIPULATOR_FOREARM_LEN * 0.44, 0]}
                              castShadow={false}
                              raycast={NOOP_RAYCAST}
                            >
                              <cylinderGeometry
                                args={[0.038, 0.025, MANIPULATOR_FOREARM_LEN * 0.88, 12]}
                              />
                              <meshStandardMaterial
                                color="#26342e"
                                metalness={0.64}
                                roughness={0.46}
                                bumpMap={ironTex.bumpMap}
                                bumpScale={0.005}
                              />
                            </mesh>
                            {/* Forearm Hazard Trim Band */}
                            <mesh
                              position={[0, -MANIPULATOR_FOREARM_LEN * 0.22, 0]}
                              castShadow={false}
                              raycast={NOOP_RAYCAST}
                            >
                              <cylinderGeometry args={[0.037, 0.035, 0.042, 12]} />
                              <meshStandardMaterial
                                map={armHazardTex}
                                roughness={0.5}
                                metalness={0.25}
                              />
                            </mesh>
                            {/* Forearm Lateral Hydraulic Pushrod */}
                            <mesh
                              position={[0, -MANIPULATOR_FOREARM_LEN * 0.5, 0.04]}
                              castShadow={false}
                              raycast={NOOP_RAYCAST}
                            >
                              <cylinderGeometry
                                args={[0.01, 0.011, MANIPULATOR_FOREARM_LEN * 0.78, 8]}
                              />
                              <meshStandardMaterial
                                color="#98a49e"
                                metalness={0.86}
                                roughness={0.24}
                              />
                            </mesh>
                            {/* Brass Forearm Wrist Cuff */}
                            <mesh
                              position={[0, -MANIPULATOR_FOREARM_LEN + 0.018, 0]}
                              castShadow={false}
                              raycast={NOOP_RAYCAST}
                            >
                              <cylinderGeometry args={[0.034, 0.038, 0.036, 12]} />
                              <meshStandardMaterial
                                color="#9e8b56"
                                metalness={0.86}
                                roughness={0.28}
                              />
                            </mesh>

                            {/* IK 360-DEGREE WRIST SOCKET + 3-PRONG GRIPPER CLAW */}
                            <group
                              ref={(el) => {
                                wristArmRefs.current[armIdx] = el;
                              }}
                              position={[0, -MANIPULATOR_FOREARM_LEN, 0]}
                            >
                              {/* Wrist Ball Gimbal */}
                              <mesh castShadow={false} raycast={NOOP_RAYCAST}>
                                <sphereGeometry args={[0.034, 10, 8]} />
                                <meshStandardMaterial
                                  color="#161c19"
                                  metalness={0.8}
                                  roughness={0.34}
                                />
                              </mesh>
                              {/* 360-Deg Rotary Tool Chuck */}
                              <group
                                ref={(el) => {
                                  wristRollRefs.current[armIdx] = el;
                                }}
                              >
                                <mesh
                                  position={[0, -0.022, 0]}
                                  castShadow={false}
                                  raycast={NOOP_RAYCAST}
                                >
                                  <cylinderGeometry args={[0.044, 0.048, 0.03, 12]} />
                                  <meshStandardMaterial
                                    color="#222a26"
                                    metalness={0.76}
                                    roughness={0.38}
                                  />
                                </mesh>
                                <mesh
                                  position={[0, -0.038, 0]}
                                  castShadow={false}
                                  raycast={NOOP_RAYCAST}
                                >
                                  <cylinderGeometry args={[0.032, 0.028, 0.012, 12]} />
                                  <meshStandardMaterial
                                    color="#b8a46b"
                                    metalness={0.88}
                                    roughness={0.26}
                                  />
                                </mesh>
                                {/* 3 Articulated Radial Steel Pincer Fingers (0°, 120°, 240°) */}
                                {[0, 1, 2].map((fIdx) => (
                                  <group
                                    key={`claw-mount-${armIdx}-${fIdx}`}
                                    rotation={[0, (fIdx * Math.PI * 2) / 3, 0]}
                                  >
                                    <group
                                      ref={(el) => {
                                        clawFingerRefs.current[armIdx][fIdx] = el;
                                      }}
                                      position={[0, -0.028, 0.042]}
                                    >
                                      {/* Knuckle Pin */}
                                      <mesh
                                        rotation={[0, 0, Math.PI / 2]}
                                        castShadow={false}
                                        raycast={NOOP_RAYCAST}
                                      >
                                        <cylinderGeometry args={[0.008, 0.008, 0.022, 8]} />
                                        <meshStandardMaterial
                                          color="#9e8b56"
                                          metalness={0.86}
                                          roughness={0.26}
                                        />
                                      </mesh>
                                      {/* Proximal Pincer Jaw */}
                                      <mesh
                                        position={[0, -0.032, 0.004]}
                                        rotation={[-0.14, 0, 0]}
                                        castShadow={false}
                                        raycast={NOOP_RAYCAST}
                                      >
                                        <boxGeometry args={[0.016, 0.068, 0.014]} />
                                        <meshStandardMaterial
                                          color="#34403a"
                                          metalness={0.78}
                                          roughness={0.36}
                                        />
                                      </mesh>
                                      {/* Distal Inward-Curling Serrated Tip (`y ≈ -0.14m` from wrist) */}
                                      <mesh
                                        position={[0, -0.086, -0.006]}
                                        rotation={[0.38, 0, 0]}
                                        castShadow={false}
                                        raycast={NOOP_RAYCAST}
                                      >
                                        <boxGeometry args={[0.013, 0.056, 0.011]} />
                                        <meshStandardMaterial
                                          color="#ffb000"
                                          metalness={0.42}
                                          roughness={0.48}
                                        />
                                      </mesh>
                                    </group>
                                  </group>
                                ))}
                              </group>
                            </group>
                          </group>
                        </group>
                      </group>
                    );
                  })}
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* ============================================================
          5. FOUR CORNER KGB-TV-84 PAN-TILT SURVEILLANCE CAMERAS
         ============================================================ */}
      {CCTV_MOUNTS.map((cam, idx) => (
        <group
          key={`kgb-cctv-${cam.id}`}
          position={[cam.pos[0], cam.pos[1], cam.pos[2]]}
          rotation={[0, cam.baseYaw, 0]}
        >
          {/* Bolted Wall / Column Mounting Plate (flush against pilaster/column) */}
          <mesh position={[0, 0, -0.052]} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.14, 0.16, 0.018]} />
            <meshStandardMaterial
              color="#1b221f"
              metalness={0.72}
              roughness={0.44}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          {/* Horizontal L-Bracket Arm */}
          <mesh position={[0, 0.02, 0.025]} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.048, 0.044, 0.16]} />
            <meshStandardMaterial color="#293630" metalness={0.66} roughness={0.44} />
          </mesh>
          {/* Looped Black BNC Coax Cable */}
          <mesh
            position={[0.045, -0.045, -0.01]}
            rotation={[0, Math.PI / 2, 0]}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <torusGeometry args={[0.048, 0.008, 6, 14, Math.PI * 1.35]} />
            <meshStandardMaterial color="#101211" metalness={0.15} roughness={0.85} />
          </mesh>

          {/* YAW SWIVEL POST (+/- 75 deg) */}
          <group
            ref={(el) => {
              cctvYawRefs.current[idx] = el;
            }}
            position={[0, -0.035, 0.095]}
          >
            <mesh castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.028, 0.032, 0.075, 10]} />
              <meshStandardMaterial color="#1e2723" metalness={0.72} roughness={0.4} />
            </mesh>

            {/* PITCH CRADLE (-8..-52 deg) */}
            <group
              ref={(el) => {
                cctvPitchRefs.current[idx] = el;
              }}
              position={[0, -0.065, 0.015]}
            >
              {/* Boxy Olive-Steel Camera Body (0.24m x 0.14m x 0.34m) */}
              <mesh castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.24, 0.14, 0.34]} />
                <meshStandardMaterial
                  color="#2f4239"
                  metalness={0.54}
                  roughness={0.5}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.005}
                />
              </mesh>
              {/* Overhanging Sheet-Metal Sun Hood */}
              <mesh
                position={[0, 0.082, 0.045]}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <boxGeometry args={[0.256, 0.018, 0.42]} />
                <meshStandardMaterial color="#202c27" metalness={0.62} roughness={0.46} />
              </mesh>
              {([-1, 1] as const).map((side) => (
                <mesh
                  key={`cctv-cheek-${idx}-${side}`}
                  position={[side * 0.122, 0.042, 0.19]}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                >
                  <boxGeometry args={[0.012, 0.075, 0.12]} />
                  <meshStandardMaterial color="#202c27" metalness={0.62} roughness={0.46} />
                </mesh>
              ))}
              {/* Rear Cable Gland */}
              <mesh
                position={[0, -0.02, -0.185]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.022, 0.026, 0.036, 8]} />
                <meshStandardMaterial color="#141816" metalness={0.7} roughness={0.45} />
              </mesh>

              {/* Glowing Red Tally LED inside Brass Bezel */}
              <mesh
                position={[0.075, 0.045, 0.172]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.014, 0.014, 0.01, 8]} />
                <meshStandardMaterial color="#9e8b56" metalness={0.86} roughness={0.28} />
              </mesh>
              <mesh
                position={[0.075, 0.045, 0.178]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.009, 0.009, 0.008, 8]} />
                <meshBasicMaterial
                  ref={(el) => {
                    cctvTallyMatRefs.current[idx] = el;
                  }}
                  color="#ff2a2a"
                  toneMapped={false}
                  fog={false}
                />
              </mesh>

              {/* Telescoping Multi-Element Telephoto Lens Barrel (extends +0.035m on stare-back) */}
              <group
                ref={(el) => {
                  cctvBarrelRefs.current[idx] = el;
                }}
                position={[0, -0.008, CCTV_BASE_LENS_Z]}
              >
                <mesh
                  rotation={[Math.PI / 2, 0, 0]}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                >
                  <cylinderGeometry args={[0.048, 0.054, 0.085, 14]} />
                  <meshStandardMaterial
                    color="#151918"
                    metalness={0.82}
                    roughness={0.32}
                  />
                </mesh>
                <mesh
                  position={[0, 0, 0.036]}
                  rotation={[Math.PI / 2, 0, 0]}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                >
                  <cylinderGeometry args={[0.042, 0.046, 0.032, 14]} />
                  <meshStandardMaterial
                    color="#2a322f"
                    metalness={0.78}
                    roughness={0.36}
                  />
                </mesh>
                <mesh
                  position={[0, 0, 0.053]}
                  rotation={[Math.PI / 2, 0, 0]}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                >
                  <cylinderGeometry args={[0.032, 0.032, 0.006, 14]} />
                  <meshStandardMaterial
                    color="#0d2626"
                    metalness={0.92}
                    roughness={0.08}
                  />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      ))}
    </group>
  );
});
