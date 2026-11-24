import React from "react";
import * as THREE from "three";
import { NOOP_RAYCAST } from "./ExteriorDioramas3D";
import { registerKremlinCanvasRedraw } from "./kremlinFontReady";

const WING_ROT_Y = THREE.MathUtils.degToRad(41);

const PILASTER_XS = [0.25, 2.05, 4.15, 6.2, 7.88] as const;
const SEAM_PLATE_XS = [1.15, 3.1, 5.18, 7.05] as const;
const STORY_LEDGE_YS = [0.02, -3.4, -6.8] as const;
const STEAM_PIPE_YS = [3.92, 4.16] as const;
const STEAM_BRACKET_XS = [0.35, 1.85, 3.35, 4.85, 6.35, 7.65] as const;
const BALCONY_BRACKET_XS = [1.32, 2.32, 3.32, 4.32] as const;
const FRONT_RAIL_POST_XS = [1.14, 1.82, 2.5, 3.18, 3.86, 4.5] as const;

const ICICLE_SPECS: readonly { x: number; z: number; len: number; r: number }[] = [
  { x: 1.28, z: 0.99, len: 0.24, r: 0.015 },
  { x: 1.62, z: 0.98, len: 0.16, r: 0.012 },
  { x: 1.94, z: 0.99, len: 0.31, r: 0.017 },
  { x: 2.26, z: 0.98, len: 0.19, r: 0.013 },
  { x: 2.58, z: 0.99, len: 0.28, r: 0.016 },
  { x: 2.91, z: 0.98, len: 0.14, r: 0.011 },
  { x: 3.24, z: 0.99, len: 0.34, r: 0.018 },
  { x: 3.58, z: 0.98, len: 0.21, r: 0.014 },
  { x: 3.89, z: 0.99, len: 0.27, r: 0.015 },
  { x: 4.18, z: 0.98, len: 0.15, r: 0.012 },
  { x: 4.44, z: 0.99, len: 0.29, r: 0.016 },
  { x: 5.56, z: 0.15, len: 0.2, r: 0.013 },
  { x: 6.18, z: 0.15, len: 0.26, r: 0.015 },
  { x: 6.82, z: 0.15, len: 0.18, r: 0.012 },
];

const LADDER_RUNG_YS = Array.from({ length: 18 }, (_, i) => -0.15 + i * 0.28);
const LADDER_CAGE_HOOP_YS = [2.22, 2.66, 3.1, 3.54, 3.98, 4.42] as const;
const LADDER_WALL_TIE_YS = [0.25, 1.55, 2.85, 4.15] as const;
const LADDER_DROP_RUNG_YS = [-0.62, -0.9, -1.18, -1.46] as const;
const SHEARED_BRACKET_YS = [-1.95, -2.55, -3.15, -3.75] as const;

const CIGARETTE_SPECS: readonly {
  x: number;
  y: number;
  z: number;
  rx: number;
  rz: number;
}[] = [
  { x: -0.018, y: 0.056, z: 0.012, rx: 0.42, rz: 0.38 },
  { x: 0.022, y: 0.058, z: -0.01, rx: -0.34, rz: -0.46 },
  { x: 0.0, y: 0.06, z: 0.02, rx: 0.52, rz: -0.18 },
  { x: -0.026, y: 0.054, z: -0.016, rx: -0.45, rz: 0.55 },
  { x: 0.015, y: 0.062, z: 0.004, rx: 0.22, rz: -0.62 },
  { x: -0.006, y: 0.057, z: -0.024, rx: -0.58, rz: -0.25 },
  { x: 0.028, y: 0.052, z: 0.015, rx: 0.48, rz: 0.44 },
  { x: -0.012, y: 0.061, z: 0.022, rx: 0.36, rz: -0.32 },
  { x: 0.008, y: 0.063, z: -0.012, rx: -0.3, rz: 0.28 },
];

function createNearestCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  registerFontRedraw = false,
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
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  if (registerFontRedraw) {
    registerKremlinCanvasRedraw(canvas, tex, (c, w, h) => {
      c.imageSmoothingEnabled = false;
      draw(c, w, h);
    });
  }
  return tex;
}

interface ExteriorWingResources {
  geos: {
    seamPlate: THREE.BoxGeometry;
    rivet: THREE.CylinderGeometry;
    storyLedge: THREE.BoxGeometry;
    pipeCollar: THREE.CylinderGeometry;
    pipeBracket: THREE.BoxGeometry;
    balconyBracketVert: THREE.BoxGeometry;
    balconyBracketTop: THREE.BoxGeometry;
    balconyBracketDiag: THREE.BoxGeometry;
    balconyBracketGusset: THREE.BoxGeometry;
    railPost: THREE.CylinderGeometry;
    icicle: THREE.ConeGeometry;
    ladderRung: THREE.CylinderGeometry;
    ladderRungSnow: THREE.BoxGeometry;
    ladderWallTie: THREE.BoxGeometry;
    ladderCageHoop: THREE.TorusGeometry;
    ladderCageStrap: THREE.BoxGeometry;
    shearedBracket: THREE.BoxGeometry;
    cigPaper: THREE.CylinderGeometry;
    cigFilter: THREE.CylinderGeometry;
    lampCageRing: THREE.TorusGeometry;
  };
  mats: {
    concrete: THREE.MeshStandardMaterial;
    foundation: THREE.MeshStandardMaterial;
    darkSteel: THREE.MeshStandardMaterial;
    rustSteel: THREE.MeshStandardMaterial;
    galvanizedSteel: THREE.MeshStandardMaterial;
    pipeInsulated: THREE.MeshStandardMaterial;
    hazardYellow: THREE.MeshStandardMaterial;
    snow: THREE.MeshStandardMaterial;
    icicle: THREE.MeshStandardMaterial;
    grateDeck: THREE.MeshStandardMaterial;
    corridorWindow: THREE.MeshStandardMaterial;
    steelDoor: THREE.MeshStandardMaterial;
    doorHeaderSign: THREE.MeshStandardMaterial;
    smokeBreakSign: THREE.MeshStandardMaterial;
    ladderHazardSign: THREE.MeshStandardMaterial;
    fireBucketRed: THREE.MeshStandardMaterial;
    ashBed: THREE.MeshStandardMaterial;
    cigPaper: THREE.MeshStandardMaterial;
    cigFilter: THREE.MeshStandardMaterial;
    bulkheadBulb: THREE.MeshStandardMaterial;
    brass: THREE.MeshStandardMaterial;
    sand: THREE.MeshStandardMaterial;
  };
}

let cachedWingResources: ExteriorWingResources | null = null;

function getExteriorWingResources(): ExteriorWingResources {
  if (cachedWingResources) return cachedWingResources;

  const concreteTex = createNearestCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#434b4c";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#394041";
    ctx.fillRect(4, 4, 120, 120);
    ctx.fillRect(132, 132, 120, 120);
    ctx.fillStyle = "#4b5354";
    ctx.fillRect(132, 4, 120, 120);
    ctx.fillRect(4, 132, 120, 120);
    for (let i = 0; i < 460; i++) {
      const px = (i * 53 + 17) % w;
      const py = (i * 97 + 29) % h;
      ctx.fillStyle =
        i % 5 === 0 ? "#5a6466" : i % 7 === 0 ? "#2c3334" : "#373e3f";
      ctx.fillRect(px, py, 3, 2);
    }
    for (let sx = 16; sx < w; sx += 42) {
      ctx.fillStyle = "rgba(38, 30, 24, 0.36)";
      ctx.fillRect(sx, 0, 3, 28 + (sx % 34));
      ctx.fillRect(sx + 8, 128, 3, 24 + (sx % 30));
    }
    ctx.fillStyle = "#1f2425";
    for (const tx of [20, 108, 148, 236]) {
      for (const ty of [20, 108, 148, 236]) {
        ctx.fillRect(tx - 2, ty - 2, 4, 4);
      }
    }
    ctx.strokeStyle = "#242a2b";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, w, h);
    ctx.beginPath();
    ctx.moveTo(128, 0);
    ctx.lineTo(128, h);
    ctx.moveTo(0, 128);
    ctx.lineTo(w, 128);
    ctx.stroke();
  });
  concreteTex.wrapS = THREE.RepeatWrapping;
  concreteTex.wrapT = THREE.RepeatWrapping;
  concreteTex.repeat.set(4, 3);

  const snowTex = createNearestCanvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = "#c8d9e8";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 96; i++) {
      const px = (i * 19 + 5) % w;
      const py = (i * 31 + 11) % h;
      ctx.fillStyle = i % 2 === 0 ? "#e2eef8" : "#9cb3c9";
      ctx.fillRect(px, py, 3, 2);
    }
  });
  snowTex.wrapS = THREE.RepeatWrapping;
  snowTex.wrapT = THREE.RepeatWrapping;
  snowTex.repeat.set(3, 2);

  const grateTex = createNearestCanvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = "#171c1f";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#3c322b";
    for (let x = 0; x < w; x += 8) {
      ctx.fillRect(x, 0, 2, h);
    }
    for (let y = 0; y < h; y += 8) {
      ctx.fillRect(0, y, w, 2);
    }
    ctx.fillStyle = "#5a4132";
    for (let i = 0; i < 40; i++) {
      ctx.fillRect((i * 29) % w, (i * 17) % h, 4, 3);
    }
  });
  grateTex.wrapS = THREE.RepeatWrapping;
  grateTex.wrapT = THREE.RepeatWrapping;
  grateTex.repeat.set(6, 2);

  const corridorWindowTex = createNearestCanvasTexture(192, 160, (ctx, w, h) => {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, "#121a16");
    bgGrad.addColorStop(0.45, "#2b2f21");
    bgGrad.addColorStop(0.72, "#4b4122");
    bgGrad.addColorStop(1, "#181d18");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Distant turbine hall corridor perspective silhouettes
    ctx.fillStyle = "#101613";
    ctx.fillRect(14, 18, 22, h - 24);
    ctx.fillRect(156, 18, 22, h - 24);
    ctx.fillRect(42, 44, 14, h - 54);
    ctx.fillRect(136, 44, 14, h - 54);

    // Overhead dim amber corridor lamps inside the turbine gallery
    ctx.fillStyle = "#d99d3b";
    ctx.fillRect(82, 22, 28, 8);
    ctx.fillRect(86, 52, 20, 6);
    ctx.fillStyle = "#ffd178";
    ctx.fillRect(88, 24, 16, 4);

    // Moody warm vertical floor glow down corridor center
    const glowGrad = ctx.createRadialGradient(w / 2, 76, 6, w / 2, 76, 74);
    glowGrad.addColorStop(0, "rgba(235, 168, 62, 0.42)");
    glowGrad.addColorStop(0.55, "rgba(128, 102, 42, 0.18)");
    glowGrad.addColorStop(1, "rgba(18, 26, 22, 0)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, h);

    // Pipe & valve silhouette crossing corridor
    ctx.fillStyle = "#1a221d";
    ctx.fillRect(0, 96, w, 9);
    ctx.fillRect(62, 72, 12, 54);
    ctx.fillRect(118, 68, 10, 58);

    // Frosted glass corner rime & condensation pixel stipple
    for (let i = 0; i < 240; i++) {
      const fx = (i * 37 + 11) % w;
      const fy = (i * 59 + 7) % h;
      const edgeDist = Math.min(fx, w - fx, fy, h - fy);
      if (edgeDist < 22 || i % 9 === 0) {
        ctx.fillStyle =
          i % 3 === 0
            ? "rgba(198, 226, 240, 0.36)"
            : "rgba(148, 184, 204, 0.22)";
        ctx.fillRect(fx, fy, 3, 2);
      }
    }
  });

  const steelDoorTex = createNearestCanvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = "#26322d";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#161d1a";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);

    // Heavy recessed door panels
    ctx.fillStyle = "#1f2925";
    ctx.fillRect(14, 16, w - 28, 96);
    ctx.fillRect(14, 134, w - 28, 94);
    ctx.strokeStyle = "#34443d";
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 16, w - 28, 96);
    ctx.strokeRect(14, 134, w - 28, 94);

    // Small wired-glass peephole
    ctx.fillStyle = "#141414";
    ctx.fillRect(42, 34, 44, 44);
    ctx.fillStyle = "#5c4a26";
    ctx.fillRect(47, 39, 34, 34);
    ctx.strokeStyle = "#1e2623";
    ctx.lineWidth = 1;
    for (let g = 47; g <= 81; g += 8) {
      ctx.beginPath();
      ctx.moveTo(g, 39);
      ctx.lineTo(g, 73);
      ctx.stroke();
    }

    // Rivet perimeter
    ctx.fillStyle = "#5b6962";
    for (let y = 12; y <= h - 12; y += 22) {
      ctx.fillRect(7, y, 3, 3);
      ctx.fillRect(w - 10, y, 3, 3);
    }

    // Bottom hazard stripe kickplate
    ctx.fillStyle = "#ffb000";
    ctx.fillRect(10, h - 28, w - 20, 18);
    ctx.fillStyle = "#141414";
    for (let x = 10; x < w - 10; x += 16) {
      ctx.fillRect(x, h - 28, 8, 18);
    }
  });

  const doorHeaderSignTex = createNearestCanvasTexture(
    256,
    64,
    (ctx, w, h) => {
      ctx.fillStyle = "#18221d";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#ffb000";
      ctx.lineWidth = 4;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 24px "Kremlin", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("BALCONY B-4", w / 2, 34, w - 16);
      ctx.fillStyle = "#ffb000";
      ctx.font = 'bold 15px "Courier Prime", monospace';
      ctx.fillText("AUTHORIZED PERSONNEL ONLY", w / 2, 54, w - 16);
    },
    true,
  );

  const smokeBreakSignTex = createNearestCanvasTexture(
    320,
    96,
    (ctx, w, h) => {
      ctx.fillStyle = "#23312b";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#e6dec3";
      ctx.lineWidth = 5;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = "#141414";
      ctx.fillRect(10, 10, w - 20, 28);
      ctx.fillStyle = "#ffb000";
      ctx.font = 'bold 18px "Kremlin", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("SMOKE BREAK ZONE", w / 2, 30, w - 28);
      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 22px "Courier Prime", monospace';
      ctx.fillText("MAX 30 SEC", w / 2, 66, w - 24);
      ctx.fillStyle = "#ff2a2a";
      ctx.font = 'bold 13px "Courier Prime", monospace';
      ctx.fillText("DEVIATION LOGGED BY K.O.M.R.A.D.-84", w / 2, 84, w - 24);
      // Weathered rust chips
      ctx.fillStyle = "#5c3928";
      ctx.fillRect(12, 74, 14, 6);
      ctx.fillRect(w - 28, 12, 16, 5);
    },
    true,
  );

  const ladderHazardSignTex = createNearestCanvasTexture(
    320,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = "#ffb000";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = "#141414";
      ctx.fillRect(8, 8, w - 16, 30);
      ctx.fillStyle = "#ffb000";
      ctx.font = 'bold 20px "Kremlin", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("FIRE ESCAPE", w / 2, 30, w - 24);
      ctx.fillStyle = "#141414";
      ctx.font = 'bold 18px "Courier Prime", monospace';
      ctx.fillText("LOWER RUNGS REQUISITIONED", w / 2, 66, w - 22);
      ctx.fillText("FOR FIVE-YEAR PLAN", w / 2, 92, w - 22);
      ctx.fillStyle = "#c81919";
      ctx.fillRect(14, 104, w - 28, 10);
    },
    true,
  );

  cachedWingResources = {
    geos: {
      seamPlate: new THREE.BoxGeometry(0.14, 15.8, 0.045),
      rivet: new THREE.CylinderGeometry(0.012, 0.012, 0.025, 6),
      storyLedge: new THREE.BoxGeometry(8.16, 0.16, 0.22),
      pipeCollar: new THREE.CylinderGeometry(0.068, 0.068, 0.075, 8),
      pipeBracket: new THREE.BoxGeometry(0.05, 0.1, 0.14),
      balconyBracketVert: new THREE.BoxGeometry(0.075, 0.92, 0.06),
      balconyBracketTop: new THREE.BoxGeometry(0.075, 0.06, 1.0),
      balconyBracketDiag: new THREE.BoxGeometry(0.06, 1.24, 0.065),
      balconyBracketGusset: new THREE.BoxGeometry(0.14, 0.18, 0.03),
      railPost: new THREE.CylinderGeometry(0.018, 0.018, 1.02, 6),
      icicle: new THREE.ConeGeometry(1, 1, 5),
      ladderRung: new THREE.CylinderGeometry(0.014, 0.014, 0.46, 6),
      ladderRungSnow: new THREE.BoxGeometry(0.42, 0.016, 0.024),
      ladderWallTie: new THREE.BoxGeometry(0.04, 0.04, 0.9),
      ladderCageHoop: new THREE.TorusGeometry(0.36, 0.013, 6, 14, Math.PI * 1.38),
      ladderCageStrap: new THREE.BoxGeometry(0.024, 2.34, 0.012),
      shearedBracket: new THREE.BoxGeometry(0.04, 0.04, 0.18),
      cigPaper: new THREE.CylinderGeometry(0.0045, 0.0045, 0.032, 6),
      cigFilter: new THREE.CylinderGeometry(0.0048, 0.0048, 0.014, 6),
      lampCageRing: new THREE.TorusGeometry(0.072, 0.005, 5, 12),
    },
    mats: {
      concrete: new THREE.MeshStandardMaterial({
        map: concreteTex,
        color: "#6b7375",
        emissive: "#0c141d",
        emissiveIntensity: 0.28,
        roughness: 0.92,
        metalness: 0.08,
      }),
      foundation: new THREE.MeshStandardMaterial({
        color: "#172029",
        emissive: "#070c12",
        emissiveIntensity: 0.24,
        roughness: 0.95,
        metalness: 0.08,
        fog: false,
      }),
      darkSteel: new THREE.MeshStandardMaterial({
        color: "#1e2629",
        emissive: "#070c10",
        emissiveIntensity: 0.18,
        roughness: 0.56,
        metalness: 0.72,
      }),
      rustSteel: new THREE.MeshStandardMaterial({
        color: "#4d382c",
        emissive: "#0f0906",
        emissiveIntensity: 0.16,
        roughness: 0.84,
        metalness: 0.46,
      }),
      galvanizedSteel: new THREE.MeshStandardMaterial({
        color: "#7f8c8a",
        roughness: 0.42,
        metalness: 0.74,
      }),
      pipeInsulated: new THREE.MeshStandardMaterial({
        color: "#526068",
        emissive: "#0a1118",
        emissiveIntensity: 0.2,
        roughness: 0.72,
        metalness: 0.34,
      }),
      hazardYellow: new THREE.MeshStandardMaterial({
        color: "#ffb000",
        emissive: "#382200",
        emissiveIntensity: 0.22,
        roughness: 0.52,
        metalness: 0.24,
      }),
      snow: new THREE.MeshStandardMaterial({
        map: snowTex,
        color: "#b4c8dc",
        emissive: "#162436",
        emissiveIntensity: 0.32,
        roughness: 0.88,
        metalness: 0.04,
      }),
      icicle: new THREE.MeshStandardMaterial({
        color: "#cde6f8",
        emissive: "#284c6b",
        emissiveIntensity: 0.36,
        roughness: 0.18,
        metalness: 0.12,
        transparent: true,
        opacity: 0.82,
      }),
      grateDeck: new THREE.MeshStandardMaterial({
        map: grateTex,
        color: "#735a4b",
        roughness: 0.82,
        metalness: 0.52,
      }),
      corridorWindow: new THREE.MeshStandardMaterial({
        map: corridorWindowTex,
        emissive: "#d99b3c",
        emissiveMap: corridorWindowTex,
        emissiveIntensity: 0.68,
        roughness: 0.32,
        metalness: 0.12,
      }),
      steelDoor: new THREE.MeshStandardMaterial({
        map: steelDoorTex,
        color: "#a8b4ae",
        roughness: 0.62,
        metalness: 0.52,
      }),
      doorHeaderSign: new THREE.MeshStandardMaterial({
        map: doorHeaderSignTex,
        emissive: "#302412",
        emissiveMap: doorHeaderSignTex,
        emissiveIntensity: 0.35,
        roughness: 0.48,
        metalness: 0.28,
      }),
      smokeBreakSign: new THREE.MeshStandardMaterial({
        map: smokeBreakSignTex,
        emissive: "#2c2416",
        emissiveMap: smokeBreakSignTex,
        emissiveIntensity: 0.34,
        roughness: 0.52,
        metalness: 0.26,
      }),
      ladderHazardSign: new THREE.MeshStandardMaterial({
        map: ladderHazardSignTex,
        emissive: "#3a2806",
        emissiveMap: ladderHazardSignTex,
        emissiveIntensity: 0.34,
        roughness: 0.48,
        metalness: 0.22,
      }),
      fireBucketRed: new THREE.MeshStandardMaterial({
        color: "#b8241e",
        emissive: "#260604",
        emissiveIntensity: 0.2,
        roughness: 0.46,
        metalness: 0.38,
      }),
      ashBed: new THREE.MeshStandardMaterial({
        color: "#363837",
        roughness: 0.96,
        metalness: 0.04,
      }),
      cigPaper: new THREE.MeshStandardMaterial({
        color: "#e6dec3",
        roughness: 0.85,
        metalness: 0.02,
      }),
      cigFilter: new THREE.MeshStandardMaterial({
        color: "#c8742a",
        roughness: 0.8,
        metalness: 0.02,
      }),
      bulkheadBulb: new THREE.MeshStandardMaterial({
        color: "#ffd07a",
        emissive: "#ff9224",
        emissiveIntensity: 2.0,
        roughness: 0.22,
        toneMapped: false,
      }),
      brass: new THREE.MeshStandardMaterial({
        color: "#b8a060",
        roughness: 0.32,
        metalness: 0.82,
      }),
      sand: new THREE.MeshStandardMaterial({
        color: "#b8a678",
        roughness: 0.95,
        metalness: 0.02,
      }),
    },
  };

  return cachedWingResources;
}

/**
 * Purely exterior brutalist Soviet auxiliary wing framing the left/opposite edge
 * of the Control Room panoramic window (`UNIT B` side), featuring snow-piled
 * `BALCONY B-4`, warm caged bulkhead lamp, frosted corridor window, and a
 * vertical caged fire escape ladder with missing requisitioned lower rungs.
 */
export const ExteriorFireEscapeWing3D: React.FC = React.memo(() => {
  const { geos, mats } = getExteriorWingResources();

  return (
    <group>
      {/* ============================================================
          1. FLUSH JUNCTION COLLAR & EXTERIOR STEAM TIE-IN PIPES
             Strictly worldX >= 6.14 so zero meshes enter Control Room.
         ============================================================ */}
      <mesh
        position={[6.54, 2.225, -3.33]}
        material={mats.concrete}
        castShadow={false}
        receiveShadow={false}
        raycast={NOOP_RAYCAST}
        frustumCulled={false}
      >
        <boxGeometry args={[0.8, 4.45, 2.62]} />
      </mesh>
      <mesh
        position={[6.54, -5.75, -3.33]}
        material={mats.foundation}
        castShadow={false}
        receiveShadow={false}
        raycast={NOOP_RAYCAST}
        frustumCulled={false}
      >
        <boxGeometry args={[0.8, 11.5, 2.62]} />
      </mesh>
      <mesh
        position={[6.54, 4.53, -3.33]}
        material={mats.concrete}
        castShadow={false}
        receiveShadow={false}
        raycast={NOOP_RAYCAST}
        frustumCulled={false}
      >
        <boxGeometry args={[0.84, 0.18, 2.66]} />
      </mesh>
      <mesh
        position={[6.54, 4.45, -2.01]}
        material={mats.darkSteel}
        castShadow={false}
        receiveShadow={false}
        raycast={NOOP_RAYCAST}
        frustumCulled={false}
      >
        <boxGeometry args={[0.86, 0.06, 0.08]} />
      </mesh>
      <mesh
        position={[6.54, 4.66, -3.33]}
        material={mats.snow}
        castShadow={false}
        receiveShadow={false}
        raycast={NOOP_RAYCAST}
        frustumCulled={false}
      >
        <boxGeometry args={[0.78, 0.08, 2.58]} />
      </mesh>

      {/* Insulated exterior steam pipes feeding out of Control Room wall (worldX = 6.13 -> 6.85) */}
      {STEAM_PIPE_YS.map((py, idx) => (
        <group key={`tie-pipe-${idx}`} position={[6.49, py, -2.08]}>
          <mesh
            rotation={[0, 0, Math.PI / 2]}
            material={mats.pipeInsulated}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <cylinderGeometry args={[0.056, 0.056, 0.72, 10]} />
          </mesh>
          <mesh
            position={[-0.345, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            material={mats.darkSteel}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <cylinderGeometry args={[0.092, 0.092, 0.03, 10]} />
          </mesh>
          <mesh
            position={[-0.08, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            geometry={geos.pipeCollar}
            material={mats.hazardYellow}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          />
          <mesh
            position={[0, 0.055, 0]}
            material={mats.snow}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[0.68, 0.028, 0.078]} />
          </mesh>
        </group>
      ))}

      {/* ============================================================
          2. MAIN ANGLED BRUTALIST AUXILIARY WING (rotY = +41 deg)
         ============================================================ */}
      <group position={[6.42, 0, -2.18]} rotation={[0, WING_ROT_Y, 0]}>
        {/* Main Front Facade Precast Concrete Slab (lx = 0..8.0, lz = -0.40..0) */}
        <mesh
          position={[4.0, 2.225, -0.2]}
          material={mats.concrete}
          castShadow={false}
          receiveShadow={false}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <boxGeometry args={[8.0, 4.45, 0.4]} />
        </mesh>
        <mesh
          position={[4.0, -5.75, -0.2]}
          material={mats.foundation}
          castShadow={false}
          receiveShadow={false}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <boxGeometry args={[8.0, 11.5, 0.4]} />
        </mesh>

        {/* Deep Rear Building Volume (lx = 2.6..8.0, lz = -4.0..-0.38 — clears Control Room corner) */}
        <mesh
          position={[5.3, 2.225, -2.19]}
          material={mats.concrete}
          castShadow={false}
          receiveShadow={false}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <boxGeometry args={[5.4, 4.45, 3.62]} />
        </mesh>
        <mesh
          position={[5.3, -5.75, -2.19]}
          material={mats.foundation}
          castShadow={false}
          receiveShadow={false}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <boxGeometry args={[5.4, 11.5, 3.62]} />
        </mesh>

        {/* Vertical Brutalist Concrete Pilasters */}
        {PILASTER_XS.map((px, idx) => (
          <mesh
            key={`wing-pilaster-${idx}`}
            position={[px, -3.45, 0.045]}
            material={mats.concrete}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[0.24, 15.8, 0.09]} />
          </mesh>
        ))}

        {/* Bolted Dark-Steel Panel Seam Plates & Rivet Studs */}
        {SEAM_PLATE_XS.map((sx, idx) => (
          <group key={`wing-seam-${idx}`} position={[sx, -3.45, 0.018]}>
            <mesh
              geometry={geos.seamPlate}
              material={mats.darkSteel}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            />
            {[4.2, 5.6, 6.8].map((ry, rIdx) => (
              <mesh
                key={`seam-rivet-${idx}-${rIdx}`}
                position={[0, ry, 0.025]}
                rotation={[Math.PI / 2, 0, 0]}
                geometry={geos.rivet}
                material={mats.rustSteel}
                castShadow={false}
                receiveShadow={false}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              />
            ))}
          </group>
        ))}

        {/* Horizontal Precast Story Ledges */}
        {STORY_LEDGE_YS.map((ly, idx) => (
          <mesh
            key={`story-ledge-${idx}`}
            position={[4.0, ly, 0.04]}
            geometry={geos.storyLedge}
            material={mats.concrete}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          />
        ))}

        {/* Heavy Overhanging Snow-Capped Roof Parapet & Exhaust Penthouse */}
        <mesh
          position={[4.02, 4.5, -0.14]}
          material={mats.concrete}
          castShadow={false}
          receiveShadow={false}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <boxGeometry args={[8.16, 0.24, 0.72]} />
        </mesh>
        <mesh
          position={[5.3, 4.5, -2.18]}
          material={mats.concrete}
          castShadow={false}
          receiveShadow={false}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <boxGeometry args={[5.54, 0.24, 3.74]} />
        </mesh>
        <mesh
          position={[4.02, 4.36, 0.22]}
          material={mats.darkSteel}
          castShadow={false}
          receiveShadow={false}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <boxGeometry args={[8.2, 0.06, 0.08]} />
        </mesh>
        <mesh
          position={[4.02, 4.65, -0.12]}
          material={mats.snow}
          castShadow={false}
          receiveShadow={false}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <boxGeometry args={[8.06, 0.09, 0.66]} />
        </mesh>
        <mesh
          position={[5.3, 4.65, -2.18]}
          material={mats.snow}
          castShadow={false}
          receiveShadow={false}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <boxGeometry args={[5.42, 0.09, 3.64]} />
        </mesh>
        {/* Uneven Roof Snowdrifts */}
        <mesh
          position={[2.4, 4.71, -0.02]}
          rotation={[0, 0.04, 0.03]}
          material={mats.snow}
          castShadow={false}
          receiveShadow={false}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <boxGeometry args={[2.6, 0.11, 0.36]} />
        </mesh>
        <mesh
          position={[6.2, 4.72, -0.04]}
          rotation={[0, -0.03, -0.025]}
          material={mats.snow}
          castShadow={false}
          receiveShadow={false}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <boxGeometry args={[2.9, 0.13, 0.42]} />
        </mesh>

        {/* Rooftop Mechanical Exhaust Box & Snow-Capped Vent Stack */}
        <mesh
          position={[5.2, 4.92, -1.35]}
          material={mats.darkSteel}
          castShadow={false}
          receiveShadow={false}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <boxGeometry args={[1.25, 0.56, 1.05]} />
        </mesh>
        <mesh
          position={[5.2, 5.23, -1.35]}
          material={mats.snow}
          castShadow={false}
          receiveShadow={false}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <boxGeometry args={[1.3, 0.07, 1.1]} />
        </mesh>
        <mesh
          position={[6.7, 5.15, -1.1]}
          material={mats.rustSteel}
          castShadow={false}
          receiveShadow={false}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <cylinderGeometry args={[0.18, 0.22, 1.0, 10]} />
        </mesh>
        <mesh
          position={[6.7, 5.68, -1.1]}
          material={mats.darkSteel}
          castShadow={false}
          receiveShadow={false}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <coneGeometry args={[0.3, 0.16, 10]} />
        </mesh>

        {/* Insulated Horizontal Steam Pipes Running Across Facade + Frost Caps */}
        {STEAM_PIPE_YS.map((py, pIdx) => (
          <group key={`facade-pipe-${pIdx}`} position={[3.92, py, 0.12]}>
            <mesh
              rotation={[0, 0, Math.PI / 2]}
              material={mats.pipeInsulated}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <cylinderGeometry args={[0.056, 0.056, 7.84, 10]} />
            </mesh>
            <mesh
              position={[0, 0.056, 0]}
              material={mats.snow}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <boxGeometry args={[7.76, 0.026, 0.076]} />
            </mesh>
            {STEAM_BRACKET_XS.map((bx, bIdx) => (
              <group key={`pipe-brk-${pIdx}-${bIdx}`} position={[bx - 3.92, 0, 0]}>
                <mesh
                  rotation={[0, 0, Math.PI / 2]}
                  geometry={geos.pipeCollar}
                  material={bIdx % 2 === 0 ? mats.hazardYellow : mats.darkSteel}
                  castShadow={false}
                  receiveShadow={false}
                  raycast={NOOP_RAYCAST}
                  frustumCulled={false}
                />
                <mesh
                  position={[0, 0, -0.06]}
                  geometry={geos.pipeBracket}
                  material={mats.darkSteel}
                  castShadow={false}
                  receiveShadow={false}
                  raycast={NOOP_RAYCAST}
                  frustumCulled={false}
                />
              </group>
            ))}
          </group>
        ))}

        {/* Vertical Insulated Steam Riser Near Control Room Junction */}
        <mesh
          position={[0.52, 1.4, 0.12]}
          material={mats.pipeInsulated}
          castShadow={false}
          receiveShadow={false}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <cylinderGeometry args={[0.048, 0.048, 4.85, 8]} />
        </mesh>

        {/* ============================================================
            3. FROSTED MULTI-PANE CORRIDOR WINDOW (lx = 6.25, y = 2.45)
           ============================================================ */}
        <group position={[6.25, 2.45, 0.03]}>
          {/* Glowing Frosted Turbine Corridor Backing Plane */}
          <mesh
            position={[0, 0, 0.005]}
            material={mats.corridorWindow}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <planeGeometry args={[1.9, 1.54]} />
          </mesh>
          {/* Outer Dark-Steel Window Casing */}
          <mesh
            position={[0, 0.79, 0.03]}
            material={mats.darkSteel}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[2.04, 0.08, 0.09]} />
          </mesh>
          <mesh
            position={[0, -0.79, 0.03]}
            material={mats.darkSteel}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[2.04, 0.08, 0.09]} />
          </mesh>
          <mesh
            position={[-0.98, 0, 0.03]}
            material={mats.darkSteel}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[0.08, 1.66, 0.09]} />
          </mesh>
          <mesh
            position={[0.98, 0, 0.03]}
            material={mats.darkSteel}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[0.08, 1.66, 0.09]} />
          </mesh>
          {/* 2 Vertical Mullions + 1 Horizontal Transom (6-Pane Grid) */}
          {[-0.32, 0.32].map((mx, idx) => (
            <mesh
              key={`win-mull-${idx}`}
              position={[mx, 0, 0.025]}
              material={mats.darkSteel}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <boxGeometry args={[0.045, 1.54, 0.055]} />
            </mesh>
          ))}
          <mesh
            position={[0, 0.24, 0.025]}
            material={mats.darkSteel}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[1.92, 0.045, 0.055]} />
          </mesh>
          {/* Snow-Piled Concrete Window Sill */}
          <mesh
            position={[0, -0.86, 0.08]}
            material={mats.concrete}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[2.16, 0.09, 0.22]} />
          </mesh>
          <mesh
            position={[0, -0.795, 0.1]}
            material={mats.snow}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[2.08, 0.048, 0.16]} />
          </mesh>
        </group>

        {/* ============================================================
            4. SNOW-PILED CANTILEVERED STEEL BALCONY (`BALCONY B-4`)
               lx = 1.10..4.55, lz = 0.0..1.00, deck top y = 1.05
           ============================================================ */}
        <group>
          {/* Rusted Steel Grate Platform + C-Channel Rim */}
          <mesh
            position={[2.825, 1.02, 0.5]}
            material={mats.grateDeck}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[3.45, 0.06, 1.0]} />
          </mesh>
          <mesh
            position={[2.825, 1.01, 0.99]}
            material={mats.rustSteel}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[3.49, 0.1, 0.045]} />
          </mesh>
          <mesh
            position={[1.11, 1.01, 0.5]}
            material={mats.rustSteel}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[0.045, 0.1, 1.0]} />
          </mesh>
          <mesh
            position={[4.54, 1.01, 0.5]}
            material={mats.rustSteel}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[0.045, 0.1, 1.0]} />
          </mesh>

          {/* 4 Diagonal Steel I-Beam Cantilever Brackets */}
          {BALCONY_BRACKET_XS.map((bx, idx) => (
            <group key={`balc-bracket-${idx}`} position={[bx, 0, 0]}>
              <mesh
                position={[0, 0.52, 0.045]}
                geometry={geos.balconyBracketVert}
                material={mats.rustSteel}
                castShadow={false}
                receiveShadow={false}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              />
              <mesh
                position={[0, 0.96, 0.5]}
                geometry={geos.balconyBracketTop}
                material={mats.rustSteel}
                castShadow={false}
                receiveShadow={false}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              />
              <mesh
                position={[0, 0.54, 0.48]}
                rotation={[0.74, 0, 0]}
                geometry={geos.balconyBracketDiag}
                material={mats.darkSteel}
                castShadow={false}
                receiveShadow={false}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              />
              <mesh
                position={[0, 0.12, 0.025]}
                geometry={geos.balconyBracketGusset}
                material={mats.darkSteel}
                castShadow={false}
                receiveShadow={false}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              />
            </group>
          ))}

          {/* Tubular Steel Safety Railings + Kickboard Toe-Plate */}
          <mesh
            position={[2.82, 1.13, 0.97]}
            material={mats.rustSteel}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[3.4, 0.14, 0.025]} />
          </mesh>
          <mesh
            position={[2.82, 2.04, 0.96]}
            rotation={[0, 0, Math.PI / 2]}
            material={mats.darkSteel}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <cylinderGeometry args={[0.022, 0.022, 3.4, 8]} />
          </mesh>
          <mesh
            position={[2.82, 1.56, 0.96]}
            rotation={[0, 0, Math.PI / 2]}
            material={mats.rustSteel}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <cylinderGeometry args={[0.015, 0.015, 3.4, 8]} />
          </mesh>
          {FRONT_RAIL_POST_XS.map((px, idx) => (
            <mesh
              key={`rail-post-${idx}`}
              position={[px, 1.55, 0.96]}
              geometry={geos.railPost}
              material={mats.darkSteel}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            />
          ))}

          {/* Left End Railing (lx = 1.14, lz = 0.04..0.96) */}
          <mesh
            position={[1.14, 1.55, 0.48]}
            geometry={geos.railPost}
            material={mats.darkSteel}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          />
          <mesh
            position={[1.14, 2.04, 0.5]}
            rotation={[Math.PI / 2, 0, 0]}
            material={mats.darkSteel}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <cylinderGeometry args={[0.022, 0.022, 0.94, 8]} />
          </mesh>
          <mesh
            position={[1.14, 1.56, 0.5]}
            rotation={[Math.PI / 2, 0, 0]}
            material={mats.rustSteel}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <cylinderGeometry args={[0.015, 0.015, 0.94, 8]} />
          </mesh>

          {/* Right Partial Guard Rail (leaving opening for fire escape ladder at lz > 0.55) */}
          <mesh
            position={[4.5, 1.55, 0.48]}
            geometry={geos.railPost}
            material={mats.darkSteel}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          />
          <mesh
            position={[4.5, 2.04, 0.26]}
            rotation={[Math.PI / 2, 0, 0]}
            material={mats.darkSteel}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <cylinderGeometry args={[0.022, 0.022, 0.48, 8]} />
          </mesh>

          {/* 3D Balcony Snowdrifts (Floor Corners, Kickboard Berm & Railing Tops) */}
          <mesh
            position={[1.38, 1.11, 0.72]}
            rotation={[0, 0.14, 0]}
            material={mats.snow}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[0.52, 0.12, 0.48]} />
          </mesh>
          <mesh
            position={[1.28, 1.17, 0.84]}
            material={mats.snow}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[0.3, 0.1, 0.24]} />
          </mesh>
          <mesh
            position={[2.95, 1.09, 0.86]}
            rotation={[0, -0.04, 0]}
            material={mats.snow}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[1.45, 0.08, 0.2]} />
          </mesh>
          <mesh
            position={[4.15, 1.12, 0.78]}
            rotation={[0, -0.18, 0]}
            material={mats.snow}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[0.65, 0.14, 0.34]} />
          </mesh>
          <mesh
            position={[2.0, 2.075, 0.96]}
            material={mats.snow}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[1.22, 0.036, 0.052]} />
          </mesh>
          <mesh
            position={[3.88, 2.075, 0.96]}
            material={mats.snow}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[0.98, 0.038, 0.052]} />
          </mesh>
          <mesh
            position={[1.14, 2.075, 0.5]}
            material={mats.snow}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[0.052, 0.034, 0.82]} />
          </mesh>

          {/* Hanging Icicles Under Balcony Lip & Corridor Window Sill */}
          {ICICLE_SPECS.map((ic, idx) => (
            <mesh
              key={`icicle-${idx}`}
              position={[
                ic.x,
                (ic.z > 0.5 ? 0.96 : 1.57) - ic.len * 0.5,
                ic.z,
              ]}
              rotation={[Math.PI, 0, 0]}
              scale={[ic.r, ic.len, ic.r]}
              geometry={geos.icicle}
              material={mats.icicle}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            />
          ))}

          {/* Sealed Exterior Steel Hatch Door + Hood + BALCONY B-4 Stencil */}
          <group position={[2.25, 2.09, 0.03]}>
            <mesh
              position={[0, 0, 0.015]}
              material={mats.darkSteel}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <boxGeometry args={[1.14, 2.12, 0.07]} />
            </mesh>
            <mesh
              position={[0, 0, 0.054]}
              material={mats.steelDoor}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[1.02, 2.02]} />
            </mesh>
            {/* Heavy Latch Wheel / Locking Handle & Hinges */}
            <mesh
              position={[0.36, -0.04, 0.072]}
              material={mats.rustSteel}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <boxGeometry args={[0.06, 0.22, 0.035]} />
            </mesh>
            <mesh
              position={[0.3, -0.04, 0.095]}
              material={mats.brass}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <boxGeometry args={[0.16, 0.032, 0.025]} />
            </mesh>
            {[-0.65, 0.0, 0.65].map((hy, hIdx) => (
              <mesh
                key={`door-hinge-${hIdx}`}
                position={[-0.52, hy, 0.062]}
                material={mats.darkSteel}
                castShadow={false}
                receiveShadow={false}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <cylinderGeometry args={[0.02, 0.02, 0.14, 6]} />
              </mesh>
            ))}
            {/* Sloped Rain Hood & Snow Cap */}
            <mesh
              position={[0, 1.04, 0.14]}
              rotation={[0.28, 0, 0]}
              material={mats.rustSteel}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <boxGeometry args={[1.26, 0.04, 0.34]} />
            </mesh>
            <mesh
              position={[0, 1.07, 0.14]}
              rotation={[0.28, 0, 0]}
              material={mats.snow}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <boxGeometry args={[1.2, 0.045, 0.3]} />
            </mesh>
            {/* BALCONY B-4 Stencil Plate */}
            <mesh
              position={[0, 1.2, 0.05]}
              material={mats.doorHeaderSign}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[0.92, 0.22]} />
            </mesh>
          </group>

          {/* Warm-Amber Caged Bulkhead Lamp (Constant Static Intensity = 0.8) */}
          <group position={[2.25, 3.58, 0.11]}>
            <mesh
              material={mats.darkSteel}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <boxGeometry args={[0.18, 0.22, 0.08]} />
            </mesh>
            <mesh
              position={[0, -0.02, 0.055]}
              material={mats.bulkheadBulb}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <sphereGeometry args={[0.062, 10, 8]} />
            </mesh>
            <mesh
              position={[0, -0.02, 0.062]}
              geometry={geos.lampCageRing}
              material={mats.darkSteel}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            />
            <mesh
              position={[0, -0.02, 0.062]}
              rotation={[0, Math.PI / 2, 0]}
              geometry={geos.lampCageRing}
              material={mats.darkSteel}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            />
            <mesh
              position={[0, -0.02, 0.062]}
              rotation={[Math.PI / 2, 0, 0]}
              geometry={geos.lampCageRing}
              material={mats.darkSteel}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            />
            <pointLight
              position={[0, -0.1, 0.34]}
              color="#ff9b38"
              intensity={0.8}
              distance={7}
              decay={2}
              castShadow={false}
            />
          </group>

          {/* Soviet Comedy Prop 1: Frosted Conical Red Fire-Sand Bucket */}
          <group position={[1.52, 1.24, 0.72]}>
            <mesh
              rotation={[Math.PI, 0, 0]}
              material={mats.fireBucketRed}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <coneGeometry args={[0.145, 0.36, 12]} />
            </mesh>
            <mesh
              position={[0, 0.18, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              material={mats.darkSteel}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <torusGeometry args={[0.145, 0.009, 6, 14]} />
            </mesh>
            <mesh
              position={[0, 0.17, 0]}
              material={mats.sand}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <cylinderGeometry args={[0.13, 0.11, 0.04, 12]} />
            </mesh>
            <mesh
              position={[0.04, 0.195, 0.02]}
              material={mats.snow}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <boxGeometry args={[0.16, 0.032, 0.14]} />
            </mesh>
          </group>

          {/* Soviet Comedy Prop 2: Overflowing Galvanized Cigarette-Butt Tin */}
          <group position={[3.26, 1.51, 0.89]}>
            <mesh
              position={[0, 0, 0.05]}
              material={mats.darkSteel}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <boxGeometry args={[0.04, 0.06, 0.06]} />
            </mesh>
            <mesh
              material={mats.galvanizedSteel}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <cylinderGeometry args={[0.065, 0.058, 0.14, 10]} />
            </mesh>
            <mesh
              position={[0, 0.052, 0]}
              material={mats.ashBed}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <cylinderGeometry args={[0.058, 0.058, 0.025, 10]} />
            </mesh>
            {CIGARETTE_SPECS.map((cig, idx) => (
              <group
                key={`cig-${idx}`}
                position={[cig.x, cig.y, cig.z]}
                rotation={[cig.rx, 0, cig.rz]}
              >
                <mesh
                  geometry={geos.cigPaper}
                  material={mats.cigPaper}
                  castShadow={false}
                  receiveShadow={false}
                  raycast={NOOP_RAYCAST}
                  frustumCulled={false}
                />
                <mesh
                  position={[0, 0.016, 0]}
                  geometry={geos.cigFilter}
                  material={mats.cigFilter}
                  castShadow={false}
                  receiveShadow={false}
                  raycast={NOOP_RAYCAST}
                  frustumCulled={false}
                />
              </group>
            ))}
          </group>

          {/* Soviet Comedy Prop 3: Weathered Stencil Sign Facing Window 1 */}
          <group position={[2.86, 1.72, 1.0]} rotation={[0, 0, 0.025]}>
            <mesh
              material={mats.darkSteel}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <boxGeometry args={[0.92, 0.28, 0.02]} />
            </mesh>
            <mesh
              position={[0, 0, 0.014]}
              material={mats.smokeBreakSign}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[0.88, 0.25]} />
            </mesh>
          </group>
        </group>

        {/* ============================================================
            5. VERTICAL SOVIET CAGED FIRE ESCAPE LADDER (lx = 4.72, lz = 0.90)
           ============================================================ */}
        <group position={[4.72, 0, 0.9]}>
          {/* Twin Vertical Stringer Rails */}
          {[-0.23, 0.23].map((rx, idx) => (
            <group key={`ladder-rail-${idx}`} position={[rx, 0, 0]}>
              <mesh
                position={[0, 2.2, 0]}
                material={mats.rustSteel}
                castShadow={false}
                receiveShadow={false}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <boxGeometry args={[0.036, 5.1, 0.056]} />
              </mesh>
              {/* Gooseneck Parapet Return Back to Roof */}
              <mesh
                position={[0, 4.74, -0.5]}
                material={mats.rustSteel}
                castShadow={false}
                receiveShadow={false}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <boxGeometry args={[0.036, 0.056, 1.02]} />
              </mesh>
              <mesh
                position={[0, 4.55, -0.98]}
                material={mats.rustSteel}
                castShadow={false}
                receiveShadow={false}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <boxGeometry args={[0.036, 0.38, 0.056]} />
              </mesh>
            </group>
          ))}

          {/* Wall-Tie Standoff Struts */}
          {LADDER_WALL_TIE_YS.map((ty, tIdx) => (
            <group key={`ladder-tie-${tIdx}`} position={[0, ty, -0.45]}>
              <mesh
                position={[-0.23, 0, 0]}
                geometry={geos.ladderWallTie}
                material={mats.darkSteel}
                castShadow={false}
                receiveShadow={false}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              />
              <mesh
                position={[0.23, 0, 0]}
                geometry={geos.ladderWallTie}
                material={mats.darkSteel}
                castShadow={false}
                receiveShadow={false}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              />
            </group>
          ))}

          {/* 18 Horizontal Snow-Dusted Steel Rungs */}
          {LADDER_RUNG_YS.map((ry, rIdx) => (
            <group key={`ladder-rung-${rIdx}`} position={[0, ry, 0]}>
              <mesh
                rotation={[0, 0, Math.PI / 2]}
                geometry={geos.ladderRung}
                material={mats.galvanizedSteel}
                castShadow={false}
                receiveShadow={false}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              />
              <mesh
                position={[0, 0.014, 0]}
                geometry={geos.ladderRungSnow}
                material={mats.snow}
                castShadow={false}
                receiveShadow={false}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              />
            </group>
          ))}

          {/* Safety-Hoop Cage Rings (Chest-High Above Balcony -> Roof) */}
          {LADDER_CAGE_HOOP_YS.map((hy, hIdx) => (
            <group
              key={`cage-hoop-${hIdx}`}
              position={[0, hy, 0.24]}
              rotation={[0, Math.PI * 0.19, 0]}
            >
              <mesh
                rotation={[Math.PI / 2, 0, 0]}
                geometry={geos.ladderCageHoop}
                material={mats.darkSteel}
                castShadow={false}
                receiveShadow={false}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              />
            </group>
          ))}

          {/* 5 Vertical Cage Straps Joining Safety Hoops */}
          {[-0.85, -0.42, 0, 0.42, 0.85].map((ang, sIdx) => (
            <mesh
              key={`cage-strap-${sIdx}`}
              position={[Math.sin(ang) * 0.36, 3.35, 0.24 + Math.cos(ang) * 0.36]}
              rotation={[0, ang, 0]}
              geometry={geos.ladderCageStrap}
              material={mats.rustSteel}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            />
          ))}

          {/* Hinged / Retracted Lower Drop-Section Below Balcony */}
          <group position={[0, -0.35, 0]} rotation={[0, 0, 0.24]}>
            {[-0.23, 0.23].map((rx, idx) => (
              <mesh
                key={`drop-rail-${idx}`}
                position={[rx, -0.62, 0]}
                material={mats.rustSteel}
                castShadow={false}
                receiveShadow={false}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <boxGeometry args={[0.036, 1.24, 0.056]} />
              </mesh>
            ))}
            {LADDER_DROP_RUNG_YS.map((dy, dIdx) => (
              <mesh
                key={`drop-rung-${dIdx}`}
                position={[0, dy + 0.35, 0]}
                rotation={[0, 0, Math.PI / 2]}
                geometry={geos.ladderRung}
                material={mats.galvanizedSteel}
                castShadow={false}
                receiveShadow={false}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              />
            ))}
            <mesh
              position={[0.3, -0.22, 0]}
              material={mats.darkSteel}
              castShadow={false}
              receiveShadow={false}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <boxGeometry args={[0.12, 0.18, 0.12]} />
            </mesh>
          </group>

          {/* Empty Sheared Ladder Brackets Lower Down the Concrete Wall */}
          {SHEARED_BRACKET_YS.map((sy, idx) => (
            <group key={`sheared-brk-${idx}`} position={[0, sy, -0.82]}>
              <mesh
                position={[-0.23, 0, 0]}
                geometry={geos.shearedBracket}
                material={mats.rustSteel}
                castShadow={false}
                receiveShadow={false}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              />
              <mesh
                position={[0.23, 0, 0]}
                geometry={geos.shearedBracket}
                material={mats.rustSteel}
                castShadow={false}
                receiveShadow={false}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              />
            </group>
          ))}
        </group>

        {/* Crooked Hazard Sign Beside Ladder Break */}
        <group position={[4.12, 0.56, 1.03]} rotation={[0, 0, -0.09]}>
          <mesh
            material={mats.darkSteel}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[0.96, 0.38, 0.022]} />
          </mesh>
          <mesh
            position={[0, 0, 0.015]}
            material={mats.ladderHazardSign}
            castShadow={false}
            receiveShadow={false}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <planeGeometry args={[0.92, 0.35]} />
          </mesh>
        </group>
      </group>
    </group>
  );
});
