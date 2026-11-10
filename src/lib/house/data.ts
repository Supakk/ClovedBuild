// House catalogue: room types, finishes, presets and the fixed floor plan.

export type RoomType = 'living' | 'bedroom' | 'kids' | 'kitchen' | 'dining' | 'bathroom' | 'office';
export type FloorKey = 'g' | 'u';
export type ViewMode = 'x' | FloorKey;
export type Garden = 'lush' | 'simple' | 'minimal';
export type Side = 'front' | 'back' | 'left' | 'right';
export type WallKind = 'solid' | 'window' | 'glass';

export interface RoomState {
  type: RoomType;
  floor: string;
  paint: string;
  items: string[];
}

export interface Exterior {
  wall: string;
  frame: string;
  wood: string;
  garden: Garden;
}

export interface Design {
  ext: Exterior;
  rooms: Record<string, RoomState>;
}

export interface RoomDef {
  id: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  ext?: Partial<Record<Side, WallKind>>;
}

export const TYPES: Record<RoomType, { label: string; items: [string, string][] }> = {
  living: { label: 'Living room', items: [['sofa', 'Sofa'], ['coffee', 'Coffee table'], ['rug', 'Rug'], ['tv', 'TV console'], ['armchair', 'Armchair'], ['lamp', 'Floor lamp'], ['plant', 'Plant']] },
  bedroom: { label: 'Bedroom', items: [['bed', 'Double bed'], ['nightstands', 'Nightstands'], ['wardrobe', 'Wardrobe'], ['desk', 'Desk'], ['rug', 'Rug'], ['plant', 'Plant']] },
  kids: { label: 'Kids room', items: [['bed', 'Single bed'], ['toys', 'Toy box'], ['rug', 'Play rug'], ['desk', 'Desk'], ['plant', 'Plant']] },
  kitchen: { label: 'Kitchen', items: [['counter', 'Counter'], ['uppers', 'Wall cabinets'], ['fridge', 'Fridge'], ['island', 'Island'], ['plant', 'Plant']] },
  dining: { label: 'Dining room', items: [['table', 'Table and chairs'], ['sideboard', 'Sideboard'], ['pendant', 'Pendant light'], ['plant', 'Plant']] },
  bathroom: { label: 'Bathroom', items: [['tub', 'Bathtub'], ['vanity', 'Vanity'], ['toilet', 'Toilet'], ['rug', 'Bath mat'], ['plant', 'Plant']] },
  office: { label: 'Office', items: [['desk', 'Desk'], ['shelf', 'Bookshelf'], ['rug', 'Rug'], ['plant', 'Plant']] },
};

export const FINS: [string, string, string][] = [
  ['oak', 'Oak', '#C99A6B'],
  ['walnut', 'Walnut', '#80573B'],
  ['marble', 'Marble', '#EFEBE6'],
  ['terrazzo', 'Terrazzo', '#E5D6C8'],
  ['tile', 'Blue tile', '#BFD0D5'],
  ['concrete', 'Concrete', '#ADA9A4'],
  ['carpet', 'Carpet', '#CFBBA8'],
];

export const FIN_COST: Record<string, number> = { oak: 90, walnut: 130, marble: 210, terrazzo: 160, tile: 70, concrete: 55, carpet: 45 };

export const PAINTS: [string, string][] = [
  ['Chalk', '#F4EFE8'], ['Peach', '#F3D5C2'], ['Sage', '#D6DEC9'], ['Mist', '#D4E0E6'], ['Clay', '#DDA98C'], ['Charcoal', '#5A5450'],
];

export const EXT: Record<'wall' | 'frame' | 'wood', [string, string][]> = {
  wall: [['White', '#F5F3EF'], ['Sand', '#EBDDCA'], ['Peach', '#F0CFBB'], ['Stone', '#CFCBC6'], ['Graphite', '#5B5753']],
  frame: [['Black', '#25221F'], ['Bronze', '#6A4A34'], ['White', '#ECEAE6']],
  wood: [['Rust', '#9A5634'], ['Oak', '#C59C70'], ['Walnut', '#6B4832'], ['Charcoal', '#34312F']],
};

/* Fixed architecture: 7 m x 5.5 m footprint, two floors. */
export const X0 = -3.5, X1 = 3.5, Z0 = -2.75, Z1 = 2.75, TE = 0.2, TI = 0.12;

export const PLAN: Record<FloorKey, { label: string; y: number; rooms: RoomDef[] }> = {
  g: {
    label: 'Ground floor', y: 0.3, rooms: [
      { id: 'g1', x0: -3.5, x1: 0.6, z0: -0.4, z1: 2.75, ext: { front: 'window', left: 'window' } },
      { id: 'g2', x0: 0.6, x1: 3.5, z0: -0.4, z1: 2.75, ext: { front: 'glass', right: 'glass' } },
      { id: 'g3', x0: -3.5, x1: -1.0, z0: -2.75, z1: -0.4, ext: { left: 'window', back: 'window' } },
      { id: 'g4', x0: -1.0, x1: 3.5, z0: -2.75, z1: -0.4, ext: { back: 'window', right: 'glass' } },
    ],
  },
  u: {
    label: 'Upper floor', y: 3.3, rooms: [
      { id: 'u1', x0: -3.5, x1: 0.4, z0: -0.3, z1: 2.75, ext: { front: 'glass', left: 'window' } },
      { id: 'u2', x0: 0.4, x1: 3.5, z0: -0.3, z1: 2.75, ext: { front: 'glass', right: 'glass' } },
      { id: 'u3', x0: -3.5, x1: -0.8, z0: -2.75, z1: -0.3, ext: { left: 'window', back: 'window' } },
      { id: 'u4', x0: -0.8, x1: 3.5, z0: -2.75, z1: -0.3, ext: { back: 'window', right: 'window' } },
    ],
  },
};

export function roomDef(id: string): RoomDef {
  return PLAN[id.charAt(0) as FloorKey].rooms.find((r) => r.id === id)!;
}

export const allItems = (t: RoomType) => TYPES[t].items.map((i) => i[0]);
const R = (type: RoomType, floor: string, paint: string): RoomState => ({ type, floor, paint, items: allItems(type) });

export interface Preset extends Design {
  name: string;
  price: number;
  room: string;
  area: string;
}

export const PRESETS: Record<string, Preset> = {
  nyc: {
    name: 'New York City', price: 30000000, room: '4 Room', area: '5,000 sq ft',
    ext: { wall: '#F5F3EF', frame: '#25221F', wood: '#34312F', garden: 'simple' },
    rooms: {
      g1: R('living', 'concrete', '#F4EFE8'), g2: R('kitchen', 'concrete', '#5A5450'), g3: R('bathroom', 'marble', '#F4EFE8'), g4: R('office', 'walnut', '#D4E0E6'),
      u1: R('bedroom', 'walnut', '#D4E0E6'), u2: R('bedroom', 'walnut', '#F4EFE8'), u3: R('bathroom', 'tile', '#F4EFE8'), u4: R('dining', 'oak', '#F4EFE8'),
    },
  },
  santorini: {
    name: 'Santorini', price: 50000000, room: '4 Room', area: '5,000 sq ft',
    ext: { wall: '#F5F3EF', frame: '#25221F', wood: '#9A5634', garden: 'lush' },
    rooms: {
      g1: R('living', 'oak', '#F4EFE8'), g2: R('kitchen', 'marble', '#F4EFE8'), g3: R('bathroom', 'tile', '#D4E0E6'), g4: R('dining', 'oak', '#F3D5C2'),
      u1: R('bedroom', 'oak', '#F3D5C2'), u2: R('kids', 'oak', '#D6DEC9'), u3: R('bathroom', 'marble', '#F4EFE8'), u4: R('office', 'walnut', '#F4EFE8'),
    },
  },
  rio: {
    name: 'Rio de Janeiro', price: 45000000, room: '4 Room', area: '4,000 sq ft',
    ext: { wall: '#F0CFBB', frame: '#6A4A34', wood: '#C59C70', garden: 'lush' },
    rooms: {
      g1: R('living', 'terrazzo', '#F3D5C2'), g2: R('kitchen', 'terrazzo', '#F4EFE8'), g3: R('bathroom', 'terrazzo', '#D6DEC9'), g4: R('dining', 'oak', '#DDA98C'),
      u1: R('bedroom', 'oak', '#F3D5C2'), u2: R('bedroom', 'carpet', '#F4EFE8'), u3: R('bathroom', 'tile', '#F4EFE8'), u4: R('office', 'oak', '#D6DEC9'),
    },
  },
};

export const cloneDesign = (d: Design): Design => JSON.parse(JSON.stringify({ ext: d.ext, rooms: d.rooms }));
export const money = (n: number) => '$' + n.toLocaleString('en-US');
export const finOf = (k: string) => FINS.find((f) => f[0] === k) ?? FINS[0];

export function metrics(s: Design) {
  let area = 0, beds = 0, baths = 0, cost = 0;
  for (const id of Object.keys(s.rooms)) {
    const d = roomDef(id), r = s.rooms[id], a = (d.x1 - d.x0) * (d.z1 - d.z0);
    area += a;
    if (r.type === 'bedroom' || r.type === 'kids') beds++;
    if (r.type === 'bathroom') baths++;
    cost += a * (1650 + FIN_COST[r.floor]) + r.items.length * 1400;
  }
  return { area: Math.round(area), beds, baths, cost: Math.round((cost + 38000) / 1000) * 1000 };
}
