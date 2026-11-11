import { useEffect, useState } from 'react';
import { PRESETS, metrics } from '../lib/house/data';
import { loadPresetInStudio, onFilterResidences, type ResidenceFilter } from '../lib/events';
import { AreaIcon, BedIcon, Chevron, PinSolid } from './icons';
import { useT } from '../lib/i18n';

const CARD_BG: Record<string, string> = {
  nyc: 'linear-gradient(160deg,#DCEBE4,#EEF2EA)',
  santorini: 'linear-gradient(160deg,#EDEADF,#F5EFE4)',
  rio: 'linear-gradient(160deg,#F7E3CC,#FBEDDD)',
};

function matches(k: string, f: ResidenceFilter | null) {
  if (!f) return true;
  const p = PRESETS[k];
  return (!f.location || f.location === k) && metrics(p).beds >= f.minBeds && p.price <= f.maxPrice;
}

export default function Residences() {
  const { tr, t } = useT();
  const [order, setOrder] = useState(['nyc', 'santorini', 'rio']);
  const [filter, setFilter] = useState<ResidenceFilter | null>(null);

  useEffect(() => {
    return onFilterResidences(setFilter);
  }, []);

  const visible = order.filter((k) => matches(k, filter));
  const featured = visible.length === 3 ? 1 : 0;
  const shift = (d: number) => setOrder((o) => (d > 0 ? [...o.slice(1), o[0]] : [o[2], ...o.slice(0, 2)]));

  return (
    <>
      <div className="mx-auto grid max-w-[380px] items-center gap-5 md:max-w-none md:grid-cols-[1fr_1.15fr_1fr]">
        {visible.map((k, i) => {
          const p = PRESETS[k], feat = i === featured;
          return (
            <article key={k} className={`lift animate-pop-in overflow-hidden rounded-xl bg-band shadow-soft ${feat ? '' : 'max-md:hidden'}`} style={{ animationDelay: `${i * 70}ms` }}>
              <div className="relative aspect-[1.18]" style={{ background: CARD_BG[k] }}>
                <img src={`/renders/shot-${k}.webp`} alt={tr(`${p.name} house design`, `แบบบ้าน ${p.name}`)} width={760} height={640} loading="lazy" decoding="async" className="absolute inset-0 size-full object-contain" />
              </div>
              <div className="grid gap-2 px-[18px] pt-3 pb-4">
                <div className={`flex items-center gap-2 font-semibold ${feat ? 'text-[15px]' : 'text-[13px]'}`}><PinSolid className="size-4" />{p.name}</div>
                <div className={`flex justify-between gap-2.5 font-medium ${feat ? 'text-xs' : 'text-[10.5px]'}`}>
                  <span className="flex items-center gap-1.5"><BedIcon className="size-4" />{p.room}</span>
                  <span className="flex items-center gap-1.5"><AreaIcon className="size-4" />{p.area}</span>
                </div>
                <div className="flex items-center justify-between gap-2.5">
                  <button type="button" className="btn btn-sm" onClick={() => loadPresetInStudio(k)}>{tr('Buy now', 'ซื้อเลย')}</button>
                  <span className={`font-semibold tabular-nums ${feat ? 'text-[13px]' : 'text-[11px]'}`}>$ {p.price.toLocaleString('en-US')}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <p role="status" className="mt-3.5 min-h-5 text-center text-[13px] font-semibold text-muted">
        {filter && (visible.length ? tr(`${visible.length} residence${visible.length > 1 ? 's' : ''} found.`, `พบ ${visible.length} หลัง`) : tr('No residence matches those filters. Try a wider price range.', 'ไม่พบบ้านที่ตรงเงื่อนไข ลองขยายช่วงราคา'))}
      </p>
      <div className="mt-6 flex justify-center gap-[22px]">
        <button type="button" aria-label={tr('Previous residence', 'หลังก่อนหน้า')} onClick={() => shift(-1)} className="grid size-10 cursor-pointer place-items-center rounded-full bg-card text-ink shadow-soft"><Chevron dir="left" className="size-[18px]" /></button>
        <button type="button" aria-label={tr('Next residence', 'หลังถัดไป')} onClick={() => shift(1)} className="grid size-10 cursor-pointer place-items-center rounded-full bg-card text-ink shadow-soft"><Chevron className="size-[18px]" /></button>
      </div>
    </>
  );
}
