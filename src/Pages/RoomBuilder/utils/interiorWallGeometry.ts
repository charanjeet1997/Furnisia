// Pure geometry utilities for interior-wall editing.
// No React, no state — safe to import anywhere.

import { DEFAULT_WALL_THICKNESS, type InteriorWall, type RoomOpening, type RoomVertex } from '../../../Data/RoomShape';
import type { WallEdge } from '../../../Components/polygonGeometry';

export const MIN_EDGE = 0.3; // reject edits/drags that would collapse a wall

export const snap = (v: number) => Math.round(v * 10) / 10; // 0.1m grid, keeps dimensions clean

export interface WallAttachment {
  vertexIndex: number;
}

export type Attachments = Record<string, { start?: WallAttachment; end?: WallAttachment }>;

export function segmentsIntersect(a1: RoomVertex, a2: RoomVertex, b1: RoomVertex, b2: RoomVertex): boolean {
  const d1x = a2.x - a1.x;
  const d1z = a2.z - a1.z;
  const d2x = b2.x - b1.x;
  const d2z = b2.z - b1.z;
  const denom = d1x * d2z - d1z * d2x;
  if (Math.abs(denom) < 1e-9) return false;
  const t = ((b1.x - a1.x) * d2z - (b1.z - a1.z) * d2x) / denom;
  const u = ((b1.x - a1.x) * d1z - (b1.z - a1.z) * d1x) / denom;
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6;
}

export function segmentIntersectionPoint(
  a1: RoomVertex,
  a2: RoomVertex,
  b1: RoomVertex,
  b2: RoomVertex,
): { t: number; point: RoomVertex } | null {
  const d1x = a2.x - a1.x;
  const d1z = a2.z - a1.z;
  const d2x = b2.x - b1.x;
  const d2z = b2.z - b1.z;
  const denom = d1x * d2z - d1z * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((b1.x - a1.x) * d2z - (b1.z - a1.z) * d2x) / denom;
  const u = ((b1.x - a1.x) * d1z - (b1.z - a1.z) * d1x) / denom;
  if (t < 0 || t > 1 || u < -1e-9 || u > 1 + 1e-9) return null;
  const point = { x: a1.x + d1x * t, z: a1.z + d1z * t };
  if (Math.hypot(point.x - a1.x, point.z - a1.z) < 0.08) return null;
  if (Math.hypot(point.x - a2.x, point.z - a2.z) < 0.08) return null;
  return { t, point };
}

export function edgesValid(vertices: RoomVertex[]): boolean {
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a1 = vertices[i];
    const a2 = vertices[(i + 1) % n];
    if (Math.hypot(a2.x - a1.x, a2.z - a1.z) < MIN_EDGE) return false;
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const b1 = vertices[j];
      const b2 = vertices[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

export function splitInteriorWallAt(
  walls: InteriorWall[],
  atts: Attachments,
  openings: RoomOpening[],
  hostId: string,
  point: RoomVertex,
): {
  walls: InteriorWall[];
  attachments: Attachments;
  openings: RoomOpening[];
  member: { wallId: string; end: 'start' | 'end' };
  newJoin?: [{ wallId: string; end: 'start' | 'end' }, { wallId: string; end: 'start' | 'end' }];
} | null {
  const host = walls.find((w) => w.id === hostId);
  if (!host) return null;
  const p = { x: snap(point.x), z: snap(point.z) };
  const distStart = Math.hypot(p.x - host.start.x, p.z - host.start.z);
  const distEnd = Math.hypot(p.x - host.end.x, p.z - host.end.z);
  if (distStart < MIN_EDGE) return { walls, attachments: atts, openings, member: { wallId: hostId, end: 'start' } };
  if (distEnd < MIN_EDGE) return { walls, attachments: atts, openings, member: { wallId: hostId, end: 'end' } };

  const id1 = crypto.randomUUID();
  const id2 = crypto.randomUUID();
  const inherited = host.thickness !== undefined ? { thickness: host.thickness } : {};
  const nextWalls = [
    ...walls.filter((w) => w.id !== hostId),
    { id: id1, start: host.start, end: p, ...inherited },
    { id: id2, start: p, end: host.end, ...inherited },
  ];

  const origAtt = atts[hostId];
  const nextAtts = { ...atts };
  delete nextAtts[hostId];
  if (origAtt?.start) nextAtts[id1] = { ...nextAtts[id1], start: origAtt.start };
  if (origAtt?.end) nextAtts[id2] = { ...nextAtts[id2], end: origAtt.end };

  const len1 = Math.hypot(p.x - host.start.x, p.z - host.start.z);
  const nextOpenings = openings.map((o) => {
    if (o.interiorWallId !== hostId) return o;
    const center = o.offset + o.width / 2;
    return center <= len1 ? { ...o, interiorWallId: id1 } : { ...o, interiorWallId: id2, offset: o.offset - len1 };
  });

  return {
    walls: nextWalls,
    attachments: nextAtts,
    openings: nextOpenings,
    member: { wallId: id1, end: 'end' },
    newJoin: [{ wallId: id1, end: 'end' }, { wallId: id2, end: 'start' }],
  };
}

export function remapOpeningsForEdgeSplit(
  openings: RoomOpening[],
  edge: WallEdge,
  edgeIndex: number,
  insertedPoints: RoomVertex[],
): RoomOpening[] {
  const cuts = insertedPoints
    .map((p) => Math.hypot(p.x - edge.start.x, p.z - edge.start.z))
    .sort((a, b) => a - b);
  return openings.map((o) => {
    if (o.interiorWallId) return o;
    if (o.edgeIndex > edgeIndex) return { ...o, edgeIndex: o.edgeIndex + insertedPoints.length };
    if (o.edgeIndex < edgeIndex) return o;
    const center = o.offset + o.width / 2;
    let seg = 0;
    let base = 0;
    for (const c of cuts) {
      if (center > c) {
        seg += 1;
        base = c;
      }
    }
    return { ...o, edgeIndex: edgeIndex + seg, offset: o.offset - base };
  });
}

export function insertEdgeThickness(t: number[], insertedAt: number, count = 1): number[] {
  const inherited = t[insertedAt - 1] ?? DEFAULT_WALL_THICKNESS;
  return [...t.slice(0, insertedAt), ...Array(count).fill(inherited), ...t.slice(insertedAt)];
}

export function removeEdgeThickness(t: number[], vertexIndex: number): number[] {
  if (vertexIndex === 0) return t.slice(1);
  return [...t.slice(0, vertexIndex), ...t.slice(vertexIndex + 1)];
}

export function remapOpeningsForVertexRemove(openings: RoomOpening[], edges: WallEdge[], vertexIndex: number): RoomOpening[] {
  const n = edges.length;
  const prevEdge = (vertexIndex - 1 + n) % n;
  const nextEdge = vertexIndex;
  const prevLen = edges[prevEdge].length;
  return openings.map((o) => {
    if (o.interiorWallId) return o;
    if (o.edgeIndex === nextEdge) return { ...o, edgeIndex: prevEdge > nextEdge ? prevEdge - 1 : prevEdge, offset: o.offset + prevLen };
    if (o.edgeIndex === prevEdge) return { ...o, edgeIndex: prevEdge > nextEdge ? prevEdge - 1 : prevEdge };
    if (o.edgeIndex > vertexIndex) return { ...o, edgeIndex: o.edgeIndex - 1 };
    return o;
  });
}
