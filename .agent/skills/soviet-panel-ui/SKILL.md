---
name: soviet-panel-ui
description: >-
  Enforces the 1984 Soviet "Cassette Futurism" and Atompunk control-panel hardware aesthetic.
  Use this skill whenever building or styling UI components, analog gauges, switches, buttons,
  Nixie/7-segment readouts, or CRT screens in Night Shift: Redline (Reactor No. 4).
---

# Soviet Panel UI — 1984 Industrial Hardware Aesthetic Guide

Every UI element in *Night Shift: Redline (Reactor No. 4)* must look and feel like physical 1984 Soviet nuclear control-room equipment inside **People's Automated Nuclear Plant No. 4**.

---

## 1. Strictly Banned vs. Required UI Patterns

### ❌ BANNED (Never Use)
- Modern SaaS web UI (floating cards, clean white/slate containers, glassmorphism, `backdrop-blur` cards).
- Soft drop shadows (`shadow-sm`, `shadow-md`) or modern rounded pills (`rounded-full`, `rounded-2xl`).
- Flat, borderless buttons or standard browser `<input type="range">` sliders without heavy industrial chrome.
- System sans-serif fonts (`Inter`, `Roboto`, `system-ui`) on any visible control surface.

### ✅ REQUIRED (Always Use)
- **Bolted Steel & Enamel Panels:** Weathered olive-drab (`#2b332a`), Soviet teal-grey (`#283838`), gunmetal (`#1b1e1f`), and oxidized steel frames with corner screw/rivet details and recessed bevels (`inset` box shadows).
- **Inline SVG Analog Gauges:** Dials with tick marks, redline danger zones (`>100 MW`), glass glare overlays, and jittering needles driven by spring/noise physics.
- **Heavy Bakelite Toggle Switches:** Tactile rotary knobs and heavy lever toggles with physical ON/OFF throws and indicator lamps.
- **Guarded Emergency Buttons:** Flip-up translucent red/yellow hazard plastic safety covers (`AZ-5` / Scram style) that must be flipped open before pressing the underlying button.
- **Phosphor-Green CRT Monitors:** Curved bezel frames, scanline overlays, subtle vignette, and glowing phosphor text (`#33ff66` / `#ffb000`).

---

## 2. Mandatory Typography Rules

`Kremlin` (from DaFont) is loaded locally via `@font-face` in `src/index.css`, while `VT323` and `Courier Prime` are loaded in `index.html`:

| Font Token / Class | Font Family | Mandatory Usage |
| :--- | :--- | :--- |
| `font-kremlin` | `Kremlin` | Propaganda headers, stenciled/engraved metal labels, switch plates, warning placards |
| `font-vt323` | `VT323` | K.O.M.R.A.D.-84 CRT terminal, digital counters, Nixie / 7-segment readouts |
| `font-courier` | `Courier Prime` | Pravda dot-matrix directives, Security Manual pages, rubber stamp text |

> **Important `Kremlin` Font Tip:** In `public/fonts/kremlin.ttf`, all characters render as Soviet block capitals, but **lowercase** `b, e, f, k, n, r, u, w` render the faux-Cyrillic glyphs (`Б, Э, Ф, К, И, Я, Ц, Щ`), while **uppercase** `B, E, F, K, N, R, U, W` render standard Latin block letters. Do NOT blindly apply CSS `uppercase` if you want the faux-Cyrillic glyphs to appear on `font-kremlin` headers!

---

## 3. Reusable CSS Surface & Texture Recipes

### Brushed Metal & Weathered Enamel Panel
```css
.soviet-panel {
  background-color: #262b28;
  background-image:
    radial-gradient(circle at 50% 20%, rgba(255, 255, 255, 0.05), transparent 70%),
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.015) 0px,
      rgba(255, 255, 255, 0.015) 1px,
      transparent 1px,
      transparent 3px
    );
  border: 3px solid #141715;
  box-shadow:
    inset 0 2px 3px rgba(255, 255, 255, 0.12),
    inset 0 -3px 6px rgba(0, 0, 0, 0.7),
    0 6px 14px rgba(0, 0, 0, 0.85);
}
```

### Engraved Bakelite Nameplate
```tsx
<div className="inline-block border-2 border-[#0e100f] bg-[#181a19] px-3 py-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]">
  <span className="font-kremlin text-xs tracking-widest text-[#d8d2c5] uppercase">
    COOLING LOOP A // ОХЛАЖДЕНИЕ
  </span>
</div>
```

### Phosphor CRT Screen with Scanlines
```css
.crt-screen {
  background-color: #051207;
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.38) 0px,
      rgba(0, 0, 0, 0.38) 1px,
      transparent 1px,
      transparent 3px
    ),
    radial-gradient(circle at center, rgba(51, 255, 102, 0.12) 0%, rgba(0, 0, 0, 0.85) 100%);
  color: #33ff66;
  text-shadow: 0 0 6px rgba(51, 255, 102, 0.65);
  border: 6px solid #1a1d1a;
  box-shadow:
    inset 0 0 24px rgba(0, 0, 0, 0.95),
    0 2px 0 rgba(255, 255, 255, 0.08);
}
```

---

## 4. Hardware Component Patterns

### A. Inline SVG Analog Gauge with Jittering Needle
- Render an inline `<svg viewBox="0 0 200 130">` with an arc scale from `-75deg` to `+75deg`.
- Draw tick marks every 5–10 units; highlight the **Redline zone (`>100 MW`)** in `#d93829`.
- Add continuous micro-jitter (`±0.6deg` sinusoidal/random offset, amplified to `±3.5deg` when total output exceeds `100 MW`) to the needle transform (`transform: rotate(${angle}deg)` with `transform-origin: 100px 110px`).
- Overlay a subtle SVG linear-gradient arc for curved glass reflection.

### B. Flip-Up Plastic Safety Cover Over Critical Red Button
- Maintain local state `const [coverOpen, setCoverOpen] = useState(false)`.
- When `coverOpen === false`, render a striped yellow/black hazard frame with a translucent red polycarbonate lid (`bg-red-700/65 border-2 border-red-400/50`) that blocks clicks on the inner button until flipped open.
- Clicking the cover toggles `coverOpen` with a sharp mechanical hinge transition (`origin-top -rotate-110`).
- Only when `coverOpen === true` is the deep recessed Bakelite red plunger button interactive.

### C. Heavy Bakelite Toggle Switch
- Build toggles as custom buttons (`role="switch"`, `aria-checked`) with a metallic bezel housing, a vertical slot, and a shaded lever Bat handle that shifts vertically between top (`ON`) and bottom (`OFF`) positions, accompanied by a jewel indicator lamp (amber `#ffb000`, red `#ff2a2a`, or green `#2bd95a`).

---

## 5. Verification Checklist Before Completing UI Work
1. Verify zero default browser inputs or unstyled flat buttons exist.
2. Confirm every label uses `font-kremlin`, every CRT/digital readout uses `font-vt323`, and every paper/manual element uses `font-courier`.
3. Check that all code stays strictly within the developer's assigned domain (`src/modules/reactor/`, `src/modules/terminal/`, or `src/modules/inspector/`).
