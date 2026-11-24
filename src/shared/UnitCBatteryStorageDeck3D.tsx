import { useFrame, type ThreeEvent } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { controlRoomPowerState } from "./ControlRoomScene";
import { NOOP_RAYCAST } from "./ExteriorDioramas3D";
import { registerKremlinCanvasRedraw } from "./kremlinFontReady";
import {
  getBrushedBrassTextures,
  getHammeredIronTextures,
} from "./proceduralMaterials";
import { useGameStore } from "./useGameStore";

const COL_BLACK = new THREE.Color("#000000");
const COL_SEG_OFF = new THREE.Color("#101815");
const COL_RED = new THREE.Color("#ff2a2a");
const COL_AMBER = new THREE.Color("#ffb000");
const COL_ORANGE = new THREE.Color("#ff8c1a");
const COL_EMERALD = new THREE.Color("#26e87a");
const COL_CYAN = new THREE.Color("#22f0c8");
const COL_GREEN = new THREE.Color("#33ff66");
const COL_STANDBY = new THREE.Color("#b4f2a8");
const COL_TILE_OFF = new THREE.Color("#2c3832");
const COL_PILOT_OFF = new THREE.Color("#17221d");

function createDeckNearestTex(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    draw(ctx, width, height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.anisotropy = 1;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  registerKremlinCanvasRedraw(canvas, tex, (c, w, h) => {
    c.imageSmoothingEnabled = false;
    draw(c, w, h);
  });
  return tex;
}

function drawCrispKremlinText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: string,
  fill: string,
  stroke = "#000000",
  strokeWidth = 3,
  letterSpacing = "1.5px",
): void {
  ctx.save();
  ctx.font = font;
  const ctxWithSpacing = ctx as CanvasRenderingContext2D & {
    letterSpacing?: string;
  };
  if ("letterSpacing" in ctxWithSpacing) {
    ctxWithSpacing.letterSpacing = letterSpacing;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const measured = ctx.measureText(text).width;
  const scaleX = measured > maxWidth ? maxWidth / measured : 1;
  ctx.translate(x, y);
  if (scaleX < 1) {
    ctx.scale(scaleX, 1);
  }
  if (strokeWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeText(text, 0, 0);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function makeBayHeaderTex(title: string, subtitle: string): THREE.CanvasTexture {
  return createDeckNearestTex(512, 96, (ctx, w, h) => {
    ctx.fillStyle = "#111815";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#b89f5d";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.strokeStyle = "#2b3a33";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    drawCrispKremlinText(
      ctx,
      title,
      w / 2,
      34,
      w - 36,
      '900 28px "Kremlin", "Segoe UI Black", "Arial Black", sans-serif',
      "#ece6cc",
      "#000000",
      3.4,
      "2px",
    );
    drawCrispKremlinText(
      ctx,
      subtitle,
      w / 2,
      70,
      w - 36,
      '900 18px "Kremlin", "VT323", "Consolas", monospace',
      "#d4b86a",
      "#000000",
      2.6,
      "1.5px",
    );
  });
}

function makeSmallTagTex(
  line1: string,
  line2?: string,
  line1Color = "#42d884",
): THREE.CanvasTexture {
  return createDeckNearestTex(384, line2 ? 96 : 56, (ctx, w, h) => {
    ctx.fillStyle = "#121916";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#b89f5d";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    if (!line2) {
      drawCrispKremlinText(
        ctx,
        line1,
        w / 2,
        h / 2 + 1,
        w - 28,
        '900 26px "Kremlin", "VT323", monospace',
        "#e6dec3",
        "#000000",
        3,
        "1.5px",
      );
    } else {
      drawCrispKremlinText(
        ctx,
        line1,
        w / 2,
        31,
        w - 28,
        '900 22px "Kremlin", "VT323", monospace',
        line1Color,
        "#000000",
        2.8,
        "1.2px",
      );
      drawCrispKremlinText(
        ctx,
        line2,
        w / 2,
        68,
        w - 28,
        '900 21px "Kremlin", "VT323", monospace',
        "#e6dec3",
        "#000000",
        2.6,
        "1.5px",
      );
    }
  });
}

function makeChargeScaleTex(): THREE.CanvasTexture {
  return createDeckNearestTex(128, 512, (ctx, w, h) => {
    ctx.fillStyle = "#101714";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#2b3b34";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    const marks = [
      { label: "100%", y: 34, color: "#22f0c8" },
      { label: "75%", y: 146, color: "#48e69a" },
      { label: "50%", y: 256, color: "#e6dec3" },
      { label: "25%", y: 366, color: "#ffb000" },
      { label: "0%", y: 478, color: "#ff4444" },
    ];

    for (let i = 0; i <= 20; i++) {
      const ty = 34 + (i / 20) * 444;
      const major = i % 5 === 0;
      ctx.fillStyle = major ? "#e6dec3" : "#6b7c74";
      ctx.fillRect(6, Math.round(ty) - 1, major ? 24 : 13, major ? 3 : 2);
    }

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const m of marks) {
      ctx.font = 'bold 28px "VT323", "Courier Prime", monospace';
      ctx.fillStyle = "#000000";
      ctx.fillText(m.label, w - 10, m.y + 2);
      ctx.fillStyle = m.color;
      ctx.fillText(m.label, w - 12, m.y);
    }
  });
}

function makeDispatchScaleTex(): THREE.CanvasTexture {
  return createDeckNearestTex(160, 256, (ctx, w, h) => {
    ctx.fillStyle = "#101714";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#2b3b34";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    const marks = [
      { label: "1000", y: 22, color: "#ff4444" },
      { label: "750", y: 76, color: "#ffb000" },
      { label: "500", y: 128, color: "#e6dec3" },
      { label: "250", y: 180, color: "#68e296" },
      { label: "0 MW", y: 234, color: "#33ff66" },
    ];

    for (let i = 0; i <= 10; i++) {
      const ty = 22 + (i / 10) * 212;
      const major = i % 2 === 0;
      ctx.fillStyle = major ? "#e6dec3" : "#6b7c74";
      ctx.fillRect(6, Math.round(ty) - 1, major ? 22 : 12, major ? 3 : 2);
    }

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const m of marks) {
      ctx.font = 'bold 30px "VT323", "Courier Prime", monospace';
      ctx.fillStyle = m.color;
      ctx.fillText(m.label, w - 10, m.y);
    }
  });
}

function makeFlowMeterDialTex(): THREE.CanvasTexture {
  return createDeckNearestTex(512, 512, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const r = 242;

    ctx.fillStyle = "#161b18";
    ctx.fillRect(0, 0, w, h);

    // Aged ivory/white Soviet dial face
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#e6dec3";
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#2a2822";
    ctx.stroke();

    // Inner subtle hairline ring
    ctx.beginPath();
    ctx.arc(cx, cy, 198, -Math.PI * 0.5 - 1.9, -Math.PI * 0.5 + 1.9);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#484438";
    ctx.stroke();

    // Left Charge zone arc (-500 .. 0 MW)
    ctx.beginPath();
    ctx.arc(cx, cy, 206, -Math.PI * 0.5 - 1.88, -Math.PI * 0.5 - 0.04);
    ctx.lineWidth = 14;
    ctx.strokeStyle = "#188a68";
    ctx.stroke();

    // Right Discharge zone arc (0 .. +350 MW)
    ctx.beginPath();
    ctx.arc(cx, cy, 206, -Math.PI * 0.5 + 0.04, -Math.PI * 0.5 + 1.32);
    ctx.lineWidth = 14;
    ctx.strokeStyle = "#d98218";
    ctx.stroke();

    // High Discharge redline arc (+350 .. +500 MW)
    ctx.beginPath();
    ctx.arc(cx, cy, 206, -Math.PI * 0.5 + 1.34, -Math.PI * 0.5 + 1.88);
    ctx.lineWidth = 14;
    ctx.strokeStyle = "#c82424";
    ctx.stroke();

    // Radial ticks from -108 deg (-500) to +108 deg (+500)
    const maxAngle = Math.PI * 0.6;
    for (let i = -10; i <= 10; i++) {
      const ang = -Math.PI / 2 + (i / 10) * maxAngle;
      const isMajor = i % 5 === 0;
      const rIn = isMajor ? 164 : 182;
      const rOut = 200;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * rIn, cy + Math.sin(ang) * rIn);
      ctx.lineTo(cx + Math.cos(ang) * rOut, cy + Math.sin(ang) * rOut);
      ctx.lineWidth = isMajor ? 6 : 3;
      ctx.strokeStyle = i >= 7 ? "#b01c1c" : i <= -5 ? "#0f6e52" : "#181816";
      ctx.stroke();
    }

    // Major numeric scale labels (-500, -250, 0, +250, +500)
    const labels = [
      { frac: -1.0, text: "-500", col: "#0f6e52" },
      { frac: -0.5, text: "-250", col: "#0f6e52" },
      { frac: 0.0, text: "0", col: "#141412" },
      { frac: 0.5, text: "+250", col: "#a8560a" },
      { frac: 1.0, text: "+500", col: "#b01c1c" },
    ];
    ctx.font = 'bold 28px "Courier Prime", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const lbl of labels) {
      const ang = -Math.PI / 2 + lbl.frac * maxAngle;
      ctx.fillStyle = lbl.col;
      ctx.fillText(lbl.text, cx + Math.cos(ang) * 134, cy + Math.sin(ang) * 134);
    }

    // Side directional legends & center header
    ctx.font = 'bold 26px "Kremlin", "Arial Black", sans-serif';
    ctx.fillStyle = "#0e684e";
    ctx.fillText("-MW CHARGE", cx - 96, cy + 86);
    ctx.fillStyle = "#b83618";
    ctx.fillText("+MW DISPATCH", cx + 92, cy + 86);

    ctx.fillStyle = "#1a1a18";
    ctx.font = 'bold 30px "Kremlin", "Arial Black", sans-serif';
    ctx.fillText("FLOW MW", cx, cy + 148);
    ctx.font = 'bold 20px "Courier Prime", monospace';
    ctx.fillStyle = "#48443a";
    ctx.fillText("GOST-84C // BUS", cx, cy + 180);
  });
}

function makeModeAnnunciatorTex(label: string): THREE.CanvasTexture {
  return createDeckNearestTex(256, 52, (ctx, w, h) => {
    ctx.fillStyle = "#262c29";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#b8c4be";
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    drawCrispKremlinText(
      ctx,
      label,
      w / 2,
      h / 2 + 1,
      w - 24,
      '900 26px "Kremlin", "Segoe UI Black", "Arial Black", sans-serif',
      "#ffffff",
      "#0a0e0c",
      3,
      "2px",
    );
  });
}

function makeRelayHeaderTex(): THREE.CanvasTexture {
  return createDeckNearestTex(512, 48, (ctx, w, h) => {
    ctx.fillStyle = "#121916";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#b89f5d";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    drawCrispKremlinText(
      ctx,
      "GEN   ->   BAT   ->   GRID",
      w / 2,
      h / 2 + 1,
      w - 32,
      '900 24px "Kremlin", "Courier Prime", monospace',
      "#e8b85a",
      "#000000",
      2.6,
      "2.5px",
    );
  });
}

function drawVfdReadout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mw: number,
  isBlackout: boolean,
): void {
  ctx.fillStyle = "#07120c";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#2c7b48";
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, w - 4, h - 4);
  ctx.fillStyle = isBlackout
    ? "#662828"
    : mw >= 850
      ? "#ff5533"
      : mw >= 650
        ? "#ffb000"
        : "#33ff66";
  ctx.font = 'bold 42px "VT323", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(isBlackout ? "0 MW" : `${mw} MW`, w / 2, h / 2 + 2);
}

function mergeDeckGeometries(
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

const VENT_TRIM_LOUVERS_GEO = mergeDeckGeometries(
  Array.from({ length: 24 }, (_, idx) => ({
    geometry: new THREE.BoxGeometry(0.056, 0.018, 0.006),
    position: [-0.805 + idx * 0.07, 0, 0.01],
  })),
);

const VENT_TRIM_BOLTS_GEO = mergeDeckGeometries(
  [-0.87, -0.52, -0.17, 0.17, 0.52, 0.87].map((bx) => ({
    geometry: new THREE.CylinderGeometry(0.0055, 0.0055, 0.008, 6),
    position: [bx, 0, 0.011],
    rotation: [Math.PI / 2, 0, 0],
  })),
);

// Outer chassis + 3 bay corner brackets & hex bolts inside Chassis Group (y = +0.035)
const CHASSIS_BRACKETS_GEO = mergeDeckGeometries(
  (
    [
      // Outer chassis 4 corner gusset plates
      [-0.885, 0.405],
      [0.885, 0.405],
      [-0.885, -0.405],
      [0.885, -0.405],
      // Left bay 4 corners
      [-0.868, 0.384],
      [-0.342, 0.384],
      [-0.868, -0.384],
      [-0.342, -0.384],
      // Center bay 4 corners
      [-0.268, 0.384],
      [0.268, 0.384],
      [-0.268, -0.384],
      [0.268, -0.384],
      // Right bay 4 corners
      [0.342, 0.384],
      [0.868, 0.384],
      [0.342, -0.384],
      [0.868, -0.384],
    ] as const
  ).map(([cx, cy], idx) => ({
    geometry: new THREE.BoxGeometry(
      idx < 4 ? 0.056 : 0.036,
      idx < 4 ? 0.056 : 0.036,
      0.012,
    ),
    position: [cx, cy, idx < 4 ? 0.041 : 0.051],
  })),
);

const CHASSIS_BOLTS_GEO = mergeDeckGeometries(
  (
    [
      [-0.885, 0.405, 0.05],
      [0.885, 0.405, 0.05],
      [-0.885, -0.405, 0.05],
      [0.885, -0.405, 0.05],
      [-0.868, 0.384, 0.059],
      [-0.342, 0.384, 0.059],
      [-0.868, -0.384, 0.059],
      [-0.342, -0.384, 0.059],
      [-0.268, 0.384, 0.059],
      [0.268, 0.384, 0.059],
      [-0.268, -0.384, 0.059],
      [0.268, -0.384, 0.059],
      [0.342, 0.384, 0.059],
      [0.868, 0.384, 0.059],
      [0.342, -0.384, 0.059],
      [0.868, -0.384, 0.059],
      // Mullion fasteners
      [-0.305, 0.25, 0.059],
      [-0.305, -0.25, 0.059],
      [0.305, 0.25, 0.059],
      [0.305, -0.25, 0.059],
    ] as const
  ).map(([bx, by, bz]) => ({
    geometry: new THREE.CylinderGeometry(0.006, 0.006, 0.008, 6),
    position: [bx, by, bz],
    rotation: [Math.PI / 2, 0, 0],
  })),
);

function buildAccumulatorBankGeos(sideSign: -1 | 1) {
  const bayX = sideSign * 0.605;
  // Inner 2x2 cell stack right next to Center Bay; outer 10-seg charge column on outer flank.
  // Keeps copper feeder busbars flowing cleanly inward into Center Bay without crossing any LEDs.
  const cellCenterX = bayX - sideSign * 0.088;
  const barCenterX = bayX + sideSign * 0.194;
  const cols = [cellCenterX - 0.078, cellCenterX + 0.078] as const;
  const rows = [0.104, -0.162] as const;

  const cellBodiesGeo = mergeDeckGeometries(
    rows.flatMap((ry) =>
      cols.map((cx) => ({
        geometry: new THREE.CylinderGeometry(0.041, 0.041, 0.154, 16),
        position: [cx, ry, 0.09] as const,
      })),
    ),
  );

  const cellRibsStrapsGeo = mergeDeckGeometries([
    // 4 circumferential cooling ribs per cell
    ...rows.flatMap((ry) =>
      cols.flatMap((cx) =>
        [-0.052, -0.017, 0.017, 0.052].map((dy) => ({
          geometry: new THREE.CylinderGeometry(0.0445, 0.0445, 0.009, 16),
          position: [cx, ry + dy, 0.09] as const,
        })),
      ),
    ),
    // Steel hold-down clamp straps across each row
    ...rows.map((ry) => ({
      geometry: new THREE.BoxGeometry(0.28, 0.017, 0.017),
      position: [cellCenterX, ry - 0.004, 0.126] as const,
    })),
    // 9 dark horizontal louvers separating the 10 charge bars (bars sit on left side of column)
    ...Array.from({ length: 9 }, (_, i) => ({
      geometry: new THREE.BoxGeometry(0.074, 0.006, 0.014),
      position: [barCenterX - 0.028, -0.2415 + i * 0.05, 0.071] as const,
    })),
  ]);

  const ceramicInsulatorsGeo = mergeDeckGeometries([
    // 4 glazed ceramic top collars on the accumulator cells
    ...rows.flatMap((ry) =>
      cols.map((cx) => ({
        geometry: new THREE.CylinderGeometry(0.02, 0.024, 0.02, 12),
        position: [cx, ry + 0.087, 0.09] as const,
      })),
    ),
    // Porcelain mullion pass-through bushing for copper feeder busbar at y = -0.008
    {
      geometry: new THREE.CylinderGeometry(0.022, 0.022, 0.042, 12),
      position: [sideSign * 0.305, -0.008, 0.082] as const,
      rotation: [0, 0, Math.PI / 2] as const,
    },
  ]);

  const brassPostsGeo = mergeDeckGeometries(
    rows.flatMap((ry) =>
      cols.map((cx) => ({
        geometry: new THREE.CylinderGeometry(0.0095, 0.0095, 0.022, 8),
        position: [cx, ry + 0.107, 0.09] as const,
      })),
    ),
  );

  // Solid copper busbars bridging the 4 cells through the open mid-gap (y = -0.008) into Center Bay!
  const feederStartX = cellCenterX;
  const feederEndX = sideSign * 0.252;
  const feederMidX = (feederStartX + feederEndX) / 2;
  const feederWidth = Math.abs(feederStartX - feederEndX);

  const copperBusbarsGeo = mergeDeckGeometries([
    // Upper & lower horizontal collector straps connecting left & right cell terminals
    ...rows.map((ry) => ({
      geometry: new THREE.BoxGeometry(0.172, 0.014, 0.012),
      position: [cellCenterX, ry + 0.116, 0.09] as const,
    })),
    // Central vertical copper trunk spine between cell columns (`y = -0.046 -> +0.220`)
    {
      geometry: new THREE.BoxGeometry(0.02, 0.278, 0.014),
      position: [cellCenterX, 0.087, 0.09] as const,
    },
    // Heavy horizontal copper feeder bar crossing open mid-gap (`y = -0.008`) through mullion into Center Bay
    {
      geometry: new THREE.BoxGeometry(feederWidth, 0.02, 0.014),
      position: [feederMidX, -0.008, 0.082] as const,
    },
  ]);

  return {
    cellBodiesGeo,
    cellRibsStrapsGeo,
    ceramicInsulatorsGeo,
    brassPostsGeo,
    copperBusbarsGeo,
  };
}

const BANK_A_GEOS = buildAccumulatorBankGeos(-1);
const BANK_B_GEOS = buildAccumulatorBankGeos(1);

const CENTER_RELAY_COPPER_GEO = mergeDeckGeometries([
  // Left & right vertical copper riser drops linking Bank A/B feeders (y = -0.008) down to relay rail (y = -0.072)
  {
    geometry: new THREE.BoxGeometry(0.016, 0.074, 0.012),
    position: [-0.252, -0.04, 0.08],
  },
  {
    geometry: new THREE.BoxGeometry(0.016, 0.074, 0.012),
    position: [0.252, -0.04, 0.08],
  },
  // Main horizontal copper feeder rail across the armored relay housing
  {
    geometry: new THREE.BoxGeometry(0.516, 0.016, 0.01),
    position: [0, -0.072, 0.077],
  },
  // 3 copper solenoid coil windings & twin knife-switch blades
  ...([-0.155, 0, 0.155] as const).flatMap((rx) => [
    {
      geometry: new THREE.CylinderGeometry(0.019, 0.019, 0.044, 14),
      position: [rx, -0.072, 0.084] as const,
    },
    {
      geometry: new THREE.BoxGeometry(0.008, 0.052, 0.014),
      position: [rx - 0.024, -0.072, 0.084] as const,
    },
    {
      geometry: new THREE.BoxGeometry(0.008, 0.052, 0.014),
      position: [rx + 0.024, -0.072, 0.084] as const,
    },
  ]),
]);

const CENTER_RELAY_CERAMIC_GEO = mergeDeckGeometries(
  ([-0.155, 0, 0.155] as const).map((rx) => ({
    geometry: new THREE.BoxGeometry(0.092, 0.082, 0.008),
    position: [rx, -0.072, 0.074] as const,
  })),
);

const CENTER_RELAY_YOKE_GEO = mergeDeckGeometries(
  ([-0.155, 0, 0.155] as const).map((rx) => ({
    geometry: new THREE.BoxGeometry(0.068, 0.016, 0.018),
    position: [rx, -0.072, 0.092] as const,
  })),
);

export const UnitCBatteryStorageDeck3D: React.FC = React.memo(() => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  const needlePivotRef = useRef<THREE.Group>(null);
  const chargeSegMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const dispatchSegMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const relayLampMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const bankTempLampMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const genLampMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const syncLampMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const modeTileMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const vfdMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const vfdTexRef = useRef<THREE.CanvasTexture | null>(null);

  const lastChargeSigRef = useRef(-1);
  const lastDispatchMaskRef = useRef(-1);
  const lastVfdMwRef = useRef(-1);
  const lastVfdBlackoutRef = useRef<boolean | null>(null);
  const lastVfdDrawRef = useRef(-1);
  const lastModeSigRef = useRef(-1);
  const lastPowerBucketRef = useRef(-1);

  const resources = useMemo(() => {
    const bankAHeaderTex = makeBayHeaderTex(
      "ACCUMULATOR BANK A",
      "CELLS 01-04 // 0-100% BANK",
    );
    const centerHeaderTex = makeBayHeaderTex(
      "BATTERY - GRID",
      "AUTO DISPATCH // 0-1000 MW",
    );
    const bankBHeaderTex = makeBayHeaderTex(
      "ACCUMULATOR BANK B",
      "CELLS 05-08 // 0-100% BANK",
    );
    const bankAStatusTex = makeSmallTagTex(
      "CELL TEMP: NOMINAL",
      "1500 MWH BANK A",
    );
    const bankBStatusTex = makeSmallTagTex(
      "CELL TEMP: NOMINAL",
      "1500 MWH BANK B",
    );
    const chargeHeaderTex = makeSmallTagTex("CHARGE %");
    const bankFootTex = makeSmallTagTex("400V DC BUS");
    const chargeScaleTex = makeChargeScaleTex();
    const dispatchScaleTex = makeDispatchScaleTex();
    const flowDialTex = makeFlowMeterDialTex();
    const relayHeaderTex = makeRelayHeaderTex();
    const genTagTex = makeSmallTagTex("GEN");
    const syncTagTex = makeSmallTagTex("SYNC");
    const modeTileTexs = [
      makeModeAnnunciatorTex("CHARGING"),
      makeModeAnnunciatorTex("DISCHARGING"),
      makeModeAnnunciatorTex("STANDBY"),
      makeModeAnnunciatorTex("SHORTFALL"),
    ] as const;

    // Dedicated dynamic VFD readout texture (10Hz throttled canvas redraw)
    const vfdCanvas = document.createElement("canvas");
    vfdCanvas.width = 192;
    vfdCanvas.height = 56;
    const vfdCtx = vfdCanvas.getContext("2d");
    if (vfdCtx) {
      vfdCtx.imageSmoothingEnabled = false;
      drawVfdReadout(vfdCtx, 192, 56, 0, false);
    }
    const vfdTex = new THREE.CanvasTexture(vfdCanvas);
    vfdTex.magFilter = THREE.NearestFilter;
    vfdTex.minFilter = THREE.NearestFilter;
    vfdTex.anisotropy = 1;
    vfdTex.generateMipmaps = false;
    vfdTex.colorSpace = THREE.SRGBColorSpace;
    vfdTex.needsUpdate = true;

    const makeLedMat = () =>
      new THREE.MeshStandardMaterial({
        color: "#101815",
        emissive: "#000000",
        emissiveIntensity: 0.04,
        roughness: 0.25,
        metalness: 0.1,
      });

    const chargeSegMats = Array.from({ length: 10 }, makeLedMat);
    const dispatchSegMats = Array.from({ length: 10 }, makeLedMat);
    const relayLampMats = Array.from({ length: 3 }, makeLedMat);
    const bankTempLampMats = Array.from({ length: 2 }, makeLedMat);
    const genLampMat = makeLedMat();
    const syncLampMat = makeLedMat();

    const modeTileMats = modeTileTexs.map(
      (tex) =>
        new THREE.MeshStandardMaterial({
          color: "#2c3832",
          map: tex,
          emissive: "#000000",
          emissiveMap: tex,
          emissiveIntensity: 0.0,
          roughness: 0.36,
          metalness: 0.08,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
    );

    const staticTextures: THREE.CanvasTexture[] = [
      bankAHeaderTex,
      centerHeaderTex,
      bankBHeaderTex,
      bankAStatusTex,
      bankBStatusTex,
      chargeHeaderTex,
      bankFootTex,
      chargeScaleTex,
      dispatchScaleTex,
      flowDialTex,
      relayHeaderTex,
      genTagTex,
      syncTagTex,
      ...modeTileTexs,
      vfdTex,
    ];

    const dynamicMats: THREE.Material[] = [
      ...chargeSegMats,
      ...dispatchSegMats,
      ...relayLampMats,
      ...bankTempLampMats,
      genLampMat,
      syncLampMat,
      ...modeTileMats,
    ];

    return {
      bankAHeaderTex,
      centerHeaderTex,
      bankBHeaderTex,
      bankAStatusTex,
      bankBStatusTex,
      chargeHeaderTex,
      bankFootTex,
      chargeScaleTex,
      dispatchScaleTex,
      flowDialTex,
      relayHeaderTex,
      genTagTex,
      syncTagTex,
      vfdTex,
      chargeSegMats,
      dispatchSegMats,
      relayLampMats,
      bankTempLampMats,
      genLampMat,
      syncLampMat,
      modeTileMats,
      staticTextures,
      dynamicMats,
    };
  }, []);

  useEffect(() => {
    chargeSegMatRefs.current = resources.chargeSegMats;
    dispatchSegMatRefs.current = resources.dispatchSegMats;
    relayLampMatRefs.current = resources.relayLampMats;
    bankTempLampMatRefs.current = resources.bankTempLampMats;
    genLampMatRef.current = resources.genLampMat;
    syncLampMatRef.current = resources.syncLampMat;
    modeTileMatRefs.current = resources.modeTileMats;
    vfdTexRef.current = resources.vfdTex;
    return () => {
      chargeSegMatRefs.current = [];
      dispatchSegMatRefs.current = [];
      relayLampMatRefs.current = [];
      bankTempLampMatRefs.current = [];
      genLampMatRef.current = null;
      syncLampMatRef.current = null;
      modeTileMatRefs.current = [];
      vfdTexRef.current = null;
      for (const tex of resources.staticTextures) {
        tex.dispose();
      }
      for (const mat of resources.dynamicMats) {
        mat.dispose();
      }
    };
  }, [resources]);

  useFrame(({ clock }, dt) => {
    const s = useGameStore.getState();
    const t = clock.getElapsedTime();
    const unitCPower =
      s.lobbyMenuPhase !== "entered_control_room"
        ? 0.12
        : THREE.MathUtils.lerp(0.12, 1.0, controlRoomPowerState.zone2);
    const powerBucket = Math.round(unitCPower * 50);
    const powerChanged = powerBucket !== lastPowerBucketRef.current;
    if (powerChanged) {
      lastPowerBucketRef.current = powerBucket;
      if (vfdMatRef.current) {
        vfdMatRef.current.emissiveIntensity = 0.85 * unitCPower;
        vfdMatRef.current.color.setRGB(unitCPower, unitCPower, unitCPower);
      }
    }

    const dispatchedMW =
      s.isBlackout || s.az5Active
        ? 0
        : Math.max(0, Math.round(s.totalElectricalMW));
    const createdMW = s.isBlackout ? 0 : s.energyCreatedMW;
    const netFlowMW = dispatchedMW - createdMW; // negative = charging, positive = discharging
    const chargePct = s.batteryStoredPct;

    // 1. Center Flow Meter Needle (-500 MW CHARGE <-> 0 <-> +500 MW DISPATCH)
    if (needlePivotRef.current) {
      const norm = s.isBlackout
        ? 0
        : THREE.MathUtils.clamp(netFlowMW / 500, -1, 1);
      const tremor =
        !s.isBlackout && (dispatchedMW > 0 || createdMW > 0)
          ? Math.sin(t * 29) * 0.0045
          : 0;
      const targetRot = -norm * (Math.PI * 0.6) + tremor;
      needlePivotRef.current.rotation.z = THREE.MathUtils.damp(
        needlePivotRef.current.rotation.z,
        targetRot,
        10,
        dt,
      );
    }

    // 2. Twin 10-Segment Charge Columns (Bank A & Bank B synced to batteryStoredPct)
    const chargeTier = chargePct < 20 ? 0 : chargePct < 45 ? 1 : 2;
    let chargeMask = 0;
    for (let i = 0; i < 10; i++) {
      if (!s.isBlackout && chargePct >= (i + 1) * 10 - 5) {
        chargeMask |= 1 << i;
      }
    }
    const chargeSig = (chargeTier << 12) | chargeMask;
    if (chargeSig !== lastChargeSigRef.current || powerChanged) {
      lastChargeSigRef.current = chargeSig;
      for (let i = 0; i < 10; i++) {
        const mat = chargeSegMatRefs.current[i];
        if (!mat) continue;
        const isLit = (chargeMask & (1 << i)) !== 0;
        const litCol =
          chargeTier === 0
            ? COL_RED
            : chargeTier === 1
              ? COL_AMBER
              : i >= 5
                ? COL_CYAN
                : COL_EMERALD;
        mat.color.copy(isLit ? litCol : COL_SEG_OFF);
        mat.emissive.copy(isLit ? litCol : COL_BLACK);
        mat.emissiveIntensity = (isLit ? 1.45 : 0.04) * unitCPower;
      }
    }

    // 3. Center 10-Segment Vertical Dispatch Load Bargraph (0-1000 MW)
    let dispatchMask = 0;
    for (let i = 0; i < 10; i++) {
      if (!s.isBlackout && dispatchedMW >= (i + 1) * 100 - 50) {
        dispatchMask |= 1 << i;
      }
    }
    if (dispatchMask !== lastDispatchMaskRef.current || powerChanged) {
      lastDispatchMaskRef.current = dispatchMask;
      for (let i = 0; i < 10; i++) {
        const mat = dispatchSegMatRefs.current[i];
        if (!mat) continue;
        const isLit = (dispatchMask & (1 << i)) !== 0;
        const litCol = i >= 8 ? COL_RED : i >= 6 ? COL_AMBER : COL_GREEN;
        mat.color.copy(isLit ? litCol : COL_SEG_OFF);
        mat.emissive.copy(isLit ? litCol : COL_BLACK);
        mat.emissiveIntensity = (isLit ? 1.5 : 0.04) * unitCPower;
      }
    }

    // 4. Mode Annunciator Tiles & Pilot / Relay Jewels
    const isShortfall =
      s.isBlackout ||
      (s.tutorialPhase === "COMPLETED" && s.energyDemandMW > dispatchedMW + 35) ||
      (chargePct < 8 && dispatchedMW > createdMW + 15);
    const isCharging =
      !s.isBlackout && createdMW > dispatchedMW + 15 && chargePct < 99.5;
    const isDischarging =
      !s.isBlackout && dispatchedMW > createdMW + 15 && chargePct > 0.5;
    const isStandby = !s.isBlackout && !isShortfall && !isCharging && !isDischarging;

    const genActive = !s.isBlackout && createdMW > 20;
    const batActive = !s.isBlackout && chargePct > 2;
    const gridActive = !s.isBlackout && dispatchedMW > 20;
    const isSynced =
      !s.isBlackout &&
      dispatchedMW > 0 &&
      Math.abs(dispatchedMW - s.energyDemandMW) <= 35;

    const modeSig =
      (s.isBlackout ? 1 : 0) |
      (isCharging ? 2 : 0) |
      (isDischarging ? 4 : 0) |
      (isStandby ? 8 : 0) |
      (isShortfall ? 16 : 0) |
      (genActive ? 32 : 0) |
      (batActive ? 64 : 0) |
      (gridActive ? 128 : 0) |
      (isSynced ? 256 : 0) |
      (chargeTier << 9);

    if (modeSig !== lastModeSigRef.current || powerChanged) {
      lastModeSigRef.current = modeSig;

      const tileStates: readonly [boolean, THREE.Color, number][] = [
        [isCharging, COL_CYAN, 1.2],
        [isDischarging, COL_ORANGE, 1.2],
        [isStandby, COL_STANDBY, 0.85],
        [isShortfall, COL_RED, 1.35],
      ];
      for (let i = 0; i < 4; i++) {
        const [active, col, intensity] = tileStates[i];
        const m = modeTileMatRefs.current[i];
        if (!m) continue;
        m.color.copy(active ? col : COL_TILE_OFF);
        m.emissive.copy(active ? col : COL_BLACK);
        m.emissiveIntensity = active ? intensity * unitCPower : 0.0;
      }

      // 3 Relay Coil Jewels (GEN IN, BAT BUS, GRID OUT)
      const relayFlags = [genActive, batActive, gridActive] as const;
      const relayCols = [COL_AMBER, COL_CYAN, COL_GREEN] as const;
      for (let i = 0; i < 3; i++) {
        const rm = relayLampMatRefs.current[i];
        if (!rm) continue;
        const on = relayFlags[i];
        rm.color.copy(on ? relayCols[i] : COL_PILOT_OFF);
        rm.emissive.copy(on ? relayCols[i] : COL_BLACK);
        rm.emissiveIntensity = (on ? 1.35 : 0.04) * unitCPower;
      }

      // Bank A & Bank B Temperature / Health Jewels
      const tempCol = s.isBlackout
        ? COL_RED
        : chargeTier === 0
          ? COL_RED
          : chargeTier === 1 || isDischarging
            ? COL_AMBER
            : COL_EMERALD;
      for (let i = 0; i < 2; i++) {
        const tm = bankTempLampMatRefs.current[i];
        if (!tm) continue;
        tm.color.copy(s.isBlackout ? COL_PILOT_OFF : tempCol);
        tm.emissive.copy(s.isBlackout ? COL_BLACK : tempCol);
        tm.emissiveIntensity = (s.isBlackout ? 0.04 : 1.1) * unitCPower;
      }

      // Top Flanking GEN & SYNC Pilots
      if (genLampMatRef.current) {
        genLampMatRef.current.color.copy(genActive ? COL_AMBER : COL_PILOT_OFF);
        genLampMatRef.current.emissive.copy(genActive ? COL_AMBER : COL_BLACK);
        genLampMatRef.current.emissiveIntensity = (genActive ? 1.45 : 0.04) * unitCPower;
      }
      if (syncLampMatRef.current) {
        syncLampMatRef.current.color.copy(isSynced ? COL_GREEN : COL_PILOT_OFF);
        syncLampMatRef.current.emissive.copy(isSynced ? COL_GREEN : COL_BLACK);
        syncLampMatRef.current.emissiveIntensity = (isSynced ? 1.5 : 0.04) * unitCPower;
      }
    }

    // Subtle warning pulse on SHORTFALL or heavy net discharge without touching colors
    if (isShortfall) {
      const m = modeTileMatRefs.current[3];
      if (m) {
        const pulse = (Math.sin(t * 6.0) + 1) * 0.5;
        m.emissiveIntensity = (0.75 + pulse * 1.1) * unitCPower;
      }
    } else if (isDischarging && netFlowMW > 180) {
      const m = modeTileMatRefs.current[1];
      if (m) {
        const pulse = (Math.sin(t * 4.5) + 1) * 0.5;
        m.emissiveIntensity = (0.85 + pulse * 0.6) * unitCPower;
      }
    }

    // 5. Throttled Digital VFD MW Readout (<= 10 Hz, only when value or blackout changes)
    if (
      !s.diagFeedActive &&
      (dispatchedMW !== lastVfdMwRef.current ||
        s.isBlackout !== lastVfdBlackoutRef.current) &&
      (lastVfdDrawRef.current < 0 || t - lastVfdDrawRef.current >= 0.105)
    ) {
      lastVfdDrawRef.current = t;
      lastVfdMwRef.current = dispatchedMW;
      lastVfdBlackoutRef.current = s.isBlackout;
      const vTex = vfdTexRef.current;
      const vCanvas = vTex?.image as HTMLCanvasElement | undefined;
      const vCtx = vCanvas?.getContext("2d");
      if (vTex && vCanvas && vCtx) {
        drawVfdReadout(
          vCtx,
          vCanvas.width,
          vCanvas.height,
          dispatchedMW,
          s.isBlackout,
        );
        vTex.needsUpdate = true;
      }
    }
  });

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const g = useGameStore.getState();
    g.setHoveredDiagnosticId("grid");
    g.setHoveredControlHint(
      "BATTERY - GRID AUTO TELEMETRY (0–1000 MW / 3000 MWh): Copper busbars automatically discharge Banks A & B to supply active Unit A substation levers",
    );
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const g = useGameStore.getState();
    if (g.hoveredDiagnosticId === "grid") {
      g.setHoveredDiagnosticId(null);
    }
    g.setHoveredControlHint(null);
  };

  return (
    <group position={[0, 0.78, 0.265]} rotation={[-0.406, 0, 0]}>
      {/* Single 12-triangle hit proxy preserving 100% of existing UNIT C hover telemetry */}
      <group onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
        <mesh position={[0, 0.035, 0.078]}>
          <boxGeometry args={[1.84, 0.88, 0.11]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>

      {/* Thin 0.040m Bottom Front-Lip Vent Trim Strip (replaces the two giant dead louvered aprons) */}
      <group position={[0, -0.468, 0]}>
        <mesh position={[0, 0, 0.02]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.84, 0.04, 0.016]} />
          <meshStandardMaterial
            color="#1b2420"
            metalness={0.6}
            roughness={0.48}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        <mesh
          position={[0, 0, 0.02]}
          geometry={VENT_TRIM_LOUVERS_GEO}
          raycast={NOOP_RAYCAST}
        >
          <meshStandardMaterial color="#0e1412" metalness={0.5} roughness={0.62} />
        </mesh>
        <mesh
          position={[0, 0, 0.02]}
          geometry={VENT_TRIM_BOLTS_GEO}
          raycast={NOOP_RAYCAST}
        >
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.86}
            roughness={0.28}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>
      </group>

      {/* Main Full-Depth 3-Bay Armored Console Deck (`y: -0.405 -> +0.475`, ~85-90% of sloped surface) */}
      <group position={[0, 0.035, 0]}>
        {/* Main Armored Chassis Plate (proud >= 0.020m of recessedWell) */}
        <mesh position={[0, 0, 0.028]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.84, 0.88, 0.016]} />
          <meshStandardMaterial
            color="#1e2823"
            metalness={0.58}
            roughness={0.46}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>

        {/* Three Recessed Dark Sub-Panel Bays (`ACCUMULATOR BANK A`, `BATTERY - GRID`, `ACCUMULATOR BANK B`) */}
        {[
          { x: -0.605, w: 0.57 },
          { x: 0, w: 0.58 },
          { x: 0.605, w: 0.57 },
        ].map((bay, idx) => (
          <mesh
            key={`unitc-bay-${idx}`}
            position={[bay.x, 0, 0.043]}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[bay.w, 0.81, 0.012]} />
            <meshStandardMaterial
              color="#131a17"
              metalness={0.52}
              roughness={0.54}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
        ))}

        {/* Two Raised Vertical Steel Mullion Dividers (`x = ±0.305`) */}
        {([-0.305, 0.305] as const).map((mx, idx) => (
          <mesh
            key={`unitc-mullion-${idx}`}
            position={[mx, 0, 0.048]}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.03, 0.83, 0.018]} />
            <meshStandardMaterial
              color="#2b3832"
              metalness={0.62}
              roughness={0.44}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
        ))}

        {/* Merged Industrial Corner Brackets & Brass Hex Bolts */}
        <mesh geometry={CHASSIS_BRACKETS_GEO} raycast={NOOP_RAYCAST}>
          <meshStandardMaterial
            color="#293630"
            metalness={0.65}
            roughness={0.42}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        <mesh geometry={CHASSIS_BOLTS_GEO} raycast={NOOP_RAYCAST}>
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.86}
            roughness={0.26}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>

        {/* Crisp 'Kremlin' Sub-Panel Header Plaques (Zero Glow Blowout) */}
        {[
          { x: -0.605, w: 0.51, tex: resources.bankAHeaderTex },
          { x: 0, w: 0.53, tex: resources.centerHeaderTex },
          { x: 0.605, w: 0.51, tex: resources.bankBHeaderTex },
        ].map((hdr, idx) => (
          <group key={`unitc-hdr-${idx}`} position={[hdr.x, 0.352, 0]}>
            <mesh position={[0, 0, 0.055]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[hdr.w, 0.08, 0.01]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.8} roughness={0.32} />
            </mesh>
            <mesh position={[0, 0, 0.062]} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[hdr.w - 0.012, 0.07]} />
              <meshStandardMaterial
                map={hdr.tex}
                emissive="#ffffff"
                emissiveMap={hdr.tex}
                emissiveIntensity={0.22}
                roughness={0.72}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
          </group>
        ))}

        {/* ============================================================
            LEFT & RIGHT BAYS: ACCUMULATOR BANK A & ACCUMULATOR BANK B
            Inner 2x2 Tall Ribbed Cells + Copper Busbars | Outer 10-Seg Charge Columns
           ============================================================ */}
        {(
          [
            {
              sideSign: -1 as const,
              geos: BANK_A_GEOS,
              statusTex: resources.bankAStatusTex,
              tempLampMat: resources.bankTempLampMats[0],
            },
            {
              sideSign: 1 as const,
              geos: BANK_B_GEOS,
              statusTex: resources.bankBStatusTex,
              tempLampMat: resources.bankTempLampMats[1],
            },
          ] as const
        ).map(({ sideSign, geos, statusTex, tempLampMat }, bankIdx) => {
          const bayX = sideSign * 0.605;
          const cellCenterX = bayX - sideSign * 0.088;
          const barCenterX = bayX + sideSign * 0.194;
          return (
            <group key={`bank-bay-${bankIdx}`}>
              {/* Armored Cell Cradle Plate */}
              <mesh position={[cellCenterX, -0.022, 0.056]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.316, 0.51, 0.012]} />
                <meshStandardMaterial
                  color="#1a241f"
                  metalness={0.58}
                  roughness={0.48}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.005}
                />
              </mesh>

              {/* Tall 2x2 Olive/Gunmetal Accumulator Cells, Ribs, Ceramic Insulators, Brass Posts & Copper Busbars */}
              <mesh geometry={geos.cellBodiesGeo} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial
                  color="#31443a"
                  metalness={0.46}
                  roughness={0.44}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.006}
                />
              </mesh>
              <mesh geometry={geos.cellRibsStrapsGeo} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial
                  color="#18201c"
                  metalness={0.62}
                  roughness={0.46}
                />
              </mesh>
              <mesh geometry={geos.ceramicInsulatorsGeo} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial color="#e0dac8" metalness={0.06} roughness={0.34} />
              </mesh>
              <mesh geometry={geos.brassPostsGeo} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial
                  color="#c8a855"
                  metalness={0.88}
                  roughness={0.24}
                  bumpMap={brassTex.bumpMap}
                  bumpScale={0.004}
                />
              </mesh>
              <mesh geometry={geos.copperBusbarsGeo} raycast={NOOP_RAYCAST}>
                <meshStandardMaterial
                  color="#c87533"
                  metalness={0.9}
                  roughness={0.24}
                  bumpMap={brassTex.bumpMap}
                  bumpScale={0.003}
                />
              </mesh>

              {/* Status Badge (`CELL TEMP: NOMINAL // 500 MWH BANK`) + Status Jewel */}
              <group position={[cellCenterX + sideSign * 0.018, -0.336, 0]}>
                <mesh position={[0, 0, 0.055]} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.254, 0.072, 0.01]} />
                  <meshStandardMaterial color="#b8a46b" metalness={0.78} roughness={0.34} />
                </mesh>
                <mesh position={[0, 0, 0.062]} raycast={NOOP_RAYCAST}>
                  <planeGeometry args={[0.244, 0.062]} />
                  <meshStandardMaterial
                    map={statusTex}
                    emissive="#ffffff"
                    emissiveMap={statusTex}
                    emissiveIntensity={0.24}
                    roughness={0.7}
                    polygonOffset
                    polygonOffsetFactor={-2}
                    polygonOffsetUnits={-2}
                  />
                </mesh>
              </group>
              <group position={[cellCenterX - sideSign * 0.132, -0.336, 0.058]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
                  <cylinderGeometry args={[0.017, 0.019, 0.012, 12]} />
                  <meshStandardMaterial color="#242e29" metalness={0.72} roughness={0.38} />
                </mesh>
                <mesh position={[0, 0, 0.008]} material={tempLampMat} raycast={NOOP_RAYCAST}>
                  <sphereGeometry args={[0.011, 10, 8]} />
                </mesh>
              </group>

              {/* Tall 10-Segment Illuminated Charge Column + Tick Plate (`25% / 50% / 75% / 100%`) */}
              <group position={[barCenterX, 0, 0]}>
                <mesh position={[0, -0.032, 0.058]} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.156, 0.64, 0.016]} />
                  <meshStandardMaterial
                    color="#1a241f"
                    metalness={0.58}
                    roughness={0.48}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.005}
                  />
                </mesh>
                {/* Top Header `CHARGE %` & Bottom Tag `400V DC BUS` */}
                <mesh position={[0, 0.258, 0.068]} raycast={NOOP_RAYCAST}>
                  <planeGeometry args={[0.138, 0.034]} />
                  <meshStandardMaterial
                    map={resources.chargeHeaderTex}
                    emissive="#ffffff"
                    emissiveMap={resources.chargeHeaderTex}
                    emissiveIntensity={0.22}
                    roughness={0.72}
                    polygonOffset
                    polygonOffsetFactor={-2}
                    polygonOffsetUnits={-2}
                  />
                </mesh>
                <mesh position={[0, -0.324, 0.068]} raycast={NOOP_RAYCAST}>
                  <planeGeometry args={[0.138, 0.032]} />
                  <meshStandardMaterial
                    map={resources.bankFootTex}
                    emissive="#ffffff"
                    emissiveMap={resources.bankFootTex}
                    emissiveIntensity={0.2}
                    roughness={0.72}
                    polygonOffset
                    polygonOffsetFactor={-2}
                    polygonOffsetUnits={-2}
                  />
                </mesh>
                {/* Engraved Percentage Scale (`0% -> 100%`) */}
                <mesh position={[0.038, -0.036, 0.068]} raycast={NOOP_RAYCAST}>
                  <planeGeometry args={[0.056, 0.5]} />
                  <meshStandardMaterial
                    map={resources.chargeScaleTex}
                    emissive="#ffffff"
                    emissiveMap={resources.chargeScaleTex}
                    emissiveIntensity={0.22}
                    roughness={0.72}
                    polygonOffset
                    polygonOffsetFactor={-2}
                    polygonOffsetUnits={-2}
                  />
                </mesh>
                {/* 10 Illuminated Charge Segments (synced live across Banks A & B) */}
                {resources.chargeSegMats.map((segMat, segIdx) => (
                  <mesh
                    key={`chg-seg-${bankIdx}-${segIdx}`}
                    position={[-0.028, -0.266 + segIdx * 0.05, 0.071]}
                    material={segMat}
                    raycast={NOOP_RAYCAST}
                  >
                    <boxGeometry args={[0.066, 0.037, 0.012]} />
                  </mesh>
                ))}
              </group>
            </group>
          );
        })}

        {/* ============================================================
            CENTER BAY: BATTERY - GRID // AUTO DISPATCH
            Top: Analog Flow Meter | Mid: Copper Relay Housing | Bot: Dispatch Load + Mode Tiles
           ============================================================ */}
        <group position={[0, 0, 0]}>
          {/* TOP ZONE (`y = +0.168`): Enlarged Analog Charge / Discharge Flow Meter */}
          <group position={[0, 0.168, 0]}>
            <mesh position={[0, 0, 0.055]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.26, 0.252, 0.01]} />
              <meshStandardMaterial
                color="#1c2621"
                metalness={0.62}
                roughness={0.44}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
            {/* Cylindrical Meter Drum */}
            <mesh
              position={[0, 0, 0.068]}
              rotation={[Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.12, 0.124, 0.024, 28]} />
              <meshStandardMaterial
                color="#202a25"
                metalness={0.72}
                roughness={0.38}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
            {/* Aged-White Flow Meter Dial Face */}
            <mesh position={[0, 0, 0.082]} raycast={NOOP_RAYCAST}>
              <circleGeometry args={[0.109, 32]} />
              <meshStandardMaterial
                map={resources.flowDialTex}
                emissive="#ffffff"
                emissiveMap={resources.flowDialTex}
                emissiveIntensity={0.18}
                roughness={0.75}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
            {/* Brushed Brass Bezel Ring */}
            <mesh position={[0, 0, 0.084]} raycast={NOOP_RAYCAST}>
              <torusGeometry args={[0.114, 0.01, 12, 32]} />
              <meshStandardMaterial
                color="#c8a855"
                metalness={0.88}
                roughness={0.24}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
            {/* Physical 3D Rotating Pointer Needle */}
            <group ref={needlePivotRef} position={[0, 0, 0.086]}>
              <mesh position={[0, 0.03, 0]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.0065, 0.08, 0.003]} />
                <meshStandardMaterial color="#141414" roughness={0.35} />
              </mesh>
              <mesh position={[0, 0.072, 0.0005]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.0055, 0.022, 0.0035]} />
                <meshStandardMaterial color="#d42424" roughness={0.3} />
              </mesh>
            </group>
            {/* Brass Needle Center Cap */}
            <mesh
              position={[0, 0, 0.089]}
              rotation={[Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.015, 0.016, 0.008, 12]} />
              <meshStandardMaterial color="#c8a855" metalness={0.88} roughness={0.24} />
            </mesh>
            {/* Subtle Protective Dial Lens */}
            <mesh position={[0, 0, 0.092]} raycast={NOOP_RAYCAST}>
              <circleGeometry args={[0.109, 28]} />
              <meshStandardMaterial
                color="#d8ede4"
                transparent
                opacity={0.1}
                roughness={0.12}
                depthWrite={false}
              />
            </mesh>

            {/* Flanking GEN & SYNC Pilot Jewels */}
            {(
              [
                { x: -0.205, mat: resources.genLampMat, tex: resources.genTagTex },
                { x: 0.205, mat: resources.syncLampMat, tex: resources.syncTagTex },
              ] as const
            ).map((pilot, pIdx) => (
              <group key={`pilot-${pIdx}`} position={[pilot.x, 0, 0]}>
                <mesh
                  position={[0, 0.016, 0.058]}
                  rotation={[Math.PI / 2, 0, 0]}
                  raycast={NOOP_RAYCAST}
                >
                  <cylinderGeometry args={[0.024, 0.028, 0.014, 14]} />
                  <meshStandardMaterial color="#232d28" metalness={0.7} roughness={0.4} />
                </mesh>
                <mesh
                  position={[0, 0.016, 0.068]}
                  material={pilot.mat}
                  raycast={NOOP_RAYCAST}
                >
                  <sphereGeometry args={[0.016, 12, 10]} />
                </mesh>
                <mesh position={[0, -0.042, 0.056]} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.1, 0.032, 0.008]} />
                  <meshStandardMaterial color="#b8a46b" metalness={0.78} roughness={0.34} />
                </mesh>
                <mesh position={[0, -0.042, 0.062]} raycast={NOOP_RAYCAST}>
                  <planeGeometry args={[0.092, 0.025]} />
                  <meshStandardMaterial
                    map={pilot.tex}
                    emissive="#ffffff"
                    emissiveMap={pilot.tex}
                    emissiveIntensity={0.22}
                    roughness={0.72}
                    polygonOffset
                    polygonOffsetFactor={-2}
                    polygonOffsetUnits={-2}
                  />
                </mesh>
              </group>
            ))}
          </group>

          {/* MIDDLE ZONE (`y = -0.058`): Armored Copper Busbar / Solenoid Relay Window */}
          <group position={[0, 0, 0]}>
            <mesh position={[0, -0.058, 0.059]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.53, 0.164, 0.018]} />
              <meshStandardMaterial
                color="#1c2621"
                metalness={0.62}
                roughness={0.45}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.006}
              />
            </mesh>
            {/* Dark Inspection Cavity Background */}
            <mesh position={[0, -0.072, 0.068]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.49, 0.114, 0.006]} />
              <meshStandardMaterial color="#0c120f" metalness={0.45} roughness={0.62} />
            </mesh>
            {/* `GEN -> BAT -> GRID` Brass-Trimmed Header Strip */}
            <mesh position={[0, 0.004, 0.07]} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.48, 0.028]} />
              <meshStandardMaterial
                map={resources.relayHeaderTex}
                emissive="#ffffff"
                emissiveMap={resources.relayHeaderTex}
                emissiveIntensity={0.22}
                roughness={0.72}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>

            {/* Physical 3D Ceramic Standoffs, Copper Busbars, Knife Blades & Bakelite Yokes */}
            <mesh geometry={CENTER_RELAY_CERAMIC_GEO} raycast={NOOP_RAYCAST}>
              <meshStandardMaterial color="#dcd5c2" metalness={0.08} roughness={0.36} />
            </mesh>
            <mesh geometry={CENTER_RELAY_COPPER_GEO} raycast={NOOP_RAYCAST}>
              <meshStandardMaterial
                color="#c87533"
                metalness={0.9}
                roughness={0.24}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.003}
              />
            </mesh>
            <mesh geometry={CENTER_RELAY_YOKE_GEO} raycast={NOOP_RAYCAST}>
              <meshStandardMaterial color="#141414" metalness={0.25} roughness={0.45} />
            </mesh>

            {/* 3 Live Neon Relay Status Pill Lamps */}
            {([-0.155, 0, 0.155] as const).map((rx, rIdx) => (
              <mesh
                key={`relay-lamp-${rIdx}`}
                position={[rx, -0.032, 0.084]}
                material={resources.relayLampMats[rIdx]}
                raycast={NOOP_RAYCAST}
              >
                <boxGeometry args={[0.028, 0.012, 0.008]} />
              </mesh>
            ))}

            {/* Armored Glass Inspection Window Pane */}
            <mesh position={[0, -0.072, 0.098]} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.49, 0.114]} />
              <meshStandardMaterial
                color="#cfe6dc"
                transparent
                opacity={0.1}
                roughness={0.14}
                depthWrite={false}
              />
            </mesh>
          </group>

          {/* BOTTOM ZONE (`y = -0.278`): Vertical Dispatch Load Bargraph + Live Mode Annunciators */}
          <group position={[0, 0, 0]}>
            <mesh position={[0, -0.278, 0.056]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.53, 0.22, 0.012]} />
              <meshStandardMaterial
                color="#18211d"
                metalness={0.58}
                roughness={0.48}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>

            {/* Left Half: Digital MW VFD Readout + 10-Segment Vertical Dispatch Load Bargraph */}
            <group position={[-0.128, 0, 0]}>
              <mesh position={[0, -0.204, 0.066]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.23, 0.052, 0.01]} />
                <meshStandardMaterial color="#101613" metalness={0.62} roughness={0.44} />
              </mesh>
              <mesh position={[0, -0.204, 0.073]} raycast={NOOP_RAYCAST}>
                <planeGeometry args={[0.214, 0.042]} />
                <meshStandardMaterial
                  ref={vfdMatRef}
                  color="#1f1f1f"
                  map={resources.vfdTex}
                  emissive="#ffffff"
                  emissiveMap={resources.vfdTex}
                  emissiveIntensity={0.1}
                  roughness={0.38}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  polygonOffsetUnits={-2}
                />
              </mesh>

              {/* Vertical Bargraph Dark Well + Scale Plate */}
              <mesh position={[0, -0.308, 0.065]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.23, 0.146, 0.008]} />
                <meshStandardMaterial color="#111714" metalness={0.55} roughness={0.52} />
              </mesh>
              <mesh position={[0.056, -0.308, 0.071]} raycast={NOOP_RAYCAST}>
                <planeGeometry args={[0.09, 0.136]} />
                <meshStandardMaterial
                  map={resources.dispatchScaleTex}
                  emissive="#ffffff"
                  emissiveMap={resources.dispatchScaleTex}
                  emissiveIntensity={0.22}
                  roughness={0.72}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  polygonOffsetUnits={-2}
                />
              </mesh>

              {/* 10 Vertical Dispatch Load Segments (0-1000 MW) */}
              {resources.dispatchSegMats.map((segMat, segIdx) => (
                <mesh
                  key={`disp-seg-${segIdx}`}
                  position={[-0.046, -0.367 + segIdx * 0.013, 0.073]}
                  material={segMat}
                  raycast={NOOP_RAYCAST}
                >
                  <boxGeometry args={[0.092, 0.009, 0.008]} />
                </mesh>
              ))}
            </group>

            {/* Right Half: 4 Illuminated Live Mode Annunciator Tiles */}
            <group position={[0.128, -0.278, 0]}>
              <mesh position={[0, 0, 0.065]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.24, 0.198, 0.01]} />
                <meshStandardMaterial color="#121815" metalness={0.58} roughness={0.48} />
              </mesh>
              {resources.modeTileMats.map((tileMat, tIdx) => {
                const ty = 0.0705 - tIdx * 0.047;
                return (
                  <group key={`mode-tile-${tIdx}`} position={[0, ty, 0]}>
                    <mesh position={[0, 0, 0.073]} raycast={NOOP_RAYCAST}>
                      <boxGeometry args={[0.218, 0.039, 0.008]} />
                      <meshStandardMaterial
                        color="#1c2420"
                        metalness={0.62}
                        roughness={0.42}
                      />
                    </mesh>
                    <mesh
                      position={[0, 0, 0.0785]}
                      material={tileMat}
                      raycast={NOOP_RAYCAST}
                    >
                      <planeGeometry args={[0.206, 0.032]} />
                    </mesh>
                  </group>
                );
              })}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
});
