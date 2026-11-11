// Pictures rendered ahead of time (scripts/render-thumbs.mjs) so pages show them without starting WebGL.
import list from './renders.json';

const have = new Set<string>(list as string[]);
/** URL of a pre-rendered picture, or null when it has to be drawn in the browser. */
export const preUrl = (key: string) => (have.has(key) ? `/renders/${key}.webp` : null);
