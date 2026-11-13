// Scent Finder: scores every perfume against what the visitor typed and picked.
// Everything runs in the browser. Nothing typed here is sent anywhere.
import { loadCatalog, cardHTML, esc, FAMILIES } from './app.js';
import { profile, closeness, ACCORDS } from './profile.js';

const NOTE_CHIPS = ['vanilla', 'oud', 'rose', 'citrus', 'tobacco', 'leather', 'musk', 'amber', 'coffee', 'coconut', 'sandalwood', 'jasmine', 'lavender', 'apple', 'pineapple', 'sea notes', 'spice', 'honey'];

// Everyday words mapped to scent families.
const WORDS = {
  summer: ['fresh', 'citrus', 'aquatic', 'green'], hot: ['fresh', 'citrus', 'aquatic'], heat: ['fresh', 'citrus', 'aquatic'], humid: ['fresh', 'citrus', 'aquatic'],
  beach: ['aquatic', 'fruity', 'citrus'], holiday: ['aquatic', 'fruity'], gym: ['fresh', 'citrus', 'aquatic'], sport: ['fresh', 'citrus'],
  winter: ['sweet', 'amber', 'spicy', 'oud', 'leather'], cold: ['sweet', 'amber', 'spicy'], cozy: ['sweet', 'amber'], cosy: ['sweet', 'amber'], warm: ['amber', 'sweet', 'spicy'],
  monsoon: ['green', 'woody', 'aquatic'], rain: ['green', 'aquatic'],
  office: ['fresh', 'woody', 'musky', 'citrus'], work: ['fresh', 'woody', 'musky'], daily: ['fresh', 'woody', 'citrus', 'musky'], everyday: ['fresh', 'woody', 'citrus'], college: ['fresh', 'fruity', 'sweet'], school: ['fresh', 'citrus'],
  date: ['sweet', 'amber', 'spicy', 'floral'], night: ['sweet', 'amber', 'spicy', 'oud'], party: ['sweet', 'fruity', 'spicy'], club: ['sweet', 'spicy', 'amber'], evening: ['amber', 'spicy', 'woody'], sexy: ['sweet', 'amber', 'leather'], romantic: ['floral', 'sweet'],
  wedding: ['floral', 'oud', 'amber'], shaadi: ['floral', 'oud', 'amber'], festive: ['oud', 'amber', 'sweet'], eid: ['oud', 'amber'], diwali: ['oud', 'amber', 'sweet'],
  clean: ['fresh', 'musky', 'citrus'], soapy: ['musky', 'fresh'], light: ['citrus', 'fresh', 'floral'], crisp: ['fresh', 'citrus', 'green'], breezy: ['aquatic', 'fresh'], ocean: ['aquatic'], sea: ['aquatic'], marine: ['aquatic'], blue: ['fresh', 'aquatic'],
  dessert: ['sweet'], gourmand: ['sweet'], sugary: ['sweet'], creamy: ['sweet', 'musky'], candy: ['sweet'], chocolate: ['sweet'],
  dark: ['oud', 'leather', 'amber', 'spicy'], smoky: ['leather', 'oud', 'spicy'], bold: ['oud', 'spicy', 'leather'], heavy: ['oud', 'amber'], strong: ['oud', 'amber', 'spicy'], rich: ['amber', 'oud', 'sweet'], classy: ['woody', 'leather', 'floral'], elegant: ['floral', 'woody', 'musky'], mature: ['woody', 'leather'],
  flowers: ['floral'], flowery: ['floral'], fruit: ['fruity'], tropical: ['fruity'], juicy: ['fruity'], woods: ['woody'], wood: ['woody'], earthy: ['woody', 'green'], herbal: ['green'], arabic: ['oud', 'amber'], attar: ['oud', 'amber'],
};
const LONG_WORDS = ['long', 'lasting', 'last', 'lasts', 'beast', 'projection', 'allday'];
const CHEAP_WORDS = ['cheap', 'budget', 'affordable', 'student', 'pocket'];
const MEN_WORDS = ['men', 'man', 'him', 'boyfriend', 'husband', 'dad', 'father', 'brother', 'masculine', 'guy'];
const WOMEN_WORDS = ['women', 'woman', 'her', 'girlfriend', 'wife', 'mom', 'mum', 'mother', 'sister', 'feminine', 'girl'];

// Words that say nothing about the scent itself, so they never count as a name or note match.
const STOP = new Set([...LONG_WORDS, ...CHEAP_WORDS, ...MEN_WORDS, ...WOMEN_WORDS,
  'for', 'the', 'and', 'with', 'that', 'this', 'something', 'want', 'need', 'like', 'love', 'smell', 'smells', 'scent', 'perfume', 'fragrance',
  'not', 'too', 'very', 'really', 'good', 'best', 'nice', 'some', 'any', 'one', 'new', 'day', 'wear', 'can', 'get', 'but', 'from', 'more', 'most', 'under', 'around', 'gift']);

const form = document.getElementById('finder');
const out = document.getElementById('results');
let catalog;

function chips(el, items, multi) {
  el.innerHTML = items.map(([value, label]) => '<button class="chip" type="button" data-v="' + esc(value) + '" aria-pressed="false">' + esc(label) + '</button>').join('');
  el.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const on = chip.getAttribute('aria-pressed') === 'true';
    if (!multi) el.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
    chip.setAttribute('aria-pressed', String(!on));
  });
}
const picked = (el) => [...el.querySelectorAll('.chip[aria-pressed="true"]')].map((c) => c.dataset.v);

function suggest() {
  const text = document.getElementById('q-text').value.toLowerCase();
  const tokens = text.replace(/[^a-z0-9À-ɏ\s]/g, ' ').split(/\s+/).filter((t) => t.length > 1);
  const fams = picked(document.getElementById('q-family'));
  const notes = picked(document.getElementById('q-notes'));
  let who = picked(document.getElementById('q-who'))[0] || '';
  let minLong = Number(picked(document.getElementById('q-long'))[0] || 0);
  let budget = Number(picked(document.getElementById('q-budget'))[0] || 0);
  const where = picked(document.getElementById('q-tier'))[0] || 'shelf';

  const wantFam = new Map();
  tokens.forEach((t) => {
    if (FAMILIES[t]) wantFam.set(t, (wantFam.get(t) || 0) + 3);
    (WORDS[t] || []).forEach((f, i) => wantFam.set(f, (wantFam.get(f) || 0) + (i === 0 ? 2 : 1)));
  });
  if (!who && tokens.some((t) => MEN_WORDS.includes(t))) who = 'M';
  if (!who && tokens.some((t) => WOMEN_WORDS.includes(t))) who = 'W';
  const wantsLong = tokens.some((t) => LONG_WORDS.includes(t));
  const wantsCheap = tokens.some((t) => CHEAP_WORDS.includes(t));
  const likeText = document.getElementById('q-like').value.trim().toLowerCase();
  const liked = likeText ? catalog.products.find((p) => (p.brandInfo.name + ' ' + p.name).toLowerCase() === likeText) || catalog.products.find((p) => (p.brandInfo.name + ' ' + p.name).toLowerCase().includes(likeText)) : null;
  const asked = tokens.length || fams.length || notes.length || who || minLong || budget || liked;

  const scored = [];
  for (const p of catalog.products) {
    if (where !== 'both' && p.tier !== where) continue;
    if (who && p.for !== who && p.for !== 'U') continue;
    if (minLong && p.longevity < minLong) continue;
    if (budget && (!p.planned_price_inr || p.planned_price_inr > budget)) continue;
    if (liked && p.id === liked.id) continue;
    let score = 0;
    const why = [];
    if (liked) {
      const c = closeness(liked, p);
      if (c >= 5) { score += c * 1.3; why.push('like ' + liked.name); }
    }
    const noteText = p.notes.join(' ').toLowerCase();
    const nameText = (p.brandInfo.name + ' ' + p.name).toLowerCase();
    if (fams.includes(p.family)) { score += 5; why.push(FAMILIES[p.family].toLowerCase()); }
    else if (fams.length) score -= 2;
    if (wantFam.has(p.family)) { score += wantFam.get(p.family); if (!why.includes(FAMILIES[p.family].toLowerCase())) why.push(FAMILIES[p.family].toLowerCase()); }
    notes.forEach((n) => {
      const hit = n === 'citrus' ? /(citrus|lemon|bergamot|orange|grapefruit|mandarin|lime)/.test(noteText) || p.family === 'citrus'
        : n === 'spice' ? /(spice|pepper|cinnamon|cardamom|saffron|ginger|nutmeg|clove)/.test(noteText)
        : noteText.includes(n);
      if (hit) { score += 4; why.push(n); }
    });
    tokens.forEach((t) => {
      if (t.length < 3 || STOP.has(t) || WORDS[t]) return;
      if (noteText.includes(t)) { score += 3; if (!why.includes(t)) why.push(t); }
      if (nameText.split(/[^a-z0-9À-ɏ]+/).includes(t)) { score += 4; }
    });
    if (wantsLong) score += (p.longevity - 3) * 1.5;
    if (wantsCheap && p.planned_price_inr) score += p.planned_price_inr <= 3500 ? 3 : p.planned_price_inr <= 6000 ? 1 : -2;
    if (score <= 0 && (tokens.length || fams.length || notes.length || liked)) continue;
    score += p.longevity * 0.15;
    scored.push({ p, score, why });
  }
  scored.sort((a, b) => b.score - a.score || (a.p.planned_price_inr || 1e9) - (b.p.planned_price_inr || 1e9));

  // Keep variety: at most two perfumes from one house in the top results.
  const top = [];
  const perBrand = {};
  for (const s of scored) {
    perBrand[s.p.brand] = (perBrand[s.p.brand] || 0) + 1;
    if (perBrand[s.p.brand] > 2) continue;
    top.push(s);
    if (top.length === 8) break;
  }

  if (!asked) {
    out.innerHTML = '<div class="results__head"><p class="notice">Tell us something first: type a few words or tap a few boxes above.</p></div>';
  } else if (!top.length) {
    out.innerHTML = '<div class="results__head"><h2>No match <span class="it red">yet.</span></h2><p>Nothing on the shelf fits all of that. Try a higher budget, a lower longevity, or fewer notes.</p></div>';
  } else {
    out.innerHTML =
      '<div class="results__head"><p class="label">Your shortlist</p><h2>' + top.length + ' to <span class="it red">try first.</span></h2>' +
      '<p class="fineprint">The percentage shows how close each one is to your best match. Suggestions come from each perfume\'s listed notes and our own longevity estimates. Skin and weather change how a scent wears.</p></div>' +
      '<div class="grid">' + top.map((s, i) => {
        const why = s.why.length ? '<p class="why">Matches: ' + esc([...new Set(s.why)].slice(0, 4).join(', ')) + '</p>' : '';
        const pct = Math.max(55, Math.round((s.score / top[0].score) * 100));
        const mini = '<div class="bars bars--mini">' + profile(s.p).accords.slice(0, 3).map((a) => '<div class="bar"><span class="bar__label">' + esc(a.name) + '</span><span class="bar__track"><span class="bar__fill" style="width:' + a.pct + '%;background:' + (ACCORDS[a.name] || 'var(--ink)') + '"></span></span></div>').join('') + '</div>';
        return cardHTML(s.p, '<span class="rank">' + pct + '%</span>' + why + mini);
      }).join('') + '</div>';
  }
  out.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

async function init() {
  chips(document.getElementById('q-tier'), [['shelf', 'The shelf (affordable)'], ['lux', 'Lux (designer and niche)'], ['both', 'Both']], false);
  chips(document.getElementById('q-family'), Object.entries(FAMILIES), true);
  chips(document.getElementById('q-notes'), NOTE_CHIPS.map((n) => [n, n]), true);
  chips(document.getElementById('q-who'), [['M', 'Masculine'], ['W', 'Feminine'], ['', 'No preference']], false);
  chips(document.getElementById('q-long'), [['', 'Any'], ['3', 'Half a day'], ['4', 'Most of the day'], ['5', 'All day and more']], false);
  chips(document.getElementById('q-budget'), [['3000', 'Under ₹3,000'], ['5000', 'Under ₹5,000'], ['10000', 'Under ₹10,000'], ['20000', 'Under ₹20,000'], ['', 'No limit']], false);
  try {
    catalog = await loadCatalog();
  } catch (err) {
    out.innerHTML = '<p class="notice">The shelf could not be loaded. Please refresh the page.</p>';
    return;
  }
  document.getElementById('q-like-list').innerHTML = catalog.products.map((p) => '<option value="' + esc(p.brandInfo.name + ' ' + p.name) + '">').join('');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    suggest();
  });
  document.getElementById('finder-reset').addEventListener('click', () => {
    form.reset();
    form.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
    out.innerHTML = '';
  });
}

init();
