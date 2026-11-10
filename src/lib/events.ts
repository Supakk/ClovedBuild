// Tiny cross-island messaging. Astro islands are separate React roots, so they talk through window events.
// The last message is also kept here, because an island that hydrates later (client:visible) would miss the event.

export interface ResidenceFilter { location: string; minBeds: number; maxPrice: number }

const PRESET_EVENT = 'studio:load-preset';
const FILTER_EVENT = 'residences:filter';
let pendingPreset: string | null = null;
let lastFilter: ResidenceFilter | null = null;

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

export function loadPresetInStudio(key: string) {
  pendingPreset = key;
  window.dispatchEvent(new CustomEvent(PRESET_EVENT, { detail: key }));
  scrollToId('studio');
}
/** Subscribes, and replays a preset that was picked before the studio hydrated. */
export function onLoadPreset(fn: (key: string) => void) {
  if (pendingPreset) { fn(pendingPreset); pendingPreset = null; }
  const h = (e: Event) => { pendingPreset = null; fn((e as CustomEvent<string>).detail); };
  window.addEventListener(PRESET_EVENT, h);
  return () => window.removeEventListener(PRESET_EVENT, h);
}

export function filterResidences(f: ResidenceFilter) {
  lastFilter = f;
  window.dispatchEvent(new CustomEvent(FILTER_EVENT, { detail: f }));
  scrollToId('residences');
}
export function onFilterResidences(fn: (f: ResidenceFilter) => void) {
  if (lastFilter) fn(lastFilter);
  const h = (e: Event) => fn((e as CustomEvent<ResidenceFilter>).detail);
  window.addEventListener(FILTER_EVENT, h);
  return () => window.removeEventListener(FILTER_EVENT, h);
}
