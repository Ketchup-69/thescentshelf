// Till receipts that print themselves: a swap (a shelf perfume against the designer
// bottle it smells like) and a reserved order from the bag.
import { printReceipt } from './ascii.js';
import { inr } from './app.js';

export const shellHTML = (id) =>
  '<div class="till__slip">' +
    '<div class="printer" id="' + id + '-printer"><div class="printer__top"><span><span class="led"></span>Shelf-01 · Thermal</span><span>Till receipt</span></div><div class="printer__slot"></div></div>' +
    '<div class="paper-wrap"><div class="paper" id="' + id + '-paper"></div></div>' +
  '</div>';

const conc = (c = '') => (/toilette/i.test(c) ? 'EDT' : /eau de parfum/i.test(c) ? 'EDP' : /extrait/i.test(c) ? 'EXTRAIT' : c.toUpperCase());
const sub = (x) => [x.brandInfo.name, x.size_ml ? x.size_ml + ' ML' : '', conc(x.concentration)].filter(Boolean).join(' · ');
const five = (n) => n.toFixed(1) + '/5';
const barW = () => (innerWidth < 480 ? 12 : 20);

function head(ref, now) {
  return [
    { k: 'title', text: 'The Scent Shelf' },
    { k: 'tag', text: 'Smell good. Spend less.' },
    { k: 'line', text: 'Pre-launch · India · Est. 2026' },
    { k: 'rule' },
    { k: 'kv', l: 'RECEIPT ' + ref, r: now.toLocaleDateString('en-IN') },
    { k: 'kv', l: 'TILL SHELF-01', r: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) },
    { k: 'rule' },
  ];
}

function tail(code) {
  return [
    { k: 'rule' },
    { k: 'barcode', code },
    { k: 'line', text: 'Thank you · come back smelling good' },
  ];
}

function run(printer, paper, rows) {
  printer.classList.add('is-printing');
  printReceipt(paper, rows, { onDone: () => printer.classList.remove('is-printing') });
}

let slips = 0;

// s: a shelf perfume that has an `original` with prices on both.
export function printSwap(printer, paper, s) {
  const o = s.original, now = new Date(), w = barW();
  const sp = s.planned_price_inr, op = o.planned_price_inr;
  slips++;
  const code = ('8904' + String(now.getTime()).slice(-6) + String(sp).padStart(6, '0')).slice(0, 16);
  run(printer, paper, [
    ...head(String(1040 + slips).padStart(6, '0'), now),
    { k: 'item', qty: 1, name: o.name.toUpperCase(), sub: sub(o), num: { to: op, fmt: inr }, struck: true },
    { k: 'item', qty: 1, name: s.name.toUpperCase(), sub: sub(s) + ' · smells like it', num: { to: sp, fmt: inr }, cls: 'is-shelf' },
    { k: 'rule' },
    { k: 'head', text: 'Price' },
    { k: 'meter', l: s.name.toUpperCase(), v: sp / op, w, num: { to: sp, fmt: inr } },
    { k: 'meter', l: o.name.toUpperCase(), v: 1, w, num: { to: op, fmt: inr }, cls: 'is-designer' },
    { k: 'head', text: 'How long it lasts' },
    { k: 'meter', l: s.name.toUpperCase(), v: s.longevity / 5, w, num: { to: s.longevity, fmt: five } },
    { k: 'meter', l: o.name.toUpperCase(), v: o.longevity / 5, w, num: { to: o.longevity, fmt: five }, cls: 'is-designer' },
    { k: 'rule' },
    { k: 'kv', l: 'DESIGNER PRICE', num: { to: op, fmt: inr } },
    { k: 'kv', l: 'YOU PAY', num: { to: sp, fmt: inr } },
    { k: 'rule', ch: '=' },
    { k: 'big', l: 'You keep', num: { to: op - sp, fmt: inr } },
    { k: 'rule', ch: '=' },
    { k: 'kv', l: 'BUY 5, 6TH BOTTLE', r: 'FREE' },
    { k: 'kv', l: 'DELIVERY ON THAT ORDER', r: 'FREE' },
    { k: 'kv', l: 'PAYMENT', r: 'AT LAUNCH' },
    ...tail(code),
  ]);
}

// order: what bag.js saves; lines: [{ p, qty }]; t: the bag totals.
export function printOrder(printer, paper, order, lines, t, founder) {
  const now = new Date(order.date);
  let code = '';
  for (const ch of order.ref) code += String(ch.charCodeAt(0) % 10);
  code = ('8904' + code + String(Math.round(t.total)).padStart(6, '0')).slice(0, 16);
  run(printer, paper, [
    ...head(order.ref, now),
    ...lines.map((l) => ({
      k: 'item', qty: l.qty, name: l.p.name.toUpperCase(), sub: sub(l.p),
      ...(l.p.planned_price_inr ? { num: { to: l.p.planned_price_inr * l.qty, fmt: inr } } : { r: 'AT LAUNCH' }),
    })),
    { k: 'rule' },
    { k: 'kv', l: 'BOTTLES', r: String(t.count) },
    { k: 'kv', l: 'SUBTOTAL', num: { to: t.subtotal, fmt: inr } },
    ...(t.freeCount ? [{ k: 'kv', l: t.freeCount + ' FREE (BUY 5, GET 1)', num: { to: t.freeValue, fmt: (n) => '-' + inr(n) }, cls: 'is-red' }] : []),
    founder
      ? { k: 'kv', l: 'FOUNDER HAND-DELIVERY', num: { to: t.deliveryINR, fmt: inr } }
      : { k: 'kv', l: 'DELIVERY', r: t.deliveryINR ? inr(t.deliveryINR) : 'FREE' },
    { k: 'rule', ch: '=' },
    { k: 'big', l: 'Total', num: { to: t.total, fmt: inr } },
    { k: 'rule', ch: '=' },
    { k: 'kv', l: 'CHARGED TODAY', r: inr(0) },
    { k: 'kv', l: 'PAYMENT', r: 'AT LAUNCH' },
    ...(t.unpriced ? [{ k: 'line', text: 'Some prices are confirmed at launch' }] : []),
    ...tail(code),
  ]);
}
