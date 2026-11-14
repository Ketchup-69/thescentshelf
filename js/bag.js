// Bag and checkout. PREVIEW ONLY: nothing is charged. Placing the order saves it
// to this device's order history and sends it to the waitlist sheet.
import { loadCatalog, esc, inr, usd, moneyHTML, toINR, toUSD, perfumeHref, sizeLine, observeReveal } from './app.js';
import { store } from './store.js';
import { shellHTML, printOrder } from './receipt.js';
import { WAITLIST_ENDPOINT, DELIVERY_FEE_INR, BUY_X_GET_ONE, FOUNDER_DELIVERY_USD } from './config.js';

const rootEl = document.getElementById('bag-root');
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const CONSENT_TEXT = 'I agree to be contacted about my reservation and launch updates.';
let catalog;
let delivery = 'standard';
const loadedAt = Date.now();

function lines() {
  return Object.entries(store.bag)
    .map(([id, qty]) => ({ p: catalog.byId.get(id), qty }))
    .filter((l) => l.p);
}

// Every (BUY_X_GET_ONE + 1)th bottle is free: the cheapest ones in the bag.
function totals(ls) {
  const unitPrices = [];
  ls.forEach((l) => { for (let i = 0; i < l.qty; i++) unitPrices.push(l.p.planned_price_inr || 0); });
  const count = unitPrices.length;
  const freeCount = Math.floor(count / (BUY_X_GET_ONE + 1));
  const sorted = unitPrices.slice().sort((a, b) => a - b);
  const freeValue = sorted.slice(0, freeCount).reduce((a, b) => a + b, 0);
  const subtotal = unitPrices.reduce((a, b) => a + b, 0);
  const unpriced = ls.some((l) => !l.p.planned_price_inr);
  const deliveryINR = delivery === 'founder' ? toINR(FOUNDER_DELIVERY_USD) : freeCount > 0 ? 0 : count ? DELIVERY_FEE_INR : 0;
  return { count, freeCount, freeValue, subtotal, deliveryINR, total: subtotal - freeValue + deliveryINR, unpriced };
}

function offerHTML(t) {
  const step = BUY_X_GET_ONE + 1;
  const inCycle = t.count % step;
  const filled = t.freeCount > 0 && inCycle === 0 ? step : inCycle;
  const need = step - inCycle;
  const msg = t.freeCount > 0 && inCycle === 0
    ? 'Your ' + (t.freeCount === 1 ? 'cheapest bottle is' : t.freeCount + ' cheapest bottles are') + ' free, and so is delivery.'
    : need === 1 ? 'Add 1 more and it\'s free, with free delivery.' : 'Add ' + need + ' more to get 1 free, with free delivery.';
  const stamps = Array.from({ length: step }, (_, i) => '<span class="stamp-dot' + (i < filled ? ' is-on' : '') + (i === step - 1 ? ' is-free' : '') + '">' + (i === step - 1 ? 'Free' : i + 1) + '</span>').join('');
  return '<div class="offer"><p class="label">Buy ' + BUY_X_GET_ONE + ', get 1 free</p><div class="stamps">' + stamps + '</div><p class="offer__msg">' + msg + '</p></div>';
}

function render() {
  const ls = lines();
  if (!ls.length) {
    rootEl.innerHTML =
      '<div class="bag-empty"><h2>Your bag is <span class="it red">empty.</span></h2><p class="lede">Smelling good shouldn\'t cost a fortune. Start with the shelf.</p>' +
      '<div class="hero__cta"><a class="btn btn--red btn--lg" href="./shop.html">Shop the shelf</a><a class="btn btn--line btn--lg" href="./find.html">Find my scent</a></div></div>';
    return;
  }
  const t = totals(ls);
  const founderINR = toINR(FOUNDER_DELIVERY_USD);
  const c = store.contact;
  rootEl.innerHTML =
    '<div class="bag">' +
    '<section class="bag__items">' +
      offerHTML(t) +
      '<ul class="lines">' + ls.map((l) =>
        '<li class="line">' +
        '<div class="line__info"><p class="card__brand">' + esc(l.p.brandInfo.name) + '</p><a class="line__name" href="' + perfumeHref(l.p) + '">' + esc(l.p.name) + '</a><p class="pf-sum">' + esc(sizeLine(l.p)) + '</p></div>' +
        '<div class="qty"><button type="button" data-qty="' + esc(l.p.id) + '" data-d="-1" aria-label="One less">−</button><span aria-live="polite">' + l.qty + '</span><button type="button" data-qty="' + esc(l.p.id) + '" data-d="1" aria-label="One more">+</button></div>' +
        '<div class="line__price">' + (l.p.planned_price_inr ? moneyHTML(l.p.planned_price_inr * l.qty) : '<span class="tba">At launch</span>') + '</div>' +
        '</li>').join('') + '</ul>' +
    '</section>' +
    '<section class="checkout">' +
      '<p class="label">Checkout</p><h2>Reserve <span class="it red">your bottles.</span></h2>' +
      '<p class="notice">Preview: nothing is charged today. We\'ll contact you when we launch to confirm and take payment.</p>' +
      '<fieldset class="field"><legend>Delivery</legend>' +
        '<label class="opt"><input type="radio" name="delivery" value="standard"' + (delivery === 'standard' ? ' checked' : '') + '><span class="opt__body"><strong>Standard delivery</strong><small>' + (t.freeCount ? 'Free with your free bottle' : 'Across India, once we launch') + '</small></span><span class="opt__price">' + (t.freeCount ? '<span class="money"><span class="money__inr">Free</span></span>' : moneyHTML(DELIVERY_FEE_INR)) + '</span></label>' +
        '<label class="opt opt--founder"><input type="radio" name="delivery" value="founder"' + (delivery === 'founder' ? ' checked' : '') + '><span class="opt__body"><strong>Personally hand-delivered by the founder</strong><small>The founder brings it to your door personally. Yes, really.</small></span><span class="opt__price"><span class="money"><span class="money__inr">' + usd(FOUNDER_DELIVERY_USD) + '</span><span class="money__usd">' + inr(founderINR) + '</span></span></span></label>' +
      '</fieldset>' +
      '<dl class="sum">' +
        '<div><dt>Perfumes (' + t.count + ')</dt><dd>' + moneyHTML(t.subtotal) + '</dd></div>' +
        (t.freeValue ? '<div class="sum__free"><dt>Free bottle' + (t.freeCount > 1 ? 's' : '') + '</dt><dd>− ' + moneyHTML(t.freeValue) + '</dd></div>' : '') +
        '<div><dt>' + (delivery === 'founder' ? 'Founder delivery' : 'Delivery') + '</dt><dd>' + (t.deliveryINR ? moneyHTML(t.deliveryINR) : '<span class="money"><span class="money__inr">Free</span></span>') + '</dd></div>' +
        '<div class="sum__total"><dt>Estimated total' + (t.unpriced ? '*' : '') + '</dt><dd>' + moneyHTML(t.total) + '</dd></div>' +
      '</dl>' +
      (t.unpriced ? '<p class="fineprint">* Some perfumes in your bag have their price announced at launch, so they are not in this total.</p>' : '') +
      '<form id="co" class="co" novalidate>' +
        '<div class="field"><label for="co-name">Name</label><input class="input" id="co-name" name="name" autocomplete="name" maxlength="80" value="' + esc(c.name || '') + '" required></div>' +
        '<div class="field"><label for="co-contact">Phone or email</label><input class="input" id="co-contact" name="contact" autocapitalize="none" maxlength="120" value="' + esc(c.contact || '') + '" required></div>' +
        '<div class="field"><label for="co-city">City</label><input class="input" id="co-city" name="city" autocomplete="address-level2" maxlength="80" value="' + esc(c.city || '') + '" required></div>' +
        '<label class="check"><input type="checkbox" name="consent" id="co-consent"><span>' + CONSENT_TEXT + ' <a href="./privacy.html" target="_blank" rel="noopener">Privacy notice</a></span></label>' +
        '<label class="check"><input type="checkbox" name="final" id="co-final"><span>I understand all sales are final once paid, except for damaged or wrong items. <a href="./refunds.html" target="_blank" rel="noopener">Refund policy</a></span></label>' +
        '<div class="hp" aria-hidden="true"><label for="co-website">Leave this empty</label><input id="co-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>' +
        '<p class="form-error" id="co-error" role="alert" hidden></p>' +
        '<button class="btn btn--red btn--lg btn--block" type="submit" id="co-submit">Reserve my order, pay at launch</button>' +
        '<p class="fineprint">USD shown at ₹' + Math.round(toINR(1)) + ' = $1, for reference. You will pay in rupees.</p>' +
      '</form>' +
    '</section>' +
    '</div>';
}

function validContact(value) {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return true;
  if (/[^\d\s()+-]/.test(value)) return false;
  const d = value.replace(/\D/g, '');
  return d.length >= 10 && d.length <= 13;
}

async function submit(form) {
  const err = document.getElementById('co-error');
  const fd = new FormData(form);
  const name = String(fd.get('name') || '').trim();
  const contact = String(fd.get('contact') || '').trim();
  const city = String(fd.get('city') || '').trim();
  const problems = [];
  if (name.length < 2) problems.push('your name');
  if (!validContact(contact)) problems.push('a 10-digit phone number or an email');
  if (city.length < 2) problems.push('your city');
  if (!form.elements.consent.checked) problems.push('the contact consent box');
  if (!form.elements.final.checked) problems.push('the final-sale box');
  if (problems.length) {
    err.textContent = 'Please add ' + problems.join(', ') + '.';
    err.hidden = false;
    return;
  }
  err.hidden = true;
  const ls = lines();
  const t = totals(ls);
  const btn = document.getElementById('co-submit');
  btn.disabled = true;
  btn.textContent = 'Reserving…';
  const perfumes = ls.map((l) => l.p.brandInfo.name + ' ' + l.p.name + (l.qty > 1 ? ' x' + l.qty : ''));
  try {
    let position = null;
    if (fd.get('website')) {
      // filled-in trap field: a bot. Nothing is sent.
    } else if (WAITLIST_ENDPOINT) {
      const res = await fetch(WAITLIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          name, contact, city, perfumes, consent: true, consentText: CONSENT_TEXT,
          page: ('checkout | ' + t.count + ' bottles | ' + (delivery === 'founder' ? 'FOUNDER DELIVERY' : 'standard') + ' | est ' + inr(t.total)).slice(0, 120),
          ms: Date.now() - loadedAt, website: '',
        }),
      });
      const data = await res.json();
      if (!data || data.ok !== true) throw new Error('not accepted');
      position = data.position;
    } else if (!isLocal) {
      throw new Error('no endpoint');
    }
    const order = {
      ref: 'TSS-' + Date.now().toString(36).toUpperCase().slice(-6),
      date: new Date().toISOString(),
      items: ls.map((l) => ({ id: l.p.id, qty: l.qty, price: l.p.planned_price_inr || null })),
      freeCount: t.freeCount, delivery, deliveryINR: t.deliveryINR, total: t.total, status: 'Reserved · not charged',
    };
    store.setContact({ name, contact, city });
    store.addOrder(order);
    store.clearBag();
    rootEl.innerHTML =
      '<div class="bag-done"><p class="label">Reserved · ' + esc(order.ref) + '</p><h2>Your bottles are <span class="it red">on hold.</span></h2>' +
      '<p class="lede">Nothing has been charged. We\'ll contact you at ' + esc(contact) + ' when we launch to confirm and take payment.</p>' +
      (position ? '<p class="wl__pos">You are <strong>#' + Number(position) + '</strong> in line.</p>' : '') +
      (delivery === 'founder' ? '<p class="notice">You picked founder hand-delivery. The founder will be in touch personally to arrange it.</p>' : '') +
      '<div class="hero__cta"><a class="btn btn--lg" href="./account.html">See my orders</a><a class="btn btn--line btn--lg" href="./shop.html">Keep browsing</a></div>' + shellHTML('order') + '</div>';
    scrollTo({ top: 0 });
    printOrder(document.getElementById('order-printer'), document.getElementById('order-paper'), order, ls, t, delivery === 'founder');
  } catch (e) {
    err.textContent = 'Sorry, that didn\'t go through and nothing was saved. Please try again in a moment.';
    err.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Reserve my order, pay at launch';
  }
}

async function init() {
  try {
    catalog = await loadCatalog();
  } catch (e) {
    rootEl.innerHTML = '<p class="notice">Your bag could not be loaded. Please refresh.</p>';
    return;
  }
  render();
  rootEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-qty]');
    if (!b) return;
    const id = b.dataset.qty;
    store.setQty(id, (store.bag[id] || 0) + Number(b.dataset.d));
  });
  rootEl.addEventListener('change', (e) => {
    if (e.target.name !== 'delivery') return;
    delivery = e.target.value;
    keepForm(render);
  });
  rootEl.addEventListener('submit', (e) => {
    if (e.target.id !== 'co') return;
    e.preventDefault();
    submit(e.target);
  });
  document.addEventListener('store:change', () => keepForm(render));
  observeReveal();
}

// Re-render without losing what was typed in the form.
function keepForm(fn) {
  const f = document.getElementById('co');
  const saved = f ? { name: f.elements.name.value, contact: f.elements.contact.value, city: f.elements.city.value, consent: f.elements.consent.checked, final: f.elements.final.checked } : null;
  fn();
  const g = document.getElementById('co');
  if (g && saved) {
    g.elements.name.value = saved.name;
    g.elements.contact.value = saved.contact;
    g.elements.city.value = saved.city;
    g.elements.consent.checked = saved.consent;
    g.elements.final.checked = saved.final;
  }
}

init();
