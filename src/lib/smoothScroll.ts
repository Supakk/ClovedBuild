// Inertial page scrolling (the "Lenis" feel) without a dependency.
// Mouse-wheel and trackpad deltas are collected into a target; the page glides to it with exponential easing.
// Native scrolling stays in charge for touch, keyboard, scrollbars, find-in-page and reduced motion.
import { damp } from './motion';

/** wheel: also take over the mouse wheel with inertia. Off by default: native scrolling (as on tryalcove.com) feels most direct. */
export function initSmoothScroll({ lambda = 9, anchorOffset = 88, wheel = false } = {}) {
  if (typeof window === 'undefined') return () => {};
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(pointer: fine)').matches) return () => {};

  const root = document.documentElement;
  root.style.scrollBehavior = 'auto';
  let target = scrollY, current = scrollY, raf = 0, last = 0, setAt = -1;
  // While gliding to a link, aim at the element itself: sections that load on the way can change where it is.
  let aim: HTMLElement | null = null;
  const aimAt = () => (aim ? Math.max(0, Math.min(max(), aim.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(aim).scrollMarginTop) || anchorOffset))) : target);
  const max = () => root.scrollHeight - innerHeight;

  const tick = (now: number) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    if (aim) target = aimAt();
    current = damp(current, target, lambda, dt);
    if (Math.abs(target - current) < 0.4) current = target;
    setAt = Math.round(current);
    scrollTo(0, current);
    raf = current === target ? 0 : requestAnimationFrame(tick);
    if (!raf) aim = null;
    if (!raf) last = 0;
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(tick); };

  // Is there something under the pointer that should scroll by itself (a panel, a 3D view, the plan)?
  const ownsWheel = (el: EventTarget | null, dy: number) => {
    for (let n = el as HTMLElement | null; n && n !== document.body; n = n.parentElement) {
      if (n.dataset?.nativeScroll !== undefined) return true;
      const s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) {
        if ((dy < 0 && n.scrollTop > 0) || (dy > 0 && n.scrollTop + n.clientHeight < n.scrollHeight - 1)) return true;
      }
    }
    return false;
  };

  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (ownsWheel(e.target, e.deltaY)) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? innerHeight : 1;
    if (!raf) current = scrollY;
    aim = null;
    target = Math.max(0, Math.min(max(), target + e.deltaY * unit));
    go();
  };
  // Keyboard, scrollbar or find-in-page moved the page: follow it instead of fighting it.
  const onScroll = () => {
    if (Math.abs(scrollY - setAt) <= 1) return; // our own step
    // Someone else scrolled (keys, scrollbar, find): stop gliding and follow.
    cancelAnimationFrame(raf); raf = 0; last = 0; aim = null;
    target = current = scrollY;
  };
  // In-page links glide too (and stop under the sticky header).
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const a = (e.target as HTMLElement).closest?.('a[href^="#"]') as HTMLAnchorElement | null;
    if (!a) return;
    const id = decodeURIComponent(a.getAttribute('href')!.slice(1));
    const el = id ? document.getElementById(id) : null;
    if (!el && id !== 'top') return;
    e.preventDefault();
    if (!raf) current = scrollY;
    aim = el && id !== 'top' ? el : null;
    target = aim ? aimAt() : 0;
    history.pushState(null, '', `#${id}`);
    go();
  };

  if (wheel) addEventListener('wheel', onWheel, { passive: false });
  addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('click', onClick);
  return () => {
    removeEventListener('wheel', onWheel);
    removeEventListener('scroll', onScroll);
    document.removeEventListener('click', onClick);
    cancelAnimationFrame(raf);
  };
}
