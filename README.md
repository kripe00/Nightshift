<p align="center">
  <img src="./public/title-banner.svg" alt="Meltdown is Propaganda — A Soviet Night Shift Simulator" width="100%" />
</p>

# ☢️ Meltdown is Propaganda
### *A Soviet Night Shift Simulator*

> *"Comrade Operator: Reports of a core thermal anomaly are bourgeois fabrication. Meltdown is propaganda. Do not touch the cooling valves. Glory to the Collective."*
> — **K.O.M.R.A.D.-84**, Automated Plant Supervisor

**Meltdown is Propaganda** (*A Soviet Night Shift Simulator*) is a diegetic 1984 Soviet control-panel thriller combining frantic power-grid juggling with paranoid document inspection (*Papers, Please* meets *Chernobyl*), built for **GitHub Game Off 2026** (Theme: **SHIFT**).

---

## 📖 High Concept & The Three Layers of `SHIFT`

The year is **1984** in an alternative-history Soviet Union defined by heavy analog **Cassette Futurism** and **Atompunk** engineering. You are the lone night-shift operator locked inside the control bunker of **People's Automated Nuclear Plant No. 4**.

The jam theme **SHIFT** drives the game on three levels:

1. **The Night Shift (Time & Survival):**
   Survive **5 increasingly chaotic night shifts** from **00:00 to 06:00** without letting the reactor core reach `1000°C` meltdown—or accumulating **3 Treason Strikes** and being shipped to Siberia.
2. **Power Shifting (The Physical `SHIFT` Clutch):**
   The reactor safely outputs **100 MW**, while maximum subsystem demand reaches **180 MW**. You must hold the physical **`SHIFT`** key on your keyboard (acting as a heavy mechanical clutch) to reroute megawatts between **COOLING**, **DEFENSE**, and **FACILITY**. Overclocking into the **Redline (`101–180 MW`)** grants emergency power at the risk of severe grid instability and facility-wide blackouts.
3. **Reality Shifting (Propaganda vs. Reality):**
   The state AI **K.O.M.R.A.D.-84** is ideologically programmed to deny that a Soviet reactor can malfunction, gaslighting you and sabotaging power allocation while the **CIA** infiltrates your dot-matrix printer with forged sabotage orders.

---

## 🎛️ 4-Zone Diegetic Cockpit (`1600x900` Fixed 16:9 Canvas)

The entire game takes place on a single locked `1600x900` control-room screen with zero scrolling, divided into four physical hardware zones:

```text
+-----------------------------------+-----------------------------------+
| ZONE 1: REACTOR & COOLING         | ZONE 2: K.O.M.R.A.D.-84 TERMINAL  |
| (Kristian - src/modules/reactor)  | (Kristian - src/modules/terminal) |
| - Analog SVG Gauges (Temp/Press)  | - Green CRT screen with scanlines |
| - Cooling pumps, valves & AZ-5    | - AI propaganda & false telemetry |
| - Geiger counter & warning lamps  | - CIA Cyber-intrusion / Firewall  |
+-----------------------------------+-----------------------------------+
| ZONE 3: POWER SHIFTING MATRIX     | ZONE 4: INSPECTOR DESK            |
| (Kristian - src/modules/reactor)  | (Ole - src/modules/inspector)     |
| - Requires holding [SHIFT] clutch | - "Pravda" Dot-Matrix Printer     |
| - Routes MW across subsystems:    | - Draggable paper directives      |
|   1. COOLING (Core circulation)   | - Security Manual (flip pages)    |
|   2. DEFENSE (K.O.M.R.A.D./Wall)  | - Magnifying Glass (UV/microtext) |
|   3. FACILITY (Lamp, Printer, Air)| - Ink Stamps: [APPROVE] / [SHRED] |
+-----------------------------------+-----------------------------------+
```

---

## ⚖️ Directive Consequence Matrix

Every directive printed on the operator's desk directly impacts the reactor and your standing with the Party:

| Directive Type | Operator Stamp | In-Game Consequence |
| :--- | :--- | :--- |
| **Genuine Party Order** | `APPROVED` ✅ | Order executed safely (e.g., auxiliary coolant boost or grid stabilization). |
| **Genuine Party Order** | `SHREDDED` ❌ | **Suspected Treason (`+1 Strike`).** K.O.M.R.A.D.-84 logs a reprimand. `3 Strikes` = Gulag Game Over. |
| **Forged CIA Sabotage** | `SHREDDED` ✅ | Sabotage foiled! Reactor stability bonus and ideological commendation. |
| **Forged CIA Sabotage** | `APPROVED` 💥 | **Sabotage Executed!** Core temperature spikes (`+200°C`), cooling pumps lock, or K.O.M.R.A.D.-84 is hijacked. |

---

## 🗓️ 5-Shift Campaign Progression

Each night shift runs from **00:00 to 06:00** (~3–4 minutes of real-time pressure):

- **Shift 1 — Orientation:** Stable core. The Security Manual only requires verifying **Valid Ministry Stamps** and **Date (`1984`)**.
- **Shift 2 — Power Crunch:** Elevated baseline core heat forces constant `SHIFT`-clutch juggling. Manual adds **Authorization Ciphers**.
- **Shift 3 — Lens & Watermarks:** CIA forgeries now feature replica stamps. You must drag the **Magnifying Glass** over directives to inspect hidden **UV Watermarks** and micro-text typos.
- **Shift 4 — K.O.M.R.A.D.-84 Override:** The AI begins forcibly hijacking the Power Matrix to meet Five-Year Plan quotas. Balance blackouts in the dark while directives pile up.
- **Shift 5 — Redline Finale:** Total crisis. Controlled overclocking in the **Redline (`>100 MW`)**, multi-layered CIA forgeries, and continuous thermal management until `06:00`.

---

## 🖥️ Visual Direction & Typography

Strict **1980s Soviet Industrial Hardware Aesthetic**—zero modern SaaS UI, floating cards, or default HTML sliders.

- **Tactile Drag-Operated Levers:** Industrial levers (`spaker`) and main breakers are never simple click-to-toggle buttons—every lever is animated and must be physically grabbed and dragged up or down through its mechanical throw to operate.
- **Palette:** Weathered Soviet industrial green (`#23312b`), Bakelite black (`#141414`), phosphor CRT green (`#33ff66`), warning amber (`#ffb000`), alarm crimson (`#ff2a2a`), and aged tractor-feed paper (`#e6dec3`).
- **Title Searchability Rule:** Written as **Meltdown is Propaganda** in standard Latin text across code, DOM, and itch.io for searchability, and styled visually in-game using the **`Kremlin`** display font (from DaFont).

| Surface | Typography | Role |
| :--- | :--- | :--- |
| **Title Branding & Steel Panels** | `Kremlin` (DaFont) | In-game propaganda headers, stenciled metal plates, warning labels, and switches |
| **K.O.M.R.A.D.-84 CRT Terminal** | `VT323` | Phosphor-green scanline terminal, diagnostics, and Nixie readouts |
| **Pravda Printer & Bureaucracy** | `Courier Prime` | Dot-matrix directives, Security Manual pages, and rubber ink stamps |

---

## 🏗️ Tech Stack & Modular Architecture

- **Framework:** React 19 + TypeScript + Vite (`base: './'` for itch.io embed support)
- **Styling:** Tailwind CSS + Inline SVG hardware gauges & CSS brushed-metal textures
- **Audio:** Zero-dependency procedural **Web Audio API** synthesizer (60Hz reactor hum, Geiger clicks, Bakelite switch clanks, dot-matrix printer screech)
- **State Management:** `zustand` ([`src/shared/useGameStore.ts`](src/shared/useGameStore.ts))
- **Global Telemetry (Phase 4):** Firebase Firestore anonymous global counters (*Total USSR Meltdowns*, *Comrades Sent to Siberia*, *CIA Agents Exposed*)

To guarantee zero merge conflicts during parallel AI-assisted development, the repository enforces strict module boundaries:

```text
src/
├── modules/
│   ├── reactor/     # Kristian's Domain — Zone 1 & Zone 3 (SHIFT clutch, core physics, gauges)
│   ├── terminal/    # Kristian's Domain — Zone 2 (K.O.M.R.A.D.-84 CRT terminal & cyber defense)
│   └── inspector/   # Ole's Domain      — Zone 4 (Desk, Pravda printer, magnifier, stamps & manual)
└── shared/          # Shared Contract   — types.ts, useGameStore.ts, ViewportScaler, DebugMenu (F2)
```

See [`PLAN.md`](PLAN.md) for the complete 4-phase development roadmap and [`AGENTS.md`](AGENTS.md) for AI agent collaboration rules.

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Type-check and build production bundle
npm run build

# Run linter
npm run lint
```

---

## 👥 Team & Branch Workflow

- **Kristian** (`Kristian` branch) — Reactor Physics, Power Shifting Matrix & K.O.M.R.A.D.-84 Terminal
- **Ole** (`Ole` branch) — Operator Desk, Pravda Printer, Security Manual & Magnifying Glass Inspector
- **`main`** — Shared infrastructure & verified integration branch
