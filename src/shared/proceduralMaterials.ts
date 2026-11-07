import * as THREE from 'three'

export interface HammeredIronMaps {
  bumpMap: THREE.CanvasTexture
  roughnessMap: THREE.CanvasTexture
}

export interface BrushedBrassMaps {
  bumpMap: THREE.CanvasTexture
  roughnessMap: THREE.CanvasTexture
}

export interface WornMatMaps {
  map: THREE.CanvasTexture
  bumpMap: THREE.CanvasTexture
  roughnessMap: THREE.CanvasTexture
}

export interface MahoganyWoodMaps {
  map: THREE.CanvasTexture
  bumpMap: THREE.CanvasTexture
  roughnessMap: THREE.CanvasTexture
}

let cachedIron: HammeredIronMaps | null = null
let cachedBrass: BrushedBrassMaps | null = null
let cachedMat: WornMatMaps | null = null
let cachedWood: MahoganyWoodMaps | null = null

function seededHash(x: number, y: number, seed = 84): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
  return n - Math.floor(n)
}

function configureProceduralTexture(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
  isColor = false
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  if (repeatX > 1 || repeatY > 1) {
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeatX, repeatY)
  } else {
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
  }
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

/**
 * 1. Hammered Soviet Cast-Iron (`bumpMap` + `roughnessMap`)
 * High-frequency stippled metal pitted texture with subtle edge-wear scratches
 * (`metalness: 0.65, roughness: 0.45, bumpScale: 0.008`).
 */
export function getHammeredIronTextures(): HammeredIronMaps {
  if (cachedIron) return cachedIron

  const size = 256
  const bumpCanvas = document.createElement('canvas')
  bumpCanvas.width = size
  bumpCanvas.height = size
  const bCtx = bumpCanvas.getContext('2d')

  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = size
  roughCanvas.height = size
  const rCtx = roughCanvas.getContext('2d')

  if (bCtx && rCtx) {
    bCtx.imageSmoothingEnabled = false
    rCtx.imageSmoothingEnabled = false

    bCtx.fillStyle = '#808080'
    bCtx.fillRect(0, 0, size, size)
    rCtx.fillStyle = '#8c8c8c'
    rCtx.fillRect(0, 0, size, size)

    // Stippled cast-iron dimples and pits
    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        const h1 = seededHash(x, y, 1984)
        const h2 = seededHash(x >> 1, y >> 1, 84)
        const v = Math.floor(96 + (h1 * 0.6 + h2 * 0.4) * 72)
        bCtx.fillStyle = `rgb(${v},${v},${v})`
        bCtx.fillRect(x, y, 2, 2)

        const rv = Math.floor(175 - (h1 * 0.5 + h2 * 0.5) * 65)
        rCtx.fillStyle = `rgb(${rv},${rv},${rv})`
        rCtx.fillRect(x, y, 2, 2)
      }
    }

    // Hammered peen craters
    for (let i = 0; i < 220; i++) {
      const cx = Math.floor(seededHash(i, 1, 41) * size)
      const cy = Math.floor(seededHash(i, 2, 41) * size)
      const rad = 2 + Math.floor(seededHash(i, 3, 41) * 4)
      bCtx.fillStyle = '#525252'
      bCtx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2)
      bCtx.fillStyle = '#b4b4b4'
      bCtx.fillRect(cx - rad + 1, cy - rad + 1, rad, rad)
    }

    // Subtle industrial edge-wear micro-scratches
    bCtx.strokeStyle = '#d6d6d6'
    rCtx.strokeStyle = '#484848'
    bCtx.lineWidth = 1
    rCtx.lineWidth = 1
    for (let s = 0; s < 48; s++) {
      const sx = Math.floor(seededHash(s, 10, 77) * size)
      const sy = Math.floor(seededHash(s, 20, 77) * size)
      const len = 8 + Math.floor(seededHash(s, 30, 77) * 22)
      const ang = (seededHash(s, 40, 77) - 0.5) * 0.9
      const ex = sx + Math.cos(ang) * len
      const ey = sy + Math.sin(ang) * len
      bCtx.beginPath()
      bCtx.moveTo(sx, sy)
      bCtx.lineTo(ex, ey)
      bCtx.stroke()

      rCtx.beginPath()
      rCtx.moveTo(sx, sy)
      rCtx.lineTo(ex, ey)
      rCtx.stroke()
    }
  }

  cachedIron = {
    bumpMap: configureProceduralTexture(bumpCanvas, 3, 3, false),
    roughnessMap: configureProceduralTexture(roughCanvas, 3, 3, false),
  }
  return cachedIron
}

/**
 * 2. Brushed & Tarnished Brass (`bumpMap` + `roughnessMap`)
 * Fine anisotropic grain texture for the Magnifying Glass rim, desk corner brackets,
 * pneumatic tube cylinder, and gauge bezels (`metalness: 0.85, roughness: 0.28`).
 */
export function getBrushedBrassTextures(): BrushedBrassMaps {
  if (cachedBrass) return cachedBrass

  const size = 256
  const bumpCanvas = document.createElement('canvas')
  bumpCanvas.width = size
  bumpCanvas.height = size
  const bCtx = bumpCanvas.getContext('2d')

  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = size
  roughCanvas.height = size
  const rCtx = roughCanvas.getContext('2d')

  if (bCtx && rCtx) {
    bCtx.imageSmoothingEnabled = false
    rCtx.imageSmoothingEnabled = false

    // Horizontal anisotropic lathe-turned brush lines
    for (let y = 0; y < size; y++) {
      const rowNoise = seededHash(0, y, 55)
      const bVal = Math.floor(110 + rowNoise * 45)
      const rVal = Math.floor(58 + (1 - rowNoise) * 42)
      bCtx.fillStyle = `rgb(${bVal},${bVal},${bVal})`
      bCtx.fillRect(0, y, size, 1)
      rCtx.fillStyle = `rgb(${rVal},${rVal},${rVal})`
      rCtx.fillRect(0, y, size, 1)

      for (let x = 0; x < size; x += 8) {
        const streak = seededHash(x, y, 99)
        if (streak > 0.65) {
          bCtx.fillStyle = '#a8a8a8'
          bCtx.fillRect(x, y, 6, 1)
          rCtx.fillStyle = '#343434'
          rCtx.fillRect(x, y, 6, 1)
        }
      }
    }

    // Subtle aged patina tarnish specks
    for (let i = 0; i < 160; i++) {
      const px = Math.floor(seededHash(i, 4, 12) * size)
      const py = Math.floor(seededHash(i, 8, 12) * size)
      bCtx.fillStyle = '#585858'
      bCtx.fillRect(px, py, 3, 2)
      rCtx.fillStyle = '#b8b8b8'
      rCtx.fillRect(px, py, 3, 2)
    }
  }

  cachedBrass = {
    bumpMap: configureProceduralTexture(bumpCanvas, 2, 2, false),
    roughnessMap: configureProceduralTexture(roughCanvas, 2, 2, false),
  }
  return cachedBrass
}

/**
 * 3. Worn Soviet Inspection Mat (`#16241f`)
 * Cross-grain leather/baize texture with darkened coffee-mug rings, ink smudges,
 * and worn scuffed areas in the center where papers are handled (`roughness: 0.85, bumpScale: 0.004`).
 */
export function getWornInspectionMatTextures(): WornMatMaps {
  if (cachedMat) return cachedMat

  const w = 512
  const h = 512

  const colorCanvas = document.createElement('canvas')
  colorCanvas.width = w
  colorCanvas.height = h
  const cCtx = colorCanvas.getContext('2d')

  const bumpCanvas = document.createElement('canvas')
  bumpCanvas.width = 256
  bumpCanvas.height = 256
  const bCtx = bumpCanvas.getContext('2d')

  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = w
  roughCanvas.height = h
  const rCtx = roughCanvas.getContext('2d')

  if (cCtx && bCtx && rCtx) {
    cCtx.imageSmoothingEnabled = false
    bCtx.imageSmoothingEnabled = false
    rCtx.imageSmoothingEnabled = false

    // Base #16241f leather/baize tone
    cCtx.fillStyle = '#16241f'
    cCtx.fillRect(0, 0, w, h)

    rCtx.fillStyle = '#d8d8d8'
    rCtx.fillRect(0, 0, w, h)

    // Cross-grain leather/baize stipple & worn center highlight
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const nx = (x / w) * 2 - 1
        const ny = (y / h) * 2 - 1
        const distCenter = Math.hypot(nx * 0.85, ny * 1.05)
        const centerWear = Math.max(0, 1 - distCenter * 1.15)
        const edgeDarken = Math.max(0, (distCenter - 0.72) * 1.4)
        const grain = (seededHash(x, y, 31) - 0.5) * 10

        const r = Math.max(
          8,
          Math.min(48, Math.round(22 + centerWear * 11 - edgeDarken * 10 + grain))
        )
        const g = Math.max(
          14,
          Math.min(68, Math.round(36 + centerWear * 16 - edgeDarken * 14 + grain))
        )
        const b = Math.max(
          12,
          Math.min(58, Math.round(31 + centerWear * 13 - edgeDarken * 12 + grain))
        )
        cCtx.fillStyle = `rgb(${r},${g},${b})`
        cCtx.fillRect(x, y, 2, 2)

        const roughVal = Math.max(
          140,
          Math.min(245, Math.round(225 - centerWear * 48 + grain * 2))
        )
        rCtx.fillStyle = `rgb(${roughVal},${roughVal},${roughVal})`
        rCtx.fillRect(x, y, 2, 2)
      }
    }

    // Subtle diagonal cross-hatch scuff marks in central document handling zone
    cCtx.strokeStyle = 'rgba(38, 58, 49, 0.35)'
    cCtx.lineWidth = 1
    for (let i = 0; i < 95; i++) {
      const sx = 110 + seededHash(i, 1, 63) * 290
      const sy = 140 + seededHash(i, 2, 63) * 240
      const len = 10 + seededHash(i, 3, 63) * 26
      const ang = (seededHash(i, 4, 63) - 0.5) * 0.7
      cCtx.beginPath()
      cCtx.moveTo(sx, sy)
      cCtx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len)
      cCtx.stroke()
    }

    // Darkened Soviet tea-glass / coffee-mug stain rings
    const mugRings = [
      { x: 138, y: 128, r: 24 },
      { x: 144, y: 132, r: 22 },
      { x: 392, y: 368, r: 26 },
    ]
    for (const ring of mugRings) {
      cCtx.strokeStyle = 'rgba(10, 14, 11, 0.55)'
      cCtx.lineWidth = 3
      cCtx.beginPath()
      cCtx.arc(ring.x, ring.y, ring.r, 0.2, Math.PI * 1.85)
      cCtx.stroke()

      rCtx.strokeStyle = '#909090'
      rCtx.lineWidth = 3
      rCtx.beginPath()
      rCtx.arc(ring.x, ring.y, ring.r, 0.2, Math.PI * 1.85)
      rCtx.stroke()
    }

    // Stamp ink smudges near upper-right stamp dock & center
    const smudges = [
      { x: 365, y: 118, r: 14, col: 'rgba(18, 62, 30, 0.38)' },
      { x: 412, y: 124, r: 16, col: 'rgba(88, 20, 20, 0.38)' },
      { x: 248, y: 274, r: 11, col: 'rgba(72, 18, 18, 0.25)' },
      { x: 196, y: 312, r: 9, col: 'rgba(14, 20, 17, 0.45)' },
    ]
    for (const sm of smudges) {
      cCtx.fillStyle = sm.col
      cCtx.beginPath()
      cCtx.arc(sm.x, sm.y, sm.r, 0, Math.PI * 2)
      cCtx.fill()
    }

    // High-frequency leather pebble & cross-grain bumpMap
    for (let y = 0; y < 256; y += 2) {
      for (let x = 0; x < 256; x += 2) {
        const weave = ((x + y) & 2) === 0 ? 18 : -18
        const pebble = (seededHash(x, y, 71) - 0.5) * 44
        const bv = Math.max(40, Math.min(220, Math.round(128 + weave + pebble)))
        bCtx.fillStyle = `rgb(${bv},${bv},${bv})`
        bCtx.fillRect(x, y, 2, 2)
      }
    }
  }

  cachedMat = {
    map: configureProceduralTexture(colorCanvas, 1, 1, true),
    bumpMap: configureProceduralTexture(bumpCanvas, 6, 4, false),
    roughnessMap: configureProceduralTexture(roughCanvas, 1, 1, false),
  }
  return cachedMat
}

/**
 * 4. Weathered Mahogany Wood (`map` + `bumpMap` + `roughnessMap`)
 * Dark wood-grain streaks and varnish variation on the desk frame and stamp handles (`roughness: 0.52`).
 */
export function getWeatheredMahoganyTextures(): MahoganyWoodMaps {
  if (cachedWood) return cachedWood

  const size = 256
  const colorCanvas = document.createElement('canvas')
  colorCanvas.width = size
  colorCanvas.height = size
  const cCtx = colorCanvas.getContext('2d')

  const bumpCanvas = document.createElement('canvas')
  bumpCanvas.width = size
  bumpCanvas.height = size
  const bCtx = bumpCanvas.getContext('2d')

  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = size
  roughCanvas.height = size
  const rCtx = roughCanvas.getContext('2d')

  if (cCtx && bCtx && rCtx) {
    cCtx.imageSmoothingEnabled = false
    bCtx.imageSmoothingEnabled = false
    rCtx.imageSmoothingEnabled = false

    for (let y = 0; y < size; y++) {
      const wave =
        Math.sin(y * 0.14) * 0.5 +
        Math.sin(y * 0.37 + 1.4) * 0.3 +
        (seededHash(0, y, 108) - 0.5) * 0.4
      for (let x = 0; x < size; x += 2) {
        const fiber =
          Math.sin((y + Math.sin(x * 0.05) * 6) * 0.28) * 0.5 +
          (seededHash(x, y, 19) - 0.5) * 0.35
        const t = Math.max(0, Math.min(1, 0.5 + (wave + fiber) * 0.38))

        const r = Math.round(38 + t * 36)
        const g = Math.round(20 + t * 21)
        const b = Math.round(13 + t * 14)
        cCtx.fillStyle = `rgb(${r},${g},${b})`
        cCtx.fillRect(x, y, 2, 1)

        const bv = Math.round(90 + t * 80)
        bCtx.fillStyle = `rgb(${bv},${bv},${bv})`
        bCtx.fillRect(x, y, 2, 1)

        const rv = Math.round(115 + (1 - t) * 55)
        rCtx.fillStyle = `rgb(${rv},${rv},${rv})`
        rCtx.fillRect(x, y, 2, 1)
      }
    }
  }

  cachedWood = {
    map: configureProceduralTexture(colorCanvas, 2, 2, true),
    bumpMap: configureProceduralTexture(bumpCanvas, 2, 2, false),
    roughnessMap: configureProceduralTexture(roughCanvas, 2, 2, false),
  }
  return cachedWood
}

/**
 * Traverses a 3D hierarchy (`.glb` scene or station `<group>`), enables `castShadow` and `receiveShadow`
 * on physical opaque meshes, and upgrades bare solid-color `MeshStandardMaterial` instances with
 * Hammered Cast-Iron, Brushed Brass, or Weathered Mahogany procedural PBR maps.
 */
export function applySovietPBRToHierarchy(
  root: THREE.Object3D | null | undefined
): void {
  if (!root) return
  const iron = getHammeredIronTextures()
  const brass = getBrushedBrassTextures()
  const wood = getWeatheredMahoganyTextures()

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    if (!obj.visible) return

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    let isTransparentOrAdditive = false

    for (const mat of mats) {
      if (!mat) continue
      if (mat.transparent || mat.blending === THREE.AdditiveBlending) {
        isTransparentOrAdditive = true
      }

      if (mat instanceof THREE.MeshStandardMaterial) {
        // Keep dynamic/UI CanvasTexture screens, plaques & custom-bumped meshes untouched
        if (mat.map || mat.bumpMap) continue
        // Skip brightly glowing bulbs/LEDs
        if (mat.emissiveIntensity > 0.35) continue

        const c = mat.color
        // Preserve vibrant painted Bakelite/enamel/porcelain colors (crimson, hazard yellow, green plunger, porcelain white)
        const maxCh = Math.max(c.r, c.g, c.b)
        const minCh = Math.min(c.r, c.g, c.b)
        const saturation = maxCh > 0 ? (maxCh - minCh) / maxCh : 0
        if (saturation > 0.42 || maxCh > 0.78) continue

        const isBrass =
          mat.metalness >= 0.72 ||
          (c.r > 0.48 && c.g > 0.38 && c.b < 0.38 && mat.metalness >= 0.5)
        const isWood =
          mat.metalness < 0.3 &&
          c.r > 0.14 &&
          c.r > c.g * 1.32 &&
          c.g > c.b * 1.15

        if (isBrass) {
          mat.bumpMap = brass.bumpMap
          mat.bumpScale = 0.005
          mat.roughnessMap = brass.roughnessMap
          mat.metalness = Math.max(mat.metalness, 0.85)
          mat.roughness = 0.28
          mat.needsUpdate = true
        } else if (isWood) {
          mat.bumpMap = wood.bumpMap
          mat.bumpScale = 0.005
          mat.roughnessMap = wood.roughnessMap
          mat.roughness = 0.52
          mat.needsUpdate = true
        } else {
          mat.bumpMap = iron.bumpMap
          mat.bumpScale = 0.008
          mat.roughnessMap = iron.roughnessMap
          mat.metalness = Math.max(mat.metalness, 0.55)
          mat.roughness = Math.min(mat.roughness, 0.52)
          mat.needsUpdate = true
        }
      }
    }

    if (!isTransparentOrAdditive) {
      obj.castShadow = true
      obj.receiveShadow = true
    }
  })
}
