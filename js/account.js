// "My shelf": orders, buy-5-get-1 progress, saved perfumes and preferences.
// Stored on this device only.
import { loadCatalog, cardHTML, esc, moneyHTML, inr, FAMILIES, perfumeHref } from './app.js';
import { store } from './store.js';
import { BUY_X_GET_ONE } from './config.js';

const rootEl = document.getElementById('account-root');
const NOTES = ['vanilla', 'oud', 'rose', 'citrus', 'tobacco', 'leather', 'musk', 'amber', 'coffee', 'coconut', 'sandalwood', 'jasmine', 'lavender', 'apple', 'pineapple', 'sea notes', 'spice', 'honey', 'caramel', 'saffron'];
let catalog;

function chipRow(items, picked, group) {
  return '<div class="chips chips--wrap" data-group="' + group + '">' + items.map(([v, label]) => '<button class="chip" type="button" data-v="' + esc(v) + '" aria-pressed="' + picked.includes(v) + '">' + esc(label) + '</button>').join('') + '</div>';
}

function render() {
  const orders = store.orders;
  const saved = store.saved.map((id) => catalog.byId.get(id)).filter(Boolean);
  const prefs = store.prefs;
  // Paid bottles earn stamps; free bottles already taken in an order use them up.
  const reserved = store.perfumesReserved();
  const used = orders.reduce((n, o) => n + (o.freeCount || 0), 0);
  const paid = reserved - used;
  const step = BUY_X_GET_ONE;
  const toward = paid % step;
  const credit = Math.max(0, Math.floor(paid / step) - used);
  const stamps = Array.from({ length: step }, (_, i) => '<span class="stamp-dot' + (i < toward ? ' is-on' : '') + '">' + (i + 1) + '</span>').join('') + '<span class="stamp-dot is-free' + (credit ? ' is-on' : '') + '">Free</span>';
  const c = store.contact;

  const picks = catalog.products.filter((p) => (prefs.families || []).includes(p.family) || p.notes.some((n) => (prefs.notes || []).some((x) => n.toLowerCase().includes(x))))
    .filter((p) => !store.saved.includes(p.id))
    .sort((a, b) => (a.tier === 'shelf' ? 0 : 1) - (b.tier === 'shelf' ? 0 : 1) || b.longevity - a.longevity)
    .slice(0, 4);

  rootEl.innerHTML =
    '<header class="page-head"><p class="label">My shelf</p><h1>' + (c.name ? 'Hey, <span class="it red">' + esc(c.name.split(' ')[0]) + '.</span>' : 'Your <span class="it red">shelf.</span>') + '</h1>' +
    '<p>Your orders, saved perfumes and taste, kept on this device. No password needed. Clearing your browser data will clear this page too.</p></header>' +

    '<section class="acct">' +
      '<div class="acct__card"><p class="label">Buy ' + step + ', get 1 free</p><div class="stamps">' + stamps + '</div>' +
      '<p class="offer__msg">' + (reserved ? 'You\'ve reserved ' + reserved + ' perfume' + (reserved === 1 ? '' : 's') + (used ? ', ' + used + ' of them free' : '') + '. ' : '') +
      (credit ? 'You have ' + credit + ' free bottle' + (credit === 1 ? '' : 's') + ' waiting, delivery included.' : (step - toward) + ' more and your next bottle is free, delivery included.') + '</p>' +
      '<p class="fineprint">Free bottles are applied when we confirm your orders at launch.</p></div>' +

      '<div class="acct__card"><p class="label">Order history</p>' +
      (orders.length
        ? '<ul class="orders">' + orders.map((o) => {
            const n = o.items.reduce((a, it) => a + it.qty, 0);
            const names = o.items.map((it) => { const p = catalog.byId.get(it.id); return p ? '<a href="' + perfumeHref(p) + '">' + esc(p.name) + '</a>' + (it.qty > 1 ? ' ×' + it.qty : '') : ''; }).join(', ');
            return '<li class="order"><div class="order__top"><strong>' + esc(o.ref) + '</strong><span>' + new Date(o.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + '</span></div>' +
              '<p class="order__items">' + n + ' bottle' + (n === 1 ? '' : 's') + ': ' + names + '</p>' +
              '<div class="order__bottom"><span class="status">' + esc(o.status) + (o.delivery === 'founder' ? ' · founder delivery' : '') + (o.freeCount ? ' · ' + o.freeCount + ' free' : '') + '</span>' + moneyHTML(o.total) + '</div></li>';
          }).join('') + '</ul>'
        : '<p class="empty-sm">No orders yet. <a href="./shop.html">Browse the shelf</a>.</p>') +
      '</div>' +
    '</section>' +

    '<section class="row"><p class="label">Preferences</p><h2>What you <span class="it red">love.</span></h2>' +
      '<p class="row__note">Tell us your taste and we\'ll point you at the right bottles, and send the offers that actually suit you.</p>' +
      '<h3 class="prefs__h">Scent families</h3>' + chipRow(Object.entries(FAMILIES), prefs.families || [], 'families') +
      '<h3 class="prefs__h">Notes</h3>' + chipRow(NOTES.map((n) => [n, n]), prefs.notes || [], 'notes') +
      (picks.length ? '<h3 class="prefs__h">Picked for your taste</h3><div class="grid">' + picks.map((p) => cardHTML(p)).join('') + '</div>' : '') +
    '</section>' +

    '<section class="row"><p class="label">Saved</p><h2>Your <span class="it red">list.</span></h2>' +
      (saved.length ? '<div class="grid">' + saved.map((p) => cardHTML(p)).join('') + '</div>' : '<p class="row__note">Tap the heart on any perfume to save it here.</p>') +
    '</section>';
}

async function init() {
  try {
    catalog = await loadCatalog();
  } catch (e) {
    rootEl.innerHTML = '<p class="notice">This page could not be loaded. Please refresh.</p>';
    return;
  }
  render();
  rootEl.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-group] .chip');
    if (!chip) return;
    const group = chip.parentElement.dataset.group;
    const prefs = { families: [...(store.prefs.families || [])], notes: [...(store.prefs.notes || [])] };
    const v = chip.dataset.v;
    prefs[group] = prefs[group].includes(v) ? prefs[group].filter((x) => x !== v) : [...prefs[group], v];
    store.setPrefs(prefs);
  });
  document.addEventListener('store:change', render);
}

init();
