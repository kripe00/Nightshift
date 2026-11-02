---
name: inspector-desk-mechanics
description: >-
  Ole's dedicated helper skill for building the Operator Desk, Pravda dot-matrix printer,
  draggable paper directives, circular magnifying glass lens, APPROVED/SHREDDED ink stamps,
  and Security Manual inside src/modules/inspector/. Use this skill whenever working on
  any feature inside src/modules/inspector/.
---

# Inspector Desk Mechanics — Ole's Domain Guide (`src/modules/inspector/`)

This skill guides all development for **Ole's domain**: the Operator Desk, Pravda Dot-Matrix Printer, Magnifying Glass inspection tool, `APPROVED` / `SHREDDED` rubber stamps, and the Security Manual.

---

## 1. Strict Domain Boundary Rule

- **ONLY** create, modify, or delete files inside `src/modules/inspector/`.
- **NEVER** modify files inside `src/modules/reactor/` or `src/modules/terminal/`.
- Communicate with the reactor and terminal modules **exclusively** through `src/shared/useGameStore.ts` and types in `src/shared/types.ts`.

---

## 2. Core Desk Components & Mechanics

### A. Draggable Tractor-Feed Paper Directives
- Render incoming directives as aged dot-matrix paper sheets (`#e8dfc8` background, perforated tractor-feed pin holes along the left and right margins, `font-courier` typography).
- Maintain `{ x, y, zIndex, rotation }` state per document on the desk surface.
- Use pointer events (`onPointerDown`, `onPointerMove`, `onPointerUp` with `setPointerCapture`) so the player can freely drag directives around the desk, bring the active sheet to the top of the z-stack, and place them side-by-side next to the **Security Manual**.

```tsx
const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
  e.currentTarget.setPointerCapture(e.pointerId)
  bringToFront(directive.id)
  setDragOffset({
    x: e.clientX - position.x,
    y: e.clientY - position.y,
  })
  setIsDragging(true)
}
```

### B. Circular Magnifying Glass Lens Overlay
- The Magnifying Glass is a toggleable or draggable tool on the desk that tracks cursor coordinates `(lensX, lensY)` relative to the desk container.
- Render a circular brass/Bakelite rim (`w-40 h-40 rounded-full border-4 border-[#3a2f20] shadow-2xl pointer-events-none`) with a glass reflection gradient.
- **Revealing Hidden Flaws & Watermarks:**
  - Inside each directive component, render a hidden inspection layer containing the micro-text `watermark`, ultraviolet verification glyphs, or forged ink bleeding.
  - Mask that hidden layer using CSS `clip-path: circle(80px at ${localX}px ${localY}px)` (where `localX` and `localY` are the magnifying glass coordinates relative to that document's bounding box).
  - When the lens hovers over a document, the hidden `watermark` (e.g. `"GLORY TO LABOR 1984"` vs. `"PROPERTY OF LANGLEY PRINTING OFFICE"`) becomes sharply visible inside the circular lens!

```tsx
<div
  className="pointer-events-none absolute inset-0 select-none"
  style={{
    clipPath: isMagnifierActive
      ? `circle(76px at ${lensLocalX}px ${lensLocalY}px)`
      : 'circle(0px at 0px 0px)',
  }}
>
  <div className="flex h-full w-full items-center justify-center">
    <span className="font-courier rotate-[-18deg] text-sm font-bold tracking-widest text-red-900/45 uppercase">
      {directive.watermark}
    </span>
  </div>
</div>
```

### C. Tactile `APPROVED` (Green) and `SHREDDED` (Red) Rubber Ink Stamps
- Provide two heavy physical rubber stamps on the desk:
  - **`APPROVED // ОДОБРЕНО`:** Soviet bureaucratic green (`#1b6e32`), double-bordered rectangular ink frame.
  - **`SHREDDED // УНИЧТОЖЕНО`:** Aggressive crimson (`#a81c1c`), diagonal warning bars with stenciled Cyrillic/English rejection mark.
- **Stamp Animation & Ink Texture:**
  - When the player stamps a directive, play a heavy down-up scale keyframe (`scale(1.8) -> scale(0.95) -> scale(1)` over `160ms`) with a slight random angle (`-8deg` to `+8deg`).
  - Use a distressed SVG mask or `mix-blend-multiply` with uneven opacity so the ink looks physically pressed onto tractor-feed paper.
  - After stamping `SHREDDED`, optionally animate the paper feeding downward into a mechanical strip-shredder slot at the edge of the desk.

### D. The Security Manual (Flip-Book Reference)
- A heavy leather/cardstock binder on the desk with tabs for:
  1. **Authorized Ministries & Headers**
  2. **Official Stamp Emblems & Valid Ink Colors**
  3. **1984 Authorization Cipher Rules** (e.g., even vs. odd sector codes, `DD.MM.1984` date rule)
  4. **Official Watermark Registry**
- Allows the operator to flip pages and cross-check every detail of a directive before stamping.

---

## 3. Notifying the Shared Store (`resolveDirective`)

Whenever a directive is stamped `APPROVED` or `SHREDDED`, immediately notify the cross-module Zustand store so Kristian's reactor and terminal modules can react to the decision:

```ts
import { useGameStore } from '../../shared/useGameStore'

// Inside stamp handler:
const handleStampDecision = (
  directiveId: string,
  decision: 'APPROVED' | 'SHREDDED'
) => {
  useGameStore.getState().resolveDirective(directiveId, decision)
}
```

> **Note:** If `resolveDirective` or the directive types are not yet defined in `src/shared/types.ts` and `src/shared/useGameStore.ts`, coordinate a minimal, additive type update in `src/shared/` or provide a safe fallback (`useGameStore.getState().resolveDirective?.(directiveId, decision)`).
