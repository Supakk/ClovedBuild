// Architect-style 2D drawings: the floor plan (walls, doors, windows, stairs, furniture, dimensions)
// and the site plan (plot, setbacks, house footprint). Rooms and the house can be dragged and resized.
import { memo, useEffect, useMemo, useRef, useState, type PointerEvent as RPE, type ReactElement } from 'react';
import { PLAN_TINT, adoptDoor, area, floorEdges, floorRect, mainRect, roomPoly, stairVoids, typeLabel, type HouseSpec, type PRoom, type Edge, type Post, type Side, type DoorMark } from '../../lib/plan/spec';
import { t, tr } from '../../lib/i18n';
import { damp, reducedMotion } from '../../lib/motion';
import { itemFootprint, roomRect } from '../../lib/plan/build3d';

interface Props {
  spec: HouseSpec;
  floor: number;
  mode: 'floor' | 'site';
  selId: string | null;
  snap: number;
  errorIds: Set<string>;
  onSelect: (id: string | null) => void;
  /** Live update while dragging (no undo step). */
  onLive: (s: HouseSpec) => void;
  /** Drag finished: record an undo step. */
  onCommit: () => void;
  /** Lets the parent convert screen points to plan metres (for dropping new rooms). */
  apiRef?: { current: PlanApi | null };
}
export interface PlanApi {
  toMeters: (x: number, y: number) => { x: number; z: number } | null;
  zoomBy: (f: number) => void;
  reset: () => void;
}

const INK = '#2A1C17';
const ACC = '#E9694B';
const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

type Drag = { kind: 'move' | 'resize' | 'site' | 'win' | 'door' | 'mdoor' | 'post' | 'furn'; item?: string; moved?: boolean; doorId?: string; mark?: DoorMark; outside?: boolean; post?: Post; id?: string; sx: number; sz: number; orig: PRoom | { front: number; left: number }; edges?: { w: boolean; e: boolean; n: boolean; s: boolean }; edge?: Edge; winId?: string; lo?: number; hi?: number; axis?: 'x' | 'z'; prev?: HouseSpec; prevSel?: string | null };
const polyD = (r: PRoom) => roomPoly(r).map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.z}`).join('') + 'Z';

export default function PlanView({ spec, floor, mode, selId, snap, errorIds, onSelect, onLive, onCommit, apiRef }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [pxPerM, setPx] = useState(30);
  const drag = useRef<Drag | null>(null);
  const specRef = useRef(spec);
  specRef.current = spec;

  const site = mode === 'site';
  const PW = spec.site.plotW * 2, PD = spec.site.plotD * 2;
  const m = site ? 3.2 : 2.4;
  const W = site ? PW : spec.w, D = site ? PD : spec.d;
  const BW = W + 2 * m, BH = D + 2 * m + (site ? 1.6 : 0);
  // Zoom and pan: z = 1 shows the whole drawing.
  type View = { z: number; cx: number; cy: number };
  const [view, setViewNow] = useState<View>({ z: 1, cx: W / 2, cy: (D + (site ? 1.6 : 0)) / 2 });
  // Where the view is gliding to (wheel, buttons, a flick of the finger); the frame loop eases towards it.
  const goal = useRef<View>(view);
  const anim = useRef(0);
  const setView = (v: View | ((v: View) => View)) => {
    // Direct moves (pinch, finger pan) cancel any glide and follow the finger exactly.
    cancelAnimationFrame(anim.current); anim.current = 0;
    setViewNow((cur) => { const n = typeof v === 'function' ? v(cur) : v; goal.current = n; return n; });
  };
  const glideTo = (g: View) => {
    goal.current = g;
    if (reducedMotion()) { setViewNow(g); return; }
    if (anim.current) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const c = viewRef.current, t = goal.current;
      const done = Math.abs(c.z - t.z) < 1e-3 && Math.abs(c.cx - t.cx) < 1e-3 && Math.abs(c.cy - t.cy) < 1e-3;
      const n = done ? t : { z: damp(c.z, t.z, 15, dt), cx: damp(c.cx, t.cx, 15, dt), cy: damp(c.cy, t.cy, 15, dt) };
      viewRef.current = n; setViewNow(n);
      anim.current = done ? 0 : requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(anim.current), []);
  useEffect(() => { setView({ z: 1, cx: W / 2, cy: (D + (site ? 1.6 : 0)) / 2 }); }, [mode, W, D, site]);
  const clampView = (v: { z: number; cx: number; cy: number }) => {
    const z = Math.min(6, Math.max(1, v.z)), hw = BW / z / 2, hh = BH / z / 2;
    const bx = -m + BW / 2, by = -m + BH / 2;
    return { z, cx: Math.min(bx + BW / 2 - hw, Math.max(bx - BW / 2 + hw, v.cx)), cy: Math.min(by + BH / 2 - hh, Math.max(by - BH / 2 + hh, v.cy)) };
  };
  const vw = BW / view.z, vh = BH / view.z;
  const vb = `${view.cx - vw / 2} ${view.cy - vh / 2} ${vw} ${vh}`;
  const zoomAt = (f: number, p?: { x: number; z: number }) => {
    const v = goal.current, nz = Math.min(6, Math.max(1, v.z * f));
    glideTo(p ? clampView({ z: nz, cx: p.x + (v.cx - p.x) * (v.z / nz), cy: p.z + (v.cy - p.z) * (v.z / nz) }) : clampView({ ...v, z: nz }));
  };

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setPx(Math.min(r.width / (W + 2 * m), r.height / (D + 2 * m + (site ? 1.6 : 0))) || 30); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [W, D, m, site]);

  const toM = (e: { clientX: number; clientY: number }) => {
    const el = svg.current!, pt = el.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(el.getScreenCTM()!.inverse());
    return { x: p.x, z: p.y };
  };
  const sn = (v: number) => Math.round(v / snap) * snap;
  if (apiRef) apiRef.current = {
    toMeters: (x, y) => {
      const el = svg.current; if (!el) return null;
      const r = el.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
      return toM({ clientX: x, clientY: y });
    },
    zoomBy: (f) => zoomAt(f),
    reset: () => glideTo(clampView({ z: 1, cx: 0, cy: 0 })),
  };
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const pan = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean; tap?: string; vx?: number; vy?: number; t?: number; lx?: number; ly?: number } | null>(null);
  const viewRef = useRef(view); viewRef.current = view;
  function downCapture(e: RPE) {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2) {
      // Two fingers: pinch to zoom, and stop whatever one finger started.
      const [a, b] = [...ptrs.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: viewRef.current.z };
      // A second finger turns a drag into a pinch: undo whatever the first finger started.
      const d = drag.current;
      if (d?.prev) { onLive(d.prev); onSelect(d.prevSel ?? null); }
      drag.current = null; setDragging(false); pan.current = null;
    }
  }
  function downBg(e: RPE, tap?: string) {
    if (ptrs.current.size > 1) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pan.current = { x: e.clientX, y: e.clientY, cx: viewRef.current.cx, cy: viewRef.current.cy, moved: false, tap };
  }
  function moveAll(e: RPE) {
    if (ptrs.current.has(e.pointerId)) ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const nz = pinch.current.z * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d);
      setView((v) => clampView({ ...v, z: nz }));
      return;
    }
    const pn = pan.current;
    if (pn) {
      const dx = e.clientX - pn.x, dy = e.clientY - pn.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) pn.moved = true;
      if (pn.moved && viewRef.current.z > 1.01) {
        const k = pxPerM * viewRef.current.z, now = performance.now();
        // Remember the finger's speed so the plan can keep coasting when it lets go.
        if (pn.t) { const dt = Math.max(1, now - pn.t); pn.vx = 0.7 * (pn.vx ?? 0) + 0.3 * ((e.clientX - (pn.lx ?? e.clientX)) / dt); pn.vy = 0.7 * (pn.vy ?? 0) + 0.3 * ((e.clientY - (pn.ly ?? e.clientY)) / dt); }
        pn.t = now; pn.lx = e.clientX; pn.ly = e.clientY;
        setView((v) => clampView({ ...v, cx: pn.cx - dx / k, cy: pn.cy - dy / k }));
      }
      return;
    }
    move(e);
  }
  function upAll(e: RPE) {
    ptrs.current.delete(e.pointerId);
    if (pinch.current) { if (ptrs.current.size < 2) pinch.current = null; return; }
    const pn = pan.current;
    if (pn) {
      if (!pn.moved) onSelect(pn.tap ?? null);
      else if (pn.t && performance.now() - pn.t < 80 && (pn.vx || pn.vy)) {
        // Flick: coast on in the same direction and settle.
        const k = pxPerM * viewRef.current.z, c = viewRef.current;
        glideTo(clampView({ ...c, cx: c.cx - ((pn.vx ?? 0) * 220) / k, cy: c.cy - ((pn.vy ?? 0) * 220) / k }));
      }
      pan.current = null; return;
    }
    end();
  }
  const [dragging, setDragging] = useState(false);

  function start(e: RPE, d: Omit<Drag, 'sx' | 'sz'>) {
    e.stopPropagation();
    if (ptrs.current.size > 1) return; // second finger of a pinch
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const p = toM(e);
    drag.current = { ...d, sx: p.x, sz: p.z, prev: specRef.current, prevSel: selId } as Drag;
    setDragging(true);
  }
  // Pointer moves can arrive several times per frame; only the last one each frame is applied.
  const pendingMove = useRef<{ clientX: number; clientY: number } | null>(null);
  const moveRaf = useRef(0);
  function move(e: RPE) {
    if (!drag.current) return;
    pendingMove.current = { clientX: e.clientX, clientY: e.clientY };
    if (!moveRaf.current) moveRaf.current = requestAnimationFrame(flushMove);
  }
  function flushMove() {
    moveRaf.current = 0;
    const ev = pendingMove.current;
    pendingMove.current = null;
    if (ev) applyMove(ev as RPE);
  }
  function applyMove(e: RPE) {
    const d = drag.current;
    if (!d) return;
    const p = toM(e), dx = p.x - d.sx, dz = p.z - d.sz;
    let s = specRef.current;
    if (d.kind === 'site') {
      const o = d.orig as { front: number; left: number };
      const left = Math.min(PW - s.w, Math.max(0, sn(o.left + dx)));
      const front = Math.min(PD - s.d, Math.max(0, sn(o.front - dz)));
      onLive({ ...s, site: { ...s.site, left, front } });
      return;
    }
    if (d.kind === 'win' && d.edge) {
      const e = d.edge, len = e.a1 - e.a0;
      let a: number;
      if (e.axis === 'd') { const L = e.a1, ux = (e.p1.x - e.p0.x) / L, uz = (e.p1.z - e.p0.z) / L; a = (p.x - e.p0.x) * ux + (p.z - e.p0.z) * uz; }
      else a = e.axis === 'x' ? p.x : p.z;
      const pos = Math.min(1, Math.max(0, (a - e.a0) / len));
      const r0 = d.orig as PRoom;
      const levels = s.levels.map((lv, i) => (i === floor ? lv.map((r) => (r.id === r0.id ? { ...r, windows: (r.windows ?? []).map((w) => (w.id === d.winId ? { ...w, pos: Math.round(pos * 40) / 40 } : w)) } : r)) : lv));
      onLive({ ...s, levels });
      return;
    }
    if (!d.moved && Math.hypot(dx, dz) > 0.08) d.moved = true;
    if (d.kind === 'furn' && d.item) {
      const r0 = d.orig as PRoom, pl0 = r0.place?.[d.item] ?? { dx: 0, dz: 0 };
      if (!d.moved) return;
      const fp = pieces(s, r0).find((q) => q.item === d.item);
      if (!fp) return;
      const place = { ...(r0.place ?? {}), [d.item]: keepIn(s, r0, fp, { ...pl0, dx: pl0.dx + dx, dz: pl0.dz + dz }) };
      onLive({ ...s, levels: s.levels.map((lv, i) => (i === floor ? lv.map((r) => (r.id === r0.id ? { ...r, place } : r)) : lv)) });
      return;
    }
    if (d.kind === 'post' && d.post) {
      const o = d.post, fr = floorRect(s, floor);
      const x = Math.min(fr.x + fr.w, Math.max(fr.x, sn(o.x + dx))), z = Math.min(fr.z + fr.d, Math.max(fr.z, sn(o.z + dz)));
      onLive({ ...s, posts: (s.posts ?? []).map((q) => (q.id === o.id ? { ...q, x, z } : q)) });
      return;
    }
    if (d.kind === 'mdoor') {
      // An automatic door is handed over to its room's own door list the moment it is first moved.
      if (!d.doorId && d.mark) {
        if (Math.hypot(dx, dz) < 0.15) return;
        const a = adoptDoor(s, floor, d.mark);
        if (!a) return;
        d.doorId = a.doorId; d.mark = undefined;
        s = a.spec; specRef.current = s;
      }
      // A placed door follows the finger onto whichever wall of its room is nearest.
      const r0 = s.levels[floor].find((r) => r.id === (d.orig as PRoom).id);
      if (!r0) return;
      let best: { side: Side; pos: number; dist: number } | null = null;
      for (const e of floorEdges(s, floor).edges) {
        if (e.room.id !== r0.id || e.axis === 'd' || e.a1 - e.a0 < 0.7 || (d.outside && !e.perimeter)) continue;
        const a = e.axis === 'x' ? p.x : p.z, off = e.axis === 'x' ? p.z : p.x;
        const ac = Math.min(e.a1, Math.max(e.a0, a));
        const dist = Math.abs(off - e.fixed) + Math.abs(a - ac);
        if (!best || dist < best.dist) best = { side: e.side as Side, pos: Math.round(((ac - e.a0) / (e.a1 - e.a0)) * 40) / 40, dist };
      }
      if (!best) return;
      const b = best;
      const levels = s.levels.map((lv, i) => (i === floor ? lv.map((r) => (r.id === r0.id ? { ...r, doors: (r.doors ?? []).map((x) => (x.id === d.doorId ? { ...x, side: b.side, pos: b.pos } : x)) } : r)) : lv));
      onLive({ ...s, levels });
      return;
    }
    if (d.kind === 'door') {
      const a = d.axis === 'x' ? p.x : p.z, span = (d.hi ?? 0) - (d.lo ?? 0);
      const at = span > 0 ? Math.min(1, Math.max(0, (a - (d.lo ?? 0)) / span)) : 0.5;
      const r0 = d.orig as PRoom;
      const levels = s.levels.map((lv, i) => (i === floor ? lv.map((r) => (r.id === r0.id ? { ...r, doorAt: Math.round(at * 20) / 20 } : r)) : lv));
      onLive({ ...s, levels });
      return;
    }
    const o = d.orig as PRoom;
    let { x, z, w, d: dd } = o;
    if (d.kind === 'move') {
      x = Math.min(s.w - w, Math.max(0, sn(o.x + dx)));
      z = Math.min(s.d - dd, Math.max(0, sn(o.z + dz)));
    } else {
      const ed = d.edges!;
      const MIN = 0.8;
      if (ed.w) { const nx = Math.min(o.x + o.w - MIN, Math.max(0, sn(o.x + dx))); w = o.x + o.w - nx; x = nx; }
      if (ed.e) w = Math.max(MIN, Math.min(s.w - o.x, sn(o.x + o.w + dx) - o.x));
      if (ed.n) { const nz = Math.min(o.z + o.d - MIN, Math.max(0, sn(o.z + dz))); dd = o.z + o.d - nz; z = nz; }
      if (ed.s) dd = Math.max(MIN, Math.min(s.d - o.z, sn(o.z + o.d + dz) - o.z));
    }
    const levels = s.levels.map((lv, i) => (i === floor ? lv.map((r) => (r.id === o.id ? { ...r, x, z, w, d: dd } : r)) : lv));
    onLive({ ...s, levels });
  }
  function end() {
    if (moveRaf.current) { cancelAnimationFrame(moveRaf.current); flushMove(); }
    const dd = drag.current;
    if (dd && !dd.moved && dd.item) setSelItem(dd.item);
    if (drag.current) { drag.current = null; setDragging(false); onCommit(); }
  }

  const rooms = spec.levels[floor] ?? [];
  const { edges, doors } = useMemo(() => floorEdges(spec, floor), [spec, floor]);
  const voids = stairVoids(spec, floor);
  const scale = pxPerM * view.z;
  const hr = 8 / scale; // handle radius: ~8 px whatever the zoom
  const fs = Math.max(0.16, Math.min(0.34, 11 / scale));
  const fr = floorRect(spec, floor);
  const sel = rooms.find((r) => r.id === selId);
  const [selItem, setSelItem] = useState<string | null>(null);
  useEffect(() => setSelItem(null), [selId, floor]);
  const turnItem = (r: PRoom, item: string) => {
    const pl = r.place?.[item] ?? { dx: 0, dz: 0 }, turn = ((pl.turn ?? 0) + 1) % 4;
    const fp = pieces(spec, { ...r, place: { ...(r.place ?? {}), [item]: { ...pl, turn } } }).find((q) => q.item === item);
    const place = { ...(r.place ?? {}), [item]: fp ? keepIn(spec, r, fp, { ...pl, turn }) : { ...pl, turn } };
    onLive({ ...spec, levels: spec.levels.map((lv, i) => (i === floor ? lv.map((x) => (x.id === r.id ? { ...x, place } : x)) : lv)) });
    onCommit();
  };

  return (
    <svg
      ref={svg}
      viewBox={vb}
      className={`plan block h-full w-full touch-none select-none ${dragging ? 'is-dragging' : ''}`}
      style={{ fontFamily: 'Montserrat, system-ui, sans-serif' }}
      onPointerDownCapture={downCapture}
      onPointerMove={moveAll}
      onPointerUp={upAll}
      onPointerCancel={upAll}
      onPointerDown={(e) => downBg(e)}
      onWheel={(e) => { const p = toM(e); zoomAt(Math.exp(-e.deltaY * 0.0015), p); }}
      role="img"
      aria-label={site ? tr('Site plan', 'ผังบริเวณ') : tr(`Floor plan, floor ${floor + 1}`, `ผังพื้นชั้น ${floor + 1}`)}
    >
      <defs>
        <pattern id="g05" width={0.5} height={0.5} patternUnits="userSpaceOnUse"><path d="M0.5 0H0V0.5" fill="none" stroke="#E7DED4" strokeWidth={0.012} /></pattern>
        <pattern id="g1" width={1} height={1} patternUnits="userSpaceOnUse"><rect width={1} height={1} fill="url(#g05)" /><path d="M1 0H0V1" fill="none" stroke="#D8CCBF" strokeWidth={0.02} /></pattern>
        <pattern id="hatch" width={0.35} height={0.35} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V0.35" stroke="#C9BBAE" strokeWidth={0.04} /></pattern>
        <marker id="tick" viewBox="-1 -1 2 2" markerWidth={0.4} markerHeight={0.4} markerUnits="userSpaceOnUse" orient="auto"><path d="M-0.7 0.7L0.7 -0.7" stroke={INK} strokeWidth={0.25} /></marker>
        <marker id="arr" viewBox="0 -1 2 2" markerWidth={0.35} markerHeight={0.35} markerUnits="userSpaceOnUse" orient="auto"><path d="M0 -1L2 0L0 1z" fill={INK} /></marker>
      </defs>
      <rect x={-m - 50} y={-m - 50} width={BW + 100} height={BH + 100} fill="#FFFDFB" />
      <rect x={-m} y={-m} width={W + 2 * m} height={D + 2 * m} fill="url(#g1)" opacity={0.9} />

      {site ? (
        <SitePlan spec={spec} PW={PW} PD={PD} fs={fs} onDown={(e) => start(e, { kind: 'site', orig: { front: spec.site.front, left: spec.site.left } })} />
      ) : (
        <>
          {/* the part of the footprint this floor does not cover */}
          {floor > 0 && (fr.w < spec.w - 0.01 || fr.d < spec.d - 0.01) && (
            <g pointerEvents="none">
              <rect x={0} y={0} width={spec.w} height={spec.d} fill="url(#hatch)" opacity={0.6} />
              <rect x={fr.x} y={fr.z} width={fr.w} height={fr.d} fill="#FFFDFB" stroke={INK} strokeWidth={0.04} strokeDasharray="0.3 0.15" />
              <text x={spec.w / 2} y={fr.z + fr.d > spec.d - 1 ? fr.z - 0.3 : (fr.z + fr.d + spec.d) / 2} fontSize={fs} textAnchor="middle" fill="#8C7B70">{t('Roof below')}</text>
            </g>
          )}
          {/* rooms */}
          {rooms.map((r) => (
            <g key={r.id}>
              <path d={polyD(r)} fill={r.type === 'terrace' || r.type === 'undercroft' || r.type === 'carport' ? 'url(#hatch)' : PLAN_TINT[r.type]}
                stroke={errorIds.has(r.id) ? '#D0453A' : 'none'} strokeWidth={0.08} strokeDasharray={errorIds.has(r.id) ? '0.25 0.15' : undefined}
                style={{ cursor: 'move' }}
                onPointerDown={(e) => {
                  if (ptrs.current.size > 1) return;
                  // Zoomed in on a phone: a finger on a room that is not selected pans the plan; a tap selects it.
                  if (e.pointerType === 'touch' && r.id !== selId && viewRef.current.z > 1.01) { e.stopPropagation(); downBg(e, r.id); return; }
                  onSelect(r.id); start(e, { kind: 'move', id: r.id, orig: r });
                }} />
              <Furniture r={r} sw={spec.w} sd={spec.d} />
              {r.type === 'stairs' && <Stairs r={r} up={floor < spec.floors - 1} fs={fs} />}
            </g>
          ))}
          {voids.map((v) => <rect key={'v' + v.id} x={v.x + 0.1} y={v.z + 0.1} width={v.w - 0.2} height={v.d - 0.2} fill="none" stroke={INK} strokeWidth={0.03} strokeDasharray="0.2 0.12" pointerEvents="none" />)}
          {/* walls, windows, doors */}
          <g pointerEvents="none">
            {edges.map((e, i) => <Wall key={e.room.id + i} e={e} />)}
            {rooms.filter((r) => r.type === 'undercroft' || r.type === 'terrace' || r.type === 'carport').flatMap((r) => roomPoly(r).map((p, i) => (
              <rect key={r.id + 'c' + i} x={Math.min(r.x + r.w - 0.22, Math.max(r.x + 0.02, p.x - 0.1))} y={Math.min(r.z + r.d - 0.22, Math.max(r.z + 0.02, p.z - 0.1))} width={0.2} height={0.2} fill={INK} />
            )))}
            {doors.filter((d) => !d.open).map((d, i) => <Door key={i} d={d} />)}
          </g>
          {/* posts */}
          {(spec.posts ?? []).filter((q) => q.floor === floor).map((q) => {
            const on = selId === 'post:' + q.id, h = q.size / 2, pad = Math.max(0, hr - h);
            return (
              <g key={'p' + q.id} style={{ cursor: 'move' }} onPointerDown={(e) => { if (ptrs.current.size > 1) return; onSelect('post:' + q.id); start(e, { kind: 'post', post: q, orig: { front: 0, left: 0 } }); }}>
                <circle cx={q.x} cy={q.z} r={h + pad} fill="transparent" />
                {on && <circle cx={q.x} cy={q.z} r={h + 0.18} fill="none" stroke={ACC} strokeWidth={0.06} strokeDasharray="0.15 0.1" className="ants" />}
                {q.round ? <circle cx={q.x} cy={q.z} r={h} fill={on ? ACC : INK} /> : <rect x={q.x - h} y={q.z - h} width={q.size} height={q.size} fill={on ? ACC : INK} />}
              </g>
            );
          })}
          {/* labels */}
          <g pointerEvents="none">
            {rooms.map((r) => {
              const mr = mainRect(r);
              const k = Math.min(1, mr.w / 2.6, mr.d / 1.4);
              const cx = mr.x + mr.w / 2, cy = mr.z + mr.d / 2 - (r.type === 'stairs' ? Math.min(0.6, mr.d * 0.15) : 0);
              return (
                <g key={'l' + r.id} textAnchor="middle" fill={INK}>
                  <text x={cx} y={cy - fs * 0.35 * k} fontSize={fs * 1.05 * k} fontWeight={700} letterSpacing={0.02}>{t(typeLabel(r.type)).toUpperCase()}</text>
                  <text x={cx} y={cy + fs * 0.85 * k} fontSize={fs * 0.85 * k} fill="#6E5950">{fmt(area(r))} m² · {fmt(r.w)}×{fmt(r.d)}</text>
                </g>
              );
            })}
          </g>
          <Dimensions spec={spec} rooms={rooms} fs={fs} />
          {/* selection */}
          {rooms.filter((r) => r.id === selId).map((r) => {
            const hs: [number, number, { w: boolean; e: boolean; n: boolean; s: boolean }, string][] = [
              [r.x, r.z, { w: true, e: false, n: true, s: false }, 'nwse-resize'], [r.x + r.w, r.z, { w: false, e: true, n: true, s: false }, 'nesw-resize'],
              [r.x, r.z + r.d, { w: true, e: false, n: false, s: true }, 'nesw-resize'], [r.x + r.w, r.z + r.d, { w: false, e: true, n: false, s: true }, 'nwse-resize'],
              [r.x + r.w / 2, r.z, { w: false, e: false, n: true, s: false }, 'ns-resize'], [r.x + r.w / 2, r.z + r.d, { w: false, e: false, n: false, s: true }, 'ns-resize'],
              [r.x, r.z + r.d / 2, { w: true, e: false, n: false, s: false }, 'ew-resize'], [r.x + r.w, r.z + r.d / 2, { w: false, e: true, n: false, s: false }, 'ew-resize'],
            ];
            return (
              <g key="sel">
                <path className="ants" d={polyD(r)} fill={ACC} fillOpacity={0.08} stroke={ACC} strokeWidth={0.07} strokeDasharray="0.3 0.18" pointerEvents="none" />
                {hs.map(([x, y, ed, cur], i) => (
                  <circle key={i} cx={x} cy={y} r={hr} fill="#fff" stroke={ACC} strokeWidth={hr * 0.35} style={{ cursor: cur }}
                    onPointerDown={(e) => start(e, { kind: 'resize', id: r.id, orig: r, edges: ed })} />
                ))}
              </g>
            );
          })}
          {/* furniture of the selected room: drag to move, tap then ↻ to turn */}
          {sel && pieces(spec, sel).map((q) => {
            const on = selItem === q.item;
            return (
              <g key={'f' + q.item}>
                <rect x={q.cx - q.w / 2} y={q.cz - q.d / 2} width={q.w} height={q.d} rx={0.06}
                  fill={on ? ACC : '#4F7F95'} fillOpacity={on ? 0.14 : 0.05} stroke={on ? ACC : '#4F7F95'} strokeWidth={on ? 0.05 : 0.025} strokeDasharray={on ? undefined : '0.12 0.08'}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => {
                    if (ptrs.current.size > 1) return;
                    // A tap picks the piece; once picked it can be dragged. Dragging an unpicked piece still moves the whole room.
                    if (on) start(e, { kind: 'furn', orig: sel, item: q.item });
                    else start(e, { kind: 'move', id: sel.id, orig: sel, item: q.item });
                  }} />
                {on && (() => {
                  const hx = q.cx + q.w / 2, hy = q.cz - q.d / 2;
                  return (
                    <g style={{ cursor: 'pointer' }} onPointerDown={(e) => { e.stopPropagation(); turnItem(sel, q.item); }}>
                      <circle cx={hx} cy={hy} r={hr * 1.4} fill={ACC} stroke="#fff" strokeWidth={hr * 0.3} />
                      <path d={`M${hx - hr * 0.6} ${hy}A${hr * 0.6} ${hr * 0.6} 0 1 1 ${hx} ${hy + hr * 0.6}`} fill="none" stroke="#fff" strokeWidth={hr * 0.25} strokeLinecap="round" />
                      <path d={`M${hx - hr * 0.95} ${hy - hr * 0.2}L${hx - hr * 0.6} ${hy + hr * 0.25}L${hx - hr * 0.2} ${hy - hr * 0.15}`} fill="none" stroke="#fff" strokeWidth={hr * 0.22} strokeLinejoin="round" />
                    </g>
                  );
                })()}
              </g>
            );
          })}
          {/* draggable windows and inside door of the selected room */}
          {sel && edges.filter((e) => e.room.id === sel.id).flatMap((e) => e.holes.filter((h) => h.winId).map((h) => {
            const c = (h.a0 + h.a1) / 2;
            const [x, y] = e.axis === 'd'
              ? [e.p0.x + ((e.p1.x - e.p0.x) / e.a1) * c, e.p0.z + ((e.p1.z - e.p0.z) / e.a1) * c]
              : e.axis === 'x' ? [c, e.fixed] : [e.fixed, c];
            return (
              <g key={h.winId} style={{ cursor: 'grab' }} onPointerDown={(ev) => start(ev, { kind: 'win', orig: sel, edge: e, winId: h.winId })}>
                <circle cx={x} cy={y} r={hr * 1.25} fill="#4F7F95" stroke="#fff" strokeWidth={hr * 0.3} />
                <path d={`M${x - hr * 0.55} ${y}H${x + hr * 0.55}M${x} ${y - hr * 0.55}V${y + hr * 0.55}`} stroke="#fff" strokeWidth={hr * 0.25} />
              </g>
            );
          }))}
          {/* every door can be grabbed and moved; the doors of the selected room get bigger handles */}
          {doors.filter((d) => d.doorId || !d.open).map((d, i) => {
            const [x, y] = d.axis === 'x' ? [d.c, d.fixed] : [d.fixed, d.c];
            const mine = !!sel && d.owner.id === sel.id;
            return (
              <g key={'d' + i} style={{ cursor: 'grab' }} onPointerDown={(ev) => {
                if (ptrs.current.size > 1) return;
                onSelect(d.owner.id);
                start(ev, { kind: 'mdoor', orig: d.owner, doorId: d.doorId, mark: d.doorId ? undefined : d, outside: d.front });
              }}>
                <circle cx={x} cy={y} r={hr * 1.6} fill="transparent" />
                <circle cx={x} cy={y} r={hr * (mine ? 1.2 : 0.75)} fill={ACC} fillOpacity={mine ? 1 : 0.85} stroke="#fff" strokeWidth={hr * (mine ? 0.3 : 0.22)} />
              </g>
            );
          })}
        </>
      )}
      <NorthAndScale x={W + m - 0.9} y={(site ? PD : D) + m - 0.9} fs={fs} />
    </svg>
  );
}

/* ---------------- pieces ---------------- */

function Wall({ e }: { e: Edge }) {
  if (e.room.type === 'undercroft' || e.room.type === 'carport') return null;
  const t = e.perimeter ? 0.2 : 0.1;
  // A point `a` metres along the wall, `off` metres off its centre line (positive = into the room).
  let P: (a: number, off?: number) => [number, number];
  if (e.axis === 'd') {
    const L = e.a1, ux = (e.p1.x - e.p0.x) / L, uz = (e.p1.z - e.p0.z) / L, nx = -uz, nz = ux;
    P = (a, off = 0) => [e.p0.x + ux * a + nx * (t / 2 + off), e.p0.z + uz * a + nz * (t / 2 + off)];
  } else {
    const inward = e.side === 'n' || e.side === 'w' ? 1 : -1;
    const f = e.fixed + inward * t / 2;
    P = (a, off = 0) => (e.axis === 'x' ? [a, f + inward * off] : [f + inward * off, a]);
  }
  const holes = [...e.holes].sort((a, b) => a.a0 - b.a0);
  const segs: [number, number][] = [];
  let cur = e.a0;
  for (const h of holes) {
    if (h.kind === 'window' || h.kind === 'glass' || h.kind === 'high' || h.kind === 'fins' || h.kind === 'round') continue;
    if (h.a0 > cur) segs.push([cur, h.a0]);
    cur = Math.max(cur, h.a1);
  }
  if (e.a1 > cur) segs.push([cur, e.a1]);
  const line = (a0: number, a1: number, off: number, w: number, color = INK, key?: string) => {
    const [x1, y1] = P(a0, off), [x2, y2] = P(a1, off);
    return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} strokeLinecap="square" />;
  };
  if (e.room.type === 'terrace' && e.perimeter) return <g>{line(e.a0, e.a1, 0, 0.05)}{line(e.a0, e.a1, 0.06, 0.02)}</g>;
  return (
    <g>
      {segs.map(([a, b], i) => line(a, b, 0, t, INK, 's' + i))}
      {holes.filter((h) => h.kind === 'window' || h.kind === 'glass' || h.kind === 'high' || h.kind === 'fins' || h.kind === 'round').map((h, i) => (
        <g key={'w' + i}>
          {line(h.a0, h.a1, 0, t, '#FFFFFF')}
          {line(h.a0, h.a1, -t / 2 + 0.015, 0.025)}
          {line(h.a0, h.a1, t / 2 - 0.015, 0.025)}
          {line(h.a0, h.a1, 0, h.kind === 'glass' || h.kind === 'fins' ? 0.03 : 0.015, h.kind === 'glass' || h.kind === 'fins' ? '#4F7F95' : INK)}
          {line(h.a0 - 0.04, h.a0, 0, t)}{line(h.a1, h.a1 + 0.04, 0, t)}
        </g>
      ))}
    </g>
  );
}

function Door({ d }: { d: ReturnType<typeof floorEdges>['doors'][number] }) {
  // Work in the wall's own frame: `a` along the wall, `off` across it (positive = into the room the door opens into).
  const r = d.into;
  const intoPos = d.axis === 'x' ? r.z + r.d / 2 > d.fixed : r.x + r.w / 2 > d.fixed;
  const sgn = intoPos ? 1 : -1;
  const P = (a: number, off = 0): [number, number] => (d.axis === 'x' ? [a, d.fixed + sgn * off] : [d.fixed + sgn * off, a]);
  const L = (a0: number, o0: number, a1: number, o1: number, w: number, key?: string) => { const [x1, y1] = P(a0, o0), [x2, y2] = P(a1, o1); return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={w} />; };
  // A leaf hinged at `hinge`, closed towards `toward` (+1 / -1 along the wall), opened 90°.
  const leaf = (hinge: number, toward: 1 | -1, w: number, key: string) => {
    const [hx, hy] = P(hinge), [sx, sy] = P(hinge + toward * w), [ex, ey] = P(hinge, w);
    const cross = (sx - hx) * (ey - hy) - (sy - hy) * (ex - hx);
    return <g key={key}>
      {L(hinge, 0, hinge, w, d.front ? 0.06 : 0.04)}
      <path d={`M${sx} ${sy} A${w} ${w} 0 0 ${cross > 0 ? 1 : 0} ${ex} ${ey}`} fill="none" stroke={INK} strokeWidth={0.02} strokeDasharray={d.front ? undefined : '0.08 0.05'} />
    </g>;
  };
  const w = d.front && (d.kind ?? 'swing') === 'swing' ? d.w * 0.9 : d.w;
  const a0 = d.c - w / 2, a1 = d.c + w / 2;
  const [lx, ly] = P(d.c, -0.75);
  const label = d.front && <text x={lx} y={ly + 0.1} fontSize={0.28} textAnchor="middle" fill={ACC} fontWeight={700}>{tr('ENTRY', 'ทางเข้า')}</text>;
  if (d.kind === 'sliding') {
    const k = w * 0.55;
    return <g>
      {L(a0, -0.035, a0 + k, -0.035, 0.035, 'a')}{L(a1 - k, 0.035, a1, 0.035, 0.035, 'b')}
      {L(a0 + 0.08, 0.16, a0 + k - 0.05, 0.16, 0.015, 'c')}
      <path d={(() => { const [x, y] = P(a0 + k - 0.05, 0.16), [x1, y1] = P(a0 + k - 0.17, 0.1), [x2, y2] = P(a0 + k - 0.17, 0.22); return `M${x1} ${y1}L${x} ${y}L${x2} ${y2}`; })()} fill="none" stroke={INK} strokeWidth={0.015} />
      {label}
    </g>;
  }
  if (d.kind === 'double') return <g>{leaf(a0, 1, w / 2, 'l')}{leaf(a1, -1, w / 2, 'r')}{label}</g>;
  return <g>{leaf(a0, 1, w, 'l')}{label}</g>;
}

function Stairs({ r, up, fs }: { r: PRoom; up: boolean; fs: number }) {
  const along = r.d >= r.w ? 'z' : 'x';
  const len = along === 'z' ? r.d : r.w, n = Math.max(4, Math.floor((len - 0.3) / 0.26));
  const lines = Array.from({ length: n + 1 }, (_, i) => 0.15 + (i * (len - 0.3)) / n);
  const c = along === 'z' ? r.x + r.w / 2 : r.z + r.d / 2;
  return (
    <g pointerEvents="none" stroke="#6E5950" strokeWidth={0.02}>
      {lines.map((t, i) => along === 'z'
        ? <line key={i} x1={r.x + 0.15} x2={r.x + r.w - 0.15} y1={r.z + r.d - t} y2={r.z + r.d - t} />
        : <line key={i} y1={r.z + 0.15} y2={r.z + r.d - 0.15} x1={r.x + t} x2={r.x + t} />)}
      {along === 'z'
        ? <line x1={c} x2={c} y1={r.z + r.d - 0.25} y2={r.z + 0.35} stroke={INK} strokeWidth={0.03} markerEnd="url(#arr)" />
        : <line y1={c} y2={c} x1={r.x + 0.25} x2={r.x + r.w - 0.35} stroke={INK} strokeWidth={0.03} markerEnd="url(#arr)" />}
      <text x={along === 'z' ? c + 0.12 : r.x + 0.3} y={along === 'z' ? r.z + r.d - 0.35 : c - 0.12} fontSize={fs * 0.8} fill={INK} stroke="none" fontWeight={700}>{up ? tr('UP', 'ขึ้น') : tr('DN', 'ลง')}</text>
    </g>
  );
}

/** Simple architectural furniture symbols, following where the 3D furniture goes. */
function furnEls(r: PRoom, items: string[], kp = '') {
  const has = (k: string) => items.includes(k);
  const st = { fill: '#FFFFFF', stroke: '#9C8B80', strokeWidth: 0.025, pointerEvents: 'none' as const };
  const mr = mainRect(r);
  const x0 = mr.x + 0.15, z0 = mr.z + 0.15, x1 = mr.x + mr.w - 0.15, z1 = mr.z + mr.d - 0.15, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const out: ReactElement[] = [];
  const R = (x: number, y: number, ww: number, hh: number, k: string, rx = 0.05) => out.push(<rect key={kp + k} x={x} y={y} width={Math.max(0.05, ww)} height={Math.max(0.05, hh)} rx={rx} {...st} />);
  switch (r.type) {
    case 'bedroom': { const bw = Math.min(1.6, w - 1.2); if (has('bed') && w > 2 && d > 2.2) { R(cx - bw / 2, z0, bw, 2.0, 'b'); R(cx - bw / 2 + 0.1, z0 + 0.1, bw / 2 - 0.15, 0.35, 'p1'); R(cx + 0.05, z0 + 0.1, bw / 2 - 0.15, 0.35, 'p2'); out.push(<line key={kp + 'dv'} x1={cx - bw / 2} x2={cx + bw / 2} y1={z0 + 0.8} y2={z0 + 0.8} {...st} />); } if (has('nightstands') && w > 2 && d > 2.2) { R(cx - bw / 2 - 0.5, z0, 0.42, 0.4, 'n1'); R(cx + bw / 2 + 0.08, z0, 0.42, 0.4, 'n2'); } } if (has('wardrobe') && d > 3) R(x0, z1 - 1.5, 0.6, 1.3, 'wd', 0); break;
    case 'kids': if (has('bed') && d > 2) R(x0, z0, 0.95, 1.9, 'kb'); if (has('desk') && w > 2) R(x1 - 0.9, z1 - 0.5, 0.9, 0.5, 'kd', 0); break;
    case 'living': if (has('sofa') && w > 2.4) { const sw = Math.min(2.4, w - 1.2); R(cx - sw / 2, z0, sw, 0.9, 'sf', 0.12); R(cx - sw / 2, z0, sw, 0.25, 'sb', 0.08); } if (has('coffee') && d > 2.4) R(cx - 0.5, z0 + 1.3, 1.0, 0.55, 'ct'); if (has('tv') && w > 3) R(x1 - 0.4, cz - 0.7, 0.4, 1.4, 'tv', 0); break;
    case 'dining': if (has('table') && w > 2 && d > 1.8) { const tw = Math.min(2, w - 1.4); R(cx - tw / 2, cz - 0.45, tw, 0.9, 'dt'); const n = tw > 1.6 ? 3 : 2; for (let i = 0; i < n; i++) { const x = cx - tw / 2 + (tw * (i + 0.5)) / n - 0.2; R(x, cz - 0.95, 0.4, 0.4, 'c1' + i, 0.08); R(x, cz + 0.55, 0.4, 0.4, 'c2' + i, 0.08); } } break;
    case 'kitchen': if (has('counter')) { R(x0, z0, w, 0.6, 'kc', 0); out.push(<circle key={kp + "sk"} cx={x0 + w * 0.3} cy={z0 + 0.3} r={0.18} {...st} />); [0.15, -0.15].forEach((o, i) => out.push(<circle key={kp + 'h' + i} cx={x0 + w * 0.75 + o} cy={z0 + 0.3} r={0.1} {...st} />)); } if (has('island') && d > 2.6 && w > 2.2) R(cx - Math.min(0.8, w / 2 - 0.6), cz + 0.15, Math.min(1.6, w - 1.2), 0.7, 'is', 0.03); if (has('fridge')) R(x0, z0, 0.7, 0.65, 'fr', 0); break;
    case 'bathroom': if (has('tub') && w > 1.8 && d > 1.4) R(x0, z0, 1.6, 0.75, 'tb', 0.25); if (has('toilet')) { out.push(<ellipse key={kp + "wc"} cx={x0 + 0.3} cy={z1 - 0.35} rx={0.2} ry={0.25} {...st} />); } if (has('vanity')) R(x1 - 0.5, cz - 0.4, 0.5, 0.8, 'vn', 0.04); break;
    case 'office': if (has('desk') && w > 1.8) R(cx - 0.75, z0, 1.5, 0.7, 'od', 0); if (has('shelf') && d > 1.4) R(x0, cz - Math.min(0.75, d / 2 - 0.2), 0.38, Math.min(1.5, d - 0.4), 'os', 0); break;
    case 'garage': if (has('car') && w > 2 && d > 2) { const v = d >= w; const cw = v ? 1.8 : 4.1, cd = v ? 4.1 : 1.8; R(cx - cw / 2, cz - cd / 2, cw, cd, 'car', 0.35); R(cx - cw / 2 + (v ? 0.15 : 1.0), cz - cd / 2 + (v ? 1.0 : 0.15), v ? cw - 0.3 : 2.1, v ? 2.1 : cd - 0.3, 'cab', 0.25); } break;
    case 'laundry': if (has('washer')) R(x0, z0, 0.6, 0.6, 'ws', 0.04); if (has('dryer') && w > 1.4) R(x0 + 0.7, z0, 0.6, 0.6, 'dr', 0.04); break;
    case 'terrace': if (has('lounger')) R(x0 + 0.2, cz - 0.95, 0.65, 1.9, 'lg', 0.1); if (has('table') && w > 2.6) out.push(<circle key={kp + "pt"} cx={x1 - 1} cy={cz} r={0.36} {...st} />); break;
    case 'hall': if (has('console') && Math.max(w, d) > 1.6) { if (w >= d) R(cx - 0.55, z0, 1.1, 0.32, 'cs', 0); else R(x0, cz - 0.55, 0.32, 1.1, 'cs', 0); } break;
  }
  return out;
}

/** Snap a moved piece to 5 cm and keep the whole of it inside the room. */
function keepIn(s: HouseSpec, r: PRoom, fp: { bx: number; bz: number; w: number; d: number }, pl: { dx: number; dz: number; turn?: number }) {
  const rr = roomRect(s, r), x0 = rr.x0 + s.w / 2, x1 = rr.x1 + s.w / 2, z0 = rr.z0 + s.d / 2, z1 = rr.z1 + s.d / 2;
  const fit = (c: number, half: number, lo: number, hi: number) => (hi - lo <= 2 * half ? (lo + hi) / 2 : Math.min(hi - half, Math.max(lo + half, c)));
  const q = (v: number) => Math.round(v * 20) / 20;
  return { ...pl, dx: q(fit(fp.bx + pl.dx, fp.w / 2, x0, x1) - fp.bx), dz: q(fit(fp.bz + pl.dz, fp.d / 2, z0, z1) - fp.bz) };
}

/** Each piece of furniture of a room as a box on the plan (where it is now, moves and turns included). */
function pieces(spec: HouseSpec, r: PRoom) {
  const rr = roomRect(spec, r), w = rr.x1 - rr.x0, d = rr.z1 - rr.z0;
  const ox = (rr.x0 + rr.x1) / 2 + spec.w / 2, oz = (rr.z0 + rr.z1) / 2 + spec.d / 2;
  const out: { item: string; cx: number; cz: number; w: number; d: number; bx: number; bz: number; turn: number }[] = [];
  if (w < 0.6 || d < 0.6) return out;
  for (const item of r.items) {
    if (item === 'pendant') continue;
    const fp = itemFootprint(r.type, item, w, d, r.variant);
    if (!fp) continue;
    const pl = r.place?.[item], turn = (pl?.turn ?? 0) % 4, odd = turn % 2 === 1;
    const bx = ox + fp.x, bz = oz + fp.z;
    out.push({ item, bx, bz, turn, cx: bx + (pl?.dx ?? 0), cz: bz + (pl?.dz ?? 0), w: odd ? fp.d : fp.w, d: odd ? fp.w : fp.d });
  }
  return out;
}

// Memoised: while one room is dragged, the furniture of the others is not redrawn.
const Furniture = memo(function Furniture({ r, sw, sd }: { r: PRoom; sw: number; sd: number }) {
  const spec = { w: sw, d: sd } as HouseSpec;
  const moved = r.items.filter((k) => r.place?.[k]);
  if (!moved.length) return <g>{furnEls(r, r.items)}</g>;
  const ps = pieces(spec, r);
  return (
    <g>
      {furnEls(r, r.items.filter((k) => !r.place?.[k]))}
      {moved.map((k) => {
        const q = ps.find((p) => p.item === k);
        if (!q) return null;
        return <g key={'m' + k} transform={`translate(${q.cx - q.bx} ${q.cz - q.bz}) rotate(${q.turn * 90} ${q.bx} ${q.bz})`}>{furnEls(r, [k], k)}</g>;
      })}
    </g>
  );
});

function Dimensions({ spec, rooms, fs }: { spec: HouseSpec; rooms: PRoom[]; fs: number }) {
  const chain = (cuts: number[], fixed: number, axis: 'x' | 'z', key: string, offText: number) => {
    const c = [...new Set(cuts.map((v) => Math.round(v * 100) / 100))].sort((a, b) => a - b);
    return (
      <g key={key} stroke={INK} strokeWidth={0.02} fill={INK}>
        {axis === 'x' ? <line x1={c[0]} x2={c[c.length - 1]} y1={fixed} y2={fixed} /> : <line y1={c[0]} y2={c[c.length - 1]} x1={fixed} x2={fixed} />}
        {c.map((v, i) => axis === 'x'
          ? <line key={i} x1={v - 0.1} y1={fixed + 0.1} x2={v + 0.1} y2={fixed - 0.1} strokeWidth={0.04} />
          : <line key={i} x1={fixed - 0.1} y1={v + 0.1} x2={fixed + 0.1} y2={v - 0.1} strokeWidth={0.04} />)}
        {c.slice(1).map((v, i) => {
          const mid = (v + c[i]) / 2, len = v - c[i];
          if (len < 0.6) return null;
          return axis === 'x'
            ? <text key={'t' + i} x={mid} y={fixed + offText} fontSize={fs * 0.85} textAnchor="middle" stroke="none">{fmt(len)}</text>
            : <text key={'t' + i} x={fixed + offText} y={mid} fontSize={fs * 0.85} textAnchor="middle" stroke="none" transform={`rotate(-90 ${fixed + offText} ${mid})`}>{fmt(len)}</text>;
        })}
      </g>
    );
  };
  const top = rooms.filter((r) => r.z < 0.01).flatMap((r) => [r.x, r.x + r.w]);
  const left = rooms.filter((r) => r.x < 0.01).flatMap((r) => [r.z, r.z + r.d]);
  return (
    <g pointerEvents="none">
      {top.length > 0 && chain([0, spec.w, ...top], -0.7, 'x', 'top', -0.15)}
      {chain([0, spec.w], -1.5, 'x', 'all', -0.15)}
      {left.length > 0 && chain([0, spec.d, ...left], -0.7, 'z', 'lft', -0.15)}
      {chain([0, spec.d], -1.5, 'z', 'alld', -0.15)}
    </g>
  );
}

function SitePlan({ spec, PW, PD, fs, onDown }: { spec: HouseSpec; PW: number; PD: number; fs: number; onDown: (e: RPE) => void }) {
  const hx = spec.site.left, hz = PD - spec.site.front - spec.d;
  const gaps = { back: hz, front: spec.site.front, left: hx, right: PW - hx - spec.w };
  const col = (g: number) => (g < 0.5 ? '#D0453A' : g < 2 ? '#C98A1E' : '#3D7A4A');
  const dim = (x1: number, y1: number, x2: number, y2: number, g: number, k: string) => {
    const vert = x1 === x2;
    return (
      <g key={k} stroke={col(g)} fill={col(g)} strokeWidth={0.04}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} markerStart="url(#tick)" markerEnd="url(#tick)" />
        <text x={(x1 + x2) / 2 + (vert ? 0.2 : 0)} y={(y1 + y2) / 2 + (vert ? 0.1 : -0.15)} fontSize={fs} stroke="none" fontWeight={700} textAnchor={vert ? 'start' : 'middle'}>{fmt(g)} m</text>
      </g>
    );
  };
  return (
    <g>
      <rect x={0} y={0} width={PW} height={PD} fill="#EAF1DF" stroke={INK} strokeWidth={0.12} strokeDasharray="0.6 0.25 0.1 0.25" />
      {PW > 4 && PD > 4 && <rect x={2} y={2} width={PW - 4} height={PD - 4} fill="none" stroke="#C98A1E" strokeWidth={0.05} strokeDasharray="0.3 0.2" pointerEvents="none" />}
      <text x={2.1} y={1.75} fontSize={fs * 0.8} fill="#C98A1E" pointerEvents="none">{tr('2 m line for walls with windows', 'แนว 2 ม. สำหรับผนังที่มีหน้าต่าง')}</text>
      <rect x={-3} y={PD + 0.6} width={PW + 6} height={1.6} fill="#CFCAC4" />
      <text x={PW / 2} y={PD + 1.55} fontSize={fs * 1.1} textAnchor="middle" fill="#fff" fontWeight={700} letterSpacing={0.3}>{tr('ROAD', 'ถนน')}</text>
      <g style={{ cursor: 'move' }} onPointerDown={onDown}>
        <rect x={hx} y={hz} width={spec.w} height={spec.d} fill={spec.colors.roof} fillOpacity={0.45} stroke={INK} strokeWidth={0.15} />
        <rect x={hx} y={hz} width={spec.w} height={spec.d} fill="url(#hatch)" />
        <text x={hx + spec.w / 2} y={hz + spec.d / 2} fontSize={fs * 1.1} textAnchor="middle" fill={INK} fontWeight={700}>{tr('HOUSE', 'ตัวบ้าน')}</text>
        <text x={hx + spec.w / 2} y={hz + spec.d / 2 + fs * 1.3} fontSize={fs * 0.9} textAnchor="middle" fill={INK}>{fmt(spec.w)} × {fmt(spec.d)} m · {spec.floors} fl.</text>
      </g>
      <g pointerEvents="none">
        {dim(hx + spec.w / 2, 0, hx + spec.w / 2, hz, gaps.back, 'b')}
        {dim(hx + spec.w / 2, hz + spec.d, hx + spec.w / 2, PD, gaps.front, 'f')}
        {dim(0, hz + spec.d / 2, hx, hz + spec.d / 2, gaps.left, 'l')}
        {dim(hx + spec.w, hz + spec.d / 2, PW, hz + spec.d / 2, gaps.right, 'r')}
        <text x={PW / 2} y={-0.9} fontSize={fs} textAnchor="middle" fill={INK} fontWeight={700}>{tr(`${spec.site.plotW} wah · ${PW} m`, `${spec.site.plotW} วา · ${PW} ม.`)}</text>
        <text x={-0.9} y={PD / 2} fontSize={fs} textAnchor="middle" fill={INK} fontWeight={700} transform={`rotate(-90 ${-0.9} ${PD / 2})`}>{tr(`${spec.site.plotD} wah · ${PD} m`, `${spec.site.plotD} วา · ${PD} ม.`)}</text>
      </g>
    </g>
  );
}

function NorthAndScale({ x, y, fs }: { x: number; y: number; fs: number }) {
  return (
    <g pointerEvents="none" fill={INK}>
      <circle cx={x} cy={y} r={0.5} fill="none" stroke={INK} strokeWidth={0.03} />
      <path d={`M${x} ${y - 0.45} L${x + 0.2} ${y + 0.25} L${x} ${y + 0.1} L${x - 0.2} ${y + 0.25} Z`} />
      <text x={x} y={y - 0.6} fontSize={fs * 0.8} textAnchor="middle" fontWeight={700}>N</text>
      <g transform={`translate(${x - 4.2} ${y + 0.3})`}>
        {[0, 1, 2].map((i) => <rect key={i} x={i} y={-0.08} width={1} height={0.16} fill={i % 2 ? '#fff' : INK} stroke={INK} strokeWidth={0.02} />)}
        <text x={0} y={-0.2} fontSize={fs * 0.7} textAnchor="middle">0</text>
        <text x={3} y={-0.2} fontSize={fs * 0.7} textAnchor="middle">3 m</text>
      </g>
    </g>
  );
}
