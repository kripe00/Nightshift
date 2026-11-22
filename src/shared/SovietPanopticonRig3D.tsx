import { useFrame } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
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
import { onKremlinFontReady } from "./kremlinFontReady";
import {
  getBrushedBrassTextures,
  getHammeredIronTextures,
} from "./proceduralMaterials";
import type { KomradMood } from "./types";
import { useGameStore } from "./useGameStore";

const GANTRY_RAIL_Y = 3.88;
const GANTRY_RAIL_HALF_X = 1.45;
const GANTRY_RAIL_Z_MIN = -0.1;
const GANTRY_RAIL_Z_MAX = 1.45;
const GANTRY_BRIDGE_Y = 3.82;
const GANTRY_SHOULDER_OFFSET_Y = -0.06; // Shoulder world Y = 3.76m
const ARM_SEG_LEN = 0.54;

const TURRET_X_MIN = -1.35;
const TURRET_X_MAX = 1.35;
const TURRET_Z_MIN = -0.05;
const TURRET_Z_MAX = 1.38;

const TURRET_PITCH_MIN = -0.82;
const TURRET_PITCH_MAX = -0.16;
const TURRET_SLEW_WHIR_THRESHOLD_RAD = (28 * Math.PI) / 180;

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

// Pre-allocated scratch vectors for zero per-frame allocations inside useFrame
const _camForward = new THREE.Vector3();
const _toCctv = new THREE.Vector3();

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

  const badgeText =
    mood === "critical" ? "ALERT!" : mood === "warning" ? "WATCH" : "OPTIC";
  ctx.fillStyle =
    mood === "critical" && blinkPhase % 2 === 0 ? "#ff4433" : pal.primary;
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
    if (isTalking && voxLoaded && spectrum16) {
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
      amp > 0.72 ? pal.secondary : isTalking ? pal.primary : pal.dim;
    ctx.fillRect(startX + i * (bw + bgap), barBoxY + 31 - barH, bw, barH);
  }

  ctx.fillStyle = isTalking ? pal.secondary : pal.dim;
  ctx.font = 'bold 18px "VT323", monospace';
  ctx.textAlign = "center";
  const statusLabel = isTalking
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

  // Gantry & 3-joint kinematic refs
  const gantryBridgeRef = useRef<THREE.Group>(null);
  const gantryTrolleyRef = useRef<THREE.Group>(null);
  const turretYawRef = useRef<THREE.Group>(null);
  const shoulderPivotRef = useRef<THREE.Group>(null);
  const elbowPivotRef = useRef<THREE.Group>(null);
  const wristGimbalRef = useRef<THREE.Group>(null);

  // Boss head details refs
  const turretCrtMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const turretOpticMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const leftHornRef = useRef<THREE.Group>(null);
  const rightHornRef = useRef<THREE.Group>(null);
  const shutterBladeRefs = useRef<(THREE.Mesh | null)[]>([
    null,
    null,
    null,
    null,
  ]);

  const turretStateRef = useRef({
    curX: 0,
    curZ: 0.35,
    curYaw: 0,
    curPitch: -0.42,
    curRoll: 0,
    curSwoop: 0.35,
    curRecoil: 0,
    curAperture: 0.4,
    rollImpulse: 0,
    shakeAmp: 0,
    lastMood: "normal" as KomradMood,
    lastTreasonStrikes: 0,
    lastControlSig: 0,
    lastControlsInit: false,
    lastDrawSec: -1,
    lastSig: "",
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
    };
  }, [turretCrtTex, radCheekTex]);

  useEffect(() => {
    return onKremlinFontReady(() => {
      turretStateRef.current.lastSig = "";
      turretStateRef.current.lastDrawSec = -1;
    });
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(Math.max(delta, 0), 0.08);
    const s = useGameStore.getState();
    const isBlackout = s.isBlackout && !s.isGodMode;
    const vocal = stepKomradSpeech(t, dt);

    state.camera.getWorldDirection(_camForward);
    const camPos = state.camera.position;

    // 1. Gantry Carriage X/Z Translation + 3-Joint Articulated GLaDOS Boss Rig
    const ts = turretStateRef.current;

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

    const targetX = isBlackout
      ? ts.curX
      : THREE.MathUtils.clamp(camPos.x * 0.42, TURRET_X_MIN, TURRET_X_MAX);
    const targetZ = isBlackout
      ? ts.curZ
      : THREE.MathUtils.clamp(
          camPos.z * 0.35 + 0.35,
          TURRET_Z_MIN,
          TURRET_Z_MAX,
        );

    const lambdaGantry = vocal.mood === "critical" ? 3.8 : 2.8;
    if (!isBlackout) {
      const prevX = ts.curX;
      const prevZ = ts.curZ;
      ts.curX = THREE.MathUtils.damp(ts.curX, targetX, lambdaGantry, dt);
      ts.curZ = THREE.MathUtils.damp(ts.curZ, targetZ, lambdaGantry, dt);
      const travelDelta = Math.hypot(ts.curX - prevX, ts.curZ - prevZ);
      if (travelDelta > 0.012 && Math.hypot(targetX - ts.curX, targetZ - ts.curZ) > 0.45) {
        playTurretServoWhir(0.9);
      }
    }

    if (gantryBridgeRef.current) {
      gantryBridgeRef.current.position.z = ts.curZ;
    }
    if (gantryTrolleyRef.current) {
      gantryTrolleyRef.current.position.x = ts.curX;
    }

    // Smart Sightline Retract vs. Intimidating Lean-In Swoop
    const lookingAtSkala =
      camPos.z > -0.5 &&
      -_camForward.z > 0.65 &&
      Math.abs(_camForward.y) < 0.28 &&
      Math.abs(camPos.x) < 1.65;

    const wantSwoop =
      !isBlackout &&
      !lookingAtSkala &&
      (vocal.isTalking ||
        vocal.mood !== "normal" ||
        s.isSeatedAtDesk ||
        camPos.z > 1.25 ||
        Math.abs(camPos.x) > 1.55 ||
        _camForward.y > 0.28);

    const targetSwoop = isBlackout
      ? 0.08
      : lookingAtSkala
        ? 0.0
        : wantSwoop
          ? vocal.mood === "critical"
            ? 1.0
            : 0.88
          : 0.42;

    const lambdaSwoop = lookingAtSkala ? 4.2 : 3.0;
    ts.curSwoop = THREE.MathUtils.damp(ts.curSwoop, targetSwoop, lambdaSwoop, dt);

    // 2-segment forward kinematics from retracted (wristY=3.61, z=+0.02) -> swooped (wristY=2.79, z=+0.25)
    const breathe = isBlackout ? 0 : Math.sin(t * 1.3);
    const theta1 =
      THREE.MathUtils.lerp(1.3, 0.14, ts.curSwoop) + breathe * 0.032;
    const thetaForearm =
      THREE.MathUtils.lerp(-1.52, -0.66, ts.curSwoop) - breathe * 0.042;
    const wristWorldY =
      GANTRY_BRIDGE_Y +
      GANTRY_SHOULDER_OFFSET_Y -
      ARM_SEG_LEN * Math.cos(theta1) -
      ARM_SEG_LEN * Math.cos(thetaForearm);

    const tdx = camPos.x - ts.curX;
    const tdy = camPos.y - wristWorldY;
    const tdz = camPos.z - ts.curZ;
    const tHoriz = Math.max(0.001, Math.hypot(tdx, tdz));
    const liveYaw = Math.atan2(tdx, tdz);
    const livePitch = THREE.MathUtils.clamp(
      Math.atan2(tdy, tHoriz),
      TURRET_PITCH_MIN,
      lookingAtSkala ? -0.22 : TURRET_PITCH_MAX,
    );

    const desiredYaw = isBlackout
      ? ts.curYaw
      : liveYaw + (!vocal.isTalking && vocal.mood === "normal" ? Math.sin(t * 0.42) * 0.035 : 0);
    const yawErr = wrapAngleRad(desiredYaw - ts.curYaw);
    if (!isBlackout && Math.abs(yawErr) > TURRET_SLEW_WHIR_THRESHOLD_RAD) {
      playTurretServoWhir(Math.abs(yawErr));
    }

    const lambdaYaw = isBlackout ? 2.8 : vocal.mood === "critical" ? 4.2 : 3.2;
    if (!isBlackout) {
      ts.curYaw = wrapAngleRad(
        THREE.MathUtils.damp(ts.curYaw, ts.curYaw + yawErr, lambdaYaw, dt),
      );
    }

    const desiredPitch = isBlackout ? TURRET_PITCH_MIN : livePitch;
    const lambdaPitch = isBlackout ? 2.8 : vocal.mood === "critical" ? 4.0 : 3.1;
    ts.curPitch = THREE.MathUtils.clamp(
      THREE.MathUtils.damp(ts.curPitch, desiredPitch, lambdaPitch, dt),
      TURRET_PITCH_MIN,
      TURRET_PITCH_MAX,
    );

    ts.rollImpulse = THREE.MathUtils.damp(ts.rollImpulse, 0, 2.8, dt);
    const desiredRoll = isBlackout
      ? -0.14
      : Math.sin(t * 0.55) * 0.045 -
        THREE.MathUtils.clamp(yawErr * 0.2, -0.13, 0.13) +
        (vocal.isTalking && vocal.clauseTerminator === "?" ? 0.16 : 0) +
        ts.rollImpulse;
    ts.curRoll = THREE.MathUtils.damp(ts.curRoll, desiredRoll, 3.0, dt);

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
      wristGimbalRef.current.rotation.z = ts.curRoll + shakeWave;
    }

    // PA Horn speech vibration pulse
    const hornPulse =
      !isBlackout && vocal.isTalking
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

    const targetAperture = isBlackout
      ? 0.08
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
    if (t - ts.lastDrawSec >= 0.1) {
      const blinkBucket = vocal.isTalking
        ? Math.floor(t * 10)
        : Math.floor(t * 1.5);
      const pose: KomradPortraitPose = vocal.isTalking
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
        vocal.isTalking && vocal.voxLoaded
          ? `${Math.round(vocal.spectrum16[0] / 28)}-${Math.round(vocal.spectrum16[5] / 28)}-${Math.round(vocal.spectrum16[10] / 28)}-${Math.round(vocal.spectrum16[15] / 28)}`
          : "";
      const sig = `${isBlackout}|${vocal.mood}|${pose}|${vocal.isTalking}|${energyQ}|${vocal.activeVowel ?? ""}|${vocal.rolledR}|${vocal.activeWord ?? ""}|${vocal.voxLoaded ? 1 : 0}|${specSig}|${
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
          );
          tex.needsUpdate = true;
        }
      }
    }

    // 2. Four Corner KGB-TV-84 Pan-Tilt Surveillance Cameras
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

          {/* Vertical Ceiling Hanger Struts (z = +0.25, +0.85, +1.42; clear of z=0 ceiling beam) */}
          {([-0.42, 0.18, 0.72] as const).map((lz, hIdx) => (
            <mesh
              key={`rail-hanger-${side}-${hIdx}`}
              position={[0, 0.18, lz]}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.048, 0.29, 0.064]} />
              <meshStandardMaterial color="#1b2320" metalness={0.7} roughness={0.44} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Cross-Tie Stiffener Bars (clear of z=-0.25 klaxon and z=0 transverse beam) */}
      {[0.22, GANTRY_RAIL_Z_MAX].map((cz, cIdx) => (
        <mesh
          key={`gantry-tie-${cIdx}`}
          position={[0, GANTRY_RAIL_Y + 0.05, cz]}
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
      <group ref={gantryBridgeRef} position={[0, GANTRY_BRIDGE_Y, 0.35]}>
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
        <group ref={gantryTrolleyRef} position={[0, 0, 0]}>
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

          {/* ============================================================
              3. 3-JOINT ARTICULATED GLaDOS SPINE (YAW -> SHOULDER -> ELBOW -> WRIST)
             ============================================================ */}
          <group ref={turretYawRef} position={[0, GANTRY_SHOULDER_OFFSET_Y, 0]}>
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
