import { loadCatalog, mountCards, mountLive, paintFallback, openDialog, observeReveal, specFor, inr, esc, tier } from './app.js';

const rootEl = document.getElementById('shop-root');
const chips = document.getElementById('brand-chips');
const dialog = document.getElementById('product-dialog');
const stage = document.getElementById('pd-bottle');

// Nothing is in stock before launch, so every status reads the same honest way.
const STATUS_LABEL = 'Coming soon · Join waitlist';

let catalog;
let live = null;
let liveLoading = false;

function sizeLine(p) {
  return [p.size_ml ? p.size_ml + ' ml' : '', p.concentration || ''].filter(Boolean).join(' · ');
}

function card(p, i) {
  return `
<article class="card reveal" style="--i:${i % 5}">
  <button class="card__media" type="button" data-open="${esc(p.id)}" tabindex="-1" aria-hidden="true">
    <span class="bottle bottle--card" data-bottle="${esc(p.id)}"></span>
  </button>
  <div class="card__body">
    <p class="pill">${STATUS_LABEL}</p>
    <p class="card__brand">${esc(p.brandInfo.name)}</p>
    <h3 class="card__name"><button type="button" data-open="${esc(p.id)}">${esc(p.name)}</button></h3>
    <p class="card__size">${esc(sizeLine(p))}</p>
    <p class="card__line">${esc(p.line || '')}</p>
    <p class="price"><span class="price__label">Planned launch price</span><span class="price__value">${inr(p.planned_price_inr)}</span></p>
    <button class="btn btn--primary btn--block" type="button" data-waitlist="${esc(p.id)}">Join waitlist</button>
  </div>
</article>`;
}

function render() {
  chips.innerHTML = catalog.brands
    .filter((b) => catalog.products.some((p) => p.brand === b.id))
    .map((b) => `<a class="chip" href="#brand-${esc(b.id)}">${esc(b.name)}</a>`)
    .join('');
  rootEl.innerHTML = catalog.brands
    .map((brand) => {
      const items = catalog.products.filter((p) => p.brand === brand.id);
      if (!items.length) return '';
      return `
<section class="brand" id="brand-${esc(brand.id)}" aria-labelledby="h-${esc(brand.id)}">
  <header class="brand__head reveal">
    <h2 id="h-${esc(brand.id)}">${esc(brand.name)}</h2>
    <p>${esc(brand.blurb || '')}</p>
  </header>
  <div class="grid">${items.map(card).join('')}</div>
</section>`;
    })
    .join('');
  mountCards(catalog, rootEl);
  observeReveal(rootEl);
}

function openProduct(id, push = true) {
  const p = catalog.byId.get(id);
  if (!p) return;
  const spec = specFor(p);
  dialog.querySelector('#pd-brand').textContent = p.brandInfo.name;
  dialog.querySelector('#pd-name').textContent = p.name;
  dialog.querySelector('#pd-size').textContent = sizeLine(p);
  dialog.querySelector('#pd-line').textContent = p.line || '';
  dialog.querySelector('#pd-desc').textContent = p.description || '';
  dialog.querySelector('#pd-price').textContent = inr(p.planned_price_inr);
  dialog.querySelector('#pd-status').textContent = STATUS_LABEL;
  dialog.querySelector('#pd-join').setAttribute('data-waitlist', p.id);
  stage.classList.remove('was-dragged');
  paintFallback(stage, spec);
  openDialog(dialog);
  if (push) history.replaceState(null, '', '#' + p.id);

  if (live) {
    live.setSpec(spec);
  } else if (!liveLoading && tier !== 'static') {
    liveLoading = true;
    mountLive(stage, spec, { spin: true, drag: true }).then((instance) => {
      live = instance;
      liveLoading = false;
      const current = catalog.byId.get(dialog.querySelector('#pd-join').getAttribute('data-waitlist'));
      if (live && current) live.setSpec(specFor(current));
    });
  }
}

function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id && catalog.byId.has(id)) openProduct(id, false);
}

async function init() {
  try {
    catalog = await loadCatalog();
  } catch (err) {
    rootEl.innerHTML = '<p class="notice">The shelf could not be loaded. Please refresh the page.</p>';
    return;
  }
  render();
  rootEl.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open]');
    if (opener) openProduct(opener.getAttribute('data-open'));
  });
  dialog.addEventListener('close', () => {
    if (catalog.byId.has(decodeURIComponent(location.hash.slice(1)))) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  });
  addEventListener('hashchange', openFromHash);
  const hash = decodeURIComponent(location.hash.slice(1));
  if (catalog.byId.has(hash)) openProduct(hash, false);
  else if (hash) {
    const target = document.getElementById(hash);
    if (target) target.scrollIntoView();
  }
}

init();
