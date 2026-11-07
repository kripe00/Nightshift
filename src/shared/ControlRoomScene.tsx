import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import * as InspectorModule from "../modules/inspector";
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
            ? "[L-CTRL] РЕЖИМ: ОБЗОР (FREE-LOOK)"
            : "[L-CTRL] РЕЖИМ: КУРСОР (CURSOR)",
          750,
          30,
        );
        ctx.textAlign = "left";

        ctx.fillStyle = s.coreTemp >= 750 ? "#ff2a2a" : "#33ff66";
        ctx.font = 'bold 22px "VT323", monospace';
        ctx.fillText(
          `SHIFT: ${s.shiftNumber}/5 | CLOCK: ${formatClock(s.shiftTimeMinutes)}/06:00 | CORE: ${Math.round(s.coreTemp)}C | STRIKES: ${s.treasonStrikes}/3 | [SHIFT]: ${s.isShiftKeyHeld ? "ENGAGED" : "LOCKED"}`,
          18,
          58,
        );

        ctx.fillStyle = "#e6dec3";
        ctx.font = '18px "VT323", monospace';
        const statusLine =
          s.phase === "boot"
            ? "PULL 3D MAIN BREAKER LEVER (OR PRESS SPACE) TO ENERGIZE REACTOR NO. 4!"
            : s.phase !== "playing"
              ? `SHIFT ENDED (${s.phase.toUpperCase()}) — PULL 3D MAIN BREAKER LEVER TO RESET!`
              : (s.lastDecisionFeedback ??
                "CAMERA: [1-4] STATION ZOOM | [0/ESC] CHAIR | [L-CTRL] FREE-LOOK/CURSOR | [F2] DEBUG");
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
  const [syncDialAngles, setSyncDialAngles] = useState<[number, number]>([0.4, -0.3]);
  const rightStatusMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const rightPanelGroupRef = useRef<THREE.Group>(null);
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  // Load High-Detail Soviet `.glb` Control Panel & Mainframe Hardware from `public/models/`
  const terminalHousingGltf = useGLTF("./models/komrad_terminal_housing.glb");
  const controlPanelsGltf = useGLTF("./models/control_panels.glb");

  const terminalHousingModel = useMemo(() => {
    const cloned = terminalHousingGltf.scene.clone(true);
    applySovietPBRToHierarchy(cloned);
    return cloned;
  }, [terminalHousingGltf.scene]);

  const reactorHardwareModel = useMemo(() => {
    const cloned =
      controlPanelsGltf.scene
        .getObjectByName("reactor_hardware")
        ?.clone(true) ?? null;
    applySovietPBRToHierarchy(cloned);
    return cloned;
  }, [controlPanelsGltf.scene]);

  const rightPanelHardwareModel = useMemo(() => {
    const cloned =
      controlPanelsGltf.scene
        .getObjectByName("right_panel_hardware")
        ?.clone(true) ?? null;
    applySovietPBRToHierarchy(cloned);
    return cloned;
  }, [controlPanelsGltf.scene]);

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
        ctx.font = 'bold 22px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("ЩИТ УПРАВЛЕНИЯ БЛОКОМ Б // UNIT B", w / 2, 30);
        ctx.fillStyle = "#33ff66";
        ctx.font = 'bold 18px "VT323", monospace';
        ctx.fillText("ТУРБИНЫ №1/№2 • СИНХРОНИЗАЦИЯ СЕТИ • ГЛАВНЫЙ РУБИЛЬНИК", w / 2, 56);
      }),
    [],
  );

  const rightStatusTex = useMemo(() => createNearestCanvasTexture(512, 96), []);

  const pushButtonSpecs = useMemo(() => {
    const items = [
      { id: 0, label: "ОХЛАЖДЕНИЕ", sub: "AUX COOL", color: "#33ff66" },
      { id: 1, label: "ВЕНТИЛЯЦИЯ", sub: "VENTING", color: "#33ff66" },
      { id: 2, label: "СВЯЗЬ КГБ", sub: "KGB LINE", color: "#ffb000" },
      { id: 3, label: "СИРЕНА", sub: "TEST ALARM", color: "#ff2a2a" },
      { id: 4, label: "АУДИО [M]", sub: "MUTE SFX", color: "#ffb000" },
    ];
    return items.map((item) => ({
      ...item,
      texture: createNearestCanvasTexture(128, 56, (ctx, w, h) => {
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = item.color;
        ctx.font = 'bold 14px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText(item.label, w / 2, 24);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 14px "VT323", monospace';
        ctx.fillText(item.sub, w / 2, 44);
      }),
    }));
  }, []);

  useFrame(() => {
    const s = useGameStore.getState();
    const totalMW =
      s.powerAllocation.cooling +
      s.powerAllocation.defense +
      s.powerAllocation.facility;

    // Update Right Control Panel Digital Telemetry Strip
    const rSig = `${s.phase}|${totalMW}|${s.pressureBar}|${s.isMusicMuted}|${auxToggles.join(",")}`;
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

        const rpm = s.isBlackout ? 0 : Math.round(2850 + totalMW * 1.5);
        const gridKv = s.isBlackout ? 0 : Math.round(330 + (totalMW - 90) * 0.4);
        ctx.fillStyle = s.phase === "playing" ? "#33ff66" : "#ffb000";
        ctx.font = 'bold 22px "VT323", monospace';
        ctx.fillText(
          `ТУРБИНА №1: ${rpm} RPM | СЕТЬ: ${gridKv} КВ (50.0 ГЦ) | БЛОК: ${s.phase.toUpperCase()}`,
          14,
          34,
        );
        ctx.fillStyle = s.isMusicMuted ? "#ff2a2a" : "#ffb000";
        ctx.fillText(
          `АУДИО [M]: ${s.isMusicMuted ? "ОТКЛ (MUTED)" : "ВКЛ (ACTIVE)"} | ВЕНТ: ${auxToggles[1] ? "НОРМА" : "СТОП"} | КГБ-ЛИНИЯ: ${auxToggles[2] ? "ШИФР" : "ДЕЖУР."}`,
          14,
          62,
        );
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 16px "Courier Prime", monospace';
        ctx.fillText(
          "ТЯНИ ГЛАВНЫЙ РУБИЛЬНИК СПРАВА ИЛИ НАЖМИ [SPACE] ДЛЯ ПУСКА",
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
        position={[1.96, 0.04, 2.35]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        {rightPanelHardwareModel && (
          <primitive object={rightPanelHardwareModel} />
        )}
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

        {/* Top Riveted Cyrillic Header Plaque: ЩИТ УПРАВЛЕНИЯ БЛОКОМ Б */}
        <mesh position={[0, 2.16, 0.035]}>
          <planeGeometry args={[1.48, 0.16]} />
          <meshStandardMaterial
            map={rightHeaderPlateTex}
            emissive="#ffffff"
            emissiveMap={rightHeaderPlateTex}
            emissiveIntensity={0.35}
            roughness={0.75}
          />
        </mesh>

        {/* 3 High-Res 16-Part Bolted Turbine & Grid Voltmeter Gauges */}
        <group position={[0, 1.84, 0.03]}>
          <HighDetailManometer3D
            position={[-0.51, 0, 0]}
            title="ТУРБИНА №1"
            cyrillicSub="ОБОРОТЫ РОТОРА"
            unit="0-3500 RPM"
            serial="№ 84-ТБ1"
            min={0}
            max={3500}
            dangerThreshold={3100}
            getValue={() => {
              const s = useGameStore.getState();
              if (s.isBlackout) return 180;
              const mw =
                s.powerAllocation.cooling +
                s.powerAllocation.defense +
                s.powerAllocation.facility;
              return 2650 + mw * 4.5;
            }}
          />
          <HighDetailManometer3D
            position={[0, 0, 0]}
            title="ТУРБИНА №2"
            cyrillicSub="ДАВЛЕНИЕ ПАРА"
            unit="0-160 МПа"
            serial="№ 84-ТБ2"
            min={0}
            max={160}
            dangerThreshold={125}
            getValue={() => {
              const s = useGameStore.getState();
              return s.isBlackout ? 12 : s.pressureBar * 1.25;
            }}
          />
          <HighDetailManometer3D
            position={[0.51, 0, 0]}
            title="СЕТЬ 50 ГЦ"
            cyrillicSub="НАПРЯЖЕНИЕ СЕТИ"
            unit="0-450 КВ"
            serial="№ 84-ЭЛ3"
            min={100}
            max={450}
            dangerThreshold={380}
            getValue={() => {
              const s = useGameStore.getState();
              if (s.isBlackout) return 110;
              const mw =
                s.powerAllocation.cooling +
                s.powerAllocation.defense +
                s.powerAllocation.facility;
              return 310 + (mw - 80) * 0.95;
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

        {/* Middle Row: 2 Rotary Grid Synchronization Dials (Left/Center) + Heavy Multi-Part Copper Knife-Switch MAIN BREAKER (Right) */}
        <group position={[0, 1.0, 0.04]}>
          {[0, 1].map((dIdx) => (
            <group
              key={dIdx}
              position={[-0.52 + dIdx * 0.46, 0, 0.01]}
              onClick={(e) => {
                e.stopPropagation();
                playLeverRatchet(0.6 + dIdx * 0.2);
                setSyncDialAngles((prev) => {
                  const next: [number, number] = [...prev] as [number, number];
                  next[dIdx] += 0.55;
                  return next;
                });
              }}
            >
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.13, 0.145, 0.05, 14]} />
                <meshStandardMaterial
                  color="#141414"
                  roughness={0.45}
                  metalness={0.65}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.008}
                />
              </mesh>
              <group
                position={[0, 0, 0.038]}
                rotation={[0, 0, syncDialAngles[dIdx]]}
              >
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.09, 0.105, 0.045, 12]} />
                  <meshStandardMaterial
                    color="#2b1a12"
                    roughness={0.52}
                    metalness={0.3}
                  />
                </mesh>
                <mesh position={[0, 0.045, 0.025]} castShadow>
                  <boxGeometry args={[0.018, 0.075, 0.016]} />
                  <meshStandardMaterial color="#ffb000" roughness={0.4} />
                </mesh>
              </group>
            </group>
          ))}

          {/* Heavy Multi-Part Copper Knife-Switch MAIN BREAKER (`ГЛАВНЫЙ РУБИЛЬНИК`) */}
          <HighDetailKnifeBreaker3D
            breakerArmRef={breakerArmRef}
            breakerDragRef={breakerDragRef}
            breakerPlateTex={breakerPlateTex}
          />
        </group>

        {/* Lower Row: 5 Tactile Backlit Soviet Push-Buttons with Caged Jewel Indicator Lamps */}
        <group position={[0, 0.52, 0.04]}>
          <mesh position={[0, 0, -0.01]} castShadow receiveShadow>
            <boxGeometry args={[1.48, 0.34, 0.04]} />
            <meshStandardMaterial
              color="#141414"
              roughness={0.45}
              metalness={0.65}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          {pushButtonSpecs.map((btn, idx) => {
            const isOn =
              idx === 4
                ? !useGameStore.getState().isMusicMuted
                : auxToggles[idx] ?? false;
            return (
              <group
                key={btn.id}
                position={[-0.56 + idx * 0.28, -0.02, 0.025]}
                onClick={(e) => {
                  e.stopPropagation();
                  playSwitchClank(false);
                  if (idx === 4) {
                    useGameStore.getState().toggleMusicMute();
                  } else {
                    setAuxToggles((prev) => {
                      const next: [number, boolean, boolean, boolean] | [boolean, boolean, boolean, boolean] = [
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

      {/* 4. HIGH-DETAIL `.GLB` HARDWARE OVERLAYS & BEVELED ANGLE-IRON SEAMS FOR REACTOR & K.O.M.R.A.D.-84 TERMINAL */}
      {reactorHardwareModel && (
        <group position={[-1.96, 0.04, 2.35]} rotation={[0, Math.PI / 2, 0]}>
          <primitive object={reactorHardwareModel} />
          {/* Left Panel Beveled L-Angle Iron Trim & Hex Bolt Rows */}
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
        </group>
      )}
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
      <fog attach="fog" args={["#050706", 4.2, 10.0]} />

      <CameraController />
      <BuckshotDitherPass />
      <DynamicBunkerLighting />
      <BunkerTelemetryAndControlRail3D />

      {/* ============================================================
          SOVIET BUNKER ARCHITECTURE (WALLS, FLOOR, CEILING, PIPES)
         ============================================================ */}
      <group ref={bunkerArchRef}>
        <mesh
          position={[0, -0.02, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[10, 9]} />
          <meshStandardMaterial
            color="#141414"
            roughness={0.92}
            metalness={0.15}
          />
        </mesh>

        <mesh
          position={[0, 0.005, 0.4]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[5.4, 4.2]} />
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

        <mesh position={[0, 3.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10, 9]} />
          <meshStandardMaterial
            color="#141414"
            roughness={0.9}
            metalness={0.3}
          />
        </mesh>
        {[-1.6, -0.4, 0.8, 2.0].map((zPos) => (
          <mesh key={zPos} position={[0, 2.94, zPos]} castShadow receiveShadow>
            <boxGeometry args={[8.5, 0.14, 0.18]} />
            <meshStandardMaterial
              color="#141414"
              roughness={0.7}
              metalness={0.55}
            />
          </mesh>
        ))}

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

      {/* 1. LEFT COCKPIT WING: <HighDetailReactorPanel3D /> (True 90° angle on left side at [-1.96, 0.04, 2.35], rotation.y = +Math.PI / 2!) */}
      <group
        ref={reactorWrapRef}
        position={[-1.96, 0.04, 2.35]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <group rotation={[0, -0.42, 0]}>
          <group position={[2.15, 0, 1.08]}>
            <HighDetailReactorPanel3D />
          </group>
        </group>
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
