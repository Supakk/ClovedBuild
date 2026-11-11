import { setLang, useLang } from '../lib/i18n';

/** TH / EN switch. Works in every header; static Astro text follows <html lang> through CSS. */
export default function LangToggle({ className = '' }: { className?: string }) {
  const lang = useLang();
  return (
    <div role="group" aria-label="Language / ภาษา" className={`inline-flex flex-none rounded-full border-[1.5px] border-line bg-card p-0.5 text-[11px] font-bold ${className}`}>
      {(['th', 'en'] as const).map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => setLang(l)}
          className={`press cursor-pointer rounded-full px-2 py-1 transition-colors ${lang === l ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}>
          {l === 'th' ? 'ไทย' : 'EN'}
        </button>
      ))}
    </div>
  );
}
