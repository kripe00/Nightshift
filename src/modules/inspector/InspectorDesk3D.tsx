import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useCameraLookStore } from '../../shared/CameraController'
import {
  applySovietPBRToHierarchy,
  getBrushedBrassTextures,
  getHammeredIronTextures,
  getWeatheredMahoganyTextures,
  getWornInspectionMatTextures,
} from '../../shared/proceduralMaterials'
import type { DiagnosticAlarmId, WePadTabId } from '../../shared/types'
import {
  getContextualDiagnosticHint,
  useGameStore,
} from '../../shared/useGameStore'
import {
  BREECH_CHAMBER_DROP_ZONE_3D,
  CAPSULE_CRADLE_POS_3D,
  INK_COLOR_HEX,
  MANUAL_DEFAULT_POS_3D,
  OUTBOX_BREECH_POS_3D,
  OUTBOX_DROP_ZONE_3D,
  PAPER_COLOR_HEX,
  PAPER_COMPACT_H_3D,
  PAPER_COMPACT_W_3D,
  PAPER_EXPANDED_H_3D,
  PAPER_EXPANDED_W_3D,
  PRINTER_FEED_STEPS,
  PRINTER_FEED_STEP_M,
  PRINTER_FEED_STEP_MS,
  PRINTER_SLOT_X_3D,
  PRINTER_TRAY_BOUNDARY_X_3D,
  SHREDDER_DROP_ZONE_3D,
  SHREDDER_POS_3D,
  useDeskStore,
  type DeskDocument,
  type StampType,
} from './useDeskStore'
import {
  installGlobalMuteController,
  playAmberWarningChime,
  playBobbleBoingSound,
  playBreechHatchLatchSound,
  playCapsuleChamberLoadSound,
  playCapsulePackSound,
  playCarriageReturnDing,
  playCriticalRedKlaxonPulse,
  playDetentClick,
  playDispatchErrorBuzzer,
  playLineFeedTick,
  playPageTurnSound,
  playPaperInsertSnap,
  playPaperRustle,
  playPaperSettleSlap,
  playPaperSlideBump,
  playPaperTearSound,
  playPneumaticDispatchSound,
  playScrollTickSound,
  playShredFinalClunk,
  playShredGrindCrunch,
  playStampInkThud,
  playSwitchClank,
} from './audio'
import {
  apply16ColorBayerDither,
  drawBobbleNameplateCanvas,
  drawCompactTeletypeSlipCanvas,
  drawDeskHeaderTickerCanvas,
  drawFullDirectiveSheetCanvas,
  drawHazardChevronCanvas,
  drawKristianovBobbleFaceCanvas,
  drawOlegBobbleFaceCanvas,
  drawTrue2xOpticalLensCanvas,
  drawWePad84ScreenCanvas,
  type WePadTelemetryPayload,
} from './inspectorCanvas'

const BASE_MAT_Y = 0.924

function createNearestCanvasTexture(
  width: number,
  height: number,
  draw?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  bayerDither = false
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.imageSmoothingEnabled = false
    draw?.(ctx, width, height)
    if (bayerDither) {
      apply16ColorBayerDither(ctx, width, height, 14)
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function createCrispDocumentCanvasTexture(
  width: number,
  height: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.imageSmoothingEnabled = true
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.anisotropy = 8
  tex.generateMipmaps = false
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/**
 * Guardrail 3: Intersects the pointer's 3D ray with the horizontal desk surface plane
 * in desk-local coordinates (`y = planeY`), guaranteeing that even rapid mouse movements
 * never lose tracking during active drags.
 */
const _localRay = new THREE.Ray()
const _invMatrix = new THREE.Matrix4()
const _deskPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BASE_MAT_Y)
const _hitPoint = new THREE.Vector3()

function getDeskLocalHitFromEvent(
  e: ThreeEvent<PointerEvent>,
  deskGroup: THREE.Group | null,
  planeY = BASE_MAT_Y
): { x: number; z: number } | null {
  if (!deskGroup) return null
  _invMatrix.copy(deskGroup.matrixWorld).invert()
  _localRay.copy(e.ray).applyMatrix4(_invMatrix)
  _deskPlane.constant = -planeY
  const hit = _localRay.intersectPlane(_deskPlane, _hitPoint)
  if (hit) {
    return { x: hit.x, z: hit.z }
  }
  const fallback = deskGroup.worldToLocal(e.point.clone())
  return { x: fallback.x, z: fallback.z }
}

const MANUAL_BASE_W = 0.38
const MANUAL_BASE_H = 0.45
const MANUAL_SCALE = 1.48
const MANUAL_HELD_SCALE = 0.315
const MANUAL_INSPECT_SCALE = 0.58
const _manualDeskQuat = new THREE.Quaternion()
const _manualHeldLocalQuat = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(Math.PI / 2 - 0.12, 0.16, -0.02, 'YXZ')
)
const _manualInspectLocalQuat = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(Math.PI / 2 - 0.02, 0, 0, 'YXZ')
)
const _manualBlendLocalQuat = new THREE.Quaternion()
const _manualHeldTargetQuat = new THREE.Quaternion()
const _manualDeskPos = new THREE.Vector3()
const _manualHeldWorldPos = new THREE.Vector3()

const MANUAL_BOUNDS_3D = {
  x: MANUAL_DEFAULT_POS_3D.x,
  z: MANUAL_DEFAULT_POS_3D.z,
  width: MANUAL_BASE_W * MANUAL_SCALE,
  height: MANUAL_BASE_H * MANUAL_SCALE,
}

const STRIP_VARIANCE = [
  0.84, 1, 0.9, 0.97, 0.8, 1, 0.92, 0.86, 1, 0.94, 0.82, 0.98, 0.9, 1, 0.85,
]
const JITTER_CYCLE = [-0.008, 0.006, -0.005, 0.008, 0]
let nextStampSeq = 1

interface BobbleSpringState {
  angleX: number
  angleZ: number
  velX: number
  velZ: number
}

interface KomradBobbleheads3DProps {
  shockwaveRef: React.RefObject<{ kristianov: number; oleg: number }>
}

/**
 * PART 2: Interactive Soviet Easter Egg Bobblehead Figurines of
 * Chief Engineer KOMRAD KRISTIANOV ("КРИСТИАНОВ") and Senior KGB Inspector KOMRAD OLEG ("ОЛЕГ")!
 * Features damped harmonic spring physics (`stiffness = 190`, `damping = 5.5`), coiled metal neck springs,
 * 16-color Bayer-dithered portraits, direct poke/swipe "boing!" SFX, and desk shockwave coupling.
 */
function KomradBobbleheads3D({ shockwaveRef }: KomradBobbleheads3DProps) {
  const kristianovHeadRef = useRef<THREE.Group | null>(null)
  const olegHeadRef = useRef<THREE.Group | null>(null)

  const physRef = useRef<{
    kristianov: BobbleSpringState
    oleg: BobbleSpringState
  }>({
    kristianov: { angleX: 0, angleZ: 0, velX: 0.8, velZ: -0.5 },
    oleg: { angleX: 0, angleZ: 0, velX: -0.7, velZ: 0.6 },
  })

  const kristianovFaceTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 128, (ctx, w, h) => {
        drawKristianovBobbleFaceCanvas(ctx, w, h)
      }),
    []
  )
  const olegFaceTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 128, (ctx, w, h) => {
        drawOlegBobbleFaceCanvas(ctx, w, h)
      }),
    []
  )
  const kristianovPlateTex = useMemo(
    () =>
      createNearestCanvasTexture(256, 64, (ctx, w, h) => {
        drawBobbleNameplateCanvas(ctx, w, h, 'КРИСТИАНОВ', 'ГЛ. ИНЖЕНЕР АЭС')
      }),
    []
  )
  const olegPlateTex = useMemo(
    () =>
      createNearestCanvasTexture(256, 64, (ctx, w, h) => {
        drawBobbleNameplateCanvas(ctx, w, h, 'ОЛЕГ', 'СТ. ИНСПЕКТОР КГБ')
      }),
    []
  )

  useFrame((_, delta) => {
    const dt = Math.min(0.033, delta)
    const stiffness = 190
    const damping = 5.5

    // Inject any pending desk shockwave impulses (from stamping, shredding, or tearing paper)
    if (shockwaveRef.current.kristianov > 0) {
      const imp = shockwaveRef.current.kristianov
      shockwaveRef.current.kristianov = 0
      physRef.current.kristianov.velX += imp * 7.5
      physRef.current.kristianov.velZ += (Math.random() - 0.5) * imp * 6.0
    }
    if (shockwaveRef.current.oleg > 0) {
      const imp = shockwaveRef.current.oleg
      shockwaveRef.current.oleg = 0
      physRef.current.oleg.velX += imp * 7.5
      physRef.current.oleg.velZ += (Math.random() - 0.5) * imp * 6.0
    }

    for (const key of ['kristianov', 'oleg'] as const) {
      const st = physRef.current[key]
      const accX = -stiffness * st.angleX - damping * st.velX
      const accZ = -stiffness * st.angleZ - damping * st.velZ
      st.velX += accX * dt
      st.velZ += accZ * dt
      st.angleX = THREE.MathUtils.clamp(st.angleX + st.velX * dt, -0.52, 0.52)
      st.angleZ = THREE.MathUtils.clamp(st.angleZ + st.velZ * dt, -0.52, 0.52)
    }

    if (kristianovHeadRef.current) {
      kristianovHeadRef.current.rotation.set(
        physRef.current.kristianov.angleX,
        Math.sin(physRef.current.kristianov.angleZ) * 0.25,
        physRef.current.kristianov.angleZ
      )
    }
    if (olegHeadRef.current) {
      olegHeadRef.current.rotation.set(
        physRef.current.oleg.angleX,
        Math.sin(physRef.current.oleg.angleZ) * 0.25,
        physRef.current.oleg.angleZ
      )
    }
  })

  const pokeBobblehead = (
    who: 'kristianov' | 'oleg',
    e: ThreeEvent<PointerEvent>
  ) => {
    e.stopPropagation()
    const st = physRef.current[who]
    st.velX += 11.5 + (Math.random() - 0.3) * 6
    st.velZ += (Math.random() - 0.5) * 14
    playBobbleBoingSound(who === 'kristianov' ? 1.08 : 0.92)
  }

  return (
    <>
      {/* ============================================================
          BOBBLEHEAD 1: CHIEF ENGINEER KOMRAD KRISTIANOV ("КРИСТИАНОВ")
          Positioned between the green banker's lamp and the left edge of the ПУНКТ №4 status ticker
         ============================================================ */}
      <group
        position={[-0.58, 0.926, -0.35]}
        rotation={[0, 0.22, 0]}
        scale={0.86}
        onPointerDown={(e) => pokeBobblehead('kristianov', e)}
      >
        {/* Cast-Iron Stepped Pedestal Base */}
        <mesh position={[0, 0.012, 0]}>
          <cylinderGeometry args={[0.062, 0.072, 0.024, 14]} />
          <meshStandardMaterial
            color="#18211b"
            roughness={0.6}
            metalness={0.55}
          />
        </mesh>
        <mesh position={[0, 0.026, 0]}>
          <cylinderGeometry args={[0.052, 0.058, 0.008, 14]} />
          <meshStandardMaterial
            color="#8c7a4b"
            roughness={0.35}
            metalness={0.8}
          />
        </mesh>
        {/* Bright Brass Pedestal Nameplate ("КРИСТИАНОВ") */}
        <mesh position={[0, 0.017, 0.072]} rotation={[-0.28, 0, 0]}>
          <planeGeometry args={[0.118, 0.036]} />
          <meshStandardMaterial
            map={kristianovPlateTex}
            emissive="#ffffff"
            emissiveMap={kristianovPlateTex}
            emissiveIntensity={0.28}
            roughness={0.4}
          />
        </mesh>

        {/* Soviet Nuclear Engineer Lab Coat Torso & Dark Trousers */}
        <mesh position={[-0.016, 0.048, 0]}>
          <cylinderGeometry args={[0.013, 0.015, 0.04, 8]} />
          <meshStandardMaterial color="#18211b" roughness={0.8} />
        </mesh>
        <mesh position={[0.016, 0.048, 0]}>
          <cylinderGeometry args={[0.013, 0.015, 0.04, 8]} />
          <meshStandardMaterial color="#18211b" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.098, 0]}>
          <cylinderGeometry args={[0.036, 0.044, 0.078, 12]} />
          <meshStandardMaterial color="#cfc6b0" roughness={0.75} />
        </mesh>
        {/* Dark tie & Radiation Dosimeter Badge on Chest */}
        <mesh position={[0, 0.106, 0.038]}>
          <boxGeometry args={[0.01, 0.042, 0.006]} />
          <meshStandardMaterial color="#8b1e1e" roughness={0.6} />
        </mesh>
        <mesh position={[0.018, 0.114, 0.038]}>
          <boxGeometry args={[0.016, 0.012, 0.006]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>

        {/* Left Arm holding a Glowing Cherenkov Fuel Rod */}
        <group position={[-0.046, 0.102, 0.01]} rotation={[0.45, 0, 0.28]}>
          <mesh>
            <cylinderGeometry args={[0.01, 0.011, 0.052, 8]} />
            <meshStandardMaterial color="#cfc6b0" roughness={0.75} />
          </mesh>
          <mesh position={[0, -0.028, 0.018]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.007, 0.007, 0.068, 8]} />
            <meshStandardMaterial
              color="#33ff66"
              emissive="#33ff66"
              emissiveIntensity={1.6}
              roughness={0.2}
            />
          </mesh>
        </group>

        {/* Right Arm holding a Heavy Steel Reactor Wrench */}
        <group position={[0.046, 0.102, 0.01]} rotation={[-0.35, 0, -0.28]}>
          <mesh>
            <cylinderGeometry args={[0.01, 0.011, 0.052, 8]} />
            <meshStandardMaterial color="#cfc6b0" roughness={0.75} />
          </mesh>
          <mesh position={[0, -0.025, 0.016]} rotation={[Math.PI / 3, 0, 0]}>
            <boxGeometry args={[0.008, 0.056, 0.014]} />
            <meshStandardMaterial
              color="#778472"
              metalness={0.85}
              roughness={0.3}
            />
          </mesh>
        </group>

        {/* Visible Coiled Metal Neck Spring (4 stacked torus rings) */}
        {[0, 1, 2, 3].map((ringIdx) => (
          <mesh
            key={ringIdx}
            position={[0, 0.142 + ringIdx * 0.007, 0]}
            rotation={[Math.PI / 2, 0.1 * ringIdx, 0]}
          >
            <torusGeometry args={[0.014, 0.0032, 6, 12]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.88}
              roughness={0.25}
            />
          </mesh>
        ))}

        {/* Spring-Mounted Oversized Bobble Head ("КРИСТИАНОВ") */}
        <group ref={kristianovHeadRef} position={[0, 0.172, 0]}>
          <mesh position={[0, 0.036, 0]}>
            <boxGeometry args={[0.076, 0.074, 0.072]} />
            <meshStandardMaterial color="#cfc6b0" roughness={0.75} />
          </mesh>
          {/* 16-Color Bayer-Dithered Face Portrait on Front */}
          <mesh position={[0, 0.036, 0.037]}>
            <planeGeometry args={[0.072, 0.07]} />
            <meshStandardMaterial map={kristianovFaceTex} roughness={0.65} />
          </mesh>
          {/* Soviet Winter Ushanka Hat with Ear Flaps & Red Enamel Star */}
          <mesh position={[0, 0.078, 0]}>
            <boxGeometry args={[0.086, 0.032, 0.082]} />
            <meshStandardMaterial color="#23312b" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.076, 0.041]}>
            <boxGeometry args={[0.076, 0.024, 0.008]} />
            <meshStandardMaterial color="#18211b" roughness={0.92} />
          </mesh>
          <mesh position={[-0.044, 0.052, 0]} rotation={[0, 0, 0.12]}>
            <boxGeometry args={[0.012, 0.042, 0.046]} />
            <meshStandardMaterial color="#18211b" roughness={0.9} />
          </mesh>
          <mesh position={[0.044, 0.052, 0]} rotation={[0, 0, -0.12]}>
            <boxGeometry args={[0.012, 0.042, 0.046]} />
            <meshStandardMaterial color="#18211b" roughness={0.9} />
          </mesh>
          {/* Red Star Cockade on Ushanka */}
          <mesh position={[0, 0.078, 0.047]}>
            <circleGeometry args={[0.01, 5]} />
            <meshStandardMaterial
              color="#ff2a2a"
              emissive="#8b1e1e"
              emissiveIntensity={0.4}
              roughness={0.35}
            />
          </mesh>
        </group>
      </group>

      {/* ============================================================
          BOBBLEHEAD 2: SENIOR KGB INSPECTOR KOMRAD OLEG ("ОЛЕГ")
          Positioned between the right edge of the ПУНКТ №4 status ticker and the KGB Manual / desk flag
         ============================================================ */}
      <group
        position={[0.44, 0.926, -0.35]}
        rotation={[0, -0.22, 0]}
        scale={0.86}
        onPointerDown={(e) => pokeBobblehead('oleg', e)}
      >
        {/* Cast-Iron Stepped Pedestal Base */}
        <mesh position={[0, 0.012, 0]}>
          <cylinderGeometry args={[0.062, 0.072, 0.024, 14]} />
          <meshStandardMaterial
            color="#18211b"
            roughness={0.6}
            metalness={0.55}
          />
        </mesh>
        <mesh position={[0, 0.026, 0]}>
          <cylinderGeometry args={[0.052, 0.058, 0.008, 14]} />
          <meshStandardMaterial
            color="#8c7a4b"
            roughness={0.35}
            metalness={0.8}
          />
        </mesh>
        {/* Bright Brass Pedestal Nameplate ("ОЛЕГ") */}
        <mesh position={[0, 0.017, 0.072]} rotation={[-0.28, 0, 0]}>
          <planeGeometry args={[0.118, 0.036]} />
          <meshStandardMaterial
            map={olegPlateTex}
            emissive="#ffffff"
            emissiveMap={olegPlateTex}
            emissiveIntensity={0.28}
            roughness={0.4}
          />
        </mesh>

        {/* Olive-Drab KGB Senior Officer Tunic, Gold Epaulets & Red Collar Tabs */}
        <mesh position={[-0.016, 0.048, 0]}>
          <cylinderGeometry args={[0.013, 0.015, 0.04, 8]} />
          <meshStandardMaterial color="#18211b" roughness={0.8} />
        </mesh>
        <mesh position={[0.016, 0.048, 0]}>
          <cylinderGeometry args={[0.013, 0.015, 0.04, 8]} />
          <meshStandardMaterial color="#18211b" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.098, 0]}>
          <cylinderGeometry args={[0.036, 0.044, 0.078, 12]} />
          <meshStandardMaterial color="#2a362b" roughness={0.7} />
        </mesh>
        {/* Gold Shoulder Epaulets & Order of the Red Banner of Labor Medal */}
        <mesh position={[-0.032, 0.134, 0]} rotation={[0, 0, 0.15]}>
          <boxGeometry args={[0.026, 0.006, 0.022]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.85}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[0.032, 0.134, 0]} rotation={[0, 0, -0.15]}>
          <boxGeometry args={[0.026, 0.006, 0.022]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.85}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[-0.016, 0.114, 0.038]}>
          <circleGeometry args={[0.009, 8]} />
          <meshStandardMaterial
            color="#ff2a2a"
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>

        {/* Left Arm holding a Miniature Brass 2x Loupe */}
        <group position={[-0.046, 0.102, 0.01]} rotation={[-0.4, 0, 0.26]}>
          <mesh>
            <cylinderGeometry args={[0.01, 0.011, 0.052, 8]} />
            <meshStandardMaterial color="#2a362b" roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.028, 0.016]}>
            <torusGeometry args={[0.014, 0.003, 6, 12]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.85}
              roughness={0.25}
            />
          </mesh>
        </group>

        {/* Right Arm holding a Miniature Red УНИЧТОЖЕНО Rubber Stamp */}
        <group position={[0.046, 0.102, 0.01]} rotation={[-0.48, 0, -0.26]}>
          <mesh>
            <cylinderGeometry args={[0.01, 0.011, 0.052, 8]} />
            <meshStandardMaterial color="#2a362b" roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.026, 0.014]}>
            <boxGeometry args={[0.022, 0.012, 0.016]} />
            <meshStandardMaterial color="#8b1e1e" roughness={0.5} />
          </mesh>
        </group>

        {/* Visible Coiled Metal Neck Spring (4 stacked torus rings) */}
        {[0, 1, 2, 3].map((ringIdx) => (
          <mesh
            key={ringIdx}
            position={[0, 0.142 + ringIdx * 0.007, 0]}
            rotation={[Math.PI / 2, 0.1 * ringIdx, 0]}
          >
            <torusGeometry args={[0.014, 0.0032, 6, 12]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.88}
              roughness={0.25}
            />
          </mesh>
        ))}

        {/* Spring-Mounted Oversized Bobble Head ("ОЛЕГ") */}
        <group ref={olegHeadRef} position={[0, 0.172, 0]}>
          <mesh position={[0, 0.036, 0]}>
            <boxGeometry args={[0.076, 0.074, 0.072]} />
            <meshStandardMaterial color="#cfc6b0" roughness={0.75} />
          </mesh>
          {/* 16-Color Bayer-Dithered Face Portrait with Glorious Soviet Mustache */}
          <mesh position={[0, 0.036, 0.037]}>
            <planeGeometry args={[0.072, 0.07]} />
            <meshStandardMaterial map={olegFaceTex} roughness={0.65} />
          </mesh>
          {/* Sculpted 3D Mustache Relief Bar for Extra Depth */}
          <mesh position={[0, 0.022, 0.04]}>
            <boxGeometry args={[0.048, 0.01, 0.008]} />
            <meshStandardMaterial color="#2b1a12" roughness={0.85} />
          </mesh>

          {/* KGB Officer Peaked Visor Cap (Furazhka) with Crimson Band & Gold Cockade */}
          <mesh position={[0, 0.074, 0]}>
            <cylinderGeometry args={[0.046, 0.044, 0.014, 14]} />
            <meshStandardMaterial color="#8b1e1e" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.088, -0.004]} rotation={[-0.12, 0, 0]}>
            <cylinderGeometry args={[0.062, 0.046, 0.018, 16]} />
            <meshStandardMaterial color="#2a362b" roughness={0.7} />
          </mesh>
          {/* Glossy Black Visor Brim */}
          <mesh position={[0, 0.068, 0.036]} rotation={[0.28, 0, 0]}>
            <boxGeometry args={[0.068, 0.004, 0.028]} />
            <meshStandardMaterial
              color="#0d110f"
              roughness={0.2}
              metalness={0.4}
            />
          </mesh>
          {/* Golden Star Cockade on KGB Cap */}
          <mesh position={[0, 0.076, 0.045]}>
            <circleGeometry args={[0.009, 5]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>
        </group>
      </group>
    </>
  )
}

interface PaperShockwaveImpulse {
  vx: number
  vz: number
  angVel: number
  hopY: number
  liftHeight?: number
}

interface SharedPaperDragHandler {
  move: (hit: { x: number; z: number }, timeStamp: number) => void
  up: (timeStamp: number) => void
}

interface DraggablePaper3DProps {
  doc: DeskDocument
  stackIndex: number
  deskGroupRef: React.RefObject<THREE.Group | null>
  liveDocPosMapRef: React.RefObject<
    Record<string, { x: number; z: number; isExpanded: boolean }>
  >
  paperImpulseMapRef: React.RefObject<Record<string, PaperShockwaveImpulse>>
  sharedDragHandlersRef: React.RefObject<Record<string, SharedPaperDragHandler>>
  manualPosRef: React.RefObject<{
    x: number
    z: number
    dragging: boolean
    dx: number
    dz: number
  }>
  activeDragDocId: string | null
  setActiveDragDocId: (id: string | null) => void
  onDocumentMutated: () => void
  onTriggerPneumaticDispatch: (paperHex: string) => void
}

function DraggablePaper3D({
  doc,
  stackIndex,
  deskGroupRef,
  liveDocPosMapRef,
  paperImpulseMapRef,
  sharedDragHandlersRef,
  manualPosRef,
  activeDragDocId,
  setActiveDragDocId,
  onDocumentMutated,
  onTriggerPneumaticDispatch,
}: DraggablePaper3DProps) {
  const groupRef = useRef<THREE.Group | null>(null)
  const planeGeoRef = useRef<THREE.PlaneGeometry | null>(null)
  const shadowMatRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const matRef = useRef<THREE.MeshStandardMaterial | null>(null)

  const kinRef = useRef<{
    x: number
    z: number
    isExpanded: boolean
    targetX: number
    targetZ: number
    grabLocalX: number
    grabLocalZ: number
    grabRadius: number
    vx: number
    vz: number
    rotY: number
    angVel: number
    liftHeight: number
    hopVelY: number
    wasAirborne: boolean
    isCoasting: boolean
    lastHitX: number
    lastHitZ: number
    lastHitTime: number
    lastBumpSoundTime: number
    verticesDeformed: boolean
  }>({
    x: doc.x,
    z: doc.z,
    isExpanded: doc.isExpanded,
    targetX: doc.x,
    targetZ: doc.z,
    grabLocalX: 0,
    grabLocalZ: 0,
    grabRadius: 0,
    vx: 0,
    vz: 0,
    rotY: 0,
    angVel: 0,
    liftHeight: 0,
    hopVelY: 0,
    wasAirborne: false,
    isCoasting: false,
    lastHitX: doc.x,
    lastHitZ: doc.z,
    lastHitTime: 0,
    lastBumpSoundTime: 0,
    verticesDeformed: false,
  })

  useEffect(() => {
    const kin = kinRef.current
    if (activeDragDocId !== doc.id && !kin.isCoasting) {
      kin.x = doc.x
      kin.z = doc.z
      kin.targetX = doc.x
      kin.targetZ = doc.z
      kin.isExpanded = doc.isExpanded
    }
    liveDocPosMapRef.current[doc.id] = {
      x: kin.x,
      z: kin.z,
      isExpanded: doc.isExpanded,
    }
  }, [doc.id, doc.x, doc.z, doc.isExpanded, activeDragDocId, liveDocPosMapRef])

  const texture = useMemo(() => createCrispDocumentCanvasTexture(768, 1024), [])

  const stampSig = doc.stamps
    .map((s) => `${s.id}:${s.type}:${s.u.toFixed(3)}:${s.v.toFixed(3)}`)
    .join(',')
  const docSig = `${doc.id}|${doc.isExpanded}|${stampSig}`

  // Guardrail 4: Immediate CanvasTexture redraw whenever stamps or expansion change
  useEffect(() => {
    const tex = matRef.current?.map as THREE.CanvasTexture | undefined
    if (!tex) return
    const canvas = tex.image as HTMLCanvasElement
    const ctx = canvas.getContext('2d')
    if (ctx) {
      if (doc.isExpanded) {
        drawFullDirectiveSheetCanvas(ctx, canvas.width, canvas.height, doc, false)
      } else {
        drawCompactTeletypeSlipCanvas(ctx, canvas.width, canvas.height, doc)
      }
      tex.needsUpdate = true
      onDocumentMutated()
    }
  }, [doc, docSig, onDocumentMutated])

  const width = doc.isExpanded ? PAPER_EXPANDED_W_3D : PAPER_COMPACT_W_3D
  const height = doc.isExpanded ? PAPER_EXPANDED_H_3D : PAPER_COMPACT_H_3D
  const paperHex = PAPER_COLOR_HEX[doc.paperColor]

  useFrame(({ clock }, delta) => {
    const dt = Math.min(0.033, Math.max(0.001, delta))
    const nowSec = clock.getElapsedTime()
    const kin = kinRef.current
    const isDragging = activeDragDocId === doc.id

    // 4. Consume any radial stamp shockwave or mid-drag tear-off handoff impulse
    const pendingImpulse = paperImpulseMapRef.current[doc.id]
    if (pendingImpulse) {
      delete paperImpulseMapRef.current[doc.id]
      kin.vx += pendingImpulse.vx
      kin.vz += pendingImpulse.vz
      kin.angVel += pendingImpulse.angVel
      kin.hopVelY = Math.max(kin.hopVelY, pendingImpulse.hopY)
      if (pendingImpulse.liftHeight !== undefined) {
        kin.liftHeight = pendingImpulse.liftHeight
      }
      kin.isCoasting = !isDragging
      kin.wasAirborne = true
      kin.lastHitX = kin.x
      kin.lastHitZ = kin.z
      kin.lastHitTime = clock.getElapsedTime() * 1000
    }

    if (isDragging) {
      // 1. Off-Center Grab Spring-Damper Pursuit & Pendulum Rotational Torque
      const prevX = kin.x
      const prevZ = kin.z
      const springLerp = Math.min(1, dt * 26)
      kin.x = THREE.MathUtils.lerp(kin.x, kin.targetX, springLerp)
      kin.z = THREE.MathUtils.lerp(kin.z, kin.targetZ, springLerp)

      const instVx = (kin.x - prevX) / dt
      const instVz = (kin.z - prevZ) / dt
      kin.vx = THREE.MathUtils.lerp(kin.vx, instVx, 0.45)
      kin.vz = THREE.MathUtils.lerp(kin.vz, instVz, 0.45)

      // 2D Cross-product torque: grabbing off-center makes the opposite end lag & swing like a pendulum
      const crossTorque = kin.grabLocalX * kin.vz - kin.grabLocalZ * kin.vx
      const gravityPendulum = -kin.grabLocalX * 4.2 - Math.sin(kin.rotY) * 6.5
      kin.angVel += (crossTorque * 24.0 + gravityPendulum) * dt
      kin.angVel *= Math.exp(-9.5 * dt)

      // If grabbed near center, gently auto-straighten toward 0 rad
      if (kin.grabRadius < 0.085) {
        kin.rotY = THREE.MathUtils.lerp(kin.rotY, 0, Math.min(1, dt * 8.0))
      }
      kin.rotY = THREE.MathUtils.clamp(
        kin.rotY + kin.angVel * dt,
        -0.38,
        0.38
      )

      // Smoothly lift sheet to +0.035m while airborne
      kin.liftHeight = THREE.MathUtils.lerp(
        kin.liftHeight,
        0.035,
        Math.min(1, dt * 18)
      )
      kin.wasAirborne = true

      liveDocPosMapRef.current[doc.id] = {
        x: kin.x,
        z: kin.z,
        isExpanded: kin.isExpanded,
      }
      onDocumentMutated()
    } else {
      // 2. Release Inertia (Slide & Throw) + Exponential Baize Mat Friction (friction = 8.5)
      const speed = Math.hypot(kin.vx, kin.vz)
      if (speed > 0.008 || Math.abs(kin.angVel) > 0.008 || kin.isCoasting) {
        kin.x += kin.vx * dt
        kin.z += kin.vz * dt

        const frictionDecay = Math.exp(-8.5 * dt)
        kin.vx *= frictionDecay
        kin.vz *= frictionDecay

        kin.angVel *= Math.exp(-10.5 * dt)
        // Gently settle rotation slightly toward readable alignment as it slides to a stop
        kin.rotY = THREE.MathUtils.clamp(
          kin.rotY + kin.angVel * dt,
          -0.38,
          0.38
        )
        kin.rotY = THREE.MathUtils.lerp(kin.rotY, kin.rotY * 0.96, dt * 2.5)

        // Soft AABB / Hardware Boundary Repulsion (Mahogany Rim, ПРАВДА-84 Teletype, УНИЧТОЖИТЕЛЬ-84, KGB Manual)
        const halfW = width * 0.5
        const halfH = height * 0.5
        let bounced = false

        // Mahogany desk perimeter rails
        const minDeskX = -1.08 + halfW * 0.65
        const maxDeskX = 1.06 - halfW * 0.65
        const minDeskZ = -0.5 + halfH * 0.65
        const maxDeskZ = 0.52 - halfH * 0.65

        if (kin.x < minDeskX) {
          kin.x = minDeskX
          kin.vx = Math.abs(kin.vx) * 0.46
          kin.angVel += kin.vz * 1.8
          bounced = true
        } else if (kin.x > maxDeskX) {
          kin.x = maxDeskX
          kin.vx = -Math.abs(kin.vx) * 0.46
          kin.angVel -= kin.vz * 1.8
          bounced = true
        }

        if (kin.z < minDeskZ) {
          kin.z = minDeskZ
          kin.vz = Math.abs(kin.vz) * 0.46
          kin.angVel -= kin.vx * 1.8
          bounced = true
        } else if (kin.z > maxDeskZ) {
          kin.z = maxDeskZ
          kin.vz = -Math.abs(kin.vz) * 0.46
          kin.angVel += kin.vx * 1.8
          bounced = true
        }

        // ПРАВДА-84 Teletype Casing Repulsion (lower-left: x < -0.56, z > 0.10)
        if (kin.x - halfW * 0.6 < -0.56 && kin.z + halfH * 0.6 > 0.12) {
          const penX = -0.56 - (kin.x - halfW * 0.6)
          const penZ = kin.z + halfH * 0.6 - 0.12
          if (penX < penZ) {
            kin.x += penX
            kin.vx = Math.abs(kin.vx) * 0.5
            kin.angVel += 1.4
          } else {
            kin.z -= penZ
            kin.vz = -Math.abs(kin.vz) * 0.5
            kin.angVel -= 1.4
          }
          bounced = true
        }

        // KGB Security Manual Soft Edge Bump (if sliding into the heavy hardcover spine)
        const manX = manualPosRef.current.x
        const manZ = manualPosRef.current.z
        const manHalfW = MANUAL_BOUNDS_3D.width * 0.46
        const manHalfH = MANUAL_BOUNDS_3D.height * 0.46
        const dxMan = kin.x - manX
        const dzMan = kin.z - manZ
        const overlapX = manHalfW + halfW * 0.42 - Math.abs(dxMan)
        const overlapZ = manHalfH + halfH * 0.42 - Math.abs(dzMan)
        if (overlapX > 0 && overlapZ > 0 && speed > 0.22) {
          if (overlapX < overlapZ) {
            kin.x += Math.sign(dxMan || 1) * overlapX * 0.6
            kin.vx = Math.sign(dxMan || 1) * Math.abs(kin.vx) * 0.45
            kin.angVel += (dzMan > 0 ? 1 : -1) * 1.2
          } else {
            kin.z += Math.sign(dzMan || 1) * overlapZ * 0.6
            kin.vz = Math.sign(dzMan || 1) * Math.abs(kin.vz) * 0.45
            kin.angVel -= (dxMan > 0 ? 1 : -1) * 1.2
          }
          bounced = true
        }

        if (bounced && nowSec - kin.lastBumpSoundTime > 0.11) {
          kin.lastBumpSoundTime = nowSec
          playPaperSlideBump(speed)
        }

        // Check expansion threshold if paper slides across the brass printer tray divider
        const nextExpanded = kin.x > PRINTER_TRAY_BOUNDARY_X_3D
        if (nextExpanded !== kin.isExpanded) {
          kin.isExpanded = nextExpanded
          playPaperRustle(true)
          useDeskStore
            .getState()
            .updateDocumentPosition(doc.id, kin.x, kin.z, nextExpanded)
        }

        liveDocPosMapRef.current[doc.id] = {
          x: kin.x,
          z: kin.z,
          isExpanded: kin.isExpanded,
        }
        onDocumentMutated()

        // Check if coasting sheet slid directly into the Shredder or Outbox slot!
        const overShredder =
          kin.x >= SHREDDER_DROP_ZONE_3D.minX &&
          kin.x <= SHREDDER_DROP_ZONE_3D.maxX &&
          kin.z >= SHREDDER_DROP_ZONE_3D.minZ &&
          kin.z <= SHREDDER_DROP_ZONE_3D.maxZ
        const overOutbox =
          kin.x >= OUTBOX_DROP_ZONE_3D.minX &&
          kin.x <= OUTBOX_DROP_ZONE_3D.maxX &&
          kin.z >= OUTBOX_DROP_ZONE_3D.minZ &&
          kin.z <= OUTBOX_DROP_ZONE_3D.maxZ

        if (overShredder) {
          kin.vx = 0
          kin.vz = 0
          kin.isCoasting = false
          if (useDeskStore.getState().loadDocumentIntoShredder(doc.id)) {
            playPaperInsertSnap()
            onDocumentMutated()
            return
          }
        } else if (overOutbox) {
          kin.vx = 0
          kin.vz = 0
          kin.isCoasting = false
          if (useDeskStore.getState().dispatchDocumentToOutbox(doc.id)) {
            onTriggerPneumaticDispatch(paperHex)
            onDocumentMutated()
            return
          }
          playDispatchErrorBuzzer()
          kin.x = Math.max(-0.34, kin.x)
          kin.z = Math.max(0.08, kin.z)
          useDeskStore
            .getState()
            .updateDocumentPosition(doc.id, kin.x, kin.z, kin.isExpanded)
          onDocumentMutated()
          return
        }

        if (speed <= 0.012 && Math.abs(kin.angVel) <= 0.012) {
          kin.vx = 0
          kin.vz = 0
          kin.angVel = 0
          kin.isCoasting = false
          useDeskStore
            .getState()
            .updateDocumentPosition(doc.id, kin.x, kin.z, kin.isExpanded)
          onDocumentMutated()
        }
      }

      // Vertical settle & landing micro-hop physics (flattens in ~120ms with soft air-slap SFX)
      if (kin.hopVelY !== 0 || kin.liftHeight > 0.0002) {
        kin.liftHeight += kin.hopVelY * dt
        kin.hopVelY -= 1.45 * dt
        kin.liftHeight = THREE.MathUtils.lerp(
          kin.liftHeight,
          0,
          Math.min(1, dt * 22)
        )
        if (kin.liftHeight <= 0.0012) {
          if (kin.wasAirborne) {
            kin.wasAirborne = false
            // Tiny micro-hop bounce when settling onto the green felt mat
            playPaperSettleSlap(Math.min(1, 0.45 + speed * 0.5))
          }
          kin.liftHeight = 0
          kin.hopVelY = 0
        }
      }
    }

    // 3. Procedural 3D Paper Curl & Air-Drag Flex on the 16x20 Subdivided PlaneGeometry
    const geo = planeGeoRef.current
    if (geo) {
      const posAttr = geo.attributes.position as THREE.BufferAttribute
      const airFactor = THREE.MathUtils.clamp(kin.liftHeight / 0.035, 0, 1)
      if (airFactor > 0.002 || kin.verticesDeformed) {
        const halfW = Math.max(0.05, width * 0.5)
        const halfH = Math.max(0.05, height * 0.5)
        const clampedVx = THREE.MathUtils.clamp(kin.vx, -2.2, 2.2)
        const clampedVz = THREE.MathUtils.clamp(kin.vz, -2.2, 2.2)
        const speed = Math.hypot(clampedVx, clampedVz)
        const settleLerp = Math.min(1, dt * (airFactor > 0.01 ? 18 : 26))
        let maxAbsZ = 0

        for (let i = 0; i < posAttr.count; i++) {
          const x0 = posAttr.getX(i)
          const y0 = posAttr.getY(i)
          const curZ = posAttr.getZ(i)

          let targetDeflect = 0
          if (airFactor > 0.002) {
            const nx = x0 / halfW
            const ny = y0 / halfH
            const r2 = nx * nx + ny * ny

            // Center lifts slightly while outer corners droop under gravity
            const centerDome = 0.007 * (1 - r2 * 0.65)
            const cornerGravityDroop = -0.015 * (nx * nx) * (ny * ny)
            // Trailing edges curl upward under air resistance proportional to velocity
            const trailingCurlX = -nx * Math.abs(nx) * clampedVx * 0.014
            const trailingCurlZ = ny * Math.abs(ny) * clampedVz * 0.014
            const edgeFlutter =
              Math.sin(nowSec * 19.0 + nx * 2.6 + ny * 2.2) *
              speed *
              0.0022 *
              Math.min(1.2, r2)

            targetDeflect =
              airFactor *
              (centerDome +
                cornerGravityDroop +
                trailingCurlX +
                trailingCurlZ +
                edgeFlutter)
          }

          const nextVertZ = THREE.MathUtils.lerp(
            curZ,
            targetDeflect,
            settleLerp
          )
          const snappedZ =
            airFactor <= 0.002 && Math.abs(nextVertZ) < 0.00004 ? 0 : nextVertZ
          posAttr.setZ(i, snappedZ)
          if (Math.abs(snappedZ) > maxAbsZ) {
            maxAbsZ = Math.abs(snappedZ)
          }
        }

        posAttr.needsUpdate = true
        geo.computeVertexNormals()
        kin.verticesDeformed = maxAbsZ > 0.00002
      }
    }

    // 4. Dynamic Z-Stacking (+0.0025m per stacked sheet) + Soft Contact Shadow
    if (groupRef.current) {
      const y = BASE_MAT_Y + 0.0025 + stackIndex * 0.0025 + kin.liftHeight
      groupRef.current.position.set(kin.x, y, kin.z)
      groupRef.current.rotation.set(0, kin.rotY, 0)
    }
    if (shadowMatRef.current) {
      shadowMatRef.current.opacity =
        0.16 +
        Math.min(0.14, stackIndex * 0.03) +
        Math.min(0.18, kin.liftHeight * 4.2)
    }
  })

  const applyDragHit = (hit: { x: number; z: number }, nowMs: number) => {
    const kin = kinRef.current
    const dtMs = Math.max(4, nowMs - kin.lastHitTime)
    const rawVx = ((hit.x - kin.lastHitX) / dtMs) * 1000
    const rawVz = ((hit.z - kin.lastHitZ) / dtMs) * 1000
    kin.vx = THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(kin.vx, rawVx, 0.5),
      -2.6,
      2.6
    )
    kin.vz = THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(kin.vz, rawVz, 0.5),
      -2.6,
      2.6
    )
    kin.lastHitX = hit.x
    kin.lastHitZ = hit.z
    kin.lastHitTime = nowMs

    const nextX = Math.max(
      -1.08,
      Math.min(1.04, hit.x - kin.grabLocalX)
    )
    const nextZ = Math.max(
      -0.52,
      Math.min(0.52, hit.z - kin.grabLocalZ)
    )

    const nextExpanded = nextX > PRINTER_TRAY_BOUNDARY_X_3D
    if (nextExpanded !== kin.isExpanded) {
      kin.isExpanded = nextExpanded
      playPaperRustle(true)
      useDeskStore
        .getState()
        .updateDocumentPosition(doc.id, nextX, nextZ, nextExpanded)
    }
    kin.targetX = nextX
    kin.targetZ = nextZ
    liveDocPosMapRef.current[doc.id] = {
      x: kin.x,
      z: kin.z,
      isExpanded: kin.isExpanded,
    }
    onDocumentMutated()
  }

  const finalizeDragRelease = (nowMs: number) => {
    setActiveDragDocId(null)

    const kin = kinRef.current
    const idleMs = nowMs - kin.lastHitTime
    if (idleMs > 75) {
      kin.vx *= 0.2
      kin.vz *= 0.2
    } else {
      kin.vx = THREE.MathUtils.clamp(kin.vx * 0.72, -1.85, 1.85)
      kin.vz = THREE.MathUtils.clamp(kin.vz * 0.72, -1.85, 1.85)
    }

    const finalX = kin.x
    const finalZ = kin.z
    const store = useDeskStore.getState()

    const overShredder =
      finalX >= SHREDDER_DROP_ZONE_3D.minX &&
      finalX <= SHREDDER_DROP_ZONE_3D.maxX &&
      finalZ >= SHREDDER_DROP_ZONE_3D.minZ &&
      finalZ <= SHREDDER_DROP_ZONE_3D.maxZ

    const overOutbox =
      finalX >= OUTBOX_DROP_ZONE_3D.minX &&
      finalX <= OUTBOX_DROP_ZONE_3D.maxX &&
      finalZ >= OUTBOX_DROP_ZONE_3D.minZ &&
      finalZ <= OUTBOX_DROP_ZONE_3D.maxZ

    if (overShredder) {
      kin.vx = 0
      kin.vz = 0
      kin.isCoasting = false
      if (store.loadDocumentIntoShredder(doc.id)) {
        playPaperInsertSnap()
        onDocumentMutated()
        return
      }
    } else if (overOutbox) {
      kin.vx = 0
      kin.vz = 0
      kin.isCoasting = false
      if (store.dispatchDocumentToOutbox(doc.id)) {
        onTriggerPneumaticDispatch(paperHex)
        onDocumentMutated()
        return
      }
      playDispatchErrorBuzzer()
      const bounceX = Math.max(-0.34, finalX)
      const bounceZ = Math.max(0.08, finalZ)
      kin.x = bounceX
      kin.z = bounceZ
      store.updateDocumentPosition(doc.id, bounceX, bounceZ, kin.isExpanded)
      onDocumentMutated()
      return
    }

    kin.isCoasting = Math.hypot(kin.vx, kin.vz) > 0.02
    kin.hopVelY = 0.08
    store.updateDocumentPosition(doc.id, finalX, finalZ, kin.isExpanded)
    onDocumentMutated()
  }

  useEffect(() => {
    const handlers = sharedDragHandlersRef.current
    handlers[doc.id] = {
      move: applyDragHit,
      up: finalizeDragRelease,
    }
    return () => {
      delete handlers[doc.id]
    }
  })

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return
    e.stopPropagation()
    const nativeTarget = e.nativeEvent.target as Element & {
      setPointerCapture?: (id: number) => void
    }
    nativeTarget?.setPointerCapture?.(e.pointerId)

    useDeskStore.getState().bringToFront(doc.id)
    setActiveDragDocId(doc.id)
    playPaperRustle(false)

    const kin = kinRef.current
    kin.isCoasting = false
    const hit = getDeskLocalHitFromEvent(e, deskGroupRef.current)
    if (hit) {
      kin.grabLocalX = hit.x - kin.x
      kin.grabLocalZ = hit.z - kin.z
      kin.grabRadius = Math.hypot(kin.grabLocalX, kin.grabLocalZ)
      kin.targetX = kin.x
      kin.targetZ = kin.z
      kin.lastHitX = hit.x
      kin.lastHitZ = hit.z
      kin.lastHitTime = e.nativeEvent.timeStamp
    }
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (activeDragDocId !== doc.id) return
    e.stopPropagation()
    const hit = getDeskLocalHitFromEvent(e, deskGroupRef.current)
    if (!hit) return
    applyDragHit(hit, e.nativeEvent.timeStamp)
  }

  const commitDragEnd = (e: ThreeEvent<PointerEvent>) => {
    if (activeDragDocId !== doc.id) return
    e.stopPropagation()
    finalizeDragRelease(e.nativeEvent.timeStamp)
  }

  if (doc.status !== 'desk') {
    return null
  }

  return (
    <group
      ref={groupRef}
      position={[
        doc.x,
        BASE_MAT_Y + 0.0025 + stackIndex * 0.0025,
        doc.z,
      ]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={commitDragEnd}
      onPointerCancel={commitDragEnd}
    >
      {/* Soft Contact-Shadow Mesh Underneath Each Stacked / Lifted Sheet */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0.004, -0.0018, 0.005]}
      >
        <planeGeometry args={[width + 0.008, height + 0.008]} />
        <meshBasicMaterial
          ref={shadowMatRef}
          color="#070c0a"
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>

      {/* 16x20 Subdivided 3D Aero-Bending Paper Mesh */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.0005, 0]}
        castShadow
        receiveShadow
      >
        <planeGeometry ref={planeGeoRef} args={[width, height, 16, 20]} />
        <meshStandardMaterial
          ref={matRef}
          color={paperHex}
          map={texture}
          roughness={0.88}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1 - stackIndex}
          polygonOffsetUnits={-1}
        />
      </mesh>
    </group>
  )
}

export function InspectorDesk3D() {
  const deskGroupRef = useRef<THREE.Group | null>(null)
  const liveDocPosMapRef = useRef<
    Record<string, { x: number; z: number; isExpanded: boolean }>
  >({})
  const paperImpulseMapRef = useRef<Record<string, PaperShockwaveImpulse>>({})
  const sharedDragHandlersRef = useRef<Record<string, SharedPaperDragHandler>>(
    {}
  )

  const documents = useDeskStore((s) => s.documents)
  const printingDoc = useDeskStore((s) => s.printingDoc)
  const commendations = useDeskStore((s) => s.commendations)
  const citations = useDeskStore((s) => s.citations)
  const lastVerdict = useDeskStore((s) => s.lastVerdict)
  const capsuleState = useDeskStore((s) => s.capsuleState)
  const hatchOpen = useDeskStore((s) => s.hatchOpen)
  const packedDoc = useDeskStore((s) => s.packedDoc)
  const isMusicMuted = useGameStore((s) => s.isMusicMuted)

  const [activeDragDocId, setActiveDragDocId] = useState<string | null>(null)
  const [isTearingSlip, setIsTearingSlip] = useState<boolean>(false)
  const lensDirtyRef = useRef<boolean>(true)
  const markLensDirty = () => {
    lensDirtyRef.current = true
  }

  // Desk shockwave coupling for Komrad Kristianov & Komrad Oleg bobbleheads
  const bobbleShockwaveRef = useRef<{ kristianov: number; oleg: number }>({
    kristianov: 0,
    oleg: 0,
  })
  const triggerBobbleShockwave = (intensity = 1.0) => {
    bobbleShockwaveRef.current.kristianov = Math.max(
      bobbleShockwaveRef.current.kristianov,
      intensity
    )
    bobbleShockwaveRef.current.oleg = Math.max(
      bobbleShockwaveRef.current.oleg,
      intensity
    )
  }

  // Hotkey [M]: Mute/Unmute all game audio (Music + Web Audio SFX)
  useEffect(() => {
    installGlobalMuteController()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'KeyM' || e.key.toLowerCase() === 'm') {
        useGameStore.getState().toggleMusicMute()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 1. ПРАВДА-84 Automatic 12-Step Wire Receiver & Physical Pull-Tension Tear State
  const [printStep, setPrintStep] = useState<number>(0)
  const printStepRef = useRef<number>(0)
  const [printerReceiving, setPrinterReceiving] = useState<boolean>(false)
  const printerGroupRef = useRef<THREE.Group | null>(null)
  const printingStripGeoRef = useRef<THREE.PlaneGeometry | null>(null)
  const printingBackingGeoRef = useRef<THREE.PlaneGeometry | null>(null)
  const printerRecoilRef = useRef<number>(0)
  const slipGrabRef = useRef<{
    dragging: boolean
    startX: number
    startZ: number
    curX: number
    curZ: number
    pullDeltaX: number
    pullDeltaZ: number
    tension: number
    lastX: number
    lastZ: number
    lastTime: number
    vx: number
    vz: number
    torn: boolean
  }>({
    dragging: false,
    startX: PRINTER_SLOT_X_3D,
    startZ: 0.22,
    curX: PRINTER_SLOT_X_3D,
    curZ: 0.22,
    pullDeltaX: 0,
    pullDeltaZ: 0,
    tension: 0,
    lastX: PRINTER_SLOT_X_3D,
    lastZ: 0.22,
    lastTime: 0,
    vx: 0,
    vz: 0,
    torn: false,
  })

  useEffect(() => {
    const timer = window.setInterval(() => {
      const gamePhase = useGameStore.getState().phase
      if (gamePhase !== 'playing') return
      useDeskStore.getState().tickPrinterQueue(0.25)
    }, 250)
    return () => window.clearInterval(timer)
  }, [])

  const printingDocId = printingDoc?.id ?? null

  useEffect(() => {
    printStepRef.current = 0
    slipGrabRef.current.dragging = false
    slipGrabRef.current.pullDeltaX = 0
    slipGrabRef.current.pullDeltaZ = 0
    slipGrabRef.current.tension = 0
    slipGrabRef.current.torn = false

    if (!printingDocId) {
      const stopId = window.setTimeout(() => {
        setPrintStep(0)
        setPrinterReceiving(false)
      }, 0)
      return () => window.clearTimeout(stopId)
    }

    const startId = window.setTimeout(() => {
      setPrintStep(0)
      setPrinterReceiving(true)
    }, 0)
    const timer = window.setInterval(() => {
      const nextStep = printStepRef.current + 1
      if (nextStep > PRINTER_FEED_STEPS) {
        window.clearInterval(timer)
        setPrinterReceiving(false)
        return
      }
      printStepRef.current = nextStep
      setPrintStep(nextStep)
      playLineFeedTick(nextStep)
      setPrinterReceiving(nextStep % 2 === 1)
      if (nextStep === PRINTER_FEED_STEPS) {
        playCarriageReturnDing()
        window.setTimeout(() => setPrinterReceiving(false), 160)
      }
    }, PRINTER_FEED_STEP_MS)

    return () => {
      window.clearTimeout(startId)
      window.clearInterval(timer)
    }
  }, [printingDocId])

  // 2. ЭЛЕКТРОНИКА «МЫ-ПАД 84» (WE-PAD 84) Retro-Atompunk Soviet Tablet State
  const manualPage = useGameStore((s) => s.wePadActiveTab)
  const isManualHeld = useGameStore((s) => s.wePadHeld)
  const isManualInspecting = useGameStore((s) => s.wePadInspecting)
  const wePadChatLen = useGameStore((s) => s.wePadChatLog.length)
  const [manualScrollY, setManualScrollY] = useState<number>(0)
  const isManualHeldRef = useRef<boolean>(isManualHeld)
  const isManualInspectingRef = useRef<boolean>(isManualInspecting)
  const manualHoldBlendRef = useRef<number>(0)
  const manualInspectBlendRef = useRef<number>(0)
  const lastWePadChatLenRef = useRef<number>(wePadChatLen)
  const manualGroupRef = useRef<THREE.Group | null>(null)
  const manualPosRef = useRef<{
    x: number
    z: number
    pointerDown: boolean
    pointerId: number | null
    downClientX: number
    downClientY: number
    downTimeMs: number
    dragging: boolean
    suppressNextClick: boolean
    dx: number
    dz: number
  }>({
    x: MANUAL_BOUNDS_3D.x,
    z: MANUAL_BOUNDS_3D.z,
    pointerDown: false,
    pointerId: null,
    downClientX: 0,
    downClientY: 0,
    downTimeMs: 0,
    dragging: false,
    suppressNextClick: false,
    dx: 0,
    dz: 0,
  })

  useEffect(() => {
    isManualHeldRef.current = isManualHeld
    isManualInspectingRef.current = isManualInspecting
    lensDirtyRef.current = true
  }, [isManualHeld, isManualInspecting])

  // Play telegraph "bip-bip" when a new message is appended to WE-PAD 84's Volkov Chat Log
  useEffect(() => {
    if (wePadChatLen > lastWePadChatLenRef.current) {
      playLineFeedTick(1)
      const tid = window.setTimeout(() => playLineFeedTick(2), 85)
      lastWePadChatLenRef.current = wePadChatLen
      return () => window.clearTimeout(tid)
    }
    lastWePadChatLenRef.current = wePadChatLen
  }, [wePadChatLen])

  const setManualPage = (
    next: WePadTabId | ((prev: WePadTabId) => WePadTabId)
  ) => {
    const cur = useGameStore.getState().wePadActiveTab
    const resolved = typeof next === 'function' ? next(cur) : next
    const clamped = Math.max(1, Math.min(6, resolved)) as WePadTabId
    useGameStore.getState().setWePadActiveTab(clamped)
  }

  const shiftRunId = useGameStore((s) => s.shiftRunId)
  useEffect(() => {
    manualPosRef.current.x = MANUAL_BOUNDS_3D.x
    manualPosRef.current.z = MANUAL_BOUNDS_3D.z
    manualPosRef.current.pointerDown = false
    manualPosRef.current.pointerId = null
    manualPosRef.current.dragging = false
    manualPosRef.current.suppressNextClick = false
    isManualHeldRef.current = false
    isManualInspectingRef.current = false
    queueMicrotask(() => setManualScrollY(0))
    lensDirtyRef.current = true
  }, [shiftRunId])

  const toggleManualHeld = () => {
    manualPosRef.current.dragging = false
    useGameStore.getState().toggleWePadHeld()
    playSwitchClank(true)
    playLineFeedTick(1)
    lensDirtyRef.current = true
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      const target = e.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName.toLowerCase()
        if (
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          target.isContentEditable
        ) {
          return
        }
      }

      // [E] (or [B]): Pick up WE-PAD 84 from desk OR put it back down on desk
      if (
        e.code === 'KeyE' ||
        e.key === 'e' ||
        e.key === 'E' ||
        e.code === 'KeyB' ||
        e.key === 'b' ||
        e.key === 'B'
      ) {
        e.preventDefault()
        manualPosRef.current.dragging = false
        useGameStore.getState().toggleWePadHeld()
        playSwitchClank(true)
        playLineFeedTick(1)
        lensDirtyRef.current = true
        return
      }

      // [TAB]: Toggle Compact Side-Mode vs Close-Inspection Mode ONLY when WE-PAD 84 is held in hand!
      if (e.code === 'Tab' || e.key === 'Tab') {
        e.preventDefault()
        const gs = useGameStore.getState()
        if (gs.wePadHeld) {
          gs.toggleWePadInspecting()
          playDetentClick(1)
          lensDirtyRef.current = true
        }
        return
      }

      // When WE-PAD 84 is held in Close-Inspection mode ([TAB]), keys [1-6] and ArrowLeft/ArrowRight switch tabs!
      const gs = useGameStore.getState()
      if (gs.wePadHeld) {
        if (gs.wePadInspecting && e.code.startsWith('Digit')) {
          const num = parseInt(e.code.replace('Digit', ''), 10)
          if (num >= 1 && num <= 6) {
            e.preventDefault()
            playPageTurnSound()
            gs.setWePadActiveTab(num as WePadTabId)
            setManualScrollY(0)
            return
          }
        }
        if (e.code === 'ArrowLeft') {
          e.preventDefault()
          playPageTurnSound()
          const prev = gs.wePadActiveTab === 1 ? 6 : ((gs.wePadActiveTab - 1) as WePadTabId)
          gs.setWePadActiveTab(prev)
          setManualScrollY(0)
          return
        }
        if (e.code === 'ArrowRight') {
          e.preventDefault()
          playPageTurnSound()
          const next = gs.wePadActiveTab === 6 ? 1 : ((gs.wePadActiveTab + 1) as WePadTabId)
          gs.setWePadActiveTab(next)
          setManualScrollY(0)
          return
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 3. Draggable 2x Straight Optical Magnifying Glass State
  const magnifierGroupRef = useRef<THREE.Group | null>(null)
  const lensPosRef = useRef<{ x: number; z: number; dragging: boolean }>({
    x: -0.15,
    z: 0.38,
    dragging: false,
  })
  const lensDragOffsetRef = useRef<{ dx: number; dz: number }>({ dx: 0, dz: 0 })

  // 4. Draggable 3D Wooden Rubber Stamps (`ОДОБРЕНО` & `УНИЧТОЖЕНО`) with Unified Whole-Stamp Hitbox
  const approveStampGroupRef = useRef<THREE.Group | null>(null)
  const shredStampGroupRef = useRef<THREE.Group | null>(null)
  const approvePlungerRef = useRef<THREE.Group | null>(null)
  const shredPlungerRef = useRef<THREE.Group | null>(null)

  const stampStateRef = useRef<
    Record<
      StampType,
      {
        homeX: number
        homeZ: number
        targetX: number
        targetZ: number
        x: number
        z: number
        pointerDown: boolean
        pointerId: number | null
        downClientX: number
        downClientY: number
        downTimeMs: number
        holdElapsedMs: number
        draggingBody: boolean
        dx: number
        dz: number
        plungerStep: number
      }
    >
  >({
    APPROVED: {
      homeX: 0.22,
      homeZ: -0.22,
      targetX: 0.22,
      targetZ: -0.22,
      x: 0.22,
      z: -0.22,
      pointerDown: false,
      pointerId: null,
      downClientX: 0,
      downClientY: 0,
      downTimeMs: 0,
      holdElapsedMs: 0,
      draggingBody: false,
      dx: 0,
      dz: 0,
      plungerStep: 0,
    },
    SHREDDED: {
      homeX: 0.38,
      homeZ: -0.22,
      targetX: 0.38,
      targetZ: -0.22,
      x: 0.38,
      z: -0.22,
      pointerDown: false,
      pointerId: null,
      downClientX: 0,
      downClientY: 0,
      downTimeMs: 0,
      holdElapsedMs: 0,
      draggingBody: false,
      dx: 0,
      dz: 0,
      plungerStep: 0,
    },
  })

  // 5. 5-Detent УНИЧТОЖИТЕЛЬ-84 Document Shredder State
  const shredLeverKnobRef = useRef<THREE.Group | null>(null)
  const shredDragRef = useRef<{
    dragging: boolean
    startY: number
    previousStep: number
    jitterIndex: number
  }>({
    dragging: false,
    startY: 0,
    previousStep: 0,
    jitterIndex: 0,
  })
  const [shredJitterX, setShredJitterX] = useState<number>(0)
  const [fallingStrips, setFallingStrips] = useState<{
    paperHex: string
    inkHex: string
  } | null>(null)

  // Load High-Detail Multi-Part Soviet `.glb` Hardware Models from `public/models/`
  const teletypeGltf = useGLTF('./models/pravda_teletype.glb')
  const shredderGltf = useGLTF('./models/soviet_shredder.glb')
  const deskPropsGltf = useGLTF('./models/desk_props.glb')

  const ironTex = useMemo(() => getHammeredIronTextures(), [])
  const brassTex = useMemo(() => getBrushedBrassTextures(), [])
  const wornMatTex = useMemo(() => getWornInspectionMatTextures(), [])
  const mahoganyTex = useMemo(() => getWeatheredMahoganyTextures(), [])

  const bankersLampSpotRef = useRef<THREE.SpotLight | null>(null)
  const bankersLampTargetRef = useRef<THREE.Object3D | null>(null)
  const manometerNeedleRef = useRef<THREE.Group | null>(null)
  const lastStripDeformSigRef = useRef<string>('')
  const lastLensDrawTimeRef = useRef<number>(0)

  const teletypeModel = useMemo(() => {
    const cloned = teletypeGltf.scene.clone(true)
    applySovietPBRToHierarchy(cloned)
    return cloned
  }, [teletypeGltf.scene])

  const shredderModel = useMemo(() => {
    const cloned = shredderGltf.scene.clone(true)
    applySovietPBRToHierarchy(cloned)
    return cloned
  }, [shredderGltf.scene])

  const deskPropNodes = useMemo(() => {
    const getCloned = (name: string) => {
      const node = deskPropsGltf.scene.getObjectByName(name)?.clone(true) ?? null
      applySovietPBRToHierarchy(node)
      return node
    }
    return {
      bankersLamp: getCloned('bankers_lamp'),
      pneumaticTube: getCloned('pneumatic_tube'),
      inkPadApprove: getCloned('ink_pad_tin'),
      inkPadShred: getCloned('ink_pad_tin'),
      stampBodyApprove: getCloned('stamp_body'),
      stampBodyShred: getCloned('stamp_body'),
      stampPlungerApprove: getCloned('stamp_plunger'),
      stampPlungerShred: getCloned('stamp_plunger'),
      magnifierFrame: getCloned('magnifier_frame'),
    }
  }, [deskPropsGltf.scene])

  useEffect(() => {
    applySovietPBRToHierarchy(deskGroupRef.current)
    if (bankersLampSpotRef.current && bankersLampTargetRef.current) {
      bankersLampSpotRef.current.target = bankersLampTargetRef.current
      bankersLampTargetRef.current.updateMatrixWorld()
    }
  }, [])

  // 3 Heavy Ribbed Rubber/Braided Power Cables + Pneumatic Capillary Tube (`<tubeGeometry>` along `CatmullRomCurve3`)
  // All desk cable control points are clamped flush to the desk surface (`SHELF_TOP_Y + 0.006`) so they rest flat against the wood/mat.
  const deskCableGeometries = useMemo(() => {
    const SHELF_TOP_Y = BASE_MAT_Y
    const cableY = SHELF_TOP_Y + 0.006
    const teletypeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.84, cableY, 0.18),
      new THREE.Vector3(-0.85, cableY, 0.13),
      new THREE.Vector3(-0.86, cableY, 0.08),
    ])
    const lampCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.98, cableY, -0.48),
      new THREE.Vector3(-0.98, cableY, -0.515),
      new THREE.Vector3(-0.98, cableY, -0.55),
    ])
    const shredderCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.82, cableY, -0.32),
      new THREE.Vector3(0.86, cableY, -0.38),
      new THREE.Vector3(0.9, cableY, -0.44),
    ])
    const manometerCapillaryCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.31, 0.012, 0.01),
      new THREE.Vector3(-0.35, 0.012, 0.016),
      new THREE.Vector3(-0.39, 0.012, 0.02),
    ])
    return {
      teletypeCable: new THREE.TubeGeometry(teletypeCurve, 16, 0.007, 8, false),
      lampCable: new THREE.TubeGeometry(lampCurve, 12, 0.006, 8, false),
      shredderCable: new THREE.TubeGeometry(shredderCurve, 16, 0.007, 8, false),
      manometerCapillary: new THREE.TubeGeometry(
        manometerCapillaryCurve,
        12,
        0.005,
        8,
        false
      ),
    }
  }, [])

  // 4 Glowing Orange ИН-14 Nixie Tube Filament Digit Textures ("1", "9", "8", "4")
  const nixieDigitTextures = useMemo(() => {
    return ['8', '4', '№', '4'].map((digit) =>
      createNearestCanvasTexture(64, 96, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h)
        // Fine dark cathode mesh grid lines
        ctx.strokeStyle = 'rgba(255, 120, 20, 0.22)'
        ctx.lineWidth = 1
        for (let y = 6; y < h - 6; y += 6) {
          ctx.beginPath()
          ctx.moveTo(6, y)
          ctx.lineTo(w - 6, y)
          ctx.stroke()
        }
        // Bright neon-orange Nixie discharge glow
        ctx.fillStyle = '#ff5500'
        ctx.font = 'bold 64px "VT323", monospace'
        ctx.textAlign = 'center'
        ctx.fillText(digit, w / 2 + 1, 70)
        ctx.fillStyle = '#ffae42'
        ctx.font = 'bold 60px "VT323", monospace'
        ctx.fillText(digit, w / 2, 69)
      })
    )
  }, [])

  // Mini Vacuum Manometer Dial Texture (`ВАКУУМ // КГС/СМ²`) for `ИСХОДЯЩИЕ` Pneumatic Tube
  const manometerDialTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 128, (ctx, w, h) => {
        const cx = w / 2
        const cy = h / 2
        ctx.fillStyle = '#e6dec3'
        ctx.beginPath()
        ctx.arc(cx, cy, 56, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#141414'
        ctx.lineWidth = 5
        ctx.stroke()

        // Red vacuum danger arc
        ctx.strokeStyle = '#ff2a2a'
        ctx.lineWidth = 6
        ctx.beginPath()
        ctx.arc(cx, cy, 44, Math.PI * 1.65, Math.PI * 2.2)
        ctx.stroke()

        for (let i = 0; i <= 10; i++) {
          const ang = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5
          const r1 = i % 2 === 0 ? 34 : 40
          const r2 = 49
          ctx.strokeStyle = i >= 7 ? '#ff2a2a' : '#141414'
          ctx.lineWidth = i % 2 === 0 ? 3 : 2
          ctx.beginPath()
          ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1)
          ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2)
          ctx.stroke()
        }

        ctx.fillStyle = '#141414'
        ctx.font = 'bold 13px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText('ВАКУУМ', cx, 44)
        ctx.fillStyle = '#8b1e1e'
        ctx.font = 'bold 14px "VT323", monospace'
        ctx.fillText('КГС/СМ²', cx, 94)
      }),
    []
  )

  // Dynamic CanvasTextures (`THREE.NearestFilter`)
  const headerTickerMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const printingSlipMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const loadedSlipMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const manualMatRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const lensMatRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const shredPlateMatRef = useRef<THREE.MeshStandardMaterial | null>(null)

  const headerTickerTex = useMemo(
    () => createNearestCanvasTexture(1024, 96),
    []
  )
  const printingSlipTex = useMemo(
    () => createNearestCanvasTexture(256, 320),
    []
  )
  const loadedSlipTex = useMemo(() => createNearestCanvasTexture(256, 320), [])
  const manualTex = useMemo(
    () => createCrispDocumentCanvasTexture(1024, 1280),
    []
  )
  const lensTex = useMemo(() => createCrispDocumentCanvasTexture(512, 512), [])
  const shredPlateTex = useMemo(() => createNearestCanvasTexture(256, 96), [])

  const buildWePadPayload = (gs = useGameStore.getState()): WePadTelemetryPayload => {
    const gridConn = Boolean(gs.turbines[0]?.gridConnected)
    const totQuota = Object.values(gs.targetSectorMW).reduce((a, b) => a + b, 0)
    const houseMW = Math.round(gs.houseLoadMW)
    return {
      activeTab: gs.wePadActiveTab,
      wePadHeld: gs.wePadHeld,
      wePadInspecting: gs.wePadInspecting,
      tutorialPhase: gs.tutorialPhase,
      tutorialHeader: gs.tutorialPrompt.header,
      tutorialBody: gs.tutorialPrompt.body,
      tutorialHint: gs.tutorialPrompt.hint,
      tutorialPanelKey: gs.tutorialPrompt.panelKey,
      tutorialActionLine: gs.tutorialPrompt.actionLine,
      tutorialWhyLines: gs.tutorialPrompt.whyLines,
      tutorialVolkovQuote: gs.tutorialPrompt.volkovQuote,
      chatLog: gs.wePadChatLog,
      thermalPower: gs.thermalPower,
      drumPressure: gs.drumPressure,
      drumWaterLevel: gs.drumWaterLevel,
      coreTemp: gs.coreTemp,
      controlRods: gs.controlRods,
      reactivity: gs.reactivity,
      xenonPoisoning: gs.xenon,
      voidFraction: gs.voidFraction * 100,
      rpm: gs.turbines[0].rpm,
      gridHz: gs.turbines[0].freqHz,
      syncPhase: gs.turbines[0].syncPhase,
      gridConnected: gridConn,
      turbineValve: gs.turbines[0].valve,
      totalElectricalMW: gs.totalElectricalMW,
      neededMWe: totQuota + houseMW,
      generatedMWe: gridConn ? gs.totalElectricalMW + houseMW : 0,
      houseLoadMW: houseMW,
      plantWaterDrainPct: gs.plantWaterDrainPct,
      mcpActiveCount: gs.mcpActive.filter(Boolean).length,
    }
  }

  // Guardrail 4: Immediate WE-PAD 84 Texture & Lens Refresh when tab, scroll, chat or handheld state changes
  const lastWePadSigRef = useRef<string>('')
  useEffect(() => {
    lastWePadSigRef.current = ''
    lensDirtyRef.current = true
  }, [manualPage, manualScrollY, isManualHeld, isManualInspecting, wePadChatLen])

  // Static 16-Color Bayer-Dithered Hardware Plaques (Dither metal background first, then render crisp un-dithered text)
  const printerNameplateTex = useMemo(
    () =>
      createNearestCanvasTexture(256, 64, (ctx, w, h) => {
        ctx.fillStyle = '#2a362b'
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#b8a46b'
        ctx.lineWidth = 4
        ctx.strokeRect(4, 4, w - 8, h - 8)
        apply16ColorBayerDither(ctx, w, h, 14)

        ctx.fillStyle = '#cfc6b0'
        ctx.font = 'bold 22px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText('ПРАВДА-84 // ТЕЛЕТАЙП', w / 2, 28)
        ctx.fillStyle = '#b8a46b'
        ctx.font = 'bold 16px "VT323", monospace'
        ctx.fillText('АВТОМАТИЧЕСКИЙ ПРИЕМНИК', w / 2, 50)
      }),
    []
  )

  const outboxTubeTex = useMemo(
    () =>
      createNearestCanvasTexture(384, 96, (ctx, w, h) => {
        ctx.fillStyle = '#18211b'
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#b8a46b'
        ctx.lineWidth = 4
        ctx.strokeRect(4, 4, w - 8, h - 8)
        ctx.fillStyle = '#0d110f'
        ctx.fillRect(14, 12, w - 28, 30)
        ctx.strokeStyle = '#8c7a4b'
        ctx.lineWidth = 2
        ctx.strokeRect(14, 12, w - 28, 30)
        apply16ColorBayerDither(ctx, w, h, 14)

        ctx.fillStyle = '#33ff66'
        ctx.font = 'bold 17px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText('ПНЕВМОПОЧТА // КАМЕРА ПУСКА', w / 2, 33)
        ctx.fillStyle = '#cfc6b0'
        ctx.font = 'bold 13px "Courier Prime", monospace'
        ctx.fillText('2. OPEN HATCH -> 3. LOAD -> 4. SEAL HATCH', w / 2, 62)
        ctx.fillStyle = '#ffb000'
        ctx.font = 'bold 15px "VT323", monospace'
        ctx.fillText('▼ 5. PULL DOWN RED LEVER [ПУСК] TO DISPATCH ▼', w / 2, 83)
      }),
    []
  )

  const capsuleCradlePlaqueTex = useMemo(
    () =>
      createNearestCanvasTexture(320, 72, (ctx, w, h) => {
        ctx.fillStyle = '#18211b'
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#b8a46b'
        ctx.lineWidth = 4
        ctx.strokeRect(3, 3, w - 6, h - 6)
        apply16ColorBayerDither(ctx, w, h, 14)

        ctx.fillStyle = '#33ff66'
        ctx.font = 'bold 15px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText('КАПСУЛА // STEP 1: PACK PAPER', w / 2, 26)
        ctx.fillStyle = '#e8dec3'
        ctx.font = 'bold 13px "Courier Prime", monospace'
        ctx.fillText('DRAG [ОДОБРЕНО] OR CLICK CYLINDER', w / 2, 46)
        ctx.fillStyle = '#ffb000'
        ctx.font = 'bold 14px "VT323", monospace'
        ctx.fillText('THEN LOAD INTO OPEN BREECH CHAMBER', w / 2, 64)
      }),
    []
  )

  const pneumaticFlightCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(-1.468, 1.07, -0.544),
          new THREE.Vector3(-1.468, 1.85, -0.544),
          new THREE.Vector3(-1.468, 2.65, -0.544),
          new THREE.Vector3(-1.468, 3.12, -0.544),
          new THREE.Vector3(-1.468, 3.26, -0.684),
          new THREE.Vector3(-1.468, 3.26, -1.54),
          new THREE.Vector3(-1.21, 3.26, -1.68),
          new THREE.Vector3(-0.95, 3.12, -1.68),
          new THREE.Vector3(-0.95, 2.35, -1.68),
          new THREE.Vector3(-0.95, 1.72, -1.68),
        ],
        false,
        'catmullrom',
        0.35
      ),
    []
  )

  const approveBadgeTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 40, (ctx, w, h) => {
        ctx.fillStyle = '#18211b'
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#33ff66'
        ctx.lineWidth = 3
        ctx.strokeRect(2, 2, w - 4, h - 4)
        ctx.fillStyle = '#33ff66'
        ctx.font = 'bold 16px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText('ОДОБРЕНО', w / 2, 26)
      }),
    []
  )

  // 3D Illuminated 6-Lamp Master Annunciator Strip (`ТАБЛО ТРЕВОГИ`) Textures & Refs
  const annunciatorTileSpecs = useMemo(() => {
    const specs = [
      { id: 'core', title: '[CORE TEMP]', sub: 'ЯДРО >520/680°C' },
      { id: 'water', title: '[WATER DROUGHT]', sub: 'ВОДА <45%/СУХО' },
      { id: 'gas_oil', title: '[GAS / OIL SAT]', sub: 'ГАЗ>58 / МАСЛО<40' },
      { id: 'bearing', title: '[PUMP BEARING]', sub: 'НАСОС >75/90°C' },
      { id: 'grid', title: '[50HZ GRID]', sub: 'СЕТЬ ±0.8/1.5 ГЦ' },
      { id: 'order', title: '[INCOMING ORDER]', sub: 'ПРИКАЗ ПРАВДА-84' },
    ]
    return specs.map((item) => ({
      ...item,
      texture: createNearestCanvasTexture(192, 88, (ctx, w, h) => {
        ctx.fillStyle = '#141a17'
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#d4be7f'
        ctx.lineWidth = 4
        ctx.strokeRect(3, 3, w - 6, h - 6)
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 18px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText(item.title, w / 2, 36)
        ctx.fillStyle = '#d8e6dc'
        ctx.font = 'bold 16px "VT323", monospace'
        ctx.fillText(item.sub, w / 2, 66)
      }),
    }))
  }, [])

  const annunciatorMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>(
    []
  )
  const prevAnnunciatorLevelsRef = useRef<number[]>([0, 0, 0, 0, 0, 0])
  const lastKlaxonPulseTimeRef = useRef<number>(0)
  const lastInspectingStateRef = useRef<boolean>(false)

  const shredBadgeTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 40, (ctx, w, h) => {
        ctx.fillStyle = '#2b1a12'
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#ff2a2a'
        ctx.lineWidth = 3
        ctx.strokeRect(2, 2, w - 4, h - 4)
        ctx.fillStyle = '#ff2a2a'
        ctx.font = 'bold 16px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText('УНИЧТОЖЕНО', w / 2, 26)
      }),
    []
  )

  const hazardChevronTex = useMemo(
    () =>
      createNearestCanvasTexture(192, 36, (ctx, w, h) => {
        drawHazardChevronCanvas(ctx, w, h)
      }),
    []
  )

  const serialPlateTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 36, (ctx, w, h) => {
        ctx.fillStyle = '#8c7a4b'
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#0d110f'
        ctx.lineWidth = 3
        ctx.strokeRect(2, 2, w - 4, h - 4)
        ctx.fillStyle = '#0d110f'
        ctx.font = 'bold 13px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText('ЗАВОД №4 // 84', w / 2, 22)
      }),
    []
  )

  const folderCrestTex = useMemo(
    () =>
      createNearestCanvasTexture(384, 44, (ctx, w, h) => {
        ctx.fillStyle = '#1e221d'
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#8c7a4b'
        ctx.lineWidth = 3
        ctx.strokeRect(2, 2, w - 4, h - 4)
        // Corner rivets on metal nameplate
        ctx.fillStyle = '#c8b06b'
        for (const [rx, ry] of [
          [10, 10],
          [w - 10, 10],
          [10, h - 10],
          [w - 10, h - 10],
        ]) {
          ctx.beginPath()
          ctx.arc(rx, ry, 3.2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = '#e6dec3'
        ctx.font = 'bold 17px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText('ЭЛЕКТРОНИКА МЫ-ПАД 84', w / 2, 28)
      }),
    []
  )

  const loadedDoc = useMemo(
    () => documents.find((d) => d.status === 'loaded_in_shredder') ?? null,
    [documents]
  )

  const hasApprovedDocOnDesk = useMemo(
    () =>
      documents.some(
        (d) =>
          d.status === 'desk' && d.stamps.some((s) => s.type === 'APPROVED')
      ),
    [documents]
  )

  // Pneumatic Capsule Dispatch Station Refs & Multi-Step Animation State (`ПНЕВМОПОЧТА // КАПСУЛА + ЛЮК + РЫЧАГ ПУСКА`)
  const cradleCapsuleGroupRef = useRef<THREE.Group | null>(null)
  const cradleTopCapRef = useRef<THREE.Group | null>(null)
  const cradleScrollRef = useRef<THREE.Group | null>(null)
  const cradlePaperMatRef = useRef<THREE.MeshStandardMaterial | null>(null)

  const chamberCapsuleGroupRef = useRef<THREE.Group | null>(null)
  const chamberPaperMatRef = useRef<THREE.MeshStandardMaterial | null>(null)

  const flightCapsuleGroupRef = useRef<THREE.Group | null>(null)
  const flightPaperMatRef = useRef<THREE.MeshStandardMaterial | null>(null)

  const breechDoorGroupRef = useRef<THREE.Group | null>(null)
  const launchLeverGroupRef = useRef<THREE.Group | null>(null)
  const pneumaticStatusLampMatRef = useRef<THREE.MeshStandardMaterial | null>(
    null
  )
  const pneumaticStatusLightRef = useRef<THREE.PointLight | null>(null)

  // Tutorial 3D Hardware Highlighting Material Refs (Amber-Gold -> Emerald Pulse)
  const printerLampMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const approveKnobMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const shredKnobMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const capsuleRingMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const hatchKnobMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const launchKnobMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const shredLeverKnobMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const prevTutorialStepRef = useRef<string | number>(
    useGameStore.getState().tutorialStep
  )

  const capsulePackAnimRef = useRef<{
    active: boolean
    progress: number
    paperHex: string
  }>({
    active: false,
    progress: 0,
    paperHex: '#d8d2c0',
  })

  const capsuleDragRef = useRef<{
    dragging: boolean
    moved: boolean
    startX: number
    startZ: number
    x: number
    z: number
    dx: number
    dz: number
  }>({
    dragging: false,
    moved: false,
    startX: CAPSULE_CRADLE_POS_3D.x,
    startZ: CAPSULE_CRADLE_POS_3D.z,
    x: CAPSULE_CRADLE_POS_3D.x,
    z: CAPSULE_CRADLE_POS_3D.z,
    dx: 0,
    dz: 0,
  })

  const launchLeverDragRef = useRef<{
    dragging: boolean
    startY: number
    pullRatio: number
    launchedThisStroke: boolean
  }>({
    dragging: false,
    startY: 0,
    pullRatio: 0,
    launchedThisStroke: false,
  })

  const pneumaticAnimRef = useRef<{
    active: boolean
    progress: number
    paperHex: string
  }>({
    active: false,
    progress: 0,
    paperHex: '#d8d2c0',
  })

  const flightPosVecRef = useRef(new THREE.Vector3())
  const flightTanVecRef = useRef(new THREE.Vector3())
  const flightUpVecRef = useRef(new THREE.Vector3(0, 1, 0))

  const triggerPneumaticPackAnim = (paperHex = '#d8d2c0') => {
    capsulePackAnimRef.current.active = true
    capsulePackAnimRef.current.progress = 0
    capsulePackAnimRef.current.paperHex = paperHex
    for (const matRef of [
      cradlePaperMatRef,
      chamberPaperMatRef,
      flightPaperMatRef,
    ]) {
      if (matRef.current) {
        matRef.current.color.set(paperHex)
      }
    }
    playCapsulePackSound()
    triggerBobbleShockwave(0.65)
  }

  const triggerPneumaticFlightAnim = (paperHex = '#d8d2c0') => {
    pneumaticAnimRef.current.active = true
    pneumaticAnimRef.current.progress = 0
    pneumaticAnimRef.current.paperHex = paperHex
    if (flightPaperMatRef.current) {
      flightPaperMatRef.current.color.set(paperHex)
    }
    playPneumaticDispatchSound()
    triggerBobbleShockwave(1.1)
  }

  const triggerPneumaticDispatchAnim = (paperHex = '#d8d2c0') => {
    triggerPneumaticPackAnim(paperHex)
  }

  // Step 1 & Step 3: Carrier Cylinder (`КАПСУЛА`) Click / Drag-to-Chamber Handlers
  const handleCradleCapsulePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return
    e.stopPropagation()
    const store = useDeskStore.getState()

    if (store.capsuleState === 'CRADLE_EMPTY') {
      const stampedDoc = [...store.documents]
        .reverse()
        .find(
          (d) =>
            d.status === 'desk' && d.stamps.some((s) => s.type === 'APPROVED')
        )
      if (stampedDoc && store.packDocumentIntoCapsule(stampedDoc.id)) {
        triggerPneumaticPackAnim(PAPER_COLOR_HEX[stampedDoc.paperColor])
        lensDirtyRef.current = true
      } else {
        playDispatchErrorBuzzer()
        store.rejectUnstampedOutboxAttempt()
      }
      return
    }

    if (store.capsuleState === 'CRADLE_PACKED') {
      const target = e.target as Element & {
        setPointerCapture?: (id: number) => void
      }
      target.setPointerCapture?.(e.pointerId)
      const hit = getDeskLocalHitFromEvent(
        e,
        deskGroupRef.current,
        BASE_MAT_Y + 0.04
      )
      capsuleDragRef.current.dragging = true
      capsuleDragRef.current.moved = false
      capsuleDragRef.current.x = CAPSULE_CRADLE_POS_3D.x
      capsuleDragRef.current.z = CAPSULE_CRADLE_POS_3D.z
      if (hit) {
        capsuleDragRef.current.startX = hit.x
        capsuleDragRef.current.startZ = hit.z
        capsuleDragRef.current.dx = hit.x - CAPSULE_CRADLE_POS_3D.x
        capsuleDragRef.current.dz = hit.z - CAPSULE_CRADLE_POS_3D.z
      }
      playDetentClick(1)
    }
  }

  const handleCradleCapsulePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!capsuleDragRef.current.dragging) return
    e.stopPropagation()
    const hit = getDeskLocalHitFromEvent(
      e,
      deskGroupRef.current,
      BASE_MAT_Y + 0.04
    )
    if (!hit) return
    const dist = Math.hypot(
      hit.x - capsuleDragRef.current.startX,
      hit.z - capsuleDragRef.current.startZ
    )
    if (dist > 0.025) {
      capsuleDragRef.current.moved = true
    }
    capsuleDragRef.current.x = Math.max(
      -1.64,
      Math.min(-0.35, hit.x - capsuleDragRef.current.dx)
    )
    capsuleDragRef.current.z = Math.max(
      -0.78,
      Math.min(0.25, hit.z - capsuleDragRef.current.dz)
    )
  }

  const handleCradleCapsulePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!capsuleDragRef.current.dragging) return
    e.stopPropagation()
    const wasMoved = capsuleDragRef.current.moved
    const dropX = capsuleDragRef.current.x
    const dropZ = capsuleDragRef.current.z
    capsuleDragRef.current.dragging = false
    capsuleDragRef.current.moved = false
    capsuleDragRef.current.x = CAPSULE_CRADLE_POS_3D.x
    capsuleDragRef.current.z = CAPSULE_CRADLE_POS_3D.z

    const store = useDeskStore.getState()
    const nearChamber =
      !wasMoved ||
      (dropX >= BREECH_CHAMBER_DROP_ZONE_3D.minX &&
        dropX <= BREECH_CHAMBER_DROP_ZONE_3D.maxX &&
        dropZ >= BREECH_CHAMBER_DROP_ZONE_3D.minZ &&
        dropZ <= BREECH_CHAMBER_DROP_ZONE_3D.maxZ) ||
      Math.hypot(
        dropX - OUTBOX_BREECH_POS_3D.x,
        dropZ - OUTBOX_BREECH_POS_3D.z
      ) < 0.42

    if (nearChamber) {
      if (store.loadCapsuleIntoChamber()) {
        playCapsuleChamberLoadSound()
        triggerBobbleShockwave(0.55)
      } else {
        playDispatchErrorBuzzer()
      }
    } else {
      playDetentClick(0)
    }
  }

  // Step 2 & Step 4: Hinged Curved Brass/Glass Breech Hatch (`ЛЮК КАМЕРЫ`) Click Handler
  const handleBreechHatchClick = (e: ThreeEvent<MouseEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return
    e.stopPropagation()
    const store = useDeskStore.getState()
    if (store.capsuleState === 'IN_FLIGHT') return
    const nextOpen = store.toggleBreechHatch()
    playBreechHatchLatchSound(nextOpen)
    triggerBobbleShockwave(0.6)
  }

  // Clicking inside the open breech chamber when capsule is packed on the cradle also loads it cleanly
  const handleBreechChamberClick = (e: ThreeEvent<MouseEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return
    e.stopPropagation()
    const store = useDeskStore.getState()
    if (store.capsuleState === 'CRADLE_PACKED' && store.hatchOpen) {
      if (store.loadCapsuleIntoChamber()) {
        playCapsuleChamberLoadSound()
        triggerBobbleShockwave(0.55)
      }
      return
    }
    const nextOpen = store.toggleBreechHatch()
    playBreechHatchLatchSound(nextOpen)
    triggerBobbleShockwave(0.55)
  }

  // Step 5: Heavy Vacuum Launch Lever (`РЫЧАГ ПУСКА`) Drag-Down Handler
  const handleLaunchLeverDown = (e: ThreeEvent<PointerEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return
    e.stopPropagation()
    const target = e.target as Element & {
      setPointerCapture?: (id: number) => void
    }
    target.setPointerCapture?.(e.pointerId)
    launchLeverDragRef.current.dragging = true
    launchLeverDragRef.current.startY = e.clientY
    launchLeverDragRef.current.pullRatio = 0
    launchLeverDragRef.current.launchedThisStroke = false
    playDetentClick(1)
  }

  const handleLaunchLeverMove = (e: ThreeEvent<PointerEvent>) => {
    if (!launchLeverDragRef.current.dragging) return
    e.stopPropagation()
    const deltaY = Math.max(0, e.clientY - launchLeverDragRef.current.startY)
    const nextRatio = THREE.MathUtils.clamp(deltaY / 54, 0, 1)
    const prevStep = Math.floor(launchLeverDragRef.current.pullRatio * 4)
    const nextStep = Math.floor(nextRatio * 4)
    launchLeverDragRef.current.pullRatio = nextRatio

    if (nextStep !== prevStep) {
      playDetentClick(nextStep + 1)
    }

    if (nextRatio >= 0.82 && !launchLeverDragRef.current.launchedThisStroke) {
      launchLeverDragRef.current.launchedThisStroke = true
      const store = useDeskStore.getState()
      const packedPaperHex = store.packedDoc
        ? PAPER_COLOR_HEX[store.packedDoc.paperColor]
        : '#d8d2c0'
      if (store.launchPneumaticCapsule()) {
        triggerPneumaticFlightAnim(packedPaperHex)
      } else {
        playDispatchErrorBuzzer()
      }
    }
  }

  const handleLaunchLeverUp = (e: ThreeEvent<PointerEvent>) => {
    if (!launchLeverDragRef.current.dragging) return
    e.stopPropagation()
    const wasQuickPull =
      !launchLeverDragRef.current.launchedThisStroke &&
      launchLeverDragRef.current.pullRatio < 0.25
    launchLeverDragRef.current.dragging = false

    if (wasQuickPull) {
      const store = useDeskStore.getState()
      const packedPaperHex = store.packedDoc
        ? PAPER_COLOR_HEX[store.packedDoc.paperColor]
        : '#d8d2c0'
      if (store.launchPneumaticCapsule()) {
        launchLeverDragRef.current.pullRatio = 1.0
        triggerPneumaticFlightAnim(packedPaperHex)
        window.setTimeout(() => {
          launchLeverDragRef.current.pullRatio = 0
        }, 280)
        return
      }
      playDispatchErrorBuzzer()
    }

    launchLeverDragRef.current.pullRatio = 0
    playSwitchClank(false)
  }

  // Guardrail 4: Execute stamp impact, radial air-pressure shockwave & immediate texture refresh
  const triggerStampPaperShockwave = (
    stampX: number,
    stampZ: number,
    stampedDocId: string | null
  ) => {
    const deskDocs = useDeskStore
      .getState()
      .documents.filter((d) => d.status === 'desk')
    for (const d of deskDocs) {
      if (d.id === stampedDocId) continue
      const livePos = liveDocPosMapRef.current[d.id] ?? { x: d.x, z: d.z }
      const dx = livePos.x - stampX
      const dz = livePos.z - stampZ
      const dist = Math.hypot(dx, dz)
      if (dist > 0.001 && dist < 0.72) {
        const falloff = Math.pow(1 - dist / 0.72, 1.35)
        const dirX = dx / dist
        const dirZ = dz / dist
        paperImpulseMapRef.current[d.id] = {
          vx: dirX * 0.48 * falloff,
          vz: dirZ * 0.48 * falloff,
          angVel:
            (dirX * dz -
              dirZ * dx +
              Math.sin(livePos.x * 17 + livePos.z * 23) * 0.3) *
            2.4 *
            falloff,
          hopY: 0.14 * falloff,
        }
      }
    }
  }

  const execute3DStampImpact = (type: StampType) => {
    const st = stampStateRef.current[type]
    const state = useDeskStore.getState()
    const deskDocs = state.documents.filter((d) => d.status === 'desk')

    for (let i = deskDocs.length - 1; i >= 0; i--) {
      const doc = deskDocs[i]
      const livePos = liveDocPosMapRef.current[doc.id] ?? {
        x: doc.x,
        z: doc.z,
        isExpanded: doc.isExpanded,
      }
      const docW = livePos.isExpanded ? PAPER_EXPANDED_W_3D : PAPER_COMPACT_W_3D
      const docH = livePos.isExpanded ? PAPER_EXPANDED_H_3D : PAPER_COMPACT_H_3D
      const left = livePos.x - docW / 2
      const top = livePos.z - docH / 2

      if (
        st.x >= left - 0.06 &&
        st.x <= left + docW + 0.06 &&
        st.z >= top - 0.06 &&
        st.z <= top + docH + 0.06
      ) {
        const u = Math.max(0.18, Math.min(0.82, (st.x - left) / docW))
        const v = Math.max(0.14, Math.min(0.86, (st.z - top) / docH))
        playStampInkThud(type)
        triggerBobbleShockwave(1.15)
        triggerStampPaperShockwave(st.x, st.z, doc.id)
        state.addStampToDocument(doc.id, {
          id: `STAMP-84-${nextStampSeq++}`,
          type,
          u,
          v,
        })
        lensDirtyRef.current = true
        return
      }
    }
    playSwitchClank(true)
    triggerBobbleShockwave(0.7)
    triggerStampPaperShockwave(st.x, st.z, null)
  }

  useFrame(({ clock, camera }, delta) => {
    const t = clock.getElapsedTime()
    const dt = Math.min(0.033, Math.max(0.001, delta))
    const deskState = useDeskStore.getState()
    const curCapsuleState = deskState.capsuleState
    const curHatchOpen = deskState.hatchOpen
    const isSealedAndReady =
      curCapsuleState === 'CHAMBER_LOADED' && !curHatchOpen

    if (manometerNeedleRef.current) {
      const vacSurge = pneumaticAnimRef.current.active
        ? Math.sin(pneumaticAnimRef.current.progress * Math.PI) * 1.55
        : isSealedAndReady
          ? 0.48
          : curHatchOpen
            ? -0.25
            : 0
      manometerNeedleRef.current.rotation.z =
        -0.42 +
        vacSurge +
        Math.sin(t * 21.0) * 0.065 +
        Math.cos(t * 34.5) * 0.038
    }

    // Pneumatic Breech Chamber Status Lamp:
    // - Solid / Pulsing Emerald Green (`ГОТОВ К ПУСКУ // SEALED & READY`) when capsule is loaded & hatch is closed (or in flight)
    // - Warm Amber (`#ffb000`) when hatch is open, capsule is packed on cradle, or paper is stamped ОДОБРЕНО
    // - Dim dark green when idle
    if (pneumaticStatusLampMatRef.current) {
      if (pneumaticAnimRef.current.active || isSealedAndReady) {
        const pulse = pneumaticAnimRef.current.active
          ? 3.2
          : 2.2 + Math.sin(t * 6.0) * 0.45
        pneumaticStatusLampMatRef.current.color.set('#33ff66')
        pneumaticStatusLampMatRef.current.emissive.set('#33ff66')
        pneumaticStatusLampMatRef.current.emissiveIntensity = pulse
      } else if (
        curHatchOpen ||
        curCapsuleState === 'CRADLE_PACKED' ||
        hasApprovedDocOnDesk
      ) {
        const pulse = 1.35 + Math.sin(t * 7.5) * 0.65
        pneumaticStatusLampMatRef.current.color.set('#ffb000')
        pneumaticStatusLampMatRef.current.emissive.set('#ff8800')
        pneumaticStatusLampMatRef.current.emissiveIntensity = pulse
      } else {
        pneumaticStatusLampMatRef.current.color.set('#2b382e')
        pneumaticStatusLampMatRef.current.emissive.set('#0a2412')
        pneumaticStatusLampMatRef.current.emissiveIntensity = 0.25
      }
    }
    if (pneumaticStatusLightRef.current) {
      const lightActive =
        pneumaticAnimRef.current.active ||
        isSealedAndReady ||
        curHatchOpen ||
        curCapsuleState === 'CRADLE_PACKED' ||
        hasApprovedDocOnDesk
      pneumaticStatusLightRef.current.visible = lightActive
      pneumaticStatusLightRef.current.color.set(
        pneumaticAnimRef.current.active || isSealedAndReady
          ? '#33ff66'
          : '#ffb000'
      )
      pneumaticStatusLightRef.current.intensity =
        pneumaticAnimRef.current.active
          ? 1.5
          : isSealedAndReady
            ? 1.1
            : 0.55 + Math.sin(t * 7.5) * 0.25
    }

    // Step 1 Animation: Paper rolling into scroll & sliding inside Carrier Cylinder (`КАПСУЛА`) on Desk Cradle
    if (capsulePackAnimRef.current.active) {
      capsulePackAnimRef.current.progress = Math.min(
        1.0,
        capsulePackAnimRef.current.progress + dt * 2.8
      )
      if (capsulePackAnimRef.current.progress >= 1.0) {
        capsulePackAnimRef.current.active = false
      }
    }

    if (cradleCapsuleGroupRef.current) {
      const showOnCradle =
        curCapsuleState === 'CRADLE_EMPTY' ||
        curCapsuleState === 'CRADLE_PACKED'
      cradleCapsuleGroupRef.current.visible = showOnCradle
      if (showOnCradle) {
        const drag = capsuleDragRef.current
        const targetX = drag.dragging ? drag.x : CAPSULE_CRADLE_POS_3D.x
        const targetZ = drag.dragging ? drag.z : CAPSULE_CRADLE_POS_3D.z
        const targetY = drag.dragging
          ? BASE_MAT_Y + 0.068
          : CAPSULE_CRADLE_POS_3D.y + 0.036
        cradleCapsuleGroupRef.current.position.x = THREE.MathUtils.lerp(
          cradleCapsuleGroupRef.current.position.x,
          targetX,
          Math.min(1, dt * 22)
        )
        cradleCapsuleGroupRef.current.position.y = THREE.MathUtils.lerp(
          cradleCapsuleGroupRef.current.position.y,
          targetY,
          Math.min(1, dt * 22)
        )
        cradleCapsuleGroupRef.current.position.z = THREE.MathUtils.lerp(
          cradleCapsuleGroupRef.current.position.z,
          targetZ,
          Math.min(1, dt * 22)
        )
        // Stand upright as the operator drags the packed capsule toward the open breech chamber!
        const nearBreech =
          drag.dragging &&
          Math.hypot(
            drag.x - OUTBOX_BREECH_POS_3D.x,
            drag.z - OUTBOX_BREECH_POS_3D.z
          ) < 0.45
        const targetRotZ = nearBreech ? 0 : Math.PI / 2
        const targetRotY = nearBreech ? 0 : 0.18
        cradleCapsuleGroupRef.current.rotation.z = THREE.MathUtils.lerp(
          cradleCapsuleGroupRef.current.rotation.z,
          targetRotZ,
          Math.min(1, dt * 16)
        )
        cradleCapsuleGroupRef.current.rotation.y = THREE.MathUtils.lerp(
          cradleCapsuleGroupRef.current.rotation.y,
          targetRotY,
          Math.min(1, dt * 16)
        )
      }
    }

    if (cradleTopCapRef.current) {
      // Cap is open (+0.028m offset & tilted) when empty or during first half of packing, then snaps shut at 0.058m!
      const packP = capsulePackAnimRef.current.progress
      const isCapOpen =
        curCapsuleState === 'CRADLE_EMPTY' ||
        (capsulePackAnimRef.current.active && packP < 0.72)
      const targetCapY = isCapOpen ? 0.088 : 0.058
      const targetCapRotZ = isCapOpen ? -0.55 : 0
      cradleTopCapRef.current.position.y = THREE.MathUtils.lerp(
        cradleTopCapRef.current.position.y,
        targetCapY,
        Math.min(1, dt * 20)
      )
      cradleTopCapRef.current.rotation.z = THREE.MathUtils.lerp(
        cradleTopCapRef.current.rotation.z,
        targetCapRotZ,
        Math.min(1, dt * 20)
      )
    }

    if (cradleScrollRef.current) {
      const hasScroll = curCapsuleState !== 'CRADLE_EMPTY'
      cradleScrollRef.current.visible = hasScroll
      if (hasScroll) {
        const packP = capsulePackAnimRef.current.active
          ? capsulePackAnimRef.current.progress
          : 1.0
        const slideT = THREE.MathUtils.clamp(packP / 0.75, 0, 1)
        cradleScrollRef.current.position.y = THREE.MathUtils.lerp(
          0.095,
          0,
          slideT
        )
        cradleScrollRef.current.rotation.y = (1 - slideT) * Math.PI * 2.5
      }
    }

    // Step 2 & Step 4 Animation: Hinged Curved Brass/Glass Breech Door (`ЛЮК КАМЕРЫ`) swings open ~85° (-1.48 rad)
    if (breechDoorGroupRef.current) {
      const targetDoorRotY = curHatchOpen ? -1.48 : 0
      breechDoorGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        breechDoorGroupRef.current.rotation.y,
        targetDoorRotY,
        Math.min(1, dt * 16)
      )
    }

    // Step 3 Animation: Packed Carrier Cylinder sitting inside the Breech Chamber
    if (chamberCapsuleGroupRef.current) {
      chamberCapsuleGroupRef.current.visible =
        curCapsuleState === 'CHAMBER_LOADED'
    }

    // Step 5 Animation: Vacuum Launch Lever (`РЫЧАГ ПУСКА`) rotation & In-Flight Capsule shooting along ceiling pipe to K.O.M.R.A.D.-84!
    if (launchLeverGroupRef.current) {
      const targetPull = pneumaticAnimRef.current.active
        ? Math.sin(
            Math.min(1, pneumaticAnimRef.current.progress * 2.2) * Math.PI
          )
        : launchLeverDragRef.current.pullRatio
      const targetRotX = 0.22 + targetPull * 1.18
      launchLeverGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        launchLeverGroupRef.current.rotation.x,
        targetRotX,
        Math.min(1, dt * 20)
      )
    }

    if (pneumaticAnimRef.current.active) {
      pneumaticAnimRef.current.progress += dt * 1.18
      const p = pneumaticAnimRef.current.progress
      if (p >= 1.0) {
        pneumaticAnimRef.current.active = false
        pneumaticAnimRef.current.progress = 0
        if (flightCapsuleGroupRef.current) {
          flightCapsuleGroupRef.current.visible = false
        }
        useDeskStore.getState().completePneumaticLaunch()
        lensDirtyRef.current = true
      } else if (flightCapsuleGroupRef.current) {
        flightCapsuleGroupRef.current.visible = true
        // Smooth ease-in-out acceleration along the 3D CatmullRomCurve3 pipeline from breech -> riser -> 90° ceiling elbow -> horizontal ceiling run -> behind K.O.M.R.A.D.-84!
        const u = THREE.MathUtils.smoothstep(p, 0, 1)
        pneumaticFlightCurve.getPointAt(u, flightPosVecRef.current)
        pneumaticFlightCurve.getTangentAt(u, flightTanVecRef.current)
        flightCapsuleGroupRef.current.position.copy(flightPosVecRef.current)
        flightCapsuleGroupRef.current.quaternion.setFromUnitVectors(
          flightUpVecRef.current,
          flightTanVecRef.current.normalize()
        )
        flightCapsuleGroupRef.current.rotateY(t * 16.0)
      }
    } else if (flightCapsuleGroupRef.current) {
      flightCapsuleGroupRef.current.visible = false
    }

    // Physical Pull-Tension & Vertex Bending on Emerging ПРАВДА-84 Paper Strip + Printer Recoil Jolt
    const grab = slipGrabRef.current
    if (!grab.dragging && (Math.abs(grab.pullDeltaX) > 0.0005 || Math.abs(grab.pullDeltaZ) > 0.0005 || grab.tension > 0.001)) {
      const snapLerp = Math.min(1, dt * 20)
      grab.pullDeltaX = THREE.MathUtils.lerp(grab.pullDeltaX, 0, snapLerp)
      grab.pullDeltaZ = THREE.MathUtils.lerp(grab.pullDeltaZ, 0, snapLerp)
      grab.tension = THREE.MathUtils.lerp(grab.tension, 0, snapLerp)
      if (Math.hypot(grab.pullDeltaX, grab.pullDeltaZ) < 0.0008) {
        grab.pullDeltaX = 0
        grab.pullDeltaZ = 0
        grab.tension = 0
      }
    }

    if (printerRecoilRef.current > 0.001) {
      printerRecoilRef.current = Math.max(0, printerRecoilRef.current - dt * 6.5)
    }
    if (printerGroupRef.current) {
      const strainShake = grab.tension * 0.0025
      const recoilZ = Math.sin(printerRecoilRef.current * Math.PI) * 0.014
      const recoilPitch = -Math.sin(printerRecoilRef.current * Math.PI) * 0.045
      printerGroupRef.current.position.set(
        PRINTER_SLOT_X_3D + Math.sin(t * 64) * strainShake,
        0.962 + Math.abs(Math.cos(t * 58)) * strainShake * 0.5,
        0.32 + recoilZ
      )
      printerGroupRef.current.rotation.set(recoilPitch, 0.15, 0)
    }

    // Only deform emerging paper strip vertices & recompute normals when a slip is present and actively moving/pulled!
    if (printingDoc) {
      const stripDeformSig = `${printingDoc.id}|${printStepRef.current}|${grab.dragging ? Math.floor(t * 24) : 0}|${grab.pullDeltaX.toFixed(3)}|${grab.pullDeltaZ.toFixed(3)}|${grab.tension.toFixed(3)}`
      if (lastStripDeformSigRef.current !== stripDeformSig) {
        lastStripDeformSigRef.current = stripDeformSig
        const stripLen = Math.max(0.04, printStepRef.current * PRINTER_FEED_STEP_M)
        for (const geoRef of [printingStripGeoRef, printingBackingGeoRef]) {
          const geo = geoRef.current
          if (!geo) continue
          const posAttr = geo.attributes.position as THREE.BufferAttribute
          for (let i = 0; i < posAttr.count; i++) {
            const y0 = posAttr.getY(i)
            // v = 0 at the bottom edge anchored inside the ПРАВДА-84 roller slot, v = 1 at the top free edge
            const v = THREE.MathUtils.clamp(
              (y0 + stripLen * 0.5) / Math.max(0.01, stripLen),
              0,
              1
            )
            const bendWeight = v * v
            const stretchWeight = Math.pow(v, 1.35)
            const shiver =
              Math.sin(t * 72 + v * 11) * 0.007 * grab.tension * v
            const archZ =
              (grab.pullDeltaZ * 1.45 + Math.abs(grab.pullDeltaX) * 0.45) *
                bendWeight +
              shiver
            const offsetZ =
              (geoRef === printingBackingGeoRef ? -0.002 : 0.002) + archZ
            posAttr.setZ(i, offsetZ)
            // Store horizontal pull shear inside userData base X + shear so vertices return cleanly to x0
            if (!geo.userData.baseX) {
              const baseArr = new Float32Array(posAttr.count)
              for (let j = 0; j < posAttr.count; j++) {
                baseArr[j] = posAttr.getX(j)
              }
              geo.userData.baseX = baseArr
            }
            const baseX = (geo.userData.baseX as Float32Array)[i] ?? 0
            const shearX =
              grab.pullDeltaX * 1.55 * stretchWeight +
              Math.cos(t * 68 + v * 9) * 0.005 * grab.tension * v
            posAttr.setX(i, baseX + shearX)
          }
          posAttr.needsUpdate = true
          geo.computeVertexNormals()
        }
      }
    }

    const isFreeLookMode = useCameraLookStore.getState().isFreeLookMode

    // 0. Sync Inspection Grace Damping (`30%` slower background thermal/pressure escalation while holding Magnifying Glass or Manual)
    const gameState = useGameStore.getState()
    const isActivelyInspecting =
      lensPosRef.current.dragging || isManualHeldRef.current
    if (isActivelyInspecting !== lastInspectingStateRef.current) {
      lastInspectingStateRef.current = isActivelyInspecting
      gameState.setInspectingDesk(isActivelyInspecting)
    }

    // 0b. Update 3D Illuminated 6-Lamp Master Annunciator Strip (`ТАБЛО ТРЕВОГИ`) & Distinct Audio Warning Chimes
    const maxBearingC = 20 + Math.max(gameState.pumpAHeat, gameState.pumpBHeat)
    const hzDrift = Math.abs(gameState.gridHz - 50.0)
    const waterInDrought =
      gameState.waterReservoir < 22 ||
      Math.abs(gameState.drumWaterLevel) > 180 ||
      gameState.pripyatWater < 26 ||
      gameState.kolkhozWater < 30 ||
      gameState.vodkaWater < 34
    const waterLow =
      gameState.waterReservoir < 34 ||
      Math.abs(gameState.drumWaterLevel) > 135 ||
      gameState.pripyatWater < 38 ||
      gameState.kolkhozWater < 40 ||
      gameState.vodkaWater < 42

    // Severity levels: 0 = Dim Normal, 1 = Amber Early Warning, 2 = Critical Red (or 3 = Incoming Order Emerald/Amber Flash)
    const nextLevels = [
      gameState.coreTemp > 680 ? 2 : gameState.coreTemp > 560 ? 1 : 0,
      waterInDrought ? 2 : waterLow ? 1 : 0,
      gameState.heliumPressure > 72 ||
      gameState.lubeOilPressure < 24 ||
      gameState.bubblerLevel >= 92
        ? 2
        : gameState.heliumPressure > 62 ||
            gameState.lubeOilPressure < 36 ||
            gameState.bubblerLevel >= 82
          ? 1
          : 0,
      maxBearingC > 90 ? 2 : maxBearingC > 80 ? 1 : 0,
      (Boolean(gameState.turbines[0]?.gridConnected) && hzDrift > 1.2) ||
      !gameState.avrActive ||
      !gameState.auxLoopBActive
        ? 2
        : (Boolean(gameState.turbines[0]?.gridConnected) && hzDrift > 0.65) ||
            gameState.wetSteamPenalty > 0.12
          ? 1
          : 0,
      printingDoc !== null ? 3 : 0,
    ]

    let crossedIntoAmber = false
    let anyCriticalRed = false
    for (let i = 0; i < 6; i++) {
      const prev = prevAnnunciatorLevelsRef.current[i] ?? 0
      const curr = nextLevels[i] ?? 0
      if (i < 5 && prev === 0 && curr === 1) {
        crossedIntoAmber = true
      }
      if (i < 5 && curr === 2) {
        anyCriticalRed = true
      }
      prevAnnunciatorLevelsRef.current[i] = curr

      const mat = annunciatorMatRefs.current[i]
      if (mat) {
        if (gameState.isBlackout) {
          mat.color.set('#141816')
          mat.emissive.set('#000000')
          mat.emissiveIntensity = 0
        } else if (curr === 2) {
          const redFlash = Math.sin(t * 11.0 + i * 0.4) > -0.2
          mat.color.set(redFlash ? '#ff3838' : '#5e1414')
          mat.emissive.set('#ff2a2a')
          mat.emissiveIntensity = redFlash ? 1.85 : 0.35
        } else if (curr === 1) {
          const amberFlash = Math.sin(t * 6.5 + i * 0.5) > -0.3
          mat.color.set(amberFlash ? '#ffb824' : '#593e0c')
          mat.emissive.set('#ffb000')
          mat.emissiveIntensity = amberFlash ? 1.35 : 0.3
        } else if (curr === 3) {
          const orderCycle = Math.sin(t * 8.0) > 0
          const orderHex = orderCycle ? '#33ff66' : '#ffb000'
          mat.color.set(orderHex)
          mat.emissive.set(orderHex)
          mat.emissiveIntensity = 1.45
        } else {
          mat.color.set('#22332a')
          mat.emissive.set('#183b26')
          mat.emissiveIntensity = 0.22
        }
      }
    }

    if (crossedIntoAmber && gameState.phase === 'playing') {
      playAmberWarningChime()
    }
    if (
      anyCriticalRed &&
      gameState.phase === 'playing' &&
      t - lastKlaxonPulseTimeRef.current >= 6.5
    ) {
      lastKlaxonPulseTimeRef.current = t
      playCriticalRedKlaxonPulse()
    }

    // 0c. 5-Stage KGB Operator Qualification Drill (`УЧЕБНАЯ ТРЕВОГА`):
    //     - Play confirmation chime when tutorialStep advances
    //     - Pulse required 3D hardware lamps/knobs with Amber-Gold -> Emerald (`Math.sin(t * 6)`)
    const curTutStep = gameState.tutorialStep
    if (prevTutorialStepRef.current !== curTutStep) {
      prevTutorialStepRef.current = curTutStep
      if (gameState.phase === 'playing') {
        playAmberWarningChime()
      }
    }

    const tutPulse = (Math.sin(t * 6.0) + 1) * 0.5
    const tutHex = tutPulse > 0.5 ? '#33ff66' : '#ffb000'
    const tutEmissiveIntensity = 1.15 + tutPulse * 1.15

    const deskDocForTut = deskState.documents.find((d) => d.status === 'desk')
    const hasShreddedStampOnDesk = Boolean(
      deskDocForTut?.stamps.some((s) => s.type === 'SHREDDED')
    )

    // 1. Printer Lamp Pulse (Step 1A or Step 5A while printingDoc is emerging)
    if (printerLampMatRef.current) {
      const highlightPrinter =
        (curTutStep === 1 || curTutStep === 5) && printingDoc !== null
      if (highlightPrinter) {
        printerLampMatRef.current.color.set(tutHex)
        printerLampMatRef.current.emissive.set(tutHex)
        printerLampMatRef.current.emissiveIntensity = tutEmissiveIntensity
      } else {
        printerLampMatRef.current.color.set(
          printerReceiving ? '#ff2a2a' : '#8b1e1e'
        )
        printerLampMatRef.current.emissive.set(
          printerReceiving ? '#ff2a2a' : '#000000'
        )
        printerLampMatRef.current.emissiveIntensity = printerReceiving ? 1.4 : 0
      }
    }

    // 2. Green Stamp [ОДОБРЕНО] Knob Pulse (Step 1B: paper on desk, not yet stamped APPROVED)
    if (approveKnobMatRef.current) {
      const highlightApprove =
        curTutStep === 1 &&
        printingDoc === null &&
        deskDocForTut !== undefined &&
        !hasApprovedDocOnDesk &&
        curCapsuleState === 'CRADLE_EMPTY'
      if (highlightApprove) {
        approveKnobMatRef.current.color.set(tutHex)
        approveKnobMatRef.current.emissive.set(tutHex)
        approveKnobMatRef.current.emissiveIntensity = tutEmissiveIntensity
      } else {
        approveKnobMatRef.current.color.set('#248f43')
        approveKnobMatRef.current.emissive.set('#0c3818')
        approveKnobMatRef.current.emissiveIntensity = 0.25
      }
    }

    // 3. Carrier Capsule Ring Pulse (Step 1C: stamped APPROVED on desk, or packed on cradle waiting to load)
    if (capsuleRingMatRef.current) {
      const highlightCapsule =
        curTutStep === 1 &&
        ((hasApprovedDocOnDesk && curCapsuleState === 'CRADLE_EMPTY') ||
          (curCapsuleState === 'CRADLE_PACKED' && curHatchOpen))
      if (highlightCapsule) {
        capsuleRingMatRef.current.color.set(tutHex)
        capsuleRingMatRef.current.emissive.set(tutHex)
        capsuleRingMatRef.current.emissiveIntensity = tutEmissiveIntensity
      } else {
        capsuleRingMatRef.current.color.set(
          curCapsuleState === 'CRADLE_PACKED' ? '#33ff66' : '#b8a46b'
        )
        capsuleRingMatRef.current.emissive.set(
          curCapsuleState === 'CRADLE_PACKED' ? '#198c38' : '#000000'
        )
        capsuleRingMatRef.current.emissiveIntensity =
          curCapsuleState === 'CRADLE_PACKED' ? 0.8 : 0
      }
    }

    // 4. Breech Hatch Latch Knob Pulse (Step 1C: packed on cradle & hatch closed, OR loaded in chamber & hatch open)
    if (hatchKnobMatRef.current) {
      const highlightHatch =
        curTutStep === 1 &&
        ((curCapsuleState === 'CRADLE_PACKED' && !curHatchOpen) ||
          (curCapsuleState === 'CHAMBER_LOADED' && curHatchOpen))
      if (highlightHatch) {
        hatchKnobMatRef.current.color.set(tutHex)
        hatchKnobMatRef.current.emissive.set(tutHex)
        hatchKnobMatRef.current.emissiveIntensity = tutEmissiveIntensity
      } else {
        hatchKnobMatRef.current.color.set(curHatchOpen ? '#ffb000' : '#b82a24')
        hatchKnobMatRef.current.emissive.set('#000000')
        hatchKnobMatRef.current.emissiveIntensity = 0
      }
    }

    // 5. Vacuum Launch Lever Knob Pulse (Step 1C: chamber loaded & hatch sealed)
    if (launchKnobMatRef.current) {
      const highlightLaunch = curTutStep === 1 && isSealedAndReady
      if (highlightLaunch) {
        launchKnobMatRef.current.color.set(tutHex)
        launchKnobMatRef.current.emissive.set(tutHex)
        launchKnobMatRef.current.emissiveIntensity = tutEmissiveIntensity
      } else {
        launchKnobMatRef.current.color.set('#b82a24')
        launchKnobMatRef.current.emissive.set('#4a0808')
        launchKnobMatRef.current.emissiveIntensity = isSealedAndReady
          ? 0.65
          : 0.25
      }
    }

    // 6. Red Stamp [УНИЧТОЖЕНО] & Shredder Lever Knob Pulse (Step 5)
    if (shredKnobMatRef.current) {
      const highlightShredStamp =
        curTutStep === 5 &&
        printingDoc === null &&
        deskDocForTut !== undefined &&
        !hasShreddedStampOnDesk &&
        loadedDoc === null
      if (highlightShredStamp) {
        shredKnobMatRef.current.color.set(tutHex)
        shredKnobMatRef.current.emissive.set(tutHex)
        shredKnobMatRef.current.emissiveIntensity = tutEmissiveIntensity
      } else {
        shredKnobMatRef.current.color.set('#c42828')
        shredKnobMatRef.current.emissive.set('#4a0c0c')
        shredKnobMatRef.current.emissiveIntensity = 0.25
      }
    }
    if (shredLeverKnobMatRef.current) {
      const highlightShredLever =
        curTutStep === 5 && (hasShreddedStampOnDesk || loadedDoc !== null)
      if (highlightShredLever) {
        shredLeverKnobMatRef.current.color.set(tutHex)
        shredLeverKnobMatRef.current.emissive.set(tutHex)
        shredLeverKnobMatRef.current.emissiveIntensity = tutEmissiveIntensity
      } else {
        shredLeverKnobMatRef.current.color.set('#b82a24')
        shredLeverKnobMatRef.current.emissive.set('#4a0808')
        shredLeverKnobMatRef.current.emissiveIntensity = 0.35
      }
    }

    // Compute concise Tutorial Prompt for Desk Ticker (`ПУНКТ №4 // DESK`)
    let tutorialTickerPrompt: string | null = null
    if (curTutStep === 1) {
      if (printingDoc !== null) {
        tutorialTickerPrompt =
          'DRILL 1/5 [DESK]: DRAG PAPER RIGHT TO TEAR FROM PRINTER -> PLACE ON DESK MAT.'
      } else if (!hasApprovedDocOnDesk && curCapsuleState === 'CRADLE_EMPTY') {
        tutorialTickerPrompt =
          'DRILL 1/5 [DESK]: ORDER IS GENUINE! CLICK GREEN STAMP [ОДОБРЕНО] -> STAMP THE PAPER.'
      } else {
        tutorialTickerPrompt =
          'DRILL 1/5 [DESK]: PACK PAPER IN BRASS CAPSULE -> OPEN LEFT TUBE HATCH -> LOAD CAPSULE -> CLOSE HATCH & PULL RED LAUNCH LEVER!'
      }
    } else if (curTutStep === 2) {
      tutorialTickerPrompt =
        'DRILL 2/5 [PRESS KEY 1 -> UNIT A]: VODKA PLANT DEMANDS 25 MW! PULL LEVER [5. VODKA PLANT] UP UNTIL ITS READOUT SHOWS 25 / 25 MW.'
    } else if (curTutStep === 3) {
      tutorialTickerPrompt =
        gameState.pumpThrottle[0] <= 50
          ? 'DRILL 3/5 [KEY 1 -> UNIT A]: MORE MW CREATES CORE HEAT! TURN [COOLING PUMP A] WHEEL ABOVE 50% TO SIPHON COOLING WATER.'
          : 'DRILL 3/5 [PRESS KEY 3 -> UNIT B]: TURN [HELIUM-N2 LOOP] WHEEL (>40%) FOR DRY COOLING & HOLD [BUBBLER DRAIN] LEVER TO PUMP WATER BACK!'
    } else if (curTutStep === 4) {
      tutorialTickerPrompt =
        'DRILL 4/5 [PRESS KEY 5 -> UNIT C]: POWER CHANGES SHIFT TURBINE FREQUENCY (48.8 HZ)! DRAG [50HZ RHEOSTAT] DIAL TO LOCK 50.0 HZ.'
    } else if (curTutStep === 5) {
      tutorialTickerPrompt =
        'DRILL 5/5 [PRESS KEY 4 -> DESK]: INSPECT NEW ORDER WITH [B] MANUAL OR [Z] LENS! IT HAS A FAKE SEAL — STAMP RED [УНИЧТОЖЕНО], DROP IN SHREDDER & PULL HANDLE 5 TIMES!'
    }

    const contextualHint =
      gameState.hoveredControlHint ??
      (gameState.hoveredDiagnosticId !== null || curTutStep === 'DONE'
        ? getContextualDiagnosticHint(gameState, printingDoc !== null)
        : null)

    // 1. Update Top Status & Verdict Header Ticker
    const headerSig = `${commendations}|${citations}|${isMusicMuted}|${isFreeLookMode}|${tutorialTickerPrompt ?? ''}|${contextualHint ?? ''}|${lastVerdict?.docId ?? ''}|${lastVerdict?.decision ?? ''}|${lastVerdict?.reason ?? ''}`
    const hTex = headerTickerMatRef.current?.map as
      | THREE.CanvasTexture
      | undefined
    if (hTex && hTex.userData.lastSig !== headerSig) {
      hTex.userData.lastSig = headerSig
      const canvas = hTex.image as HTMLCanvasElement
      const ctx = canvas.getContext('2d')
      if (ctx) {
        drawDeskHeaderTickerCanvas(
          ctx,
          canvas.width,
          canvas.height,
          commendations,
          citations,
          lastVerdict,
          isMusicMuted,
          isFreeLookMode,
          tutorialTickerPrompt,
          contextualHint
        )
        hTex.needsUpdate = true
      }
    }

    // 2. Update Emerging Printing Slip Texture
    if (printingDoc) {
      const pTex = printingSlipMatRef.current?.map as
        | THREE.CanvasTexture
        | undefined
      if (pTex && pTex.userData.lastSig !== printingDoc.id) {
        pTex.userData.lastSig = printingDoc.id
        const canvas = pTex.image as HTMLCanvasElement
        const ctx = canvas.getContext('2d')
        if (ctx) {
          drawCompactTeletypeSlipCanvas(
            ctx,
            canvas.width,
            canvas.height,
            printingDoc
          )
          pTex.needsUpdate = true
        }
      }
    }

    // 3. Update Loaded Shredder Slip & Shredder Readout Plate
    if (loadedDoc) {
      const lTex = loadedSlipMatRef.current?.map as
        | THREE.CanvasTexture
        | undefined
      const loadedDocSig = `${loadedDoc.id}|${loadedDoc.shredProgress}`
      if (lTex && lTex.userData.lastSig !== loadedDocSig) {
        lTex.userData.lastSig = loadedDocSig
        const canvas = lTex.image as HTMLCanvasElement
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.save()
          // Shift the document downward on the canvas by shredProgress% so the bottom edge is eaten by the steel teeth
          const shiftPx = Math.floor(
            (loadedDoc.shredProgress / 100) * canvas.height * 0.82
          )
          ctx.translate(0, shiftPx)
          drawCompactTeletypeSlipCanvas(
            ctx,
            canvas.width,
            canvas.height,
            loadedDoc
          )
          ctx.restore()
          lTex.needsUpdate = true
        }
      }
    }

    const shredSig = `${loadedDoc?.id ?? 'EMPTY'}|${loadedDoc?.shredProgress ?? 0}`
    const spTex = shredPlateMatRef.current?.map as
      | THREE.CanvasTexture
      | undefined
    if (spTex && spTex.userData.lastSig !== shredSig) {
      spTex.userData.lastSig = shredSig
      const canvas = spTex.image as HTMLCanvasElement
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#18211b'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.strokeStyle = '#8c7a4b'
        ctx.lineWidth = 3
        ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6)
        ctx.fillStyle = '#b8a46b'
        ctx.font = 'bold 17px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText('УНИЧТОЖИТЕЛЬ-84', canvas.width / 2, 22)
        ctx.fillStyle = loadedDoc ? '#33ff66' : '#8f8772'
        ctx.font = 'bold 14px "Courier Prime", monospace'
        ctx.fillText(
          loadedDoc ? '● ГОТОВ (READY)' : '○ ПУСТО (EMPTY)',
          canvas.width / 2,
          46
        )
        ctx.fillStyle = '#cfc6b0'
        ctx.font = 'bold 18px "VT323", monospace'
        ctx.fillText(
          `ИЗМЕЛЬЧЕНО ${String(loadedDoc?.shredProgress ?? 0).padStart(3, '0')}%`,
          canvas.width / 2,
          74
        )
        spTex.needsUpdate = true
      }
    }

    // 3B. Refresh WE-PAD 84 Live Screen CanvasTexture when telemetry or chat updates
    const gsNow = useGameStore.getState()
    const wePadSig = `${gsNow.wePadActiveTab}|${gsNow.wePadHeld}|${gsNow.wePadInspecting}|${gsNow.tutorialPhase}|${gsNow.tutorialPrompt.actionLine}|${gsNow.wePadChatLog.length}|${manualScrollY}|${Math.round(gsNow.thermalPower / 10)}|${Math.round(gsNow.drumPressure)}|${Math.round(gsNow.drumWaterLevel / 5)}|${Math.round(gsNow.turbines[0].valve * 100)}|${Math.round(gsNow.turbines[0].rpm / 20)}|${gsNow.turbines[0].freqHz.toFixed(1)}|${Math.round(gsNow.totalElectricalMW / 5)}|${Math.round(gsNow.xenon)}|${Math.round(gsNow.voidFraction * 100)}|${gsNow.plantWaterDrainPct}`
    const mTex = manualMatRef.current?.map as THREE.CanvasTexture | undefined
    if (mTex && lastWePadSigRef.current !== wePadSig) {
      lastWePadSigRef.current = wePadSig
      const canvas = mTex.image as HTMLCanvasElement
      const ctx = canvas.getContext('2d')
      if (ctx) {
        drawWePad84ScreenCanvas(
          ctx,
          canvas.width,
          canvas.height,
          buildWePadPayload(gsNow),
          manualScrollY
        )
        mTex.needsUpdate = true
      }
    }

    // 4. Update 3D Positions of Magnifier, Handheld/Desk WE-PAD 84 & Rubber Stamps
    const manualBaseY = manualPosRef.current.dragging
      ? BASE_MAT_Y + 0.024
      : BASE_MAT_Y + 0.012
    const targetHoldBlend = gsNow.wePadHeld ? 1 : 0
    manualHoldBlendRef.current = THREE.MathUtils.lerp(
      manualHoldBlendRef.current,
      targetHoldBlend,
      Math.min(1, dt * 12)
    )
    if (Math.abs(manualHoldBlendRef.current - targetHoldBlend) < 0.002) {
      manualHoldBlendRef.current = targetHoldBlend
    }
    const holdBlend = manualHoldBlendRef.current
    const smoothHold = holdBlend * holdBlend * (3 - 2 * holdBlend)

    const targetInspectBlend = gsNow.wePadHeld && gsNow.wePadInspecting ? 1 : 0
    manualInspectBlendRef.current = THREE.MathUtils.lerp(
      manualInspectBlendRef.current,
      targetInspectBlend,
      Math.min(1, dt * 14)
    )
    if (Math.abs(manualInspectBlendRef.current - targetInspectBlend) < 0.002) {
      manualInspectBlendRef.current = targetInspectBlend
    }
    const inspectBlend = manualInspectBlendRef.current
    const smoothInspect = inspectBlend * inspectBlend * (3 - 2 * inspectBlend)

    if (manualGroupRef.current) {
      if (smoothHold <= 0.0001) {
        manualGroupRef.current.position.set(
          manualPosRef.current.x,
          manualBaseY,
          manualPosRef.current.z
        )
        manualGroupRef.current.quaternion.copy(_manualDeskQuat)
        manualGroupRef.current.scale.setScalar(MANUAL_SCALE)
      } else {
        const perspCam = camera as THREE.PerspectiveCamera
        const fovRad = THREE.MathUtils.degToRad(perspCam.fov || 56)
        const aspect = perspCam.aspect || 1.77
        const holdDist = THREE.MathUtils.lerp(0.28, 0.21, smoothInspect)
        const halfFrustumH = Math.tan(fovRad * 0.5) * holdDist
        const halfFrustumW = halfFrustumH * aspect
        const swayX = Math.cos(t * 1.35) * 0.0006 * (1 - smoothInspect * 0.7)
        const swayY = Math.sin(t * 1.85) * 0.0009 * (1 - smoothInspect * 0.7)
        const sideCamX = -halfFrustumW + 0.082 + swayX
        const sideCamY = -halfFrustumH + 0.082 + swayY
        const inspectCamX = swayX * 0.3
        const inspectCamY = -0.002 + swayY * 0.3
        const camX = THREE.MathUtils.lerp(sideCamX, inspectCamX, smoothInspect)
        const camY = THREE.MathUtils.lerp(sideCamY, inspectCamY, smoothInspect)

        camera.updateMatrixWorld()
        _manualHeldWorldPos
          .set(camX, camY, -holdDist)
          .applyMatrix4(camera.matrixWorld)
        if (deskGroupRef.current) {
          deskGroupRef.current.worldToLocal(_manualHeldWorldPos)
        }
        _manualDeskPos.set(
          manualPosRef.current.x,
          manualBaseY,
          manualPosRef.current.z
        )
        manualGroupRef.current.position.lerpVectors(
          _manualDeskPos,
          _manualHeldWorldPos,
          smoothHold
        )
        _manualBlendLocalQuat.slerpQuaternions(
          _manualHeldLocalQuat,
          _manualInspectLocalQuat,
          smoothInspect
        )
        _manualHeldTargetQuat
          .copy(camera.quaternion)
          .multiply(_manualBlendLocalQuat)
        manualGroupRef.current.quaternion.slerpQuaternions(
          _manualDeskQuat,
          _manualHeldTargetQuat,
          smoothHold
        )
        const targetHeldScale = THREE.MathUtils.lerp(
          MANUAL_HELD_SCALE,
          MANUAL_INSPECT_SCALE,
          smoothInspect
        )
        const curScale = THREE.MathUtils.lerp(
          MANUAL_SCALE,
          targetHeldScale,
          smoothHold
        )
        manualGroupRef.current.scale.setScalar(curScale)
      }
    }

    if (magnifierGroupRef.current) {
      const baseLensY = lensPosRef.current.dragging ? 1.055 : 1.032
      const manX = manualPosRef.current.x
      const manZ = manualPosRef.current.z
      const halfW = MANUAL_BOUNDS_3D.width / 2
      const halfH = MANUAL_BOUNDS_3D.height / 2
      const nearManual =
        !isManualHeldRef.current &&
        lensPosRef.current.x >= manX - halfW - 0.22 &&
        lensPosRef.current.x <= manX + halfW + 0.22 &&
        lensPosRef.current.z >= manZ - halfH - 0.22 &&
        lensPosRef.current.z <= manZ + halfH + 0.22
      const manualHeightAtLensPos = nearManual ? manualBaseY + 0.022 : 0
      const targetLensY = Math.max(baseLensY, manualHeightAtLensPos + 0.036)
      const nextLensY = THREE.MathUtils.lerp(
        magnifierGroupRef.current.position.y || targetLensY,
        targetLensY,
        0.38
      )
      magnifierGroupRef.current.position.set(
        lensPosRef.current.x,
        nextLensY,
        lensPosRef.current.z
      )
    }

    const hasDeskDoc = deskState.documents.some((d) => d.status === 'desk')
    const stApp = stampStateRef.current.APPROVED
    if (stApp.pointerDown) {
      stApp.holdElapsedMs += dt * 1000
    } else if (!stApp.draggingBody && !hasDeskDoc) {
      stApp.targetX = stApp.homeX
      stApp.targetZ = stApp.homeZ
    }
    const appLerpFactor = stApp.draggingBody ? Math.min(1, dt * 32) : 0.28
    stApp.x = THREE.MathUtils.lerp(stApp.x, stApp.targetX, appLerpFactor)
    stApp.z = THREE.MathUtils.lerp(stApp.z, stApp.targetZ, appLerpFactor)
    if (approveStampGroupRef.current) {
      const targetAppY = stApp.draggingBody ? 0.958 : 0.935
      const nextAppY = THREE.MathUtils.lerp(
        approveStampGroupRef.current.position.y || targetAppY,
        targetAppY,
        0.32
      )
      approveStampGroupRef.current.position.set(stApp.x, nextAppY, stApp.z)
    }
    if (approvePlungerRef.current) {
      approvePlungerRef.current.position.y = -stApp.plungerStep * 0.011
    }

    const stShr = stampStateRef.current.SHREDDED
    if (stShr.pointerDown) {
      stShr.holdElapsedMs += dt * 1000
    } else if (!stShr.draggingBody && !hasDeskDoc) {
      stShr.targetX = stShr.homeX
      stShr.targetZ = stShr.homeZ
    }
    const shrLerpFactor = stShr.draggingBody ? Math.min(1, dt * 32) : 0.28
    stShr.x = THREE.MathUtils.lerp(stShr.x, stShr.targetX, shrLerpFactor)
    stShr.z = THREE.MathUtils.lerp(stShr.z, stShr.targetZ, shrLerpFactor)
    if (shredStampGroupRef.current) {
      const targetShrY = stShr.draggingBody ? 0.958 : 0.935
      const nextShrY = THREE.MathUtils.lerp(
        shredStampGroupRef.current.position.y || targetShrY,
        targetShrY,
        0.32
      )
      shredStampGroupRef.current.position.set(stShr.x, nextShrY, stShr.z)
    }
    if (shredPlungerRef.current) {
      shredPlungerRef.current.position.y = -stShr.plungerStep * 0.011
    }

    // 5. Guardrail 4: True 2x Straight Optical Magnifier Lens Refresh (Throttled to ~15 FPS when dragging, immediate on dirty flag)
    const lTex = lensMatRef.current?.map as THREE.CanvasTexture | undefined
    if (lTex && (lensDirtyRef.current || t - lastLensDrawTimeRef.current >= 0.065)) {
      const liveDocs = useDeskStore.getState().documents.map((d) => {
        const livePos = liveDocPosMapRef.current[d.id]
        return livePos
          ? { ...d, x: livePos.x, z: livePos.z, isExpanded: livePos.isExpanded }
          : d
      })
      const liveManualBounds = {
        x: isManualHeldRef.current ? 99 : manualPosRef.current.x,
        z: manualPosRef.current.z,
        width: MANUAL_BOUNDS_3D.width,
        height: MANUAL_BOUNDS_3D.height,
      }
      const docsSig = liveDocs
        .map(
          (d) =>
            `${d.id}:${d.x.toFixed(2)}:${d.z.toFixed(2)}:${d.isExpanded}:${d.stamps.length}`
        )
        .join('|')
      const lensSig = `${lensPosRef.current.x.toFixed(2)}|${lensPosRef.current.z.toFixed(2)}|${liveManualBounds.x.toFixed(2)}|${liveManualBounds.z.toFixed(2)}|${manualPage}|${manualScrollY}|${docsSig}`
      if (lensDirtyRef.current || lTex.userData.lastSig !== lensSig) {
        lensDirtyRef.current = false
        lastLensDrawTimeRef.current = t
        lTex.userData.lastSig = lensSig
        const canvas = lTex.image as HTMLCanvasElement
        const ctx = canvas.getContext('2d')
        if (ctx) {
          drawTrue2xOpticalLensCanvas(
            ctx,
            canvas.width,
            canvas.height,
            lensPosRef.current.x,
            lensPosRef.current.z,
            liveDocs,
            manualPage,
            manualScrollY,
            liveManualBounds
          )
          lTex.needsUpdate = true
        }
      }
    }
  })

  // ==================== INTERACTION HANDLERS ====================

  // 1. Emerging Teletype Slip Physical Grab, Tension-Bend & Tear-Off Handler (Threshold = 0.15 world units!)
  const updateTearingSlipMove = (hit: { x: number; z: number }, nowMs: number) => {
    const grab = slipGrabRef.current
    if (!grab.dragging || grab.torn || !printingDoc) return

    const dtMs = Math.max(4, nowMs - grab.lastTime)
    const rawVx = ((hit.x - grab.lastX) / dtMs) * 1000
    const rawVz = ((hit.z - grab.lastZ) / dtMs) * 1000
    grab.vx = THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(grab.vx, rawVx, 0.55),
      -2.4,
      2.4
    )
    grab.vz = THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(grab.vz, rawVz, 0.55),
      -2.4,
      2.4
    )
    grab.lastX = hit.x
    grab.lastZ = hit.z
    grab.lastTime = nowMs
    grab.curX = hit.x
    grab.curZ = hit.z

    const pullDeltaX = hit.x - grab.startX
    const pullDeltaZ = hit.z - grab.startZ
    const pullDistance = Math.hypot(pullDeltaX, pullDeltaZ)
    grab.pullDeltaX = pullDeltaX
    grab.pullDeltaZ = pullDeltaZ
    grab.tension = THREE.MathUtils.clamp(pullDistance / 0.15, 0, 1)

    if (pullDistance < 0.15) return

    // Exact frame pullDistance >= 0.15 (tension >= 1.0): Tear off at current 3D cursor & handoff drag!
    grab.torn = true
    grab.dragging = false
    grab.pullDeltaX = 0
    grab.pullDeltaZ = 0
    grab.tension = 0
    setIsTearingSlip(false)

    printerRecoilRef.current = 1.0
    playPaperTearSound()
    triggerBobbleShockwave(0.85)

    const spawnX = Math.max(-1.05, Math.min(1.02, hit.x))
    const spawnZ = Math.max(-0.48, Math.min(0.5, hit.z))
    const detached = useDeskStore
      .getState()
      .completePrintingDoc(spawnX, spawnZ)
    if (detached) {
      paperImpulseMapRef.current[detached.id] = {
        vx: grab.vx,
        vz: grab.vz,
        angVel: THREE.MathUtils.clamp(grab.vx * 0.65, -0.35, 0.35),
        hopY: 0.05,
        liftHeight: 0.035,
      }
      liveDocPosMapRef.current[detached.id] = {
        x: spawnX,
        z: spawnZ,
        isExpanded: detached.isExpanded,
      }
      setActiveDragDocId(detached.id)
      lensDirtyRef.current = true
    }
  }

  const finishTearingSlipUp = () => {
    const grab = slipGrabRef.current
    if (!grab.dragging) return
    grab.dragging = false
    setIsTearingSlip(false)
    if (!grab.torn && grab.tension > 0.08) {
      playPaperRustle(false)
    }
  }

  const handlePrintingSlipDown = (e: ThreeEvent<PointerEvent>) => {
    if (!printingDoc || useCameraLookStore.getState().isFreeLookMode) return
    e.stopPropagation()
    const nativeTarget = e.nativeEvent.target as Element & {
      setPointerCapture?: (id: number) => void
    }
    nativeTarget?.setPointerCapture?.(e.pointerId)

    playPaperRustle(false)
    const hit = getDeskLocalHitFromEvent(
      e,
      deskGroupRef.current,
      BASE_MAT_Y + 0.06
    ) ?? {
      x: PRINTER_SLOT_X_3D,
      z: 0.22,
    }

    const grab = slipGrabRef.current
    grab.dragging = true
    grab.torn = false
    grab.startX = hit.x
    grab.startZ = hit.z
    grab.curX = hit.x
    grab.curZ = hit.z
    grab.pullDeltaX = 0
    grab.pullDeltaZ = 0
    grab.tension = 0
    grab.lastX = hit.x
    grab.lastZ = hit.z
    grab.lastTime = e.nativeEvent.timeStamp
    grab.vx = 0
    grab.vz = 0
    setIsTearingSlip(true)
  }

  const handlePrintingSlipMove = (e: ThreeEvent<PointerEvent>) => {
    if (!slipGrabRef.current.dragging) return
    e.stopPropagation()
    const hit = getDeskLocalHitFromEvent(
      e,
      deskGroupRef.current,
      BASE_MAT_Y + 0.06
    )
    if (!hit) return
    updateTearingSlipMove(hit, e.nativeEvent.timeStamp)
  }

  const handlePrintingSlipUp = (e: ThreeEvent<PointerEvent>) => {
    if (!slipGrabRef.current.dragging) return
    e.stopPropagation()
    finishTearingSlipUp()
  }

  const handleDeskCatcherMove = (e: ThreeEvent<PointerEvent>) => {
    if (slipGrabRef.current.dragging) {
      e.stopPropagation()
      const hit = getDeskLocalHitFromEvent(
        e,
        deskGroupRef.current,
        BASE_MAT_Y + 0.06
      )
      if (hit) updateTearingSlipMove(hit, e.nativeEvent.timeStamp)
      return
    }
    if (stampStateRef.current.APPROVED.pointerDown) {
      handleStampMoveInternal('APPROVED', e)
      return
    }
    if (stampStateRef.current.SHREDDED.pointerDown) {
      handleStampMoveInternal('SHREDDED', e)
      return
    }
    if (manualPosRef.current.pointerDown) {
      handleManualDragMove(e)
      return
    }
    if (activeDragDocId) {
      e.stopPropagation()
      const hit = getDeskLocalHitFromEvent(e, deskGroupRef.current)
      if (hit) {
        sharedDragHandlersRef.current[activeDragDocId]?.move(
          hit,
          e.nativeEvent.timeStamp
        )
      }
    }
  }

  const handleDeskCatcherUp = (e: ThreeEvent<PointerEvent>) => {
    if (slipGrabRef.current.dragging) {
      e.stopPropagation()
      finishTearingSlipUp()
    }
    if (stampStateRef.current.APPROVED.pointerDown) {
      handleStampUpInternal('APPROVED', e)
    }
    if (stampStateRef.current.SHREDDED.pointerDown) {
      handleStampUpInternal('SHREDDED', e)
    }
    if (manualPosRef.current.pointerDown) {
      handleManualDragUp(e)
    }
    if (activeDragDocId) {
      e.stopPropagation()
      sharedDragHandlersRef.current[activeDragDocId]?.up(
        e.nativeEvent.timeStamp
      )
    }
  }

  // 2. 2x Optical Magnifying Glass Drag Handlers (Ray-Plane Isolated)
  const handleLensPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return
    e.stopPropagation()
    const target = e.target as Element & {
      setPointerCapture?: (id: number) => void
    }
    target.setPointerCapture?.(e.pointerId)
    lensPosRef.current.dragging = true
    playPaperRustle(false)
    const hit = getDeskLocalHitFromEvent(e, deskGroupRef.current, 0.975)
    if (hit) {
      lensDragOffsetRef.current = {
        dx: hit.x - lensPosRef.current.x,
        dz: hit.z - lensPosRef.current.z,
      }
    }
    const handleWinUp = () => {
      lensPosRef.current.dragging = false
      lensDirtyRef.current = true
      window.removeEventListener('pointerup', handleWinUp)
      window.removeEventListener('pointercancel', handleWinUp)
    }
    window.addEventListener('pointerup', handleWinUp)
    window.addEventListener('pointercancel', handleWinUp)
  }

  const handleLensPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!lensPosRef.current.dragging) return
    if ((e.nativeEvent.buttons & 1) === 0) {
      lensPosRef.current.dragging = false
      lensDirtyRef.current = true
      return
    }
    e.stopPropagation()
    const hit = getDeskLocalHitFromEvent(e, deskGroupRef.current, 0.975)
    if (!hit) return
    lensPosRef.current.x = Math.max(
      -1.05,
      Math.min(1.05, hit.x - lensDragOffsetRef.current.dx)
    )
    lensPosRef.current.z = Math.max(
      -0.48,
      Math.min(0.52, hit.z - lensDragOffsetRef.current.dz)
    )
    lensDirtyRef.current = true
  }

  const handleLensPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!lensPosRef.current.dragging) return
    e.stopPropagation()
    const target = e.target as Element & {
      releasePointerCapture?: (id: number) => void
    }
    target.releasePointerCapture?.(e.pointerId)
    lensPosRef.current.dragging = false
    lensDirtyRef.current = true
  }

  // 2B. Draggable 7-Page Soviet Master Manual Handlers (Unified Hold & Drag Anywhere on Manual vs. Quick Click for Tabs/Buttons)
  const scrollManual = (dir: 1 | -1) => {
    playScrollTickSound()
    setManualScrollY((prev) => Math.max(0, Math.min(360, prev + dir * 36)))
  }

  const handleManualWheel = (e: ThreeEvent<WheelEvent>) => {
    e.stopPropagation()
    scrollManual(e.deltaY > 0 ? 1 : -1)
  }

  const handleManualDragDown = (e: ThreeEvent<PointerEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return
    e.stopPropagation()
    if (isManualHeldRef.current) return
    const target = e.target as Element & {
      setPointerCapture?: (id: number) => void
      releasePointerCapture?: (id: number) => void
    }
    target?.setPointerCapture?.(e.pointerId)
    const mp = manualPosRef.current
    mp.pointerDown = true
    mp.pointerId = e.pointerId
    mp.downClientX = e.clientX
    mp.downClientY = e.clientY
    mp.downTimeMs = e.nativeEvent.timeStamp
    mp.dragging = false
    mp.suppressNextClick = false
    const hit = getDeskLocalHitFromEvent(
      e,
      deskGroupRef.current,
      BASE_MAT_Y + 0.012
    )
    if (hit) {
      mp.dx = hit.x - mp.x
      mp.dz = hit.z - mp.z
    } else {
      mp.dx = 0
      mp.dz = 0
    }
    const handleWinUp = () => {
      if (mp.pointerDown) {
        const wasDragging = mp.dragging
        mp.pointerDown = false
        mp.pointerId = null
        mp.dragging = false
        if (wasDragging) {
          mp.suppressNextClick = true
          playPaperRustle(true)
          lensDirtyRef.current = true
          window.setTimeout(() => {
            manualPosRef.current.suppressNextClick = false
          }, 60)
        }
      }
      window.removeEventListener('pointerup', handleWinUp)
      window.removeEventListener('pointercancel', handleWinUp)
    }
    window.addEventListener('pointerup', handleWinUp)
    window.addEventListener('pointercancel', handleWinUp)
  }

  const handleManualDragMove = (e: ThreeEvent<PointerEvent>) => {
    const mp = manualPosRef.current
    if (!mp.pointerDown) return
    if ((e.nativeEvent.buttons & 1) === 0) {
      mp.pointerDown = false
      mp.pointerId = null
      mp.dragging = false
      return
    }
    e.stopPropagation()
    const moveDistPx = Math.hypot(
      e.clientX - mp.downClientX,
      e.clientY - mp.downClientY
    )
    const heldMs = e.nativeEvent.timeStamp - mp.downTimeMs
    if (!mp.dragging && (moveDistPx > 5 || (heldMs > 160 && moveDistPx > 1.5))) {
      mp.dragging = true
      mp.suppressNextClick = true
      playPaperRustle(false)
    }
    if (!mp.dragging) return
    const hit = getDeskLocalHitFromEvent(
      e,
      deskGroupRef.current,
      BASE_MAT_Y + 0.012
    )
    if (!hit) return
    mp.x = Math.max(-0.88, Math.min(0.88, hit.x - mp.dx))
    mp.z = Math.max(-0.28, Math.min(0.38, hit.z - mp.dz))
    lensDirtyRef.current = true
  }

  const handleManualDragUp = (e: ThreeEvent<PointerEvent>) => {
    const mp = manualPosRef.current
    if (!mp.pointerDown) return
    e.stopPropagation()
    const target = e.target as Element & {
      releasePointerCapture?: (id: number) => void
    }
    target?.releasePointerCapture?.(e.pointerId)
    const moveDistPx = Math.hypot(
      e.clientX - mp.downClientX,
      e.clientY - mp.downClientY
    )
    const heldMs = e.nativeEvent.timeStamp - mp.downTimeMs
    const wasDragging = mp.dragging || moveDistPx > 5 || (heldMs >= 160 && moveDistPx > 1.5)
    mp.pointerDown = false
    mp.pointerId = null
    mp.dragging = false
    if (wasDragging) {
      mp.suppressNextClick = true
      playPaperRustle(true)
      lensDirtyRef.current = true
      window.setTimeout(() => {
        manualPosRef.current.suppressNextClick = false
      }, 60)
    }
  }

  // 3. Unified Whole-Stamp Hitbox Handlers (Hold & Drag to Move vs. Quick Click to Stamp!)
  const isOverAnyDeskDoc = (x: number, z: number): boolean => {
    const deskDocs = useDeskStore
      .getState()
      .documents.filter((d) => d.status === 'desk')
    return deskDocs.some((doc) => {
      const livePos = liveDocPosMapRef.current[doc.id] ?? {
        x: doc.x,
        z: doc.z,
        isExpanded: doc.isExpanded,
      }
      const docW = livePos.isExpanded ? PAPER_EXPANDED_W_3D : PAPER_COMPACT_W_3D
      const docH = livePos.isExpanded ? PAPER_EXPANDED_H_3D : PAPER_COMPACT_H_3D
      return (
        x >= livePos.x - docW / 2 - 0.06 &&
        x <= livePos.x + docW / 2 + 0.06 &&
        z >= livePos.z - docH / 2 - 0.06 &&
        z <= livePos.z + docH / 2 + 0.06
      )
    })
  }

  // Magnetic Stamp Holder Snap: snaps stamp cleanly into its dedicated holder slot if released near the dock,
  // colliding with the other stamp, or dropped off-paper so stamps never clutter the desk!
  const snapStampToHolderIfNearOrCluttered = (type: StampType): boolean => {
    const st = stampStateRef.current[type]
    const otherType: StampType = type === 'APPROVED' ? 'SHREDDED' : 'APPROVED'
    const otherSt = stampStateRef.current[otherType]

    const distToOwnHome = Math.hypot(
      st.targetX - st.homeX,
      st.targetZ - st.homeZ
    )
    const inDockZone =
      st.targetX >= 0.02 &&
      st.targetX <= 0.58 &&
      st.targetZ >= -0.46 &&
      st.targetZ <= 0.02
    const collidingWithOtherStamp =
      Math.hypot(st.targetX - otherSt.targetX, st.targetZ - otherSt.targetZ) <
      0.16
    const overPaper = isOverAnyDeskDoc(st.targetX, st.targetZ)

    if (
      distToOwnHome <= 0.28 ||
      inDockZone ||
      collidingWithOtherStamp ||
      !overPaper
    ) {
      st.targetX = st.homeX
      st.targetZ = st.homeZ
      return true
    }
    return false
  }

  const handleStampMoveInternal = (
    type: StampType,
    e: ThreeEvent<PointerEvent>
  ) => {
    const st = stampStateRef.current[type]
    if (!st.pointerDown) return
    if ((e.nativeEvent.buttons & 1) === 0) {
      st.pointerDown = false
      st.pointerId = null
      st.holdElapsedMs = 0
      st.draggingBody = false
      snapStampToHolderIfNearOrCluttered(type)
      return
    }
    e.stopPropagation()
    const moveDistPx = Math.hypot(
      e.clientX - st.downClientX,
      e.clientY - st.downClientY
    )
    if (!st.draggingBody && moveDistPx > 4) {
      st.draggingBody = true
      playDetentClick(1)
    }
    if (!st.draggingBody) return
    const hit = getDeskLocalHitFromEvent(e, deskGroupRef.current, 0.935)
    if (!hit) return
    const nextX = Math.max(-1.02, Math.min(1.02, hit.x - st.dx))
    const nextZ = Math.max(-0.48, Math.min(0.52, hit.z - st.dz))

    // Live magnetic pull when hovering close to the stamp holder dock
    const distToHome = Math.hypot(nextX - st.homeX, nextZ - st.homeZ)
    const overDockTray =
      nextX >= 0.08 && nextX <= 0.52 && nextZ >= -0.36 && nextZ <= -0.08
    if (distToHome <= 0.14 || overDockTray) {
      st.targetX = THREE.MathUtils.lerp(nextX, st.homeX, 0.65)
      st.targetZ = THREE.MathUtils.lerp(nextZ, st.homeZ, 0.65)
    } else {
      st.targetX = nextX
      st.targetZ = nextZ
    }
  }

  const handleStampUpInternal = (
    type: StampType,
    e: ThreeEvent<PointerEvent>
  ) => {
    const st = stampStateRef.current[type]
    if (!st.pointerDown) return
    e.stopPropagation()
    const target = e.target as Element & {
      releasePointerCapture?: (id: number) => void
    }
    target?.releasePointerCapture?.(e.pointerId)
    const moveDistPx = Math.hypot(
      e.clientX - st.downClientX,
      e.clientY - st.downClientY
    )
    const wasDrag = st.draggingBody || moveDistPx > 5
    st.pointerDown = false
    st.pointerId = null
    st.holdElapsedMs = 0
    st.draggingBody = false

    if (wasDrag) {
      // Hold & Drag Mode: if released near the holder (or off-paper / colliding), snap cleanly into its holder slot!
      const snappedHome = snapStampToHolderIfNearOrCluttered(type)
      if (snappedHome) {
        playSwitchClank(false)
      } else {
        playDetentClick(0)
      }
      return
    }

    // Quick Click (< 5px movement):
    // Bonus convenience: if the stamp is sitting away from any paper (e.g. in its ink cradle/dock) and there is a paper on the desk,
    // automatically slide it onto the paper and stamp it (or bring it over the paper) so clicking in the dock never feels wasted!
    if (!isOverAnyDeskDoc(st.x, st.z)) {
      const deskDocs = useDeskStore
        .getState()
        .documents.filter((d) => d.status === 'desk')
      const topDoc = deskDocs[deskDocs.length - 1]
      if (topDoc) {
        const livePos = liveDocPosMapRef.current[topDoc.id] ?? {
          x: topDoc.x,
          z: topDoc.z,
        }
        const targetPaperX =
          livePos.x + (type === 'APPROVED' ? -0.025 : 0.025)
        const targetPaperZ = livePos.z + 0.025
        st.x = targetPaperX
        st.z = targetPaperZ
        st.targetX = targetPaperX
        st.targetZ = targetPaperZ
      }
    }

    // Fire the Stamp Plunger Animation (stampDown) & apply ink onto the directive paper!
    st.plungerStep = 3
    execute3DStampImpact(type)
    window.setTimeout(() => {
      st.plungerStep = 0
    }, 160)
  }

  const makeUnifiedStampHandlers = (type: StampType) => ({
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      if (useCameraLookStore.getState().isFreeLookMode) return
      e.stopPropagation()
      const target = e.target as Element & {
        setPointerCapture?: (id: number) => void
        releasePointerCapture?: (id: number) => void
      }
      target?.setPointerCapture?.(e.pointerId)
      const st = stampStateRef.current[type]
      st.pointerDown = true
      st.pointerId = e.pointerId
      st.downClientX = e.clientX
      st.downClientY = e.clientY
      st.downTimeMs = e.nativeEvent.timeStamp
      st.holdElapsedMs = 0
      st.draggingBody = false
      const hit = getDeskLocalHitFromEvent(e, deskGroupRef.current, 0.935)
      if (hit) {
        st.dx = hit.x - st.x
        st.dz = hit.z - st.z
      } else {
        st.dx = 0
        st.dz = 0
      }
      const handleWinUp = () => {
        if (st.pointerDown) {
          const wasDrag = st.draggingBody
          st.pointerDown = false
          st.pointerId = null
          st.holdElapsedMs = 0
          st.draggingBody = false
          if (wasDrag) {
            const snappedHome = snapStampToHolderIfNearOrCluttered(type)
            if (snappedHome) {
              playSwitchClank(false)
            } else {
              playDetentClick(0)
            }
          }
        }
        window.removeEventListener('pointerup', handleWinUp)
        window.removeEventListener('pointercancel', handleWinUp)
      }
      window.addEventListener('pointerup', handleWinUp)
      window.addEventListener('pointercancel', handleWinUp)
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      handleStampMoveInternal(type, e)
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      handleStampUpInternal(type, e)
    },
    onPointerCancel: (e: ThreeEvent<PointerEvent>) => {
      const st = stampStateRef.current[type]
      if (!st.pointerDown) return
      e.stopPropagation()
      st.pointerDown = false
      st.pointerId = null
      st.holdElapsedMs = 0
      st.draggingBody = false
    },
    onDoubleClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      const st = stampStateRef.current[type]
      st.targetX = st.homeX
      st.targetZ = st.homeZ
      playSwitchClank(false)
    },
  })

  // 4. 5-Detent УНИЧТОЖИТЕЛЬ-84 Shredder Lever Handlers (Supports both 5-step drag & click-per-step, NEVER auto-shreds!)
  const advanceShredBySteps = (stepsToAdvance: number) => {
    const store = useDeskStore.getState()
    const doc = store.documents.find((d) => d.status === 'loaded_in_shredder')
    if (!doc) {
      playDetentClick(1)
      return
    }
    const nextProgress = store.advanceShredProgress(doc.id, stepsToAdvance * 20)
    shredDragRef.current.jitterIndex =
      (shredDragRef.current.jitterIndex + 1) % JITTER_CYCLE.length
    setShredJitterX(JITTER_CYCLE[shredDragRef.current.jitterIndex])
    playShredGrindCrunch(nextProgress)
    triggerBobbleShockwave(0.85)

    if (nextProgress >= 100) {
      playShredFinalClunk()
      setFallingStrips({
        paperHex: PAPER_COLOR_HEX[doc.paperColor],
        inkHex: INK_COLOR_HEX[doc.inkColor],
      })
      setShredJitterX(0)
      store.evaluateShreddedDocument(doc.id)
      window.setTimeout(() => setFallingStrips(null), 650)
    }
  }

  const handleShredLeverDown = (e: ThreeEvent<PointerEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return
    e.stopPropagation()
    const target = e.target as Element & {
      setPointerCapture?: (id: number) => void
    }
    target.setPointerCapture?.(e.pointerId)
    shredDragRef.current.dragging = true
    shredDragRef.current.startY = e.clientY
    shredDragRef.current.previousStep = 0
    playDetentClick(0)
  }

  const handleShredLeverMove = (e: ThreeEvent<PointerEvent>) => {
    if (!shredDragRef.current.dragging) return
    e.stopPropagation()
    const deltaY = Math.max(0, e.clientY - shredDragRef.current.startY)
    const step = Math.min(5, Math.floor(deltaY / 14))
    if (step === shredDragRef.current.previousStep) return

    const increased = step > shredDragRef.current.previousStep
    const stepsGained = step - shredDragRef.current.previousStep
    shredDragRef.current.previousStep = step

    if (shredLeverKnobRef.current) {
      shredLeverKnobRef.current.position.z = -0.09 + step * 0.036
      shredLeverKnobRef.current.rotation.x = 0.25 + step * 0.14
    }

    if (!increased) {
      playDetentClick(step)
      return
    }

    advanceShredBySteps(stepsGained)
  }

  const handleShredLeverUp = (e: ThreeEvent<PointerEvent>) => {
    if (!shredDragRef.current.dragging) return
    e.stopPropagation()
    const wasClickWithoutDrag = shredDragRef.current.previousStep === 0
    shredDragRef.current.dragging = false
    shredDragRef.current.previousStep = 0

    if (wasClickWithoutDrag) {
      if (shredLeverKnobRef.current) {
        shredLeverKnobRef.current.position.z = -0.02
        shredLeverKnobRef.current.rotation.x = 0.65
      }
      advanceShredBySteps(1)
      window.setTimeout(() => {
        if (shredLeverKnobRef.current) {
          shredLeverKnobRef.current.position.z = -0.09
          shredLeverKnobRef.current.rotation.x = 0.25
        }
        setShredJitterX(0)
      }, 140)
      return
    }

    if (shredLeverKnobRef.current) {
      shredLeverKnobRef.current.position.z = -0.09
      shredLeverKnobRef.current.rotation.x = 0.25
    }
    setShredJitterX(0)
    playSwitchClank(false)
  }

  const shredProgress = loadedDoc?.shredProgress ?? 0
  const stripSource = fallingStrips
    ? {
        progress: 100,
        paperHex: fallingStrips.paperHex,
        inkHex: fallingStrips.inkHex,
      }
    : loadedDoc
      ? {
          progress: shredProgress,
          paperHex: PAPER_COLOR_HEX[loadedDoc.paperColor],
          inkHex: INK_COLOR_HEX[loadedDoc.inkColor],
        }
      : null

  // Positioned directly in front of and below the operator's seated position ([0/ESC] CHAIR)
  // at full 1:1 scale (no downscaling on the tabletop or #1d2b26 green mat!)
  return (
    <group
      ref={deskGroupRef}
      position={[0, -0.164, 1.48]}
      rotation={[0, 0, 0]}
      scale={[1, 1, 1]}
    >
      {/* Guardrail 3: Invisible Horizontal Desk Drag-Plane for Continuous Raycast & Mid-Drag Tear Handoff */}
      <mesh
        position={[0, BASE_MAT_Y + 0.045, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={activeDragDocId !== null || isTearingSlip}
        onPointerMove={handleDeskCatcherMove}
        onPointerUp={handleDeskCatcherUp}
        onPointerCancel={handleDeskCatcherUp}
      >
        <planeGeometry args={[3.4, 2.4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* ============================================================
          1. EXPANDED SOVIET SENIOR INSPECTOR COMMAND DESK (2.48m × 1.36m)
          WITH WEATHERED MAHOGANY TRIM, WORN BAIZE MAT (#16241f), BRASS CORNER BRACKETS,
          NKVD GREEN-GLASS BANKER'S LAMP SPOTLIGHT, 4 GLOWING ИН-14 NIXIE TUBES & BRAIDED CABLES
         ============================================================ */}
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.36, 0.88, 1.26]} />
        <meshStandardMaterial
          color="#23312b"
          roughness={0.45}
          metalness={0.65}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
          roughnessMap={ironTex.roughnessMap}
        />
      </mesh>
      <mesh position={[0, 0.89, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.48, 0.055, 1.36]} />
        <meshStandardMaterial
          color="#6b3e28"
          map={mahoganyTex.map}
          bumpMap={mahoganyTex.bumpMap}
          bumpScale={0.005}
          roughnessMap={mahoganyTex.roughnessMap}
          roughness={0.52}
          metalness={0.12}
        />
      </mesh>
      {/* Stepped Carved Mahogany Perimeter Molding Rails */}
      <mesh position={[0, 0.922, -0.66]} castShadow receiveShadow>
        <boxGeometry args={[2.48, 0.022, 0.04]} />
        <meshStandardMaterial
          color="#5c3422"
          map={mahoganyTex.map}
          bumpMap={mahoganyTex.bumpMap}
          bumpScale={0.005}
          roughnessMap={mahoganyTex.roughnessMap}
          roughness={0.52}
        />
      </mesh>
      <mesh position={[0, 0.92, 0.66]} castShadow receiveShadow>
        <boxGeometry args={[2.48, 0.016, 0.04]} />
        <meshStandardMaterial
          color="#5c3422"
          map={mahoganyTex.map}
          bumpMap={mahoganyTex.bumpMap}
          bumpScale={0.005}
          roughnessMap={mahoganyTex.roughnessMap}
          roughness={0.52}
        />
      </mesh>
      <mesh position={[-1.22, 0.922, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.04, 0.022, 1.32]} />
        <meshStandardMaterial
          color="#5c3422"
          map={mahoganyTex.map}
          bumpMap={mahoganyTex.bumpMap}
          bumpScale={0.005}
          roughnessMap={mahoganyTex.roughnessMap}
          roughness={0.52}
        />
      </mesh>
      <mesh position={[1.22, 0.922, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.04, 0.022, 1.32]} />
        <meshStandardMaterial
          color="#5c3422"
          map={mahoganyTex.map}
          bumpMap={mahoganyTex.bumpMap}
          bumpScale={0.005}
          roughnessMap={mahoganyTex.roughnessMap}
          roughness={0.52}
        />
      </mesh>

      {/* Worn Soviet Inspection Mat (#16241f with cross-grain leather, coffee-mug rings & scuffs) */}
      <mesh position={[0, 0.92, 0.02]} receiveShadow>
        <boxGeometry args={[2.28, 0.008, 1.2]} />
        <meshStandardMaterial
          color="#ffffff"
          map={wornMatTex.map}
          bumpMap={wornMatTex.bumpMap}
          bumpScale={0.004}
          roughnessMap={wornMatTex.roughnessMap}
          roughness={0.85}
        />
      </mesh>

      {/* Inlaid Double-Brass Pinstripe Border on the Green Mat */}
      <mesh position={[0, 0.9245, -0.56]} receiveShadow>
        <boxGeometry args={[2.24, 0.002, 0.006]} />
        <meshStandardMaterial
          color="#b8a46b"
          metalness={0.85}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
        />
      </mesh>
      <mesh position={[0, 0.9245, 0.6]} receiveShadow>
        <boxGeometry args={[2.24, 0.002, 0.006]} />
        <meshStandardMaterial
          color="#b8a46b"
          metalness={0.85}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
        />
      </mesh>
      <mesh position={[-1.12, 0.9245, 0.02]} receiveShadow>
        <boxGeometry args={[0.006, 0.002, 1.16]} />
        <meshStandardMaterial
          color="#b8a46b"
          metalness={0.85}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
        />
      </mesh>
      <mesh position={[1.12, 0.9245, 0.02]} receiveShadow>
        <boxGeometry args={[0.006, 0.002, 1.16]} />
        <meshStandardMaterial
          color="#b8a46b"
          metalness={0.85}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
        />
      </mesh>

      {/* 4 Heavy Riveted Brushed-Brass Corner Brackets on the Green Mat */}
      {(
        [
          [-1.1, -0.54],
          [1.1, -0.54],
          [-1.1, 0.58],
          [1.1, 0.58],
        ] as const
      ).map(([cx, cz], idx) => (
        <group key={idx} position={[cx, 0.926, cz]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.08, 0.005, 0.08]} />
            <meshStandardMaterial
              color="#8c7a4b"
              metalness={0.85}
              roughness={0.28}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
              roughnessMap={brassTex.roughnessMap}
            />
          </mesh>
          <mesh position={[0, 0.004, 0]} castShadow>
            <cylinderGeometry args={[0.008, 0.008, 0.006, 8]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.9}
              roughness={0.22}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
        </group>
      ))}

      {/* Heavy Ribbed Rubber/Braided Power Cables snaking across the back of the desk into Brass Deck Grommets */}
      <group>
        <mesh geometry={deskCableGeometries.teletypeCable} castShadow receiveShadow>
          <meshStandardMaterial
            color="#151917"
            roughness={0.68}
            metalness={0.25}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>
        <mesh geometry={deskCableGeometries.lampCable} castShadow receiveShadow>
          <meshStandardMaterial
            color="#1c1612"
            roughness={0.72}
            metalness={0.2}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>
        <mesh geometry={deskCableGeometries.shredderCable} castShadow receiveShadow>
          <meshStandardMaterial
            color="#151917"
            roughness={0.68}
            metalness={0.25}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>
        {/* 3 Flanged Brushed-Brass Deck Grommets Flush with Desk Surface */}
        {(
          [
            [-0.86, 0.08],
            [-0.98, -0.55],
            [0.9, -0.44],
          ] as const
        ).map(([gx, gz], gIdx) => (
          <group key={gIdx} position={[gx, 0.925, gz]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.022, 0.026, 0.008, 12]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.85}
                roughness={0.28}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
            <mesh position={[0, 0.004, 0]}>
              <cylinderGeometry args={[0.014, 0.014, 0.006, 10]} />
              <meshStandardMaterial color="#0d110f" roughness={0.9} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Row of 4 Glowing Orange Glass ИН-14 Nixie-Style Indicator Tubes on Rear Console Riser next to ПУНКТ №4 */}
      <group position={[-0.76, 0.926, -0.49]} rotation={[0, 0.16, 0]}>
        {/* Bolted Cast-Iron & Brass Nixie Manifold Base */}
        <mesh position={[0, 0.014, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.24, 0.028, 0.072]} />
          <meshStandardMaterial
            color="#18211b"
            metalness={0.65}
            roughness={0.45}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        <mesh position={[0, 0.029, 0]} castShadow>
          <boxGeometry args={[0.22, 0.006, 0.056]} />
          <meshStandardMaterial
            color="#8c7a4b"
            metalness={0.85}
            roughness={0.28}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        {[0, 1, 2, 3].map((tIdx) => {
          const tx = -0.078 + tIdx * 0.052
          return (
            <group key={tIdx} position={[tx, 0.032, 0]}>
              {/* Ceramic & Brass Tube Socket Collar */}
              <mesh position={[0, 0.008, 0]} castShadow>
                <cylinderGeometry args={[0.018, 0.02, 0.016, 12]} />
                <meshStandardMaterial
                  color="#b8a46b"
                  metalness={0.85}
                  roughness={0.28}
                  bumpMap={brassTex.bumpMap}
                  bumpScale={0.005}
                />
              </mesh>
              {/* Glowing Internal Orange Cathode Digit Plane */}
              <mesh position={[0, 0.044, 0.002]}>
                <planeGeometry args={[0.026, 0.044]} />
                <meshBasicMaterial
                  map={nixieDigitTextures[tIdx]}
                  transparent
                  toneMapped={false}
                />
              </mesh>
              {/* Internal Anode Wire Cage Ring */}
              <mesh position={[0, 0.044, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.013, 0.0012, 6, 10]} />
                <meshStandardMaterial
                  color="#ff8c24"
                  emissive="#ff5500"
                  emissiveIntensity={0.85}
                  roughness={0.3}
                />
              </mesh>
              {/* Cylindrical ИН-14 Glass Envelope & Top Exhaust Pip */}
              <mesh position={[0, 0.044, 0]}>
                <cylinderGeometry args={[0.017, 0.017, 0.058, 12]} />
                <meshStandardMaterial
                  color="#ffd8b0"
                  emissive="#ff6600"
                  emissiveIntensity={0.28}
                  transparent
                  opacity={0.32}
                  roughness={0.12}
                  metalness={0.1}
                />
              </mesh>
              <mesh position={[0, 0.075, 0]}>
                <sphereGeometry args={[0.014, 10, 8]} />
                <meshStandardMaterial
                  color="#ffd8b0"
                  emissive="#ff6600"
                  emissiveIntensity={0.22}
                  transparent
                  opacity={0.35}
                  roughness={0.12}
                />
              </mesh>
            </group>
          )
        })}
      </group>

      {/* Classic NKVD / Banker's Green-Glass Goose-Neck Desk Lamp (Far-Left Rear Corner behind ПРАВДА-84, away from ПУНКТ №4 ticker) */}
      <object3D ref={bankersLampTargetRef} position={[-0.58, 0.92, -0.04]} />
      <group position={[-0.98, 0.926, -0.46]} rotation={[0, 0.36, 0]}>
        {deskPropNodes.bankersLamp && (
          <primitive object={deskPropNodes.bankersLamp} />
        )}
        {/* Heavy Cast-Brass Stepped Lamp Base */}
        <mesh position={[0, 0.014, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.075, 0.09, 0.028, 16]} />
          <meshStandardMaterial
            color="#8c7a4b"
            metalness={0.85}
            roughness={0.28}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
            roughnessMap={brassTex.roughnessMap}
          />
        </mesh>
        <mesh position={[0, 0.034, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.048, 0.062, 0.016, 14]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.85}
            roughness={0.25}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        {/* Pull-chain toggle switch on base */}
        <mesh position={[0.045, 0.028, 0.03]} castShadow>
          <cylinderGeometry args={[0.006, 0.006, 0.018, 8]} />
          <meshStandardMaterial color="#0d110f" roughness={0.6} />
        </mesh>
        {/* Articulated Brass Goose-Neck Stem */}
        <mesh
          position={[0, 0.11, -0.02]}
          rotation={[-0.18, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.011, 0.013, 0.16, 10]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.85}
            roughness={0.25}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        <mesh
          position={[0, 0.19, 0.02]}
          rotation={[0.68, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.01, 0.011, 0.11, 10]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.85}
            roughness={0.25}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        {/* Emerald-Green Banker's Glass Shade + Focused Shadow-Casting Warm-Emerald SpotLight Pool */}
        <group position={[0, 0.215, 0.08]} rotation={[0.32, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry
              args={[0.048, 0.056, 0.18, 12, 1, false, 0, Math.PI]}
            />
            <meshStandardMaterial
              color="#1b6e32"
              emissive="#145224"
              emissiveIntensity={0.75}
              roughness={0.2}
              metalness={0.1}
            />
          </mesh>
          <mesh position={[0, -0.012, 0]}>
            <sphereGeometry args={[0.022, 10, 10]} />
            <meshStandardMaterial
              color="#ffdf9e"
              emissive="#68ff8a"
              emissiveIntensity={1.8}
            />
          </mesh>
          <spotLight
            ref={bankersLampSpotRef}
            position={[0, -0.03, 0.03]}
            color="#68ff8a"
            intensity={2.4}
            distance={1.8}
            angle={0.75}
            penumbra={0.8}
            decay={1.3}
          />
        </group>
      </group>

      {/* Soviet Bureaucracy Props: Cast-Iron Pen Holder with 2 Brass Fountain Pens & Red Soviet Desk Flag */}
      <group position={[0.56, 0.926, -0.45]}>
        {/* Cast-iron inkwell & pen stand */}
        <mesh position={[0, 0.014, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.11, 0.028, 0.075]} />
          <meshStandardMaterial
            color="#18211b"
            roughness={0.45}
            metalness={0.65}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        {/* Two angled brass/Bakelite fountain pens */}
        <mesh
          position={[-0.024, 0.055, 0]}
          rotation={[0.28, 0, -0.22]}
          castShadow
        >
          <cylinderGeometry args={[0.005, 0.003, 0.095, 8]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.85}
            roughness={0.25}
          />
        </mesh>
        <mesh
          position={[0.018, 0.055, 0]}
          rotation={[0.24, 0, 0.2]}
          castShadow
        >
          <cylinderGeometry args={[0.005, 0.003, 0.095, 8]} />
          <meshStandardMaterial color="#2b1a12" roughness={0.45} />
        </mesh>
        {/* Miniature Red Enamel Soviet Desk Flag on Brass Pole */}
        <group position={[0.08, 0, 0.01]}>
          <mesh position={[0, 0.008, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.024, 0.028, 0.016, 12]} />
            <meshStandardMaterial
              color="#8c7a4b"
              metalness={0.85}
              roughness={0.25}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          <mesh position={[0, 0.095, 0]} castShadow>
            <cylinderGeometry args={[0.003, 0.0035, 0.17, 8]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0, 0.185, 0]} castShadow>
            <sphereGeometry args={[0.007, 8, 8]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>
          <mesh
            position={[0.032, 0.145, 0]}
            rotation={[0, -0.15, 0]}
            castShadow
          >
            <boxGeometry args={[0.062, 0.042, 0.004]} />
            <meshStandardMaterial
              color="#ff2a2a"
              emissive="#8b1e1e"
              emissiveIntensity={0.35}
              roughness={0.5}
            />
          </mesh>
        </group>
      </group>

      {/* PART 2: Interactive Bobbleheads of Komrad Kristianov & Komrad Oleg! */}
      <KomradBobbleheads3D shockwaveRef={bobbleShockwaveRef} />

      {/* 3D Illuminated 6-Lamp Master Annunciator Strip (`ТАБЛО ТРЕВОГИ`) Mounted Above the Rear Desk Console in Peripheral View */}
      <group position={[-0.07, 1.036, -0.562]} rotation={[-0.58, 0, 0]}>
        {/* Heavy Cast-Iron & Brushed-Brass Annunciator Housing Bar */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.92, 0.068, 0.028]} />
          <meshStandardMaterial
            color="#121815"
            roughness={0.44}
            metalness={0.68}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        <mesh position={[0, 0, 0.004]} castShadow>
          <boxGeometry args={[0.904, 0.058, 0.024]} />
          <meshStandardMaterial
            color="#8c7a4b"
            metalness={0.85}
            roughness={0.28}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>
        {annunciatorTileSpecs.map((tile, idx) => {
          const tx = -0.37 + idx * 0.148
          return (
            <group key={tile.id} position={[tx, 0, 0.017]}>
              {/* Frosted-Glass Backlit Warning Tile (Hover displays 1-line Tactical Remedy Hint on Desk Ticker & K.O.M.R.A.D.-84) */}
              <mesh
                onPointerOver={(e) => {
                  e.stopPropagation()
                  useGameStore
                    .getState()
                    .setHoveredDiagnosticId(tile.id as DiagnosticAlarmId)
                }}
                onPointerOut={(e) => {
                  e.stopPropagation()
                  const g = useGameStore.getState()
                  if (g.hoveredDiagnosticId === tile.id) {
                    g.setHoveredDiagnosticId(null)
                  }
                }}
              >
                <planeGeometry args={[0.138, 0.048]} />
                <meshStandardMaterial
                  ref={(el) => {
                    annunciatorMatRefs.current[idx] = el
                  }}
                  map={tile.texture}
                  color="#22332a"
                  emissive="#183b26"
                  emissiveMap={tile.texture}
                  emissiveIntensity={0.22}
                  roughness={0.32}
                  metalness={0.08}
                />
              </mesh>
            </group>
          )
        })}
      </group>

      {/* Tilted Status & Verdict Header Console Bar with Cast-Brass USSR State Emblem Medallion (Framed cleanly between x: -0.58 and x: +0.44!) */}
      <group position={[-0.07, 0.946, -0.51]} rotation={[-0.82, 0, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.88, 0.12, 0.032]} />
          <meshStandardMaterial
            color="#0d110f"
            roughness={0.45}
            metalness={0.65}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        {/* Cast-Brass USSR State Emblem Medallion on Top Center of Status Console */}
        <group position={[0, 0.072, 0.012]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.028, 0.032, 0.012, 16]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.88}
              roughness={0.22}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          <mesh position={[0, 0, 0.008]}>
            <circleGeometry args={[0.016, 5]} />
            <meshStandardMaterial
              color="#ff2a2a"
              emissive="#8b1e1e"
              emissiveIntensity={0.45}
              roughness={0.3}
            />
          </mesh>
        </group>
        <mesh position={[0, 0, 0.018]}>
          <planeGeometry args={[0.85, 0.108]} />
          <meshStandardMaterial
            ref={headerTickerMatRef}
            color="#3a453e"
            map={headerTickerTex}
            emissive="#ffffff"
            emissiveMap={headerTickerTex}
            emissiveIntensity={0.72}
            roughness={0.94}
            metalness={0.0}
          />
        </mesh>
      </group>

      {/* Printer Tray Boundary Brass Divider Line (`PRINTER_TRAY_BOUNDARY_X_3D = -0.62` -> >80% open mat!) */}
      <mesh position={[PRINTER_TRAY_BOUNDARY_X_3D, 0.925, 0.02]} receiveShadow>
        <boxGeometry args={[0.01, 0.004, 1.18]} />
        <meshStandardMaterial
          color="#8c7a4b"
          metalness={0.85}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
        />
      </mesh>

      {/* ============================================================
          2. ПРАВДА-84 TELETYPE PRINTER (INTRICATE MULTI-PART .GLB MODEL, LOWER-LEFT FOREGROUND)
             Click-to-Print Failsafe: Clicking directly on the chassis when no paper is active forces next directive (cooldown = 0)!
         ============================================================ */}
      <group
        ref={printerGroupRef}
        position={[PRINTER_SLOT_X_3D, 0.962, 0.32]}
        rotation={[0, 0.15, 0]}
        scale={0.65}
        onPointerOver={(e) => {
          e.stopPropagation()
          if (useDeskStore.getState().printingDoc !== null) {
            useGameStore.getState().setHoveredDiagnosticId('order')
          }
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          const g = useGameStore.getState()
          if (g.hoveredDiagnosticId === 'order') {
            g.setHoveredDiagnosticId(null)
          }
        }}
        onClick={(e) => {
          if (useCameraLookStore.getState().isFreeLookMode) return
          e.stopPropagation()
          const store = useDeskStore.getState()
          const hasActive =
            store.printingDoc !== null ||
            store.documents.length > 0 ||
            store.packedDoc !== null ||
            store.capsuleState !== 'CRADLE_EMPTY'
          if (!hasActive) {
            const spawned = store.forcePrintNextDirective()
            if (spawned) {
              printerRecoilRef.current = 0.65
              playSwitchClank(true)
              triggerBobbleShockwave(0.55)
            }
          }
        }}
      >
        <primitive object={teletypeModel} />
        <mesh
          position={[0, 0.04, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.58, 0.18, 0.42]} />
          <meshStandardMaterial
            color="#b5ad96"
            roughness={0.48}
            metalness={0.55}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        {/* Stepped Beveled Top Armor Plate, Welded Corner L-Angle Iron Trim & 3D Hex Bolt Rows */}
        <mesh position={[0, 0.132, 0.05]} castShadow receiveShadow>
          <boxGeometry args={[0.54, 0.012, 0.24]} />
          <meshStandardMaterial
            color="#23312b"
            metalness={0.65}
            roughness={0.45}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        {[-0.24, -0.12, 0, 0.12, 0.24].map((bx, bIdx) => (
          <mesh
            key={bIdx}
            position={[bx, 0.14, 0.15]}
            castShadow
          >
            <cylinderGeometry args={[0.008, 0.008, 0.008, 6]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.85}
              roughness={0.28}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
        ))}
        {/* Recessed Side Cooling Louver Fins (Left & Right) */}
        {[-0.08, -0.02, 0.04, 0.1].map((lz, idx) => (
          <group key={idx}>
            <mesh position={[-0.292, 0.055, lz]} castShadow>
              <boxGeometry args={[0.008, 0.08, 0.028]} />
              <meshStandardMaterial color="#18211b" roughness={0.9} />
            </mesh>
            <mesh position={[0.292, 0.055, lz]} castShadow>
              <boxGeometry args={[0.008, 0.08, 0.028]} />
              <meshStandardMaterial color="#18211b" roughness={0.9} />
            </mesh>
          </group>
        ))}
        {/* Riveted Brass Serial-Number Plaque on Side */}
        <mesh position={[0.22, 0.139, 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.11, 0.032]} />
          <meshStandardMaterial map={serialPlateTex} roughness={0.45} />
        </mesh>
        {/* Coiled Rear Power Cord */}
        {[0, 1, 2, 3, 4].map((ci) => (
          <mesh
            key={ci}
            position={[-0.18, 0.02, -0.23 - ci * 0.018]}
            rotation={[0.2, 0, 0]}
            castShadow
          >
            <torusGeometry args={[0.018, 0.006, 6, 10]} />
            <meshStandardMaterial color="#0d110f" roughness={0.85} />
          </mesh>
        ))}
        <mesh
          position={[0, 0.03, 0.16]}
          rotation={[0.38, 0, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.54, 0.12, 0.16]} />
          <meshStandardMaterial
            color="#2a362b"
            roughness={0.45}
            metalness={0.65}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        {/* Top Dark Roller Cavity Slit & Platen Cylinder above GLB Hood */}
        <mesh position={[0, 0.19, -0.035]}>
          <boxGeometry args={[0.46, 0.012, 0.068]} />
          <meshStandardMaterial color="#0d110f" roughness={0.95} />
        </mesh>
        <mesh
          position={[0, 0.188, -0.035]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.026, 0.026, 0.44, 12]} />
          <meshStandardMaterial color="#0d110f" roughness={0.88} />
        </mesh>
        {/* Transparent Serrated Acrylic/Steel Paper Tear-Bar Across Roller Mouth */}
        <mesh position={[0, 0.198, -0.012]} rotation={[0.22, 0, 0]}>
          <boxGeometry args={[0.45, 0.004, 0.022]} />
          <meshStandardMaterial
            color="#778472"
            metalness={0.85}
            roughness={0.2}
            transparent
            opacity={0.82}
          />
        </mesh>
        {/* Exposed Brass Gear Teeth & Platen Handwheel on Right */}
        <mesh
          position={[0.26, 0.12, -0.05]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.038, 0.038, 0.016, 10]} />
          <meshStandardMaterial
            color="#b8a46b"
            roughness={0.28}
            metalness={0.85}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        <mesh
          position={[0.31, 0.12, -0.05]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.045, 0.045, 0.05, 12]} />
          <meshStandardMaterial
            color="#8c7a4b"
            roughness={0.28}
            metalness={0.85}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        <mesh position={[-0.2, 0.075, 0.19]} rotation={[0.38, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.03, 10]} />
          <meshStandardMaterial
            ref={printerLampMatRef}
            color={printerReceiving ? '#ff2a2a' : '#8b1e1e'}
            emissive={printerReceiving ? '#ff2a2a' : '#000000'}
            emissiveIntensity={printerReceiving ? 1.4 : 0}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[0.04, 0.068, 0.215]} rotation={[-0.95, 0, 0]}>
          <planeGeometry args={[0.36, 0.085]} />
          <meshStandardMaterial map={printerNameplateTex} roughness={0.5} />
        </mesh>

        {/* Emerging 12-Step Perforated Tractor-Feed Paper Strip Rising Upward Out of the Top Roller Slit */}
        {printingDoc && printStep > 0 && (() => {
          const stripLen = Math.max(0.04, printStep * PRINTER_FEED_STEP_M)
          const tiltRad = -0.68
          const centerY = 0.194 + (stripLen / 2) * Math.cos(tiltRad)
          const centerZ = -0.035 + (stripLen / 2) * Math.sin(tiltRad)
          return (
            <group
              position={[0, centerY, centerZ]}
              rotation={[tiltRad, 0, 0]}
              onPointerDown={handlePrintingSlipDown}
              onPointerMove={handlePrintingSlipMove}
              onPointerUp={handlePrintingSlipUp}
              onPointerCancel={handlePrintingSlipUp}
            >
              {/* Subdivided 3D Perforated Tractor-Feed Paper Strip Backing (#d8d2c0) for Pull-Tension Bending */}
              <mesh position={[0, 0, -0.002]} castShadow receiveShadow>
                <planeGeometry
                  ref={printingBackingGeoRef}
                  args={[0.32, stripLen, 10, 14]}
                />
                <meshStandardMaterial
                  color="#d8d2c0"
                  roughness={0.88}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Left & Right Perforated Tractor-Feed Pin-Hole Margin Strips */}
              {Array.from({ length: Math.max(2, printStep) }).map((_, holeIdx) => {
                const hy =
                  -stripLen / 2 +
                  0.012 +
                  (holeIdx / Math.max(1, printStep - 1)) *
                    Math.max(0.01, stripLen - 0.024)
                return (
                  <group key={holeIdx}>
                    <mesh position={[-0.148, hy, 0.001]}>
                      <circleGeometry args={[0.0045, 6]} />
                      <meshBasicMaterial color="#18211b" />
                    </mesh>
                    <mesh position={[0.148, hy, 0.001]}>
                      <circleGeometry args={[0.0045, 6]} />
                      <meshBasicMaterial color="#18211b" />
                    </mesh>
                  </group>
                )
              })}
              {/* Subdivided Printed Directive Slip Face (10x14 grid bends under tension before tearing!) */}
              <mesh position={[0, 0, 0.002]}>
                <planeGeometry
                  ref={printingStripGeoRef}
                  args={[0.28, stripLen, 10, 14]}
                />
                <meshStandardMaterial
                  ref={printingSlipMatRef}
                  map={printingSlipTex}
                  roughness={0.88}
                  side={THREE.DoubleSide}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  polygonOffsetUnits={-1}
                />
              </mesh>
            </group>
          )
        })()}
      </group>

      {/* ============================================================
          3. ПНЕВМОПОЧТА // OUTBOX PNEUMATIC CAPSULE DISPATCH SYSTEM
          - Step 1: Desk Carrier Cylinder Cradle (`ЛОЖЕ КАПСУЛЫ`) & Draggable Brass/Bakelite Carrier Cylinder (`КАПСУЛА`)
          - Step 2..4: Rear-Mounted Pneumatic Breech Station (`КАМЕРА ПУСКА`) behind Back-Left Desk Corner with Hinged Curved Breech Hatch (`ЛЮК КАМЕРЫ`)
          - Step 5: Chunky Right-Flank Vacuum Launch Lever (`РЫЧАГ ПУСКА`) with Red Bakelite Ball Handle
          - Continuous Segmented Glass-and-Brass Pipeline: Vertical Riser -> 90° Brass Ceiling Elbow -> Horizontal Ceiling Run -> Plunge Behind `K.O.M.R.A.D.-84`!
         ============================================================ */}

      {/* 3A. DESK CARRIER CYLINDER CRADLE (`ЛОЖЕ КАПСУЛЫ`) ON BACK-LEFT OF DESK MAT */}
      <group
        position={[
          CAPSULE_CRADLE_POS_3D.x,
          CAPSULE_CRADLE_POS_3D.y,
          CAPSULE_CRADLE_POS_3D.z,
        ]}
        rotation={[0, 0.18, 0]}
        onPointerDown={handleCradleCapsulePointerDown}
        onPointerMove={handleCradleCapsulePointerMove}
        onPointerUp={handleCradleCapsulePointerUp}
        onPointerCancel={handleCradleCapsulePointerUp}
      >
        {/* Heavy Mahogany & Brushed-Brass Carrier Cradle Base */}
        <mesh position={[0, 0.008, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.24, 0.016, 0.14]} />
          <meshStandardMaterial
            color="#3d2216"
            map={mahoganyTex.map}
            bumpMap={mahoganyTex.bumpMap}
            bumpScale={0.004}
            roughness={0.5}
          />
        </mesh>
        {/* Brass Perimeter Trim Plate */}
        <mesh position={[0, 0.017, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.004, 0.12]} />
          <meshStandardMaterial
            color="#8c7a4b"
            metalness={0.85}
            roughness={0.28}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>
        {/* Twin Curved Brass Saddle Supports Holding the Horizontal Carrier Cylinder */}
        {[-0.056, 0.056].map((sx, sIdx) => (
          <group key={sIdx} position={[sx, 0.028, -0.01]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.018, 0.022, 0.088]} />
              <meshStandardMaterial
                color="#222d26"
                metalness={0.68}
                roughness={0.42}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.006}
              />
            </mesh>
            <mesh
              position={[0, 0.015, 0]}
              rotation={[0, Math.PI / 2, 0]}
              castShadow
            >
              <torusGeometry args={[0.044, 0.006, 8, 16, Math.PI]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.88}
                roughness={0.24}
              />
            </mesh>
          </group>
        ))}
        {/* Angled Front Brass Instruction Plaque (`КАПСУЛА // STEP 1: PACK PAPER`) */}
        <group position={[0, 0.016, 0.068]} rotation={[-0.48, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.22, 0.006, 0.05]} />
            <meshStandardMaterial
              color="#8c7a4b"
              metalness={0.86}
              roughness={0.28}
            />
          </mesh>
          <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.212, 0.045]} />
            <meshStandardMaterial
              map={capsuleCradlePlaqueTex}
              roughness={0.48}
            />
          </mesh>
        </group>
      </group>

      {/* 3B. INTERACTIVE BRASS & BAKELITE CARRIER CYLINDER (`КАПСУЛА`) ON CRADLE / DRAGGABLE TO CHAMBER */}
      <group
        ref={cradleCapsuleGroupRef}
        position={[
          CAPSULE_CRADLE_POS_3D.x,
          CAPSULE_CRADLE_POS_3D.y + 0.036,
          CAPSULE_CRADLE_POS_3D.z,
        ]}
        rotation={[0, 0.18, Math.PI / 2]}
        onPointerDown={handleCradleCapsulePointerDown}
        onPointerMove={handleCradleCapsulePointerMove}
        onPointerUp={handleCradleCapsulePointerUp}
        onPointerCancel={handleCradleCapsulePointerUp}
      >
        {/* Generous Invisible Hit-Box on Carrier Cylinder */}
        <mesh>
          <cylinderGeometry args={[0.072, 0.072, 0.19, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* Transparent Fluted Glass/Acrylic Carrier Body */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.038, 0.038, 0.122, 18]} />
          <meshStandardMaterial
            color="#d8efe4"
            transparent
            opacity={0.52}
            roughness={0.14}
            metalness={0.18}
          />
        </mesh>
        {/* Center Bakelite Grip Band & Brass Identification Ring */}
        <mesh>
          <cylinderGeometry args={[0.04, 0.04, 0.024, 18]} />
          <meshStandardMaterial
            color="#1c1614"
            roughness={0.38}
            metalness={0.2}
          />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.041, 0.041, 0.007, 18]} />
          <meshStandardMaterial
            ref={capsuleRingMatRef}
            color={capsuleState === 'CRADLE_PACKED' ? '#33ff66' : '#b8a46b'}
            emissive={capsuleState === 'CRADLE_PACKED' ? '#198c38' : '#000000'}
            emissiveIntensity={capsuleState === 'CRADLE_PACKED' ? 0.8 : 0}
            metalness={0.85}
            roughness={0.25}
          />
        </mesh>
        {/* Bottom Knurled Brass End-Cap & Crimson Felt Buffer Ring */}
        <group position={[0, -0.058, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.042, 0.042, 0.018, 18]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.88}
              roughness={0.22}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
          <mesh position={[0, -0.01, 0]}>
            <cylinderGeometry args={[0.044, 0.044, 0.007, 18]} />
            <meshStandardMaterial color="#5c1a16" roughness={0.88} />
          </mesh>
        </group>
        {/* Animated Top Brass End-Cap (Open when empty, snaps shut when paper scroll rolls inside!) */}
        <group ref={cradleTopCapRef} position={[0, 0.088, 0]} rotation={[0, 0, -0.55]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.042, 0.042, 0.018, 18]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.88}
              roughness={0.22}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
          <mesh position={[0, 0.01, 0]}>
            <cylinderGeometry args={[0.044, 0.044, 0.007, 18]} />
            <meshStandardMaterial color="#5c1a16" roughness={0.88} />
          </mesh>
          {/* Knurled Brass Pull-Knob on Top Cap */}
          <mesh position={[0, 0.018, 0]}>
            <cylinderGeometry args={[0.016, 0.02, 0.012, 12]} />
            <meshStandardMaterial
              color="#d4be7f"
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>
        </group>
        {/* Rolled Directive Paper Scroll Inside Carrier Cylinder */}
        <group ref={cradleScrollRef} visible={packedDoc !== null}>
          <mesh>
            <cylinderGeometry args={[0.026, 0.026, 0.098, 16]} />
            <meshStandardMaterial
              ref={cradlePaperMatRef}
              color={
                packedDoc ? PAPER_COLOR_HEX[packedDoc.paperColor] : '#d8d2c0'
              }
              roughness={0.85}
            />
          </mesh>
          <mesh position={[0, 0.014, 0]}>
            <cylinderGeometry args={[0.0275, 0.0275, 0.022, 16]} />
            <meshStandardMaterial color="#1b6e32" roughness={0.75} />
          </mesh>
        </group>
      </group>

      {/* 3C. OUTER-LEFT SIDE-MOUNTED PNEUMATIC BREECH STATION (`ПНЕВМОПОЧТА // КАМЕРА ПУСКА`)
          Bolted to the Left Side-Panel of the Desk Right Beside the Carrier Cradle (100% Clear to the Left of the Green Banker's Lamp!) */}
      <group
        position={[
          OUTBOX_BREECH_POS_3D.x,
          OUTBOX_BREECH_POS_3D.y,
          OUTBOX_BREECH_POS_3D.z,
        ]}
        rotation={[0, 0.32, 0]}
      >
        {/* Heavy Cast-Iron Cantilever Side-Panel Mounting Bracket Bolted to the Outer-Left Desk Frame */}
        <mesh position={[0.14, -0.06, -0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.28, 0.14, 0.18]} />
          <meshStandardMaterial
            color="#18211b"
            metalness={0.7}
            roughness={0.44}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        {/* Lower Floor-to-Breech Cast-Iron Vacuum Supply Column Rising From Behind the Desk */}
        <mesh position={[0, -0.48, -0.025]} castShadow receiveShadow>
          <cylinderGeometry args={[0.062, 0.072, 0.96, 18]} />
          <meshStandardMaterial
            color="#1e2923"
            metalness={0.68}
            roughness={0.46}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        {/* Lower Flanged Cast-Iron Collar Ring */}
        <mesh position={[0, -0.04, -0.025]} castShadow>
          <cylinderGeometry args={[0.092, 0.098, 0.036, 18]} />
          <meshStandardMaterial
            color="#8c7a4b"
            metalness={0.85}
            roughness={0.28}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>

        {/* Main Cast-Iron Breech Base Manifold (`КАМЕРА ПУСКА`) */}
        <mesh
          position={[0, 0.032, 0]}
          castShadow
          receiveShadow
          onClick={handleBreechChamberClick}
        >
          <boxGeometry args={[0.3, 0.068, 0.22]} />
          <meshStandardMaterial
            color="#222d26"
            roughness={0.44}
            metalness={0.68}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        {/* 4 Brass Hex Bolts on Breech Manifold Deck */}
        {(
          [
            [-0.12, -0.08],
            [0.12, -0.08],
            [-0.12, 0.08],
            [0.12, 0.08],
          ] as const
        ).map(([bx, bz], bIdx) => (
          <mesh key={bIdx} position={[bx, 0.07, bz]} castShadow>
            <cylinderGeometry args={[0.008, 0.008, 0.01, 6]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.86}
              roughness={0.28}
            />
          </mesh>
        ))}

        {/* Angled Engraved Brass Front Plaque (`ПНЕВМОПОЧТА // КАМЕРА ПУСКА`) */}
        <group
          position={[0, 0.028, 0.122]}
          rotation={[-0.45, 0, 0]}
          onClick={handleBreechChamberClick}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.29, 0.008, 0.076]} />
            <meshStandardMaterial
              color="#8c7a4b"
              metalness={0.85}
              roughness={0.28}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.278, 0.068]} />
            <meshStandardMaterial map={outboxTubeTex} roughness={0.52} />
          </mesh>
        </group>

        {/* Step 2..4: Machined Brass Breech Chamber & Hinged Curved Brass/Glass Breech Door (`ЛЮК КАМЕРЫ`) */}
        <group position={[0, 0.175, -0.025]}>
          {/* Generous Invisible Hit-Box Around Breech Chamber & Door */}
          <mesh position={[0, 0, 0.03]} onClick={handleBreechChamberClick}>
            <boxGeometry args={[0.24, 0.26, 0.22]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>

          {/* Bottom & Top Flanged Brass Chamber Rings */}
          {[-0.105, 0.105].map((cy, rIdx) => (
            <mesh key={rIdx} position={[0, cy, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.078, 0.082, 0.028, 20]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.86}
                roughness={0.25}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
          ))}

          {/* Rear Curved Cast-Brass Chamber Wall (200° arc leaving front breech opening) */}
          <mesh
            rotation={[0, Math.PI * 0.45, 0]}
            castShadow
            receiveShadow
            onClick={handleBreechChamberClick}
          >
            <cylinderGeometry
              args={[0.068, 0.068, 0.19, 20, 1, true, 0, Math.PI * 1.15]}
            />
            <meshStandardMaterial
              color="#8c7a4b"
              metalness={0.84}
              roughness={0.3}
              side={THREE.DoubleSide}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>

          {/* Dark Recessed Inner Vacuum Chamber Bore & Brass Capsule Seat */}
          <mesh position={[0, 0, -0.004]} onClick={handleBreechChamberClick}>
            <cylinderGeometry
              args={[0.056, 0.056, 0.186, 18, 1, true, Math.PI * 0.45, Math.PI * 1.15]}
            />
            <meshStandardMaterial
              color="#080c0a"
              roughness={0.92}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, -0.082, 0]}>
            <cylinderGeometry args={[0.048, 0.052, 0.014, 16]} />
            <meshStandardMaterial
              color="#5c1a16"
              roughness={0.85}
            />
          </mesh>

          {/* Step 3: Loaded Carrier Cylinder Sitting Upright Inside Breech Chamber (`capsuleState === 'CHAMBER_LOADED'`) */}
          <group
            ref={chamberCapsuleGroupRef}
            position={[0, 0, 0]}
            visible={capsuleState === 'CHAMBER_LOADED'}
            onClick={handleBreechHatchClick}
          >
            <mesh castShadow>
              <cylinderGeometry args={[0.038, 0.038, 0.122, 16]} />
              <meshStandardMaterial
                color="#d8efe4"
                transparent
                opacity={0.55}
                roughness={0.14}
                metalness={0.18}
              />
            </mesh>
            {[-0.058, 0.058].map((cy, cIdx) => (
              <group key={cIdx} position={[0, cy, 0]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.042, 0.042, 0.018, 16]} />
                  <meshStandardMaterial
                    color="#b8a46b"
                    metalness={0.88}
                    roughness={0.22}
                  />
                </mesh>
                <mesh position={[0, cIdx === 0 ? -0.01 : 0.01, 0]}>
                  <cylinderGeometry args={[0.044, 0.044, 0.007, 16]} />
                  <meshStandardMaterial color="#5c1a16" roughness={0.88} />
                </mesh>
              </group>
            ))}
            <mesh>
              <cylinderGeometry args={[0.026, 0.026, 0.098, 14]} />
              <meshStandardMaterial
                ref={chamberPaperMatRef}
                color={
                  packedDoc ? PAPER_COLOR_HEX[packedDoc.paperColor] : '#d8d2c0'
                }
                roughness={0.85}
              />
            </mesh>
            <mesh position={[0, 0.012, 0]}>
              <cylinderGeometry args={[0.0275, 0.0275, 0.022, 14]} />
              <meshStandardMaterial color="#1b6e32" roughness={0.75} />
            </mesh>
          </group>

          {/* Hinged Curved Brass/Glass Breech Door (`ЛЮК КАМЕРЫ`) — Pivots ~85° on Left Hinge Pin when Clicked! */}
          <group
            ref={breechDoorGroupRef}
            position={[-0.066, 0, 0.024]}
            onClick={handleBreechHatchClick}
          >
            {/* Heavy Left Vertical Brass Hinge Knuckles */}
            {[-0.065, 0.065].map((hy, hIdx) => (
              <mesh key={hIdx} position={[0, hy, 0]} castShadow>
                <cylinderGeometry args={[0.01, 0.01, 0.028, 10]} />
                <meshStandardMaterial
                  color="#b8a46b"
                  metalness={0.88}
                  roughness={0.24}
                />
              </mesh>
            ))}
            {/* Door Offset Group Centered on Chamber Axis when Closed (`rotation.y = 0`) */}
            <group position={[0.066, 0, -0.024]}>
              {/* Curved Transparent Inspection Glass Door Panel */}
              <mesh rotation={[0, -Math.PI * 0.42, 0]} castShadow>
                <cylinderGeometry
                  args={[0.07, 0.07, 0.175, 16, 1, true, 0, Math.PI * 0.85]}
                />
                <meshStandardMaterial
                  color="#bce6d4"
                  transparent
                  opacity={0.46}
                  roughness={0.12}
                  metalness={0.2}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Top & Bottom Curved Brass Door Straps */}
              {[-0.082, 0.082].map((sy, sIdx) => (
                <mesh
                  key={sIdx}
                  position={[0, sy, 0]}
                  rotation={[0, -Math.PI * 0.42, 0]}
                  castShadow
                >
                  <cylinderGeometry
                    args={[0.073, 0.073, 0.016, 16, 1, true, 0, Math.PI * 0.85]}
                  />
                  <meshStandardMaterial
                    color="#b8a46b"
                    metalness={0.88}
                    roughness={0.22}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              ))}
              {/* Right-Edge Brass Latch Bar & Knurled Crimson/Brass Cam-Latch Handle (`ОТКРЫТЬ / ЗАКРЫТЬ ЛЮК`) */}
              <group position={[0.064, 0, 0.036]}>
                <mesh castShadow>
                  <boxGeometry args={[0.016, 0.175, 0.016]} />
                  <meshStandardMaterial
                    color="#b8a46b"
                    metalness={0.88}
                    roughness={0.22}
                  />
                </mesh>
                <mesh
                  position={[0.018, 0, 0.018]}
                  rotation={[0, 0, Math.PI / 2]}
                  castShadow
                >
                  <cylinderGeometry args={[0.008, 0.008, 0.036, 10]} />
                  <meshStandardMaterial
                    color="#d4be7f"
                    metalness={0.9}
                    roughness={0.2}
                  />
                </mesh>
                <mesh position={[0.034, 0, 0.026]} castShadow>
                  <sphereGeometry args={[0.015, 12, 12]} />
                  <meshStandardMaterial
                    ref={hatchKnobMatRef}
                    color={hatchOpen ? '#ffb000' : '#b82a24'}
                    roughness={0.28}
                  />
                </mesh>
              </group>
            </group>
          </group>
        </group>

        {/* Caged Jewel Status Lamp (`ГОТОВ К ПУСКУ // SEALED & READY`: Amber when open/unsealed, Solid Emerald Green when loaded & sealed!) */}
        <group position={[0.105, 0.074, 0.035]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.022, 0.026, 0.018, 12]} />
            <meshStandardMaterial
              color="#8c7a4b"
              metalness={0.86}
              roughness={0.28}
            />
          </mesh>
          <mesh position={[0, 0.014, 0]}>
            <sphereGeometry args={[0.016, 14, 12]} />
            <meshStandardMaterial
              ref={pneumaticStatusLampMatRef}
              color="#2b382e"
              emissive="#0a2412"
              emissiveIntensity={0.25}
              roughness={0.2}
            />
          </mesh>
          {[0, Math.PI / 2].map((rotY, cIdx) => (
            <mesh
              key={cIdx}
              position={[0, 0.014, 0]}
              rotation={[0, rotY, 0]}
            >
              <torusGeometry args={[0.018, 0.0022, 6, 12, Math.PI]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.88}
                roughness={0.25}
              />
            </mesh>
          ))}
          <pointLight
            ref={pneumaticStatusLightRef}
            position={[0, 0.035, 0]}
            color="#33ff66"
            intensity={0.05}
            distance={0.5}
            decay={2}
          />
        </group>

        {/* Left-Flank Brass Vacuum Manometer Gauge (`ВАКУУМ // КГС/СМ²`) */}
        <group position={[-0.125, 0.115, 0.03]} rotation={[-0.25, 0.2, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.038, 0.042, 0.018, 14]} />
            <meshStandardMaterial
              color="#8c7a4b"
              metalness={0.85}
              roughness={0.28}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
              roughnessMap={brassTex.roughnessMap}
            />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <circleGeometry args={[0.033, 14]} />
            <meshStandardMaterial map={manometerDialTex} roughness={0.75} />
          </mesh>
          <group ref={manometerNeedleRef} position={[0, 0, 0.012]}>
            <mesh position={[0, 0.01, 0]}>
              <boxGeometry args={[0.0035, 0.024, 0.002]} />
              <meshStandardMaterial
                color="#ff2a2a"
                emissive="#ff2a2a"
                emissiveIntensity={0.35}
              />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.0045, 0.0045, 0.004, 8]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.85}
                roughness={0.28}
              />
            </mesh>
          </group>
        </group>

        {/* Step 5: Right-Flank Heavy Vacuum Launch Gearbox & Pull-Down Lever (`РЫЧАГ ПУСКА`) with Red Bakelite Ball Handle */}
        <group position={[0.168, 0.155, -0.01]}>
          {/* Cast-Brass Ratchet Quadrant Housing */}
          <mesh
            castShadow
            receiveShadow
            onPointerDown={handleLaunchLeverDown}
            onPointerMove={handleLaunchLeverMove}
            onPointerUp={handleLaunchLeverUp}
            onPointerCancel={handleLaunchLeverUp}
          >
            <boxGeometry args={[0.056, 0.145, 0.14]} />
            <meshStandardMaterial
              color="#8c7a4b"
              metalness={0.86}
              roughness={0.28}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          <mesh position={[0.016, 0.015, 0]}>
            <boxGeometry args={[0.032, 0.11, 0.11]} />
            <meshStandardMaterial color="#0d110f" roughness={0.92} />
          </mesh>
          {/* Pivoting Chrome-Steel Launch Lever Shaft & Crimson Bakelite Ball Handle (`ПУСК`) */}
          <group
            ref={launchLeverGroupRef}
            position={[0.022, 0.01, -0.02]}
            rotation={[0.22, 0, -0.08]}
            onPointerDown={handleLaunchLeverDown}
            onPointerMove={handleLaunchLeverMove}
            onPointerUp={handleLaunchLeverUp}
            onPointerCancel={handleLaunchLeverUp}
          >
            {/* Generous Invisible Hit-Box on Launch Lever */}
            <mesh position={[0, 0.08, 0.02]}>
              <boxGeometry args={[0.12, 0.22, 0.14]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {/* Chrome-Steel Lever Arm */}
            <mesh position={[0, 0.068, 0]} castShadow>
              <cylinderGeometry args={[0.011, 0.014, 0.14, 10]} />
              <meshStandardMaterial
                color="#c8d2c5"
                metalness={0.9}
                roughness={0.2}
              />
            </mesh>
            {/* Heavy Red Bakelite Ball Knob (`#b82a24`) */}
            <mesh position={[0, 0.145, 0]} castShadow>
              <sphereGeometry args={[0.042, 16, 16]} />
              <meshStandardMaterial
                ref={launchKnobMatRef}
                color="#b82a24"
                emissive="#4a0808"
                emissiveIntensity={
                  capsuleState === 'CHAMBER_LOADED' && !hatchOpen ? 0.65 : 0.25
                }
                roughness={0.22}
                metalness={0.12}
              />
            </mesh>
            {/* Brass Equator Grip Band Around Red Bakelite Ball */}
            <mesh
              position={[0, 0.145, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <torusGeometry args={[0.043, 0.005, 8, 16]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.88}
                roughness={0.22}
              />
            </mesh>
          </group>
        </group>
      </group>

      {/* 3D. CONTINUOUS SEGMENTED GLASS-AND-BRASS ARCHITECTURAL PIPELINE TO `K.O.M.R.A.D.-84`
          1. Vertical Riser (`x = -1.468, z = -0.544, y = 1.20 .. 3.12`)
          2. 90° Brass Ceiling Elbow (`x = -1.468 -> -1.328, y = 3.12 -> 3.26`)
          3. Extended Horizontal Ceiling Run (`x = -1.328 .. -0.14, y = 3.26, z = -0.544`) with 4 Ceiling Hanger Brackets (high above Shift Clock!)
          4. Terminal Intake Bend & Vertical Plunge (`x = 0.0, y = 3.26 -> 1.68, z = -1.16`) directly into Rear of `K.O.M.R.A.D.-84`! */}
      <group>
        {/* 1. Vertical Transparent Glass/Acrylic Riser Pipe (`x = -1.468, z = -0.544`) */}
        <group position={[-1.468, 2.16, -0.544]}>
          <mesh receiveShadow>
            <cylinderGeometry args={[0.056, 0.056, 1.92, 20, 1, true]} />
            <meshStandardMaterial
              color="#bce6d4"
              transparent
              opacity={0.34}
              roughness={0.12}
              metalness={0.18}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.05, 0.05, 1.92, 16, 1, true]} />
            <meshStandardMaterial
              color="#e6fff4"
              transparent
              opacity={0.12}
              roughness={0.08}
              metalness={0.1}
              depthWrite={false}
            />
          </mesh>
          {/* 5 Flanged Brass Collar Rings Along Vertical Riser */}
          {[-0.84, -0.42, 0, 0.42, 0.84].map((ry, rIdx) => (
            <group key={rIdx} position={[0, ry, 0]}>
              <mesh castShadow receiveShadow>
                <cylinderGeometry args={[0.068, 0.068, 0.026, 20]} />
                <meshStandardMaterial
                  color="#b8a46b"
                  metalness={0.86}
                  roughness={0.26}
                  bumpMap={brassTex.bumpMap}
                  bumpScale={0.005}
                />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.069, 0.005, 8, 20]} />
                <meshStandardMaterial
                  color="#8c7a4b"
                  metalness={0.88}
                  roughness={0.24}
                />
              </mesh>
            </group>
          ))}
          {/* 4 Vertical Brushed-Steel Tie-Rods Reinforcing the Riser */}
          {(
            [
              [-0.06, -0.06],
              [0.06, -0.06],
              [-0.06, 0.06],
              [0.06, 0.06],
            ] as const
          ).map(([tx, tz], tIdx) => (
            <mesh key={tIdx} position={[tx, 0, tz]} castShadow>
              <cylinderGeometry args={[0.005, 0.005, 1.92, 8]} />
              <meshStandardMaterial
                color="#9aa4ac"
                metalness={0.88}
                roughness={0.26}
              />
            </mesh>
          ))}
        </group>

        {/* 2. 90° Flanged Brass Ceiling Elbow Bend (`x = -1.468, y = 3.12 -> 3.26, z = -0.544 -> -0.684`) */}
        <group position={[-1.468, 3.12, -0.684]}>
          <mesh rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
            <torusGeometry args={[0.14, 0.06, 16, 24, Math.PI / 2]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.86}
              roughness={0.26}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          {/* End Flanges on 90° Elbow */}
          <mesh position={[0, 0, 0.14]} castShadow>
            <cylinderGeometry args={[0.072, 0.072, 0.024, 18]} />
            <meshStandardMaterial
              color="#8c7a4b"
              metalness={0.88}
              roughness={0.25}
            />
          </mesh>
          <mesh
            position={[0, 0.14, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.072, 0.072, 0.024, 18]} />
            <meshStandardMaterial
              color="#8c7a4b"
              metalness={0.88}
              roughness={0.25}
            />
          </mesh>
        </group>

        {/* 3. Extended Rearward Ceiling Glass-and-Brass Pipeline (`x = -1.468, y = 3.26, z = -0.684 .. -1.54`) Clear of Shift Clock */}
        <group position={[-1.468, 3.26, -1.112]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} receiveShadow>
            <cylinderGeometry args={[0.056, 0.056, 0.86, 20, 1, true]} />
            <meshStandardMaterial
              color="#bce6d4"
              transparent
              opacity={0.34}
              roughness={0.12}
              metalness={0.18}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          {/* Brass Collar Rings & Heavy Steel Ceiling Hanger Straps Bolted to Overhead Bunker Ceiling */}
          {[-0.32, 0.0, 0.32].map((hz, hIdx) => (
            <group key={hIdx} position={[0, 0, hz]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.068, 0.068, 0.026, 18]} />
                <meshStandardMaterial
                  color="#b8a46b"
                  metalness={0.86}
                  roughness={0.26}
                  bumpMap={brassTex.bumpMap}
                  bumpScale={0.005}
                />
              </mesh>
              {/* Steel Ceiling Hanger Rod & Mounting Plate */}
              <mesh position={[0, 0.11, 0]} castShadow>
                <cylinderGeometry args={[0.01, 0.01, 0.18, 8]} />
                <meshStandardMaterial
                  color="#222d26"
                  metalness={0.7}
                  roughness={0.42}
                />
              </mesh>
              <mesh position={[0, 0.2, 0]}>
                <boxGeometry args={[0.08, 0.016, 0.08]} />
                <meshStandardMaterial
                  color="#18211b"
                  metalness={0.7}
                  roughness={0.45}
                />
              </mesh>
            </group>
          ))}
        </group>

        {/* 4. Terminal Intake Bend (`x = -0.95, z = -1.68`) & Vertical Plunge Well Left & Behind `K.O.M.R.A.D.-84` (100% Clear of Shift Clock!) */}
        {/* Rear-Left Brass Elbow */}
        <group position={[-1.328, 3.26, -1.54]}>
          <mesh rotation={[Math.PI / 2, 0, Math.PI]} castShadow>
            <torusGeometry args={[0.14, 0.06, 14, 20, Math.PI / 2]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.86}
              roughness={0.26}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
        </group>
        {/* Lateral Connector Pipe Behind K.O.M.R.A.D.-84 (`x = -1.328 .. -1.09, y = 3.26, z = -1.68`) */}
        <mesh
          position={[-1.21, 3.26, -1.68]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.058, 0.058, 0.24, 16]} />
          <meshStandardMaterial
            color="#8c7a4b"
            metalness={0.86}
            roughness={0.28}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        {/* Downward 90° Brass Elbow Plunging Behind Left Rear Corner (`x = -0.95, y = 3.12, z = -1.68`) */}
        <group position={[-1.09, 3.12, -1.68]}>
          <mesh rotation={[0, 0, 0]} castShadow>
            <torusGeometry args={[0.14, 0.06, 14, 20, Math.PI / 2]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.86}
              roughness={0.26}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
        </group>
        {/* Vertical Intake Drop Pipe Plunging at `x = -0.95, z = -1.68` (0.95m Left & 0.52m Further Back — 100% Clear of Shift Clock!) */}
        <group position={[-0.95, 2.39, -1.68]}>
          <mesh receiveShadow>
            <cylinderGeometry args={[0.056, 0.056, 1.46, 18, 1, true]} />
            <meshStandardMaterial
              color="#bce6d4"
              transparent
              opacity={0.34}
              roughness={0.12}
              metalness={0.18}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          {[-0.48, 0, 0.48].map((ry, rIdx) => (
            <mesh key={rIdx} position={[0, ry, 0]} castShadow>
              <cylinderGeometry args={[0.068, 0.068, 0.024, 18]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.86}
                roughness={0.26}
              />
            </mesh>
          ))}
          {/* Heavy Flanged Cast-Iron Receiver Manifold Bolted to Rear Left of `K.O.M.R.A.D.-84` Mainframe */}
          <mesh position={[0, -0.71, 0.04]} castShadow>
            <boxGeometry args={[0.22, 0.16, 0.18]} />
            <meshStandardMaterial
              color="#18211b"
              metalness={0.7}
              roughness={0.42}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
        </group>

        {/* Animated In-Flight 3D Brass Carrier Capsule Shooting Up Riser -> 90° Elbow -> Ceiling Pipe -> Behind `K.O.M.R.A.D.-84`! */}
        <group
          ref={flightCapsuleGroupRef}
          position={[-1.468, 1.1, -0.544]}
          visible={false}
        >
          <mesh castShadow>
            <cylinderGeometry args={[0.038, 0.038, 0.122, 16]} />
            <meshStandardMaterial
              color="#d8efe4"
              transparent
              opacity={0.58}
              roughness={0.14}
              metalness={0.18}
            />
          </mesh>
          {[-0.058, 0.058].map((cy, cIdx) => (
            <group key={cIdx} position={[0, cy, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.042, 0.042, 0.018, 16]} />
                <meshStandardMaterial
                  color="#b8a46b"
                  metalness={0.88}
                  roughness={0.22}
                />
              </mesh>
              <mesh position={[0, cIdx === 0 ? -0.01 : 0.01, 0]}>
                <cylinderGeometry args={[0.044, 0.044, 0.007, 16]} />
                <meshStandardMaterial color="#5c1a16" roughness={0.88} />
              </mesh>
            </group>
          ))}
          <mesh>
            <cylinderGeometry args={[0.026, 0.026, 0.098, 14]} />
            <meshStandardMaterial
              ref={flightPaperMatRef}
              color="#d8d2c0"
              roughness={0.85}
            />
          </mesh>
          <mesh position={[0, 0.012, 0]}>
            <cylinderGeometry args={[0.0275, 0.0275, 0.022, 14]} />
            <meshStandardMaterial
              color="#33ff66"
              emissive="#198c38"
              emissiveIntensity={0.85}
              roughness={0.5}
            />
          </mesh>
        </group>
      </group>

      {/* ============================================================
          4. WE-PAD 84 (`ЭЛЕКТРОНИКА МЫ-ПАД 84`) — CLEAN 3D ATOMPUNK TABLET
             ONLY:
             1) Main Backing Chassis (`y = 0`, `renderOrder = 1`)
             2) 4 Outer Bezel Rails along the outer perimeter (`renderOrder = 2`, zero meshes near screen center!)
             3) Front Screen Mesh (`y = 0.025`, `renderOrder = 9999`, `depthTest = false`, `depthWrite = false`)
         ============================================================ */}
      <group
        ref={manualGroupRef}
        position={[MANUAL_BOUNDS_3D.x, BASE_MAT_Y + 0.012, MANUAL_BOUNDS_3D.z]}
        rotation={[0, 0, 0]}
        scale={MANUAL_SCALE}
        onWheel={handleManualWheel}
        onPointerDown={handleManualDragDown}
        onPointerMove={handleManualDragMove}
        onPointerUp={handleManualDragUp}
        onPointerCancel={handleManualDragUp}
      >
        {/* 1. MAIN CHASSIS: Heavy Beveled Cast-Iron & Brushed-Steel Cabinet (#2a3028) */}
        <mesh
          position={[0, 0, 0]}
          castShadow={!isManualHeld}
          receiveShadow={!isManualHeld}
          renderOrder={1}
          onWheel={handleManualWheel}
        >
          <boxGeometry args={[MANUAL_BASE_W + 0.036, 0.018, MANUAL_BASE_H + 0.048]} />
          <meshStandardMaterial
            color="#2a3028"
            roughness={0.58}
            metalness={0.52}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.005}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>

        {/* 2. 4 OUTER BEZEL RAILS (Top, Bottom, Left, Right — strictly outside the screen area, renderOrder = 2) */}
        {/* Top Bezel Rail */}
        <mesh
          position={[0, 0.012, -MANUAL_BASE_H / 2 - 0.009]}
          castShadow={!isManualHeld}
          renderOrder={2}
        >
          <boxGeometry args={[MANUAL_BASE_W + 0.022, 0.006, 0.018]} />
          <meshStandardMaterial color="#141414" roughness={0.36} metalness={0.22} />
        </mesh>
        {/* Bottom Bezel Rail */}
        <mesh
          position={[0, 0.012, MANUAL_BASE_H / 2 + 0.012]}
          castShadow={!isManualHeld}
          renderOrder={2}
        >
          <boxGeometry args={[MANUAL_BASE_W + 0.022, 0.006, 0.024]} />
          <meshStandardMaterial color="#141414" roughness={0.36} metalness={0.22} />
        </mesh>
        {/* Left Bezel Rail */}
        <mesh
          position={[-MANUAL_BASE_W / 2 - 0.006, 0.012, 0]}
          castShadow={!isManualHeld}
          renderOrder={2}
        >
          <boxGeometry args={[0.01, 0.006, MANUAL_BASE_H + 0.008]} />
          <meshStandardMaterial color="#141414" roughness={0.36} metalness={0.22} />
        </mesh>
        {/* Right Bezel Rail */}
        <mesh
          position={[MANUAL_BASE_W / 2 + 0.006, 0.012, 0]}
          castShadow={!isManualHeld}
          renderOrder={2}
        >
          <boxGeometry args={[0.01, 0.006, MANUAL_BASE_H + 0.008]} />
          <meshStandardMaterial color="#141414" roughness={0.36} metalness={0.22} />
        </mesh>

        {/* Compact Stenciled Metal Nameplate on Top Outer Frame (`ЭЛЕКТРОНИКА МЫ-ПАД 84`) */}
        <mesh
          position={[0, 0.0155, -MANUAL_BASE_H / 2 - 0.009]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={3}
          onDoubleClick={(e) => {
            e.stopPropagation()
            if (manualPosRef.current.suppressNextClick) return
            toggleManualHeld()
          }}
        >
          <planeGeometry args={[0.185, 0.016]} />
          <meshBasicMaterial map={folderCrestTex} toneMapped={false} />
        </mesh>

        {/* 3. SCREEN MESH (`renderOrder = 9999`, `depthTest = false`, well in front of backing chassis!) */}
        <mesh
          position={[0, 0.06, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={9999}
          onWheel={handleManualWheel}
          onClick={(e) => {
            e.stopPropagation()
            if (manualPosRef.current.suppressNextClick) return
            // When WE-PAD 84 is resting on the desk, clicking it picks it up into hand!
            if (!useGameStore.getState().wePadHeld) {
              toggleManualHeld()
              return
            }
            if (!e.uv) return
            const u = e.uv.x
            const v = 1 - e.uv.y

            // 2x3 Tab Grid Bar (y: 88..216 on 1280px height -> v: 0.068..0.172)
            if (v >= 0.068 && v <= 0.175) {
              const col = u < 0.34 ? 0 : u < 0.67 ? 1 : 2
              const row = v < 0.121 ? 0 : 1
              const chosen = (1 + row * 3 + col) as WePadTabId
              playPageTurnSound()
              setManualPage(chosen)
              setManualScrollY(0)
              return
            }

            // Bottom Status Line (y: 1200..1280 -> v >= 0.93)
            if (v >= 0.93) {
              if (u < 0.36) {
                playPageTurnSound()
                setManualPage((p) => (p === 6 ? 1 : ((p + 1) as WePadTabId)))
                setManualScrollY(0)
              } else if (u < 0.66) {
                useGameStore.getState().toggleWePadInspecting()
                playDetentClick(1)
              } else {
                toggleManualHeld()
              }
              return
            }

            // Clicking the lower half of the viewport scrolls down; upper half scrolls up
            if (v >= 0.55) {
              scrollManual(1)
            } else {
              scrollManual(-1)
            }
          }}
        >
          <planeGeometry
            args={[MANUAL_BASE_W - 0.002, MANUAL_BASE_H - 0.002]}
          />
          <meshBasicMaterial
            ref={manualMatRef}
            map={manualTex}
            toneMapped={false}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* ============================================================
          5. DRAGGABLE 3D DIRECTIVE STACK ON THE DESK MAT
         ============================================================ */}
      {documents
        .filter((d) => d.status === 'desk')
        .map((doc, idx) => (
          <DraggablePaper3D
            key={doc.id}
            doc={doc}
            stackIndex={idx}
            deskGroupRef={deskGroupRef}
            liveDocPosMapRef={liveDocPosMapRef}
            paperImpulseMapRef={paperImpulseMapRef}
            sharedDragHandlersRef={sharedDragHandlersRef}
            manualPosRef={manualPosRef}
            activeDragDocId={activeDragDocId}
            setActiveDragDocId={setActiveDragDocId}
            onDocumentMutated={markLensDirty}
            onTriggerPneumaticDispatch={triggerPneumaticDispatchAnim}
          />
        ))}

      {/* ============================================================
          6. HINGED 105° CLAMSHELL INK PADS & FULL-SIZE (1.0x) LATHE-TURNED WOODEN RUBBER STAMPS
          (MAGNETIC SNAP-CRADLE DOCK AT `x: +0.22, z: -0.22` AND `x: +0.38, z: -0.22`!)
         ============================================================ */}
      <group
        position={[0.22, 0.926, -0.22]}
        scale={0.78}
        onClick={(e) => {
          e.stopPropagation()
          const st = stampStateRef.current.APPROVED
          st.targetX = st.homeX
          st.targetZ = st.homeZ
          playSwitchClank(false)
        }}
      >
        {deskPropNodes.inkPadApprove && (
          <primitive object={deskPropNodes.inkPadApprove} />
        )}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.19, 0.014, 0.13]} />
          <meshStandardMaterial
            color="#2a362b"
            roughness={0.45}
            metalness={0.65}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        {/* Brass-Trimmed Magnetic Cradle Rim (Raised above GLB tin so it is 100% visible) */}
        <mesh position={[0, 0.015, 0]} receiveShadow>
          <boxGeometry args={[0.178, 0.006, 0.118]} />
          <meshStandardMaterial
            color="#8c7a4b"
            roughness={0.32}
            metalness={0.82}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>
        {/* Unmistakable Emerald-Green Felt Ink Pad Socket */}
        <mesh position={[0, 0.018, 0]} receiveShadow>
          <boxGeometry args={[0.162, 0.005, 0.102]} />
          <meshStandardMaterial
            color="#249e44"
            emissive="#0d3b18"
            emissiveIntensity={0.35}
            roughness={0.88}
          />
        </mesh>
        {/* Hinged Metal Clamshell Lid Propped Open at 105° with ОДОБРЕНО Plaque */}
        <group position={[0, 0.014, -0.064]} rotation={[-1.83, 0, 0]}>
          <mesh position={[0, 0, 0.062]} castShadow>
            <boxGeometry args={[0.188, 0.006, 0.124]} />
            <meshStandardMaterial
              color="#3e4d40"
              roughness={0.45}
              metalness={0.65}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          <mesh
            position={[0, -0.005, 0.062]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[0.156, 0.052]} />
            <meshStandardMaterial
              map={approveBadgeTex}
              emissive="#1b6e32"
              emissiveIntensity={0.25}
              roughness={0.6}
            />
          </mesh>
        </group>
      </group>

      <group
        position={[0.38, 0.926, -0.22]}
        scale={0.78}
        onClick={(e) => {
          e.stopPropagation()
          const st = stampStateRef.current.SHREDDED
          st.targetX = st.homeX
          st.targetZ = st.homeZ
          playSwitchClank(false)
        }}
      >
        {deskPropNodes.inkPadShred && (
          <primitive object={deskPropNodes.inkPadShred} />
        )}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.19, 0.014, 0.13]} />
          <meshStandardMaterial
            color="#2b1a12"
            roughness={0.45}
            metalness={0.65}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        {/* Brass-Trimmed Magnetic Cradle Rim (Raised above GLB tin so it is 100% visible) */}
        <mesh position={[0, 0.015, 0]} receiveShadow>
          <boxGeometry args={[0.178, 0.006, 0.118]} />
          <meshStandardMaterial
            color="#8c7a4b"
            roughness={0.32}
            metalness={0.82}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>
        {/* Unmistakable Crimson-Red Felt Ink Pad Socket */}
        <mesh position={[0, 0.018, 0]} receiveShadow>
          <boxGeometry args={[0.162, 0.005, 0.102]} />
          <meshStandardMaterial
            color="#c92828"
            emissive="#3d0a0a"
            emissiveIntensity={0.35}
            roughness={0.88}
          />
        </mesh>
        {/* Hinged Metal Clamshell Lid Propped Open at 105° with УНИЧТОЖЕНО Plaque */}
        <group position={[0, 0.014, -0.064]} rotation={[-1.83, 0, 0]}>
          <mesh position={[0, 0, 0.062]} castShadow>
            <boxGeometry args={[0.188, 0.006, 0.124]} />
            <meshStandardMaterial
              color="#472b1e"
              roughness={0.45}
              metalness={0.65}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          <mesh
            position={[0, -0.005, 0.062]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[0.156, 0.052]} />
            <meshStandardMaterial
              map={shredBadgeTex}
              emissive="#8b1e1e"
              emissiveIntensity={0.25}
              roughness={0.6}
            />
          </mesh>
        </group>
      </group>

      {/* Draggable ОДОБРЕНО (APPROVED) Full-Size (scale=1.0) Wooden Rubber Stamp */}
      <group
        ref={approveStampGroupRef}
        position={[0.22, 0.935, -0.22]}
        scale={1.0}
        {...makeUnifiedStampHandlers('APPROVED')}
      >
        {/* Unified Whole-Stamp Invisible Hitbox Cylinder (Handle + Shaft + Base) */}
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.16, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <group>
          {deskPropNodes.stampBodyApprove && (
            <primitive object={deskPropNodes.stampBodyApprove} />
          )}
          <mesh position={[0, 0.016, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.145, 0.032, 0.09]} />
            <meshStandardMaterial
              color="#233628"
              roughness={0.42}
              metalness={0.65}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
              roughnessMap={ironTex.roughnessMap}
            />
          </mesh>
          {/* Rubber Ink Die Pad Underneath */}
          <mesh position={[0, 0.002, 0]} castShadow>
            <boxGeometry args={[0.136, 0.006, 0.08]} />
            <meshStandardMaterial color="#1b6e32" roughness={0.92} />
          </mesh>
          <mesh
            position={[0, 0.034, 0.022]}
            rotation={[-Math.PI / 2 + 0.35, 0, 0]}
          >
            <planeGeometry args={[0.132, 0.042]} />
            <meshStandardMaterial map={approveBadgeTex} roughness={0.6} />
          </mesh>
        </group>

        <group ref={approvePlungerRef}>
          {deskPropNodes.stampPlungerApprove && (
            <primitive object={deskPropNodes.stampPlungerApprove} />
          )}
          {/* Knurled Brass Ferrule */}
          <mesh position={[0, 0.044, 0]} castShadow>
            <cylinderGeometry args={[0.026, 0.03, 0.024, 14]} />
            <meshStandardMaterial
              color="#b8a46b"
              roughness={0.28}
              metalness={0.85}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          <mesh position={[0, 0.072, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.025, 0.04, 12]} />
            <meshStandardMaterial
              color="#8c7a4b"
              roughness={0.28}
              metalness={0.85}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          {/* Decorative Lathe-Turned Neck Ring */}
          <mesh
            position={[0, 0.094, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <torusGeometry args={[0.026, 0.006, 8, 14]} />
            <meshStandardMaterial
              color="#1f7a39"
              roughness={0.38}
              bumpMap={mahoganyTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          {/* Tall Unmistakable Emerald-Green Lacquered Wooden Handle Knob */}
          <mesh
            position={[0, 0.128, 0]}
            scale={[0.92, 1.32, 0.92]}
            castShadow
          >
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshStandardMaterial
              ref={approveKnobMatRef}
              color="#248f43"
              emissive="#0c3818"
              emissiveIntensity={0.25}
              roughness={0.35}
              bumpMap={mahoganyTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
        </group>
      </group>

      {/* Draggable УНИЧТОЖЕНО (SHREDDED) Full-Size (scale=1.0) Wooden Rubber Stamp */}
      <group
        ref={shredStampGroupRef}
        position={[0.38, 0.935, -0.22]}
        scale={1.0}
        {...makeUnifiedStampHandlers('SHREDDED')}
      >
        {/* Unified Whole-Stamp Invisible Hitbox Cylinder (Handle + Shaft + Base) */}
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.16, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <group>
          {deskPropNodes.stampBodyShred && (
            <primitive object={deskPropNodes.stampBodyShred} />
          )}
          <mesh position={[0, 0.016, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.145, 0.032, 0.09]} />
            <meshStandardMaterial
              color="#3b201c"
              roughness={0.42}
              metalness={0.65}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
              roughnessMap={ironTex.roughnessMap}
            />
          </mesh>
          {/* Rubber Ink Die Pad Underneath */}
          <mesh position={[0, 0.002, 0]} castShadow>
            <boxGeometry args={[0.136, 0.006, 0.08]} />
            <meshStandardMaterial color="#8b1e1e" roughness={0.92} />
          </mesh>
          <mesh
            position={[0, 0.034, 0.022]}
            rotation={[-Math.PI / 2 + 0.35, 0, 0]}
          >
            <planeGeometry args={[0.132, 0.042]} />
            <meshStandardMaterial map={shredBadgeTex} roughness={0.6} />
          </mesh>
        </group>

        <group ref={shredPlungerRef}>
          {deskPropNodes.stampPlungerShred && (
            <primitive object={deskPropNodes.stampPlungerShred} />
          )}
          {/* Knurled Brass Ferrule */}
          <mesh position={[0, 0.044, 0]} castShadow>
            <cylinderGeometry args={[0.026, 0.03, 0.024, 14]} />
            <meshStandardMaterial
              color="#b8a46b"
              roughness={0.28}
              metalness={0.85}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          <mesh position={[0, 0.072, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.025, 0.04, 12]} />
            <meshStandardMaterial
              color="#8c7a4b"
              roughness={0.28}
              metalness={0.85}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          {/* Decorative Lathe-Turned Neck Ring */}
          <mesh
            position={[0, 0.094, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <torusGeometry args={[0.026, 0.006, 8, 14]} />
            <meshStandardMaterial
              color="#9e2222"
              roughness={0.38}
              bumpMap={mahoganyTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          {/* Tall Unmistakable Crimson-Red Lacquered Wooden Handle Knob */}
          <mesh
            position={[0, 0.128, 0]}
            scale={[0.92, 1.32, 0.92]}
            castShadow
          >
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshStandardMaterial
              ref={shredKnobMatRef}
              color="#c42828"
              emissive="#4a0c0c"
              emissiveIntensity={0.25}
              roughness={0.35}
              bumpMap={mahoganyTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
        </group>
      </group>

      {/* ============================================================
          7. УНИЧТОЖИТЕЛЬ-84 DOCUMENT SHREDDER (INTRICATE MULTI-PART .GLB MODEL, CENTER-RIGHT)
          WITH OVERSIZED RED BAKELITE 5-STEP PULL-LEVER ARM (`#b82a24`) ON RIGHT FLANK!
         ============================================================ */}
      <group
        position={[SHREDDER_POS_3D.x, SHREDDER_POS_3D.y, SHREDDER_POS_3D.z]}
        rotation={[0, SHREDDER_POS_3D.rotationY, 0]}
        scale={0.68}
      >
        <primitive object={shredderModel} />
        {/* Main Cast-Iron Shredder Body */}
        <mesh position={[-0.03, 0.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.38, 0.16, 0.3]} />
          <meshStandardMaterial
            color="#2a362b"
            roughness={0.45}
            metalness={0.65}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        {/* Heavy Bolted Cast-Iron Side Flanges & Corner L-Angle Trim */}
        <mesh position={[-0.228, 0.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.024, 0.17, 0.32]} />
          <meshStandardMaterial
            color="#18211b"
            roughness={0.45}
            metalness={0.65}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        <mesh position={[0.162, 0.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.022, 0.17, 0.32]} />
          <meshStandardMaterial
            color="#18211b"
            roughness={0.45}
            metalness={0.65}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        {/* 8 Heavy Brass 3D Hex-Head Bolts along Top Flanges */}
        {[-0.12, -0.04, 0.04, 0.12].map((bz, bIdx) => (
          <group key={bIdx}>
            <mesh position={[-0.228, 0.11, bz]} castShadow>
              <cylinderGeometry args={[0.009, 0.009, 0.01, 6]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.85}
                roughness={0.28}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
            <mesh position={[0.162, 0.11, bz]} castShadow>
              <cylinderGeometry args={[0.009, 0.009, 0.01, 6]} />
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
        {/* Perforated Metal / Wire-Frame ОТХОДЫ Waste Bin Underneath */}
        <mesh position={[-0.03, -0.055, 0.04]} castShadow receiveShadow>
          <boxGeometry args={[0.34, 0.04, 0.24]} />
          <meshStandardMaterial
            color="#0d110f"
            roughness={0.5}
            metalness={0.6}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>

        {/* Throat Opening & Yellow/Black ОПАСНО // НОЖИ Hazard Chevron Decal */}
        <mesh position={[-0.03, 0.102, -0.02]}>
          <boxGeometry args={[0.3, 0.012, 0.065]} />
          <meshStandardMaterial color="#0d110f" roughness={0.92} />
        </mesh>
        <mesh
          position={[-0.03, 0.103, 0.058]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.3, 0.048]} />
          <meshStandardMaterial map={hazardChevronTex} roughness={0.5} />
        </mesh>

        {/* 9 Interlocking Milled Steel Cutting Wheels inside the Throat */}
        {Array.from({ length: 9 }).map((_, i) => (
          <group key={i} position={[-0.15 + i * 0.03, 0.104, -0.02]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.015, 0.015, 0.012, 10]} />
              <meshStandardMaterial
                color="#778472"
                roughness={0.28}
                metalness={0.88}
              />
            </mesh>
            <mesh
              position={[0, 0.002, (i % 2 === 0 ? 1 : -1) * 0.008]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow
            >
              <cylinderGeometry args={[0.012, 0.012, 0.008, 6]} />
              <meshStandardMaterial
                color="#b8a46b"
                roughness={0.28}
                metalness={0.85}
              />
            </mesh>
          </group>
        ))}

        {/* Loaded Directive Standing Upright in the Steel Jaws (Bottom half clipped at jaw slot!) */}
        {loadedDoc && (() => {
          const remRatio = Math.max(0.1, 1 - shredProgress / 100)
          const uprightH = 0.25 * remRatio
          return (
            <group
              position={[-0.03 + shredJitterX, 0.112, -0.02]}
              rotation={[-0.58, 0, 0]}
            >
              {/* Solid 3D Paper Backing for Upright Loaded Slip */}
              <mesh position={[0, uprightH / 2, -0.002]} castShadow>
                <boxGeometry args={[0.23, uprightH, 0.003]} />
                <meshStandardMaterial
                  color={PAPER_COLOR_HEX[loadedDoc.paperColor]}
                  roughness={0.88}
                />
              </mesh>
              <mesh position={[0, uprightH / 2, 0.001]} castShadow>
                <planeGeometry args={[0.22, uprightH]} />
                <meshStandardMaterial
                  ref={loadedSlipMatRef}
                  map={loadedSlipTex}
                  roughness={0.88}
                  side={THREE.DoubleSide}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  polygonOffsetUnits={-1}
                />
              </mesh>
            </group>
          )
        })()}

        <mesh position={[-0.03, 0.025, 0.152]}>
          <planeGeometry args={[0.32, 0.11]} />
          <meshStandardMaterial
            ref={shredPlateMatRef}
            map={shredPlateTex}
            roughness={0.55}
          />
        </mesh>

        <mesh position={[-0.03, -0.055, 0.155]}>
          <boxGeometry args={[0.32, 0.028, 0.04]} />
          <meshStandardMaterial color="#0d110f" roughness={0.9} />
        </mesh>
        {stripSource &&
          Array.from({ length: 15 }).map((_, i) => {
            const h =
              0.015 +
              (stripSource.progress / 100) *
                0.065 *
                STRIP_VARIANCE[i % STRIP_VARIANCE.length]
            return (
              <mesh
                key={i}
                position={[-0.16 + i * 0.019, -0.03 - h / 2, 0.148]}
              >
                <boxGeometry args={[0.012, h, 0.004]} />
                <meshStandardMaterial
                  color={i % 3 === 0 ? stripSource.inkHex : stripSource.paperHex}
                  roughness={0.88}
                />
              </mesh>
            )
          })}

        {/* Right-Flank Brass Ratchet Gearbox & 5-Detent Slot */}
        <mesh
          position={[0.215, 0.035, 0]}
          castShadow
          receiveShadow
          onPointerDown={handleShredLeverDown}
          onPointerMove={handleShredLeverMove}
          onPointerUp={handleShredLeverUp}
          onPointerCancel={handleShredLeverUp}
        >
          <boxGeometry args={[0.085, 0.155, 0.26]} />
          <meshStandardMaterial
            color="#8c7a4b"
            roughness={0.28}
            metalness={0.85}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
            roughnessMap={brassTex.roughnessMap}
          />
        </mesh>
        <mesh position={[0.215, 0.115, 0]}>
          <boxGeometry args={[0.026, 0.01, 0.21]} />
          <meshStandardMaterial color="#0d110f" roughness={0.95} />
        </mesh>

        {/* Oversized Red Bakelite 5-Step Pull-Lever Arm (`#b82a24` Ball Knob on Chrome Steel Rod) */}
        <group
          ref={shredLeverKnobRef}
          position={[0.225, 0.12, -0.09]}
          rotation={[0.25, 0, -0.12]}
          onPointerDown={handleShredLeverDown}
          onPointerMove={handleShredLeverMove}
          onPointerUp={handleShredLeverUp}
          onPointerCancel={handleShredLeverUp}
        >
          {/* Thick Chrome-Steel Lever Shaft */}
          <mesh position={[0, 0.055, 0]} castShadow>
            <cylinderGeometry args={[0.014, 0.016, 0.13, 10]} />
            <meshStandardMaterial
              color="#c8d2c5"
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>
          {/* Prominent Crimson-Red Bakelite Ball Knob (`#b82a24`) */}
          <mesh position={[0, 0.13, 0]} castShadow>
            <sphereGeometry args={[0.052, 16, 16]} />
            <meshStandardMaterial
              ref={shredLeverKnobMatRef}
              color="#b82a24"
              emissive="#4a0808"
              emissiveIntensity={0.35}
              roughness={0.22}
              metalness={0.12}
            />
          </mesh>
          {/* Ribbed Brass Grip Ring around the Red Bakelite Pull-Lever Knob */}
          <mesh
            position={[0, 0.13, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <torusGeometry args={[0.053, 0.006, 8, 16]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.88}
              roughness={0.22}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
        </group>
      </group>

      {/* ============================================================
          8. DRAGGABLE 2x STRAIGHT OPTICAL MAGNIFYING GLASS (STEPPED BRASS BEZEL & CHAMFERED GRIP)
         ============================================================ */}
      <group
        ref={magnifierGroupRef}
        position={[0.38, 0.975, 0.16]}
        scale={0.82}
        onPointerDown={handleLensPointerDown}
        onPointerMove={handleLensPointerMove}
        onPointerUp={handleLensPointerUp}
        onPointerCancel={handleLensPointerUp}
      >
        {deskPropNodes.magnifierFrame && (
          <primitive object={deskPropNodes.magnifierFrame} />
        )}
        {/* Outer & Inner Stepped Brass Optical Bezels */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <torusGeometry args={[0.155, 0.018, 12, 28]} />
          <meshStandardMaterial
            color="#b8a46b"
            roughness={0.28}
            metalness={0.85}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
            roughnessMap={brassTex.roughnessMap}
          />
        </mesh>
        <mesh
          position={[0, 0.006, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <torusGeometry args={[0.146, 0.008, 10, 28]} />
          <meshStandardMaterial
            color="#8c7a4b"
            roughness={0.28}
            metalness={0.85}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
            roughnessMap={brassTex.roughnessMap}
          />
        </mesh>
        <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.145, 28]} />
          <meshBasicMaterial
            ref={lensMatRef}
            map={lensTex}
            color="#e8e2d0"
            toneMapped={false}
            polygonOffset
            polygonOffsetFactor={-10}
            polygonOffsetUnits={-4}
          />
        </mesh>
        {/* Decorative Brass Neck Collar */}
        <mesh
          position={[0.095, -0.004, 0.095]}
          rotation={[Math.PI / 2, 0, -Math.PI / 4]}
          castShadow
        >
          <cylinderGeometry args={[0.022, 0.022, 0.032, 12]} />
          <meshStandardMaterial
            color="#b8a46b"
            roughness={0.28}
            metalness={0.85}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        {/* Chamfered Turned-Mahogany Grip & Brass Pommel Cap */}
        <mesh
          position={[0.148, -0.005, 0.148]}
          rotation={[Math.PI / 2, 0, -Math.PI / 4]}
          castShadow
        >
          <cylinderGeometry args={[0.018, 0.025, 0.175, 10]} />
          <meshStandardMaterial
            color="#5c3422"
            map={mahoganyTex.map}
            bumpMap={mahoganyTex.bumpMap}
            bumpScale={0.005}
            roughnessMap={mahoganyTex.roughnessMap}
            roughness={0.52}
            metalness={0.12}
          />
        </mesh>
        <mesh
          position={[0.214, -0.005, 0.214]}
          rotation={[Math.PI / 2, 0, -Math.PI / 4]}
          castShadow
        >
          <sphereGeometry args={[0.024, 10, 10]} />
          <meshStandardMaterial
            color="#b8a46b"
            roughness={0.28}
            metalness={0.85}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
      </group>
    </group>
  )
}
