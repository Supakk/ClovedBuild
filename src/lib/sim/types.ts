// Simulator data: objects on the plot, catalogue, units and the starting scene.
import { PTYPES, presetSpec, type HouseSpec, type PType } from '../plan/spec';
import { t, tr } from '../i18n';
import { housePlace, roomPiece, roomRect } from '../plan/build3d';
import { disposeDiorama } from '../house/geometry';

/** 1 wah (วา) = 2 m, so one grid cell of 1 wah x 1 wah is 1 square wah (ตร.ว.) = 4 m². */
export const WAH = 2;

export type Kind = 'house' | 'furn' | 'tree' | 'bush' | 'patio' | 'pool' | 'lounger' | 'car' | 'person' | 'dog' | 'cat';
/** What Top view shows inside houses: the roof ('x') or an opened floor (0 = ground). */
export type TopFloor = 'x' | number;

export interface SimObject {
  id: string;
  kind: Kind;
  /** Position in metres. For objects inside a house it is relative to that house's centre. */
  x: number;
  z: number;
  /** Rotation in radians, relative to the parent. */
  rot: number;
  /** Id of the house this object stands in, and which floor (0 = ground). */
  parent?: string;
  floor?: number;
  props: Record<string, any>;
}

export interface Plot { w: number; d: number } // in wah
export interface Scene { plot: Plot; objects: SimObject[] }

/** Small objects can be carried into a house and onto a floor. */
export const CARRYABLE: Kind[] = ['furn', 'person', 'dog', 'cat', 'patio', 'lounger', 'bush'];
export const LIVING: Kind[] = ['person', 'dog', 'cat'];

export const SHIRTS = ['#E9694B', '#4F7F95', '#7C8F5A', '#E8B04B', '#8C6B9B', '#F4EFE8', '#2E2A28'];
export const DOG_COATS: [string, string][] = [['Golden', '#C98E4E'], ['Brown', '#7A5136'], ['Black', '#2E2A28'], ['Cream', '#EDE3D2'], ['Grey', '#9A948E']];
export const CAT_COATS: [string, string][] = [['Ginger', '#D9883F'], ['Grey', '#8E8A86'], ['Black', '#2E2A28'], ['White', '#F2EEE8'], ['Cream', '#E5CDA8']];
export const CAR_COLORS: [string, string][] = [['White', '#F2F0EC'], ['Red', '#B9412F'], ['Blue', '#3F6E8C'], ['Graphite', '#45484C'], ['Sage', '#8FA387']];

let counter = 0;
export const newId = (k: string) => `${k}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function kindLabel(o: SimObject) {
  switch (o.kind) {
    case 'house': return t((o.props.spec as HouseSpec | undefined)?.name || 'House');
    case 'furn': return t(PTYPES[o.props.type as PType]?.items.find((i) => i[0] === o.props.item)?.[1] ?? 'Furniture');
    case 'person': return o.props.name || tr('Person', 'คน');
    case 'dog': return o.props.name || tr('Dog', 'สุนัข');
    case 'cat': return o.props.name || tr('Cat', 'แมว');
    case 'tree': return tr('Tree', 'ต้นไม้');
    case 'bush': return tr('Shrub', 'พุ่มไม้');
    case 'patio': return tr('Patio set', 'ชุดโต๊ะสนาม');
    case 'pool': return tr('Pool', 'สระว่ายน้ำ');
    case 'lounger': return tr('Lounger', 'เก้าอี้อาบแดด');
    case 'car': return tr('Car', 'รถยนต์');
  }
}

export interface CatalogItem { key: string; label: string; make: () => Omit<SimObject, 'id' | 'x' | 'z'> }
export interface CatalogGroup { title: string; items: CatalogItem[] }

const furn = (type: PType, item: string, w = 3.6, d = 3.0, label?: string, variant?: string): CatalogItem => ({
  key: `furn-${type}-${item}${variant ? '-' + variant : ''}`,
  label: label ?? PTYPES[type].items.find((i) => i[0] === item)![1],
  make: () => ({ kind: 'furn', rot: 0, props: { type, item, w, d, variant } }),
});

export const CATALOG: CatalogGroup[] = [
  {
    title: 'People and pets',
    items: [
      { key: 'person', label: 'Adult', make: () => ({ kind: 'person', rot: 0, props: { name: 'Person', height: 170, shirt: SHIRTS[1] } }) },
      { key: 'child', label: 'Child', make: () => ({ kind: 'person', rot: 0, props: { name: 'Child', height: 120, shirt: SHIRTS[3] } }) },
      { key: 'dog', label: 'Dog', make: () => ({ kind: 'dog', rot: 0, props: { name: 'Dog', size: 'm', coat: DOG_COATS[0][1] } }) },
      { key: 'cat', label: 'Cat', make: () => ({ kind: 'cat', rot: 0, props: { name: 'Cat', coat: CAT_COATS[0][1] } }) },
    ],
  },
  {
    title: 'Living and dining',
    items: [furn('living', 'sofa', 4, 3), furn('living', 'coffee', 4, 3), furn('living', 'armchair'), furn('living', 'tv'), furn('living', 'rug', 4, 3), furn('living', 'lamp'), furn('dining', 'table', 4.4, 2.4), furn('dining', 'sideboard', 3, 2.4), furn('hall', 'console', 3, 2)],
  },
  {
    title: 'Bedroom and office',
    items: [furn('bedroom', 'bed', 3.8, 3), furn('bedroom', 'nightstands', 3.8, 3), furn('bedroom', 'wardrobe', 3.8, 3), furn('kids', 'bed', 3, 3, 'Single bed'), furn('kids', 'toys', 3, 3), furn('office', 'desk', 4.2, 2.4), furn('office', 'shelf', 4.2, 2.4)],
  },
  {
    title: 'Kitchen, bath and utility',
    items: [furn('kitchen', 'counter', 2.8, 3), furn('kitchen', 'counter', 3, 3, 'L-shape kitchen', 'L'), furn('kitchen', 'counter', 3.2, 3, 'U-shape kitchen', 'U'), furn('kitchen', 'counter', 3, 3, 'Thai kitchen', 'thai'), furn('kitchen', 'fridge', 2.8, 3), furn('kitchen', 'island', 2.8, 3),
      furn('bathroom', 'tub', 2.4, 2.2), furn('bathroom', 'tub', 2.4, 2.2, 'Shower', 'shower'), furn('bathroom', 'vanity', 2.4, 2.2), furn('bathroom', 'vanity', 2.6, 2.2, 'Double basin', 'double'), furn('bathroom', 'toilet', 2.4, 2.2), furn('laundry', 'washer', 2, 2), furn('storage', 'shelf', 2.4, 1.5, 'Storage shelves')],
  },
  {
    title: 'Garden and outdoor',
    items: [
      { key: 'tree', label: 'Tree', make: () => ({ kind: 'tree', rot: 0, props: { scale: 1.1, variant: 0 } }) },
      { key: 'tree-s', label: 'Small tree', make: () => ({ kind: 'tree', rot: 0, props: { scale: 0.8, variant: 1 } }) },
      { key: 'bush', label: 'Shrub', make: () => ({ kind: 'bush', rot: 0, props: { variant: 0 } }) },
      furn('living', 'plant', 3.6, 3, 'Pot plant'),
      { key: 'patio', label: 'Patio set', make: () => ({ kind: 'patio', rot: 0, props: {} }) },
      { key: 'lounger', label: 'Lounger', make: () => ({ kind: 'lounger', rot: 0, props: {} }) },
      { key: 'pool', label: 'Pool', make: () => ({ kind: 'pool', rot: 0, props: {} }) },
      { key: 'car', label: 'Car', make: () => ({ kind: 'car', rot: 0, props: { color: CAR_COLORS[0][1] } }) },
    ],
  },
];

/** Where a piece of furniture sits inside a w x d room. */
export function pieceOffset(type: PType, item: string, w: number, d: number, variant?: string) {
  const { group, offset } = roomPiece(type, item, w, d, variant);
  disposeDiorama(group);
  return offset;
}

/** The furniture a designed house comes with, as separate movable objects. */
export function houseFurniture(houseId: string, spec: HouseSpec): SimObject[] {
  const out: SimObject[] = [];
  spec.levels.slice(0, spec.floors).forEach((rooms, fi) => {
    for (const r of rooms) {
      const rr = roomRect(spec, r), w = rr.x1 - rr.x0, d = rr.z1 - rr.z0, cx = (rr.x0 + rr.x1) / 2, cz = (rr.z0 + rr.z1) / 2;
      if (w < 0.6 || d < 0.6) continue;
      for (const item of r.items) {
        if (item === 'pendant') continue;
        const o = pieceOffset(r.type, item, w, d, r.variant);
        const pl = r.place?.[item];
        out.push({ id: newId('furn'), kind: 'furn', x: cx + o.x + (pl?.dx ?? 0), z: cz + o.z + (pl?.dz ?? 0), rot: -((pl?.turn ?? 0) % 4) * Math.PI / 2, parent: houseId, floor: fi, props: { type: r.type, item, w, d, variant: r.variant } });
      }
    }
  });
  return out;
}

/** A house object (with its furniture) standing where the builder put it on its plot. */
export function placedHouse(spec: HouseSpec, at?: { x: number; z: number }): SimObject[] {
  const id = newId('house'), p = at ?? housePlace(spec);
  return [{ id, kind: 'house', x: p.x, z: p.z, rot: 0, props: { spec } }, ...houseFurniture(id, spec)];
}

/** Square wah, rai-ngan-wah and m². */
export function areaText(p: Plot) {
  const sqw = p.w * p.d;
  const rai = Math.floor(sqw / 400), ngan = Math.floor((sqw % 400) / 100), wah = Math.round((sqw % 100) * 10) / 10;
  const parts = [rai && tr(`${rai} rai`, `${rai} ไร่`), ngan && tr(`${ngan} ngan`, `${ngan} งาน`), wah && tr(`${wah} sq. wah`, `${wah} ตร.ว.`)].filter(Boolean).join(' ');
  return { sqw, m2: sqw * WAH * WAH, thai: parts || tr('0 sq. wah', '0 ตร.ว.') };
}

export function defaultScene(): Scene {
  const spec = presetSpec('modern');
  const [house, ...furniture] = placedHouse(spec);
  return {
    plot: { w: spec.site.plotW, d: spec.site.plotD },
    objects: [
      house, ...furniture,
      { id: newId('person'), kind: 'person', x: -2.2, z: 1.6, rot: 0.4, parent: house.id, floor: 0, props: { name: 'Mali', height: 165, shirt: SHIRTS[0] } },
      { id: newId('cat'), kind: 'cat', x: -3.4, z: 2.6, rot: 2.4, parent: house.id, floor: 0, props: { name: 'Mochi', coat: CAT_COATS[0][1] } },
      { id: newId('person'), kind: 'person', x: 6.6, z: 6.2, rot: -0.8, props: { name: 'Ton', height: 180, shirt: SHIRTS[1] } },
      { id: newId('person'), kind: 'person', x: 7.6, z: 6.8, rot: -2.2, props: { name: 'Pim', height: 115, shirt: SHIRTS[3] } },
      { id: newId('dog'), kind: 'dog', x: 5.4, z: 7.2, rot: 0.6, props: { name: 'Lucky', size: 'm', coat: DOG_COATS[0][1] } },
      { id: newId('car'), kind: 'car', x: 8.6, z: -2.6, rot: 0, props: { color: CAR_COLORS[2][1] } },
      { id: newId('patio'), kind: 'patio', x: -8.4, z: 5.8, rot: 0, props: {} },
      { id: newId('tree'), kind: 'tree', x: -10.6, z: -7.4, rot: 0, props: { scale: 1.2, variant: 0 } },
      { id: newId('tree'), kind: 'tree', x: 10.6, z: -7.4, rot: 0, props: { scale: 1.0, variant: 1 } },
      { id: newId('tree'), kind: 'tree', x: -10.6, z: 7.4, rot: 0, props: { scale: 1.1, variant: 2 } },
      { id: newId('tree'), kind: 'tree', x: 10.6, z: 7.6, rot: 0, props: { scale: 0.9, variant: 3 } },
      { id: newId('bush'), kind: 'bush', x: -6.4, z: -6.0, rot: 0, props: { variant: 0 } },
      { id: newId('bush'), kind: 'bush', x: -4.6, z: -6.0, rot: 0, props: { variant: 1 } },
    ],
  };
}
