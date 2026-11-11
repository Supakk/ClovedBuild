// Spring animations with Motion (motion.dev), the library tryalcove.com uses.
// The presets mirror the spring settings seen there: lively for things arriving, calmer for UI.
import { animate, stagger } from 'motion';

/** Something arriving on screen: a little overshoot, settles fast. */
export const ENTER = { type: 'spring', stiffness: 150, damping: 14 } as const;
/** Panels and controls: almost no overshoot. */
export const UI = { type: 'spring', stiffness: 160, damping: 18, mass: 1 } as const;
/** Lists and cards: soft, no wobble. */
export const SOFT = { type: 'spring', stiffness: 150, damping: 20, mass: 1 } as const;

export const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fade, rise and un-blur into place, then hand the element back to its stylesheet. */
export function arrive(el: HTMLElement, delay = 0) {
  if (reduced()) return Promise.resolve();
  const lift = Math.min(28, Math.max(14, el.offsetHeight / 6));
  return animate(el, { opacity: [0, 1], y: [lift, 0], filter: ['blur(6px)', 'blur(0px)'] }, { ...ENTER, delay })
    .finished.then(() => { el.style.removeProperty('transform'); el.style.removeProperty('filter'); el.style.removeProperty('opacity'); });
}

/** A group of cards coming in one after another. */
export function arriveAll(els: Element[], gap = 0.05) {
  if (reduced() || !els.length) return;
  animate(els, { opacity: [0, 1], y: [22, 0], scale: [0.96, 1] }, { ...SOFT, delay: stagger(gap) })
    .finished.then(() => els.forEach((e) => { const s = (e as HTMLElement).style; s.removeProperty('transform'); s.removeProperty('opacity'); }));
}

/** A popover opening from a corner. */
export function popOpen(el: HTMLElement) {
  if (reduced()) return;
  animate(el, { opacity: [0, 1], scale: [0.9, 1], y: [-8, 0] }, UI);
}
