# Furnisia

A browser-based **3D room furniture planner** built with React, TypeScript, and React Three Fiber. Design a room of almost any shape through a guided wizard or a Revit/IKEA-style floor plan editor, then furnish it in a real-time 3D scene — all directly in the browser.

---

## Features

- **Room Builder wizard** — A 4-step flow: pick a shape, adjust dimensions, add doors & windows, choose wall/floor style.
- **Six room shapes** — Rectangular, L-Shape, T-Shape, U-Shape, Cut, and Beveled, each an arbitrary closed polygon rather than a fixed rectangle.
- **Free-form floor plan editing** — Drag any wall (slides perpendicular, independent of every other wall) or any corner (moves freely, its two walls follow) directly on the plan. Drags are blocked from collapsing a wall or crossing another one.
- **Inline dimension editing** — Click a wall's length label to type an exact value, Revit-style, instead of dragging.
- **Feet / Metres toggle** — Switch the floor plan's displayed units at any time.
- **3D interactive scene** — Orbit, pan, and zoom around the room freely with mouse or touch.
- **Concave-aware wall & ceiling culling** — Walls and the ceiling fade out per-fragment (GPU shader) based on whether they actually stand between the camera and the orbit target, so L/T/U-shaped rooms cull correctly around their notches — not just simple rectangles.
- **Exact-fit polygon ceiling** — The ceiling is extruded from the same floor polygon as the room, flush with the walls' outer faces on every shape.
- **Furniture catalog** — Add pieces across six categories: Seating, Tables, Storage, Bedroom, Lighting, and Decor.
- **Move & Rotate** — Select any placed item to drag it with a translate gizmo or dial in its angle with a rotation slider.
- **Duplicate & Delete** — Copy a selected item or remove it via toolbar buttons or keyboard shortcuts.
- **Smart placement** — Newly added items hug the nearest wall at a free spot, avoiding overlaps and door clearance zones.
- **Doors & windows** — Placed per-edge with configurable style (panel/pane count, solid or glass), sized and positioned along the wall.
- **Light & dark mode** — Toggle in the top corner of every page; follows the OS preference by default and persists across visits.

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
│   ├── App.tsx                        # Router: / → Dashboard, /room-builder, /planner
│   ├── Pages/
│   │   ├── Dashboard.tsx              # Landing page — quick start, build a room, presets
│   │   ├── Planner.tsx                # 3D planner view
│   │   └── RoomBuilder/
│   │       ├── RoomBuilder.tsx        # 4-step wizard shell, owns the room draft state
│   │       ├── StepShape.tsx          # Step 1 — shape picker
│   │       ├── StepDimensions.tsx     # Step 2 — drag walls/corners or type exact lengths
│   │       ├── StepOpenings.tsx       # Step 3 — place doors & windows on an edge
│   │       ├── StepStyle.tsx          # Step 4 — wall/floor color
│   │       ├── FloorPlanPreview.tsx   # Shared top-down SVG plan (drag, dimension-edit, click-to-select)
│   │       └── ShapeIcon.tsx          # Outline icon per shape, used on Step 1's cards
│   ├── Components/
│   │   ├── Scene.tsx                  # R3F Canvas, lights, OrbitControls
│   │   ├── Room.tsx                   # 3D room geometry (walls, floor, ceiling, openings, baseboards)
│   │   ├── polygonGeometry.ts         # Per-edge data, polygon offset, point-in-polygon
│   │   ├── FurnitureModel.tsx         # GLTF loader, pivot correction, TransformControls
│   │   ├── OrbitControlsHandler.tsx   # Disables orbit while dragging furniture
│   │   ├── createClippedMaterial.ts   # Custom shader: per-fragment wall/ceiling fade
│   │   ├── createGlassMaterial.ts     # Semi-transparent glass for windows, same clip logic
│   │   ├── wallSegments.ts            # Splits wall spans around door/window openings
│   │   └── UI/
│   │       ├── Toolbar.tsx            # Move / Rotate / Duplicate / Delete controls
│   │       ├── CatalogPanel.tsx       # Sidebar furniture picker
│   │       ├── RotationSlider.tsx     # Angle input for rotate mode
│   │       ├── RoomCard.tsx           # Preset room card on dashboard
│   │       ├── MiniRoomIcon.tsx       # Room-card thumbnail, drawn from the preset's real polygon
│   │       └── ThemeToggle.tsx        # Light/dark mode switch, mounted once at the app root
│   ├── Data/
│   │   ├── RoomShape.ts               # Polygon data model + parametric generators for all 6 shapes
│   │   ├── OpeningStyles.ts           # Door/window style catalog (panels, panes, material)
│   │   └── FurnitureCatalog.ts        # Catalog items with model paths & footprint dimensions
│   └── store/
│       ├── plannerStore.ts   # Zustand store: room, placedItems, selection, gizmo mode
│       ├── findPlacement.ts  # Wall-hugging placement algorithm, generalized to any polygon
│       └── useTheme.ts       # Light/dark theme hook (localStorage-backed, OS default)
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

1. **Start from the Dashboard** — jump into a preset room with *Quick start*, pick an *Empty room* preset, or *Build a room* from scratch.
2. **Build a room** (4 steps):
   - **Shape** — pick Rectangular, L-Shape, T-Shape, U-Shape, Cut, or Beveled.
   - **Dimensions** — drag a wall to slide it, drag a corner to reshape freely, or click a dimension label and type an exact length. Toggle Feet/Metres on the plan.
   - **Openings** — click a wall to place a door or window, choose its style.
   - **Style** — pick wall color and floor finish, then *Design this room*.
3. **Add furniture** from the **Furniture** panel on the right side of the Planner.
4. **Select** an item in the 3D view by clicking on it.
5. **Move** it by dragging the translate gizmo arrows, or switch to **Rotate** mode and use the rotation slider.
6. **Duplicate** the selected item with *Make copy*, or **Delete** it with *Remove* (or press `Delete` / `Backspace`).
7. Press `Escape` to deselect. Click **Back** to return to the Dashboard.
8. Toggle **light/dark mode** any time with the switch in the top corner.

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

## How the Wall & Ceiling Culling Works

Each wall and the ceiling use a custom `MeshStandardMaterial` with a GLSL fragment shader injected via `onBeforeCompile`. Every frame, `useFrame` updates two uniforms per surface: the camera's and the orbit target's projection onto the surface's outward normal. A fragment is discarded only when the surface's plane actually **separates the camera from the orbit target** — camera on the outward side and the target on the inward side — rather than simply whenever the camera sees the surface's outer face.

That distinction matters for concave rooms: in an L/T/U shape, a notch wall's plane extends across the rest of the room, so testing the camera's side alone would cull a back wall you're directly looking at across the notch. Testing against the orbit target as well keeps culling correct from every angle, including around concave corners.

## How the Floor Plan Editor Works

`FloorPlanPreview.tsx` renders the room's polygon as an SVG, with an invisible fat hit-line over each wall and a small handle circle at each corner. A wall drag translates just that wall's two endpoints along its own outward normal (a rigid translation, so the wall itself can never rotate); a corner drag moves just that one vertex, so its two walls follow while every other wall stays put. Both are validated against a minimum wall length and a proper segment-intersection test, so a drag that would collapse a wall or fold the polygon into a self-intersecting shape is rejected. Clicking a dimension label opens a real HTML `<input>` positioned over it (computed from the SVG's screen bounding box, not embedded as an SVG `foreignObject`, for reliable cross-browser rendering) for typing an exact length.

---

## Room Shapes

| Shape | Description |
|---|---|
| Rectangular | A plain 4-wall room |
| L-Shape | Rectangle with one rectangular notch removed |
| T-Shape | A bar with a stem extending from one side |
| U-Shape | Two legs joined by a back bar, notch open on one side |
| Cut | Rectangle with one corner cut off at 45° |
| Beveled | Rectangle with all four corners cut off at 45° |

Every shape starts from a parametric generator (`Data/RoomShape.ts`) and can then be reshaped freely in Step 2 — walls and corners are dragged or typed independently of the shape's original parameters.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Delete` / `Backspace` | Remove selected item |
| `Escape` | Deselect current item |
| `Escape` (dimension edit box) | Cancel the edit without applying it |

---

## License

MIT
