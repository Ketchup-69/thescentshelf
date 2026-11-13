// Used by shop.html (data-tier="shelf") and lux.html (data-tier="lux").
import { loadCatalog, cardHTML, esc, FAMILIES, saving } from './app.js';

const tier = document.body.dataset.tier || 'shelf';
const rootEl = document.getElementById('shop-root');
const search = document.getElementById('f-search');
const brandSel = document.getElementById('f-brand');
const sortSel = document.getElementById('f-sort');
const famChips = document.getElementById('f-family');
const PAGE = 40;

let catalog;
let products;
let shown = PAGE;
let family = '';

function matches() {
  const q = search.value.trim().toLowerCase();
  const brand = brandSel.value;
  let list = products.filter((p) => {
    if (brand && p.brand !== brand) return false;
    if (family === 'twins') { if (!p.original) return false; }
    else if (family && p.family !== family) return false;
    if (!q) return true;
    const hay = (p.name + ' ' + p.brandInfo.name + ' ' + p.notes.join(' ') + ' ' + p.family + ' ' + (p.original ? p.original.brandInfo.name + ' ' + p.original.name : '')).toLowerCase();
    return q.split(/\s+/).every((word) => hay.includes(word));
  });
  const sort = sortSel.value;
  const price = (p) => (p.planned_price_inr ? p.planned_price_inr : Infinity);
  if (sort === 'low') list = list.slice().sort((a, b) => price(a) - price(b));
  else if (sort === 'high') list = list.slice().sort((a, b) => (b.planned_price_inr || -1) - (a.planned_price_inr || -1));
  else if (sort === 'long') list = list.slice().sort((a, b) => b.longevity - a.longevity);
  else if (sort === 'save') list = list.slice().sort((a, b) => saving(b) - saving(a));
  return list;
}

function render() {
  const list = matches();
  if (!list.length) {
    rootEl.innerHTML = '<p class="count">0 perfumes</p><p class="empty">Nothing on the shelf matches that. Try fewer filters.</p>';
    return;
  }
  rootEl.innerHTML =
    '<p class="count">' + list.length + ' perfume' + (list.length === 1 ? '' : 's') + ' · all coming soon</p>' +
    '<div class="grid">' + list.slice(0, shown).map((p) => cardHTML(p)).join('') + '</div>' +
    (list.length > shown ? '<div class="more"><button class="btn btn--line btn--lg" type="button" id="more">Show more (' + (list.length - shown) + ' left)</button></div>' : '');
}

function reset() {
  shown = PAGE;
  render();
}

async function init() {
  try {
    catalog = await loadCatalog();
  } catch (err) {
    rootEl.innerHTML = '<p class="notice">The shelf could not be loaded. Please refresh the page.</p>';
    return;
  }
  products = catalog.products.filter((p) => p.tier === tier);
  const brands = catalog.brands.filter((b) => products.some((p) => p.brand === b.id));
  const groups = [...new Set(brands.map((b) => b.group))];
  brandSel.innerHTML = '<option value="">All ' + brands.length + ' houses</option>' + groups.map((g) =>
    '<optgroup label="' + esc(g) + '">' + brands.filter((b) => b.group === g).map((b) => '<option value="' + esc(b.id) + '">' + esc(b.name) + '</option>').join('') + '</optgroup>').join('');
  const twinChip = tier === 'shelf' ? '<button class="chip chip--twin" type="button" data-fam="twins" aria-pressed="false">Smells like a designer</button>' : '';
  famChips.innerHTML = '<button class="chip" type="button" data-fam="" aria-pressed="true">All</button>' + twinChip +
    Object.entries(FAMILIES).map(([k, v]) => '<button class="chip" type="button" data-fam="' + k + '" aria-pressed="false">' + v + '</button>').join('');

  const params = new URLSearchParams(location.search);
  if (params.get('brand') && brands.some((b) => b.id === params.get('brand'))) brandSel.value = params.get('brand');
  if (params.get('q')) search.value = params.get('q');
  if (params.get('filter') === 'twins' && tier === 'shelf') {
    family = 'twins';
    famChips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.fam === 'twins')));
  }

  search.addEventListener('input', reset);
  brandSel.addEventListener('change', reset);
  sortSel.addEventListener('change', reset);
  famChips.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-fam]');
    if (!chip) return;
    family = chip.dataset.fam;
    famChips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    reset();
  });
  rootEl.addEventListener('click', (e) => {
    if (e.target.id !== 'more') return;
    shown += PAGE;
    render();
  });
  render();
}

init();
