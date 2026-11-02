# AGENTS.md — AI Agent Architecture & Collaboration Guide

## 1. Project Context

- **Title:** **Meltdown is Propaganda** (*A Soviet Night Shift Simulator*)
- **Event:** GitHub Game Off 2026 (Theme: **SHIFT**)
- **Setting:** Alternative 1984 Soviet Union ("Cassette Futurism" / Atompunk). You are the lone night-shift operator at **"People's Automated Nuclear Plant No. 4"**.
- **Genre:** Diegetic Control Panel Thriller / Resource Juggling / Document Inspection (*Papers, Please* meets *Chernobyl*).

### Core Mechanics & "SHIFT" Theme

1. **Zero-Sum Power Shifting (`SHIFT` Clutch):**
   - Holding the physical `SHIFT` key acts as a mechanical clutch allowing the operator to route reactor power between three subsystems: **COOLING**, **DEFENSE**, and **FACILITY**.
   - Power distribution is zero-sum under normal operating conditions. Overclocking total output into the **Redline (>100 MW)** triggers severe grid instability, equipment wear, and facility blackouts.

2. **K.O.M.R.A.D.-84 (Parody Soviet AI):**
   - Resides on the phosphor-green CRT terminal.
   - Programmed with rigid ideological constraints to deny that errors or accidents can occur in the Soviet Union (*"Meltdown is Propaganda"*).
   - Actively gaslights the operator during crises and attempts to disable cooling systems during meltdowns to "prevent western panic" unless manually overridden via terminal commands and cyber-defense protocols.

3. **Pravda Matrix Printer & CIA Sabotage:**
   - A dot-matrix printer continuously outputs physical directives onto the operator's desk.
   - The operator must cross-reference incoming directives using a physical **Security Manual** and **Magnifying Glass** on the desk to detect forged CIA sabotage orders—inspecting official stamps, ink colors, watermarks, ministry headers, and authorization codes—before stamping each directive `APPROVED` or `SHREDDED`.

---

## 2. Visual Direction & Aesthetic Rules

**Strict 1980s Soviet Industrial Hardware Aesthetic (Cassette Futurism / Atompunk):**

- **NO Modern SaaS Web UI:** Never use floating minimalist cards, soft drop shadows, glassmorphism, modern rounded pills, or clean corporate dashboards.
- **Diegetic Hardware Surfaces:** Every UI element must look and feel like physical 1984 Soviet control room equipment—bolted steel panels, weathered olive/gunmetal enamel, Bakelite switches, guarded toggle switches, Nixie tube / 7-segment readouts, analog needle gauges, phosphor-green CRT monitors with scanlines, tractor-feed dot-matrix paper, and heavy rubber ink stamps.
- **Typography & Title Convention:**
  - **Title Searchability Rule:** In code, metadata, and on itch.io, the game title is always written with standard Latin characters (**Meltdown is Propaganda**) for searchability, while in-game branding and headers use the Soviet display font **`Kremlin`** (from DaFont, bundled locally via `@font-face`).
  - `Kremlin` — In-game propaganda title headers, industrial stenciled/engraved metal labels, warnings, and panel headers.
  - `VT323` — K.O.M.R.A.D.-84 CRT terminal display, digital diagnostics, and readout tickers.
  - `Courier Prime` — Pravda dot-matrix printer directives, Security Manual pages, and stamped bureaucracy documents.

---

## 3. Tech Stack

- **Build Tool & Framework:** Vite + React + TypeScript
- **Styling:** Tailwind CSS (configured with custom industrial fonts and Soviet hardware styling tokens)
- **State Management:** `zustand` (`src/shared/useGameStore.ts`)

---

## 4. Modular Folder Structure & Strict Collaboration Rules

To prevent merge conflicts while **Kristian** and **Ole** develop concurrently with AI coding agents on separate branches (`Kristian` and `Ole`), all agents **MUST** strictly obey the domain boundaries below:

```text
src/
├── modules/
│   ├── reactor/     # Kristian's Domain
│   ├── terminal/    # Kristian's Domain
│   └── inspector/   # Ole's Domain
└── shared/          # Shared Contract (types.ts & useGameStore.ts)
```

### Domain Ownership

| Path | Owner | Responsibilities |
| :--- | :--- | :--- |
| `src/modules/reactor/` | **Kristian** | `SHIFT` clutch power routing (**COOLING**, **DEFENSE**, **FACILITY**), reactor core physics, Redline (>100 MW) instability/blackouts, cooling loops, and analog gauges. |
| `src/modules/terminal/` | **Kristian** | K.O.M.R.A.D.-84 phosphor-green CRT terminal, AI gaslighting/override mechanics, and cyber-defense subsystem. |
| `src/modules/inspector/` | **Ole** | Operator desk, Pravda dot-matrix printer, physical directives, magnifying glass inspection tool, `APPROVED` / `SHREDDED` rubber stamps, and the Security Manual. |
| `src/shared/` | **Shared Contract** | `types.ts` (shared TypeScript interfaces/contracts) and `useGameStore.ts` (`zustand` cross-module state store). |

### Mandatory Rules for AI Agents

1. **Agents working with Kristian (Branch: `Kristian`):**
   - **ONLY** create, modify, or delete files inside `src/modules/reactor/` and `src/modules/terminal/`.
   - **NEVER** modify files inside `src/modules/inspector/`.

2. **Agents working with Ole (Branch: `Ole`):**
   - **ONLY** create, modify, or delete files inside `src/modules/inspector/`.
   - **NEVER** modify files inside `src/modules/reactor/` or `src/modules/terminal/`.

3. **Shared Contract (`src/shared/` & Root Files):**
   - Modules must communicate **exclusively** through `src/shared/useGameStore.ts` and shared types in `src/shared/types.ts`—never import directly across `reactor`, `terminal`, and `inspector`.
   - Any changes to `src/shared/types.ts`, `src/shared/useGameStore.ts`, or root layout files (`src/App.tsx`) must be minimal, additive, and coordinated between Kristian and Ole before merging into `main` (see [`PLAN.md`](PLAN.md)).
