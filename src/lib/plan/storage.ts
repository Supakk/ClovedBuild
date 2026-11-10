// Browser storage for the builder: the working draft, saved designs, and the hand-off to the simulator.
import type { HouseSpec } from './spec';

const DRAFT = 'cloved-builder-draft';
const DESIGNS = 'cloved-designs';
const HANDOFF = 'cloved-sim-handoff';

export interface SavedDesign { id: string; name: string; savedAt: number; spec: HouseSpec }

const read = <T,>(k: string): T | null => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch { return null; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

const valid = (s: any): s is HouseSpec => !!s && Array.isArray(s.levels) && typeof s.w === 'number' && !!s.site;

export const loadDraft = () => { const s = read<HouseSpec>(DRAFT); return valid(s) ? s : null; };
export const saveDraft = (s: HouseSpec) => write(DRAFT, s);

export const listDesigns = () => (read<SavedDesign[]>(DESIGNS) ?? []).filter((d) => valid(d.spec));
export function saveDesign(spec: HouseSpec, id?: string): SavedDesign {
  const list = listDesigns();
  const d: SavedDesign = { id: id ?? `d${Date.now().toString(36)}`, name: spec.name || 'My house', savedAt: Date.now(), spec };
  const i = list.findIndex((x) => x.id === d.id);
  if (i >= 0) list[i] = d; else list.unshift(d);
  write(DESIGNS, list.slice(0, 30));
  return d;
}
export function deleteDesign(id: string) { write(DESIGNS, listDesigns().filter((d) => d.id !== id)); }

export const setHandoff = (spec: HouseSpec) => write(HANDOFF, spec);
export function takeHandoff(): HouseSpec | null {
  const s = read<HouseSpec>(HANDOFF);
  try { localStorage.removeItem(HANDOFF); } catch { /* ignore */ }
  return valid(s) ? s : null;
}
