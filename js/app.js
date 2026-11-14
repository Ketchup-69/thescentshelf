// Shared behaviour for every page: catalogue, prices, cards, header, dialogs, waitlist.
import { USD_INR_RATE } from './config.js';
import { store } from './store.js';

const root = document.documentElement;
const motionOK = !matchMedia('(prefers-reduced-motion: reduce)').matches;
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
        const products = data.products.map((p, i) => {
          const brandInfo = brandById.get(p.brand) || { id: p.brand, name: p.brand, group: 'Niche' };
          return { ...p, no: i + 1, notes: p.notes || [], brandInfo, tier: brandInfo.group === 'Arabic' ? 'shelf' : 'lux' };
        });
        const byId = new Map(products.map((p) => [p.id, p]));
        const twinsOf = new Map();
        products.forEach((p) => {
          if (!p.smells_like || !byId.has(p.smells_like)) return;
          p.original = byId.get(p.smells_like);
          if (!twinsOf.has(p.smells_like)) twinsOf.set(p.smells_like, []);
          twinsOf.get(p.smells_like).push(p);
        });
        return { brands: data.brands, products, byId, twinsOf };
      });
  }
  return catalogPromise;
}

// ---------------------------------------------------------------------------
// Money: every price shows rupees and dollars side by side
// ---------------------------------------------------------------------------
export const inr = (n) => '₹' + Math.round(Number(n)).toLocaleString('en-IN');
export const usd = (n) => '$' + Math.round(Number(n)).toLocaleString('en-US');
export const toUSD = (rupees) => rupees / USD_INR_RATE;
export const toINR = (dollars) => dollars * USD_INR_RATE;

export function moneyHTML(rupees) {
  return '<span class="money"><span class="money__inr">' + inr(rupees) + '</span><span class="money__usd">' + usd(toUSD(rupees)) + '</span></span>';
}

export function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

export const FAMILIES = {
  fresh: 'Fresh', citrus: 'Citrus', aquatic: 'Aquatic', green: 'Green', floral: 'Floral', fruity: 'Fruity',
  sweet: 'Sweet', spicy: 'Spicy', woody: 'Woody', amber: 'Amber', musky: 'Musky', leather: 'Leather', oud: 'Oud',
};
export const WHO = { M: 'Leans masculine', W: 'Leans feminine', U: 'For anyone' };
const SHORT = { 'Eau de Parfum': 'EDP', 'Eau de Toilette': 'EDT', 'Eau de Cologne': 'EDC', 'Extrait de Parfum': 'Extrait' };

// Nothing is in stock before launch, so every product reads the same honest way.
export const STATUS_LABEL = 'Coming soon · Reserve now, pay at launch';

export function dots(n) {
  const v = Math.max(0, Math.min(5, Number(n) || 0));
  return '<span class="dots" aria-label="' + v + ' out of 5">' + '●'.repeat(v) + '<i>' + '●'.repeat(5 - v) + '</i></span>';
}

export function priceHTML(p) {
  return p.planned_price_inr
    ? '<div class="price"><span>Planned launch price</span>' + moneyHTML(p.planned_price_inr) + '</div>'
    : '<div class="price"><span>Planned launch price</span><strong class="tba">Announced at launch</strong></div>';
}

export function saving(p) {
  if (!p.original || !p.planned_price_inr || !p.original.planned_price_inr) return 0;
  return Math.max(0, p.original.planned_price_inr - p.planned_price_inr);
}

export function sizeLine(p) {
  return [p.size_ml ? p.size_ml + ' ml' : '', SHORT[p.concentration] || p.concentration || ''].filter(Boolean).join(' ');
}

export const perfumeHref = (p) => './perfume.html?id=' + encodeURIComponent(p.id);

function heart(p) {
  const on = store.isSaved(p.id);
  return '<button class="save" type="button" data-save="' + esc(p.id) + '" aria-pressed="' + on + '" aria-label="Save ' + esc(p.name) + '"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg></button>';
}

// One product card. `extra` is optional HTML shown above the brand (used by the finder).
export function cardHTML(p, extra = '') {
  const href = perfumeHref(p);
  const img = p.image ? '<a class="card__img" href="' + href + '" tabindex="-1" aria-hidden="true"><img src="' + esc(p.image) + '" alt="" loading="lazy"></a>' : '';
  const like = p.original
    ? '<p class="twin"><span>Smells like</span> ' + esc(p.original.brandInfo.name + ' ' + p.original.name) + '</p>' +
      (saving(p) ? '<p class="twin__save">Save ' + inr(saving(p)) + '</p>' : '')
    : '';
  return (
    '<article class="card">' + img +
    '<div class="card__top"><span>No. ' + String(p.no).padStart(3, '0') + '</span><b>' + esc(FAMILIES[p.family] || '') + '</b>' + heart(p) + '</div>' +
    extra +
    '<p class="card__brand">' + esc(p.brandInfo.name) + '</p>' +
    '<h3 class="card__name"><a href="' + href + '">' + esc(p.name) + '</a></h3>' +
    like +
    '<p class="card__notes">' + esc(p.notes.join(' · ')) + '</p>' +
    '<div class="specs"><div><span>' + esc(sizeLine(p)) + '</span><span>Lasts ' + dots(p.longevity) + '</span></div></div>' +
    '<p class="status">' + STATUS_LABEL + '</p>' +
    priceHTML(p) +
    '<button class="btn btn--block" type="button" data-add="' + esc(p.id) + '">Add to bag</button>' +
    '</article>'
  );
}

// ---------------------------------------------------------------------------
// Header bag count, saving, adding to bag
// ---------------------------------------------------------------------------
function updateBadge() {
  const n = store.bagCount();
  document.querySelectorAll('[data-bag-count]').forEach((el) => {
    el.textContent = n;
    el.hidden = n === 0;
  });
}
document.addEventListener('store:change', updateBadge);
updateBadge();

let toastTimer;
export function toast(html) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.innerHTML = html;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 3200);
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------
let locks = 0;
export function openDialog(dialog) {
  if (dialog.open) return;
  dialog.showModal();
  if (locks++ === 0) root.classList.add('is-locked');
  dialog.addEventListener('close', () => {
    locks = Math.max(0, locks - 1);
    if (locks === 0) root.classList.remove('is-locked');
  }, { once: true });
}

export function observeReveal(scope = document) {
  const els = scope.querySelectorAll('.reveal:not(.is-in)');
  if (!motionOK || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -6% 0px' });
  els.forEach((el) => io.observe(el));
}

export async function openWaitlist(ids = []) {
  const mod = await import('./waitlist.js');
  return mod.open(ids);
}

document.addEventListener('click', async (e) => {
  const closer = e.target.closest('[data-close]');
  if (closer) {
    const dlg = closer.closest('dialog');
    if (dlg) dlg.close();
    return;
  }
  const add = e.target.closest('[data-add]');
  if (add) {
    const id = add.getAttribute('data-add');
    store.add(id);
    const catalog = await loadCatalog();
    const p = catalog.byId.get(id);
    toast('Added <strong>' + esc(p ? p.name : 'perfume') + '</strong> to your bag. <a href="./bag.html">View bag (' + store.bagCount() + ')</a>');
    return;
  }
  const save = e.target.closest('[data-save]');
  if (save) {
    const on = store.toggleSaved(save.getAttribute('data-save'));
    document.querySelectorAll('[data-save="' + CSS.escape(save.getAttribute('data-save')) + '"]').forEach((b) => b.setAttribute('aria-pressed', String(on)));
    toast(on ? 'Saved to your list. <a href="./account.html">See your list</a>' : 'Removed from your list.');
    return;
  }
  const join = e.target.closest('[data-waitlist]');
  if (join) {
    e.preventDefault();
    const id = join.getAttribute('data-waitlist');
    openWaitlist(id ? [id] : []);
    return;
  }
  if (e.target instanceof HTMLDialogElement && e.target.open) {
    const r = e.target.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close();
  }
});

if (location.hash === '#join') {
  history.replaceState(null, '', location.pathname + location.search);
  openWaitlist([]);
}
observeReveal();

// Animated ASCII: live night skies in the dark bands and on Lux, labels that decode.
import('./ascii.js').then(({ skies, luxSky, animateIn }) => {
  skies();
  if (root.classList.contains('lux')) luxSky();
  animateIn();
}).catch(() => {});
