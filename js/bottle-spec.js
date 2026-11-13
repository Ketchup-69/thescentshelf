// Procedural bottle designs. Pure maths, no three.js, so the same description
// drives both the lightweight SVG fallback and the 3D model.
//
// Every bottle here is an original, generated shape. Silhouette comes from the
// brand's "bottleStyle", proportions from a hash of the product id, and colour
// from the scent. Nothing is modelled on a real bottle.

export const STYLES = ['orb', 'facet', 'slab', 'column', 'tear'];

export const CAP_FINISHES = {
  gold: { color: '#D8B46C', metalness: 1, roughness: 0.22 },
  rose: { color: '#D9A590', metalness: 1, roughness: 0.24 },
  silver: { color: '#D5D9E2', metalness: 1, roughness: 0.18 },
  gunmetal: { color: '#5A5F73', metalness: 1, roughness: 0.3 },
  onyx: { color: '#14141C', metalness: 0.2, roughness: 0.12 },
};

const CAPS = {
  orb: ['sphere', 'dome', 'cyl'],
  facet: ['prism', 'cyl'],
  slab: ['block', 'cyl'],
  column: ['cyl', 'taper'],
  tear: ['sphere', 'taper', 'disc'],
};

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fallbackColor(id) {
  const h = hash(id) % 360;
  return `hsl(${h}, 62%, 58%)`;
}

export function bottleSpec(product, brand) {
  const b = product.bottle || {};
  const style = STYLES.includes(b.style)
    ? b.style
    : brand && STYLES.includes(brand.bottleStyle)
      ? brand.bottleStyle
      : STYLES[hash(String(product.brand || 'x')) % STYLES.length];

  const rand = mulberry32(hash(product.id));
  const range = (lo, hi) => lo + (hi - lo) * rand();
  const pick = (arr) => arr[Math.min(arr.length - 1, Math.floor(rand() * arr.length))];

  const s = {
    id: product.id,
    style,
    color: product.color || fallbackColor(product.id),
    neckR: 0.13,
    neckH: 0.14,
    wall: 0.055,
    base: 0.11,
    collarH: 0.08,
  };

  if (style === 'orb') {
    s.R = range(0.64, 0.72);
    s.squash = range(0.86, 0.98);
    const ry = s.R * s.squash;
    s.cy = ry * 0.8;
    s.H = s.cy + ry * Math.sqrt(1 - ((s.neckR * 1.1) / s.R) ** 2);
  } else if (style === 'facet') {
    s.R = range(0.5, 0.58);
    s.H = range(1.25, 1.5);
    s.sides = rand() < 0.5 ? 6 : 8;
    s.shoulder = range(0.16, 0.26);
    s.corner = 0.05;
    s.neckR = 0.14;
  } else if (style === 'slab') {
    s.W = range(1.0, 1.16);
    s.H = range(1.3, 1.55);
    s.D = range(0.42, 0.5);
    s.corner = range(0.07, 0.14);
  } else if (style === 'column') {
    s.R = range(0.4, 0.47);
    s.H = range(1.5, 1.75);
    s.shoulder = range(0.2, 0.34);
    s.corner = range(0.04, 0.1);
  } else {
    s.R = range(0.58, 0.67);
    s.H = range(1.45, 1.68);
    s.peak = range(0.3, 0.38);
    s.baseRatio = range(0.5, 0.62);
  }

  s.fill = range(0.7, 0.82);

  const type = CAPS[style].includes(b.cap) ? b.cap : pick(CAPS[style]);
  const finish = CAP_FINISHES[b.finish] ? b.finish : pick(Object.keys(CAP_FINISHES));
  const cap = { type, finish };
  if (type === 'sphere') {
    cap.r = range(0.21, 0.26);
    cap.h = cap.r * 1.9;
  } else if (type === 'dome') {
    cap.r = range(0.22, 0.26);
    cap.h = cap.r + 0.14;
  } else if (type === 'taper') {
    cap.r = range(0.21, 0.25);
    cap.top = cap.r * range(0.62, 0.78);
    cap.h = range(0.4, 0.52);
  } else if (type === 'disc') {
    cap.r = range(0.3, 0.36);
    cap.h = 0.22;
  } else if (type === 'block') {
    cap.w = range(0.44, 0.56);
    cap.d = Math.min((s.D || 0.4) * 0.9, range(0.3, 0.36));
    cap.h = range(0.26, 0.36);
    cap.r = cap.w / 2;
  } else if (type === 'prism') {
    cap.r = range(0.22, 0.26);
    cap.h = range(0.32, 0.42);
    cap.sides = s.sides || 6;
  } else {
    cap.r = range(0.2, 0.25);
    cap.h = range(0.34, 0.46);
  }
  s.cap = cap;
  s.totalH = s.H + s.neckH + cap.h;
  return s;
}

// Outer radius of the glass body at height y (0 = base, s.H = shoulder top).
export function bodyRadius(s, y) {
  const H = s.H;
  const rn = s.neckR;
  if (s.style === 'orb') {
    const t = (y - s.cy) / (s.R * s.squash);
    return s.R * Math.sqrt(Math.max(0, 1 - t * t));
  }
  if (s.style === 'column') {
    const cb = s.corner;
    const cs = s.shoulder;
    if (y < cb) return s.R - cb + Math.sqrt(Math.max(0, cb * cb - (cb - y) ** 2));
    if (y > H - cs) {
      const t = (y - (H - cs)) / cs;
      return rn + (s.R - rn) * Math.sqrt(Math.max(0, 1 - t * t));
    }
    return s.R;
  }
  if (s.style === 'facet') {
    const cb = s.corner;
    const cs = s.shoulder;
    if (y < cb) return s.R - (cb - y) * 0.9;
    if (y > H - cs) {
      const t = (y - (H - cs)) / cs;
      return s.R + (rn * 1.25 - s.R) * t;
    }
    return s.R;
  }
  if (s.style === 'tear') {
    const t = y / H;
    let f;
    if (t < s.peak) {
      f = s.baseRatio + (1 - s.baseRatio) * Math.pow(Math.sin((Math.PI / 2) * (t / s.peak)), 0.85);
    } else {
      const u = (t - s.peak) / (1 - s.peak);
      f = 0.5 * (1 + Math.cos(Math.PI * u));
    }
    return rn + (s.R - rn) * f;
  }
  return s.W / 2;
}

function pushPoint(list, r, y) {
  const last = list[list.length - 1];
  if (last && Math.abs(last[0] - r) < 1e-4 && Math.abs(last[1] - y) < 1e-4) return;
  list.push([r, y]);
}

// Profiles for lathe-turned styles: [radius, height] pairs from the base upward.
export function lathePoints(s, n = 40) {
  const outer = [[0, 0]];
  for (let i = 0; i <= n; i++) {
    const y = (s.H * i) / n;
    pushPoint(outer, Math.max(bodyRadius(s, y), 0.002), y);
  }
  pushPoint(outer, s.neckR, s.H);
  pushPoint(outer, s.neckR, s.H + s.neckH);

  const y0 = s.base;
  const y1 = s.H * s.fill;
  const liquid = [[0, y0]];
  const m = Math.max(8, Math.round(n * 0.8));
  for (let i = 0; i <= m; i++) {
    const y = y0 + ((y1 - y0) * i) / m;
    pushPoint(liquid, Math.max(bodyRadius(s, y) - s.wall, 0.01), y);
  }
  pushPoint(liquid, 0, y1);
  return { outer, liquid };
}

// ---------------------------------------------------------------------------
// SVG fallback: shown instantly, and kept as the static render on low-power
// devices or when 3D is unavailable.
// ---------------------------------------------------------------------------
export function bottleSVG(s, uid = s.id) {
  const k = 236 / s.totalH;
  const cx = 120;
  const by = 276;
  const n = (v) => Number(v).toFixed(1);
  const X = (r) => n(cx + r * k);
  const Y = (y) => n(by - y * k);
  const id = String(uid).replace(/[^a-zA-Z0-9_-]/g, '');
  const fin = CAP_FINISHES[s.cap.finish] || CAP_FINISHES.gold;

  let body;
  let liquid;
  if (s.style === 'slab') {
    const w = s.W * k;
    const h = s.H * k;
    const rx = s.corner * k * 1.3;
    const iw = (s.W - 2 * s.wall) * k;
    const ih = (s.H * s.fill - s.base) * k;
    body =
      `<rect x="${n(cx - w / 2)}" y="${n(by - h)}" width="${n(w)}" height="${n(h)}" rx="${n(rx)}"/>` +
      `<rect x="${X(-s.neckR)}" y="${Y(s.H + s.neckH)}" width="${n(2 * s.neckR * k)}" height="${n(s.neckH * k)}"/>`;
    liquid = `<rect x="${n(cx - iw / 2)}" y="${Y(s.H * s.fill)}" width="${n(iw)}" height="${n(ih)}" rx="${n(rx * 0.6)}"/>`;
  } else {
    const pts = lathePoints(s, 26);
    const path = (list) => {
      const right = list.map(([r, y]) => `${X(r)},${Y(y)}`);
      const left = list
        .slice()
        .reverse()
        .map(([r, y]) => `${X(-r)},${Y(y)}`);
      return `<path d="M${right.join(' L')} L${left.join(' L')}Z"/>`;
    };
    body = path(pts.outer);
    liquid = path(pts.liquid);
  }

  const c = s.cap;
  const y0 = s.H + s.neckH;
  let cap;
  if (c.type === 'sphere') {
    cap = `<circle cx="${cx}" cy="${Y(y0 + c.r * 0.94)}" r="${n(c.r * k)}"/>`;
  } else if (c.type === 'dome') {
    const r = c.r * k;
    cap = `<path d="M${X(-c.r)},${Y(y0)} L${X(c.r)},${Y(y0)} L${X(c.r)},${Y(y0 + 0.14)} A${n(r)},${n(r)} 0 0 0 ${X(-c.r)},${Y(y0 + 0.14)}Z"/>`;
  } else if (c.type === 'taper') {
    cap = `<path d="M${X(-c.r)},${Y(y0)} L${X(c.r)},${Y(y0)} L${X(c.top)},${Y(y0 + c.h)} L${X(-c.top)},${Y(y0 + c.h)}Z"/>`;
  } else if (c.type === 'disc') {
    cap =
      `<rect x="${X(-0.12)}" y="${Y(y0 + 0.08)}" width="${n(0.24 * k)}" height="${n(0.08 * k)}"/>` +
      `<rect x="${X(-c.r)}" y="${Y(y0 + c.h)}" width="${n(2 * c.r * k)}" height="${n((c.h - 0.07) * k)}" rx="3"/>`;
  } else {
    cap = `<rect x="${X(-c.r)}" y="${Y(y0 + c.h)}" width="${n(2 * c.r * k)}" height="${n(c.h * k)}" rx="3"/>`;
  }
  const collarR = s.neckR + 0.045;
  const collar = `<rect x="${X(-collarR)}" y="${Y(y0)}" width="${n(2 * collarR * k)}" height="${n(s.collarH * k)}" rx="1.5"/>`;

  return (
    `<svg class="bottle__svg" viewBox="0 0 240 300" aria-hidden="true" focusable="false">` +
    `<defs>` +
    `<linearGradient id="lq-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".95"/><stop offset="1" stop-color="${s.color}" stop-opacity=".6"/></linearGradient>` +
    `<linearGradient id="gl-${id}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".24"/><stop offset=".3" stop-color="#fff" stop-opacity=".05"/><stop offset=".75" stop-color="#fff" stop-opacity=".03"/><stop offset="1" stop-color="#fff" stop-opacity=".18"/></linearGradient>` +
    `<linearGradient id="cp-${id}" x1="0" x2="1"><stop offset="0" stop-color="${fin.color}" stop-opacity=".55"/><stop offset=".35" stop-color="${fin.color}"/><stop offset=".55" stop-color="#fff" stop-opacity=".85"/><stop offset=".7" stop-color="${fin.color}"/><stop offset="1" stop-color="${fin.color}" stop-opacity=".5"/></linearGradient>` +
    `</defs>` +
    `<g fill="url(#gl-${id})" stroke="rgba(238,234,251,.42)" stroke-width="1.4" stroke-linejoin="round">${body}</g>` +
    `<g fill="url(#lq-${id})">${liquid}</g>` +
    `<g fill="url(#cp-${id})">${collar}${cap}</g>` +
    `</svg>`
  );
}
