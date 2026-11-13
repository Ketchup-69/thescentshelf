// Shared behaviour for every page: device tier, catalogue loading, bottle
// mounting (SVG first, 3D when the device can take it), scroll motion, dialogs.
import { bottleSpec, bottleSVG } from './bottle-spec.js';

const root = document.documentElement;

// ---------------------------------------------------------------------------
// Device tier
//   static : SVG bottles only. No three.js download at all.
//   still  : 3D rendered once per bottle, no automatic motion (reduced motion).
//   mid    : phones and lighter laptops. Live hero, cards turn as you scroll.
//   high   : desktops. Everything live.
// Force one for testing with ?3d=off | still | mid | high
// ---------------------------------------------------------------------------
function detectTier() {
  const forced = new URLSearchParams(location.search).get('3d');
  if (forced === 'off' || forced === 'static') return 'static';
  let ok = false;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    ok = !!gl;
    const lose = gl && gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  } catch (err) {
    ok = false;
  }
  if (!ok) return 'static';
  if (forced === 'high' || forced === 'mid' || forced === 'still') return forced;
  const conn = navigator.connection;
  if (conn && conn.saveData) return 'static';
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (mem <= 2 || cores <= 2) return 'static';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'still';
  if (matchMedia('(pointer: coarse)').matches || innerWidth < 760 || cores <= 4 || mem <= 4) return 'mid';
  return 'high';
}

export const tier = detectTier();
export const motionOK = tier === 'high' || tier === 'mid';
root.dataset.tier = tier;
if (motionOK) root.classList.add('js-motion');

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------
let catalogPromise;
export function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch('./data/products.json')
      .then((r) => {
        if (!r.ok) throw new Error('Could not load products (' + r.status + ')');
        return r.json();
      })
      .then((data) => {
        const brandById = new Map(data.brands.map((b) => [b.id, b]));
        const products = data.products.map((p) => ({ ...p, brandInfo: brandById.get(p.brand) || { id: p.brand, name: p.brand } }));
        return { brands: data.brands, products, byId: new Map(products.map((p) => [p.id, p])) };
      });
  }
  return catalogPromise;
}

export const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');

export function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

const specCache = new Map();
export function specFor(product) {
  let spec = specCache.get(product.id);
  if (!spec) {
    spec = bottleSpec(product, product.brandInfo);
    specCache.set(product.id, spec);
  }
  return spec;
}

// ---------------------------------------------------------------------------
// Bottles
// ---------------------------------------------------------------------------
export function whenIdle(fn) {
  const run = () => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 250));
  if (document.readyState === 'complete') run();
  else addEventListener('load', run, { once: true });
}

let threePromise;
function loadThree() {
  if (!threePromise) {
    threePromise = import('./three/bottles.js').catch((err) => {
      console.warn('3D view unavailable, keeping the static bottles.', err);
      return null;
    });
  }
  return threePromise;
}

let shelf = null;
let shelfFailed = false;
let svgCount = 0;
const queue = [];

async function flushCards() {
  if (!queue.length || shelfFailed) return;
  const mod = await loadThree();
  if (!mod) return;
  if (!shelf) {
    try {
      shelf = new mod.CardShelf({ tier });
    } catch (err) {
      shelfFailed = true;
      console.warn('3D view unavailable, keeping the static bottles.', err);
      return;
    }
  }
  while (queue.length) {
    const [host, spec] = queue.shift();
    shelf.add(host, spec);
  }
  shelf.wake();
}

// Fills every <span class="bottle" data-bottle="product-id"> inside `scope`.
export function mountCards(catalog, scope = document) {
  scope.querySelectorAll('.bottle[data-bottle]:not([data-mounted])').forEach((host) => {
    const product = catalog.byId.get(host.dataset.bottle);
    if (!product) return;
    host.dataset.mounted = '1';
    const spec = specFor(product);
    host.style.setProperty('--tint', spec.color);
    host.insertAdjacentHTML('afterbegin', bottleSVG(spec, spec.id + '-' + svgCount++));
    if (tier !== 'static') queue.push([host, spec]);
  });
  if (queue.length) whenIdle(flushCards);
}

export function paintFallback(host, spec) {
  const old = host.querySelector('.bottle__svg');
  if (old) old.remove();
  host.style.setProperty('--tint', spec.color);
  host.insertAdjacentHTML('afterbegin', bottleSVG(spec, 'live-' + spec.id + '-' + svgCount++));
}

export async function mountLive(host, spec, opts = {}) {
  if (tier === 'static') return null;
  const mod = await loadThree();
  if (!mod) return null;
  try {
    return new mod.LiveBottle(host, spec, { tier, ...opts });
  } catch (err) {
    console.warn('3D view unavailable, keeping the static bottle.', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scroll: smooth scrolling on desktop (Lenis), reveals, parallax
// ---------------------------------------------------------------------------
let lenis = null;
let locks = 0;

export function lockScroll() {
  if (locks++ === 0) {
    root.classList.add('is-locked');
    if (lenis) lenis.stop();
  }
}
export function unlockScroll() {
  locks = Math.max(0, locks - 1);
  if (locks === 0) {
    root.classList.remove('is-locked');
    if (lenis) lenis.start();
  }
}

export function openDialog(dialog) {
  if (dialog.open) return;
  dialog.showModal();
  lockScroll();
  dialog.addEventListener('close', unlockScroll, { once: true });
}

function wireDialogs() {
  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-close]');
    if (closer) {
      const dlg = closer.closest('dialog');
      if (dlg) dlg.close();
      return;
    }
    if (e.target instanceof HTMLDialogElement && e.target.open) {
      const r = e.target.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) e.target.close();
    }
  });
}

async function initSmoothScroll() {
  if (tier !== 'high' || matchMedia('(pointer: coarse)').matches) return;
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/lenis@1.1.18/dist/lenis.mjs');
    const Lenis = mod.default;
    lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1 });
    if (locks > 0) lenis.stop();
    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  } catch (err) {
    lenis = null; // native scrolling is a perfectly good fallback
  }
}

function wireAnchors() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute('data-waitlist')) return;
    const id = a.getAttribute('href').slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: -72 });
    else target.scrollIntoView({ behavior: motionOK ? 'smooth' : 'auto', block: 'start' });
    history.replaceState(null, '', '#' + id);
  });
}

let revealIO = null;
export function observeReveal(scope = document) {
  const els = scope.querySelectorAll('.reveal:not(.is-in)');
  if (!motionOK || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  if (!revealIO) {
    revealIO = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-in');
          revealIO.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );
  }
  els.forEach((el) => revealIO.observe(el));
}

function initParallax() {
  if (!motionOK) return;
  const layers = [...document.querySelectorAll('[data-parallax]')].map((el) => ({
    el,
    speed: parseFloat(el.dataset.parallax) || 0.1,
    ref: el.closest('[data-parallax-root]') || el.parentElement,
  }));
  if (!layers.length) return;
  let queued = false;
  const update = () => {
    queued = false;
    const vh = innerHeight;
    for (const layer of layers) {
      const r = layer.ref.getBoundingClientRect();
      if (r.bottom < -240 || r.top > vh + 240) continue;
      const offset = (r.top + r.height / 2 - vh / 2) * layer.speed;
      layer.el.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0)';
    }
  };
  const request = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(update);
    }
  };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request);
  update();
}

function initHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const set = () => header.classList.toggle('is-scrolled', scrollY > 8);
  addEventListener('scroll', set, { passive: true });
  set();
}

// ---------------------------------------------------------------------------
// Waitlist (the form itself loads on first use)
// ---------------------------------------------------------------------------
export async function openWaitlist(ids = []) {
  const mod = await import('./waitlist.js');
  return mod.open(ids);
}

function wireWaitlist() {
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-waitlist]');
    if (!trigger) return;
    e.preventDefault();
    const id = trigger.getAttribute('data-waitlist');
    openWaitlist(id ? [id] : []);
  });
  if (location.hash === '#join') {
    history.replaceState(null, '', location.pathname + location.search);
    openWaitlist([]);
  }
}

wireDialogs();
wireAnchors();
wireWaitlist();
initHeader();
initParallax();
observeReveal();
whenIdle(initSmoothScroll);
