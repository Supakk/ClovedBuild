// Real-world checks for a house design.
// Legal minimums follow Thailand's Ministerial Regulation No. 55 (B.E. 2543) under the Building Control Act;
// comfort tips are common design practice. Local rules (e.g. Bangkok) can be stricter.
import { area, floorEdges, floorRect, houseHeight, mainRect, pointInRoom, stairVoids, typeLabel, type HouseSpec, type PRoom } from './spec';
import { t, tr } from '../i18n';

export type Level = 'error' | 'warn' | 'tip';
export interface Advice { level: Level; title: string; detail: string; floor?: number; roomId?: string; law?: boolean; /** which builder step fixes it */ area?: 'site' | 'house' }

const narrow = (r: PRoom) => { const m = mainRect(r); return Math.min(m.w, m.d); };
/** Shared floor area of two rooms, sampled on a 25 cm grid (works for L-shapes and cut corners). */
function overlapArea(p: PRoom, q: PRoom) {
  const x0 = Math.max(p.x, q.x), x1 = Math.min(p.x + p.w, q.x + q.w), z0 = Math.max(p.z, q.z), z1 = Math.min(p.z + p.d, q.z + q.d);
  if (x1 - x0 < 0.05 || z1 - z0 < 0.05) return 0;
  let n = 0; const st = 0.25;
  for (let x = x0 + st / 2; x < x1; x += st) for (let z = z0 + st / 2; z < z1; z += st) if (pointInRoom(p, x, z) && pointInRoom(q, x, z)) n++;
  return n * st * st;
}
const fmt = (n: number, d = 1) => n.toFixed(d).replace(/\.0+$/, '');
const nm = (r: PRoom) => t(typeLabel(r.type));

export function checkDesign(s: HouseSpec): Advice[] {
  const out: Advice[] = [];
  const add = (a: Advice) => out.push(a);
  const plotW = s.site.plotW * 2, plotD = s.site.plotD * 2;
  const fp = s.w * s.d;

  /* --- site --- */
  const open = plotW * plotD - fp;
  if (open < 0.3 * fp) {
    add({ level: 'error', law: true, area: 'site', title: tr('Not enough open space on the plot', 'ที่ว่างรอบบ้านไม่พอ'),
      detail: tr(`A home needs open space of at least 30% of its largest floor (${fmt(0.3 * fp)} m²). This plot leaves ${fmt(Math.max(0, open))} m². Make the house smaller or the plot bigger.`,
        `บ้านพักอาศัยต้องมีที่ว่างอย่างน้อย 30% ของพื้นที่ชั้นที่ใหญ่ที่สุด (${fmt(0.3 * fp)} ตร.ม.) ตอนนี้เหลือ ${fmt(Math.max(0, open))} ตร.ม. ลดขนาดบ้านหรือขยายที่ดิน`) });
  }
  const tall = houseHeight(s) > 9;
  const need = tall ? 3 : 2;
  const gaps: [string, string, number][] = [
    ['front', 'ด้านหน้า', s.site.front], ['back', 'ด้านหลัง', plotD - s.site.front - s.d], ['left', 'ด้านซ้าย', s.site.left], ['right', 'ด้านขวา', plotW - s.site.left - s.w],
  ];
  for (const [side, th, g] of gaps) {
    if (g < -0.01) add({ level: 'error', area: 'site', title: tr(`House goes past the ${side} boundary`, `บ้านล้ำแนวเขต${th}`), detail: tr(`Move it ${fmt(-g, 2)} m back inside the plot.`, `เลื่อนบ้านกลับเข้ามา ${fmt(-g, 2)} ม.`) });
    else if (g < 0.5) add({ level: 'error', law: true, area: 'site', title: tr(`Too close to the ${side} boundary (${fmt(g, 2)} m)`, `ชิดแนวเขต${th}เกินไป (${fmt(g, 2)} ม.)`),
      detail: tr('A solid wall must be at least 50 cm from the boundary, unless the neighbour agrees in writing to build on the line.', 'ผนังทึบต้องห่างแนวเขตอย่างน้อย 50 ซม. เว้นแต่เพื่อนบ้านยินยอมเป็นลายลักษณ์อักษรให้สร้างชิดเขต') });
    else if (g < need) add({ level: 'warn', law: true, area: 'site', title: tr(`${side[0].toUpperCase() + side.slice(1)} wall is ${fmt(g, 2)} m from the boundary`, `ผนัง${th}ห่างแนวเขต ${fmt(g, 2)} ม.`),
      detail: tr(`Walls with windows, doors or vents must be at least ${need} m from the boundary${tall ? ' because the house is taller than 9 m' : ''}. Keep that wall solid, or move the house.`,
        `ผนังที่มีหน้าต่าง ประตู หรือช่องระบายอากาศ ต้องห่างแนวเขตอย่างน้อย ${need} ม.${tall ? ' เพราะบ้านสูงเกิน 9 ม.' : ''} ให้ทำเป็นผนังทึบ หรือเลื่อนบ้าน`) });
  }
  if (tall) add({ level: 'tip', area: 'house', title: tr(`The house is about ${fmt(houseHeight(s))} m tall`, `บ้านสูงประมาณ ${fmt(houseHeight(s))} ม.`), detail: tr('Above 9 m, openings need 3 m from the boundary instead of 2 m.', 'ถ้าสูงเกิน 9 ม. ช่องเปิดต้องห่างแนวเขต 3 ม. แทน 2 ม.') });
  if (s.twin) {
    const back = plotD - s.site.front - s.d;
    if (s.site.front < 3 || back < 2) add({ level: 'tip', area: 'site', title: tr('Twin house setbacks', 'ระยะถอยบ้านแฝด'),
      detail: tr('Bangkok’s rules for twin houses ask for about 3 m in front, 2 m behind and 2 m on the open side. Check your local rules.', 'ข้อบัญญัติ กทม. กำหนดบ้านแฝดถอยหน้าประมาณ 3 ม. หลัง 2 ม. และด้านข้างที่ไม่ติดกัน 2 ม. ตรวจกับข้อบัญญัติท้องถิ่น') });
    if (s.w < 8) add({ level: 'warn', area: 'house', title: tr('Narrow for two homes', 'แคบเกินไปสำหรับสองหลัง'), detail: tr(`Each half is only ${fmt(s.w / 2)} m wide. About 5 m or more per home works better.`, `แต่ละหลังกว้างแค่ ${fmt(s.w / 2)} ม. ควรกว้างหลังละ 5 ม. ขึ้นไป`) });
  }

  /* --- heights and stairs --- */
  if (s.floorH < 2.6) add({ level: 'error', law: true, area: 'house', title: tr(`Floor height ${fmt(s.floorH, 2)} m is too low`, `ความสูงชั้น ${fmt(s.floorH, 2)} ม. ต่ำเกินไป`), detail: tr('Rooms in a home need at least 2.60 m from floor to floor.', 'ห้องในบ้านพักอาศัยต้องสูงจากพื้นถึงพื้นอย่างน้อย 2.60 ม.') });
  for (let f = 0; f < s.floors - 1; f++) {
    const st = (s.levels[f] ?? []).filter((r) => r.type === 'stairs');
    if (!st.length) { add({ level: 'error', floor: f, title: tr(`No stairs from floor ${f + 1} to floor ${f + 2}`, `ไม่มีบันไดจากชั้น ${f + 1} ขึ้นชั้น ${f + 2}`), detail: tr('Add a Stairs room. A straight flight needs about 1 × 3.6 m.', 'เพิ่มห้อง “บันได” บันไดตรงต้องใช้พื้นที่ประมาณ 1 × 3.6 ม.') }); continue; }
    const risers = Math.ceil(s.floorH / 0.2);
    for (const r of st) {
      const run = Math.max(r.w, r.d), tread = run / risers;
      if (narrow(r) < 0.8) add({ level: 'error', law: true, floor: f, roomId: r.id, title: tr(`Stairs only ${fmt(narrow(r), 2)} m wide`, `บันไดกว้างแค่ ${fmt(narrow(r), 2)} ม.`), detail: tr('Home stairs must be at least 80 cm wide (90 cm in Bangkok).', 'บันไดบ้านต้องกว้างอย่างน้อย 80 ซม. (กทม. 90 ซม.)') });
      if (tread < 0.22 && narrow(r) < 1.7) add({ level: 'warn', law: true, floor: f, roomId: r.id, title: tr('Stairs are too steep', 'บันไดชันเกินไป'),
        detail: tr(`${risers} steps of up to 20 cm need about ${fmt(risers * 0.25)} m of run for 22 cm+ treads (now ${fmt(run, 2)} m). Make the room longer or about 1.8 m wide for a U-turn.`,
          `ขั้นสูงไม่เกิน 20 ซม. ${risers} ขั้น ต้องยาวประมาณ ${fmt(risers * 0.25)} ม. เพื่อให้ลูกนอนกว้าง 22 ซม.+ (ตอนนี้ ${fmt(run, 2)} ม.) ทำให้ยาวขึ้น หรือกว้าง 1.8 ม. เป็นบันไดหักกลับ`) });
      if (s.floorH > 3) add({ level: 'tip', floor: f, roomId: r.id, title: tr('Add a landing', 'ควรมีชานพัก'), detail: tr('A flight may rise at most 3 m before a landing; this floor height needs one.', 'บันไดช่วงหนึ่งสูงได้ไม่เกิน 3 ม. ต้องมีชานพัก') });
      const above = (s.levels[f + 1] ?? []).find((u) => u.type === 'stairs' && u.x < r.x + r.w && u.x + u.w > r.x && u.z < r.z + r.d && u.z + u.d > r.z);
      if (!above) add({ level: 'error', floor: f + 1, title: tr(`Stairs arrive nowhere on floor ${f + 2}`, `บันไดขึ้นไปไม่เจอห้องบันไดบนชั้น ${f + 2}`), detail: tr('Put a Stairs room above the stairs from the floor below.', 'วางห้อง “บันได” ทับตำแหน่งบันไดของชั้นล่าง') });
    }
  }
  for (let f = 1; f < s.floors; f++) for (const v of stairVoids(s, f)) {
    const blocked = (s.levels[f] ?? []).find((u) => u.type !== 'stairs' && u.x < v.x + v.w - 0.05 && u.x + u.w > v.x + 0.05 && u.z < v.z + v.d - 0.05 && u.z + u.d > v.z + 0.05);
    if (blocked) add({ level: 'error', floor: f, roomId: blocked.id, title: tr(`${nm(blocked)} sits over the stairwell`, `${nm(blocked)}ทับช่องบันได`), detail: tr('The stairs from below come up here. Move the room or make this spot a Stairs room.', 'บันไดจากชั้นล่างขึ้นมาตรงนี้ เลื่อนห้อง หรือเปลี่ยนจุดนี้เป็นห้องบันได') });
  }

  /* --- doors to the outside above the ground floor need a balcony --- */
  // A door on an outside wall of an upper floor opens onto thin air. It is only safe when a balcony (a Terrace room)
  // lies beyond it, and a door onto a balcony sits on the wall the room shares with that Terrace, so it is not an outside door.
  for (let f = 1; f < s.floors; f++) {
    const hasBalcony = (s.levels[f] ?? []).some((r) => r.type === 'terrace');
    for (const d of floorEdges(s, f).doors) {
      if (!d.front || d.owner.type === 'terrace') continue;
      const n = nm(d.owner);
      add({ level: 'error', floor: f, roomId: d.owner.id, title: tr(`Door to the outside on floor ${f + 1} has no balcony`, `ประตูออกนอกบ้านชั้น ${f + 1} ไม่มีระเบียง`),
        detail: hasBalcony
          ? tr(`A door on an upper floor must open onto a balcony. Move the door of ${n} to the wall it shares with the Terrace, or put a Terrace next to this door.`, `ประตูชั้นบนต้องเปิดออกสู่ระเบียง ย้ายประตูของ${n}ไปที่ผนังที่ติดกับห้อง “ระเบียง” หรือวางระเบียงไว้ด้านนอกประตูนี้`)
          : tr(`A door on an upper floor must open onto a balcony. Add a Terrace room next to ${n} and put the door on the wall they share, or remove this door.`, `ประตูชั้นบนต้องเปิดออกสู่ระเบียง เพิ่มห้อง “ระเบียง” ติดกับ${n}แล้วย้ายประตูไปที่ผนังที่ใช้ร่วมกัน หรือลบประตูนี้`) });
    }
  }

  /* --- rooms --- */
  s.levels.slice(0, s.floors).forEach((rooms, f) => {
    const fr = floorRect(s, f);
    for (const r of rooms) {
      const a = area(r), n = nm(r);
      if (r.x < fr.x - 0.01 || r.z < fr.z - 0.01 || r.x + r.w > fr.x + fr.w + 0.01 || r.z + r.d > fr.z + fr.d + 0.01) add({ level: 'error', floor: f, roomId: r.id, title: tr(`${n} sticks out of floor ${f + 1}`, `${n}ยื่นเกินพื้นชั้น ${f + 1}`), detail: tr('Keep rooms inside the part of the house this floor covers.', 'จัดห้องให้อยู่ในพื้นที่ของชั้นนี้') });
      if (r.type === 'undercroft' && f > 0) add({ level: 'warn', floor: f, roomId: r.id, title: tr('Undercroft on an upper floor', 'ใต้ถุนอยู่ชั้นบน'), detail: tr('An undercroft is the open space under a raised house, on the ground floor.', 'ใต้ถุนคือที่โล่งใต้เรือนยกสูง อยู่ชั้นล่าง') });
      if (r.type === 'bedroom' || r.type === 'kids') {
        if (a < 8 || narrow(r) < 2.5) add({ level: 'error', law: true, floor: f, roomId: r.id, title: tr(`${n} is ${fmt(a)} m², ${fmt(narrow(r), 2)} m at its narrowest`, `${n} ${fmt(a)} ตร.ม. ด้านแคบ ${fmt(narrow(r), 2)} ม.`), detail: tr('A bedroom needs at least 8 m² and 2.50 m on its narrow side.', 'ห้องนอนต้องมีพื้นที่อย่างน้อย 8 ตร.ม. และด้านแคบไม่น้อยกว่า 2.50 ม.') });
        else if (r.type === 'bedroom' && a < 12) add({ level: 'tip', floor: f, roomId: r.id, title: tr(`${n} is on the small side`, `${n}ค่อนข้างเล็ก`), detail: tr('A double bed with walk-around space and a wardrobe is comfortable from about 12 m².', 'เตียงคู่พร้อมทางเดินรอบและตู้เสื้อผ้า ควรมีประมาณ 12 ตร.ม.') });
      }
      if (r.type === 'bathroom' && (a < 1.5 || narrow(r) < 0.9)) add({ level: 'error', law: true, floor: f, roomId: r.id, title: tr(`Bathroom is ${fmt(a)} m²`, `ห้องน้ำ ${fmt(a)} ตร.ม.`), detail: tr('A combined bathroom and toilet needs at least 1.5 m² and 90 cm width.', 'ห้องน้ำรวมส้วมต้องมีพื้นที่อย่างน้อย 1.5 ตร.ม. และกว้าง 90 ซม.') });
      if (r.type === 'bathroom' && a >= 1.5 && a < 3.5) add({ level: 'tip', floor: f, roomId: r.id, title: tr('Compact bathroom', 'ห้องน้ำขนาดเล็ก'), detail: tr('About 2 × 2 m fits a basin, toilet and shower comfortably; a bathtub needs about 2 × 2.5 m.', 'ราว 2 × 2 ม. วางอ่างล้างหน้า ส้วม ฝักบัวได้สบาย ถ้ามีอ่างอาบน้ำควร 2 × 2.5 ม.') });
      if (r.type === 'bathroom' && r.variant === 'tub' && a < 4.5) add({ level: 'tip', floor: f, roomId: r.id, title: tr('Tight for a bathtub', 'อ่างอาบน้ำอาจคับ'), detail: tr('A tub plus basin and toilet fits best in about 2 × 2.5 m or more. Try the shower layout.', 'อ่างอาบน้ำพร้อมอ่างล้างหน้าและส้วม ควรมี 2 × 2.5 ม. ขึ้นไป ลองแบบฝักบัว') });
      if (r.type === 'kitchen' && (r.variant === 'island' || r.variant === 'U') && narrow(r) < 3) add({ level: 'tip', floor: f, roomId: r.id, title: tr('Not much room to walk', 'ทางเดินในครัวแคบ'), detail: tr('An island or U kitchen needs about 3 m across to keep 1 m between counters.', 'ครัวแบบไอส์แลนด์หรือตัว U ควรกว้าง 3 ม. เพื่อให้มีทางเดิน 1 ม.') });
      if (r.type === 'hall' && narrow(r) < 1) add({ level: 'warn', law: true, floor: f, roomId: r.id, title: tr(`Hall is ${fmt(narrow(r), 2)} m wide`, `ทางเดินกว้าง ${fmt(narrow(r), 2)} ม.`), detail: tr('Corridors in a home should be at least 1.00 m wide.', 'ทางเดินในบ้านควรกว้างอย่างน้อย 1.00 ม.') });
      if (r.type === 'living' && a < 15) add({ level: 'tip', floor: f, roomId: r.id, title: tr(`Living room is ${fmt(a)} m²`, `ห้องนั่งเล่น ${fmt(a)} ตร.ม.`), detail: tr('A sofa, coffee table and TV wall sit well in 15–25 m².', 'โซฟา โต๊ะกลาง และผนังทีวี เหมาะกับ 15–25 ตร.ม.') });
      if (r.type === 'kitchen' && a < 6) add({ level: 'tip', floor: f, roomId: r.id, title: tr('Small kitchen', 'ครัวเล็ก'), detail: tr('Aim for at least 6 m² so the sink, hob and fridge form a working triangle.', 'ควรมีอย่างน้อย 6 ตร.ม. ให้ซิงก์ เตา ตู้เย็น เป็นสามเหลี่ยมการทำงาน') });
      if (r.doors && !r.doors.length && !['terrace', 'undercroft', 'carport', 'stairs'].includes(r.type)) add({ level: 'warn', floor: f, roomId: r.id, title: tr(`${typeLabel(r.type)} has no door`, `${t(typeLabel(r.type))}ไม่มีประตู`), detail: tr('You removed every door of this room. Add one in the room editor so people can get in.', 'คุณลบประตูของห้องนี้ออกหมดแล้ว เพิ่มประตูในหน้าแก้ไขห้อง เพื่อให้เข้าห้องได้') });
      if ((r.type === 'garage' || r.type === 'carport') && (narrow(r) < 3 || Math.max(r.w, r.d) < 5.5)) add({ level: 'warn', floor: f, roomId: r.id, title: tr(`Garage is ${fmt(r.w, 2)} × ${fmt(r.d, 2)} m`, `โรงรถ ${fmt(r.w, 2)} × ${fmt(r.d, 2)} ม.`), detail: tr('One car needs about 3 × 5.5 m to open the doors and walk around it.', 'รถหนึ่งคันต้องใช้ประมาณ 3 × 5.5 ม. เพื่อเปิดประตูและเดินรอบได้') });
      if ((r.type === 'garage' || r.type === 'carport') && f > 0) add({ level: 'error', floor: f, roomId: r.id, title: tr('Garage on an upper floor', 'โรงรถอยู่ชั้นบน'), detail: tr('A car cannot get up there. Move the garage to the ground floor.', 'รถขึ้นไปไม่ได้ ย้ายโรงรถไปชั้นล่าง') });
      if (r.shape?.kind === 'cut' && (r.type === 'bedroom' || r.type === 'kids')) add({ level: 'tip', floor: f, roomId: r.id, title: tr('Angled wall in a bedroom', 'ผนังเอียงในห้องนอน'), detail: tr('Beds and wardrobes need straight walls. Keep the angled corner for a desk, chair or plant.', 'เตียงและตู้ต้องพิงผนังตรง ใช้มุมเอียงวางโต๊ะ เก้าอี้ หรือต้นไม้') });
    }
    // Overlaps
    for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
      const p = rooms[i], q = rooms[j];
      const ov = overlapArea(p, q);
      if (ov > 0.1) add({ level: 'error', floor: f, roomId: q.id, title: tr(`${nm(p)} and ${nm(q)} overlap`, `${nm(p)}กับ${nm(q)}ซ้อนกัน`), detail: tr(`They share ${fmt(ov)} m². Drag one of them or resize it.`, `ทับกันอยู่ ${fmt(ov)} ตร.ม. ลากหรือปรับขนาดห้องใดห้องหนึ่ง`) });
    }
    const used = rooms.reduce((acc, r) => acc + area(r), 0);
    const ffa = fr.w * fr.d;
    const free = ffa - used;
    if (free > ffa * 0.12 && free > 3) add({ level: 'tip', floor: f, title: tr(`${fmt(free)} m² of floor ${f + 1} is unused`, `ชั้น ${f + 1} มีพื้นที่ว่าง ${fmt(free)} ตร.ม.`), detail: tr('Turn the gaps into a hall, storage or a bigger room.', 'เปลี่ยนช่องว่างเป็นทางเดิน ห้องเก็บของ หรือขยายห้อง') });
    if (rooms.some((r) => r.type === 'bedroom' || r.type === 'kids') && !rooms.some((r) => r.type === 'bathroom')) add({ level: 'tip', floor: f, title: tr(`No bathroom on floor ${f + 1}`, `ชั้น ${f + 1} ไม่มีห้องน้ำ`), detail: tr('Bedrooms are easier to live with when a bathroom is on the same floor.', 'ห้องนอนควรมีห้องน้ำอยู่ชั้นเดียวกัน') });
  });
  if (!s.levels[0]?.some((r) => r.type === 'kitchen') && !s.levels.flat().some((r) => r.type === 'kitchen')) add({ level: 'tip', floor: 0, title: tr('No kitchen yet', 'ยังไม่มีครัว'), detail: tr('Most homes keep the kitchen downstairs, close to the dining area and the garden.', 'บ้านส่วนใหญ่วางครัวไว้ชั้นล่าง ใกล้ที่ทานข้าวและสวน') });
  if (!s.levels.flat().some((r) => r.type === 'bedroom' || r.type === 'kids')) add({ level: 'tip', title: tr('No bedrooms yet', 'ยังไม่มีห้องนอน'), detail: tr('Add at least one bedroom of 8 m² or more.', 'เพิ่มห้องนอนอย่างน้อย 1 ห้อง ขนาด 8 ตร.ม. ขึ้นไป') });

  const order: Record<Level, number> = { error: 0, warn: 1, tip: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
