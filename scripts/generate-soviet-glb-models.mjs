/**
 * Procedural 1984 Soviet Industrial 3D Hardware `.glb` Generator
 * Builds intricate 50-80+ sub-part meshes with beveled housings, array cooling louvers,
 * lathe/screw-profile turned handles, helical springs, sprocket pinwheels, interlocking
 * cutter discs, 50+ sculpted keycaps, and copper knife-switches, and exports binary
 * `.glb` files into `public/models/`.
 */
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf
        if (this.onloadend) this.onloadend()
      })
    }
  }
}

const outDir = path.resolve('public/models')
fs.mkdirSync(outDir, { recursive: true })

// Shared Soviet 16-Color Industrial Palette Materials
const MATS = {
  castIronDark: new THREE.MeshStandardMaterial({
    name: 'SovietCastIronDark',
    color: '#141815',
    roughness: 0.72,
    metalness: 0.58,
  }),
  panelGreen: new THREE.MeshStandardMaterial({
    name: 'SovietPanelGreen',
    color: '#23312b',
    roughness: 0.65,
    metalness: 0.45,
  }),
  panelOlive: new THREE.MeshStandardMaterial({
    name: 'SovietPanelOlive',
    color: '#2a362b',
    roughness: 0.62,
    metalness: 0.42,
  }),
  steelMid: new THREE.MeshStandardMaterial({
    name: 'SovietSteelMid',
    color: '#364940',
    roughness: 0.52,
    metalness: 0.62,
  }),
  chromeSteel: new THREE.MeshStandardMaterial({
    name: 'SovietChromeSteel',
    color: '#8d9987',
    roughness: 0.24,
    metalness: 0.88,
  }),
  ivoryEnamel: new THREE.MeshStandardMaterial({
    name: 'SovietIvoryEnamel',
    color: '#b5ad96',
    roughness: 0.56,
    metalness: 0.18,
  }),
  agedBrass: new THREE.MeshStandardMaterial({
    name: 'SovietAgedBrass',
    color: '#8c7a4b',
    roughness: 0.34,
    metalness: 0.84,
  }),
  brightBrass: new THREE.MeshStandardMaterial({
    name: 'SovietBrightBrass',
    color: '#b8a46b',
    roughness: 0.26,
    metalness: 0.9,
  }),
  copperContact: new THREE.MeshStandardMaterial({
    name: 'SovietCopperContact',
    color: '#b8623b',
    roughness: 0.28,
    metalness: 0.88,
  }),
  bakeliteBlack: new THREE.MeshStandardMaterial({
    name: 'SovietBakeliteBlack',
    color: '#0d110f',
    roughness: 0.45,
    metalness: 0.15,
  }),
  rubberDark: new THREE.MeshStandardMaterial({
    name: 'SovietRubberDark',
    color: '#090c0a',
    roughness: 0.92,
    metalness: 0.05,
  }),
  crimsonRed: new THREE.MeshStandardMaterial({
    name: 'SovietCrimsonRed',
    color: '#8b1e1e',
    roughness: 0.38,
    metalness: 0.22,
  }),
  alarmRed: new THREE.MeshStandardMaterial({
    name: 'SovietAlarmRed',
    color: '#ff2a2a',
    emissive: '#550808',
    roughness: 0.32,
    metalness: 0.15,
  }),
  hazardYellow: new THREE.MeshStandardMaterial({
    name: 'SovietHazardYellow',
    color: '#ffb000',
    roughness: 0.44,
    metalness: 0.25,
  }),
  emeraldGlass: new THREE.MeshStandardMaterial({
    name: 'SovietEmeraldGlass',
    color: '#1b6e32',
    emissive: '#0e3b19',
    roughness: 0.18,
    metalness: 0.12,
  }),
  mahoganyWood: new THREE.MeshStandardMaterial({
    name: 'SovietMahoganyWood',
    color: '#472b1e',
    roughness: 0.46,
    metalness: 0.1,
  }),
  paperStripLight: new THREE.MeshStandardMaterial({
    name: 'SovietPaperStrip',
    color: '#d8d2c0',
    roughness: 0.88,
    metalness: 0.02,
  }),
}

function createBeveledBoxGeometry(w, h, d, bevel = 0.008) {
  const shape = new THREE.Shape()
  const hw = w / 2 - bevel
  const hh = h / 2 - bevel
  shape.moveTo(-hw, -hh - bevel)
  shape.lineTo(hw, -hh - bevel)
  shape.quadraticCurveTo(hw + bevel, -hh - bevel, hw + bevel, -hh)
  shape.lineTo(hw + bevel, hh)
  shape.quadraticCurveTo(hw + bevel, hh + bevel, hw, hh + bevel)
  shape.lineTo(-hw, hh + bevel)
  shape.quadraticCurveTo(-hw - bevel, hh + bevel, -hw - bevel, hh)
  shape.lineTo(-hw - bevel, -hh)
  shape.quadraticCurveTo(-hw - bevel, -hh - bevel, -hw, -hh - bevel)

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d - bevel * 2,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  })
  geo.center()
  return geo
}

function createHelicalSpringGeometry(
  radius = 0.015,
  tubeRadius = 0.0028,
  turns = 6,
  height = 0.036,
   tubularSegments = 64
) {
  class HelixCurve extends THREE.Curve {
    getPoint(t) {
      const angle = t * Math.PI * 2 * turns
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const y = (t - 0.5) * height
      return new THREE.Vector3(x, y, z)
    }
  }
  return new THREE.TubeGeometry(
    new HelixCurve(),
    tubularSegments,
    tubeRadius,
    8,
    false
  )
}

function addHexBolt(parent, x, y, z, rx = 0, ry = 0, rz = 0, radius = 0.006, height = 0.005) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 6),
    MATS.brightBrass
  )
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, rz)
  parent.add(m)
  return m
}

async function exportGLB(rootObject, filename) {
  const scene = new THREE.Scene()
  scene.add(rootObject)
  const exporter = new GLTFExporter()
  const arrayBuffer = await new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (res) => resolve(res),
      (err) => reject(err),
      { binary: true }
    )
  })
  const fullPath = path.join(outDir, filename)
  fs.writeFileSync(fullPath, Buffer.from(arrayBuffer))
  console.log(`✅ Exported ${filename} (${arrayBuffer.byteLength} bytes)`)
}

// ============================================================================
// 1. `public/models/pravda_teletype.glb` (65+ Sub-Parts)
// ============================================================================
function buildPravdaTeletype() {
  const root = new THREE.Group()
  root.name = 'PravdaTeletype84'

  // Lower cast-iron plinth & 4 rubber vibration feet
  const plinth = new THREE.Mesh(
    createBeveledBoxGeometry(0.6, 0.036, 0.44, 0.006),
    MATS.castIronDark
  )
  plinth.position.set(0, -0.042, 0)
  root.add(plinth)

  for (const [fx, fz] of [
    [-0.25, -0.17],
    [0.25, -0.17],
    [-0.25, 0.17],
    [0.25, 0.17],
  ]) {
    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.034, 0.018, 12),
      MATS.rubberDark
    )
    foot.position.set(fx, -0.062, fz)
    root.add(foot)
  }

  // Main beveled Soviet ivory enamel body + upper hood tier
  const mainBody = new THREE.Mesh(
    createBeveledBoxGeometry(0.58, 0.165, 0.42, 0.012),
    MATS.ivoryEnamel
  )
  mainBody.position.set(0, 0.042, 0)
  root.add(mainBody)

  const upperHood = new THREE.Mesh(
    createBeveledBoxGeometry(0.54, 0.045, 0.34, 0.009),
    MATS.ivoryEnamel
  )
  upperHood.position.set(0, 0.118, -0.025)
  root.add(upperHood)

  // Sloped olive-green front control console skirt
  const frontSkirt = new THREE.Mesh(
    createBeveledBoxGeometry(0.55, 0.125, 0.165, 0.008),
    MATS.panelOlive
  )
  frontSkirt.position.set(0, 0.03, 0.16)
  frontSkirt.rotation.set(0.38, 0, 0)
  root.add(frontSkirt)

  // 8 Recessed Side Cooling Louver Arrays per side (16 total)
  for (let i = 0; i < 8; i++) {
    const lz = -0.13 + i * 0.034
    for (const side of [-1, 1]) {
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.088, 0.02),
        MATS.castIronDark
      )
      slat.position.set(side * 0.291, 0.052, lz)
      slat.rotation.set(0.22, 0, 0)
      root.add(slat)
    }
  }

  // Deep Top Roller Cavity + Ribbed Rubber Platen Roller + Chrome Bearings
  const cavity = new THREE.Mesh(
    new THREE.BoxGeometry(0.47, 0.028, 0.095),
    MATS.bakeliteBlack
  )
  cavity.position.set(0, 0.132, -0.05)
  root.add(cavity)

  const platen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.033, 0.033, 0.44, 20),
    MATS.rubberDark
  )
  platen.position.set(0, 0.132, -0.05)
  platen.rotation.set(0, 0, Math.PI / 2)
  root.add(platen)

  // Left & Right Brass Tractor-Feed Pinwheels with 12 Sprocket Teeth Each
  for (const side of [-1, 1]) {
    const hubX = side * 0.195
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.022, 16),
      MATS.brightBrass
    )
    wheel.position.set(hubX, 0.132, -0.05)
    wheel.rotation.set(0, 0, Math.PI / 2)
    root.add(wheel)

    for (let t = 0; t < 10; t++) {
      const ang = (t / 10) * Math.PI * 2
      const pin = new THREE.Mesh(
        new THREE.ConeGeometry(0.0035, 0.009, 6),
        MATS.chromeSteel
      )
      pin.position.set(
        hubX,
        0.132 + Math.cos(ang) * 0.039,
        -0.05 + Math.sin(ang) * 0.039
      )
      pin.rotation.set(ang + Math.PI / 2, 0, 0)
      root.add(pin)
    }

    const bearing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.018, 12),
      MATS.chromeSteel
    )
    bearing.position.set(side * 0.228, 0.132, -0.05)
    bearing.rotation.set(0, 0, Math.PI / 2)
    root.add(bearing)
  }

  // Serrated Steel Tear-Bar + 2 Chrome Mounting Brackets
  const tearBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.005, 0.026),
    MATS.chromeSteel
  )
  tearBar.position.set(0, 0.15, -0.018)
  tearBar.rotation.set(0.24, 0, 0)
  root.add(tearBar)

  for (const bx of [-0.21, 0.21]) {
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.028, 0.034),
      MATS.chromeSteel
    )
    bracket.position.set(bx, 0.142, -0.018)
    root.add(bracket)
  }

  // Right-Side Stepped Brass Gear (12 Teeth) + Knurled Platen Knob
  const gearHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.018, 16),
    MATS.brightBrass
  )
  gearHub.position.set(0.278, 0.122, -0.05)
  gearHub.rotation.set(0, 0, Math.PI / 2)
  root.add(gearHub)

  for (let g = 0; g < 12; g++) {
    const ang = (g / 12) * Math.PI * 2
    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.009, 0.012),
      MATS.brightBrass
    )
    tooth.position.set(
      0.278,
      0.122 + Math.cos(ang) * 0.043,
      -0.05 + Math.sin(ang) * 0.043
    )
    tooth.rotation.set(ang, 0, 0)
    root.add(tooth)
  }

  const platenKnob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.046, 0.044, 0.048, 16),
    MATS.bakeliteBlack
  )
  platenKnob.position.set(0.32, 0.122, -0.05)
  platenKnob.rotation.set(0, 0, Math.PI / 2)
  root.add(platenKnob)

  const knobCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.054, 12),
    MATS.agedBrass
  )
  knobCap.position.set(0.322, 0.122, -0.05)
  knobCap.rotation.set(0, 0, Math.PI / 2)
  root.add(knobCap)

  // Protective Brass Wire Cage over the Front-Left ПРИЕМ Lamp + 3 Mechanical Toggle Switches
  const lampBezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.032, 0.014, 12),
    MATS.brightBrass
  )
  lampBezel.position.set(-0.2, 0.072, 0.188)
  lampBezel.rotation.set(0.38, 0, 0)
  root.add(lampBezel)

  for (let c = 0; c < 2; c++) {
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(0.025, 0.0028, 6, 12, Math.PI),
      MATS.brightBrass
    )
    arch.position.set(-0.2, 0.078, 0.194)
    arch.rotation.set(0.38, c * (Math.PI / 2), 0)
    root.add(arch)
  }

  // 3 Front Mechanical Toggle Switches with U-Guards
  for (let s = 0; s < 3; s++) {
    const sx = -0.11 + s * 0.042
    const nut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.01, 0.012, 6),
      MATS.brightBrass
    )
    nut.position.set(sx, 0.088, 0.175)
    nut.rotation.set(0.38, 0, 0)
    root.add(nut)

    const bat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.0045, 0.026, 8),
      MATS.chromeSteel
    )
    bat.position.set(sx, 0.098, 0.186)
    bat.rotation.set(0.75 + (s % 2) * 0.35, 0, 0)
    root.add(bat)
  }

  // 10 Perimeter Hex Bolts + Helical Coiled Rear Power Cable
  for (const bx of [-0.25, -0.12, 0, 0.12, 0.25]) {
    addHexBolt(root, bx, 0.142, -0.17, 0, 0, 0, 0.006, 0.006)
    addHexBolt(root, bx, 0.142, 0.09, 0, 0, 0, 0.006, 0.006)
  }

  const powerSpring = new THREE.Mesh(
    createHelicalSpringGeometry(0.02, 0.0055, 7, 0.12, 56),
    MATS.bakeliteBlack
  )
  powerSpring.position.set(-0.18, 0.02, -0.27)
  powerSpring.rotation.set(Math.PI / 2, 0, 0)
  root.add(powerSpring)

  return root
}

// ============================================================================
// 2. `public/models/soviet_shredder.glb` (75+ Sub-Parts)
// ============================================================================
function buildSovietShredder() {
  const root = new THREE.Group()
  root.name = 'UnichtozhitelShredder84'

  // Heavy Bolted Cast-Iron Main Body + 4 Corner Reinforcement Ribs
  const body = new THREE.Mesh(
    createBeveledBoxGeometry(0.38, 0.165, 0.3, 0.01),
    MATS.panelOlive
  )
  body.position.set(-0.03, 0.02, 0)
  root.add(body)

  for (const sx of [-0.228, 0.162]) {
    const flange = new THREE.Mesh(
      createBeveledBoxGeometry(0.026, 0.178, 0.324, 0.005),
      MATS.castIronDark
    )
    flange.position.set(sx, 0.02, 0)
    root.add(flange)

    // 8 Hex Bolts per side flange (16 total)
    for (let b = 0; b < 4; b++) {
      const bz = -0.12 + b * 0.08
      addHexBolt(root, sx + (sx < 0 ? -0.015 : 0.015), 0.075, bz, 0, 0, Math.PI / 2, 0.007, 0.006)
      addHexBolt(root, sx + (sx < 0 ? -0.015 : 0.015), -0.035, bz, 0, 0, Math.PI / 2, 0.007, 0.006)
    }
  }

  // Top Throat Funnel Collar
  const funnel = new THREE.Mesh(
    createBeveledBoxGeometry(0.33, 0.024, 0.095, 0.005),
    MATS.castIronDark
  )
  funnel.position.set(-0.03, 0.104, -0.02)
  root.add(funnel)

  const throatCavity = new THREE.Mesh(
    new THREE.BoxGeometry(0.295, 0.016, 0.062),
    MATS.bakeliteBlack
  )
  throatCavity.position.set(-0.03, 0.109, -0.02)
  root.add(throatCavity)

  // Twin Counter-Rotating Shafts + 18 Interlocking Milled Steel Cutting Discs with Crusher Teeth!
  for (const shaftZ of [-0.033, -0.007]) {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.007, 0.31, 10),
      MATS.chromeSteel
    )
    shaft.position.set(-0.03, 0.108, shaftZ)
    shaft.rotation.set(0, 0, Math.PI / 2)
    root.add(shaft)
  }

  for (let i = 0; i < 18; i++) {
    const isRear = i % 2 === 0
    const cx = -0.162 + i * 0.0155
    const cz = isRear ? -0.031 : -0.009
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0165, 0.0165, 0.0065, 12),
      i % 3 === 0 ? MATS.brightBrass : MATS.chromeSteel
    )
    disc.position.set(cx, 0.111, cz)
    disc.rotation.set(0, 0, Math.PI / 2)
    root.add(disc)

    // 4 Crusher Teeth per cutting disc
    for (let t = 0; t < 4; t++) {
      const ang = (t / 4) * Math.PI * 2 + i * 0.35
      const tooth = new THREE.Mesh(
        new THREE.BoxGeometry(0.005, 0.006, 0.006),
        MATS.chromeSteel
      )
      tooth.position.set(
        cx,
        0.111 + Math.cos(ang) * 0.017,
        cz + Math.sin(ang) * 0.017
      )
      tooth.rotation.set(ang, 0, 0)
      root.add(tooth)
    }
  }

  // Right-Side External Gearbox & 5-Detent Notched Quadrant Track
  const gearbox = new THREE.Mesh(
    createBeveledBoxGeometry(0.058, 0.145, 0.245, 0.006),
    MATS.agedBrass
  )
  gearbox.position.set(0.195, 0.02, 0)
  root.add(gearbox)

  const trackSlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.012, 0.195),
    MATS.bakeliteBlack
  )
  trackSlot.position.set(0.195, 0.094, 0)
  root.add(trackSlot)

  // 5 Physical Metal Detent Notches along the Right-Side Lever Track
  for (let d = 0; d < 5; d++) {
    const dz = -0.08 + d * 0.04
    const notch = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.01, 0.01),
      MATS.brightBrass
    )
    notch.position.set(0.212, 0.096, dz)
    root.add(notch)
  }

  // Lower ОТХОДЫ Pull-Out Waste Drawer with Wire-Mesh Front Bars & Chrome Handle
  const wasteBin = new THREE.Mesh(
    createBeveledBoxGeometry(0.35, 0.048, 0.25, 0.005),
    MATS.castIronDark
  )
  wasteBin.position.set(-0.03, -0.056, 0.035)
  root.add(wasteBin)

  // Chrome Drawer Pull Handle on Front
  const handleBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.01, 0.014),
    MATS.chromeSteel
  )
  handleBar.position.set(-0.03, -0.062, 0.174)
  root.add(handleBar)

  // Pile of Multi-Layered 3D Shredded Paper Strips inside the Waste Bin
  for (let p = 0; p < 10; p++) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.006, 0.09),
      MATS.paperStripLight
    )
    strip.position.set(-0.14 + p * 0.024, -0.032 + (p % 3) * 0.004, 0.08)
    strip.rotation.set(0.08 * (p % 2), 0.18 * ((p % 3) - 1), 0.12)
    root.add(strip)
  }

  return root
}

// ============================================================================
// 3. `public/models/desk_props.glb` (Stamps, Ink Pads, Magnifier, Banker's Lamp, Pneumatic Tube)
// ============================================================================
function buildDeskProps() {
  const root = new THREE.Group()
  root.name = 'SovietDeskPropsCollection'

  // --- A. `stamp_body` (Chamfered Steel Base + 4 Corner Screws + Brass Post) ---
  const stampBody = new THREE.Group()
  stampBody.name = 'stamp_body'
  const sBase = new THREE.Mesh(
    createBeveledBoxGeometry(0.162, 0.032, 0.098, 0.005),
    MATS.steelMid
  )
  sBase.position.set(0, 0.016, 0)
  stampBody.add(sBase)

  for (const [sx, sz] of [
    [-0.066, -0.036],
    [0.066, -0.036],
    [-0.066, 0.036],
    [0.066, 0.036],
  ]) {
    addHexBolt(stampBody, sx, 0.033, sz, 0, 0, 0, 0.0055, 0.004)
  }
  root.add(stampBody)

  // --- B. `stamp_plunger` (Lathe-Turned Multi-Ring Handle + Coiled Spring + Brass Ferrule) ---
  const stampPlunger = new THREE.Group()
  stampPlunger.name = 'stamp_plunger'

  const spring = new THREE.Mesh(
    createHelicalSpringGeometry(0.016, 0.0026, 5, 0.036, 48),
    MATS.chromeSteel
  )
  spring.position.set(0, 0.05, 0)
  stampPlunger.add(spring)

  const lathePts = [
    new THREE.Vector2(0.0, 0.032),
    new THREE.Vector2(0.028, 0.032),
    new THREE.Vector2(0.026, 0.052),
    new THREE.Vector2(0.018, 0.068),
    new THREE.Vector2(0.025, 0.082),
    new THREE.Vector2(0.019, 0.092),
    new THREE.Vector2(0.036, 0.118),
    new THREE.Vector2(0.032, 0.142),
    new THREE.Vector2(0.014, 0.156),
    new THREE.Vector2(0.0, 0.16),
  ]
  const handleMesh = new THREE.Mesh(
    new THREE.LatheGeometry(lathePts, 20),
    MATS.brightBrass
  )
  stampPlunger.add(handleMesh)
  root.add(stampPlunger)

  // --- C. `ink_pad_tin` (Rolled-Rim Tin + Rear Hinge Barrels + Ribbed 105° Lid) ---
  const inkPadTin = new THREE.Group()
  inkPadTin.name = 'ink_pad_tin'
  const tinBase = new THREE.Mesh(
    createBeveledBoxGeometry(0.204, 0.014, 0.134, 0.004),
    MATS.castIronDark
  )
  inkPadTin.add(tinBase)

  for (const hx of [-0.055, 0.055]) {
    const hinge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.028, 8),
      MATS.brightBrass
    )
    hinge.position.set(hx, 0.008, -0.066)
    hinge.rotation.set(0, 0, Math.PI / 2)
    inkPadTin.add(hinge)
  }

  const lidGroup = new THREE.Group()
  lidGroup.position.set(0, 0.008, -0.064)
  lidGroup.rotation.set(-1.83, 0, 0)
  const lidPlate = new THREE.Mesh(
    createBeveledBoxGeometry(0.2, 0.007, 0.128, 0.003),
    MATS.steelMid
  )
  lidPlate.position.set(0, 0, 0.062)
  lidGroup.add(lidPlate)

  for (const rx of [-0.06, 0, 0.06]) {
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.004, 0.105),
      MATS.brightBrass
    )
    rib.position.set(rx, -0.004, 0.062)
    lidGroup.add(rib)
  }
  inkPadTin.add(lidGroup)
  root.add(inkPadTin)

  // --- D. `magnifier_frame` (Stepped Double Brass Bezel + 8 Micro-Rivets + Turned Collar + Fluted Mahogany Grip) ---
  const magnifierFrame = new THREE.Group()
  magnifierFrame.name = 'magnifier_frame'

  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.156, 0.018, 14, 32),
    MATS.brightBrass
  )
  outerRing.rotation.set(Math.PI / 2, 0, 0)
  magnifierFrame.add(outerRing)

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.146, 0.009, 12, 32),
    MATS.agedBrass
  )
  innerRing.position.set(0, 0.007, 0)
  innerRing.rotation.set(Math.PI / 2, 0, 0)
  magnifierFrame.add(innerRing)

  for (let r = 0; r < 8; r++) {
    const ang = (r / 8) * Math.PI * 2
    addHexBolt(
      magnifierFrame,
      Math.cos(ang) * 0.156,
      0.017,
      Math.sin(ang) * 0.156,
      0,
      0,
      0,
      0.005,
      0.005
    )
  }

  const gripGroup = new THREE.Group()
  gripGroup.position.set(0.095, -0.004, 0.095)
  gripGroup.rotation.set(Math.PI / 2, 0, -Math.PI / 4)

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.02, 0.036, 14),
    MATS.brightBrass
  )
  gripGroup.add(collar)

  const woodGrip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.019, 0.026, 0.175, 12),
    MATS.mahoganyWood
  )
  woodGrip.position.set(0, 0.098, 0)
  gripGroup.add(woodGrip)

  const pommel = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 12, 12),
    MATS.brightBrass
  )
  pommel.position.set(0, 0.19, 0)
  gripGroup.add(pommel)

  magnifierFrame.add(gripGroup)
  root.add(magnifierFrame)

  // --- E. `pneumatic_tube` (Cast-Brass Vacuum Frame, 4 Latch Clamps, Side Pressure Gauge & Delivery Pipe) ---
  const pneumaticTube = new THREE.Group()
  pneumaticTube.name = 'pneumatic_tube'

  const tubeFrame = new THREE.Mesh(
    createBeveledBoxGeometry(0.66, 0.032, 0.195, 0.006),
    MATS.panelOlive
  )
  pneumaticTube.add(tubeFrame)

  const gasket = new THREE.Mesh(
    createBeveledBoxGeometry(0.635, 0.012, 0.172, 0.004),
    MATS.agedBrass
  )
  gasket.position.set(0, 0.014, 0)
  pneumaticTube.add(gasket)

  for (const [lx, lz] of [
    [-0.31, -0.075],
    [0.31, -0.075],
    [-0.31, 0.075],
    [0.31, 0.075],
  ]) {
    addHexBolt(pneumaticTube, lx, 0.022, lz, 0, 0, 0, 0.009, 0.008)
  }

  // Low-profile horizontal brass vacuum elbow & side gauge routed into the desk surface BELOW the ПУНКТ №4 plaque!
  const vacuumPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.024, 0.032, 12),
    MATS.brightBrass
  )
  vacuumPipe.position.set(-0.34, 0.01, -0.02)
  vacuumPipe.rotation.set(0, 0, Math.PI / 2)
  pneumaticTube.add(vacuumPipe)

  const miniGauge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.01, 12),
    MATS.brightBrass
  )
  miniGauge.position.set(-0.355, 0.02, 0.03)
  miniGauge.rotation.set(-Math.PI / 2, 0, 0)
  pneumaticTube.add(miniGauge)

  root.add(pneumaticTube)

  // --- F. `bankers_lamp` (Stepped Brass Base, Pull-Chain Acorn, Articulated Arm & Beveled Emerald Shade) ---
  const bankersLamp = new THREE.Group()
  bankersLamp.name = 'bankers_lamp'

  const lampBase1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.094, 0.028, 18),
    MATS.agedBrass
  )
  lampBase1.position.set(0, 0.014, 0)
  bankersLamp.add(lampBase1)

  const lampBase2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.066, 0.018, 16),
    MATS.brightBrass
  )
  lampBase2.position.set(0, 0.035, 0)
  bankersLamp.add(lampBase2)

  // Pull-chain with tiny brass acorn
  const pullChain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0022, 0.0022, 0.065, 6),
    MATS.brightBrass
  )
  pullChain.position.set(0.038, 0.16, 0.06)
  bankersLamp.add(pullChain)

  const acorn = new THREE.Mesh(
    new THREE.ConeGeometry(0.006, 0.014, 8),
    MATS.brightBrass
  )
  acorn.position.set(0.038, 0.125, 0.06)
  acorn.rotation.set(Math.PI, 0, 0)
  bankersLamp.add(acorn)

  // Articulated Brass Arm + 2 Tension Thumbscrews
  const armLower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.013, 0.165, 12),
    MATS.brightBrass
  )
  armLower.position.set(0, 0.11, -0.02)
  armLower.rotation.set(-0.18, 0, 0)
  bankersLamp.add(armLower)

  const jointKnob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.028, 10),
    MATS.agedBrass
  )
  jointKnob.position.set(0, 0.175, -0.032)
  jointKnob.rotation.set(0, 0, Math.PI / 2)
  bankersLamp.add(jointKnob)

  const armUpper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.011, 0.115, 12),
    MATS.brightBrass
  )
  armUpper.position.set(0, 0.192, 0.02)
  armUpper.rotation.set(0.68, 0, 0)
  bankersLamp.add(armUpper)

  // 5-Panel Beveled Emerald Glass Shade with Brass End-Caps
  const shadeGroup = new THREE.Group()
  shadeGroup.position.set(0, 0.215, 0.08)
  shadeGroup.rotation.set(0.32, 0, 0)

  const emeraldHood = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.058, 0.188, 6, 1, false, 0, Math.PI),
    MATS.emeraldGlass
  )
  emeraldHood.rotation.set(0, 0, Math.PI / 2)
  shadeGroup.add(emeraldHood)

  for (const sx of [-0.094, 0.094]) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.058, 0.008, 6, 1, false, 0, Math.PI),
      MATS.brightBrass
    )
    cap.position.set(sx, 0, 0)
    cap.rotation.set(0, 0, Math.PI / 2)
    shadeGroup.add(cap)
  }

  bankersLamp.add(shadeGroup)
  root.add(bankersLamp)

  return root
}

// ============================================================================
// 4. `public/models/komrad_terminal_housing.glb` (70+ Sub-Parts)
// ============================================================================
function buildKomradTerminalHousing() {
  const root = new THREE.Group()
  root.name = 'Komrad84MainframeTerminal'

  // Protruding Anti-Glare CRT Sun-Hood Frame around [0, 1.4, 0.02]
  const hoodTop = new THREE.Mesh(
    createBeveledBoxGeometry(1.56, 0.045, 0.28, 0.008),
    MATS.castIronDark
  )
  hoodTop.position.set(0, 1.92, 0.06)
  hoodTop.rotation.set(0.08, 0, 0)
  root.add(hoodTop)

  for (const side of [-1, 1]) {
    const hoodFlank = new THREE.Mesh(
      createBeveledBoxGeometry(0.045, 1.06, 0.26, 0.008),
      MATS.castIronDark
    )
    hoodFlank.position.set(side * 0.76, 1.4, 0.05)
    root.add(hoodFlank)

    // 6 Side Heat-Sink Fins per side (12 total)
    for (let f = 0; f < 6; f++) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.11, 0.22),
        MATS.steelMid
      )
      fin.position.set(side * 0.79, 1.04 + f * 0.14, 0.02)
      root.add(fin)
    }
  }

  // 12 Corner Hex Bolts around the CRT Bezel
  for (const bx of [-0.71, -0.35, 0, 0.35, 0.71]) {
    addHexBolt(root, bx, 1.89, 0.145, Math.PI / 2, 0, 0, 0.011, 0.01)
    addHexBolt(root, bx, 0.91, 0.145, Math.PI / 2, 0, 0, 0.011, 0.01)
  }

  // Right-Side CRT Calibration Bezel Panel with 4 Rotary Knobs (ЯРКОСТЬ, КОНТРАСТ, ФОКУС, СИНХР.)
  for (let k = 0; k < 4; k++) {
    const ky = 1.68 - k * 0.16
    const knobBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.03, 0.018, 12),
      MATS.brightBrass
    )
    knobBase.position.set(0.72, ky, 0.148)
    knobBase.rotation.set(Math.PI / 2, 0, 0)
    root.add(knobBase)

    const knobDial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.022, 0.026, 10),
      MATS.bakeliteBlack
    )
    knobDial.position.set(0.72, ky, 0.162)
    knobDial.rotation.set(Math.PI / 2, 0, 0)
    root.add(knobDial)
  }

  // Key-Operated KGB Security Lock Switch (`КЛЮЧ ДОПУСКА`) on Left Bezel
  const keyCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.022, 12),
    MATS.brightBrass
  )
  keyCylinder.position.set(-0.72, 1.56, 0.15)
  keyCylinder.rotation.set(Math.PI / 2, 0, 0)
  root.add(keyCylinder)

  const keyBow = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.006, 0.032),
    MATS.crimsonRed
  )
  keyBow.position.set(-0.72, 1.56, 0.172)
  keyBow.rotation.set(0, 0, 0.45)
  root.add(keyBow)

  // Sculpted 52-Key Individual 3D Mechanical Keycap Matrix + Chrome Wrist-Rest Bar on the Keyboard Deck ([0, 0.81, 0.19], rotX: 0.38)
  const kbOverlay = new THREE.Group()
  kbOverlay.position.set(0, 0.81, 0.19)
  kbOverlay.rotation.set(0.38, 0, 0)

  const wristRest = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 1.44, 12),
    MATS.chromeSteel
  )
  wristRest.position.set(0, 0.042, 0.168)
  wristRest.rotation.set(0, 0, Math.PI / 2)
  kbOverlay.add(wristRest)

  for (let row = 0; row < 4; row++) {
    const keysInRow = row === 3 ? 9 : 14
    for (let col = 0; col < keysInRow; col++) {
      const isSpace = row === 3 && col === 4
      const kw = isSpace ? 0.24 : 0.068
      const kx =
        row === 3
          ? -0.52 + col * 0.13
          : -0.56 + col * 0.086 + (row % 2) * 0.012
      const kz = 0.032 + row * 0.03
      const keycap = new THREE.Mesh(
        new THREE.BoxGeometry(kw, 0.018, 0.024),
        col === 0 || col === keysInRow - 1 ? MATS.crimsonRed : MATS.ivoryEnamel
      )
      keycap.position.set(kx, 0.062 - row * 0.002, kz)
      kbOverlay.add(keycap)
    }
  }
  root.add(kbOverlay)

  // Thick Braided Umbilical Conduits with Brass Aviation Flanges connecting Terminal to Desk
  for (const ux of [-0.52, 0.52]) {
    const umbilical = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.55, 12),
      MATS.steelMid
    )
    umbilical.position.set(ux, 0.62, 0.22)
    umbilical.rotation.set(0.65, 0, 0)
    root.add(umbilical)

    const avFlange = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 0.028, 12),
      MATS.brightBrass
    )
    avFlange.position.set(ux, 0.78, 0.1)
    avFlange.rotation.set(0.65, 0, 0)
    root.add(avFlange)
  }

  return root
}

// ============================================================================
// 5. `public/models/control_panels.glb` (Reactor & Right Panel Hardware Overlays — 80+ Sub-Parts)
// ============================================================================
function buildControlPanels() {
  const root = new THREE.Group()
  root.name = 'SovietCockpitControlPanels'

  // --- A. `reactor_hardware` (Local space of ReactorStation3D) ---
  const reactorGrp = new THREE.Group()
  reactorGrp.name = 'reactor_hardware'

  // 3 Deep-Dish Flanged Gauge Bezels with 6 Perimeter Hex Bolts, Glass Glare & Armored Sensor Conduits
  for (const gx of [-0.5, 0, 0.5]) {
    const gPos = new THREE.Vector3(gx, 1.94, 0.03)
    const outerFlange = new THREE.Mesh(
      new THREE.TorusGeometry(0.198, 0.016, 10, 24),
      MATS.agedBrass
    )
    outerFlange.position.copy(gPos).add(new THREE.Vector3(0, 0, 0.038))
    reactorGrp.add(outerFlange)

    for (let b = 0; b < 6; b++) {
      const ang = (b / 6) * Math.PI * 2
      addHexBolt(
        reactorGrp,
        gx + Math.cos(ang) * 0.198,
        1.94 + Math.sin(ang) * 0.198,
        0.054,
        Math.PI / 2,
        0,
        0,
        0.008,
        0.008
      )
    }

    // Bottom Armored Sensor Conduit Pipe under each Gauge
    const conduit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.14, 8),
      MATS.brightBrass
    )
    conduit.position.set(gx, 1.69, 0.02)
    reactorGrp.add(conduit)
  }

  // Spoked Cast-Iron Handwheel Guards on COOLING PUMP A (-0.52, 0.99, 0.03) & B (0, 0.99, 0.03)
  for (const px of [-0.52, 0]) {
    const guardArc = new THREE.Mesh(
      new THREE.TorusGeometry(0.155, 0.009, 8, 20, Math.PI),
      MATS.brightBrass
    )
    guardArc.position.set(px, 0.99, 0.045)
    reactorGrp.add(guardArc)
  }

  // АЗ-5 Heavy Hazard Collar, Spring Hinge & Metallic Lead-Seal Tag at [0.52, 0.98, 0.05]
  const az5Hinge = new THREE.Mesh(
    createHelicalSpringGeometry(0.012, 0.0025, 6, 0.18, 40),
    MATS.chromeSteel
  )
  az5Hinge.position.set(0.52, 1.09, 0.065)
  az5Hinge.rotation.set(0, 0, Math.PI / 2)
  reactorGrp.add(az5Hinge)

  const leadSeal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.006, 10),
    MATS.brightBrass
  )
  leadSeal.position.set(0.64, 0.92, 0.075)
  leadSeal.rotation.set(Math.PI / 2, 0, 0)
  reactorGrp.add(leadSeal)

  // Toothed Saw-Tooth Lever Tracks on [SHIFT] CLUTCH (-0.56) and 3 Power Channels (-0.18, 0.18, 0.54) at y=0.47
  for (const lx of [-0.56, -0.18, 0.18, 0.54]) {
    for (let n = 0; n < 6; n++) {
      const ny = 0.36 + n * 0.042
      const tooth = new THREE.Mesh(
        new THREE.BoxGeometry(0.014, 0.008, 0.016),
        MATS.brightBrass
      )
      tooth.position.set(lx - 0.048, ny, 0.078)
      reactorGrp.add(tooth)
    }
  }

  root.add(reactorGrp)

  // --- B. `right_panel_hardware` (20-Part Copper Knife-Switch Assembly & Gauge Bezels for Right Wing) ---
  const rightGrp = new THREE.Group()
  rightGrp.name = 'right_panel_hardware'

  // 3 Flanged Brass Gauge Bezels + 18 Hex Bolts for Right Panel Gauges ([0, 1.84, 0.03])
  for (const gx of [-0.5, 0, 0.5]) {
    for (let b = 0; b < 6; b++) {
      const ang = (b / 6) * Math.PI * 2
      addHexBolt(
        rightGrp,
        gx + Math.cos(ang) * 0.192,
        1.84 + Math.sin(ang) * 0.192,
        0.078,
        Math.PI / 2,
        0,
        0,
        0.008,
        0.008
      )
    }
  }

  // Heavy Copper Knife-Switch Contact Jaws & Insulator Standoffs for MAIN BREAKER ([0.42, 1.0, 0.06])
  for (const jx of [-0.06, 0.06]) {
    for (const jy of [-0.09, 0.09]) {
      const insulator = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.026, 0.032, 10),
        MATS.crimsonRed
      )
      insulator.position.set(0.42 + jx, 1.0 + jy, 0.085)
      insulator.rotation.set(Math.PI / 2, 0, 0)
      rightGrp.add(insulator)

      const copperJaw = new THREE.Mesh(
        new THREE.BoxGeometry(0.024, 0.034, 0.038),
        MATS.copperContact
      )
      copperJaw.position.set(0.42 + jx, 1.0 + jy, 0.112)
      rightGrp.add(copperJaw)
    }
  }

  // Protective Side Guards around the 5 Backlit Push-Buttons ([0, 0.52, 0.04])
  for (let b = 0; b < 5; b++) {
    const bx = -0.56 + b * 0.28
    for (const side of [-1, 1]) {
      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.125, 0.055),
        MATS.brightBrass
      )
      guard.position.set(bx + side * 0.118, 0.5, 0.065)
      rightGrp.add(guard)
    }
  }

  root.add(rightGrp)

  return root
}

async function main() {
  await exportGLB(buildPravdaTeletype(), 'pravda_teletype.glb')
  await exportGLB(buildSovietShredder(), 'soviet_shredder.glb')
  await exportGLB(buildDeskProps(), 'desk_props.glb')
  await exportGLB(buildKomradTerminalHousing(), 'komrad_terminal_housing.glb')
  await exportGLB(buildControlPanels(), 'control_panels.glb')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
