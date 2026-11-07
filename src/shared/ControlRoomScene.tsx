import { useGLTF } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import * as InspectorModule from "../modules/inspector";
import {
  playRheostatDetentClick,
  playSteamVentHiss,
} from "../modules/inspector/audio";
import {
  playLeverRatchet,
  playSwitchClank,
} from "../modules/reactor/audioSynth";
import { TerminalStation3D } from "../modules/terminal";
import { BuckshotDitherPass } from "./BuckshotDitherPass";
import { CameraController, useCameraLookStore } from "./CameraController";
import {
  CagedSovietJewelLamp3D,
  HighDetailKnifeBreaker3D,
  HighDetailManometer3D,
  HighDetailReactorPanel3D,
  LeftRearWrapAroundPanel3D,
} from "./MechanicalPanels3D";
import {
  applySovietPBRToHierarchy,
  getBrushedBrassTextures,
  getHammeredIronTextures,
} from "./proceduralMaterials";
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
  tex.anisotropy = 8;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
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

function formatClock(minutes: number): string {
  const clamped = Math.max(0, Math.min(360, Math.floor(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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
 * 3D Overhead Bulkhead Telemetry Board & 3D Camera Station Selector Rail
 */
const BunkerTelemetryAndControlRail3D: React.FC = () => {
  const headerMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const headerTexture = useMemo(() => createNearestCanvasTexture(768, 96), []);
  const breakerArmRef = useRef<THREE.Group>(null);
  const breakerDragRef = useRef<{
    active: boolean;
    startY: number;
    progress: number;
  }>({ active: false, startY: 0, progress: 0 });

  const breakerPlateTex = useMemo(
    () =>
      createNearestCanvasTexture(144, 40, (ctx, w, h) => {
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#ff2a2a";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 15px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("MAIN BREAKER", w / 2, 25);
      }),
    [],
  );

  useFrame(() => {
    const s = useGameStore.getState();

    if (breakerArmRef.current) {
      const targetProgress = breakerDragRef.current.active
        ? breakerDragRef.current.progress
        : s.phase === "playing"
          ? 1
          : 0;
      const targetRotX = -0.55 + targetProgress * 1.1;
      breakerArmRef.current.rotation.x = THREE.MathUtils.lerp(
        breakerArmRef.current.rotation.x,
        targetRotX,
        0.25,
      );
    }

    const isFreeLookMode = useCameraLookStore.getState().isFreeLookMode;
    const sig = `${s.phase}|${s.shiftNumber}|${Math.floor(s.shiftTimeMinutes)}|${Math.round(s.coreTemp)}|${s.treasonStrikes}|${s.isShiftKeyHeld}|${s.isGodMode}|${isFreeLookMode}|${s.lastDecisionFeedback ?? ""}`;
    const hTex = headerMatRef.current?.map as THREE.CanvasTexture | undefined;
    if (hTex && hTex.userData.lastSig !== sig) {
      hTex.userData.lastSig = sig;
      const hCanvas = hTex.image as HTMLCanvasElement;
      const ctx = hCanvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, 768, 96);
        ctx.strokeStyle = "#364940";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 764, 92);

        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 20px "Kremlin", monospace';
        ctx.textAlign = "left";
        ctx.fillText(
          "MELTDOWN IS PROPAGANDA // SECTOR 84",
          18,
          30,
        );

        ctx.fillStyle = isFreeLookMode ? "#ffb000" : "#33ff66";
        ctx.font = 'bold 19px "VT323", monospace';
        ctx.textAlign = "right";
        ctx.fillText(
          isFreeLookMode
            ? "[L-CTRL] MODE: FREE-LOOK // ОБЗОР"
            : "[L-CTRL] MODE: CURSOR // КУРСОР",
          750,
          30,
        );
        ctx.textAlign = "left";

        ctx.fillStyle = s.coreTemp >= 750 ? "#ff2a2a" : "#33ff66";
        ctx.font = 'bold 22px "VT323", monospace';
        ctx.fillText(
          `SHIFT: ${s.shiftNumber}/5 | CLOCK: ${formatClock(s.shiftTimeMinutes)}/${s.isGodMode ? "INF (SANDBOX)" : "06:00"} | CORE: ${Math.round(s.coreTemp)}C | STRIKES: ${s.treasonStrikes}/3 | [SHIFT]: ${s.isShiftKeyHeld ? "ENGAGED" : "LOCKED"}`,
          18,
          58,
        );

        ctx.fillStyle = "#e6dec3";
        ctx.font = '18px "VT323", monospace';
        const statusLine =
          s.phase === "boot"
            ? "PRESS [SPACE] TO START SHIFT — OR [SHIFT+SPACE] FOR ENDLESS NO-FAIL SANDBOX!"
            : s.phase !== "playing"
              ? `SHIFT ENDED (${s.phase.toUpperCase()}) — PRESS [SPACE] OR [SHIFT+SPACE] TO RESET!`
              : (s.lastDecisionFeedback ??
                "CAMERA: [1-5] STATION ZOOM | [0/ESC] CHAIR | [L-CTRL] FREE-LOOK/CURSOR | [SHIFT+SPACE] SANDBOX");
        ctx.fillText(statusLine.slice(0, 88), 18, 84);
        hTex.needsUpdate = true;
      }
    }
  });

  const [auxToggles, setAuxToggles] = useState<[boolean, boolean, boolean, boolean]>([
    true,
    true,
    false,
    false,
  ]);
  const steamLeverArmRef = useRef<THREE.Group>(null);
  const steamDragRef = useRef<{
    active: boolean;
    startY: number;
    progress: number;
    lastHissTime: number;
  }>({ active: false, startY: 0, progress: 0, lastHissTime: 0 });

  const rheostatWheelRef = useRef<THREE.Group>(null);
  const rheostatDragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startTrim: number;
    lastDetent: number;
  }>({ active: false, startX: 0, startY: 0, startTrim: 0, lastDetent: 0 });

  const toggleDragRef = useRef<{
    activeIdx: number | null;
    startY: number;
  }>({ activeIdx: null, startY: 0 });
  const toggleBatRefs = useRef<Array<THREE.Group | null>>([]);
  const toggleLampRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const rightStatusMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const steamPlateTex = useMemo(
    () =>
      createCrispPanelTexture(224, 56, (ctx, w, h) => {
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#ff2a2a";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#ff2a2a";
        ctx.font = 'bold 20px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("STEAM VENT", w / 2, 24);
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 16px "VT323", monospace';
        ctx.fillText("HOLD: VENT PRESSURE", w / 2, 46);
      }),
    [],
  );

  const rheostatPlateTex = useMemo(
    () =>
      createCrispPanelTexture(224, 56, (ctx, w, h) => {
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#33ff66";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#33ff66";
        ctx.font = 'bold 18px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("50HZ RHEOSTAT", w / 2, 24);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 16px "VT323", monospace';
        ctx.fillText("DRAG: TRIM 50.0 HZ", w / 2, 46);
      }),
    [],
  );

  const toggleSpecs = useMemo(() => {
    const items = [
      { id: 0, label: "VENTILATION", sub: "-1.2 R/H (+10MW)", color: "#33ff66" },
      { id: 1, label: "AUDIO [M]", sub: "BUNKER SOUND", color: "#ffb000" },
      { id: 2, label: "KGB CIPHER", sub: "DECODE DIRECTIVES", color: "#33ff66" },
      { id: 3, label: "AUX LOOP B", sub: "TURBINE BYPASS", color: "#ffb000" },
    ];
    return items.map((item) => ({
      ...item,
      texture: createCrispPanelTexture(192, 52, (ctx, w, h) => {
        ctx.fillStyle = "#141816";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = item.color;
        ctx.font = 'bold 16px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText(item.label, w / 2, 22);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 15px "VT323", monospace';
        ctx.fillText(item.sub, w / 2, 42);
      }),
    }));
  }, []);

  const rightPanelGroupRef = useRef<THREE.Group>(null);
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  // Load High-Detail Soviet `.glb` Mainframe Hardware from `public/models/`
  const terminalHousingGltf = useGLTF("./models/komrad_terminal_housing.glb");

  const terminalHousingModel = useMemo(() => {
    const cloned = terminalHousingGltf.scene.clone(true);
    applySovietPBRToHierarchy(cloned);
    return cloned;
  }, [terminalHousingGltf.scene]);

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
        ctx.font = 'bold 20px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("50.0 HZ", cx, 42);
      }),
    [],
  );

  useEffect(() => {
    applySovietPBRToHierarchy(rightPanelGroupRef.current);
  }, []);

  const rightHeaderPlateTex = useMemo(
    () =>
      createNearestCanvasTexture(512, 72, (ctx, w, h) => {
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 21px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("TURBINE & 50HZ GRID PANEL // UNIT B", w / 2, 30);
        ctx.fillStyle = "#33ff66";
        ctx.font = 'bold 17px "VT323", monospace';
        ctx.fillText("TURBINE NO. 1 • 50HZ EXCITATION • MAIN BREAKER", w / 2, 56);
      }),
    [],
  );

  const rightStatusTex = useMemo(() => createNearestCanvasTexture(512, 96), []);

  const pushButtonSpecs = useMemo(() => {
    const items = [
      { id: 0, label: "AUX COOLING", sub: "ОХЛАЖД. БЛОКА", color: "#33ff66" },
      { id: 1, label: "BUNKER VENT", sub: "ВЕНТИЛЯЦИЯ", color: "#33ff66" },
      { id: 2, label: "KGB CIPHER", sub: "СВЯЗЬ КГБ", color: "#ffb000" },
      { id: 3, label: "EMERG DUMP", sub: "АВАР. СБРОС", color: "#ff2a2a" },
      { id: 4, label: "MUTE SOUND", sub: "АУДИО [M]", color: "#ffb000" },
    ];
    return items.map((item) => ({
      ...item,
      texture: createCrispPanelTexture(256, 112, (ctx, w, h) => {
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 5;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        ctx.fillStyle = item.color;
        ctx.font = 'bold 22px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText(item.label, w / 2, 46);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 26px "VT323", monospace';
        ctx.fillText(item.sub, w / 2, 86);
      }),
    }));
  }, []);

  useFrame(({ clock }) => {
    const s = useGameStore.getState();
    const t = clock.getElapsedTime();
    const totalMW =
      s.powerAllocation.cooling +
      s.powerAllocation.defense +
      s.powerAllocation.facility +
      (s.ventilationActive ? 10 : 0);

    // 1. Animate Spring-Loaded Steam Relief Lever (`СБРОС ПАРА`)
    if (steamLeverArmRef.current) {
      const targetProg = steamDragRef.current.active
        ? steamDragRef.current.progress
        : 0;
      const steamShake =
        s.ventingSteam && targetProg > 0.35
          ? Math.sin(t * 52) * 0.035
          : 0;
      const targetAngleX = -0.52 + targetProg * 1.12 + steamShake;
      steamLeverArmRef.current.rotation.x = THREE.MathUtils.lerp(
        steamLeverArmRef.current.rotation.x,
        targetAngleX,
        steamDragRef.current.active ? 0.32 : 0.22,
      );
      if (
        s.ventingSteam &&
        t - steamDragRef.current.lastHissTime > 0.16
      ) {
        steamDragRef.current.lastHissTime = t;
        playSteamVentHiss(targetProg);
      }
    }

    // 2. Animate Rotary Generator Excitation Rheostat Wheel (`ВОЗБУЖДЕНИЕ 50 ГЦ`)
    if (rheostatWheelRef.current) {
      const targetRotZ = -(s.excitationTrim / 5.0) * (Math.PI * 0.85);
      rheostatWheelRef.current.rotation.z = THREE.MathUtils.lerp(
        rheostatWheelRef.current.rotation.z,
        targetRotZ,
        0.25,
      );
    }

    // 3. Animate Guarded Metal Toggle Bats (+35° / -35°) & Caged Jewel Lamps
    const toggleStates = [
      s.ventilationActive,
      !s.isMusicMuted,
      s.kgbLineActive,
      auxToggles[3],
    ];
    for (let i = 0; i < 4; i++) {
      const bat = toggleBatRefs.current[i];
      const isOn = toggleStates[i] ?? false;
      if (bat) {
        const targetRotX = isOn ? -0.61 : 0.61; // +/- 35 degrees
        bat.rotation.x = THREE.MathUtils.lerp(bat.rotation.x, targetRotX, 0.28);
      }
      const lampMat = toggleLampRefs.current[i];
      if (lampMat) {
        const activeCol = i === 1 || i === 3 ? "#ffb000" : "#33ff66";
        lampMat.color.set(isOn ? activeCol : "#1c2621");
        lampMat.emissive.set(isOn ? activeCol : "#000000");
        lampMat.emissiveIntensity = isOn ? 1.45 : 0.05;
      }
    }

    // Update Right Control Panel Digital Telemetry Strip
    const rSig = `${s.phase}|${totalMW}|${Math.round(s.pressureBar)}|${s.turbineRpm}|${s.gridHz.toFixed(1)}|${s.ventingSteam}|${s.ventilationActive}|${s.kgbLineActive}|${s.isMusicMuted}|${Math.round(s.bubblerLevel)}|${s.containmentSealLocked}|${s.activeMandate?.id ?? "NONE"}|${auxToggles.join(",")}`;
    const rTex = rightStatusMatRef.current?.map as THREE.CanvasTexture | undefined;
    if (rTex && rTex.userData.lastSig !== rSig) {
      rTex.userData.lastSig = rSig;
      const canvas = rTex.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#061a0c";
        ctx.fillRect(0, 0, 512, 96);
        ctx.strokeStyle = "#364940";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 508, 92);

        const hzDanger = s.gridHz < 46.5 || s.gridHz > 53.5;
        ctx.fillStyle = hzDanger ? "#ff2a2a" : s.phase === "playing" ? "#33ff66" : "#ffb000";
        ctx.font = 'bold 21px "VT323", monospace';
        ctx.fillText(
          `TURBINE: ${s.turbineRpm} RPM | GRID: ${s.gridHz.toFixed(1)} HZ | LOAD: ${totalMW} MW`,
          14,
          34,
        );
        const bubblerFlooded = s.bubblerLevel > 90;
        ctx.fillStyle = s.ventingSteam || bubblerFlooded || !s.containmentSealLocked ? "#ff2a2a" : "#ffb000";
        const steamStatus = s.ventingSteam
          ? bubblerFlooded
            ? "BLOCKED (BUBBLER)"
            : "VENTING!"
          : `${Math.round(s.pressureBar)} BAR`;
        ctx.fillText(
          `STEAM: ${steamStatus} | VENT: ${s.ventilationActive ? "ON (+10MW)" : "OFF"} | SEAL: ${s.containmentSealLocked ? "LOCKED" : "OPEN!"}`,
          14,
          62,
        );
        ctx.fillStyle = s.activeMandate ? "#33ff66" : "#e6dec3";
        ctx.font = 'bold 14px "Courier Prime", monospace';
        ctx.fillText(
          s.activeMandate
            ? `MANDATE: ${s.activeMandate.requirementText}`
            : "TURN 50HZ RHEOSTAT • PULL STEAM VENT (LEFT) • MAIN BREAKER (RIGHT)",
          14,
          85,
        );
        rTex.needsUpdate = true;
      }
    }
  });

  return (
    <>
      {/* Overhead Bulkhead Telemetry Marquee (Pulled forward directly above the closer K.O.M.R.A.D.-84 CRT terminal) */}
      <group position={[0, 2.48, 0.48]} rotation={[0.16, 0, 0]}>
        <mesh>
          <boxGeometry args={[2.56, 0.34, 0.08]} />
          <meshStandardMaterial
            color="#141414"
            roughness={0.75}
            metalness={0.5}
          />
        </mesh>
        <mesh position={[0, 0, 0.042]}>
          <planeGeometry args={[2.48, 0.3]} />
          <meshStandardMaterial
            ref={headerMatRef}
            map={headerTexture}
            color="#ffffff"
            emissive="#ffffff"
            emissiveMap={headerTexture}
            emissiveIntensity={0.68}
            roughness={0.85}
          />
        </mesh>
      </group>

      {/* ============================================================
          3. NEW RIGHT-SIDE SOVIET CONTROL PANEL WING (<RightControlPanel3D />)
          Positioned at a TRUE 90° angle on the operator's RIGHT SIDE
          (x: +1.96, z: 2.35, rotation.y = -Math.PI / 2 = -90° directly facing the chair!)
         ============================================================ */}
      <group
        ref={rightPanelGroupRef}
        position={[2.12, 0.0, 2.35]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[1.14, 1.1, 1.12]}
      >
        {/* Main Right-Wing Steel Cabinet Body (Mirrors Left ReactorStation3D) */}
        <mesh position={[0, 1.12, -0.18]} castShadow receiveShadow>
          <boxGeometry args={[1.66, 2.24, 0.42]} />
          <meshStandardMaterial
            color="#23312b"
            roughness={0.45}
            metalness={0.65}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        <mesh position={[0, 1.12, -0.22]} castShadow receiveShadow>
          <boxGeometry args={[1.74, 2.32, 0.36]} />
          <meshStandardMaterial
            color="#141414"
            roughness={0.5}
            metalness={0.6}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>

        {/* Heavy Stepped Bevel Plates, Welded Seams, Corner L-Angle Iron Trim & Hex Bolts */}
        <mesh position={[-0.84, 1.12, 0.032]} castShadow receiveShadow>
          <boxGeometry args={[0.042, 2.26, 0.036]} />
          <meshStandardMaterial
            color="#18211b"
            metalness={0.7}
            roughness={0.42}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        <mesh position={[0.84, 1.12, 0.032]} castShadow receiveShadow>
          <boxGeometry args={[0.042, 2.26, 0.036]} />
          <meshStandardMaterial
            color="#18211b"
            metalness={0.7}
            roughness={0.42}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        {[0.32, 0.76, 1.28, 1.64, 2.04].map((by, bIdx) => (
          <group key={bIdx}>
            <mesh
              position={[-0.84, by, 0.054]}
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
              position={[0.84, by, 0.054]}
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

        {/* Top Riveted Header Plaque: TURBINE & 50HZ GRID PANEL (Raised cleanly above green jewel lamps) */}
        <mesh position={[0, 2.235, 0.035]}>
          <planeGeometry args={[1.48, 0.14]} />
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
            [-0.78, 2.22],
            [0.78, 2.22],
            [-0.78, 0.14],
            [0.78, 0.14],
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
        {[-0.48, 0.48].map((lx, lIdx) => (
          <group key={lIdx} position={[lx, 2.31, 0.08]}>
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

        {/* 3 High-Res 16-Part Bolted Turbine, 50Hz Grid Frequency & Generator Load Gauges */}
        <group position={[0, 1.815, 0.03]}>
          <HighDetailManometer3D
            position={[-0.51, 0, 0]}
            title="TURBINE RPM"
            cyrillicSub="ТУРБИНА №1"
            unit="0-3600 RPM"
            serial="№ 84-ТБ1"
            min={0}
            max={3600}
            dangerThreshold={3250}
            getValue={() => useGameStore.getState().turbineRpm}
          />
          <HighDetailManometer3D
            position={[0, 0, 0]}
            title="GRID 50 HZ"
            cyrillicSub="ЧАСТОТА СЕТИ"
            unit="45.0-55.0 HZ"
            serial="№ 84-ГЦ2"
            min={45}
            max={55}
            lowDangerThreshold={46.5}
            dangerThreshold={53.5}
            centerNominal
            getValue={() => useGameStore.getState().gridHz}
          />
          <HighDetailManometer3D
            position={[0.51, 0, 0]}
            title="GEN. LOAD"
            cyrillicSub="НАГРУЗКА МВТ"
            unit="0-180 MW"
            serial="№ 84-ЭЛ3"
            min={0}
            max={180}
            dangerThreshold={105}
            getValue={() => {
              const s = useGameStore.getState();
              if (s.isBlackout) return 0;
              return (
                s.powerAllocation.cooling +
                s.powerAllocation.defense +
                s.powerAllocation.facility +
                (s.ventilationActive ? 10 : 0)
              );
            }}
          />
        </group>

        {/* Recessed Digital Telemetry Readout Strip */}
        <group position={[0, 1.46, 0.03]}>
          <mesh position={[0, 0, 0.008]} castShadow receiveShadow>
            <boxGeometry args={[1.52, 0.25, 0.026]} />
            <meshStandardMaterial
              color="#141816"
              roughness={0.42}
              metalness={0.72}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          <mesh position={[0, 0, 0.022]}>
            <planeGeometry args={[1.46, 0.215]} />
            <meshStandardMaterial
              ref={rightStatusMatRef}
              map={rightStatusTex}
              color="#ffffff"
              emissive="#ffffff"
              emissiveMap={rightStatusTex}
              emissiveIntensity={0.68}
              roughness={0.75}
            />
          </mesh>
        </group>

        {/* Middle Row: Spring-Loaded Steam Relief Lever (`СБРОС ПАРА`) + Rotary Excitation Rheostat (`ВОЗБУЖДЕНИЕ 50 ГЦ`) + 20-Part MAIN BREAKER (`ГЛАВНЫЙ РУБИЛЬНИК`) */}
        <group position={[0, 1.0, 0.04]}>
          {/* 1. Spring-Loaded Steam Relief Pull-Lever (`СБРОС ПАРА / STEAM VENT`) */}
          <group
            position={[-0.52, 0, 0.015]}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => {
              if (useCameraLookStore.getState().isFreeLookMode) return;
              e.stopPropagation();
              steamDragRef.current = {
                active: true,
                startY: e.nativeEvent.clientY,
                progress: 0.35,
                lastHissTime: 0,
              };
              const domElem = e.nativeEvent.target as Element | null;
              domElem?.setPointerCapture?.(e.pointerId);
              playSwitchClank(true);
              playSteamVentHiss(0.6);
              useGameStore.getState().setVentingSteam(true);
            }}
            onPointerMove={(e: ThreeEvent<PointerEvent>) => {
              if (!steamDragRef.current.active) return;
              e.stopPropagation();
              const dy = e.nativeEvent.clientY - steamDragRef.current.startY;
              const prog = THREE.MathUtils.clamp(0.35 + dy / 70, 0.15, 1.0);
              steamDragRef.current.progress = prog;
              useGameStore.getState().setVentingSteam(prog >= 0.25);
            }}
            onPointerUp={(e: ThreeEvent<PointerEvent>) => {
              if (!steamDragRef.current.active) return;
              e.stopPropagation();
              steamDragRef.current.active = false;
              steamDragRef.current.progress = 0;
              const domElem = e.nativeEvent.target as Element | null;
              if (domElem?.hasPointerCapture?.(e.pointerId)) {
                domElem.releasePointerCapture(e.pointerId);
              }
              playSwitchClank(false);
              useGameStore.getState().setVentingSteam(false);
            }}
            onLostPointerCapture={(e: ThreeEvent<PointerEvent>) => {
              if (!steamDragRef.current.active) return;
              steamDragRef.current.active = false;
              steamDragRef.current.progress = 0;
              const domElem = e.nativeEvent.target as Element | null;
              if (domElem?.hasPointerCapture?.(e.pointerId)) {
                domElem.releasePointerCapture(e.pointerId);
              }
              useGameStore.getState().setVentingSteam(false);
            }}
          >
            <mesh position={[0, 0.21, 0.01]}>
              <planeGeometry args={[0.34, 0.082]} />
              <meshStandardMaterial map={steamPlateTex} roughness={0.55} />
            </mesh>
            {/* Heavy Cast-Iron Quadrant Housing & Return Coil Spring */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.24, 0.32, 0.064]} />
              <meshStandardMaterial
                color="#141816"
                roughness={0.45}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
              />
            </mesh>
            {/* Visible Return Coil Spring */}
            {[-0.08, -0.04, 0, 0.04, 0.08].map((sy, sIdx) => (
              <mesh
                key={sIdx}
                position={[-0.085, sy, 0.036]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <torusGeometry args={[0.016, 0.0035, 6, 12]} />
                <meshStandardMaterial
                  color="#c8d2cc"
                  metalness={0.9}
                  roughness={0.22}
                />
              </mesh>
            ))}
            <group ref={steamLeverArmRef} position={[0, 0, 0.036]}>
              {[-0.036, 0.036].map((lx, lIdx) => (
                <mesh
                  key={lIdx}
                  position={[lx, 0, 0.085]}
                  rotation={[Math.PI / 2, 0, 0]}
                  castShadow
                >
                  <cylinderGeometry args={[0.011, 0.013, 0.17, 10]} />
                  <meshStandardMaterial
                    color="#d0dad4"
                    metalness={0.9}
                    roughness={0.2}
                  />
                </mesh>
              ))}
              {/* Hazard-Striped Red/Yellow Steam Relief T-Handle */}
              <mesh
                position={[0, 0, 0.17]}
                rotation={[0, 0, Math.PI / 2]}
                castShadow
              >
                <cylinderGeometry args={[0.028, 0.028, 0.18, 14]} />
                <meshStandardMaterial
                  color="#ff2a2a"
                  emissive="#ff2a2a"
                  emissiveIntensity={0.35}
                  roughness={0.35}
                />
              </mesh>
              {[-0.045, 0, 0.045].map((hx, hIdx) => (
                <mesh
                  key={hIdx}
                  position={[hx, 0, 0.17]}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <cylinderGeometry args={[0.03, 0.03, 0.022, 14]} />
                  <meshStandardMaterial color="#ffb000" roughness={0.35} />
                </mesh>
              ))}
            </group>
          </group>

          {/* 2. Rotary Generator Excitation Rheostat Wheel (`ВОЗБУЖДЕНИЕ 50 ГЦ`) */}
          <group
            position={[-0.05, 0, 0.015]}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => {
              if (useCameraLookStore.getState().isFreeLookMode) return;
              e.stopPropagation();
              const curTrim = useGameStore.getState().excitationTrim;
              rheostatDragRef.current = {
                active: true,
                startX: e.nativeEvent.clientX,
                startY: e.nativeEvent.clientY,
                startTrim: curTrim,
                lastDetent: Math.round(curTrim * 4),
              };
              const domElem = e.nativeEvent.target as Element | null;
              domElem?.setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e: ThreeEvent<PointerEvent>) => {
              if (!rheostatDragRef.current.active) return;
              e.stopPropagation();
              const dx = e.nativeEvent.clientX - rheostatDragRef.current.startX;
              const dy = rheostatDragRef.current.startY - e.nativeEvent.clientY;
              const combined = (dx + dy) / 28;
              const targetTrim = THREE.MathUtils.clamp(
                rheostatDragRef.current.startTrim + combined,
                -5.0,
                5.0,
              );
              const detent = Math.round(targetTrim * 4);
              if (detent !== rheostatDragRef.current.lastDetent) {
                const deltaSteps = detent - rheostatDragRef.current.lastDetent;
                rheostatDragRef.current.lastDetent = detent;
                playRheostatDetentClick(detent);
                useGameStore.getState().adjustExcitationTrim(deltaSteps * 0.25);
              }
            }}
            onPointerUp={(e: ThreeEvent<PointerEvent>) => {
              if (!rheostatDragRef.current.active) return;
              e.stopPropagation();
              rheostatDragRef.current.active = false;
              const domElem = e.nativeEvent.target as Element | null;
              if (domElem?.hasPointerCapture?.(e.pointerId)) {
                domElem.releasePointerCapture(e.pointerId);
              }
            }}
            onLostPointerCapture={(e: ThreeEvent<PointerEvent>) => {
              if (!rheostatDragRef.current.active) return;
              rheostatDragRef.current.active = false;
              const domElem = e.nativeEvent.target as Element | null;
              if (domElem?.hasPointerCapture?.(e.pointerId)) {
                domElem.releasePointerCapture(e.pointerId);
              }
            }}
          >
            <mesh position={[0, 0.21, 0.01]}>
              <planeGeometry args={[0.36, 0.082]} />
              <meshStandardMaterial map={rheostatPlateTex} roughness={0.55} />
            </mesh>
            {/* Stepped Cast-Iron & Brushed-Brass Rheostat Bezel */}
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.145, 0.16, 0.048, 18]} />
              <meshStandardMaterial
                color="#141816"
                roughness={0.44}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
              />
            </mesh>
            <mesh position={[0, 0, 0.026]}>
              <circleGeometry args={[0.132, 24]} />
              <meshStandardMaterial
                map={rheostatScaleTex}
                emissive="#fff2d6"
                emissiveMap={rheostatScaleTex}
                emissiveIntensity={0.38}
                roughness={0.82}
              />
            </mesh>
            <mesh position={[0, 0, 0.028]} castShadow>
              <torusGeometry args={[0.134, 0.009, 10, 24]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.86}
                roughness={0.26}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
            {/* Knurled Bakelite Rotary Dial with White Pointer Bar */}
            <group ref={rheostatWheelRef} position={[0, 0, 0.048]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.098, 0.112, 0.048, 16]} />
                <meshStandardMaterial
                  color="#1e1512"
                  roughness={0.38}
                  metalness={0.25}
                />
              </mesh>
              {/* White & Amber Pointer Stripe */}
              <mesh position={[0, 0.048, 0.026]} castShadow>
                <boxGeometry args={[0.02, 0.082, 0.016]} />
                <meshStandardMaterial
                  color="#efe8d2"
                  emissive="#ffb000"
                  emissiveIntensity={0.35}
                  roughness={0.3}
                />
              </mesh>
              {/* Center Brass Cap */}
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.028, 0.03, 0.056, 12]} />
                <meshStandardMaterial
                  color="#b8a46b"
                  metalness={0.88}
                  roughness={0.22}
                />
              </mesh>
            </group>
          </group>

          {/* 3. Heavy Multi-Part Copper Knife-Switch MAIN BREAKER (`ГЛАВНЫЙ РУБИЛЬНИК`) */}
          <HighDetailKnifeBreaker3D
            breakerArmRef={breakerArmRef}
            breakerDragRef={breakerDragRef}
            breakerPlateTex={breakerPlateTex}
          />
        </group>

        {/* Lower Row: Guarded Metal Toggle Switches (with U-Shaped Side Safety Guards) + 5 Tactile Backlit Soviet Push-Buttons */}
        <group position={[0, 0.52, 0.04]}>
          <mesh position={[0, 0.03, -0.01]} castShadow receiveShadow>
            <boxGeometry args={[1.48, 0.44, 0.04]} />
            <meshStandardMaterial
              color="#141414"
              roughness={0.45}
              metalness={0.65}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          {/* Upper Sub-Row: 4 Guarded Metal Toggle Switches (`ВЕНТИЛЯЦИЯ`, `АУДИО [M]`, `СВЯЗЬ КГБ`, `РЕЗЕРВ БЛОКА`) with U-Shaped Side Safety Guards & Caged Jewel Lamps */}
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
                setAuxToggles((prev) => {
                  const next: [boolean, boolean, boolean, boolean] = [
                    ...prev,
                  ] as [boolean, boolean, boolean, boolean];
                  next[3] = !next[3];
                  return next;
                });
              }
            };
            return (
              <group
                key={`toggle-${tSpec.id}`}
                position={[-0.51 + tIdx * 0.34, 0.165, 0.016]}
                onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                  if (useCameraLookStore.getState().isFreeLookMode) return;
                  e.stopPropagation();
                  toggleDragRef.current = {
                    activeIdx: tIdx,
                    startY: e.nativeEvent.clientY,
                  };
                  const domElem = e.nativeEvent.target as Element | null;
                  domElem?.setPointerCapture?.(e.pointerId);
                }}
                onPointerUp={(e: ThreeEvent<PointerEvent>) => {
                  if (toggleDragRef.current.activeIdx !== tIdx) return;
                  e.stopPropagation();
                  toggleDragRef.current.activeIdx = null;
                  const domElem = e.nativeEvent.target as Element | null;
                  if (domElem?.hasPointerCapture?.(e.pointerId)) {
                    domElem.releasePointerCapture(e.pointerId);
                  }
                  triggerToggle();
                }}
              >
                <CagedSovietJewelLamp3D
                  position={[-0.072, 0.008, 0.01]}
                  lampMatRef={{
                    get current() {
                      return toggleLampRefs.current[tIdx] ?? null;
                    },
                    set current(el: THREE.MeshStandardMaterial | null) {
                      toggleLampRefs.current[tIdx] = el;
                    },
                  }}
                  scale={0.68}
                />
                {/* Engraved Brass/Iron Plaque Above Toggle */}
                <mesh position={[0.012, 0.064, 0.008]}>
                  <planeGeometry args={[0.22, 0.056]} />
                  <meshStandardMaterial map={tSpec.texture} roughness={0.55} />
                </mesh>
                {/* Hex Brass Mounting Nut */}
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.022, 0.025, 0.016, 6]} />
                  <meshStandardMaterial
                    color="#b8a46b"
                    metalness={0.86}
                    roughness={0.26}
                    bumpMap={brassTex.bumpMap}
                    bumpScale={0.005}
                  />
                </mesh>
                {/* U-Shaped Side Safety Guard Brackets */}
                {[-0.028, 0.028].map((gx, gIdx) => (
                  <group key={gIdx} position={[gx, 0, 0.018]}>
                    <mesh castShadow>
                      <boxGeometry args={[0.006, 0.056, 0.032]} />
                      <meshStandardMaterial
                        color="#8c7a4b"
                        metalness={0.85}
                        roughness={0.28}
                      />
                    </mesh>
                  </group>
                ))}
                {/* Chrome Bat-Handle Toggle Bat (+35° / -35°) */}
                <group
                  ref={(el) => {
                    toggleBatRefs.current[tIdx] = el;
                  }}
                  position={[0, 0, 0.01]}
                >
                  <mesh
                    position={[0, 0, 0.026]}
                    rotation={[Math.PI / 2, 0, 0]}
                    castShadow
                  >
                    <cylinderGeometry args={[0.009, 0.0055, 0.052, 10]} />
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
          {pushButtonSpecs.map((btn, idx) => {
            const s = useGameStore.getState();
            const isOn =
              idx === 1
                ? s.ventilationActive
                : idx === 2
                  ? s.kgbLineActive
                  : idx === 3
                    ? s.ventingSteam
                    : idx === 4
                      ? !s.isMusicMuted
                      : auxToggles[idx] ?? false;
            return (
              <group
                key={btn.id}
                position={[-0.56 + idx * 0.28, -0.04, 0.025]}
                onClick={(e) => {
                  e.stopPropagation();
                  playSwitchClank(false);
                  const store = useGameStore.getState();
                  if (idx === 1) {
                    store.toggleVentilation();
                  } else if (idx === 2) {
                    store.toggleKgbLine();
                  } else if (idx === 3) {
                    playSteamVentHiss(0.8);
                    store.setVentingSteam(!store.ventingSteam);
                  } else if (idx === 4) {
                    store.toggleMusicMute();
                  } else {
                    setAuxToggles((prev) => {
                      const next: [boolean, boolean, boolean, boolean] = [
                        ...prev,
                      ] as [boolean, boolean, boolean, boolean];
                      next[idx] = !next[idx];
                      return next;
                    });
                  }
                }}
              >
                <CagedSovietJewelLamp3D
                  position={[0, 0.112, 0]}
                  defaultColor={isOn ? btn.color : "#1c2621"}
                  scale={0.76}
                />
                {/* Chunky Push-Button Housing */}
                <mesh
                  position={[0, 0, isOn ? 0.008 : 0.02]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[0.22, 0.11, 0.04]} />
                  <meshStandardMaterial
                    color="#23312b"
                    roughness={0.45}
                    metalness={0.65}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.008}
                  />
                </mesh>
                <mesh position={[0, 0, isOn ? 0.03 : 0.042]}>
                  <planeGeometry args={[0.2, 0.095]} />
                  <meshStandardMaterial
                    map={btn.texture}
                    emissive="#ffffff"
                    emissiveMap={btn.texture}
                    emissiveIntensity={isOn ? 0.55 : 0.22}
                    roughness={0.75}
                  />
                </mesh>
              </group>
            );
          })}
        </group>

        {/* Heavy Armored Cable Conduits connecting Right Panel into the Inspector's Desk */}
        <group position={[-0.78, 0.62, 0.24]} rotation={[0, 0.42, 0]}>
          <mesh
            position={[0, 0.12, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.036, 0.036, 0.58, 10]} />
            <meshStandardMaterial
              color="#364940"
              metalness={0.7}
              roughness={0.4}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          <mesh
            position={[0, -0.02, 0.08]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.028, 0.028, 0.58, 10]} />
            <meshStandardMaterial
              color="#23312b"
              metalness={0.65}
              roughness={0.45}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          {/* Brass Conduit Flanges */}
          <mesh
            position={[-0.24, 0.12, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.048, 0.048, 0.024, 12]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.85}
              roughness={0.28}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          <mesh
            position={[-0.24, -0.02, 0.08]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.04, 0.04, 0.024, 12]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.85}
              roughness={0.28}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
        </group>
      </group>

      {/* 4. BEVELED ANGLE-IRON SEAMS FOR K.O.M.R.A.D.-84 TERMINAL */}
      <group position={[0, 0.14, 2.18]}>
        <group position={[0, 0, -1.62]}>
          <primitive object={terminalHousingModel} />
          {/* Heavy Welded Corner L-Angle Trim & Recessed Bezel Bolts on K.O.M.R.A.D.-84 Mainframe */}
          <mesh position={[-0.85, 1.02, 0.04]} castShadow receiveShadow>
            <boxGeometry args={[0.045, 2.04, 0.045]} />
            <meshStandardMaterial
              color="#18211b"
              metalness={0.68}
              roughness={0.44}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          <mesh position={[0.85, 1.02, 0.04]} castShadow receiveShadow>
            <boxGeometry args={[0.045, 2.04, 0.045]} />
            <meshStandardMaterial
              color="#18211b"
              metalness={0.68}
              roughness={0.44}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          {[-0.68, -0.34, 0, 0.34, 0.68].map((bx, idx) => (
            <mesh
              key={idx}
              position={[bx, 1.94, 0.145]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.013, 0.013, 0.016, 6]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.85}
                roughness={0.28}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
          ))}
        </group>
      </group>
    </>
  );
};

/**
 * Suspended Bunker Dust Motes (120 slow-drifting micro-pixel dust particles floating
 * lazily inside the overhead spotlight cone above the Inspector's Desk)
 */
const BunkerDustMotes3D: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null);

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
    const posAttr = pointsRef.current.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < 120; i++) {
      const phase = seeds[i * 3];
      const speed = seeds[i * 3 + 1];
      const phaseZ = seeds[i * 3 + 2];

      arr[i * 3] += Math.sin(t * 0.42 * speed + phase) * 0.0005;
      arr[i * 3 + 1] += Math.cos(t * 0.31 * speed + phaseZ) * 0.00035;
      arr[i * 3 + 2] += Math.sin(t * 0.37 * speed + phaseZ) * 0.0004;

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
};

const DynamicBunkerLighting: React.FC = () => {
  const deskSpotRef = useRef<THREE.SpotLight>(null);
  const deskSpotTargetRef = useRef<THREE.Object3D>(null);
  const deskBulbMeshRef = useRef<THREE.Mesh>(null);
  const reactorSpotRef = useRef<THREE.PointLight>(null);
  const az5GlowRef = useRef<THREE.PointLight>(null);
  const crtLightRef = useRef<THREE.PointLight>(null);
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
    const isAlarmActive = coreTemp >= 750 || totalMW > maxSafePower;

    if (deskSpotRef.current) {
      if (isBlackout || powerAllocation.facility <= 0) {
        deskSpotRef.current.intensity = 0;
      } else if (powerAllocation.facility <= 10) {
        const heavyFlicker =
          Math.sin(t * 37) * 0.35 + Math.cos(t * 63) * 0.25 > 0.1 ? 0.2 : 0.95;
        deskSpotRef.current.intensity = 1.9 * heavyFlicker;
      } else if (powerAllocation.facility <= 20) {
        const subtleFlicker = 0.88 + Math.sin(t * 24) * 0.12;
        deskSpotRef.current.intensity = 2.8 * subtleFlicker;
      } else {
        const boost = Math.min(1.35, powerAllocation.facility / 30);
        deskSpotRef.current.intensity = 3.2 * boost;
      }
    }

    if (reactorSpotRef.current) {
      reactorSpotRef.current.intensity = isBlackout
        ? 0.35
        : 2.1 + Math.sin(t * 17.0) * 0.08;
    }

    if (az5GlowRef.current) {
      az5GlowRef.current.intensity = isBlackout
        ? 0.3
        : isAlarmActive
          ? 1.45 + Math.sin(t * 12.0) * 0.35
          : 0.85;
    }

    if (deskBulbMeshRef.current) {
      const mat = deskBulbMeshRef.current
        .material as THREE.MeshStandardMaterial;
      const lampOn = !isBlackout && powerAllocation.facility > 0;
      mat.emissiveIntensity = lampOn
        ? Math.min(2.6, 0.7 + (powerAllocation.facility / 40) * 1.7)
        : 0.02;
    }

    if (crtLightRef.current) {
      crtLightRef.current.intensity = isBlackout ? 0.55 : 0.9;
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
          Local phosphor-green pointLight in front of K.O.M.R.A.D.-84 screen illuminating 3D keycaps & rear brass trim */}
      <pointLight
        ref={crtLightRef}
        position={[0, 1.48, 0.86]}
        color="#38ff62"
        intensity={0.9}
        distance={1.6}
        decay={1.4}
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
      <pointLight
        ref={reactorSpotRef}
        position={[-1.38, 1.92, 2.35]}
        color="#ffba5c"
        intensity={2.2}
        distance={4.8}
        decay={1.4}
      />

      {/* Right Control Wing Local Gauge & Breaker Pool Light */}
      <pointLight
        position={[1.38, 1.92, 2.35]}
        color="#ffba5c"
        intensity={2.2}
        distance={4.8}
        decay={1.4}
      />

      {/* Left-Rear & Rear Wrap-Around Control Panel Pool Lights */}
      <pointLight
        position={[-0.95, 1.96, 3.25]}
        color="#ffba5c"
        intensity={2.1}
        distance={4.8}
        decay={1.4}
      />
      <pointLight
        position={[0.45, 1.96, 3.55]}
        color="#ffba5c"
        intensity={1.9}
        distance={4.8}
        decay={1.4}
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
};

export const ControlRoomScene: React.FC = () => {
  const bunkerArchRef = useRef<THREE.Group>(null);
  const reactorWrapRef = useRef<THREE.Group>(null);
  const terminalWrapRef = useRef<THREE.Group>(null);

  useEffect(() => {
    applySovietPBRToHierarchy(bunkerArchRef.current);
    applySovietPBRToHierarchy(reactorWrapRef.current);
    applySovietPBRToHierarchy(terminalWrapRef.current);
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
          position={[0, 0.005, 1.4]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[6.4, 6.8]} />
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
          position={[-3.55, 1.6, -0.2]}
          rotation={[0, Math.PI / 2.35, 0]}
          receiveShadow
        >
          <boxGeometry args={[6.4, 3.6, 0.25]} />
          <meshStandardMaterial
            color="#1c2621"
            roughness={0.85}
            metalness={0.25}
          />
        </mesh>
        <mesh
          position={[3.55, 1.6, -0.2]}
          rotation={[0, -Math.PI / 2.35, 0]}
          receiveShadow
        >
          <boxGeometry args={[6.4, 3.6, 0.25]} />
          <meshStandardMaterial
            color="#1c2621"
            roughness={0.85}
            metalness={0.25}
          />
        </mesh>

        <mesh position={[0, 3.05, 1.2]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[12, 12]} />
          <meshStandardMaterial
            color="#141414"
            roughness={0.9}
            metalness={0.3}
          />
        </mesh>
        {[-1.6, -0.4, 0.8, 2.0, 3.2, 4.4].map((zPos) => (
          <mesh key={zPos} position={[0, 2.94, zPos]} castShadow receiveShadow>
            <boxGeometry args={[8.5, 0.14, 0.18]} />
            <meshStandardMaterial
              color="#141414"
              roughness={0.7}
              metalness={0.55}
            />
          </mesh>
        ))}

        {/* Rear Bunker Concrete Bulkhead Wall enclosing the Wrap-Around Cockpit */}
        <mesh position={[0, 1.6, 5.45]} receiveShadow>
          <boxGeometry args={[9.2, 3.6, 0.25]} />
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

      {/* 1. LEFT COCKPIT WING: <HighDetailReactorPanel3D /> (Spans z = 1.33 to z = 3.37 at x = -2.12, 0.0m overlap!) */}
      <group
        ref={reactorWrapRef}
        position={[-2.12, 0.0, 2.35]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[1.14, 1.1, 1.12]}
      >
        <group rotation={[0, -0.42, 0]}>
          <group position={[2.15, 0, 1.08]}>
            <HighDetailReactorPanel3D />
          </group>
        </group>
      </group>

      {/* 1B. LEFT-REAR WRAP-AROUND PANEL (`UNIT A-2`): Starts cleanly at [-2.12, 0, 3.43] and angles 135° to [-0.68, 0, 4.87] with ZERO overlap! */}
      <group
        position={[-1.4, 0.0, 4.15]}
        rotation={[0, (3 * Math.PI) / 4, 0]}
        scale={[1.14, 1.1, 1.12]}
      >
        <LeftRearWrapAroundPanel3D variant="left-rear" />
      </group>

      {/* Heavy Bolted Cast-Iron Corner Junction Pillar at exact seam [-2.12, 1.24, 3.40] between `UNIT A` and `UNIT A-2` */}
      <group position={[-2.12, 1.24, 3.4]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.095, 0.11, 2.52, 8]} />
          <meshStandardMaterial color="#18211b" metalness={0.7} roughness={0.42} />
        </mesh>
        {[-0.85, -0.35, 0.15, 0.65, 1.05].map((py, pIdx) => (
          <mesh key={pIdx} position={[0, py, 0]} castShadow>
            <cylinderGeometry args={[0.125, 0.125, 0.055, 8]} />
            <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
          </mesh>
        ))}
      </group>

      {/* 1C. REAR OPERATOR BULKHEAD PANEL (`БЛОК В`): Starts cleanly at [-0.62, 0, 4.89] and spans to [+1.42, 0, 4.89] directly behind the operator with ZERO overlap! */}
      <group
        position={[0.4, 0.0, 4.89]}
        rotation={[0, Math.PI, 0]}
        scale={[1.14, 1.1, 1.12]}
      >
        <LeftRearWrapAroundPanel3D variant="rear" />
      </group>

      {/* Heavy Bolted Corner Junction Pillar at exact seam [-0.65, 1.24, 4.88] between `UNIT A-2` and `БЛОК В` */}
      <group position={[-0.65, 1.24, 4.88]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.095, 0.11, 2.52, 8]} />
          <meshStandardMaterial color="#18211b" metalness={0.7} roughness={0.42} />
        </mesh>
        {[-0.85, -0.35, 0.15, 0.65, 1.05].map((py, pIdx) => (
          <mesh key={pIdx} position={[0, py, 0]} castShadow>
            <cylinderGeometry args={[0.125, 0.125, 0.055, 8]} />
            <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
          </mesh>
        ))}
      </group>

      {/* 2. CENTER COCKPIT LOOMING TERMINAL: <TerminalStation3D /> (Pulled forward directly behind & above desk) */}
      <group ref={terminalWrapRef} position={[0, 0.14, 2.18]}>
        <TerminalStation3D />
      </group>

      {/* 3. CENTRAL COMMAND DESK: <InspectorDesk3D /> */}
      {ExternalInspectorDesk3D ? (
        <ExternalInspectorDesk3D />
      ) : (
        <InspectorDesk3DPlaceholder />
      )}
    </>
  );
};
