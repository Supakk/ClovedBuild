// Still pictures of the house for the hero, about section, cards and contact background.
// One offscreen renderer is shared by every island and each picture is rendered once.
import { Stage, webglOK } from './stage';
import { PRESETS, type ViewMode } from './data';

export type ShotKey = 'hero' | 'about' | 'nyc' | 'santorini' | 'rio';

const SPECS: Record<ShotKey, { preset: string; mode: ViewMode; rot: number; w: number; h: number }> = {
  hero: { preset: 'santorini', mode: 'x', rot: 0, w: 1180, h: 1000 },
  about: { preset: 'rio', mode: 'x', rot: 1, w: 1100, h: 960 },
  nyc: { preset: 'nyc', mode: 'x', rot: 0, w: 760, h: 640 },
  santorini: { preset: 'santorini', mode: 'x', rot: 3, w: 760, h: 640 },
  rio: { preset: 'rio', mode: 'u', rot: 0, w: 760, h: 640 },
};

let stage: Stage | null | undefined;
const cache = new Map<ShotKey, Promise<string | null>>();

function getStage() {
  if (stage === undefined) stage = webglOK() ? new Stage(document.createElement('canvas'), true) : null;
  return stage;
}

/** Resolves to a PNG data URL, or null when WebGL is not available. */
export function getShot(key: ShotKey): Promise<string | null> {
  let p = cache.get(key);
  if (!p) {
    p = new Promise((resolve) => {
      // Yield so several islands can mount before the first heavy render.
      setTimeout(() => {
        const s = getStage();
        if (!s) return resolve(null);
        const spec = SPECS[key];
        resolve(s.shot(PRESETS[spec.preset], spec.mode, spec.rot, spec.w, spec.h));
      }, 0);
    });
    cache.set(key, p);
  }
  return p;
}
