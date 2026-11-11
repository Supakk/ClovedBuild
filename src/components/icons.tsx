// Inline SVG icons. Usable from React islands and, without a client directive, from Astro pages.
import type { SVGProps } from 'react';
import type React from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({ 'aria-hidden': true, ...p });

export const SearchIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" {...base(p)}><circle cx="10.5" cy="10.5" r="7" /><path d="M15.5 15.5L21 21" /></svg>
);
export const PinOutline = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...base(p)}><path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
);
export const PinSolid = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...base(p)}><path d="M12 2a7 7 0 00-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" /></svg>
);
export const HomeIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" {...base(p)}><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z" /></svg>
);
export const CashIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...base(p)}><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>
);
export const BedIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...base(p)}><path d="M3 18V7M3 13h18v5M21 13a3 3 0 00-3-3H11v3" /><circle cx="7" cy="10.5" r="1.5" /></svg>
);
export const AreaIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h5M7 13h10" /></svg>
);
export const MailIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
);
export const Chevron = ({ dir = 'right', ...p }: P & { dir?: 'left' | 'right' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" {...base(p)}><path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} /></svg>
);
export const TurnLeft = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" {...base(p)}><path d="M4 12a8 8 0 108-8H8" /><path d="M11 1L8 4l3 3" /></svg>
);
export const TurnRight = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" {...base(p)}><path d="M20 12a8 8 0 11-8-8h4" /><path d="M13 1l3 3-3 3" /></svg>
);
export const Star = ({ filled = true, ...p }: P & { filled?: boolean }) => (
  <svg viewBox="0 0 20 20" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.4} opacity={filled ? 1 : 0.45} {...base(p)}><path d="M10 1.8l2.5 5.3 5.7.7-4.2 4 1.1 5.7L10 14.7 4.9 17.5 6 11.8l-4.2-4 5.7-.7z" /></svg>
);
export const QuoteMark = (p: P) => (
  <svg viewBox="0 0 46 40" fill="currentColor" {...base(p)}><path d="M0 22C0 10 7 2 18 0l2 5c-6 2-9 6-9 11h8v20H0zM26 22c0-12 7-20 18-22l2 5c-6 2-9 6-9 11h8v20H26z" /></svg>
);

/* "Why choose us" icons */
export const ExclusiveIcon = (p: P) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" {...base(p)}><path d="M4 15L16 6l12 9" /><path d="M7 13v13h18V13" /><rect x="9" y="15" width="10" height="6" fill="currentColor" /><path d="M14 21v5" /></svg>
);
export const TourIcon = (p: P) => (
  <svg viewBox="0 0 32 32" fill="currentColor" {...base(p)}><path d="M5 11h22a2 2 0 012 2v6a3 3 0 01-3 3h-5l-3-3h-4l-3 3H6a3 3 0 01-3-3v-6a2 2 0 012-2z" /><circle cx="11" cy="16" r="2.2" className="fill-card" /><circle cx="21" cy="16" r="2.2" className="fill-card" /><path d="M9 11l2-4h10l2 4" fill="none" stroke="currentColor" strokeWidth={1.8} /></svg>
);
export const BrokerageIcon = (p: P) => (
  <svg viewBox="0 0 32 32" fill="currentColor" {...base(p)}><circle cx="16" cy="7" r="3.5" /><path d="M10 16a6 6 0 0112 0z" /><circle cx="8" cy="19" r="3" /><circle cx="24" cy="19" r="3" /><path d="M3 28a5 5 0 0110 0zM19 28a5 5 0 0110 0z" /></svg>
);
export const ChatIcon = (p: P) => (
  <svg viewBox="0 0 32 32" fill="currentColor" {...base(p)}><path d="M15 3h12a2 2 0 012 2v7a2 2 0 01-2 2h-6l-4 3v-3h-2a2 2 0 01-2-2V5a2 2 0 012-2z" /><circle cx="9" cy="13" r="3.5" /><path d="M3 27a6 6 0 0112 0z" /><circle cx="22" cy="20" r="3" /><path d="M17 29a5 5 0 0110 0z" /></svg>
);
export const BookingIcon = (p: P) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...base(p)}><rect x="9" y="3" width="14" height="26" rx="2.5" /><path d="M14 6h4" /><circle cx="16" cy="16" r="5" fill="currentColor" /><path d="M13.8 16l1.6 1.6 3-3.2" className="stroke-card" /></svg>
);

/* Social */
export const InstagramIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...base(p)}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /></svg>
);
export const FacebookIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...base(p)}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M15 8h-1.5A1.5 1.5 0 0012 9.5V21M9.5 13h5" /></svg>
);
export const XIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...base(p)}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 7l8 10M16 7l-8 10" /></svg>
);
export const DribbbleIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M5 7c4 2 10 2 14-1M3.5 13c6-2 11 0 14 7M9 3.5c3 4 5 10 5 17" /></svg>
);

/* ---------------- builder and simulator icons ---------------- */
const L = (p: P, children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...base(p)}>{children}</svg>
);

/** One icon per room type. */
export function RoomIcon({ type, ...p }: P & { type: string }) {
  switch (type) {
    case 'living': return L(p, <><path d="M4 11V8a2 2 0 012-2h12a2 2 0 012 2v3" /><path d="M3 11a1.5 1.5 0 013 0v2h12v-2a1.5 1.5 0 013 0v6H3z" /><path d="M5 17v2M19 17v2" /></>);
    case 'dining': return L(p, <><circle cx="12" cy="12" r="4" /><path d="M5 4v6M3.5 4v3a1.5 1.5 0 003 0V4M5 10v10M19 4c-1.5 0-2 2-2 4s1 3 2 3V4zM19 11v9" /></>);
    case 'kitchen': return L(p, <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 9h16M8 6h.01M11 6h.01M9 13h6" /></>);
    case 'bedroom': return L(p, <><path d="M3 18V7M3 13h18v5M21 13a3 3 0 00-3-3h-7v3" /><circle cx="7" cy="10.5" r="1.6" /></>);
    case 'kids': return L(p, <><circle cx="12" cy="9" r="4" /><path d="M10.5 8h.01M13.5 8h.01M10.5 10.5a2 2 0 003 0M6 21a6 6 0 0112 0" /></>);
    case 'bathroom': return L(p, <><path d="M4 12h16v2a5 5 0 01-5 5H9a5 5 0 01-5-5z" /><path d="M6 12V6a2 2 0 014 0M7 19l-1 2M17 19l1 2" /></>);
    case 'office': return L(p, <><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M8 20h8M12 16v4" /></>);
    case 'hall': return L(p, <><path d="M5 21V4h14v17M3 21h18" /><path d="M14 12h.01" /></>);
    case 'stairs': return L(p, <path d="M3 20h5v-5h5v-5h5V5h3" />);
    case 'garage': return L(p, <><path d="M3 10l9-6 9 6v10H3z" /><path d="M7 20v-6h10v6M7 17h10" /></>);
    case 'laundry': return L(p, <><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="13" r="4.5" /><path d="M7 6h.01M10 6h.01" /></>);
    case 'storage': return L(p, <><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4M12 11v10" /></>);
    case 'carport': return L(p, <><path d="M2 7h20M4 7v14M20 7v14" /><path d="M6.5 17.5v-2.2l1.6-3.3h7.8l1.6 3.3v2.2zM6.5 17.5v1.5M17.5 17.5v1.5" /><circle cx="9" cy="15.6" r=".6" /><circle cx="15" cy="15.6" r=".6" /></>);
    case 'undercroft': return L(p, <><path d="M3 9l9-6 9 6M4 9h16v5H4z" /><path d="M5 14v7M12 14v7M19 14v7M3 21h18" /></>);
    case 'terrace': return L(p, <><circle cx="17" cy="6" r="2.5" /><path d="M3 14h14M5 14v6M15 14v6M3 18h14M7 14l2-5h2" /></>);
    default: return L(p, <rect x="4" y="4" width="16" height="16" rx="2" />);
  }
}

export function RoofIcon({ roof, ...p }: P & { roof: string }) {
  const body = <path d="M5 13v7h14v-7" />;
  switch (roof) {
    case 'flat': return L(p, <><path d="M4 11h16v2H4z" />{body}</>);
    case 'terrace': return L(p, <><path d="M4 11h16v2H4z" />{body}<path d="M5 11V8h14v3M9 8v3M15 8v3" /></>);
    case 'gable': return L(p, <><path d="M3 13l9-8 9 8" />{body}</>);
    case 'hip': return L(p, <><path d="M3 13l5-6h8l5 6z" />{body}</>);
    case 'shed': return L(p, <><path d="M3 13l18-6v6z" />{body}</>);
    case 'thai': return L(p, <><path d="M2 14c3-1 6-5 10-11 4 6 7 10 10 11" /><path d="M12 3V1.5M6 9.5h12" /><path d="M5 13v7h14v-7" /><path d="M5 20v2M19 20v2" /></>);
    case 'irimoya': return L(p, <><path d="M2 13l5-5h10l5 5z" /><path d="M9.5 8l2.5-3 2.5 3" />{body}</>);
    case 'gambrel': return L(p, <><path d="M3 14l3-6 6-3.5 6 3.5 3 6" />{body}</>);
    default: return L(p, body);
  }
}

export function StepIcon({ step, ...p }: P & { step: string }) {
  switch (step) {
    case 'land': return L(p, <><path d="M3 18l5-7 4 4 3-3 6 6z" /><circle cx="16" cy="7" r="2" /></>);
    case 'house': return L(p, <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10M10 20v-5h4v5" /></>);
    case 'rooms': return L(p, <><rect x="3" y="3" width="18" height="18" rx="1.5" /><path d="M3 12h9M12 3v18M12 15h9" /></>);
    case 'style': return L(p, <><path d="M12 3a9 9 0 100 18c1 0 1.5-.8 1.5-1.6 0-1.2-1-1.4-1-2.4 0-.9.7-1.5 1.6-1.5H17a4 4 0 004-4c0-4.7-4-8.5-9-8.5z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="15" cy="7.5" r="1" /></>);
    case 'check': return L(p, <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></>);
    default: return L(p, <circle cx="12" cy="12" r="9" />);
  }
}

export function CatIcon({ name, ...p }: P & { name: string }) {
  switch (name) {
    case 'Houses': case 'My designs': return <StepIcon step="house" {...p} />;
    case 'People and pets': return L(p, <><circle cx="9" cy="6" r="2.5" /><path d="M5 21v-7a4 4 0 018 0v7" /><path d="M16 21v-3l-2-2 1-3h4l2 3v5M17 10l1-2 1 2" /></>);
    case 'Living and dining': return <RoomIcon type="living" {...p} />;
    case 'Bedroom and office': return <RoomIcon type="bedroom" {...p} />;
    case 'Kitchen, bath and utility': return <RoomIcon type="bathroom" {...p} />;
    case 'Garden and outdoor': return L(p, <><circle cx="12" cy="8" r="5" /><path d="M12 13v8M8 21h8" /></>);
    default: return L(p, <circle cx="12" cy="12" r="8" />);
  }
}

export const UndoIcon = (p: P) => L(p, <><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 010 10h-3" /></>);
export const RedoIcon = (p: P) => L(p, <><path d="M15 14l5-5-5-5" /><path d="M20 9H9a5 5 0 000 10h3" /></>);
export const TrashIcon = (p: P) => L(p, <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />);
export const CopyIcon = (p: P) => L(p, <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" /></>);
export const PlusIcon = (p: P) => L(p, <path d="M12 5v14M5 12h14" />);
export const MinusIcon = (p: P) => L(p, <path d="M5 12h14" />);
export const CubeIcon = (p: P) => L(p, <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></>);
export const MapIcon = (p: P) => L(p, <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></>);
export const SaveIcon = (p: P) => L(p, <><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v5h7V3M8 21v-7h8v7" /></>);
export const SendIcon = (p: P) => L(p, <><path d="M4 12l16-8-6 16-2-6z" /><path d="M12 14l8-10" /></>);
export const ArrowRight = (p: P) => L(p, <path d="M5 12h14M13 6l6 6-6 6" />);
export const ArrowLeft = (p: P) => L(p, <path d="M19 12H5M11 6l-6 6 6 6" />);
export const CloseIcon = (p: P) => L(p, <path d="M6 6l12 12M18 6L6 18" />);
export const HandIcon = (p: P) => L(p, <><path d="M9 11V5a1.5 1.5 0 013 0v5" /><path d="M12 10V4a1.5 1.5 0 013 0v6M15 10V6a1.5 1.5 0 013 0v7a7 7 0 01-7 7h-.5a6 6 0 01-4.6-2.2L4 15.5a1.5 1.5 0 012.2-2L9 16V11" /></>);
export const LayersIcon = (p: P) => L(p, <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>);
export const FitIcon = (p: P) => L(p, <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />);
export const InfoIcon = (p: P) => L(p, <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>);
export const WarnIcon = (p: P) => L(p, <><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17h.01" /></>);
export const OkIcon = (p: P) => L(p, <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></>);

/* Feature icons for the home page (parts are separate elements so each can move on hover). */
export const PlanFeatIcon = (p: P) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" {...base(p)}><rect x="4" y="5" width="24" height="22" rx="2" /><path d="M4 15h11v12" /><path d="M15 5v6" /><path d="M20 15h8" /></svg>
);
export const CubeFeatIcon = (p: P) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" {...base(p)}><path d="M16 4 27 10v12l-11 6-11-6V10z" /><path d="M5 10l11 6 11-6M16 16v12" /><path d="M24 2.5a8 8 0 0 1 4 4" strokeLinecap="round" /></svg>
);
export const LawFeatIcon = (p: P) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" {...base(p)}><path d="M16 3 27 7v8c0 7-5 11.5-11 14-6-2.5-11-7-11-14V7z" /><path d="M11 16l3.5 3.5L21.5 12" /></svg>
);
export const SimFeatIcon = (p: P) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" {...base(p)}><path d="M5 18v-4a3 3 0 0 1 6 0v2h10v-2a3 3 0 0 1 6 0v4" /><path d="M4 18h24v5H4z" /><path d="M7 23v3M25 23v3" /><circle cx="16" cy="8" r="2.5" fill="currentColor" /></svg>
);
export const CostFeatIcon = (p: P) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" {...base(p)}><rect x="6" y="3" width="20" height="26" rx="3" /><rect x="10" y="7" width="12" height="5" rx="1" /><path d="M11 17h.01M16 17h.01M21 17h.01M11 22h.01M16 22h.01M21 22h.01" strokeWidth={2.6} /></svg>
);
export const MenuIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" {...base(p)}><path d="M4 7h16M4 12h16M4 17h10" /></svg>
);
export const LineIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...base(p)}><path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.6 1.1-.5 6-3.5 8.2-6.1C21.6 14.3 22 12.7 22 11c0-4.4-4.5-8-10-8Zm-3.6 10.3H6.6c-.3 0-.5-.2-.5-.5V9.1c0-.3.2-.5.5-.5s.5.2.5.5v3.2h1.3c.3 0 .5.2.5.5s-.2.5-.5.5Zm1.9-.5c0 .3-.2.5-.5.5s-.5-.2-.5-.5V9.1c0-.3.2-.5.5-.5s.5.2.5.5v3.7Zm4.4 0c0 .2-.1.4-.3.5h-.2c-.2 0-.3-.1-.4-.2l-1.9-2.6v2.3c0 .3-.2.5-.5.5s-.5-.2-.5-.5V9.1c0-.2.1-.4.3-.5h.2c.2 0 .3.1.4.2l1.9 2.6V9.1c0-.3.2-.5.5-.5s.5.2.5.5v3.7Zm3-2.3c.3 0 .5.2.5.5s-.2.5-.5.5h-1.3v.8h1.3c.3 0 .5.2.5.5s-.2.5-.5.5h-1.8c-.3 0-.5-.2-.5-.5V9.1c0-.3.2-.5.5-.5h1.8c.3 0 .5.2.5.5s-.2.5-.5.5h-1.3v.8h1.3Z" /></svg>
);
export const LinkIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...base(p)}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
);
