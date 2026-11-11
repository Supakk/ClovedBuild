import { useState } from 'react';
import { useT } from '../lib/i18n';
import { FacebookIcon, LineIcon, LinkIcon, XIcon } from './icons';

/** Share the site: LINE, Facebook, X, or copy the link. */
export default function ShareButtons() {
  const { tr } = useT();
  const [copied, setCopied] = useState(false);
  const url = typeof location !== 'undefined' ? location.origin + '/' : '/';
  const text = tr('Design your dream home in 3D with ClovedBuild', 'ออกแบบบ้านในฝันแบบ 3 มิติด้วย ClovedBuild');
  const u = encodeURIComponent(url), tx = encodeURIComponent(text);
  const items = [
    { label: 'LINE', Icon: LineIcon, href: `https://social-plugins.line.me/lineit/share?url=${u}` },
    { label: 'Facebook', Icon: FacebookIcon, href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { label: 'X', Icon: XIcon, href: `https://twitter.com/intent/tweet?url=${u}&text=${tx}` },
  ];
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map(({ label, Icon, href }) => (
        <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" aria-label={tr(`Share on ${label}`, `แชร์ไป ${label}`)} className="icon-btn size-10"><Icon className="size-[18px]" /></a></li>
      ))}
      <li><button type="button" onClick={copy} aria-label={tr('Copy link', 'คัดลอกลิงก์')} className="icon-btn h-10 w-auto grid-flow-col gap-1.5 px-3.5 text-xs font-bold"><LinkIcon className="size-4" />{copied ? tr('Copied', 'คัดลอกแล้ว') : tr('Copy link', 'คัดลอกลิงก์')}</button></li>
    </ul>
  );
}
