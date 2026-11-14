// Waitlist form + (switched-off by default) priority deposit offer.
import {
  WAITLIST_ENDPOINT,
  PRIORITY_DEPOSIT_ENABLED,
  RAZORPAY_PAYMENT_LINK,
  DEPOSIT_AMOUNT_INR,
  DEPOSIT_REFUND_DAYS,
} from './config.js';
import { loadCatalog, openDialog, esc, inr } from './app.js';

// Shown next to the consent box and stored with each signup as the consent record.
const CONSENT_TEXT = 'I agree to be contacted about my waitlist request and launch updates.';

const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const params = new URLSearchParams(location.search);
const endpoint = String(WAITLIST_ENDPOINT || '').trim();
const payLink = /^https:\/\//.test(String(RAZORPAY_PAYMENT_LINK || '').trim()) ? String(RAZORPAY_PAYMENT_LINK).trim() : '';
// On your own computer only, add ?deposit=preview to the address to see the offer wording.
const depositPreview = isLocal && params.get('deposit') === 'preview';
const depositOn = (PRIORITY_DEPOSIT_ENABLED === true && !!payLink) || depositPreview;
if (PRIORITY_DEPOSIT_ENABLED === true && !payLink) {
  console.warn('PRIORITY_DEPOSIT_ENABLED is on but RAZORPAY_PAYMENT_LINK is empty, so the deposit offer stays hidden.');
}

let dialog;
let form;
let built;

function template(catalog) {
  const picker = catalog.brands
    .map((brand) => {
      const rows = catalog.products
        .filter((p) => p.brand === brand.id)
        .map(
          (p) =>
            `<label class="pick" data-s="${esc((brand.name + ' ' + p.name).toLowerCase())}"><input type="checkbox" name="perfumes" value="${esc(p.id)}"><span class="pick__name">${esc(p.name)}</span><span class="pick__meta">${esc(p.size_ml)} ml</span></label>`
        )
        .join('');
      return `<div class="pick__group"><div class="pick__brand">${esc(brand.name)}</div>${rows}</div>`;
    })
    .join('');

  const amount = inr(DEPOSIT_AMOUNT_INR);
  return `
<button class="icon-btn sheet__close" type="button" data-close aria-label="Close"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4"/></svg></button>
<div class="wl" data-view="form">
  <p class="label">Pre-launch waitlist</p>
  <h2 id="wl-title">Save your spot on the shelf</h2>
  <p>Free to join, nothing to pay. We'll message you when your picks are ready to order.</p>
  <p class="notice" id="wl-closed" hidden>The waitlist opens very soon. We're finishing setup, so we can't save your details just yet. Please check back shortly.</p>
  <form id="wl-form" novalidate>
    <div class="field">
      <label for="wl-name">Name</label>
      <input id="wl-name" name="name" class="input" type="text" autocomplete="name" maxlength="80" required>
      <p class="field__error" data-error="name" hidden></p>
    </div>
    <div class="field">
      <label for="wl-contact">Phone or email</label>
      <input id="wl-contact" name="contact" class="input" type="text" autocomplete="on" autocapitalize="none" spellcheck="false" maxlength="120" required>
      <p class="field__error" data-error="contact" hidden></p>
    </div>
    <div class="field">
      <label for="wl-city">City</label>
      <input id="wl-city" name="city" class="input" type="text" autocomplete="address-level2" maxlength="80" required>
      <p class="field__error" data-error="city" hidden></p>
    </div>
    <fieldset class="field">
      <legend>Which perfumes do you want? <span class="pick__count" id="wl-count"></span></legend>
      <input class="input" id="wl-filter" type="search" placeholder="Search a perfume or house" aria-label="Search perfumes" autocomplete="off">
      <div class="picker" id="wl-picker">${picker}</div>
      <p class="field__error" data-error="perfumes" hidden></p>
    </fieldset>
    <div class="hp" aria-hidden="true">
      <label for="wl-website">Leave this empty</label>
      <input id="wl-website" name="website" type="text" tabindex="-1" autocomplete="off">
    </div>
    <label class="check">
      <input type="checkbox" name="consent" id="wl-consent" required>
      <span>${CONSENT_TEXT} <a href="./privacy.html" target="_blank" rel="noopener">Privacy notice</a></span>
    </label>
    <p class="field__error" data-error="consent" hidden></p>
    <p class="form-error" id="wl-error" role="alert" hidden></p>
    <button class="btn btn--red btn--lg btn--block" type="submit" id="wl-submit">Join the waitlist</button>
    <p class="fineprint">We only collect what's on this form. It's never sold, and you can ask us to delete it at any time.</p>
  </form>
</div>
<div class="wl wl--done" data-view="done" hidden tabindex="-1">
  <p class="label">Done</p>
  <h2>You're on <span class="it red">the list.</span></h2>
  <p class="wl__pos" id="wl-pos" hidden></p>
  <p id="wl-done-text"></p>
  <p class="notice" id="wl-demo" hidden>Demo mode: this ran on your own computer and nothing was saved. Connect the Google Sheet (see README) to collect real signups.</p>
  <div class="deposit" id="wl-deposit" hidden>
    <p class="label">Optional</p>
    <h3>Want to move up the list?</h3>
    <p>Pay ${amount} to move up the list and lock your order. Fully refundable, and it comes off the final price.</p>
    <ul>
      <li>Fully refundable on request, no questions asked.</li>
      <li>Refunded automatically if the product doesn't launch within ${esc(DEPOSIT_REFUND_DAYS)} days of your payment.</li>
      <li>Deducted in full from your final price.</li>
    </ul>
    <a class="btn btn--red btn--block" id="wl-pay" target="_blank" rel="noopener">Pay ${amount} deposit</a>
    <p class="fineprint">Paid securely through Razorpay. Completely optional. See our <a href="./refunds.html" target="_blank" rel="noopener">Refund and Cancellation</a> page.</p>
  </div>
  <button class="btn btn--line btn--block" type="button" data-close id="wl-done-close">Back to the shelf</button>
</div>`;
}

async function build() {
  if (built) return built;
  built = (async () => {
    const catalog = await loadCatalog();
    dialog = document.createElement('dialog');
    dialog.className = 'sheet sheet--form';
    dialog.id = 'waitlist-dialog';
    dialog.setAttribute('aria-labelledby', 'wl-title');
    dialog.innerHTML = template(catalog);
    document.body.appendChild(dialog);
    form = dialog.querySelector('#wl-form');
    form.addEventListener('submit', onSubmit);
    dialog.querySelector('#wl-filter').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      dialog.querySelectorAll('.pick__group').forEach((group) => {
        let any = false;
        group.querySelectorAll('.pick').forEach((row) => {
          const show = !q || row.dataset.s.includes(q) || row.querySelector('input').checked;
          row.hidden = !show;
          if (show) any = true;
        });
        group.hidden = !any;
      });
    });
    form.addEventListener('change', (e) => {
      if (e.target.name === 'perfumes') updateCount();
    });
    form.addEventListener('input', (e) => {
      if (e.target.name) clearError(e.target.name);
    });
    if (!endpoint && !isLocal) {
      dialog.querySelector('#wl-closed').hidden = false;
      dialog.querySelector('#wl-submit').disabled = true;
    }
    const pay = dialog.querySelector('#wl-pay');
    if (payLink) pay.href = payLink;
    else pay.setAttribute('aria-disabled', 'true');
    return catalog;
  })();
  return built;
}

function view(name) {
  dialog.querySelectorAll('[data-view]').forEach((el) => {
    el.hidden = el.dataset.view !== name;
  });
  dialog.scrollTop = 0;
}

function updateCount() {
  const count = form.querySelectorAll('input[name="perfumes"]:checked').length;
  dialog.querySelector('#wl-count').textContent = count ? count + ' selected' : '';
  if (count) clearError('perfumes');
}

function setError(name, message) {
  const el = form.querySelector('[data-error="' + name + '"]');
  if (el) {
    el.textContent = message;
    el.hidden = false;
  }
  const input = form.elements[name];
  if (input && input.setAttribute) input.setAttribute('aria-invalid', 'true');
}

function clearError(name) {
  const el = form.querySelector('[data-error="' + name + '"]');
  if (el) el.hidden = true;
  const input = form.elements[name];
  if (input && input.removeAttribute) input.removeAttribute('aria-invalid');
}

function validContact(value) {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return true;
  if (/[^\d\s()+-]/.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

export async function open(ids = []) {
  await build();
  view('form');
  ids.forEach((id) => {
    const box = form.querySelector('input[name="perfumes"][value="' + CSS.escape(id) + '"]');
    if (box) box.checked = true;
  });
  updateCount();
  dialog.querySelector('#wl-error').hidden = true;
  openedAt = Date.now();
  openDialog(dialog);
  const first = ids.length && form.querySelector('input[name="perfumes"]:checked');
  if (first) {
    const picker = dialog.querySelector('#wl-picker');
    picker.scrollTop = Math.max(0, first.closest('.pick').offsetTop - 40);
  }
}

let openedAt = Date.now();

async function send(payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    // text/plain keeps this a "simple" request, which Google Apps Script accepts cross-site.
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function onSubmit(e) {
  e.preventDefault();
  const catalog = await build();
  const data = new FormData(form);
  const name = String(data.get('name') || '').trim();
  const contact = String(data.get('contact') || '').trim();
  const city = String(data.get('city') || '').trim();
  const ids = data.getAll('perfumes');
  const consent = form.elements.consent.checked;
  const errorBox = dialog.querySelector('#wl-error');
  errorBox.hidden = true;

  let firstBad = null;
  const fail = (field, message, focusEl) => {
    setError(field, message);
    if (!firstBad) firstBad = focusEl;
  };
  ['name', 'contact', 'city', 'perfumes', 'consent'].forEach(clearError);
  if (name.length < 2) fail('name', 'Please tell us your name.', form.elements.name);
  if (!validContact(contact)) fail('contact', 'Enter a phone number (10 digits) or an email address.', form.elements.contact);
  if (city.length < 2) fail('city', 'Please tell us your city.', form.elements.city);
  if (!ids.length) fail('perfumes', 'Pick at least one perfume.', form.querySelector('input[name="perfumes"]'));
  if (!consent) fail('consent', 'Please tick the box so we are allowed to contact you.', form.elements.consent);
  if (firstBad) {
    firstBad.focus();
    return;
  }

  const button = dialog.querySelector('#wl-submit');
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Saving your spot…';
  try {
    let result;
    if (data.get('website')) {
      result = { ok: true, position: null }; // filled-in trap field: a bot. Nothing is saved.
    } else if (!endpoint) {
      if (!isLocal) throw new Error('Waitlist endpoint is not configured');
      await new Promise((r) => setTimeout(r, 600));
      result = { ok: true, position: 51, demo: true };
    } else {
      result = await send({
        name,
        contact,
        city,
        perfumes: ids.map((id) => {
          const p = catalog.byId.get(id);
          return p ? p.brandInfo.name + ' ' + p.name : id;
        }),
        consent: true,
        consentText: CONSENT_TEXT,
        page: location.pathname,
        ms: Date.now() - openedAt, // how long the form was open: the sheet ignores instant, scripted posts
        website: '',
      });
    }
    if (!result || result.ok !== true) throw new Error((result && result.error) || 'Signup was not accepted');
    done(result, contact);
  } catch (err) {
    errorBox.textContent = "Sorry, that didn't go through and your spot was not saved. Please try again in a moment.";
    errorBox.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

function done(result, contact) {
  const pos = dialog.querySelector('#wl-pos');
  const n = Number(result.position);
  if (Number.isFinite(n) && n > 0) {
    pos.innerHTML = 'You are <strong>#' + n + '</strong> in line.';
    pos.hidden = false;
  } else {
    pos.hidden = true;
  }
  dialog.querySelector('#wl-done-text').textContent =
    "We'll get in touch at " + contact + ' when your picks are ready to order. Nothing to pay now.';
  dialog.querySelector('#wl-demo').hidden = !result.demo;
  dialog.querySelector('#wl-deposit').hidden = !depositOn;
  form.reset();
  updateCount();
  view('done');
  dialog.querySelector('[data-view="done"]').focus();
}
