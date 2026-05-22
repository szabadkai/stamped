import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

export function exportSTL(
  geometry: THREE.BufferGeometry,
  filename = 'stamp.stl',
): void {
  const exporter = new STLExporter();
  const mesh = new THREE.Mesh(geometry);
  const result = exporter.parse(mesh, { binary: true });

  const blob = new Blob([result as unknown as ArrayBuffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
