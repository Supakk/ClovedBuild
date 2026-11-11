import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent as RPE } from 'react';
import {
  FINISHES, HOUSE_PRESETS, PTYPES, REGIONS, ROOFS, ROOF_COLORS, STYLES, TEMPLATES, TYPE_ORDER, VARIANTS, WALL_COLORS,
  applyTemplate, area, autoDoors, autoWindows, makePost, presetFromUrl, styleLook, floorEdges, floorRect, makeRoom, presetSpec, rid, totals, typeLabel,
  type Corner, type DoorKind, type DoorSpec, type EdgeSide, type Post, type Side, type HouseSpec, type PRoom, type PType, type Rect, type Region, type WinSpec,
} from '../../lib/plan/spec';
import { t, tr, useLang } from '../../lib/i18n';
import LangToggle from '../LangToggle';
import SlideButton from '../SlideButton';
import { LogoPill } from '../LogoMark';
import { checkDesign, type Advice } from '../../lib/plan/rules';
import { loadDraft, saveDraft, saveDesign, setHandoff } from '../../lib/plan/storage';
import { houseThumb } from '../../lib/plan/thumbs';
import { EXT, FINS, PAINTS } from '../../lib/house/data';
import PlanView, { type PlanApi } from './PlanView';
import Preview3D from './Preview3D';
import {
  ArrowLeft, ArrowRight, CopyIcon, CubeIcon, InfoIcon, MapIcon, MinusIcon, OkIcon, PlusIcon, RedoIcon,
  FitIcon, RoofIcon, RoomIcon, SaveIcon, SendIcon, StepIcon, TrashIcon, UndoIcon, WarnIcon,
} from '../icons';

type Step = 'land' | 'house' | 'rooms' | 'style' | 'check';
const STEPS: { id: Step; label: [string, string]; title: [string, string]; view: 'plan' | '3d' }[] = [
  { id: 'land', label: ['Land', 'ที่ดิน'], title: ['Your land', 'ที่ดินของคุณ'], view: 'plan' },
  { id: 'house', label: ['House', 'ตัวบ้าน'], title: ['House size', 'ขนาดบ้าน'], view: '3d' },
  { id: 'rooms', label: ['Rooms', 'ห้อง'], title: ['Rooms', 'จัดห้อง'], view: 'plan' },
  { id: 'style', label: ['Style', 'สไตล์'], title: ['Look and roof', 'สไตล์และหลังคา'], view: '3d' },
  { id: 'check', label: ['Check', 'ตรวจ'], title: ['Check and finish', 'ตรวจแบบและเสร็จสิ้น'], view: '3d' },
];
const L2 = (p: [string, string]) => tr(p[0], p[1]);
const DOOR_KINDS: [DoorKind, string, string, number][] = [['swing', 'Door', 'บานเปิด', 0.9], ['double', 'Double', 'บานคู่', 1.6], ['sliding', 'Sliding', 'บานเลื่อน', 1.8], ['opening', 'Opening', 'ช่องโล่ง', 1.2]];
const SIDE_NAME: Record<EdgeSide, [string, string]> = { n: ['Back', 'ด้านหลัง'], s: ['Front', 'ด้านหน้า'], w: ['Left', 'ด้านซ้าย'], e: ['Right', 'ด้านขวา'], d: ['Diagonal', 'ผนังเอียง'] };
const WIN_KINDS: [WinSpec['kind'], string, string][] = [['window', 'Window', 'หน้าต่าง'], ['glass', 'Glass wall', 'กระจกบานใหญ่'], ['fins', 'Glass + fins', 'กระจก+ระแนง'], ['round', 'Round', 'วงกลม'], ['high', 'High', 'ช่องแสงสูง'], ['door', 'Door', 'ประตู']];
const EXTENTS: { id: string; en: string; th: string; f: [number, number, number, number] | null }[] = [
  { id: 'full', en: 'Whole', th: 'เต็มหลัง', f: null },
  { id: 'back', en: 'Back half', th: 'ครึ่งหลัง', f: [0, 0, 1, 0.55] },
  { id: 'front', en: 'Front half', th: 'ครึ่งหน้า', f: [0, 0.45, 1, 0.55] },
  { id: 'left', en: 'Left half', th: 'ครึ่งซ้าย', f: [0, 0, 0.55, 1] },
  { id: 'right', en: 'Right half', th: 'ครึ่งขวา', f: [0.45, 0, 0.55, 1] },
];
const SIZE: Record<PType, [number, number]> = {
  living: [4.5, 4], dining: [3.5, 3], kitchen: [3, 3], bedroom: [3.5, 3.5], kids: [3, 3], bathroom: [2, 2.5], office: [3, 2.8],
  hall: [1.2, 3], stairs: [1.2, 3.6], garage: [3.2, 6], laundry: [2, 2], storage: [1.5, 1.5], terrace: [3, 2.5], undercroft: [4, 4], carport: [3, 5.5],
};
const LANDS: [number, number][] = [[10, 5], [10, 8], [10, 10], [15, 10], [20, 10], [20, 20]];
const snapTo = (v: number, s = 0.25) => Math.round(v / s) * s;
const fmt = (n: number, d = 1) => n.toFixed(d).replace(/\.0+$/, '');
const thb = (n: number) => (n >= 1e6 ? `฿${fmt(n / 1e6, 1)}M` : `฿${Math.round(n / 1000)}K`);

/* ---------------- small building blocks ---------------- */
function Block({ title, children, aside }: { title: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="grid gap-2.5">
      <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold">{title}</h3>{aside}</div>
      {children}
    </section>
  );
}
function Stepper({ value, onChange, step, min, max, unit, label }: { value: number; onChange: (v: number) => void; step: number; min: number; max: number; unit: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-soft p-1.5">
      <span className="pl-2 text-xs font-semibold text-muted">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" className="icon-btn size-9 shadow-none" aria-label={`− ${label}`} onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}><MinusIcon className="size-4" /></button>
        <span className="min-w-16 text-center text-base font-bold tabular-nums">{fmt(value, 2)}<span className="ml-0.5 text-[11px] font-semibold text-muted">{unit}</span></span>
        <button type="button" className="icon-btn size-9 shadow-none" aria-label={`+ ${label}`} onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}><PlusIcon className="size-4" /></button>
      </div>
    </div>
  );
}
function Swatches({ list, value, onPick, label }: { list: readonly (readonly [string, string])[]; value: string; onPick: (v: string) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {list.map(([n, hex]) => <button key={hex} type="button" title={t(n)} aria-label={t(n)} className="swatch press size-8" style={{ background: hex }} aria-pressed={value.toLowerCase() === hex.toLowerCase()} onClick={() => onPick(hex)} />)}
    </div>
  );
}
function Thumb({ id, spec }: { id: string; spec?: HouseSpec }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { let a = true; setSrc(null); houseThumb(id, spec, 280, 210).then((s) => a && setSrc(s)); return () => { a = false; }; }, [id, spec]);
  return <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-soft">{src ? <img src={src} alt="" className="animate-fade-in size-full object-contain" /> : <div className="skeleton absolute inset-3 rounded-lg" />}</div>;
}
function Ring({ value }: { value: number }) {
  const r = 34, c = 2 * Math.PI * r, col = value >= 85 ? '#3D7A4A' : value >= 60 ? '#C98A1E' : '#D0453A';
  return (
    <svg viewBox="0 0 80 80" className="size-24" aria-label={tr(`Design score ${value} out of 100`, `คะแนนแบบ ${value} จาก 100`)}>
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={col} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 40 40)" style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.2,.8,.2,1)' }} />
      <text x="40" y="45" textAnchor="middle" fontSize="20" fontWeight="800" fill="currentColor">{value}</text>
    </svg>
  );
}
const LEVEL = {
  error: { cls: 'border-[#D0453A] bg-[#D0453A]/10', icon: <WarnIcon className="size-4 text-[#D0453A]" /> },
  warn: { cls: 'border-[#C98A1E] bg-[#C98A1E]/10', icon: <WarnIcon className="size-4 text-[#C98A1E]" /> },
  tip: { cls: 'border-line bg-soft', icon: <InfoIcon className="size-4 text-muted" /> },
} as const;

/* ---------------- the builder ---------------- */
export default function Builder() {
  useLang();
  const [region, setRegion] = useState<Region | 'all'>('all');
  const [spec, setSpecState] = useState<HouseSpec>(() => presetFromUrl() ?? loadDraft() ?? presetSpec('modern'));
  const [step, setStep] = useState<Step>('land');
  const [view, setView] = useState<'plan' | '3d'>('plan');
  const [floor, setFloor] = useState(0);
  const [selId, setSelId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [ghost, setGhost] = useState<{ x: number; y: number; type: PType | 'post' } | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const hist = useRef<{ list: string[]; i: number }>({ list: [JSON.stringify(spec)], i: 0 });
  const [, force] = useState(0);
  const designId = useRef<string | undefined>(undefined);
  const planApi = useRef<PlanApi | null>(null);
  const toastTimer = useRef(0);

  const say = useCallback((m: string) => { setToast(m); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), 2800); }, []);
  const commit = useCallback((next: HouseSpec) => {
    const h = hist.current, json = JSON.stringify(next);
    if (h.list[h.i] !== json) { h.list = h.list.slice(0, h.i + 1); h.list.push(json); if (h.list.length > 80) h.list.shift(); h.i = h.list.length - 1; }
    setSpecState(next); saveDraft(next); force((x) => x + 1);
  }, []);
  const specRef = useRef(spec); specRef.current = spec;
  const restore = (i: number) => { const h = hist.current; h.i = i; const s = JSON.parse(h.list[i]); setSpecState(s); saveDraft(s); force((x) => x + 1); };
  const undo = () => { if (hist.current.i > 0) restore(hist.current.i - 1); };
  const redo = () => { if (hist.current.i < hist.current.list.length - 1) restore(hist.current.i + 1); };

  useEffect(() => { if (floor > spec.floors - 1) setFloor(spec.floors - 1); }, [spec.floors, floor]);
  const goStep = (s: Step) => { setStep(s); setView(STEPS.find((x) => x.id === s)!.view); if (s !== 'rooms') setSelId(null); };
  const idx = STEPS.findIndex((s) => s.id === step);

  const lang = useLang();
  // The design check trails the drawing by a frame or two, so dragging never waits for it.
  const lateSpec = useDeferredValue(spec);
  const advice = useMemo(() => checkDesign(lateSpec), [lateSpec, lang]);
  const errorIds = useMemo(() => new Set(advice.filter((a) => a.level === 'error' && a.roomId).map((a) => a.roomId!)), [advice]);
  const counts = { error: advice.filter((a) => a.level === 'error').length, warn: advice.filter((a) => a.level === 'warn').length, tip: advice.filter((a) => a.level === 'tip').length };
  const score = Math.max(0, 100 - counts.error * 14 - counts.warn * 5 - counts.tip * 1);
  const tt = totals(spec);
  const rooms = spec.levels[floor] ?? [];
  const sel = rooms.find((r) => r.id === selId) ?? null;
  const posts = (spec.posts ?? []).filter((p) => p.floor === floor);
  const selPost = selId?.startsWith('post:') ? posts.find((p) => 'post:' + p.id === selId) ?? null : null;

  /* ---------- edits ---------- */
  const set = (patch: Partial<HouseSpec>) => commit({ ...spec, ...patch });
  const setSite = (patch: Partial<HouseSpec['site']>) => {
    const s2 = { ...spec.site, ...patch };
    s2.left = Math.max(0, Math.min(s2.left, s2.plotW * 2 - spec.w)); s2.front = Math.max(0, Math.min(s2.front, s2.plotD * 2 - spec.d));
    commit({ ...spec, site: s2 });
  };
  function resize(w: number, d: number) {
    w = snapTo(w, 0.5); d = snapTo(d, 0.5);
    const kx = w / spec.w, kz = d / spec.d;
    const levels = spec.levels.map((lv) => lv.map((r) => {
      const x = snapTo(r.x * kx), z = snapTo(r.z * kz);
      return { ...r, x, z, w: Math.max(0.8, snapTo((r.x + r.w) * kx) - x), d: Math.max(0.8, snapTo((r.z + r.d) * kz) - z) };
    }));
    const PW = spec.site.plotW * 2, PD = spec.site.plotD * 2;
    const posts = spec.posts?.map((p) => ({ ...p, x: snapTo(p.x * kx), z: snapTo(p.z * kz) }));
    commit({ ...spec, w, d, levels, posts, site: { ...spec.site, left: Math.max(0, Math.min(spec.site.left, PW - w)), front: Math.max(0, Math.min(spec.site.front, PD - d)) } });
  }
  function setFloors(n: number) {
    const levels = spec.levels.slice(0, n);
    while (levels.length < n) {
      const below = levels[levels.length - 1] ?? [];
      levels.push(below.filter((r) => r.type === 'stairs').map((r) => makeRoom('stairs', r.x, r.z, r.w, r.d)));
    }
    commit({ ...spec, floors: n, levels });
    if (n > spec.floors) say(tr(`Floor ${n} added. Give it rooms in the Rooms step.`, `เพิ่มชั้น ${n} แล้ว ไปใส่ห้องในขั้นตอน “ห้อง”`));
  }
  const editRoom = (id: string, patch: Partial<PRoom>) => commit({ ...spec, levels: spec.levels.map((lv, i) => (i === floor ? lv.map((r) => (r.id === id ? { ...r, ...patch } : r)) : lv)) });
  function placeRoom(type: PType, at?: { x: number; z: number }) {
    let [w, d] = SIZE[type];
    w = Math.min(w, spec.w); d = Math.min(d, spec.d);
    let x: number, z: number;
    const free = (x0: number, z0: number) => rooms.every((r) => x0 >= r.x + r.w - 0.01 || x0 + w <= r.x + 0.01 || z0 >= r.z + r.d - 0.01 || z0 + d <= r.z + 0.01);
    if (at) {
      x = Math.min(spec.w - w, Math.max(0, snapTo(at.x - w / 2))); z = Math.min(spec.d - d, Math.max(0, snapTo(at.z - d / 2)));
      // Dropped on top of another room: slide to the nearest free spot, if there is one.
      if (!free(x, z)) {
        let best: [number, number, number] | null = null;
        for (let zz = 0; zz + d <= spec.d + 1e-6; zz += 0.25) for (let xx = 0; xx + w <= spec.w + 1e-6; xx += 0.25) {
          if (!free(xx, zz)) continue;
          const dist = Math.hypot(xx - x, zz - z);
          if (!best || dist < best[2]) best = [xx, zz, dist];
        }
        if (best) { x = best[0]; z = best[1]; }
      }
    } else {
      let spot: [number, number] | null = null;
      for (let k = 0; k < 4 && !spot; k++) {
        for (let zz = 0; zz + d <= spec.d + 1e-6 && !spot; zz += 0.5) for (let xx = 0; xx + w <= spec.w + 1e-6 && !spot; xx += 0.5) if (free(xx, zz)) spot = [xx, zz];
        if (!spot) { w = Math.max(1, snapTo(w * 0.8)); d = Math.max(1, snapTo(d * 0.8)); }
      }
      [x, z] = spot ?? [0, 0];
    }
    const r = makeRoom(type, x, z, w, d);
    commit({ ...spec, levels: spec.levels.map((lv, i) => (i === floor ? [...lv, r] : lv)) });
    setSelId(r.id);
    say(tr(`${typeLabel(type)} added`, `เพิ่ม${t(typeLabel(type))}แล้ว`));
  }
  const editPost = (id: string, patch: Partial<Post>) => commit({ ...spec, posts: (spec.posts ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  function placePost(round: boolean, at?: { x: number; z: number }) {
    const fr = floorRect(spec, floor);
    const p = makePost(floor, snapTo(at ? at.x : fr.x + fr.w / 2), snapTo(at ? at.z : fr.z + fr.d / 2), round);
    p.x = Math.min(fr.x + fr.w, Math.max(fr.x, p.x)); p.z = Math.min(fr.z + fr.d, Math.max(fr.z, p.z));
    commit({ ...spec, posts: [...(spec.posts ?? []), p] });
    setSelId('post:' + p.id);
    say(tr('Post added. Drag it anywhere on the plan.', 'เพิ่มเสาแล้ว ลากไปวางตรงไหนก็ได้บนผัง'));
  }
  const removePost = (id: string) => { commit({ ...spec, posts: (spec.posts ?? []).filter((p) => p.id !== id) }); setSelId(null); };
  const editDoor = (r: PRoom, id: string, patch: Partial<DoorSpec>) => editRoom(r.id, { doors: (r.doors ?? []).map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const roomSides = (r: PRoom) => [...new Set(floorEdges(spec, floor).edges.filter((e) => e.room.id === r.id && e.side !== 'd' && e.a1 - e.a0 >= 0.7).map((e) => e.side as Side))];
  const removeRoom = (id: string) => { if (id.startsWith('post:')) return removePost(id.slice(5)); commit({ ...spec, levels: spec.levels.map((lv, i) => (i === floor ? lv.filter((r) => r.id !== id) : lv)) }); setSelId(null); };
  function duplicateRoom(r: PRoom) {
    const c = { ...r, id: makeRoom(r.type, 0, 0, 1, 1).id, x: Math.min(spec.w - r.w, r.x + 0.5), z: Math.min(spec.d - r.d, r.z + 0.5) };
    commit({ ...spec, levels: spec.levels.map((lv, i) => (i === floor ? [...lv, c] : lv)) }); setSelId(c.id);
  }
  const changeType = (r: PRoom, type: PType) => { const f = makeRoom(type, r.x, r.z, r.w, r.d); editRoom(r.id, { type, items: f.items, floor: f.floor, place: undefined }); };
  function align(col: number, row: number) {
    const PW = spec.site.plotW * 2, PD = spec.site.plotD * 2, gx = PW - spec.w, gz = PD - spec.d;
    setSite({ left: snapTo(gx * col / 2), front: snapTo(gz * (2 - row) / 2) });
  }

  function setExtent(fi: number, f: [number, number, number, number] | null) {
    const ext = Array.from({ length: spec.floors }, (_, i) => spec.extents?.[i] ?? null);
    const r: Rect | null = f ? { x: snapTo(f[0] * spec.w, 0.5), z: snapTo(f[1] * spec.d, 0.5), w: snapTo(f[2] * spec.w, 0.5), d: snapTo(f[3] * spec.d, 0.5) } : null;
    ext[fi] = r;
    // Squeeze the rooms of that floor into the part it now covers.
    const fr = r ?? { x: 0, z: 0, w: spec.w, d: spec.d };
    const old = floorRect(spec, fi);
    const levels = spec.levels.map((lv, i) => (i !== fi ? lv : lv.map((rm) => {
      const kx = fr.w / old.w, kz = fr.d / old.d;
      const x = fr.x + snapTo((rm.x - old.x) * kx), z = fr.z + snapTo((rm.z - old.z) * kz);
      return { ...rm, x, z, w: Math.max(0.8, snapTo(rm.w * kx)), d: Math.max(0.8, snapTo(rm.d * kz)) };
    })));
    commit({ ...spec, extents: ext.some(Boolean) ? ext : undefined, levels });
  }
  const extentId = (fi: number) => {
    const e = spec.extents?.[fi];
    if (!e) return 'full';
    return EXTENTS.find((x) => x.f && Math.abs(snapTo(x.f[0] * spec.w, 0.5) - e.x) < 0.01 && Math.abs(snapTo(x.f[1] * spec.d, 0.5) - e.z) < 0.01 && Math.abs(snapTo(x.f[2] * spec.w, 0.5) - e.w) < 0.01 && Math.abs(snapTo(x.f[3] * spec.d, 0.5) - e.d) < 0.01)?.id ?? 'custom';
  };
  const editWin = (r: PRoom, id: string, patch: Partial<WinSpec>) => editRoom(r.id, { windows: (r.windows ?? []).map((w) => (w.id === id ? { ...w, ...patch } : w)) });
  const outerSides = (r: PRoom) => [...new Set(floorEdges(spec, floor).edges.filter((e) => e.room.id === r.id && e.perimeter).map((e) => e.side))];

  /* drag a room tile onto the plan */
  function startTileDrag(e: RPE, type: PType | 'post', place: (at?: { x: number; z: number }) => void = (at) => placeRoom(type as PType, at)) {
    if (e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    document.body.style.userSelect = 'none';
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) moved = true;
      if (moved) setGhost({ x: ev.clientX, y: ev.clientY, type });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      setGhost(null); document.body.style.userSelect = '';
      if (!moved) { place(); if (view !== 'plan') setView('plan'); return; }
      const p = view === 'plan' ? planApi.current?.toMeters(ev.clientX, ev.clientY) : null;
      if (p) place(p);
      else say(tr('Drop it on the floor plan', 'วางลงบนผังบ้าน'));
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }

  function pickAdvice(a: Advice) {
    if (a.floor != null) setFloor(a.floor);
    if (a.roomId) { goStep('rooms'); setSelId(a.roomId); }
    else if (a.area === 'site') goStep('land');
    else if (a.area === 'house') goStep('house');
  }
  function save() { const d = saveDesign(spec, designId.current); designId.current = d.id; say(tr(`Saved “${d.name}” to My designs`, `บันทึก “${d.name}” แล้ว`)); }
  function sendToSim() { const d = saveDesign(spec, designId.current); designId.current = d.id; setHandoff(spec); window.location.href = '/simulator'; }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selId) { e.preventDefault(); removeRoom(selId); }
      if (e.key === 'Escape') setSelId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const pad = { paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))' };
  const PW = spec.site.plotW * 2, PD = spec.site.plotD * 2;
  const siteMode = step === 'land';

  /* ---------------- step panels ---------------- */
  const panels: Record<Step, ReactNode> = {
    land: (
      <>
        <Block title={tr('Pick a land size', 'เลือกขนาดที่ดิน')}>
          <div className="grid grid-cols-3 gap-2">
            {LANDS.map(([w, d]) => {
              const on = spec.site.plotW === w && spec.site.plotD === d, k = 36 / Math.max(w, d);
              return (
                <button key={`${w}x${d}`} type="button" aria-pressed={on} className="tile py-3" onClick={() => setSite({ plotW: w, plotD: d })}>
                  <span className="grid h-10 place-items-center"><span className="block rounded-sm border-2 border-current bg-[#97B865]/40" style={{ width: w * k, height: d * k }} /></span>
                  <b className="text-sm">{w * d}</b><span className="text-[10px] text-muted">{tr('sq. wah', 'ตร.ว.')}</span>
                </button>
              );
            })}
          </div>
        </Block>
        <Block title={tr('Or set it exactly', 'หรือกำหนดเอง')} aside={<span className="text-xs font-semibold text-muted">{tr('1 wah = 2 m', '1 วา = 2 ม.')}</span>}>
          <Stepper label={tr('Width', 'กว้าง')} value={spec.site.plotW} step={0.5} min={4} max={60} unit={tr('wah', 'วา')} onChange={(v) => setSite({ plotW: v })} />
          <Stepper label={tr('Depth', 'ลึก')} value={spec.site.plotD} step={0.5} min={4} max={60} unit={tr('wah', 'วา')} onChange={(v) => setSite({ plotD: v })} />
        </Block>
        <Block title={tr('Where does the house sit?', 'วางบ้านตรงไหน?')} aside={<span className="text-xs text-muted">{tr('or drag it', 'หรือลากบนผัง')}</span>}>
          <div className="grid grid-cols-[auto_1fr] items-center gap-4">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#97B865]/30 p-1.5" role="group" aria-label={tr('House position', 'ตำแหน่งบ้าน')}>
              {[0, 1, 2].map((row) => [0, 1, 2].map((col) => (
                <button key={`${row}${col}`} type="button" aria-label={`${['Back', 'Middle', 'Front'][row]} ${['left', 'centre', 'right'][col]}`} onClick={() => align(col, row)} className="press grid size-9 cursor-pointer place-items-center rounded-md bg-card/80 hover:bg-card">
                  <StepIcon step="house" className="size-4 text-muted" />
                </button>
              )))}
              <span className="col-span-3 mt-1 text-center text-[10px] font-bold tracking-widest text-muted">{tr('ROAD', 'ถนน')}</span>
            </div>
            <div className="grid gap-1.5 text-xs">
              <div className="flex justify-between"><span className="text-muted">{tr('House', 'ตัวบ้าน')}</span><b>{fmt(tt.fp)} m²</b></div>
              <div className="flex justify-between"><span className="text-muted">{tr('Yard', 'พื้นที่รอบบ้าน')}</span><b>{fmt(tt.yard)} m²</b></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#97B865]/50"><div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.min(100, tt.coverage * 100)}%` }} /></div>
              <span className="text-muted">{tr(`House covers ${Math.round(tt.coverage * 100)}% of the land`, `บ้านกินพื้นที่ ${Math.round(tt.coverage * 100)}% ของที่ดิน`)}</span>
            </div>
          </div>
        </Block>
      </>
    ),
    house: (
      <>
        <Block title={tr('Start from a design', 'เริ่มจากแบบสำเร็จ')} aside={<span className="text-xs text-muted">{HOUSE_PRESETS.length} {tr('styles', 'แบบ')}</span>}>
          <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
            {HOUSE_PRESETS.map((p) => (
              <button key={p.id} type="button" className="lift w-36 flex-none snap-start cursor-pointer rounded-xl border-[1.5px] border-line bg-card p-1.5 text-left hover:border-ink"
                onClick={() => { commit(presetSpec(p.id)); setSelId(null); setFloor(0); designId.current = undefined; say(tr(`${p.name} loaded`, `โหลด${t(p.name)}แล้ว`)); }}>
                <Thumb id={p.id} />
                <span className="mt-1 block px-1 text-xs font-bold">{t(p.name)}</span>
              </button>
            ))}
          </div>
        </Block>
        <Block title={tr('House footprint', 'ขนาดตัวบ้าน')} aside={<b className="text-sm tabular-nums">{fmt(tt.fp)} m²</b>}>
          <Stepper label={tr('Width', 'กว้าง')} value={spec.w} step={0.5} min={4} max={30} unit="m" onChange={(v) => resize(v, spec.d)} />
          <Stepper label={tr('Depth', 'ลึก')} value={spec.d} step={0.5} min={4} max={30} unit="m" onChange={(v) => resize(spec.w, v)} />
        </Block>
        <Block title={tr('Floors', 'จำนวนชั้น')}>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" className="tile py-3" aria-pressed={spec.floors === n} onClick={() => setFloors(n)}>
                <span className="flex h-12 flex-col-reverse items-center justify-start gap-0.5">
                  {Array.from({ length: n }, (_, i) => <span key={i} className="block h-3 w-9 rounded-[3px] border-2 border-current" />)}
                  <span className="block h-0 w-0 border-x-[22px] border-b-[9px] border-x-transparent border-b-current" />
                </span>
                <b>{tr(`${n} floor${n > 1 ? 's' : ''}`, `${n} ชั้น`)}</b>
              </button>
            ))}
          </div>
          <Stepper label={tr('Floor to floor height', 'ความสูงต่อชั้น')} value={spec.floorH} step={0.1} min={2.4} max={4.5} unit="m" onChange={(v) => set({ floorH: v })} />
        </Block>
        {spec.floors > 1 && (
          <Block title={tr('Upper floor size', 'ขนาดชั้นบน')} aside={<span className="text-xs text-muted">{tr('smaller = 1.5-storey', 'เล็กลง = บ้านชั้นครึ่ง')}</span>}>
            {Array.from({ length: spec.floors - 1 }, (_, k) => k + 1).map((fi) => (
              <div key={fi} className="grid gap-1.5">
                {spec.floors > 2 && <span className="text-xs font-semibold text-muted">{tr(`Floor ${fi + 1}`, `ชั้น ${fi + 1}`)}</span>}
                <div className="grid grid-cols-5 gap-1.5">
                  {EXTENTS.map((x) => (
                    <button key={x.id} type="button" className="tile p-1.5" aria-pressed={extentId(fi) === x.id} onClick={() => setExtent(fi, x.f)} title={tr(x.en, x.th)}>
                      <span className="relative block h-7 w-9 rounded-[3px] border-2 border-current/40">
                        <span className="absolute rounded-[2px] bg-current" style={x.f ? { left: `${x.f[0] * 100}%`, top: `${x.f[1] * 100}%`, width: `${x.f[2] * 100}%`, height: `${x.f[3] * 100}%` } : { inset: 0 }} />
                      </span>
                      <span className="text-[9.5px] leading-tight">{tr(x.en, x.th)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </Block>
        )}
        <Block title={tr('Type of home', 'ประเภทบ้าน')}>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="tile py-3" aria-pressed={!spec.twin} onClick={() => set({ twin: false })}>
              <span className="flex h-8 items-end"><i className="block h-6 w-9 rounded-sm border-2 border-current" /></span>{tr('Single house', 'บ้านเดี่ยว')}
            </button>
            <button type="button" className="tile py-3" aria-pressed={!!spec.twin} onClick={() => set({ twin: true })}>
              <span className="flex h-8 items-end"><i className="block h-6 w-6 rounded-l-sm border-2 border-current" /><i className="-ml-0.5 block h-6 w-6 rounded-r-sm border-2 border-current bg-current/20" /></span>{tr('Twin house', 'บ้านแฝด')}
            </button>
          </div>
          {spec.twin && <p className="text-[11px] leading-snug text-muted">{tr('Two mirrored homes share the middle wall. Keep each half’s rooms on its own side; each half gets its own front door.', 'บ้านสองหลังสมมาตร ใช้ผนังกลางร่วมกัน จัดห้องของแต่ละหลังไว้ฝั่งตัวเอง แต่ละหลังมีประตูหน้าของตัวเอง')}</p>}
        </Block>
      </>
    ),
    rooms: (
      <>
        {spec.floors > 1 && (
          <div className="flex gap-1.5" role="group" aria-label={tr('Floor', 'ชั้น')}>
            {Array.from({ length: spec.floors }, (_, i) => <button key={i} type="button" className="chip" aria-pressed={floor === i} onClick={() => { setFloor(i); setSelId(null); }}><StepIcon step="rooms" className="size-3.5" />{tr(`Floor ${i + 1}`, `ชั้น ${i + 1}`)}</button>)}
          </div>
        )}
        {selPost ? (
          <div key={selPost.id} className="animate-slide-left grid gap-4 rounded-2xl border-[1.5px] border-accent/40 bg-accent/5 p-3">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-accent text-white"><PostIcon round={selPost.round} /></span>
              <div className="mr-auto"><b className="block">{tr('Post', 'เสา')}</b><span className="text-xs text-muted tabular-nums">{fmt(selPost.size * 100, 0)} cm · x {fmt(selPost.x, 2)} · z {fmt(selPost.z, 2)} m</span></div>
              <button type="button" className="icon-btn size-9" aria-label={tr('Duplicate post', 'ทำสำเนาเสา')} onClick={() => { const c = { ...selPost, id: rid(), x: Math.min(floorRect(spec, floor).x + floorRect(spec, floor).w, selPost.x + 1) }; commit({ ...spec, posts: [...(spec.posts ?? []), c] }); setSelId('post:' + c.id); }}><CopyIcon className="size-4" /></button>
              <button type="button" className="icon-btn size-9 text-[#D0453A]" aria-label={tr('Delete post', 'ลบเสา')} onClick={() => removePost(selPost.id)}><TrashIcon className="size-4" /></button>
            </div>
            <p className="text-[11px] text-muted">{tr('Drag the post on the plan. It snaps every 25 cm.', 'ลากเสาบนผังได้เลย ขยับทีละ 25 ซม.')}</p>
            <Block title={tr('Shape', 'รูปทรงเสา')}>
              <div className="grid grid-cols-2 gap-1.5">
                {([[false, 'Square', 'เสาเหลี่ยม'], [true, 'Round', 'เสากลม']] as const).map(([rd, en, th]) => (
                  <button key={en} type="button" className="tile py-2" aria-pressed={!!selPost.round === rd} onClick={() => editPost(selPost.id, { round: rd })}><PostIcon round={rd} /><span className="text-[10px]">{tr(en, th)}</span></button>
                ))}
              </div>
            </Block>
            <div className="grid grid-cols-2 gap-2">
              <Stepper label={tr('Size', 'ขนาด')} value={selPost.size} step={0.05} min={0.15} max={0.6} unit="m" onChange={(v) => editPost(selPost.id, { size: v })} />
              <Stepper label="X" value={selPost.x} step={0.25} min={0} max={spec.w} unit="m" onChange={(v) => editPost(selPost.id, { x: v })} />
              <Stepper label="Z" value={selPost.z} step={0.25} min={0} max={spec.d} unit="m" onChange={(v) => editPost(selPost.id, { z: v })} />
            </div>
            <button type="button" className="chip justify-self-start" onClick={() => setSelId(null)}><ArrowLeft className="size-3.5" />{tr('All rooms', 'ห้องทั้งหมด')}</button>
          </div>
        ) : sel ? (
          <div key={sel.id} className="animate-slide-left grid gap-4 rounded-2xl border-[1.5px] border-accent/40 bg-accent/5 p-3">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-accent text-white"><RoomIcon type={sel.type} className="size-6" /></span>
              <div className="mr-auto"><b className="block">{t(typeLabel(sel.type))}</b><span className="text-xs text-muted tabular-nums">{fmt(area(sel), 2)} m² · {fmt(sel.w, 2)} × {fmt(sel.d, 2)} m</span></div>
              <button type="button" className="icon-btn size-9" aria-label={tr('Duplicate room', 'ทำสำเนาห้อง')} onClick={() => duplicateRoom(sel)}><CopyIcon className="size-4" /></button>
              <button type="button" className="icon-btn size-9 text-[#D0453A]" aria-label={tr('Delete room', 'ลบห้อง')} onClick={() => removeRoom(sel.id)}><TrashIcon className="size-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stepper label={tr('W', 'กว้าง')} value={sel.w} step={0.25} min={0.8} max={spec.w - sel.x} unit="m" onChange={(v) => editRoom(sel.id, { w: v })} />
              <Stepper label={tr('D', 'ลึก')} value={sel.d} step={0.25} min={0.8} max={spec.d - sel.z} unit="m" onChange={(v) => editRoom(sel.id, { d: v })} />
            </div>
            <Block title={tr('Shape', 'รูปทรงห้อง')}>
              <div className="grid grid-cols-3 gap-1.5">
                {([['rect', 'Rectangle', 'สี่เหลี่ยม'], ['L', 'L-shape', 'ตัว L'], ['cut', 'Angled wall', 'ผนังเอียง']] as const).map(([k, en, th]) => {
                  const on = (sel.shape?.kind ?? 'rect') === k;
                  return (
                    <button key={k} type="button" className="tile py-2" aria-pressed={on}
                      onClick={() => editRoom(sel.id, { shape: k === 'rect' ? undefined : { kind: k, corner: sel.shape?.corner ?? 'ne', a: sel.shape?.a ?? snapTo(sel.w * 0.4), b: sel.shape?.b ?? snapTo(sel.d * 0.4) } })}>
                      <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" fillOpacity={0.2} stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
                        <path d={k === 'rect' ? 'M4 5h16v14H4z' : k === 'L' ? 'M4 5h9v6h7v8H4z' : 'M4 5h10l6 6v8H4z'} />
                      </svg>
                      <span className="text-[10px]">{tr(en, th)}</span>
                    </button>
                  );
                })}
              </div>
              {sel.shape && (
                <div className="grid grid-cols-[auto_1fr] items-center gap-3">
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-soft p-1" role="group" aria-label={tr('Corner', 'มุม')}>
                    {(['nw', 'ne', 'sw', 'se'] as Corner[]).map((c) => (
                      <button key={c} type="button" aria-pressed={sel.shape!.corner === c} aria-label={c} onClick={() => editRoom(sel.id, { shape: { ...sel.shape!, corner: c } })}
                        className={`press grid size-8 cursor-pointer place-items-center rounded-md ${sel.shape!.corner === c ? 'bg-accent text-white' : 'bg-card text-muted'}`}>
                        <span className={`block size-2.5 ${sel.shape!.kind === 'cut' ? 'rotate-45' : ''} rounded-[2px] bg-current`} />
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-1.5">
                    <Stepper label={tr('Cut W', 'ตัดกว้าง')} value={sel.shape.a} step={0.25} min={0.5} max={Math.max(0.5, sel.w - 1)} unit="m" onChange={(v) => editRoom(sel.id, { shape: { ...sel.shape!, a: v } })} />
                    <Stepper label={tr('Cut D', 'ตัดลึก')} value={sel.shape.b} step={0.25} min={0.5} max={Math.max(0.5, sel.d - 1)} unit="m" onChange={(v) => editRoom(sel.id, { shape: { ...sel.shape!, b: v } })} />
                  </div>
                </div>
              )}
            </Block>
            {VARIANTS[sel.type] && (
              <Block title={sel.type === 'kitchen' ? tr('Kitchen layout', 'รูปแบบครัว') : tr('Bathroom layout', 'รูปแบบห้องน้ำ')}>
                <div className="grid grid-cols-3 gap-1.5">
                  {VARIANTS[sel.type]!.map(([k, l]) => (
                    <button key={k} type="button" className="tile py-2" aria-pressed={(sel.variant ?? VARIANTS[sel.type]![0][0]) === k} onClick={() => editRoom(sel.id, { variant: k })}>
                      <VariantIcon type={sel.type} v={k} /><span className="text-[10px] leading-tight">{t(l)}</span>
                    </button>
                  ))}
                </div>
              </Block>
            )}
            <Block title={tr('Windows and doors', 'หน้าต่างและประตู')} aside={sel.windows
              ? <button type="button" className="text-xs font-semibold text-muted underline" onClick={() => editRoom(sel.id, { windows: undefined })}>{tr('Back to automatic', 'กลับเป็นอัตโนมัติ')}</button>
              : null}>
              {!sel.windows ? (
                <button type="button" className="chip justify-self-start" onClick={() => editRoom(sel.id, { windows: autoWindows(spec, floor, sel) })}><HandIcon />{tr('Move windows myself', 'ย้ายหน้าต่างเอง')}</button>
              ) : (
                <div className="grid gap-2">
                  <p className="text-[11px] text-muted">{tr('Drag the blue dots on the plan, or set them here.', 'ลากจุดสีฟ้าบนผัง หรือปรับตรงนี้')}</p>
                  {sel.windows.map((w) => (
                    <div key={w.id} className="animate-fade-up grid gap-1.5 rounded-xl bg-soft p-2">
                      <div className="flex items-center gap-1.5">
                        <select aria-label={tr('Wall', 'ผนัง')} value={w.side} onChange={(e) => editWin(sel, w.id, { side: e.target.value as EdgeSide })} className="rounded-lg border border-line bg-card px-1.5 py-1 text-xs font-semibold">
                          {[...new Set([...outerSides(sel), w.side])].map((sd) => <option key={sd} value={sd}>{L2(SIDE_NAME[sd])}</option>)}
                        </select>
                        <input type="range" min={0} max={1} step={0.025} value={w.pos} aria-label={tr('Position along the wall', 'ตำแหน่งบนผนัง')} onChange={(e) => editWin(sel, w.id, { pos: +e.target.value })} className="min-w-0 flex-1 accent-[var(--accent)]" />
                        <button type="button" className="icon-btn size-8 shadow-none" aria-label={tr('Remove', 'ลบ')} onClick={() => editRoom(sel.id, { windows: sel.windows!.filter((x) => x.id !== w.id) })}><TrashIcon className="size-3.5" /></button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {WIN_KINDS.map(([k, en, th]) => <button key={k} type="button" className="chip px-2 py-1 text-[10.5px]" aria-pressed={w.kind === k} onClick={() => editWin(sel, w.id, { kind: k, w: k === 'door' ? 1 : k === 'round' ? Math.min(w.w, 1) : k === 'glass' || k === 'fins' ? Math.max(w.w, 2) : w.w })}>{tr(en, th)}</button>)}
                        <span className="ml-auto flex items-center gap-1 text-xs font-bold tabular-nums">
                          <button type="button" className="icon-btn size-7 shadow-none" aria-label="−" onClick={() => editWin(sel, w.id, { w: Math.max(0.5, w.w - 0.25) })}><MinusIcon className="size-3" /></button>
                          {fmt(w.w, 2)}m
                          <button type="button" className="icon-btn size-7 shadow-none" aria-label="+" onClick={() => editWin(sel, w.id, { w: Math.min(6, w.w + 0.25) })}><PlusIcon className="size-3" /></button>
                        </span>
                      </div>
                    </div>
                  ))}
                  {outerSides(sel).length > 0
                    ? <button type="button" className="chip justify-self-start" onClick={() => editRoom(sel.id, { windows: [...sel.windows!, { id: rid(), side: outerSides(sel)[0], pos: 0.5, w: 1.2, kind: 'window' }] })}><PlusIcon className="size-3.5" />{tr('Add window', 'เพิ่มหน้าต่าง')}</button>
                    : <p className="text-[11px] text-muted">{tr('This room has no outside wall.', 'ห้องนี้ไม่มีผนังด้านนอก')}</p>}
                </div>
              )}
            </Block>
            <Block title={tr('Doors', 'ประตู')} aside={sel.doors
              ? <button type="button" className="text-xs font-semibold text-muted underline" onClick={() => editRoom(sel.id, { doors: undefined })}>{tr('Back to automatic', 'กลับเป็นอัตโนมัติ')}</button>
              : null}>
              {!sel.doors ? (
                <>
                  {!['living', 'dining', 'kitchen', 'hall', 'terrace', 'undercroft', 'carport'].includes(sel.type) && (
                    <label className="flex items-center gap-2 text-xs font-semibold text-muted">
                      <span className="flex-none">{tr('Inside door', 'ประตูห้อง')}</span>
                      <input type="range" min={0} max={1} step={0.05} value={sel.doorAt ?? 0.15} onChange={(e) => editRoom(sel.id, { doorAt: +e.target.value })} className="min-w-0 flex-1 accent-[var(--accent)]" />
                    </label>
                  )}
                  <p className="text-[11px] text-muted">{tr('Tip: grab any orange dot on the plan to move that door, onto any wall.', 'เคล็ดลับ: ลากจุดสีส้มบนผังเพื่อย้ายประตูบานนั้นไปผนังไหนก็ได้')}</p>
                  <button type="button" className="chip justify-self-start" onClick={() => editRoom(sel.id, { doors: autoDoors(spec, floor, sel) })}><HandIcon />{tr('Place doors myself', 'วางประตูเอง')}</button>
                </>
              ) : (
                <div className="grid gap-2">
                  <p className="text-[11px] text-muted">{tr('Drag the orange dots along any wall, even round a corner. A door on an outside wall leads out of the house.', 'ลากจุดสีส้มไปตามผนังไหนก็ได้ ข้ามมุมได้ด้วย ประตูบนผนังด้านนอกจะเป็นทางออกนอกบ้าน')}</p>
                  {sel.doors.map((d) => (
                    <div key={d.id} className="animate-fade-up grid gap-1.5 rounded-xl bg-soft p-2">
                      <div className="flex items-center gap-1.5">
                        <select aria-label={tr('Wall', 'ผนัง')} value={d.side} onChange={(e) => editDoor(sel, d.id, { side: e.target.value as Side })} className="rounded-lg border border-line bg-card px-1.5 py-1 text-xs font-semibold">
                          {[...new Set([...roomSides(sel), d.side])].map((sd) => <option key={sd} value={sd}>{L2(SIDE_NAME[sd])}{outerSides(sel).includes(sd) ? tr(' (outside)', ' (ด้านนอก)') : ''}</option>)}
                        </select>
                        <input type="range" min={0} max={1} step={0.025} value={d.pos} aria-label={tr('Position along the wall', 'ตำแหน่งบนผนัง')} onChange={(e) => editDoor(sel, d.id, { pos: +e.target.value })} className="min-w-0 flex-1 accent-[var(--accent)]" />
                        <button type="button" className="icon-btn size-8 shadow-none" aria-label={tr('Remove', 'ลบ')} onClick={() => editRoom(sel.id, { doors: sel.doors!.filter((x) => x.id !== d.id) })}><TrashIcon className="size-3.5" /></button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {DOOR_KINDS.map(([k, en, th, w]) => <button key={k} type="button" className="chip px-2 py-1 text-[10.5px]" aria-pressed={d.kind === k} onClick={() => editDoor(sel, d.id, { kind: k, w: d.kind === k ? d.w : w })}>{tr(en, th)}</button>)}
                        {(d.kind === 'swing' || d.kind === 'double') && <button type="button" className="chip px-2 py-1 text-[10.5px]" aria-pressed={!!d.flip} onClick={() => editDoor(sel, d.id, { flip: !d.flip })}>{tr('Swing other way', 'กลับทิศเปิด')}</button>}
                        <span className="ml-auto flex items-center gap-1 text-xs font-bold tabular-nums">
                          <button type="button" className="icon-btn size-7 shadow-none" aria-label="−" onClick={() => editDoor(sel, d.id, { w: Math.max(0.6, d.w - 0.1) })}><MinusIcon className="size-3" /></button>
                          {fmt(d.w, 2)}m
                          <button type="button" className="icon-btn size-7 shadow-none" aria-label="+" onClick={() => editDoor(sel, d.id, { w: Math.min(4, d.w + 0.1) })}><PlusIcon className="size-3" /></button>
                        </span>
                      </div>
                    </div>
                  ))}
                  {!sel.doors.length && <p className="text-[11px] text-muted">{tr('No doors: this room is closed off.', 'ไม่มีประตู ห้องนี้จะปิดทึบ')}</p>}
                  <button type="button" className="chip justify-self-start" onClick={() => editRoom(sel.id, { doors: [...sel.doors!, { id: rid(), side: roomSides(sel)[0] ?? 's', pos: 0.5, w: 0.9, kind: 'swing' }] })}><PlusIcon className="size-3.5" />{tr('Add door', 'เพิ่มประตู')}</button>
                </div>
              )}
            </Block>
            <Block title={tr('Room type', 'ประเภทห้อง')}>
              <div className="grid grid-cols-5 gap-1.5">
                {TYPE_ORDER.map((ty) => <button key={ty} type="button" title={t(typeLabel(ty))} aria-label={t(typeLabel(ty))} aria-pressed={sel.type === ty} className="tile aspect-square p-1" onClick={() => changeType(sel, ty)}><RoomIcon type={ty} className="size-5" /><span className="line-clamp-1 text-[9px]">{t(typeLabel(ty)).split(' ')[0]}</span></button>)}
              </div>
            </Block>
            <Block title={tr('Floor', 'พื้น')}>
              <div className="grid grid-cols-4 gap-1.5">
                {FINS.map(([k, l, hex]) => <button key={k} type="button" aria-pressed={sel.floor === k} className="tile gap-1 p-1" onClick={() => editRoom(sel.id, { floor: k })}><i className="block h-7 w-full rounded-md border border-black/10" style={{ background: hex }} /><span className="text-[10px]">{t(l)}</span></button>)}
              </div>
            </Block>
            <Block title={tr('Walls', 'สีผนัง')}><Swatches label={tr('Wall paint', 'สีผนัง')} list={PAINTS} value={sel.paint} onPick={(v) => editRoom(sel.id, { paint: v })} /></Block>
            {PTYPES[sel.type].items.length > 0 && (
              <Block title={tr('Furniture', 'เฟอร์นิเจอร์')} aside={sel.place && Object.keys(sel.place).length
                ? <button type="button" className="text-xs font-semibold text-muted underline" onClick={() => editRoom(sel.id, { place: undefined })}>{tr('Reset positions', 'คืนตำแหน่งเดิม')}</button>
                : null}>
                <p className="text-[11px] text-muted">{tr('On the plan, tap a piece to pick it, then drag it anywhere in the room. Tap ↻ to turn it.', 'บนผัง แตะชิ้นเฟอร์นิเจอร์เพื่อเลือก แล้วลากไปวางตรงไหนก็ได้ในห้อง กด ↻ เพื่อหมุน')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {PTYPES[sel.type].items.map(([k, l]) => {
                    const on = sel.items.includes(k);
                    return <button key={k} type="button" className="chip" aria-pressed={on} onClick={() => editRoom(sel.id, { items: on ? sel.items.filter((i) => i !== k) : [...sel.items, k] })}>{on ? <OkIcon className="size-3.5" /> : <PlusIcon className="size-3.5" />}{t(l)}</button>;
                  })}
                </div>
              </Block>
            )}
            <button type="button" className="chip justify-self-start" onClick={() => setSelId(null)}><ArrowLeft className="size-3.5" />{tr('All rooms', 'ห้องทั้งหมด')}</button>
          </div>
        ) : (
          <>
            <Block title={tr('Add a room', 'เพิ่มห้อง')} aside={<span className="text-xs text-muted">{tr('drag onto the plan', 'ลากลงผัง')}</span>}>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 xl:grid-cols-4">
                {TYPE_ORDER.map((ty) => (
                  <button key={ty} type="button" className="tile aspect-square touch-none cursor-grab active:cursor-grabbing" onPointerDown={(e) => startTileDrag(e, ty)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); placeRoom(ty); } }}>
                    <RoomIcon type={ty} className="size-6" /><span className="line-clamp-2 leading-tight">{t(typeLabel(ty))}</span>
                  </button>
                ))}
              </div>
            </Block>
            <Block title={tr('Add a post', 'เพิ่มเสา')} aside={<span className="text-xs text-muted">{tr('drag onto the plan', 'ลากลงผัง')}</span>}>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 xl:grid-cols-4">
                {([[false, 'Square post', 'เสาเหลี่ยม'], [true, 'Round post', 'เสากลม']] as const).map(([rd, en, th]) => (
                  <button key={en} type="button" className="tile aspect-square touch-none cursor-grab active:cursor-grabbing" onPointerDown={(e) => startTileDrag(e, 'post', (at) => placePost(rd, at))} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); placePost(rd); } }}>
                    <PostIcon round={rd} /><span className="line-clamp-2 leading-tight">{tr(en, th)}</span>
                  </button>
                ))}
              </div>
              {posts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {posts.map((p, i) => <button key={p.id} type="button" className="chip" onClick={() => setSelId('post:' + p.id)}><PostIcon round={p.round} small />{tr(`Post ${i + 1}`, `เสา ${i + 1}`)}</button>)}
                </div>
              )}
            </Block>
            <Block title={tr(`On floor ${floor + 1}`, `ในชั้น ${floor + 1}`)} aside={<span className="text-xs text-muted">{tr('tap to edit', 'แตะเพื่อแก้')}</span>}>
              <div className="flex flex-wrap gap-1.5">
                {rooms.map((r) => <button key={r.id} type="button" className={`chip ${errorIds.has(r.id) ? 'border-[#D0453A]' : ''}`} onClick={() => setSelId(r.id)}><RoomIcon type={r.type} className="size-4" />{t(typeLabel(r.type))}<span className="text-muted">{fmt(area(r))}</span></button>)}
                {!rooms.length && <p className="text-xs text-muted">{tr('Empty floor. Drag rooms in, or start from a layout.', 'ชั้นนี้ยังว่าง ลากห้องมาวาง หรือเริ่มจากผังสำเร็จ')}</p>}
              </div>
            </Block>
            <div>
              <button type="button" className="chip" aria-expanded={showTemplates} onClick={() => setShowTemplates((v) => !v)}><StepIcon step="rooms" className="size-4" />{tr('Start from a ready layout', 'เริ่มจากผังสำเร็จ')}</button>
              {showTemplates && (
                <div className="animate-fade-up mt-2 grid gap-1.5">
                  {TEMPLATES.map((tp) => (
                    <button key={tp.id} type="button" className="chip justify-between" onClick={() => { const lay = applyTemplate(tp, spec.w, spec.d); commit({ ...spec, floors: tp.floors, levels: lay.levels, extents: lay.extents, twin: lay.twin ?? false }); setSelId(null); setFloor(0); setShowTemplates(false); say(tr(`${tp.name} applied`, `ใช้ผัง${t(tp.name)}แล้ว`)); }}>
                      <span>{t(tp.name)}</span><span className="text-muted">{tr(`${tp.floors} fl.`, `${tp.floors} ชั้น`)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </>
    ),
    style: (
      <>
        <Block title={tr('Style', 'สไตล์')}>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="tablist">
            {([['all', 'All'], ...REGIONS] as [Region | 'all', string][]).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={region === k} className="chip flex-none" aria-pressed={region === k} onClick={() => setRegion(k)}>{t(l)}</button>)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {STYLES.filter((st) => region === 'all' || st.region === region).map((st) => {
              const preview = { ...spec, styleId: st.id, roof: st.roof, glass: st.glass, finish: st.finish, colors: { ...st.colors }, ...styleLook(st) };
              return (
                <button key={st.id} type="button" aria-pressed={spec.styleId === st.id} className={`lift cursor-pointer rounded-xl border-[1.5px] bg-card p-1.5 text-left ${spec.styleId === st.id ? 'border-accent ring-2 ring-accent/30' : 'border-line'}`}
                  onClick={() => set({ styleId: st.id, roof: st.roof, glass: st.glass, finish: st.finish, colors: { ...st.colors }, ...styleLook(st) })}>
                  <Thumb id={`style-${st.id}-${spec.w}-${spec.d}-${spec.floors}-${spec.floorH}-${JSON.stringify(spec.extents ?? '')}-${spec.twin ? 1 : 0}`} spec={preview} />
                  <span className="mt-1 block px-1 text-xs font-bold">{t(st.name)}</span>
                  <span className="block px-1 pb-0.5 text-[10px] leading-snug text-muted">{t(st.blurb)}</span>
                </button>
              );
            })}
          </div>
        </Block>
        <Block title={tr('Roof', 'หลังคา')}>
          <div className="grid grid-cols-4 gap-1.5">
            {ROOFS.map(([k, l]) => <button key={k} type="button" className="tile p-1.5" aria-pressed={spec.roof === k} onClick={() => set({ roof: k })}><RoofIcon roof={k} className="size-7" /><span className="text-[9.5px] leading-tight">{t(l)}</span></button>)}
          </div>
          <Swatches label={tr('Roof colour', 'สีหลังคา')} list={ROOF_COLORS} value={spec.colors.roof} onPick={(v) => set({ colors: { ...spec.colors, roof: v } })} />
        </Block>
        <Block title={tr('Outside walls', 'ผิวผนังภายนอก')}>
          <div className="grid grid-cols-3 gap-1.5">
            {FINISHES.map(([k, l]) => (
              <button key={k} type="button" className="tile gap-1 p-1.5" aria-pressed={(spec.finish ?? 'plaster') === k} onClick={() => set({ finish: k })}>
                <FinishSwatch f={k} color={spec.colors.wall} /><span className="text-[10px]">{t(l)}</span>
              </button>
            ))}
          </div>
        </Block>
        <Block title={tr('Colours', 'สี')}>
          <div className="grid gap-2.5">
            {([['wall', tr('Walls', 'ผนัง'), [...EXT.wall, ...WALL_COLORS.filter(([, h]) => !EXT.wall.some(([, x]) => x.toLowerCase() === h.toLowerCase()))]], ['frame', tr('Frames', 'กรอบ'), EXT.frame], ['wood', tr('Wood', 'ไม้'), EXT.wood]] as const).map(([k, l, list]) => (
              <div key={k} className="flex items-center gap-3"><span className="w-14 text-xs font-semibold text-muted">{l}</span><Swatches label={l} list={list} value={spec.colors[k]} onPick={(v) => set({ colors: { ...spec.colors, [k]: v } })} /></div>
            ))}
          </div>
        </Block>
        <Block title={tr('Windows', 'หน้าต่าง')}>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="tile py-3" aria-pressed={spec.glass === 'more'} onClick={() => set({ glass: 'more' })}><span className="flex h-8 items-end gap-0.5">{[0, 1, 2].map((i) => <i key={i} className="block h-8 w-4 rounded-sm border-2 border-current bg-[#9FC3D3]/50" />)}</span>{tr('Big glass', 'กระจกบานใหญ่')}</button>
            <button type="button" className="tile py-3" aria-pressed={spec.glass === 'less'} onClick={() => set({ glass: 'less' })}><span className="flex h-8 items-center gap-2">{[0, 1].map((i) => <i key={i} className="block h-5 w-5 rounded-sm border-2 border-current bg-[#9FC3D3]/50" />)}</span>{tr('Windows', 'หน้าต่างธรรมดา')}</button>
          </div>
        </Block>
      </>
    ),
    check: (
      <>
        <div className="flex items-center gap-4 rounded-2xl bg-soft p-3">
          <Ring value={score} />
          <div className="grid gap-1">
            <b className="text-base">{counts.error ? tr('A few things to fix', 'มีบางจุดต้องแก้') : counts.warn ? tr('Nearly there', 'ใกล้เสร็จแล้ว') : tr('Ready to go', 'พร้อมแล้ว')}</b>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
              <span className="rounded-full bg-[#D0453A]/15 px-2 py-0.5 text-[#B03A30]">{counts.error} {tr('must fix', 'ต้องแก้')}</span>
              <span className="rounded-full bg-[#C98A1E]/15 px-2 py-0.5 text-[#8A5D10]">{counts.warn} {tr('check', 'ควรตรวจ')}</span>
              <span className="rounded-full bg-card px-2 py-0.5 text-muted">{counts.tip} {tr('tips', 'คำแนะนำ')}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[[<MapIcon key="a" className="size-4" />, `${fmt(spec.site.plotW * spec.site.plotD)}`, tr('sq. wah', 'ตร.ว.')], [<StepIcon key="b" step="house" className="size-4" />, `${fmt(tt.floorArea)}`, tr('m² inside', 'ตร.ม. ใช้สอย')], [<RoomIcon key="c" type="bedroom" className="size-4" />, `${tt.beds}`, tr('bedrooms', 'ห้องนอน')],
            [<RoomIcon key="d" type="bathroom" className="size-4" />, `${tt.baths}`, tr('bathrooms', 'ห้องน้ำ')], [<LayersIcon key="e" />, `${spec.floors}`, tr('floors', 'ชั้น')], [<SaveIcon key="f" className="size-4" />, thb(tt.cost), tr('est. cost', 'งบประมาณคร่าวๆ')]].map(([ic, v, l], i) => (
            <div key={i} className="animate-pop-in grid gap-0.5 rounded-xl bg-soft p-2.5" style={{ animationDelay: `${i * 50}ms` }}><span className="text-muted">{ic}</span><b className="text-base tabular-nums">{v}</b><span className="text-[10px] font-semibold text-muted">{l}</span></div>
          ))}
        </div>
        <ul className="grid gap-2">
          {advice.map((a, i) => (
            <li key={i} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <button type="button" onClick={() => pickAdvice(a)} className={`press grid w-full cursor-pointer grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 rounded-xl border-l-4 px-3 py-2.5 text-left ${LEVEL[a.level].cls}`}>
                <span className="row-span-2 pt-0.5">{LEVEL[a.level].icon}</span>
                <span className="text-xs font-bold">{a.title}{a.law && <span className="ml-1.5 rounded bg-card px-1 py-px text-[9px] tracking-wide text-muted uppercase">{tr('Law', 'กฎหมาย')}</span>}</span>
                <span className="text-[11.5px] leading-snug text-muted">{a.detail}</span>
              </button>
            </li>
          ))}
          {!advice.length && <li className="flex items-center gap-2 rounded-xl bg-[#3D7A4A]/10 p-3 text-sm font-semibold text-[#2F6A3C]"><OkIcon className="size-5" />{tr('Everything checks out.', 'ผ่านทุกข้อ')}</li>}
        </ul>
        <p className="text-[10.5px] leading-snug text-muted">{tr('“Law” items follow Thailand\'s Ministerial Regulation No. 55 (B.E. 2543). Some areas, such as Bangkok, are stricter. Confirm with your local building office or an architect. Costs are rough estimates.', 'ข้อที่มีป้าย “กฎหมาย” อ้างอิงกฎกระทรวงฉบับที่ 55 (พ.ศ. 2543) บางพื้นที่ เช่น กรุงเทพฯ เข้มกว่านี้ ควรตรวจกับสำนักงานเขต/อบต. หรือสถาปนิก ราคาเป็นการประมาณคร่าวๆ')}</p>
        <div className="grid grid-cols-2 gap-2">
          <SlideButton ghost onClick={save} icon={<SaveIcon />}>{tr('Save', 'บันทึก')}</SlideButton>
          {confirmSend
            ? <button type="button" className="btn press animate-pop-in" onClick={sendToSim}><SendIcon className="size-4" />{tr('Yes, replace plot', 'ใช่ แทนที่แปลงเดิม')}</button>
            : <SlideButton onClick={() => setConfirmSend(true)} icon={<SendIcon />}>{tr('To simulator', 'ไปที่ซิมูเลเตอร์')}</SlideButton>}
        </div>
        {confirmSend && <p className="animate-fade-in -mt-2 text-xs text-muted">{tr('This replaces the plot in the simulator.', 'จะแทนที่แปลงในซิมูเลเตอร์')} <button type="button" className="underline" onClick={() => setConfirmSend(false)}>{tr('Cancel', 'ยกเลิก')}</button></p>}
      </>
    ),
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink lg:h-dvh">
      {/* header */}
      <header className="flex items-center gap-3 border-b border-line py-2.5" style={pad}>
        <a href="/" aria-label="ClovedBuild" className="animate-header-rise inline-flex flex-none no-underline will-change-transform"><LogoPill compact /></a>
        <input value={spec.name} onChange={(e) => setSpecState({ ...spec, name: e.target.value })} onBlur={() => commit(specRef.current)} aria-label={tr('Design name', 'ชื่อแบบบ้าน')} maxLength={40}
          className="min-w-0 flex-1 rounded-lg border-[1.5px] border-transparent bg-transparent px-2 py-1 text-base font-bold hover:border-line focus:border-line sm:max-w-64" />
        <div className="animate-nav-fade ml-auto flex flex-none items-center gap-1.5">
          <LangToggle />
          <button type="button" className="icon-btn size-9" aria-label={tr('Undo', 'เลิกทำ')} onClick={undo} disabled={hist.current.i <= 0}><UndoIcon className="size-4" /></button>
          <button type="button" className="icon-btn size-9 max-sm:hidden" aria-label={tr('Redo', 'ทำซ้ำ')} onClick={redo} disabled={hist.current.i >= hist.current.list.length - 1}><RedoIcon className="size-4" /></button>
          <button type="button" className="icon-btn size-9" aria-label={tr('Save design', 'บันทึกแบบ')} onClick={save}><SaveIcon className="size-4" /></button>
          <SlideButton small href="/simulator" className="max-sm:hidden" icon={<SendIcon />}>{tr('Simulator', 'ซิมูเลเตอร์')}</SlideButton>
        </div>
      </header>

      {/* steps */}
      <nav aria-label={tr('Steps', 'ขั้นตอน')} className="border-b border-line bg-bg py-2" style={pad}>
        <ol className="relative mx-auto flex max-w-3xl items-center justify-between">
          <span aria-hidden="true" className="absolute top-5 right-6 left-6 h-0.5 bg-line" />
          <span aria-hidden="true" className="absolute top-5 left-6 h-0.5 bg-accent transition-[width] duration-500" style={{ width: `calc((100% - 3rem) * ${idx / (STEPS.length - 1)})` }} />
          {STEPS.map((s, i) => (
            <li key={s.id} className="relative z-10">
              <button type="button" onClick={() => goStep(s.id)} aria-current={step === s.id ? 'step' : undefined} className="press group flex cursor-pointer flex-col items-center gap-1">
                <span className={`relative grid size-10 place-items-center rounded-full border-2 transition-all duration-300 ${step === s.id ? 'scale-110 border-accent bg-accent text-white shadow-soft' : i < idx ? 'border-accent bg-card text-accent' : 'border-line bg-card text-muted group-hover:border-ink'}`}>
                  <StepIcon step={s.id} className="size-5" />
                  {s.id === 'check' && counts.error > 0 && <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-[#D0453A] text-[10px] font-bold text-white">{counts.error}</span>}
                </span>
                <span className={`text-[11px] font-bold ${step === s.id ? 'text-ink' : 'text-muted max-sm:hidden'}`}>{L2(s.label)}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* workspace */}
        <main style={{ ['--d' as string]: '150ms' }} className="enter relative h-[52dvh] min-h-[320px] overflow-hidden bg-soft lg:h-auto">
          <div key={view + (view === 'plan' ? (siteMode ? 'site' : 'floor') : '')} className="animate-fade-in absolute inset-0">
            {view === 'plan' ? (
              <div className="absolute inset-2 overflow-hidden rounded-2xl border border-line bg-[#FFFDFB] sm:inset-4">
                <PlanView spec={spec} floor={floor} mode={siteMode ? 'site' : 'floor'} selId={selId} snap={0.25} errorIds={errorIds} apiRef={planApi}
                  onSelect={(id) => { setSelId(id); if (id && step !== 'rooms') goStep('rooms'); }} onLive={(s) => { specRef.current = s; setSpecState(s); }} onCommit={() => commit(specRef.current)} />
              </div>
            ) : (
              <div className="absolute inset-0 p-2 sm:p-4">
                <Preview3D fill spec={spec} floor={floor} open={step === 'rooms'} selId={selId} onSelect={(id) => { setSelId(id); goStep('rooms'); setView('3d'); }} />
              </div>
            )}
          </div>
          <div className="glass absolute top-4 left-4 flex rounded-full p-1 shadow-soft sm:top-6 sm:left-6" role="group" aria-label={tr('View', 'มุมมอง')}>
            <button type="button" aria-pressed={view === 'plan'} onClick={() => setView('plan')} className={`press flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${view === 'plan' ? 'bg-btn text-btn-ink' : 'text-muted'}`}><MapIcon className="size-4" />{tr('Plan', 'ผัง')}</button>
            <button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')} className={`press flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${view === '3d' ? 'bg-btn text-btn-ink' : 'text-muted'}`}><CubeIcon className="size-4" />3D</button>
          </div>
          {view === 'plan' && !siteMode && spec.floors > 1 && (
            <div className="glass absolute top-4 right-4 flex rounded-full p-1 shadow-soft sm:top-6 sm:right-6" role="group" aria-label={tr('Floor', 'ชั้น')}>
              {Array.from({ length: spec.floors }, (_, i) => <button key={i} type="button" aria-pressed={floor === i} onClick={() => { setFloor(i); setSelId(null); }} className={`press cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold ${floor === i ? 'bg-accent text-white' : 'text-muted'}`}>F{i + 1}</button>)}
            </div>
          )}
          {view === 'plan' && (
            <div className="glass absolute right-4 bottom-4 flex flex-col rounded-full p-1 shadow-soft sm:right-6 sm:bottom-6" role="group" aria-label={tr('Zoom', 'ซูม')}>
              <button type="button" className="press grid size-9 cursor-pointer place-items-center rounded-full hover:bg-card" aria-label={tr('Zoom in', 'ซูมเข้า')} onClick={() => planApi.current?.zoomBy(1.4)}><PlusIcon className="size-4" /></button>
              <button type="button" className="press grid size-9 cursor-pointer place-items-center rounded-full hover:bg-card" aria-label={tr('Zoom out', 'ซูมออก')} onClick={() => planApi.current?.zoomBy(1 / 1.4)}><MinusIcon className="size-4" /></button>
              <button type="button" className="press grid size-9 cursor-pointer place-items-center rounded-full hover:bg-card" aria-label={tr('Fit to screen', 'พอดีจอ')} onClick={() => planApi.current?.reset()}><FitIcon className="size-4" /></button>
            </div>
          )}
          {toast && <div role="status" className="animate-pop-in pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-xs font-semibold whitespace-nowrap text-bg shadow-soft">{toast}</div>}
        </main>

        {/* step panel */}
        <aside style={{ ['--d' as string]: '300ms' }} className="enter flex min-h-0 flex-col border-line bg-card lg:border-l" aria-label={L2(STEPS[idx].title)}>
          <div className="flex items-center gap-2 px-4 pt-4 lg:px-5">
            <span className="text-xs font-bold text-accent">{tr(`Step ${idx + 1} of ${STEPS.length}`, `ขั้นที่ ${idx + 1} จาก ${STEPS.length}`)}</span>
          </div>
          <h2 className="px-4 pb-1 text-xl font-bold lg:px-5">{L2(STEPS[idx].title)}</h2>
          <div key={step} className="animate-slide-left grid flex-1 content-start gap-5 overflow-y-auto px-4 pt-3 pb-28 lg:px-5 lg:pb-6">{panels[step]}</div>
          <div className="glass fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-line py-3 lg:static lg:mt-auto" style={{ ...pad, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            <button type="button" className="btn btn-ghost press min-w-0 flex-1" disabled={idx === 0} onClick={() => goStep(STEPS[Math.max(0, idx - 1)].id)} style={idx === 0 ? { opacity: 0.4 } : undefined}><ArrowLeft className="size-4 flex-none" /><span className="truncate">{tr('Back', 'ย้อนกลับ')}</span></button>
            {idx < STEPS.length - 1
              ? <button type="button" className="btn press min-w-0 flex-[2]" onClick={() => goStep(STEPS[idx + 1].id)}><span className="truncate">{tr('Next', 'ถัดไป')}: {L2(STEPS[idx + 1].label)}</span><ArrowRight className="size-4 flex-none" /></button>
              : <SlideButton className="min-w-0 flex-[2]" onClick={() => setConfirmSend(true)} icon={<SendIcon />}>{tr('Place in simulator', 'วางในซิมูเลเตอร์')}</SlideButton>}
          </div>
        </aside>
      </div>

      {ghost && (
        <div className="pointer-events-none fixed z-50 grid size-16 place-items-center rounded-2xl bg-accent text-white shadow-soft" style={{ left: ghost.x, top: ghost.y, transform: 'translate(-50%, -50%) rotate(-4deg)' }}>
          {ghost.type === 'post' ? <><PostIcon /><span className="text-[9px] font-bold">{tr('Post', 'เสา')}</span></> : <><RoomIcon type={ghost.type} className="size-7" /><span className="text-[9px] font-bold">{t(typeLabel(ghost.type))}</span></>}
        </div>
      )}
    </div>
  );
}

function LayersIcon() { return <StepIcon step="rooms" className="size-4" />; }

function PostIcon({ round, small }: { round?: boolean; small?: boolean }) {
  return <svg viewBox="0 0 24 24" className={small ? 'size-3.5' : 'size-6'} fill="currentColor" fillOpacity={0.25} stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
    {round ? <><ellipse cx="12" cy="5" rx="4" ry="1.6" /><path d="M8 5v14a4 1.6 0 0 0 8 0V5" /></> : <path d="M8 4h8v16H8zM6 4h12M6 20h12" />}
  </svg>;
}
function HandIcon() { return <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1V4.5a1.5 1.5 0 0 1 3 0V12m0-6.5a1.5 1.5 0 0 1 3 0V13m0-4.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.6-2.2L4.6 15a1.6 1.6 0 0 1 2.5-2l.9 1" /></svg>; }
/** Tiny plan sketch of each kitchen / bathroom layout. */
function VariantIcon({ type, v }: { type: PType; v: string }) {
  const k: Record<string, string> = {
    line: 'M3 4h18v3H3zM8 13h8v4H8z', L: 'M3 4h18v3H6v13H3z', U: 'M3 4h18v16h-3V7H6v13H3z', island: 'M3 4h18v3H3zM6 11h12v6H6z', thai: 'M3 4h10v3H3zM15 4h6v16h-6z',
    tub: 'M3 4h18v6H3zM4 15h4v5H4zM15 16h5v4h-5z', shower: 'M3 4h7v7H3zM4 15h4v5H4zM15 16h5v4h-5z', wetdry: 'M3 4h18v7H3zM12 4v7M4 15h4v5H4zM15 16h5v4h-5z', double: 'M3 4h18v3H3zM6 8h3M15 8h3M4 15h4v5H4z',
  };
  return <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" fillOpacity={0.25} stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" aria-hidden="true"><path d="M2 2h20v20H2z" fill="none" strokeOpacity={0.35} /><path d={k[v] ?? k.line} /></svg>;
}
/** A little chip of a wall finish, tinted like the 3D texture. */
function FinishSwatch({ f, color }: { f: string; color: string }) {
  const lines: Record<string, ReactNode> = {
    plaster: null,
    wood: [4, 10, 16, 22].map((x) => <line key={x} x1={x} y1={0} x2={x} y2={16} />),
    siding: [3, 7, 11, 15].map((y) => <line key={y} x1={0} y1={y} x2={28} y2={y} />),
    brick: [4, 8, 12].map((y) => <line key={y} x1={0} y1={y} x2={28} y2={y} />).concat([0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => <line key={`${r}${c}`} x1={c * 8 + (r % 2) * 4} y1={r * 4} x2={c * 8 + (r % 2) * 4} y2={r * 4 + 4} />)).flat()),
    stone: <><path d="M0 6h9l2-6M11 6h10l2 4h5M9 6l-1 5H0M8 11h11l2-5M19 11l1 5" fill="none" /></>,
    marble: <><path d="M0 0v16M14 0v16M28 0v16" /><path d="M2 3c4 2 3 6 8 9M16 2c3 4 7 5 10 12" strokeOpacity={0.5} fill="none" /></>,
    metal: [7, 14, 21].map((x) => <line key={x} x1={x} y1={0} x2={x} y2={16} />),
    timber: <g strokeWidth={2.2} stroke="#3B2A20"><line x1={1} y1={0} x2={1} y2={16} /><line x1={14} y1={0} x2={14} y2={16} /><line x1={0} y1={8} x2={28} y2={8} /><line x1={1} y1={8} x2={14} y2={0} /><line x1={14} y1={8} x2={27} y2={16} /></g>,
  };
  return <svg viewBox="0 0 28 16" className="h-7 w-full rounded-md border border-black/10" preserveAspectRatio="none" aria-hidden="true"><rect width={28} height={16} fill={color} /><g stroke="#000" strokeOpacity={0.3} strokeWidth={0.8}>{lines[f]}</g></svg>;
}
