// Small SVG snippets shared by the Astro pages (inserted with set:html) and the React islands.

/** House glyph that sits inside a highlighted word; its roof lifts and its door opens on hover. */
export const HOUSE_GLYPH =
  '<svg class="hl-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
  '<path class="roof" d="M12 1.6 0.8 11.4h3.1L12 4.5l8.1 6.9h3.1z"/>' +
  '<path d="M4.6 12.2V22h14.8v-9.8L12 5.9z"/>' +
  '<rect class="door" x="10" y="15.2" width="4" height="6.8" rx="0.6" style="fill:var(--bg)"/></svg>';

/** Hand-drawn loop (the reference's "native app" circle). Draws itself once its parent is revealed. */
export const SCRIBBLE =
  '<svg class="scribble" viewBox="0 0 176 55" preserveAspectRatio="none" aria-hidden="true">' +
  '<path pathLength="100" vector-effect="non-scaling-stroke" d="M28 9.5C34 6 75.5 0 107 2c31.5 2 60 5 65.5 21.5C178 40 127 49 83 52 39 55-2.5 51 4.5 31.5 11.5 12 93.5 1.6 123 7"/></svg>';

/** Wrap a phrase so the pen circles it. */
export const circled = (text: string) => `<span class="scribble-wrap">${text}${SCRIBBLE}</span>`;
/** Highlight a phrase, optionally with the house glyph in front. */
export const marked = (text: string, glyph = false) => `<mark class="hl">${glyph ? HOUSE_GLYPH : ''}${text}</mark>`;

/** 12-point "verified" starburst that spins while its button is hovered. */
export const STARBURST = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 9.2 : 11.5;
    pts.push(`${(12 + Math.cos(a) * r).toFixed(2)} ${(12 + Math.sin(a) * r).toFixed(2)}`);
  }
  return `<svg viewBox="0 0 24 24" class="size-[18px]" aria-hidden="true"><path class="spin-badge" fill="currentColor" d="M${pts.join('L')}Z"/><path d="M8 12.2l2.6 2.6L16 9.4" fill="none" stroke="var(--bg)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
})();

export const ARROW = '<svg viewBox="0 0 16 16" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 8h11M9 3.5 13.5 8 9 12.5"/></svg>';
export const CURSOR = '<svg viewBox="0 0 16 16" class="size-3.5 nudge" fill="currentColor" aria-hidden="true"><path d="M3 1.5v11.2l3-2.7 2 4.5 2-.9-2-4.4h4z"/></svg>';
