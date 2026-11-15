import { useGLTF } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import * as InspectorModule from "../modules/inspector";
import {
  getSkalaDiagFeedElement,
  getSkalaDiagFeedFrameSeq,
  getSkalaDiagFeedStartMs,
  isSkalaDiagFeedSyncing,
  playRheostatDetentClick,
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
import {
  CagedSovietJewelLamp3D,
  HighDetailManometer3D,
  HighDetailReactorPanel3D,
  LeftRearWrapAroundPanel3D,
  type MimicNodeSpec,
  type MimicSegmentSpec,
  makePlaqueTex,
  SovietBacklitIndicatorBlock3D,
  SovietCRTMonitorBay3D,
  SovietDvk84KeyboardConsole3D,
  SovietModularSteelCabinet3D,
} from "./MechanicalPanels3D";
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
  tex.anisotropy = 8;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
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
  ctx.fillText(`WHEEL ${d.wheelPct}%`, col3X + col3W - 12, colY + 25);

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
    advisorText = `> TURN [BATTERY -> GRID] WHEEL UP TO SUPPLY ${Math.round(d.energyDemandMW)} MW DEMAND`;
    advisorCol = !isStartup && absDelta > 90 ? "#ff4d4d" : "#ffb000";
  } else if (deltaDemand > 35) {
    advisorText = `> +${deltaDemand} MW OVER-DISPATCH: TURN [BATTERY -> GRID] WHEEL DOWN TO SAVE CHARGE`;
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
    <group position={[2.12, 0, -1.04]} rotation={[0, -0.42, 0]}>
      {/* 3D Soviet Bureaucratic Operator Desk */}
      <mesh position={[0, 0.44, 0]}>
        <boxGeometry args={[1.64, 0.88, 0.96]} />
        <meshStandardMaterial
          color="#23312b"
          roughness={0.78}
          metalness={0.35}
        />
      </mesh>
      <mesh position={[0, 0.89, 0]}>
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
 * Heavy Physical 3D Soviet Digital Shift Clock (`ЧАСЫ СМЕНЫ // ЭЛЕКТРОНИКА-7`)
 * Mounted directly centered on top of the `K.O.M.R.A.D.-84` terminal cabinet bezel,
 * angled ~8° downward toward the operator chair.
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
        ctx.fillStyle = "#1a1812";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#ffcc44";
        ctx.font = 'bold 21px "Kremlin", "Consolas", monospace';
        ctx.textAlign = "center";
        ctx.fillText("SHIFT CLOCK 00:00 - 06:00 // KOMRAD-7", w / 2, 40, w - 24);
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
        statusLampMatRef.current.color.set("#2a1212");
        statusLampMatRef.current.emissive.set("#ff2a2a");
        statusLampMatRef.current.emissiveIntensity =
          halfSecBucket % 2 === 0 ? 0.85 : 0.12;
      } else if (isEmergency || isFinalHour) {
        const pulse = 0.5 + 0.5 * Math.sin(now * 10.0);
        statusLampMatRef.current.color.set("#ff2a2a");
        statusLampMatRef.current.emissive.set("#ff2a2a");
        statusLampMatRef.current.emissiveIntensity = 1.1 + pulse * 1.4;
      } else {
        statusLampMatRef.current.color.set("#33ff66");
        statusLampMatRef.current.emissive.set("#33ff66");
        statusLampMatRef.current.emissiveIntensity = 1.25;
      }
    }

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

    // 1. Deep Recessed Dark VFD / Nixie Cavity Background
    ctx.fillStyle = s.isBlackout ? "#050404" : "#0b0d0c";
    ctx.fillRect(0, 0, w, h);

    // Subtle hexagonal/grid mesh lines inside vacuum fluorescent tube cavity
    ctx.strokeStyle = "rgba(255, 170, 60, 0.06)";
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
        ? "#ffaa00"
        : "#3d4845";
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    // Top micro-telemetry strip inside the clock glass
    ctx.fillStyle = "rgba(20, 26, 24, 0.92)";
    ctx.fillRect(8, 8, w - 16, 32);
    ctx.font = '700 18px "Kremlin", "Consolas", "Lucida Console", monospace';
    ctx.textAlign = "left";
    ctx.fillStyle = "#b8c4be";
    ctx.fillText(
      `SHIFT NO. ${s.shiftNumber} // CURRENT SHIFT TIME`,
      18,
      30,
    );
    ctx.textAlign = "right";
    ctx.fillStyle = isEmergency
      ? "#ff4444"
      : isFinalHour
        ? "#ffcc00"
        : "#39ff14";
    ctx.fillText(
      s.isBlackout
        ? "POWER FAILURE"
        : isEmergency
          ? "UNIT 4 ALERT"
          : isFinalHour
            ? "FINAL HOUR"
            : "NORMAL MODE",
      w - 18,
      30,
    );

    // Dim unlit 88:88 / 88:88 ghost segments behind active digits
    ctx.textAlign = "center";
    ctx.font = '900 108px "VT323", "Consolas", monospace';
    ctx.fillStyle = "rgba(255, 120, 30, 0.075)";
    ctx.fillText("88:88 / 88:88", w / 2 - 24, 146);

    // Glowing Primary 7-Segment Style Shift Clock Numerals (`00:00 / 06:00`)
    const mainDigitCol = s.isBlackout
      ? "#6e2218"
      : isEmergency
        ? "#ff3b1f"
        : isFinalHour
          ? "#ffaa00"
          : "#ff6a1a";
    const targetCol = s.isBlackout ? "#284430" : "#39ff14";
    const sep = colonOn || s.isBlackout ? ":" : " ";

    ctx.save();
    ctx.shadowColor = mainDigitCol;
    ctx.shadowBlur = s.isBlackout ? 2 : 12;
    ctx.fillStyle = mainDigitCol;
    ctx.textAlign = "right";
    ctx.fillText(`${hh}${sep}${mm}`, w / 2 + 10, 146);
    ctx.restore();

    ctx.save();
    ctx.font = '900 88px "VT323", "Consolas", monospace';
    ctx.shadowColor = targetCol;
    ctx.shadowBlur = s.isBlackout ? 0 : 8;
    ctx.fillStyle = targetCol;
    ctx.textAlign = "left";
    ctx.fillText(" / 06:00", w / 2 + 18, 142);
    ctx.restore();

    // Bottom Shift Progress Bar (00:00 -> 06:00)
    const barX = 18;
    const barY = h - 22;
    const barW = w - 36;
    const barH = 10;
    ctx.fillStyle = "#141a18";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = "#36443e";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX, barY, barW, barH);
    const progRatio = Math.max(0, Math.min(1, totalMins / 360));
    ctx.fillStyle = isEmergency
      ? "#ff2a2a"
      : isFinalHour
        ? "#ffaa00"
        : "#39ff14";
    ctx.fillRect(barX + 2, barY + 2, (barW - 4) * progRatio, barH - 4);

    tex.needsUpdate = true;
  });

  return (
    <group position={[0, 2.66, 0.18]} rotation={[0.14, 0, 0]}>
      {/* 1. Twin Heavy Bolted Steel Mounting Stanchions Anchoring Clock to Top of K.O.M.R.A.D.-84 */}
      {[-0.44, 0.44].map((sx, idx) => (
        <group key={`clk-stanchion-${idx}`} position={[sx, -0.145, -0.02]}>
          <mesh castShadow receiveShadow>
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
            <mesh key={bIdx} position={[bx, 0.032, 0.048]}>
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

      {/* 2. Main Soviet Enamelled Blue-Grey Steel & Bakelite Clock Casing (`1.15m x 0.28m x 0.18m`) */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.15, 0.28, 0.18]} />
        <meshStandardMaterial
          color="#3d4845"
          metalness={0.48}
          roughness={0.52}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.006}
          roughnessMap={ironTex.roughnessMap}
        />
      </mesh>

      {/* Outer Dark Structural Frame & Recessed Front Viewport Cavity (`#141817`) */}
      <mesh position={[0, 0, 0.084]} castShadow receiveShadow>
        <boxGeometry args={[1.11, 0.245, 0.022]} />
        <meshStandardMaterial
          color="#181e1c"
          metalness={0.62}
          roughness={0.44}
        />
      </mesh>

      {/* Top Overhanging Glare-Shield Hood Lip on Clock Bezel */}
      <mesh position={[0, 0.132, 0.105]} castShadow>
        <boxGeometry args={[1.16, 0.018, 0.055]} />
        <meshStandardMaterial
          color="#262f2c"
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
          <mesh castShadow>
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

      {/* 3. High-Contrast Digital Shift Readout Screen (`00:00 / 06:00`) */}
      <mesh position={[-0.055, 0.008, 0.096]}>
        <planeGeometry args={[0.94, 0.205]} />
        <meshStandardMaterial
          ref={screenMatRef}
          map={clockDisplayTex}
          color="#ffffff"
          emissive="#ffffff"
          emissiveMap={clockDisplayTex}
          emissiveIntensity={0.95}
          roughness={0.22}
          metalness={0.1}
        />
      </mesh>

      {/* Thick Protective Tinted Glass Viewport Pane Over Digits */}
      <mesh position={[-0.055, 0.008, 0.099]}>
        <planeGeometry args={[0.945, 0.21]} />
        <meshStandardMaterial
          color="#16221c"
          transparent
          opacity={0.16}
          roughness={0.12}
          metalness={0.35}
        />
      </mesh>

      {/* 4. Right Bezel Status Indicator Lamp (`CagedSovietJewelLamp3D`) */}
      <CagedSovietJewelLamp3D
        position={[0.475, 0.025, 0.096]}
        defaultColor="#33ff66"
        lampMatRef={statusLampMatRef}
        scale={1.08}
      />

      {/* 5. Bottom Brass GOST Nameplate (`ЧАСЫ СМЕНЫ 00:00 - 06:00`) */}
      <mesh position={[0, -0.118, 0.098]}>
        <boxGeometry args={[0.48, 0.036, 0.006]} />
        <meshStandardMaterial
          color="#b8a46b"
          metalness={0.86}
          roughness={0.26}
        />
      </mesh>
      <mesh position={[0, -0.118, 0.102]}>
        <planeGeometry args={[0.468, 0.031]} />
        <meshStandardMaterial
          map={gostNameplateTex}
          emissive="#ffffff"
          emissiveMap={gostNameplateTex}
          emissiveIntensity={0.32}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
});

/**
 * Seamless 3-Tier Trapezoidal Corner Console Bridge (`УГЛОВАЯ СЕКЦИЯ ПУЛЬТА БЩУ`)
 * Anchored at the exact front desk lip hinge point `J` (`z_local = +0.505m`) where adjacent panels
 * touch point-to-point with ZERO overlap. Fills the rearward V-wedge (`z_B: 0 -> -0.62m`) with
 * mathematically fitted trapezoidal geometry across all 3 tiers (pedestal base + `#82988c` sloped
 * desk + `#c8d2ce` chrome front rail + `#8ea296` mid-riser + `#2c4a63` synoptic wall + `#7e9087` canopy)
 * so `UNIT B + UNIT A-2 + UNIT A` fuse into ONE single unbroken horseshoe console!
 */
const SovietConsoleCornerWedge3D: React.FC<{
  position: [number, number, number];
  rotationY: number;
  hingeAngle?: number;
}> = React.memo(({ position, rotationY, hingeAngle = 0.72 }) => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const halfAngle = hingeAngle / 2;
  const sinA = Math.sin(halfAngle);
  const cosA = Math.cos(halfAngle);

  // Exact Trapezoidal Sloped Sage-Green Desk Geometry (tapers from 0.036m at front hinge to 0.36m at riser)
  const { slopedDeskGeo, pedestalWedgeGeo, toeKickWedgeGeo } = useMemo(() => {
    const deskShape = new THREE.Shape();
    const frontHalfW = 0.018;
    const rearHalfW = 0.46 * sinA + 0.022;
    const slopeLen = 1.084;
    deskShape.moveTo(-frontHalfW, -slopeLen / 2);
    deskShape.lineTo(frontHalfW, -slopeLen / 2);
    deskShape.lineTo(rearHalfW, slopeLen / 2);
    deskShape.lineTo(-rearHalfW, slopeLen / 2);
    deskShape.closePath();
    const dGeo = new THREE.ExtrudeGeometry(deskShape, {
      depth: 0.034,
      bevelEnabled: false,
    });

    const pedShape = new THREE.Shape();
    const pedFrontHalfW = 0.02;
    const pedRearHalfW = 0.62 * sinA + 0.03;
    pedShape.moveTo(-pedFrontHalfW, 0);
    pedShape.lineTo(pedFrontHalfW, 0);
    pedShape.lineTo(pedRearHalfW, 0.58);
    pedShape.lineTo(-pedRearHalfW, 0.58);
    pedShape.closePath();
    const pGeo = new THREE.ExtrudeGeometry(pedShape, {
      depth: 0.78,
      bevelEnabled: false,
    });

    const kickGeo = new THREE.ExtrudeGeometry(pedShape, {
      depth: 0.085,
      bevelEnabled: false,
    });

    return {
      slopedDeskGeo: dGeo,
      pedestalWedgeGeo: pGeo,
      toeKickWedgeGeo: kickGeo,
    };
  }, [sinA]);

  // Exact bisector depths behind the front hinge point `J` (`z_local = +0.505m`)
  const riserZ = -(0.505 - 0.032) * cosA; // ~ -0.443m
  const riserW = 2 * (0.505 - 0.032) * sinA + 0.036; // ~ 0.369m
  const wallZ = -(0.505 - 0.014) * cosA; // ~ -0.460m
  const wallW = 2 * (0.505 - 0.014) * sinA + 0.042; // ~ 0.388m
  const canopyZ = -(0.505 - 0.062) * cosA; // ~ -0.415m
  const canopyW = 2 * (0.505 - 0.062) * sinA + 0.038; // ~ 0.350m

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      scale={[1.04, 1.05, 1.04]}
    >
      {/* 1. Deep Structural Back-Box & Tier-3 Synoptic Slate-Blue Upper Wall Bridge (`#2c4a63` & `#7e9087`) */}
      <mesh position={[0, 1.22, wallZ - 0.16]} castShadow receiveShadow>
        <boxGeometry args={[wallW + 0.08, 2.44, 0.32]} />
        <meshStandardMaterial
          color="#4a5852"
          roughness={0.48}
          metalness={0.38}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.005}
        />
      </mesh>
      <mesh position={[0, 1.96, wallZ - 0.018]} castShadow receiveShadow>
        <boxGeometry args={[wallW + 0.02, 0.68, 0.034]} />
        <meshStandardMaterial
          color="#7e9087"
          roughness={0.42}
          metalness={0.3}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.004}
        />
      </mesh>
      <mesh position={[0, 1.94, wallZ]} castShadow receiveShadow>
        <boxGeometry args={[wallW, 0.60, 0.016]} />
        <meshStandardMaterial
          color="#2c4a63"
          roughness={0.44}
          metalness={0.24}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.004}
        />
      </mesh>
      {/* Synoptic Mimic Continuity Lines Across Upper Wall Joint */}
      {[1.78, 2.015].map((ly, lIdx) => (
        <mesh key={`w-line-${lIdx}`} position={[0, ly, wallZ + 0.01]}>
          <boxGeometry args={[wallW + 0.02, 0.015, 0.004]} />
          <meshStandardMaterial
            color={lIdx === 0 ? "#388898" : "#c8a838"}
            emissive={lIdx === 0 ? "#388898" : "#c8a838"}
            emissiveIntensity={0.2}
            roughness={0.35}
          />
        </mesh>
      ))}

      {/* Upper Canopy Overhang Miter Bridge (`#7e9087`) */}
      <group position={[0, 2.305, canopyZ]} rotation={[0.18, 0, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[canopyW, 0.16, 0.13]} />
          <meshStandardMaterial
            color="#7e9087"
            roughness={0.42}
            metalness={0.32}
          />
        </mesh>
        {[0.07, -0.07].map((cy, cIdx) => (
          <mesh key={`c-trim-${cIdx}`} position={[0, cy, 0.064]} castShadow>
            <boxGeometry args={[canopyW + 0.02, 0.016, 0.018]} />
            <meshStandardMaterial
              color="#4a5852"
              metalness={0.62}
              roughness={0.36}
            />
          </mesh>
        ))}
        <mesh position={[0, -0.004, 0.065]}>
          <boxGeometry args={[canopyW - 0.06, 0.078, 0.008]} />
          <meshStandardMaterial
            color="#ffcc44"
            emissive="#ffaa00"
            emissiveIntensity={0.65}
            roughness={0.3}
          />
        </mesh>
      </group>

      {/* 2. Tier-2 Angled Mid-Riser Corner Bridge (`#8ea296`) + Cream-White `М381` Strip Meter Stack */}
      <group position={[0, 1.465, riserZ]} rotation={[-0.08, 0, 0]}>
        <mesh position={[0, 0, -0.018]} castShadow receiveShadow>
          <boxGeometry args={[riserW, 0.36, 0.044]} />
          <meshStandardMaterial
            color="#8ea296"
            roughness={0.4}
            metalness={0.28}
          />
        </mesh>
        {[-0.096, -0.032, 0.032, 0.096].map((my, idx) => (
          <mesh key={idx} position={[0, my, 0.012]} castShadow>
            <boxGeometry args={[riserW - 0.10, 0.052, 0.012]} />
            <meshStandardMaterial
              color="#ece8d8"
              emissive="#fff6d6"
              emissiveIntensity={0.22}
              roughness={0.34}
            />
          </mesh>
        ))}
      </group>

      {/* Horizontal Brushed-Steel Transition Trims Bridging the Joint */}
      {[
        { y: 1.638, z: -(0.505 - 0.028) * cosA, w: wallW },
        { y: 1.298, z: -(0.505 - 0.056) * cosA, w: riserW - 0.02 },
      ].map((tr, tIdx) => (
        <group key={`j-trim-${tIdx}`} position={[0, tr.y, tr.z]}>
          <mesh castShadow>
            <boxGeometry args={[tr.w, 0.02, 0.028]} />
            <meshStandardMaterial
              color="#5a6b63"
              metalness={0.52}
              roughness={0.36}
            />
          </mesh>
          <mesh position={[0, 0.006, 0.012]}>
            <boxGeometry args={[tr.w, 0.006, 0.008]} />
            <meshStandardMaterial
              color="#c8d2ce"
              metalness={0.85}
              roughness={0.22}
            />
          </mesh>
        </group>
      ))}

      {/* 3. Tier-1 Trapezoidal Lower Pedestal Base (`#5a6b63`) & Recessed Toe-Kick (`#161b19`) */}
      <mesh
        geometry={toeKickWedgeGeo}
        position={[0, 0.0, -0.02]}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#161b19" roughness={0.75} />
      </mesh>
      <mesh
        geometry={pedestalWedgeGeo}
        position={[0, 0.085, -0.01]}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#5a6b63"
          roughness={0.46}
          metalness={0.34}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.005}
        />
      </mesh>

      {/* 4. Mathematically Fitted Trapezoidal Sloped Sage-Green Desk Wedge (`#82988c`) */}
      <group position={[0, 0.78, -0.22]} rotation={[-0.381, 0, 0]}>
        <mesh
          geometry={slopedDeskGeo}
          position={[0, 0, -0.036]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color="#82988c"
            roughness={0.4}
            metalness={0.28}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>
        {/* Recessed Soviet Backlit Push-Button Cluster on Upper Half of Trapezoidal Desk Wedge */}
        <mesh position={[0, 0.24, 0.002]}>
          <boxGeometry args={[0.16, 0.24, 0.008]} />
          <meshStandardMaterial color="#222a27" roughness={0.5} />
        </mesh>
        {[-0.07, 0.0, 0.07].map((ky, kIdx) => (
          <group key={kIdx} position={[0, 0.24 + ky, 0.008]}>
            {[-0.036, 0.036].map((kx, colIdx) => {
              const tone =
                (kIdx + colIdx) % 3 === 0
                  ? "#ffcc44"
                  : colIdx === 1
                    ? "#55bbaa"
                    : "#f4f0e0";
              return (
                <mesh key={colIdx} position={[kx, 0, 0]} castShadow>
                  <boxGeometry args={[0.048, 0.036, 0.01]} />
                  <meshStandardMaterial
                    color={tone}
                    emissive={tone}
                    emissiveIntensity={0.46}
                    roughness={0.26}
                  />
                </mesh>
              );
            })}
          </group>
        ))}
      </group>

      {/* 5. Rounded Brushed Stainless/Chrome Front Armrest Corner Joint at Exact Hinge Point `[0, 0.275, 0]` */}
      <group position={[0, 0.275, -0.004]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.022, 0.024, 0.042, 16]} />
          <meshStandardMaterial
            color="#5a6b63"
            roughness={0.42}
            metalness={0.45}
          />
        </mesh>
        <mesh position={[0, -0.004, 0.01]} castShadow>
          <sphereGeometry args={[0.02, 14, 14]} />
          <meshStandardMaterial
            color="#c8d2ce"
            metalness={0.88}
            roughness={0.18}
          />
        </mesh>
      </group>
    </group>
  );
});

/**
 * 3D Overhead Bulkhead Telemetry Board & 3D Camera Station Selector Rail
 */
const BunkerTelemetryAndControlRail3D: React.FC = React.memo(() => {
  const lastRightDrawRef = useRef(0);
  const rheostatRingMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const rheostatPointerMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const batteryCellBarMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);

  useFrame(({ clock }) => {
    const s = useGameStore.getState();
    const now = clock.getElapsedTime();

    // Pulse single BATTERY -> GRID wheel ONLY during Tutorial Step 4
    const highlightRheo = s.tutorialPhase === "STEP_4_SPIN_TURBINE";
    if (rheostatRingMatRef.current) {
      if (highlightRheo) {
        const pulse = (Math.sin(now * 6.0) + 1) * 0.5;
        const hex = pulse > 0.5 ? "#33ff66" : "#ffb000";
        rheostatRingMatRef.current.color.set(hex);
        rheostatRingMatRef.current.emissive.set(hex);
        rheostatRingMatRef.current.emissiveIntensity = 1.2 + pulse * 1.1;
      } else {
        rheostatRingMatRef.current.color.set("#b8a46b");
        rheostatRingMatRef.current.emissive.set("#000000");
        rheostatRingMatRef.current.emissiveIntensity = 0;
      }
    }
    if (rheostatPointerMatRef.current) {
      if (highlightRheo) {
        const pulse = (Math.sin(now * 6.0) + 1) * 0.5;
        const hex = pulse > 0.5 ? "#33ff66" : "#ffb000";
        rheostatPointerMatRef.current.color.set(hex);
        rheostatPointerMatRef.current.emissive.set(hex);
        rheostatPointerMatRef.current.emissiveIntensity = 1.4 + pulse * 1.2;
      } else {
        rheostatPointerMatRef.current.color.set("#efe8d2");
        rheostatPointerMatRef.current.emissive.set("#ffb000");
        rheostatPointerMatRef.current.emissiveIntensity = 0.35;
      }
    }
  });

  const rheostatWheelRef = useRef<THREE.Group>(null);
  const rightStatusMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const throttleLedMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const throttleReadoutMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lastThrottleMwRef = useRef(-1);
  const prevXenonRef = useRef(0);
  const xenonBurningRef = useRef(false);

  const throttleReadoutTex = useMemo(
    () =>
      createNearestCanvasTexture(160, 56, (ctx, w, h) => {
        ctx.fillStyle = "#08120c";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#33ff66";
        ctx.font = 'bold 34px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("0 MW", w / 2, 39);
      }),
    [],
  );

  const bankAPlateTex = useMemo(
    () =>
      makePlaqueTex("ACCUMULATOR BANK A", "500 MWH CELL ARRAY", {
        width: 384,
        height: 104,
        titleSize: 27,
        subSize: 20,
        titleColor: "#33ff66",
        titleStroke: "#33ff66",
        subColor: "#e6dec3",
        subStroke: "#e6dec3",
        borderColor: "#b8a46b",
      }),
    [],
  );

  const bankBPlateTex = useMemo(
    () =>
      makePlaqueTex("ACCUMULATOR BANK B", "500 MWH CELL ARRAY", {
        width: 384,
        height: 104,
        titleSize: 27,
        subSize: 20,
        titleColor: "#33ff66",
        titleStroke: "#33ff66",
        subColor: "#e6dec3",
        subStroke: "#e6dec3",
        borderColor: "#b8a46b",
      }),
    [],
  );

  const rheostatPlateTex = useMemo(
    () =>
      makePlaqueTex("BATTERY -> GRID", "TURN WHEEL TO DISPATCH MW", {
        width: 420,
        height: 104,
        titleSize: 30,
        subSize: 20,
        titleColor: "#44ff77",
        titleStroke: "#44ff77",
        subColor: "#ffffff",
        subStroke: "#ffffff",
        borderColor: "#33ff66",
      }),
    [],
  );

  const rightPanelGroupRef = useRef<THREE.Group>(null);
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  // Load High-Detail Soviet `.glb` Mainframe Hardware from `public/models/`
  const terminalHousingGltf = useGLTF("./models/komrad_terminal_housing.glb");

  const terminalHousingModel = useMemo(() => {
    const cloned = terminalHousingGltf.scene.clone(true);
    // 1. Strip the legacy flat kbOverlay group AND the 2 angled umbilical/flange cylinders (y < 0.88) that clipped into the bottom-left/right keys
    // 2. Scale up the upper CRT housing/bezel/hood/bolts/knobs (y >= 0.88) by +40% width (1.40x) and +30% height (1.30x)
    //    while anchoring the bottom bezel at y >= 0.94 so it stays 100% clear of the 3 DVK-84 switches & keyboard!
    const legacyLowerMeshes: THREE.Object3D[] = [];
    for (const child of cloned.children) {
      if (child.position.y < 0.88) {
        legacyLowerMeshes.push(child);
      } else {
        child.position.x *= 1.68;
        child.position.y = 0.94 + (child.position.y - 0.88) * 1.56;
        child.scale.x *= 1.68;
        child.scale.y *= 1.56;
      }
    }
    for (const obj of legacyLowerMeshes) {
      cloned.remove(obj);
    }
    applySovietPBRToHierarchy(cloned);
    return cloned;
  }, [terminalHousingGltf.scene]);

  const rheostatScaleTex = useMemo(
    () =>
      createCrispPanelTexture(256, 256, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;

        // Dark brushed-steel industrial valve mounting flange & recessed collar (NO white gauge face!)
        const flangeGrad = ctx.createRadialGradient(cx, cy, 18, cx, cy, 124);
        flangeGrad.addColorStop(0, "#141917");
        flangeGrad.addColorStop(0.46, "#2c3531");
        flangeGrad.addColorStop(0.84, "#1d2421");
        flangeGrad.addColorStop(1, "#121715");
        ctx.fillStyle = flangeGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, 124, 0, Math.PI * 2);
        ctx.fill();

        // Concentric machined steel lathe grooves
        ctx.strokeStyle = "rgba(190, 206, 198, 0.14)";
        ctx.lineWidth = 1.5;
        for (const r of [42, 64, 86, 118]) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Recessed inner gland seal ring
        ctx.strokeStyle = "#0e1210";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(cx, cy, 52, 0, Math.PI * 2);
        ctx.stroke();

        // 6 recessed dark-steel hex flange bolts
        for (let b = 0; b < 6; b++) {
          const ba = (b * Math.PI) / 3 + Math.PI / 6;
          const bx = cx + Math.cos(ba) * 72;
          const by = cy + Math.sin(ba) * 72;
          ctx.fillStyle = "#121614";
          ctx.beginPath();
          ctx.arc(bx, by, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#4c5953";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Crisp 0–100% industrial valve tick notches around outer rim
        for (let i = 0; i <= 20; i++) {
          const ratio = i / 20;
          const ang = -Math.PI * 0.5 - Math.PI * 0.78 + ratio * Math.PI * 1.56;
          const isMajor = i % 5 === 0;
          const rOut = 115;
          const rIn = isMajor ? 95 : 104;
          ctx.strokeStyle =
            i >= 18 ? "#ffb000" : isMajor ? "#d4ded9" : "#7e8e86";
          ctx.lineWidth = isMajor ? 3.5 : 1.8;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * rIn, cy + Math.sin(ang) * rIn);
          ctx.lineTo(cx + Math.cos(ang) * rOut, cy + Math.sin(ang) * rOut);
          ctx.stroke();
        }
      }),
    [],
  );

  useEffect(() => {
    applySovietPBRToHierarchy(rightPanelGroupRef.current);
  }, []);

  const rightHeaderPlateTex = useMemo(
    () =>
      makePlaqueTex(
        "ENERGY STORAGE & GRID DISPATCH // UNIT C",
        "ENERGY CREATED  •  BATTERY STORED  •  GRID DEMAND  •  SINGLE OUTPUT WHEEL",
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

    // 1. Animate Single Cast-Steel Battery-to-Grid Output Wheel + 10-Segment Bargraph
    const valveRatio = s.isBlackout ? 0 : s.batteryOutputValve;
    const dispatchedMWNow = s.isBlackout ? 0 : Math.round(valveRatio * 1000);
    if (rheostatWheelRef.current) {
      const targetRotZ = -valveRatio * Math.PI * 2.2;
      const alpha = Math.min(1, dt * 28);
      rheostatWheelRef.current.rotation.z = THREE.MathUtils.lerp(
        rheostatWheelRef.current.rotation.z,
        targetRotZ,
        alpha,
      );
    }

    for (let seg = 0; seg < 10; seg++) {
      const ledMat = throttleLedMatRefs.current[seg];
      if (!ledMat) continue;
      const segThreshold = (seg + 1) * 100;
      const isLit = !s.isBlackout && dispatchedMWNow >= segThreshold - 50;
      const segCol =
        seg >= 8 ? "#ff4444" : seg >= 6 ? "#ffb000" : "#33ff66";
      ledMat.color.set(isLit ? segCol : "#121a16");
      ledMat.emissive.set(isLit ? segCol : "#000000");
      ledMat.emissiveIntensity = isLit ? 1.55 : 0.04;
    }

    if (dispatchedMWNow !== lastThrottleMwRef.current) {
      lastThrottleMwRef.current = dispatchedMWNow;
      const rdTex = throttleReadoutMatRef.current?.map as
        | THREE.CanvasTexture
        | undefined;
      const rdCanvas = rdTex?.image as HTMLCanvasElement | undefined;
      const rdCtx = rdCanvas?.getContext("2d");
      if (rdTex && rdCanvas && rdCtx) {
        rdCtx.fillStyle = "#08120c";
        rdCtx.fillRect(0, 0, rdCanvas.width, rdCanvas.height);
        rdCtx.strokeStyle = "#b8a46b";
        rdCtx.lineWidth = 3;
        rdCtx.strokeRect(2, 2, rdCanvas.width - 4, rdCanvas.height - 4);
        rdCtx.fillStyle = dispatchedMWNow >= 850 ? "#ffb000" : "#33ff66";
        rdCtx.font = 'bold 34px "VT323", monospace';
        rdCtx.textAlign = "center";
        rdCtx.fillText(`${dispatchedMWNow} MW`, rdCanvas.width / 2, 39);
        rdTex.needsUpdate = true;
      }
    }

    // 2. Animate 10 Accumulator Charge Bars across Bank A (0-50%) & Bank B (55-100%)
    const chargePct = s.batteryStoredPct;
    const chargeCol =
      chargePct < 15 ? "#ff2a2a" : chargePct < 30 ? "#ffb000" : "#33ff66";
    for (let i = 0; i < 10; i++) {
      const barMat = batteryCellBarMatRefs.current[i];
      if (!barMat) continue;
      const threshold = (i + 1) * 10 - 5;
      const isLit = !s.isBlackout && chargePct >= threshold;
      barMat.color.set(isLit ? chargeCol : "#121a16");
      barMat.emissive.set(isLit ? chargeCol : "#000000");
      barMat.emissiveIntensity = isLit ? 1.4 : 0.05;
    }

    // Update UNIT C Master Overview Dashboard (`CRT-84C`, 1024x208) — throttled to ~13 FPS (0.075s)
    if (t - lastRightDrawRef.current < 0.075) return;
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
      lastRightDrawRef.current = t;
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
          3. NEW RIGHT-SIDE SOVIET CONTROL PANEL WING (<RightControlPanel3D />)
          Positioned at comfortable 1.76m radius on Right Wall (x: 1.76, z: 2.02)
         ============================================================ */}
      <group
        ref={rightPanelGroupRef}
        position={[1.76, -0.02, 2.02]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[1.04, 1.05, 1.04]}
      >
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
        <mesh position={[-1.0, 1.18, 0.032]} castShadow receiveShadow>
          <boxGeometry args={[0.042, 2.40, 0.036]} />
          <meshStandardMaterial
            color="#1e2422"
            metalness={0.7}
            roughness={0.42}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        <mesh position={[1.0, 1.18, 0.032]} castShadow receiveShadow>
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
              castShadow
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
              castShadow
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
        <mesh position={[0, 2.095, 0.044]}>
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
            <mesh castShadow receiveShadow>
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
                castShadow
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
            <mesh position={[0, 0, -0.04]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.012, 0.014, 0.11, 8]} />
              <meshStandardMaterial color="#18211b" metalness={0.75} roughness={0.38} />
            </mesh>
            <mesh position={[0, -0.018, 0.028]} rotation={[0.45, 0, 0]} castShadow>
              <cylinderGeometry args={[0.024, 0.068, 0.065, 12]} />
              <meshStandardMaterial
                color="#23312b"
                metalness={0.68}
                roughness={0.4}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.006}
              />
            </mesh>
            <mesh position={[0, -0.036, 0.036]}>
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
          <mesh position={[0, 0.01, -0.01]} castShadow receiveShadow>
            <boxGeometry args={[1.82, 0.44, 0.022]} />
            <meshStandardMaterial
              color="#1e2723"
              roughness={0.48}
              metalness={0.55}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>

          {/* 1. Single Cast-Steel 6-Spoke BATTERY -> GRID Dispatch Handwheel + 10-Segment Bargraph (0-1000 MW) */}
          <group
            position={[-0.01, -0.015, 0.018]}
            scale={[1.02, 1.02, 1.02]}
            onPointerOver={(e) => {
              e.stopPropagation();
              const g = useGameStore.getState();
              g.setHoveredDiagnosticId("grid");
              g.setHoveredControlHint(
                "BATTERY -> GRID (0–1000 MW): Drag Wheel or Scroll (±40 MW | Shift ±10 MW) to dispatch stored power to the grid",
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
            onWheel={(e: ThreeEvent<WheelEvent>) => {
              if (useCameraLookStore.getState().isFreeLookMode) return;
              e.stopPropagation();
              e.nativeEvent?.stopImmediatePropagation?.();
              const fine = Boolean(e.shiftKey || e.nativeEvent?.shiftKey);
              const step = (e.deltaY < 0 ? 1 : -1) * (fine ? 0.01 : 0.04);
              const s = useGameStore.getState();
              const curValve = s.batteryOutputValve;
              const nextValve = THREE.MathUtils.clamp(
                Math.round((curValve + step) * 100) / 100,
                0,
                1,
              );
              if (Math.abs(nextValve - curValve) >= 0.001) {
                playRheostatDetentClick(Math.round(nextValve * 100));
                s.setBatteryOutputValve(nextValve);
                if (rheostatWheelRef.current) {
                  rheostatWheelRef.current.rotation.z =
                    -nextValve * Math.PI * 2.2;
                }
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

              const domElem =
                (e.nativeEvent.target as HTMLElement | null) ??
                document.querySelector("canvas");
              const rect = domElem?.getBoundingClientRect();
              let centerX = e.nativeEvent.clientX;
              let centerY = e.nativeEvent.clientY;
              const wheelObj = rheostatWheelRef.current;
              if (wheelObj && rect && rect.width > 0 && rect.height > 0) {
                const worldPos = new THREE.Vector3();
                wheelObj.getWorldPosition(worldPos);
                worldPos.project(e.camera);
                centerX = rect.left + (worldPos.x * 0.5 + 0.5) * rect.width;
                centerY = rect.top + (-worldPos.y * 0.5 + 0.5) * rect.height;
              }

              const startX = e.nativeEvent.clientX;
              const startY = e.nativeEvent.clientY;
              let prevY = startY;
              let currentVal = useGameStore.getState().batteryOutputValve;
              const initR = Math.hypot(startX - centerX, startY - centerY);
              let hasValidAngle = initR >= 8;
              let prevAngle = hasValidAngle
                ? Math.atan2(startY - centerY, startX - centerX)
                : 0;
              let lastDetent = Math.round(currentVal * 100);

              const handleMove = (ev: PointerEvent) => {
                const dy = prevY - ev.clientY;
                prevY = ev.clientY;

                const rx = ev.clientX - centerX;
                const ry = ev.clientY - centerY;
                const r = Math.hypot(rx, ry);

                let deltaValve = 0;
                if (r >= 10) {
                  const curAngle = Math.atan2(ry, rx);
                  if (!hasValidAngle) {
                    hasValidAngle = true;
                    prevAngle = curAngle;
                    return;
                  }
                  let dTheta = curAngle - prevAngle;
                  while (dTheta > Math.PI) dTheta -= Math.PI * 2;
                  while (dTheta < -Math.PI) dTheta += Math.PI * 2;
                  prevAngle = curAngle;
                  deltaValve = dTheta / (Math.PI * 1.65) + dy * 0.0022;
                } else {
                  deltaValve = dy * 0.0045;
                }

                const nextValve = THREE.MathUtils.clamp(
                  Math.round((currentVal + deltaValve) * 100) / 100,
                  0,
                  1,
                );
                if (Math.abs(nextValve - currentVal) >= 0.002) {
                  currentVal = nextValve;
                  if (rheostatWheelRef.current) {
                    rheostatWheelRef.current.rotation.z =
                      -currentVal * Math.PI * 2.2;
                  }
                  const nextDetent = Math.round(currentVal * 100);
                  if (nextDetent !== lastDetent) {
                    lastDetent = nextDetent;
                    playRheostatDetentClick(nextDetent);
                  }
                  useGameStore.getState().setBatteryOutputValve(currentVal);
                }
              };
              const handleUp = () => {
                r3fTarget?.releasePointerCapture?.(e.pointerId);
                window.removeEventListener("pointermove", handleMove);
                window.removeEventListener("pointerup", handleUp);
                window.removeEventListener("pointercancel", handleUp);
                playSwitchClank(false);
              };
              window.addEventListener("pointermove", handleMove);
              window.addEventListener("pointerup", handleUp);
              window.addEventListener("pointercancel", handleUp);
            }}
          >
            {/* Generous Invisible Hit-Box covering both Cast-Steel Handwheel and Vertical LED Bargraph */}
            <mesh position={[0.02, -0.01, 0.05]}>
              <boxGeometry args={[0.42, 0.34, 0.14]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            <mesh position={[0, 0.215, 0.006]} castShadow>
              <boxGeometry args={[0.485, 0.108, 0.01]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.215, 0.012]}>
              <planeGeometry args={[0.47, 0.098]} />
              <meshStandardMaterial
                map={rheostatPlateTex}
                emissive="#ffffff"
                emissiveMap={rheostatPlateTex}
                emissiveIntensity={0.35}
                roughness={0.55}
              />
            </mesh>
            <SovietBacklitIndicatorBlock3D
              position={[0, 0.148, 0.022]}
              label="DISPATCH"
              getAlertState={(s) => {
                if (s.tutorialPhase !== "COMPLETED") {
                  return { level: "normal", acknowledged: false };
                }
                const diff = Math.abs(s.totalElectricalMW - s.energyDemandMW);
                return {
                  level: diff > 90 ? "critical" : diff > 30 ? "warn" : "normal",
                  acknowledged: false,
                };
              }}
            />

            {/* Left Sub-Assembly: Bolted Cast-Iron Valve Manifold & 6-Spoke Cast-Steel Handwheel */}
            <group position={[-0.058, -0.012, 0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.128, 0.142, 0.044, 18]} />
                <meshStandardMaterial
                  color="#141816"
                  roughness={0.44}
                  metalness={0.68}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.008}
                />
              </mesh>
              <mesh position={[0, 0, 0.023]}>
                <circleGeometry args={[0.116, 24]} />
                <meshStandardMaterial
                  map={rheostatScaleTex}
                  metalness={0.62}
                  roughness={0.38}
                  emissive="#ffffff"
                  emissiveMap={rheostatScaleTex}
                  emissiveIntensity={0.08}
                />
              </mesh>
              <mesh position={[0, 0, 0.025]} castShadow>
                <torusGeometry args={[0.118, 0.008, 10, 24]} />
                <meshStandardMaterial
                  ref={rheostatRingMatRef}
                  color="#b8a46b"
                  metalness={0.86}
                  roughness={0.26}
                  bumpMap={brassTex.bumpMap}
                  bumpScale={0.005}
                />
              </mesh>
              {/* Central Valve Stem */}
              <mesh position={[0, 0, 0.042]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.022, 0.026, 0.052, 12]} />
                <meshStandardMaterial
                  color="#8c9690"
                  metalness={0.82}
                  roughness={0.28}
                />
              </mesh>

              {/* Rotating 6-Spoke Soviet Cast-Steel Handwheel */}
              <group ref={rheostatWheelRef} position={[0, 0, 0.068]}>
                {/* Heavy Cast-Steel Outer Rim */}
                <mesh castShadow>
                  <torusGeometry args={[0.112, 0.0145, 12, 28]} />
                  <meshStandardMaterial
                    color="#3a4540"
                    metalness={0.78}
                    roughness={0.32}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.006}
                  />
                </mesh>
                {/* 6 Radial Cast-Steel Spokes */}
                {[0, 1, 2, 3, 4, 5].map((spIdx) => (
                  <mesh
                    key={`spoke-${spIdx}`}
                    rotation={[0, 0, (spIdx * Math.PI) / 3]}
                    castShadow
                  >
                    <cylinderGeometry args={[0.0065, 0.0065, 0.215, 8]} />
                    <meshStandardMaterial
                      color="#98a49e"
                      metalness={0.85}
                      roughness={0.26}
                    />
                  </mesh>
                ))}
                {/* Central Brushed-Brass Hex Locknut Hub */}
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.028, 0.032, 0.024, 6]} />
                  <meshStandardMaterial
                    color="#b8a46b"
                    metalness={0.88}
                    roughness={0.22}
                  />
                </mesh>
                {/* Tactile Bakelite Crank Handle Peg + Illuminated Index Stripe on Rim */}
                <mesh
                  position={[0, 0.112, 0.024]}
                  rotation={[Math.PI / 2, 0, 0]}
                  castShadow
                >
                  <cylinderGeometry args={[0.014, 0.012, 0.042, 12]} />
                  <meshStandardMaterial
                    ref={rheostatPointerMatRef}
                    color="#efe8d2"
                    emissive="#ffb000"
                    emissiveIntensity={0.45}
                    roughness={0.3}
                  />
                </mesh>
              </group>
            </group>

            {/* Right Sub-Assembly: Illuminated 10-Segment Vertical 3D LED Bargraph (0-1000 MW) + Digital MW Badge */}
            <group position={[0.145, -0.012, 0.016]}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={[0.102, 0.278, 0.024]} />
                <meshStandardMaterial
                  color="#101613"
                  roughness={0.46}
                  metalness={0.68}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.005}
                />
              </mesh>
              {/* Digital MW Readout Window at Top of Bargraph */}
              <mesh position={[0, 0.106, 0.014]}>
                <planeGeometry args={[0.088, 0.042]} />
                <meshStandardMaterial
                  ref={throttleReadoutMatRef}
                  map={throttleReadoutTex}
                  emissive="#ffffff"
                  emissiveMap={throttleReadoutTex}
                  emissiveIntensity={0.65}
                  roughness={0.4}
                />
              </mesh>
              {/* 10 Stacked Physical 3D LED Segments (Bottom 10% -> Top 100%) */}
              {Array.from({ length: 10 }).map((_, segIdx) => {
                const segY = -0.112 + segIdx * 0.021;
                return (
                  <mesh key={`tled-${segIdx}`} position={[0, segY, 0.014]}>
                    <boxGeometry args={[0.068, 0.0145, 0.008]} />
                    <meshStandardMaterial
                      ref={(el) => {
                        throttleLedMatRefs.current[segIdx] = el;
                      }}
                      color="#121a16"
                      emissive="#000000"
                      emissiveIntensity={0.04}
                      roughness={0.28}
                    />
                  </mesh>
                );
              })}
            </group>
          </group>

          {/* 2 & 3. Non-Interactive 3D Soviet Heavy Accumulator Cell Banks (Left & Right, Compact High-Mount) */}
          {[
            { x: -0.63, tex: bankAPlateTex, offset: 0 },
            { x: 0.63, tex: bankBPlateTex, offset: 5 },
          ].map((bank) => (
            <group
              key={`acc-bank-${bank.offset}`}
              position={[bank.x, -0.02, 0.015]}
              scale={[0.95, 0.88, 0.95]}
            >
              {/* Brass Bank Header Plaque */}
              <mesh position={[0, 0.228, 0.006]} castShadow>
                <boxGeometry args={[0.44, 0.106, 0.01]} />
                <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
              </mesh>
              <mesh position={[0, 0.228, 0.012]}>
                <planeGeometry args={[0.425, 0.096]} />
                <meshStandardMaterial
                  map={bank.tex}
                  emissive="#ffffff"
                  emissiveMap={bank.tex}
                  emissiveIntensity={0.35}
                  roughness={0.55}
                />
              </mesh>
              {/* Heavy Steel Cell Housing & Bakelite Top Insulator */}
              <mesh castShadow receiveShadow>
                <boxGeometry args={[0.38, 0.29, 0.056]} />
                <meshStandardMaterial
                  color="#18211b"
                  roughness={0.46}
                  metalness={0.62}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.008}
                />
              </mesh>
              <mesh position={[0, 0.128, 0.032]} castShadow>
                <boxGeometry args={[0.34, 0.038, 0.024]} />
                <meshStandardMaterial color="#141414" roughness={0.32} metalness={0.18} />
              </mesh>
              {/* Twin Copper/Brass Terminal Posts + Horizontal Bridge Busbar */}
              {[-0.105, 0.105].map((tx, tid) => (
                <group key={`term-${tid}`} position={[tx, 0.128, 0.05]}>
                  <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <cylinderGeometry args={[0.022, 0.026, 0.036, 12]} />
                    <meshStandardMaterial
                      color="#b8a46b"
                      metalness={0.88}
                      roughness={0.24}
                      bumpMap={brassTex.bumpMap}
                      bumpScale={0.004}
                    />
                  </mesh>
                  <mesh position={[0, -0.145, -0.012]} castShadow>
                    <cylinderGeometry args={[0.044, 0.048, 0.22, 14]} />
                    <meshStandardMaterial
                      color="#23332b"
                      roughness={0.44}
                      metalness={0.55}
                    />
                  </mesh>
                </group>
              ))}
              <mesh position={[0, 0.078, 0.046]} castShadow>
                <boxGeometry args={[0.22, 0.018, 0.012]} />
                <meshStandardMaterial color="#c88d44" metalness={0.85} roughness={0.26} />
              </mesh>
              {/* Central Armored Window Housing with 5 Illuminated Charge Bars */}
              <mesh position={[0, -0.035, 0.034]} castShadow>
                <boxGeometry args={[0.105, 0.175, 0.018]} />
                <meshStandardMaterial color="#0c120f" roughness={0.45} metalness={0.65} />
              </mesh>
              {Array.from({ length: 5 }).map((_, bIdx) => {
                const barY = -0.098 + bIdx * 0.031;
                return (
                  <mesh key={`batbar-${bIdx}`} position={[0, barY, 0.046]}>
                    <boxGeometry args={[0.078, 0.02, 0.008]} />
                    <meshStandardMaterial
                      ref={(el) => {
                        batteryCellBarMatRefs.current[bank.offset + bIdx] = el;
                      }}
                      color="#121a16"
                      emissive="#000000"
                      emissiveIntensity={0.05}
                      roughness={0.28}
                    />
                  </mesh>
                );
              })}
            </group>
          ))}
        </group>

        {/* Non-Interactive Bolted Lower Access Service Apron (Cleanly occupies lower desk-shadow skirt) */}
        <group position={[0, 0.62, 0.34]} rotation={[-0.406, 0, 0]}>
          {[-0.46, 0.46].map((ax, aIdx) => (
            <group key={`apron-bay-${aIdx}`} position={[ax, 0, 0.008]}>
              <mesh castShadow receiveShadow>
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
                  castShadow
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
                  castShadow
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

      {/* 4. BEVELED ANGLE-IRON SEAMS FOR ENLARGED K.O.M.R.A.D.-84 MAINFRAME (+20% ADDITIONAL SCALE) */}
      <group position={[0, 0.14, 2.18]}>
        <group position={[0, 0, -1.62]}>
          <primitive object={terminalHousingModel} />
          {/* Heavy Welded Corner L-Angle Trim & Recessed Bezel Bolts on Enlarged K.O.M.R.A.D.-84 Mainframe */}
          <mesh position={[-1.39, 1.32, 0.04]} castShadow receiveShadow>
            <boxGeometry args={[0.054, 2.62, 0.054]} />
            <meshStandardMaterial
              color="#18211b"
              metalness={0.68}
              roughness={0.44}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          <mesh position={[1.39, 1.32, 0.04]} castShadow receiveShadow>
            <boxGeometry args={[0.054, 2.62, 0.054]} />
            <meshStandardMaterial
              color="#18211b"
              metalness={0.68}
              roughness={0.44}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          {[-1.1, -0.55, 0, 0.55, 1.1].map((bx, idx) => (
            <mesh
              key={idx}
              position={[bx, 2.53, 0.145]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
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
          {/* 5. LARGE PHYSICAL DIGITAL SHIFT CLOCK (`ЧАСЫ СМЕНЫ // ЭЛЕКТРОНИКА-7`) BOLTED ON TOP OF K.O.M.R.A.D.-84 */}
          <SovietDigitalShiftClock3D />
        </group>
      </group>
    </>
  );
});

/**
 * Suspended Bunker Dust Motes (120 slow-drifting micro-pixel dust particles floating
 * lazily inside the overhead spotlight cone above the Inspector's Desk)
 */
const BunkerDustMotes3D: React.FC = React.memo(() => {
  const pointsRef = useRef<THREE.Points>(null);
  const lastUpdateRef = useRef(0);

  const { positions, seeds } = useMemo(() => {
    const count = 120;
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

      posArr[i * 3] = Math.cos(angle) * r;
      posArr[i * 3 + 1] = 0.85 + heightRatio * 1.45;
      posArr[i * 3 + 2] = 1.48 + Math.sin(angle) * r * 0.72;

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
    for (let i = 0; i < 120; i++) {
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
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#ffe3b8"
        size={0.016}
        transparent
        opacity={0.48}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
});

const DynamicBunkerLighting: React.FC = React.memo(() => {
  const deskSpotRef = useRef<THREE.SpotLight>(null);
  const deskSpotTargetRef = useRef<THREE.Object3D>(null);
  const deskBulbMeshRef = useRef<THREE.Mesh>(null);
  const reactorSpotRef = useRef<THREE.PointLight>(null);
  const az5GlowRef = useRef<THREE.PointLight>(null);
  const crtLightRef = useRef<THREE.PointLight>(null);
  const rearPoolLightRef = useRef<THREE.PointLight>(null);
  const rightPoolLightRef = useRef<THREE.PointLight>(null);
  const klaxonLightRef = useRef<THREE.PointLight>(null);
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
      ciaIntrusionActive,
      komradOverrideLocked,
    } = state;
    const totalMW =
      powerAllocation.cooling +
      powerAllocation.defense +
      powerAllocation.facility;
    const totalAllocatedMW = Object.values(state.sectorMW).reduce(
      (a, b) => a + b,
      0,
    );
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

    if (reactorSpotRef.current) {
      reactorSpotRef.current.intensity = isBlackout
        ? 0.35
        : 2.1 * humFlicker;
    }

    if (rearPoolLightRef.current) {
      rearPoolLightRef.current.intensity = isBlackout
        ? 0.25
        : 2.9 * humFlicker;
    }

    if (rightPoolLightRef.current) {
      rightPoolLightRef.current.intensity = isBlackout
        ? 0.25
        : 2.6 * humFlicker;
    }

    if (az5GlowRef.current) {
      az5GlowRef.current.intensity = isBlackout
        ? 0.3
        : isAlarmActive
          ? 1.45 + Math.sin(t * 12.0) * 0.35
          : 0.85 * humFlicker;
    }

    if (deskBulbMeshRef.current) {
      const mat = deskBulbMeshRef.current
        .material as THREE.MeshStandardMaterial;
      const lampOn = !isBlackout && powerAllocation.facility > 0;
      mat.emissiveIntensity = lampOn
        ? Math.min(2.6, 0.7 + (powerAllocation.facility / 40) * 1.7) * humFlicker
        : 0.02;
    }

    if (crtLightRef.current) {
      crtLightRef.current.intensity = isBlackout ? 0.08 : 0.22;
      crtLightRef.current.color.set(
        komradOverrideLocked || ciaIntrusionActive ? "#ff2a2a" : "#38ff62",
      );
    }

    if (klaxonSpinnerRef.current && isAlarmActive) {
      klaxonSpinnerRef.current.rotation.y = t * 5.5;
    }
    if (klaxonLampMatRef.current) {
      klaxonLampMatRef.current.emissiveIntensity = isAlarmActive
        ? 1.4 + Math.sin(t * 9.0) * 0.8
        : 0.05;
    }
    if (klaxonLightRef.current) {
      klaxonLightRef.current.visible = isAlarmActive;
      if (isAlarmActive) {
        const wave = (Math.sin(t * 9.0) + 1) * 0.5;
        klaxonLightRef.current.intensity = 1.6 + wave * 7.2;
      } else {
        klaxonLightRef.current.intensity = 0;
      }
    }
  });

  return (
    <>
      {/* 1. Crushed Flat Ambient Light & Subtle Hemisphere Fill for Deep Chiaroscuro Bunker Shadows */}
      <ambientLight intensity={0.06} color="#0a120e" />
      <hemisphereLight args={["#1a2822", "#050706", 0.18]} />

      {/* 2. Overhead Bunker Pendulum Lamp (Shadow-Casting SpotLight with Smooth Penumbra) */}
      <group position={[0, -0.164, 1.48]}>
        <object3D ref={deskSpotTargetRef} position={[0, 0.92, 0.04]} />
        <spotLight
          ref={deskSpotRef}
          castShadow
          position={[0, 2.5, 0.2]}
          angle={0.68}
          penumbra={0.85}
          intensity={3.2}
          distance={7}
          decay={1.15}
          color="#ffe3b8"
          shadow-bias={-0.0005}
          shadow-mapSize={[1024, 1024]}
        />

        {/* Heavy Industrial Enamel & Brass Pendulum Lamp Fixture */}
        <group position={[0, 2.52, 0.2]}>
          {/* Steel suspension rod to bunker ceiling */}
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.65, 8]} />
            <meshStandardMaterial
              color="#18211b"
              metalness={0.75}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.048, 0.24, 0.18, 16]} />
            <meshStandardMaterial
              color="#23312b"
              roughness={0.42}
              metalness={0.68}
            />
          </mesh>
          <mesh position={[0, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.24, 0.01, 8, 20]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.85}
              roughness={0.28}
            />
          </mesh>
          <mesh ref={deskBulbMeshRef} position={[0, -0.01, 0]}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshStandardMaterial
              color="#ffcf75"
              emissive="#ffaa33"
              emissiveIntensity={1.4}
            />
          </mesh>
        </group>
      </group>

      {/* Suspended Bunker Dust Motes floating lazily inside the overhead spotlight cone */}
      <BunkerDustMotes3D />

      {/* 3. CRT & Gauge Diegetic Glow:
          Softened & repositioned forward/lower so it gently illuminates 3D keycaps without creating a specular glare spot on the CRT glass */}
      <pointLight
        ref={crtLightRef}
        position={[0, 1.12, 1.18]}
        color="#38ff62"
        intensity={0.22}
        distance={2.6}
        decay={1.8}
      />

      {/* Warm Amber/Red Diegetic Glow near the АЗ-5 Emergency Button & Left Reactor Gauges */}
      <pointLight
        ref={az5GlowRef}
        position={[-1.68, 1.05, 1.85]}
        color="#ff3b1f"
        intensity={0.85}
        distance={1.6}
        decay={1.4}
      />
      {/* Consolidated Left + Left-Rear Control Wing Pool Light */}
      <pointLight
        ref={reactorSpotRef}
        position={[-1.12, 2.22, 2.65]}
        color="#ffba5c"
        intensity={2.9}
        distance={7.5}
        decay={1.15}
      />

      {/* Consolidated Rear-Left (`UNIT B`) + Right Wing Pool Light */}
      <pointLight
        ref={rearPoolLightRef}
        position={[-1.12, 2.22, 5.25]}
        color="#ffba5c"
        intensity={2.9}
        distance={7.5}
        decay={1.15}
      />
      <pointLight
        ref={rightPoolLightRef}
        position={[1.15, 2.15, 2.15]}
        color="#ffba5c"
        intensity={2.6}
        distance={6.5}
        decay={1.25}
      />

      {/* Ceiling Rotating Redline / Meltdown Klaxon Beacon (#ff2a2a — Dark when nominal, blazes red during alarm) */}
      <group position={[0, 2.86, -0.6]}>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.16, 0.2, 0.1, 12]} />
          <meshStandardMaterial
            color="#141414"
            roughness={0.7}
            metalness={0.5}
          />
        </mesh>
        <group ref={klaxonSpinnerRef}>
          <mesh position={[0, -0.04, 0]}>
            <cylinderGeometry args={[0.11, 0.13, 0.16, 10]} />
            <meshStandardMaterial
              ref={klaxonLampMatRef}
              color="#7a1515"
              emissive="#ff2a2a"
              emissiveIntensity={0.05}
              roughness={0.35}
            />
          </mesh>
          <pointLight
            ref={klaxonLightRef}
            visible={false}
            position={[0.25, -0.08, 0]}
            color="#ff2a2a"
            intensity={0}
            distance={9.5}
            decay={1.2}
          />
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

const Komrad84SplitScreenCrt3D: React.FC<{
  bulletinIdx: number;
  onCycleBulletin: () => void;
}> = React.memo(({ bulletinIdx, onCycleBulletin }) => {
  const crtMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lastCrtDrawRef = useRef(0);
  const lastDiagVideoTimeRef = useRef(-1);
  const lastDiagFrameSeqRef = useRef(-1);
  const lastDiagGlitchTickRef = useRef(-1);

  const crtDiagOverlayCanvas = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1000;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Solid opaque top & bottom letterbox bars (ensure previous MM:SS clears every frame)
      ctx.fillStyle = "#020804";
      ctx.fillRect(0, 0, 1600, 50);
      ctx.fillRect(0, 950, 1600, 50);

      // Subtle CRT scanlines across the 1600x1000 display
      ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      for (let y = 0; y < 1000; y += 6) {
        ctx.fillRect(0, y, 1600, 2);
      }

      // Outer phosphor frame
      ctx.strokeStyle = "rgba(57, 255, 20, 0.55)";
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, 1588, 988);

      // Minimalist emerald phosphor header bar + divider + static channel title
      ctx.fillStyle = "rgba(2, 10, 4, 0.88)";
      ctx.fillRect(8, 8, 1584, 40);
      ctx.strokeStyle = "#1e6b34";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, 48);
      ctx.lineTo(1592, 48);
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
    return canvas;
  }, []);

  const crtTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    // 1:1 native 1600x1000 resolution for razor-sharp MacBook Retina phosphor text
    canvas.width = 1600;
    canvas.height = 1000;
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.anisotropy = 16;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const curvedCrtGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(2.26, 1.41, 16, 12);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / 1.13;
      const y = pos.getY(i) / 0.705;
      const r2 = x * x + y * y;
      const bulge = Math.max(0, 1 - r2 * 0.42) * 0.028;
      pos.setZ(i, bulge);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    const state = useGameStore.getState();
    if (!state.diagFeedActive) {
      lastDiagVideoTimeRef.current = -1;
      lastDiagFrameSeqRef.current = -1;
      lastDiagGlitchTickRef.current = -1;
      if (now - lastCrtDrawRef.current < 0.08) return;
    }

    const tex = crtMatRef.current?.map as THREE.CanvasTexture | undefined;
    const canvas = tex?.image as HTMLCanvasElement | undefined;
    if (state.diagFeedActive) {
      if (!canvas || !tex) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = 1600;
      const h = 1000;
      const vid = getSkalaDiagFeedElement();
      const syncing = isSkalaDiagFeedSyncing();

      if (syncing || !vid || vid.readyState < 2) {
        const elapsedMs = Math.max(
          0,
          performance.now() - getSkalaDiagFeedStartMs(),
        );
        const tick = Math.floor(elapsedMs / 35);
        if (tick === lastDiagGlitchTickRef.current) return;
        lastDiagGlitchTickRef.current = tick;
        lastCrtDrawRef.current = 0;
        tex.userData.lastSig = "";

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
        tex.needsUpdate = true;
        return;
      }

      const vTime = vid.currentTime;
      const frameSeq = getSkalaDiagFeedFrameSeq();
      if (
        lastDiagVideoTimeRef.current >= 0 &&
        frameSeq === lastDiagFrameSeqRef.current &&
        Math.abs(vTime - lastDiagVideoTimeRef.current) < 0.004
      ) {
        return;
      }
      lastDiagVideoTimeRef.current = vTime;
      lastDiagFrameSeqRef.current = frameSeq;
      lastCrtDrawRef.current = 0;
      tex.userData.lastSig = "";

      ctx.save();
      ctx.scale(canvas.width / w, canvas.height / h);

      const vw = vid.videoWidth || 1280;
      const vh = vid.videoHeight || 720;
      const fit = Math.min(1600 / vw, 900 / vh);
      const drawW = Math.round(vw * fit);
      const drawH = Math.round(vh * fit);
      const drawX = Math.round((w - drawW) / 2);
      const drawY = Math.round(50 + (900 - drawH) / 2);
      if (drawW < 1600 || drawH < 900) {
        ctx.fillStyle = "#020804";
        ctx.fillRect(0, 50, 1600, 900);
      }
      ctx.drawImage(vid, drawX, drawY, drawW, drawH);
      ctx.drawImage(crtDiagOverlayCanvas, 0, 0);

      const curSec = Math.max(0, Math.floor(vTime || 0));
      const mm = String(Math.floor(curSec / 60)).padStart(2, "0");
      const ss = String(curSec % 60).padStart(2, "0");
      ctx.font = '700 22px "Consolas", "Lucida Console", monospace';
      ctx.textAlign = "right";
      drawHeavyCrtText(
        ctx,
        `${mm}:${ss}`,
        w - 24,
        36,
        "#39ff14",
        0.85,
        200,
      );

      ctx.restore();
      tex.needsUpdate = true;
      return;
    }

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
    const totalAllocatedMW = state.substations.reduce(
      (sum, s) => sum + s.allocatedMW,
      0,
    );
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
          ? `⚠️ GRID DEFICIT: TURN [BATTERY -> GRID] WHEEL ON UNIT C OR RAISE RODS (A-2) FOR ${totalAllocatedMW} MW!`
          : rawHint);
    const subSig = state.substations
      .map((s) => `${s.id}:${s.allocatedMW}:${s.targetMW}:${s.statusText}:${s.quotaOk ? 1 : 0}`)
      .join(",");
    const skalaSig = `${Math.round(state.heliumPressure)}:${Math.round(state.graphiteTemp)}:${Math.round(state.bubblerLevel)}:${state.sealToggles.join("")}:${Math.round(state.pumpAHeat)}:${Math.round(state.pumpBHeat)}:${Math.round(state.boronTankLevel)}:${Object.keys(state.channelHotspots).length}:${Math.round(state.pressureBar)}:${Math.round(state.energyCreatedMW)}:${Math.round(state.batteryStoredPct)}:${Math.round(state.batteryOutputValve * 100)}:${Math.round(state.energyDemandMW)}`;
    const sig = `${timeBucket}|${skalaSig}|${state.phase}|${state.tutorialPhase}|${state.tutorialPrompt.header}|${state.tutorialPrompt.body}|${latestChatMsg?.id ?? ""}|${cdSec}|${contextualHint ?? ""}|${Math.round(state.controlRods * 100)}|${Math.round(state.totalElectricalMW)}|${Math.round(state.drumWaterLevel)}|${Math.round(state.drumPressure)}|${subSig}|${deskState.printingDoc?.id ?? ""}|${deskState.capsuleState}|${deskState.hatchOpen}|${lastEntryId}|${state.bubblerDraining}|${state.auxLoopBActive}|${state.kgbLineActive}|${activeDeskDoc?.id ?? "NONE"}|${activeDeskDoc?.stamps.length ?? 0}|${Math.round(state.pumpThrottle[0])}|${Math.round(state.pumpThrottle[1])}|${Math.round(state.waterReservoir)}|${Math.round(state.waterUsage)}|${Math.round(state.coreTemp / 2) * 2}|${state.ciaIntrusionActive}|${Math.round(state.ciaIntrusionProgress)}|${state.komradOverrideLocked}|${state.isBlackout}|${bulletinIdx}`;
    if (!canvas || !tex || tex.userData.lastSig === sig) return;
    lastCrtDrawRef.current = now;
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
      const totalTargetGridMW = state.substations.reduce(
        (s, x) => s + x.targetMW,
        0,
      );
      const targetMWtForOrder = (totalTargetGridMW / 1000) * 3200;
      const steamDrawMWtEst = state.batteryOutputValve * 3200;
      const highReactivityOverheat =
        state.coreTemp > 550 && state.controlRodLevel > 78;
      const apSaturated =
        state.tutorialPhase === "COMPLETED" &&
        isCoreOperating &&
        !state.autoRodEnabled &&
        (Math.abs(targetMWtForOrder - state.thermalPower) > 180 ||
          Math.abs(steamDrawMWtEst - state.thermalPower) > 200);
      const bayA2Status: "OK" | "WARN" | "ALERT" =
        hotspotCount >= 4 || bearingTemp > 90 || highReactivityOverheat
          ? "ALERT"
          : hotspotCount >= 1 ||
              apSaturated ||
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
                    : apSaturated
                      ? "⚠️ AP SATURATED! MOVE [CONTROL RODS]!"
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
            ? `⚡ ${deltaDemandC} MW DEFICIT! TURN [WHEEL] UP`
            : state.tutorialPhase === "COMPLETED" && deltaDemandC > 35
              ? `⚠️ +${deltaDemandC} MW SURPLUS! TRIM [WHEEL] DOWN`
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
        "[1-5] STATION ZOOM | [0/ESC] CHAIR | DRAG UNIT A LEVERS FOR POWER",
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
    <mesh
      geometry={curvedCrtGeometry}
      position={[0, 1.74, 0.142]}
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
        color="#1a261e"
        emissive="#ffffff"
        emissiveMap={crtTexture}
        emissiveIntensity={0.92}
        roughness={0.96}
        metalness={0.0}
      />
    </mesh>
  );
});

/**
 * Heavy Soviet-Era Hermetic Steel Bunker Door (`Гермодверь ГД-84`) with Industrial Overhead Bulkhead Warning Light (`Плафон ВЗГ-200`)
 * Placed in the recessed wall gaps between control panels to seal the bunker perimeter with authentic 1984 Chernobyl-4 industrial detail.
 */
const SovietHermeticBunkerDoor3D: React.FC<{
  position: [number, number, number];
  rotation: [number, number, number];
  doorCode?: string;
  subLabel?: string;
}> = React.memo(
  ({
    position,
    rotation,
    doorCode = "AIRLOCK DOOR NO. 4 // SECTOR 04",
    subLabel = "TURBINE HALL TG-1 AIRLOCK • CONTAINMENT SEAL",
  }) => {
    const wheelGroupRef = useRef<THREE.Group>(null);
    const dogBarsGroupRef = useRef<THREE.Group>(null);
    const bulbMatRef = useRef<THREE.MeshStandardMaterial>(null);
    const glassMatRef = useRef<THREE.MeshStandardMaterial>(null);
    const pointLightRef = useRef<THREE.PointLight>(null);
    const wheelAngleRef = useRef(0);
    const targetWheelAngleRef = useRef(0);

    const ironTex = useMemo(() => getHammeredIronTextures(), []);
    const brassTex = useMemo(() => getBrushedBrassTextures(), []);

    // Procedural weathered olive-drab steel door texture (#2a3328 / #343b35) with grease grime halo around locking hub & rivets
    const doorSteelTex = useMemo(
      () =>
        createNearestCanvasTexture(256, 512, (ctx, w, h) => {
          ctx.fillStyle = "#2a3328";
          ctx.fillRect(0, 0, w, h);

          // Subtle vertical rolled-steel brushing & weld seam bands
          for (let y = 0; y < h; y += 4) {
            ctx.fillStyle =
              y % 8 === 0
                ? "rgba(52, 59, 53, 0.55)"
                : "rgba(20, 26, 20, 0.35)";
            ctx.fillRect(0, y, w, 2);
          }

          // Dark oil/grease grime halo around the central locking wheel shaft (x: 148, y: 268)
          const grimeGrad = ctx.createRadialGradient(148, 268, 8, 148, 268, 72);
          grimeGrad.addColorStop(0, "rgba(10, 12, 10, 0.85)");
          grimeGrad.addColorStop(0.55, "rgba(18, 22, 16, 0.48)");
          grimeGrad.addColorStop(1, "rgba(42, 51, 40, 0)");
          ctx.fillStyle = grimeGrad;
          ctx.beginPath();
          ctx.arc(148, 268, 72, 0, Math.PI * 2);
          ctx.fill();

          // Industrial edge wear & chipped primer scuffs along bottom threshold
          const bottomWear = ctx.createLinearGradient(0, h - 68, 0, h);
          bottomWear.addColorStop(0, "rgba(20, 24, 19, 0)");
          bottomWear.addColorStop(1, "rgba(14, 16, 13, 0.82)");
          ctx.fillStyle = bottomWear;
          ctx.fillRect(0, h - 68, w, 68);

          // Perimeter rivet dots
          ctx.fillStyle = "#181e18";
          for (let ry = 18; ry < h - 14; ry += 32) {
            ctx.fillRect(10, ry, 5, 5);
            ctx.fillRect(w - 15, ry, 5, 5);
          }
        }),
      [],
    );

    // Worn yellow/black diagonal ГОСТ safety hazard stripes for the stepped door threshold sill & side jambs
    const gostHazardTex = useMemo(
      () =>
        createNearestCanvasTexture(256, 64, (ctx, w, h) => {
          ctx.fillStyle = "#141414";
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = "#d99b16";
          const stripeW = 24;
          for (let x = -h; x < w + h; x += stripeW * 2) {
            ctx.beginPath();
            ctx.moveTo(x, h);
            ctx.lineTo(x + stripeW, h);
            ctx.lineTo(x + stripeW + h, 0);
            ctx.lineTo(x + h, 0);
            ctx.closePath();
            ctx.fill();
          }
          // Grime & boot-scuff weathering across threshold hazard stripes
          ctx.fillStyle = "rgba(16, 18, 15, 0.36)";
          for (let y = 0; y < h; y += 6) {
            ctx.fillRect(0, y, w, 2);
          }
          ctx.strokeStyle = "#2b302c";
          ctx.lineWidth = 4;
          ctx.strokeRect(2, 2, w - 4, h - 4);
        }),
      [],
    );

    // Stenciled Soviet ГОСТ Hermetic Door Warning Plaque
    const doorPlaqueTex = useMemo(
      () =>
        makePlaqueTex(doorCode, subLabel, {
          width: 448,
          height: 112,
          titleSize: 32,
          subSize: 22,
          titleColor: "#ffb000",
          subColor: "#e6dec3",
          borderColor: "#b8a46b",
          bgColor: "#1a211c",
        }),
      [doorCode, subLabel],
    );

    useFrame(({ clock }, dt) => {
      const t = clock.getElapsedTime();
      const s = useGameStore.getState();
      const totalMW =
        s.powerAllocation.cooling +
        s.powerAllocation.defense +
        s.powerAllocation.facility +
        (s.ventilationActive ? 10 : 0);
      const isDanger =
        s.coreTemp >= 700 ||
        s.radiationLevel >= 2.2 ||
        totalMW > s.maxSafePower ||
        s.ciaIntrusionActive;

      // Smoothly interpolate locking wheel (`штурвал`) and radiating dog bars
      wheelAngleRef.current = THREE.MathUtils.lerp(
        wheelAngleRef.current,
        targetWheelAngleRef.current,
        Math.min(1, dt * 14),
      );
      if (wheelGroupRef.current) {
        wheelGroupRef.current.rotation.z = wheelAngleRef.current;
      }
      if (dogBarsGroupRef.current) {
        const lockShift = Math.sin(wheelAngleRef.current) * 0.012;
        dogBarsGroupRef.current.scale.setScalar(1 + lockShift);
      }

      // Animate overhead industrial bulkhead warning fixture (`#ffaa33` warm amber vs `#ff2a2a` alarm pulse)
      const subtleFlicker =
        0.92 +
        Math.sin(t * 23.0 + position[0]) * 0.05 +
        Math.cos(t * 47.0) * 0.03;
      const alarmPulse = 0.55 + 0.45 * Math.sin(t * 10.5);

      if (s.isBlackout) {
        if (pointLightRef.current) pointLightRef.current.intensity = 0.12;
        if (bulbMatRef.current) bulbMatRef.current.emissiveIntensity = 0.15;
        if (glassMatRef.current) glassMatRef.current.emissiveIntensity = 0.08;
      } else if (isDanger) {
        if (pointLightRef.current) {
          pointLightRef.current.color.set("#ff2a2a");
          pointLightRef.current.intensity = (1.6 + alarmPulse * 1.8) * subtleFlicker;
        }
        if (bulbMatRef.current) {
          bulbMatRef.current.color.set("#ff4433");
          bulbMatRef.current.emissive.set("#ff2a2a");
          bulbMatRef.current.emissiveIntensity = 1.8 + alarmPulse * 1.6;
        }
        if (glassMatRef.current) {
          glassMatRef.current.color.set("#ff5533");
          glassMatRef.current.emissive.set("#ff2a2a");
          glassMatRef.current.emissiveIntensity = 0.9 + alarmPulse * 0.9;
        }
      } else {
        if (pointLightRef.current) {
          pointLightRef.current.color.set("#ffaa33");
          pointLightRef.current.intensity = 1.75 * subtleFlicker;
        }
        if (bulbMatRef.current) {
          bulbMatRef.current.color.set("#ffcf75");
          bulbMatRef.current.emissive.set("#ffaa33");
          bulbMatRef.current.emissiveIntensity = 1.65 * subtleFlicker;
        }
        if (glassMatRef.current) {
          glassMatRef.current.color.set("#ffba52");
          glassMatRef.current.emissive.set("#ff9922");
          glassMatRef.current.emissiveIntensity = 0.72 * subtleFlicker;
        }
      }
    });

    return (
      <group position={position} rotation={rotation}>
        {/* 1. RECESSED CONCRETE & WELDED STEEL BULKHEAD SURROUND WALL */}
        <mesh position={[0, 1.24, -0.14]} castShadow receiveShadow>
          <boxGeometry args={[1.64, 2.52, 0.18]} />
          <meshStandardMaterial
            color="#1c241e"
            roughness={0.62}
            metalness={0.52}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.009}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>

        {/* Left & Right Vertical Steel Bulkhead Stiffener Columns */}
        {[-0.74, 0.74].map((cx, cIdx) => (
          <mesh
            key={`stiff-${cIdx}`}
            position={[cx, 1.22, -0.04]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.12, 2.46, 0.08]} />
            <meshStandardMaterial
              color="#222a24"
              roughness={0.48}
              metalness={0.68}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
        ))}

        {/* 2. HEAVY BOLTED STEEL OUTER DOOR FRAME (`КОРОБКА ГЕРМОДВЕРИ`) */}
        {/* Left & Right Outer Frame Jambs */}
        {[-0.54, 0.54].map((jx, jIdx) => (
          <group key={`jamb-${jIdx}`} position={[jx, 1.09, 0.01]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.11, 2.16, 0.11]} />
              <meshStandardMaterial
                color="#2a3328"
                roughness={0.46}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
                roughnessMap={ironTex.roughnessMap}
              />
            </mesh>
            {/* 7 Heavy Protruding Perimeter Hex Bolts per Jamb */}
            {[-0.92, -0.62, -0.32, 0, 0.32, 0.62, 0.92].map((by, bIdx) => (
              <mesh
                key={`jbolt-${bIdx}`}
                position={[jIdx === 0 ? -0.015 : 0.015, by, 0.06]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
              >
                <cylinderGeometry args={[0.013, 0.013, 0.018, 6]} />
                <meshStandardMaterial
                  color="#b8a46b"
                  metalness={0.86}
                  roughness={0.28}
                  bumpMap={brassTex.bumpMap}
                  bumpScale={0.005}
                />
              </mesh>
            ))}
          </group>
        ))}

        {/* Top Lintel Beam & Bottom Hermetic Coaming Sill (`Порог Гермодвери`) */}
        <mesh position={[0, 2.12, 0.015]} castShadow receiveShadow>
          <boxGeometry args={[1.22, 0.12, 0.12]} />
          <meshStandardMaterial
            color="#2a3328"
            roughness={0.46}
            metalness={0.68}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        <mesh position={[0, 0.07, 0.02]} castShadow receiveShadow>
          <boxGeometry args={[1.22, 0.14, 0.13]} />
          <meshStandardMaterial
            color="#242b23"
            roughness={0.5}
            metalness={0.68}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>

        {/* Worn Yellow/Black Diagonal ГОСТ Hazard Stripes across Threshold Sill & Upper Lintel */}
        <mesh position={[0, 0.07, 0.087]}>
          <planeGeometry args={[1.14, 0.095]} />
          <meshStandardMaterial
            map={gostHazardTex}
            roughness={0.65}
            metalness={0.25}
          />
        </mesh>
        <mesh position={[0, 2.12, 0.077]}>
          <planeGeometry args={[1.14, 0.065]} />
          <meshStandardMaterial
            map={gostHazardTex}
            roughness={0.65}
            metalness={0.25}
          />
        </mesh>

        {/* Top Lintel Hex Bolts */}
        {[-0.42, -0.21, 0, 0.21, 0.42].map((bx, bIdx) => (
          <mesh
            key={`tbolt-${bIdx}`}
            position={[bx, 2.12, 0.08]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.013, 0.013, 0.018, 6]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.86}
              roughness={0.28}
            />
          </mesh>
        ))}

        {/* 4 Welded Corner Gusset Plates */}
        {(
          [
            [-0.48, 2.04],
            [0.48, 2.04],
            [-0.48, 0.16],
            [0.48, 0.16],
          ] as const
        ).map(([gx, gy], gIdx) => (
          <mesh
            key={`gusset-${gIdx}`}
            position={[gx, gy, 0.062]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.13, 0.13, 0.016]} />
            <meshStandardMaterial
              color="#1e241e"
              metalness={0.75}
              roughness={0.4}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
        ))}

        {/* 3. RECESSED ARMORED STEEL DOOR LEAF (`ПОЛОТНО ГЕРМОДВЕРИ`) */}
        <mesh position={[0, 1.09, -0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.98, 1.92, 0.065]} />
          <meshStandardMaterial
            map={doorSteelTex}
            color="#343b35"
            roughness={0.52}
            metalness={0.62}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>

        {/* Inner Rubber Compression Gasket Frame around Door Leaf */}
        <mesh position={[0, 1.09, -0.04]}>
          <boxGeometry args={[1.02, 1.96, 0.02]} />
          <meshStandardMaterial color="#121412" roughness={0.92} />
        </mesh>

        {/* 4 Horizontal Welded Steel Reinforcing Ribs across the Door Leaf */}
        {[0.34, 0.76, 1.44, 1.84].map((ry, rIdx) => (
          <group key={`rib-${rIdx}`} position={[0, ry, 0.022]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.94, 0.048, 0.032]} />
              <meshStandardMaterial
                color="#2a3328"
                roughness={0.44}
                metalness={0.7}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.007}
              />
            </mesh>
            {[-0.38, -0.19, 0, 0.19, 0.38].map((rx, bIdx) => (
              <mesh
                key={`rbolt-${bIdx}`}
                position={[rx, 0, 0.02]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <cylinderGeometry args={[0.008, 0.008, 0.01, 6]} />
                <meshStandardMaterial
                  color="#8a929a"
                  metalness={0.85}
                  roughness={0.3}
                />
              </mesh>
            ))}
          </group>
        ))}

        {/* 3 Massive Cylindrical Industrial Barrel Hinges on Left Side (`Петли Гермодвери`) */}
        {[0.42, 1.09, 1.76].map((hy, hIdx) => (
          <group key={`hinge-${hIdx}`} position={[-0.50, hy, 0.052]}>
            {/* Upper & Lower Hinge knuckles */}
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.038, 0.038, 0.18, 12]} />
              <meshStandardMaterial
                color="#242b24"
                roughness={0.42}
                metalness={0.74}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
              />
            </mesh>
            {/* Central Brass Hinge Pin & Grease Nipple */}
            <mesh castShadow>
              <cylinderGeometry args={[0.024, 0.024, 0.21, 10]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.86}
                roughness={0.26}
              />
            </mesh>
            {/* Welded Hinge Leaf Strap onto Door Plate */}
            <mesh position={[0.09, 0, -0.022]} castShadow receiveShadow>
              <boxGeometry args={[0.16, 0.075, 0.026]} />
              <meshStandardMaterial
                color="#2a3328"
                roughness={0.44}
                metalness={0.7}
              />
            </mesh>
          </group>
        ))}

        {/* Stenciled ГОСТ Warning Plaque & Armored Inspection Peep-Port (`Смотровое Окно`) */}
        <mesh position={[0, 1.63, 0.02]}>
          <boxGeometry args={[0.66, 0.155, 0.012]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.82}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0, 1.63, 0.028]}>
          <planeGeometry args={[0.64, 0.14]} />
          <meshStandardMaterial
            map={doorPlaqueTex}
            emissive="#ffffff"
            emissiveMap={doorPlaqueTex}
            emissiveIntensity={0.28}
            roughness={0.65}
          />
        </mesh>

        {/* Armored Circular Peep-Port above Locking Wheel */}
        <group position={[-0.24, 1.29, 0.022]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.068, 0.076, 0.028, 16]} />
            <meshStandardMaterial
              color="#1e241e"
              metalness={0.76}
              roughness={0.38}
            />
          </mesh>
          <mesh position={[0, 0, 0.015]}>
            <circleGeometry args={[0.052, 16]} />
            <meshStandardMaterial
              color="#0a1610"
              emissive="#123020"
              emissiveIntensity={0.35}
              roughness={0.18}
              metalness={0.4}
            />
          </mesh>
          {/* Cross-Bar Guard over Peep-Port */}
          {[0, Math.PI / 2].map((ang, idx) => (
            <mesh
              key={`pguard-${idx}`}
              position={[0, 0, 0.018]}
              rotation={[0, 0, ang]}
            >
              <boxGeometry args={[0.105, 0.008, 0.006]} />
              <meshStandardMaterial
                color="#2a3328"
                metalness={0.78}
                roughness={0.35}
              />
            </mesh>
          ))}
        </group>

        {/* 4. CENTRAL LOCKING WHEEL MECHANISM (`ШТУРВАЛ ГЕРМОДВЕРИ`) & RADIATING LOCKING BARS (`РИГЕЛИ`) */}
        <group
          position={[0.08, 1.06, 0.024]}
          onClick={(e) => {
            if (useCameraLookStore.getState().isFreeLookMode) return;
            e.stopPropagation();
            targetWheelAngleRef.current += Math.PI / 3;
            playSwitchClank(true);
            playLeverRatchet(0.9);
          }}
        >
          {/* Central Cast-Iron Gearbox Boss & Brass Stuffing Gland */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.125, 0.145, 0.044, 16]} />
            <meshStandardMaterial
              color="#181e19"
              roughness={0.46}
              metalness={0.72}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          <mesh
            position={[0, 0, 0.032]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.052, 0.062, 0.042, 12]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.86}
              roughness={0.28}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>

          {/* 4 Radiating Steel Locking Bars / Wedges (`Запоры`) engaging the Frame Keepers */}
          <group ref={dogBarsGroupRef}>
            {/* Left & Right Horizontal Locking Bars */}
            <mesh position={[-0.31, 0, 0.008]} castShadow>
              <boxGeometry args={[0.42, 0.034, 0.022]} />
              <meshStandardMaterial
                color="#8a929a"
                metalness={0.84}
                roughness={0.32}
              />
            </mesh>
            <mesh position={[0.25, 0, 0.008]} castShadow>
              <boxGeometry args={[0.32, 0.034, 0.022]} />
              <meshStandardMaterial
                color="#8a929a"
                metalness={0.84}
                roughness={0.32}
              />
            </mesh>
            {/* Top & Bottom Diagonal/Vertical Locking Wedges */}
            <mesh
              position={[0.16, 0.24, 0.008]}
              rotation={[0, 0, 0.72]}
              castShadow
            >
              <boxGeometry args={[0.38, 0.028, 0.02]} />
              <meshStandardMaterial
                color="#8a929a"
                metalness={0.84}
                roughness={0.32}
              />
            </mesh>
            <mesh
              position={[0.16, -0.24, 0.008]}
              rotation={[0, 0, -0.72]}
              castShadow
            >
              <boxGeometry args={[0.38, 0.028, 0.02]} />
              <meshStandardMaterial
                color="#8a929a"
                metalness={0.84}
                roughness={0.32}
              />
            </mesh>
          </group>

          {/* Heavy Frame Locking Dog Keeper Brackets on Right Jamb */}
          {[-0.26, 0, 0.26].map((ky, kIdx) => (
            <mesh
              key={`keeper-${kIdx}`}
              position={[0.39, ky, 0.018]}
              castShadow
            >
              <boxGeometry args={[0.068, 0.064, 0.044]} />
              <meshStandardMaterial
                color="#1e241e"
                metalness={0.78}
                roughness={0.38}
              />
            </mesh>
          ))}

          {/* 6-Spoke Circular Steel Locking Handwheel (`Штурвал`) */}
          <group ref={wheelGroupRef} position={[0, 0, 0.078]}>
            {/* Invisible Hit-Cylinder */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.22, 0.22, 0.08, 16]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {/* Heavy Cast-Iron Rim painted weathered Soviet crimson-oxide (#7a1f18) */}
            <mesh castShadow receiveShadow>
              <torusGeometry args={[0.175, 0.02, 12, 28]} />
              <meshStandardMaterial
                color="#7a1f18"
                roughness={0.44}
                metalness={0.52}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
                roughnessMap={ironTex.roughnessMap}
              />
            </mesh>
            {/* 3 Intersecting Steel Bars = 6 Spokes */}
            {[0, Math.PI / 3, (2 * Math.PI) / 3].map((ang, sIdx) => (
              <mesh key={`spoke-${sIdx}`} rotation={[0, 0, ang]} castShadow>
                <cylinderGeometry args={[0.011, 0.011, 0.34, 8]} />
                <meshStandardMaterial
                  color="#8a929a"
                  metalness={0.85}
                  roughness={0.32}
                />
              </mesh>
            ))}
            {/* Central Machined Steel Cap & Brass Nut */}
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.038, 0.042, 0.036, 12]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.88}
                roughness={0.24}
              />
            </mesh>
          </group>
        </group>

        {/* 5. INDUSTRIAL OVERHEAD SOVIET BULKHEAD WARNING LIGHT FIXTURE (`ПЛАФОН ВЗГ-200`) */}
        <group position={[0, 2.33, 0.08]}>
          {/* Cast-Iron Conduit Pipe & Wall Mounting Flange */}
          <mesh position={[0, 0.02, -0.05]} castShadow>
            <boxGeometry args={[0.18, 0.14, 0.04]} />
            <meshStandardMaterial
              color="#18211b"
              metalness={0.75}
              roughness={0.4}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
          <mesh
            position={[0, 0.04, 0.01]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.024, 0.028, 0.12, 10]} />
            <meshStandardMaterial
              color="#222b25"
              metalness={0.75}
              roughness={0.38}
            />
          </mesh>
          {/* Heavy Cast-Iron Lamp Dome Cap */}
          <mesh position={[0, 0.015, 0.06]} castShadow>
            <cylinderGeometry args={[0.068, 0.082, 0.055, 14]} />
            <meshStandardMaterial
              color="#23312b"
              metalness={0.72}
              roughness={0.4}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
          {/* Thick Ribbed Amber/Red Glass Lens Cylinder */}
          <mesh position={[0, -0.055, 0.06]}>
            <cylinderGeometry args={[0.064, 0.056, 0.11, 14]} />
            <meshStandardMaterial
              ref={glassMatRef}
              color="#ffba52"
              emissive="#ff9922"
              emissiveIntensity={0.72}
              transparent
              opacity={0.86}
              roughness={0.22}
              metalness={0.1}
            />
          </mesh>
          {/* Inner Glowing Tungsten Filament Bulb */}
          <mesh position={[0, -0.05, 0.06]}>
            <sphereGeometry args={[0.036, 10, 10]} />
            <meshStandardMaterial
              ref={bulbMatRef}
              color="#ffcf75"
              emissive="#ffaa33"
              emissiveIntensity={1.65}
            />
          </mesh>
          {/* Protective Brass & Cast-Iron Wire Guard Cage */}
          <mesh
            position={[0, -0.02, 0.06]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <torusGeometry args={[0.072, 0.006, 8, 16]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.86}
              roughness={0.28}
            />
          </mesh>
          <mesh
            position={[0, -0.09, 0.06]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <torusGeometry args={[0.064, 0.005, 8, 16]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.86}
              roughness={0.28}
            />
          </mesh>
          {[0, Math.PI / 2, Math.PI / 4, -Math.PI / 4].map((cAng, cIdx) => (
            <mesh
              key={`cage-${cIdx}`}
              position={[0, -0.062, 0.06]}
              rotation={[Math.PI, cAng, 0]}
              castShadow
            >
              <torusGeometry args={[0.068, 0.0045, 6, 12, Math.PI]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.86}
                roughness={0.28}
              />
            </mesh>
          ))}
          {/* Atmospheric Warm Amber/Red PointLight casting glow onto the steel door and wheel below */}
          <pointLight
            ref={pointLightRef}
            position={[0, -0.12, 0.18]}
            color="#ffaa33"
            intensity={1.75}
            distance={3.2}
            decay={1.4}
          />
        </group>
      </group>
    );
  },
);

/**
 * Recessed Soviet Industrial Luminous Ceiling Grid (`СВЕТОВОЙ ПОТОЛОК БЩУ-4`)
 * Dark steel T-bar grid beams with dim, moody warm-grey/amber baffled diffuser panels
 * high overhead (`y = 3.32m..3.39m`) that give the control room authentic Chernobyl-4
 * ceiling architecture and subtle metallic edge reflections without brightening the dark night shift mood.
 */
const SovietLuminousCeilingGrid3D: React.FC = React.memo(() => {
  const diffuserMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const diffuserGridTex = useMemo(
    () =>
      createNearestCanvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = "#2b332f";
        ctx.fillRect(0, 0, w, h);

        // Egg-crate acoustic/luminous baffle louver grid
        ctx.strokeStyle = "#161b19";
        ctx.lineWidth = 3;
        for (let x = 0; x <= w; x += 32) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y <= h; y += 32) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }

        // Subtle warm-amber/grey fluorescent tube glow behind louver cells
        for (let cy = 16; cy < h; cy += 32) {
          for (let cx = 16; cx < w; cx += 32) {
            ctx.fillStyle =
              (cx + cy) % 64 === 0
                ? "rgba(218, 198, 152, 0.42)"
                : "rgba(168, 184, 174, 0.32)";
            ctx.fillRect(cx - 11, cy - 11, 22, 22);
          }
        }

        ctx.strokeStyle = "#141817";
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, w - 8, h - 8);
      }),
    [],
  );

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

    if (diffuserMatRef.current) {
      if (s.isBlackout) {
        diffuserMatRef.current.emissive.set("#000000");
        diffuserMatRef.current.emissiveIntensity = 0.02;
      } else if (isAlarm) {
        diffuserMatRef.current.emissive.set("#d86848");
        diffuserMatRef.current.emissiveIntensity = 0.22 * humFlicker;
      } else if (s.powerAllocation.facility <= 10) {
        diffuserMatRef.current.emissive.set("#a89874");
        diffuserMatRef.current.emissiveIntensity = 0.11 * humFlicker;
      } else {
        diffuserMatRef.current.emissive.set("#c8be9e");
        diffuserMatRef.current.emissiveIntensity = 0.18 * humFlicker;
      }
    }
  });

  const longitudinalXs = [-2.7, -1.8, -0.9, 0.0, 0.9, 1.8, 2.7];
  const bayZs = [-1.0, 0.2, 1.4, 2.6, 3.8, 5.0];
  const bayXs = [-2.25, -1.35, -0.45, 0.45, 1.35, 2.25];

  return (
    <group>
      {/* Longitudinal Steel T-Bar Ceiling Runners (`y = 3.33m`) */}
      {longitudinalXs.map((lx) => (
        <mesh key={`ceil-runner-${lx}`} position={[lx, 3.33, 2.0]}>
          <boxGeometry args={[0.065, 0.08, 7.4]} />
          <meshStandardMaterial
            color="#1c2321"
            metalness={0.68}
            roughness={0.44}
          />
        </mesh>
      ))}

      {/* Recessed Baffled Fluorescent Diffuser Panels Between Ceiling Beams (`y = 3.36m`) */}
      {bayZs.map((bz) =>
        bayXs.map((bx) => {
          const isLitTile = Math.abs(bx) <= 1.4 || bz === 0.2 || bz === 2.6;
          return (
            <mesh
              key={`ceil-tile-${bx}-${bz}`}
              position={[bx, 3.36, bz]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[0.82, 1.02]} />
              {isLitTile ? (
                <meshStandardMaterial
                  ref={diffuserMatRef}
                  map={diffuserGridTex}
                  color="#485450"
                  emissive="#c8be9e"
                  emissiveMap={diffuserGridTex}
                  emissiveIntensity={0.18}
                  roughness={0.48}
                  metalness={0.32}
                />
              ) : (
                <meshStandardMaterial
                  color="#262e2c"
                  roughness={0.65}
                  metalness={0.45}
                />
              )}
            </mesh>
          );
        }),
      )}
    </group>
  );
});

export const ControlRoomScene: React.FC = React.memo(() => {
  const bunkerArchRef = useRef<THREE.Group>(null);
  const reactorWrapRef = useRef<THREE.Group>(null);
  const terminalWrapRef = useRef<THREE.Group>(null);
  const legacyBulletinTargetRef = useRef<THREE.Object3D | null>(null);
  const [bulletinIdx, setBulletinIdx] = useState(0);

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

    // 1. Hide the legacy toy-brick keyboard group & small CRT screen inside <TerminalStation3D />
    // 2. Scale up the CRT monitor bezel (+40% width, +30% height) & cabinet width while keeping bottom bezel at y >= 0.94m so the 3 DVK-84 switches stay 100% clear!
    if (terminalWrapRef.current) {
      terminalWrapRef.current.traverse((obj) => {
        if (
          obj.userData?.isDvk84Replacement ||
          obj.parent?.userData?.isDvk84Replacement
        ) {
          return;
        }
        // Widen rear cabinet box to frame the +20% scaled CRT housing
        if (
          (obj as THREE.Mesh).isMesh &&
          Math.abs(obj.position.y - 1.01) < 0.05 &&
          Math.abs(obj.position.z - -0.18) < 0.05
        ) {
          obj.scale.set(1.64, 1.25, 1);
        }
        // Scale CRT outer bezel box (+20% additional scale) and shift Y upward to y = 1.74 while keeping bottom edge above desk buttons
        if (
          (obj as THREE.Mesh).isMesh &&
          Math.abs(obj.position.y - 1.4) < 0.03 &&
          Math.abs(obj.position.z - 0.02) < 0.03
        ) {
          obj.position.y = 1.74;
          obj.scale.set(1.68, 1.56, 1);
        }
        // Hide the legacy smaller 512x352 CRT glass mesh (replaced by <Komrad84SplitScreenCrt3D />)
        if (
          (obj as THREE.Mesh).isMesh &&
          Math.abs(obj.position.y - 1.4) < 0.03 &&
          Math.abs(obj.position.z - 0.135) < 0.03
        ) {
          obj.visible = false;
          obj.raycast = () => {};
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
              sub.raycast = () => {};
            }
          });
        }
      });
    }
  }, []);

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

  return (
    <>
      <color attach="background" args={["#050706"]} />
      <fog attach="fog" args={["#050706", 5.8, 14.0]} />

      <CameraController />
      <BuckshotDitherPass />
      <DynamicBunkerLighting />
      <BunkerTelemetryAndControlRail3D />

      {/* ============================================================
          SOVIET BUNKER ARCHITECTURE (WALLS, FLOOR, CEILING, PIPES)
         ============================================================ */}
      <group ref={bunkerArchRef}>
        <mesh
          position={[0, -0.02, 1.2]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[12, 12]} />
          <meshStandardMaterial
            color="#141414"
            roughness={0.92}
            metalness={0.15}
          />
        </mesh>

        <mesh
          position={[0, 0.005, 2.3]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[6.4, 9.2]} />
          <meshStandardMaterial
            color="#23312b"
            roughness={0.85}
            metalness={0.2}
          />
        </mesh>

        <mesh position={[0, 1.6, -2.35]} receiveShadow>
          <boxGeometry args={[9.2, 3.6, 0.25]} />
          <meshStandardMaterial
            color="#23312b"
            roughness={0.82}
            metalness={0.28}
          />
        </mesh>

        <mesh
          position={[-4.05, 1.6, 0.2]}
          rotation={[0, Math.PI / 2.35, 0]}
          receiveShadow
        >
          <boxGeometry args={[7.6, 3.6, 0.25]} />
          <meshStandardMaterial
            color="#1c2621"
            roughness={0.85}
            metalness={0.25}
          />
        </mesh>
        <mesh
          position={[3.85, 1.6, 0.1]}
          rotation={[0, -Math.PI / 2.35, 0]}
          receiveShadow
        >
          <boxGeometry args={[7.4, 3.6, 0.25]} />
          <meshStandardMaterial
            color="#1c2621"
            roughness={0.85}
            metalness={0.25}
          />
        </mesh>

        <mesh position={[0, 3.42, 1.5]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[14, 14]} />
          <meshStandardMaterial
            color="#141414"
            roughness={0.9}
            metalness={0.3}
          />
        </mesh>
        {[-1.6, -0.4, 0.8, 2.0, 3.2, 4.4, 5.6, 6.8].map((zPos) => (
          <mesh key={zPos} position={[0, 3.30, zPos]} castShadow receiveShadow>
            <boxGeometry args={[9.6, 0.14, 0.18]} />
            <meshStandardMaterial
              color="#1e2422"
              roughness={0.62}
              metalness={0.58}
            />
          </mesh>
        ))}

        {/* Recessed Soviet Luminous Ceiling Grid (`СВЕТОВОЙ ПОТОЛОК БЩУ-4`) */}
        <SovietLuminousCeilingGrid3D />

        {/* Industrial Steel Perimeter Floor Baseboards / Cable Trunking (`ПЛИНТУС КАБЕЛЬ-КАНАЛ`) */}
        <mesh position={[0, 0.08, -2.2]} castShadow receiveShadow>
          <boxGeometry args={[9.8, 0.16, 0.12]} />
          <meshStandardMaterial
            color="#2b3532"
            roughness={0.55}
            metalness={0.58}
          />
        </mesh>
        <mesh position={[0, 0.08, 7.16]} castShadow receiveShadow>
          <boxGeometry args={[9.8, 0.16, 0.12]} />
          <meshStandardMaterial
            color="#2b3532"
            roughness={0.55}
            metalness={0.58}
          />
        </mesh>
        <mesh
          position={[-3.92, 0.08, 0.2]}
          rotation={[0, Math.PI / 2.35, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[7.6, 0.16, 0.12]} />
          <meshStandardMaterial
            color="#2b3532"
            roughness={0.55}
            metalness={0.58}
          />
        </mesh>
        <mesh
          position={[3.72, 0.08, 0.1]}
          rotation={[0, -Math.PI / 2.35, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[7.4, 0.16, 0.12]} />
          <meshStandardMaterial
            color="#2b3532"
            roughness={0.55}
            metalness={0.58}
          />
        </mesh>

        {/* Rear Bunker Concrete Bulkhead Wall enclosing the Expanded 3-Bay Horseshoe Console */}
        <mesh position={[0, 1.75, 7.32]} receiveShadow>
          <boxGeometry args={[10.2, 3.8, 0.25]} />
          <meshStandardMaterial
            color="#1c2621"
            roughness={0.85}
            metalness={0.25}
          />
        </mesh>

        {/* Industrial Coolant Pipe placed high against the back wall so it never intersects the overhead telemetry board */}
        <mesh
          position={[0, 2.78, -2.18]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[0.09, 0.09, 7.6, 12]} />
          <meshStandardMaterial
            color="#364940"
            roughness={0.55}
            metalness={0.65}
          />
        </mesh>
      </group>

      {/* ============================================================
          1. FRONT-HINGED UNBROKEN 3-BAY HORSESHOE CONSOLE (`z_hinge = +0.505m`)
             Adjacent front desk lips meet point-to-point with 0.000m overlap:
             - Bay 1 (`UNIT A`, 1.98m):      pos = [-2.1600, -0.02, 3.1600], rotY = 1.7600 (100.8°)
             - Trapezoidal Bridge 1 (`J1`):  pos = [-1.4505, -0.02, 4.0724], rotY = 2.1200 (121.5°)
             - Bay 2 (`UNIT A-2`, 1.66m):    pos = [-1.0920, -0.02, 5.0171], rotY = 2.4800 (142.1°)
             - Trapezoidal Bridge 2 (`J2`):  pos = [-0.0882, -0.02, 5.1329], rotY = 2.8400 (162.7°)
             - Bay 3 (`UNIT B`, 1.66m):      pos = [ 0.8042, -0.02, 5.6068], rotY = 3.2000 (183.3°)
         ============================================================ */}
      <group
        ref={reactorWrapRef}
        position={[-2.16, -0.02, 3.16]}
        rotation={[0, 1.76, 0]}
        scale={[1.04, 1.05, 1.04]}
      >
        <group rotation={[0, -0.42, 0]}>
          <group position={[2.15, 0, 1.08]}>
            <HighDetailReactorPanel3D />
          </group>
        </group>
      </group>

      {/* Seamless Trapezoidal Corner Console Bridge 1 (Anchored at Front Hinge `J1` between `UNIT A` & `UNIT A-2`) */}
      <SovietConsoleCornerWedge3D
        position={[-1.4505, -0.02, 4.0724]}
        rotationY={2.12}
        hingeAngle={0.72}
      />

      {/* 1B. MIDDLE-LEFT PANEL (`UNIT A-2`): Front-hinged at `J1` [-1.0920, -0.02, 5.0171] */}
      <group
        position={[-1.092, -0.02, 5.0171]}
        rotation={[0, 2.48, 0]}
        scale={[1.04, 1.05, 1.04]}
      >
        <LeftRearWrapAroundPanel3D variant="left-rear" />
      </group>

      {/* Seamless Trapezoidal Corner Console Bridge 2 (Anchored at Front Hinge `J2` between `UNIT A-2` & `UNIT B`) */}
      <SovietConsoleCornerWedge3D
        position={[-0.0882, -0.02, 5.1329]}
        rotationY={2.84}
        hingeAngle={0.72}
      />

      {/* 1C. BACK-LEFT PANEL (`UNIT B`): Front-hinged at `J2` [0.8042, -0.02, 5.6068] */}
      <group
        position={[0.8042, -0.02, 5.6068]}
        rotation={[0, 3.20, 0]}
        scale={[1.04, 1.05, 1.04]}
      >
        <LeftRearWrapAroundPanel3D variant="rear" />
      </group>

      {/* 1D. HERMETIC SOVIET STEEL BUNKER DOOR (`ГЕРМОДВЕРЬ ГД-84`) IN THE GAP BETWEEN `UNIT B` AND `UNIT C` */}
      <SovietHermeticBunkerDoor3D
        position={[2.34, -0.02, 4.18]}
        rotation={[0, -1.88, 0]}
        doorCode="AIRLOCK DOOR NO. 4 // SECTOR 04"
        subLabel="TURBINE HALL TG-1 AIRLOCK • CONTAINMENT SEAL"
      />

      {/* 2. CENTER COCKPIT LOOMING TERMINAL: <TerminalStation3D /> + Enlarged Split-Screen CRT + High-Detail Soviet DVK-84 Console */}
      <group ref={terminalWrapRef} position={[0, 0.14, 2.18]}>
        <TerminalStation3D />
        <group
          position={[0, 0, -1.62]}
          userData={{ isDvk84Replacement: true }}
        >
          <Komrad84SplitScreenCrt3D
            bulletinIdx={bulletinIdx}
            onCycleBulletin={handleCycleBulletin}
          />
          <SovietDvk84KeyboardConsole3D onCycleBulletin={handleCycleBulletin} />
        </group>
      </group>

      {/* 3. CENTRAL COMMAND DESK: <InspectorDesk3D /> */}
      {ExternalInspectorDesk3D ? (
        <ExternalInspectorDesk3D />
      ) : (
        <InspectorDesk3DPlaceholder />
      )}
    </>
  );
});
