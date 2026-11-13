import { loadCatalog, mountCards, mountLive, paintFallback, observeReveal, whenIdle, inr, esc } from './app.js';
import { bottleSpec } from './bottle-spec.js';

// The hero bottle is the shop's own design, not a product.
const HERO = bottleSpec({ id: 'the-scent-shelf-signature', brand: 'house', color: '#8B5CF6', bottle: { style: 'tear', cap: 'sphere', finish: 'gold' } });

const heroHost = document.getElementById('hero-bottle');
if (heroHost) {
  paintFallback(heroHost, HERO);
  whenIdle(() => mountLive(heroHost, HERO, { spin: true, scrollSpin: true, drag: true, bg: '#070A1A', glow: 0.5 }));
}

const row = document.getElementById('house-row');
if (row) {
  loadCatalog()
    .then((catalog) => {
      row.innerHTML = catalog.brands
        .map((brand, i) => {
          const items = catalog.products.filter((p) => p.brand === brand.id);
          if (!items.length) return '';
          const from = Math.min(...items.map((p) => p.planned_price_inr));
          return `
<a class="house reveal" href="./shop.html#brand-${esc(brand.id)}" style="--i:${i}">
  <span class="bottle bottle--card" data-bottle="${esc(items[0].id)}"></span>
  <span class="house__meta">
    <span class="house__name">${esc(brand.name)}</span>
    <span class="house__blurb">${esc(brand.blurb || '')}</span>
    <span class="house__count">${items.length} scents · planned launch prices from ${inr(from)}</span>
  </span>
</a>`;
        })
        .join('');
      mountCards(catalog, row);
      observeReveal(row);
    })
    .catch(() => {
      row.innerHTML = '<p class="notice">The shelf could not be loaded. Please refresh the page.</p>';
    });
}
