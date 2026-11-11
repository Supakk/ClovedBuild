// Simulator engine: the plot, its grid, every object, the two cameras and pointer handling.
// React talks to it through methods; it reports back through the callbacks in WorldEvents.
import * as THREE from 'three';
import { disposeDiorama } from '../house/geometry';
import { buildSpecHouse, floorY, roomPiece } from '../plan/build3d';
import { floorEdges, floorRect, presetSpec, type HouseSpec } from '../plan/spec';
import { tr } from '../i18n';
import { Spring, damp } from '../motion';
import { bushPiece, car, cat, dog, DOG_SIZES, lounger, patioSet, person, pool, treePiece } from './models';
import { CARRYABLE, LIVING, WAH, newId, kindLabel, houseFurniture, type Plot, type Scene, type SimObject, type TopFloor } from './types';

const WALL = 0.2;
const specOf = (o: SimObject): HouseSpec => o.props.spec ?? presetSpec('modern');

/** The 3D model for any simulator object. `cut` opens that floor of a house (Top view). */
export function buildObjectModel(o: SimObject, cut: number | null = null): THREE.Object3D {
  const p = o.props;
  switch (o.kind) {
    case 'house': return buildSpecHouse(specOf(o), { cut, furniture: false });
    case 'furn': return roomPiece(p.type, p.item, p.w, p.d, p.variant).group;
    case 'tree': return treePiece(p.scale ?? 1, p.variant ?? 0);
    case 'bush': return bushPiece(p.variant ?? 0);
    case 'patio': return patioSet();
    case 'pool': return pool();
    case 'lounger': return lounger();
    case 'car': return car(p.color);
    case 'person': return person(p.height, p.shirt);
    case 'dog': return dog(p.size, p.coat);
    case 'cat': return cat(p.coat);
  }
}

export type View = 'iso' | 'top';

export interface WorldEvents {
  onSelect: (id: string | null) => void;
  /** Called after any edit that should be saved or undone. */
  onChange: () => void;
  onHint: (msg: string) => void;
  /** The view changed by itself (dragging in 3D switches to Top view). */
  onView: (v: View) => void;
}

interface Footprint { x0: number; x1: number; z0: number; z1: number }
interface Entry { obj: SimObject; node: THREE.Group; model: THREE.Object3D; fp: Footprint; top: number; label?: HTMLDivElement; /** just created: find it a free spot */ fresh?: boolean }
type Box = { x0: number; x1: number; z0: number; z1: number };
/** Pieces that sit on, under or around others and never block them. */
const SOFT_ITEMS = new Set(['rug', 'nightstands', 'uppers', 'pendant', 'lamp']);
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
/** Solid stretches of the inside walls of one floor, in house-centred metres. */
type WallSeg = { kind: 'box'; b: Box } | { kind: 'pts'; pts: { x: number; z: number }[] };
const wallCache = new WeakMap<HouseSpec, Map<number, WallSeg[]>>();
function wallSegs(s: HouseSpec, fi: number): WallSeg[] {
  let m = wallCache.get(s);
  if (!m) { m = new Map(); wallCache.set(s, m); }
  const hit = m.get(fi);
  if (hit) return hit;
  const out: WallSeg[] = [];
  const ox = -s.w / 2, oz = -s.d / 2, ht = 0.06;
  for (const e of floorEdges(s, fi).edges) {
    if (e.room.type === 'undercroft' || e.room.type === 'carport' || e.room.type === 'terrace' && !e.perimeter) continue;
    if (e.perimeter && e.axis !== 'd') continue; // outer walls: handled by clamping to the floor
    const gaps = e.holes.filter((h) => h.kind === 'door' || h.kind === 'open' || h.kind === 'front').sort((a, b) => a.a0 - b.a0);
    const solid: [number, number][] = [];
    let cur = e.a0;
    for (const g of gaps) { if (g.a0 > cur) solid.push([cur, g.a0]); cur = Math.max(cur, g.a1); }
    if (e.a1 > cur) solid.push([cur, e.a1]);
    for (const [a, b] of solid) {
      if (b - a < 0.05) continue;
      if (e.axis === 'x') out.push({ kind: 'box', b: { x0: a + ox, x1: b + ox, z0: e.fixed + oz - ht, z1: e.fixed + oz + ht } });
      else if (e.axis === 'z') out.push({ kind: 'box', b: { x0: e.fixed + ox - ht, x1: e.fixed + ox + ht, z0: a + oz, z1: b + oz } });
      else {
        const L = e.a1, ux = (e.p1.x - e.p0.x) / L, uz = (e.p1.z - e.p0.z) / L, pts: { x: number; z: number }[] = [];
        for (let t = a; t <= b + 1e-6; t += 0.1) pts.push({ x: e.p0.x + ux * t + ox, z: e.p0.z + uz * t + oz });
        out.push({ kind: 'pts', pts });
      }
    }
  }
  for (const q of (s.posts ?? []).filter((q) => q.floor === fi)) {
    const h = q.size / 2;
    out.push({ kind: 'box', b: { x0: q.x + ox - h, x1: q.x + ox + h, z0: q.z + oz - h, z1: q.z + oz + h } });
  }
  m.set(fi, out);
  return out;
}

const ACCENT = '#E9694B';
const ISO_DIR = new THREE.Vector3(1, 0.8, 1).normalize();
const SIN_E = ISO_DIR.y;

/** Rotate a local offset into the parent frame (same convention as Object3D.rotation.y). */
function rotXZ(x: number, z: number, r: number) {
  const c = Math.cos(r), s = Math.sin(r);
  return { x: x * c + z * s, z: -x * s + z * c };
}
/** Footprint bounds after rotating by r. */
function rotatedBounds(fp: Footprint, r: number) {
  const pts = [[fp.x0, fp.z0], [fp.x1, fp.z0], [fp.x0, fp.z1], [fp.x1, fp.z1]].map(([x, z]) => rotXZ(x, z, r));
  return {
    x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)),
    z0: Math.min(...pts.map((p) => p.z)), z1: Math.max(...pts.map((p) => p.z)),
  };
}
const clamp = (v: number, a: number, b: number) => (a > b ? (a + b) / 2 : Math.min(b, Math.max(a, v)));

export class SimWorld {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private holder = new THREE.Group();
  private plotLayer = new THREE.Group();
  private objLayer = new THREE.Group();
  private camIso = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 800);
  private camTop = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 800);
  private sun = new THREE.DirectionalLight('#FFF0DF', 6.4);
  private entries = new Map<string, Entry>();
  private ring: THREE.Object3D | null = null;
  private plotLabels: HTMLDivElement[] = [];

  plot: Plot = { w: 12, d: 9 };
  private _inset = 0;
  /** Height in px of a panel covering the bottom of the canvas. */
  get insetBottom() { return this._inset; }
  set insetBottom(v: number) { if (v !== this._inset) { this._inset = v; this.dirty = true; } }
  view: View = 'iso';
  topFloor: TopFloor = 0;
  snap = 0.5;
  selected: string | null = null;

  private rot = 0;
  private spin = new Spring(0);
  private last = 0;
  private center = new THREE.Vector2(0, 0);
  /** Where an animated recentre is heading (fit); null while the user pans by hand. */
  private centerGoal: THREE.Vector2 | null = null;
  private zoom: Record<View, number> = { iso: 1, top: 1 };
  private zoomGoal: Record<View, number> = { iso: 1, top: 1 };
  private dirty = true;
  private raf = 0;
  private w = 0;
  private h = 0;
  private reduceMotion = false;

  constructor(private canvas: HTMLCanvasElement, private labelsEl: HTMLElement, private ev: WorldEvents, private toolbar?: HTMLElement) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.setClearColor(0x000000, 0);
    this.renderer = r;
    this.reduceMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    this.scene.add(new THREE.HemisphereLight('#FFF7F0', '#C9A089', 2.0));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03; this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight('#FFE2CC', 1.1); fill.position.set(30, 18, -12);
    this.scene.add(fill);
    this.holder.add(this.plotLayer, this.objLayer);
    this.scene.add(this.holder);
    this.camTop.up.set(0, 0, -1);

    this.bindPointer();
    const loop = (now: number) => { this.raf = requestAnimationFrame(loop); this.frame(now); };
    this.raf = requestAnimationFrame(loop);
  }

  /** Re-writes on-canvas labels after the language changes. */
  relabel() {
    for (const e of this.entries.values()) this.updateLabelText(e);
    this.setPlot(this.plot, false);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.unbind?.();
    for (const e of this.entries.values()) disposeDiorama(e.model);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.labelsEl.innerHTML = '';
  }

  /* ---------------- scene I/O ---------------- */

  load(scene: Scene, keepView = false) {
    for (const e of this.entries.values()) { disposeDiorama(e.model); e.label?.remove(); }
    this.entries.clear();
    this.objLayer.clear();
    this.ring = null;
    this.selected = null;
    this.setPlot(scene.plot, false);
    const houses = scene.objects.filter((o) => o.kind === 'house');
    for (const o of houses) this.createEntry(structuredClone(o));
    for (const o of scene.objects) if (o.kind !== 'house') this.createEntry(structuredClone(o));
    if (!keepView) this.fit();
    this.ev.onSelect(null);
  }

  toScene(): Scene {
    return { plot: { ...this.plot }, objects: [...this.entries.values()].map((e) => structuredClone(e.obj)) };
  }

  get(id: string) { return this.entries.get(id)?.obj; }

  /** Where an object is, for the inspector. */
  describe(id: string) {
    const e = this.entries.get(id);
    if (!e) return null;
    const p = this.plotPos(e);
    const xw = (p.x + (this.plot.w * WAH) / 2) / WAH, zw = (p.z + (this.plot.d * WAH) / 2) / WAH;
    const house = e.obj.parent ? this.entries.get(e.obj.parent) : null;
    const where = house ? tr(`Inside ${kindLabel(house.obj)}, ${e.obj.floor ? `floor ${e.obj.floor + 1}` : 'ground floor'}`, `ใน${kindLabel(house.obj)} ${e.obj.floor ? `ชั้น ${e.obj.floor + 1}` : 'ชั้นล่าง'}`) : tr('On the plot', 'บนที่ดิน');
    const b = rotatedBounds(e.fp, e.obj.rot);
    return { where, xw, zw, sizeX: b.x1 - b.x0, sizeZ: b.z1 - b.z0 };
  }

  /* ---------------- building objects ---------------- */

  /** Floor opened on a house in the current view, or null for the whole house. */
  private cutFor(o: SimObject) {
    if (this.view !== 'top' || this.topFloor === 'x') return null;
    return Math.min(this.topFloor, specOf(o).floors - 1);
  }
  private buildModel(o: SimObject) { return buildObjectModel(o, o.kind === 'house' ? this.cutFor(o) : null); }

  private footprintOf(model: THREE.Object3D): Footprint & { top: number } {
    model.updateWorldMatrix(false, true);
    const b = new THREE.Box3().setFromObject(model);
    return { x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z, top: b.max.y };
  }

  private createEntry(o: SimObject) {
    const node = new THREE.Group();
    node.userData.objId = o.id;
    const model = this.buildModel(o);
    node.add(model);
    const fp = this.footprintOf(model);
    const e: Entry = { obj: o, node, model, fp, top: fp.top };
    if (LIVING.includes(o.kind)) {
      e.label = document.createElement('div');
      e.label.className = 'sim-tag';
      this.labelsEl.appendChild(e.label);
      this.updateLabelText(e);
    }
    this.entries.set(o.id, e);
    this.place(e);
    return e;
  }

  private updateLabelText(e: Entry) {
    if (!e.label) return;
    const o = e.obj;
    e.label.textContent = o.kind === 'person' ? `${o.props.name || kindLabel(o)} · ${Math.round(o.props.height)} ${tr('cm', 'ซม.')}` : (o.props.name || kindLabel(o));
  }

  /** Puts the node under the right parent at the right height. */
  private place(e: Entry) {
    const o = e.obj;
    const house = o.parent ? this.entries.get(o.parent) : undefined;
    if (o.parent && !house) { delete o.parent; delete o.floor; }
    const parent = house ? house.node : this.objLayer;
    if (e.node.parent !== parent) parent.add(e.node);
    if (house && (o.floor ?? 0) > specOf(house.obj).floors - 1) o.floor = specOf(house.obj).floors - 1;
    const y = house ? floorY(specOf(house.obj), o.floor ?? 0) + 0.03 : 0;
    e.node.position.set(o.x, y, o.z);
    e.node.rotation.y = o.rot;
    e.node.visible = this.isShown(o);
    this.dirty = true;
  }

  private isShown(o: SimObject) {
    if (!o.parent || this.view !== 'top' || this.topFloor === 'x') return true;
    // From above, only the open floor's contents are shown.
    const house = this.entries.get(o.parent);
    const cut = house ? this.cutFor(house.obj) : null;
    return cut == null || (o.floor ?? 0) === cut;
  }

  private rebuildModel(e: Entry) {
    e.node.remove(e.model);
    disposeDiorama(e.model);
    e.model = this.buildModel(e.obj);
    e.node.add(e.model);
    const f = this.footprintOf(e.model); e.fp = f; e.top = f.top;
    if (this.selected === e.obj.id) this.drawRing();
    this.updateLabelText(e);
    this.dirty = true;
  }

  /** Position of an object in plot coordinates (metres, plot centre = 0). */
  private plotPos(e: Entry) {
    const o = e.obj;
    const house = o.parent ? this.entries.get(o.parent) : undefined;
    if (!house) return { x: o.x, z: o.z, rot: o.rot };
    const r = rotXZ(o.x, o.z, house.obj.rot);
    return { x: house.obj.x + r.x, z: house.obj.z + r.z, rot: o.rot + house.obj.rot };
  }

  /* ---------------- editing ---------------- */

  /** Adds an object in the middle of the view, or at a plot position. */
  add(base: Omit<SimObject, 'id' | 'x' | 'z'>, at?: { x: number; z: number }, notify = true) {
    const c = at ?? this.holder.worldToLocal(new THREE.Vector3(this.center.x, 0, this.center.y));
    const o: SimObject = { ...structuredClone(base), id: newId(base.kind), x: c.x, z: c.z };
    const e = this.createEntry(o);
    e.fresh = true;
    if (!this.reduceMotion) { this.pops.set(e, performance.now()); e.model.scale.setScalar(0.01); }
    if (o.kind === 'house') {
      // A new house comes furnished.
      for (const f of houseFurniture(o.id, specOf(o))) this.createEntry(f);
      this.settle(e, o.x, o.z, true);
    } else this.dragTo(e, o.x, o.z);
    this.select(o.id);
    if (notify) this.ev.onChange();
    return o.id;
  }

  /* Dragging something in from the catalogue. */
  private ext: { e: Entry } | null = null;
  private pops = new Map<Entry, number>();
  /** Creates the object under the pointer and starts dragging it. Returns false if the pointer is off the plot. */
  spawnAt(base: Omit<SimObject, 'id' | 'x' | 'z'>, clientX: number, clientY: number) {
    const g = this.groundPoint({ clientX, clientY });
    if (!g) return false;
    const id = this.add(base, { x: g.x, z: g.z }, false);
    this.ext = { e: this.entries.get(id)! };
    return true;
  }
  dragExternal(clientX: number, clientY: number) {
    if (!this.ext) return;
    const g = this.groundPoint({ clientX, clientY });
    if (g) this.dragTo(this.ext.e, g.x, g.z);
  }
  endExternal() {
    if (!this.ext) return;
    this.ext = null;
    this.ev.onChange();
  }

  update(id: string, props: Record<string, any>) {
    const e = this.entries.get(id);
    if (!e) return;
    e.obj.props = { ...e.obj.props, ...props };
    this.rebuildModel(e);
    if (e.obj.kind === 'house') this.settle(e, e.obj.x, e.obj.z);
    this.ev.onChange();
  }

  /** Swaps a house for another design; its furniture is replaced, people and pets stay. */
  setHouseSpec(id: string, spec: HouseSpec) {
    const e = this.entries.get(id);
    if (!e || e.obj.kind !== 'house') return;
    e.obj.props = { ...e.obj.props, spec };
    for (const c of [...this.entries.values()].filter((c) => c.obj.parent === id && c.obj.kind === 'furn')) this.drop(c);
    this.rebuildModel(e);
    for (const f of houseFurniture(id, spec)) this.createEntry(f);
    for (const c of [...this.entries.values()].filter((c) => c.obj.parent === id)) this.settle(c, c.obj.x, c.obj.z);
    this.settle(e, e.obj.x, e.obj.z);
    this.ev.onChange();
  }

  /** Most floors of any house on the plot. */
  maxFloors() {
    let n = 1;
    for (const e of this.entries.values()) if (e.obj.kind === 'house') n = Math.max(n, specOf(e.obj).floors);
    return n;
  }

  remove(id: string) {
    const e = this.entries.get(id);
    if (!e) return;
    if (e.obj.kind === 'house') {
      for (const c of [...this.entries.values()].filter((c) => c.obj.parent === id)) {
        if (LIVING.includes(c.obj.kind)) {
          // People and pets step out onto the plot instead of disappearing with the house.
          const p = this.plotPos(c);
          delete c.obj.parent; delete c.obj.floor;
          Object.assign(c.obj, { x: p.x, z: p.z, rot: p.rot });
          this.objLayer.add(c.node);
          this.settle(c, p.x, p.z);
        } else this.drop(c);
      }
    }
    this.drop(e);
    if (this.selected === id) this.select(null);
    this.ev.onChange();
  }

  private drop(e: Entry) {
    e.node.parent?.remove(e.node);
    disposeDiorama(e.model);
    e.label?.remove();
    this.entries.delete(e.obj.id);
    this.dirty = true;
  }

  duplicate(id: string) {
    const e = this.entries.get(id);
    if (!e) return;
    const shift = e.obj.kind === 'house' ? 4 : 0.6;
    const copy: SimObject = { ...structuredClone(e.obj), id: newId(e.obj.kind), x: e.obj.x + shift, z: e.obj.z + shift };
    const ne = this.createEntry(copy);
    if (e.obj.kind === 'house') {
      for (const c of [...this.entries.values()].filter((c) => c.obj.parent === id)) {
        this.createEntry({ ...structuredClone(c.obj), id: newId(c.obj.kind), parent: copy.id });
      }
    }
    ne.fresh = true;
    this.settle(ne, copy.x, copy.z, true);
    this.select(copy.id);
    this.ev.onChange();
  }

  rotateSelected(dir: 1 | -1) {
    const e = this.selected ? this.entries.get(this.selected) : null;
    if (!e) return;
    const step = LIVING.includes(e.obj.kind) || e.obj.kind === 'tree' ? Math.PI / 4 : Math.PI / 2;
    const before = e.obj.rot, ignore = this.overlapping(e);
    e.obj.rot = Math.round((e.obj.rot + dir * step) / (Math.PI / 4)) * (Math.PI / 4);
    if (this.collide && this.blocker(e, e.obj.x, e.obj.z, ignore)) {
      // Turning would hit something: try nudging it clear first.
      const why = this.blocker(e, e.obj.x, e.obj.z, ignore)!;
      const spots = [[0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]];
      const ok = spots.find(([dx, dz]) => !this.blocker(e, e.obj.x + dx, e.obj.z + dz, ignore));
      if (ok) { e.obj.x += ok[0]; e.obj.z += ok[1]; } else { e.obj.rot = before; this.blockedHint(why); }
    }
    this.settle(e, e.obj.x, e.obj.z);
    this.ev.onChange();
  }

  /** Moves the selected object by one snap step (arrow keys, top view only). */
  nudge(dx: number, dz: number) {
    const e = this.selected ? this.entries.get(this.selected) : null;
    if (!e || this.view !== 'top') return;
    const s = LIVING.includes(e.obj.kind) ? 0.25 : Math.max(this.snap, 0.25);
    const p = this.plotPos(e);
    this.dragTo(e, p.x + dx * s, p.z + dz * s);
    this.ev.onChange();
  }

  /** Things can't overlap each other or pass through walls. */
  collide = true;
  private hintAt = 0;
  private boxAt(e: Entry, x: number, z: number, rot = e.obj.rot): Box {
    const b = rotatedBounds(e.fp, rot), k = 0.03; // a hair of slack so neighbours can touch
    return { x0: x + b.x0 + k, x1: x + b.x1 - k, z0: z + b.z0 + k, z1: z + b.z1 - k };
  }
  private soft(o: SimObject) { return o.kind === 'furn' && SOFT_ITEMS.has(o.props.item); }
  /** What blocks entry `e` standing at (x, z) in its current frame, or null. */
  private blocker(e: Entry, x: number, z: number, ignore?: Set<string>): string | null {
    const o = e.obj;
    if (this.soft(o)) return null;
    const box = this.boxAt(e, x, z);
    const living = LIVING.includes(o.kind);
    const house = o.parent ? this.entries.get(o.parent) : undefined;
    // Walls inside a house
    if (house) {
      for (const w of wallSegs(specOf(house.obj), o.floor ?? 0)) {
        if (w.kind === 'box' ? overlaps(box, w.b) : w.pts.some((p) => p.x > box.x0 && p.x < box.x1 && p.z > box.z0 && p.z < box.z1)) return 'wall';
      }
    }
    if (living) return null; // people and pets may stand close to furniture and each other
    for (const c of this.entries.values()) {
      const q = c.obj;
      if (c === e || ignore?.has(q.id) || this.soft(q) || LIVING.includes(q.kind)) continue;
      if ((q.parent ?? '') !== (o.parent ?? '')) continue;
      if (o.parent && (q.floor ?? 0) !== (o.floor ?? 0)) continue;
      // Out on the plot, small things only clash with houses when they are not being carried in.
      if (!o.parent && o.kind === 'house' && CARRYABLE.includes(q.kind)) continue;
      if (overlaps(box, this.boxAt(c, q.x, q.z))) return q.kind === 'house' ? 'house' : q.id;
    }
    return null;
  }
  private overlapping(e: Entry) {
    const s = new Set<string>();
    const box = this.boxAt(e, e.obj.x, e.obj.z);
    for (const c of this.entries.values()) {
      if (c === e || (c.obj.parent ?? '') !== (e.obj.parent ?? '') || (c.obj.floor ?? 0) !== (e.obj.floor ?? 0)) continue;
      if (overlaps(box, this.boxAt(c, c.obj.x, c.obj.z))) s.add(c.obj.id);
    }
    return s;
  }
  private blockedHint(why: string) {
    const now = performance.now();
    if (now - this.hintAt < 2500) return;
    this.hintAt = now;
    this.ev.onHint(why === 'wall' ? tr('Blocked by a wall: go round through a door', 'ติดผนัง: เดินอ้อมผ่านประตู') : tr('No room there: things can’t overlap', 'วางทับกันไม่ได้'));
  }

  /** Snap and clamp an object at a position in its current frame. `move` = a user move that must not collide. */
  private settle(e: Entry, x: number, z: number, move = false, sameFrame = true) {
    const o = e.obj;
    const b = rotatedBounds(e.fp, o.rot);
    const free = LIVING.includes(o.kind) || this.snap === 0;
    const sn = (v: number, m: number) => (free ? v : Math.round((v + m) / this.snap) * this.snap - m);
    const house = o.parent ? this.entries.get(o.parent) : undefined;
    let bx0: number, bx1: number, bz0: number, bz1: number;
    if (house) {
      const sp = specOf(house.obj), fr = floorRect(sp, o.floor ?? 0);
      bx0 = fr.x - sp.w / 2 + WALL; bx1 = fr.x + fr.w - sp.w / 2 - WALL; bz0 = fr.z - sp.d / 2 + WALL; bz1 = fr.z + fr.d - sp.d / 2 - WALL;
    } else {
      const hw = (this.plot.w * WAH) / 2, hd = (this.plot.d * WAH) / 2;
      bx0 = -hw; bx1 = hw; bz0 = -hd; bz1 = hd;
    }
    const fit = (vx: number, vz: number) => ({ x: clamp(sn(vx, b.x0), bx0 - b.x0, bx1 - b.x1), z: clamp(sn(vz, b.z0), bz0 - b.z0, bz1 - b.z1) });
    let p = fit(x, z);
    if (move && this.collide) {
      let fresh = e.fresh || !sameFrame;
      const ignore = fresh ? undefined : this.overlapping(e);
      // Already stuck in a wall (an old saved plot): let it pop out to the nearest free spot.
      if (!fresh && this.blocker(e, o.x, o.z, ignore)) fresh = true;
      let why = this.blocker(e, p.x, p.z, ignore);
      if (!fresh) {
        // Sweep from where it is to where it should go, one axis at a time, so it slides along
        // whatever is in the way and can never jump through a wall or another piece.
        const sweep = (ax: number, az: number, bx: number, bz: number) => {
          const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.05);
          let last = { x: ax, z: az };
          for (let i = 1; i <= n; i++) {
            const q = { x: ax + ((bx - ax) * i) / n, z: az + ((bz - az) * i) / n };
            const w = this.blocker(e, q.x, q.z, ignore);
            if (w) { why = w; break; }
            last = q;
          }
          return last;
        };
        const target = p;
        why = null;
        const a = sweep(o.x, o.z, target.x, o.z);
        p = sweep(a.x, a.z, a.x, target.z);
        if (Math.abs(p.x - target.x) > 1e-6 || Math.abs(p.z - target.z) > 1e-6) {
          // Blocked one way round: try the other order (z first) before giving up.
          const b2 = sweep(o.x, o.z, o.x, target.z), p2 = sweep(b2.x, b2.z, target.x, b2.z);
          if (Math.hypot(p2.x - target.x, p2.z - target.z) < Math.hypot(p.x - target.x, p.z - target.z)) p = p2;
        } else why = null;
        if (why) this.blockedHint(why);
      } else if (why) {
        {
          // A new or carried-in object: the nearest free spot, spiralling out.
          const st = Math.max(0.25, free ? 0.25 : this.snap);
          let best: { x: number; z: number } | null = null;
          for (let r = 1; r <= 24 && !best; r++) {
            let bd = Infinity;
            for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
              if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
              const t = fit(p.x + i * st, p.z + j * st);
              const d = Math.hypot(t.x - p.x, t.z - p.z);
              if (d < bd && !this.blocker(e, t.x, t.z)) { bd = d; best = t; }
            }
          }
          if (best) p = best;
        }
        this.blockedHint(why);
      }
      e.fresh = false;
    }
    o.x = p.x; o.z = p.z;
    this.place(e);
  }

  /** Drag target in plot coordinates; carries small objects in and out of houses. */
  private dragTo(e: Entry, px: number, pz: number) {
    const o = e.obj;
    let target: Entry | null = null, lx = 0, lz = 0;
    if (CARRYABLE.includes(o.kind)) {
      for (const h of this.entries.values()) {
        if (h.obj.kind !== 'house') continue;
        const r = rotXZ(px - h.obj.x, pz - h.obj.z, -h.obj.rot), sp = specOf(h.obj);
        if (Math.abs(r.x) < sp.w / 2 - WALL && Math.abs(r.z) < sp.d / 2 - WALL) { target = h; lx = r.x; lz = r.z; break; }
      }
    }
    const old = o.parent ? this.entries.get(o.parent) : null;
    if (target) {
      const floor = this.cutFor(target.obj) ?? 0;
      const same = old === target && (o.floor ?? 0) === floor;
      if (old !== target) o.rot -= target.obj.rot - (old ? old.obj.rot : 0);
      o.parent = target.obj.id; o.floor = floor;
      this.settle(e, lx, lz, true, same);
    } else {
      const same = !old;
      if (old) { o.rot += old.obj.rot; delete o.parent; delete o.floor; }
      this.settle(e, px, pz, true, same);
    }
  }

  select(id: string | null) {
    this.selected = id && this.entries.has(id) ? id : null;
    this.drawRing();
    this.ev.onSelect(this.selected);
  }

  private drawRing() {
    if (this.ring) { this.ring.parent?.remove(this.ring); this.ring.traverse((o: any) => { o.geometry?.dispose(); o.material?.dispose(); }); this.ring = null; }
    const e = this.selected ? this.entries.get(this.selected) : null;
    if (!e) { this.dirty = true; return; }
    const { x0, x1, z0, z1 } = e.fp, pad = 0.15;
    const g = new THREE.Group();
    const pts = [[x0 - pad, z0 - pad], [x1 + pad, z0 - pad], [x1 + pad, z1 + pad], [x0 - pad, z1 + pad]].map(([x, z]) => new THREE.Vector3(x, 0.04, z));
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: ACCENT, depthTest: false, transparent: true }));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + pad * 2, z1 - z0 + pad * 2), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.16, depthTest: false }));
    fill.rotation.x = -Math.PI / 2; fill.position.set((x0 + x1) / 2, 0.03, (z0 + z1) / 2);
    line.renderOrder = fill.renderOrder = 20;
    g.add(fill, line);
    g.traverse((o) => { o.raycast = () => {}; });
    e.node.add(g);
    this.ring = g;
    this.dirty = true;
  }

  /* ---------------- plot ---------------- */

  setPlot(p: Plot, notify = true) {
    const r2 = (v: number) => Math.max(4, Math.min(60, Math.round(v * 2) / 2));
    this.plot = { w: r2(p.w), d: r2(p.d) };
    for (const c of this.plotLayer.children) c.traverse((o: any) => { o.geometry?.dispose(); o.material?.dispose(); });
    this.plotLayer.clear();
    const Wm = this.plot.w * WAH, Dm = this.plot.d * WAH;

    const base = new THREE.Mesh(new THREE.BoxGeometry(Wm + 0.8, 0.7, Dm + 0.8), new THREE.MeshStandardMaterial({ color: '#30343A', roughness: 0.7 }));
    base.position.y = -0.45; base.receiveShadow = true;
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(Wm + 0.7, 0.12, Dm + 0.7), new THREE.MeshStandardMaterial({ color: '#F2EEE8', roughness: 0.9 }));
    kerb.position.y = -0.07; kerb.receiveShadow = true;
    const grass = new THREE.Mesh(new THREE.BoxGeometry(Wm, 0.1, Dm), new THREE.MeshStandardMaterial({ color: '#97B865', roughness: 1 }));
    grass.position.y = -0.04; grass.receiveShadow = true;
    this.plotLayer.add(base, kerb, grass);

    // Grid: one cell = 1 wah x 1 wah = 1 square wah. Every fifth line is a little stronger.
    const minor: number[] = [], major: number[] = [], y = 0.015;
    for (let i = 0; i <= Math.floor(this.plot.w); i++) { const x = -Wm / 2 + i * WAH; (i % 5 === 0 ? major : minor).push(x, y, -Dm / 2, x, y, Dm / 2); }
    for (let j = 0; j <= Math.floor(this.plot.d); j++) { const z = -Dm / 2 + j * WAH; (j % 5 === 0 ? major : minor).push(-Wm / 2, y, z, Wm / 2, y, z); }
    const mk = (arr: number[], opacity: number) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#2F4A1E', transparent: true, opacity, depthWrite: false }));
    };
    this.plotLayer.add(mk(minor, 0.22), mk(major, 0.42));
    const edge = [[-Wm / 2, -Dm / 2], [Wm / 2, -Dm / 2], [Wm / 2, Dm / 2], [-Wm / 2, Dm / 2]].map(([x, z]) => new THREE.Vector3(x, 0.02, z));
    this.plotLayer.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(edge), new THREE.LineBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.9 })));

    // Sun and shadow area follow the plot size.
    const k = Math.max(Wm, Dm) * 0.75 + 12;
    this.sun.position.set(-0.25 * k, 1.5 * k, k);
    const sc = this.sun.shadow.camera, half = Math.max(Wm, Dm) / 2 + 8;
    Object.assign(sc, { left: -half, right: half, top: half, bottom: -half, near: 1, far: k * 4 });
    sc.updateProjectionMatrix();

    if (!this.plotLabels.length) {
      for (let i = 0; i < 2; i++) { const d = document.createElement('div'); d.className = 'sim-dim'; this.labelsEl.appendChild(d); this.plotLabels.push(d); }
    }
    this.plotLabels[0].textContent = tr(`${this.plot.w} wah · ${Wm} m`, `${this.plot.w} วา · ${Wm} ม.`);
    this.plotLabels[1].textContent = tr(`${this.plot.d} wah · ${Dm} m`, `${this.plot.d} วา · ${Dm} ม.`);

    if (notify) {
      for (const e of this.entries.values()) if (!e.obj.parent) this.settle(e, e.obj.x, e.obj.z);
      this.fit();
      this.ev.onChange();
    }
    this.dirty = true;
  }

  /* ---------------- views and camera ---------------- */

  /** A soft dip-and-settle on the canvas so switching views or floors never looks like a cut. */
  private morph() {
    if (this.reduceMotion || !this.canvas.animate) return;
    this.canvas.animate([{ opacity: 0.4, transform: 'scale(0.985)', filter: 'blur(2px)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  }

  setView(v: View) {
    if (v === this.view) return;
    this.view = v;
    this.morph();
    this.refreshHouses();
    this.ev.onView(v);
  }

  setTopFloor(f: TopFloor) {
    if (f !== this.topFloor && this.view === 'top') this.morph();
    this.topFloor = f;
    if (this.view === 'top') this.refreshHouses();
  }

  private refreshHouses() {
    for (const e of this.entries.values()) if (e.obj.kind === 'house') this.rebuildModel(e);
    for (const e of this.entries.values()) e.node.visible = this.isShown(e.obj);
    this.dirty = true;
  }

  /** Turns the whole plot by 90 degrees (the camera angle never changes). */
  turn(step: number) {
    this.rot += step;
    const to = (this.rot * Math.PI) / 2;
    if (this.reduceMotion) { this.spin.snap(to); this.holder.rotation.y = to; }
    else this.spin.set(to);
    this.dirty = true;
  }
  get facing() { return ((this.rot % 4) + 4) % 4; }

  /** Glides the zoom (buttons, wheel); the frame loop eases towards the goal. */
  zoomBy(f: number) {
    this.zoomGoal[this.view] = Math.min(8, Math.max(0.5, this.zoomGoal[this.view] * f));
    if (this.reduceMotion) this.zoom[this.view] = this.zoomGoal[this.view];
    this.dirty = true;
  }

  fit() {
    this.zoomGoal = { iso: 1, top: 1 };
    if (this.reduceMotion || !this.w) { this.center.set(0, 0); this.zoom = { iso: 1, top: 1 }; this.centerGoal = null; }
    else this.centerGoal = new THREE.Vector2(0, 0);
    this.dirty = true;
  }

  private frameCameras() {
    const W = this.w, H = this.h, a = W / H;
    const Wm = this.plot.w * WAH, Dm = this.plot.d * WAH;
    const fit = (cam: THREE.OrthographicCamera, hw: number, hh: number, zoom: number) => {
      if (hw / hh > a) hh = hw / a; else hw = hh * a;
      Object.assign(cam, { left: -hw, right: hw, top: hh, bottom: -hh, zoom });
      cam.updateProjectionMatrix();
    };
    const diag = (Wm + Dm) / Math.SQRT2;
    fit(this.camIso, diag / 2 * 1.08, (diag * SIN_E + 7) / 2 * 1.15, this.zoom.iso);
    const odd = this.facing % 2 === 1;
    fit(this.camTop, (odd ? Dm : Wm) / 2 + 2.5, (odd ? Wm : Dm) / 2 + 2.5, this.zoom.top);

    const t = new THREE.Vector3(this.center.x, 1.2, this.center.y);
    this.camIso.position.copy(t).addScaledVector(ISO_DIR, 300); this.camIso.lookAt(t);
    this.camTop.position.set(this.center.x, 300, this.center.y); this.camTop.lookAt(this.center.x, 0, this.center.y);
    // Keep the land centred in the part of the screen not covered by a bottom panel.
    if (this.insetBottom > 0) for (const cam of [this.camIso, this.camTop]) {
      const wpp = (cam.right - cam.left) / cam.zoom / W;
      cam.position.addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion), -(this.insetBottom / 2) * wpp);
    }
    this.camIso.updateMatrixWorld(); this.camTop.updateMatrixWorld();
    this.holder.updateMatrixWorld();
  }

  private get cam() { return this.view === 'top' ? this.camTop : this.camIso; }

  private frame(now: number) {
    const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    if (!W || !H) return;
    if (W !== this.w || H !== this.h) { this.w = W; this.h = H; this.renderer.setSize(W, H, false); this.dirty = true; }
    const dt = this.last ? (now - this.last) / 1000 : 1 / 60;
    this.last = now;
    if (this.spin.step(dt) || this.holder.rotation.y !== this.spin.x) { this.holder.rotation.y = this.spin.x; this.dirty = true; }
    for (const v of ['iso', 'top'] as View[]) {
      const z = this.zoom[v], g = this.zoomGoal[v];
      if (Math.abs(z - g) > 1e-4) { this.zoom[v] = Math.abs(z - g) < 1e-3 ? g : damp(z, g, 14, dt); this.dirty = true; }
    }
    if (this.centerGoal) {
      const cg = this.centerGoal;
      this.center.set(damp(this.center.x, cg.x, 12, dt), damp(this.center.y, cg.y, 12, dt));
      if (this.center.distanceTo(cg) < 1e-3) { this.center.copy(cg); this.centerGoal = null; }
      this.dirty = true;
    }
    // New things pop in with a small overshoot.
    for (const [e, t0] of this.pops) {
      const t = Math.min(1, (now - t0) / 420), c = 1.7;
      const k = t >= 1 ? 1 : 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
      e.model.scale.setScalar(Math.max(0.01, k));
      if (t >= 1) this.pops.delete(e);
      this.dirty = true;
    }
    if (!this.dirty) return;
    this.dirty = false;
    this.frameCameras();
    this.renderer.render(this.scene, this.cam);
    this.placeLabels();
  }

  private v = new THREE.Vector3();
  private pxPerM() { const c = this.cam; return (this.w * c.zoom) / (c.right - c.left); }
  private toScreen(p: THREE.Vector3) {
    p.project(this.cam);
    return { x: ((p.x + 1) / 2) * this.w, y: ((1 - p.y) / 2) * this.h };
  }

  private placeLabels() {
    for (const e of this.entries.values()) {
      if (!e.label) continue;
      let shown = true;
      for (let n: THREE.Object3D | null = e.node; n; n = n.parent) if (!n.visible) { shown = false; break; }
      e.label.hidden = !shown;
      if (!shown) continue;
      const hgt = e.obj.kind === 'person' ? e.obj.props.height / 100 + 0.25 : e.obj.kind === 'dog' ? 0.85 * (DOG_SIZES[e.obj.props.size] ?? 1) : 0.6;
      e.node.localToWorld(this.v.set(0, hgt, 0));
      const s = this.toScreen(this.v);
      e.label.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      e.label.classList.toggle('on', e.obj.id === this.selected);
    }
    if (this.toolbar) {
      const e = this.selected ? this.entries.get(this.selected) : null;
      let shown = !!e && !this.ext;
      if (e) for (let n: THREE.Object3D | null = e.node; n; n = n.parent) if (!n.visible) shown = false;
      this.toolbar.hidden = !shown;
      if (e && shown) {
        e.node.localToWorld(this.v.set((e.fp.x0 + e.fp.x1) / 2, this.view === 'top' ? 0 : Math.min(e.top, 8), (e.fp.z0 + e.fp.z1) / 2));
        const s = this.toScreen(this.v);
        const yOff = this.view === 'top' ? -(e.fp.z1 - e.fp.z0) / 2 * this.pxPerM() - 14 : -18;
        this.toolbar.style.transform = `translate(${Math.min(this.w - 90, Math.max(90, s.x))}px, ${Math.max(44, s.y + yOff)}px) translate(-50%, -100%)`;
      }
    }
    const Wm = this.plot.w * WAH, Dm = this.plot.d * WAH;
    const anchors = [new THREE.Vector3(0, 0, Dm / 2 + 0.9), new THREE.Vector3(Wm / 2 + 0.9, 0, 0)];
    anchors.forEach((a, i) => {
      this.holder.localToWorld(a);
      const s = this.toScreen(a);
      this.plotLabels[i].style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`;
    });
  }

  /* ---------------- pointer ---------------- */

  private unbind?: () => void;
  private ray = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  private ndc(e: { clientX: number; clientY: number }) {
    const rc = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
  }

  private pick(e: PointerEvent): Entry | null {
    this.ray.setFromCamera(this.ndc(e), this.cam);
    for (const hit of this.ray.intersectObject(this.objLayer, true)) {
      let visible = true, id: string | null = null;
      for (let n: THREE.Object3D | null = hit.object; n; n = n.parent) {
        if (!n.visible) { visible = false; break; }
        if (!id && n.userData.objId) id = n.userData.objId;
      }
      if (visible && id) return this.entries.get(id) ?? null;
    }
    return null;
  }

  /** Pointer position on the ground, in plot coordinates. */
  private groundPoint(e: { clientX: number; clientY: number }) {
    if (!this.w) return null;
    this.frameCameras();
    this.ray.setFromCamera(this.ndc(e), this.cam);
    const p = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.ground, p)) return null;
    return this.holder.worldToLocal(p);
  }

  private bindPointer() {
    const c = this.canvas;
    const pts = new Map<number, { x: number; y: number }>();
    let mode: 'none' | 'drag' | 'pan' | 'pinch' = 'none';
    let start = { x: 0, y: 0 }, moved = false, downHit: Entry | null = null;
    let grab = { x: 0, z: 0 }, pinch = { d: 1, zoom: 1 };
    let hinted = false;

    const down = (e: PointerEvent) => {
      c.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: this.zoom[this.view] };
        mode = 'pinch';
        return;
      }
      start = { x: e.clientX, y: e.clientY }; moved = false;
      downHit = this.pick(e);
      if (this.view === 'top' && downHit) {
        const g = this.groundPoint(e), p = this.plotPos(downHit);
        if (g) { grab = { x: p.x - g.x, z: p.z - g.z }; mode = 'drag'; this.select(downHit.obj.id); c.style.cursor = 'grabbing'; return; }
      }
      mode = 'pan';
    };
    const move = (e: PointerEvent) => {
      const prev = pts.get(e.pointerId);
      if (prev) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (mode === 'pinch' && pts.size === 2) {
        const [a, b] = [...pts.values()];
        this.zoom[this.view] = this.zoomGoal[this.view] = Math.min(8, Math.max(0.5, pinch.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)));
        this.dirty = true;
        return;
      }
      if (!prev) {
        if (this.view === 'top') c.style.cursor = this.pick(e) ? 'grab' : 'default';
        return;
      }
      if (Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) > 5) moved = true;
      if (mode === 'drag' && downHit) {
        const g = this.groundPoint(e);
        if (g) this.dragTo(downHit, g.x + grab.x, g.z + grab.z);
      } else if (mode === 'pan' && moved && downHit && this.view === 'iso') {
        // Moving is done from above: dragging a thing in 3D flips to Top view and keeps dragging.
        this.setView('top');
        this.select(downHit.obj.id);
        grab = { x: 0, z: 0 };
        mode = 'drag'; c.style.cursor = 'grabbing';
        if (!hinted) { hinted = true; this.ev.onHint(tr('Switched to Top view while you move it.', 'สลับเป็นมุมบนขณะย้าย')); }
        const g = this.groundPoint(e);
        if (g) this.dragTo(downHit, g.x, g.z);
      } else if (mode === 'pan' && moved) {
        const cam = this.cam, wpp = (cam.right - cam.left) / cam.zoom / this.w;
        const dx = (e.clientX - prev.x) * wpp, dy = (e.clientY - prev.y) * wpp;
        this.centerGoal = null;
        if (this.view === 'top') { this.center.x -= dx; this.center.y -= dy; }
        else this.panIso(dx, dy);
        this.dirty = true;
      }
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (mode === 'pinch') { if (pts.size === 0) mode = 'none'; return; }
      if (mode === 'drag') { c.style.cursor = 'grab'; this.ev.onChange(); }
      else if (mode === 'pan' && !moved) this.select(downHit ? downHit.obj.id : null);
      mode = 'none'; downHit = null;
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); this.zoomBy(Math.exp(-e.deltaY * 0.0015)); };

    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', wheel, { passive: false });
    this.unbind = () => {
      c.removeEventListener('pointerdown', down);
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      c.removeEventListener('pointercancel', up);
      c.removeEventListener('wheel', wheel);
    };
  }

  /** Pan the isometric view by a screen delta given in world units.
   *  Screen right is (1,0,-1)/√2 on the ground; screen up is (-1,0,-1)/√2 stretched by 1/sin(elevation). */
  private panIso(dx: number, dy: number) {
    const k = Math.SQRT1_2;
    // Content follows the pointer, so the camera centre moves the other way.
    this.center.x -= dx * k;
    this.center.y += dx * k;
    this.center.x -= (dy / SIN_E) * k;
    this.center.y -= (dy / SIN_E) * k;
  }
}
