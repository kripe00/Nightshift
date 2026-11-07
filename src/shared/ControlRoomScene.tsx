import { useGLTF } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import * as InspectorModule from "../modules/inspector";
import {
  playKnifeSwitchSlam,
  playRheostatDetentClick,
  playSteamVentHiss,
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
  HighDetailKnifeBreaker3D,
  HighDetailManometer3D,
  HighDetailReactorPanel3D,
  LeftRearWrapAroundPanel3D,
  SovietCRTMonitorBay3D,
  SovietDvk84KeyboardConsole3D,
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
const BunkerTelemetryAndControlRail3D: React.FC = React.memo(() => {
  const headerMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const headerTexture = useMemo(() => createNearestCanvasTexture(768, 96), []);
  const lastHeaderDrawRef = useRef(0);
  const lastRightDrawRef = useRef(0);
  const breakerArmRef = useRef<THREE.Group>(null);
  const rheostatRingMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const rheostatPointerMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const wasBlackoutRef = useRef(false);
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

  useFrame(({ clock }) => {
    const s = useGameStore.getState();

    if (s.isBlackout && !wasBlackoutRef.current) {
      playKnifeSwitchSlam(false);
    }
    wasBlackoutRef.current = s.isBlackout;

    if (breakerArmRef.current) {
      const targetProgress = breakerDragRef.current.active
        ? breakerDragRef.current.progress
        : s.phase === "playing" && !s.isBlackout
          ? 1
          : 0;
      const targetRotX = -0.55 + targetProgress * 1.1;
      breakerArmRef.current.rotation.x = THREE.MathUtils.lerp(
        breakerArmRef.current.rotation.x,
        targetRotX,
        0.25,
      );
    }

    const now = clock.getElapsedTime();

    // Pulse 50HZ RHEOSTAT ring & pointer stripe during Tutorial Step 4
    const highlightRheo = s.tutorialStep === 4;
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

    if (now - lastHeaderDrawRef.current < 0.08) return;

    const isFreeLookMode = useCameraLookStore.getState().isFreeLookMode;
    const deskState = useDeskStore.getState();
    const hasApprovedDoc = deskState.documents.some(
      (d) => d.status === "desk" && d.stamps.some((st) => st.type === "APPROVED"),
    );
    let tutBanner: string | null = null;
    if (s.tutorialStep === 1) {
      tutBanner =
        deskState.printingDoc !== null
          ? "DRILL 1/5 [KEY 4 -> DESK]: DRAG PAPER RIGHT TO TEAR FROM PRINTER -> PLACE ON DESK MAT."
          : !hasApprovedDoc && deskState.capsuleState === "CRADLE_EMPTY"
            ? "DRILL 1/5 [KEY 4 -> DESK]: ORDER IS GENUINE! CLICK GREEN STAMP [ОДОБРЕНО] -> STAMP PAPER."
            : "DRILL 1/5 [KEY 4 -> DESK]: PACK PAPER IN CAPSULE -> OPEN TUBE HATCH -> LOAD -> CLOSE & PULL RED LEVER!";
    } else if (s.tutorialStep === 2) {
      tutBanner =
        "DRILL 2/5 [PRESS KEY 1 -> UNIT A]: VODKA PLANT DEMANDS 25 MW! PULL LEVER [5. VODKA PLANT] TO 25/25 MW.";
    } else if (s.tutorialStep === 3) {
      tutBanner =
        s.pumpThrottle[0] <= 50
          ? "DRILL 3/5 [KEY 1 -> UNIT A]: MORE MW CREATES CORE HEAT! TURN [COOLING PUMP A] WHEEL ABOVE 50%."
          : "DRILL 3/5 [PRESS KEY 3 -> UNIT B]: TURN [HELIUM-N2 LOOP] (>40%) & HOLD [BUBBLER DRAIN] LEVER!";
    } else if (s.tutorialStep === 4) {
      tutBanner =
        "DRILL 4/5 [PRESS KEY 5 -> UNIT C]: POWER CHANGES SHIFT TURBINE HZ! DRAG [50HZ RHEOSTAT] DIAL TO 50.0 HZ.";
    } else if (s.tutorialStep === 5) {
      tutBanner =
        "DRILL 5/5 [PRESS KEY 4 -> DESK]: FAKE SEAL ORDER! STAMP RED [УНИЧТОЖЕНО], DROP IN SHREDDER & PULL 5X!";
    }

    const diagBanner =
      s.hoveredDiagnosticId !== null || s.tutorialStep === "DONE"
        ? getContextualDiagnosticHint(s, deskState.printingDoc !== null)
        : null;
    const activeTopBanner = diagBanner ?? tutBanner;

    const sig = `${s.phase}|${s.shiftNumber}|${Math.floor(s.shiftTimeMinutes)}|${Math.round(s.coreTemp / 2) * 2}|${s.treasonStrikes}|${s.isShiftKeyHeld}|${s.isGodMode}|${isFreeLookMode}|${activeTopBanner ?? ""}|${s.lastDecisionFeedback ?? ""}`;
    const hTex = headerMatRef.current?.map as THREE.CanvasTexture | undefined;
    if (hTex && hTex.userData.lastSig !== sig) {
      lastHeaderDrawRef.current = now;
      hTex.userData.lastSig = sig;
      const hCanvas = hTex.image as HTMLCanvasElement;
      const ctx = hCanvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, 768, 96);
        ctx.strokeStyle = activeTopBanner ? "#ffb000" : "#364940";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 764, 92);

        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 20px "Kremlin", monospace';
        ctx.textAlign = "left";
        ctx.fillText(
          tutBanner && !diagBanner
            ? "УЧЕБНАЯ ТРЕВОГА // TRAINING DRILL [BACKSPACE: SKIP]"
            : diagBanner
              ? "ТАБЛО ТРЕВОГИ // TACTICAL DIAGNOSTIC REMEDY"
              : "MELTDOWN IS PROPAGANDA // SECTOR 84",
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

        ctx.fillStyle = activeTopBanner ? "#ffdd55" : "#e6dec3";
        ctx.font = '18px "VT323", monospace';
        const statusLine =
          s.phase === "boot"
            ? "PRESS [SPACE] TO START SHIFT — OR [SHIFT+SPACE] FOR ENDLESS NO-FAIL SANDBOX!"
            : s.phase !== "playing"
              ? `SHIFT ENDED (${s.phase.toUpperCase()}) — PRESS [SPACE] OR [SHIFT+SPACE] TO RESET!`
              : (activeTopBanner ??
                s.lastDecisionFeedback ??
                "CAMERA: [1-5] STATION ZOOM | [0/ESC] CHAIR | [L-CTRL] FREE-LOOK/CURSOR | [SHIFT+SPACE] SANDBOX");
        ctx.fillText(statusLine.slice(0, 94), 18, 84);
        hTex.needsUpdate = true;
      }
    }
  });

  const steamLeverArmRef = useRef<THREE.Group>(null);
  const steamDragRef = useRef<{
    active: boolean;
    startY: number;
    progress: number;
    lastHissTime: number;
  }>({ active: false, startY: 0, progress: 0, lastHissTime: 0 });

  const rheostatWheelRef = useRef<THREE.Group>(null);

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
      { id: 2, label: "KGB LINE", sub: "DECODE DIRECTIVES", color: "#33ff66" },
      { id: 3, label: "AUX LOOP B", sub: "BYPASS -> BUBBLER", color: "#ffb000" },
    ];
    return items.map((item) => ({
      ...item,
      texture: createCrispPanelTexture(224, 60, (ctx, w, h) => {
        ctx.fillStyle = "#141816";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = item.color;
        ctx.font = 'bold 18px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText(item.label, w / 2, 24);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 16px "VT323", monospace';
        ctx.fillText(item.sub, w / 2, 48);
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
    // 1. Strip the legacy flat kbOverlay group AND the 2 angled umbilical/flange cylinders (y < 0.88) that clipped into the bottom-left/right keys
    // 2. Scale up the upper CRT housing/bezel/hood/bolts/knobs (y >= 0.88) by +40% width (1.40x) and +30% height (1.30x)
    //    while anchoring the bottom bezel at y >= 0.94 so it stays 100% clear of the 3 DVK-84 switches & keyboard!
    const legacyLowerMeshes: THREE.Object3D[] = [];
    for (const child of cloned.children) {
      if (child.position.y < 0.88) {
        legacyLowerMeshes.push(child);
      } else {
        child.position.x *= 1.4;
        child.position.y = 0.94 + (child.position.y - 0.88) * 1.3;
        child.scale.x *= 1.4;
        child.scale.y *= 1.3;
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
        ctx.fillText("TURBINE 50HZ GRID PANEL // UNIT C", w / 2, 30);
        ctx.fillStyle = "#33ff66";
        ctx.font = 'bold 17px "VT323", monospace';
        ctx.fillText("TURBINE NO. 1 • 50HZ EXCITATION • MAIN BREAKER", w / 2, 56);
      }),
    [],
  );

  const rightStatusTex = useMemo(() => createCrispPanelTexture(768, 144), []);

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
        0.72,
      );
    }

    // 3. Animate Guarded Metal Toggle Bats (+35° / -35°) & Caged Jewel Lamps
    const toggleStates = [
      s.ventilationActive,
      !s.isMusicMuted,
      s.kgbLineActive,
      s.auxLoopBActive,
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

    // Update Right Control Panel Phosphor-Green CRT Monitor (`ЭЛТ ВЛ-84Г`) — throttled to ~13 FPS (0.075s)
    if (t - lastRightDrawRef.current < 0.075) return;
    const roundedRpm = Math.round(s.turbineRpm / 10) * 10;
    const roundedHz = (Math.round(s.gridHz * 5) / 5).toFixed(1);
    const rSig = `${s.phase}|${totalMW}|${Math.round(s.pressureBar)}|${roundedRpm}|${roundedHz}|${s.ventingSteam}|${s.ventilationActive}|${s.kgbLineActive}|${s.auxLoopBActive}|${s.isMusicMuted}|${Math.round(s.bubblerLevel)}|${s.containmentSealLocked}|${s.activeMandate?.id ?? "NONE"}|${s.isBlackout}|${Math.ceil(s.hzOutOfBoundsSeconds)}`;
    const rTex = rightStatusMatRef.current?.map as THREE.CanvasTexture | undefined;
    if (rTex && rTex.userData.lastSig !== rSig) {
      lastRightDrawRef.current = t;
      rTex.userData.lastSig = rSig;
      const canvas = rTex.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const w = 768;
        const h = 144;
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
        if (s.isBlackout) {
          grad.addColorStop(0, "#1c0808");
          grad.addColorStop(1, "#080202");
        } else {
          grad.addColorStop(0, "#0b2914");
          grad.addColorStop(0.7, "#06190c");
          grad.addColorStop(1, "#020b05");
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // 2. CRT Oscilloscope Graticule Grid
        ctx.strokeStyle = s.isBlackout
          ? "rgba(255, 42, 42, 0.15)"
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

        const hzDanger = s.gridHz < 47.8 || s.gridHz > 52.2;
        const bubblerFlooded = s.bubblerLevel > 90;
        const statusDanger =
          s.isBlackout ||
          hzDanger ||
          s.turbineRpm > 3450 ||
          s.ventingSteam ||
          bubblerFlooded;

        ctx.strokeStyle = statusDanger ? "#ff2a2a" : "#2be85d";
        ctx.lineWidth = 3;
        ctx.strokeRect(6, 6, w - 12, h - 12);

        const cells = [
          {
            label: "TURBINE RPM",
            val: `${s.turbineRpm} RPM`,
            danger: s.turbineRpm > 3250,
          },
          {
            label: "GRID 50 HZ",
            val: `${s.gridHz.toFixed(1)} HZ`,
            danger: hzDanger,
          },
          {
            label: "GEN. LOAD",
            val: s.isBlackout ? "0 MW (OPEN)" : `${totalMW} MW`,
            danger: s.isBlackout || totalMW > 105,
          },
        ];

        const cellW = 232;
        const cellCenters = [134, 384, 634];
        cells.forEach((c, idx) => {
          const cx = cellCenters[idx] ?? 384;
          const x0 = cx - cellW / 2;
          ctx.fillStyle = c.danger
            ? "rgba(90, 12, 12, 0.55)"
            : "rgba(4, 18, 9, 0.65)";
          ctx.fillRect(x0, 12, cellW, 68);
          ctx.strokeStyle = c.danger ? "#ff2a2a" : "#248f46";
          ctx.lineWidth = 2;
          ctx.strokeRect(x0, 12, cellW, 68);

          ctx.fillStyle = c.danger ? "#ff2a2a" : "#1f6e39";
          ctx.fillRect(x0 + 2, 14, cellW - 4, 18);
          ctx.fillStyle = c.danger ? "#ffffff" : "#d8ffe2";
          ctx.font = 'bold 14px "Courier Prime", monospace';
          ctx.textAlign = "center";
          ctx.fillText(c.label, cx, 28);

          ctx.save();
          ctx.shadowColor = c.danger ? "#ff2a2a" : "#33ff66";
          ctx.shadowBlur = 8;
          ctx.fillStyle = c.danger ? "#ff4444" : "#44ff77";
          ctx.font = 'bold 40px "VT323", monospace';
          ctx.fillText(c.val, cx, 69);
          ctx.restore();
        });

        ctx.fillStyle = "rgba(3, 14, 7, 0.78)";
        ctx.fillRect(18, 86, w - 36, 48);
        ctx.strokeStyle = statusDanger ? "#ff2a2a" : "#248f46";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(18, 86, w - 36, 48);

        const steamStatus = s.ventingSteam
          ? "VENTING (-2.5% H2O)"
          : `${Math.round(s.pressureBar)} BAR`;
        const statusLineText = s.isBlackout
          ? `> BREAKER TRIPPED (1.8X HEAT)! TRIM TO 49-51 HZ & PULL BREAKER [SPACE]!`
          : `> STEAM: ${steamStatus} | AUX B: ${s.auxLoopBActive ? "BYPASS (+3.5% H2O)" : "OFF"} | VENT: ${s.ventilationActive ? "ON (+10MW)" : "OFF"}`;
        ctx.save();
        ctx.textAlign = "center";
        ctx.shadowColor = statusDanger ? "#ff2a2a" : "#33ff66";
        ctx.shadowBlur = 6;
        ctx.fillStyle = statusDanger ? "#ff3b3b" : "#33ff66";
        ctx.font = 'bold 21px "VT323", monospace';
        ctx.fillText(statusLineText, w / 2, 108);
        ctx.restore();

        ctx.textAlign = "center";
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 14px "Courier Prime", monospace';
        ctx.fillText(
          s.hzOutOfBoundsSeconds > 0 && !s.isBlackout
            ? `[UNIT C] WARNING: BREAKER TRIPS IN ${Math.max(0, Math.ceil(10 - s.hzOutOfBoundsSeconds))}S! TURN 50HZ RHEOSTAT!`
            : "[UNIT C] TURN 50HZ RHEOSTAT • AUX LOOP B -> BUBBLER • MAIN BREAKER",
          w / 2,
          128,
        );

        // Scanline Overlay & Top Glass Sheen
        ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
        for (let y = 0; y < h; y += 3) {
          ctx.fillRect(0, y, w, 1);
        }
        const glassSheen = ctx.createLinearGradient(0, 0, 0, 38);
        glassSheen.addColorStop(0, "rgba(180, 255, 205, 0.09)");
        glassSheen.addColorStop(1, "rgba(180, 255, 205, 0.0)");
        ctx.fillStyle = glassSheen;
        ctx.fillRect(8, 8, w - 16, 32);

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
            lowDangerThreshold={47.8}
            dangerThreshold={52.2}
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

        {/* Molded Phosphor-Green CRT Monitor Bay (`ЭЛТ ВЛ-84Г`) */}
        <SovietCRTMonitorBay3D
          position={[0, 1.46, 0.03]}
          screenMatRef={rightStatusMatRef}
          screenTexture={rightStatusTex}
          modelBadge="ЭЛТ ВЛ-84Г"
        />

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
              playSwitchClank(true);
              playSteamVentHiss(0.6);
              useGameStore.getState().setVentingSteam(true);
              const handleMove = (ev: PointerEvent) => {
                if (!steamDragRef.current.active) return;
                const dy = ev.clientY - steamDragRef.current.startY;
                const prog = THREE.MathUtils.clamp(0.35 + dy / 70, 0.15, 1.0);
                steamDragRef.current.progress = prog;
                useGameStore.getState().setVentingSteam(prog >= 0.25);
              };
              const handleUp = () => {
                steamDragRef.current.active = false;
                steamDragRef.current.progress = 0;
                playSwitchClank(false);
                useGameStore.getState().setVentingSteam(false);
                window.removeEventListener("pointermove", handleMove);
                window.removeEventListener("pointerup", handleUp);
                window.removeEventListener("pointercancel", handleUp);
              };
              window.addEventListener("pointermove", handleMove);
              window.addEventListener("pointerup", handleUp);
              window.addEventListener("pointercancel", handleUp);
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
            onPointerOver={(e) => {
              e.stopPropagation();
              useGameStore.getState().setHoveredDiagnosticId("grid");
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              const g = useGameStore.getState();
              if (g.hoveredDiagnosticId === "grid") {
                g.setHoveredDiagnosticId(null);
              }
            }}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => {
              if (useCameraLookStore.getState().isFreeLookMode) return;
              e.stopPropagation();
              const domElem = e.nativeEvent.target as HTMLElement | null;
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
              let totalMove = 0;
              let currentVal = useGameStore.getState().excitationTrim;
              let prevX = e.nativeEvent.clientX;
              let prevY = e.nativeEvent.clientY;
              let prevAngle = Math.atan2(prevY - centerY, prevX - centerX);
              let lastDetent = Math.round(currentVal * 4);

              const handleMove = (ev: PointerEvent) => {
                const dx = ev.clientX - prevX;
                const dy = ev.clientY - prevY;
                prevX = ev.clientX;
                prevY = ev.clientY;
                if (dx === 0 && dy === 0) return;

                totalMove = Math.max(
                  totalMove,
                  Math.hypot(ev.clientX - startX, ev.clientY - startY),
                );

                const rx = ev.clientX - centerX;
                const ry = ev.clientY - centerY;
                const r = Math.hypot(rx, ry);
                const curAngle = Math.atan2(ry, rx);

                let dTheta = curAngle - prevAngle;
                while (dTheta > Math.PI) dTheta -= Math.PI * 2;
                while (dTheta < -Math.PI) dTheta += Math.PI * 2;
                prevAngle = curAngle;

                const linearDelta = ((-dy + dx) / 40) * 5.0;
                const circularDelta =
                  r > 10 ? (dTheta / (Math.PI * 0.75)) * 5.0 : 0;
                const deltaTrim =
                  Math.abs(linearDelta) >= Math.abs(circularDelta)
                    ? linearDelta
                    : circularDelta;

                const nextTrim = THREE.MathUtils.clamp(
                  currentVal + deltaTrim,
                  -5.0,
                  5.0,
                );
                const appliedDelta = nextTrim - currentVal;
                if (Math.abs(appliedDelta) >= 0.005) {
                  currentVal = nextTrim;
                  const nextDetent = Math.round(currentVal * 4);
                  if (nextDetent !== lastDetent) {
                    lastDetent = nextDetent;
                    playRheostatDetentClick(nextDetent);
                  }
                  useGameStore.getState().adjustExcitationTrim(appliedDelta);
                }
              };
              const handleUp = () => {
                window.removeEventListener("pointermove", handleMove);
                window.removeEventListener("pointerup", handleUp);
                window.removeEventListener("pointercancel", handleUp);
                if (totalMove < 6) {
                  const s = useGameStore.getState();
                  const err = 50.0 - s.gridHz;
                  const step =
                    Math.abs(err) > 0.2
                      ? THREE.MathUtils.clamp(err, -1.5, 1.5)
                      : 0.5;
                  playRheostatDetentClick(2);
                  s.adjustExcitationTrim(step);
                }
                playSwitchClank(false);
              };
              window.addEventListener("pointermove", handleMove);
              window.addEventListener("pointerup", handleUp);
              window.addEventListener("pointercancel", handleUp);
            }}
          >
            {/* Generous Invisible Hit-Cylinder around 50HZ RHEOSTAT */}
            <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.165, 0.165, 0.12, 16]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
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
                ref={rheostatRingMatRef}
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
                  ref={rheostatPointerMatRef}
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

        {/* Lower Row: 4 Guarded Metal Toggle Switches (with U-Shaped Side Safety Guards & Caged Jewel Lamps) in a Clean Unobstructed Horizontal Row */}
        <group position={[0, 0.54, 0.04]}>
          <mesh position={[0, 0.02, -0.01]} castShadow receiveShadow>
            <boxGeometry args={[1.48, 0.34, 0.04]} />
            <meshStandardMaterial
              color="#141414"
              roughness={0.45}
              metalness={0.65}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          {/* Single Horizontal Row: 4 Guarded Metal Toggle Switches (`VENTILATION`, `AUDIO [M]`, `KGB LINE`, `AUX LOOP B`) */}
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
                s.toggleAuxLoopB();
              }
            };
            return (
              <group
                key={`toggle-${tSpec.id}`}
                position={[-0.51 + tIdx * 0.34, -0.02, 0.018]}
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
                {/* Engraved Brass/Iron Plaque Above Toggle */}
                <mesh position={[0, 0.105, 0.008]}>
                  <planeGeometry args={[0.28, 0.072]} />
                  <meshStandardMaterial
                    map={tSpec.texture}
                    emissive="#ffffff"
                    emissiveMap={tSpec.texture}
                    emissiveIntensity={0.32}
                    roughness={0.65}
                  />
                </mesh>
                <CagedSovietJewelLamp3D
                  position={[-0.088, 0.0, 0.012]}
                  lampMatRef={{
                    get current() {
                      return toggleLampRefs.current[tIdx] ?? null;
                    },
                    set current(el: THREE.MeshStandardMaterial | null) {
                      toggleLampRefs.current[tIdx] = el;
                    },
                  }}
                  scale={0.78}
                />
                {/* Hex Brass Mounting Nut */}
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.026, 0.029, 0.018, 6]} />
                  <meshStandardMaterial
                    color="#b8a46b"
                    metalness={0.86}
                    roughness={0.26}
                    bumpMap={brassTex.bumpMap}
                    bumpScale={0.005}
                  />
                </mesh>
                {/* U-Shaped Side Safety Guard Brackets */}
                {[-0.032, 0.032].map((gx, gIdx) => (
                  <group key={gIdx} position={[gx, 0, 0.02]}>
                    <mesh castShadow>
                      <boxGeometry args={[0.007, 0.068, 0.038]} />
                      <meshStandardMaterial
                        color="#b8a46b"
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
                  position={[0, 0, 0.012]}
                >
                  <mesh
                    position={[0, 0, 0.03]}
                    rotation={[Math.PI / 2, 0, 0]}
                    castShadow
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

      {/* 4. BEVELED ANGLE-IRON SEAMS FOR ENLARGED K.O.M.R.A.D.-84 MAINFRAME (+40% WIDTH, +30% HEIGHT) */}
      <group position={[0, 0.14, 2.18]}>
        <group position={[0, 0, -1.62]}>
          <primitive object={terminalHousingModel} />
          {/* Heavy Welded Corner L-Angle Trim & Recessed Bezel Bolts on Enlarged K.O.M.R.A.D.-84 Mainframe */}
          <mesh position={[-1.16, 1.18, 0.04]} castShadow receiveShadow>
            <boxGeometry args={[0.048, 2.34, 0.048]} />
            <meshStandardMaterial
              color="#18211b"
              metalness={0.68}
              roughness={0.44}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          <mesh position={[1.16, 1.18, 0.04]} castShadow receiveShadow>
            <boxGeometry args={[0.048, 2.34, 0.048]} />
            <meshStandardMaterial
              color="#18211b"
              metalness={0.68}
              roughness={0.44}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          {[-0.92, -0.46, 0, 0.46, 0.92].map((bx, idx) => (
            <mesh
              key={idx}
              position={[bx, 2.26, 0.145]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.014, 0.014, 0.018, 6]} />
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
        position={[-1.25, 2.02, 2.75]}
        color="#ffba5c"
        intensity={2.6}
        distance={6.2}
        decay={1.3}
      />

      {/* Consolidated Right + Rear Wrap-Around Control Wing Pool Light */}
      <pointLight
        position={[1.15, 2.02, 2.85]}
        color="#ffba5c"
        intensity={2.5}
        distance={6.2}
        decay={1.3}
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

const HOURLY_CRT_BANNERS: readonly string[] = [
  "00:00 — SHIFT START: INSPECT DIRECTIVES, DISPATCH IN TUBE, MATCH REGIONAL MW TARGETS",
  "01:00 — HOUR 01: MONITOR WATER RESERVOIR LEVEL — KEEP VODKA DISTILLERY ABOVE 40% H2O",
  "02:00 — HOUR 02: WATCH FOR FORGED CIA DIRECTIVES — SHRED SABOTAGE ORDERS IMMEDIATELY",
  "03:00 — HOUR 03: MID-SHIFT COOLING AUDIT — BALANCE HELIUM-N2 LOOP & BUBBLER DRAIN",
  "04:00 — HOUR 04: PEAK GRID DEMAND — MATCH CITY, DUGA RADAR & VODKA MILL MW QUOTAS",
  "05:00 — HOUR 05: FINAL HOUR — HOLD CORE BELOW 900°C UNTIL 06:00 MORNING SIREN",
];

const Komrad84SplitScreenCrt3D: React.FC<{
  bulletinIdx: number;
  onCycleBulletin: () => void;
}> = React.memo(({ bulletinIdx, onCycleBulletin }) => {
  const crtMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lastCrtDrawRef = useRef(0);

  const crtTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    // Capped at 1024x640 (2.5x faster GPU texture upload than 1600x1000 while keeping crisp retro phosphor text)
    canvas.width = 1024;
    canvas.height = 640;
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.anisotropy = 8;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const curvedCrtGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1.88, 1.17, 16, 12);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / 0.94;
      const y = pos.getY(i) / 0.585;
      const r2 = x * x + y * y;
      const bulge = Math.max(0, 1 - r2 * 0.42) * 0.028;
      pos.setZ(i, bulge);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    if (now - lastCrtDrawRef.current < 0.08) return;

    const state = useGameStore.getState();
    const deskState = useDeskStore.getState();
    const activeDeskDoc = deskState.documents[0] ?? null;
    const timeBucket = Math.floor(now * 4);
    const lastEntryId =
      state.terminalEntries[state.terminalEntries.length - 1]?.id ?? "0";
    const smw = state.sectorMW;
    const tsmw = state.targetSectorMW;
    const cdSec = Math.ceil(deskState.directiveCooldown);
    const contextualHint =
      state.hoveredDiagnosticId !== null || state.tutorialStep === "DONE"
        ? getContextualDiagnosticHint(state, deskState.printingDoc !== null)
        : null;
    const sig = `${timeBucket}|${state.phase}|${state.tutorialStep}|${cdSec}|${contextualHint ?? ""}|${deskState.printingDoc?.id ?? ""}|${deskState.capsuleState}|${deskState.hatchOpen}|${lastEntryId}|${smw.pripyat}|${smw.kolkhoz}|${smw.duga}|${smw.kgb}|${smw.vodka}|${smw.steel}|${tsmw.pripyat}|${tsmw.kolkhoz}|${tsmw.duga}|${tsmw.kgb}|${tsmw.vodka}|${tsmw.steel}|${Math.round(state.pripyatWater)}|${Math.round(state.kolkhozWater)}|${Math.round(state.vodkaWater)}|${Math.ceil(state.vodkaDroughtTimer)}|${state.bubblerDraining}|${state.auxLoopBActive}|${state.kgbLineActive}|${activeDeskDoc?.id ?? "NONE"}|${activeDeskDoc?.stamps.length ?? 0}|${Math.round(state.pumpThrottle[0])}|${Math.round(state.pumpThrottle[1])}|${Math.round(state.waterReservoir)}|${Math.round(state.waterUsage)}|${Math.round(state.coreTemp / 2) * 2}|${state.ciaIntrusionActive}|${Math.round(state.ciaIntrusionProgress)}|${state.komradOverrideLocked}|${state.isBlackout}|${bulletinIdx}`;
    const tex = crtMatRef.current?.map as THREE.CanvasTexture | undefined;
    const canvas = tex?.image as HTMLCanvasElement | undefined;
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
    ctx.fillStyle = state.isBlackout ? "#020804" : "#05160a";
    ctx.fillRect(0, 0, w, h);

    // Outer double border
    ctx.strokeStyle = "#33ff66";
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.strokeStyle = "rgba(51, 255, 102, 0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, w - 36, h - 36);

    // =========================================================================
    // TOP TELEMETRY HEADER BAR (y = 18..86)
    // =========================================================================
    ctx.fillStyle = "rgba(14, 52, 26, 0.85)";
    ctx.fillRect(20, 20, w - 40, 64);
    ctx.strokeStyle = "#33ff66";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(18, 86);
    ctx.lineTo(w - 18, 86);
    ctx.stroke();

    const totalSuppliedMW = state.isBlackout
      ? 0
      : smw.pripyat + smw.kolkhoz + smw.duga + smw.kgb + smw.vodka + smw.steel;
    const totalTargetMW =
      tsmw.pripyat +
      tsmw.kolkhoz +
      tsmw.duga +
      tsmw.kgb +
      tsmw.vodka +
      tsmw.steel;
    const waterPct = Math.round(state.waterReservoir);
    const waterDraw = Math.round(state.waterUsage);

    const totalMinutes = Math.floor(state.shiftTimeMinutes);
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");

    ctx.font = 'bold 28px "VT323", monospace';
    ctx.textAlign = "left";
    ctx.fillStyle = "#33ff66";
    ctx.fillText("K.O.M.R.A.D.-84 // SECTOR 04 GRID", 34, 61);

    // Total Output Pill
    const mwDiff = Math.abs(totalSuppliedMW - totalTargetMW);
    ctx.fillStyle =
      totalSuppliedMW > 140
        ? "#ff2a2a"
        : mwDiff <= 10
          ? "#33ff66"
          : "#ffb000";
    ctx.fillText(
      `| TOTAL OUTPUT: ${totalSuppliedMW} / ${totalTargetMW} MW`,
      430,
      61,
    );

    // Water Reservoir Pill
    ctx.fillStyle =
      waterPct < 30 ? "#ff2a2a" : waterPct < 45 ? "#ffb000" : "#38e8ff";
    ctx.fillText(
      `| WATER RESERVOIR: ${waterPct}% (DRAW: ${waterDraw} L/s)`,
      795,
      61,
    );

    // Clock Pill
    ctx.textAlign = "right";
    ctx.fillStyle = state.ciaIntrusionActive ? "#ff2a2a" : "#e6dec3";
    ctx.fillText(
      state.ciaIntrusionActive
        ? `CIA HACK: ${Math.round(state.ciaIntrusionProgress)}% | ${hh}:${mm}`
        : `CLOCK: ${hh}:${mm} / 06:00`,
      w - 34,
      61,
    );

    // =========================================================================
    // SPLIT-SCREEN DIVIDER (Left 62% Regional Vector Map: x=24..996, Right 38% AI Log: x=1008..1576)
    // =========================================================================
    const mapX = 24;
    const mapY = 96;
    const mapW = 972;
    const mapH = h - 118;

    const chatX = 1008;
    const chatY = 96;
    const chatW = w - chatX - 24;
    const chatH = h - 118;

    // Frame Left Map Panel
    ctx.fillStyle = "rgba(4, 18, 9, 0.94)";
    ctx.fillRect(mapX, mapY, mapW, mapH);
    ctx.strokeStyle = "#29cc54";
    ctx.lineWidth = 3;
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    // -------------------------------------------------------------------------
    // 1. DETAILED GEOGRAPHIC & TOPOGRAPHICAL BACKGROUND
    // -------------------------------------------------------------------------
    // Tactical Grid + Forest Sector Coordinates (A-1 through F-6)
    ctx.strokeStyle = "rgba(51, 255, 102, 0.09)";
    ctx.lineWidth = 1;
    const colLabels = ["A", "B", "C", "D", "E", "F"];
    for (let c = 0; c < 6; c++) {
      const gx = mapX + (c + 1) * (mapW / 6);
      if (c < 5) {
        ctx.beginPath();
        ctx.moveTo(gx, mapY + 42);
        ctx.lineTo(gx, mapY + mapH);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(51, 255, 102, 0.42)";
      ctx.font = 'bold 15px "VT323", monospace';
      ctx.textAlign = "center";
      ctx.fillText(
        `SEC-${colLabels[c]}`,
        mapX + (c + 0.5) * (mapW / 6),
        mapY + 60,
      );
    }
    for (let r = 0; r < 6; r++) {
      const gy = mapY + 42 + (r + 1) * ((mapH - 42) / 6);
      if (r < 5) {
        ctx.beginPath();
        ctx.moveTo(mapX, gy);
        ctx.lineTo(mapX + mapW, gy);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(51, 255, 102, 0.42)";
      ctx.font = 'bold 15px "VT323", monospace';
      ctx.textAlign = "left";
      ctx.fillText(
        `${colLabels[r]}-${r + 1}`,
        mapX + 8,
        mapY + 58 + r * ((mapH - 42) / 6),
      );
    }

    // Topographical Elevation Contour Rings (#0d3b1e / #144d29)
    ctx.save();
    ctx.strokeStyle = "#0e4221";
    ctx.lineWidth = 1.5;
    const contourHills = [
      { cx: mapX + 790, cy: mapY + 150, rx: 145, ry: 75 },
      { cx: mapX + 810, cy: mapY + 435, rx: 135, ry: 72 },
      { cx: mapX + 185, cy: mapY + 435, rx: 140, ry: 70 },
      { cx: mapX + 780, cy: mapY + 715, rx: 145, ry: 74 },
    ];
    for (const hill of contourHills) {
      for (let ring = 1; ring <= 3; ring++) {
        ctx.beginPath();
        ctx.ellipse(
          hill.cx,
          hill.cy,
          hill.rx * (0.55 + ring * 0.18),
          hill.ry * (0.55 + ring * 0.18),
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
    }
    ctx.restore();

    // Red Forest Pine Clusters (Рыжий Лес)
    const pineClusters = [
      [mapX + 365, mapY + 125],
      [mapX + 390, mapY + 140],
      [mapX + 595, mapY + 130],
      [mapX + 625, mapY + 145],
      [mapX + 615, mapY + 340],
      [mapX + 640, mapY + 355],
      [mapX + 355, mapY + 610],
      [mapX + 380, mapY + 625],
    ] as const;
    ctx.strokeStyle = "#1a6633";
    ctx.lineWidth = 1.5;
    for (const [px, py] of pineClusters) {
      ctx.beginPath();
      ctx.moveTo(px, py - 10);
      ctx.lineTo(px - 7, py + 4);
      ctx.lineTo(px + 7, py + 4);
      ctx.closePath();
      ctx.stroke();
    }

    // Yanov-Chernobyl Railway Line with Cross-Ties (Ж/Д ЛИНИЯ ЯНОВ)
    ctx.save();
    ctx.strokeStyle = "#1f6b39";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mapX + 20, mapY + 305);
    ctx.lineTo(mapX + 440, mapY + 445);
    ctx.lineTo(mapX + mapW - 20, mapY + 595);
    ctx.stroke();
    ctx.setLineDash([3, 9]);
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.restore();

    // Winding Pripyat River & Cooling Reservoir Lake ("РЕКА ПРИПЯТЬ // ПРУД-ОХЛАДИТЕЛЬ")
    ctx.save();
    const riverFillCol =
      waterPct < 30 ? "rgba(255, 58, 58, 0.25)" : "rgba(32, 195, 245, 0.22)";
    ctx.strokeStyle = riverFillCol;
    ctx.lineWidth = 44;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mapX + 310, mapY + 55);
    ctx.bezierCurveTo(
      mapX + 340,
      mapY + 210,
      mapX + 415,
      mapY + 335,
      mapX + 465,
      mapY + 455,
    );
    ctx.bezierCurveTo(
      mapX + 515,
      mapY + 575,
      mapX + 435,
      mapY + 715,
      mapX + 485,
      mapY + mapH - 18,
    );
    ctx.stroke();

    // Cooling Reservoir Lake Basin beside Chernobyl-4 Plant
    ctx.fillStyle = riverFillCol;
    ctx.strokeStyle = waterPct < 30 ? "#ff4444" : "#2bc4eb";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(mapX + 445, mapY + 495, 82, 46, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Irrigation Canal Branch to Kolkhoz "Zarya" (West) & Intake Main to Vodka Distillery (SW)
    ctx.strokeStyle = waterPct < 35 ? "rgba(255,60,60,0.45)" : "rgba(45,215,255,0.42)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(mapX + 410, mapY + 380);
    ctx.lineTo(mapX + 225, mapY + 425);
    ctx.moveTo(mapX + 455, mapY + 635);
    ctx.lineTo(mapX + 245, mapY + 705);
    ctx.stroke();

    // Animated cyan water current chevrons along Pripyat River
    ctx.strokeStyle = waterPct < 30 ? "#ff4444" : "#38e8ff";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 12]);
    ctx.lineDashOffset = -(timeBucket * 6);
    ctx.beginPath();
    ctx.moveTo(mapX + 310, mapY + 55);
    ctx.bezierCurveTo(
      mapX + 340,
      mapY + 210,
      mapX + 415,
      mapY + 335,
      mapX + 465,
      mapY + 455,
    );
    ctx.bezierCurveTo(
      mapX + 515,
      mapY + 575,
      mapX + 435,
      mapY + 715,
      mapX + 485,
      mapY + mapH - 18,
    );
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = waterPct < 30 ? "#ff6666" : "#38e8ff";
    ctx.font = 'bold 17px "VT323", monospace';
    ctx.textAlign = "center";
    ctx.fillText("РЕКА ПРИПЯТЬ", mapX + 385, mapY + 255);
    ctx.fillText("ПРУД-ОХЛАДИТЕЛЬ", mapX + 445, mapY + 556);

    // Map Sub-Header Banner
    ctx.fillStyle = "rgba(18, 68, 34, 0.92)";
    ctx.fillRect(mapX + 2, mapY + 2, mapW - 4, 40);
    ctx.fillStyle = "#33ff66";
    ctx.font = 'bold 23px "VT323", monospace';
    ctx.textAlign = "left";
    ctx.fillText(
      "SECTOR 84 TOPOGRAPHICAL POWER & WATER GRID // 6-NODE SUBSTATION MAP",
      mapX + 14,
      mapY + 29,
    );

    ctx.textAlign = "right";
    if (state.activeMandate) {
      ctx.fillStyle = "#ffb000";
      ctx.fillText(
        `ACTIVE ORDER: ${state.activeMandate.title.slice(0, 28)}`,
        mapX + mapW - 14,
        mapY + 29,
      );
    }

    // -------------------------------------------------------------------------
    // COORDINATES OF CENTER REACTOR & 6 REGIONAL SUBSTATION NODES
    // -------------------------------------------------------------------------
    const reactorCx = mapX + 486;
    const reactorCy = mapY + 425;

    const nodes = {
      pripyat: { cx: mapX + 175, cy: mapY + 145 },
      kolkhoz: { cx: mapX + 175, cy: mapY + 425 },
      vodka: { cx: mapX + 175, cy: mapY + 705 },
      duga: { cx: mapX + 795, cy: mapY + 145 },
      kgb: { cx: mapX + 795, cy: mapY + 425 },
      steel: { cx: mapX + 795, cy: mapY + 705 },
    };

    // Helper: Draw High-Voltage Transmission Line (MW) + Optional Water Main (H2O) with Siphon/Drain Arrow Animation
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
            ? "#33ff66"
            : "#ffb000";

      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 3.5;
      ctx.setLineDash([12, 8]);
      ctx.lineDashOffset = -(timeBucket * 7);
      ctx.beginPath();
      ctx.moveTo(reactorCx, reactorCy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.restore();

      if (hasWater) {
        const isDrainingOutward = state.bubblerDraining && state.bubblerLevel > 0;
        const wCol = isDrainingOutward
          ? "#44ffaa"
          : zoneWaterPct >= minWater
            ? "#38e8ff"
            : "#ff2a2a";
        const dashSpeed = isDrainingOutward
          ? -(timeBucket * 11)
          : isSiphoningInward
            ? timeBucket * 11
            : -(timeBucket * 3);
        const startX = reactorCx - 12;
        const startY = reactorCy + 12;
        const endX = tx;
        const endY = ty + 12;

        ctx.save();
        ctx.strokeStyle = wCol;
        ctx.lineWidth = isSiphoningInward || isDrainingOutward ? 3.5 : 2.5;
        ctx.setLineDash([7, 6]);
        ctx.lineDashOffset = dashSpeed;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Draw animated directional chevron arrows along the water pipe
        const dx = endX - startX;
        const dy = endY - startY;
        const angle = Math.atan2(dy, dx);
        // When siphoning inward, arrows point FROM node TO reactor (angle + Math.PI)
        // When draining bubbler outward (or recharging), arrows point FROM reactor TO node (angle)
        const arrowAngle =
          isSiphoningInward && !isDrainingOutward ? angle + Math.PI : angle;
        for (const tPos of [0.35, 0.65]) {
          const ax = startX + dx * tPos;
          const ay = startY + dy * tPos;
          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(arrowAngle);
          ctx.fillStyle = wCol;
          ctx.beginPath();
          ctx.moveTo(7, 0);
          ctx.lineTo(-5, -5);
          ctx.lineTo(-5, 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }
    };

    const pumpASiphoning =
      !state.isBlackout && state.pumpsActive[0] && state.pumpThrottle[0] > 40;
    const pumpBSiphoning =
      !state.isBlackout && state.pumpsActive[1] && state.pumpThrottle[1] > 40;

    drawTransmissionLink(
      nodes.pripyat.cx,
      nodes.pripyat.cy,
      smw.pripyat,
      tsmw.pripyat,
      true,
      Math.round(state.pripyatWater),
      30,
      pumpASiphoning,
    );
    drawTransmissionLink(
      nodes.kolkhoz.cx,
      nodes.kolkhoz.cy,
      smw.kolkhoz,
      tsmw.kolkhoz,
      true,
      Math.round(state.kolkhozWater),
      35,
      pumpASiphoning,
    );
    drawTransmissionLink(
      nodes.duga.cx,
      nodes.duga.cy,
      smw.duga,
      tsmw.duga,
      false,
      100,
      0,
      false,
    );
    drawTransmissionLink(
      nodes.kgb.cx,
      nodes.kgb.cy,
      smw.kgb,
      tsmw.kgb,
      false,
      100,
      0,
      false,
    );
    drawTransmissionLink(
      nodes.vodka.cx,
      nodes.vodka.cy,
      smw.vodka,
      tsmw.vodka,
      true,
      Math.round(state.vodkaWater),
      40,
      pumpBSiphoning,
    );
    drawTransmissionLink(
      nodes.steel.cx,
      nodes.steel.cy,
      smw.steel,
      tsmw.steel,
      false,
      100,
      0,
      false,
    );

    // -------------------------------------------------------------------------
    // 2. CENTERPIECE: CHERNOBYL-4 ATOMIC COMPLEX (АЭС БЛОК №4)
    // -------------------------------------------------------------------------
    {
      const cx = reactorCx;
      const cy = reactorCy;
      const coreCrit = state.coreTemp >= 760;
      const plantCol = coreCrit ? "#ff2a2a" : "#33ff66";

      // Switchyard perimeter & dark pad
      ctx.fillStyle = "rgba(5, 22, 11, 0.94)";
      ctx.fillRect(cx - 118, cy - 86, 236, 178);
      ctx.strokeStyle = plantCol;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(cx - 118, cy - 86, 236, 178);

      // Two Hyperboloid Cooling Towers on Right of Complex with Rising Steam Puffs
      for (let tIdx = 0; tIdx < 2; tIdx++) {
        const tx = cx + 44 + tIdx * 42;
        const ty = cy - 6;
        ctx.fillStyle = "#082613";
        ctx.strokeStyle = plantCol;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx - 16, ty + 18);
        ctx.quadraticCurveTo(tx - 9, ty - 8, tx - 12, ty - 28);
        ctx.lineTo(tx + 12, ty - 28);
        ctx.quadraticCurveTo(tx + 9, ty - 8, tx + 16, ty + 18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Animated Steam Puffs above Cooling Towers
        const puffOff = ((timeBucket + tIdx * 2) % 4) * 4;
        ctx.strokeStyle = "#88ffaa";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tx - 4, ty - 35 - puffOff, 5, 0, Math.PI * 2);
        ctx.arc(tx + 5, ty - 39 - puffOff, 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Main Rectangular Turbine Hall (МАШЗАЛ) & Reactor Block No. 4 Sarcophagus
      ctx.fillStyle = "#0b3018";
      ctx.strokeStyle = plantCol;
      ctx.lineWidth = 2.2;
      ctx.fillRect(cx - 102, cy - 12, 124, 28);
      ctx.strokeRect(cx - 102, cy - 12, 124, 28);
      // Turbine Hall lit windows
      ctx.fillStyle = state.isBlackout ? "#163020" : "#55ff88";
      for (let wx = cx - 94; wx < cx + 14; wx += 12) {
        ctx.fillRect(wx, cy - 4, 7, 10);
      }

      // Reactor Block 4 Upper Containment Building
      ctx.fillStyle = "#0e3b1e";
      ctx.fillRect(cx - 58, cy - 38, 56, 26);
      ctx.strokeRect(cx - 58, cy - 38, 56, 26);

      // Tall Striped Ventilation Stack (ВЕНТТРУБА АЭС-4) above Reactor Block
      ctx.fillStyle = "#061c0d";
      ctx.fillRect(cx - 35, cy - 78, 10, 40);
      ctx.strokeRect(cx - 35, cy - 78, 10, 40);
      ctx.fillStyle = "#ffb000";
      ctx.fillRect(cx - 34, cy - 70, 8, 5);
      ctx.fillRect(cx - 34, cy - 56, 8, 5);
      // Blinking beacon at top of stack
      if (timeBucket % 2 === 0) {
        ctx.fillStyle = "#ff2a2a";
        ctx.beginPath();
        ctx.arc(cx - 30, cy - 82, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Center Complex Telemetry Tag
      ctx.fillStyle = plantCol;
      ctx.fillRect(cx - 114, cy + 22, 228, 22);
      ctx.fillStyle = "#041208";
      ctx.font = 'bold 17px "VT323", monospace';
      ctx.textAlign = "center";
      ctx.fillText("CHERNOBYL-4 ATOMIC COMPLEX (АЭС-4)", cx, cy + 38);

      ctx.fillStyle = coreCrit ? "#ff4444" : "#33ff66";
      ctx.font = 'bold 18px "VT323", monospace';
      ctx.fillText(
        `CORE: ${Math.round(state.coreTemp)}°C | H2O RESERVOIR: ${waterPct}%`,
        cx,
        cy + 61,
      );
      ctx.fillStyle = "#38e8ff";
      ctx.font = '16px "VT323", monospace';
      ctx.fillText(
        state.bubblerDraining
          ? `DRAINING BUBBLER (${Math.round(state.bubblerLevel)}%) -> REFILLING ZONES!`
          : `PUMP DRAW: ${waterDraw} L/s | BUBBLER H2O: ${Math.round(state.bubblerLevel)}%`,
        cx,
        cy + 81,
      );
    }

    // -------------------------------------------------------------------------
    // 3. SIX RECOGNIZABLE ARCHITECTURAL SILHOUETTES & TELEMETRY BADGES
    // -------------------------------------------------------------------------
    const drawNodeBadgeAndFrame = (opts: {
      cx: number;
      cy: number;
      codeTitle: string;
      ruSub: string;
      suppliedMW: number;
      targetMW: number;
      hasWater: boolean;
      zoneWaterPct?: number;
      minWater: number;
      droughtStatusText?: string;
      extraStatus?: string;
      drawSilhouette: (
        x0: number,
        y0: number,
        w: number,
        h: number,
        powered: boolean,
        col: string,
      ) => void;
    }) => {
      const boxW = 286;
      const boxH = 194;
      const x0 = opts.cx - boxW / 2;
      const y0 = opts.cy - boxH / 2;
      const dispMW = state.isBlackout ? 0 : opts.suppliedMW;
      const powered = dispMW > 0 && !state.isBlackout;
      const mwOk = !state.isBlackout && Math.abs(dispMW - opts.targetMW) <= 5;
      const zWater = opts.zoneWaterPct ?? waterPct;
      const waterOk = !opts.hasWater || zWater >= opts.minWater;
      const isAlert = !powered || !waterOk;
      const borderCol = isAlert
        ? "#ff2a2a"
        : mwOk
          ? "#33ff66"
          : "#ffb000";

      // Card Backing
      ctx.fillStyle = isAlert
        ? "rgba(42, 8, 8, 0.92)"
        : mwOk
          ? "rgba(5, 28, 14, 0.92)"
          : "rgba(34, 24, 4, 0.92)";
      ctx.fillRect(x0, y0, boxW, boxH);
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x0, y0, boxW, boxH);

      // Top Title Banner
      ctx.fillStyle = borderCol;
      ctx.fillRect(x0, y0, boxW, 24);
      ctx.fillStyle = "#041208";
      ctx.font = 'bold 18px "VT323", monospace';
      ctx.textAlign = "left";
      ctx.fillText(opts.codeTitle, x0 + 8, y0 + 18);
      ctx.textAlign = "right";
      ctx.fillText(opts.ruSub, x0 + boxW - 8, y0 + 18);

      // Architectural Silhouette Viewport (y0 + 26 .. y0 + 118)
      const silX = x0 + 8;
      const silY = y0 + 28;
      const silW = boxW - 16;
      const silH = 88;
      ctx.fillStyle = "rgba(3, 14, 7, 0.85)";
      ctx.fillRect(silX, silY, silW, silH);
      ctx.strokeStyle = "rgba(51, 255, 102, 0.25)";
      ctx.lineWidth = 1;
      ctx.strokeRect(silX, silY, silW, silH);

      // Ground horizon line inside silhouette viewport
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(silX + 4, silY + silH - 8);
      ctx.lineTo(silX + silW - 4, silY + silH - 8);
      ctx.stroke();

      opts.drawSilhouette(silX, silY, silW, silH, powered, borderCol);

      // Telemetry Badge Section (y0 + 122 .. y0 + 190)
      ctx.textAlign = "left";
      ctx.font = 'bold 20px "VT323", monospace';
      ctx.fillStyle = state.isBlackout
        ? "#ff2a2a"
        : mwOk
          ? "#33ff66"
          : "#ffb000";
      ctx.fillText(
        `MW: ${dispMW} / ${opts.targetMW} MW`,
        x0 + 10,
        y0 + 138,
      );

      // H2O or Special Status on Right
      ctx.textAlign = "right";
      if (opts.hasWater) {
        const droughtFlash = !waterOk && timeBucket % 2 === 0;
        ctx.fillStyle = waterOk
          ? "#38e8ff"
          : droughtFlash
            ? "#ffffff"
            : "#ff2a2a";
        ctx.fillText(
          waterOk ? `H2O: OK (${zWater}%)` : `H2O: DRY! (${zWater}% <${opts.minWater}%)`,
          x0 + boxW - 10,
          y0 + 138,
        );
      } else if (opts.extraStatus) {
        ctx.fillStyle = powered ? "#7be896" : "#ff4444";
        ctx.fillText(opts.extraStatus, x0 + boxW - 10, y0 + 138);
      }

      // MW Bar Graph (0..50 MW)
      const barX = x0 + 10;
      const barY = y0 + 146;
      const barW = boxW - 20;
      const barH = 12;
      ctx.fillStyle = "#071a0d";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(barX, barY, barW, barH);

      const fillRatio = Math.min(1, dispMW / 50);
      ctx.fillStyle = mwOk ? "#33ff66" : "#ffb000";
      ctx.fillRect(barX + 2, barY + 2, (barW - 4) * fillRatio, barH - 4);

      const targetX = barX + 2 + (barW - 4) * Math.min(1, opts.targetMW / 50);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(targetX - 2, barY - 2, 4, barH + 4);

      // Bottom Control Hint / Drought Alert / Blackout Banner
      ctx.textAlign = "left";
      ctx.font = 'bold 15px "VT323", monospace';
      if (state.isBlackout) {
        ctx.fillStyle = timeBucket % 2 === 0 ? "#ffffff" : "#ff4444";
        ctx.fillText(
          "GRID DISCONNECTED — 0 MW SUPPLIED!",
          x0 + 10,
          y0 + 182,
        );
      } else {
        ctx.fillStyle = !waterOk ? "#ff4444" : "#9be6b0";
        ctx.fillText(
          !waterOk && opts.droughtStatusText
            ? opts.droughtStatusText
            : mwOk
              ? "STATUS: QUOTA MATCHED [OK]"
              : `ADJUST UNIT A LEVER TO ${opts.targetMW} MW`,
          x0 + 10,
          y0 + 182,
        );
      }
    };

    // NODE 1 (North-West): PRIPYAT WORKERS' CITY (5 Khrushchyovka Towers + Ferris Wheel)
    drawNodeBadgeAndFrame({
      cx: nodes.pripyat.cx,
      cy: nodes.pripyat.cy,
      codeTitle: "[1] PRIPYAT CITY",
      ruSub: "ГОРОД ПРИПЯТЬ",
      suppliedMW: smw.pripyat,
      targetMW: tsmw.pripyat,
      hasWater: true,
      zoneWaterPct: Math.round(state.pripyatWater),
      minWater: 30,
      droughtStatusText: "STATUS: CITY PIPES DRY — CAVITATION!",
      drawSilhouette: (sx, sy, sw, sh, powered, col) => {
        const groundY = sy + sh - 8;
        const towers = [
          { dx: 16, w: 26, h: 56 },
          { dx: 48, w: 30, h: 68 },
          { dx: 84, w: 28, h: 52 },
          { dx: 118, w: 32, h: 64 },
          { dx: 156, w: 26, h: 48 },
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
            for (let wy = ty + 6; wy < groundY - 6; wy += 9) {
              for (let wx = tx + 5; wx < tx + t.w - 5; wx += 8) {
                ctx.fillRect(wx, wy, 4, 5);
              }
            }
          }
        }
        // Pripyat Iconic Ferris Wheel (Колесо Обозрения) on Right
        const wheelCx = sx + sw - 46;
        const wheelCy = groundY - 38;
        const wheelR = 24;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wheelCx, wheelCy, wheelR, 0, Math.PI * 2);
        ctx.stroke();
        // A-frame support legs
        ctx.beginPath();
        ctx.moveTo(wheelCx - 16, groundY);
        ctx.lineTo(wheelCx, wheelCy);
        ctx.lineTo(wheelCx + 16, groundY);
        ctx.stroke();
        // Rotating spokes & yellow passenger cabins
        const rotOffset = powered ? timeBucket * 0.25 : 0;
        for (let i = 0; i < 8; i++) {
          const ang = rotOffset + (i * Math.PI) / 4;
          const rx = wheelCx + Math.cos(ang) * wheelR;
          const ry = wheelCy + Math.sin(ang) * wheelR;
          ctx.beginPath();
          ctx.moveTo(wheelCx, wheelCy);
          ctx.lineTo(rx, ry);
          ctx.stroke();
          ctx.fillStyle = powered ? "#ffb000" : "#1f4d2e";
          ctx.fillRect(rx - 3, ry - 3, 6, 6);
        }
      },
    });

    // NODE 2 (West): KOLKHOZ "ZARYA" AGRO-COLLECTIVE (Twin Grain Silos, Barn & Greenhouses)
    drawNodeBadgeAndFrame({
      cx: nodes.kolkhoz.cx,
      cy: nodes.kolkhoz.cy,
      codeTitle: "[2] KOLKHOZ FARM",
      ruSub: "СОВХОЗ «ЗАРЯ»",
      suppliedMW: smw.kolkhoz,
      targetMW: tsmw.kolkhoz,
      hasWater: true,
      zoneWaterPct: Math.round(state.kolkhozWater),
      minWater: 35,
      droughtStatusText: "STATUS: IRRIGATION DRY — PUMP DRAG!",
      drawSilhouette: (sx, sy, _sw, sh, powered, col) => {
        const groundY = sy + sh - 8;
        // Twin Cylindrical Grain Silos with Conical Roofs
        for (let sIdx = 0; sIdx < 2; sIdx++) {
          const gx = sx + 20 + sIdx * 32;
          const gy = groundY - 54;
          ctx.fillStyle = "#0a2915";
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.8;
          ctx.fillRect(gx, gy, 24, 54);
          ctx.strokeRect(gx, gy, 24, 54);
          ctx.beginPath();
          ctx.moveTo(gx - 2, gy);
          ctx.lineTo(gx + 12, gy - 14);
          ctx.lineTo(gx + 26, gy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        // Pitched-Roof Livestock Barn in Center
        const bx = sx + 92;
        const by = groundY - 34;
        ctx.fillStyle = "#0a2915";
        ctx.strokeStyle = col;
        ctx.fillRect(bx, by, 76, 34);
        ctx.strokeRect(bx, by, 76, 34);
        ctx.beginPath();
        ctx.moveTo(bx - 4, by);
        ctx.lineTo(bx + 38, by - 18);
        ctx.lineTo(bx + 80, by);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (powered) {
          ctx.fillStyle = "#ffe066";
          for (let wx = bx + 10; wx < bx + 68; wx += 14) {
            ctx.fillRect(wx, by + 12, 8, 8);
          }
        }
        // Arched Glass Greenhouses on Right
        for (let gIdx = 0; gIdx < 2; gIdx++) {
          const ghX = sx + 195 + gIdx * 36;
          ctx.strokeStyle = powered ? "#38e8ff" : col;
          ctx.beginPath();
          ctx.arc(ghX, groundY, 15, Math.PI, 0);
          ctx.stroke();
        }
      },
    });

    // NODE 3 (North-East): DUGA-1 OTH RADAR ARRAY ("Russian Woodpecker" Steel Lattice Wall)
    drawNodeBadgeAndFrame({
      cx: nodes.duga.cx,
      cy: nodes.duga.cy,
      codeTitle: "[3] DUGA-1 RADAR",
      ruSub: "ЗГРЛС «ДУГА-1»",
      suppliedMW: smw.duga,
      targetMW: tsmw.duga,
      hasWater: false,
      minWater: 0,
      extraStatus: state.ciaIntrusionActive ? "CIA JAMMING!" : "OTH SWEEP: OK",
      drawSilhouette: (sx, sy, sw, sh, powered, col) => {
        const groundY = sy + sh - 8;
        // 5 Tall Cross-Braced Steel Lattice Towers Connected by Horizontal Dipole Netting
        const towerXs = [sx + 24, sx + 66, sx + 108, sx + 150, sx + 192];
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.8;
        for (const tx of towerXs) {
          ctx.beginPath();
          ctx.moveTo(tx - 8, groundY);
          ctx.lineTo(tx - 4, sy + 10);
          ctx.lineTo(tx + 4, sy + 10);
          ctx.lineTo(tx + 8, groundY);
          ctx.stroke();
          // Cross-bracing X-bars
          for (let y = sy + 14; y < groundY - 10; y += 14) {
            ctx.beginPath();
            ctx.moveTo(tx - 6, y);
            ctx.lineTo(tx + 6, y + 12);
            ctx.moveTo(tx + 6, y);
            ctx.lineTo(tx - 6, y + 12);
            ctx.stroke();
          }
        }
        // Horizontal Dipole Wire Netting Across All 5 Towers
        ctx.strokeStyle = "rgba(51, 255, 102, 0.55)";
        ctx.lineWidth = 1;
        for (let wy = sy + 16; wy < groundY - 8; wy += 9) {
          ctx.beginPath();
          ctx.moveTo(towerXs[0], wy);
          ctx.lineTo(towerXs[towerXs.length - 1], wy);
          ctx.stroke();
        }
        // Animated Radar Wave Arcs Sweeping Outward on Right
        if (powered) {
          ctx.strokeStyle = state.ciaIntrusionActive ? "#ff2a2a" : "#ffb000";
          ctx.lineWidth = 2;
          for (let r = 1; r <= 3; r++) {
            const pulseR = 14 + ((timeBucket * 5 + r * 14) % 42);
            ctx.beginPath();
            ctx.arc(sx + sw - 56, sy + 42, pulseR, -0.65, 0.65);
            ctx.stroke();
          }
        }
      },
    });

    // NODE 4 (Far East): KGB SPECIAL BUNKER NO. 7 (Hexagonal Concrete Dome + Twin Radio Dishes)
    drawNodeBadgeAndFrame({
      cx: nodes.kgb.cx,
      cy: nodes.kgb.cy,
      codeTitle: "[4] KGB BUNKER 07",
      ruSub: "СПЕЦОБЪЕКТ КГБ №7",
      suppliedMW: smw.kgb,
      targetMW: tsmw.kgb,
      hasWater: false,
      minWater: 0,
      extraStatus: state.kgbLineActive ? "KGB LINE: ON" : "KGB LINE: OFF",
      drawSilhouette: (sx, sy, sw, sh, powered, col) => {
        const groundY = sy + sh - 8;
        const cx = sx + sw * 0.5;
        // Reinforced Hexagonal Concrete Bunker Dome Embedded in Hill
        ctx.fillStyle = "#0a2915";
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(cx - 72, groundY);
        ctx.lineTo(cx - 52, groundY - 34);
        ctx.lineTo(cx + 52, groundY - 34);
        ctx.lineTo(cx + 72, groundY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Heavy Blast Door & Red Star Emblem in Center of Bunker
        ctx.fillStyle = "#041208";
        ctx.fillRect(cx - 18, groundY - 24, 36, 24);
        ctx.strokeRect(cx - 18, groundY - 24, 36, 24);
        ctx.fillStyle = powered ? "#ff2a2a" : "#3a1a1a";
        ctx.font = 'bold 18px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("★ КГБ", cx, groundY - 7);

        // Twin Parabolic Radio Dish Antennas on Roof
        for (const dx of [-36, 36]) {
          const ax = cx + dx;
          const ay = groundY - 34;
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax, ay - 16);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(ax, ay - 20, 12, Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();
        }

        // Security Perimeter Fence Posts Left & Right
        for (const fx of [sx + 18, sx + 34, sx + sw - 34, sx + sw - 18]) {
          ctx.beginPath();
          ctx.moveTo(fx, groundY);
          ctx.lineTo(fx, groundY - 22);
          ctx.stroke();
        }
      },
    });

    // NODE 5 (South-West, on Riverbank): "RED OCTOBER" VODKA DISTILLERY (3 Copper Rectification Columns + Vats)
    drawNodeBadgeAndFrame({
      cx: nodes.vodka.cx,
      cy: nodes.vodka.cy,
      codeTitle: "[5] VODKA DISTILLERY",
      ruSub: "ВОДОЧНЫЙ ЗАВОД",
      suppliedMW: smw.vodka,
      targetMW: tsmw.vodka,
      hasWater: true,
      zoneWaterPct: Math.round(state.vodkaWater),
      minWater: 40,
      droughtStatusText: `STATUS: H2O SIPHONED — VODKA VATS DRY! [${Math.max(0, Math.ceil(35 - state.vodkaDroughtTimer))}s]`,
      drawSilhouette: (sx, sy, _sw, sh, powered, col) => {
        const groundY = sy + sh - 8;
        // 3 Tall Copper Distillation / Rectification Columns with Overhead Vapour Pipes
        const colXs = [sx + 24, sx + 52, sx + 80];
        ctx.strokeStyle = powered ? "#ffb000" : col;
        ctx.fillStyle = "#142e1b";
        ctx.lineWidth = 2;
        for (const cxCol of colXs) {
          ctx.fillRect(cxCol, groundY - 64, 16, 64);
          ctx.strokeRect(cxCol, groundY - 64, 16, 64);
          // Porthole sight-glasses along column
          for (let py = groundY - 52; py < groundY - 12; py += 14) {
            ctx.fillStyle = powered ? "#38e8ff" : "#0b2414";
            ctx.fillRect(cxCol + 5, py, 6, 6);
          }
          ctx.fillStyle = "#142e1b";
        }
        // Overhead connecting vapour manifold pipe
        ctx.beginPath();
        ctx.moveTo(colXs[0] + 8, groundY - 64);
        ctx.lineTo(colXs[0] + 8, groundY - 72);
        ctx.lineTo(colXs[2] + 8, groundY - 72);
        ctx.lineTo(colXs[2] + 8, groundY - 64);
        ctx.stroke();

        // Round Fermentation Vats & Brick Bottling Hall on Right
        const hallX = sx + 112;
        ctx.fillStyle = "#0a2915";
        ctx.strokeStyle = col;
        ctx.fillRect(hallX, groundY - 40, 128, 40);
        ctx.strokeRect(hallX, groundY - 40, 128, 40);
        if (powered) {
          ctx.fillStyle = "#33ff66";
          for (let wx = hallX + 10; wx < hallX + 115; wx += 18) {
            ctx.fillRect(wx, groundY - 22, 10, 10);
          }
        }
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 15px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("КРАСНЫЙ ОКТЯБРЬ", hallX + 64, groundY - 26);
      },
    });

    // NODE 6 (South-East): "AZOVSTAL" METALLURGICAL FOUNDRY (Sawtooth Roofs, 2 Blast Furnaces & 3 Smokestacks)
    drawNodeBadgeAndFrame({
      cx: nodes.steel.cx,
      cy: nodes.steel.cy,
      codeTitle: "[6] STEEL WORKS",
      ruSub: "СТАЛЬЗАВОД",
      suppliedMW: smw.steel,
      targetMW: tsmw.steel,
      hasWater: false,
      minWater: 0,
      extraStatus: smw.steel > 0 ? "FURNACES: HOT" : "FURNACES: COLD",
      drawSilhouette: (sx, sy, _sw, sh, powered, col) => {
        const groundY = sy + sh - 8;
        // Two Tapered Blast Furnace Towers on Left
        for (let bIdx = 0; bIdx < 2; bIdx++) {
          const bx = sx + 22 + bIdx * 42;
          ctx.fillStyle = "#0c2b17";
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx - 14, groundY);
          ctx.lineTo(bx - 8, groundY - 56);
          ctx.lineTo(bx + 8, groundY - 56);
          ctx.lineTo(bx + 14, groundY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          if (powered) {
            ctx.fillStyle = "#ff5533";
            ctx.fillRect(bx - 5, groundY - 18, 10, 10);
          }
        }

        // Sawtooth Factory Roof Hall & 3 Tall Smokestacks on Right
        const fx = sx + 96;
        const fw = 152;
        const fy = groundY - 34;
        ctx.fillStyle = "#0a2614";
        ctx.strokeStyle = col;
        ctx.fillRect(fx, fy, fw, 34);
        ctx.strokeRect(fx, fy, fw, 34);
        // 4 Sawtooth roof teeth
        ctx.beginPath();
        for (let t = 0; t < 4; t++) {
          const tx = fx + t * 38;
          ctx.moveTo(tx, fy);
          ctx.lineTo(tx, fy - 14);
          ctx.lineTo(tx + 38, fy);
        }
        ctx.fill();
        ctx.stroke();

        // 3 Tall Smokestacks Belching Animated Pixel Smoke
        for (let sIdx = 0; sIdx < 3; sIdx++) {
          const stX = fx + 28 + sIdx * 44;
          ctx.fillStyle = "#081f10";
          ctx.fillRect(stX, fy - 38, 10, 38);
          ctx.strokeRect(stX, fy - 38, 10, 38);
          if (powered) {
            const smokeShift = ((timeBucket + sIdx) % 4) * 4;
            ctx.fillStyle = "#7be896";
            ctx.fillRect(stX + 2 + smokeShift, fy - 48, 8, 6);
            ctx.fillRect(stX + 8 + smokeShift, fy - 56, 10, 6);
          }
        }
      },
    });

    // =========================================================================
    // RIGHT 38% OF SCREEN: DEDICATED K.O.M.R.A.D.-84 AI CHAT & COMM LOG PANEL
    // =========================================================================
    ctx.fillStyle = "rgba(4, 18, 9, 0.94)";
    ctx.fillRect(chatX, chatY, chatW, chatH);
    ctx.strokeStyle = "#33ff66";
    ctx.lineWidth = 3;
    ctx.strokeRect(chatX, chatY, chatW, chatH);

    // Sub-window Header
    ctx.fillStyle = "rgba(18, 68, 34, 0.9)";
    ctx.fillRect(chatX + 2, chatY + 2, chatW - 4, 42);
    ctx.fillStyle = "#33ff66";
    ctx.font = 'bold 22px "VT323", monospace';
    ctx.textAlign = "left";
    ctx.fillText("K.O.M.R.A.D.-84 // COMMS", chatX + 14, chatY + 29);

    const hasActivePrinterPaper =
      deskState.printingDoc !== null ||
      deskState.documents.length > 0 ||
      deskState.packedDoc !== null ||
      deskState.capsuleState !== "CRADLE_EMPTY";
    ctx.textAlign = "right";
    ctx.font = 'bold 19px "VT323", monospace';
    if (state.komradOverrideLocked) {
      ctx.fillStyle = "#ff2a2a";
      ctx.fillText("AI LOCK ACTIVE!", chatX + chatW - 14, chatY + 29);
    } else if (hasActivePrinterPaper) {
      ctx.fillStyle = "#ffb000";
      ctx.fillText(
        "PRINTER: DIRECTIVE IN CARRIAGE",
        chatX + chatW - 14,
        chatY + 29,
      );
    } else {
      ctx.fillStyle = "#38e8ff";
      ctx.fillText(
        `NEXT TRANSMISSION IN: [${Math.max(0, cdSec)}s]`,
        chatX + chatW - 14,
        chatY + 29,
      );
    }

    // Bottom Advisory Strip Across Regional Map Panel when an Alarm or Hover Diagnostic is Active
    if (contextualHint) {
      const stripX = mapX + 6;
      const stripY = mapY + mapH - 36;
      const stripW = mapW - 12;
      const stripH = 30;
      ctx.fillStyle = "rgba(42, 28, 4, 0.95)";
      ctx.fillRect(stripX, stripY, stripW, stripH);
      ctx.strokeStyle = timeBucket % 2 === 0 ? "#ffb000" : "#ff5533";
      ctx.lineWidth = 2;
      ctx.strokeRect(stripX, stripY, stripW, stripH);
      ctx.fillStyle = "#ffdd55";
      ctx.font = 'bold 18px "VT323", monospace';
      ctx.textAlign = "center";
      ctx.fillText(contextualHint.slice(0, 108), stripX + stripW / 2, stripY + 21);
    }

    // Live Encrypted KGB Verification Trunk Intel Box when KGB LINE (UNIT C Switch 3) is ON
    let logStartOffset = 74;
    if (state.kgbLineActive) {
      const kgbBoxY = chatY + 50;
      const kgbBoxH = 88;
      const isSuspect = activeDeskDoc?.isForgery ?? false;
      ctx.fillStyle = activeDeskDoc
        ? isSuspect
          ? "rgba(64, 10, 10, 0.92)"
          : "rgba(6, 38, 22, 0.92)"
        : "rgba(6, 28, 34, 0.88)";
      ctx.fillRect(chatX + 10, kgbBoxY, chatW - 20, kgbBoxH);
      ctx.strokeStyle = activeDeskDoc
        ? isSuspect
          ? "#ff2a2a"
          : "#33ff66"
        : "#38e8ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(chatX + 10, kgbBoxY, chatW - 20, kgbBoxH);

      ctx.textAlign = "left";
      ctx.font = 'bold 19px "VT323", monospace';
      ctx.fillStyle = "#38e8ff";
      ctx.fillText(
        activeDeskDoc
          ? `[KGB LINE DECODE] REF: ${activeDeskDoc.referenceCode} // ${activeDeskDoc.ministry.slice(0, 26)}`
          : "[KGB LINE DECODE] ENCRYPTED KGB TRUNK ONLINE (-0.35 HZ LOAD)",
        chatX + 20,
        kgbBoxY + 23,
      );

      ctx.font = 'bold 18px "VT323", monospace';
      if (!activeDeskDoc) {
        ctx.fillStyle = "#9be6b0";
        ctx.fillText(
          "AWAITING NEXT PRAVDA-84 DIRECTIVE ON INSPECTOR DESK...",
          chatX + 20,
          kgbBoxY + 48,
        );
        ctx.fillText(
          "VERIFY SEAL, INK, FONT & DATE WITH KGB MANUAL [KEY 4].",
          chatX + 20,
          kgbBoxY + 72,
        );
      } else if (activeDeskDoc.isForgery) {
        ctx.fillStyle = "#ff4444";
        const hintLine =
          activeDeskDoc.forgeryReason ??
          "WESTERN TAMPERING DETECTED IN SEAL / INK / FONT / CIPHER!";
        const wrappedHint = wrapText(
          ctx,
          `ALERT: ${hintLine.toUpperCase()} — STAMP [УНИЧТОЖЕНО] & SHRED!`,
          chatW - 40,
        );
        wrappedHint.slice(0, 2).forEach((ln, idx) => {
          ctx.fillText(ln, chatX + 20, kgbBoxY + 48 + idx * 23);
        });
      } else {
        ctx.fillStyle = "#33ff66";
        ctx.fillText(
          `ORIGIN VERIFIED: AUTHENTIC ${activeDeskDoc.sealType} & ${activeDeskDoc.inkColor}.`,
          chatX + 20,
          kgbBoxY + 48,
        );
        ctx.fillStyle = "#ffe082";
        ctx.fillText(
          "RECOMMENDATION: STAMP [ОДОБРЕНО] & DISPATCH IN OUTBOX TUBE!",
          chatX + 20,
          kgbBoxY + 72,
        );
      }
      logStartOffset = 158;
    }

    // Scrolling Timestamped Comm Log Messages
    ctx.textAlign = "left";
    ctx.font = '21px "VT323", monospace';
    const logMaxW = chatW - 32;
    const recentEntries = state.terminalEntries.slice(
      state.kgbLineActive ? -7 : -11,
    );
    let cursorY = chatY + logStartOffset;
    const maxLogY = chatY + chatH - 210;

    for (const entry of recentEntries) {
      if (cursorY > maxLogY) break;
      ctx.fillStyle =
        entry.level === "danger"
          ? "#ff2a2a"
          : entry.level === "warn"
            ? "#ffb000"
            : "#33ff66";
      const rawLine = `[${entry.timestamp}] ${entry.sender}: ${entry.text}`;
      const wrapped = wrapText(ctx, rawLine, logMaxW);
      for (const line of wrapped.slice(0, 3)) {
        if (cursorY > maxLogY) break;
        ctx.fillText(line, chatX + 16, cursorY);
        cursorY += 24;
      }
      cursorY += 6;
    }

    // Blinking terminal block cursor
    if (timeBucket % 2 === 0 && !state.isBlackout) {
      ctx.fillStyle = "#33ff66";
      ctx.fillRect(
        chatX + 16,
        Math.min(maxLogY, cursorY - 16),
        12,
        18,
      );
    }

    // Bottom Yellow VOLKOV DISPATCH / K.O.M.R.A.D. AI Dark-Humor Chat Box
    const aiBoxY = chatY + chatH - 196;
    const aiBoxH = 184;
    const isDrillActive = state.tutorialStep !== "DONE";
    const drillBorderPulse =
      isDrillActive && timeBucket % 2 === 0 ? "#33ff66" : "#ffb000";
    ctx.fillStyle = isDrillActive
      ? "rgba(38, 28, 4, 0.96)"
      : "rgba(28, 22, 4, 0.92)";
    ctx.fillRect(chatX + 10, aiBoxY, chatW - 20, aiBoxH);
    ctx.strokeStyle = drillBorderPulse;
    ctx.lineWidth = isDrillActive ? 3.5 : 2.5;
    ctx.strokeRect(chatX + 10, aiBoxY, chatW - 20, aiBoxH);

    const currentHour = Math.min(5, Math.floor(state.shiftTimeMinutes / 60));
    const hourlyBanner =
      HOURLY_CRT_BANNERS[currentHour] ?? HOURLY_CRT_BANNERS[0];

    ctx.fillStyle = "#33ff66";
    ctx.font = '19px "VT323", monospace';
    ctx.fillText(
      isDrillActive
        ? "УЧЕБНАЯ ТРЕВОГА // 5-STAGE KGB QUALIFICATION DRILL ACTIVE"
        : hourlyBanner.slice(0, 56),
      chatX + 22,
      aiBoxY + 28,
    );

    ctx.fillStyle = "#ffb000";
    ctx.font = 'bold 22px "VT323", monospace';
    ctx.fillText(
      isDrillActive
        ? `>> VOLKOV TRAINING DRILL (STEP ${state.tutorialStep}/5):`
        : ">> VOLKOV DISPATCH / K.O.M.R.A.D. AI:",
      chatX + 22,
      aiBoxY + 58,
    );

    const hasApprovedDeskDoc = deskState.documents.some(
      (d) =>
        d.status === "desk" && d.stamps.some((st) => st.type === "APPROVED"),
    );
    let drillInstruction = "";
    if (state.tutorialStep === 1) {
      if (deskState.printingDoc !== null) {
        drillInstruction =
          "DRILL 1/5 [DESK]: DRAG PAPER RIGHT TO TEAR FROM PRINTER -> PLACE ON DESK MAT.";
      } else if (
        !hasApprovedDeskDoc &&
        deskState.capsuleState === "CRADLE_EMPTY"
      ) {
        drillInstruction =
          "DRILL 1/5 [DESK]: ORDER IS GENUINE! CLICK GREEN STAMP [ОДОБРЕНО] -> STAMP THE PAPER.";
      } else {
        drillInstruction =
          "DRILL 1/5 [DESK]: PACK PAPER IN BRASS CAPSULE -> OPEN LEFT TUBE HATCH -> LOAD CAPSULE -> CLOSE HATCH & PULL RED LAUNCH LEVER!";
      }
    } else if (state.tutorialStep === 2) {
      drillInstruction =
        "DRILL 2/5 [PRESS KEY 1 -> UNIT A]: VODKA PLANT DEMANDS 25 MW! PULL LEVER [5. VODKA PLANT] UP UNTIL ITS READOUT SHOWS 25 / 25 MW.";
    } else if (state.tutorialStep === 3) {
      drillInstruction =
        state.pumpThrottle[0] <= 50
          ? "DRILL 3/5 [KEY 1 -> UNIT A]: MORE MW CREATES CORE HEAT! TURN [COOLING PUMP A] WHEEL ABOVE 50% TO SIPHON COOLING WATER."
          : "DRILL 3/5 [PRESS KEY 3 -> UNIT B]: WATER PUMPS DRAIN LOCAL TOWNS! TURN [HELIUM-N2 LOOP] WHEEL (>40%) FOR DRY COOLING & HOLD [BUBBLER DRAIN] LEVER TO PUMP WATER BACK TO TOWNS!";
    } else if (state.tutorialStep === 4) {
      drillInstruction =
        "DRILL 4/5 [PRESS KEY 5 -> UNIT C]: POWER CHANGES SHIFT TURBINE FREQUENCY (48.8 HZ)! DRAG THE [50HZ RHEOSTAT] CENTER DIAL TO LOCK 50.0 HZ SO THE MAIN BREAKER STAYS CLOSED.";
    } else if (state.tutorialStep === 5) {
      drillInstruction =
        "DRILL 5/5 [PRESS KEY 4 -> DESK]: INSPECT NEW ORDER WITH [B] MANUAL OR [Z] LENS! IT HAS A FAKE SEAL — STAMP RED [УНИЧТОЖЕНО], DROP IN RIGHT SHREDDER & PULL HANDLE 5 TIMES!";
    }

    const activeBulletin = isDrillActive
      ? drillInstruction
      : (contextualHint ??
        KOMRAD_DARK_HUMOR_BULLETINS[
          bulletinIdx % KOMRAD_DARK_HUMOR_BULLETINS.length
        ]);
    ctx.font = 'bold 21px "VT323", monospace';
    ctx.fillStyle = isDrillActive ? "#ffea70" : "#ffe082";
    const bLines = wrapText(ctx, `"${activeBulletin}"`, chatW - 48);
    bLines.slice(0, 4).forEach((ln, idx) => {
      ctx.fillText(ln, chatX + 22, aiBoxY + 86 + idx * 23);
    });

    ctx.font = '18px "VT323", monospace';
    ctx.fillStyle = isDrillActive ? "#33ff66" : "#9be6b0";
    ctx.fillText(
      isDrillActive
        ? "[PRESS BACKSPACE AT ANY TIME TO SKIP DRILL FOR VETERAN OPERATORS]"
        : "[CLICK SCREEN OR GREEN CONSOLE BUTTON TO CYCLE AI BULLETIN]",
      chatX + 22,
      aiBoxY + aiBoxH - 10,
    );

    // Prominent CRT Overlay Banner when in boot or end-of-shift state
    if (state.phase !== "playing") {
      ctx.fillStyle = "rgba(6, 26, 12, 0.94)";
      ctx.fillRect(260, 320, w - 520, 320);
      ctx.strokeStyle = state.phase === "boot" ? "#ffb000" : "#ff2a2a";
      ctx.lineWidth = 5;
      ctx.strokeRect(260, 320, w - 520, 320);

      ctx.textAlign = "center";
      ctx.fillStyle = state.phase === "boot" ? "#ffb000" : "#ff2a2a";
      ctx.font = 'bold 46px "Kremlin", monospace';
      const titleText =
        state.phase === "boot"
          ? "REACTOR NO. 4 // STANDBY"
          : `SHIFT TERMINATED: ${state.phase.toUpperCase()}`;
      ctx.fillText(titleText, w / 2, 410);

      ctx.fillStyle = "#33ff66";
      ctx.font = 'bold 34px "VT323", monospace';
      ctx.fillText(
        state.phase === "boot"
          ? "CLICK SCREEN OR PULL 3D MAIN BREAKER LEVER ([SPACE])"
          : "CLICK SCREEN OR PULL 3D MAIN BREAKER LEVER ([SPACE]) TO RESET",
        w / 2,
        485,
      );

      ctx.fillStyle = "#e6dec3";
      ctx.font = '28px "VT323", monospace';
      ctx.fillText(
        "[1-4] STATION ZOOM | [0/ESC] CHAIR | DRAG UNIT A LEVERS FOR POWER",
        w / 2,
        565,
      );
    }

    // Subtle CRT Scanlines
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    for (let y = 0; y < h; y += 6) {
      ctx.fillRect(0, y, w, 2);
    }

    ctx.restore();
    tex.needsUpdate = true;
  });

  return (
    <mesh
      geometry={curvedCrtGeometry}
      position={[0, 1.615, 0.138]}
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

export const ControlRoomScene: React.FC = React.memo(() => {
  const bunkerArchRef = useRef<THREE.Group>(null);
  const reactorWrapRef = useRef<THREE.Group>(null);
  const terminalWrapRef = useRef<THREE.Group>(null);
  const legacyBulletinTargetRef = useRef<THREE.Object3D | null>(null);
  const [bulletinIdx, setBulletinIdx] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setBulletinIdx((prev) => prev + 1);
    }, 6500);
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
        // Widen rear cabinet box slightly to frame the +40% wider CRT housing
        if (
          (obj as THREE.Mesh).isMesh &&
          Math.abs(obj.position.y - 1.01) < 0.05 &&
          Math.abs(obj.position.z - -0.18) < 0.05
        ) {
          obj.scale.set(1.36, 1.08, 1);
        }
        // Scale CRT outer bezel box (+40% width, +30% height) and center at y = 1.615
        if (
          (obj as THREE.Mesh).isMesh &&
          Math.abs(obj.position.y - 1.4) < 0.03 &&
          Math.abs(obj.position.z - 0.02) < 0.03
        ) {
          obj.position.y = 1.615;
          obj.scale.set(1.4, 1.3, 1);
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
        <mesh position={[0, 1.6, 5.85]} receiveShadow>
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

      {/* 1. LEFT COCKPIT WING: <HighDetailReactorPanel3D /> (Shifted +0.42m along wall away from desk to z = 2.77 so levers 4, 5, 6 are 100% unobstructed!) */}
      <group
        ref={reactorWrapRef}
        position={[-2.12, 0.0, 2.77]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[1.14, 1.1, 1.12]}
      >
        <group rotation={[0, -0.42, 0]}>
          <group position={[2.15, 0, 1.08]}>
            <HighDetailReactorPanel3D />
          </group>
        </group>
      </group>

      {/* 1B. LEFT-REAR WRAP-AROUND PANEL (`UNIT A-2`): Shifted +0.42m along wall to [-1.4, 0, 4.57] */}
      <group
        position={[-1.4, 0.0, 4.57]}
        rotation={[0, (3 * Math.PI) / 4, 0]}
        scale={[1.14, 1.1, 1.12]}
      >
        <LeftRearWrapAroundPanel3D variant="left-rear" />
      </group>

      {/* Heavy Bolted Cast-Iron Corner Junction Pillar at exact seam [-2.12, 1.24, 3.82] between `UNIT A` and `UNIT A-2` */}
      <group position={[-2.12, 1.24, 3.82]}>
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

      {/* 1C. REAR OPERATOR BULKHEAD PANEL (`БЛОК В`): Shifted +0.42m along rear wall to [0.4, 0, 5.31] */}
      <group
        position={[0.4, 0.0, 5.31]}
        rotation={[0, Math.PI, 0]}
        scale={[1.14, 1.1, 1.12]}
      >
        <LeftRearWrapAroundPanel3D variant="rear" />
      </group>

      {/* Heavy Bolted Corner Junction Pillar at exact seam [-0.65, 1.24, 5.30] between `UNIT A-2` and `БЛОК В` */}
      <group position={[-0.65, 1.24, 5.3]}>
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
