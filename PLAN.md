# ☢️ MELTDOWN IS PROPAGANDA — 3D Architecture & Development Plan
**Subtitle:** *A Soviet Night Shift Simulator*  
**Event:** GitHub Game Off 2026 (Nov 1 – Dec 1, 2026)  
**Theme:** **SHIFT**  
**Developers:** Komrad Kristianov (`Komrad-Kristianov` branch) & Komrad Oleg (`Komrad-Oleg` branch)

---

## 1. High Concept & Interpretation of the "SHIFT" Theme
The year is 1984 in an alternative-history, retro-futuristic Soviet Union (*Cassette Futurism / Atompunk*). The player is alone on the night shift inside the 3D bunker of **People's Automated Nuclear Plant No. 4 (Sector 84)**.

The theme **SHIFT** is woven into three layers:
1. **The Night Shift (Time & Survival):** Survive 5 increasingly chaotic night shifts (`00:00` to `06:00`) without a reactor core meltdown (`1000°C`) or being arrested for treason (`3 Strikes`).
2. **Power Shifting (Physical 3D `SHIFT` Clutch):** The reactor safely produces **100 MW**, while maximum subsystem demand reaches **180 MW**. Holding the physical `SHIFT` key rotates the heavy 3D Bakelite clutch lever into its slot with sparks and mechanical clanks, allowing the operator to route power between **COOLING**, **DEFENSE**, and **FACILITY**. Overclocking into the *Redline* (`101–180 MW`) builds grid instability and risks facility-wide blackouts.
3. **Reality Shifting (Propaganda vs. Reality):** The state AI **K.O.M.R.A.D.-84** denies that malfunctions can occur in the Soviet Union and gaslights the operator while the **CIA** injects forged sabotage orders into the 3D dot-matrix printer.

---

## 2. 100% True 3D First-Person Architecture (Zero 2D Screens or `<Html>` Overlays)
The entire game takes place inside a **100% physical first-person 3D control room** rendered with **Three.js / React Three Fiber (`@react-three/fiber` & `@react-three/drei`)**.

**CRITICAL ARCHITECTURAL RULE:** There are **NO** 2D split-screen panels, flat DOM overlays, SVG panels, or R3F `<Html>` tags in the 3D scene. Every gauge, needle, rotary valve, hinged safety cover, lever, CRT monitor glass, tractor-feed paper sheet, UV magnifying glass, and rubber stamp is a **real 3D mesh** with `THREE.NearestFilter` micro-pixel `CanvasTexture`s (inspired by *Buckshot Roulette* and *Inscryption*).

```text
+-----------------------------------+-----------------------------------+
| LEFT 3D CONSOLE (Keys [1] & [3])  | CENTER 3D CONSOLE (Key [2])       |
| <ReactorStation3D />              | <TerminalStation3D />             |
| (Kristianov - src/modules/reactor)| (Kristianov - src/modules/terminal)|
| - Cylindrical 3D gauges & needles | - Physical 3D CRT monitor & keys  |
| - 3D pipes & rotary valve wheels  | - Curved 3D screen CanvasTexture  |
| - 3D Geiger counter & AZ-5 button |   with #33ff66 scanlines & radar  |
| - 3D [SHIFT] clutch lever &       | - K.O.M.R.A.D.-84 gaslighting &   |
|   emissive 3D MW indicator blocks |   CIA ARPANET firewall defense    |
+-----------------------------------+-----------------------------------+
| RIGHT 3D OPERATOR DESK (Key [4])  | DYNAMIC 3D SCENE LIGHTING         |
| <InspectorDesk3D />               | (src/shared/ControlRoomScene.tsx) |
| (Oleg - src/modules/inspector)    | - FACILITY MW drives the 3D desk  |
| - 3D "Pravda" dot-matrix printer  |   lamp spotlight & printer speed  |
| - 3D tractor-feed paper meshes    | - 0 MW plunges the desk into dark |
| - 3D KGB Security Manual '84      | - Rotating red #ff2a2a ceiling    |
| - 3D 2x Optical Magnifying Glass  |   klaxon casts shadows in Redline |
| - Animated 3D [APPROVE] / [SHRED] | - 60 FPS useFrame + getState()    |
+-----------------------------------+-----------------------------------+
```

### Camera Navigation, Blind Spots & Direct 3D Raycasting
* **Free 3D Camera & Blind Spots (`0` / `ESC`):** The operator sits inside the bunker and can freely rotate the camera with the mouse or `WASD` / arrow keys, or snap-zoom closely into stations (`1`–`4`). Looking toward the desk or terminal places the reactor gauges outside the field of view, making 3D audio and room lighting essential.
* **Direct 3D Raycast Interaction:** All interactions happen directly on 3D meshes (`onPointerDown`, `onPointerMove`, `onPointerUp`, `onClick`)—physically dragging 3D levers down their slots, turning 3D cooling valve wheels, flipping the 3D hinged AZ-5 safety cover, pressing 3D terminal keys, moving the 3D UV magnifier over 3D paper meshes, and stamping directives with 3D rubber stamps.

---

## 3. Domain Ownership & 3D Modules (Zero Merge Conflicts)

### 🛠️ Komrad Kristianov's Domain (`src/modules/reactor/` & `src/modules/terminal/`)

1. **`<ReactorStation3D />` (`src/modules/reactor/`):**
   - Cylindrical 3D gauges mounted in an angled Soviet steel console (`#23312b`) with physical 3D needles rotating around their axes in `useFrame` for Core Temp (`0–1000°C`), Pressure (`BAR`), and a 3D Geiger-Müller dosimeter (`R/h`).
   - Physical 3D pipes, rotatable 3D cooling valve handwheels, 3D drag-operated pump switches, and a physical 3D **АЗ-5 (AZ-5)** emergency button under a hinged 3D safety cover with yellow and black hazard stripes.
   - Heavy Bakelite (`#141414`) 3D `[SHIFT]` clutch lever that rotates down into its slot with mechanical sound and sparks when `[SHIFT]` is held, paired with three vertical columns of glowing emissive 3D indicator blocks (**1. COOLING**, **2. DEFENSE**, **3. FACILITY**) and a physical 3D scale for Safe Limit (`100 MW`) and *Redline Overclock* (`101–180 MW`).

2. **`<TerminalStation3D />` (`src/modules/terminal/`):**
   - Heavy physical 3D CRT monitor and sculpted 3D keyboard embedded in the center console.
   - Curved 3D screen glass mesh driven by a dynamic `THREE.CanvasTexture` (`NearestFilter`) rendering phosphor-green (`#33ff66`) terminal logs, scanlines, K.O.M.R.A.D.-84 state gaslighting (*"Meltdown is Propaganda"*), and CIA cyber-defense telemetry, casting green light into the 3D bunker.

3. **Procedural Web Audio Synthesizer (`Web Audio API`):**
   - 60Hz reactor hum shifting pitch with heat/MW, Geiger counter clicks, Bakelite switch clanks, and klaxon alarms.

### 🔍 Komrad Oleg's Domain (`src/modules/inspector/`)

1. **`<InspectorDesk3D />` (`src/modules/inspector/`):**
   - Physical 3D operator desk with a 3D desk lamp, 3D "Pravda-84" dot-matrix printer, 3D KGB Security Manual '84 booklet (`1. SEALS`, `2. FONTS & MINISTRIES`, `3. COLOURS`) that can be opened and paged through, a physical 3D **2x Optical Magnifying Glass** (straight zoom, no UV), and two physical 3D rubber stamps (`[APPROVE]` and `[SHRED]`).
   - Directives feed physically out of the 3D printer as 3D paper meshes (`#d8d2c0` / `#e6dec3`) onto the desk surface with procedurally generated `CanvasTexture`s rendering official Soviet seals (`USSR_STATE_SEAL`, `MINSREDMASH_ATOM`, `KGB_SWORD_SHIELD`), typography (`GOST_MONO`, `PRAVDA_BLOCK`, or forbidden `WESTERN_SERIF` / `SLANTED_ITALIC`), paper tints, and ministry inks.
   - The player grabs and moves the physical 3D **2x Optical Magnifying Glass** in 3D space over the 3D paper and manual; the 3D lens renders a straight 2x optical magnification of the seal's micro-print ring (`★ СССР • ГОССТАНДАРТ 84 ★` vs `★ CCCP-LATIN ★`), star points (5-pt vs 6-pt/4-pt), atomic orbits, and serif details.
   - Clicking with `[APPROVE]` or `[SHRED]` physically animates the 3D stamp down onto the 3D paper mesh, imprinting ink onto the document texture before archiving or feeding it into a 3D document shredder.

---

## 4. Consequence Matrix (How Komrad Oleg's 3D Desk Impacts Komrad Kristianov's 3D Reactor)

| Document Type | Operator Choice | In-Game Consequence |
| --- | --- | --- |
| **Genuine Party Order** | `APPROVED` (Correct) | Order safely executed (auxiliary cooling or grid stabilization). The Party is pleased. |
| **Genuine Party Order** | `SHREDDED` (Error!) | **Suspected Treason (`+1 Strike`).** K.O.M.R.A.D.-84 logs a reprimand; `3 Strikes` = Siberia (Game Over). |
| **Forged CIA Sabotage** | `SHREDDED` (Correct) | Sabotage foiled! Reactor stability bonus and terminal commendation. |
| **Forged CIA Sabotage** | `APPROVED` (Disaster!) | **Sabotage executed!** Core temp spikes (`+200°C`), cooling pumps lock, or K.O.M.R.A.D.-84 is hijacked. |

---

## 5. Campaign Progression Across 5 Night Shifts

Each shift lasts ~3–4 minutes of real time (`00:00` to `06:00` in-game):

* **Shift 1 (Orientation):** Calm reactor. The 3D Security Manual only requires checking **Valid Ministry Stamp** and **Date (`1984`)**.
* **Shift 2 (Power Crunch):** Higher baseline heat—active 3D `SHIFT` clutch management required. Manual introduces **Authorization Codes**.
* **Shift 3 (3D 2x Optical Lens & Micro-Print Seals):** CIA uses replica stamps with micro-defects. The operator must move the **3D 2x Optical Magnifying Glass** over 3D papers to inspect **Seal Micro-Rings**, star points, and typography serifs.
* **Shift 4 (K.O.M.R.A.D.-84 Override):** The AI forcibly hijacks the Power Matrix to meet Five-Year Plan quotas. Balance blackouts in the dark while 3D directives accumulate.
* **Shift 5 (Redline Finale):** Maximum crisis. Controlled overclocking in the *Redline* (`>100 MW`), multi-layered CIA forgeries, and continuous cooling until `06:00`.

---

## 6. Shared Data Contract (`src/shared/types.ts` & `useGameStore.ts`)

All 3D station modules communicate **exclusively** through Zustand (`useGameStore.getState()` inside `useFrame` for 60 FPS 3D updates and selector hooks for discrete actions):

```typescript
export type SystemType = 'cooling' | 'defense' | 'facility';
export type DirectiveDecision = 'APPROVED' | 'SHREDDED';
export type CameraStation = 'overview' | 'reactor' | 'terminal' | 'power' | 'inspector';

export interface GameState {
  phase: 'boot' | 'playing' | 'victory' | 'meltdown' | 'gulag';
  activeStation: CameraStation;
  shiftNumber: number;       // 1 to 5
  shiftTimeMinutes: number;  // 0 (00:00) to 360 (06:00)
  isShiftKeyHeld: boolean;   // Physical SHIFT clutch state
  isGodMode: boolean;        // F2 Debug toggle
  treasonStrikes: number;    // 0 to 3 (3 = Gulag Game Over)

  // Reactor & Power (Komrad Kristianov)
  coreTemp: number;          // 300°C to 1000°C
  pressureBar: number;
  radiationLevel: number;
  maxSafePower: number;      // 100 MW (180 MW in Redline)
  powerAllocation: Record<SystemType, number>;
  isBlackout: boolean;

  // Terminal (Komrad Kristianov)
  terminalLogs: string[];
  ciaIntrusionActive: boolean;
  komradOverrideLocked: boolean;

  // Desk & Directives (Komrad Oleg)
  activeDirectives: DirectiveDocument[];
  printerProgress: number;

  // Shared Actions
  setActiveStation: (station: CameraStation) => void;
  setShiftKeyHeld: (held: boolean) => void;
  shiftPower: (system: SystemType, deltaMW: number) => void;
  setSubsystemPower: (system: SystemType, targetMW: number) => void;
  spawnDirective: (forceForgery?: boolean) => void;
  resolveDirective: (id: string, decision: DirectiveDecision) => void;
  tick: () => void;
}
```

---

## 7. Visual 3D Micro-Pixelart & Audio Rules

* **Zero 2D Screens or `<Html>` Overlays:** All interactive elements are 3D meshes in Three.js.
* **Mandatory 3D Drag-Operated Levers (Never Click-Only):** All 3D levers (`spaker`) must be physically grabbed and dragged up or down in 3D space via raycast pointer events (`onPointerDown` + `onPointerMove` + `onPointerUp`).
* **3D Micro-Pixel Materials (`THREE.NearestFilter`):**
  * Bakelite Black: `#141414`
  * Soviet Panel Green: `#23312b` (and `#364940`)
  * CRT Phosphor Green: `#33ff66` (and `#061a0c`)
  * Industrial Hazard Yellow: `#ffb000`
  * Crimson Alarm / Stamp Red: `#ff2a2a`
  * Aged Tractor Paper / Gauge Dials: `#e6dec3`
* **Typography on 3D Text & `CanvasTexture`s:** `'Kremlin'`, `'VT323'`, and `'Courier Prime'`.

---

## 8. 4-Phase Development Roadmap

### Phase 1: Shared 3D Bunker Foundation in `main`
1. `vite.config.ts` with `base: './'`.
2. Fullscreen 3D `<Canvas>` in `src/App.tsx`, `src/shared/ControlRoomScene.tsx`, and `src/shared/CameraController.tsx` with dynamic 3D lighting and pure 3D station mounts (`<ReactorStation3D />`, `<TerminalStation3D />`, `<InspectorDesk3D />`).
3. `types.ts`, `useGameStore.ts`, and `DebugMenu.tsx` (`F2`).

### Phase 2: Parallel 3D Station Construction (`Komrad-Kristianov` & `Komrad-Oleg` branches)
* **Komrad Kristianov:** Builds `<ReactorStation3D />` (3D gauges, rotary valves, hinged AZ-5, 3D `[SHIFT]` clutch & MW blocks) and `<TerminalStation3D />` (3D CRT mesh + `CanvasTexture`).
* **Komrad Oleg:** Builds `<InspectorDesk3D />` (3D desk, Pravda printer, 3D tractor-feed paper directives, 3D KGB Security Manual, 3D 2x optical magnifying glass, and animated 3D stamps).

### Phase 3: Soviet 3D Micro-Pixel Polish, Procedural Audio & Campaign (Shifts 1–5)
* Refine `THREE.NearestFilter` pixel textures, 3D mechanical animations, Web Audio synth, and 30–40 directives + K.O.M.R.A.D.-84 voice lines.

### Phase 4: Firebase Global Telemetry & itch.io Release
* Anonymous Firestore global counters (*Total USSR Meltdowns*, *Comrades Sent to Siberia*, *CIA Agents Exposed*) and production `.zip` bundle for GitHub Game Off 2026.
