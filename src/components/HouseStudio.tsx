import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import * as THREE from 'three';
import {
  EXT, FINS, PAINTS, PLAN, PRESETS, TYPES, allItems, cloneDesign, metrics, money, roomDef,
  type Design, type FloorKey, type Garden, type RoomType, type ViewMode,
} from '../lib/house/data';
import { Stage, webglOK } from '../lib/house/stage';
import type { Marker } from '../lib/house/geometry';
import { onLoadPreset, prefersReducedMotion } from '../lib/events';
import { TurnLeft, TurnRight } from './icons';
import { useT } from '../lib/i18n';
import { Spring } from '../lib/motion';

const SIDES = [['Front', 'หน้า'], ['Right', 'ขวา'], ['Back', 'หลัง'], ['Left', 'ซ้าย']];
const STORAGE_KEY = 'dream-home-studio-v2';

export default function HouseStudio() {
  const { tr, t } = useT();
  const [design, setDesign] = useState<Design>(() => cloneDesign(PRESETS.santorini));
  const [mode, setMode] = useState<ViewMode>('x');
  const [sel, setSel] = useState<Record<FloorKey, string>>({ g: 'g1', u: 'u1' });
  const [rot, setRot] = useState(0);
  const [labels, setLabels] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [noGL, setNoGL] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const labelEls = useRef(new Map<string, HTMLButtonElement>());
  const dirty = useRef(true);
  const spin = useRef(new Spring(0));
  const rotRef = useRef(0);

  /* create the renderer and the draw loop */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!webglOK()) { setNoGL(true); return; }
    const stage = new Stage(canvas);
    stageRef.current = stage;
    const v = new THREE.Vector3();
    let raf = 0, last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = last ? (now - last) / 1000 : 1 / 60;
      last = now;
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (!W || !H || !stage.diorama) return;
      if (stage.size(W, H)) dirty.current = true;
      if (spin.current.step(dt)) { stage.holder.rotation.y = spin.current.x; dirty.current = true; }
      if (!dirty.current) return;
      stage.render();
      for (const m of markersRef.current) {
        const el = labelEls.current.get(m.id);
        if (!el) continue;
        m.obj.getWorldPosition(v).project(stage.cam);
        el.style.left = `${((v.x + 1) / 2) * W}px`;
        el.style.top = `${((1 - v.y) / 2) * H}px`;
      }
      dirty.current = false;
    };
    // Only draw while the 3D view is on screen; scrolling past it costs nothing.
    let onScreen = true;
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(([en]) => {
      onScreen = en.isIntersecting;
      cancelAnimationFrame(raf); raf = 0; last = 0;
      if (onScreen) { dirty.current = true; raf = requestAnimationFrame(loop); }
    }, { rootMargin: '120px' }) : null;
    io?.observe(canvas);
    raf = requestAnimationFrame(loop);
    return () => { io?.disconnect(); cancelAnimationFrame(raf); stage.dispose(); stageRef.current = null; };
  }, []);

  /* rebuild the model whenever the design, the view or the selected room changes */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const d = stage.set(design, mode, mode === 'x' ? null : sel[mode]);
    stage.focus = mode === 'x' ? null : mode;
    markersRef.current = d.userData.markers as Marker[];
    setLabels(markersRef.current.map((m) => m.id));
    dirty.current = true;
  }, [design, mode, sel, noGL]);

  const loadPreset = useCallback((k: string) => {
    setDesign(cloneDesign(PRESETS[k]));
    setSel({ g: 'g1', u: 'u1' });
    setStatus(`${PRESETS[k].name} loaded.`);
  }, []);
  useEffect(() => onLoadPreset(loadPreset), [loadPreset]);

  function turn(step: number) {
    const stage = stageRef.current;
    rotRef.current += step;
    setRot(rotRef.current);
    if (!stage) return;
    const to = (rotRef.current * Math.PI) / 2;
    if (prefersReducedMotion()) { spin.current.snap(to); stage.holder.rotation.y = to; dirty.current = true; }
    else spin.current.set(to);
  }

  function pickRoom(id: string) {
    const f = id.charAt(0) as FloorKey;
    setSel((s) => ({ ...s, [f]: id }));
    setMode(f);
    setStatus(tr(`${TYPES[design.rooms[id].type].label} selected.`, `เลือก${t(TYPES[design.rooms[id].type].label)}แล้ว`));
  }

  /* swipe turns the house 90 degrees, a tap selects the room under the finger */
  const down = useRef<{ x: number; y: number } | null>(null);
  function onPointerUp(e: RPointerEvent<HTMLCanvasElement>) {
    const start = down.current; down.current = null;
    const stage = stageRef.current;
    if (!start || !stage?.diorama) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { turn(dx > 0 ? 1 : -1); return; }
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) return;
    const rc = e.currentTarget.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1), stage.cam);
    for (const hit of ray.intersectObject(stage.diorama, true)) {
      let o: THREE.Object3D | null = hit.object;
      while (o && !o.userData.roomId) o = o.parent;
      if (o) { pickRoom(o.userData.roomId); return; }
    }
  }

  /* design edits */
  const setExt = (k: keyof Design['ext'], v: string) => setDesign((d) => ({ ...d, ext: { ...d.ext, [k]: v } }));
  const roomId = mode === 'x' ? null : sel[mode];
  const room = roomId ? design.rooms[roomId] : null;
  const editRoom = (patch: Partial<Design['rooms'][string]>) => {
    if (!roomId) return;
    setDesign((d) => ({ ...d, rooms: { ...d.rooms, [roomId]: { ...d.rooms[roomId], ...patch } } }));
  };
  const toggleItem = (k: string, on: boolean) => {
    if (!room) return;
    editRoom({ items: on ? [...room.items, k] : room.items.filter((i) => i !== k) });
  };

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(design)); setStatus(tr('Design saved in this browser.', 'บันทึกแบบไว้ในเบราว์เซอร์นี้แล้ว')); }
    catch { setStatus(tr('Saving is not available in this browser.', 'เบราว์เซอร์นี้บันทึกไม่ได้')); }
  }
  function load() {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (!s) { setStatus(tr('No saved design yet.', 'ยังไม่มีแบบที่บันทึกไว้')); return; }
      const o = JSON.parse(s);
      if (!o?.rooms || !o?.ext) throw new Error('bad data');
      setDesign(o); setStatus(tr('Saved design loaded.', 'โหลดแบบที่บันทึกไว้แล้ว'));
    } catch { setStatus(tr('Could not read the saved design.', 'อ่านแบบที่บันทึกไว้ไม่ได้')); }
  }

  const k = ((rot % 4) + 4) % 4;
  const facing = tr(`${SIDES[(4 - k) % 4][0]} and ${SIDES[(5 - k) % 4][0].toLowerCase()} side`, `ด้าน${SIDES[(4 - k) % 4][1]}และด้าน${SIDES[(5 - k) % 4][1]}`);
  const m = metrics(design);
  const def = roomId ? roomDef(roomId) : null;

  return (
    <div className="grid items-start gap-[22px] lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      {/* viewer */}
      <div className="relative overflow-hidden rounded-[20px] bg-soft shadow-soft">
        <div className="relative aspect-[1.2] w-full max-w-full">
          {noGL ? (
            <div className="grid h-full place-items-center p-6 text-center font-semibold text-muted">{tr('The 3D studio needs WebGL, which this browser does not offer.', 'สตูดิโอ 3 มิติต้องใช้ WebGL ซึ่งเบราว์เซอร์นี้ไม่รองรับ')}</div>
          ) : (
            <canvas
              ref={canvasRef}
              aria-label={tr('3D house. Swipe sideways or use the arrow buttons to turn it. Tap a room to edit it.', 'บ้าน 3 มิติ ปัดซ้ายขวาหรือกดลูกศรเพื่อหมุน แตะห้องเพื่อแก้ไข')}
              className="absolute inset-0 block size-full cursor-pointer touch-pan-y"
              onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY }; }}
              onPointerUp={onPointerUp}
            />
          )}
          <div className="pointer-events-none absolute inset-0">
            {labels.map((id) => (
              <button
                key={id}
                type="button"
                ref={(el) => { if (el) { labelEls.current.set(id, el); dirty.current = true; } else labelEls.current.delete(id); }}
                className="room-tag"
                aria-pressed={id === roomId}
                onClick={() => pickRoom(id)}
              >
                {t(TYPES[design.rooms[id].type].label)}
              </button>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-x-3.5 top-3.5 flex justify-between gap-2">
            <span className="rounded-full bg-card px-3 py-[5px] text-[11px] font-bold text-muted shadow-[0_2px_8px_rgb(0_0_0/0.08)]">{facing}</span>
            <span className="rounded-full bg-card px-3 py-[5px] text-[11px] font-bold text-muted shadow-[0_2px_8px_rgb(0_0_0/0.08)]">{mode === 'x' ? tr('Exterior', 'ภายนอก') : t(PLAN[mode].label)}</span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3.5 px-3 pt-3 pb-3.5">
          <button type="button" aria-label={tr('Turn the house left', 'หมุนบ้านไปทางซ้าย')} onClick={() => turn(-1)} className="grid size-11 cursor-pointer place-items-center rounded-full bg-card text-ink shadow-soft"><TurnLeft className="size-5" /></button>
          <div className="flex gap-[5px]" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => <i key={i} className={`h-[9px] rounded-full ${i === k ? 'w-[22px] bg-accent' : 'w-[9px] bg-line'}`} />)}
          </div>
          <button type="button" aria-label={tr('Turn the house right', 'หมุนบ้านไปทางขวา')} onClick={() => turn(1)} className="grid size-11 cursor-pointer place-items-center rounded-full bg-card text-ink shadow-soft"><TurnRight className="size-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4" aria-live="polite">
          {[[m.area, tr('m² inside', 'ตร.ม. ใช้สอย')], [m.beds, tr('Bedrooms', 'ห้องนอน')], [m.baths, tr('Bathrooms', 'ห้องน้ำ')], [money(m.cost), tr('Est. cost', 'งบประมาณ')]].map(([v, l]) => (
            <div key={l} className="bg-card px-2 py-3 text-center">
              <b className="block text-[17px] leading-snug font-bold tabular-nums">{v}</b>
              <span className="text-[10px] font-bold tracking-[0.07em] text-muted uppercase">{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* controls */}
      <div className="grid min-w-0 gap-5 rounded-[20px] bg-card p-[22px] shadow-soft">
        <div>
          <h3 className="panel-label">{tr('Start from', 'เริ่มจาก')}</h3>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(PRESETS).map(([key, p]) => <button key={key} type="button" className="seg-btn" onClick={() => loadPreset(key)}>{p.name}</button>)}
          </div>
        </div>
        <div>
          <h3 className="panel-label">{tr('Show', 'แสดง')}</h3>
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={tr('Show', 'แสดง')}>
            {([['x', tr('Exterior', 'ภายนอก')], ['g', tr('Ground floor', 'ชั้นล่าง')], ['u', tr('Upper floor', 'ชั้นบน')]] as [ViewMode, string][]).map(([v, l]) => (
              <button key={v} type="button" className="seg-btn px-1.5 py-2.5" aria-pressed={mode === v} onClick={() => setMode(v)}>{l}</button>
            ))}
          </div>
        </div>

        {mode === 'x' || !room || !def ? (
          <div className="grid gap-4">
            {([['wall', tr('Outside walls', 'ผนังภายนอก')], ['frame', tr('Window frames', 'กรอบหน้าต่าง')], ['wood', tr('Balcony frame', 'กรอบระเบียง')]] as const).map(([key, label]) => (
              <div key={key}>
                <h3 className="panel-label">{label}</h3>
                <div className="flex flex-wrap gap-[9px]" role="group" aria-label={label}>
                  {EXT[key].map(([n, hex]) => (
                    <button key={hex} type="button" title={t(n)} aria-label={t(n)} className="swatch" style={{ background: hex }} aria-pressed={design.ext[key] === hex} onClick={() => setExt(key, hex)} />
                  ))}
                </div>
              </div>
            ))}
            <div>
              <h3 className="panel-label">{tr('Garden', 'สวน')}</h3>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={tr('Garden', 'สวน')}>
                {(['lush', 'simple', 'minimal'] as Garden[]).map((g) => (
                  <button key={g} type="button" className="seg-btn capitalize" aria-pressed={design.ext.garden === g} onClick={() => setExt('garden', g)}>{tr(g, { lush: 'ร่มรื่น', simple: 'เรียบง่าย', minimal: 'มินิมอล' }[g])}</button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <div>
              <h3 className="panel-label">{tr('Rooms on this floor', 'ห้องในชั้นนี้')}</h3>
              <div className="flex flex-wrap gap-1.5">
                {PLAN[mode].rooms.map((r) => (
                  <button key={r.id} type="button" className="seg-btn" aria-pressed={r.id === roomId} onClick={() => pickRoom(r.id)}>{t(TYPES[design.rooms[r.id].type].label)}</button>
                ))}
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-2.5 border-t border-line pt-4">
              <h4 className="text-[17px] font-bold">{t(TYPES[room.type].label)}</h4>
              <span className="text-xs font-semibold text-muted tabular-nums">{(def.x1 - def.x0).toFixed(1)} × {(def.z1 - def.z0).toFixed(1)} m</span>
            </div>
            <div>
              <h3 className="panel-label">{tr('Room type', 'ประเภทห้อง')}</h3>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={tr('Room type', 'ประเภทห้อง')}>
                {(Object.keys(TYPES) as RoomType[]).map((ty) => (
                  <button key={ty} type="button" className="seg-btn" aria-pressed={room.type === ty} onClick={() => room.type !== ty && editRoom({ type: ty, items: allItems(ty) })}>{t(TYPES[ty].label)}</button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="panel-label">{tr('Floor', 'พื้น')}</h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-[7px]" role="group" aria-label={tr('Floor finish', 'วัสดุพื้น')}>
                {FINS.map(([key, label, hex]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={room.floor === key}
                    onClick={() => editRoom({ floor: key })}
                    className={`flex cursor-pointer items-center gap-[7px] rounded-[7px] border-[1.5px] bg-transparent px-2 py-1.5 text-left text-[11.5px] font-semibold ${room.floor === key ? 'border-accent shadow-[inset_0_0_0_1px_var(--accent)]' : 'border-line'}`}
                  >
                    <i className="size-4 flex-none rounded border border-black/10" style={{ background: hex }} />{t(label)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="panel-label">{tr('Wall paint', 'สีผนัง')}</h3>
              <div className="flex flex-wrap gap-[9px]" role="group" aria-label={tr('Wall paint', 'สีผนัง')}>
                {PAINTS.map(([n, hex]) => (
                  <button key={hex} type="button" title={t(n)} aria-label={t(n)} className="swatch" style={{ background: hex }} aria-pressed={room.paint === hex} onClick={() => editRoom({ paint: hex })} />
                ))}
              </div>
            </div>
            <div>
              <h3 className="panel-label">{tr('Furniture', 'เฟอร์นิเจอร์')}</h3>
              <div className="grid grid-cols-2 gap-[7px]">
                {TYPES[room.type].items.map(([key, label]) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 rounded-[7px] border-[1.5px] border-line px-[9px] py-[7px] text-xs font-semibold">
                    <input type="checkbox" className="m-0 size-[15px] accent-accent" checked={room.items.includes(key)} onChange={(e) => toggleItem(key, e.target.checked)} />
                    {t(label)}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button type="button" className="btn px-[15px] py-[9px] text-xs" onClick={save}>{tr('Save design', 'บันทึกแบบ')}</button>
          <button type="button" className="btn btn-ghost px-[15px] py-[9px] text-xs" onClick={load}>{tr('Load saved', 'โหลดแบบที่บันทึก')}</button>
          <span role="status" className="min-h-[18px] basis-full text-xs font-semibold text-muted">{status}</span>
        </div>
      </div>
    </div>
  );
}
