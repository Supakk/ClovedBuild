// Tiny physics helpers for buttery motion: a spring that keeps its velocity when its target changes
// (so quick repeated taps chain smoothly), and frame-rate independent damping for zoom and pan.

/** Spring with a hair of overshoot (damping ratio ≈ 0.9), sub-stepped so it is stable at any frame rate. */
export class Spring {
  v = 0;
  target: number;
  constructor(public x = 0, private k = 210, private c = 26) { this.target = x; }
  set(t: number) { this.target = t; }
  snap(t: number) { this.x = this.target = t; this.v = 0; }
  get moving() { return Math.abs(this.x - this.target) > 1e-4 || Math.abs(this.v) > 1e-4; }
  /** Advances by dt seconds. Returns true while still moving. */
  step(dt: number) {
    if (!this.moving) { this.x = this.target; this.v = 0; return false; }
    let t = Math.min(dt, 0.064);
    while (t > 0) {
      const h = Math.min(1 / 240, t);
      this.v += (-this.k * (this.x - this.target) - this.c * this.v) * h;
      this.x += this.v * h;
      t -= h;
    }
    return true;
  }
}

/** Moves `a` towards `b` exponentially; `lambda` ≈ how many "e-foldings" per second. */
export const damp = (a: number, b: number, lambda: number, dt: number) => b + (a - b) * Math.exp(-lambda * dt);

export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
