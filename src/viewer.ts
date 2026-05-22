import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class StampViewer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private baseMesh: THREE.Mesh | null = null;
  private baseMaterial: THREE.MeshStandardMaterial;
  private svgMaterial: THREE.MeshStandardMaterial;
  private canvas: HTMLCanvasElement;
  private grid: THREE.GridHelper;

  svgMesh: THREE.Mesh | null = null;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private isDragging = false;
  private dragOffset = new THREE.Vector3();

  onChange: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    const rect = canvas.parentElement!.getBoundingClientRect();
    this.camera = new THREE.PerspectiveCamera(45, rect.width / rect.height, 0.1, 1000);
    this.camera.position.set(0, 30, 50);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(rect.width, rect.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0, 0);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(10, 20, 10);
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);

    this.grid = new THREE.GridHelper(60, 30, 0x333333, 0x222222);
    this.scene.add(this.grid);

    this.baseMaterial = new THREE.MeshStandardMaterial({
      color: 0xb0b0b0,
      roughness: 0.6,
      metalness: 0.1,
    });

    this.svgMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a9eff,
      roughness: 0.4,
      metalness: 0.1,
    });

    const resizeObserver = new ResizeObserver(() => this.handleResize());
    resizeObserver.observe(canvas.parentElement!);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);

    this.animate();
  }

  setBase(geometry: THREE.BufferGeometry): void {
    if (this.baseMesh) {
      this.scene.remove(this.baseMesh);
      this.baseMesh.geometry.dispose();
    }
    this.baseMesh = new THREE.Mesh(geometry, this.baseMaterial);
    this.scene.add(this.baseMesh);
  }

  setSVG(geometry: THREE.BufferGeometry, baseBounds: THREE.Box3): void {
    if (this.svgMesh) {
      this.scene.remove(this.svgMesh);
      this.svgMesh.geometry.dispose();
    }

    this.svgMesh = new THREE.Mesh(geometry, this.svgMaterial);

    const topY = baseBounds.max.y;
    this.svgMesh.position.set(0, topY, 0);

    this.dragPlane.set(new THREE.Vector3(0, 1, 0), -topY);

    this.scene.add(this.svgMesh);
  }

  removeSVG(): void {
    if (this.svgMesh) {
      this.scene.remove(this.svgMesh);
      this.svgMesh.geometry.dispose();
      this.svgMesh = null;
    }
  }

  setSVGRotation(angleDeg: number): void {
    if (!this.svgMesh) return;
    this.svgMesh.rotation.y = (angleDeg * Math.PI) / 180;
  }

  resetSVGPosition(): void {
    if (!this.svgMesh) return;
    this.svgMesh.position.x = 0;
    this.svgMesh.position.z = 0;
  }

  private updatePointer(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 || !this.svgMesh) return;

    this.updatePointer(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const intersects = this.raycaster.intersectObject(this.svgMesh);
    if (intersects.length > 0) {
      this.isDragging = true;
      this.controls.enabled = false;
      this.canvas.style.cursor = 'grabbing';

      const hitPoint = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this.dragPlane, hitPoint);
      this.dragOffset.copy(this.svgMesh.position).sub(hitPoint);

      e.preventDefault();
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.svgMesh) return;

    this.updatePointer(e);

    if (this.isDragging) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hitPoint = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.dragPlane, hitPoint)) {
        this.svgMesh.position.x = hitPoint.x + this.dragOffset.x;
        this.svgMesh.position.z = hitPoint.z + this.dragOffset.z;
        this.onChange?.();
      }
    } else {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const intersects = this.raycaster.intersectObject(this.svgMesh);
      this.canvas.style.cursor = intersects.length > 0 ? 'grab' : '';
    }
  };

  private onPointerUp = (): void => {
    if (this.isDragging) {
      this.isDragging = false;
      this.controls.enabled = true;
      this.canvas.style.cursor = '';
    }
  };

  setSceneBackground(bgColor: number, gridColor: number, gridSubColor: number): void {
    this.scene.background = new THREE.Color(bgColor);
    this.scene.remove(this.grid);
    this.grid = new THREE.GridHelper(60, 30, gridColor, gridSubColor);
    this.scene.add(this.grid);
  }

  private handleResize(): void {
    const parent = this.renderer.domElement.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}
