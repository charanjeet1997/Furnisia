import type { InteriorWall, RoomVertex } from '../../../Data/RoomShape';
import { offsetPolygon } from '../../../Components/polygonGeometry';
import type { DetectedPlan, PxWall } from './detectWalls';

export interface ImportedRoom {
  vertices: RoomVertex[];
  edgeThicknesses: number[];
  interiorWalls: InteriorWall[];
}

const MIN_THICKNESS_M = 0.07;

// Converts a pixel-space detection into the room builder's data, in meters:
// image x -> room x, image y -> room z, centred on the origin like every built-in shape.
export function planToRoom(plan: DetectedPlan, metersPerPixel: number): ImportedRoom {
  const outerThickness = Math.max(plan.wallThickness * metersPerPixel, MIN_THICKNESS_M);
  const toM = (x: number, y: number): RoomVertex => ({ x: x * metersPerPixel, z: y * metersPerPixel });

  // The traced outline is the walls' OUTER face; the room polygon is the wall centre line.
  const outerFace = ensureClockwise(plan.outline.map((p) => toM(p.x, p.y)));
  const centreLine = offsetPolygon(outerFace, -outerThickness / 2);

  const xs = centreLine.map((v) => v.x);
  const zs = centreLine.map((v) => v.z);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const shift = (v: RoomVertex): RoomVertex => ({ x: round(v.x - cx), z: round(v.z - cz) });

  const vertices = centreLine.map(shift);
  const interiorWalls = plan.walls
    .filter((w) => !liesOnOutline(w, plan))
    .map((w) => ({
      id: crypto.randomUUID(),
      start: shift(toM(w.x1, w.y1)),
      end: shift(toM(w.x2, w.y2)),
      thickness: round(Math.max(w.thickness * metersPerPixel, MIN_THICKNESS_M)),
    }));

  return { vertices, edgeThicknesses: vertices.map(() => round(outerThickness)), interiorWalls };
}

// Outer walls are already represented by the room polygon; drop the detected copies so they
// aren't built twice. A wall is "on the outline" when it runs along an outline edge within
// about a wall thickness and mostly overlaps it.
function liesOnOutline(w: PxWall, plan: DetectedPlan): boolean {
  const tol = plan.wallThickness * 1.2;
  const horizontal = Math.abs(w.y1 - w.y2) < 0.5;
  const [a0, a1] = horizontal ? [Math.min(w.x1, w.x2), Math.max(w.x1, w.x2)] : [Math.min(w.y1, w.y2), Math.max(w.y1, w.y2)];
  const c = horizontal ? w.y1 : w.x1;
  const n = plan.outline.length;
  for (let i = 0; i < n; i++) {
    const p = plan.outline[i], q = plan.outline[(i + 1) % n];
    const edgeHorizontal = Math.abs(p.y - q.y) < 0.5;
    if (edgeHorizontal !== horizontal) continue;
    const ec = horizontal ? p.y : p.x;
    if (Math.abs(ec - c) > tol) continue;
    const [e0, e1] = horizontal ? [Math.min(p.x, q.x), Math.max(p.x, q.x)] : [Math.min(p.y, q.y), Math.max(p.y, q.y)];
    const overlap = Math.min(a1, e1) - Math.max(a0, e0);
    if (overlap > (a1 - a0) * 0.6) return true;
  }
  return false;
}

// Built-in shapes wind clockwise on screen (x right, z down); match that so outward normals
// (and therefore wall offsets) point the right way.
function ensureClockwise(poly: RoomVertex[]): RoomVertex[] {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    area += a.x * b.z - b.x * a.z;
  }
  return area >= 0 ? poly : [...poly].reverse();
}

const round = (v: number) => Math.round(v * 1000) / 1000;

// Parses a length typed by the user: "3.2", "3.2m", "320cm", "10'", "10'-7½\"", "10' 7.5\"".
// Returns meters, or null when it can't be read.
export function parseLength(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/½/g, '.5').replace(/¼/g, '.25').replace(/¾/g, '.75');
  if (!s) return null;
  const imperial = s.match(/^(\d+(?:\.\d+)?)\s*'\s*(?:-?\s*(\d+(?:\.\d+)?)\s*(?:"|''|in)?)?$/);
  if (imperial) return (parseFloat(imperial[1]) * 12 + (imperial[2] ? parseFloat(imperial[2]) : 0)) * 0.0254;
  const metric = s.match(/^(\d+(?:\.\d+)?)\s*(m|cm|mm)?$/);
  if (!metric) return null;
  const value = parseFloat(metric[1]);
  const unit = metric[2] ?? 'm';
  const meters = unit === 'cm' ? value / 100 : unit === 'mm' ? value / 1000 : value;
  return meters > 0 ? meters : null;
}
