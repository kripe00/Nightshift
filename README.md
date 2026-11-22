<p align="center">
  <img src="./public/title-banner.svg" alt="Meltdown is Propaganda — A Soviet Night Shift Simulator" width="100%" />
</p>

# ☢️ Meltdown is Propaganda
### *A Soviet Night Shift Simulator*

> *"Comrade Operator: Reports of a core thermal anomaly are bourgeois fabrication. Meltdown is propaganda. Do not touch the cooling valves. Glory to the Collective."*
> — **K.O.M.R.A.D.-84**, Automated Plant Supervisor

**Meltdown is Propaganda** (*A Soviet Night Shift Simulator*) is a **100% physical first-person 3D Soviet RBMK-1000 control-room thriller** combining high-stakes reactor thermodynamics and 1000 MW grid dispatching with paranoid document inspection (*Papers, Please* meets *Chernobyl* with the tactile 3D micro-pixel chiaroscuro aesthetic of *Buckshot Roulette* and *Inscryption*), built for **GitHub Game Off 2026** (Theme: **SHIFT**).

---

## 📖 High Concept & The Three Layers of `SHIFT`

The year is **1984** in an alternative-history Soviet Union defined by heavy analog **Cassette Futurism** and **Atompunk** engineering. You are the lone night-shift operator locked inside the 3D Main Control Room (MCR) bunker of **People's Automated Nuclear Plant No. 4 (Sector 84)**.

The jam theme **SHIFT** drives the game on three levels:

1. **The Night Shift (Time & Survival):**
   Survive **5 increasingly chaotic night shifts** from **00:00 to 06:00** without letting the RBMK-1000 core reach catastrophic meltdown—or accumulating **3 Treason Strikes** and being shipped to Siberia.
2. **Power & Reactivity Shifting (1000 MW Grid Routing & True Grid-Locked 50.0 Hz):**
   Route up to **1000 MW** across 6 regional Soviet substations while balancing steam pressure, feedwater level, control rods, positive void coefficient, Xenon-135 poisoning, and a `1000 MWh` station battery buffer. Hold **`SHIFT`** to sprint across the hall or fine-tune 3D valves and rod drives in **`±1%`** increments via scroll wheel.
3. **Reality Shifting (Propaganda vs. Reality):**
   The state AI **K.O.M.R.A.D.-84**—voiced by a full 1,702-word procedural PA-vocoder VOX bank—denies that a Soviet reactor can malfunction, gaslighting you during crises while **CIA infiltrators** slip forged sabotage directives onto your `Pravda-84` dot-matrix printer and `P.O.S.T.-84` office terminal.

---

## 🎛️ 100% True 3D First-Person RBMK-1000 Control Hall (Zero 2D HTML Overlays)

Every gauge, 3D indicator lamp, progressive canopy alarm bar, rotary valve wheel, Bakelite fader T-bar, hinged `AZ-5` safety cover, CRT screen, tractor-feed paper sheet, UV magnifying glass, office PC, bunker radio, and rubber stamp is a **real 3D mesh** inside a continuous first-person 3D bunker, operated directly via 3D raycasting (`onPointerDown`, `onPointerMove`, `onPointerUp`, `onClick`, and `onWheel`):

```text
+--------------------------------------+--------------------------------------+
| LEFT CONSOLE WING: UNIT A-2 [6]      | LEFT CONSOLE WING: UNIT A [1]        |
| (CONSOLE BAY NO. 84-A2 — SIUR)       | (CONSOLE BAY NO. 84-A — SAFETY/GRID) |
| - Tucked CRT VL-84A2 telemetry bar   | - Tucked CRT VL-84A telemetry bar    |
| - Enlarged 37-channel octagonal      | - Promoted upper safety row:         |
|   RBMK CORE refueling matrix         |   COOLING PUMP A/B + AZ-5 & BORON    |
| - Lower 2-bay deck:                  | - Full-height lower sloped deck:     |
|   CONTROL ROD DRIVE (wheel + RODS %) |   6 Substation Power Routing strips  |
|   & ROD REFUELING (long-throw lever) |   (1. Pripyat .. 6. Steel Works)     |
+--------------------------------------+--------------------------------------+
| FRONT SYNOPTIC WALL [2]              | RIGHT CONSOLE WING: UNIT B [3]       |
| - Monumental SKALA-84 core map       | (CONSOLE BAY NO. 84-B — MCR-T)       |
| - K.O.M.R.A.D.-84 3D CRT monitor     | - Drum Separator pressure & water    |
|   & 1,702-word PA-vocoder VOX synth  | - Feedwater / He-N2 gas loop wheel   |
| - Panoramic windows overlooking      | - MCP 1-4 pumps, containment seals   |
|   Pripyat, cooling towers & snow     |   & Bubbler Drain sight-glass lever  |
+--------------------------------------+--------------------------------------+
| LEFT WALL SWITCHGEAR: UNIT C [5] & D | SHIFT SUPERVISOR DESK [4] (Oleg)     |
| - 1000 MWh station battery deck      | - Pravda-84 printer, Security Manual |
| - Turbine throttle MWe gas pedal     | - 2x optical magnifying lens & stamps|
| - Grid-Locked 50.0 Hz synchroscope   | - WE-PAD 84 8-step startup tablet    |
|   & MAIN BREAKER knife switch        | - ISKRA-84 (SOV-OS 84) & OKEAN-84    |
+--------------------------------------+--------------------------------------+
```

### 🎥 Free First-Person Movement, Pointer Lock & Station Hotkeys
- **`WASD` / Arrow Keys + Mouse Look (`SHIFT` to Sprint):** Walk freely down the open central aisle between the split console wings, across to the `UNIT C` switchgear wall, and over to the Shift Supervisor Desk.
- **Station Focus Hotkeys (`[0]`–`[6]`) & `[E]` Desk Seat:**
  - `[0]` — Hall Overview (center aisle)
  - `[1]` — `UNIT A` (Cooling Pumps, `AZ-5 SCRAM`, `BORON INJECTION` & 6 Substation Power Routing strips)
  - `[2]` — Front Synoptic Wall (`K.O.M.R.A.D.-84` & `SKALA-84`)
  - `[3]` — `UNIT B` (Drum Separators, Feedwater Valve, `MCP 1-4` & Bubbler Drain)
  - `[4]` — Shift Supervisor & Inspector Desk (`<InspectorDesk3D />`; press `[E]` to sit/use `WE-PAD 84`, `ESC` to stand up)
  - `[5]` — `UNIT C` (`1000 MWh` Battery Deck, Turbine Throttle & `MAIN BREAKER` Sync)
  - `[6]` — `UNIT A-2` (37-Channel `RBMK CORE` Matrix, `CONTROL ROD DRIVE` & `ROD REFUELING`)
- **Direct 3D Raycast & Scroll Controls:** Grab and drag 3D levers (`spak`), crank cast-iron valve wheels, flip the hinged red `AZ-5` cover, click pulsing amber spent fuel channels on `UNIT A-2`, or hover any wheel/fader and use the **scroll wheel** (`Shift + Scroll` for `±1%` fine trim).

---

## ⚖️ Directive Consequence Matrix

Every 3D paper directive printed onto the Shift Supervisor Desk (`Pravda-84`) directly impacts the reactor and your standing with the Party:

| Directive Type | Operator 3D Stamp | In-Game Consequence |
| :--- | :--- | :--- |
| **Genuine Party Order** | `APPROVED` ✅ | Dispatches official Moscow grid/coolant mandates directly to your console CRTs and reactor loop. |
| **Genuine Party Order** | `SHREDDED` ❌ | **Suspected Treason (`+1 Strike`).** K.O.M.R.A.D.-84 logs a reprimand. `3 Strikes` = Gulag Game Over. |
| **Forged CIA Sabotage** | `SHREDDED` ✅ | Sabotage foiled! Shredding in `УНИЧТОЖИТЕЛЬ-84` rewards core/graphite stabilization. |
| **Forged CIA Sabotage** | `APPROVED` 💥 | **Sabotage Executed!** Ignites hot channels in the 37-tile RBMK core and destabilizes the 50.0 Hz grid. |

---

## 🗓️ Shift Progression & RBMK-1000 Mastery

1. **8-Step Interactive RBMK-1000 Startup & Hazard Tutorial (`WE-PAD 84`, `STEP 0–8`):**
   Comrade Volkov walks new operators through a physically accurate RBMK-1000 cold start: picking up `WE-PAD 84`, configuring `MCP 1–4` & Feedwater on `UNIT B`, withdrawing control rods on `UNIT A-2`, building `60+ BAR` steam, spinning the turbine to `50.0 Hz` and closing `MAIN BREAKER` on `UNIT C`, matching `600 MW` across the 6 substations on `UNIT A`, and drilling live **Positive Void (`STEP 7`)** and **Xenon-135 (`STEP 8`)** emergencies.
2. **Post-Tutorial Live Operations (`SHIFT 1–5`, `00:00`–`06:00`):**
   Once certified, `K.O.M.R.A.D.-84` takes over live dispatches while `Pravda-84` paper directives, `P.O.S.T.-84` orders on the `ISKRA-84` PC, spent-fuel channel reloads on `UNIT A-2`, and multi-sector grid shifts on `UNIT A` escalate across the night shift.
3. **Bunker Atmosphere (`ОКЕАН-84` Radio & Exterior Dioramas):**
   Tune the physical 3D **`ОКЕАН-84`** radio receiver across 5 `УКВ` bands (`10` Soviet tracks + timed `Говорит Москва` state broadcasts with `Kremlin` subtitles) while watching Pripyat's power grid react outside the panoramic windows.

---

## 🖥️ 3D Micro-Pixelart Aesthetic & Typography

Inspired by *Buckshot Roulette* and *Inscryption*, 3D surfaces combine procedural hammered-iron/brass PBR materials, Bayer dithering (`BuckshotDitherPass.tsx`), `THREE.NearestFilter` micro-pixel `CanvasTexture`s, and a strict **1984 Soviet Industrial Hardware Palette**:

- **Mandatory 3D Drag-Operated Levers:** Every 3D lever (`spak`), pump throttle, and substation fader handle is physically grabbed and dragged in 3D space via raycast pointer events (`onPointerDown` + `onPointerMove` + `onPointerUp`).
- **Palette:**
  - Bakelite Black: `#141414`
  - Soviet Panel Green: `#23312b` (and `#364940`)
  - CRT Phosphor Green: `#33ff66` (and `#061a0c`)
  - Industrial Hazard Yellow: `#ffb000`
  - Crimson Alarm / Stamp Red: `#ff2a2a`
  - Aged Tractor Paper / Gauge Dials: `#e6dec3`
- **Title Searchability Rule:** Written as **Meltdown is Propaganda** in standard Latin text across metadata and itch.io for searchability, and rendered in-game using the **`Kremlin`** display font.

| 3D Surface / Texture | Typography | Role |
| :--- | :--- | :--- |
| **3D Stenciled Steel Plates & Branding** | `Kremlin` | 3D engraved metal labels, warning placards, canopy banners & subtitles |
| **3D CRT Meshes & Nixie Readouts** | `VT323` | `K.O.M.R.A.D.-84` terminal, console CRT strips, `ISKRA-84` & digital MW boxes |
| **3D Tractor-Feed Directives & Manual** | `Courier Prime` | 3D paper directive textures, 3D Security Manual pages & 3D rubber ink stamps |

---

## 🏗️ Tech Stack & Modular 3D Architecture

- **Framework:** React 19 + TypeScript + Vite (`base: './'` for itch.io embed support)
- **3D Engine:** Three.js + React Three Fiber (`three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`) with 60 FPS `useFrame` + `useRef` direct state reads (`useGameStore.getState()`), static geometry merging (`mergeStaticGeometries`), and `NOOP_RAYCAST` optimization
- **Physics:** Coupled RBMK-1000 thermodynamics, steam/water mass balance, Xenon-135, positive void, and grid-locked synchronous turbine solver ([`src/simulation/rbmkPhysics.ts`](src/simulation/rbmkPhysics.ts))
- **Audio:** Zero-dependency procedural **Web Audio API** synthesizer + 1,702-word PA-vocoder **VOX speech engine** ([`src/shared/komradVoiceSynth.ts`](src/shared/komradVoiceSynth.ts))
- **State Management:** `zustand` ([`src/shared/useGameStore.ts`](src/shared/useGameStore.ts))

To guarantee zero merge conflicts during parallel AI-assisted development, the repository enforces strict 3D module boundaries:

```text
src/
├── modules/
│   ├── reactor/      # Komrad Kristianov — <ReactorStation3D />, audioSynth.ts, soundtrackPlayer.ts
│   ├── terminal/     # Komrad Kristianov — <TerminalStation3D />, komradScript.ts
│   └── inspector/    # Komrad Oleg       — <InspectorDesk3D />, DesktopComputer3D.tsx, KomradBobbleheads3D.tsx, audio.ts
├── simulation/
│   └── rbmkPhysics.ts # Coupled RBMK-1000 thermodynamic & synchronous grid solver
└── shared/           # Shared 3D Bunker & Contract:
                      # ControlRoomScene.tsx, MechanicalPanels3D.tsx, UnitCBatteryStorageDeck3D.tsx,
                      # CentralSkalaScreen3D.tsx, ExteriorDioramas3D.tsx, SovietRadioTable3D.tsx,
                      # SovietPanopticonRig3D.tsx, CameraController.tsx, BuckshotDitherPass.tsx,
                      # komradVoiceSynth.ts, useGameStore.ts, types.ts
```

See [`PLAN.md`](PLAN.md) for the roadmap and [`AGENTS.md`](AGENTS.md) for AI agent collaboration rules.

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start local development server (Vite + Soviet startup banner)
npm run dev

# Type-check and build production bundle
npm run build

# Run oxlint across the codebase
npm run lint

# Run KGB inspection (border check + tsc -b + oxlint)
npm run kgb

# Fetch Kremlin updates & read Pravda telegraph scoreboard
npm run pravda
```

---

## 👥 Team & Branch Workflow

- **Komrad Kristianov** (`Komrad-Kristianov` branch) — `<ReactorStation3D />` & `<TerminalStation3D />`
- **Komrad Oleg** (`Komrad-Oleg` branch) — `<InspectorDesk3D />`
- **`main`** — Shared 3D bunker infrastructure & verified integration branch
