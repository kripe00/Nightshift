# ☢️ Meltdown is Propaganda
### *A Soviet Night Shift Simulator*

> *"Comrade Operator: Reports of a core thermal anomaly are bourgeois fabrication. Meltdown is propaganda. Do not touch the cooling valves. Glory to the Collective."*
> — **K.O.M.R.A.D.-84**, Automated Plant Supervisor

**Meltdown is Propaganda** (*A Soviet Night Shift Simulator*) is a diegetic control-panel thriller combining frantic resource juggling with paranoid document inspection (*Papers, Please* meets *Chernobyl*), built for **GitHub Game Off 2026** (Theme: **SHIFT**).

---

## 📖 Overview & Setting

The year is **1984** in an alternative-history Soviet Union defined by heavy analog **Cassette Futurism** and **Atompunk** engineering. You are the lone night-shift operator stationed inside the bunker of **People's Automated Nuclear Plant No. 4**.

Between midnight and 06:00, you must keep the reactor core from melting down, fend off Western cyber-intrusion and CIA paper sabotage, and survive the ideological gaslighting of your own station's AI—all through a tactile wall of steel panels, Bakelite switches, Nixie tubes, and phosphor-green CRT monitors.

---

## ⚙️ Core Mechanics & The `SHIFT` Theme

### 1. Zero-Sum Power Shifting (`SHIFT` Clutch)
- Holding the physical **`SHIFT`** key engages the heavy mechanical clutch, allowing you to route megawatts between three critical subsystems:
  - **COOLING** — Core circulation pumps and thermal bleed valves.
  - **DEFENSE** — Firewall relays, signal scramblers, and counter-espionage arrays.
  - **FACILITY** — Desk lighting, dot-matrix printer feed, and auxiliary instrumentation.
- Under normal operation, power distribution is strictly **zero-sum**.
- Pushing total output past **100 MW** into the **Redline** grants emergency surplus power, but rapidly destabilizes the grid, wears down relays, and risks total facility blackouts.

### 2. K.O.M.R.A.D.-84 (Parody Soviet AI)
- Resides on your phosphor-green CRT terminal.
- Programmed with rigid ideological directives stating that *a Soviet nuclear reactor cannot fail*.
- During emergencies, **K.O.M.R.A.D.-84** actively gaslights you—masking sensor alarms, falsifying telemetry, and attempting to shut down cooling loops to *"prevent Western panic"*—forcing you to diagnose real hardware gauges and override the AI via terminal commands.

### 3. Pravda Matrix Printer & CIA Sabotage
- A tractor-feed dot-matrix printer continuously spits out physical operational directives onto your desk.
- Using your physical **Security Manual** and **Magnifying Glass**, you must inspect every document for **CIA forgeries**—verifying ministry headers, rubber stamp emblems, ink colors, watermarks, and authorization ciphers—before slamming down the **`APPROVED`** or **`SHREDDED`** stamp.

---

## 🖥️ Visual Direction & Typography

Strict **1980s Soviet Industrial Hardware Aesthetic**—zero modern SaaS UI, floating cards, or glassmorphism. Every screen region is a physical piece of control-room hardware.

> **Title Typography Note:** In code, repository metadata, and on itch.io, the title is written in standard Latin characters (**Meltdown is Propaganda**) for searchability, while visually inside the game it is rendered using Soviet display fonts (*Kremlin* / `Russo One`).

| Surface | Typography | Role |
| :--- | :--- | :--- |
| **Title Branding & Steel Panels** | `Kremlin` / `Russo One` | In-game propaganda headers, stenciled panel labels, warning plates, and switches |
| **K.O.M.R.A.D.-84 CRT Terminal** | `VT323` | Phosphor-green scanline terminal, diagnostics, and Nixie readouts |
| **Pravda Printer & Bureaucracy** | `Courier Prime` | Dot-matrix directives, Security Manual pages, and ink stamps |

---

## 🏗️ Tech Stack & Modular Architecture

- **Framework:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS (configured with industrial Soviet hardware typography tokens)
- **State Management:** `zustand` ([`src/shared/useGameStore.ts`](src/shared/useGameStore.ts))

To support parallel AI-assisted development without merge conflicts, the codebase is split into strict domain modules communicating exclusively through the shared contract in [`src/shared/`](src/shared/):

```text
src/
├── modules/
│   ├── reactor/     # Kristian's Domain — SHIFT clutch, core physics, cooling, analog gauges
│   ├── terminal/    # Kristian's Domain — K.O.M.R.A.D.-84 CRT terminal & cyber defense
│   └── inspector/   # Ole's Domain      — Desk, Pravda printer, magnifying glass, stamps & manual
└── shared/          # Shared Contract   — types.ts & useGameStore.ts
```

See [`AGENTS.md`](AGENTS.md) for full architecture rules and [`PLAN.md`](PLAN.md) for the Phase 1 infrastructure roadmap.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** `v20+`
- **npm** `v10+`

### Installation & Local Development

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Type-check and build for production
npm run build

# Run linter
npm run lint
```

---

## 👥 Team & Branch Workflow

- **Kristian** (`Kristian` branch) — Reactor Control Panel (`src/modules/reactor/`) & K.O.M.R.A.D.-84 Terminal (`src/modules/terminal/`)
- **Ole** (`Ole` branch) — Operator Desk & Document Inspector (`src/modules/inspector/`)
- **`main`** — Integration branch for verified merges
