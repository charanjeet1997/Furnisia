export interface WallOpening {
  centerX: number;
  width: number;
  bottom: number;
  top: number;
}

export interface WallSegment {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

// Two separate box meshes that are placed to exactly touch at an edge can still show a
// hairline rendering seam at oblique viewing angles (rasterization/AA imprecision), so
// every segment is inflated slightly and made to overlap its neighbors instead of
// precisely abutting them.
const SEAM_OVERLAP = 0.015;

function pushSegment(segments: WallSegment[], centerX: number, centerY: number, width: number, height: number) {
  segments.push({ centerX, centerY, width: width + SEAM_OVERLAP * 2, height: height + SEAM_OVERLAP * 2 });
}

// Splits a wall (or a baseboard strip, treated as a very short wall) into solid box
// segments around a set of rectangular openings (doors reach the floor: bottom = 0;
// windows have both a sill and a header).
export function buildWallSegments(wallWidth: number, wallHeight: number, openings: WallOpening[]): WallSegment[] {
  if (openings.length === 0) {
    return [{ centerX: 0, centerY: wallHeight / 2, width: wallWidth + SEAM_OVERLAP * 2, height: wallHeight + SEAM_OVERLAP * 2 }];
  }

  const sorted = [...openings].sort((a, b) => a.centerX - b.centerX);
  const segments: WallSegment[] = [];
  const wallLeft = -wallWidth / 2;
  const wallRight = wallWidth / 2;
  let cursor = wallLeft;

  for (const opening of sorted) {
    const openLeft = opening.centerX - opening.width / 2;
    const openRight = opening.centerX + opening.width / 2;

    if (openLeft > cursor) {
      const segWidth = openLeft - cursor;
      pushSegment(segments, cursor + segWidth / 2, wallHeight / 2, segWidth, wallHeight);
    }

    if (opening.bottom > 0) {
      pushSegment(segments, opening.centerX, opening.bottom / 2, opening.width, opening.bottom);
    }

    if (opening.top < wallHeight) {
      const headerHeight = wallHeight - opening.top;
      pushSegment(segments, opening.centerX, opening.top + headerHeight / 2, opening.width, headerHeight);
    }

    cursor = openRight;
  }

  if (wallRight > cursor) {
    const segWidth = wallRight - cursor;
    pushSegment(segments, cursor + segWidth / 2, wallHeight / 2, segWidth, wallHeight);
  }

  return segments;
}
