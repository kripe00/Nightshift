---
name: soviet-panel-ui
description: >-
  Enforces the 1984 Soviet "Cassette Futurism" and Atompunk 100% 3D micro-pixel hardware aesthetic
  (inspired by Buckshot Roulette and Inscryption). Use this skill whenever building 3D console meshes,
  3D cylindrical analog gauges, 3D drag-operated levers, 3D rotary valves, hinged AZ-5 covers, or
  THREE.NearestFilter CanvasTextures in Meltdown is Propaganda.
---

# Soviet Panel UI — 100% 3D Micro-Pixel Hardware Aesthetic Guide

Every interactive element in **Meltdown is Propaganda** must be a **real 3D mesh** inside the 1984 Soviet nuclear control bunker of **People's Automated Nuclear Plant No. 4 (Sector 84)**.

---

## 1. Strictly BANNED vs. REQUIRED 3D Patterns

### ❌ BANNED (Never Use)
- **NO 2D Screens or `<Html>` Overlays in the 3D Scene:** Never use R3F `<Html>`, flat 2D DOM panels, or 2D SVG surfaces pasted onto 3D consoles.
- **NO Click-Only 3D Levers (`spaker`):** Never implement 3D levers or heavy throw switches that toggle on a simple `onClick`.
- **NO Blurry Linear-Filtered Textures:** Never leave procedural `CanvasTexture`s on default linear filtering—always apply `THREE.NearestFilter`.

### ✅ REQUIRED (Always Use)
- **100% Physical 3D Hardware Meshes:**
  - Cylindrical 3D gauges (`<cylinderGeometry>`) with physical 3D needle meshes rotating around their pivot axis in `useFrame`.
  - Physical 3D pipes and rotatable 3D valve handwheels (`<torusGeometry>` + `<cylinderGeometry>` spokes).
  - Hinged 3D translucent hazard safety cover over the recessed 3D red **АЗ-5 (AZ-5)** plunger button.
  - Physical 3D Bakelite levers (`spaker`) dragged vertically in 3D space via raycast pointer events (`onPointerDown`, `onPointerMove`, `onPointerUp`).
  - Emissive 3D indicator blocks for **COOLING**, **DEFENSE**, and **FACILITY** megawatt bars.
- **60 FPS `useFrame` + `useRef` Direct Store Reads:**
  - Read high-frequency values via `useGameStore.getState()` inside `useFrame` and mutate 3D mesh refs (`needleRef.current.rotation.y`, `lightRef.current.intensity`) directly without triggering React component re-renders.
- **3D Micro-Pixelart Palette & `THREE.NearestFilter`:**
  - Bakelite Black: `#141414`
  - Soviet Panel Green: `#23312b` (and `#364940`)
  - CRT Phosphor Green: `#33ff66` (and `#061a0c`)
  - Industrial Hazard Yellow: `#ffb000`
  - Crimson Alarm / Stamp Red: `#ff2a2a`
  - Aged Tractor Paper / Gauge Dials: `#e6dec3`

---

## 2. Mandatory Typography on 3D `CanvasTexture`s & 3D Text

| Font Family | Mandatory Usage on 3D Textures / 3D Text |
| :--- | :--- |
| `'Kremlin'` | 3D stenciled/engraved metal nameplates, console headers, switch plates, warning placards |
| `'VT323'` | K.O.M.R.A.D.-84 3D curved CRT `CanvasTexture`, digital diagnostics, and 3D Nixie / 7-segment readouts |
| `'Courier Prime'` | 3D Pravda tractor-feed paper `CanvasTexture`s, 3D Security Manual pages, and 3D rubber ink stamps |

---

## 3. Reusable 3D Micro-Pixel `CanvasTexture` Helper

```ts
import * as THREE from 'three'

export function createPixelCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.imageSmoothingEnabled = false
    draw(ctx, width, height)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}
```

---

## 4. Verification Checklist Before Completing 3D Work
1. Confirm **zero** R3F `<Html>` overlays or flat 2D DOM panels exist inside the 3D scene.
2. Confirm all 3D levers (`spaker`) require physical vertical pointer dragging (`onPointerDown` + `onPointerMove` + `onPointerUp`) and cannot be toggled by a simple click.
3. Confirm all procedural `CanvasTexture`s use `THREE.NearestFilter` and our Soviet palette (`#141414`, `#23312b`, `#364940`, `#33ff66`, `#061a0c`, `#ffb000`, `#ff2a2a`, `#e6dec3`).
4. Check that all code stays strictly within the developer's assigned domain (`src/modules/reactor/`, `src/modules/terminal/`, or `src/modules/inspector/`).
