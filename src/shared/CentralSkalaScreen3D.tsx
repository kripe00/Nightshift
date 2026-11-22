import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import {
  getSkalaDiagFeedElement,
  getSkalaDiagFeedStartMs,
  isSkalaDiagFeedSyncing,
} from "../modules/inspector/audio";
import { useDeskStore } from "../modules/inspector/useDeskStore";
import { playSwitchClank } from "../modules/reactor/audioSynth";
import type { TutorialPhase } from "../simulation/rbmkPhysics";
import { NOOP_RAYCAST } from "./ExteriorDioramas3D";
import { onKremlinFontReady } from "./kremlinFontReady";
import { useGameStore } from "./useGameStore";

const CW = 1024;
const CH = 640;

const DRAW_INTERVAL_SEC = 0.125;
const DERIV_WINDOW_SEC = 1.5;
const RING_CAP = 16;

const MAX_THERMAL_MW = 3600;
const MAX_CORE_TEMP = 1150;
const MAX_PRESSURE_BAR = 120;
const MAX_GRID_MW = 1000;

const COL_BG = "#07110b";
const COL_PANEL = "#0b1a11";
const COL_TRACK = "#112419";
const COL_DIM = "#214b31";
const COL_MUTED = "#4e8b62";
const COL_GREEN = "#39ff7a";
const COL_AMBER = "#ffb833";
const COL_RED = "#ff3b2f";
const COL_XENON = "#c77dff";
const COL_VOID = "#ff9d00";
const COL_GHOST = "#7ef9ff";
const COL_WHITE = "#ffffff";

const BUBBLE_LANES: readonly [number, number, number][] = [
  [0.16, 0.0, 5],
  [0.32, 0.37, 6],
  [0.48, 0.71, 5],
  [0.64, 0.19, 7],
  [0.8, 0.54, 6],
  [0.24, 0.86, 5],
  [0.56, 0.28, 6],
  [0.72, 0.63, 4],
  [0.4, 0.92, 5],
  [0.86, 0.11, 4],
];

const VOLKOV_STEPS: readonly string[] = [
  "[1] COOL",
  "[2] RODS",
  "[3] STEAM",
  "[4] GRID",
  "[5] VOID",
  "[6] FUEL",
];

const SECTOR_SHORT_NAMES: readonly string[] = [
  "PRIPYAT",
  "DUGA-1",
  "KOLKHOZ",
  "KGB",
  "VODKA",
  "STEEL",
];

type HighlightStage =
  | "UNIT_B"
  | "UNIT_A2"
  | "UNIT_C"
  | "UNIT_A"
  | "UNIT_B_A2"
  | null;

interface VolkovStepInfo {
  step: number;
  highlight: HighlightStage;
  tag: string;
}

interface SimRingState {
  tBuf: Float64Array;
  mwBuf: Float64Array;
  tempBuf: Float64Array;
  pressBuf: Float64Array;
  waterBuf: Float64Array;
  dispatchBuf: Float64Array;
  head: number;
  count: number;
  lastShiftRunId: number;
  dMW: number;
  dTemp: number;
  dPress: number;
  dWater: number;
  dDispatch: number;
  accumSec: number;
  forceRedraw: boolean;
  pumpAngle: number;
  flowPhase: number;
  steamPhase: number;
  gridPhase: number;
  bubblePhase: number;
  blinkTick: number;
}

function clampVal(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function getVolkovStepInfo(phase: TutorialPhase): VolkovStepInfo {
  switch (phase) {
    case "STEP_1_COOLING":
      return {
        step: 0,
        highlight: "UNIT_B",
        tag: "STARTUP 1/6: START 4X MCP PUMPS & 50% FEEDWATER [KEY 3 -> UNIT B]",
      };
    case "STEP_2_PULL_RODS":
      return {
        step: 1,
        highlight: "UNIT_A2",
        tag: "STARTUP 2/6: RAISE BORON RODS TO 55% [KEY 6 -> UNIT A-2]",
      };
    case "STEP_3_BUILD_STEAM":
      return {
        step: 2,
        highlight: "UNIT_C",
        tag: "STARTUP 3/6: BUILD STEAM >54 BAR & CHARGE BATTERY [KEY 5 -> UNIT C]",
      };
    case "STEP_4_SPIN_TURBINE":
    case "STEP_5_SYNC_GRID":
    case "STEP_6_BASELINE_600MW":
      return {
        step: 3,
        highlight: "UNIT_A",
        tag: "STARTUP 4/6: SET ALL 6 SECTOR LEVERS TO 100 MW [KEY 1 -> UNIT A]",
      };
    case "STEP_7_VOID_DRILL":
      return {
        step: 4,
        highlight: "UNIT_B_A2",
        tag: "STARTUP 5/6: MATCH FEEDWATER 50% TO CLEAR VOID <24% [KEY 3 -> UNIT B]",
      };
    case "STEP_8_XENON_DRILL":
      return {
        step: 5,
        highlight: "UNIT_A2",
        tag: "STARTUP 6/6: CLICK AMBER CHANNEL & PULL REFUEL LEVER [KEY 6 -> UNIT A-2]",
      };
    case "COMPLETED":
    default:
      return {
        step: 6,
        highlight: null,
        tag: "",
      };
  }
}

function kremlinFont(px: number): string {
  return `700 ${px}px "Kremlin", monospace`;
}

function drawChevronsH(
  ctx: CanvasRenderingContext2D,
  xStart: number,
  xEnd: number,
  y: number,
  phase: number,
  color: string,
  active: boolean,
  stepPx = 14,
): void {
  if (!active) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "square";
  const shift = (phase * stepPx) % stepPx;
  for (let cx = xStart + shift; cx <= xEnd - 4; cx += stepPx) {
    ctx.beginPath();
    ctx.moveTo(cx - 5, y - 5);
    ctx.lineTo(cx + 2, y);
    ctx.lineTo(cx - 5, y + 5);
    ctx.stroke();
  }
}

function drawStatusPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  active: boolean,
  color: string,
  bgColor: string,
): void {
  ctx.fillStyle = active ? bgColor : "#08140d";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = active ? color : COL_DIM;
  ctx.lineWidth = active ? 7 : 4;
  ctx.strokeRect(x, y, w, h);

  ctx.font = kremlinFont(14);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = active ? color : COL_MUTED;
  ctx.fillText(label, x + w / 2, y + h / 2 + 1, w - 18);
  ctx.textBaseline = "alphabetic";
}

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

  ctx.fillStyle = "#040a06";
  if (drawY > 0) ctx.fillRect(0, 0, w, drawY);
  if (drawY + drawH < h) ctx.fillRect(0, drawY + drawH, w, h - (drawY + drawH));
  if (drawX > 0) ctx.fillRect(0, drawY, drawX, drawH);
  if (drawX + drawW < w) ctx.fillRect(drawX + drawW, drawY, w - (drawX + drawW), drawH);

  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 1);
  }

  ctx.strokeStyle = COL_GREEN;
  ctx.lineWidth = 7;
  ctx.strokeRect(3.5, 3.5, w - 7, h - 7);

  ctx.fillStyle = "rgba(4, 14, 8, 0.92)";
  ctx.fillRect(7, 7, w - 14, 36);
  ctx.strokeStyle = COL_DIM;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(7, 43);
  ctx.lineTo(w - 7, 43);
  ctx.stroke();

  ctx.font = kremlinFont(20);
  ctx.textAlign = "left";
  ctx.fillStyle = COL_GREEN;
  ctx.fillText("CHANNEL AZ-5 // SERVICE BROADCAST", 18, 31, 740);
}

export const CentralSkalaScreen3D: React.FC = React.memo(() => {
  const showActionHitbox = useGameStore(
    (s) =>
      s.ciaIntrusionActive ||
      s.komradOverrideLocked ||
      s.phase !== "playing",
  );

  const crtMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const diagOverlayMeshRef = useRef<THREE.Mesh>(null);
  const lastDiagGlitchTickRef = useRef(-1);
  const diagVideoTexRef = useRef<THREE.VideoTexture | null>(null);
  const crtTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const crtDiagOverlayTexRef = useRef<THREE.CanvasTexture | null>(null);
  const lastDiagDimsRef = useRef("");
  const lastDiagSecRef = useRef(-1);

  const simRef = useRef<SimRingState>({
    tBuf: new Float64Array(RING_CAP),
    mwBuf: new Float64Array(RING_CAP),
    tempBuf: new Float64Array(RING_CAP),
    pressBuf: new Float64Array(RING_CAP),
    waterBuf: new Float64Array(RING_CAP),
    dispatchBuf: new Float64Array(RING_CAP),
    head: 0,
    count: 0,
    lastShiftRunId: -1,
    dMW: 0,
    dTemp: 0,
    dPress: 0,
    dWater: 0,
    dDispatch: 0,
    accumSec: DRAW_INTERVAL_SEC,
    forceRedraw: true,
    pumpAngle: 0,
    flowPhase: 0,
    steamPhase: 0,
    gridPhase: 0,
    bubblePhase: 0,
    blinkTick: 0,
  });

  const crtTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = CW;
    canvas.height = CH;
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 1;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const crtDiagOverlayTex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = CW;
    canvas.height = CH;
    paintDiagOverlayStatic(canvas, 0, 44, CW, CH - 54);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 1;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  const curvedCrtGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(2.4, 1.38, 18, 14);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const nx = pos.getX(i) / 1.2;
      const ny = pos.getY(i) / 0.69;
      const r2 = nx * nx + ny * ny;
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

  useEffect(() => {
    let cancelled = false;
    const unsub = onKremlinFontReady(() => {
      if (cancelled) return;
      simRef.current.forceRedraw = true;
      lastDiagDimsRef.current = "";
    });
    if (typeof document !== "undefined" && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (cancelled) return;
        simRef.current.forceRedraw = true;
        lastDiagDimsRef.current = "";
      });
    }
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  useFrame(({ clock }, delta) => {
    const activeCrtTex = crtTextureRef.current;
    const activeOverlayTex = crtDiagOverlayTexRef.current;
    if (!activeCrtTex || !activeOverlayTex) return;

    const now = clock.getElapsedTime();
    const state = useGameStore.getState();
    const sim = simRef.current;

    // -------------------------------------------------------------------------
    // EASTER EGG VIDEO OVERRIDE (`sys/skala84_diag.mp4` / Shift+A+Z+5)
    // -------------------------------------------------------------------------
    if (state.diagFeedActive) {
      const vid = getSkalaDiagFeedElement();
      const syncing = isSkalaDiagFeedSyncing();

      if (syncing || !vid || vid.readyState < 2) {
        if (diagOverlayMeshRef.current?.visible) {
          diagOverlayMeshRef.current.visible = false;
        }
        if (crtMatRef.current && crtMatRef.current.map !== activeCrtTex) {
          crtMatRef.current.map = activeCrtTex;
          crtMatRef.current.needsUpdate = true;
        }
        const elapsedMs = Math.max(0, performance.now() - getSkalaDiagFeedStartMs());
        const tick = Math.floor(elapsedMs / 42);
        if (tick === lastDiagGlitchTickRef.current) return;
        lastDiagGlitchTickRef.current = tick;
        sim.forceRedraw = true;

        const canvas = activeCrtTex.image as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.fillStyle = COL_BG;
        ctx.fillRect(0, 0, CW, CH);

        for (let i = 0; i < 24; i++) {
          const bandY = (tick * 97 + i * 53) % CH;
          const bandH = 4 + ((i * 17 + tick * 5) % 14);
          ctx.fillStyle =
            i % 4 === 0 ? "rgba(57, 255, 122, 0.34)" : "rgba(18, 96, 40, 0.28)";
          ctx.fillRect(0, bandY, CW, bandH);
        }

        ctx.fillStyle = "rgba(4, 18, 10, 0.94)";
        ctx.fillRect(142, 240, 740, 140);
        ctx.strokeStyle = COL_GREEN;
        ctx.lineWidth = 7;
        ctx.strokeRect(142, 240, 740, 140);

        ctx.font = kremlinFont(28);
        ctx.textAlign = "center";
        ctx.fillStyle = COL_GREEN;
        ctx.fillText("[PROTOCOL AZ-5 // CHANNEL INTERCEPT]", CW / 2, 320, 700);
        activeCrtTex.needsUpdate = true;
        return;
      }

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
        const areaH = CH - 54;
        const fit = Math.min(CW / vw, areaH / vh);
        const drawW = Math.round(vw * fit);
        const drawH = Math.round(vh * fit);
        const drawX = Math.round((CW - drawW) / 2);
        const drawY = Math.round(44 + (areaH - drawH) / 2);

        const rw = drawW / CW;
        const rh = drawH / CH;
        const u0 = drawX / CW;
        const v0 = (CH - (drawY + drawH)) / CH;
        vTex.repeat.set(1 / rw, 1 / rh);
        vTex.offset.set(-u0 / rw, -v0 / rh);

        const overlayCanvas = activeOverlayTex.image as HTMLCanvasElement;
        paintDiagOverlayStatic(overlayCanvas, drawX, drawY, drawW, drawH);
        activeOverlayTex.needsUpdate = true;
        lastDiagSecRef.current = -1;
      }

      if (crtMatRef.current && crtMatRef.current.map !== vTex) {
        crtMatRef.current.map = vTex;
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
          oCtx.fillStyle = "#040a06";
          oCtx.fillRect(820, 9, 192, 32);
          oCtx.font = kremlinFont(20);
          oCtx.textAlign = "right";
          oCtx.fillStyle = COL_GREEN;
          oCtx.fillText(`${mm}:${ss}`, CW - 18, 31, 170);
          activeOverlayTex.needsUpdate = true;
        }
      }
      return;
    }

    // Restore normal SKALA texture when exiting AZ-5 video feed
    lastDiagGlitchTickRef.current = -1;
    if (diagOverlayMeshRef.current?.visible) {
      diagOverlayMeshRef.current.visible = false;
    }
    if (crtMatRef.current && crtMatRef.current.map !== activeCrtTex) {
      crtMatRef.current.map = activeCrtTex;
      crtMatRef.current.needsUpdate = true;
      sim.forceRedraw = true;
    }
    if (diagVideoTexRef.current) {
      diagVideoTexRef.current.dispose();
      diagVideoTexRef.current = null;
      lastDiagDimsRef.current = "";
      lastDiagSecRef.current = -1;
    }

    // -------------------------------------------------------------------------
    // 8 HZ ACCUMULATOR GUARD
    // -------------------------------------------------------------------------
    sim.accumSec += Math.min(delta, 0.25);
    if (!sim.forceRedraw && sim.accumSec < DRAW_INTERVAL_SEC) {
      return;
    }
    const dtStep = Math.max(0.016, sim.accumSec);
    sim.accumSec = 0;
    sim.forceRedraw = false;

    // -------------------------------------------------------------------------
    // RING BUFFER SAMPLING & 15-SECOND GHOST FORECASTS
    // -------------------------------------------------------------------------
    const currentMW = clampVal(state.thermalPower, 0, MAX_THERMAL_MW);
    const currentTemp = clampVal(state.coreTemp, 20, MAX_CORE_TEMP);
    const currentPressure = clampVal(state.drumPressure, 0, MAX_PRESSURE_BAR);
    const currentWaterMm = clampVal(state.drumWaterLevel, -400, 400);
    const currentDispatchMW = clampVal(state.totalElectricalMW, 0, MAX_GRID_MW);

    if (
      sim.lastShiftRunId !== state.shiftRunId ||
      (sim.count > 0 && now < sim.tBuf[(sim.head - 1 + RING_CAP) % RING_CAP])
    ) {
      sim.lastShiftRunId = state.shiftRunId;
      sim.head = 0;
      sim.count = 0;
      sim.dMW = 0;
      sim.dTemp = 0;
      sim.dPress = 0;
      sim.dWater = 0;
      sim.dDispatch = 0;
    }

    sim.tBuf[sim.head] = now;
    sim.mwBuf[sim.head] = currentMW;
    sim.tempBuf[sim.head] = currentTemp;
    sim.pressBuf[sim.head] = currentPressure;
    sim.waterBuf[sim.head] = currentWaterMm;
    sim.dispatchBuf[sim.head] = currentDispatchMW;
    sim.head = (sim.head + 1) % RING_CAP;
    if (sim.count < RING_CAP) sim.count += 1;

    if (sim.count >= 2) {
      const newestIdx = (sim.head - 1 + RING_CAP) % RING_CAP;
      let baseIdx = newestIdx;
      for (let k = 1; k < sim.count; k++) {
        const idx = (sim.head - 1 - k + RING_CAP) % RING_CAP;
        const dtSpan = now - sim.tBuf[idx];
        if (dtSpan <= DERIV_WINDOW_SEC) {
          baseIdx = idx;
        } else {
          if (k === 1) baseIdx = idx;
          break;
        }
      }
      const span = now - sim.tBuf[baseIdx];
      if (span >= 0.25) {
        const rawDMW = (currentMW - sim.mwBuf[baseIdx]) / span;
        const rawDTemp = (currentTemp - sim.tempBuf[baseIdx]) / span;
        const rawDPress = (currentPressure - sim.pressBuf[baseIdx]) / span;
        const rawDWater = (currentWaterMm - sim.waterBuf[baseIdx]) / span;
        const rawDDisp = (currentDispatchMW - sim.dispatchBuf[baseIdx]) / span;
        sim.dMW = sim.dMW * 0.65 + rawDMW * 0.35;
        sim.dTemp = sim.dTemp * 0.65 + rawDTemp * 0.35;
        sim.dPress = sim.dPress * 0.65 + rawDPress * 0.35;
        sim.dWater = sim.dWater * 0.65 + rawDWater * 0.35;
        sim.dDispatch = sim.dDispatch * 0.65 + rawDDisp * 0.35;
      }
    }

    const predictedTemp = clampVal(currentTemp + sim.dTemp * 15, 20, MAX_CORE_TEMP);
    const predictedPressure = clampVal(
      currentPressure + sim.dPress * 15,
      0,
      MAX_PRESSURE_BAR,
    );
    const predictedWaterMm = clampVal(currentWaterMm + sim.dWater * 15, -400, 400);
    const predictedDispatchMW = clampVal(
      currentDispatchMW + sim.dDispatch * 15,
      0,
      MAX_GRID_MW,
    );

    // -------------------------------------------------------------------------
    // DERIVED TELEMETRY & ANIMATION PHASES
    // -------------------------------------------------------------------------
    const activePumps =
      (state.mcpActive[0] ? 1 : 0) +
      (state.mcpActive[1] ? 1 : 0) +
      (state.mcpActive[2] ? 1 : 0) +
      (state.mcpActive[3] ? 1 : 0);
    const pumpRunning = activePumps > 0 && !state.isBlackout;
    const steamFlowing = currentMW > 120 && !state.isBlackout;
    const gridOnline =
      !state.isBlackout &&
      !state.az5Active &&
      (currentDispatchMW > 0 || state.energyCreatedMW > 20);

    sim.pumpAngle += dtStep * (pumpRunning ? 1.5 + state.coolantFlow * 6.0 : 0);
    sim.flowPhase += dtStep * (pumpRunning ? 0.9 + state.coolantFlow * 3.8 : 0);
    sim.steamPhase +=
      dtStep * (steamFlowing ? 0.8 + (state.energyCreatedMW / 600) * 3.2 : 0);
    sim.gridPhase +=
      dtStep * (gridOnline ? 0.8 + (currentDispatchMW / 600) * 3.4 : 0);
    sim.bubblePhase += dtStep * (0.4 + state.voidFraction * 2.8);
    sim.blinkTick = Math.floor(now * 2.5);
    const blinkOn = sim.blinkTick % 2 === 0;

    const spentCount = Object.keys(
      state.coreTileAnomalies ?? state.channelHotspots ?? {},
    ).length;
    const isCoreOperating =
      currentMW > 200 || state.tutorialPhase === "COMPLETED";
    const sealFault = isCoreOperating && !state.containmentSealLocked;
    const gasFault = state.heliumPressure > 72;
    const lowFlowFault =
      activePumps === 0 || (isCoreOperating && state.coolantFlow < 0.35);

    const deskState = useDeskStore.getState();
    const activeDeskDoc = deskState.documents[0] ?? null;

    const canvas = activeCrtTex.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // -------------------------------------------------------------------------
    // BACKGROUND & OUTER CRT FRAME
    // -------------------------------------------------------------------------
    ctx.fillStyle = COL_BG;
    ctx.fillRect(0, 0, CW, CH);

    const outerAlert =
      state.coreTemp >= 750 ||
      currentPressure >= 88 ||
      state.isBlackout ||
      state.az5Active ||
      state.ciaIntrusionActive ||
      state.komradOverrideLocked;
    ctx.strokeStyle = outerAlert && blinkOn ? COL_RED : COL_DIM;
    ctx.lineWidth = 7;
    ctx.strokeRect(3.5, 3.5, CW - 7, CH - 7);

    // =========================================================================
    // 1. TOP DECK (~24% HEIGHT, y = 8..160): REACTIVITY TUG-OF-WAR & BULLSEYE
    // =========================================================================
    ctx.fillStyle = COL_PANEL;
    ctx.fillRect(10, 10, CW - 20, 150);
    ctx.strokeStyle = COL_DIM;
    ctx.lineWidth = 7;
    ctx.strokeRect(10, 10, CW - 20, 150);

    // Header strip (y = 12..40)
    ctx.fillStyle = "#0e2618";
    ctx.fillRect(13, 13, CW - 26, 28);
    ctx.font = kremlinFont(16);
    ctx.textAlign = "left";
    ctx.fillStyle = COL_GREEN;
    ctx.fillText("SKALA-84 // REACTIVITY TUG-OF-WAR", 22, 33, 350);

    const effectiveSlope = sim.dMW + state.reactivity * 180;
    const dmwRounded = Math.round(sim.dMW);
    const absSlope = Math.abs(effectiveSlope);
    const trimLocked = Math.abs(sim.dMW) <= 3.0 && Math.abs(state.reactivity) < 0.008;
    const momentumBadgeText = state.az5Active
      ? "[ AZ-5 SCRAM ]"
      : trimLocked
        ? "[ TRIM LOCKED ]"
        : effectiveSlope > 0
          ? `[ SURGING +${Math.max(1, dmwRounded)} MW/S ]`
          : `[ STALLING ${Math.min(-1, dmwRounded)} MW/S ]`;
    const momentumBadgeCol = state.az5Active
      ? COL_RED
      : trimLocked
        ? COL_GREEN
        : absSlope <= 28
          ? COL_AMBER
          : COL_RED;
    ctx.textAlign = "center";
    ctx.fillStyle = momentumBadgeCol;
    ctx.fillText(momentumBadgeText, CW / 2, 33, 330);

    const totalMins = Math.floor(clampVal(state.shiftTimeMinutes, 0, 360));
    const hh = String(Math.floor(totalMins / 60)).padStart(2, "0");
    const mm = String(totalMins % 60).padStart(2, "0");
    ctx.textAlign = "right";
    ctx.fillStyle = state.coreTemp >= 700 ? COL_RED : COL_GREEN;
    ctx.fillText(`SHIFT ${state.shiftNumber} | ${hh}:${mm}`, CW - 22, 33, 250);

    // Zero-Centered Net Momentum Beam (y = 44..90)
    ctx.font = kremlinFont(13);
    ctx.textAlign = "left";
    ctx.fillStyle = effectiveSlope < -3 ? COL_AMBER : COL_MUTED;
    ctx.fillText("<<< STALLING", 24, 55, 190);
    ctx.textAlign = "center";
    ctx.fillStyle = trimLocked ? COL_GREEN : COL_MUTED;
    ctx.fillText("[ TRIM LOCKED ]", CW / 2, 55, 210);
    ctx.textAlign = "right";
    ctx.fillStyle = effectiveSlope > 3 ? COL_AMBER : COL_MUTED;
    ctx.fillText("SURGING >>>", CW - 24, 55, 190);

    const beamX = 24;
    const beamY = 60;
    const beamW = CW - 48;
    const beamH = 26;
    ctx.fillStyle = "#08140d";
    ctx.fillRect(beamX, beamY, beamW, beamH);

    ctx.fillStyle = "rgba(255, 59, 47, 0.16)";
    ctx.fillRect(beamX, beamY, 180, beamH);
    ctx.fillRect(beamX + beamW - 180, beamY, 180, beamH);

    const bullW = 128;
    const bullX = CW / 2 - bullW / 2;
    ctx.fillStyle = trimLocked
      ? "rgba(57, 255, 122, 0.28)"
      : "rgba(57, 255, 122, 0.12)";
    ctx.fillRect(bullX, beamY, bullW, beamH);
    ctx.strokeStyle = COL_GREEN;
    ctx.lineWidth = 4;
    ctx.strokeRect(bullX, beamY, bullW, beamH);
    ctx.fillStyle = COL_GREEN;
    ctx.fillRect(CW / 2 - 2, beamY - 2, 4, beamH + 4);

    ctx.strokeStyle = COL_DIM;
    ctx.lineWidth = 7;
    ctx.strokeRect(beamX, beamY, beamW, beamH);

    const slopeNorm =
      Math.sign(effectiveSlope) * Math.min(1, Math.pow(absSlope / 95, 0.65));
    const retX = CW / 2 + slopeNorm * 468;
    const retCol = trimLocked
      ? COL_GREEN
      : absSlope <= 28
        ? COL_AMBER
        : blinkOn
          ? COL_RED
          : COL_AMBER;

    ctx.fillStyle = retCol;
    ctx.strokeStyle = COL_BG;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(retX, beamY - 4);
    ctx.lineTo(retX + 14, beamY + beamH / 2);
    ctx.lineTo(retX, beamY + beamH + 4);
    ctx.lineTo(retX - 14, beamY + beamH / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (absSlope > 28) {
      ctx.font = kremlinFont(18);
      ctx.fillStyle = retCol;
      ctx.textAlign = effectiveSlope > 0 ? "right" : "left";
      ctx.fillText(
        effectiveSlope > 0 ? ">>>" : "<<<",
        effectiveSlope > 0 ? retX - 18 : retX + 18,
        beamY + 20,
      );
    }

    // 4 Live Opposing Force Sub-Bars Flanking Center (y = 92..154)
    const spineX = CW / 2;
    ctx.fillStyle = COL_GREEN;
    ctx.fillRect(spineX - 3.5, 92, 7, 62);

    ctx.font = kremlinFont(12);
    ctx.textAlign = "right";
    ctx.fillStyle = COL_GHOST;
    ctx.fillText("-RHO", spineX - 10, 102);
    ctx.textAlign = "left";
    ctx.fillStyle = COL_AMBER;
    ctx.fillText("+RHO", spineX + 10, 102);

    const dopplerFactor = clampVal((state.coreTemp - 250) / 700, 0, 0.35);
    const coolDopplerForce = clampVal(
      state.coolantFlow * 0.38 +
        state.feedwaterValve * 0.42 +
        dopplerFactor +
        (state.boronDampingTimer > 0 ? 0.35 : 0),
      0,
      1,
    );
    const xenonForce = clampVal(state.xenon / 65, 0, 1);
    const rodHeightForce = clampVal(state.controlRods, 0, 1);
    const posVoidForce = clampVal(state.voidFraction / 0.65, 0, 1);
    const graphiteHot = state.graphiteTemp > 540;

    const barTrackW = 216;
    const leftTrackEnd = spineX - 8;
    const leftTrackStart = leftTrackEnd - barTrackW;
    const rightTrackStart = spineX + 8;

    // Row 1 (y = 106..126): [- COOLANT / DOPPLER] | [+ ROD HEIGHT] + [GRAPHITE >540C]
    ctx.fillStyle = COL_TRACK;
    ctx.fillRect(leftTrackStart, 106, barTrackW, 20);
    ctx.fillStyle = state.boronDampingTimer > 0 ? COL_GHOST : COL_GREEN;
    const coolW = Math.round(barTrackW * coolDopplerForce);
    ctx.fillRect(leftTrackEnd - coolW, 106, coolW, 20);
    ctx.strokeStyle = COL_DIM;
    ctx.lineWidth = 4;
    ctx.strokeRect(leftTrackStart, 106, barTrackW, 20);

    ctx.font = kremlinFont(13);
    ctx.textAlign = "left";
    ctx.fillStyle = state.boronDampingTimer > 0 ? COL_GHOST : COL_GREEN;
    ctx.fillText(
      `- COOLANT / DOPPLER ${Math.round(coolDopplerForce * 100)}%`,
      22,
      121,
      leftTrackStart - 28,
    );

    ctx.fillStyle = COL_TRACK;
    ctx.fillRect(rightTrackStart, 106, barTrackW, 20);
    ctx.fillStyle = rodHeightForce > 0.78 ? COL_AMBER : COL_GREEN;
    const rodW = Math.round(barTrackW * rodHeightForce);
    ctx.fillRect(rightTrackStart, 106, rodW, 20);
    ctx.strokeStyle = COL_DIM;
    ctx.lineWidth = 4;
    ctx.strokeRect(rightTrackStart, 106, barTrackW, 20);

    ctx.textAlign = "right";
    ctx.fillStyle = rodHeightForce > 0.78 ? COL_AMBER : COL_GREEN;
    ctx.fillText(
      `+ ROD HEIGHT ${Math.round(state.controlRodLevel)}%`,
      CW - 22,
      121,
      CW - 22 - (rightTrackStart + barTrackW + 6),
    );
    if (graphiteHot) {
      ctx.fillStyle = blinkOn ? COL_AMBER : COL_RED;
      ctx.fillRect(rightTrackStart + barTrackW + 6, 108, 92, 16);
      ctx.font = kremlinFont(11);
      ctx.textAlign = "center";
      ctx.fillStyle = COL_BG;
      ctx.fillText("GRAPH >540C", rightTrackStart + barTrackW + 52, 120, 88);
    }

    // Row 2 (y = 132..152): [- XENON-135 POISON] | [+ POSITIVE VOID (+0.028)]
    ctx.fillStyle = COL_TRACK;
    ctx.fillRect(leftTrackStart, 132, barTrackW, 20);
    ctx.fillStyle = state.xenon > 40 && !blinkOn ? COL_RED : COL_XENON;
    const xeW = Math.round(barTrackW * xenonForce);
    ctx.fillRect(leftTrackEnd - xeW, 132, xeW, 20);
    ctx.strokeStyle = COL_DIM;
    ctx.lineWidth = 4;
    ctx.strokeRect(leftTrackStart, 132, barTrackW, 20);

    ctx.font = kremlinFont(13);
    ctx.textAlign = "left";
    ctx.fillStyle = COL_XENON;
    ctx.fillText(
      `- XENON-135 POISON ${Math.round(state.xenon)}%`,
      22,
      147,
      leftTrackStart - 28,
    );

    const voidCrit = state.voidFraction > 0.35;
    ctx.fillStyle = COL_TRACK;
    ctx.fillRect(rightTrackStart, 132, barTrackW, 20);
    ctx.fillStyle = voidCrit && blinkOn ? COL_RED : COL_VOID;
    const voidW = Math.round(barTrackW * posVoidForce);
    ctx.fillRect(rightTrackStart, 132, voidW, 20);
    ctx.strokeStyle = COL_DIM;
    ctx.lineWidth = 4;
    ctx.strokeRect(rightTrackStart, 132, barTrackW, 20);

    ctx.textAlign = "right";
    ctx.fillStyle = voidCrit ? COL_RED : COL_VOID;
    ctx.fillText(
      `+ POS VOID (+0.028) ${Math.round(state.voidFraction * 100)}%`,
      CW - 22,
      147,
      CW - 22 - (rightTrackStart + barTrackW + 6),
    );

    // =========================================================================
    // 2. CENTER DECK (~54% HEIGHT, y = 166..512): 4-STAGE SECTOR 84 FLOW MIMIC
    //    UNIT B -> UNIT A-2 -> UNIT C -> UNIT A
    // =========================================================================
    const volkovInfo = getVolkovStepInfo(state.tutorialPhase);

    const stageY = 166;
    const stageH = 346;
    const s1X = 14;
    const s1W = 220;
    const s2X = 254;
    const s2W = 270;
    const s3X = 544;
    const s3W = 210;
    const s4X = 774;
    const s4W = 236;

    // Stage 1 Frame: [3] UNIT B: HYDRAULICS
    ctx.fillStyle = COL_PANEL;
    ctx.fillRect(s1X, stageY, s1W, stageH);
    ctx.strokeStyle = lowFlowFault || sealFault ? COL_RED : COL_DIM;
    ctx.lineWidth = 7;
    ctx.strokeRect(s1X, stageY, s1W, stageH);
    ctx.fillStyle = "#0e2618";
    ctx.fillRect(s1X + 3, stageY + 3, s1W - 6, 26);
    ctx.font = kremlinFont(13);
    ctx.textAlign = "center";
    ctx.fillStyle = lowFlowFault || sealFault ? COL_RED : COL_GREEN;
    ctx.fillText("[3] UNIT B: HYDRAULICS", s1X + s1W / 2, stageY + 21, s1W - 14);

    // Stage 2 Frame: [6] UNIT A-2: FISSION CORE
    ctx.fillStyle = COL_PANEL;
    ctx.fillRect(s2X, stageY, s2W, stageH);
    ctx.strokeStyle =
      state.coreTemp >= 700 || spentCount >= 4 ? COL_RED : COL_DIM;
    ctx.lineWidth = 7;
    ctx.strokeRect(s2X, stageY, s2W, stageH);
    ctx.fillStyle = "#0e2618";
    ctx.fillRect(s2X + 3, stageY + 3, s2W - 6, 26);
    ctx.font = kremlinFont(13);
    ctx.fillStyle = COL_GREEN;
    ctx.fillText("[6] UNIT A-2: FISSION CORE", s2X + s2W / 2, stageY + 21, s2W - 14);

    // Stage 3 Frame: [5] UNIT C: 1000 MWH BAT
    ctx.fillStyle = COL_PANEL;
    ctx.fillRect(s3X, stageY, s3W, stageH);
    ctx.strokeStyle =
      state.batteryStoredPct < 12 || state.isBlackout ? COL_RED : COL_DIM;
    ctx.lineWidth = 7;
    ctx.strokeRect(s3X, stageY, s3W, stageH);
    ctx.fillStyle = "#0e2618";
    ctx.fillRect(s3X + 3, stageY + 3, s3W - 6, 26);
    ctx.font = kremlinFont(13);
    ctx.fillStyle = COL_GREEN;
    ctx.fillText("[5] UNIT C: 1000 MWH BAT", s3X + s3W / 2, stageY + 21, s3W - 14);

    // Stage 4 Frame: [1] UNIT A: 6 SUBSTATIONS
    const anySubFail = state.substations.some((sub) => !sub.quotaOk);
    ctx.fillStyle = COL_PANEL;
    ctx.fillRect(s4X, stageY, s4W, stageH);
    ctx.strokeStyle =
      state.tutorialPhase === "COMPLETED" && anySubFail ? COL_AMBER : COL_DIM;
    ctx.lineWidth = 7;
    ctx.strokeRect(s4X, stageY, s4W, stageH);
    ctx.fillStyle = "#0e2618";
    ctx.fillRect(s4X + 3, stageY + 3, s4W - 6, 26);
    ctx.font = kremlinFont(13);
    ctx.fillStyle = COL_GREEN;
    ctx.fillText("[1] UNIT A: 6 SUBSTATIONS", s4X + s4W / 2, stageY + 21, s4W - 14);

    // -------------------------------------------------------------------------
    // STAGE 1: [3] UNIT B: HYDRAULICS (4x MCP + FW + DRUM LEVEL + BUBBLER/HE-N2)
    // -------------------------------------------------------------------------
    const pumpCx = 74;
    const pumpCy = 266;
    const pumpR = 42;
    const pumpCol =
      activePumps === 0 || state.coolantFlow < 0.25
        ? blinkOn
          ? COL_RED
          : COL_AMBER
        : state.coolantFlow < 0.45
          ? COL_AMBER
          : COL_GREEN;

    ctx.fillStyle = "#07140c";
    ctx.beginPath();
    ctx.arc(pumpCx, pumpCy, pumpR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pumpCol;
    ctx.lineWidth = 7;
    ctx.stroke();

    ctx.strokeStyle = pumpCol;
    ctx.lineWidth = 7;
    for (let b = 0; b < 4; b++) {
      const ang = sim.pumpAngle + (b * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(pumpCx, pumpCy);
      ctx.lineTo(
        pumpCx + Math.cos(ang) * (pumpR - 8),
        pumpCy + Math.sin(ang) * (pumpR - 8),
      );
      ctx.stroke();
    }
    ctx.fillStyle = COL_BG;
    ctx.beginPath();
    ctx.arc(pumpCx, pumpCy, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pumpCol;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.font = kremlinFont(13);
    ctx.textAlign = "center";
    ctx.fillStyle = pumpCol;
    ctx.fillText(`${activePumps}/4`, pumpCx, pumpCy + 5);

    ctx.font = kremlinFont(11);
    ctx.fillStyle = COL_MUTED;
    ctx.fillText("4X MCP", pumpCx, 326);

    // Feedwater Inflow Arrow feeding Drum Tank
    const fwPct = Math.round(state.feedwaterValve * 100);
    ctx.font = kremlinFont(13);
    ctx.fillStyle = fwPct < 35 ? COL_AMBER : COL_GHOST;
    ctx.fillText(`FW ${fwPct}%`, pumpCx, 356, 100);
    ctx.strokeStyle = fwPct > 5 ? COL_GHOST : COL_DIM;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(30, 374);
    ctx.lineTo(138, 374);
    ctx.stroke();
    drawChevronsH(ctx, 34, 134, 374, sim.flowPhase, COL_WHITE, fwPct > 5, 20);

    // Vertical DRUM LEVEL Tank (-400..+400 MM) with green band & 15s Ghost Tick
    const dTankX = 144;
    const dTankY = 212;
    const dTankW = 76;
    const dTankH = 192;

    ctx.font = kremlinFont(11);
    ctx.textAlign = "center";
    ctx.fillStyle = COL_GREEN;
    ctx.fillText("DRUM MM", dTankX + dTankW / 2, 207, 82);

    ctx.fillStyle = "#06100a";
    ctx.fillRect(dTankX, dTankY, dTankW, dTankH);

    // Green safe level band (-100..+100 mm => normalized 37.5%..62.5%)
    const dSafeTopY = dTankY + dTankH * (1 - 0.625);
    const dSafeBotY = dTankY + dTankH * (1 - 0.375);
    ctx.fillStyle = "rgba(57, 255, 122, 0.2)";
    ctx.fillRect(dTankX, dSafeTopY, dTankW, dSafeBotY - dSafeTopY);
    ctx.strokeStyle = COL_GREEN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dTankX, dTankY + dTankH / 2);
    ctx.lineTo(dTankX + dTankW, dTankY + dTankH / 2);
    ctx.stroke();

    const waterNorm = clampVal(0.5 + currentWaterMm / 800, 0.02, 0.98);
    const dWaterTopY = dTankY + dTankH * (1 - waterNorm);
    const absWaterMm = Math.abs(currentWaterMm);
    const waterCrit = absWaterMm >= 180;
    const waterOutBand = absWaterMm >= 100;
    ctx.fillStyle = waterCrit
      ? blinkOn
        ? "rgba(255, 59, 47, 0.72)"
        : "rgba(255, 59, 47, 0.34)"
      : waterOutBand
        ? "rgba(255, 184, 51, 0.56)"
        : "rgba(57, 255, 122, 0.48)";
    ctx.beginPath();
    ctx.moveTo(dTankX, dTankY + dTankH);
    ctx.lineTo(dTankX, dWaterTopY);
    for (let wx = 0; wx <= dTankW; wx += 12) {
      const wy = dWaterTopY + Math.sin(wx * 0.12 + sim.flowPhase * 2.2) * 3;
      ctx.lineTo(dTankX + wx, wy);
    }
    ctx.lineTo(dTankX + dTankW, dTankY + dTankH);
    ctx.closePath();
    ctx.fill();

    // 15s Ghost Tick on Drum Level
    const predWaterNorm = clampVal(0.5 + predictedWaterMm / 800, 0.02, 0.98);
    const dGhostY = dTankY + dTankH * (1 - predWaterNorm);
    ctx.strokeStyle = blinkOn ? COL_WHITE : COL_GHOST;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(dTankX - 5, dGhostY);
    ctx.lineTo(dTankX + dTankW + 5, dGhostY);
    ctx.stroke();

    ctx.strokeStyle = waterCrit
      ? blinkOn
        ? COL_RED
        : "#8f1912"
      : waterOutBand
        ? COL_AMBER
        : COL_GREEN;
    ctx.lineWidth = 7;
    ctx.strokeRect(dTankX, dTankY, dTankW, dTankH);

    const drumSign = currentWaterMm >= 0 ? "+" : "";
    ctx.font = kremlinFont(13);
    ctx.fillStyle = waterCrit
      ? blinkOn
        ? COL_RED
        : COL_AMBER
      : waterOutBand
        ? COL_AMBER
        : COL_WHITE;
    ctx.fillText(
      `${drumSign}${Math.round(currentWaterMm)}MM`,
      dTankX + dTankW / 2,
      424,
      84,
    );

    // BUBBLER <95% & HE-N2 / SEALS Status Pill (y = 438..500)
    const bubWarn = state.bubblerLevel >= 85;
    const lockedSeals = state.sealToggles.filter(Boolean).length;
    ctx.fillStyle = bubWarn || sealFault || gasFault ? "#2d0b09" : "#08140d";
    ctx.fillRect(24, 438, s1W - 20, 62);
    ctx.strokeStyle =
      bubWarn || sealFault || gasFault ? COL_RED : COL_DIM;
    ctx.lineWidth = 5;
    ctx.strokeRect(24, 438, s1W - 20, 62);

    ctx.font = kremlinFont(12);
    ctx.textAlign = "center";
    ctx.fillStyle = bubWarn ? COL_RED : COL_GREEN;
    ctx.fillText(
      `BUBBLER ${Math.round(state.bubblerLevel)}% (<95%)`,
      s1X + s1W / 2,
      462,
      s1W - 32,
    );
    ctx.fillStyle = sealFault || gasFault ? COL_RED : COL_GHOST;
    ctx.fillText(
      `HE ${Math.round(state.heliumPressure)}B | SEALS ${lockedSeals}/3`,
      s1X + s1W / 2,
      487,
      s1W - 32,
    );

    // -------------------------------------------------------------------------
    // STAGE 2: [6] UNIT A-2: FISSION CORE (XE + RODS + VOIDS + TEMP + BAR)
    // -------------------------------------------------------------------------
    const coreTopY = 216;
    const coreBotY = 464;
    const coreH = coreBotY - coreTopY;

    // Clinging XE-135 Poison Bar (x = 264..288)
    const xeX = 264;
    const xeW2 = 24;
    ctx.font = kremlinFont(11);
    ctx.textAlign = "center";
    ctx.fillStyle = COL_XENON;
    ctx.fillText("XE", xeX + xeW2 / 2, 208);

    ctx.fillStyle = COL_TRACK;
    ctx.fillRect(xeX, coreTopY, xeW2, coreH);
    const xeFillH = Math.round(coreH * clampVal(state.xenon / 100, 0, 1));
    ctx.fillStyle = state.xenon > 40 && !blinkOn ? COL_RED : COL_XENON;
    ctx.fillRect(xeX, coreBotY - xeFillH, xeW2, xeFillH);
    ctx.strokeStyle = COL_XENON;
    ctx.lineWidth = 4;
    ctx.strokeRect(xeX, coreTopY, xeW2, coreH);
    ctx.font = kremlinFont(12);
    ctx.fillText(`${Math.round(state.xenon)}%`, xeX + xeW2 / 2, 488, 36);

    // Cutaway Reactor Vessel (x = 296..402)
    const vesX = 296;
    const vesW = 106;
    ctx.fillStyle = "#06100a";
    ctx.fillRect(vesX, coreTopY, vesW, coreH);

    if (currentMW > 60) {
      ctx.fillStyle =
        state.voidFraction > 0.35
          ? "rgba(255, 157, 0, 0.16)"
          : "rgba(57, 255, 122, 0.13)";
      ctx.fillRect(vesX + 4, coreTopY + 4, vesW - 8, coreH - 8);
    }

    // Rising Steam Void Bubbles
    const visibleBubbles =
      state.voidFraction < 0.04
        ? 0
        : Math.max(2, Math.round(state.voidFraction * BUBBLE_LANES.length));
    for (let bi = 0; bi < visibleBubbles; bi++) {
      const lane = BUBBLE_LANES[bi];
      const frac = (sim.bubblePhase + lane[1]) % 1;
      const bx = vesX + 12 + lane[0] * (vesW - 24);
      const by = coreBotY - 12 - frac * (coreH - 28);
      ctx.fillStyle = state.voidFraction > 0.35 ? COL_RED : COL_VOID;
      ctx.beginPath();
      ctx.arc(bx, by, lane[2], 0, Math.PI * 2);
      ctx.fill();
    }

    // 4 Sliding Boron Control Rods
    const rodDepth = (1 - clampVal(state.controlRods, 0, 1)) * (coreH - 24);
    const rodCol = state.az5Active ? (blinkOn ? COL_RED : COL_AMBER) : COL_GREEN;
    for (let r = 0; r < 4; r++) {
      const rx = vesX + 17 + r * 24;
      const rodLen = Math.max(12, rodDepth);
      ctx.fillStyle = "#163523";
      ctx.fillRect(rx - 4, coreTopY + 4, 8, rodLen);
      ctx.strokeStyle = rodCol;
      ctx.lineWidth = 4;
      ctx.strokeRect(rx - 4, coreTopY + 4, 8, rodLen);
      ctx.fillStyle = state.az5Active ? COL_AMBER : COL_WHITE;
      ctx.fillRect(rx - 4, coreTopY + 4 + rodLen - 7, 8, 7);
    }

    ctx.strokeStyle = currentTemp >= 750 ? COL_RED : COL_GREEN;
    ctx.lineWidth = 7;
    ctx.strokeRect(vesX, coreTopY, vesW, coreH);
    ctx.fillStyle = "#173623";
    ctx.fillRect(vesX - 4, coreTopY - 6, vesW + 8, 12);

    ctx.font = kremlinFont(12);
    ctx.textAlign = "center";
    if (spentCount > 0) {
      ctx.fillStyle = blinkOn ? COL_AMBER : COL_RED;
      ctx.fillText(
        `RODS ${Math.round(state.controlRodLevel)}% | SP:${spentCount}`,
        vesX + vesW / 2,
        488,
        112,
      );
    } else {
      ctx.fillStyle = COL_GREEN;
      ctx.fillText(
        `RODS ${Math.round(state.controlRodLevel)}% | ${Math.round(currentMW)}MW`,
        vesX + vesW / 2,
        488,
        112,
      );
    }

    // CORE TEMP Column (0..1150C, 1100C Redline + 15s Ghost Marker)
    const tColX = 414;
    const tColW = 42;
    ctx.font = kremlinFont(11);
    ctx.textAlign = "center";
    ctx.fillStyle = currentTemp >= 750 ? COL_RED : COL_GREEN;
    ctx.fillText("TEMP", tColX + tColW / 2, 208);

    ctx.fillStyle = COL_TRACK;
    ctx.fillRect(tColX, coreTopY, tColW, coreH);
    const tRedTopY = coreBotY - (1100 / MAX_CORE_TEMP) * coreH;
    ctx.fillStyle = "rgba(255, 59, 47, 0.34)";
    ctx.fillRect(tColX, coreTopY, tColW, Math.max(12, tRedTopY - coreTopY + 26));

    const tFillH = Math.round((currentTemp / MAX_CORE_TEMP) * coreH);
    const tCurY = coreBotY - tFillH;
    const tFillCol =
      currentTemp >= 800
        ? COL_RED
        : currentTemp >= 580
          ? COL_AMBER
          : COL_GREEN;
    ctx.fillStyle = tFillCol;
    ctx.fillRect(tColX + 4, tCurY, tColW - 8, tFillH);
    ctx.strokeStyle = COL_DIM;
    ctx.lineWidth = 4;
    ctx.strokeRect(tColX, coreTopY, tColW, coreH);

    // 1100C Redline Marker
    ctx.fillStyle = COL_RED;
    ctx.fillRect(tColX - 3, tRedTopY - 2, tColW + 6, 4);

    // 15s Ghost Core Temp Marker + Arrow
    const tPredY = coreBotY - (predictedTemp / MAX_CORE_TEMP) * coreH;
    if (Math.abs(tPredY - tCurY) >= 5) {
      ctx.strokeStyle = COL_GHOST;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(tColX + tColW / 2, tCurY);
      ctx.lineTo(tColX + tColW / 2, tPredY);
      ctx.stroke();
    }
    ctx.strokeStyle = blinkOn ? COL_WHITE : COL_GHOST;
    ctx.lineWidth = 4;
    ctx.strokeRect(tColX - 4, tPredY - 4, tColW + 8, 8);

    ctx.font = kremlinFont(12);
    ctx.fillStyle = tFillCol;
    ctx.fillText(`${Math.round(currentTemp)}C`, tColX + tColW / 2, 488, 52);

    // STEAM BAR Column (0..120 BAR, 115 BAR Redline + 60..75 Nominal + 15s Ghost)
    const pColX = 468;
    const pColW = 42;
    ctx.font = kremlinFont(11);
    ctx.textAlign = "center";
    ctx.fillStyle = currentPressure >= 84 ? COL_RED : COL_GREEN;
    ctx.fillText("BAR", pColX + pColW / 2, 208);

    ctx.fillStyle = COL_TRACK;
    ctx.fillRect(pColX, coreTopY, pColW, coreH);
    const pRedlineY = coreBotY - (115 / MAX_PRESSURE_BAR) * coreH;
    const pWarnZoneY = coreBotY - (84 / MAX_PRESSURE_BAR) * coreH;
    ctx.fillStyle = "rgba(255, 59, 47, 0.3)";
    ctx.fillRect(pColX, coreTopY, pColW, pWarnZoneY - coreTopY);

    const pNomTopY = coreBotY - (75 / MAX_PRESSURE_BAR) * coreH;
    const pNomBotY = coreBotY - (60 / MAX_PRESSURE_BAR) * coreH;
    ctx.fillStyle = "rgba(57, 255, 122, 0.22)";
    ctx.fillRect(pColX - 3, pNomTopY, pColW + 6, pNomBotY - pNomTopY);
    ctx.strokeStyle = COL_GREEN;
    ctx.lineWidth = 4;
    ctx.strokeRect(pColX - 3, pNomTopY, pColW + 6, pNomBotY - pNomTopY);

    const pFillH = Math.round((currentPressure / MAX_PRESSURE_BAR) * coreH);
    const pCurY = coreBotY - pFillH;
    const pFillCol =
      currentPressure >= 84
        ? COL_RED
        : currentPressure >= 58 && currentPressure <= 76
          ? COL_GREEN
          : COL_AMBER;
    ctx.fillStyle = pFillCol;
    ctx.fillRect(pColX + 4, pCurY, pColW - 8, pFillH);
    ctx.strokeStyle = COL_DIM;
    ctx.lineWidth = 4;
    ctx.strokeRect(pColX, coreTopY, pColW, coreH);

    // 115 BAR Redline Marker
    ctx.fillStyle = COL_RED;
    ctx.fillRect(pColX - 3, pRedlineY - 2, pColW + 6, 4);

    // 15s Ghost Pressure Marker + Arrow
    const pPredY = coreBotY - (predictedPressure / MAX_PRESSURE_BAR) * coreH;
    if (Math.abs(pPredY - pCurY) >= 5) {
      ctx.strokeStyle = COL_GHOST;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pColX + pColW / 2, pCurY);
      ctx.lineTo(pColX + pColW / 2, pPredY);
      ctx.stroke();
    }
    ctx.strokeStyle = blinkOn ? COL_WHITE : COL_GHOST;
    ctx.lineWidth = 4;
    ctx.strokeRect(pColX - 4, pPredY - 4, pColW + 8, 8);

    ctx.font = kremlinFont(12);
    ctx.fillStyle = pFillCol;
    ctx.fillText(`${Math.round(currentPressure)}B`, pColX + pColW / 2, 488, 52);

    // -------------------------------------------------------------------------
    // STAGE 3: [5] UNIT C: 1000 MWH BATTERY (+CHG vs -OUT, 50HZ SYNC, HOUSE)
    // -------------------------------------------------------------------------
    const chgMW = Math.round(state.energyCreatedMW);
    const outMW = Math.round(currentDispatchMW);
    const netMW = chgMW - outMW;

    ctx.font = kremlinFont(12);
    ctx.textAlign = "left";
    ctx.fillStyle = chgMW > 20 ? COL_GHOST : COL_MUTED;
    ctx.fillText(`+CHG ${chgMW}`, s3X + 14, 218, 92);
    ctx.textAlign = "right";
    ctx.fillStyle = outMW > 20 ? COL_AMBER : COL_MUTED;
    ctx.fillText(`-OUT ${outMW}`, s3X + s3W - 14, 218, 92);

    // 0-1000 MWH Station Battery Tank (10 segments)
    const batX = s3X + 26;
    const batY = 232;
    const batW = s3W - 52;
    const batH = 178;
    const batPct = clampVal(state.batteryStoredPct, 0, 100);
    const batCol =
      batPct < 12 ? COL_RED : batPct < 28 ? COL_AMBER : COL_GREEN;

    ctx.fillStyle = "#06100a";
    ctx.fillRect(batX, batY, batW, batH);

    const segGap = 4;
    const segH = (batH - 16 - segGap * 9) / 10;
    const litSegs = Math.round(batPct / 10);
    for (let si = 0; si < 10; si++) {
      const sy = batY + batH - 8 - (si + 1) * segH - si * segGap;
      const isLit = !state.isBlackout && si < litSegs;
      ctx.fillStyle = isLit
        ? si < 2
          ? COL_RED
          : si >= 6
            ? COL_GHOST
            : COL_GREEN
        : "#0d2215";
      ctx.fillRect(batX + 8, sy, batW - 16, segH);
    }

    ctx.strokeStyle = batCol;
    ctx.lineWidth = 7;
    ctx.strokeRect(batX, batY, batW, batH);

    // MWH & % Readout Pill right below battery tank
    ctx.fillStyle = "#07140c";
    ctx.fillRect(s3X + 14, 418, s3W - 28, 30);
    ctx.strokeStyle = batCol;
    ctx.lineWidth = 4;
    ctx.strokeRect(s3X + 14, 418, s3W - 28, 30);
    ctx.font = kremlinFont(14);
    ctx.textAlign = "center";
    ctx.fillStyle = batCol;
    ctx.fillText(
      `${Math.round(state.batteryStoredMWh)} MWH (${Math.round(batPct)}%)`,
      s3X + s3W / 2,
      439,
      s3W - 36,
    );

    // 50.0 HZ SYNC Lock & House Load Pill (y = 456..502)
    ctx.fillStyle = gridOnline ? "#0c2b17" : "#2d0b09";
    ctx.fillRect(s3X + 14, 456, s3W - 28, 44);
    ctx.strokeStyle = gridOnline ? COL_GREEN : COL_RED;
    ctx.lineWidth = 5;
    ctx.strokeRect(s3X + 14, 456, s3W - 28, 44);
    ctx.font = kremlinFont(12);
    ctx.fillStyle = gridOnline ? COL_GREEN : COL_RED;
    ctx.fillText(
      gridOnline ? "50.0 HZ SYNC LOCKED" : "50.0 HZ SYNC STANDBY",
      s3X + s3W / 2,
      474,
      s3W - 38,
    );
    ctx.fillStyle = COL_GHOST;
    ctx.fillText(
      `HOUSE ${Math.round(state.houseLoadMW)}MW | NET ${netMW >= 0 ? "+" : ""}${netMW}`,
      s3X + s3W / 2,
      493,
      s3W - 38,
    );

    // -------------------------------------------------------------------------
    // STAGE 4: [1] UNIT A: 6 SUBSTATIONS (DISPATCH VS QUOTA + 6 SECTOR BLOCKS)
    // -------------------------------------------------------------------------
    const gBarX = s4X + 14;
    const gBarW = s4W - 28;
    const gBarY = 230;
    const gBarH = 26;
    const demandMW = clampVal(state.energyDemandMW, 0, MAX_GRID_MW);
    const dispDiff = Math.abs(currentDispatchMW - demandMW);
    const gridMatched = dispDiff <= 35;

    ctx.font = kremlinFont(13);
    ctx.textAlign = "center";
    ctx.fillStyle = gridMatched ? COL_GREEN : COL_AMBER;
    ctx.fillText(
      `GRID ${Math.round(currentDispatchMW)} / ${Math.round(demandMW)} MW`,
      s4X + s4W / 2,
      218,
      gBarW,
    );

    ctx.fillStyle = COL_TRACK;
    ctx.fillRect(gBarX, gBarY, gBarW, gBarH);

    // Green Target Quota Bracket
    const qLowX = gBarX + (clampVal(demandMW - 35, 0, MAX_GRID_MW) / MAX_GRID_MW) * gBarW;
    const qHighX =
      gBarX + (clampVal(demandMW + 35, 0, MAX_GRID_MW) / MAX_GRID_MW) * gBarW;
    ctx.fillStyle = "rgba(57, 255, 122, 0.25)";
    ctx.fillRect(qLowX, gBarY - 3, Math.max(8, qHighX - qLowX), gBarH + 6);

    const dispFillW = Math.round((currentDispatchMW / MAX_GRID_MW) * gBarW);
    ctx.fillStyle = gridMatched ? COL_GREEN : COL_AMBER;
    ctx.fillRect(gBarX, gBarY + 3, dispFillW, gBarH - 6);

    // 15s Forecast Tick on Grid Busbar
    const predDispX = gBarX + (predictedDispatchMW / MAX_GRID_MW) * gBarW;
    ctx.strokeStyle = blinkOn ? COL_WHITE : COL_GHOST;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(predDispX, gBarY - 4);
    ctx.lineTo(predDispX, gBarY + gBarH + 4);
    ctx.stroke();

    ctx.strokeStyle = COL_DIM;
    ctx.lineWidth = 4;
    ctx.strokeRect(gBarX, gBarY, gBarW, gBarH);

    // 6 Compact Illuminated Sector Blocks (2 cols x 3 rows)
    const cardW = 100;
    const cardH = 68;
    const cardGapX = 8;
    const cardGapY = 10;
    for (let si = 0; si < 6; si++) {
      const sub = state.substations[si];
      const colIdx = si % 2;
      const rowIdx = Math.floor(si / 2);
      const cx = s4X + 14 + colIdx * (cardW + cardGapX);
      const cy = 270 + rowIdx * (cardH + cardGapY);

      const ok = Boolean(sub?.quotaOk) && !state.isBlackout;
      const warnFlash = !ok && state.tutorialPhase === "COMPLETED" && blinkOn;
      ctx.fillStyle = ok
        ? "#0c2b17"
        : warnFlash
          ? "#381c06"
          : "#09170f";
      ctx.fillRect(cx, cy, cardW, cardH);
      ctx.strokeStyle = ok
        ? COL_GREEN
        : state.tutorialPhase === "COMPLETED"
          ? warnFlash
            ? COL_AMBER
            : COL_RED
          : COL_DIM;
      ctx.lineWidth = 5;
      ctx.strokeRect(cx, cy, cardW, cardH);

      ctx.font = kremlinFont(12);
      ctx.textAlign = "center";
      ctx.fillStyle = ok ? COL_GREEN : COL_AMBER;
      ctx.fillText(SECTOR_SHORT_NAMES[si], cx + cardW / 2, cy + 24, cardW - 10);

      const alloc = Math.round(sub?.allocatedMW ?? 0);
      const tgt = Math.round(sub?.targetMW ?? 100);
      ctx.font = kremlinFont(13);
      ctx.fillStyle = ok ? COL_WHITE : COL_AMBER;
      ctx.fillText(`${alloc}/${tgt}`, cx + cardW / 2, cy + 50, cardW - 10);
    }

    // -------------------------------------------------------------------------
    // CONNECTING 8PX FLOW PIPES BETWEEN THE 4 STAGES (>>> ANIMATED CHEVRONS)
    // -------------------------------------------------------------------------
    // Pipe 1: UNIT B -> UNIT A-2 (Coolant Flow)
    ctx.strokeStyle = lowFlowFault ? COL_RED : COL_GREEN;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(s1X + s1W, 336);
    ctx.lineTo(s2X, 336);
    ctx.stroke();
    drawChevronsH(ctx, s1X + s1W + 1, s2X - 1, 336, sim.flowPhase, COL_WHITE, pumpRunning, 12);

    // Pipe 2: UNIT A-2 -> UNIT C (Steam Charge)
    const wetSteamWarn = state.wetSteamSeverity > 0.08;
    ctx.strokeStyle =
      currentPressure >= 84
        ? COL_RED
        : wetSteamWarn
          ? COL_AMBER
          : steamFlowing
            ? COL_GHOST
            : COL_DIM;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(s2X + s2W, 290);
    ctx.lineTo(s3X, 290);
    ctx.stroke();
    drawChevronsH(ctx, s2X + s2W + 1, s3X - 1, 290, sim.steamPhase, COL_WHITE, steamFlowing, 12);
    if (wetSteamWarn) {
      const tagCx = (s2X + s2W + s3X) / 2;
      const tagW = 94;
      const tagH = 22;
      const tagX = tagCx - tagW / 2;
      const tagY = 254;
      ctx.fillStyle = "#291b04";
      ctx.fillRect(tagX, tagY, tagW, tagH);
      ctx.strokeStyle = COL_AMBER;
      ctx.lineWidth = 3;
      ctx.strokeRect(tagX, tagY, tagW, tagH);
      ctx.font = kremlinFont(11);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = COL_AMBER;
      ctx.fillText("WET STEAM!", tagCx, tagY + tagH / 2 + 1, tagW - 8);
      ctx.textBaseline = "alphabetic";
    }

    // Pipe 3: UNIT C -> UNIT A (Dispatched Busbar)
    ctx.strokeStyle = gridOnline ? COL_GREEN : COL_RED;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(s3X + s3W, 326);
    ctx.lineTo(s4X, 326);
    ctx.stroke();
    drawChevronsH(
      ctx,
      s3X + s3W + 1,
      s4X - 1,
      326,
      sim.gridPhase,
      COL_WHITE,
      gridOnline && currentDispatchMW > 10,
      12,
    );

    // -------------------------------------------------------------------------
    // VOLKOV ACTIVE STEP AMBER HIGHLIGHT BORDER AROUND TARGET STAGE
    // -------------------------------------------------------------------------
    if (volkovInfo.highlight && blinkOn) {
      ctx.strokeStyle = COL_AMBER;
      ctx.lineWidth = 8;
      if (volkovInfo.highlight === "UNIT_B" || volkovInfo.highlight === "UNIT_B_A2") {
        ctx.strokeRect(s1X + 2, stageY + 2, s1W - 4, stageH - 4);
      }
      if (volkovInfo.highlight === "UNIT_A2" || volkovInfo.highlight === "UNIT_B_A2") {
        ctx.strokeRect(s2X + 2, stageY + 2, s2W - 4, stageH - 4);
      }
      if (volkovInfo.highlight === "UNIT_C") {
        ctx.strokeRect(s3X + 2, stageY + 2, s3W - 4, stageH - 4);
      }
      if (volkovInfo.highlight === "UNIT_A") {
        ctx.strokeRect(s4X + 2, stageY + 2, s4W - 4, stageH - 4);
      }
    }

    // =========================================================================
    // 3. BOTTOM STRIP (~18% HEIGHT, y = 516..630): VOLKOV / KGB+CIA / STATUS PILLS
    // =========================================================================
    ctx.fillStyle = COL_PANEL;
    ctx.fillRect(10, 516, CW - 20, 114);
    ctx.strokeStyle = COL_DIM;
    ctx.lineWidth = 7;
    ctx.strokeRect(10, 516, CW - 20, 114);

    if (state.ciaIntrusionActive || state.komradOverrideLocked) {
      // Interactive CIA Purge / KOMRAD Lock Override Strip
      ctx.fillStyle = blinkOn ? "#470b0b" : "#220606";
      ctx.fillRect(18, 524, CW - 36, 98);
      ctx.strokeStyle = COL_RED;
      ctx.lineWidth = 7;
      ctx.strokeRect(18, 524, CW - 36, 98);

      ctx.font = kremlinFont(22);
      ctx.textAlign = "center";
      ctx.fillStyle = blinkOn ? COL_WHITE : COL_RED;
      ctx.fillText(
        state.ciaIntrusionActive
          ? `CIA CYBER INTRUSION (${Math.round(state.ciaIntrusionProgress)}%) // PURGE FIREWALL`
          : "K.O.M.R.A.D.-84 COOLING LOCK ACTIVE // MANUAL OVERRIDE",
        CW / 2,
        564,
        CW - 60,
      );
      ctx.font = kremlinFont(16);
      ctx.fillStyle = COL_AMBER;
      ctx.fillText(
        "[CLICK THIS SCREEN OR TERMINAL TO PURGE / OVERRIDE]",
        CW / 2,
        602,
        CW - 60,
      );
    } else if (state.kgbLineActive && activeDeskDoc !== null) {
      // Dedicated KGB Decode Verdict Row + Active Volkov / Top 2 Root-Cause Row
      const isForgery = activeDeskDoc.isForgery;
      ctx.fillStyle = isForgery ? "#360808" : "#0b2916";
      ctx.fillRect(18, 524, CW - 36, 46);
      ctx.strokeStyle = isForgery ? COL_RED : COL_GREEN;
      ctx.lineWidth = 6;
      ctx.strokeRect(18, 524, CW - 36, 46);
      ctx.font = kremlinFont(15);
      ctx.textAlign = "center";
      ctx.fillStyle = isForgery ? COL_RED : COL_GREEN;
      const kgbText = isForgery
        ? `[KGB DECODE] FORGERY: ${(activeDeskDoc.forgeryReason ?? "SEAL/INK/FONT FAULT").toUpperCase()} -> SHRED [KEY 4]`
        : `[KGB DECODE] GENUINE (${activeDeskDoc.sealType.toUpperCase()}) -> STAMP APPROVED & LAUNCH [KEY 4]`;
      ctx.fillText(kgbText, CW / 2, 553, CW - 56);

      if (state.tutorialPhase !== "COMPLETED") {
        ctx.fillStyle = "#1c1304";
        ctx.fillRect(18, 578, CW - 36, 44);
        ctx.strokeStyle = COL_AMBER;
        ctx.lineWidth = 5;
        ctx.strokeRect(18, 578, CW - 36, 44);
        ctx.font = kremlinFont(15);
        ctx.fillStyle = COL_AMBER;
        ctx.fillText(volkovInfo.tag, CW / 2, 606, CW - 56);
      } else {
        const pW = 488;
        const pH = 44;
        const voidSurge = state.voidFraction > 0.32;
        const xenonPit = state.xenon > 30;
        drawStatusPill(
          ctx,
          18,
          578,
          pW,
          pH,
          voidSurge
            ? "VOID SURGE +RHO -> PUMP (B) / RODS (A-2)"
            : xenonPit
              ? "XENON PIT -RHO -> PULL RODS SLOWLY (A-2)"
              : trimLocked
                ? "TRIM STABLE // REACTIVITY LOCKED"
                : "ADJUST RODS & FEEDWATER TO LOCK TRIM",
          voidSurge || xenonPit || trimLocked,
          voidSurge ? COL_VOID : xenonPit ? COL_XENON : COL_GREEN,
          voidSurge ? "#2d1604" : xenonPit ? "#210c33" : "#0c2b17",
        );
        const batDraining = netMW < -25 || batPct < 20;
        const kgbRightText =
          batDraining && state.drumWaterLevel > 180
            ? "WET STEAM CHOKING MW -> LOWER FW / DRAIN (B)"
            : spentCount > 0
              ? `SPENT CHANNELS (${spentCount}) -> REFUEL (A-2)`
              : batDraining && state.controlRodLevel >= 85 && state.coolantFlow < 0.65
                ? "LOW PUMP FLOW CAPPING MW -> BOOST PUMPS (A/B)"
                : batDraining
                  ? "BATTERY DRAINING -> RAISE RODS (A-2) & FW (B)"
                  : "CORE FUEL & BATTERY BANK NOMINAL";
        const kgbRightCrit =
          spentCount >= 4 ||
          batPct < 15 ||
          (batDraining &&
            (state.drumWaterLevel > 180 ||
              spentCount >= 2 ||
              (state.controlRodLevel >= 85 && state.coolantFlow < 0.65)));
        drawStatusPill(
          ctx,
          518,
          578,
          pW,
          pH,
          kgbRightText,
          spentCount > 0 || batDraining,
          kgbRightCrit ? COL_RED : COL_AMBER,
          kgbRightCrit ? "#360808" : "#291b04",
        );
      }
    } else if (state.tutorialPhase !== "COMPLETED") {
      // Startup 1-6 Bold Progress Bar + Action Tag
      const stepCount = VOLKOV_STEPS.length;
      const stepGap = 8;
      const stepW = (CW - 36 - stepGap * (stepCount - 1)) / stepCount;
      for (let i = 0; i < stepCount; i++) {
        const bx = 18 + i * (stepW + stepGap);
        const by = 524;
        const bh = 44;
        const isDone = i < volkovInfo.step;
        const isCurr = i === volkovInfo.step;

        ctx.fillStyle = isDone
          ? COL_GREEN
          : isCurr
            ? blinkOn
              ? "rgba(255, 184, 51, 0.34)"
              : "rgba(255, 184, 51, 0.16)"
            : "#08140d";
        ctx.fillRect(bx, by, stepW, bh);
        ctx.strokeStyle = isDone ? COL_GREEN : isCurr ? COL_AMBER : COL_DIM;
        ctx.lineWidth = isCurr ? 7 : 4;
        ctx.strokeRect(bx, by, stepW, bh);

        ctx.font = kremlinFont(16);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = isDone ? COL_BG : isCurr ? COL_AMBER : COL_MUTED;
        ctx.fillText(VOLKOV_STEPS[i], bx + stepW / 2, by + bh / 2 + 1, stepW - 10);
        ctx.textBaseline = "alphabetic";
      }

      ctx.fillStyle = "#1c1304";
      ctx.fillRect(18, 576, CW - 36, 46);
      ctx.strokeStyle = COL_AMBER;
      ctx.lineWidth = 6;
      ctx.strokeRect(18, 576, CW - 36, 46);
      ctx.font = kremlinFont(16);
      ctx.textAlign = "center";
      ctx.fillStyle = COL_AMBER;
      ctx.fillText(volkovInfo.tag, CW / 2, 605, CW - 52);
    } else {
      // Live Shifts 1-5: 4 High-Contrast Root-Cause Pills (2x2 Grid)
      const pillW = 488;
      const pillH = 44;
      const p1X = 18;
      const p2X = 518;
      const p1Y = 524;
      const p2Y = 576;

      // Pill 1: Trim / AZ-5 / Pressure
      if (state.az5Active) {
        drawStatusPill(
          ctx,
          p1X,
          p1Y,
          pillW,
          pillH,
          "AZ-5 SCRAM ACTIVE // RESET LATCH (A-2)",
          true,
          COL_RED,
          "#360808",
        );
      } else if (currentPressure >= 80 || predictedPressure >= 86) {
        drawStatusPill(
          ctx,
          p1X,
          p1Y,
          pillW,
          pillH,
          "OVERPRESSURE RISK -> VENT (B) / RODS IN (A-2)",
          true,
          COL_RED,
          "#360808",
        );
      } else if (trimLocked && gridMatched) {
        drawStatusPill(
          ctx,
          p1X,
          p1Y,
          pillW,
          pillH,
          "TRIM STABLE // CORE & GRID BALANCED",
          true,
          COL_GREEN,
          "#0c2b17",
        );
      } else {
        drawStatusPill(
          ctx,
          p1X,
          p1Y,
          pillW,
          pillH,
          "TRIM DRIFTING // MATCH RODS TO DEMAND",
          false,
          COL_MUTED,
          "#08140d",
        );
      }

      // Pill 2: Void Surge vs Xenon Pit
      if (state.voidFraction > 0.32) {
        drawStatusPill(
          ctx,
          p2X,
          p1Y,
          pillW,
          pillH,
          "VOID SURGE +RHO -> PUMP (B) / RODS (A-2)",
          true,
          state.voidFraction > 0.48 ? COL_RED : COL_VOID,
          "#2d1604",
        );
      } else if (state.xenon > 30) {
        drawStatusPill(
          ctx,
          p2X,
          p1Y,
          pillW,
          pillH,
          "XENON PIT -RHO -> PULL RODS SLOWLY (A-2)",
          true,
          COL_XENON,
          "#210c33",
        );
      } else {
        drawStatusPill(
          ctx,
          p2X,
          p1Y,
          pillW,
          pillH,
          "REACTIVITY NOMINAL // NO VOID OR XENON PIT",
          false,
          COL_MUTED,
          "#08140d",
        );
      }

      // Pill 3: Spent Channels / Drum / Seals
      if (spentCount > 0) {
        drawStatusPill(
          ctx,
          p1X,
          p2Y,
          pillW,
          pillH,
          `SPENT CHANNELS (${spentCount}) -> REFUEL (A-2)`,
          true,
          spentCount >= 4 ? COL_RED : COL_AMBER,
          spentCount >= 4 ? "#360808" : "#291b04",
        );
      } else if (Math.abs(currentWaterMm) > 100 || sealFault) {
        const drumFlooded = !sealFault && currentWaterMm >= 180;
        const drumCrit = !sealFault && Math.abs(currentWaterMm) >= 180;
        drawStatusPill(
          ctx,
          p1X,
          p2Y,
          pillW,
          pillH,
          sealFault
            ? "CONTAINMENT SEAL LEAK -> LOCK SCRUBBERS (B)"
            : drumFlooded
              ? "DRUM FLOODED -> LOWER FW / BUBBLER DRAIN (B)"
              : "DRUM LEVEL OUT OF BAND -> FEEDWATER (B)",
          true,
          drumCrit ? COL_RED : COL_AMBER,
          drumCrit ? "#360808" : "#291b04",
        );
      } else {
        drawStatusPill(
          ctx,
          p1X,
          p2Y,
          pillW,
          pillH,
          "FUEL CHANNELS, DRUM & SEALS NOMINAL",
          false,
          COL_MUTED,
          "#08140d",
        );
      }

      // Pill 4: Battery Draining (Exact Root Cause) / Grid Mismatch
      const batDraining = netMW < -25 || batPct < 20;
      if (state.isBlackout || batDraining) {
        let drainMsg = "BATTERY DRAINING -> RAISE RODS (A-2) & FW (B)";
        let drainCrit = batPct < 14 || state.isBlackout;
        if (state.drumWaterLevel > 180) {
          drainMsg = "WET STEAM CHOKING MW -> LOWER FW / DRAIN (B)";
          drainCrit = true;
        } else if (spentCount >= 2) {
          drainMsg = "BATTERY DRAINING -> REFUEL SPENT RODS (A-2)";
          drainCrit = true;
        } else if (state.controlRodLevel >= 85 && state.coolantFlow < 0.65) {
          drainMsg = "LOW PUMP FLOW CAPPING MW -> BOOST PUMPS (A/B)";
          drainCrit = true;
        }
        drawStatusPill(
          ctx,
          p2X,
          p2Y,
          pillW,
          pillH,
          drainMsg,
          true,
          drainCrit ? COL_RED : COL_AMBER,
          drainCrit ? "#360808" : "#291b04",
        );
      } else if (!gridMatched || anySubFail) {
        drawStatusPill(
          ctx,
          p2X,
          p2Y,
          pillW,
          pillH,
          "SUBSTATION MISMATCH -> SET SECTOR LEVERS (A)",
          true,
          COL_AMBER,
          "#291b04",
        );
      } else {
        drawStatusPill(
          ctx,
          p2X,
          p2Y,
          pillW,
          pillH,
          "1000 MWH BATTERY & 6 SUBSTATIONS NOMINAL",
          false,
          COL_MUTED,
          "#08140d",
        );
      }
    }

    // -------------------------------------------------------------------------
    // NON-PLAYING OVERLAY BANNER (BOOT / END OF SHIFT)
    // -------------------------------------------------------------------------
    if (state.phase !== "playing") {
      ctx.fillStyle = "rgba(5, 16, 10, 0.94)";
      ctx.fillRect(152, 200, CW - 304, 220);
      ctx.strokeStyle = state.phase === "boot" ? COL_AMBER : COL_RED;
      ctx.lineWidth = 7;
      ctx.strokeRect(152, 200, CW - 304, 220);

      ctx.textAlign = "center";
      ctx.font = kremlinFont(30);
      ctx.fillStyle = state.phase === "boot" ? COL_AMBER : COL_RED;
      ctx.fillText(
        state.phase === "boot"
          ? "REACTOR NO. 4 // STANDBY"
          : `SHIFT TERMINATED: ${state.phase.toUpperCase()}`,
        CW / 2,
        290,
        CW - 340,
      );

      ctx.font = kremlinFont(18);
      ctx.fillStyle = COL_GREEN;
      ctx.fillText(
        state.phase === "boot"
          ? "CLICK SCREEN TO START SHIFT"
          : "CLICK SCREEN TO RESET SHIFT",
        CW / 2,
        355,
        CW - 340,
      );
    }

    // Subtle CRT Scanlines
    ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
    for (let sy = 0; sy < CH; sy += 4) {
      ctx.fillRect(0, sy, CW, 1);
    }

    activeCrtTex.needsUpdate = true;
  });

  const handleActionClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    playSwitchClank(true);
    const s = useGameStore.getState();
    if (s.phase === "boot") {
      s.startShift();
      return;
    }
    if (s.phase !== "playing") {
      s.resetShift();
      return;
    }
    if (s.ciaIntrusionActive) {
      s.purgeFirewall();
      return;
    }
    if (s.komradOverrideLocked) {
      s.overrideKomradLock();
    }
  };

  return (
    <>
      <mesh
        geometry={curvedCrtGeometry}
        position={[0, 1.74, 0.163]}
        raycast={NOOP_RAYCAST}
        userData={{ isDvk84Replacement: true }}
      >
        <meshBasicMaterial
          ref={crtMatRef}
          map={crtTexture}
          toneMapped={false}
          fog={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh
        ref={diagOverlayMeshRef}
        geometry={curvedCrtGeometry}
        position={[0, 1.74, 0.178]}
        renderOrder={2}
        raycast={NOOP_RAYCAST}
        visible={false}
        userData={{ isDvk84Replacement: true }}
      >
        <meshBasicMaterial
          map={crtDiagOverlayTex}
          transparent
          depthWrite={false}
          toneMapped={false}
          fog={false}
          polygonOffset
          polygonOffsetFactor={-3}
          polygonOffsetUnits={-3}
        />
      </mesh>
      {showActionHitbox && (
        <mesh
          position={[0, 1.24, 0.195]}
          userData={{ isDvk84Replacement: true }}
          onClick={handleActionClick}
        >
          <planeGeometry args={[2.28, 0.34]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </>
  );
});
