import { loadCatalog, esc, observeReveal, inr, moneyHTML, saving, perfumeHref, houseHref } from './app.js';
import { textField, smoke, ameterHTML, animateIn, onReveal } from './ascii.js';
import { printSwap } from './receipt.js';

const shelves = document.getElementById('shelves');
const marquee = document.getElementById('marquee');
const swaps = document.getElementById('swaps');

// Hero: the headline drawn in characters. The real <h1> stays in the page for search engines and screen readers.
const h1 = document.querySelector('.hero .mega');
if (h1) {
  const box = document.createElement('div');
  box.className = 'hero-type';
  box.innerHTML = '<canvas class="ascii" aria-hidden="true"></canvas>';
  h1.after(box);
  h1.classList.add('vh');
  const display = (px) => '900 ' + px + 'px "Big Shoulders Display"';
  textField(box.firstChild, {
    target: box,
    // In a tall, narrow box "SMELL GOOD." splits over two lines so the letters can be bigger.
    lines: (w, h) => {
      const spend = { text: 'Spend', font: (px) => 'italic 400 ' + px + 'px "Instrument Serif"', f: 0.62, layer: 'r' };
      return w / h < 1.25
        ? [{ text: 'SMELL', font: display, f: 1 }, { text: 'GOOD.', font: display, f: 1 }, spend, { text: 'LESS.', font: display, f: 1 }]
        : [{ text: 'SMELL GOOD.', font: display, f: 1 }, spend, { text: 'LESS.', font: display, f: 1 }];
    },
  });
}

// The offer band: scent smoke the cursor pushes through.
const band = document.querySelector('.offer-band');
if (band) {
  const c = document.createElement('canvas');
  c.className = 'ascii-bg';
  c.setAttribute('aria-hidden', 'true');
  band.prepend(c);
  band.classList.add('has-smoke');
  smoke(c, { target: band });
}

loadCatalog()
  .then((catalog) => {
    const shelf = catalog.products.filter((p) => p.tier === 'shelf');
    const lux = catalog.products.filter((p) => p.tier === 'lux');
    const shelfBrands = catalog.brands.filter((b) => b.group === 'Arabic');
    const luxBrands = catalog.brands.filter((b) => b.group !== 'Arabic');
    const set = (key, v) => document.querySelectorAll('[data-count="' + key + '"]').forEach((el) => (el.textContent = v));
    set('shelf', shelf.length);
    set('shelf-brands', shelfBrands.length);
    set('lux', lux.length);
    set('lux-brands', luxBrands.length);
    const cheapest = Math.min(...shelf.filter((p) => p.planned_price_inr).map((p) => p.planned_price_inr));
    set('from', inr(cheapest));

    const names = shelfBrands.map((b) => '<span>' + esc(b.name) + '</span>').join('');
    marquee.innerHTML = names + names;

    // The swap: the biggest savings, one per designer original.
    const seen = new Set();
    const ranked = shelf.filter((p) => saving(p) > 0).sort((a, b) => saving(b) - saving(a));
    const best = ranked.filter((p) => (seen.has(p.smells_like) ? false : seen.add(p.smells_like))).slice(0, 6);
    const w = innerWidth < 600 ? 10 : 18;
    const side = (x, them, ref) =>
      '<div class="swap__side swap__side--' + (them ? 'them' : 'us') + '"><span class="label">' + (them ? 'Instead of' : 'Try') + '</span><strong>' + esc(x.name) + '</strong><em>' + esc(x.brandInfo.name) + '</em>' + moneyHTML(x.planned_price_inr) +
      '<span class="swap__bars"><span>Price</span>' + ameterHTML(x.planned_price_inr / ref, w) + '<span>Lasts</span>' + ameterHTML(x.longevity / 5, w) + '</span></div>';
    swaps.innerHTML = best
      .map((p) =>
        '<a class="swap reveal" href="' + perfumeHref(p) + '">' +
        side(p.original, true, p.original.planned_price_inr) +
        '<div class="swap__arrow" aria-hidden="true">→</div>' +
        side(p, false, p.original.planned_price_inr) +
        '<div class="swap__save">You keep <span data-countup="' + saving(p) + '" data-fmt="inr">' + inr(saving(p)) + '</span></div>' +
        '</a>'
      )
      .join('');

    shelves.innerHTML =
      '<div class="shelf reveal"><p class="shelf__no">The shelf · ' + shelfBrands.length + ' houses · ' + shelf.length + ' perfumes</p>' +
      '<h3 class="shelf__title">Arabic houses</h3>' +
      '<p class="shelf__brands">' + shelfBrands.map((b) => '<a href="' + houseHref(b.id) + '">' + esc(b.name) + '</a>').join('') + '</p></div>';
    observeReveal(document);
    animateIn(swaps);

    // The receipt: prints when it scrolls into view; "Print another" moves to the next big swap.
    const printer = document.getElementById('home-printer');
    const paper = document.getElementById('home-paper');
    const pool = ranked.filter((p) => p.planned_price_inr && p.original.planned_price_inr);
    let i = 0;
    const next = () => printSwap(printer, paper, pool[i++ % Math.min(pool.length, 12)]);
    if (printer && pool.length) {
      onReveal([printer], next);
      document.getElementById('reprint').addEventListener('click', next);
    }
  })
  .catch(() => {
    shelves.innerHTML = '<p class="notice">The shelf could not be loaded. Please refresh the page.</p>';
  });
