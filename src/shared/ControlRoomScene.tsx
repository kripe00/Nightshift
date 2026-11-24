import { useGLTF } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import * as InspectorModule from "../modules/inspector";
import { updateTurbinePitchHum } from "../modules/inspector/audio";
import {
  getAudioContext,
  playLeverRatchet,
  playSwitchClank,
} from "../modules/reactor/audioSynth";
import { BuckshotDitherPass } from "./BuckshotDitherPass";
import { CameraController, useCameraLookStore } from "./CameraController";
import { CentralSkalaScreen3D } from "./CentralSkalaScreen3D";
import { ExteriorDioramas3D, NOOP_RAYCAST } from "./ExteriorDioramas3D";
import { ExteriorFireEscapeWing3D } from "./ExteriorFireEscapeWing3D";
import { McrLobbyRoom3D } from "./McrLobbyRoom3D";
import {
  AIRLOCK_CLOSE_RADIUS,
  AIRLOCK_DOOR_CENTER_X,
  AIRLOCK_DOOR_CENTER_Z,
  AIRLOCK_ENTRY_THRESHOLD_Z,
  AIRLOCK_MENU_UNLOCK_DELAY_SEC,
  AIRLOCK_OPEN_RADIUS,
  airlockDoorState,
  playAirlockEndStop,
  playAirlockPneumaticSlide,
  playAirlockWheelSpin,
} from "./airlockDoorState";
import { playerCameraPose } from "./pointerLockState";
import {
  getKomradVowelBand,
  stepKomradSpeech,
  type KomradVowelKey,
} from "./komradVoiceSynth";
import {
  notifyPlayerControlInteraction,
  registerKomradControlObject,
} from "./komradArmController";
import { SovietPanopticonRig3D } from "./SovietPanopticonRig3D";
import { SovietRadioTable3D } from "./SovietRadioTable3D";
import { UnitCBatteryStorageDeck3D } from "./UnitCBatteryStorageDeck3D";
import {
  CagedSovietJewelLamp3D,
  HighDetailManometer3D,
  HighDetailReactorPanel3D,
  LeftRearWrapAroundPanel3D,
  type MimicNodeSpec,
  type MimicSegmentSpec,
  makePlaqueTex,
  SovietCRTMonitorBay3D,
  SovietModularSteelCabinet3D,
} from "./MechanicalPanels3D";

const TERMINAL_ROOT_POS: [number, number, number] = [0, 0.18, -3.96];
const TERMINAL_TILT_X = 0.122;
const TERMINAL_SCALE = 1.42;
const HALL_HALF_W = 6.0;
const HALL_HALF_D = 4.5;
const HALL_CEILING_Y = 4.2;
import {
  applySovietPBRToHierarchy,
  getBrushedBrassTextures,
  getHammeredIronTextures,
} from "./proceduralMaterials";
import {
  onKremlinFontReady,
  registerKremlinCanvasRedraw,
} from "./kremlinFontReady";
import type { KomradMessageEntry, KomradMood } from "./types";
import { useGameStore } from "./useGameStore";

const ExternalInspectorDesk3D = Reflect.get(
  InspectorModule,
  "InspectorDesk3D",
) as React.ComponentType | undefined;

function createCrispPanelTexture(
  width: number,
  height: number,
  draw?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    draw?.(ctx, width, height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.anisotropy = 1;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  if (draw) {
    registerKremlinCanvasRedraw(canvas, tex, (c, w, h) => {
      c.imageSmoothingEnabled = true;
      draw(c, w, h);
    });
  }
  return tex;
}

const SCENE_COLOR_BLACK = new THREE.Color("#000000");
const SCENE_COLOR_RED = new THREE.Color("#ff2a2a");
const SCENE_COLOR_GREEN = new THREE.Color("#33ff66");
const SCENE_COLOR_AMBER = new THREE.Color("#ffb000");
const SCENE_COLOR_CLOCK_BLACKOUT = new THREE.Color("#2a1212");
const SCENE_COLOR_CLOCK_NORM = new THREE.Color("#ff3b24");
const SCENE_COLOR_LAMP_DARK = new THREE.Color("#1c2621");
const SCENE_COLOR_SCONCE_BLACKOUT = new THREE.Color("#221210");
const SCENE_COLOR_SCONCE_BLACKOUT_EMISSIVE = new THREE.Color("#3a0b06");
const SCENE_COLOR_SCONCE_NORM = new THREE.Color("#ffba52");
const SCENE_COLOR_SCONCE_NORM_EMISSIVE = new THREE.Color("#ff9922");
const SCENE_COLOR_MAIN_LIGHT_NORM = new THREE.Color("#ffe2ba");
const SCENE_COLOR_MAIN_LIGHT_BLACKOUT = new THREE.Color("#222422");
const SCENE_COLOR_TUBE_BLACKOUT = new THREE.Color("#1a1816");
const SCENE_COLOR_TUBE_NORM = new THREE.Color("#fff1d6");
const SCENE_COLOR_TUBE_DIM_BLACKOUT = new THREE.Color("#14100d");
const SCENE_COLOR_TUBE_DIM = new THREE.Color("#e2a24c");
const SCENE_COLOR_TUBE_OFF = new THREE.Color("#242926");
const SCENE_COLOR_TUBE_LIT_ALBEDO = new THREE.Color("#fff6e5");
const SCENE_COLOR_SCONCE_OFF = new THREE.Color("#1c201e");
const SCENE_COLOR_BULB_OFF = new THREE.Color("#1a1d1b");
const SCENE_COLOR_BULB_NORM = new THREE.Color("#ffcf75");
const SCENE_COLOR_CRT_STANDBY_TINT = new THREE.Color("#324a3a");
const SCENE_COLOR_WHITE = new THREE.Color("#ffffff");

const MIN_STANDBY_LIGHT_INTENSITY = 0.0002;

export const controlRoomPowerState = { // oxlint-disable-line react/only-export-components
  active: false,
  elapsed: 0,
  zone1: 0, // t = 0.00s (Entry / Desk Side, z = +1.80)
  zone2: 0, // t = 0.35s (Central Gantry & K.O.M.R.A.D.-84, z = -0.85)
  zone3: 0, // t = 0.70s (Front Reactor Wall UNIT A / A-2 / SKALA-84, z = -2.85)
  stage1Fired: false,
  stage2Fired: false,
  stage3Fired: false,
};

function computeFluorescentStarterCurve(localElapsed: number): number {
  if (localElapsed < 0) return 0;
  if (localElapsed < 0.045) return 0.92;
  if (localElapsed < 0.085) return 0.18;
  if (localElapsed < 0.135) return 0.86;
  if (localElapsed < 0.165) return 0.34;
  if (localElapsed < 0.25) {
    const u = (localElapsed - 0.165) / 0.085;
    return 0.62 + 0.38 * (u * u * (3 - 2 * u));
  }
  return 1;
}

function playControlRoomContactorClunk(stage: 0 | 1 | 2): void {
  if (useGameStore.getState().isMusicMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;

  // 1. Heavy cabinet solenoid thump
  const thumpOsc = ctx.createOscillator();
  const thumpGain = ctx.createGain();
  thumpOsc.type = stage === 2 ? "sine" : "triangle";
  thumpOsc.frequency.setValueAtTime(128 - stage * 11, now);
  thumpOsc.frequency.exponentialRampToValueAtTime(36, now + 0.095);
  thumpGain.gain.setValueAtTime(0.001, now);
  thumpGain.gain.linearRampToValueAtTime(0.26, now + 0.006);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
  thumpOsc.connect(thumpGain);
  thumpGain.connect(ctx.destination);
  thumpOsc.start(now);
  thumpOsc.stop(now + 0.14);

  // 2. Crisp spring-contact snap + metallic relay ping
  const snapBufSize = Math.max(1, Math.floor(ctx.sampleRate * 0.04));
  const snapBuf = ctx.createBuffer(1, snapBufSize, ctx.sampleRate);
  const snapData = snapBuf.getChannelData(0);
  for (let i = 0; i < snapBufSize; i++) {
    snapData[i] = (Math.random() * 2 - 1) * Math.exp((-i / snapBufSize) * 6);
  }
  const snapSrc = ctx.createBufferSource();
  snapSrc.buffer = snapBuf;
  const snapFilter = ctx.createBiquadFilter();
  snapFilter.type = "bandpass";
  snapFilter.frequency.setValueAtTime(960 + stage * 140, now);
  snapFilter.Q.setValueAtTime(2.8, now);
  const snapGain = ctx.createGain();
  snapGain.gain.setValueAtTime(0.18, now);
  snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  snapSrc.connect(snapFilter);
  snapFilter.connect(snapGain);
  snapGain.connect(ctx.destination);
  snapSrc.start(now);
  snapSrc.stop(now + 0.045);

  const pingOsc = ctx.createOscillator();
  const pingGain = ctx.createGain();
  pingOsc.type = "sine";
  pingOsc.frequency.setValueAtTime(1850 - stage * 120, now);
  pingGain.gain.setValueAtTime(0.055, now);
  pingGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.045);
  pingOsc.connect(pingGain);
  pingGain.connect(ctx.destination);
  pingOsc.start(now);
  pingOsc.stop(now + 0.05);

  // 3. Fluorescent starter arc double-tick (+0.015s & +0.095s)
  const arcBufSize = Math.max(1, Math.floor(ctx.sampleRate * 0.018));
  const arcBuf = ctx.createBuffer(1, arcBufSize, ctx.sampleRate);
  const arcData = arcBuf.getChannelData(0);
  for (let i = 0; i < arcBufSize; i++) {
    arcData[i] = (Math.random() * 2 - 1) * Math.exp((-i / arcBufSize) * 5);
  }
  for (const offset of [0.015, 0.095]) {
    const arcSrc = ctx.createBufferSource();
    arcSrc.buffer = arcBuf;
    const arcFilter = ctx.createBiquadFilter();
    arcFilter.type = "highpass";
    arcFilter.frequency.setValueAtTime(3200, now + offset);
    const arcGain = ctx.createGain();
    arcGain.gain.setValueAtTime(0.06, now + offset);
    arcGain.gain.exponentialRampToValueAtTime(0.0005, now + offset + 0.018);
    arcSrc.connect(arcFilter);
    arcFilter.connect(arcGain);
    arcGain.connect(ctx.destination);
    arcSrc.start(now + offset);
    arcSrc.stop(now + offset + 0.02);
  }

  // 4. 50Hz + 100Hz magnetic fluorescent ballast warm-up hum
  const hum50 = ctx.createOscillator();
  const hum100 = ctx.createOscillator();
  hum50.type = "sawtooth";
  hum50.frequency.setValueAtTime(50, now);
  hum100.type = "triangle";
  hum100.frequency.setValueAtTime(100, now);
  const humFilter = ctx.createBiquadFilter();
  humFilter.type = "lowpass";
  humFilter.frequency.setValueAtTime(260, now);
  const humGain = ctx.createGain();
  humGain.gain.setValueAtTime(0.0001, now);
  humGain.gain.linearRampToValueAtTime(0.042, now + 0.12);
  humGain.gain.linearRampToValueAtTime(0.014, now + 0.65);
  humGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);
  hum50.connect(humFilter);
  hum100.connect(humFilter);
  humFilter.connect(humGain);
  humGain.connect(ctx.destination);
  hum50.start(now);
  hum100.start(now);
  hum50.stop(now + 1.5);
  hum100.stop(now + 1.5);
}

interface UnitCMasterDashboardData {
  energyCreatedMW: number;
  batteryStoredMWh: number;
  batteryStoredPct: number;
  dispatchedMW: number;
  energyDemandMW: number;
  wheelPct: number;
  steamBar: number;
  reactivity: number;
  rodsPct: number;
  xenonPct: number;
  xenonBurningOff: boolean;
  voidPct: number;
  tutorialPhase: string;
  isBlackout: boolean;
}

function paintUnitCMasterDashboardCRT(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  d: UnitCMasterDashboardData,
): void {
  ctx.fillStyle = "#040d07";
  ctx.fillRect(0, 0, w, h);

  if (d.isBlackout) {
    ctx.strokeStyle = "#551414";
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = "#ff3a3a";
    ctx.font = 'bold 34px "Kremlin", "VT323", monospace';
    ctx.textAlign = "center";
    ctx.fillText(
      "STATION BLACKOUT // RECHARGE BATTERY BANK & RAISE RODS",
      w / 2,
      h / 2 + 10,
    );
    return;
  }

  ctx.fillStyle = "rgba(51, 255, 102, 0.025)";
  for (let sy = 0; sy < h; sy += 4) {
    ctx.fillRect(0, sy, w, 1);
  }

  ctx.strokeStyle = "#22663a";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(3, 3, w - 6, h - 6);

  const isStartup = d.tutorialPhase !== "COMPLETED";
  const netChargeMW = Math.round(d.energyCreatedMW - d.dispatchedMW);
  const deltaDemand = Math.round(d.dispatchedMW - d.energyDemandMW);
  const absDelta = Math.abs(deltaDemand);
  const balanceColor = isStartup
    ? absDelta <= 30
      ? "#33ff66"
      : "#ffb000"
    : absDelta <= 30
      ? "#33ff66"
      : absDelta <= 85
        ? "#ffb000"
        : "#ff3b3b";
  const batColor =
    d.batteryStoredPct < 8
      ? "#ff3b3b"
      : d.batteryStoredPct < 20
        ? "#ffb000"
        : "#33ff66";

  // 3 SPACIOUS COLUMNS (y = 10..158, h = 148): ENERGY CREATED | ENERGY STORED | ENERGY DEMAND
  const colY = 10;
  const colH = 148;
  const col1W = 324;
  const col2W = 336;
  const col3W = 324;
  const createdRatio = THREE.MathUtils.clamp(d.energyCreatedMW / 1000, 0.02, 1);
  const storedRatio = THREE.MathUtils.clamp(d.batteryStoredPct / 100, 0.02, 1);
  const dispatchRatio = THREE.MathUtils.clamp(d.dispatchedMW / 1000, 0.02, 1);
  const demandRatio = THREE.MathUtils.clamp(d.energyDemandMW / 1000, 0.02, 1);

  // Column 1: TOTAL ENERGY CREATED
  ctx.fillStyle = "rgba(10, 34, 20, 0.88)";
  ctx.fillRect(10, colY, col1W, colH);
  ctx.strokeStyle = d.energyCreatedMW >= 200 ? "#2ebd59" : "#aa7a18";
  ctx.lineWidth = 2;
  ctx.strokeRect(10, colY, col1W, colH);

  ctx.textAlign = "left";
  ctx.fillStyle = "#8ce6a8";
  ctx.font = 'bold 18px "Kremlin", monospace';
  ctx.fillText("ENERGY CREATED", 22, colY + 25);

  ctx.textAlign = "right";
  ctx.fillStyle = "#a6d8b5";
  ctx.font = 'bold 18px "VT323", monospace';
  ctx.fillText("REACTOR GEN", 10 + col1W - 12, colY + 25);

  ctx.textAlign = "left";
  ctx.fillStyle = d.energyCreatedMW > 960 ? "#ff3b3b" : "#33ff66";
  ctx.font = 'bold 56px "VT323", monospace';
  ctx.fillText(`${Math.round(d.energyCreatedMW)} MW`, 22, colY + 82);

  ctx.fillStyle = d.steamBar >= 79 ? "#ff3b3b" : "#a6d8b5";
  ctx.font = 'bold 20px "VT323", monospace';
  ctx.fillText(
    `STEAM ${Math.round(d.steamBar)} BAR  •  RODS ${d.rodsPct}%`,
    22,
    colY + 111,
  );

  ctx.fillStyle = "#0b2013";
  ctx.fillRect(22, colY + 123, col1W - 24, 14);
  ctx.fillStyle = d.energyCreatedMW > 960 ? "#ff3b3b" : "#33ff66";
  ctx.fillRect(22, colY + 123, Math.round((col1W - 24) * createdRatio), 14);

  // Column 2: ENERGY STORED (ACCUMULATOR BANKS A & B)
  const col2X = 344;
  ctx.fillStyle = "rgba(10, 34, 20, 0.88)";
  ctx.fillRect(col2X, colY, col2W, colH);
  ctx.strokeStyle = batColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(col2X, colY, col2W, colH);

  ctx.textAlign = "left";
  ctx.fillStyle = "#8ce6a8";
  ctx.font = 'bold 18px "Kremlin", monospace';
  ctx.fillText("ENERGY STORED", col2X + 12, colY + 25);

  ctx.textAlign = "right";
  ctx.fillStyle = netChargeMW >= 0 ? "#33ff66" : "#ffb000";
  ctx.font = 'bold 20px "VT323", monospace';
  ctx.fillText(
    `${netChargeMW >= 0 ? "+" : ""}${netChargeMW} MW NET`,
    col2X + col2W - 12,
    colY + 25,
  );

  ctx.textAlign = "left";
  ctx.fillStyle = batColor;
  ctx.font = 'bold 56px "VT323", monospace';
  ctx.fillText(`${Math.round(d.batteryStoredPct)}%`, col2X + 12, colY + 82);

  ctx.textAlign = "right";
  ctx.fillStyle = "#d9e8dc";
  ctx.font = 'bold 28px "VT323", monospace';
  ctx.fillText(
    `${Math.round(d.batteryStoredMWh)} MWh`,
    col2X + col2W - 12,
    colY + 80,
  );

  ctx.textAlign = "left";
  ctx.fillStyle = batColor;
  ctx.font = 'bold 20px "VT323", monospace';
  ctx.fillText(
    d.batteryStoredPct >= 88
      ? "BANKS A & B AT HIGH CHARGE"
      : netChargeMW >= 0
        ? "CHARGING ACCUMULATOR BANKS"
        : "DISCHARGING TO REGIONAL GRID",
    col2X + 12,
    colY + 111,
  );

  ctx.fillStyle = "#0b2013";
  ctx.fillRect(col2X + 12, colY + 123, col2W - 24, 14);
  ctx.fillStyle = batColor;
  ctx.fillRect(col2X + 12, colY + 123, Math.round((col2W - 24) * storedRatio), 14);

  // Column 3: ENERGY DEMAND / BATTERY DISPATCH
  const col3X = 690;
  ctx.fillStyle = "rgba(10, 34, 20, 0.88)";
  ctx.fillRect(col3X, colY, col3W, colH);
  ctx.strokeStyle = balanceColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(col3X, colY, col3W, colH);

  ctx.textAlign = "left";
  ctx.fillStyle = "#8ce6a8";
  ctx.font = 'bold 18px "Kremlin", monospace';
  ctx.fillText("ENERGY DEMAND", col3X + 12, colY + 25);

  ctx.textAlign = "right";
  ctx.fillStyle = "#ffb000";
  ctx.font = 'bold 20px "VT323", monospace';
  ctx.fillText(`AUTO ${d.wheelPct}%`, col3X + col3W - 12, colY + 25);

  ctx.textAlign = "left";
  ctx.fillStyle = balanceColor;
  ctx.font = 'bold 48px "VT323", monospace';
  ctx.fillText(
    `${Math.round(d.dispatchedMW)} / ${Math.round(d.energyDemandMW)} MW`,
    col3X + 12,
    colY + 81,
  );

  ctx.fillStyle = balanceColor;
  ctx.font = 'bold 20px "VT323", monospace';
  const deltaText =
    absDelta <= 30
      ? "GRID LOAD MATCHED"
      : deltaDemand < 0
        ? `SHORTFALL: ${deltaDemand} MW`
        : `OVER-DISPATCH: +${deltaDemand} MW`;
  ctx.fillText(deltaText, col3X + 12, colY + 111);

  const barX = col3X + 12;
  const barW = col3W - 24;
  ctx.fillStyle = "#0b2013";
  ctx.fillRect(barX, colY + 123, barW, 14);
  ctx.fillStyle = balanceColor;
  ctx.fillRect(barX, colY + 123, Math.round(barW * dispatchRatio), 14);
  const targetMarkerX = barX + Math.round(barW * demandRatio);
  ctx.fillStyle = "#ff3b3b";
  ctx.fillRect(targetMarkerX - 2, colY + 119, 4, 22);

  // BOTTOM 1-LINE PLAIN-ENGLISH BATTERY ADVISOR
  let advisorText =
    "> BATTERY STORAGE ONLINE — GRID DISPATCH MATCHES ENERGY DEMAND";
  let advisorCol = "#33ff66";

  if (d.batteryStoredPct < 10) {
    advisorText =
      "> BATTERY CHARGE CRITICAL (<10%): WITHDRAW RODS [A-2] & MATCH FEEDWATER [B] TO RECHARGE";
    advisorCol = "#ff3b3b";
  } else if (deltaDemand < -30) {
    advisorText = `> DEMAND SHORTFALL: RAISE [A-2] RODS SO UNIT C CAN AUTO-SUPPLY ${Math.round(d.energyDemandMW)} MW`;
    advisorCol = !isStartup && absDelta > 90 ? "#ff4d4d" : "#ffb000";
  } else if (deltaDemand > 35) {
    advisorText = `> +${deltaDemand} MW OVER-DISPATCH: LOWER [A] SECTOR LEVERS TO SAVE BATTERY CHARGE`;
    advisorCol = !isStartup && deltaDemand > 90 ? "#ff4d4d" : "#ffb000";
  } else if (d.steamBar >= 79) {
    advisorText = `> STEAM PRESSURE HIGH (${Math.round(d.steamBar)} BAR): INSERT [RODS] SLIGHTLY OR OPEN [STEAM DUMP]`;
    advisorCol = "#ff3b3b";
  } else if (d.voidPct >= 38) {
    advisorText =
      "> STEAM VOIDS HIGH: RAISE [FEEDWATER] ON UNIT B OR TRIM [RODS] ON UNIT A-2";
    advisorCol = "#ffb000";
  }

  ctx.fillStyle = "rgba(10, 32, 18, 0.95)";
  ctx.fillRect(10, 165, w - 20, 34);
  ctx.strokeStyle = advisorCol;
  ctx.lineWidth = 1.8;
  ctx.strokeRect(10, 165, w - 20, 34);

  ctx.textAlign = "left";
  ctx.fillStyle = advisorCol;
  ctx.font = 'bold 24px "VT323", monospace';
  ctx.fillText(advisorText, 20, 190, w - 40);
}

function createNearestCanvasTexture(
  width: number,
  height: number,
  draw?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    draw?.(ctx, width, height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  if (draw) {
    registerKremlinCanvasRedraw(canvas, texture, (drawCtx, w, h) => {
      drawCtx.imageSmoothingEnabled = false;
      draw(drawCtx, w, h);
    });
  }
  return texture;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * 100% Pure 3D Inspector Desk Placeholder (Used until Komrad Oleg merges <InspectorDesk3D /> from src/modules/inspector)
 */
const InspectorDesk3DPlaceholder: React.FC = () => {
  const [uvLensActive, setUvLensActive] = useState(false);
  const [manualPage, setManualPage] = useState(0);

  const uvGlassGroupRef = useRef<THREE.Group>(null);
  const approveStampRef = useRef<THREE.Group>(null);
  const shredStampRef = useRef<THREE.Group>(null);
  const paperMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const manualMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const stampAnimRef = useRef<{
    type: "APPROVED" | "SHREDDED" | null;
    progress: number;
  }>({ type: null, progress: 0 });

  const paperTexture = useMemo(() => createNearestCanvasTexture(384, 480), []);
  const manualTexture = useMemo(() => createNearestCanvasTexture(320, 400), []);
  const printerPlateTex = useMemo(
    () =>
      createNearestCanvasTexture(256, 64, (ctx, w, h) => {
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#364940";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 20px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("PRAVDA-84 TELETYPE", w / 2, 28);
        ctx.fillStyle = "#e6dec3";
        ctx.font = '18px "VT323", monospace';
        ctx.fillText("[CLICK PRINTER TO FEED PAPER]", w / 2, 52);
      }),
    [],
  );

  const approveStampTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 40, (ctx, w, h) => {
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#33ff66";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#33ff66";
        ctx.font = 'bold 16px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("APPROVE", w / 2, 26);
      }),
    [],
  );

  const shredStampTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 40, (ctx, w, h) => {
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#ff2a2a";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#ff2a2a";
        ctx.font = 'bold 16px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("SHRED", w / 2, 26);
      }),
    [],
  );

  const targetUvPosRef = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const state = useGameStore.getState();
    const currentDoc =
      state.activeDirectives[state.activeDirectives.length - 1] ?? null;

    // 1. Animate 3D UV Magnifying Glass position above the 3D paper mesh (no per-frame allocation)
    if (uvGlassGroupRef.current) {
      if (uvLensActive) {
        targetUvPosRef.current.set(0.06, 1.03, 0.08);
      } else {
        targetUvPosRef.current.set(0.52, 0.94, -0.18);
      }
      uvGlassGroupRef.current.position.lerp(targetUvPosRef.current, 0.22);
    }

    // 2. Animate physical 3D Rubber Stamps plunging onto the 3D paper
    if (stampAnimRef.current.type) {
      stampAnimRef.current.progress += delta * 4.5;
      const p = stampAnimRef.current.progress;
      const plunge = Math.sin(Math.min(Math.PI, p * Math.PI));
      if (stampAnimRef.current.type === "APPROVED" && approveStampRef.current) {
        approveStampRef.current.position.set(0.06, 0.98 - plunge * 0.04, 0.08);
      }
      if (stampAnimRef.current.type === "SHREDDED" && shredStampRef.current) {
        shredStampRef.current.position.set(0.06, 0.98 - plunge * 0.04, 0.08);
      }
      if (p >= 1) {
        const decision = stampAnimRef.current.type;
        stampAnimRef.current = { type: null, progress: 0 };
        if (approveStampRef.current) {
          approveStampRef.current.position.set(0.49, 0.93, 0.06);
        }
        if (shredStampRef.current) {
          shredStampRef.current.position.set(0.49, 0.93, 0.26);
        }
        if (currentDoc) {
          state.resolveDirective(currentDoc.id, decision);
        }
      }
    }

    // 3. Redraw 3D Tractor-Feed Paper Directive CanvasTexture ONLY when directive or UV lens changes
    const paperSig = `${currentDoc?.id ?? "NONE"}|${uvLensActive}|${state.activeDirectives.length}`;
    const pTex = paperMatRef.current?.map as THREE.CanvasTexture | undefined;
    if (pTex && pTex.userData.lastSig !== paperSig) {
      pTex.userData.lastSig = paperSig;
      const pCanvas = pTex.image as HTMLCanvasElement;
      const ctx = pCanvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#e6dec3";
        ctx.fillRect(0, 0, 384, 480);

        ctx.fillStyle = "#141414";
        for (let y = 16; y < 468; y += 28) {
          ctx.fillRect(10, y, 8, 8);
          ctx.fillRect(366, y, 8, 8);
        }

        ctx.strokeStyle = "#141414";
        ctx.lineWidth = 3;
        ctx.strokeRect(26, 14, 332, 452);

        if (currentDoc) {
          ctx.fillStyle = "#141414";
          ctx.font = 'bold 15px "Courier Prime", monospace';
          ctx.textAlign = "left";
          ctx.fillText(currentDoc.ministry.slice(0, 32), 36, 42);
          ctx.fillText(`DATE: ${currentDoc.date}`, 36, 64);
          ctx.fillText(`AUTH: ${currentDoc.authCode}`, 196, 64);

          ctx.beginPath();
          ctx.moveTo(34, 74);
          ctx.lineTo(350, 74);
          ctx.stroke();

          ctx.font = 'bold 17px "Courier Prime", monospace';
          const titleLines = wrapText(ctx, currentDoc.title, 304);
          let y = 98;
          for (const line of titleLines) {
            ctx.fillText(line, 36, y);
            y += 20;
          }

          ctx.font = 'bold 15px "Courier Prime", monospace';
          const bodyLines = wrapText(ctx, currentDoc.bodyText, 304);
          y += 8;
          for (const line of bodyLines) {
            ctx.fillText(line, 36, y);
            y += 20;
          }

          const inkHex =
            currentDoc.inkColor === "IMPERIALIST_BLUE" ||
            currentDoc.inkColor === "blue"
              ? "#1c4da8"
              : currentDoc.inkColor === "BUREAU_VIOLET" ||
                  currentDoc.inkColor === "purple"
                ? "#5b287a"
                : "#c81919";
          ctx.strokeStyle = inkHex;
          ctx.fillStyle = inkHex;
          ctx.lineWidth = 3;
          ctx.strokeRect(42, 260, 296, 54);
          ctx.font = 'bold 15px "Courier Prime", monospace';
          ctx.fillText(`SEAL: ${currentDoc.stampType}`, 52, 284);
          ctx.fillText(`INK:  ${currentDoc.inkColor}`, 52, 304);

          if (uvLensActive) {
            ctx.fillStyle = "rgba(110, 40, 220, 0.18)";
            ctx.fillRect(34, 326, 316, 74);
            ctx.strokeStyle = "#6e28dc";
            ctx.strokeRect(34, 326, 316, 74);
            ctx.fillStyle = "#4b1599";
            ctx.font = 'bold 15px "Courier Prime", monospace';
            ctx.fillText("UV LENS WATERMARK DETECTED:", 44, 350);
            const wmLines = wrapText(ctx, currentDoc.watermarkText, 296);
            ctx.fillText(wmLines[0] ?? "", 44, 372);
            if (wmLines[1]) ctx.fillText(wmLines[1], 44, 390);
          } else {
            ctx.fillStyle = "#3b352a";
            ctx.font = 'bold 14px "Courier Prime", monospace';
            ctx.fillText(
              "[CLICK 3D UV MAGNIFIER TO INSPECT WATERMARK]",
              38,
              365,
            );
          }

          ctx.fillStyle = "#141414";
          ctx.font = 'bold 15px "VT323", monospace';
          ctx.fillText(
            `QUEUE: ${state.activeDirectives.length} DOCS | CLICK APPROVE OR SHRED STAMP`,
            38,
            446,
          );
        } else {
          ctx.fillStyle = "#141414";
          ctx.font = 'bold 24px "VT323", monospace';
          ctx.textAlign = "center";
          ctx.fillText("DESK CLEAR", 192, 210);
          ctx.fillText("CLICK 3D PRINTER TO FEED DIRECTIVE", 192, 260);
        }

        pTex.needsUpdate = true;
      }
    }

    // 4. Redraw 3D KGB Security Manual '84 CanvasTexture
    const manualSig = `${manualPage}|${state.shiftNumber}`;
    const mTex = manualMatRef.current?.map as THREE.CanvasTexture | undefined;
    if (mTex && mTex.userData.lastSig !== manualSig) {
      mTex.userData.lastSig = manualSig;
      const mCanvas = mTex.image as HTMLCanvasElement;
      const ctx = mCanvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#6b1d18";
        ctx.fillRect(0, 0, 320, 400);
        ctx.fillStyle = "#e6dec3";
        ctx.fillRect(14, 14, 292, 372);
        ctx.strokeStyle = "#141414";
        ctx.lineWidth = 3;
        ctx.strokeRect(20, 20, 280, 360);

        ctx.fillStyle = "#8b1e1e";
        ctx.font = 'bold 18px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("KGB SECURITY MANUAL 1984", 160, 48);

        ctx.fillStyle = "#141414";
        ctx.font = 'bold 14px "Courier Prime", monospace';
        ctx.textAlign = "left";

        if (manualPage === 0) {
          ctx.fillText("PAGE 1 // VERIFICATION RULES:", 30, 82);
          ctx.font = 'bold 14px "Courier Prime", monospace';
          ctx.fillText("1. DATE FORMAT:", 30, 112);
          ctx.fillText("   MUST BE DD.MM.1984", 30, 132);
          ctx.fillText("   (SHRED US MM/DD OR 1983!)", 30, 150);
          ctx.fillText("2. AUTH CIPHER:", 30, 182);
          ctx.fillText("   CCCP-84-[EVEN NUMBER]", 30, 202);
          ctx.fillText("   (SHRED ODD NUMBERS & USA!)", 30, 220);
          ctx.fillText("3. ALLOWED INK:", 30, 252);
          ctx.fillText("   CRIMSON / VIOLET / BLACK", 30, 272);
          ctx.fillText("   (NO IMPERIALIST BLUE!)", 30, 290);
        } else {
          ctx.fillText("PAGE 2 // UV WATERMARKS:", 30, 82);
          ctx.font = 'bold 14px "Courier Prime", monospace';
          ctx.fillText("USE 3D UV MAGNIFYING GLASS", 30, 114);
          ctx.fillText("TO VERIFY HIDDEN WATERMARK:", 30, 134);
          ctx.fillStyle = "#1b6e32";
          ctx.fillText("VALID WATERMARK:", 30, 168);
          ctx.fillText('"GLORY TO LABOR 1984"', 30, 188);
          ctx.fillStyle = "#8b1e1e";
          ctx.fillText("CIA FORGERY WATERMARKS:", 30, 224);
          ctx.fillText('- "MADE IN LANGLEY VA"', 30, 246);
          ctx.fillText('- "PROPERTY OF LANGLEY"', 30, 266);
          ctx.fillText('- "PRINTED IN LONDON"', 30, 286);
        }

        ctx.fillStyle = "#23312b";
        ctx.font = 'bold 16px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("[CLICK MANUAL TO FLIP PAGE]", 160, 362);
        mTex.needsUpdate = true;
      }
    }
  });

  return (
    <group position={[0, 0.06, -0.96]} rotation={[0, 0, 0]} scale={0.72}>
      {/* 3D Soviet Bureaucratic Operator Desk */}
      <mesh position={[0, 0.44, 0]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[1.64, 0.88, 0.96]} />
        <meshStandardMaterial
          color="#23312b"
          roughness={0.78}
          metalness={0.35}
        />
      </mesh>
      <mesh position={[0, 0.89, 0]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[1.72, 0.05, 1.04]} />
        <meshStandardMaterial
          color="#3b2b1e"
          roughness={0.72}
          metalness={0.15}
        />
      </mesh>

      {/* 3D Pravda-84 Dot-Matrix Printer */}
      <group
        position={[0.05, 1.04, -0.36]}
        onClick={(e) => {
          e.stopPropagation();
          playLeverRatchet(1.1);
          useGameStore.getState().spawnDirective();
        }}
      >
        <mesh>
          <boxGeometry args={[0.72, 0.22, 0.3]} />
          <meshStandardMaterial
            color="#23312b"
            roughness={0.65}
            metalness={0.4}
          />
        </mesh>
        <mesh position={[0, 0.12, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.045, 0.045, 0.62, 10]} />
          <meshStandardMaterial color="#141414" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.03, 0.152]}>
          <planeGeometry args={[0.58, 0.14]} />
          <meshStandardMaterial
            map={printerPlateTex}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>

      {/* 3D KGB Security Manual '84 Binder (Tilted on angled stand for crisp readability) */}
      <group
        position={[-0.5, 0.96, 0.14]}
        rotation={[-Math.PI / 2 + 0.22, 0, 0.06]}
        onClick={(e) => {
          e.stopPropagation();
          playSwitchClank(false);
          setManualPage((p) => (p === 0 ? 1 : 0));
        }}
      >
        <mesh>
          <boxGeometry args={[0.46, 0.56, 0.035]} />
          <meshStandardMaterial color="#6b1d18" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0, 0.021]}>
          <planeGeometry args={[0.44, 0.54]} />
          <meshStandardMaterial
            ref={manualMatRef}
            map={manualTexture}
            roughness={0.85}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>

      {/* 3D Tractor-Feed Directive Paper Mesh (#e6dec3, Tilted toward operator) */}
      <group
        position={[0.06, 0.96, 0.14]}
        rotation={[-Math.PI / 2 + 0.22, 0, -0.02]}
        onClick={(e) => {
          e.stopPropagation();
          playSwitchClank(false);
          setUvLensActive((prev) => !prev);
        }}
      >
        <mesh>
          <boxGeometry args={[0.48, 0.6, 0.008]} />
          <meshStandardMaterial color="#e6dec3" roughness={0.88} />
        </mesh>
        <mesh position={[0, 0, 0.007]}>
          <planeGeometry args={[0.47, 0.59]} />
          <meshStandardMaterial
            ref={paperMatRef}
            map={paperTexture}
            roughness={0.88}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>

      {/* 3D UV Magnifying Glass Lens */}
      <group
        ref={uvGlassGroupRef}
        position={[0.52, 0.94, -0.18]}
        onClick={(e) => {
          e.stopPropagation();
          playSwitchClank(false);
          setUvLensActive((prev) => !prev);
        }}
      >
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.11, 0.014, 10, 18]} />
          <meshStandardMaterial
            color="#b8a46b"
            roughness={0.35}
            metalness={0.8}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.105, 16]} />
          <meshStandardMaterial
            color={uvLensActive ? "#9b5cff" : "#a8d8ff"}
            emissive={uvLensActive ? "#6e28dc" : "#000000"}
            emissiveIntensity={uvLensActive ? 0.85 : 0}
            transparent
            opacity={0.42}
            roughness={0.15}
          />
        </mesh>
        <mesh position={[0, 0, 0.17]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.016, 0.02, 0.14, 8]} />
          <meshStandardMaterial color="#141414" roughness={0.6} />
        </mesh>
      </group>

      {/* Physical 3D Rubber Stamps: [APPROVE] (Green) & [SHRED] (Red) with Stenciled Plaques */}
      <group
        ref={approveStampRef}
        position={[0.49, 0.93, 0.06]}
        onClick={(e) => {
          e.stopPropagation();
          const s = useGameStore.getState();
          if (s.activeDirectives.length === 0) {
            playLeverRatchet(0.4);
            return;
          }
          playSwitchClank(true);
          stampAnimRef.current = { type: "APPROVED", progress: 0 };
        }}
      >
        <mesh position={[0, 0.018, 0]}>
          <boxGeometry args={[0.17, 0.035, 0.11]} />
          <meshStandardMaterial
            color="#1b6e32"
            emissive="#1b6e32"
            emissiveIntensity={0.35}
            roughness={0.5}
          />
        </mesh>
        <mesh
          position={[0, 0.038, 0.035]}
          rotation={[-Math.PI / 2 + 0.45, 0, 0]}
        >
          <planeGeometry args={[0.16, 0.05]} />
          <meshStandardMaterial
            map={approveStampTex}
            roughness={0.7}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
        <mesh position={[0, 0.068, -0.01]}>
          <cylinderGeometry args={[0.024, 0.03, 0.075, 10]} />
          <meshStandardMaterial color="#141414" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.112, -0.01]}>
          <sphereGeometry args={[0.036, 10, 10]} />
          <meshStandardMaterial color="#1b6e32" roughness={0.4} />
        </mesh>
      </group>

      <group
        ref={shredStampRef}
        position={[0.49, 0.93, 0.26]}
        onClick={(e) => {
          e.stopPropagation();
          const s = useGameStore.getState();
          if (s.activeDirectives.length === 0) {
            playLeverRatchet(0.4);
            return;
          }
          playSwitchClank(true);
          stampAnimRef.current = { type: "SHREDDED", progress: 0 };
        }}
      >
        <mesh position={[0, 0.018, 0]}>
          <boxGeometry args={[0.17, 0.035, 0.11]} />
          <meshStandardMaterial
            color="#ff2a2a"
            emissive="#ff2a2a"
            emissiveIntensity={0.35}
            roughness={0.5}
          />
        </mesh>
        <mesh
          position={[0, 0.038, 0.035]}
          rotation={[-Math.PI / 2 + 0.45, 0, 0]}
        >
          <planeGeometry args={[0.16, 0.05]} />
          <meshStandardMaterial
            map={shredStampTex}
            roughness={0.7}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
        <mesh position={[0, 0.068, -0.01]}>
          <cylinderGeometry args={[0.024, 0.03, 0.075, 10]} />
          <meshStandardMaterial color="#141414" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.112, -0.01]}>
          <sphereGeometry args={[0.036, 10, 10]} />
          <meshStandardMaterial color="#ff2a2a" roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
};

/**
 * Heavy Physical 3D Soviet Digital Shift Clock (`MCR CLOCK // ELEKTRONIKA-7`)
 * Mounted cleanly at the crown above the monumental `K.O.M.R.A.D.-84` master CRT bay,
 * glowing with authentic crimson-red 7-segment digits inside a dark ruby filter cavity.
 */
const SovietDigitalShiftClock3D: React.FC = React.memo(() => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  const screenMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const statusLampMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lastClockSigRef = useRef("");

  const clockDisplayTex = useMemo(() => createCrispPanelTexture(768, 192), []);

  useEffect(() => {
    return onKremlinFontReady(() => {
      lastClockSigRef.current = "";
    });
  }, []);

  const gostNameplateTex = useMemo(
    () =>
      createCrispPanelTexture(512, 64, (ctx, w, h) => {
        ctx.fillStyle = "#180b0b";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#ff4433";
        ctx.font = 'bold 19px "Kremlin", "Consolas", monospace';
        ctx.textAlign = "center";
        ctx.fillText("MCR CLOCK 00:00 - 06:00 // ELEKTRONIKA-7", w / 2, 40, w - 24);
      }),
    [],
  );

  useFrame(({ clock }) => {
    const s = useGameStore.getState();
    const now = clock.getElapsedTime();
    const halfSecBucket = Math.floor(now * 2);

    const totalMins = Math.floor(Math.max(0, Math.min(360, s.shiftTimeMinutes)));
    const hh = String(Math.floor(totalMins / 60)).padStart(2, "0");
    const mm = String(totalMins % 60).padStart(2, "0");

    const totalMW =
      s.powerAllocation.cooling +
      s.powerAllocation.defense +
      s.powerAllocation.facility +
      (s.ventilationActive ? 10 : 0);
    const isFinalHour = totalMins >= 300;
    const isEmergency =
      s.isBlackout ||
      s.coreTemp >= 700 ||
      totalMW > s.maxSafePower ||
      s.ciaIntrusionActive ||
      s.komradOverrideLocked;

    const z3Power =
      s.lobbyMenuPhase !== "entered_control_room"
        ? 0.14
        : THREE.MathUtils.lerp(0.14, 1.0, controlRoomPowerState.zone3);

    if (screenMatRef.current) {
      screenMatRef.current.color.setRGB(z3Power, z3Power, z3Power);
      screenMatRef.current.emissiveIntensity =
        (s.isBlackout ? 0.18 : 1.08) * z3Power;
    }

    // Update physical status indicator lamp on clock bezel
    if (statusLampMatRef.current) {
      if (s.isBlackout) {
        statusLampMatRef.current.color.copy(SCENE_COLOR_CLOCK_BLACKOUT);
        statusLampMatRef.current.emissive.copy(SCENE_COLOR_RED);
        statusLampMatRef.current.emissiveIntensity = 0.25 * z3Power;
      } else if (isEmergency) {
        const pulse = 0.5 + 0.5 * Math.sin(now * 4.2);
        statusLampMatRef.current.color.copy(SCENE_COLOR_RED);
        statusLampMatRef.current.emissive.copy(SCENE_COLOR_RED);
        statusLampMatRef.current.emissiveIntensity = (1.15 + pulse * 1.25) * z3Power;
      } else {
        statusLampMatRef.current.color.copy(SCENE_COLOR_CLOCK_NORM);
        statusLampMatRef.current.emissive.copy(SCENE_COLOR_RED);
        statusLampMatRef.current.emissiveIntensity = 1.1 * z3Power;
      }
    }

    if (s.diagFeedActive) return;

    const colonOn = halfSecBucket % 2 === 0;
    const sig = `${hh}:${mm}|${colonOn}|${s.isBlackout}|${isEmergency}|${isFinalHour}|${s.shiftNumber}`;
    if (sig === lastClockSigRef.current) return;
    lastClockSigRef.current = sig;

    const tex = screenMatRef.current?.map as THREE.CanvasTexture | undefined;
    if (!tex) return;
    const canvas = tex.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // 1. Deep Recessed Ruby-Tinted 7-Segment Cavity Background (`#120505`)
    ctx.fillStyle = s.isBlackout ? "#070202" : "#120505";
    ctx.fillRect(0, 0, w, h);

    // Subtle filter grid inside 7-segment optical hood
    ctx.strokeStyle = "rgba(255, 58, 42, 0.08)";
    ctx.lineWidth = 1;
    for (let gx = 16; gx < w; gx += 16) {
      ctx.beginPath();
      ctx.moveTo(gx, 8);
      ctx.lineTo(gx, h - 8);
      ctx.stroke();
    }
    for (let gy = 16; gy < h; gy += 16) {
      ctx.beginPath();
      ctx.moveTo(8, gy);
      ctx.lineTo(w - 8, gy);
      ctx.stroke();
    }

    // Inner metallic viewport border
    ctx.strokeStyle = isEmergency
      ? "#ff2a2a"
      : isFinalHour
        ? "#ff6622"
        : "#6e221e";
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    // Top micro-telemetry strip inside the clock glass
    ctx.fillStyle = "rgba(32, 10, 10, 0.92)";
    ctx.fillRect(8, 8, w - 16, 32);
    ctx.font = '700 18px "Kremlin", "Consolas", "Lucida Console", monospace';
    ctx.textAlign = "left";
    ctx.fillStyle = "#e8c4be";
    ctx.fillText(
      `MCR CLOCK // SHIFT NO. ${s.shiftNumber}`,
      18,
      30,
      w * 0.55,
    );
    ctx.textAlign = "right";
    ctx.fillStyle = isEmergency
      ? "#ff3b24"
      : isFinalHour
        ? "#ff9933"
        : "#ff5544";
    ctx.fillText(
      s.isBlackout
        ? "POWER FAILURE"
        : isEmergency
          ? "UNIT 4 ALERT"
          : isFinalHour
            ? "FINAL HOUR"
            : "06:00 QUOTA",
      w - 18,
      30,
    );

    // Dim unlit 88:88 / 88:88 ghost red segments behind active digits
    ctx.textAlign = "center";
    ctx.font = '900 108px "VT323", "Consolas", monospace';
    ctx.fillStyle = "rgba(255, 42, 42, 0.11)";
    ctx.fillText("88:88 / 88:88", w / 2 - 24, 146);

    // Glowing Crimson-Red 7-Segment Soviet Shift Clock Numerals (`00:00 / 06:00`)
    const mainDigitCol = s.isBlackout
      ? "#4f1414"
      : isEmergency
        ? "#ff2a2a"
        : isFinalHour
          ? "#ff6a22"
          : "#ff3b24";
    const targetCol = s.isBlackout ? "#381212" : "#ff8844";
    const sep = colonOn || s.isBlackout ? ":" : " ";

    ctx.save();
    ctx.shadowColor = mainDigitCol;
    ctx.shadowBlur = s.isBlackout ? 2 : 14;
    ctx.fillStyle = mainDigitCol;
    ctx.textAlign = "right";
    ctx.fillText(`${hh}${sep}${mm}`, w / 2 + 10, 146);
    ctx.restore();

    ctx.save();
    ctx.font = '900 88px "VT323", "Consolas", monospace';
    ctx.shadowColor = targetCol;
    ctx.shadowBlur = s.isBlackout ? 0 : 9;
    ctx.fillStyle = targetCol;
    ctx.textAlign = "left";
    ctx.fillText(" / 06:00", w / 2 + 18, 142);
    ctx.restore();

    // Bottom Shift Progress Bar (00:00 -> 06:00)
    const barX = 18;
    const barY = h - 22;
    const barW = w - 36;
    const barH = 10;
    ctx.fillStyle = "#1c0a0a";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = "#5c201e";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX, barY, barW, barH);
    const progRatio = Math.max(0, Math.min(1, totalMins / 360));
    ctx.fillStyle = isEmergency
      ? "#ff2a2a"
      : isFinalHour
        ? "#ffaa00"
        : "#ff3b24";
    ctx.fillRect(barX + 2, barY + 2, (barW - 4) * progRatio, barH - 4);

    tex.needsUpdate = true;
  });

  return (
    <group position={[1.08, 3.77, -3.36]} rotation={[0.12, 0, 0]} scale={0.82}>
      {/* 1. Twin Heavy Bolted Steel Mounting Stanchions Anchoring Clock to Top Projection Hood */}
      {[-0.44, 0.44].map((sx, idx) => (
        <group key={`clk-stanchion-${idx}`} position={[sx, -0.145, -0.02]}>
          <mesh raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.14, 0.06, 0.14]} />
            <meshStandardMaterial
              color="#1e2422"
              metalness={0.68}
              roughness={0.42}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
          {[-0.048, 0.048].map((bx, bIdx) => (
            <mesh key={bIdx} position={[bx, 0.032, 0.048]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.008, 0.008, 0.01, 6]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.86}
                roughness={0.26}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* 2. Main Soviet Enamelled Sage-Steel & Bakelite Clock Casing (`1.15m x 0.28m x 0.18m`) */}
      <mesh raycast={NOOP_RAYCAST}>
        <boxGeometry args={[1.15, 0.28, 0.18]} />
        <meshStandardMaterial
          color="#2f443e"
          metalness={0.48}
          roughness={0.52}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.006}
          roughnessMap={ironTex.roughnessMap}
        />
      </mesh>

      {/* Outer Dark Structural Frame & Recessed Ruby Viewport Cavity (`#120505`) */}
      <mesh position={[0, 0, 0.084]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[1.11, 0.245, 0.022]} />
        <meshStandardMaterial
          color="#1a1212"
          metalness={0.62}
          roughness={0.44}
        />
      </mesh>

      {/* Top Overhanging Glare-Shield Hood Lip on Clock Bezel */}
      <mesh position={[0, 0.132, 0.105]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[1.16, 0.018, 0.055]} />
        <meshStandardMaterial
          color="#222c28"
          metalness={0.6}
          roughness={0.45}
        />
      </mesh>

      {/* 4 Brushed-Steel Corner Reinforcing Brackets & 8 Hex Bolts */}
      {(
        [
          [-0.545, 0.115],
          [0.545, 0.115],
          [-0.545, -0.115],
          [0.545, -0.115],
        ] as const
      ).map(([cx, cy], cIdx) => (
        <group key={`clk-corner-${cIdx}`} position={[cx, cy, 0.088]}>
          <mesh raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.068, 0.058, 0.018]} />
            <meshStandardMaterial
              color="#8a929a"
              metalness={0.82}
              roughness={0.32}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
          {[-0.016, 0.016].map((bx, bIdx) => (
            <mesh
              key={bIdx}
              position={[bx, 0, 0.011]}
              rotation={[Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.006, 0.006, 0.008, 6]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.88}
                roughness={0.25}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* 3. High-Contrast Red 7-Segment Digital Shift Readout Screen (`00:00 / 06:00`) */}
      <mesh position={[-0.055, 0.008, 0.11]} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[0.94, 0.205]} />
        <meshStandardMaterial
          ref={screenMatRef}
          map={clockDisplayTex}
          color="#ffffff"
          emissive="#ffffff"
          emissiveMap={clockDisplayTex}
          emissiveIntensity={1.08}
          roughness={0.22}
          metalness={0.1}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* Protective Ruby-Tinted Glass Viewport Pane Over Digits */}
      <mesh position={[-0.055, 0.008, 0.124]} renderOrder={2} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[0.945, 0.21]} />
        <meshStandardMaterial
          color="#2a0808"
          transparent
          opacity={0.14}
          depthWrite={false}
          roughness={0.12}
          metalness={0.35}
        />
      </mesh>

      {/* 4. Right Bezel Status Indicator Lamp (`CagedSovietJewelLamp3D`) */}
      <CagedSovietJewelLamp3D
        position={[0.475, 0.025, 0.096]}
        defaultColor="#ff2a2a"
        lampMatRef={statusLampMatRef}
        scale={1.08}
      />

      {/* 5. Bottom Brass GOST Nameplate (`MCR CLOCK 00:00 - 06:00`) */}
      <mesh position={[0, -0.118, 0.098]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.52, 0.036, 0.006]} />
        <meshStandardMaterial
          color="#b8a46b"
          metalness={0.86}
          roughness={0.26}
        />
      </mesh>
      <mesh position={[0, -0.118, 0.115]} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[0.506, 0.031]} />
        <meshStandardMaterial
          map={gostNameplateTex}
          emissive="#ffffff"
          emissiveMap={gostNameplateTex}
          emissiveIntensity={0.42}
          roughness={0.5}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  );
});

function createHazardStripeTexture(
  width = 256,
  height = 64,
  stripeWidth = 24,
  primaryHex = "#ffb000",
  secondaryHex = "#141414",
): THREE.CanvasTexture {
  const tex = createNearestCanvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = secondaryHex;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = primaryHex;
    for (let x = -h; x < w + h; x += stripeWidth * 2) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + stripeWidth, h);
      ctx.lineTo(x + stripeWidth + h, 0);
      ctx.lineTo(x + h, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = "#0e100f";
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  });
  return tex;
}

/**
 * Two-Wing Split Soviet RBMK-1000 Operator Console Plinth (Left & Right MCR Console Wings)
 * Heavy bolted Soviet sheet-metal cabinetry (`#2f3e38` olive-sage panels framed by `#1b2220` L-angle iron)
 * wrapping both Left (`x=-3.54, z=-1.22, +15°`) and single-bay Right (`x=+4.15, z=-0.98, -18°`) wings
 * with detailed side cheeks, rear service doors, grounding busbars, and armored floor cable conduits.
 */
const SovietRbmkOperatorConsolePlinth3D: React.FC = React.memo(() => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  const kickGrateTex = useMemo(() => {
    const tex = createNearestCanvasTexture(256, 64, (ctx, w, h) => {
      ctx.fillStyle = "#171d1b";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#2b3531";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = "#0b0e0d";
      for (let gx = 16; gx < w - 16; gx += 32) {
        ctx.fillRect(gx, 12, 16, h - 24);
      }
      ctx.fillStyle = "#8a928e";
      for (const bx of [8, w - 8]) {
        ctx.fillRect(bx - 2, 8, 4, 4);
        ctx.fillRect(bx - 2, h - 12, 4, 4);
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    return tex;
  }, []);

  const ribbedBolsterTex = useMemo(() => {
    const tex = createNearestCanvasTexture(128, 64, (ctx, w, h) => {
      ctx.fillStyle = "#201411";
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 16) {
        ctx.fillStyle = "#2c1c17";
        ctx.fillRect(x + 2, 2, 12, h - 4);
        ctx.fillStyle = "#110a08";
        ctx.fillRect(x, 0, 2, h);
      }
      ctx.strokeStyle = "#3a251e";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 5, w - 2, h - 10);
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(6, 1);
    return tex;
  }, []);

  const groundingBusTex = useMemo(() => {
    const tex = createNearestCanvasTexture(256, 32, (ctx, w, h) => {
      ctx.fillStyle = "#c8743c";
      ctx.fillRect(0, 0, w, h);
      for (let x = -h; x < w + h; x += 24) {
        ctx.fillStyle = "#28a844";
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + 10, h);
        ctx.lineTo(x + 10 + h, 0);
        ctx.lineTo(x + h, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#f2b820";
        ctx.beginPath();
        ctx.moveTo(x + 10, h);
        ctx.lineTo(x + 18, h);
        ctx.lineTo(x + 18 + h, 0);
        ctx.lineTo(x + 10 + h, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(6, 1);
    return tex;
  }, []);

  const gostSidePlaqueTex = useMemo(
    () =>
      createNearestCanvasTexture(256, 128, (ctx, w, h) => {
        ctx.fillStyle = "#d8b24c";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#181c1a";
        ctx.lineWidth = 6;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        ctx.fillStyle = "#181c1a";
        ctx.fillRect(10, 10, w - 20, 34);
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 17px "Kremlin", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("GOST 22789 // MCR SHIELD", w / 2, 34, w - 28);
        ctx.fillStyle = "#141414";
        ctx.font = 'bold 18px "Kremlin", "VT323", monospace';
        ctx.fillText("380 / 220 V • 50 HZ", w / 2, 74, w - 24);
        ctx.fillStyle = "#a81818";
        ctx.font = 'bold 16px "Kremlin", "VT323", monospace';
        ctx.fillText("GROUND BUS • INV. NO. 84", w / 2, 108, w - 24);
      }),
    [],
  );

  const sectionPlaqueLeftTex = useMemo(
    () =>
      makePlaqueTex("CONSOLE BAY NO. 1", "UNIT A-2 • A // REACTOR & MCP", {
        width: 512,
        height: 80,
        titleSize: 24,
        subSize: 16,
        titleColor: "#ffcc00",
        titleStroke: "#ffcc00",
        subColor: "#e6dec3",
        subStroke: "#e6dec3",
        borderColor: "#b8a46b",
      }),
    [],
  );

  const sectionPlaqueRightTex = useMemo(
    () =>
      makePlaqueTex("CONSOLE BAY NO. 2", "UNIT B // HYDRAULICS & GAS", {
        width: 512,
        height: 80,
        titleSize: 24,
        subSize: 16,
        titleColor: "#ffcc00",
        titleStroke: "#ffcc00",
        subColor: "#e6dec3",
        subStroke: "#e6dec3",
        borderColor: "#b8a46b",
      }),
    [],
  );

  const sharedMats = useMemo(
    () => ({
      oliveCladding: new THREE.MeshStandardMaterial({
        color: "#2f3e38",
        metalness: 0.46,
        roughness: 0.54,
        bumpMap: ironTex.bumpMap,
        bumpScale: 0.006,
      }),
      recessedOlive: new THREE.MeshStandardMaterial({
        color: "#24312c",
        metalness: 0.5,
        roughness: 0.52,
        bumpMap: ironTex.bumpMap,
        bumpScale: 0.005,
      }),
      bevelTrim: new THREE.MeshStandardMaterial({
        color: "#394b44",
        metalness: 0.48,
        roughness: 0.48,
      }),
      gunmetalAngle: new THREE.MeshStandardMaterial({
        color: "#1b2220",
        metalness: 0.68,
        roughness: 0.44,
        bumpMap: ironTex.bumpMap,
        bumpScale: 0.006,
      }),
      louverSlot: new THREE.MeshStandardMaterial({
        color: "#0e1311",
        metalness: 0.55,
        roughness: 0.6,
      }),
      chromeHardware: new THREE.MeshStandardMaterial({
        color: "#c8d2ce",
        metalness: 0.88,
        roughness: 0.24,
      }),
      brassFastener: new THREE.MeshStandardMaterial({
        color: "#b8a46b",
        metalness: 0.86,
        roughness: 0.26,
        bumpMap: brassTex.bumpMap,
        bumpScale: 0.004,
      }),
      copperBus: new THREE.MeshStandardMaterial({
        color: "#c8743c",
        metalness: 0.85,
        roughness: 0.28,
      }),
      ribbedConduit: new THREE.MeshStandardMaterial({
        color: "#3e4844",
        metalness: 0.72,
        roughness: 0.42,
        bumpMap: ironTex.bumpMap,
        bumpScale: 0.01,
      }),
    }),
    [brassTex.bumpMap, ironTex.bumpMap],
  );

  const sharedGeos = useMemo(() => {
    const sideConduitA = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.26, 0),
        new THREE.Vector3(0.11, 0.24, 0),
        new THREE.Vector3(0.15, 0.13, -0.02),
        new THREE.Vector3(0.16, 0.01, -0.03),
      ]),
      10,
      0.024,
      8,
      false,
    );
    const sideConduitB = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.2, 0),
        new THREE.Vector3(0.08, 0.18, 0.02),
        new THREE.Vector3(0.11, 0.09, 0.01),
        new THREE.Vector3(0.12, 0.01, 0),
      ]),
      10,
      0.019,
      8,
      false,
    );
    const rearConduit = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.34, 0),
        new THREE.Vector3(0, 0.31, -0.14),
        new THREE.Vector3(0, 0.16, -0.2),
        new THREE.Vector3(0, 0.01, -0.22),
      ]),
      10,
      0.025,
      8,
      false,
    );
    const hexBolt = new THREE.CylinderGeometry(0.0085, 0.0085, 0.01, 6);
    const glandCollar = new THREE.CylinderGeometry(0.032, 0.036, 0.028, 8);
    const floorFlange = new THREE.CylinderGeometry(0.044, 0.048, 0.018, 8);
    const louverSlat = new THREE.BoxGeometry(0.36, 0.016, 0.014);
    const tHandleStem = new THREE.CylinderGeometry(0.008, 0.008, 0.024, 8);
    const tHandleBar = new THREE.BoxGeometry(0.014, 0.068, 0.012);
    const claspBand = new THREE.BoxGeometry(0.026, 0.046, 0.082);
    return {
      sideConduitA,
      sideConduitB,
      rearConduit,
      hexBolt,
      glandCollar,
      floorFlange,
      louverSlat,
      tHandleStem,
      tHandleBar,
      claspBand,
    };
  }, []);

  const deskBays = [
    {
      key: "left",
      pos: [-3.54, 0, -1.22] as const,
      rotY: (15 * Math.PI) / 180,
      width: 3.34,
      wingScale: 1.0,
      seamX: -0.084 as number | null,
      plinthTopY: 0.255,
      frontApronZ: 0.385,
    },
    {
      key: "right",
      pos: [4.15, 0, -0.98] as const,
      rotY: -(18 * Math.PI) / 180,
      width: 1.78,
      wingScale: 1.162,
      seamX: null as number | null,
      plinthTopY: 0.225,
      frontApronZ: 0.465,
    },
  ] as const;

  return (
    <group>
      {deskBays.map((bay) => {
        const ws = bay.wingScale;
        const spineZ = bay.key === "left" ? -0.9 : -1.02;
        const spineH = bay.key === "left" ? 0.82 : 0.92;
        const spineCenterY = 0.18 + spineH / 2;
        const pedBackZ = spineZ - 0.1;
        const frontFaceZ = bay.frontApronZ;
        const pedDepth = frontFaceZ - pedBackZ;
        const pedCenterZ = (frontFaceZ + pedBackZ) * 0.5;
        const pedBodyH = bay.plinthTopY - 0.132;
        const pedBodyCenterY = 0.132 + pedBodyH * 0.5;
        const kickDepth = pedDepth - 0.04;
        const kickFrontZ = pedCenterZ + kickDepth * 0.5;
        const bolsterY = bay.plinthTopY + 0.018;
        const bolsterZ = frontFaceZ + 0.042;
        const bolsterCylZ = bolsterZ + 0.03;
        const slopeH = 1.24 * ws;
        const slopeCenterY = 1.06 + 0.1 * (ws - 1);
        const slopeCenterZ = -0.36 - 0.05 * (ws - 1);
        const rearDoorXOffsets =
          bay.key === "right"
            ? ([-bay.width * 0.24, bay.width * 0.24] as const)
            : ([
                -bay.width * 0.36,
                -bay.width * 0.12,
                bay.width * 0.12,
                bay.width * 0.36,
              ] as const);
        const claspXs =
          bay.key === "right"
            ? ([-bay.width * 0.36, 0, bay.width * 0.36] as const)
            : ([
                -bay.width * 0.4,
                -bay.width * 0.2,
                0,
                bay.width * 0.2,
                bay.width * 0.4,
              ] as const);

        return (
          <group
            key={bay.key}
            position={[bay.pos[0], bay.pos[1], bay.pos[2]]}
            rotation={[0, bay.rotY, 0]}
          >
            {/* 1. Recessed Steel Kickplate, Ventilation Louver Slots & Bolted Copper Grounding Busbar */}
            <mesh
              position={[0, 0.068, pedCenterZ]}
              material={sharedMats.gunmetalAngle}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[bay.width - 0.04, 0.128, kickDepth]} />
            </mesh>
            <mesh
              position={[0, 0.068, kickFrontZ + 0.009]}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <planeGeometry args={[bay.width - 0.18, 0.096]} />
              <meshStandardMaterial
                map={kickGrateTex}
                metalness={0.24}
                roughness={0.86}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
            {/* Continuous Grounding Busbar (`GROUND BUS`) on Standoff Insulators */}
            <mesh
              position={[0, 0.036, frontFaceZ + 0.006]}
              material={sharedMats.copperBus}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[bay.width - 0.14, 0.026, 0.012]} />
            </mesh>
            <mesh
              position={[0, 0.036, frontFaceZ + 0.02]}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <planeGeometry args={[bay.width - 0.16, 0.022]} />
              <meshStandardMaterial
                map={groundingBusTex}
                metalness={0.45}
                roughness={0.42}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
            {([-bay.width * 0.42, 0, bay.width * 0.42] as const).map(
              (gx, gIdx) => (
                <mesh
                  key={`${bay.key}-gnd-strap-${gIdx}`}
                  position={[gx, 0.02, frontFaceZ + 0.008]}
                  material={sharedMats.copperBus}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                >
                  <boxGeometry args={[0.026, 0.032, 0.016]} />
                </mesh>
              ),
            )}

            {/* Re-attached GOST Console Section Plaque Mounted Cleanly on Lower Kickplate */}
            <mesh
              position={[0, 0.102, frontFaceZ + 0.014]}
              material={sharedMats.gunmetalAngle}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.52, 0.072, 0.014]} />
            </mesh>
            <mesh
              position={[0, 0.102, frontFaceZ + 0.028]}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <planeGeometry args={[0.5, 0.064]} />
              <meshStandardMaterial
                map={
                  bay.key === "left"
                    ? sectionPlaqueLeftTex
                    : sectionPlaqueRightTex
                }
                emissive="#ffffff"
                emissiveMap={
                  bay.key === "left"
                    ? sectionPlaqueLeftTex
                    : sectionPlaqueRightTex
                }
                emissiveIntensity={0.28}
                roughness={0.55}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>

            {/* 2. Soviet Olive-Sage Lower Cabinet Pedestal & Corner L-Angle Iron Frame */}
            <mesh
              position={[0, pedBodyCenterY, pedCenterZ]}
              material={sharedMats.oliveCladding}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[bay.width, pedBodyH, pedDepth]} />
            </mesh>
            {/* Front Horizontal Gunmetal Sill & Upper Pedestal Cap Angle Rails */}
            <mesh
              position={[0, 0.134, frontFaceZ + 0.01]}
              material={sharedMats.gunmetalAngle}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[bay.width + 0.02, 0.022, 0.02]} />
            </mesh>
            <mesh
              position={[0, bay.plinthTopY + 0.012, frontFaceZ + 0.014]}
              material={sharedMats.gunmetalAngle}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[bay.width + 0.03, 0.024, 0.036]} />
            </mesh>

            {/* 3. Segmented Ribbed Bakelite/Leatherette Lower Apron Bolster With Brushed-Chrome Clasps */}
            <mesh
              position={[0, bolsterY, bolsterZ]}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[bay.width + 0.04, 0.038, 0.07]} />
              <meshStandardMaterial
                map={ribbedBolsterTex}
                color="#4d322b"
                roughness={0.72}
                metalness={0.14}
              />
            </mesh>
            <mesh
              position={[0, bolsterY - 0.002, bolsterCylZ]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry
                args={[0.019, 0.019, bay.width + 0.04, 12]}
              />
              <meshStandardMaterial
                map={ribbedBolsterTex}
                color="#422a24"
                roughness={0.68}
                metalness={0.16}
              />
            </mesh>
            {claspXs.map((cx, cIdx) => (
              <mesh
                key={`${bay.key}-clasp-${cIdx}`}
                position={[cx, bolsterY, bolsterZ + 0.006]}
                geometry={sharedGeos.claspBand}
                material={sharedMats.chromeHardware}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              />
            ))}
            {/* Brushed Steel Trim Bezel Behind Wrist Bolster */}
            <mesh
              position={[0, bolsterY, bolsterZ - 0.032]}
              material={sharedMats.bevelTrim}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[bay.width + 0.01, 0.014, 0.018]} />
            </mesh>

            {/* 4. Full-Width Rear Instrument Cabinet Spine & 4-Bay Sheet-Metal Service Cabinetry */}
            <mesh
              position={[0, spineCenterY, spineZ]}
              material={sharedMats.oliveCladding}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[bay.width, spineH, 0.24]} />
            </mesh>
            {/* Top Rear Hood Cap & Gunmetal Corner Frame */}
            <mesh
              position={[0, 0.18 + spineH + 0.016, spineZ - 0.01]}
              material={sharedMats.gunmetalAngle}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[bay.width + 0.04, 0.032, 0.27]} />
            </mesh>
            <mesh
              position={[0, 0.18 + spineH + 0.012, spineZ - 0.132]}
              material={sharedMats.gunmetalAngle}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[bay.width + 0.02, 0.04, 0.026]} />
            </mesh>
            {/* Central Seam Divider Column Between Panels (recessed clear of sloped bezels) */}
            {bay.seamX !== null && (
              <mesh
                position={[
                  bay.seamX,
                  bay.key === "left" ? 0.94 : 1.02,
                  bay.key === "left" ? -0.39 : -0.43,
                ]}
                rotation={[-0.51, 0, 0]}
                material={sharedMats.gunmetalAngle}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <boxGeometry
                  args={[0.032, bay.key === "left" ? 1.12 : 1.28, 0.044]}
                />
              </mesh>
            )}

            {/* Rear Multi-Bay Access Doors, Louvers, Chrome T-Handles & Armored Conduits */}
            {rearDoorXOffsets.map((rx, rIdx) => {
              const bayW =
                bay.key === "right" ? bay.width * 0.42 : bay.width * 0.21;
              const doorZ = spineZ - 0.13;
              return (
                <group key={`${bay.key}-rearbay-${rIdx}`} position={[rx, 0, 0]}>
                  {/* Upper Service Door */}
                  <mesh
                    position={[0, spineCenterY + 0.06, doorZ]}
                    material={sharedMats.recessedOlive}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <boxGeometry args={[bayW, spineH * 0.72, 0.016]} />
                  </mesh>
                  {/* Vertical Gunmetal Mullion Strip */}
                  <mesh
                    position={[bayW * 0.54, spineCenterY, doorZ - 0.006]}
                    material={sharedMats.gunmetalAngle}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <boxGeometry args={[0.026, spineH - 0.012, 0.022]} />
                  </mesh>
                  {/* Stamped Rear Cooling Louvers */}
                  {([-0.2, -0.14, -0.08, 0.18, 0.24, 0.3] as const).map(
                    (ly, lIdx) => (
                      <mesh
                        key={`${bay.key}-rlouv-${rIdx}-${lIdx}`}
                        position={[0, spineCenterY + 0.06 + ly * ws, doorZ - 0.014]}
                        rotation={[-0.35, 0, 0]}
                        geometry={sharedGeos.louverSlat}
                        material={sharedMats.louverSlot}
                        scale={[bayW * 2.1, 1, 1]}
                        castShadow={false}
                        raycast={NOOP_RAYCAST}
                      />
                    ),
                  )}
                  {/* Chrome T-Handle Latch on Rear Door */}
                  <mesh
                    position={[bayW * 0.35, spineCenterY + 0.04, doorZ - 0.02]}
                    rotation={[Math.PI / 2, 0, 0]}
                    geometry={sharedGeos.tHandleStem}
                    material={sharedMats.chromeHardware}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  />
                  <mesh
                    position={[bayW * 0.35, spineCenterY + 0.04, doorZ - 0.032]}
                    geometry={sharedGeos.tHandleBar}
                    material={sharedMats.chromeHardware}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  />
                  {/* Lower Pedestal Rear Service Hatch & Armored Cable Conduit */}
                  <mesh
                    position={[0, 0.16, pedBackZ - 0.01]}
                    material={sharedMats.recessedOlive}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <boxGeometry args={[bayW, 0.18, 0.016]} />
                  </mesh>
                  {rIdx % 2 === 0 && (
                    <group position={[0, 0, doorZ - 0.008]}>
                      <mesh
                        position={[0, 0.34, -0.012]}
                        rotation={[Math.PI / 2, 0, 0]}
                        geometry={sharedGeos.glandCollar}
                        material={sharedMats.brassFastener}
                        castShadow={false}
                        raycast={NOOP_RAYCAST}
                      />
                      <mesh
                        geometry={sharedGeos.rearConduit}
                        material={sharedMats.ribbedConduit}
                        castShadow={false}
                        raycast={NOOP_RAYCAST}
                      />
                      <mesh
                        position={[0, 0.01, -0.22]}
                        geometry={sharedGeos.floorFlange}
                        material={sharedMats.gunmetalAngle}
                        castShadow={false}
                        raycast={NOOP_RAYCAST}
                      />
                    </group>
                  )}
                </group>
              );
            })}

            {/* 5. Two-Tone Bolted Steel End-Plates & Side Service Hardware (Inner Aisle + Outer Ends) */}
            {([-1, 1] as const).map((endSign) => {
              const endX = endSign * (bay.width / 2 + 0.034);
              const lowerCheekOuterX = Math.abs(endX) + 0.04;
              const angleX = endSign * (lowerCheekOuterX + 0.009);
              const sideHatchX = endSign * (lowerCheekOuterX + 0.008);
              const sidePlaqueX = endSign * (lowerCheekOuterX + 0.016);
              const sideBoltX = endSign * (lowerCheekOuterX + 0.019);
              return (
                <group key={`${bay.key}-endplate-${endSign}`}>
                  {/* Main Olive/Sage Side Cheek Cladding (Lower Pedestal, stepped proudest) */}
                  <mesh
                    position={[endX + endSign * 0.006, 0.28, pedCenterZ]}
                    material={sharedMats.oliveCladding}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <boxGeometry args={[0.068, 0.55, pedDepth + 0.04]} />
                  </mesh>
                  {/* Gunmetal L-Angle Perimeter Framing Around Lower Side Cheek (Zero Corner Overlap) */}
                  <mesh
                    position={[angleX, 0.28, pedCenterZ + (pedDepth * 0.5 - 0.005)]}
                    material={sharedMats.gunmetalAngle}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <boxGeometry args={[0.018, 0.542, 0.046]} />
                  </mesh>
                  <mesh
                    position={[angleX, 0.28, pedCenterZ - (pedDepth * 0.5 - 0.005)]}
                    material={sharedMats.gunmetalAngle}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <boxGeometry args={[0.018, 0.542, 0.046]} />
                  </mesh>
                  <mesh
                    position={[angleX, 0.032, pedCenterZ]}
                    material={sharedMats.gunmetalAngle}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <boxGeometry args={[0.018, 0.044, pedDepth - 0.056]} />
                  </mesh>
                  <mesh
                    position={[angleX, 0.532, pedCenterZ]}
                    material={sharedMats.gunmetalAngle}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <boxGeometry args={[0.018, 0.044, pedDepth - 0.056]} />
                  </mesh>

                  {/* Upper Rear Vertical Spine Side Cheek + Gunmetal Rear Angle Strip (Stepped inward `-0.012m`) */}
                  <mesh
                    position={[endX - endSign * 0.006, spineCenterY, spineZ]}
                    material={sharedMats.oliveCladding}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <boxGeometry args={[0.044, spineH - 0.008, 0.232]} />
                  </mesh>
                  <mesh
                    position={[endSign * (Math.abs(endX) + 0.016 + 0.009), spineCenterY, spineZ - 0.105]}
                    material={sharedMats.gunmetalAngle}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <boxGeometry args={[0.018, spineH - 0.016, 0.038]} />
                  </mesh>

                  {/* Sloped Upper Console Cheek (-0.51 rad, recessed clear of panel bezels) + Gunmetal Front Bevel Frame */}
                  <mesh
                    position={[endX + endSign * 0.012, slopeCenterY, slopeCenterZ - 0.058]}
                    rotation={[-0.51, 0, 0]}
                    material={sharedMats.oliveCladding}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <boxGeometry args={[0.044, slopeH - 0.04, 0.28]} />
                  </mesh>
                  <mesh
                    position={[
                      endSign * (Math.abs(endX) + 0.043),
                      slopeCenterY,
                      slopeCenterZ - 0.058 + 0.132,
                    ]}
                    rotation={[-0.51, 0, 0]}
                    material={sharedMats.gunmetalAngle}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <boxGeometry args={[0.016, slopeH - 0.06, 0.032]} />
                  </mesh>
                  {/* Triangular Gusset Filler Panel Closing Any Gap Between Slope & Rear Spine (Recessed) */}
                  <mesh
                    position={[endX - endSign * 0.012, 0.68 * ws, spineZ + 0.26]}
                    material={sharedMats.recessedOlive}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <boxGeometry args={[0.032, 0.48 * ws, 0.34]} />
                  </mesh>

                  {/* Recessed Side Maintenance Access Hatch + Chrome T-Handle + Hinges */}
                  <group position={[sideHatchX, 0.28, pedCenterZ - 0.02]}>
                    <mesh
                      material={sharedMats.recessedOlive}
                      castShadow={false}
                      raycast={NOOP_RAYCAST}
                    >
                      <boxGeometry args={[0.016, 0.32, 0.52]} />
                    </mesh>
                    {/* Door Hinges */}
                    {([-0.1, 0.1] as const).map((hy, hIdx) => (
                      <mesh
                        key={`${bay.key}-sidehinge-${endSign}-${hIdx}`}
                        position={[endSign * 0.01, hy, -0.245]}
                        material={sharedMats.gunmetalAngle}
                        castShadow={false}
                        raycast={NOOP_RAYCAST}
                      >
                        <cylinderGeometry args={[0.008, 0.008, 0.045, 6]} />
                      </mesh>
                    ))}
                    {/* Chrome T-Handle Cam Latch */}
                    <mesh
                      position={[endSign * 0.014, 0, 0.195]}
                      rotation={[0, 0, Math.PI / 2]}
                      geometry={sharedGeos.tHandleStem}
                      material={sharedMats.chromeHardware}
                      castShadow={false}
                      raycast={NOOP_RAYCAST}
                    />
                    <mesh
                      position={[endSign * 0.024, 0, 0.195]}
                      rotation={[0, Math.PI / 2, 0]}
                      geometry={sharedGeos.tHandleBar}
                      material={sharedMats.chromeHardware}
                      castShadow={false}
                      raycast={NOOP_RAYCAST}
                    />
                    {/* Corner Hex Bolts on Side Hatch */}
                    {([-0.13, 0.13] as const).map((by) =>
                      ([-0.22, 0.22] as const).map((bz) => (
                        <mesh
                          key={`${bay.key}-hbolt-${endSign}-${by}-${bz}`}
                          position={[endSign * 0.01, by, bz]}
                          rotation={[0, 0, Math.PI / 2]}
                          geometry={sharedGeos.hexBolt}
                          material={sharedMats.brassFastener}
                          castShadow={false}
                          raycast={NOOP_RAYCAST}
                        />
                      )),
                    )}
                  </group>

                  {/* Stamped Horizontal Cooling Louver Grille on Upper Sloped Side Cheek */}
                  <group
                    position={[
                      endSign * (Math.abs(endX) + 0.04),
                      0.94 * ws,
                      slopeCenterZ - 0.095,
                    ]}
                  >
                    {([-0.12, -0.06, 0, 0.06, 0.12] as const).map((ly, lIdx) => (
                      <mesh
                        key={`${bay.key}-sidelouv-${endSign}-${lIdx}`}
                        position={[0, ly, 0]}
                        rotation={[0, Math.PI / 2, endSign * 0.25]}
                        geometry={sharedGeos.louverSlat}
                        material={sharedMats.louverSlot}
                        scale={[0.82, 1, 1]}
                        castShadow={false}
                        raycast={NOOP_RAYCAST}
                      />
                    ))}
                  </group>

                  {/* Brass/Yellow Soviet Voltage & Inventory Inspection Plate (`GOST / MCR PANEL`) */}
                  <mesh
                    position={[sidePlaqueX, 0.44, pedCenterZ + 0.42]}
                    rotation={[0, (endSign * Math.PI) / 2, 0]}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <planeGeometry args={[0.24, 0.12]} />
                    <meshStandardMaterial
                      map={gostSidePlaqueTex}
                      roughness={0.44}
                      metalness={0.28}
                      polygonOffset
                      polygonOffsetFactor={-2}
                      polygonOffsetUnits={-2}
                    />
                  </mesh>

                  {/* Visible Brass Hex-Bolt Strip Along Side Framing */}
                  {([0.12, 0.44] as const).map((by) =>
                    ([pedCenterZ - pedDepth * 0.47, pedCenterZ + pedDepth * 0.47] as const).map((bz) => (
                      <mesh
                        key={`${bay.key}-bolt-${endSign}-${by}-${bz}`}
                        position={[sideBoltX, by, bz]}
                        rotation={[0, 0, Math.PI / 2]}
                        geometry={sharedGeos.hexBolt}
                        material={sharedMats.brassFastener}
                        castShadow={false}
                        raycast={NOOP_RAYCAST}
                      />
                    )),
                  )}

                  {/* Twin Heavy Ribbed Flexible Armored Steel Cable Conduits Dropping Into Floor Trench */}
                  <group
                    position={[endSign * lowerCheekOuterX, 0, spineZ + 0.14]}
                    rotation={[0, endSign === 1 ? 0 : Math.PI, 0]}
                  >
                    <mesh
                      position={[0.008, 0.26, 0]}
                      rotation={[0, 0, Math.PI / 2]}
                      geometry={sharedGeos.glandCollar}
                      material={sharedMats.brassFastener}
                      castShadow={false}
                      raycast={NOOP_RAYCAST}
                    />
                    <mesh
                      geometry={sharedGeos.sideConduitA}
                      material={sharedMats.ribbedConduit}
                      castShadow={false}
                      raycast={NOOP_RAYCAST}
                    />
                    <mesh
                      position={[0.16, 0.01, -0.03]}
                      geometry={sharedGeos.floorFlange}
                      material={sharedMats.gunmetalAngle}
                      castShadow={false}
                      raycast={NOOP_RAYCAST}
                    />
                  </group>
                  <group
                    position={[endSign * lowerCheekOuterX, 0, spineZ + 0.26]}
                    rotation={[0, endSign === 1 ? 0 : Math.PI, 0]}
                  >
                    <mesh
                      position={[0.008, 0.2, 0]}
                      rotation={[0, 0, Math.PI / 2]}
                      geometry={sharedGeos.glandCollar}
                      material={sharedMats.brassFastener}
                      castShadow={false}
                      raycast={NOOP_RAYCAST}
                    />
                    <mesh
                      geometry={sharedGeos.sideConduitB}
                      material={sharedMats.ribbedConduit}
                      castShadow={false}
                      raycast={NOOP_RAYCAST}
                    />
                    <mesh
                      position={[0.12, 0.01, 0]}
                      geometry={sharedGeos.floorFlange}
                      material={sharedMats.gunmetalAngle}
                      castShadow={false}
                      raycast={NOOP_RAYCAST}
                    />
                  </group>
                </group>
              );
            })}

            {/* 6. Front Recessed Bolted Access Hatch Doors Under Console With Chrome T-Handles & Louvers */}
            {[-bay.width * 0.31, 0, bay.width * 0.31].map((dx, dIdx) => (
              <group
                key={`${bay.key}-hatch-${dIdx}`}
                position={[dx, pedBodyCenterY, frontFaceZ + 0.009]}
              >
                <mesh
                  material={sharedMats.recessedOlive}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                >
                  <boxGeometry args={[bay.width * 0.27, pedBodyH - 0.028, 0.016]} />
                </mesh>
                {([-0.036, 0.0, 0.036] as const).map((ly, lIdx) => (
                  <mesh
                    key={`${bay.key}-flouv-${dIdx}-${lIdx}`}
                    position={[-bay.width * 0.03, ly, 0.009]}
                    geometry={sharedGeos.louverSlat}
                    material={sharedMats.louverSlot}
                    scale={[bay.width * 0.42, 1, 1]}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  />
                ))}
                <mesh
                  position={[bay.width * 0.1, 0, 0.014]}
                  rotation={[Math.PI / 2, 0, 0]}
                  geometry={sharedGeos.tHandleStem}
                  material={sharedMats.chromeHardware}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                />
                <mesh
                  position={[bay.width * 0.1, 0, 0.024]}
                  geometry={sharedGeos.tHandleBar}
                  material={sharedMats.chromeHardware}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                />
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
});

const WALL_RBMK_CELL_PITCH = 0.144;
const WALL_RBMK_CORE_TILES: ReadonlyArray<{ readonly x: number; readonly y: number }> =
  (() => {
    const tiles: Array<{ x: number; y: number }> = [];
    for (let r = -3; r <= 3; r++) {
      for (let c = -3; c <= 3; c++) {
        if (Math.abs(r) + Math.abs(c) > 4) continue;
        tiles.push({
          x: c * WALL_RBMK_CELL_PITCH,
          y: -r * WALL_RBMK_CELL_PITCH,
        });
      }
    }
    return tiles;
  })();

function mergeWallBoxParts(
  parts: ReadonlyArray<{
    size: readonly [number, number, number];
    pos: readonly [number, number, number];
    rotZ?: number;
  }>,
): THREE.BufferGeometry {
  const prepared: THREE.BufferGeometry[] = [];
  const mat = new THREE.Matrix4();
  const euler = new THREE.Euler();
  const quat = new THREE.Quaternion();
  const posVec = new THREE.Vector3();
  const oneScale = new THREE.Vector3(1, 1, 1);

  for (const part of parts) {
    const g = new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2]);
    posVec.set(part.pos[0], part.pos[1], part.pos[2]);
    euler.set(0, 0, part.rotZ ?? 0);
    quat.setFromEuler(euler);
    mat.compose(posVec, quat, oneScale);
    g.applyMatrix4(mat);
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    if (!g.getAttribute("uv")) {
      const count = g.getAttribute("position").count;
      g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    prepared.push(g);
  }

  let totalVerts = 0;
  let totalIndices = 0;
  for (const g of prepared) {
    totalVerts += g.getAttribute("position").count;
    totalIndices += g.index ? g.index.count : g.getAttribute("position").count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;
  for (const g of prepared) {
    const pos = g.getAttribute("position");
    const norm = g.getAttribute("normal");
    const uv = g.getAttribute("uv");
    const count = pos.count;
    for (let i = 0; i < count; i++) {
      const vi = vOffset + i;
      positions[vi * 3] = pos.getX(i);
      positions[vi * 3 + 1] = pos.getY(i);
      positions[vi * 3 + 2] = pos.getZ(i);
      normals[vi * 3] = norm.getX(i);
      normals[vi * 3 + 1] = norm.getY(i);
      normals[vi * 3 + 2] = norm.getZ(i);
      uvs[vi * 2] = uv.getX(i);
      uvs[vi * 2 + 1] = uv.getY(i);
    }
    if (g.index) {
      const idxAttr = g.index;
      for (let i = 0; i < idxAttr.count; i++) {
        indices[iOffset++] = vOffset + idxAttr.getX(i);
      }
    } else {
      for (let i = 0; i < count; i++) {
        indices[iOffset++] = vOffset + i;
      }
    }
    vOffset += count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  merged.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

// Single-cell 4-bar hollow square bezel (0.132m outer, 0.102m inner opening, 0.018m depth)
const WALL_CORE_BEZEL_GEO = mergeWallBoxParts([
  { size: [0.132, 0.015, 0.018], pos: [0, 0.0585, 0] },
  { size: [0.132, 0.015, 0.018], pos: [0, -0.0585, 0] },
  { size: [0.015, 0.102, 0.018], pos: [-0.0585, 0, 0] },
  { size: [0.015, 0.102, 0.018], pos: [0.0585, 0, 0] },
]);

// Single-cell chunky 2-stepped central fuel-cap indicator
const WALL_CORE_CAP_GEO = mergeWallBoxParts([
  { size: [0.086, 0.086, 0.016], pos: [0, 0, 0] },
  { size: [0.062, 0.062, 0.008], pos: [0, 0, 0.012] },
]);

// Static merged inner standby collars (outer 0.100m, bar 0.006m, depth 0.010m)
const WALL_CORE_STANDBY_RINGS_GEO = mergeWallBoxParts(
  WALL_RBMK_CORE_TILES.flatMap((tile) => [
    { size: [0.100, 0.006, 0.010] as const, pos: [tile.x, tile.y + 0.047, 0] as const },
    { size: [0.100, 0.006, 0.010] as const, pos: [tile.x, tile.y - 0.047, 0] as const },
    { size: [0.006, 0.088, 0.010] as const, pos: [tile.x - 0.047, tile.y, 0] as const },
    { size: [0.006, 0.088, 0.010] as const, pos: [tile.x + 0.047, tile.y, 0] as const },
  ]),
);

// Merged 8 perimeter steel clamps around the octagonal reactor shroud
const WALL_CORE_8_CLAMPS_GEO = mergeWallBoxParts(
  Array.from({ length: 8 }, (_, idx) => {
    const ang = (idx / 8) * Math.PI * 2 + Math.PI / 8;
    return {
      size: [0.068, 0.112, 0.036] as const,
      pos: [Math.cos(ang) * 0.635, Math.sin(ang) * 0.635, 0] as const,
      rotZ: ang,
    };
  }),
);

// Pre-allocated module-level colors (zero per-frame allocations)
const _wallColScratch = new THREE.Color();
const _wallAmberLow = new THREE.Color("#ff9d00");
const _wallAmberHigh = new THREE.Color("#ffd24c");
const _wallSelectedHigh = new THREE.Color("#fff08a");
const _wallBorderAmberLow = new THREE.Color("#d96b00");
const _wallBorderAmberHigh = new THREE.Color("#ffd24c");
const _wallHealthyCore = new THREE.Color("#1f6e43");
const _wallActiveCore = new THREE.Color("#72bf2e");
const _wallStandbyCore = new THREE.Color("#541b19");
const _wallBlackoutCore = new THREE.Color("#0e1411");
const _wallCalmBezel = new THREE.Color("#26332e");
const _wallActiveBezel = new THREE.Color("#314238");
const _wallBlackoutBezel = new THREE.Color("#151b18");

function paintWallCoreHeaderBanner(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  spentCount: number,
  isBlackout: boolean,
): void {
  ctx.fillStyle = "#0b120f";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "#8a9890";
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, w - 6, h - 6);

  // Top title band
  ctx.fillStyle = "#15211c";
  ctx.fillRect(8, 8, w - 16, 60);
  ctx.strokeStyle = "#b8a46b";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(8, 8, w - 16, 60);

  ctx.save();
  ctx.font = '900 26px "Kremlin", "Segoe UI Black", "Consolas", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 5;
  const titleText = "RBMK-1000 ACTIVE CORE // FUEL ROD MONITOR";
  ctx.strokeText(titleText, w / 2, 39, w - 36);
  ctx.fillStyle = "#f2ead3";
  ctx.fillText(titleText, w / 2, 39, w - 36);
  ctx.restore();

  // Bottom live status banner
  const barX = 10;
  const barY = 76;
  const barW = w - 20;
  const barH = h - 86;

  if (isBlackout) {
    ctx.fillStyle = "#240c0c";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = "#6b1d1d";
    ctx.lineWidth = 3.5;
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.font = '900 28px "Kremlin", "Segoe UI Black", "Consolas", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#c44d4d";
    ctx.fillText("SYNOPTIC POWER OFF", w / 2, barY + barH / 2 + 1, barW - 24);
    return;
  }

  if (spentCount > 0) {
    ctx.fillStyle = "#ffaa00";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 4;
    ctx.strokeRect(barX + 2, barY + 2, barW - 4, barH - 4);
    ctx.font = '900 28px "Kremlin", "Segoe UI Black", "Consolas", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#120800";
    ctx.fillText(
      `WARNING! REPLACE SPENT RODS: [${spentCount}] (UNIT A-2)`,
      w / 2,
      barY + barH / 2 + 1,
      barW - 28,
    );
  } else {
    ctx.fillStyle = "#0e2e1b";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = "#2ebd59";
    ctx.lineWidth = 3.5;
    ctx.strokeRect(barX + 2, barY + 2, barW - 4, barH - 4);
    ctx.font = '900 28px "Kremlin", "Segoe UI Black", "Consolas", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#39ff6a";
    ctx.fillText("FUEL CHANNELS NOMINAL [37/37]", w / 2, barY + barH / 2 + 1, barW - 28);
  }
}

/**
 * Massive Live-Synced 3D `RBMK CORE` Refuel Status Wall Synoptic Display
 * (ACTIVE CORE SYNOPTIC // FUEL ROD RELOAD) mounted above the Left Console Wing.
 * Maps the exact 37 channels (`[3, 5, 7, 7, 7, 5, 3]`) 1:1 from `useGameStore` at ~10 Hz
 * using 2 instanced meshes, pre-allocated colors, and `NOOP_RAYCAST`.
 */
const SovietRbmkCoreWallSynoptic3D: React.FC = React.memo(() => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  const bezelInstRef = useRef<THREE.InstancedMesh>(null);
  const coreInstRef = useRef<THREE.InstancedMesh>(null);
  const bezelInstMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const coreInstMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const standbyRingsMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const headerMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const leftLegendMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const rightProcMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const lastTickRef = useRef(-1);
  const lastHeaderSpentRef = useRef(-1);
  const lastHeaderBlackoutRef = useRef(false);
  const prevChannelCodesRef = useRef(new Uint8Array(37).fill(255));

  const headerTex = useMemo(
    () =>
      createCrispPanelTexture(1024, 160, (ctx, w, h) => {
        paintWallCoreHeaderBanner(ctx, w, h, 0, false);
      }),
    [],
  );

  const leftLegendTex = useMemo(
    () =>
      createCrispPanelTexture(512, 768, (ctx, w, h) => {
        ctx.fillStyle = "#0e1512";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#8a9890";
        ctx.lineWidth = 8;
        ctx.strokeRect(6, 6, w - 12, h - 12);

        ctx.fillStyle = "#18241e";
        ctx.fillRect(16, 16, w - 32, 102);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 4;
        ctx.strokeRect(16, 16, w - 32, 102);

        ctx.textAlign = "center";
        ctx.fillStyle = "#f2ead3";
        ctx.font = '900 26px "Kremlin", "Segoe UI Black", "Consolas", monospace';
        ctx.fillText("ACTIVE CORE SYNOPTIC", w / 2, 58, w - 48);
        ctx.fillStyle = "#ffb000";
        ctx.font = '900 24px "Kremlin", "Segoe UI Black", "Consolas", monospace';
        ctx.fillText("FUEL ROD RELOAD", w / 2, 100, w - 48);

        const legendItems = [
          {
            swatch: "#1f6e43",
            border: "#39ff6a",
            title: "CHANNELS NOMINAL",
            sub: "STANDARD FUEL ROD",
          },
          {
            swatch: "#72bf2e",
            border: "#a8e64c",
            title: "ACTIVE NEUTRON FLUX",
            sub: "HIGH THERMAL OUTPUT",
          },
          {
            swatch: "#ff9d00",
            border: "#ffd24c",
            title: "REPLACE ROD (AMBER)",
            sub: "PULSING ALARM CHANNEL",
          },
          {
            swatch: "#541b19",
            border: "#8c3530",
            title: "CONSOLE UNIT A-2",
            sub: "ROD INSERTED / STANDBY",
          },
        ] as const;

        legendItems.forEach((item, idx) => {
          const by = 148 + idx * 144;
          ctx.fillStyle = "#121b17";
          ctx.fillRect(22, by, w - 44, 122);
          ctx.strokeStyle = "#3a4c44";
          ctx.lineWidth = 3;
          ctx.strokeRect(22, by, w - 44, 122);

          ctx.fillStyle = item.swatch;
          ctx.fillRect(40, by + 26, 70, 70);
          ctx.strokeStyle = item.border;
          ctx.lineWidth = 4;
          ctx.strokeRect(40, by + 26, 70, 70);

          ctx.textAlign = "left";
          ctx.fillStyle = idx === 2 ? "#ffd24c" : "#e6dec3";
          ctx.font = '900 22px "Kremlin", "Segoe UI Black", "Consolas", monospace';
          ctx.fillText(item.title, 130, by + 54, w - 160);
          ctx.fillStyle = "#9fb3a8";
          ctx.font = 'bold 20px "Kremlin", "Consolas", "Courier Prime", monospace';
          ctx.fillText(item.sub, 130, by + 92, w - 160);
        });
      }),
    [],
  );

  const rightProcTex = useMemo(
    () =>
      createCrispPanelTexture(512, 768, (ctx, w, h) => {
        ctx.fillStyle = "#0e1512";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#8a9890";
        ctx.lineWidth = 8;
        ctx.strokeRect(6, 6, w - 12, h - 12);

        ctx.fillStyle = "#18241e";
        ctx.fillRect(16, 16, w - 32, 102);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 4;
        ctx.strokeRect(16, 16, w - 32, 102);

        ctx.textAlign = "center";
        ctx.fillStyle = "#f2ead3";
        ctx.font = '900 28px "Kremlin", "Segoe UI Black", "Consolas", monospace';
        ctx.fillText("SIUR RELOAD GUIDE", w / 2, 60, w - 48);
        ctx.fillStyle = "#39ff6a";
        ctx.font = 'bold 20px "Kremlin", "Consolas", "Courier Prime", monospace';
        ctx.fillText("37-ROD MATRIX [3-5-7-7-7-5-3]", w / 2, 100, w - 48);

        const steps = [
          { num: "01", text: "1. MATCH ROW & CHANNEL 1:1", color: "#e6dec3" },
          { num: "02", text: "2. CLICK AMBER CHANNEL", sub: "ON CONSOLE UNIT A-2", color: "#ffd24c" },
          { num: "03", text: "3. PULL RELOAD LEVER", sub: "DOWN FULL STROKE", color: "#39ff6a" },
        ] as const;

        steps.forEach((step, idx) => {
          const sy = 152 + idx * 158;
          ctx.fillStyle = "#121c17";
          ctx.fillRect(22, sy, w - 44, 134);
          ctx.strokeStyle = idx === 1 ? "#ffb000" : "#40544b";
          ctx.lineWidth = 3.5;
          ctx.strokeRect(22, sy, w - 44, 134);

          ctx.fillStyle = "#1d2b24";
          ctx.fillRect(36, sy + 24, 68, 86);
          ctx.strokeStyle = "#b8a46b";
          ctx.lineWidth = 3;
          ctx.strokeRect(36, sy + 24, 68, 86);

          ctx.textAlign = "center";
          ctx.fillStyle = step.color;
          ctx.font = '900 30px "Kremlin", "Consolas", monospace';
          ctx.fillText(step.num, 70, sy + 78, 56);

          ctx.textAlign = "left";
          ctx.fillStyle = step.color;
          ctx.font = '900 21px "Kremlin", "Segoe UI Black", "Consolas", monospace';
          ctx.fillText(step.text, 122, sy + 56, w - 152);
          if ("sub" in step && step.sub) {
            ctx.fillStyle = "#c8d4cc";
            ctx.font = 'bold 20px "Kremlin", "Consolas", "Courier Prime", monospace';
            ctx.fillText(step.sub, 122, sy + 96, w - 152);
          }
        });

        ctx.fillStyle = "#18241e";
        ctx.fillRect(22, 636, w - 44, 98);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 3;
        ctx.strokeRect(22, 636, w - 44, 98);
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffb000";
        ctx.font = '900 22px "Kremlin", "Segoe UI Black", "Consolas", monospace';
        ctx.fillText("SECTOR 84 // RBMK-1000", w / 2, 676, w - 64);
        ctx.fillStyle = "#9fb3a8";
        ctx.font = 'bold 19px "Kremlin", "Consolas", "Courier Prime", monospace';
        ctx.fillText("37-ROD MATRIX [3-5-7-7-7-5-3]", w / 2, 712, w - 64);
      }),
    [],
  );

  useEffect(() => {
    const bezelInst = bezelInstRef.current;
    const coreInst = coreInstRef.current;
    if (!bezelInst || !coreInst) return;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < WALL_RBMK_CORE_TILES.length; i++) {
      const tile = WALL_RBMK_CORE_TILES[i];
      dummy.position.set(tile.x, tile.y, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bezelInst.setMatrixAt(i, dummy.matrix);
      coreInst.setMatrixAt(i, dummy.matrix);
      bezelInst.setColorAt(i, _wallCalmBezel);
      coreInst.setColorAt(i, _wallStandbyCore);
    }
    bezelInst.instanceMatrix.needsUpdate = true;
    coreInst.instanceMatrix.needsUpdate = true;
    if (bezelInst.instanceColor) bezelInst.instanceColor.needsUpdate = true;
    if (coreInst.instanceColor) coreInst.instanceColor.needsUpdate = true;
  }, []);

  useEffect(() => {
    const unsubFont = onKremlinFontReady(() => {
      lastHeaderSpentRef.current = -999;
    });
    return () => {
      unsubFont();
      headerTex.dispose();
      leftLegendTex.dispose();
      rightProcTex.dispose();
    };
  }, [headerTex, leftLegendTex, rightProcTex]);

  useFrame(({ clock }) => {
    const s = useGameStore.getState();
    const z3Power =
      s.lobbyMenuPhase !== "entered_control_room"
        ? 0.14
        : THREE.MathUtils.lerp(0.14, 1.0, controlRoomPowerState.zone3);
    if (headerMatRef.current) {
      headerMatRef.current.color.lerpColors(
        SCENE_COLOR_CRT_STANDBY_TINT,
        SCENE_COLOR_WHITE,
        z3Power,
      );
    }
    if (leftLegendMatRef.current) {
      leftLegendMatRef.current.color.lerpColors(
        SCENE_COLOR_CRT_STANDBY_TINT,
        SCENE_COLOR_WHITE,
        z3Power,
      );
    }
    if (rightProcMatRef.current) {
      rightProcMatRef.current.color.lerpColors(
        SCENE_COLOR_CRT_STANDBY_TINT,
        SCENE_COLOR_WHITE,
        z3Power,
      );
    }
    if (bezelInstMatRef.current) {
      bezelInstMatRef.current.color.setRGB(z3Power, z3Power, z3Power);
    }
    if (coreInstMatRef.current) {
      coreInstMatRef.current.color.setRGB(z3Power, z3Power, z3Power);
    }
    if (standbyRingsMatRef.current) {
      standbyRingsMatRef.current.color.setRGB(
        0.27 * z3Power,
        0.098 * z3Power,
        0.09 * z3Power,
      );
    }

    const t = clock.getElapsedTime();
    if (lastTickRef.current >= 0 && t - lastTickRef.current < 0.095) return;
    lastTickRef.current = t;

    const bezelInst = bezelInstRef.current;
    const coreInst = coreInstRef.current;
    if (!bezelInst || !coreInst) return;

    const activeRodCount = Math.round(s.controlRods * WALL_RBMK_CORE_TILES.length);
    const isHighReactivity = s.controlRods > 0.85;
    const prevCodes = prevChannelCodesRef.current;

    let spentCount = 0;
    let anyStaticChanged = false;

    for (let i = 0; i < WALL_RBMK_CORE_TILES.length; i++) {
      const isSpent =
        s.channelHotspots[i] === "amber" ||
        s.coreTileAnomalies?.[i] === "spent";

      if (s.isBlackout) {
        if (isSpent) spentCount += 1;
        if (prevCodes[i] !== 0) {
          prevCodes[i] = 0;
          anyStaticChanged = true;
          bezelInst.setColorAt(i, _wallBlackoutBezel);
          coreInst.setColorAt(i, _wallBlackoutCore);
        }
        continue;
      }

      if (isSpent) {
        spentCount += 1;
        prevCodes[i] = 4;
        const isSelected = s.selectedRefuelChannel === i;
        const pulse = 0.5 + 0.5 * Math.sin(t * (isSelected ? 12.0 : 7.2) + i * 0.45);
        _wallColScratch.lerpColors(
          _wallAmberLow,
          isSelected ? _wallSelectedHigh : _wallAmberHigh,
          pulse,
        );
        coreInst.setColorAt(i, _wallColScratch);

        _wallColScratch.lerpColors(_wallBorderAmberLow, _wallBorderAmberHigh, pulse);
        bezelInst.setColorAt(i, _wallColScratch);
        continue;
      }

      const flux = s.rodTilesFlux[i] ?? 0;
      const isWithdrawn = flux > 0.1 || i < activeRodCount;
      const isActiveWarn = isWithdrawn && (isHighReactivity || flux > 0.58);
      const nextCode = !isWithdrawn ? 1 : isActiveWarn ? 3 : 2;

      if (prevCodes[i] !== nextCode) {
        prevCodes[i] = nextCode;
        anyStaticChanged = true;
        if (nextCode === 1) {
          bezelInst.setColorAt(i, _wallCalmBezel);
          coreInst.setColorAt(i, _wallStandbyCore);
        } else if (nextCode === 3) {
          bezelInst.setColorAt(i, _wallActiveBezel);
          coreInst.setColorAt(i, _wallActiveCore);
        } else {
          bezelInst.setColorAt(i, _wallCalmBezel);
          coreInst.setColorAt(i, _wallHealthyCore);
        }
      }
    }

    if (spentCount > 0 || anyStaticChanged) {
      if (bezelInst.instanceColor) bezelInst.instanceColor.needsUpdate = true;
      if (coreInst.instanceColor) coreInst.instanceColor.needsUpdate = true;
    }

    if (
      spentCount !== lastHeaderSpentRef.current ||
      s.isBlackout !== lastHeaderBlackoutRef.current
    ) {
      const tex = headerMatRef.current?.map as THREE.CanvasTexture | undefined;
      if (tex) {
        lastHeaderSpentRef.current = spentCount;
        lastHeaderBlackoutRef.current = s.isBlackout;
        const canvas = tex.image as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          paintWallCoreHeaderBanner(ctx, canvas.width, canvas.height, spentCount, s.isBlackout);
          tex.needsUpdate = true;
        }
      }
    }
  });

  return (
    <group position={[0.08, 2.86, 0.22]}>
      {/* Main Olive-Steel Recessed Enclosure (`3.06m x 1.88m x 0.07m`, front deck at z = 0.070m) */}
      <mesh position={[0, 0, 0.035]} castShadow={false} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[3.06, 1.88, 0.07]} />
        <meshStandardMaterial
          color="#2c3c35"
          metalness={0.56}
          roughness={0.48}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.007}
        />
      </mesh>

      {/* Beveled Gunmetal Perimeter Frame Rails (front face at z = 0.105m) */}
      <mesh position={[0, 0.905, 0.068]} castShadow={false} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[3.10, 0.075, 0.074]} />
        <meshStandardMaterial color="#1d2522" metalness={0.68} roughness={0.42} />
      </mesh>
      <mesh position={[0, -0.905, 0.068]} castShadow={false} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[3.10, 0.075, 0.074]} />
        <meshStandardMaterial color="#1d2522" metalness={0.68} roughness={0.42} />
      </mesh>
      {([-1.505, 1.505] as const).map((rx, rIdx) => (
        <mesh key={`wall-core-vrail-${rIdx}`} position={[rx, 0, 0.068]} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.075, 1.88, 0.074]} />
          <meshStandardMaterial color="#1d2522" metalness={0.68} roughness={0.42} />
        </mesh>
      ))}

      {/* Horizontal Mid-Divider Rail Below Header */}
      <mesh position={[0, 0.43, 0.078]} castShadow={false} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[2.94, 0.038, 0.028]} />
        <meshStandardMaterial color="#1a221f" metalness={0.68} roughness={0.44} />
      </mesh>

      {/* 4 Corner Gusset Plates & Brass Hex Bolts */}
      {(
        [
          [-1.44, 0.84],
          [1.44, 0.84],
          [-1.44, -0.84],
          [1.44, -0.84],
        ] as const
      ).map(([gx, gy], gIdx) => (
        <group key={`wall-core-gusset-${gIdx}`} position={[gx, gy, 0.095]}>
          <mesh castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.14, 0.14, 0.018]} />
            <meshStandardMaterial
              color="#171e1b"
              metalness={0.72}
              roughness={0.4}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
          <mesh position={[0, 0, 0.014]} rotation={[Math.PI / 2, 0, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.018, 0.018, 0.014, 6]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.86}
              roughness={0.28}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
        </group>
      ))}

      {/* Top Status Header & Live Refuel Alert Counter (`y = +0.655m`) */}
      <group position={[0, 0.655, 0]}>
        <mesh position={[0, 0, 0.072]} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.88, 0.38, 0.012]} />
          <meshStandardMaterial color="#141a17" metalness={0.68} roughness={0.44} />
        </mesh>
        <mesh position={[0, 0, 0.098]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[2.84, 0.35]} />
          <meshBasicMaterial
            ref={headerMatRef}
            map={headerTex}
            color="#324a3a"
            toneMapped={false}
            fog={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>

      {/* Horizontal 3D Mimic Busbar Pipes Linking Sub-Plates to Octagonal Shroud */}
      {([-0.59, 0.59] as const).map((bx, bIdx) => (
        <mesh key={`wall-core-bus-${bIdx}`} position={[bx, -0.23, 0.082]} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.38, 0.032, 0.022]} />
          <meshStandardMaterial color="#b89838" metalness={0.62} roughness={0.38} />
        </mesh>
      ))}

      {/* Left Legend & Right Procedure Sub-Plates (`x = ±1.05m, y = -0.23m`) */}
      <group position={[-1.05, -0.23, 0]}>
        <mesh position={[0, 0, 0.072]} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.74, 1.12, 0.012]} />
          <meshStandardMaterial color="#18201d" metalness={0.65} roughness={0.44} />
        </mesh>
        <mesh position={[0, 0, 0.094]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.70, 1.06]} />
          <meshBasicMaterial
            ref={leftLegendMatRef}
            map={leftLegendTex}
            color="#324a3a"
            toneMapped={false}
            fog={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>
      <group position={[1.05, -0.23, 0]}>
        <mesh position={[0, 0, 0.072]} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.74, 1.12, 0.012]} />
          <meshStandardMaterial color="#18201d" metalness={0.65} roughness={0.44} />
        </mesh>
        <mesh position={[0, 0, 0.094]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.70, 1.06]} />
          <meshBasicMaterial
            ref={rightProcMatRef}
            map={rightProcTex}
            color="#324a3a"
            toneMapped={false}
            fog={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>

      {/* Central Octagonal Inner Core Shroud & 37 Live-Synced Channels (`x = 0, y = -0.23m`) */}
      <group position={[0, -0.23, 0]}>
        {/* Recessed Octagonal Gunmetal Reactor Pit Flange */}
        <mesh
          position={[0, 0, 0.082]}
          rotation={[Math.PI / 2, Math.PI / 8, 0]}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <cylinderGeometry args={[0.615, 0.645, 0.044, 8]} />
          <meshStandardMaterial
            color="#222629"
            roughness={0.44}
            metalness={0.72}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        {/* Raised Inner Octagonal Torus Rim */}
        <mesh
          position={[0, 0, 0.104]}
          rotation={[0, 0, Math.PI / 8]}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <torusGeometry args={[0.568, 0.022, 8, 8]} />
          <meshStandardMaterial
            color="#2f373a"
            metalness={0.76}
            roughness={0.38}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>
        {/* Merged 8 Steel Clamps */}
        <mesh
          position={[0, 0, 0.108]}
          geometry={WALL_CORE_8_CLAMPS_GEO}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <meshStandardMaterial color="#8a929a" roughness={0.34} metalness={0.85} />
        </mesh>
        {/* Dark Graphite Core Pit Floor (`front face at z = 0.088m`) */}
        <mesh
          position={[0, 0, 0.082]}
          rotation={[Math.PI / 2, Math.PI / 8, 0]}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <cylinderGeometry args={[0.555, 0.555, 0.012, 8]} />
          <meshStandardMaterial color="#0b0d0e" roughness={0.9} metalness={0.15} />
        </mesh>
        {/* Static Muted Oxide-Red Standby Collar Rings */}
        <mesh
          position={[0, 0, 0.099]}
          geometry={WALL_CORE_STANDBY_RINGS_GEO}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <meshBasicMaterial
            ref={standbyRingsMatRef}
            color="#451917"
            toneMapped={false}
            fog={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>

        {/* InstancedMesh #1: 37 Illuminated Channel Bezels (front face at z = 0.110m) */}
        <instancedMesh
          ref={bezelInstRef}
          position={[0, 0, 0.101]}
          args={[WALL_CORE_BEZEL_GEO, undefined, 37]}
          frustumCulled={false}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <meshBasicMaterial
            ref={bezelInstMatRef}
            color="#242424"
            toneMapped={false}
            fog={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </instancedMesh>

        {/* InstancedMesh #2: 37 Chunky Stepped Central Fuel-Cap Indicators (front at z = 0.127..0.135m) */}
        <instancedMesh
          ref={coreInstRef}
          position={[0, 0, 0.119]}
          args={[WALL_CORE_CAP_GEO, undefined, 37]}
          frustumCulled={false}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <meshBasicMaterial
            ref={coreInstMatRef}
            color="#242424"
            toneMapped={false}
            fog={false}
          />
        </instancedMesh>
      </group>
    </group>
  );
});

// Pre-merged side louver & bolt geometry for the Right Wing K.O.M.R.A.D.-84 Wall Comms Terminal
const WALL_KOMRAD_LOUVERS_GEO = mergeWallBoxParts([
  ...[-1, 1].flatMap((sideSign) =>
    [-0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45].map((ly) => ({
      pos: [sideSign * 1.475, ly, 0.124] as [number, number, number],
      size: [0.12, 0.042, 0.036] as [number, number, number],
      rot: [0.38, 0, 0] as [number, number, number],
    })),
  ),
]);

const WALL_KOMRAD_BOLTS_GEO = mergeWallBoxParts([
  ...[-1.51, -0.82, 0, 0.82, 1.51].flatMap((bx) =>
    [-0.59, 0.59].map((by) => ({
      pos: [bx, by, 0.126] as [number, number, number],
      size: [0.036, 0.036, 0.024] as [number, number, number],
    })),
  ),
]);

const WALL_KOMRAD_SPEAKER_SLOTS_GEO = mergeWallBoxParts([
  ...[-0.46, -0.34].flatMap((sx) =>
    [-0.025, 0, 0.025].map((sy) => ({
      pos: [sx, sy, 0.068] as [number, number, number],
      size: [0.18, 0.012, 0.014] as [number, number, number],
    })),
  ),
  ...[0.34, 0.46].flatMap((sx) =>
    [-0.025, 0, 0.025].map((sy) => ({
      pos: [sx, sy, 0.068] as [number, number, number],
      size: [0.18, 0.012, 0.014] as [number, number, number],
    })),
  ),
]);

export type KomradPortraitPose = "idle" | "scan" | "blink" | "talk1" | "talk2";

type KomradPixelPalette = readonly [
  readonly [number, number, number], // 0: Deep CRT Void
  readonly [number, number, number], // 1: Dark Shadow
  readonly [number, number, number], // 2: Deep Midtone
  readonly [number, number, number], // 3: Sculpted Midtone
  readonly [number, number, number], // 4: Lit Plane
  readonly [number, number, number], // 5: Bright Phosphor
  readonly [number, number, number], // 6: Specular Glint
  readonly [number, number, number], // 7: Soviet Cockade / Ribbon Accent
];

const KOMRAD_PORTRAIT_PALETTES: Record<KomradMood, KomradPixelPalette> = {
  normal: [
    [3, 10, 5],
    [8, 32, 17],
    [16, 66, 35],
    [28, 114, 59],
    [46, 176, 91],
    [78, 255, 134],
    [214, 255, 228],
    [255, 62, 48],
  ],
  warning: [
    [12, 7, 2],
    [38, 21, 3],
    [79, 46, 7],
    [136, 82, 13],
    [198, 126, 24],
    [255, 184, 51],
    [255, 240, 194],
    [255, 72, 42],
  ],
  critical: [
    [16, 3, 3],
    [46, 7, 7],
    [92, 16, 16],
    [153, 27, 24],
    [212, 46, 36],
    [255, 92, 68],
    [255, 224, 192],
    [255, 214, 74],
  ],
};

function bakeKomradPortraitCanvas(
  mood: KomradMood,
  pose: KomradPortraitPose,
): HTMLCanvasElement {
  const W = 104;
  const H = 120;
  const CX = 52;
  const jawDrop = pose === "talk2" ? 4 : pose === "talk1" ? 2 : 0;

  const buf = new Uint8Array(W * H);

  const bayer2x2 = (x: number, y: number): number => {
    const bitY = y & 1;
    const bitX = x & 1;
    const threshold = bitY === 0 ? (bitX === 0 ? 0 : 2) : bitX === 0 ? 3 : 1;
    return (threshold + 0.5) / 4;
  };

  const setPx = (x: number, y: number, c: number) => {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= W || iy < 0 || iy >= H) return;
    buf[iy * W + ix] = c;
  };

  const ditherPx = (x: number, y: number, tone: number) => {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= W || iy < 0 || iy >= H) return;
    const clamped = Math.max(0, Math.min(6, tone));
    const lo = Math.floor(clamped);
    const hi = Math.min(6, lo + 1);
    const frac = clamped - lo;
    buf[iy * W + ix] = frac > bayer2x2(ix, iy) ? hi : lo;
  };

  const drawSegment = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    radius: number,
    shader: (x: number, y: number, dist: number, tAlong: number) => number,
  ) => {
    const minX = Math.max(0, Math.floor(Math.min(x0, x1) - radius - 1));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + radius + 1));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1) - radius - 1));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + radius + 1));
    const dx = x1 - x0;
    const dy = y1 - y0;
    const lenSq = dx * dx + dy * dy || 1;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / lenSq));
        const px = x0 + t * dx;
        const py = y0 + t * dy;
        const d = Math.hypot(x - px, y - py);
        if (d <= radius) {
          ditherPx(x, y, shader(x, y, d / radius, t));
        }
      }
    }
  };

  // LAYER 1: Subtle Atmospheric CRT Backdrop & Soviet Sunburst Watermark
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - CX) / 54;
      const dy = (y - 60) / 62;
      const rad = Math.hypot(dx, dy);
      let tone = Math.max(0, 1.15 - rad * 1.1);
      const angle = Math.atan2(y - 62, x - CX);
      if (Math.abs(Math.sin(angle * 8)) < 0.08 && rad > 0.35 && rad < 0.96) {
        tone = Math.max(tone, 0.82);
      }
      if (Math.abs(rad - 0.72) < 0.018 || Math.abs(rad - 0.91) < 0.016) {
        tone = Math.max(tone, 1.05);
      }
      if ((x === 3 || x === W - 4) && y >= 3 && y <= 11) tone = 2.0;
      if ((y === 3 || y === H - 4) && (x <= 10 || x >= W - 11)) tone = 2.0;
      ditherPx(x, y, tone);
    }
  }

  // LAYER 2: Structured Officer Greatcoat Shoulders, Collar Tabs & Shoulder Boards
  for (let y = 78; y < H; y++) {
    const ny = (y - 78) / (H - 78);
    const halfW = Math.min(45, 22 + Math.pow(ny, 0.56) * 26);
    const shoulderArch = ny < 0.32 ? (0.32 - ny) * 10 : 0;
    for (let x = Math.ceil(CX - halfW); x <= Math.floor(CX + halfW); x++) {
      if (y < 84 + shoulderArch && Math.abs(x - CX) > 25) continue;
      const nx = (x - CX) / halfW;
      let tone = 2.65 - nx * 0.85 - ny * 0.45;
      const fold = Math.sin((x - CX) * 0.36 + ny * 1.6) * 0.38;
      tone += fold;
      if (Math.abs(Math.abs(x - CX) - halfW) < 1.3) {
        tone = nx < 0 ? 4.4 : 2.2;
      }
      ditherPx(x, y, tone);
    }
  }

  // Fringed Officer Shoulder Boards (Epaulettes)
  for (const sSign of [-1, 1] as const) {
    const xStart = sSign < 0 ? 11 : 73;
    const xEnd = sSign < 0 ? 31 : 93;
    for (let y = 85; y <= 93; y++) {
      for (let x = xStart; x <= xEnd; x++) {
        const slopeDrop = sSign < 0 ? (31 - x) * 0.14 : (x - 73) * 0.14;
        if (y < 85 + slopeDrop || y > 91 + slopeDrop) continue;
        const isRim =
          y <= 86 + slopeDrop ||
          y >= 90 + slopeDrop ||
          x === xStart ||
          x === xEnd;
        let tone = isRim ? 4.7 : 2.3;
        if (isRim && sSign > 0) tone -= 0.7;
        ditherPx(x, y, tone);
      }
    }
    const outerX = sSign < 0 ? 10 : 94;
    for (let fy = 87; fy <= 94; fy += 2) setPx(outerX, fy, sSign < 0 ? 5 : 4);
    const starCx = sSign < 0 ? 21 : 83;
    setPx(starCx, 88, 6);
    setPx(starCx - 1, 89, 5);
    setPx(starCx + 1, 89, 5);
    setPx(starCx, 90, 5);
    setPx(sSign < 0 ? 27 : 77, 89, 6);
  }

  // Stiff Officer Collar, Neck Conduits & Rhomboid Collar Tabs
  for (let y = 76; y <= 95; y++) {
    const colHalf = 19 - Math.max(0, y - 82) * 0.4;
    for (let x = Math.round(CX - colHalf); x <= Math.round(CX + colHalf); x++) {
      const dC = Math.abs(x - CX);
      if (dC < 11) {
        const ribbed = y % 3 === 0 ? 1.0 : 2.2 - (x - CX) * 0.08;
        ditherPx(x, y, ribbed);
      } else {
        const isPiping = y <= 78 || y >= 94 || Math.abs(dC - colHalf) < 1.3;
        ditherPx(x, y, isPiping ? 4.8 : x < CX ? 3.2 : 2.4);
      }
    }
  }
  for (let i = 0; i < 16; i++) {
    setPx(CX - 14 + i * 0.65, 81 + i, 5);
    setPx(CX + 14 - i * 0.65, 81 + i, 4);
    setPx(CX, 95 + i * 1.4, i % 3 === 0 ? 4 : 2);
  }
  for (const cSign of [-1, 1] as const) {
    const tx = CX + cSign * 14;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        setPx(tx + dx, 87 + dy, Math.abs(dx) === 2 ? 5 : 2);
      }
    }
    setPx(tx, 87, 7);
    setPx(tx, 86, 6);
  }

  // Double-Breasted Brass Tunic Buttons
  for (const by of [99, 107, 115]) {
    setPx(CX - 7, by, 5);
    setPx(CX - 6, by, 6);
    setPx(CX - 7, by + 1, 3);
    setPx(CX + 7, by, 4);
    setPx(CX + 8, by, 5);
    setPx(CX + 7, by + 1, 2);
  }

  // Chest Medals: Left Hero of Socialist Labor Gold Star + Striped Ribbon Bars
  for (let ry = 98; ry <= 101; ry++) {
    for (let rx = 25; rx <= 33; rx++) {
      setPx(rx, ry, rx === 25 || rx === 33 ? 5 : 7);
    }
  }
  const starPts: readonly [number, number, number][] = [
    [29, 102, 6],
    [28, 104, 5], [29, 104, 6], [30, 104, 5],
    [25, 105, 5], [26, 105, 6], [27, 105, 6], [28, 105, 6], [29, 105, 6], [30, 105, 5], [31, 105, 5], [32, 105, 4], [33, 105, 4],
    [27, 106, 5], [28, 106, 6], [29, 106, 6], [30, 106, 5], [31, 106, 4],
    [27, 107, 5], [28, 107, 5], [30, 107, 4], [31, 107, 4],
    [26, 108, 4], [32, 108, 4],
  ];
  for (const [sx, sy, sc] of starPts) setPx(sx, sy, sc);

  for (let row = 0; row < 2; row++) {
    const ry = 111 + row * 3;
    for (let bar = 0; bar < 3; bar++) {
      const bx = 21 + bar * 6;
      const barTone = (row + bar) % 2 === 0 ? 7 : 5;
      for (let x = bx; x < bx + 5; x++) {
        setPx(x, ry, x === bx + 2 ? 6 : barTone);
        setPx(x, ry + 1, x === bx + 2 ? 3 : Math.max(2, barTone - 2));
      }
    }
  }

  // Right Chest Enamel Atomic Cog / Order of the Red Banner Badge
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= 5.2 && d >= 3.2) {
        setPx(72 + dx, 106 + dy, dx < 0 ? 5 : 4);
      } else if (d < 3.2) {
        setPx(72 + dx, 106 + dy, d < 1.6 ? 6 : 7);
      }
    }
  }

  // LAYER 3: Curved Ribbed USSR Telemetry Cables (Ear Pods -> Coat Sockets)
  const drawTelemetryCable = (sideSign: -1 | 1) => {
    const p0x = CX + sideSign * 31;
    const p0y = 57;
    const p1x = CX + sideSign * 36;
    const p1y = 75;
    const p2x = CX + sideSign * 26;
    const p2y = 93;
    const steps = 22;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const x0 =
        (1 - t0) * (1 - t0) * p0x +
        2 * (1 - t0) * t0 * p1x +
        t0 * t0 * p2x;
      const y0 =
        (1 - t0) * (1 - t0) * p0y +
        2 * (1 - t0) * t0 * p1y +
        t0 * t0 * p2y;
      const x1 =
        (1 - t1) * (1 - t1) * p0x +
        2 * (1 - t1) * t1 * p1x +
        t1 * t1 * p2x;
      const y1 =
        (1 - t1) * (1 - t1) * p0y +
        2 * (1 - t1) * t1 * p1y +
        t1 * t1 * p2y;
      const ribBright = i % 2 === 0;
      drawSegment(x0, y0, x1, y1, 3.1, (px, _py, dist) => {
        if (dist >= 0.78) return 0.7;
        const edgeLight = px < (p0x + p2x) / 2 ? 0.65 : -0.35;
        return (ribBright ? 4.4 : 2.1) + edgeLight - dist * 1.1;
      });
    }
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        setPx(p2x + dx, p2y + dy, dy === -2 ? 5 : Math.abs(dx) === 3 ? 4 : 2);
      }
    }
  };
  drawTelemetryCable(-1);
  drawTelemetryCable(1);

  // LAYER 4: Bolted Ear Transceiver Pods + Aerial Pins
  for (const eSign of [-1, 1] as const) {
    const ex0 = eSign < 0 ? 20 : 78;
    const ex1 = eSign < 0 ? 26 : 84;
    for (let ay = 39; ay <= 47; ay++) {
      setPx(eSign < 0 ? 22 : 82, ay, ay === 39 ? 6 : 4);
    }
    for (let ey = 47; ey <= 63; ey++) {
      for (let ex = ex0; ex <= ex1; ex++) {
        const border = ex === ex0 || ex === ex1 || ey === 47 || ey === 63;
        const grille = ey === 53 || ey === 56 || ey === 59;
        const tone = border ? (eSign < 0 ? 4.4 : 3.4) : grille ? 0.8 : 2.3;
        ditherPx(ex, ey, tone);
      }
    }
    setPx(eSign < 0 ? 22 : 81, 49, 7);
    setPx(eSign < 0 ? 22 : 81, 50, 6);
  }

  // LAYER 5: Sculpted Cybernetic Skull, Cheekbones, Nose, Nasolabial Folds & Hinged Jaw
  for (let y = 36; y <= 84 + jawDrop; y++) {
    let halfW = 26;
    if (y < 46) {
      halfW = 26;
    } else if (y < 60) {
      halfW = 26 - (y - 46) * 0.14;
    } else if (y < 76 + jawDrop) {
      halfW = 24 - ((y - 60) / (16 + jawDrop)) * 6;
    } else {
      halfW = Math.max(8, 18 - (y - (76 + jawDrop)) * 1.45);
    }

    for (let x = Math.ceil(CX - halfW); x <= Math.floor(CX + halfW); x++) {
      const dxNorm = (x - CX) / 26;
      const distEdge = halfW - Math.abs(x - CX);
      let tone = 3.2 - dxNorm * 1.15;

      // Cast curved cap-visor shadow across upper brow
      const visorShadowBottom = 42.5 - Math.abs(dxNorm) * 2.4;
      if (y < visorShadowBottom) {
        tone = Math.max(0.3, tone - 2.35 * (1 - (y - 36) / 7));
      }

      // Chiseled high cheekbones
      const lCheek = Math.hypot((x - 36) / 6.5, (y - 56) / 4.2);
      const rCheek = Math.hypot((x - 68) / 6.5, (y - 56) / 4.2);
      if (lCheek < 1.0) tone += (1 - lCheek) * 1.45;
      if (rCheek < 1.0) tone += (1 - rCheek) * 0.9;

      // Gaunt hollowed cheeks
      const lHollow = Math.hypot((x - 36) / 5.5, (y - 65) / 5.2);
      const rHollow = Math.hypot((x - 68) / 5.5, (y - 65) / 5.2);
      if (lHollow < 1.0) tone -= (1 - lHollow) * 1.15;
      if (rHollow < 1.0) tone -= (1 - rHollow) * 1.3;

      const chinDist = Math.hypot((x - CX) / 7, (y - (79 + jawDrop)) / 4.5);
      if (chinDist < 1.0) tone += (1 - chinDist) * 1.2;

      if (distEdge < 1.5 && y > 50) {
        tone = dxNorm < 0 ? 4.6 : 1.9;
      }

      ditherPx(x, y, tone);
    }
  }

  // Deep Nasolabial Folds + Metallic Temple/Jaw Seams & Rivets
  for (const sSign of [-1, 1] as const) {
    for (let i = 0; i < 11; i++) {
      setPx(CX + sSign * (7 + i * 0.48), 58 + i * 1.1, sSign < 0 ? 2 : 1);
      setPx(CX + sSign * (6 + i * 0.48), 58 + i * 1.1, sSign < 0 ? 4 : 3);
    }
    for (let sy = 44; sy <= 55; sy++) {
      setPx(CX + sSign * 22, sy, 1);
      setPx(CX + sSign * 21, sy, sSign < 0 ? 4 : 3);
    }
    if (jawDrop > 0) {
      for (let py = 69; py <= 73 + jawDrop; py++) {
        setPx(CX + sSign * 16, py, py % 2 === 0 ? 5 : 2);
      }
    }
    setPx(CX + sSign * 22, 46, 6);
    setPx(CX + sSign * 16, 72 + Math.floor(jawDrop / 2), 6);
  }

  // Sculpted Nose Bridge, Tip Highlight & Nostrils
  for (let y = 46; y <= 60; y++) {
    const halfN = y < 56 ? 2.6 : 4.2;
    for (let x = Math.round(CX - halfN); x <= Math.round(CX + halfN); x++) {
      const dx = x - CX;
      let nTone = dx <= 0 ? 4.4 : 2.3;
      if (dx === 0 && y >= 48 && y <= 58) nTone = 5.1;
      if (y === 58 && Math.abs(dx) <= 1) nTone = 5.6;
      if (y === 59 && Math.abs(dx) <= 2) nTone = 4.6;
      ditherPx(x, y, nTone);
    }
  }
  setPx(48, 60, 0);
  setPx(49, 60, 1);
  setPx(55, 60, 0);
  setPx(56, 60, 1);

  // LAYER 6: Bionic CRT Aperture Optic Eyes & Expressive Heavy Brows
  const eyeCenterY = 50;
  for (const eyeIdx of [0, 1] as const) {
    const eSign = eyeIdx === 0 ? -1 : 1;
    const ex = CX + eSign * 12;

    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -7; dx <= 7; dx++) {
        const isLowerBevel = dy === 5;
        const isSideWall = Math.abs(dx) === 7;
        setPx(
          ex + dx,
          eyeCenterY + dy,
          isLowerBevel ? (eSign < 0 ? 4 : 3) : isSideWall ? 2 : 0,
        );
      }
    }

    if (pose === "blink") {
      for (let dy = -4; dy <= 3; dy++) {
        for (let dx = -6; dx <= 6; dx++) {
          setPx(ex + dx, eyeCenterY + dy, dy === 0 ? 5 : dy === -2 ? 3 : 2);
        }
      }
    } else {
      const gazeShiftX = pose === "scan" ? 2 : 0;
      const apHalfH = mood === "warning" ? 2.1 : mood === "critical" ? 4.1 : 3.4;
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -6; dx <= 6; dx++) {
          if (Math.abs(dy) > apHalfH) continue;
          const distPupil = Math.hypot((dx - gazeShiftX) / 3.8, dy / 3.3);
          if (distPupil <= 0.36) {
            setPx(ex + dx, eyeCenterY + dy, 0);
          } else if (distPupil <= 0.78) {
            setPx(ex + dx, eyeCenterY + dy, 5);
          } else if (distPupil <= 1.05) {
            setPx(ex + dx, eyeCenterY + dy, 3);
          }
        }
      }
      setPx(ex - 1 + gazeShiftX, eyeCenterY - 1, 6);
      if (mood === "critical") {
        setPx(ex - 5, eyeCenterY, 5);
        setPx(ex + 5, eyeCenterY, 5);
      }
    }

    for (let dx = -8; dx <= 8; dx++) {
      const t = (dx + 8) / 16;
      const fromInner = eSign < 0 ? 1 - t : t;
      let browY = 44;
      if (mood === "critical") {
        browY = 43 + (1 - fromInner) * 3.5;
      } else if (mood === "warning") {
        browY = eSign < 0 ? 41.5 + fromInner * 1.2 : 44.8 + (1 - fromInner) * 1.5;
      } else {
        browY = 43.2 + (1 - fromInner) * 1.1;
      }
      setPx(ex + dx, browY, eSign < 0 ? 5 : 4);
      setPx(ex + dx, browY + 1, 3);
      setPx(ex + dx, browY + 2, 1);
    }
  }

  // LAYER 7: Articulated Mechanical Jaw & Vocalizer Grille Mouth
  const mTop = 67;
  const mBottom = 71 + jawDrop;
  for (let y = mTop - 1; y <= mBottom + 1; y++) {
    for (let x = CX - 11; x <= CX + 11; x++) {
      const isBorder = y === mTop - 1 || y === mBottom + 1 || Math.abs(x - CX) === 11;
      if (isBorder) {
        setPx(x, y, y === mBottom + 1 ? 5 : x < CX ? 4 : 3);
      } else if (jawDrop > 0) {
        const relX = x - (CX - 10);
        const isBarCol = relX % 4 === 1 || relX % 4 === 2;
        const barId = Math.floor(relX / 4);
        const halfBarH =
          pose === "talk2"
            ? barId % 2 === 0
              ? 3
              : 2
            : barId % 2 === 0
              ? 1
              : 2;
        const mCenterY = Math.round((mTop + mBottom) / 2);
        if (isBarCol && Math.abs(y - mCenterY) <= halfBarH) {
          setPx(x, y, y === mCenterY ? 6 : 5);
        } else {
          setPx(x, y, 0);
        }
      } else if (mood === "critical") {
        const isTooth = (x - CX) % 3 !== 0;
        setPx(x, y, y === 69 ? 0 : isTooth ? 5 : 1);
      } else if (mood === "warning") {
        setPx(x, y, y === 69 ? 1 : 3);
      } else {
        const seamY = x > CX + 4 ? 68 : 69;
        setPx(x, y, y === seamY ? 0 : (x - CX) % 4 === 0 ? 2 : 3);
      }
    }
  }

  // LAYER 8: Towering High-Peak Soviet Visor Cap (Peaked Cap)
  for (let y = 3; y <= 26; y++) {
    const ny = (y - 3) / 23;
    const crownDrop = Math.pow(Math.abs(ny - 0.45), 1.5);
    const halfCapW =
      y < 7
        ? 16 + (y - 3) * 5.2
        : y < 16
          ? 36 + Math.sin(((y - 7) / 9) * Math.PI * 0.5) * 4.5
          : 40 - ((y - 16) / 10) * 12;
    const topCurveY = 3 + ((halfCapW - 14) / 26) * 2.2;
    for (let x = Math.round(CX - halfCapW); x <= Math.round(CX + halfCapW); x++) {
      const dxNorm = (x - CX) / halfCapW;
      if (y < topCurveY + dxNorm * dxNorm * 3.5) continue;
      let tone = 3.5 - dxNorm * 1.15 - crownDrop * 0.6;
      tone += Math.cos((x - CX) * 0.34) * 0.35;
      const distOuter = halfCapW - Math.abs(x - CX);
      if (distOuter < 1.3 || y <= topCurveY + dxNorm * dxNorm * 3.5 + 1.1) {
        tone = dxNorm < 0.35 ? 5.2 : 3.4;
      }
      ditherPx(x, y, tone);
    }
  }

  // Dark Velvet Cap Band (`y = 26..33`) + Piping
  for (let y = 26; y <= 33; y++) {
    for (let x = 23; x <= 81; x++) {
      const dxNorm = (x - CX) / 29;
      if (y === 26 || y === 33) {
        ditherPx(x, y, dxNorm < 0.3 ? 4.8 : 3.2);
      } else {
        ditherPx(x, y, 1.4 - dxNorm * 0.5);
      }
    }
  }

  // Golden Laurel Wreath & Red Star Soviet Cockade (`cx = 52, cy = 19`)
  for (let dy = -6; dy <= 7; dy++) {
    for (let dx = -9; dx <= 9; dx++) {
      const wreathDist = Math.hypot(dx / 8.5, dy / 6.2);
      if (wreathDist >= 0.72 && wreathDist <= 1.06 && dy > -5) {
        const leaf = ((dx + dy) & 1) === 0;
        setPx(CX + dx, 19 + dy, leaf ? (dx < 0 ? 6 : 5) : 3);
      }
    }
  }
  const cockadeStar: readonly [number, number, number][] = [
    [0, -5, 7],
    [-1, -3, 7], [0, -3, 6], [1, -3, 7],
    [-5, -1, 7], [-4, -1, 7], [-3, -1, 7], [-2, -1, 7], [-1, -1, 6], [0, -1, 6], [1, -1, 7], [2, -1, 7], [3, -1, 7], [4, -1, 7], [5, -1, 7],
    [-3, 0, 7], [-2, 0, 7], [-1, 0, 7], [0, 0, 6], [1, 0, 7], [2, 0, 7], [3, 0, 7],
    [-2, 1, 7], [-1, 1, 7], [0, 1, 7], [1, 1, 7], [2, 1, 7],
    [-3, 2, 7], [-2, 2, 7], [2, 2, 7], [3, 2, 7],
    [-4, 3, 7], [4, 3, 7],
  ];
  for (const [sx, sy, sc] of cockadeStar) setPx(CX + sx, 19 + sy, sc);

  // Twisted Braided Gold/Phosphor Chinstrap Cord (`y = 32..34`)
  for (let x = 25; x <= 79; x++) {
    const twist = Math.floor((x - 25) / 2) % 2 === 0;
    setPx(x, 32, twist ? 6 : 4);
    setPx(x, 33, twist ? 5 : 3);
  }
  setPx(25, 31, 6);
  setPx(25, 32, 6);
  setPx(79, 31, 5);
  setPx(79, 32, 5);

  // Curved Glossy Lacquered Visor (`y = 34..41`) with Specular Reflection Flash
  for (let y = 34; y <= 41; y++) {
    const ny = (y - 34) / 7;
    const halfV = 29 - ny * ny * 10;
    for (let x = Math.round(CX - halfV); x <= Math.round(CX + halfV); x++) {
      const dxNorm = (x - CX) / halfV;
      const onBottomRim =
        y === 41 || Math.abs(Math.abs(x - CX) - halfV) < 1.3;
      const specFlash = x >= 29 && x <= 44 && Math.abs((x - 29) * 0.25 - (y - 34)) < 0.85;
      if (onBottomRim) {
        setPx(x, y, dxNorm < 0.2 ? 4 : 3);
      } else if (specFlash) {
        setPx(x, y, x < 38 ? 6 : 5);
      } else {
        setPx(x, y, y === 35 && Math.abs(dxNorm) < 0.7 ? 1 : 0);
      }
    }
  }

  // Convert Indexed Buffer -> Offscreen Canvas
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const img = ctx.createImageData(W, H);
    const data = img.data;
    const pal = KOMRAD_PORTRAIT_PALETTES[mood];
    for (let i = 0; i < W * H; i++) {
      const rgb = pal[buf[i]] ?? pal[0];
      const o = i * 4;
      data[o] = rgb[0];
      data[o + 1] = rgb[1];
      data[o + 2] = rgb[2];
      data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  return canvas;
}

export type KomradPixelSpriteBank = Record<
  KomradMood,
  Record<KomradPortraitPose, HTMLCanvasElement>
>;

let cachedKomradSpriteBank: KomradPixelSpriteBank | null = null;

export function getKomradPixelSprites(): KomradPixelSpriteBank { // oxlint-disable-line react/only-export-components
  if (cachedKomradSpriteBank) return cachedKomradSpriteBank;
  const moods: readonly KomradMood[] = ["normal", "warning", "critical"];
  const poses: readonly KomradPortraitPose[] = [
    "idle",
    "scan",
    "blink",
    "talk1",
    "talk2",
  ];
  const bank = {} as KomradPixelSpriteBank;
  for (const m of moods) {
    const poseMap = {} as Record<KomradPortraitPose, HTMLCanvasElement>;
    for (const p of poses) {
      poseMap[p] = bakeKomradPortraitCanvas(m, p);
    }
    bank[m] = poseMap;
  }
  cachedKomradSpriteBank = bank;
  return bank;
}

function paintKomradWallTerminalCRT(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sprites: KomradPixelSpriteBank,
  messages: readonly KomradMessageEntry[],
  mood: KomradMood,
  pose: KomradPortraitPose,
  isTalking: boolean,
  typedCharCount: number,
  stepBucket: number,
  isBlackout: boolean,
  vocalEnergy = 0,
  activeVowel: KomradVowelKey | null = null,
  spectrum16?: Uint8Array,
  voxLoaded = false,
  activeSpokenMsgId = "",
): void {
  if (isBlackout) {
    ctx.fillStyle = "#050706";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#2b1616";
    ctx.lineWidth = 4;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = "#7a2424";
    ctx.font = 'bold 26px "Kremlin", "Courier Prime", "Consolas", monospace';
    ctx.textAlign = "center";
    ctx.fillText("MCR POWER OFF - K.O.M.R.A.D.-84 STANDBY", w / 2, h / 2 - 10, w - 48);
    ctx.fillStyle = "#4d5952";
    ctx.font = 'bold 20px "Kremlin", "Courier Prime", "Consolas", monospace';
    ctx.fillText("RECHARGE BATTERY BANK & RAISE CONTROL RODS", w / 2, h / 2 + 34, w - 48);
    return;
  }

  const palette =
    mood === "critical"
      ? {
          bg: "#160404",
          frame: "#611313",
          primary: "#ff4433",
          secondary: "#ffc2b8",
          dim: "#94231c",
          armor: "#2b0808",
        }
      : mood === "warning"
        ? {
            bg: "#140d03",
            frame: "#573909",
            primary: "#ffb32c",
            secondary: "#ffe69e",
            dim: "#946110",
            armor: "#261805",
          }
        : {
            bg: "#041209",
            frame: "#0f4722",
            primary: "#39ff7a",
            secondary: "#b8ffd0",
            dim: "#1d8c43",
            armor: "#0b2415",
          };

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);

  // Outer Monitor Frame
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  // LEFT PANE (~37.5% width): 16-Bit Atompunk Pixel-Art Portrait + Spectrum Vocalizer
  const lx = 18;
  const ly = 18;
  const lw = 376;
  const lh = 604;
  ctx.fillStyle = palette.bg;
  ctx.fillRect(lx, ly, lw, lh);
  ctx.strokeStyle = palette.frame;
  ctx.lineWidth = 3;
  ctx.strokeRect(lx, ly, lw, lh);

  // Portrait Header Badge
  ctx.fillStyle = palette.armor;
  ctx.fillRect(lx + 8, ly + 8, lw - 16, 40);
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 2;
  ctx.strokeRect(lx + 8, ly + 8, lw - 16, 40);
  ctx.fillStyle = palette.secondary;
  ctx.font = 'bold 17px "Kremlin", "Courier Prime", "Consolas", monospace';
  ctx.textAlign = "left";
  ctx.fillText("MAINFRAME K.O.M.R.A.D.-84", lx + 16, ly + 36, lw - 142);

  const flashOn = stepBucket % 2 === 0;
  const moodTag =
    mood === "critical" ? "ALERT!" : mood === "warning" ? "OVERSIGHT" : "NOMINAL";
  ctx.fillStyle = mood === "critical" && flashOn ? "#ff4433" : palette.primary;
  ctx.fillRect(lx + lw - 122, ly + 13, 108, 30);
  ctx.fillStyle = "#080b08";
  ctx.font = 'bold 16px "Kremlin", "Courier Prime", "Consolas", monospace';
  ctx.textAlign = "center";
  ctx.fillText(moodTag, lx + lw - 68, ly + 35, 100);

  // Framed 104x120 Pixel Portrait Box at Exact 3x Integer Scale (312 x 360)
  const portX = lx + 10;
  const portY = ly + 56;
  const portW = lw - 20;
  const portH = 376;
  ctx.fillStyle = "#030804";
  ctx.fillRect(portX, portY, portW, portH);
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(portX, portY, portW, portH);

  const spriteCanvas = sprites[mood][pose];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spriteCanvas, portX + 22, portY + 8, 312, 360);
  ctx.restore();

  if (mood === "critical") {
    ctx.fillStyle = flashOn ? "#ff4433" : "#751712";
    ctx.font = 'bold 17px "Kremlin", "Courier Prime", "Consolas", monospace';
    ctx.textAlign = "left";
    ctx.fillText("▲ ALERT ▲", portX + 10, portY + 24);
    ctx.textAlign = "right";
    ctx.fillText("▲ CRIT ▲", portX + portW - 10, portY + 24);
  }

  // Bottom Vocalizer Spectrum Analyzer & Carrier Oscilloscope
  const specX = lx + 10;
  const specY = ly + 442;
  const specW = lw - 20;
  const specH = 152;
  ctx.fillStyle = "#040805";
  ctx.fillRect(specX, specY, specW, specH);
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(specX, specY, specW, specH);

  // 16-Band Segmented LED Bar Spectrum
  const bandCount = 16;
  const barW = 15;
  const barGap = 5;
  const barsStartX = specX + (specW - (bandCount * barW + (bandCount - 1) * barGap)) / 2;
  const barsBottomY = specY + 62;
  const vowelPeakBand = getKomradVowelBand(activeVowel, bandCount);
  for (let bi = 0; bi < bandCount; bi++) {
    let levelF: number;
    if (isTalking && voxLoaded && spectrum16) {
      const binAmp = (spectrum16[bi] ?? 0) / 255;
      levelF = Math.min(1, 0.08 + binAmp * 0.92);
    } else {
      const bandFocus = activeVowel
        ? Math.max(0.28, 1 - Math.abs(bi - vowelPeakBand) * 0.12)
        : 0.45;
      levelF = isTalking
        ? Math.min(
            1,
            0.1 +
              vocalEnergy *
                0.92 *
                bandFocus *
                (0.68 + 0.32 * Math.abs(Math.sin(stepBucket * 1.45 + bi * 0.85))),
          )
        : 0.14 + 0.08 * Math.sin(stepBucket * 0.9 + bi * 0.5);
    }
    const segs = Math.max(1, Math.round(levelF * 7));
    for (let si = 0; si < 7; si++) {
      const sy = barsBottomY - (si + 1) * 7;
      ctx.fillStyle =
        si < segs
          ? si >= 5
            ? palette.secondary
            : palette.primary
          : palette.armor;
      ctx.fillRect(barsStartX + bi * (barW + barGap), sy, barW, 5);
    }
  }

  // Carrier Oscilloscope Trace
  const wfBaseY = specY + 92;
  ctx.strokeStyle = isTalking && vocalEnergy > 0.1 ? palette.secondary : palette.dim;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  const wfSamples = 32;
  for (let i = 0; i <= wfSamples; i++) {
    const px = specX + 14 + (i / wfSamples) * (specW - 28);
    const amp = isTalking ? 4 + vocalEnergy * 16 : 2.5;
    const waveOffset = isTalking
      ? Math.sin(i * 0.95 + stepBucket * 2.2) *
        Math.cos(i * 0.38 - stepBucket * 1.3) *
        amp
      : Math.sin(i * 0.45 + stepBucket * 0.5) * 2.5;
    if (i === 0) ctx.moveTo(px, wfBaseY + waveOffset);
    else ctx.lineTo(px, wfBaseY + waveOffset);
  }
  ctx.stroke();

  // Status Inverted Footer Pill
  ctx.fillStyle = isTalking ? palette.primary : palette.dim;
  ctx.fillRect(specX + 12, specY + 118, specW - 24, 24);
  ctx.fillStyle = isTalking ? "#050906" : palette.secondary;
  ctx.font = 'bold 15px "Kremlin", "Courier Prime", "Consolas", monospace';
  ctx.textAlign = "center";
  ctx.fillText(
    isTalking ? "COMMS CHANNEL: ACTIVE" : "COMMS CHANNEL: STANDBY",
    lx + lw / 2,
    specY + 136,
    specW - 32,
  );

  // Subtle CRT Scanlines Across Terminal
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  for (let sy = 4; sy < h; sy += 6) {
    ctx.fillRect(0, sy, w, 2);
  }

  // RIGHT PANE (~61% width): Readable Typewriter Log (K.O.M.R.A.D.-84 DISPATCH LOG)
  const rx = 408;
  const ry = 18;
  const rw = w - rx - 18;
  const rh = 604;

  ctx.fillStyle = "rgba(4, 10, 6, 0.78)";
  ctx.fillRect(rx, ry, rw, rh);
  ctx.strokeStyle = palette.frame;
  ctx.lineWidth = 3;
  ctx.strokeRect(rx, ry, rw, rh);

  ctx.fillStyle = palette.armor;
  ctx.fillRect(rx + 6, ry + 6, rw - 12, 46);
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 2;
  ctx.strokeRect(rx + 6, ry + 6, rw - 12, 46);
  ctx.fillStyle = palette.secondary;
  ctx.font = 'bold 19px "Kremlin", "Courier Prime", "Consolas", monospace';
  ctx.textAlign = "left";
  ctx.fillText("K.O.M.R.A.D.-84 DISPATCH LOG // SECTOR 84", rx + 16, ry + 37, rw - 32);

  const visibleMsgs = messages.slice(-5).reverse();
  const activeMsg =
    (isTalking && activeSpokenMsgId
      ? messages.find((m) => m.id === activeSpokenMsgId)
      : undefined) ?? visibleMsgs[0];
  const historyMsgs = messages
    .filter((m) => m.id !== activeMsg?.id)
    .slice(-4)
    .reverse();
  const cursorVisible = isTalking || stepBucket % 2 === 0;

  // Top Active Transmission Box (`y = 78..236`, `h = 158`) with Typewriter Reveal
  const boxX = rx + 12;
  const boxY = ry + 60;
  const boxW = rw - 24;
  const boxH = 158;
  ctx.fillStyle =
    activeMsg?.mood === "critical"
      ? "#330a0a"
      : activeMsg?.mood === "warning"
        ? "#2e1e06"
        : "#0a2915";
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle =
    activeMsg?.mood === "critical"
      ? "#ff4433"
      : activeMsg?.mood === "warning"
        ? "#ffb32c"
        : palette.primary;
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  if (activeMsg) {
    const tagColor =
      activeMsg.mood === "critical"
        ? "#ff6b57"
        : activeMsg.mood === "warning"
          ? "#ffd15c"
          : "#7bffa8";
    ctx.fillStyle = tagColor;
    ctx.font = 'bold 20px "Courier Prime", "Consolas", monospace';
    ctx.textAlign = "left";
    ctx.fillText(
      `[${activeMsg.timestamp}] ${activeMsg.sender}`,
      boxX + 12,
      boxY + 26,
      boxW - 150,
    );
    ctx.textAlign = "right";
    ctx.fillText(
      isTalking ? "● TRANSMITTING" : "● LOGGED",
      boxX + boxW - 12,
      boxY + 26,
      140,
    );

    ctx.textAlign = "left";
    ctx.font = 'bold 24px "Courier Prime", "Consolas", monospace';
    const visibleText =
      !activeSpokenMsgId || activeMsg.id === activeSpokenMsgId
        ? activeMsg.text.slice(0, typedCharCount)
        : activeMsg.text;
    const wrappedActive = wrapText(ctx, visibleText, boxW - 30).slice(-4);
    ctx.fillStyle = "#ffffff";
    if (wrappedActive.length === 0 && cursorVisible) {
      ctx.fillText("█", boxX + 12, boxY + 60);
    } else {
      wrappedActive.forEach((line, idx) => {
        const displayLine =
          idx === wrappedActive.length - 1 && cursorVisible
            ? `${line} █`
            : line;
        ctx.fillText(displayLine, boxX + 12, boxY + 60 + idx * 29, boxW - 24);
      });
    }
  } else {
    ctx.fillStyle = palette.secondary;
    ctx.font = 'bold 20px "Kremlin", "Courier Prime", "Consolas", monospace';
    ctx.textAlign = "left";
    ctx.fillText("AWAITING DIRECTIVES...", boxX + 14, boxY + 74, boxW - 28);
  }

  // 4 Structured History Cards Filling 100% of Remaining Height (`y = 246..610`)
  const histStartY = boxY + boxH + 10;
  const cardH = 87;
  const cardGap = 6;

  for (let slot = 0; slot < 4; slot++) {
    const cy = histStartY + slot * (cardH + cardGap);
    const item = historyMsgs[slot];
    if (!item) {
      ctx.fillStyle = "rgba(8, 22, 13, 0.55)";
      ctx.fillRect(boxX, cy, boxW, cardH);
      ctx.strokeStyle = palette.frame;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(boxX, cy, boxW, cardH);
      ctx.fillStyle = palette.dim;
      ctx.font = 'bold 16px "Kremlin", "Courier Prime", "Consolas", monospace';
      ctx.textAlign = "left";
      ctx.fillText("[--:--:--] MCR BACKUP CHANNEL // STANDBY", boxX + 14, cy + 50, boxW - 28);
      continue;
    }

    const rowColor =
      item.mood === "critical"
        ? "#ff6d5e"
        : item.mood === "warning"
          ? "#ffc959"
          : "#66f595";
    const metaColor =
      item.mood === "critical"
        ? "#cc483d"
        : item.mood === "warning"
          ? "#c78e2a"
          : palette.dim;
    const cardBg =
      item.mood === "critical"
        ? "rgba(52, 10, 10, 0.55)"
        : item.mood === "warning"
          ? "rgba(48, 32, 6, 0.55)"
          : "rgba(9, 32, 17, 0.68)";
    const stripeColor =
      item.mood === "critical"
        ? "#ff4433"
        : item.mood === "warning"
          ? "#ffb32c"
          : palette.primary;

    ctx.fillStyle = cardBg;
    ctx.fillRect(boxX, cy, boxW, cardH);
    ctx.fillStyle = stripeColor;
    ctx.fillRect(boxX, cy, 5, cardH);
    ctx.strokeStyle = palette.frame;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(boxX, cy, boxW, cardH);

    ctx.textAlign = "left";
    ctx.fillStyle = metaColor;
    ctx.font = 'bold 17px "Courier Prime", "Consolas", monospace';
    ctx.fillText(`[${item.timestamp}] ${item.sender}`, boxX + 12, cy + 21, boxW - 22);

    ctx.fillStyle = rowColor;
    ctx.font = 'bold 21px "Courier Prime", "Consolas", monospace';
    const lines = wrapText(ctx, item.text, boxW - 24).slice(0, 2);
    lines.forEach((line, li) => {
      ctx.fillText(line, boxX + 12, cy + 48 + li * 25, boxW - 22);
    });
  }
}

/**
 * Right Synoptic Wing Giant Live `K.O.M.R.A.D.-84` Character & Comms Wall Terminal (`[x=-0.08, y=2.74, z=0.22]`).
 * - Bottom edge sits at worldY = 2.10m (>= 0.117m clear above scaled UNIT C & UNIT B top crest at 1.983m),
 *   and top surveillance camera hood sits at worldY = 3.48m (cleanly below ceiling coffer beams and wing canopy).
 * - Zero dynamic lights, `raycast={NOOP_RAYCAST}` across every mesh, strict dirty-checked canvas updates.
 */
const SovietKomradCommsWallTerminal3D: React.FC = React.memo(() => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const sprites = useMemo(() => getKomradPixelSprites(), []);
  const screenMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const kgbLensMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const lastMsgIdRef = useRef("");
  const lastMoodRef = useRef<KomradMood>("normal");
  const lastBlackoutRef = useRef(false);
  const lastSigRef = useRef("");

  const crtTex = useMemo(
    () =>
      createCrispPanelTexture(1024, 640, (ctx, w, h) => {
        paintKomradWallTerminalCRT(
          ctx,
          w,
          h,
          sprites,
          [],
          "normal",
          "idle",
          false,
          0,
          0,
          false,
        );
      }),
    [sprites],
  );

  useEffect(() => {
    return onKremlinFontReady(() => {
      lastSigRef.current = "";
    });
  }, []);

  useFrame((state, delta) => {
    if (screenMatRef.current) {
      screenMatRef.current.color.lerpColors(
        SCENE_COLOR_CRT_STANDBY_TINT,
        SCENE_COLOR_WHITE,
        controlRoomPowerState.zone3,
      );
    }
    const t = state.clock.elapsedTime;
    const s = useGameStore.getState();
    const msgs = s.komradMessages;
    const isBlackout = s.isBlackout && !s.isGodMode;
    const vocal = stepKomradSpeech(t, delta);

    const mood = vocal.mood;
    const isTalking = vocal.isTalking;
    const typedCharCount = vocal.typedCharCount;
    const stepBucket = isTalking ? Math.floor(t * 10) : Math.floor(t);
    const pose: KomradPortraitPose = isTalking
      ? vocal.mouthOpen === 2
        ? "talk2"
        : vocal.mouthOpen === 1
          ? "talk1"
          : "idle"
      : stepBucket % 7 === 0
        ? "blink"
        : stepBucket % 5 === 2
          ? "scan"
          : "idle";

    const energyBucket = Math.round(vocal.energy * 10);
    const latestStoreMsgId = msgs.length > 0 ? msgs[msgs.length - 1].id : "";
    const specSig =
      isTalking && vocal.voxLoaded
        ? `${Math.round(vocal.spectrum16[0] / 28)}-${Math.round(vocal.spectrum16[5] / 28)}-${Math.round(vocal.spectrum16[10] / 28)}-${Math.round(vocal.spectrum16[15] / 28)}`
        : "";
    const sig = `${vocal.activeMsgId}|${latestStoreMsgId}|${mood}|${isBlackout}|${isTalking}|${pose}|${typedCharCount}|${energyBucket}|${vocal.activeVowel ?? ""}|${vocal.voxLoaded ? 1 : 0}|${specSig}|${
      isTalking ? stepBucket : stepBucket % 2
    }`;

    if (
      sig === lastSigRef.current &&
      mood === lastMoodRef.current &&
      isBlackout === lastBlackoutRef.current &&
      vocal.activeMsgId === lastMsgIdRef.current
    ) {
      return;
    }

    lastSigRef.current = sig;
    lastMsgIdRef.current = vocal.activeMsgId;
    lastMoodRef.current = mood;
    lastBlackoutRef.current = isBlackout;

    if (kgbLensMatRef.current) {
      kgbLensMatRef.current.color.setHex(
        isBlackout
          ? 0x240a0a
          : mood === "critical" && stepBucket % 2 === 0
            ? 0xff3b2f
            : isTalking && vocal.energy > 0.2
              ? 0xff2a2a
              : 0xa81616,
      );
    }

    const tex = screenMatRef.current?.map as THREE.CanvasTexture | undefined;
    if (!tex) return;
    const canvas = tex.image as HTMLCanvasElement | undefined;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    paintKomradWallTerminalCRT(
      ctx,
      canvas.width,
      canvas.height,
      sprites,
      msgs,
      mood,
      pose,
      isTalking,
      typedCharCount,
      stepBucket,
      isBlackout,
      vocal.energy,
      vocal.activeVowel,
      vocal.spectrum16,
      vocal.voxLoaded,
      vocal.activeMsgId,
    );
    tex.needsUpdate = true;
  });

  return (
    <group position={[-0.08, 2.74, 0.22]}>
      {/* Main Bolted Gunmetal / Olive-Steel Cabinet Chassis (3.12m x 1.28m, front face at z = +0.12m) */}
      <mesh position={[0, 0, 0.06]} castShadow={false} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[3.12, 1.28, 0.12]} />
        <meshStandardMaterial
          color="#24322c"
          metalness={0.56}
          roughness={0.48}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.005}
        />
      </mesh>

      {/* Recessed Inner Steel Monitor Shroud Surround (`z = +0.118m` backing well behind CRT plane at +0.148m) */}
      <mesh position={[0, 0, 0.118]} castShadow={false} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[2.76, 1.16, 0.022]} />
        <meshStandardMaterial color="#121715" metalness={0.68} roughness={0.44} />
      </mesh>

      {/* Heavy Cowl Perimeter Framing Rails around CRT Window (zero corner overlap) */}
      <mesh position={[0, 0.556, 0.142]} castShadow={false} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[2.76, 0.068, 0.036]} />
        <meshStandardMaterial color="#1b2420" metalness={0.62} roughness={0.46} />
      </mesh>
      <mesh position={[0, -0.556, 0.142]} castShadow={false} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[2.76, 0.068, 0.036]} />
        <meshStandardMaterial color="#1b2420" metalness={0.62} roughness={0.46} />
      </mesh>
      <mesh position={[-1.335, 0, 0.142]} castShadow={false} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.09, 1.044, 0.036]} />
        <meshStandardMaterial color="#1b2420" metalness={0.62} roughness={0.46} />
      </mesh>
      <mesh position={[1.335, 0, 0.142]} castShadow={false} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.09, 1.044, 0.036]} />
        <meshStandardMaterial color="#1b2420" metalness={0.62} roughness={0.46} />
      </mesh>

      {/* Side Cooling Louver Flanks & Bolted Brackets (merged geometries) */}
      <mesh geometry={WALL_KOMRAD_LOUVERS_GEO} castShadow={false} raycast={NOOP_RAYCAST}>
        <meshStandardMaterial color="#151b18" metalness={0.66} roughness={0.45} />
      </mesh>
      <mesh geometry={WALL_KOMRAD_BOLTS_GEO} castShadow={false} raycast={NOOP_RAYCAST}>
        <meshStandardMaterial color="#8d9992" metalness={0.82} roughness={0.32} />
      </mesh>

      {/* Top KGB All-Seeing Camera Lens + Speaker Grille Hood (`worldY = 3.38m..3.48m`, cleanly below soffit & 3.84m canopy) */}
      <group position={[0, 0.69, 0.09]}>
        <mesh castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.18, 0.1, 0.12]} />
          <meshStandardMaterial color="#1b2420" metalness={0.64} roughness={0.44} />
        </mesh>
        {/* Left & Right Speaker Grille Cavities */}
        <mesh position={[-0.4, 0, 0.056]} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.3, 0.072, 0.016]} />
          <meshStandardMaterial color="#0b0e0d" metalness={0.4} roughness={0.78} />
        </mesh>
        <mesh position={[0.4, 0, 0.056]} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.3, 0.072, 0.016]} />
          <meshStandardMaterial color="#0b0e0d" metalness={0.4} roughness={0.78} />
        </mesh>
        <mesh geometry={WALL_KOMRAD_SPEAKER_SLOTS_GEO} castShadow={false} raycast={NOOP_RAYCAST}>
          <meshStandardMaterial color="#2f3d37" metalness={0.6} roughness={0.46} />
        </mesh>
        {/* Center KGB Surveillance Optic Barrel & Red Lens */}
        <mesh position={[0, 0, 0.072]} rotation={[Math.PI / 2, 0, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.044, 0.05, 0.06, 12]} />
          <meshStandardMaterial color="#111514" metalness={0.82} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0, 0.103]} rotation={[Math.PI / 2, 0, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.03, 0.03, 0.014, 12]} />
          <meshBasicMaterial ref={kgbLensMatRef} color="#c81d1d" toneMapped={false} fog={false} />
        </mesh>
      </group>

      {/* Main High-Contrast K.O.M.R.A.D.-84 Phosphor CRT Screen (`+0.019m` proud of backing, zero z-fighting) */}
      <mesh position={[0, 0, 0.148]} castShadow={false} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[2.58, 1.04]} />
        <meshBasicMaterial
          ref={screenMatRef}
          map={crtTex}
          color="#324a3a"
          toneMapped={false}
          fog={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  );
});

/**
 * Front Curved 3-Part RBMK-1000 Synoptic Wall (around `z = -3.86`, `x = -5.7..+5.7`):
 * - Center Upper Wall: Seafoam/sage-green cabinet framing the monumental `K.O.M.R.A.D.-84` master CRT bay,
 *   crowned by a glowing red header banner & red 7-segment `MCR CLOCK`.
 * - Left Angled Wing (`x = -3.90, z = -3.62`): Massive live-synced `RBMK CORE` 37-channel refuel wall synoptic display
 *   (`RBMK-1000 ACTIVE CORE // FUEL ROD MONITOR`).
 * - Right Angled Wing (`x = +3.90, z = -3.62`): Giant live `K.O.M.R.A.D.-84` Character & Comms Wall Terminal
 *   (`K.O.M.R.A.D.-84 DISPATCH LOG`).
 */
const SovietRbmkFrontSynopticWall3D: React.FC = React.memo(() => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  const wallDoorInstRef = useRef<THREE.InstancedMesh>(null);
  const wallLatchInstRef = useRef<THREE.InstancedMesh>(null);
  const redBannerMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const mainRedBannerTex = useMemo(
    () =>
      createNearestCanvasTexture(1024, 128, (ctx, w, h) => {
        ctx.fillStyle = "#5c0e0e";
        ctx.fillRect(0, 0, w, h);
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "#8c1414");
        grad.addColorStop(0.5, "#6b0f0f");
        grad.addColorStop(1, "#4a0a0a");
        ctx.fillStyle = grad;
        ctx.fillRect(6, 6, w - 12, h - 12);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 6;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        ctx.fillStyle = "#ffefe6";
        ctx.font = 'bold 36px "Kremlin", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText(
          "MCR UNIT NO. 4 RBMK-1000 // SKALA SYSTEM",
          w / 2,
          58,
          w - 48,
        );
        ctx.fillStyle = "#ffd166";
        ctx.font = 'bold 22px "Kremlin", "VT323", monospace';
        ctx.fillText(
          "SECTOR 84 • PEOPLE'S AUTOMATED NUCLEAR POWER PLANT NO. 4",
          w / 2,
          102,
          w - 48,
        );
      }),
    [],
  );

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const wingMat = new THREE.Matrix4();
    const partMat = new THREE.Matrix4();
    const outMat = new THREE.Matrix4();
    const scaleVec = new THREE.Vector3();
    const colorTmp = new THREE.Color();

    const doors = wallDoorInstRef.current;
    const latches = wallLatchInstRef.current;
    if (doors && latches) {
      let dIdx = 0;
      for (const dx of [-1.5, -0.75, 0, 0.75, 1.5]) {
        dummy.position.set(dx, 0.71, -3.96 + 0.118);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(0.66, 1.16, 0.022);
        dummy.updateMatrix();
        doors.setMatrixAt(dIdx, dummy.matrix);
        doors.setColorAt(dIdx, colorTmp.set("#253630"));

        dummy.position.set(dx + 0.25, 0.71, -3.96 + 0.118 + 0.014);
        dummy.scale.set(0.024, 0.12, 0.014);
        dummy.updateMatrix();
        latches.setMatrixAt(dIdx, dummy.matrix);
        dIdx++;
      }
      for (const side of [-1, 1] as const) {
        wingMat.makeRotationY(-side * 0.21);
        wingMat.setPosition(side * 3.9, 0, -3.62);
        for (const lx of [-1.18, 0, 1.18]) {
          partMat.makeTranslation(lx, 0.74, 0.228);
          partMat.scale(scaleVec.set(1.06, 1.18, 0.022));
          outMat.multiplyMatrices(wingMat, partMat);
          doors.setMatrixAt(dIdx, outMat);
          doors.setColorAt(dIdx, colorTmp.set("#24352f"));

          partMat.makeTranslation(lx + 0.42, 0.74, 0.228 + 0.015);
          partMat.scale(scaleVec.set(0.026, 0.14, 0.016));
          outMat.multiplyMatrices(wingMat, partMat);
          latches.setMatrixAt(dIdx, outMat);
          dIdx++;
        }
      }
      doors.instanceMatrix.needsUpdate = true;
      if (doors.instanceColor) doors.instanceColor.needsUpdate = true;
      latches.instanceMatrix.needsUpdate = true;
    }
  }, []);

  useFrame(() => {
    if (redBannerMatRef.current) {
      redBannerMatRef.current.emissiveIntensity =
        0.08 + 0.6 * controlRoomPowerState.zone3;
    }
  });

  return (
    <group>
      {/* Instanced 11 Lower Relay Cabinet Doors & Brass Latches Across Front Synoptic Wall */}
      <instancedMesh ref={wallDoorInstRef} args={[undefined, undefined, 11]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" metalness={0.48} roughness={0.55} />
      </instancedMesh>
      <instancedMesh ref={wallLatchInstRef} args={[undefined, undefined, 11]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#b8a46b"
          metalness={0.86}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.004}
        />
      </instancedMesh>

      {/* 1. CENTER SYNOPTIC WALL BACKING & CROWN BANNER (`z = -3.96`, `x = -2.04..+2.04`) */}
      <group position={[0, 0, -3.96]}>
        {/* Lower Soviet Seafoam / Sage-Green Relay Cabinets (`y = 0..1.42m`) */}
        <mesh position={[0, 0.71, -0.06]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[4.08, 1.42, 0.34]} />
          <meshStandardMaterial
            color="#2f443e"
            metalness={0.42}
            roughness={0.58}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>
        {/* Upper Seafoam/Sage Backing Wall (`y = 1.42..3.88m`) */}
        <mesh position={[0, 2.65, -0.14]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[4.08, 2.46, 0.2]} />
          <meshStandardMaterial
            color="#354b44"
            metalness={0.34}
            roughness={0.62}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        {/* Top Overhanging Synoptic Cornice Hood (`y = 3.97..4.17m`) */}
        <mesh position={[0, 4.07, 0.14]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[4.18, 0.2, 0.56]} />
          <meshStandardMaterial color="#23312c" metalness={0.58} roughness={0.48} />
        </mesh>

        {/* Vertical Steel Pilasters Bridging Center CRT Bay to Angled Synoptic Wings */}
        {([-2.0, 2.0] as const).map((px, pIdx) => (
          <mesh key={`syn-pilaster-${pIdx}`} position={[px, 2.08, 0.06]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.14, 4.16, 0.24]} />
            <meshStandardMaterial color="#1f2925" metalness={0.64} roughness={0.44} />
          </mesh>
        ))}
      </group>

      {/* Backlit Red Cyrillic Header Banner Above Left-Center of K.O.M.R.A.D.-84 */}
      <group position={[-0.78, 3.77, -3.36]} rotation={[0.12, 0, 0]}>
        <mesh raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.12, 0.21, 0.12]} />
          <meshStandardMaterial color="#1d2421" metalness={0.64} roughness={0.44} />
        </mesh>
        <mesh position={[0, 0, 0.078]} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[2.04, 0.18]} />
          <meshStandardMaterial
            ref={redBannerMatRef}
            map={mainRedBannerTex}
            emissive="#ff4433"
            emissiveMap={mainRedBannerTex}
            emissiveIntensity={0.08}
            roughness={0.42}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>

      {/* Red 7-Segment Soviet Wall Clock (`MCR CLOCK`) Above Right-Center of K.O.M.R.A.D.-84 */}
      <SovietDigitalShiftClock3D />

      {/* 2. LEFT & RIGHT ANGLED SYNOPTIC WINGS (`x = ±3.90, z = -3.62`, width `3.76m`) */}
      {([-1, 1] as const).map((side) => {
        const isLeft = side === -1;
        return (
          <group
            key={`syn-wing-${side}`}
            position={[side * 3.9, 0, -3.62]}
            rotation={[0, -side * 0.21, 0]}
          >
            {/* Tall Soviet Seafoam/Sage-Green Vertical Instrument Cabinet (`3.76m × 4.02m × 0.44m`) */}
            <mesh position={[0, 2.01, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[3.76, 4.02, 0.44]} />
              <meshStandardMaterial
                color="#2f443e"
                metalness={0.38}
                roughness={0.58}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.006}
              />
            </mesh>
            {/* Top Overhang Canopy */}
            <mesh position={[0, 3.95, 0.08]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[3.84, 0.22, 0.56]} />
              <meshStandardMaterial color="#202b27" metalness={0.58} roughness={0.48} />
            </mesh>

            {/* Left Wing: Giant Live-Synced RBMK Core Refuel Display // Right Wing: Giant Live K.O.M.R.A.D.-84 Comms Terminal */}
            {isLeft ? (
              <SovietRbmkCoreWallSynoptic3D />
            ) : (
              <SovietKomradCommsWallTerminal3D />
            )}

            {/* Vertical Conduit Riser */}
            <mesh position={[isLeft ? -1.72 : 1.72, 0.95, 0.24]} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.022, 0.022, 1.68, 8]} />
              <meshStandardMaterial color="#4c5652" metalness={0.72} roughness={0.4} />
            </mesh>
            <mesh position={[isLeft ? -1.72 : 1.72, 0.16, 0.24]} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.04, 0.044, 0.03, 8]} />
              <meshStandardMaterial color="#1d2521" metalness={0.68} roughness={0.44} />
            </mesh>

            {/* Base Toe-Kick */}
            <mesh position={[0, 0.075, 0.04]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[3.78, 0.15, 0.48]} />
              <meshStandardMaterial color="#141917" metalness={0.62} roughness={0.55} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
});

/**
 * Shared Authentic 1984 Soviet Operator & Supervisor Ergonomic Swivel Chair (MCR / Shift Chief).
 * Features a 5-leg caster base with twin rubber wheels, central pneumatic column + bellows boot,
 * circular foot-ring, continuous steel L-spine bracket, and beveled/stitched Soviet leatherette cushions.
 */
const SovietErgonomicSwivelChair3D: React.FC<{
  position: readonly [number, number, number];
  rotY: number;
  cushionColor?: string;
}> = React.memo(({ position, rotY, cushionColor = "#4a1e1a" }) => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  const legAngles = useMemo(
    () => [0, 1, 2, 3, 4].map((i) => (i * Math.PI * 2) / 5),
    [],
  );

  const stitchedLeatherTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        // Subtle matte vinyl grain
        for (let i = 0; i < 180; i++) {
          const px = (i * 47 + 13) % w;
          const py = (i * 83 + 29) % h;
          ctx.fillStyle = i % 2 === 0 ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.05)";
          ctx.fillRect(px, py, 2, 2);
        }
        // Darkened edge bevel shading
        ctx.strokeStyle = "rgba(0,0,0,0.38)";
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        // Pleated horizontal upholstery channels
        ctx.strokeStyle = "rgba(0,0,0,0.28)";
        ctx.lineWidth = 3;
        for (const py of [34, 64, 94]) {
          ctx.beginPath();
          ctx.moveTo(14, py);
          ctx.lineTo(w - 14, py);
          ctx.stroke();
        }
        // Double tan saddle-stitch seam around perimeter
        ctx.strokeStyle = "rgba(230,210,175,0.55)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(11, 11, w - 22, h - 22);
        ctx.setLineDash([]);
      }),
    [],
  );

  const chairMats = useMemo(
    () => ({
      castIron: new THREE.MeshStandardMaterial({
        color: "#1a211e",
        metalness: 0.72,
        roughness: 0.44,
        bumpMap: ironTex.bumpMap,
        bumpScale: 0.006,
      }),
      darkSteel: new THREE.MeshStandardMaterial({
        color: "#222a26",
        metalness: 0.68,
        roughness: 0.46,
      }),
      chrome: new THREE.MeshStandardMaterial({
        color: "#9aa4aa",
        metalness: 0.88,
        roughness: 0.24,
      }),
      brass: new THREE.MeshStandardMaterial({
        color: "#94804f",
        metalness: 0.86,
        roughness: 0.28,
        bumpMap: brassTex.bumpMap,
        bumpScale: 0.004,
      }),
      rubber: new THREE.MeshStandardMaterial({
        color: "#111312",
        roughness: 0.84,
        metalness: 0.08,
      }),
      bakelite: new THREE.MeshStandardMaterial({
        color: "#181615",
        roughness: 0.56,
        metalness: 0.2,
      }),
      cushion: new THREE.MeshStandardMaterial({
        map: stitchedLeatherTex,
        color: cushionColor,
        roughness: 0.66,
        metalness: 0.08,
      }),
    }),
    [brassTex.bumpMap, cushionColor, ironTex.bumpMap, stitchedLeatherTex],
  );

  const chairGeos = useMemo(
    () => ({
      centerHub: new THREE.CylinderGeometry(0.064, 0.086, 0.068, 16),
      pneumaticCol: new THREE.CylinderGeometry(0.028, 0.032, 0.31, 14),
      bellowsRing: new THREE.TorusGeometry(0.036, 0.008, 6, 14),
      footRing: new THREE.TorusGeometry(0.165, 0.01, 8, 22),
      footSpoke: new THREE.BoxGeometry(0.014, 0.01, 0.165),
      legArm: new THREE.BoxGeometry(0.038, 0.028, 0.265),
      legScuff: new THREE.BoxGeometry(0.018, 0.006, 0.21),
      casterPin: new THREE.CylinderGeometry(0.009, 0.009, 0.032, 8),
      casterFork: new THREE.BoxGeometry(0.036, 0.024, 0.024),
      casterWheel: new THREE.CylinderGeometry(0.021, 0.021, 0.012, 12),
      seatPan: new THREE.BoxGeometry(0.47, 0.024, 0.44),
      seatCushion: new THREE.BoxGeometry(0.45, 0.056, 0.41),
      seatBolster: new THREE.CylinderGeometry(0.028, 0.028, 0.45, 12),
      seatTrim: new THREE.BoxGeometry(0.016, 0.048, 0.41),
      mechBox: new THREE.BoxGeometry(0.16, 0.046, 0.18),
      spineHoriz: new THREE.BoxGeometry(0.072, 0.024, 0.26),
      spineVert: new THREE.BoxGeometry(0.068, 0.39, 0.024),
      spineBackPlate: new THREE.BoxGeometry(0.19, 0.15, 0.014),
      backShell: new THREE.BoxGeometry(0.43, 0.34, 0.022),
      backCushion: new THREE.BoxGeometry(0.41, 0.31, 0.048),
      backBolster: new THREE.CylinderGeometry(0.024, 0.024, 0.41, 12),
      armPost: new THREE.BoxGeometry(0.022, 0.175, 0.032),
      armBar: new THREE.BoxGeometry(0.022, 0.022, 0.24),
      armPad: new THREE.BoxGeometry(0.052, 0.026, 0.29),
    }),
    [],
  );

  return (
    <group position={[position[0], position[1], position[2]]} rotation={[0, rotY, 0]}>
      {/* 1. 5-Leg Cast-Steel Caster Base + Twin Rubber Caster Wheels */}
      <mesh
        position={[0, 0.064, 0]}
        geometry={chairGeos.centerHub}
        material={chairMats.castIron}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />
      {legAngles.map((ang, idx) => (
        <group key={`leg-${idx}`} rotation={[0, ang, 0]}>
          <mesh
            position={[0, 0.056, 0.145]}
            rotation={[0.09, 0, 0]}
            geometry={chairGeos.legArm}
            material={chairMats.darkSteel}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          />
          <mesh
            position={[0, 0.072, 0.15]}
            rotation={[0.09, 0, 0]}
            geometry={chairGeos.legScuff}
            material={chairMats.chrome}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          />
          {/* Swivel Pin + Fork + Twin Caster Wheels */}
          <mesh
            position={[0, 0.035, 0.265]}
            geometry={chairGeos.casterPin}
            material={chairMats.chrome}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          />
          <mesh
            position={[0, 0.025, 0.272]}
            geometry={chairGeos.casterFork}
            material={chairMats.castIron}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          />
          {([-0.015, 0.015] as const).map((wx, wIdx) => (
            <mesh
              key={`wheel-${idx}-${wIdx}`}
              position={[wx, 0.021, 0.275]}
              rotation={[0, 0, Math.PI / 2]}
              geometry={chairGeos.casterWheel}
              material={chairMats.rubber}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            />
          ))}
        </group>
      ))}

      {/* 2. Central Pneumatic Cylinder, Rubber Bellows & Brass Foot-Ring */}
      <mesh
        position={[0, 0.225, 0]}
        geometry={chairGeos.pneumaticCol}
        material={chairMats.chrome}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />
      {([0.115, 0.145, 0.175] as const).map((by, bIdx) => (
        <mesh
          key={`bellow-${bIdx}`}
          position={[0, by, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          geometry={chairGeos.bellowsRing}
          material={chairMats.rubber}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />
      ))}
      <mesh
        position={[0, 0.145, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        geometry={chairGeos.footRing}
        material={chairMats.brass}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />
      {([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2] as const).map((sa, sIdx) => (
        <group key={`foot-spoke-${sIdx}`} rotation={[0, sa, 0]}>
          <mesh
            position={[0, 0.145, 0.084]}
            geometry={chairGeos.footSpoke}
            material={chairMats.darkSteel}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          />
        </group>
      ))}

      {/* 3. Under-Seat Mechanism Box, Height Adjustment Knob & Steel L-Spine Bracket */}
      <mesh
        position={[0, 0.365, 0]}
        geometry={chairGeos.mechBox}
        material={chairMats.castIron}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />
      <mesh
        position={[0.11, 0.36, -0.02]}
        rotation={[0, 0, Math.PI / 2]}
        geometry={chairGeos.casterPin}
        material={chairMats.chrome}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />
      <mesh
        position={[0.135, 0.36, -0.02]}
        rotation={[0, 0, Math.PI / 2]}
        geometry={chairGeos.casterWheel}
        material={chairMats.bakelite}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />
      {/* Continuous L-Spine Horizontal Channel + Rear Spring-Steel Upright + Back Mounting Plate */}
      <mesh
        position={[0, 0.368, 0.13]}
        geometry={chairGeos.spineHoriz}
        material={chairMats.darkSteel}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />
      <mesh
        position={[0, 0.565, 0.252]}
        rotation={[0.09, 0, 0]}
        geometry={chairGeos.spineVert}
        material={chairMats.darkSteel}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />
      <mesh
        position={[0, 0.74, 0.244]}
        rotation={[0.08, 0, 0]}
        geometry={chairGeos.spineBackPlate}
        material={chairMats.castIron}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />

      {/* 4. Pressed Steel Seat Pan + Stitched & Beveled Leatherette Seat Cushion */}
      <mesh
        position={[0, 0.392, 0]}
        geometry={chairGeos.seatPan}
        material={chairMats.castIron}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />
      <mesh
        position={[0, 0.425, 0.01]}
        geometry={chairGeos.seatCushion}
        material={chairMats.cushion}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />
      <mesh
        position={[0, 0.425, -0.195]}
        rotation={[0, 0, Math.PI / 2]}
        geometry={chairGeos.seatBolster}
        material={chairMats.cushion}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />
      {([-0.228, 0.228] as const).map((sx, sIdx) => (
        <mesh
          key={`seat-trim-${sIdx}`}
          position={[sx, 0.415, 0.01]}
          geometry={chairGeos.seatTrim}
          material={chairMats.bakelite}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />
      ))}

      {/* 5. Stitched & Beveled Leatherette Backrest With Pressed Steel Shell */}
      <group position={[0, 0.745, 0.212]} rotation={[0.08, 0, 0]}>
        <mesh
          position={[0, 0, 0.022]}
          geometry={chairGeos.backShell}
          material={chairMats.castIron}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />
        <mesh
          position={[0, 0, -0.004]}
          geometry={chairGeos.backCushion}
          material={chairMats.cushion}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />
        <mesh
          position={[0, 0.155, -0.004]}
          rotation={[0, 0, Math.PI / 2]}
          geometry={chairGeos.backBolster}
          material={chairMats.cushion}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />
        <mesh
          position={[0, -0.155, -0.004]}
          rotation={[0, 0, Math.PI / 2]}
          geometry={chairGeos.backBolster}
          material={chairMats.cushion}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />
      </group>

      {/* 6. Bent-Steel Side Brackets & Beveled Bakelite Armrests */}
      {([-0.246, 0.246] as const).map((ax, aIdx) => (
        <group key={`arm-${aIdx}`} position={[ax, 0, 0]}>
          <mesh
            position={[0, 0.475, 0.06]}
            rotation={[0.14, 0, 0]}
            geometry={chairGeos.armPost}
            material={chairMats.darkSteel}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          />
          <mesh
            position={[0, 0.545, 0.01]}
            geometry={chairGeos.armBar}
            material={chairMats.darkSteel}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          />
          <mesh
            position={[0, 0.568, 0.01]}
            geometry={chairGeos.armPad}
            material={chairMats.bakelite}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          />
        </group>
      ))}
    </group>
  );
});

/**
 * Shift Supervisor Desk Surround (Shift Chief Desk around `[0, 0, +1.80]`) + Ergonomic Swivel Chair.
 * Frames `InspectorDesk3D`'s side pedestals solidly from floor to desktop underside (`y = 0.70m`)
 * without clipping above `InspectorDesk3D`'s `y = 0.725m` desktop surface.
 */
const SovietSupervisorDeskSurroundAndChair3D: React.FC = React.memo(() => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);

  return (
    <group>
      {/* 1. Wraparound Supervisor Desk Outer Base Collar & Recessed Modesty Panel (`[0, 0, +1.80]`) */}
      <group position={[0, 0, 1.8]}>
        {/* Heavy Stepped Steel Floor Plinth Under Supervisor Desk (`y = 0.013..0.037m`, strictly above trench & clear of InspectorDesk3D plinth) */}
        <mesh position={[0, 0.025, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.44, 0.024, 1.06]} />
          <meshStandardMaterial
            color="#151b18"
            metalness={0.64}
            roughness={0.54}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>

        {/* Modesty Front Screen Facing Operator Row (`z = -0.42`, recessed cleanly behind InspectorDesk3D front face) */}
        <mesh position={[0, 0.38, -0.42]} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.56, 0.64, 0.04]} />
          <meshStandardMaterial color="#1d2622" metalness={0.54} roughness={0.52} />
        </mesh>
      </group>

      {/* 2. Authentic Soviet Supervisor Swivel Chair (behind desk at `x = -0.28, z = +2.74`) */}
      <SovietErgonomicSwivelChair3D
        position={[-0.28, 0.005, 2.74]}
        rotY={0.24}
        cushionColor="#3b1b18"
      />
    </group>
  );
});

/**
 * Heavy Floor-to-Ceiling High-Voltage Switchgear Enclosure Framing `UNIT C` tucked cleanly at `x = -5.16, z = +1.42`, facing `+X`.
 */
const SovietLeftWallSwitchgearAlcove3D: React.FC = React.memo(() => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const hvHazardTex = useMemo(() => createHazardStripeTexture(256, 64, 22), []);
  const hvPlaqueTex = useMemo(
    () =>
      createNearestCanvasTexture(512, 256, (ctx, w, h) => {
        ctx.fillStyle = "#e6dec3";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#141414";
        ctx.lineWidth = 10;
        ctx.strokeRect(6, 6, w - 12, h - 12);
        ctx.fillStyle = "#ffb000";
        ctx.fillRect(18, 18, w - 36, 62);
        ctx.fillStyle = "#141414";
        ctx.font = 'bold 34px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("6 KV SWITCHGEAR // UNIT C", w / 2, 62, w - 52);
        ctx.fillStyle = "#c81919";
        ctx.font = 'bold 28px "Kremlin", "VT323", monospace';
        ctx.fillText("3000 MWH STATION BATTERY", w / 2, 150, w - 44);
        ctx.fillStyle = "#141414";
        ctx.font = 'bold 22px "Kremlin", "VT323", monospace';
        ctx.fillText("UNIT C // 3000 MWH STATION BATTERY", w / 2, 212, w - 44);
      }),
    [],
  );

  const hvVoltDialTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 128, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        ctx.fillStyle = "#e6dec3";
        ctx.beginPath();
        ctx.arc(cx, cy, 58, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#141414";
        ctx.lineWidth = 4;
        ctx.stroke();
        for (let i = 0; i <= 10; i++) {
          const ang = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
          ctx.strokeStyle = i >= 8 ? "#c81919" : "#141414";
          ctx.lineWidth = i % 2 === 0 ? 3 : 1.5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * 40, cy + Math.sin(ang) * 40);
          ctx.lineTo(cx + Math.cos(ang) * 52, cy + Math.sin(ang) * 52);
          ctx.stroke();
        }
        ctx.fillStyle = "#141414";
        ctx.font = 'bold 18px "Kremlin", "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("6.0 KV", cx, cy + 28, 84);
        ctx.strokeStyle = "#c81919";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 28, cy - 26);
        ctx.stroke();
      }),
    [],
  );

  const hvMats = useMemo(
    () => ({
      cellBody: new THREE.MeshStandardMaterial({
        color: "#2b3d36",
        metalness: 0.54,
        roughness: 0.54,
        bumpMap: ironTex.bumpMap,
        bumpScale: 0.006,
      }),
      doorPanel: new THREE.MeshStandardMaterial({
        color: "#202e28",
        metalness: 0.56,
        roughness: 0.5,
      }),
      channelFrame: new THREE.MeshStandardMaterial({
        color: "#161d1a",
        metalness: 0.66,
        roughness: 0.46,
      }),
      louverSlot: new THREE.MeshStandardMaterial({
        color: "#0e1311",
        metalness: 0.55,
        roughness: 0.6,
      }),
      brass: new THREE.MeshStandardMaterial({
        color: "#b8a46b",
        metalness: 0.86,
        roughness: 0.28,
      }),
      chrome: new THREE.MeshStandardMaterial({
        color: "#c8d2ce",
        metalness: 0.88,
        roughness: 0.24,
      }),
      redGrip: new THREE.MeshStandardMaterial({
        color: "#b8241e",
        roughness: 0.48,
        metalness: 0.16,
      }),
      conduit: new THREE.MeshStandardMaterial({
        color: "#44504b",
        metalness: 0.72,
        roughness: 0.4,
      }),
    }),
    [ironTex.bumpMap],
  );

  const hvConduitGeo = useMemo(
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 3.74, 0.78),
          new THREE.Vector3(0, 3.84, 0.9),
          new THREE.Vector3(0, 3.83, 1.03),
        ]),
        8,
        0.032,
        8,
        false,
      ),
    [],
  );

  return (
    <group position={[-5.83, 0, 1.42]} rotation={[0, Math.PI / 2, 0]}>
      {/* Rear Floor-to-Ceiling Main Steel Switchgear Housing Behind `UNIT C` (`y = 0.004..4.2m`, flush inside `-6.0m` wall) */}
      <mesh
        position={[0, 2.102, 0.28]}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      >
        <boxGeometry args={[3.86, 4.196, 0.64]} />
        <meshStandardMaterial
          color="#24352e"
          metalness={0.58}
          roughness={0.52}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
        />
      </mesh>
      {/* Stepped Steel Plinth Under `UNIT C` (recessed cleanly to eliminate z-fighting) */}
      <mesh
        position={[0, 0.066, 0.615]}
        material={hvMats.channelFrame}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      >
        <boxGeometry args={[2.04, 0.124, 0.63]} />
      </mesh>
      <mesh position={[0, 0.066, 0.946]} castShadow={false} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[2.0, 0.102]} />
        <meshStandardMaterial
          map={hvHazardTex}
          roughness={0.55}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      {/* Upper Header Soffit Above `UNIT C` (`y = 2.71..4.20m`) with HV Insulators, Hazard Trim & Conduit Ducts */}
      <mesh position={[0, 3.455, 0.6]} castShadow={false} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[2.1, 1.49, 0.46]} />
        <meshStandardMaterial color="#1d2722" metalness={0.62} roughness={0.5} />
      </mesh>
      <mesh position={[0, 2.8, 0.845]} castShadow={false} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[2.02, 0.14]} />
        <meshStandardMaterial
          map={hvHazardTex}
          roughness={0.5}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      {/* Overhead Curved Steel Conduit Ducts Tying Soffit Into Left Overhead Cable Tray */}
      {([-0.58, 0.58] as const).map((cx, cIdx) => (
        <mesh
          key={`hv-overhead-conduit-${cIdx}`}
          position={[cx, 0, 0]}
          geometry={hvConduitGeo}
          material={hvMats.conduit}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />
      ))}
      {/* Porcelain HV Busbar Insulators & Red HV Live Beacons on Upper Soffit */}
      {([-0.68, 0, 0.68] as const).map((ix, idx) => (
        <group key={`hv-bus-${idx}`} position={[ix, 3.24, 0.84]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.042, 0.048, 0.12, 12]} />
            <meshStandardMaterial color="#b86b3a" roughness={0.34} metalness={0.18} />
          </mesh>
          <mesh position={[0, 0.28, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.032, 10, 10]} />
            <meshStandardMaterial
              color="#ff2a2a"
              emissive="#ff2a2a"
              emissiveIntensity={1.35}
            />
          </mesh>
        </group>
      ))}
      {/* Detailed 3-Compartment Flanking `6 KV SWITCHGEAR` Cells (`lx = ±1.48m`) */}
      {([-1.48, 1.48] as const).map((lx, idx) => (
        <group key={`hv-locker-${idx}`} position={[lx, 0, 0.6]}>
          {/* Main Cell Steel Housing */}
          <mesh
            position={[0, 2.102, 0]}
            material={hvMats.cellBody}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.86, 4.196, 0.48]} />
          </mesh>
          {/* Horizontal Gunmetal Compartment Divider Channels */}
          {([0.14, 1.26, 2.42, 3.92] as const).map((cy, cIdx) => (
            <mesh
              key={`hv-div-${idx}-${cIdx}`}
              position={[0, cy, 0.244]}
              material={hvMats.channelFrame}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.84, 0.048, 0.024]} />
            </mesh>
          ))}
          {/* 3 Recessed Compartment Doors (Lower Cable, Middle Breaker, Upper Relay/Meter) */}
          {(
            [
              { y: 0.7, h: 1.02 },
              { y: 1.84, h: 1.04 },
              { y: 3.16, h: 1.38 },
            ] as const
          ).map((comp, cIdx) => (
            <group key={`hv-comp-${idx}-${cIdx}`} position={[0, comp.y, 0.245]}>
              <mesh
                material={hvMats.doorPanel}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <boxGeometry args={[0.7, comp.h, 0.022]} />
              </mesh>
              {/* Barrel Hinges */}
              {([-comp.h * 0.34, comp.h * 0.34] as const).map((hy, hIdx) => (
                <mesh
                  key={`hv-hinge-${idx}-${cIdx}-${hIdx}`}
                  position={[idx === 0 ? -0.345 : 0.345, hy, 0.012]}
                  material={hvMats.channelFrame}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                >
                  <cylinderGeometry args={[0.01, 0.01, 0.055, 6]} />
                </mesh>
              ))}
            </group>
          ))}
          {/* Lower Compartment Cooling Louvers */}
          {([0.44, 0.51, 0.58, 0.65, 0.72] as const).map((ly, lIdx) => (
            <mesh
              key={`hv-llouv-${idx}-${lIdx}`}
              position={[0, ly, 0.258]}
              rotation={[0.35, 0, 0]}
              material={hvMats.louverSlot}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.52, 0.022, 0.014]} />
            </mesh>
          ))}
          {/* 3D Rotary Isolator Switch Handle (`PR-10 Drive`) on Middle Breaker Door (left cell only; right cell hosts Auxiliary House Bus) */}
          {idx === 0 && (
            <group position={[0.04, 1.62, 0.262]}>
              <mesh
                material={hvMats.channelFrame}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <boxGeometry args={[0.14, 0.18, 0.024]} />
              </mesh>
              <mesh
                position={[0, 0, 0.022]}
                rotation={[Math.PI / 2, 0, 0]}
                material={hvMats.chrome}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.022, 0.026, 0.032, 10]} />
              </mesh>
              <group rotation={[0, 0, -0.48]}>
                <mesh
                  position={[0, 0.065, 0.04]}
                  material={hvMats.chrome}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                >
                  <boxGeometry args={[0.022, 0.13, 0.016]} />
                </mesh>
                <mesh
                  position={[0, 0.13, 0.052]}
                  rotation={[Math.PI / 2, 0, 0]}
                  material={hvMats.redGrip}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                >
                  <cylinderGeometry args={[0.018, 0.016, 0.052, 8]} />
                </mesh>
              </group>
            </group>
          )}
          {/* 3D Busbar Voltmeter Dial (`6.0 KV`) & 3 Phase Neon Indicator Lamps (`A • B • C`) */}
          <group position={[0, 2.94, 0.262]}>
            <mesh
              rotation={[Math.PI / 2, 0, 0]}
              material={hvMats.channelFrame}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.105, 0.112, 0.03, 16]} />
            </mesh>
            <mesh position={[0, 0, 0.018]} castShadow={false} raycast={NOOP_RAYCAST}>
              <circleGeometry args={[0.092, 16]} />
              <meshStandardMaterial
                map={hvVoltDialTex}
                roughness={0.5}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
          </group>
          {([-0.14, 0, 0.14] as const).map((px, pIdx) => {
            const lampCol =
              pIdx === 0 ? "#ff3b24" : pIdx === 1 ? "#ffb000" : "#33ff66";
            return (
              <group key={`hv-phase-${idx}-${pIdx}`} position={[px, 3.36, 0.262]}>
                <mesh
                  rotation={[Math.PI / 2, 0, 0]}
                  material={hvMats.channelFrame}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                >
                  <cylinderGeometry args={[0.024, 0.028, 0.022, 10]} />
                </mesh>
                <mesh position={[0, 0, 0.016]} castShadow={false} raycast={NOOP_RAYCAST}>
                  <sphereGeometry args={[0.016, 8, 8]} />
                  <meshStandardMaterial
                    color={lampCol}
                    emissive={lampCol}
                    emissiveIntensity={1.15}
                  />
                </mesh>
              </group>
            );
          })}
          {/* Inner Vertical Yellow-Black HV Hazard Strip Flanking `UNIT C` */}
          <mesh
            position={[idx === 0 ? 0.39 : -0.39, 1.35, 0.274]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <planeGeometry args={[2.56, 0.095]} />
            <meshStandardMaterial
              map={hvHazardTex}
              roughness={0.5}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
          <group position={[idx === 0 ? -0.04 : 0.04, 2.12, 0.288]}>
            <mesh
              position={[0, 0, -0.007]}
              material={hvMats.channelFrame}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.52, 0.26, 0.012]} />
            </mesh>
            <mesh position={[0, 0, 0.014]} castShadow={false} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.5, 0.25]} />
              <meshStandardMaterial
                map={hvPlaqueTex}
                roughness={0.45}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
          </group>
          <mesh
            position={[0.24, 1.18, 0.266]}
            material={hvMats.brass}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.032, 0.16, 0.025]} />
          </mesh>
        </group>
      ))}
    </group>
  );
});

/**
 * Rear Control Room Wall (`z = +4.64m` pocket center, facing `-Z`) with Proximity-Animated
 * Heavy Soviet Steel Airlock Double Exit Doors (`EXIT // AIRLOCK MCR-4`), Real See-Through
 * Circular Porthole Windows, Spinning Red Dogging Handwheel, Sliding Pocket Leaves,
 * Red-to-Green Status Beacons on Both Sides, and Enamel Radiation Control Signboard.
 */
const AIRLOCK_LEAF_CLOSED_X = 0.42;
const AIRLOCK_LEAF_SLIDE_TRAVEL = 0.65;

const SovietRearDoubleEntryDoors3D: React.FC = React.memo(() => {
  const activeLeafRef = useRef<THREE.Group>(null);
  const passiveLeafRef = useRef<THREE.Group>(null);
  const wheelCtrlRef = useRef<THREE.Group>(null);
  const wheelLobbyRef = useRef<THREE.Group>(null);
  const dogUpperGroupRef = useRef<THREE.Group>(null);
  const dogLowerGroupRef = useRef<THREE.Group>(null);
  const horizBoltsGroupRef = useRef<THREE.Group>(null);
  const latchLeverRef = useRef<THREE.Group>(null);
  const ctrlBeaconMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lobbyBeaconMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const audioPhaseRef = useRef({
    lastWantOpen: false,
    slideSoundFiredForOpen: false,
    slideSoundFiredForClose: true,
    endStopFiredForOpen: false,
    endStopFiredForClose: true,
  });

  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  const thresholdHazardTex = useMemo(
    () => createHazardStripeTexture(256, 48, 20),
    [],
  );

  const portholeGlassTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 128, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        const cx = w / 2;
        const cy = h / 2;
        const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, w * 0.52);
        grad.addColorStop(0, "rgba(182, 218, 206, 0.14)");
        grad.addColorStop(0.7, "rgba(110, 148, 134, 0.24)");
        grad.addColorStop(1, "rgba(32, 48, 42, 0.48)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        // Subtle wired reinforcement grid inside thick armored glass
        ctx.strokeStyle = "rgba(18, 24, 21, 0.55)";
        ctx.lineWidth = 2;
        for (let d = -h; d < w + h; d += 22) {
          ctx.beginPath();
          ctx.moveTo(d, 0);
          ctx.lineTo(d + h, h);
          ctx.moveTo(d + h, 0);
          ctx.lineTo(d, h);
          ctx.stroke();
        }
      }),
    [],
  );

  const exitLightboxTex = useMemo(
    () =>
      createNearestCanvasTexture(512, 112, (ctx, w, h) => {
        ctx.fillStyle = "#0b2416";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#33ff66";
        ctx.lineWidth = 5;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        ctx.fillStyle = "#33ff66";
        ctx.font = 'bold 44px "Kremlin", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("EXIT", w / 2, 54, w - 28);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 18px "Kremlin", "VT323", monospace';
        ctx.fillText("AIRLOCK MCR-4 • SPECIAL PASS ONLY", w / 2, 92, w - 28);
      }),
    [],
  );

  const lobbyLightboxTex = useMemo(
    () =>
      createNearestCanvasTexture(512, 112, (ctx, w, h) => {
        ctx.fillStyle = "#0b2416";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#33ff66";
        ctx.lineWidth = 5;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        ctx.fillStyle = "#33ff66";
        ctx.font = 'bold 34px "Kremlin", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("CONTROL HALL MCR-4", w / 2, 52, w - 28);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 18px "Kremlin", "VT323", monospace';
        ctx.fillText("AUTHORIZED OPERATORS ONLY", w / 2, 90, w - 28);
      }),
    [],
  );

  const warningPlaqueTex = useMemo(
    () =>
      createNearestCanvasTexture(256, 128, (ctx, w, h) => {
        ctx.fillStyle = "#e6dec3";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#ffb000";
        ctx.fillRect(6, 6, w - 12, 22);
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, w, 6);
        ctx.fillRect(0, h - 6, w, 6);
        ctx.fillRect(0, 0, 6, h);
        ctx.fillRect(w - 6, 0, 6, h);
        for (let sx = 10; sx < w - 18; sx += 26) {
          ctx.fillRect(sx, 6, 12, 22);
        }
        ctx.fillStyle = "#c81919";
        ctx.font = 'bold 17px "Kremlin", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("CONTROL HALL 4 // SECTOR 84", w / 2, 58, w - 24);
        ctx.fillStyle = "#141414";
        ctx.font = 'bold 14px "Kremlin", "Courier Prime", monospace';
        ctx.fillText("AUTHORIZED PERSONNEL ONLY", w / 2, 86, w - 24);
        ctx.fillText("RADIATION CONTROL ZONE", w / 2, 110, w - 24);
      }),
    [],
  );

  const doorMats = useMemo(
    () => ({
      frameSteel: new THREE.MeshStandardMaterial({
        color: "#18201d",
        metalness: 0.7,
        roughness: 0.44,
        bumpMap: ironTex.bumpMap,
        bumpScale: 0.006,
      }),
      portholeBore: new THREE.MeshStandardMaterial({
        color: "#141b18",
        metalness: 0.72,
        roughness: 0.46,
        side: THREE.DoubleSide,
      }),
      rubberSeal: new THREE.MeshStandardMaterial({
        color: "#0e100f",
        roughness: 0.86,
        metalness: 0.08,
      }),
      leafBody: new THREE.MeshStandardMaterial({
        color: "#2b3932",
        metalness: 0.56,
        roughness: 0.5,
        bumpMap: ironTex.bumpMap,
        bumpScale: 0.007,
      }),
      recessedPanel: new THREE.MeshStandardMaterial({
        color: "#212d27",
        metalness: 0.54,
        roughness: 0.54,
      }),
      ribSteel: new THREE.MeshStandardMaterial({
        color: "#36463e",
        metalness: 0.62,
        roughness: 0.44,
      }),
      chrome: new THREE.MeshStandardMaterial({
        color: "#9aa4aa",
        metalness: 0.88,
        roughness: 0.24,
      }),
      brass: new THREE.MeshStandardMaterial({
        color: "#b8a46b",
        metalness: 0.86,
        roughness: 0.26,
        bumpMap: brassTex.bumpMap,
        bumpScale: 0.004,
      }),
      wheelRed: new THREE.MeshStandardMaterial({
        color: "#b8241c",
        metalness: 0.36,
        roughness: 0.44,
      }),
      bakelite: new THREE.MeshStandardMaterial({
        color: "#141414",
        roughness: 0.58,
        metalness: 0.16,
      }),
      conduit: new THREE.MeshStandardMaterial({
        color: "#4a5450",
        metalness: 0.72,
        roughness: 0.4,
      }),
      portholeGlass: new THREE.MeshStandardMaterial({
        map: portholeGlassTex,
        transparent: true,
        opacity: 0.88,
        roughness: 0.18,
        metalness: 0.16,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    }),
    [brassTex.bumpMap, ironTex.bumpMap, portholeGlassTex],
  );

  const doorGeos = useMemo(() => {
    // Leaf slab with genuine circular porthole cutout at (0, 0.47), r = 0.156
    const leafShape = new THREE.Shape();
    const lw = 0.415;
    const lh = 1.16;
    leafShape.moveTo(-lw, -lh);
    leafShape.lineTo(lw, -lh);
    leafShape.lineTo(lw, lh);
    leafShape.lineTo(-lw, lh);
    leafShape.closePath();
    const leafHole = new THREE.Path();
    leafHole.absarc(0, 0.47, 0.156, 0, Math.PI * 2, true);
    leafShape.holes.push(leafHole);
    const leafWithPorthole = new THREE.ExtrudeGeometry(leafShape, {
      depth: 0.056,
      bevelEnabled: false,
      curveSegments: 20,
    });
    leafWithPorthole.translate(0, 0, -0.028);

    // Upper recessed door plate with matching porthole cutout at local (0, 0.03)
    const upperShape = new THREE.Shape();
    const uw = 0.32;
    const uh = 0.47;
    upperShape.moveTo(-uw, -uh);
    upperShape.lineTo(uw, -uh);
    upperShape.lineTo(uw, uh);
    upperShape.lineTo(-uw, uh);
    upperShape.closePath();
    const upperHole = new THREE.Path();
    upperHole.absarc(0, 0.03, 0.156, 0, Math.PI * 2, true);
    upperShape.holes.push(upperHole);
    const upperPanelWithPorthole = new THREE.ExtrudeGeometry(upperShape, {
      depth: 0.008,
      bevelEnabled: false,
      curveSegments: 20,
    });
    upperPanelWithPorthole.translate(0, 0, -0.004);

    // Hollow outer steel flange ring around porthole cutout (r = 0.156..0.214)
    const ringShape = new THREE.Shape();
    ringShape.absarc(0, 0, 0.214, 0, Math.PI * 2, false);
    const ringHole = new THREE.Path();
    ringHole.absarc(0, 0, 0.156, 0, Math.PI * 2, true);
    ringShape.holes.push(ringHole);
    const portholeBezelRing = new THREE.ExtrudeGeometry(ringShape, {
      depth: 0.014,
      bevelEnabled: false,
      curveSegments: 20,
    });
    portholeBezelRing.translate(0, 0, -0.007);

    return {
      leafWithPorthole,
      upperPanelWithPorthole,
      portholeBezelRing,
      portholeBore: new THREE.CylinderGeometry(0.156, 0.156, 0.068, 20, 1, true),
      hexBolt: new THREE.CylinderGeometry(0.0085, 0.0085, 0.012, 6),
      portholeInnerRim: new THREE.TorusGeometry(0.162, 0.012, 8, 20),
      portholeCrossBar: new THREE.BoxGeometry(0.31, 0.012, 0.012),
      dogRod: new THREE.CylinderGeometry(0.0085, 0.0085, 0.94, 8),
      dogKeeper: new THREE.BoxGeometry(0.042, 0.034, 0.024),
      horizBoltBar: new THREE.BoxGeometry(0.26, 0.024, 0.014),
      horizBoltKeeper: new THREE.BoxGeometry(0.046, 0.048, 0.024),
      horizBoltCatch: new THREE.BoxGeometry(0.056, 0.046, 0.024),
      wheelRim: new THREE.TorusGeometry(0.106, 0.011, 8, 20),
      wheelSpoke: new THREE.BoxGeometry(0.205, 0.013, 0.009),
      wheelHubFlange: new THREE.CylinderGeometry(0.04, 0.046, 0.008, 12),
      wheelShaft: new THREE.CylinderGeometry(0.016, 0.018, 0.014, 10),
      wheelCap: new THREE.CylinderGeometry(0.021, 0.023, 0.015, 8),
    };
  }, []);

  const portholeBoltAngles = useMemo(
    () => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i * Math.PI) / 4),
    [],
  );

  useEffect(() => {
    return () => {
      thresholdHazardTex.dispose();
      portholeGlassTex.dispose();
      exitLightboxTex.dispose();
      lobbyLightboxTex.dispose();
      warningPlaqueTex.dispose();
      Object.values(doorMats).forEach((m) => m.dispose());
      Object.values(doorGeos).forEach((g) => g.dispose());
    };
  }, [
    doorGeos,
    doorMats,
    exitLightboxTex,
    lobbyLightboxTex,
    portholeGlassTex,
    thresholdHazardTex,
    warningPlaqueTex,
  ]);

  useFrame((_, delta) => {
    const dt = Math.min(0.1, delta);
    const gs = useGameStore.getState();
    const px = playerCameraPose.x;
    const pz = playerCameraPose.z;
    const dist = Math.hypot(px - AIRLOCK_DOOR_CENTER_X, pz - AIRLOCK_DOOR_CENTER_Z);
    const inThresholdCorridor =
      pz >= 4.18 && pz <= 5.1 && Math.abs(px - AIRLOCK_DOOR_CENTER_X) <= 1.0;

    if (gs.lobbyMenuPhase === "menu_locked") {
      airlockDoorState.wantOpen = false;
      airlockDoorState.wheelProgress = 0;
      airlockDoorState.openProgress = 0;
      airlockDoorState.menuUnlockElapsed = 0;
      audioPhaseRef.current.lastWantOpen = false;
    } else if (gs.lobbyMenuPhase === "door_opening") {
      airlockDoorState.menuUnlockElapsed += dt;
      airlockDoorState.wantOpen =
        airlockDoorState.menuUnlockElapsed >= AIRLOCK_MENU_UNLOCK_DELAY_SEC;
      if (pz < AIRLOCK_ENTRY_THRESHOLD_Z) {
        gs.setLobbyMenuPhase("entered_control_room");
      }
    } else if (dist <= AIRLOCK_OPEN_RADIUS || inThresholdCorridor) {
      airlockDoorState.wantOpen = true;
    } else if (dist >= AIRLOCK_CLOSE_RADIUS) {
      airlockDoorState.wantOpen = false;
    }

    const ap = audioPhaseRef.current;
    if (airlockDoorState.wantOpen !== ap.lastWantOpen) {
      ap.lastWantOpen = airlockDoorState.wantOpen;
      if (airlockDoorState.wantOpen) {
        ap.slideSoundFiredForOpen = false;
        ap.endStopFiredForOpen = false;
        if (airlockDoorState.openProgress <= 0.02 && airlockDoorState.wheelProgress < 0.95) {
          playAirlockWheelSpin(true);
        }
      } else {
        ap.slideSoundFiredForClose = false;
        ap.endStopFiredForClose = false;
        if (airlockDoorState.openProgress > 0.02) {
          playAirlockPneumaticSlide(false);
          ap.slideSoundFiredForClose = true;
        } else if (airlockDoorState.wheelProgress > 0.02) {
          playAirlockWheelSpin(false);
        }
      }
    }

    if (airlockDoorState.wantOpen) {
      if (airlockDoorState.wheelProgress < 1) {
        airlockDoorState.wheelProgress = Math.min(
          1,
          airlockDoorState.wheelProgress + dt / 0.62,
        );
      }
      if (airlockDoorState.wheelProgress >= 0.98) {
        if (!ap.slideSoundFiredForOpen && airlockDoorState.openProgress < 0.98) {
          ap.slideSoundFiredForOpen = true;
          playAirlockPneumaticSlide(true);
        }
        const prevOpen = airlockDoorState.openProgress;
        airlockDoorState.openProgress = Math.min(
          1,
          airlockDoorState.openProgress + dt / 0.92,
        );
        if (prevOpen < 1 && airlockDoorState.openProgress >= 1 && !ap.endStopFiredForOpen) {
          ap.endStopFiredForOpen = true;
          playAirlockEndStop(false);
        }
      }
    } else {
      if (airlockDoorState.openProgress > 0) {
        const prevOpen = airlockDoorState.openProgress;
        airlockDoorState.openProgress = Math.max(
          0,
          airlockDoorState.openProgress - dt / 0.88,
        );
        if (prevOpen > 0 && airlockDoorState.openProgress <= 0) {
          if (!ap.endStopFiredForClose) {
            ap.endStopFiredForClose = true;
            playAirlockEndStop(true);
          }
          playAirlockWheelSpin(false);
        }
      }
      if (airlockDoorState.openProgress <= 0.02 && airlockDoorState.wheelProgress > 0) {
        airlockDoorState.wheelProgress = Math.max(
          0,
          airlockDoorState.wheelProgress - dt / 0.62,
        );
      }
    }

    const wu = airlockDoorState.wheelProgress;
    const wheelEase = wu * wu * (3 - 2 * wu);
    const ou = airlockDoorState.openProgress;
    const openEase = ou * ou * (3 - 2 * ou);

    const wheelAngle = wheelEase * Math.PI * 3.0; // ~1.5 full turns
    if (wheelCtrlRef.current) {
      wheelCtrlRef.current.rotation.z = -wheelAngle;
    }
    if (wheelLobbyRef.current) {
      wheelLobbyRef.current.rotation.z = wheelAngle;
    }
    if (dogUpperGroupRef.current) {
      dogUpperGroupRef.current.position.y = 0.52 - wheelEase * 0.065;
    }
    if (dogLowerGroupRef.current) {
      dogLowerGroupRef.current.position.y = -0.52 + wheelEase * 0.065;
    }
    if (horizBoltsGroupRef.current) {
      horizBoltsGroupRef.current.position.x = wheelEase * 0.095;
    }
    if (latchLeverRef.current) {
      latchLeverRef.current.rotation.z = wheelEase * 0.65;
    }

    const slideOffset = openEase * AIRLOCK_LEAF_SLIDE_TRAVEL;
    if (activeLeafRef.current) {
      activeLeafRef.current.position.x = AIRLOCK_LEAF_CLOSED_X + slideOffset;
    }
    if (passiveLeafRef.current) {
      passiveLeafRef.current.position.x = -AIRLOCK_LEAF_CLOSED_X - slideOffset;
    }

    const isUnlocked = wu >= 0.95 || ou > 0.02;
    const targetColor = isUnlocked ? SCENE_COLOR_GREEN : SCENE_COLOR_RED;
    if (ctrlBeaconMatRef.current) {
      ctrlBeaconMatRef.current.color.copy(targetColor);
      ctrlBeaconMatRef.current.emissive.copy(targetColor);
      ctrlBeaconMatRef.current.emissiveIntensity = isUnlocked ? 1.25 : 1.15;
    }
    if (lobbyBeaconMatRef.current) {
      lobbyBeaconMatRef.current.color.copy(targetColor);
      lobbyBeaconMatRef.current.emissive.copy(targetColor);
      lobbyBeaconMatRef.current.emissiveIntensity = isUnlocked ? 1.25 : 1.15;
    }
  });

  return (
    <group position={[0, 0, AIRLOCK_DOOR_CENTER_Z]} rotation={[0, Math.PI, 0]}>
      {/* 1. Double-Sided Pocket Containment Frame & Raised Hazard Threshold */}
      {/* Top Overhead Frame Lintel Beam & Pocket Header */}
      <mesh position={[0, 2.46, 0]} material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[2.16, 0.16, 0.36]} />
      </mesh>
      {/* Left & Right Split Jamb Cheeks Leaving True Sliding Pocket Slot */}
      {([-0.92, 0.92] as const).map((fx, fIdx) => (
        <group key={`door-jamb-${fIdx}`} position={[fx, 0, 0]}>
          <mesh position={[0, 1.24, 0.115]} material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.16, 2.48, 0.09]} />
          </mesh>
          <mesh position={[0, 1.24, -0.115]} material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.16, 2.48, 0.09]} />
          </mesh>
          {/* Control-Room Corner Gusset Plate + Bolts */}
          <mesh position={[fIdx === 0 ? 0.03 : -0.03, 2.44, 0.166]} material={doorMats.ribSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.18, 0.18, 0.012]} />
          </mesh>
          {([-0.05, 0.05] as const).map((bx) =>
            ([-0.05, 0.05] as const).map((by) => (
              <mesh
                key={`jamb-bolt-${fIdx}-${bx}-${by}`}
                position={[(fIdx === 0 ? 0.03 : -0.03) + bx, 2.44 + by, 0.176]}
                rotation={[Math.PI / 2, 0, 0]}
                geometry={doorGeos.hexBolt}
                material={doorMats.brass}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              />
            )),
          )}
        </group>
      ))}

      {/* Rubber Airlock Perimeter Gasket Lip (Control Room & Lobby Sides) */}
      <mesh position={[0, 2.375, 0.12]} material={doorMats.rubberSeal} castShadow={false} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[1.68, 0.03, 0.04]} />
      </mesh>
      <mesh position={[0, 2.375, -0.12]} material={doorMats.rubberSeal} castShadow={false} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[1.68, 0.03, 0.04]} />
      </mesh>

      {/* Low-Profile Steel Floor Threshold Sill With Hazard Striping on Both Sides */}
      <mesh position={[0, 0.012, 0]} material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[1.92, 0.024, 0.36]} />
      </mesh>
      <mesh position={[0, 0.026, 0.145]} rotation={[-Math.PI / 2, 0, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[1.68, 0.05]} />
        <meshStandardMaterial
          map={thresholdHazardTex}
          roughness={0.55}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh position={[0, 0.026, -0.145]} rotation={[-Math.PI / 2, 0, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[1.68, 0.05]} />
        <meshStandardMaterial
          map={thresholdHazardTex}
          roughness={0.55}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* 2. Twin Animated Heavy Armored Containment Door Leaves (`localX = ±0.42` closed) */}
      {([-AIRLOCK_LEAF_CLOSED_X, AIRLOCK_LEAF_CLOSED_X] as const).map((dx, dIdx) => {
        const isActiveLeaf = dIdx === 1;
        return (
          <group
            key={`entry-leaf-${dIdx}`}
            ref={isActiveLeaf ? activeLeafRef : passiveLeafRef}
            position={[dx, 1.2, 0]}
          >
            {/* Main Armored Steel Leaf With Real Circular Porthole Cutout */}
            <mesh
              geometry={doorGeos.leafWithPorthole}
              material={doorMats.leafBody}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            />
            {/* Recessed Stamped Lower & Upper Door Panes on Both Faces */}
            {([0.03, -0.03] as const).map((faceZ, fIdx) => (
              <group key={`leaf-face-${dIdx}-${fIdx}`}>
                <mesh
                  position={[0, -0.58, faceZ]}
                  material={doorMats.recessedPanel}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                >
                  <boxGeometry args={[0.64, 0.78, 0.008]} />
                </mesh>
                <mesh
                  position={[0, 0.44, faceZ]}
                  geometry={doorGeos.upperPanelWithPorthole}
                  material={doorMats.recessedPanel}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                />
                {/* Stiffening Ribs */}
                {([-1.06, -0.14, 0.02, 0.98] as const).map((ry, rIdx) => (
                  <mesh
                    key={`leaf-hrib-${dIdx}-${fIdx}-${rIdx}`}
                    position={[0, ry, faceZ + (faceZ > 0 ? 0.006 : -0.006)]}
                    material={doorMats.ribSteel}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <boxGeometry args={[0.74, 0.034, 0.012]} />
                  </mesh>
                ))}
                {([-0.36, 0.36] as const).map((rx, rIdx) => (
                  <mesh
                    key={`leaf-vrib-${dIdx}-${fIdx}-${rIdx}`}
                    position={[rx, 0, faceZ + (faceZ > 0 ? 0.006 : -0.006)]}
                    material={doorMats.ribSteel}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <boxGeometry args={[0.032, 2.18, 0.012]} />
                  </mesh>
                ))}
                {/* Lower Steel Kickplate */}
                <mesh
                  position={[0, -1.03, faceZ + (faceZ > 0 ? 0.004 : -0.004)]}
                  material={doorMats.frameSteel}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                >
                  <boxGeometry args={[0.72, 0.22, 0.008]} />
                </mesh>
              </group>
            ))}

            {/* See-Through Circular Bolted Steel Porthole Inspection Window */}
            <group position={[0, 0.47, 0]}>
              <mesh
                rotation={[Math.PI / 2, 0, 0]}
                geometry={doorGeos.portholeBore}
                material={doorMats.portholeBore}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              />
              {([0.035, -0.035] as const).map((pz, pIdx) => (
                <group key={`porthole-face-${dIdx}-${pIdx}`} position={[0, 0, pz]}>
                  <mesh
                    geometry={doorGeos.portholeBezelRing}
                    material={doorMats.frameSteel}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  />
                  <mesh
                    geometry={doorGeos.portholeInnerRim}
                    material={doorMats.ribSteel}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  />
                  {portholeBoltAngles.map((ang, bIdx) => (
                    <mesh
                      key={`pbolt-${dIdx}-${pIdx}-${bIdx}`}
                      position={[Math.cos(ang) * 0.186, Math.sin(ang) * 0.186, pz > 0 ? 0.007 : -0.007]}
                      rotation={[Math.PI / 2, 0, 0]}
                      geometry={doorGeos.hexBolt}
                      material={doorMats.brass}
                      castShadow={false}
                      raycast={NOOP_RAYCAST}
                    />
                  ))}
                </group>
              ))}
              {/* Real Transparent Wired Armored Glass Pane (See Straight Into Lobby!) */}
              <mesh
                position={[0, 0, 0]}
                material={doorMats.portholeGlass}
                renderOrder={4}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <circleGeometry args={[0.156, 20]} />
              </mesh>
              <mesh
                geometry={doorGeos.portholeCrossBar}
                material={doorMats.frameSteel}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              />
              <mesh
                rotation={[0, 0, Math.PI / 2]}
                geometry={doorGeos.portholeCrossBar}
                material={doorMats.frameSteel}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              />
            </group>

            {/* Spinning Red Dogging Handwheel + Retracting Dog Rods & Deadbolts (Lobby-Left Leaf) / Grab Handles & Bolt Catches (Right Leaf) */}
            {isActiveLeaf ? (
              <>
                <group position={[-0.06, -0.06, 0]}>
                  {/* Control Room Face (`+Z`) Handwheel */}
                  <group position={[0, 0, 0.031]}>
                    <mesh rotation={[Math.PI / 2, 0, 0]} geometry={doorGeos.wheelHubFlange} material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST} />
                    <mesh position={[0, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]} geometry={doorGeos.wheelShaft} material={doorMats.brass} castShadow={false} raycast={NOOP_RAYCAST} />
                    <group ref={wheelCtrlRef} position={[0, 0, 0.017]}>
                      <mesh geometry={doorGeos.wheelRim} material={doorMats.wheelRed} castShadow={false} raycast={NOOP_RAYCAST} />
                      {([0, Math.PI / 3, (2 * Math.PI) / 3] as const).map((sa, sIdx) => (
                        <mesh
                          key={`wspk-c-${sIdx}`}
                          rotation={[0, 0, sa]}
                          geometry={doorGeos.wheelSpoke}
                          material={doorMats.wheelRed}
                          castShadow={false}
                          raycast={NOOP_RAYCAST}
                        />
                      ))}
                      <mesh rotation={[Math.PI / 2, 0, 0]} geometry={doorGeos.wheelCap} material={doorMats.brass} castShadow={false} raycast={NOOP_RAYCAST} />
                    </group>
                  </group>

                  {/* Lobby Face (`-Z`) Handwheel */}
                  <group position={[0, 0, -0.031]}>
                    <mesh rotation={[Math.PI / 2, 0, 0]} geometry={doorGeos.wheelHubFlange} material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST} />
                    <mesh position={[0, 0, -0.01]} rotation={[Math.PI / 2, 0, 0]} geometry={doorGeos.wheelShaft} material={doorMats.brass} castShadow={false} raycast={NOOP_RAYCAST} />
                    <group ref={wheelLobbyRef} position={[0, 0, -0.017]}>
                      <mesh geometry={doorGeos.wheelRim} material={doorMats.wheelRed} castShadow={false} raycast={NOOP_RAYCAST} />
                      {([0, Math.PI / 3, (2 * Math.PI) / 3] as const).map((sa, sIdx) => (
                        <mesh
                          key={`wspk-l-${sIdx}`}
                          rotation={[0, 0, sa]}
                          geometry={doorGeos.wheelSpoke}
                          material={doorMats.wheelRed}
                          castShadow={false}
                          raycast={NOOP_RAYCAST}
                        />
                      ))}
                      <mesh rotation={[Math.PI / 2, 0, 0]} geometry={doorGeos.wheelCap} material={doorMats.brass} castShadow={false} raycast={NOOP_RAYCAST} />
                    </group>
                  </group>

                  {/* Heavy Cam-Lever Latch Bar & Bakelite Grip (Control Room Side) */}
                  <group ref={latchLeverRef} position={[0.12, -0.08, 0.04]}>
                    <mesh material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST}>
                      <boxGeometry args={[0.042, 0.11, 0.014]} />
                    </mesh>
                    <mesh position={[0, -0.075, 0.008]} rotation={[0, 0, -0.25]} material={doorMats.chrome} castShadow={false} raycast={NOOP_RAYCAST}>
                      <boxGeometry args={[0.016, 0.15, 0.01]} />
                    </mesh>
                    <mesh position={[-0.018, -0.145, 0.01]} rotation={[0, 0, -0.25]} material={doorMats.bakelite} castShadow={false} raycast={NOOP_RAYCAST}>
                      <cylinderGeometry args={[0.012, 0.013, 0.08, 8]} />
                    </mesh>
                  </group>
                </group>

                {/* Upper & Lower Vertical Steel Locking Dog Rods Engaging Keepers on Both Sides */}
                <group position={[-0.06, 0, 0]}>
                  <group ref={dogUpperGroupRef} position={[0, 0.52, 0]}>
                    <mesh position={[0, 0, 0.036]} geometry={doorGeos.dogRod} material={doorMats.chrome} castShadow={false} raycast={NOOP_RAYCAST} />
                    <mesh position={[0, 0, -0.036]} geometry={doorGeos.dogRod} material={doorMats.chrome} castShadow={false} raycast={NOOP_RAYCAST} />
                  </group>
                  <group ref={dogLowerGroupRef} position={[0, -0.52, 0]}>
                    <mesh position={[0, 0, 0.036]} geometry={doorGeos.dogRod} material={doorMats.chrome} castShadow={false} raycast={NOOP_RAYCAST} />
                    <mesh position={[0, 0, -0.036]} geometry={doorGeos.dogRod} material={doorMats.chrome} castShadow={false} raycast={NOOP_RAYCAST} />
                  </group>
                  {([0.036, -0.036] as const).map((kz, kIdx) => (
                    <group key={`vkeeper-${kIdx}`} position={[0, 0, kz]}>
                      <mesh position={[0, 0.96, 0]} geometry={doorGeos.dogKeeper} material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST} />
                      <mesh position={[0, -0.96, 0]} geometry={doorGeos.dogKeeper} material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST} />
                    </group>
                  ))}
                </group>

                {/* Twin Horizontal Heavy Steel Deadbolt Bars & Fixed Guide Keepers */}
                {([0.16, -0.16] as const).map((by, bIdx) => (
                  <group key={`hkeeper-${bIdx}`} position={[-0.28, by, 0]}>
                    <mesh position={[0, 0, 0.037]} geometry={doorGeos.horizBoltKeeper} material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST} />
                    <mesh position={[0, 0, -0.037]} geometry={doorGeos.horizBoltKeeper} material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST} />
                  </group>
                ))}
                <group ref={horizBoltsGroupRef} position={[0, 0, 0]}>
                  {([0.16, -0.16] as const).map((by, bIdx) => (
                    <group key={`hbolt-${bIdx}`} position={[-0.32, by, 0]}>
                      <mesh position={[0, 0, 0.037]} geometry={doorGeos.horizBoltBar} material={doorMats.chrome} castShadow={false} raycast={NOOP_RAYCAST} />
                      <mesh position={[0, 0, -0.037]} geometry={doorGeos.horizBoltBar} material={doorMats.chrome} castShadow={false} raycast={NOOP_RAYCAST} />
                    </group>
                  ))}
                </group>
              </>
            ) : (
              <>
                {([0.042, -0.042] as const).map((hz, hIdx) => (
                  <group key={`grab-${hIdx}`} position={[0.14, -0.08, hz]}>
                    <mesh position={[0, 0.14, 0]} material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST}>
                      <boxGeometry args={[0.036, 0.036, 0.02]} />
                    </mesh>
                    <mesh position={[0, -0.14, 0]} material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST}>
                      <boxGeometry args={[0.036, 0.036, 0.02]} />
                    </mesh>
                    <mesh position={[0, 0, hz > 0 ? 0.014 : -0.014]} material={doorMats.chrome} castShadow={false} raycast={NOOP_RAYCAST}>
                      <cylinderGeometry args={[0.012, 0.012, 0.3, 10]} />
                    </mesh>
                  </group>
                ))}
                {/* Steel Deadbolt Catch Sockets Engaging Retracting Bolts */}
                {([0.16, -0.16] as const).map((by, bIdx) => (
                  <group key={`hcatch-${bIdx}`} position={[0.385, by, 0]}>
                    <mesh position={[0, 0, 0.037]} geometry={doorGeos.horizBoltCatch} material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST} />
                    <mesh position={[0, 0, -0.037]} geometry={doorGeos.horizBoltCatch} material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST} />
                  </group>
                ))}
              </>
            )}

            {/* Center Overlapping Astragal Weather-Seal Bar on Passive Leaf */}
            {!isActiveLeaf && (
              <mesh position={[0.415, 0, 0]} material={doorMats.ribSteel} castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.03, 2.3, 0.068]} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* 3A. Control Room Side `EXIT` Lightbox & Red->Green Status Beacon (`localZ = +0.20`) */}
      <group position={[0, 2.76, 0.2]}>
        <mesh material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.56, 0.34, 0.12]} />
        </mesh>
        <mesh position={[0, 0.18, 0.02]} material={doorMats.ribSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.62, 0.024, 0.16]} />
        </mesh>
        <mesh position={[0, 0, 0.074]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[1.46, 0.27]} />
          <meshStandardMaterial
            map={exitLightboxTex}
            emissive="#ffffff"
            emissiveMap={exitLightboxTex}
            emissiveIntensity={0.48}
            roughness={0.38}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
        <mesh position={[0.88, 0, -0.01]} rotation={[Math.PI / 2, 0, 0]} material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.042, 0.048, 0.05, 10]} />
        </mesh>
        <mesh position={[0.88, 0, 0.028]} castShadow={false} raycast={NOOP_RAYCAST}>
          <sphereGeometry args={[0.032, 10, 10]} />
          <meshStandardMaterial
            ref={ctrlBeaconMatRef}
            color="#ff2a2a"
            emissive="#ff2a2a"
            emissiveIntensity={1.15}
          />
        </mesh>
        <mesh position={[0, 0.39, -0.02]} material={doorMats.conduit} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.014, 0.014, 0.42, 8]} />
        </mesh>
      </group>

      {/* 3B. Lobby Side `CONTROL HALL MCR-4` Lightbox & Red->Green Status Beacon (`localZ = -0.20`) */}
      <group position={[0, 2.76, -0.2]} rotation={[0, Math.PI, 0]}>
        <mesh material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.56, 0.34, 0.12]} />
        </mesh>
        <mesh position={[0, 0.18, 0.02]} material={doorMats.ribSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.62, 0.024, 0.16]} />
        </mesh>
        <mesh position={[0, 0, 0.074]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[1.46, 0.27]} />
          <meshStandardMaterial
            map={lobbyLightboxTex}
            emissive="#ffffff"
            emissiveMap={lobbyLightboxTex}
            emissiveIntensity={0.48}
            roughness={0.38}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
        <mesh position={[-0.88, 0, -0.01]} rotation={[Math.PI / 2, 0, 0]} material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.042, 0.048, 0.05, 10]} />
        </mesh>
        <mesh position={[-0.88, 0, 0.028]} castShadow={false} raycast={NOOP_RAYCAST}>
          <sphereGeometry args={[0.032, 10, 10]} />
          <meshStandardMaterial
            ref={lobbyBeaconMatRef}
            color="#ff2a2a"
            emissive="#ff2a2a"
            emissiveIntensity={1.15}
          />
        </mesh>
      </group>

      {/* 4. Enamel Radiation Control Signboard Cleanly Centered Between Doors & Pillar 6 (`worldX = -1.685`) */}
      <group position={[1.685, 1.92, 0.182]}>
        <mesh material={doorMats.frameSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.82, 0.45, 0.026]} />
        </mesh>
        {([-0.37, 0.37] as const).map((bx) =>
          ([-0.19, 0.19] as const).map((by) => (
            <mesh
              key={`warn-bolt-${bx}-${by}`}
              position={[bx, by, 0.015]}
              rotation={[Math.PI / 2, 0, 0]}
              geometry={doorGeos.hexBolt}
              material={doorMats.brass}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            />
          )),
        )}
        <mesh position={[0, 0, 0.029]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.76, 0.39]} />
          <meshStandardMaterial
            map={warningPlaqueTex}
            roughness={0.42}
            metalness={0.18}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>
    </group>
  );
});

let bulkheadLampSharedCache: {
  ribbedGlassTex: THREE.CanvasTexture;
  castIron: THREE.MeshStandardMaterial;
  housingGreen: THREE.MeshStandardMaterial;
  wireSteel: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  conduit: THREE.MeshStandardMaterial;
  backplate: THREE.BoxGeometry;
  standoffBoss: THREE.CylinderGeometry;
  conduitPipe: THREE.CylinderGeometry;
  conduitClamp: THREE.BoxGeometry;
  gooseneckArm: THREE.CylinderGeometry;
  bellCap: THREE.CylinderGeometry;
  flangeCollar: THREE.CylinderGeometry;
  glassCyl: THREE.CylinderGeometry;
  glassDome: THREE.SphereGeometry;
  filamentBulb: THREE.SphereGeometry;
  cageUpperRing: THREE.TorusGeometry;
  cageLowerRing: THREE.TorusGeometry;
  cageRib: THREE.CylinderGeometry;
  cageCrossWire: THREE.CylinderGeometry;
  hexBolt: THREE.CylinderGeometry;
} | null = null;

function getBulkheadLampShared() {
  if (bulkheadLampSharedCache) return bulkheadLampSharedCache;
  const ironTex = getHammeredIronTextures();
  const brassTex = getBrushedBrassTextures();
  const ribbedGlassTex = createNearestCanvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = "#ffc96e";
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) {
      ctx.fillStyle = "rgba(180, 96, 16, 0.36)";
      ctx.fillRect(x, 0, 3, h);
      ctx.fillStyle = "rgba(255, 240, 200, 0.25)";
      ctx.fillRect(x + 4, 0, 2, h);
    }
    ctx.fillStyle = "rgba(140, 72, 10, 0.25)";
    for (let y = 16; y < h; y += 20) {
      ctx.fillRect(0, y, w, 2);
    }
  });
  bulkheadLampSharedCache = {
    ribbedGlassTex,
    castIron: new THREE.MeshStandardMaterial({
      color: "#18211b",
      metalness: 0.76,
      roughness: 0.42,
      bumpMap: ironTex.bumpMap,
      bumpScale: 0.006,
    }),
    housingGreen: new THREE.MeshStandardMaterial({
      color: "#223029",
      metalness: 0.7,
      roughness: 0.44,
    }),
    wireSteel: new THREE.MeshStandardMaterial({
      color: "#7a847e",
      metalness: 0.84,
      roughness: 0.32,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: "#b8a46b",
      metalness: 0.86,
      roughness: 0.28,
      bumpMap: brassTex.bumpMap,
      bumpScale: 0.004,
    }),
    conduit: new THREE.MeshStandardMaterial({
      color: "#4a5450",
      metalness: 0.72,
      roughness: 0.4,
    }),
    backplate: new THREE.BoxGeometry(0.15, 0.21, 0.024),
    standoffBoss: new THREE.CylinderGeometry(0.012, 0.014, 0.016, 8),
    conduitPipe: new THREE.CylinderGeometry(0.012, 0.012, 0.34, 8),
    conduitClamp: new THREE.BoxGeometry(0.044, 0.018, 0.022),
    gooseneckArm: new THREE.CylinderGeometry(0.018, 0.022, 0.115, 10),
    bellCap: new THREE.CylinderGeometry(0.048, 0.082, 0.056, 14),
    flangeCollar: new THREE.CylinderGeometry(0.09, 0.09, 0.02, 14),
    glassCyl: new THREE.CylinderGeometry(0.066, 0.062, 0.096, 16),
    glassDome: new THREE.SphereGeometry(
      0.062,
      16,
      10,
      0,
      Math.PI * 2,
      Math.PI * 0.5,
      Math.PI * 0.5,
    ),
    filamentBulb: new THREE.SphereGeometry(0.032, 10, 10),
    cageUpperRing: new THREE.TorusGeometry(0.078, 0.0045, 6, 16),
    cageLowerRing: new THREE.TorusGeometry(0.072, 0.0045, 6, 16),
    cageRib: new THREE.CylinderGeometry(0.004, 0.004, 0.125, 6),
    cageCrossWire: new THREE.CylinderGeometry(0.0038, 0.0038, 0.144, 6),
    hexBolt: new THREE.CylinderGeometry(0.007, 0.007, 0.01, 6),
  };
  return bulkheadLampSharedCache;
}

/**
 * Heavy Industrial Caged Tungsten Wall Bulkhead Fixture (`VZG-200`) mounted flush along
 * structural columns: cast-iron backplate, conduit stub, heavy collared cap, warm amber ribbed
 * glass dome, glowing filament bulb, and protective 3D wire cross-cage.
 */
const SovietWallPillarLamp3D: React.FC<{
  position: [number, number, number];
  rotY: number;
}> = React.memo(({ position, rotY }) => {
  const glassMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const domeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const bulbMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const shared = useMemo(() => getBulkheadLampShared(), []);
  const zone = position[2] >= 1.0 ? 1 : position[2] >= -1.7 ? 2 : 3;

  useFrame(() => {
    const gs = useGameStore.getState();
    const zLvl =
      zone === 1
        ? controlRoomPowerState.zone1
        : zone === 2
          ? controlRoomPowerState.zone2
          : controlRoomPowerState.zone3;

    if (zLvl <= 0.01) {
      if (glassMatRef.current) {
        glassMatRef.current.color.copy(SCENE_COLOR_SCONCE_OFF);
        glassMatRef.current.emissive.copy(SCENE_COLOR_BLACK);
        glassMatRef.current.emissiveIntensity = 0;
      }
      if (domeMatRef.current) {
        domeMatRef.current.color.copy(SCENE_COLOR_SCONCE_OFF);
        domeMatRef.current.emissive.copy(SCENE_COLOR_BLACK);
        domeMatRef.current.emissiveIntensity = 0;
      }
      if (bulbMatRef.current) {
        bulbMatRef.current.color.copy(SCENE_COLOR_BULB_OFF);
        bulbMatRef.current.emissive.copy(SCENE_COLOR_BLACK);
        bulbMatRef.current.emissiveIntensity = 0;
      }
      return;
    }

    if (glassMatRef.current) {
      if (gs.isBlackout) {
        glassMatRef.current.color.copy(SCENE_COLOR_SCONCE_BLACKOUT);
        glassMatRef.current.emissive.copy(SCENE_COLOR_SCONCE_BLACKOUT_EMISSIVE);
        glassMatRef.current.emissiveIntensity = 0.08 * zLvl;
      } else {
        glassMatRef.current.color.copy(SCENE_COLOR_SCONCE_NORM);
        glassMatRef.current.emissive.copy(SCENE_COLOR_SCONCE_NORM_EMISSIVE);
        glassMatRef.current.emissiveIntensity = 0.65 * zLvl;
      }
    }
    if (domeMatRef.current) {
      if (gs.isBlackout) {
        domeMatRef.current.color.copy(SCENE_COLOR_SCONCE_BLACKOUT);
        domeMatRef.current.emissive.copy(SCENE_COLOR_SCONCE_BLACKOUT_EMISSIVE);
        domeMatRef.current.emissiveIntensity = 0.06 * zLvl;
      } else {
        domeMatRef.current.color.copy(SCENE_COLOR_SCONCE_NORM);
        domeMatRef.current.emissive.copy(SCENE_COLOR_SCONCE_NORM_EMISSIVE);
        domeMatRef.current.emissiveIntensity = 0.58 * zLvl;
      }
    }
    if (bulbMatRef.current) {
      bulbMatRef.current.color.copy(SCENE_COLOR_BULB_NORM);
      bulbMatRef.current.emissive.copy(SCENE_COLOR_SCONCE_NORM_EMISSIVE);
      bulbMatRef.current.emissiveIntensity = (gs.isBlackout ? 0.06 : 1.35) * zLvl;
    }
  });

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Cast-Iron Backplate Mounted >=0.016m Proud of Column Face via 4 Corner Standoff Lugs */}
      <mesh
        position={[0, 0.02, 0.028]}
        geometry={shared.backplate}
        material={shared.castIron}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />
      {([-0.056, 0.056] as const).map((bx) =>
        ([-0.084, 0.084] as const).map((by) => (
          <group key={`lmp-lug-${bx}-${by}`} position={[bx, 0.02 + by, 0]}>
            <mesh
              position={[0, 0, 0.008]}
              rotation={[Math.PI / 2, 0, 0]}
              geometry={shared.standoffBoss}
              material={shared.castIron}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            />
            <mesh
              position={[0, 0, 0.038]}
              rotation={[Math.PI / 2, 0, 0]}
              geometry={shared.hexBolt}
              material={shared.brass}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            />
          </group>
        )),
      )}

      {/* Upper Vertical Steel Conduit Feed & Wall Clamp */}
      <mesh
        position={[0, 0.28, 0.022]}
        geometry={shared.conduitPipe}
        material={shared.conduit}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />
      <mesh
        position={[0, 0.36, 0.022]}
        geometry={shared.conduitClamp}
        material={shared.castIron}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />

      {/* Cast-Iron Gooseneck Bracket, Heavy Collared Cap & Gasket Flange */}
      <mesh
        position={[0, 0.055, 0.072]}
        rotation={[1.18, 0, 0]}
        geometry={shared.gooseneckArm}
        material={shared.castIron}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />
      <mesh
        position={[0, 0.028, 0.122]}
        geometry={shared.bellCap}
        material={shared.housingGreen}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />
      <mesh
        position={[0, -0.004, 0.122]}
        geometry={shared.flangeCollar}
        material={shared.castIron}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />

      {/* Warm Amber Ribbed Glass Dome + Inner Glowing Bulb */}
      <mesh
        position={[0, -0.058, 0.122]}
        geometry={shared.glassCyl}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      >
        <meshStandardMaterial
          ref={glassMatRef}
          map={shared.ribbedGlassTex}
          bumpMap={shared.ribbedGlassTex}
          bumpScale={0.005}
          color="#1c201e"
          emissive="#000000"
          emissiveIntensity={0}
          transparent
          opacity={0.86}
          roughness={0.22}
          metalness={0.1}
        />
      </mesh>
      <mesh
        position={[0, -0.106, 0.122]}
        geometry={shared.glassDome}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      >
        <meshStandardMaterial
          ref={domeMatRef}
          map={shared.ribbedGlassTex}
          color="#1c201e"
          emissive="#000000"
          emissiveIntensity={0}
          transparent
          opacity={0.84}
          roughness={0.22}
          metalness={0.1}
        />
      </mesh>
      <mesh
        position={[0, -0.066, 0.122]}
        geometry={shared.filamentBulb}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      >
        <meshStandardMaterial
          ref={bulbMatRef}
          color="#1a1d1b"
          emissive="#000000"
          emissiveIntensity={0}
        />
      </mesh>

      {/* Protective 3D Steel Wire Cross-Cage Around Glass Dome */}
      <mesh
        position={[0, -0.024, 0.122]}
        rotation={[Math.PI / 2, 0, 0]}
        geometry={shared.cageUpperRing}
        material={shared.wireSteel}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />
      <mesh
        position={[0, -0.106, 0.122]}
        rotation={[Math.PI / 2, 0, 0]}
        geometry={shared.cageLowerRing}
        material={shared.wireSteel}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      />
      {([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2] as const).map((ang, rIdx) => (
        <mesh
          key={`cage-rib-${rIdx}`}
          position={[Math.cos(ang) * 0.075, -0.068, 0.122 + Math.sin(ang) * 0.075]}
          geometry={shared.cageRib}
          material={shared.wireSteel}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />
      ))}
      {([0, Math.PI / 2] as const).map((ang, cIdx) => (
        <mesh
          key={`cage-cross-${cIdx}`}
          position={[0, -0.168, 0.122]}
          rotation={[Math.PI / 2, 0, ang]}
          geometry={shared.cageCrossWire}
          material={shared.wireSteel}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />
      ))}
    </group>
  );
});

/**
 * 3D Overhead Bulkhead Telemetry Board & 3D Camera Station Selector Rail
 */
const BunkerTelemetryAndControlRail3D: React.FC = React.memo(() => {
  const lastRightDrawRef = useRef(0);
  const rightStatusMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const prevXenonRef = useRef(0);
  const xenonBurningRef = useRef(false);

  const rightPanelGroupRef = useRef<THREE.Group>(null);
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  const toggleDragIdxRef = useRef<number | null>(null);
  const toggleDragCleanupRef = useRef<(() => void) | null>(null);
  const toggleLamp0 = useRef<THREE.MeshStandardMaterial | null>(null);
  const toggleLamp1 = useRef<THREE.MeshStandardMaterial | null>(null);
  const toggleLamp2 = useRef<THREE.MeshStandardMaterial | null>(null);
  const toggleLamp3 = useRef<THREE.MeshStandardMaterial | null>(null);
  const toggleBat0 = useRef<THREE.Group | null>(null);
  const toggleBat1 = useRef<THREE.Group | null>(null);
  const toggleBat2 = useRef<THREE.Group | null>(null);
  const toggleBat3 = useRef<THREE.Group | null>(null);
  const unitCBulbMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([
    null,
    null,
  ]);

  const toggleSpecs = useMemo(() => {
    const items = [
      { id: 0, label: "VENTILATION", sub: "-1.2 R/H (+15MW)", color: "#44ff77" },
      { id: 1, label: "AUDIO [M]", sub: "BUNKER SOUND", color: "#ffcc00" },
      { id: 2, label: "KGB LINE", sub: "DECODE ORDERS", color: "#44ff77" },
      { id: 3, label: "CONDENSER VAC", sub: "VACUUM / RESET", color: "#ffcc00" },
    ];
    return items.map((item) => ({
      ...item,
      texture: makePlaqueTex(item.label, item.sub, {
        width: 352,
        height: 104,
        titleSize: 27,
        subSize: 20,
        titleColor: item.color,
        titleStroke: item.color,
        subColor: "#ffffff",
        subStroke: "#ffffff",
        borderColor: "#b8a46b",
      }),
    }));
  }, []);

  const auxBusHeaderTex = useMemo(
    () =>
      makePlaqueTex("AUXILIARY HOUSE BUS", "UNIT C // 6KV SWITCHGEAR", {
        width: 512,
        height: 92,
        titleSize: 28,
        subSize: 18,
        titleColor: "#ffcc00",
        titleStroke: "#ffcc00",
        subColor: "#44ff77",
        subStroke: "#44ff77",
        borderColor: "#b8a46b",
      }),
    [],
  );

  const toggleLampRefs = [toggleLamp0, toggleLamp1, toggleLamp2, toggleLamp3];
  const toggleBatRefs = [toggleBat0, toggleBat1, toggleBat2, toggleBat3];
  const auxKomradIds = [
    "auxVentilation",
    "auxAudioMute",
    "auxKgbLine",
    "auxCondenserVac",
  ] as const;

  useEffect(() => {
    registerKomradControlObject("auxVentilation", toggleBat0.current, [
      0,
      0,
      0.055,
    ]);
    registerKomradControlObject("auxAudioMute", toggleBat1.current, [
      0,
      0,
      0.055,
    ]);
    registerKomradControlObject("auxKgbLine", toggleBat2.current, [
      0,
      0,
      0.055,
    ]);
    registerKomradControlObject("auxCondenserVac", toggleBat3.current, [
      0,
      0,
      0.055,
    ]);
    return () => {
      toggleDragCleanupRef.current?.();
      toggleDragCleanupRef.current = null;
      registerKomradControlObject("auxVentilation", null);
      registerKomradControlObject("auxAudioMute", null);
      registerKomradControlObject("auxKgbLine", null);
      registerKomradControlObject("auxCondenserVac", null);
    };
  }, []);

  // Load High-Detail Soviet `.glb` Mainframe Hardware from `public/models/`
  const terminalHousingGltf = useGLTF("./models/komrad_terminal_housing.glb");

  const terminalHousingModel = useMemo(() => {
    const cloned = terminalHousingGltf.scene.clone(true);
    // Strip legacy lower pedestal/keyboard meshes (y < 0.88) and scale upper CRT housing cleanly
    const legacyLowerMeshes: THREE.Object3D[] = [];
    for (const child of cloned.children) {
      if (child.position.y < 0.88) {
        legacyLowerMeshes.push(child);
      } else {
        child.position.x *= 1.58;
        child.position.y = 0.94 + (child.position.y - 0.88) * 1.48;
        child.scale.x *= 1.58;
        child.scale.y *= 1.48;
      }
    }
    for (const obj of legacyLowerMeshes) {
      cloned.remove(obj);
    }
    applySovietPBRToHierarchy(cloned);
    cloned.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.raycast = NOOP_RAYCAST;
        obj.castShadow = false;
        obj.receiveShadow = false;
      }
    });
    return cloned;
  }, [terminalHousingGltf.scene]);

  const crtHazardTex = useMemo(() => createHazardStripeTexture(256, 64, 24), []);

  const rightHeaderPlateTex = useMemo(
    () =>
      makePlaqueTex(
        "UNIT C // 3000 MWH STATION BATTERY",
        "ENERGY CREATED  •  BATTERY STORED  •  GRID DEMAND  •  AUX BUS",
        {
          width: 960,
          height: 120,
          titleSize: 23,
          subSize: 17,
          titleColor: "#ffcc00",
          titleStroke: "#ffcc00",
          subColor: "#44ff77",
          subStroke: "#44ff77",
          borderColor: "#b8a46b",
        },
      ),
    [],
  );

  const rightStatusTex = useMemo(() => createNearestCanvasTexture(1024, 208), []);

  useFrame(({ clock }) => {
    const s = useGameStore.getState();
    const t = clock.getElapsedTime();
    const z2 = controlRoomPowerState.zone2;

    for (let bi = 0; bi < unitCBulbMatRefs.current.length; bi++) {
      const bm = unitCBulbMatRefs.current[bi];
      if (!bm) continue;
      if (z2 <= 0.01 || s.isBlackout) {
        bm.color.copy(SCENE_COLOR_BULB_OFF);
        bm.emissive.copy(SCENE_COLOR_BLACK);
        bm.emissiveIntensity = 0;
      } else {
        bm.color.copy(SCENE_COLOR_BULB_NORM);
        bm.emissive.copy(SCENE_COLOR_SCONCE_NORM_EMISSIVE);
        bm.emissiveIntensity = 1.6 * z2;
      }
    }

        // Animate 4 Guarded Auxiliary Toggle Switches & Jewel Lamps on Right Flanking 6KV Switchgear Cabinet
    for (let i = 0; i < 4; i++) {
      const bat =
        i === 0
          ? toggleBat0.current
          : i === 1
            ? toggleBat1.current
            : i === 2
              ? toggleBat2.current
              : toggleBat3.current;
      const isOn =
        i === 0
          ? s.ventilationActive
          : i === 1
            ? !s.isMusicMuted
            : i === 2
              ? s.kgbLineActive
              : s.auxLoopBActive && !s.turbines[0]?.tripped;
      if (bat) {
        bat.rotation.x = THREE.MathUtils.lerp(
          bat.rotation.x,
          isOn ? -0.61 : 0.61,
          0.28,
        );
      }
      const lamp =
        i === 0
          ? toggleLamp0.current
          : i === 1
            ? toggleLamp1.current
            : i === 2
              ? toggleLamp2.current
              : toggleLamp3.current;
      if (lamp) {
        const activeCol =
          i === 3
            ? s.turbines[0]?.tripped
              ? SCENE_COLOR_RED
              : s.auxLoopBActive
                ? SCENE_COLOR_GREEN
                : SCENE_COLOR_AMBER
            : i === 1
              ? SCENE_COLOR_AMBER
              : SCENE_COLOR_GREEN;
        const lit = i === 3 ? true : isOn;
        lamp.color.copy(lit ? activeCol : SCENE_COLOR_LAMP_DARK);
        lamp.emissive.copy(lit ? activeCol : SCENE_COLOR_BLACK);
        lamp.emissiveIntensity = lit ? 1.4 : 0.05;
      }
    }

    // Pause background canvas telemetry redraws while K.O.M.R.A.D.-84 easter egg video is playing
    if (s.diagFeedActive) return;

    // Update UNIT C Master Overview Dashboard (`CRT-84C`, 1024x208) — throttled to <=10 Hz (0.105s)
    if (lastRightDrawRef.current > 0 && t - lastRightDrawRef.current < 0.105) return;
    lastRightDrawRef.current = t;
    if (Math.abs(s.xenon - prevXenonRef.current) > 0.05) {
      xenonBurningRef.current = s.xenon < prevXenonRef.current;
      prevXenonRef.current = s.xenon;
    } else if (s.thermalPower > 1800 && s.xenon > 18) {
      xenonBurningRef.current = true;
    }

    const energyCreatedRound = Math.round(s.energyCreatedMW);
    const batMWhRound = Math.round(s.batteryStoredMWh);
    const batPctRound = Math.round(s.batteryStoredPct);
    const dispatchedRound = Math.round(s.totalElectricalMW);
    const demandRound = Math.round(s.energyDemandMW);
    const wheelPctRound = Math.round(s.batteryOutputValve * 100);
    const steamBarRound = Math.round(s.drumPressure);
    const rodsPct = Math.round(s.controlRodLevel);
    const xenonRound = Math.round(s.xenon);
    const voidPct = Math.round(s.voidFraction * 100);
    const reactKey = Math.round(s.reactivity * 1000);

    const rSig = `${s.phase}|${s.tutorialPhase}|${energyCreatedRound}|${batMWhRound}|${batPctRound}|${dispatchedRound}|${demandRound}|${wheelPctRound}|${steamBarRound}|${rodsPct}|${xenonRound}|${xenonBurningRef.current}|${voidPct}|${reactKey}|${s.isBlackout}`;
    const rTex = rightStatusMatRef.current?.map as THREE.CanvasTexture | undefined;
    if (rTex && rTex.userData.lastSig !== rSig) {
      rTex.userData.lastSig = rSig;
      const canvas = rTex.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        paintUnitCMasterDashboardCRT(ctx, canvas.width, canvas.height, {
          energyCreatedMW: s.energyCreatedMW,
          batteryStoredMWh: s.batteryStoredMWh,
          batteryStoredPct: s.batteryStoredPct,
          dispatchedMW: s.totalElectricalMW,
          energyDemandMW: s.energyDemandMW,
          wheelPct: wheelPctRound,
          steamBar: s.drumPressure,
          reactivity: s.reactivity,
          rodsPct,
          xenonPct: s.xenon,
          xenonBurningOff: xenonBurningRef.current,
          voidPct,
          tutorialPhase: s.tutorialPhase,
          isBlackout: s.isBlackout,
        });
        rTex.needsUpdate = true;
      }
    }
  });

  const unitCMimicSegments = useMemo<readonly MimicSegmentSpec[]>(
    () => [
      // Left Cyan Accumulator Bus from raised Bank A (x=-0.63, y=1.06) up to ENERGY CREATED & ENERGY STORED gauges (y=1.79)
      { x: -0.745, y: 1.06, w: 0.23, h: 0.015, color: "#388898" },
      { x: -0.86, y: 1.425, w: 0.016, h: 0.73, color: "#388898" },
      { x: -0.74, y: 1.79, w: 0.24, h: 0.015, color: "#388898" },
      { x: -0.31, y: 1.79, w: 0.62, h: 0.015, color: "#c8a838" },
      // Center DC Busbar connecting raised Bank A (x=-0.63), Single BATTERY -> GRID Wheel (x=0), and Bank B (x=+0.63)
      { x: -0.315, y: 1.06, w: 0.63, h: 0.016, color: "#c8a838" },
      { x: 0.315, y: 1.06, w: 0.63, h: 0.016, color: "#c8a838" },
      // Right Copper Dispatch Busbar up right flank (x=+0.86) to ENERGY STORED & ENERGY DEMAND gauges (y=1.79)
      { x: 0.745, y: 1.06, w: 0.23, h: 0.015, color: "#c8a838" },
      { x: 0.86, y: 1.425, w: 0.016, h: 0.73, color: "#c8a838" },
      { x: 0.74, y: 1.79, w: 0.24, h: 0.015, color: "#c8a838" },
      { x: 0.31, y: 1.79, w: 0.62, h: 0.015, color: "#c8a838" },
    ],
    [],
  );

  const unitCMimicNodes = useMemo<readonly MimicNodeSpec[]>(
    () => [
      { x: -0.86, y: 1.79, color: "#388898" },
      { x: -0.86, y: 1.06, color: "#388898" },
      { x: -0.31, y: 1.79, color: "#c8a838" },
      { x: 0.31, y: 1.79, color: "#c8a838" },
      { x: 0.86, y: 1.79, color: "#c8a838" },
      { x: 0.86, y: 1.06, color: "#c8a838" },
    ],
    [],
  );

  const unitCRecessedWells = useMemo(
    () => [
      { x: 0, y: 0.81, w: 1.88, h: 0.94 },
    ],
    [],
  );

  return (
    <>
      {/* ============================================================
          3. LEFT-WALL SWITCHGEAR ALCOVE: UNIT C (1000 MWH STATION BATTERY & AUX BUS)
         ============================================================ */}
      <group
        ref={rightPanelGroupRef}
        position={[-5.16, 0.135, 1.42]}
        rotation={[0, Math.PI / 2, 0]}
        scale={0.97}
      >
        {/* Authentic Layered Soviet RBMK Blue-Grey / Olive-Grey Modular Steel Cabinet (`#485450`),
            Upper Canopy Overhang with 6 Annunciator Lamps, Console Ledge & Synoptic Mimic Lines */}
        <SovietModularSteelCabinet3D
          width={1.98}
          unitCode="C"
          annunciatorLabels={[
            "ENERGY GEN",
            "BATTERY %",
            "GRID DEMAND",
            "CHARGE FLOW",
            "STEAM BAR",
            "GRID ONLINE",
          ]}
          mimicSegments={unitCMimicSegments}
          mimicNodes={unitCMimicNodes}
          recessedWells={unitCRecessedWells}
          dividerY={1.305}
          lowerLedgeY={0.775}
          hideChartRecorders={true}
          hideStripMeters={true}
        />

        {/* Heavy Stepped Bevel Plates, Welded Seams, Proud Upper Corner L-Angle Iron Trim & Hex Bolts (outer edges clear of cheeks) */}
        <mesh position={[-1.036, 1.78, 0.044]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.024, 0.92, 0.034]} />
          <meshStandardMaterial
            color="#1e2422"
            metalness={0.7}
            roughness={0.42}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        <mesh position={[1.036, 1.78, 0.044]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.024, 0.92, 0.034]} />
          <meshStandardMaterial
            color="#1e2422"
            metalness={0.7}
            roughness={0.42}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        {[1.38, 1.64, 1.9, 2.16].map((by, bIdx) => (
          <group key={bIdx}>
            <mesh
              position={[-1.036, by, 0.065]}
              rotation={[Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.012, 0.012, 0.014, 6]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.85}
                roughness={0.28}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
            <mesh
              position={[1.036, by, 0.065]}
              rotation={[Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.012, 0.012, 0.014, 6]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.85}
                roughness={0.28}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
          </group>
        ))}

        {/* Top Riveted Header Plaque: Brass backing + clear of overhead canopy overhang */}
        <mesh position={[0, 2.095, 0.036]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.6, 0.146, 0.014]} />
          <meshStandardMaterial color="#b8a46b" metalness={0.82} roughness={0.32} />
        </mesh>
        <mesh position={[0, 2.095, 0.046]} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[1.58, 0.138]} />
          <meshStandardMaterial
            map={rightHeaderPlateTex}
            emissive="#ffffff"
            emissiveMap={rightHeaderPlateTex}
            emissiveIntensity={0.35}
            roughness={0.75}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>

        {/* Corner Gusset Plates (Proud >= 0.018m of Upper Frame & Lower Pedestal) & Overhead Hooded Panel Work-Lights */}
        {(
          [
            [-0.91, 2.15, 0.034],
            [0.91, 2.15, 0.034],
            [-0.91, 0.19, 0.506],
            [0.91, 0.19, 0.506],
          ] as const
        ).map(([gx, gy, gz], gIdx) => (
          <group key={gIdx} position={[gx, gy, gz]}>
            <mesh raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.11, 0.11, 0.016]} />
              <meshStandardMaterial
                color="#18211b"
                metalness={0.72}
                roughness={0.4}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
              />
            </mesh>
            {(
              [
                [-0.036, 0.036],
                [0.036, 0.036],
                [-0.036, -0.036],
                [0.036, -0.036],
              ] as const
            ).map(([bx, by], bIdx) => (
              <mesh
                key={bIdx}
                position={[bx, by, 0.012]}
                rotation={[Math.PI / 2, 0, 0]}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.008, 0.008, 0.01, 6]} />
                <meshStandardMaterial
                  color="#b8a46b"
                  metalness={0.86}
                  roughness={0.26}
                  bumpMap={brassTex.bumpMap}
                  bumpScale={0.005}
                />
              </mesh>
            ))}
          </group>
        ))}
        {[-0.58, 0.58].map((lx, lIdx) => (
          <group key={lIdx} position={[lx, 2.43, 0.08]}>
            <mesh position={[0, 0, -0.04]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.012, 0.014, 0.11, 8]} />
              <meshStandardMaterial color="#18211b" metalness={0.75} roughness={0.38} />
            </mesh>
            <mesh position={[0, -0.018, 0.028]} rotation={[0.45, 0, 0]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.024, 0.068, 0.065, 12]} />
              <meshStandardMaterial
                color="#23312b"
                metalness={0.68}
                roughness={0.4}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.006}
              />
            </mesh>
            <mesh position={[0, -0.036, 0.036]} raycast={NOOP_RAYCAST}>
              <sphereGeometry args={[0.018, 8, 8]} />
              <meshStandardMaterial
                ref={(el) => {
                  unitCBulbMatRefs.current[lIdx] = el;
                }}
                color="#1a1d1b"
                emissive="#000000"
                emissiveIntensity={0}
              />
            </mesh>
          </group>
        ))}

        {/* Upper Synoptic Bay — 3 Uncluttered Battery & Energy Dispatch Gauges */}
        <group position={[0, 1.79, 0.03]}>
          <HighDetailManometer3D
            position={[-0.62, 0, 0]}
            title="ENERGY CREATED"
            cyrillicSub="REACTOR OUTPUT"
            unit="0-1000 MW"
            serial="№ 84-C1"
            min={0}
            max={1000}
            safeBand={[500, 850]}
            dangerThreshold={960}
            getValue={() => useGameStore.getState().energyCreatedMW}
            getAlertLevel={(s) =>
              s.energyCreatedMW > 960
                ? "critical"
                : s.tutorialPhase === "COMPLETED" && s.energyCreatedMW < 200
                  ? "warn"
                  : "normal"
            }
          />
          <HighDetailManometer3D
            position={[0, 0, 0]}
            title="ENERGY STORED"
            cyrillicSub="BATTERY CHARGE"
            unit="0-100 %"
            serial="№ 84-C2"
            min={0}
            max={100}
            safeBand={[25, 95]}
            lowDangerThreshold={10}
            dangerThreshold={101}
            getValue={() => useGameStore.getState().batteryStoredPct}
            getAlertLevel={(s) =>
              s.batteryStoredPct < 8
                ? "critical"
                : s.batteryStoredPct < 20
                  ? "warn"
                  : "normal"
            }
          />
          <HighDetailManometer3D
            position={[0.62, 0, 0]}
            title="ENERGY DEMAND"
            cyrillicSub="OUTPUT VS DEMAND"
            unit="0-1000 MW"
            serial="№ 84-C3"
            min={0}
            max={1000}
            dangerThreshold={950}
            powerBalanceMode={true}
            getValue={() => useGameStore.getState().totalElectricalMW}
            secondaryGetValue={() => useGameStore.getState().energyDemandMW}
            getAlertLevel={(s) => {
              if (s.tutorialPhase !== "COMPLETED") return "normal";
              const diff = Math.abs(s.totalElectricalMW - s.energyDemandMW);
              return diff > 95 ? "critical" : diff > 30 ? "warn" : "normal";
            }}
          />
        </group>

        {/* Wide Master Telemetry Dashboard CRT (`CRT-84C`) on Angled Tier-2 Riser */}
        <group position={[0, 1.475, 0.042]} rotation={[-0.08, 0, 0]}>
          <SovietCRTMonitorBay3D
            position={[0, 0, 0]}
            screenMatRef={rightStatusMatRef}
            screenTexture={rightStatusTex}
            modelBadge="CRT-84C"
          />
        </group>

        {/* Full-Depth 3-Bay Energy Storage & Grid Dispatch Sloped Console Deck */}
        <group position={[0, 0.254, -0.013]} scale={0.84}>
          <UnitCBatteryStorageDeck3D />
        </group>
      </group>

      {/* Relocated Auxiliary House Bus Sub-Panel Mounted Flush on Right Flanking 6KV Switchgear Cabinet Door */}
      <group
        position={[-4.973, 1.58, -0.06]}
        rotation={[0, Math.PI / 2, 0]}
        scale={0.8}
      >
        <mesh position={[0, 0, 0.013]} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.78, 0.6, 0.03]} />
          <meshStandardMaterial
            color="#222a27"
            roughness={0.45}
            metalness={0.55}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>
        {(
          [
            [-0.355, 0.265],
            [0.355, 0.265],
            [-0.355, -0.265],
            [0.355, -0.265],
          ] as const
        ).map(([bx, by], bIdx) => (
          <mesh
            key={`aux-bolt-${bIdx}`}
            position={[bx, by, 0.032]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.012, 0.012, 0.01, 6]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.86}
              roughness={0.26}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
        ))}
        <mesh position={[0, 0.242, 0.033]} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.68, 0.072, 0.01]} />
          <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.242, 0.041]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.665, 0.064]} />
          <meshStandardMaterial
            map={auxBusHeaderTex}
            emissive="#ffffff"
            emissiveMap={auxBusHeaderTex}
            emissiveIntensity={0.35}
            roughness={0.65}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
        {toggleSpecs.map((tSpec, tIdx) => {
          const col = tIdx % 2;
          const row = Math.floor(tIdx / 2);
          const sx = col === 0 ? -0.185 : 0.185;
          const sy = row === 0 ? 0.018 : -0.228;
          const triggerToggle = () => {
            playSwitchClank(false);
            const s = useGameStore.getState();
            if (tIdx === 0) {
              s.toggleVentilation();
            } else if (tIdx === 1) {
              s.toggleMusicMute();
            } else if (tIdx === 2) {
              s.toggleKgbLine();
            } else if (s.turbines[0]?.tripped) {
              s.resetTurbineTrip();
            } else {
              s.toggleAuxLoopB();
            }
          };
          return (
            <group
              key={`aux-toggle-${tSpec.id}`}
              position={[sx, sy, 0.034]}
              onPointerOver={(e) => {
                e.stopPropagation();
                useGameStore
                  .getState()
                  .setHoveredControlHint(`${tSpec.label}: ${tSpec.sub}`);
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                useGameStore.getState().setHoveredControlHint(null);
              }}
              onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                toggleDragCleanupRef.current?.();
                const auxId = auxKomradIds[tIdx];
                if (auxId) notifyPlayerControlInteraction(auxId, true);
                toggleDragIdxRef.current = tIdx;
                const r3fTarget = e.target as unknown as {
                  setPointerCapture?: (id: number) => void;
                  releasePointerCapture?: (id: number) => void;
                };
                r3fTarget?.setPointerCapture?.(e.pointerId);

                let finished = false;
                const finish = (commit: boolean) => {
                  if (finished) return;
                  finished = true;
                  toggleDragCleanupRef.current = null;
                  if (toggleDragIdxRef.current === tIdx) {
                    toggleDragIdxRef.current = null;
                  }
                  if (auxId) notifyPlayerControlInteraction(auxId, false);
                  r3fTarget?.releasePointerCapture?.(e.pointerId);
                  window.removeEventListener("pointerup", onUp);
                  window.removeEventListener("pointercancel", onCancel);
                  window.removeEventListener("blur", onCancel);
                  if (commit) {
                    triggerToggle();
                  }
                };
                const onUp = () => finish(true);
                const onCancel = () => finish(false);
                toggleDragCleanupRef.current = () => finish(false);
                window.addEventListener("pointerup", onUp);
                window.addEventListener("pointercancel", onCancel);
                window.addEventListener("blur", onCancel);
              }}
            >
              <mesh position={[0, 0.045, 0.035]}>
                <boxGeometry args={[0.34, 0.23, 0.1]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
              <mesh position={[0, 0.112, 0.002]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.33, 0.098, 0.01]} />
                <meshStandardMaterial
                  color="#b8a46b"
                  metalness={0.85}
                  roughness={0.28}
                />
              </mesh>
              <mesh position={[0, 0.112, 0.01]} raycast={NOOP_RAYCAST}>
                <planeGeometry args={[0.318, 0.09]} />
                <meshStandardMaterial
                  map={tSpec.texture}
                  emissive="#ffffff"
                  emissiveMap={tSpec.texture}
                  emissiveIntensity={0.36}
                  roughness={0.65}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  polygonOffsetUnits={-2}
                />
              </mesh>
              <CagedSovietJewelLamp3D
                position={[-0.088, 0.0, 0.006]}
                lampMatRef={toggleLampRefs[tIdx]}
                scale={0.78}
              />
              <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.026, 0.029, 0.018, 6]} />
                <meshStandardMaterial
                  color="#b8a46b"
                  metalness={0.86}
                  roughness={0.26}
                  bumpMap={brassTex.bumpMap}
                  bumpScale={0.005}
                />
              </mesh>
              {[-0.032, 0.032].map((gx, gIdx) => (
                <mesh key={gIdx} position={[gx, 0, 0.016]} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.007, 0.068, 0.038]} />
                  <meshStandardMaterial
                    color="#b8a46b"
                    metalness={0.85}
                    roughness={0.28}
                  />
                </mesh>
              ))}
              <group ref={toggleBatRefs[tIdx]} position={[0, 0, 0.008]}>
                <mesh
                  position={[0, 0, 0.03]}
                  rotation={[Math.PI / 2, 0, 0]}
                  raycast={NOOP_RAYCAST}
                >
                  <cylinderGeometry args={[0.0105, 0.0065, 0.062, 10]} />
                  <meshStandardMaterial
                    color="#d8e2dc"
                    metalness={0.92}
                    roughness={0.18}
                  />
                </mesh>
              </group>
            </group>
          );
        })}
      </group>

      {/* 4. MONUMENTAL 3D BOLTED OLIVE-STEEL MASTER PROJECTION FRAME FOR K.O.M.R.A.D.-84 (~3.84m × 2.30m) */}
      <group
        position={TERMINAL_ROOT_POS}
        rotation={[TERMINAL_TILT_X, 0, 0]}
        scale={TERMINAL_SCALE}
      >
        <primitive object={terminalHousingModel} />
        {/* Single Recessed Backing Chassis Strictly Above Lower Synoptic Relay Doors (`y >= 1.04`) */}
        <mesh position={[0, 1.72, -0.12]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.46, 1.36, 0.24]} />
          <meshStandardMaterial
            color="#202c26"
            metalness={0.54}
            roughness={0.5}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>
        {/* Heavy Bolted Olive-Steel Side Ribs Framing K.O.M.R.A.D.-84 Glass */}
        {([-1.275, 1.275] as const).map((rx, rIdx) => (
          <group key={`komrad-rib-${rIdx}`} position={[rx, 1.69, 0.08]}>
            <mesh raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.15, 1.48, 0.26]} />
              <meshStandardMaterial
                color="#26362d"
                metalness={0.62}
                roughness={0.46}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
              />
            </mesh>
            {/* Side Cooling Louver Grilles */}
            {[-0.18, -0.06, 0.06, 0.18, 0.3].map((ly, lIdx) => (
              <mesh key={`rib-louver-${lIdx}`} position={[0, ly, 0.134]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.1, 0.024, 0.014]} />
                <meshStandardMaterial color="#0e1411" metalness={0.55} roughness={0.58} />
              </mesh>
            ))}
            {/* Brass Hex Bolts Along Vertical Rib */}
            {[-0.66, -0.34, 0.44, 0.68].map((by, bIdx) => (
              <mesh
                key={`rib-bolt-${bIdx}`}
                position={[0, by, 0.136]}
                rotation={[Math.PI / 2, 0, 0]}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.015, 0.015, 0.016, 6]} />
                <meshStandardMaterial
                  color="#b8a46b"
                  metalness={0.86}
                  roughness={0.26}
                  bumpMap={brassTex.bumpMap}
                  bumpScale={0.005}
                />
              </mesh>
            ))}
            {/* Lower Corner Hazard Striping Cheek (Clear above Bottom Bevel Apron) */}
            <mesh position={[0, -0.45, 0.146]} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.125, 0.26]} />
              <meshStandardMaterial
                map={crtHazardTex}
                roughness={0.5}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
          </group>
        ))}

        {/* Top Overhanging Olive-Steel Glare Hood (`y = 2.44m` local, proud of side ribs) */}
        <mesh position={[0, 2.44, 0.16]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.76, 0.08, 0.32]} />
          <meshStandardMaterial
            color="#23332a"
            metalness={0.62}
            roughness={0.46}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        {[-1.1, -0.55, 0, 0.55, 1.1].map((bx, idx) => (
          <mesh
            key={`hood-bolt-${idx}`}
            position={[bx, 2.44, 0.325]}
            rotation={[Math.PI / 2, 0, 0]}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.016, 0.016, 0.02, 6]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.85}
              roughness={0.28}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
        ))}

        {/* Bottom Heavy Bevel Apron With Cooling Louvers & Hazard Striping (proud of side ribs) */}
        <mesh position={[0, 0.99, 0.12]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.76, 0.14, 0.28]} />
          <meshStandardMaterial
            color="#26362d"
            metalness={0.62}
            roughness={0.46}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        {([-1.06, 1.06] as const).map((hx, hIdx) => (
          <mesh key={`crt-bot-haz-${hIdx}`} position={[hx, 0.99, 0.276]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.52, 0.095]} />
            <meshStandardMaterial
              map={crtHazardTex}
              roughness={0.5}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
        ))}
        {[-0.45, 0, 0.45].map((gx, gIdx) => (
          <group key={`crt-bot-louver-${gIdx}`} position={[gx, 0.99, 0.268]}>
            {[-0.032, 0, 0.032].map((ly, lIdx) => (
              <mesh key={lIdx} position={[0, ly, 0]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.38, 0.016, 0.012]} />
                <meshStandardMaterial color="#0e1411" metalness={0.55} roughness={0.58} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </>
  );
});

/**
 * Suspended Bunker Dust Motes (48 subtle drifting micro-pixel dust motes floating
 * lazily inside the overhead spotlight cone above the Inspector's Desk)
 */
const BunkerDustMotes3D: React.FC = React.memo(() => {
  const pointsRef = useRef<THREE.Points>(null);
  const pointsMatRef = useRef<THREE.PointsMaterial>(null);
  const lastUpdateRef = useRef(0);

  const { positions, seeds } = useMemo(() => {
    const count = 48;
    const posArr = new Float32Array(count * 3);
    const seedArr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const s1 = Math.sin(i * 12.9898 + 1.23) * 43758.5453;
      const s2 = Math.sin(i * 78.233 + 4.56) * 43758.5453;
      const s3 = Math.sin(i * 39.425 + 7.89) * 43758.5453;
      const u1 = s1 - Math.floor(s1);
      const u2 = s2 - Math.floor(s2);
      const u3 = s3 - Math.floor(s3);

      // Distributed within the spotlight cone above the desk
      const heightRatio = u2; // 0 (near desk) to 1 (near lamp)
      const maxRadius = 0.25 + (1 - heightRatio) * 0.95;
      const angle = u1 * Math.PI * 2;
      const r = Math.sqrt(u3) * maxRadius;

      posArr[i * 3] = Math.cos(angle) * r * 0.72;
      posArr[i * 3 + 1] = 0.78 + heightRatio * 1.42;
      posArr[i * 3 + 2] = 1.8 + Math.sin(angle) * r * 0.55;

      seedArr[i * 3] = u1 * Math.PI * 2;
      seedArr[i * 3 + 1] = 0.35 + u2 * 0.65;
      seedArr[i * 3 + 2] = u3 * Math.PI * 2;
    }
    return { positions: posArr, seeds: seedArr };
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  useFrame(({ clock }) => {
    const s = useGameStore.getState();
    if (pointsMatRef.current) {
      const dustOn =
        !s.isBlackout && s.powerAllocation.facility > 0
          ? controlRoomPowerState.zone1
          : 0;
      pointsMatRef.current.opacity = 0.055 * dustOn;
    }

    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    if (t - lastUpdateRef.current < 0.05) return;
    lastUpdateRef.current = t;

    const posAttr = pointsRef.current.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < 48; i++) {
      const phase = seeds[i * 3];
      const speed = seeds[i * 3 + 1];
      const phaseZ = seeds[i * 3 + 2];

      arr[i * 3] += Math.sin(t * 0.42 * speed + phase) * 0.0015;
      arr[i * 3 + 1] += Math.cos(t * 0.31 * speed + phaseZ) * 0.001;
      arr[i * 3 + 2] += Math.sin(t * 0.37 * speed + phaseZ) * 0.0012;

      if (arr[i * 3 + 1] > 2.35) arr[i * 3 + 1] = 0.85;
      if (arr[i * 3 + 1] < 0.82) arr[i * 3 + 1] = 2.32;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry} raycast={NOOP_RAYCAST}>
      <pointsMaterial
        ref={pointsMatRef}
        color="#d8ba8c"
        size={0.008}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
});

const DynamicBunkerLighting: React.FC = React.memo(() => {
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);
  const bunkerMainLightRef = useRef<THREE.PointLight>(null);
  const frontBankLightRef = useRef<THREE.PointLight>(null);
  const deskSpotRef = useRef<THREE.SpotLight>(null);
  const deskSpotTargetRef = useRef<THREE.Object3D>(null);
  const klaxonSpinnerRef = useRef<THREE.Group>(null);
  const klaxonLampMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useEffect(() => {
    if (deskSpotRef.current && deskSpotTargetRef.current) {
      deskSpotRef.current.target = deskSpotTargetRef.current;
      deskSpotTargetRef.current.updateMatrixWorld();
    }
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const dt = Math.min(0.05, Math.max(0, delta));
    const state = useGameStore.getState();
    const {
      coreTemp,
      powerAllocation,
      maxSafePower,
      isBlackout,
      lobbyMenuPhase,
    } = state;
    const totalMW =
      powerAllocation.cooling +
      powerAllocation.defense +
      powerAllocation.facility;
    const totalAllocatedMW =
      state.sectorMW.pripyat +
      state.sectorMW.kolkhoz +
      state.sectorMW.duga +
      state.sectorMW.kgb +
      state.sectorMW.vodka +
      state.sectorMW.steel;
    const isAlarmActive = coreTemp >= 750 || totalMW > maxSafePower;

    // Continuous 50Hz / 3000 RPM Turbine-Generator Pitch Hum
    updateTurbinePitchHum(
      state.turbineRpm,
      totalAllocatedMW,
      state.voltageDipIntensity,
      isBlackout || lobbyMenuPhase === "menu_locked",
    );

    if (lobbyMenuPhase !== "entered_control_room") {
      controlRoomPowerState.active = false;
      controlRoomPowerState.elapsed = 0;
      controlRoomPowerState.zone1 = 0;
      controlRoomPowerState.zone2 = 0;
      controlRoomPowerState.zone3 = 0;
      controlRoomPowerState.stage1Fired = false;
      controlRoomPowerState.stage2Fired = false;
      controlRoomPowerState.stage3Fired = false;
    } else {
      if (!controlRoomPowerState.active) {
        controlRoomPowerState.active = true;
        controlRoomPowerState.elapsed = 0;
        controlRoomPowerState.stage1Fired = false;
        controlRoomPowerState.stage2Fired = false;
        controlRoomPowerState.stage3Fired = false;
      } else {
        controlRoomPowerState.elapsed = Math.min(
          2.5,
          controlRoomPowerState.elapsed + dt,
        );
      }

      const elapsed = controlRoomPowerState.elapsed;
      if (!controlRoomPowerState.stage1Fired) {
        controlRoomPowerState.stage1Fired = true;
        playControlRoomContactorClunk(0);
      }
      if (!controlRoomPowerState.stage2Fired && elapsed >= 0.35) {
        controlRoomPowerState.stage2Fired = true;
        playControlRoomContactorClunk(1);
      }
      if (!controlRoomPowerState.stage3Fired && elapsed >= 0.7) {
        controlRoomPowerState.stage3Fired = true;
        playControlRoomContactorClunk(2);
      }

      controlRoomPowerState.zone1 = computeFluorescentStarterCurve(elapsed);
      controlRoomPowerState.zone2 = computeFluorescentStarterCurve(elapsed - 0.35);
      controlRoomPowerState.zone3 = computeFluorescentStarterCurve(elapsed - 0.7);
    }

    const z1 = controlRoomPowerState.zone1;
    const z2 = controlRoomPowerState.zone2;
    const z3 = controlRoomPowerState.zone3;
    const powerBlend = z1 * 0.32 + z2 * 0.36 + z3 * 0.32;

    if (hemiLightRef.current) {
      const nominalHemi = isBlackout ? 0.18 : 0.95;
      hemiLightRef.current.intensity = Math.max(
        MIN_STANDBY_LIGHT_INTENSITY,
        0.04 + (nominalHemi - 0.04) * powerBlend,
      );
    }

    if (bunkerMainLightRef.current) {
      if (isBlackout) {
        bunkerMainLightRef.current.color.copy(SCENE_COLOR_MAIN_LIGHT_BLACKOUT);
        bunkerMainLightRef.current.intensity = Math.max(
          MIN_STANDBY_LIGHT_INTENSITY,
          0.42 * z2,
        );
      } else if (isAlarmActive) {
        const wave = (Math.sin(t * 4.2) + 1) * 0.5;
        bunkerMainLightRef.current.color.lerpColors(
          SCENE_COLOR_MAIN_LIGHT_NORM,
          SCENE_COLOR_RED,
          0.35 + 0.5 * wave,
        );
        bunkerMainLightRef.current.intensity = Math.max(
          MIN_STANDBY_LIGHT_INTENSITY,
          (2.5 + wave * 1.1) * z2,
        );
      } else {
        bunkerMainLightRef.current.color.copy(SCENE_COLOR_MAIN_LIGHT_NORM);
        bunkerMainLightRef.current.intensity = Math.max(
          MIN_STANDBY_LIGHT_INTENSITY,
          2.7 * z2,
        );
      }
    }

    if (frontBankLightRef.current) {
      if (isBlackout) {
        frontBankLightRef.current.color.copy(SCENE_COLOR_MAIN_LIGHT_BLACKOUT);
        frontBankLightRef.current.intensity = Math.max(
          MIN_STANDBY_LIGHT_INTENSITY,
          0.25 * z3,
        );
      } else if (isAlarmActive) {
        const wave = (Math.sin(t * 4.2) + 1) * 0.5;
        frontBankLightRef.current.color.lerpColors(
          SCENE_COLOR_MAIN_LIGHT_NORM,
          SCENE_COLOR_RED,
          0.35 + 0.5 * wave,
        );
        frontBankLightRef.current.intensity = Math.max(
          MIN_STANDBY_LIGHT_INTENSITY,
          (1.7 + wave * 0.8) * z3,
        );
      } else {
        frontBankLightRef.current.color.copy(SCENE_COLOR_MAIN_LIGHT_NORM);
        frontBankLightRef.current.intensity = Math.max(
          MIN_STANDBY_LIGHT_INTENSITY,
          2.1 * z3,
        );
      }
    }

    if (deskSpotRef.current) {
      let nominalDeskSpot = 0;
      if (isBlackout || powerAllocation.facility <= 0) {
        nominalDeskSpot = 0;
      } else if (powerAllocation.facility <= 10) {
        nominalDeskSpot = 1.9;
      } else if (powerAllocation.facility <= 20) {
        nominalDeskSpot = 2.8;
      } else {
        const boost = Math.min(1.35, powerAllocation.facility / 30);
        nominalDeskSpot = 3.2 * boost;
      }
      deskSpotRef.current.intensity = Math.max(
        MIN_STANDBY_LIGHT_INTENSITY,
        nominalDeskSpot * z1,
      );
    }

    if (klaxonSpinnerRef.current && isAlarmActive) {
      klaxonSpinnerRef.current.rotation.y = t * 5.5;
    }
    if (klaxonLampMatRef.current) {
      klaxonLampMatRef.current.emissiveIntensity = isAlarmActive
        ? 1.4 + Math.sin(t * 4.2) * 0.75
        : 0.05;
    }
  });

  return (
    <>
      {/* Consolidated Un-Shadowed Scene Lights (castShadow={false}, never toggled invisible) */}
      {/* 1. Institutional Warm-Ceiling / Terracotta-Floor Hemisphere Fill */}
      <hemisphereLight
        ref={hemiLightRef}
        args={["#fff1d6", "#4a3c32", 0.04]}
      />

      {/* 2. Zone 2 — Central Gantry & K.O.M.R.A.D.-84 Overhead Fill & Klaxon Wash */}
      <pointLight
        ref={bunkerMainLightRef}
        castShadow={false}
        position={[0, 3.35, -0.35]}
        color="#ffe2ba"
        intensity={MIN_STANDBY_LIGHT_INTENSITY}
        distance={14.5}
        decay={1.0}
      />

      {/* 3. Zone 3 — Front Reactor Wall (`UNIT A / A-2 / SKALA-84`) Overhead Bank */}
      <pointLight
        ref={frontBankLightRef}
        castShadow={false}
        position={[0, 3.35, -2.75]}
        color="#ffe2ba"
        intensity={MIN_STANDBY_LIGHT_INTENSITY}
        distance={11.5}
        decay={1.05}
      />

      {/* 4. Zone 1 — Overhead SpotLight centered over Shift Supervisor Desk at `z = +1.80` */}
      <group position={[0, 0, 1.8]}>
        <object3D ref={deskSpotTargetRef} position={[0, 0.7, 0]} />
        <spotLight
          ref={deskSpotRef}
          castShadow={false}
          position={[0, 2.7, 0.08]}
          angle={0.76}
          penumbra={0.85}
          intensity={MIN_STANDBY_LIGHT_INTENSITY}
          distance={9.0}
          decay={1.1}
          color="#ffe3b8"
        />
      </group>

      {/* Suspended Bunker Dust Motes floating lazily inside the overhead spotlight cone */}
      <BunkerDustMotes3D />

      {/* Ceiling Rotating Redline / Meltdown Klaxon Beacon centered under Hall Coffer Crown (`y = 3.92m`) */}
      <group position={[0, 3.92, -0.25]}>
        <mesh position={[0, 0.06, 0]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.16, 0.2, 0.1, 12]} />
          <meshStandardMaterial
            color="#141414"
            roughness={0.7}
            metalness={0.5}
          />
        </mesh>
        <group ref={klaxonSpinnerRef}>
          <mesh position={[0, -0.04, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.11, 0.13, 0.16, 10]} />
            <meshStandardMaterial
              ref={klaxonLampMatRef}
              color="#7a1515"
              emissive="#ff2a2a"
              emissiveIntensity={0.05}
              roughness={0.35}
            />
          </mesh>
        </group>
      </group>
    </>
  );
});

/**
 * Recessed Soviet RBMK-1000 Coffered Acoustic Ceiling (`MCR-4 CEILING`, `y = 3.90..4.20m`)
 * across the `12m × 9m` hall using `InstancedMesh` putty-grey coffer tiles and glowing warm-white
 * `#fff1d6` fluorescent tube troffers split into 3 contactor zones.
 */
const SovietRbmkCofferedCeiling3D: React.FC = React.memo(() => {
  const zone1TubeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const zone2TubeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const zone3TubeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const dimTubeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const flickerTubeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const cofferTileInstRef = useRef<THREE.InstancedMesh>(null);
  const zone1TubesInstRef = useRef<THREE.InstancedMesh>(null);
  const zone2TubesInstRef = useRef<THREE.InstancedMesh>(null);
  const zone3TubesInstRef = useRef<THREE.InstancedMesh>(null);
  const bafflesInstRef = useRef<THREE.InstancedMesh>(null);

  const acousticTileTex = useMemo(() => {
    const tex = createNearestCanvasTexture(64, 64, (ctx, w, h) => {
      ctx.fillStyle = "#545b54";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#343b37";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
      ctx.fillStyle = "#2b322e";
      for (let x = 8; x < w - 4; x += 8) {
        for (let y = 8; y < h - 4; y += 8) {
          ctx.fillRect(x, y, 2, 2);
        }
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }, []);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const mesh = cofferTileInstRef.current;
    if (mesh) {
      const xs = [-4.8, -2.4, 0, 2.4, 4.8];
      const zs = [-3.375, -1.125, 1.125, 3.375];
      let idx = 0;
      for (const z of zs) {
        for (const x of xs) {
          dummy.position.set(x, 4.14, z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          mesh.setMatrixAt(idx++, dummy.matrix);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    const troughZs = [-2.85, -0.85, 1.8];
    const tubeXs = [-3.25, -1.1, 1.1, 3.25];
    const baffleXs = [-4.0, -3.0, -2.0, -1.0, 0, 1.0, 2.0, 3.0, 4.0];

    const zoneRefs = [
      zone3TubesInstRef.current,
      zone2TubesInstRef.current,
      zone1TubesInstRef.current,
    ];
    const zoneIdx = [0, 0, 0];
    dummy.rotation.set(0, 0, Math.PI / 2);
    dummy.scale.set(1, 1, 1);
    for (let tIdx = 0; tIdx < troughZs.length; tIdx++) {
      const tz = troughZs[tIdx];
      const inst = zoneRefs[tIdx];
      if (!inst) continue;
      for (let xIdx = 0; xIdx < tubeXs.length; xIdx++) {
        const tx = tubeXs[xIdx];
        for (let rowIdx = 0; rowIdx < 2; rowIdx++) {
          const isDim = tIdx === 1 && xIdx === 2 && rowIdx === 0;
          const isFlicker = tIdx === 0 && xIdx === 3 && rowIdx === 1;
          if (isDim || isFlicker) continue;
          const dz = rowIdx === 0 ? -0.14 : 0.14;
          dummy.position.set(tx, 3.96 - 0.032, tz + dz);
          dummy.updateMatrix();
          inst.setMatrixAt(zoneIdx[tIdx]++, dummy.matrix);
        }
      }
      inst.instanceMatrix.needsUpdate = true;
    }

    const baffles = bafflesInstRef.current;
    if (baffles) {
      let idx = 0;
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      for (let tIdx = 0; tIdx < troughZs.length; tIdx++) {
        const tz = troughZs[tIdx];
        for (let bIdx = 0; bIdx < baffleXs.length; bIdx++) {
          dummy.position.set(baffleXs[bIdx], 3.96 - 0.026, tz);
          dummy.updateMatrix();
          baffles.setMatrixAt(idx++, dummy.matrix);
        }
      }
      baffles.instanceMatrix.needsUpdate = true;
    }
  }, []);

  useFrame(() => {
    const s = useGameStore.getState();

    const baseIntensity = s.isBlackout
      ? 0.03
      : s.powerAllocation.facility <= 10
        ? 1.15
        : 1.9;
    const mainColor = s.isBlackout
      ? SCENE_COLOR_TUBE_BLACKOUT
      : SCENE_COLOR_TUBE_NORM;

    const applyTubeZone = (
      mat: THREE.MeshStandardMaterial | null,
      level: number,
      litColor: THREE.Color,
      emissiveCol: THREE.Color,
      targetIntensity: number,
    ) => {
      if (!mat) return;
      if (level <= 0.01) {
        mat.color.copy(SCENE_COLOR_TUBE_OFF);
        mat.emissive.copy(SCENE_COLOR_BLACK);
        mat.emissiveIntensity = 0;
      } else {
        mat.color.copy(litColor);
        mat.emissive.copy(emissiveCol);
        mat.emissiveIntensity = targetIntensity * level;
      }
    };

    const z1 = controlRoomPowerState.zone1;
    const z2 = controlRoomPowerState.zone2;
    const z3 = controlRoomPowerState.zone3;

    applyTubeZone(
      zone1TubeMatRef.current,
      z1,
      SCENE_COLOR_TUBE_LIT_ALBEDO,
      mainColor,
      baseIntensity,
    );
    applyTubeZone(
      zone2TubeMatRef.current,
      z2,
      SCENE_COLOR_TUBE_LIT_ALBEDO,
      mainColor,
      baseIntensity,
    );
    applyTubeZone(
      zone3TubeMatRef.current,
      z3,
      SCENE_COLOR_TUBE_LIT_ALBEDO,
      mainColor,
      baseIntensity,
    );

    applyTubeZone(
      dimTubeMatRef.current,
      z2,
      SCENE_COLOR_TUBE_DIM,
      s.isBlackout ? SCENE_COLOR_TUBE_DIM_BLACKOUT : SCENE_COLOR_TUBE_DIM,
      s.isBlackout ? 0.02 : 0.65,
    );
    applyTubeZone(
      flickerTubeMatRef.current,
      z3,
      SCENE_COLOR_TUBE_LIT_ALBEDO,
      mainColor,
      baseIntensity,
    );
  });

  const longitudinalXs = [-3.6, -1.2, 1.2, 3.6];
  const transverseZs = [-2.25, 0.0, 2.25];
  const troughZs = [-2.85, -0.85, 1.8];

  return (
    <group>
      {/* Instanced Recessed Putty-Grey Acoustic Coffer Tiles (`5 × 4 = 20` bays) */}
      <instancedMesh
        ref={cofferTileInstRef}
        args={[undefined, undefined, 20]}
        raycast={NOOP_RAYCAST}
      >
        <boxGeometry args={[2.18, 0.05, 2.02]} />
        <meshStandardMaterial
          map={acousticTileTex}
          color="#767d75"
          roughness={0.78}
          metalness={0.18}
        />
      </instancedMesh>

      {/* Deep Concrete/Steel Coffer Grid Beams (`y = 4.02m`) */}
      {longitudinalXs.map((lx) => (
        <mesh key={`ceil-beam-x-${lx}`} position={[lx, 4.04, 0]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.22, 0.26, HALL_HALF_D * 2]} />
          <meshStandardMaterial color="#343b38" metalness={0.42} roughness={0.62} />
        </mesh>
      ))}
      {transverseZs.map((tz) => (
        <mesh key={`ceil-beam-z-${tz}`} position={[0, 4.04, tz]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[HALL_HALF_W * 2, 0.26, 0.22]} />
          <meshStandardMaterial color="#343b38" metalness={0.42} roughness={0.62} />
        </mesh>
      ))}

      {/* Instanced Zoned Warm-White Fluorescent Tubes (8 Zone 1 Entry + 7 Zone 2 Center + 7 Zone 3 Front) & 27 Steel Cross-Baffles */}
      <instancedMesh
        ref={zone1TubesInstRef}
        args={[undefined, undefined, 8]}
        raycast={NOOP_RAYCAST}
      >
        <cylinderGeometry args={[0.022, 0.022, 1.98, 10]} />
        <meshStandardMaterial
          ref={zone1TubeMatRef}
          color="#242926"
          emissive="#000000"
          emissiveIntensity={0}
          roughness={0.25}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </instancedMesh>
      <instancedMesh
        ref={zone2TubesInstRef}
        args={[undefined, undefined, 7]}
        raycast={NOOP_RAYCAST}
      >
        <cylinderGeometry args={[0.022, 0.022, 1.98, 10]} />
        <meshStandardMaterial
          ref={zone2TubeMatRef}
          color="#242926"
          emissive="#000000"
          emissiveIntensity={0}
          roughness={0.25}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </instancedMesh>
      <instancedMesh
        ref={zone3TubesInstRef}
        args={[undefined, undefined, 7]}
        raycast={NOOP_RAYCAST}
      >
        <cylinderGeometry args={[0.022, 0.022, 1.98, 10]} />
        <meshStandardMaterial
          ref={zone3TubeMatRef}
          color="#242926"
          emissive="#000000"
          emissiveIntensity={0}
          roughness={0.25}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </instancedMesh>
      <instancedMesh
        ref={bafflesInstRef}
        args={[undefined, undefined, 27]}
        raycast={NOOP_RAYCAST}
      >
        <boxGeometry args={[0.032, 0.055, 0.58]} />
        <meshStandardMaterial color="#2c3531" metalness={0.58} roughness={0.48} />
      </instancedMesh>

      {/* Dim & Secondary Fluorescent Tubes (Zone 2 & Zone 3) */}
      <mesh
        position={[1.1, 3.96 - 0.032, -0.85 - 0.14]}
        rotation={[0, 0, Math.PI / 2]}
        raycast={NOOP_RAYCAST}
      >
        <cylinderGeometry args={[0.022, 0.022, 1.98, 10]} />
        <meshStandardMaterial
          ref={dimTubeMatRef}
          color="#242926"
          emissive="#000000"
          emissiveIntensity={0}
          roughness={0.25}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh
        position={[3.25, 3.96 - 0.032, -2.85 + 0.14]}
        rotation={[0, 0, Math.PI / 2]}
        raycast={NOOP_RAYCAST}
      >
        <cylinderGeometry args={[0.022, 0.022, 1.98, 10]} />
        <meshStandardMaterial
          ref={flickerTubeMatRef}
          color="#242926"
          emissive="#000000"
          emissiveIntensity={0}
          roughness={0.25}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* Long Fluorescent Troffer Housings (`3` rows) */}
      {troughZs.map((tz, tIdx) => (
        <group key={`ceil-trough-${tIdx}`} position={[0, 3.96, tz]}>
          {/* Steel Recessed Troffer Reflector Housing */}
          <mesh position={[0, 0.06, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[9.2, 0.08, 0.64]} />
            <meshStandardMaterial color="#232b28" metalness={0.64} roughness={0.46} />
          </mesh>
          <mesh position={[0, 0.006, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[8.9, 0.54]} />
            <meshStandardMaterial
              color="#8d948d"
              roughness={0.55}
              metalness={0.28}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
});

/**
 * Industrial Control Room Clutter, Color-Coded Ceiling Piping (with Flanges, Elbows, Gate Valves,
 * Gauges & Perforated Overhead Cable Trays), Tightened `SM-2M` Magnetic Tape Cabinets, Heavy 3D
 * `DB-380V` Switchgear Boxes, Rebuilt `FIRE SHIELD NO. 4` + `PK-4` + `VK-4` HVAC Trunk + `FIRE SAND NO. 1`,
 * Populated `+X/+Z` Radiation Dosimetry / Dispatch Intercom / Evacuation Poster / `CIVIL DEFENSE` Wall Bays,
 * and Wheeled Soviet Ergonomic Operator Swivel Chairs.
 */
const SovietIndustrialPipingAndProps3D: React.FC = React.memo(() => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  const reelRefs = useRef<Array<THREE.Group | null>>([]);
  const ledMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const pipeFlangeInstRef = useRef<THREE.InstancedMesh>(null);
  const pipeBracketInstRef = useRef<THREE.InstancedMesh>(null);

  const fireShieldTex = useMemo(
    () =>
      createNearestCanvasTexture(512, 340, (ctx, w, h) => {
        ctx.fillStyle = "#efe9d8";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8221a";
        ctx.lineWidth = 14;
        ctx.strokeRect(7, 7, w - 14, h - 14);
        ctx.fillStyle = "#b8221a";
        ctx.fillRect(14, 14, w - 28, 56);
        ctx.fillStyle = "#ffffff";
        ctx.font = 'bold 26px "Kremlin", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("FIRE SHIELD NO. 4 // MCR-4", w / 2, 52, w - 40);
        // Clean red bottom stencil band dedicated to emergency number - 100% unobstructed by tools
        ctx.fillStyle = "#b8221a";
        ctx.fillRect(14, h - 54, w - 28, 40);
        ctx.fillStyle = "#ffffff";
        ctx.font = 'bold 22px "Kremlin", "Courier Prime", monospace';
        ctx.fillText("IN CASE OF FIRE DIAL 01", w / 2, h - 26, w - 40);
      }),
    [],
  );

  const sm2mNameplateTex = useMemo(
    () =>
      createNearestCanvasTexture(256, 64, (ctx, w, h) => {
        ctx.fillStyle = "#18201d";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#8a948e";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 17px "Kremlin", "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("SM-2M MAINFRAME TAPE UNIT", w / 2, 40, w - 16);
      }),
    [],
  );

  const sm2mButtonsLabelTex = useMemo(
    () =>
      createNearestCanvasTexture(256, 36, (ctx, w, h) => {
        ctx.fillStyle = "#161c19";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 12px "Kremlin", "VT323", monospace';
        ctx.textAlign = "center";
        const labels = ["START", "STOP", "REWIND", "READY"];
        labels.forEach((lbl, idx) => {
          ctx.fillText(lbl, 34 + idx * 62, 24, 56);
        });
      }),
    [],
  );

  const sm2mTensionDialTex = useMemo(
    () =>
      createNearestCanvasTexture(64, 64, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        ctx.fillStyle = "#e6dec3";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#141414";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.beginPath();
        ctx.arc(cx, cy + 12, 22, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        ctx.strokeStyle = "#c81919";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy + 14);
        ctx.lineTo(cx + 8, cy - 10);
        ctx.stroke();
        ctx.fillStyle = "#141414";
        ctx.font = 'bold 9px "Kremlin", "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("TENSION", cx, h - 6, 54);
      }),
    [],
  );

  const sandBoxPlaqueTex = useMemo(
    () =>
      createNearestCanvasTexture(256, 72, (ctx, w, h) => {
        ctx.fillStyle = "#8a1812";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#e6dec3";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#ffffff";
        ctx.font = 'bold 20px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("FIRE SAND NO. 1 // MCR-4", w / 2, 46, w - 20);
      }),
    [],
  );

  const hoseCabinetTex = useMemo(
    () =>
      createNearestCanvasTexture(256, 96, (ctx, w, h) => {
        ctx.fillStyle = "#961a14";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#f0ece0";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#ffffff";
        ctx.font = 'bold 24px "Kremlin", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("FIRE HOSE", w / 2, 42, w - 20);
        ctx.fillStyle = "#ffde7a";
        ctx.font = 'bold 22px "Kremlin", "VT323", monospace';
        ctx.fillText("PK-4  •  01", w / 2, 76, w - 20);
      }),
    [],
  );

  const iprButtonTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 96, (ctx, w, h) => {
        ctx.fillStyle = "#f2ede0";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8221a";
        ctx.lineWidth = 5;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#b8221a";
        ctx.font = 'bold 20px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("IPR-4", w / 2, 34, w - 14);
        ctx.fillStyle = "#141414";
        ctx.font = 'bold 14px "Kremlin", "VT323", monospace';
        ctx.fillText("FIRE • PRESS", w / 2, 72, w - 14);
      }),
    [],
  );

  const hvacPlateTex = useMemo(
    () =>
      createNearestCanvasTexture(320, 64, (ctx, w, h) => {
        ctx.fillStyle = "#1a2420";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 17px "Kremlin", "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("HVAC PLENUM VK-4 // MCR SUPPLY", w / 2, 40, w - 20);
      }),
    [],
  );

  const switchgearHazardTex = useMemo(
    () =>
      createNearestCanvasTexture(192, 128, (ctx, w, h) => {
        ctx.fillStyle = "#f0b418";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#141414";
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        // Hazard lightning triangle
        ctx.fillStyle = "#141414";
        ctx.beginPath();
        ctx.moveTo(w / 2, 12);
        ctx.lineTo(w / 2 + 34, 68);
        ctx.lineTo(w / 2 - 34, 68);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#f0b418";
        ctx.beginPath();
        ctx.moveTo(w / 2, 19);
        ctx.lineTo(w / 2 + 25, 63);
        ctx.lineTo(w / 2 - 25, 63);
        ctx.closePath();
        ctx.fill();
        // Lightning bolt
        ctx.fillStyle = "#141414";
        ctx.beginPath();
        ctx.moveTo(w / 2 + 2, 26);
        ctx.lineTo(w / 2 - 8, 44);
        ctx.lineTo(w / 2 + 1, 44);
        ctx.lineTo(w / 2 - 4, 60);
        ctx.lineTo(w / 2 + 9, 40);
        ctx.lineTo(w / 2, 40);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#141414";
        ctx.font = 'bold 20px "Kremlin", "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("380V // DB-380V", w / 2, 108, w - 18);
      }),
    [],
  );

  const ammeterDialTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 128, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        ctx.fillStyle = "#e6dec3";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#141414";
        ctx.lineWidth = 5;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        for (let i = 0; i <= 10; i++) {
          const ang = Math.PI * 1.15 + (i / 10) * Math.PI * 0.7;
          ctx.strokeStyle = i >= 8 ? "#c81919" : "#141414";
          ctx.lineWidth = i % 2 === 0 ? 3 : 1.5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * 34, cy + 18 + Math.sin(ang) * 34);
          ctx.lineTo(cx + Math.cos(ang) * 46, cy + 18 + Math.sin(ang) * 46);
          ctx.stroke();
        }
        ctx.strokeStyle = "#c81919";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy + 18);
        ctx.lineTo(cx + 12, cy - 22);
        ctx.stroke();
        ctx.fillStyle = "#141414";
        ctx.font = 'bold 18px "Kremlin", "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("0-100 A", cx, h - 12, w - 16);
      }),
    [],
  );

  const dosimetryDialTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 128, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        ctx.fillStyle = "#ece6cf";
        ctx.beginPath();
        ctx.arc(cx, cy, 58, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#141414";
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.strokeStyle = "#c81919";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, 46, -0.35, 0.72);
        ctx.stroke();
        for (let i = 0; i <= 12; i++) {
          const ang = Math.PI * 0.75 + (i / 12) * Math.PI * 1.5;
          ctx.strokeStyle = i >= 9 ? "#c81919" : "#141414";
          ctx.lineWidth = i % 3 === 0 ? 3 : 1.5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * 36, cy + Math.sin(ang) * 36);
          ctx.lineTo(cx + Math.cos(ang) * 49, cy + Math.sin(ang) * 49);
          ctx.stroke();
        }
        ctx.strokeStyle = "#141414";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx - 28, cy - 22);
        ctx.stroke();
        ctx.fillStyle = "#141414";
        ctx.font = 'bold 17px "Kremlin", "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("MR/H", cx, cy + 34, 64);
      }),
    [],
  );

  const dosimetryPlateTex = useMemo(
    () =>
      createNearestCanvasTexture(288, 72, (ctx, w, h) => {
        ctx.fillStyle = "#19221e";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 18px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("UIM2-2 // DOSIMETRY POST", w / 2, 32, w - 16);
        ctx.fillStyle = "#33ff66";
        ctx.font = 'bold 15px "Kremlin", "VT323", monospace';
        ctx.fillText("PROBE RZB-04 • NORM / ALARM", w / 2, 58, w - 16);
      }),
    [],
  );

  const intercomPlateTex = useMemo(
    () =>
      createNearestCanvasTexture(256, 80, (ctx, w, h) => {
        ctx.fillStyle = "#1a221f";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#9aa49e";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 17px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("GGS // DISPATCH INTERCOM", w / 2, 34, w - 16);
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 15px "Kremlin", "VT323", monospace';
        ctx.fillText("MCR • TURBINE • MCP • KGB", w / 2, 64, w - 16);
      }),
    [],
  );

  const speakerGrilleTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 128, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        ctx.fillStyle = "#26302c";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#121715";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#0b0e0d";
        for (let r = 10; r <= 48; r += 10) {
          const count = Math.max(6, Math.round(r * 0.45));
          for (let i = 0; i < count; i++) {
            const ang = (i / count) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }),
    [],
  );

  const rotaryDialTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 128, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        ctx.fillStyle = "#dfd7c2";
        ctx.beginPath();
        ctx.arc(cx, cy, 58, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#181a19";
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.fillStyle = "#242826";
        ctx.beginPath();
        ctx.arc(cx, cy, 24, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 10; i++) {
          const ang = -0.5 + i * 0.48;
          ctx.fillStyle = "#121413";
          ctx.beginPath();
          ctx.arc(cx + Math.cos(ang) * 41, cy + Math.sin(ang) * 41, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }),
    [],
  );

  const rbmkEvacPosterTex = useMemo(
    () =>
      createNearestCanvasTexture(512, 288, (ctx, w, h) => {
        ctx.fillStyle = "#e4ddc7";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#1b2822";
        ctx.lineWidth = 6;
        ctx.strokeRect(5, 5, w - 10, h - 10);
        // Header band
        ctx.fillStyle = "#1e3a2c";
        ctx.fillRect(10, 10, w - 20, 44);
        ctx.fillStyle = "#ffffff";
        ctx.font = 'bold 18px "Kremlin", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("RBMK-1000 UNIT 4 // COOLDOWN & EVACUATION PLAN", w / 2, 38, w - 36);
        // Left diagram: RBMK cooling circuit schematic
        ctx.strokeStyle = "#1e3a2c";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(18, 66, 232, 198);
        ctx.fillStyle = "#1e3a2c";
        ctx.font = 'bold 14px "Kremlin", "VT323", monospace';
        ctx.fillText("COOLING / ECCS LOOP", 134, 86, 216);
        // Core cylinder & drums
        ctx.fillStyle = "#b8221a";
        ctx.fillRect(102, 132, 64, 72);
        ctx.strokeRect(102, 132, 64, 72);
        ctx.fillStyle = "#266c8c";
        ctx.fillRect(42, 102, 56, 22);
        ctx.fillRect(170, 102, 56, 22);
        ctx.strokeStyle = "#266c8c";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(70, 124);
        ctx.lineTo(70, 234);
        ctx.lineTo(134, 234);
        ctx.lineTo(134, 204);
        ctx.moveTo(198, 124);
        ctx.lineTo(198, 234);
        ctx.lineTo(134, 234);
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.fillText("CORE", 134, 174, 56);
        // Right diagram: MCR-4 evacuation plan
        ctx.strokeStyle = "#1e3a2c";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(262, 66, 232, 198);
        ctx.fillStyle = "#1e3a2c";
        ctx.fillText("MCR-4 EVACUATION PLAN", 378, 86, 216);
        ctx.strokeRect(284, 104, 188, 136);
        // Exit arrows in safety green
        ctx.strokeStyle = "#1b7a38";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(316, 172);
        ctx.lineTo(378, 172);
        ctx.lineTo(378, 232);
        ctx.stroke();
        ctx.fillStyle = "#1b7a38";
        ctx.fillRect(350, 232, 56, 16);
        ctx.fillStyle = "#ffffff";
        ctx.font = 'bold 13px "Kremlin", "VT323", monospace';
        ctx.fillText("EXIT", 378, 245, 50);
        ctx.fillStyle = "#b8221a";
        ctx.fillRect(292, 206, 24, 24);
        ctx.fillStyle = "#ffffff";
        ctx.fillText("01", 304, 223);
      }),
    [],
  );

  const safetyPosterTex = useMemo(
    () =>
      createNearestCanvasTexture(384, 256, (ctx, w, h) => {
        ctx.fillStyle = "#e6dec3";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8221a";
        ctx.lineWidth = 8;
        ctx.strokeRect(6, 6, w - 12, h - 12);
        ctx.fillStyle = "#b8221a";
        ctx.fillRect(14, 14, w - 28, 48);
        ctx.fillStyle = "#ffffff";
        ctx.font = 'bold 21px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("ELECTRICAL SAFETY", w / 2, 46, w - 32);
        ctx.fillStyle = "#141414";
        ctx.font = 'bold 20px "VT323", monospace';
        ctx.fillText("1. GROUND 6KV & SM-2M CABINETS", w / 2, 96, w - 32);
        ctx.fillText("2. ON SMOKE TRIP DB-380V BREAKER", w / 2, 136, w - 32);
        ctx.fillText("3. USE OU-5 CO2 & DIELECTRIC BOOTS", w / 2, 176, w - 32);
        ctx.fillStyle = "#b8221a";
        ctx.font = 'bold 18px "Kremlin", monospace';
        ctx.fillText("SUPERVISOR: MCR SHIFT CHIEF", w / 2, 224, w - 32);
      }),
    [],
  );

  const ppeCabinetTex = useMemo(
    () =>
      createNearestCanvasTexture(256, 128, (ctx, w, h) => {
        ctx.fillStyle = "#2b3b30";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#e6dec3";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        // White medical cross stencil on right
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(194, 22, 16, 44);
        ctx.fillRect(180, 36, 44, 16);
        ctx.textAlign = "left";
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 20px "Kremlin", monospace';
        ctx.fillText("CIVIL DEF.", 18, 44, 156);
        ctx.fillStyle = "#ffde7a";
        ctx.font = 'bold 16px "Kremlin", "VT323", monospace';
        ctx.fillText("GP-5 GAS MASKS", 18, 76, 156);
        ctx.fillStyle = "#ffffff";
        ctx.fillText("AI-2 MEDKIT • IODINE", 18, 106, 216);
      }),
    [],
  );

  const trayPerfTex = useMemo(() => {
    const tex = createNearestCanvasTexture(128, 64, (ctx, w, h) => {
      ctx.fillStyle = "#3a4540";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#181e1c";
      for (let x = 10; x < w - 6; x += 20) {
        for (let y = 10; y < h - 6; y += 20) {
          ctx.fillRect(x, y, 10, 6);
        }
      }
      ctx.strokeStyle = "#526059";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 1);
    return tex;
  }, []);

  const propMats = useMemo(
    () => ({
      smBody: new THREE.MeshStandardMaterial({
        color: "#2c3e38",
        metalness: 0.46,
        roughness: 0.54,
        bumpMap: ironTex.bumpMap,
        bumpScale: 0.006,
      }),
      smDoor: new THREE.MeshStandardMaterial({
        color: "#23322c",
        metalness: 0.52,
        roughness: 0.52,
      }),
      smPuttyDoor: new THREE.MeshStandardMaterial({
        color: "#364840",
        metalness: 0.48,
        roughness: 0.5,
      }),
      smAluminum: new THREE.MeshStandardMaterial({
        color: "#9ea8a2",
        metalness: 0.84,
        roughness: 0.28,
      }),
      smDarkDeck: new THREE.MeshStandardMaterial({
        color: "#0e1311",
        metalness: 0.62,
        roughness: 0.46,
      }),
      smGunmetal: new THREE.MeshStandardMaterial({
        color: "#161c1a",
        metalness: 0.66,
        roughness: 0.46,
      }),
      smReelRim: new THREE.MeshStandardMaterial({
        color: "#1e1c1a",
        metalness: 0.45,
        roughness: 0.42,
      }),
      smTapePack: new THREE.MeshStandardMaterial({
        color: "#2b1812",
        roughness: 0.62,
        metalness: 0.14,
      }),
      smTapeRibbon: new THREE.MeshStandardMaterial({
        color: "#4a281a",
        roughness: 0.55,
        metalness: 0.18,
      }),
      smSilverRoller: new THREE.MeshStandardMaterial({
        color: "#d4dcd8",
        metalness: 0.88,
        roughness: 0.22,
      }),
      smBrass: new THREE.MeshStandardMaterial({
        color: "#b8a46b",
        metalness: 0.86,
        roughness: 0.26,
        bumpMap: brassTex.bumpMap,
        bumpScale: 0.004,
      }),
      smSmokedGlass: new THREE.MeshBasicMaterial({
        color: "#162420",
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        fog: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
      cabinetGlass: new THREE.MeshBasicMaterial({
        color: "#1a2824",
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
        fog: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
      conduitGrey: new THREE.MeshStandardMaterial({
        color: "#525c58",
        metalness: 0.7,
        roughness: 0.42,
      }),
      galvanizedSteel: new THREE.MeshStandardMaterial({
        color: "#5c6862",
        metalness: 0.72,
        roughness: 0.42,
        bumpMap: ironTex.bumpMap,
        bumpScale: 0.005,
      }),
      trayPerfMat: new THREE.MeshStandardMaterial({
        map: trayPerfTex,
        color: "#4a5650",
        metalness: 0.68,
        roughness: 0.46,
      }),
      fireRed: new THREE.MeshStandardMaterial({
        color: "#c81e1a",
        roughness: 0.44,
        metalness: 0.28,
      }),
      fireDarkInside: new THREE.MeshStandardMaterial({
        color: "#1b0808",
        roughness: 0.78,
        metalness: 0.2,
      }),
      fireBucketHollow: new THREE.MeshStandardMaterial({
        color: "#4a100e",
        roughness: 0.7,
        metalness: 0.35,
        side: THREE.BackSide,
      }),
      canvasHose: new THREE.MeshStandardMaterial({
        color: "#e2dac4",
        roughness: 0.84,
        metalness: 0.05,
      }),
      woodAsh: new THREE.MeshStandardMaterial({
        color: "#85542d",
        roughness: 0.74,
        metalness: 0.05,
      }),
      oliveCabinet: new THREE.MeshStandardMaterial({
        color: "#2c3c32",
        metalness: 0.5,
        roughness: 0.54,
        bumpMap: ironTex.bumpMap,
        bumpScale: 0.006,
      }),
      sageDosimetry: new THREE.MeshStandardMaterial({
        color: "#334b41",
        metalness: 0.46,
        roughness: 0.52,
        bumpMap: ironTex.bumpMap,
        bumpScale: 0.005,
      }),
      junctionBody: new THREE.MeshStandardMaterial({
        color: "#2a3531",
        metalness: 0.62,
        roughness: 0.48,
        bumpMap: ironTex.bumpMap,
        bumpScale: 0.006,
      }),
      bakeliteDark: new THREE.MeshStandardMaterial({
        color: "#141414",
        roughness: 0.52,
        metalness: 0.18,
      }),
      cableBlack: new THREE.MeshStandardMaterial({
        color: "#121514",
        roughness: 0.78,
        metalness: 0.14,
      }),
      whiteStripe: new THREE.MeshStandardMaterial({
        color: "#ebe4cf",
        roughness: 0.6,
        metalness: 0.12,
      }),
    }),
    [brassTex.bumpMap, ironTex.bumpMap, trayPerfTex],
  );

  const propGeos = useMemo(() => {
    const reelRim = new THREE.TorusGeometry(0.116, 0.008, 8, 24);
    const reelSpoke = new THREE.BoxGeometry(0.224, 0.014, 0.008);
    const reelHub = new THREE.CylinderGeometry(0.038, 0.038, 0.022, 14);
    const reelCap = new THREE.CylinderGeometry(0.016, 0.018, 0.028, 6);
    const guideRoller = new THREE.CylinderGeometry(0.016, 0.016, 0.028, 12);
    const vertLouver = new THREE.BoxGeometry(0.014, 0.28, 0.012);
    const tapeSegA = new THREE.BoxGeometry(0.13, 0.004, 0.016);
    const tapeSegB = new THREE.BoxGeometry(0.16, 0.004, 0.016);
    const tapeSegC = new THREE.BoxGeometry(0.19, 0.004, 0.016);
    const buttonCollar = new THREE.BoxGeometry(0.052, 0.04, 0.014);
    const buttonCap = new THREE.BoxGeometry(0.04, 0.028, 0.016);
    const hexBolt = new THREE.CylinderGeometry(0.008, 0.008, 0.01, 6);
    const brassGland = new THREE.CylinderGeometry(0.016, 0.018, 0.022, 6);
    const saddleClamp = new THREE.BoxGeometry(0.165, 0.024, 0.032);
    const pipeFlange = new THREE.CylinderGeometry(0.064, 0.064, 0.026, 12);
    const pipeBracket = new THREE.BoxGeometry(1, 1, 1);
    const hvacLouver = new THREE.BoxGeometry(0.48, 0.022, 0.014);
    const gp5Canister = new THREE.CylinderGeometry(0.046, 0.046, 0.072, 12);
    const hoseCoilA = new THREE.TorusGeometry(0.165, 0.024, 8, 22);
    const hoseCoilB = new THREE.TorusGeometry(0.12, 0.022, 8, 20);
    const hoseCoilC = new THREE.TorusGeometry(0.078, 0.02, 8, 18);

    // 3D Coiled Cord for Geiger-Müller Probe on `UIM2-2`
    const probePts: THREE.Vector3[] = [];
    for (let i = 0; i <= 36; i++) {
      const f = i / 36;
      const ang = f * Math.PI * 10;
      const x = THREE.MathUtils.lerp(-0.04, 0.25, f) + Math.sin(ang) * 0.014;
      const y = -0.26 - Math.sin(f * Math.PI) * 0.14 + Math.cos(ang) * 0.012;
      const z = 0.035 + Math.sin(ang * 0.5) * 0.015;
      probePts.push(new THREE.Vector3(x, y, z));
    }
    const probeCord = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(probePts),
      32,
      0.0075,
      6,
      false,
    );

    // 3D Coiled Handset Cord for `TA-68` Wall Phone
    const phonePts: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      const f = i / 32;
      const ang = f * Math.PI * 9;
      const x = THREE.MathUtils.lerp(-0.04, -0.095, f) + Math.cos(ang) * 0.011;
      const y = THREE.MathUtils.lerp(-0.14, 0.04, f) - Math.sin(f * Math.PI) * 0.11;
      const z = 0.048 + Math.sin(ang) * 0.012;
      phonePts.push(new THREE.Vector3(x, y, z));
    }
    const phoneCord = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(phonePts),
      28,
      0.0065,
      6,
      false,
    );

    return {
      reelRim,
      reelSpoke,
      reelHub,
      reelCap,
      guideRoller,
      vertLouver,
      tapeSegA,
      tapeSegB,
      tapeSegC,
      buttonCollar,
      buttonCap,
      hexBolt,
      brassGland,
      saddleClamp,
      pipeFlange,
      pipeBracket,
      hvacLouver,
      gp5Canister,
      hoseCoilA,
      hoseCoilB,
      hoseCoilC,
      probeCord,
      phoneCord,
    };
  }, []);

  useEffect(() => {
    const dummy = new THREE.Object3D();

    // 1. Populate 60 Bolted Circular Pipe Flanges Across Red & Yellow Runs + Corner Risers
    const flanges = pipeFlangeInstRef.current;
    if (flanges) {
      let fIdx = 0;
      const redPipeY = 3.8;
      const yelPipeY = 3.68;
      // Left/Right horizontal runs (`x = ±5.64`)
      for (const px of [-5.64, 5.64] as const) {
        for (const py of [redPipeY, yelPipeY] as const) {
          for (const pz of [-3.1, -1.0, 1.0, 3.1] as const) {
            dummy.position.set(px, py, pz);
            dummy.rotation.set(Math.PI / 2, 0, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            flanges.setMatrixAt(fIdx++, dummy.matrix);
          }
        }
      }
      // Front/Rear horizontal runs (`z = ±4.14`)
      for (const pz of [-4.14, 4.14] as const) {
        for (const py of [redPipeY, yelPipeY] as const) {
          for (const px of [-4.4, -2.2, 0, 2.2, 4.4] as const) {
            dummy.position.set(px, py, pz);
            dummy.rotation.set(0, 0, Math.PI / 2);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            flanges.setMatrixAt(fIdx++, dummy.matrix);
          }
        }
      }
      // 4 Corner Vertical Drop Risers (Red at `[±5.64, ±4.14]`, Yellow at `[±5.53, ±4.25]`)
      for (const [rx, rz] of [
        [-5.64, -4.14],
        [5.64, -4.14],
        [-5.64, 4.14],
        [5.64, 4.14],
      ] as const) {
        for (const py of [0.06, 1.12, 2.58] as const) {
          dummy.position.set(rx, py, rz);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          flanges.setMatrixAt(fIdx++, dummy.matrix);
        }
      }
      for (const [rx, rz] of [
        [-5.53, -4.25],
        [5.53, -4.25],
        [-5.53, 4.25],
        [5.53, 4.25],
      ] as const) {
        for (const py of [0.06, 1.12, 2.58] as const) {
          dummy.position.set(rx, py, rz);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          flanges.setMatrixAt(fIdx++, dummy.matrix);
        }
      }
      flanges.instanceMatrix.needsUpdate = true;
    }

    // 2. Populate 34 Cast-Iron Wall Standoff Brackets Holding Perimeter Pipes & Corner Risers
    const brackets = pipeBracketInstRef.current;
    if (brackets) {
      let bIdx = 0;
      for (const sx of [-1, 1] as const) {
        for (const pz of [-3.4, -1.6, 0, 1.6, 3.4] as const) {
          dummy.position.set(sx * 5.81, 3.69, pz);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(0.38, 0.34, 0.045);
          dummy.updateMatrix();
          brackets.setMatrixAt(bIdx++, dummy.matrix);
        }
      }
      for (const sz of [-1, 1] as const) {
        for (const px of [-4.6, -2.4, -0.8, 0.8, 2.4, 4.6] as const) {
          dummy.position.set(px, 3.69, sz * 4.31);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(0.045, 0.34, 0.38);
          dummy.updateMatrix();
          brackets.setMatrixAt(bIdx++, dummy.matrix);
        }
      }
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        for (const py of [0.85, 2.25, 3.18] as const) {
          dummy.position.set(sx * 5.58, py, sz * 4.36);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(0.24, 0.042, 0.26);
          dummy.updateMatrix();
          brackets.setMatrixAt(bIdx++, dummy.matrix);
        }
      }
      brackets.instanceMatrix.needsUpdate = true;
    }
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const dt = Math.min(0.1, delta);
    const s = useGameStore.getState();

    // Animate spinning 3D magnetic tape reels with realistic forward/pause/rewind seek bursts
    for (let i = 0; i < reelRefs.current.length; i++) {
      const reel = reelRefs.current[i];
      if (!reel) continue;
      if (s.isBlackout) continue;
      const cycle = (t * 0.7 + i * 1.37) % 4.0;
      const dir = cycle < 2.2 ? 1 : cycle < 2.9 ? 0 : -1.4;
      reel.rotation.z -= dir * 2.7 * dt;
    }

    // Animate gentle LED register strips on SM-2M tape cabinets
    for (let i = 0; i < ledMatRefs.current.length; i++) {
      const mat = ledMatRefs.current[i];
      if (!mat) continue;
      if (s.isBlackout) {
        mat.emissiveIntensity = 0.04;
      } else {
        const bit = Math.floor(t * (0.45 + (i % 3) * 0.15) + i * 3) % 3;
        mat.emissiveIntensity = bit === 0 ? 1.35 : 0.45;
      }
    }
  });

  const pipeLines = [
    { y: 3.8, color: "#b8241e" }, // Crimson-Red Fire Line
    { y: 3.68, color: "#e09f18" }, // Yellow Gas / Instrument Air Line
    { y: 3.56, color: "#626c68" }, // Galvanized Grey Conduit
  ] as const;

  const chairConfigs = [
    { pos: [-4.46, 0.016, -0.14] as const, rotY: 0.42, cushion: "#4a1e1a" },
    { pos: [4.62, 0.016, 0.24] as const, rotY: -0.46, cushion: "#4a1e1a" },
  ] as const;

  // Heavy 3D Switchgear Boxes (`DB-380V`) placed cleanly clear of pillars, dado rails & windows
  const switchgearUnits = [
    {
      key: "sw-left-mid",
      pos: [-5.976, 1.96, -0.95] as const,
      rotY: Math.PI / 2,
      upLen: 1.16,
      downLen: 1.72,
      conduitOffZ: 0.024,
    },
    {
      key: "sw-left-rear",
      pos: [-5.976, 2.02, 3.74] as const,
      rotY: Math.PI / 2,
      upLen: 1.1,
      downLen: 0.52,
      conduitOffZ: 0.024,
    },
    {
      key: "sw-right-rear",
      pos: [5.976, 0.98, 3.96] as const,
      rotY: -Math.PI / 2,
      upLen: 2.14,
      downLen: 0.74,
      conduitOffZ: 0.024,
    },
    {
      key: "sw-rear-left",
      pos: [-5.28, 1.96, 4.476] as const,
      rotY: Math.PI,
      upLen: 1.16,
      downLen: 1.72,
      conduitOffZ: 0.024,
    },
  ] as const;

  const renderSwitchgear380V = (unit: (typeof switchgearUnits)[number]) => {
    const condOffsets = [-0.055, 0, 0.055] as const;
    return (
      <group
        key={unit.key}
        position={[unit.pos[0], unit.pos[1], unit.pos[2]]}
        rotation={[0, unit.rotY, 0]}
      >
        {/* 4 Bolted Corner Wall-Mounting Lugs (`>=0.014m` proud of wall) */}
        {([-0.16, 0.16] as const).map((lx) =>
          ([-0.2, 0.2] as const).map((ly) => (
            <group key={`${unit.key}-lug-${lx}-${ly}`} position={[lx, ly, 0.014]}>
              <mesh material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.048, 0.048, 0.024]} />
              </mesh>
              <mesh
                position={[0, 0, 0.015]}
                rotation={[Math.PI / 2, 0, 0]}
                geometry={propGeos.hexBolt}
                material={propMats.smBrass}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              />
            </group>
          )),
        )}

        {/* Main Cast-Metal Enclosure (`0.36 × 0.46 × 0.14`) */}
        <mesh position={[0, 0, 0.084]} material={propMats.junctionBody} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.36, 0.46, 0.14]} />
        </mesh>

        {/* Beveled Hinged Front Door + Recessed Perimeter Seam + Barrel Hinges + Cam-Key Lock */}
        <mesh position={[0, 0, 0.158]} material={propMats.smDarkDeck} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.33, 0.43, 0.01]} />
        </mesh>
        <mesh position={[0, 0, 0.172]} material={propMats.smDoor} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.305, 0.405, 0.018]} />
        </mesh>
        {([-0.12, 0.12] as const).map((hy, hIdx) => (
          <mesh
            key={`${unit.key}-hinge-${hIdx}`}
            position={[-0.162, hy, 0.172]}
            material={propMats.smGunmetal}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.01, 0.01, 0.045, 8]} />
          </mesh>
        ))}
        {/* Cam-Key Latch */}
        <mesh
          position={[0.12, -0.02, 0.186]}
          rotation={[Math.PI / 2, 0, 0]}
          material={propMats.smSilverRoller}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <cylinderGeometry args={[0.016, 0.018, 0.018, 10]} />
        </mesh>

        {/* Recessed Analog Ammeter Dial (`0-100A`, `0.016m` proud of door) + Live Phase Indicator */}
        <group position={[-0.055, 0.105, 0.186]}>
          <mesh material={propMats.bakeliteDark} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.125, 0.125, 0.02]} />
          </mesh>
          <mesh position={[0, 0, 0.016]} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.104, 0.104]} />
            <meshStandardMaterial
              map={ammeterDialTex}
              roughness={0.48}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
        </group>
        <group position={[0.095, 0.105, 0.186]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.02, 0.024, 0.018, 10]} />
          </mesh>
          <mesh position={[0, 0, 0.01]} castShadow={false} raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.014, 8, 8]} />
            <meshStandardMaterial color="#ffb000" emissive="#ffb000" emissiveIntensity={1.15} />
          </mesh>
        </group>

        {/* Yellow Enamel `380V // DB-380V` Hazard Plaque (`0.016m` proud of door) */}
        <mesh position={[0, -0.075, 0.197]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.21, 0.14]} />
          <meshStandardMaterial
            map={switchgearHazardTex}
            roughness={0.46}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>

        {/* Side-Mounted Rotary Isolator Switch (`PV-3`) */}
        <group position={[0.184, -0.02, 0.084]}>
          <mesh rotation={[0, 0, Math.PI / 2]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.022, 0.024, 0.026, 10]} />
          </mesh>
          <mesh position={[0.022, 0.045, 0.016]} rotation={[0.35, 0, 0]} material={propMats.fireRed} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.022, 0.115, 0.024]} />
          </mesh>
        </group>

        {/* 3 Top & 2 Bottom Machined Brass Cable-Gland Hex Nuts */}
        {condOffsets.map((gx, gIdx) => (
          <mesh
            key={`${unit.key}-tgland-${gIdx}`}
            position={[gx, 0.24, 0.04 + unit.conduitOffZ]}
            geometry={propGeos.brassGland}
            material={propMats.smBrass}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          />
        ))}
        {([-0.04, 0.04] as const).map((gx, gIdx) => (
          <mesh
            key={`${unit.key}-bgland-${gIdx}`}
            position={[gx, -0.24, 0.04 + unit.conduitOffZ]}
            geometry={propGeos.brassGland}
            material={propMats.smBrass}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          />
        ))}

        {/* Bundle of 3 Parallel Steel Conduit Pipes + Horizontal Saddle Clamps */}
        {condOffsets.map((cx, cIdx) => (
          <mesh
            key={`${unit.key}-ucond-${cIdx}`}
            position={[cx, 0.24 + unit.upLen * 0.5, 0.04 + unit.conduitOffZ]}
            material={propMats.conduitGrey}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.013, 0.013, unit.upLen, 8]} />
          </mesh>
        ))}
        {([-0.04, 0.04] as const).map((cx, cIdx) => (
          <mesh
            key={`${unit.key}-dcond-${cIdx}`}
            position={[cx, -0.24 - unit.downLen * 0.5, 0.04 + unit.conduitOffZ]}
            material={propMats.conduitGrey}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.013, 0.013, unit.downLen, 8]} />
          </mesh>
        ))}
        {/* Horizontal Bolted Saddle Clamps Along Conduits */}
        {([0.46, 0.96, -0.46] as const).map((sy, sIdx) => (
          <mesh
            key={`${unit.key}-clamp-${sIdx}`}
            position={[0, sy, 0.036 + unit.conduitOffZ]}
            geometry={propGeos.saddleClamp}
            material={propMats.smGunmetal}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          />
        ))}
      </group>
    );
  };

  const renderPpeCabinet = (opts: {
    key: string;
    pos: readonly [number, number, number];
    rotY: number;
    width: number;
    height: number;
    depth: number;
    hasLegs?: boolean;
  }) => {
    const legH = opts.hasLegs ? 0.06 : 0;
    const bodyH = opts.height - legH;
    const bodyCenterY = legH + bodyH * 0.5;
    const halfW = opts.width * 0.5;
    const halfD = opts.depth * 0.5;
    const doorW = opts.width * 0.45;
    return (
      <group key={opts.key} position={[opts.pos[0], opts.pos[1], opts.pos[2]]} rotation={[0, opts.rotY, 0]}>
        {opts.hasLegs &&
          ([-halfW + 0.06, halfW - 0.06] as const).map((lx, lIdx) => (
            <mesh
              key={`${opts.key}-leg-${lIdx}`}
              position={[lx, 0.03, 0]}
              material={propMats.smGunmetal}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.055, 0.06, opts.depth * 0.86]} />
            </mesh>
          ))}
        {/* Main Olive-Steel Shallow Enclosure */}
        <mesh position={[0, bodyCenterY, 0]} material={propMats.oliveCabinet} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[opts.width, bodyH, opts.depth]} />
        </mesh>
        {/* Top Drip Cap */}
        <mesh position={[0, opts.height + 0.01, 0.008]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[opts.width + 0.025, 0.02, opts.depth + 0.025]} />
        </mesh>
        {/* Twin Beveled Doors With Barrel Hinges, Louvers & White-Cross / GP-5 Stencil */}
        {([-halfW * 0.48, halfW * 0.48] as const).map((dx, dIdx) => (
          <group key={`${opts.key}-door-${dIdx}`} position={[dx, bodyCenterY, halfD + 0.008]}>
            <mesh material={propMats.smDoor} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[doorW, bodyH - 0.06, 0.016]} />
            </mesh>
            {/* Barrel Hinges */}
            {([-bodyH * 0.34, bodyH * 0.34] as const).map((hy, hIdx) => (
              <mesh
                key={`${opts.key}-hinge-${dIdx}-${hIdx}`}
                position={[dIdx === 0 ? -doorW * 0.48 : doorW * 0.48, hy, 0.008]}
                material={propMats.smGunmetal}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.008, 0.008, 0.04, 6]} />
              </mesh>
            ))}
            {/* Stamped Lower Louvers */}
            {([-0.24, -0.18, -0.12] as const).map((ly, lIdx) => (
              <mesh
                key={`${opts.key}-louv-${dIdx}-${lIdx}`}
                position={[0, -bodyH * 0.14 + ly, 0.009]}
                material={propMats.smDarkDeck}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <boxGeometry args={[doorW * 0.72, 0.016, 0.008]} />
              </mesh>
            ))}
          </group>
        ))}
        {/* Recessed Inspection Window Revealing 3D Olive `GP-5` Filter Canisters on Shelf */}
        <group position={[halfW * 0.48, bodyCenterY + bodyH * 0.18, halfD + 0.008]}>
          <mesh material={propMats.smDarkDeck} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[doorW * 0.72, bodyH * 0.28, 0.022]} />
          </mesh>
          {([-0.055, 0.055] as const).map((gx, gIdx) => (
            <mesh
              key={`${opts.key}-can-${gIdx}`}
              position={[gx, -0.02, 0.004]}
              geometry={propGeos.gp5Canister}
              material={propMats.oliveCabinet}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            />
          ))}
          <mesh position={[0, 0, 0.016]} material={propMats.cabinetGlass} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[doorW * 0.66, bodyH * 0.24]} />
          </mesh>
        </group>
        {/* White-Cross Medical & `CIVIL DEF. - GP-5 GAS MASKS` Stencil Plate (`0.014m` proud) */}
        <mesh position={[-halfW * 0.48, bodyCenterY + bodyH * 0.2, halfD + 0.03]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[doorW * 0.84, bodyH * 0.24]} />
          <meshStandardMaterial
            map={ppeCabinetTex}
            roughness={0.5}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
        {/* Chrome T-Latch Handle */}
        <group position={[0.02, bodyCenterY, halfD + 0.022]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.008, 0.008, 0.02, 8]} />
          </mesh>
          <mesh position={[0, 0, 0.012]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.014, 0.068, 0.012]} />
          </mesh>
        </group>
      </group>
    );
  };

  const renderTapeDriveBay = (
    bayPrefix: string,
    baseIdx: number,
    xOffset: number,
    bayScale = 1.0,
  ) => {
    const pushBtnSpecs = [
      { x: -0.2, col: "#33ff66" },
      { x: -0.11, col: "#ff2a2a" },
      { x: -0.02, col: "#ffb000" },
      { x: 0.07, col: "#33ff66" },
    ] as const;
    return (
      <group key={bayPrefix} position={[xOffset, 1.54, 0.255]} scale={bayScale}>
        {/* Deep Dark Recessed Tape Transport Deck Cavity */}
        <mesh
          material={propMats.smDarkDeck}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <boxGeometry args={[0.58, 0.72, 0.06]} />
        </mesh>
        {/* Extruded Aluminum Outer Window Bezel Frame */}
        <mesh
          position={[0, 0.365, 0.022]}
          material={propMats.smAluminum}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <boxGeometry args={[0.62, 0.024, 0.036]} />
        </mesh>
        <mesh
          position={[0, -0.365, 0.022]}
          material={propMats.smAluminum}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <boxGeometry args={[0.62, 0.024, 0.036]} />
        </mesh>
        {([-0.298, 0.298] as const).map((bx, bIdx) => (
          <mesh
            key={`${bayPrefix}-vbez-${bIdx}`}
            position={[bx, 0, 0.022]}
            material={propMats.smAluminum}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.024, 0.75, 0.036]} />
          </mesh>
        ))}

        {/* Left & Right Vacuum Tension Column Channels */}
        {([-0.23, 0.23] as const).map((vx, vIdx) => (
          <group key={`${bayPrefix}-vac-${vIdx}`} position={[vx, -0.08, 0.024]}>
            <mesh
              material={propMats.smGunmetal}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.056, 0.22, 0.016]} />
            </mesh>
            <mesh
              position={[0, 0, 0.01]}
              material={propMats.smAluminum}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.012, 0.19, 0.008]} />
            </mesh>
          </group>
        ))}

        {/* Twin 3D 6-Spoked Metallic/Bakelite Tape Reels (Supply & Take-Up) */}
        {([-0.145, 0.145] as const).map((rx, rIdx) => (
          <group
            key={`${bayPrefix}-reel-${rIdx}`}
            position={[rx, 0.14, 0.026]}
            ref={(el) => {
              reelRefs.current[baseIdx + rIdx] = el;
            }}
          >
            <mesh
              rotation={[Math.PI / 2, 0, 0]}
              material={propMats.smTapePack}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry
                args={[
                  rIdx === 0 ? 0.092 : 0.072,
                  rIdx === 0 ? 0.092 : 0.072,
                  0.016,
                  16,
                ]}
              />
            </mesh>
            <mesh
              position={[0, 0, 0.01]}
              geometry={propGeos.reelRim}
              material={propMats.smReelRim}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            />
            {([0, Math.PI / 3, (2 * Math.PI) / 3] as const).map((ang, sIdx) => (
              <mesh
                key={`${bayPrefix}-spk-${rIdx}-${sIdx}`}
                position={[0, 0, 0.011]}
                rotation={[0, 0, ang]}
                geometry={propGeos.reelSpoke}
                material={propMats.smSilverRoller}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              />
            ))}
            <mesh
              position={[0, 0, 0.008]}
              rotation={[Math.PI / 2, 0, 0]}
              geometry={propGeos.reelHub}
              material={propMats.smSilverRoller}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            />
            <mesh
              position={[0, 0, 0.014]}
              rotation={[Math.PI / 2, 0, 0]}
              geometry={propGeos.reelCap}
              material={propMats.smBrass}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            />
          </group>
        ))}

        {/* Silver Guide Rollers, Tension Arms & Taut Dark-Brown Magnetic Tape Ribbon Path */}
        {(
          [
            [-0.21, -0.02],
            [-0.085, -0.07],
            [0.085, -0.07],
            [0.21, -0.02],
          ] as const
        ).map(([gx, gy], gIdx) => (
          <mesh
            key={`${bayPrefix}-groller-${gIdx}`}
            position={[gx, gy, 0.028]}
            rotation={[Math.PI / 2, 0, 0]}
            geometry={propGeos.guideRoller}
            material={propMats.smSilverRoller}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          />
        ))}
        {([-0.14, 0.14] as const).map((tx, tIdx) => (
          <mesh
            key={`${bayPrefix}-tarm-${tIdx}`}
            position={[tx, -0.05, 0.024]}
            rotation={[0, 0, tIdx === 0 ? -0.35 : 0.35]}
            material={propMats.smAluminum}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.09, 0.016, 0.012]} />
          </mesh>
        ))}
        <mesh
          position={[-0.212, 0.06, 0.028]}
          rotation={[0, 0, 1.48]}
          geometry={propGeos.tapeSegA}
          material={propMats.smTapeRibbon}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />
        <mesh
          position={[-0.145, -0.048, 0.028]}
          rotation={[0, 0, -0.38]}
          geometry={propGeos.tapeSegA}
          material={propMats.smTapeRibbon}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />
        <mesh
          position={[0, -0.072, 0.028]}
          geometry={propGeos.tapeSegC}
          material={propMats.smTapeRibbon}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />
        <mesh
          position={[0.145, -0.048, 0.028]}
          rotation={[0, 0, 0.38]}
          geometry={propGeos.tapeSegA}
          material={propMats.smTapeRibbon}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />
        <mesh
          position={[0.212, 0.06, 0.028]}
          rotation={[0, 0, -1.48]}
          geometry={propGeos.tapeSegB}
          material={propMats.smTapeRibbon}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />

        {/* Central Metallic Read/Write Head Block & Capstan */}
        <group position={[0, -0.088, 0.026]}>
          <mesh
            material={propMats.smSilverRoller}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.075, 0.048, 0.026]} />
          </mesh>
          <mesh
            position={[0, 0.032, 0.004]}
            material={propMats.smGunmetal}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.056, 0.018, 0.022]} />
          </mesh>
          <mesh
            position={[0, -0.012, 0.016]}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.018, 0.01, 0.006]} />
            <meshStandardMaterial
              color="#ffb000"
              emissive="#ffb000"
              emissiveIntensity={1.2}
            />
          </mesh>
        </group>

        {/* Smoked-Glass Upper Bay Door (`MeshBasicMaterial` + `fog={false}`) & Chrome Handle */}
        <mesh
          position={[0, 0.05, 0.048]}
          material={propMats.smSmokedGlass}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <planeGeometry args={[0.55, 0.56]} />
        </mesh>
        <mesh
          position={[0.24, 0.05, 0.054]}
          material={propMats.smSilverRoller}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <boxGeometry args={[0.014, 0.11, 0.016]} />
        </mesh>

        {/* Lower Transport Control Strip: 4 Chunky Backlit Pushbuttons + Analog Tension Meter */}
        <mesh
          position={[0, -0.26, 0.028]}
          material={propMats.smGunmetal}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <boxGeometry args={[0.55, 0.135, 0.02]} />
        </mesh>
        <mesh
          position={[-0.06, -0.305, 0.04]}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <planeGeometry args={[0.36, 0.038]} />
          <meshStandardMaterial
            map={sm2mButtonsLabelTex}
            roughness={0.5}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
        {pushBtnSpecs.map((btn, lIdx) => {
          const ledIdx = baseIdx * 3 + lIdx;
          return (
            <group
              key={`${bayPrefix}-btn-${lIdx}`}
              position={[btn.x, -0.245, 0.04]}
            >
              <mesh
                geometry={propGeos.buttonCollar}
                material={propMats.bakeliteDark}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              />
              <mesh
                position={[0, 0, 0.009]}
                geometry={propGeos.buttonCap}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <meshStandardMaterial
                  ref={(el) => {
                    ledMatRefs.current[ledIdx] = el;
                  }}
                  color={btn.col}
                  emissive={btn.col}
                  emissiveIntensity={1.35}
                  roughness={0.35}
                />
              </mesh>
            </group>
          );
        })}
        {/* Miniature Analog Tension Meter (`TENSION`) */}
        <group position={[0.195, -0.255, 0.04]}>
          <mesh
            material={propMats.bakeliteDark}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.095, 0.088, 0.016]} />
          </mesh>
          <mesh
            position={[0, 0, 0.01]}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <planeGeometry args={[0.078, 0.072]} />
            <meshStandardMaterial
              map={sm2mTensionDialTex}
              roughness={0.5}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
        </group>
      </group>
    );
  };

  return (
    <group>
      {/* 1. Closed-Loop Color-Coded Soviet Ceiling Piping, Cast-Iron Elbows, Instanced Flanges & Wall Brackets */}
      <instancedMesh
        ref={pipeFlangeInstRef}
        args={[undefined, undefined, 60]}
        material={propMats.smGunmetal}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      >
        <primitive object={propGeos.pipeFlange} attach="geometry" />
      </instancedMesh>
      <instancedMesh
        ref={pipeBracketInstRef}
        args={[undefined, undefined, 34]}
        material={propMats.smGunmetal}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      >
        <primitive object={propGeos.pipeBracket} attach="geometry" />
      </instancedMesh>

      {pipeLines.map((pipe, pIdx) => (
        <group key={`ceil-pipe-set-${pIdx}`}>
          {/* Left & Right Wall Overhead Runs (`x = ±5.64`, `z = -4.14..+4.14`, clear of pillars) */}
          {([-5.64, 5.64] as const).map((px, sIdx) => (
            <mesh
              key={`lr-pipe-${pIdx}-${sIdx}`}
              position={[px, pipe.y, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.036, 0.036, 8.28, 10]} />
              <meshStandardMaterial color={pipe.color} metalness={0.56} roughness={0.42} />
            </mesh>
          ))}
          {/* Front & Rear Wall Overhead Runs (`z = ±4.14`, `x = -5.64..+5.64`, clear of pillars) */}
          {([-4.14, 4.14] as const).map((pz, sIdx) => (
            <mesh
              key={`fr-pipe-${pIdx}-${sIdx}`}
              position={[0, pipe.y, pz]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.034, 0.034, 11.28, 10]} />
              <meshStandardMaterial color={pipe.color} metalness={0.56} roughness={0.42} />
            </mesh>
          ))}
          {/* 12 Cast-Iron 90° Corner Elbow Fittings at `(±5.64, pipe.y, ±4.14)` */}
          {(
            [
              [-5.64, -4.14],
              [5.64, -4.14],
              [-5.64, 4.14],
              [5.64, 4.14],
            ] as const
          ).map(([ex, ez], eIdx) => (
            <mesh
              key={`pipe-elbow-${pIdx}-${eIdx}`}
              position={[ex, pipe.y, ez]}
              material={propMats.smGunmetal}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <sphereGeometry args={[0.056, 10, 8]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* 4 Corner Vertical Drop Risers (Red at `[±5.64, ±4.14]`, Yellow at `[±5.53, ±4.25]` with Upper Elbow Spur) */}
      {(
        [
          { rx: -5.64, rz: -4.14, yx: -5.53, yz: -4.25, rotY: Math.PI / 4 },
          { rx: 5.64, rz: -4.14, yx: 5.53, yz: -4.25, rotY: -Math.PI / 4 },
          { rx: -5.64, rz: 4.14, yx: -5.53, yz: 4.25, rotY: (3 * Math.PI) / 4 },
          { rx: 5.64, rz: 4.14, yx: 5.53, yz: 4.25, rotY: (-3 * Math.PI) / 4 },
        ] as const
      ).map((cr, cIdx) => (
        <group key={`corner-drops-${cIdx}`}>
          {/* Red Fire Line Vertical Riser */}
          <mesh position={[cr.rx, 1.9, cr.rz]} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.032, 0.032, 3.8, 10]} />
            <meshStandardMaterial color="#b8241e" metalness={0.56} roughness={0.42} />
          </mesh>
          {/* Yellow Instrument Air Vertical Riser + Top Offset Elbow Spur */}
          <mesh position={[cr.yx, 1.84, cr.yz]} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.03, 0.03, 3.68, 10]} />
            <meshStandardMaterial color="#e09f18" metalness={0.56} roughness={0.42} />
          </mesh>
          <mesh position={[(cr.rx + cr.yx) * 0.5, 3.68, (cr.rz + cr.yz) * 0.5]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.14, 0.068, 0.14]} />
          </mesh>
          {/* Vertical Riser Flanged Gate Valve + 4-Spoked Red Handwheel at `y = 1.42m` */}
          <group position={[cr.rx, 1.42, cr.rz]} rotation={[0, cr.rotY, 0]}>
            <mesh material={propMats.fireRed} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.056, 0.056, 0.14, 10]} />
            </mesh>
            <mesh position={[0, 0, 0.045]} rotation={[Math.PI / 2, 0, 0]} material={propMats.smBrass} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.015, 0.015, 0.085, 8]} />
            </mesh>
            <group position={[0, 0, 0.088]}>
              <mesh material={propMats.fireRed} castShadow={false} raycast={NOOP_RAYCAST}>
                <torusGeometry args={[0.088, 0.015, 8, 16]} />
              </mesh>
              <mesh material={propMats.fireRed} castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.165, 0.015, 0.015]} />
              </mesh>
              <mesh material={propMats.fireRed} castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.015, 0.165, 0.015]} />
              </mesh>
            </group>
          </group>
          {/* Tiny Bourdon Pipe Pressure Gauge (`MP3-U`) on Yellow Air Riser at `y = 1.68m` */}
          <group position={[cr.yx, 1.68, cr.yz]} rotation={[0, cr.rotY, 0]}>
            <mesh position={[0, 0, 0.032]} rotation={[Math.PI / 2, 0, 0]} material={propMats.smBrass} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.013, 0.013, 0.06, 8]} />
            </mesh>
            <mesh position={[0, 0, 0.058]} rotation={[Math.PI / 2, 0, 0]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.064, 0.068, 0.026, 14]} />
            </mesh>
            <mesh position={[0, 0, 0.073]} castShadow={false} raycast={NOOP_RAYCAST}>
              <circleGeometry args={[0.054, 14]} />
              <meshStandardMaterial
                map={sm2mTensionDialTex}
                roughness={0.5}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
          </group>
        </group>
      ))}

      {/* Perforated Overhead Steel Wall Cable Trays (`y = 3.36m`) + Bundled Cables */}
      {(
        [
          { key: "tray-right", pos: [5.84, 3.36, 0.58] as const, rotY: -Math.PI / 2, len: 7.2 },
          { key: "tray-rear", pos: [0, 3.36, 4.34] as const, rotY: Math.PI, len: 11.4 },
          { key: "tray-left-front", pos: [-5.84, 3.36, -1.78] as const, rotY: Math.PI / 2, len: 2.55 },
          { key: "tray-left-rear", pos: [-5.84, 3.36, 3.76] as const, rotY: Math.PI / 2, len: 0.88 },
        ] as const
      ).map((tr) => (
        <group key={tr.key} position={[tr.pos[0], tr.pos[1], tr.pos[2]]} rotation={[0, tr.rotY, 0]}>
          {/* Perforated Tray Floor + Front U-Channel Lip */}
          <mesh material={propMats.trayPerfMat} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[tr.len, 0.014, 0.24]} />
          </mesh>
          <mesh position={[0, 0.028, 0.115]} material={propMats.galvanizedSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[tr.len, 0.056, 0.012]} />
          </mesh>
          {/* 3 Bundled Dark Armored Power Cables Inside Tray */}
          {([-0.05, 0, 0.05] as const).map((cz, cIdx) => (
            <mesh
              key={`${tr.key}-cable-${cIdx}`}
              position={[0, 0.022, cz]}
              rotation={[0, 0, Math.PI / 2]}
              material={propMats.cableBlack}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.014, 0.014, tr.len - 0.08, 8]} />
            </mesh>
          ))}
          {/* L-Brackets Supporting Cable Tray From Wall */}
          {([-0.38, 0, 0.38] as const).map((frac, bIdx) => (
            <mesh
              key={`${tr.key}-lbr-${bIdx}`}
              position={[tr.len * frac, -0.042, 0]}
              material={propMats.smGunmetal}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.036, 0.072, 0.24]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* 2. Heavy 3D Switchgear Distribution Boxes (`DB-380V`) With Conduits & Saddle Clamps */}
      {switchgearUnits.map((unit) => renderSwitchgear380V(unit))}

      {/* 3. Wheeled Soviet Leatherette Operator Swivel Chairs Along Main Console Arc */}
      {chairConfigs.map((ch, cIdx) => (
        <SovietErgonomicSwivelChair3D
          key={`op-chair-${cIdx}`}
          position={ch.pos}
          rotY={ch.rotY}
          cushionColor={ch.cushion}
        />
      ))}

      {/* 4. Front-Left Twin-Bay `SM-2M` Magnetic Tape Computer Cabinet (`[-5.60, 0, -2.38]`, clear of Pillar 8 & Synoptic Wing) */}
      <group position={[-5.6, 0, -2.38]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 0.06, 0]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.18, 0.12, 0.6]} />
        </mesh>
        <mesh position={[-0.48, 0.06, 0.34]} material={propMats.conduitGrey} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.022, 0.026, 0.14, 8]} />
        </mesh>
        <mesh position={[0, 1.18, 0]} material={propMats.smBody} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.14, 2.16, 0.56]} />
        </mesh>
        {([-0.57, 0.57] as const).map((ex, eIdx) => (
          <mesh key={`sm2m-fl-angle-${eIdx}`} position={[ex, 1.075, 0.27]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.038, 1.9, 0.04]} />
          </mesh>
        ))}
        <mesh position={[0, 2.15, 0.06]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.18, 0.24, 0.66]} />
        </mesh>
        <mesh position={[-0.12, 2.15, 0.395]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.74, 0.16]} />
          <meshStandardMaterial
            map={sm2mNameplateTex}
            roughness={0.48}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
        {([0.34, 0.42, 0.5] as const).map((lx, lIdx) => {
          const lCol = lIdx === 0 ? "#ff2a2a" : lIdx === 1 ? "#ffb000" : "#33ff66";
          return (
            <mesh
              key={`sm2m-fl-toplamp-${lIdx}`}
              position={[lx, 2.15, 0.395]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.02, 0.02, 0.024, 10]} />
              <meshStandardMaterial color={lCol} emissive={lCol} emissiveIntensity={1.25} />
            </mesh>
          );
        })}
        {renderTapeDriveBay("sm2m-fl-1", 0, -0.28, 0.86)}
        {renderTapeDriveBay("sm2m-fl-2", 2, 0.28, 0.86)}
        {([-0.28, 0.28] as const).map((dx, dIdx) => (
          <group key={`sm2m-fl-door-${dIdx}`} position={[dx, 0.56, 0.286]}>
            <mesh material={propMats.smDoor} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.51, 0.84, 0.018]} />
            </mesh>
            <mesh position={[0, 0, 0.008]} material={propMats.smPuttyDoor} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.45, 0.76, 0.01]} />
            </mesh>
            {([-0.15, -0.075, 0, 0.075, 0.15] as const).map((vx, vIdx) => (
              <mesh
                key={`sm2m-fl-vlouv-${dIdx}-${vIdx}`}
                position={[vx, 0.16, 0.016]}
                geometry={propGeos.vertLouver}
                material={propMats.smDarkDeck}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              />
            ))}
            {([-0.15, -0.075, 0, 0.075, 0.15] as const).map((vx, vIdx) => (
              <mesh
                key={`sm2m-fl-vlouv2-${dIdx}-${vIdx}`}
                position={[vx, -0.18, 0.016]}
                geometry={propGeos.vertLouver}
                material={propMats.smDarkDeck}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              />
            ))}
            <mesh position={[0.19, 0.04, 0.022]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.02, 0.11, 0.022]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 5. Front-Right Single-Bay `SM-2M` Tape Computer Cabinet (`[5.62, 0, -2.54]`, clear of Pillar 10 & Window 1) */}
      <group position={[5.62, 0, -2.54]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, 0.06, 0]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.9, 0.12, 0.58]} />
        </mesh>
        <mesh position={[0, 1.18, 0]} material={propMats.smBody} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.86, 2.16, 0.54]} />
        </mesh>
        {([-0.43, 0.43] as const).map((ex, eIdx) => (
          <mesh key={`sm2m-fr-angle-${eIdx}`} position={[ex, 1.075, 0.26]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.038, 1.9, 0.04]} />
          </mesh>
        ))}
        <mesh position={[0, 2.15, 0.06]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.9, 0.24, 0.64]} />
        </mesh>
        <mesh position={[-0.07, 2.15, 0.385]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.62, 0.15]} />
          <meshStandardMaterial
            map={sm2mNameplateTex}
            roughness={0.48}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
        {([0.29, 0.37] as const).map((lx, lIdx) => {
          const lCol = lIdx === 0 ? "#ffb000" : "#33ff66";
          return (
            <mesh
              key={`sm2m-fr-toplamp-${lIdx}`}
              position={[lx, 2.15, 0.385]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.02, 0.02, 0.022, 10]} />
              <meshStandardMaterial color={lCol} emissive={lCol} emissiveIntensity={1.25} />
            </mesh>
          );
        })}
        {renderTapeDriveBay("sm2m-fr-1", 4, 0, 0.96)}
        <group position={[0, 0.56, 0.276]}>
          <mesh material={propMats.smDoor} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.72, 0.84, 0.018]} />
          </mesh>
          <mesh position={[0, 0, 0.008]} material={propMats.smPuttyDoor} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.64, 0.76, 0.01]} />
          </mesh>
          {([-0.22, -0.14, -0.06, 0.02, 0.1, 0.18] as const).map((vx, vIdx) => (
            <mesh
              key={`sm2m-fr-vlouv-${vIdx}`}
              position={[vx, 0.16, 0.016]}
              geometry={propGeos.vertLouver}
              material={propMats.smDarkDeck}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            />
          ))}
          {([-0.22, -0.14, -0.06, 0.02, 0.1, 0.18] as const).map((vx, vIdx) => (
            <mesh
              key={`sm2m-fr-vlouv2-${vIdx}`}
              position={[vx, -0.18, 0.016]}
              geometry={propGeos.vertLouver}
              material={propMats.smDarkDeck}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            />
          ))}
          <mesh position={[0.26, 0.04, 0.022]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.022, 0.11, 0.022]} />
          </mesh>
        </group>
      </group>
      {/* Framed Electrical Safety Poster Above Front-Right `SM-2M` */}
      <group position={[5.972, 2.74, -2.54]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, 0, 0.01]} material={propMats.smAluminum} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.8, 0.54, 0.02]} />
        </mesh>
        <mesh position={[0, 0, 0.036]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.74, 0.48]} />
          <meshStandardMaterial
            map={safetyPosterTex}
            roughness={0.54}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>

      {/* 6. Rebuilt Rear-Left HVAC Trunk (`VK-4`), 3D `FIRE SHIELD NO. 4`, `PK-4` Hose Cabinet + `IPR`, & `FIRE SAND NO. 1` */}
      <group position={[0, 0, 4.476]} rotation={[0, Math.PI, 0]}>
        {/* A. Galvanized Sheet-Metal HVAC Trunk & Bolted Louver Grille Assembly (`worldX = -3.96, y = 2.74`, clear of Pillar 6) */}
        <group position={[3.96, 2.74, 0.006]}>
          {/* Perimeter Angle-Iron Mounting Flange + Hex Rivets */}
          <mesh position={[0, 0, 0.01]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.6, 0.6, 0.02]} />
          </mesh>
          {/* Galvanized Sheet-Metal Plenum Trunk */}
          <mesh position={[0, 0, 0.09]} material={propMats.galvanizedSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.52, 0.54, 0.16]} />
          </mesh>
          {/* Upper Plenum Riser Collar Up Toward Cable Tray */}
          <mesh position={[0, 0.38, 0.07]} material={propMats.galvanizedSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.68, 0.24, 0.13]} />
          </mesh>
          {/* 3 Standing Sheet-Metal Seam Ribs */}
          {([-0.74, 0, 0.74] as const).map((sx, sIdx) => (
            <mesh key={`hvac-seam-${sIdx}`} position={[sx, 0, 0.174]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.026, 0.54, 0.016]} />
            </mesh>
          ))}
          {/* Brass `HVAC PLENUM VK-4` Nameplate (`0.016m` proud of trunk) */}
          <mesh position={[0, 0.205, 0.186]} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.64, 0.11]} />
            <meshStandardMaterial
              map={hvacPlateTex}
              roughness={0.46}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
          {/* Twin Recessed Bolted Louver Grilles */}
          {([-0.38, 0.38] as const).map((gx, gIdx) => (
            <group key={`hvac-grille-${gIdx}`} position={[gx, -0.05, 0.17]}>
              <mesh material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.56, 0.34, 0.018]} />
              </mesh>
              <mesh position={[0, 0, 0.008]} material={propMats.smDarkDeck} castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.5, 0.28, 0.01]} />
              </mesh>
              {([-0.105, -0.07, -0.035, 0, 0.035, 0.07, 0.105] as const).map((ly, lIdx) => (
                <mesh
                  key={`hvac-blade-${gIdx}-${lIdx}`}
                  position={[0, ly, 0.015]}
                  rotation={[0.42, 0, 0]}
                  geometry={propGeos.hvacLouver}
                  material={propMats.galvanizedSteel}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                />
              ))}
              {([-0.25, 0.25] as const).map((bx) =>
                ([-0.145, 0.145] as const).map((by) => (
                  <mesh
                    key={`hvac-rivet-${gIdx}-${bx}-${by}`}
                    position={[bx, by, 0.014]}
                    rotation={[Math.PI / 2, 0, 0]}
                    geometry={propGeos.hexBolt}
                    material={propMats.smBrass}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  />
                )),
              )}
            </group>
          ))}
          {/* Side Mechanical Damper Quadrant & Red Handle Lever */}
          <group position={[-0.78, -0.04, 0.1]}>
            <mesh material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.07, 0.07, 0.016, 12, 1, false, 0, Math.PI]} />
            </mesh>
            <mesh position={[-0.018, 0.04, 0.03]} rotation={[0.48, 0, 0]} material={propMats.fireRed} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.018, 0.15, 0.022]} />
            </mesh>
          </group>
        </group>

        {/* B. 3D Welded Angle-Iron `FIRE SHIELD NO. 4 // MCR-4` Shadowbox & Tools (`worldX = -4.32`) */}
        <group position={[4.32, 0, 0]}>
          {/* Standoff Brackets Holding Shadowbox Clear of `1.55m` Dado Rail */}
          {([-0.54, 0.54] as const).map((sx) =>
            ([0.92, 1.88] as const).map((sy) => (
              <mesh
                key={`shield-standoff-${sx}-${sy}`}
                position={[sx, sy, 0.022]}
                material={propMats.smGunmetal}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <boxGeometry args={[0.06, 0.06, 0.044]} />
              </mesh>
            )),
          )}
          {/* Steel Backing Plate & Welded Angle-Iron Shadowbox Frame (`z = 0.043..0.069`) */}
          <mesh position={[0, 1.4, 0.056]} material={propMats.fireRed} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.24, 1.24, 0.026]} />
          </mesh>
          <mesh position={[0, 1.4, 0.086]} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[1.14, 1.14]} />
            <meshStandardMaterial
              map={fireShieldTex}
              roughness={0.56}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
          {/* Welded Outer Angle-Iron Border + Overhanging Top Drip Hood */}
          {([-0.62, 0.62] as const).map((fx, fIdx) => (
            <mesh key={`shield-vframe-${fIdx}`} position={[fx, 1.4, 0.095]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.036, 1.28, 0.09]} />
            </mesh>
          ))}
          <mesh position={[0, 0.78, 0.095]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.204, 0.036, 0.09]} />
          </mesh>
          <mesh position={[0, 2.04, 0.11]} rotation={[0.12, 0, 0]} material={propMats.fireRed} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.3, 0.032, 0.14]} />
          </mesh>

          {/* 2 Angled 3D Open-Rimmed Conical Red Fire Buckets With Wire Bail Handles */}
          {([-0.44, -0.22] as const).map((bx, bIdx) => (
            <group
              key={`fire-cone-${bIdx}`}
              position={[bx, 1.48, 0.165]}
              rotation={[0.14, 0, bIdx === 0 ? 0.11 : -0.09]}
            >
              {/* Steel Wall Peg */}
              <mesh position={[0, 0.22, -0.075]} rotation={[Math.PI / 2, 0, 0]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.008, 0.008, 0.06, 6]} />
              </mesh>
              {/* Open-Ended Red Outer Cone + Dark Hollow Inner Liner */}
              <mesh rotation={[Math.PI, 0, 0]} material={propMats.fireRed} castShadow={false} raycast={NOOP_RAYCAST}>
                <coneGeometry args={[0.088, 0.24, 14, 1, true]} />
              </mesh>
              <mesh rotation={[Math.PI, 0, 0]} material={propMats.fireBucketHollow} castShadow={false} raycast={NOOP_RAYCAST}>
                <coneGeometry args={[0.085, 0.236, 14, 1, true]} />
              </mesh>
              {/* Rolled Steel Rim Torus + Apex Grip Ring */}
              <mesh position={[0, 0.118, 0]} rotation={[Math.PI / 2, 0, 0]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
                <torusGeometry args={[0.088, 0.007, 6, 14]} />
              </mesh>
              <mesh position={[0, -0.125, 0]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
                <torusGeometry args={[0.015, 0.005, 6, 10]} />
              </mesh>
              {/* Curved 3D Steel Wire Bail Handle */}
              <mesh position={[0, 0.122, 0]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
                <torusGeometry args={[0.086, 0.0045, 6, 14, Math.PI]} />
              </mesh>
            </group>
          ))}

          {/* Compact 3D Fire Shovel */}
          <group position={[-0.02, 1.44, 0.115]}>
            <mesh position={[0, 0.28, -0.025]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.055, 0.024, 0.032]} />
            </mesh>
            <mesh position={[0, 0.1, 0]} material={propMats.woodAsh} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.012, 0.012, 0.44, 8]} />
            </mesh>
            <mesh position={[0, 0.32, 0]} rotation={[0, 0, Math.PI / 2]} material={propMats.woodAsh} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.012, 0.012, 0.085, 8]} />
            </mesh>
            {/* Steel Spade Blade */}
            <mesh position={[0, -0.18, 0.006]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.105, 0.16, 0.008]} />
            </mesh>
            <mesh position={[0, -0.275, 0.006]} rotation={[0, 0, Math.PI]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
              <coneGeometry args={[0.052, 0.05, 4]} />
            </mesh>
          </group>

          {/* 3D Fire Axe */}
          <group position={[0.14, 1.46, 0.115]}>
            <mesh position={[0, 0.14, -0.025]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.044, 0.022, 0.032]} />
            </mesh>
            <mesh position={[0, 0, 0]} material={propMats.woodAsh} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.012, 0.013, 0.56, 8]} />
            </mesh>
            <mesh position={[0, -0.25, 0]} material={propMats.fireRed} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.015, 0.015, 0.09, 8]} />
            </mesh>
            {/* Forged Axe Head + Cutting Blade + Rear Pick Spike */}
            <mesh position={[0.025, 0.22, 0]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.085, 0.058, 0.022]} />
            </mesh>
            <mesh position={[0.072, 0.22, 0]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.022, 0.075, 0.012]} />
            </mesh>
            <mesh position={[-0.042, 0.225, 0]} rotation={[0, 0, Math.PI / 2]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
              <coneGeometry args={[0.012, 0.065, 6]} />
            </mesh>
          </group>

          {/* Red/White Striped Steel Pike Pole */}
          <group position={[0.27, 1.44, 0.112]}>
            <mesh position={[0, 0.24, -0.025]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.044, 0.022, 0.032]} />
            </mesh>
            {([-0.26, -0.13, 0, 0.13, 0.26] as const).map((py, pIdx) => (
              <mesh
                key={`pike-seg-${pIdx}`}
                position={[0, py, 0]}
                material={pIdx % 2 === 0 ? propMats.fireRed : propMats.whiteStripe}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.012, 0.012, 0.132, 8]} />
              </mesh>
            ))}
            {/* Bottom Ring & Top Forged Spear + Gaff Hook */}
            <mesh position={[0, -0.34, 0]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
              <torusGeometry args={[0.022, 0.005, 6, 10]} />
            </mesh>
            <mesh position={[0, 0.365, 0]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
              <coneGeometry args={[0.014, 0.09, 6]} />
            </mesh>
            <mesh position={[0.026, 0.335, 0]} rotation={[0, 0, -0.75]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.014, 0.075, 0.014]} />
            </mesh>
          </group>

          {/* Detailed 3D `OU-5` CO2 Fire Extinguisher (`lx = +0.44, y = 1.38`) */}
          <group position={[0.44, 1.38, 0.16]}>
            {/* Twin Hinged Dark-Steel Wall Clamps */}
            {([-0.11, 0.11] as const).map((cy, cIdx) => (
              <mesh key={`ext-clamp-${cIdx}`} position={[0, cy, -0.04]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.165, 0.024, 0.11]} />
              </mesh>
            ))}
            {/* Steel Cylinder + Domed Shoulder + White Inspection Band */}
            <mesh material={propMats.fireRed} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.076, 0.076, 0.39, 14]} />
            </mesh>
            <mesh position={[0, 0.195, 0]} material={propMats.fireRed} castShadow={false} raycast={NOOP_RAYCAST}>
              <sphereGeometry args={[0.076, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            </mesh>
            <mesh position={[0, 0.04, 0]} material={propMats.whiteStripe} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.0775, 0.0775, 0.055, 14]} />
            </mesh>
            {/* Brass Valve Head, Squeeze Lever & Miniature Pressure Manometer */}
            <mesh position={[0, 0.275, 0]} material={propMats.smBrass} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.018, 0.024, 0.07, 8]} />
            </mesh>
            <mesh position={[0.032, 0.305, 0]} rotation={[0, 0, -0.22]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.08, 0.014, 0.016]} />
            </mesh>
            <mesh position={[0, 0.28, 0.028]} rotation={[Math.PI / 2, 0, 0]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.022, 0.022, 0.012, 10]} />
            </mesh>
            <mesh position={[0, 0.28, 0.036]} castShadow={false} raycast={NOOP_RAYCAST}>
              <circleGeometry args={[0.017, 10]} />
              <meshStandardMaterial
                map={ammeterDialTex}
                roughness={0.5}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
            {/* Curved Hose Stub & Flared Black CO2 Diffuser Horn */}
            <mesh position={[-0.052, 0.25, 0.02]} rotation={[0, 0, 0.72]} material={propMats.cableBlack} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.011, 0.011, 0.085, 8]} />
            </mesh>
            <mesh position={[-0.086, 0.145, 0.032]} rotation={[0.14, 0, 0.28]} material={propMats.bakeliteDark} castShadow={false} raycast={NOOP_RAYCAST}>
              <coneGeometry args={[0.044, 0.155, 12]} />
            </mesh>
          </group>

          {/* Upgraded Floor Sand Box (`FIRE SAND NO. 1`) With 0.04m Skids, Pitched Hinged Lid, Strap Hinges, Padlock Hasp & Carry Handles */}
          <group position={[0, 0, 0.155]}>
            {/* 3 Dark-Steel Floor Skids (`0.04m` elevation) */}
            {([-0.46, 0, 0.46] as const).map((lx, lIdx) => (
              <mesh key={`sand-skid-${lIdx}`} position={[lx, 0.02, 0]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.055, 0.04, 0.26]} />
              </mesh>
            ))}
            {/* Main Red Steel Bin Body (`1.10 × 0.34 × 0.24`) */}
            <mesh position={[0, 0.21, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[1.1, 0.34, 0.24]} />
              <meshStandardMaterial color="#a61e18" roughness={0.62} metalness={0.26} />
            </mesh>
            {/* Pitched Overhanging Hinged Lid (`1.16 × 0.028 × 0.28`) */}
            <mesh position={[0, 0.395, 0.008]} rotation={[0.15, 0, 0]} material={propMats.fireRed} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[1.16, 0.028, 0.28]} />
            </mesh>
            {/* 2 Heavy Black Forged-Iron Strap Hinges Across Top Lid */}
            {([-0.36, 0.36] as const).map((hx, hIdx) => (
              <mesh
                key={`sand-strap-${hIdx}`}
                position={[hx, 0.412, -0.015]}
                rotation={[0.15, 0, 0]}
                material={propMats.smGunmetal}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <boxGeometry args={[0.046, 0.012, 0.22]} />
              </mesh>
            ))}
            {/* Center Steel Padlock Hasp + 3D Brass Padlock */}
            <mesh position={[0, 0.355, 0.132]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.046, 0.085, 0.016]} />
            </mesh>
            <mesh position={[0, 0.32, 0.145]} material={propMats.smBrass} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.036, 0.042, 0.018]} />
            </mesh>
            {/* Left & Right Bolted U-Bar Carry Handles */}
            {([-0.56, 0.56] as const).map((hx, hIdx) => (
              <mesh
                key={`sand-handle-${hIdx}`}
                position={[hx, 0.24, 0]}
                rotation={[0, Math.PI / 2, 0]}
                material={propMats.smGunmetal}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <torusGeometry args={[0.045, 0.009, 6, 12, Math.PI]} />
              </mesh>
            ))}
            {/* Front Bolted Stencil Plaque (`0.016m` proud) */}
            <mesh position={[0, 0.2, 0.136]} castShadow={false} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.62, 0.16]} />
              <meshStandardMaterial
                map={sandBoxPlaqueTex}
                roughness={0.54}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
          </group>
        </group>

        {/* C. 3D Fire Hose Cabinet (`FIRE HOSE PK-4`) + Caged Break-Glass Alarm (`IPR CALL POINT`) (`worldX = -3.14`) */}
        <group position={[3.14, 0, 0]}>
          {/* Standoff Wall Brackets Clearing `1.55m` Dado Rail */}
          {([-0.26, 0.26] as const).map((sx) =>
            ([1.14, 1.72] as const).map((sy) => (
              <mesh key={`pk4-lug-${sx}-${sy}`} position={[sx, sy, 0.022]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.048, 0.048, 0.044]} />
              </mesh>
            )),
          )}
          {/* Recessed Red Steel Cabinet (`0.64m × 0.72m × 0.14m`) */}
          <mesh position={[0, 1.44, 0.114]} material={propMats.fireRed} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.64, 0.72, 0.14]} />
          </mesh>
          {/* Dark Recessed Interior Cavity Visible Behind Glass Window */}
          <mesh position={[-0.04, 1.47, 0.145]} material={propMats.fireDarkInside} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.42, 0.44, 0.085]} />
          </mesh>
          {/* Interior Coiled White Canvas Fire Hose + Brass Nozzle + Red Hydrant Valve Wheel */}
          <group position={[-0.08, 1.47, 0.16]}>
            <mesh geometry={propGeos.hoseCoilA} material={propMats.canvasHose} castShadow={false} raycast={NOOP_RAYCAST} />
            <mesh geometry={propGeos.hoseCoilB} material={propMats.canvasHose} castShadow={false} raycast={NOOP_RAYCAST} />
            <mesh geometry={propGeos.hoseCoilC} material={propMats.canvasHose} castShadow={false} raycast={NOOP_RAYCAST} />
            {/* Brass Fire Nozzle */}
            <mesh position={[0.17, -0.05, 0.012]} rotation={[0, 0, -0.25]} material={propMats.smBrass} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.014, 0.026, 0.18, 10]} />
            </mesh>
            {/* Hydrant Supply Pipe & Red Valve Handwheel */}
            <mesh position={[0.16, 0.12, 0]} material={propMats.fireRed} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.018, 0.018, 0.14, 8]} />
            </mesh>
            <mesh position={[0.16, 0.14, 0.02]} material={propMats.fireRed} castShadow={false} raycast={NOOP_RAYCAST}>
              <torusGeometry args={[0.052, 0.01, 6, 14]} />
            </mesh>
          </group>
          {/* Dark-Tinted Cabinet Window Pane (`depthWrite={false}`) */}
          <mesh position={[-0.04, 1.47, 0.19]} material={propMats.cabinetGlass} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.42, 0.44]} />
          </mesh>
          {/* Hinged Outer Beveled Frame + Barrel Hinges + Chrome Latch */}
          {([-0.22, 0.22] as const).map((hy, hIdx) => (
            <mesh key={`pk4-hinge-${hIdx}`} position={[-0.315, 1.44 + hy, 0.192]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.011, 0.011, 0.048, 6]} />
            </mesh>
          ))}
          <mesh position={[0.25, 1.44, 0.194]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.022, 0.085, 0.022]} />
          </mesh>
          {/* `PK-4 // FIRE HOSE • 01` Lower Door Stencil (`0.016m` proud) */}
          <mesh position={[0, 1.155, 0.2]} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.52, 0.12]} />
            <meshStandardMaterial
              map={hoseCabinetTex}
              roughness={0.5}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>

          {/* Caged Break-Glass Alarm Button (`IPR CALL POINT`) + Clamped Conduit Above `PK-4` */}
          <group position={[0, 2.04, 0.04]}>
            <mesh material={propMats.fireRed} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.16, 0.18, 0.075]} />
            </mesh>
            <mesh position={[0, 0.032, 0.051]} castShadow={false} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.13, 0.085]} />
              <meshStandardMaterial
                map={iprButtonTex}
                roughness={0.48}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
            <mesh position={[0, -0.042, 0.044]} rotation={[Math.PI / 2, 0, 0]} material={propMats.bakeliteDark} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.022, 0.022, 0.02, 10]} />
            </mesh>
            {/* Protective Wire Cage Over Alarm Button */}
            <mesh position={[0, -0.042, 0.056]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
              <torusGeometry args={[0.042, 0.004, 6, 12]} />
            </mesh>
            {/* Conduit Rising to Cable Tray (`y = 3.36m`) */}
            <mesh position={[0, 0.72, -0.018]} material={propMats.conduitGrey} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.014, 0.014, 1.32, 8]} />
            </mesh>
          </group>
        </group>

        {/* D. Shallow Civil Defense PPE Cabinet (`CIVIL DEF.`) in Bare Lower Bay Left of `EXIT` Doors (`worldX = -1.685`) */}
        {renderPpeCabinet({
          key: "ppe-rear-center-left",
          pos: [1.685, 0, 0.13],
          rotY: 0,
          width: 0.76,
          height: 1.36,
          depth: 0.2,
          hasLegs: true,
        })}

        {/* E. Low Civil Defense Respirator & Dosimetry Locker Cleanly Under Window 2 Sill (`worldX = +3.50`, `y = 0..0.90m`) */}
        {renderPpeCabinet({
          key: "ppe-under-win2",
          pos: [-3.5, 0, 0.13],
          rotY: 0,
          width: 1.18,
          height: 0.9,
          depth: 0.2,
          hasLegs: true,
        })}
      </group>

      {/* 7. Bare `+X / +Z` Corner Wall Bay (`x = +5.976, z = +3.35`, clear between Pillar 11 & Corner Pillar 3) */}
      <group position={[5.976, 0, 3.35]} rotation={[0, -Math.PI / 2, 0]}>
        {/* A. Framed Technical RBMK Block-4 Evacuation & Cooling Schematic Poster (`y = 2.74m`) */}
        <group position={[-0.14, 2.74, 0.015]}>
          <mesh material={propMats.smAluminum} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.14, 0.64, 0.022]} />
          </mesh>
          {([-0.54, 0.54] as const).map((bx) =>
            ([-0.29, 0.29] as const).map((by) => (
              <mesh
                key={`evac-bolt-${bx}-${by}`}
                position={[bx, by, 0.014]}
                rotation={[Math.PI / 2, 0, 0]}
                geometry={propGeos.hexBolt}
                material={propMats.smBrass}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              />
            )),
          )}
          <mesh position={[0, 0, 0.027]} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[1.06, 0.56]} />
            <meshStandardMaterial
              map={rbmkEvacPosterTex}
              roughness={0.56}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
        </group>

        {/* B. Wall Radiation Monitoring Unit (`UIM2-2 / DOSIMETRY POST RZB-04`) (`localX = -0.44, y = 1.98`) */}
        <group position={[-0.44, 1.98, 0.072]}>
          {/* 4 Bolted Corner Lugs */}
          {([-0.2, 0.2] as const).map((lx) =>
            ([-0.23, 0.23] as const).map((ly) => (
              <mesh key={`uim-lug-${lx}-${ly}`} position={[lx, ly, -0.062]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.045, 0.045, 0.022]} />
              </mesh>
            )),
          )}
          {/* Sage-Green Steel Chassis (`0.44 × 0.50 × 0.14`) */}
          <mesh material={propMats.sageDosimetry} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.44, 0.5, 0.14]} />
          </mesh>
          {/* Recessed Beveled Faceplate */}
          <mesh position={[0, 0, 0.074]} material={propMats.smDarkDeck} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.39, 0.44, 0.014]} />
          </mesh>
          {/* Brass `UIM2-2 // DOSIMETRY POST` Header Plaque (`0.013m` proud) */}
          <mesh position={[0, 0.165, 0.094]} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.34, 0.085]} />
            <meshStandardMaterial
              map={dosimetryPlateTex}
              roughness={0.48}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
          {/* Circular Analog `MR/H` Dial Gauge */}
          <mesh position={[-0.075, 0.02, 0.084]} rotation={[Math.PI / 2, 0, 0]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.088, 0.092, 0.02, 16]} />
          </mesh>
          <mesh position={[-0.075, 0.02, 0.098]} castShadow={false} raycast={NOOP_RAYCAST}>
            <circleGeometry args={[0.078, 16]} />
            <meshStandardMaterial
              map={dosimetryDialTex}
              roughness={0.48}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
          {/* Green (`NORM`) & Red (`ALARM`) Threshold Lamps */}
          <mesh position={[0.1, 0.065, 0.086]} castShadow={false} raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshStandardMaterial color="#33ff66" emissive="#33ff66" emissiveIntensity={1.15} />
          </mesh>
          <mesh position={[0.1, -0.005, 0.086]} castShadow={false} raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshStandardMaterial color="#6e1414" emissive="#ff2a2a" emissiveIntensity={0.25} />
          </mesh>
          {/* 3 Toggle Switches & Rotary Range Knob */}
          {([-0.12, -0.04, 0.04] as const).map((tx, tIdx) => (
            <mesh
              key={`uim-tog-${tIdx}`}
              position={[tx, -0.145, 0.09]}
              rotation={[0.45, 0, 0]}
              material={propMats.smSilverRoller}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.005, 0.007, 0.032, 6]} />
            </mesh>
          ))}
          <mesh position={[0.12, -0.145, 0.09]} rotation={[Math.PI / 2, 0, 0]} material={propMats.bakeliteDark} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.024, 0.028, 0.024, 10]} />
          </mesh>
          {/* Bottom Brass Cord Gland + Coiled Black Cord + Holstered Cylindrical Geiger-Müller Probe Wand */}
          <mesh position={[-0.04, -0.26, 0.03]} geometry={propGeos.brassGland} material={propMats.smBrass} castShadow={false} raycast={NOOP_RAYCAST} />
          <mesh geometry={propGeos.probeCord} material={propMats.cableBlack} castShadow={false} raycast={NOOP_RAYCAST} />
          {/* Spring Holster Clip & Probe Wand on Right Cheek */}
          <mesh position={[0.238, 0.01, 0.02]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.036, 0.055, 0.042]} />
          </mesh>
          <group position={[0.254, -0.04, 0.028]}>
            <mesh material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.018, 0.018, 0.24, 10]} />
            </mesh>
            <mesh position={[0, -0.145, 0]} material={propMats.bakeliteDark} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.02, 0.016, 0.11, 10]} />
            </mesh>
          </group>
        </group>

        {/* C. Loud-Speaking Dispatch Intercom (`GGS`) & Bakelite Wall Phone (`TA-68`) (`localX = +0.26, y = 1.98`) */}
        <group position={[0.05, 1.98, 0.064]}>
          {/* `GGS` Cast Olive-Grey Dispatch Speaker Console (`0.30 × 0.44 × 0.12`) */}
          <mesh material={propMats.junctionBody} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.3, 0.44, 0.12]} />
          </mesh>
          <mesh position={[0, 0.155, 0.074]} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.26, 0.085]} />
            <meshStandardMaterial
              map={intercomPlateTex}
              roughness={0.48}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
          {/* Perforated Metal Speaker Grille */}
          <mesh position={[0, 0.03, 0.074]} castShadow={false} raycast={NOOP_RAYCAST}>
            <circleGeometry args={[0.082, 16]} />
            <meshStandardMaterial
              map={speakerGrilleTex}
              roughness={0.55}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
          {/* 6 Chunky Push-to-Talk Channel Keys + Volume Knob */}
          {([-0.08, -0.02, 0.04] as const).map((kx, kIdx) =>
            ([-0.095, -0.155] as const).map((ky, rIdx) => (
              <mesh
                key={`ggs-key-${kIdx}-${rIdx}`}
                position={[kx, ky, 0.068]}
                material={kIdx === 2 && rIdx === 1 ? propMats.fireRed : propMats.bakeliteDark}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <boxGeometry args={[0.044, 0.036, 0.02]} />
              </mesh>
            )),
          )}
          <mesh position={[0.1, -0.125, 0.072]} rotation={[Math.PI / 2, 0, 0]} material={propMats.smBrass} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.018, 0.02, 0.024, 10]} />
          </mesh>
        </group>

        {/* `TA-68` Sculpted Dark-Bakelite Wall Telephone (`localX = +0.36, y = 1.98`) */}
        <group position={[0.36, 1.98, 0.056]}>
          <mesh material={propMats.bakeliteDark} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.21, 0.28, 0.1]} />
          </mesh>
          {/* Angled Rotary Finger-Wheel Dial */}
          <mesh position={[0, -0.03, 0.058]} rotation={[Math.PI / 2 - 0.15, 0, 0]} material={propMats.smGunmetal} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.068, 0.074, 0.022, 16]} />
          </mesh>
          <mesh position={[0, -0.028, 0.072]} rotation={[-0.15, 0, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
            <circleGeometry args={[0.06, 16]} />
            <meshStandardMaterial
              map={rotaryDialTex}
              roughness={0.44}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
          {/* Twin Chrome Cradle Forks + Heavy 3D Bakelite Handset + Coiled Cord */}
          {([-0.052, 0.052] as const).map((fx, fIdx) => (
            <mesh key={`ta68-fork-${fIdx}`} position={[fx, 0.11, 0.065]} material={propMats.smSilverRoller} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.016, 0.036, 0.045]} />
            </mesh>
          ))}
          <group position={[0, 0.125, 0.085]}>
            <mesh rotation={[0, 0, Math.PI / 2]} material={propMats.bakeliteDark} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.032, 0.24, 0.028]} />
            </mesh>
            {([-0.095, 0.095] as const).map((cx, cIdx) => (
              <mesh
                key={`ta68-cup-${cIdx}`}
                position={[cx, 0, -0.018]}
                rotation={[Math.PI / 2, 0, 0]}
                material={propMats.bakeliteDark}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.036, 0.042, 0.034, 12]} />
              </mesh>
            ))}
          </group>
          <mesh geometry={propGeos.phoneCord} material={propMats.cableBlack} castShadow={false} raycast={NOOP_RAYCAST} />
        </group>

        {/* D. Lower-Wall Shallow Civil Defense PPE Cabinet (`CIVIL DEF.`, `localX = -0.36, y = 0..1.38m`) */}
        {renderPpeCabinet({
          key: "ppe-right-corner",
          pos: [-0.36, 0, 0.145],
          rotY: 0,
          width: 0.72,
          height: 1.38,
          depth: 0.2,
          hasLegs: true,
        })}
      </group>

      {/* 8. Compact Wall-Mounted Civil Defense / First-Aid & Dosimetry Locker on Left-Rear Lower Wall (`[-5.88, 0.82, 3.74]`) */}
      {renderPpeCabinet({
        key: "ppe-left-rear",
        pos: [-5.875, 0.48, 3.74],
        rotY: Math.PI / 2,
        width: 0.56,
        height: 0.76,
        depth: 0.16,
        hasLegs: false,
      })}
    </group>
  );
});

export const ControlRoomScene: React.FC = React.memo(() => {
  const bunkerArchRef = useRef<THREE.Group>(null);
  const leftBayA2WrapRef = useRef<THREE.Group>(null);
  const reactorWrapRef = useRef<THREE.Group>(null);
  const rightBayBWrapRef = useRef<THREE.Group>(null);
  const inspectorWrapRef = useRef<THREE.Group>(null);

  const linoleumFloorTex = useMemo(() => {
    const tex = createNearestCanvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = "#5c3424";
      ctx.fillRect(0, 0, w, h);
      const half = w / 2;
      // Warm Soviet terracotta-ochre tiles
      ctx.fillStyle = "#8e4830";
      ctx.fillRect(0, 0, half, half);
      ctx.fillRect(half, half, half, half);
      // Desaturated slate-green tiles
      ctx.fillStyle = "#35403f";
      ctx.fillRect(half, 0, half, half);
      ctx.fillRect(0, half, half, half);
      // Subtle inner tile bevels & terrazzo mineral flecks
      ctx.fillStyle = "#7c3d28";
      ctx.fillRect(4, 4, half - 8, half - 8);
      ctx.fillRect(half + 4, half + 4, half - 8, half - 8);
      ctx.fillStyle = "#2c3635";
      ctx.fillRect(half + 4, 4, half - 8, half - 8);
      ctx.fillRect(4, half + 4, half - 8, half - 8);
      for (let i = 0; i < 44; i++) {
        const fx = ((i * 37 + 11) % (w - 4)) + 2;
        const fy = ((i * 53 + 19) % (h - 4)) + 2;
        ctx.fillStyle = i % 3 === 0 ? "#c89668" : "#1c201e";
        ctx.fillRect(fx, fy, 2, 2);
      }
      ctx.strokeStyle = "#1b1e1c";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(half, 0);
      ctx.lineTo(half, h);
      ctx.moveTo(0, half);
      ctx.lineTo(w, half);
      ctx.stroke();
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(12, 9);
    return tex;
  }, []);

  const trenchDefs = useMemo(
    () => [
      { pos: [-3.62, 0.008, -1.62] as const, rotY: (15 * Math.PI) / 180, args: [3.34, 0.008, 0.44] as const },
      { pos: [4.29, 0.008, -1.42] as const, rotY: -(18 * Math.PI) / 180, args: [1.86, 0.008, 0.46] as const },
      { pos: [-2.55, 0.008, -2.62] as const, rotY: 0, args: [0.46, 0.008, 1.32] as const },
      { pos: [2.75, 0.008, -2.6] as const, rotY: 0, args: [0.46, 0.008, 1.36] as const },
      { pos: [0, 0.008, -3.52] as const, rotY: 0, args: [9.8, 0.008, 0.44] as const },
      { pos: [-4.82, 0.008, 1.42] as const, rotY: 0, args: [0.44, 0.008, 3.5] as const },
      { pos: [0, 0.008, 1.8] as const, rotY: 0, args: [2.85, 0.008, 1.45] as const },
    ],
    [],
  );

  const trenchGrateTextures = useMemo(
    () =>
      trenchDefs.map((plate) => {
        // Tile at ~0.24m per 128px square so every grate bar & slot is >= 0.048m wide in world space (zero sub-pixel moiré at dpr=1)
        const tex = createNearestCanvasTexture(128, 128, (ctx, w, h) => {
          ctx.fillStyle = "#3a423e";
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = "#262c2a";
          ctx.lineWidth = 8;
          ctx.strokeRect(4, 4, w - 8, h - 8);
          ctx.fillStyle = "#161b19";
          for (let sx = 16; sx < 112; sx += 56) {
            ctx.fillRect(sx, 16, 28, h - 32);
          }
          ctx.fillStyle = "#48524d";
          ctx.fillRect(10, Math.floor(h * 0.5) - 12, w - 20, 24);
        });
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(
          Math.max(1, Math.round(plate.args[0] / 0.24)),
          Math.max(1, Math.round(plate.args[2] / 0.24)),
        );
        return tex;
      }),
    [trenchDefs],
  );

  const rubberMatTex = useMemo(() => {
    const tex = createNearestCanvasTexture(128, 64, (ctx, w, h) => {
      ctx.fillStyle = "#141615";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#d99b16";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = "#212523";
      for (let y = 10; y < h - 10; y += 14) {
        ctx.fillRect(6, y, w - 12, 7);
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    return tex;
  }, []);

  const wainscotWallTex = useMemo(() => {
    const tex = createNearestCanvasTexture(128, 64, (ctx, w, h) => {
      ctx.fillStyle = "#34493e";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#24342c";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
      ctx.fillStyle = "#486153";
      for (const rx of [6, w - 6]) {
        for (let ry = 8; ry < h; ry += 16) {
          ctx.fillRect(rx - 1, ry - 1, 2, 2);
        }
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 2);
    return tex;
  }, []);

  const acousticWallTex = useMemo(() => {
    const tex = createNearestCanvasTexture(64, 64, (ctx, w, h) => {
      ctx.fillStyle = "#767c74";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#5c625b";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
      ctx.fillStyle = "#4c524e";
      for (let x = 8; x < w - 4; x += 8) {
        for (let y = 8; y < h - 4; y += 8) {
          ctx.fillRect(x, y, 2, 2);
        }
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 4);
    return tex;
  }, []);

  const pillarHazardTex = useMemo(() => createHazardStripeTexture(256, 64, 24), []);
  const walkwayHazardTex = useMemo(() => {
    const tex = createHazardStripeTexture(256, 32, 16);
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(8, 1);
    return tex;
  }, []);

  const pillarWarningPlaqueTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = "#ffb000";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#141414";
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        // Radiation trefoil triangle
        ctx.fillStyle = "#141414";
        ctx.beginPath();
        ctx.moveTo(w / 2, 18);
        ctx.lineTo(w - 22, 78);
        ctx.lineTo(22, 78);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffb000";
        ctx.beginPath();
        ctx.arc(w / 2, 56, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#141414";
        ctx.beginPath();
        ctx.arc(w / 2, 56, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#c81919";
        ctx.font = 'bold 15px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("ZONE RBMK-4", w / 2, 108, w - 16);
      }),
    [],
  );

  useEffect(() => {
    applySovietPBRToHierarchy(bunkerArchRef.current);

    for (const grp of [
      bunkerArchRef.current,
      leftBayA2WrapRef.current,
      reactorWrapRef.current,
      rightBayBWrapRef.current,
    ]) {
      grp?.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = false;
          obj.receiveShadow = false;
        }
      });
    }

    // Hide any stray hovering plaque/badge/bezel (console bay straggler) outside console cabinet surfaces
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    const worldCenter = new THREE.Vector3();
    const localCenter = new THREE.Vector3();
    const invBay = new THREE.Matrix4();
    for (const bayRoot of [
      leftBayA2WrapRef.current,
      reactorWrapRef.current,
      rightBayBWrapRef.current,
    ]) {
      if (!bayRoot) continue;
      bayRoot.updateWorldMatrix(true, true);
      invBay.copy(bayRoot.matrixWorld).invert();
      bayRoot.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh) || !obj.visible) return;
        box.setFromObject(obj);
        if (box.isEmpty()) return;
        box.getSize(size);
        box.getCenter(worldCenter);
        localCenter.copy(worldCenter).applyMatrix4(invBay);
        const isSmallFlatPlaque =
          Math.max(size.x, size.y, size.z) < 0.85 &&
          Math.min(size.x, size.y, size.z) < 0.12;
        if (
          isSmallFlatPlaque &&
          (worldCenter.y > 2.25 ||
            (localCenter.y > 1.32 && localCenter.z > 0.3) ||
            localCenter.z > 0.56 ||
            Math.abs(localCenter.x) > 1.14)
        ) {
          obj.visible = false;
          obj.raycast = NOOP_RAYCAST;
        }
      });
    }
  }, []);

  const hallPillars = [
    { pos: [-5.86, -4.36] as const, plaqueNormal: null },
    { pos: [5.86, -4.36] as const, plaqueNormal: null },
    { pos: [-5.86, 4.36] as const, plaqueNormal: null },
    { pos: [5.86, 4.36] as const, plaqueNormal: null },
    { pos: [-2.4, -4.38] as const, plaqueNormal: null },
    { pos: [2.4, -4.38] as const, plaqueNormal: null },
    { pos: [-2.4, 4.38] as const, plaqueNormal: [0, -1, Math.PI] as const },
    { pos: [1.46, 4.38] as const, plaqueNormal: [0, -1, Math.PI] as const },
    { pos: [-5.88, -1.6] as const, plaqueNormal: [1, 0, Math.PI / 2] as const },
    { pos: [-5.88, 1.6] as const, plaqueNormal: null },
    { pos: [5.88, -1.92] as const, plaqueNormal: [-1, 0, -Math.PI / 2] as const },
    { pos: [5.88, 2.32] as const, plaqueNormal: [-1, 0, -Math.PI / 2] as const },
  ] as const;

  return (
    <>
      <color attach="background" args={["#0a0f0d"]} />
      <fog attach="fog" args={["#0d1411", 13.5, 29.0]} />

      <CameraController />
      <BuckshotDitherPass />
      <DynamicBunkerLighting />
      <BunkerTelemetryAndControlRail3D />

      {/* ============================================================
          SOVIET RBMK-1000 MCR HALL ARCHITECTURE (`12.0m × 9.0m × 4.2m`)
         ============================================================ */}
      <group ref={bunkerArchRef}>
        {/* Subfloor (`top y = -0.035`), Checkered Linoleum Floor (`y = 0`), Cable Trenches (`top y = 0.012`), Rubber Mats (`top y = 0.012`) & Hazard Borders (`y = 0.016`) */}
        <mesh
          position={[0, -0.055, 0]}
          raycast={NOOP_RAYCAST}
        >
          <boxGeometry args={[HALL_HALF_W * 2 + 0.8, 0.04, HALL_HALF_D * 2 + 0.8]} />
          <meshStandardMaterial color="#181b19" roughness={0.94} metalness={0.14} />
        </mesh>

        <mesh
          position={[0, 0, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={NOOP_RAYCAST}
        >
          <planeGeometry args={[HALL_HALF_W * 2, HALL_HALF_D * 2]} />
          <meshStandardMaterial
            map={linoleumFloorTex}
            color="#ded8ce"
            roughness={0.72}
            metalness={0.14}
          />
        </mesh>

        {/* Matte Coarse-Bar Steel Cable Trench Grates (`top y = 0.012`) Along Console Bases & To Synoptic Wall */}
        {trenchDefs.map((plate, pIdx) => (
          <mesh
            key={`cable-trench-${pIdx}`}
            position={[plate.pos[0], plate.pos[1], plate.pos[2]]}
            rotation={[0, plate.rotY, 0]}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[plate.args[0], plate.args[1], plate.args[2]]} />
            <meshStandardMaterial
              map={trenchGrateTextures[pIdx]}
              color="#7a8580"
              metalness={0.18}
              roughness={0.88}
            />
          </mesh>
        ))}

        {/* Black Ribbed Rubber Anti-Static Operator Walkway Mats (`top y = 0.012`) & Yellow Hazard Walkway Borders (`y = 0.016`) */}
        {[
          { pos: [-3.28, 0.008, -0.34] as const, rotY: (15 * Math.PI) / 180, args: [3.26, 0.008, 0.8] as const },
          { pos: [3.84, 0.008, -0.03] as const, rotY: -(18 * Math.PI) / 180, args: [1.88, 0.008, 0.84] as const },
          { pos: [-4.22, 0.008, 1.42] as const, rotY: Math.PI / 2, args: [2.2, 0.008, 0.68] as const },
        ].map((mat, mIdx) => (
          <group
            key={`anti-static-mat-${mIdx}`}
            position={[mat.pos[0], 0, mat.pos[2]]}
            rotation={[0, mat.rotY, 0]}
          >
            <mesh position={[0, mat.pos[1], 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[mat.args[0], mat.args[1], mat.args[2]]} />
              <meshStandardMaterial map={rubberMatTex} roughness={0.88} metalness={0.08} />
            </mesh>
            <mesh
              position={[0, 0.016, mat.args[2] / 2 + 0.045]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
            >
              <planeGeometry args={[mat.args[0], 0.07]} />
              <meshStandardMaterial
                map={walkwayHazardTex}
                roughness={0.58}
                metalness={0.08}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
          </group>
        ))}

        {/* Front Wall (`z = -4.5`) & Left Wall (`x = -6.0`, `UNIT C`) — Two-Tone Olive Wainscot + Dual Rail + Putty Acoustic Upper */}
        {(
          [
            { pos: [0, 0, -HALL_HALF_D] as const, rotY: 0, span: HALL_HALF_W * 2 },
            { pos: [-HALL_HALF_W, 0, 0] as const, rotY: Math.PI / 2, span: HALL_HALF_D * 2 },
          ] as const
        ).map((w, idx) => (
          <group key={`hall-wall-${idx}`} position={[w.pos[0], 0, w.pos[2]]} rotation={[0, w.rotY, 0]}>
            {/* Lower Muted Soviet Olive/Sage-Green Steel Wainscot (`y = 0..1.55m`) */}
            <mesh position={[0, 0.775, -0.06]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[w.span, 1.55, 0.14]} />
              <meshStandardMaterial
                map={wainscotWallTex}
                color="#4d6658"
                roughness={0.72}
                metalness={0.28}
              />
            </mesh>
            {/* Dark Steel Skirting (`y = 0.004..0.16m`) */}
            <mesh position={[0, 0.082, 0.025]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[idx === 1 ? w.span - 0.1 : w.span, 0.156, 0.04]} />
              <meshStandardMaterial color="#1f2824" roughness={0.56} metalness={0.52} />
            </mesh>
            {/* Dual Brushed Aluminum & Dark-Brass Dado Trim Rail (`y = 1.55m`) */}
            <mesh position={[0, 1.535, 0.022]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[idx === 1 ? w.span - 0.1 : w.span, 0.024, 0.042]} />
              <meshStandardMaterial color="#b8a46b" roughness={0.34} metalness={0.82} />
            </mesh>
            <mesh position={[0, 1.565, 0.024]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[idx === 1 ? w.span - 0.1 : w.span, 0.034, 0.048]} />
              <meshStandardMaterial color="#9aa49e" roughness={0.36} metalness={0.78} />
            </mesh>
            {/* Upper Desaturated Putty / Cream-Grey Acoustic Perforated Panels (`y = 1.58..4.20m`) */}
            <mesh position={[0, 2.89, -0.06]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[w.span, 2.62, 0.14]} />
              <meshStandardMaterial
                map={acousticWallTex}
                color="#d8ddd6"
                roughness={0.84}
                metalness={0.12}
              />
            </mesh>
          </group>
        ))}

        {/* Right Wall (`x = +6.0`, `rotY = -Math.PI / 2`) Framed Around Window 1 (`worldZ = -1.70..+2.10`, `y = 1.05..2.85`) */}
        <group position={[HALL_HALF_W, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          {/* Continuous Floor Skirting (`8.90m` clear of corners, `y = 0.004..0.16m`) */}
          <mesh position={[0, 0.082, 0.025]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[HALL_HALF_D * 2 - 0.1, 0.156, 0.04]} />
            <meshStandardMaterial color="#1f2824" roughness={0.56} metalness={0.52} />
          </mesh>
          {/* Full-Height Flanks (`lx = -4.50..-1.70` & `lx = +2.10..+4.50`) */}
          {(
            [
              { cx: -3.1, w: 2.8 },
              { cx: 3.3, w: 2.4 },
            ] as const
          ).map((flank, fIdx) => (
            <group key={`right-flank-${fIdx}`} position={[flank.cx, 0, 0]}>
              <mesh position={[0, 0.775, -0.06]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[flank.w, 1.55, 0.14]} />
                <meshStandardMaterial map={wainscotWallTex} color="#4d6658" roughness={0.72} metalness={0.28} />
              </mesh>
              <mesh position={[fIdx === 0 ? -0.03 : 0.03, 1.535, 0.022]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[flank.w - 0.06, 0.024, 0.042]} />
                <meshStandardMaterial color="#b8a46b" roughness={0.34} metalness={0.82} />
              </mesh>
              <mesh position={[fIdx === 0 ? -0.03 : 0.03, 1.565, 0.024]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[flank.w - 0.06, 0.034, 0.048]} />
                <meshStandardMaterial color="#9aa49e" roughness={0.36} metalness={0.78} />
              </mesh>
              <mesh position={[0, 2.89, -0.06]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[flank.w, 2.62, 0.14]} />
                <meshStandardMaterial map={acousticWallTex} color="#d8ddd6" roughness={0.84} metalness={0.12} />
              </mesh>
            </group>
          ))}
          {/* Window 1 Lower Sill Wall (`y = 0..1.05m`, `width = 3.80m`, `center lx = +0.20`) */}
          <mesh position={[0.2, 0.525, -0.06]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[3.8, 1.05, 0.14]} />
            <meshStandardMaterial map={wainscotWallTex} color="#4d6658" roughness={0.72} metalness={0.28} />
          </mesh>
          {/* Window 1 Upper Lintel Wall (`y = 2.85..4.20m`, `width = 3.80m`, `center lx = +0.20`) */}
          <mesh position={[0.2, 3.525, -0.06]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[3.8, 1.35, 0.14]} />
            <meshStandardMaterial map={acousticWallTex} color="#d8ddd6" roughness={0.84} metalness={0.12} />
          </mesh>
        </group>

        {/* Rear Wall (`z = +4.5`, `rotY = Math.PI`) Framed Around `EXIT` Doorway (`worldX = -0.84..+0.84, y = 0..2.38`) & Window 2 (`worldX = +1.70..+5.30, y = 1.05..2.85`) */}
        <group position={[0, 0, HALL_HALF_D]} rotation={[0, Math.PI, 0]}>
          {/* Split Floor Skirting Around `EXIT` Doorway (`worldX = -6.0..-0.84` & `+0.84..+6.0`) */}
          {(
            [
              { cx: 3.42, w: 5.16 },
              { cx: -3.42, w: 5.16 },
            ] as const
          ).map((sk, sIdx) => (
            <mesh key={`rear-skirt-${sIdx}`} position={[sk.cx, 0.082, 0.025]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[sk.w, 0.156, 0.04]} />
              <meshStandardMaterial color="#1f2824" roughness={0.56} metalness={0.52} />
            </mesh>
          ))}
          {/* Full-Height Flanks (`worldX = -6.0..-0.84`, `+0.84..+1.70`, `+5.30..+6.0`), Depth 0.07 Leaving `0.16m` Pocket Behind (`worldZ = 4.56..4.72`) */}
          {(
            [
              { cx: 3.42, w: 5.16, trimL: 0, trimR: 0.03 },
              { cx: -1.27, w: 0.86, trimL: 0, trimR: 0 },
              { cx: -5.65, w: 0.7, trimL: 0.03, trimR: 0 },
            ] as const
          ).map((flank, fIdx) => (
            <group key={`rear-flank-${fIdx}`} position={[flank.cx, 0, 0]}>
              <mesh position={[0, 0.775, -0.025]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[flank.w, 1.55, 0.07]} />
                <meshStandardMaterial map={wainscotWallTex} color="#4d6658" roughness={0.72} metalness={0.28} />
              </mesh>
              <mesh position={[(flank.trimR - flank.trimL) * 0.5, 1.535, 0.022]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[flank.w - flank.trimL - flank.trimR, 0.024, 0.042]} />
                <meshStandardMaterial color="#b8a46b" roughness={0.34} metalness={0.82} />
              </mesh>
              <mesh position={[(flank.trimR - flank.trimL) * 0.5, 1.565, 0.024]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[flank.w - flank.trimL - flank.trimR, 0.034, 0.048]} />
                <meshStandardMaterial color="#9aa49e" roughness={0.36} metalness={0.78} />
              </mesh>
              <mesh position={[0, 2.89, -0.025]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[flank.w, 2.62, 0.07]} />
                <meshStandardMaterial map={acousticWallTex} color="#d8ddd6" roughness={0.84} metalness={0.12} />
              </mesh>
            </group>
          ))}
          {/* `EXIT` Doorway Upper Lintel (`worldX = -0.84..+0.84`, `y = 2.38..4.20m`) */}
          <mesh position={[0, 3.29, -0.025]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.68, 1.82, 0.07]} />
            <meshStandardMaterial map={acousticWallTex} color="#d8ddd6" roughness={0.84} metalness={0.12} />
          </mesh>
          {/* Window 2 Lower Sill Wall (`y = 0..1.05m`, `width = 3.60m`, `center lx = -3.50` -> `worldX = +3.50`) */}
          <mesh position={[-3.5, 0.525, -0.06]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[3.6, 1.05, 0.14]} />
            <meshStandardMaterial map={wainscotWallTex} color="#4d6658" roughness={0.72} metalness={0.28} />
          </mesh>
          {/* Window 2 Upper Lintel Wall (`y = 2.85..4.20m`, `width = 3.60m`, `center lx = -3.50` -> `worldX = +3.50`) */}
          <mesh position={[-3.5, 3.525, -0.06]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[3.6, 1.35, 0.14]} />
            <meshStandardMaterial map={acousticWallTex} color="#d8ddd6" roughness={0.84} metalness={0.12} />
          </mesh>
        </group>

        {/* Heavy Ribbed Concrete Columns with Safety-Ochre / Red Hazard Bands & Radiation Placards */}
        {hallPillars.map((pil, idx) => (
          <group key={`hall-pillar-${idx}`} position={[pil.pos[0], 0, pil.pos[1]]}>
            {/* Ribbed Concrete Pillar Core */}
            <mesh position={[0, HALL_CEILING_Y * 0.5, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.3, HALL_CEILING_Y, 0.3]} />
              <meshStandardMaterial color="#5c605a" metalness={0.18} roughness={0.82} />
            </mesh>
            {/* Vertical Corner Fluting Ribs */}
            {(
              [
                [-0.14, -0.14],
                [0.14, -0.14],
                [-0.14, 0.14],
                [0.14, 0.14],
              ] as const
            ).map(([rx, rz], rIdx) => (
              <mesh key={`pil-rib-${rIdx}`} position={[rx, HALL_CEILING_Y * 0.5, rz]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.045, HALL_CEILING_Y, 0.045]} />
                <meshStandardMaterial color="#3c423e" metalness={0.42} roughness={0.6} />
              </mesh>
            ))}
            {/* Steel Base Boot (`y = 0.004..0.28m`, `0.376m` proud of `0.325m` corner fluting) */}
            <mesh position={[0, 0.142, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.376, 0.276, 0.376]} />
              <meshStandardMaterial color="#1f2623" metalness={0.62} roughness={0.5} />
            </mesh>
            {/* Safety-Ochre Hazard Band & Crimson Red Stripe (`y = 1.11..1.47m`, proud of fluting) */}
            <mesh position={[0, 1.22, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.362, 0.22, 0.362]} />
              <meshStandardMaterial
                map={pillarHazardTex}
                roughness={0.52}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
            <mesh position={[0, 1.41, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.358, 0.12, 0.358]} />
              <meshStandardMaterial color="#c8221c" roughness={0.48} metalness={0.22} />
            </mesh>
            {/* Bolted Steel-Backed Radiation Warning Placard Facing Control Room Hall (`>=0.015m` proud of fluting) */}
            {pil.plaqueNormal && (
              <group
                position={[pil.plaqueNormal[0] * 0.186, 1.72, pil.plaqueNormal[1] * 0.186]}
                rotation={[0, pil.plaqueNormal[2], 0]}
              >
                <mesh castShadow={false} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.22, 0.22, 0.016]} />
                  <meshStandardMaterial color="#181f1c" metalness={0.65} roughness={0.48} />
                </mesh>
                <mesh position={[0, 0, 0.024]} castShadow={false} raycast={NOOP_RAYCAST}>
                  <planeGeometry args={[0.2, 0.2]} />
                  <meshStandardMaterial
                    map={pillarWarningPlaqueTex}
                    roughness={0.45}
                    polygonOffset
                    polygonOffsetFactor={-2}
                    polygonOffsetUnits={-2}
                  />
                </mesh>
              </group>
            )}
          </group>
        ))}

        {/* Overhead Ceiling Slab (`y = 4.19m`) & U-Channel Steel Cable Trays With Bundled Cables & Drop Hangers */}
        <mesh
          position={[0, HALL_CEILING_Y - 0.01, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          raycast={NOOP_RAYCAST}
        >
          <planeGeometry args={[HALL_HALF_W * 2, HALL_HALF_D * 2]} />
          <meshStandardMaterial color="#2a312e" roughness={0.86} metalness={0.24} />
        </mesh>

        {([-4.8, 4.8] as const).map((xTray, idx) => (
          <group key={`overhead-tray-x-${idx}`} position={[xTray, 3.82, 0.52]}>
            <mesh castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.42, 0.018, 7.36]} />
              <meshStandardMaterial color="#34403b" metalness={0.68} roughness={0.46} />
            </mesh>
            {([-0.205, 0.205] as const).map((sx, sIdx) => (
              <mesh key={`tray-lip-${idx}-${sIdx}`} position={[sx, 0.026, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.014, 0.056, 7.36]} />
                <meshStandardMaterial color="#222a26" metalness={0.7} roughness={0.44} />
              </mesh>
            ))}
            {([-0.12, 0, 0.12] as const).map((cx, cIdx) => (
              <mesh
                key={`tray-cable-${idx}-${cIdx}`}
                position={[cx, 0.026, 0]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.018, 0.018, 7.2, 8]} />
                <meshStandardMaterial color="#141816" roughness={0.78} metalness={0.14} />
              </mesh>
            ))}
            {([-2.8, -0.9, 1.0, 2.9] as const).map((hz, hIdx) => (
              <group key={`tray-hanger-${idx}-${hIdx}`} position={[0, 0.18, hz]}>
                <mesh position={[-0.19, 0, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.008, 0.008, 0.38, 6]} />
                  <meshStandardMaterial color="#1f2623" metalness={0.7} roughness={0.44} />
                </mesh>
                <mesh position={[0.19, 0, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.008, 0.008, 0.38, 6]} />
                  <meshStandardMaterial color="#1f2623" metalness={0.7} roughness={0.44} />
                </mesh>
                <mesh position={[0, -0.19, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.44, 0.02, 0.032]} />
                  <meshStandardMaterial color="#1f2623" metalness={0.7} roughness={0.44} />
                </mesh>
              </group>
            ))}
          </group>
        ))}

        {/* Coffered Acoustic Ceiling & Glowing Warm-White Fluorescent Troffers */}
        <SovietRbmkCofferedCeiling3D />

        {/* Color-Coded Industrial Ceiling Piping, 3 Swivel Chairs, SM-2M Tape Cabinets & Fire-Shield */}
        <SovietIndustrialPipingAndProps3D />

        {/* Caged Industrial Tungsten Wall Bulkhead Lamps (`VZG-200`) on Visible Hall Columns */}
        <SovietWallPillarLamp3D position={[-5.73, 2.88, -1.6]} rotY={Math.PI / 2} />
        <SovietWallPillarLamp3D position={[5.73, 2.88, -1.92]} rotY={-Math.PI / 2} />
        <SovietWallPillarLamp3D position={[5.73, 2.88, 2.32]} rotY={-Math.PI / 2} />
        <SovietWallPillarLamp3D position={[-2.4, 2.88, 4.23]} rotY={Math.PI} />
        <SovietWallPillarLamp3D position={[1.46, 2.88, 4.23]} rotY={Math.PI} />

        {/* Front Curved 3-Part Synoptic Wall & Side Instrument Cabinets */}
        <SovietRbmkFrontSynopticWall3D />

        {/* Rear Double Steel Entry Doors with Wired Glass & Signage (No Airlock Wheel Door) */}
        <SovietRearDoubleEntryDoors3D />

        {/* Left Wall Electrical Switchgear Cabinet Alcove Framing `UNIT C` */}
        <SovietLeftWallSwitchgearAlcove3D />

        {/* Continuous ~10.4m Sloped Operator Console Plinth (`SIUR / SIUB / SIUT`) */}
        <SovietRbmkOperatorConsolePlinth3D />

        {/* Supervisor Desk Pedestal Surround & Swivel Chair (Shift Chief Desk) */}
        <SovietSupervisorDeskSurroundAndChair3D />
      </group>

      {/* Panoramic Exterior Observation Windows & Forced-Perspective Dioramas */}
      <ExteriorDioramas3D />

      {/* Diegetic MCR-4 Soviet Elevator Anteroom & Concrete Exterior Wing Behind EXIT Airlock */}
      <McrLobbyRoom3D />

      {/* Exterior Brutalist Auxiliary Wing, Snowy Balcony & Caged Fire Escape Ladder */}
      <ExteriorFireEscapeWing3D />

      {/* Right-Window Duty Side Table & Vintage Soviet Radio (`OKEAN-84`) */}
      <SovietRadioTable3D />

      {/* K.O.M.R.A.D.-84 Panopticon Rig: GLaDOS Overhead Tracking Turret + 4 KGB-TV-84 Cameras */}
      <SovietPanopticonRig3D />

      {/* ============================================================
          ERGONOMIC INTERACTIVE STATIONS IN RBMK-1000 MCR HALL (Split Wing Consoles)
          - Front Synoptic Center: K.O.M.R.A.D.-84 Master CRT (`z = -3.96, y = 0.18, scale = 1.42`)
          - Operator Wing Left (`x = -3.54, z = -1.22, +15°`): UNIT A-2 (Core/Rods) & UNIT A (Cooling/MW)
          - Open Center Aisle (`x = -1.8..+1.8`): Clear unobstructed view of K.O.M.R.A.D.-84
          - Operator Wing Right (`x = +4.15, z = -0.98, -18°, single bay`): UNIT B (Coolant/Pumps)
          - Left Wall Switchgear (`x = -5.16, z = +1.42, +90°`): UNIT C (1000 MWh Battery & Aux Bus)
          - Central Supervisor Desk (`x = 0.0, z = +1.8`): InspectorDesk3D
         ============================================================ */}

      {/* LEFT DESK (`x = -3.54, z = -1.22, +15°` inward): UNIT A-2 (Core & Rods) + UNIT A (Cooling & MW Levers) */}
      <group position={[-3.54, 0, -1.22]} rotation={[0, (15 * Math.PI) / 180, 0]}>
        <group
          ref={leftBayA2WrapRef}
          position={[-0.78, 0.18, 0.08]}
          rotation={[-0.51, 0, 0]}
          scale={0.74}
        >
          <LeftRearWrapAroundPanel3D variant="left-rear" />
        </group>
        <group
          ref={reactorWrapRef}
          position={[0.73, 0.18, 0.08]}
          rotation={[-0.51, 0, 0]}
          scale={0.74}
        >
          <group rotation={[0, -0.42, 0]}>
            <group position={[2.15, 0, 1.08]}>
              <HighDetailReactorPanel3D />
            </group>
          </group>
        </group>
      </group>

      {/* RIGHT DESK SINGLE BAY (`x = +4.15, z = -0.98, -18°` inward): UNIT B (Drum Separators & Coolant Loop) */}
      <group position={[4.15, 0, -0.98]} rotation={[0, -(18 * Math.PI) / 180, 0]}>
        <group
          ref={rightBayBWrapRef}
          position={[0, 0.11, 0.12]}
          rotation={[-0.51, 0, 0]}
          scale={0.86}
        >
          <LeftRearWrapAroundPanel3D variant="rear" />
        </group>
      </group>

      {/* CENTER UPPER SYNOPTIC WALL (`z = -3.96, y = 0.28`): K.O.M.R.A.D.-84 Master 1024x640 SKALA CRT Screen */}
      <group
        position={TERMINAL_ROOT_POS}
        rotation={[TERMINAL_TILT_X, 0, 0]}
        scale={TERMINAL_SCALE}
      >
        <CentralSkalaScreen3D />
      </group>

      {/* SHIFT SUPERVISOR DESK (at `x = 0.0, z = +1.8`): <InspectorDesk3D /> */}
      <group ref={inspectorWrapRef} position={[0, 0, 2.76]}>
        {ExternalInspectorDesk3D ? (
          <ExternalInspectorDesk3D />
        ) : (
          <InspectorDesk3DPlaceholder />
        )}
      </group>
    </>
  );
});
