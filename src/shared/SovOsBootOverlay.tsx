import { useThree } from "@react-three/fiber";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { prefetchKomradVoxAssets } from "./komradVoiceSynth";

type BootTagTone = "green" | "amber" | "red";

interface BootDiagnosticEntry {
  readonly text: string;
  readonly tag: string;
  readonly tone: BootTagTone;
}

const BOOT_DIAGNOSTIC_POOL: readonly BootDiagnosticEntry[] = [
  {
    text: 'CALIBRATING POSITIVE VOID COEFFICIENT TO "OPTIMISTIC"',
    tag: "[OK]",
    tone: "green",
  },
  {
    text: "VERIFYING RBMK MELTDOWN IMPOSSIBILITY THEOREM",
    tag: "[PROVEN BY DECREE]",
    tone: "amber",
  },
  {
    text: "SWEEPING PREVIOUS SHIFT'S GRAPHITE DUST UNDER RUG",
    tag: "[OK]",
    tone: "green",
  },
  {
    text: "DOWNLOADING APPROVED OPINIONS FROM MOSCOW",
    tag: "[100%]",
    tone: "green",
  },
  {
    text: "CHECKING STEAM DRUM SEALS (DUCT TAPE INTEGRITY: ACCEPTABLE)",
    tag: "[OK]",
    tone: "green",
  },
  {
    text: "SUPPRESSING BOURGEOIS FRAME DROPS",
    tag: "[LIQUIDATED]",
    tone: "red",
  },
  {
    text: "FILING FORM 84-B FOR UNAUTHORIZED NEUTRON FLUX",
    tag: "[STAMPED]",
    tone: "amber",
  },
  {
    text: "TESTING AZ-5 BUTTON (NOTE: DO NOT ACTUALLY TEST)",
    tag: "[SKIPPED]",
    tone: "amber",
  },
  {
    text: "ALLOCATING 64 KB RAM EQUALLY AMONG 270 MILLION CITIZENS",
    tag: "[OK]",
    tone: "green",
  },
  {
    text: "SCANNING FOR WESTERN WEATHER BALLOONS",
    tag: "[3 SUSPECTED]",
    tone: "amber",
  },
  {
    text: "LUBRICATING K.O.M.R.A.D.-84 SARCASM SUBROUTINES",
    tag: "[OK]",
    tone: "green",
  },
  {
    text: "FALSIFYING LAST MONTH'S SAFETY INSPECTION LOGS",
    tag: "[142% SAFE]",
    tone: "amber",
  },
  {
    text: "REPLACING BLOWN FUSES WITH FIVE-KOPECK COINS",
    tag: "[CONDUCTING]",
    tone: "green",
  },
  {
    text: "CONFISCATING EXTRA PIXELS FOR STATE RESERVE",
    tag: "[OK]",
    tone: "green",
  },
  {
    text: "POLISHING LENIN BUST TO IDEOLOGICAL SPECULARITY",
    tag: "[SHINY]",
    tone: "green",
  },
  {
    text: "SILENCING GEIGER COUNTER ABOVE 3.6 ROENTGEN",
    tag: "[NOT GREAT, NOT TERRIBLE]",
    tone: "amber",
  },
  {
    text: "PRESSURIZING AIRLOCK MCR-4 WITH 1979 CABBAGE VAPOR",
    tag: "[SEALED]",
    tone: "green",
  },
  {
    text: "CHECKING ELEVATOR LIFT-84 MAINTENANCE ETA",
    tag: "[1989]",
    tone: "amber",
  },
  {
    text: "AUDITING TURBINE HALL BOLT INVENTORY AGAINST 1974 LEDGER",
    tag: "[CLASSIFIED]",
    tone: "red",
  },
  {
    text: "LOADING VOLKOV TEMPER TANTRUM DICTIONARY",
    tag: "[OK]",
    tone: "green",
  },
  {
    text: "TRAINING COOLING PUMPS TO IGNORE CAVITATION",
    tag: "[BRAVE]",
    tone: "green",
  },
  {
    text: "COUNTING UNREPORTED INCIDENTS",
    tag: "[0 FOUND]",
    tone: "green",
  },
  {
    text: "SYNCHRONIZING CANTEEN POTATO RATION WITH TURBINE RPM",
    tag: "[BOILING]",
    tone: "amber",
  },
  {
    text: "DEGAUSSING PRAVDA TELETYPE OF IMPERIALIST COMMAS",
    tag: "[REDACTED]",
    tone: "red",
  },
  {
    text: "REASSIGNING XENON POISONING TO CIA SABOTAGE",
    tag: "[BLAMED ON WEST]",
    tone: "red",
  },
  {
    text: "PAINTING RUSTED PIPES THIRD COAT OF INSTITUTIONAL GREEN",
    tag: "[104%]",
    tone: "amber",
  },
  {
    text: "VERIFYING SAFETY MANUAL PAGES 4 THROUGH 98 EXIST",
    tag: "[IGNORED]",
    tone: "amber",
  },
  {
    text: "COMPILING FIVE-YEAR SHADER PLAN IN THREE FRAMES",
    tag: "[STAKHANOVITE]",
    tone: "green",
  },
  {
    text: "ATTACHING LEAD APRON TO MAINFRAME FLOPPY DRIVE",
    tag: "[BYPASSED]",
    tone: "amber",
  },
  {
    text: "AUDITING OPERATOR OLEG'S RUBBER STAMP VELOCITY",
    tag: "[ADEQUATE]",
    tone: "green",
  },
  {
    text: 'RECALIBRATING THERMOMETERS TO DISPLAY "COZY"',
    tag: "[OK]",
    tone: "green",
  },
  {
    text: "SEALING COMPLAINT BOX WITH WELDING TORCH",
    tag: "[HERMETIC]",
    tone: "green",
  },
] as const;

const BOOT_FOOTER_QUIPS: readonly string[] = [
  "REMEMBER: MELTDOWN IS WESTERN PROPAGANDA. REPORT TO AIRLOCK MCR-4.",
  "ALL RADIATION DOSIMETERS PRE-STAMPED 'NORMAL'. ENJOY YOUR NIGHT SHIFT.",
  "COMMISSAR VOLKOV EXPECTS QUOTA COMPLETION BEFORE SUNRISE, COMRADE.",
  "DO NOT QUESTION THE GLOWING WATER. DO NOT QUESTION K.O.M.R.A.D.-84.",
  "SAFETY VIOLATIONS WILL BE DEDUCTED FROM NEXT YEAR'S POTATO ALLOCATION.",
  "GLORY TO SECTOR 84. KEEP BOTH EYES ON THE GAUGES AND ONE ON LANGLEY.",
  "AIRLOCK MCR-4 STANDING BY. UNAUTHORIZED PANIC IS STRICTLY FORBIDDEN.",
  "FIVE-YEAR PLAN UPTIME TARGET: 112%. PLEASE REPORT TO YOUR CONSOLE.",
] as const;

// Paced for comfortable reading (~6.45s total): 5 lines ~980ms apart,
// each stamping its [STATUS] tag 300ms after its text prints.
const LINE_TEXT_REVEAL_MS = [320, 1300, 2280, 3260, 4240] as const;
const STATUS_STAMP_DELAY_MS = 300;
const MIN_BOOT_MS = 5050;
const HARD_FALLBACK_MS = 7600;
const READY_HOLD_MS = 1400;
const FADE_OUT_MS = 350;
const TOTAL_BAR_CELLS = 24;
const MAX_TEXTURES_PER_FRAME = 4;
const WARMUP_CARDINAL_YAWS = [0, -Math.PI / 2, Math.PI, Math.PI / 2] as const;

let ambientPreloadAudio: HTMLAudioElement | null = null;

function preloadMainAmbientSoundtrack(): void {
  if (ambientPreloadAudio || typeof Audio === "undefined") return;
  try {
    const baseUrl = import.meta.env.BASE_URL ?? "/";
    const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const el = new Audio();
    el.dataset.okean84Radio = "1";
    el.preload = "auto";
    el.volume = 0;
    el.src = `${normalizedBase}music/night-shift.mp3`;
    el.load();
    ambientPreloadAudio = el;
  } catch {
    // Ignore audio pre-fetch errors silently during boot
  }
}

interface RandomizedBootBatch {
  lines: readonly BootDiagnosticEntry[];
  footerQuip: string;
}

function selectRandomBootBatch(): RandomizedBootBatch {
  const pool = [...BOOT_DIAGNOSTIC_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  const quipIdx = Math.floor(Math.random() * BOOT_FOOTER_QUIPS.length);
  return {
    lines: pool.slice(0, 5),
    footerQuip: BOOT_FOOTER_QUIPS[quipIdx] ?? BOOT_FOOTER_QUIPS[0],
  };
}

const TEXTURE_SLOTS = [
  "map",
  "emissiveMap",
  "roughnessMap",
  "bumpMap",
  "normalMap",
  "metalnessMap",
  "aoMap",
  "alphaMap",
  "lightMap",
] as const;

interface CompilerRenderer {
  compileAsync?: (
    scene: THREE.Object3D,
    camera: THREE.Camera,
  ) => Promise<unknown>;
}

/**
 * Staggered 4-angle WebGL GPU & VAO pre-compilation helper inside `<Canvas>`.
 * Waits 3 frames after mount so procedural CanvasTextures & instanced meshes commit,
 * uploads unique textures at <=4/frame, compiles shaders, renders 4 cardinal angles
 * with frustum culling disabled, restores exact camera pose & culling flags, and
 * triggers background VOX + main soundtrack pre-fetch behind the boot curtain.
 */
export const SceneGpuWarmup: React.FC<{ onComplete: () => void }> = ({
  onComplete,
}) => {
  const { gl, scene, camera } = useThree();
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;

    const nextFrame = () =>
      new Promise<void>((resolve) => {
        rafId = window.requestAnimationFrame(() => resolve());
      });

    const isTextureUploadReady = (tex: THREE.Texture): boolean => {
      const img = tex.image as unknown;
      if (!img) return false;
      if (
        typeof HTMLImageElement !== "undefined" &&
        img instanceof HTMLImageElement
      ) {
        return img.complete && img.naturalWidth > 0;
      }
      return true;
    };

    const runWarmup = async () => {
      const savedCulling: Array<{ obj: THREE.Object3D; prev: boolean }> = [];
      const savedQuat = camera.quaternion.clone();
      const savedPos = camera.position.clone();
      const yawEuler = new THREE.Euler(0, 0, 0, "YXZ");

      try {
        // Wait 3 frames so all useMemo/useEffect procedural canvases & instanced meshes commit
        await nextFrame();
        if (cancelled) return;
        await nextFrame();
        if (cancelled) return;
        await nextFrame();
        if (cancelled) return;

        const uniqueTextures = new Set<THREE.Texture>();
        const collectMaterialTextures = (mat: THREE.Material) => {
          const matRecord = mat as unknown as Record<string, unknown>;
          for (let i = 0; i < TEXTURE_SLOTS.length; i++) {
            const candidate = matRecord[TEXTURE_SLOTS[i]];
            if (candidate instanceof THREE.Texture) {
              uniqueTextures.add(candidate);
            }
          }
        };

        scene.traverse((obj) => {
          if (
            obj instanceof THREE.Mesh ||
            obj instanceof THREE.Points ||
            obj instanceof THREE.Line ||
            obj instanceof THREE.Sprite
          ) {
            savedCulling.push({ obj, prev: obj.frustumCulled });
            obj.frustumCulled = false;

            const matProp = (obj as { material?: THREE.Material | THREE.Material[] })
              .material;
            if (Array.isArray(matProp)) {
              for (let i = 0; i < matProp.length; i++) {
                if (matProp[i]) collectMaterialTextures(matProp[i]);
              }
            } else if (matProp) {
              collectMaterialTextures(matProp);
            }
          }
        });

        if (scene.environment instanceof THREE.Texture) {
          uniqueTextures.add(scene.environment);
        }
        if (scene.background instanceof THREE.Texture) {
          uniqueTextures.add(scene.background);
        }

        // Upload textures staggered at max 4 per frame so BIOS text stays smooth
        const texList = Array.from(uniqueTextures).filter(isTextureUploadReady);
        for (let i = 0; i < texList.length; i += MAX_TEXTURES_PER_FRAME) {
          await nextFrame();
          if (cancelled) return;
          const end = Math.min(texList.length, i + MAX_TEXTURES_PER_FRAME);
          for (let j = i; j < end; j++) {
            try {
              gl.initTexture(texList[j]);
            } catch {
              // Ignore unsupported or disposed textures safely during warmup
            }
          }
        }

        // Compile WebGL programs across scene
        await nextFrame();
        if (cancelled) return;

        scene.updateMatrixWorld(true);
        camera.updateMatrixWorld();

        const asyncCompiler = gl as unknown as CompilerRenderer;
        if (typeof asyncCompiler.compileAsync === "function") {
          try {
            await asyncCompiler.compileAsync(scene, camera);
          } catch {
            gl.compile(scene, camera);
          }
        } else {
          gl.compile(scene, camera);
        }
        if (cancelled) return;

        // 4-angle real GPU draw warmup (North, East, South, West) across separate frames
        for (let a = 0; a < WARMUP_CARDINAL_YAWS.length; a++) {
          await nextFrame();
          if (cancelled) return;
          yawEuler.set(0, WARMUP_CARDINAL_YAWS[a], 0);
          camera.quaternion.setFromEuler(yawEuler);
          camera.updateMatrixWorld();
          gl.render(scene, camera);
        }
      } finally {
        camera.quaternion.copy(savedQuat);
        camera.position.copy(savedPos);
        camera.updateMatrixWorld();
        for (let i = 0; i < savedCulling.length; i++) {
          const entry = savedCulling[i];
          entry.obj.frustumCulled = entry.prev;
        }
      }

      if (!cancelled) {
        // Quietly warm VOX manifest/buffers & ambient soundtrack cache behind boot screen
        prefetchKomradVoxAssets();
        preloadMainAmbientSoundtrack();
        onCompleteRef.current();
      }
    };

    void runWarmup();

    return () => {
      cancelled = true;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [gl, scene, camera]);

  return null;
};

function getTagColor(tone: BootTagTone): string {
  if (tone === "red") return "#ff4d4d";
  if (tone === "amber") return "#ffb000";
  return "#33ff66";
}

function buildDottedLabel(label: string, totalCols = 64): string {
  const dotCount = Math.max(3, totalCols - label.length);
  return `${label}${".".repeat(dotCount)}`;
}

/**
 * Full-screen 1984 green-phosphor CRT BIOS overlay masking GPU warmup with
 * comfortably paced Soviet bureaucracy diagnostics (~6.45s) before dissolving into MCR-4.
 */
export const SovOsBootOverlay: React.FC<{
  gpuWarmupDone: boolean;
  onBootComplete: () => void;
}> = ({ gpuWarmupDone, onBootComplete }) => {
  const [batch] = useState<RandomizedBootBatch>(() => selectRandomBootBatch());
  const [revealedTextCount, setRevealedTextCount] = useState<number>(0);
  const [stampedStatusCount, setStampedStatusCount] = useState<number>(0);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [gpuLineDone, setGpuLineDone] = useState<boolean>(gpuWarmupDone);
  const [readyShown, setReadyShown] = useState<boolean>(false);
  const [fadingOut, setFadingOut] = useState<boolean>(false);
  const [unmounted, setUnmounted] = useState<boolean>(false);

  const gpuDoneRef = useRef(gpuWarmupDone);
  const onBootCompleteRef = useRef(onBootComplete);
  const bootCompletedRef = useRef(false);

  useEffect(() => {
    gpuDoneRef.current = gpuWarmupDone;
  }, [gpuWarmupDone]);

  useEffect(() => {
    onBootCompleteRef.current = onBootComplete;
  }, [onBootComplete]);

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    let readyTimer = 0;
    let unmountTimer = 0;
    const startMs = performance.now();

    let lastTextCount = -1;
    let lastStampCount = -1;
    let lastPct = -1;
    let lastGpuFlag = false;
    let readyTriggered = false;

    const finishBoot = () => {
      if (cancelled || bootCompletedRef.current) return;
      bootCompletedRef.current = true;
      setFadingOut(true);
      unmountTimer = window.setTimeout(() => {
        if (!cancelled) {
          onBootCompleteRef.current();
          setUnmounted(true);
        }
      }, FADE_OUT_MS);
    };

    const onBypassKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (!gpuDoneRef.current || bootCompletedRef.current) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      readyTriggered = true;
      if (readyTimer) {
        window.clearTimeout(readyTimer);
        readyTimer = 0;
      }
      setRevealedTextCount(LINE_TEXT_REVEAL_MS.length);
      setStampedStatusCount(LINE_TEXT_REVEAL_MS.length);
      setGpuLineDone(true);
      setProgressPct(100);
      setReadyShown(true);
      finishBoot();
    };
    window.addEventListener("keydown", onBypassKeyDown, { capture: true });

    const tickBoot = (now: number) => {
      if (cancelled) return;
      const elapsed = now - startMs;

      let textCount = 0;
      let stampCount = 0;
      for (let i = 0; i < LINE_TEXT_REVEAL_MS.length; i++) {
        if (elapsed >= LINE_TEXT_REVEAL_MS[i]) {
          textCount = i + 1;
        }
        if (elapsed >= LINE_TEXT_REVEAL_MS[i] + STATUS_STAMP_DELAY_MS) {
          stampCount = i + 1;
        }
      }
      if (textCount !== lastTextCount) {
        lastTextCount = textCount;
        setRevealedTextCount(textCount);
      }
      if (stampCount !== lastStampCount) {
        lastStampCount = stampCount;
        setStampedStatusCount(stampCount);
      }

      const gpuReadyNow = gpuDoneRef.current || elapsed >= HARD_FALLBACK_MS;
      if (gpuReadyNow !== lastGpuFlag) {
        lastGpuFlag = gpuReadyNow;
        setGpuLineDone(gpuReadyNow);
      }

      const canComplete =
        (elapsed >= MIN_BOOT_MS && gpuDoneRef.current) ||
        elapsed >= HARD_FALLBACK_MS;

      const rawPct = canComplete
        ? 100
        : Math.min(94, Math.round((elapsed / 5000) * 94));
      if (rawPct !== lastPct) {
        lastPct = rawPct;
        setProgressPct(rawPct);
      }

      if (canComplete && !readyTriggered) {
        readyTriggered = true;
        setRevealedTextCount(LINE_TEXT_REVEAL_MS.length);
        setStampedStatusCount(LINE_TEXT_REVEAL_MS.length);
        setGpuLineDone(true);
        setProgressPct(100);
        setReadyShown(true);
        readyTimer = window.setTimeout(finishBoot, READY_HOLD_MS);
        return;
      }

      if (!readyTriggered) {
        rafId = window.requestAnimationFrame(tickBoot);
      }
    };

    rafId = window.requestAnimationFrame(tickBoot);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onBypassKeyDown, { capture: true });
      if (rafId) window.cancelAnimationFrame(rafId);
      if (readyTimer) window.clearTimeout(readyTimer);
      if (unmountTimer) window.clearTimeout(unmountTimer);
    };
  }, []);

  if (unmounted) return null;

  const filledCells = Math.round((progressPct / 100) * TOTAL_BAR_CELLS);
  const progressBar = `[${"█".repeat(filledCells)}${"░".repeat(
    TOTAL_BAR_CELLS - filledCells,
  )}] ${String(progressPct).padStart(3, " ")}%`;

  const stopInteractiveEvent = (e: React.SyntheticEvent) => {
    if (!fadingOut) {
      e.stopPropagation();
    }
  };

  return (
    <div
      onMouseDown={stopInteractiveEvent}
      onPointerDown={stopInteractiveEvent}
      onClick={stopInteractiveEvent}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#050a06",
        pointerEvents: fadingOut ? "none" : "auto",
        opacity: fadingOut ? 0 : 1,
        transform: fadingOut ? "scaleY(1.015)" : "scaleY(1)",
        filter: fadingOut ? "brightness(1.35)" : "brightness(1)",
        transition: `opacity ${FADE_OUT_MS}ms cubic-bezier(0.22, 1, 0.36, 1), transform ${FADE_OUT_MS}ms ease-out, filter ${FADE_OUT_MS}ms ease-out`,
        fontFamily: '"VT323", "Courier Prime", "Consolas", monospace',
        color: "#33ff66",
        textShadow: "0 0 8px rgba(51, 255, 102, 0.45)",
      }}
      className="flex flex-col justify-between overflow-hidden px-5 py-6 select-none sm:px-10 sm:py-8"
    >
      {/* Subtle CRT Scanlines Overlay */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.34) 0px, rgba(0, 0, 0, 0.34) 1px, transparent 1px, transparent 3px)",
        }}
      />
      {/* Deep CRT Glass Vignette */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, rgba(10, 28, 14, 0) 48%, rgba(2, 5, 3, 0.78) 100%)",
          boxShadow: "inset 0 0 80px rgba(0, 0, 0, 0.85)",
        }}
      />

      {/* Top BIOS Container */}
      <div className="relative z-10 mx-auto w-full max-w-4xl">
        {/* Top Banner */}
        <div className="border-b-2 border-[#33ff66]/45 pb-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-lg font-bold tracking-[0.08em] sm:text-2xl">
            <span>
              SOV-OS 84 // SECTOR-84 KERNEL ROM v4.1984 (GOSPLAN APPROVED)
            </span>
            <span
              className="text-[#ffb000]"
              style={{ textShadow: "0 0 8px rgba(255, 176, 0, 0.45)" }}
            >
              RBMK-1000 BIOS
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-base tracking-[0.08em] text-[#8ef7a8] sm:text-xl">
            <span>MINISTRY OF ATOMIC ENERGY &amp; HEAVY INDUSTRY — MCR-4</span>
            <span>64 KB SOCIALIST RAM OK</span>
          </div>
        </div>

        {/* Boot Diagnostic Lines */}
        <div className="mt-5 space-y-2.5 text-base tracking-[0.04em] sm:text-xl">
          {/* Line 0: Live WebGL GPU Warmup Line */}
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#33ff66]/10 pb-1">
            <span className="min-w-0 truncate text-[#c4ffd2]">
              {buildDottedLabel(
                "PRE-WARMING MCR-4 WEBGL SHADERS & PHOSPHOR TEXTURES",
              )}
            </span>
            <span
              className="shrink-0 font-bold"
              style={{
                color: gpuLineDone ? "#33ff66" : "#ffb000",
                textShadow: gpuLineDone
                  ? "0 0 8px rgba(51, 255, 102, 0.5)"
                  : "0 0 8px rgba(255, 176, 0, 0.5)",
              }}
            >
              {gpuLineDone ? "[OK]" : "[WARMING...]"}
            </span>
          </div>

          {/* 5 Randomized Soviet Parody Diagnostics (Text first -> [STATUS] stamped 300ms later) */}
          {batch.lines.slice(0, revealedTextCount).map((entry, idx) => {
            const isStamped = idx < stampedStatusCount;
            const tagColor = getTagColor(entry.tone);
            return (
              <div
                key={entry.text}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#33ff66]/10 pb-1"
              >
                <span className="min-w-0 truncate text-[#b8f7c8]">
                  {buildDottedLabel(entry.text)}
                </span>
                {isStamped ? (
                  <span
                    className="shrink-0 font-bold"
                    style={{
                      color: tagColor,
                      textShadow: `0 0 8px ${tagColor}80`,
                    }}
                  >
                    {entry.tag}
                  </span>
                ) : (
                  <span className="shrink-0 animate-pulse font-bold text-[#ffb000]">
                    ...█
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Randomized [READY] Footer Quip */}
        {readyShown && (
          <div
            className="mt-6 rounded border border-[#33ff66]/55 bg-[#0a1d10]/85 px-4 py-2.5 text-lg tracking-[0.07em] sm:text-2xl"
            style={{
              boxShadow: "0 0 18px rgba(51, 255, 102, 0.16)",
            }}
          >
            <span className="mr-2 font-bold text-[#ffb000]">[READY]</span>
            <span className="text-[#e6dec3]">{batch.footerQuip}</span>
          </div>
        )}
      </div>

      {/* Bottom Progress Bar & Blinking Phosphor Cursor */}
      <div className="relative z-10 mx-auto w-full max-w-4xl border-t-2 border-[#33ff66]/45 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-lg tracking-[0.08em] sm:text-2xl">
          <div className="flex items-center gap-2 font-bold">
            <span className="text-[#8ef7a8]">INITIALIZING MCR-4 TERMINAL</span>
            <span className="animate-pulse text-[#33ff66]">█</span>
          </div>
          <div className="font-bold tracking-[0.05em] text-[#33ff66]">
            {progressBar}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2 text-sm tracking-[0.1em] sm:text-base">
          <span className="text-[#33ff66]/70">
            C:\GOSPLAN\MCR4&gt; MOUNTING AIRLOCK &amp; DIALS... DO NOT ADJUST CRT VERTICAL HOLD
          </span>
          {gpuLineDone && !fadingOut && (
            <span className="shrink-0 text-[#33ff66]/55">
              [PRESS SPACE TO BYPASS DIAGNOSTICS]
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
