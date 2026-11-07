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
import { useGameStore } from '../../shared/useGameStore'
import {
  INK_COLOR_HEX,
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
  playBobbleBoingSound,
  playCarriageReturnDing,
  playDetentClick,
  playLineFeedTick,
  playPageTurnSound,
  playPaperInsertSnap,
  playPaperRustle,
  playPaperSettleSlap,
  playPaperSlideBump,
  playPaperTearSound,
  playPneumaticWhoosh,
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
  drawSecurityManualCanvas,
  drawTrue2xOpticalLensCanvas,
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

const MANUAL_BASE_W = 0.36
const MANUAL_BASE_H = 0.42
const MANUAL_SCALE = 1.25
const MANUAL_BOUNDS_3D = {
  x: 0.34,
  z: 0.1,
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
          playPneumaticWhoosh()
          useDeskStore.getState().dispatchDocumentToOutbox(doc.id)
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
      playPneumaticWhoosh()
      store.dispatchDocumentToOutbox(doc.id)
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
      const state = useDeskStore.getState()
      if (state.printingDoc) return
      if (state.documents.length >= 5) return
      state.spawnNextDirective()
    }, 12000)
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

  // 2. 3-Page KGB Security Manual State (Page 1..3 + Stepped Scroll + Draggable Position)
  const [manualPage, setManualPage] = useState<1 | 2 | 3>(1)
  const [manualScrollY, setManualScrollY] = useState<number>(0)
  const manualGroupRef = useRef<THREE.Group | null>(null)
  const manualPosRef = useRef<{
    x: number
    z: number
    dragging: boolean
    dx: number
    dz: number
  }>({
    x: MANUAL_BOUNDS_3D.x,
    z: MANUAL_BOUNDS_3D.z,
    dragging: false,
    dx: 0,
    dz: 0,
  })

  // 3. Draggable 2x Straight Optical Magnifying Glass State
  const magnifierGroupRef = useRef<THREE.Group | null>(null)
  const lensPosRef = useRef<{ x: number; z: number; dragging: boolean }>({
    x: -0.15,
    z: 0.38,
    dragging: false,
  })
  const lensDragOffsetRef = useRef<{ dx: number; dz: number }>({ dx: 0, dz: 0 })

  // 4. Draggable 3D Wooden Rubber Stamps (`ОДОБРЕНО` & `УНИЧТОЖЕНО`) with 3-Detent Plungers
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
        draggingBody: boolean
        dx: number
        dz: number
        pullingPlunger: boolean
        plungerStartY: number
        plungerStep: number
        stampedThisStroke: boolean
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
      draggingBody: false,
      dx: 0,
      dz: 0,
      pullingPlunger: false,
      plungerStartY: 0,
      plungerStep: 0,
      stampedThisStroke: false,
    },
    SHREDDED: {
      homeX: 0.38,
      homeZ: -0.22,
      targetX: 0.38,
      targetZ: -0.22,
      x: 0.38,
      z: -0.22,
      draggingBody: false,
      dx: 0,
      dz: 0,
      pullingPlunger: false,
      plungerStartY: 0,
      plungerStep: 0,
      stampedThisStroke: false,
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
  const manualMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
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

  // Guardrail 4: Immediate Manual Texture & Lens Refresh when page or scroll changes
  useEffect(() => {
    const mTex = manualMatRef.current?.map as THREE.CanvasTexture | undefined
    if (!mTex) return
    const canvas = mTex.image as HTMLCanvasElement
    const ctx = canvas.getContext('2d')
    if (ctx) {
      drawSecurityManualCanvas(
        ctx,
        canvas.width,
        canvas.height,
        manualPage,
        manualScrollY,
        false
      )
      mTex.needsUpdate = true
      lensDirtyRef.current = true
    }
  }, [manualPage, manualScrollY])

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
        ctx.fillRect(28, 16, w - 56, 26)
        ctx.strokeStyle = '#8c7a4b'
        ctx.lineWidth = 2
        ctx.strokeRect(28, 16, w - 56, 26)
        apply16ColorBayerDither(ctx, w, h, 14)

        ctx.fillStyle = '#cfc6b0'
        ctx.font = 'bold 17px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText('ИСХОДЯЩИЕ // OUTBOX PNEUMATIC TUBE', w / 2, 62)
        ctx.fillStyle = '#b8a46b'
        ctx.font = 'bold 15px "VT323", monospace'
        ctx.fillText('▲ DROP ОДОБРЕНО DIRECTIVES HERE TO EXECUTE', w / 2, 82)
      }),
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

  const loadedDoc = useMemo(
    () => documents.find((d) => d.status === 'loaded_in_shredder') ?? null,
    [documents]
  )

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

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime()
    const dt = Math.min(0.033, Math.max(0.001, delta))
    if (manometerNeedleRef.current) {
      manometerNeedleRef.current.rotation.z =
        -0.42 + Math.sin(t * 21.0) * 0.075 + Math.cos(t * 34.5) * 0.042
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

    const isFreeLookMode = useCameraLookStore.getState().isFreeLookMode
    // 1. Update Top Status & Verdict Header Ticker
    const headerSig = `${commendations}|${citations}|${isMusicMuted}|${isFreeLookMode}|${lastVerdict?.docId ?? ''}|${lastVerdict?.decision ?? ''}|${lastVerdict?.reason ?? ''}`
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
          isFreeLookMode
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

    // 4. Update 3D Positions of Magnifier, Draggable Security Manual & Rubber Stamps (Auto-return lerp to home ink pads!)
    const manualBaseY = manualPosRef.current.dragging
      ? BASE_MAT_Y + 0.024
      : BASE_MAT_Y + 0.012
    if (manualGroupRef.current) {
      manualGroupRef.current.position.set(
        manualPosRef.current.x,
        manualBaseY,
        manualPosRef.current.z
      )
    }

    if (magnifierGroupRef.current) {
      const baseLensY = lensPosRef.current.dragging ? 1.055 : 1.032
      const manX = manualPosRef.current.x
      const manZ = manualPosRef.current.z
      const halfW = MANUAL_BOUNDS_3D.width / 2
      const halfH = MANUAL_BOUNDS_3D.height / 2
      const nearManual =
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

    const stApp = stampStateRef.current.APPROVED
    if (!stApp.draggingBody && !stApp.pullingPlunger) {
      stApp.x = THREE.MathUtils.lerp(stApp.x, stApp.targetX, 0.24)
      stApp.z = THREE.MathUtils.lerp(stApp.z, stApp.targetZ, 0.24)
    }
    if (approveStampGroupRef.current) {
      approveStampGroupRef.current.position.set(
        stApp.x,
        stApp.draggingBody ? 0.96 : 0.935,
        stApp.z
      )
    }
    if (approvePlungerRef.current) {
      approvePlungerRef.current.position.y = -stApp.plungerStep * 0.011
    }

    const stShr = stampStateRef.current.SHREDDED
    if (!stShr.draggingBody && !stShr.pullingPlunger) {
      stShr.x = THREE.MathUtils.lerp(stShr.x, stShr.targetX, 0.24)
      stShr.z = THREE.MathUtils.lerp(stShr.z, stShr.targetZ, 0.24)
    }
    if (shredStampGroupRef.current) {
      shredStampGroupRef.current.position.set(
        stShr.x,
        stShr.draggingBody ? 0.96 : 0.935,
        stShr.z
      )
    }
    if (shredPlungerRef.current) {
      shredPlungerRef.current.position.y = -stShr.plungerStep * 0.011
    }

    // 5. Guardrail 4: Immediate True 2x Straight Optical Magnifier Lens Refresh
    const lTex = lensMatRef.current?.map as THREE.CanvasTexture | undefined
    if (lTex) {
      const liveDocs = useDeskStore.getState().documents.map((d) => {
        const livePos = liveDocPosMapRef.current[d.id]
        return livePos
          ? { ...d, x: livePos.x, z: livePos.z, isExpanded: livePos.isExpanded }
          : d
      })
      const liveManualBounds = {
        x: manualPosRef.current.x,
        z: manualPosRef.current.z,
        width: MANUAL_BOUNDS_3D.width,
        height: MANUAL_BOUNDS_3D.height,
      }
      const docsSig = liveDocs
        .map(
          (d) =>
            `${d.id}:${d.x.toFixed(3)}:${d.z.toFixed(3)}:${d.isExpanded}:${d.stamps.length}`
        )
        .join('|')
      const lensSig = `${lensPosRef.current.x.toFixed(3)}|${lensPosRef.current.z.toFixed(3)}|${liveManualBounds.x.toFixed(3)}|${liveManualBounds.z.toFixed(3)}|${manualPage}|${manualScrollY}|${docsSig}`
      if (lensDirtyRef.current || lTex.userData.lastSig !== lensSig) {
        lensDirtyRef.current = false
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
  }

  const handleLensPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!lensPosRef.current.dragging) return
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
    lensPosRef.current.dragging = false
    lensDirtyRef.current = true
  }

  // 2B. Draggable 3-Page KGB Security Manual Handlers (Grab spiral binding bar to drag across mat)
  const scrollManual = (dir: 1 | -1) => {
    playScrollTickSound()
    setManualScrollY((prev) => Math.max(0, Math.min(180, prev + dir * 32)))
  }

  const handleManualWheel = (e: ThreeEvent<WheelEvent>) => {
    e.stopPropagation()
    scrollManual(e.deltaY > 0 ? 1 : -1)
  }

  const handleManualDragDown = (e: ThreeEvent<PointerEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return
    e.stopPropagation()
    const target = e.target as Element & {
      setPointerCapture?: (id: number) => void
    }
    target.setPointerCapture?.(e.pointerId)
    manualPosRef.current.dragging = true
    playPaperRustle(false)
    const hit = getDeskLocalHitFromEvent(
      e,
      deskGroupRef.current,
      BASE_MAT_Y + 0.012
    )
    if (hit) {
      manualPosRef.current.dx = hit.x - manualPosRef.current.x
      manualPosRef.current.dz = hit.z - manualPosRef.current.z
    }
  }

  const handleManualDragMove = (e: ThreeEvent<PointerEvent>) => {
    if (!manualPosRef.current.dragging) return
    e.stopPropagation()
    const hit = getDeskLocalHitFromEvent(
      e,
      deskGroupRef.current,
      BASE_MAT_Y + 0.012
    )
    if (!hit) return
    manualPosRef.current.x = Math.max(
      -0.88,
      Math.min(0.88, hit.x - manualPosRef.current.dx)
    )
    manualPosRef.current.z = Math.max(
      -0.28,
      Math.min(0.38, hit.z - manualPosRef.current.dz)
    )
    lensDirtyRef.current = true
  }

  const handleManualDragUp = (e: ThreeEvent<PointerEvent>) => {
    if (!manualPosRef.current.dragging) return
    e.stopPropagation()
    manualPosRef.current.dragging = false
    playPaperRustle(true)
    lensDirtyRef.current = true
  }

  // 3. Wooden Rubber Stamp Body Drag & 3-Step Plunger Handlers (Auto-return to ink pads!)
  const isOverAnyDeskDoc = (x: number, z: number): boolean => {
    const deskDocs = useDeskStore
      .getState()
      .documents.filter((d) => d.status === 'desk')
    return deskDocs.some((doc) => {
      const docW = doc.isExpanded ? PAPER_EXPANDED_W_3D : PAPER_COMPACT_W_3D
      const docH = doc.isExpanded ? PAPER_EXPANDED_H_3D : PAPER_COMPACT_H_3D
      return (
        x >= doc.x - docW / 2 - 0.06 &&
        x <= doc.x + docW / 2 + 0.06 &&
        z >= doc.z - docH / 2 - 0.06 &&
        z <= doc.z + docH / 2 + 0.06
      )
    })
  }

  const makeStampBodyHandlers = (type: StampType) => ({
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      if (useCameraLookStore.getState().isFreeLookMode) return
      e.stopPropagation()
      const target = e.target as Element & {
        setPointerCapture?: (id: number) => void
      }
      target.setPointerCapture?.(e.pointerId)
      const st = stampStateRef.current[type]
      st.draggingBody = true
      playDetentClick(1)
      const hit = getDeskLocalHitFromEvent(e, deskGroupRef.current, 0.935)
      if (hit) {
        st.dx = hit.x - st.x
        st.dz = hit.z - st.z
      }
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      const st = stampStateRef.current[type]
      if (!st.draggingBody) return
      e.stopPropagation()
      const hit = getDeskLocalHitFromEvent(e, deskGroupRef.current, 0.935)
      if (!hit) return
      st.x = Math.max(-1.02, Math.min(1.02, hit.x - st.dx))
      st.z = Math.max(-0.48, Math.min(0.52, hit.z - st.dz))
      st.targetX = st.x
      st.targetZ = st.z
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      const st = stampStateRef.current[type]
      if (!st.draggingBody) return
      e.stopPropagation()
      st.draggingBody = false
      playDetentClick(0)
      if (!isOverAnyDeskDoc(st.x, st.z)) {
        st.targetX = st.homeX
        st.targetZ = st.homeZ
      }
    },
    onDoubleClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      const st = stampStateRef.current[type]
      st.targetX = st.homeX
      st.targetZ = st.homeZ
      playSwitchClank(false)
    },
  })

  const makeStampPlungerHandlers = (type: StampType) => ({
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      if (useCameraLookStore.getState().isFreeLookMode) return
      e.stopPropagation()
      const target = e.target as Element & {
        setPointerCapture?: (id: number) => void
      }
      target.setPointerCapture?.(e.pointerId)
      const st = stampStateRef.current[type]
      st.pullingPlunger = true
      st.plungerStartY = e.clientY
      st.plungerStep = 0
      st.stampedThisStroke = false
      playDetentClick(1)
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      const st = stampStateRef.current[type]
      if (!st.pullingPlunger) return
      e.stopPropagation()
      const deltaY = Math.max(0, e.clientY - st.plungerStartY)
      const step = Math.min(3, Math.floor(deltaY / 8))
      if (step !== st.plungerStep) {
        st.plungerStep = step
        playDetentClick(step + 1)
        if (step === 3 && !st.stampedThisStroke) {
          st.stampedThisStroke = true
          execute3DStampImpact(type)
        }
      }
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      const st = stampStateRef.current[type]
      if (!st.pullingPlunger) return
      e.stopPropagation()
      st.pullingPlunger = false
      if (!st.stampedThisStroke) {
        st.stampedThisStroke = true
        st.plungerStep = 3
        execute3DStampImpact(type)
      }
      window.setTimeout(() => {
        st.plungerStep = 0
        st.targetX = st.homeX
        st.targetZ = st.homeZ
      }, 150)
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
        {/* Warm Orange Diegetic PointLight from the 4 ИН-14 Nixie Filaments */}
        <pointLight
          position={[0, 0.08, 0.04]}
          color="#ff7718"
          intensity={0.68}
          distance={0.85}
          decay={1.5}
        />
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
            castShadow
            position={[0, -0.03, 0.03]}
            color="#68ff8a"
            intensity={2.4}
            distance={1.8}
            angle={0.75}
            penumbra={0.8}
            decay={1.3}
            shadow-bias={-0.0005}
            shadow-mapSize={[512, 512]}
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
            map={headerTickerTex}
            emissive="#ffffff"
            emissiveMap={headerTickerTex}
            emissiveIntensity={0.48}
            roughness={0.5}
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
         ============================================================ */}
      <group
        ref={printerGroupRef}
        position={[PRINTER_SLOT_X_3D, 0.962, 0.32]}
        rotation={[0, 0.15, 0]}
        scale={0.65}
      >
        <primitive object={teletypeModel} />
        <mesh
          position={[0, 0.04, 0]}
          castShadow
          receiveShadow
          onPointerDown={(e) => e.stopPropagation()}
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
          3. ИСХОДЯЩИЕ // OUTBOX PNEUMATIC TUBE DISPATCH SLOT (BELOW STATUS PLAQUE)
          WITH FLAT-MOUNTED SIDE VACUUM MANOMETER GAUGE (0% STATUS TICKER OCCLUSION!)
         ============================================================ */}
      <group position={[-0.18, 0.932, -0.35]} scale={0.75}>
        {deskPropNodes.pneumaticTube && (
          <primitive object={deskPropNodes.pneumaticTube} />
        )}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.64, 0.028, 0.18]} />
          <meshStandardMaterial
            color="#2a362b"
            roughness={0.45}
            metalness={0.65}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.62, 0.16]} />
          <meshStandardMaterial map={outboxTubeTex} roughness={0.6} />
        </mesh>

        {/* Flat Brass Capillary Pressure Tubing & Side-Mounted Flat Vacuum Manometer Gauge */}
        <mesh geometry={deskCableGeometries.manometerCapillary} castShadow>
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.85}
            roughness={0.28}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        <group position={[-0.39, 0.012, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
          {/* Brushed-Brass Manometer Casing & Stepped Bezel Lying Flat on Desk Surface */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.044, 0.048, 0.018, 14]} />
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
            <circleGeometry args={[0.038, 14]} />
            <meshStandardMaterial map={manometerDialTex} roughness={0.75} />
          </mesh>
          <group ref={manometerNeedleRef} position={[0, 0, 0.012]}>
            <mesh position={[0, 0.012, 0]}>
              <boxGeometry args={[0.004, 0.028, 0.002]} />
              <meshStandardMaterial
                color="#ff2a2a"
                emissive="#ff2a2a"
                emissiveIntensity={0.35}
              />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.005, 0.005, 0.004, 8]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.85}
                roughness={0.28}
              />
            </mesh>
          </group>
        </group>
      </group>

      {/* ============================================================
          4. 3-PAGE KGB SECURITY MANUAL '84 (`КГБ СССР // ФОРМА 84-Б`)
          (100% FLAT AGAINST THE GREEN INSPECTION MAT AT `BASE_MAT_Y + 0.012`,
           POSITIONED AT `x: +0.36, z: +0.08` RIGHT NEXT TO ACTIVE DIRECTIVES)
         ============================================================ */}
      <group
        ref={manualGroupRef}
        position={[MANUAL_BOUNDS_3D.x, BASE_MAT_Y + 0.012, MANUAL_BOUNDS_3D.z]}
        rotation={[0, 0, 0]}
        scale={MANUAL_SCALE}
        onWheel={handleManualWheel}
      >
        {/* Draggable Top Brass Grip Rail & Spiral Binding Bar (`localZ < -0.14`) */}
        <mesh
          position={[0, 0.014, -MANUAL_BASE_H / 2 - 0.006]}
          castShadow
          onPointerDown={handleManualDragDown}
          onPointerMove={handleManualDragMove}
          onPointerUp={handleManualDragUp}
          onPointerCancel={handleManualDragUp}
        >
          <boxGeometry args={[MANUAL_BASE_W + 0.012, 0.018, 0.028]} />
          <meshStandardMaterial
            color="#8c7a4b"
            metalness={0.85}
            roughness={0.28}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
            roughnessMap={brassTex.roughnessMap}
          />
        </mesh>

        {/* Crimson KGB Hardcover Binder Base */}
        <mesh castShadow receiveShadow onWheel={handleManualWheel}>
          <boxGeometry args={[MANUAL_BASE_W, 0.02, MANUAL_BASE_H]} />
          <meshStandardMaterial color="#6b1d18" roughness={0.68} />
        </mesh>

        {/* Visible Stacked Paper Page-Edges along Left, Right & Bottom Sides */}
        {[0, 1, 2].map((layerIdx) => (
          <mesh
            key={layerIdx}
            position={[
              0,
              0.005 + layerIdx * 0.0022,
              0.002 + layerIdx * 0.001,
            ]}
            castShadow
            receiveShadow
            onWheel={handleManualWheel}
          >
            <boxGeometry
              args={[
                MANUAL_BASE_W - 0.008 - layerIdx * 0.003,
                0.0018,
                MANUAL_BASE_H - 0.01 - layerIdx * 0.003,
              ]}
            />
            <meshStandardMaterial
              color={layerIdx % 2 === 0 ? '#dfd6bc' : '#c9bfa4'}
              roughness={0.86}
            />
          </mesh>
        ))}

        {/* 14 Glinting Metallic Spiral Coils along Top Spine */}
        {Array.from({ length: 14 }).map((_, idx) => (
          <mesh
            key={idx}
            position={[
              -0.156 + idx * 0.024,
              0.014,
              -MANUAL_BASE_H / 2,
            ]}
            rotation={[0, Math.PI / 2, 0]}
            castShadow
            onPointerDown={handleManualDragDown}
            onPointerMove={handleManualDragMove}
            onPointerUp={handleManualDragUp}
            onPointerCancel={handleManualDragUp}
          >
            <torusGeometry args={[0.01, 0.003, 8, 12]} />
            <meshStandardMaterial
              color="#d4be7f"
              metalness={0.9}
              roughness={0.2}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
        ))}

        {([1, 2, 3] as const).map((tabPage, idx) => (
          <mesh
            key={tabPage}
            position={[
              MANUAL_BASE_W / 2 + 0.016,
              0.004,
              -0.11 + idx * 0.095,
            ]}
            castShadow
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onWheel={handleManualWheel}
            onClick={(e) => {
              e.stopPropagation()
              playPageTurnSound()
              setManualPage(tabPage)
              setManualScrollY(0)
            }}
          >
            <boxGeometry args={[0.034, 0.01, 0.072]} />
            <meshStandardMaterial
              color={manualPage === tabPage ? '#b8a46b' : '#8b1e1e'}
              roughness={0.55}
            />
          </mesh>
        ))}

        <mesh
          position={[0, 0.012, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          onWheel={handleManualWheel}
          onPointerDown={(e) => {
            if (!e.uv) {
              e.stopPropagation()
              return
            }
            const localZ = (0.5 - e.uv.y) * (MANUAL_BASE_H - 0.016)
            // Dragging is strictly restricted to the top spiral-binding header bar (`localZ < -0.14`)!
            if (localZ < -0.14) {
              handleManualDragDown(e)
              return
            }
            e.stopPropagation()
          }}
          onPointerMove={(e) => {
            if (manualPosRef.current.dragging) {
              handleManualDragMove(e)
              return
            }
            e.stopPropagation()
          }}
          onPointerUp={(e) => {
            if (manualPosRef.current.dragging) {
              handleManualDragUp(e)
              return
            }
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (!e.uv) return
            const u = e.uv.x
            const v = 1 - e.uv.y
            const localZ = (0.5 - e.uv.y) * (MANUAL_BASE_H - 0.016)
            if (localZ < -0.14) return

            if (v >= 0.09 && v <= 0.19) {
              const chosen: 1 | 2 | 3 = u < 0.34 ? 1 : u < 0.67 ? 2 : 3
              playPageTurnSound()
              setManualPage(chosen)
              setManualScrollY(0)
              return
            }

            if (v >= 0.86) {
              if (u < 0.24) {
                playPageTurnSound()
                setManualPage((p) => (p === 1 ? 3 : ((p - 1) as 1 | 2 | 3)))
                setManualScrollY(0)
              } else if (u < 0.5) {
                playPageTurnSound()
                setManualPage((p) => (p === 3 ? 1 : ((p + 1) as 1 | 2 | 3)))
                setManualScrollY(0)
              } else if (u < 0.74) {
                scrollManual(-1)
              } else {
                scrollManual(1)
              }
              return
            }

            // Clicking the lower half of the page body scrolls down; upper half turns page or scrolls up
            if (v >= 0.55) {
              scrollManual(1)
            } else {
              playPageTurnSound()
              setManualPage((p) => (p === 3 ? 1 : ((p + 1) as 1 | 2 | 3)))
              setManualScrollY(0)
            }
          }}
        >
          <planeGeometry
            args={[MANUAL_BASE_W - 0.016, MANUAL_BASE_H - 0.016]}
          />
          <meshStandardMaterial
            ref={manualMatRef}
            map={manualTex}
            roughness={0.85}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
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
          />
        ))}

      {/* ============================================================
          6. HINGED 105° CLAMSHELL INK PADS & FULL-SIZE (1.0x) LATHE-TURNED WOODEN RUBBER STAMPS
          (UNOBSTRUCTED DOCK AT `x: +0.22, z: -0.22` AND `x: +0.38, z: -0.22`!)
         ============================================================ */}
      <group position={[0.22, 0.926, -0.22]} scale={0.78}>
        {deskPropNodes.inkPadApprove && (
          <primitive object={deskPropNodes.inkPadApprove} />
        )}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.19, 0.012, 0.13]} />
          <meshStandardMaterial
            color="#2a362b"
            roughness={0.45}
            metalness={0.65}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        <mesh position={[0, 0.007, 0]} receiveShadow>
          <boxGeometry args={[0.16, 0.004, 0.1]} />
          <meshStandardMaterial color="#1b6e32" roughness={0.9} />
        </mesh>
        {/* Hinged Metal Clamshell Lid Propped Open at 105° */}
        <group position={[0, 0.008, -0.064]} rotation={[-1.83, 0, 0]}>
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
        </group>
      </group>

      <group position={[0.38, 0.926, -0.22]} scale={0.78}>
        {deskPropNodes.inkPadShred && (
          <primitive object={deskPropNodes.inkPadShred} />
        )}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.19, 0.012, 0.13]} />
          <meshStandardMaterial
            color="#2b1a12"
            roughness={0.45}
            metalness={0.65}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        <mesh position={[0, 0.007, 0]} receiveShadow>
          <boxGeometry args={[0.16, 0.004, 0.1]} />
          <meshStandardMaterial color="#8b1e1e" roughness={0.9} />
        </mesh>
        {/* Hinged Metal Clamshell Lid Propped Open at 105° */}
        <group position={[0, 0.008, -0.064]} rotation={[-1.83, 0, 0]}>
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
        </group>
      </group>

      {/* Draggable ОДОБРЕНО (APPROVED) Full-Size (scale=1.0) Wooden Rubber Stamp */}
      <group
        ref={approveStampGroupRef}
        position={[0.22, 0.935, -0.22]}
        scale={1.0}
      >
        <group {...makeStampBodyHandlers('APPROVED')}>
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

        <group
          ref={approvePlungerRef}
          {...makeStampPlungerHandlers('APPROVED')}
        >
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
      >
        <group {...makeStampBodyHandlers('SHREDDED')}>
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

        <group ref={shredPlungerRef} {...makeStampPlungerHandlers('SHREDDED')}>
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
