// Fixed isometric camera; only the diorama turns.
import * as THREE from 'three';
import { buildDiorama, disposeDiorama, HOUSE_OFFSET } from './geometry';
import type { Design, ViewMode, FloorKey } from './data';

export class Stage {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);
  holder = new THREE.Group();
  diorama: THREE.Group | null = null;
  /** Floor to zoom on while it is opened; null shows the whole diorama. */
  focus: FloorKey | null = null;
  private target = new THREE.Vector3(0, 1.9, 0);
  private dir = new THREE.Vector3(1, 0.8, 1).normalize();
  private w = 0;
  private h = 0;

  constructor(canvas: HTMLCanvasElement, still = false) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: still });
    r.setPixelRatio(still ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.setClearColor(0x000000, 0);
    this.renderer = r;

    this.scene.add(new THREE.HemisphereLight('#FFF7F0', '#C9A089', 2.0));
    const sun = new THREE.DirectionalLight('#FFF0DF', 6.6);
    sun.position.set(-2.5, 15, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -11; sc.right = 11; sc.top = 11; sc.bottom = -11; sc.near = 1; sc.far = 50;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
    this.scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight('#FFE2CC', 1.1);
    fill.position.set(10, 6, -4);
    this.scene.add(fill, this.holder);
  }

  set(state: Design, mode: ViewMode, sel: string | null) {
    if (this.diorama) { this.holder.remove(this.diorama); disposeDiorama(this.diorama); }
    this.diorama = buildDiorama(state, mode, sel);
    this.holder.add(this.diorama);
    return this.diorama;
  }

  private frame(W: number, H: number) {
    const a = W / H, halfH = a >= 1.3 ? 6.75 : 8.75 / a;
    Object.assign(this.cam, { left: -halfH * a, right: halfH * a, top: halfH, bottom: -halfH });
    this.cam.updateProjectionMatrix();
  }

  /** Returns true when the size changed. */
  size(W: number, H: number) {
    if (W === this.w && H === this.h) return false;
    this.w = W; this.h = H;
    this.renderer.setSize(W, H, false);
    this.frame(W, H);
    return true;
  }

  render() {
    const f = this.focus, zoom = f ? 1.38 : 1, tg = this.target.clone();
    if (f) {
      const a = this.holder.rotation.y, { x: hx, z: hz } = HOUSE_OFFSET;
      tg.set(hx * Math.cos(a) + hz * Math.sin(a), f === 'g' ? 0.6 : 3.4, -hx * Math.sin(a) + hz * Math.cos(a));
    }
    this.cam.position.copy(tg).addScaledVector(this.dir, 70);
    this.cam.lookAt(tg);
    if (this.cam.zoom !== zoom) { this.cam.zoom = zoom; this.cam.updateProjectionMatrix(); }
    this.renderer.render(this.scene, this.cam);
  }

  /** Renders one picture and returns it as a PNG data URL (needs a `still` stage). */
  shot(state: Design, mode: ViewMode, rot: number, W: number, H: number) {
    this.focus = null;
    this.set(state, mode, null);
    this.holder.rotation.y = (rot * Math.PI) / 2;
    this.size(W, H);
    this.render();
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose() {
    if (this.diorama) disposeDiorama(this.diorama);
    this.renderer.dispose();
  }
}

export function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
