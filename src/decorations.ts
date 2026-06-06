import * as THREE from 'three';
import type { Font } from 'three/addons/loaders/FontLoader.js';
import { getActiveFont } from './font.ts';

export interface DecorationParams {
  /** Draw a solid ring border around the design. */
  circle: boolean;
  /** Ring wall thickness in mm. */
  circleThickness: number;
  /** Legend text running along the top arc (reads left→right). */
  legendTop: string;
  /** Legend text running along the bottom arc (reads left→right). */
  legendBottom: string;
  /** Cap height of the legend text in mm. */
  legendSize: number;
  /** Spacing (mm) between the design and the legend/ring (and between them). */
  gap: number;
  /** Rotation (degrees) of the legend band around the circle. */
  legendAngle: number;
  /** Overall reference size of the stamp in mm (base width × scale). */
  targetSize: number;
}

/**
 * Build the extra 2D shapes (ring border + curved legend text) that wrap
 * around the design. All shapes are returned in final mm coordinates,
 * centred on the origin, ready to be appended to the SVG shapes and
 * extruded together.
 *
 * @param contentRadius radius (mm) of the design the decorations enclose.
 */
export function buildDecorationShapes(
  p: DecorationParams,
  contentRadius: number,
): THREE.Shape[] {
  const top = p.legendTop.trim();
  const bottom = p.legendBottom.trim();
  const hasLegend = top.length > 0 || bottom.length > 0;

  if (!p.circle && !hasLegend) return [];

  const out: THREE.Shape[] = [];
  const gap = Math.max(0, p.gap);

  // Work outward from the design: optional legend band, then optional ring.
  let radius = contentRadius + gap;

  if (hasLegend) {
    const font = getActiveFont();
    const baselineRadius = radius + p.legendSize / 2;
    if (top) {
      layoutTextOnArc(out, font, top, p.legendSize, baselineRadius, 90 + p.legendAngle, -1, true);
    }
    if (bottom) {
      layoutTextOnArc(out, font, bottom, p.legendSize, baselineRadius, 270 + p.legendAngle, 1, false);
    }
    radius = baselineRadius + p.legendSize / 2 + gap;
  }

  if (p.circle) {
    const inner = radius;
    const outer = inner + Math.max(0.1, p.circleThickness);
    out.push(ringShape(inner, outer));
  }

  return out;
}

/** A flat annulus: outer circle with a concentric circular hole.
 *
 * Built as fine-grained polygons (not `absarc`) so the circle stays smooth
 * regardless of the extruder's `curveSegments` — a single arc curve would be
 * faceted down to ~12 sides. Straight segments are not subdivided further, so
 * the resolution set here is exactly what gets extruded. */
function ringShape(innerRadius: number, outerRadius: number): THREE.Shape {
  const segments = 160;
  const shape = new THREE.Shape();
  addCirclePath(shape, outerRadius, segments, false);
  const hole = new THREE.Path();
  addCirclePath(hole, innerRadius, segments, true);
  shape.holes.push(hole);
  return shape;
}

/** Trace a circle onto a path as `segments` straight chords. The hole winds
 * opposite to the outer contour. Emits `segments` distinct points and lets the
 * extruder close the loop — repeating the start point would leave a
 * zero-length edge at the seam that the chamfer pinches into a nick. */
function addCirclePath(path: THREE.Path, radius: number, segments: number, clockwise: boolean): void {
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const a = clockwise ? -t : t;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
}

/** Horizontal advance of a glyph at the given text size, in mm. */
function advanceWidth(font: Font, char: string, size: number): number {
  const data = font.data as unknown as {
    resolution: number;
    glyphs: Record<string, { ha: number }>;
  };
  const glyph = data.glyphs[char] || data.glyphs['?'];
  const ha = glyph ? glyph.ha : data.resolution * 0.5;
  return (ha / data.resolution) * size;
}

/**
 * Lay a string of glyphs out along a circular arc, centred on `centerDeg`.
 *
 * @param radius   baseline (centre-line) radius of the text, mm.
 * @param centerDeg angle (standard maths degrees, 0 = +x, CCW) the text centres on.
 * @param direction +1 if the reading direction increases the angle, -1 if it decreases it.
 * @param outward  true → letter tops point away from the centre (top arc);
 *                 false → letter tops point toward the centre (bottom arc).
 */
function layoutTextOnArc(
  out: THREE.Shape[],
  font: Font,
  text: string,
  size: number,
  radius: number,
  centerDeg: number,
  direction: 1 | -1,
  outward: boolean,
): void {
  const chars = [...text];
  const advances = chars.map((c) => advanceWidth(font, c, size));
  const total = advances.reduce((a, b) => a + b, 0);
  if (total === 0) return;

  const centerRad = (centerDeg * Math.PI) / 180;
  // Linear position along the baseline, measured from the text's centre.
  let cursor = -total / 2;

  for (let i = 0; i < chars.length; i++) {
    const advance = advances[i];
    const midpoint = cursor + advance / 2;
    const phi = centerRad + direction * (midpoint / radius);
    placeChar(out, font, chars[i], size, advance, radius, phi, outward);
    cursor += advance;
  }
}

/** Generate, orient and position the shapes for a single glyph on the arc. */
function placeChar(
  out: THREE.Shape[],
  font: Font,
  char: string,
  size: number,
  advance: number,
  radius: number,
  phi: number,
  outward: boolean,
): void {
  const shapes = font.generateShapes(char, size);
  if (shapes.length === 0) return; // whitespace contributes advance only

  // Glyphs are generated with their left edge at x=0 and baseline at y=0.
  // Recentre so the glyph's middle sits at the local origin.
  const dx = -advance / 2;
  const dy = -size * 0.35;

  const cos = Math.cos(phi);
  const sin = Math.sin(phi);

  // u = local "up" direction, t = local "right" (reading) direction.
  const ux = outward ? cos : -cos;
  const uy = outward ? sin : -sin;
  const tx = outward ? sin : -sin;
  const ty = outward ? -cos : cos;
  const baseX = radius * cos;
  const baseY = radius * sin;

  const map = (x: number, y: number): [number, number] => {
    const lx = x + dx;
    const ly = y + dy;
    return [baseX + lx * tx + ly * ux, baseY + lx * ty + ly * uy];
  };

  for (const shape of shapes) {
    mapShape(shape, map);
    out.push(shape);
  }
}

/** Apply an affine 2D mapping to every control point of a shape and its holes. */
function mapShape(shape: THREE.Shape, f: (x: number, y: number) => [number, number]): void {
  mapCurves(shape.curves, f);
  mapPoint(shape.currentPoint, f);
  for (const hole of shape.holes) {
    mapCurves(hole.curves, f);
    mapPoint(hole.currentPoint, f);
  }
}

function mapCurves(
  curves: THREE.Curve<THREE.Vector2>[],
  f: (x: number, y: number) => [number, number],
): void {
  for (const seg of curves) {
    if (seg instanceof THREE.LineCurve) {
      mapPoint(seg.v1, f);
      mapPoint(seg.v2, f);
    } else if (seg instanceof THREE.QuadraticBezierCurve) {
      mapPoint(seg.v0, f);
      mapPoint(seg.v1, f);
      mapPoint(seg.v2, f);
    } else if (seg instanceof THREE.CubicBezierCurve) {
      mapPoint(seg.v0, f);
      mapPoint(seg.v1, f);
      mapPoint(seg.v2, f);
      mapPoint(seg.v3, f);
    }
  }
}

function mapPoint(p: THREE.Vector2, f: (x: number, y: number) => [number, number]): void {
  const [x, y] = f(p.x, p.y);
  p.set(x, y);
}
