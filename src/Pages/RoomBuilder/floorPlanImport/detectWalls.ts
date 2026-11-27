// Detects walls in a raster floor plan without any AI service. The idea: walls are the
// thick, long, straight strokes of one colour; text, door arcs, dimension lines and hatching
// are thin, and furniture is short and blob-like. The user taps one wall so we know its colour.

export interface PxPoint {
  x: number;
  y: number;
}

export interface PxWall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number; // pixels
}

export interface DetectedPlan {
  width: number;
  height: number;
  wallThickness: number; // pixels, measured at the tapped wall
  walls: PxWall[]; // centre lines, axis-aligned
  outline: PxPoint[]; // outer edge of the building, clockwise in image space
}

interface Raster {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA
}

// --- tuning (all relative to the measured wall thickness, so they scale with resolution)
const HAIRLINE_FACTOR = 0.15; // opening radius: erases lines thinner than ~30% of a wall
const MIN_RUN_FACTOR = 1.8; // shortest straight run that can be a wall
const MAX_BAND_FACTOR = 1.8; // a wall band can't be much thicker than the tapped wall
const MIN_ASPECT = 3; // walls are long and narrow
const PEEL_FULL_ROW_SHARE = 0.6; // rows at least this share of the longest row belong to the wall
const ISOLATED_MIN_FACTOR = 2.5; // shorter pieces must connect to another wall
const SAME_LINE_FACTOR = 0.5; // centre lines this close are one wall
const SMALL_BREAK_FACTOR = 1.2; // gaps this small are drawing breaks, not doors
const CORNER_REACH_FACTOR = 1.5; // wall ends this close to a perpendicular wall get joined
const OUTLINE_SIMPLIFY_FACTOR = 0.6;

// Colour tolerances in Lab space (perceptual): walls may render darker at the edges but
// never lighter, and stay close in hue/chroma.
const LIGHTER_TOLERANCE = 10;
const DARKER_TOLERANCE = 35;
const CHROMA_TOLERANCE = 12;
const BACKGROUND_MIN_L = 94;
const BACKGROUND_MAX_CHROMA = 6;

// Without `tap` the wall colour is found automatically; `tap` (a click on a wall) is the
// manual fallback for plans where that fails.
export function detectWalls(raster: Raster, tap?: PxPoint): DetectedPlan | null {
  const { width: W, height: H } = raster;
  const lab = toLab(raster);

  let mask: Uint8Array;
  let thick: number;
  if (tap) {
    const x = Math.round(tap.x), y = Math.round(tap.y);
    mask = colourMask(lab, W * H, sampleLab(lab, W, H, x, y));
    thick = measureThickness(mask, W, H, x, y);
  } else {
    const found = findWallColour(lab, W, H);
    if (!found) return null;
    ({ mask, thick } = found);
  }
  if (thick < 2) return null; // not a wall

  const r = Math.max(1, Math.floor(thick * HAIRLINE_FACTOR));
  const opened = dilate(erode(mask, W, H, r), W, H, r);

  const minRun = Math.round(thick * MIN_RUN_FACTOR);
  const horizontal = bandsToLines(components(longRuns(opened, W, H, minRun, true), W, H), W, thick, minRun, true);
  const vertical = bandsToLines(components(longRuns(opened, W, H, minRun, false), W, H), W, thick, minRun, false);

  const walls = cleanUp(horizontal, vertical, thick);
  const outline = traceOutline(lab, W, H, thick);

  return { width: W, height: H, wallThickness: thick, walls, outline };
}

// ---------------------------------------------------------------- colour

function toLab(raster: Raster): Float32Array {
  const { data, width, height } = raster;
  const out = new Float32Array(width * height * 3);
  const lin = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    lin[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  for (let p = 0; p < width * height; p++) {
    const R = lin[data[p * 4]], G = lin[data[p * 4 + 1]], B = lin[data[p * 4 + 2]];
    const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
    const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
    const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
    out[p * 3] = 116 * y - 16;
    out[p * 3 + 1] = 500 * (x - y);
    out[p * 3 + 2] = 200 * (y - z);
  }
  return out;
}

// Averages a 5x5 patch so one noisy pixel (texture, JPEG artefact) doesn't set the colour.
function sampleLab(lab: Float32Array, W: number, H: number, x: number, y: number): [number, number, number] {
  const sum = [0, 0, 0];
  let n = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const p = (yy * W + xx) * 3;
      sum[0] += lab[p]; sum[1] += lab[p + 1]; sum[2] += lab[p + 2];
      n++;
    }
  }
  return [sum[0] / n, sum[1] / n, sum[2] / n];
}

function colourMask(lab: Float32Array, n: number, ref: readonly number[]): Uint8Array {
  const mask = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const dL = lab[p * 3] - ref[0];
    const dC = Math.hypot(lab[p * 3 + 1] - ref[1], lab[p * 3 + 2] - ref[2]);
    if (dL < LIGHTER_TOLERANCE && dL > -DARKER_TOLERANCE && dC < CHROMA_TOLERANCE) mask[p] = 1;
  }
  return mask;
}

// --- automatic wall colour
const CANDIDATE_COLOURS = 10;
const MIN_CANDIDATE_SHARE = 0.003; // a colour must cover at least 0.3% of the image
const LONG_RUN_SHARE = 0.05; // "long" = 5% of the image's short side
const THIN_RUN_SHARE = 0.035; // "thin" = under 3.5% of the image's short side
const THICKNESS_PERCENTILE = 0.75; // outer walls are the thick end of the wall population

// Tries the most common colours and keeps the one that looks most like walls: pixels that sit
// on a long run along one axis and a thin run along the other. Floors are wide in both
// directions, furniture and text are short in both, so walls win.
function findWallColour(lab: Float32Array, W: number, H: number): { mask: Uint8Array; thick: number } | null {
  const n = W * H;
  const bins = new Map<number, { count: number; L: number; a: number; b: number }>();
  for (let p = 0; p < n; p++) {
    const L = lab[p * 3], a = lab[p * 3 + 1], b = lab[p * 3 + 2];
    if (L > BACKGROUND_MIN_L) continue;
    const key = Math.floor(L / 8) * 10000 + Math.floor((a + 128) / 10) * 100 + Math.floor((b + 128) / 10);
    const bin = bins.get(key) ?? { count: 0, L: 0, a: 0, b: 0 };
    bin.count++; bin.L += L; bin.a += a; bin.b += b;
    bins.set(key, bin);
  }
  const candidates = [...bins.values()]
    .filter((bin) => bin.count >= n * MIN_CANDIDATE_SHARE)
    .sort((p, q) => q.count - p.count)
    .slice(0, CANDIDATE_COLOURS)
    .map((bin) => [bin.L / bin.count, bin.a / bin.count, bin.b / bin.count]);

  const short = Math.min(W, H);
  const longRun = Math.round(short * LONG_RUN_SHARE);
  const thinRun = Math.round(short * THIN_RUN_SHARE);
  let best: { mask: Uint8Array; thick: number; score: number } | null = null;
  for (const ref of candidates) {
    const mask = colourMask(lab, n, ref);
    const hRun = runLengths(mask, W, H, true);
    const vRun = runLengths(mask, W, H, false);
    const thinSamples: number[] = [];
    let wallLike = 0, total = 0;
    for (let p = 0; p < n; p++) {
      if (!mask[p]) continue;
      total++;
      if (hRun[p] >= longRun && vRun[p] <= thinRun) { wallLike++; thinSamples.push(vRun[p]); }
      else if (vRun[p] >= longRun && hRun[p] <= thinRun) { wallLike++; thinSamples.push(hRun[p]); }
    }
    // Share matters more than amount: textured floors also leave many thin streaks, but only
    // a small fraction of their pixels; nearly all of a wall colour's pixels are wall-shaped.
    const score = total ? wallLike * (wallLike / total) : 0;
    if (!best || score > best.score) {
      thinSamples.sort((p, q) => p - q);
      const thick = thinSamples[Math.floor(thinSamples.length * THICKNESS_PERCENTILE)] ?? 0;
      best = { mask, thick, score };
    }
  }
  return best && best.score > 0 ? { mask: best.mask, thick: best.thick } : null;
}

// For every mask pixel, the length of the run it belongs to along one axis.
function runLengths(mask: Uint8Array, W: number, H: number, horizontal: boolean): Uint16Array {
  const out = new Uint16Array(W * H);
  const lines = horizontal ? H : W;
  const len = horizontal ? W : H;
  const at = (line: number, i: number) => (horizontal ? line * W + i : i * W + line);
  for (let line = 0; line < lines; line++) {
    let start = -1;
    for (let i = 0; i <= len; i++) {
      const on = i < len && mask[at(line, i)] === 1;
      if (on && start < 0) start = i;
      if (!on && start >= 0) {
        for (let k = start; k < i; k++) out[at(line, k)] = i - start;
        start = -1;
      }
    }
  }
  return out;
}

function measureThickness(mask: Uint8Array, W: number, H: number, x: number, y: number): number {
  const run = (dx: number, dy: number) => {
    let n = 0, cx = x, cy = y;
    while (cx >= 0 && cy >= 0 && cx < W && cy < H && mask[cy * W + cx]) { cx += dx; cy += dy; n++; }
    return n;
  };
  return Math.min(run(1, 0) + run(-1, 0), run(0, 1) + run(0, -1)) - 1;
}

// ---------------------------------------------------------------- morphology

// Separable square min (erode) / max (dilate) filter. Pixels outside the image count as empty.
function filter(src: Uint8Array, W: number, H: number, r: number, isMax: boolean): Uint8Array {
  const identity = isMax ? 0 : 1; // value that can still change; stop early once it flips
  const pass = (from: Uint8Array, horizontal: boolean) => {
    const to = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let v = identity;
        for (let k = -r; k <= r && v === identity; k++) {
          const xx = horizontal ? x + k : x, yy = horizontal ? y : y + k;
          const s = xx < 0 || yy < 0 || xx >= W || yy >= H ? 0 : from[yy * W + xx];
          v = isMax ? v | s : v & s;
        }
        to[y * W + x] = v;
      }
    }
    return to;
  };
  return pass(pass(src, true), false);
}
const erode = (m: Uint8Array, W: number, H: number, r: number) => filter(m, W, H, r, false);
const dilate = (m: Uint8Array, W: number, H: number, r: number) => filter(m, W, H, r, true);

// ---------------------------------------------------------------- segments

// Keeps only pixels that belong to a straight run of at least `minRun` along one axis.
function longRuns(src: Uint8Array, W: number, H: number, minRun: number, horizontal: boolean): Uint8Array {
  const out = new Uint8Array(W * H);
  const lines = horizontal ? H : W;
  const len = horizontal ? W : H;
  const at = (line: number, i: number) => (horizontal ? line * W + i : i * W + line);
  for (let line = 0; line < lines; line++) {
    let start = -1;
    for (let i = 0; i <= len; i++) {
      const on = i < len && src[at(line, i)] === 1;
      if (on && start < 0) start = i;
      if (!on && start >= 0) {
        if (i - start >= minRun) for (let k = start; k < i; k++) out[at(line, k)] = 1;
        start = -1;
      }
    }
  }
  return out;
}

interface Box { minX: number; minY: number; maxX: number; maxY: number; pixels: number[] }

function components(src: Uint8Array, W: number, H: number): Box[] {
  const seen = new Uint8Array(W * H);
  const boxes: Box[] = [];
  const stack: number[] = [];
  for (let p = 0; p < W * H; p++) {
    if (!src[p] || seen[p]) continue;
    const box: Box = { minX: W, minY: H, maxX: 0, maxY: 0, pixels: [] };
    seen[p] = 1;
    stack.push(p);
    while (stack.length) {
      const q = stack.pop()!;
      const x = q % W, y = (q / W) | 0;
      box.pixels.push(q);
      if (x < box.minX) box.minX = x;
      if (x > box.maxX) box.maxX = x;
      if (y < box.minY) box.minY = y;
      if (y > box.maxY) box.maxY = y;
      if (x > 0 && src[q - 1] && !seen[q - 1]) { seen[q - 1] = 1; stack.push(q - 1); }
      if (x < W - 1 && src[q + 1] && !seen[q + 1]) { seen[q + 1] = 1; stack.push(q + 1); }
      if (y > 0 && src[q - W] && !seen[q - W]) { seen[q - W] = 1; stack.push(q - W); }
      if (y < H - 1 && src[q + W] && !seen[q + W]) { seen[q + W] = 1; stack.push(q + W); }
    }
    boxes.push(box);
  }
  return boxes;
}

// A line on one axis: `c` is its fixed coordinate, `a..b` its extent along the axis.
interface AxisLine { a: number; b: number; c: number; t: number }

function bandsToLines(boxes: Box[], W: number, thick: number, minRun: number, horizontal: boolean): AxisLine[] {
  const lines: AxisLine[] = [];
  for (const box of boxes) {
    const along = horizontal ? box.maxX - box.minX + 1 : box.maxY - box.minY + 1;
    const across = horizontal ? box.maxY - box.minY + 1 : box.maxX - box.minX + 1;
    if (along < minRun) continue;
    const line = across <= thick * MAX_BAND_FACTOR
      ? (horizontal
        ? { a: box.minX, b: box.maxX, c: (box.minY + box.maxY) / 2, t: across }
        : { a: box.minY, b: box.maxY, c: (box.minX + box.maxX) / 2, t: across })
      : peelWall(box, W, thick, minRun, horizontal);
    if (line && (line.b - line.a + 1) / line.t >= MIN_ASPECT) lines.push(line);
  }
  return lines;
}

// A band too thick to be a wall is usually a wall with wall-coloured furniture against it.
// The wall's rows (columns, for vertical walls) run nearly the band's full length; the
// furniture's are shorter. Keep the longest contiguous stack of near-full-length rows.
function peelWall(box: Box, W: number, thick: number, minRun: number, horizontal: boolean): AxisLine | null {
  const lo = horizontal ? box.minY : box.minX;
  const counts = new Array<number>((horizontal ? box.maxY : box.maxX) - lo + 1).fill(0);
  for (const p of box.pixels) counts[(horizontal ? (p / W) | 0 : p % W) - lo]++;
  const full = Math.max(...counts) * PEEL_FULL_ROW_SHARE;
  let bestStart = -1, bestLen = 0;
  for (let i = 0, start = -1; i <= counts.length; i++) {
    const on = i < counts.length && counts[i] >= full;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      if (i - start > bestLen) { bestLen = i - start; bestStart = start; }
      start = -1;
    }
  }
  if (bestLen === 0 || bestLen > thick * MAX_BAND_FACTOR) return null;
  let a = Infinity, b = -Infinity;
  for (const p of box.pixels) {
    const k = (horizontal ? (p / W) | 0 : p % W) - lo;
    if (k < bestStart || k >= bestStart + bestLen) continue;
    const along = horizontal ? p % W : (p / W) | 0;
    if (along < a) a = along;
    if (along > b) b = along;
  }
  if (b - a + 1 < minRun) return null;
  return { a, b, c: lo + bestStart + (bestLen - 1) / 2, t: bestLen };
}

// ---------------------------------------------------------------- cleanup

function cleanUp(horizontal: AxisLine[], vertical: AxisLine[], thick: number): PxWall[] {
  snapToSharedLines(horizontal, thick);
  snapToSharedLines(vertical, thick);
  let hs = mergeCollinear(horizontal, thick);
  let vs = mergeCollinear(vertical, thick);
  closeCorners(hs, vs, thick);
  closeCorners(vs, hs, thick);
  hs = hs.filter((s) => s.b - s.a >= thick * ISOLATED_MIN_FACTOR || touchesAny(s, vs, thick));
  vs = vs.filter((s) => s.b - s.a >= thick * ISOLATED_MIN_FACTOR || touchesAny(s, hs, thick));
  return [
    ...hs.filter((s) => s.b - s.a >= thick).map((s) => ({ x1: s.a, y1: s.c, x2: s.b, y2: s.c, thickness: s.t })),
    ...vs.filter((s) => s.b - s.a >= thick).map((s) => ({ x1: s.c, y1: s.a, x2: s.c, y2: s.b, thickness: s.t })),
  ];
}

// Pieces of the same physical wall get slightly different centre lines; average them.
function snapToSharedLines(lines: AxisLine[], thick: number) {
  const sorted = [...lines].sort((p, q) => p.c - q.c);
  let group: AxisLine[] = [];
  const flush = () => {
    const avg = group.reduce((s, g) => s + g.c, 0) / group.length;
    for (const g of group) g.c = avg;
    group = [];
  };
  for (const line of sorted) {
    if (group.length && line.c - group[group.length - 1].c > thick * SAME_LINE_FACTOR) flush();
    group.push(line);
  }
  if (group.length) flush();
}

function mergeCollinear(lines: AxisLine[], thick: number): AxisLine[] {
  const sorted = [...lines].sort((p, q) => p.c - q.c || p.a - q.a);
  const out: AxisLine[] = [];
  for (const line of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.c - line.c) < 0.5 && line.a - last.b <= thick * SMALL_BREAK_FACTOR) {
      last.b = Math.max(last.b, line.b);
      last.t = Math.max(last.t, line.t);
    } else {
      out.push({ ...line });
    }
  }
  return out;
}

// Extends a wall end onto a perpendicular wall it almost reaches, so corners close.
function closeCorners(lines: AxisLine[], perpendicular: AxisLine[], thick: number) {
  const reach = thick * CORNER_REACH_FACTOR;
  for (const line of lines) {
    for (const end of ['a', 'b'] as const) {
      let best: { d: number; c: number } | null = null;
      for (const p of perpendicular) {
        if (line.c < p.a - thick || line.c > p.b + thick) continue;
        const d = Math.abs(p.c - line[end]);
        if (d <= reach && (!best || d < best.d)) best = { d, c: p.c };
      }
      if (best) line[end] = best.c;
    }
  }
}

// Isolated short pieces are furniture (chair backs, sofa arms) in the wall colour.
function touchesAny(line: AxisLine, perpendicular: AxisLine[], thick: number): boolean {
  return (['a', 'b'] as const).some((end) =>
    perpendicular.some((p) => Math.abs(p.c - line[end]) <= 2 && line.c >= p.a - thick && line.c <= p.b + thick),
  );
}

// ---------------------------------------------------------------- outline

// Rendered plans sit on a plain light background. The building is everything that isn't
// background reachable from the image border — wide balcony/door openings can't leak in.
function traceOutline(lab: Float32Array, W: number, H: number, thick: number): PxPoint[] {
  const light = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    if (lab[p * 3] > BACKGROUND_MIN_L && Math.hypot(lab[p * 3 + 1], lab[p * 3 + 2]) < BACKGROUND_MAX_CHROMA) light[p] = 1;
  }
  const background = dilate(erode(light, W, H, 2), W, H, 2); // drop thin light lines (glass)

  const outside = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (outside[p] || !background[p]) continue;
    outside[p] = 1;
    const x = p % W;
    if (x > 0) stack.push(p - 1);
    if (x < W - 1) stack.push(p + 1);
    if (p >= W) stack.push(p - W);
    if (p < W * H - W) stack.push(p + W);
  }

  // Trace only the building: the largest non-background shape. Otherwise a stray speck (JPEG
  // noise, a logo, a north arrow) above-left of the plan would be traced instead.
  const notOutside = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) notOutside[p] = outside[p] ? 0 : 1;
  const shapes = components(notOutside, W, H);
  if (shapes.length === 0) return [];
  const building = new Uint8Array(W * H);
  for (const p of shapes.reduce((a, b) => (b.pixels.length > a.pixels.length ? b : a)).pixels) building[p] = 1;

  const contour = mooreTrace((x, y) => x >= 0 && y >= 0 && x < W && y < H && building[y * W + x] === 1, W, H);
  if (contour.length < 4) return [];
  return rectilinear(simplifyClosed(contour, thick * OUTLINE_SIMPLIFY_FACTOR), thick * 0.5);
}

function mooreTrace(inside: (x: number, y: number) => boolean, W: number, H: number): PxPoint[] {
  let sx = -1, sy = -1;
  search: for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) if (inside(x, y)) { sx = x; sy = y; break search; }
  }
  if (sx < 0) return [];
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const pts: PxPoint[] = [];
  let x = sx, y = sy, d = 6;
  for (let guard = 0; guard < W * H; guard++) {
    pts.push({ x, y });
    let moved = false;
    for (let k = 0; k < 8; k++) {
      const nd = (d + 6 + k) % 8;
      const nx = x + dirs[nd][0], ny = y + dirs[nd][1];
      if (inside(nx, ny)) { x = nx; y = ny; d = nd; moved = true; break; }
    }
    if (!moved || (x === sx && y === sy && pts.length > 2)) break;
  }
  return pts;
}

function douglasPeucker(pts: PxPoint[], eps: number): PxPoint[] {
  if (pts.length < 3) return pts;
  const first = pts[0], last = pts[pts.length - 1];
  const len = Math.hypot(last.x - first.x, last.y - first.y) || 1;
  let idx = 0, max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((last.y - first.y) * pts[i].x - (last.x - first.x) * pts[i].y + last.x * first.y - last.y * first.x) / len;
    if (d > max) { max = d; idx = i; }
  }
  if (max <= eps) return [first, last];
  return [...douglasPeucker(pts.slice(0, idx + 1), eps).slice(0, -1), ...douglasPeucker(pts.slice(idx), eps)];
}

// Splits the loop at its farthest point from the start so both halves are open paths.
function simplifyClosed(loop: PxPoint[], eps: number): PxPoint[] {
  const s = loop[0];
  let far = 0;
  loop.forEach((p, i) => {
    if (Math.hypot(p.x - s.x, p.y - s.y) > Math.hypot(loop[far].x - s.x, loop[far].y - s.y)) far = i;
  });
  return [
    ...douglasPeucker(loop.slice(0, far + 1), eps).slice(0, -1),
    ...douglasPeucker([...loop.slice(far), s], eps).slice(0, -1),
  ];
}

// Forces every edge to be horizontal or vertical. Points that sit on a nearly straight run
// are dropped first, otherwise two consecutive edges of the same direction fight over the
// shared point and leave a small jog. Repeats until nothing changes.
function rectilinear(poly: PxPoint[], tol: number): PxPoint[] {
  let pts = poly.map((p) => ({ ...p }));
  for (let pass = 0; pass < 4; pass++) {
    const before = pts.length;
    pts = pts.filter((p, i) => {
      const prev = pts[(i - 1 + pts.length) % pts.length], next = pts[(i + 1) % pts.length];
      const straightV = Math.abs(prev.x - p.x) < tol && Math.abs(p.x - next.x) < tol;
      const straightH = Math.abs(prev.y - p.y) < tol && Math.abs(p.y - next.y) < tol;
      return !straightV && !straightH;
    });
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      if (Math.abs(p.x - q.x) < Math.abs(p.y - q.y)) { const m = (p.x + q.x) / 2; p.x = m; q.x = m; }
      else { const m = (p.y + q.y) / 2; p.y = m; q.y = m; }
    }
    if (pts.length === before && pass > 0) break;
  }
  return pts;
}
