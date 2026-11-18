import { useGLTF } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import * as InspectorModule from "../modules/inspector";
import {
  getSkalaDiagFeedElement,
  getSkalaDiagFeedStartMs,
  isSkalaDiagFeedSyncing,
  playRheostatDetentClick,
  playSteamVentHiss,
  updateTurbinePitchHum,
} from "../modules/inspector/audio";
import { useDeskStore } from "../modules/inspector/useDeskStore";
import {
  playLeverRatchet,
  playSwitchClank,
} from "../modules/reactor/audioSynth";
import { TerminalStation3D } from "../modules/terminal";
import { BuckshotDitherPass } from "./BuckshotDitherPass";
import { CameraController, useCameraLookStore } from "./CameraController";
import { ExteriorDioramas3D, NOOP_RAYCAST } from "./ExteriorDioramas3D";
import {
  CagedSovietJewelLamp3D,
  HighDetailKnifeBreaker3D,
  HighDetailManometer3D,
  HighDetailReactorPanel3D,
  LeftRearWrapAroundPanel3D,
  type MimicNodeSpec,
  type MimicSegmentSpec,
  makePlaqueTex,
  SovietBacklitIndicatorBlock3D,
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
  getContextualDiagnosticHint,
  useGameStore,
} from "./useGameStore";

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
  return tex;
}

const SCENE_COLOR_BLACK = new THREE.Color("#000000");
const SCENE_COLOR_RED = new THREE.Color("#ff2a2a");
const SCENE_COLOR_GREEN = new THREE.Color("#33ff66");
const SCENE_COLOR_AMBER = new THREE.Color("#ffb000");
const SCENE_COLOR_ORANGE = new THREE.Color("#ff941a");
const SCENE_COLOR_OFF_DARK = new THREE.Color("#121a16");
const SCENE_COLOR_CLOCK_BLACKOUT = new THREE.Color("#2a1212");
const SCENE_COLOR_CLOCK_NORM = new THREE.Color("#ff3b24");
const SCENE_COLOR_LAMP_DARK = new THREE.Color("#1c2621");
const SCENE_COLOR_LAMP_AMBER_OFF = new THREE.Color("#ffaa22");
const SCENE_COLOR_LAMP_AMBER_EMISSIVE = new THREE.Color("#ff8800");
const SCENE_COLOR_SCONCE_BLACKOUT = new THREE.Color("#221210");
const SCENE_COLOR_SCONCE_BLACKOUT_EMISSIVE = new THREE.Color("#3a0b06");
const SCENE_COLOR_SCONCE_ALARM = new THREE.Color("#ff5c38");
const SCENE_COLOR_SCONCE_ALARM_EMISSIVE = new THREE.Color("#ff3018");
const SCENE_COLOR_SCONCE_NORM = new THREE.Color("#ffba52");
const SCENE_COLOR_SCONCE_NORM_EMISSIVE = new THREE.Color("#ff9922");
const SCENE_COLOR_BAT_DISCHARGE_OFF = new THREE.Color("#302210");
const SCENE_COLOR_BAT_DISCHARGE_IDLE = new THREE.Color("#3b2a14");
const SCENE_COLOR_BAT_DISCHARGE_IDLE_EM = new THREE.Color("#442808");
const SCENE_COLOR_BAT_SYNC_OFF = new THREE.Color("#122418");
const SCENE_COLOR_BAT_SYNC_IDLE = new THREE.Color("#183824");
const SCENE_COLOR_BAT_SYNC_IDLE_EM = new THREE.Color("#124422");
const SCENE_COLOR_MAIN_LIGHT_NORM = new THREE.Color("#ffe2ba");
const SCENE_COLOR_MAIN_LIGHT_BLACKOUT = new THREE.Color("#222422");
const SCENE_COLOR_TUBE_BLACKOUT = new THREE.Color("#1a1816");
const SCENE_COLOR_TUBE_ALARM = new THREE.Color("#ffd6b0");
const SCENE_COLOR_TUBE_NORM = new THREE.Color("#fff1d6");
const SCENE_COLOR_TUBE_DIM_BLACKOUT = new THREE.Color("#14100d");
const SCENE_COLOR_TUBE_DIM = new THREE.Color("#e2a24c");
const SCENE_COLOR_TUBE_FLICKER_BLACKOUT = new THREE.Color("#141210");

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

function drawHeavyCrtText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  colorHex: string,
  _strokePx = 0.8,
  maxWidth?: number,
): void {
  ctx.save();
  // Clean open-counter monospace font stack with wide letter spacing so A/B/D/P/R/O/8/5/S counters never blob shut
  ctx.font = ctx.font
    .replace(/^900\b/, "700")
    .replace(/"VT323"\s*,\s*/g, "");
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
    "1.6px";
  const isDarkText =
    colorHex === "#020804" ||
    colorHex === "#020a04" ||
    colorHex === "#041208" ||
    colorHex === "#141414";
  ctx.lineJoin = "round";
  if (!isDarkText) {
    ctx.strokeStyle = "#000802";
    ctx.lineWidth = 2.6;
    if (maxWidth !== undefined) {
      ctx.strokeText(text, x, y, maxWidth);
    } else {
      ctx.strokeText(text, x, y);
    }
  }
  ctx.fillStyle = colorHex;
  if (maxWidth !== undefined) {
    ctx.fillText(text, x, y, maxWidth);
  } else {
    ctx.fillText(text, x, y);
  }
  ctx.restore();
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
          <meshStandardMaterial map={printerPlateTex} />
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
        <mesh position={[0, 0, 0.019]}>
          <planeGeometry args={[0.44, 0.54]} />
          <meshStandardMaterial
            ref={manualMatRef}
            map={manualTexture}
            roughness={0.85}
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
        <mesh position={[0, 0, 0.005]}>
          <planeGeometry args={[0.47, 0.59]} />
          <meshStandardMaterial
            ref={paperMatRef}
            map={paperTexture}
            roughness={0.88}
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
          <meshStandardMaterial map={approveStampTex} roughness={0.7} />
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
          <meshStandardMaterial map={shredStampTex} roughness={0.7} />
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
 * Heavy Physical 3D Soviet Digital Shift Clock (`ЧАСЫ БЩУ // ЭЛЕКТРОНИКА-7`)
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

  const gostNameplateTex = useMemo(
    () =>
      createCrispPanelTexture(512, 64, (ctx, w, h) => {
        ctx.fillStyle = "#180b0b";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#ff4433";
        ctx.font = 'bold 21px "Kremlin", "Consolas", monospace';
        ctx.textAlign = "center";
        ctx.fillText("ЧАСЫ БЩУ 00:00 - 06:00 // ЭЛЕКТРОНИКА-7", w / 2, 40, w - 24);
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

    // Update physical status indicator lamp on clock bezel
    if (statusLampMatRef.current) {
      if (s.isBlackout) {
        statusLampMatRef.current.color.copy(SCENE_COLOR_CLOCK_BLACKOUT);
        statusLampMatRef.current.emissive.copy(SCENE_COLOR_RED);
        statusLampMatRef.current.emissiveIntensity =
          halfSecBucket % 2 === 0 ? 0.85 : 0.12;
      } else if (isEmergency || isFinalHour) {
        const pulse = 0.5 + 0.5 * Math.sin(now * 10.0);
        statusLampMatRef.current.color.copy(SCENE_COLOR_RED);
        statusLampMatRef.current.emissive.copy(SCENE_COLOR_RED);
        statusLampMatRef.current.emissiveIntensity = 1.15 + pulse * 1.45;
      } else {
        statusLampMatRef.current.color.copy(SCENE_COLOR_CLOCK_NORM);
        statusLampMatRef.current.emissive.copy(SCENE_COLOR_RED);
        statusLampMatRef.current.emissiveIntensity = 1.1;
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
      `ЧАСЫ БЩУ // SHIFT NO. ${s.shiftNumber}`,
      18,
      30,
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
      <mesh position={[-0.055, 0.008, 0.096]} raycast={NOOP_RAYCAST}>
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
        />
      </mesh>

      {/* Protective Ruby-Tinted Glass Viewport Pane Over Digits */}
      <mesh position={[-0.055, 0.008, 0.099]} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[0.945, 0.21]} />
        <meshStandardMaterial
          color="#2a0808"
          transparent
          opacity={0.14}
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

      {/* 5. Bottom Brass GOST Nameplate (`ЧАСЫ БЩУ 00:00 - 06:00`) */}
      <mesh position={[0, -0.118, 0.098]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.52, 0.036, 0.006]} />
        <meshStandardMaterial
          color="#b8a46b"
          metalness={0.86}
          roughness={0.26}
        />
      </mesh>
      <mesh position={[0, -0.118, 0.102]} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[0.506, 0.031]} />
        <meshStandardMaterial
          map={gostNameplateTex}
          emissive="#ffffff"
          emissiveMap={gostNameplateTex}
          emissiveIntensity={0.42}
          roughness={0.5}
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
 * Two-Wing Split Soviet RBMK-1000 Operator Console Plinth (`Левое и Правое Крыло Пульта БЩУ`)
 * Deliberately split into capped Left (`x=-3.22, z=-1.16, +15°`) and Right (`x=+3.22, z=-1.16, -15°`)
 * wings with solid dark-steel end-plates and an open center aisle facing `K.O.M.R.A.D.-84`.
 */
const SovietRbmkOperatorConsolePlinth3D: React.FC = React.memo(() => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  const kickGrateTex = useMemo(() => {
    const tex = createNearestCanvasTexture(256, 64, (ctx, w, h) => {
      ctx.fillStyle = "#171d1b";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#2b3531";
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = "#0b0e0d";
      for (let gx = 12; gx < w - 12; gx += 16) {
        ctx.fillRect(gx, 12, 8, h - 24);
      }
      ctx.fillStyle = "#8a928e";
      for (const bx of [8, w - 8]) {
        ctx.fillRect(bx - 2, 8, 4, 4);
        ctx.fillRect(bx - 2, h - 12, 4, 4);
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    return tex;
  }, []);

  const deskBays = [
    { key: "left", pos: [-3.22, 0, -1.16] as const, rotY: (15 * Math.PI) / 180, width: 3.34 },
    { key: "right", pos: [3.22, 0, -1.16] as const, rotY: -(15 * Math.PI) / 180, width: 3.34 },
  ] as const;

  return (
    <group>
      {/* 1. Two-Wing Split Soviet Sage-Green Console Desk Bays */}
      {deskBays.map((bay) => (
        <group key={bay.key} position={[bay.pos[0], bay.pos[1], bay.pos[2]]} rotation={[0, bay.rotY, 0]}>
          {/* Recessed Steel Kickplate & Bolted Cable-Trench Grate (`y = 0..0.15m`) */}
          <mesh position={[0, 0.075, -0.22]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[bay.width - 0.04, 0.15, 0.96]} />
            <meshStandardMaterial color="#141917" metalness={0.64} roughness={0.56} />
          </mesh>
          <mesh position={[0, 0.075, 0.264]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[bay.width - 0.16, 0.12]} />
            <meshStandardMaterial map={kickGrateTex} metalness={0.55} roughness={0.5} />
          </mesh>

          {/* Soviet Sage-Green Lower Cabinet Pedestal (`y = 0.15..0.54m`) */}
          <mesh position={[0, 0.345, -0.24]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[bay.width, 0.39, 1.02]} />
            <meshStandardMaterial
              color="#2f443e"
              metalness={0.44}
              roughness={0.54}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>

          {/* Sloped Steel Under-Shelf Knee Apron (`y = 0.50..0.57m`) */}
          <mesh position={[0, 0.548, -0.21]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[bay.width + 0.04, 0.044, 1.12]} />
            <meshStandardMaterial
              color="#22302b"
              metalness={0.62}
              roughness={0.44}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>

          {/* Continuous Dark Bakelite / Black Rubber Padded Wrist Bolster Along Front Lip */}
          <mesh position={[0, 0.574, 0.345]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[bay.width + 0.06, 0.038, 0.072]} />
            <meshStandardMaterial color="#141313" roughness={0.78} metalness={0.14} />
          </mesh>
          <mesh position={[0, 0.572, 0.376]} rotation={[0, 0, Math.PI / 2]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.019, 0.019, bay.width + 0.06, 12]} />
            <meshStandardMaterial color="#181616" roughness={0.74} metalness={0.16} />
          </mesh>

          {/* Brushed Steel Trim Bezel Behind Wrist Bolster */}
          <mesh position={[0, 0.573, 0.305]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[bay.width + 0.02, 0.014, 0.018]} />
            <meshStandardMaterial color="#7b8680" metalness={0.78} roughness={0.34} />
          </mesh>

          {/* Full-Width Rear Instrument Cabinet Spine (`y = 0.55..1.70m`, behind tilted panels) */}
          <mesh position={[0, 1.12, -0.84]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[bay.width, 1.14, 0.22]} />
            <meshStandardMaterial
              color="#2a3c36"
              metalness={0.48}
              roughness={0.54}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.007}
            />
          </mesh>

          {/* Solid Dark-Steel End-Plates Capping Both Inner (Aisle-Facing) & Outer Wing Ends */}
          {([-1, 1] as const).map((endSign) => {
            const endX = endSign * (bay.width / 2 + 0.028);
            return (
              <group key={`${bay.key}-endplate-${endSign}`}>
                {/* Lower vertical dark-steel pedestal end-plate */}
                <mesh position={[endX, 0.3, -0.288]} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.056, 0.59, 1.35]} />
                  <meshStandardMaterial
                    color="#1c2622"
                    metalness={0.62}
                    roughness={0.46}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.006}
                  />
                </mesh>
                {/* Upper rear vertical spine end-plate */}
                <mesh position={[endX, 1.14, -0.82]} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.056, 1.12, 0.28]} />
                  <meshStandardMaterial
                    color="#1c2622"
                    metalness={0.62}
                    roughness={0.46}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.006}
                  />
                </mesh>
                {/* Sloped upper console cheek end-plate (-0.51 rad tilt) */}
                <mesh
                  position={[endX, 1.06, -0.36]}
                  rotation={[-0.51, 0, 0]}
                  raycast={NOOP_RAYCAST}
                >
                  <boxGeometry args={[0.056, 1.24, 0.36]} />
                  <meshStandardMaterial
                    color="#202c28"
                    metalness={0.58}
                    roughness={0.48}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.006}
                  />
                </mesh>
                {/* Front edge flange strip & 4 brass hex fasteners */}
                <mesh
                  position={[endX + endSign * 0.03, 0.3, 0.365]}
                  raycast={NOOP_RAYCAST}
                >
                  <boxGeometry args={[0.012, 0.58, 0.04]} />
                  <meshStandardMaterial color="#141917" metalness={0.7} roughness={0.4} />
                </mesh>
                {([0.14, 0.46] as const).map((by) =>
                  ([0.22, -0.78] as const).map((bz) => (
                    <mesh
                      key={`${bay.key}-bolt-${endSign}-${by}-${bz}`}
                      position={[endX + endSign * 0.032, by, bz]}
                      rotation={[0, 0, Math.PI / 2]}
                      raycast={NOOP_RAYCAST}
                    >
                      <cylinderGeometry args={[0.009, 0.009, 0.01, 6]} />
                      <meshStandardMaterial color="#b8a46b" metalness={0.86} roughness={0.28} />
                    </mesh>
                  )),
                )}
              </group>
            );
          })}

          {/* Front Access Hatch Doors Under Console with Brass Latches */}
          {[-bay.width * 0.31, 0, bay.width * 0.31].map((dx, dIdx) => (
            <group key={`${bay.key}-hatch-${dIdx}`} position={[dx, 0.345, 0.275]}>
              <mesh raycast={NOOP_RAYCAST}>
                <boxGeometry args={[bay.width * 0.27, 0.3, 0.016]} />
                <meshStandardMaterial color="#253630" metalness={0.52} roughness={0.52} />
              </mesh>
              <mesh position={[bay.width * 0.1, 0, 0.012]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.024, 0.085, 0.016]} />
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
        </group>
      ))}
    </group>
  );
});

/**
 * Front Curved 3-Part RBMK-1000 Synoptic Wall (`Мнемосхема`, around `z = -3.86`, `x = -5.7..+5.7`):
 * - Center Upper Wall: Seafoam/sage-green cabinet framing the monumental `K.O.M.R.A.D.-84` master CRT bay,
 *   crowned by a glowing red Cyrillic header banner & red 7-segment `ЧАСЫ БЩУ` clock.
 * - Left Angled Wing (`x = -3.90, z = -3.62`): `1.70m` diameter circular green RBMK core channel mosaic
 *   (`Плато СФКРЭ`), 3 hood-illuminated `КСП-4` strip-chart recorders, and glowing `ТАБЛО СИГНАЛИЗАЦИИ`.
 * - Right Angled Wing (`x = +3.90, z = -3.62`): Symmetrical `1.70m × 1.64m` backlit Drum/Turbine Mimic Diagram,
 *   3 hood-illuminated `КСП-4` strip-chart recorders, and glowing `ТАБЛО АВАРИЙНОЙ ЗАЩИТЫ`.
 */
const SovietRbmkFrontSynopticWall3D: React.FC = React.memo(() => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  const alarmTileLeftMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const alarmTileRightMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const coreMosaicMatRef = useRef<THREE.MeshStandardMaterial>(null);

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
        ctx.font = 'bold 38px "Kremlin", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText(
          "БЩУ БЛОКА №4 РБМК-1000 // СИСТЕМА «СКАЛА»",
          w / 2,
          58,
          w - 48,
        );
        ctx.fillStyle = "#ffd166";
        ctx.font = 'bold 26px "VT323", monospace';
        ctx.fillText(
          "SECTOR 84 • PEOPLE'S AUTOMATED NUCLEAR POWER PLANT NO. 4",
          w / 2,
          102,
          w - 48,
        );
      }),
    [],
  );

  const coreMosaicTex = useMemo(
    () =>
      createNearestCanvasTexture(512, 512, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        ctx.fillStyle = "#102119";
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = "#5d7469";
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.arc(cx, cy, 236, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, 218, 0, Math.PI * 2);
        ctx.stroke();

        // 19x19 circular RBMK technological channel mosaic grid (`Плато СФКРЭ`)
        const step = 20;
        for (let gy = -9; gy <= 9; gy++) {
          for (let gx = -9; gx <= 9; gx++) {
            const dist = Math.hypot(gx, gy);
            if (dist > 9.3) continue;
            const px = cx + gx * step - 7;
            const py = cy + gy * step - 7;
            const hash = Math.abs(gx * 31 + gy * 17) % 19;
            ctx.fillStyle =
              hash === 0
                ? "#ff3b24"
                : hash < 4
                  ? "#ffb000"
                  : hash < 10
                    ? "#33ff66"
                    : "#207840";
            ctx.fillRect(px, py, 14, 14);
            ctx.strokeStyle = "#0a1610";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(px, py, 14, 14);
          }
        }

        ctx.fillStyle = "#0b1410";
        ctx.fillRect(cx - 144, h - 46, 288, 34);
        ctx.strokeStyle = "#5c7568";
        ctx.lineWidth = 3;
        ctx.strokeRect(cx - 144, h - 46, 288, 34);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 22px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("ПЛАТО СФКРЭ // 1661 КАНАЛ", cx, h - 22);
      }),
    [],
  );

  const turbineMimicTex = useMemo(
    () =>
      createNearestCanvasTexture(512, 512, (ctx, w, h) => {
        ctx.fillStyle = "#182822";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#5c7568";
        ctx.lineWidth = 8;
        ctx.strokeRect(6, 6, w - 12, h - 12);

        ctx.fillStyle = "#22362e";
        ctx.fillRect(14, 14, w - 28, 46);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 28px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("МНЕМОСХЕМА МПЦ & ТГ-7 / ТГ-8", w / 2, 46);

        // Twin Drum Separator Cylinders
        ctx.strokeStyle = "#48c2d6";
        ctx.lineWidth = 5;
        ctx.strokeRect(42, 92, 152, 62);
        ctx.strokeRect(318, 92, 152, 62);
        ctx.fillStyle = "#143c44";
        ctx.fillRect(46, 96, 144, 54);
        ctx.fillRect(322, 96, 144, 54);
        ctx.fillStyle = "#b8f4ff";
        ctx.font = 'bold 24px "VT323", monospace';
        ctx.fillText("БС-1 // 70 БАР", 118, 130);
        ctx.fillText("БС-2 // 70 БАР", 394, 130);

        // Steam Mains (`#e04a3e`) -> Twin Turbines
        ctx.strokeStyle = "#e04a3e";
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(118, 154);
        ctx.lineTo(118, 224);
        ctx.lineTo(394, 224);
        ctx.moveTo(394, 154);
        ctx.lineTo(394, 224);
        ctx.moveTo(w / 2, 224);
        ctx.lineTo(w / 2, 266);
        ctx.stroke();

        // TG-7 & TG-8 Generator Blocks
        [
          { y: 268, lbl: "ТГ-7 // 500 МВт" },
          { y: 356, lbl: "ТГ-8 // 500 МВт" },
        ].forEach((tg) => {
          ctx.fillStyle = "#193625";
          ctx.fillRect(80, tg.y, 352, 62);
          ctx.strokeStyle = "#e0b844";
          ctx.lineWidth = 4;
          ctx.strokeRect(80, tg.y, 352, 62);
          ctx.fillStyle = "#33ff66";
          ctx.font = 'bold 28px "VT323", monospace';
          ctx.fillText(tg.lbl, w / 2, tg.y + 39);
        });

        // Bottom 330kV Grid Bus
        ctx.strokeStyle = "#ffb000";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(40, 448);
        ctx.lineTo(472, 448);
        ctx.stroke();
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 24px "VT323", monospace';
        ctx.fillText("ОРУ-330 кВ // СЕКТОР 84", w / 2, 484);
      }),
    [],
  );

  const tabloMatrixTex = useMemo(
    () =>
      createNearestCanvasTexture(640, 160, (ctx, w, h) => {
        ctx.fillStyle = "#101714";
        ctx.fillRect(0, 0, w, h);
        const cols = 6;
        const rows = 3;
        const cw = (w - 20) / cols;
        const ch = (h - 20) / rows;
        const labels = [
          "АЗ-1", "УРОВЕНЬ БС", "ДАВЛ. ПАРА", "ГЦН СТОП", "СФКРЭ", "ПЕЧАТЬ",
          "ПЭН РЕЗ", "ПЕРЕГРЕВ", "СБРОС БРУ", "ТЕПЛО СБ", "ГЕРМОЗОНА", "РАД. ФОН",
          "50.0 ГЦ", "СЕТЬ 330", "ПОЖАР", "КГБ КАНАЛ", "ВАК. ЛЮК", "БЩУ НОРМА",
        ];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            const x = 10 + c * cw + 3;
            const y = 10 + r * ch + 3;
            const bw = cw - 6;
            const bh = ch - 6;
            const isRed = idx === 0 || idx === 7 || idx === 14;
            const isAmber = idx === 3 || idx === 8 || idx === 11;
            ctx.fillStyle = isRed ? "#7d1818" : isAmber ? "#754e12" : "#1f5430";
            ctx.fillRect(x, y, bw, bh);
            ctx.strokeStyle = "#080b0a";
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, bw, bh);
            ctx.fillStyle = isRed ? "#ffb4a8" : isAmber ? "#ffe799" : "#b8ffd0";
            ctx.font = 'bold 16px "VT323", monospace';
            ctx.textAlign = "center";
            ctx.fillText(labels[idx] ?? "СИГНАЛ", x + bw / 2, y + bh / 2 + 5);
          }
        }
      }),
    [],
  );

  const stripRecorderTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 192, (ctx, w, h) => {
        ctx.fillStyle = "#f4eedc";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#24302b";
        ctx.fillRect(0, 0, w, 28);
        ctx.fillStyle = "#ffffff";
        ctx.font = 'bold 16px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("КСП-4", w / 2, 19);

        ctx.strokeStyle = "rgba(45, 130, 118, 0.38)";
        ctx.lineWidth = 1;
        for (let x = 16; x < w; x += 16) {
          ctx.beginPath();
          ctx.moveTo(x, 28);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 36; y < h; y += 16) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        // Pen traces
        ctx.strokeStyle = "#c8241e";
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let y = 30; y < h - 8; y += 10) {
          const px = 64 + Math.sin(y * 0.14) * 28;
          if (y === 30) ctx.moveTo(px, y);
          else ctx.lineTo(px, y);
        }
        ctx.stroke();

        ctx.strokeStyle = "#1f5aa6";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let y = 30; y < h - 8; y += 10) {
          const px = 56 + Math.cos(y * 0.11) * 20;
          if (y === 30) ctx.moveTo(px, y);
          else ctx.lineTo(px, y);
        }
        ctx.stroke();
      }),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const s = useGameStore.getState();
    const isAlarm =
      s.coreTemp >= 700 ||
      s.powerAllocation.cooling + s.powerAllocation.defense + s.powerAllocation.facility >
        s.maxSafePower;
    const tileIntensity = s.isBlackout
      ? 0.05
      : isAlarm
        ? 0.85 + 0.45 * Math.sin(t * 9.0)
        : 0.56;
    if (alarmTileLeftMatRef.current) {
      alarmTileLeftMatRef.current.emissiveIntensity = tileIntensity;
    }
    if (alarmTileRightMatRef.current) {
      alarmTileRightMatRef.current.emissiveIntensity = tileIntensity;
    }
    if (coreMosaicMatRef.current) {
      coreMosaicMatRef.current.emissiveIntensity = s.isBlackout ? 0.06 : 0.62;
    }
  });

  return (
    <group>
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

        {/* Lower Relay Cabinet Doors Under Monumental CRT */}
        {[-1.5, -0.75, 0, 0.75, 1.5].map((dx, dIdx) => (
          <group key={`center-door-${dIdx}`} position={[dx, 0.71, 0.118]}>
            <mesh raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.66, 1.16, 0.022]} />
              <meshStandardMaterial color="#253630" metalness={0.48} roughness={0.54} />
            </mesh>
            <mesh position={[0.25, 0, 0.014]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.024, 0.12, 0.014]} />
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
      </group>

      {/* Backlit Red Cyrillic Header Banner Above Left-Center of K.O.M.R.A.D.-84 */}
      <group position={[-0.78, 3.77, -3.36]} rotation={[0.12, 0, 0]}>
        <mesh raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.12, 0.21, 0.12]} />
          <meshStandardMaterial color="#1d2421" metalness={0.64} roughness={0.44} />
        </mesh>
        <mesh position={[0, 0, 0.064]} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[2.04, 0.18]} />
          <meshStandardMaterial
            map={mainRedBannerTex}
            emissive="#ff4433"
            emissiveMap={mainRedBannerTex}
            emissiveIntensity={0.68}
            roughness={0.42}
          />
        </mesh>
      </group>

      {/* Red 7-Segment Soviet Wall Clock (`ЧАСЫ БЩУ`) Above Right-Center of K.O.M.R.A.D.-84 */}
      <SovietDigitalShiftClock3D />

      {/* 2. LEFT & RIGHT ANGLED SYNOPTIC WINGS (`x = ±3.90, z = -3.62`, width `3.76m`) */}
      {([-1, 1] as const).map((side) => {
        const isLeft = side === -1;
        const mosaicX = isLeft ? 0.82 : -0.82;
        const recorderXs = isLeft ? [-1.42, -0.92, -0.42] : [0.42, 0.92, 1.42];
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
            {/* Raised Steel Panel Trim Frame */}
            <mesh position={[0, 2.34, 0.224]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[3.6, 1.88, 0.016]} />
              <meshStandardMaterial color="#3c524b" metalness={0.46} roughness={0.52} />
            </mesh>
            {/* Top Overhang Canopy */}
            <mesh position={[0, 3.95, 0.08]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[3.84, 0.22, 0.56]} />
              <meshStandardMaterial color="#202b27" metalness={0.58} roughness={0.48} />
            </mesh>

            {/* Upper Backlit Annunciator Tile Matrix (`ТАБЛО СИГНАЛИЗАЦИИ`) */}
            <mesh position={[0, 3.5, 0.222]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[3.5, 0.52, 0.028]} />
              <meshStandardMaterial color="#18201d" metalness={0.62} roughness={0.44} />
            </mesh>
            <mesh position={[0, 3.5, 0.238]} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[3.4, 0.45]} />
              <meshStandardMaterial
                ref={isLeft ? alarmTileLeftMatRef : alarmTileRightMatRef}
                map={tabloMatrixTex}
                emissive="#ffffff"
                emissiveMap={tabloMatrixTex}
                emissiveIntensity={0.56}
                roughness={0.42}
              />
            </mesh>

            {/* Inner Half Centerpiece: Left Wing = 1.70m RBMK Core Mosaic, Right Wing = 1.70m Mimic Diagram */}
            {isLeft ? (
              <group position={[mosaicX, 2.24, 0.232]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.85, 0.87, 0.09, 36]} />
                  <meshStandardMaterial color="#1a2420" metalness={0.66} roughness={0.42} />
                </mesh>
                <mesh position={[0, 0, 0.048]} raycast={NOOP_RAYCAST}>
                  <circleGeometry args={[0.78, 36]} />
                  <meshStandardMaterial
                    ref={coreMosaicMatRef}
                    map={coreMosaicTex}
                    emissive="#ffffff"
                    emissiveMap={coreMosaicTex}
                    emissiveIntensity={0.62}
                    roughness={0.44}
                  />
                </mesh>
              </group>
            ) : (
              <group position={[mosaicX, 2.39, 0.232]}>
                <mesh raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[1.7, 1.56, 0.085]} />
                  <meshStandardMaterial color="#1a2420" metalness={0.66} roughness={0.42} />
                </mesh>
                <mesh position={[0, 0, 0.046]} raycast={NOOP_RAYCAST}>
                  <planeGeometry args={[1.56, 1.44]} />
                  <meshStandardMaterial
                    map={turbineMimicTex}
                    emissive="#ffffff"
                    emissiveMap={turbineMimicTex}
                    emissiveIntensity={0.54}
                    roughness={0.44}
                  />
                </mesh>
              </group>
            )}

            {/* Outer Half: 3 `КСП-4` Strip-Chart Recorders With Illuminated Warm Steel Hoods */}
            {recorderXs.map((rx, rIdx) => (
              <group key={`ksp4-${side}-${rIdx}`} position={[rx, 2.16, 0.235]}>
                <mesh raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.42, 0.72, 0.045]} />
                  <meshStandardMaterial color="#1b2420" metalness={0.65} roughness={0.44} />
                </mesh>
                <mesh position={[0, -0.02, 0.025]} raycast={NOOP_RAYCAST}>
                  <planeGeometry args={[0.34, 0.56]} />
                  <meshStandardMaterial
                    map={stripRecorderTex}
                    emissive="#fff3d1"
                    emissiveMap={stripRecorderTex}
                    emissiveIntensity={0.42}
                    roughness={0.62}
                  />
                </mesh>
                {/* Overhanging Steel Recorder Light Hood + Warm Emissive Tube */}
                <mesh position={[0, 0.36, 0.055]} rotation={[0.25, 0, 0]} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.44, 0.055, 0.12]} />
                  <meshStandardMaterial color="#25322d" metalness={0.62} roughness={0.46} />
                </mesh>
                <mesh position={[0, 0.33, 0.068]} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.36, 0.022, 0.028]} />
                  <meshStandardMaterial
                    color="#fff4d6"
                    emissive="#ffe2a8"
                    emissiveIntensity={1.6}
                  />
                </mesh>
              </group>
            ))}

            {/* Raised 3D Mimic Busbar Piping Across Wing Face */}
            <mesh position={[isLeft ? -0.92 : 0.92, 1.62, 0.236]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[1.56, 0.032, 0.028]} />
              <meshStandardMaterial color={isLeft ? "#388898" : "#c8a838"} metalness={0.54} roughness={0.42} />
            </mesh>

            {/* Lower Relay Cabinet Doors & Base Toe-Kick */}
            {[-1.18, 0, 1.18].map((lx, lIdx) => (
              <group key={`wing-door-${side}-${lIdx}`} position={[lx, 0.74, 0.228]}>
                <mesh raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[1.06, 1.18, 0.022]} />
                  <meshStandardMaterial color="#24352f" metalness={0.48} roughness={0.56} />
                </mesh>
                <mesh position={[0.42, 0, 0.015]} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.026, 0.14, 0.016]} />
                  <meshStandardMaterial color="#b8a46b" metalness={0.86} roughness={0.28} />
                </mesh>
              </group>
            ))}
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
 * Shift Supervisor Desk Surround (`Стол НСБ` around `[0, 0, +1.80]`) + Ergonomic Swivel Chair (`Кресло НСБ`).
 * Supports `InspectorDesk3D`'s right-corner `WE-PAD 84` dock solidly from floor to desktop underside (`y = 0.70m`)
 * without clipping above `InspectorDesk3D`'s `y = 0.725m` desktop surface.
 */
const SovietSupervisorDeskSurroundAndChair3D: React.FC = React.memo(() => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  const legAngles = [0, 1, 2, 3, 4].map((i) => (i * Math.PI * 2) / 5);

  return (
    <group>
      {/* 1. Wraparound Supervisor Desk Base Collar & Right-Wing `WE-PAD 84` Support Pedestal (`[0, 0, +1.80]`) */}
      <group position={[0, 0, 1.8]}>
        {/* Heavy Stepped Steel Floor Plinth Under Supervisor Desk (`y = 0..0.055m`) */}
        <mesh position={[0, 0.028, 0]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.56, 0.056, 1.12]} />
          <meshStandardMaterial
            color="#151b18"
            metalness={0.64}
            roughness={0.54}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>

        {/* Solid Right-Corner Pedestal Extension Supporting `WE-PAD 84` Dock (`x = +0.76..+1.34`, `y = 0..0.695m`) */}
        <mesh position={[1.02, 0.348, 0.02]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.56, 0.696, 0.96]} />
          <meshStandardMaterial
            color="#24302b"
            metalness={0.56}
            roughness={0.5}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.007}
          />
        </mesh>

        {/* Left Side Steel Drawer Pedestal Balancing Supervisor Desk (`x = -1.02`) */}
        <mesh position={[-1.02, 0.348, 0.02]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.56, 0.696, 0.96]} />
          <meshStandardMaterial
            color="#24302b"
            metalness={0.56}
            roughness={0.5}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.007}
          />
        </mesh>

        {/* Modesty Front Screen Facing Operator Row (`z = -0.46`) */}
        <mesh position={[0, 0.34, -0.46]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.64, 0.68, 0.04]} />
          <meshStandardMaterial color="#1d2622" metalness={0.54} roughness={0.52} />
        </mesh>
      </group>

      {/* 2. Authentic Soviet Supervisor Swivel Chair (`Кресло НСБ` behind desk at `x = -0.28, z = +2.74`) */}
      <group position={[-0.28, 0.005, 2.74]} rotation={[0, 0.24, 0]}>
        <mesh position={[0, 0.045, 0]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.075, 0.095, 0.08, 16]} />
          <meshStandardMaterial
            color="#1a211e"
            metalness={0.72}
            roughness={0.44}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>
        <mesh position={[0, 0.22, 0]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.034, 0.042, 0.36, 14]} />
          <meshStandardMaterial color="#7f8a92" metalness={0.86} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.14, 0]} raycast={NOOP_RAYCAST}>
          <torusGeometry args={[0.17, 0.011, 8, 20]} />
          <meshStandardMaterial
            color="#8c7a4b"
            metalness={0.85}
            roughness={0.3}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>
        {legAngles.map((ang, idx) => (
          <group key={`leg-${idx}`} rotation={[0, ang, 0]}>
            <mesh position={[0, 0.036, 0.165]} rotation={[0.08, 0, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.042, 0.034, 0.29]} />
              <meshStandardMaterial color="#1b221f" metalness={0.68} roughness={0.46} />
            </mesh>
            <mesh position={[0, 0.018, 0.29]} rotation={[0, 0, Math.PI / 2]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.022, 0.022, 0.026, 12]} />
              <meshStandardMaterial color="#101211" roughness={0.82} />
            </mesh>
          </group>
        ))}
        {/* Padded Oxblood/Charcoal Leatherette Seat Cushion (`y = 0.42m`) */}
        <mesh position={[0, 0.42, 0]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.48, 0.075, 0.46]} />
          <meshStandardMaterial color="#3b1b18" roughness={0.66} metalness={0.1} />
        </mesh>
        {/* Steel Backrest Spine & Padded Backrest */}
        <mesh position={[0, 0.62, 0.24]} rotation={[0.1, 0, 0]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.08, 0.42, 0.03]} />
          <meshStandardMaterial color="#1e2623" metalness={0.68} roughness={0.44} />
        </mesh>
        <mesh position={[0, 0.78, 0.22]} rotation={[0.08, 0, 0]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.44, 0.38, 0.065]} />
          <meshStandardMaterial color="#3b1b18" roughness={0.66} metalness={0.1} />
        </mesh>
        {/* Tubular Armrests */}
        {([-0.25, 0.25] as const).map((ax, aIdx) => (
          <mesh key={`arm-${aIdx}`} position={[ax, 0.56, 0.01]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.045, 0.032, 0.34]} />
            <meshStandardMaterial color="#1a1817" roughness={0.58} metalness={0.25} />
          </mesh>
        ))}
      </group>
    </group>
  );
});

/**
 * Heavy Floor-to-Ceiling High-Voltage Switchgear Enclosure Framing `1.25x` `UNIT D` at `x = -4.6, z = +1.35`, facing `+X`.
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
        ctx.font = 'bold 38px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("РУСН-6 кВ // РЗА", w / 2, 62, w - 52);
        ctx.fillStyle = "#c81919";
        ctx.font = 'bold 36px "VT323", monospace';
        ctx.fillText("ОПАСНО! ВЫСОКОЕ НАПРЯЖЕНИЕ", w / 2, 150, w - 44);
        ctx.fillStyle = "#141414";
        ctx.fillText("ШКАФ ПРЕДОХРАНИТЕЛЕЙ UNIT D", w / 2, 212, w - 44);
      }),
    [],
  );

  return (
    <group position={[-5.25, 0, 1.35]} rotation={[0, Math.PI / 2, 0]}>
      {/* Rear Floor-to-Ceiling Main Steel Switchgear Housing Behind `UNIT D` (`y = 0..4.2m`) */}
      <mesh position={[0, 2.1, 0.14]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[3.78, 4.2, 0.92]} />
        <meshStandardMaterial
          color="#24352e"
          metalness={0.58}
          roughness={0.52}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
        />
      </mesh>
      {/* Stepped Steel Plinth Under 1.25x `UNIT D` (`y = 0..0.14m`) with Hazard Striping */}
      <mesh position={[0, 0.07, 0.62]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[2.06, 0.14, 0.64]} />
        <meshStandardMaterial color="#161d1a" metalness={0.66} roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.075, 0.945]} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[2.02, 0.11]} />
        <meshStandardMaterial map={hvHazardTex} roughness={0.55} />
      </mesh>
      {/* Upper Header Soffit Above 1.25x `UNIT D` (`y = 2.71..4.20m`) with HV Insulators & Hazard Trim */}
      <mesh position={[0, 3.455, 0.6]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[2.1, 1.49, 0.46]} />
        <meshStandardMaterial color="#1d2722" metalness={0.62} roughness={0.5} />
      </mesh>
      <mesh position={[0, 2.8, 0.835]} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[2.02, 0.14]} />
        <meshStandardMaterial map={hvHazardTex} roughness={0.5} />
      </mesh>
      {/* Porcelain HV Busbar Insulators & Red HV Live Beacons on Upper Soffit */}
      {([-0.68, 0, 0.68] as const).map((ix, idx) => (
        <group key={`hv-bus-${idx}`} position={[ix, 3.24, 0.84]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.042, 0.048, 0.12, 12]} />
            <meshStandardMaterial color="#b86b3a" roughness={0.34} metalness={0.18} />
          </mesh>
          <mesh position={[0, 0.28, 0]} raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.032, 10, 10]} />
            <meshStandardMaterial
              color="#ff2a2a"
              emissive="#ff2a2a"
              emissiveIntensity={1.35}
            />
          </mesh>
        </group>
      ))}
      {/* Flanking High-Voltage Breaker Lockers (`lx = ±1.44m` along wall) with Vertical Hazard Striping */}
      {([-1.44, 1.44] as const).map((lx, idx) => (
        <group key={`hv-locker-${idx}`} position={[lx, 0, 0.6]}>
          <mesh position={[0, 2.1, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.86, 4.2, 0.48]} />
            <meshStandardMaterial color="#2b3d36" metalness={0.54} roughness={0.54} />
          </mesh>
          <mesh position={[0, 1.32, 0.245]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.7, 2.24, 0.018]} />
            <meshStandardMaterial color="#1f2c26" metalness={0.58} roughness={0.5} />
          </mesh>
          {/* Inner Vertical Yellow-Black HV Hazard Strip Flanking `UNIT D` */}
          <mesh
            position={[idx === 0 ? 0.39 : -0.39, 1.35, 0.248]}
            rotation={[0, 0, Math.PI / 2]}
            raycast={NOOP_RAYCAST}
          >
            <planeGeometry args={[2.56, 0.095]} />
            <meshStandardMaterial map={hvHazardTex} roughness={0.5} />
          </mesh>
          <group position={[idx === 0 ? -0.04 : 0.04, 2.02, 0.288]}>
            <mesh position={[0, 0, -0.007]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.52, 0.26, 0.012]} />
              <meshStandardMaterial color="#18211d" metalness={0.62} roughness={0.48} />
            </mesh>
            <mesh raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.5, 0.25]} />
              <meshStandardMaterial map={hvPlaqueTex} roughness={0.45} />
            </mesh>
          </group>
          <mesh position={[0.24, 1.24, 0.262]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.032, 0.18, 0.025]} />
            <meshStandardMaterial color="#b8a46b" metalness={0.86} roughness={0.28} />
          </mesh>
        </group>
      ))}
    </group>
  );
});

/**
 * Rear Control Room Wall (`z = +4.44m`, facing `-Z`) with Institutional Double Steel Entry Doors,
 * Frosted Wired-Glass Panes, Transom Signboard, Ventilation Louvers & Radiation Plaque (No Airlock Wheel Door).
 */
const SovietRearDoubleEntryDoors3D: React.FC = React.memo(() => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);

  const wiredGlassTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 256, (ctx, w, h) => {
        ctx.fillStyle = "#5a6b62";
        ctx.fillRect(0, 0, w, h);
        // Frosted institutional light gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "rgba(186, 206, 194, 0.45)");
        grad.addColorStop(1, "rgba(62, 82, 72, 0.35)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        // Diagonal wired safety mesh
        ctx.strokeStyle = "rgba(28, 34, 31, 0.65)";
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

  const transomTex = useMemo(
    () =>
      createNearestCanvasTexture(512, 96, (ctx, w, h) => {
        ctx.fillStyle = "#18211d";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 5;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#33ff66";
        ctx.font = 'bold 26px "Kremlin", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("БЩУ БЛОКА №4 // ВЫХОД", w / 2, 46);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 18px "VT323", monospace';
        ctx.fillText("ВХОД ТОЛЬКО ПО СПЕЦПРОПУСКАМ СЕКТОРА 84", w / 2, 78);
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
        ctx.fillStyle = "#ff2a2a";
        ctx.font = 'bold 20px "Kremlin", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("СЕКТОР 84 // ЗАЛ БЩУ-4", w / 2, 58);
        ctx.fillStyle = "#141414";
        ctx.font = 'bold 16px "Courier Prime", monospace';
        ctx.fillText("ВХОД ПОСТОРОННИМ ВОСПРЕЩЕН", w / 2, 86);
        ctx.fillText("РАДИАЦИОННЫЙ КОНТРОЛЬ", w / 2, 110);
      }),
    [],
  );

  return (
    <group position={[0, 0, 4.44]} rotation={[0, Math.PI, 0]}>
      {/* Heavy Steel Double Door Frame (`2.26m × 2.52m`) */}
      <mesh position={[0, 2.46, 0.04]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[2.28, 0.14, 0.18]} />
        <meshStandardMaterial color="#18201d" metalness={0.66} roughness={0.48} />
      </mesh>
      {([-1.07, 1.07] as const).map((fx, fIdx) => (
        <mesh key={`door-jamb-${fIdx}`} position={[fx, 1.2, 0.04]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.14, 2.4, 0.18]} />
          <meshStandardMaterial color="#18201d" metalness={0.66} roughness={0.48} />
        </mesh>
      ))}

      {/* Twin Steel Entry Door Leaves with Frosted Wired-Glass Windows */}
      {([-0.49, 0.49] as const).map((dx, dIdx) => (
        <group key={`entry-leaf-${dIdx}`} position={[dx, 1.18, 0.03]}>
          <mesh raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.96, 2.34, 0.07]} />
            <meshStandardMaterial
              color="#2d3a34"
              metalness={0.52}
              roughness={0.54}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
          {/* Upper Frosted Wired-Glass Observation Pane */}
          <mesh position={[0, 0.46, 0.04]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.48, 0.84]} />
            <meshStandardMaterial
              map={wiredGlassTex}
              emissive="#8fa89b"
              emissiveMap={wiredGlassTex}
              emissiveIntensity={0.22}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[0, 0.46, 0.036]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.54, 0.9, 0.014]} />
            <meshStandardMaterial color="#161d1a" metalness={0.64} roughness={0.46} />
          </mesh>
          {/* Brushed Steel Vertical Pull Handle */}
          <mesh position={[dIdx === 0 ? 0.36 : -0.36, -0.08, 0.065]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.015, 0.015, 0.36, 10]} />
            <meshStandardMaterial color="#96a0a6" metalness={0.86} roughness={0.28} />
          </mesh>
        </group>
      ))}

      {/* Illuminated Transom Sign Above Double Doors */}
      <mesh position={[0, 2.74, 0.05]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[1.64, 0.34, 0.06]} />
        <meshStandardMaterial color="#141816" metalness={0.62} roughness={0.48} />
      </mesh>
      <mesh position={[0, 2.74, 0.082]} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[1.54, 0.28]} />
        <meshStandardMaterial
          map={transomTex}
          emissive="#ffffff"
          emissiveMap={transomTex}
          emissiveIntensity={0.35}
          roughness={0.45}
        />
      </mesh>

      {/* Left-Side Rear Ventilation Louver Frame (Right-Side Cleared for Window 2) */}
      {([2.85] as const).map((vx, vIdx) => (
        <group key={`rear-vent-${vIdx}`} position={[vx, 2.45, 0.08]}>
          <mesh raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.28, 0.84, 0.14]} />
            <meshStandardMaterial color="#1b2320" metalness={0.62} roughness={0.5} />
          </mesh>
          {[-0.26, -0.13, 0, 0.13, 0.26].map((vy, lIdx) => (
            <mesh key={`vent-slat-${lIdx}`} position={[0, vy, 0.075]} rotation={[0.35, 0, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[1.12, 0.048, 0.025]} />
              <meshStandardMaterial color="#0e1311" metalness={0.55} roughness={0.6} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Enamel Radiation Control Signboard Beside Entry Doors */}
      <mesh position={[1.76, 1.65, 0.04]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.98, 0.5, 0.028]} />
        <meshStandardMaterial color="#141414" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[1.76, 1.65, 0.056]} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[0.92, 0.45]} />
        <meshStandardMaterial map={warningPlaqueTex} roughness={0.42} metalness={0.18} />
      </mesh>
    </group>
  );
});

/**
 * Heavy Industrial Caged Tungsten Wall Work-Light (`Плафон ВЗГ-200`) mounted along the
 * `12m × 9m` RBMK-1000 БЩУ perimeter columns & walls.
 */
const SovietWallPillarLamp3D: React.FC<{
  position: [number, number, number];
  rotY: number;
}> = React.memo(({ position, rotY }) => {
  const glassMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const bulbMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const gs = useGameStore.getState();
    const isAlarm =
      gs.coreTemp >= 750 ||
      gs.powerAllocation.cooling +
        gs.powerAllocation.defense +
        gs.powerAllocation.facility >
        gs.maxSafePower;
    const hzSag = Math.max(0, 49.7 - gs.gridHz) * 0.45;
    const dip = Math.min(1, gs.voltageDipIntensity + hzSag);
    const flicker =
      dip > 0.02 ? 1 - dip * (0.3 + 0.14 * Math.sin(t * 62.8)) : 1;

    if (glassMatRef.current) {
      if (gs.isBlackout) {
        glassMatRef.current.color.copy(SCENE_COLOR_SCONCE_BLACKOUT);
        glassMatRef.current.emissive.copy(SCENE_COLOR_SCONCE_BLACKOUT_EMISSIVE);
        glassMatRef.current.emissiveIntensity = 0.08;
      } else if (isAlarm) {
        glassMatRef.current.color.copy(SCENE_COLOR_SCONCE_ALARM);
        glassMatRef.current.emissive.copy(SCENE_COLOR_SCONCE_ALARM_EMISSIVE);
        glassMatRef.current.emissiveIntensity =
          (0.65 + 0.3 * Math.sin(t * 9.0)) * flicker;
      } else {
        glassMatRef.current.color.copy(SCENE_COLOR_SCONCE_NORM);
        glassMatRef.current.emissive.copy(SCENE_COLOR_SCONCE_NORM_EMISSIVE);
        glassMatRef.current.emissiveIntensity = 0.65 * flicker;
      }
    }
    if (bulbMatRef.current) {
      bulbMatRef.current.emissiveIntensity = gs.isBlackout
        ? 0.06
        : (isAlarm ? 1.5 : 1.35) * flicker;
    }
  });

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.02, -0.06]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.16, 0.12, 0.04]} />
        <meshStandardMaterial color="#18211b" metalness={0.75} roughness={0.4} />
      </mesh>
      <mesh
        position={[0, 0.03, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        raycast={NOOP_RAYCAST}
      >
        <cylinderGeometry args={[0.02, 0.024, 0.1, 10]} />
        <meshStandardMaterial color="#222b25" metalness={0.75} roughness={0.38} />
      </mesh>
      <mesh position={[0, 0.01, 0.05]} raycast={NOOP_RAYCAST}>
        <cylinderGeometry args={[0.058, 0.074, 0.048, 12]} />
        <meshStandardMaterial color="#23312b" metalness={0.72} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.05, 0.05]} raycast={NOOP_RAYCAST}>
        <cylinderGeometry args={[0.054, 0.048, 0.095, 12]} />
        <meshStandardMaterial
          ref={glassMatRef}
          color="#ffba52"
          emissive="#ff9922"
          emissiveIntensity={0.65}
          transparent
          opacity={0.86}
          roughness={0.22}
          metalness={0.1}
        />
      </mesh>
      <mesh position={[0, -0.045, 0.05]} raycast={NOOP_RAYCAST}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial
          ref={bulbMatRef}
          color="#ffcf75"
          emissive="#ffaa33"
          emissiveIntensity={1.35}
        />
      </mesh>
      <mesh
        position={[0, -0.02, 0.05]}
        rotation={[Math.PI / 2, 0, 0]}
        raycast={NOOP_RAYCAST}
      >
        <torusGeometry args={[0.064, 0.005, 6, 14]} />
        <meshStandardMaterial color="#b8a46b" metalness={0.86} roughness={0.28} />
      </mesh>
      <mesh
        position={[0, -0.085, 0.05]}
        rotation={[Math.PI / 2, 0, 0]}
        raycast={NOOP_RAYCAST}
      >
        <torusGeometry args={[0.056, 0.0045, 6, 14]} />
        <meshStandardMaterial color="#b8a46b" metalness={0.86} roughness={0.28} />
      </mesh>
    </group>
  );
});

/**
 * Rear 180° Cockpit Bay (`UNIT D // AUXILIARY, FUSES & MAIN BREAKER`) recessed into Left Wall Switchgear.
 * Houses the heavy `HighDetailKnifeBreaker3D` (Main Breaker), Steam Relief Pull-Lever (`СБРОС ПАРА`),
 * Rotary 50Hz Turbine Valve Rheostat, Ceramic Cartridge Fuse Bank (`ПН-2 250А`),
 * 3 Turbine/Synchroscope/Grid Manometers, and 4 Guarded Auxiliary Toggle Switches.
 */
const SovietRearAuxBreakerPanel3D: React.FC = React.memo(() => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  const breakerArmRef = useRef<THREE.Group | null>(null);
  const breakerDragRef = useRef({ active: false, startY: 0, progress: 0 });
  const steamLeverArmRef = useRef<THREE.Group>(null);
  const steamDragRef = useRef({
    active: false,
    startY: 0,
    progress: 0,
    lastHissTime: 0,
  });
  const rheostatWheelRef = useRef<THREE.Group>(null);
  const toggleDragIdxRef = useRef<number | null>(null);

  const fuseLamp0 = useRef<THREE.MeshStandardMaterial | null>(null);
  const fuseLamp1 = useRef<THREE.MeshStandardMaterial | null>(null);
  const fuseLamp2 = useRef<THREE.MeshStandardMaterial | null>(null);
  const fuseLamp3 = useRef<THREE.MeshStandardMaterial | null>(null);
  const fuseLamp4 = useRef<THREE.MeshStandardMaterial | null>(null);
  const fuseLamp5 = useRef<THREE.MeshStandardMaterial | null>(null);

  const toggleLamp0 = useRef<THREE.MeshStandardMaterial | null>(null);
  const toggleLamp1 = useRef<THREE.MeshStandardMaterial | null>(null);
  const toggleLamp2 = useRef<THREE.MeshStandardMaterial | null>(null);
  const toggleLamp3 = useRef<THREE.MeshStandardMaterial | null>(null);

  const toggleBat0 = useRef<THREE.Group | null>(null);
  const toggleBat1 = useRef<THREE.Group | null>(null);
  const toggleBat2 = useRef<THREE.Group | null>(null);
  const toggleBat3 = useRef<THREE.Group | null>(null);

  const headerPlateTex = useMemo(
    () =>
      makePlaqueTex(
        "UNIT D // AUXILIARY, FUSES & MAIN BREAKER",
        "TURBINE RPM • 50HZ SYNC • STEAM VENT • KNIFE BREAKER",
        {
          width: 768,
          height: 112,
          titleSize: 27,
          subSize: 22,
          titleColor: "#ffcc00",
          titleStroke: "#ffcc00",
          subColor: "#44ff77",
          subStroke: "#44ff77",
          borderColor: "#b8a46b",
        },
      ),
    [],
  );

  const fuseBayPlateTex = useMemo(
    () =>
      makePlaqueTex(
        "HV CERAMIC FUSE CARTRIDGE BANK (ПН-2 // 250А)",
        "BUS A1 • BUS A2 • PUMP G1 • DVK CRT • KGB RELAY • EXCITER",
        {
          width: 768,
          height: 88,
          titleSize: 24,
          subSize: 18,
          titleColor: "#e6dec3",
          titleStroke: "#e6dec3",
          subColor: "#33ff66",
          subStroke: "#33ff66",
          borderColor: "#8c7a4b",
        },
      ),
    [],
  );

  const steamPlateTex = useMemo(
    () =>
      makePlaqueTex("STEAM VENT (БРУ-К)", "PULL OPEN (-3 BAR/S)", {
        width: 384,
        height: 104,
        titleSize: 28,
        subSize: 20,
        titleColor: "#ff4444",
        titleStroke: "#ff4444",
        subColor: "#ffcc00",
        subStroke: "#ffcc00",
        borderColor: "#ff2a2a",
      }),
    [],
  );

  const rheostatPlateTex = useMemo(
    () =>
      makePlaqueTex("TURBINE STEAM VALVE", "VALVE 0-100% (15%=3000RPM)", {
        width: 384,
        height: 104,
        titleSize: 28,
        subSize: 20,
        titleColor: "#44ff77",
        titleStroke: "#44ff77",
        subColor: "#ffffff",
        subStroke: "#ffffff",
        borderColor: "#33ff66",
      }),
    [],
  );

  const breakerPlateTex = useMemo(
    () =>
      makePlaqueTex(
        "MAIN BREAKER (ГЛАВНЫЙ РУБИЛЬНИК)",
        "CLICK / DRAG / WHEEL / [SPACE]",
        {
          width: 420,
          height: 104,
          titleSize: 26,
          subSize: 19,
          titleColor: "#ffcc00",
          titleStroke: "#ffcc00",
          subColor: "#ff6655",
          subStroke: "#ff6655",
          borderColor: "#b8a46b",
        },
      ),
    [],
  );

  const rheostatScaleTex = useMemo(
    () =>
      createCrispPanelTexture(256, 256, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        ctx.fillStyle = "#e6dec3";
        ctx.beginPath();
        ctx.arc(cx, cy, 120, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#141414";
        ctx.lineWidth = 6;
        ctx.stroke();

        for (let i = -20; i <= 20; i++) {
          const ratio = (i + 20) / 40;
          const ang = -Math.PI * 0.5 - Math.PI * 0.8 + ratio * Math.PI * 1.6;
          const isMajor = i % 4 === 0;
          const rOut = 114;
          const rIn = isMajor ? 92 : 102;
          ctx.strokeStyle = Math.abs(i) >= 16 ? "#c81e1e" : "#141414";
          ctx.lineWidth = isMajor ? 4 : 2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * rIn, cy + Math.sin(ang) * rIn);
          ctx.lineTo(cx + Math.cos(ang) * rOut, cy + Math.sin(ang) * rOut);
          ctx.stroke();
        }
        ctx.fillStyle = "#1e7a3b";
        ctx.font = '900 28px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("50.0 HZ", cx, 46);
      }),
    [],
  );

  const toggleSpecs = useMemo(() => {
    const items = [
      { id: 0, label: "VENTILATION", sub: "-1.2 R/H (+10MW)", color: "#44ff77" },
      { id: 1, label: "AUDIO [M]", sub: "BUNKER SOUND", color: "#ffcc00" },
      { id: 2, label: "KGB LINE", sub: "DECODE ORDERS", color: "#44ff77" },
      { id: 3, label: "TRIP RESET", sub: "RESET TURBINE TRIP", color: "#ffcc00" },
    ];
    return items.map((item) => ({
      ...item,
      texture: makePlaqueTex(item.label, item.sub, {
        width: 352,
        height: 104,
        titleSize: 29,
        subSize: 21,
        titleColor: item.color,
        titleStroke: item.color,
        subColor: "#ffffff",
        subStroke: "#ffffff",
        borderColor: "#b8a46b",
      }),
    }));
  }, []);

  const unitDMimicSegments = useMemo<readonly MimicSegmentSpec[]>(
    () => [
      { x: -0.71, y: 1.04, w: 0.22, h: 0.015, color: "#a83830" },
      { x: -0.82, y: 1.41, w: 0.016, h: 0.74, color: "#a83830" },
      { x: -0.70, y: 1.79, w: 0.24, h: 0.015, color: "#a83830" },
      { x: -0.29, y: 1.79, w: 0.58, h: 0.015, color: "#a83830" },
      { x: -0.30, y: 1.04, w: 0.56, h: 0.015, color: "#c8a838" },
      { x: 0.27, y: 1.04, w: 0.58, h: 0.015, color: "#c8a838" },
      { x: 0.69, y: 1.04, w: 0.26, h: 0.015, color: "#c8a838" },
      { x: 0.82, y: 1.41, w: 0.016, h: 0.74, color: "#c8a838" },
      { x: 0.70, y: 1.79, w: 0.24, h: 0.015, color: "#c8a838" },
      { x: 0.29, y: 1.79, w: 0.58, h: 0.015, color: "#c8a838" },
      { x: 0.0, y: 0.775, w: 1.62, h: 0.016, color: "#388898" },
    ],
    [],
  );

  const unitDMimicNodes = useMemo<readonly MimicNodeSpec[]>(
    () => [
      { x: -0.82, y: 1.79, color: "#a83830" },
      { x: -0.82, y: 1.04, color: "#a83830" },
      { x: -0.29, y: 1.79, color: "#a83830" },
      { x: 0.29, y: 1.79, color: "#c8a838" },
      { x: 0.82, y: 1.79, color: "#c8a838" },
      { x: 0.82, y: 1.04, color: "#c8a838" },
    ],
    [],
  );

  const unitDRecessedWells = useMemo(
    () => [{ x: 0, y: 0.56, w: 1.78, h: 0.34 }],
    [],
  );

  useFrame(({ clock }, delta) => {
    const dt = Math.min(0.1, delta);
    const t = clock.getElapsedTime();
    const s = useGameStore.getState();
    const t0 = s.turbines[0];

    // 1. Animate Copper Knife-Switch MAIN BREAKER arm (`ГЛАВНЫЙ РУБИЛЬНИК`)
    if (breakerArmRef.current) {
      const closedState =
        s.phase === "playing" && !s.isBlackout && Boolean(t0?.gridConnected);
      const prog = breakerDragRef.current.active
        ? breakerDragRef.current.progress
        : closedState
          ? 1
          : 0;
      const targetRotX = THREE.MathUtils.lerp(0.62, -0.58, prog);
      breakerArmRef.current.rotation.x = THREE.MathUtils.lerp(
        breakerArmRef.current.rotation.x,
        targetRotX,
        breakerDragRef.current.active ? 0.36 : 0.24,
      );
    }

    // 2. Animate Steam Relief Lever (`СБРОС ПАРА`)
    if (steamLeverArmRef.current) {
      const targetProg = steamDragRef.current.active
        ? steamDragRef.current.progress
        : s.steamDumpValve
          ? 1.0
          : 0;
      const shake =
        s.steamDumpValve && targetProg > 0.35 ? Math.sin(t * 52) * 0.035 : 0;
      const targetAngleX = -0.52 + targetProg * 1.12 + shake;
      steamLeverArmRef.current.rotation.x = THREE.MathUtils.lerp(
        steamLeverArmRef.current.rotation.x,
        targetAngleX,
        steamDragRef.current.active ? 0.32 : 0.22,
      );
      if (s.steamDumpValve && t - steamDragRef.current.lastHissTime > 0.16) {
        steamDragRef.current.lastHissTime = t;
        playSteamVentHiss(Math.max(0.5, targetProg));
      }
    }

    // 3. Animate Rotary Turbine Steam / 50Hz Rheostat Wheel
    if (rheostatWheelRef.current) {
      const valveRatio = t0?.valve ?? 0;
      const targetRotZ = -(valveRatio - 0.5) * 2 * (Math.PI * 0.85);
      rheostatWheelRef.current.rotation.z = THREE.MathUtils.lerp(
        rheostatWheelRef.current.rotation.z,
        targetRotZ,
        Math.min(1, dt * 28),
      );
    }

    // 4. Animate 4 Guarded Auxiliary Toggles & Jewel Lamps (Zero per-frame allocations)
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
              : !t0?.tripped;
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
            ? t0?.tripped
              ? SCENE_COLOR_RED
              : SCENE_COLOR_GREEN
            : i === 1
              ? SCENE_COLOR_AMBER
              : SCENE_COLOR_GREEN;
        const lit = i === 3 ? true : isOn;
        lamp.color.copy(lit ? activeCol : SCENE_COLOR_LAMP_DARK);
        lamp.emissive.copy(lit ? activeCol : SCENE_COLOR_BLACK);
        lamp.emissiveIntensity = lit ? 1.4 : 0.05;
      }
    }

    // 5. Update 6 HV Ceramic Fuse Cartridge Continuity Lamps
    for (let i = 0; i < 6; i++) {
      const mat =
        i === 0
          ? fuseLamp0.current
          : i === 1
            ? fuseLamp1.current
            : i === 2
              ? fuseLamp2.current
              : i === 3
                ? fuseLamp3.current
                : i === 4
                  ? fuseLamp4.current
                  : fuseLamp5.current;
      if (!mat) continue;
      const live =
        !s.isBlackout &&
        (i === 0
          ? true
          : i === 1
            ? Boolean(t0?.gridConnected)
            : i === 2
              ? s.powerAllocation.cooling > 0
              : i === 3
                ? s.powerAllocation.defense > 0
                : i === 4
                  ? s.kgbLineActive
                  : !t0?.tripped);
      if (s.isBlackout) {
        mat.color.copy(SCENE_COLOR_RED);
        mat.emissive.copy(SCENE_COLOR_RED);
        mat.emissiveIntensity = 0.55 + Math.sin(t * 7 + i) * 0.35;
      } else if (live) {
        mat.color.copy(SCENE_COLOR_GREEN);
        mat.emissive.copy(SCENE_COLOR_GREEN);
        mat.emissiveIntensity = 1.2;
      } else {
        mat.color.copy(SCENE_COLOR_LAMP_AMBER_OFF);
        mat.emissive.copy(SCENE_COLOR_LAMP_AMBER_EMISSIVE);
        mat.emissiveIntensity = 0.6;
      }
    }
  });

  const fuseLampRefs = [
    fuseLamp0,
    fuseLamp1,
    fuseLamp2,
    fuseLamp3,
    fuseLamp4,
    fuseLamp5,
  ];
  const toggleLampRefs = [toggleLamp0, toggleLamp1, toggleLamp2, toggleLamp3];
  const toggleBatRefs = [toggleBat0, toggleBat1, toggleBat2, toggleBat3];

  return (
    <group position={[-4.6, 0.14, 1.35]} rotation={[0, Math.PI / 2, 0]} scale={1.025}>
      <SovietModularSteelCabinet3D
        width={1.92}
        unitCode="D"
        annunciatorLabels={[
          "TURBINE RPM",
          "SYNC 50HZ",
          "MAIN BREAKER",
          "STEAM VENT",
          "FUSE BANK",
          "AUX POWER",
        ]}
        mimicSegments={unitDMimicSegments}
        mimicNodes={unitDMimicNodes}
        recessedWells={unitDRecessedWells}
        dividerY={1.305}
        lowerLedgeY={0.775}
        hideChartRecorders={true}
        hideStripMeters={true}
      />

      {/* Top Riveted Header Plaque */}
      <mesh position={[0, 2.095, 0.044]} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[1.56, 0.138]} />
        <meshStandardMaterial
          map={headerPlateTex}
          emissive="#ffffff"
          emissiveMap={headerPlateTex}
          emissiveIntensity={0.35}
          roughness={0.75}
        />
      </mesh>

      {/* Upper Synoptic Bay: 3 Manometers (Turbine RPM / Synchroscope 50Hz / Grid Load MW) */}
      <group position={[0, 1.79, 0.03]}>
        <HighDetailManometer3D
          position={[-0.58, 0, 0]}
          title="TURBINE RPM"
          cyrillicSub="ТУРБИНА №1"
          unit="0-3500 RPM"
          serial="№ 84-ТБ1"
          min={0}
          max={3500}
          nominalMark={3000}
          dangerThreshold={3300}
          getValue={() => useGameStore.getState().turbines[0]?.rpm ?? 0}
          getAlertLevel={(s) => {
            const rpm = s.turbines[0]?.rpm ?? 0;
            return rpm < 2850 || rpm > 3150
              ? "critical"
              : rpm < 2950 || rpm > 3050
                ? "warn"
                : "normal";
          }}
        />
        <HighDetailManometer3D
          position={[0, 0, 0]}
          title="SYNCHROSCOPE 50HZ"
          cyrillicSub="СИНХРОНОСКОП 0°"
          unit="-180..+180° (12H)"
          serial="№ 84-СХ2"
          min={-180}
          max={180}
          dangerThreshold={180}
          synchroscopeMode={true}
          getValue={() => useGameStore.getState().turbines[0]?.syncPhase ?? 0}
          getAlertLevel={(s) =>
            s.gridHz < 49.0 || s.gridHz > 51.0
              ? "critical"
              : s.gridHz < 49.4 || s.gridHz > 50.6
                ? "warn"
                : "normal"
          }
        />
        <HighDetailManometer3D
          position={[0.58, 0, 0]}
          title="MW LOAD"
          cyrillicSub="МОЩНОСТЬ МВТ"
          unit="0-1000 MWe"
          serial="№ 84-ЭЛ3"
          min={0}
          max={1000}
          dangerThreshold={950}
          getValue={() => useGameStore.getState().totalElectricalMW}
          getAlertLevel={(s) =>
            s.isBlackout ||
            !s.turbines[0]?.gridConnected ||
            s.turbines[0]?.tripped
              ? "critical"
              : "normal"
          }
        />
      </group>

      {/* Tier-2 Riser: Ceramic Cartridge High-Voltage Fuse Bank (`БЛОК ПРЕДОХРАНИТЕЛЕЙ ПН-2`) */}
      <group position={[0, 1.465, 0.04]} rotation={[-0.08, 0, 0]}>
        <mesh position={[0, 0, -0.008]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.66, 0.24, 0.032]} />
          <meshStandardMaterial
            color="#19211d"
            metalness={0.62}
            roughness={0.46}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>
        <mesh position={[0, 0.09, 0.012]} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[1.48, 0.068]} />
          <meshStandardMaterial
            map={fuseBayPlateTex}
            emissive="#ffffff"
            emissiveMap={fuseBayPlateTex}
            emissiveIntensity={0.3}
            roughness={0.6}
          />
        </mesh>
        {[-0.6, -0.36, -0.12, 0.12, 0.36, 0.6].map((fx, idx) => (
          <group key={`fuse-${idx}`} position={[fx, -0.025, 0.02]}>
            {/* Upper & Lower Copper Busbar Clips */}
            {[-0.052, 0.052].map((cy, cIdx) => (
              <mesh key={`clip-${cIdx}`} position={[0, cy, 0]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.044, 0.022, 0.036]} />
                <meshStandardMaterial
                  color="#c87d46"
                  metalness={0.88}
                  roughness={0.25}
                />
              </mesh>
            ))}
            {/* Ribbed White Porcelain Cartridge Fuse Body */}
            <mesh raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.02, 0.02, 0.088, 12]} />
              <meshStandardMaterial
                color="#dfd7c2"
                roughness={0.34}
                metalness={0.08}
              />
            </mesh>
            {/* Brass End Ferrule Caps */}
            {[-0.042, 0.042].map((ey, eIdx) => (
              <mesh key={`cap-${eIdx}`} position={[0, ey, 0]} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.022, 0.022, 0.016, 12]} />
                <meshStandardMaterial
                  color="#b8a46b"
                  metalness={0.86}
                  roughness={0.26}
                  bumpMap={brassTex.bumpMap}
                  bumpScale={0.004}
                />
              </mesh>
            ))}
            <CagedSovietJewelLamp3D
              position={[0.055, 0, 0.002]}
              lampMatRef={fuseLampRefs[idx]}
              scale={0.62}
            />
          </group>
        ))}
      </group>

      {/* Upper Sloped Deck: Steam Vent Pull-Lever + 50Hz Turbine Valve Rheostat + Main Knife Breaker */}
      <group position={[0, 1.035, 0.165]} rotation={[-0.406, 0, 0]}>
        {/* 1. Spring-Loaded Steam Relief Lever (`СБРОС ПАРА / БРУ-К`) */}
        <group
          position={[-0.58, 0, 0.015]}
          onPointerOver={(e) => {
            e.stopPropagation();
            useGameStore
              .getState()
              .setHoveredControlHint(
                "STEAM VENT (БРУ-К): Click/Drag or Scroll Up = OPEN (-3 BAR/s)",
              );
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            useGameStore.getState().setHoveredControlHint(null);
          }}
          onWheel={(e: ThreeEvent<WheelEvent>) => {
            if (useCameraLookStore.getState().isFreeLookMode) return;
            e.stopPropagation();
            e.nativeEvent?.stopImmediatePropagation?.();
            const wantOpen = e.deltaY < 0;
            const s = useGameStore.getState();
            if (s.steamDumpValve !== wantOpen) {
              s.setSteamDumpValve(wantOpen);
              steamDragRef.current.progress = wantOpen ? 1.0 : 0;
              playSwitchClank(true);
              if (wantOpen) playSteamVentHiss(0.6);
            }
          }}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            if (useCameraLookStore.getState().isFreeLookMode) return;
            e.stopPropagation();
            const wasOpen = useGameStore.getState().steamDumpValve;
            let dragged = false;
            steamDragRef.current = {
              active: true,
              startY: e.nativeEvent.clientY,
              progress: wasOpen ? 1.0 : 0.35,
              lastHissTime: 0,
            };
            playSwitchClank(true);
            playSteamVentHiss(0.6);
            useGameStore.getState().setSteamDumpValve(!wasOpen);
            const r3fTarget = e.target as unknown as {
              setPointerCapture?: (id: number) => void;
              releasePointerCapture?: (id: number) => void;
            };
            r3fTarget?.setPointerCapture?.(e.pointerId);
            const startY = e.nativeEvent.clientY;
            const onMove = (ev: PointerEvent) => {
              const dy = ev.clientY - startY;
              if (Math.abs(dy) > 6) dragged = true;
              const p = THREE.MathUtils.clamp(
                (wasOpen ? 1.0 - -dy / 70 : dy / 70) || 0,
                0,
                1,
              );
              steamDragRef.current.progress = p;
              const wantOpen = p > 0.45;
              if (useGameStore.getState().steamDumpValve !== wantOpen) {
                useGameStore.getState().setSteamDumpValve(wantOpen);
                playSwitchClank(wantOpen);
              }
            };
            const onUp = () => {
              steamDragRef.current.active = false;
              r3fTarget?.releasePointerCapture?.(e.pointerId);
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
              window.removeEventListener("pointercancel", onUp);
              if (dragged) {
                playSwitchClank(useGameStore.getState().steamDumpValve);
              }
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
            window.addEventListener("pointercancel", onUp);
          }}
        >
          <mesh position={[0, 0.24, 0.006]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.42, 0.105, 0.01]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.85}
              roughness={0.28}
            />
          </mesh>
          <mesh position={[0, 0.24, 0.012]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.406, 0.096]} />
            <meshStandardMaterial
              map={steamPlateTex}
              emissive="#ffffff"
              emissiveMap={steamPlateTex}
              emissiveIntensity={0.38}
              roughness={0.55}
            />
          </mesh>
          <mesh>
            <boxGeometry args={[0.26, 0.3, 0.044]} />
            <meshStandardMaterial
              color="#141816"
              metalness={0.68}
              roughness={0.44}
            />
          </mesh>
          <mesh position={[0, 0, 0.024]}>
            <boxGeometry args={[0.14, 0.23, 0.016]} />
            <meshStandardMaterial color="#090c0a" roughness={0.85} />
          </mesh>
          <group ref={steamLeverArmRef} position={[0, -0.02, 0.025]}>
            {[-0.045, 0.045].map((lx, idx) => (
              <mesh
                key={idx}
                position={[lx, 0, 0.085]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <cylinderGeometry args={[0.011, 0.013, 0.17, 10]} />
                <meshStandardMaterial
                  color="#d0dad4"
                  metalness={0.9}
                  roughness={0.2}
                />
              </mesh>
            ))}
            <mesh
              position={[0, 0, 0.17]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.028, 0.028, 0.18, 14]} />
              <meshStandardMaterial
                color="#ff2a2a"
                emissive="#ff2a2a"
                emissiveIntensity={0.35}
                roughness={0.35}
              />
            </mesh>
            {[-0.045, 0, 0.045].map((hx, idx) => (
              <mesh
                key={idx}
                position={[hx, 0, 0.17]}
                rotation={[0, 0, Math.PI / 2]}
              >
                <cylinderGeometry args={[0.03, 0.03, 0.022, 14]} />
                <meshStandardMaterial color="#ffb000" roughness={0.35} />
              </mesh>
            ))}
          </group>
        </group>

        {/* 2. Rotary Generator Turbine Valve / 50Hz Rheostat Handwheel */}
        <group
          position={[-0.02, 0, 0.015]}
          onPointerOver={(e) => {
            e.stopPropagation();
            const g = useGameStore.getState();
            g.setHoveredDiagnosticId("grid");
            g.setHoveredControlHint(
              "TURBINE STEAM VALVE: Scroll Wheel (+/-5% | Shift +/-1%) or Click/Drag (0-100%)",
            );
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            const g = useGameStore.getState();
            if (g.hoveredDiagnosticId === "grid") g.setHoveredDiagnosticId(null);
            g.setHoveredControlHint(null);
          }}
          onWheel={(e: ThreeEvent<WheelEvent>) => {
            if (useCameraLookStore.getState().isFreeLookMode) return;
            e.stopPropagation();
            e.nativeEvent?.stopImmediatePropagation?.();
            const fine = Boolean(e.shiftKey || e.nativeEvent?.shiftKey);
            const step = (e.deltaY < 0 ? 1 : -1) * (fine ? 0.01 : 0.05);
            const s = useGameStore.getState();
            const curValve = s.turbines[0]?.valve ?? 0;
            const nextValve = THREE.MathUtils.clamp(
              Math.round((curValve + step) * 100) / 100,
              0,
              1,
            );
            if (Math.abs(nextValve - curValve) >= 0.001) {
              playRheostatDetentClick(Math.round(nextValve * 100));
              s.setTurbineSteamValve(nextValve);
            }
          }}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            if (useCameraLookStore.getState().isFreeLookMode) return;
            e.stopPropagation();
            const r3fTarget = e.target as unknown as {
              setPointerCapture?: (id: number) => void;
              releasePointerCapture?: (id: number) => void;
            };
            r3fTarget?.setPointerCapture?.(e.pointerId);

            const startX = e.nativeEvent.clientX;
            const startY = e.nativeEvent.clientY;
            let totalMove = 0;
            let currentVal = useGameStore.getState().turbines[0]?.valve ?? 0;
            let lastDetent = Math.round(currentVal * 100);
            const initVal = currentVal;

            const onMove = (ev: PointerEvent) => {
              const dx = ev.clientX - startX;
              const dy = startY - ev.clientY;
              totalMove = Math.max(totalMove, Math.hypot(dx, dy));
              const nextVal = THREE.MathUtils.clamp(
                Math.round((initVal + (dx + dy) / 180) * 100) / 100,
                0,
                1,
              );
              if (Math.abs(nextVal - currentVal) >= 0.005) {
                currentVal = nextVal;
                const detent = Math.round(currentVal * 100);
                if (detent !== lastDetent) {
                  lastDetent = detent;
                  playRheostatDetentClick(detent);
                }
                useGameStore.getState().setTurbineSteamValve(currentVal);
              }
            };
            const onUp = () => {
              r3fTarget?.releasePointerCapture?.(e.pointerId);
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
              window.removeEventListener("pointercancel", onUp);
              if (totalMove < 6) {
                const s = useGameStore.getState();
                const curV = s.turbines[0]?.valve ?? 0;
                const nextV =
                  curV < 0.14
                    ? 0.15
                    : curV < 0.48
                      ? 0.5
                      : curV < 0.98
                        ? 1.0
                        : 0.0;
                playRheostatDetentClick(Math.round(nextV * 100));
                s.setTurbineSteamValve(nextV);
              }
              playSwitchClank(false);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
            window.addEventListener("pointercancel", onUp);
          }}
        >
          <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.165, 0.165, 0.12, 16]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.24, 0.006]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.45, 0.105, 0.01]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.85}
              roughness={0.28}
            />
          </mesh>
          <mesh position={[0, 0.24, 0.012]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.435, 0.096]} />
            <meshStandardMaterial
              map={rheostatPlateTex}
              emissive="#ffffff"
              emissiveMap={rheostatPlateTex}
              emissiveIntensity={0.35}
              roughness={0.55}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.145, 0.16, 0.048, 18]} />
            <meshStandardMaterial
              color="#141816"
              roughness={0.44}
              metalness={0.68}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          <mesh position={[0, 0, 0.026]} raycast={NOOP_RAYCAST}>
            <circleGeometry args={[0.132, 24]} />
            <meshStandardMaterial
              map={rheostatScaleTex}
              emissive="#ffffff"
              emissiveMap={rheostatScaleTex}
              emissiveIntensity={0.38}
              roughness={0.82}
            />
          </mesh>
          <mesh position={[0, 0, 0.028]} raycast={NOOP_RAYCAST}>
            <torusGeometry args={[0.134, 0.009, 10, 24]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.86}
              roughness={0.26}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          <group ref={rheostatWheelRef} position={[0, 0, 0.048]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.098, 0.112, 0.048, 16]} />
              <meshStandardMaterial
                color="#1e1512"
                roughness={0.38}
                metalness={0.25}
              />
            </mesh>
            <mesh position={[0, 0.048, 0.026]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.02, 0.082, 0.016]} />
              <meshStandardMaterial
                color="#efe8d2"
                emissive="#ffb000"
                emissiveIntensity={0.35}
                roughness={0.3}
              />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.028, 0.03, 0.056, 12]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.88}
                roughness={0.22}
              />
            </mesh>
          </group>
        </group>

        {/* 3. Multi-Part Copper Knife-Switch MAIN BREAKER (`ГЛАВНЫЙ РУБИЛЬНИК`) */}
        <HighDetailKnifeBreaker3D
          breakerArmRef={breakerArmRef}
          breakerDragRef={breakerDragRef}
          breakerPlateTex={breakerPlateTex}
        />
        <SovietBacklitIndicatorBlock3D
          position={[0.56, 0.184, 0.038]}
          label="ТАБЛО СЕТЬ"
          getAlertState={(s) => ({
            level:
              s.isBlackout ||
              !s.turbines[0]?.gridConnected ||
              s.turbines[0]?.tripped
                ? "critical"
                : "normal",
          })}
        />
      </group>

      {/* Lower Sloped Deck Row: 4 Guarded Auxiliary Toggle Switches */}
      <group position={[0, 0.545, 0.376]} rotation={[-0.406, 0, 0]}>
        <mesh position={[0, 0.02, -0.008]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.76, 0.32, 0.024]} />
          <meshStandardMaterial
            color="#222a27"
            roughness={0.45}
            metalness={0.55}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>
        {toggleSpecs.map((tSpec, tIdx) => {
          const triggerToggle = () => {
            playSwitchClank(false);
            const s = useGameStore.getState();
            if (tIdx === 0) {
              s.toggleVentilation();
            } else if (tIdx === 1) {
              s.toggleMusicMute();
            } else if (tIdx === 2) {
              s.toggleKgbLine();
            } else {
              s.resetTurbineTrip();
            }
          };
          return (
            <group
              key={`aux-toggle-${tSpec.id}`}
              position={[-0.6 + tIdx * 0.4, -0.02, 0.018]}
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
                toggleDragIdxRef.current = tIdx;
                (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
              }}
              onPointerUp={(e: ThreeEvent<PointerEvent>) => {
                if (toggleDragIdxRef.current !== tIdx) return;
                e.stopPropagation();
                toggleDragIdxRef.current = null;
                (e.target as Element | null)?.releasePointerCapture?.(
                  e.pointerId,
                );
                triggerToggle();
              }}
            >
              <mesh position={[0, 0.112, 0.004]}>
                <boxGeometry args={[0.33, 0.098, 0.008]} />
                <meshStandardMaterial
                  color="#b8a46b"
                  metalness={0.85}
                  roughness={0.28}
                />
              </mesh>
              <mesh position={[0, 0.112, 0.01]}>
                <planeGeometry args={[0.318, 0.09]} />
                <meshStandardMaterial
                  map={tSpec.texture}
                  emissive="#ffffff"
                  emissiveMap={tSpec.texture}
                  emissiveIntensity={0.36}
                  roughness={0.65}
                />
              </mesh>
              <CagedSovietJewelLamp3D
                position={[-0.088, 0.0, 0.012]}
                lampMatRef={toggleLampRefs[tIdx]}
                scale={0.78}
              />
              <mesh rotation={[Math.PI / 2, 0, 0]}>
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
                <mesh key={gIdx} position={[gx, 0, 0.02]}>
                  <boxGeometry args={[0.007, 0.068, 0.038]} />
                  <meshStandardMaterial
                    color="#b8a46b"
                    metalness={0.85}
                    roughness={0.28}
                  />
                </mesh>
              ))}
              <group ref={toggleBatRefs[tIdx]} position={[0, 0, 0.012]}>
                <mesh
                  position={[0, 0, 0.03]}
                  rotation={[Math.PI / 2, 0, 0]}
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
    </group>
  );
});

/**
 * 3D Overhead Bulkhead Telemetry Board & 3D Camera Station Selector Rail
 */
const BunkerTelemetryAndControlRail3D: React.FC = React.memo(() => {
  const lastRightDrawRef = useRef(0);
  const lastThrottleDrawRef = useRef(-1);
  const rightStatusMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lastThrottleMwRef = useRef(-1);
  const prevXenonRef = useRef(0);
  const xenonBurningRef = useRef(false);

  const batteryNeedleRef = useRef<THREE.Object3D | null>(null);
  const batteryLampDischargeRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const batteryLampSyncRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const batteryMwBarRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const batteryBankSegRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const throttleReadoutTexRef = useRef<THREE.CanvasTexture | null>(null);

  const batteryGridGltf = useGLTF("./models/battery_grid_panel.glb");

  const batteryGridBundle = useMemo(() => {
    const root = batteryGridGltf.scene.clone(true);
    const glassNames = new Set([
      "Readout_Window_Glass",
      "HV_GlassWindow",
      "Dial_Glass",
      "Bank_A_GlassCover",
      "Bank_B_GlassCover",
    ]);

    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.raycast = NOOP_RAYCAST;
      obj.castShadow = false;
      obj.receiveShadow = false;
      const mat = obj.material;
      const isGlass =
        glassNames.has(obj.name) ||
        (mat instanceof THREE.Material && mat.transparent);
      if (isGlass && mat instanceof THREE.MeshStandardMaterial) {
        const gMat = mat.clone();
        gMat.depthWrite = false;
        gMat.transparent = true;
        gMat.opacity = Math.min(gMat.opacity || 0.14, 0.14);
        obj.material = gMat;
      }
    });

    const cloneDynamicMat = (name: string): THREE.MeshStandardMaterial | null => {
      const obj = root.getObjectByName(name);
      if (
        !(obj instanceof THREE.Mesh) ||
        !(obj.material instanceof THREE.MeshStandardMaterial)
      ) {
        return null;
      }
      const clonedMat = obj.material.clone();
      obj.material = clonedMat;
      return clonedMat;
    };

    const bankSegMats = [
      ...Array.from({ length: 5 }, (_, i) => cloneDynamicMat(`BankA_Seg_${i + 1}`)),
      ...Array.from({ length: 5 }, (_, i) => cloneDynamicMat(`BankB_Seg_${i + 1}`)),
    ];
    const mwBarMats = Array.from({ length: 10 }, (_, i) =>
      cloneDynamicMat(`MW_Bar_${String(i + 1).padStart(2, "0")}`),
    );
    const lampDischargeMat = cloneDynamicMat("Lamp_Discharge");
    const lampGridSyncMat = cloneDynamicMat("Lamp_GridSync");

    const readoutTex = createNearestCanvasTexture(192, 92, (ctx, w, h) => {
      ctx.fillStyle = "#08120c";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#2b7a44";
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = "#33ff66";
      ctx.font = 'bold 46px "VT323", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("0 MW", w / 2, h / 2 + 2);
    });
    readoutTex.flipY = false;

    const screenMeshRaw = root.getObjectByName("MW_Readout_Screen");
    if (screenMeshRaw instanceof THREE.Mesh) {
      screenMeshRaw.castShadow = false;
      screenMeshRaw.receiveShadow = false;
      screenMeshRaw.material = new THREE.MeshStandardMaterial({
        color: "#ffffff",
        map: readoutTex,
        emissive: new THREE.Color("#ffffff"),
        emissiveMap: readoutTex,
        emissiveIntensity: 0.95,
        roughness: 0.35,
        metalness: 0.05,
      });
    }
    const needleObj = root.getObjectByName("Center_Load_Needle") ?? null;

    return {
      root,
      bankSegMats,
      mwBarMats,
      lampDischargeMat,
      lampGridSyncMat,
      readoutTex,
      needleObj,
    };
  }, [batteryGridGltf.scene]);

  useEffect(() => {
    batteryNeedleRef.current = batteryGridBundle.needleObj;
    batteryLampDischargeRef.current = batteryGridBundle.lampDischargeMat;
    batteryLampSyncRef.current = batteryGridBundle.lampGridSyncMat;
    batteryMwBarRefs.current = batteryGridBundle.mwBarMats;
    batteryBankSegRefs.current = batteryGridBundle.bankSegMats;
    throttleReadoutTexRef.current = batteryGridBundle.readoutTex;
    return () => {
      throttleReadoutTexRef.current = null;
    };
  }, [batteryGridBundle]);

  const rightPanelGroupRef = useRef<THREE.Group>(null);
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

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
        "ENERGY STORAGE & GRID DISPATCH // UNIT C",
        "ENERGY CREATED  •  BATTERY STORED  •  GRID DEMAND  •  AUTO ZONE BUSBARS",
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

  useFrame(({ clock }, dt) => {
    const s = useGameStore.getState();
    const t = clock.getElapsedTime();

    // 1. Animate 3D Blender Battery-Grid Panel Needle, Pilot Lamps, 10-Bar Column & VFD Readout
    const valveRatio = s.isBlackout ? 0 : s.batteryOutputValve;
    const dispatchedMWNow = s.isBlackout
      ? 0
      : Math.round(
          s.totalElectricalMW > 0 ? s.totalElectricalMW : valveRatio * 1000,
        );

    if (batteryNeedleRef.current) {
      const normLoad = THREE.MathUtils.clamp(dispatchedMWNow / 1000, 0, 1);
      const baseAngle = THREE.MathUtils.lerp(Math.PI / 3, -Math.PI / 3, normLoad);
      const tremor =
        dispatchedMWNow > 0 && !s.isBlackout ? Math.sin(t * 31) * 0.004 : 0;
      batteryNeedleRef.current.rotation.z = THREE.MathUtils.damp(
        batteryNeedleRef.current.rotation.z,
        baseAngle + tremor,
        12,
        dt,
      );
    }

    if (batteryLampDischargeRef.current) {
      const lm = batteryLampDischargeRef.current;
      const netDrain = !s.isBlackout && s.energyCreatedMW < dispatchedMWNow - 15;
      if (s.isBlackout) {
        lm.color.copy(SCENE_COLOR_BAT_DISCHARGE_OFF);
        lm.emissive.copy(SCENE_COLOR_BLACK);
        lm.emissiveIntensity = 0.04;
      } else if (netDrain) {
        const pulse = (Math.sin(t * 5.2) + 1) * 0.5;
        lm.color.copy(SCENE_COLOR_ORANGE);
        lm.emissive.copy(SCENE_COLOR_ORANGE);
        lm.emissiveIntensity = 1.4 + pulse * 0.7;
      } else if (dispatchedMWNow > 0) {
        lm.color.copy(SCENE_COLOR_ORANGE);
        lm.emissive.copy(SCENE_COLOR_ORANGE);
        lm.emissiveIntensity = 0.65;
      } else {
        lm.color.copy(SCENE_COLOR_BAT_DISCHARGE_IDLE);
        lm.emissive.copy(SCENE_COLOR_BAT_DISCHARGE_IDLE_EM);
        lm.emissiveIntensity = 0.12;
      }
    }

    if (batteryLampSyncRef.current) {
      const gm = batteryLampSyncRef.current;
      const synced =
        !s.isBlackout &&
        Math.abs(dispatchedMWNow - s.energyDemandMW) <= 35 &&
        dispatchedMWNow > 0;
      if (s.isBlackout) {
        gm.color.copy(SCENE_COLOR_BAT_SYNC_OFF);
        gm.emissive.copy(SCENE_COLOR_BLACK);
        gm.emissiveIntensity = 0.04;
      } else if (synced) {
        gm.color.copy(SCENE_COLOR_GREEN);
        gm.emissive.copy(SCENE_COLOR_GREEN);
        gm.emissiveIntensity = 1.65;
      } else {
        gm.color.copy(SCENE_COLOR_BAT_SYNC_IDLE);
        gm.emissive.copy(SCENE_COLOR_BAT_SYNC_IDLE_EM);
        gm.emissiveIntensity = 0.12;
      }
    }

    for (let seg = 0; seg < 10; seg++) {
      const ledMat = batteryMwBarRefs.current[seg];
      if (!ledMat) continue;
      const segThreshold = (seg + 1) * 100;
      const isLit = !s.isBlackout && dispatchedMWNow >= segThreshold - 50;
      const segCol =
        seg >= 8
          ? SCENE_COLOR_RED
          : seg >= 6
            ? SCENE_COLOR_AMBER
            : SCENE_COLOR_GREEN;
      ledMat.color.copy(isLit ? segCol : SCENE_COLOR_OFF_DARK);
      ledMat.emissive.copy(isLit ? segCol : SCENE_COLOR_BLACK);
      ledMat.emissiveIntensity = isLit ? 1.55 : 0.04;
    }

    // 2. Animate 10 Accumulator Charge Bars across Bank A (0-50%) & Bank B (55-100%)
    const chargePct = s.batteryStoredPct;
    const chargeCol =
      chargePct < 15
        ? SCENE_COLOR_RED
        : chargePct < 30
          ? SCENE_COLOR_AMBER
          : SCENE_COLOR_GREEN;
    for (let i = 0; i < 10; i++) {
      const barMat = batteryBankSegRefs.current[i];
      if (!barMat) continue;
      const threshold = (i + 1) * 10 - 5;
      const isLit = !s.isBlackout && chargePct >= threshold;
      barMat.color.copy(isLit ? chargeCol : SCENE_COLOR_OFF_DARK);
      barMat.emissive.copy(isLit ? chargeCol : SCENE_COLOR_BLACK);
      barMat.emissiveIntensity = isLit ? 1.4 : 0.05;
    }

    // Pause background canvas telemetry redraws while K.O.M.R.A.D.-84 easter egg video is playing
    if (s.diagFeedActive) return;

    if (
      dispatchedMWNow !== lastThrottleMwRef.current &&
      (lastThrottleDrawRef.current < 0 || t - lastThrottleDrawRef.current >= 0.08)
    ) {
      lastThrottleDrawRef.current = t;
      lastThrottleMwRef.current = dispatchedMWNow;
      const rdTex = throttleReadoutTexRef.current;
      const rdCanvas = rdTex?.image as HTMLCanvasElement | undefined;
      const rdCtx = rdCanvas?.getContext("2d");
      if (rdTex && rdCanvas && rdCtx) {
        rdCtx.fillStyle = "#08120c";
        rdCtx.fillRect(0, 0, rdCanvas.width, rdCanvas.height);
        rdCtx.strokeStyle = "#2b7a44";
        rdCtx.lineWidth = 3;
        rdCtx.strokeRect(2, 2, rdCanvas.width - 4, rdCanvas.height - 4);
        rdCtx.fillStyle = s.isBlackout
          ? "#552222"
          : dispatchedMWNow >= 850
            ? "#ffb000"
            : "#33ff66";
        rdCtx.font = 'bold 46px "VT323", monospace';
        rdCtx.textAlign = "center";
        rdCtx.textBaseline = "middle";
        rdCtx.fillText(
          `${dispatchedMWNow} MW`,
          rdCanvas.width / 2,
          rdCanvas.height / 2 + 2,
        );
        rdTex.needsUpdate = true;
      }
    }

    // Update UNIT C Master Overview Dashboard (`CRT-84C`, 1024x208) — throttled to ~13 FPS (0.075s)
    if (lastRightDrawRef.current > 0 && t - lastRightDrawRef.current < 0.075) return;
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
      { x: 0, y: 1.055, w: 1.84, h: 0.44 },
    ],
    [],
  );

  return (
    <>
      {/* ============================================================
          3. RIGHT CONSOLE BAY: UNIT C (BATTERY - GRID AUTO TELEMETRY)
         ============================================================ */}
      <group
        ref={rightPanelGroupRef}
        position={[3.22, 0, -1.16]}
        rotation={[0, -(15 * Math.PI) / 180, 0]}
      >
        <group position={[-0.74, 0.18, 0.08]} rotation={[-0.51, 0, 0]} scale={0.74}>
        {/* Authentic Layered Soviet RBMK Blue-Grey / Olive-Grey Modular Steel Cabinet (`#485450`),
            Upper Canopy Overhang with 6 `ТАБЛО` Annunciator Lamps, Console Ledge & Synoptic Mimic Lines */}
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

        {/* Heavy Stepped Bevel Plates, Welded Seams, Corner L-Angle Iron Trim & Hex Bolts */}
        <mesh position={[-1.0, 1.18, 0.032]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.042, 2.40, 0.036]} />
          <meshStandardMaterial
            color="#1e2422"
            metalness={0.7}
            roughness={0.42}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        <mesh position={[1.0, 1.18, 0.032]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.042, 2.40, 0.036]} />
          <meshStandardMaterial
            color="#1e2422"
            metalness={0.7}
            roughness={0.42}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        {[0.32, 0.76, 1.28, 1.64, 2.04].map((by, bIdx) => (
          <group key={bIdx}>
            <mesh
              position={[-1.0, by, 0.054]}
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
              position={[1.0, by, 0.054]}
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

        {/* Top Riveted Header Plaque: Clear of overhead canopy overhang */}
        <mesh position={[0, 2.095, 0.044]} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[1.58, 0.138]} />
          <meshStandardMaterial
            map={rightHeaderPlateTex}
            emissive="#ffffff"
            emissiveMap={rightHeaderPlateTex}
            emissiveIntensity={0.35}
            roughness={0.75}
          />
        </mesh>

        {/* Corner Gusset Plates & Overhead Hooded Panel Work-Lights */}
        {(
          [
            [-0.93, 2.32],
            [0.93, 2.32],
            [-0.93, 0.14],
            [0.93, 0.14],
          ] as const
        ).map(([gx, gy], gIdx) => (
          <group key={gIdx} position={[gx, gy, 0.032]}>
            <mesh raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.14, 0.14, 0.016]} />
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
                [-0.044, 0.044],
                [0.044, 0.044],
                [-0.044, -0.044],
                [0.044, -0.044],
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
                color="#ffcf75"
                emissive="#ffaa33"
                emissiveIntensity={1.6}
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

        {/* High-Mounted Sloped Deck Row (Raised cleanly ABOVE Inspector Desk Occlusion Shadow!) */}
        <group position={[0, 1.055, 0.152]} rotation={[-0.406, 0, 0]}>
          {/* Matte Steel Backing Plate for Energy Storage Deck */}
          <mesh position={[0, 0.01, -0.01]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.82, 0.44, 0.022]} />
            <meshStandardMaterial
              color="#1e2723"
              roughness={0.48}
              metalness={0.55}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>

          {/* High-Detail 3D Blender Battery-Grid Accumulator & Automatic Zone Telemetry Bay */}
          <group
            onPointerOver={(e) => {
              e.stopPropagation();
              const g = useGameStore.getState();
              g.setHoveredDiagnosticId("grid");
              g.setHoveredControlHint(
                "BATTERY - GRID AUTO TELEMETRY (0–1000 MW): Copper busbars automatically discharge Banks A & B to supply active Unit A substation levers",
              );
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              const g = useGameStore.getState();
              if (g.hoveredDiagnosticId === "grid") {
                g.setHoveredDiagnosticId(null);
              }
              g.setHoveredControlHint(null);
            }}
          >
            {/* Lightweight 12-triangle hit proxy replacing raycasting on 30+ high-poly GLB meshes */}
            <mesh position={[0, 0.015, 0.04]}>
              <boxGeometry args={[1.76, 0.42, 0.09]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            <primitive
              object={batteryGridBundle.root}
              position={[0, 0.015, 0.032]}
              scale={[1.28, 0.9, 1.0]}
            />
          </group>
        </group>

        {/* Non-Interactive Bolted Lower Access Service Apron (Cleanly occupies lower desk-shadow skirt) */}
        <group position={[0, 0.62, 0.34]} rotation={[-0.406, 0, 0]}>
          {[-0.46, 0.46].map((ax, aIdx) => (
            <group key={`apron-bay-${aIdx}`} position={[ax, 0, 0.008]}>
              <mesh raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.82, 0.30, 0.018]} />
                <meshStandardMaterial
                  color="#1b2320"
                  metalness={0.62}
                  roughness={0.5}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.006}
                />
              </mesh>
              {[-0.08, -0.025, 0.03, 0.085].map((ly, lIdx) => (
                <mesh
                  key={`louver-${lIdx}`}
                  position={[0, ly, 0.01]}
                  raycast={NOOP_RAYCAST}
                >
                  <boxGeometry args={[0.64, 0.016, 0.008]} />
                  <meshStandardMaterial
                    color="#121816"
                    metalness={0.55}
                    roughness={0.58}
                  />
                </mesh>
              ))}
              {(
                [
                  [-0.37, 0.12],
                  [0.37, 0.12],
                  [-0.37, -0.12],
                  [0.37, -0.12],
                ] as const
              ).map(([bx, by], bIdx) => (
                <mesh
                  key={`apron-bolt-${bIdx}`}
                  position={[bx, by, 0.012]}
                  rotation={[Math.PI / 2, 0, 0]}
                  raycast={NOOP_RAYCAST}
                >
                  <cylinderGeometry args={[0.009, 0.009, 0.008, 6]} />
                  <meshStandardMaterial
                    color="#b8a46b"
                    metalness={0.85}
                    roughness={0.28}
                  />
                </mesh>
              ))}
            </group>
          ))}
        </group>
        </group>
      </group>

      {/* 4. MONUMENTAL 3D BOLTED OLIVE-STEEL MASTER PROJECTION FRAME FOR K.O.M.R.A.D.-84 (~3.84m × 2.30m) */}
      <group
        position={TERMINAL_ROOT_POS}
        rotation={[TERMINAL_TILT_X, 0, 0]}
        scale={TERMINAL_SCALE}
      >
        <primitive object={terminalHousingModel} />
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
            {/* Lower Corner Hazard Striping Cheek */}
            <mesh position={[0, -0.52, 0.135]} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.125, 0.26]} />
              <meshStandardMaterial map={crtHazardTex} roughness={0.5} />
            </mesh>
          </group>
        ))}

        {/* Top Overhanging Olive-Steel Glare Hood (`y = 2.44m` local) */}
        <mesh position={[0, 2.44, 0.16]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.7, 0.08, 0.32]} />
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

        {/* Bottom Heavy Bevel Apron With Cooling Louvers & Hazard Striping */}
        <mesh position={[0, 0.99, 0.12]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.7, 0.14, 0.28]} />
          <meshStandardMaterial
            color="#26362d"
            metalness={0.62}
            roughness={0.46}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        {([-1.06, 1.06] as const).map((hx, hIdx) => (
          <mesh key={`crt-bot-haz-${hIdx}`} position={[hx, 0.99, 0.264]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.52, 0.095]} />
            <meshStandardMaterial map={crtHazardTex} roughness={0.5} />
          </mesh>
        ))}
        {[-0.45, 0, 0.45].map((gx, gIdx) => (
          <group key={`crt-bot-louver-${gIdx}`} position={[gx, 0.99, 0.264]}>
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
        color="#d8ba8c"
        size={0.01}
        transparent
        opacity={0.17}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
});

const DynamicBunkerLighting: React.FC = React.memo(() => {
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);
  const bunkerMainLightRef = useRef<THREE.PointLight>(null);
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

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const state = useGameStore.getState();
    const {
      coreTemp,
      powerAllocation,
      maxSafePower,
      isBlackout,
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
      isBlackout,
    );

    // Room Voltage Dip Brownout Flicker (25%-45% dip with 50Hz hum flicker when pulling MW levers or gridHz sags)
    const hzSag = Math.max(0, 49.7 - state.gridHz) * 0.45;
    const dipStrength = Math.min(1, state.voltageDipIntensity + hzSag);
    const humFlicker =
      dipStrength > 0.02
        ? 1 -
          dipStrength *
            (0.32 + 0.14 * Math.sin(t * 62.8) * Math.cos(t * 94.2))
        : 1.0;

    if (hemiLightRef.current) {
      hemiLightRef.current.intensity = isBlackout ? 0.18 : 0.95 * humFlicker;
    }

    if (bunkerMainLightRef.current) {
      if (isBlackout) {
        bunkerMainLightRef.current.color.copy(SCENE_COLOR_MAIN_LIGHT_BLACKOUT);
        bunkerMainLightRef.current.intensity = 0.6;
      } else if (isAlarmActive) {
        const wave = (Math.sin(t * 9.0) + 1) * 0.5;
        bunkerMainLightRef.current.color.lerpColors(
          SCENE_COLOR_MAIN_LIGHT_NORM,
          SCENE_COLOR_RED,
          0.35 + 0.55 * wave,
        );
        bunkerMainLightRef.current.intensity = (3.6 + wave * 2.2) * humFlicker;
      } else {
        bunkerMainLightRef.current.color.copy(SCENE_COLOR_MAIN_LIGHT_NORM);
        bunkerMainLightRef.current.intensity = 4.2 * humFlicker;
      }
    }

    if (deskSpotRef.current) {
      if (isBlackout || powerAllocation.facility <= 0) {
        deskSpotRef.current.intensity = 0;
      } else if (powerAllocation.facility <= 10) {
        const heavyFlicker =
          Math.sin(t * 37) * 0.35 + Math.cos(t * 63) * 0.25 > 0.1 ? 0.2 : 0.95;
        deskSpotRef.current.intensity = 1.9 * heavyFlicker * humFlicker;
      } else if (powerAllocation.facility <= 20) {
        const subtleFlicker = 0.88 + Math.sin(t * 24) * 0.12;
        deskSpotRef.current.intensity = 2.8 * subtleFlicker * humFlicker;
      } else {
        const boost = Math.min(1.35, powerAllocation.facility / 30);
        deskSpotRef.current.intensity = 3.2 * boost * humFlicker;
      }
    }

    if (klaxonSpinnerRef.current && isAlarmActive) {
      klaxonSpinnerRef.current.rotation.y = t * 5.5;
    }
    if (klaxonLampMatRef.current) {
      klaxonLampMatRef.current.emissiveIntensity = isAlarmActive
        ? 1.4 + Math.sin(t * 9.0) * 0.8
        : 0.05;
    }
  });

  return (
    <>
      {/* Consolidated 3 Un-Shadowed Scene Lights (castShadow={false}, never toggled invisible) */}
      {/* 1. Institutional Warm-Ceiling / Terracotta-Floor Hemisphere Fill */}
      <hemisphereLight
        ref={hemiLightRef}
        args={["#fff1d6", "#4a3c32", 0.95]}
      />

      {/* 2. Central Bunker Overhead Fill & Redline Klaxon Wash PointLight */}
      <pointLight
        ref={bunkerMainLightRef}
        castShadow={false}
        position={[0, 3.35, -0.75]}
        color="#ffe2ba"
        intensity={4.2}
        distance={18.0}
        decay={0.85}
      />

      {/* 3. Overhead SpotLight centered over Shift Supervisor Desk at `z = +1.80` */}
      <group position={[0, 0, 1.8]}>
        <object3D ref={deskSpotTargetRef} position={[0, 0.7, 0]} />
        <spotLight
          ref={deskSpotRef}
          castShadow={false}
          position={[0, 2.7, 0.08]}
          angle={0.76}
          penumbra={0.85}
          intensity={3.6}
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

const KOMRAD_DARK_HUMOR_BULLETINS: readonly string[] = [
  "REMINDER: MELTDOWN IS CAPITALIST PROPAGANDA. KEEP VODKA DISTILLERY AT 40% WATER FLOW.",
  "COMMISSAR VOLKOV: IF THE POLITBURO VODKA BATCH TASTES LIKE GRAPHITE, YOU RIDE THE NEXT TRAIN TO VORKUTA.",
  "BULLETIN: SOVIET ATOMS SPLIT 14% MORE PATRIOTICALLY THAN AMERICAN ATOMS.",
  "WATER NOTICE: PRIPYAT RESERVOIR IS 98% H2O AND 2% PROLETARIAN DETERMINATION.",
  "ALERT TO INSPECTOR OLEG: STAMP GENUINE DIRECTIVES [ОДОБРЕНО] AND DROP THEM IN THE LEFT PNEUMATIC TUBE!",
  "DUGA RADAR REPORT: NO WESTERN MISSILES DETECTED. ONLY 400 FLOCKS OF CONFUSED GEESE.",
  "RED OCTOBER VODKA MILL: DISTILLATION REQUIREMENT IS STRICTLY 40% RESERVOIR LEVEL. DO NOT BOIL IT ALL IN THE CORE!",
  "THERMODYNAMIC TIP: USE UNIT B HELIUM-N2 GAS LOOP AT 45 BAR TO SAVE RESERVOIR WATER FOR VODKA PRODUCTION.",
  "CANTEEN NOTICE: TUESDAY'S BORSCHT HAS BEEN POSTPONED UNTIL THE NEXT FIVE-YEAR PLAN.",
  "MEMO 88-V: ANY OPERATOR CAUGHT YAWNING WILL BE VOLUNTEERED FOR BIO-SHIELD ROOF SWEEPING.",
  "STAKHANOVITE BULLETIN: REACTOR NO. 4 IS OFFICIALLY SAFER THAN A MOSCOW KINDERGARTEN.",
  "BUBBLER POOL NOTICE: PULL UNIT B DRAIN LEVER WHEN BUBBLER EXCEEDS 70% TO RECYCLE CONDENSATE INTO THE RESERVOIR!",
];

function paintDiagOverlayStatic(
  canvas: HTMLCanvasElement,
  drawX: number,
  drawY: number,
  drawW: number,
  drawH: number,
): void {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, w, h);

  // Solid opaque letterbox/pillarbox bars outside video rectangle
  ctx.fillStyle = "#020804";
  if (drawY > 0) ctx.fillRect(0, 0, w, drawY);
  if (drawY + drawH < h) ctx.fillRect(0, drawY + drawH, w, h - (drawY + drawH));
  if (drawX > 0) ctx.fillRect(0, drawY, drawX, drawH);
  if (drawX + drawW < w) ctx.fillRect(drawX + drawW, drawY, w - (drawX + drawW), drawH);

  // Subtle CRT scanlines across the 1600x1000 display
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  for (let y = 0; y < h; y += 6) {
    ctx.fillRect(0, y, w, 2);
  }

  // Outer phosphor frame
  ctx.strokeStyle = "rgba(57, 255, 20, 0.55)";
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, w - 12, h - 12);

  // Minimalist emerald phosphor header bar + divider + static channel title
  ctx.fillStyle = "rgba(2, 10, 4, 0.88)";
  ctx.fillRect(8, 8, w - 16, 40);
  ctx.strokeStyle = "#1e6b34";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, 48);
  ctx.lineTo(w - 8, 48);
  ctx.stroke();

  ctx.font = '700 22px "Consolas", "Lucida Console", monospace';
  ctx.textAlign = "left";
  drawHeavyCrtText(
    ctx,
    "КАНАЛ АЗ-5 // СЛУЖЕБНЫЙ ЭФИР",
    24,
    36,
    "#39ff14",
    0.85,
    900,
  );
}

const Komrad84SplitScreenCrt3D: React.FC<{
  bulletinIdx: number;
  onCycleBulletin: () => void;
}> = React.memo(({ bulletinIdx, onCycleBulletin }) => {
  const crtMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const diagOverlayMeshRef = useRef<THREE.Mesh>(null);
  const lastCrtDrawRef = useRef(0);
  const lastDiagGlitchTickRef = useRef(-1);
  const diagVideoTexRef = useRef<THREE.VideoTexture | null>(null);
  const crtTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const crtDiagOverlayTexRef = useRef<THREE.CanvasTexture | null>(null);
  const lastDiagDimsRef = useRef("");
  const lastDiagSecRef = useRef(-1);

  const crtDiagOverlayTex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1000;
    paintDiagOverlayStatic(canvas, 0, 50, 1600, 900);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 1;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  const crtTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    // 1:1 native 1600x1000 resolution for razor-sharp MacBook Retina phosphor text
    canvas.width = 1600;
    canvas.height = 1000;
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.anisotropy = 1;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const curvedCrtGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(2.4, 1.38, 18, 14);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / 1.2;
      const y = pos.getY(i) / 0.69;
      const r2 = x * x + y * y;
      const bulge = Math.max(0, 1 - r2 * 0.42) * 0.032;
      pos.setZ(i, bulge);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  useEffect(() => {
    crtTextureRef.current = crtTexture;
    crtDiagOverlayTexRef.current = crtDiagOverlayTex;
    return () => {
      crtTextureRef.current = null;
      crtDiagOverlayTexRef.current = null;
      diagVideoTexRef.current?.dispose();
      diagVideoTexRef.current = null;
      crtDiagOverlayTex.dispose();
      crtTexture.dispose();
      curvedCrtGeometry.dispose();
    };
  }, [crtDiagOverlayTex, crtTexture, curvedCrtGeometry]);

  useFrame(({ clock }) => {
    const activeCrtTex = crtTextureRef.current;
    const activeOverlayTex = crtDiagOverlayTexRef.current;
    if (!activeCrtTex || !activeOverlayTex) return;

    const now = clock.getElapsedTime();
    const state = useGameStore.getState();

    if (state.diagFeedActive) {
      const vid = getSkalaDiagFeedElement();
      const syncing = isSkalaDiagFeedSyncing();

      if (syncing || !vid || vid.readyState < 2) {
        if (diagOverlayMeshRef.current?.visible) {
          diagOverlayMeshRef.current.visible = false;
        }
        if (crtMatRef.current && crtMatRef.current.map !== activeCrtTex) {
          crtMatRef.current.map = activeCrtTex;
          crtMatRef.current.emissiveMap = activeCrtTex;
          crtMatRef.current.needsUpdate = true;
        }
        const elapsedMs = Math.max(
          0,
          performance.now() - getSkalaDiagFeedStartMs(),
        );
        // Cap sync glitch canvas uploads to 24 FPS (~42ms)
        const tick = Math.floor(elapsedMs / 42);
        if (tick === lastDiagGlitchTickRef.current) return;
        lastDiagGlitchTickRef.current = tick;
        lastCrtDrawRef.current = 0;
        activeCrtTex.userData.lastSig = "";

        const canvas = activeCrtTex.image as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const w = 1600;
        const h = 1000;
        ctx.save();
        ctx.scale(canvas.width / w, canvas.height / h);
        ctx.fillStyle = "#020804";
        ctx.fillRect(0, 0, w, h);

        // 250ms Phosphor Sync Glitch & Horizontal Hold Interference Bars
        for (let i = 0; i < 28; i++) {
          const bandY = (tick * 137 + i * 71) % h;
          const bandH = 4 + ((i * 19 + tick * 7) % 18);
          ctx.fillStyle =
            i % 5 === 0
              ? "rgba(57, 255, 20, 0.32)"
              : "rgba(18, 96, 40, 0.28)";
          ctx.fillRect(0, bandY, w, bandH);
        }
        for (let s = 0; s < 140; s++) {
          const sx = (s * 263 + tick * 191) % (w - 40);
          const sy = (s * 179 + tick * 89) % h;
          const sw = 12 + ((s * 29) % 72);
          ctx.fillStyle = "rgba(57, 255, 20, 0.24)";
          ctx.fillRect(sx, sy, sw, 3);
        }

        ctx.fillStyle = "rgba(3, 18, 8, 0.9)";
        ctx.fillRect(340, 420, 920, 150);
        ctx.strokeStyle = "#39ff14";
        ctx.lineWidth = 4;
        ctx.strokeRect(340, 420, 920, 150);

        ctx.font = '700 38px "Consolas", "Lucida Console", monospace';
        ctx.textAlign = "center";
        drawHeavyCrtText(
          ctx,
          "[ПРОТОКОЛ АЗ-5 // ПЕРЕХВАТ КАНАЛА]",
          w / 2,
          508,
          "#39ff14",
          0.9,
          880,
        );
        ctx.restore();
        activeCrtTex.needsUpdate = true;
        return;
      }

      // Bind HTMLVideoElement directly via THREE.VideoTexture (zero 1600x1000 2D canvas drawImage copies!)
      let vTex = diagVideoTexRef.current;
      if (!vTex || vTex.image !== vid) {
        vTex?.dispose();
        vTex = new THREE.VideoTexture(vid);
        vTex.minFilter = THREE.LinearFilter;
        vTex.magFilter = THREE.LinearFilter;
        vTex.generateMipmaps = false;
        vTex.colorSpace = THREE.SRGBColorSpace;
        vTex.wrapS = THREE.ClampToEdgeWrapping;
        vTex.wrapT = THREE.ClampToEdgeWrapping;
        diagVideoTexRef.current = vTex;
        lastDiagDimsRef.current = "";
      }

      const vw = vid.videoWidth || 1280;
      const vh = vid.videoHeight || 720;
      const dimsKey = `${vw}x${vh}`;
      if (dimsKey !== lastDiagDimsRef.current) {
        lastDiagDimsRef.current = dimsKey;
        const fit = Math.min(1600 / vw, 900 / vh);
        const drawW = Math.round(vw * fit);
        const drawH = Math.round(vh * fit);
        const drawX = Math.round((1600 - drawW) / 2);
        const drawY = Math.round(50 + (900 - drawH) / 2);

        const rw = drawW / 1600;
        const rh = drawH / 1000;
        const u0 = drawX / 1600;
        const v0 = (1000 - (drawY + drawH)) / 1000;
        vTex.repeat.set(1 / rw, 1 / rh);
        vTex.offset.set(-u0 / rw, -v0 / rh);

        const overlayCanvas = activeOverlayTex.image as HTMLCanvasElement;
        paintDiagOverlayStatic(overlayCanvas, drawX, drawY, drawW, drawH);
        activeOverlayTex.needsUpdate = true;
        lastDiagSecRef.current = -1;
      }

      if (crtMatRef.current && crtMatRef.current.map !== vTex) {
        crtMatRef.current.map = vTex;
        crtMatRef.current.emissiveMap = vTex;
        crtMatRef.current.needsUpdate = true;
      }
      if (diagOverlayMeshRef.current && !diagOverlayMeshRef.current.visible) {
        diagOverlayMeshRef.current.visible = true;
      }

      const curSec = Math.max(0, Math.floor(vid.currentTime || 0));
      if (curSec !== lastDiagSecRef.current) {
        lastDiagSecRef.current = curSec;
        const overlayCanvas = activeOverlayTex.image as HTMLCanvasElement;
        const oCtx = overlayCanvas.getContext("2d");
        if (oCtx) {
          const mm = String(Math.floor(curSec / 60)).padStart(2, "0");
          const ss = String(curSec % 60).padStart(2, "0");
          oCtx.fillStyle = "#020804";
          oCtx.fillRect(1350, 10, 238, 36);
          oCtx.font = '700 22px "Consolas", "Lucida Console", monospace';
          oCtx.textAlign = "right";
          drawHeavyCrtText(
            oCtx,
            `${mm}:${ss}`,
            1600 - 24,
            36,
            "#39ff14",
            0.85,
            200,
          );
          activeOverlayTex.needsUpdate = true;
        }
      }
      return;
    }

    // Normal telemetry mode: restore crtTexture & hide overlay if returning from video mode
    lastDiagGlitchTickRef.current = -1;
    if (diagOverlayMeshRef.current?.visible) {
      diagOverlayMeshRef.current.visible = false;
    }
    if (crtMatRef.current && crtMatRef.current.map !== activeCrtTex) {
      crtMatRef.current.map = activeCrtTex;
      crtMatRef.current.emissiveMap = activeCrtTex;
      crtMatRef.current.needsUpdate = true;
      activeCrtTex.userData.lastSig = "";
      lastCrtDrawRef.current = 0;
    }
    if (diagVideoTexRef.current) {
      diagVideoTexRef.current.dispose();
      diagVideoTexRef.current = null;
      lastDiagDimsRef.current = "";
      lastDiagSecRef.current = -1;
    }

    // Throttle normal telemetry redraws to ~12.5 Hz (0.08s) BEFORE building signature strings
    if (lastCrtDrawRef.current > 0 && now - lastCrtDrawRef.current < 0.08) return;
    lastCrtDrawRef.current = now;

    const tex = activeCrtTex;
    const canvas = tex.image as HTMLCanvasElement;

    const deskState = useDeskStore.getState();
    const activeDeskDoc = deskState.documents[0] ?? null;
    const timeBucket = Math.floor(now * 2);
    const lastEntryId =
      state.terminalEntries[state.terminalEntries.length - 1]?.id ?? "0";
    const cdSec = Math.ceil(deskState.directiveCooldown);
    const rawHint =
      state.hoveredDiagnosticId !== null || state.tutorialStep === "DONE"
        ? getContextualDiagnosticHint(state, deskState.printingDoc !== null)
        : null;
    let totalAllocatedMW = 0;
    for (let i = 0; i < state.substations.length; i++) {
      totalAllocatedMW += state.substations[i].allocatedMW;
    }
    const hasGenDeficit =
      state.tutorialPhase === "COMPLETED" &&
      totalAllocatedMW > state.totalElectricalMW + 15;
    const latestChatMsg =
      state.wePadChatLog[state.wePadChatLog.length - 1] ?? null;
    const contextualHint =
      state.hoveredControlHint ??
      (state.coreTemp > 520 && state.controlRods > 0.75
        ? "⚠️ HIGH REACTIVITY: INSERT CONTROL RODS (UNIT A-2) OR BOOST PUMPS TO AVOID OVERHEAT!"
        : hasGenDeficit
          ? `⚠️ GRID DEFICIT: BATTERY BANK LOW OR TRIPPED ON UNIT C — RAISE RODS (A-2) FOR ${totalAllocatedMW} MW!`
          : rawHint);
    const subSig = state.substations
      .map((s) => `${s.id}:${s.allocatedMW}:${s.targetMW}:${s.statusText}:${s.quotaOk ? 1 : 0}`)
      .join(",");
    const skalaSig = `${Math.round(state.heliumPressure)}:${Math.round(state.graphiteTemp)}:${Math.round(state.bubblerLevel)}:${state.sealToggles.join("")}:${Math.round(state.pumpAHeat)}:${Math.round(state.pumpBHeat)}:${Math.round(state.boronTankLevel)}:${Object.keys(state.channelHotspots).length}:${Math.round(state.pressureBar)}:${Math.round(state.energyCreatedMW)}:${Math.round(state.batteryStoredPct)}:${Math.round(state.batteryOutputValve * 100)}:${Math.round(state.energyDemandMW)}`;
    const sig = `${timeBucket}|${skalaSig}|${state.phase}|${state.tutorialPhase}|${state.tutorialPrompt.header}|${state.tutorialPrompt.body}|${latestChatMsg?.id ?? ""}|${cdSec}|${contextualHint ?? ""}|${Math.round(state.controlRods * 100)}|${Math.round(state.totalElectricalMW)}|${Math.round(state.drumWaterLevel)}|${Math.round(state.drumPressure)}|${subSig}|${deskState.printingDoc?.id ?? ""}|${deskState.capsuleState}|${deskState.hatchOpen}|${lastEntryId}|${state.bubblerDraining}|${state.auxLoopBActive}|${state.kgbLineActive}|${activeDeskDoc?.id ?? "NONE"}|${activeDeskDoc?.stamps.length ?? 0}|${Math.round(state.pumpThrottle[0])}|${Math.round(state.pumpThrottle[1])}|${Math.round(state.waterReservoir)}|${Math.round(state.waterUsage)}|${Math.round(state.coreTemp / 2) * 2}|${state.ciaIntrusionActive}|${Math.round(state.ciaIntrusionProgress)}|${state.komradOverrideLocked}|${state.isBlackout}|${bulletinIdx}`;
    if (!canvas || !tex || tex.userData.lastSig === sig) return;
    tex.userData.lastSig = sig;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = 1600;
    const h = 1000;
    ctx.save();
    ctx.scale(canvas.width / w, canvas.height / h);

    // 1. Deep Phosphor-Green CRT Background
    ctx.fillStyle = state.isBlackout ? "#020804" : "#041208";
    ctx.fillRect(0, 0, w, h);

    // Outer double border filling 99% of canvas (margin reduced to 6px from canvas edges!)
    ctx.strokeStyle = "#39ff14";
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, w - 12, h - 12);

    // =========================================================================
    // TOP TELEMETRY HEADER BAR (y = 8..82) — +40% Larger, Ultra-Bold Font (900)
    // =========================================================================
    ctx.fillStyle = "rgba(10, 44, 20, 0.94)";
    ctx.fillRect(8, 8, w - 16, 74);
    ctx.strokeStyle = "#39ff14";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(6, 82);
    ctx.lineTo(w - 6, 82);
    ctx.stroke();

    const totalSuppliedMW = totalAllocatedMW;
    const totalGenMW = Math.round(state.totalElectricalMW);
    const waterPct = Math.round(state.waterReservoir);

    const totalMinutes = Math.floor(state.shiftTimeMinutes);
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");

    ctx.font = '700 28px "Consolas", "Lucida Console", monospace';
    ctx.textAlign = "left";
    drawHeavyCrtText(ctx, "K.O.M.R.A.D.-84", 18, 56, "#39ff14", 0.9, 250);

    // Total Output Pill
    const mwCol = hasGenDeficit
      ? "#ff2a2a"
      : totalGenMW >= 600
        ? "#39ff14"
        : "#ffd000";
    drawHeavyCrtText(
      ctx,
      `| OUTPUT: ${totalSuppliedMW} / ${totalGenMW} MWe`,
      280,
      56,
      mwCol,
      0.9,
      420,
    );

    // Drum Level & Pressure Pill
    const wtrCol =
      Math.abs(state.drumWaterLevel) > 150 || state.drumPressure >= 80
        ? "#ff2a2a"
        : Math.abs(state.drumWaterLevel) <= 80 && state.drumPressure >= 60
          ? "#39ff14"
          : "#ffd000";
    const drumSign = state.drumWaterLevel >= 0 ? "+" : "";
    drawHeavyCrtText(
      ctx,
      `| DRUM: ${drumSign}${Math.round(state.drumWaterLevel)}mm (${Math.round(state.drumPressure)} BAR)`,
      720,
      56,
      wtrCol,
      0.9,
      450,
    );

    // Clock Pill
    ctx.textAlign = "right";
    const clkCol = state.ciaIntrusionActive ? "#ff2a2a" : "#ffe600";
    drawHeavyCrtText(
      ctx,
      state.ciaIntrusionActive
        ? `| CIA HACK: ${Math.round(state.ciaIntrusionProgress)}% (${hh}:${mm})`
        : `| SHIFT: ${hh}:${mm} / 06:00`,
      w - 20,
      56,
      clkCol,
      0.9,
      340,
    );

    // =========================================================================
    // СКАЛА-84 (SKALA-84) 4-BAY CENTRALIZED CONTROL & DIAGNOSTIC MATRIX (y = 86..170)
    // =========================================================================
    {
      const skalaY = 86;
      const skalaH = 84;
      const bayW = 390;
      const bayGap = 8;

      const bearingTemp = Math.round(
        20 + Math.max(state.pumpAHeat, state.pumpBHeat),
      );
      const hotspotCount = Object.keys(state.channelHotspots).length;
      const unmetSub = state.substations.find(
        (s) => Math.abs(s.allocatedMW - s.targetMW) >= 15,
      );

      // 1. UNIT B (`[KEY 3] UNIT B // GAS & BUBBLER`)
      const activePumpCount = state.mcpActive.filter(Boolean).length;
      const isCoreOperating =
        state.thermalPower > 220 || state.tutorialPhase === "COMPLETED";
      const bayBStatus: "OK" | "WARN" | "ALERT" =
        state.bubblerLevel >= 92 || Math.abs(state.drumWaterLevel) > 200
          ? "ALERT"
          : state.bubblerLevel >= 82 ||
              state.graphiteTemp > 580 ||
              Math.abs(state.drumWaterLevel) > 135 ||
              state.pressureBar > 77 ||
              state.waterReservoir < 30 ||
              (isCoreOperating && state.sealToggles.some((on) => !on))
            ? "WARN"
            : "OK";
      const bayBLine =
        state.bubblerLevel >= 86
          ? "🚨 BUBBLER FULL! PULL [BUBBLER DRAIN]!"
          : state.drumWaterLevel < -135
            ? "🚨 DRUM <-135MM (VOID)! TURN [FEEDWATER]!"
            : state.drumWaterLevel > 135
              ? "⚠️ DRUM >+135MM (WET STEAM)! LOWER [FEEDWATER]"
              : state.pressureBar > 77
                ? "⚠️ STEAM >77 BAR! USE [STEAM DUMP]!"
                : state.graphiteTemp > 580
                  ? "⚠️ GRAPHITE >580°C! TURN [HELIUM-N2]!"
                  : isCoreOperating && state.sealToggles.some((on) => !on)
                    ? "⚠️ SEAL LEAK! FLIP [SCRUBBERS] UP!"
                    : state.waterReservoir < 30
                      ? `⚠️ RESERVOIR ${Math.round(state.waterReservoir)}%! DRAIN BUBBLER!`
                      : `PUMPS: ${activePumpCount}/4 | GRAPHITE: ${Math.round(state.graphiteTemp)}°C | POOL: ${Math.round(state.bubblerLevel)}%`;

      // 2. UNIT A-2 (`[KEY 3] UNIT A-2 // CORE & BORON`)
      const highReactivityOverheat =
        state.coreTemp > 550 && state.controlRodLevel > 78;
      const bayA2Status: "OK" | "WARN" | "ALERT" =
        hotspotCount >= 4 || bearingTemp > 90 || highReactivityOverheat
          ? "ALERT"
          : hotspotCount >= 1 ||
              bearingTemp > 80 ||
              state.boronTankLevel < 22 ||
              (isCoreOperating && state.pressureBar < 42)
            ? "WARN"
            : "OK";
      const bayA2Line =
        highReactivityOverheat
          ? "🚨 HIGH REACTIVITY! INSERT [RODS] ON A-2!"
          : hotspotCount >= 4
            ? "🚨 SPENT FUEL OVERHEAT! REFUEL ON A-2!"
            : hotspotCount >= 1
              ? `⚠️ ${hotspotCount} SPENT ROD(S)! CLICK AMBER & PULL LEVER`
              : bearingTemp > 90
                ? "🚨 BEARINGS >90°C! OPEN [OIL COOLER]!"
                : bearingTemp > 80
                  ? "⚠️ BEARINGS WARM! TURN [OIL COOLER]"
                  : state.boronTankLevel < 22
                    ? "⚠️ BORON <22% (WEAK RODS)! PULL [REFUEL LEVER]"
                    : isCoreOperating && state.pressureBar < 42
                      ? "⚡ LOW STEAM! RAISE [BORON RODS]"
                      : `RODS: ${Math.round(state.controlRodLevel)}% | BEARINGS: ${bearingTemp}°C | BORON: ${Math.round(state.boronTankLevel)}%`;

      // 3. UNIT A (`[KEY 1] UNIT A // LOOP & MW`)
      const bayAStatus: "OK" | "WARN" | "ALERT" =
        state.coreTemp > 565 || state.pressureBar >= 80
          ? "ALERT"
          : state.pressureBar > 77 ||
              state.radiationLevel > 3.5 ||
              (isCoreOperating && state.pressureBar < 36) ||
              (state.tutorialPhase === "COMPLETED" && Boolean(unmetSub))
            ? "WARN"
            : "OK";
      const bayALine =
        state.coreTemp > 565
          ? "🚨 CORE OVERHEAT! BOOST [PUMPS A/B]!"
          : state.pressureBar >= 80
            ? "🚨 HIGH STEAM BAR! VENT / LOWER RODS!"
            : state.pressureBar > 77
              ? "⚠️ STEAM >77 BAR! VENT OR LOWER RODS"
              : state.radiationLevel > 3.5
                ? `⚠️ RADS ${state.radiationLevel.toFixed(1)} R/H! CHECK SEALS & VENT!`
                : isCoreOperating && state.pressureBar < 36
                  ? "⚠️ LOW STEAM BAR! [PUMPS + RODS]"
                  : unmetSub
                    ? `⚡ MW ORDER: SET SECTOR [${unmetSub.id}] -> ${unmetSub.targetMW} MW`
                    : `CORE: ${Math.round(state.coreTemp)}°C | STEAM: ${Math.round(state.pressureBar)} BAR | MW: ${totalSuppliedMW}`;

      // 4. UNIT C (`[KEY 5] UNIT C // ENERGY STORAGE & BATTERY DISPATCH`)
      const createdMW = Math.round(state.energyCreatedMW);
      const demandMW = Math.round(state.energyDemandMW);
      const batPct = Math.round(state.batteryStoredPct);
      const deltaDemandC = Math.round(totalGenMW - demandMW);
      const bayCStatus: "OK" | "WARN" | "ALERT" =
        state.isBlackout ||
        batPct < 8 ||
        (state.tutorialPhase === "COMPLETED" && Math.abs(deltaDemandC) > 90)
          ? "ALERT"
          : batPct < 20 ||
              (state.tutorialPhase === "COMPLETED" && Math.abs(deltaDemandC) > 30) ||
              state.pressureBar > 77
            ? "WARN"
            : "OK";
      const bayCLine =
        state.isBlackout || batPct < 8
          ? "🚨 BATTERY LOW (<8%)! RAISE [RODS] ON A-2"
          : state.tutorialPhase === "COMPLETED" && deltaDemandC < -30
            ? `⚡ ${deltaDemandC} MW DEFICIT! RAISE [A-2] RODS`
            : state.tutorialPhase === "COMPLETED" && deltaDemandC > 35
              ? `⚠️ +${deltaDemandC} MW SURPLUS! LOWER [A] LEVERS`
              : state.pressureBar > 77
                ? "⚠️ PRESSURE >77 BAR! TRIM [RODS] ON A-2"
                : `GEN: ${createdMW}MW | BAT: ${batPct}% | GRID: ${totalGenMW}/${demandMW}MW`;

      const skalaBays = [
        {
          header: "[KEY 3] UNIT B // GAS & BUBBLER",
          status: bayBStatus,
          line: bayBLine,
        },
        {
          header: "[KEY 3] UNIT A-2 // CORE & BORON",
          status: bayA2Status,
          line: bayA2Line,
        },
        {
          header: "[KEY 1] UNIT A // LOOP & MW",
          status: bayAStatus,
          line: bayALine,
        },
        {
          header: "[KEY 5] UNIT C // ENERGY STORAGE",
          status: bayCStatus,
          line: bayCLine,
        },
      ] as const;

      skalaBays.forEach((bay, idx) => {
        const bx = 8 + idx * (bayW + bayGap);
        const isCrit = bay.status === "ALERT";
        const isWarn = bay.status === "WARN";
        const blinkOn = timeBucket % 2 === 0;
        const borderCol = isCrit
          ? blinkOn
            ? "#ff2a2a"
            : "#881414"
          : isWarn
            ? "#d99014"
            : "#28ff66";

        ctx.fillStyle = isCrit
          ? blinkOn
            ? "rgba(62, 8, 8, 0.96)"
            : "rgba(28, 4, 4, 0.95)"
          : isWarn
            ? "rgba(38, 22, 4, 0.95)"
            : "rgba(4, 22, 10, 0.95)";
        ctx.fillRect(bx, skalaY, bayW, skalaH);
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = isCrit || isWarn ? 3.2 : 2.4;
        ctx.strokeRect(bx, skalaY, bayW, skalaH);

        // Top Bay Header Strip (Kremlin font)
        ctx.fillStyle = borderCol;
        ctx.fillRect(bx + 2, skalaY + 2, bayW - 4, 28);
        ctx.font = '700 17px "Kremlin", "Consolas", "Lucida Console", monospace';
        ctx.textAlign = "left";
        drawHeavyCrtText(
          ctx,
          bay.header,
          bx + 8,
          skalaY + 22,
          "#020a04",
          0.85,
          bayW - 86,
        );
        ctx.textAlign = "right";
        drawHeavyCrtText(
          ctx,
          bay.status,
          bx + bayW - 8,
          skalaY + 22,
          "#020a04",
          0.85,
          64,
        );

        // Diagnostic / Telemetry Body Line
        const textCol = isCrit
          ? blinkOn
            ? "#ffffff"
            : "#ff4444"
          : isWarn
            ? "#ffbb22"
            : "#28ff66";
        ctx.font = '700 19px "Consolas", "Lucida Console", monospace';
        ctx.textAlign = "left";
        drawHeavyCrtText(
          ctx,
          bay.line,
          bx + 10,
          skalaY + 62,
          textCol,
          0.85,
          bayW - 20,
        );
      });
    }

    // =========================================================================
    // SPLIT-SCREEN DIVIDER (Left 62% Regional Vector Map: x=8..994, Right 38% AI Log: x=1002..1592)
    // =========================================================================
    const mapX = 8;
    const mapY = 174;
    const mapW = 986;
    const mapH = h - 182;

    const chatX = 1002;
    const chatY = 174;
    const chatW = w - chatX - 8;
    const chatH = h - 182;

    // Frame Left Map Panel
    ctx.fillStyle = "rgba(3, 14, 7, 0.96)";
    ctx.fillRect(mapX, mapY, mapW, mapH);
    ctx.strokeStyle = "#39ff14";
    ctx.lineWidth = 3;
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    // -------------------------------------------------------------------------
    // 1. DETAILED GEOGRAPHIC & TOPOGRAPHICAL BACKGROUND
    // -------------------------------------------------------------------------
    ctx.strokeStyle = "rgba(57, 255, 20, 0.08)";
    ctx.lineWidth = 1;
    for (let c = 1; c < 6; c++) {
      const gx = mapX + c * (mapW / 6);
      ctx.beginPath();
      ctx.moveTo(gx, mapY + 42);
      ctx.lineTo(gx, mapY + mapH);
      ctx.stroke();
    }
    for (let r = 1; r < 6; r++) {
      const gy = mapY + 42 + r * ((mapH - 42) / 6);
      ctx.beginPath();
      ctx.moveTo(mapX, gy);
      ctx.lineTo(mapX + mapW, gy);
      ctx.stroke();
    }

    // Winding Pripyat River & Cooling Reservoir Lake
    ctx.save();
    const riverFillCol =
      waterPct < 30 ? "rgba(255, 58, 58, 0.25)" : "rgba(0, 240, 255, 0.22)";
    ctx.strokeStyle = riverFillCol;
    ctx.lineWidth = 46;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mapX + 340, mapY + 55);
    ctx.bezierCurveTo(
      mapX + 370,
      mapY + 215,
      mapX + 435,
      mapY + 340,
      mapX + 490,
      mapY + 460,
    );
    ctx.bezierCurveTo(
      mapX + 540,
      mapY + 585,
      mapX + 460,
      mapY + 725,
      mapX + 505,
      mapY + mapH - 12,
    );
    ctx.stroke();

    // Cooling Reservoir Lake Basin beside Chernobyl-4 Plant
    ctx.fillStyle = riverFillCol;
    ctx.strokeStyle = waterPct < 30 ? "#ff4444" : "#00f0ff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(mapX + 485, mapY + 515, 92, 50, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Animated cyan water current chevrons along Pripyat River
    ctx.strokeStyle = waterPct < 30 ? "#ff4444" : "#00f0ff";
    ctx.lineWidth = 3.5;
    ctx.setLineDash([14, 12]);
    ctx.lineDashOffset = -(timeBucket * 6);
    ctx.beginPath();
    ctx.moveTo(mapX + 340, mapY + 55);
    ctx.bezierCurveTo(
      mapX + 370,
      mapY + 215,
      mapX + 435,
      mapY + 340,
      mapX + 490,
      mapY + 460,
    );
    ctx.bezierCurveTo(
      mapX + 540,
      mapY + 585,
      mapX + 460,
      mapY + 725,
      mapX + 505,
      mapY + mapH - 12,
    );
    ctx.stroke();
    ctx.restore();

    // Map Sub-Header Banner (Kremlin font + 100% English ORDER banner)
    ctx.fillStyle = "rgba(14, 58, 28, 0.96)";
    ctx.fillRect(mapX + 2, mapY + 2, mapW - 4, 42);
    ctx.font = '700 21px "Kremlin", "Consolas", monospace';
    ctx.textAlign = "left";
    drawHeavyCrtText(
      ctx,
      "SECTOR 84 ELECTRICAL GRID // 6 SUBSTATIONS",
      mapX + 12,
      mapY + 30,
      "#39ff14",
      0.8,
      510,
    );

    ctx.textAlign = "right";
    if (state.activeMandate) {
      const englishTitle = state.activeMandate.title
        .replace(/ДИРЕКТИВА/gi, "DIRECTIVE")
        .replace(/ПРИКАЗ/gi, "ORDER")
        .replace(/КРАСНЫЙ ОКТЯБРЬ/gi, "RED PRIORITY")
        .replace(/АТОМЩИК-84/gi, "ATOM-84")
        .replace(/УРОЖАЙ-84/gi, "HARVEST-84")
        .replace(/КРАСНАЯ ЗВЕЗДА/gi, "RED STAR")
        .replace(/ГОРИЗОНТ-84/gi, "HORIZON-84")
        .replace(/ЩИТ РОДИНЫ/gi, "SHIELD-84")
        .replace(/ПЯТИЛЕТКА-4/gi, "QUOTA-84")
        .replace(/УЧЕБНЫЙ ПУСК/gi, "DRILL BOOST")
        .replace(/УЧЕБНЫЙ СБРОС/gi, "DRILL DROP")
        .replace(/А/g, "A")
        .replace(/Б/g, "B")
        .replace(/В/g, "V");
      drawHeavyCrtText(
        ctx,
        `ORDER: ${englishTitle.slice(0, 26)}`,
        mapX + mapW - 12,
        mapY + 30,
        "#ffd000",
        0.8,
        430,
      );
    }

    // -------------------------------------------------------------------------
    // COORDINATES OF ENLARGED CENTER REACTOR (+25%) & 6 ENLARGED SECTOR CARDS (+20%)
    // -------------------------------------------------------------------------
    const reactorCx = mapX + 493;
    const reactorCy = mapY + 412;

    const nodes = {
      pripyat: { cx: mapX + 178, cy: mapY + 152 },
      kolkhoz: { cx: mapX + 178, cy: mapY + 412 },
      vodka: { cx: mapX + 178, cy: mapY + 672 },
      duga: { cx: mapX + 808, cy: mapY + 152 },
      kgb: { cx: mapX + 808, cy: mapY + 412 },
      steel: { cx: mapX + 808, cy: mapY + 672 },
    };

    // Helper: Draw +50% Thicker High-Voltage Transmission Line (MW) + Cyan Water Main (H2O) with Enlarged Siphon Arrows
    const drawTransmissionLink = (
      tx: number,
      ty: number,
      supplied: number,
      target: number,
      hasWater: boolean,
      zoneWaterPct: number,
      minWater: number,
      isSiphoningInward: boolean,
    ) => {
      const mwOk = Math.abs(supplied - target) <= 5;
      const waterOk = !hasWater || zoneWaterPct >= minWater;
      const col =
        supplied === 0 || !waterOk
          ? "#ff2a2a"
          : mwOk
            ? "#39ff14"
            : "#ffd000";

      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 5.5;
      ctx.setLineDash([14, 9]);
      ctx.lineDashOffset = -(timeBucket * 7);
      ctx.beginPath();
      ctx.moveTo(reactorCx, reactorCy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.restore();

      if (hasWater) {
        const isDrainingOutward = state.bubblerDraining && state.bubblerLevel > 0;
        const wCol = isDrainingOutward
          ? "#44ff66"
          : zoneWaterPct >= minWater
            ? "#00f0ff"
            : "#ff2a2a";
        const dashSpeed = isDrainingOutward
          ? -(timeBucket * 11)
          : isSiphoningInward
            ? timeBucket * 11
            : -(timeBucket * 3);
        const startX = reactorCx - 14;
        const startY = reactorCy + 16;
        const endX = tx;
        const endY = ty + 16;

        ctx.save();
        ctx.strokeStyle = wCol;
        ctx.lineWidth = isSiphoningInward || isDrainingOutward ? 5.5 : 4.0;
        ctx.setLineDash([9, 7]);
        ctx.lineDashOffset = dashSpeed;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Enlarged directional chevron arrows (+50% larger) along the water pipe
        const dx = endX - startX;
        const dy = endY - startY;
        const angle = Math.atan2(dy, dx);
        const arrowAngle =
          isSiphoningInward && !isDrainingOutward ? angle + Math.PI : angle;
        for (const tPos of [0.36, 0.64]) {
          const ax = startX + dx * tPos;
          const ay = startY + dy * tPos;
          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(arrowAngle);
          ctx.fillStyle = wCol;
          ctx.beginPath();
          ctx.moveTo(11, 0);
          ctx.lineTo(-8, -8);
          ctx.lineTo(-8, 8);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }
    };

    const sub1 = state.substations.find((s) => s.id === 1)!;
    const sub2 = state.substations.find((s) => s.id === 2)!;
    const sub3 = state.substations.find((s) => s.id === 3)!;
    const sub4 = state.substations.find((s) => s.id === 4)!;
    const sub5 = state.substations.find((s) => s.id === 5)!;
    const sub6 = state.substations.find((s) => s.id === 6)!;

    drawTransmissionLink(
      nodes.pripyat.cx,
      nodes.pripyat.cy,
      sub1.allocatedMW,
      sub1.targetMW,
      false,
      100,
      0,
      false,
    );
    drawTransmissionLink(
      nodes.kolkhoz.cx,
      nodes.kolkhoz.cy,
      sub3.allocatedMW,
      sub3.targetMW,
      false,
      100,
      0,
      false,
    );
    drawTransmissionLink(
      nodes.duga.cx,
      nodes.duga.cy,
      sub2.allocatedMW,
      sub2.targetMW,
      false,
      100,
      0,
      false,
    );
    drawTransmissionLink(
      nodes.kgb.cx,
      nodes.kgb.cy,
      sub4.allocatedMW,
      sub4.targetMW,
      false,
      100,
      0,
      false,
    );
    drawTransmissionLink(
      nodes.vodka.cx,
      nodes.vodka.cy,
      sub5.allocatedMW,
      sub5.targetMW,
      false,
      100,
      0,
      false,
    );
    drawTransmissionLink(
      nodes.steel.cx,
      nodes.steel.cy,
      sub6.allocatedMW,
      sub6.targetMW,
      false,
      100,
      0,
      false,
    );

    // -------------------------------------------------------------------------
    // 2. CENTERPIECE: CHERNOBYL-4 ATOMIC COMPLEX (Enlarged +25% with +45% Larger Bold Text)
    // -------------------------------------------------------------------------
    {
      const cx = reactorCx;
      const cy = reactorCy;
      const coreCrit = state.coreTemp >= 760;
      const plantCol = coreCrit ? "#ff2a2a" : "#39ff14";
      const rBoxW = 282;
      const rBoxH = 228;
      const rx0 = cx - rBoxW / 2;
      const ry0 = cy - rBoxH / 2;

      // Switchyard perimeter & solid dark pad
      ctx.fillStyle = "rgba(2, 10, 4, 0.96)";
      ctx.fillRect(rx0, ry0, rBoxW, rBoxH);
      ctx.strokeStyle = plantCol;
      ctx.lineWidth = 3.5;
      ctx.strokeRect(rx0, ry0, rBoxW, rBoxH);

      // Two Hyperboloid Cooling Towers on Right of Complex with Rising Steam Puffs
      for (let tIdx = 0; tIdx < 2; tIdx++) {
        const tx = cx + 52 + tIdx * 48;
        const ty = cy - 26;
        ctx.fillStyle = "#082613";
        ctx.strokeStyle = plantCol;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(tx - 18, ty + 20);
        ctx.quadraticCurveTo(tx - 10, ty - 10, tx - 14, ty - 32);
        ctx.lineTo(tx + 14, ty - 32);
        ctx.quadraticCurveTo(tx + 10, ty - 10, tx + 18, ty + 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        const puffOff = ((timeBucket + tIdx * 2) % 4) * 4;
        ctx.strokeStyle = "#88ffaa";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx - 4, ty - 40 - puffOff, 6, 0, Math.PI * 2);
        ctx.arc(tx + 6, ty - 45 - puffOff, 7, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Main Rectangular Turbine Hall & Reactor Block No. 4 Sarcophagus
      ctx.fillStyle = "#0b3018";
      ctx.strokeStyle = plantCol;
      ctx.lineWidth = 2.5;
      ctx.fillRect(cx - 122, cy - 30, 142, 30);
      ctx.strokeRect(cx - 122, cy - 30, 142, 30);
      ctx.fillStyle = state.isBlackout ? "#163020" : "#55ff88";
      for (let wx = cx - 114; wx < cx + 12; wx += 14) {
        ctx.fillRect(wx, cy - 21, 8, 12);
      }

      // Reactor Block 4 Upper Containment Building & Ventilation Stack
      ctx.fillStyle = "#0e3b1e";
      ctx.fillRect(cx - 72, cy - 58, 64, 28);
      ctx.strokeRect(cx - 72, cy - 58, 64, 28);
      ctx.fillStyle = "#061c0d";
      ctx.fillRect(cx - 46, cy - 102, 12, 44);
      ctx.strokeRect(cx - 46, cy - 102, 12, 44);
      ctx.fillStyle = "#ffd000";
      ctx.fillRect(cx - 45, cy - 92, 10, 6);
      ctx.fillRect(cx - 45, cy - 76, 10, 6);
      if (timeBucket % 2 === 0) {
        ctx.fillStyle = "#ff2a2a";
        ctx.beginPath();
        ctx.arc(cx - 40, cy - 106, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Center Complex Telemetry Tag Banner
      ctx.fillStyle = plantCol;
      ctx.fillRect(rx0 + 4, cy + 4, rBoxW - 8, 30);
      ctx.font = '700 20px "Consolas", "Lucida Console", monospace';
      ctx.textAlign = "center";
      drawHeavyCrtText(
        ctx,
        "CHERNOBYL-4 ATOMIC COMPLEX",
        cx,
        cy + 26,
        "#041208",
        0.8,
        rBoxW - 16,
      );

      // Enlarged CORE & DRUM Readout
      ctx.font = '700 22px "Consolas", "Lucida Console", monospace';
      drawHeavyCrtText(
        ctx,
        `CORE: ${Math.round(state.coreTemp)}°C | DRUM: ${Math.round(state.drumWaterLevel)}mm`,
        cx,
        cy + 64,
        coreCrit ? "#ff2a2a" : "#39ff14",
        0.85,
        rBoxW - 14,
      );

      // Enlarged LEVEL & PRESSURE Readout
      ctx.font = '700 20px "Consolas", "Lucida Console", monospace';
      drawHeavyCrtText(
        ctx,
        `LEVEL: ${Math.round(state.drumWaterLevel)} MM | PRESSURE: ${Math.round(state.drumPressure)} BAR`,
        cx,
        cy + 98,
        "#00f0ff",
        0.85,
        rBoxW - 14,
      );
    }

    // -------------------------------------------------------------------------
    // 3. SIX ENLARGED SECTOR CARDS (+20% Box Size, Single-Language Header, +50% Telemetry)
    // -------------------------------------------------------------------------
    const drawNodeBadgeAndFrame = (opts: {
      cx: number;
      cy: number;
      codeTitle: string;
      suppliedMW: number;
      targetMW: number;
      maxMW: number;
      hasWater: boolean;
      zoneWaterPct?: number;
      targetWaterPct?: number;
      minWater: number;
      statusText: string;
      quotaOk: boolean;
      drawSilhouette: (
        x0: number,
        y0: number,
        w: number,
        h: number,
        powered: boolean,
        col: string,
      ) => void;
    }) => {
      const boxW = 336;
      const boxH = 208;
      const x0 = opts.cx - boxW / 2;
      const y0 = opts.cy - boxH / 2;
      const dispMW = state.isBlackout ? 0 : opts.suppliedMW;
      const powered = dispMW > 0 && !state.isBlackout;
      const mwOk = !state.isBlackout && dispMW >= opts.targetMW - 10;
      const zWater = opts.zoneWaterPct ?? 0;
      const tgtWater = opts.targetWaterPct ?? 85;
      const waterOk = !opts.hasWater || zWater >= opts.minWater;
      const isColdStartPreDispatch =
        state.tutorialPhase !== "COMPLETED" &&
        state.tutorialPhase !== "STEP_6_BASELINE_600MW";
      const isAlert = !opts.quotaOk && !isColdStartPreDispatch;
      const borderCol = opts.quotaOk
        ? "#39ff14"
        : isColdStartPreDispatch
          ? "#3b7a4c"
          : powered || waterOk
            ? "#ffd000"
            : "#ff2a2a";

      // Solid Dark Card Backing (`rgba(2, 10, 4, 0.94)`)
      ctx.fillStyle = isAlert
        ? "rgba(28, 8, 6, 0.95)"
        : "rgba(2, 10, 4, 0.94)";
      ctx.fillRect(x0, y0, boxW, boxH);
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 3.2;
      ctx.strokeRect(x0, y0, boxW, boxH);

      // Single-Language Bold English Title Banner
      ctx.fillStyle = borderCol;
      ctx.fillRect(x0, y0, boxW, 32);
      ctx.font = '700 22px "Consolas", "Lucida Console", monospace';
      ctx.textAlign = "left";
      drawHeavyCrtText(
        ctx,
        opts.codeTitle,
        x0 + 10,
        y0 + 24,
        "#020804",
        0.85,
        boxW - 20,
      );

      // Architectural Silhouette Viewport
      const silX = x0 + 8;
      const silY = y0 + 36;
      const silW = boxW - 16;
      const silH = 56;
      ctx.fillStyle = "rgba(2, 10, 4, 0.92)";
      ctx.fillRect(silX, silY, silW, silH);
      ctx.strokeStyle = "rgba(57, 255, 20, 0.28)";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(silX, silY, silW, silH);

      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(silX + 4, silY + silH - 6);
      ctx.lineTo(silX + silW - 4, silY + silH - 6);
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.rect(silX + 1, silY + 1, silW - 2, silH - 2);
      ctx.clip();
      opts.drawSilhouette(silX, silY, silW, silH, powered, borderCol);
      ctx.restore();

      // Massive Telemetry Readouts (`MW: XX / XX` & `H2O: XX/85%` or statusText)
      // Constrained with strict non-overlapping left (135px) & right (165px) maxWidths so they never collide!
      const mwReadoutCol = state.isBlackout
        ? "#ff2a2a"
        : mwOk
          ? "#39ff14"
          : "#ffd000";
      ctx.textAlign = "left";
      ctx.font = '700 22px "Consolas", "Lucida Console", monospace';
      drawHeavyCrtText(
        ctx,
        `MW: ${dispMW}/${opts.targetMW}`,
        x0 + 10,
        y0 + 123,
        mwReadoutCol,
        0.85,
        134,
      );

      ctx.textAlign = "right";
      if (opts.hasWater) {
        const droughtFlash = !waterOk && timeBucket % 2 === 0;
        const h2oCol = waterOk
          ? "#00f0ff"
          : droughtFlash
            ? "#ffffff"
            : "#ff2a2a";
        ctx.font = '700 20px "Consolas", "Lucida Console", monospace';
        drawHeavyCrtText(
          ctx,
          `H2O: ${zWater}/${tgtWater}%`,
          x0 + boxW - 10,
          y0 + 123,
          h2oCol,
          0.85,
          164,
        );
      } else {
        ctx.font = '700 19px "Consolas", "Lucida Console", monospace';
        drawHeavyCrtText(
          ctx,
          opts.statusText,
          x0 + boxW - 10,
          y0 + 123,
          opts.quotaOk ? "#39ff14" : "#ff2a2a",
          0.8,
          166,
        );
      }

      // High-Contrast MW Bar Graph (0..maxMW)
      const barX = x0 + 10;
      const barY = y0 + 135;
      const barW = boxW - 20;
      const barH = 18;
      ctx.fillStyle = "#041208";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barW, barH);

      const fillRatio = Math.min(1, dispMW / opts.maxMW);
      ctx.fillStyle = mwOk ? "#39ff14" : "#ffd000";
      ctx.fillRect(barX + 2, barY + 2, (barW - 4) * fillRatio, barH - 4);

      const targetX =
        barX + 2 + (barW - 4) * Math.min(1, opts.targetMW / opts.maxMW);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(targetX - 3, barY - 3, 6, barH + 6);

      // Bigger Bottom Status Line in Each Card
      ctx.textAlign = "left";
      ctx.font = '700 20px "Consolas", "Lucida Console", monospace';
      const bottomStatus = opts.hasWater
        ? `${opts.statusText} • ${opts.quotaOk ? "QUOTA OK" : "CLICK H2O [+/-]"}`
        : opts.quotaOk
          ? `${opts.statusText} • QUOTA OK`
          : `${opts.statusText} • NEED ${opts.targetMW} MW`;
      drawHeavyCrtText(
        ctx,
        bottomStatus,
        x0 + 10,
        y0 + 190,
        opts.quotaOk ? "#39ff14" : "#ffd000",
        0.8,
        boxW - 20,
      );
    };

    // NODE 1 (North-West): [1] PRIPYAT CITY
    drawNodeBadgeAndFrame({
      cx: nodes.pripyat.cx,
      cy: nodes.pripyat.cy,
      codeTitle: "[1] PRIPYAT CITY",
      suppliedMW: sub1.allocatedMW,
      targetMW: sub1.targetMW,
      maxMW: sub1.maxMW,
      hasWater: false,
      minWater: 0,
      statusText: sub1.statusText,
      quotaOk: sub1.quotaOk,
      drawSilhouette: (sx, sy, sw, sh, powered, col) => {
        const groundY = sy + sh - 6;
        const towers = [
          { dx: 18, w: 30, h: 46 },
          { dx: 56, w: 34, h: 56 },
          { dx: 98, w: 32, h: 42 },
          { dx: 138, w: 36, h: 52 },
          { dx: 182, w: 30, h: 40 },
        ];
        for (const t of towers) {
          const tx = sx + t.dx;
          const ty = groundY - t.h;
          ctx.fillStyle = "#092614";
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.8;
          ctx.fillRect(tx, ty, t.w, t.h);
          ctx.strokeRect(tx, ty, t.w, t.h);
          if (powered) {
            ctx.fillStyle = "#ffe066";
            for (let wy = ty + 6; wy < groundY - 5; wy += 9) {
              for (let wx = tx + 5; wx < tx + t.w - 5; wx += 8) {
                ctx.fillRect(wx, wy, 4, 5);
              }
            }
          }
        }
        const wheelCx = sx + sw - 52;
        const wheelCy = groundY - 30;
        const wheelR = 20;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wheelCx, wheelCy, wheelR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(wheelCx - 14, groundY);
        ctx.lineTo(wheelCx, wheelCy);
        ctx.lineTo(wheelCx + 14, groundY);
        ctx.stroke();
        const rotOffset = powered ? timeBucket * 0.25 : 0;
        for (let i = 0; i < 8; i++) {
          const ang = rotOffset + (i * Math.PI) / 4;
          const rx = wheelCx + Math.cos(ang) * wheelR;
          const ry = wheelCy + Math.sin(ang) * wheelR;
          ctx.beginPath();
          ctx.moveTo(wheelCx, wheelCy);
          ctx.lineTo(rx, ry);
          ctx.stroke();
          ctx.fillStyle = powered ? "#ffd000" : "#1f4d2e";
          ctx.fillRect(rx - 2.5, ry - 2.5, 5, 5);
        }
      },
    });

    // NODE 3 (West): [3] KOLKHOZ FARM
    drawNodeBadgeAndFrame({
      cx: nodes.kolkhoz.cx,
      cy: nodes.kolkhoz.cy,
      codeTitle: "[3] KOLKHOZ FARM",
      suppliedMW: sub3.allocatedMW,
      targetMW: sub3.targetMW,
      maxMW: sub3.maxMW,
      hasWater: false,
      minWater: 0,
      statusText: sub3.statusText,
      quotaOk: sub3.quotaOk,
      drawSilhouette: (sx, sy, _sw, sh, powered, col) => {
        const groundY = sy + sh - 6;
        for (let sIdx = 0; sIdx < 2; sIdx++) {
          const gx = sx + 22 + sIdx * 36;
          const gy = groundY - 44;
          ctx.fillStyle = "#0a2915";
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.8;
          ctx.fillRect(gx, gy, 26, 44);
          ctx.strokeRect(gx, gy, 26, 44);
          ctx.beginPath();
          ctx.moveTo(gx - 2, gy);
          ctx.lineTo(gx + 13, gy - 12);
          ctx.lineTo(gx + 28, gy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        const bx = sx + 102;
        const by = groundY - 28;
        ctx.fillStyle = "#0a2915";
        ctx.strokeStyle = col;
        ctx.fillRect(bx, by, 86, 28);
        ctx.strokeRect(bx, by, 86, 28);
        ctx.beginPath();
        ctx.moveTo(bx - 4, by);
        ctx.lineTo(bx + 43, by - 14);
        ctx.lineTo(bx + 90, by);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (powered) {
          ctx.fillStyle = "#ffe066";
          for (let wx = bx + 10; wx < bx + 78; wx += 14) {
            ctx.fillRect(wx, by + 9, 8, 8);
          }
        }
        for (let gIdx = 0; gIdx < 2; gIdx++) {
          const ghX = sx + 224 + gIdx * 42;
          ctx.strokeStyle = powered ? "#00f0ff" : col;
          ctx.beginPath();
          ctx.arc(ghX, groundY, 16, Math.PI, 0);
          ctx.stroke();
        }
      },
    });

    // NODE 2 (North-East): [2] DUGA-1 RADAR
    drawNodeBadgeAndFrame({
      cx: nodes.duga.cx,
      cy: nodes.duga.cy,
      codeTitle: "[2] DUGA-1 RADAR",
      suppliedMW: sub2.allocatedMW,
      targetMW: sub2.targetMW,
      maxMW: sub2.maxMW,
      hasWater: false,
      minWater: 0,
      statusText: state.ciaIntrusionActive ? "CIA JAM!" : sub2.statusText,
      quotaOk: sub2.quotaOk,
      drawSilhouette: (sx, sy, sw, sh, powered, col) => {
        const groundY = sy + sh - 6;
        const towerXs = [sx + 28, sx + 76, sx + 124, sx + 172, sx + 220];
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.8;
        for (const tx of towerXs) {
          ctx.beginPath();
          ctx.moveTo(tx - 8, groundY);
          ctx.lineTo(tx - 4, sy + 8);
          ctx.lineTo(tx + 4, sy + 8);
          ctx.lineTo(tx + 8, groundY);
          ctx.stroke();
          for (let y = sy + 12; y < groundY - 8; y += 14) {
            ctx.beginPath();
            ctx.moveTo(tx - 6, y);
            ctx.lineTo(tx + 6, y + 12);
            ctx.moveTo(tx + 6, y);
            ctx.lineTo(tx - 6, y + 12);
            ctx.stroke();
          }
        }
        ctx.strokeStyle = "rgba(57, 255, 20, 0.55)";
        ctx.lineWidth = 1;
        for (let wy = sy + 14; wy < groundY - 6; wy += 9) {
          ctx.beginPath();
          ctx.moveTo(towerXs[0], wy);
          ctx.lineTo(towerXs[towerXs.length - 1], wy);
          ctx.stroke();
        }
        if (powered) {
          ctx.strokeStyle = state.ciaIntrusionActive ? "#ff2a2a" : "#ffd000";
          ctx.lineWidth = 2;
          for (let r = 1; r <= 3; r++) {
            const pulseR = 12 + ((timeBucket * 5 + r * 12) % 36);
            ctx.beginPath();
            ctx.arc(sx + sw - 64, sy + 34, pulseR, -0.65, 0.65);
            ctx.stroke();
          }
        }
      },
    });

    // NODE 4 (Far East): [4] KGB BUNKER
    drawNodeBadgeAndFrame({
      cx: nodes.kgb.cx,
      cy: nodes.kgb.cy,
      codeTitle: "[4] KGB BUNKER",
      suppliedMW: sub4.allocatedMW,
      targetMW: sub4.targetMW,
      maxMW: sub4.maxMW,
      hasWater: false,
      minWater: 0,
      statusText: sub4.statusText,
      quotaOk: sub4.quotaOk,
      drawSilhouette: (sx, sy, sw, sh, powered, col) => {
        const groundY = sy + sh - 6;
        const cx = sx + sw * 0.5;
        ctx.fillStyle = "#0a2915";
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(cx - 78, groundY);
        ctx.lineTo(cx - 56, groundY - 28);
        ctx.lineTo(cx + 56, groundY - 28);
        ctx.lineTo(cx + 78, groundY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#041208";
        ctx.fillRect(cx - 20, groundY - 20, 40, 20);
        ctx.strokeRect(cx - 20, groundY - 20, 40, 20);
        ctx.fillStyle = powered ? "#ff2a2a" : "#3a1a1a";
        ctx.font = 'bold 17px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("★ КГБ", cx, groundY - 5);

        for (const dx of [-38, 38]) {
          const ax = cx + dx;
          const ay = groundY - 28;
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax, ay - 13);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(ax, ay - 16, 10, Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();
        }
      },
    });

    // NODE 5 (South-West): [5] VODKA PLANT
    drawNodeBadgeAndFrame({
      cx: nodes.vodka.cx,
      cy: nodes.vodka.cy,
      codeTitle: "[5] VODKA PLANT",
      suppliedMW: sub5.allocatedMW,
      targetMW: sub5.targetMW,
      maxMW: sub5.maxMW,
      hasWater: false,
      minWater: 0,
      statusText: sub5.statusText,
      quotaOk: sub5.quotaOk,
      drawSilhouette: (sx, sy, _sw, sh, powered, col) => {
        const groundY = sy + sh - 6;
        const colXs = [sx + 26, sx + 56, sx + 86];
        ctx.strokeStyle = powered ? "#ffd000" : col;
        ctx.fillStyle = "#142e1b";
        ctx.lineWidth = 2;
        for (const cxCol of colXs) {
          ctx.fillRect(cxCol, groundY - 50, 18, 50);
          ctx.strokeRect(cxCol, groundY - 50, 18, 50);
          for (let py = groundY - 40; py < groundY - 10; py += 12) {
            ctx.fillStyle = powered ? "#00f0ff" : "#0b2414";
            ctx.fillRect(cxCol + 6, py, 6, 6);
          }
          ctx.fillStyle = "#142e1b";
        }
        ctx.beginPath();
        ctx.moveTo(colXs[0] + 9, groundY - 50);
        ctx.lineTo(colXs[0] + 9, groundY - 57);
        ctx.lineTo(colXs[2] + 9, groundY - 57);
        ctx.lineTo(colXs[2] + 9, groundY - 50);
        ctx.stroke();

        const hallX = sx + 124;
        ctx.fillStyle = "#0a2915";
        ctx.strokeStyle = col;
        ctx.fillRect(hallX, groundY - 34, 152, 34);
        ctx.strokeRect(hallX, groundY - 34, 152, 34);
        if (powered) {
          ctx.fillStyle = "#39ff14";
          for (let wx = hallX + 12; wx < hallX + 140; wx += 20) {
            ctx.fillRect(wx, groundY - 18, 10, 10);
          }
        }
      },
    });

    // NODE 6 (South-East): [6] STEEL WORKS
    drawNodeBadgeAndFrame({
      cx: nodes.steel.cx,
      cy: nodes.steel.cy,
      codeTitle: "[6] STEEL WORKS",
      suppliedMW: sub6.allocatedMW,
      targetMW: sub6.targetMW,
      maxMW: sub6.maxMW,
      hasWater: false,
      minWater: 0,
      statusText: sub6.statusText,
      quotaOk: sub6.quotaOk,
      drawSilhouette: (sx, sy, _sw, sh, powered, col) => {
        const groundY = sy + sh - 6;
        for (let bIdx = 0; bIdx < 2; bIdx++) {
          const bx = sx + 26 + bIdx * 46;
          ctx.fillStyle = "#0c2b17";
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx - 15, groundY);
          ctx.lineTo(bx - 9, groundY - 46);
          ctx.lineTo(bx + 9, groundY - 46);
          ctx.lineTo(bx + 15, groundY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          if (powered) {
            ctx.fillStyle = "#ff5533";
            ctx.fillRect(bx - 5, groundY - 16, 10, 10);
          }
        }

        const fx = sx + 108;
        const fw = 178;
        const fy = groundY - 28;
        ctx.fillStyle = "#0a2614";
        ctx.strokeStyle = col;
        ctx.fillRect(fx, fy, fw, 28);
        ctx.strokeRect(fx, fy, fw, 28);
        ctx.beginPath();
        for (let t = 0; t < 4; t++) {
          const tx = fx + t * 44;
          ctx.moveTo(tx, fy);
          ctx.lineTo(tx, fy - 12);
          ctx.lineTo(tx + 44, fy);
        }
        ctx.fill();
        ctx.stroke();

        for (let sIdx = 0; sIdx < 3; sIdx++) {
          const stX = fx + 32 + sIdx * 52;
          ctx.fillStyle = "#081f10";
          ctx.fillRect(stX, fy - 30, 10, 30);
          ctx.strokeRect(stX, fy - 30, 10, 30);
          if (powered) {
            const smokeShift = ((timeBucket + sIdx) % 4) * 4;
            ctx.fillStyle = "#7be896";
            ctx.fillRect(stX + 2 + smokeShift, fy - 38, 8, 5);
          }
        }
      },
    });

    // =========================================================================
    // RIGHT 38% OF SCREEN: DEDICATED K.O.M.R.A.D.-84 AI CHAT & COMM LOG PANEL
    // =========================================================================
    ctx.fillStyle = "rgba(2, 12, 6, 0.96)";
    ctx.fillRect(chatX, chatY, chatW, chatH);
    ctx.strokeStyle = "#39ff14";
    ctx.lineWidth = 3;
    ctx.strokeRect(chatX, chatY, chatW, chatH);

    // Tall 2-Row Sub-window Header (+45% larger bold text, zero overlap!)
    ctx.fillStyle = "rgba(14, 58, 28, 0.94)";
    ctx.fillRect(chatX + 2, chatY + 2, chatW - 4, 72);
    ctx.strokeStyle = "#39ff14";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(chatX + 2, chatY + 74);
    ctx.lineTo(chatX + chatW - 2, chatY + 74);
    ctx.stroke();

    ctx.font = '900 30px "VT323", "Consolas", monospace';
    ctx.textAlign = "left";
    drawHeavyCrtText(
      ctx,
      "K.O.M.R.A.D.-84 // COMMS",
      chatX + 14,
      chatY + 31,
      "#39ff14",
      0.85,
    );

    const hasActivePrinterPaper =
      deskState.printingDoc !== null ||
      deskState.documents.length > 0 ||
      deskState.packedDoc !== null ||
      deskState.capsuleState !== "CRADLE_EMPTY";
    const activeQuotaMandate =
      state.activeMandate &&
      !state.activeMandate.fulfilled &&
      state.activeMandate.complianceRemainingSec !== undefined
        ? state.activeMandate
        : null;
    ctx.font = '900 28px "VT323", "Consolas", monospace';
    if (state.komradOverrideLocked) {
      drawHeavyCrtText(
        ctx,
        "AI LOCK ACTIVE!",
        chatX + 14,
        chatY + 64,
        "#ff2a2a",
        0.85,
      );
    } else if (activeQuotaMandate) {
      const remS = Math.max(
        0,
        Math.ceil(activeQuotaMandate.complianceRemainingSec ?? 0),
      );
      drawHeavyCrtText(
        ctx,
        `QUOTA WINDOW: [${remS}s] (HOLD 50.0 HZ)`,
        chatX + 14,
        chatY + 64,
        remS <= 15 ? "#ff2a2a" : "#ffe600",
        0.85,
      );
    } else if (hasActivePrinterPaper) {
      drawHeavyCrtText(
        ctx,
        "PRINTER: DIRECTIVE IN CARRIAGE",
        chatX + 14,
        chatY + 64,
        "#ffe600",
        0.85,
      );
    } else {
      drawHeavyCrtText(
        ctx,
        `NEXT TRANSMISSION IN: [${Math.max(0, cdSec)}s]`,
        chatX + 14,
        chatY + 64,
        "#00f0ff",
        0.85,
      );
    }

    // Bottom Advisory Strip Across Regional Map Panel when an Alarm or Hover Diagnostic is Active
    if (contextualHint) {
      const stripX = mapX + 8;
      const stripY = mapY + mapH - 46;
      const stripW = mapW - 16;
      const stripH = 40;
      const hintCrit =
        state.coreTemp >= 580 ||
        state.drumPressure >= 80 ||
        Boolean(state.turbines[0]?.tripped);
      ctx.fillStyle = "rgba(42, 24, 2, 0.97)";
      ctx.fillRect(stripX, stripY, stripW, stripH);
      ctx.strokeStyle =
        hintCrit && timeBucket % 2 === 1 ? "#ff2a2a" : "#ffb000";
      ctx.lineWidth = 3;
      ctx.strokeRect(stripX, stripY, stripW, stripH);
      ctx.font = '900 26px "VT323", "Consolas", monospace';
      ctx.textAlign = "center";
      drawHeavyCrtText(
        ctx,
        contextualHint,
        stripX + stripW / 2,
        stripY + 29,
        "#ffe600",
        0.85,
        stripW - 18,
      );
    }

    // Live Encrypted KGB Verification Trunk Intel Box when KGB LINE (UNIT C Switch 3) is ON
    let logStartOffset = 104;
    if (state.kgbLineActive) {
      const kgbBoxY = chatY + 82;
      const kgbBoxH = 112;
      const isSuspect = activeDeskDoc?.isForgery ?? false;
      ctx.fillStyle = activeDeskDoc
        ? isSuspect
          ? "rgba(64, 10, 10, 0.94)"
          : "rgba(6, 38, 22, 0.94)"
        : "rgba(6, 28, 34, 0.92)";
      ctx.fillRect(chatX + 10, kgbBoxY, chatW - 20, kgbBoxH);
      ctx.strokeStyle = activeDeskDoc
        ? isSuspect
          ? "#ff2a2a"
          : "#39ff14"
        : "#00f0ff";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(chatX + 10, kgbBoxY, chatW - 20, kgbBoxH);

      ctx.textAlign = "left";
      ctx.font = '900 26px "VT323", "Consolas", monospace';
      drawHeavyCrtText(
        ctx,
        activeDeskDoc
          ? `[KGB DECODE] ${activeDeskDoc.ministry.slice(0, 28)}`
          : "[KGB DECODE] TRUNK ONLINE (+10 MWe HOUSE)",
        chatX + 18,
        kgbBoxY + 30,
        "#00f0ff",
        0.8,
        chatW - 36,
      );

      ctx.font = '900 25px "VT323", "Consolas", monospace';
      if (!activeDeskDoc) {
        drawHeavyCrtText(
          ctx,
          "AWAITING NEXT PRAVDA-84 ORDER ON DESK...",
          chatX + 18,
          kgbBoxY + 62,
          "#44ff66",
          0.75,
          chatW - 36,
        );
        drawHeavyCrtText(
          ctx,
          "VERIFY SEAL, INK & FONT IN MANUAL [KEY 4].",
          chatX + 18,
          kgbBoxY + 94,
          "#ffe600",
          0.75,
          chatW - 36,
        );
      } else if (activeDeskDoc.isForgery) {
        const hintLine =
          activeDeskDoc.forgeryReason ??
          "WESTERN FORGERY DETECTED IN SEAL/INK/FONT!";
        const wrappedHint = wrapText(
          ctx,
          `FAKE: ${hintLine.toUpperCase()} — SHRED!`,
          chatW - 36,
        );
        wrappedHint.slice(0, 2).forEach((ln, idx) => {
          drawHeavyCrtText(
            ctx,
            ln,
            chatX + 18,
            kgbBoxY + 62 + idx * 30,
            "#ff2a2a",
            0.8,
            chatW - 36,
          );
        });
      } else {
        drawHeavyCrtText(
          ctx,
          `GENUINE: ${activeDeskDoc.sealType} VERIFIED.`,
          chatX + 18,
          kgbBoxY + 62,
          "#44ff66",
          0.8,
          chatW - 36,
        );
        drawHeavyCrtText(
          ctx,
          "STAMP [ОДОБРЕНО] & LAUNCH IN LEFT TUBE!",
          chatX + 18,
          kgbBoxY + 94,
          "#ffe600",
          0.8,
          chatW - 36,
        );
      }
      logStartOffset = 222;
    }

    // Scrolling Timestamped Comm Log Messages (+45% larger bold text, 26px)
    const aiBoxH = 268;
    const aiBoxY = chatY + chatH - aiBoxH - 8;
    ctx.textAlign = "left";
    ctx.font = '700 26px "Consolas", "Lucida Console", monospace';
    const logMaxW = chatW - 28;
    const recentEntries = state.terminalEntries.slice(
      state.kgbLineActive ? -4 : -7,
    );
    let cursorY = chatY + logStartOffset;
    const maxLogY = aiBoxY - 14;

    for (const entry of recentEntries) {
      if (cursorY > maxLogY) break;
      const logCol =
        entry.level === "danger"
          ? "#ff2a2a"
          : entry.level === "warn"
            ? "#ffd000"
            : "#39ff14";
      const rawLine = `[${entry.timestamp}] ${entry.sender}: ${entry.text}`;
      const wrapped = wrapText(ctx, rawLine, logMaxW);
      for (const line of wrapped.slice(0, 3)) {
        if (cursorY > maxLogY) break;
        drawHeavyCrtText(ctx, line, chatX + 14, cursorY, logCol, 0.75);
        cursorY += 32;
      }
      cursorY += 8;
    }

    // Blinking terminal block cursor
    if (timeBucket % 2 === 0 && !state.isBlackout) {
      ctx.fillStyle = "#39ff14";
      ctx.fillRect(
        chatX + 14,
        Math.min(maxLogY, cursorY - 22),
        14,
        24,
      );
    }

    // Tall Bottom >> VOLKOV TRAINING DRILL / >> K.O.M.R.A.D.-84 // LIVE DISPATCH Box
    const isDrillActive = state.tutorialPhase !== "COMPLETED";
    const drillBorderCol = isDrillActive ? "#39ff14" : "#2e9e4f";
    ctx.fillStyle = isDrillActive
      ? "rgba(32, 22, 2, 0.97)"
      : "rgba(22, 16, 2, 0.95)";
    ctx.fillRect(chatX + 8, aiBoxY, chatW - 16, aiBoxH);
    ctx.strokeStyle = drillBorderCol;
    ctx.lineWidth = isDrillActive ? 4 : 3;
    ctx.strokeRect(chatX + 8, aiBoxY, chatW - 16, aiBoxH);

    const isMultiPanelOrderActive =
      !isDrillActive && state.tutorialPrompt.header.startsWith(">> ACTIVE");
    const activeBoxHeader =
      isDrillActive || isMultiPanelOrderActive
        ? state.tutorialPrompt.header
        : ">> K.O.M.R.A.D.-84 // LIVE DISPATCH";
    ctx.font = '700 24px "Consolas", "Lucida Console", monospace';
    drawHeavyCrtText(
      ctx,
      activeBoxHeader,
      chatX + 20,
      aiBoxY + 34,
      "#44ff66",
      0.85,
      chatW - 40,
    );

    const activeBody =
      isDrillActive || isMultiPanelOrderActive
        ? state.tutorialPrompt.body
        : (latestChatMsg?.text ??
          contextualHint ??
          KOMRAD_DARK_HUMOR_BULLETINS[
            bulletinIdx % KOMRAD_DARK_HUMOR_BULLETINS.length
          ] ??
          state.tutorialPrompt.body);
    ctx.font = '700 22px "Consolas", "Lucida Console", monospace';
    const bLines = wrapText(ctx, activeBody, chatW - 44);
    bLines.slice(0, 4).forEach((ln, idx) => {
      drawHeavyCrtText(
        ctx,
        ln,
        chatX + 20,
        aiBoxY + 70 + idx * 31,
        "#ffe600",
        0.85,
        chatW - 40,
      );
    });

    const activeHintText =
      isDrillActive || isMultiPanelOrderActive
        ? state.tutorialPrompt.hint
        : (contextualHint ?? state.tutorialPrompt.hint);
    ctx.font = '700 20px "Consolas", "Lucida Console", monospace';
    const hLines = wrapText(ctx, activeHintText, chatW - 44);
    hLines.slice(0, 2).forEach((ln, idx) => {
      drawHeavyCrtText(
        ctx,
        ln,
        chatX + 20,
        aiBoxY + aiBoxH - 46 + idx * 26,
        "#44ff66",
        0.8,
        chatW - 40,
      );
    });

    // Prominent CRT Overlay Banner when in boot or end-of-shift state
    if (state.phase !== "playing") {
      ctx.fillStyle = "rgba(4, 20, 9, 0.96)";
      ctx.fillRect(220, 300, w - 440, 340);
      ctx.strokeStyle = state.phase === "boot" ? "#ffe600" : "#ff2a2a";
      ctx.lineWidth = 6;
      ctx.strokeRect(220, 300, w - 440, 340);

      ctx.textAlign = "center";
      ctx.fillStyle = state.phase === "boot" ? "#ffe600" : "#ff2a2a";
      ctx.font = 'bold 52px "Kremlin", monospace';
      const titleText =
        state.phase === "boot"
          ? "REACTOR NO. 4 // STANDBY"
          : `SHIFT TERMINATED: ${state.phase.toUpperCase()}`;
      ctx.fillText(titleText, w / 2, 398);

      ctx.font = '900 38px "VT323", "Consolas", monospace';
      drawHeavyCrtText(
        ctx,
        state.phase === "boot"
          ? "CLICK SCREEN TO START SHIFT"
          : "CLICK SCREEN TO RESET SHIFT",
        w / 2,
        482,
        "#39ff14",
        0.9,
      );

      ctx.font = '900 32px "VT323", "Consolas", monospace';
      drawHeavyCrtText(
        ctx,
        "[1-7] BAY FOCUS | [RMB] LEAN IN | 360° SWIVEL CHAIR",
        w / 2,
        568,
        "#ffe600",
        0.8,
      );
    }

    // Subtle CRT Scanlines
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    for (let y = 0; y < h; y += 6) {
      ctx.fillRect(0, y, w, 2);
    }

    ctx.restore();
    tex.needsUpdate = true;
  });

  return (
    <>
      <mesh
        geometry={curvedCrtGeometry}
        position={[0, 1.74, 0.145]}
        onClick={(e) => {
          e.stopPropagation();
          playSwitchClank();
          const s = useGameStore.getState();
          if (s.phase === "boot") {
            s.startShift();
            return;
          }
          if (s.phase !== "playing") {
            s.resetShift();
            return;
          }
          onCycleBulletin();
        }}
      >
        <meshStandardMaterial
          ref={crtMatRef}
          map={crtTexture}
          color="#0d1710"
          emissive="#ffffff"
          emissiveMap={crtTexture}
          emissiveIntensity={1.04}
          roughness={0.95}
          metalness={0.0}
        />
      </mesh>
      <mesh
        ref={diagOverlayMeshRef}
        geometry={curvedCrtGeometry}
        position={[0, 1.74, 0.147]}
        raycast={NOOP_RAYCAST}
        visible={false}
      >
        <meshBasicMaterial
          map={crtDiagOverlayTex}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </>
  );
});

/**
 * Recessed Soviet RBMK-1000 Coffered Acoustic Ceiling (`СВЕТОВОЙ ПОТОЛОК БЩУ-4`, `y = 3.90..4.20m`)
 * across the `12m × 9m` hall using `InstancedMesh` putty-grey coffer tiles and glowing warm-white
 * `#fff1d6` fluorescent tube troffers (with 2 aged/flickering gritty tubes).
 */
const SovietRbmkCofferedCeiling3D: React.FC = React.memo(() => {
  const tubeMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const dimTubeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const flickerTubeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const cofferTileInstRef = useRef<THREE.InstancedMesh>(null);

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
    const mesh = cofferTileInstRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
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
  }, []);

  useFrame(({ clock }) => {
    const s = useGameStore.getState();
    const t = clock.getElapsedTime();
    const isAlarm =
      s.coreTemp >= 750 ||
      s.powerAllocation.cooling +
        s.powerAllocation.defense +
        s.powerAllocation.facility >
        s.maxSafePower;
    const hzSag = Math.max(0, 49.7 - s.gridHz) * 0.45;
    const dipStrength = Math.min(1, s.voltageDipIntensity + hzSag);
    const humFlicker =
      dipStrength > 0.02
        ? 1 -
          dipStrength *
            (0.32 + 0.14 * Math.sin(t * 62.8) * Math.cos(t * 94.2))
        : 1.0;

    const baseIntensity = s.isBlackout
      ? 0.03
      : s.powerAllocation.facility <= 10
        ? 1.15 * humFlicker
        : 1.9 * humFlicker;
    const mainColor = s.isBlackout
      ? SCENE_COLOR_TUBE_BLACKOUT
      : isAlarm
        ? SCENE_COLOR_TUBE_ALARM
        : SCENE_COLOR_TUBE_NORM;

    for (let i = 0; i < tubeMatRefs.current.length; i++) {
      const mat = tubeMatRefs.current[i];
      if (!mat) continue;
      mat.emissive.copy(mainColor);
      mat.emissiveIntensity = baseIntensity;
    }

    // Aged/dimmed warm-amber gritty tube (35% output)
    if (dimTubeMatRef.current) {
      dimTubeMatRef.current.emissive.copy(
        s.isBlackout ? SCENE_COLOR_TUBE_DIM_BLACKOUT : SCENE_COLOR_TUBE_DIM,
      );
      dimTubeMatRef.current.emissiveIntensity = s.isBlackout
        ? 0.02
        : 0.65 * humFlicker;
    }

    // Subtle gritty starter-flicker tube
    if (flickerTubeMatRef.current) {
      if (s.isBlackout) {
        flickerTubeMatRef.current.emissive.copy(
          SCENE_COLOR_TUBE_FLICKER_BLACKOUT,
        );
        flickerTubeMatRef.current.emissiveIntensity = 0.02;
      } else {
        const pulse = Math.sin(t * 17.3) * Math.cos(t * 41.7);
        const sputter = pulse > 0.72 ? 0.35 : 0.92 + 0.08 * Math.sin(t * 11.0);
        flickerTubeMatRef.current.emissive.copy(SCENE_COLOR_TUBE_NORM);
        flickerTubeMatRef.current.emissiveIntensity = 1.75 * sputter * humFlicker;
      }
    }
  });

  const longitudinalXs = [-3.6, -1.2, 1.2, 3.6];
  const transverseZs = [-2.25, 0.0, 2.25];
  const troughZs = [-2.85, -0.85, 1.8];
  const tubeXs = [-3.25, -1.1, 1.1, 3.25];
  const baffleXs = [-4.0, -3.0, -2.0, -1.0, 0, 1.0, 2.0, 3.0, 4.0];

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

      {/* Long Glowing Warm-White Fluorescent Troffers with Louvered Cross-Baffles */}
      {troughZs.map((tz, tIdx) => (
        <group key={`ceil-trough-${tIdx}`} position={[0, 3.96, tz]}>
          {/* Steel Recessed Troffer Reflector Housing */}
          <mesh position={[0, 0.05, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[9.2, 0.08, 0.64]} />
            <meshStandardMaterial color="#232b28" metalness={0.64} roughness={0.46} />
          </mesh>
          <mesh position={[0, 0.006, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[8.9, 0.54]} />
            <meshStandardMaterial color="#8d948d" roughness={0.55} metalness={0.28} />
          </mesh>

          {/* Twin Rows of Glowing Fluorescent Tubes (`y = -0.015m`) */}
          {tubeXs.map((tx, xIdx) => (
            <React.Fragment key={`tube-pair-${tIdx}-${xIdx}`}>
              {([-0.14, 0.14] as const).map((dz, rowIdx) => {
                const isDim = tIdx === 1 && xIdx === 2 && rowIdx === 0;
                const isFlicker = tIdx === 0 && xIdx === 3 && rowIdx === 1;
                const refIdx = tIdx * 8 + xIdx * 2 + rowIdx;
                return (
                  <mesh
                    key={`fl-tube-${refIdx}`}
                    position={[tx, -0.012, dz]}
                    rotation={[0, 0, Math.PI / 2]}
                    raycast={NOOP_RAYCAST}
                  >
                    <cylinderGeometry args={[0.022, 0.022, 1.98, 10]} />
                    <meshStandardMaterial
                      ref={
                        isDim
                          ? dimTubeMatRef
                          : isFlicker
                            ? flickerTubeMatRef
                            : (el) => {
                                tubeMatRefs.current[refIdx] = el;
                              }
                      }
                      color={isDim ? "#e2a24c" : "#fff6e5"}
                      emissive={isDim ? "#e2a24c" : "#fff1d6"}
                      emissiveIntensity={isDim ? 0.65 : 1.9}
                      roughness={0.25}
                    />
                  </mesh>
                );
              })}
            </React.Fragment>
          ))}

          {/* Louvered Steel Cross-Baffles */}
          {baffleXs.map((bx, bIdx) => (
            <mesh key={`baffle-${tIdx}-${bIdx}`} position={[bx, -0.018, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.032, 0.055, 0.58]} />
              <meshStandardMaterial color="#2c3531" metalness={0.58} roughness={0.48} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
});

/**
 * Industrial Control Room Clutter, Color-Coded Ceiling Piping, `СМ-2М` Magnetic Tape Cabinets,
 * 3 Wheeled Operator Swivel Chairs, and Red Wall Fire-Shield (`ПОЖАРНЫЙ ЩИТ №4`).
 */
const SovietIndustrialPipingAndProps3D: React.FC = React.memo(() => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  const reelRefs = useRef<Array<THREE.Group | null>>([]);
  const ledMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);

  const fireShieldTex = useMemo(
    () =>
      createNearestCanvasTexture(512, 320, (ctx, w, h) => {
        ctx.fillStyle = "#f0ece0";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8221a";
        ctx.lineWidth = 14;
        ctx.strokeRect(7, 7, w - 14, h - 14);
        ctx.fillStyle = "#b8221a";
        ctx.fillRect(14, 14, w - 28, 56);
        ctx.fillStyle = "#ffffff";
        ctx.font = 'bold 30px "Kremlin", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("ПОЖАРНЫЙ ЩИТ №4 // БЩУ-4", w / 2, 52);
        ctx.fillStyle = "#141414";
        ctx.font = 'bold 20px "Courier Prime", monospace';
        ctx.fillText("ПРИ ПОЖАРЕ ЗВОНИТЬ 01", w / 2, h - 22);
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
        ctx.font = 'bold 22px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("ЭВМ СМ-2М // НМЛ", w / 2, 40);
      }),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const s = useGameStore.getState();

    // Animate spinning 3D magnetic tape reels with realistic forward/pause/rewind seek bursts
    for (let i = 0; i < reelRefs.current.length; i++) {
      const reel = reelRefs.current[i];
      if (!reel) continue;
      if (s.isBlackout) continue;
      const cycle = (t * 0.7 + i * 1.37) % 4.0;
      const dir = cycle < 2.2 ? 1 : cycle < 2.9 ? 0 : -1.4;
      reel.rotation.z -= dir * 0.045;
    }

    // Animate blinking LED register strips on СМ-2М tape cabinets
    for (let i = 0; i < ledMatRefs.current.length; i++) {
      const mat = ledMatRefs.current[i];
      if (!mat) continue;
      if (s.isBlackout) {
        mat.emissiveIntensity = 0.04;
      } else {
        const bit = Math.floor(t * (2.5 + (i % 4) * 1.1) + i * 3) % 3;
        mat.emissiveIntensity = bit === 0 ? 1.8 : 0.25;
      }
    }
  });

  const pipeLines = [
    { y: 3.76, color: "#b8241e", offset: 0.14 }, // Crimson-Red Fire Line
    { y: 3.66, color: "#e09f18", offset: 0.26 }, // Yellow Gas / Instrument Air Line
    { y: 3.56, color: "#626c68", offset: 0.38 }, // Galvanized Grey Conduit
  ] as const;

  const chairConfigs = [
    { pos: [-4.08, 0.016, -0.1] as const, rotY: 0.42, cushion: "#4a1e1a" },
    { pos: [4.08, 0.016, -0.1] as const, rotY: -0.42, cushion: "#4a1e1a" },
  ] as const;
  const starAngles = [0, 1, 2, 3, 4].map((i) => (i * Math.PI * 2) / 5);

  const renderTapeDriveBay = (bayPrefix: string, baseIdx: number, xOffset: number) => (
    <group key={bayPrefix} position={[xOffset, 1.48, 0.29]}>
      {/* Dark Recessed Drive Window Cavity */}
      <mesh raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.56, 0.62, 0.04]} />
        <meshStandardMaterial color="#101513" metalness={0.62} roughness={0.45} />
      </mesh>
      {/* Twin Spinning 3D Magnetic Tape Reels */}
      {([-0.14, 0.14] as const).map((rx, rIdx) => (
        <group
          key={`${bayPrefix}-reel-${rIdx}`}
          position={[rx, 0.08, 0.026]}
          ref={(el) => {
            reelRefs.current[baseIdx + rIdx] = el;
          }}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.115, 0.115, 0.022, 18]} />
            <meshStandardMaterial color="#2a2824" roughness={0.42} metalness={0.55} />
          </mesh>
          <mesh position={[0, 0, 0.013]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.042, 0.042, 0.012, 12]} />
            <meshStandardMaterial color="#c4ccd0" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.072, 0.014]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.022, 0.056, 0.008]} />
            <meshStandardMaterial color="#e6dec3" roughness={0.5} />
          </mesh>
        </group>
      ))}
      {/* Glass Door Frame Strip & Blinking LED Register Row */}
      <mesh position={[0, -0.18, 0.024]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.48, 0.08, 0.014]} />
        <meshStandardMaterial color="#181f1c" metalness={0.65} roughness={0.44} />
      </mesh>
      {[-0.18, -0.09, 0, 0.09, 0.18].map((lx, lIdx) => {
        const col = lIdx === 0 ? "#ff2a2a" : lIdx < 3 ? "#ffb000" : "#33ff66";
        const ledIdx = baseIdx * 3 + lIdx;
        return (
          <mesh key={`${bayPrefix}-led-${lIdx}`} position={[lx, -0.18, 0.034]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.026, 0.018, 0.008]} />
            <meshStandardMaterial
              ref={(el) => {
                ledMatRefs.current[ledIdx] = el;
              }}
              color={col}
              emissive={col}
              emissiveIntensity={1.4}
            />
          </mesh>
        );
      })}
    </group>
  );

  return (
    <group>
      {/* 1. Color-Coded Soviet Ceiling & Corner Industrial Piping (Clear of Both Windows & Doors) */}
      {pipeLines.map((pipe, pIdx) => (
        <group key={`ceil-pipe-set-${pIdx}`}>
          {/* Left Wall Overhead Run (`x = -5.82`, `z = -4.2..+4.2`) */}
          <mesh
            position={[-5.92 + pipe.offset, pipe.y, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.036, 0.036, 8.6, 10]} />
            <meshStandardMaterial color={pipe.color} metalness={0.56} roughness={0.42} />
          </mesh>
          {/* Right Wall Overhead Run (`x = +5.82`, above Window 1 lintel `y = 2.85m`) */}
          <mesh
            position={[5.92 - pipe.offset, pipe.y, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.036, 0.036, 8.6, 10]} />
            <meshStandardMaterial color={pipe.color} metalness={0.56} roughness={0.42} />
          </mesh>
          {/* Front & Rear Wall Overhead Runs (`z = ±4.34`, well above doors & windows) */}
          <mesh
            position={[0, pipe.y, -4.42 + pipe.offset]}
            rotation={[0, 0, Math.PI / 2]}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.034, 0.034, 11.4, 10]} />
            <meshStandardMaterial color={pipe.color} metalness={0.56} roughness={0.42} />
          </mesh>
          <mesh
            position={[0, pipe.y, 4.42 - pipe.offset]}
            rotation={[0, 0, Math.PI / 2]}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.034, 0.034, 11.4, 10]} />
            <meshStandardMaterial color={pipe.color} metalness={0.56} roughness={0.42} />
          </mesh>
          {/* 4 Corner Vertical Pipe Risers */}
          {(
            [
              [-5.92 + pipe.offset, -4.3],
              [5.92 - pipe.offset, -4.3],
              [-5.92 + pipe.offset, 4.3],
              [5.92 - pipe.offset, 4.3],
            ] as const
          ).map(([rx, rz], rIdx) => (
            <mesh key={`corner-riser-${pIdx}-${rIdx}`} position={[rx, pipe.y * 0.5, rz]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.032, 0.032, pipe.y, 10]} />
              <meshStandardMaterial color={pipe.color} metalness={0.56} roughness={0.42} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Flanged Gate Valve Handwheels on Left & Right Overhead Fire/Air Lines */}
      {([-5.78, 5.78] as const).map((vx, idx) => (
        <mesh
          key={`pipe-valve-${idx}`}
          position={[vx, 3.76, -0.6]}
          rotation={[0, 0, Math.PI / 2]}
          raycast={NOOP_RAYCAST}
        >
          <torusGeometry args={[0.09, 0.016, 8, 16]} />
          <meshStandardMaterial color="#d42b22" metalness={0.4} roughness={0.45} />
        </mesh>
      ))}

      {/* 2. Three Wheeled Soviet Leatherette Operator Swivel Chairs Along Main Console Arc */}
      {chairConfigs.map((ch, cIdx) => (
        <group key={`op-chair-${cIdx}`} position={[ch.pos[0], ch.pos[1], ch.pos[2]]} rotation={[0, ch.rotY, 0]}>
          <mesh position={[0, 0.045, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.068, 0.088, 0.075, 14]} />
            <meshStandardMaterial color="#1a211e" metalness={0.72} roughness={0.44} />
          </mesh>
          <mesh position={[0, 0.21, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.03, 0.038, 0.34, 12]} />
            <meshStandardMaterial color="#8c969c" metalness={0.86} roughness={0.28} />
          </mesh>
          {starAngles.map((ang, sIdx) => (
            <group key={`op-leg-${cIdx}-${sIdx}`} rotation={[0, ang, 0]}>
              <mesh position={[0, 0.036, 0.15]} rotation={[0.08, 0, 0]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.038, 0.03, 0.27]} />
                <meshStandardMaterial color="#1c2320" metalness={0.68} roughness={0.46} />
              </mesh>
              <mesh position={[0, 0.018, 0.265]} rotation={[0, 0, Math.PI / 2]} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.02, 0.02, 0.024, 10]} />
                <meshStandardMaterial color="#101211" roughness={0.82} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.4, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.45, 0.07, 0.44]} />
            <meshStandardMaterial color={ch.cushion} roughness={0.66} metalness={0.1} />
          </mesh>
          <mesh position={[0, 0.6, 0.22]} rotation={[0.1, 0, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.072, 0.38, 0.028]} />
            <meshStandardMaterial color="#1e2623" metalness={0.68} roughness={0.44} />
          </mesh>
          <mesh position={[0, 0.74, 0.2]} rotation={[0.08, 0, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.42, 0.34, 0.06]} />
            <meshStandardMaterial color={ch.cushion} roughness={0.66} metalness={0.1} />
          </mesh>
          {([-0.23, 0.23] as const).map((ax, aIdx) => (
            <mesh key={`op-arm-${aIdx}`} position={[ax, 0.53, 0.01]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.04, 0.028, 0.31]} />
              <meshStandardMaterial color="#1a1817" roughness={0.58} metalness={0.25} />
            </mesh>
          ))}
        </group>
      ))}

      {/* 3. Front-Left Twin-Bay `СМ-2М` Magnetic Tape Computer Cabinet (`[-5.56, 0, -1.96]`) */}
      <group position={[-5.56, 0, -1.96]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 1.14, 0]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.52, 2.28, 0.56]} />
          <meshStandardMaterial
            color="#2f443e"
            metalness={0.46}
            roughness={0.54}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>
        <mesh position={[0, 2.1, 0.285]} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.92, 0.2]} />
          <meshStandardMaterial map={sm2mNameplateTex} roughness={0.48} />
        </mesh>
        {renderTapeDriveBay("sm2m-fl-1", 0, -0.36)}
        {renderTapeDriveBay("sm2m-fl-2", 2, 0.36)}
        {[-0.36, 0.36].map((dx, dIdx) => (
          <mesh key={`sm2m-fl-door-${dIdx}`} position={[dx, 0.54, 0.286]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.64, 0.88, 0.018]} />
            <meshStandardMaterial color="#21302a" metalness={0.54} roughness={0.52} />
          </mesh>
        ))}
      </group>

      {/* 4. Front-Right Single-Bay `СМ-2М` Tape Computer Cabinet (`[5.56, 0, -2.50]`, clear of Window 1) */}
      <group position={[5.56, 0, -2.5]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, 1.14, 0]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.04, 2.28, 0.54]} />
          <meshStandardMaterial
            color="#2f443e"
            metalness={0.46}
            roughness={0.54}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>
        <mesh position={[0, 2.1, 0.275]} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.84, 0.18]} />
          <meshStandardMaterial map={sm2mNameplateTex} roughness={0.48} />
        </mesh>
        {renderTapeDriveBay("sm2m-fr-1", 4, 0)}
        <mesh position={[0, 0.54, 0.276]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.84, 0.88, 0.018]} />
          <meshStandardMaterial color="#21302a" metalness={0.54} roughness={0.52} />
        </mesh>
      </group>

      {/* 5. Red Soviet Wall Fire-Shield (`ПОЖАРНЫЙ ЩИТ №4`) & Sand Box Near Rear Door (`[-4.05, 0, 4.39]`) */}
      <group position={[-4.05, 0, 4.39]} rotation={[0, Math.PI, 0]}>
        {/* Red & White Wall Fire-Shield Board (`y = 0.78..1.98m`) */}
        <mesh position={[0, 1.38, 0]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.18, 1.2, 0.04]} />
          <meshStandardMaterial color="#b8221a" roughness={0.55} metalness={0.22} />
        </mesh>
        <mesh position={[0, 1.38, 0.024]} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[1.1, 1.12]} />
          <meshStandardMaterial map={fireShieldTex} roughness={0.58} />
        </mesh>
        {/* Two Red Cone Fire Buckets (`Ведро-конус`) */}
        {([-0.34, -0.06] as const).map((bx, bIdx) => (
          <mesh
            key={`fire-cone-${bIdx}`}
            position={[bx, 1.26, 0.11]}
            rotation={[Math.PI, 0, 0]}
            raycast={NOOP_RAYCAST}
          >
            <coneGeometry args={[0.105, 0.28, 12]} />
            <meshStandardMaterial color="#c81e1a" roughness={0.44} metalness={0.26} />
          </mesh>
        ))}
        {/* Red `ОУ-5` CO2 Fire Extinguisher & Black Horn */}
        <group position={[0.34, 1.14, 0.12]}>
          <mesh raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.078, 0.078, 0.42, 12]} />
            <meshStandardMaterial color="#c81e1a" roughness={0.38} metalness={0.34} />
          </mesh>
          <mesh position={[0, 0.24, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.018, 0.024, 0.08, 8]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.86}
              roughness={0.26}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
          <mesh position={[-0.07, 0.16, 0.03]} rotation={[0.2, 0, 0.4]} raycast={NOOP_RAYCAST}>
            <coneGeometry args={[0.038, 0.14, 10]} />
            <meshStandardMaterial color="#141414" roughness={0.65} />
          </mesh>
        </group>
        {/* Fire Crowbar & Axe */}
        <mesh position={[0.14, 1.26, 0.045]} rotation={[0, 0, 0.08]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.012, 0.012, 0.68, 8]} />
          <meshStandardMaterial color="#c81e1a" metalness={0.55} roughness={0.45} />
        </mesh>
        {/* Floor Sand Box (`ЯЩИК ДЛЯ ПЕСКА`) */}
        <mesh position={[0, 0.21, 0.16]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.98, 0.42, 0.34]} />
          <meshStandardMaterial color="#a61e18" roughness={0.62} metalness={0.24} />
        </mesh>
        <mesh position={[0, 0.425, 0.16]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.92, 0.02, 0.28]} />
          <meshStandardMaterial color="#b89b62" roughness={0.92} />
        </mesh>
      </group>
    </group>
  );
});

export const ControlRoomScene: React.FC = React.memo(() => {
  const bunkerArchRef = useRef<THREE.Group>(null);
  const reactorWrapRef = useRef<THREE.Group>(null);
  const terminalWrapRef = useRef<THREE.Group>(null);
  const inspectorWrapRef = useRef<THREE.Group>(null);
  const cloudTonedDownRef = useRef(false);
  const legacyBulletinTargetRef = useRef<THREE.Object3D | null>(null);
  const [bulletinIdx, setBulletinIdx] = useState(0);
  const ironTex = useMemo(() => getHammeredIronTextures(), []);

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

  const diamondPlateTex = useMemo(() => {
    const tex = createNearestCanvasTexture(64, 64, (ctx, w, h) => {
      ctx.fillStyle = "#48524e";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#2c3330";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
      for (let y = 8; y < h; y += 16) {
        for (let x = 8; x < w; x += 16) {
          ctx.fillStyle = "#6c7872";
          ctx.fillRect(x - 3, y - 1, 6, 2);
          ctx.fillStyle = "#5c6662";
          ctx.fillRect(x - 1, y - 3, 2, 6);
        }
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 2);
    return tex;
  }, []);

  const rubberMatTex = useMemo(() => {
    const tex = createNearestCanvasTexture(128, 64, (ctx, w, h) => {
      ctx.fillStyle = "#141615";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#d99b16";
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
      ctx.fillStyle = "#212523";
      for (let y = 8; y < h - 8; y += 8) {
        ctx.fillRect(6, y, w - 12, 3);
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
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
        ctx.font = 'bold 16px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("ЗОНА РБМК-4", w / 2, 108);
      }),
    [],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setBulletinIdx((prev) => prev + 1);
    }, 18000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    applySovietPBRToHierarchy(bunkerArchRef.current);
    applySovietPBRToHierarchy(reactorWrapRef.current);
    applySovietPBRToHierarchy(terminalWrapRef.current);

    for (const grp of [
      bunkerArchRef.current,
      reactorWrapRef.current,
      terminalWrapRef.current,
    ]) {
      grp?.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = false;
          obj.receiveShadow = false;
        }
      });
    }

    // 1. Hide the legacy toy-brick keyboard group, lower pedestal meshes & small CRT screen inside <TerminalStation3D />
    // 2. Scale up the CRT monitor bezel & cabinet width cleanly
    if (terminalWrapRef.current) {
      terminalWrapRef.current.traverse((obj) => {
        if (
          obj.userData?.isDvk84Replacement ||
          obj.parent?.userData?.isDvk84Replacement
        ) {
          return;
        }
        if ((obj as THREE.Mesh).isMesh) {
          obj.raycast = NOOP_RAYCAST;
          obj.castShadow = false;
          obj.receiveShadow = false;
        }
        // Widen rear cabinet box to frame the enlarged CRT housing
        if (
          (obj as THREE.Mesh).isMesh &&
          Math.abs(obj.position.y - 1.01) < 0.05 &&
          Math.abs(obj.position.z - -0.18) < 0.05
        ) {
          obj.scale.set(1.58, 1.32, 1);
        }
        // Scale CRT outer bezel box and shift Y upward to y = 1.74
        if (
          (obj as THREE.Mesh).isMesh &&
          Math.abs(obj.position.y - 1.4) < 0.03 &&
          Math.abs(obj.position.z - 0.02) < 0.03
        ) {
          obj.position.y = 1.74;
          obj.scale.set(1.58, 1.48, 1);
        }
        // Hide the legacy smaller 512x352 CRT glass mesh (replaced by <Komrad84SplitScreenCrt3D />)
        if (
          (obj as THREE.Mesh).isMesh &&
          Math.abs(obj.position.y - 1.4) < 0.03 &&
          Math.abs(obj.position.z - 0.135) < 0.03
        ) {
          obj.visible = false;
          obj.raycast = NOOP_RAYCAST;
        }
        if (
          obj.type === "Group" &&
          Math.abs(obj.position.y - 0.81) < 0.025 &&
          Math.abs(obj.position.z - 0.19) < 0.025
        ) {
          for (const child of obj.children) {
            if (Math.abs(child.position.x - 0.45) < 0.05) {
              legacyBulletinTargetRef.current = child;
            }
          }
          obj.visible = false;
          obj.traverse((sub) => {
            if ((sub as THREE.Mesh).isMesh) {
              sub.raycast = NOOP_RAYCAST;
            }
          });
          return;
        }
        // Hide any remaining legacy lower pedestal meshes (relY < 0.88) from <TerminalStation3D />
        if ((obj as THREE.Mesh).isMesh) {
          let relY = obj.position.y;
          let p = obj.parent;
          while (p && p !== terminalWrapRef.current) {
            relY += p.position.y;
            p = p.parent;
          }
          if (relY < 0.88) {
            obj.visible = false;
            obj.raycast = NOOP_RAYCAST;
          }
        }
      });
    }
  }, []);

  // Tone down the Inspector Desk pneumatic-tube particle cloud by ~60% without touching InspectorDesk3D.tsx
  useFrame(() => {
    if (cloudTonedDownRef.current) return;
    const root = inspectorWrapRef.current;
    if (!root) return;
    root.traverse((obj) => {
      if (obj instanceof THREE.Points) {
        obj.raycast = NOOP_RAYCAST;
        if (!obj.userData.__cloudTonedDown) {
          obj.userData.__cloudTonedDown = true;
          if (obj.material instanceof THREE.PointsMaterial) {
            obj.material.opacity *= 0.38;
            obj.material.size *= 0.78;
            obj.material.needsUpdate = true;
          }
        }
        cloudTonedDownRef.current = true;
      }
    });
  });

  const handleCycleBulletin = useCallback(() => {
    setBulletinIdx((prev) => prev + 1);
    const target = legacyBulletinTargetRef.current as
      | (THREE.Object3D & {
          __r3f?: { handlers?: { onClick?: (ev: { stopPropagation: () => void }) => void } };
        })
      | null;
    if (target?.__r3f?.handlers?.onClick) {
      target.__r3f.handlers.onClick({ stopPropagation: () => {} });
    }
  }, []);

  const hallPillars = [
    { pos: [-5.86, -4.36] as const, plaqueDir: null },
    { pos: [5.86, -4.36] as const, plaqueDir: null },
    { pos: [-5.86, 4.36] as const, plaqueDir: null },
    { pos: [5.86, 4.36] as const, plaqueDir: null },
    { pos: [-2.4, -4.38] as const, plaqueDir: [0, 0, 0.162, 0] as const },
    { pos: [2.4, -4.38] as const, plaqueDir: [0, 0, 0.162, 0] as const },
    { pos: [-2.4, 4.38] as const, plaqueDir: [0, 0, -0.162, Math.PI] as const },
    { pos: [1.46, 4.38] as const, plaqueDir: [0, 0, -0.162, Math.PI] as const },
    { pos: [-5.88, -1.6] as const, plaqueDir: [0.162, 0, 0, Math.PI / 2] as const },
    { pos: [-5.88, 1.6] as const, plaqueDir: [0.162, 0, 0, Math.PI / 2] as const },
    { pos: [5.88, -1.92] as const, plaqueDir: [-0.162, 0, 0, -Math.PI / 2] as const },
    { pos: [5.88, 2.32] as const, plaqueDir: [-0.162, 0, 0, -Math.PI / 2] as const },
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
          SOVIET RBMK-1000 БЩУ HALL ARCHITECTURE (`12.0m × 9.0m × 4.2m`)
         ============================================================ */}
      <group ref={bunkerArchRef}>
        {/* Subfloor & Warm Terracotta-Ochre / Slate-Checkered Linoleum Floor (`y = 0`) */}
        <mesh
          position={[0, -0.02, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={NOOP_RAYCAST}
        >
          <planeGeometry args={[HALL_HALF_W * 2 + 0.6, HALL_HALF_D * 2 + 0.6]} />
          <meshStandardMaterial color="#181b19" roughness={0.94} metalness={0.14} />
        </mesh>

        <mesh
          position={[0, 0.001, 0]}
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

        {/* Metallic Diamond-Plate Cable Trench Covers (`Рифлёная сталь`) Along Console Bases & To Synoptic Wall */}
        {[
          { pos: [-3.22, 0.006, -1.56] as const, rotY: (15 * Math.PI) / 180, args: [3.34, 0.012, 0.44] as const },
          { pos: [3.22, 0.006, -1.56] as const, rotY: -(15 * Math.PI) / 180, args: [3.34, 0.012, 0.44] as const },
          { pos: [-2.2, 0.006, -2.72] as const, rotY: 0, args: [0.46, 0.012, 2.02] as const },
          { pos: [2.2, 0.006, -2.72] as const, rotY: 0, args: [0.46, 0.012, 2.02] as const },
          { pos: [0, 0.006, -3.52] as const, rotY: 0, args: [9.8, 0.012, 0.44] as const },
          { pos: [-4.22, 0.006, 1.35] as const, rotY: 0, args: [0.54, 0.012, 3.6] as const },
          { pos: [0, 0.006, 1.8] as const, rotY: 0, args: [2.85, 0.012, 1.45] as const },
        ].map((plate, pIdx) => (
          <mesh
            key={`cable-trench-${pIdx}`}
            position={[plate.pos[0], plate.pos[1], plate.pos[2]]}
            rotation={[0, plate.rotY, 0]}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[plate.args[0], plate.args[1], plate.args[2]]} />
            <meshStandardMaterial
              map={diamondPlateTex}
              color="#7a8580"
              metalness={0.68}
              roughness={0.44}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
        ))}

        {/* Black Ribbed Rubber Anti-Static Operator Walkway Mats Along Console Fronts */}
        {[
          { pos: [-3.0, 0.008, -0.36] as const, rotY: (15 * Math.PI) / 180, args: [3.26, 0.012, 0.82] as const },
          { pos: [3.0, 0.008, -0.36] as const, rotY: -(15 * Math.PI) / 180, args: [3.26, 0.012, 0.82] as const },
          { pos: [-3.94, 0.008, 1.35] as const, rotY: Math.PI / 2, args: [2.2, 0.012, 0.7] as const },
        ].map((mat, mIdx) => (
          <mesh
            key={`anti-static-mat-${mIdx}`}
            position={[mat.pos[0], mat.pos[1], mat.pos[2]]}
            rotation={[0, mat.rotY, 0]}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[mat.args[0], mat.args[1], mat.args[2]]} />
            <meshStandardMaterial map={rubberMatTex} roughness={0.84} metalness={0.1} />
          </mesh>
        ))}

        {/* Front Wall (`z = -4.5`) & Left Wall (`x = -6.0`, `UNIT D`) — Two-Tone Olive Wainscot + Dual Rail + Putty Acoustic Upper */}
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
            {/* Dark Steel Skirting (`y = 0..0.16m`) */}
            <mesh position={[0, 0.08, 0.025]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[w.span, 0.16, 0.04]} />
              <meshStandardMaterial color="#1f2824" roughness={0.56} metalness={0.52} />
            </mesh>
            {/* Dual Brushed Aluminum & Dark-Brass Dado Trim Rail (`y = 1.55m`) */}
            <mesh position={[0, 1.535, 0.022]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[w.span, 0.024, 0.042]} />
              <meshStandardMaterial color="#b8a46b" roughness={0.34} metalness={0.82} />
            </mesh>
            <mesh position={[0, 1.565, 0.024]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[w.span, 0.034, 0.048]} />
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
          {/* Continuous Floor Skirting (`9.0m`) */}
          <mesh position={[0, 0.08, 0.025]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[HALL_HALF_D * 2, 0.16, 0.04]} />
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
              <mesh position={[0, 1.535, 0.022]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[flank.w, 0.024, 0.042]} />
                <meshStandardMaterial color="#b8a46b" roughness={0.34} metalness={0.82} />
              </mesh>
              <mesh position={[0, 1.565, 0.024]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[flank.w, 0.034, 0.048]} />
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

        {/* Rear Wall (`z = +4.5`, `rotY = Math.PI`) Framed Around Window 2 (`worldX = +1.70..+5.30`, `y = 1.05..2.85`) */}
        <group position={[0, 0, HALL_HALF_D]} rotation={[0, Math.PI, 0]}>
          {/* Continuous Floor Skirting (`12.0m`) */}
          <mesh position={[0, 0.08, 0.025]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[HALL_HALF_W * 2, 0.16, 0.04]} />
            <meshStandardMaterial color="#1f2824" roughness={0.56} metalness={0.52} />
          </mesh>
          {/* Full-Height Left/Door Section (`worldX = -6.0..+1.70`, `lx = +2.15`) & Right Corner Strip (`worldX = +5.30..+6.0`, `lx = -5.65`) */}
          {(
            [
              { cx: 2.15, w: 7.7 },
              { cx: -5.65, w: 0.7 },
            ] as const
          ).map((flank, fIdx) => (
            <group key={`rear-flank-${fIdx}`} position={[flank.cx, 0, 0]}>
              <mesh position={[0, 0.775, -0.06]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[flank.w, 1.55, 0.14]} />
                <meshStandardMaterial map={wainscotWallTex} color="#4d6658" roughness={0.72} metalness={0.28} />
              </mesh>
              <mesh position={[0, 1.535, 0.022]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[flank.w, 0.024, 0.042]} />
                <meshStandardMaterial color="#b8a46b" roughness={0.34} metalness={0.82} />
              </mesh>
              <mesh position={[0, 1.565, 0.024]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[flank.w, 0.034, 0.048]} />
                <meshStandardMaterial color="#9aa49e" roughness={0.36} metalness={0.78} />
              </mesh>
              <mesh position={[0, 2.89, -0.06]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[flank.w, 2.62, 0.14]} />
                <meshStandardMaterial map={acousticWallTex} color="#d8ddd6" roughness={0.84} metalness={0.12} />
              </mesh>
            </group>
          ))}
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
            {/* Steel Base Boot (`y = 0..0.28m`) */}
            <mesh position={[0, 0.14, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.34, 0.28, 0.34]} />
              <meshStandardMaterial color="#1f2623" metalness={0.62} roughness={0.5} />
            </mesh>
            {/* Safety-Ochre Hazard Band & Crimson Red Stripe (`y = 1.08..1.50m`) */}
            <mesh position={[0, 1.24, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.325, 0.22, 0.325]} />
              <meshStandardMaterial map={pillarHazardTex} roughness={0.52} />
            </mesh>
            <mesh position={[0, 1.42, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.325, 0.12, 0.325]} />
              <meshStandardMaterial color="#c8221c" roughness={0.48} metalness={0.22} />
            </mesh>
            {/* Bolted Radiation Warning Placard Facing Control Room Hall */}
            {pil.plaqueDir && (
              <mesh
                position={[pil.plaqueDir[0], 1.72, pil.plaqueDir[2]]}
                rotation={[0, pil.plaqueDir[3], 0]}
                raycast={NOOP_RAYCAST}
              >
                <planeGeometry args={[0.2, 0.2]} />
                <meshStandardMaterial map={pillarWarningPlaqueTex} roughness={0.45} />
              </mesh>
            )}
          </group>
        ))}

        {/* Overhead Ceiling Slab (`y = 4.19m`) & Overhead Cable Trays */}
        <mesh
          position={[0, HALL_CEILING_Y - 0.01, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          raycast={NOOP_RAYCAST}
        >
          <planeGeometry args={[HALL_HALF_W * 2, HALL_HALF_D * 2]} />
          <meshStandardMaterial color="#2a312e" roughness={0.86} metalness={0.24} />
        </mesh>

        {([-4.8, 4.8] as const).map((xTray, idx) => (
          <mesh
            key={`overhead-tray-x-${idx}`}
            position={[xTray, 3.82, 0]}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.42, 0.055, 8.4]} />
            <meshStandardMaterial color="#34403b" metalness={0.66} roughness={0.48} />
          </mesh>
        ))}

        {/* Coffered Acoustic Ceiling & Glowing Warm-White Fluorescent Troffers */}
        <SovietRbmkCofferedCeiling3D />

        {/* Color-Coded Industrial Ceiling Piping, 3 Swivel Chairs, СМ-2М Tape Cabinets & Fire-Shield */}
        <SovietIndustrialPipingAndProps3D />

        {/* Caged Industrial Tungsten Wall Sconces (`Плафон ВЗГ-200`) on Side Wall Columns */}
        <SovietWallPillarLamp3D position={[-5.71, 2.88, -1.6]} rotY={Math.PI / 2} />
        <SovietWallPillarLamp3D position={[-5.71, 2.88, 1.6]} rotY={Math.PI / 2} />
        <SovietWallPillarLamp3D position={[5.71, 2.88, 2.32]} rotY={-Math.PI / 2} />
        <SovietWallPillarLamp3D position={[5.71, 2.88, -1.92]} rotY={-Math.PI / 2} />

        {/* Front Curved 3-Part Synoptic Wall (`Мнемосхема`) & Side Instrument Cabinets */}
        <SovietRbmkFrontSynopticWall3D />

        {/* Rear Double Steel Entry Doors with Wired Glass & Signage (No Airlock Wheel Door) */}
        <SovietRearDoubleEntryDoors3D />

        {/* Left Wall Electrical Switchgear Cabinet Alcove Framing 1.25x `UNIT D` */}
        <SovietLeftWallSwitchgearAlcove3D />

        {/* Continuous ~10.4m Sloped 3-Bay Operator Console Plinth (`Пульт СИУР / СИУБ / СИУТ`) */}
        <SovietRbmkOperatorConsolePlinth3D />

        {/* Supervisor Desk Pedestal Surround & Swivel Chair (`Стол НСБ`) */}
        <SovietSupervisorDeskSurroundAndChair3D />
      </group>

      {/* Panoramic Exterior Observation Windows & Forced-Perspective Dioramas */}
      <ExteriorDioramas3D />

      {/* ============================================================
          ERGONOMIC INTERACTIVE STATIONS IN RBMK-1000 БЩУ HALL (1.37x Split Wing Consoles)
          - Front Synoptic Center: K.O.M.R.A.D.-84 Master CRT (`z = -3.96, y = 0.18, scale = 1.42`)
          - Operator Wing Left (`x = -3.22, z = -1.16, +15°`): UNIT A-2 (Core/Rods) & UNIT A (Cooling/MW)
          - Open Center Aisle (`x = -1.3..+1.3`): Clear unobstructed view of K.O.M.R.A.D.-84
          - Operator Wing Right (`x = +3.22, z = -1.16, -15°`): UNIT C (Battery/Grid) & UNIT B (Coolant/Pumps)
          - Left Wall Switchgear (`x = -4.6, z = +1.35, +90°`): UNIT D (1.25x)
          - Central Supervisor Desk (`x = 0.0, z = +1.8`): InspectorDesk3D
         ============================================================ */}

      {/* LEFT DESK (`x = -3.22, z = -1.16, +15°` inward): UNIT A-2 (Core & Rods) + UNIT A (Cooling & MW Levers) */}
      <group position={[-3.22, 0, -1.16]} rotation={[0, (15 * Math.PI) / 180, 0]}>
        <group position={[-0.78, 0.18, 0.08]} rotation={[-0.51, 0, 0]} scale={0.74}>
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

      {/* RIGHT DESK OUTER BAY (`x = +3.22, z = -1.16, -15°` inward): UNIT B (Drum Separators & Coolant Loop) */}
      <group position={[3.22, 0, -1.16]} rotation={[0, -(15 * Math.PI) / 180, 0]}>
        <group position={[0.8, 0.18, 0.08]} rotation={[-0.51, 0, 0]} scale={0.74}>
          <LeftRearWrapAroundPanel3D variant="rear" />
        </group>
      </group>

      {/* LEFT WALL SWITCHGEAR (`x = -4.6, z = +1.35, facing +X`): 1.25x UNIT D Breakers & Fuses */}
      <SovietRearAuxBreakerPanel3D />

      {/* CENTER UPPER SYNOPTIC WALL (`z = -3.96, y = 0.28`): K.O.M.R.A.D.-84 Master 1600x1000 CRT Screen */}
      <group
        position={TERMINAL_ROOT_POS}
        rotation={[TERMINAL_TILT_X, 0, 0]}
        scale={TERMINAL_SCALE}
      >
        <group ref={terminalWrapRef} position={[0, 0, 1.62]}>
          <TerminalStation3D />
          <group
            position={[0, 0, -1.62]}
            userData={{ isDvk84Replacement: true }}
          >
            <Komrad84SplitScreenCrt3D
              bulletinIdx={bulletinIdx}
              onCycleBulletin={handleCycleBulletin}
            />
          </group>
        </group>
      </group>

      {/* SHIFT SUPERVISOR DESK (`Стол НСБ` at `x = 0.0, z = +1.8`): <InspectorDesk3D /> */}
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

useGLTF.preload("./models/battery_grid_panel.glb");
