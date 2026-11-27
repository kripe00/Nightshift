import * as THREE from "three";

export type KomradGrabPhase =
  | "idle"
  | "intercept"
  | "carrying"
  | "dropping"
  | "liquidating";

export const GRAB_INTERCEPT_DURATION = 0.65;
export const GRAB_CARRY_DURATION = 1.25;
export const GRAB_DROP_DURATION = 0.45;
export const GRAB_CLAMP_TIME = 0.48;
export const GRAB_TOUCHDOWN_TIME = 0.22;
export const GRAB_ULTIMATUM_TIME = 0.28;

export const LIQUIDATION_SNATCH_DURATION = 0.65;
export const LIQUIDATION_CLAMP_TIME = 0.44;
export const LIQUIDATION_DURATION = 2.05;
export const LIQUIDATION_HOIST_DELTA_Y = 0.55;
export const LIQUIDATION_MAX_ROLL_RAD = THREE.MathUtils.degToRad(7.2);
export const LIQUIDATION_FACE_STANDOFF = 0.96;
export const LIQUIDATION_AIRLOCK_X = 0.0;
export const LIQUIDATION_AIRLOCK_Z = 3.95;

export const SEATED_CHAIR_X = 0.0;
export const SEATED_CHAIR_Y = 1.12;
export const SEATED_CHAIR_Z = 2.48;
export const SEATED_CHAIR_YAW = 0.0;
export const SEATED_CHAIR_PITCH = -0.08;
export const SEATED_CHAIR_FOV = 44;

export const GRAB_STANDING_EYE_Y = 1.65;
export const GRAB_HOIST_DELTA_Y = 0.35;
export const GRAB_TROLLEY_STANDOFF = 1.32;

export const GRAB_GANTRY_X_MIN = -4.42;
export const GRAB_GANTRY_X_MAX = 4.48;
export const GRAB_GANTRY_Z_MIN = -1.48;
export const GRAB_GANTRY_Z_MAX = 1.95;
export const DESK_GANTRY_DROP_X = 0.0;
export const DESK_GANTRY_DROP_Z = 1.16;

function shortestAngleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function lerpAngle(from: number, to: number, t: number): number {
  return from + shortestAngleDiff(to, from) * t;
}

export interface KomradGrabBridgeState {
  phase: KomradGrabPhase;
  phaseElapsed: number;
  grabRunSeq: number;
  cameraSnapNeeded: boolean;
  gantrySnapNeeded: boolean;

  startCamX: number;
  startCamY: number;
  startCamZ: number;
  startCamYaw: number;
  startCamPitch: number;

  startGantryX: number;
  startGantryY: number;
  startGantryZ: number;

  interceptGantryX: number;
  interceptGantryY: number;
  interceptGantryZ: number;

  carryStartGantryX: number;
  carryStartGantryY: number;
  carryStartGantryZ: number;

  p0x: number;
  p0z: number;
  p1x: number;
  p1z: number;
  p2x: number;
  p2z: number;
  p3x: number;
  p3z: number;

  camX: number;
  camY: number;
  camZ: number;
  camYaw: number;
  camPitch: number;
  camRoll: number;

  gantryTargetX: number;
  gantryTargetY: number;
  gantryTargetZ: number;

  gantryHeadWorldX: number;
  gantryHeadWorldY: number;
  gantryHeadWorldZ: number;

  clawOpen: number;
  armReachBlend: number;
  trauma: number;

  clampFired: boolean;
  thudFired: boolean;
  ultimatumFired: boolean;

  clampEventPending: boolean;
  releaseHissEventPending: boolean;
  thudEventPending: boolean;
  ultimatumEventPending: boolean;
  pendingUltimatumLine: string;

  seatedHandoffPending: boolean;
  justFinishedGrab: boolean;

  liquidationInterceptX: number;
  liquidationInterceptY: number;
  liquidationInterceptZ: number;
  liquidationProgress: number;
  liquidationVignette: number;
  liquidationFlash: number;
  liquidationCompletePending: boolean;

  strike5SurgeRemainingSec: number;
  strike5SurgeEventPending: boolean;
}

export const komradGrabState: KomradGrabBridgeState = {
  phase: "idle",
  phaseElapsed: 0,
  grabRunSeq: 0,
  cameraSnapNeeded: false,
  gantrySnapNeeded: false,

  startCamX: 0,
  startCamY: GRAB_STANDING_EYE_Y,
  startCamZ: 0.52,
  startCamYaw: 0,
  startCamPitch: 0,

  startGantryX: 0,
  startGantryY: 1.96,
  startGantryZ: -0.15,

  interceptGantryX: 0,
  interceptGantryY: 1.88,
  interceptGantryZ: -0.15,

  carryStartGantryX: 0,
  carryStartGantryY: 1.88,
  carryStartGantryZ: -0.15,

  p0x: 0,
  p0z: 0.52,
  p1x: 0,
  p1z: 1.0,
  p2x: 0,
  p2z: 2.0,
  p3x: SEATED_CHAIR_X,
  p3z: SEATED_CHAIR_Z,

  camX: 0,
  camY: GRAB_STANDING_EYE_Y,
  camZ: 0.52,
  camYaw: 0,
  camPitch: 0,
  camRoll: 0,

  gantryTargetX: 0,
  gantryTargetY: 1.96,
  gantryTargetZ: -0.15,

  gantryHeadWorldX: 0,
  gantryHeadWorldY: 1.9,
  gantryHeadWorldZ: 0.35,

  clawOpen: 1.0,
  armReachBlend: 0,
  trauma: 0,

  clampFired: false,
  thudFired: false,
  ultimatumFired: false,

  clampEventPending: false,
  releaseHissEventPending: false,
  thudEventPending: false,
  ultimatumEventPending: false,
  pendingUltimatumLine: "",

  seatedHandoffPending: false,
  justFinishedGrab: false,

  liquidationInterceptX: 0,
  liquidationInterceptY: 1.72,
  liquidationInterceptZ: -0.15,
  liquidationProgress: 0,
  liquidationVignette: 0,
  liquidationFlash: 0,
  liquidationCompletePending: false,

  strike5SurgeRemainingSec: 0,
  strike5SurgeEventPending: false,
};

let steppedThisTick = false;

export function isKomradGrabActive(): boolean {
  return komradGrabState.phase !== "idle";
}

export function isKomradLiquidating(): boolean {
  return komradGrabState.phase === "liquidating";
}

export function isKomradStrike5Surging(): boolean {
  return komradGrabState.strike5SurgeRemainingSec > 0;
}

export function startKomradStrike5Surge(durationSec = 3.4): void {
  if (komradGrabState.phase === "liquidating") return;
  komradGrabState.strike5SurgeRemainingSec = Math.max(
    komradGrabState.strike5SurgeRemainingSec,
    durationSec,
  );
  komradGrabState.strike5SurgeEventPending = true;
}

export function stepKomradStrike5Surge(dt: number): void {
  if (komradGrabState.strike5SurgeRemainingSec > 0) {
    komradGrabState.strike5SurgeRemainingSec = Math.max(
      0,
      komradGrabState.strike5SurgeRemainingSec - Math.max(0, dt),
    );
  }
}

export function startKomradGrabSequence(ultimatumLine: string): boolean {
  if (komradGrabState.phase !== "idle") {
    return false;
  }
  const s = komradGrabState;
  s.phase = "intercept";
  s.phaseElapsed = 0;
  s.grabRunSeq += 1;
  s.cameraSnapNeeded = true;
  s.gantrySnapNeeded = true;
  s.clawOpen = 1.0;
  s.armReachBlend = 0;
  s.trauma = 0;
  s.clampFired = false;
  s.thudFired = false;
  s.ultimatumFired = false;
  s.clampEventPending = false;
  s.releaseHissEventPending = false;
  s.thudEventPending = false;
  s.ultimatumEventPending = false;
  s.pendingUltimatumLine = ultimatumLine;
  s.seatedHandoffPending = false;
  s.justFinishedGrab = false;
  s.liquidationProgress = 0;
  s.liquidationVignette = 0;
  s.liquidationFlash = 0;
  s.liquidationCompletePending = false;
  return true;
}

export function startKomradLiquidationSequence(): boolean {
  if (komradGrabState.phase === "liquidating") {
    return false;
  }
  const s = komradGrabState;
  s.phase = "liquidating";
  s.phaseElapsed = 0;
  s.grabRunSeq += 1;
  s.cameraSnapNeeded = true;
  s.gantrySnapNeeded = true;
  s.clawOpen = 1.0;
  s.armReachBlend = 0;
  s.trauma = 0.55;
  s.clampFired = false;
  s.thudFired = false;
  s.ultimatumFired = false;
  s.clampEventPending = false;
  s.releaseHissEventPending = false;
  s.thudEventPending = false;
  s.ultimatumEventPending = false;
  s.pendingUltimatumLine = "";
  s.seatedHandoffPending = false;
  s.justFinishedGrab = false;
  s.liquidationProgress = 0;
  s.liquidationVignette = 0.18;
  s.liquidationFlash = 0;
  s.liquidationCompletePending = false;
  s.strike5SurgeRemainingSec = 0;
  s.strike5SurgeEventPending = false;
  return true;
}

export function abortKomradGrab(): void {
  const s = komradGrabState;
  s.phase = "idle";
  s.phaseElapsed = 0;
  s.cameraSnapNeeded = false;
  s.gantrySnapNeeded = false;
  s.camRoll = 0;
  s.clawOpen = 0.22;
  s.armReachBlend = 0;
  s.trauma = 0;
  s.clampFired = false;
  s.thudFired = false;
  s.ultimatumFired = false;
  s.clampEventPending = false;
  s.releaseHissEventPending = false;
  s.thudEventPending = false;
  s.ultimatumEventPending = false;
  s.pendingUltimatumLine = "";
  s.seatedHandoffPending = false;
  s.justFinishedGrab = false;
  s.liquidationProgress = 0;
  s.liquidationVignette = 0;
  s.liquidationFlash = 0;
  s.liquidationCompletePending = false;
  s.strike5SurgeRemainingSec = 0;
  s.strike5SurgeEventPending = false;
}

export function snapshotGrabCameraPose(
  x: number,
  y: number,
  z: number,
  yaw: number,
  pitch: number,
): void {
  const s = komradGrabState;
  s.cameraSnapNeeded = false;
  s.startCamX = x;
  s.startCamY = y;
  s.startCamZ = z;
  s.startCamYaw = yaw;
  s.startCamPitch = pitch;

  s.camX = x;
  s.camY = y;
  s.camZ = z;
  s.camYaw = yaw;
  s.camPitch = pitch;
  s.camRoll = 0;

  // Compute intercept gantry position ~1.32m toward open room center from the player
  let dirX = 0.0 - x;
  let dirZ = 0.15 - z;
  let dist = Math.hypot(dirX, dirZ);
  if (dist < 0.1) {
    dirX = 0.0;
    dirZ = -1.0;
    dist = 1.0;
  }
  dirX /= dist;
  dirZ /= dist;

  s.interceptGantryX = THREE.MathUtils.clamp(
    x + dirX * GRAB_TROLLEY_STANDOFF,
    GRAB_GANTRY_X_MIN,
    GRAB_GANTRY_X_MAX,
  );
  s.interceptGantryZ = THREE.MathUtils.clamp(
    z + dirZ * GRAB_TROLLEY_STANDOFF,
    GRAB_GANTRY_Z_MIN,
    GRAB_GANTRY_Z_MAX,
  );
  s.interceptGantryY = 1.88;

  s.liquidationInterceptX = THREE.MathUtils.clamp(
    x + dirX * LIQUIDATION_FACE_STANDOFF,
    GRAB_GANTRY_X_MIN,
    GRAB_GANTRY_X_MAX,
  );
  s.liquidationInterceptZ = THREE.MathUtils.clamp(
    z + dirZ * LIQUIDATION_FACE_STANDOFF,
    GRAB_GANTRY_Z_MIN,
    GRAB_GANTRY_Z_MAX,
  );
  s.liquidationInterceptY = 1.72;

  // Collision-safe cubic Bezier carry spline routing cleanly around the Supervisor Desk OBB
  s.p0x = x;
  s.p0z = z;
  s.p3x = SEATED_CHAIR_X;
  s.p3z = SEATED_CHAIR_Z;

  if (z >= 2.25) {
    s.p1x = THREE.MathUtils.lerp(x, SEATED_CHAIR_X, 0.35);
    s.p1z = THREE.MathUtils.lerp(z, SEATED_CHAIR_Z, 0.35);
    s.p2x = THREE.MathUtils.lerp(x, SEATED_CHAIR_X, 0.7);
    s.p2z = THREE.MathUtils.lerp(z, SEATED_CHAIR_Z, 0.7);
  } else {
    const aisleSign = x < 0 ? -1 : 1;
    const aisleX = aisleSign * 1.72;
    s.p1x = aisleX;
    s.p1z = Math.min(1.05, Math.max(-0.6, z * 0.5 + 0.45));
    s.p2x = aisleX;
    s.p2z = 2.38;
  }
}

export function snapshotGrabGantryPose(x: number, y: number, z: number): void {
  const s = komradGrabState;
  s.gantrySnapNeeded = false;
  s.startGantryX = x;
  s.startGantryY = y;
  s.startGantryZ = z;
  s.gantryTargetX = x;
  s.gantryTargetY = y;
  s.gantryTargetZ = z;
  s.gantryHeadWorldX = x;
  s.gantryHeadWorldY = y;
  s.gantryHeadWorldZ = z + 0.45;
}

export function stepKomradGrab(rawDt: number): void {
  if (steppedThisTick) return;
  steppedThisTick = true;
  queueMicrotask(() => {
    steppedThisTick = false;
  });

  const s = komradGrabState;
  if (s.phase === "idle") return;
  if (s.cameraSnapNeeded || s.gantrySnapNeeded) return;

  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  s.phaseElapsed += dt;
  s.trauma = Math.max(0, s.trauma - dt * 3.4);

  const headDx = s.gantryHeadWorldX - s.camX;
  const headDy = s.gantryHeadWorldY - s.camY;
  const headDz = s.gantryHeadWorldZ - s.camZ;
  const headHoriz = Math.max(1e-4, Math.hypot(headDx, headDz));
  const headYaw = Math.atan2(-headDx, -headDz);
  const headPitch = THREE.MathUtils.clamp(
    Math.atan2(headDy, headHoriz),
    THREE.MathUtils.degToRad(-75),
    THREE.MathUtils.degToRad(70),
  );

  if (s.phase === "liquidating") {
    s.liquidationProgress = THREE.MathUtils.clamp(
      s.phaseElapsed / LIQUIDATION_DURATION,
      0,
      1,
    );

    if (s.phaseElapsed < LIQUIDATION_SNATCH_DURATION) {
      const u = THREE.MathUtils.clamp(
        s.phaseElapsed / LIQUIDATION_SNATCH_DURATION,
        0,
        1,
      );
      const e = 1 - Math.pow(1 - u, 3);

      s.gantryTargetX = THREE.MathUtils.lerp(
        s.startGantryX,
        s.liquidationInterceptX,
        e,
      );
      s.gantryTargetY = THREE.MathUtils.lerp(
        s.startGantryY,
        s.liquidationInterceptY,
        e,
      );
      s.gantryTargetZ = THREE.MathUtils.lerp(
        s.startGantryZ,
        s.liquidationInterceptZ,
        e,
      );

      s.armReachBlend = THREE.MathUtils.clamp(s.phaseElapsed / 0.36, 0, 1);

      if (s.phaseElapsed >= LIQUIDATION_CLAMP_TIME) {
        if (!s.clampFired) {
          s.clampFired = true;
          s.clampEventPending = true;
          s.trauma = 1.0;
        }
        s.clawOpen = 0.1;
      } else {
        s.clawOpen = THREE.MathUtils.lerp(1.0, 0.72, u);
      }

      s.camX = s.startCamX + Math.sin(s.phaseElapsed * 68) * 0.018 * s.trauma;
      s.camY = s.startCamY + Math.cos(s.phaseElapsed * 54) * 0.016 * s.trauma;
      s.camZ = s.startCamZ;

      const lookAlpha = 1 - Math.exp(-15.0 * dt);
      s.camYaw = lerpAngle(s.camYaw, headYaw, lookAlpha);
      s.camPitch = THREE.MathUtils.lerp(s.camPitch, headPitch, lookAlpha);
      s.camRoll = Math.sin(s.phaseElapsed * 56) * 0.065 * s.trauma;

      s.liquidationVignette = THREE.MathUtils.lerp(0.18, 0.44, u);
      s.liquidationFlash = 0;
    } else {
      if (!s.clampFired) {
        s.clampFired = true;
        s.clampEventPending = true;
        s.trauma = 1.0;
      }

      const dragT = THREE.MathUtils.clamp(
        (s.phaseElapsed - LIQUIDATION_SNATCH_DURATION) /
          (LIQUIDATION_DURATION - LIQUIDATION_SNATCH_DURATION),
        0,
        1,
      );
      const dragEase = dragT * dragT * (3 - 2 * dragT);
      const hoistU = THREE.MathUtils.clamp(dragT / 0.34, 0, 1);
      const hoistEase = 1 - Math.pow(1 - hoistU, 3);

      const baseY =
        s.startCamY +
        LIQUIDATION_HOIST_DELTA_Y * hoistEase +
        0.16 * dragT * dragT;
      const cx = THREE.MathUtils.lerp(
        s.startCamX,
        LIQUIDATION_AIRLOCK_X,
        dragEase,
      );
      const cz = THREE.MathUtils.lerp(
        s.startCamZ,
        LIQUIDATION_AIRLOCK_Z,
        dragEase,
      );
      const vibX = Math.sin(s.phaseElapsed * 52) * (0.01 + 0.02 * s.trauma);
      const vibY = Math.cos(s.phaseElapsed * 44) * (0.01 + 0.018 * s.trauma);

      s.camX = cx + vibX;
      s.camY = baseY + vibY;
      s.camZ = cz;

      const offX = THREE.MathUtils.lerp(
        s.liquidationInterceptX - s.startCamX,
        0,
        dragEase,
      );
      const offZ = THREE.MathUtils.lerp(
        s.liquidationInterceptZ - s.startCamZ,
        -1.05,
        dragEase,
      );
      s.gantryTargetX = THREE.MathUtils.clamp(
        cx + offX,
        GRAB_GANTRY_X_MIN,
        GRAB_GANTRY_X_MAX,
      );
      s.gantryTargetZ = THREE.MathUtils.clamp(
        cz + offZ,
        GRAB_GANTRY_Z_MIN,
        GRAB_GANTRY_Z_MAX,
      );
      s.gantryTargetY = THREE.MathUtils.clamp(baseY + 0.04, 1.65, 2.35);

      const lookAlpha = 1 - Math.exp(-13.5 * dt);
      s.camYaw = lerpAngle(s.camYaw, headYaw, lookAlpha);
      s.camPitch = THREE.MathUtils.lerp(s.camPitch, headPitch, lookAlpha);
      const rollTilt = THREE.MathUtils.lerp(
        0,
        LIQUIDATION_MAX_ROLL_RAD,
        THREE.MathUtils.clamp(dragT / 0.35, 0, 1),
      );
      s.camRoll =
        rollTilt +
        Math.sin(s.phaseElapsed * 48) * (0.018 + 0.035 * s.trauma);

      s.clawOpen = 0.1;
      s.armReachBlend = 1.0;
      s.liquidationVignette = THREE.MathUtils.lerp(
        0.44,
        1.0,
        Math.pow(dragT, 0.85),
      );
      const flashStart = LIQUIDATION_DURATION - 0.18;
      s.liquidationFlash =
        s.phaseElapsed >= flashStart
          ? THREE.MathUtils.clamp(
              (s.phaseElapsed - flashStart) / 0.18,
              0,
              1,
            )
          : 0;
    }

    if (s.phaseElapsed >= LIQUIDATION_DURATION) {
      s.phase = "idle";
      s.phaseElapsed = 0;
      s.armReachBlend = 0;
      s.liquidationVignette = 1;
      s.liquidationFlash = 1;
      s.liquidationCompletePending = true;
    }
    return;
  }

  if (s.phase === "intercept") {
    const u = THREE.MathUtils.clamp(
      s.phaseElapsed / GRAB_INTERCEPT_DURATION,
      0,
      1,
    );
    const e = 1 - Math.pow(1 - u, 3);

    s.gantryTargetX = THREE.MathUtils.lerp(
      s.startGantryX,
      s.interceptGantryX,
      e,
    );
    s.gantryTargetY = THREE.MathUtils.lerp(
      s.startGantryY,
      s.interceptGantryY,
      e,
    );
    s.gantryTargetZ = THREE.MathUtils.lerp(
      s.startGantryZ,
      s.interceptGantryZ,
      e,
    );

    s.armReachBlend = THREE.MathUtils.clamp(s.phaseElapsed / 0.44, 0, 1);

    if (s.phaseElapsed >= GRAB_CLAMP_TIME) {
      if (!s.clampFired) {
        s.clampFired = true;
        s.clampEventPending = true;
        s.trauma = 0.85;
      }
      s.clawOpen = 0.15;
    } else {
      s.clawOpen = 1.0;
    }

    s.camX = s.startCamX;
    s.camY = s.startCamY;
    s.camZ = s.startCamZ;

    const lookAlpha = 1 - Math.exp(-10.5 * dt);
    s.camYaw = lerpAngle(s.camYaw, headYaw, lookAlpha);
    s.camPitch = THREE.MathUtils.lerp(s.camPitch, headPitch, lookAlpha);
    s.camRoll = Math.sin(s.phaseElapsed * 42) * 0.045 * s.trauma;

    if (s.phaseElapsed >= GRAB_INTERCEPT_DURATION) {
      s.phase = "carrying";
      s.phaseElapsed = 0;
      s.carryStartGantryX = s.interceptGantryX;
      s.carryStartGantryY = s.interceptGantryY;
      s.carryStartGantryZ = s.interceptGantryZ;
    }
    return;
  }

  if (s.phase === "carrying") {
    const u = THREE.MathUtils.clamp(
      s.phaseElapsed / GRAB_CARRY_DURATION,
      0,
      1,
    );
    const tCurve = u * u * (3 - 2 * u);
    const inv = 1 - tCurve;
    const b0 = inv * inv * inv;
    const b1 = 3 * inv * inv * tCurve;
    const b2 = 3 * inv * tCurve * tCurve;
    const b3 = tCurve * tCurve * tCurve;

    const bx = b0 * s.p0x + b1 * s.p1x + b2 * s.p2x + b3 * s.p3x;
    const bz = b0 * s.p0z + b1 * s.p1z + b2 * s.p2z + b3 * s.p3z;

    const hoistU = THREE.MathUtils.clamp(u / 0.24, 0, 1);
    const hoistEase = 1 - Math.pow(1 - hoistU, 3);
    const baseY = THREE.MathUtils.lerp(
      s.startCamY,
      GRAB_STANDING_EYE_Y + GRAB_HOIST_DELTA_Y,
      hoistEase,
    );

    const swayEnv = Math.sin(u * Math.PI);
    const swayRoll = Math.sin(s.phaseElapsed * 5.2) * 0.052 * swayEnv;
    const swayY = Math.sin(s.phaseElapsed * 5.2) * 0.024 * swayEnv;
    const swayPitch = Math.cos(s.phaseElapsed * 4.4) * 0.022 * swayEnv;
    const traumaJitter = Math.sin(s.phaseElapsed * 42) * 0.03 * s.trauma;

    s.camX = bx;
    s.camY = baseY + swayY;
    s.camZ = bz;
    s.camRoll = swayRoll + traumaJitter;

    const startOffX = s.carryStartGantryX - s.p0x;
    const startOffZ = s.carryStartGantryZ - s.p0z;
    const endOffX = DESK_GANTRY_DROP_X - SEATED_CHAIR_X;
    const endOffZ = DESK_GANTRY_DROP_Z - SEATED_CHAIR_Z;
    const offX = THREE.MathUtils.lerp(startOffX, endOffX, tCurve);
    const offZ = THREE.MathUtils.lerp(startOffZ, endOffZ, tCurve);

    s.gantryTargetX = THREE.MathUtils.clamp(
      bx + offX,
      GRAB_GANTRY_X_MIN,
      GRAB_GANTRY_X_MAX,
    );
    s.gantryTargetZ = THREE.MathUtils.clamp(
      bz + offZ,
      GRAB_GANTRY_Z_MIN,
      GRAB_GANTRY_Z_MAX,
    );
    s.gantryTargetY = THREE.MathUtils.lerp(
      s.carryStartGantryY,
      2.02,
      hoistEase,
    );

    const rawChairBlend = THREE.MathUtils.clamp(
      (tCurve - 0.55) / 0.45,
      0,
      1,
    );
    const chairBlend = rawChairBlend * rawChairBlend * (3 - 2 * rawChairBlend);
    const desiredYaw = lerpAngle(headYaw, SEATED_CHAIR_YAW, chairBlend);
    const desiredPitch = THREE.MathUtils.lerp(
      headPitch,
      -0.04 + swayPitch,
      chairBlend,
    );
    const lookAlpha = 1 - Math.exp(-11.0 * dt);
    s.camYaw = lerpAngle(s.camYaw, desiredYaw, lookAlpha);
    s.camPitch = THREE.MathUtils.lerp(s.camPitch, desiredPitch, lookAlpha);

    s.clawOpen = 0.15;
    s.armReachBlend = 1.0;

    if (s.phaseElapsed >= GRAB_CARRY_DURATION) {
      s.phase = "dropping";
      s.phaseElapsed = 0;
      s.releaseHissEventPending = true;
      s.clawOpen = 1.0;
    }
    return;
  }

  // phase === "dropping"
  s.camX = SEATED_CHAIR_X;
  s.camZ = SEATED_CHAIR_Z;
  s.gantryTargetX = DESK_GANTRY_DROP_X;
  s.gantryTargetY = 1.92;
  s.gantryTargetZ = DESK_GANTRY_DROP_Z;

  s.clawOpen = 1.0;
  s.armReachBlend = Math.max(0, 1 - s.phaseElapsed / 0.3);

  const hoistTopY = GRAB_STANDING_EYE_Y + GRAB_HOIST_DELTA_Y;
  if (s.phaseElapsed < GRAB_TOUCHDOWN_TIME) {
    const f = s.phaseElapsed / GRAB_TOUCHDOWN_TIME;
    s.camY = THREE.MathUtils.lerp(hoistTopY, SEATED_CHAIR_Y - 0.06, f * f);
  } else {
    if (!s.thudFired) {
      s.thudFired = true;
      s.thudEventPending = true;
      s.trauma = 0.55;
    }
    if (!s.ultimatumFired && s.phaseElapsed >= GRAB_ULTIMATUM_TIME) {
      s.ultimatumFired = true;
      s.ultimatumEventPending = true;
    }
    const bt = s.phaseElapsed - GRAB_TOUCHDOWN_TIME;
    s.camY =
      SEATED_CHAIR_Y - 0.06 * Math.exp(-11 * bt) * Math.cos(bt * 24);
  }

  const settleAlpha = 1 - Math.exp(-13.5 * dt);
  s.camYaw = lerpAngle(s.camYaw, SEATED_CHAIR_YAW, settleAlpha);
  s.camPitch = THREE.MathUtils.lerp(
    s.camPitch,
    SEATED_CHAIR_PITCH,
    settleAlpha,
  );
  s.camRoll = Math.sin(s.phaseElapsed * 38) * 0.025 * s.trauma;

  if (s.phaseElapsed >= GRAB_DROP_DURATION) {
    if (!s.ultimatumFired) {
      s.ultimatumFired = true;
      s.ultimatumEventPending = true;
    }
    s.camX = SEATED_CHAIR_X;
    s.camY = SEATED_CHAIR_Y;
    s.camZ = SEATED_CHAIR_Z;
    s.camYaw = SEATED_CHAIR_YAW;
    s.camPitch = SEATED_CHAIR_PITCH;
    s.camRoll = 0;
    s.phase = "idle";
    s.phaseElapsed = 0;
    s.armReachBlend = 0;
    s.seatedHandoffPending = true;
    s.justFinishedGrab = true;
  }
}
