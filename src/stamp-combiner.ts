import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function combineStamp(
  base: THREE.BufferGeometry,
  svgGeometry: THREE.BufferGeometry,
  transform: THREE.Matrix4,
): THREE.BufferGeometry {
  const svgClone = svgGeometry.clone();
  svgClone.applyMatrix4(transform);

  const baseNonIndexed = base.index ? base.toNonIndexed() : base.clone();
  const svgNonIndexed = svgClone.index ? svgClone.toNonIndexed() : svgClone;

  svgNonIndexed.deleteAttribute('uv');

  if (!baseNonIndexed.getAttribute('normal')) baseNonIndexed.computeVertexNormals();
  if (!svgNonIndexed.getAttribute('normal')) svgNonIndexed.computeVertexNormals();

  const combined = mergeGeometries([baseNonIndexed, svgNonIndexed], false);
  if (!combined) throw new Error('Failed to merge geometries');

  combined.computeVertexNormals();
  return combined;
}
