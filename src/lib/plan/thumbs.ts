// Small pictures of ready-made houses, rendered once in the browser and shared by every component.
import { SpecStage } from './specStage';
import { webglOK } from '../house/stage';
import { presetSpec, type HouseSpec } from './spec';
import { preUrl } from '../prerendered';

let stage: SpecStage | null | undefined;
const cache = new Map<string, Promise<string | null>>();
let chain: Promise<unknown> = Promise.resolve();

function render(spec: HouseSpec, w: number, h: number, site: boolean) {
  if (stage === undefined) stage = webglOK() ? new SpecStage(document.createElement('canvas'), true) : null;
  return stage ? stage.shot(spec, w, h, site) : null;
}

/** Thumbnail of a ready-made house, or of any spec when `spec` is given. Renders one at a time. */
export function houseThumb(key: string, spec?: HouseSpec, w = 320, h = 240, site = false): Promise<string | null> {
  const pre = site ? null : preUrl(`house-${key}`);
  if (pre) return Promise.resolve(pre);
  let p = cache.get(key);
  if (!p) {
    p = chain.then(() => new Promise<string | null>((res) => setTimeout(() => res(render(spec ?? presetSpec(key), w, h, site)), 0)));
    chain = p;
    cache.set(key, p);
  }
  return p;
}
