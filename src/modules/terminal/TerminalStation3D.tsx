import { useFrame } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useGameStore } from "../../shared/useGameStore";
import {
  announceKomradDevToolsPropaganda,
  getContextualKomradBulletin,
  HOURLY_SHIFT_BROADCASTS,
} from "./komradScript";

let sharedTermAudioCtx: AudioContext | null = null;

function playTerminalKeyBeep(freq = 920): void {
  try {
    if (!sharedTermAudioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      sharedTermAudioCtx = new AudioCtx();
    }
    if (sharedTermAudioCtx.state === "suspended") {
      void sharedTermAudioCtx.resume();
    }
    const now = sharedTermAudioCtx.currentTime;
    const osc = sharedTermAudioCtx.createOscillator();
    const gain = sharedTermAudioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(gain).connect(sharedTermAudioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  } catch {
    // Ignore audio context errors if browser blocked autoplay
  }
}

function createButtonLabelTexture(
  text: string,
  bgHex: string,
  fgHex: string,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 192, 48);
    ctx.strokeStyle = "#141414";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 188, 44);
    ctx.fillStyle = fgHex;
    ctx.font = 'bold 18px "VT323", monospace';
    ctx.textAlign = "center";
    ctx.fillText(text, 96, 30);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export const TerminalStation3D: React.FC = () => {
  const crtMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const reelLeftRef = useRef<THREE.Mesh>(null);
  const reelRightRef = useRef<THREE.Mesh>(null);
  const radarAngleRef = useRef(0);

  const [bulletin, setBulletin] = useState<string>(() =>
    getContextualKomradBulletin({
      coreTemp: 340,
      radiationLevel: 0.4,
      totalMW: 90,
      shiftTimeMinutes: 0,
    }),
  );

  useEffect(() => {
    announceKomradDevToolsPropaganda();
    const interval = window.setInterval(() => {
      const s = useGameStore.getState();
      const totalMW =
        s.powerAllocation.cooling +
        s.powerAllocation.defense +
        s.powerAllocation.facility;
      setBulletin(
        getContextualKomradBulletin({
          coreTemp: s.coreTemp,
          radiationLevel: s.radiationLevel,
          totalMW,
          shiftTimeMinutes: s.shiftTimeMinutes,
        }),
      );
    }, 5200);
    return () => window.clearInterval(interval);
  }, []);

  const crtTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 352;
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const curvedCrtGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1.34, 0.9, 10, 8);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / 0.67;
      const y = pos.getY(i) / 0.45;
      const r2 = x * x + y * y;
      const bulge = Math.max(0, 1 - r2 * 0.42) * 0.024;
      pos.setZ(i, bulge);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const overrideBtnTex = useMemo(
    () => createButtonLabelTexture("[OVERRIDE AI LOCK]", "#ffb000", "#141414"),
    [],
  );
  const purgeBtnTex = useMemo(
    () => createButtonLabelTexture("[PURGE FIREWALL]", "#ff2a2a", "#e6dec3"),
    [],
  );
  const bulletinBtnTex = useMemo(
    () => createButtonLabelTexture("[CYCLE AI BULLETIN]", "#23312b", "#33ff66"),
    [],
  );

  useFrame(({ clock }, delta) => {
    const state = useGameStore.getState();

    if (reelLeftRef.current && !state.isBlackout && state.phase === "playing") {
      reelLeftRef.current.rotation.z += delta * 1.4;
    }
    if (
      reelRightRef.current &&
      !state.isBlackout &&
      state.phase === "playing"
    ) {
      reelRightRef.current.rotation.z -= delta * 1.4;
    }

    // Throttle CRT CanvasTexture redraws to ~5 Hz (or immediately when state changes) so GPU never stalls!
    const timeBucket = Math.floor(clock.getElapsedTime() * 5);
    const lastEntryId =
      state.terminalEntries[state.terminalEntries.length - 1]?.id ?? "0";
    const sig = `${timeBucket}|${state.phase}|${lastEntryId}|${state.ciaIntrusionActive}|${Math.round(state.ciaIntrusionProgress)}|${state.powerAllocation.defense}|${state.komradOverrideLocked}|${state.isBlackout}|${bulletin}`;
    const tex = crtMatRef.current?.map as THREE.CanvasTexture | undefined;
    const canvas = tex?.image as HTMLCanvasElement | undefined;
    if (!canvas || !tex || tex.userData.lastSig === sig) return;
    tex.userData.lastSig = sig;

    radarAngleRef.current = (timeBucket * 0.45) % (Math.PI * 2);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = state.isBlackout ? "#030b05" : "#061a0c";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#33ff66";
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.beginPath();
    ctx.moveTo(6, 38);
    ctx.lineTo(w - 6, 38);
    ctx.stroke();

    ctx.fillStyle = state.isBlackout ? "#184d27" : "#33ff66";
    ctx.font = 'bold 20px "VT323", monospace';
    ctx.textAlign = "left";
    ctx.fillText("K.O.M.R.A.D.-84 // TERMINAL NO. 4", 16, 28);

    ctx.textAlign = "right";
    ctx.fillStyle = state.ciaIntrusionActive ? "#ff2a2a" : "#ffb000";
    ctx.fillText(
      state.ciaIntrusionActive
        ? `CIA INTRUSION: ${Math.round(state.ciaIntrusionProgress)}%`
        : `DEFENSE: ${state.powerAllocation.defense} MW`,
      w - 16,
      28,
    );

    ctx.textAlign = "left";
    ctx.font = '17px "VT323", monospace';
    const logAreaWidth = 342;
    const recentEntries = state.terminalEntries.slice(-6);
    let cursorY = 60;

    for (const entry of recentEntries) {
      if (cursorY > 258) break;
      ctx.fillStyle =
        entry.level === "danger"
          ? "#ff2a2a"
          : entry.level === "warn"
            ? "#ffb000"
            : "#33ff66";
      const rawLine = `[${entry.timestamp}] ${entry.sender}: ${entry.text}`;
      const wrapped = wrapTextLines(ctx, rawLine, logAreaWidth);
      for (const line of wrapped.slice(0, 2)) {
        if (cursorY > 262) break;
        ctx.fillText(line, 16, cursorY);
        cursorY += 19;
      }
      cursorY += 3;
    }

    if (timeBucket % 2 === 0 && !state.isBlackout) {
      ctx.fillStyle = "#33ff66";
      ctx.fillRect(16, Math.min(258, cursorY - 12), 10, 15);
    }

    const radarCx = 434;
    const radarCy = 148;
    const radarR = 56;

    ctx.strokeStyle = "#1b5e2e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(radarCx, radarCy, radarR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(radarCx, radarCy, radarR * 0.55, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(radarCx - radarR, radarCy);
    ctx.lineTo(radarCx + radarR, radarCy);
    ctx.moveTo(radarCx, radarCy - radarR);
    ctx.lineTo(radarCx, radarCy + radarR);
    ctx.stroke();

    if (!state.isBlackout) {
      const ang = radarAngleRef.current;
      ctx.fillStyle = state.ciaIntrusionActive
        ? "rgba(255, 42, 42, 0.28)"
        : "rgba(51, 255, 102, 0.24)";
      ctx.beginPath();
      ctx.moveTo(radarCx, radarCy);
      ctx.arc(radarCx, radarCy, radarR, ang - 0.55, ang);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = state.ciaIntrusionActive ? "#ff2a2a" : "#33ff66";
      ctx.beginPath();
      ctx.moveTo(radarCx, radarCy);
      ctx.lineTo(
        radarCx + Math.cos(ang) * radarR,
        radarCy + Math.sin(ang) * radarR,
      );
      ctx.stroke();

      if (state.ciaIntrusionActive) {
        ctx.fillStyle = "#ff2a2a";
        ctx.fillRect(radarCx + 14, radarCy - 18, 8, 8);
      } else {
        ctx.fillStyle = "#33ff66";
        ctx.fillRect(radarCx - 18, radarCy + 12, 6, 6);
      }
    }

    ctx.fillStyle = "#33ff66";
    ctx.font = '15px "VT323", monospace';
    ctx.textAlign = "center";
    ctx.fillText("SECTOR 07 RADAR", radarCx, radarCy + radarR + 18);
    if (state.komradOverrideLocked) {
      ctx.fillStyle = "#ff2a2a";
      ctx.fillText("AI LOCK ACTIVE!", radarCx, radarCy + radarR + 36);
    }

    ctx.strokeStyle = "#33ff66";
    ctx.beginPath();
    ctx.moveTo(6, 276);
    ctx.lineTo(w - 6, 276);
    ctx.stroke();

    const currentHour = Math.min(5, Math.floor(state.shiftTimeMinutes / 60));
    const hourlyBanner = HOURLY_SHIFT_BROADCASTS[currentHour];

    ctx.textAlign = "left";
    ctx.fillStyle = "#33ff66";
    ctx.font = '15px "VT323", monospace';
    ctx.fillText(hourlyBanner.slice(0, 66), 14, 296);

    ctx.fillStyle = "#ffb000";
    ctx.font = 'bold 17px "VT323", monospace';
    const bulletinLines = wrapTextLines(ctx, `>> ${bulletin}`, w - 28);
    ctx.fillText(bulletinLines[0] ?? "", 14, 318);
    if (bulletinLines[1]) {
      ctx.fillText(bulletinLines[1], 14, 336);
    }

    // Prominent 3D CRT Overlay Banner when in boot or end-of-shift state
    if (state.phase !== "playing") {
      ctx.fillStyle = "rgba(6, 26, 12, 0.92)";
      ctx.fillRect(26, 92, w - 52, 152);
      ctx.strokeStyle = state.phase === "boot" ? "#ffb000" : "#ff2a2a";
      ctx.lineWidth = 3;
      ctx.strokeRect(26, 92, w - 52, 152);

      ctx.textAlign = "center";
      ctx.fillStyle = state.phase === "boot" ? "#ffb000" : "#ff2a2a";
      ctx.font = 'bold 24px "Kremlin", monospace';
      const titleText =
        state.phase === "boot"
          ? "REACTOR NO. 4 // STANDBY"
          : `SHIFT TERMINATED: ${state.phase.toUpperCase()}`;
      ctx.fillText(titleText, w / 2, 132);

      ctx.fillStyle = "#33ff66";
      ctx.font = 'bold 20px "VT323", monospace';
      ctx.fillText(
        state.phase === "boot"
          ? "PULL 3D MAIN BREAKER LEVER (OR PRESS [SPACE])"
          : "PULL 3D MAIN BREAKER LEVER (OR PRESS [SPACE]) TO RESET",
        w / 2,
        172,
      );

      ctx.fillStyle = "#e6dec3";
      ctx.font = '18px "VT323", monospace';
      ctx.fillText(
        "[1-4] STATION ZOOM | [0/ESC] CHAIR | HOLD [SHIFT] FOR POWER",
        w / 2,
        214,
      );
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    for (let y = 0; y < h; y += 8) {
      ctx.fillRect(0, y, w, 2);
    }

    tex.needsUpdate = true;
  });

  return (
    <group position={[0, 0, -1.62]}>
      {/* Lowered cabinet height (2.02m) so it never blocks the overhead telemetry marquee */}
      <mesh position={[0, 1.01, -0.18]}>
        <boxGeometry args={[1.68, 2.02, 0.48]} />
        <meshStandardMaterial
          color="#23312b"
          roughness={0.72}
          metalness={0.42}
        />
      </mesh>

      <mesh position={[0, 1.4, 0.02]}>
        <boxGeometry args={[1.52, 1.04, 0.24]} />
        <meshStandardMaterial
          color="#141414"
          roughness={0.68}
          metalness={0.3}
        />
      </mesh>

      {/* Curved 3D CRT Phosphor Glass Mesh (high roughness eliminates blinding pointLight glare ball) */}
      <mesh
        geometry={curvedCrtGeometry}
        position={[0, 1.4, 0.135]}
        onClick={(e) => {
          e.stopPropagation();
          playTerminalKeyBeep(1020);
          const s = useGameStore.getState();
          if (s.phase === "boot") {
            s.startShift();
            return;
          }
          if (s.phase !== "playing") {
            s.resetShift();
            return;
          }
          const totalMW =
            s.powerAllocation.cooling +
            s.powerAllocation.defense +
            s.powerAllocation.facility;
          setBulletin(
            getContextualKomradBulletin({
              coreTemp: s.coreTemp,
              radiationLevel: s.radiationLevel,
              totalMW,
              shiftTimeMinutes: s.shiftTimeMinutes,
            }),
          );
        }}
      >
        <meshStandardMaterial
          ref={crtMatRef}
          map={crtTexture}
          color="#ffffff"
          emissive="#ffffff"
          emissiveMap={crtTexture}
          emissiveIntensity={0.85}
          roughness={0.92}
          metalness={0.0}
        />
      </mesh>

      {/* Sculpted 3D Mechanical Keyboard & Angled 3D Override Pushbuttons */}
      <group position={[0, 0.81, 0.19]} rotation={[0.38, 0, 0]}>
        <mesh>
          <boxGeometry args={[1.48, 0.08, 0.36]} />
          <meshStandardMaterial
            color="#364940"
            roughness={0.65}
            metalness={0.45}
          />
        </mesh>

        <group
          position={[-0.45, 0.055, -0.05]}
          onClick={(e) => {
            e.stopPropagation();
            playTerminalKeyBeep(760);
            useGameStore.getState().overrideKomradLock();
          }}
        >
          <mesh>
            <boxGeometry args={[0.4, 0.045, 0.11]} />
            <meshStandardMaterial color="#ffb000" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.38, 0.095]} />
            <meshStandardMaterial
              map={overrideBtnTex}
              emissive="#ffffff"
              emissiveMap={overrideBtnTex}
              emissiveIntensity={0.35}
              roughness={0.8}
            />
          </mesh>
        </group>

        <group
          position={[0, 0.055, -0.05]}
          onClick={(e) => {
            e.stopPropagation();
            playTerminalKeyBeep(640);
            useGameStore.getState().purgeFirewall();
          }}
        >
          <mesh>
            <boxGeometry args={[0.4, 0.045, 0.11]} />
            <meshStandardMaterial color="#ff2a2a" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.38, 0.095]} />
            <meshStandardMaterial
              map={purgeBtnTex}
              emissive="#ffffff"
              emissiveMap={purgeBtnTex}
              emissiveIntensity={0.35}
              roughness={0.8}
            />
          </mesh>
        </group>

        <group
          position={[0.45, 0.055, -0.05]}
          onClick={(e) => {
            e.stopPropagation();
            playTerminalKeyBeep(980);
            const s = useGameStore.getState();
            const totalMW =
              s.powerAllocation.cooling +
              s.powerAllocation.defense +
              s.powerAllocation.facility;
            setBulletin(
              getContextualKomradBulletin({
                coreTemp: s.coreTemp,
                radiationLevel: s.radiationLevel,
                totalMW,
                shiftTimeMinutes: s.shiftTimeMinutes,
              }),
            );
          }}
        >
          <mesh>
            <boxGeometry args={[0.4, 0.045, 0.11]} />
            <meshStandardMaterial color="#23312b" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.38, 0.095]} />
            <meshStandardMaterial
              map={bulletinBtnTex}
              emissive="#ffffff"
              emissiveMap={bulletinBtnTex}
              emissiveIntensity={0.4}
              roughness={0.8}
            />
          </mesh>
        </group>

        {/* Single Sculpted 3D Keybank Block (avoids raycasting 24 individual keycap meshes) */}
        <mesh
          position={[0, 0.05, 0.08]}
          onClick={(e) => {
            e.stopPropagation();
            playTerminalKeyBeep(880);
          }}
        >
          <boxGeometry args={[1.22, 0.03, 0.11]} />
          <meshStandardMaterial color="#141414" roughness={0.55} />
        </mesh>
      </group>

      {/* Lower Mainframe Magnetic Tape Drive Reels */}
      <group position={[0, 0.36, 0.07]}>
        <mesh position={[0, 0, -0.01]}>
          <boxGeometry args={[1.18, 0.48, 0.04]} />
          <meshStandardMaterial color="#141414" roughness={0.8} />
        </mesh>
        <mesh
          ref={reelLeftRef}
          position={[-0.3, 0, 0.025]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.16, 0.16, 0.025, 12]} />
          <meshStandardMaterial
            color="#364940"
            roughness={0.5}
            metalness={0.6}
          />
        </mesh>
        <mesh
          ref={reelRightRef}
          position={[0.3, 0, 0.025]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.16, 0.16, 0.025, 12]} />
          <meshStandardMaterial
            color="#364940"
            roughness={0.5}
            metalness={0.6}
          />
        </mesh>
      </group>
    </group>
  );
};
