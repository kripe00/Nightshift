---
name: komrad-inspector-desk-mechanics
description: >-
  Ole's dedicated helper skill for building the 100% 3D <InspectorDesk3D /> station inside
  src/modules/inspector/: 3D operator desk, 3D Pravda dot-matrix printer, 3D tractor-feed paper
  meshes with CanvasTexture, 3D KGB Security Manual '84, 3D UV magnifying glass lens, and animated
  3D APPROVED/SHREDDED rubber stamps. Use this skill whenever working inside src/modules/inspector/.
---

# Inspector Desk 3D Mechanics — Ole's Domain Guide (`src/modules/inspector/`)

This skill guides all development for **Ole's domain**: exporting `<InspectorDesk3D />` from `src/modules/inspector/` as a **100% real 3D station** (zero R3F `<Html>` overlays or flat 2D DOM panels).

---

## 1. Strict Domain Boundary Rule

- **ONLY** create, modify, or delete files inside `src/modules/inspector/` (and static assets inside `public/sprites/desk_hardware/`).
- **NEVER** modify files inside `src/modules/reactor/` or `src/modules/terminal/`.
- Communicate with the reactor, terminal, and 3D bunker lighting **exclusively** through `src/shared/useGameStore.ts` and types in `src/shared/types.ts`.

---

## 2. Core 3D Desk Components in `<InspectorDesk3D />`

### A. 3D Pravda Dot-Matrix Printer & 3D Tractor-Feed Paper Meshes (`#e6dec3`)
- Directives feed physically out of the 3D Pravda printer slot as 3D paper plane/box meshes (`#e6dec3`) that rest on the 3D wooden desk surface.
- Render each directive's text (`ministry`, `date`, `title`, `bodyText`, `authCode`, official stamp emblem, and ink color) onto a low-resolution `THREE.CanvasTexture` (`THREE.NearestFilter`) using the `'Courier Prime'` font.
- Allow the player to grab and slide 3D paper meshes across the desk plane via 3D raycast pointer events (`onPointerDown`, `onPointerMove`, `onPointerUp`).

### B. Physical 3D UV Magnifying Glass & Hidden Watermarks
- A 3D brass-and-Bakelite magnifying glass mesh resting on the desk that the player can pick up and move across the 3D space above the paper directives.
- Casts a subtle `#8855ff` / `#33ff66` UV `<pointLight>` onto the desk surface (allowing inspection even when `FACILITY` power is `0 MW` and the overhead tungsten desk lamp is off).
- When the 3D UV magnifying glass hovers over a 3D paper directive mesh, reveal the hidden CIA watermark (`watermarkText`, e.g., `"PROPERTY OF LANGLEY PRINTING OFFICE"` vs. `"GLORY TO LABOR 1984"`) on the paper's `CanvasTexture` or 3D lens shader!

### C. Physical 3D Rubber Ink Stamps (`[APPROVE]` & `[SHRED]`)
- Two physical 3D wooden/Bakelite rubber stamp meshes on the desk:
  - **`APPROVE // ОДОБРЕНО`:** Green ink pad/base (`#1b6e32`).
  - **`SHRED // УНИЧТОЖЕНО`:** Crimson ink base (`#ff2a2a`).
- When the player triggers `[APPROVE]` or `[SHRED]` on the active 3D directive, physically animate the 3D stamp mesh plunging down onto the 3D paper (`useFrame`), stamp the ink mark onto the document's `CanvasTexture`, and call `useGameStore.getState().resolveDirective(directiveId, decision)` as the paper either slides into the archive tray or feeds down into the 3D shredder slot.

### D. 3D KGB Security Manual '84
- A physical 3D leather-bound manual mesh on the left side of the desk that can be clicked to open and flip pages (`CanvasTexture` in `'Courier Prime'` and `'Kremlin'`), listing valid 1984 rules:
  1. **Date Format:** `DD.MM.1984` (never American `MM/DD/1984` or expired `1983`).
  2. **Authorization Code:** `CCCP-84-[EVEN_NUMBER]` (odd sector numbers are CIA forgeries).
  3. **Ink Colors:** `SOVIET_CRIMSON`, `BUREAU_VIOLET`, `FADED_BLACK` (`IMPERIALIST_BLUE` is banned).
  4. **UV Watermark:** `"GLORY TO LABOR 1984 // СЛАВА ТРУДУ"`.

---

## 3. Exporting `<InspectorDesk3D />`
Export `InspectorDesk3D` from `src/modules/inspector/index.ts`:
```ts
export { InspectorDesk3D } from './InspectorDesk3D'
```
`src/shared/ControlRoomScene.tsx` automatically detects `InspectorDesk3D` from `src/modules/inspector` and mounts it at the Right Desk position in the 3D bunker.
