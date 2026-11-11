import { useEffect, useMemo, useRef, useState } from 'react';
import { arriveAll } from '../lib/springs';
import { HOUSE_PRESETS, REGIONS, presetSpec, styleById, totals, type Region } from '../lib/plan/spec';
import { useT } from '../lib/i18n';
import SlideButton from './SlideButton';
import { BedIcon, AreaIcon, CubeIcon } from './icons';

const thb = (n: number) => (n >= 1e6 ? `฿${(n / 1e6).toFixed(1)}M` : `฿${Math.round(n / 1000)}K`);

/** Starting designs: every house style, filterable by region, opening straight in the builder or simulator. */
export default function StyleGallery() {
  const { tr, t } = useT();
  const [region, setRegion] = useState<Region | 'all'>('all');
  const cards = useMemo(() => HOUSE_PRESETS.map((p) => {
    const s = presetSpec(p.id), st = styleById(p.styleId), m = totals(s);
    return { p, st, s, m };
  }), []);
  const all = cards.filter((c) => region === 'all' || c.st.region === region);
  // A taste first: two rows on a wide screen (one short row on a phone); the rest on request.
  const [open, setOpen] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const FEW = 8, PHONE = 4;
  const shown = open ? all : all.slice(0, FEW);
  const more = all.length - (open ? all.length : FEW);
  const grid = useRef<HTMLDivElement>(null);
  // Cards spring in one after another whenever the set changes (a region tab, "see all").
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const cards = [...(grid.current?.children ?? [])].filter((c) => (c as HTMLElement).offsetParent !== null);
    arriveAll(cards.slice(0, 12));
  }, [region, open]);

  return (
    <div ref={top} className="scroll-mt-24">
      <div role="tablist" aria-label={tr('Style', 'สไตล์')} className="mx-auto mb-8 flex w-max max-w-full gap-1.5 overflow-x-auto rounded-full bg-band p-1.5">
        {([['all', 'All'], ...REGIONS] as [Region | 'all', string][]).map(([k, l]) => {
          const n = k === 'all' ? cards.length : cards.filter((c) => c.st.region === k).length;
          return (
            <button key={k} type="button" role="tab" aria-selected={region === k} onClick={() => { setRegion(k); setOpen(false); }}
              className={`press flex flex-none cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors duration-300 ${region === k ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}>
              {t(l)}<span className={`rounded-full px-1.5 text-[10px] ${region === k ? 'bg-bg/20' : 'bg-ink/10'}`}>{n}</span>
            </button>
          );
        })}
      </div>
      <div ref={grid} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map(({ p, st, s, m }, i) => (
          <article key={`${region}-${p.id}`} className={`group lift ${!open && i >= PHONE ? 'max-sm:hidden' : ''} flex flex-col overflow-hidden rounded-2xl bg-card shadow-soft`}>
            <a href={`/builder?preset=${p.id}`} className="relative block aspect-[4/3] overflow-hidden bg-band" aria-label={tr(`Design from ${p.name}`, `ออกแบบต่อจาก${t(p.name)}`)}>
              <img src={`/renders/house-${p.id}.webp`} alt="" width={560} height={420} loading="lazy" decoding="async"
                className="absolute inset-0 size-full object-contain p-2 transition-transform duration-700 [transition-timing-function:var(--ease-out)] group-hover:scale-[1.06]" />
              <span className="absolute top-3 left-3 rounded-full bg-card/90 px-2.5 py-1 text-[10px] font-bold text-muted">{t(REGIONS.find(([k]) => k === st.region)?.[1] ?? '')}</span>
            </a>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <h3 className="text-[15px] leading-tight font-bold">{t(p.name)}</h3>
              <p className="text-xs leading-snug text-muted">{t(st.blurb)}</p>
              <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[11px] font-semibold text-muted">
                <span className="flex items-center gap-1"><BedIcon className="size-3.5" />{tr(`${m.beds} bed · ${m.baths} bath`, `${m.beds} ห้องนอน · ${m.baths} ห้องน้ำ`)}</span>
                <span className="flex items-center gap-1"><AreaIcon className="size-3.5" />{Math.round(m.floorArea)} {tr('m²', 'ตร.ม.')}</span>
                <span>{tr(`${s.floors} fl.`, `${s.floors} ชั้น`)}</span>
                <span title={tr('Rough building cost', 'ค่าก่อสร้างคร่าวๆ')}>≈ {thb(m.cost)}</span>
              </div>
              <div className="flex gap-2 pt-2">
                <SlideButton small href={`/builder?preset=${p.id}`} className="flex-1" icon={<svg viewBox="0 0 16 16" fill="currentColor"><path d="M11.3 1.4 14.6 4.7 5.4 13.9 1.4 14.6 2.1 10.6z" /></svg>}>{tr('Design this', 'ออกแบบต่อ')}</SlideButton>
                <a href={`/simulator?preset=${p.id}`} className="icon-btn size-[34px] flex-none shadow-none ring-1 ring-line" title={tr('Place in the simulator', 'วางในซิมูเลเตอร์')} aria-label={tr('Place in the simulator', 'วางในซิมูเลเตอร์')}><CubeIcon className="size-4" /></a>
              </div>
            </div>
          </article>
        ))}
      </div>
      {all.length > PHONE && (
        <div className="mt-8 flex justify-center">
          {open ? (
            <button type="button" className="btn btn-ghost press" onClick={() => { setOpen(false); top.current?.scrollIntoView({ block: 'start' }); }}>
              {tr('Show fewer', 'ย่อกลับ')}
            </button>
          ) : (
            <button type="button" className={`btn btn-ghost press ${more <= 0 ? 'sm:hidden' : ''}`} onClick={() => setOpen(true)}>
              {tr(`See all ${all.length} styles`, `ดูแบบบ้านทั้งหมด ${all.length} แบบ`)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}