// Two ways of putting a 3D bottle on the page:
//  - CardShelf: ONE shared renderer paints every product card (browsers only
//    allow a handful of WebGL contexts, and phones far fewer).
//  - LiveBottle: a dedicated renderer for the hero and the product view,
//    with drag-to-rotate.
import { Studio } from './studio.js';
import { hash } from '../bottle-spec.js';

export class CardShelf {
  constructor({ tier }) {
    this.tier = tier;
    this.canvas = document.createElement('canvas');
    this.studio = new Studio(this.canvas);
    if (tier === 'high') this.studio.setSize(512, 640, 1);
    else this.studio.setSize(384, 480, 1);
    this.items = new Map();
    this.visible = new Set();
    this.cursor = 0;
    this.raf = 0;
    this.tick = this.tick.bind(this);
    this.wake = this.wake.bind(this);
    this.io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const item = this.items.get(e.target);
          if (!item) continue;
          if (e.isIntersecting) this.visible.add(item);
          else this.visible.delete(item);
        }
        this.wake();
      },
      { rootMargin: '160px 0px' }
    );
    addEventListener('scroll', this.wake, { passive: true });
    addEventListener('resize', this.wake);
    document.addEventListener('visibilitychange', this.wake);
  }

  add(host, spec) {
    if (this.items.has(host)) return;
    const cv = document.createElement('canvas');
    cv.className = 'bottle__canvas';
    cv.setAttribute('aria-hidden', 'true');
    host.appendChild(cv);
    const item = {
      host,
      cv,
      ctx: cv.getContext('2d'),
      spec,
      rot: null,
      base: ((hash(spec.id) % 100) / 100) * 0.9 - 0.45,
    };
    this.items.set(host, item);
    this.io.observe(host);
  }

  wake() {
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  tick(t) {
    this.raf = 0;
    if (document.hidden || !this.visible.size) return;
    const spin = this.tier === 'high';
    const list = [...this.visible];
    const vh = innerHeight || 1;
    let budget = spin ? 8 : 2;
    let drawn = 0;
    let pending = false;
    for (let i = 0; i < list.length; i++) {
      const item = list[(this.cursor + i) % list.length];
      let target = item.base;
      if (this.tier !== 'still') {
        const r = item.host.getBoundingClientRect();
        target += ((r.top + r.height / 2) / vh - 0.5) * 1.2;
      }
      if (spin) target += t * 0.00022;
      if (item.rot === null || Math.abs(target - item.rot) > 0.006) {
        if (budget > 0) {
          budget--;
          drawn++;
          this.draw(item, target);
        } else {
          pending = true;
        }
      }
    }
    this.cursor += drawn || 1;
    if (spin || pending) this.wake();
  }

  draw(item, rot) {
    const dpr = Math.min(devicePixelRatio || 1, this.tier === 'high' ? 2 : 1.5);
    const w = Math.round(item.host.clientWidth * dpr);
    const h = Math.round(item.host.clientHeight * dpr);
    if (!w || !h) return;
    if (item.cv.width !== w || item.cv.height !== h) {
      item.cv.width = w;
      item.cv.height = h;
    }
    this.studio.show(item.spec);
    this.studio.render(rot, 0, 0);
    item.ctx.drawImage(this.canvas, 0, 0, w, h);
    if (item.rot === null) item.host.classList.add('is-3d');
    item.rot = rot;
  }
}

export class LiveBottle {
  constructor(host, spec, { tier, drag = true, spin = true, scrollSpin = false, bg, glow } = {}) {
    this.host = host;
    this.tier = tier;
    this.spin = spin && tier !== 'still';
    this.scrollSpin = scrollSpin && tier !== 'still';
    this.rot = -0.55;
    this.vel = 0;
    this.tilt = 0;
    this.tiltTarget = 0;
    this.dirty = true;
    this.visible = false;
    this.dragging = false;
    this.last = 0;
    this.raf = 0;

    this.cv = document.createElement('canvas');
    this.cv.className = 'bottle__canvas';
    this.cv.setAttribute('aria-hidden', 'true');
    host.appendChild(this.cv);
    this.studio = new Studio(this.cv, { bg, glow });
    this.studio.show(spec);

    this.tick = this.tick.bind(this);
    this.wake = this.wake.bind(this);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.io = new IntersectionObserver((entries) => {
      this.visible = entries[entries.length - 1].isIntersecting;
      this.wake();
    });
    this.io.observe(host);
    document.addEventListener('visibilitychange', this.wake);
    if (this.scrollSpin) addEventListener('scroll', this.wake, { passive: true });
    if (drag) this.bindDrag();
    this.resize();
  }

  setSpec(spec) {
    this.studio.show(spec);
    this.rot = -0.55;
    this.vel = 0;
    this.tiltTarget = 0;
    this.invalidate();
  }

  invalidate() {
    this.dirty = true;
    this.wake();
  }

  resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, this.tier === 'high' ? 2 : 1.5);
    this.studio.setSize(w, h, dpr);
    this.invalidate();
  }

  bindDrag() {
    const cv = this.cv;
    let x = 0;
    let y = 0;
    cv.classList.add('is-draggable');
    cv.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.vel = 0;
      x = e.clientX;
      y = e.clientY;
      try {
        cv.setPointerCapture(e.pointerId);
      } catch (err) {
        /* pointer already released */
      }
      cv.classList.add('is-dragging');
      this.host.classList.add('was-dragged');
      this.wake();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - x;
      const dy = e.clientY - y;
      x = e.clientX;
      y = e.clientY;
      this.rot += dx * 0.011;
      this.vel = dx * 0.0045;
      this.tiltTarget = Math.max(-0.35, Math.min(0.35, this.tiltTarget + dy * 0.004));
      this.wake();
    });
    const end = () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.tiltTarget = 0;
      cv.classList.remove('is-dragging');
      this.wake();
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  }

  wake() {
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  tick(t) {
    this.raf = 0;
    if (!this.visible || document.hidden) return;
    const dt = Math.min(50, this.last ? t - this.last : 16);
    this.last = t;
    if (!this.dragging) {
      if (this.spin) this.rot += dt * 0.00032;
      this.rot += this.vel;
      this.vel *= 0.94;
      if (Math.abs(this.vel) < 0.0003) this.vel = 0;
    }
    this.tilt += (this.tiltTarget - this.tilt) * 0.12;
    const settling = Math.abs(this.tiltTarget - this.tilt) > 0.002;
    const rot = this.rot + (this.scrollSpin ? scrollY * 0.0022 : 0);
    const lift = this.spin ? Math.sin(t * 0.0011) * 0.03 : 0;
    this.studio.render(rot, this.tilt, lift);
    if (this.dirty) {
      this.dirty = false;
      this.host.classList.add('is-3d');
    }
    if (this.spin || this.dragging || this.vel !== 0 || settling) this.wake();
    else this.last = 0;
  }
}
