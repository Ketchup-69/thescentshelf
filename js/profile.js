// Scent profiles. Everything here is worked out from each perfume's family,
// notes, concentration and longevity in data/products.json. No outside ratings.

// Accord name -> colour of its bar.
export const ACCORDS = {
  fresh: '#8FD3E8', citrus: '#F2D13D', marine: '#5BB8D6', green: '#8DBF5A', aromatic: '#7FB7A2',
  floral: '#F3A6C4', rosy: '#E8708F', 'white floral': '#F1E9D8', fruity: '#F58F6C', tropical: '#F7B23B',
  sweet: '#EE7F9B', vanilla: '#F0DFA6', gourmand: '#B9783F', 'warm spicy': '#D5622D', woody: '#9A7350',
  amber: '#D9902B', musky: '#DCCFE0', powdery: '#E5D5DC', leather: '#6B4A3A', tobacco: '#8A5B2B',
  oud: '#4A3327', smoky: '#77716C', boozy: '#B4532A',
};

const FAMILY_ACCORD = {
  fresh: 'fresh', citrus: 'citrus', aquatic: 'marine', green: 'green', floral: 'floral', fruity: 'fruity', sweet: 'sweet',
  spicy: 'warm spicy', woody: 'woody', amber: 'amber', musky: 'musky', leather: 'leather', oud: 'oud',
};

// Note keyword -> accords it adds.
const NOTE_RULES = [
  [/vanilla|tonka|benzoin/, ['vanilla', 'sweet']],
  [/caramel|praline|chocolate|cacao|cocoa|honey|sugar|marshmallow|creme|dulce|kulfi|almond|milk|coffee|chestnut/, ['gourmand', 'sweet']],
  [/lemon|bergamot|orange|grapefruit|mandarin|lime|citron|citrus|yuzu|kumquat|neroli|tangerine/, ['citrus', 'fresh']],
  [/rose|peony|geranium/, ['rosy', 'floral']],
  [/jasmine|tuberose|gardenia|orange blossom|ylang|white flower|lily|magnolia|frangipani|honeysuckle|freesia/, ['white floral', 'floral']],
  [/iris|orris|violet|heliotrope|mimosa|rice|powder/, ['powdery']],
  [/orchid|osmanthus|lilac|blossom|flower|floral|wisteria|narcissus|chamomile|hibiscus|lotus/, ['floral']],
  [/oud/, ['oud', 'woody']],
  [/leather|suede/, ['leather']],
  [/tobacco/, ['tobacco', 'warm spicy']],
  [/amber|labdanum|resin|myrrh|ambergris|ambroxan|amberwood/, ['amber']],
  [/musk|ambrette|soap/, ['musky']],
  [/cedar|sandalwood|vetiver|woods|wood|patchouli|birch|cypress|pine|fir|moss|oakmoss|amyris|teak|driftwood|guaiac/, ['woody']],
  [/pepper|cinnamon|cardamom|saffron|ginger|nutmeg|clove|spice|pimento|anise|licorice/, ['warm spicy']],
  [/lavender|sage|mint|rosemary|basil|herbs|thyme|juniper|tarragon|fern|absinthe|oregano/, ['aromatic', 'fresh']],
  [/sea|aquatic|marine|seaweed|salt|cucumber|water/, ['marine', 'fresh']],
  [/coconut|mango|pineapple|tropical|passion|lychee|papaya/, ['tropical', 'fruity']],
  [/apple|pear|peach|plum|berr|cherry|currant|fruit|fig|apricot|pomegranate|raspberry|quince|rhubarb|dates|strawberry/, ['fruity']],
  [/grass|tea|leaf|galbanum|green|matcha|bamboo|ivy|mate/, ['green']],
  [/incense|smoke|frankincense|flint/, ['smoky']],
  [/rum|cognac|whisky|vodka|gin|champagne|wine|brandy/, ['boozy']],
];

// How well each family suits a setting, 0 to 100. Monsoon is our own addition for India.
const WEAR = {
  //         summer monsoon winter day night
  fresh:   [95, 80, 35, 95, 45], citrus: [100, 70, 25, 100, 35], aquatic: [100, 75, 25, 95, 40], green: [85, 90, 40, 95, 40],
  floral:  [75, 70, 55, 85, 60], fruity: [85, 65, 45, 85, 60], musky: [70, 80, 60, 90, 55], woody: [55, 75, 75, 75, 75],
  spicy:   [35, 55, 90, 50, 90], sweet: [25, 45, 100, 40, 95], amber: [25, 50, 100, 40, 95], leather: [20, 45, 95, 35, 95],
  oud:     [20, 45, 100, 30, 100],
};
export const WEAR_LABELS = ['Summer', 'Monsoon', 'Winter', 'Daytime', 'Night'];

const cache = new Map();

export function profile(p) {
  if (cache.has(p.id)) return cache.get(p.id);
  const scores = new Map();
  const add = (name, value) => scores.set(name, Math.max(scores.get(name) || 0, value));
  add(FAMILY_ACCORD[p.family] || p.family, 100);
  p.notes.forEach((note, i) => {
    const n = note.toLowerCase();
    const weight = [88, 76, 66][i] || 58;
    NOTE_RULES.forEach(([re, accords]) => {
      if (re.test(n)) accords.forEach((a, j) => add(a, weight - j * 14));
    });
  });
  const accords = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, pct]) => ({ name, pct }));

  const strong = /Extrait|Parfum$/.test(p.concentration || '') ? 0.5 : /Toilette|Cologne/.test(p.concentration || '') ? -0.7 : 0;
  const heavy = ['oud', 'amber', 'sweet', 'leather', 'spicy'].includes(p.family) ? 0.4 : ['citrus', 'green', 'musky'].includes(p.family) ? -0.5 : 0;
  const projection = Math.max(1, Math.min(5, Math.round(p.longevity - 0.6 + strong + heavy)));

  const wear = (WEAR[p.family] || [60, 60, 60, 60, 60]).map((v, i) => ({ label: WEAR_LABELS[i], pct: v }));
  const best = wear.slice(0, 3).sort((a, b) => b.pct - a.pct)[0].label;
  const time = wear[3].pct >= wear[4].pct + 15 ? 'day' : wear[4].pct >= wear[3].pct + 15 ? 'night' : 'day or night';

  const result = { accords, accordSet: new Set(accords.map((a) => a.name)), projection, wear, best, time };
  cache.set(p.id, result);
  return result;
}

// 0 = nothing in common. Higher = closer.
export function closeness(a, b) {
  if (a.id === b.id) return 0;
  const pa = profile(a);
  const pb = profile(b);
  let score = a.family === b.family ? 3 : 0;
  pa.accords.forEach((x, i) => {
    if (pb.accordSet.has(x.name)) score += i < 3 ? 1.6 : 0.8;
  });
  const notesB = b.notes.join(' ').toLowerCase();
  a.notes.forEach((n) => {
    if (notesB.includes(n.toLowerCase())) score += 2.2;
  });
  score -= Math.abs(a.longevity - b.longevity) * 0.3;
  return score;
}

export function similar(catalog, p, { cheaper = false, limit = 4 } = {}) {
  let pool = catalog.products.filter((x) => x.id !== p.id);
  if (cheaper) {
    if (!p.planned_price_inr) return [];
    pool = pool.filter((x) => x.planned_price_inr && x.planned_price_inr <= p.planned_price_inr * 0.6);
  }
  return pool
    .map((x) => ({ x, s: closeness(p, x) }))
    .filter((r) => r.s >= 5)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((r) => r.x);
}

export function barsHTML(items, colour) {
  return (
    '<div class="bars">' +
    items.map((it) =>
      '<div class="bar"><span class="bar__label">' + it.label + '</span><span class="bar__track"><span class="bar__fill" style="width:' + it.pct + '%;background:' + (colour ? colour(it) : 'var(--ink)') + '"></span></span></div>'
    ).join('') +
    '</div>'
  );
}
