// Turns a HouseSpec into a 3D house: slabs, walls with doors and windows, stairs, furniture and roof.
import * as THREE from 'three';
import { Kit, box, cyl, plant, seg, glassRun, furnish, tree, bush, worldUV, disposeDiorama } from '../house/geometry';
import { TYPES, finOf, type RoomType } from '../house/data';
import { car, lounger, patioSet } from '../sim/models';
import { floorEdges, floorRect, mainRect, mainRoofRect, roomPoly, stairVoids, type Edge, type Finish, type HouseSpec, type PRoom, type Rect } from './spec';
import { finishTexture } from './textures';

export const PLINTH = 0.3;
const SLAB = 0.25, TE = 0.2, TI = 0.1, CUT_H = 0.62;
export const floorY = (s: HouseSpec, i: number) => PLINTH + i * s.floorH;

export interface BuildOpts {
  /** Open this floor: hide the floors above and the roof, lower its walls. */
  cut?: number | null;
  /** Highlight this room's floor. */
  sel?: string | null;
  furniture?: boolean;
  /** Collects a point above each room of the cut floor, for labels. */
  markers?: { id: string; obj: THREE.Object3D }[];
}
type Mat = THREE.Material;

/** Inner rectangle (for furniture) of a room in house-local coordinates (origin at the centre of the footprint). */
export function roomRect(s: HouseSpec, r: PRoom) {
  const m = mainRect(r);
  const per = { w: m.x <= 1e-3, e: m.x + m.w >= s.w - 1e-3, n: m.z <= 1e-3, s: m.z + m.d >= s.d - 1e-3 };
  return {
    x0: m.x - s.w / 2 + (per.w ? TE : TI) + 0.02, x1: m.x + m.w - s.w / 2 - (per.e ? TE : TI) - 0.02,
    z0: m.z - s.d / 2 + (per.n ? TE : TI) + 0.02, z1: m.z + m.d - s.d / 2 - (per.s ? TE : TI) - 0.02,
  };
}

/** Furniture for any room type, including the ones the original room designer does not know. */
export function furnishRoom(g: THREE.Object3D, r: { x0: number; x1: number; z0: number; z1: number }, y: number, room: Pick<PRoom, 'type' | 'items' | 'floor' | 'paint' | 'variant'>, K: Kit, cut: boolean) {
  if (room.type in TYPES) { furnish(g, r, y, { type: room.type as RoomType, floor: room.floor, paint: room.paint, items: room.items, variant: room.variant }, K, cut); return; }
  const has = (k: string) => room.items.includes(k);
  const w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const wood = K.m('#BE8E60', { r: 0.7 }), woodD = K.m('#7A5238', { r: 0.7 }), white = K.m('#F7F4EF'), metal = K.m('#D9DCDE', { r: 0.4 }), dark = K.m('#2C2B2D', { r: 0.5 });
  const place = (obj: THREE.Object3D, x: number, z: number, rot = 0) => { obj.position.set(x, y, z); obj.rotation.y = rot; g.add(obj); };
  switch (room.type) {
    case 'hall':
      if (has('rug')) box(g, Math.max(0.6, Math.min(w, d) - 0.5), 0.02, Math.max(0.8, Math.max(w, d) - 1), K.m('#D9C2AA', { r: 1 }), cx, y + 0.01, cz, 0, false).rotation.y = w > d ? Math.PI / 2 : 0;
      if (has('console') && Math.max(w, d) > 1.6) { if (w >= d) box(g, 1.1, 0.8, 0.32, woodD, cx, y + 0.4, r.z0 + 0.17, 0.02); else box(g, 0.32, 0.8, 1.1, woodD, r.x0 + 0.17, y + 0.4, cz, 0.02); }
      if (has('plant')) plant(g, r.x1 - 0.3, y, r.z1 - 0.3, 1.2, K);
      break;
    case 'garage':
      if (has('car') && w > 1.9 && d > 1.9) place(car('#3F6E8C'), cx, cz, w > d ? Math.PI / 2 : 0);
      if (has('shelf')) { if (w >= d) box(g, Math.min(2.2, w - 0.6), 1.8, 0.4, metal, cx, y + 0.9, r.z0 + 0.21, 0.02); else box(g, 0.4, 1.8, Math.min(2.2, d - 0.6), metal, r.x0 + 0.21, y + 0.9, cz, 0.02); }
      break;
    case 'carport': {
      // Cars parked side by side, noses to the street.
      const colors = ['#F4F4F2', '#5B6068', '#1E2124', '#B8BCC2'];
      const across = w >= d || w >= 5;
      const room = Math.max(1, Math.min(4, Math.floor(across ? w / 2.4 : d / 4.8)));
      const slots = !has('car') ? 0 : has('car2') ? room : 1;
      for (let i = 0; i < slots && d > 1.9 && w > 1.9; i++) {
        if (across) place(car(colors[i % 4]), r.x0 + (w / slots) * (i + 0.5), cz, 0);
        else place(car(colors[i % 4]), cx, r.z0 + (d / slots) * (i + 0.5), 0);
      }
      break;
    }
    case 'laundry':
      if (has('washer')) { box(g, 0.6, 0.85, 0.6, white, r.x0 + 0.35, y + 0.425, r.z0 + 0.32, 0.05); cyl(g, 0.2, 0.2, 0.03, dark, r.x0 + 0.35, y + 0.5, r.z0 + 0.63, 20).rotation.x = Math.PI / 2; }
      if (has('dryer') && w > 1.4) { box(g, 0.6, 0.85, 0.6, white, r.x0 + 1.0, y + 0.425, r.z0 + 0.32, 0.05); cyl(g, 0.2, 0.2, 0.03, dark, r.x0 + 1.0, y + 0.5, r.z0 + 0.63, 20).rotation.x = Math.PI / 2; }
      if (has('shelf') && !cut) box(g, Math.min(1.4, w - 0.3), 0.04, 0.32, wood, r.x0 + Math.min(1.4, w - 0.3) / 2 + 0.05, y + 1.6, r.z0 + 0.17);
      break;
    case 'storage':
      if (has('shelf')) {
        const h = cut ? 0.9 : 1.9;
        if (w >= d) box(g, w - 0.2, h, 0.45, woodD, cx, y + h / 2, r.z0 + 0.24, 0.02);
        else box(g, 0.45, h, d - 0.2, woodD, r.x0 + 0.24, y + h / 2, cz, 0.02);
      }
      break;
    case 'terrace':
      if (has('lounger')) { place(lounger(), r.x0 + 0.5, cz, 0); if (w > 2.4) place(lounger(), r.x0 + 1.3, cz, 0); }
      if (has('table') && w > 2.6) place(patioSet(), r.x1 - 1.0, cz);
      if (has('plant')) { plant(g, r.x1 - 0.3, y, r.z0 + 0.3, 1.3, K); plant(g, r.x0 + 0.3, y, r.z1 - 0.3, 1.1, K); }
      break;
    case 'undercroft':
      // Thai daybed (taeng) in the shade under the house.
      if (has('bench') && w > 2 && d > 1.6) {
        box(g, 1.9, 0.08, 1.3, wood, cx, y + 0.42, cz, 0.02);
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 0.08, 0.4, 0.08, woodD, cx + a * 0.88, y + 0.2, cz + b * 0.58);
        box(g, 0.5, 0.12, 0.35, K.m('#C9A27A'), cx - 0.6, y + 0.52, cz - 0.4, 0.04);
      }
      if (has('plant')) { plant(g, r.x0 + 0.4, y, r.z1 - 0.4, 1.4, K); plant(g, r.x1 - 0.4, y, r.z1 - 0.4, 1.2, K); }
      break;
  }
}

/** One piece of furniture for any room type, centred on its own origin; `offset` is where it sits in a w x d room. */
export function roomPiece(type: PRoom['type'], item: string, w: number, d: number, variant?: string) {
  const K = new Kit(), group = new THREE.Group(), inner = new THREE.Group();
  group.add(inner); group.userData.kit = K;
  furnishRoom(inner, { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 }, 0, { type, items: [item], floor: 'oak', paint: '#FFFFFF', variant }, K, false);
  const bb = new THREE.Box3().setFromObject(inner);
  const c = bb.isEmpty() ? new THREE.Vector3() : bb.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, 0, -c.z);
  return { group, offset: { x: c.x, z: c.z } };
}

/** Where one piece of furniture sits in a w x d room before the user moves it: centre (from the room centre) and size. */
const fpCache = new Map<string, { x: number; z: number; w: number; d: number } | null>();
export function itemFootprint(type: PRoom['type'], item: string, w: number, d: number, variant?: string) {
  const key = `${type}|${item}|${w.toFixed(2)}|${d.toFixed(2)}|${variant ?? ''}`;
  if (fpCache.has(key)) return fpCache.get(key)!;
  const K = new Kit(), g = new THREE.Group();
  furnishRoom(g, { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 }, 0, { type, items: [item], floor: 'oak', paint: '#FFFFFF', variant }, K, false);
  stripBase(g, type, w, d, variant);
  const bb = new THREE.Box3().setFromObject(g);
  const out = bb.isEmpty() ? null : { x: (bb.min.x + bb.max.x) / 2, z: (bb.min.z + bb.max.z) / 2, w: bb.max.x - bb.min.x, d: bb.max.z - bb.min.z };
  disposeDiorama(g); K.dispose?.();
  if (fpCache.size > 400) fpCache.clear();
  fpCache.set(key, out);
  return out;
}
/** Remove the pieces a room has with no furniture at all (e.g. a shower screen) from a one-item group. */
function stripBase(g: THREE.Object3D, type: PRoom['type'], w: number, d: number, variant?: string, y = 0, rect?: { x0: number; x1: number; z0: number; z1: number }) {
  const K = new Kit(), b = new THREE.Group();
  furnishRoom(b, rect ?? { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 }, y, { type, items: [], floor: 'oak', paint: '#FFFFFF', variant }, K, false);
  if (b.children.length) {
    const sig = (o: THREE.Object3D) => `${(o as THREE.Mesh).geometry?.type ?? o.type}|${o.position.x.toFixed(3)}|${o.position.y.toFixed(3)}|${o.position.z.toFixed(3)}`;
    const base = new Set(b.children.map(sig));
    for (const c of [...g.children]) if (base.has(sig(c))) g.remove(c);
  }
  disposeDiorama(b);
}
/** Furniture of a room, with the pieces the user moved or turned put where they asked. */
function furnishPlaced(rg: THREE.Object3D, rect: { x0: number; x1: number; z0: number; z1: number }, y: number, r: PRoom, K: Kit, cut: boolean) {
  const moved = r.items.filter((k) => r.place?.[k]);
  if (!moved.length) { furnishRoom(rg, rect, y, r, K, cut); return; }
  furnishRoom(rg, rect, y, { ...r, items: r.items.filter((k) => !r.place?.[k]) }, K, cut);
  for (const k of moved) {
    const pl = r.place![k], inner = new THREE.Group(), wrap = new THREE.Group();
    furnishRoom(inner, rect, y, { ...r, items: [k] }, K, cut);
    stripBase(inner, r.type, rect.x1 - rect.x0, rect.z1 - rect.z0, r.variant, y, rect);
    const bb = new THREE.Box3().setFromObject(inner);
    if (bb.isEmpty()) continue;
    const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    inner.position.set(-cx, 0, -cz);
    wrap.position.set(cx + pl.dx, 0, cz + pl.dz);
    wrap.rotation.y = -((pl.turn ?? 0) % 4) * Math.PI / 2;
    wrap.add(inner); rg.add(wrap);
  }
}

/** A wall piece along a diagonal edge, from a0 to a1 metres along it. */
function diagPiece(p: THREE.Object3D, s: HouseSpec, e: Edge, a0: number, a1: number, y0: number, h: number, t: number, mIn: Mat, mOut: Mat) {
  const len = a1 - a0; if (len < 0.02 || h < 0.02) return;
  const L = e.a1, dx = (e.p1.x - e.p0.x) / L, dz = (e.p1.z - e.p0.z) / L;
  const nIn = { x: -dz, z: dx }; // pointing into the room
  const m = (a0 + a1) / 2;
  const g = new THREE.BoxGeometry(len + 0.02, h, t);
  const o = new THREE.Mesh(g, [mOut, mOut, mOut, mOut, mIn, mOut]);
  o.position.set(e.p0.x + dx * m + nIn.x * t / 2 - s.w / 2, y0 + h / 2, e.p0.z + dz * m + nIn.z * t / 2 - s.d / 2);
  o.rotation.y = -Math.atan2(dz, dx);
  o.castShadow = o.receiveShadow = true; p.add(o);
  return o;
}

/** Columns standing at the outside corners of open rooms (undercroft, terrace). */
function columns(p: THREE.Object3D, s: HouseSpec, r: PRoom, y: number, h: number, mat: Mat, every = 0) {
  const pts = roomPoly(r);
  const place = (x: number, z: number) => box(p, 0.2, h, 0.2, mat, x - s.w / 2, y + h / 2, z - s.d / 2, 0.02);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ins = (v: number, lo: number, hi: number) => Math.min(hi - 0.12, Math.max(lo + 0.12, v));
    place(ins(a.x, r.x, r.x + r.w), ins(a.z, r.z, r.z + r.d));
    if (every > 0) {
      const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.floor(len / every);
      for (let k = 1; k < n + 1; k++) { const f = k / (n + 1); place(ins(a.x + (b.x - a.x) * f, r.x, r.x + r.w), ins(a.z + (b.z - a.z) * f, r.z, r.z + r.d)); }
    }
  }
}

/** One wall of a room with its holes (doors, open-plan gaps, windows). */
function buildEdge(p: THREE.Object3D, s: HouseSpec, e: Edge, y: number, h: number, K: Kit, paint: Mat, outer: Mat, cap: Mat) {
  if (e.room.type === 'undercroft' || e.room.type === 'carport') return;
  const t = e.perimeter ? TE : TI;
  const ground = y <= PLINTH + 1e-3;
  const rail = () => K.m('#CFE6EE', { r: 0.05, op: 0.35 }), fr = () => K.m(s.colors.frame, { r: 0.45 });

  if (e.axis === 'd') {
    if (e.room.type === 'terrace') { diagPiece(p, s, e, 0, e.a1, y, 0.95, 0.03, rail(), rail()); return; }
    let cur = 0;
    for (const hl of [...e.holes].sort((a, b) => a.a0 - b.a0)) {
      diagPiece(p, s, e, cur, hl.a0, y, h, t, paint, outer);
      const sill = Math.min(hl.sill, h), head = Math.min(hl.head, h);
      if (sill > 0) diagPiece(p, s, e, hl.a0, hl.a1, y, sill, t, paint, outer);
      if (head < h) diagPiece(p, s, e, hl.a0, hl.a1, y + head, h - head, t, paint, outer);
      if (hl.kind !== 'open' && hl.kind !== 'door' && head - sill > 0.15) {
        diagPiece(p, s, e, hl.a0, hl.a1, y + sill, head - sill, 0.03, K.m('#2C3B43', { r: 0.05, mt: 0.4, op: 0.5 }), K.m('#2C3B43', { r: 0.05, mt: 0.4, op: 0.5 }));
        diagPiece(p, s, e, hl.a0, hl.a1, y + sill, 0.07, 0.09, fr(), fr());
        diagPiece(p, s, e, hl.a0, hl.a1, y + head - 0.07, 0.07, 0.09, fr(), fr());
      }
      cur = Math.max(cur, hl.a1);
    }
    diagPiece(p, s, e, cur, e.a1, y, h, t, paint, outer);
    return;
  }

  const X = (v: number) => v - s.w / 2, Z = (v: number) => v - s.d / 2;
  const inward = e.side === 'n' || e.side === 'w' ? 1 : -1;
  const fixedL = (e.axis === 'x' ? Z(e.fixed) : X(e.fixed)) + inward * t / 2;
  const L = (v: number) => (e.axis === 'x' ? X(v) : Z(v));
  const inPos = inward > 0;
  const mNeg = inPos ? outer : paint, mPos = inPos ? paint : outer;
  const a0 = L(e.a0), a1 = L(e.a1);
  const axis = e.axis;

  if (e.room.type === 'terrace' && e.perimeter) {
    if (ground) return; // a front porch: posts and roof, no railing
    const len = a1 - a0, c = (a0 + a1) / 2;
    if (axis === 'x') { box(p, len, 0.95, 0.03, rail(), c, y + 0.5, fixedL, 0, false); box(p, len, 0.05, 0.06, fr(), c, y + 1.0, fixedL); }
    else { box(p, 0.03, 0.95, len, rail(), fixedL, y + 0.5, c, 0, false); box(p, 0.06, 0.05, len, fr(), fixedL, y + 1.0, c); }
    return;
  }
  const all = e.holes.map((hl) => ({ ...hl, a0: Math.max(a0, L(hl.a0)), a1: Math.min(a1, L(hl.a1)) })).filter((hl) => hl.a1 - hl.a0 > 0.05).sort((p1, p2) => p1.a0 - p2.a0);
  // Round windows sit on a solid wall (a glass disc in a ring), so they do not cut it.
  const holes = all.filter((hl) => hl.kind !== 'round');
  const outSide = fixedL - inward * (t / 2 + 0.012);
  for (const hl of all.filter((q) => q.kind === 'round')) {
    const rad = Math.min((hl.a1 - hl.a0) / 2, (Math.min(hl.head, h) - hl.sill) / 2), cc = (hl.a0 + hl.a1) / 2, cy = y + hl.sill + rad;
    const disc = cyl(p, rad - 0.04, rad - 0.04, 0.02, K.m('#2C3B43', { r: 0.05, mt: 0.4, op: 0.85 }), 0, 0, 0, 32);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rad - 0.03, 0.045, 8, 40), fr()); ring.castShadow = true; p.add(ring);
    for (const o of [disc, ring]) {
      if (axis === 'x') { o.position.set(cc, cy, outSide); if (o === disc) o.rotation.x = Math.PI / 2; }
      else { o.position.set(outSide, cy, cc); if (o === disc) o.rotation.z = Math.PI / 2; else o.rotation.y = Math.PI / 2; }
    }
  }
  let cur = a0;
  for (const hl of holes) {
    if (hl.a0 > cur) seg(p, axis, fixedL, cur, hl.a0, y, h, t, mNeg, mPos, cap);
    const s0 = Math.max(cur, hl.a0);
    if (hl.a1 > s0) {
      const sill = Math.min(hl.sill, h), head = Math.min(hl.head, h);
      if (sill > 0) seg(p, axis, fixedL, s0, hl.a1, y, sill, t, mNeg, mPos, cap);
      if (head < h) seg(p, axis, fixedL, s0, hl.a1, y + head, h - head, t, mNeg, mPos, cap);
      if ((hl.kind === 'window' || hl.kind === 'glass' || hl.kind === 'high' || hl.kind === 'fins') && head - sill > 0.15) glassRun(p, axis, fixedL, s0, hl.a1, y + sill, head - sill, K, s.colors.frame);
      if (hl.kind === 'fins' && head - sill > 0.5) {
        // Vertical sun fins just outside the glass.
        const finM = K.m(s.colors.wood, { r: 0.55, mt: 0.2 }), off = fixedL - inward * (t / 2 + 0.12), n = Math.max(2, Math.round((hl.a1 - s0) / 0.22));
        for (let k = 0; k <= n; k++) {
          const a = s0 + 0.04 + ((hl.a1 - s0 - 0.08) * k) / n;
          if (axis === 'x') box(p, 0.05, head - sill, 0.16, finM, a, y + sill + (head - sill) / 2, off, 0.01);
          else box(p, 0.16, head - sill, 0.05, finM, off, y + sill + (head - sill) / 2, a, 0.01);
        }
      }
      if (hl.kind === 'open' && e.perimeter && e.room.type === 'garage' && head > 1) {
        // Sectional garage door with a row of small windows.
        const gd = K.m('#F4F2EE', { r: 0.6 }), dw = hl.a1 - s0 - 0.1, cc = (s0 + hl.a1) / 2, hh = Math.min(head, h) - 0.05;
        const off = fixedL - inward * 0.02;
        if (axis === 'x') box(p, dw, hh, 0.06, gd, cc, y + hh / 2, off, 0.01); else box(p, 0.06, hh, dw, gd, off, y + hh / 2, cc, 0.01);
        for (let k = 1; k < 4; k++) { const yy = y + (hh * k) / 4; if (axis === 'x') box(p, dw, 0.02, 0.08, K.m('#D9D6D0'), cc, yy, off); else box(p, 0.08, 0.02, dw, K.m('#D9D6D0'), off, yy, cc); }
        const gw = K.m('#2C3B43', { r: 0.1, mt: 0.3 });
        if (axis === 'x') box(p, dw * 0.8, 0.3, 0.07, gw, cc, y + hh * 0.82, off); else box(p, 0.07, 0.3, dw * 0.8, gw, off, y + hh * 0.82, cc);
      }
      if (s.shutters && hl.kind === 'window' && e.perimeter && head - sill > 0.6) {
        // A pair of louvred shutters beside the window.
        const shM = K.m(s.colors.wood, { r: 0.6 }), sw = Math.min(0.55, (hl.a1 - s0) * 0.45), hh = head - sill, off = fixedL - inward * (t / 2 + 0.04);
        for (const a of [s0 - sw / 2 - 0.04, hl.a1 + sw / 2 + 0.04]) {
          if (axis === 'x') box(p, sw, hh, 0.05, shM, a, y + sill + hh / 2, off, 0.01); else box(p, 0.05, hh, sw, shM, off, y + sill + hh / 2, a, 0.01);
        }
      }
      if (hl.kind === 'front' && head > 0.5) {
        if (hl.door === 'sliding') glassRun(p, axis, fixedL, s0, hl.a1, y, head, K, s.colors.frame);
        else if (hl.door !== 'opening') {
          // One leaf, or two meeting in the middle.
          const door = K.m(s.colors.wood, { r: 0.6 }), n = hl.door === 'double' ? 2 : 1, dw = (hl.a1 - s0 - 0.08) / n - (n > 1 ? 0.01 : 0);
          for (let k = 0; k < n; k++) {
            const cc = s0 + 0.04 + dw / 2 + k * (dw + 0.02);
            if (axis === 'x') box(p, dw, head - 0.04, 0.06, door, cc, y + head / 2, fixedL, 0.01); else box(p, 0.06, head - 0.04, dw, door, fixedL, y + head / 2, cc, 0.01);
          }
        }
      }
    }
    cur = Math.max(cur, hl.a1);
  }
  if (a1 > cur) seg(p, axis, fixedL, cur, a1, y, h, t, mNeg, mPos, cap);
}

/** Pieces of rectangle `a` not covered by rectangle `b`. */
function rectMinus(a: Rect, b: Rect | null): Rect[] {
  if (!b) return [a];
  const x0 = Math.max(a.x, b.x), x1 = Math.min(a.x + a.w, b.x + b.w), z0 = Math.max(a.z, b.z), z1 = Math.min(a.z + a.d, b.z + b.d);
  if (x1 <= x0 || z1 <= z0) return [a];
  const out: Rect[] = [];
  if (z0 > a.z) out.push({ x: a.x, z: a.z, w: a.w, d: z0 - a.z });
  if (a.z + a.d > z1) out.push({ x: a.x, z: z1, w: a.w, d: a.z + a.d - z1 });
  if (x0 > a.x) out.push({ x: a.x, z: z0, w: x0 - a.x, d: z1 - z0 });
  if (a.x + a.w > x1) out.push({ x: x1, z: z0, w: a.x + a.w - x1, d: z1 - z0 });
  return out.filter((r) => r.w > 0.05 && r.d > 0.05);
}

/** Floor slab over a rectangle with openings where stairs come up. */
function slab(p: THREE.Object3D, s: HouseSpec, yTop: number, area: Rect, voids: PRoom[], mat: Mat) {
  const X0 = area.x, X1 = area.x + area.w, Z0 = area.z, Z1 = area.z + area.d;
  const xs = [...new Set([X0, X1, ...voids.flatMap((v) => [v.x, v.x + v.w])])].filter((v) => v >= X0 && v <= X1).sort((a, b) => a - b);
  const zs = [...new Set([Z0, Z1, ...voids.flatMap((v) => [v.z, v.z + v.d])])].filter((v) => v >= Z0 && v <= Z1).sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
    if (voids.some((v) => cx > v.x && cx < v.x + v.w && cz > v.z && cz < v.z + v.d)) continue;
    const x0 = xs[i] - (i === 0 ? 0.15 : 0), x1 = xs[i + 1] + (i === xs.length - 2 ? 0.15 : 0);
    const z0 = zs[j] - (j === 0 ? 0.15 : 0), z1 = zs[j + 1] + (j === zs.length - 2 ? 0.15 : 0);
    box(p, x1 - x0, SLAB, z1 - z0, mat, (x0 + x1) / 2 - s.w / 2, yTop - SLAB / 2, (z0 + z1) / 2 - s.d / 2);
  }
}

function stairs(p: THREE.Object3D, s: HouseSpec, r: PRoom, y: number, rise: number, K: Kit) {
  const along = r.d >= r.w ? 'z' : 'x';
  const n = Math.max(4, Math.ceil(s.floorH / 0.18)), stepH = s.floorH / n;
  const run = (along === 'z' ? r.d : r.w) - 0.3, wid = (along === 'z' ? r.w : r.d) - 0.25, dep = run / n;
  const wood = K.m(s.colors.wood, { r: 0.6 }), side = K.m('#E9E4DC');
  const steps = Math.min(n, Math.ceil(rise / stepH));
  const cx = r.x + r.w / 2 - s.w / 2, cz = r.z + r.d / 2 - s.d / 2;
  for (let i = 0; i < steps; i++) {
    const hgt = (i + 1) * stepH, off = (along === 'z' ? r.d : r.w) / 2 - 0.15 - dep * (i + 0.5);
    if (along === 'z') box(p, wid, hgt, dep, wood, cx, y + hgt / 2, cz + off);
    else box(p, dep, hgt, wid, wood, cx + off, y + hgt / 2, cz);
  }
  const h2 = steps * stepH;
  if (along === 'z') box(p, 0.06, h2, run, side, cx + wid / 2 + 0.03, y + h2 / 2, cz);
  else box(p, run, h2, 0.06, side, cx, y + h2 / 2, cz + wid / 2 + 0.03);
}

/** Triangle-strip helper: closed solid from an outline extruded along z. */
function prism(shape: [number, number][], depth: number, mat: Mat) {
  const sh = new THREE.Shape();
  shape.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true;
  return m;
}
function hipMesh(A: number, B: number, H: number, mat: Mat) {
  const r = Math.max(0, A - B);
  const v = (x: number, yy: number, z: number) => [x, yy, z];
  const c1 = v(-A, 0, -B), c2 = v(A, 0, -B), c3 = v(A, 0, B), c4 = v(-A, 0, B), r1 = v(-r, H, 0), r2 = v(r, H, 0);
  const tris = [c4, c3, r2, c4, r2, r1, c2, c1, r1, c2, r1, r2, c1, c4, r1, c3, c2, r2, c1, c2, c3, c1, c3, c4].flat();
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true;
  return m;
}

/** Main roof over a W x D rectangle, centred on the group origin, sitting at height y. */
function roof(p: THREE.Object3D, s: HouseSpec, y: number, K: Kit, W: number, D: number, wallM: Mat, gableM: Mat = wallM) {
  const rc = K.m(s.colors.roof, { r: 0.75 }), rcd = K.own(new THREE.MeshStandardMaterial({ color: s.colors.roof, roughness: 0.75, side: THREE.DoubleSide, flatShading: true }));
  const fr = K.m(s.colors.frame, { r: 0.45 }), trim = K.m(s.colors.wood, { r: 0.6 });
  if (s.roof === 'flat' || s.roof === 'terrace') {
    const o = 0.15;
    box(p, W + 2 * o, 0.3, D + 2 * o, wallM, 0, y + 0.15, 0, 0.03);
    box(p, W + 2 * o - 0.3, 0.02, D + 2 * o - 0.3, rc, 0, y + 0.31, 0, 0, false);
    if (s.roof === 'flat') {
      const ph = 0.45, t = 0.15;
      box(p, W + 2 * o, ph, t, wallM, 0, y + 0.3 + ph / 2, D / 2 + o - t / 2);
      box(p, W + 2 * o, ph, t, wallM, 0, y + 0.3 + ph / 2, -D / 2 - o + t / 2);
      box(p, t, ph, D + 2 * o, wallM, W / 2 + o - t / 2, y + 0.3 + ph / 2, 0);
      box(p, t, ph, D + 2 * o, wallM, -W / 2 - o + t / 2, y + 0.3 + ph / 2, 0);
    } else {
      const rail = K.m('#CFE6EE', { r: 0.05, op: 0.35 }), deck = K.m(s.colors.wood, { r: 0.8 });
      plant(p, W / 2 - 0.8, y + 0.33, D / 2 - 0.8, 1.6, K);
      box(p, W - 0.4, 0.04, D - 0.4, deck, 0, y + 0.33, 0, 0, false);
      for (const [w, d, x, z] of [[W + 2 * o, 0.03, 0, D / 2 + o], [W + 2 * o, 0.03, 0, -D / 2 - o], [0.03, D + 2 * o, W / 2 + o, 0], [0.03, D + 2 * o, -W / 2 - o, 0]]) {
        box(p, w, 1.0, d, rail, x, y + 0.8, z, 0, false);
        box(p, Math.max(w, 0.06), 0.05, Math.max(d, 0.06), fr, x, y + 1.3, z);
      }
      box(p, 1.4, 2.3, 1.6, wallM, -W / 2 + 0.9, y + 1.45, -D / 2 + 1.0, 0.03);
    }
    return;
  }
  const alongX = s.ridge ? s.ridge === 'x' : W >= D;
  const o = s.roof === 'thai' ? 0.9 : 0.6;
  const L = (alongX ? W : D) + 2 * o, S = (alongX ? D : W) + 2 * o, Sh = alongX ? D : W, Lh = alongX ? W : D;
  const turn = (m: THREE.Object3D) => { if (alongX) m.rotation.y = Math.PI / 2; return m; };
  const gableEnds = (profile: (span: number) => [number, number][]) => {
    for (const sgn of [-1, 1]) {
      const tm = prism(profile(Sh), 0.2, gableM); tm.position.y = y;
      if (alongX) { tm.rotation.y = Math.PI / 2; tm.position.x = sgn * (Lh / 2 - 0.1); } else tm.position.z = sgn * (Lh / 2 - 0.1);
      p.add(tm);
    }
  };
  if (s.roof === 'gable' || s.roof === 'thai') {
    const k = s.roof === 'thai' ? 1.05 : s.pitch ?? 0.58;
    const H = (S / 2) * k;
    // Two thin slopes (not a solid wedge), so the gable wall under the overhang stays visible.
    const slopeLen = Math.hypot(S / 2, H) + 0.06, ang = Math.atan2(H, S / 2), th = 0.14;
    const rg = new THREE.Group(); rg.position.y = y + 0.05; turn(rg); p.add(rg);
    for (const side of [-1, 1]) {
      const sl = box(rg, slopeLen, th, L, rc, side * S / 4, H / 2 + th / 2, 0, 0.01);
      sl.rotation.z = -side * ang;
      // fascia board along the eave
      box(rg, 0.06, 0.2, L, K.m(s.colors.frame, { r: 0.5 }), side * (S / 2 + 0.01), -0.02, 0);
    }
    box(rg, 0.16, 0.12, L + 0.02, rc, 0, H + th, 0);
    // Barge boards along the sloped edges of each gable.
    for (const z of [-L / 2 + 0.02, L / 2 - 0.02]) for (const side of [-1, 1]) {
      const bb = box(rg, slopeLen, 0.18, 0.06, K.m(s.colors.frame, { r: 0.5 }), side * S / 4, H / 2 + th / 2, z);
      bb.rotation.z = -side * ang;
    }
    gableEnds((sp) => [[-sp / 2, 0], [0, (sp / 2) * k], [sp / 2, 0]]);
    if (s.roof === 'gable' && s.crossGables && alongX) {
      // Street-facing gables cutting into the front slope.
      const n = s.crossGables, wG = Math.min(Lh * (n === 1 ? 0.42 : n === 2 ? 0.34 : 0.27), 5.6), hg = Math.min(H * 0.8, (wG / 2) * k);
      const wGe = hg / k * 2, slope = Math.hypot(wGe / 2 + 0.3, hg) + 0.04, ang2 = Math.atan2(hg, wGe / 2 + 0.3);
      const zlen = Sh / 2 + o + 0.15;
      const xs = n === 1 ? [Lh * 0.12] : Array.from({ length: n }, (_, i) => -Lh / 2 + wGe / 2 + 0.4 + ((Lh - wGe - 0.8) * i) / (n - 1));
      for (const xc of xs) {
        const cg = new THREE.Group(); cg.position.set(xc, y + 0.05, zlen / 2); p.add(cg);
        for (const side of [-1, 1]) {
          const sl = box(cg, slope, 0.14, zlen, rc, side * (wGe / 2 + 0.3) / 2, hg / 2 + 0.07, 0, 0.01); sl.rotation.z = -side * ang2;
          const bb = box(cg, slope, 0.18, 0.06, K.m(s.colors.frame, { r: 0.5 }), side * (wGe / 2 + 0.3) / 2, hg / 2 + 0.07, zlen / 2 - 0.02); bb.rotation.z = -side * ang2;
        }
        const tri = prism([[-wGe / 2, 0], [0, hg], [wGe / 2, 0]], 0.3, gableM); tri.position.set(xc, y, Sh / 2 + 0.05); p.add(tri);
        box(p, wGe + 0.1, 0.12, 0.34, K.m(s.colors.frame, { r: 0.5 }), xc, y + 0.06, Sh / 2 + 0.05);
      }
    }
    if (s.roof === 'thai') {
      // Thai gable boards (pan lom) with upturned finials at the eaves and ridge.
      for (const sgn of [-1, 1]) {
        const g = new THREE.Group(); g.position.y = y + 0.08; if (alongX) { g.rotation.y = Math.PI / 2; } p.add(g);
        const zEnd = sgn * (L / 2 - 0.02);
        for (const side of [-1, 1]) {
          const len = Math.hypot(S / 2, H), ang = Math.atan2(H, S / 2);
          const b = box(g, len, 0.12, 0.06, trim, side * S / 4, H / 2, zEnd);
          b.rotation.z = -side * ang;
          const tip = box(g, 0.1, 0.45, 0.06, trim, side * (S / 2 + 0.02), 0.18, zEnd); tip.rotation.z = side * 0.5;
        }
        box(g, 0.1, 0.55, 0.06, trim, 0, H + 0.2, zEnd);
      }
    }
    return;
  }
  if (s.roof === 'gambrel') {
    const H = (S / 2) * 0.85;
    const prof = (sp: number, hh: number): [number, number][] => [[-sp / 2, 0], [-sp * 0.33, hh * 0.62], [0, hh], [sp * 0.33, hh * 0.62], [sp / 2, 0]];
    const m = turn(prism(prof(S, H), L, rc)); m.position.y = y + 0.05; p.add(m);
    gableEnds((sp) => prof(sp, (sp / 2) * 0.85));
    // A dormer-like window in each gable end.
    for (const sgn of [-1, 1]) {
      const wy = y + H * 0.35, off = sgn * (Lh / 2 + 0.02);
      if (alongX) box(p, 0.06, 0.8, 0.9, K.m('#2C3B43', { r: 0.05, mt: 0.4 }), off, wy, 0); else box(p, 0.9, 0.8, 0.06, K.m('#2C3B43', { r: 0.05, mt: 0.4 }), 0, wy, off);
    }
    return;
  }
  if (s.roof === 'hip' || s.roof === 'irimoya') {
    const A = L / 2, B = S / 2, H = B * (s.roof === 'irimoya' ? 0.5 : 0.55);
    const m = hipMesh(A, B, H, rcd); m.position.y = y + 0.05; if (!alongX) m.rotation.y = Math.PI / 2; p.add(m);
    if (alongX) { box(p, L, 0.14, 0.06, wallM, 0, y + 0.02, B); box(p, L, 0.14, 0.06, wallM, 0, y + 0.02, -B); box(p, 0.06, 0.14, S, wallM, A, y + 0.02, 0); box(p, 0.06, 0.14, S, wallM, -A, y + 0.02, 0); }
    else { box(p, S, 0.14, 0.06, wallM, 0, y + 0.02, A); box(p, S, 0.14, 0.06, wallM, 0, y + 0.02, -A); box(p, 0.06, 0.14, L, wallM, B, y + 0.02, 0); box(p, 0.06, 0.14, L, wallM, -B, y + 0.02, 0); }
    if (s.roof === 'irimoya') {
      // Japanese hip-and-gable: a small gable sits on top of the hip, with a dark ridge.
      const s2 = S * 0.42, h2 = (s2 / 2) * 0.9, l2 = Math.max(1, L - S * 0.55);
      const top = turn(prism([[-s2 / 2, 0], [0, h2], [s2 / 2, 0]], l2, rc)); top.position.y = y + 0.05 + H * 0.62; p.add(top);
      const ridge = box(p, alongX ? l2 + 0.3 : 0.16, 0.16, alongX ? 0.16 : l2 + 0.3, K.m('#1E1F21', { r: 0.6 }), 0, y + 0.05 + H * 0.62 + h2, 0);
      ridge.castShadow = true;
      for (const sgn of [-1, 1]) {
        const tm = prism([[-s2 / 2 + 0.1, 0], [0, h2 - 0.05], [s2 / 2 - 0.1, 0]], 0.05, trim); tm.position.y = y + 0.05 + H * 0.62;
        if (alongX) { tm.rotation.y = Math.PI / 2; tm.position.x = sgn * (l2 / 2 + 0.01); } else tm.position.z = sgn * (l2 / 2 + 0.01);
        p.add(tm);
      }
    }
    return;
  }
  // Mono-pitch: high at the back, low at the front.
  const Dd = D + 2 * o, rise = Math.max(0.6, D * 0.18), len = Math.hypot(Dd, rise), ang = Math.atan2(rise, Dd);
  const m = box(p, W + 2 * o, 0.16, len, rc, 0, y + rise / 2 + 0.1, 0);
  m.rotation.x = ang;
  const hF = 0.02 + rise * (0.5 - D / (2 * Dd)), hB = 0.02 + rise * (0.5 + D / (2 * Dd));
  for (const sgn of [-1, 1]) {
    const tm = prism([[-D / 2, 0], [D / 2, 0], [D / 2, hB], [-D / 2, hF]], 0.2, wallM); tm.rotation.y = Math.PI / 2; tm.position.set(sgn * (W / 2 - 0.1), y, 0);
    p.add(tm);
  }
  box(p, W, hF, 0.2, wallM, 0, y + hF / 2, D / 2 - 0.1);
  if (hB > 0.4) glassRun(p, 'x', -D / 2 + 0.1, -W / 2 + 0.2, W / 2 - 0.2, y, hB - 0.05, K, s.colors.frame);
}

/** Flat roof over the part of a lower floor that has nothing on top (1.5-storey houses). */
function lowerRoof(p: THREE.Object3D, s: HouseSpec, y: number, r: Rect, K: Kit, wallM: Mat) {
  const cx = r.x + r.w / 2 - s.w / 2, cz = r.z + r.d / 2 - s.d / 2;
  box(p, r.w + 0.3, 0.26, r.d + 0.3, wallM, cx, y + 0.13, cz, 0.03);
  box(p, r.w + 0.1, 0.03, r.d + 0.1, K.m(s.colors.roof, { r: 0.75 }), cx, y + 0.275, cz, 0, false);
  if (s.planters) {
    // A clipped hedge along the street edge, and a small tree if there is room for a roof garden.
    const hedge = K.m('#4F7A3A', { r: 1 }), hedge2 = K.m('#5E8C45', { r: 1 });
    if (r.z + r.d >= s.d - 0.01) { box(p, r.w + 0.2, 0.55, 0.55, hedge, cx, y + 0.55, cz + r.d / 2 - 0.12, 0.12); box(p, r.w, 0.12, 0.4, hedge2, cx, y + 0.86, cz + r.d / 2 - 0.12, 0.06); }
    if (r.w * r.d > 10) plant(p, cx - r.w / 4, y + 0.29, cz - r.d / 6, Math.min(3.2, 1.8 + r.w * 0.12), K);
  }
}

/** A deep picture frame around a floor (stone or white bands that stick out past the walls). */
function floorFrame(p: THREE.Object3D, s: HouseSpec, fr: Rect, y: number, h: number, mat: Mat) {
  const o = 0.45, t = 0.28, X = fr.x + fr.w / 2 - s.w / 2, Z = fr.z + fr.d / 2 - s.d / 2;
  for (const yy of [y + h + SLAB / 2 - t / 2, y - SLAB / 2 + 0.02]) {
    box(p, fr.w + 2 * o, t, o, mat, X, yy, Z + fr.d / 2 + o / 2 - 0.02, 0.02);
    box(p, fr.w + 2 * o, t, o, mat, X, yy, Z - fr.d / 2 - o / 2 + 0.02, 0.02);
    box(p, o, t, fr.d, mat, X - fr.w / 2 - o / 2 + 0.02, yy, Z, 0.02);
    box(p, o, t, fr.d, mat, X + fr.w / 2 + o / 2 - 0.02, yy, Z, 0.02);
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(p, o, h + SLAB, o, mat, X + sx * (fr.w / 2 + o / 2 - 0.02), y + (h + SLAB) / 2 - SLAB / 2, Z + sz * (fr.d / 2 + o / 2 - 0.02), 0.02);
}

/** The house on its own, centred on the origin, standing on y = 0. */
export function buildSpecHouse(s: HouseSpec, opts: BuildOpts = {}) {
  const K = new Kit(), G = new THREE.Group();
  G.userData.kit = K;
  const cut = opts.cut != null ? Math.min(opts.cut, s.floors - 1) : null;
  const top = cut ?? s.floors - 1;
  const looks = new Map<string, Mat>();
  const finishMat = (f: Finish | undefined, color: string): Mat => {
    const key = `${f}|${color}`;
    if (looks.has(key)) return looks.get(key)!;
    const tex = finishTexture(f);
    let m: Mat;
    if (tex) {
      const map = tex.map.clone(); map.needsUpdate = true; map.repeat.set(1 / tex.size, 1 / tex.size);
      m = K.own(new THREE.MeshStandardMaterial({ color, map, roughness: f === 'marble' ? 0.45 : f === 'metal' ? 0.5 : 0.85, metalness: f === 'metal' ? 0.35 : 0 }));
    } else m = K.m(color, { r: 0.9 });
    looks.set(key, m);
    return m;
  };
  const wallM = finishMat(s.finish, s.colors.wall);
  const gableM = s.gableFinish ? finishMat(s.gableFinish, s.gableFinish === 'wood' ? s.colors.wood : s.colors.wall) : undefined;
  const plainM = K.m(s.finish && s.finish !== 'plaster' ? '#EDE8E0' : s.colors.wall, { r: 0.9 });
  const neutral = K.m('#F3F0EB', { r: 0.95 });
  const postM = K.m(s.finish === 'wood' ? s.colors.wood : '#DCD6CC', { r: 0.7 });
  box(G, s.w + 0.4, PLINTH, s.d + 0.4, K.m('#E4DED6', { r: 0.9 }), 0, PLINTH / 2, 0, 0.03);

  for (let fi = 0; fi <= top; fi++) {
    const y = floorY(s, fi), isCut = cut === fi, h = isCut ? CUT_H : s.floorH - SLAB;
    if (fi > 0) slab(G, s, y, floorRect(s, fi), stairVoids(s, fi), plainM);
    const rooms = s.levels[fi] ?? [];
    const { edges } = floorEdges(s, fi);
    const paints = new Map(rooms.map((r) => [r.id, K.m(r.paint, { r: 0.95 })]));
    const groups = new Map<string, THREE.Group>();
    for (const r of rooms) {
      const rg = new THREE.Group(); rg.userData.roomId = r.id; G.add(rg); groups.set(r.id, rg);
      const voidBelow = fi > 0 && r.type === 'stairs';
      const fm = voidBelow ? K.m('#E9694B', { op: 0.35 }) : K.own(new THREE.MeshStandardMaterial({ color: finOf(r.floor)[2], roughness: r.floor === 'marble' ? 0.3 : 0.8 }));
      if (!voidBelow && opts.sel === r.id) { (fm as THREE.MeshStandardMaterial).emissive = new THREE.Color('#E9694B'); (fm as THREE.MeshStandardMaterial).emissiveIntensity = 0.45; }
      if (!voidBelow || opts.sel === r.id) {
        // Floor tile follows the room outline (L-shapes and cut corners included).
        const pts = roomPoly(r);
        const sh = new THREE.Shape();
        pts.forEach((q, i) => (i ? sh.lineTo(q.x - s.w / 2, q.z - s.d / 2) : sh.moveTo(q.x - s.w / 2, q.z - s.d / 2)));
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false });
        g.rotateX(Math.PI / 2);
        const m = new THREE.Mesh(g, fm); m.position.y = y + 0.03; m.receiveShadow = true; rg.add(m);
      }
      if (r.type === 'stairs' && fi < s.floors - 1) stairs(rg, s, r, y, isCut ? 1.1 : s.floorH, K);
      if (r.type === 'undercroft') columns(rg, s, r, y, isCut ? CUT_H : s.floorH - SLAB, postM, 2.6);
      if (r.type === 'terrace' && !isCut) columns(rg, s, r, y, s.floorH - SLAB, postM);
      if (opts.furniture !== false) furnishPlaced(rg, roomRect(s, r), y + 0.03, r, K, isCut);
      if (isCut && opts.markers) {
        const m = mainRect(r);
        const mk = new THREE.Object3D(); mk.position.set(m.x + m.w / 2 - s.w / 2, y + 1.1, m.z + m.d / 2 - s.d / 2); G.add(mk);
        opts.markers.push({ id: r.id, obj: mk });
      }
    }
    const look = s.floorLooks?.[fi];
    const floorWall = look && (look.finish || look.color) ? finishMat(look.finish ?? s.finish, look.color ?? s.colors.wall) : wallM;
    const garageWall = s.garageLook ? finishMat(s.garageLook.finish ?? s.finish, s.garageLook.color ?? s.colors.wall) : null;
    for (const e of edges) {
      const outerM = !e.perimeter ? neutral : garageWall && e.room.type === 'garage' ? garageWall : floorWall;
      buildEdge(groups.get(e.room.id)!, s, e, y, h, K, paints.get(e.room.id)!, outerM, e.perimeter ? plainM : neutral);
    }
    // Posts the user placed: floor to ceiling, square or round.
    for (const q of (s.posts ?? []).filter((q) => q.floor === fi)) {
      const ph = h + (isCut ? 0 : SLAB * 0.5), px = q.x - s.w / 2, pz = q.z - s.d / 2;
      if (q.round) { const c = cyl(G, q.size / 2, q.size / 2, ph, postM, px, y + ph / 2, pz, 24); c.userData.postId = q.id; }
      else box(G, q.size, ph, q.size, postM, px, y + ph / 2, pz, 0.01);
    }
    const fr = floorRect(s, fi);
    if (look?.frame && !isCut) floorFrame(G, s, fr, y, h, look.finish === 'metal' ? floorWall : wallM);
    const light = new THREE.PointLight('#FFAE5E', isCut ? 2 : 4, Math.max(fr.w, fr.d) * 1.2, 2);
    light.position.set(fr.x + fr.w / 2 - s.w / 2, y + Math.min(2.4, h + 1.6), fr.z + fr.d / 2 - s.d / 2); G.add(light);
    // Parts of this floor with no floor above get their own roof.
    if (cut == null && fi < s.floors - 1) for (const r of rectMinus(fr, floorRect(s, fi + 1))) lowerRoof(G, s, y + s.floorH - SLAB, r, K, plainM);
  }
  if (cut == null) {
    const fr = mainRoofRect(s), yTop = floorY(s, s.floors - 1) + s.floorH - SLAB;
    const rg = new THREE.Group(); rg.position.set(fr.x + fr.w / 2 - s.w / 2, 0, fr.z + fr.d / 2 - s.d / 2); G.add(rg);
    roof(rg, s, yTop, K, fr.w, fr.d, plainM, gableM ?? (s.finish && s.finish !== 'plaster' ? wallM : plainM));
    // A carport beside a pitched roof gets its own flat roof.
    for (const r of rectMinus(floorRect(s, s.floors - 1), fr)) lowerRoof(G, s, yTop, r, K, plainM);
  }
  return G;
}

/** Position of the house centre on its plot (plot centred on the origin, front = +z). */
export function housePlace(s: HouseSpec) {
  const PW = s.site.plotW * 2, PD = s.site.plotD * 2;
  return { x: -PW / 2 + s.site.left + s.w / 2, z: PD / 2 - s.site.front - s.d / 2 };
}

/** Plot with lawn, path, trees and the house: used by the builder preview. */
export function buildSite(s: HouseSpec, opts: BuildOpts = {}) {
  const K = new Kit(), G = new THREE.Group();
  G.userData.kit = K;
  const PW = s.site.plotW * 2, PD = s.site.plotD * 2;
  box(G, PW + 0.6, 0.6, PD + 0.6, K.m('#30343A', { r: 0.7 }), 0, -0.4, 0, 0.05);
  box(G, PW + 0.5, 0.12, PD + 0.5, K.m('#F2EEE8', { r: 0.9 }), 0, -0.06, 0, 0.03, false);
  box(G, PW, 0.08, PD, K.m('#97B865', { r: 1 }), 0, -0.03, 0, 0, false);
  const hp = housePlace(s);
  const house = buildSpecHouse(s, opts);
  house.position.set(hp.x, 0, hp.z);
  G.add(house);
  const { doors, edges } = floorEdges(s, 0);
  const pave = K.m('#DDD6CC', { r: 0.9 });
  const frontZ = hp.z + s.d / 2 + 0.2, depth = PD / 2 - frontZ;
  if (depth > 0.2) {
    for (const fd of doors.filter((d) => d.front && d.axis === 'x' && Math.abs(d.fixed - s.d) < 0.01)) box(G, 1.4, 0.03, depth, pave, hp.x - s.w / 2 + fd.c, 0.015, frontZ + depth / 2, 0, false);
    const g = edges.find((e) => e.room.type === 'garage' && e.side === 's');
    if (g) box(G, g.a1 - g.a0, 0.03, depth, K.m('#C9C3BA', { r: 0.9 }), hp.x - s.w / 2 + (g.a0 + g.a1) / 2, 0.016, frontZ + depth / 2, 0, false);
  }
  const spots: [number, number][] = [[-PW / 2 + 1.2, -PD / 2 + 1.2], [PW / 2 - 1.2, -PD / 2 + 1.2], [-PW / 2 + 1.2, PD / 2 - 1.2], [PW / 2 - 1.2, PD / 2 - 1.2], [-PW / 2 + 1.2, 0], [PW / 2 - 1.2, 0]];
  let i = 0;
  for (const [x, z] of spots) {
    const clear = x < hp.x - s.w / 2 - 1.2 || x > hp.x + s.w / 2 + 1.2 || z < hp.z - s.d / 2 - 1.2 || z > hp.z + s.d / 2 + 1.2;
    if (clear) { tree(G, x, z, 0.9 + (i % 3) * 0.12, K, i); i++; }
  }
  if (PW > s.w + 3) for (let k = 0; k < 4; k++) bush(G, -PW / 2 + 0.5, -PD / 4 + k * 0.7, 0.8, K, k);
  void worldUV;
  return { group: G, house };
}
