// Little isometric pictures of catalogue items, rendered once and cached for the page's lifetime.
import * as THREE from 'three';
import { disposeDiorama } from '../house/geometry';
import { webglOK } from '../house/stage';
import { buildObjectModel } from './world';
import type { SimObject } from './types';
import { preUrl } from '../prerendered';

let r: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.OrthographicCamera } | null | undefined;
const cache = new Map<string, Promise<string | null>>();
let chain: Promise<unknown> = Promise.resolve();
const DIR = new THREE.Vector3(1, 0.8, 1).normalize();

function setup() {
  if (r !== undefined) return r;
  if (!webglOK()) return (r = null);
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(160, 128, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#FFF7F0', '#C9A089', 2.4));
  const sun = new THREE.DirectionalLight('#FFF0DF', 4.5); sun.position.set(-3, 10, 6); scene.add(sun);
  return (r = { renderer, scene, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200) });
}

function render(obj: Omit<SimObject, 'id' | 'x' | 'z'>) {
  const s = setup();
  if (!s) return null;
  const model = buildObjectModel({ ...obj, id: 't', x: 0, z: 0 } as SimObject);
  s.scene.add(model);
  model.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(model), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const rad = Math.max(size.x, size.y, size.z) * 0.62 + 0.05;
  Object.assign(s.cam, { left: -rad * 1.25, right: rad * 1.25, top: rad, bottom: -rad });
  s.cam.updateProjectionMatrix();
  s.cam.position.copy(c).addScaledVector(DIR, 50); s.cam.lookAt(c);
  s.renderer.render(s.scene, s.cam);
  const url = s.renderer.domElement.toDataURL('image/png');
  s.scene.remove(model); disposeDiorama(model);
  return url;
}

/** Picture of a catalogue item; renders one at a time in the background. */
export function itemThumb(key: string, make: () => Omit<SimObject, 'id' | 'x' | 'z'>): Promise<string | null> {
  const pre = preUrl(`item-${key}`);
  if (pre) return Promise.resolve(pre);
  let p = cache.get(key);
  if (!p) {
    p = chain.then(() => new Promise<string | null>((res) => setTimeout(() => res(render(make())), 0)));
    chain = p;
    cache.set(key, p);
  }
  return p;
}
