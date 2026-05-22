import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

export async function loadBaseSTL(): Promise<THREE.BufferGeometry> {
  const loader = new STLLoader();
  const url = `${import.meta.env.BASE_URL}icon_Original.stl`;
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const geometry = loader.parse(buffer);
  geometry.rotateX(Math.PI); // Flip so stamping surface faces up (+Y)
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();
  return geometry;
}
