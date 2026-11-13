import { loadCatalog, cardHTML, esc, FAMILIES } from './app.js';

const rootEl = document.getElementById('shop-root');
const search = document.getElementById('f-search');
const brandSel = document.getElementById('f-brand');
const sortSel = document.getElementById('f-sort');
const famChips = document.getElementById('f-family');
const PAGE = 40;

let catalog;
let shown = PAGE;
let family = '';

function matches() {
  const q = search.value.trim().toLowerCase();
  const brand = brandSel.value;
  let list = catalog.products.filter((p) => {
    if (brand && p.brand !== brand) return false;
    if (family && p.family !== family) return false;
    if (!q) return true;
    const hay = (p.name + ' ' + p.brandInfo.name + ' ' + p.notes.join(' ') + ' ' + p.family).toLowerCase();
    return q.split(/\s+/).every((word) => hay.includes(word));
  });
  const sort = sortSel.value;
  const price = (p) => (p.planned_price_inr ? p.planned_price_inr : Infinity);
  if (sort === 'low') list = list.slice().sort((a, b) => price(a) - price(b));
  else if (sort === 'high') list = list.slice().sort((a, b) => (b.planned_price_inr || -1) - (a.planned_price_inr || -1));
  else if (sort === 'long') list = list.slice().sort((a, b) => b.longevity - a.longevity);
  return list;
}

function render() {
  const list = matches();
  if (!list.length) {
    rootEl.innerHTML = '<p class="count">0 perfumes</p><p class="empty">Nothing on the shelf matches that. Try fewer filters.</p>';
    return;
  }
  const slice = list.slice(0, shown);
  rootEl.innerHTML =
    '<p class="count">' + list.length + ' perfume' + (list.length === 1 ? '' : 's') + ' · all coming soon</p>' +
    '<div class="grid">' + slice.map((p) => cardHTML(p)).join('') + '</div>' +
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
  const groups = [...new Set(catalog.brands.map((b) => b.group))];
  brandSel.innerHTML = '<option value="">All 28 houses</option>' + groups.map((g) =>
    '<optgroup label="' + esc(g) + '">' + catalog.brands.filter((b) => b.group === g).map((b) => '<option value="' + esc(b.id) + '">' + esc(b.name) + '</option>').join('') + '</optgroup>').join('');
  brandSel.options[0].textContent = 'All ' + catalog.brands.length + ' houses';
  famChips.innerHTML = '<button class="chip" type="button" data-fam="" aria-pressed="true">All</button>' +
    Object.entries(FAMILIES).map(([k, v]) => '<button class="chip" type="button" data-fam="' + k + '" aria-pressed="false">' + v + '</button>').join('');

  const params = new URLSearchParams(location.search);
  if (params.get('brand') && catalog.brands.some((b) => b.id === params.get('brand'))) brandSel.value = params.get('brand');
  if (params.get('q')) search.value = params.get('q');

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
