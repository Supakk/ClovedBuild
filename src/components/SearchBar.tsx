import { useState, type FormEvent, type ReactNode } from 'react';
import { PRESETS } from '../lib/house/data';
import { filterResidences } from '../lib/events';
import { CashIcon, HomeIcon, PinOutline, SearchIcon } from './icons';
import { useT } from '../lib/i18n';

function Field({ id, label, icon, value, onChange, children }: {
  id: string; label: string; icon: ReactNode; value: string; onChange: (v: string) => void; children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none rounded-md border-0 bg-card py-2.5 pr-9 pl-3 text-xs font-semibold text-muted"
      >
        <option value="">{label}</option>
        {children}
      </select>
      <span className="pointer-events-none absolute top-1/2 right-[11px] size-3.5 -translate-y-1/2 text-muted">{icon}</span>
    </div>
  );
}

export default function SearchBar() {
  const { tr, t } = useT();
  const [location, setLocation] = useState('');
  const [type, setType] = useState('');
  const [price, setPrice] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    filterResidences({ location, minBeds: Number(type) || 0, maxPrice: Number(price) || Infinity });
  }

  return (
    <form
      onSubmit={submit}
      aria-label={tr('Search properties', 'ค้นหาบ้าน')}
      className="mx-auto grid max-w-[840px] gap-3.5 rounded-[14px] bg-band p-[26px] shadow-soft md:grid-cols-[repeat(3,1fr)_auto]"
    >
      <Field id="fLoc" label={tr('Location', 'ทำเล')} icon={<PinOutline className="size-3.5" />} value={location} onChange={setLocation}>
        {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
      </Field>
      <Field id="fType" label={tr('Type', 'ประเภท')} icon={<HomeIcon className="size-3.5" />} value={type} onChange={setType}>
        <option value="3">{tr('3+ bedrooms', '3 ห้องนอนขึ้นไป')}</option>
        <option value="2">{tr('2+ bedrooms', '2 ห้องนอนขึ้นไป')}</option>
      </Field>
      <Field id="fPrice" label={tr('Price Range', 'ช่วงราคา')} icon={<CashIcon className="size-3.5" />} value={price} onChange={setPrice}>
        <option value="35000000">{tr('Up to', 'ไม่เกิน')} $35,000,000</option>
        <option value="45000000">{tr('Up to', 'ไม่เกิน')} $45,000,000</option>
        <option value="50000000">{tr('Up to', 'ไม่เกิน')} $50,000,000</option>
      </Field>
      <button type="submit" className="btn px-6"><SearchIcon className="size-4" />{tr('Search', 'ค้นหา')}</button>
    </form>
  );
}
