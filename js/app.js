// Shared behaviour for every page: catalogue loading, product cards, dialogs, waitlist.
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
        const products = data.products.map((p, i) => ({
          ...p,
          no: i + 1,
          notes: p.notes || [],
          brandInfo: brandById.get(p.brand) || { id: p.brand, name: p.brand },
        }));
        return { brands: data.brands, products, byId: new Map(products.map((p) => [p.id, p])) };
      });
  }
  return catalogPromise;
}

export const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');

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
export const STATUS_LABEL = 'Coming soon · Join waitlist';

export function dots(n) {
  const v = Math.max(0, Math.min(5, Number(n) || 0));
  return '<span class="dots" aria-label="' + v + ' out of 5">' + '●'.repeat(v) + '<i>' + '●'.repeat(5 - v) + '</i></span>';
}

export function priceHTML(p) {
  return p.planned_price_inr
    ? '<p class="price"><span>Planned launch price</span><strong>' + inr(p.planned_price_inr) + '</strong></p>'
    : '<p class="price"><span>Planned launch price</span><strong class="tba">Announced at launch</strong></p>';
}

export function sizeLine(p) {
  return [p.size_ml ? p.size_ml + ' ml' : '', SHORT[p.concentration] || p.concentration || ''].filter(Boolean).join(' ');
}

// One product card. `extra` is optional HTML shown above the brand (used by the finder).
export function cardHTML(p, extra = '') {
  const href = './perfume.html?id=' + encodeURIComponent(p.id);
  const img = p.image
    ? '<a class="card__img" href="' + href + '" tabindex="-1" aria-hidden="true"><img src="' + esc(p.image) + '" alt="" loading="lazy"></a>'
    : '';
  return (
    '<article class="card">' + img +
    '<div class="card__top"><span>No. ' + String(p.no).padStart(3, '0') + '</span><b>' + esc(FAMILIES[p.family] || '') + '</b></div>' +
    extra +
    '<p class="card__brand">' + esc(p.brandInfo.name) + '</p>' +
    '<h3 class="card__name"><a href="' + href + '">' + esc(p.name) + '</a></h3>' +
    '<p class="card__notes">' + esc(p.notes.join(' · ')) + '</p>' +
    '<div class="specs"><div><span>' + esc(sizeLine(p)) + '</span><span>Lasts ' + dots(p.longevity) + '</span></div></div>' +
    '<p class="status">' + STATUS_LABEL + '</p>' +
    priceHTML(p) +
    '<button class="btn btn--block" type="button" data-waitlist="' + esc(p.id) + '">Join waitlist</button>' +
    '</article>'
  );
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

document.addEventListener('click', (e) => {
  const closer = e.target.closest('[data-close]');
  if (closer) {
    const dlg = closer.closest('dialog');
    if (dlg) dlg.close();
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
