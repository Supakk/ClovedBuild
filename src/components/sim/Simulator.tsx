import { useCallback, useEffect, useRef, useState, type ReactNode, type PointerEvent as RPE } from 'react';
import { SimWorld, type View } from '../../lib/sim/world';
import {
  CATALOG, CAR_COLORS, CAT_COATS, DOG_COATS, SHIRTS, areaText, defaultScene, kindLabel, placedHouse,
  type CatalogItem, type Plot, type Scene, type SimObject, type TopFloor,
} from '../../lib/sim/types';
import { HOUSE_PRESETS, VARIANTS, presetFromUrl, presetSpec, styleById, type HouseSpec } from '../../lib/plan/spec';
import { listDesigns, saveDraft, takeHandoff } from '../../lib/plan/storage';
import { houseThumb } from '../../lib/plan/thumbs';
import { itemThumb } from '../../lib/sim/thumbs';
import { webglOK } from '../../lib/house/stage';
import { t, tr, useLang } from '../../lib/i18n';
import LangToggle from '../LangToggle';
import SlideButton from '../SlideButton';
import { LogoPill } from '../LogoMark';
import {
  CatIcon, CloseIcon, CopyIcon, CubeIcon, FitIcon, HandIcon, InfoIcon, LayersIcon, MapIcon, MinusIcon, PlusIcon,
  RedoIcon, StepIcon, TrashIcon, TurnLeft, TurnRight, UndoIcon, ArrowRight,
} from '../icons';

const STORAGE_KEY = 'cloved-sim-v2';
const TOUR_KEY = 'cloved-sim-tour';
const SNAPS: [number, string, string][] = [[2, '1 wah', '1 วา'], [0.5, '50 cm', '50 ซม.'], [0, 'Free', 'อิสระ']];
type Make = () => Omit<SimObject, 'id' | 'x' | 'z'>;
interface Card { key: string; label: string; make: Make; thumb: () => Promise<string | null> }
interface Group { title: string; short: string; cards: Card[]; icon?: string }

function loadSaved(): Scene | null {
  try { const o = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'); return o?.plot && Array.isArray(o.objects) ? o : null; } catch { return null; }
}
const seen = () => { try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return true; } };

function Swatches({ list, value, onPick, label }: { list: [string, string][]; value: string; onPick: (v: string) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {list.map(([n, hex]) => <button key={hex} type="button" title={t(n)} aria-label={t(n)} className="swatch press size-8" style={{ background: hex }} aria-pressed={value === hex} onClick={() => onPick(hex)} />)}
    </div>
  );
}
function Field({ title, children }: { title: string; children: ReactNode }) {
  return <div className="grid gap-2"><h4 className="text-xs font-bold text-muted">{title}</h4>{children}</div>;
}
function CardThumb({ card }: { card: Card }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { let a = true; card.thumb().then((s) => a && setSrc(s)); return () => { a = false; }; }, [card.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="pointer-events-none relative aspect-[5/4] w-full">{src ? <img src={src} alt="" draggable={false} className="animate-fade-in size-full object-contain" /> : <div className="skeleton absolute inset-2 rounded-lg" />}</div>;
}

const TOUR = () => [
  { icon: <HandIcon className="size-10 animate-wiggle" />, title: tr('Drag things onto your land', 'ลากของมาวางบนที่ดิน'), text: tr('Pick a house, furniture, people or pets and drop them where you like.', 'เลือกบ้าน เฟอร์นิเจอร์ คน หรือสัตว์เลี้ยง แล้ววางตรงไหนก็ได้') },
  { icon: <MapIcon className="size-10" />, title: tr('Drag to move', 'ลากเพื่อย้าย'), text: tr('Tap to select. While you drag, the view turns to look from above. Things can’t overlap or go through walls.', 'แตะเพื่อเลือก ขณะลากจะเปลี่ยนเป็นมุมบนให้วางง่าย ของจะไม่ซ้อนกันและไม่ทะลุผนัง') },
  { icon: <LayersIcon className="size-10" />, title: tr('Turn and look inside', 'หมุนและดูข้างใน'), text: tr('Turn the land to any side, and open a floor to rearrange the rooms.', 'หมุนที่ดินได้ 4 ด้าน และเปิดดูแต่ละชั้นเพื่อจัดห้อง') },
];

export default function Simulator() {
  const lang = useLang();
  useEffect(() => { worldRef.current?.relabel(); }, [lang]);
  const [collide, setCollideState] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<SimWorld | null>(null);
  const history = useRef<{ list: string[]; i: number }>({ list: [], i: -1 });
  const restoring = useRef(false);
  const saveTimer = useRef(0);
  const hintTimer = useRef(0);

  const [noGL, setNoGL] = useState(false);
  const [view, setViewState] = useState<View>('iso');
  const [topFloor, setTopFloorState] = useState<TopFloor>(0);
  const [maxFloors, setMaxFloors] = useState(2);
  const [plot, setPlotState] = useState<Plot>({ w: 12, d: 9 });
  const [snap, setSnapState] = useState(0.5);
  const [facing, setFacing] = useState(0);
  const [selId, setSelId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [hint, setHint] = useState('');
  const [undoState, setUndoState] = useState({ undo: false, redo: false });
  const [ghost, setGhost] = useState<{ x: number; y: number; card: Card } | null>(null);
  const [designs] = useState(() => (typeof window === 'undefined' ? [] : listDesigns()));
  const [cat, setCat] = useState(0);
  const [menu, setMenu] = useState<null | 'plot' | 'more'>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [tour, setTour] = useState<number | null>(() => (seen() ? null : 0));
  const [sheetOpen, setSheetOpen] = useState(true);
  const [sheetH, setSheetH] = useState(0);
  useEffect(() => {
    const el = document.getElementById('sim-sheet');
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const visible = window.innerWidth < 1024 ? (sheetOpen ? el.offsetHeight : 56) : 0;
      setSheetH(visible);
      if (worldRef.current) worldRef.current.insetBottom = visible;
    });
    ro.observe(el); ro.observe(document.body);
    return () => ro.disconnect();
  }, [sheetOpen]);

  const showHint = useCallback((m: string) => { setHint(m); window.clearTimeout(hintTimer.current); hintTimer.current = window.setTimeout(() => setHint(''), 2600); }, []);

  const record = useCallback(() => {
    const w = worldRef.current;
    if (!w || restoring.current) return;
    const json = JSON.stringify(w.toScene());
    const h = history.current;
    if (h.list[h.i] === json) return;
    h.list = h.list.slice(0, h.i + 1); h.list.push(json);
    if (h.list.length > 60) h.list.shift();
    h.i = h.list.length - 1;
    setUndoState({ undo: h.i > 0, redo: false });
    setPlotState({ ...w.plot }); setMaxFloors(w.maxFloors()); setTick((t) => t + 1);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { try { localStorage.setItem(STORAGE_KEY, json); } catch { /* storage full or blocked */ } }, 400);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current, labels = labelsRef.current;
    if (!canvas || !labels) return;
    if (!webglOK()) { setNoGL(true); return; }
    const world = new SimWorld(canvas, labels, {
      onSelect: (id) => { setSelId(id); if (id) setSheetOpen(true); },
      onChange: () => record(),
      onHint: showHint,
      onView: (v) => setViewState(v),
    }, toolbarRef.current ?? undefined);
    worldRef.current = world;
    const handoff = presetFromUrl() ?? takeHandoff();
    if (handoff) { world.load({ plot: { w: handoff.site.plotW, d: handoff.site.plotD }, objects: placedHouse(handoff) }); showHint(tr(`“${handoff.name}” is on its land`, `วาง “${handoff.name}” บนที่ดินแล้ว`)); }
    else world.load(loadSaved() ?? defaultScene());
    setPlotState({ ...world.plot });
    record();
    return () => { world.dispose(); worldRef.current = null; };
  }, [record, showHint]);

  const w = () => worldRef.current;
  const setView = (v: View) => { w()?.setView(v); setViewState(v); };
  const setTopFloor = (f: TopFloor) => { w()?.setTopFloor(f); setTopFloorState(f); };
  const setSnap = (s: number) => { if (w()) w()!.snap = s; setSnapState(s); };
  const turn = (d: number) => { const x = w(); if (!x) return; x.turn(d); setFacing(x.facing); };
  const setPlot = (p: Plot) => w()?.setPlot(p);

  function restore(json: string) {
    const x = w(); if (!x) return;
    restoring.current = true; x.load(JSON.parse(json), true); restoring.current = false;
    setPlotState({ ...x.plot }); setMaxFloors(x.maxFloors());
    try { localStorage.setItem(STORAGE_KEY, json); } catch { /* ignore */ }
  }
  const undo = () => { const h = history.current; if (h.i <= 0) return; h.i--; restore(h.list[h.i]); setUndoState({ undo: h.i > 0, redo: true }); };
  const redo = () => { const h = history.current; if (h.i >= h.list.length - 1) return; h.i++; restore(h.list[h.i]); setUndoState({ undo: true, redo: h.i < h.list.length - 1 }); };

  /* ---------- catalogue ---------- */
  const houseCard = (key: string, label: string, spec: HouseSpec): Card => ({ key, label, make: () => ({ kind: 'house', rot: 0, props: { spec } }), thumb: () => houseThumb(key, spec, 200, 160) });
  const SHORT: Record<string, [string, string]> = { 'People and pets': ['People', 'คน/สัตว์'], 'Living and dining': ['Living', 'นั่งเล่น'], 'Bedroom and office': ['Bedroom', 'ห้องนอน'], 'Kitchen, bath and utility': ['Kitchen', 'ครัว/น้ำ'], 'Garden and outdoor': ['Garden', 'สวน'] };
  const groups: Group[] = [
    { title: tr('Houses', 'บ้าน'), short: tr('Houses', 'บ้าน'), cards: HOUSE_PRESETS.map((p) => houseCard(p.id, t(p.name), presetSpec(p.id))) },
    ...(designs.length ? [{ title: tr('My designs', 'แบบของฉัน'), short: tr('Mine', 'ของฉัน'), cards: designs.map((d) => houseCard(`my-${d.id}-${d.savedAt}`, d.name, d.spec)) }] : []),
    ...CATALOG.map((g) => ({ title: t(g.title), icon: g.title, short: SHORT[g.title] ? tr(...SHORT[g.title]) : g.title, cards: g.items.map((it: CatalogItem) => ({ ...it, label: t(it.label), thumb: () => itemThumb(it.key, it.make) })) })),
  ];
  const group = groups[Math.min(cat, groups.length - 1)];

  function addCenter(card: Card) { const x = w(); if (!x) return; if (x.view !== 'top') setView('top'); x.add(card.make()); showHint(tr(`${card.label} added. Drag it into place.`, `เพิ่ม${card.label}แล้ว ลากไปวางได้เลย`)); }
  function startCardDrag(e: RPE, card: Card) {
    if (e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY;
    let started = false, spawned = false;
    document.body.style.userSelect = 'none';
    const onMove = (ev: PointerEvent) => {
      const x = worldRef.current, c = canvasRef.current;
      if (!x || !c) return;
      if (!started && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) started = true;
      if (!started) return;
      const r = c.getBoundingClientRect();
      const sheet = document.getElementById('sim-sheet')?.getBoundingClientRect();
      const overSheet = sheet && window.innerWidth < 1024 && ev.clientY > sheet.top;
      const inside = !overSheet && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      if (inside && !spawned) {
        if (x.view !== 'top') { x.setView('top'); setViewState('top'); }
        spawned = x.spawnAt(card.make(), ev.clientX, ev.clientY);
      } else if (spawned) x.dragExternal(ev.clientX, ev.clientY);
      setGhost(spawned ? null : { x: ev.clientX, y: ev.clientY, card });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
      document.body.style.userSelect = '';
      setGhost(null);
      const x = worldRef.current;
      if (!x) return;
      if (spawned) x.endExternal();
      else if (!started) addCenter(card);
    };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
  }

  function exportJson() {
    const x = w(); if (!x) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(x.toScene(), null, 2)], { type: 'application/json' })); a.download = 'my-plot.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); setMenu(null);
  }
  function importJson(file: File) {
    file.text().then((t) => { const o = JSON.parse(t); if (!o?.plot || !Array.isArray(o.objects)) throw new Error('bad'); w()?.load(o); record(); showHint(tr('Plot imported', 'นำเข้าแปลงแล้ว')); })
      .catch(() => showHint(tr('That file is not a saved plot', 'ไฟล์นี้ไม่ใช่แปลงที่บันทึกไว้'))); setMenu(null);
  }
  function reset() { w()?.load(defaultScene()); record(); setConfirmReset(false); setMenu(null); showHint(tr('Started over', 'เริ่มใหม่แล้ว')); }
  function editInBuilder(o: SimObject) { saveDraft({ ...o.props.spec, site: { ...o.props.spec.site, plotW: plot.w, plotD: plot.d } }); window.location.href = '/builder'; }
  function endTour() { setTour(null); try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* ignore */ } }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      const x = worldRef.current; if (!x) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); if (x.selected) x.duplicate(x.selected); return; }
      if (mod) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && x.selected) { e.preventDefault(); x.remove(x.selected); }
      else if (e.key.toLowerCase() === 'r') x.rotateSelected(e.shiftKey ? -1 : 1);
      else if (e.key.toLowerCase() === 't') setView(x.view === 'top' ? 'iso' : 'top');
      else if (e.key === 'Escape') { x.select(null); setMenu(null); }
      else if (e.key.startsWith('Arrow') && x.selected && x.view === 'top') { e.preventDefault(); x.nudge(e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0, e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const world = worldRef.current;
  const sel = selId && world ? world.get(selId) : undefined;
  const info = selId && world ? world.describe(selId) : null;
  const area = areaText(plot);
  const edit = (props: Record<string, any>) => { if (selId) w()?.update(selId, props); };
  const floorTabs: [TopFloor, string][] = [['x', tr('Roof', 'หลังคา')], ...Array.from({ length: maxFloors }, (_, i) => [i, `F${i + 1}`] as [TopFloor, string])];
  const pad = { paddingLeft: 'max(12px, env(safe-area-inset-left))', paddingRight: 'max(12px, env(safe-area-inset-right))' };

  /* ---------- pieces ---------- */
  const catTabs = (
    <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0" role="tablist" aria-label={tr('Catalogue', 'รายการ')}>
      {groups.map((g, i) => (
        <button key={g.title} type="button" role="tab" aria-selected={i === cat} onClick={() => setCat(i)}
          className={`press flex flex-none cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition-colors lg:flex-col lg:gap-0.5 lg:rounded-xl lg:px-1 lg:py-2 lg:text-[10px] ${i === cat ? 'bg-btn text-btn-ink' : 'text-muted hover:bg-soft'}`}>
          <CatIcon name={g.icon ?? (i === 0 ? 'Houses' : 'My designs')} className="size-5" />{g.short}
        </button>
      ))}
    </div>
  );
  const cards = (
    <div key={group.title} className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-2 lg:content-start lg:overflow-visible">
      {group.cards.map((c, i) => (
        <button key={c.key} type="button" onPointerDown={(e) => startCardDrag(e, c)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addCenter(c); } }}
          style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
          className="animate-pop-in lift grid w-24 flex-none cursor-grab touch-none gap-0.5 rounded-xl border-[1.5px] border-line bg-card p-1.5 text-center text-[11px] leading-tight font-semibold select-none hover:border-ink active:cursor-grabbing lg:w-auto">
          <CardThumb card={c} />
          <span className="line-clamp-2 min-h-[2lh]">{c.label}</span>
        </button>
      ))}
    </div>
  );
  const inspector = sel && info && (
    <div key={sel.id} className="animate-slide-left grid gap-4">
      <div className="flex items-start gap-3">
        <div className="mr-auto min-w-0">
          <h2 className="truncate text-lg font-bold">{kindLabel(sel)}</h2>
          <p className="text-xs font-semibold text-muted">{info.where} · {info.sizeX.toFixed(1)} × {info.sizeZ.toFixed(1)} {tr('m', 'ม.')}</p>
        </div>
        <button type="button" className="icon-btn size-9 flex-none" aria-label={tr('Close', 'ปิด')} onClick={() => w()?.select(null)}><CloseIcon className="size-4" /></button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[[tr('Turn', 'หมุน'), <TurnLeft key="a" className="size-5" />, () => w()?.rotateSelected(-1)], [tr('Turn', 'หมุน'), <TurnRight key="b" className="size-5" />, () => w()?.rotateSelected(1)],
          [tr('Copy', 'คัดลอก'), <CopyIcon key="c" className="size-5" />, () => selId && w()?.duplicate(selId)], [tr('Delete', 'ลบ'), <TrashIcon key="d" className="size-5 text-[#D0453A]" />, () => selId && w()?.remove(selId)]].map(([l, ic, fn], i) => (
          <button key={i} type="button" className="tile py-2" onClick={fn as () => void}>{ic as ReactNode}<span>{l as string}</span></button>
        ))}
      </div>
      {(sel.kind === 'person' || sel.kind === 'dog' || sel.kind === 'cat') && (
        <Field title={tr('Name', 'ชื่อ')}>
          <input key={sel.id} defaultValue={sel.props.name} maxLength={24} onBlur={(e) => edit({ name: e.target.value.trim() })} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-full rounded-xl border-[1.5px] border-line bg-card px-3 py-2 text-sm font-semibold" aria-label={tr('Name', 'ชื่อ')} />
        </Field>
      )}
      {sel.kind === 'person' && (<>
        <Field title={tr('Height', 'ส่วนสูง')}>
          <div className="flex items-end gap-3">
            <div className="flex h-16 items-end gap-1" aria-hidden="true">
              <span className="block w-3 rounded-t-full bg-accent transition-[height] duration-300" style={{ height: `${(sel.props.height / 220) * 64}px` }} />
              <span className="block h-[49px] w-3 rounded-t-full bg-line" title="170 cm" />
            </div>
            <div className="grid flex-1 gap-1">
              <b className="text-2xl tabular-nums">{sel.props.height}<span className="ml-1 text-sm text-muted">{tr('cm', 'ซม.')}</span></b>
              <input type="range" min={60} max={220} step={1} value={sel.props.height} onChange={(e) => edit({ height: Number(e.target.value) })} className="w-full accent-accent" aria-label={tr('Height in centimetres', 'ส่วนสูง (ซม.)')} />
            </div>
          </div>
        </Field>
        <Field title={tr('Shirt', 'สีเสื้อ')}><Swatches label={tr('Shirt colour', 'สีเสื้อ')} list={SHIRTS.map((c) => [c, c])} value={sel.props.shirt} onPick={(v) => edit({ shirt: v })} /></Field>
      </>)}
      {sel.kind === 'dog' && (<>
        <Field title={tr('Size', 'ขนาด')}>
          <div className="grid grid-cols-3 gap-1.5">{[['s', tr('Small', 'เล็ก'), 18], ['m', tr('Medium', 'กลาง'), 24], ['l', tr('Large', 'ใหญ่'), 30]].map(([v, l, px]) => (
            <button key={v as string} type="button" className="tile py-2" aria-pressed={sel.props.size === v} onClick={() => edit({ size: v })}><CatIcon name="People and pets" style={{ width: px as number, height: px as number }} /><span>{l as string}</span></button>
          ))}</div>
        </Field>
        <Field title={tr('Coat', 'สีขน')}><Swatches label={tr('Coat colour', 'สีขน')} list={DOG_COATS} value={sel.props.coat} onPick={(v) => edit({ coat: v })} /></Field>
      </>)}
      {sel.kind === 'cat' && <Field title={tr('Coat', 'สีขน')}><Swatches label={tr('Coat colour', 'สีขน')} list={CAT_COATS} value={sel.props.coat} onPick={(v) => edit({ coat: v })} /></Field>}
      {sel.kind === 'car' && <Field title={tr('Colour', 'สี')}><Swatches label={tr('Car colour', 'สีรถ')} list={CAR_COLORS} value={sel.props.color} onPick={(v) => edit({ color: v })} /></Field>}
      {sel.kind === 'tree' && <Field title={tr('Size', 'ขนาด')}><input type="range" min={0.6} max={1.8} step={0.05} value={sel.props.scale} onChange={(e) => edit({ scale: Number(e.target.value) })} className="w-full accent-accent" aria-label={tr('Tree size', 'ขนาดต้นไม้')} /></Field>}
      {sel.kind === 'house' && (() => {
        const sp = sel.props.spec as HouseSpec;
        return (<>
          <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
            <span className="chip pointer-events-none">{t(styleById(sp.styleId).name)}</span>
            <span className="chip pointer-events-none">{sp.w} × {sp.d} m</span>
            <span className="chip pointer-events-none">{tr(`${sp.floors} floor${sp.floors > 1 ? 's' : ''}`, `${sp.floors} ชั้น`)}</span>
          </div>
          <button type="button" className="btn press" onClick={() => editInBuilder(sel)}>{tr('Edit rooms', 'แก้ไขห้อง')}<ArrowRight className="size-4" /></button>
          <Field title={tr('Swap design', 'เปลี่ยนแบบบ้าน')}>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[...HOUSE_PRESETS.map((p) => [p.id, t(p.name), presetSpec(p.id)] as const), ...designs.map((d) => [`my-${d.id}-${d.savedAt}`, d.name, d.spec] as const)].map(([k, l, s]) => (
                <button key={k} type="button" className="lift w-24 flex-none cursor-pointer rounded-xl border-[1.5px] border-line p-1 text-[10.5px] font-semibold hover:border-ink" onClick={() => selId && w()?.setHouseSpec(selId, s)}>
                  <CardThumb card={houseCard(k, l, s)} />{l}
                </button>
              ))}
            </div>
          </Field>
        </>);
      })()}
      {sel.kind === 'furn' && (sel.props.type === 'kitchen' || sel.props.type === 'bathroom') && ['counter', 'tub', 'vanity'].includes(sel.props.item) && (
        <Field title={sel.props.type === 'kitchen' ? tr('Kitchen layout', 'รูปแบบครัว') : tr('Bathroom layout', 'รูปแบบห้องน้ำ')}>
          <div className="flex flex-wrap gap-1.5">
            {(VARIANTS[sel.props.type as 'kitchen'] ?? []).map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={(sel.props.variant ?? VARIANTS[sel.props.type as 'kitchen']![0][0]) === k} onClick={() => edit({ variant: k })}>{t(l)}</button>)}
          </div>
        </Field>
      )}
      {sel.kind === 'furn' && <p className="flex items-start gap-2 rounded-xl bg-soft p-3 text-xs text-muted"><InfoIcon className="size-4 flex-none" />{tr('Drag it into a house to put it on the open floor, or out into the garden.', 'ลากเข้าบ้านเพื่อวางบนชั้นที่เปิดอยู่ หรือลากออกไปที่สวน')}</p>}
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-ink">
      {/* header */}
      <header className="relative z-40 flex items-center gap-2 border-b border-line bg-bg py-2" style={pad}>
        <a href="/" aria-label="ClovedBuild" className="animate-header-rise inline-flex flex-none no-underline will-change-transform"><LogoPill compact /></a>
        <button type="button" className="chip ml-1 min-w-0" aria-expanded={menu === 'plot'} onClick={() => setMenu(menu === 'plot' ? null : 'plot')}>
          <MapIcon className="size-4 flex-none" /><span className="whitespace-nowrap tabular-nums">{plot.w}×{plot.d}<span className="hidden sm:inline"> {tr('wah', 'วา')}</span></span><span className="hidden text-muted md:inline">· {area.sqw} {tr('sq. wah', 'ตร.ว.')}</span>
        </button>
        <div className="animate-nav-fade ml-auto flex flex-none items-center gap-1.5">
          <LangToggle className="max-[380px]:hidden" />
          <button type="button" className="icon-btn size-9" aria-label={tr('Undo', 'เลิกทำ')} onClick={undo} disabled={!undoState.undo}><UndoIcon className="size-4" /></button>
          <button type="button" className="icon-btn size-9" aria-label={tr('Redo', 'ทำซ้ำ')} onClick={redo} disabled={!undoState.redo}><RedoIcon className="size-4" /></button>
          <button type="button" className="icon-btn size-9 max-sm:hidden" aria-label={tr('How it works', 'วิธีใช้')} onClick={() => setTour(0)}><InfoIcon className="size-4" /></button>
          <a href="/builder" className="btn press px-3 py-2 text-xs sm:hidden" aria-label={tr('Design a house', 'ออกแบบบ้าน')}><StepIcon step="house" className="tilt-ico size-4" /></a>
          <SlideButton small href="/builder" className="max-sm:hidden" icon={<StepIcon step="house" />}>{tr('Design a house', 'ออกแบบบ้าน')}</SlideButton>
          <button type="button" className="icon-btn size-9" aria-label={tr('More', 'เพิ่มเติม')} aria-expanded={menu === 'more'} onClick={() => setMenu(menu === 'more' ? null : 'more')}><span className="text-lg leading-none">⋯</span></button>
        </div>
        {menu === 'plot' && (
          <div className="animate-pop-in absolute top-full left-3 z-50 mt-2 grid w-[min(92vw,320px)] gap-3 rounded-2xl bg-card p-4 shadow-soft">
            <b className="text-sm">{tr('Land size', 'ขนาดที่ดิน')}</b>
            {(['w', 'd'] as const).map((k) => (
              <div key={k} className="flex items-center justify-between gap-2 rounded-xl bg-soft p-1.5">
                <span className="pl-2 text-xs font-semibold text-muted">{k === 'w' ? tr('Width', 'กว้าง') : tr('Depth', 'ลึก')}</span>
                <div className="flex items-center gap-1">
                  <button type="button" className="icon-btn size-9 shadow-none" aria-label="−" onClick={() => setPlot({ ...plot, [k]: plot[k] - 1 })}><MinusIcon className="size-4" /></button>
                  <span className="min-w-16 text-center text-base font-bold tabular-nums">{plot[k]}<span className="ml-0.5 text-[11px] text-muted">{tr('wah', 'วา')}</span></span>
                  <button type="button" className="icon-btn size-9 shadow-none" aria-label="+" onClick={() => setPlot({ ...plot, [k]: plot[k] + 1 })}><PlusIcon className="size-4" /></button>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted tabular-nums">{tr(`${area.sqw} sq. wah · ${area.thai} · ${area.m2.toLocaleString('en-US')} m². One grid square is 1 sq. wah (2 × 2 m).`, `${area.sqw} ตร.ว. · ${area.thai} · ${area.m2.toLocaleString('en-US')} ตร.ม. ช่องตาราง 1 ช่อง = 1 ตร.ว. (2 × 2 ม.)`)}</p>
          </div>
        )}
        {menu === 'more' && (
          <div className="animate-pop-in absolute top-full right-3 z-50 mt-2 grid w-56 gap-1 rounded-2xl bg-card p-2 shadow-soft">
            <button type="button" className="rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-soft sm:hidden" onClick={() => { setMenu(null); setTour(0); }}>{tr('How it works', 'วิธีใช้')}</button>
            <button type="button" className="rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-soft" onClick={exportJson}>{tr('Export plot file', 'ส่งออกไฟล์แปลง')}</button>
            <label className="cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold hover:bg-soft">{tr('Import plot file', 'นำเข้าไฟล์แปลง')}<input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} /></label>
            {confirmReset
              ? <button type="button" className="rounded-lg bg-[#D0453A]/10 px-3 py-2 text-left text-sm font-bold text-[#B03A30]" onClick={reset}>{tr('Tap again to start over', 'แตะอีกครั้งเพื่อเริ่มใหม่')}</button>
              : <button type="button" className="rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-soft" onClick={() => setConfirmReset(true)}>{tr('Start over', 'เริ่มใหม่')}</button>}
          </div>
        )}
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* desktop catalogue */}
        <aside style={{ ['--d' as string]: '300ms' }} className="enter hidden w-[300px] flex-none border-r border-line bg-card lg:flex" aria-label={tr('Add things', 'เพิ่มของ')}>
          <div className="w-[68px] flex-none overflow-y-auto border-r border-line p-1.5">{catTabs}</div>
          <div className="grid flex-1 content-start gap-2 overflow-y-auto p-3">
            <h3 className="text-sm font-bold">{group.title}</h3>
            <p className="text-[11px] text-muted">{tr('Drag onto the land, or tap.', 'ลากลงที่ดิน หรือแตะ')}</p>
            {cards}
          </div>
        </aside>

        {/* canvas */}
        <main className="relative min-w-0 flex-1 bg-soft" onPointerDown={() => menu && setMenu(null)}>
          {noGL ? <div className="grid h-full place-items-center p-6 text-center font-semibold text-muted">{tr('The simulator needs WebGL, which this browser does not offer.', 'ซิมูเลเตอร์ต้องใช้ WebGL ซึ่งเบราว์เซอร์นี้ไม่รองรับ')}</div>
            : <canvas ref={canvasRef} className="absolute inset-0 block size-full touch-none" aria-label={tr('Your land. Drag things to move them.', 'ที่ดินของคุณ ลากของเพื่อย้าย')} />}
          <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
          <div ref={toolbarRef} hidden className="animate-pop-in absolute top-0 left-0 z-10 flex gap-0.5 rounded-full bg-ink p-1 shadow-soft">
            {[[tr('Turn left', 'หมุนซ้าย'), () => w()?.rotateSelected(-1), <TurnLeft key="l" className="size-4" />], [tr('Turn right', 'หมุนขวา'), () => w()?.rotateSelected(1), <TurnRight key="r" className="size-4" />],
              [tr('Copy', 'คัดลอก'), () => w()?.selected && w()!.duplicate(w()!.selected!), <CopyIcon key="d" className="size-4" />], [tr('Delete', 'ลบ'), () => w()?.selected && w()!.remove(w()!.selected!), <TrashIcon key="x" className="size-4" />]].map(([label, fn, icon]) => (
              <button key={label as string} type="button" title={label as string} aria-label={label as string} onClick={fn as () => void} className="press grid size-9 cursor-pointer place-items-center rounded-full text-bg hover:bg-white/15">{icon as ReactNode}</button>
            ))}
          </div>

          {/* view controls */}
          <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-2">
            <div className="glass flex rounded-full p-1 shadow-soft" role="group" aria-label={tr('View', 'มุมมอง')}>
              <button type="button" aria-pressed={view === 'iso'} onClick={() => setView('iso')} className={`press flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${view === 'iso' ? 'bg-btn text-btn-ink' : 'text-muted'}`}><CubeIcon className="size-4" />3D</button>
              <button type="button" aria-pressed={view === 'top'} onClick={() => setView('top')} className={`press flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${view === 'top' ? 'bg-btn text-btn-ink' : 'text-muted'}`}><MapIcon className="size-4" />{tr('Top', 'มุมบน')}</button>
            </div>
            {view === 'top' && (
              <div className="glass animate-fade-up flex rounded-full p-1 shadow-soft" role="group" aria-label={tr('Floor shown from above', 'ชั้นที่แสดงจากด้านบน')}>
                {floorTabs.map(([f, l]) => <button key={String(f)} type="button" aria-pressed={topFloor === f} onClick={() => setTopFloor(f)} className={`press cursor-pointer rounded-full px-2.5 py-1.5 text-xs font-bold ${topFloor === f ? 'bg-accent text-white' : 'text-muted'}`}>{l}</button>)}
              </div>
            )}
            {view === 'top' && (
              <div className="glass animate-fade-up flex items-center rounded-full p-1 text-xs font-bold shadow-soft" role="group" aria-label={tr('Snap to grid', 'จัดตามตาราง')}>
                <span className="px-2 text-muted">{tr('Snap', 'จัดแนว')}</span>
                {SNAPS.map(([v, en, th]) => <button key={en} type="button" aria-pressed={snap === v} onClick={() => setSnap(v)} className={`press cursor-pointer rounded-full px-2.5 py-1.5 ${snap === v ? 'bg-btn text-btn-ink' : 'text-muted'}`}>{tr(en, th)}</button>)}
                <span className="mx-1 h-4 w-px bg-line" />
                <button type="button" aria-pressed={collide} title={tr('Stop things overlapping or passing through walls', 'กันของซ้อนกันและทะลุผนัง')} onClick={() => { const v = !collide; setCollideState(v); if (w()) w()!.collide = v; showHint(v ? tr('Collision on: no overlapping', 'เปิดระบบกันชน: ของไม่ซ้อนกัน') : tr('Collision off: place anywhere', 'ปิดระบบกันชน: วางทับกันได้')); }}
                  className={`press flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1.5 ${collide ? 'bg-accent text-white' : 'text-muted'}`}>
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="1.5" y="4" width="6" height="8" rx="1" /><rect x="8.5" y="4" width="6" height="8" rx="1" /></svg>{tr('Bump', 'กันชน')}
                </button>
              </div>
            )}
          </div>
          <div className="absolute right-3 z-20 flex flex-col gap-2 transition-[bottom] duration-300" style={{ bottom: sheetH + 12 }} hidden={sheetH > 320}>
            <button type="button" className="icon-btn" aria-label={tr('Zoom in', 'ซูมเข้า')} onClick={() => w()?.zoomBy(1.25)}><PlusIcon className="size-5" /></button>
            <button type="button" className="icon-btn" aria-label={tr('Zoom out', 'ซูมออก')} onClick={() => w()?.zoomBy(1 / 1.25)}><MinusIcon className="size-5" /></button>
            <button type="button" className="icon-btn" aria-label={tr('Fit the land', 'พอดีจอ')} onClick={() => w()?.fit()}><FitIcon className="size-5" /></button>
            <button type="button" className="icon-btn" aria-label={tr('Turn the land left', 'หมุนที่ดินซ้าย')} onClick={() => turn(-1)}><TurnLeft className="size-5" /></button>
            <button type="button" className="icon-btn" aria-label={tr('Turn the land right', 'หมุนที่ดินขวา')} onClick={() => turn(1)}><TurnRight className="size-5" /></button>
            <div className="flex justify-center gap-1" aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} className={`h-1.5 rounded-full transition-all ${i === facing ? 'w-4 bg-accent' : 'w-1.5 bg-line'}`} />)}</div>
          </div>
          {hint && <div role="status" style={{ ['--hb' as string]: `${sheetH + 14}px` }} className="animate-pop-in pointer-events-none absolute left-1/2 z-30 max-w-[80%] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-center text-xs font-semibold text-bg shadow-soft max-lg:bottom-[var(--hb)] lg:top-3">{hint}</div>}

          {/* desktop inspector */}
          {inspector && (
            <div className="glass absolute top-3 right-16 z-20 hidden max-h-[calc(100%-24px)] w-80 overflow-y-auto rounded-2xl p-4 shadow-soft lg:block">{inspector}</div>
          )}
        </main>

        {/* mobile bottom sheet */}
        <div id="sim-sheet" className={`sheet animate-slide-up absolute inset-x-0 bottom-0 z-30 flex max-h-[62dvh] flex-col transition-transform duration-300 lg:hidden ${sheetOpen ? '' : 'translate-y-[calc(100%-56px)]'}`}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <button type="button" className="mx-auto grid h-7 w-full cursor-pointer place-items-center" aria-label={sheetOpen ? tr('Hide panel', 'ซ่อนแผง') : tr('Show panel', 'แสดงแผง')} onClick={() => setSheetOpen((o) => !o)}>
            <span className="block h-1.5 w-12 rounded-full bg-line" />
          </button>
          <div className="min-h-0 overflow-y-auto px-3 pb-3">
            {inspector ?? (<div className="grid gap-2">{catTabs}{cards}</div>)}
          </div>
        </div>
      </div>

      {/* onboarding */}
      {tour !== null && (
        <div className="animate-fade-in fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={tr('How the simulator works', 'วิธีใช้ซิมูเลเตอร์')}>
          <div key={tour} className="animate-pop-in grid w-full max-w-sm gap-4 rounded-3xl bg-card p-6 text-center shadow-soft">
            <span className="mx-auto grid size-20 place-items-center rounded-full bg-accent/15 text-accent">{TOUR()[tour].icon}</span>
            <div className="grid gap-1"><b className="text-lg">{TOUR()[tour].title}</b><p className="text-sm text-muted">{TOUR()[tour].text}</p></div>
            <div className="flex justify-center gap-1.5" aria-hidden="true">{TOUR().map((_, i) => <i key={i} className={`h-2 rounded-full transition-all ${i === tour ? 'w-6 bg-accent' : 'w-2 bg-line'}`} />)}</div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-ghost press" onClick={endTour}>{tr('Skip', 'ข้าม')}</button>
              <button type="button" className="btn press" onClick={() => (tour < TOUR().length - 1 ? setTour(tour + 1) : endTour())}>{tour < TOUR().length - 1 ? tr('Next', 'ถัดไป') : tr('Start', 'เริ่มเลย')}</button>
            </div>
          </div>
        </div>
      )}

      {ghost && (
        <div className="pointer-events-none fixed z-50 w-24 rotate-[-4deg] rounded-xl border-2 border-accent bg-card p-1 text-center text-[10px] font-bold shadow-soft" style={{ left: ghost.x, top: ghost.y, transform: 'translate(-50%, -60%) rotate(-4deg)' }}>
          <CardThumb card={ghost.card} />{ghost.card.label}
        </div>
      )}
    </div>
  );
}
