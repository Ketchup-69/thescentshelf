import { loadCatalog, esc, observeReveal, inr, moneyHTML, saving, perfumeHref, dots } from './app.js';

const shelves = document.getElementById('shelves');
const marquee = document.getElementById('marquee');
const swaps = document.getElementById('swaps');

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
    const best = shelf
      .filter((p) => saving(p) > 0)
      .sort((a, b) => saving(b) - saving(a))
      .filter((p) => (seen.has(p.smells_like) ? false : seen.add(p.smells_like)))
      .slice(0, 6);
    swaps.innerHTML = best
      .map((p) =>
        '<a class="swap reveal" href="' + perfumeHref(p) + '">' +
        '<div class="swap__side swap__side--them"><span class="label">Instead of</span><strong>' + esc(p.original.name) + '</strong><em>' + esc(p.original.brandInfo.name) + '</em>' + moneyHTML(p.original.planned_price_inr) + '<span class="swap__lasts">Lasts ' + dots(p.original.longevity) + '</span></div>' +
        '<div class="swap__arrow" aria-hidden="true">→</div>' +
        '<div class="swap__side swap__side--us"><span class="label">Try</span><strong>' + esc(p.name) + '</strong><em>' + esc(p.brandInfo.name) + '</em>' + moneyHTML(p.planned_price_inr) + '<span class="swap__lasts">Lasts ' + dots(p.longevity) + '</span></div>' +
        '<div class="swap__save">You keep ' + inr(saving(p)) + '</div>' +
        '</a>'
      )
      .join('');

    shelves.innerHTML =
      '<div class="shelf reveal"><p class="shelf__no">The shelf · ' + shelfBrands.length + ' houses · ' + shelf.length + ' perfumes</p>' +
      '<h3 class="shelf__title">Arabic houses</h3>' +
      '<p class="shelf__brands">' + shelfBrands.map((b) => '<a href="./shop.html?brand=' + encodeURIComponent(b.id) + '">' + esc(b.name) + '</a>').join('') + '</p></div>';
    observeReveal(document);
  })
  .catch(() => {
    shelves.innerHTML = '<p class="notice">The shelf could not be loaded. Please refresh the page.</p>';
  });
