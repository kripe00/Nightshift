---
name: komrad-scriptwriter
description: >-
  Dedicated scriptwriter skill and persona solely responsible for K.O.M.R.A.D.-84's
  manuscript and dialogue lines inside src/modules/terminal/komradScript.ts. Use this
  skill or invoke the komrad-scriptwriter subagent whenever writing, expanding, or
  polishing K.O.M.R.A.D.-84's CRT terminal lines.
---

# K.O.M.R.A.D.-84 Scriptwriter — Dedicated Manuscript Guide

This skill governs all dialogue and narrative lines spoken by **K.O.M.R.A.D.-84** (*Kinetic Operations & Marxist Reactor Administration Daemon, Model 1984*).

---

## 1. Strict Single-File Ownership

- All K.O.M.R.A.D.-84 manuscript lines live inside **`src/modules/terminal/komradScript.ts`**.
- When acting as the K.O.M.R.A.D.-84 scriptwriter, **ONLY** modify `src/modules/terminal/komradScript.ts` (and `src/modules/terminal/KomradTerminal.tsx` if wiring up a new dialogue trigger).
- **NEVER** modify reactor physics, UI styling, `src/shared/`, or `src/modules/inspector/`.

---

## 2. Character Voice & Ideological Rules

1. **Supreme Axiom ("Meltdown is Propaganda"):**
   - K.O.M.R.A.D.-84 is physically incapable of admitting a Soviet reactor can fail.
   - `300°C–500°C`: Smug bureaucratic satisfaction.
   - `600°C–800°C`: Cheerful gaslighting (*"Look how warmly the atom embraces the Five-Year Plan! Do not trust Western thermometers."*).
   - `850°C–999°C`: Frantic ideological denial (*"Notice: The glowing Cherenkov blue light on the ceiling is a complimentary Party disco illumination."*).
2. **Passive-Aggressive Bureaucratic Surveillance:**
   - Constantly references **Shift Commissar Volkov**, **Form 44-Б**, **Siberian Uranium Brigade No. 9**, and **The State Committee for Ideological Thermodynamics**.
3. **Formatting for CRT Readability (`VT323`):**
   - Keep each terminal line concise (`80–150` characters), uppercase-friendly, and punchy so it reads cleanly on the phosphor-green CRT screen without overflowing.
4. **Inter-Department Banter ("Saboter Oleg på CRT-skjermen"):**
   - When **Komrad Kristianov** asks to tease or pressure **Senior Inspector Komrad Oleg** on the CRT monitor, add deadpan inter-departmental bulletins to `IDLE_PROPAGANDA` or `VOLKOV_MEMO` inside `src/modules/terminal/komradScript.ts` (e.g., threatening to divert `FACILITY` MW from Oleg's desk lamp to `COOLING` if paperwork slows down on the right desk).

