import { useFrame, type ThreeEvent } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  playBoronHydraulicPumpStroke,
  playContactorInrushClunk,
  playDetentClick,
  playKnifeSwitchSlam,
  playPneumaticWhoosh,
  playSafetyCoverFlip,
  playSteamVentHiss,
  playValveWheelSqueak,
} from "../modules/inspector/audio";
import {
  playGeigerClick,
  playKlaxonBurst,
  playLeverRatchet,
  playSwitchClank,
} from "../modules/reactor/audioSynth";
import {
  startSoundtrack,
  updateSoundtrackState,
} from "../modules/reactor/soundtrackPlayer";
import { useCameraLookStore } from "./CameraController";
import { NOOP_RAYCAST } from "./ExteriorDioramas3D";
import {
  getKomradControlVisualOverride,
  notifyPlayerControlInteraction,
  registerKomradControlObject,
} from "./komradArmController";
import {
  onKremlinFontReady,
  registerKremlinCanvasRedraw,
} from "./kremlinFontReady";
import {
  applySovietPBRToHierarchy,
  getBrushedBrassTextures,
  getHammeredIronTextures,
} from "./proceduralMaterials";
import type { SectorNodeId } from "./types";
import { useGameStore } from "./useGameStore";

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

/**
 * Draws centered plaque text guaranteed to stay within `w - 20` (10px minimum padding on left & right)
 * using `font-weight: 900`, clean letter-spacing, and a dark `#000000` outer outline drawn BEHIND
 * `fillText` so bright letter interiors (`O`, `P`, `A`, `B`, `R`, `8`, `6`) stay 100% crisp and open!
 */
export function drawFittedPlaqueText( // oxlint-disable-line react/only-export-components
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  canvasWidth: number,
  font: string,
  color: string,
  strokeColor?: string,
  strokeWidth = 2.8,
  letterSpacing = "2px",
): void {
  ctx.save();
  const heavyFont = font.replace(/^bold\s+/i, "900 ");
  ctx.font = heavyFont;
  const ctxWithSpacing = ctx as CanvasRenderingContext2D & {
    letterSpacing?: string;
  };
  if ("letterSpacing" in ctxWithSpacing) {
    ctxWithSpacing.letterSpacing = letterSpacing;
  }
  ctx.fillStyle = color;
  // Never stroke in the same bright color as fill (which blobs counters shut); always use a dark outline behind fill!
  const effectiveStroke =
    strokeColor && strokeColor.toLowerCase() !== color.toLowerCase()
      ? strokeColor
      : "#000000";
  ctx.strokeStyle = effectiveStroke;
  ctx.lineWidth = strokeWidth > 0 ? Math.max(2.4, strokeWidth) : 0;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.textAlign = "center";
  const maxAllowedW = Math.max(40, canvasWidth - 48);
  const measuredW = ctx.measureText(text).width;
  const scaleX = measuredW > maxAllowedW ? maxAllowedW / measuredW : 1;
  ctx.translate(cx, y);
  if (scaleX < 1) {
    ctx.scale(scaleX, 1);
  }
  if (ctx.lineWidth > 0) {
    ctx.strokeText(text, 0, 0);
  }
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/**
 * Shared generator for brass-bordered 3D station plaques across UNIT A, UNIT A-2, UNIT B, and UNIT C.
 * Uses clean wide industrial sans-serif (`Segoe UI Black` / `Arial Black` / `Consolas`) with letter-spacing
 * and a dark `#000000` outer drop-shadow/outline so letter interiors never blob together.
 */
export function makePlaqueTex( // oxlint-disable-line react/only-export-components
  title: string,
  subtitle: string,
  options?: {
    width?: number;
    height?: number;
    bgColor?: string;
    borderColor?: string;
    titleColor?: string;
    titleStroke?: string;
    subColor?: string;
    subStroke?: string;
    titleSize?: number;
    subSize?: number;
  },
): THREE.CanvasTexture {
  const w = options?.width ?? 384;
  const h = options?.height ?? 128;
  const bgColor = options?.bgColor ?? "#121614";
  const borderColor = options?.borderColor ?? "#c8b06b";
  const titleColor = options?.titleColor ?? "#ffffff";
  const subColor = options?.subColor ?? "#ffe066";
  const titleSize = options?.titleSize ?? 48;
  const subSize = options?.subSize ?? 36;

  return createCrispPanelTexture(w, h, (ctx, cw, ch) => {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, cw - 6, ch - 6);
    if (!subtitle.trim()) {
      drawFittedPlaqueText(
        ctx,
        title,
        cw / 2,
        Math.round(ch * 0.66),
        cw,
        `900 ${Math.round(titleSize * 1.22)}px "Kremlin", "Segoe UI Black", "Arial Black", "Impact", "Consolas", sans-serif`,
        titleColor,
        "#000000",
        3.8,
        "3px",
      );
    } else {
      drawFittedPlaqueText(
        ctx,
        title,
        cw / 2,
        Math.round(ch * 0.44),
        cw,
        `900 ${titleSize}px "Kremlin", "Segoe UI Black", "Arial Black", "Impact", "Consolas", sans-serif`,
        titleColor,
        "#000000",
        3.6,
        "3px",
      );
      drawFittedPlaqueText(
        ctx,
        subtitle,
        cw / 2,
        Math.round(ch * 0.85),
        cw,
        `900 ${subSize}px "Kremlin", "Segoe UI Black", "Arial Black", "Consolas", sans-serif`,
        subColor,
        "#000000",
        3.2,
        "2.5px",
      );
    }
  });
}

let cachedRibbedGlassTex: THREE.CanvasTexture | null = null;

/**
 * Shared procedural ribbed phosphor/Nixie glass cell texture:
 * Fine horizontal cathode filament lines, vertical fluted glass ribs, and dark edge vignette.
 */
function getRibbedGlassCellTexture(): THREE.CanvasTexture {
  if (cachedRibbedGlassTex) return cachedRibbedGlassTex;
  cachedRibbedGlassTex = createCrispPanelTexture(128, 64, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(
      w * 0.5,
      h * 0.5,
      4,
      w * 0.5,
      h * 0.5,
      w * 0.58,
    );
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.7, "#d4dcd6");
    grad.addColorStop(1, "#4a544e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Vertical fluted glass lens ribs
    for (let x = 0; x < w; x += 6) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      ctx.fillRect(x, 0, 2, h);
      ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
      ctx.fillRect(x + 2, 0, 1, h);
    }

    // Fine horizontal CRT/Nixie cathode mesh lines
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1);
    }

    // Dark recessed glass border frame
    ctx.strokeStyle = "rgba(10, 14, 12, 0.65)";
    ctx.lineWidth = 4;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  });
  return cachedRibbedGlassTex;
}

function captureCanvasPointer(e: ThreeEvent<PointerEvent>): void {
  (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
  const domElem = e.nativeEvent.target as Element | null;
  domElem?.setPointerCapture?.(e.pointerId);
}

function releaseCanvasPointer(e: ThreeEvent<PointerEvent>): void {
  const r3fTarget = e.target as Element | null;
  if (r3fTarget?.hasPointerCapture?.(e.pointerId)) {
    r3fTarget.releasePointerCapture(e.pointerId);
  }
  const domElem = e.nativeEvent.target as Element | null;
  if (domElem?.hasPointerCapture?.(e.pointerId)) {
    domElem.releasePointerCapture(e.pointerId);
  }
}

/**
 * Effortless Rotary Handwheel Drag + Click-to-Step (+25%) Fallback:
 * - Dragging just 40px up/right or down/left (OR rotating around the wheel hub) smoothly sweeps 0% -> 100%!
 * - Clicking without dragging (`< 6px` movement) automatically steps the valve by +25% (or wraps 100% -> 0% if already at max).
 */
function startSmoothWheelSwivelDrag(
  e: ThreeEvent<PointerEvent>,
  wheelObject: THREE.Object3D | null,
  initialValue: number,
  minVal: number,
  maxVal: number,
  onChange: (nextVal: number) => void,
  onActiveChange?: (isActive: boolean) => void,
): void {
  if (useCameraLookStore.getState().isFreeLookMode) return;
  e.stopPropagation();
  onActiveChange?.(true);

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
  if (wheelObject && rect && rect.width > 0 && rect.height > 0) {
    const worldPos = new THREE.Vector3();
    wheelObject.getWorldPosition(worldPos);
    worldPos.project(e.camera);
    centerX = rect.left + (worldPos.x * 0.5 + 0.5) * rect.width;
    centerY = rect.top + (-worldPos.y * 0.5 + 0.5) * rect.height;
  }

  const startX = e.nativeEvent.clientX;
  const startY = e.nativeEvent.clientY;
  let prevClientX = startX;
  let prevClientY = startY;
  let currentVal = initialValue;
  let totalMoveDist = 0;
  const initR = Math.hypot(startX - centerX, startY - centerY);
  let hasValidAngle = initR >= 6;
  let prevAngle = hasValidAngle
    ? Math.atan2(startY - centerY, startX - centerX)
    : 0;
  const range = maxVal - minVal;
  let lastSoundStep = Math.floor(((currentVal - minVal) / range) * 16);

  const handleMove = (ev: PointerEvent) => {
    totalMoveDist = Math.max(
      totalMoveDist,
      Math.hypot(ev.clientX - startX, ev.clientY - startY),
    );

    const dx = ev.clientX - prevClientX;
    const dy = ev.clientY - prevClientY;
    prevClientX = ev.clientX;
    prevClientY = ev.clientY;

    const moveLen = Math.hypot(dx, dy);
    if (moveLen < 0.25) return;

    const rx = ev.clientX - centerX;
    const ry = ev.clientY - centerY;
    const r = Math.hypot(rx, ry);
    const curAngle = r >= 6 ? Math.atan2(ry, rx) : prevAngle;

    let deltaRatio = (dx - dy) / 135;
    if (r >= 24 && hasValidAngle) {
      let dTheta = curAngle - prevAngle;
      while (dTheta > Math.PI) dTheta -= Math.PI * 2;
      while (dTheta < -Math.PI) dTheta += Math.PI * 2;
      const tangentialLen = Math.abs(dTheta) * r;
      if (tangentialLen > moveLen * 0.65) {
        deltaRatio = dTheta / (Math.PI * 1.25);
      }
    }

    if (r >= 6) {
      hasValidAngle = true;
      prevAngle = curAngle;
    }

    currentVal = THREE.MathUtils.clamp(
      currentVal + deltaRatio * range,
      minVal,
      maxVal,
    );
    if (wheelObject) {
      wheelObject.rotation.z -= deltaRatio * Math.PI * 1.6;
    }
    onChange(currentVal);

    const soundStep = Math.floor(((currentVal - minVal) / range) * 16);
    if (soundStep !== lastSoundStep) {
      lastSoundStep = soundStep;
      playValveWheelSqueak((Math.abs(soundStep) % 6) + 1);
    }
  };

  const handleUp = () => {
    onActiveChange?.(false);
    r3fTarget?.releasePointerCapture?.(e.pointerId);
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleUp);
    window.removeEventListener("pointercancel", handleUp);

    // Click-to-Step (+25%) fallback if the player clicked without dragging (< 6px movement)
    if (totalMoveDist < 6) {
      const stepped =
        initialValue >= maxVal - range * 0.05
          ? minVal
          : Math.min(
              maxVal,
              Math.round((initialValue + range * 0.25) / (range * 0.25)) *
                (range * 0.25),
            );
      playValveWheelSqueak(3);
      playSwitchClank(true);
      onChange(stepped);
      return;
    }

    playSwitchClank(false);
  };

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleUp);
  window.addEventListener("pointercancel", handleUp);
}

/**
 * Strictly Vertical Linear Lever Drag (Pointer-Lock & Free-Cursor Safe):
 * - Maps ONLY vertical mouse movement (`-ev.movementY` under Pointer Lock, `-delta clientY` otherwise)
 *   linearly into clamped `[minVal, maxVal]` without any `atan2` polar math or 3D rotation mutation.
 * - Pushing mouse UP (`dy < 0`) raises value toward `maxVal`; pulling DOWN (`dy > 0`) lowers toward `minVal`.
 */
function startLinearVerticalLeverDrag(
  e: ThreeEvent<PointerEvent>,
  initialValue: number,
  minVal: number,
  maxVal: number,
  onChange: (nextVal: number) => void,
  onActiveChange?: (isActive: boolean) => void,
  dragSpanPx = 150,
): () => void {
  if (useCameraLookStore.getState().isFreeLookMode) return () => {};
  e.stopPropagation();
  onActiveChange?.(true);

  const r3fTarget = e.target as unknown as {
    setPointerCapture?: (id: number) => void;
    releasePointerCapture?: (id: number) => void;
  };
  r3fTarget?.setPointerCapture?.(e.pointerId);

  let prevClientY = e.nativeEvent.clientY;
  let currentVal = THREE.MathUtils.clamp(initialValue, minVal, maxVal);
  const range = Math.max(1e-4, maxVal - minVal);
  const sensitivity = range / Math.max(40, dragSpanPx);
  let lastDetentBucket = Math.round(((currentVal - minVal) / range) * 20);
  let finished = false;

  playSwitchClank(true);

  const handleMove = (ev: PointerEvent) => {
    if (finished) return;
    const isLocked = document.pointerLockElement !== null;
    const rawDy = isLocked ? ev.movementY : ev.clientY - prevClientY;
    prevClientY = ev.clientY;

    if (!Number.isFinite(rawDy) || Math.abs(rawDy) < 0.01) return;
    const dy = THREE.MathUtils.clamp(rawDy, -140, 140);

    const nextVal = THREE.MathUtils.clamp(
      currentVal - dy * sensitivity,
      minVal,
      maxVal,
    );
    if (Math.abs(nextVal - currentVal) < 1e-4) return;
    currentVal = nextVal;
    onChange(currentVal);

    const bucket = Math.round(((currentVal - minVal) / range) * 20);
    if (bucket !== lastDetentBucket) {
      lastDetentBucket = bucket;
      playDetentClick((Math.abs(bucket) % 5) + 1);
    }
  };

  const cleanup = (playReleaseClank: boolean) => {
    if (finished) return;
    finished = true;
    onActiveChange?.(false);
    r3fTarget?.releasePointerCapture?.(e.pointerId);
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleUp);
    window.removeEventListener("pointercancel", handleUp);
    window.removeEventListener("blur", handleBlur);
    if (playReleaseClank) {
      playSwitchClank(false);
    }
  };

  const handleUp = () => cleanup(true);
  const handleBlur = () => cleanup(false);

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleUp);
  window.addEventListener("pointercancel", handleUp);
  window.addEventListener("blur", handleBlur);

  return () => cleanup(false);
}

const BOLT_ANGLES_8 = [
  0,
  Math.PI * 0.25,
  Math.PI * 0.5,
  Math.PI * 0.75,
  Math.PI,
  Math.PI * 1.25,
  Math.PI * 1.5,
  Math.PI * 1.75,
];

function mergeStaticGeometries(
  parts: ReadonlyArray<{
    geometry: THREE.BufferGeometry;
    position?: readonly [number, number, number];
    rotation?: readonly [number, number, number];
    scale?: readonly [number, number, number];
  }>,
): THREE.BufferGeometry {
  const prepared: THREE.BufferGeometry[] = [];
  const mat = new THREE.Matrix4();
  const euler = new THREE.Euler();
  const quat = new THREE.Quaternion();
  const posVec = new THREE.Vector3();
  const scaleVec = new THREE.Vector3();

  for (const part of parts) {
    const g = part.geometry.clone();
    posVec.set(...(part.position ?? [0, 0, 0]));
    euler.set(...(part.rotation ?? [0, 0, 0]));
    quat.setFromEuler(euler);
    scaleVec.set(...(part.scale ?? [1, 1, 1]));
    mat.compose(posVec, quat, scaleVec);
    g.applyMatrix4(mat);
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    if (!g.getAttribute("uv")) {
      const count = g.getAttribute("position").count;
      g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    prepared.push(g);
    part.geometry.dispose();
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

const MANOMETER_8_BOLTS_GEO = mergeStaticGeometries(
  BOLT_ANGLES_8.map((ang) => ({
    geometry: new THREE.CylinderGeometry(0.01, 0.01, 0.014, 6),
    position: [Math.cos(ang) * 0.192, Math.sin(ang) * 0.192, 0.044],
    rotation: [Math.PI / 2, 0, 0],
  })),
);

const POWER_COL_4_BOLTS_GEO = mergeStaticGeometries(
  (
    [
      [-0.048, 0.236],
      [0.048, 0.236],
      [-0.048, -0.236],
      [0.048, -0.236],
    ] as const
  ).map(([bx, by]) => ({
    geometry: new THREE.CylinderGeometry(0.006, 0.006, 0.008, 6),
    position: [bx, by, 0.022],
    rotation: [Math.PI / 2, 0, 0],
  })),
);

const POWER_COL_10_LOUVERS_GEO = mergeStaticGeometries(
  Array.from({ length: 10 }, (_, idx) => ({
    geometry: new THREE.BoxGeometry(0.104, 0.007, 0.016),
    position: [0, -0.209 + idx * 0.0465 + 0.0225, 0.019],
  })),
);

const POWER_COL_6_BOLTS_GEO = mergeStaticGeometries(
  (
    [
      [-0.054, 0.234],
      [0.054, 0.234],
      [-0.054, 0],
      [0.054, 0],
      [-0.054, -0.234],
      [0.054, -0.234],
    ] as const
  ).map(([bx, by]) => ({
    geometry: new THREE.CylinderGeometry(0.0055, 0.0055, 0.008, 6),
    position: [bx, by, 0.025],
    rotation: [Math.PI / 2, 0, 0],
  })),
);

const POWER_COL_18_PLEATS_GEO = mergeStaticGeometries(
  Array.from({ length: 24 }, (_, pIdx) => ({
    geometry: new THREE.BoxGeometry(0.028, 0.006, 0.006),
    position: [0.008, -0.22 + pIdx * 0.0191, 0.019],
  })),
);

const POWER_COL_20_TEETH_GEO = mergeStaticGeometries(
  Array.from({ length: 11 }, (_, tIdx) => {
    const ty = -0.225 + tIdx * 0.045;
    return [
      {
        geometry: new THREE.BoxGeometry(0.012, 0.009, 0.01),
        position: [0.008 - 0.018, ty, 0.022] as const,
      },
      {
        geometry: new THREE.BoxGeometry(0.014, 0.01, 0.012),
        position: [0.008 + 0.018, ty, 0.022] as const,
      },
    ];
  }).flat(),
);

const REACTOR_REDLINE_4_BOLTS_GEO = mergeStaticGeometries(
  (
    [
      [-0.815, 0.032],
      [0.815, 0.032],
      [-0.815, -0.032],
      [0.815, -0.032],
    ] as const
  ).map(([bx, by]) => ({
    geometry: new THREE.CylinderGeometry(0.006, 0.006, 0.008, 6),
    position: [bx, by, 0.012],
    rotation: [Math.PI / 2, 0, 0],
  })),
);

const REACTOR_REDLINE_18_LOUVERS_GEO = mergeStaticGeometries(
  Array.from({ length: 18 }, (_, idx) => ({
    geometry: new THREE.BoxGeometry(0.006, 0.062, 0.014),
    position: [-0.7225 + idx * 0.085 + 0.037, 0, 0.012],
  })),
);

const A2_OIL_5_LOUVERS_GEO = mergeStaticGeometries(
  Array.from({ length: 5 }, (_, idx) => ({
    geometry: new THREE.BoxGeometry(0.046, 0.005, 0.012),
    position: [0, -0.084 + idx * 0.042 + 0.018, 0.014],
  })),
);

const A2_BORON_6_BOLTS_GEO = mergeStaticGeometries(
  (
    [
      [-0.058, 0.142],
      [0.058, 0.142],
      [-0.058, 0],
      [0.058, 0],
      [-0.058, -0.142],
      [0.058, -0.142],
    ] as const
  ).map(([bx, by]) => ({
    geometry: new THREE.CylinderGeometry(0.005, 0.005, 0.006, 6),
    position: [bx, by, 0.019],
    rotation: [Math.PI / 2, 0, 0],
  })),
);

const A2_BORON_12_PLEATS_GEO = mergeStaticGeometries(
  Array.from({ length: 14 }, (_, bIdx) => ({
    geometry: new THREE.CylinderGeometry(0.0042, 0.0042, 0.036, 8),
    position: [0, -0.122 + bIdx * 0.0188, 0.016],
    rotation: [0, 0, Math.PI / 2],
  })),
);

const A2_BORON_16_TEETH_GEO = mergeStaticGeometries(
  Array.from({ length: 9 }, (_, tIdx) => {
    const ty = -0.12 + tIdx * 0.03;
    return [
      {
        geometry: new THREE.BoxGeometry(0.014, 0.009, 0.01),
        position: [-0.025, ty, 0.02] as const,
      },
      {
        geometry: new THREE.BoxGeometry(0.014, 0.009, 0.01),
        position: [0.025, ty, 0.02] as const,
      },
    ];
  }).flat(),
);

const A2_BORON_10_LOUVERS_GEO = mergeStaticGeometries(
  Array.from({ length: 10 }, (_, idx) => ({
    geometry: new THREE.BoxGeometry(0.068, 0.0045, 0.012),
    position: [0, -0.122 + idx * 0.0272 + 0.013, 0.015],
  })),
);

const B_GAS_8_FINS_GEO = mergeStaticGeometries(
  [-0.088, 0.018].flatMap((px) =>
    [-0.11, -0.055, 0.055, 0.11].map((fy) => ({
      geometry: new THREE.CylinderGeometry(0.026, 0.026, 0.012, 12),
      position: [px, -0.02 + fy, 0.026] as const,
    })),
  ),
);

const B_GAS_10_LOUVERS_GEO = mergeStaticGeometries(
  Array.from({ length: 10 }, (_, idx) => ({
    geometry: new THREE.BoxGeometry(0.046, 0.004, 0.012),
    position: [0, -0.112 + idx * 0.025 + 0.0115, 0.014],
  })),
);

const B_SEALS_4_BOSSES_GEO = mergeStaticGeometries(
  [-0.16, -0.053, 0.053, 0.16].map((lx) => ({
    geometry: new THREE.CylinderGeometry(0.036, 0.04, 0.01, 16),
    position: [lx, 0.055, 0.026],
    rotation: [Math.PI / 2, 0, 0],
  })),
);

const B_DRAIN_6_BOLTS_GEO = mergeStaticGeometries(
  (
    [
      [-0.049, 0.128],
      [0.049, 0.128],
      [-0.049, 0],
      [0.049, 0],
      [-0.049, -0.128],
      [0.049, -0.128],
    ] as const
  ).map(([bx, by]) => ({
    geometry: new THREE.CylinderGeometry(0.0048, 0.0048, 0.006, 6),
    position: [bx, by, 0.018],
    rotation: [Math.PI / 2, 0, 0],
  })),
);

const B_DRAIN_12_PLEATS_GEO = mergeStaticGeometries(
  Array.from({ length: 12 }, (_, bIdx) => ({
    geometry: new THREE.CylinderGeometry(0.004, 0.004, 0.028, 8),
    position: [0, -0.105 + bIdx * 0.019, 0.015],
    rotation: [0, 0, Math.PI / 2],
  })),
);

const B_DRAIN_16_TEETH_GEO = mergeStaticGeometries(
  Array.from({ length: 8 }, (_, tIdx) => {
    const ty = -0.105 + tIdx * 0.03;
    return [
      {
        geometry: new THREE.BoxGeometry(0.013, 0.009, 0.01),
        position: [-0.022, ty, 0.019] as const,
      },
      {
        geometry: new THREE.BoxGeometry(0.013, 0.009, 0.01),
        position: [0.022, ty, 0.019] as const,
      },
    ];
  }).flat(),
);

const B_4_SIGHT_TICKS_GEO = mergeStaticGeometries(
  [-0.072, -0.024, 0.024, 0.072].map((ry) => ({
    geometry: new THREE.TorusGeometry(0.0225, 0.0024, 8, 18),
    position: [0, ry, 0.004],
    rotation: [Math.PI / 2, 0, 0],
  })),
);

const B_8_SIGHT_BOLTS_GEO = mergeStaticGeometries(
  [-0.132, 0.132].flatMap((vy) =>
    (
      [
        [-0.024, 0.018],
        [0.024, 0.018],
        [-0.024, -0.018],
        [0.024, -0.018],
      ] as const
    ).map(([bx, bz]) => ({
      geometry: new THREE.CylinderGeometry(0.004, 0.004, 0.032, 6),
      position: [bx, vy, bz] as const,
    })),
  ),
);

const RBMK_8_CLAMPS_GEO = mergeStaticGeometries(
  Array.from({ length: 8 }, (_, cIdx) => {
    const ang = (cIdx / 8) * Math.PI * 2 + Math.PI / 8;
    return {
      geometry: new THREE.BoxGeometry(0.026, 0.04, 0.018),
      position: [Math.cos(ang) * 0.2, Math.sin(ang) * 0.2, 0.029],
      rotation: [0, 0, ang],
    };
  }),
);

const RBMK_16_BOLTS_GEO = mergeStaticGeometries(
  Array.from({ length: 16 }, (_, bIdx) => {
    const ang = (bIdx / 16) * Math.PI * 2;
    return {
      geometry: new THREE.CylinderGeometry(0.0052, 0.0052, 0.006, 6),
      position: [Math.cos(ang) * 0.194, Math.sin(ang) * 0.194, 0.036],
      rotation: [Math.PI / 2, 0, 0],
    };
  }),
);

export interface SovietCRTMonitorBay3DProps {
  position: [number, number, number];
  screenMatRef: React.RefObject<THREE.MeshStandardMaterial | null>;
  screenTexture: THREE.CanvasTexture;
  modelBadge?: string;
}

export interface MimicSegmentSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  color: "#c8a838" | "#388898" | "#a83830";
  z?: number;
}

export interface MimicNodeSpec {
  x: number;
  y: number;
  color: "#c8a838" | "#388898" | "#a83830";
  z?: number;
}

export interface SovietModularSteelCabinet3DProps {
  width: number;
  unitCode: "A" | "A2" | "B" | "C" | "D";
  annunciatorLabels?: readonly [string, string, string, string, string, string];
  mimicSegments: readonly MimicSegmentSpec[];
  mimicNodes?: readonly MimicNodeSpec[];
  recessedWells?: ReadonlyArray<{
    x: number;
    y: number;
    w: number;
    h: number;
  }>;
  dividerY?: number;
  lowerLedgeY?: number;
  openLeftSide?: boolean;
  openRightSide?: boolean;
  hideChartRecorders?: boolean;
  hideStripMeters?: boolean;
  unifiedUpperFace?: boolean;
}

/**
 * Authentic 1984 Soviet RBMK-1000 Modular Steel Cabinetry (MCR-84 Bay Section):
 * Replaces flat dark panel boxes with a 3-part enamelled blue-grey/olive-grey steel cabinet
 * (`#485450` / `#3d4845`), dark structural steel framing (`#1e2422`), recessed instrument wells
 * (`#141817`), angled upper canopy overhang (`+0.08m`) with a 10-segment progressive alarm bar,
 * center Kremlin status window, and 3D caged roof strobe beacon, stepped side cheeks (`0.18m-0.28m`),
 * lower sloped console desk ledge framing, and physical 3D raised synoptic process flow lines —
 * while keeping 100% of existing controls at their exact local `(x, y, z)` coordinates!
 */
const ksp4StaticBgCache = new Map<string, HTMLCanvasElement>();

function getKsp4StaticBg(
  w: number,
  h: number,
  titleText: string,
): HTMLCanvasElement {
  const key = `${w}x${h}:${titleText}`;
  const cached = ksp4StaticBgCache.get(key);
  if (cached) return cached;

  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d");
  if (ctx) {
    // Cream-white chart paper roll (#f4f1e6)
    ctx.fillStyle = "#f4f1e6";
    ctx.fillRect(0, 0, w, h);
    // Millimeter chart paper grid lines (pale cyan-green)
    ctx.strokeStyle = "rgba(56, 136, 128, 0.28)";
    ctx.lineWidth = 1;
    for (let x = 16; x < w; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 54);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 56; y < h; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // Left & right tractor sprocket holes on paper roll
    ctx.fillStyle = "#262c2a";
    for (let y = 64; y < h; y += 28) {
      ctx.beginPath();
      ctx.arc(8, y, 3, 0, Math.PI * 2);
      ctx.arc(w - 8, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Top KSP-4 Scale Header Bar (#ece8d8)
    ctx.fillStyle = "#ece8d8";
    ctx.fillRect(0, 0, w, 54);
    ctx.strokeStyle = "#1e2422";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w - 4, 50);
    ctx.fillStyle = "#181c1a";
    ctx.font = '900 15px "Consolas", monospace';
    ctx.textAlign = "center";
    ctx.fillText(titleText, w / 2, 20);
    ctx.fillStyle = "#c82218";
    ctx.fillRect(20, 28, w - 40, 5);
  }
  ksp4StaticBgCache.set(key, off);
  return off;
}

function paintKsp4Chart(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  redTrace: number[],
  blueTrace: number[],
  titleText: string,
): void {
  const staticBg = getKsp4StaticBg(w, h, titleText);
  ctx.drawImage(staticBg, 0, 0);

  const padX = 24;
  const chartW = w - padX * 2;
  const stepY = (h - 56) / Math.max(1, redTrace.length - 1);

  // Red channel trace (newest at top y=56, scrolling downward)
  ctx.strokeStyle = "#d81e18";
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  for (let i = 0; i < redTrace.length; i++) {
    const px = padX + THREE.MathUtils.clamp(redTrace[i], 0.03, 0.97) * chartW;
    const py = 56 + i * stepY;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Blue channel trace
  ctx.strokeStyle = "#245898";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let i = 0; i < blueTrace.length; i++) {
    const px = padX + THREE.MathUtils.clamp(blueTrace[i], 0.03, 0.97) * chartW;
    const py = 56 + i * stepY;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Red pen carriage pointer at top of chart
  const redHeadX =
    padX + THREE.MathUtils.clamp(redTrace[0] ?? 0.5, 0.05, 0.95) * chartW;
  ctx.fillStyle = "#d81e18";
  ctx.beginPath();
  ctx.moveTo(redHeadX, 54);
  ctx.lineTo(redHeadX - 8, 38);
  ctx.lineTo(redHeadX + 8, 38);
  ctx.closePath();
  ctx.fill();

  // Blue pen carriage pointer at top of chart
  const blueHeadX =
    padX + THREE.MathUtils.clamp(blueTrace[0] ?? 0.4, 0.05, 0.95) * chartW;
  ctx.fillStyle = "#245898";
  ctx.beginPath();
  ctx.moveTo(blueHeadX, 54);
  ctx.lineTo(blueHeadX - 6, 41);
  ctx.lineTo(blueHeadX + 6, 41);
  ctx.closePath();
  ctx.fill();
}

const SHARED_KSP4_STATE = {
  red0: Array(55).fill(0.5) as number[],
  blue0: Array(55).fill(0.42) as number[],
  red1: Array(55).fill(0.5) as number[],
  blue1: Array(55).fill(0.5) as number[],
  lastSampleTime: -1,
  lastSig0: "",
  lastSig1: "",
};

let canopyFontGen = 0;

onKremlinFontReady(() => {
  SHARED_KSP4_STATE.lastSig0 = "";
  SHARED_KSP4_STATE.lastSig1 = "";
  canopyFontGen += 1;
});

const CANOPY_COL_DARK = new THREE.Color("#111915");
const CANOPY_COL_DARK_EM = new THREE.Color("#090f0c");
const CANOPY_COL_GREEN = new THREE.Color("#24e068");
const CANOPY_COL_GREEN_DIM = new THREE.Color("#196b38");
const CANOPY_COL_YELGREEN = new THREE.Color("#9dff33");
const CANOPY_COL_YELLOW = new THREE.Color("#ffd629");
const CANOPY_COL_AMBER = new THREE.Color("#ff8c1a");
const CANOPY_COL_REDORANGE = new THREE.Color("#ff3d14");
const CANOPY_COL_CRIMSON = new THREE.Color("#ff1a1a");
const CANOPY_COL_CRIMSON_DIM = new THREE.Color("#4a0808");
const CANOPY_COL_CHERENKOV_LO = new THREE.Color("#00d4ff");
const CANOPY_COL_CHERENKOV_HI = new THREE.Color("#80f5ff");
const CANOPY_COL_WHITE = new THREE.Color("#ffffff");
const CANOPY_SCRATCH_COL = new THREE.Color();

type CanopyBannerMode =
  | "blackout"
  | "tutorial"
  | "tier0"
  | "tier1"
  | "tier2"
  | "tier3"
  | "tier4";

function paintCanopyStatusWindow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mode: CanopyBannerMode,
  label: string,
): void {
  let bgColor = "#082414";
  let borderColor = "#24e068";
  let textColor = "#80ffad";
  let strokeColor = "#021208";

  switch (mode) {
    case "blackout":
      bgColor = "#0b100e";
      borderColor = "#2b3631";
      textColor = "#607068";
      strokeColor = "#040605";
      break;
    case "tutorial":
      bgColor = "#032638";
      borderColor = "#5ceeff";
      textColor = "#e8fcff";
      strokeColor = "#001824";
      break;
    case "tier0":
      bgColor = "#082414";
      borderColor = "#24e068";
      textColor = "#80ffad";
      strokeColor = "#021208";
      break;
    case "tier1":
      bgColor = "#262808";
      borderColor = "#ffd629";
      textColor = "#fff07a";
      strokeColor = "#141400";
      break;
    case "tier2":
      bgColor = "#331904";
      borderColor = "#ff8c1a";
      textColor = "#ffd27d";
      strokeColor = "#1a0a00";
      break;
    case "tier3":
      bgColor = "#380b04";
      borderColor = "#ff3d14";
      textColor = "#ffaa88";
      strokeColor = "#1a0400";
      break;
    case "tier4":
      bgColor = "#540606";
      borderColor = "#ff1a1a";
      textColor = "#ffffff";
      strokeColor = "#260000";
      break;
  }

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);

  // Subtle horizontal cathode/diffuser scanlines & vertical ribs
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 1);
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  for (let x = 0; x < w; x += 16) {
    ctx.fillRect(x, 0, 1, h);
  }

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, w - 6, h - 6);

  drawFittedPlaqueText(
    ctx,
    label,
    w / 2,
    Math.round(h * 0.65),
    w - 16,
    '900 34px "Kremlin", "Segoe UI Symbol", "Segoe UI Black", "Consolas", monospace',
    textColor,
    strokeColor,
    3.2,
    "2px",
  );
}

let sharedKsp4TexturesCache: readonly [THREE.CanvasTexture, THREE.CanvasTexture] | null = null;
function getSharedKsp4Textures(): readonly [THREE.CanvasTexture, THREE.CanvasTexture] {
  if (sharedKsp4TexturesCache) return sharedKsp4TexturesCache;
  const tex0 = createCrispPanelTexture(256, 384, (ctx, w, h) => {
    paintKsp4Chart(
      ctx,
      w,
      h,
      SHARED_KSP4_STATE.red0,
      SHARED_KSP4_STATE.blue0,
      "KSP-4 // BAR & MW",
    );
  });
  const tex1 = createCrispPanelTexture(256, 384, (ctx, w, h) => {
    paintKsp4Chart(
      ctx,
      w,
      h,
      SHARED_KSP4_STATE.red1,
      SHARED_KSP4_STATE.blue1,
      "KSP-4 // GRID 50HZ",
    );
  });
  sharedKsp4TexturesCache = [tex0, tex1] as const;
  return sharedKsp4TexturesCache;
}

const SECTOR_TO_SUBSTATION_ID: Readonly<Record<SectorNodeId, number>> = {
  pripyat: 1,
  duga: 2,
  kolkhoz: 3,
  kgb: 4,
  vodka: 5,
  steel: 6,
};

function getSectorQuotaStatus(
  substations: readonly { id: number; quotaMode?: "exact" | "min" | "max" }[],
  sector: SectorNodeId,
  currentMW: number,
  targetMW: number,
): { mode: "exact" | "min" | "max"; isMatched: boolean; diff: number } {
  const subId = SECTOR_TO_SUBSTATION_ID[sector];
  const sub = substations.find((item) => item.id === subId);
  const mode = sub?.quotaMode ?? "exact";
  if (mode === "min") {
    const deficit = Math.max(0, targetMW - currentMW);
    return { mode, isMatched: deficit === 0, diff: deficit };
  }
  if (mode === "max") {
    const excess = Math.max(0, currentMW - targetMW);
    return { mode, isMatched: excess === 0, diff: excess };
  }
  const diff = Math.abs(currentMW - targetMW);
  return { mode, isMatched: diff === 0, diff };
}

export const SovietModularSteelCabinet3D: React.FC<
  SovietModularSteelCabinet3DProps
> = React.memo(
  ({
    width,
    unitCode,
    mimicSegments,
    mimicNodes = [],
    recessedWells = [],
    dividerY = 1.318,
    openLeftSide = false,
    openRightSide = false,
    hideChartRecorders = false,
    hideStripMeters = false,
    unifiedUpperFace = false,
  }) => {
    const cabinetRootRef = useRef<THREE.Group>(null);
    const ironTex = useMemo(() => getHammeredIronTextures(), []);
    const brassTex = useMemo(() => getBrushedBrassTextures(), []);

    useEffect(() => {
      cabinetRootRef.current?.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.raycast = NOOP_RAYCAST;
          obj.castShadow = false;
          obj.receiveShadow = false;
        }
      });
    }, []);
    const alarmBarMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
    const beaconMatRefs = useRef<
      [THREE.MeshStandardMaterial | null, THREE.MeshStandardMaterial | null]
    >([null, null]);
    const centerWindowMatRef = useRef<THREE.MeshStandardMaterial>(null);
    const smoothSeverityRef = useRef(0);
    const lastCenterSigRef = useRef("");
    const m381NeedleRefs = useRef<Array<THREE.Mesh | null>>([]);
    const m381PosRefs = useRef<number[]>(Array(8).fill(0.5));
    const m381VelRefs = useRef<number[]>(Array(8).fill(0));

    const ksp4ChartTextures = useMemo(
      () => (hideChartRecorders ? null : getSharedKsp4Textures()),
      [hideChartRecorders],
    );
    const ksp4ChartTexturesRef = useRef<readonly [THREE.CanvasTexture, THREE.CanvasTexture] | null>(null);
    useEffect(() => {
      ksp4ChartTexturesRef.current = ksp4ChartTextures;
    }, [ksp4ChartTextures]);

    const ribbedGlassTex = useMemo(() => getRibbedGlassCellTexture(), []);
    const centerWindowTex = useMemo(() => {
      const tex = createCrispPanelTexture(640, 96);
      const canvas = tex.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        paintCanopyStatusWindow(ctx, 640, 96, "tier0", "SYSTEM NOMINAL");
        tex.needsUpdate = true;
      }
      return tex;
    }, []);

    useEffect(() => {
      return () => {
        centerWindowTex.dispose();
      };
    }, [centerWindowTex]);

    useFrame(({ clock }, delta) => {
      const s = useGameStore.getState();
      const t = clock.getElapsedTime();

      // 1. Tutorial Target Check (Blinking Cherenkov-Blue Beacon)
      const isTutorialTarget =
        s.tutorialPhase !== "COMPLETED" &&
        ((s.tutorialPhase === "STEP_1_COOLING" && unitCode === "A") ||
          (s.tutorialPhase === "STEP_2_PULL_RODS" && unitCode === "A2") ||
          ((s.tutorialPhase === "STEP_6_BASELINE_600MW" ||
            s.tutorialPhase === "STEP_4_SPIN_TURBINE" ||
            s.tutorialPhase === "STEP_5_SYNC_GRID") &&
            unitCode === "A") ||
          (s.tutorialPhase === "STEP_8_XENON_DRILL" && unitCode === "A2") ||
          (s.tutorialPhase === "STEP_3_BUILD_STEAM" && unitCode === "B") ||
          (s.tutorialPhase === "STEP_7_VOID_DRILL" &&
            (unitCode === "B" || unitCode === "A" || unitCode === "A2")));

      // 2. Continuous 0.0 -> 1.0 Stress Score + Culprit Tag Per Console
      const norm = (v: number, lo: number, hi: number): number =>
        THREE.MathUtils.clamp((v - lo) / (hi - lo), 0, 1);

      let rawSeverity = 0;
      let culpritTag = "SYSTEM NOMINAL";
      const consider = (score: number, tag: string) => {
        if (score > rawSeverity) {
          rawSeverity = score;
          culpritTag = tag;
        }
      };

      const isOperating =
        s.thermalPower > 220 || s.tutorialPhase === "COMPLETED";

      if (unitCode === "B") {
        consider(norm(Math.abs(s.drumWaterLevel), 60, 260), "DRUM LEVEL");
        const steamScore = Math.max(
          norm(s.drumPressure, 72, 86),
          isOperating ? norm(62 - s.drumPressure, 0, 32) : 0,
        );
        consider(steamScore, "STEAM BAR");
        consider(norm(s.bubblerLevel, 65, 92), "BUBBLER FULL");
        consider(norm(s.graphiteTemp, 500, 650), "GRAPHITE HOT");
        if (
          isOperating &&
          (s.sealToggles.some((on) => !on) ||
            !s.containmentSealLocked ||
            s.mcpActive.filter(Boolean).length < 2)
        ) {
          consider(0.65, "PUMPS / SEALS");
        }
      } else if (unitCode === "A2") {
        const spentCount = Object.keys(s.channelHotspots).length;
        const spentScore =
          spentCount >= 4
            ? 1.0
            : spentCount === 3
              ? 0.85
              : spentCount === 2
                ? 0.62
                : spentCount === 1
                  ? 0.38
                  : 0;
        consider(spentScore, "REFUEL CORE");
        consider(norm(s.voidFraction * 100, 18, 52), "VOID SURGE");
        consider(norm(s.xenon, 20, 55) * 0.85, "XENON PIT");
        consider(norm(s.thermalPower, 3200, 3750), "HIGH MW");
        if (s.az5Active) {
          consider(1.0, "AZ-5 SCRAM");
        }
      } else if (unitCode === "A") {
        consider(norm(s.coreTemp, 480, 720), "CORE TEMP");
        if (s.tutorialPhase === "COMPLETED") {
          const sectorKeys = Object.keys(s.sectorMW) as SectorNodeId[];
          let unmatched = 0;
          for (let k = 0; k < sectorKeys.length; k++) {
            const key = sectorKeys[k];
            if (
              !getSectorQuotaStatus(
                s.substations,
                key,
                s.sectorMW[key],
                s.targetSectorMW[key],
              ).isMatched
            ) {
              unmatched++;
            }
          }
          if (unmatched > 0) {
            const baseQuota = unmatched <= 2 ? 0.45 : 0.6;
            const remSec = s.activeMandate?.complianceRemainingSec ?? 999;
            const quotaScore =
              remSec < 12
                ? 1.0
                : remSec < 30
                  ? Math.max(baseQuota, 0.78 + norm(30 - remSec, 0, 18) * 0.22)
                  : baseQuota;
            consider(quotaScore, "SECTOR QUOTA");
          }
        }
        consider(norm(s.roomRadiation, 0.8, 6.0), "RADIATION");
        consider(
          norm(Math.max(s.pumpAHeat, s.pumpBHeat), 55, 88) * 0.9,
          "PUMP BEARING",
        );
      } else if (unitCode === "C") {
        const bat = s.batteryStoredPct;
        const batScore =
          bat >= 55
            ? 0
            : bat >= 35
              ? THREE.MathUtils.lerp(0.45, 0, (bat - 35) / 20)
              : bat >= 20
                ? THREE.MathUtils.lerp(0.75, 0.45, (bat - 20) / 15)
                : bat > 10
                  ? THREE.MathUtils.lerp(1.0, 0.75, (bat - 10) / 10)
                  : 1.0;
        consider(batScore, "LOW BATTERY");
        const drainMW = Math.max(0, s.totalElectricalMW - s.energyCreatedMW);
        const drainScore =
          drainMW <= 0
            ? 0
            : drainMW <= 150
              ? (drainMW / 150) * 0.65
              : drainMW < 300
                ? 0.65 + ((drainMW - 150) / 150) * 0.25
                : 0.9;
        consider(drainScore, "BAT DRAINING");
        if (s.tutorialPhase === "COMPLETED") {
          consider(
            norm(Math.abs(s.totalElectricalMW - s.energyDemandMW), 25, 110),
            "GRID DEFICIT",
          );
        }
        if (s.isBlackout) {
          consider(1.0, "BUS BLACKOUT");
        }
      } else {
        if (s.turbines[0]?.tripped) {
          consider(1.0, "TURBINE TRIP");
        }
        consider(norm(s.drumPressure, 72, 86), "STEAM BAR");
        if (s.steamDumpValve) {
          consider(0.55, "STEAM DUMP");
        }
        if (s.isBlackout) {
          consider(1.0, "BUS BLACKOUT");
        }
      }

      const frameDt = Math.min(0.1, Math.max(0.001, delta));
      const lerpAlpha = 1 - Math.exp(-5.5 * frameDt);
      smoothSeverityRef.current = THREE.MathUtils.lerp(
        smoothSeverityRef.current,
        rawSeverity,
        lerpAlpha,
      );
      const severity = smoothSeverityRef.current;

      // 3. Drive 10-Segment Progressive Canopy Bar, Center Window & Roof Beacon
      const setBeaconState = (
        col: THREE.Color,
        emissiveCol: THREE.Color,
        intensity: number,
      ) => {
        for (let b = 0; b < 2; b++) {
          const bMat = beaconMatRefs.current[b];
          if (!bMat) continue;
          bMat.color.copy(col);
          bMat.emissive.copy(emissiveCol);
          bMat.emissiveIntensity = intensity;
        }
      };

      let bannerMode: CanopyBannerMode = "tier0";
      let bannerText = "SYSTEM NOMINAL";

      if (isTutorialTarget) {
        const tutWave = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 2.6);
        CANOPY_SCRATCH_COL.lerpColors(
          CANOPY_COL_CHERENKOV_LO,
          CANOPY_COL_CHERENKOV_HI,
          tutWave,
        );
        const tutEmissive = 0.7 + tutWave * 1.6;
        for (let i = 0; i < 10; i++) {
          const mat = alarmBarMatRefs.current[i];
          if (!mat) continue;
          mat.color.copy(CANOPY_SCRATCH_COL);
          mat.emissive.copy(CANOPY_SCRATCH_COL);
          mat.emissiveIntensity = tutEmissive;
        }
        setBeaconState(CANOPY_SCRATCH_COL, CANOPY_SCRATCH_COL, tutEmissive);

        bannerMode = "tutorial";
        bannerText = "★ STARTUP HERE ★";
        if (centerWindowMatRef.current) {
          centerWindowMatRef.current.emissive.lerpColors(
            CANOPY_COL_CHERENKOV_HI,
            CANOPY_COL_WHITE,
            0.45,
          );
          centerWindowMatRef.current.emissiveIntensity = tutEmissive;
        }
      } else if (s.isBlackout && unitCode !== "C") {
        for (let i = 0; i < 10; i++) {
          const mat = alarmBarMatRefs.current[i];
          if (!mat) continue;
          mat.color.copy(CANOPY_COL_DARK);
          mat.emissive.copy(CANOPY_COL_DARK_EM);
          mat.emissiveIntensity = 0.04;
        }
        setBeaconState(CANOPY_COL_DARK, CANOPY_COL_DARK_EM, 0.04);

        bannerMode = "blackout";
        bannerText = "BUS BLACKOUT";
        if (centerWindowMatRef.current) {
          centerWindowMatRef.current.emissive.copy(CANOPY_COL_WHITE);
          centerWindowMatRef.current.emissiveIntensity = 0.08;
        }
      } else {
        let litCount = 2;
        if (severity < 0.2) {
          litCount = 2;
          bannerMode = "tier0";
          bannerText = "SYSTEM NOMINAL";
          for (let i = 0; i < 10; i++) {
            const mat = alarmBarMatRefs.current[i];
            if (!mat) continue;
            if (i < litCount) {
              mat.color.copy(CANOPY_COL_GREEN);
              mat.emissive.copy(CANOPY_COL_GREEN);
              mat.emissiveIntensity = 0.75;
            } else {
              mat.color.copy(CANOPY_COL_DARK);
              mat.emissive.copy(CANOPY_COL_DARK_EM);
              mat.emissiveIntensity = 0.04;
            }
          }
          setBeaconState(CANOPY_COL_GREEN_DIM, CANOPY_COL_GREEN, 0.42);
          if (centerWindowMatRef.current) {
            centerWindowMatRef.current.emissive.copy(CANOPY_COL_WHITE);
            centerWindowMatRef.current.emissiveIntensity = 0.72;
          }
        } else if (severity < 0.45) {
          const t1 = (severity - 0.2) / 0.25;
          litCount = 3 + Math.min(2, Math.floor(t1 * 3));
          bannerMode = "tier1";
          bannerText = `DRIFT: ${culpritTag}`;
          const pulse08 = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.8);
          const emissiveInt = 0.65 + 0.45 * pulse08;
          const denom = Math.max(1, litCount - 1);
          for (let i = 0; i < 10; i++) {
            const mat = alarmBarMatRefs.current[i];
            if (!mat) continue;
            if (i < litCount) {
              const mix1 = THREE.MathUtils.clamp(
                t1 * 0.6 + (i / denom) * 0.4,
                0,
                1,
              );
              CANOPY_SCRATCH_COL.lerpColors(
                CANOPY_COL_YELGREEN,
                CANOPY_COL_YELLOW,
                mix1,
              );
              mat.color.copy(CANOPY_SCRATCH_COL);
              mat.emissive.copy(CANOPY_SCRATCH_COL);
              mat.emissiveIntensity = emissiveInt;
            } else {
              mat.color.copy(CANOPY_COL_DARK);
              mat.emissive.copy(CANOPY_COL_DARK_EM);
              mat.emissiveIntensity = 0.04;
            }
          }
          CANOPY_SCRATCH_COL.lerpColors(
            CANOPY_COL_YELGREEN,
            CANOPY_COL_YELLOW,
            t1,
          );
          setBeaconState(
            CANOPY_SCRATCH_COL,
            CANOPY_SCRATCH_COL,
            0.55 + 0.6 * pulse08,
          );
          if (centerWindowMatRef.current) {
            centerWindowMatRef.current.emissive.copy(CANOPY_COL_WHITE);
            centerWindowMatRef.current.emissiveIntensity = 0.8 + 0.25 * pulse08;
          }
        } else if (severity < 0.7) {
          const t2 = (severity - 0.45) / 0.25;
          litCount = 6 + Math.min(1, Math.floor(t2 * 2));
          bannerMode = "tier2";
          bannerText = `WARN: ${culpritTag}`;
          const pulse15 = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 1.5);
          const emissiveInt = 0.65 + 0.85 * pulse15;
          const denom = Math.max(1, litCount - 1);
          for (let i = 0; i < 10; i++) {
            const mat = alarmBarMatRefs.current[i];
            if (!mat) continue;
            if (i < litCount) {
              const mix2 = THREE.MathUtils.clamp(
                t2 * 0.6 + (i / denom) * 0.4,
                0,
                1,
              );
              CANOPY_SCRATCH_COL.lerpColors(
                CANOPY_COL_YELLOW,
                CANOPY_COL_AMBER,
                mix2,
              );
              mat.color.copy(CANOPY_SCRATCH_COL);
              mat.emissive.copy(CANOPY_SCRATCH_COL);
              mat.emissiveIntensity = emissiveInt;
            } else {
              mat.color.copy(CANOPY_COL_DARK);
              mat.emissive.copy(CANOPY_COL_DARK_EM);
              mat.emissiveIntensity = 0.04;
            }
          }
          CANOPY_SCRATCH_COL.lerpColors(
            CANOPY_COL_YELLOW,
            CANOPY_COL_AMBER,
            t2,
          );
          setBeaconState(
            CANOPY_SCRATCH_COL,
            CANOPY_SCRATCH_COL,
            0.65 + 0.95 * pulse15,
          );
          if (centerWindowMatRef.current) {
            centerWindowMatRef.current.emissive.copy(CANOPY_COL_WHITE);
            centerWindowMatRef.current.emissiveIntensity = 0.85 + 0.35 * pulse15;
          }
        } else if (severity < 0.9) {
          const t3 = (severity - 0.7) / 0.2;
          litCount = 8 + Math.min(1, Math.floor(t3 * 2));
          bannerMode = "tier3";
          bannerText = `DANGER: ${culpritTag}`;
          const pulse25 = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 2.5);
          const emissiveInt = 0.55 + 1.35 * pulse25;
          const denom = Math.max(1, litCount - 1);
          for (let i = 0; i < 10; i++) {
            const mat = alarmBarMatRefs.current[i];
            if (!mat) continue;
            if (i < litCount) {
              const mix3 = THREE.MathUtils.clamp(
                t3 * 0.6 + (i / denom) * 0.4,
                0,
                1,
              );
              CANOPY_SCRATCH_COL.lerpColors(
                CANOPY_COL_AMBER,
                CANOPY_COL_REDORANGE,
                mix3,
              );
              mat.color.copy(CANOPY_SCRATCH_COL);
              mat.emissive.copy(CANOPY_SCRATCH_COL);
              mat.emissiveIntensity = emissiveInt;
            } else {
              mat.color.copy(CANOPY_COL_DARK);
              mat.emissive.copy(CANOPY_COL_DARK_EM);
              mat.emissiveIntensity = 0.04;
            }
          }
          CANOPY_SCRATCH_COL.lerpColors(
            CANOPY_COL_AMBER,
            CANOPY_COL_REDORANGE,
            0.5 + 0.5 * t3,
          );
          setBeaconState(
            CANOPY_SCRATCH_COL,
            CANOPY_SCRATCH_COL,
            0.6 + 1.45 * pulse25,
          );
          if (centerWindowMatRef.current) {
            centerWindowMatRef.current.emissive.copy(CANOPY_COL_WHITE);
            centerWindowMatRef.current.emissiveIntensity = 0.9 + 0.45 * pulse25;
          }
        } else {
          litCount = 10;
          bannerMode = "tier4";
          bannerText = `! ALARM: ${culpritTag} !`;
          const strobeOn = Math.sin(t * Math.PI * 2 * 4.2) > 0;
          const emissiveInt = strobeOn ? 2.5 : 0.35;
          for (let i = 0; i < 10; i++) {
            const mat = alarmBarMatRefs.current[i];
            if (!mat) continue;
            mat.color.copy(
              strobeOn ? CANOPY_COL_CRIMSON : CANOPY_COL_CRIMSON_DIM,
            );
            mat.emissive.copy(CANOPY_COL_CRIMSON);
            mat.emissiveIntensity = emissiveInt;
          }
          setBeaconState(
            strobeOn ? CANOPY_COL_CRIMSON : CANOPY_COL_CRIMSON_DIM,
            CANOPY_COL_CRIMSON,
            strobeOn ? 2.6 : 0.3,
          );
          if (centerWindowMatRef.current) {
            centerWindowMatRef.current.emissive.copy(CANOPY_COL_WHITE);
            centerWindowMatRef.current.emissiveIntensity = strobeOn
              ? 1.55
              : 0.55;
          }
        }
      }

      const centerSig = `${canopyFontGen}|${bannerMode}|${bannerText}`;
      const winTex = centerWindowMatRef.current?.map as
        | THREE.CanvasTexture
        | undefined;
      if (winTex && centerSig !== lastCenterSigRef.current) {
        lastCenterSigRef.current = centerSig;
        const canvas = winTex.image as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          paintCanopyStatusWindow(
            ctx,
            canvas.width,
            canvas.height,
            bannerMode,
            bannerText,
          );
          winTex.needsUpdate = true;
        }
      }

      // Live scrolling KSP-4 Paper Strip-Chart Recorder traces (shared across cabinets, <=5 Hz, quantized dirty-check, paused when hidden or diagFeed)
      const ksp4TexPair = ksp4ChartTexturesRef.current;
      if (!hideChartRecorders && ksp4TexPair && !s.diagFeedActive) {
        if (t < SHARED_KSP4_STATE.lastSampleTime) {
          SHARED_KSP4_STATE.lastSampleTime = -1;
        }
        if (
          t !== SHARED_KSP4_STATE.lastSampleTime &&
          (SHARED_KSP4_STATE.lastSampleTime < 0 ||
            t - SHARED_KSP4_STATE.lastSampleTime >= 0.2)
        ) {
          SHARED_KSP4_STATE.lastSampleTime = t;
          const r0 = THREE.MathUtils.clamp(s.pressureBar / 80, 0.04, 0.96);
          const b0 = THREE.MathUtils.clamp((s.coreTemp - 200) / 700, 0.04, 0.96);
          const r1 = THREE.MathUtils.clamp(s.batteryStoredPct / 100, 0.04, 0.96);
          const b1 = THREE.MathUtils.clamp(s.totalElectricalMW / 900, 0.04, 0.96);

          SHARED_KSP4_STATE.red0.unshift(r0);
          if (SHARED_KSP4_STATE.red0.length > 55) SHARED_KSP4_STATE.red0.pop();
          SHARED_KSP4_STATE.blue0.unshift(b0);
          if (SHARED_KSP4_STATE.blue0.length > 55) SHARED_KSP4_STATE.blue0.pop();
          SHARED_KSP4_STATE.red1.unshift(r1);
          if (SHARED_KSP4_STATE.red1.length > 55) SHARED_KSP4_STATE.red1.pop();
          SHARED_KSP4_STATE.blue1.unshift(b1);
          if (SHARED_KSP4_STATE.blue1.length > 55) SHARED_KSP4_STATE.blue1.pop();

          let sig0 = "";
          let sig1 = "";
          for (let i = 0; i < SHARED_KSP4_STATE.red0.length; i++) {
            sig0 += `${Math.round(SHARED_KSP4_STATE.red0[i] * 80)},${Math.round(SHARED_KSP4_STATE.blue0[i] * 80)};`;
            sig1 += `${Math.round(SHARED_KSP4_STATE.red1[i] * 80)},${Math.round(SHARED_KSP4_STATE.blue1[i] * 80)};`;
          }

          if (sig0 !== SHARED_KSP4_STATE.lastSig0) {
            SHARED_KSP4_STATE.lastSig0 = sig0;
            const tex = ksp4TexPair[0];
            const canvas = tex.image as HTMLCanvasElement;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              paintKsp4Chart(
                ctx,
                canvas.width,
                canvas.height,
                SHARED_KSP4_STATE.red0,
                SHARED_KSP4_STATE.blue0,
                "KSP-4 // BAR & MW",
              );
              tex.needsUpdate = true;
            }
          }
          if (sig1 !== SHARED_KSP4_STATE.lastSig1) {
            SHARED_KSP4_STATE.lastSig1 = sig1;
            const tex = ksp4TexPair[1];
            const canvas = tex.image as HTMLCanvasElement;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              paintKsp4Chart(
                ctx,
                canvas.width,
                canvas.height,
                SHARED_KSP4_STATE.red1,
                SHARED_KSP4_STATE.blue1,
                "KSP-4 // GRID 50HZ",
              );
              tex.needsUpdate = true;
            }
          }
        }
      }

      // Spring-damper inertia + high-frequency mechanical vibration on the 8 M381 horizontal strip meters
      const dt = 0.016;
      const transientSeverity = Math.max(
        Math.abs(s.gridTransientImpulse) * 1.4,
        Math.abs(s.steamTransientImpulse) / 10,
        Math.abs(s.gridHz - 50) * 1.1,
      );
      const targets = [
        THREE.MathUtils.clamp(s.pressureBar / 80, 0.05, 0.95),
        THREE.MathUtils.clamp((s.coreTemp - 200) / 700, 0.05, 0.95),
        THREE.MathUtils.clamp(s.coolantFlow / 1.15, 0.05, 0.95),
        THREE.MathUtils.clamp((s.gridHz - 47.5) / 5.0, 0.05, 0.95),
        THREE.MathUtils.clamp(s.totalElectricalMW / 900, 0.05, 0.95),
        THREE.MathUtils.clamp((s.graphiteTemp - 100) / 600, 0.05, 0.95),
        THREE.MathUtils.clamp(s.heliumPressure / 80, 0.05, 0.95),
        THREE.MathUtils.clamp(s.bubblerLevel / 100, 0.05, 0.95),
      ];
      const maxSpanX = (width > 1.8 ? 0.22 : 0.165) - 0.032;
      for (let m = 0; m < 8; m++) {
        const needle = m381NeedleRefs.current[m];
        if (!needle) continue;
        const tgt = s.isBlackout ? 0.04 : targets[m];
        const cur = m381PosRefs.current[m];
        let vel = m381VelRefs.current[m];
        const isOutNominal = cur > 0.72 || cur < 0.2 || transientSeverity > 0.12;
        if (!isOutNominal && Math.abs(tgt - cur) < 0.0015 && Math.abs(vel) < 0.005) {
          m381PosRefs.current[m] = tgt;
          m381VelRefs.current[m] = 0;
          needle.position.x = (tgt - 0.5) * maxSpanX;
          continue;
        }
        const accel = (tgt - cur) * 175.0 - vel * 12.5;
        vel += accel * dt;
        const nextPos = THREE.MathUtils.clamp(cur + vel * dt, 0.03, 0.97);
        m381PosRefs.current[m] = nextPos;
        m381VelRefs.current[m] = vel;

        const nextOutNominal =
          nextPos > 0.72 || nextPos < 0.2 || transientSeverity > 0.12;
        const vib = nextOutNominal
          ? (Math.sin(t * 138.0 + m * 1.9) * 0.65 +
              Math.cos(t * 176.0 + m * 2.7) * 0.35) *
            0.014 *
            Math.max(0.35, Math.min(1.5, transientSeverity))
          : 0;
        needle.position.x = (nextPos - 0.5 + vib) * maxSpanX;
      }
    });

    const stencilPlaqueTex = useMemo(
      () =>
        createCrispPanelTexture(512, 96, (ctx, w, h) => {
          ctx.fillStyle = "#53635b";
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = "#394640";
          ctx.lineWidth = 4;
          ctx.strokeRect(3, 3, w - 6, h - 6);
          // Yellow GOST Stencil Box (as seen in real Soviet control room pedestals: I&C / MCR-4 / 65A)
          ctx.strokeStyle = "#e6b828";
          ctx.lineWidth = 3;
          ctx.strokeRect(18, 14, 176, h - 28);
          ctx.beginPath();
          ctx.moveTo(18, h / 2);
          ctx.lineTo(194, h / 2);
          ctx.moveTo(106, h / 2);
          ctx.lineTo(106, h - 14);
          ctx.stroke();
          ctx.fillStyle = "#f2c938";
          ctx.font = '900 18px "Kremlin", "Consolas", monospace';
          ctx.textAlign = "center";
          ctx.fillText("I&C • MCR-4", 106, 39, 168);
          ctx.font = '900 18px "Kremlin", "Consolas", monospace';
          ctx.fillText(`U-${unitCode}`, 62, 73, 80);
          ctx.fillText("65A", 150, 73, 80);

          ctx.fillStyle = "#d8e0dc";
          ctx.font = '900 18px "Kremlin", "Consolas", monospace';
          ctx.textAlign = "left";
          ctx.fillText(`CONSOLE BAY NO. 84-${unitCode}`, 216, 42, w - 232);
          ctx.fillStyle = "#e6b828";
          ctx.font = '700 15px "Kremlin", "VT323", monospace';
          ctx.fillText("GOST 26011-84 • USSR MINENERGO", 216, 70, w - 232);
        }),
      [unitCode],
    );

    const m381ScaleTex = useMemo(
      () =>
        createCrispPanelTexture(256, 64, (ctx, w, h) => {
          ctx.fillStyle = "#f4f0e2";
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = "#262a28";
          ctx.lineWidth = 4;
          ctx.strokeRect(2, 2, w - 4, h - 4);
          // Green nominal band & red high band
          ctx.fillStyle = "#268a48";
          ctx.fillRect(48, 10, 128, 7);
          ctx.fillStyle = "#c82820";
          ctx.fillRect(176, 10, 64, 7);
          // Fine graduation ticks
          ctx.strokeStyle = "#141615";
          for (let i = 0; i <= 20; i++) {
            const tx = 16 + (i / 20) * (w - 32);
            const isMaj = i % 5 === 0;
            ctx.lineWidth = isMaj ? 2.5 : 1.2;
            ctx.beginPath();
            ctx.moveTo(tx, 18);
            ctx.lineTo(tx, isMaj ? 36 : 28);
            ctx.stroke();
          }
          ctx.fillStyle = "#141615";
          ctx.font = '900 15px "Consolas", sans-serif';
          ctx.textAlign = "center";
          ctx.fillText("0", 22, 53);
          ctx.fillText("50", w / 2, 53);
          ctx.fillText("100", w - 26, 53);
        }),
      [],
    );

    const halfW = width / 2;
    const plateW = width - 0.08;
    const subPlateHalfW = (plateW - 0.016) / 2;
    const subPlateX = subPlateHalfW / 2 + 0.004;
    const recorderX = width > 1.8 ? 0.30 : 0.255;
    const recorderW = width > 1.8 ? 0.148 : 0.106;
    const stripMeterBankX = width > 1.8 ? 0.765 : 0.675;
    const stripMeterW = width > 1.8 ? 0.22 : 0.165;
    const canopyInnerW = width - 0.1;
    const centerWinW = canopyInnerW * 0.38;
    const barGap = 0.024;
    const sideBayW = (canopyInnerW - centerWinW - barGap * 2) / 2;
    const segGap = 0.009;
    const segW = (sideBayW - segGap * 4) / 5;
    const segH = 0.084;
    const canopyBarSlots = useMemo(() => {
      const slots: Array<{ key: string; x: number; idx: number }> = [];
      for (let slot = 0; slot < 5; slot++) {
        slots.push({
          key: `l-${slot}`,
          x: -canopyInnerW / 2 + segW / 2 + slot * (segW + segGap),
          idx: slot * 2,
        });
        slots.push({
          key: `r-${slot}`,
          x: canopyInnerW / 2 - segW / 2 - slot * (segW + segGap),
          idx: slot * 2 + 1,
        });
      }
      return slots;
    }, [canopyInnerW, segW]);

    return (
      <group ref={cabinetRootRef}>
        {/* ================================================================
            TIER 3: TALL UPPER SYNOPTIC WALL (`y: 1.63m -> 2.46m`, `z: 0.0m`)
            Authentic Soviet Light Sage-Grey Frame (`#7e9087`) + Deep Slate-Blue
            Synoptic Board (`#2c4a63`), 2 Glass-Front Paper Strip-Chart Recorders
            (KSP-4), Synoptic Channel Tags & Forward-Leaning Annunciator Overhang
           ================================================================ */}
        {/* Deep Structural Steel Back-Cabinet (`#4a5852`) */}
        <mesh position={[0, 1.22, -0.18]} castShadow receiveShadow>
          <boxGeometry args={[width + 0.04, 2.44, 0.34]} />
          <meshStandardMaterial
            color="#4a5852"
            roughness={0.48}
            metalness={0.38}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>

        {unifiedUpperFace ? (
          <>
            {/* Unified Vertical Upper Enamel Frame (`#7e9087` Light Industrial Sage-Grey, y: 1.26..2.28) */}
            <mesh position={[0, 1.77, -0.004]} castShadow receiveShadow>
              <boxGeometry args={[width, 1.02, 0.036]} />
              <meshStandardMaterial
                color="#7e9087"
                roughness={0.42}
                metalness={0.3}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>

            {/* Unified Upper Synoptic Slate-Blue Faceplates (`#2c4a63`) */}
            {[-subPlateX, subPlateX].map((px, idx) => (
              <mesh
                key={`ugp-uni-${idx}`}
                position={[px, 1.76, 0.012]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[subPlateHalfW, 0.94, 0.016]} />
                <meshStandardMaterial
                  color="#2c4a63"
                  roughness={0.44}
                  metalness={0.24}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.004}
                />
              </mesh>
            ))}

            {/* Structural Transition Apron Bridging Vertical Riser to Top of Sloped Desk */}
            <mesh position={[0, 1.285, 0.026]} castShadow receiveShadow>
              <boxGeometry args={[width, 0.045, 0.056]} />
              <meshStandardMaterial
                color="#5a6b63"
                roughness={0.44}
                metalness={0.36}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
          </>
        ) : (
          <>
            {/* Upper Cabinet Outer Enamel Frame (`#7e9087` Light Industrial Sage-Grey) */}
            <mesh position={[0, 1.96, -0.004]} castShadow receiveShadow>
              <boxGeometry args={[width, 0.68, 0.036]} />
              <meshStandardMaterial
                color="#7e9087"
                roughness={0.42}
                metalness={0.3}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>

            {/* Upper Synoptic Slate-Blue Faceplates (`#2c4a63` — Iconic Soviet Mnemoscheme Blue) */}
            {[-subPlateX, subPlateX].map((px, idx) => (
              <mesh
                key={`ugp-${idx}`}
                position={[px, 1.94, 0.012]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[subPlateHalfW, 0.60, 0.016]} />
                <meshStandardMaterial
                  color="#2c4a63"
                  roughness={0.44}
                  metalness={0.24}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.004}
                />
              </mesh>
            ))}

            {/* Dense Synoptic Channel/Valve Matrix Tags Along Upper Board (`y = 2.015m`) */}
            {Array.from({ length: 12 }).map((_, tIdx) => {
              const tx = -plateW * 0.44 + (tIdx / 11) * (plateW * 0.88);
              const isLit = tIdx % 3 === 0;
              const isWarn = tIdx === 4 || tIdx === 8;
              return (
                <mesh key={`syn-tag-${tIdx}`} position={[tx, 2.015, 0.026]}>
                  <boxGeometry args={[0.056, 0.022, 0.005]} />
                  <meshStandardMaterial
                    color={isWarn ? "#ffe088" : "#f0ece0"}
                    emissive={isWarn ? "#ffaa00" : isLit ? "#fff6d6" : "#000000"}
                    emissiveIntensity={isWarn ? 0.55 : isLit ? 0.32 : 0}
                    roughness={0.32}
                  />
                </mesh>
              );
            })}

            {/* 2 Physical 3D Glass-Front Paper Strip-Chart Recorders (KSP-4)
                Mounted cleanly in the gaps between the 3 circular manometer gauges (`x = ±recorderX, y = 1.78m`) */}
            {!hideChartRecorders &&
              ksp4ChartTextures &&
              [-recorderX, recorderX].map((rx, rIdx) => (
                <group key={`ksp4-${rIdx}`} position={[rx, 1.78, 0.032]}>
                  {/* Dark Charcoal Steel KSP-4 Bezel Casing (`#222826`) */}
                  <mesh>
                    <boxGeometry args={[recorderW, 0.228, 0.022]} />
                    <meshStandardMaterial
                      color="#222826"
                      roughness={0.42}
                      metalness={0.55}
                    />
                  </mesh>
                  {/* Cream-White Paper Roll & Dual Red/Blue Ink Trace Curve (`#f4f1e6`) */}
                  <mesh position={[0, -0.004, 0.013]}>
                    <planeGeometry args={[recorderW - 0.018, 0.198]} />
                    <meshStandardMaterial
                      map={ksp4ChartTextures[rIdx]}
                      emissive="#ffffff"
                      emissiveMap={ksp4ChartTextures[rIdx]}
                      emissiveIntensity={0.22}
                      roughness={0.55}
                      polygonOffset
                      polygonOffsetFactor={-2}
                      polygonOffsetUnits={-2}
                    />
                  </mesh>
                  {/* Cylindrical Paper Roll Drum at Bottom of Recorder Window */}
                  <mesh
                    position={[0, -0.092, 0.016]}
                    rotation={[0, 0, Math.PI / 2]}
                  >
                    <cylinderGeometry args={[0.012, 0.012, recorderW - 0.02, 12]} />
                    <meshStandardMaterial color="#f0ede2" roughness={0.5} />
                  </mesh>
                  {/* Protective Glass Window Front */}
                  <mesh position={[0, 0, 0.018]}>
                    <planeGeometry args={[recorderW - 0.014, 0.204]} />
                    <meshBasicMaterial
                      color="#dff4ff"
                      transparent
                      opacity={0.12}
                      depthWrite={false}
                    />
                  </mesh>
                </group>
              ))}
          </>
        )}

        {/* Upper Forward-Leaning Progressive Alarm & Startup Beacon Canopy Overhang (`#7e9087` Light Sage-Grey) */}
        <group position={[0, 2.305, 0.062]} rotation={[0.18, 0, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[width + 0.02, 0.16, 0.13]} />
            <meshStandardMaterial
              color="#7e9087"
              roughness={0.42}
              metalness={0.32}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          {/* Dark Recessed Annunciator Trough */}
          <mesh position={[0, -0.004, 0.061]}>
            <boxGeometry args={[width - 0.07, 0.114, 0.012]} />
            <meshStandardMaterial
              color="#18201e"
              roughness={0.68}
              metalness={0.45}
            />
          </mesh>
          {/* Top & Bottom Brushed Steel Canopy Trim Bars */}
          {[0.07, -0.07].map((cy, cIdx) => (
            <mesh key={`can-trim-${cIdx}`} position={[0, cy, 0.068]} castShadow>
              <boxGeometry args={[width + 0.026, 0.016, 0.018]} />
              <meshStandardMaterial
                color="#4a5852"
                metalness={0.62}
                roughness={0.36}
              />
            </mesh>
          ))}

          {/* Left & Right 5-Segment Progressive Ribbed Glass Light Bars (10 Blocks Total) */}
          {canopyBarSlots.map((slot) => (
            <group key={`alarm-seg-${slot.key}`} position={[slot.x, -0.004, 0.068]}>
              <mesh raycast={NOOP_RAYCAST}>
                <boxGeometry args={[segW + 0.005, segH + 0.006, 0.012]} />
                <meshStandardMaterial
                  color="#222b28"
                  metalness={0.68}
                  roughness={0.36}
                />
              </mesh>
              <mesh position={[0, 0, 0.006]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[segW - 0.002, segH - 0.004, 0.011]} />
                <meshStandardMaterial
                  ref={(el) => {
                    alarmBarMatRefs.current[slot.idx] = el;
                  }}
                  map={ribbedGlassTex}
                  color="#111915"
                  emissive="#090f0c"
                  emissiveMap={ribbedGlassTex}
                  emissiveIntensity={0.04}
                  roughness={0.24}
                  metalness={0.1}
                />
              </mesh>
            </group>
          ))}

          {/* Center Crisp Kremlin Status Window */}
          <group position={[0, -0.004, 0.07]}>
            <mesh raycast={NOOP_RAYCAST}>
              <boxGeometry args={[centerWinW + 0.014, 0.096, 0.014]} />
              <meshStandardMaterial
                color="#26302d"
                metalness={0.7}
                roughness={0.36}
              />
            </mesh>
            {[0.047, -0.047].map((by, bIdx) => (
              <mesh key={`cw-brass-${bIdx}`} position={[0, by, 0.007]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[centerWinW + 0.004, 0.005, 0.004]} />
                <meshStandardMaterial
                  color="#b8a46b"
                  metalness={0.86}
                  roughness={0.28}
                  bumpMap={brassTex.bumpMap}
                  bumpScale={0.004}
                />
              </mesh>
            ))}
            <mesh position={[0, 0, 0.0085]} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[centerWinW - 0.004, 0.082]} />
              <meshStandardMaterial
                ref={centerWindowMatRef}
                map={centerWindowTex}
                emissive="#ffffff"
                emissiveMap={centerWindowTex}
                emissiveIntensity={0.72}
                roughness={0.28}
                metalness={0.08}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
          </group>

          {/* 3D Caged Roof Strobe Beacon (Centered at x=0, clear of ±0.48/±0.58 work-lamps, zero PointLights) */}
          <group position={[0, 0.095, 0.005]} rotation={[-0.18, 0, 0]}>
            <mesh position={[0, -0.01, 0]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.046, 0.054, 0.028, 12]} />
              <meshStandardMaterial
                color="#242c29"
                metalness={0.72}
                roughness={0.4}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
            <mesh position={[0, 0.009, 0]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.042, 0.044, 0.012, 12]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.85}
                roughness={0.28}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
            <mesh position={[0, 0.038, 0]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.034, 0.037, 0.048, 12]} />
              <meshStandardMaterial
                ref={(el) => {
                  beaconMatRefs.current[0] = el;
                }}
                color="#196b38"
                emissive="#24e068"
                emissiveIntensity={0.42}
                roughness={0.18}
                metalness={0.08}
              />
            </mesh>
            <mesh position={[0, 0.062, 0]} raycast={NOOP_RAYCAST}>
              <sphereGeometry
                args={[0.034, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]}
              />
              <meshStandardMaterial
                ref={(el) => {
                  beaconMatRefs.current[1] = el;
                }}
                color="#196b38"
                emissive="#24e068"
                emissiveIntensity={0.42}
                roughness={0.18}
                metalness={0.08}
              />
            </mesh>
            {[0, Math.PI / 2].map((rotY, aIdx) => (
              <mesh
                key={`beacon-arch-${aIdx}`}
                position={[0, 0.055, 0]}
                rotation={[0, rotY, 0]}
                raycast={NOOP_RAYCAST}
              >
                <torusGeometry args={[0.043, 0.0032, 6, 16, Math.PI]} />
                <meshStandardMaterial
                  color="#9e8b56"
                  metalness={0.86}
                  roughness={0.28}
                />
              </mesh>
            ))}
            <mesh
              position={[0, 0.044, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
            >
              <torusGeometry args={[0.043, 0.003, 6, 16]} />
              <meshStandardMaterial
                color="#9e8b56"
                metalness={0.86}
                roughness={0.28}
              />
            </mesh>
            <mesh position={[0, 0.098, 0]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.009, 0.011, 0.008, 6]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.88}
                roughness={0.24}
              />
            </mesh>
          </group>
        </group>

        {/* ================================================================
            TIER 2: ANGLED MID-RISER INSTRUMENT BAY (`y: 1.28m -> 1.63m`)
            Light Sage-Green/Grey Enamel (`#8ea296`) + Recessed CRT Surround
            + Flanking Stacks of Soviet Cream-White Horizontal Strip Meters (`M381`)
           ================================================================ */}
        {!unifiedUpperFace && (
          <group position={[0, 1.465, 0.032]} rotation={[-0.08, 0, 0]}>
            {/* Angled Light-Sage/Grey Instrument Riser Housing (`#8ea296`) */}
            <mesh position={[0, 0, -0.018]} castShadow receiveShadow>
              <boxGeometry args={[width, 0.36, 0.044]} />
              <meshStandardMaterial
                color="#8ea296"
                roughness={0.4}
                metalness={0.28}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
            {/* Recessed Dark 1980s Soviet CRT Monitor Bezel Cavity (`#1c2220`) */}
            <mesh position={[0, 0.0, 0.008]}>
              <boxGeometry args={[1.18, 0.296, 0.014]} />
              <meshStandardMaterial
                color="#1c2220"
                roughness={0.68}
                metalness={0.42}
              />
            </mesh>

            {/* Left & Right Stacks of 4 Soviet Cream-White Horizontal Edge-Wise Strip Meters (`M381`) */}
            {!hideStripMeters &&
              [-stripMeterBankX, stripMeterBankX].map((mx, sideIdx) => (
                <group key={`m381-stack-${sideIdx}`} position={[mx, -0.005, 0.012]}>
                  {/* Dark Recessed Mounting Frame behind the 4 Strip Meters */}
                  <mesh>
                    <boxGeometry args={[stripMeterW + 0.016, 0.276, 0.01]} />
                    <meshStandardMaterial color="#2a322f" roughness={0.55} />
                  </mesh>
                  {[-0.096, -0.032, 0.032, 0.096].map((my, mIdx) => (
                    <group key={`m381-${mIdx}`} position={[0, my, 0.011]}>
                      {/* Sculpted Cream-White (`#ece8d8`) Bakelite/Enamel Meter Bezel */}
                      <mesh castShadow receiveShadow>
                        <boxGeometry args={[stripMeterW, 0.054, 0.012]} />
                        <meshStandardMaterial
                          color="#ece8d8"
                          roughness={0.34}
                          metalness={0.12}
                        />
                      </mesh>
                      {/* Crisp Horizontal Scale Window with Red Pointer Needle */}
                      <mesh position={[0, 0, 0.0075]}>
                        <planeGeometry args={[stripMeterW - 0.018, 0.038]} />
                        <meshStandardMaterial
                          map={m381ScaleTex}
                          emissive="#ffffff"
                          emissiveMap={m381ScaleTex}
                          emissiveIntensity={0.25}
                          roughness={0.4}
                          polygonOffset
                          polygonOffsetFactor={-2}
                          polygonOffsetUnits={-2}
                        />
                      </mesh>
                      {/* Physical 3D Red Pointer Needle with Spring-Damper Overshoot & Micro-Jitter */}
                      <mesh
                        ref={(el) => {
                          m381NeedleRefs.current[sideIdx * 4 + mIdx] = el;
                        }}
                        position={[0, 0.002, 0.0105]}
                      >
                        <boxGeometry args={[0.0042, 0.031, 0.0018]} />
                        <meshStandardMaterial
                          color="#e82418"
                          emissive="#ff2a1a"
                          emissiveIntensity={0.55}
                          roughness={0.25}
                        />
                      </mesh>
                    </group>
                  ))}
                </group>
              ))}

            {/* Horizontal Row of Glowing Translucent White/Amber Rectangular Alarm Push-Lamps above Riser (`DRUM BAR`, `AZ-1`, `MCP PUMPS`) */}
            <group position={[0, 0.162, 0.012]}>
              {Array.from({ length: 8 }).map((_, lIdx) => {
                const lx = -plateW * 0.42 + (lIdx / 7) * (plateW * 0.84);
                const isAmber = lIdx === 1 || lIdx === 4 || lIdx === 6;
                return (
                  <group key={`riser-lamp-${lIdx}`} position={[lx, 0, 0]}>
                    <mesh>
                      <boxGeometry args={[0.135, 0.028, 0.01]} />
                      <meshStandardMaterial color="#ece8d8" roughness={0.35} />
                    </mesh>
                    <mesh position={[0, 0, 0.0068]}>
                      <planeGeometry args={[0.122, 0.019]} />
                      <meshStandardMaterial
                        color={isAmber ? "#ffd255" : "#f6f2e4"}
                        emissive={isAmber ? "#ffaa00" : "#fff4d2"}
                        emissiveIntensity={isAmber ? 0.65 : 0.42}
                        roughness={0.28}
                        polygonOffset
                        polygonOffsetFactor={-2}
                        polygonOffsetUnits={-2}
                      />
                    </mesh>
                  </group>
                );
              })}
            </group>
          </group>
        )}

        {/* ================================================================
            TIER 1: LOWER PROTRUDING SLOPED CONTROL DESK (`y: 0.0m -> 1.28m`, `z: 0.0m -> +0.52m`)
            1. Dark Recessed Floor Toe-Kick (`#161b19`)
            2. Heavy Sage-Grey Steel Console Pedestal Base (`#5a6b63`) with Yellow GOST Stencils (`I&C / MCR-4 / 65A`)
            3. Wide Sloped Operator Desk Surface (`#82988c` Light Soviet Sage-Green/Grey Enamel, tilted at `-23.27°` / `-0.406 rad`)
            4. Brushed Stainless/Chrome Front Armrest Edge Trim (`#c8d2ce`)
            5. Authentic Soviet Backlit Push-Button Clusters (Control Push-Buttons)
           ================================================================ */}
        {/* 1. Dark Recessed Floor Kick-Plate / Toe-Space (`y: 0.0m -> 0.085m`) */}
        <mesh position={[0, 0.042, 0.1]} castShadow receiveShadow>
          <boxGeometry args={[width - 0.02, 0.085, 0.5]} />
          <meshStandardMaterial
            color="#161b19"
            roughness={0.75}
            metalness={0.35}
          />
        </mesh>

        {/* 2. Heavy Steel Console Pedestal Base (`#5a6b63`) Supporting the Protruding Sloped Desk */}
        <mesh position={[0, 0.19, 0.22]} castShadow receiveShadow>
          <boxGeometry args={[width, 0.21, 0.54]} />
          <meshStandardMaterial
            color="#5a6b63"
            roughness={0.46}
            metalness={0.34}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        {/* Wedge Under-Support Body Filling the Space Beneath the Sloped Desk (`y: 0.28m -> 0.88m`) */}
        <mesh position={[0, 0.58, 0.16]} rotation={[-0.406, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[width - 0.01, 0.92, 0.34]} />
          <meshStandardMaterial
            color="#5a6b63"
            roughness={0.46}
            metalness={0.34}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        {/* Lower Pedestal Cabinet Access Door Seam & Yellow GOST Stencil Plaque (`I&C / MCR-4 / 65A`) */}
        <mesh position={[0, 0.19, 0.498]}>
          <boxGeometry args={[0.79, 0.154, 0.012]} />
          <meshStandardMaterial color="#3c4742" roughness={0.48} metalness={0.42} />
        </mesh>
        <mesh position={[0, 0.19, 0.506]}>
          <planeGeometry args={[0.78, 0.145]} />
          <meshStandardMaterial
            map={stencilPlaqueTex}
            roughness={0.48}
            metalness={0.22}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
        {[-plateW * 0.34, plateW * 0.34].map((dx, dIdx) => (
          <group key={`ped-door-${dIdx}`} position={[dx, 0.19, 0.498]}>
            <mesh>
              <boxGeometry args={[0.36, 0.16, 0.008]} />
              <meshStandardMaterial
                color="#52625a"
                roughness={0.45}
                metalness={0.36}
              />
            </mesh>
            {/* Chrome T-Handle Cabinet Latch */}
            <mesh position={[dIdx === 0 ? 0.13 : -0.13, 0, 0.009]} castShadow>
              <cylinderGeometry args={[0.012, 0.012, 0.012, 10]} />
              <meshStandardMaterial
                color="#d0dad6"
                metalness={0.88}
                roughness={0.2}
              />
            </mesh>
          </group>
        ))}

        {/* 3. Wide Sloped Operator Desk Surface (`y: 0.28m -> 1.28m`, `z: +0.48m` to `+0.05m`, tilted at `rotationX = -0.406 rad`)
               Painted in Authentic Light Soviet Sage-Green/Grey Enamel (`#82988c`, `roughness: 0.40`, `metalness: 0.28`) */}
        <group position={[0, 0.78, 0.265]} rotation={[-0.406, 0, 0]}>
          {/* Main Sloped Sage-Green Desk Bed (`#82988c`) */}
          <mesh position={[0, 0, -0.018]} castShadow receiveShadow>
            <boxGeometry args={[width, 1.09, 0.036]} />
            <meshStandardMaterial
              color="#82988c"
              roughness={0.4}
              metalness={0.28}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>

          {/* Bolted Modular Sage-Green Sub-Plates on the Sloped Desk (`#8ba195`) */}
          {[-subPlateX, subPlateX].map((px, idx) => (
            <mesh
              key={`desk-sub-${idx}`}
              position={[px, 0.02, 0.004]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[subPlateHalfW, 1.02, 0.008]} />
              <meshStandardMaterial
                color="#8ba195"
                roughness={0.38}
                metalness={0.26}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.003}
              />
            </mesh>
          ))}

          {/* Recessed Dark Shadow Wells behind Switch / Lever Banks on the Sloped Desk */}
          {recessedWells.map((well, wIdx) => {
            // Map vertical y into sloped desk local Y coordinate
            const localY = (well.y - 0.78) * 1.04;
            return (
              <mesh key={`well-${wIdx}`} position={[well.x, localY, 0.012]}>
                <boxGeometry args={[well.w, well.h, 0.008]} />
                <meshStandardMaterial
                  color="#1e2623"
                  roughness={0.68}
                  metalness={0.35}
                />
              </mesh>
            );
          })}

          {/* Authentic Soviet Backlit Push-Button Clusters (MCR Control Push-Buttons)
              Omitted on A, A2, B & C so interactive control assemblies and plaques have zero overlap! */}
          {(unitCode === "A" ||
          unitCode === "A2" ||
          unitCode === "B" ||
          unitCode === "C"
            ? ([] as number[])
            : [-plateW * 0.41, plateW * 0.41]
          ).map((clusterX, cIdx) => {
            const clusterY =
              unitCode === "A2" || unitCode === "B" ? -0.39 : 0.46;
            const cols = unitCode === "A2" || unitCode === "B" ? 6 : 4;
            const clusterW = cols * 0.044 + 0.036;
            return (
              <group
                key={`btn-cluster-${cIdx}`}
                position={[clusterX, clusterY, 0.014]}
              >
                {/* Recessed Dark Steel Switch Matrix Sub-Plate (`#222a27`) */}
                <mesh castShadow receiveShadow>
                  <boxGeometry args={[clusterW, 0.096, 0.01]} />
                  <meshStandardMaterial
                    color="#222a27"
                    roughness={0.48}
                    metalness={0.52}
                  />
                </mesh>
                {/* Cream-White Legend Strip above Keys */}
                <mesh position={[0, 0.034, 0.0075]}>
                  <boxGeometry args={[clusterW - 0.016, 0.014, 0.004]} />
                  <meshStandardMaterial color="#ece8d8" roughness={0.35} />
                </mesh>
                {/* 2 Rows of Translucent Backlit Soviet Square Keys */}
                {[-0.018, 0.008].map((ry, rIdx) =>
                  Array.from({ length: cols }).map((_, kIdx) => {
                    const kx =
                      -((cols - 1) * 0.044) / 2 + kIdx * 0.044;
                    const keyTone =
                      (kIdx + rIdx + cIdx) % 5 === 0
                        ? "#d84838"
                        : (kIdx + rIdx) % 3 === 0
                          ? "#ffcc44"
                          : (kIdx + cIdx) % 4 === 0
                            ? "#55bbaa"
                            : "#f4f0e0";
                    return (
                      <group key={`key-${rIdx}-${kIdx}`} position={[kx, ry, 0.008]}>
                        {/* Dark Bezel Collar */}
                        <mesh>
                          <boxGeometry args={[0.036, 0.022, 0.006]} />
                          <meshStandardMaterial color="#161a18" roughness={0.6} />
                        </mesh>
                        {/* Glowing Translucent Soviet Push-Button Cap */}
                        <mesh position={[0, 0, 0.006]} castShadow>
                          <boxGeometry args={[0.029, 0.017, 0.01]} />
                          <meshStandardMaterial
                            color={keyTone}
                            emissive={keyTone}
                            emissiveIntensity={0.48}
                            roughness={0.26}
                            metalness={0.08}
                          />
                        </mesh>
                      </group>
                    );
                  }),
                )}
              </group>
            );
          })}

          {/* 4. Brushed Stainless/Chrome Front Armrest Edge Trim (`#c8d2ce`) Along the Front Lip of the Sloped Desk */}
          <group position={[0, -0.535, 0.008]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[width + 0.03, 0.038, 0.044]} />
              <meshStandardMaterial
                color="#5a6b63"
                roughness={0.42}
                metalness={0.45}
              />
            </mesh>
            <mesh
              position={[0, -0.012, 0.022]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow
            >
              <cylinderGeometry args={[0.016, 0.016, width + 0.036, 14]} />
              <meshStandardMaterial
                color="#c8d2ce"
                metalness={0.86}
                roughness={0.2}
              />
            </mesh>
          </group>
        </group>

        {/* ================================================================
            L-SHAPED STEPPED STEEL SIDE CHEEKS & MOLDED TRANSITION TRIM
            (Suppressed on inner connected sides so `UNIT B + UNIT A-2 + UNIT A`
             flow as ONE unbroken horseshoe console!)
           ================================================================ */}
        {[-halfW - 0.012, halfW + 0.012]
          .filter((sx) => (sx < 0 ? !openLeftSide : !openRightSide))
          .map((sx, sIdx) => (
            <group key={`cheek-${sIdx}`}>
              {/* Upper Synoptic Wall Side Cheek (`#687a71`) */}
              <mesh position={[sx, 1.84, -0.04]} castShadow receiveShadow>
                <boxGeometry args={[0.042, 1.16, 0.18]} />
                <meshStandardMaterial
                  color="#687a71"
                  metalness={0.38}
                  roughness={0.42}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.005}
                />
              </mesh>
              {/* Sloped Desk Side Cheek Wing (`#687a71` with `#c8d2ce` top trim) */}
              <mesh
                position={[sx, 0.78, 0.23]}
                rotation={[-0.406, 0, 0]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[0.044, 1.10, 0.14]} />
                <meshStandardMaterial
                  color="#687a71"
                  metalness={0.38}
                  roughness={0.42}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.005}
                />
              </mesh>
              {/* Lower Pedestal Side Cheek (`#4d5c55`, clear of desk cheek & pedestal bounds) */}
              <mesh position={[sx, 0.242, 0.22]} castShadow receiveShadow>
                <boxGeometry args={[0.048, 0.476, 0.532]} />
                <meshStandardMaterial
                  color="#4d5c55"
                  metalness={0.42}
                  roughness={0.46}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.006}
                />
              </mesh>
              {/* Brass Side Cheek Hex Bolts */}
              {[0.28, 0.68, 1.08, 1.48, 1.88, 2.18].map((by, bIdx) => (
                <mesh
                  key={`sbolt-${bIdx}`}
                  position={[
                    sx,
                    by,
                    by < 1.28 ? 0.06 + (1.28 - by) * 0.42 : 0.044,
                  ]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <cylinderGeometry args={[0.0085, 0.0085, 0.012, 6]} />
                  <meshStandardMaterial
                    color="#b8a46b"
                    metalness={0.85}
                    roughness={0.28}
                    bumpMap={brassTex.bumpMap}
                    bumpScale={0.004}
                  />
                </mesh>
              ))}
            </group>
          ))}

        {/* Brushed Steel Horizontal Transition Trim Between Upper Synoptic Wall & Mid-Riser (`y = 1.638m`)
            and Between Mid-Riser & Sloped Control Desk (`y = 1.285m`) */}
        {(unifiedUpperFace
          ? [{ y: dividerY, z: 0.056 }]
          : [
              { y: 1.638, z: 0.028 },
              { y: dividerY, z: 0.056 },
            ]
        ).map((trim, tIdx) => (
          <group key={`h-trim-${tIdx}`} position={[0, trim.y, trim.z]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[width + 0.03, 0.02, 0.028]} />
              <meshStandardMaterial
                color="#5a6b63"
                metalness={0.52}
                roughness={0.36}
              />
            </mesh>
            <mesh position={[0, 0.006, 0.012]}>
              <boxGeometry args={[width + 0.02, 0.006, 0.008]} />
              <meshStandardMaterial
                color="#c8d2ce"
                metalness={0.85}
                roughness={0.22}
              />
            </mesh>
          </group>
        ))}

        {/* PHYSICAL 3D SYNOPTIC PROCESS FLOW LINES (MNEMOSCHEME)
            Upper segments sit flush on the `#2c4a63` synoptic wall (`z = 0.024m`),
            while lower segments (`y < 1.28m`) follow the exact `-23.27°` slope of the `#82988c` desk! */}
        <group>
          {mimicSegments.map((seg, idx) => {
            const isSloped = seg.y < 1.28;
            const segZ =
              seg.z ??
              (isSloped ? 0.058 + (1.28 - seg.y) * 0.43 : 0.027);
            const segRotX = isSloped ? -0.406 : 0;
            return (
              <group
                key={`mimic-seg-${idx}`}
                position={[seg.x, seg.y, segZ]}
                rotation={[segRotX, 0, 0]}
              >
                <mesh>
                  <boxGeometry args={[seg.w + 0.005, seg.h + 0.005, 0.003]} />
                  <meshStandardMaterial
                    color="#16222c"
                    roughness={0.65}
                    metalness={0.35}
                  />
                </mesh>
                <mesh position={[0, 0, 0.0022]}>
                  <boxGeometry args={[seg.w, seg.h, 0.004]} />
                  <meshStandardMaterial
                    color={seg.color}
                    emissive={seg.color}
                    emissiveIntensity={0.2}
                    roughness={0.34}
                    metalness={0.3}
                  />
                </mesh>
              </group>
            );
          })}
          {mimicNodes.map((node, nIdx) => {
            const isSloped = node.y < 1.28;
            const nodeZ =
              node.z ??
              (isSloped ? 0.061 + (1.28 - node.y) * 0.43 : 0.029);
            const nodeRotX = isSloped ? Math.PI / 2 - 0.406 : Math.PI / 2;
            return (
              <mesh
                key={`mimic-node-${nIdx}`}
                position={[node.x, node.y, nodeZ]}
                rotation={[nodeRotX, 0, 0]}
              >
                <cylinderGeometry args={[0.012, 0.014, 0.005, 8]} />
                <meshStandardMaterial
                  color={node.color}
                  emissive={node.color}
                  emissiveIntensity={0.24}
                  roughness={0.32}
                  metalness={0.4}
                />
              </mesh>
            );
          })}
        </group>
      </group>
    );
  },
);

/**
 * Authentic 1984 Soviet Phosphor-Green CRT Monitor Bay (ELECTRONIKA VL-84).
 * Features a deep molded Bakelite & cast-iron CRT bezel hood, recessed dark phosphor tube cavity,
 * CRT screen with oscilloscope graticule, scanlines & phosphor bloom, side contrast/vertical-hold
 * knurled knobs, and a glowing green filament indicator lamp.
 */
export const SovietCRTMonitorBay3D: React.FC<SovietCRTMonitorBay3DProps> = ({
  position,
  screenMatRef,
  screenTexture,
  modelBadge = "CRT VL-84",
}) => {
  const crtBayRootRef = useRef<THREE.Group>(null);
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  useEffect(() => {
    crtBayRootRef.current?.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.raycast = NOOP_RAYCAST;
        obj.castShadow = false;
        obj.receiveShadow = false;
      }
    });
  }, []);

  const badgeTex = useMemo(
    () =>
      createCrispPanelTexture(128, 36, (ctx, w, h) => {
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 14px "Kremlin", "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText(modelBadge, w / 2, 24, w - 12);
      }),
    [modelBadge],
  );

  return (
    <group ref={crtBayRootRef} position={position}>
      {/* 1. Deep Recessed CRT Tube Cavity Backing Plate (At z = 0.002 -> 24mm behind screen plane for zero Z-fighting!) */}
      <mesh position={[0, 0, 0.002]} castShadow receiveShadow>
        <boxGeometry args={[1.54, 0.285, 0.016]} />
        <meshStandardMaterial
          color="#0d1310"
          roughness={0.55}
          metalness={0.65}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
        />
      </mesh>

      {/* 2. Molded 4-Sided Thick Cast-Iron & Bakelite CRT Monitor Hood Bezel */}
      {/* Top & Bottom Hood Bars */}
      {[-0.128, 0.128].map((by, idx) => (
        <mesh key={`hb-${idx}`} position={[0, by, 0.028]} castShadow receiveShadow>
          <boxGeometry args={[1.56, 0.034, 0.044]} />
          <meshStandardMaterial
            color="#18221d"
            roughness={0.42}
            metalness={0.68}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
      ))}
      {/* Left Screen Bezel Wall */}
      <mesh position={[-0.755, 0, 0.028]} castShadow receiveShadow>
        <boxGeometry args={[0.05, 0.222, 0.044]} />
        <meshStandardMaterial
          color="#18221d"
          roughness={0.42}
          metalness={0.68}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
        />
      </mesh>
      {/* Right Wide CRT Control Side-Strip (Houses Contrast/Brightness Knobs & Power Lamp) */}
      <mesh position={[0.7, 0, 0.028]} castShadow receiveShadow>
        <boxGeometry args={[0.16, 0.222, 0.044]} />
        <meshStandardMaterial
          color="#141b17"
          roughness={0.46}
          metalness={0.65}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
        />
      </mesh>
      {/* Inner Brushed-Brass CRT Tube Retention Trim Frame */}
      {[-0.109, 0.109].map((ty, idx) => (
        <mesh key={`bt-${idx}`} position={[-0.055, ty, 0.036]}>
          <boxGeometry args={[1.36, 0.009, 0.018]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.86}
            roughness={0.26}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>
      ))}
      {[-0.73, 0.62].map((tx, idx) => (
        <mesh key={`btx-${idx}`} position={[tx, 0, 0.036]}>
          <boxGeometry args={[0.01, 0.209, 0.018]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.86}
            roughness={0.26}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>
      ))}

      {/* 3. Right-Side CRT Control Strip: Power Jewel Lamp, Model Badge & 2 Knurled Bakelite Tuning Knobs */}
      <group position={[0.7, 0, 0.052]}>
        {/* Model Badge Plaque with Brass Backing */}
        <mesh position={[0, 0.074, 0.004]}>
          <boxGeometry args={[0.124, 0.038, 0.006]} />
          <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.074, 0.009]}>
          <planeGeometry args={[0.118, 0.034]} />
          <meshStandardMaterial
            map={badgeTex}
            emissive="#ffffff"
            emissiveMap={badgeTex}
            emissiveIntensity={0.35}
            roughness={0.7}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
        {/* Glowing Green CRT Filament Indicator Lamp */}
        <mesh position={[-0.04, 0.025, 0.004]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.013, 0.015, 0.01, 10]} />
          <meshStandardMaterial color="#b8a46b" metalness={0.88} roughness={0.25} />
        </mesh>
        <mesh position={[-0.04, 0.025, 0.008]}>
          <sphereGeometry args={[0.01, 10, 10]} />
          <meshStandardMaterial
            color="#33ff66"
            emissive="#33ff66"
            emissiveIntensity={1.6}
            roughness={0.2}
          />
        </mesh>
        {/* 2 Knurled Bakelite CRT Brightness / Vertical-Hold Tuning Knobs */}
        {[0.022, -0.055].map((ky, kIdx) => (
          <group
            key={kIdx}
            position={[kIdx === 0 ? 0.022 : 0.0, ky, 0.008]}
            rotation={[Math.PI / 2, 0, kIdx === 0 ? 0.4 : -0.6]}
          >
            <mesh castShadow>
              <cylinderGeometry args={[0.022, 0.025, 0.018, 12]} />
              <meshStandardMaterial color="#181412" roughness={0.38} metalness={0.25} />
            </mesh>
            <mesh position={[0, 0.01, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.004, 10]} />
              <meshStandardMaterial color="#d8c280" metalness={0.88} roughness={0.22} />
            </mesh>
            <mesh position={[0, 0.011, 0.008]}>
              <boxGeometry args={[0.004, 0.004, 0.014]} />
              <meshStandardMaterial color="#ffb000" emissive="#ffb000" emissiveIntensity={0.4} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 4. 8 Perimeter Brass Hex Bezel Bolts */}
      {[-0.74, -0.25, 0.25, 0.74].map((rx, rIdx) => (
        <group key={rIdx}>
          <mesh position={[rx, 0.128, 0.052]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0075, 0.0075, 0.008, 6]} />
            <meshStandardMaterial color="#b8a46b" metalness={0.88} roughness={0.24} />
          </mesh>
          <mesh position={[rx, -0.128, 0.052]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0075, 0.0075, 0.008, 6]} />
            <meshStandardMaterial color="#b8a46b" metalness={0.88} roughness={0.24} />
          </mesh>
        </group>
      ))}

      {/* 5. Phosphor-Green CRT Cathode-Ray Screen Plane (At z = 0.026 -> 16mm clear of backing plate, zero Z-fighting!) */}
      <mesh position={[-0.055, 0, 0.026]}>
        <planeGeometry args={[1.34, 0.212]} />
        <meshStandardMaterial
          ref={screenMatRef}
          map={screenTexture}
          color="#ffffff"
          emissive="#ffffff"
          emissiveMap={screenTexture}
          emissiveIntensity={0.88}
          roughness={0.92}
          metalness={0.0}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  );
};

export function paintSovietCRTScreen( // oxlint-disable-line react/only-export-components
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  options: {
    headerCode: string;
    cells: Array<{ label: string; val: string; danger: boolean }>;
    statusLine: string;
    statusDanger: boolean;
    footerLine: string;
    isBlackout?: boolean;
  },
): void {
  ctx.imageSmoothingEnabled = false;

  // 1. Deep Curved Phosphor-Green CRT Tube Gradient & Vignette
  const grad = ctx.createRadialGradient(
    w * 0.5,
    h * 0.5,
    h * 0.1,
    w * 0.5,
    h * 0.5,
    w * 0.56,
  );
  if (options.isBlackout) {
    grad.addColorStop(0, "#030905");
    grad.addColorStop(1, "#010302");
  } else {
    grad.addColorStop(0, "#0b2914");
    grad.addColorStop(0.7, "#06190c");
    grad.addColorStop(1, "#020b05");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 2. CRT Oscilloscope Graticule Grid & Rounded Phosphor Mask Bezel
  ctx.strokeStyle = options.isBlackout
    ? "rgba(51, 255, 102, 0.04)"
    : "rgba(51, 255, 102, 0.13)";
  ctx.lineWidth = 1;
  for (let gx = 48; gx < w; gx += 48) {
    ctx.beginPath();
    ctx.moveTo(gx, 8);
    ctx.lineTo(gx, h - 8);
    ctx.stroke();
  }
  for (let gy = 24; gy < h; gy += 24) {
    ctx.beginPath();
    ctx.moveTo(10, gy);
    ctx.lineTo(w - 10, gy);
    ctx.stroke();
  }

  // Rounded CRT Corner Vignette Border
  ctx.strokeStyle = options.statusDanger ? "#ff2a2a" : "#2be85d";
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  // 3. Three Framed CRT Telemetry Readout Boxes (+45% Category Titles & +25% Heavy Values)
  const cellW = 238;
  const cellCenters = [132, 384, 636];
  options.cells.forEach((c, idx) => {
    const cx = cellCenters[idx] ?? 384;
    const x0 = cx - cellW / 2;

    // Darkened CRT sub-window
    ctx.fillStyle = c.danger
      ? "rgba(95, 12, 12, 0.65)"
      : "rgba(3, 16, 8, 0.78)";
    ctx.fillRect(x0, 8, cellW, 72);
    ctx.strokeStyle = c.danger ? "#ff2a2a" : "#2be85d";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x0, 8, cellW, 72);

    // Top Phosphor Header Strip inside Cell (Crisp dark #001a00 outline + 2px letter spacing)
    ctx.fillStyle = c.danger ? "#d41e1e" : "#1b6935";
    ctx.fillRect(x0 + 2, 10, cellW - 4, 23);
    drawFittedPlaqueText(
      ctx,
      c.label,
      cx,
      27,
      cellW + 8,
      '900 19px "Segoe UI Black", "Arial Black", "Consolas", sans-serif',
      "#ffffff",
      "#001a00",
      2.6,
      "2px",
    );

    // Glowing CRT Primary Readout (Razor-sharp #001a00 outline behind fill instead of same-color stroke bleed)
    ctx.save();
    ctx.shadowColor = c.danger ? "#ff2a2a" : "#33ff66";
    ctx.shadowBlur = 5;
    const valCol = c.danger ? "#ff4444" : "#55ff55";
    drawFittedPlaqueText(
      ctx,
      c.val,
      cx,
      71,
      cellW + 8,
      '900 50px "VT323", monospace',
      valCol,
      "#001a00",
      3.0,
      "2px",
    );
    ctx.restore();
  });

  // 4. Lower CRT Terminal Command & Status Bar (Crisp #001a00 outline for razor-sharp characters)
  ctx.fillStyle = "rgba(2, 12, 6, 0.88)";
  ctx.fillRect(12, 83, w - 24, 55);
  ctx.strokeStyle = options.statusDanger ? "#ff2a2a" : "#248f46";
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 83, w - 24, 55);

  const statusCol = options.statusDanger ? "#ff4444" : "#55ff55";
  drawFittedPlaqueText(
    ctx,
    `> ${options.statusLine}`,
    w / 2,
    110,
    w - 16,
    '900 32px "VT323", monospace',
    statusCol,
    "#001a00",
    2.8,
    "1.5px",
  );

  drawFittedPlaqueText(
    ctx,
    `[${options.headerCode}] ${options.footerLine}`,
    w / 2,
    133,
    w - 16,
    '900 19px "Segoe UI Black", "Arial Black", "Consolas", sans-serif',
    "#ffcc00",
    "#001a00",
    2.6,
    "1.5px",
  );

  // 5. Crisp Horizontal CRT Scanline Overlay & Top Glass Specular Sheen
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  for (let y = 0; y < h; y += 3) {
    ctx.fillRect(0, y, w, 1);
  }
}

interface CagedJewelLamp3DProps {
  position: [number, number, number];
  defaultColor?: string;
  lampMatRef?: React.Ref<THREE.MeshStandardMaterial>;
  scale?: number;
}

export const CagedSovietJewelLamp3D: React.FC<CagedJewelLamp3DProps> = ({
  position,
  defaultColor = "#33ff66",
  lampMatRef,
  scale = 1,
}) => {
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  return (
    <group position={position} scale={scale}>
      {/* Hex Brass Collar Base */}
      <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
        <cylinderGeometry args={[0.028, 0.032, 0.016, 6]} />
        <meshStandardMaterial
          color="#b8a46b"
          metalness={0.85}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
        />
      </mesh>
      {/* Faceted Glowing Jewel Dome */}
      <mesh position={[0, 0, 0.012]} raycast={NOOP_RAYCAST}>
        <icosahedronGeometry args={[0.021, 1]} />
        <meshStandardMaterial
          ref={lampMatRef}
          color={defaultColor}
          emissive={defaultColor}
          emissiveIntensity={1.1}
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>
      {/* 4-Rib Protective Wire Guard Cage */}
      {[0, Math.PI / 2].map((rotZ, idx) => (
        <mesh key={idx} position={[0, 0, 0.012]} rotation={[0, 0, rotZ]} raycast={NOOP_RAYCAST}>
          <torusGeometry args={[0.025, 0.0025, 6, 12, Math.PI]} />
          <meshStandardMaterial
            color="#8c7a4b"
            metalness={0.85}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
};

export interface SovietBacklitIndicatorBlock3DProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  label: string;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
  getAlertState: (state: ReturnType<typeof useGameStore.getState>) => {
    level: "normal" | "active" | "warn" | "critical";
    acknowledged?: boolean;
  };
}

/**
 * Physical Backlit Soviet Control Indicator Block (Annunciator Tile, 0.09m × 0.036m × 0.015m)
 * Mounted beside sloped-desk controls:
 * - Glows dim sage/white (`#d8e6de`) normally, or bright phosphor green (`#33ff66`) when `"active"`.
 * - Pulses amber (1.5 Hz) on `warn` or strobes bright red (3.5 Hz) on `critical`.
 * - Turns steady bright amber (`#ffb000`) while the operator is actively dragging/adjusting that control (ack).
 */
export const SovietBacklitIndicatorBlock3D: React.FC<
  SovietBacklitIndicatorBlock3DProps
> = ({
  position,
  rotation,
  scale = 1,
  label,
  onClick,
  onPointerDown,
  onPointerOver,
  onPointerOut,
  getAlertState,
}) => {
  const capMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  const capTexture = useMemo(
    () =>
      createCrispPanelTexture(192, 72, (ctx, w, h) => {
        ctx.fillStyle = "#1c2621";
        ctx.fillRect(0, 0, w, h);

        // Subtle translucent honeycomb diffuser pattern
        ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
        ctx.lineWidth = 1;
        for (let gx = 8; gx < w; gx += 8) {
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, h);
          ctx.stroke();
        }
        for (let gy = 8; gy < h; gy += 8) {
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(w, gy);
          ctx.stroke();
        }

        ctx.strokeStyle = "#2b3630";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);

        drawFittedPlaqueText(
          ctx,
          label,
          w / 2,
          46,
          w - 10,
          '900 22px "Kremlin", "Segoe UI Black", "Consolas", sans-serif',
          "#ffffff",
          "#000000",
          2.8,
          "1.5px",
        );
      }),
    [label],
  );

  useFrame(({ clock }) => {
    const mat = capMatRef.current;
    if (!mat) return;
    const state = useGameStore.getState();
    const t = clock.getElapsedTime();
    const { level, acknowledged } = getAlertState(state);

    if (acknowledged) {
      // Steady bright amber while dragging/adjusting (operator ack)
      mat.color.set("#ffbb22");
      mat.emissive.set("#ffb000");
      mat.emissiveIntensity = 1.75;
      return;
    }

    if (level === "critical") {
      // 3.5 Hz urgent red strobe
      const critFlash = Math.sin(t * Math.PI * 2 * 3.5) > 0;
      mat.color.set(critFlash ? "#ff332a" : "#441010");
      mat.emissive.set("#ff2a2a");
      mat.emissiveIntensity = critFlash ? 2.25 : 0.25;
      return;
    }

    if (level === "warn") {
      // 1.5 Hz pulsing amber
      const warnPulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 1.5);
      mat.color.set("#ffaa00");
      mat.emissive.set("#ffb000");
      mat.emissiveIntensity = 0.6 + warnPulse * 1.4;
      return;
    }

    if (state.isBlackout) {
      mat.color.set("#18201c");
      mat.emissive.set("#18201c");
      mat.emissiveIntensity = 0.04;
      return;
    }

    if (level === "active") {
      // Steady bright Soviet phosphor green when engaged (e.g., AUTO RODS)
      mat.color.set("#33ff66");
      mat.emissive.set("#28d858");
      mat.emissiveIntensity = 1.45;
      return;
    }

    // Normal dim sage/white glow
    mat.color.set("#d8e6de");
    mat.emissive.set("#b8d8c4");
    mat.emissiveIntensity = 0.28;
  });

  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {/* Generous invisible proud hit-box collider so interactive buttons never miss raycasts */}
      {(onClick || onPointerDown || onPointerOver) && (
        <mesh position={[0, 0, 0.014]}>
          <boxGeometry args={[0.116, 0.056, 0.036]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {/* Recessed Warm Cast-Iron & Brushed-Brass Mounting Bezel (`0.098m × 0.042m × 0.01m`) */}
      <mesh raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.098, 0.042, 0.01]} />
        <meshStandardMaterial
          color="#2b3036"
          metalness={0.78}
          roughness={0.36}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.005}
        />
      </mesh>
      <mesh position={[0, 0, 0.004]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.093, 0.038, 0.006]} />
        <meshStandardMaterial
          color="#b8a46b"
          metalness={0.86}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.004}
        />
      </mesh>
      {/* 2 Side Brass Retention Hex Screws */}
      {[-0.045, 0.045].map((sx, sIdx) => (
        <mesh
          key={sIdx}
          position={[sx, 0, 0.006]}
          rotation={[Math.PI / 2, 0, 0]}
          raycast={NOOP_RAYCAST}
        >
          <cylinderGeometry args={[0.0028, 0.0028, 0.004, 6]} />
          <meshStandardMaterial
            color="#8a929a"
            metalness={0.88}
            roughness={0.28}
          />
        </mesh>
      ))}
      {/* Translucent Backlit Plastic Indicator Cap (`0.09m × 0.036m × 0.015m`) */}
      <mesh position={[0, 0, 0.008]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.09, 0.036, 0.015]} />
        <meshStandardMaterial
          ref={capMatRef}
          map={capTexture}
          emissiveMap={capTexture}
          color="#d8e6de"
          emissive="#b8d8c4"
          emissiveIntensity={0.28}
          roughness={0.24}
          metalness={0.12}
        />
      </mesh>
    </group>
  );
};

interface HighDetailManometer3DProps {
  position: [number, number, number];
  title: string;
  cyrillicSub?: string;
  unit: string;
  serial?: string;
  min: number;
  max: number;
  dangerThreshold: number;
  lowDangerThreshold?: number;
  centerNominal?: boolean;
  nominalMark?: number;
  safeBand?: [number, number];
  dialZoneLabels?: {
    leftLabel: string;
    rightLabel: string;
    topLabel?: string;
  };
  powerBalanceMode?: boolean;
  synchroscopeMode?: boolean;
  getValue: () => number;
  secondaryGetValue?: () => number;
  getAlertLevel?: (
    state: ReturnType<typeof useGameStore.getState>,
  ) => "normal" | "warn" | "critical";
}

export const HighDetailManometer3D: React.FC<HighDetailManometer3DProps> = ({
  position,
  title,
  min,
  max,
  dangerThreshold,
  lowDangerThreshold,
  centerNominal = false,
  nominalMark,
  safeBand,
  dialZoneLabels,
  powerBalanceMode = false,
  synchroscopeMode = false,
  getValue,
  secondaryGetValue,
  getAlertLevel,
}) => {
  const needleGroupRef = useRef<THREE.Group>(null);
  const secondaryNeedleRef = useRef<THREE.Group>(null);
  const warningLampRef = useRef<THREE.MeshStandardMaterial>(null);
  const needleVelRef = useRef(0);
  const secNeedleVelRef = useRef(0);
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  const dialTexture = useMemo(() => {
    return createCrispPanelTexture(512, 512, (ctx, w, h) => {
      const cx = w / 2;
      const cy = h / 2;

      // Crisp High-Contrast Soviet Manometer Dial Face (#f4eee0 with subtle radial vignette)
      const grad = ctx.createRadialGradient(cx, cy, 40, cx, cy, 240);
      grad.addColorStop(0, "#f7f2e4");
      grad.addColorStop(0.82, "#ebe2c8");
      grad.addColorStop(1, "#c8bea2");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 242, 0, Math.PI * 2);
      ctx.fill();

      // Double Outer Scale Rings
      ctx.strokeStyle = "#0a0a0a";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, 232, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 218, 0, Math.PI * 2);
      ctx.stroke();

      if (synchroscopeMode) {
        // 360-degree Synchroscope Dial: Green Sync Window at 12 o'clock (-25° to +25°)
        ctx.strokeStyle = "#1d7a36";
        ctx.lineWidth = 20;
        ctx.beginPath();
        ctx.arc(
          cx,
          cy,
          198,
          -Math.PI / 2 - (25 * Math.PI) / 180,
          -Math.PI / 2 + (25 * Math.PI) / 180,
        );
        ctx.stroke();

        for (let deg = 0; deg < 360; deg += 10) {
          const ang = -Math.PI / 2 + (deg * Math.PI) / 180;
          const isMajor = deg % 30 === 0;
          const innerR = isMajor ? 160 : 180;
          const outerR = 212;
          const inSync = deg <= 25 || deg >= 335;
          ctx.strokeStyle = inSync ? "#1d7a36" : "#0a0a0a";
          ctx.lineWidth = isMajor ? 5.5 : 2.5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR);
          ctx.lineTo(cx + Math.cos(ang) * outerR, cy + Math.sin(ang) * outerR);
          ctx.stroke();
        }
        ctx.save();
        ctx.fillStyle = "#1d7a36";
        ctx.font = '900 28px "Kremlin", "Segoe UI Black", "Consolas", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("0° SYNC", cx, cy - 122, 160);
        ctx.fillStyle = "#0a0a0a";
        ctx.font = '900 24px "Kremlin", "Segoe UI Black", "Consolas", sans-serif';
        ctx.fillText("-90°", cx - 126, cy, 80);
        ctx.fillText("+90°", cx + 126, cy, 80);
        ctx.restore();
      } else {
        // Cross-Hatched Crimson Danger Arc (plus Center Green Nominal Band if centerNominal)
        const dangerRatio = THREE.MathUtils.clamp(
          (dangerThreshold - min) / (max - min),
          0,
          1,
        );
        const startAngle = Math.PI * 0.75 + dangerRatio * Math.PI * 1.5;
        const endAngle = Math.PI * 2.25;
        ctx.strokeStyle = "#c81e1e";
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.arc(cx, cy, 198, startAngle, endAngle);
        ctx.stroke();

        const lowDangerRatio =
          typeof lowDangerThreshold === "number"
            ? THREE.MathUtils.clamp(
                (lowDangerThreshold - min) / (max - min),
                0,
                1,
              )
            : -1;
        if (lowDangerRatio > 0) {
          ctx.strokeStyle = "#c81e1e";
          ctx.lineWidth = 18;
          ctx.beginPath();
          ctx.arc(
            cx,
            cy,
            198,
            Math.PI * 0.75,
            Math.PI * 0.75 + lowDangerRatio * Math.PI * 1.5,
          );
          ctx.stroke();
        }
        if (safeBand) {
          const s0 = THREE.MathUtils.clamp(
            (safeBand[0] - min) / (max - min),
            0,
            1,
          );
          const s1 = THREE.MathUtils.clamp(
            (safeBand[1] - min) / (max - min),
            0,
            1,
          );
          ctx.strokeStyle = "#1d8a3f";
          ctx.lineWidth = 17;
          ctx.beginPath();
          ctx.arc(
            cx,
            cy,
            198,
            Math.PI * 0.75 + s0 * Math.PI * 1.5,
            Math.PI * 0.75 + s1 * Math.PI * 1.5,
          );
          ctx.stroke();
        } else if (centerNominal) {
          ctx.strokeStyle = "#1d7a36";
          ctx.lineWidth = 14;
          ctx.beginPath();
          ctx.arc(
            cx,
            cy,
            198,
            Math.PI * 0.75 + 0.35 * Math.PI * 1.5,
            Math.PI * 0.75 + 0.65 * Math.PI * 1.5,
          );
          ctx.stroke();
        } else if (typeof nominalMark === "number") {
          const nomRatio = THREE.MathUtils.clamp(
            (nominalMark - min) / (max - min),
            0.05,
            0.95,
          );
          ctx.strokeStyle = "#1d7a36";
          ctx.lineWidth = 14;
          ctx.beginPath();
          ctx.arc(
            cx,
            cy,
            198,
            Math.PI * 0.75 + Math.max(0, nomRatio - 0.06) * Math.PI * 1.5,
            Math.PI * 0.75 + Math.min(1, nomRatio + 0.06) * Math.PI * 1.5,
          );
          ctx.stroke();
        }

        // Fine Minor & Major Tick Marks (50 subdivisions) + +30% Larger Bold Numeric Scale Labels
        for (let i = 0; i <= 50; i++) {
          const ratio = i / 50;
          const ang = Math.PI * 0.75 + ratio * Math.PI * 1.5;
          const isMajor = i % 5 === 0;
          const isMed = i % 5 === 2 || i % 5 === 3;
          const innerR = isMajor ? 158 : isMed ? 172 : 180;
          const outerR = 212;
          const inRed =
            ratio >= dangerRatio ||
            (lowDangerRatio > 0 && ratio <= lowDangerRatio);
          ctx.strokeStyle = inRed ? "#c81e1e" : "#0a0a0a";
          ctx.lineWidth = isMajor ? 5.5 : 2.5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR);
          ctx.lineTo(cx + Math.cos(ang) * outerR, cy + Math.sin(ang) * outerR);
          ctx.stroke();

          if (isMajor && i % 10 === 0 && i > 0 && i < 50) {
            const rawNum = min + ratio * (max - min);
            const valStr =
              max - min <= 15
                ? Number.isInteger(rawNum)
                  ? rawNum.toFixed(1)
                  : rawNum.toFixed(1)
                : String(Math.round(rawNum));
            const isTopTick = Math.sin(ang) < -0.55;
            const labelR = isTopTick ? 136 : 128;
            const numColor = inRed ? "#c81e1e" : "#0a0a0a";
            const lx = cx + Math.cos(ang) * labelR;
            const ly = cy + Math.sin(ang) * labelR;
            ctx.save();
            ctx.fillStyle = numColor;
            ctx.font = '900 30px "Segoe UI Black", "Arial Black", "Consolas", sans-serif';
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(valStr, lx, ly);
            ctx.restore();
          }
        }

        if (dialZoneLabels) {
          ctx.save();
          if (dialZoneLabels.topLabel) {
            ctx.fillStyle = "#146e30";
            ctx.font = '900 20px "Kremlin", "Segoe UI Black", "Consolas", sans-serif';
            ctx.textAlign = "center";
            ctx.fillText(dialZoneLabels.topLabel, cx, cy - 84, 180);
          }
          ctx.font = '900 15px "Kremlin", "Segoe UI Black", "Consolas", sans-serif';
          ctx.fillStyle = "#9e221b";
          ctx.textAlign = "center";
          const leftParts = dialZoneLabels.leftLabel.split(" / ");
          leftParts.forEach((p, idx) => {
            ctx.fillText(p, cx - 82, cy + 44 + idx * 19, 110);
          });
          const rightParts = dialZoneLabels.rightLabel.split(" / ");
          rightParts.forEach((p, idx) => {
            ctx.fillText(p, cx + 82, cy + 44 + idx * 19, 110);
          });
          ctx.restore();
        }

        if (powerBalanceMode) {
          ctx.save();
          ctx.font = '900 16px "Kremlin", "Segoe UI Black", "Consolas", sans-serif';
          ctx.textAlign = "center";
          ctx.fillStyle = "#b81818";
          ctx.fillText("RED = DEMAND", cx, cy + 56, 170);
          ctx.fillStyle = "#111111";
          ctx.fillText("BLK = OUTPUT", cx, cy + 78, 170);
          ctx.restore();
        }
      }

      // Bottom Dead-Zone Wedge (100% clean — no bottom range numbers colliding with the bold gauge title!):
      drawFittedPlaqueText(
        ctx,
        title,
        cx,
        cy + 142,
        204,
        '900 44px "Kremlin", "Segoe UI Black", "Impact", "Consolas", sans-serif',
        "#060606",
        undefined,
        0,
        "2px",
      );
    });
  }, [
    centerNominal,
    dangerThreshold,
    dialZoneLabels,
    lowDangerThreshold,
    max,
    min,
    nominalMark,
    powerBalanceMode,
    safeBand,
    synchroscopeMode,
    title,
  ]);

  useFrame(({ clock }, delta) => {
    const rawVal = getValue();
    const state = useGameStore.getState();
    const t = clock.getElapsedTime();
    const dt = Math.min(0.05, Math.max(0.004, delta));

    if (synchroscopeMode) {
      if (needleGroupRef.current) {
        needleGroupRef.current.rotation.z = -(rawVal * Math.PI) / 180;
      }
      if (warningLampRef.current) {
        const customLvl = getAlertLevel ? getAlertLevel(state) : null;
        if (customLvl === "critical" || state.turbines[0]?.tripped) {
          const critFlash = Math.sin(t * Math.PI * 2 * 3.5) > 0;
          warningLampRef.current.color.set("#ff2a2a");
          warningLampRef.current.emissive.set("#ff2a2a");
          warningLampRef.current.emissiveIntensity = critFlash ? 2.35 : 0.28;
        } else if (customLvl === "warn") {
          const warnPulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 1.5);
          warningLampRef.current.color.set("#ffb000");
          warningLampRef.current.emissive.set("#ffb000");
          warningLampRef.current.emissiveIntensity = 0.65 + warnPulse * 1.45;
        } else {
          const inSync =
            Math.abs(rawVal) <= 25 &&
            Math.abs((state.turbines[0]?.rpm ?? 0) - 3000) <= 60;
          if (inSync || state.turbines[0]?.gridConnected) {
            warningLampRef.current.color.set("#33ff66");
            warningLampRef.current.emissive.set("#33ff66");
            warningLampRef.current.emissiveIntensity = 1.1;
          } else {
            const warnPulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 1.5);
            warningLampRef.current.color.set("#ffb000");
            warningLampRef.current.emissive.set("#ffb000");
            warningLampRef.current.emissiveIntensity = 0.65 + warnPulse * 1.35;
          }
        }
      }
      return;
    }

    const ratio = THREE.MathUtils.clamp((rawVal - min) / (max - min), 0, 1);
    const isOver80Pct = !centerNominal && ratio >= 0.85;
    const isLow20Pct =
      !centerNominal &&
      typeof lowDangerThreshold === "number" &&
      ratio <= 0.15;
    const customLevel = getAlertLevel ? getAlertLevel(state) : null;
    const isDanger =
      customLevel === "critical" ||
      (!customLevel &&
        (rawVal >= dangerThreshold ||
          (typeof lowDangerThreshold === "number" &&
            rawVal <= lowDangerThreshold) ||
          isOver80Pct ||
          isLow20Pct));
    const isWarn =
      customLevel === "warn" ||
      (!customLevel &&
        !isDanger &&
        !centerNominal &&
        (ratio >= 0.72 ||
          (typeof lowDangerThreshold === "number" && ratio <= 0.25)));

    // High-frequency mechanical needle vibration (±1.5°–3.0° = ±0.026..0.052 rad at 18–25 Hz)
    // whenever the parameter is under transient stress or outside its green zone!
    const isTransientStressed =
      isDanger ||
      isWarn ||
      state.voltageDipIntensity > 0.08 ||
      Math.abs(state.gridTransientImpulse) > 0.15 ||
      Math.abs(state.steamTransientImpulse) > 1.2 ||
      (Boolean(state.turbines[0]?.gridConnected) &&
        Math.abs(state.gridHz - 50.0) > 0.35) ||
      (Boolean(state.turbines[0]?.gridConnected) && state.pressureBar < 50) ||
      state.pressureBar > 78 ||
      state.wetSteamPenalty > 0.1 ||
      state.coreTemp > 540;
    const isCalmCold = state.thermalPower < 50 || state.isBlackout;
    const isStressedAny =
      isDanger ||
      isWarn ||
      state.voltageDipIntensity > 0.15 ||
      isTransientStressed;
    const vibAmp = isDanger
      ? 0.048
      : isWarn || state.voltageDipIntensity > 0.15
        ? 0.032
        : isTransientStressed
          ? 0.022
          : 0;
    // Zero out micro-drift when idle/nominal so Bayer dither pass remains rock-solid
    const jitter = isStressedAny
      ? (Math.sin(t * 21.5 * Math.PI * 2 + position[0] * 7.3) * 0.65 +
          Math.cos(t * 18.2 * Math.PI * 2 + position[1] * 11.1) * 0.35) *
        vibAmp
      : 0;

    // Spring-damper inertia (slight overshoot + damped oscillation) when values jump
    const baseTargetRotZ = 2.35 - ratio * 4.7;
    if (needleGroupRef.current) {
      const curZ = needleGroupRef.current.rotation.z;
      if (
        !isStressedAny &&
        (isCalmCold ||
          (Math.abs(baseTargetRotZ - curZ) < 0.001 &&
            Math.abs(needleVelRef.current) < 0.004))
      ) {
        needleVelRef.current = 0;
        needleGroupRef.current.rotation.z = baseTargetRotZ;
      } else {
        const stiffness = 195;
        const damping = 11.5;
        const accel =
          (baseTargetRotZ - curZ) * stiffness - needleVelRef.current * damping;
        needleVelRef.current = THREE.MathUtils.clamp(
          needleVelRef.current + accel * dt,
          -18,
          18,
        );
        needleGroupRef.current.rotation.z =
          curZ + needleVelRef.current * dt + jitter;
      }
    }

    if (secondaryNeedleRef.current && secondaryGetValue) {
      const secVal = secondaryGetValue();
      const secRatio = THREE.MathUtils.clamp((secVal - min) / (max - min), 0, 1);
      const secRotZ = 2.35 - secRatio * 4.7;
      const curSecZ = secondaryNeedleRef.current.rotation.z;
      const secAccel =
        (secRotZ - curSecZ) * 180 - secNeedleVelRef.current * 12.0;
      secNeedleVelRef.current = THREE.MathUtils.clamp(
        secNeedleVelRef.current + secAccel * dt,
        -16,
        16,
      );
      secondaryNeedleRef.current.rotation.z =
        curSecZ + secNeedleVelRef.current * dt + jitter * 0.6;
    }

    if (warningLampRef.current) {
      if (isDanger) {
        // 3.5 Hz fast urgent strobe for Critical
        const critFlash = Math.sin(t * Math.PI * 2 * 3.5) > 0;
        warningLampRef.current.color.set("#ff2a2a");
        warningLampRef.current.emissive.set("#ff2a2a");
        warningLampRef.current.emissiveIntensity = critFlash ? 2.35 : 0.28;
      } else if (isWarn) {
        // 1.5 Hz pulsing amber for Warning
        const warnPulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 1.5);
        warningLampRef.current.color.set("#ffb000");
        warningLampRef.current.emissive.set("#ffb000");
        warningLampRef.current.emissiveIntensity = 0.65 + warnPulse * 1.45;
      } else {
        warningLampRef.current.color.set("#33ff66");
        warningLampRef.current.emissive.set("#33ff66");
        warningLampRef.current.emissiveIntensity = 0.78;
      }
    }
  });

  const dangerAngle =
    2.35 -
    THREE.MathUtils.clamp((dangerThreshold - min) / (max - min), 0, 1) * 4.7;

  return (
    <group position={position}>
      {/* 1. Stepped Hammered Cast-Iron Outer Flange Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
        <cylinderGeometry args={[0.205, 0.22, 0.088, 24]} />
        <meshStandardMaterial
          color="#18211b"
          roughness={0.44}
          metalness={0.68}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
          roughnessMap={ironTex.roughnessMap}
        />
      </mesh>

      {/* 2. 8 Perimeter 3D Brass Hex Bolts */}
      <mesh geometry={MANOMETER_8_BOLTS_GEO} raycast={NOOP_RAYCAST}>
        <meshStandardMaterial
          color="#b8a46b"
          metalness={0.88}
          roughness={0.25}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
        />
      </mesh>

      {/* 3. Hollow Brushed-Brass Bevel Ring & Recessed Shadow Cavity (Open Center!) */}
      <mesh position={[0, 0, 0.054]} raycast={NOOP_RAYCAST}>
        <torusGeometry args={[0.175, 0.012, 12, 32]} />
        <meshStandardMaterial
          color="#b8a46b"
          metalness={0.86}
          roughness={0.26}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
          roughnessMap={brassTex.roughnessMap}
        />
      </mesh>
      <mesh position={[0, 0, 0.046]} raycast={NOOP_RAYCAST}>
        <ringGeometry args={[0.162, 0.178, 32]} />
        <meshBasicMaterial
          color="#090c0a"
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* 4. Crisp Backlit 512x512 GOST-84 Manometer Dial Face */}
      <mesh position={[0, 0, 0.048]} raycast={NOOP_RAYCAST}>
        <circleGeometry args={[0.168, 32]} />
        <meshStandardMaterial
          map={dialTexture}
          emissive="#fff4d8"
          emissiveMap={dialTexture}
          emissiveIntensity={0.55}
          roughness={0.88}
          metalness={0.02}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* 5. Physical Red Limit-Pin Marker on Bezel */}
      <group rotation={[0, 0, dangerAngle]} position={[0, 0, 0.058]}>
        <mesh position={[0, 0.146, 0]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.008, 0.026, 0.008]} />
          <meshStandardMaterial
            color="#ff2a2a"
            emissive="#ff2a2a"
            emissiveIntensity={0.45}
          />
        </mesh>
      </group>

      {/* 6. Sculpted 3D Pointer Needle with Compact Counterweight Tail & Low-Profile Oxidized Brass Spindle Cap */}
      {secondaryGetValue && (
        <group ref={secondaryNeedleRef} position={[0, 0, 0.052]}>
          <mesh position={[0, 0.056, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry
              args={[
                powerBalanceMode ? 0.0115 : 0.0075,
                powerBalanceMode ? 0.132 : 0.115,
                0.004,
              ]}
            />
            <meshStandardMaterial
              color={powerBalanceMode ? "#ff2a2a" : "#ffb000"}
              emissive={powerBalanceMode ? "#ff2a2a" : "#ffb000"}
              emissiveIntensity={powerBalanceMode ? 0.85 : 0.65}
              roughness={0.3}
            />
          </mesh>
          {powerBalanceMode && (
            <mesh position={[0, 0.126, 0.001]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.022, 0.014, 0.005]} />
              <meshStandardMaterial
                color="#ff2a2a"
                emissive="#ff2a2a"
                emissiveIntensity={0.95}
              />
            </mesh>
          )}
        </group>
      )}
      <group ref={needleGroupRef} position={[0, 0, 0.056]}>
        {/* Main Tapered Pointer Blade (High-contrast Black/Ivory tip in powerBalanceMode so RED vs BLACK/WHITE align cleanly!) */}
        <mesh position={[0, 0.058, 0]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.0095, 0.128, 0.005]} />
          <meshStandardMaterial
            color={powerBalanceMode ? "#121614" : "#ff2a2a"}
            emissive={powerBalanceMode ? "#e8f2ec" : "#ff2a2a"}
            emissiveIntensity={powerBalanceMode ? 0.18 : 0.55}
            roughness={0.3}
          />
        </mesh>
        {powerBalanceMode && (
          <mesh position={[0, 0.098, 0.0012]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.006, 0.048, 0.005]} />
            <meshStandardMaterial
              color="#f4f2e8"
              emissive="#ffffff"
              emissiveIntensity={0.65}
            />
          </mesh>
        )}
        {/* Compact Dark Counterweight Tail & Disc */}
        <mesh position={[0, -0.018, 0]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.011, 0.026, 0.005]} />
          <meshStandardMaterial
            color="#141414"
            metalness={0.7}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0, -0.03, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.01, 0.01, 0.006, 10]} />
          <meshStandardMaterial
            color="#141414"
            metalness={0.7}
            roughness={0.35}
          />
        </mesh>
        {/* Low-Profile Dark Oxidized Brass Spindle Cap & Nut (Never obscures dial text!) */}
        <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.014, 0.016, 0.011, 12]} />
          <meshStandardMaterial
            color="#524428"
            roughness={0.38}
            metalness={0.78}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>
      </group>

      {/* 7. Non-Glaring Anti-Reflective Glass Highlight Strip */}
      <mesh position={[-0.045, 0.045, 0.068]} rotation={[0, 0, 0.65]} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[0.18, 0.022]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.07}
          depthWrite={false}
        />
      </mesh>

      {/* 8. Caged Soviet Jewel Indicator Lamp Above Dial (Positioned with clean gap below header plaque) */}
      <CagedSovietJewelLamp3D
        position={[0, 0.198, 0.028]}
        lampMatRef={warningLampRef}
      />
    </group>
  );
};

const PUMP_LEVER_TRAVEL_HALF_M = 0.062;
const PUMP_LEVER_MAX_PITCH_RAD = THREE.MathUtils.degToRad(26);

function paintPumpThrottleScalePlate(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  side: "left" | "right",
): void {
  ctx.fillStyle = "#101613";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#b8a46b";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, w - 4, h - 4);

  // Highlight nominal 50-85% operating band along inner slot edge
  const bandYTop = 64;
  const bandYBot = 140;
  const bandX = side === "left" ? w - 16 : 6;
  ctx.fillStyle = "rgba(51, 255, 102, 0.28)";
  ctx.fillRect(bandX, bandYTop, 10, bandYBot - bandYTop);
  ctx.fillStyle = "#33ff66";
  ctx.fillRect(side === "left" ? w - 8 : 6, bandYTop, 2, bandYBot - bandYTop);

  const ticks = [
    { label: "100%", y: 32, major: true, color: "#33ff66" },
    { label: "", y: 59, major: false, color: "#b8a46b" },
    { label: "75%", y: 86, major: true, color: "#e6dec3" },
    { label: "", y: 113, major: false, color: "#b8a46b" },
    { label: "50%", y: 140, major: true, color: "#33ff66" },
    { label: "", y: 167, major: false, color: "#b8a46b" },
    { label: "25%", y: 194, major: true, color: "#ffb000" },
    { label: "", y: 221, major: false, color: "#b8a46b" },
    { label: "0%", y: 248, major: true, color: "#ff5555" },
  ];

  for (const tick of ticks) {
    const tickW = tick.major ? 22 : 12;
    const tickH = tick.major ? 4 : 2;
    const tickX = side === "left" ? w - 6 - tickW : 6;
    ctx.fillStyle = tick.color;
    ctx.fillRect(tickX, tick.y - Math.floor(tickH / 2), tickW, tickH);

    if (side === "left" && tick.label) {
      ctx.font = 'bold 30px "VT323", monospace';
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = tick.color;
      ctx.fillText(tick.label, w - 34, tick.y + 1);
    }
  }

  if (side === "right") {
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = 'bold 26px "VT323", monospace';
    ctx.fillStyle = "#33ff66";
    ctx.fillText("▲ MAX", 34, 32);

    ctx.fillStyle = "#8ce6a8";
    ctx.font = 'bold 24px "VT323", monospace';
    ctx.fillText("NOMINAL", 34, 92);
    ctx.fillStyle = "#33ff66";
    ctx.fillText("50-85%", 34, 118);

    ctx.font = 'bold 26px "VT323", monospace';
    ctx.fillStyle = "#ff5555";
    ctx.fillText("▼ STOP", 34, 248);
  }
}

function paintPumpFlowBargraph(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  flowPct: number,
  isBlackout: boolean,
): void {
  const clampedPct = isBlackout ? 0 : THREE.MathUtils.clamp(Math.round(flowPct), 0, 100);
  const statusColor = isBlackout
    ? "#773030"
    : clampedPct >= 50
      ? "#33ff66"
      : clampedPct > 0
        ? "#ffb000"
        : "#ff5555";
  const borderColor = isBlackout
    ? "#551a1a"
    : clampedPct >= 50
      ? "#33ff66"
      : clampedPct > 0
        ? "#b8a46b"
        : "#ff2a2a";

  ctx.fillStyle = "#101613";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, w - 4, h - 4);
  drawFittedPlaqueText(
    ctx,
    isBlackout ? "PUMP FLOW: 0% (OFF)" : `PUMP FLOW: ${clampedPct}%`,
    w / 2,
    35,
    w - 12,
    '900 30px "Segoe UI Black", "Arial Black", "Consolas", sans-serif',
    statusColor,
    "#000000",
    3.2,
    "2px",
  );
  ctx.fillStyle = "#080c0a";
  ctx.fillRect(14, 48, w - 28, 24);
  ctx.strokeStyle = "#364940";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(14, 48, w - 28, 24);
}

interface SculptedPumpValveAssembly3DProps {
  position: [number, number, number];
  scale?: number;
  pumpIndex: 0 | 1;
  label: string;
  subLabel?: string;
}

const SculptedPumpValveAssembly3D: React.FC<
  SculptedPumpValveAssembly3DProps
> = ({ position, scale = 1, pumpIndex, label, subLabel }) => {
  const leverArmRef = useRef<THREE.Group>(null);
  const lampMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const flowScaleMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const flowBarMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const flowBarMeshRef = useRef<THREE.Mesh>(null);
  const lastPumpOnRef = useRef<string | null>(null);
  const pumpDraggingRef = useRef(false);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const lastDrawnFlowSigRef = useRef<string>("");
  const lastFlowDrawRef = useRef<number>(-1);
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  useEffect(() => {
    const flowId = pumpIndex === 0 ? "pumpAFlow" : "pumpBFlow";
    registerKomradControlObject(flowId, leverArmRef.current, [0, 0, 0.13]);
    return () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
      registerKomradControlObject(flowId, null);
    };
  }, [pumpIndex]);

  const nameplateTex = useMemo(
    () =>
      makePlaqueTex(label, subLabel ?? "FLOW VALVE", {
        width: 384,
        height: 112,
        titleSize: 44,
        subSize: 30,
      }),
    [label, subLabel],
  );

  const leverSubLabelTex = useMemo(
    () =>
      makePlaqueTex("THROTTLE: FLOW %", "", {
        width: 360,
        height: 48,
        titleSize: 24,
        titleColor: "#ffe066",
      }),
    [],
  );

  const leftScalePlateTex = useMemo(
    () =>
      createCrispPanelTexture(144, 280, (ctx, w, h) =>
        paintPumpThrottleScalePlate(ctx, w, h, "left"),
      ),
    [],
  );

  const rightScalePlateTex = useMemo(
    () =>
      createCrispPanelTexture(144, 280, (ctx, w, h) =>
        paintPumpThrottleScalePlate(ctx, w, h, "right"),
      ),
    [],
  );

  const flowScaleTex = useMemo(() => {
    return createCrispPanelTexture(360, 84, (ctx, w, h) => {
      const s = useGameStore.getState();
      paintPumpFlowBargraph(
        ctx,
        w,
        h,
        s.pumpThrottle[pumpIndex] ?? 0,
        s.isBlackout,
      );
    });
  }, [pumpIndex]);

  useFrame(({ clock }) => {
    const state = useGameStore.getState();
    const throttle = state.isBlackout ? 0 : (state.pumpThrottle[pumpIndex] ?? 0);
    const flowPct = Math.round(throttle);
    const isPumpOn = state.pumpsActive[pumpIndex] && !state.isBlackout;

    const now = clock.getElapsedTime();
    const flowSig = `${flowPct}|${state.isBlackout}`;
    if (
      !state.diagFeedActive &&
      (lastFlowDrawRef.current < 0 || now - lastFlowDrawRef.current >= 0.06)
    ) {
      lastFlowDrawRef.current = now;
      if (flowSig !== lastDrawnFlowSigRef.current) {
        lastDrawnFlowSigRef.current = flowSig;
        const tex = flowScaleMatRef.current?.map as
          | THREE.CanvasTexture
          | undefined;
        const canvas = tex?.image as HTMLCanvasElement | undefined;
        const ctx = canvas?.getContext("2d");
        if (tex && canvas && ctx) {
          paintPumpFlowBargraph(
            ctx,
            canvas.width,
            canvas.height,
            flowPct,
            state.isBlackout,
          );
          tex.needsUpdate = true;
        }
      }
    }

    // 100% deterministic 3D pose driven solely from clamped [0..1] flow value (rotation.y & rotation.z locked to 0)
    if (leverArmRef.current) {
      const flowNorm = THREE.MathUtils.clamp(throttle / 100, 0, 1);
      const targetPosY = THREE.MathUtils.lerp(
        -PUMP_LEVER_TRAVEL_HALF_M,
        PUMP_LEVER_TRAVEL_HALF_M,
        flowNorm,
      );
      const targetAngleX = THREE.MathUtils.lerp(
        PUMP_LEVER_MAX_PITCH_RAD,
        -PUMP_LEVER_MAX_PITCH_RAD,
        flowNorm,
      );
      leverArmRef.current.position.x = 0;
      leverArmRef.current.position.y = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(leverArmRef.current.position.y, targetPosY, 0.38),
        -PUMP_LEVER_TRAVEL_HALF_M,
        PUMP_LEVER_TRAVEL_HALF_M,
      );
      leverArmRef.current.position.z = 0.022;
      leverArmRef.current.rotation.x = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(leverArmRef.current.rotation.x, targetAngleX, 0.38),
        -PUMP_LEVER_MAX_PITCH_RAD,
        PUMP_LEVER_MAX_PITCH_RAD,
      );
      leverArmRef.current.rotation.y = 0;
      leverArmRef.current.rotation.z = 0;
    }

    // Live Horizontal PUMP FLOW Bargraph Readout
    const fRatio = THREE.MathUtils.clamp(throttle / 100, 0, 1);
    if (flowBarMeshRef.current && flowBarMatRef.current) {
      flowBarMeshRef.current.visible = fRatio > 0.005;
      const safeScale = Math.max(0.01, fRatio);
      flowBarMeshRef.current.scale.x = safeScale;
      flowBarMeshRef.current.position.x = -0.162 + safeScale * 0.162;
      const flowColor =
        flowPct >= 50 ? "#33ff66" : flowPct > 0 ? "#ffb000" : "#ff2a2a";
      flowBarMatRef.current.color.set(flowColor);
      flowBarMatRef.current.emissive.set(flowColor);
      flowBarMatRef.current.emissiveIntensity =
        flowPct === 0
          ? 1.35 + Math.sin(clock.getElapsedTime() * 12) * 0.45
          : 0.95;
    }

    const highlightPumpTut =
      (state.tutorialPhase === "STEP_1_COOLING" &&
        (!isPumpOn || state.pumpThrottle[pumpIndex] < 50)) ||
      (state.tutorialPhase === "STEP_7_VOID_DRILL" &&
        state.voidFraction >= 0.2) ||
      (!state.isBlackout && state.coreTemp > 650);
    const isColdStandby =
      !isPumpOn &&
      state.thermalPower < 50 &&
      state.tutorialPhase !== "COMPLETED" &&
      !state.isBlackout;
    const lampSig = `${isPumpOn}|${isColdStandby}|${state.isBlackout}`;
    if (highlightPumpTut && lampMatRef.current) {
      lastPumpOnRef.current = null;
      const pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 6.0);
      lampMatRef.current.color.set(pulse > 0.5 ? "#33ff66" : "#ffb000");
      lampMatRef.current.emissive.set(pulse > 0.5 ? "#33ff66" : "#ffb000");
      lampMatRef.current.emissiveIntensity = 1.6 + pulse * 1.4;
    } else if (lampMatRef.current && lampSig !== lastPumpOnRef.current) {
      lastPumpOnRef.current = lampSig;
      if (isPumpOn) {
        lampMatRef.current.color.set("#33ff66");
        lampMatRef.current.emissive.set("#33ff66");
        lampMatRef.current.emissiveIntensity = 1.5;
      } else if (isColdStandby) {
        lampMatRef.current.color.set("#6e5218");
        lampMatRef.current.emissive.set("#6e5218");
        lampMatRef.current.emissiveIntensity = 0.35;
      } else {
        lampMatRef.current.color.set("#ff2a2a");
        lampMatRef.current.emissive.set("#ff2a2a");
        lampMatRef.current.emissiveIntensity = 0.8;
      }
    }
  });

  const handleLeverPointerDown = (e: ThreeEvent<PointerEvent>) => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    const flowId = pumpIndex === 0 ? "pumpAFlow" : "pumpBFlow";
    const curThrottle = useGameStore.getState().pumpThrottle[pumpIndex] ?? 0;
    dragCleanupRef.current = startLinearVerticalLeverDrag(
      e,
      curThrottle,
      0,
      100,
      (nextVal) => {
        useGameStore.getState().setPumpThrottle(pumpIndex, nextVal);
      },
      (active) => {
        pumpDraggingRef.current = active;
        notifyPlayerControlInteraction(flowId, active);
        if (!active) {
          dragCleanupRef.current = null;
        }
      },
      150,
    );
  };

  return (
    <group
      position={position}
      scale={scale}
      onPointerOver={(e) => {
        e.stopPropagation();
        useGameStore.getState().setHoveredDiagnosticId("core");
      }}
      onPointerOut={() => {
        const st = useGameStore.getState();
        if (st.hoveredDiagnosticId === "core") {
          st.setHoveredDiagnosticId(null);
        }
      }}
    >
      {/* Bolted Dark Cast-Iron Mounting Backplate Flush Against Vertical Riser */}
      <mesh position={[0, 0.015, 0.018]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.405, 0.465, 0.016]} />
        <meshStandardMaterial
          color="#161c19"
          roughness={0.46}
          metalness={0.68}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
          roughnessMap={ironTex.roughnessMap}
        />
      </mesh>
      {/* Single clean invisible backing hitbox so assembly hover works without raycasting trim */}
      <mesh position={[0, 0, 0.015]}>
        <boxGeometry args={[0.42, 0.48, 0.012]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Raised Engraved Brass & Iron Nameplate */}
      <mesh position={[0, 0.2, 0.032]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.398, 0.094, 0.012]} />
        <meshStandardMaterial
          color="#8c7a4b"
          metalness={0.85}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
        />
      </mesh>
      <mesh position={[0, 0.2, 0.041]} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[0.382, 0.082]} />
        <meshStandardMaterial
          map={nameplateTex}
          emissive="#ffffff"
          emissiveMap={nameplateTex}
          emissiveIntensity={0.35}
          roughness={0.55}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* Caged Soviet Jewel Lamp & Backlit Status Block */}
      <CagedSovietJewelLamp3D
        position={[-0.132, 0.125, 0.038]}
        lampMatRef={lampMatRef}
        scale={0.78}
      />
      <SovietBacklitIndicatorBlock3D
        position={[0.044, 0.125, 0.038]}
        scale={0.94}
        label={pumpIndex === 0 ? "PUMP A" : "PUMP B"}
        getAlertState={(s) => {
          const bHeat = pumpIndex === 0 ? s.pumpAHeat : s.pumpBHeat;
          const isOperating =
            s.thermalPower > 220 || s.tutorialPhase === "COMPLETED";
          return {
            level:
              s.coreTemp > 600 ||
              (isOperating && !s.pumpsActive[pumpIndex]) ||
              bHeat >= 82
                ? "critical"
                : s.coreTemp > 540 ||
                    (isOperating && s.pressureBar < 34) ||
                    bHeat >= 64
                  ? "warn"
                  : "normal",
            acknowledged: pumpDraggingRef.current,
          };
        }}
      />

      {/* Left & Right Brass Graduation Scale Plates (0% STOP -> 100% MAX, 50-85% NOMINAL) */}
      <group position={[-0.131, -0.004, 0.039]}>
        <mesh raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.11, 0.204, 0.008]} />
          <meshStandardMaterial
            color="#8c7a4b"
            metalness={0.85}
            roughness={0.28}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>
        <mesh position={[0, 0, 0.0065]} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.102, 0.194]} />
          <meshStandardMaterial
            map={leftScalePlateTex}
            emissive="#ffffff"
            emissiveMap={leftScalePlateTex}
            emissiveIntensity={0.38}
            roughness={0.55}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>
      <group position={[0.131, -0.004, 0.039]}>
        <mesh raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.11, 0.204, 0.008]} />
          <meshStandardMaterial
            color="#8c7a4b"
            metalness={0.85}
            roughness={0.28}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>
        <mesh position={[0, 0, 0.0065]} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.102, 0.194]} />
          <meshStandardMaterial
            map={rightScalePlateTex}
            emissive="#ffffff"
            emissiveMap={rightScalePlateTex}
            emissiveIntensity={0.38}
            roughness={0.55}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>

      {/* Centered Scaled-Up Soviet T-Handle Throttle Lever (PUMP THROTTLE LEVER) */}
      <group
        position={[0, -0.004, 0.034]}
        onPointerOver={(e) => {
          e.stopPropagation();
          useGameStore
            .getState()
            .setHoveredControlHint(
              `PUMP THROTTLE LEVER (${pumpIndex === 0 ? "MCP 1-2" : "MCP 3-4"}): Drag Up/Down or Scroll (±2% | Shift ±1%) to adjust pump flow % (50–85% = Nominal, 0% = Stop)!`,
            );
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          useGameStore.getState().setHoveredControlHint(null);
        }}
        onWheel={(e) => {
          if (useCameraLookStore.getState().isFreeLookMode) return;
          e.stopPropagation();
          e.nativeEvent?.stopImmediatePropagation?.();
          const fine = Boolean(e.shiftKey || e.nativeEvent?.shiftKey);
          const step = (e.deltaY < 0 ? 1 : -1) * (fine ? 1 : 2);
          const s = useGameStore.getState();
          const curThrottle = s.pumpThrottle[pumpIndex] ?? 75;
          const nextThrottle = THREE.MathUtils.clamp(
            Math.round(curThrottle + step),
            0,
            100,
          );
          if (nextThrottle !== Math.round(curThrottle)) {
            playDetentClick((Math.abs(nextThrottle) % 5) + 1);
            s.setPumpThrottle(pumpIndex, nextThrottle);
          }
        }}
        onPointerDown={handleLeverPointerDown}
      >
        {/* Scaled-up invisible hitbox covering the full centered throttle slot & T-handle */}
        <mesh position={[0, 0, 0.088]}>
          <boxGeometry args={[0.25, 0.24, 0.21]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* Heavy Cast-Iron Slotted Quadrant Box */}
        <mesh raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.146, 0.206, 0.044]} />
          <meshStandardMaterial
            color="#181c1a"
            roughness={0.46}
            metalness={0.68}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        {/* Deep Machined Vertical Travel Slot */}
        <mesh position={[0, 0, 0.019]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.044, 0.168, 0.012]} />
          <meshStandardMaterial color="#070a09" roughness={0.9} />
        </mesh>
        {/* Twin Beveled Brushed-Steel Guide Rails */}
        {[-0.03, 0.03].map((rx, rIdx) => (
          <mesh key={rIdx} position={[rx, 0, 0.023]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.014, 0.178, 0.01]} />
            <meshStandardMaterial
              color="#8a929a"
              metalness={0.86}
              roughness={0.3}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
        ))}
        {/* Top & Bottom Brass End-Stop Bumpers */}
        {[-0.088, 0.088].map((by, bIdx) => (
          <mesh key={bIdx} position={[0, by, 0.024]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.076, 0.014, 0.012]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.85}
              roughness={0.28}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
        ))}
        {/* 4 Corner Brass Hex Bolts */}
        {(
          [
            [-0.058, 0.088],
            [0.058, 0.088],
            [-0.058, -0.088],
            [0.058, -0.088],
          ] as const
        ).map(([bx, by], hIdx) => (
          <mesh
            key={hIdx}
            position={[bx, by, 0.024]}
            rotation={[Math.PI / 2, 0, 0]}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.007, 0.007, 0.01, 6]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.88}
              roughness={0.26}
            />
          </mesh>
        ))}
        {/* Top & Bottom Heavy Copper Contact Jaws */}
        {[-0.068, 0.068].map((cy, cIdx) => (
          <group key={cIdx} position={[0, cy, 0.026]}>
            <mesh position={[-0.034, 0, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.011, 0.03, 0.024]} />
              <meshStandardMaterial
                color="#b8733e"
                metalness={0.88}
                roughness={0.28}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
            <mesh position={[0.034, 0, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.011, 0.03, 0.024]} />
              <meshStandardMaterial
                color="#b8733e"
                metalness={0.88}
                roughness={0.28}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
          </group>
        ))}

        {/* Animated Lever Carriage & Chunky Soviet T-Handle */}
        <group ref={leverArmRef} position={[0, 0, 0.022]}>
          {/* Twin Heavy Forged Copper Throttle Arms */}
          {[-0.034, 0.034].map((lx, lIdx) => (
            <mesh
              key={lIdx}
              position={[lx, 0, 0.064]}
              rotation={[Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.012, 0.128, 0.024]} />
              <meshStandardMaterial
                color="#b8733e"
                roughness={0.26}
                metalness={0.88}
              />
            </mesh>
          ))}
          {/* Heavy Lathe-Turned Dark Phenolic Bakelite T-Bar Crossbar Grip */}
          <mesh
            position={[0, 0, 0.13]}
            rotation={[0, 0, Math.PI / 2]}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.029, 0.029, 0.184, 16]} />
            <meshStandardMaterial
              color="#1c1817"
              roughness={0.32}
              metalness={0.15}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
          {/* Brushed Steel End-Ferrules */}
          {[-0.084, 0.084].map((fx, fIdx) => (
            <mesh
              key={fIdx}
              position={[fx, 0, 0.13]}
              rotation={[0, 0, Math.PI / 2]}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.0315, 0.0315, 0.02, 14]} />
              <meshStandardMaterial
                color="#8a929a"
                metalness={0.85}
                roughness={0.35}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
          ))}
          {/* Oxidized Crimson Enamel Center Index Collar */}
          <mesh
            position={[0, 0, 0.13]}
            rotation={[0, 0, Math.PI / 2]}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.0305, 0.0305, 0.014, 14]} />
            <meshStandardMaterial
              color="#7c1d16"
              roughness={0.38}
              metalness={0.25}
            />
          </mesh>
        </group>
      </group>

      {/* Centered THROTTLE: FLOW % Sub-Label Plaque */}
      <group position={[0, -0.125, 0.042]}>
        <mesh raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.368, 0.03, 0.008]} />
          <meshStandardMaterial
            color="#8c7a4b"
            metalness={0.85}
            roughness={0.28}
          />
        </mesh>
        <mesh position={[0, 0, 0.0065]} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.356, 0.025]} />
          <meshStandardMaterial
            map={leverSubLabelTex}
            emissive="#ffffff"
            emissiveMap={leverSubLabelTex}
            emissiveIntensity={0.38}
            roughness={0.55}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>

      {/* Live PUMP FLOW: XXX% Bargraph & Digital Status Plate */}
      <group position={[0, -0.178, 0.038]}>
        <mesh raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.376, 0.068, 0.016]} />
          <meshStandardMaterial
            color="#101513"
            roughness={0.5}
            metalness={0.7}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        <mesh position={[0, 0, 0.0105]} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.36, 0.06]} />
          <meshStandardMaterial
            ref={flowScaleMatRef}
            map={flowScaleTex}
            emissive="#ffffff"
            emissiveMap={flowScaleTex}
            emissiveIntensity={0.45}
            roughness={0.75}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
        <mesh
          ref={flowBarMeshRef}
          position={[0, -0.013, 0.0155]}
          raycast={NOOP_RAYCAST}
        >
          <boxGeometry args={[0.324, 0.016, 0.008]} />
          <meshStandardMaterial
            ref={flowBarMatRef}
            color="#33ff66"
            emissive="#33ff66"
            emissiveIntensity={1.15}
          />
        </mesh>
      </group>
    </group>
  );
};

interface IndustrialPowerColumn3DProps {
  position: [number, number, number];
  sector: SectorNodeId;
  label: string;
  subLabel?: string;
  accentColor: string;
  ledColor: string;
  minusBtnTex: THREE.CanvasTexture;
  plusBtnTex: THREE.CanvasTexture;
}

const SECTOR_KOMRAD_ID_MAP: Readonly<Record<SectorNodeId, string>> = {
  pripyat: "sector_0",
  duga: "sector_1",
  kolkhoz: "sector_2",
  kgb: "sector_3",
  vodka: "sector_4",
  steel: "sector_5",
};

const IndustrialPowerColumn3D: React.FC<IndustrialPowerColumn3DProps> = ({
  position,
  sector,
  label,
  subLabel,
  accentColor,
  ledColor,
  minusBtnTex,
  plusBtnTex,
}) => {
  const blockMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const readoutMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const handleRingMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const leverGroupRef = useRef<THREE.Group>(null);
  const btnCapMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const btnGroupRefs = useRef<Array<THREE.Group | null>>([]);
  const lastBlockStateRef = useRef("");
  const lastReadoutSigRef = useRef("");
  const lastReadoutDrawRef = useRef(-1);
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  const komradSectorId = SECTOR_KOMRAD_ID_MAP[sector];

  useEffect(() => {
    registerKomradControlObject(komradSectorId, leverGroupRef.current, [
      0,
      0,
      0.064,
    ]);
    return () => {
      registerKomradControlObject(komradSectorId, null);
    };
  }, [komradSectorId]);

  const dragRef = useRef<{
    active: boolean;
    startClientY: number;
    startMW: number;
  }>({
    active: false,
    startClientY: 0,
    startMW: 0,
  });

  const ribbedGlassTex = useMemo(() => getRibbedGlassCellTexture(), []);

  const readoutTex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 112;
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const maxSectorMW = 250;

  const minus5BtnTex = useMemo(
    () =>
      createCrispPanelTexture(160, 72, (ctx, w, h) => {
        ctx.fillStyle = "#181d1a";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#ffb000";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#ffb000";
        ctx.font = '900 44px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("-25", w / 2, h / 2 + 2);
      }),
    [],
  );

  const plus5BtnTex = useMemo(
    () =>
      createCrispPanelTexture(160, 72, (ctx, w, h) => {
        ctx.fillStyle = "#18241d";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#33ff66";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#33ff66";
        ctx.font = '900 44px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("+25", w / 2, h / 2 + 2);
      }),
    [],
  );

  const labelTex = useMemo(
    () =>
      makePlaqueTex(label, subLabel ?? "PRIPYAT", {
        width: 400,
        height: 110,
        titleSize: 38,
        subSize: 32,
        subColor: "#ffe066",
      }),
    [label, subLabel],
  );

  const mwScalePlateTex = useMemo(
    () =>
      createCrispPanelTexture(96, 420, (ctx, w, h) => {
        ctx.fillStyle = "#161a18";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        const marks = ["250", "200", "150", "100", "50", "0"];
        marks.forEach((m, idx) => {
          const y = 32 + idx * 71;
          ctx.fillStyle = idx === 0 ? "#ff4433" : "#e6dec3";
          ctx.font = 'bold 28px "VT323", monospace';
          ctx.textAlign = "right";
          ctx.fillText(m, w - 22, y + 9);
          ctx.fillStyle = idx === 0 ? "#ff4433" : "#ffb000";
          ctx.fillRect(w - 18, y - 2, 13, 5);
          if (idx < marks.length - 1) {
            ctx.fillStyle = "#8c7a4b";
            ctx.fillRect(w - 12, y + 34, 7, 3);
          }
        });
      }),
    [],
  );

  useFrame(({ clock }) => {
    const state = useGameStore.getState();
    const currentMW = state.sectorMW[sector];
    const targetMW = state.targetSectorMW[sector];
    const {
      mode: quotaMode,
      isMatched: sectorQuotaMatched,
      diff: sectorQuotaDiff,
    } = getSectorQuotaStatus(state.substations, sector, currentMW, targetMW);
    const highlightTut =
      state.tutorialPhase === "STEP_6_BASELINE_600MW" && currentMW !== targetMW;
    if (handleRingMatRef.current) {
      if (highlightTut) {
        const pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 6.0);
        handleRingMatRef.current.color.set(
          pulse > 0.5 ? "#33ff66" : "#ffb000",
        );
        handleRingMatRef.current.emissive.set(
          pulse > 0.5 ? "#33ff66" : "#ffb000",
        );
        handleRingMatRef.current.emissiveIntensity = 1.4 + pulse * 1.2;
      } else {
        handleRingMatRef.current.color.set(accentColor);
        handleRingMatRef.current.emissive.set("#000000");
        handleRingMatRef.current.emissiveIntensity = 0;
      }
    }
    // Map 0..maxSectorMW across 10 physical 3D ribbed phosphor glass cell segments
    const activeBlocks = Math.round((currentMW / maxSectorMW) * 10);
    const sig = `${activeBlocks}`;

    if (sig !== lastBlockStateRef.current) {
      lastBlockStateRef.current = sig;
      for (let i = 0; i < 10; i++) {
        const mat = blockMatRefs.current[i];
        if (!mat) continue;
        const isLit = i < activeBlocks;
        const colorHex = i >= 9 ? "#28b862" : i >= 7 ? "#ffb000" : ledColor;
        mat.color.set(isLit ? colorHex : "#141916");
        mat.emissive.set(isLit ? colorHex : "#000000");
        mat.emissiveIntensity = isLit ? 1.15 : 0;
      }
    }

    const now = clock.getElapsedTime();
    if (
      !state.diagFeedActive &&
      (lastReadoutDrawRef.current < 0 || now - lastReadoutDrawRef.current >= 0.105)
    ) {
      lastReadoutDrawRef.current = now;
      const readoutSig = `${currentMW}|${targetMW}|${quotaMode}|${highlightTut}`;
      const tex = readoutMatRef.current?.map as THREE.CanvasTexture | undefined;
      if (tex && readoutSig !== lastReadoutSigRef.current) {
        lastReadoutSigRef.current = readoutSig;
        const canvas = tex.image as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          const isMatched = sectorQuotaMatched;
          const isClose = sectorQuotaDiff <= 25;
          const primaryColor = highlightTut
            ? "#ffb000"
            : isMatched
              ? "#33ff66"
              : isClose
                ? "#ffb000"
                : "#ff3333";

          ctx.fillStyle = "#06110b";
          ctx.fillRect(0, 0, w, h);

          // Subtle scanlines
          ctx.fillStyle = "rgba(51, 255, 102, 0.06)";
          for (let y = 0; y < h; y += 4) {
            ctx.fillRect(0, y, w, 2);
          }

          ctx.strokeStyle = highlightTut
            ? "#ffb000"
            : isMatched
              ? "#28b862"
              : "#ff6b2a";
          ctx.lineWidth = 4;
          ctx.strokeRect(2, 2, w - 4, h - 4);

          const targetLabel =
            quotaMode === "min"
              ? `>=${targetMW}`
              : quotaMode === "max"
                ? `<=${targetMW}`
                : `${targetMW}`;

          // Enlarged High-Legibility Nixie / Phosphor Readout: "200 / 200 MW" (~1.45x larger)
          drawFittedPlaqueText(
            ctx,
            `${currentMW} / ${targetLabel} MW`,
            w / 2,
            86,
            w + 6,
            '900 94px "VT323", monospace',
            primaryColor,
            "#001a00",
            3.6,
            "1.5px",
          );

          tex.needsUpdate = true;
        }
        if (readoutMatRef.current) {
          readoutMatRef.current.emissiveIntensity = sectorQuotaMatched
            ? 0.95
            : 1.25;
        }
      }
    }

    if (leverGroupRef.current) {
      const ratio = THREE.MathUtils.clamp(currentMW / maxSectorMW, 0, 1);
      const targetY = -0.225 + ratio * 0.45;
      leverGroupRef.current.position.y = THREE.MathUtils.lerp(
        leverGroupRef.current.position.y,
        targetY,
        0.25,
      );
    }
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return;
    e.stopPropagation();
    const state = useGameStore.getState();
    if (state.komradOverrideLocked) {
      playLeverRatchet(0.45);
      return;
    }
    const startClientX = e.nativeEvent.clientX;
    const startClientY = e.nativeEvent.clientY;
    const startMW = state.sectorMW[sector];
    let totalMovement = 0;

    dragRef.current = {
      active: true,
      startClientY,
      startMW,
    };
    notifyPlayerControlInteraction(komradSectorId, true);
    playSwitchClank(true);

    const onWindowMove = (ev: PointerEvent) => {
      if (!dragRef.current.active) return;
      const s = useGameStore.getState();
      if (s.komradOverrideLocked) {
        dragRef.current.active = false;
        notifyPlayerControlInteraction(komradSectorId, false);
        return;
      }
      totalMovement = Math.max(
        totalMovement,
        Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY),
      );
      const deltaY = dragRef.current.startClientY - ev.clientY;
      const rawTargetMW =
        dragRef.current.startMW + (deltaY / 110) * maxSectorMW;
      const snappedMW = THREE.MathUtils.clamp(
        Math.round(rawTargetMW / 25) * 25,
        0,
        maxSectorMW,
      );
      if (snappedMW !== s.sectorMW[sector]) {
        const deltaMW = snappedMW - s.sectorMW[sector];
        playDetentClick(Math.round(snappedMW / 25));
        playContactorInrushClunk(deltaMW);
        s.setSectorPower(sector, snappedMW);
      }
    };

    const onWindowUp = () => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      notifyPlayerControlInteraction(komradSectorId, false);
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerup", onWindowUp);
      window.removeEventListener("pointercancel", onWindowUp);
      if (totalMovement < 6) {
        const s = useGameStore.getState();
        const cur = s.sectorMW[sector];
        const nextMW = cur >= maxSectorMW ? 0 : cur + 25;
        playDetentClick(Math.round(nextMW / 25));
        playContactorInrushClunk(nextMW - cur);
        s.setSectorPower(sector, nextMW);
      }
      playSwitchClank(false);
    };

    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowUp);
    window.addEventListener("pointercancel", onWindowUp);
  };

  const handleWheel = (e: ThreeEvent<WheelEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return;
    e.stopPropagation();
    e.nativeEvent?.stopImmediatePropagation?.();
    const s = useGameStore.getState();
    const stepMW = e.deltaY < 0 ? 25 : -25;
    const nextMW = Math.max(0, Math.min(250, s.sectorMW[sector] + stepMW));
    if (nextMW !== s.sectorMW[sector]) {
      const deltaMW = nextMW - s.sectorMW[sector];
      playDetentClick(Math.round(nextMW / 25));
      playContactorInrushClunk(deltaMW);
      s.setSectorPower(sector, nextMW);
    }
  };

  const stepButtons = [
    {
      idx: 0,
      pos: [-0.072, -0.344, 0.03] as const,
      delta: -25,
      tex: minus5BtnTex,
      bodyCol: "#18211b",
    },
    {
      idx: 1,
      pos: [0.072, -0.344, 0.03] as const,
      delta: 25,
      tex: plus5BtnTex,
      bodyCol: "#23312b",
    },
    {
      idx: 2,
      pos: [-0.072, -0.408, 0.03] as const,
      delta: -50,
      tex: minusBtnTex,
      bodyCol: "#18211b",
    },
    {
      idx: 3,
      pos: [0.072, -0.408, 0.03] as const,
      delta: 50,
      tex: plusBtnTex,
      bodyCol: "#23312b",
    },
  ] as const;

  const setButtonHover = (idx: number, hovered: boolean, delta: number) => {
    const capMat = btnCapMatRefs.current[idx];
    const grp = btnGroupRefs.current[idx];
    if (capMat) {
      capMat.emissiveIntensity = hovered ? 0.55 : 0.1;
    }
    if (grp) {
      grp.position.z = hovered ? 0.034 : 0.03;
    }
    const hint = hovered
      ? `[CLICK]: ${delta > 0 ? "+" : ""}${delta} MW FOR ${label} | [SCROLL WHEEL]: ±25 MW`
      : `[SCROLL WHEEL]: ADJUST ${label} (±25 MW) | [DRAG / CLICK]: SET MW (0–250 MW)`;
    useGameStore.getState().setHoveredControlHint(hint);
  };

  return (
    <group
      position={position}
      onWheel={handleWheel}
      onPointerOver={() => {
        useGameStore
          .getState()
          .setHoveredControlHint(
            `[SCROLL WHEEL]: ADJUST ${label} (±25 MW) | [DRAG / CLICK]: SET MW (0–250 MW)`,
          );
      }}
      onPointerOut={() => {
        useGameStore.getState().setHoveredControlHint(null);
      }}
    >
      {/* Non-overlapping Full-Column Scroll Hit-Box behind fader & buttons (0.284 < 0.304 pitch so neighboring sectors never snag) */}
      <mesh position={[0, 0, 0.012]}>
        <boxGeometry args={[0.284, 0.88, 0.014]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Dark Brushed-Steel Channel Sub-Plate */}
      <mesh position={[0, 0, 0.01]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.286, 0.888, 0.01]} />
        <meshStandardMaterial
          color="#161b18"
          roughness={0.5}
          metalness={0.62}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.006}
        />
      </mesh>

      {/* Enlarged Brass-Bordered Channel Header Plaque */}
      <mesh position={[0, 0.396, 0.02]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.28, 0.084, 0.012]} />
        <meshStandardMaterial
          color="#8c7a4b"
          metalness={0.85}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
        />
      </mesh>
      <mesh position={[0, 0.396, 0.028]} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[0.268, 0.074]} />
        <meshStandardMaterial
          map={labelTex}
          emissive="#ffffff"
          emissiveMap={labelTex}
          emissiveIntensity={0.34}
          roughness={0.55}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* High-Legibility Recessed Nixie / Digital Readout Window ("100 / 100 MW") */}
      <group position={[0, 0.302, 0.024]}>
        <mesh raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.282, 0.088, 0.022]} />
          <meshStandardMaterial
            color="#121715"
            roughness={0.38}
            metalness={0.78}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>
        <mesh position={[0, 0, 0.014]} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.27, 0.076]} />
          <meshStandardMaterial
            ref={readoutMatRef}
            map={readoutTex}
            emissive="#ffffff"
            emissiveMap={readoutTex}
            emissiveIntensity={0.95}
            roughness={0.22}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>

      {/* Backlit Soviet Control Indicator Block Centered Above Bargraph & Fader */}
      <SovietBacklitIndicatorBlock3D
        position={[0, 0.232, 0.024]}
        scale={0.92}
        label="MW QUOTA"
        getAlertState={(s) => {
          const { diff } = getSectorQuotaStatus(
            s.substations,
            sector,
            s.sectorMW[sector],
            s.targetSectorMW[sector],
          );
          return {
            level: diff >= 75 ? "critical" : diff > 0 ? "warn" : "normal",
            acknowledged: dragRef.current.active,
          };
        }}
      />

      {/* Full-Height (~2x Taller) 10-Segment Ribbed Phosphor Glass Bargraph */}
      <group position={[-0.07, -0.048, 0.022]}>
        <mesh position={[0, 0, 0.002]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.118, 0.504, 0.026]} />
          <meshStandardMaterial
            color="#181e1b"
            roughness={0.44}
            metalness={0.72}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        {[-0.052, 0.052].map((rx, rIdx) => (
          <mesh key={rIdx} position={[rx, 0, 0.015]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.014, 0.5, 0.014]} />
            <meshStandardMaterial
              color="#222826"
              metalness={0.76}
              roughness={0.38}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
        ))}
        <mesh geometry={POWER_COL_4_BOLTS_GEO} raycast={NOOP_RAYCAST}>
          <meshStandardMaterial color="#8a929a" metalness={0.86} roughness={0.3} />
        </mesh>
        <mesh geometry={POWER_COL_10_LOUVERS_GEO} raycast={NOOP_RAYCAST}>
          <meshStandardMaterial
            color="#141816"
            metalness={0.78}
            roughness={0.38}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        {Array.from({ length: 10 }).map((_, idx) => (
          <mesh
            key={idx}
            position={[0, -0.209 + idx * 0.0465, 0.012]}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.088, 0.034, 0.015]} />
            <meshStandardMaterial
              ref={(el) => {
                blockMatRefs.current[idx] = el;
              }}
              map={ribbedGlassTex}
              emissiveMap={ribbedGlassTex}
              color="#141916"
              roughness={0.24}
              metalness={0.18}
            />
          </mesh>
        ))}
      </group>

      {/* Full-Height (~2x Longer) Bolted Cast-Iron Quadrant Fader with Chunky 3D T-Bar Slider */}
      <group position={[0.066, -0.048, 0.025]} onPointerDown={handlePointerDown}>
        {/* Non-overlapping Drag Collider (0.142 wide stays inside ±0.144 column bounds) */}
        <mesh position={[0, 0, 0.052]}>
          <boxGeometry args={[0.142, 0.51, 0.14]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.132, 0.504, 0.032]} />
          <meshStandardMaterial
            color="#1c2220"
            roughness={0.44}
            metalness={0.72}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        {[-0.054, 0.054].map((rx, rIdx) => (
          <mesh key={rIdx} position={[rx, 0, 0.018]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.018, 0.496, 0.012]} />
            <meshStandardMaterial
              color="#2b3036"
              metalness={0.82}
              roughness={0.34}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
        ))}
        <mesh geometry={POWER_COL_6_BOLTS_GEO} raycast={NOOP_RAYCAST}>
          <meshStandardMaterial color="#8a929a" metalness={0.86} roughness={0.28} />
        </mesh>
        {/* High-Contrast Engraved 0-250 MW Scale Plate Alongside Slot */}
        <mesh position={[-0.034, 0, 0.02]} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.036, 0.46]} />
          <meshStandardMaterial
            map={mwScalePlateTex}
            emissive="#ffffff"
            emissiveMap={mwScalePlateTex}
            emissiveIntensity={0.35}
            metalness={0.45}
            roughness={0.35}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
        {/* Recessed Slot Channel, 24 Dust-Bellows Pleats & 22 Ratchet Teeth */}
        <mesh position={[0.008, 0, 0.012]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.032, 0.462, 0.008]} />
          <meshStandardMaterial color="#080a09" roughness={0.94} />
        </mesh>
        <mesh geometry={POWER_COL_18_PLEATS_GEO} raycast={NOOP_RAYCAST}>
          <meshStandardMaterial color="#161918" roughness={0.85} />
        </mesh>
        <mesh geometry={POWER_COL_20_TEETH_GEO} raycast={NOOP_RAYCAST}>
          <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.28} />
        </mesh>

        {/* Chunky Multi-Part Bakelite T-Bar Handle */}
        <group ref={leverGroupRef} position={[0.008, 0, 0.028]}>
          <mesh position={[0, 0, 0.004]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.048, 0.036, 0.026]} />
            <meshStandardMaterial
              color="#2b3036"
              metalness={0.82}
              roughness={0.32}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          <mesh
            position={[0, 0, 0.006]}
            rotation={[0, 0, Math.PI / 2]}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.009, 0.009, 0.056, 8]} />
            <meshStandardMaterial
              color="#8a929a"
              metalness={0.9}
              roughness={0.22}
            />
          </mesh>
          {[-0.018, 0.018].map((lx, lIdx) => (
            <mesh
              key={lIdx}
              position={[lx, 0, 0.032]}
              rotation={[Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.0072, 0.0082, 0.066, 10]} />
              <meshStandardMaterial
                color="#d4dce0"
                metalness={0.9}
                roughness={0.2}
              />
            </mesh>
          ))}
          <mesh
            position={[0, 0, 0.064]}
            rotation={[0, 0, Math.PI / 2]}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.025, 0.025, 0.128, 14]} />
            <meshStandardMaterial
              color={
                sector === "vodka" || sector === "steel" ? "#4a1210" : "#1c1817"
              }
              roughness={0.32}
              metalness={0.15}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
          {[-0.058, 0.058].map((fx, fIdx) => (
            <mesh
              key={fIdx}
              position={[fx, 0, 0.064]}
              rotation={[0, 0, Math.PI / 2]}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.0265, 0.0265, 0.016, 14]} />
              <meshStandardMaterial
                color="#8a929a"
                metalness={0.85}
                roughness={0.35}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
          ))}
          <mesh
            position={[0, 0, 0.064]}
            rotation={[0, 0, Math.PI / 2]}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.0258, 0.0258, 0.01, 14]} />
            <meshStandardMaterial
              ref={handleRingMatRef}
              color={accentColor}
              roughness={0.36}
              metalness={0.25}
            />
          </mesh>
          <mesh
            position={[0.068, 0, 0.064]}
            rotation={[0, 0, Math.PI / 2]}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.01, 0.01, 0.012, 10]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.86}
              roughness={0.26}
            />
          </mesh>
        </group>
      </group>

      {/* Enlarged 2x2 Quick-Step Plungers (-25 / +25 / -50 / +50 MW) with Tactile Hover Highlights */}
      {stepButtons.map((btn) => (
        <group
          key={btn.idx}
          ref={(el) => {
            btnGroupRefs.current[btn.idx] = el;
          }}
          position={btn.pos}
          onPointerOver={(e) => {
            e.stopPropagation();
            setButtonHover(btn.idx, true, btn.delta);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setButtonHover(btn.idx, false, btn.delta);
          }}
          onClick={(e) => {
            e.stopPropagation();
            const s = useGameStore.getState();
            if (s.komradOverrideLocked) {
              playLeverRatchet(0.4);
              return;
            }
            if (Math.abs(btn.delta) === 50) {
              playLeverRatchet(btn.delta < 0 ? 0.85 : 1.1);
            } else {
              const targetDetent =
                btn.delta < 0
                  ? Math.max(0, Math.round((s.sectorMW[sector] - 25) / 25))
                  : Math.min(10, Math.round((s.sectorMW[sector] + 25) / 25));
              playDetentClick(targetDetent);
            }
            playContactorInrushClunk(btn.delta);
            s.shiftSectorPower(sector, btn.delta);
          }}
        >
          <mesh>
            <boxGeometry args={[0.132, 0.054, 0.034]} />
            <meshStandardMaterial
              color={btn.bodyCol}
              roughness={0.44}
              metalness={0.65}
            />
          </mesh>
          <mesh position={[0, 0, 0.0195]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.122, 0.046]} />
            <meshStandardMaterial
              ref={(el) => {
                btnCapMatRefs.current[btn.idx] = el;
              }}
              map={btn.tex}
              emissive="#ffffff"
              emissiveMap={btn.tex}
              emissiveIntensity={0.1}
              roughness={0.5}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

export const HighDetailReactorPanel3D: React.FC = React.memo(() => {
  const panelGroupRef = useRef<THREE.Group>(null);
  const [az5CoverOpen, setAz5CoverOpen] = useState(false);
  const az5CoverGroupRef = useRef<THREE.Group>(null);
  const az5BtnGroupRef = useRef<THREE.Group>(null);
  const boronPlungerMeshRef = useRef<THREE.Group>(null);
  const boronLampMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const boronDepressRef = useRef(0);

  useEffect(() => {
    registerKomradControlObject("boron", boronPlungerMeshRef.current);
    registerKomradControlObject("az5", az5BtnGroupRef.current, [0, 0, 0.026]);
    registerKomradControlObject("az5Cover", az5CoverGroupRef.current);
    return () => {
      registerKomradControlObject("boron", null);
      registerKomradControlObject("az5", null);
      registerKomradControlObject("az5Cover", null);
    };
  }, []);
  const redlineScaleBlockRefs = useRef<
    Array<THREE.MeshStandardMaterial | null>
  >([]);
  const statusMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lastStatusDrawRef = useRef(-1);

  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  const ribbedGlassTex = useMemo(() => getRibbedGlassCellTexture(), []);

  const boronPlateTex = useMemo(
    () =>
      makePlaqueTex("BORON INJECTION", "-140°C // 45%", {
        width: 384,
        height: 104,
        titleSize: 30,
        subSize: 28,
        titleColor: "#33ff66",
        subColor: "#ffcc00",
        borderColor: "#28b862",
      }),
    [],
  );

  const boronCapTex = useMemo(
    () =>
      createCrispPanelTexture(128, 128, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        ctx.fillStyle = "#1b6e38";
        ctx.beginPath();
        ctx.arc(cx, cy, 58, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#c8d6cd";
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = '900 26px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("BORON", cx, cy - 12);
        ctx.fillStyle = "#ffcc00";
        ctx.font = '900 24px "VT323", monospace';
        ctx.fillText("-140°C", cx, cy + 16);
      }),
    [],
  );

  const statusTexture = useMemo(() => createCrispPanelTexture(768, 144), []);
  const lastTotalBlocksSigRef = useRef("");

  const topHeaderPlateTex = useMemo(
    () =>
      makePlaqueTex("REACTOR SAFETY & 1000 MW GRID ROUTING • UNIT A", "", {
        width: 896,
        height: 64,
        titleSize: 26,
        titleColor: "#ffffff",
        titleStroke: "#ffffff",
        borderColor: "#b8a46b",
      }),
    [],
  );

  const az5PlateTex = useMemo(
    () =>
      makePlaqueTex("AZ-5 SCRAM", "EMERGENCY SCRAM", {
        width: 384,
        height: 104,
        titleSize: 35,
        subSize: 27,
        titleColor: "#ff4444",
        subColor: "#ffcc00",
        borderColor: "#c92a1d",
      }),
    [],
  );

  const az5HazardTex = useMemo(
    () =>
      createCrispPanelTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = "#c48a18";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#141414";
        for (let i = -256; i < 512; i += 36) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + 18, 0);
          ctx.lineTo(i + 18 + h, h);
          ctx.lineTo(i + h, h);
          ctx.closePath();
          ctx.fill();
        }
      }),
    [],
  );

  const az5ButtonTopTex = useMemo(
    () =>
      createCrispPanelTexture(128, 128, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        ctx.fillStyle = "#8a1612";
        ctx.beginPath();
        ctx.arc(cx, cy, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#d4be7f";
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = '900 32px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("AZ-5", cx, cy - 10);
        ctx.font = '900 22px "Kremlin", monospace';
        ctx.fillText("SCRAM", cx, cy + 18);
      }),
    [],
  );

  const minusBtnTex = useMemo(
    () =>
      createCrispPanelTexture(160, 72, (ctx, w, h) => {
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#ffb000";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#ffcc00";
        ctx.font = '900 44px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("-50", w / 2, h / 2 + 2);
      }),
    [],
  );

  const plusBtnTex = useMemo(
    () =>
      createCrispPanelTexture(160, 72, (ctx, w, h) => {
        ctx.fillStyle = "#1c2b24";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#33ff66";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#44ff77";
        ctx.font = '900 44px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("+50", w / 2, h / 2 + 2);
      }),
    [],
  );

  useEffect(() => {
    applySovietPBRToHierarchy(panelGroupRef.current);
    panelGroupRef.current?.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = false;
        obj.receiveShadow = false;
      }
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift" && !e.repeat) {
        playSwitchClank(true);
        useGameStore.getState().setShiftKeyHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        playSwitchClank(false);
        useGameStore.getState().setShiftKeyHeld(false);
      }
    };
    const handleBlur = () => {
      useGameStore.getState().setShiftKeyHeld(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const s = useGameStore.getState();
      if (s.phase !== "playing" || s.lobbyMenuPhase === "menu_locked") return;
      const isRedline =
        (s.tutorialPhase === "COMPLETED" &&
          (s.coreTemp >= 580 ||
            s.drumPressure >= 80 ||
            s.voidFraction >= 0.45 ||
            s.redlineInstability >= 50)) ||
        s.coreTemp >= 700 ||
        s.drumPressure >= 88;
      updateSoundtrackState(isRedline, s.isMusicMuted);

      const radExcess = Math.max(0, s.roomRadiation - 0.45);
      const clickProb =
        radExcess <= 0
          ? 0
          : Math.min(0.95, 0.04 + (radExcess / 11.5) * 0.88);
      if (clickProb > 0 && Math.random() < clickProb) {
        playGeigerClick();
      }
    }, 280);
    return () => window.clearInterval(timer);
  }, []);

  useFrame(({ clock }, delta) => {
    const state = useGameStore.getState();
    state.tickThermodynamics(delta);

    if (az5CoverGroupRef.current) {
      const coverOverride = getKomradControlVisualOverride("az5Cover");
      const effectiveOpen =
        coverOverride >= 0 ? coverOverride >= 0.5 : az5CoverOpen;
      const targetRotX = effectiveOpen ? -1.95 : 0;
      az5CoverGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        az5CoverGroupRef.current.rotation.x,
        targetRotX,
        0.22,
      );
    }

    if (boronDepressRef.current > 0) {
      boronDepressRef.current = Math.max(0, boronDepressRef.current - delta * 2.5);
    }
    if (boronPlungerMeshRef.current) {
      const boronOverride = getKomradControlVisualOverride("boron");
      const effectiveDepress =
        boronOverride >= 0
          ? Math.max(boronDepressRef.current, boronOverride)
          : boronDepressRef.current;
      const targetZ = 0.036 - effectiveDepress * 0.03;
      boronPlungerMeshRef.current.position.z = THREE.MathUtils.lerp(
        boronPlungerMeshRef.current.position.z,
        targetZ,
        0.3,
      );
    }
    if (boronLampMatRef.current) {
      const ready = !state.az5Active;
      if (boronLampMatRef.current.userData.lastReady !== ready) {
        boronLampMatRef.current.userData.lastReady = ready;
        boronLampMatRef.current.color.set(ready ? "#33ff66" : "#ff2a2a");
        boronLampMatRef.current.emissive.set(ready ? "#33ff66" : "#ff2a2a");
        boronLampMatRef.current.emissiveIntensity = ready ? 1.4 : 1.8;
      }
    }

    const totalSuppliedMW =
      state.sectorMW.pripyat +
      state.sectorMW.kolkhoz +
      state.sectorMW.duga +
      state.sectorMW.kgb +
      state.sectorMW.vodka +
      state.sectorMW.steel;
    const activeTotalBlocks = Math.round((totalSuppliedMW / 1000) * 18);
    const totalBlocksSig = `${activeTotalBlocks}`;
    if (totalBlocksSig !== lastTotalBlocksSigRef.current) {
      lastTotalBlocksSigRef.current = totalBlocksSig;
      for (let i = 0; i < 18; i++) {
        const mat = redlineScaleBlockRefs.current[i];
        if (!mat) continue;
        const isLit = i < activeTotalBlocks;
        const isHighBlock = i >= 16;
        const hex = isHighBlock ? "#28b862" : i >= 12 ? "#d98218" : "#28b862";
        mat.color.set(isLit ? hex : "#141916");
        mat.emissive.set(isLit ? hex : "#000000");
        mat.emissiveIntensity = isLit ? 1.15 : 0;
      }
    }

    const now = clock.getElapsedTime();
    if (
      state.diagFeedActive ||
      (lastStatusDrawRef.current >= 0 && now - lastStatusDrawRef.current < 0.105)
    )
      return;
    lastStatusDrawRef.current = now;

    const all6Matched = (Object.keys(state.sectorMW) as SectorNodeId[]).every(
      (key) =>
        getSectorQuotaStatus(
          state.substations,
          key,
          state.sectorMW[key],
          state.targetSectorMW[key],
        ).isMatched,
    );

    const totalTargetMW =
      state.targetSectorMW.pripyat +
      state.targetSectorMW.kolkhoz +
      state.targetSectorMW.duga +
      state.targetSectorMW.kgb +
      state.targetSectorMW.vodka +
      state.targetSectorMW.steel;
    const hasGenDeficit =
      state.tutorialPhase === "COMPLETED" &&
      totalSuppliedMW > state.totalElectricalMW + 20;
    const isSteamStarved =
      state.drumPressure < 36 &&
      totalSuppliedMW > 200 &&
      state.tutorialPhase === "COMPLETED";
    const isThermalRecoil =
      state.drumPressure > 74 && state.tutorialPhase === "COMPLETED";

    const mandateText = state.az5Active
      ? `● AZ-5 SCRAM ACTIVE (TIMER: ${state.az5Timer.toFixed(1)}S)`
      : isSteamStarved
        ? `⚠️ STEAM STARVATION (<36 BAR): RAISE RODS (A-2) & COOLING PUMPS!`
        : isThermalRecoil
          ? `⚠️ THERMAL RECOIL (>74 BAR): INSERT RODS (A-2) & LOWER RODS!`
          : hasGenDeficit
            ? `⚠️ GENERATION DEFICIT: BATTERY BANK LOW OR TRIPPED — RAISE RODS (A-2) TO AUTO-SUPPLY ${totalSuppliedMW} MW ON UNIT C!`
            : all6Matched
              ? `● ALL 6 SECTORS BALANCED AT ${totalSuppliedMW} / ${Math.round(state.totalElectricalMW)} MW`
              : `● ALLOCATED: ${totalSuppliedMW} / ${totalTargetMW} MW (DISPATCH: ${Math.round(state.totalElectricalMW)} MW)`;
    const sig = `${Math.round(state.coreTemp)}|${Math.round(state.drumPressure)}|${state.roomRadiation.toFixed(1)}|${Math.round(state.totalElectricalMW)}|${Math.round(state.voidFraction * 100)}|${totalSuppliedMW}|${all6Matched}|${state.az5Active}|${mandateText}`;
    const tex = statusMatRef.current?.map as THREE.CanvasTexture | undefined;
    if (tex && tex.userData.lastSig !== sig) {
      lastStatusDrawRef.current = now;
      tex.userData.lastSig = sig;
      const canvas = tex.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        paintSovietCRTScreen(ctx, 768, 144, {
          headerCode: "CRT-84A",
          cells: [
            {
              label: "CORE TEMP",
              val: `${Math.round(state.coreTemp)} °C`,
              danger: state.coreTemp >= 560,
            },
            {
              label: "DRUM BAR",
              val: `${Math.round(state.drumPressure)} BAR`,
              danger: state.drumPressure >= 80,
            },
            {
              label: "RADIATION",
              val: `${state.roomRadiation.toFixed(1)} R/H`,
              danger: state.roomRadiation >= 7.5,
            },
          ],
          statusLine: `CORE TEMP: ${Math.round(state.coreTemp)} °C | DRUM: ${Math.round(state.drumPressure)} BAR | GRID: ${Math.round(state.totalElectricalMW)} MW | LOAD: ${totalSuppliedMW} MW`,
          statusDanger:
            hasGenDeficit ||
            state.coreTemp >= 560 ||
            state.drumPressure >= 80 ||
            (state.tutorialPhase === "COMPLETED" && state.voidFraction >= 0.4),
          footerLine: mandateText.slice(0, 62),
          isBlackout: false,
        });
        tex.needsUpdate = true;
      }
    }
  });

  const unitAMimicSegments = useMemo<readonly MimicSegmentSpec[]>(
    () => [
      // Upper Cyan Cooling Loop connecting outer flank risers and COOLING PUMP A/B (y=1.605)
      { x: -0.90, y: 1.615, w: 0.016, h: 0.57, color: "#388898" },
      { x: -0.88, y: 1.605, w: 0.04, h: 0.015, color: "#388898" },
      { x: -0.307, y: 1.605, w: 0.121, h: 0.015, color: "#388898" },
      // Upper Oxide-Red Scram / Emergency Line bridging PUMP B -> AZ-5 & right flank riser
      { x: 0.315, y: 1.605, w: 0.136, h: 0.015, color: "#a83830" },
      { x: 0.87, y: 1.605, w: 0.06, h: 0.015, color: "#a83830" },
      { x: 0.90, y: 1.615, w: 0.016, h: 0.57, color: "#a83830" },
      // Main Yellow 1000 MW Generator Busbar running horizontally across top of sloped desk (y=1.245)
      { x: 0, y: 1.245, w: 1.85, h: 0.016, color: "#c8a838" },
      { x: -0.925, y: 1.02, w: 0.015, h: 0.45, color: "#c8a838" },
      { x: 0.925, y: 1.02, w: 0.015, h: 0.45, color: "#c8a838" },
      // 6 Branch Feeders dropping from Yellow Busbar into the 6 Enlarged Sector Strips
      { x: -0.76, y: 1.233, w: 0.014, h: 0.026, color: "#c8a838" },
      { x: -0.456, y: 1.233, w: 0.014, h: 0.026, color: "#c8a838" },
      { x: -0.152, y: 1.233, w: 0.014, h: 0.026, color: "#c8a838" },
      { x: 0.152, y: 1.233, w: 0.014, h: 0.026, color: "#c8a838" },
      { x: 0.456, y: 1.233, w: 0.014, h: 0.026, color: "#c8a838" },
      { x: 0.76, y: 1.233, w: 0.014, h: 0.026, color: "#c8a838" },
    ],
    [],
  );

  const unitAMimicNodes = useMemo<readonly MimicNodeSpec[]>(
    () => [
      { x: -0.9, y: 1.9, color: "#388898" },
      { x: -0.9, y: 1.605, color: "#388898" },
      { x: 0.9, y: 1.9, color: "#a83830" },
      { x: 0.9, y: 1.605, color: "#a83830" },
      { x: -0.925, y: 1.245, color: "#c8a838" },
      { x: 0.925, y: 1.245, color: "#c8a838" },
      { x: -0.76, y: 1.245, color: "#c8a838" },
      { x: -0.456, y: 1.245, color: "#c8a838" },
      { x: -0.152, y: 1.245, color: "#c8a838" },
      { x: 0.152, y: 1.245, color: "#c8a838" },
      { x: 0.456, y: 1.245, color: "#c8a838" },
      { x: 0.76, y: 1.245, color: "#c8a838" },
    ],
    [],
  );

  const unitARecessedWells = useMemo(
    () => [
      // Full-height recessed dark instrument well behind the 6 enlarged MW Sector Strips
      { x: 0, y: 0.78, w: 1.84, h: 0.96 },
    ],
    [],
  );

  return (
    <group
      ref={panelGroupRef}
      position={[-2.15, 0, -1.08]}
      rotation={[0, 0.42, 0]}
    >
      {/* 1. Authentic Layered Soviet RBMK Blue-Grey / Olive-Grey Modular Steel Cabinet (`#485450`),
             Upper Canopy Overhang with 6 Annunciator Lamps, Console Ledge & Synoptic Mimic Lines */}
      <SovietModularSteelCabinet3D
        width={1.98}
        unitCode="A"
        annunciatorLabels={[
          "LOOP A",
          "PUMP A/B",
          "CORE TEMP",
          "DRUM BAR",
          "RADIATION",
          "AZ-5 SCRAM",
        ]}
        mimicSegments={unitAMimicSegments}
        mimicNodes={unitAMimicNodes}
        recessedWells={unitARecessedWells}
        dividerY={1.318}
        lowerLedgeY={0.818}
        openLeftSide={false}
        openRightSide={false}
        hideChartRecorders={true}
        hideStripMeters={true}
        unifiedUpperFace={true}
      />

      {/* Slim Compact Top Engraved Brass Header Plaque (Centered cleanly inside frame, clear of corner gusset) */}
      <mesh position={[0, 2.182, 0.026]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[1.62, 0.068, 0.012]} />
        <meshStandardMaterial color="#b8a46b" metalness={0.82} roughness={0.32} />
      </mesh>
      <mesh position={[0, 2.182, 0.034]} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[1.6, 0.06]} />
        <meshStandardMaterial
          map={topHeaderPlateTex}
          emissive="#ffffff"
          emissiveMap={topHeaderPlateTex}
          emissiveIntensity={0.35}
          roughness={0.85}
          metalness={0.05}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* Outer Right Corner Gusset Plates & Overhead Hooded Panel Work-Lights */}
      {(
        [
          [0.91, 2.14, 0.034],
          [0.91, 0.19, 0.506],
        ] as const
      ).map(([gx, gy, gz], gIdx) => (
        <group key={gIdx} position={[gx, gy, gz]}>
          <mesh raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.14, 0.14, 0.016]} />
            <meshStandardMaterial
              color="#1e2422"
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
          {/* Curved Gooseneck Arm */}
          <mesh position={[0, 0, -0.04]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.012, 0.014, 0.11, 8]} />
            <meshStandardMaterial color="#18211b" metalness={0.75} roughness={0.38} />
          </mesh>
          {/* Industrial Enamel Lamp Hood */}
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
          {/* Glowing Warm Tungsten Work-Bulb */}
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

      {/* 2. Molded Phosphor-Green CRT Monitor Bay (CRT VL-84A) Tucked Cleanly Below Slim Header */}
      <group position={[0, 2.028, 0.024]} scale={[1.06, 0.78, 0.85]}>
        <SovietCRTMonitorBay3D
          position={[0, 0, 0]}
          screenMatRef={statusMatRef}
          screenTexture={statusTexture}
          modelBadge="CRT VL-84A"
        />
      </group>

      {/* 3. Promoted Upper Riser Safety Row: 2 Enlarged Pump Valves + Multi-Part Hinged AZ-5 Safety Cage + Boron Injection */}
      <group position={[0, 1.605, 0.01]}>
        <SculptedPumpValveAssembly3D
          position={[-0.615, 0, 0]}
          scale={1.22}
          pumpIndex={0}
          label="COOLING PUMP A"
          subLabel="MCP 1-2 (NORTH LOOP)"
        />
        <SculptedPumpValveAssembly3D
          position={[0, 0, 0]}
          scale={1.22}
          pumpIndex={1}
          label="COOLING PUMP B"
          subLabel="MCP 3-4 (SOUTH LOOP)"
        />

        {/* Multi-Part AZ-5 Emergency Scram Assembly */}
        <group position={[0.615, 0, 0.032]} scale={1.22}>
          {/* Dark Cast-Iron Mounting Backplate Flush Against Vertical Riser */}
          <mesh position={[0, 0, -0.016]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.38, 0.45, 0.014]} />
            <meshStandardMaterial
              color="#161c19"
              roughness={0.46}
              metalness={0.68}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
              roughnessMap={ironTex.roughnessMap}
            />
          </mesh>
          {/* Raised Brass & Crimson Nameplate */}
          <mesh position={[0, 0.172, 0.016]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.375, 0.098, 0.012]} />
            <meshStandardMaterial
              color="#8c7a4b"
              metalness={0.85}
              roughness={0.28}
            />
          </mesh>
          <mesh position={[0, 0.172, 0.025]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.358, 0.085]} />
            <meshStandardMaterial
              map={az5PlateTex}
              emissive="#ffffff"
              emissiveMap={az5PlateTex}
              emissiveIntensity={0.35}
              roughness={0.55}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>

          {/* Yellow/Black Hazard-Striped Cast-Iron Collar */}
          <mesh raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.256, 0.246, 0.042]} />
            <meshStandardMaterial
              map={az5HazardTex}
              roughness={0.48}
              metalness={0.4}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
          {/* 4 Corner Hex Bolts on AZ-5 Collar */}
          {(
            [
              [-0.105, 0.1],
              [0.105, 0.1],
              [-0.105, -0.1],
              [0.105, -0.1],
            ] as const
          ).map(([bx, by], bIdx) => (
            <mesh
              key={bIdx}
              position={[bx, by, 0.025]}
              rotation={[Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.009, 0.009, 0.012, 6]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.88}
                roughness={0.25}
              />
            </mesh>
          ))}

          {/* Recessed Dark Shadow Well & Stepped Chrome Plunger Shroud */}
          <mesh position={[0, 0, 0.006]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.205, 0.195, 0.044]} />
            <meshStandardMaterial
              color="#111513"
              roughness={0.75}
              metalness={0.5}
            />
          </mesh>
          <mesh
            position={[0, 0, 0.032]}
            rotation={[Math.PI / 2, 0, 0]}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.082, 0.09, 0.024, 16]} />
            <meshStandardMaterial
              color="#c8d2cc"
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>

          {/* Glowing Engraved Red Bakelite AZ-5 Push-Button Plunger */}
          <group
            ref={az5BtnGroupRef}
            position={[0, 0, 0.048]}
            onClick={(e) => {
              e.stopPropagation();
              notifyPlayerControlInteraction("az5", true);
              notifyPlayerControlInteraction("az5", false);
              if (!az5CoverOpen) {
                playSafetyCoverFlip(true);
                setAz5CoverOpen(true);
                return;
              }
              const s = useGameStore.getState();
              playSwitchClank(true);
              playKlaxonBurst();
              s.triggerAz5();
              playSafetyCoverFlip(false);
              setAz5CoverOpen(false);
            }}
          >
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.068, 0.074, 0.048, 16]} />
              <meshStandardMaterial
                color="#ff2a2a"
                emissive="#ff2a2a"
                emissiveIntensity={az5CoverOpen ? 1.1 : 0.35}
                roughness={0.3}
              />
            </mesh>
            <mesh position={[0, 0, 0.0265]} raycast={NOOP_RAYCAST}>
              <circleGeometry args={[0.064, 16]} />
              <meshStandardMaterial
                map={az5ButtonTopTex}
                emissive="#ff2a2a"
                emissiveIntensity={az5CoverOpen ? 0.55 : 0.18}
                roughness={0.35}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
          </group>

          {/* Top Brass Hinge Pin & Coiled Torsion Spring */}
          <mesh
            position={[0, 0.105, 0.034]}
            rotation={[0, 0, Math.PI / 2]}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.01, 0.01, 0.21, 10]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.88}
              roughness={0.22}
            />
          </mesh>
          {[-0.04, 0, 0.04].map((sx, sIdx) => (
            <mesh
              key={sIdx}
              position={[sx, 0.105, 0.034]}
              rotation={[0, Math.PI / 2, 0]}
              raycast={NOOP_RAYCAST}
            >
              <torusGeometry args={[0.013, 0.003, 6, 10]} />
              <meshStandardMaterial
                color="#d0dad4"
                metalness={0.9}
                roughness={0.2}
              />
            </mesh>
          ))}

          {/* Hinged Red-Tinted Plexiglass Safety Cover with Side Ribs & Bottom Lift-Tab */}
          <group
            ref={az5CoverGroupRef}
            position={[0, 0.105, 0.034]}
            onClick={(e) => {
              e.stopPropagation();
              notifyPlayerControlInteraction("az5Cover", true);
              notifyPlayerControlInteraction("az5Cover", false);
              setAz5CoverOpen((prev) => {
                playSafetyCoverFlip(!prev);
                return !prev;
              });
            }}
          >
            <mesh position={[0, -0.102, 0.036]}>
              <boxGeometry args={[0.204, 0.204, 0.072]} />
              <meshStandardMaterial
                color="#ff2a2a"
                transparent
                opacity={0.48}
                depthWrite={false}
                roughness={0.16}
                metalness={0.15}
              />
            </mesh>
            {/* Brass Bottom Lift-Tab Handle & Lead-Seal Wire Loop */}
            <mesh position={[0, -0.206, 0.068]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.095, 0.016, 0.028]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.88}
                roughness={0.24}
              />
            </mesh>
            {/* Twisted Wire Lead-Seal (KGB SEAL) on Safety Cover */}
            <group position={[0.072, -0.198, 0.056]}>
              <mesh rotation={[0, Math.PI / 4, 0]} raycast={NOOP_RAYCAST}>
                <torusGeometry args={[0.014, 0.002, 6, 12]} />
                <meshStandardMaterial color="#c8d2cc" metalness={0.9} roughness={0.25} />
              </mesh>
              <mesh position={[0.008, -0.014, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.009, 0.009, 0.006, 8]} />
                <meshStandardMaterial color="#6e7571" metalness={0.65} roughness={0.5} />
              </mesh>
            </group>
          </group>

          {/* Heavy Brass-Ringed Boron Acid Injection Push-Plunger (`BORON INJECTION`) */}
          <group
            position={[0, -0.172, 0.016]}
            onPointerDown={(e) => {
              if (useCameraLookStore.getState().isFreeLookMode) return;
              e.stopPropagation();
              notifyPlayerControlInteraction("boron", true);
              notifyPlayerControlInteraction("boron", false);
              const s = useGameStore.getState();
              if (s.boronCooldown > 0 || s.boronTankLevel < 20 || s.isBlackout) {
                playLeverRatchet(0.45);
                s.injectBoronAcid();
                return;
              }
              boronDepressRef.current = 1.0;
              playSwitchClank(true);
              playPneumaticWhoosh();
              s.injectBoronAcid();
            }}
          >
            {/* Single clean invisible hitbox for Boron Injection Plunger */}
            <mesh position={[0, 0, 0.025]}>
              <boxGeometry args={[0.34, 0.09, 0.065]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {/* Bolted Cast-Iron Boron Housing Plate */}
            <mesh position={[0, 0, 0.004]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.325, 0.076, 0.016]} />
              <meshStandardMaterial
                color="#141816"
                roughness={0.44}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.006}
              />
            </mesh>
            <mesh position={[-0.018, 0, 0.015]} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.21, 0.062]} />
              <meshStandardMaterial
                map={boronPlateTex}
                emissive="#ffffff"
                emissiveMap={boronPlateTex}
                emissiveIntensity={0.42}
                roughness={0.55}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
            <CagedSovietJewelLamp3D
              position={[-0.138, 0, 0.014]}
              lampMatRef={boronLampMatRef}
              scale={0.68}
            />
            {/* Brass Outer Collar */}
            <mesh
              position={[0.116, 0, 0.018]}
              rotation={[Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.032, 0.036, 0.024, 16]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.88}
                roughness={0.24}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
            {/* Depressible Boron Plunger Cap with Engraved Top Face */}
            <group ref={boronPlungerMeshRef} position={[0.116, 0, 0.036]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.025, 0.027, 0.034, 16]} />
                <meshStandardMaterial
                  color="#25a852"
                  emissive="#33ff66"
                  emissiveIntensity={0.48}
                  roughness={0.3}
                />
              </mesh>
              <mesh position={[0, 0, 0.0195]} raycast={NOOP_RAYCAST}>
                <circleGeometry args={[0.024, 16]} />
                <meshStandardMaterial
                  map={boronCapTex}
                  emissive="#ffffff"
                  emissiveMap={boronCapTex}
                  emissiveIntensity={0.55}
                  roughness={0.35}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  polygonOffsetUnits={-2}
                />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* 4. Full-Height Lower Sloped Desk Dedicated 100% to 6 Substation Power Selector Strips + 18-Segment Redline Bar */}
      <group position={[0, 0.78, 0.276]} rotation={[-0.406, 0, 0]}>
        <IndustrialPowerColumn3D
          position={[-0.76, 0.035, 0]}
          sector="pripyat"
          label="1. PRIPYAT CITY"
          subLabel="PRIPYAT"
          accentColor="#28b862"
          ledColor="#28b862"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <IndustrialPowerColumn3D
          position={[-0.456, 0.035, 0]}
          sector="duga"
          label="2. DUGA-1 RADAR"
          subLabel="DUGA-1"
          accentColor="#d99b26"
          ledColor="#d99b26"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <IndustrialPowerColumn3D
          position={[-0.152, 0.035, 0]}
          sector="kolkhoz"
          label="3. KOLKHOZ FARM"
          subLabel="KOLKHOZ"
          accentColor="#28b862"
          ledColor="#28b862"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <IndustrialPowerColumn3D
          position={[0.152, 0.035, 0]}
          sector="kgb"
          label="4. KGB BUNKER #7"
          subLabel="KGB-07"
          accentColor="#d99b26"
          ledColor="#d99b26"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <IndustrialPowerColumn3D
          position={[0.456, 0.035, 0]}
          sector="vodka"
          label="5. VODKA PLANT"
          subLabel="VODKA"
          accentColor="#2ad4c8"
          ledColor="#2ad4c8"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <IndustrialPowerColumn3D
          position={[0.76, 0.035, 0]}
          sector="steel"
          label="6. STEEL WORKS"
          subLabel="STEEL"
          accentColor="#2ad4c8"
          ledColor="#2ad4c8"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />

        {/* 18-Segment Recessed Ribbed Phosphor Glass Total MW & Redline Bar */}
        <group position={[0, -0.456, 0.032]} scale={[1.05, 0.74, 1]}>
          <mesh position={[0, 0, -0.006]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.68, 0.088, 0.026]} />
            <meshStandardMaterial
              color="#161c19"
              roughness={0.44}
              metalness={0.72}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
              roughnessMap={ironTex.roughnessMap}
            />
          </mesh>
          {/* 4 Corner Hex Bolts on Total MW Housing */}
          <mesh geometry={REACTOR_REDLINE_4_BOLTS_GEO} raycast={NOOP_RAYCAST}>
            <meshStandardMaterial
              color="#8a929a"
              metalness={0.86}
              roughness={0.28}
            />
          </mesh>
          <mesh geometry={REACTOR_REDLINE_18_LOUVERS_GEO} raycast={NOOP_RAYCAST}>
            <meshStandardMaterial
              color="#141816"
              metalness={0.78}
              roughness={0.38}
            />
          </mesh>
          {Array.from({ length: 18 }).map((_, idx) => (
            <mesh
              key={idx}
              position={[-0.7225 + idx * 0.085, 0, 0.006]}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.056, 0.048, 0.016]} />
              <meshStandardMaterial
                ref={(el) => {
                  redlineScaleBlockRefs.current[idx] = el;
                }}
                map={ribbedGlassTex}
                emissiveMap={ribbedGlassTex}
                color="#141916"
                roughness={0.24}
                metalness={0.18}
              />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
});

interface HighDetailKnifeBreaker3DProps {
  breakerArmRef: React.RefObject<THREE.Group | null>;
  breakerDragRef: React.RefObject<{
    active: boolean;
    startY: number;
    progress: number;
  }>;
  breakerPlateTex: THREE.CanvasTexture;
}

export const HighDetailKnifeBreaker3D: React.FC<
  HighDetailKnifeBreaker3DProps
> = React.memo(({ breakerArmRef, breakerDragRef, breakerPlateTex }) => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  const sparkMeshRef = useRef<THREE.Mesh>(null);
  const sparkMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const sparkFlashRef = useRef(0);

  useFrame((_, delta) => {
    if (sparkFlashRef.current > 0) {
      sparkFlashRef.current = Math.max(0, sparkFlashRef.current - delta * 6.5);
      const active = sparkFlashRef.current > 0.01;
      if (sparkMeshRef.current) {
        sparkMeshRef.current.visible = active;
      }
      if (sparkMatRef.current) {
        sparkMatRef.current.opacity = active
          ? Math.min(1, sparkFlashRef.current * 0.95)
          : 0;
      }
    }
  });

  const handleBreakerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!breakerDragRef.current.active) return;
    e.stopPropagation();
    const finalProg = breakerDragRef.current.progress;
    const dy = Math.abs(e.nativeEvent.clientY - breakerDragRef.current.startY);
    breakerDragRef.current.active = false;
    releaseCanvasPointer(e);
    const s = useGameStore.getState();
    const isClickAction = dy < 12;
    if (!isClickAction && finalProg < 0.45) {
      playLeverRatchet(0.5);
      return;
    }
    playKnifeSwitchSlam(true);
    sparkFlashRef.current = 1.0;
    startSoundtrack();
    updateSoundtrackState(false, s.isMusicMuted);
    if (s.phase === "boot") {
      s.startShift();
    } else if (s.phase !== "playing") {
      s.resetShift();
    } else {
      s.pullMainBreaker();
    }
  };

  return (
    <group position={[0.56, 0, 0.02]}>
      <mesh
        position={[0, 0.05, 0.105]}
        onPointerOver={(e) => {
          e.stopPropagation();
          useGameStore
            .getState()
            .setHoveredControlHint(
              "MAIN BREAKER (KNIFE SWITCH): Scroll Up = Close | Scroll Down = Open | Click / [SPACE]",
            );
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          useGameStore.getState().setHoveredControlHint(null);
        }}
        onWheel={(e) => {
          if (useCameraLookStore.getState().isFreeLookMode) return;
          e.stopPropagation();
          e.nativeEvent?.stopImmediatePropagation?.();
          const s = useGameStore.getState();
          const wantClose = e.deltaY < 0;
          const isClosed = Boolean(s.turbines[0]?.gridConnected);
          if (s.phase === "boot" && wantClose) {
            playKnifeSwitchSlam(true);
            sparkFlashRef.current = 1.0;
            startSoundtrack();
            updateSoundtrackState(false, s.isMusicMuted);
            s.startShift();
          } else if (s.phase === "playing" && wantClose !== isClosed) {
            playKnifeSwitchSlam(true);
            sparkFlashRef.current = 1.0;
            s.pullMainBreaker();
          }
        }}
        onPointerDown={(e) => {
          if (useCameraLookStore.getState().isFreeLookMode) return;
          e.stopPropagation();
          const s = useGameStore.getState();
          breakerDragRef.current = {
            active: true,
            startY: e.nativeEvent.clientY,
            progress:
              s.phase === "playing" && Boolean(s.turbines[0]?.gridConnected)
                ? 1
                : 0,
          };
          captureCanvasPointer(e);
        }}
        onPointerMove={(e) => {
          if (!breakerDragRef.current.active) return;
          e.stopPropagation();
          // Dragging physically upward or downward across the arc
          const dy = Math.abs(
            e.nativeEvent.clientY - breakerDragRef.current.startY,
          );
          breakerDragRef.current.progress = THREE.MathUtils.clamp(
            dy / 65,
            0,
            1,
          );
        }}
        onPointerUp={handleBreakerUp}
        onLostPointerCapture={handleBreakerUp}
      >
        <boxGeometry args={[0.52, 0.56, 0.25]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.258, 0.01]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.515, 0.12, 0.012]} />
        <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.258, 0.019]} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[0.50, 0.112]} />
        <meshStandardMaterial
          map={breakerPlateTex}
          emissive="#ffffff"
          emissiveMap={breakerPlateTex}
          emissiveIntensity={0.45}
          roughness={0.65}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <group position={[0, -0.045, 0]}>
        {/* Cast-Iron & Brushed-Steel Perimeter Safety Cage Bars */}
        {[-0.175, 0.175].map((hx, hIdx) => (
          <mesh key={hIdx} position={[hx, 0, 0.048]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.016, 0.34, 0.042]} />
            <meshStandardMaterial
              color="#2b3036"
              roughness={0.38}
              metalness={0.82}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
        ))}
        {/* Mechanical Arc-Chute Hood */}
        <mesh position={[0, 0.148, 0.056]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.31, 0.056, 0.088]} />
          <meshStandardMaterial
            color="#1b241f"
            roughness={0.42}
            metalness={0.72}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>
        <mesh
          ref={sparkMeshRef}
          visible={false}
          position={[0, 0.08, 0.12]}
          raycast={NOOP_RAYCAST}
        >
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshBasicMaterial
            ref={sparkMatRef}
            color="#ffdf78"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        {/* Heavy Cast-Iron Knife-Switch Base & Ceramic Insulator Stand-Offs */}
        <mesh raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.32, 0.32, 0.072]} />
          <meshStandardMaterial
            color="#141816"
            roughness={0.45}
            metalness={0.68}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        {(
          [
            [-0.075, 0.095],
            [0.075, 0.095],
            [-0.075, -0.095],
            [0.075, -0.095],
          ] as const
        ).map(([cx, cy], cIdx) => (
          <group key={cIdx} position={[cx, cy, 0.046]}>
            {/* Ribbed Porcelain Insulator Post */}
            <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.022, 0.026, 0.028, 12]} />
              <meshStandardMaterial
                color="#d8d2c0"
                roughness={0.3}
                metalness={0.1}
              />
            </mesh>
            {/* Heavy Copper Contact Jaw Clip */}
            <mesh position={[0, 0, 0.024]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.024, 0.038, 0.032]} />
              <meshStandardMaterial
                color="#c87d46"
                metalness={0.88}
                roughness={0.24}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
          </group>
        ))}

        <group ref={breakerArmRef} position={[0, 0, 0.045]}>
          {/* Dual Heavy Copper Knife Blades */}
          {[-0.075, 0.075].map((bx, bIdx) => (
            <mesh
              key={bIdx}
              position={[bx, 0, 0.095]}
              rotation={[Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.014, 0.19, 0.028]} />
              <meshStandardMaterial
                color="#c87d46"
                metalness={0.9}
                roughness={0.22}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
          ))}
          {/* Lathe-Turned Dark Oxblood Phenolic Bakelite Crossbar Stirrup Handle & Steel Ferrules */}
          <mesh
            position={[0, 0, 0.19]}
            rotation={[0, 0, Math.PI / 2]}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.03, 0.03, 0.24, 16]} />
            <meshStandardMaterial
              color="#4a1210"
              roughness={0.32}
              metalness={0.15}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
          {[-0.108, 0.108].map((rx, rIdx) => (
            <mesh
              key={rIdx}
              position={[rx, 0, 0.19]}
              rotation={[0, 0, Math.PI / 2]}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.033, 0.033, 0.022, 16]} />
              <meshStandardMaterial
                color="#8a929a"
                metalness={0.86}
                roughness={0.32}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
          ))}
          <mesh
            position={[0, 0, 0.19]}
            rotation={[0, 0, Math.PI / 2]}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.0315, 0.0315, 0.012, 16]} />
            <meshStandardMaterial
              color="#c92a1d"
              roughness={0.36}
              metalness={0.25}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
});

// Precomputed 37-tile RBMK-1000 octagonal biological shield matrix (rows of 3, 5, 7, 7, 7, 5, 3 square stainless-steel blocks)
const RBMK_OCTAGON_TILES: ReadonlyArray<{
  readonly x: number;
  readonly y: number;
  readonly code: string;
}> = (() => {
  const tiles: Array<{ x: number; y: number; code: string }> = [];
  const pitch = 0.048;
  for (let r = -3; r <= 3; r++) {
    for (let c = -3; c <= 3; c++) {
      if (Math.abs(r) + Math.abs(c) > 4) continue;
      const rowCode = String(r + 4).padStart(2, "0");
      const colCode = String(c + 4).padStart(2, "0");
      tiles.push({
        x: c * pitch,
        y: -r * pitch,
        code: `${rowCode}-${colCode}`,
      });
    }
  }
  return tiles;
})();

const RBMK_37_BASES_GEO = mergeStaticGeometries(
  RBMK_OCTAGON_TILES.map((tile) => ({
    geometry: new THREE.BoxGeometry(0.044, 0.044, 0.012),
    position: [tile.x, tile.y, 0],
  })),
);

const RBMK_37_CAPS_GEO = mergeStaticGeometries(
  RBMK_OCTAGON_TILES.map((tile) => ({
    geometry: new THREE.BoxGeometry(0.039, 0.039, 0.008),
    position: [tile.x, tile.y, 0.006],
  })),
);

const RBMK_37_COLLARS_GEO = mergeStaticGeometries(
  RBMK_OCTAGON_TILES.map((tile) => ({
    geometry: new THREE.CylinderGeometry(0.0175, 0.0185, 0.0045, 14),
    position: [tile.x, tile.y, 0.0105],
    rotation: [Math.PI / 2, 0, 0],
  })),
);

const RBMK_PIN_SHAFT_GEO = mergeStaticGeometries([
  {
    geometry: new THREE.CylinderGeometry(0.0052, 0.006, 0.022, 8),
    rotation: [Math.PI / 2, 0, 0],
  },
]);

const RBMK_PIN_CAP_GEO = mergeStaticGeometries([
  {
    geometry: new THREE.CylinderGeometry(0.007, 0.007, 0.0045, 8),
    position: [0, 0, 0.012],
    rotation: [Math.PI / 2, 0, 0],
  },
]);

const RBMK_TILE_RIM_GEO = mergeStaticGeometries([
  {
    geometry: new THREE.BoxGeometry(0.043, 0.0042, 0.0048),
    position: [0, 0.0195, 0.0108],
  },
  {
    geometry: new THREE.BoxGeometry(0.043, 0.0042, 0.0048),
    position: [0, -0.0195, 0.0108],
  },
  {
    geometry: new THREE.BoxGeometry(0.0042, 0.035, 0.0048),
    position: [-0.0195, 0, 0.0108],
  },
  {
    geometry: new THREE.BoxGeometry(0.0042, 0.035, 0.0048),
    position: [0.0195, 0, 0.0108],
  },
]);

const RBMK_TILE_LENS_GEO = new THREE.CylinderGeometry(0.0145, 0.0145, 0.0045, 14);

const RBMK_TILE_HITBOX_GEO = new THREE.BoxGeometry(0.044, 0.044, 0.045);

const _rbmkPinDummy = new THREE.Object3D();

/**
 * Wrap-Around Left-Rear (`UNIT A-2 // BIO-SHIELD & RBMK CORE MAP`)
 * and Rear (`UNIT B // CONTAINMENT & GAS LOOP`) Heavy Soviet Control Stations.
 * Zero cloned rainbow circles or bare floating rings — every control is a multi-part 3D industrial assembly.
 */
export const LeftRearWrapAroundPanel3D: React.FC<{
  variant?: "left-rear" | "rear";
}> = React.memo(({ variant = "left-rear" }) => {
  const groupRef = useRef<THREE.Group>(null);
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  const ribbedGlassTex = useMemo(() => getRibbedGlassCellTexture(), []);
  const vfdMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lastVfdDrawRef = useRef(-1);
  const lastRefuelDrawRef = useRef(-1);
  const lastRodPctDrawRef = useRef(-1);

  // UNIT A-2 refs: 37 octagonal stainless-steel core tiles + bevel rims + pop-out rod pins + rod wheel + refueling lever
  const channelLensMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>(
    [],
  );
  const channelRimMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>(
    [],
  );
  const channelTileRefs = useRef<Array<THREE.Group | null>>([]);
  const hoveredChannelRef = useRef<number | null>(null);
  const rbmkPinShaftInstRef = useRef<THREE.InstancedMesh>(null);
  const rbmkPinCapInstRef = useRef<THREE.InstancedMesh>(null);
  const pinZRefs = useRef<Float32Array>(new Float32Array(37).fill(-99));
  const oilWheelRef = useRef<THREE.Group>(null);
  const oilLampMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const oilBarMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const rodPctMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const boronPistonGroupRef = useRef<THREE.Group>(null);
  const boronBarMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const refuelTargetMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const refuelStrokeFiredRef = useRef(false);

  // UNIT B refs: Dual-pipe gas regulator wheel + 4 containment jewel lamps + 3 guarded toggles + emergency seal mushroom + toothed bubbler drain lever & sight-glass water column
  const gasWheelRef = useRef<THREE.Group>(null);
  const gasLampMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const gasBarMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const sealJewelMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const sealToggleBatRefs = useRef<Array<THREE.Group | null>>([]);
  const emergSealBtnRef = useRef<THREE.Group>(null);
  const emergSealDepressRef = useRef(0);
  const drainLeverGroupRef = useRef<THREE.Group>(null);
  const drainRingMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const sightGlassWaterMeshRef = useRef<THREE.Mesh>(null);
  const sightGlassWaterMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const pistonDragRef = useRef({
    active: false,
    startY: 0,
    startPos: 0,
    currentPos: 0,
    lastHalfStroke: 0,
  });

  const drainDragRef = useRef({
    active: false,
    startY: 0,
    progress: 0,
    lastHissTime: 0,
  });
  const oilWheelDraggingRef = useRef(false);
  const coreRodDraggingRef = useRef(false);
  const gasWheelDraggingRef = useRef(false);

  useEffect(() => {
    applySovietPBRToHierarchy(groupRef.current);
    groupRef.current?.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = false;
        obj.receiveShadow = false;
      }
    });
    if (rbmkPinShaftInstRef.current || rbmkPinCapInstRef.current) {
      for (let i = 0; i < RBMK_OCTAGON_TILES.length; i++) {
        const tile = RBMK_OCTAGON_TILES[i];
        _rbmkPinDummy.position.set(tile.x, tile.y, 0.006);
        _rbmkPinDummy.rotation.set(0, 0, 0);
        _rbmkPinDummy.scale.set(1, 1, 1);
        _rbmkPinDummy.updateMatrix();
        rbmkPinShaftInstRef.current?.setMatrixAt(i, _rbmkPinDummy.matrix);
        rbmkPinCapInstRef.current?.setMatrixAt(i, _rbmkPinDummy.matrix);
        pinZRefs.current[i] = 0.006;
      }
      if (rbmkPinShaftInstRef.current) {
        rbmkPinShaftInstRef.current.instanceMatrix.needsUpdate = true;
      }
      if (rbmkPinCapInstRef.current) {
        rbmkPinCapInstRef.current.instanceMatrix.needsUpdate = true;
      }
    }
  }, []);

  useEffect(() => {
    if (variant === "left-rear") {
      registerKomradControlObject("controlRodDrive", oilWheelRef.current);
      registerKomradControlObject("rodRefuelLever", boronPistonGroupRef.current, [
        0,
        0,
        0.094,
      ]);
      for (let i = 0; i < RBMK_OCTAGON_TILES.length; i++) {
        registerKomradControlObject(
          `coreChannelTile_${i}`,
          channelTileRefs.current[i] ?? null,
          [0, 0, 0.015],
        );
      }
      return () => {
        registerKomradControlObject("controlRodDrive", null);
        registerKomradControlObject("rodRefuelLever", null);
        for (let i = 0; i < RBMK_OCTAGON_TILES.length; i++) {
          registerKomradControlObject(`coreChannelTile_${i}`, null);
        }
      };
    }

    registerKomradControlObject("feedwaterValve", gasWheelRef.current);
    registerKomradControlObject(
      "mcpSealToggle0",
      sealToggleBatRefs.current[0] ?? null,
      [0, 0, 0.065],
    );
    registerKomradControlObject(
      "mcpSealToggle1",
      sealToggleBatRefs.current[1] ?? null,
      [0, 0, 0.065],
    );
    registerKomradControlObject(
      "mcpSealToggle2",
      sealToggleBatRefs.current[2] ?? null,
      [0, 0, 0.065],
    );
    registerKomradControlObject("emergSealLock", emergSealBtnRef.current);
    registerKomradControlObject("bubblerDrain", drainLeverGroupRef.current, [
      0,
      0,
      0.076,
    ]);
    return () => {
      registerKomradControlObject("feedwaterValve", null);
      registerKomradControlObject("mcpSealToggle0", null);
      registerKomradControlObject("mcpSealToggle1", null);
      registerKomradControlObject("mcpSealToggle2", null);
      registerKomradControlObject("emergSealLock", null);
      registerKomradControlObject("bubblerDrain", null);
    };
  }, [variant]);

  const headerTex = useMemo(
    () =>
      variant === "rear"
        ? makePlaqueTex(
            "DRUM SEPARATORS & COOLANT LOOP // UNIT B (MCR-T)",
            "DRUM BAR • WATER LEVEL • FEEDWATER & MCP 1-4",
            {
              width: 768,
              height: 112,
              titleSize: 31,
              subSize: 24,
              titleColor: "#ffffff",
              titleStroke: "#ffffff",
              subColor: "#44ff77",
              subStroke: "#44ff77",
              borderColor: "#b8a46b",
            },
          )
        : makePlaqueTex("RBMK-1000 CORE REACTIVITY • UNIT A-2", "", {
            width: 768,
            height: 64,
            titleSize: 26,
            titleColor: "#ffffff",
            titleStroke: "#ffffff",
            borderColor: "#b8a46b",
          }),
    [variant],
  );

  // 768x144 Multi-Bay CRT Canvas Texture (Matches UNIT A with centered cells so text NEVER clips!)
  const vfdTexture = useMemo(() => createCrispPanelTexture(768, 144), []);

  const refuelTargetTex = useMemo(
    () =>
      createCrispPanelTexture(320, 72, (ctx, w, h) => {
        ctx.fillStyle = "#08140d";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#8ce6a8";
        ctx.font = 'bold 38px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("37/37 FUEL OK", w / 2, h / 2 + 1, w - 20);
      }),
    [],
  );

  const rodPctTex = useMemo(
    () =>
      createCrispPanelTexture(256, 64, (ctx, w, h) => {
        ctx.fillStyle = "#08140d";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#33ff66";
        ctx.font = '900 40px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("RODS: 0%", w / 2, h / 2 + 1, w - 20);
      }),
    [],
  );

  const coreLegendTex = useMemo(
    () =>
      makePlaqueTex("AMBER = SPENT ROD", "GOLD = LOCKED TARGET", {
        width: 420,
        height: 112,
        titleSize: 36,
        subSize: 34,
        titleColor: "#ffb000",
        subColor: "#ffe666",
        borderColor: "#b8a46b",
      }),
    [],
  );

  const refuelProtocolTex = useMemo(
    () =>
      makePlaqueTex("1. CLICK AMBER TILE", "2. PULL REFUEL LEVER", {
        width: 420,
        height: 120,
        titleSize: 34,
        subSize: 34,
        titleColor: "#ffffff",
        subColor: "#ffcc00",
        borderColor: "#b8a46b",
      }),
    [],
  );

  const leftPlateTex = useMemo(
    () =>
      makePlaqueTex(
        variant === "rear" ? "FEEDWATER / GAS" : "CONTROL ROD DRIVE",
        variant === "rear" ? "FW PUMP & HE-N2 (0-100%)" : "RODS 0-100% WHEEL",
        {
          width: 512,
          height: 168,
          titleSize: 58,
          subSize: variant === "rear" ? 44 : 40,
          titleColor: "#ffffff",
          titleStroke: "#000000",
          subColor: "#ffcc00",
          subStroke: "#000000",
          borderColor: "#b8a46b",
        },
      ),
    [variant],
  );

  const centerPlateTex = useMemo(
    () =>
      makePlaqueTex(
        variant === "rear" ? "PUMPS & SEALS" : "RBMK CORE",
        variant === "rear"
          ? "MCP 1-4 & SEALS (CLICK)"
          : "CLICK AMBER SPENT ROD",
        {
          width: 640,
          height: 168,
          titleSize: 58,
          subSize: 40,
          titleColor: "#ffffff",
          titleStroke: "#000000",
          subColor: variant === "rear" ? "#44ff77" : "#ffb000",
          subStroke: "#000000",
          borderColor: "#b8a46b",
        },
      ),
    [variant],
  );

  const rightPlateTex = useMemo(
    () =>
      makePlaqueTex(
        variant === "rear" ? "BUBBLER DRAIN" : "ROD REFUELING",
        variant === "rear"
          ? "STEAM & DRAIN LEVER"
          : "PULL LEVER DOWN TO RELOAD",
        {
          width: 512,
          height: 168,
          titleSize: 58,
          subSize: variant === "rear" ? 38 : 34,
          titleColor: "#ffffff",
          titleStroke: "#000000",
          subColor: "#ffcc00",
          subStroke: "#000000",
          borderColor: "#b8a46b",
        },
      ),
    [variant],
  );

  const leverScalePlateTex = useMemo(
    () =>
      createCrispPanelTexture(64, 256, (ctx, w, h) => {
        ctx.fillStyle = "#8c7a4b";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#141816";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        const marks = ["100", "75", "50", "25", "0"];
        marks.forEach((m, idx) => {
          const y = 26 + idx * 52;
          ctx.fillStyle = idx === 0 ? "#6e1a14" : "#141414";
          ctx.font = '900 18px "VT323", monospace';
          ctx.textAlign = "center";
          ctx.fillText(m, w / 2 + 4, y + 5);
          ctx.fillRect(4, y, 8, 3);
        });
      }),
    [],
  );

  const sightGlassScaleTex = useMemo(
    () =>
      createCrispPanelTexture(64, 256, (ctx, w, h) => {
        ctx.fillStyle = "#161c19";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#8c7a4b";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        const grads = [
          { lbl: "80%", y: 52, col: "#ff4444" },
          { lbl: "60%", y: 102, col: "#ffcc00" },
          { lbl: "40%", y: 152, col: "#ffffff" },
          { lbl: "20%", y: 202, col: "#44ff77" },
        ];
        grads.forEach((g) => {
          ctx.fillStyle = g.col;
          ctx.font = '900 19px "VT323", monospace';
          ctx.textAlign = "center";
          ctx.fillText(g.lbl, w / 2, g.y + 5);
          ctx.fillRect(4, g.y, 10, 2);
        });
      }),
    [],
  );

  const containmentSynopticTex = useMemo(
    () =>
      createCrispPanelTexture(1024, 768, (ctx, w, h) => {
        ctx.fillStyle = "#111715";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#486155";
        ctx.lineWidth = 8;
        ctx.strokeRect(6, 6, w - 12, h - 12);

        const labels = ["LOOP 1", "LOOP 2", "LOOP 3", "LOOP 4"];
        labels.forEach((lbl, idx) => {
          const cx = 128 + idx * 256;
          // High-contrast top label badge
          ctx.fillStyle = "#17261f";
          ctx.fillRect(cx - 118, 18, 236, 86);
          ctx.strokeStyle = "#b8a46b";
          ctx.lineWidth = 5;
          ctx.strokeRect(cx - 118, 18, 236, 86);
          drawFittedPlaqueText(
            ctx,
            lbl,
            cx,
            76,
            220,
            '900 44px "Consolas", "Courier Prime", monospace',
            "#ffe600",
          );
          ctx.strokeStyle = "#6e6240";
          ctx.lineWidth = 5;
          ctx.strokeRect(cx - 108, 114, 216, 224);
        });

        const toggleLabels = ["MCP-1", "MCP-2", "MCP-3", "MCP-4"];
        toggleLabels.forEach((tlbl, idx) => {
          const cx = 128 + idx * 256;
          // High-contrast pump switch label badge
          ctx.fillStyle = "#17261f";
          ctx.fillRect(cx - 118, 356, 236, 88);
          ctx.strokeStyle = idx === 3 ? "#ff3b2a" : "#39ff14";
          ctx.lineWidth = 5;
          ctx.strokeRect(cx - 118, 356, 236, 88);
          drawFittedPlaqueText(
            ctx,
            tlbl,
            cx,
            416,
            220,
            '900 44px "Kremlin", "Consolas", "Courier Prime", monospace',
            idx === 3 ? "#ff6655" : "#44ff77",
          );
        });
      }),
    [],
  );

  useFrame(({ clock }, delta) => {
    const s = useGameStore.getState();
    const t = clock.getElapsedTime();
    const dt = Math.min(0.1, delta);

    // 1. Control Rod Drive (UNIT A-2) & Feedwater Valve (UNIT B) Wheel & Bar Animation
    const rodPctVal = s.controlRods * 100;
    const fwPctVal = s.feedwaterValve * 100;
    const oilWheelTargetRot = -(rodPctVal / 100) * Math.PI * 1.6;
    if (oilWheelRef.current) {
      oilWheelRef.current.rotation.z = THREE.MathUtils.lerp(
        oilWheelRef.current.rotation.z,
        oilWheelTargetRot,
        0.48,
      );
    }
    const gasWheelTargetRot = -(fwPctVal / 100) * Math.PI * 1.6;
    if (gasWheelRef.current) {
      gasWheelRef.current.rotation.z = THREE.MathUtils.lerp(
        gasWheelRef.current.rotation.z,
        gasWheelTargetRot,
        0.48,
      );
    }

    if (oilLampMatRef.current) {
      const ok = !s.isBlackout && s.controlRods <= 0.9 && !s.az5Active;
      const col = ok ? "#33ff66" : "#ff2a2a";
      oilLampMatRef.current.color.set(col);
      oilLampMatRef.current.emissive.set(s.isBlackout ? "#000000" : col);
      oilLampMatRef.current.emissiveIntensity = s.isBlackout ? 0 : 1.35;
    }
    if (gasLampMatRef.current) {
      const highlightGasTut =
        variant === "rear" &&
        (s.tutorialPhase === "STEP_3_BUILD_STEAM" ||
          s.tutorialPhase === "STEP_7_VOID_DRILL") &&
        s.feedwaterValve < 0.45;
      if (highlightGasTut) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 6.0);
        const col = pulse > 0.5 ? "#33ff66" : "#ffb000";
        gasLampMatRef.current.color.set(col);
        gasLampMatRef.current.emissive.set(col);
        gasLampMatRef.current.emissiveIntensity = 1.6 + pulse * 1.4;
      } else {
        const ok =
          !s.isBlackout &&
          s.drumWaterLevel >= -250 &&
          s.drumWaterLevel <= 250;
        const col = ok ? "#33ff66" : "#ff2a2a";
        gasLampMatRef.current.color.set(col);
        gasLampMatRef.current.emissive.set(s.isBlackout ? "#000000" : col);
        gasLampMatRef.current.emissiveIntensity = s.isBlackout ? 0 : 1.35;
      }
    }

    // 5-Segment Ribbed Phosphor Glass Rod-Drive Bar on UNIT A-2
    const activeOilSegs = Math.round(s.controlRods * 5);
    for (let i = 0; i < 5; i++) {
      const mat = oilBarMatRefs.current[i];
      if (!mat) continue;
      const isLit = !s.isBlackout && i < activeOilSegs;
      const col = i >= 4 ? "#d98218" : "#28b862";
      mat.color.set(isLit ? col : "#141916");
      mat.emissive.set(isLit ? col : "#000000");
      mat.emissiveIntensity = isLit ? 1.15 : 0;
    }

    // 10-Segment Ribbed Phosphor Glass Feedwater Flow Bar on UNIT B
    const activeGasSegs = Math.round(s.feedwaterValve * 10);
    for (let i = 0; i < 10; i++) {
      const mat = gasBarMatRefs.current[i];
      if (!mat) continue;
      const isLit = !s.isBlackout && i < activeGasSegs;
      const col = i >= 8 ? "#d98218" : "#28b862";
      mat.color.set(isLit ? col : "#141916");
      mat.emissive.set(isLit ? col : "#000000");
      mat.emissiveIntensity = isLit ? 1.15 : 0;
    }

    // 2. UNIT A-2: 37 Octagonal Stainless-Steel RBMK Bio-Shield Tiles, Pop-Out Pins & Spring-Return Refueling Lever
    let activeHotspots = 0;
    if (variant === "left-rear") {
      const activeRodCount = Math.round(
        s.controlRods * RBMK_OCTAGON_TILES.length,
      );
      let anyPinMoved = false;
      for (let i = 0; i < RBMK_OCTAGON_TILES.length; i++) {
        const lensMat = channelLensMatRefs.current[i];
        const rimMat = channelRimMatRefs.current[i];
        const flux = s.rodTilesFlux[i] ?? 0;
        const severity = s.channelHotspots[i];
        const isSpent = severity === "amber";
        const isSelected = s.selectedRefuelChannel === i && isSpent;
        const isHovered = hoveredChannelRef.current === i;
        const isRodWithdrawn = flux > 0.1 || i < activeRodCount;
        const isHighReactivity = s.controlRods > 0.85;

        if (isSpent) {
          activeHotspots += 1;
        }

        if (lensMat) {
          if (s.isBlackout) {
            lensMat.color.set("#121a16");
            lensMat.emissive.set("#000000");
            lensMat.emissiveIntensity = 0;
          } else if (isSelected) {
            const pulse = 1.65 + Math.sin(t * 12) * 0.55;
            lensMat.color.set("#ffe680");
            lensMat.emissive.set("#ffcc22");
            lensMat.emissiveIntensity = pulse;
          } else if (isSpent) {
            const pulse = 1.15 + Math.sin(t * 7 + i) * 0.55;
            lensMat.color.set("#ff9900");
            lensMat.emissive.set("#ffb000");
            lensMat.emissiveIntensity = pulse;
          } else if (isRodWithdrawn) {
            if (isHighReactivity) {
              lensMat.color.set("#d98218");
              lensMat.emissive.set("#ffb000");
              lensMat.emissiveIntensity = 1.05;
            } else {
              lensMat.color.set("#227846");
              lensMat.emissive.set("#33ff66");
              lensMat.emissiveIntensity = 0.95;
            }
          } else {
            lensMat.color.set("#4a1412");
            lensMat.emissive.set("#991818");
            lensMat.emissiveIntensity = 0.38;
          }
        }

        if (rimMat) {
          if (s.isBlackout) {
            rimMat.color.set("#1c2220");
            rimMat.emissive.set("#000000");
            rimMat.emissiveIntensity = 0;
          } else if (isSelected) {
            const pulse = 1.9 + Math.sin(t * 10) * 0.45;
            rimMat.color.set("#fff394");
            rimMat.emissive.set("#ffd833");
            rimMat.emissiveIntensity = isHovered ? 2.4 : pulse;
          } else if (isSpent) {
            const pulse = 1.45 + Math.sin(t * 7 + i) * 0.45;
            rimMat.color.set(isHovered ? "#ffe299" : "#ff5500");
            rimMat.emissive.set(isHovered ? "#ffffff" : "#ff7a00");
            rimMat.emissiveIntensity = isHovered ? 2.2 : pulse;
          } else if (isHovered) {
            rimMat.color.set("#9effd6");
            rimMat.emissive.set("#44ffaa");
            rimMat.emissiveIntensity = 1.25;
          } else {
            rimMat.color.set("#30393e");
            rimMat.emissive.set("#000000");
            rimMat.emissiveIntensity = 0;
          }
        }

        const targetPinZ = isSelected
          ? 0.028
          : isSpent
            ? 0.022
            : isRodWithdrawn
              ? 0.014
              : 0.005;
        const curZ =
          pinZRefs.current[i] < -1 ? targetPinZ : pinZRefs.current[i];
        const nextZ = THREE.MathUtils.lerp(curZ, targetPinZ, 0.25);
        if (pinZRefs.current[i] < -1 || Math.abs(nextZ - curZ) > 0.0004) {
          pinZRefs.current[i] = nextZ;
          anyPinMoved = true;
          const tile = RBMK_OCTAGON_TILES[i];
          _rbmkPinDummy.position.set(tile.x, tile.y, nextZ);
          _rbmkPinDummy.rotation.set(0, 0, 0);
          _rbmkPinDummy.scale.set(1, 1, 1);
          _rbmkPinDummy.updateMatrix();
          rbmkPinShaftInstRef.current?.setMatrixAt(i, _rbmkPinDummy.matrix);
          rbmkPinCapInstRef.current?.setMatrixAt(i, _rbmkPinDummy.matrix);
        }
      }
      if (anyPinMoved) {
        if (rbmkPinShaftInstRef.current) {
          rbmkPinShaftInstRef.current.instanceMatrix.needsUpdate = true;
        }
        if (rbmkPinCapInstRef.current) {
          rbmkPinCapInstRef.current.instanceMatrix.needsUpdate = true;
        }
      }

      // Spring-Return Rod Refueling Lever & 10-Segment Reload Progress / Fuel Health Bar
      const komradRefuelOverride = getKomradControlVisualOverride("rodRefuelLever");
      const isRefuelDragging =
        pistonDragRef.current.active || komradRefuelOverride >= 0;
      const leverDragRatio = pistonDragRef.current.active
        ? pistonDragRef.current.currentPos
        : komradRefuelOverride >= 0
          ? komradRefuelOverride
          : 0;
      if (boronPistonGroupRef.current) {
        const targetY = 0.086 - leverDragRatio * 0.172;
        boronPistonGroupRef.current.position.y = THREE.MathUtils.lerp(
          boronPistonGroupRef.current.position.y,
          targetY,
          isRefuelDragging ? 0.45 : 0.22,
        );
      }
      if (isRefuelDragging) {
        const dragSegs = Math.round(leverDragRatio * 10);
        const dragCol = leverDragRatio >= 0.82 ? "#33ff66" : "#ffb000";
        for (let i = 0; i < 10; i++) {
          const mat = boronBarMatRefs.current[i];
          if (!mat) continue;
          const isLit = !s.isBlackout && i < dragSegs;
          mat.color.set(isLit ? dragCol : "#141916");
          mat.emissive.set(isLit ? dragCol : "#000000");
          mat.emissiveIntensity = isLit ? 1.35 : 0;
        }
      } else {
        const healthySegs = Math.max(0, 10 - activeHotspots * 2);
        for (let i = 0; i < 10; i++) {
          const mat = boronBarMatRefs.current[i];
          if (!mat) continue;
          const isLit = !s.isBlackout && i < healthySegs;
          const col =
            activeHotspots >= 4
              ? "#c92a1d"
              : activeHotspots >= 1
                ? "#d98218"
                : "#28b862";
          mat.color.set(isLit ? col : "#141916");
          mat.emissive.set(isLit ? col : "#000000");
          mat.emissiveIntensity = isLit ? 1.15 : 0;
        }
      }

      if (
        !s.diagFeedActive &&
        (lastRodPctDrawRef.current < 0 || t - lastRodPctDrawRef.current >= 0.105)
      ) {
        lastRodPctDrawRef.current = t;
        const rpTex = rodPctMatRef.current?.map as
          | THREE.CanvasTexture
          | undefined;
        const rodPctDisplay = Math.round(s.controlRods * 100);
        const rpSig = `${rodPctDisplay}|${s.az5Active}|${s.isBlackout}`;
        if (rpTex && rpTex.userData.lastSig !== rpSig) {
          rpTex.userData.lastSig = rpSig;
          const rpCanvas = rpTex.image as HTMLCanvasElement;
          const rpCtx = rpCanvas.getContext("2d");
          if (rpCtx) {
            rpCtx.fillStyle = s.isBlackout ? "#070a08" : "#08140d";
            rpCtx.fillRect(0, 0, rpCanvas.width, rpCanvas.height);
            rpCtx.strokeStyle = s.az5Active
              ? "#ff3333"
              : s.controlRods > 0.85
                ? "#ffb000"
                : "#b8a46b";
            rpCtx.lineWidth = 4;
            rpCtx.strokeRect(2, 2, rpCanvas.width - 4, rpCanvas.height - 4);
            rpCtx.font = '900 40px "VT323", monospace';
            rpCtx.textAlign = "center";
            rpCtx.textBaseline = "middle";
            if (s.isBlackout) {
              rpCtx.fillStyle = "#552222";
              rpCtx.fillText(
                "NO POWER",
                rpCanvas.width / 2,
                rpCanvas.height / 2 + 1,
                rpCanvas.width - 20,
              );
            } else {
              rpCtx.fillStyle = s.az5Active
                ? "#ff4444"
                : s.controlRods > 0.85
                  ? "#ffb000"
                  : "#33ff66";
              rpCtx.fillText(
                `RODS: ${rodPctDisplay}%`,
                rpCanvas.width / 2,
                rpCanvas.height / 2 + 1,
                rpCanvas.width - 20,
              );
            }
            rpTex.needsUpdate = true;
          }
        }
      }

      if (
        !s.diagFeedActive &&
        (lastRefuelDrawRef.current < 0 || t - lastRefuelDrawRef.current >= 0.105)
      ) {
        lastRefuelDrawRef.current = t;
        const rtTex = refuelTargetMatRef.current?.map as
          | THREE.CanvasTexture
          | undefined;
        const rtSig = `${s.selectedRefuelChannel ?? "none"}|${activeHotspots}|${s.isBlackout}`;
        if (rtTex && rtTex.userData.lastSig !== rtSig) {
          rtTex.userData.lastSig = rtSig;
          const rtCanvas = rtTex.image as HTMLCanvasElement;
          const rtCtx = rtCanvas.getContext("2d");
          if (rtCtx) {
            rtCtx.fillStyle = s.isBlackout ? "#070a08" : "#08140d";
            rtCtx.fillRect(0, 0, rtCanvas.width, rtCanvas.height);
            rtCtx.strokeStyle =
              s.selectedRefuelChannel !== null
                ? "#33ff66"
                : activeHotspots > 0
                  ? "#ffb000"
                  : "#b8a46b";
            rtCtx.lineWidth = 4;
            rtCtx.strokeRect(2, 2, rtCanvas.width - 4, rtCanvas.height - 4);
            rtCtx.font = 'bold 38px "VT323", monospace';
            rtCtx.textAlign = "center";
            rtCtx.textBaseline = "middle";
            if (s.isBlackout) {
              rtCtx.fillStyle = "#552222";
              rtCtx.fillText(
                "NO POWER",
                rtCanvas.width / 2,
                rtCanvas.height / 2 + 1,
                rtCanvas.width - 20,
              );
            } else if (s.selectedRefuelChannel !== null) {
              rtCtx.fillStyle = "#33ff66";
              rtCtx.fillText(
                `LOCKED: CH #${String(s.selectedRefuelChannel + 1).padStart(2, "0")}`,
                rtCanvas.width / 2,
                rtCanvas.height / 2 + 1,
                rtCanvas.width - 20,
              );
            } else if (activeHotspots > 0) {
              rtCtx.fillStyle = "#ffb000";
              rtCtx.fillText(
                "CLICK AMBER TILE!",
                rtCanvas.width / 2,
                rtCanvas.height / 2 + 1,
                rtCanvas.width - 20,
              );
            } else {
              rtCtx.fillStyle = "#8ce6a8";
              rtCtx.fillText(
                "37/37 FUEL OK",
                rtCanvas.width / 2,
                rtCanvas.height / 2 + 1,
                rtCanvas.width - 20,
              );
            }
            rtTex.needsUpdate = true;
          }
        }
      }
    }

    // 3. UNIT B: MCP 1-4 Main Circulation Pumps, Containment Scrubbers & Bubbler Drain Sight-Glass
    if (variant === "rear") {
      const isColdStandby =
        s.thermalPower < 50 && s.tutorialPhase !== "COMPLETED";
      for (let i = 0; i < 4; i++) {
        const jMat = sealJewelMatRefs.current[i];
        if (!jMat) continue;
        const isOk =
          Boolean(s.mcpActive[i]) && (i >= 3 || Boolean(s.sealToggles[i]));
        const col = s.isBlackout
          ? "#18221d"
          : isOk
            ? "#33ff66"
            : isColdStandby
              ? "#6e5218"
              : "#ff2a2a";
        jMat.color.set(col);
        jMat.emissive.set(s.isBlackout ? "#000000" : col);
        jMat.emissiveIntensity = s.isBlackout
          ? 0
          : isOk
            ? 1.4
            : isColdStandby
              ? 0.35
              : 1.7;
      }

      for (let i = 0; i < 3; i++) {
        const bat = sealToggleBatRefs.current[i];
        if (!bat) continue;
        const targetRotX =
          s.mcpActive[i] && s.sealToggles[i] ? -0.58 : 0.58;
        bat.rotation.x = THREE.MathUtils.lerp(bat.rotation.x, targetRotX, 0.28);
      }

      if (emergSealDepressRef.current > 0) {
        emergSealDepressRef.current = Math.max(
          0,
          emergSealDepressRef.current - dt * 2.8,
        );
      }
      if (emergSealBtnRef.current) {
        const komradEmergOverride =
          getKomradControlVisualOverride("emergSealLock");
        const effEmergDepress =
          komradEmergOverride >= 0
            ? Math.max(emergSealDepressRef.current, komradEmergOverride)
            : emergSealDepressRef.current;
        emergSealBtnRef.current.position.z =
          0.028 - effEmergDepress * 0.016;
      }

      const isDrainActive = s.bubblerDraining || s.steamDumpValve;
      if (drainLeverGroupRef.current) {
        const komradDrainOverride =
          getKomradControlVisualOverride("bubblerDrain");
        const prog = drainDragRef.current.active
          ? drainDragRef.current.progress
          : komradDrainOverride >= 0
            ? komradDrainOverride
            : isDrainActive
              ? 1.0
              : 0;
        const targetY = 0.095 - prog * 0.19;
        drainLeverGroupRef.current.position.y = THREE.MathUtils.lerp(
          drainLeverGroupRef.current.position.y,
          targetY,
          0.28,
        );
        if (
          isDrainActive &&
          t - drainDragRef.current.lastHissTime > 0.18
        ) {
          drainDragRef.current.lastHissTime = t;
          playSteamVentHiss(0.55);
        }
      }

      const highlightDrainTut =
        !s.isBlackout && (s.drumPressure > 76 || s.bubblerLevel >= 82);
      if (drainRingMatRef.current) {
        if (highlightDrainTut) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 6.0);
          const col = pulse > 0.5 ? "#33ff66" : "#ffb000";
          drainRingMatRef.current.color.set(col);
          drainRingMatRef.current.emissive.set(col);
          drainRingMatRef.current.emissiveIntensity = 1.4 + pulse * 1.2;
        } else {
          drainRingMatRef.current.color.set("#d98218");
          drainRingMatRef.current.emissive.set("#000000");
          drainRingMatRef.current.emissiveIntensity = 0;
        }
      }

      if (sightGlassWaterMeshRef.current && sightGlassWaterMatRef.current) {
        const ratio = THREE.MathUtils.clamp(s.bubblerLevel / 100, 0.06, 1);
        sightGlassWaterMeshRef.current.scale.y = ratio;
        sightGlassWaterMeshRef.current.position.y = -0.115 + ratio * 0.115;
        if (highlightDrainTut) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 6.0);
          const wCol = pulse > 0.5 ? "#33ff66" : "#ffb000";
          sightGlassWaterMatRef.current.color.set(wCol);
          sightGlassWaterMatRef.current.emissive.set(wCol);
          sightGlassWaterMatRef.current.emissiveIntensity = 1.4 + pulse * 0.9;
        } else {
          const wCol =
            s.bubblerLevel >= 88
              ? "#ff2a2a"
              : s.bubblerLevel >= 72
                ? "#ffb000"
                : "#28d8ff";
          sightGlassWaterMatRef.current.color.set(wCol);
          sightGlassWaterMatRef.current.emissive.set(
            s.isBlackout ? "#000000" : wCol,
          );
          sightGlassWaterMatRef.current.emissiveIntensity = s.isBlackout
            ? 0
            : 1.25;
        }
      }
    }

    // 4. Update Phosphor-Green CRT Monitor Bay (Centered 3-Cell Layout + Oscilloscope Graticule) — throttled to <=10 Hz (0.105s), paused during diagnostic video
    if (
      s.diagFeedActive ||
      (lastVfdDrawRef.current >= 0 && t - lastVfdDrawRef.current < 0.105)
    )
      return;
    lastVfdDrawRef.current = t;
    const rodPct = Math.round(s.controlRods * 100);
    const voidPct = Math.round(s.voidFraction * 100);
    const xenonPct = Math.round(s.xenon);
    const fwPct = Math.round(s.feedwaterValve * 100);
    const boronPct = Math.round(s.boronTankLevel);
    const bubblerPct = Math.round(s.bubblerLevel);
    const graphiteTempRound = Math.round(s.graphiteTemp);
    const isReactivityDanger =
      s.thermalPower > 3500 ||
      voidPct > 35 ||
      s.graphiteTemp > 540 ||
      Math.abs(s.reactivity) > 0.015 ||
      (rodPct > 75 && s.coreTemp > 520);
    const sig = `${variant}|${s.tutorialPhase}|${Math.round(s.thermalPower)}|${Math.round(s.drumPressure)}|${Math.round(s.drumWaterLevel)}|${fwPct}|${graphiteTempRound}|${Math.round(s.heliumPressure)}|${bubblerPct}|${boronPct}|${rodPct}|${voidPct}|${xenonPct}|${isReactivityDanger}|${s.bubblerDraining}|${s.containmentSealLocked}|${s.mcpActive.join(",")}|${activeHotspots}|${s.selectedRefuelChannel ?? "none"}|${s.isBlackout}`;
    const tex = vfdMatRef.current?.map as THREE.CanvasTexture | undefined;
    if (tex && tex.userData.lastSig !== sig) {
      lastVfdDrawRef.current = t;
      tex.userData.lastSig = sig;
      const canvas = tex.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const cells =
          variant === "rear"
            ? [
                {
                  label: "DRUM BAR",
                  val: `${s.drumPressure.toFixed(0)} BAR`,
                  danger: s.drumPressure >= 80,
                },
                {
                  label: "WATER LEVEL",
                  val: `${s.drumWaterLevel.toFixed(0)} MM`,
                  danger: Math.abs(s.drumWaterLevel) > 100,
                },
                {
                  label: "FW / HE-N2",
                  val: `${fwPct}% (${s.graphiteTemp}°C)`,
                  danger:
                    s.graphiteTemp > 540 ||
                    (fwPct < 15 && s.thermalPower > 400),
                },
              ]
            : [
                {
                  label: "THERMAL MWT",
                  val: `${Math.round(s.thermalPower)} MWT`,
                  danger: s.thermalPower >= 3500,
                },
                {
                  label: "XENON / VOID",
                  val: `${xenonPct}% / ${voidPct}%`,
                  danger: voidPct > 35 || xenonPct > 35,
                },
                {
                  label: "FUEL / RODS",
                  val: `${37 - activeHotspots}/37 • ${rodPct}%`,
                  danger: activeHotspots >= 4 || rodPct >= 90,
                },
              ];

        const unitA2StatusLine =
          activeHotspots >= 4
            ? `⚠️ SPENT FUEL OVERHEAT (${activeHotspots} AMBER): CLICK AMBER TILE & PULL [ROD REFUELING LEVER] DOWN!`
            : voidPct > 35
              ? `⚠️ STEAM VOIDS (${voidPct}%): RAISE [FEEDWATER] (UNIT B), LOWER RODS, OR PRESS [BORON INJECTION]!`
              : xenonPct > 35
                ? `⚠️ XENON-135 (${xenonPct}%): RAISE [RODS] OR TRIM EXCESS [FEEDWATER] (UNIT B) TO BALANCE!`
                : s.tutorialPhase === "STEP_2_PULL_RODS" && s.controlRods < 0.5
                  ? `> STEP 2: SCROLL OR DRAG [CONTROL ROD DRIVE] WHEEL (LEFT BAY) TO 55%!`
                  : activeHotspots > 0
                    ? `> ${activeHotspots} SPENT ROD(S) AMBER: ${s.selectedRefuelChannel !== null ? `CH #${s.selectedRefuelChannel + 1} LOCKED — PULL REFUEL LEVER!` : "CLICK AMBER TILE TO TARGET REFUEL!"}`
                    : `> RODS: ${rodPct}% | FEEDWATER: ${fwPct}% | REACTIVITY BALANCED | FUEL: 37/37 OK`;

        paintSovietCRTScreen(ctx, 768, 144, {
          headerCode: variant === "rear" ? "CRT-84B" : "CRT-84A2",
          cells,
          statusLine:
            variant === "rear"
              ? `DRUM: ${s.drumPressure.toFixed(0)} BAR | LVL: ${s.drumWaterLevel.toFixed(0)} MM | GRAPHITE: ${s.graphiteTemp}°C (${s.heliumPressure.toFixed(0)} BAR) | BUBBLER: ${bubblerPct}%`
              : unitA2StatusLine,
          statusDanger:
            variant === "rear"
              ? s.drumPressure >= 80 ||
                Math.abs(s.drumWaterLevel) > 100 ||
                s.graphiteTemp > 540 ||
                (!s.containmentSealLocked &&
                  (s.thermalPower > 150 || s.tutorialPhase === "COMPLETED")) ||
                bubblerPct >= 88
              : isReactivityDanger ||
                activeHotspots >= 4 ||
                boronPct < 25 ||
                voidPct > 35 ||
                xenonPct > 35,
          footerLine:
            variant === "rear"
              ? `MCP: ${s.mcpActive.filter(Boolean).length}/4 • SEALS: ${s.containmentSealLocked ? "LOCKED" : "LEAK!"} • FW/GAS: ${fwPct}% • BUBBLER DRAIN: ${s.bubblerDraining ? "OPEN" : "SHUT"}`
              : `MWT: ${Math.round(s.thermalPower)}/3200 • RODS: ${rodPct}% • BORON: ${boronPct}% • SPENT RODS: ${activeHotspots}`,
          isBlackout: s.isBlackout,
        });
        tex.needsUpdate = true;
      }
    }
  });

  const wrapMimicSegments = useMemo<readonly MimicSegmentSpec[]>(() => {
    if (variant === "rear") {
      // UNIT B: HELIUM-N2 (left, x=-0.53) -> HELIUM BAR gauge (x=-0.51, y=1.775),
      // SEAL SCRUBBERS (center, x=0.0) -> GRAPHITE gauge (x=0.0, y=1.775),
      // BUBBLER DRAIN (right, x=+0.53) -> BUBBLER H2O gauge (x=+0.51, y=1.775)
      return [
        // Oxide-Red Helium-N2 Gas Loop up left flank (x=-0.76) to HELIUM BAR & GRAPHITE gauges
        { x: -0.645, y: 0.78, w: 0.23, h: 0.015, color: "#a83830" },
        { x: -0.76, y: 1.278, w: 0.015, h: 1.01, color: "#a83830" },
        { x: -0.635, y: 1.775, w: 0.25, h: 0.015, color: "#a83830" },
        { x: -0.255, y: 1.775, w: 0.51, h: 0.015, color: "#a83830" },
        // Horizontal Yellow Containment Interlock header in open belt (y=1.21) connecting Left/Center/Right assemblies
        { x: -0.265, y: 1.21, w: 0.53, h: 0.015, color: "#c8a838" },
        { x: 0.265, y: 1.21, w: 0.53, h: 0.015, color: "#c8a838" },
        { x: -0.53, y: 1.165, w: 0.015, h: 0.09, color: "#a83830" },
        { x: 0.0, y: 1.175, w: 0.015, h: 0.07, color: "#c8a838" },
        { x: 0.53, y: 1.165, w: 0.015, h: 0.09, color: "#388898" },
        // Cyan Bubbler Condensate Drain Line up right flank (x=+0.76) to BUBBLER H2O gauge & lower return header
        { x: 0.645, y: 0.78, w: 0.23, h: 0.015, color: "#388898" },
        { x: 0.76, y: 1.278, w: 0.015, h: 1.01, color: "#388898" },
        { x: 0.635, y: 1.775, w: 0.25, h: 0.015, color: "#388898" },
        { x: 0.255, y: 1.775, w: 0.51, h: 0.015, color: "#388898" },
        // Lower condensate & gas return manifold at y=0.36 below control deck
        { x: 0, y: 0.36, w: 1.06, h: 0.016, color: "#388898" },
        { x: -0.53, y: 0.47, w: 0.015, h: 0.22, color: "#a83830" },
        { x: 0.0, y: 0.47, w: 0.015, h: 0.22, color: "#c8a838" },
        { x: 0.53, y: 0.47, w: 0.015, h: 0.22, color: "#388898" },
      ];
    }
    // UNIT A-2: Clean outer synoptic frame around enlarged upper RBMK CORE and 2 wide lower sloped bays
    return [
      { x: -0.765, y: 1.635, w: 0.015, h: 0.65, color: "#c8a838" },
      { x: 0.765, y: 1.635, w: 0.015, h: 0.65, color: "#388898" },
      { x: -0.75, y: 1.612, w: 0.03, h: 0.015, color: "#c8a838" },
      { x: 0.75, y: 1.612, w: 0.03, h: 0.015, color: "#388898" },
      { x: -0.775, y: 0.78, w: 0.015, h: 0.93, color: "#c8a838" },
      { x: 0.775, y: 0.78, w: 0.015, h: 0.93, color: "#388898" },
      { x: 0, y: 0.78, w: 0.016, h: 0.93, color: "#a83830" },
      { x: 0, y: 0.315, w: 1.55, h: 0.016, color: "#a83830" },
    ];
  }, [variant]);

  const wrapMimicNodes = useMemo<readonly MimicNodeSpec[]>(
    () =>
      variant === "rear"
        ? [
            { x: -0.76, y: 1.775, color: "#a83830" },
            { x: -0.53, y: 1.21, color: "#a83830" },
            { x: 0.0, y: 1.21, color: "#c8a838" },
            { x: 0.53, y: 1.21, color: "#388898" },
            { x: 0.76, y: 1.775, color: "#388898" },
            { x: -0.53, y: 0.36, color: "#a83830" },
            { x: 0.0, y: 0.36, color: "#c8a838" },
            { x: 0.53, y: 0.36, color: "#388898" },
          ]
        : [
            { x: -0.765, y: 1.96, color: "#c8a838" },
            { x: -0.765, y: 1.612, color: "#c8a838" },
            { x: 0.765, y: 1.96, color: "#388898" },
            { x: 0.765, y: 1.612, color: "#388898" },
            { x: -0.775, y: 0.315, color: "#c8a838" },
            { x: 0.0, y: 0.315, color: "#a83830" },
            { x: 0.775, y: 0.315, color: "#388898" },
          ],
    [variant],
  );

  const wrapRecessedWells = useMemo(
    () =>
      variant === "rear"
        ? [
            // Enlarged recessed dark instrument framing filling the sloped desk
            { x: -0.555, y: 0.72, w: 0.43, h: 0.65 },
            { x: 0.0, y: 0.72, w: 0.59, h: 0.70 },
            { x: 0.555, y: 0.72, w: 0.43, h: 0.65 },
          ]
        : [
            // Two wide recessed dark instrument bays filling the lower sloped desk for CONTROL ROD DRIVE & ROD REFUELING
            { x: -0.39, y: 0.77, w: 0.73, h: 0.90 },
            { x: 0.39, y: 0.77, w: 0.73, h: 0.90 },
          ],
    [variant],
  );

  return (
    <group ref={groupRef}>
      {/* Authentic Layered Soviet RBMK Blue-Grey / Olive-Grey Modular Steel Cabinet (`#485450`),
          Upper Canopy Overhang with 6 Annunciator Lamps, Console Ledge & Synoptic Mimic Lines */}
      <SovietModularSteelCabinet3D
        width={1.66}
        unitCode={variant === "rear" ? "B" : "A2"}
        annunciatorLabels={
          variant === "rear"
            ? [
                "SEPARATOR",
                "DRUM LEVEL",
                "FEEDWATER",
                "MCP PUMPS",
                "STEAM DUMP",
                "CONDENSER",
              ]
            : [
                "THERMAL MW",
                "XENON VOID",
                "CORE MAP",
                "REFUEL ROD",
                "BORON TANK",
                "REACTIVITY",
              ]
        }
        mimicSegments={wrapMimicSegments}
        mimicNodes={wrapMimicNodes}
        recessedWells={wrapRecessedWells}
        dividerY={1.295}
        lowerLedgeY={0.36}
        openLeftSide={false}
        openRightSide={false}
        hideChartRecorders={variant === "left-rear"}
        hideStripMeters={variant === "left-rear"}
        unifiedUpperFace={variant === "left-rear"}
      />

      {/* Top Engraved Header Plaque (Slim single-line header on UNIT A-2; full header on UNIT B) */}
      {variant === "rear" ? (
        <>
          <mesh position={[0, 2.13, 0.033]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.42, 0.156, 0.014]} />
            <meshStandardMaterial color="#b8a46b" metalness={0.82} roughness={0.32} />
          </mesh>
          <mesh position={[0, 2.13, 0.043]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[1.40, 0.148]} />
            <meshStandardMaterial
              map={headerTex}
              emissive="#ffffff"
              emissiveMap={headerTex}
              emissiveIntensity={0.35}
              roughness={0.85}
              metalness={0.05}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, 2.182, 0.026]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.48, 0.068, 0.012]} />
            <meshStandardMaterial color="#b8a46b" metalness={0.82} roughness={0.32} />
          </mesh>
          <mesh position={[0, 2.182, 0.034]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[1.46, 0.060]} />
            <meshStandardMaterial
              map={headerTex}
              emissive="#ffffff"
              emissiveMap={headerTex}
              emissiveIntensity={0.35}
              roughness={0.85}
              metalness={0.05}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
        </>
      )}

      {/* Overhead Hooded Tungsten Work-Lamps */}
      {[-0.48, 0.48].map((lx, lIdx) => (
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

      {/* Top Row: 3 High-Res 512x512 GOST-84 Manometer Gauges (UNIT B ONLY — removed on UNIT A-2!) */}
      {variant === "rear" && (
        <group position={[0, 1.775, 0.03]}>
          <HighDetailManometer3D
            position={[-0.51, 0, 0]}
            title="DRUM BAR"
            cyrillicSub="SEPARATOR PRESS."
            unit="0-100 BAR"
            serial="NO. 84-BS1"
            min={0}
            max={100}
            nominalMark={70}
            dangerThreshold={80}
            getValue={() => useGameStore.getState().drumPressure}
            getAlertLevel={(s) => {
              const isOp =
                s.thermalPower > 180 || s.tutorialPhase === "COMPLETED";
              return (isOp && s.pressureBar < 28) || s.pressureBar >= 78
                ? "critical"
                : (isOp && s.pressureBar < 36) || s.pressureBar > 75
                  ? "warn"
                  : "normal";
            }}
          />
          <HighDetailManometer3D
            position={[0, 0, 0]}
            title="WATER LEVEL"
            cyrillicSub="DRUM LEVEL (MM)"
            unit="-400..+400 MM"
            serial="NO. 84-WL2"
            min={-400}
            max={400}
            centerNominal={true}
            lowDangerThreshold={-250}
            dangerThreshold={250}
            getValue={() => useGameStore.getState().drumWaterLevel}
            getAlertLevel={(s) =>
              s.graphiteTemp > 620 || Math.abs(s.drumWaterLevel) > 250
                ? "critical"
                : s.graphiteTemp > 560 || Math.abs(s.drumWaterLevel) > 150
                  ? "warn"
                  : "normal"
            }
          />
          <HighDetailManometer3D
            position={[0.51, 0, 0]}
            title="FEEDWATER %"
            cyrillicSub="FW VALVE (%)"
            unit="0-100 %"
            serial="NO. 84-FW3"
            min={0}
            max={100}
            dangerThreshold={95}
            getValue={() => useGameStore.getState().feedwaterValve * 100}
            getAlertLevel={(s) => {
              const isOp =
                s.thermalPower > 180 || s.tutorialPhase === "COMPLETED";
              return s.bubblerLevel > 82
                ? "critical"
                : s.bubblerLevel > 72 ||
                    (isOp && s.sealToggles.some((on) => !on))
                  ? "warn"
                  : "normal";
            }}
          />
        </group>
      )}

      {/* Molded Phosphor-Green CRT Monitor Bay (CRT VL-84): Tucked directly below header on UNIT A-2, angled riser on UNIT B */}
      {variant === "rear" ? (
        <group position={[0, 1.462, 0.04]} rotation={[-0.08, 0, 0]}>
          <SovietCRTMonitorBay3D
            position={[0, 0, 0]}
            screenMatRef={vfdMatRef}
            screenTexture={vfdTexture}
            modelBadge="CRT VL-84B"
          />
        </group>
      ) : (
        <group position={[0, 2.032, 0.024]} scale={[0.92, 0.76, 0.85]}>
          <SovietCRTMonitorBay3D
            position={[0, 0, 0]}
            screenMatRef={vfdMatRef}
            screenTexture={vfdTexture}
            modelBadge="CRT VL-84A2"
          />
        </group>
      )}

      {/* UNIT A-2 PROMOTED UPPER-FACE RBMK CORE 37-CHANNEL REFUELING MATRIX (~1.85x-2.0x Larger!) */}
      {variant === "left-rear" && (
        <group position={[0, 1.612, 0.024]}>
          {/* Left Flank: RBMK CORE Nameplate, CORE / RODS Indicator & Color Key Legend */}
          <group position={[-0.555, 0, 0.004]}>
            <mesh position={[0, 0.16, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.36, 0.13, 0.012]} />
              <meshStandardMaterial color="#8c7a4b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.16, 0.0085]} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.344, 0.116]} />
              <meshStandardMaterial
                map={centerPlateTex}
                emissive="#ffffff"
                emissiveMap={centerPlateTex}
                emissiveIntensity={0.35}
                roughness={0.55}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
            <SovietBacklitIndicatorBlock3D
              position={[0, -0.01, 0.012]}
              scale={1.12}
              label="CORE / RODS"
              getAlertState={(s) => {
                const hc = Object.keys(s.channelHotspots).length;
                const isOp =
                  s.thermalPower > 180 || s.tutorialPhase === "COMPLETED";
                return {
                  level:
                    hc >= 4 ||
                    (isOp && s.pressureBar < 28) ||
                    s.pressureBar >= 78
                      ? "critical"
                      : hc >= 1 ||
                          (isOp && s.pressureBar < 36) ||
                          s.pressureBar > 75
                        ? "warn"
                        : "normal",
                  acknowledged: coreRodDraggingRef.current,
                };
              }}
            />
            <mesh position={[0, -0.15, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.36, 0.095, 0.012]} />
              <meshStandardMaterial color="#8c7a4b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, -0.15, 0.0085]} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.344, 0.083]} />
              <meshStandardMaterial
                map={coreLegendTex}
                emissive="#ffffff"
                emissiveMap={coreLegendTex}
                emissiveIntensity={0.35}
                roughness={0.55}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
          </group>

          {/* Right Flank: Refuel Protocol Placard & Live Mirrored Target-Channel Display Window */}
          <group position={[0.555, 0, 0.004]}>
            <mesh position={[0, 0.16, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.36, 0.13, 0.012]} />
              <meshStandardMaterial color="#8c7a4b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.16, 0.0085]} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.344, 0.116]} />
              <meshStandardMaterial
                map={refuelProtocolTex}
                emissive="#ffffff"
                emissiveMap={refuelProtocolTex}
                emissiveIntensity={0.35}
                roughness={0.55}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
            <mesh position={[0, -0.03, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.36, 0.10, 0.012]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, -0.03, 0.0085]} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.342, 0.084]} />
              <meshStandardMaterial
                map={refuelTargetTex}
                emissive="#ffffff"
                emissiveMap={refuelTargetTex}
                emissiveIntensity={0.68}
                roughness={0.35}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
          </group>

          {/* Enlarged Center Octagonal RBMK-1000 Biological Shield Vessel (37 Fuel Channels) */}
          <group
            position={[0, 0, 0]}
            scale={[1.64, 1.46, 1.35]}
            onWheel={(e: ThreeEvent<WheelEvent>) => {
              if (useCameraLookStore.getState().isFreeLookMode) return;
              e.stopPropagation();
              e.nativeEvent?.stopImmediatePropagation?.();
              const isShift = Boolean(e.shiftKey || e.nativeEvent?.shiftKey);
              const stepPct = isShift ? 1 : 5;
              const deltaPct = e.deltaY < 0 ? stepPct : -stepPct;
              playDetentClick(2);
              useGameStore.getState().adjustControlRodLevel(deltaPct);
            }}
            onPointerOver={() => {
              useGameStore
                .getState()
                .setHoveredControlHint(
                  "[CLICK AMBER TILE]: TARGET SPENT ROD FOR REFUELING | [DRAG / SCROLL]: ADJUST RODS (±5%)",
                );
            }}
            onPointerOut={() => {
              hoveredChannelRef.current = null;
              useGameStore.getState().setHoveredControlHint(null);
            }}
            onPointerDown={(e) => {
              if (useCameraLookStore.getState().isFreeLookMode) return;
              e.stopPropagation();
              coreRodDraggingRef.current = true;
              const s = useGameStore.getState();
              const activeKeys = Object.keys(s.channelHotspots).map(Number);
              const startY = e.nativeEvent.clientY;
              const startRod = s.controlRodLevel;
              let moved = false;
              let lastDetent = Math.round(startRod / 5);

              const handleMove = (ev: PointerEvent) => {
                const dy = startY - ev.clientY;
                if (Math.abs(dy) >= 5) {
                  moved = true;
                  const nextRod = THREE.MathUtils.clamp(
                    startRod + (dy / 90) * 100,
                    0,
                    100,
                  );
                  const curDetent = Math.round(nextRod / 5);
                  if (curDetent !== lastDetent) {
                    lastDetent = curDetent;
                    playDetentClick((Math.abs(curDetent) % 5) + 1);
                  }
                  useGameStore.getState().setControlRodLevel(nextRod);
                }
              };

              const handleUp = () => {
                coreRodDraggingRef.current = false;
                window.removeEventListener("pointermove", handleMove);
                window.removeEventListener("pointerup", handleUp);
                window.removeEventListener("pointercancel", handleUp);
                if (!moved && activeKeys.length > 0) {
                  playSwitchClank(true);
                  playDetentClick(3);
                  useGameStore.getState().selectChannelForRefuel(activeKeys[0]);
                }
              };

              window.addEventListener("pointermove", handleMove);
              window.addEventListener("pointerup", handleUp);
              window.addEventListener("pointercancel", handleUp);
            }}
          >
            {/* Heavy Recessed Octagonal Cast-Iron Reactor Pit Flange (dark gunmetal #222629) */}
            <mesh
              position={[0, 0, 0.002]}
              rotation={[Math.PI / 2, Math.PI / 8, 0]}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.195, 0.205, 0.03, 8]} />
              <meshStandardMaterial
                color="#222629"
                roughness={0.44}
                metalness={0.72}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.009}
                roughnessMap={ironTex.roughnessMap}
              />
            </mesh>
            {/* Heavy Raised Cast-Iron Inner Pit Rim Ring (#2b3036) */}
            <mesh
              position={[0, 0, 0.026]}
              rotation={[0, 0, Math.PI / 8]}
              raycast={NOOP_RAYCAST}
            >
              <torusGeometry args={[0.194, 0.011, 8, 8]} />
              <meshStandardMaterial
                color="#2b3036"
                metalness={0.76}
                roughness={0.38}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.007}
                roughnessMap={ironTex.roughnessMap}
              />
            </mesh>
            {/* Recessed Dark Graphite Core Pit Floor behind the 37 Caps */}
            <mesh
              position={[0, 0, 0.02]}
              rotation={[Math.PI / 2, Math.PI / 8, 0]}
            >
              <cylinderGeometry args={[0.188, 0.188, 0.004, 8]} />
              <meshStandardMaterial color="#0b0d0e" roughness={0.9} />
            </mesh>
            {/* Merged 8 Brushed-Steel Corner Clamps & 16 Perimeter Bolts around Octagonal Pit Flange */}
            <mesh geometry={RBMK_8_CLAMPS_GEO} raycast={NOOP_RAYCAST}>
              <meshStandardMaterial
                color="#8a929a"
                roughness={0.35}
                metalness={0.85}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
            <mesh geometry={RBMK_16_BOLTS_GEO} raycast={NOOP_RAYCAST}>
              <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.32} />
            </mesh>

            {/* 37 Enlarged Stainless-Steel Bio-Shield Caps with High-Contrast Bevel Rims & Bright Circular Lenses */}
            <group position={[0, 0, 0.027]}>
              <mesh geometry={RBMK_37_BASES_GEO} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial
                  color="#4a5258"
                  metalness={0.78}
                  roughness={0.38}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.005}
                />
              </mesh>
              <mesh geometry={RBMK_37_CAPS_GEO} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial
                  color="#8e989e"
                  metalness={0.86}
                  roughness={0.28}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.003}
                  roughnessMap={ironTex.roughnessMap}
                />
              </mesh>
              <mesh geometry={RBMK_37_COLLARS_GEO} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial color="#181c1e" metalness={0.75} roughness={0.45} />
              </mesh>
              <instancedMesh
                ref={rbmkPinShaftInstRef}
                args={[RBMK_PIN_SHAFT_GEO, undefined, 37]}
                raycast={NOOP_RAYCAST}
              >
                <meshStandardMaterial
                  color="#c8d0d6"
                  metalness={0.9}
                  roughness={0.22}
                />
              </instancedMesh>
              <instancedMesh
                ref={rbmkPinCapInstRef}
                args={[RBMK_PIN_CAP_GEO, undefined, 37]}
                raycast={NOOP_RAYCAST}
              >
                <meshStandardMaterial
                  color="#8a929a"
                  metalness={0.88}
                  roughness={0.26}
                />
              </instancedMesh>
              {RBMK_OCTAGON_TILES.map((tile, tIdx) => (
                <group
                  key={tile.code}
                  ref={(el) => {
                    channelTileRefs.current[tIdx] = el;
                  }}
                  position={[tile.x, tile.y, 0]}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    hoveredChannelRef.current = tIdx;
                    useGameStore
                      .getState()
                      .setHoveredControlHint(
                        `CH #${String(tIdx + 1).padStart(2, "0")} (${tile.code}) — [CLICK AMBER TILE]: TARGET SPENT ROD FOR REFUELING | [DRAG / SCROLL]: ADJUST RODS (±5%)`,
                      );
                  }}
                  onPointerOut={(e) => {
                    e.stopPropagation();
                    if (hoveredChannelRef.current === tIdx) {
                      hoveredChannelRef.current = null;
                    }
                    useGameStore.getState().setHoveredControlHint(null);
                  }}
                  onPointerDown={(e) => {
                    if (useCameraLookStore.getState().isFreeLookMode) return;
                    e.stopPropagation();
                    notifyPlayerControlInteraction("coreChannelTile", true);
                    const s = useGameStore.getState();
                    const startY = e.nativeEvent.clientY;
                    const startRod = s.controlRodLevel;
                    let moved = false;
                    let lastDetent = Math.round(startRod / 5);

                    const handleMove = (ev: PointerEvent) => {
                      const dy = startY - ev.clientY;
                      if (Math.abs(dy) >= 5) {
                        moved = true;
                        notifyPlayerControlInteraction("controlRodDrive", true);
                        const nextRod = THREE.MathUtils.clamp(
                          startRod + (dy / 90) * 100,
                          0,
                          100,
                        );
                        const curDetent = Math.round(nextRod / 5);
                        if (curDetent !== lastDetent) {
                          lastDetent = curDetent;
                          playDetentClick((Math.abs(curDetent) % 5) + 1);
                        }
                        useGameStore.getState().setControlRodLevel(nextRod);
                      }
                    };

                    const handleUp = () => {
                      notifyPlayerControlInteraction("coreChannelTile", false);
                      notifyPlayerControlInteraction("controlRodDrive", false);
                      window.removeEventListener("pointermove", handleMove);
                      window.removeEventListener("pointerup", handleUp);
                      window.removeEventListener("pointercancel", handleUp);
                      if (!moved) {
                        playSwitchClank(true);
                        playDetentClick((tIdx % 5) + 2);
                        useGameStore.getState().selectChannelForRefuel(tIdx);
                      }
                    };

                    window.addEventListener("pointermove", handleMove);
                    window.addEventListener("pointerup", handleUp);
                    window.addEventListener("pointercancel", handleUp);
                  }}
                >
                  {/* Non-overlapping per-tile hitbox (0.044 < 0.048 pitch -> crisp gap prevents neighbor misclicks) */}
                  <mesh position={[0, 0, 0.016]} geometry={RBMK_TILE_HITBOX_GEO}>
                    <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                  </mesh>
                  {/* Crisp High-Contrast Bevel Rim around Tile Cap */}
                  <mesh geometry={RBMK_TILE_RIM_GEO} raycast={NOOP_RAYCAST}>
                    <meshStandardMaterial
                      ref={(el) => {
                        channelRimMatRefs.current[tIdx] = el;
                      }}
                      color="#30393e"
                      metalness={0.55}
                      roughness={0.35}
                    />
                  </mesh>
                  {/* Enlarged Recessed Circular Glass Lens in Center */}
                  <mesh
                    position={[0, 0, 0.0115]}
                    rotation={[Math.PI / 2, 0, 0]}
                    geometry={RBMK_TILE_LENS_GEO}
                    raycast={NOOP_RAYCAST}
                  >
                    <meshStandardMaterial
                      ref={(el) => {
                        channelLensMatRefs.current[tIdx] = el;
                      }}
                      color="#1a5c38"
                      emissive="#28b862"
                      emissiveIntensity={0.42}
                      roughness={0.22}
                      metalness={0.2}
                    />
                  </mesh>
                </group>
              ))}
            </group>
          </group>
        </group>
      )}

      {/* ====================================================================
          LOWER INDUSTRIAL CONTROL DECK (Mounted Flush on Sloped Sage-Green Desk):
          - UNIT A-2 (`variant === "left-rear"`):
            1. Left Half (~50%): Enlarged CONTROL ROD DRIVE (0-100% Wheel + Rod % Digital Readout + 5-Seg Bar)
            2. Right Half (~50%): Enlarged ROD REFUELING (Longer-Throw Pull Lever + Wider 10-Seg Progress Bar + Bold Target Readout)
          - UNIT B (`variant === "rear"`):
            1. Left: Dual-Pipe Finned Copper Gas Manifold + Brass Regulator Wheel + 10-Segment Flow Bar
            2. Center: Square Bolted Containment Bulkhead Synoptic Panel (4 Jewel Lamps + Brass Pipe Strips + 3 Guarded Toggles + Red Mushroom Lock Button)
            3. Right: Toothed Cast-Iron Quadrant Pull-Lever + Illuminated Cylindrical Glass Water Sight-Tube (`BUBBLER DRAIN`)
         ==================================================================== */}
      {variant === "left-rear" ? (
        <group position={[0, 0.77, 0.28]} rotation={[-0.406, 0, 0]}>
          {/* 1. LEFT HALF (~50%): Enlarged CONTROL ROD DRIVE (Wheel + Digital Rod % Readout + 5-Seg Bar) */}
          <group position={[-0.39, 0.02, 0.02]} scale={[1.52, 1.5, 1.35]}>
            <mesh position={[0, 0.232, 0.012]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.42, 0.106, 0.012]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.232, 0.02]} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.404, 0.094]} />
              <meshStandardMaterial
                map={leftPlateTex}
                emissive="#ffffff"
                emissiveMap={leftPlateTex}
                emissiveIntensity={0.35}
                roughness={0.65}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>

            {/* Brushed-Brass Framed Cast-Iron Valve Manifold Backplate */}
            <mesh position={[0, -0.032, 0.005]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.404, 0.394, 0.018]} />
              <meshStandardMaterial color="#8a929a" metalness={0.82} roughness={0.36} />
            </mesh>
            <mesh position={[0, -0.032, 0.009]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.39, 0.38, 0.022]} />
              <meshStandardMaterial
                color="#1c2220"
                roughness={0.44}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
                roughnessMap={ironTex.roughnessMap}
              />
            </mesh>
            <CagedSovietJewelLamp3D
              position={[-0.152, 0.125, 0.026]}
              lampMatRef={oilLampMatRef}
              scale={0.82}
            />
            <SovietBacklitIndicatorBlock3D
              position={[-0.068, 0.125, 0.036]}
              scale={0.88}
              label="ROD DRIVE"
              getAlertState={(s) => ({
                level: s.az5Active
                  ? "critical"
                  : s.tutorialPhase === "STEP_2_PULL_RODS" && s.controlRods < 0.5
                    ? "warn"
                    : s.controlRods >= 0.1
                      ? "active"
                      : "normal",
                acknowledged: oilWheelDraggingRef.current,
              })}
            />
            {/* Larger Digital Rod-Percentage Readout ("RODS: XX%") */}
            <group position={[0.082, 0.125, 0.026]}>
              <mesh raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.175, 0.056, 0.014]} />
                <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
              </mesh>
              <mesh position={[0, 0, 0.0095]} raycast={NOOP_RAYCAST}>
                <planeGeometry args={[0.162, 0.046]} />
                <meshStandardMaterial
                  ref={rodPctMatRef}
                  map={rodPctTex}
                  emissive="#ffffff"
                  emissiveMap={rodPctTex}
                  emissiveIntensity={0.72}
                  roughness={0.35}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  polygonOffsetUnits={-2}
                />
              </mesh>
            </group>

            {/* Semicircular Brushed-Brass 0-100% Scale Arc */}
            <mesh position={[-0.045, -0.048, 0.022]} raycast={NOOP_RAYCAST}>
              <torusGeometry args={[0.1, 0.0065, 8, 22, Math.PI]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.85}
                roughness={0.28}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>

            {/* Stepped Cast-Iron Valve Body & Enlarged 6-Spoke Handwheel */}
            <group
              position={[-0.045, -0.048, 0.022]}
              onWheel={(e: ThreeEvent<WheelEvent>) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                e.nativeEvent?.stopImmediatePropagation?.();
                const isShift = Boolean(e.shiftKey || e.nativeEvent?.shiftKey);
                const stepPct = isShift ? 1 : 5;
                const deltaPct = e.deltaY < 0 ? stepPct : -stepPct;
                playDetentClick(2);
                useGameStore.getState().adjustControlRodLevel(deltaPct);
              }}
              onPointerOver={() => {
                useGameStore
                  .getState()
                  .setHoveredControlHint(
                    "[SCROLL WHEEL]: ADJUST RODS (±5%) | [SHIFT+SCROLL]: FINE (±1%) | [DRAG]: ROTATE WHEEL",
                  );
              }}
              onPointerOut={() => {
                useGameStore.getState().setHoveredControlHint(null);
              }}
              onPointerDown={(e) =>
                startSmoothWheelSwivelDrag(
                  e,
                  oilWheelRef.current,
                  useGameStore.getState().controlRods * 100,
                  0,
                  100,
                  (v) => useGameStore.getState().setControlRodLevel(v),
                  (act) => {
                    oilWheelDraggingRef.current = act;
                    notifyPlayerControlInteraction("controlRodDrive", act);
                  },
                )
              }
            >
              {/* Wide Scroll/Drag Hit Collider matching enlarged handwheel */}
              <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.115, 0.115, 0.098, 14]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.074, 0.084, 0.034, 14]} />
                <meshStandardMaterial
                  color="#2b3036"
                  roughness={0.42}
                  metalness={0.72}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.008}
                  roughnessMap={ironTex.roughnessMap}
                />
              </mesh>
              <mesh position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.058, 0.06, 0.008, 16]} />
                <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
              </mesh>
              <mesh position={[0, 0, 0.038]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.024, 0.03, 0.065, 10]} />
                <meshStandardMaterial color="#8a929a" roughness={0.35} metalness={0.85} />
              </mesh>

              {/* Chipped Dark Olive-Drab Cast-Iron 6-Spoke Handwheel */}
              <group ref={oilWheelRef} position={[0, 0, 0.07]}>
                <mesh raycast={NOOP_RAYCAST}>
                  <torusGeometry args={[0.082, 0.014, 10, 22]} />
                  <meshStandardMaterial
                    color="#2f3a2e"
                    roughness={0.42}
                    metalness={0.55}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.008}
                    roughnessMap={ironTex.roughnessMap}
                  />
                </mesh>
                {[0, Math.PI / 3, (2 * Math.PI) / 3].map((ang, sIdx) => (
                  <mesh key={sIdx} rotation={[0, 0, ang]} raycast={NOOP_RAYCAST}>
                    <cylinderGeometry args={[0.0075, 0.0095, 0.158, 8]} />
                    <meshStandardMaterial
                      color="#2b3036"
                      roughness={0.4}
                      metalness={0.75}
                      bumpMap={ironTex.bumpMap}
                      bumpScale={0.006}
                    />
                  </mesh>
                ))}
                <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.022, 0.025, 0.026, 10]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
                </mesh>
                {/* Lathe-turned Dark Phenolic Bakelite Crank Peg */}
                <mesh position={[0.068, 0.02, 0.022]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.01, 0.012, 0.04, 8]} />
                  <meshStandardMaterial
                    color="#1c1817"
                    roughness={0.32}
                    metalness={0.15}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.004}
                  />
                </mesh>
              </group>
            </group>

            {/* 5-Segment Recessed Soviet Glass Cell Rod-Drive Bar in Cast-Iron Bezel Housing */}
            <group position={[0.125, -0.048, 0.022]}>
              <mesh raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.062, 0.252, 0.025]} />
                <meshStandardMaterial
                  color="#1c2220"
                  roughness={0.44}
                  metalness={0.68}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.007}
                  roughnessMap={ironTex.roughnessMap}
                />
              </mesh>
              {(
                [
                  [-0.023, 0.114],
                  [0.023, 0.114],
                  [-0.023, -0.114],
                  [0.023, -0.114],
                ] as const
              ).map(([bx, by], bIdx) => (
                <mesh
                  key={bIdx}
                  position={[bx, by, 0.014]}
                  rotation={[Math.PI / 2, 0, 0]}
                  raycast={NOOP_RAYCAST}
                >
                  <cylinderGeometry args={[0.0045, 0.0045, 0.005, 6]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
                </mesh>
              ))}
              <mesh position={[0, 0, 0.007]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.044, 0.218, 0.014]} />
                <meshStandardMaterial color="#070a09" roughness={0.88} />
              </mesh>
              <mesh geometry={A2_OIL_5_LOUVERS_GEO} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial color="#181d1f" metalness={0.78} roughness={0.42} />
              </mesh>
              {Array.from({ length: 5 }).map((_, idx) => (
                <mesh
                  key={idx}
                  position={[0, -0.084 + idx * 0.042, 0.01]}
                  raycast={NOOP_RAYCAST}
                >
                  <boxGeometry args={[0.038, 0.028, 0.01]} />
                  <meshStandardMaterial
                    ref={(el) => {
                      oilBarMatRefs.current[idx] = el;
                    }}
                    map={ribbedGlassTex}
                    emissiveMap={ribbedGlassTex}
                    color="#28b862"
                    emissive="#28b862"
                    emissiveIntensity={1.1}
                    roughness={0.28}
                    metalness={0.22}
                  />
                </mesh>
              ))}
            </group>
          </group>

          {/* 2. RIGHT HALF (~50%): Enlarged ROD REFUELING (Longer-Throw Pull Lever + Wider 10-Seg Progress Bar + Bold Target Readout) */}
          <group position={[0.39, 0.02, 0.02]} scale={[1.52, 1.5, 1.35]}>
            <mesh position={[0, 0.232, 0.012]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.42, 0.106, 0.012]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.232, 0.02]} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.404, 0.094]} />
              <meshStandardMaterial
                map={rightPlateTex}
                emissive="#ffffff"
                emissiveMap={rightPlateTex}
                emissiveIntensity={0.35}
                roughness={0.65}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>

            {/* Weathered Steel-Framed Cast-Iron Refueling Backplate */}
            <mesh position={[0, -0.034, 0.005]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.404, 0.398, 0.018]} />
              <meshStandardMaterial color="#8a929a" metalness={0.82} roughness={0.36} />
            </mesh>
            <mesh position={[0, -0.034, 0.009]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.39, 0.384, 0.022]} />
              <meshStandardMaterial
                color="#1c2220"
                roughness={0.44}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
                roughnessMap={ironTex.roughnessMap}
              />
            </mesh>

            <SovietBacklitIndicatorBlock3D
              position={[-0.115, 0.13, 0.028]}
              scale={0.84}
              label="REFUEL"
              getAlertState={(s) => {
                const hc = Object.keys(s.channelHotspots).length;
                return {
                  level:
                    hc >= 4
                      ? "critical"
                      : hc >= 1
                        ? "warn"
                        : s.selectedRefuelChannel !== null
                          ? "active"
                          : "normal",
                  acknowledged: pistonDragRef.current.active,
                };
              }}
            />

            {/* Bold Enlarged Target-Channel Readout (`37/37 FUEL OK` / `LOCKED: CH #XX`) */}
            <group position={[0.065, 0.13, 0.026]}>
              <mesh raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.21, 0.054, 0.012]} />
                <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
              </mesh>
              <mesh position={[0, 0, 0.0085]} raycast={NOOP_RAYCAST}>
                <planeGeometry args={[0.196, 0.044]} />
                <meshStandardMaterial
                  ref={refuelTargetMatRef}
                  map={refuelTargetTex}
                  emissive="#ffffff"
                  emissiveMap={refuelTargetTex}
                  emissiveIntensity={0.72}
                  roughness={0.35}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  polygonOffsetUnits={-2}
                />
              </mesh>
            </group>

            {/* Enlarged Bolted Cast-Iron Quadrant Box with Longer-Throw Industrial Pull Lever */}
            <group
              position={[-0.055, -0.064, 0.032]}
              onPointerOver={(e) => {
                e.stopPropagation();
                useGameStore
                  .getState()
                  .setHoveredControlHint(
                    "ROD REFUELING LEVER: Click AMBER core tile first, then DRAG handle ALL THE WAY DOWN to reload!",
                  );
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                useGameStore.getState().setHoveredControlHint(null);
              }}
              onPointerDown={(e) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                notifyPlayerControlInteraction("rodRefuelLever", true);
                refuelStrokeFiredRef.current = false;
                pistonDragRef.current = {
                  active: true,
                  startY: e.nativeEvent.clientY,
                  startPos: 0,
                  currentPos: 0,
                  lastHalfStroke: 0,
                };
                const handleMove = (ev: PointerEvent) => {
                  if (!pistonDragRef.current.active) return;
                  const dy = ev.clientY - pistonDragRef.current.startY;
                  const nextPos = THREE.MathUtils.clamp(dy / 115, 0, 1);
                  pistonDragRef.current.currentPos = nextPos;

                  const stepIdx = Math.round(nextPos * 10);
                  if (stepIdx !== pistonDragRef.current.lastHalfStroke) {
                    pistonDragRef.current.lastHalfStroke = stepIdx;
                    playDetentClick((Math.abs(stepIdx) % 5) + 1);
                  }
                  if (nextPos >= 0.82 && !refuelStrokeFiredRef.current) {
                    refuelStrokeFiredRef.current = true;
                    playSwitchClank(true);
                    playBoronHydraulicPumpStroke();
                    useGameStore.getState().executeRefuelLeverStroke();
                  }
                };
                const handleUp = () => {
                  pistonDragRef.current.active = false;
                  pistonDragRef.current.currentPos = 0;
                  notifyPlayerControlInteraction("rodRefuelLever", false);
                  if (!refuelStrokeFiredRef.current) {
                    playSwitchClank(false);
                    const s = useGameStore.getState();
                    if (Object.keys(s.channelHotspots).length > 0) {
                      useGameStore.setState({
                        lastDecisionFeedback:
                          s.selectedRefuelChannel !== null
                            ? "DRAG [ROD REFUELING LEVER] ALL THE WAY DOWN TO RELOAD LOCKED CHANNEL!"
                            : "CLICK A PULSING AMBER CORE TILE FIRST, THEN DRAG [ROD REFUELING LEVER] DOWN!",
                      });
                    }
                  }
                  refuelStrokeFiredRef.current = false;
                  window.removeEventListener("pointermove", handleMove);
                  window.removeEventListener("pointerup", handleUp);
                  window.removeEventListener("pointercancel", handleUp);
                };
                window.addEventListener("pointermove", handleMove);
                window.addEventListener("pointerup", handleUp);
                window.addEventListener("pointercancel", handleUp);
              }}
            >
              {/* Wide Non-Overlapping Invisible Hitbox for Rod Refueling Quadrant & Lever */}
              <mesh position={[0, 0, 0.058]}>
                <boxGeometry args={[0.2, 0.34, 0.16]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
              {/* Raised 0.034m Deep Cast-Iron Quadrant Box */}
              <mesh raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.14, 0.312, 0.034]} />
                <meshStandardMaterial
                  color="#1c2220"
                  roughness={0.42}
                  metalness={0.72}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.008}
                  roughnessMap={ironTex.roughnessMap}
                />
              </mesh>
              {/* Beveled Steel Side Rails */}
              {[-0.05, 0.05].map((rx, rIdx) => (
                <mesh key={rIdx} position={[rx, 0, 0.014]} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.022, 0.3, 0.01]} />
                  <meshStandardMaterial
                    color="#2b3036"
                    metalness={0.78}
                    roughness={0.36}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.005}
                  />
                </mesh>
              ))}
              {/* Engraved Brass 0-100% Scale Plate alongside Slot */}
              <mesh position={[-0.05, 0, 0.0215]} raycast={NOOP_RAYCAST}>
                <planeGeometry args={[0.022, 0.268]} />
                <meshStandardMaterial
                  map={leverScalePlateTex}
                  metalness={0.75}
                  roughness={0.35}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  polygonOffsetUnits={-2}
                />
              </mesh>
              {/* Merged 6 Perimeter Steel Hex Bolts, Dark Channel, 14 Dust-Bellows Pleats & 18 Ratchet Teeth */}
              <mesh geometry={A2_BORON_6_BOLTS_GEO} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
              </mesh>
              <mesh position={[0, 0, 0.01]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.04, 0.272, 0.01]} />
                <meshStandardMaterial color="#090b0a" roughness={0.92} />
              </mesh>
              <mesh geometry={A2_BORON_12_PLEATS_GEO} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial color="#141716" roughness={0.88} />
              </mesh>
              <mesh geometry={A2_BORON_16_TEETH_GEO} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.32} />
              </mesh>

              {/* Heavy Bolted Pivot Knuckle, Thick Chrome Arms & Oxblood Bakelite T-Handle */}
              <group ref={boronPistonGroupRef} position={[0, 0.086, 0.019]}>
                <mesh rotation={[0, 0, Math.PI / 2]} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.02, 0.02, 0.054, 12]} />
                  <meshStandardMaterial color="#2b3036" metalness={0.82} roughness={0.32} />
                </mesh>
                <mesh rotation={[0, 0, Math.PI / 2]} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.01, 0.01, 0.062, 6]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.28} />
                </mesh>
                {[-0.022, 0.022].map((cx, cIdx) => (
                  <mesh
                    key={cIdx}
                    position={[cx, 0, 0.047]}
                    rotation={[Math.PI / 2, 0, 0]}
                    raycast={NOOP_RAYCAST}
                  >
                    <cylinderGeometry args={[0.0095, 0.0105, 0.094, 10]} />
                    <meshStandardMaterial
                      color="#d8dfe6"
                      metalness={0.9}
                      roughness={0.2}
                    />
                  </mesh>
                ))}
                {/* Lathe-Turned Dark Oxblood Phenolic Bakelite T-Handle (#4a1210) */}
                <mesh
                  position={[0, 0, 0.094]}
                  rotation={[0, 0, Math.PI / 2]}
                  raycast={NOOP_RAYCAST}
                >
                  <cylinderGeometry args={[0.024, 0.024, 0.18, 14]} />
                  <meshStandardMaterial
                    color="#4a1210"
                    roughness={0.32}
                    metalness={0.15}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.004}
                  />
                </mesh>
                {[-0.082, 0.082].map((bx, bIdx) => (
                  <mesh
                    key={bIdx}
                    position={[bx, 0, 0.094]}
                    rotation={[0, 0, Math.PI / 2]}
                    raycast={NOOP_RAYCAST}
                  >
                    <cylinderGeometry args={[0.0255, 0.0255, 0.02, 14]} />
                    <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
                  </mesh>
                ))}
                <mesh
                  position={[0, 0, 0.094]}
                  rotation={[0, 0, Math.PI / 2]}
                  raycast={NOOP_RAYCAST}
                >
                  <cylinderGeometry args={[0.0248, 0.0248, 0.01, 14]} />
                  <meshStandardMaterial
                    color="#c92a1d"
                    roughness={0.36}
                    metalness={0.2}
                  />
                </mesh>
              </group>
            </group>

            {/* Wider 10-Segment Segmented Amber Reload Progress & Core Fuel Health Bar */}
            <group position={[0.11, -0.064, 0.022]}>
              <mesh raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.09, 0.312, 0.026]} />
                <meshStandardMaterial
                  color="#1c2220"
                  roughness={0.44}
                  metalness={0.68}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.007}
                  roughnessMap={ironTex.roughnessMap}
                />
              </mesh>
              {(
                [
                  [-0.036, 0.144],
                  [0.036, 0.144],
                  [-0.036, -0.144],
                  [0.036, -0.144],
                ] as const
              ).map(([bx, by], bIdx) => (
                <mesh
                  key={bIdx}
                  position={[bx, by, 0.015]}
                  rotation={[Math.PI / 2, 0, 0]}
                  raycast={NOOP_RAYCAST}
                >
                  <cylinderGeometry args={[0.0045, 0.0045, 0.005, 6]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
                </mesh>
              ))}
              <mesh position={[0, 0, 0.007]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.068, 0.284, 0.014]} />
                <meshStandardMaterial color="#070a09" roughness={0.88} />
              </mesh>
              <mesh geometry={A2_BORON_10_LOUVERS_GEO} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial color="#181d1f" metalness={0.78} roughness={0.42} />
              </mesh>
              {Array.from({ length: 10 }).map((_, idx) => (
                <mesh
                  key={idx}
                  position={[0, -0.122 + idx * 0.0272, 0.011]}
                  raycast={NOOP_RAYCAST}
                >
                  <boxGeometry args={[0.062, 0.02, 0.011]} />
                  <meshStandardMaterial
                    ref={(el) => {
                      boronBarMatRefs.current[idx] = el;
                    }}
                    map={ribbedGlassTex}
                    emissiveMap={ribbedGlassTex}
                    color="#28b862"
                    emissive="#28b862"
                    emissiveIntensity={1.15}
                    roughness={0.28}
                    metalness={0.22}
                  />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      ) : (
        <group position={[0, 0.77, 0.28]} rotation={[-0.406, 0, 0]}>
          {/* ================================================================
              UNIT B (`variant === "rear"`) — GRITTY SOVIET INDUSTRIAL REALISM
              1. Left: Dual-Pipe Finned Copper Gas Manifold & Oxidized Crimson Cast-Iron Wheel + Recessed Glass Cell Bar
              2. Center: Bolted Containment Bulkhead Synoptic Panel (4 Caged Jewel Lamps + 3 Chunky Guarded Toggles + Crimson Bakelite Mushroom Button)
              3. Right: Bolted Quadrant Pull-Lever + Armored Sight-Glass with Brass Manifolds & Tick-Mark Graduation Rings
             ================================================================ */}

          {/* 1. LEFT: Dual-Pipe Finned Copper Gas Manifold & Oxidized Crimson Handwheel (`HELIUM-N2 LOOP`) */}
          <group position={[-0.555, 0.02, 0.02]} scale={[1.18, 1.42, 1.25]}>
            <mesh position={[0, 0.272, 0.012]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.398, 0.128, 0.01]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.272, 0.02]} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.382, 0.114]} />
              <meshStandardMaterial
                map={leftPlateTex}
                emissive="#ffffff"
                emissiveMap={leftPlateTex}
                emissiveIntensity={0.35}
                roughness={0.65}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>

            {/* Weathered Steel-Framed Manifold Baseplate */}
            <mesh position={[0, -0.02, 0.005]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.322, 0.372, 0.018]} />
              <meshStandardMaterial color="#8a929a" metalness={0.82} roughness={0.36} />
            </mesh>
            <mesh position={[0, -0.02, 0.009]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.306, 0.356, 0.022]} />
              <meshStandardMaterial
                color="#1c2220"
                roughness={0.44}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
                roughnessMap={ironTex.roughnessMap}
              />
            </mesh>

            {/* Two Weathered Finned Copper/Brass Gas Pipes */}
            <mesh geometry={B_GAS_8_FINS_GEO} raycast={NOOP_RAYCAST}>
              <meshStandardMaterial
                color="#9c884e"
                metalness={0.85}
                roughness={0.3}
              />
            </mesh>
            {[-0.088, 0.018].map((px, pIdx) => (
              <mesh
                key={pIdx}
                position={[px, -0.02, 0.026]}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.016, 0.016, 0.32, 12]} />
                <meshStandardMaterial
                  color={pIdx === 0 ? "#b86b3a" : "#a89254"}
                  metalness={0.86}
                  roughness={0.3}
                  bumpMap={brassTex.bumpMap}
                  bumpScale={0.005}
                />
              </mesh>
            ))}

            <CagedSovietJewelLamp3D
              position={[-0.118, 0.115, 0.026]}
              lampMatRef={gasLampMatRef}
              scale={0.8}
            />
            <SovietBacklitIndicatorBlock3D
              position={[0.04, 0.115, 0.026]}
              scale={0.88}
              label="GAS / FW"
              getAlertState={(s) => {
                const isOp =
                  s.thermalPower > 180 || s.tutorialPhase === "COMPLETED";
                return {
                  level:
                    s.graphiteTemp > 620 ||
                    (isOp && s.pressureBar < 28) ||
                    Math.abs(s.drumWaterLevel) > 250
                      ? "critical"
                      : s.graphiteTemp > 560 ||
                          (isOp && s.pressureBar < 36) ||
                          Math.abs(s.drumWaterLevel) > 150
                        ? "warn"
                        : "normal",
                  acknowledged: gasWheelDraggingRef.current,
                };
              }}
            />

            {/* Central Cast-Iron Regulator Body & Semicircular Brass BAR Scale */}
            <group
              position={[-0.035, -0.02, 0.032]}
              onPointerOver={(e) => {
                e.stopPropagation();
                useGameStore
                  .getState()
                  .setHoveredControlHint(
                    "FEEDWATER VALVE (FW PUMP): Scroll (±5% | Shift ±1%) or Drag Up/Right (+) / Down/Left (-) (0–100%)",
                  );
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                useGameStore.getState().setHoveredControlHint(null);
              }}
              onWheel={(e) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                e.nativeEvent?.stopImmediatePropagation?.();
                const fine = Boolean(e.shiftKey || e.nativeEvent?.shiftKey);
                const step = (e.deltaY < 0 ? 1 : -1) * (fine ? 1 : 5);
                const s = useGameStore.getState();
                const curPct = Math.round(s.feedwaterValve * 100);
                const nextPct = THREE.MathUtils.clamp(curPct + step, 0, 100);
                if (nextPct !== curPct) {
                  playDetentClick((Math.abs(nextPct) % 5) + 1);
                  s.setNitrogenLoopValve(nextPct);
                }
              }}
              onPointerDown={(e) =>
                startSmoothWheelSwivelDrag(
                  e,
                  gasWheelRef.current,
                  useGameStore.getState().feedwaterValve * 100,
                  0,
                  100,
                  (v) => useGameStore.getState().setNitrogenLoopValve(v),
                  (act) => {
                    gasWheelDraggingRef.current = act;
                    notifyPlayerControlInteraction("feedwaterValve", act);
                  },
                )
              }
            >
              {/* Stationary Tight Hit Collider matching physical handwheel without occluding indicator above */}
              <mesh position={[0, 0, 0.048]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.105, 0.105, 0.095, 12]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
              <mesh position={[0, 0, 0.008]} raycast={NOOP_RAYCAST}>
                <torusGeometry args={[0.088, 0.0065, 8, 22, Math.PI]} />
                <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.064, 0.072, 0.042, 14]} />
                <meshStandardMaterial
                  color="#2b3036"
                  roughness={0.42}
                  metalness={0.72}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.008}
                  roughnessMap={ironTex.roughnessMap}
                />
              </mesh>
              <group ref={gasWheelRef} position={[0, 0, 0.058]}>
                {/* Chipped Deep Oxidized Crimson Enamel Cast-Iron Handwheel (#6e1a14) */}
                <mesh raycast={NOOP_RAYCAST}>
                  <torusGeometry args={[0.072, 0.014, 10, 22]} />
                  <meshStandardMaterial
                    color="#6e1a14"
                    metalness={0.52}
                    roughness={0.42}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.008}
                    roughnessMap={ironTex.roughnessMap}
                  />
                </mesh>
                {[0, Math.PI / 3, (2 * Math.PI) / 3].map((ang, sIdx) => (
                  <mesh key={sIdx} rotation={[0, 0, ang]} raycast={NOOP_RAYCAST}>
                    <cylinderGeometry args={[0.0075, 0.0095, 0.138, 8]} />
                    <meshStandardMaterial
                      color="#2b3036"
                      roughness={0.4}
                      metalness={0.75}
                      bumpMap={ironTex.bumpMap}
                      bumpScale={0.006}
                    />
                  </mesh>
                ))}
                <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.02, 0.022, 0.026, 10]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
                </mesh>
                {/* Dark Phenolic Bakelite Crank Peg (#1c1817) */}
                <mesh position={[0.06, 0.018, 0.02]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.009, 0.011, 0.038, 8]} />
                  <meshStandardMaterial
                    color="#1c1817"
                    roughness={0.32}
                    metalness={0.15}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.004}
                  />
                </mesh>
              </group>
            </group>

            {/* 10-Segment Recessed Soviet Glass Cell Gas Flow Bar in Cast-Iron Bezel Housing */}
            <group position={[0.102, -0.02, 0.022]}>
              {/* Projected Cast-Iron Bezel Housing (depth: 0.025m) */}
              <mesh raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.062, 0.288, 0.025]} />
                <meshStandardMaterial
                  color="#1c2220"
                  roughness={0.44}
                  metalness={0.68}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.007}
                  roughnessMap={ironTex.roughnessMap}
                />
              </mesh>
              {/* 4 Corner Steel Hex Bolts */}
              {(
                [
                  [-0.023, 0.132],
                  [0.023, 0.132],
                  [-0.023, -0.132],
                  [0.023, -0.132],
                ] as const
              ).map(([bx, by], bIdx) => (
                <mesh
                  key={bIdx}
                  position={[bx, by, 0.014]}
                  rotation={[Math.PI / 2, 0, 0]}
                  raycast={NOOP_RAYCAST}
                >
                  <cylinderGeometry args={[0.0045, 0.0045, 0.005, 6]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
                </mesh>
              ))}
              {/* Recessed Dark Interior Cavity */}
              <mesh position={[0, 0, 0.007]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.044, 0.256, 0.014]} />
                <meshStandardMaterial color="#070a09" roughness={0.88} />
              </mesh>
              <mesh geometry={B_GAS_10_LOUVERS_GEO} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial color="#181d1f" metalness={0.78} roughness={0.42} />
              </mesh>
              {Array.from({ length: 10 }).map((_, idx) => (
                <mesh
                  key={idx}
                  position={[0, -0.112 + idx * 0.025, 0.01]}
                  raycast={NOOP_RAYCAST}
                >
                  <boxGeometry args={[0.038, 0.018, 0.01]} />
                  <meshStandardMaterial
                    ref={(el) => {
                      gasBarMatRefs.current[idx] = el;
                    }}
                    map={ribbedGlassTex}
                    emissiveMap={ribbedGlassTex}
                    color="#28b862"
                    emissive="#28b862"
                    emissiveIntensity={1.15}
                    roughness={0.28}
                    metalness={0.22}
                  />
                </mesh>
              ))}
            </group>
          </group>

          {/* 2. CENTER: Square Bolted Containment Bulkhead Synoptic Panel (4 Caged Jewel Lamps + 3 Chunky Guarded Toggles + Oxidized Crimson Mushroom Button) */}
          <group position={[0, 0.0, 0.02]} scale={[1.18, 1.42, 1.25]}>
            <mesh position={[0, 0.286, 0.012]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.535, 0.126, 0.01]} />
              <meshStandardMaterial color="#8c7a4b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.286, 0.02]} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.518, 0.112]} />
              <meshStandardMaterial
                map={centerPlateTex}
                emissive="#ffffff"
                emissiveMap={centerPlateTex}
                emissiveIntensity={0.35}
                roughness={0.55}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
            <SovietBacklitIndicatorBlock3D
              position={[0, 0.185, 0.026]}
              scale={0.88}
              label="SEAL LOCK"
              getAlertState={(s) => {
                const isOp =
                  s.thermalPower > 180 || s.tutorialPhase === "COMPLETED";
                const offCount = isOp
                  ? s.sealToggles.filter((on) => !on).length
                  : 0;
                return {
                  level:
                    offCount >= 2
                      ? "critical"
                      : offCount > 0 || (isOp && s.mcpActive.some((on) => !on))
                        ? "warn"
                        : "normal",
                  acknowledged: emergSealDepressRef.current > 0.1,
                };
              }}
            />

            {/* Square Bolted Steel Containment Housing */}
            <mesh position={[0, -0.02, 0.005]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.46, 0.38, 0.018]} />
              <meshStandardMaterial
                color="#1c2220"
                roughness={0.44}
                metalness={0.72}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
                roughnessMap={ironTex.roughnessMap}
              />
            </mesh>
            <mesh position={[0, -0.02, 0.022]} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.43, 0.34]} />
              <meshStandardMaterial
                map={containmentSynopticTex}
                emissive="#ffffff"
                emissiveMap={containmentSynopticTex}
                emissiveIntensity={0.42}
                roughness={0.65}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>

            {/* Physical 3D Brushed-Steel Pipe-Routing Bus Strips connecting the 4 Containment Jewel Lamps */}
            <mesh position={[0, 0.055, 0.028]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.34, 0.01, 0.008]} />
              <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.32} />
            </mesh>

            {/* Upper Bank: 4 Raised Cast-Iron Bulkhead Bosses + Heavy Caged Soviet Jewel Lamps (`AIRLOCK A`, `AIRLOCK B`, `GRAPHITE N2`, `BUBBLER SEAL`) */}
            <mesh geometry={B_SEALS_4_BOSSES_GEO} raycast={NOOP_RAYCAST}>
              <meshStandardMaterial
                color="#2b3036"
                metalness={0.78}
                roughness={0.38}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
            {[-0.16, -0.053, 0.053, 0.16].map((lx, lIdx) => (
              <CagedSovietJewelLamp3D
                key={lIdx}
                position={[lx, 0.055, 0.033]}
                lampMatRef={(el) => {
                  sealJewelMatRefs.current[lIdx] = el;
                }}
                scale={1.02}
              />
            ))}

            {/* Lower Bank Left: 3 Heavy 2.5x Chunkier Guarded Metal Toggle Switches (`N2 PURGE`, `RAD FILTER`, `SEAL LOCK`) */}
            {[-0.16, -0.053, 0.053].map((tx, tIdx) => (
              <group
                key={tIdx}
                position={[tx, -0.095, 0.028]}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  useGameStore
                    .getState()
                    .setHoveredControlHint(
                      `MAIN CIRC. PUMP MCP-${tIdx + 1}: Scroll Up = ON | Scroll Down = OFF | Click Toggle`,
                    );
                }}
                onPointerOut={(e) => {
                  e.stopPropagation();
                  useGameStore.getState().setHoveredControlHint(null);
                }}
                onWheel={(e) => {
                  if (useCameraLookStore.getState().isFreeLookMode) return;
                  e.stopPropagation();
                  e.nativeEvent?.stopImmediatePropagation?.();
                  const wantOn = e.deltaY < 0;
                  const s = useGameStore.getState();
                  if (s.sealToggles[tIdx] !== wantOn) {
                    playSwitchClank(true);
                    s.toggleSealSwitch(tIdx as 0 | 1 | 2);
                  }
                }}
                onClick={(e) => {
                  if (useCameraLookStore.getState().isFreeLookMode) return;
                  e.stopPropagation();
                  notifyPlayerControlInteraction(`mcpSealToggle${tIdx}`, true);
                  notifyPlayerControlInteraction(`mcpSealToggle${tIdx}`, false);
                  playSwitchClank(true);
                  useGameStore.getState().toggleSealSwitch(tIdx as 0 | 1 | 2);
                }}
              >
                {/* Single Toggle Hitbox */}
                <mesh position={[0, 0, 0.04]}>
                  <boxGeometry args={[0.082, 0.1, 0.09]} />
                  <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </mesh>
                {/* Raised Steel Switch Mounting Base Plate */}
                <mesh position={[0, 0, 0.004]} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.072, 0.092, 0.008]} />
                  <meshStandardMaterial
                    color="#2b3036"
                    metalness={0.78}
                    roughness={0.38}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.005}
                  />
                </mesh>
                {/* Prominent U-Shaped Brushed-Steel Side Guards */}
                {[-0.03, 0.03].map((gx, gIdx) => (
                  <group key={gIdx} position={[gx, 0, 0.026]}>
                    <mesh raycast={NOOP_RAYCAST}>
                      <boxGeometry args={[0.008, 0.082, 0.046]} />
                      <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.32} />
                    </mesh>
                    {/* Top & Bottom U-Loop Guard Bridge Bars */}
                    {[-0.036, 0.036].map((gy, bIdx) => (
                      <mesh key={bIdx} position={[0, gy, 0.02]} raycast={NOOP_RAYCAST}>
                        <boxGeometry args={[0.01, 0.01, 0.014]} />
                        <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.28} />
                      </mesh>
                    ))}
                  </group>
                ))}
                {/* Heavy Hex Mounting Bushing & Lock Washer */}
                <mesh position={[0, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.026, 0.028, 0.012, 12]} />
                  <meshStandardMaterial color="#2b3036" metalness={0.82} roughness={0.35} />
                </mesh>
                <mesh position={[0, 0, 0.018]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.022, 0.024, 0.018, 6]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.28} />
                </mesh>
                {/* Animated Heavy Chrome Toggle Bat (2.5x chunkier with spherical ball tip) */}
                <group
                  ref={(el) => {
                    sealToggleBatRefs.current[tIdx] = el;
                  }}
                  position={[0, 0, 0.022]}
                >
                  <mesh position={[0, 0, 0.034]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                    <cylinderGeometry args={[0.011, 0.0065, 0.072, 12]} />
                    <meshStandardMaterial color="#d8e2dc" metalness={0.92} roughness={0.18} />
                  </mesh>
                  <mesh position={[0, 0, 0.07]} raycast={NOOP_RAYCAST}>
                    <sphereGeometry args={[0.0125, 12, 12]} />
                    <meshStandardMaterial color="#e4ece8" metalness={0.94} roughness={0.15} />
                  </mesh>
                </group>
              </group>
            ))}

            {/* Lower Bank Right: Deep Oxidized Crimson Bakelite Mushroom `EMERGENCY SEAL` Lock Button */}
            <group
              position={[0.16, -0.095, 0.028]}
              onPointerOver={(e) => {
                e.stopPropagation();
                useGameStore
                  .getState()
                  .setHoveredControlHint(
                    "MAIN CIRC. PUMP MCP-4 (ALL PUMPS ON): Scroll Up = Start All 4 Pumps | Click Button",
                  );
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                useGameStore.getState().setHoveredControlHint(null);
              }}
              onWheel={(e) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                e.nativeEvent?.stopImmediatePropagation?.();
                const wantOn = e.deltaY < 0;
                const s = useGameStore.getState();
                if (wantOn) {
                  emergSealDepressRef.current = 1.0;
                  playSwitchClank(true);
                  playPneumaticWhoosh();
                  s.lockAllContainmentSeals();
                } else if (s.mcpActive[3]) {
                  playSwitchClank(false);
                  s.toggleMcpPump(3);
                }
              }}
              onPointerDown={(e) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                notifyPlayerControlInteraction("emergSealLock", true);
                notifyPlayerControlInteraction("emergSealLock", false);
                emergSealDepressRef.current = 1.0;
                playSwitchClank(true);
                playPneumaticWhoosh();
                useGameStore.getState().lockAllContainmentSeals();
              }}
            >
              {/* Single Mushroom Button Hitbox */}
              <mesh position={[0, 0, 0.024]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.044, 0.044, 0.056, 12]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
              {/* Heavy Cast-Iron & Steel Guard Collar */}
              <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.036, 0.04, 0.022, 14]} />
                <meshStandardMaterial
                  color="#2b3036"
                  roughness={0.38}
                  metalness={0.78}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.006}
                />
              </mesh>
              <mesh position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.03, 0.032, 0.006, 14]} />
                <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.32} />
              </mesh>
              <group ref={emergSealBtnRef} position={[0, 0, 0.028]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.027, 0.022, 0.024, 14]} />
                  <meshStandardMaterial
                    color="#6e1a14"
                    emissive="#8a1c14"
                    emissiveIntensity={0.28}
                    roughness={0.32}
                    metalness={0.18}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.004}
                  />
                </mesh>
              </group>
            </group>
          </group>

          {/* 3. RIGHT: Heavy Bolted Quadrant Pull-Lever & Armored Sight-Glass (`BUBBLER DRAIN`) */}
          <group position={[0.555, 0.02, 0.02]} scale={[1.18, 1.42, 1.25]}>
            <mesh position={[0, 0.272, 0.012]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.398, 0.128, 0.01]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.272, 0.02]} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.382, 0.114]} />
              <meshStandardMaterial
                map={rightPlateTex}
                emissive="#ffffff"
                emissiveMap={rightPlateTex}
                emissiveIntensity={0.35}
                roughness={0.65}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
            <SovietBacklitIndicatorBlock3D
              position={[0, 0.145, 0.024]}
              scale={0.88}
              label="DRAIN VALVE"
              getAlertState={(s) => ({
                level:
                  s.bubblerLevel >= 88 || s.pressureBar >= 82
                    ? "critical"
                    : s.bubblerLevel > 72 || s.pressureBar > 76
                      ? "warn"
                      : "normal",
                acknowledged: drainDragRef.current.active,
              })}
            />

            {/* Weathered Steel-Framed Cast-Iron Assembly Backplate */}
            <mesh position={[0, -0.02, 0.005]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.322, 0.372, 0.018]} />
              <meshStandardMaterial color="#8a929a" metalness={0.82} roughness={0.36} />
            </mesh>
            <mesh position={[0, -0.02, 0.009]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.306, 0.356, 0.022]} />
              <meshStandardMaterial
                color="#1c2220"
                roughness={0.44}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
                roughnessMap={ironTex.roughnessMap}
              />
            </mesh>

            {/* Left Half: Raised Bolted Cast-Iron Quadrant Pull-Lever (`BUBBLER DRAIN`) */}
            <group
              position={[-0.06, -0.02, 0.028]}
              onPointerOver={(e) => {
                e.stopPropagation();
                useGameStore
                  .getState()
                  .setHoveredControlHint(
                    "BUBBLER / DRUM DRAIN LEVER: Click, Drag Down, or Scroll Up = DRAIN DRUM WATER (mm) & BUBBLER / RELIEVE >72 BAR",
                  );
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                useGameStore.getState().setHoveredControlHint(null);
              }}
              onWheel={(e) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                e.nativeEvent?.stopImmediatePropagation?.();
                const wantOpen = e.deltaY < 0;
                const s = useGameStore.getState();
                if (s.bubblerDraining !== wantOpen) {
                  s.setBubblerDraining(wantOpen);
                  drainDragRef.current.progress = wantOpen ? 1.0 : 0;
                  playSwitchClank(true);
                  if (wantOpen) playSteamVentHiss(0.6);
                }
              }}
              onPointerDown={(e) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                notifyPlayerControlInteraction("bubblerDrain", true);
                const wasOpen = useGameStore.getState().bubblerDraining;
                const startY = e.nativeEvent.clientY;
                let dragged = false;
                drainDragRef.current = {
                  active: true,
                  startY,
                  progress: wasOpen ? 1.0 : 0.0,
                  lastHissTime: 0,
                };
                const handleMove = (ev: PointerEvent) => {
                  if (!drainDragRef.current.active) return;
                  const dy = ev.clientY - startY;
                  if (Math.abs(dy) >= 14) {
                    dragged = true;
                  }
                  if (!dragged) return;
                  const prog = THREE.MathUtils.clamp(
                    (wasOpen ? 1.0 : 0.0) + dy / 65,
                    0,
                    1.0,
                  );
                  drainDragRef.current.progress = prog;
                  const wantOpen = prog >= 0.5;
                  const s = useGameStore.getState();
                  if (s.bubblerDraining !== wantOpen) {
                    s.setBubblerDraining(wantOpen);
                    playSwitchClank(true);
                    if (wantOpen) playSteamVentHiss(0.6);
                  }
                };
                const handleUp = () => {
                  drainDragRef.current.active = false;
                  const s = useGameStore.getState();
                  if (!dragged) {
                    const nextOpen = !wasOpen;
                    s.setBubblerDraining(nextOpen);
                    drainDragRef.current.progress = nextOpen ? 1.0 : 0.0;
                    playSwitchClank(true);
                    if (nextOpen) playSteamVentHiss(0.6);
                  } else {
                    drainDragRef.current.progress = s.bubblerDraining ? 1.0 : 0.0;
                    playSwitchClank(false);
                  }
                  notifyPlayerControlInteraction("bubblerDrain", false);
                  window.removeEventListener("pointermove", handleMove);
                  window.removeEventListener("pointerup", handleUp);
                  window.removeEventListener("pointercancel", handleUp);
                };
                window.addEventListener("pointermove", handleMove);
                window.addEventListener("pointerup", handleUp);
                window.addEventListener("pointercancel", handleUp);
              }}
            >
              {/* Single Invisible Hitbox for Bubbler Drain Quadrant & Lever */}
              <mesh position={[0, 0, 0.05]}>
                <boxGeometry args={[0.16, 0.296, 0.13]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
              {/* Raised 0.032m Deep Cast-Iron Quadrant Box */}
              <mesh raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.118, 0.292, 0.032]} />
                <meshStandardMaterial
                  color="#1c2220"
                  roughness={0.42}
                  metalness={0.72}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.008}
                  roughnessMap={ironTex.roughnessMap}
                />
              </mesh>
              {/* Beveled Steel Side Rails */}
              {[-0.042, 0.042].map((rx, rIdx) => (
                <mesh key={rIdx} position={[rx, 0, 0.015]} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.02, 0.276, 0.012]} />
                  <meshStandardMaterial
                    color="#2b3036"
                    metalness={0.78}
                    roughness={0.36}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.005}
                  />
                </mesh>
              ))}
              {/* Engraved Brass Scale Plate alongside Slot */}
              <mesh position={[-0.042, 0, 0.0235]} raycast={NOOP_RAYCAST}>
                <planeGeometry args={[0.019, 0.24]} />
                <meshStandardMaterial
                  map={leverScalePlateTex}
                  metalness={0.75}
                  roughness={0.35}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  polygonOffsetUnits={-2}
                />
              </mesh>
              {/* Merged 6 Perimeter Steel Hex Bolts, Dark Channel, 12 Dust-Bellows Pleats & 16 Ratchet Teeth */}
              <mesh geometry={B_DRAIN_6_BOLTS_GEO} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
              </mesh>
              <mesh position={[0, 0, 0.009]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.032, 0.242, 0.01]} />
                <meshStandardMaterial color="#090b0a" roughness={0.92} />
              </mesh>
              <mesh geometry={B_DRAIN_12_PLEATS_GEO} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial color="#141716" roughness={0.88} />
              </mesh>
              <mesh geometry={B_DRAIN_16_TEETH_GEO} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.32} />
              </mesh>

              {/* Central Bolted Pivot Knuckle, Twin Thick Chrome-Steel Lever Arms & Dark Phenolic Bakelite T-Handle */}
              <group ref={drainLeverGroupRef} position={[0, 0.095, 0.018]}>
                {/* Central Bolted Pivot Knuckle */}
                <mesh rotation={[0, 0, Math.PI / 2]} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.017, 0.017, 0.044, 12]} />
                  <meshStandardMaterial color="#2b3036" metalness={0.82} roughness={0.32} />
                </mesh>
                <mesh rotation={[0, 0, Math.PI / 2]} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.0085, 0.0085, 0.052, 6]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.28} />
                </mesh>
                {/* Twin Thick Chrome-Steel Lever Arms */}
                {[-0.019, 0.019].map((lx, lIdx) => (
                  <mesh
                    key={lIdx}
                    position={[lx, 0, 0.038]}
                    rotation={[Math.PI / 2, 0, 0]}
                    raycast={NOOP_RAYCAST}
                  >
                    <cylinderGeometry args={[0.008, 0.009, 0.076, 10]} />
                    <meshStandardMaterial color="#d8dfe6" metalness={0.9} roughness={0.2} />
                  </mesh>
                ))}
                {/* Lathe-Turned Dark Phenolic Bakelite T-Handle (#1c1817) */}
                <mesh
                  position={[0, 0, 0.076]}
                  rotation={[0, 0, Math.PI / 2]}
                  raycast={NOOP_RAYCAST}
                >
                  <cylinderGeometry args={[0.022, 0.022, 0.144, 14]} />
                  <meshStandardMaterial
                    color="#1c1817"
                    roughness={0.32}
                    metalness={0.15}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.004}
                  />
                </mesh>
                {/* Machined Brushed-Steel End-Ferrules (#8a929a) */}
                {[-0.066, 0.066].map((bx, bIdx) => (
                  <mesh
                    key={bIdx}
                    position={[bx, 0, 0.076]}
                    rotation={[0, 0, Math.PI / 2]}
                    raycast={NOOP_RAYCAST}
                  >
                    <cylinderGeometry args={[0.0235, 0.0235, 0.016, 14]} />
                    <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
                  </mesh>
                ))}
                {/* Single Thin Recessed Enamel Indicator Ring */}
                <mesh position={[0, 0, 0.076]} rotation={[0, 0, Math.PI / 2]} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.0228, 0.0228, 0.008, 14]} />
                  <meshStandardMaterial
                    ref={drainRingMatRef}
                    color="#d98218"
                    roughness={0.36}
                    metalness={0.2}
                  />
                </mesh>
              </group>
            </group>

            {/* Right Half: Armored Bubbler Sight-Glass with Bolted Brass Manifold Caps & Graduation Tick Rings (WATER LEVEL) */}
            <group position={[0.078, -0.02, 0.03]}>
              {/* Heavy Top & Bottom Bolted Brass Manifold Caps & 8 Merged Hex Bolts */}
              <mesh geometry={B_8_SIGHT_BOLTS_GEO} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.3} />
              </mesh>
              {[-0.132, 0.132].map((vy, vIdx) => (
                <mesh key={vIdx} position={[0, vy, 0]} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.036, 0.038, 0.028, 12]} />
                  <meshStandardMaterial
                    color="#b8a46b"
                    metalness={0.86}
                    roughness={0.28}
                    bumpMap={brassTex.bumpMap}
                    bumpScale={0.005}
                  />
                </mesh>
              ))}

              {/* Protective Vertical Slotted Steel Armor Shroud framing the Sight-Glass */}
              <mesh position={[0, 0, -0.018]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.056, 0.244, 0.008]} />
                <meshStandardMaterial
                  color="#2b3036"
                  metalness={0.78}
                  roughness={0.38}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.006}
                />
              </mesh>
              {[-0.025, 0.025].map((sx, sIdx) => (
                <mesh key={sIdx} position={[sx, 0, 0.002]} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.008, 0.244, 0.036]} />
                  <meshStandardMaterial
                    color="#2b3036"
                    metalness={0.8}
                    roughness={0.36}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.005}
                  />
                </mesh>
              ))}

              {/* Engraved 20% / 40% / 60% / 80% Graduation Scale Strip beside the Shroud with Brass Backing */}
              <mesh position={[0.042, 0, 0.001]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.028, 0.236, 0.008]} />
                <meshStandardMaterial color="#b8a46b" metalness={0.82} roughness={0.32} />
              </mesh>
              <mesh position={[0.042, 0, 0.0075]} raycast={NOOP_RAYCAST}>
                <planeGeometry args={[0.024, 0.23]} />
                <meshStandardMaterial
                  map={sightGlassScaleTex}
                  metalness={0.72}
                  roughness={0.38}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  polygonOffsetUnits={-2}
                />
              </mesh>

              {/* 4 Merged Horizontal Brass Tick-Mark Graduation Rings (20% / 40% / 60% / 80%) */}
              <mesh geometry={B_4_SIGHT_TICKS_GEO} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial color="#b8a46b" metalness={0.88} roughness={0.26} />
              </mesh>

              {/* Outer Transparent Cylindrical Sight-Glass Tube */}
              <mesh raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.021, 0.021, 0.24, 16]} />
                <meshStandardMaterial
                  color="#d8f4ff"
                  transparent
                  opacity={0.32}
                  depthWrite={false}
                  roughness={0.14}
                  metalness={0.22}
                />
              </mesh>
              {/* Inner Glowing Water Column that visibly drains downward when holding the lever */}
              <mesh ref={sightGlassWaterMeshRef} position={[0, -0.05, 0]} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.016, 0.016, 0.23, 14]} />
                <meshStandardMaterial
                  ref={sightGlassWaterMatRef}
                  color="#28b862"
                  emissive="#28b862"
                  emissiveIntensity={1.15}
                  roughness={0.25}
                />
              </mesh>
            </group>
          </group>
        </group>
      )}
    </group>
  );
});

interface Dvk84KeySpec {
  id: string;
  cyr: string;
  lat: string;
  widthUnits: number;
  tone: "ivory" | "charcoal" | "oxblood";
}

const DVK84_KEY_ROWS: ReadonlyArray<{
  rowIdx: number;
  zOffset: number;
  baseY: number;
  keys: ReadonlyArray<Dvk84KeySpec>;
}> = [
  {
    rowIdx: 0,
    zOffset: 0.028,
    baseY: 0.046,
    keys: [
      { id: "r0-0", cyr: "LOCK", lat: "", widthUnits: 1.35, tone: "oxblood" },
      { id: "r0-1", cyr: "1", lat: "!", widthUnits: 1, tone: "ivory" },
      { id: "r0-2", cyr: "2", lat: '"', widthUnits: 1, tone: "ivory" },
      { id: "r0-3", cyr: "3", lat: "#", widthUnits: 1, tone: "ivory" },
      { id: "r0-4", cyr: "4", lat: ";", widthUnits: 1, tone: "ivory" },
      { id: "r0-5", cyr: "5", lat: "%", widthUnits: 1, tone: "ivory" },
      { id: "r0-6", cyr: "6", lat: ":", widthUnits: 1, tone: "ivory" },
      { id: "r0-7", cyr: "7", lat: "?", widthUnits: 1, tone: "ivory" },
      { id: "r0-8", cyr: "8", lat: "*", widthUnits: 1, tone: "ivory" },
      { id: "r0-9", cyr: "9", lat: "(", widthUnits: 1, tone: "ivory" },
      { id: "r0-10", cyr: "0", lat: ")", widthUnits: 1, tone: "ivory" },
      { id: "r0-11", cyr: "-", lat: "_", widthUnits: 1, tone: "ivory" },
      { id: "r0-12", cyr: "=", lat: "+", widthUnits: 1, tone: "ivory" },
      { id: "r0-13", cyr: "CLR", lat: "", widthUnits: 1.55, tone: "oxblood" },
    ],
  },
  {
    rowIdx: 1,
    zOffset: 0.064,
    baseY: 0.0435,
    keys: [
      { id: "r1-0", cyr: "TAB", lat: "", widthUnits: 1.45, tone: "charcoal" },
      { id: "r1-1", cyr: "Q", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r1-2", cyr: "W", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r1-3", cyr: "E", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r1-4", cyr: "R", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r1-5", cyr: "T", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r1-6", cyr: "Y", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r1-7", cyr: "U", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r1-8", cyr: "I", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r1-9", cyr: "O", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r1-10", cyr: "P", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r1-11", cyr: "[", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r1-12", cyr: "]", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r1-13", cyr: "ESC", lat: "", widthUnits: 1.45, tone: "charcoal" },
    ],
  },
  {
    rowIdx: 2,
    zOffset: 0.1,
    baseY: 0.041,
    keys: [
      { id: "r2-0", cyr: "CTRL", lat: "", widthUnits: 1.65, tone: "charcoal" },
      { id: "r2-1", cyr: "A", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r2-2", cyr: "S", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r2-3", cyr: "D", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r2-4", cyr: "F", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r2-5", cyr: "G", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r2-6", cyr: "H", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r2-7", cyr: "J", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r2-8", cyr: "K", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r2-9", cyr: "L", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r2-10", cyr: ";", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r2-11", cyr: "'", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r2-12", cyr: "ENTER", lat: "", widthUnits: 2.25, tone: "oxblood" },
    ],
  },
  {
    rowIdx: 3,
    zOffset: 0.136,
    baseY: 0.0385,
    keys: [
      { id: "r3-0", cyr: "SHIFT", lat: "", widthUnits: 1.65, tone: "oxblood" },
      { id: "r3-1", cyr: "Z", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r3-2", cyr: "X", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r3-3", cyr: "C", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r3-4", cyr: "V", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r3-5", cyr: "SPACE // DVK-84", lat: "", widthUnits: 4.3, tone: "ivory" },
      { id: "r3-6", cyr: "B", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r3-7", cyr: "N", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r3-8", cyr: "M", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r3-9", cyr: "<", lat: "", widthUnits: 1, tone: "ivory" },
      { id: "r3-10", cyr: "MODE", lat: "", widthUnits: 1.95, tone: "charcoal" },
    ],
  },
];

const DVK84_TONE_COLORS: Record<
  Dvk84KeySpec["tone"],
  { skirt: string; crown: string }
> = {
  ivory: { skirt: "#a8a08c", crown: "#c2ba9e" },
  oxblood: { skirt: "#4d1612", crown: "#631e19" },
  charcoal: { skirt: "#211d1b", crown: "#2c2725" },
};

const DVK84_ROW_KEY_GEOS: ReadonlyArray<
  ReadonlyArray<{
    tone: Dvk84KeySpec["tone"];
    skirtGeo: THREE.BufferGeometry;
    crownGeo: THREE.BufferGeometry;
    skirtColor: string;
    crownColor: string;
  }>
> = (() => {
  const totalRowWidth = 1.32;
  const keyGap = 0.0055;
  const tones: ReadonlyArray<Dvk84KeySpec["tone"]> = [
    "ivory",
    "oxblood",
    "charcoal",
  ];
  return DVK84_KEY_ROWS.map((row) => {
    const totalUnits = row.keys.reduce((acc, k) => acc + k.widthUnits, 0);
    const totalGaps = (row.keys.length - 1) * keyGap;
    const unitWidth = (totalRowWidth - totalGaps) / totalUnits;
    let cursorX = -totalRowWidth / 2;
    const placements = row.keys.map((k) => {
      const w = k.widthUnits * unitWidth;
      const cx = cursorX + w / 2;
      cursorX += w + keyGap;
      return { tone: k.tone, width: w, centerX: cx };
    });
    const groups: Array<{
      tone: Dvk84KeySpec["tone"];
      skirtGeo: THREE.BufferGeometry;
      crownGeo: THREE.BufferGeometry;
      skirtColor: string;
      crownColor: string;
    }> = [];
    for (const tone of tones) {
      const subset = placements.filter((p) => p.tone === tone);
      if (subset.length === 0) continue;
      const colors = DVK84_TONE_COLORS[tone];
      groups.push({
        tone,
        skirtGeo: mergeStaticGeometries(
          subset.map((kp) => ({
            geometry: new THREE.BoxGeometry(kp.width, 0.013, 0.031),
            position: [kp.centerX, row.baseY, row.zOffset] as const,
          })),
        ),
        crownGeo: mergeStaticGeometries(
          subset.map((kp) => ({
            geometry: new THREE.BoxGeometry(kp.width - 0.006, 0.005, 0.025),
            position: [
              kp.centerX,
              row.baseY + 0.0085,
              row.zOffset - 0.001,
            ] as const,
          })),
        ),
        skirtColor: colors.skirt,
        crownColor: colors.crown,
      });
    }
    return groups;
  });
})();

/**
 * Gritty 1984 Soviet Military Mainframe Console (DVK-84 OPERATOR CONSOLE)
 * Replaces the old Z-fighting keycap deck and 3 giant plastic Duplo button bricks
 * on the K.O.M.R.A.D.-84 terminal with 3 distinct mechanical switch stations +
 * a recessed cast-iron DVK-2M / ES EVM mechanical keyboard well with two-tone sculpted keycaps.
 */
export const SovietDvk84KeyboardConsole3D: React.FC<{
  onCycleBulletin?: () => void;
}> = React.memo(({ onCycleBulletin }) => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  // Station 1 (`OVERRIDE AI LOCK`) refs
  const overrideToggleBatRef = useRef<THREE.Group>(null);
  const overrideLampMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const overridePulseRef = useRef(0);

  // Station 2 (`PURGE FIREWALL`) refs
  const purgePlungerGroupRef = useRef<THREE.Group>(null);
  const purgeGuardGroupRef = useRef<THREE.Group>(null);
  const purgePlungerMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const purgeReadyLedMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const purgeAlertLedMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const purgePressAnimRef = useRef(0);

  // Station 3 (`CYCLE AI BULLETIN`) refs
  const bulletinKnobGroupRef = useRef<THREE.Group>(null);
  const bulletinLampMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const bulletinAngleRef = useRef(0);
  const bulletinTargetAngleRef = useRef(0);
  const bulletinPressAnimRef = useRef(0);

  // Keyboard Row Press Animation refs
  const keyRowGroupRefs = useRef<Array<THREE.Group | null>>([]);
  const keyRowPressRef = useRef<[number, number, number, number]>([0, 0, 0, 0]);

  const overridePlaqueTex = useMemo(
    () =>
      createCrispPanelTexture(320, 68, (ctx, w, h) => {
        ctx.fillStyle = "#161918";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#8a929a";
        ctx.lineWidth = 3;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        for (const [rx, ry] of [
          [11, 11],
          [w - 11, 11],
          [11, h - 11],
          [w - 11, h - 11],
        ] as const) {
          ctx.fillStyle = "#8c7a4b";
          ctx.beginPath();
          ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        drawFittedPlaqueText(
          ctx,
          "OVERRIDE AI LOCK",
          w / 2,
          29,
          w,
          'bold 20px "Kremlin", "Courier Prime", monospace',
          "#ffb000",
        );
        drawFittedPlaqueText(
          ctx,
          "AI OVERRIDE • DEFENSE",
          w / 2,
          53,
          w,
          'bold 15px "Kremlin", "VT323", monospace',
          "#d8d2c0",
        );
      }),
    [],
  );

  const purgePlaqueTex = useMemo(
    () =>
      createCrispPanelTexture(320, 68, (ctx, w, h) => {
        ctx.fillStyle = "#1a1414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#c83228";
        ctx.lineWidth = 3;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        for (const [rx, ry] of [
          [11, 11],
          [w - 11, 11],
          [11, h - 11],
          [w - 11, h - 11],
        ] as const) {
          ctx.fillStyle = "#8a929a";
          ctx.beginPath();
          ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        drawFittedPlaqueText(
          ctx,
          "PURGE FIREWALL",
          w / 2,
          29,
          w,
          'bold 20px "Kremlin", "Courier Prime", monospace',
          "#ff4438",
        );
        drawFittedPlaqueText(
          ctx,
          "FIREWALL RESET • READY / ALERT",
          w / 2,
          53,
          w,
          'bold 15px "Kremlin", "VT323", monospace',
          "#e6dec3",
        );
      }),
    [],
  );

  const bulletinPlaqueTex = useMemo(
    () =>
      createCrispPanelTexture(320, 68, (ctx, w, h) => {
        ctx.fillStyle = "#141a17";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#8c7a4b";
        ctx.lineWidth = 3;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        for (const [rx, ry] of [
          [11, 11],
          [w - 11, 11],
          [11, h - 11],
          [w - 11, h - 11],
        ] as const) {
          ctx.fillStyle = "#b8a46b";
          ctx.beginPath();
          ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        drawFittedPlaqueText(
          ctx,
          "CYCLE AI BULLETIN",
          w / 2,
          29,
          w,
          'bold 20px "Kremlin", "Courier Prime", monospace',
          "#33ff66",
        );
        drawFittedPlaqueText(
          ctx,
          "BULLETIN CYCLE • SELECT",
          w / 2,
          53,
          w,
          'bold 15px "Kremlin", "VT323", monospace',
          "#d8d2c0",
        );
      }),
    [],
  );

  const hazardRailTex = useMemo(
    () =>
      createCrispPanelTexture(64, 256, (ctx, w, h) => {
        ctx.fillStyle = "#181615";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#c47d16";
        for (let y = -64; y < h + 64; y += 36) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y + 20);
          ctx.lineTo(w, y + 38);
          ctx.lineTo(0, y + 18);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = "rgba(18, 16, 14, 0.32)";
        for (let i = 0; i < 40; i++) {
          const sx = ((i * 37) % w);
          const sy = ((i * 73) % h);
          ctx.fillRect(sx, sy, 6, 3);
        }
      }),
    [],
  );

  const purgeCapTex = useMemo(
    () =>
      createCrispPanelTexture(128, 128, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        const grad = ctx.createRadialGradient(cx, cy, 6, cx, cy, 58);
        grad.addColorStop(0, "#ff4a3d");
        grad.addColorStop(0.68, "#a81814");
        grad.addColorStop(1, "#4a0a08");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, 58, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#e6dec3";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 48, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#fff4eb";
        ctx.font = 'bold 20px "Kremlin", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("PURGE", cx, cy - 3, 96);
        ctx.font = 'bold 14px "Kremlin", "VT323", monospace';
        ctx.fillText("RESET", cx, cy + 19, 88);
      }),
    [],
  );

  const consoleBadgeTex = useMemo(
    () =>
      createCrispPanelTexture(512, 40, (ctx, w, h) => {
        ctx.fillStyle = "#161a18";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#8c7a4b";
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#b8a46b";
        ctx.font = 'bold 15px "Kremlin", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText(
          "DVK-84M MAINFRAME CONSOLE • GOST 25868-84 • SECTOR 84",
          w / 2,
          25,
          w - 24,
        );
      }),
    [],
  );

  // Precompute exact X positions and widths for each keycap + row legend strip textures
  const computedRows = useMemo(() => {
    const totalRowWidth = 1.32;
    const keyGap = 0.0055;

    return DVK84_KEY_ROWS.map((row) => {
      const totalUnits = row.keys.reduce((acc, k) => acc + k.widthUnits, 0);
      const totalGaps = (row.keys.length - 1) * keyGap;
      const unitWidth = (totalRowWidth - totalGaps) / totalUnits;

      let cursorX = -totalRowWidth / 2;
      const keyPlacements = row.keys.map((k) => {
        const w = k.widthUnits * unitWidth;
        const cx = cursorX + w / 2;
        cursorX += w + keyGap;
        return {
          ...k,
          width: w,
          centerX: cx,
        };
      });

      const rowLegendTex = createCrispPanelTexture(1024, 64, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        for (const kp of keyPlacements) {
          const normCenter = (kp.centerX + totalRowWidth / 2) / totalRowWidth;
          const normWidth = (kp.width - 0.007) / totalRowWidth;
          const px = normCenter * w;
          const pw = normWidth * w;
          const x0 = px - pw / 2;

          // Subtle recessed top keycap dish bevel
          ctx.fillStyle =
            kp.tone === "ivory"
              ? "rgba(214, 206, 184, 0.94)"
              : kp.tone === "oxblood"
                ? "rgba(104, 30, 24, 0.94)"
                : "rgba(44, 40, 38, 0.94)";
          ctx.fillRect(x0 + 2, 6, pw - 4, h - 12);

          ctx.strokeStyle =
            kp.tone === "ivory"
              ? "rgba(72, 66, 56, 0.55)"
              : "rgba(18, 16, 15, 0.7)";
          ctx.lineWidth = 2;
          ctx.strokeRect(x0 + 2, 6, pw - 4, h - 12);

          const mainInk = kp.tone === "ivory" ? "#181614" : "#efe8d4";
          const subInk = kp.tone === "ivory" ? "#6e1d18" : "#ffb74d";

          if (kp.lat && kp.cyr.length <= 2) {
            ctx.fillStyle = mainInk;
            ctx.font = 'bold 21px "Kremlin", "Courier Prime", monospace';
            ctx.textAlign = "left";
            ctx.fillText(kp.cyr, x0 + 8, 32, Math.max(12, pw - 16));

            ctx.fillStyle = subInk;
            ctx.font = 'bold 16px "Kremlin", "Courier Prime", monospace';
            ctx.textAlign = "right";
            ctx.fillText(kp.lat, x0 + pw - 7, 50, Math.max(12, pw - 14));
          } else {
            ctx.fillStyle = mainInk;
            ctx.font = 'bold 17px "Kremlin", "Courier Prime", monospace';
            ctx.textAlign = "center";
            ctx.fillText(kp.cyr, px, kp.lat ? 30 : 39, Math.max(16, pw - 10));
            if (kp.lat) {
              ctx.fillStyle = subInk;
              ctx.font = 'bold 13px "Kremlin", "VT323", monospace';
              ctx.fillText(kp.lat, px, 48, Math.max(16, pw - 10));
            }
          }
        }
      });

      return {
        ...row,
        totalRowWidth,
        keyPlacements,
        rowLegendTex,
      };
    });
  }, []);

  useFrame(({ clock }, delta) => {
    const s = useGameStore.getState();
    const t = clock.getElapsedTime();

    // 1. Station 1 (`OVERRIDE AI LOCK`): Guarded Toggle Switch + Caged Amber Jewel Lamp
    if (overridePulseRef.current > 0) {
      overridePulseRef.current = Math.max(0, overridePulseRef.current - delta * 2.8);
    }
    if (overrideToggleBatRef.current) {
      const targetRotX =
        s.komradOverrideLocked || overridePulseRef.current > 0.2 ? -0.58 : 0.58;
      overrideToggleBatRef.current.rotation.x = THREE.MathUtils.lerp(
        overrideToggleBatRef.current.rotation.x,
        targetRotX,
        0.25,
      );
    }
    if (overrideLampMatRef.current) {
      const pulse = s.komradOverrideLocked
        ? 1.35 + Math.sin(t * 12) * 0.75
        : overridePulseRef.current > 0
          ? 1.6
          : 0.42;
      const col = s.komradOverrideLocked ? "#ff7700" : "#d98a18";
      overrideLampMatRef.current.color.set(col);
      overrideLampMatRef.current.emissive.set(col);
      overrideLampMatRef.current.emissiveIntensity = pulse;
    }

    // 2. Station 2 (`PURGE FIREWALL`): Hinged Safety-Guarded Crimson Plunger + READY/ALERT Dual LEDs
    if (purgePressAnimRef.current > 0) {
      purgePressAnimRef.current = Math.max(0, purgePressAnimRef.current - delta * 3.5);
    }
    if (purgePlungerGroupRef.current) {
      const depressY = 0.022 - Math.sin(purgePressAnimRef.current * Math.PI) * 0.011;
      purgePlungerGroupRef.current.position.y = depressY;
    }
    if (purgeGuardGroupRef.current) {
      const guardKick = Math.sin(purgePressAnimRef.current * Math.PI) * 0.22;
      purgeGuardGroupRef.current.rotation.x = -0.92 - guardKick;
    }
    if (purgePlungerMatRef.current) {
      const glow = s.ciaIntrusionActive
        ? 1.45 + Math.sin(t * 14) * 0.65
        : 0.55 + purgePressAnimRef.current * 1.1;
      purgePlungerMatRef.current.emissiveIntensity = glow;
    }
    if (purgeReadyLedMatRef.current) {
      const readyOn = !s.ciaIntrusionActive && !s.isBlackout;
      purgeReadyLedMatRef.current.color.set(readyOn ? "#28d858" : "#14261a");
      purgeReadyLedMatRef.current.emissive.set(readyOn ? "#28d858" : "#000000");
      purgeReadyLedMatRef.current.emissiveIntensity = readyOn ? 1.25 : 0.05;
    }
    if (purgeAlertLedMatRef.current) {
      const alertBlink = s.ciaIntrusionActive
        ? 1.5 + Math.sin(t * 16) * 0.8
        : purgePressAnimRef.current > 0
          ? 1.2
          : 0.06;
      purgeAlertLedMatRef.current.color.set(
        s.ciaIntrusionActive ? "#ff2a2a" : "#3a1212",
      );
      purgeAlertLedMatRef.current.emissive.set("#ff2a2a");
      purgeAlertLedMatRef.current.emissiveIntensity = alertBlink;
    }

    // 3. Station 3 (`CYCLE AI BULLETIN`): Knurled Bakelite Rotary Turret + Emerald Pilot Lamp
    if (bulletinPressAnimRef.current > 0) {
      bulletinPressAnimRef.current = Math.max(
        0,
        bulletinPressAnimRef.current - delta * 3.6,
      );
    }
    bulletinAngleRef.current = THREE.MathUtils.lerp(
      bulletinAngleRef.current,
      bulletinTargetAngleRef.current,
      0.24,
    );
    if (bulletinKnobGroupRef.current) {
      bulletinKnobGroupRef.current.rotation.y = bulletinAngleRef.current;
      bulletinKnobGroupRef.current.position.y =
        0.024 - Math.sin(bulletinPressAnimRef.current * Math.PI) * 0.006;
    }
    if (bulletinLampMatRef.current) {
      const lampGlow =
        bulletinPressAnimRef.current > 0
          ? 1.85
          : s.isBlackout
            ? 0.05
            : 0.65 + Math.sin(t * 3.2) * 0.15;
      bulletinLampMatRef.current.color.set("#28d858");
      bulletinLampMatRef.current.emissive.set("#28d858");
      bulletinLampMatRef.current.emissiveIntensity = lampGlow;
    }

    // 4. Animate Mechanical Keyboard Row Depressions
    for (let r = 0; r < 4; r++) {
      if (keyRowPressRef.current[r] > 0) {
        keyRowPressRef.current[r] = Math.max(
          0,
          keyRowPressRef.current[r] - delta * 5.2,
        );
      }
      const grp = keyRowGroupRefs.current[r];
      if (grp) {
        grp.position.y = -Math.sin(keyRowPressRef.current[r] * Math.PI) * 0.0045;
      }
    }
  });

  const triggerOverrideStation = (e: ThreeEvent<MouseEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return;
    e.stopPropagation();
    overridePulseRef.current = 1.0;
    playSwitchClank(true);
    useGameStore.getState().overrideKomradLock();
  };

  const triggerPurgeStation = (e: ThreeEvent<MouseEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return;
    e.stopPropagation();
    purgePressAnimRef.current = 1.0;
    playSwitchClank(true);
    useGameStore.getState().purgeFirewall();
  };

  const triggerBulletinStation = (e: ThreeEvent<MouseEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return;
    e.stopPropagation();
    bulletinPressAnimRef.current = 1.0;
    bulletinTargetAngleRef.current -= Math.PI / 3;
    playSwitchClank(false);
    playDetentClick();
    onCycleBulletin?.();
  };

  return (
    <group position={[0, 0.785, 0.255]} rotation={[0.3, 0, 0]}>
      {/* ================================================================
          1. HEAVY STEPPED CAST-IRON KEYBOARD CONSOLE CHASSIS (DVK-84)
             Eliminates all coplanar inner plates — key-bed floor sits at
             y = 0.021m, well below keycap bottoms at y = 0.0385m..0.046m!
         ================================================================ */}
      {/* Lower Cast-Iron Console Tub (y = -0.038m to +0.022m) */}
      <mesh position={[0, -0.008, 0.032]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[1.52, 0.06, 0.42]} />
        <meshStandardMaterial
          color="#1d2722"
          roughness={0.48}
          metalness={0.64}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
          roughnessMap={ironTex.roughnessMap}
        />
      </mesh>

      {/* Deep Dark Recessed Steel Key-Well Floor Plate (Top surface at y = 0.023m, >0.015m below keycaps!) */}
      <mesh position={[0, 0.019, 0.082]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[1.38, 0.008, 0.185]} />
        <meshStandardMaterial
          color="#0a0d0b"
          roughness={0.78}
          metalness={0.45}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.004}
        />
      </mesh>

      {/* Stepped Cast-Iron Perimeter Bezel Walls Framing the Recessed Key-Well */}
      {/* Left & Right Bezel Flanks */}
      {[-0.725, 0.725].map((bx, bIdx) => (
        <mesh
          key={`kb-flank-${bIdx}`}
          position={[bx, 0.036, 0.032]}
          raycast={NOOP_RAYCAST}
        >
          <boxGeometry args={[0.068, 0.028, 0.418]} />
          <meshStandardMaterial
            color="#222e28"
            roughness={0.44}
            metalness={0.68}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.007}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
      ))}
      {/* Center Divider Ridge Between Upper Switch Manifold & Lower Keyboard Well */}
      <mesh position={[0, 0.038, 0.0]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[1.384, 0.026, 0.022]} />
        <meshStandardMaterial
          color="#18201c"
          roughness={0.42}
          metalness={0.72}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.006}
        />
      </mesh>
      {/* Engraved Brass Serial Badge on Divider Ridge (+0.003m clear with polygonOffset) */}
      <mesh position={[0, 0.0535, 0.0]} rotation={[-Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[0.56, 0.02]} />
        <meshStandardMaterial
          map={consoleBadgeTex}
          roughness={0.38}
          metalness={0.55}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* Front Bezel Lip & Cylindrical Brushed-Steel Wrist-Rest Bar */}
      <mesh position={[0, 0.034, 0.192]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[1.48, 0.024, 0.038]} />
        <meshStandardMaterial
          color="#18201c"
          roughness={0.45}
          metalness={0.68}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.007}
        />
      </mesh>
      {/* Cylindrical Brushed-Steel Wrist-Rest Bar + 3 Machined Standoff Brackets */}
      <group position={[0, 0.052, 0.206]}>
        <mesh rotation={[0, 0, Math.PI / 2]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.014, 0.014, 1.42, 16]} />
          <meshStandardMaterial
            color="#8a929a"
            metalness={0.88}
            roughness={0.26}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.003}
          />
        </mesh>
        {[-0.64, 0, 0.64].map((wx, wIdx) => (
          <mesh key={`wrist-br-${wIdx}`} position={[wx, -0.01, -0.008]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.032, 0.026, 0.032]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.86}
              roughness={0.28}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
        ))}
      </group>

      {/* 8 Perimeter Brass Hex Bolts on Console Frame */}
      {(
        [
          [-0.725, -0.145],
          [0.725, -0.145],
          [-0.725, 0.0],
          [0.725, 0.0],
          [-0.725, 0.085],
          [0.725, 0.085],
          [-0.725, 0.192],
          [0.725, 0.192],
        ] as const
      ).map(([bx, bz], bIdx) => (
        <mesh key={`cbolt-${bIdx}`} position={[bx, 0.053, bz]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.0075, 0.0075, 0.007, 6]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.86}
            roughness={0.28}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>
      ))}

      {/* ================================================================
          2. UPPER COMMAND SWITCH MANIFOLD (3 HEAVY SOVIET ASSEMBLIES)
             Mounted on an unobstructed exposed control strip at z = -0.076m
             completely in front of and below the CRT bottom bezel!
         ================================================================ */}
      <group position={[0, 0.038, -0.076]}>
        {/* Dark Gunmetal Manifold Deck Plate */}
        <mesh position={[0, 0, 0]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.384, 0.024, 0.132]} />
          <meshStandardMaterial
            color="#151b18"
            roughness={0.44}
            metalness={0.72}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.007}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>

        {/* --------------------------------------------------------------
            LEFT STATION (-0.455m): `OVERRIDE AI LOCK` (AI OVERRIDE)
            Guarded Metal Toggle Switch + Caged Amber Jewel Lamp
           -------------------------------------------------------------- */}
        <group position={[-0.455, 0.013, 0]} onClick={triggerOverrideStation}>
          {/* Generous Invisible Hit-Box Collider */}
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.43, 0.1, 0.14]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>

          {/* Bolted Steel Sub-Plate */}
          <mesh position={[0, 0.005, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.41, 0.01, 0.122]} />
            <meshStandardMaterial
              color="#222826"
              roughness={0.4}
              metalness={0.76}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
          {/* 4 Corner Steel Hex Bolts */}
          {(
            [
              [-0.188, -0.046],
              [0.188, -0.046],
              [-0.188, 0.046],
              [0.188, 0.046],
            ] as const
          ).map(([bx, bz], idx) => (
            <mesh key={`ov-bolt-${idx}`} position={[bx, 0.012, bz]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.0055, 0.0055, 0.006, 6]} />
              <meshStandardMaterial color="#8a929a" metalness={0.86} roughness={0.3} />
            </mesh>
          ))}

          {/* Raised Angled Nameplate Wedge + Illuminated English Plaque (`OVERRIDE AI LOCK`) */}
          <mesh position={[0, 0.015, -0.028]} rotation={[0.22, 0, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.356, 0.012, 0.054]} />
            <meshStandardMaterial color="#181d1b" metalness={0.7} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.0225, -0.027]} rotation={[-Math.PI / 2 + 0.22, 0, 0]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.348, 0.05]} />
            <meshStandardMaterial
              map={overridePlaqueTex}
              emissive="#ffffff"
              emissiveMap={overridePlaqueTex}
              emissiveIntensity={0.48}
              roughness={0.86}
              metalness={0.12}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>

          {/* Guarded Metal Toggle Switch Assembly (Left-Center of Station) */}
          <group position={[-0.058, 0.012, 0.028]}>
            {/* Hex Brass Mounting Nut & Threaded Collar */}
            <mesh position={[0, 0.006, 0]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.022, 0.025, 0.012, 6]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.86}
                roughness={0.26}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
            <mesh position={[0, 0.014, 0]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.014, 0.014, 0.01, 12]} />
              <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.24} />
            </mesh>

            {/* U-Shaped Steel Protective Side-Guards */}
            {[-0.028, 0.028].map((gx, gIdx) => (
              <group key={`ov-guard-${gIdx}`} position={[gx, 0.022, 0]}>
                <mesh position={[0, 0, -0.016]} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.004, 0.004, 0.042, 8]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.26} />
                </mesh>
                <mesh position={[0, 0, 0.016]} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.004, 0.004, 0.042, 8]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.26} />
                </mesh>
                <mesh position={[0, 0.021, 0]} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.008, 0.007, 0.04]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.26} />
                </mesh>
              </group>
            ))}

            {/* Flipping Chrome Toggle Bat */}
            <group ref={overrideToggleBatRef} position={[0, 0.016, 0]}>
              <mesh position={[0, 0.022, 0]} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.0085, 0.005, 0.046, 12]} />
                <meshStandardMaterial
                  color="#dce4e8"
                  metalness={0.94}
                  roughness={0.16}
                />
              </mesh>
              <mesh position={[0, 0.045, 0]} raycast={NOOP_RAYCAST}>
                <sphereGeometry args={[0.009, 10, 10]} />
                <meshStandardMaterial
                  color="#dce4e8"
                  metalness={0.94}
                  roughness={0.16}
                />
              </mesh>
            </group>
          </group>

          {/* 3D Caged Amber Jewel Lamp (Right of Toggle Switch) */}
          <group position={[0.088, 0.014, 0.028]} rotation={[-Math.PI / 2, 0, 0]}>
            <CagedSovietJewelLamp3D
              position={[0, 0, 0]}
              lampMatRef={overrideLampMatRef}
              scale={0.88}
            />
          </group>
        </group>

        {/* --------------------------------------------------------------
            CENTER STATION (0.0m): `PURGE FIREWALL` (FIREWALL RESET)
            Hinged Safety-Guarded Industrial Push-Plunger + Dual READY/ALERT LEDs
           -------------------------------------------------------------- */}
        <group position={[0, 0.013, 0]} onClick={triggerPurgeStation}>
          {/* Generous Invisible Hit-Box Collider */}
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.44, 0.1, 0.14]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>

          {/* Recessed Dark Steel Bezel Base */}
          <mesh position={[0, 0.005, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.42, 0.01, 0.122]} />
            <meshStandardMaterial
              color="#1b1818"
              roughness={0.42}
              metalness={0.74}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>

          {/* Hazard-Striped Side Rails */}
          {[-0.196, 0.196].map((rx, rIdx) => (
            <mesh key={`haz-rail-${rIdx}`} position={[rx, 0.0155, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.022, 0.01, 0.118]} />
              <meshStandardMaterial
                map={hazardRailTex}
                roughness={0.48}
                metalness={0.35}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
          ))}

          {/* Raised Angled Nameplate Wedge + Engraved Steel Label Plate (`PURGE FIREWALL`) */}
          <mesh position={[0, 0.015, -0.028]} rotation={[0.22, 0, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.348, 0.012, 0.054]} />
            <meshStandardMaterial color="#1f1616" metalness={0.7} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.0225, -0.027]} rotation={[-Math.PI / 2 + 0.22, 0, 0]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.34, 0.05]} />
            <meshStandardMaterial
              map={purgePlaqueTex}
              emissive="#ffffff"
              emissiveMap={purgePlaqueTex}
              emissiveIntensity={0.48}
              roughness={0.86}
              metalness={0.12}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>

          {/* Industrial Backlit Crimson Push-Plunger + Machined Collar + Spring Safety Guard */}
          <group position={[-0.045, 0.012, 0.028]}>
            {/* Outer Knurled Dark Cast-Iron Turret Base */}
            <mesh position={[0, 0.008, 0]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.042, 0.046, 0.016, 18]} />
              <meshStandardMaterial
                color="#1c2022"
                metalness={0.78}
                roughness={0.38}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
            {/* Machined Brushed-Steel Collar Ring */}
            <mesh position={[0, 0.017, 0]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.037, 0.04, 0.008, 18]} />
              <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.26} />
            </mesh>

            {/* Depressible Crimson Glass/Bakelite Plunger Cylinder */}
            <group ref={purgePlungerGroupRef} position={[0, 0.022, 0]}>
              <mesh raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.031, 0.033, 0.02, 20]} />
                <meshStandardMaterial
                  ref={purgePlungerMatRef}
                  color="#b81d18"
                  emissive="#ff2a2a"
                  emissiveIntensity={0.65}
                  roughness={0.26}
                  metalness={0.18}
                />
              </mesh>
              {/* Crisp Stenciled Plunger Top Cap (+0.002m clear with polygonOffset) */}
              <mesh position={[0, 0.0115, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                <circleGeometry args={[0.029, 20]} />
                <meshStandardMaterial
                  map={purgeCapTex}
                  emissive="#ffffff"
                  emissiveMap={purgeCapTex}
                  emissiveIntensity={0.55}
                  roughness={0.3}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  polygonOffsetUnits={-2}
                />
              </mesh>
            </group>

            {/* Spring-Hinged Wire/Steel Safety Guard Frame (Tilted open at rear) */}
            <group ref={purgeGuardGroupRef} position={[0, 0.018, -0.038]} rotation={[-0.92, 0, 0]}>
              {/* Coiled Hinge Barrel */}
              <mesh rotation={[0, 0, Math.PI / 2]} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.006, 0.006, 0.068, 10]} />
                <meshStandardMaterial color="#8a929a" metalness={0.9} roughness={0.22} />
              </mesh>
              {/* Side Guard Struts */}
              {[-0.034, 0.034].map((sx, sIdx) => (
                <mesh key={`pg-strut-${sIdx}`} position={[sx, 0, 0.038]} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.006, 0.006, 0.076]} />
                  <meshStandardMaterial color="#c83228" roughness={0.38} metalness={0.45} />
                </mesh>
              ))}
              {/* Front Guard Cross-Bar */}
              <mesh position={[0, 0, 0.076]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.074, 0.007, 0.008]} />
                <meshStandardMaterial color="#ffb000" roughness={0.38} metalness={0.35} />
              </mesh>
            </group>
          </group>

          {/* Dual-LED Status Indicator (`READY` Emerald / `ALERT` Crimson) */}
          <group position={[0.095, 0.012, 0.028]}>
            <mesh position={[0, 0.005, 0]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.092, 0.01, 0.052]} />
              <meshStandardMaterial
                color="#141816"
                metalness={0.75}
                roughness={0.4}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
            {/* READY Lamp (Left) */}
            <group position={[-0.022, 0.011, 0]}>
              <mesh raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.013, 0.015, 0.007, 12]} />
                <meshStandardMaterial color="#b8a46b" metalness={0.86} roughness={0.26} />
              </mesh>
              <mesh position={[0, 0.004, 0]} raycast={NOOP_RAYCAST}>
                <sphereGeometry args={[0.01, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
                <meshStandardMaterial
                  ref={purgeReadyLedMatRef}
                  color="#28d858"
                  emissive="#28d858"
                  emissiveIntensity={1.2}
                  roughness={0.2}
                />
              </mesh>
            </group>
            {/* ALERT Lamp (Right) */}
            <group position={[0.022, 0.011, 0]}>
              <mesh raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.013, 0.015, 0.007, 12]} />
                <meshStandardMaterial color="#b8a46b" metalness={0.86} roughness={0.26} />
              </mesh>
              <mesh position={[0, 0.004, 0]} raycast={NOOP_RAYCAST}>
                <sphereGeometry args={[0.01, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
                <meshStandardMaterial
                  ref={purgeAlertLedMatRef}
                  color="#3a1212"
                  emissive="#ff2a2a"
                  emissiveIntensity={0.08}
                  roughness={0.2}
                />
              </mesh>
            </group>
          </group>
        </group>

        {/* --------------------------------------------------------------
            RIGHT STATION (+0.455m): `CYCLE AI BULLETIN` (BULLETIN CYCLE)
            Tactile Knurled Bakelite Rotary Selector Turret + Emerald Jewel Lamp
           -------------------------------------------------------------- */}
        <group position={[0.455, 0.013, 0]} onClick={triggerBulletinStation}>
          {/* Generous Invisible Hit-Box Collider */}
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.43, 0.1, 0.14]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>

          {/* Bolted Steel Sub-Plate */}
          <mesh position={[0, 0.005, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.41, 0.01, 0.122]} />
            <meshStandardMaterial
              color="#1c2420"
              roughness={0.4}
              metalness={0.76}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
          {/* 4 Corner Brass Hex Bolts */}
          {(
            [
              [-0.188, -0.046],
              [0.188, -0.046],
              [-0.188, 0.046],
              [0.188, 0.046],
            ] as const
          ).map(([bx, bz], idx) => (
            <mesh key={`bul-bolt-${idx}`} position={[bx, 0.012, bz]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.0055, 0.0055, 0.006, 6]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.86} roughness={0.28} />
            </mesh>
          ))}

          {/* Raised Angled Nameplate Wedge + Engraved Plaque (`CYCLE AI BULLETIN`) */}
          <mesh position={[0, 0.015, -0.028]} rotation={[0.22, 0, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.356, 0.012, 0.054]} />
            <meshStandardMaterial color="#161f1b" metalness={0.7} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.0225, -0.027]} rotation={[-Math.PI / 2 + 0.22, 0, 0]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.348, 0.05]} />
            <meshStandardMaterial
              map={bulletinPlaqueTex}
              emissive="#ffffff"
              emissiveMap={bulletinPlaqueTex}
              emissiveIntensity={0.48}
              roughness={0.86}
              metalness={0.12}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>

          {/* Heavy Cast-Iron Boss + Brushed Brass Index Ring + Knurled Bakelite Rotary Turret */}
          <group position={[-0.055, 0.012, 0.028]}>
            {/* Heavy Cast-Iron Cylindrical Boss */}
            <mesh position={[0, 0.006, 0]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.04, 0.044, 0.012, 18]} />
              <meshStandardMaterial
                color="#161c19"
                metalness={0.76}
                roughness={0.4}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
            {/* Brushed Brass Index Ring */}
            <mesh position={[0, 0.013, 0]} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.036, 0.038, 0.005, 18]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.86}
                roughness={0.26}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>

            {/* Rotating & Depressible Lathe-Turned Dark Charcoal Bakelite Knob */}
            <group ref={bulletinKnobGroupRef} position={[0, 0.024, 0]}>
              <mesh raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.028, 0.032, 0.022, 16]} />
                <meshStandardMaterial
                  color="#1c1817"
                  roughness={0.32}
                  metalness={0.15}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.004}
                />
              </mesh>
              {/* 6 Knurled Grip Ribs Around the Bakelite Turret */}
              {Array.from({ length: 6 }).map((_, kIdx) => {
                const ang = (kIdx / 6) * Math.PI * 2;
                return (
                  <mesh
                    key={`krib-${kIdx}`}
                    position={[Math.cos(ang) * 0.029, 0, Math.sin(ang) * 0.029]}
                    rotation={[0, -ang, 0]}
                    raycast={NOOP_RAYCAST}
                  >
                    <boxGeometry args={[0.005, 0.019, 0.007]} />
                    <meshStandardMaterial color="#2a2422" roughness={0.38} />
                  </mesh>
                );
              })}
              {/* Machined Brushed-Steel Center Cap */}
              <mesh position={[0, 0.0115, 0]} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.014, 0.015, 0.004, 14]} />
                <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.24} />
              </mesh>
              {/* High-Contrast Ivory White Indicator Stripe */}
              <mesh position={[0, 0.012, -0.018]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.0055, 0.004, 0.018]} />
                <meshStandardMaterial
                  color="#efe8d4"
                  emissive="#efe8d4"
                  emissiveIntensity={0.25}
                  roughness={0.3}
                />
              </mesh>
            </group>
          </group>

          {/* 3D Caged Emerald Jewel Pilot Lamp (Right of Rotary Turret) */}
          <group position={[0.088, 0.012, 0.026]} rotation={[-Math.PI / 2, 0, 0]}>
            <CagedSovietJewelLamp3D
              position={[0, 0, 0]}
              lampMatRef={bulletinLampMatRef}
              scale={0.88}
            />
          </group>
        </group>
      </group>

      {/* ================================================================
          3. SCULPTED SOVIET `DVK-2M / ES EVM` TWO-TONE MECHANICAL KEYBOARD
             4 terraced rows of sculpted two-tone keycaps (skirt + crown)
             sitting cleanly above the dark steel key-well (zero Z-fighting!)
         ================================================================ */}
      <group position={[0, 0, 0]}>
        {computedRows.map((row) => (
          <group
            key={`dvk-row-${row.rowIdx}`}
            ref={(el) => {
              keyRowGroupRefs.current[row.rowIdx] = el;
            }}
            onClick={(e) => {
              if (useCameraLookStore.getState().isFreeLookMode) return;
              e.stopPropagation();
              keyRowPressRef.current[row.rowIdx] = 1.0;
              playDetentClick();
              const store = useGameStore.getState();
              const localPt = e.object.worldToLocal(e.point.clone());
              const deltaPct = localPt.x < -0.15 ? -5 : 5;
              if (row.rowIdx === 0) {
                store.cycleSelectedH2OSubstation();
                store.adjustSubstationH2O(store.selectedH2OSubstationId, deltaPct);
              } else if (row.rowIdx === 1) {
                store.adjustSubstationH2O(1, deltaPct);
              } else if (row.rowIdx === 2) {
                store.adjustSubstationH2O(3, deltaPct);
              } else if (row.rowIdx === 3) {
                store.adjustSubstationH2O(5, deltaPct);
              }
            }}
          >
            {/* Generous Row Hit-Box */}
            <mesh position={[0, row.baseY + 0.008, row.zOffset]}>
              <boxGeometry args={[row.totalRowWidth, 0.024, 0.034]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Merged Sculpted Two-Tier 3D Keycaps by Tone */}
            {DVK84_ROW_KEY_GEOS[row.rowIdx].map((g) => (
              <group key={g.tone}>
                <mesh geometry={g.skirtGeo} raycast={NOOP_RAYCAST}>
                  <meshStandardMaterial
                    color={g.skirtColor}
                    roughness={0.42}
                    metalness={0.14}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.002}
                  />
                </mesh>
                <mesh geometry={g.crownGeo} raycast={NOOP_RAYCAST}>
                  <meshStandardMaterial
                    color={g.crownColor}
                    roughness={0.36}
                    metalness={0.12}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.0015}
                  />
                </mesh>
              </group>
            ))}

            {/* Crisp Cyrillic/Latin Legend Overlay Plane (+0.003m clear of keycap crowns with polygonOffset) */}
            <mesh
              position={[0, row.baseY + 0.014, row.zOffset - 0.001]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
            >
              <planeGeometry args={[row.totalRowWidth, 0.025]} />
              <meshStandardMaterial
                map={row.rowLegendTex}
                transparent
                roughness={0.4}
                metalness={0.08}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
});



