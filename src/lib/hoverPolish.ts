// Two small hover rules that make pointer effects feel finished instead of twitchy:
//  - "flourish": a one-shot hover animation (the feature icons) always plays to its end,
//    even when the pointer only brushes past.
//  - "snap-back": a sliding hover (buttons) that is left half-way resets at once
//    instead of slowly playing itself backwards.
// Mouse only; touch has no hover.

const FLOURISH = '.feat';
const SNAP = '.btn-slide';
/** Leaving before this share of the hover animation counts as "half-way". */
const EARLY = 0.88;

/** Longest transition (duration + delay, in ms) on an element and everything inside it. */
function longest(el: Element) {
  let max = 0;
  for (const n of [el, ...el.querySelectorAll('*')]) {
    const cs = getComputedStyle(n);
    const d = cs.transitionDuration.split(', '), dl = cs.transitionDelay.split(', ');
    d.forEach((v, i) => { const ms = (parseFloat(v) + parseFloat(dl[i % dl.length])) * 1000; if (Number.isFinite(ms)) max = Math.max(max, ms); });
  }
  return max;
}

export function initHoverPolish() {
  if (typeof window === 'undefined' || !matchMedia('(hover: hover)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const entered = new WeakMap<Element, { at: number; dur: number }>();
  const timers = new WeakMap<Element, number>();

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const t = e.target as Element, from = e.relatedTarget as Node | null;
    const f = t.closest?.(FLOURISH);
    if (f && !f.contains(from)) {
      clearTimeout(timers.get(f));
      f.classList.add('flourish');
      // Measure after the hover styles apply, then drop the class once everything has played.
      requestAnimationFrame(() => timers.set(f, window.setTimeout(() => f.classList.remove('flourish'), longest(f))));
    }
    const s = t.closest?.(SNAP);
    if (s && !s.contains(from)) {
      const rec = { at: performance.now(), dur: 0 };
      entered.set(s, rec);
      requestAnimationFrame(() => { rec.dur = longest(s); });
    }
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse') return;
    const s = (e.target as Element).closest?.(SNAP);
    if (!s || s.contains(e.relatedTarget as Node | null)) return;
    const rec = entered.get(s);
    if (rec && performance.now() - rec.at < rec.dur * EARLY) {
      s.classList.add('snap-back');
      void (s as HTMLElement).offsetWidth; // apply the reset now
      s.classList.remove('snap-back');
    }
  });
}
