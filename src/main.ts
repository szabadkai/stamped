import * as THREE from 'three';
import { loadBaseSTL } from './stl-loader.ts';
import { extrudeSVG, type ExtrudeParams } from './svg-extruder.ts';
import { combineStamp } from './stamp-combiner.ts';
import { exportSTL } from './exporter.ts';
import { StampViewer } from './viewer.ts';
import { FONT_OPTIONS, setActiveFont } from './font.ts';

let viewer: StampViewer;
let baseGeometry: THREE.BufferGeometry;
let baseBounds: THREE.Box3;
let currentSVG: string | null = null;
let currentSVGGeometry: THREE.BufferGeometry | null = null;
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;

const status = document.getElementById('status')!;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const orderBtn = document.getElementById('order-btn') as HTMLButtonElement;
const svgInput = document.getElementById('svg-input') as HTMLInputElement;
const uploadZone = document.getElementById('upload-zone')!;
const depthInput = document.getElementById('depth') as HTMLInputElement;
const bevelInput = document.getElementById('bevel') as HTMLInputElement;
const scaleInput = document.getElementById('scale') as HTMLInputElement;
const rotationInput = document.getElementById('rotation') as HTMLInputElement;
const artScaleInput = document.getElementById('art-scale') as HTMLInputElement;
const artRotationInput = document.getElementById('art-rotation') as HTMLInputElement;
const flipInput = document.getElementById('flip-winding') as HTMLInputElement;
const mirrorInput = document.getElementById('mirror') as HTMLInputElement;
const circleInput = document.getElementById('circle-enabled') as HTMLInputElement;
const circleThicknessInput = document.getElementById('circle-thickness') as HTMLInputElement;
const gapInput = document.getElementById('gap') as HTMLInputElement;
const legendTopInput = document.getElementById('legend-top') as HTMLInputElement;
const legendBottomInput = document.getElementById('legend-bottom') as HTMLInputElement;
const legendFontSelect = document.getElementById('legend-font') as HTMLSelectElement;
const legendSizeInput = document.getElementById('legend-size') as HTMLInputElement;
const legendAngleInput = document.getElementById('legend-angle') as HTMLInputElement;
const resetPosBtn = document.getElementById('reset-pos-btn') as HTMLButtonElement;
const viewportHint = document.getElementById('viewport-hint')!;
const depthValue = document.getElementById('depth-value')!;
const bevelValue = document.getElementById('bevel-value')!;
const scaleValue = document.getElementById('scale-value')!;
const rotationValue = document.getElementById('rotation-value')!;
const artScaleValue = document.getElementById('art-scale-value')!;
const artRotationValue = document.getElementById('art-rotation-value')!;
const circleThicknessValue = document.getElementById('circle-thickness-value')!;
const gapValue = document.getElementById('gap-value')!;
const legendSizeValue = document.getElementById('legend-size-value')!;
const legendAngleValue = document.getElementById('legend-angle-value')!;

// Populate the font picker from the registry.
for (const opt of FONT_OPTIONS) {
  const el = document.createElement('option');
  el.value = opt.id;
  el.textContent = opt.label;
  legendFontSelect.appendChild(el);
}
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;

function setStatus(text: string) {
  status.textContent = text;
}

function getTargetSize(): number {
  const scalePercent = parseFloat(scaleInput.value);
  const baseWidth = baseBounds.max.x - baseBounds.min.x;
  return baseWidth * (scalePercent / 100);
}

function readExtrudeParams(): ExtrudeParams {
  return {
    depth: parseFloat(depthInput.value),
    bevelSize: parseFloat(bevelInput.value),
    flipWinding: flipInput.checked,
    targetSize: getTargetSize(),
    artScale: parseFloat(artScaleInput.value) / 100,
    artRotation: parseFloat(artRotationInput.value),
    circle: circleInput.checked,
    circleThickness: parseFloat(circleThicknessInput.value),
    legendTop: legendTopInput.value,
    legendBottom: legendBottomInput.value,
    legendSize: parseFloat(legendSizeInput.value),
    gap: parseFloat(gapInput.value),
    legendAngle: parseFloat(legendAngleInput.value),
    mirror: mirrorInput.checked,
  };
}

function updateValueLabels() {
  depthValue.textContent = `${depthInput.value} mm`;
  bevelValue.textContent = `${bevelInput.value} mm`;
  scaleValue.textContent = `${scaleInput.value}%`;
  rotationValue.textContent = `${rotationInput.value}°`;
  artScaleValue.textContent = `${artScaleInput.value}%`;
  artRotationValue.textContent = `${artRotationInput.value}°`;
  circleThicknessValue.textContent = `${circleThicknessInput.value} mm`;
  gapValue.textContent = `${gapInput.value} mm`;
  legendSizeValue.textContent = `${legendSizeInput.value} mm`;
  legendAngleValue.textContent = `${legendAngleInput.value}°`;
}

/** True when there's anything to build: an SVG, a circle, or legend text. */
function hasContent(): boolean {
  return !!(
    currentSVG?.trim() ||
    circleInput.checked ||
    legendTopInput.value.trim() ||
    legendBottomInput.value.trim()
  );
}

function rebuildSVGGeometry() {
  if (!baseGeometry) return;

  if (!hasContent()) {
    viewer.removeSVG();
    currentSVGGeometry = null;
    downloadBtn.disabled = true;
    orderBtn.disabled = true;
    setStatus('Upload an SVG or add a circle / legend to begin');
    return;
  }

  setStatus('Building stamp pattern...');

  const savedPos = viewer.svgMesh
    ? { x: viewer.svgMesh.position.x, z: viewer.svgMesh.position.z }
    : null;

  try {
    const params = readExtrudeParams();
    const extruded = extrudeSVG(currentSVG ?? '', params);

    if (!extruded) {
      setStatus('No shapes found in SVG');
      return;
    }

    currentSVGGeometry = extruded;
    viewer.setSVG(extruded, baseBounds);

    if (savedPos) {
      viewer.svgMesh!.position.x = savedPos.x;
      viewer.svgMesh!.position.z = savedPos.z;
    }

    viewer.setSVGRotation(parseFloat(rotationInput.value));

    downloadBtn.disabled = false;
    orderBtn.disabled = false;
    viewportHint.classList.add('visible');
    setTimeout(() => viewportHint.classList.remove('visible'), 5000);
    setStatus('Drag pattern to position • Adjust controls • Download when ready');
  } catch (e) {
    setStatus(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}

function debouncedRebuild() {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuildSVGGeometry, 200);
}

function handleSVGFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.svg')) {
    setStatus('Please upload an SVG file');
    return;
  }

  uploadZone.classList.add('has-file');
  const label = uploadZone.querySelector('.upload-text');
  if (label) label.textContent = file.name;

  file.text().then((text) => {
    currentSVG = text;
    rebuildSVGGeometry();
  });
}

svgInput.addEventListener('change', () => {
  const file = svgInput.files?.[0];
  if (file) handleSVGFile(file);
});

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  const file = e.dataTransfer?.files[0];
  if (file) handleSVGFile(file);
});

depthInput.addEventListener('input', () => { updateValueLabels(); debouncedRebuild(); });
bevelInput.addEventListener('input', () => { updateValueLabels(); debouncedRebuild(); });
scaleInput.addEventListener('input', () => { updateValueLabels(); debouncedRebuild(); });
rotationInput.addEventListener('input', () => {
  updateValueLabels();
  viewer.setSVGRotation(parseFloat(rotationInput.value));
});
artScaleInput.addEventListener('input', () => { updateValueLabels(); debouncedRebuild(); });
artRotationInput.addEventListener('input', () => { updateValueLabels(); debouncedRebuild(); });
flipInput.addEventListener('change', rebuildSVGGeometry);
mirrorInput.addEventListener('change', rebuildSVGGeometry);
circleInput.addEventListener('change', rebuildSVGGeometry);
circleThicknessInput.addEventListener('input', () => { updateValueLabels(); debouncedRebuild(); });
gapInput.addEventListener('input', () => { updateValueLabels(); debouncedRebuild(); });
legendTopInput.addEventListener('input', debouncedRebuild);
legendBottomInput.addEventListener('input', debouncedRebuild);
legendSizeInput.addEventListener('input', () => { updateValueLabels(); debouncedRebuild(); });
legendAngleInput.addEventListener('input', () => { updateValueLabels(); debouncedRebuild(); });
legendFontSelect.addEventListener('change', () => {
  setStatus('Loading font...');
  setActiveFont(legendFontSelect.value).then(rebuildSVGGeometry);
});

resetPosBtn.addEventListener('click', () => {
  viewer.resetSVGPosition();
});

/** Build the full stamp (base + relief at its current position) as one geometry. */
function buildCombinedGeometry(): THREE.BufferGeometry | null {
  if (!currentSVGGeometry || !viewer.svgMesh) return null;
  viewer.svgMesh.updateMatrixWorld(true);
  const transform = viewer.svgMesh.matrixWorld.clone();
  return combineStamp(baseGeometry.clone(), currentSVGGeometry, transform);
}

downloadBtn.addEventListener('click', () => {
  const combined = buildCombinedGeometry();
  if (!combined) return;
  exportSTL(combined);
  setStatus('STL downloaded');
});

// Order a 3D print through Formlabs Form Now. Form Now has no public upload
// API, so we export the STL locally and open its uploader for the user to drop
// the file into (the standard upload → material → quote → checkout flow).
const FORM_NOW_URL = 'https://now.formlabs.com/';
orderBtn.addEventListener('click', () => {
  const combined = buildCombinedGeometry();
  if (!combined) return;
  exportSTL(combined, 'stamp.stl');
  window.open(FORM_NOW_URL, '_blank', 'noopener');
  setStatus('STL saved — drop stamp.stl into the Form Now uploader to get a quote');
});

// ─── Theme ───
function getEffectiveTheme(): 'light' | 'dark' {
  const saved = document.documentElement.getAttribute('data-theme');
  if (saved === 'light') return 'light';
  if (saved === 'dark') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function syncViewerTheme() {
  if (!viewer) return;
  const isDark = getEffectiveTheme() === 'dark';
  viewer.setSceneBackground(
    isDark ? 0x111113 : 0xe8e8ed,
    isDark ? 0x333333 : 0xbbbbbb,
    isDark ? 0x222222 : 0xcccccc,
  );
}

themeToggle.addEventListener('click', () => {
  const current = getEffectiveTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('stamped-theme', next);
  syncViewerTheme();
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  syncViewerTheme();
});

async function init() {
  try {
    const canvas = document.getElementById('preview') as HTMLCanvasElement;
    viewer = new StampViewer(canvas);
    syncViewerTheme();

    setStatus('Loading stamp base...');
    baseGeometry = await loadBaseSTL();
    baseGeometry.computeBoundingBox();
    baseBounds = baseGeometry.boundingBox!;

    viewer.setBase(baseGeometry.clone());
    setStatus('Upload an SVG to create your stamp');
  } catch (e) {
    setStatus(`Failed to load: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}

init();
