// One page per perfume: perfume.html?id=<product id>
import { loadCatalog, cardHTML, esc, dots, priceHTML, FAMILIES, WHO, STATUS_LABEL } from './app.js';
import { profile, similar, barsHTML, ACCORDS } from './profile.js';

const rootEl = document.getElementById('perfume-root');
const TIERS = [
  ['Opens with', 'The first few minutes'],
  ['Heart', 'What it settles into'],
  ['Dries down to', 'What stays on skin and clothes'],
];

function section(label, title, body) {
  return '<section class="panel"><p class="label">' + label + '</p><h2 class="panel__title">' + title + '</h2>' + body + '</section>';
}

async function init() {
  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (err) {
    rootEl.innerHTML = '<p class="notice">This page could not be loaded. Please refresh.</p>';
    return;
  }
  const p = catalog.byId.get(new URLSearchParams(location.search).get('id') || '');
  if (!p) {
    rootEl.innerHTML = '<header class="page-head"><p class="label">Not found</p><h1>That shelf is <span class="it red">empty.</span></h1><p>We could not find that perfume.</p><p><a class="btn" href="./shop.html">Back to the shop</a></p></header>';
    return;
  }
  const pr = profile(p);
  const full = p.brandInfo.name + ' ' + p.name;
  document.title = full + ' · The Scent Shelf';
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = full + ': ' + p.notes.join(', ') + '. Scent profile, when to wear it and similar perfumes. Coming soon to The Scent Shelf.';

  const pyramid =
    '<ol class="pyramid">' +
    p.notes.slice(0, 3).map((n, i) => '<li class="pyramid__tier pyramid__tier--' + (i + 1) + '"><span class="pyramid__when">' + TIERS[i][0] + '</span><strong>' + esc(n) + '</strong><small>' + TIERS[i][1] + '</small></li>').join('') +
    '</ol>';

  const accords = barsHTML(pr.accords.map((a) => ({ label: esc(a.name), pct: a.pct, name: a.name })), (it) => ACCORDS[it.name] || 'var(--ink)');
  const wear = barsHTML(pr.wear.map((w) => ({ label: w.label, pct: w.pct })), () => 'var(--red)');
  const verdict = 'Best in <strong>' + pr.best.toLowerCase() + '</strong>, for <strong>' + pr.time + '</strong>.';

  const twins = similar(catalog, p);
  const twinIds = new Set(twins.map((x) => x.id));
  const cheaper = similar(catalog, p, { cheaper: true, limit: 8 }).filter((x) => !twinIds.has(x.id)).slice(0, 4);
  const sameHouse = catalog.products.filter((x) => x.brand === p.brand && x.id !== p.id).slice(0, 4);

  rootEl.innerHTML =
    '<nav class="crumbs label" aria-label="Breadcrumb"><a href="./shop.html">Shop</a> / <a href="./shop.html?brand=' + encodeURIComponent(p.brand) + '">' + esc(p.brandInfo.name) + '</a> / No. ' + String(p.no).padStart(3, '0') + '</nav>' +
    '<header class="pf-head">' +
      '<div class="pf-head__main">' +
        '<p class="pf-brand">' + esc(p.brandInfo.name) + '</p>' +
        '<h1 class="pf-name">' + esc(p.name) + '</h1>' +
        '<p class="pf-sum">' + esc(FAMILIES[p.family] || '') + ' · ' + esc(p.size_ml + ' ml ' + (p.concentration || '')) + ' · ' + esc(WHO[p.for] || WHO.U) + '</p>' +
        (p.image ? '<img class="pf-img" src="' + esc(p.image) + '" alt="' + esc(full) + '">' : '') +
      '</div>' +
      '<aside class="pf-buy">' +
        '<p class="status">' + STATUS_LABEL + '</p>' +
        priceHTML(p) +
        '<button class="btn btn--red btn--lg btn--block" type="button" data-waitlist="' + esc(p.id) + '">Join waitlist</button>' +
        '<p class="fineprint">Not on sale yet. Free to join, no payment is taken. The final price is confirmed at launch.</p>' +
      '</aside>' +
    '</header>' +
    '<div class="panels">' +
      section('Profile', 'Main accords', accords) +
      section('Notes', 'How it unfolds', pyramid) +
      section('Performance', 'How it wears',
        '<div class="meter"><span>Longevity</span>' + dots(p.longevity) + '</div>' +
        '<div class="meter"><span>Projection</span>' + dots(pr.projection) + '</div>' +
        '<p class="fineprint">Our estimates. Skin, heat and how much you spray all change this.</p>') +
      section('When to wear', 'Season and time', wear + '<p class="verdict">' + verdict + '</p>') +
    '</div>' +
    (twins.length ? '<section class="row"><p class="label">Close matches</p><h2>Similar on <span class="it red">the shelf.</span></h2><div class="grid">' + twins.map((x) => cardHTML(x)).join('') + '</div></section>' : '') +
    (cheaper.length ? '<section class="row"><p class="label">Our twist</p><h2>Same mood, <span class="it red">smaller price.</span></h2><p class="row__note">Perfumes with an overlapping scent profile at 60% of this price or less. A similar mood, not a copy.</p><div class="grid">' + cheaper.map((x) => cardHTML(x)).join('') + '</div></section>' : '') +
    (sameHouse.length ? '<section class="row"><p class="label">Same house</p><h2>More from <span class="it red">' + esc(p.brandInfo.name) + '.</span></h2><div class="grid">' + sameHouse.map((x) => cardHTML(x)).join('') + '</div></section>' : '') +
    '<p class="fineprint pf-foot">Scent profiles on this page are worked out by The Scent Shelf from each perfume\'s listed notes. They are a guide, not a guarantee.</p>';
}

init();
