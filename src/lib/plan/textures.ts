// Procedural wall textures (drawn once on a canvas, shared by every house).
// Grey textures are tinted by the wall colour; the half-timber texture keeps its dark beams.
import * as THREE from 'three';
import type { Finish } from './spec';

const cache = new Map<Finish, THREE.Texture | null>();

function rnd(seed: number) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

function draw(f: Finish, c: CanvasRenderingContext2D, S: number) {
  const r = rnd(7);
  c.fillStyle = '#e8e8e8'; c.fillRect(0, 0, S, S);
  if (f === 'wood') {
    const n = 5, bw = S / n;
    for (let i = 0; i < n; i++) {
      const g = 205 + Math.floor(r() * 40); c.fillStyle = `rgb(${g},${g},${g})`; c.fillRect(i * bw, 0, bw, S);
      c.strokeStyle = 'rgba(0,0,0,0.08)'; c.lineWidth = 1;
      for (let k = 0; k < 6; k++) { const x = i * bw + r() * bw; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 4, S * 0.3, x - 4, S * 0.7, x + 2, S); c.stroke(); }
      c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(i * bw, 0, 2.5, S);
    }
  } else if (f === 'siding') {
    const n = 7, bh = S / n;
    for (let i = 0; i < n; i++) {
      const grad = c.createLinearGradient(0, i * bh, 0, (i + 1) * bh);
      grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.85, '#dcdcdc'); grad.addColorStop(1, '#8e8e8e');
      c.fillStyle = grad; c.fillRect(0, i * bh, S, bh);
    }
  } else if (f === 'brick') {
    const rows = 16, bh = S / rows, bw = S / 4;
    c.fillStyle = '#f2f2f2'; c.fillRect(0, 0, S, S);
    for (let y = 0; y < rows; y++) for (let x = -1; x < 5; x++) {
      const g = 150 + Math.floor(r() * 70); c.fillStyle = `rgb(${g},${g * 0.97},${g * 0.95})`;
      c.fillRect(x * bw + (y % 2 ? bw / 2 : 0) + 2, y * bh + 2, bw - 4, bh - 4);
    }
  } else if (f === 'stone') {
    c.fillStyle = '#f0f0f0'; c.fillRect(0, 0, S, S);
    let y = 0;
    while (y < S) {
      const h = 24 + r() * 30; let x = -r() * 40;
      while (x < S) { const w = 40 + r() * 60, g = 175 + Math.floor(r() * 60); c.fillStyle = `rgb(${g},${g},${g})`; c.beginPath(); c.roundRect(x + 3, y + 3, w - 6, h - 6, 6); c.fill(); x += w; }
      y += h;
    }
  } else if (f === 'marble') {
    // Large honed slabs with soft grey veins and fine joints.
    c.fillStyle = '#f4f4f4'; c.fillRect(0, 0, S, S);
    for (let k = 0; k < 14; k++) {
      c.strokeStyle = `rgba(90,90,95,${0.08 + r() * 0.18})`; c.lineWidth = 0.6 + r() * 1.6;
      c.beginPath(); let x = r() * S, y = 0; c.moveTo(x, y);
      while (y < S) { x += (r() - 0.5) * 40; y += 18 + r() * 26; c.quadraticCurveTo(x + (r() - 0.5) * 30, y - 10, x, y); }
      c.stroke();
    }
    c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(0, 0, S, 2); c.fillRect(0, 0, 2, S); c.fillRect(S / 2, 0, 2, S);
  } else if (f === 'metal') {
    // Dark metal cladding: tall panels with recessed joints and a faint sheen.
    c.fillStyle = '#d8d8d8'; c.fillRect(0, 0, S, S);
    const n = 4, bw = S / n;
    for (let i = 0; i < n; i++) {
      const g = c.createLinearGradient(i * bw, 0, (i + 1) * bw, 0);
      g.addColorStop(0, '#cfcfcf'); g.addColorStop(0.5, '#e6e6e6'); g.addColorStop(1, '#c8c8c8');
      c.fillStyle = g; c.fillRect(i * bw, 0, bw, S);
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(i * bw, 0, 3, S);
    }
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, S - 3, S, 3);
  } else if (f === 'timber') {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, S, S);
    c.fillStyle = '#3b2a20';
    const t = S * 0.07;
    c.fillRect(0, 0, t, S); c.fillRect(S / 2 - t / 2, 0, t, S);
    c.fillRect(0, S * 0.5 - t / 2, S, t);
    c.save(); c.lineWidth = t; c.strokeStyle = '#3b2a20';
    c.beginPath(); c.moveTo(0, S * 0.5); c.lineTo(S / 2, 0); c.moveTo(S / 2, S * 0.5); c.lineTo(S, S); c.stroke(); c.restore();
  }
}

/** Texture for a wall finish, or null for plain plaster. One texture tile covers `size` metres. */
export function finishTexture(f: Finish | undefined): { map: THREE.Texture; size: number } | null {
  if (!f || f === 'plaster' || typeof document === 'undefined') return null;
  if (!cache.has(f)) {
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    if (!ctx) { cache.set(f, null); return null; }
    draw(f, ctx, S);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    cache.set(f, tex);
  }
  const map = cache.get(f);
  if (!map) return null;
  return { map, size: f === 'timber' ? 2.4 : f === 'brick' ? 1.1 : f === 'stone' ? 1.6 : f === 'marble' ? 2.4 : f === 'metal' ? 2.4 : 1.2 };
}
