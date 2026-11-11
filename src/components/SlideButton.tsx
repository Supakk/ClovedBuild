import type { ReactNode } from 'react';

const Arrow = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" /></svg>
);

/** Alcove-style button: the icon slides out to the left while an arrow slides in from the right. */
export default function SlideButton({ icon, children, href, onClick, className = '', ghost, small, disabled, title }: {
  icon: ReactNode; children: ReactNode; href?: string; onClick?: () => void; className?: string; ghost?: boolean; small?: boolean; disabled?: boolean; title?: string;
}) {
  const cls = `btn btn-slide press ${ghost ? 'btn-ghost' : ''} ${small ? 'btn-slide-sm' : ''} ${className}`;
  const inner = (<><span className="bs-icon">{icon}</span><span className="bs-label truncate">{children}</span><span className="bs-arrow"><Arrow /></span></>);
  return href
    ? <a href={href} className={cls} title={title}>{inner}</a>
    : <button type="button" className={cls} onClick={onClick} disabled={disabled} title={title}>{inner}</button>;
}
