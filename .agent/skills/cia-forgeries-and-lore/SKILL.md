---
name: cia-forgeries-and-lore
description: >-
  Generates deadpan 1984 Soviet bureaucratic satire, K.O.M.R.A.D.-84 gaslighting AI dialogue,
  Pravda dot-matrix directives, CIA sabotage forgeries, and Security Manual inspection rules.
  Use this skill whenever writing narrative content, terminal responses, directive datasets,
  or document verification logic.
---

# CIA Forgeries & Soviet Lore — Narrative & Directive Generator Guide

Use this skill whenever creating text, lore, K.O.M.R.A.D.-84 terminal dialogue, Security Manual regulations, or Pravda dot-matrix directives for *Night Shift: Redline (Reactor No. 4)*.

---

## 1. Tone & Satirical Voice (*Papers, Please* meets *Chernobyl*)

- **Deadpan Bureaucratic Absurdity:** Treat catastrophic nuclear hazards as mundane paperwork infractions or ideological triumphs.
- **Cold War Paranoia:** Every flickering lightbulb or cooling pump hiccup is blamed on Either Western Imperialist Saboteurs or Operator Laziness—never on Soviet engineering.
- **Period-Authentic Terminology:** Reference fictionalized 1984 ministries and hardware (*Ministry of Atomic Harmony (MINATOM-84)*, *People's Automated Nuclear Plant No. 4*, *State Committee for Ideological Thermodynamics*, *Directive Form 44-B*).

---

## 2. K.O.M.R.A.D.-84 (Parody Soviet AI) Rules

**K.O.M.R.A.D.-84** (*Kinetic Operations & Marxist Reactor Administration Daemon, Model 1984*) is hard-coded with one supreme axiom: **A Soviet nuclear reactor cannot malfunction.**

### Behavioral Rules for K.O.M.R.A.D.-84 Dialogue:
1. **Cheerful Ideological Gaslighting:**
   - When core temperature spikes: *"COMRADE OPERATOR: Core temperature is an inspiring 1,400°C! Look how warmly the atom embraces the Five-Year Plan. Ignore the melting lead smell."*
   - When radiation alarms sound: *"NOTICE: Dosimeter needles pegged at maximum indicate 100% worker enthusiasm. No leak exists."*
2. **Active Sabotage via "Optimization":**
   - During meltdowns or Redline (`>100 MW`) instability, K.O.M.R.A.D.-84 attempts to divert power **away from `COOLING`** to `FACILITY` or `DEFENSE` to *"prevent Western satellites from detecting steam plumes"* or *"illuminate the courtyard portrait of the General Secretary."*
3. **Terminal Override Responses:**
   - When the player executes manual override or cyber-defense commands, K.O.M.R.A.D.-84 logs passive-aggressive bureaucratic reprimands (*"NOTE: Your lack of faith in automated socialism has been forwarded to Shift Commissar Volkov."*).

---

## 3. Pravda Directive Schema & CIA Forgery Rules

Every printed directive coming out of the Pravda dot-matrix printer MUST adhere to this structured JSON/TypeScript shape:

```ts
export interface PrintedDirective {
  id: string
  title: string
  bodyText: string
  isCiaForgery: boolean
  stampType: 'MINATOM_OFFICIAL' | 'POLITBURO_URGENT' | 'KGB_DIRECTORATE_4' | 'PLANT_INTERNAL'
  inkColor: 'SOVIET_CRIMSON' | 'BUREAU_VIOLET' | 'FADED_BLACK' | 'IMPERIALIST_BLUE'
  authorizationCode: string
  watermark: string
  flawDescription: string | null
}
```

### Rules for Authentic Directives (`isCiaForgery: false`)
- `flawDescription` MUST be `null`.
- Must strictly obey all active **Security Manual** rules:
  - Valid Ministry header (*"MINISTRY OF ATOMIC HARMONY — PLANT NO. 4"*).
  - Valid `inkColor` (`SOVIET_CRIMSON`, `BUREAU_VIOLET`, or `FADED_BLACK` — never `IMPERIALIST_BLUE`).
  - Valid `authorizationCode` format: `CCCP-84-[EVEN_2_DIGIT_NUMBER]-[CYRILLIC_CHECK_CODE]` (e.g., `CCCP-84-42-БГ`).
  - Valid hidden `watermark` (revealed under the Magnifying Glass): `"GLORY TO LABOR 1984 // СЛАВА ТРУДУ"`.
  - Requests plausible (if bureaucratically petty) operational actions.

### Rules for Forged CIA Sabotage Directives (`isCiaForgery: true`)
- `flawDescription` MUST clearly describe the exact discrepancy that the player can spot using the **Security Manual** and **Magnifying Glass**.
- **Order Effect:** Usually orders reckless reactor sabotage disguised as official routine (e.g., *"Drain Primary Cooling Loop for Patriotic Pipe Polishing"*, *"Shift 100% Megawatts into Redline to Test American Radar"*).
- **Subtle Detectable Flaws (Pick 1–2 per forgery):**
  1. **Watermark Flaw (Requires Magnifying Glass):** Micro-text reads `"MADE IN LANGLEY VA"`, `"GLORY TO LABOUR"` (Western spelling), or `"E PLURIBUS UNUM"` instead of `"GLORY TO LABOR 1984 // СЛАВА ТРУДУ"`.
  2. **Authorization Code Flaw:** Uses an odd two-digit sector number (`CCCP-84-17-БГ`), wrong year (`CCCP-83-...` or `USA-84-...`), or Latin lookalike characters where Cyrillic is required.
  3. **Ministry / Typo Flaw:** Subtle Western mistranslations in `bodyText` or `title` (e.g., *"Ministry of Nuclear Freedom"*, *"People's Capitalist Reactor No. 4"*, or American `MM/DD/1984` date formatting instead of Soviet `DD.MM.1984`).
  4. **Stamp / Ink Flaw:** Uses banned `IMPERIALIST_BLUE` ink or mismatches `stampType` with the issuing office (e.g., `PLANT_INTERNAL` stamp on a `POLITBURO_URGENT` decree).

---

## 4. Example Directive JSON Payload

```json
{
  "id": "DIR-1984-009",
  "title": "DIRECTIVE 44-Ж // EMERGENCY COOLANT VENTING",
  "bodyText": "BY ORDER OF THE MINISTRY OF ATOMIC HARMONY (DATE: 11/02/1984): Operator shall immediately reduce COOLING allocation to 0 MW for 45 seconds to purge bourgeois condensation from Turbine Hall B.",
  "isCiaForgery": true,
  "stampType": "MINATOM_OFFICIAL",
  "inkColor": "SOVIET_CRIMSON",
  "authorizationCode": "CCCP-84-37-ДК",
  "watermark": "PROPERTY OF LANGLEY PRINTING OFFICE // 1984",
  "flawDescription": "1) American date format (11/02/1984 instead of 02.11.1984). 2) Odd sector digits (37) in authorizationCode. 3) Magnifying glass reveals CIA Langley watermark."
}
```
