// Free-form house description used by the House Builder and the Simulator.
// Pure data and geometry rules (no three.js), so the 2D plan and the 3D model share one source of truth.
import { TYPES, type RoomType } from '../house/data';

export type PType = RoomType | 'hall' | 'stairs' | 'garage' | 'carport' | 'laundry' | 'storage' | 'terrace' | 'undercroft';
export type RoofStyle = 'flat' | 'terrace' | 'gable' | 'hip' | 'shed' | 'thai' | 'irimoya' | 'gambrel';
export type Finish = 'plaster' | 'wood' | 'siding' | 'brick' | 'timber' | 'stone' | 'marble' | 'metal';
export type Side = 'n' | 's' | 'w' | 'e'; // n = back (z0), s = front (z1), w = left (x0), e = right (x1)
export type EdgeSide = Side | 'd'; // 'd' = a diagonal wall
export type Corner = 'nw' | 'ne' | 'sw' | 'se';

/** A non-rectangular room: an L (one corner removed) or a corner cut on the diagonal. a = along x, b = along z, in metres. */
export interface Shape { kind: 'L' | 'cut'; corner: Corner; a: number; b: number }
/** A window or outside door placed by the user. pos = centre along that wall, 0..1. */
export interface WinSpec { id: string; side: EdgeSide; pos: number; w: number; kind: 'window' | 'glass' | 'high' | 'door' | 'fins' | 'round' }
/** A door the user placed on one wall of a room. pos = centre along that wall, 0..1. flip = swing the other way. */
export type DoorKind = 'swing' | 'double' | 'sliding' | 'opening';
export interface DoorSpec { id: string; side: Side; pos: number; w: number; kind: DoorKind; flip?: boolean }
export interface ItemPlace { dx: number; dz: number; turn?: number }
/** A free-standing post (column), in metres from the back-left corner of the house. */
export interface Post { id: string; floor: number; x: number; z: number; size: number; round?: boolean }

export interface PRoom {
  id: string;
  type: PType;
  /** Back-left corner and size of the bounding box, in metres from the back-left corner of the house. */
  x: number;
  z: number;
  w: number;
  d: number;
  floor: string;
  paint: string;
  items: string[];
  /** Furniture the user moved: offset in metres from its automatic spot, and quarter turns clockwise (seen from above). */
  place?: Record<string, ItemPlace>;
  shape?: Shape;
  /** When set, replaces the automatic windows of this room. */
  windows?: WinSpec[];
  /** Where the inside door sits along its wall, 0..1. */
  doorAt?: number;
  /** When set, replaces the automatic doors of this room (an empty list = no doors). */
  doors?: DoorSpec[];
  /** Layout variant, for kitchens and bathrooms. */
  variant?: string;
}

export interface Site {
  /** Plot size in wah (1 wah = 2 m). */
  plotW: number;
  plotD: number;
  /** Distance from the front boundary to the front wall, and from the left boundary to the left wall, in metres. */
  front: number;
  left: number;
}

export interface Rect { x: number; z: number; w: number; d: number }
export interface FloorLook { finish?: Finish; color?: string; frame?: boolean }

export interface HouseSpec {
  name: string;
  styleId: string;
  w: number;
  d: number;
  floors: number;
  /** Floor-to-floor height in metres. */
  floorH: number;
  roof: RoofStyle;
  glass: 'more' | 'less';
  colors: { wall: string; frame: string; wood: string; roof: string };
  finish?: Finish;
  /** Part of the footprint each floor covers (upper floors can be smaller, e.g. a 1.5-storey house). Missing = whole footprint. */
  extents?: (Rect | null)[];
  /** Two mirrored homes sharing the middle wall. */
  twin?: boolean;
  /** Direction of a pitched roof's ridge; 'z' puts the gable end on the street side. Missing = along the longer side. */
  ridge?: 'x' | 'z';
  /** Cladding on the gable triangles (e.g. wood boards on a white house). */
  gableFinish?: Finish;
  /** Per-floor outside look: a different finish/colour, and a deep picture frame around the floor. */
  floorLooks?: (FloorLook | null)[];
  /** Vertical sun-screen fins in front of the street-side glass on upper floors. */
  screens?: boolean;
  /** Hedge planters along the edges of flat lower roofs. */
  planters?: boolean;
  /** One round accent window on the street side. */
  roundWindows?: boolean;
  /** Steepness of pitched roofs, rise over half-span (gable default 0.58; 1 = 45°). */
  pitch?: number;
  /** Small gables facing the street that cut into the front slope of a gable roof. */
  crossGables?: number;
  /** Shutters beside ordinary windows. */
  shutters?: boolean;
  /** Outside look of the walls around garages (e.g. a brick garage wing on a white house). */
  garageLook?: FloorLook;
  /** Posts placed by the user. */
  posts?: Post[];
  levels: PRoom[][];
  site: Site;
}

/* ---------------- room catalogue ---------------- */

const EXTRA: Record<Exclude<PType, RoomType>, { label: string; items: [string, string][] }> = {
  hall: { label: 'Hall', items: [['console', 'Console table'], ['rug', 'Runner rug'], ['plant', 'Plant']] },
  stairs: { label: 'Stairs', items: [] },
  garage: { label: 'Garage', items: [['car', 'Car'], ['shelf', 'Storage shelf']] },
  carport: { label: 'Carport', items: [['car', 'Car'], ['car2', 'Second car']] },
  laundry: { label: 'Laundry', items: [['washer', 'Washer'], ['dryer', 'Dryer'], ['shelf', 'Shelf']] },
  storage: { label: 'Storage', items: [['shelf', 'Shelves']] },
  terrace: { label: 'Terrace', items: [['lounger', 'Loungers'], ['table', 'Table and chairs'], ['plant', 'Plants']] },
  undercroft: { label: 'Undercroft', items: [['bench', 'Daybed'], ['plant', 'Plants']] },
};
export const PTYPES: Record<PType, { label: string; items: [string, string][] }> = { ...TYPES, ...EXTRA };
export const TYPE_ORDER: PType[] = ['living', 'dining', 'kitchen', 'bedroom', 'kids', 'bathroom', 'office', 'hall', 'stairs', 'garage', 'carport', 'laundry', 'storage', 'terrace', 'undercroft'];
export const VARIANTS: Partial<Record<PType, [string, string][]>> = {
  kitchen: [['line', 'Straight + island'], ['L', 'L-shape'], ['U', 'U-shape'], ['island', 'Big island'], ['thai', 'Thai kitchen']],
  bathroom: [['tub', 'Bathtub'], ['shower', 'Shower'], ['wetdry', 'Wet and dry'], ['double', 'Double basin']],
};

const DEFAULT_FLOOR: Partial<Record<PType, string>> = { bathroom: 'tile', kitchen: 'marble', garage: 'concrete', carport: 'concrete', laundry: 'tile', storage: 'concrete', terrace: 'oak', stairs: 'oak', undercroft: 'concrete' };
const DEFAULT_PAINT: Partial<Record<PType, string>> = { bathroom: '#D4E0E6', kids: '#D6DEC9', bedroom: '#F3D5C2', garage: '#F4EFE8' };
/** Light tint used for each room on the 2D plan. */
export const PLAN_TINT: Record<PType, string> = {
  living: '#FBF3E8', dining: '#FBF3E8', kitchen: '#F6EFE2', bedroom: '#F3EEF6', kids: '#EEF5EA', bathroom: '#E8F2F6',
  office: '#F3F1EA', hall: '#FFFFFF', stairs: '#F4F1EC', garage: '#EEEDEB', carport: '#ECEAE6', laundry: '#E8F2F6', storage: '#EEEDEB', terrace: '#F1EBDF', undercroft: '#EFEDE8',
};

let n = 0;
export const rid = () => `r${Date.now().toString(36)}${(n++).toString(36)}`;

export function makeRoom(type: PType, x: number, z: number, w: number, d: number): PRoom {
  const r: PRoom = { id: rid(), type, x, z, w, d, floor: DEFAULT_FLOOR[type] ?? 'oak', paint: DEFAULT_PAINT[type] ?? '#F4EFE8', items: PTYPES[type].items.map((i) => i[0]) };
  if (VARIANTS[type]) r.variant = VARIANTS[type]![0][0];
  return r;
}
export const typeLabel = (t: PType) => PTYPES[t].label;

/* ---------------- room geometry ---------------- */

export interface Pt { x: number; z: number }
/** Outline of a room, clockwise on screen (z grows downwards), starting at the back-left corner. */
export function roomPoly(r: PRoom): Pt[] {
  const x0 = r.x, x1 = r.x + r.w, z0 = r.z, z1 = r.z + r.d;
  const sh = r.shape;
  const a = sh ? Math.min(sh.a, r.w - 0.5) : 0, b = sh ? Math.min(sh.b, r.d - 0.5) : 0;
  const corner = (c: Corner): Pt[] => {
    const at = { nw: { x: x0, z: z0 }, ne: { x: x1, z: z0 }, se: { x: x1, z: z1 }, sw: { x: x0, z: z1 } }[c];
    if (!sh || sh.corner !== c || a <= 0 || b <= 0) return [at];
    const sx = c === 'ne' || c === 'se' ? -1 : 1, sz = c === 'sw' || c === 'se' ? -1 : 1;
    const pa = { x: at.x + sx * a, z: at.z }, pb = { x: at.x, z: at.z + sz * b };
    // Keep clockwise order: the corner is entered along one edge and left along the other.
    const first = c === 'nw' || c === 'se' ? pb : pa, last = c === 'nw' || c === 'se' ? pa : pb;
    if (sh.kind === 'cut') return [first, last];
    return [first, { x: at.x + sx * a, z: at.z + sz * b }, last];
  };
  return [...corner('nw'), ...corner('ne'), ...corner('se'), ...corner('sw')];
}
export function polyArea(p: Pt[]) {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; s += q.x * r.z - r.x * q.z; }
  return Math.abs(s) / 2;
}
export const area = (r: PRoom | { w: number; d: number }) => ('id' in r ? polyArea(roomPoly(r)) : r.w * r.d);
export function pointInRoom(r: PRoom, x: number, z: number) {
  const p = roomPoly(r);
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if ((p[i].z > z) !== (p[j].z > z) && x < ((p[j].x - p[i].x) * (z - p[i].z)) / (p[j].z - p[i].z) + p[i].x) inside = !inside;
  }
  return inside;
}
/** Largest plain rectangle inside the room: furniture and labels go here. */
export function mainRect(r: PRoom): Rect {
  const sh = r.shape;
  if (!sh) return { x: r.x, z: r.z, w: r.w, d: r.d };
  const a = Math.min(sh.a, r.w - 0.5), b = Math.min(sh.b, r.d - 0.5);
  const tall = (r.w - a) * r.d, wide = r.w * (r.d - b);
  const left = sh.corner === 'ne' || sh.corner === 'se', top = sh.corner === 'sw' || sh.corner === 'se';
  if (tall >= wide) return { x: left ? r.x : r.x + a, z: r.z, w: r.w - a, d: r.d };
  return { x: r.x, z: top ? r.z : r.z + b, w: r.w, d: r.d - b };
}
export function floorRect(s: HouseSpec, fi: number): Rect {
  return s.extents?.[fi] ?? { x: 0, z: 0, w: s.w, d: s.d };
}
export const houseHeight = (s: HouseSpec) => {
  const short = Math.min(s.w, s.d);
  const roof = { gable: short * 0.5 * (s.pitch ?? 0.58), hip: short * 0.28, thai: short * 0.55, irimoya: short * 0.32, gambrel: short * 0.42, shed: s.d * 0.18, flat: 0.6, terrace: 1.2 }[s.roof];
  return 0.3 + s.floors * s.floorH + roof;
};

/* ---------------- styles ---------------- */

export type Region = 'modern' | 'thai' | 'japanese' | 'european';
export type StyleExtra = Pick<HouseSpec, 'ridge' | 'gableFinish' | 'floorLooks' | 'screens' | 'planters' | 'roundWindows' | 'pitch' | 'crossGables' | 'shutters' | 'garageLook'>;
export interface Style { id: string; name: string; region: Region; blurb: string; roof: RoofStyle; glass: 'more' | 'less'; finish: Finish; colors: HouseSpec['colors']; extra?: StyleExtra }
/** Everything a style decides beyond roof, glass, finish and colours, reset to "off" first so styles do not leak into each other. */
export const styleLook = (st: Style): StyleExtra => ({ ridge: undefined, gableFinish: undefined, floorLooks: undefined, screens: false, planters: false, roundWindows: false, pitch: undefined, crossGables: undefined, shutters: false, garageLook: undefined, ...st.extra });
export const STYLES: Style[] = [
  { id: 'modern', name: 'Modern Minimal', region: 'modern', blurb: 'White box, black frames, rust accents', roof: 'flat', glass: 'more', finish: 'plaster', colors: { wall: '#F5F3EF', frame: '#25221F', wood: '#9A5634', roof: '#EDEAE5' } },
  { id: 'loft', name: 'Industrial Loft', region: 'modern', blurb: 'Brick, black steel, walnut', roof: 'flat', glass: 'more', finish: 'brick', colors: { wall: '#A8573E', frame: '#1F1F21', wood: '#6B4832', roof: '#9C9993' } },
  { id: 'villa', name: 'Pool Villa', region: 'modern', blurb: 'Long and low, wall-to-wall glass', roof: 'flat', glass: 'more', finish: 'plaster', colors: { wall: '#FAF8F4', frame: '#ECEAE6', wood: '#C59C70', roof: '#F2EFEA' } },
  { id: 'split', name: 'Split Level', region: 'modern', blurb: 'One and a half storeys, mono-pitch roofs', roof: 'shed', glass: 'more', finish: 'siding', colors: { wall: '#E8E2D6', frame: '#2F2F33', wood: '#B07A4F', roof: '#4A4A4E' } },
  { id: 'townhouse', name: 'City Townhouse', region: 'modern', blurb: 'Narrow three storeys, roof terrace', roof: 'terrace', glass: 'more', finish: 'plaster', colors: { wall: '#EBDDCA', frame: '#25221F', wood: '#6B4832', roof: '#E3D7C6' } },
  { id: 'twin', name: 'Twin House', region: 'modern', blurb: 'Two mirrored homes, one shared wall', roof: 'hip', glass: 'more', finish: 'plaster', colors: { wall: '#F0EBE2', frame: '#3A3633', wood: '#A87850', roof: '#5E5A55' } },
  { id: 'tropical', name: 'Tropical Thai', region: 'thai', blurb: 'Deep hip roof, teak and terracotta', roof: 'hip', glass: 'more', finish: 'plaster', colors: { wall: '#F2E6D3', frame: '#6B4832', wood: '#8A5A3B', roof: '#B5603E' } },
  { id: 'thai', name: 'Thai Stilt House', region: 'thai', blurb: 'Teak walls raised on posts, steep Thai roof', roof: 'thai', glass: 'less', finish: 'wood', colors: { wall: '#8C5A36', frame: '#4A2F1E', wood: '#6E4328', roof: '#9A3E2A' } },
  { id: 'courtyard', name: 'Courtyard Bungalow', region: 'thai', blurb: 'L-shaped rooms around a garden', roof: 'hip', glass: 'more', finish: 'plaster', colors: { wall: '#F3EBDD', frame: '#5A4030', wood: '#9A6A44', roof: '#7A4A35' } },
  { id: 'japandi', name: 'Japandi', region: 'japanese', blurb: 'Low mono-pitch roof, pale wood, stone', roof: 'shed', glass: 'more', finish: 'plaster', colors: { wall: '#E9E3D8', frame: '#4A4038', wood: '#D2B48C', roof: '#5E5A55' } },
  { id: 'minka', name: 'Japanese Minka', region: 'japanese', blurb: 'Dark timber, hip-and-gable roof, veranda', roof: 'irimoya', glass: 'less', finish: 'wood', colors: { wall: '#3E342C', frame: '#1F1A16', wood: '#6B5440', roof: '#2E3033' } },
  { id: 'nordic', name: 'Nordic Gable', region: 'european', blurb: 'Steep charcoal roof, oak details', roof: 'gable', glass: 'more', finish: 'plaster', colors: { wall: '#F1EEE8', frame: '#2F2F33', wood: '#C59C70', roof: '#3A3B3F' } },
  { id: 'classic', name: 'Modern Classic', region: 'modern', blurb: 'Cream plaster, stone base, framed floors, dark hip roof', roof: 'hip', glass: 'more', finish: 'plaster', colors: { wall: '#F0EADF', frame: '#38363A', wood: '#8A6A4A', roof: '#4B4E54' },
    extra: { floorLooks: [{ finish: 'stone', color: '#E3D8C4' }, { frame: true }] } },
  { id: 'gassho', name: 'Modern Japanese', region: 'japanese', blurb: 'Steep gassho-style gable, white walls, cedar upper floor', roof: 'gable', glass: 'more', finish: 'plaster', colors: { wall: '#F4F1EB', frame: '#2B2622', wood: '#9B7650', roof: '#3A3B3E' },
    extra: { pitch: 1.0, ridge: 'z', gableFinish: 'wood', floorLooks: [null, { finish: 'wood', color: '#8A6A48' }] } },
  { id: 'colonial', name: 'Colonial', region: 'european', blurb: 'White siding, porch, symmetrical hip roof', roof: 'hip', glass: 'less', finish: 'siding', colors: { wall: '#F6F4EF', frame: '#2E3B4E', wood: '#2E3B4E', roof: '#4A4F57' } },
  { id: 'luxe', name: 'Luxury Modern', region: 'modern', blurb: 'Stone frames, dark metal top floor, bronze fins, roof garden', roof: 'flat', glass: 'more', finish: 'marble', colors: { wall: '#E7E2D8', frame: '#1E1F22', wood: '#9C7A55', roof: '#3A3B3F' },
    extra: { floorLooks: [null, { frame: true }, { finish: 'metal', color: '#2B2D31', frame: true }], screens: true, planters: true } },
  { id: 'stonetown', name: 'Stone Townhouse', region: 'modern', blurb: 'Grey marble, cream panels, slatted screens', roof: 'flat', glass: 'more', finish: 'marble', colors: { wall: '#D9D6D0', frame: '#26272A', wood: '#A88560', roof: '#E8E4DC' },
    extra: { floorLooks: [null, { finish: 'plaster', color: '#EEE7DA', frame: true }, { finish: 'metal', color: '#2A2C30', frame: true }], screens: true } },
  { id: 'boxtwo', name: 'Modern Box', region: 'modern', blurb: 'White box, framed upper floor, carport below', roof: 'flat', glass: 'more', finish: 'plaster', colors: { wall: '#F7F6F3', frame: '#2B2B2B', wood: '#9A6B47', roof: '#EDEAE5' },
    extra: { floorLooks: [null, { frame: true }] } },
  { id: 'thaigable', name: 'Modern Thai Gable', region: 'thai', blurb: 'Street-facing gable clad in wood, flat-roof carport', roof: 'gable', glass: 'more', finish: 'plaster', colors: { wall: '#F7F6F3', frame: '#5B4636', wood: '#C8925B', roof: '#4A4D52' },
    extra: { ridge: 'z', gableFinish: 'wood', roundWindows: true } },
  { id: 'countryside', name: 'Thai Country Bungalow', region: 'thai', blurb: 'One storey, grey tile roof, front porch on posts', roof: 'hip', glass: 'less', finish: 'plaster', colors: { wall: '#F5F4F0', frame: '#6B6F75', wood: '#8F949A', roof: '#6D7177' } },
  { id: 'cottage', name: 'Arch Cottage', region: 'thai', blurb: 'White walls, round windows, wood slats, carport', roof: 'gable', glass: 'more', finish: 'plaster', colors: { wall: '#FAF9F6', frame: '#A8774E', wood: '#B98A5E', roof: '#45484D' },
    extra: { roundWindows: true, gableFinish: 'wood' } },
  { id: 'farmhouse', name: 'Modern Farmhouse', region: 'european', blurb: 'White brick, steep street gables, black frames, timber porch', roof: 'gable', glass: 'more', finish: 'brick', colors: { wall: '#ECEAE6', frame: '#1F2023', wood: '#B8743F', roof: '#7A6E62' },
    extra: { pitch: 1.0, crossGables: 3, floorLooks: [null, { finish: 'plaster', color: '#E9E3D8' }] } },
  { id: 'victorian', name: 'Victorian Cottage', region: 'european', blurb: 'Board-and-batten walls, steep gables, porch, shutters', roof: 'gable', glass: 'less', finish: 'wood', colors: { wall: '#DCD8D2', frame: '#F7F5F2', wood: '#F2EFEA', roof: '#8B8D92' },
    extra: { pitch: 1.15, crossGables: 2, shutters: true } },
  { id: 'americana', name: 'Brick Garage Colonial', region: 'european', blurb: 'White house, brick garage wing, wrap-around porch, shutters', roof: 'gable', glass: 'less', finish: 'plaster', colors: { wall: '#EEEDEA', frame: '#F7F5F2', wood: '#6E6650', roof: '#5A5F66' },
    extra: { pitch: 0.75, crossGables: 1, shutters: true, roundWindows: true, garageLook: { finish: 'brick', color: '#B5603E' } } },
  { id: 'thaimodern', name: 'Modern Thai Stilt House', region: 'thai', blurb: 'Raised wooden upper floor, white posts below, layered gables', roof: 'gable', glass: 'more', finish: 'plaster', colors: { wall: '#F4F2EE', frame: '#3A2A20', wood: '#A86E3E', roof: '#5A4436' },
    extra: { crossGables: 2, gableFinish: 'wood', floorLooks: [null, { finish: 'wood', color: '#A86E3E' }] } },
  { id: 'mediterranean', name: 'Mediterranean', region: 'european', blurb: 'Warm plaster, clay tile hip roof', roof: 'hip', glass: 'less', finish: 'stone', colors: { wall: '#F0D5BF', frame: '#6A4A34', wood: '#B07A4F', roof: '#C46A43' } },
];
export const REGIONS: [Region, string][] = [['modern', 'Modern'], ['thai', 'Thai'], ['japanese', 'Japanese'], ['european', 'European']];
export const ROOFS: [RoofStyle, string][] = [['flat', 'Flat'], ['terrace', 'Roof terrace'], ['gable', 'Gable'], ['hip', 'Hip'], ['shed', 'Mono-pitch'], ['thai', 'Thai'], ['irimoya', 'Hip-and-gable'], ['gambrel', 'Gambrel']];
export const ROOF_COLORS: [string, string][] = [['Charcoal', '#3A3B3F'], ['Clay', '#B5603E'], ['Terracotta', '#C46A43'], ['Thai red', '#9A3E2A'], ['Slate', '#5E5A55'], ['Sand', '#E3D7C6'], ['White', '#EDEAE5']];
export const FINISHES: [Finish, string][] = [['plaster', 'Plaster'], ['wood', 'Wood boards'], ['siding', 'Siding'], ['brick', 'Brick'], ['timber', 'Half-timber'], ['stone', 'Stone'], ['marble', 'Marble panels'], ['metal', 'Metal panels']];
export const WALL_COLORS: [string, string][] = [['White', '#F5F3EF'], ['Limestone', '#E7E2D8'], ['Charcoal', '#2B2D31'], ['Sand', '#EBDDCA'], ['Peach', '#F0CFBB'], ['Stone', '#CFCBC6'], ['Graphite', '#5B5753'], ['Teak', '#8C5A36'], ['Dark timber', '#3E342C'], ['Barn red', '#9C3B2E'], ['Brick', '#A8573E']];

/* ---------------- layout templates (fractions of the footprint, so they fit any size) ---------------- */

type TShape = { kind: 'L' | 'cut'; corner: Corner; fa: number; fb: number };
type T = [PType, number, number, number, number, TShape?];
export interface Template { id: string; name: string; floors: number; levels: T[][]; extents?: ([number, number, number, number] | null)[]; twin?: boolean }

/** Mirrors a half-house layout into two homes side by side. */
function twin(levels: T[][]): T[][] {
  return levels.map((lv) => [
    ...lv.map(([t, x, z, w, d]) => [t, x * 0.5, z, w * 0.5, d] as T),
    ...lv.map(([t, x, z, w, d]) => [t, 0.5 + 0.5 * (1 - x - w), z, w * 0.5, d] as T),
  ]);
}

export const TEMPLATES: Template[] = [
  { id: 'studio', name: 'Studio, 1 bedroom', floors: 1, levels: [[
    ['living', 0, 0.45, 0.6, 0.55], ['kitchen', 0.6, 0.45, 0.4, 0.55], ['bedroom', 0, 0, 0.6, 0.45], ['bathroom', 0.6, 0, 0.4, 0.45]]] },
  { id: 'bungalow', name: 'Bungalow, 2 bedrooms', floors: 1, levels: [[
    ['living', 0, 0.5, 0.45, 0.5], ['dining', 0.45, 0.5, 0.25, 0.5], ['kitchen', 0.7, 0.5, 0.3, 0.5],
    ['bedroom', 0, 0, 0.35, 0.4], ['hall', 0.35, 0, 0.15, 0.5], ['bathroom', 0.5, 0, 0.2, 0.5], ['kids', 0.7, 0, 0.3, 0.5], ['storage', 0, 0.4, 0.35, 0.1]]] },
  { id: 'villa3', name: 'Villa, 3 bedrooms', floors: 1, levels: [[
    ['bedroom', 0, 0, 0.26, 0.55], ['bathroom', 0, 0.55, 0.13, 0.45], ['office', 0.13, 0.55, 0.13, 0.45],
    ['living', 0.26, 0.4, 0.3, 0.6], ['dining', 0.56, 0.4, 0.18, 0.6], ['hall', 0.26, 0, 0.48, 0.4],
    ['kitchen', 0.74, 0.5, 0.26, 0.5], ['bedroom', 0.74, 0, 0.26, 0.3], ['bathroom', 0.74, 0.3, 0.26, 0.2]]] },
  { id: 'courtyard', name: 'Courtyard, L-shaped rooms', floors: 1, levels: [[
    ['living', 0, 0.35, 0.55, 0.65, { kind: 'L', corner: 'ne', fa: 0.4, fb: 0.45 }], ['kitchen', 0, 0, 0.3, 0.35], ['dining', 0.3, 0, 0.25, 0.35],
    ['bedroom', 0.55, 0, 0.45, 0.45, { kind: 'cut', corner: 'sw', fa: 0.3, fb: 0.35 }], ['bathroom', 0.55, 0.45, 0.2, 0.25], ['kids', 0.75, 0.45, 0.25, 0.55], ['terrace', 0.55, 0.7, 0.2, 0.3]]] },
  { id: 'minka', name: 'Japanese, veranda in front', floors: 1, levels: [[
    ['bedroom', 0, 0, 0.32, 0.45], ['office', 0, 0.45, 0.32, 0.35], ['living', 0.32, 0, 0.38, 0.8], ['kitchen', 0.7, 0, 0.3, 0.45], ['bathroom', 0.7, 0.45, 0.3, 0.35], ['terrace', 0, 0.8, 1, 0.2]]] },
  { id: 'family2', name: 'Family home, 3 bedrooms', floors: 2, levels: [
    [['living', 0, 0.45, 0.5, 0.55], ['dining', 0.5, 0.45, 0.22, 0.55], ['kitchen', 0.72, 0.45, 0.28, 0.55],
     ['stairs', 0, 0, 0.32, 0.25], ['hall', 0.32, 0, 0.2, 0.45], ['bathroom', 0.52, 0, 0.2, 0.45], ['laundry', 0.72, 0, 0.28, 0.45], ['storage', 0, 0.25, 0.32, 0.2]],
    [['stairs', 0, 0, 0.32, 0.25], ['hall', 0.32, 0, 0.18, 1], ['bedroom', 0.5, 0.45, 0.5, 0.55], ['bathroom', 0.5, 0, 0.22, 0.45], ['kids', 0.72, 0, 0.28, 0.45],
     ['kids', 0, 0.55, 0.32, 0.45], ['office', 0, 0.25, 0.32, 0.3]]] },
  { id: 'modern2', name: 'Modern, terrace upstairs', floors: 2, levels: [
    [['living', 0, 0.4, 0.55, 0.6], ['kitchen', 0.55, 0.4, 0.45, 0.6], ['stairs', 0, 0, 0.3, 0.4], ['dining', 0.3, 0, 0.4, 0.4], ['bathroom', 0.7, 0, 0.3, 0.4]],
    [['stairs', 0, 0, 0.3, 0.4], ['hall', 0, 0.4, 0.3, 0.6], ['bedroom', 0.3, 0, 0.4, 0.6], ['bathroom', 0.7, 0, 0.3, 0.4], ['office', 0.7, 0.4, 0.3, 0.6], ['terrace', 0.3, 0.6, 0.4, 0.4]]] },
  { id: 'garage2', name: 'Two storeys with garage', floors: 2, levels: [
    [['garage', 0, 0.45, 0.4, 0.55], ['living', 0.4, 0.45, 0.6, 0.55], ['stairs', 0, 0, 0.25, 0.45], ['hall', 0.25, 0, 0.15, 0.45], ['kitchen', 0.6, 0, 0.4, 0.45], ['bathroom', 0.4, 0, 0.2, 0.45]],
    [['stairs', 0, 0, 0.25, 0.45], ['hall', 0.25, 0, 0.15, 1], ['bedroom', 0.4, 0.45, 0.6, 0.55], ['bathroom', 0.4, 0, 0.25, 0.45], ['bedroom', 0.65, 0, 0.35, 0.45], ['kids', 0, 0.45, 0.25, 0.55]]] },
  { id: 'split15', name: 'One and a half storeys', floors: 2, extents: [null, [0, 0, 1, 0.55]], levels: [
    [['stairs', 0, 0, 0.22, 0.5], ['bathroom', 0.22, 0, 0.23, 0.45], ['bedroom', 0.45, 0, 0.55, 0.45], ['dining', 0, 0.5, 0.22, 0.5], ['living', 0.22, 0.45, 0.43, 0.55], ['kitchen', 0.65, 0.45, 0.35, 0.55]],
    [['stairs', 0, 0, 0.22, 0.5], ['bedroom', 0.22, 0, 0.43, 0.55], ['bathroom', 0.65, 0, 0.35, 0.25], ['kids', 0.65, 0.25, 0.35, 0.3]]] },
  { id: 'colonial', name: 'Colonial with porch', floors: 2, levels: [
    [['kitchen', 0, 0, 0.25, 0.5], ['office', 0, 0.5, 0.25, 0.5], ['stairs', 0.25, 0, 0.2, 0.3], ['bathroom', 0.45, 0, 0.3, 0.3], ['hall', 0.25, 0.3, 0.5, 0.5], ['terrace', 0.25, 0.8, 0.5, 0.2], ['living', 0.75, 0, 0.25, 1]],
    [['bedroom', 0, 0, 0.25, 0.55], ['kids', 0, 0.55, 0.25, 0.45], ['stairs', 0.25, 0, 0.2, 0.3], ['bathroom', 0.45, 0, 0.3, 0.3], ['hall', 0.25, 0.3, 0.5, 0.25], ['terrace', 0.25, 0.55, 0.5, 0.45], ['bedroom', 0.75, 0, 0.25, 0.55], ['kids', 0.75, 0.55, 0.25, 0.45]]] },
  { id: 'twin2', name: 'Twin house, 2 homes', floors: 2, twin: true, levels: twin([
    [['stairs', 0, 0, 0.3, 0.45], ['bathroom', 0.3, 0, 0.3, 0.45], ['dining', 0.6, 0, 0.4, 0.45], ['living', 0, 0.45, 0.6, 0.55], ['kitchen', 0.6, 0.45, 0.4, 0.55]],
    [['stairs', 0, 0, 0.3, 0.45], ['bathroom', 0.3, 0, 0.3, 0.45], ['office', 0.6, 0, 0.4, 0.45], ['bedroom', 0, 0.45, 0.55, 0.55], ['kids', 0.55, 0.45, 0.45, 0.55]]]) },
  { id: 'thai', name: 'Thai stilt house', floors: 2, levels: [
    [['undercroft', 0.18, 0, 0.82, 1], ['undercroft', 0, 0, 0.18, 0.55], ['stairs', 0, 0.55, 0.18, 0.45]],
    [['bedroom', 0, 0, 0.4, 0.55], ['living', 0.4, 0, 0.35, 0.55], ['kitchen', 0.75, 0, 0.25, 0.35], ['bathroom', 0.75, 0.35, 0.25, 0.2], ['stairs', 0, 0.55, 0.18, 0.45], ['terrace', 0.18, 0.55, 0.82, 0.45]]] },
  { id: 'luxe3', name: 'Three storeys, 4-car carport, roof garden', floors: 3, extents: [null, null, [0.3, 0, 0.7, 1]], levels: [
    [['carport', 0, 0.42, 0.56, 0.58], ['living', 0.56, 0.42, 0.44, 0.58], ['bathroom', 0, 0, 0.15, 0.42], ['laundry', 0.15, 0, 0.15, 0.42], ['stairs', 0.3, 0, 0.12, 0.42], ['kitchen', 0.42, 0, 0.3, 0.42], ['dining', 0.72, 0, 0.28, 0.42]],
    [['bedroom', 0, 0.42, 0.3, 0.58], ['bathroom', 0, 0, 0.15, 0.42], ['office', 0.15, 0, 0.15, 0.42], ['stairs', 0.3, 0, 0.12, 0.42], ['hall', 0.3, 0.42, 0.12, 0.58], ['bedroom', 0.42, 0.42, 0.3, 0.58], ['bathroom', 0.42, 0, 0.15, 0.42], ['kids', 0.57, 0, 0.15, 0.42], ['terrace', 0.72, 0.42, 0.28, 0.58], ['bedroom', 0.72, 0, 0.28, 0.42]],
    [['stairs', 0.3, 0, 0.12, 0.42], ['hall', 0.3, 0.42, 0.12, 0.58], ['bedroom', 0.42, 0.4, 0.33, 0.6], ['bathroom', 0.42, 0, 0.18, 0.4], ['storage', 0.6, 0, 0.15, 0.4], ['living', 0.75, 0, 0.25, 1]]] },
  { id: 'stone3', name: 'Narrow three storeys, carport', floors: 3, levels: [
    [['carport', 0, 0.55, 0.62, 0.45], ['hall', 0.62, 0.55, 0.38, 0.45], ['living', 0, 0.25, 1, 0.3], ['stairs', 0.7, 0, 0.3, 0.25], ['kitchen', 0, 0, 0.45, 0.25], ['bathroom', 0.45, 0, 0.25, 0.25]],
    [['stairs', 0.7, 0, 0.3, 0.25], ['bathroom', 0.45, 0, 0.25, 0.25], ['office', 0, 0, 0.45, 0.25], ['hall', 0, 0.25, 1, 0.15], ['bedroom', 0, 0.4, 0.6, 0.6], ['bathroom', 0.6, 0.4, 0.4, 0.25], ['kids', 0.6, 0.65, 0.4, 0.35]],
    [['stairs', 0.7, 0, 0.3, 0.25], ['bathroom', 0.45, 0, 0.25, 0.25], ['storage', 0, 0, 0.45, 0.25], ['hall', 0, 0.25, 1, 0.15], ['bedroom', 0, 0.4, 1, 0.6]]] },
  { id: 'box2', name: 'Two storeys, carport under', floors: 2, levels: [
    [['carport', 0.5, 0.45, 0.5, 0.55], ['living', 0, 0.45, 0.5, 0.55], ['stairs', 0, 0, 0.2, 0.45], ['kitchen', 0.2, 0, 0.45, 0.45], ['bathroom', 0.65, 0, 0.35, 0.45]],
    [['stairs', 0, 0, 0.2, 0.45], ['bathroom', 0.2, 0, 0.25, 0.45], ['bedroom', 0.45, 0, 0.55, 0.45], ['terrace', 0, 0.45, 0.45, 0.55], ['bedroom', 0.45, 0.45, 0.55, 0.55]]] },
  { id: 'gable1', name: 'One storey, carport beside', floors: 1, levels: [[
    ['living', 0, 0.45, 0.4, 0.55], ['terrace', 0.4, 0.72, 0.26, 0.28], ['dining', 0.4, 0.4, 0.26, 0.32], ['kitchen', 0.4, 0, 0.26, 0.4],
    ['bedroom', 0, 0, 0.25, 0.45], ['bathroom', 0.25, 0, 0.15, 0.45], ['carport', 0.66, 0, 0.34, 1]]] },
  { id: 'porch1', name: 'One storey, front porch', floors: 1, levels: [[
    ['terrace', 0.3, 0.72, 0.4, 0.28], ['living', 0.3, 0.3, 0.4, 0.42], ['kitchen', 0.3, 0, 0.4, 0.3],
    ['bedroom', 0, 0.42, 0.3, 0.58], ['bedroom', 0.7, 0.42, 0.3, 0.58], ['bathroom', 0, 0, 0.3, 0.42], ['storage', 0.7, 0, 0.3, 0.42]]] },
  { id: 'arch1', name: 'One storey, carport and deck', floors: 1, levels: [[
    ['bedroom', 0, 0.45, 0.24, 0.55], ['living', 0.24, 0.45, 0.44, 0.55], ['bedroom', 0, 0, 0.24, 0.45], ['kitchen', 0.24, 0, 0.24, 0.45], ['bathroom', 0.48, 0, 0.2, 0.45], ['carport', 0.68, 0, 0.32, 1]]] },
  { id: 'farm2', name: 'Two storeys, porch in the middle', floors: 2, levels: [
    [['office', 0, 0.4, 0.3, 0.6], ['terrace', 0.3, 0.8, 0.22, 0.2], ['hall', 0.3, 0.4, 0.22, 0.4], ['living', 0.52, 0.4, 0.48, 0.6], ['stairs', 0.3, 0, 0.22, 0.4], ['kitchen', 0, 0, 0.3, 0.4], ['dining', 0.52, 0, 0.28, 0.4], ['bathroom', 0.8, 0, 0.2, 0.4]],
    [['bedroom', 0, 0.4, 0.3, 0.6], ['hall', 0.3, 0.4, 0.22, 0.6], ['bedroom', 0.52, 0.4, 0.48, 0.6], ['stairs', 0.3, 0, 0.22, 0.4], ['kids', 0, 0, 0.3, 0.4], ['bathroom', 0.52, 0, 0.22, 0.4], ['bathroom', 0.74, 0, 0.26, 0.4]]] },
  { id: 'cottage15', name: 'One and a half storeys, front porch', floors: 2, extents: [null, [0, 0, 1, 0.75]], levels: [
    [['living', 0, 0.35, 0.45, 0.45], ['terrace', 0.45, 0.8, 0.55, 0.2], ['hall', 0.45, 0.35, 0.2, 0.45], ['dining', 0.65, 0.35, 0.35, 0.45], ['stairs', 0.45, 0, 0.2, 0.35], ['kitchen', 0, 0, 0.45, 0.35], ['bathroom', 0.65, 0, 0.35, 0.35], ['storage', 0, 0.8, 0.45, 0.2]],
    [['bedroom', 0, 0.3, 0.45, 0.45], ['stairs', 0.45, 0, 0.2, 0.35], ['hall', 0.45, 0.35, 0.2, 0.4], ['kids', 0.65, 0.3, 0.35, 0.45], ['bathroom', 0, 0, 0.45, 0.3], ['office', 0.65, 0, 0.35, 0.3]]] },
  { id: 'garagewing', name: 'Two storeys, garage wing and porch', floors: 2, extents: [null, [0.36, 0, 0.64, 0.68]], levels: [
    [['garage', 0, 0.1, 0.32, 0.9], ['storage', 0, 0, 0.32, 0.1], ['laundry', 0.32, 0, 0.16, 0.35], ['stairs', 0.48, 0, 0.16, 0.35], ['kitchen', 0.64, 0, 0.36, 0.35], ['hall', 0.32, 0.35, 0.16, 0.33], ['living', 0.48, 0.35, 0.52, 0.33], ['terrace', 0.32, 0.68, 0.68, 0.32]],
    [['bedroom', 0.64, 0, 0.36, 0.38], ['stairs', 0.48, 0, 0.16, 0.35], ['bathroom', 0.36, 0, 0.12, 0.35], ['hall', 0.36, 0.35, 0.28, 0.33], ['kids', 0.64, 0.38, 0.36, 0.3]]] },
  { id: 'stilt2', name: 'Raised upper floor, open ground floor', floors: 2, levels: [
    [['undercroft', 0, 0, 0.42, 1], ['living', 0.42, 0.35, 0.36, 0.65], ['kitchen', 0.42, 0, 0.36, 0.35], ['bathroom', 0.78, 0, 0.22, 0.3], ['stairs', 0.78, 0.3, 0.22, 0.4], ['undercroft', 0.78, 0.7, 0.22, 0.3]],
    [['bedroom', 0, 0, 0.42, 0.5], ['bedroom', 0, 0.5, 0.42, 0.5], ['living', 0.42, 0, 0.36, 0.6], ['bathroom', 0.78, 0, 0.22, 0.3], ['stairs', 0.78, 0.3, 0.22, 0.4], ['terrace', 0.42, 0.6, 0.58, 0.4]]] },
  { id: 'town3', name: 'Townhouse, 3 storeys', floors: 3, levels: [
    [['garage', 0, 0.62, 1, 0.38], ['living', 0, 0.3, 1, 0.32], ['stairs', 0, 0, 0.45, 0.3], ['kitchen', 0.45, 0, 0.55, 0.18], ['bathroom', 0.45, 0.18, 0.55, 0.12]],
    [['stairs', 0, 0, 0.45, 0.3], ['bathroom', 0.45, 0, 0.55, 0.15], ['hall', 0.45, 0.15, 0.55, 0.15], ['bedroom', 0, 0.3, 1, 0.35], ['kids', 0, 0.65, 1, 0.35]],
    [['stairs', 0, 0, 0.45, 0.3], ['bathroom', 0.45, 0, 0.55, 0.15], ['hall', 0.45, 0.15, 0.55, 0.15], ['bedroom', 0, 0.3, 1, 0.42], ['terrace', 0, 0.72, 1, 0.28]]] },
];

const snap = (v: number, s = 0.25) => Math.round(v / s) * s;
export function applyTemplate(t: Template, w: number, d: number): { levels: PRoom[][]; extents?: (Rect | null)[]; twin?: boolean } {
  const levels = t.levels.map((lv) => lv.map(([type, fx, fz, fw, fd, sh]) => {
    const x = snap(fx * w), z = snap(fz * d);
    const r = makeRoom(type, x, z, snap((fx + fw) * w) - x, snap((fz + fd) * d) - z);
    if (sh) r.shape = { kind: sh.kind, corner: sh.corner, a: snap(sh.fa * r.w), b: snap(sh.fb * r.d) };
    return r;
  }));
  const extents = t.extents?.map((e) => (e ? { x: snap(e[0] * w), z: snap(e[1] * d), w: snap(e[2] * w), d: snap(e[3] * d) } : null));
  return { levels, extents, twin: t.twin };
}

/* ---------------- ready-made houses ---------------- */

export interface Preset { id: string; name: string; styleId: string; template: string; w: number; d: number; floorH: number; plotW: number; plotD: number; groundH?: number }
export const HOUSE_PRESETS: Preset[] = [
  { id: 'modern', name: 'Modern Minimal', styleId: 'modern', template: 'modern2', w: 10, d: 7.5, floorH: 3.0, plotW: 12, plotD: 9 },
  { id: 'thai', name: 'Thai Stilt House', styleId: 'thai', template: 'thai', w: 11, d: 9, floorH: 2.9, plotW: 13, plotD: 11 },
  { id: 'minka', name: 'Japanese Minka', styleId: 'minka', template: 'minka', w: 12, d: 9, floorH: 3.0, plotW: 13, plotD: 11 },
  { id: 'classic', name: 'Modern Classic', styleId: 'classic', template: 'garagewing', w: 16, d: 11, floorH: 3.2, plotW: 13, plotD: 12 },
  { id: 'twin', name: 'Twin House', styleId: 'twin', template: 'twin2', w: 14, d: 9, floorH: 3.0, plotW: 14, plotD: 11 },
  { id: 'split', name: 'Split Level', styleId: 'split', template: 'split15', w: 11, d: 9, floorH: 3.0, plotW: 12, plotD: 11 },
  { id: 'courtyard', name: 'Courtyard Bungalow', styleId: 'courtyard', template: 'courtyard', w: 14, d: 11, floorH: 3.1, plotW: 15, plotD: 13 },
  { id: 'gassho', name: 'Modern Japanese', styleId: 'gassho', template: 'garage2', w: 11, d: 10, floorH: 3.0, plotW: 12, plotD: 11 },
  { id: 'colonial', name: 'Colonial', styleId: 'colonial', template: 'colonial', w: 12, d: 9, floorH: 3.0, plotW: 14, plotD: 11 },
  { id: 'tropical', name: 'Tropical Thai', styleId: 'tropical', template: 'villa3', w: 15, d: 9, floorH: 3.2, plotW: 14, plotD: 11 },
  { id: 'nordic', name: 'Nordic Gable', styleId: 'nordic', template: 'family2', w: 9, d: 8, floorH: 2.9, plotW: 11, plotD: 10 },
  { id: 'japandi', name: 'Japandi', styleId: 'japandi', template: 'bungalow', w: 12, d: 8, floorH: 3.0, plotW: 12, plotD: 10 },
  { id: 'loft', name: 'Industrial Loft', styleId: 'loft', template: 'garage2', w: 10, d: 10, floorH: 3.2, plotW: 11, plotD: 11 },
  { id: 'mediterranean', name: 'Mediterranean', styleId: 'mediterranean', template: 'family2', w: 11, d: 8, floorH: 3.0, plotW: 12, plotD: 10 },
  { id: 'townhouse', name: 'City Townhouse', styleId: 'townhouse', template: 'town3', w: 5.5, d: 13, floorH: 3.0, plotW: 5, plotD: 10 },
  { id: 'villa', name: 'Pool Villa', styleId: 'villa', template: 'villa3', w: 17, d: 9, floorH: 3.2, plotW: 16, plotD: 12 },
  { id: 'luxe', name: 'Luxury Modern', styleId: 'luxe', template: 'luxe3', w: 18, d: 11, floorH: 3.4, plotW: 12, plotD: 10 },
  { id: 'stonetown', name: 'Stone Townhouse', styleId: 'stonetown', template: 'stone3', w: 8, d: 14, floorH: 3.3, plotW: 7, plotD: 11 },
  { id: 'boxtwo', name: 'Modern Box', styleId: 'boxtwo', template: 'box2', w: 10, d: 9, floorH: 3.1, plotW: 9, plotD: 9 },
  { id: 'thaigable', name: 'Modern Thai Gable', styleId: 'thaigable', template: 'gable1', w: 16, d: 10, floorH: 3.1, plotW: 12, plotD: 10 },
  { id: 'countryside', name: 'Thai Country Bungalow', styleId: 'countryside', template: 'porch1', w: 11, d: 9, floorH: 3.0, plotW: 10, plotD: 10 },
  { id: 'cottage', name: 'Arch Cottage', styleId: 'cottage', template: 'arch1', w: 15, d: 9, floorH: 3.0, plotW: 11, plotD: 10 },
  { id: 'farmhouse', name: 'Modern Farmhouse', styleId: 'farmhouse', template: 'farm2', w: 16, d: 11, floorH: 3.0, plotW: 12, plotD: 11 },
  { id: 'victorian', name: 'Victorian Cottage', styleId: 'victorian', template: 'cottage15', w: 10, d: 10, floorH: 2.9, plotW: 9, plotD: 10 },
  { id: 'americana', name: 'Brick Garage Colonial', styleId: 'americana', template: 'garagewing', w: 16, d: 11, floorH: 2.9, plotW: 12, plotD: 11 },
  { id: 'thaimodern', name: 'Modern Thai Stilt House', styleId: 'thaimodern', template: 'stilt2', w: 15, d: 10, floorH: 3.1, plotW: 12, plotD: 11 },
];

export function styleById(id: string) { return STYLES.find((s) => s.id === id) ?? STYLES[0]; }

/** A design picked from a link like /builder?preset=thai, read once and then removed from the address bar. */
export function presetFromUrl(): HouseSpec | null {
  if (typeof location === 'undefined') return null;
  const u = new URL(location.href), id = u.searchParams.get('preset');
  if (!id) return null;
  u.searchParams.delete('preset');
  history.replaceState(null, '', u.pathname + u.search + u.hash);
  return HOUSE_PRESETS.some((p) => p.id === id) ? presetSpec(id) : null;
}

export function specFromPreset(p: Preset): HouseSpec {
  const st = styleById(p.styleId), t = TEMPLATES.find((x) => x.id === p.template)!;
  const plotWm = p.plotW * 2, plotDm = p.plotD * 2;
  const lay = applyTemplate(t, p.w, p.d);
  return {
    name: p.name, styleId: st.id, w: p.w, d: p.d, floors: t.floors, floorH: p.floorH, roof: st.roof, glass: st.glass, finish: st.finish,
    colors: { ...st.colors }, levels: lay.levels, extents: lay.extents, twin: lay.twin, ...styleLook(st),
    site: { plotW: p.plotW, plotD: p.plotD, front: Math.max(0.5, snap((plotDm - p.d) * 0.55, 0.5)), left: Math.max(0.5, snap((plotWm - p.w) / 2, 0.5)) },
  };
}
export const presetSpec = (id: string) => specFromPreset(HOUSE_PRESETS.find((p) => p.id === id) ?? HOUSE_PRESETS[0]);

/* ---------------- openings: doors, open-plan gaps and windows ---------------- */

export type HoleKind = 'door' | 'open' | 'window' | 'glass' | 'high' | 'front' | 'fins' | 'round';
export interface Hole { a0: number; a1: number; kind: HoleKind; sill: number; head: number; winId?: string; doorId?: string; door?: DoorKind }
/** One straight wall of a room. Axis walls use (axis, fixed, a0..a1); diagonal walls use p0 → p1 and a0..a1 = 0..length. */
export interface Edge { room: PRoom; side: EdgeSide; axis: 'x' | 'z' | 'd'; fixed: number; a0: number; a1: number; p0: Pt; p1: Pt; perimeter: boolean; holes: Hole[] }
export interface DoorMark { floor: number; axis: 'x' | 'z'; fixed: number; c: number; w: number; /** room the leaf swings into */ into: PRoom; open: boolean; front: boolean; owner: PRoom; /** range the door centre can slide in */ lo: number; hi: number; kind?: DoorKind; flip?: boolean; doorId?: string }

const EPS = 1e-3;
const OPEN_SET = new Set<PType>(['living', 'dining', 'kitchen', 'hall', 'stairs', 'undercroft']);
const PRIORITY: Partial<Record<PType, number>> = { hall: 0, living: 1, stairs: 2, dining: 3, kitchen: 4, terrace: 5, undercroft: 5, bedroom: 6, kids: 7, office: 8 };
const WIN_SIZE: Record<WinSpec['kind'], { sill: number; head: number }> = { window: { sill: 0.8, head: 2.2 }, glass: { sill: 0, head: 2.5 }, high: { sill: 1.6, head: 2.1 }, door: { sill: 0, head: 2.2 }, fins: { sill: 0, head: 2.5 }, round: { sill: 0.9, head: 2.0 } };

/** Walls of a room from its outline. */
export function edgesOf(r: PRoom, s: HouseSpec, fi: number): Edge[] {
  const p = roomPoly(r), fr = floorRect(s, fi), out: Edge[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    if (Math.hypot(dx, dz) < 0.05) continue;
    if (Math.abs(dz) < EPS) {
      const side: Side = dx > 0 ? 'n' : 's';
      const per = side === 'n' ? Math.abs(a.z - fr.z) < EPS : Math.abs(a.z - (fr.z + fr.d)) < EPS;
      out.push({ room: r, side, axis: 'x', fixed: a.z, a0: Math.min(a.x, b.x), a1: Math.max(a.x, b.x), p0: a, p1: b, perimeter: per, holes: [] });
    } else if (Math.abs(dx) < EPS) {
      const side: Side = dz > 0 ? 'e' : 'w';
      const per = side === 'w' ? Math.abs(a.x - fr.x) < EPS : Math.abs(a.x - (fr.x + fr.w)) < EPS;
      out.push({ room: r, side, axis: 'z', fixed: a.x, a0: Math.min(a.z, b.z), a1: Math.max(a.z, b.z), p0: a, p1: b, perimeter: per, holes: [] });
    } else {
      // A diagonal wall faces the space the cut removed, so it is treated as an outside wall.
      out.push({ room: r, side: 'd', axis: 'd', fixed: 0, a0: 0, a1: Math.hypot(dx, dz), p0: a, p1: b, perimeter: true, holes: [] });
    }
  }
  return out;
}
const opposite: Record<Side, Side> = { n: 's', s: 'n', w: 'e', e: 'w' };

/** Longest stretch where two rooms touch along a wall, with both walls. */
function shared(ea: Edge[], eb: Edge[]) {
  let best: { axis: 'x' | 'z'; fixed: number; s0: number; s1: number; A: Edge; B: Edge } | null = null;
  for (const A of ea) for (const B of eb) {
    if (A.axis === 'd' || A.axis !== B.axis || A.side === 'd' || B.side !== opposite[A.side as Side] || Math.abs(A.fixed - B.fixed) > EPS) continue;
    const s0 = Math.max(A.a0, B.a0), s1 = Math.min(A.a1, B.a1);
    if (s1 - s0 > 0.3 && (!best || s1 - s0 > best.s1 - best.s0)) best = { axis: A.axis, fixed: A.fixed, s0, s1, A, B };
  }
  return best;
}

/** Where on a wall a user window sits, in that wall's own coordinates. */
function winOnEdge(e: Edge, wsp: WinSpec) {
  const len = e.a1 - e.a0, w = Math.min(wsp.w, len - 0.3);
  const c = e.a0 + Math.min(len - w / 2 - 0.15, Math.max(w / 2 + 0.15, wsp.pos * len));
  return { a0: c - w / 2, a1: c + w / 2 };
}

/** Walls of every room on a floor, with door, open-plan and window holes worked out. */
export function floorEdges(s: HouseSpec, fi: number): { edges: Edge[]; doors: DoorMark[] } {
  const rooms = s.levels[fi] ?? [];
  const byRoom = new Map<string, Edge[]>(rooms.map((r) => [r.id, edgesOf(r, s, fi)]));
  const doors: DoorMark[] = [];
  const linked = new Set<string>();

  // 1. Open plan between living spaces and circulation.
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
    const a = rooms[i], b = rooms[j];
    if (!OPEN_SET.has(a.type) || !OPEN_SET.has(b.type)) continue;
    if (s.twin && (a.x + a.w / 2 < s.w / 2) !== (b.x + b.w / 2 < s.w / 2)) continue;
    const sh = shared(byRoom.get(a.id)!, byRoom.get(b.id)!);
    if (!sh) continue;
    const h: Hole = { a0: sh.s0 + 0.12, a1: sh.s1 - 0.12, kind: 'open', sill: 0, head: 99 };
    if (h.a1 - h.a0 < 0.6) continue;
    sh.A.holes.push(h); sh.B.holes.push({ ...h });
    doors.push({ floor: fi, axis: sh.axis, fixed: sh.fixed, c: (h.a0 + h.a1) / 2, w: h.a1 - h.a0, into: a, open: true, front: false, owner: a, lo: 0, hi: 0 });
    linked.add(a.id); linked.add(b.id); linked.add([a.id, b.id].sort().join());
  }
  // 1b. Doors the user placed: on a shared wall they join the two rooms, on an outside wall they lead out.
  for (const a of rooms.filter((r) => r.doors)) {
    for (const ds of a.doors!) {
      const e = byRoom.get(a.id)!.filter((x) => x.side === ds.side).sort((p, q) => (q.a1 - q.a0) - (p.a1 - p.a0))[0];
      if (!e || e.axis === 'd' || e.a1 - e.a0 < 0.7) continue;
      const len = e.a1 - e.a0, w = Math.min(ds.w, len - 0.2);
      const c = e.a0 + Math.min(len - w / 2 - 0.1, Math.max(w / 2 + 0.1, ds.pos * len));
      // Is another room on the other side of this wall, right where the door is?
      let other: PRoom | null = null, oe: Edge | null = null;
      for (const b of rooms) {
        if (b === a) continue;
        const be = byRoom.get(b.id)!.find((x) => x.axis === e.axis && x.side === opposite[ds.side] && Math.abs(x.fixed - e.fixed) < EPS && x.a0 <= c - w / 2 + 0.05 && x.a1 >= c + w / 2 - 0.05);
        if (be) { other = b; oe = be; break; }
      }
      const out = e.perimeter && !other;
      const head = ds.kind === 'opening' ? Math.min(2.4, s.floorH - 0.35) : out ? 2.2 : 2.1;
      const h: Hole = { a0: c - w / 2, a1: c + w / 2, kind: out ? 'front' : ds.kind === 'opening' ? 'open' : 'door', sill: 0, head, doorId: ds.id, door: ds.kind };
      e.holes.push(h);
      if (oe && other) { oe.holes.push({ ...h }); linked.add([a.id, other.id].sort().join()); }
      const into = ds.flip ? (other ?? a) : a;
      doors.push({ floor: fi, axis: e.axis, fixed: e.fixed, c, w, into, open: ds.kind === 'opening', front: out, owner: a, lo: e.a0, hi: e.a1, kind: ds.kind, flip: ds.flip, doorId: ds.id });
    }
    linked.add(a.id);
  }
  // 2. One door per room into its best neighbour (rooms with doors placed by hand are left alone).
  for (const a of rooms) {
    if (a.doors) continue;
    if ((a.type === 'stairs' || OPEN_SET.has(a.type)) && linked.has(a.id)) continue;
    const ea = byRoom.get(a.id)!;
    const cands = rooms.filter((b) => b !== a && !b.doors && !(s.twin && (a.x + a.w / 2 < s.w / 2) !== (b.x + b.w / 2 < s.w / 2)))
      .map((b) => ({ b, sh: shared(ea, byRoom.get(b.id)!) })).filter((c) => c.sh && c.sh.s1 - c.sh.s0 >= 0.95);
    if (!cands.length) continue;
    const pri = (b: PRoom) => (a.type === 'bathroom' && b.type === 'bedroom' ? -0.5 : PRIORITY[b.type] ?? 9);
    cands.sort((p, q) => pri(p.b) - pri(q.b) || (q.sh!.s1 - q.sh!.s0) - (p.sh!.s1 - p.sh!.s0));
    const { b, sh } = cands[0];
    const key = [a.id, b.id].sort().join();
    if (linked.has(key)) continue;
    linked.add(key);
    const w = a.type === 'bathroom' || b.type === 'bathroom' ? 0.75 : a.type === 'terrace' || b.type === 'terrace' ? 1.6 : 0.9;
    const lo = sh!.s0 + w / 2 + 0.15, hi = sh!.s1 - w / 2 - 0.15;
    const c = hi <= lo ? (sh!.s0 + sh!.s1) / 2 : lo + (hi - lo) * (a.doorAt ?? 0.15);
    const h: Hole = { a0: c - w / 2, a1: c + w / 2, kind: 'door', sill: 0, head: 2.1 };
    sh!.A.holes.push(h); sh!.B.holes.push({ ...h });
    const into = (PRIORITY[a.type] ?? 9) > (PRIORITY[b.type] ?? 9) ? a : b;
    doors.push({ floor: fi, axis: sh!.axis, fixed: sh!.fixed, c, w, into, open: false, front: false, owner: a, lo, hi });
  }
  // 3. Windows and outside doors the user placed.
  const manual = rooms.filter((r) => r.windows);
  for (const r of manual) {
    const es = byRoom.get(r.id)!.filter((e) => e.perimeter);
    for (const wsp of r.windows!) {
      const e = es.filter((x) => x.side === wsp.side).sort((p, q) => (q.a1 - q.a0) - (p.a1 - p.a0))[0];
      if (!e || e.a1 - e.a0 < 0.7) continue;
      const pos = winOnEdge(e, wsp), sz = WIN_SIZE[wsp.kind];
      const head = wsp.kind === 'glass' || wsp.kind === 'fins' ? Math.min(2.6, s.floorH - 0.45) : sz.head;
      // A round window is as tall as it is wide.
      const rnd = wsp.kind === 'round' ? { sill: Math.max(0.6, 1.45 - (pos.a1 - pos.a0) / 2), head: Math.max(0.6, 1.45 - (pos.a1 - pos.a0) / 2) + (pos.a1 - pos.a0) } : null;
      e.holes.push({ ...pos, kind: wsp.kind === 'door' ? 'front' : wsp.kind, sill: rnd ? rnd.sill : sz.sill, head: rnd ? rnd.head : head, winId: wsp.id });
      if (wsp.kind === 'door' && e.axis !== 'd') doors.push({ floor: fi, axis: e.axis, fixed: e.fixed, c: (pos.a0 + pos.a1) / 2, w: pos.a1 - pos.a0, into: r, open: false, front: true, owner: r, lo: 0, hi: 0 });
    }
  }
  // 4. Front door on the ground floor, one per home for twin houses, unless the user placed outside doors.
  const userDoor = manual.some((r) => r.windows!.some((w) => w.kind === 'door')) || doors.some((d) => d.front);
  if (fi === 0 && !userDoor) {
    const halves = s.twin ? [[0, s.w / 2], [s.w / 2, s.w]] : [[0, s.w]];
    for (const [h0, h1] of halves) {
      const fronts = rooms.filter((r) => !r.windows && r.type !== 'garage' && r.type !== 'carport' && r.type !== 'undercroft' && r.x + r.w / 2 >= h0 && r.x + r.w / 2 < h1)
        .map((r) => ({ r, e: byRoom.get(r.id)!.find((e) => e.side === 's' && e.perimeter && e.a1 - e.a0 >= 1.4) })).filter((c) => c.e);
      const pick = (t: PType) => fronts.find((c) => c.r.type === t);
      const c0 = pick('hall') ?? pick('living') ?? pick('dining') ?? pick('terrace') ?? fronts[0];
      if (!c0) continue;
      const e = c0.e!, len = e.a1 - e.a0;
      const c = e.a0 + Math.min(len - 0.75, Math.max(0.75, len * 0.3));
      if (c0.r.type !== 'terrace') e.holes.push({ a0: c - 0.55, a1: c + 0.55, kind: 'front', sill: 0, head: 2.2 });
      doors.push({ floor: fi, axis: 'x', fixed: e.fixed, c, w: 1.1, into: c0.r, open: false, front: true, owner: c0.r, lo: 0, hi: 0 });
    }
  }
  // 5. Automatic windows on outside walls, kept clear of doors.
  let roundLeft = s.roundWindows && fi === s.floors - 1 ? 1 : 0;
  for (const r of rooms) {
    if (r.windows || r.type === 'carport') continue;
    for (const e of byRoom.get(r.id)!) {
      if (!e.perimeter) continue;
      const t = r.type, len = e.a1 - e.a0;
      if (t === 'garage' && e.side === 's') { e.holes.push({ a0: e.a0 + 0.25, a1: e.a1 - 0.25, kind: 'open', sill: 0, head: 2.4 }); continue; }
      if (t === 'terrace' || t === 'garage' || t === 'undercroft' || len < 1.2) continue;
      if (s.twin && e.axis === 'z' && Math.abs(e.fixed - s.w / 2) < EPS) continue;
      let win: Hole;
      const living = t === 'living' || t === 'dining';
      if (living && s.glass === 'more' && (e.side === 's' || len >= 3)) win = { a0: e.a0 + 0.3, a1: e.a1 - 0.3, kind: 'glass', sill: 0, head: Math.min(2.6, s.floorH - 0.45) };
      else if (['bathroom', 'laundry', 'storage', 'stairs', 'hall'].includes(t)) { const w = Math.min(len - 0.8, 0.9); win = { a0: (e.a0 + e.a1 - w) / 2, a1: (e.a0 + e.a1 + w) / 2, kind: 'high', sill: 1.6, head: 2.1 }; }
      else { const w = Math.min(len - 0.9, living ? 2.6 : t === 'kitchen' ? 1.6 : s.glass === 'more' && e.side === 's' ? 2.2 : 1.6); win = { a0: (e.a0 + e.a1 - w) / 2, a1: (e.a0 + e.a1 + w) / 2, kind: 'window', sill: t === 'kitchen' ? 1.05 : living ? 0.5 : 0.8, head: 2.2 }; }
      const blocks = e.holes.map((h) => [h.a0 - 0.25, h.a1 + 0.25] as const).sort((p, q) => p[0] - q[0]);
      let best: [number, number] | null = null, cur = e.a0 + 0.2;
      for (const [b0, b1] of [...blocks, [e.a1 - 0.2, e.a1 - 0.2] as const]) { if (b0 - cur > (best ? best[1] - best[0] : 0)) best = [cur, b0]; cur = Math.max(cur, b1); }
      if (!best) continue;
      const a0 = Math.max(win.a0, best[0]), a1 = Math.min(win.a1, best[1]);
      if (a1 - a0 < 0.6) continue;
      // Style accents: fins in front of upper street-side glass, one round window on the street side.
      if (s.screens && fi > 0 && e.side === 's' && (win.kind === 'glass' || win.kind === 'window')) { e.holes.push({ a0, a1, kind: 'fins', sill: 0, head: Math.min(2.6, s.floorH - 0.45) }); continue; }
      if (roundLeft && e.side === 's' && !living && t !== 'stairs' && a1 - a0 >= 1) {
        roundLeft--; const dia = Math.min(1.1, a1 - a0 - 0.2), c = (a0 + a1) / 2;
        e.holes.push({ a0: c - dia / 2, a1: c + dia / 2, kind: 'round', sill: 0.95, head: 0.95 + dia }); continue;
      }
      e.holes.push({ ...win, a0, a1 });
    }
  }
  return { edges: [...byRoom.values()].flat(), doors };
}

/** The automatic windows of a room, as editable specs (used when the user starts moving windows). */
export function autoWindows(s: HouseSpec, fi: number, r: PRoom): WinSpec[] {
  const { edges } = floorEdges(s, fi);
  const out: WinSpec[] = [];
  for (const e of edges) {
    if (e.room.id !== r.id || !e.perimeter) continue;
    const len = e.a1 - e.a0;
    for (const h of e.holes) {
      if (h.kind !== 'window' && h.kind !== 'glass' && h.kind !== 'high' && h.kind !== 'front' && h.kind !== 'fins' && h.kind !== 'round') continue;
      out.push({ id: rid(), side: e.side, pos: ((h.a0 + h.a1) / 2 - e.a0) / len, w: Math.round((h.a1 - h.a0) * 4) / 4, kind: h.kind === 'front' ? 'door' : h.kind });
    }
  }
  return out;
}

/** Stairs rooms on the floor below, whose steps come up through this floor. */
export function stairVoids(s: HouseSpec, fi: number) {
  return fi > 0 ? (s.levels[fi - 1] ?? []).filter((r) => r.type === 'stairs') : [];
}

export function totals(s: HouseSpec) {
  const fp = s.w * s.d, plot = s.site.plotW * s.site.plotD * 4;
  const rooms = s.levels.slice(0, s.floors).flat();
  const count = (t: PType[]) => rooms.filter((r) => t.includes(r.type)).length;
  let floorArea = 0;
  for (let i = 0; i < s.floors; i++) { const f = floorRect(s, i); floorArea += f.w * f.d; }
  floorArea -= rooms.filter((r) => r.type === 'undercroft' || r.type === 'carport').reduce((a, r) => a + area(r), 0) * 0.7;
  const fin: Record<string, number> = { oak: 90, walnut: 130, marble: 210, terrazzo: 160, tile: 70, concrete: 55, carpet: 45 };
  const roofCost = { flat: 900, terrace: 1300, gable: 1100, hip: 1250, shed: 950, thai: 1600, irimoya: 1500, gambrel: 1250 }[s.roof] ?? 1000;
  const cost = floorArea * 14000 + fp * roofCost + rooms.reduce((a, r) => a + area(r) * (fin[r.floor] ?? 80) * 10 + r.items.length * 9000, 0);
  return { fp, plot, yard: plot - fp, coverage: fp / plot, floorArea, beds: count(['bedroom', 'kids']), baths: count(['bathroom']), rooms: rooms.filter((r) => !['hall', 'stairs', 'storage', 'undercroft', 'carport'].includes(r.type)).length, cost: Math.round(cost / 10000) * 10000 };
}

/**
 * Where the main roof goes: the top floor, minus carports running the whole depth (or width) along one side,
 * which get a flat roof of their own (a gable house with a flat carport beside it).
 */
export function mainRoofRect(s: HouseSpec): Rect {
  const fi = s.floors - 1, fr = floorRect(s, fi);
  let x0 = fr.x, x1 = fr.x + fr.w, z0 = fr.z, z1 = fr.z + fr.d;
  for (const r of (s.levels[fi] ?? []).filter((q) => q.type === 'carport' && !q.shape)) {
    const fullD = r.z <= z0 + 0.01 && r.z + r.d >= z1 - 0.01, fullW = r.x <= x0 + 0.01 && r.x + r.w >= x1 - 0.01;
    if (fullD && r.x <= x0 + 0.01 && r.x + r.w < x1 - 1) x0 = r.x + r.w;
    else if (fullD && r.x + r.w >= x1 - 0.01 && r.x > x0 + 1) x1 = r.x;
    else if (fullW && r.z + r.d >= z1 - 0.01 && r.z > z0 + 1) z1 = r.z;
    else if (fullW && r.z <= z0 + 0.01 && r.z + r.d < z1 - 1) z0 = r.z + r.d;
  }
  return { x: x0, z: z0, w: x1 - x0, d: z1 - z0 };
}

/** The doors a room has now (automatic or placed), as editable specs: used when the user starts placing doors by hand. */
export function autoDoors(s: HouseSpec, fi: number, r: PRoom): DoorSpec[] {
  if (r.doors) return r.doors;
  const { edges } = floorEdges(s, fi);
  const out: DoorSpec[] = [];
  for (const e of edges) {
    if (e.room.id !== r.id || e.axis === 'd') continue;
    const len = e.a1 - e.a0;
    for (const h of e.holes) {
      if (h.kind !== 'door' && h.kind !== 'front') continue;
      out.push({ id: rid(), side: e.side as Side, pos: ((h.a0 + h.a1) / 2 - e.a0) / len, w: Math.round((h.a1 - h.a0) * 20) / 20, kind: 'swing' });
    }
  }
  return out;
}
export const makePost = (floor: number, x: number, z: number, round = false): Post => ({ id: rid(), floor, x, z, size: 0.25, round });

/** Turn the room that owns door `d` over to hand-placed doors (keeping every door where it is) and return the id of `d` there. */
export function adoptDoor(s: HouseSpec, fi: number, d: DoorMark): { spec: HouseSpec; roomId: string; doorId: string } | null {
  const owner = s.levels[fi]?.find((r) => r.id === d.owner.id);
  if (!owner) return null;
  if (owner.doors && d.doorId) return { spec: s, roomId: owner.id, doorId: d.doorId };
  const { edges } = floorEdges(s, fi);
  const specs: DoorSpec[] = [];
  let hit: string | null = null;
  for (const e of edges) {
    if (e.room.id !== owner.id || e.axis === 'd') continue;
    const len = e.a1 - e.a0;
    for (const h of e.holes) {
      if (h.kind !== 'door' && h.kind !== 'front') continue;
      const c = (h.a0 + h.a1) / 2;
      const ds: DoorSpec = { id: rid(), side: e.side as Side, pos: (c - e.a0) / len, w: Math.round((h.a1 - h.a0) * 20) / 20, kind: h.door ?? 'swing' };
      specs.push(ds);
      if (!hit && e.axis === d.axis && Math.abs(e.fixed - d.fixed) < 0.01 && Math.abs(c - d.c) < 0.05) hit = ds.id;
    }
  }
  if (!hit) return null;
  const levels = s.levels.map((lv, i) => (i === fi ? lv.map((r) => (r.id === owner.id ? { ...r, doors: specs } : r)) : lv));
  return { spec: { ...s, levels }, roomId: owner.id, doorId: hit };
}
