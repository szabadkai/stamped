import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { mergeGeometries as mergeBufferGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildDecorationShapes } from './decorations.ts';

export interface ExtrudeParams {
  depth: number;
  bevelSize: number;
  flipWinding: boolean;
  targetSize: number;
  /** Rotation (degrees) of the SVG art relative to the legend/circle frame. */
  artRotation: number;
  /** Draw a solid ring border around the design. */
  circle: boolean;
  /** Ring wall thickness in mm. */
  circleThickness: number;
  /** Legend text running along the top arc. */
  legendTop: string;
  /** Legend text running along the bottom arc. */
  legendBottom: string;
  /** Cap height of the legend text in mm. */
  legendSize: number;
  /** Spacing (mm) between the design and the legend/ring. */
  gap: number;
  /** Rotation (degrees) of the legend band around the circle. */
  legendAngle: number;
  /** Mirror the relief so the printed imprint reads correctly. */
  mirror: boolean;
}

export function extrudeSVG(
  svgString: string,
  params: ExtrudeParams,
): THREE.BufferGeometry | null {
  const allShapes: THREE.Shape[] = [];

  if (svgString.trim()) {
    const loader = new SVGLoader();
    const svgData = loader.parse(svgString);

    const xml = svgData.xml as unknown as SVGSVGElement | null;
    const svgWidth = xml?.viewBox?.baseVal?.width
      || xml?.width?.baseVal?.value
      || 100;
    const svgHeight = xml?.viewBox?.baseVal?.height
      || xml?.height?.baseVal?.value
      || 100;

    const maxDim = Math.max(svgWidth, svgHeight);
    const svgCenterX = svgWidth / 2;
    const svgCenterY = svgHeight / 2;
    const scaleFactor = params.targetSize / maxDim;
    const artRotation = (params.artRotation * Math.PI) / 180;

    for (const path of svgData.paths) {
      const shapes = SVGLoader.createShapes(path);
      for (const shape of shapes) {
        transformShapePoints(shape, svgCenterX, svgCenterY, scaleFactor, artRotation);
        allShapes.push(shape);
      }
    }
  }

  // Wrap the design with an optional ring border and curved legend text.
  const contentRadius = boundingRadius(allShapes) || params.targetSize * 0.3;
  const decorations = buildDecorationShapes(
    {
      circle: params.circle,
      circleThickness: params.circleThickness,
      legendTop: params.legendTop,
      legendBottom: params.legendBottom,
      legendSize: params.legendSize,
      gap: params.gap,
      legendAngle: params.legendAngle,
      targetSize: params.targetSize,
    },
    contentRadius,
  );
  allShapes.push(...decorations);

  if (allShapes.length === 0) return null;

  // The tip (stamping surface) stays true to the SVG outline.
  // The base (where it meets the stamp body) flares outward at 60° for support.
  // 60° wall angle: horizontal spread = height * tan(30°) ≈ 0.577 * height.
  const bevelHeight = Math.min(params.bevelSize, params.depth - 0.2);
  const bevelSpread = bevelHeight * Math.tan(Math.PI / 6);

  // Main extrusion: exact SVG outline, no bevel
  const mainSettings: THREE.ExtrudeGeometryOptions = {
    depth: params.depth - bevelHeight,
    bevelEnabled: false,
    curveSegments: 12,
  };
  const mainGeo = new THREE.ExtrudeGeometry(allShapes, mainSettings);

  if (bevelHeight > 0) {
    // Support flare: bevel only at the start (z=0), flat at the join (z=bevelHeight)
    // Use bevelOffset=0 so bevel extends outward from SVG outline.
    // bevelThickness = bevelHeight, bevelSize = bevelSpread.
    // The bevel at z=depth end is hidden because it joins the main extrusion.
    const flareSettings: THREE.ExtrudeGeometryOptions = {
      depth: 0.001,
      bevelEnabled: true,
      bevelThickness: bevelHeight,
      bevelSize: bevelSpread,
      bevelSegments: 1,
      curveSegments: 12,
    };
    const flareGeo = new THREE.ExtrudeGeometry(allShapes, flareSettings);

    // Main extrusion starts at z=0. Move it forward past the flare.
    mainGeo.translate(0, 0, bevelHeight);

    // Merge flare + main
    const mainNI = mainGeo.index ? mainGeo.toNonIndexed() : mainGeo;
    const flareNI = flareGeo.index ? flareGeo.toNonIndexed() : flareGeo;
    const merged = mergeBufferGeometries([mainNI, flareNI]);
    if (merged) {
      merged.rotateX(-Math.PI / 2);
      return finalize(merged, params.mirror);
    }
  }

  mainGeo.rotateX(-Math.PI / 2);
  return finalize(mainGeo, params.mirror);
}

/**
 * Optionally mirror the relief (so a pressed imprint reads correctly) and
 * recompute normals. Mirroring negates X and reverses each triangle's winding
 * so the solid stays correctly oriented for STL export.
 */
function finalize(geo: THREE.BufferGeometry, mirror: boolean): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;

  if (mirror) {
    const arr = g.attributes.position.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = -arr[i]; // flip X
    }
    // Reflection inverts triangle orientation; swap two verts per triangle to restore it.
    for (let i = 0; i < arr.length; i += 9) {
      for (let k = 0; k < 3; k++) {
        const a = i + 3 + k;
        const b = i + 6 + k;
        const tmp = arr[a];
        arr[a] = arr[b];
        arr[b] = tmp;
      }
    }
    g.attributes.position.needsUpdate = true;
  }

  g.computeVertexNormals();
  return g;
}

/** Largest distance of any shape (or hole) point from the origin, in mm. */
function boundingRadius(shapes: THREE.Shape[]): number {
  let max = 0;
  for (const shape of shapes) {
    for (const p of shape.getPoints(24)) {
      max = Math.max(max, Math.hypot(p.x, p.y));
    }
    for (const hole of shape.holes) {
      for (const p of hole.getPoints(24)) {
        max = Math.max(max, Math.hypot(p.x, p.y));
      }
    }
  }
  return max;
}

function transformShapePoints(
  shape: THREE.Shape,
  centerX: number,
  centerY: number,
  scale: number,
  rotation: number,
) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  const transformCurve = (curves: THREE.Curve<THREE.Vector2>[]) => {
    for (const seg of curves) {
      if (seg instanceof THREE.LineCurve) {
        applyTransform(seg.v1, centerX, centerY, scale, cos, sin);
        applyTransform(seg.v2, centerX, centerY, scale, cos, sin);
      } else if (seg instanceof THREE.QuadraticBezierCurve) {
        applyTransform(seg.v0, centerX, centerY, scale, cos, sin);
        applyTransform(seg.v1, centerX, centerY, scale, cos, sin);
        applyTransform(seg.v2, centerX, centerY, scale, cos, sin);
      } else if (seg instanceof THREE.CubicBezierCurve) {
        applyTransform(seg.v0, centerX, centerY, scale, cos, sin);
        applyTransform(seg.v1, centerX, centerY, scale, cos, sin);
        applyTransform(seg.v2, centerX, centerY, scale, cos, sin);
        applyTransform(seg.v3, centerX, centerY, scale, cos, sin);
      }
    }
  };

  transformCurve(shape.curves);
  applyTransform(shape.currentPoint, centerX, centerY, scale, cos, sin);

  for (const hole of shape.holes) {
    transformCurve(hole.curves);
    applyTransform(hole.currentPoint, centerX, centerY, scale, cos, sin);
  }
}

function applyTransform(
  point: THREE.Vector2,
  centerX: number,
  centerY: number,
  scale: number,
  cos: number,
  sin: number,
) {
  // Centre and scale (SVG y-axis points down, so flip), then rotate.
  const x = (point.x - centerX) * scale;
  const y = -(point.y - centerY) * scale;
  point.set(x * cos - y * sin, x * sin + y * cos);
}
