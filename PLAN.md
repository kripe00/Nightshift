# ☢️ MELTDOWN IS PROPAGANDA
**Undertittel:** *A Soviet Night Shift Simulator*  
**Anledning:** GitHub Game Off 2026 (1. nov – 1. des 2026)  
**Tema:** **SHIFT**  
**Utviklere:** Kristian (`Kristian`-branch) & Ole (`Ole`-branch)

---

## 1. Høykonsept & Tolkning av temaet «SHIFT»
Året er 1984 i et alternativt, retro-futuristisk Sovjetunionen (*Cassette Futurism / Atompunk*). Spilleren er alene på nattskiftet i kontrollrommet på **Folkets Automatiserte Atomkraftverk № 4**. 

Temaet **SHIFT** er flettet inn på tre nivåer:
1. **The Night Shift (Tid & Overlevelse):** Du må overleve 5 stadig mer kaotiske nattskift (kl. 00:00 til 06:00) uten at reaktoren smelter ned eller at du blir arrestert for forræderi.
2. **Power Shifting (Fysisk `SHIFT`-clutch):** Reaktoren produserer kun **100 MW** trygg strøm, men systemene krever **180 MW** på maks. Spilleren må holde inne den fysiske `SHIFT`-tasten på tastaturet (fungerer som en tung mekanisk clutch) for å omdirigere strøm mellom **Kjøling**, **Cyber-forsvar** og **Fasiliteter**. Å overklokke inn i *Redline* (101–180 MW) øker faren for sikringsbrudd og mørklegging.
3. **Reality Shifting (Propaganda vs. Virkelighet):** Den statlige AI-en **K.O.M.R.A.D.-84** nekter for at feil kan oppstå i Sovjetunionen og forsøker å "gasslighte" spilleren, samtidig som CIA sender inn forfalskede sabotasjeordre via matriseskriveren.

---

## 2. Skjerm-layout (Låst 16:9 Cockpit – `1600x900`)
Hele spillet foregår på én fast skjerm uten scrolling, delt inn i 4 diegetiske soner:

```text
+-----------------------------------+-----------------------------------+
| SONE 1: REAKTOR & KJØLING         | SONE 2: K.O.M.R.A.D.-84 TERMINAL  |
| (Kristian - src/modules/reactor)  | (Kristian - src/modules/terminal) |
| - Analoge SVG-målere (Temp/Trykk) | - Grønn CRT-skjerm med scanlines  |
| - Kjølepumper, ventiler & AZ-5    | - AI-propaganda & feilmeldinger   |
| - Geigerteller & varsellamper     | - CIA Cyber-angrep / Firewall     |
+-----------------------------------+-----------------------------------+
| SONE 3: POWER SHIFTING MATRIX     | SONE 4: INSPEKTØR-SKRIVEBORDET    |
| (Kristian - src/modules/reactor)  | (Ole - src/modules/inspector)     |
| - Krever at [SHIFT] holdes inne   | - "Pravda" Matriseskriver         |
| - Fordeler MW mellom:             | - Papirdirektiver som kan flyttes |
|   1. COOLING (Kjølepumper)        | - Sikkerhetsmanual (bla i sider)  |
|   2. DEFENSE (K.O.M.R.A.D./Mur)   | - Forstørrelsesglass (Lupe)       |
|   3. FACILITY (Lys, Printer, Luft)| - Stempler: [APPROVE] / [SHRED]   |
+-----------------------------------+-----------------------------------+
```

---

## 3. Ansvarsfordeling & Moduler (Null Merge-konflikter)

### 🛠️ Kristians Domene (`src/modules/reactor/` & `src/modules/terminal/`)

1. **Reaktor-fysikk & Game Loop (`tick`):**
   - Kjerne-temperatur (300°C normal -> 1000°C nedsmelting), trykk og stråling.
   - Håndtering av `SHIFT`-clutchen for å flytte strøm mellom systemene.
   - *Redline Overclocking:* Tillater mer enn 100 MW midlertidig, men bygger opp ustabilitet som kan slå ut strømmen (Blackout).

2. **K.O.M.R.A.D.-84 CRT-Terminal:**
   - Parodisk sovjetisk AI som skriver meldinger på en grønn fosforskjerm.
   - Finner på farlige "effektiviseringstiltak" (f.eks. skrur av kjølepumper for å spare strøm til Femårsplanen) som spilleren må overstyre.
   - Viser innkommende CIA-dataangrep som krever strøm på `DEFENSE` for å blokkeres.

3. **Prosedural Lyd (`Web Audio API`):**
   - Reaktor-during som endrer tonehøyde etter varme/MW, Geigerteller-klikk, tunge bryter-klakk og alarmer.

### 🔍 Oles Domene (`src/modules/inspector/`)

1. **Pravda Matriseskriver & Skrivebord:**
   - Skriver ut fysiske papirdirektiver som lander på skrivebordet.
   - Hvis `FACILITY`-strømmen er lav, går skriveren tregt og skrivebordslampen flimrer/slukkes.

2. **Sikkerhetsmanualen (Partiets Regelbok):**
   - En bok på pulten spilleren kan åpne og bla i. Inneholder gyldige stempler, autorisasjonskoder, departementsnavn og sikkerhetsregler for dagens skift.

3. **Forstørrelsesglasset (Lupe):**
   - Et verktøy spilleren drar over papirdirektivene. Avslører skjulte ledetråder som kun synes gjennom lupa: mikroskrift, UV-vannmerker, feil blekkfarge eller vestlige skrivefeil fra CIA.

4. **Stempler (`APPROVED` / `SHREDDED`):**
   - Spilleren stempler dokumentet grønt (`APPROVED`) eller sender det i makuleringsmaskinen (`SHREDDED`).
   - Sender resultatet til `useGameStore.resolveDirective(id, decision)`.

---

## 4. Konsekvens-matrise (Hvordan Oles pult påvirker Kristians reaktor)

| Dokumenttype | Spillerens valg | Konsekvens i spillet |
| --- | --- | --- |
| **Ekte Parti-ordre** | `APPROVED` (Riktig) | Ordren utføres trygt (f.eks. ekstra kjølevann eller stabilisert strøm). Partiet er fornøyd. |
| **Ekte Parti-ordre** | `SHREDDED` (Feil!) | **Mistanke om forræderi (+1 Strike).** K.O.M.R.A.D.-84 kjefter, og ved 3 strikes blir du sendt til Sibir (Game Over). |
| **Falsk CIA-sabotasje** | `SHREDDED` (Riktig) | Sabotasje avverget! Bonus til reaktor-stabilitet og skryt i terminalen. |
| **Falsk CIA-sabotasje** | `APPROVED` (Katastrofe!) | **Sabotasje utført!** Reaktortemperaturen spiker (+200°C), kjølepumper låses midlertidig, eller K.O.M.R.A.D.-84 blir hacket. |

---

## 5. Progresjon gjennom 5 Nattskift (Kampanjen)

Hvert skift varer i ca. 3–4 minutter (kl. 00:00–06:00 i spilltid):

* **Skift 1 (Opplæring):** Rolig reaktor. Sikkerhetsmanualen krever kun sjekk av **Riktig Departements-stempel** og **Dato (1984)**.
* **Skift 2 (Strømklemme):** Høyere grunnvarme – spilleren må bruke `SHIFT` aktivt. Manualen innfører **Autorisasjonskoder** (må sjekkes mot tabell i manualen).
* **Skift 3 (Lupe & Vannmerker):** CIA begynner å bruke perfekte stempler. Spilleren må bruke **Forstørrelsesglasset** for å sjekke **Vannmerker** og skjulte stavefeil i mikroskrift.
* **Skift 4 (K.O.M.R.A.D.-84 klikker):** AI-en begynner å tvangsstyre strømmen i *Power Matrix* for å nå produksjonsmål. Spilleren må balansere strømkutt i mørket mens dokumentene renner inn.
* **Skift 5 (Redline Finale):** Maksimal krise. Krever kontrollert overklokking i *Redline* (>100 MW), hyppige CIA-forfalskninger med falske signaturer og konstant kjøling frem til kl. 06:00.

---

## 6. Felles Datakontrakt (`src/shared/types.ts` & `useGameStore.ts`)

Når vi starter kodingen i Fase 1, skal modulene KUN kommunisere gjennom dette grensesnittet i Zustand:

```typescript
// PLANLAGT KONTRAKT (Kun dokumentasjon foreløpig)
export type SystemType = 'cooling' | 'defense' | 'facility';
export type DirectiveDecision = 'APPROVED' | 'SHREDDED';

export interface DirectiveDocument {
  id: string;
  title: string;
  ministry: string;
  date: string;
  authCode: string;
  bodyText: string;
  stampType: 'party_star' | 'ministry_atom' | 'kgb_shield' | 'forged_eagle';
  inkColor: 'red' | 'blue' | 'purple';
  watermarkText: string; // Kun synlig med lupe!
  isCiaForgery: boolean;
  flawReason?: string;   // Forklaring på hvorfor den var falsk (vises ved feil)
  effectOnApprove: {
    tempDelta: number;
    powerBonus?: number;
    sabotageSystem?: SystemType;
  };
}

export interface GameState {
  // Spillstatus
  shiftNumber: number;       // 1 til 5
  shiftTimeMinutes: number;  // 0 (00:00) til 360 (06:00)
  isShiftKeyHeld: boolean;   // Om fysisk SHIFT-clutch holdes inne
  isGodMode: boolean;        // Fra F2 Debug-meny (pauser nedsmelting for Ole)
  treasonStrikes: number;    // 0 til 3 (3 = Gulag Game Over)
  
  // Reaktor & Strøm (Kristian)
  coreTemp: number;          // 300°C til 1000°C
  maxSafePower: number;      // 100 MW (180 MW med Redline)
  powerAllocation: Record<SystemType, number>;
  isBlackout: boolean;
  
  // Terminal (Kristian)
  terminalLogs: string[];
  
  // Skrivebord & Direktiver (Ole)
  activeDirectives: DirectiveDocument[];
  
  // Felles Actions
  setShiftKeyHeld: (held: boolean) => void;
  shiftPower: (system: SystemType, deltaMW: number) => void;
  spawnDirective: (forceForgery?: boolean) => void;
  resolveDirective: (id: string, decision: DirectiveDecision) => void;
  tick: () => void;
}
```

---

## 7. Visuell Stil & Lyd-regler

* **Totalforbud mot moderne web-UI:** Ingen hvite kort, ingen avrundede SaaS-knapper, ingen standard HTML-slidere.
* **Fysiske spaker som må dras (Aldri kun klikk):** Alle spaker (inkludert `MainBreaker`, kjølepumpe-spaker og `SHIFT`-strømspaker) skal animeres langs sporet sitt og **må dras fysisk opp og ned med musen** (`pointerdown` + `pointermove` + `pointerup`) for å aktiveres – aldri bare klikkes på. Slippes spaken før terskelverdien, spretter den tilbake; dras den helt over, låses den med et tungt mekanisk klakk.
* **Materialer (CSS + Inline SVG):** Slitt sovjetisk industrigrønn (`#23312b`), bakelitt-svart (`#141414`), fosfor-grønn CRT (`#33ff66`), varsel-oransje (`#ffb000`), alarm-rød (`#ff2a2a`) og gulnet papir (`#e6dec3`).
* **Typografi:**
  * *Overskrifter / Metallskilt:* Sovjetisk display-font (*Kremlin* fra DaFont som lokal `.ttf` for faux-kyrillisk preg i logo og skilt, men lagret som vanlig latinsk tekst i DOM for søkbarhet).
  * *CRT-Terminal:* `VT323` eller `Share Tech Mono`.
  * *Skriver & Manual:* `Courier Prime` eller `DotGothic16`.

---

## 8. Utviklingsløp (4 Faser)

### Fase 1: Felles Grunnmur i `main` (Før vi splitter opp)

Gjøres sammen før Kristian og Ole går til hver sin branch:

1. `vite.config.ts` med `base: './'` (for itch.io iframe-støtte).
2. `ViewportScaler.tsx` (låser oppløsningen til `1600x900` med CSS scale).
3. `MainBreaker` oppstartsskjerm med en tung hovedstrømspak som må dras fysisk ned for å slå på kontrollrommet og låse opp nettleserens `AudioContext`.
4. `DebugMenu.tsx` på `F2`-tasten (lar Ole spawne dokumenter og skru på *God Mode* uten at reaktoren smelter, og lar Kristian teste kriser).
5. `types.ts`, `useGameStore.ts` og et 4-soners grid i `App.tsx`.

### Fase 2: Parallell «Graybox» på `Kristian`- og `Ole`-branchene

* **Kristian:** Bygger `tick()`-loop, `SHIFT`-strømfordeling, temperatur-fysikk og K.O.M.R.A.D.-84 meldingslogg.
* **Ole:** Bygger skrivebordet, papirlapper som kan klikkes/dras, Sikkerhetsmanual-visningen, lupe-effekten og `APPROVE`/`SHRED`-knapper.

### Fase 3: Sovjet-Polish, Prosedural Lyd & Innhold (Skift 1–5)

* Bytt ut gråbokser med SVG-målere, vippebrytere med sikkerhetslokk, ekte blekkstempler og CRT-scanlines.
* Koble på `web-audio-synth` for mekaniske lyder og reaktor-during.
* Skriv inn 30–40 unike direktiver (ekte og CIA-forfalskninger) og K.O.M.R.A.D.-84 sitater.

### Fase 4: Innspurt, Firebase Global Telemetri & itch.io-lansering

* **Firebase (Firestore – kun anonym telemetri til slutt):**
  * Ingen innloggingsmur! Bruk kun bakgrunnsteller for globale stats på slutt-/startskjermen (*"Totalt antall nedsmeltinger i USSR"*, *"Kamerater sendt til Sibir"*, *"CIA-agenter avslørt"*) + en valgfri arkade-highscoretavle.
* Bygg `.zip` med `npm run build` og last opp til itch.io + koble til GitHub Game Off 2026 før 1. desember.
