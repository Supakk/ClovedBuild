// Tiny TH/EN switch shared by every island and the static Astro markup.
// The choice lives in localStorage ('lang') and on <html lang>; islands re-render on 'langchange'.
import { useSyncExternalStore } from 'react';

export type Lang = 'en' | 'th';
let cur: Lang = 'en';
if (typeof document !== 'undefined') {
  try { cur = (localStorage.getItem('lang') as Lang) || (document.documentElement.lang === 'th' ? 'th' : 'en'); } catch { cur = document.documentElement.lang === 'th' ? 'th' : 'en'; }
  if (cur !== 'th') cur = 'en';
}

export const getLang = () => cur;
export function setLang(l: Lang) {
  cur = l;
  try { localStorage.setItem('lang', l); } catch { /* private mode */ }
  document.documentElement.lang = l;
  window.dispatchEvent(new CustomEvent('langchange', { detail: l }));
}
const sub = (cb: () => void) => { window.addEventListener('langchange', cb); return () => window.removeEventListener('langchange', cb); };
/** Re-render this component when the language changes. */
export const useLang = () => useSyncExternalStore(sub, getLang, () => 'en' as Lang);

/**
 * Hydration-safe pair of helpers for server-rendered islands: they answer in English while React
 * hydrates the server HTML, then re-render in the chosen language.
 */
export function useT() {
  const lang = useLang();
  return { lang, tr: (en: string, th: string) => (lang === 'th' ? th : en), t: (en: string) => (lang === 'th' ? DICT[en] ?? en : en) };
}

/** Inline pair: tr('Save', 'บันทึก'). */
export const tr = (en: string, th: string) => (cur === 'th' ? th : en);

/** Dictionary lookup for labels that come from data (room types, styles, catalogue items…). */
export const t = (en: string) => (cur === 'th' ? DICT[en] ?? en : en);

const DICT: Record<string, string> = {
  // room types
  Living: 'ห้องนั่งเล่น', 'Living room': 'ห้องนั่งเล่น', Dining: 'ห้องทานข้าว', Kitchen: 'ห้องครัว', Bedroom: 'ห้องนอน', 'Kids room': 'ห้องเด็ก', Kids: 'ห้องเด็ก',
  Bathroom: 'ห้องน้ำ', Office: 'ห้องทำงาน', Hall: 'ทางเดิน', Stairs: 'บันได', Garage: 'โรงรถ', Laundry: 'ห้องซักล้าง', Storage: 'ห้องเก็บของ',
  Terrace: 'ระเบียง', Undercroft: 'ใต้ถุน', Gym: 'ห้องออกกำลังกาย', Studio: 'สตูดิโอ', 'Prayer room': 'ห้องพระ', Pantry: 'แพนทรี',
  'Roof below': 'หลังคาชั้นล่าง',
  // kitchen / bath variants
  'Straight line': 'เคาน์เตอร์แถวเดียว', 'L-shape': 'ตัว L', 'U-shape': 'ตัว U', Island: 'มีไอส์แลนด์', 'Thai kitchen': 'ครัวไทย',
  Line: 'แถวเดียว', 'Thai': 'ไทย', Bathtub: 'อ่างอาบน้ำ', Shower: 'ฝักบัว', 'Wet & dry': 'แยกเปียก-แห้ง', 'Double basin': 'อ่างล้างหน้าคู่', Tub: 'อ่างอาบน้ำ', 'Wet/dry': 'แยกเปียก-แห้ง', Double: 'อ่างคู่',
  // roofs
  Flat: 'หลังคาแบน', 'Roof terrace': 'ดาดฟ้า', Gable: 'จั่ว', Hip: 'ปั้นหยา', Shed: 'เพิงหมาแหงน', 'Thai gable': 'ทรงไทย', Irimoya: 'อิริโมยะ (ญี่ปุ่น)', Gambrel: 'แกมเบรล (ดัตช์)',
  // finishes
  Plaster: 'ฉาบเรียบ', Wood: 'ไม้', Siding: 'ไม้ฝาซ้อนเกล็ด', Brick: 'อิฐ', 'Half-timber': 'โครงไม้ (ทิวดอร์)', Timber: 'โครงไม้', Stone: 'หิน',
  // regions
  Modern: 'โมเดิร์น', Japanese: 'ญี่ปุ่น', European: 'ยุโรป', All: 'ทั้งหมด',
  // styles / presets
  'Modern box': 'โมเดิร์นกล่อง', Loft: 'ลอฟท์', Villa: 'วิลล่า', 'Split level': 'บ้านชั้นครึ่ง', '1.5-storey': 'บ้านชั้นครึ่ง', Townhouse: 'ทาวน์เฮาส์', 'Twin house': 'บ้านแฝด',
  Tropical: 'ทรอปิคอล', 'Thai stilt house': 'เรือนไทยยกใต้ถุน', 'Thai house': 'บ้านทรงไทย', Courtyard: 'บ้านมีคอร์ท', Japandi: 'เจแปนดิ', Minka: 'มินกะ (บ้านญี่ปุ่นโบราณ)',
  Nordic: 'นอร์ดิก', Tudor: 'ทิวดอร์ (อังกฤษ)', Dutch: 'ดัตช์', 'Dutch barn': 'โรงนาดัตช์', Colonial: 'โคโลเนียล', Mediterranean: 'เมดิเตอร์เรเนียน',
  // templates
  Bungalow: 'บังกะโล', '3-bed villa': 'วิลล่า 3 ห้องนอน', 'Family 2-storey': 'บ้านครอบครัว 2 ชั้น', 'Modern 2-storey': 'โมเดิร์น 2 ชั้น',
  'Garage + 2 floors': 'โรงรถ + 2 ชั้น', '3-storey town': 'ทาวน์โฮม 3 ชั้น',
  // furniture / catalogue
  Sofa: 'โซฟา', 'Coffee table': 'โต๊ะกลาง', TV: 'ทีวี', 'TV stand': 'ชั้นวางทีวี', Bed: 'เตียง', 'Single bed': 'เตียงเดี่ยว', 'Double bed': 'เตียงคู่', Wardrobe: 'ตู้เสื้อผ้า',
  Desk: 'โต๊ะทำงาน', Chair: 'เก้าอี้', 'Dining table': 'โต๊ะอาหาร', Table: 'โต๊ะ', Rug: 'พรม', Plant: 'ต้นไม้', Lamp: 'โคมไฟ', Shelf: 'ชั้นวาง', Bookshelf: 'ชั้นหนังสือ',
  Toilet: 'ชักโครก', Basin: 'อ่างล้างหน้า', Fridge: 'ตู้เย็น', Counter: 'เคาน์เตอร์', Stove: 'เตา', Car: 'รถยนต์', Pool: 'สระว่ายน้ำ', Tree: 'ต้นไม้ใหญ่', Bush: 'พุ่มไม้',
  Person: 'คน', Dog: 'สุนัข', Cat: 'แมว', 'Patio set': 'ชุดโต๊ะสนาม', Lounger: 'เก้าอี้อาบแดด', Daybed: 'แคร่', Bench: 'ม้านั่ง', Washer: 'เครื่องซักผ้า', 'Washing machine': 'เครื่องซักผ้า',
  Armchair: 'อาร์มแชร์', Nightstand: 'โต๊ะข้างเตียง', Dresser: 'โต๊ะเครื่องแป้ง', Crib: 'เปลเด็ก', Toys: 'ของเล่น', Treadmill: 'ลู่วิ่ง', Altar: 'โต๊ะหมู่บูชา',
  House: 'บ้าน', Houses: 'บ้าน', Furniture: 'เฟอร์นิเจอร์', Garden: 'สวน', People: 'คนและสัตว์', 'People & pets': 'คนและสัตว์เลี้ยง', Outdoor: 'กลางแจ้ง', Living_: 'นั่งเล่น',
  Bedroom_: 'ห้องนอน', Kitchen_: 'ครัว', Bath: 'ห้องน้ำ', Pets: 'สัตว์เลี้ยง', Vehicles: 'ยานพาหนะ',
  // window kinds / sides
  Window: 'หน้าต่าง', 'Glass wall': 'ผนังกระจก', 'High window': 'หน้าต่างสูง', Door: 'ประตู', Glass: 'กระจกบานใหญ่', High: 'ช่องแสงสูง',
  North: 'ทิศเหนือ', South: 'ทิศใต้', East: 'ทิศตะวันออก', West: 'ทิศตะวันตก', Back: 'ด้านหลัง', Front: 'ด้านหน้า', Left: 'ซ้าย', Right: 'ขวา', Diagonal: 'ผนังเอียง',

  // names from the data files
  'Dining room': 'ห้องทานข้าว', 'TV console': 'ชั้นวางทีวี', 'Floor lamp': 'โคมไฟตั้งพื้น', Nightstands: 'โต๊ะข้างเตียง', 'Toy box': 'กล่องของเล่น', 'Play rug': 'พรมเล่น',
  'Wall cabinets': 'ตู้แขวน', 'Table and chairs': 'โต๊ะและเก้าอี้', Sideboard: 'ตู้ข้าง', 'Pendant light': 'โคมไฟห้อย', Vanity: 'เคาน์เตอร์อ่างล้างหน้า', 'Bath mat': 'พรมเช็ดเท้า',
  'Console table': 'โต๊ะคอนโซล', 'Runner rug': 'พรมทางเดิน', 'Storage shelf': 'ชั้นเก็บของ', Dryer: 'เครื่องอบผ้า', Shelves: 'ชั้นวาง', Loungers: 'เก้าอี้อาบแดด', Plants: 'ต้นไม้',
  'Straight + island': 'แถวเดียว + ไอส์แลนด์', 'Big island': 'ไอส์แลนด์ใหญ่', 'Wet and dry': 'แยกส่วนเปียก-แห้ง', mono: 'เพิงหมาแหงน', 'Mono-pitch': 'เพิงหมาแหงน', 'Hip-and-gable': 'มนิลา (จั่วผสมปั้นหยา)', 'Wood boards': 'ไม้ตีเรียบ',
  Oak: 'ไม้โอ๊ค', Walnut: 'ไม้วอลนัท', Marble: 'หินอ่อน', Terrazzo: 'หินขัด', 'Blue tile': 'กระเบื้องฟ้า', Concrete: 'ปูนขัดมัน', Carpet: 'พรม',
  'Modern Minimal': 'โมเดิร์นมินิมอล', 'Industrial Loft': 'ลอฟท์อินดัสเทรียล', 'Pool Villa': 'พูลวิลล่า', 'Split Level': 'บ้านชั้นครึ่ง', 'City Townhouse': 'ทาวน์เฮาส์ในเมือง', 'Twin House': 'บ้านแฝด',
  'Tropical Thai': 'ไทยทรอปิคอล', 'Thai Stilt House': 'เรือนไทยใต้ถุนสูง', 'Courtyard Bungalow': 'บังกะโลมีคอร์ท', 'Japanese Minka': 'บ้านญี่ปุ่นมินกะ', 'Nordic Gable': 'นอร์ดิกหลังคาจั่ว',
  'English Tudor': 'ทิวดอร์อังกฤษ', 'Dutch Barn': 'โรงนาดัตช์', 'Bungalow, 2 bedrooms': 'บังกะโล 2 ห้องนอน', 'Colonial with porch': 'โคโลเนียลมีมุขหน้า', 'Courtyard, L-shaped rooms': 'คอร์ทกลาง ห้องตัว L',
  'Family home, 3 bedrooms': 'บ้านครอบครัว 3 ห้องนอน', 'Japanese, veranda in front': 'ญี่ปุ่น มีระเบียงหน้า', 'Modern, terrace upstairs': 'โมเดิร์น มีระเบียงชั้นบน', 'One and a half storeys': 'บ้านชั้นครึ่ง',
  'Studio, 1 bedroom': 'สตูดิโอ 1 ห้องนอน', 'Townhouse, 3 storeys': 'ทาวน์เฮาส์ 3 ชั้น', 'Twin house, 2 homes': 'บ้านแฝด 2 หลัง', 'Two storeys with garage': '2 ชั้น มีโรงรถ', 'Villa, 3 bedrooms': 'วิลล่า 3 ห้องนอน',
  'White box, black frames, rust accents': 'กล่องสีขาว กรอบดำ แต้มสีสนิม', 'Brick, black steel, walnut': 'อิฐ เหล็กดำ ไม้วอลนัท', 'Long and low, wall-to-wall glass': 'ยาว เตี้ย กระจกเต็มผนัง',
  'One and a half storeys, mono-pitch roofs': 'ชั้นครึ่ง หลังคาเพิงหมาแหงน', 'Narrow three storeys, roof terrace': 'หน้าแคบ 3 ชั้น มีดาดฟ้า', 'Two mirrored homes, one shared wall': 'สองหลังสมมาตร ใช้ผนังร่วมกัน',
  'Deep hip roof, teak and terracotta': 'หลังคาปั้นหยายื่นลึก ไม้สัก ดินเผา', 'Teak walls raised on posts, steep Thai roof': 'ฝาไม้สักยกเสาสูง หลังคาทรงไทยชัน', 'L-shaped rooms around a garden': 'ห้องตัว L ล้อมสวน',
  'Low mono-pitch roof, pale wood, stone': 'หลังคาเพิงเตี้ย ไม้สีอ่อน หิน', 'Dark timber, hip-and-gable roof, veranda': 'ไม้สีเข้ม หลังคามนิลา มีเอ็นงาวะ', 'Steep charcoal roof, oak details': 'หลังคาชันสีถ่าน ไม้โอ๊ค',
  'Half-timbered walls, steep gable': 'ผนังโครงไม้ หลังคาจั่วชัน', 'Red boards under a gambrel roof': 'ไม้ตีแดง หลังคาแกมเบรล', 'White siding, porch, symmetrical hip roof': 'ไม้ฝาสีขาว มีมุข หลังคาปั้นหยาสมมาตร', 'Warm plaster, clay tile hip roof': 'ผนังปูนโทนอุ่น หลังคาดินเผา',
  'Barn red': 'แดงโรงนา', Black: 'ดำ', Bronze: 'บรอนซ์', Chalk: 'ขาวชอล์ก', Charcoal: 'ถ่าน', Clay: 'ดินเผา', 'Dark timber': 'ไม้เข้ม', Graphite: 'เทาเข้ม', Mist: 'หมอก', Peach: 'พีช', Rust: 'สนิม',
  Sage: 'เขียวเสจ', Sand: 'ทราย', Slate: 'หินชนวน', Teak: 'ไม้สัก', Terracotta: 'ดินเผาส้ม', 'Thai red': 'แดงไทย', White: 'ขาว',
  Adult: 'ผู้ใหญ่', Child: 'เด็ก', 'Small tree': 'ต้นไม้เล็ก', Shrub: 'พุ่มไม้', 'Pot plant': 'ไม้กระถาง', 'Storage shelves': 'ชั้นเก็บของ', 'L-shape kitchen': 'ครัวตัว L', 'U-shape kitchen': 'ครัวตัว U',
  'People and pets': 'คนและสัตว์เลี้ยง', 'Living and dining': 'นั่งเล่นและทานข้าว', 'Bedroom and office': 'ห้องนอนและห้องทำงาน', 'Kitchen, bath and utility': 'ครัว ห้องน้ำ และซักล้าง', 'Garden and outdoor': 'สวนและภายนอก', 'My designs': 'แบบของฉัน',
  Mine: 'ของฉัน', 'Furniture_': 'เฟอร์นิเจอร์', 'My plot': 'แปลงของฉัน', 'My house': 'บ้านของฉัน',
  Carport: 'โรงจอดรถ', 'Second car': 'รถคันที่สอง', 'Marble panels': 'แผ่นหินอ่อน', 'Metal panels': 'แผ่นโลหะสีเข้ม', Limestone: 'หินปูนสีครีม',
  'Luxury Modern': 'โมเดิร์นหรู 3 ชั้น', 'Stone Townhouse': 'ทาวน์โฮมหินอ่อน', 'Modern Box': 'โมเดิร์นกล่อง 2 ชั้น', 'Modern Thai Gable': 'บ้านชั้นเดียวหน้าจั่วโมเดิร์น',
  'Thai Country Bungalow': 'บ้านชั้นเดียวมีระเบียงหน้า', 'Arch Cottage': 'บ้านชั้นเดียวหน้าต่างวงกลม',
  'Stone frames, dark metal top floor, bronze fins, roof garden': 'กรอบหิน ชั้นบนแผ่นโลหะสีเข้ม ระแนงสีบรอนซ์ สวนบนหลังคา',
  'Grey marble, cream panels, slatted screens': 'หินอ่อนสีเทา แผงสีครีม ระแนงบังแดด',
  'White box, framed upper floor, carport below': 'กล่องสีขาว ชั้นบนมีกรอบ ที่จอดรถด้านล่าง',
  "Street-facing gable clad in wood, flat-roof carport": 'หน้าจั่วหันหน้าบ้านกรุไม้ ที่จอดรถหลังคาแบน',
  'One storey, grey tile roof, front porch on posts': 'ชั้นเดียว หลังคากระเบื้องเทา ระเบียงหน้ามีเสา',
  'White walls, round windows, wood slats, carport': 'ผนังขาว หน้าต่างวงกลม ระแนงไม้ มีที่จอดรถ',
  'Three storeys, 4-car carport, roof garden': '3 ชั้น จอดรถ 4 คัน สวนบนหลังคา', 'Narrow three storeys, carport': 'หน้าแคบ 3 ชั้น มีที่จอดรถ',
  'Two storeys, carport under': '2 ชั้น ที่จอดรถใต้ชั้นบน', 'One storey, carport beside': 'ชั้นเดียว ที่จอดรถด้านข้าง',
  'One storey, front porch': 'ชั้นเดียว มีระเบียงหน้า', 'One storey, carport and deck': 'ชั้นเดียว ที่จอดรถและชานไม้',
  'Glass + fins': 'กระจก+ระแนง', Round: 'วงกลม',
  'Modern Farmhouse': 'ฟาร์มเฮาส์โมเดิร์น', 'Victorian Cottage': 'กระท่อมวิกตอเรียน', 'Brick Garage Colonial': 'โคโลเนียลโรงรถอิฐ', 'Modern Thai Stilt House': 'บ้านไทยยกใต้ถุนโมเดิร์น',
  'White brick, steep street gables, black frames, timber porch': 'อิฐทาขาว หน้าจั่วชันหลายจั่ว กรอบดำ มุขหน้าเสาไม้',
  'Board-and-batten walls, steep gables, porch, shutters': 'ผนังไม้ตีแนวตั้ง หน้าจั่วชัน ระเบียงหน้า บานเกล็ด',
  'White house, brick garage wing, wrap-around porch, shutters': 'บ้านขาว โรงรถก่ออิฐ ระเบียงรอบบ้าน บานเกล็ด',
  'Raised wooden upper floor, white posts below, layered gables': 'ชั้นบนกรุไม้ ยกบนเสาขาว หลังคาจั่วซ้อน',
  'Two storeys, porch in the middle': '2 ชั้น มุขทางเข้ากลางบ้าน', 'One and a half storeys, front porch': 'ชั้นครึ่ง มีระเบียงหน้า',
  'Two storeys, garage wing and porch': '2 ชั้น โรงรถข้างบ้านและระเบียง', 'Raised upper floor, open ground floor': 'ยกชั้นบน ชั้นล่างโล่ง',
};
