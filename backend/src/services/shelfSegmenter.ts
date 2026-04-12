/**
 * Shelf segmenter — finds individual product regions in a shelf photo.
 *
 * Strategy:
 *   1. Detect horizontal "shelf rows" using a vertical projection of edge energy
 *      (rows of products separated by shelf rails / backgrounds).
 *   2. Within each row, detect vertical "product columns" using a horizontal
 *      projection of edge energy.
 *   3. Return bounding boxes for each cell, filtering out tiny/noise cells.
 *
 * This projection-profile approach works well on retail shelf photos where
 * products are arranged in a regular grid with visible gaps between them.
 */

import sharp from 'sharp';

export interface ShelfRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  col: number;
}

const W = 640; // working width for segmentation (wider = more column resolution)
const H = 240; // working height

function sobelH(gray: Buffer, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -gray[(y-1)*w+(x-1)] - 2*gray[y*w+(x-1)] - gray[(y+1)*w+(x-1)]
        +gray[(y-1)*w+(x+1)] + 2*gray[y*w+(x+1)] + gray[(y+1)*w+(x+1)];
      const gy =
        -gray[(y-1)*w+(x-1)] - 2*gray[(y-1)*w+x] - gray[(y-1)*w+(x+1)]
        +gray[(y+1)*w+(x-1)] + 2*gray[(y+1)*w+x] + gray[(y+1)*w+(x+1)];
      out[y*w+x] = Math.sqrt(gx*gx + gy*gy);
    }
  }
  return out;
}

/** Horizontal projection: mean edge energy per row */
function hProj(edges: Float32Array, w: number, h: number): Float32Array {
  const p = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) s += edges[y*w+x];
    p[y] = s / w;
  }
  return p;
}

/** Vertical projection: mean edge energy per column */
function vProj(edges: Float32Array, w: number, h: number): Float32Array {
  const p = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = 0; y < h; y++) s += edges[y*w+x];
    p[x] = s / h;
  }
  return p;
}

/** Smooth a Float32Array with a box filter of given radius */
function smooth(arr: Float32Array, radius: number): Float32Array {
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    let s = 0, c = 0;
    for (let j = Math.max(0, i-radius); j <= Math.min(arr.length-1, i+radius); j++) {
      s += arr[j]; c++;
    }
    out[i] = s / c;
  }
  return out;
}

/**
 * Find boundaries (split positions) by locating valleys in a projection profile.
 * Returns sorted pixel positions including 0 and `size`.
 *
 * `threshold` controls how "gap-like" a position must be (0–1, lower = more splits).
 */
function findSplits(
  proj: Float32Array,
  size: number,
  minCell: number,
  threshold = 0.40,
): number[] {
  const smoothed = smooth(proj, Math.max(2, Math.floor(size / 30)));
  const max = Math.max(...Array.from(smoothed));
  if (max === 0) return [0, size];

  // Build a "gap score": lower edge energy = more likely a gap
  const gapScore = smoothed.map((v) => 1 - v / max);

  const splits = [0];
  let lastSplit = 0;

  for (let i = 1; i < size - 1; i++) {
    if (i - lastSplit < minCell) continue;
    // Local maximum of gap score (valley of edge energy)
    if (
      gapScore[i] > threshold &&
      gapScore[i] >= gapScore[i-1] &&
      gapScore[i] >= gapScore[i+1]
    ) {
      splits.push(i);
      lastSplit = i;
    }
  }

  splits.push(size);
  return splits;
}

/**
 * For very wide or very tall images that should clearly have many cells,
 * fall back to evenly-spaced uniform splits when the edge-based approach
 * returns too few divisions.
 */
function uniformSplits(size: number, count: number): number[] {
  const splits: number[] = [];
  for (let i = 0; i <= count; i++) splits.push(Math.round((i / count) * size));
  return splits;
}

export async function segmentShelf(
  imagePath: string,
  origW: number,
  origH: number,
): Promise<ShelfRegion[]> {
  const { data: gray } = await sharp(imagePath)
    .resize(W, H, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const edges = sobelH(gray, W, H);
  const hp    = hProj(edges, W, H);
  const vp    = vProj(edges, W, H);

  // Estimate expected grid dimensions from aspect ratio
  const aspectRatio = origW / origH;
  // Wide panoramic shelf (e.g. 5:1+) likely has many columns per few rows
  // Multiplier 1.7 → rounds 5.29 to 9, which matches a 9-column shelf
  const expectedCols = aspectRatio >= 3 ? Math.round(aspectRatio * 1.7) : Math.round(aspectRatio * 1.2);
  const expectedRows = aspectRatio >= 3 ? 2 : Math.max(2, Math.round(origH / (origW / expectedCols)));

  // Min cell: at least 8% of dimension for rows, 3% for columns
  let rowSplits = findSplits(hp, H, Math.floor(H * 0.08), 0.35);
  let colSplits = findSplits(vp, W, Math.floor(W * 0.03), 0.35);

  // Fall back to uniform grid when edge detection is too coarse or too fine
  const detectedRows = rowSplits.length - 1;
  const detectedCols = colSplits.length - 1;

  // For rows: use uniform if we got too few (missed the shelf divider)
  if (detectedRows < expectedRows) {
    rowSplits = uniformSplits(H, expectedRows);
  }
  // For cols: use uniform if too few OR too many (noisy splits)
  if (detectedCols < Math.max(2, expectedCols - 2) || detectedCols > expectedCols + 3) {
    colSplits = uniformSplits(W, expectedCols);
  }

  const scaleX = origW / W;
  const scaleY = origH / H;

  const regions: ShelfRegion[] = [];
  for (let r = 0; r < rowSplits.length - 1; r++) {
    for (let c = 0; c < colSplits.length - 1; c++) {
      const x = Math.round(colSplits[c]   * scaleX);
      const y = Math.round(rowSplits[r]   * scaleY);
      const w = Math.round((colSplits[c+1] - colSplits[c]) * scaleX);
      const h = Math.round((rowSplits[r+1] - rowSplits[r]) * scaleY);
      if (w < 30 || h < 30) continue;
      regions.push({ x, y, width: w, height: h, row: r + 1, col: c + 1 });
    }
  }

  return regions.sort((a, b) => a.row - b.row || a.col - b.col).slice(0, 60);
}
