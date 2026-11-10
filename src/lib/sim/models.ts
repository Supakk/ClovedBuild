// Low-poly models for the simulator: people, pets, car, pool and garden pieces.
// Every builder returns a group standing on y = 0, facing +z, with its own material Kit in userData.kit.
import * as THREE from 'three';
import { Kit, box, cyl, sph, tree, bush, chair } from '../house/geometry';

function root() {
  const K = new Kit(), g = new THREE.Group();
  g.userData.kit = K;
  return { K, g };
}

/** A person. `height` is in centimetres; the figure is modelled at 170 cm and scaled. */
export function person(height: number, shirt: string, pants = '#3E4A5C', skin = '#E8B993', hair = '#2E2420') {
  const { K, g } = root();
  const body = new THREE.Group(); g.add(body);
  const shirtM = K.m(shirt), pantsM = K.m(pants), skinM = K.m(skin, { r: 0.7 }), hairM = K.m(hair, { r: 0.9 }), shoe = K.m('#2A2826');
  for (const s of [-1, 1]) {
    box(body, 0.13, 0.78, 0.15, pantsM, s * 0.075, 0.43, 0, 0.05);
    box(body, 0.13, 0.07, 0.22, shoe, s * 0.075, 0.035, 0.03, 0.03);
    box(body, 0.1, 0.56, 0.11, shirtM, s * 0.245, 1.08, 0, 0.05);
    sph(body, 0.055, skinM, s * 0.245, 0.77, 0);
  }
  box(body, 0.38, 0.6, 0.23, shirtM, 0, 1.1, 0, 0.09);
  cyl(body, 0.05, 0.055, 0.08, skinM, 0, 1.43, 0, 10);
  sph(body, 0.115, skinM, 0, 1.56, 0.005);
  const cap = sph(body, 0.122, hairM, 0, 1.585, -0.02);
  cap.scale.set(1, 0.85, 1);
  // A short figure keeps a slightly larger head, like a child.
  const s = height / 170;
  body.scale.set(0.82 + 0.18 * s, s, 0.82 + 0.18 * s);
  if (s < 0.8) { cap.scale.multiplyScalar(1.12); }
  return g;
}

export const DOG_SIZES: Record<string, number> = { s: 0.65, m: 1, l: 1.3 };

/** A dog. size: s | m | l. */
export function dog(size: string, coat: string) {
  const { K, g } = root();
  const d = new THREE.Group(); g.add(d);
  const c = K.m(coat, { r: 0.9 }), dark = K.m('#2B2622', { r: 0.6 }), ear = K.m(new THREE.Color(coat).multiplyScalar(0.7).getStyle(), { r: 0.9 });
  box(d, 0.26, 0.26, 0.58, c, 0, 0.44, 0, 0.1);
  for (const [x, z] of [[-0.08, 0.2], [0.08, 0.2], [-0.08, -0.2], [0.08, -0.2]]) cyl(d, 0.04, 0.035, 0.34, c, x, 0.17, z, 8);
  box(d, 0.21, 0.2, 0.22, c, 0, 0.62, 0.33, 0.07);
  box(d, 0.12, 0.1, 0.13, c, 0, 0.57, 0.48, 0.04);
  sph(d, 0.025, dark, 0, 0.6, 0.545);
  for (const s of [-1, 1]) {
    box(d, 0.05, 0.12, 0.08, ear, s * 0.1, 0.68, 0.3, 0.02);
    sph(d, 0.018, dark, s * 0.05, 0.66, 0.44);
  }
  const tail = cyl(d, 0.025, 0.035, 0.26, c, 0, 0.58, -0.33, 8);
  tail.rotation.x = -0.7;
  d.scale.setScalar(DOG_SIZES[size] ?? 1);
  return g;
}

/** A cat. */
export function cat(coat: string) {
  const { K, g } = root();
  const c = K.m(coat, { r: 0.9 }), dark = K.m('#2B2622', { r: 0.6 }), pink = K.m('#E7A3A0');
  box(g, 0.15, 0.15, 0.38, c, 0, 0.24, 0, 0.07);
  for (const [x, z] of [[-0.045, 0.13], [0.045, 0.13], [-0.045, -0.13], [0.045, -0.13]]) cyl(g, 0.024, 0.022, 0.18, c, x, 0.09, z, 8);
  sph(g, 0.095, c, 0, 0.36, 0.22);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 4), c);
    e.position.set(s * 0.05, 0.45, 0.21); e.castShadow = true; g.add(e);
    sph(g, 0.014, dark, s * 0.035, 0.38, 0.305);
  }
  sph(g, 0.012, pink, 0, 0.35, 0.315);
  const t1 = cyl(g, 0.018, 0.022, 0.24, c, 0, 0.33, -0.25, 8); t1.rotation.x = -0.5;
  const t2 = cyl(g, 0.016, 0.018, 0.14, c, 0, 0.48, -0.3, 8); t2.rotation.x = 0.4;
  return g;
}

/** A small hatchback. */
export function car(color: string) {
  const { K, g } = root();
  const paint = K.m(color, { r: 0.35, mt: 0.3 }), glass = K.m('#28343B', { r: 0.1, mt: 0.4 }), tire = K.m('#1F1F21', { r: 0.8 }), rim = K.m('#C9CCCF', { r: 0.3, mt: 0.6 });
  const light = K.m('#FFF4D6', { e: '#FFE7B0', ei: 0.6 }), rear = K.m('#B5332B');
  box(g, 1.78, 0.62, 4.1, paint, 0, 0.55, 0, 0.22);
  box(g, 1.6, 0.56, 2.3, glass, 0, 1.1, -0.25, 0.2);
  box(g, 1.5, 0.06, 2.1, paint, 0, 1.39, -0.25, 0.03);
  for (const [x, z] of [[-0.82, 1.3], [0.82, 1.3], [-0.82, -1.3], [0.82, -1.3]]) {
    const w = cyl(g, 0.33, 0.33, 0.24, tire, x, 0.33, z, 18); w.rotation.z = Math.PI / 2;
    const r = cyl(g, 0.17, 0.17, 0.25, rim, x, 0.33, z, 12); r.rotation.z = Math.PI / 2;
  }
  for (const s of [-1, 1]) { box(g, 0.34, 0.12, 0.05, light, s * 0.6, 0.66, 2.05, 0.02); box(g, 0.34, 0.12, 0.05, rear, s * 0.6, 0.7, -2.05, 0.02); }
  return g;
}

/** A 3 m x 6 m pool with coping. */
export function pool() {
  const { K, g } = root();
  const rim = K.m('#F4F1EC'), water = K.m('#62BFD8', { r: 0.08, mt: 0.1 });
  box(g, 3.6, 0.1, 6.6, rim, 0, 0.05, 0, 0.04, false);
  box(g, 3.0, 0.06, 6.0, water, 0, 0.09, 0, 0, false);
  box(g, 0.6, 0.12, 0.25, K.m('#DDD6CC'), 1.0, 0.12, -3.15, 0.02);
  return g;
}

/** Round table with three chairs. */
export function patioSet() {
  const { K, g } = root();
  const w = K.m('#F7F4EF');
  cyl(g, 0.36, 0.36, 0.04, w, 0, 0.74, 0, 24);
  cyl(g, 0.04, 0.04, 0.72, w, 0, 0.36, 0, 8);
  chair(g, -0.65, 0, Math.PI / 2, K); chair(g, 0.65, 0, -Math.PI / 2, K); chair(g, 0, 0.65, Math.PI, K);
  return g;
}

export function treePiece(scale: number, variant = 0) {
  const { K, g } = root();
  tree(g, 0, 0, scale, K, variant);
  return g;
}

export function bushPiece(variant = 0) {
  const { K, g } = root();
  bush(g, 0, 0, 1.1, K, variant);
  bush(g, 0.32, 0.12, 0.8, K, variant + 1);
  return g;
}

/** Lounger for the garden or pool side. */
export function lounger() {
  const { K, g } = root();
  const w = K.m('#F7F4EF'), cushion = K.m('#E9DCCB');
  box(g, 0.65, 0.28, 1.9, w, 0, 0.14, 0, 0.05);
  box(g, 0.6, 0.08, 1.2, cushion, 0, 0.32, 0.3, 0.04);
  const back = box(g, 0.6, 0.08, 0.7, cushion, 0, 0.5, -0.55, 0.04);
  back.rotation.x = 0.7;
  return g;
}
