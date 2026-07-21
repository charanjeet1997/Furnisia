# Furnisia

A browser-based **3D room furniture planner** built with React, TypeScript, and React Three Fiber. Visualise, arrange, and rotate furniture inside a room built to your own dimensions — all in real time, directly in the browser.

---

## Features

- **Room configuration** — Choose from preset room sizes or enter custom width, length, and height (in metres).
- **3D interactive scene** — Orbit, pan, and zoom around the room freely with mouse or touch.
- **Smart wall culling** — Walls and the ceiling fade out per-fragment (GPU shader) when the camera moves behind them, keeping the interior always visible.
- **Furniture catalog** — Add pieces across six categories: Seating, Tables, Storage, Bedroom, Lighting, and Decor.
- **Move & Rotate** — Select any placed item to drag it with a translate gizmo or dial in its angle with a rotation slider.
- **Duplicate & Delete** — Copy a selected item or remove it via toolbar buttons or keyboard shortcuts.
- **Smart placement** — Newly added items are placed at a free spot near the wall, avoiding overlaps with existing furniture.
- **Door & windows** — Auto-generated on opposite walls, sized and hidden based on available room width.

---

## Tech Stack

| Library | Role |
|---|---|
| [React 19](https://react.dev) | UI framework |
| [Vite 8](https://vite.dev) | Build tool & dev server |
| [TypeScript](https://www.typescriptlang.org) | Type safety |
| [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) | React renderer for Three.js |
| [Three.js](https://threejs.org) | 3D engine |
| [@react-three/drei](https://github.com/pmndrs/drei) | TransformControls, OrbitControls, GLTF loader |
| [Zustand](https://zustand-demo.pmnd.rs) | Global planner state |
| [React Router v7](https://reactrouter.com) | Client-side routing |
| [react-icons](https://react-icons.github.io/react-icons) | Toolbar icons |
| [oxlint](https://oxc.rs/docs/guide/usage/linter) | Fast linting |

---

## Project Structure

```
furnisia/
├── public/
│   └── assets/GLB/          # GLTF/GLB furniture models
├── src/
│   ├── App.tsx              # Router: / → Dashboard, /planner → Planner
│   ├── Pages/
│   │   ├── Dashboard.tsx    # Landing page — room selection & custom dimensions
│   │   └── Planner.tsx      # 3D planner view
│   ├── Components/
│   │   ├── Scene.tsx                  # R3F Canvas, lights, OrbitControls
│   │   ├── Room.tsx                   # 3D room geometry (walls, floor, door, windows, baseboards)
│   │   ├── FurnitureModel.tsx         # GLTF loader, pivot correction, TransformControls
│   │   ├── OrbitControlsHandler.tsx   # Disables orbit while dragging furniture
│   │   ├── createClippedMaterial.ts   # Custom shader: per-fragment wall fade
│   │   ├── createGlassMaterial.ts     # Semi-transparent glass for windows
│   │   ├── wallSegments.ts            # Splits wall spans around door/window openings
│   │   └── UI/
│   │       ├── Toolbar.tsx            # Move / Rotate / Duplicate / Delete controls
│   │       ├── CatalogPanel.tsx       # Sidebar furniture picker
│   │       ├── RotationSlider.tsx     # Angle input for rotate mode
│   │       └── RoomCard.tsx           # Preset room card on dashboard
│   ├── Data/
│   │   ├── FurnitureCatalog.ts  # Catalog items with model paths & footprint dimensions
│   │   └── RoomPresets.ts       # Built-in room presets + default room definition
│   └── store/
│       ├── plannerStore.ts   # Zustand store: room, placedItems, selection, gizmo mode
│       └── findPlacement.ts  # Greedy wall-adjacent placement algorithm
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18 or later
- npm 9 or later (bundled with Node)

### Install

```bash
git clone https://github.com/your-username/furnisia.git
cd furnisia
npm install
```

### Run (development)

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Lint

```bash
npm run lint
```

### Build

```bash
npm run build
```

The production bundle is output to `dist/`.

---

## Usage

1. **Pick a room** on the Dashboard — select a preset or enter custom dimensions and click **Build room**.
2. **Add furniture** from the **Furniture** panel on the right side of the Planner.
3. **Select** an item in the 3D view by clicking on it.
4. **Move** it by dragging the translate gizmo arrows, or switch to **Rotate** mode and use the rotation slider.
5. **Duplicate** the selected item with *Make copy*, or **Delete** it with *Remove* (or press `Delete` / `Backspace`).
6. Press `Escape` to deselect. Click **Back** to return to the Dashboard.

---

## Furniture Catalog

| Item | Category |
|---|---|
| Sofa | Seating |
| Coffee Table | Tables |
| Shelf | Storage |
| Bed | Bedroom |
| Floor Lamp | Lighting |
| Plant | Decor |

> 3D models are sourced from the [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) (CC0 1.0 Public Domain).

---

## How the Wall Culling Works

Each wall uses a custom `MeshStandardMaterial` with a GLSL fragment shader injected via `onBeforeCompile`. A `cameraAxisValue` uniform is updated every frame from `useFrame`. If the camera crosses to the outside of a wall, the fragment is discarded — producing a smooth, per-pixel fade rather than toggling whole meshes on/off in JavaScript. The ceiling uses the same technique on the Y axis.

---

## Room Presets

| Name | Width | Length | Height |
|---|---|---|---|
| Neutral Standard | 4.5 m | 5.1 m | 2.5 m |
| Open Spacious | 6.5 m | 6.8 m | 2.7 m |
| Bright Spacious | 4.8 m | 5.4 m | 2.6 m |
| Cozy Contemporary | 3.8 m | 4.7 m | 2.4 m |

Custom rooms accept any width and length from **2 m to 15 m** in 0.1 m steps, with a fixed height of 2.5 m.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Delete` / `Backspace` | Remove selected item |
| `Escape` | Deselect current item |

---

## License

MIT
