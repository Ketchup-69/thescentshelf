import { loadCatalog, esc, observeReveal } from './app.js';

const shelves = document.getElementById('shelves');
const marquee = document.getElementById('marquee');

loadCatalog()
  .then((catalog) => {
    document.querySelectorAll('[data-count="products"]').forEach((el) => (el.textContent = catalog.products.length));
    document.querySelectorAll('[data-count="brands"]').forEach((el) => (el.textContent = catalog.brands.length));

    const names = catalog.brands.map((b) => '<span>' + esc(b.name) + '</span>').join('');
    marquee.innerHTML = names + names;

    const groups = [...new Set(catalog.brands.map((b) => b.group))];
    const titles = { Arabic: 'Arabic houses', Designer: 'Designer houses', Niche: 'Niche houses' };
    shelves.innerHTML = groups
      .map((g, i) => {
        const brands = catalog.brands.filter((b) => b.group === g);
        return (
          '<div class="shelf reveal">' +
          '<p class="shelf__no">Shelf ' + String(i + 1).padStart(2, '0') + ' · ' + brands.length + ' houses</p>' +
          '<h3 class="shelf__title">' + esc(titles[g] || g) + '</h3>' +
          '<p class="shelf__brands">' + brands.map((b) => '<a href="./shop.html?brand=' + encodeURIComponent(b.id) + '">' + esc(b.name) + '</a>').join('') + '</p>' +
          '</div>'
        );
      })
      .join('');
    observeReveal(shelves);
  })
  .catch(() => {
    shelves.innerHTML = '<p class="notice">The shelf could not be loaded. Please refresh the page.</p>';
  });
