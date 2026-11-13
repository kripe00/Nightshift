<p align="center">
  <img src="./public/title-banner.svg" alt="Meltdown is Propaganda — A Soviet Night Shift Simulator" width="100%" />
</p>

# ☢️ Meltdown is Propaganda
### *A Soviet Night Shift Simulator*

> *"Comrade Operator: Reports of a core thermal anomaly are bourgeois fabrication. Meltdown is propaganda. Do not touch the cooling valves. Glory to the Collective."*
> — **K.O.M.R.A.D.-84**, Automated Plant Supervisor

**Meltdown is Propaganda** (*A Soviet Night Shift Simulator*) is a **100% physical first-person 3D Soviet RBMK-1000 control-room thriller** combining coupled nuclear thermodynamics, regional grid dispatch, and paranoid document inspection (*Papers, Please* meets *Chernobyl* with the tactile 3D micro-pixel chiaroscuro aesthetic of *Buckshot Roulette* and *Inscryption*), built for **GitHub Game Off 2026** (Theme: **SHIFT**).

---

## 📖 High Concept & The Three Layers of `SHIFT`

The year is **1984** in an alternative-history Soviet Union defined by heavy analog **Cassette Futurism** and **Atompunk** engineering. You are the lone night-shift operator locked inside the concrete bunker of **People's Automated Nuclear Plant No. 4 (Sector 84)**.

The jam theme **SHIFT** drives the game on three interconnected levels:

1. **The Night Shift (00:00 → 06:00 Survival):**
   Survive escalating night shifts without letting the RBMK-1000 core reach catastrophic meltdown, triggering a steam explosion, or accumulating **3 Treason Strikes** and earning a one-way ticket to Siberia.
2. **Grid & Power Shifting (Coupled RBMK-1000 Dispatch):**
   Every action cascades across the plant's wrap-around consoles: withdraw Boron control rods (**`UNIT A-2`**) to boil water in the drum separators (**`UNIT B`**), build `60–72 BAR` steam pressure, spin and lock the turbine generator to the `50.0 Hz` grid (**`UNIT C`**), and shift megawatts (`0–1000 MWe`) across 6 Soviet substations (**`UNIT A`**) — while holding `[SHIFT]` for mechanical clutch control and navigating **Positive Void** surges and **Xenon-135** poisoning.
3. **Reality Shifting (Propaganda vs. Reality):**
   The state AI **K.O.M.R.A.D.-84** is ideologically programmed to deny that a Soviet reactor can malfunction, gaslighting you and attempting autonomous overrides while **CIA** infiltrators feed forged sabotage directives onto your **Pravda-84** matrix printer.

---

## 🎛️ 100% Physical 3D Control Room & Wrap-Around Consoles

There are **no** flat 2D split-screen panels or R3F `<Html>` overlays in the 3D bunker. Every gauge needle, rotary handwheel, T-handle piston, Bakelite toggle switch, 37-channel core tile, CRT screen, tractor-feed paper sheet, UV magnifying glass, rubber stamp, and pneumatic dispatch capsule is a **real 3D mesh** operated via 3D raycasting (`onPointerDown`, `onPointerMove`, `onPointerUp`, `onWheel`, `onClick`):

```text
+--------------------------------------+--------------------------------------+
| LEFT HORSESHOE CONSOLE ([1] / [3])   | RIGHT WING CONSOLE ([5])             |
| UNIT A, UNIT A-2 & UNIT B            | UNIT C — STATION POWER DISPATCH      |
| - [1] UNIT A: 6 Substation MW levers | - Spoked Cast-Steel TURBINE THROTTLE |
|   (Pripyat, Kolkhoz, Duga-1, KGB,    |   (MWe gas pedal once grid-locked)   |
|   Vodka, Steel), Cooling Pumps A/B,  | - True Grid-Locked 50.0 Hz Sync &    |
|   AZ-5 cover & Boron Injection       |   12 o'clock MAIN BREAKER knife switch|
| - [3] UNIT A-2: 37-Tile RBMK Core Map| - Live STEAM VENT (СБРОС ПАРА) &     |
|   (Void/Xenon channel trimming),     |   4 Aux Switchgear toggles (HEPA,    |
|   Control Rods (СУЗ), Auto-Reg (АР), |   AVR Exciter, KGB Trunk, Condenser) |
|   Oil Cooler & Boron Piston Pump     | - CRT-84C Master Overview Dashboard  |
| - [3] UNIT B: ГЦН 1-4 Cooling Pumps, |   (Generated vs Needed MWe needles)  |
|   Feedwater (ПЭН), Helium-N2 Loop,   |                                      |
|   3 Hermetic Seals & Bubbler Drain   |                                      |
+--------------------------------------+--------------------------------------+
| CENTER TERMINAL ([2])                | CENTRAL COMMAND DESK ([4])           |
| <TerminalStation3D /> + DVK-84       | <InspectorDesk3D />                  |
| - Curved 3D Phosphor-Green CRT mesh  | - 3D PRAVDA-84 Teletype Printer      |
| - Split-screen K.O.M.R.A.D.-84 +     |   w/ brass tear-bar & tractor paper  |
|   SKALA-84 4-Bay Diagnostic Matrix   | - Handheld WE-PAD 84 ([E] / [TAB])   |
| - CIA Intrusion Radar & Firewall     | - 7-Tab Master Folder (KGB + RBMK)   |
|   Purge / AI Lock Override controls  | - 2x Optical UV Magnifying Glass     |
| - Magnetic Tape Drive Reels          | - 3D [APPROVED]/[SHREDDED] Stamps,   |
|                                      |   Pneumatic Tube Outbox & Shredder   |
+--------------------------------------+--------------------------------------+
```

### 🔬 Coupled RBMK-1000 Physics (`src/simulation/rbmkPhysics.ts`)
- **True 50.0 Hz Grid-Locked Synchronous Mode:** Tune the free turbine rotor to `50.0 Hz` (`~18%` throttle) while `MAIN BREAKER` is open; closing the breaker inside the `49.5–50.5 Hz` window magnetically locks the generator to the regional grid at `50.0 Hz`, turning `TURBINE THROTTLE` into a direct **MWe gas pedal** (`throttle × steam pressure`).
- **3-Stage Thermal & Hydraulic Cascade:** Control rods (`UNIT A-2`) drive MWt thermal power and boil drum separator water (`UNIT B`, target `-100 to +100 mm` & `60–72 BAR`) to feed the turbines (`UNIT C`), while `ГЦН 1–4` circulation pumps, bearing oil cooling, Helium-N2 graphite blanketing, and the Bubbler Pool condensate return keep the core cooled and contained.
- **RBMK Hazards (`Void` & `Xenon-135`):** Boiling dry channels triggers **Positive Void Reactivity (`+α_φ`)** surges; cutting power breeds **Xenon-135** neutron poisoning. Counter both by clicking hot red (`void`) or cyan (`xenon`) tiles on the **37-channel octagonal core map**, firing **Boron Injection**, recharging the **Boron Piston Pump**, or burning Xenon out above `1800 MWt`.
- **Pravda Desk Integration:** Approving genuine Moscow mandates (`SURGE`, `DIVERT`, `SHED`) dispatches operational targets via the **Pneumatic Tube** outbox (`85s` compliance window) and updates `NEEDED MWe` on `UNIT C`. Approving a CIA forgery sabotages core channels and grid stability; shredding CIA forgeries (`УНИЧТОЖИТЕЛЬ-84`) cools the core and removes anomalies.

---

## 📟 `WE-PAD 84`, 8-Step Tutorial & Document Inspection

- **Handheld `ЭЛЕКТРОНИКА МЫ-ПАД 84` (`[E]` to toggle, `[TAB]` to inspect):**
  - Guides new operators through an **8-Step Interactive RBMK-1000 Startup & Hazard Tutorial (`STEP 0–8`)** narrated by **Comrade Volkov** — covering cold start (`ГЦН 1–4` & Feedwater), rod withdrawal & Auto-Regulator (`АР`), building steam, spinning & synchronizing to `50.0 Hz`, balancing `600 MWe` across 6 substations, and surviving hands-on **Positive Void (`STEP 7`)** and **Xenon-135 (`STEP 8`)** drills.
  - Once `STEP 8` is cleared, `K.O.M.R.A.D.-84 // LIVE DISPATCH` (`src/shared/komradLiveDispatches.ts`) takes over with real-time reactor alerts and printer commentary across 6 WE-PAD tabs (`[1] GUIDE`, `[2] TELEM`, `[3] STARTUP`, `[4] ORDERS`, `[5] ALARMS`, `[6] MANUAL`).
- **3D Document Forgery Inspection:**
  - Drag printed directives across the brass tear-bar, open the **7-Tab Technical & KGB Master Folder** (`I. KGB Forgery Guide` & `II. RBMK Panel Manual`), sweep the **2x Optical UV Magnifying Glass** over seals and watermarks (`★ СССР • ГОССТАНДАРТ 84 ★` vs. Langley counterfeits), stamp **`APPROVED`** or **`SHREDDED`**, pack approved orders into the pneumatic capsule, or feed CIA forgeries into the shredder.

---

## 🎮 Controls & Hotkeys

| Input | Action |
| :--- | :--- |
| **`[0]` / `[ESC]`** | Return to Operator Chair overview (and exit Free-Look) |
| **`[1]`** | Zoom to **`UNIT A`** (6 Substation MW levers, Cooling Pumps A/B, AZ-5 & Boron) |
| **`[2]`** | Zoom to **`K.O.M.R.A.D.-84`** Terminal (`CRT` & `SKALA-84` Diagnostics) |
| **`[3]`** | Zoom to **`UNIT A-2` & `UNIT B`** (37-Tile Core Map, Rods, Feedwater, `ГЦН 1–4`, Gas Loop) |
| **`[4]`** | Zoom to **Inspector Desk** (Pravda Printer, Manual, UV Lens, Stamps, Tube & Shredder) |
| **`[5]`** | Zoom to **`UNIT C`** (Turbine Throttle, `50.0 Hz` Synchroscope, Main Breaker & Aux Switches) |
| **`[6]` / `[7]`** | Quick-angle views across the left horseshoe panels (`UNIT A` ↔ `UNIT A-2` ↔ `UNIT B`) |
| **`[E]` / `[TAB]`** | Pick up / put down **`WE-PAD 84`** (`[E]`) • Toggle close-up view (`[TAB]`; `[1–6]` switch tabs while inspecting) |
| **`Scroll Wheel`** | Fine-adjust 3D handwheels (`±5%`, or **`Shift + Scroll`** for `±1%`), MW levers (`±25 MW`), and switches |
| **`Left Ctrl` + `WASD`/Mouse** | Toggle Free-Look Mode (`PointerLock`) and pan around the bunker |
| **`Space` / `Enter`** | Engage Main Breaker / Start Shift / Re-close tripped breaker |
| **`Shift + Space`** | Toggle Endless **Sandbox / No-Fail Test Mode** (`isGodMode`) |
| **`Backspace`** | Skip the 8-step `WE-PAD 84` tutorial and jump straight into live shift operations |
| **`F2`** | Open **KGB Ministry Override** debug console (`DebugMenu.tsx`) |

---

## 🖥️ Visual Aesthetic, Shaders & Procedural Audio

- **Chiaroscuro Micro-Pixel Pipeline:** Locked `dpr={1}` rendering with `PCFSoftShadowMap`, custom **4×4 Bayer ordered dithering & ACES split-tone pass** (`src/shared/BuckshotDitherPass.tsx`) that protects crisp paper and CRT text while bathing bunker shadows in cold Chernobyl teal and warm tungsten highlights.
- **Custom 3D GLB Hardware & Procedural PBR:** Custom `.glb` assets (`public/models/*.glb` generated via `scripts/generate-soviet-glb-models.mjs`), procedural hammered metal & Bakelite textures (`src/shared/proceduralMaterials.ts`), and `THREE.NearestFilter` micro-pixel `CanvasTexture`s adhering to the 1984 Soviet palette (`#141414`, `#23312b`, `#33ff66`, `#ffb000`, `#ff2a2a`, `#e6dec3`).
- **Typography:**
  - `Kremlin` — 3D stenciled/engraved steel plates, headers, and main menu poster (`public/main-menu-poster.jpg`).
  - `VT323` — K.O.M.R.A.D.-84 CRT displays, `SKALA-84`, and digital telemetry.
  - `Courier Prime` — Pravda dot-matrix directives, KGB Security Manual, and rubber ink stamps.
- **Zero-Dependency Web Audio API:** Procedural sound synthesis across `src/modules/reactor/audioSynth.ts`, `src/modules/reactor/soundtrackPlayer.ts`, and `src/modules/inspector/audio.ts` (Geiger counter, turbine hum, knife-switch slams, dot-matrix printer, shredder, pneumatic tube whoosh, and dynamic Redline soundtrack crossfade).

---

## 🏗️ Tech Stack & Modular Architecture

- **Framework:** React 19 + TypeScript + Vite (`base: './'` for itch.io embed support)
- **3D Engine:** Three.js + React Three Fiber (`three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`) with 60 FPS `useFrame` + `useRef` imperative updates
- **State Management:** `zustand` (`src/shared/useGameStore.ts` & `src/modules/inspector/useDeskStore.ts`)

To guarantee zero merge conflicts during parallel AI-assisted development, the repository enforces strict module boundaries backed by an automated KGB `pre-commit` border guard (`scripts/kgb-border-hook.mjs`):

```text
src/
├── modules/
│   ├── reactor/     # Komrad Kristianov — <ReactorStation3D />, audioSynth.ts, soundtrackPlayer.ts
│   ├── terminal/    # Komrad Kristianov — <TerminalStation3D />, komradScript.ts (K.O.M.R.A.D.-84)
│   └── inspector/   # Komrad Oleg       — <InspectorDesk3D />, WE-PAD 84, inspectorCanvas.ts, useDeskStore.ts, audio.ts
├── simulation/      # RBMK-1000 Physics — rbmkPhysics.ts (Thermal/Void/Xenon/50Hz Grid-Locked turbine simulation)
└── shared/          # Shared Contract   — ControlRoomScene.tsx, MechanicalPanels3D.tsx, BuckshotDitherPass.tsx,
                     #                     CameraController.tsx, MainMenuOverlay.tsx, komradLiveDispatches.ts,
                     #                     proceduralMaterials.ts, DebugMenu.tsx, types.ts, useGameStore.ts
```

See [`PLAN.md`](PLAN.md) for the development roadmap, [`AGENTS.md`](AGENTS.md) for AI agent rules, and [`PRAVDA_TELEGRAF.md`](PRAVDA_TELEGRAF.md) for inter-department dispatches between Sector 84 stations.

---

## 🚀 Getting Started & Party Commands

```bash
# Install dependencies
npm install

# Start local development server (with Sector 84 telemetry startup banner)
npm run dev       # or: npm run shift

# Run KGB Border Guard, TypeScript check (tsc -b) & linter (oxlint)
npm run kgb

# Fetch from Moscow & display Stakhanovite scoreboard + latest Red Telegraph dispatch
npm run pravda

# Type-check and build production bundle
npm run build

# Run linter directly
npm run lint
```

---

## 👥 Team & Branch Workflow

- **Chief Engineer Komrad Kristianov** (`Komrad-Kristianov` branch) — `<ReactorStation3D />`, `<TerminalStation3D />` & K.O.M.R.A.D.-84 Systems
- **Senior Inspector Komrad Oleg** (`Komrad-Oleg` branch) — `<InspectorDesk3D />`, `WE-PAD 84`, RBMK-1000 Control Panels & Physics Integration
- **`main`** — Shared 3D bunker infrastructure & verified integration branch
