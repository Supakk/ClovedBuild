// Isometric renderer for a HouseSpec (builder preview and catalogue pictures).
// The camera angle is fixed; the model turns in 90° steps.
import * as THREE from 'three';
import { disposeDiorama } from '../house/geometry';
import { buildSite, buildSpecHouse, floorY } from './build3d';
import { houseHeight, type HouseSpec } from './spec';
import { Spring, reducedMotion } from '../motion';

const DIR = new THREE.Vector3(1, 0.8, 1).normalize();

export class SpecStage {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 600);
  holder = new THREE.Group();
  model: THREE.Group | null = null;
  markers: { id: string; obj: THREE.Object3D }[] = [];
  private sun = new THREE.DirectionalLight('#FFF0DF', 6.4);
  private ext = { w: 20, d: 20, h: 8, cy: 2 };
  private focus = new THREE.Vector3();
  private rot = 0;
  private spin = new Spring(0);
  private last = 0;
  private w = 0;
  private h = 0;
  zoom = 1;
  dirty = true;

  constructor(canvas: HTMLCanvasElement, still = false) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: still });
    r.setPixelRatio(still ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.setClearColor(0x000000, 0);
    this.renderer = r;
    this.scene.add(new THREE.HemisphereLight('#FFF7F0', '#C9A089', 2.0));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03; this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight('#FFE2CC', 1.1); fill.position.set(30, 18, -12);
    this.scene.add(fill, this.holder);
  }

  /** site = draw the whole plot; otherwise only the house. */
  set(s: HouseSpec, opts: { cut?: number | null; sel?: string | null; site?: boolean } = {}) {
    if (this.model) { this.holder.remove(this.model); disposeDiorama(this.model); }
    this.markers = [];
    const o = { cut: opts.cut ?? null, sel: opts.sel ?? null, markers: this.markers, furniture: true };
    let house: THREE.Group;
    if (opts.site !== false) { const b = buildSite(s, o); this.model = b.group; house = b.house; this.ext = { w: s.site.plotW * 2, d: s.site.plotD * 2, h: Math.max(6, houseHeight(s)), cy: 1.5 }; }
    else { this.model = buildSpecHouse(s, o); house = this.model; this.ext = { w: s.w + 1, d: s.d + 1, h: floorY(s, s.floors) + 2, cy: floorY(s, s.floors) / 2 }; }
    this.holder.add(this.model);
    // When a floor is open, frame the house at that floor's height.
    this.focus.set(house.position.x, o.cut != null ? floorY(s, o.cut) + 0.5 : this.ext.cy, house.position.z);
    if (opts.site === false) this.focus.set(0, this.ext.cy, 0);
    const k = Math.max(this.ext.w, this.ext.d) * 0.75 + 12;
    this.sun.position.set(-0.25 * k, 1.5 * k, k);
    const sc = this.sun.shadow.camera, half = Math.max(this.ext.w, this.ext.d) / 2 + 6;
    Object.assign(sc, { left: -half, right: half, top: half, bottom: -half, near: 1, far: k * 4 });
    sc.updateProjectionMatrix();
    this.dirty = true;
    return this.model;
  }

  turn(step: number, instant = false) {
    this.rot += step;
    const to = (this.rot * Math.PI) / 2;
    if (instant || reducedMotion()) { this.spin.snap(to); this.holder.rotation.y = to; this.dirty = true; }
    else { this.spin.set(to); this.dirty = true; }
  }
  get facing() { return ((this.rot % 4) + 4) % 4; }

  private frame(W: number, H: number, focusFloor: boolean) {
    const a = W / H, { w, d, h } = this.ext;
    const diag = (w + d) / Math.SQRT2;
    let hw = (diag / 2) * 1.06, hh = ((diag * DIR.y) + h * 0.87) / 2 * 1.1;
    if (hw / hh > a) hh = hw / a; else hw = hh * a;
    Object.assign(this.cam, { left: -hw, right: hw, top: hh, bottom: -hh, zoom: this.zoom * (focusFloor ? 1.35 : 1) });
    this.cam.updateProjectionMatrix();
    const f = this.focus.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.holder.rotation.y);
    if (!focusFloor) f.set(0, this.ext.cy, 0);
    this.cam.position.copy(f).addScaledVector(DIR, 300);
    this.cam.lookAt(f);
  }

  /** Call every animation frame; renders only when something changed. Returns true if it rendered. */
  tick(canvas: HTMLCanvasElement, now: number, focusFloor = false) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H || !this.model) return false;
    if (W !== this.w || H !== this.h) { this.w = W; this.h = H; this.renderer.setSize(W, H, false); this.dirty = true; }
    const dt = this.last ? (now - this.last) / 1000 : 1 / 60;
    this.last = now;
    if (this.spin.step(dt)) { this.holder.rotation.y = this.spin.x; this.dirty = true; }
    else if (this.holder.rotation.y !== this.spin.x) { this.holder.rotation.y = this.spin.x; this.dirty = true; }
    if (!this.dirty) return false;
    this.dirty = false;
    this.frame(W, H, focusFloor);
    this.renderer.render(this.scene, this.cam);
    return true;
  }

  shot(s: HouseSpec, W: number, H: number, site = true, rot = 0) {
    this.set(s, { site });
    this.holder.rotation.y = (rot * Math.PI) / 2;
    this.renderer.setSize(W, H, false); this.w = W; this.h = H;
    this.frame(W, H, false);
    this.renderer.render(this.scene, this.cam);
    return this.renderer.domElement.toDataURL('image/png');
  }

  project(o: THREE.Object3D, v = new THREE.Vector3()) {
    o.getWorldPosition(v).project(this.cam);
    return { x: ((v.x + 1) / 2) * this.w, y: ((1 - v.y) / 2) * this.h };
  }

  dispose() { if (this.model) disposeDiorama(this.model); this.renderer.dispose(); this.renderer.forceContextLoss(); }
}
