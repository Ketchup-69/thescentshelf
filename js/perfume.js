// One page per perfume: perfume.html?id=<product id>
import { loadCatalog, cardHTML, esc, dots, priceHTML, moneyHTML, inr, saving, perfumeHref, FAMILIES, WHO, STATUS_LABEL } from './app.js';
import { profile, similar, barsHTML, ACCORDS } from './profile.js';
import { store } from './store.js';
import { ameterHTML, animateIn, luxSky, onReveal } from './ascii.js';
import { shellHTML, printSwap } from './receipt.js';

const bar = (v, n, w) => ameterHTML(v / 5, w) + ' <span data-countup="' + n + '" data-fmt="five">' + n.toFixed(1) + '/5</span>';

const rootEl = document.getElementById('perfume-root');
const TIERS = [
  ['Opens with', 'The first few minutes'],
  ['Heart', 'What it settles into'],
  ['Dries down to', 'What stays on skin and clothes'],
];

function section(label, title, body) {
  return '<section class="panel"><p class="label">' + label + '</p><h2 class="panel__title">' + title + '</h2>' + body + '</section>';
}

function verdictRow(label, ours, theirs, oursWins) {
  return '<tr><th scope="row">' + label + '</th><td' + (oursWins === true ? ' class="win"' : '') + '>' + ours + '</td><td' + (oursWins === false ? ' class="win"' : '') + '>' + theirs + '</td></tr>';
}

function compareHTML(p) {
  const o = p.original;
  const po = profile(o);
  const pp = profile(p);
  const save = saving(p);
  const price = (x) => (x.planned_price_inr ? moneyHTML(x.planned_price_inr) : 'At launch');
  const priceWin = p.planned_price_inr && o.planned_price_inr ? p.planned_price_inr < o.planned_price_inr : null;
  const longWin = p.longevity === o.longevity ? null : p.longevity > o.longevity;
  const projWin = pp.projection === po.projection ? null : pp.projection > po.projection;
  let line = 'Smells like ' + esc(o.brandInfo.name + ' ' + o.name);
  if (save) line += ', for ' + inr(save) + ' less';
  if (longWin === true) line += ', and it lasts longer';
  line += '.';
  return (
    '<div class="vs-wrap"><section class="vs">' +
    '<p class="label">The swap</p>' +
    '<h2 class="vs__title">' + line + '</h2>' +
    '<div class="vs__scroll"><table class="vs__table">' +
    '<thead><tr><th></th><th scope="col">' + esc(p.name) + '<small>' + esc(p.brandInfo.name) + '</small></th><th scope="col"><a href="' + perfumeHref(o) + '">' + esc(o.name) + '</a><small>' + esc(o.brandInfo.name) + '</small></th></tr></thead>' +
    '<tbody>' +
    verdictRow('Price', price(p), price(o), priceWin) +
    verdictRow('Longevity', bar(p.longevity, p.longevity, 10), bar(o.longevity, o.longevity, 10), longWin) +
    verdictRow('Projection', bar(pp.projection, pp.projection, 10), bar(po.projection, po.projection, 10), projWin) +
    verdictRow('Size', esc(p.size_ml + ' ml'), esc(o.size_ml + ' ml'), null) +
    verdictRow('Notes', esc(p.notes.join(', ')), esc(o.notes.join(', ')), null) +
    '</tbody></table></div>' +
    '<p class="fineprint">"Smells like" is the comparison people make most often for this perfume. It is a different product, not made by or connected to ' + esc(o.brandInfo.name) + '. Longevity and projection are our estimates.</p>' +
    '</section>' + (p.planned_price_inr && o.planned_price_inr ? shellHTML('pf') : '') + '</div>'
  );
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
  const lux = p.tier === 'lux';
  if (lux) {
    document.documentElement.classList.add('lux');
    luxSky();
    document.querySelectorAll('.site-nav a[href="./lux.html"]').forEach((a) => a.setAttribute('aria-current', 'page'));
  }
  const pr = profile(p);
  const full = p.brandInfo.name + ' ' + p.name;
  document.title = full + ' · The Scent Shelf';
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = full + ': ' + p.notes.join(', ') + '. Scent profile, when to wear it and similar perfumes at The Scent Shelf.';

  const pyramid = '<ol class="pyramid">' + p.notes.slice(0, 3).map((n, i) => '<li class="pyramid__tier pyramid__tier--' + (i + 1) + '"><span class="pyramid__when">' + TIERS[i][0] + '</span><strong>' + esc(n) + '</strong><small>' + TIERS[i][1] + '</small></li>').join('') + '</ol>';
  const accords = barsHTML(pr.accords.map((a) => ({ label: esc(a.name), pct: a.pct, name: a.name })), (it) => ACCORDS[it.name] || 'var(--ink)');
  const aw = innerWidth < 600 ? 14 : 22;
  const wear = '<div class="abars">' + pr.wear.map((w) => '<div class="abar"><span>' + w.label + '</span>' + ameterHTML(w.pct / 100, aw) + '<span data-countup="' + Math.round(w.pct) + '">' + Math.round(w.pct) + '</span></div>').join('') + '</div>';
  const verdict = 'Best in <strong>' + pr.best.toLowerCase() + '</strong>, for <strong>' + pr.time + '</strong>.';

  const twinsHere = (catalog.twinsOf.get(p.id) || []).slice().sort((a, b) => (a.planned_price_inr || 1e9) - (b.planned_price_inr || 1e9));
  const shown = new Set([p.id, ...twinsHere.map((x) => x.id)]);
  const similarShelf = similar({ products: catalog.products.filter((x) => x.tier === 'shelf') }, p, { limit: 8 }).filter((x) => !shown.has(x.id)).slice(0, 4);
  similarShelf.forEach((x) => shown.add(x.id));
  const sameHouse = catalog.products.filter((x) => x.brand === p.brand && !shown.has(x.id)).slice(0, 4);
  const saved = store.isSaved(p.id);

  const forLess = lux
    ? (twinsHere.length
        ? '<section class="row"><p class="label">Same smell, smaller bill</p><h2>Want it for <span class="it red">less?</span></h2><p class="row__note">These are the perfumes most often compared to ' + esc(p.name) + '. Different makers, similar smell.</p><div class="grid">' + twinsHere.map((x) => cardHTML(x)).join('') + '</div></section>'
        : '') +
      (similarShelf.length ? '<section class="row"><p class="label">From the shelf</p><h2>Close in mood, <span class="it red">kinder on price.</span></h2><p class="row__note">Affordable perfumes with an overlapping scent profile. A similar mood, not a copy.</p><div class="grid">' + similarShelf.map((x) => cardHTML(x)).join('') + '</div></section>' : '')
    : (similarShelf.length ? '<section class="row"><p class="label">Close matches</p><h2>Similar on <span class="it red">the shelf.</span></h2><div class="grid">' + similarShelf.map((x) => cardHTML(x)).join('') + '</div></section>' : '');

  rootEl.innerHTML =
    '<nav class="crumbs label" aria-label="Breadcrumb"><a href="' + (lux ? './lux.html' : './shop.html') + '">' + (lux ? 'Lux' : 'Shop') + '</a> / <a href="' + (lux ? './lux.html' : './shop.html') + '?brand=' + encodeURIComponent(p.brand) + '">' + esc(p.brandInfo.name) + '</a> / No. ' + String(p.no).padStart(3, '0') + '</nav>' +
    '<header class="pf-head">' +
      '<div class="pf-head__main">' +
        '<p class="pf-brand">' + esc(p.brandInfo.name) + '</p>' +
        '<h1 class="pf-name">' + esc(p.name) + '</h1>' +
        (p.original ? '<p class="pf-twin">Smells like <a href="' + perfumeHref(p.original) + '">' + esc(p.original.brandInfo.name + ' ' + p.original.name) + '</a></p>' : '') +
        '<p class="pf-sum">' + esc(FAMILIES[p.family] || '') + ' · ' + esc(p.size_ml + ' ml ' + (p.concentration || '')) + ' · ' + esc(WHO[p.for] || WHO.U) + '</p>' +
        (p.image ? '<img class="pf-img" src="' + esc(p.image) + '" alt="' + esc(full) + '">' : '') +
      '</div>' +
      '<aside class="pf-buy">' +
        '<p class="status">' + STATUS_LABEL + '</p>' +
        priceHTML(p) +
        '<button class="btn btn--red btn--lg btn--block" type="button" data-add="' + esc(p.id) + '">Add to bag</button>' +
        '<button class="btn btn--line btn--block" type="button" data-save="' + esc(p.id) + '" aria-pressed="' + saved + '">Save to my list</button>' +
        '<p class="fineprint">Not on sale yet. Reserving is free and no payment is taken. Final price confirmed at launch.</p>' +
      '</aside>' +
    '</header>' +
    (p.original ? compareHTML(p) : '') +
    '<div class="panels">' +
      section('Profile', 'Main accords', accords) +
      section('Notes', 'How it unfolds', pyramid) +
      section('Performance', 'How it wears',
        '<div class="meter"><span>Longevity</span>' + bar(p.longevity, p.longevity, aw) + '</div>' +
        '<div class="meter"><span>Projection</span>' + bar(pr.projection, pr.projection, aw) + '</div>' +
        '<p class="fineprint">Our estimates. Skin, heat and how much you spray all change this.</p>') +
      section('When to wear', 'Season and time', wear + '<p class="verdict">' + verdict + '</p>') +
    '</div>' +
    forLess +
    (sameHouse.length ? '<section class="row"><p class="label">Same house</p><h2>More from <span class="it red">' + esc(p.brandInfo.name) + '.</span></h2><div class="grid">' + sameHouse.map((x) => cardHTML(x)).join('') + '</div></section>' : '') +
    '<p class="fineprint pf-foot">Scent profiles on this page are worked out by The Scent Shelf from each perfume\'s listed notes. They are a guide, not a guarantee.</p>';
  animateIn(rootEl);
  const printer = document.getElementById('pf-printer');
  if (printer) onReveal([printer], () => printSwap(printer, document.getElementById('pf-paper'), p));
}

init();
