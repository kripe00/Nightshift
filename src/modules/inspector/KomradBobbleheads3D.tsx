import type React from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { playBobbleBoingSound } from './audio'
import { onKremlinFontReady } from '../../shared/kremlinFontReady'

const NOOP_RAYCAST: THREE.Object3D['raycast'] = () => {}

function createNearestCanvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; redraw: () => void } {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.SRGBColorSpace
  const redraw = () => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    draw(ctx, w, h)
    tex.needsUpdate = true
  }
  redraw()
  return { canvas, tex, redraw }
}

// 16-Color Soviet Bunker Palette
const SOVIET_16_PALETTE_HEX = [
  '#0d110f', // 0: Deep Bunker Black
  '#18211b', // 1: Dark Cast Iron
  '#2a362b', // 2: Oxidized Olive Drab
  '#3e4d40', // 3: Worn Military Green
  '#576657', // 4: Steel Highlight
  '#778472', // 5: Brushed Specular Metal
  '#2b1a12', // 6: Dark Bakelite Shadow
  '#472b1e', // 7: Bakelite Brown
  '#6b442e', // 8: Turned Wood Highlight
  '#5c4d2c', // 9: Tarnished Brass Shadow
  '#8c7a4b', // 10: Brass Midtone
  '#b8a46b', // 11: Brass Specular
  '#8f8772', // 12: Pravda Shadow Grey-Ivory
  '#b5ad96', // 13: Pravda Mid Ivory
  '#cfc6b0', // 14: Pravda Aged Ivory
  '#8b1e1e', // 15: Soviet Crimson (Ink / LED)
] as const

const PALETTE_RGB: Array<[number, number, number]> = SOVIET_16_PALETTE_HEX.map(
  (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
)

// 4x4 Ordered Bayer Matrix (normalized -0.5 to +0.5)
const BAYER_4X4 = [
  [-0.5, 8 / 16 - 0.5, 2 / 16 - 0.5, 10 / 16 - 0.5],
  [12 / 16 - 0.5, 4 / 16 - 0.5, 14 / 16 - 0.5, 6 / 16 - 0.5],
  [3 / 16 - 0.5, 11 / 16 - 0.5, 1 / 16 - 0.5, 9 / 16 - 0.5],
  [15 / 16 - 0.5, 7 / 16 - 0.5, 13 / 16 - 0.5, 5 / 16 - 0.5],
]

/**
 * Applies the Master Prompt's 16-color 4x4 Ordered Bayer Dithering directly to a Canvas2D context.
 */
function apply16ColorBayerDither(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ditherStrength = 16
): void {
  const imgData = ctx.getImageData(0, 0, w, h)
  const data = imgData.data
  for (let y = 0; y < h; y++) {
    const bayerRow = BAYER_4X4[y & 3]
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      const a = data[idx + 3]
      if (a < 90) {
        data[idx + 3] = 0
        continue
      }
      const bayer = bayerRow[x & 3] * ditherStrength
      const r = Math.min(255, Math.max(0, data[idx] + bayer))
      const g = Math.min(255, Math.max(0, data[idx + 1] + bayer))
      const b = Math.min(255, Math.max(0, data[idx + 2] + bayer))

      let bestDist = Infinity
      let bestColor = PALETTE_RGB[0]
      for (let i = 0; i < PALETTE_RGB.length; i++) {
        const pr = PALETTE_RGB[i][0] - r
        const pg = PALETTE_RGB[i][1] - g
        const pb = PALETTE_RGB[i][2] - b
        const dist = pr * pr + pg * pg + pb * pb
        if (dist < bestDist) {
          bestDist = dist
          bestColor = PALETTE_RGB[i]
        }
      }
      data[idx] = bestColor[0]
      data[idx + 1] = bestColor[1]
      data[idx + 2] = bestColor[2]
      data[idx + 3] = 255
    }
  }
  ctx.putImageData(imgData, 0, 0)
}

/**
 * Draws a 16-Color Bayer-Dithered pixel face for Chief Engineer Komrad Kristianov's Bobblehead!
 * Features thick dark-rimmed nuclear engineer glasses, intense caffeinated night-shift eyes,
 * and reactor-shift stubble.
 */
function drawKristianovBobbleFaceCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  ctx.save()
  ctx.imageSmoothingEnabled = false

  // Warm ivory-beige skin base
  ctx.fillStyle = '#cfc6b0'
  ctx.fillRect(0, 0, w, h)

  // Cheekbone & jawline shadows
  ctx.fillStyle = '#b5ad96'
  ctx.fillRect(0, Math.floor(h * 0.62), w, Math.floor(h * 0.38))
  ctx.fillRect(0, 0, 14, h)
  ctx.fillRect(w - 14, 0, 14, h)

  // 5-o'clock night-shift reactor stubble
  ctx.fillStyle = '#576657'
  for (let y = Math.floor(h * 0.68); y < h - 8; y += 6) {
    for (let x = 20; x < w - 20; x += 6) {
      if ((x + y) % 12 === 0) {
        ctx.fillRect(x, y, 3, 3)
      }
    }
  }

  // Intense furrowed eyebrows
  ctx.fillStyle = '#2b1a12'
  ctx.fillRect(20, 26, 36, 7)
  ctx.fillRect(w - 56, 26, 36, 7)

  // Thick Soviet Bakelite Engineer Glasses (Frames + Bridge)
  ctx.fillStyle = '#0d110f'
  ctx.fillRect(16, 34, 42, 32)
  ctx.fillRect(w - 58, 34, 42, 32)
  ctx.fillRect(58, 44, w - 116, 6)
  ctx.fillRect(6, 42, 10, 5)
  ctx.fillRect(w - 16, 42, 10, 5)

  // Caffeinated wide eyes with Cherenkov green/white reflection inside lenses
  ctx.fillStyle = '#cfc6b0'
  ctx.fillRect(21, 39, 32, 22)
  ctx.fillRect(w - 53, 39, 32, 22)

  // Dark under-eye night-shift bags
  ctx.fillStyle = '#8f8772'
  ctx.fillRect(21, 57, 32, 4)
  ctx.fillRect(w - 53, 57, 32, 4)

  // Pupils + Cherenkov CRT glint
  ctx.fillStyle = '#0d110f'
  ctx.fillRect(32, 44, 12, 12)
  ctx.fillRect(w - 42, 44, 12, 12)
  ctx.fillStyle = '#778472'
  ctx.fillRect(34, 46, 4, 4)
  ctx.fillRect(w - 40, 46, 4, 4)

  // Nose bridge & shadow
  ctx.fillStyle = '#8f8772'
  ctx.fillRect(w / 2 - 5, 50, 10, 26)
  ctx.fillStyle = '#6b442e'
  ctx.fillRect(w / 2 - 7, 72, 14, 5)

  // Determined slight smirk / grimace
  ctx.fillStyle = '#2b1a12'
  ctx.fillRect(w / 2 - 22, 90, 44, 6)
  ctx.fillStyle = '#cfc6b0'
  ctx.fillRect(w / 2 - 16, 91, 32, 3)

  apply16ColorBayerDither(ctx, w, h, 14)
  ctx.restore()
}

/**
 * Draws a 16-Color Bayer-Dithered pixel face for Senior KGB Inspector Komrad Oleg's Bobblehead!
 * Features a stern KGB eagle-eyed scowl, raised inspector eyebrow, and a glorious Soviet mustache.
 */
function drawOlegBobbleFaceCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  ctx.save()
  ctx.imageSmoothingEnabled = false

  // Warm ivory-tan skin base
  ctx.fillStyle = '#cfc6b0'
  ctx.fillRect(0, 0, w, h)

  // Side temple & jaw shading
  ctx.fillStyle = '#b5ad96'
  ctx.fillRect(0, Math.floor(h * 0.64), w, Math.floor(h * 0.36))
  ctx.fillRect(0, 0, 14, h)
  ctx.fillRect(w - 14, 0, 14, h)

  // Stern KGB Inspector Eyebrows (Left angled down, Right raised in suspicion)
  ctx.fillStyle = '#2b1a12'
  ctx.fillRect(20, 30, 36, 8)
  ctx.fillRect(w - 56, 25, 36, 8)

  // Sharp vigilant KGB eyes
  ctx.fillStyle = '#cfc6b0'
  ctx.fillRect(24, 40, 28, 16)
  ctx.fillRect(w - 52, 40, 28, 16)
  ctx.strokeStyle = '#0d110f'
  ctx.lineWidth = 3
  ctx.strokeRect(24, 40, 28, 16)
  ctx.strokeRect(w - 52, 40, 28, 16)

  ctx.fillStyle = '#18211b'
  ctx.fillRect(33, 43, 11, 11)
  ctx.fillRect(w - 43, 43, 11, 11)
  ctx.fillStyle = '#b8a46b'
  ctx.fillRect(35, 45, 3, 3)
  ctx.fillRect(w - 41, 45, 3, 3)

  // Strong sculpted nose
  ctx.fillStyle = '#8f8772'
  ctx.fillRect(w / 2 - 6, 46, 12, 26)
  ctx.fillStyle = '#6b442e'
  ctx.fillRect(w / 2 - 9, 68, 18, 5)

  // Glorious 1984 Soviet Walrus / Handlebar Mustache!
  ctx.fillStyle = '#2b1a12'
  ctx.fillRect(w / 2 - 34, 75, 68, 14)
  ctx.fillRect(w / 2 - 40, 81, 14, 12)
  ctx.fillRect(w / 2 + 26, 81, 14, 12)
  ctx.fillStyle = '#472b1e'
  ctx.fillRect(w / 2 - 28, 77, 56, 5)

  // Stern lower lip below mustache
  ctx.fillStyle = '#6b442e'
  ctx.fillRect(w / 2 - 14, 93, 28, 5)

  apply16ColorBayerDither(ctx, w, h, 14)
  ctx.restore()
}

/**
 * Draws a 16-Color Bayer-Dithered brass nameplate for a Bobblehead pedestal
 * (Dithering applied strictly to the metal background plate BEFORE drawing crisp text).
 */
function drawBobbleNameplateCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  name: string,
  subtitle: string
): void {
  ctx.save()
  ctx.imageSmoothingEnabled = false
  // Clean, solid bright brass plate (#b8a46b) with dark cast-iron border
  ctx.fillStyle = '#0d110f'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#b8a46b'
  ctx.fillRect(4, 4, w - 8, h - 8)
  ctx.strokeStyle = '#472b1e'
  ctx.lineWidth = 2
  ctx.strokeRect(7, 7, w - 14, h - 14)

  // Corner brass rivets
  ctx.fillStyle = '#141414'
  ctx.fillRect(10, 10, 5, 5)
  ctx.fillRect(w - 15, 10, 5, 5)
  ctx.fillRect(10, h - 15, 5, 5)
  ctx.fillRect(w - 15, h - 15, 5, 5)

  // Crisp, high-contrast dark engraved letters on bright brass (#b8a46b)
  ctx.fillStyle = '#0d110f'
  ctx.font = 'bold 22px "Kremlin", "Courier Prime", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, w / 2, 23, w - 28)
  ctx.fillStyle = '#472b1e'
  ctx.font = 'bold 12px "Kremlin", "Courier Prime", monospace'
  ctx.fillText(subtitle, w / 2, 46, w - 24)

  ctx.restore()
}

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
 * Interactive Soviet Bobblehead Figurines of
 * Chief Engineer KOMRAD KRISTIANOV ("KRISTIANOV") and Senior KGB Inspector KOMRAD OLEG ("OLEG").
 * Features damped harmonic spring physics (`stiffness = 190`, `damping = 5.5`), coiled metal neck springs,
 * 16-color Bayer-dithered portraits, direct poke "boing!" SFX, and desk shockwave coupling.
 */
export function KomradBobbleheads3D({ shockwaveRef }: KomradBobbleheads3DProps) {
  const kristianovHeadRef = useRef<THREE.Group | null>(null)
  const olegHeadRef = useRef<THREE.Group | null>(null)

  const physRef = useRef<{
    kristianov: BobbleSpringState
    oleg: BobbleSpringState
  }>({
    kristianov: { angleX: 0, angleZ: 0, velX: 0.8, velZ: -0.5 },
    oleg: { angleX: 0, angleZ: 0, velX: -0.7, velZ: 0.6 },
  })

  const kristianovFace = useMemo(
    () =>
      createNearestCanvasTexture(128, 128, (ctx, w, h) => {
        drawKristianovBobbleFaceCanvas(ctx, w, h)
      }),
    []
  )
  const olegFace = useMemo(
    () =>
      createNearestCanvasTexture(128, 128, (ctx, w, h) => {
        drawOlegBobbleFaceCanvas(ctx, w, h)
      }),
    []
  )
  const kristianovPlate = useMemo(
    () =>
      createNearestCanvasTexture(256, 64, (ctx, w, h) => {
        drawBobbleNameplateCanvas(ctx, w, h, 'KRISTIANOV', 'CHIEF ENG. NPP')
      }),
    []
  )
  const olegPlate = useMemo(
    () =>
      createNearestCanvasTexture(256, 64, (ctx, w, h) => {
        drawBobbleNameplateCanvas(ctx, w, h, 'OLEG', 'SR. KGB INSPECTOR')
      }),
    []
  )

  useEffect(() => {
    const offFont = onKremlinFontReady(() => {
      kristianovPlate.redraw()
      olegPlate.redraw()
    })
    return () => {
      offFont()
      kristianovFace.tex.dispose()
      olegFace.tex.dispose()
      kristianovPlate.tex.dispose()
      olegPlate.tex.dispose()
    }
  }, [kristianovFace, olegFace, kristianovPlate, olegPlate])

  const kristianovFaceTex = kristianovFace.tex
  const olegFaceTex = olegFace.tex
  const kristianovPlateTex = kristianovPlate.tex
  const olegPlateTex = olegPlate.tex

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
          BOBBLEHEAD 1: CHIEF ENGINEER KOMRAD KRISTIANOV ("KRISTIANOV")
          Flanks the left side of the ISKRA-84 desktop CRT monitor
         ============================================================ */}
      <group
        position={[-0.68, 0.926, 0.02]}
        rotation={[0, 0.38, 0]}
        scale={0.86}
        onPointerDown={(e) => pokeBobblehead('kristianov', e)}
      >
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.24, 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* Cast-Iron Stepped Pedestal Base */}
        <mesh position={[0, 0.012, 0]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.062, 0.072, 0.024, 14]} />
          <meshStandardMaterial
            color="#18211b"
            roughness={0.6}
            metalness={0.55}
          />
        </mesh>
        <mesh position={[0, 0.026, 0]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.052, 0.058, 0.008, 14]} />
          <meshStandardMaterial
            color="#8c7a4b"
            roughness={0.35}
            metalness={0.8}
          />
        </mesh>
        {/* Bright Brass Pedestal Nameplate ("KRISTIANOV") */}
        <mesh position={[0, 0.017, 0.072]} rotation={[-0.28, 0, 0]} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.118, 0.036]} />
          <meshStandardMaterial
            map={kristianovPlateTex}
            emissive="#ffffff"
            emissiveMap={kristianovPlateTex}
            emissiveIntensity={0.28}
            roughness={0.4}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>

        {/* Soviet Nuclear Engineer Lab Coat Torso & Dark Trousers */}
        <mesh position={[-0.016, 0.048, 0]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.013, 0.015, 0.04, 8]} />
          <meshStandardMaterial color="#18211b" roughness={0.8} />
        </mesh>
        <mesh position={[0.016, 0.048, 0]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.013, 0.015, 0.04, 8]} />
          <meshStandardMaterial color="#18211b" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.098, 0]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.036, 0.044, 0.078, 12]} />
          <meshStandardMaterial color="#cfc6b0" roughness={0.75} />
        </mesh>
        {/* Dark tie & Radiation Dosimeter Badge on Chest */}
        <mesh position={[0, 0.106, 0.038]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.01, 0.042, 0.006]} />
          <meshStandardMaterial color="#8b1e1e" roughness={0.6} />
        </mesh>
        <mesh position={[0.018, 0.114, 0.038]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.016, 0.012, 0.006]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>

        {/* Left Arm holding a Glowing Cherenkov Fuel Rod */}
        <group position={[-0.046, 0.102, 0.01]} rotation={[0.45, 0, 0.28]}>
          <mesh raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.01, 0.011, 0.052, 8]} />
            <meshStandardMaterial color="#cfc6b0" roughness={0.75} />
          </mesh>
          <mesh position={[0, -0.028, 0.018]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
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
          <mesh raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.01, 0.011, 0.052, 8]} />
            <meshStandardMaterial color="#cfc6b0" roughness={0.75} />
          </mesh>
          <mesh position={[0, -0.025, 0.016]} rotation={[Math.PI / 3, 0, 0]} raycast={NOOP_RAYCAST}>
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
            raycast={NOOP_RAYCAST}
          >
            <torusGeometry args={[0.014, 0.0032, 6, 12]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.88}
              roughness={0.25}
            />
          </mesh>
        ))}

        {/* Spring-Mounted Oversized Bobble Head ("KRISTIANOV") */}
        <group ref={kristianovHeadRef} position={[0, 0.172, 0]}>
          <mesh position={[0, 0.036, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.076, 0.074, 0.072]} />
            <meshStandardMaterial color="#cfc6b0" roughness={0.75} />
          </mesh>
          {/* 16-Color Bayer-Dithered Face Portrait on Front */}
          <mesh position={[0, 0.036, 0.037]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.072, 0.07]} />
            <meshStandardMaterial
              map={kristianovFaceTex}
              roughness={0.65}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
          {/* Soviet Winter Ushanka Hat with Ear Flaps & Red Enamel Star */}
          <mesh position={[0, 0.078, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.086, 0.032, 0.082]} />
            <meshStandardMaterial color="#23312b" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.076, 0.041]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.076, 0.024, 0.008]} />
            <meshStandardMaterial color="#18211b" roughness={0.92} />
          </mesh>
          <mesh position={[-0.044, 0.052, 0]} rotation={[0, 0, 0.12]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.012, 0.042, 0.046]} />
            <meshStandardMaterial color="#18211b" roughness={0.9} />
          </mesh>
          <mesh position={[0.044, 0.052, 0]} rotation={[0, 0, -0.12]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.012, 0.042, 0.046]} />
            <meshStandardMaterial color="#18211b" roughness={0.9} />
          </mesh>
          {/* Red Star Cockade on Ushanka */}
          <mesh position={[0, 0.078, 0.047]} raycast={NOOP_RAYCAST}>
            <circleGeometry args={[0.01, 5]} />
            <meshStandardMaterial
              color="#ff2a2a"
              emissive="#8b1e1e"
              emissiveIntensity={0.4}
              roughness={0.35}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
        </group>
      </group>

      {/* ============================================================
          BOBBLEHEAD 2: SENIOR KGB INSPECTOR KOMRAD OLEG ("OLEG")
          Flanks the right side of the ISKRA-84 desktop CRT monitor
         ============================================================ */}
      <group
        position={[0.68, 0.926, 0.02]}
        rotation={[0, -0.38, 0]}
        scale={0.86}
        onPointerDown={(e) => pokeBobblehead('oleg', e)}
      >
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.24, 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* Cast-Iron Stepped Pedestal Base */}
        <mesh position={[0, 0.012, 0]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.062, 0.072, 0.024, 14]} />
          <meshStandardMaterial
            color="#18211b"
            roughness={0.6}
            metalness={0.55}
          />
        </mesh>
        <mesh position={[0, 0.026, 0]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.052, 0.058, 0.008, 14]} />
          <meshStandardMaterial
            color="#8c7a4b"
            roughness={0.35}
            metalness={0.8}
          />
        </mesh>
        {/* Bright Brass Pedestal Nameplate ("OLEG") */}
        <mesh position={[0, 0.017, 0.072]} rotation={[-0.28, 0, 0]} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.118, 0.036]} />
          <meshStandardMaterial
            map={olegPlateTex}
            emissive="#ffffff"
            emissiveMap={olegPlateTex}
            emissiveIntensity={0.28}
            roughness={0.4}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>

        {/* Olive-Drab KGB Senior Officer Tunic, Gold Epaulets & Red Collar Tabs */}
        <mesh position={[-0.016, 0.048, 0]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.013, 0.015, 0.04, 8]} />
          <meshStandardMaterial color="#18211b" roughness={0.8} />
        </mesh>
        <mesh position={[0.016, 0.048, 0]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.013, 0.015, 0.04, 8]} />
          <meshStandardMaterial color="#18211b" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.098, 0]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.036, 0.044, 0.078, 12]} />
          <meshStandardMaterial color="#2a362b" roughness={0.7} />
        </mesh>
        {/* Gold Shoulder Epaulets & Order of the Red Banner of Labor Medal */}
        <mesh position={[-0.032, 0.134, 0]} rotation={[0, 0, 0.15]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.026, 0.006, 0.022]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.85}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[0.032, 0.134, 0]} rotation={[0, 0, -0.15]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.026, 0.006, 0.022]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.85}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[-0.016, 0.114, 0.038]} raycast={NOOP_RAYCAST}>
          <circleGeometry args={[0.009, 8]} />
          <meshStandardMaterial
            color="#ff2a2a"
            metalness={0.6}
            roughness={0.3}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>

        {/* Left Arm holding a Miniature Brass 2x Loupe */}
        <group position={[-0.046, 0.102, 0.01]} rotation={[-0.4, 0, 0.26]}>
          <mesh raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.01, 0.011, 0.052, 8]} />
            <meshStandardMaterial color="#2a362b" roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.028, 0.016]} raycast={NOOP_RAYCAST}>
            <torusGeometry args={[0.014, 0.003, 6, 12]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.85}
              roughness={0.25}
            />
          </mesh>
        </group>

        {/* Right Arm holding a Miniature Red SHREDDED Rubber Stamp */}
        <group position={[0.046, 0.102, 0.01]} rotation={[-0.48, 0, -0.26]}>
          <mesh raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.01, 0.011, 0.052, 8]} />
            <meshStandardMaterial color="#2a362b" roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.026, 0.014]} raycast={NOOP_RAYCAST}>
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
            raycast={NOOP_RAYCAST}
          >
            <torusGeometry args={[0.014, 0.0032, 6, 12]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.88}
              roughness={0.25}
            />
          </mesh>
        ))}

        {/* Spring-Mounted Oversized Bobble Head ("OLEG") */}
        <group ref={olegHeadRef} position={[0, 0.172, 0]}>
          <mesh position={[0, 0.036, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.076, 0.074, 0.072]} />
            <meshStandardMaterial color="#cfc6b0" roughness={0.75} />
          </mesh>
          {/* 16-Color Bayer-Dithered Face Portrait with Glorious Soviet Mustache */}
          <mesh position={[0, 0.036, 0.037]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.072, 0.07]} />
            <meshStandardMaterial
              map={olegFaceTex}
              roughness={0.65}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
          {/* Sculpted 3D Mustache Relief Bar for Extra Depth */}
          <mesh position={[0, 0.022, 0.04]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.048, 0.01, 0.008]} />
            <meshStandardMaterial color="#2b1a12" roughness={0.85} />
          </mesh>

          {/* KGB Officer Peaked Visor Cap (Furazhka) with Crimson Band & Gold Cockade */}
          <mesh position={[0, 0.074, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.046, 0.044, 0.014, 14]} />
            <meshStandardMaterial color="#8b1e1e" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.088, -0.004]} rotation={[-0.12, 0, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.062, 0.046, 0.018, 16]} />
            <meshStandardMaterial color="#2a362b" roughness={0.7} />
          </mesh>
          {/* Glossy Black Visor Brim */}
          <mesh position={[0, 0.068, 0.036]} rotation={[0.28, 0, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.068, 0.004, 0.028]} />
            <meshStandardMaterial
              color="#0d110f"
              roughness={0.2}
              metalness={0.4}
            />
          </mesh>
          {/* Golden Star Cockade on KGB Cap */}
          <mesh position={[0, 0.076, 0.045]} raycast={NOOP_RAYCAST}>
            <circleGeometry args={[0.009, 5]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.85}
              roughness={0.2}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
        </group>
      </group>
    </>
  )
}

