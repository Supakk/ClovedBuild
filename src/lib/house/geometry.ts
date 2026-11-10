// Builds the isometric diorama: platform, garden, house shell, rooms and furniture.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  PLAN, X0, X1, Z0, Z1, TE, TI, finOf,
  type Design, type FloorKey, type RoomState, type ViewMode, type Garden, type Side, type RoomDef, type RoomType,
} from './data';

type Mat = THREE.Material;
type Axis = 'x' | 'z';
interface MatOpts { r?: number; e?: string; ei?: number; op?: number; mt?: number }
interface Rect { x0: number; x1: number; z0: number; z1: number }
export interface Marker { id: string; obj: THREE.Object3D }

/** Material cache per diorama, so a rebuild can dispose everything it made. */
export class Kit {
  private cache = new Map<string, THREE.MeshStandardMaterial>();
  private list: Mat[] = [];
  m(hex: string, o: MatOpts = {}) {
    const r = o.r ?? 0.85;
    const k = [hex, r, o.e, o.op, o.mt].join('|');
    let mt = this.cache.get(k);
    if (!mt) {
      mt = new THREE.MeshStandardMaterial({ color: hex, roughness: r, metalness: o.mt ?? 0 });
      if (o.e) { mt.emissive = new THREE.Color(o.e); mt.emissiveIntensity = o.ei ?? 1; }
      if (o.op) { mt.transparent = true; mt.opacity = o.op; mt.depthWrite = false; }
      this.cache.set(k, mt);
      this.list.push(mt);
    }
    return mt;
  }
  own<T extends Mat>(mt: T) { this.list.push(mt); return mt; }
  dispose() { this.list.forEach((m) => m.dispose()); }
}

export function box(p: THREE.Object3D, w: number, h: number, d: number, mat: Mat, x: number, y: number, z: number, r = 0, cs = true) {
  const g = r ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.96) : new THREE.BoxGeometry(w, h, d);
  const o = new THREE.Mesh(g, mat);
  o.position.set(x, y, z); o.castShadow = cs; o.receiveShadow = true; p.add(o);
  return o;
}
export function cyl(p: THREE.Object3D, rt: number, rb: number, h: number, mat: Mat, x: number, y: number, z: number, seg = 18, cs = true) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  o.position.set(x, y, z); o.castShadow = cs; o.receiveShadow = true; p.add(o);
  return o;
}
export function sph(p: THREE.Object3D, r: number, mat: Mat, x: number, y: number, z: number, sy = 0) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  o.position.set(x, y, z); if (sy) o.scale.y = sy; o.castShadow = true; o.receiveShadow = true; p.add(o);
  return o;
}

/** Axis-aligned wall slab. Each side gets its own material so neighbouring rooms keep their own paint. */
export function seg(p: THREE.Object3D, axis: Axis, fixed: number, a0: number, a1: number, y0: number, h: number, t: number, mNeg: Mat, mPos: Mat, mCap: Mat) {
  const len = a1 - a0;
  if (len < 0.02 || h < 0.02) return;
  const g = axis === 'x' ? new THREE.BoxGeometry(len, h, t) : new THREE.BoxGeometry(t, h, len);
  const mats = axis === 'x' ? [mCap, mCap, mCap, mCap, mPos, mNeg] : [mPos, mNeg, mCap, mCap, mCap, mCap];
  const o = new THREE.Mesh(g, mats), c = (a0 + a1) / 2;
  if (axis === 'x') o.position.set(c, y0 + h / 2, fixed); else o.position.set(fixed, y0 + h / 2, c);
  worldUV(g, o.position);
  o.castShadow = true; o.receiveShadow = true; p.add(o);
}
/** UVs in metres from the box's place, so textured walls line up across segments. */
export function worldUV(g: THREE.BufferGeometry, at: THREE.Vector3) {
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), uv = g.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + at.x, y = pos.getY(i) + at.y, z = pos.getZ(i) + at.z;
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    if (ny > 0.5) uv.setXY(i, x, z); else if (nx > 0.5) uv.setXY(i, z, y); else uv.setXY(i, x, y);
  }
  uv.needsUpdate = true;
}
function along(p: THREE.Object3D, axis: Axis, fixed: number, w: number, h: number, t: number, m: Mat, a: number, y: number, cs = true) {
  return axis === 'x' ? box(p, w, h, t, m, a, y, fixed, 0, cs) : box(p, t, h, w, m, fixed, y, a, 0, cs);
}
export function glassRun(p: THREE.Object3D, axis: Axis, fixed: number, a0: number, a1: number, y0: number, h: number, K: Kit, frameHex: string) {
  const fr = K.m(frameHex, { r: 0.45 }), gl = K.m('#2C3B43', { r: 0.05, mt: 0.4, op: 0.5 });
  const len = a1 - a0, c = (a0 + a1) / 2, ft = 0.09;
  along(p, axis, fixed, len, 0.08, ft, fr, c, y0 + 0.04);
  along(p, axis, fixed, len, 0.08, ft, fr, c, y0 + h - 0.04);
  const n = Math.max(1, Math.round(len / 1.2));
  for (let i = 0; i <= n; i++) {
    const a = Math.min(a1 - 0.035, Math.max(a0 + 0.035, a0 + (len * i) / n));
    along(p, axis, fixed, 0.07, h, ft, fr, a, y0 + h / 2);
  }
  along(p, axis, fixed, len, h - 0.1, 0.025, gl, c, y0 + h / 2, false);
}
function windowWall(p: THREE.Object3D, axis: Axis, fixed: number, a0: number, a1: number, y0: number, h: number, t: number, mNeg: Mat, mPos: Mat, mCap: Mat, K: Kit, frameHex: string) {
  const len = a1 - a0;
  if (h < 2 || len < 1.5) { seg(p, axis, fixed, a0, a1, y0, h, t, mNeg, mPos, mCap); return; }
  const ow = Math.min(len - 0.9, 1.9), oc = (a0 + a1) / 2, sill = 0.7, head = 2.2;
  seg(p, axis, fixed, a0, a1, y0, sill, t, mNeg, mPos, mCap);
  seg(p, axis, fixed, a0, a1, y0 + head, h - head, t, mNeg, mPos, mCap);
  seg(p, axis, fixed, a0, oc - ow / 2, y0 + sill, head - sill, t, mNeg, mPos, mCap);
  seg(p, axis, fixed, oc + ow / 2, a1, y0 + sill, head - sill, t, mNeg, mPos, mCap);
  glassRun(p, axis, fixed, oc - ow / 2, oc + ow / 2, y0 + sill, head - sill, K, frameHex);
}
function partition(p: THREE.Object3D, axis: Axis, fixed: number, a0: number, a1: number, y: number, h: number, mNeg: Mat, mPos: Mat, mCap: Mat) {
  const len = a1 - a0;
  if (len > 1.6) {
    const dc = a0 + len * 0.74, dw = 0.85;
    seg(p, axis, fixed, a0, dc - dw / 2, y, h, TI, mNeg, mPos, mCap);
    seg(p, axis, fixed, dc + dw / 2, a1, y, h, TI, mNeg, mPos, mCap);
    if (h > 2.2) seg(p, axis, fixed, dc - dw / 2, dc + dw / 2, y + 2.1, h - 2.1, TI, mNeg, mPos, mCap);
  } else seg(p, axis, fixed, a0, a1, y, h, TI, mNeg, mPos, mCap);
}
export function plant(p: THREE.Object3D, x: number, y: number, z: number, s: number, K: Kit) {
  cyl(p, 0.15 * s, 0.11 * s, 0.3 * s, K.m('#C9724E'), x, y + 0.15 * s, z, 14);
  const g1 = K.m('#6E9B45'), g2 = K.m('#5D8A3A');
  sph(p, 0.24 * s, g1, x, y + 0.5 * s, z);
  sph(p, 0.18 * s, g2, x + 0.12 * s, y + 0.68 * s, z - 0.05 * s);
  sph(p, 0.16 * s, g1, x - 0.1 * s, y + 0.74 * s, z + 0.06 * s);
}
const lampShade = (K: Kit) => K.m('#FCEBD0', { e: '#FFB463', ei: 0.9 });

/** Furniture placed inside a room's inner rectangle. `cut` = the floor is opened, so tall pieces are lowered. */
export function furnish(g: THREE.Object3D, r: Rect, y: number, rs: RoomState & { variant?: string }, K: Kit, cut: boolean) {
  const has = (k: string) => rs.items.includes(k);
  const w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const wood = K.m('#BE8E60', { r: 0.7 }), woodD = K.m('#7A5238', { r: 0.7 }), white = K.m('#F7F4EF'), fab = K.m('#E6DBCF'),
    acc = K.m('#D9825B'), dark = K.m('#2C2B2D', { r: 0.5 }), cab = K.m('#EEE8E0', { r: 0.6 }), marble = K.m('#EEEAE5', { r: 0.3 });

  switch (rs.type) {
    case 'living': {
      if (has('rug')) box(g, Math.min(w - 1, 2.7), 0.02, Math.min(d - 1, 1.9), K.m('#E4CBB6', { r: 1 }), cx, y + 0.01, cz + 0.15, 0, false);
      if (has('sofa')) {
        const sw = Math.min(2.4, w - 1.5), sz = r.z0 + 0.5;
        box(g, sw, 0.42, 0.92, fab, cx, y + 0.21, sz, 0.08);
        box(g, sw, 0.5, 0.24, fab, cx, y + 0.62, r.z0 + 0.14, 0.08);
        box(g, 0.2, 0.58, 0.92, fab, cx - sw / 2 + 0.1, y + 0.29, sz, 0.08);
        box(g, 0.2, 0.58, 0.92, fab, cx + sw / 2 - 0.1, y + 0.29, sz, 0.08);
        box(g, 0.36, 0.32, 0.12, acc, cx - sw / 2 + 0.45, y + 0.6, r.z0 + 0.32, 0.05);
        box(g, 0.36, 0.32, 0.12, K.m('#C9A27A'), cx + sw / 2 - 0.45, y + 0.6, r.z0 + 0.32, 0.05);
      }
      if (has('coffee')) { box(g, 1.0, 0.06, 0.55, wood, cx, y + 0.42, cz + 0.45, 0.03); box(g, 0.8, 0.36, 0.38, woodD, cx, y + 0.2, cz + 0.45, 0.02); }
      if (has('tv')) { box(g, 0.42, 0.45, 1.6, cab, r.x1 - 0.21, y + 0.225, cz + 0.25, 0.03); box(g, 0.05, 0.72, 1.25, dark, r.x1 - 0.12, y + 0.86, cz + 0.25, 0.02); }
      if (has('armchair')) {
        const ax = r.x0 + 0.55, az = r.z1 - 0.75, c = K.m('#C9A27A');
        box(g, 0.78, 0.4, 0.78, c, ax, y + 0.2, az, 0.08); box(g, 0.2, 0.48, 0.78, c, ax - 0.29, y + 0.6, az, 0.07);
      }
      if (has('lamp')) {
        cyl(g, 0.015, 0.015, 1.45, dark, r.x0 + 0.3, y + 0.73, r.z0 + 0.3, 8);
        cyl(g, 0.12, 0.2, 0.26, lampShade(K), r.x0 + 0.3, y + 1.5, r.z0 + 0.3, 18, false);
        cyl(g, 0.16, 0.16, 0.03, dark, r.x0 + 0.3, y + 0.015, r.z0 + 0.3);
      }
      if (has('plant')) plant(g, r.x1 - 0.35, y, r.z1 - 0.35, 1.5, K);
      break;
    }
    case 'bedroom': {
      const bw = Math.min(1.6, w - 1.5), bd = Math.min(2.0, d - 0.7), bx = cx - (w > 3.5 ? 0.15 : 0), bz = r.z0 + bd / 2 + 0.06;
      if (has('rug')) box(g, Math.min(w - 0.8, 2.4), 0.02, 1.5, K.m('#E8D3C3', { r: 1 }), bx, y + 0.01, bz + 0.5, 0, false);
      if (has('bed')) {
        box(g, bw + 0.12, 0.28, bd, wood, bx, y + 0.14, bz, 0.04);
        box(g, bw, 0.22, bd - 0.1, white, bx, y + 0.39, bz + 0.02, 0.07);
        box(g, bw + 0.05, 0.09, bd * 0.58, K.m('#D9BFA6'), bx, y + 0.53, bz + bd * 0.2, 0.04);
        box(g, bw * 0.4, 0.13, 0.34, white, bx - bw * 0.24, y + 0.57, r.z0 + 0.33, 0.06);
        box(g, bw * 0.4, 0.13, 0.34, white, bx + bw * 0.24, y + 0.57, r.z0 + 0.33, 0.06);
        box(g, bw + 0.3, 0.95, 0.1, woodD, bx, y + 0.48, r.z0 + 0.05, 0.03);
      }
      if (has('nightstands')) {
        for (const s of [-1, 1]) {
          const nx = bx + s * (bw / 2 + 0.36);
          box(g, 0.44, 0.44, 0.4, wood, nx, y + 0.22, r.z0 + 0.26, 0.03);
          cyl(g, 0.07, 0.1, 0.2, lampShade(K), nx, y + 0.58, r.z0 + 0.26, 16, false);
        }
      }
      if (has('wardrobe')) {
        const wl = Math.min(1.4, d - 2.0), wh = cut ? 1.0 : 2.0;
        box(g, 0.6, wh, wl, cab, r.x0 + 0.3, y + wh / 2, r.z1 - 0.35 - wl / 2, 0.03);
      }
      if (has('desk')) {
        box(g, 0.55, 0.04, 1.0, wood, r.x1 - 0.3, y + 0.74, r.z1 - 0.85, 0.02);
        box(g, 0.5, 0.7, 0.04, woodD, r.x1 - 0.3, y + 0.36, r.z1 - 0.38);
        box(g, 0.5, 0.7, 0.04, woodD, r.x1 - 0.3, y + 0.36, r.z1 - 1.32);
        box(g, 0.42, 0.06, 0.42, acc, r.x1 - 0.8, y + 0.46, r.z1 - 0.85, 0.04);
      }
      if (has('plant')) plant(g, r.x0 + 0.3, y, r.z1 - 0.3, 1.1, K);
      break;
    }
    case 'kids': {
      if (has('rug')) cyl(g, 0.75, 0.75, 0.02, K.m('#CFE0C6', { r: 1 }), cx + 0.2, y + 0.01, cz + 0.35, 28, false);
      if (has('bed')) {
        const kz = r.z0 + 0.95;
        box(g, 1.0, 0.3, 1.85, K.m('#F2E3D3'), r.x0 + 0.55, y + 0.15, kz, 0.05);
        box(g, 0.94, 0.2, 1.75, white, r.x0 + 0.55, y + 0.39, kz, 0.06);
        box(g, 0.98, 0.08, 1.1, K.m('#8FB3C9'), r.x0 + 0.55, y + 0.52, kz + 0.3, 0.04);
        box(g, 0.6, 0.12, 0.3, white, r.x0 + 0.55, y + 0.56, r.z0 + 0.25, 0.05);
      }
      if (has('toys')) {
        box(g, 0.6, 0.42, 0.4, K.m('#E8B04B'), r.x1 - 0.4, y + 0.21, r.z0 + 0.25, 0.05);
        sph(g, 0.16, acc, r.x1 - 0.6, y + 0.16, r.z0 + 0.75);
        box(g, 0.22, 0.22, 0.22, K.m('#7FB0C6'), r.x1 - 0.3, y + 0.53, r.z0 + 0.22, 0.03);
      }
      if (has('desk')) {
        box(g, 0.9, 0.04, 0.5, wood, r.x1 - 0.55, y + 0.6, r.z1 - 0.35, 0.02);
        box(g, 0.85, 0.56, 0.04, woodD, r.x1 - 0.55, y + 0.3, r.z1 - 0.12);
        box(g, 0.34, 0.05, 0.34, K.m('#8FB3C9'), r.x1 - 0.55, y + 0.36, r.z1 - 0.8, 0.04);
      }
      if (has('plant')) plant(g, r.x0 + 0.3, y, r.z1 - 0.3, 1.0, K);
      break;
    }
    case 'kitchen': {
      const v = rs.variant ?? 'line';
      const steel = K.m('#9EA7AC', { r: 0.3, mt: 0.5 });
      /** A run of base cabinets with worktop, along the back wall (z0) or a side wall. */
      const run = (side: 'back' | 'left' | 'right', a0: number, a1: number, sink = false, hob = false) => {
        const len = a1 - a0; if (len < 0.5) return;
        const c = (a0 + a1) / 2;
        if (side === 'back') {
          box(g, len, 0.88, 0.62, cab, c, y + 0.44, r.z0 + 0.31, 0.02); box(g, len + 0.02, 0.05, 0.66, marble, c, y + 0.905, r.z0 + 0.33, 0.01);
          if (sink) box(g, 0.5, 0.015, 0.36, steel, a0 + len * 0.3, y + 0.935, r.z0 + 0.32, 0, false);
          if (hob) box(g, 0.56, 0.015, 0.46, dark, a0 + len * 0.75, y + 0.935, r.z0 + 0.33, 0, false);
          if (has('uppers') && !cut) box(g, len - 0.1, 0.62, 0.34, cab, c, y + 1.85, r.z0 + 0.17, 0.02);
        } else {
          const x = side === 'left' ? r.x0 + 0.31 : r.x1 - 0.31;
          box(g, 0.62, 0.88, len, cab, x, y + 0.44, c, 0.02); box(g, 0.66, 0.05, len + 0.02, marble, x, y + 0.905, c, 0.01);
          if (sink) box(g, 0.36, 0.015, 0.5, steel, x, y + 0.935, a0 + len * 0.5, 0, false);
          if (hob) box(g, 0.46, 0.015, 0.56, dark, x, y + 0.935, a0 + len * 0.5, 0, false);
        }
      };
      const fridge = has('fridge');
      if (fridge) { const fh = cut ? 1.0 : 1.95; box(g, 0.7, fh, 0.66, K.m('#D7DADC', { r: 0.4 }), r.x0 + 0.36, y + fh / 2, r.z0 + 0.34, 0.05); }
      const c0 = r.x0 + (fridge ? 0.74 : 0.02);
      if (has('counter')) {
        if (v === 'L') { run('back', c0, r.x1, true, false); run('right', r.z0 + 0.64, Math.min(r.z1 - 0.2, r.z0 + 0.64 + 2.2), false, true); }
        else if (v === 'U') { run('back', c0, r.x1, true, false); run('right', r.z0 + 0.64, r.z1 - 0.9, false, true); if (w > 2.4) run('left', r.z0 + (fridge ? 0.72 : 0.64), r.z1 - 0.9); }
        else if (v === 'thai') {
          run('back', c0, r.x1, true, true);
          // Thai kitchen: a big sink basin, gas burners, a stone mortar and an open shelf.
          box(g, 0.7, 0.2, 0.45, steel, c0 + 0.5, y + 0.98, r.z0 + 0.33, 0.04);
          for (const k of [0, 1]) cyl(g, 0.13, 0.13, 0.06, dark, r.x1 - 0.35 - k * 0.38, y + 0.96, r.z0 + 0.33, 14);
          cyl(g, 0.12, 0.09, 0.16, K.m('#8C8580', { r: 0.9 }), (c0 + r.x1) / 2, y + 1.01, r.z0 + 0.3, 14);
          if (!cut) box(g, Math.min(1.6, w - 0.4), 0.04, 0.3, wood, (c0 + r.x1) / 2, y + 1.55, r.z0 + 0.15);
        } else run('back', c0, r.x1, true, true);
      }
      if (has('island') && v !== 'U' && v !== 'thai') {
        const iw = v === 'island' ? Math.min(2.4, w - 1.0) : Math.min(1.6, w - 1.2), idp = v === 'island' ? 0.95 : 0.72;
        const ix = v === 'L' ? cx - 0.3 : cx;
        box(g, iw, 0.88, idp, wood, ix, y + 0.44, cz + 0.5, 0.02);
        box(g, iw + 0.1, 0.05, idp + 0.08, marble, ix, y + 0.905, cz + 0.5, 0.01);
        const nS = v === 'island' ? 3 : 2;
        for (let k = 0; k < nS; k++) {
          const sx = ix - iw / 2 + (iw * (k + 0.5)) / nS;
          cyl(g, 0.17, 0.17, 0.06, woodD, sx, y + 0.66, cz + 0.5 + idp / 2 + 0.33);
          cyl(g, 0.02, 0.02, 0.63, dark, sx, y + 0.32, cz + 0.5 + idp / 2 + 0.33, 8);
        }
      }
      if (v === 'thai' && has('island')) { box(g, Math.min(1.2, w - 1), 0.75, 0.7, wood, cx, y + 0.375, cz + 0.6, 0.02); }
      if (has('plant')) plant(g, r.x1 - 0.3, y, r.z1 - 0.3, 1.2, K);
      break;
    }
    case 'dining': {
      if (has('table')) {
        const tw = Math.min(2.0, w - 1.7), n = tw > 1.6 ? 3 : 2;
        box(g, tw, 0.06, 0.95, wood, cx, y + 0.75, cz, 0.02);
        box(g, tw - 0.3, 0.72, 0.08, woodD, cx, y + 0.36, cz);
        for (let i = 0; i < n; i++) {
          const chx = cx - tw / 2 + (tw * (i + 0.5)) / n;
          for (const sd of [-1, 1]) {
            box(g, 0.42, 0.05, 0.42, white, chx, y + 0.46, cz + sd * 0.72, 0.03);
            box(g, 0.42, 0.46, 0.05, white, chx, y + 0.7, cz + sd * 0.93, 0.03);
            box(g, 0.3, 0.44, 0.3, K.m('#E1D8CD'), chx, y + 0.22, cz + sd * 0.72, 0.03);
          }
        }
      }
      if (has('sideboard')) box(g, 0.45, 0.78, Math.min(1.5, d - 0.5), woodD, r.x0 + 0.23, y + 0.39, cz, 0.03);
      if (has('pendant') && !cut) {
        cyl(g, 0.01, 0.01, 0.9, dark, cx, y + 2.2, cz, 6, false);
        cyl(g, 0.08, 0.28, 0.2, lampShade(K), cx, y + 1.7, cz, 20, false);
      }
      if (has('plant')) plant(g, r.x1 - 0.35, y, r.z1 - 0.3, 1.4, K);
      break;
    }
    case 'bathroom': {
      const v = rs.variant ?? 'tub';
      const glass = K.m('#CFE6EE', { r: 0.05, op: 0.35 }), mirror = K.m('#CFE1E7', { r: 0.05, mt: 0.4 }), tileW = K.m('#E9EEF0', { r: 0.4 });
      if (has('rug')) box(g, 0.9, 0.02, 0.55, K.m('#E7D6C8', { r: 1 }), cx, y + 0.01, cz + 0.35, 0, false);
      const tub = (x: number, z: number) => { box(g, 1.6, 0.56, 0.76, white, x, y + 0.28, z, 0.14); box(g, 1.4, 0.02, 0.56, K.m('#A6D3DE', { r: 0.1 }), x, y + 0.55, z, 0, false); };
      const shower = (x0: number, z0: number, sw: number, sd: number) => {
        box(g, sw, 0.04, sd, tileW, x0 + sw / 2, y + 0.02, z0 + sd / 2, 0, false);
        const hh = cut ? 0.6 : 1.95;
        box(g, sw, hh, 0.02, glass, x0 + sw / 2, y + hh / 2, z0 + sd, 0, false);
        box(g, 0.02, hh, sd, glass, x0 + sw, y + hh / 2, z0 + sd / 2, 0, false);
        if (!cut) { cyl(g, 0.012, 0.012, 1.9, K.m('#C9CCCF', { r: 0.3, mt: 0.7 }), x0 + 0.12, y + 0.95, z0 + 0.06, 8); cyl(g, 0.11, 0.11, 0.02, K.m('#C9CCCF', { r: 0.3, mt: 0.7 }), x0 + 0.2, y + 1.9, z0 + 0.2, 16); }
      };
      const vanity = (x: number, z: number, len = 0.95, alongX = false) => {
        if (alongX) { box(g, len, 0.78, 0.5, wood, x, y + 0.39, z, 0.03); box(g, len - 0.1, 0.1, 0.42, white, x, y + 0.83, z + 0.02, 0.05); if (!cut) box(g, len - 0.1, 0.7, 0.03, mirror, x, y + 1.5, z - 0.23, 0, false); }
        else { box(g, 0.5, 0.78, len, wood, x, y + 0.39, z, 0.03); box(g, 0.42, 0.1, len - 0.45, white, x - 0.02, y + 0.83, z, 0.05); if (!cut) box(g, 0.03, 0.7, len - 0.3, mirror, x + 0.23, y + 1.5, z, 0, false); }
      };
      const toilet = (x: number, z: number) => { box(g, 0.4, 0.42, 0.5, white, x, y + 0.21, z, 0.15); box(g, 0.15, 0.5, 0.4, white, x - 0.2, y + 0.5, z, 0.04); };
      if (v === 'shower') {
        if (has('tub')) shower(r.x0, r.z0, Math.min(1.1, w - 0.8), Math.min(1.0, d - 0.8));
        if (has('vanity')) vanity(r.x1 - 0.25, cz + 0.05);
        if (has('toilet')) toilet(r.x0 + 0.35, r.z1 - 0.45);
      } else if (v === 'wetdry') {
        // Glass partition: wet zone at the back (shower and tub), dry zone in front.
        const split = r.z0 + Math.min(1.3, d * 0.5);
        if (!cut) box(g, w * 0.6, 1.95, 0.02, glass, r.x0 + w * 0.3, y + 0.975, split, 0, false);
        if (has('tub') && w > 2.2) tub(r.x1 - 0.85, r.z0 + 0.42);
        shower(r.x0, r.z0, Math.min(1.0, w * 0.45), Math.min(1.1, split - r.z0 - 0.05));
        if (has('vanity')) vanity(cx, r.z1 - 0.27, Math.min(1.4, w - 1.2), true);
        if (has('toilet')) toilet(r.x0 + 0.35, r.z1 - 0.5);
      } else if (v === 'double') {
        if (has('vanity')) vanity(cx, r.z0 + 0.27, Math.min(1.8, w - 0.6), true);
        if (has('tub') && d > 2.4) tub(r.x0 + 0.82, r.z1 - 0.42);
        if (d > 2.2) shower(r.x1 - Math.min(1.0, w * 0.4), r.z1 - Math.min(1.0, d * 0.4), Math.min(1.0, w * 0.4), Math.min(1.0, d * 0.4));
        if (has('toilet')) toilet(r.x0 + 0.35, cz);
      } else {
        if (has('tub')) tub(r.x0 + 0.82, r.z0 + 0.4);
        if (has('vanity')) vanity(r.x1 - 0.25, cz + 0.05);
        if (has('toilet')) toilet(r.x0 + 0.35, r.z1 - 0.45);
      }
      if (has('plant')) plant(g, r.x1 - 0.3, y, r.z1 - 0.3, 0.95, K);
      break;
    }
    case 'office': {
      if (has('rug')) box(g, Math.min(w - 1.2, 2.2), 0.02, 1.3, K.m('#DCCAB8', { r: 1 }), cx, y + 0.01, cz + 0.25, 0, false);
      if (has('desk')) {
        box(g, 1.5, 0.05, 0.7, wood, cx, y + 0.74, r.z0 + 0.38, 0.02);
        box(g, 0.05, 0.72, 0.66, woodD, cx - 0.7, y + 0.36, r.z0 + 0.38);
        box(g, 0.05, 0.72, 0.66, woodD, cx + 0.7, y + 0.36, r.z0 + 0.38);
        box(g, 0.62, 0.38, 0.04, dark, cx, y + 1.02, r.z0 + 0.2, 0.01);
        box(g, 0.08, 0.18, 0.08, dark, cx, y + 0.86, r.z0 + 0.2);
        cyl(g, 0.25, 0.25, 0.07, dark, cx, y + 0.48, r.z0 + 0.95, 20);
        box(g, 0.46, 0.5, 0.06, dark, cx, y + 0.78, r.z0 + 1.18, 0.03);
        cyl(g, 0.03, 0.03, 0.42, dark, cx, y + 0.22, r.z0 + 0.95, 8);
      }
      if (has('shelf')) {
        const sl = Math.min(1.5, d - 0.6), shH = cut ? 1.0 : 1.85;
        box(g, 0.38, shH, sl, woodD, r.x0 + 0.19, y + shH / 2, cz, 0.02);
        const bc = ['#D9825B', '#8FB3C9', '#E8B04B', '#6E9B45', '#F4EFE8'];
        for (let row = 0; row < (cut ? 1 : 3); row++)
          for (let bk = 0; bk < 4; bk++)
            box(g, 0.26, 0.32, 0.18, K.m(bc[(row * 4 + bk) % 5]), r.x0 + 0.24, y + 0.38 + row * 0.55, cz - sl / 2 + 0.25 + (bk * (sl - 0.4)) / 3, 0.01, false);
      }
      if (has('plant')) plant(g, r.x1 - 0.35, y, r.z1 - 0.3, 1.4, K);
      break;
    }
  }
}

function buildRooms(house: THREE.Object3D, fk: FloorKey, state: Design, h: number, K: Kit, sel: string | null, markers: Marker[] | null, furniture = true) {
  const F = PLAN[fk], y = F.y, ext = state.ext, extM = K.m(ext.wall, { r: 0.9 });
  for (const rd of F.rooms) {
    const rs = state.rooms[rd.id], paint = K.m(rs.paint, { r: 0.95 });
    const rg = new THREE.Group(); rg.userData.roomId = rd.id; house.add(rg);
    const fm = K.own(new THREE.MeshStandardMaterial({ color: finOf(rs.floor)[2], roughness: rs.floor === 'marble' ? 0.3 : 0.8 }));
    if (sel === rd.id) { fm.emissive = new THREE.Color('#E9694B'); fm.emissiveIntensity = 0.45; }
    box(rg, rd.x1 - rd.x0, 0.03, rd.z1 - rd.z0, fm, (rd.x0 + rd.x1) / 2, y + 0.015, (rd.z0 + rd.z1) / 2, 0, false);

    const sides: Record<Side, boolean> = { front: rd.z1 >= Z1 - 1e-6, back: rd.z0 <= Z0 + 1e-6, right: rd.x1 >= X1 - 1e-6, left: rd.x0 <= X0 + 1e-6 };
    for (const s of ['front', 'back', 'right', 'left'] as Side[]) {
      if (!sides[s]) continue;
      const kind = rd.ext?.[s] ?? 'solid';
      let axis: Axis, fixed: number, a0: number, a1: number, mNeg: Mat, mPos: Mat;
      if (s === 'front' || s === 'back') {
        axis = 'x'; fixed = s === 'front' ? Z1 - TE / 2 : Z0 + TE / 2; a0 = rd.x0; a1 = rd.x1;
        mNeg = s === 'front' ? paint : extM; mPos = s === 'front' ? extM : paint;
      } else {
        axis = 'z'; fixed = s === 'right' ? X1 - TE / 2 : X0 + TE / 2; a0 = rd.z0; a1 = rd.z1;
        if (a1 >= Z1 - 1e-6) a1 -= TE; if (a0 <= Z0 + 1e-6) a0 += TE;
        mNeg = s === 'right' ? paint : extM; mPos = s === 'right' ? extM : paint;
      }
      if (kind === 'glass') glassRun(rg, axis, fixed + (s === 'front' || s === 'right' ? 0.04 : -0.04), a0, a1, y, h, K, ext.frame);
      else if (kind === 'window') windowWall(rg, axis, fixed, a0, a1, y, h, TE, mNeg, mPos, extM, K, ext.frame);
      else seg(rg, axis, fixed, a0, a1, y, h, TE, mNeg, mPos, extM);
    }
    // Interior partitions are drawn once, from the room on their -x / -z side.
    if (!sides.right) for (const n of F.rooms) {
      if (Math.abs(n.x0 - rd.x1) > 1e-6) continue;
      let a0 = Math.max(rd.z0, n.z0), a1 = Math.min(rd.z1, n.z1);
      if (a1 - a0 < 0.05) continue;
      if (a1 >= Z1 - 1e-6) a1 -= TE; if (a0 <= Z0 + 1e-6) a0 += TE;
      partition(rg, 'z', rd.x1, a0, a1, y, h, paint, K.m(state.rooms[n.id].paint, { r: 0.95 }), extM);
    }
    if (!sides.front) for (const n of F.rooms) {
      if (Math.abs(n.z0 - rd.z1) > 1e-6) continue;
      let a0 = Math.max(rd.x0, n.x0), a1 = Math.min(rd.x1, n.x1);
      if (a1 - a0 < 0.05) continue;
      if (a1 >= X1 - 1e-6) a1 -= TE; if (a0 <= X0 + 1e-6) a0 += TE;
      partition(rg, 'x', rd.z1, a0, a1, y, h, paint, K.m(state.rooms[n.id].paint, { r: 0.95 }), extM);
    }
    if (furniture) furnish(rg, roomInner(rd), y + 0.03, rs, K, h < 2);
    if (markers) {
      const mk = new THREE.Object3D();
      mk.position.set((rd.x0 + rd.x1) / 2, y + 1.25, (rd.z0 + rd.z1) / 2);
      house.add(mk); markers.push({ id: rd.id, obj: mk });
    }
  }
}

/** Inner rectangle of a room, inside its walls. */
export function roomInner(rd: RoomDef): Rect {
  const left = rd.x0 <= X0 + 1e-6, right = rd.x1 >= X1 - 1e-6, back = rd.z0 <= Z0 + 1e-6, front = rd.z1 >= Z1 - 1e-6;
  return {
    x0: rd.x0 + (left ? TE : TI / 2) + 0.03, x1: rd.x1 - (right ? TE : TI / 2) - 0.03,
    z0: rd.z0 + (back ? TE : TI / 2) + 0.03, z1: rd.z1 - (front ? TE : TI / 2) - 0.03,
  };
}

/** One piece of furniture, centred on its own origin. `offset` is where furnish() would put it inside a w x d room centred on 0. */
export function furniturePiece(type: RoomType, item: string, w: number, d: number) {
  const K = new Kit(), group = new THREE.Group(), inner = new THREE.Group();
  group.add(inner);
  furnish(inner, { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 }, 0, { type, floor: 'oak', paint: '#FFFFFF', items: [item] }, K, false);
  const bb = new THREE.Box3().setFromObject(inner), c = bb.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, 0, -c.z);
  group.userData.kit = K;
  return { group, offset: { x: c.x, z: c.z } };
}

export function tree(p: THREE.Object3D, x: number, z: number, s: number, K: Kit, i: number) {
  const greens = ['#4E8228', '#5E922F', '#467722', '#6A9C36'];
  const gm = K.m(greens[i % 4], { r: 0.9 }), gm2 = K.m(greens[(i + 1) % 4], { r: 0.9 });
  cyl(p, 0.045 * s, 0.065 * s, 1.7 * s, K.m('#7A5A3F'), x, 0.85 * s, z, 8);
  const top = 1.95 * s;
  sph(p, 0.55 * s, gm, x, top, z, 1.05);
  sph(p, 0.38 * s, gm2, x + 0.32 * s, top - 0.25 * s, z + 0.12 * s);
  sph(p, 0.36 * s, gm2, x - 0.28 * s, top - 0.2 * s, z - 0.18 * s);
  sph(p, 0.34 * s, gm, x + 0.05 * s, top + 0.38 * s, z - 0.05 * s);
  sph(p, 0.28 * s, gm2, x - 0.08 * s, top - 0.32 * s, z + 0.34 * s);
}
export const bush = (p: THREE.Object3D, x: number, z: number, s: number, K: Kit, i: number) =>
  sph(p, 0.3 * s, K.m(i % 2 ? '#4E8228' : '#5E922F', { r: 0.9 }), x, 0.22 * s, z, 0.8);

export function chair(p: THREE.Object3D, x: number, z: number, rot: number, K: Kit) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; p.add(g);
  const w = K.m('#F7F4EF');
  box(g, 0.48, 0.06, 0.48, w, 0, 0.44, 0, 0.03);
  box(g, 0.48, 0.5, 0.06, w, 0, 0.7, -0.21, 0.03);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 0.04, 0.42, 0.04, w, a * 0.2, 0.21, b * 0.2);
}

const TREES: Record<Garden, number[][]> = {
  lush: [[-5.45, -4.5, 1.1], [-5.45, -1.4, 0.95], [-5.4, 1.6, 1.0], [-4.8, 4.5, 1.15], [-2.2, 4.6, 0.85], [5.5, -4.5, 1.1], [5.5, -1.6, 0.95], [5.5, 2.2, 1.05], [5.4, 4.6, 0.9], [1.4, -4.7, 0.9]],
  simple: [[-5.45, -1.4, 1.0], [-4.8, 4.5, 1.1], [5.5, -4.5, 1.1], [5.4, 4.6, 0.95]],
  minimal: [[-4.8, 4.5, 1.1], [5.5, -4.5, 1.05]],
};

function garden(G: THREE.Object3D, level: Garden, K: Kit, cut: boolean) {
  const grass = K.m('#86AC4E', { r: 1 }), pave = K.m('#DDD6CC', { r: 0.9 }), white = K.m('#F7F4EF');
  box(G, 4.3, 0.05, 2.8, grass, -3.85, 0.025, 3.8, 0.02, false);
  box(G, 11.9, 0.05, 1.0, grass, 0, 0.025, -4.75, 0.02, false);
  box(G, 1.1, 0.05, 9.0, grass, 5.5, 0.025, 0.4, 0.02, false);
  box(G, 1.1, 0.05, 6.2, grass, -5.45, 0.025, -1.05, 0.02, false);
  box(G, 4.1, 0.03, 2.5, pave, 2.55, 0.02, 4.05, 0.02, false);
  cyl(G, 0.36, 0.36, 0.04, white, 2.6, 0.74, 4.0, 24);
  cyl(G, 0.04, 0.04, 0.72, white, 2.6, 0.36, 4.0, 8);
  chair(G, 1.95, 4.0, Math.PI / 2, K); chair(G, 3.25, 4.0, -Math.PI / 2, K); chair(G, 2.6, 4.65, Math.PI, K);
  box(G, 1.5, 0.15, 0.45, K.m('#E8E3DB'), 1.4, 0.075, 2.35, 0.02);
  box(G, 0.6, 0.25, 1.6, white, 4.05, 0.12, 0.8, 0.05);
  box(G, 0.6, 0.45, 0.08, white, 4.05, 0.4, 0.05, 0.04);
  if (!cut) TREES[level].forEach((t, i) => tree(G, t[0], t[1], t[2], K, i));
  if (level !== 'minimal') {
    for (let i = 0; i < 5; i++) bush(G, -4.0 + i * 0.55, 2.45, 1, K, i);
    for (let j = 0; j < (level === 'lush' ? 7 : 3); j++) bush(G, -4.95, -3.3 + j * 0.8, 0.9, K, j + 1);
    if (level === 'lush') for (let k = 0; k < 8; k++) bush(G, -3.6 + k * 0.95, -4.45, 0.85, K, k);
  }
}


/** The house on its own (plinth centred on the origin). Set `furniture` false to get empty rooms. */
function buildHouse(state: Design, mode: ViewMode, sel: string | null, K: Kit, markers: Marker[] | null, furniture: boolean) {
  const house = new THREE.Group();
  const ext = state.ext, wallM = K.m(ext.wall, { r: 0.9 }), frameM = K.m(ext.wood, { r: 0.6 }), deckM = K.m('#C79A6C', { r: 0.8 });
  const railM = K.m('#CFE6EE', { r: 0.05, op: 0.35 });
  const FULL = 2.7, CUT = 0.62;
  box(house, 7.4, 0.3, 5.9, wallM, 0, 0.15, 0, 0.03);
  buildRooms(house, 'g', state, mode === 'g' ? CUT : FULL, K, mode === 'g' ? sel : null, mode === 'g' ? markers : null, furniture);

  // Warm interior glow. Both lights always exist so the shader set never changes between rebuilds.
  const lg = new THREE.PointLight('#FFAE5E', mode === 'u' ? 2 : 5, 8, 2); lg.position.set(0, 2.4, 0.6); house.add(lg);
  const lu = new THREE.PointLight('#FFAE5E', mode === 'g' ? 0 : 5, 8, 2); lu.position.set(0, 5.4, 0.6); house.add(lu);

  if (mode !== 'g') {
    // Upper slab pushed forward to form the deep white frame.
    box(house, 7.4, 0.3, 6.65, wallM, 0, 3.15, 0.375, 0.03);
    buildRooms(house, 'u', state, mode === 'u' ? CUT : FULL, K, mode === 'u' ? sel : null, mode === 'u' ? markers : null, furniture);
    box(house, 6.9, 0.04, 0.7, deckM, 0, 3.32, 3.12, 0, false);
    box(house, 6.9, 0.9, 0.03, railM, 0, 3.75, 3.6, 0, false);
    box(house, 6.9, 0.05, 0.06, K.m(ext.frame, { r: 0.45 }), 0, 4.2, 3.6, 0);
    // Side balcony with its framed box.
    box(house, 1.6, 0.3, 3.8, wallM, 4.5, 3.15, 1.6, 0.03);
    box(house, 1.5, 0.04, 3.7, deckM, 4.5, 3.32, 1.6, 0, false);
    box(house, 0.03, 0.95, 3.7, railM, 5.27, 3.8, 1.6, 0, false);
    box(house, 1.5, 0.95, 0.03, railM, 4.5, 3.8, 3.47, 0, false);
    box(house, 0.07, 0.06, 3.76, frameM, 5.27, 4.29, 1.6);
    box(house, 1.56, 0.06, 0.07, frameM, 4.5, 4.29, 3.47);
    plant(house, 4.95, 3.34, -0.05, 1.3, K);
    plant(house, 4.95, 3.34, 3.15, 1.1, K);
    box(house, 0.55, 0.22, 1.2, K.m('#F7F4EF'), 4.35, 3.45, 1.6, 0.05);
    for (const z of [-0.22, 3.42]) box(house, 0.18, 3.0, 0.18, wallM, 5.2, 1.5, z, 0.02);
    if (mode === 'x') {
      box(house, 7.5, 0.36, 6.75, wallM, 0, 6.18, 0.375, 0.04);
      for (const x of [-3.62, 3.62]) box(house, 0.26, 2.7, 0.75, wallM, x, 4.65, 3.12, 0.02);
      for (const z of [-0.22, 3.42]) box(house, 0.1, 2.62, 0.1, frameM, 5.2, 4.61, z);
      box(house, 0.12, 0.12, 3.76, frameM, 5.2, 5.94, 1.6);
      box(house, 1.62, 0.12, 0.12, frameM, 4.45, 5.94, 3.42);
      box(house, 1.62, 0.12, 0.12, frameM, 4.45, 5.94, -0.22);
      box(house, 1.2, 0.12, 0.9, wallM, -1.6, 6.42, -0.6, 0.03);
    }
  }
  return house;
}

/** A standalone house for the simulator, with its own materials. */
export function createHouse(state: Design, mode: ViewMode, furniture = false) {
  const K = new Kit();
  const g = buildHouse(state, mode, null, K, null, furniture);
  g.userData.kit = K;
  return g;
}

/** Offset of the house on the platform (used by the camera to centre an opened floor). */
export const HOUSE_OFFSET = { x: -0.6, z: -0.9 };

/** Whole diorama. mode: 'x' exterior, 'g' ground floor opened, 'u' upper floor opened. */
export function buildDiorama(state: Design, mode: ViewMode, sel: string | null) {
  const K = new Kit(), G = new THREE.Group(), markers: Marker[] = [];
  G.userData.kit = K; G.userData.markers = markers;

  box(G, 12.2, 0.62, 10.8, K.m('#30343A', { r: 0.7 }), 0, -0.43, 0, 0.06);
  box(G, 12.12, 0.16, 10.72, K.m('#F2EEE8', { r: 0.9 }), 0, -0.07, 0, 0.03, false);

  const house = buildHouse(state, mode, sel, K, markers, true);
  house.position.set(HOUSE_OFFSET.x, 0, HOUSE_OFFSET.z); G.add(house);
  garden(G, state.ext.garden, K, mode !== 'x');
  return G;
}

export function disposeDiorama(g: THREE.Object3D) {
  // Nested models (a car in a garage, say) bring their own material kit, so collect every one.
  g.traverse((o) => {
    if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
    (o.userData.kit as Kit | undefined)?.dispose();
  });
}
