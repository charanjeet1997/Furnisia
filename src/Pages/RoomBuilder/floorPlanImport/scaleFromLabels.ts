import type { DetectedPlan, PxWall } from './detectWalls';

// A line of text read from the plan, with its box in plan-image pixels.
export interface TextLine {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ScaleEstimate {
  metersPerPixel: number;
  labelsUsed: number;
}

const FOOT = 0.3048;
const INCH = 0.0254;
const AXIS_AGREEMENT = 0.15; // width- and depth-based scales of one room must agree within 15%
const MEDIAN_AGREEMENT = 0.12; // labels further than this from the median are misreads
const MIN_ROOM_PX = 20;
const GAP_TOLERANCE_FACTOR = 3; // openings up to ~3 wall thicknesses either side of the ray

// Room size labels like 15'-0" X 12'-6", 10'-7½" x 15'-0" or 4.2 x 3.6 (meters).
// Tolerant of common OCR slips: ° or " instead of ', missing quote marks, and a ½ that OCR
// glues onto the inch digits as "12", "142", "1%", "%2", "¥2"… (see parseInches).
const FEET_INCHES = String.raw`(\d{1,2})\s*['°’"]?\s*-\s*([0-9%¥½/]{1,5})\s*["”']?`;
const IMPERIAL = new RegExp(`${FEET_INCHES}\\s*[xX×]+\\s*${FEET_INCHES}`);
const METRIC = /(\d{1,2}(?:\.\d{1,2}))\s*m?\s*[xX×]\s*(\d{1,2}(?:\.\d{1,2}))\s*m?/;

// What OCR makes of a "½" after the inch digit(s), as measured on rendered plans.
const HALF_READINGS = ['½', '1/2', '142', '12', '14', '15', '1%', '%2', '%', '¥2', '¥', '42', '45', '32', '2', '1'];

export function parseRoomSize(text: string): [number, number] | null {
  const imp = text.match(IMPERIAL);
  if (imp) {
    const [, f1, i1, f2, i2] = imp;
    const inches1 = parseInches(i1);
    const inches2 = parseInches(i2);
    if (inches1 === null || inches2 === null) return null;
    return [+f1 * FOOT + inches1 * INCH, +f2 * FOOT + inches2 * INCH];
  }
  const met = text.match(METRIC);
  if (met) return [+met[1], +met[2]];
  return null;
}

// "7" -> 7, "7½" -> 7.5, and OCR'd halves: "712" -> 7.5, "012" -> 0.5, "111" -> 11.5.
// Plain digits are taken as-is only when they make a valid inch value (< 12).
function parseInches(token: string): number | null {
  if (/^\d{1,2}$/.test(token) && +token < 12) return +token;
  for (const digits of [1, 2]) {
    const whole = token.slice(0, digits);
    const rest = token.slice(digits);
    if (!/^\d+$/.test(whole) || +whole >= 12) continue;
    if (HALF_READINGS.includes(rest)) return +whole + 0.5;
  }
  return null;
}

// Each label sits inside its room. Casting rays left/right/up/down to the nearest detected
// walls gives the room's size in pixels; the label gives it in meters. Labels are clear
// (inside-face) sizes, so half of each bounding wall's thickness is removed.
export function scaleFromLabels(lines: TextLine[], plan: DetectedPlan): ScaleEstimate | null {
  const vertical = plan.walls.filter((w) => Math.abs(w.x1 - w.x2) < 0.5);
  const horizontal = plan.walls.filter((w) => Math.abs(w.y1 - w.y2) < 0.5);
  // Outer walls are broken by windows, so a ray can slip through a gap. The outline has no
  // gaps; it marks the walls' OUTER face, so give it double thickness: subtracting "half" of
  // it then lands on the inner face, like a real wall's centre line minus half its thickness.
  const outlineWalls = outlineAsWalls(plan);
  const outlineVertical = outlineWalls.filter((w) => Math.abs(w.x1 - w.x2) < 0.5);
  const outlineHorizontal = outlineWalls.filter((w) => Math.abs(w.y1 - w.y2) < 0.5);
  const estimates: number[] = [];

  for (const line of lines) {
    const size = parseRoomSize(line.text);
    if (!size) continue;
    const cx = (line.x0 + line.x1) / 2;
    const cy = (line.y0 + line.y1) / 2;
    const gap = plan.wallThickness * GAP_TOLERANCE_FACTOR;
    const left = nearest(vertical, cx, cy, -1, true, gap) ?? nearest(outlineVertical, cx, cy, -1, true, 0);
    const right = nearest(vertical, cx, cy, 1, true, gap) ?? nearest(outlineVertical, cx, cy, 1, true, 0);
    const up = nearest(horizontal, cx, cy, -1, false, gap) ?? nearest(outlineHorizontal, cx, cy, -1, false, 0);
    const down = nearest(horizontal, cx, cy, 1, false, gap) ?? nearest(outlineHorizontal, cx, cy, 1, false, 0);
    if (!left || !right || !up || !down) continue;

    const widthPx = right.dist + left.dist - (left.wall.thickness + right.wall.thickness) / 2;
    const depthPx = down.dist + up.dist - (up.wall.thickness + down.wall.thickness) / 2;
    if (widthPx < MIN_ROOM_PX || depthPx < MIN_ROOM_PX) continue;

    // Plans don't agree on which number is the width, so try both and keep the one where
    // both axes give the same scale.
    const options = [
      [size[0] / widthPx, size[1] / depthPx],
      [size[1] / widthPx, size[0] / depthPx],
    ].map(([a, b]) => ({ scale: (a + b) / 2, spread: Math.abs(a - b) / ((a + b) / 2) }));
    const best = options.sort((p, q) => p.spread - q.spread)[0];
    if (best.spread <= AXIS_AGREEMENT) estimates.push(best.scale);
  }

  if (estimates.length === 0) return null;
  const median = [...estimates].sort((a, b) => a - b)[Math.floor(estimates.length / 2)];
  const agreeing = estimates.filter((s) => Math.abs(s - median) / median <= MEDIAN_AGREEMENT);
  // With several labels but no two agreeing, any single one is as likely wrong as right.
  if (estimates.length > 1 && agreeing.length < 2) return null;
  const mean = agreeing.reduce((s, v) => s + v, 0) / agreeing.length;
  return { metersPerPixel: mean, labelsUsed: agreeing.length };
}

function outlineAsWalls(plan: DetectedPlan): PxWall[] {
  return plan.outline.map((p, i) => {
    const q = plan.outline[(i + 1) % plan.outline.length];
    return { x1: p.x, y1: p.y, x2: q.x, y2: q.y, thickness: plan.wallThickness * 2 };
  });
}

// Nearest wall crossing the ray from (x, y) in direction `dir` (-1/+1) along x (`alongX`) or y.
// `gap` lets the ray count a wall it just misses: a door or window opening in a room's wall
// often sits right where the ray passes, and the wall still bounds the room.
function nearest(walls: PxWall[], x: number, y: number, dir: -1 | 1, alongX: boolean, gap: number): { wall: PxWall; dist: number } | null {
  let best: { wall: PxWall; dist: number } | null = null;
  for (const w of walls) {
    const [lo, hi] = alongX ? [Math.min(w.y1, w.y2), Math.max(w.y1, w.y2)] : [Math.min(w.x1, w.x2), Math.max(w.x1, w.x2)];
    const across = alongX ? y : x;
    if (across < lo - gap || across > hi + gap) continue;
    const dist = ((alongX ? w.x1 : w.y1) - (alongX ? x : y)) * dir;
    if (dist > 0 && (!best || dist < best.dist)) best = { wall: w, dist };
  }
  return best;
}
