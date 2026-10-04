/* KZones Layout Builder — wizualny generator layoutów dla KZones (KWin Script) */

const IND_POSITIONS = [
  'center', 'top-left', 'top-center', 'top-right', 'right-center',
  'bottom-right', 'bottom-center', 'bottom-left', 'left-center',
];

/* 8 uchwytów resize: 4 narożniki + 4 krawędzie.
   edges — które krawędzie kryją tryb: 'l' lewa, 'r' prawa, 't' góra, 'b' dół.
   Uchwyty krawędziowe są przesunięte o połowę w głąb strefy, żeby nie nachodziły
   na siebie z narożnikami i żeby były łatwe do trafienia myszą. */
const OFF = -4;          // uchwyt wystaje o 4 px poza strefę
const IN = '50%';        // uchwyt krawędziowy: środek na krawędzi strefy
const HALF = 'calc(50% - 6.5px)';
const HANDLES = [
  { id: 'nw', edges: 'lt', style: { left: `${OFF}px`, top: `${OFF}px`, cursor: 'nwse-resize' } },
  { id: 'n',  edges: 't',  style: { left: HALF, top: `${OFF}px`, cursor: 'ns-resize' } },
  { id: 'ne', edges: 'rt', style: { right: `${OFF}px`, top: `${OFF}px`, cursor: 'nesw-resize' } },
  { id: 'e',  edges: 'r',  style: { right: `${OFF}px`, top: HALF, cursor: 'ew-resize' } },
  { id: 'se', edges: 'rb', style: { right: `${OFF}px`, bottom: `${OFF}px`, cursor: 'nwse-resize' } },
  { id: 's',  edges: 'b',  style: { left: HALF, bottom: `${OFF}px`, cursor: 'ns-resize' } },
  { id: 'sw', edges: 'lb', style: { left: `${OFF}px`, bottom: `${OFF}px`, cursor: 'nesw-resize' } },
  { id: 'w',  edges: 'l',  style: { left: `${OFF}px`, top: HALF, cursor: 'ew-resize' } },
];

const $ = (id) => document.getElementById(id);

const el = {
  canvas: $('canvas'), tabs: $('tabs'), stats: $('stats'), validation: $('validation'),
  json: $('json'), preset: $('preset'), presetN: $('preset-n'),
  aspect: $('aspect'), snap: $('snap'),
  layName: $('lay-name'), layPad: $('lay-padding'), layW: $('lay-w'),
  zoneNone: $('zone-none'), zoneTag: $('zone-tag'),
  toast: $('toast'), dlg: $('dlg-import'), importText: $('import-text'), fileInput: $('file-input'),
};

const FIELDS = {
  x: $('z-x'), y: $('z-y'), w: $('z-w'), h: $('z-h'),
  apps: $('z-apps'), color: $('z-color'), colorPicker: $('z-color-picker'),
  indPos: $('z-ind-pos'), indT: $('z-ind-t'), indR: $('z-ind-r'),
  indB: $('z-ind-b'), indL: $('z-ind-l'),
};

const state = {
  layouts: [],
  li: 0,
  zi: -1,
  drag: null,
};

const cur = () => state.layouts[state.li];
const selZone = () => (cur() ? cur().zones[state.zi] : null);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v, p = 2) => {
  const m = 10 ** p;
  return Math.round(v * m) / m;
};

/* ---------- snap ---------- */
function snapVal(v, force) {
  const s = force !== undefined ? force : parseFloat(el.snap.value);
  return s > 0 ? Math.round(v / s) * s : v;
}

/* ---------- persistence ---------- */
const LS_KEY = 'kzones-builder-v1';
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      layouts: state.layouts, li: state.li,
      aspect: el.aspect.value, snap: el.snap.value, screenW: el.layW.value,
    }));
  } catch (e) { /* private mode / quota — pomijamy */ }
}
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!Array.isArray(d.layouts) || !d.layouts.length) return false;
    state.layouts = d.layouts;
    state.li = clamp(d.li | 0, 0, d.layouts.length - 1);
    if (d.aspect) el.aspect.value = d.aspect;
    if (d.snap) el.snap.value = String(d.snap);
    if (d.screenW) el.layW.value = d.screenW;
    return true;
  } catch (e) { return false; }
}

/* ---------- presets ---------- */
function gridZones(cols, rows) {
  const w = round(100 / cols, 4), h = round(100 / rows, 4), out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({ x: round(c * w, 4), y: round(r * h, 4), width: w, height: h });
    }
  }
  return out;
}

const PRESETS = {
  'cols': (n) => ({ name: `Kolumny ${n}`, zones: gridZones(n, 1) }),
  'rows': (n) => ({ name: `Rzędy ${n}`, zones: gridZones(1, n) }),
  'grid': (n) => ({ name: `Siatka ${n}×${n}`, zones: gridZones(n, n) }),
  'thirds': () => ({
    name: 'Trójki',
    zones: [
      { x: 0, y: 0, width: 33.3333, height: 100 },
      { x: 33.3333, y: 0, width: 33.3334, height: 100 },
      { x: 66.6667, y: 0, width: 33.3333, height: 100 },
    ],
  }),
  'halves': () => ({
    name: 'Połówki',
    zones: [
      { x: 0, y: 0, width: 50, height: 100 },
      { x: 50, y: 0, width: 50, height: 100 },
    ],
  }),
  'focus': () => ({
    name: 'Fokus (25/50/25)',
    zones: [
      { x: 0, y: 0, width: 25, height: 100 },
      { x: 25, y: 0, width: 50, height: 100 },
      { x: 75, y: 0, width: 25, height: 100 },
    ],
  }),
  'quad': () => ({
    name: 'Kwadranty',
    zones: [
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 50, y: 0, width: 50, height: 50 },
      { x: 0, y: 50, width: 50, height: 50 },
      { x: 50, y: 50, width: 50, height: 50 },
    ],
  }),
  'thirds6': () => ({
    name: 'Siatka 3×2',
    zones: gridZones(3, 2),
  }),
  'mosaic': () => ({
    name: 'Mozaika',
    zones: [
      { x: 0, y: 0, width: 66.6667, height: 100 },
      { x: 66.6667, y: 0, width: 33.3333, height: 50 },
      { x: 66.6667, y: 50, width: 33.3333, height: 50 },
    ],
  }),
  'main-side': () => ({
    name: 'Główna + pasek',
    zones: [
      { x: 0, y: 0, width: 80, height: 100 },
      { x: 80, y: 0, width: 20, height: 33.3333 },
      { x: 80, y: 33.3333, width: 20, height: 33.3333 },
      { x: 80, y: 66.6667, width: 20, height: 33.3333 },
    ],
  }),
};

for (const [key, label] of [
  ['cols', 'Kolumny'], ['rows', 'Rzędy'], ['grid', 'Siatka N×N'],
  ['thirds', 'Trójki'], ['halves', 'Połówki'], ['focus', 'Fokus 25/50/25'],
  ['quad', 'Kwadranty'], ['thirds6', 'Siatka 3×2'], ['mosaic', 'Mozaika'],
  ['main-side', 'Główna + pasek'],
]) {
  const o = document.createElement('option');
  o.value = key; o.textContent = label;
  el.preset.appendChild(o);
}

function applyPreset(key) {
  if (!key || !PRESETS[key]) return;
  const n = clamp(parseInt(el.presetN.value, 10) || 3, 1, 8);
  el.presetN.hidden = key !== 'cols' && key !== 'rows' && key !== 'grid';
  const p = PRESETS[key](n);
  state.layouts.splice(state.li, 1, { name: p.name, padding: 0, zones: p.zones });
  state.zi = -1;
  commit();
}

/* ---------- rendering ---------- */
function renderTabs() {
  el.tabs.innerHTML = '';
  state.layouts.forEach((l, i) => {
    const t = document.createElement('div');
    t.className = 'tab' + (i === state.li ? ' on' : '');
    const nm = document.createElement('span');
    nm.textContent = l.name || `Layout ${i + 1}`;
    const x = document.createElement('button');
    x.className = 'tab-x';
    x.type = 'button';
    x.textContent = '×';
    x.title = 'Usuń layout';
    x.addEventListener('click', (ev) => {
      ev.stopPropagation();
      removeLayout(i);
    });
    t.append(nm, x);
    t.addEventListener('click', () => { state.li = i; state.zi = -1; commit(); });
    el.tabs.appendChild(t);
  });
  const add = document.createElement('button');
  add.className = 'tab-add';
  add.type = 'button';
  add.textContent = '+ layout';
  add.addEventListener('click', () => {
    state.layouts.push({ name: `Layout ${state.layouts.length + 1}`, padding: 0, zones: [] });
    state.li = state.layouts.length - 1;
    state.zi = -1;
    commit();
  });
  el.tabs.appendChild(add);
}

function renderCanvas() {
  const c = el.canvas;
  c.innerHTML = '';
  const zones = cur() ? cur().zones : [];

  if (!zones.length) {
    const h = document.createElement('div');
    h.className = 'zone-hint';
    h.textContent = 'Brak stref — przeciągnij po polu, żeby narysować pierwszą';
    c.appendChild(h);
    return;
  }

  const padPx = cur().padding || 0;
  const screenW = parseFloat(el.layW.value) || 3440;

  zones.forEach((z, i) => {
    const d = document.createElement('div');
    d.className = 'zone' + (i === state.zi ? ' sel' : '');
    d.style.left = z.x + '%';
    d.style.top = z.y + '%';
    d.style.width = z.width + '%';
    d.style.height = z.height + '%';
    if (z.color) {
      d.style.borderColor = z.color;
      d.style.background = hexA(z.color, 0.18) || 'var(--accent-soft)';
    }

    const lab = document.createElement('div');
    lab.className = 'zlabel';
    lab.textContent = `${i + 1}: ${round(z.width)}×${round(z.height)}%`;
    if (z.applications && z.applications.length) {
      const a = document.createElement('span');
      a.className = 'zapps';
      a.textContent = z.applications.join(', ');
      lab.appendChild(a);
    }
    d.appendChild(lab);

    // padding = real pixels inset, needs screen width to render honestly
    if (padPx > 0) {
      const inset = document.createElement('div');
      const ipct = clamp((padPx / screenW) * 100, 0, 24);
      inset.style.cssText =
        `position:absolute;inset:${ipct}%;border:1px dashed rgba(255,255,255,.45);` +
        `border-radius:0;pointer-events:none;`;
      d.insertBefore(inset, lab);
    }

    if (i === state.zi) {
      // pełne 8 uchwytów: 4 narożniki + 4 krawędzie. Każdy uchwyt ma własny
      // tryb resize (patrz HANDLES), więc da się rozciągać w obu osiach —
      // wcześniej były tylko dwa dolne, przez co wysokość była niezmienna.
      for (const h of HANDLES) {
        const hd = document.createElement('div');
        hd.className = 'handle ' + h.id;
        hd.dataset.h = h.id;
        for (const [prop, val] of Object.entries(h.style)) hd.style[prop] = val;
        d.appendChild(hd);
      }
    }

    c.appendChild(d);
  });
}

function hexA(col, a) {
  const m = /^#([0-9a-f]{6})$/i.exec(col.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function renderSide() {
  const L = cur();
  if (!L) { el.zoneNone.hidden = false; return; }
  el.layName.value = L.name;
  el.layPad.value = L.padding || 0;

  const z = selZone();
  const on = !!z;
  ['x', 'y', 'w', 'h', 'apps', 'color', 'indPos', 'indT', 'indR', 'indB', 'indL']
    .forEach((k) => { FIELDS[k].disabled = !on; });
  $('z-color-picker').disabled = !on;
  $('z-color-clear').disabled = !on;
  el.zoneNone.hidden = on;
  el.zoneTag.textContent = on ? `#${state.zi + 1}` : '—';
  if (!on) return;

  FIELDS.x.value = round(z.x); FIELDS.y.value = round(z.y);
  FIELDS.w.value = round(z.width); FIELDS.h.value = round(z.height);
  FIELDS.apps.value = (z.applications || []).join('\n');
  FIELDS.color.value = z.color || '';
  const hx = hexA(z.color || '', 1);
  if (hx) FIELDS.colorPicker.value = hx;

  const ind = z.indicator || {};
  FIELDS.indPos.value = IND_POSITIONS.includes(ind.position) ? ind.position : 'center';
  const m = ind.margin || {};
  FIELDS.indT.value = m.top || 0; FIELDS.indR.value = m.right || 0;
  FIELDS.indB.value = m.bottom || 0; FIELDS.indL.value = m.left || 0;
}

function renderStats() {
  const L = cur();
  const stats = el.stats;
  stats.innerHTML = '';
  if (!L) return;
  const areas = L.zones.map((z) => (z.width * z.height) / 10000);
  const sum = areas.reduce((a, b) => a + b, 0);
  const pill = (label, val) => {
    const d = document.createElement('div');
    d.className = 'pill';
    d.innerHTML = `${label} <b>${val}</b>`;
    stats.appendChild(d);
  };
  pill('Layouty', state.layouts.length);
  pill('Strefy', L.zones.length);
  pill('Pokrycie', round(sum * 100, 1) + '%');
  pill('Największa', L.zones.length ? round(Math.max(...areas) * 100, 1) + '%' : '—');
  pill('Padding', (L.padding || 0) + ' px');
}

/* ---------- validation ---------- */
function rectsOverlap(a, b) {
  return a.x < b.x + b.width - 0.01 && b.x < a.x + a.width - 0.01 &&
         a.y < b.y + b.height - 0.01 && b.y < a.y + a.height - 0.01;
}

function validate() {
  const out = [];
  const push = (lvl, msg) => out.push({ lvl, msg });
  const L = cur();

  if (!L) { push('err', 'Brak layoutu.'); return out; }
  if (!L.zones.length) push('err', `Layout „${L.name}” nie ma żadnej strefy — KZones nic nie zrobi.`);

  const names = state.layouts.map((l) => l.name);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupes.length) push('warn', `Powtórzona nazwa layoutu: ${[...new Set(dupes)].join(', ')}.`);
  if (state.layouts.length === 1) push('warn', 'Jeden layout — nie da się przełączać skrótem Ctrl+Alt+D.');

  L.zones.forEach((z, i) => {
    const tag = `Strefa ${i + 1}`;
    if (z.width <= 0 || z.height <= 0) push('err', `${tag} ma zerowy rozmiar.`);
    if (z.x < -0.01 || z.y < -0.01 || z.x + z.width > 100.01 || z.y + z.height > 100.01) {
      push('err', `${tag} wychodzi poza ekran (${round(z.x)}…${round(z.x + z.width)} × ${round(z.y)}…${round(z.y + z.height)}).`);
    }
    if (z.width < 3 || z.height < 3) push('warn', `${tag} jest bardzo wąska (${round(z.width)}×${round(z.height)}%) — okno w niej będzie miało problemy.`);
  });

  const seen = [];
  L.zones.forEach((a, i) => {
    L.zones.forEach((b, j) => {
      if (j <= i) return;
      if (rectsOverlap(a, b)) {
        const key = [i, j].sort().join('-');
        if (!seen.includes(key)) {
          seen.push(key);
          push('err', `Strefy ${i + 1} i ${j + 1} nachodzą na siebie — okno trafi do tej ostatnio znalezionej.`);
        }
      }
    });
  });

  const seenApp = new Map();
  L.zones.forEach((z, i) => {
    (z.applications || []).forEach((a) => {
      if (seenApp.has(a)) push('warn', `Aplikacja „${a}” jest w strefach ${seenApp.get(a) + 1} i ${i + 1}.`);
      else seenApp.set(a, i);
    });
  });

  if (!out.some((o) => o.lvl === 'err')) push('ok', 'Wygląda dobrze — wklej JSON w ustawieniach KZones.');
  return out;
}

function renderValidation() {
  el.validation.innerHTML = '';
  for (const v of validate()) {
    const d = document.createElement('div');
    d.className = 'v-item v-' + v.lvl;
    const ico = document.createElement('span');
    ico.className = 'v-ico';
    ico.textContent = v.lvl === 'ok' ? '✓' : v.lvl === 'warn' ? '!' : '×';
    const msg = document.createElement('span');
    msg.innerHTML = v.msg.replace(/„([^”]+)”/g, '<b>„$1”</b>');
    d.append(ico, msg);
    el.validation.appendChild(d);
  }
}

/* ---------- JSON out ---------- */
function toJSON() {
  return state.layouts.map((L) => {
    const out = { name: L.name || 'Layout', padding: L.padding || 0, zones: [] };
    for (const z of L.zones) {
      const o = {
        x: round(z.x), y: round(z.y),
        width: round(z.width), height: round(z.height),
      };
      if (z.applications && z.applications.length) o.applications = z.applications.slice();
      if (z.color) o.color = z.color;
      if (z.indicator) {
        const m = z.indicator.margin || {};
        const anyMargin = m.top || m.right || m.bottom || m.left;
        if (anyMargin) {
          o.indicator = {
            position: z.indicator.position || 'center',
            margin: {
              top: m.top || 0, right: m.right || 0,
              bottom: m.bottom || 0, left: m.left || 0,
            },
          };
        } else {
          o.indicator = { position: z.indicator.position || 'center' };
        }
      }
      out.zones.push(o);
    }
    return out;
  });
}

let jsonEdited = false;
function renderJSON() {
  if (jsonEdited) return;
  el.json.value = JSON.stringify(toJSON(), null, 2);
}

/* ---------- commit ---------- */
function commit() {
  if (!cur()) return;
  normalize(cur());
  renderTabs();
  renderCanvas();
  renderSide();
  renderStats();
  renderValidation();
  renderJSON();
  save();
}

function normalize(L) {
  L.name = (L.name || '').trim() || 'Layout';
  L.padding = clamp(Math.round(L.padding) || 0, 0, 200);
  for (const z of L.zones) {
    z.x = clamp(z.x, 0, 100);
    z.y = clamp(z.y, 0, 100);
    z.width = clamp(z.width, 0.5, 100 - z.x);
    z.height = clamp(z.height, 0.5, 100 - z.y);
  }
}

/* ---------- canvas interaction ---------- */
function ptFrom(ev) {
  const r = el.canvas.getBoundingClientRect();
  return {
    x: ((ev.clientX - r.left) / r.width) * 100,
    y: ((ev.clientY - r.top) / r.height) * 100,
  };
}

function zoneAt(p) {
  const zones = cur().zones;
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    if (p.x >= z.x && p.x <= z.x + z.width && p.y >= z.y && p.y <= z.y + z.height) return i;
  }
  return -1;
}

el.canvas.addEventListener('pointerdown', (ev) => {
  if (!cur()) return;
  const p = ptFrom(ev);
  const handle = ev.target.closest('.handle');
  const zi = zoneAt(p);

  if (handle && zi >= 0 && zi === state.zi) {
    const h = HANDLES.find((x) => x.id === handle.dataset.h);
    if (h) state.drag = { mode: `resize-${h.edges}`, zi, p0: p, z0: { ...cur().zones[zi] } };
    else state.drag = { mode: 'move', zi, p0: p, z0: { ...cur().zones[zi] } };
  } else if (zi >= 0) {
    state.zi = zi;
    state.drag = { mode: 'move', zi, p0: p, z0: { ...cur().zones[zi] } };
    commit();
  } else {
    const s = snapVal(p.x), t = snapVal(p.y);
    const z = { x: clamp(s, 0, 99.5), y: clamp(t, 0, 99.5), width: 1, height: 1 };
    cur().zones.push(z);
    state.zi = cur().zones.length - 1;
    state.drag = { mode: 'resize-se', zi: state.zi, p0: p, z0: { ...z } };
    commit();
  }
  el.canvas.setPointerCapture(ev.pointerId);
});

el.canvas.addEventListener('pointermove', (ev) => {
  const d = state.drag;
  if (!d || !cur()) return;
  const p = ptFrom(ev);
  const dx = p.x - d.p0.x, dy = p.y - d.p0.y;
  const z = cur().zones[d.zi];
  if (!z) return;
  const z0 = d.z0;

  if (d.mode === 'move') {
    const nx = clamp(snapVal(z0.x + dx), 0, 100 - z0.width);
    const ny = clamp(snapVal(z0.y + dy), 0, 100 - z0.height);
    // snap also to the right/bottom edge when close
    z.x = nx; z.y = ny;
    if (el.snap.value !== '0') {
      const s = parseFloat(el.snap.value);
      if (Math.abs(z0.x + z0.width + dx - nx) < s / 2) z.x = 100 - z0.width;
      if (Math.abs(z0.y + z0.height + dy - ny) < s / 2) z.y = 100 - z0.height;
    }
  } else if (d.mode === 'resize-se') {
    // rysowanie nowej strefy: przeciągnięcie wyznacza prawy-dolny róg.
    // Pozycje, nie rozmiary — stąd clamp do 100, nie do 100 - z0.x.
    z.width = clamp(snapVal(Math.max(p.x, z0.x + 0.5)), 0.5, 100 - z0.x);
    z.height = clamp(snapVal(Math.max(p.y, z0.y + 0.5)), 0.5, 100 - z0.y);
  } else if (d.mode.startsWith('resize-')) {
    // dowolna kombinacja krawędzi: 'l' 'r' 't' 'b' (np. 'rb' = prawy + dolny).
    // Lewa/górra zmienia pozycję i rozmiar naraz; prawa/dolna tylko rozmiar.
    // Obie gałęzie liczą od niezmiennych z0, więc narożnik (np. 'rt') trzyma
    // przeciwległą parę krawędzi na miejscu zamiast skakać o 2× delta.
    const e = d.mode.slice(7);
    const MIN = 0.5;
    const left = e.includes('l')
      ? clamp(snapVal(Math.min(p.x, z0.x + z0.width - MIN)), 0, z0.x + z0.width - MIN)
      : z0.x;
    const top = e.includes('t')
      ? clamp(snapVal(Math.min(p.y, z0.y + z0.height - MIN)), 0, z0.y + z0.height - MIN)
      : z0.y;
    // prawa/dolna to POZYCJE na ekranie (0..100), nie rozmiary — clamp do 100,
    // inaczej strefa nie mogła rosnąć w prawo/dół (górna granica 100 - z0.x
    // to maksymalna SZEROKOŚĆ, a nie maksymalna pozycja prawej krawędzi)
    const right = e.includes('r')
      ? clamp(snapVal(Math.max(p.x, z0.x + MIN)), MIN, 100)
      : z0.x + z0.width;
    const bottom = e.includes('b')
      ? clamp(snapVal(Math.max(p.y, z0.y + MIN)), MIN, 100)
      : z0.y + z0.height;
    z.x = left;
    z.y = top;
    z.width = right - left;
    z.height = bottom - top;
  }
  normalize(cur());
  renderCanvas();
  renderSide();
  renderStats();
  renderValidation();
  renderJSON();
});

function endDrag(ev) {
  if (!state.drag) return;
  state.drag = null;
  try { el.canvas.releasePointerCapture(ev.pointerId); } catch (e) { /* już zwolnione */ }
  commit();
}
el.canvas.addEventListener('pointerup', endDrag);
el.canvas.addEventListener('pointercancel', endDrag);

/* ---------- keyboard ---------- */
document.addEventListener('keydown', (ev) => {
  if (ev.target.matches('input, textarea, select') || el.dlg.open) return;
  const z = selZone();
  if (!z) return;
  const s = el.snap.value === '0' ? 1 : parseFloat(el.snap.value);
  if (ev.key === 'Delete' || ev.key === 'Backspace') {
    ev.preventDefault();
    cur().zones.splice(state.zi, 1);
    state.zi = -1;
    commit();
    return;
  }
  const mv = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[ev.key];
  if (mv) {
    ev.preventDefault();
    z.x = clamp(z.x + mv[0], 0, 100 - z.width);
    z.y = clamp(z.y + mv[1], 0, 100 - z.height);
    commit();
  }
});

/* ---------- side inputs ---------- */
el.layName.addEventListener('input', () => { cur().name = el.layName.value; commit(); });
el.layPad.addEventListener('input', () => { cur().padding = parseFloat(el.layPad.value) || 0; commit(); });
el.layW.addEventListener('input', () => { renderCanvas(); save(); });
el.preset.addEventListener('change', () => applyPreset(el.preset.value));
// changing N re-applies the preset live, so the order "pick preset, then size"
// and "size, then preset" both do the obvious thing
el.presetN.addEventListener('input', () => {
  if (['cols', 'rows', 'grid'].includes(el.preset.value)) applyPreset(el.preset.value);
});
el.snap.addEventListener('change', save);
el.aspect.addEventListener('change', () => {
  el.canvas.style.aspectRatio = el.aspect.options[el.aspect.selectedIndex].text.split(' ')[0].replace(':', ' / ');
  save();
});

function bindNum(input, apply) {
  input.addEventListener('input', () => {
    const z = selZone();
    if (!z) return;
    apply(z, parseFloat(input.value));
    normalize(cur());
    renderCanvas(); renderSide(); renderStats(); renderValidation(); renderJSON(); save();
  });
}
bindNum(FIELDS.x, (z, v) => { if (!isNaN(v)) z.x = v; });
bindNum(FIELDS.y, (z, v) => { if (!isNaN(v)) z.y = v; });
bindNum(FIELDS.w, (z, v) => { if (!isNaN(v)) z.width = v; });
bindNum(FIELDS.h, (z, v) => { if (!isNaN(v)) z.height = v; });
for (const [k, f] of [['indT', 'top'], ['indR', 'right'], ['indB', 'bottom'], ['indL', 'left']]) {
  bindNum(FIELDS[k], (z, v) => {
    z.indicator = z.indicator || {};
    z.indicator.margin = z.indicator.margin || {};
    z.indicator.margin[f] = isNaN(v) ? 0 : v;
  });
}

FIELDS.apps.addEventListener('input', () => {
  const z = selZone();
  if (!z) return;
  const list = FIELDS.apps.value.split('\n').map((s) => s.trim()).filter(Boolean);
  if (list.length) z.applications = list; else delete z.applications;
  renderCanvas(); renderValidation(); renderJSON(); save();
});

FIELDS.color.addEventListener('input', () => {
  const z = selZone();
  if (!z) return;
  const v = FIELDS.color.value.trim();
  if (v) z.color = v; else delete z.color;
  renderCanvas(); renderValidation(); renderJSON(); save();
});
FIELDS.colorPicker.addEventListener('input', () => {
  const z = selZone();
  if (!z) return;
  z.color = FIELDS.colorPicker.value;
  FIELDS.color.value = z.color;
  renderCanvas(); renderJSON(); save();
});
$('z-color-clear').addEventListener('click', () => {
  const z = selZone();
  if (!z) return;
  delete z.color;
  FIELDS.color.value = '';
  commit();
});

FIELDS.indPos.addEventListener('change', () => {
  const z = selZone();
  if (!z) return;
  z.indicator = z.indicator || {};
  z.indicator.position = FIELDS.indPos.value;
  renderJSON(); save();
});

$('btn-add-zone').addEventListener('click', () => {
  const z = { x: 10, y: 10, width: 30, height: 30 };
  cur().zones.push(z);
  state.zi = cur().zones.length - 1;
  commit();
});
$('btn-dup-layout').addEventListener('click', () => {
  const L = cur();
  state.layouts.splice(state.li + 1, 0, JSON.parse(JSON.stringify(L)));
  state.layouts[state.li + 1].name = L.name + ' (kopia)';
  state.li += 1;
  state.zi = -1;
  commit();
});
$('btn-del-layout').addEventListener('click', removeLayout);

function removeLayout(i) {
  if (state.layouts.length === 1) { toast('Musisz mieć co najmniej jeden layout'); return; }
  state.layouts.splice(i, 1);
  state.li = clamp(state.li > i ? state.li - 1 : state.li, 0, state.layouts.length - 1);
  state.zi = -1;
  commit();
}

/* ---------- json textarea ---------- */
el.json.addEventListener('input', () => { jsonEdited = true; });
el.json.addEventListener('blur', () => {
  if (!jsonEdited) return;
  try {
    const d = JSON.parse(el.json.value);
    if (!Array.isArray(d)) throw new Error('Nie lista');
    state.layouts = d.map((L) => ({
      name: L.name || 'Layout',
      padding: L.padding || 0,
      zones: (L.zones || []).map((z) => {
        const o = { x: +z.x || 0, y: +z.y || 0, width: +z.width || 0, height: +z.height || 0 };
        if (Array.isArray(z.applications) && z.applications.length) o.applications = z.applications.slice();
        if (z.color) o.color = z.color;
        if (z.indicator) o.indicator = JSON.parse(JSON.stringify(z.indicator));
        return o;
      }),
    }));
    state.li = clamp(state.li, 0, state.layouts.length - 1);
    state.zi = -1;
    jsonEdited = false;
    commit();
    toast('JSON wczytany');
  } catch (e) {
    toast('Nieprawidłowy JSON — nie zmieniam nic');
    jsonEdited = false;
    renderJSON();
  }
});

/* ---------- import / export ---------- */
$('btn-import').addEventListener('click', () => { el.importText.value = ''; el.dlg.showModal(); });
$('btn-import-cancel').addEventListener('click', () => el.dlg.close());
$('btn-import-file').addEventListener('click', () => el.fileInput.click());
el.fileInput.addEventListener('change', async () => {
  const f = el.fileInput.files[0];
  if (!f) return;
  el.importText.value = await f.text();
  el.fileInput.value = '';
});
$('btn-import-ok').addEventListener('click', () => {
  try {
    const d = JSON.parse(el.importText.value);
    if (!Array.isArray(d)) throw new Error('Nie lista');
    el.json.value = JSON.stringify(d, null, 2);
    jsonEdited = true;
    el.json.dispatchEvent(new Event('blur'));
    el.dlg.close();
    toast('Zaimportowano');
  } catch (e) {
    toast('To nie jest poprawny JSON');
  }
});

$('btn-copy').addEventListener('click', async () => {
  const text = jsonEdited ? el.json.value : JSON.stringify(toJSON(), null, 2);
  try {
    await navigator.clipboard.writeText(text);
    toast('Skopiowano do schowka');
  } catch (e) {
    el.json.select();
    toast('Schowek zablokowany — zaznacz i skopiuj ręcznie');
  }
});

$('btn-download').addEventListener('click', () => {
  const text = jsonEdited ? el.json.value : JSON.stringify(toJSON(), null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'kzones-layouts.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Pobrano kzones-layouts.json');
});

let toastT;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.toast.classList.remove('on'), 1900);
}

/* ---------- boot ---------- */
function boot() {
  if (!load()) {
    state.layouts = [
      { name: 'Fokus 25/50/25', padding: 0, zones: PRESETS.focus().zones },
      { name: 'Kwadranty', padding: 0, zones: PRESETS.quad().zones },
      { name: 'Kolumny 3', padding: 0, zones: PRESETS.cols(3).zones },
    ];
    state.li = 0;
  }
  el.canvas.style.aspectRatio = el.aspect.options[el.aspect.selectedIndex].text.split(' ')[0].replace(':', ' / ');
  commit();
}
boot();

/* test hook */
window.__kzones = { state, toJSON, validate };