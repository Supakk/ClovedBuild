import { useEffect, useRef, useState, type PointerEvent as RPE } from 'react';
import * as THREE from 'three';
import { SpecStage } from '../../lib/plan/specStage';
import { webglOK } from '../../lib/house/stage';
import { typeLabel, type HouseSpec } from '../../lib/plan/spec';
import { t, tr, useLang } from '../../lib/i18n';
import { TurnLeft, TurnRight } from '../icons';

interface Props {
  spec: HouseSpec;
  floor: number;
  open: boolean;
  selId: string | null;
  onSelect: (id: string) => void;
  /** Fill the parent's height instead of keeping a 4:3 box. */
  fill?: boolean;
}

/** Isometric 3D view of the design. Fixed camera angle, turns in 90° steps, can open the current floor. */
export default function Preview3D({ spec, floor, open, selId, onSelect, fill }: Props) {
  const lang = useLang();
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<SpecStage | null>(null);
  const tags = useRef(new Map<string, HTMLButtonElement>());
  const [labels, setLabels] = useState<{ id: string; text: string }[]>([]);
  const [facing, setFacing] = useState(0);
  const [noGL, setNoGL] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    if (!webglOK()) { setNoGL(true); return; }
    const st = new SpecStage(c);
    stage.current = st;
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (st.tick(c, now, openRef.current)) {
        for (const m of st.markers) {
          const el = tags.current.get(m.id);
          if (!el) continue;
          const p = st.project(m.obj);
          el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); st.dispose(); stage.current = null; };
  }, []);

  // Rebuild shortly after edits settle, so dragging on the plan stays smooth.
  useEffect(() => {
    const st = stage.current;
    if (!st) return;
    const timer = window.setTimeout(() => {
      st.set(spec, { cut: open ? floor : null, sel: selId, site: true });
      const rooms = open ? spec.levels[floor] ?? [] : [];
      setLabels(rooms.map((r) => ({ id: r.id, text: t(typeLabel(r.type)) })));
      st.dirty = true;
    }, 90);
    return () => window.clearTimeout(timer);
  }, [spec, floor, open, selId, lang]);

  function click(e: RPE<HTMLCanvasElement>) {
    const st = stage.current, c = canvas.current;
    if (!st?.model || !c) return;
    const rc = c.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1), st.cam);
    for (const h of ray.intersectObject(st.model, true)) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.roomId) o = o.parent;
      if (o) { onSelect(o.userData.roomId); return; }
    }
  }
  const turn = (d: number) => { stage.current?.turn(d); setFacing(stage.current?.facing ?? 0); };
  const btn = 'grid size-9 cursor-pointer place-items-center rounded-full bg-card text-ink shadow-soft';

  return (
    <div className={`relative w-full max-w-full overflow-hidden rounded-2xl bg-card/40 ${fill ? 'h-full' : 'aspect-[4/3]'}`}>
      {noGL ? <div className="grid h-full place-items-center p-4 text-center text-sm font-semibold text-muted">3D preview needs WebGL.</div>
        : <canvas ref={canvas} onPointerUp={click} className="absolute inset-0 block size-full cursor-pointer" aria-label={tr('3D preview of your house. Tap a room to select it.', 'ภาพ 3 มิติของบ้าน แตะห้องเพื่อเลือก')} />}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {labels.map((l) => (
          <button key={l.id} type="button" ref={(el) => { if (el) { tags.current.set(l.id, el); if (stage.current) stage.current.dirty = true; } else tags.current.delete(l.id); }}
            onClick={() => onSelect(l.id)}
            className={`pointer-events-auto absolute top-0 left-0 cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap shadow ${l.id === selId ? 'bg-accent text-white' : 'bg-card text-ink'}`}>{l.text}</button>
        ))}
      </div>
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        <button type="button" className={btn} aria-label={tr('Turn left', 'หมุนซ้าย')} onClick={() => turn(-1)}><TurnLeft className="size-4" /></button>
        <div className="flex gap-1" aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} className={`h-1.5 rounded-full ${i === facing ? 'w-4 bg-accent' : 'w-1.5 bg-line'}`} />)}</div>
        <button type="button" className={btn} aria-label={tr('Turn right', 'หมุนขวา')} onClick={() => turn(1)}><TurnRight className="size-4" /></button>
      </div>
    </div>
  );
}
