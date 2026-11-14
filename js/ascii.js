// Animated ASCII for The Scent Shelf.
// Every effect draws monospace characters on a <canvas>: sharp on high-density
// screens, paused when off-screen or the tab is hidden, and a single still
// frame for visitors whose device asks for reduced motion.

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const RAMP = ' .,:;-=+*o#%@';
const GLYPHS = '#%&*+=-:;/\\|<>01';
const LAYERS = ['a', 'b', 'r'];
const THEMES = {
  paper: (s) => ({ a: 'rgba(17,16,16,.28)', b: s('--ink') || '#111010', r: s('--red') || '#E10A1E' }),
  dark: (s) => ({ a: 'rgba(243,238,230,.34)', b: 'rgba(243,238,230,.95)', r: s('--red') || '#E10A1E' }),
  red: () => ({ a: 'rgba(255,255,255,.4)', b: '#FFFFFF', r: '#111010' }),
};

function mount(canvas, { cell = 10, theme = 'paper', weight = '400', bold = 0, target, frame, setup, press }) {
  const ctx = canvas.getContext('2d');
  const root = getComputedStyle(document.documentElement);
  const s = (n) => root.getPropertyValue(n).trim();
  const mono = s('--mono') || 'monospace';
  const st = { cols: 0, rows: 0, cw: 6, ch: 10, w: 0, h: 0, t: 0, px: 0, py: 0, sx: 0, sy: 0, pin: false, buf: {}, colors: THEMES[theme](s) };
  let raf = 0, visible = false, last = 0;

  st.refresh = () => resize();
  st.put = (x, y, c, layer = 'b') => {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= st.cols || y >= st.rows) return;
    const i = y * st.cols + x;
    st.buf.a[i] = st.buf.b[i] = st.buf.r[i] = ' ';
    st.buf[layer][i] = c;
  };

  function draw(now) {
    st.t = now / 1000;
    if (st.pin) { st.sx += (st.px - st.sx) * 0.14; st.sy += (st.py - st.sy) * 0.14; }
    for (const k of LAYERS) st.buf[k].fill(' ');
    frame(st);
    ctx.clearRect(0, 0, st.w, st.h);
    ctx.font = weight + ' ' + st.ch + 'px ' + mono;
    ctx.textBaseline = 'top';
    // "bold" thickens every character with an outline in the same colour
    if (bold) { ctx.lineWidth = st.ch * bold; ctx.lineJoin = 'round'; }
    for (const k of LAYERS) {
      ctx.fillStyle = ctx.strokeStyle = st.colors[k];
      const b = st.buf[k];
      for (let y = 0; y < st.rows; y++) {
        const line = b.slice(y * st.cols, (y + 1) * st.cols).join('');
        if (!line.trim()) continue;
        ctx.fillText(line, 0, y * st.ch);
        if (bold) ctx.strokeText(line, 0, y * st.ch);
      }
    }
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    st.w = r.width; st.h = r.height;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    st.ch = typeof cell === 'function' ? cell(r.width) : cell;
    ctx.font = weight + ' ' + st.ch + 'px ' + mono;
    st.cw = ctx.measureText('M').width || st.ch * 0.6;
    st.cols = Math.ceil(r.width / st.cw);
    st.rows = Math.ceil(r.height / st.ch);
    for (const k of LAYERS) st.buf[k] = new Array(st.cols * st.rows).fill(' ');
    if (setup) setup(st);
    if (!raf) draw(REDUCED ? 6000 : performance.now());
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - last < 25) return; // about 40 frames a second is plenty for ASCII
    last = now;
    draw(now);
  }
  const start = () => { if (!REDUCED && !raf && visible && !document.hidden && st.cols) raf = requestAnimationFrame(loop); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }, { rootMargin: '80px' }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  new ResizeObserver(() => { resize(); start(); }).observe(canvas);
  if (document.fonts) document.fonts.ready.then(resize);

  const zone = target || canvas;
  const at = (e) => { const r = canvas.getBoundingClientRect(); st.px = (e.clientX - r.left) / st.cw; st.py = (e.clientY - r.top) / st.ch; };
  zone.addEventListener('pointermove', (e) => { at(e); if (!st.pin) { st.sx = st.px; st.sy = st.py; } st.pin = true; });
  zone.addEventListener('pointerleave', () => { st.pin = false; });
  if (press) zone.addEventListener('pointerdown', (e) => { at(e); press(st); });
  return st;
}

// Picks a line character that matches the direction on screen.
function slopeChar(dx, dy) {
  const deg = Math.abs(Math.atan2(dy, dx)) * 180 / Math.PI;
  if (deg < 22.5 || deg > 157.5) return '-';
  if (deg > 67.5 && deg < 112.5) return '|';
  return (dx > 0) === (dy > 0) ? '\\' : '/';
}

/* ---------- Stars: a night sky that shifts with you ---------- */

export function stars(canvas, o = {}) {
  let list = [], shoot = null, nextShoot = 0, pax = 0, pay = 0;
  return mount(canvas, {
    cell: o.cell || 12,
    theme: o.theme || 'dark',
    target: o.target,
    setup(st) {
      const n = Math.round(st.cols * st.rows * (o.density || 0.022));
      list = Array.from({ length: n }, () => ({ x: Math.random(), y: Math.random(), z: 0.25 + Math.random() * 0.75, ph: Math.random() * 6.28, sp: 0.6 + Math.random() * 2.2, red: Math.random() < 0.05 }));
    },
    frame(st) {
      const { cols, rows, cw, ch, t } = st;
      pax += ((st.pin ? st.sx / cols - 0.5 : 0) - pax) * 0.06;
      pay += ((st.pin ? st.sy / rows - 0.5 : 0) - pay) * 0.06;
      const pts = [], near = [];
      for (const s of list) {
        const x = s.x * cols - pax * s.z * 10, y = s.y * rows - pay * s.z * 5;
        let b = (0.5 + 0.5 * Math.sin(t * s.sp + s.ph)) * s.z;
        if (st.pin) {
          const dx = (x - st.sx) * cw, dy = (y - st.sy) * ch, d = Math.sqrt(dx * dx + dy * dy);
          if (d < 150) { b = Math.max(b, 1 - d / 150); if (s.z > 0.45) near.push({ x, y, d }); }
        }
        pts.push([x, y, b, s.red]);
      }
      // constellations between the stars closest to the cursor
      near.sort((p, q) => p.d - q.d);
      const group = near.slice(0, 7);
      for (let i = 1; i < group.length; i++) {
        let best = group[0], bd = Infinity;
        for (let j = 0; j < i; j++) {
          const dx = (group[i].x - group[j].x) * cw, dy = (group[i].y - group[j].y) * ch, d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = group[j]; }
        }
        const a = group[i], c = slopeChar((best.x - a.x) * cw, (best.y - a.y) * ch);
        const steps = Math.max(Math.abs(best.x - a.x), Math.abs(best.y - a.y)) | 0;
        for (let k = 1; k < steps; k++) st.put(a.x + ((best.x - a.x) * k) / steps, a.y + ((best.y - a.y) * k) / steps, c, 'a');
      }
      for (const [x, y, b, red] of pts) {
        const c = b > 0.78 ? '*' : b > 0.55 ? '+' : b > 0.3 ? '·' : '.';
        st.put(x, y, c, red ? 'r' : b > 0.5 ? 'b' : 'a');
      }
      // the odd shooting star
      if (!nextShoot) nextShoot = t + 1.5;
      if (!REDUCED && !shoot && t > nextShoot) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        shoot = { x: cols * (dir > 0 ? 0.1 + Math.random() * 0.4 : 0.5 + Math.random() * 0.4), y: rows * Math.random() * 0.3, vx: dir * (1.6 + Math.random() * 1.2), vy: 0.45 + Math.random() * 0.35 };
        nextShoot = t + 4 + Math.random() * 5;
      }
      if (shoot) {
        shoot.x += shoot.vx; shoot.y += shoot.vy;
        const c = slopeChar(shoot.vx * cw, shoot.vy * ch);
        for (let i = 12; i > 0; i--) st.put(shoot.x - shoot.vx * i * 0.5, shoot.y - shoot.vy * i * 0.5, c, i < 5 ? 'b' : 'a');
        st.put(shoot.x, shoot.y, '*', 'b');
        if (shoot.y > rows + 4 || shoot.x < -20 || shoot.x > cols + 20) shoot = null;
      }
    },
  });
}

/* ---------- Smoke: scent drifting across a band; the cursor stirs it ---------- */

export function smoke(canvas, o = {}) {
  return mount(canvas, {
    cell: o.cell || 11,
    theme: o.theme || 'red',
    target: o.target,
    frame(st) {
      const { cols, rows, cw, ch, t } = st;
      const pxx = st.sx * cw, pyy = st.sy * ch;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let X = x * cw, Y = y * ch, ring = 0;
          if (st.pin) {
            const dx = X - pxx, dy = Y - pyy, d = Math.sqrt(dx * dx + dy * dy) + 1, f = Math.exp(-d / 170);
            X += (dx / d) * f * 90; Y += (dy / d) * f * 90;
            ring = Math.sin(d * 0.06 - t * 5) * f * 0.55;
          }
          const nx = X * 0.006, ny = Y * 0.011 + t * 0.25;
          let v = Math.sin(nx * 2.1 + t * 0.5 + Math.sin(ny * 1.7 + t * 0.3) * 1.6)
            + Math.sin(ny * 2.3 - t * 0.4 + Math.sin(nx * 1.3 - t * 0.2) * 1.4)
            + Math.sin((nx + ny) * 1.2 + t * 0.35) * 0.6;
          v = v / 2.6 + ring;
          if (v < 0.2) continue;
          const k = Math.min(1, (v - 0.2) / 0.7);
          st.put(x, y, RAMP[1 + Math.floor(k * (RAMP.length - 2))], k > 0.45 ? 'b' : 'a');
        }
      }
    },
  });
}

/* ---------- Text: scramble-in labels, ASCII meters, counting numbers ---------- */

export function scramble(el, ms = 800) {
  if (REDUCED || el._scr) return;
  const final = el.dataset.text || (el.dataset.text = el.textContent);
  el._scr = true;
  const t0 = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / ms);
    let out = '';
    for (let i = 0; i < final.length; i++) {
      const c = final[i];
      out += c === ' ' || i / final.length < p * 1.2 - 0.2 ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (p < 1) requestAnimationFrame(tick);
    else { el.textContent = final; el._scr = false; }
  };
  requestAnimationFrame(tick);
}

const ease = (p) => 1 - Math.pow(1 - p, 3);

export function meter(el, ms = 1100) {
  const w = +el.dataset.w || 20;
  const n = Math.round(Math.max(0, Math.min(1, +el.dataset.v || 0)) * w);
  const paint = (k) => {
    const head = k < n ? '>' : '';
    el.innerHTML = '[<span class="f">' + '#'.repeat(k) + head + '</span>' + '·'.repeat(Math.max(0, w - k - head.length)) + ']';
  };
  if (REDUCED) return paint(n);
  const t0 = performance.now();
  const tick = (now) => { const p = Math.min(1, (now - t0) / ms); paint(Math.round(ease(p) * n)); if (p < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

export function countUp(el, to, fmt, ms = 1100) {
  if (REDUCED) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const tick = (now) => { const p = Math.min(1, (now - t0) / ms); el.textContent = fmt(ease(p) * to); if (p < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

export function onReveal(els, fn) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } }), { threshold: 0.4 });
  els.forEach((el) => io.observe(el));
}

/* ---------- Page helpers ---------- */

// Swap the static star pattern in every .stars band for the live ASCII sky.
export function skies(root = document) {
  root.querySelectorAll('.stars:not(.has-ascii)').forEach((el) => {
    const c = document.createElement('canvas');
    c.className = 'ascii-bg';
    c.setAttribute('aria-hidden', 'true');
    el.prepend(c);
    el.classList.add('has-ascii');
    stars(c, { target: el, cell: el.classList.contains('marquee') ? 10 : 12 });
  });
}

// Lux: one fixed sky behind the whole page.
let luxStarted = false;
export function luxSky() {
  if (luxStarted) return;
  luxStarted = true;
  const c = document.createElement('canvas');
  c.className = 'ascii-sky';
  c.setAttribute('aria-hidden', 'true');
  document.body.prepend(c);
  document.documentElement.classList.add('has-ascii');
  stars(c, { target: document.documentElement, density: 0.026 });
}

// An ASCII bar that fills when it scrolls into view (see animateIn).
export const ameterHTML = (v, w = 16, colour) =>
  '<span class="ameter" data-v="' + Math.max(0, Math.min(1, v || 0)).toFixed(3) + '" data-w="' + w + '"' + (colour ? ' style="--c:' + colour + '"' : '') + ' aria-hidden="true">[' + '·'.repeat(w) + ']</span>';

const FORMATS = {
  inr: (n) => '₹' + Math.round(n).toLocaleString('en-IN'),
  five: (n) => n.toFixed(1) + '/5',
};

// Decode labels, fill ASCII bars and count numbers up as each comes into view.
// Numbers: <span data-countup="2900" data-fmt="inr">₹2,900</span> (the final value is already in the HTML).
export function animateIn(root = document) {
  const labels = [...root.querySelectorAll('.label:not([data-anim])')].filter((el) => !el.children.length && el.textContent.trim().length < 48);
  const bars = [...root.querySelectorAll('.ameter[data-v]:not([data-anim])')];
  const nums = [...root.querySelectorAll('[data-countup]:not([data-anim])')];
  [...labels, ...bars, ...nums].forEach((el) => (el.dataset.anim = ''));
  labels.forEach((el) => el.addEventListener('mouseenter', () => scramble(el)));
  onReveal(labels, (el) => scramble(el));
  onReveal(bars, (el) => meter(el));
  onReveal(nums, (el) => countUp(el, +el.dataset.countup, FORMATS[el.dataset.fmt] || ((n) => String(Math.round(n)))));
}

/* ---------- Type: a headline built from dense characters that scatter like scent ---------- */

const DENSE = '@#%&$8';
const pick = (s) => s[(Math.random() * s.length) | 0];

// lines: [{ text, font: (px) => CSS font, f: relative size, layer }]
export function textField(canvas, o) {
  let parts = [], first = true;
  const st = mount(canvas, {
    cell: o.cell || ((w) => (w < 520 ? 5 : 6.5)),
    weight: '500',
    bold: o.bold ?? (innerWidth < 520 ? 0.07 : 0.12),
    theme: o.theme || 'paper',
    target: o.target,
    press(st) {
      if (REDUCED) return;
      const px = st.px * st.cw, py = st.py * st.ch;
      for (const p of parts) {
        const dx = p.x - px, dy = p.y - py, d = Math.sqrt(dx * dx + dy * dy) + 1;
        if (d < 300) { const k = (1 - d / 300) * 32; p.vx += (dx / d) * k; p.vy += (dy / d) * k; }
      }
    },
    setup(st) {
      const off = document.createElement('canvas');
      off.width = Math.ceil(st.w); off.height = Math.ceil(st.h);
      const c = off.getContext('2d');
      // size the lines so the block fills the width without overflowing the height
      const m = o.lines.map((L) => { c.font = L.font(100); const t = c.measureText(L.text); return { w: t.actualBoundingBoxRight, a: t.actualBoundingBoxAscent, d: t.actualBoundingBoxDescent }; });
      let B = Infinity, hSum = 0;
      o.lines.forEach((L, i) => { B = Math.min(B, (st.w * 0.97 * 100) / (m[i].w * L.f)); hSum += ((m[i].a + m[i].d) / 100 + 0.07) * L.f; });
      B = Math.min(B, (st.h * 0.96) / hSum);
      const bands = [];
      let y = 0;
      o.lines.forEach((L, i) => {
        const size = B * L.f;
        c.font = L.font(size);
        c.fillText(L.text, 0, y + (m[i].a / 100) * size);
        y += ((m[i].a + m[i].d) / 100 + 0.07) * size;
        bands.push([y, L.layer || 'b']);
      });
      const img = c.getImageData(0, 0, off.width, off.height).data;
      parts = [];
      for (let row = 0; row < st.rows; row++) {
        for (let col = 0; col < st.cols; col++) {
          let cov = 0;
          for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
            const X = Math.floor((col + (sx + 0.5) / 3) * st.cw), Y = Math.floor((row + (sy + 0.5) / 3) * st.ch);
            if (X < off.width && Y < off.height) cov += img[(Y * off.width + X) * 4 + 3];
          }
          cov /= 9 * 255;
          if (cov < 0.1) continue;
          const hx = col * st.cw, hy = row * st.ch;
          const layer = (bands.find((b) => hy + st.ch / 2 < b[0]) || bands[bands.length - 1])[1];
          const scatter = first && !REDUCED;
          parts.push({
            hx, hy, vx: 0, vy: 0, g: 0, layer,
            x: scatter ? hx + (Math.random() - 0.5) * st.w * 0.9 : hx,
            y: scatter ? hy + (Math.random() - 0.5) * st.h * 1.6 : hy,
            c: cov > 0.3 ? pick(DENSE) : pick('*+o'),
          });
        }
      }
    },
    frame(st) {
      const R = o.radius || 100, R2 = R * R;
      const px = st.sx * st.cw, py = st.sy * st.ch;
      const { cw, ch } = st;
      for (const p of parts) {
        if (st.pin) {
          const dx = p.x - px, dy = p.y - py, d2 = dx * dx + dy * dy;
          if (d2 < R2) { const d = Math.sqrt(d2) + 0.01, k = (1 - d / R) * 3.6; p.vx += (dx / d) * k; p.vy += (dy / d) * k; }
        }
        p.vx += (p.hx - p.x) * 0.05; p.vy += (p.hy - p.y) * 0.05;
        p.vx *= 0.84; p.vy *= 0.84;
        p.x += p.vx; p.y += p.vy;
      }
      // a faint offset copy underneath gives the letters depth
      for (const p of parts) st.put((p.x + cw * 1.5) / cw, (p.y + ch * 1.5) / ch, p.c, 'a');
      // a band of light sweeps across the words every few seconds
      const sweep = REDUCED ? -1e9 : ((st.t % 6) / 6) * (st.w + st.h) * 1.7 - st.h;
      for (const p of parts) {
        const sp = Math.abs(p.vx) + Math.abs(p.vy);
        if (!REDUCED && p.g === 0 && Math.random() < 0.001) p.g = 5 + ((Math.random() * 10) | 0);
        let chr = p.c, layer = p.layer;
        if (p.g > 0) { p.g--; chr = GLYPHS[(Math.random() * GLYPHS.length) | 0]; }
        if (Math.abs(p.hx + p.hy * 0.7 - sweep) < 22) { layer = layer === 'r' ? 'b' : 'r'; chr = pick(DENSE); }
        if (sp > 2.2) { chr = sp > 7 ? '.' : sp > 4 ? ':' : '*'; layer = layer === 'r' ? 'a' : 'r'; }
        st.put((p.x + cw / 2) / cw, (p.y + ch / 2) / ch, chr, layer);
      }
    },
  });
  if (document.fonts) Promise.all(o.lines.map((L) => document.fonts.load(L.font(48), L.text))).then(() => { st.refresh(); first = false; });
  else first = false;
  return st;
}

/* ---------- Receipt: a till slip that prints line by line, in the swap-card style ---------- */

const PAUSE = { title: 240, tag: 200, rule: 70, head: 120, item: 260, meter: 380, big: 700, barcode: 650 };

// rows: [{ k: 'title'|'tag'|'line'|'head'|'rule'|'kv'|'item'|'meter'|'big'|'barcode', ... }]
export function printReceipt(el, rows, { onDone } = {}) {
  const run = (el._run = (el._run || 0) + 1);
  el.textContent = '';
  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const steps = rows.map((r) => {
    const row = mk('div', 'rc rc--' + r.k + (r.cls ? ' ' + r.cls : ''));
    const anim = [];
    const scr = (n) => { anim.push(() => scramble(n, 320)); return n; };
    const num = (n, spec) => { if (spec) { n.textContent = spec.fmt(0); anim.push(() => countUp(n, spec.to, spec.fmt, 750)); } return n; };
    if (r.k === 'title' || r.k === 'tag') row.append(mk('span', null, r.text));
    else if (r.k === 'line' || r.k === 'head') row.append(scr(mk('span', null, r.text)));
    else if (r.k === 'rule') row.append(mk('span', null, (r.ch || '-').repeat(90)));
    else if (r.k === 'kv' || r.k === 'big') {
      row.append(scr(mk('span', 'l', r.l)));
      const v = mk('span', 'v', r.r || '');
      row.append(r.num ? num(v, r.num) : scr(v));
    } else if (r.k === 'item') {
      const top = mk('div', 'rc__top');
      top.append(scr(mk('span', 'l', r.qty + ' x ' + r.name)), r.num ? num(mk('span', 'v'), r.num) : mk('span', 'v', r.r || ''));
      row.append(top, scr(mk('div', 'rc__sub', r.sub)));
      if (r.struck) anim.push(() => setTimeout(() => row.classList.add('is-struck'), REDUCED ? 0 : 650));
    } else if (r.k === 'meter') {
      const m = mk('span', 'ameter', '[' + '·'.repeat(r.w) + ']');
      m.dataset.v = r.v; m.dataset.w = r.w;
      row.append(mk('span', 'l', r.l), m, num(mk('span', 'v'), r.num));
      anim.push(() => meter(m, 800));
    } else if (r.k === 'barcode') {
      const bars = mk('div', 'rc__bars');
      let seed = 7;
      for (const c of r.code) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
      for (let i = 0; i < 52; i++) {
        seed = (seed * 1103515245 + 12345) >>> 0;
        const b = mk('i');
        b.style.width = 1 + ((seed >>> 27) % 3) + 'px';
        b.style.marginRight = 1 + ((seed >>> 22) % 3) + 'px';
        b.style.animationDelay = i * 11 + 'ms';
        bars.append(b);
      }
      row.append(bars, mk('div', 'rc__code', r.code.replace(/(.{4})/g, '$1 ').trim()));
    }
    row.hidden = true;
    el.append(row);
    return { row, anim, wait: PAUSE[r.k] || 110 };
  });
  let i = 0;
  const next = () => {
    if (run !== el._run) return;
    if (i >= steps.length) { if (onDone) onDone(); return; }
    const s = steps[i++];
    s.row.hidden = false;
    s.anim.forEach((f) => f());
    if (REDUCED) next(); else setTimeout(next, s.wait);
  };
  next();
}
