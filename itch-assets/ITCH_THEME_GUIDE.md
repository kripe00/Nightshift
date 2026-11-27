# itch.io Branding, Theme & Setup Guide — *Meltdown is Propaganda*

> **Title Searchability Rule:** Always set the game title on itch.io in standard Latin characters: **`Meltdown is Propaganda`** (never Cyrillic in metadata/title).

---

## 1. Asset Files (`itch-assets/`)

| File | Exact Resolution | Purpose on itch.io | Source / Notes |
| :--- | :--- | :--- | :--- |
| [`cover.png`](./cover.png) | `630 x 500` px | **Cover image** (Sidebar / Storefront Grid) | 5:4 center-cropped from [`cover-hires.png`](./cover-hires.png) (`1200 x 896`) |
| [`banner.png`](./banner.png) | `960 x 250` px | **Header Banner** (Top of Game Page) | Center-band cropped from [`banner-hires.png`](./banner-hires.png) (`1376 x 768`) |
| [`background.png`](./background.png) | `1920 x 1080` px | **Page Background** (Full-screen Bunker Frame) | Dark center (~55%) keeps column clean behind text |

---

## 2. Exact itch.io **Edit Theme** Settings

Open your game page → **Edit theme** and enter these exact values:

| Setting | Value | Visual Purpose |
| :--- | :--- | :--- |
| **BG (Page Background)** | `#0b0f0d` | Deep Bakelite charcoal bunker void |
| **BG2 (Inner Page Background)** | `#151d19` | Dark Soviet steel inner column (matches console chassis) |
| **BG2 Opacity** *(if available)* | `94%` | Lets subtle steel border frame breathe without hurting contrast |
| **Text** | `#e6dec3` | Aged Pravda tractor-feed paper cream (high readability) |
| **Link / Accent** | `#33ff66` | K.O.M.R.A.D.-84 CRT phosphor green |
| **Button** | `#c92424` | Crimson `AZ-5` alarm red (Hover/Active accent: `#ff2a2a`) |
| **Button Text** | `#e6dec3` | Aged paper cream |
| **Header Font** | `Russo One` *(alt: `Oswald`)* | Heavy Soviet constructivist display headers |
| **Body Font** | `Share Tech Mono` *(alt: `Courier Prime`)* | Authentic terminal & typewriter monospace |

### Extended CSS / Accent Palette (for custom HTML descriptions or badges)
- **Bakelite Black:** `#141414`
- **Soviet Panel Green:** `#23332b` / `#364940`
- **Steel Border:** `#2d4237`
- **Deep CRT Screen:** `#061a0c`
- **CRT Phosphor Green:** `#33ff66`
- **Industrial Hazard Amber:** `#ffb000`
- **Crimson Alarm / Stamp Red:** `#ff2a2a`
- **Aged Tractor Paper:** `#e6dec3`

### Image Upload Settings in **Edit Theme**
- **Banner:** Upload `banner.png` (`960x250`). *(Tip: Disable/hide the duplicate default text title above the page if your theme supports it, since `banner.png` already displays `MELTDOWN IS PROPAGANDA` cleanly.)*
- **Background:** Upload `background.png` (`1920x1080`)
  - **Repeat:** `No repeat`
  - **Fixed background:** `On` (recommended so the reactor hardware stays anchored around the column)
  - **Align:** `Center` (Top/Center)
- **Cover image** *(under **Edit game** → Details)*: Upload `cover.png` (`630x500`).

---

## 3. WebGL / HTML5 Build Upload & Viewport Settings

When uploading your production bundle (`npm run build` → zip the contents of `dist/`):

- **Kind of project:** `HTML`
- **Embed options:** `Embed in page` *(or `Click to launch in fullscreen`)*
- **Viewport dimensions:** **`1280 x 720`** (16:9 widescreen)
- **Fullscreen button:** **Enabled** *(strongly recommended — 3D first-person Pointer Lock & `[WASD]` / `[SHIFT]` controls feel best in fullscreen!)*
- **Frame options:** Automatically start or click-to-play (`Click to launch` keeps audio/Pointer Lock happy across browsers).
- **Mobile friendly:** Unchecked (Desktop Keyboard + Mouse 3D control room).

---

## 4. Recommended Metadata & Tags

- **Title:** `Meltdown is Propaganda`
- **Classification:** `Games`
- **Genre:** `Simulation` *(or `Thriller`)*
- **Recommended Tags (10):**
  `3D`, `Simulation`, `First-Person`, `Thriller`, `Retro`, `Pixel Art`, `Chernobyl`, `Dark Humor`, `Management`, `Singleplayer`
  *(Event submission: also link to **GitHub Game Off 2026**, Theme: **SHIFT**.)*

---

## 5. Copy-Paste Pitch & Page Description

### Short Description / Tagline (EN)
> Survive 3 night shifts in a 3D 1984 Soviet nuclear bunker. Balance the core, outsmart the AI & foil sabotage.

### Kort beskrivelse / Tagline (NO)
> Overlev 3 nattskift i en 3D sovjetisk atombunker fra 1984. Styr reaktoren, gjennomskue K.O.M.R.A.D.-84 og stans sabotasjen.

### Full Game Page Description (EN — Copy-Paste)

```markdown
> *"Comrade Operator: Reports of a core thermal anomaly are bourgeois fabrication. Meltdown is propaganda. Do not touch the cooling valves. Glory to the Collective."*
> — **K.O.M.R.A.D.-84**, Automated Plant Supervisor

**Meltdown is Propaganda** (*A Soviet Night Shift Simulator*) is a **100% physical first-person 3D Soviet RBMK-1000 control-room thriller** built for **GitHub Game Off 2026** (Theme: **SHIFT**).

You are the lone night-shift operator locked inside **People's Automated Nuclear Plant No. 4 (Sector 84)**. Every analog dial, cast-iron valve wheel, Bakelite fader lever, CRT terminal, desk computer, radio tuner, and hinged **`AZ-5`** scram switch is a real tactile 3D object inside the bunker—with zero 2D HUD menus covering your screen.

### Operation Clear Sky (3-Shift Campaign & 4 Endings)
1. **Physics Doesn't Lie:** Balance coolant flow, drum separator pressure, control rods, Xenon-135 poisoning, a `3000 MWh` battery deck, and a `1000 MW` 50.0 Hz regional power grid across 6 Soviet substations.
2. **Ideological Gaslighting (`K.O.M.R.A.D.-84` & `POLIT-LINK 84`):** The plant AI denies that a Soviet reactor can fail—pressuring you to prioritize Duga-1 and KGB quotas over Pripyat while confronting you in live interrogation duels. Accumulate **6 Treason Strikes** and face liquidation to Siberia.
3. **Cyber Defense & Truth (`ISKRA-84` / `ZASHCHITA-84`):** Read Commissar Volkov's `P.O.S.T.-84` dispatches, fight off CIA packet intrusions in `ZASHCHITA-84` without accidentally killing real control-room hardware drivers, and archive classified Clear Sky logs before riding **`LIFT-84`** out at `06:00`.

### Controls
- **`WASD` / Arrow Keys + Mouse:** Walk & look around the 3D control hall (`SHIFT` to sprint)
- **`0`–`6`:** Quick-focus camera stations (`UNIT A`, `K.O.M.R.A.D.-84`, `UNIT B`, `Supervisor Desk`, `UNIT C`, `UNIT A-2`)
- **`E` / `ESC`:** Sit down at / stand up from the Shift Supervisor Desk (`WE-PAD 84` & `ISKRA-84`) or ride `LIFT-84` at `06:00`
- **Left Click + Drag / Scroll Wheel:** Crank valve wheels, pull Bakelite faders, click spent fuel channels, flip `AZ-5` (`Shift + Scroll` for `±1%` fine trim)

*Developed by Komrad Kristianov & Komrad Oleg.*
```
