// Ablation charts of the project page. Values: mean ± std over the 11 test trees (%).
const NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const METRICS = [['ap', 'AP@0.25'], ['ar', 'AR@0.25'], ['f1', 'F1@0.25']];
const DOMAIN = [50, 100];

const FUSION = [
  { name: 'Sum (TR3D)', ap: [82.67, 3.58], ar: [91.75, 2.99], f1: [84.21, 2.49] },
  { name: 'Concat', ap: [84.99, 2.27], ar: [92.04, 3.11], f1: [85.90, 4.01] },
  { name: 'Gated', ap: [85.06, 3.47], ar: [91.99, 3.78], f1: [85.02, 2.87] },
  { name: 'MultiHead (ours)', ap: [87.11, 5.74], ar: [93.56, 4.20], f1: [87.39, 3.82], ours: true },
];
const HEADS = [
  { name: 'H = 1', ap: [82.18, 4.14], ar: [91.17, 2.87], f1: [83.64, 3.17] },
  { name: 'H = 2', ap: [85.62, 3.65], ar: [90.50, 2.98], f1: [85.10, 3.47] },
  { name: 'H = 4 (ours)', ap: [87.11, 5.74], ar: [93.56, 4.20], f1: [87.39, 3.82], ours: true },
  { name: 'H = 8', ap: [74.91, 16.90], ar: [87.00, 7.05], f1: [75.00, 14.77] },
];
const SIZES = ['0.3 m', '0.5 m', '1.0 m', '1.5 m', '2.0 m'];
const SPATIAL = [
  { name: '1 mm voxels', color: 'var(--series-1)', points: [
    { ap: [82.47, 3.86], ar: [92.54, 3.16], f1: [82.17, 3.03] },
    { ap: [87.11, 5.74], ar: [93.56, 4.20], f1: [87.39, 3.82] },
    { ap: [83.34, 8.64], ar: [91.23, 5.32], f1: [82.83, 7.70] },
    null, null] },
  { name: '3 mm voxels', color: 'var(--series-2)', points: [
    { ap: [81.40, 5.83], ar: [92.87, 2.12], f1: [86.81, 2.48] },
    { ap: [80.75, 6.62], ar: [90.87, 3.77], f1: [82.13, 4.68] },
    { ap: [75.91, 6.20], ar: [89.24, 2.87], f1: [76.86, 4.19] },
    { ap: [68.10, 9.07], ar: [82.01, 3.48], f1: [71.94, 6.21] },
    { ap: [55.98, 9.23], ar: [64.93, 6.94], f1: [62.96, 6.18] }] },
];

let metric = 'ap';
const metricLabel = () => METRICS.find(([k]) => k === metric)[1];

function el(name, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.append(node);
  return node;
}
function label(parent, x, y, content, attrs = {}) {
  const t = el('text', { x, y, fill: 'var(--ink-2)', 'font-size': 13, 'dominant-baseline': 'middle', ...attrs }, parent);
  t.textContent = content;
  return t;
}
// Width of a label in the page font, to lay the charts out at their real pixel size.
const measure = document.createElement('canvas').getContext('2d');
function textWidth(content, weight = 400, size = 13) {
  measure.font = `${weight} ${size}px ${getComputedStyle(document.body).fontFamily}`;
  return measure.measureText(content).width;
}

// One tooltip for the whole page.
const tooltip = document.createElement('div');
tooltip.className = 'tooltip';
document.body.append(tooltip);
function showTooltip(event, rows) {
  tooltip.replaceChildren();
  for (const { value, name, color } of rows) {
    const row = document.createElement('div');
    row.className = 'tt-row';
    if (color) { const key = document.createElement('span'); key.className = 'tt-key'; key.style.borderColor = color; row.append(key); }
    const b = document.createElement('b'); b.textContent = value;
    const s = document.createElement('span'); s.textContent = name;
    row.append(b, s);
    tooltip.append(row);
  }
  tooltip.style.display = 'block';
  const { innerWidth } = window;
  const x = Math.min(event.clientX + 14, innerWidth - tooltip.offsetWidth - 8);
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${event.clientY + 14}px`;
}
const hideTooltip = () => { tooltip.style.display = 'none'; };

function tableView(rows, header, open = false) {
  const details = document.createElement('details');
  details.open = open;
  const summary = document.createElement('summary');
  summary.textContent = 'Table';
  const table = document.createElement('table');
  const tr = document.createElement('tr');
  for (const h of header) { const th = document.createElement('th'); th.textContent = h; tr.append(th); }
  table.append(tr);
  for (const r of rows) {
    const row = document.createElement('tr');
    for (const c of r) { const td = document.createElement('td'); td.textContent = c; row.append(td); }
    table.append(row);
  }
  details.append(summary, table);
  return details;
}

const fmt = ([m, s]) => `${m.toFixed(2)} ± ${s.toFixed(2)}`;

// Dot plot with ± std whiskers; the row of CROP-Net in the accent, the rest in gray.
function dotPlot(container, rows) {
  const width = Math.max(280, container.clientWidth);
  const left = Math.max(...rows.map((r) => textWidth(r.name, r.ours ? 700 : 400))) + 16;
  const right = width - 14, rowH = 40, top = 22;
  const height = top + rows.length * rowH + 30;
  const x = (v) => left + ((v - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0])) * (right - left);
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${metricLabel()} by configuration` });
  for (let v = DOMAIN[0]; v <= DOMAIN[1]; v += 10) {
    el('line', { x1: x(v), x2: x(v), y1: top - 4, y2: height - 26, stroke: 'var(--grid)', 'stroke-width': 1 }, svg);
    label(svg, x(v), height - 12, String(v), { 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 12 });
  }
  rows.forEach((r, i) => {
    const y = top + i * rowH + rowH / 2;
    const [mean, std] = r[metric];
    const color = r.ours ? 'var(--accent)' : 'var(--deemph)';
    label(svg, 0, y, r.name, { fill: r.ours ? 'var(--ink)' : 'var(--ink-2)', 'font-weight': r.ours ? 700 : 400 });
    el('line', { x1: x(Math.max(mean - std, DOMAIN[0])), x2: x(Math.min(mean + std, DOMAIN[1])), y1: y, y2: y,
      stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round' }, svg);
    el('circle', { cx: x(mean), cy: y, r: 5.5, fill: color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
    if (r.ours) label(svg, x(mean), y - 15, mean.toFixed(2), { 'text-anchor': 'middle', fill: 'var(--ink)', 'font-weight': 700 });
    const hit = el('rect', { x: 0, y: y - rowH / 2, width, height: rowH, fill: 'transparent', tabindex: 0 }, svg);
    const tip = (e) => showTooltip(e, [{ value: fmt(r[metric]), name: `${metricLabel()} · ${r.name}` }]);
    hit.addEventListener('pointermove', tip);
    hit.addEventListener('pointerleave', hideTooltip);
    hit.addEventListener('focus', () => { const b = hit.getBoundingClientRect(); tip({ clientX: b.left + left, clientY: b.top }); });
    hit.addEventListener('blur', hideTooltip);
  });
  const open = Boolean(container.querySelector('details')?.open);
  container.replaceChildren(svg, tableView(rows.map((r) => [r.name, ...METRICS.map(([k]) => fmt(r[k]))]),
    ['', ...METRICS.map(([, l]) => l)], open));
}

// Line chart of the spatial ablation: one series per voxel size over the cuboid size.
function spatialChart(container) {
  const width = Math.max(280, container.clientWidth), narrow = width < 560;
  const left = 36, right = width - 10, top = narrow ? 56 : 36, bottom = narrow ? 230 : 250, height = bottom + 52;
  const pad = narrow ? 24 : 60;
  const x = (i) => left + pad + (i / (SIZES.length - 1)) * (right - left - 2 * pad);
  const y = (v) => bottom - ((v - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0])) * (bottom - top);
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${metricLabel()} by cuboid size and voxel size` });

  // Legend.
  SPATIAL.forEach((s, i) => {
    const lx = left + i * 150;
    el('line', { x1: lx, x2: lx + 22, y1: 10, y2: 10, stroke: s.color, 'stroke-width': 2.5 }, svg);
    label(svg, lx + 30, 10, s.name, { fill: 'var(--ink)' });
  });
  for (let v = DOMAIN[0]; v <= DOMAIN[1]; v += 10) {
    el('line', { x1: left, x2: right, y1: y(v), y2: y(v), stroke: 'var(--grid)', 'stroke-width': 1 }, svg);
    label(svg, left - 8, y(v), String(v), { 'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 12 });
  }
  SIZES.forEach((s, i) => label(svg, x(i), bottom + 20, s, { 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 12 }));
  label(svg, (left + right) / 2, bottom + 40, 'Cuboid size', { 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 12 });

  for (const s of SPATIAL) {
    const pts = s.points.map((p, i) => (p ? [x(i), y(p[metric][0])] : null)).filter(Boolean);
    el('polyline', { points: pts.map((p) => p.join(',')).join(' '), fill: 'none', stroke: s.color,
      'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    for (const [px, py] of pts) el('circle', { cx: px, cy: py, r: 5, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
  }
  // Out of memory with 1 mm voxels: a note over the missing cuboid sizes, or under the legend when narrow.
  const oom = SIZES.map((_, i) => i).filter((i) => !SPATIAL[0].points[i]);
  const note = { fill: 'var(--muted)', 'font-size': 12 };
  if (oom.length && narrow) {
    label(svg, right, 34, `1 mm: out of memory at ${oom.map((i) => SIZES[i]).join(' and ')}`, { ...note, 'text-anchor': 'end' });
  } else if (oom.length) {
    label(svg, (x(oom[0]) + x(oom[oom.length - 1])) / 2, top + 6, '1 mm voxels: out of memory', { ...note, 'text-anchor': 'middle' });
  }
  // The selected configuration.
  const sel = SPATIAL[0].points[1][metric][0];
  label(svg, x(1), y(sel) - 18, `selected: ${sel.toFixed(2)}`, { 'text-anchor': 'middle', fill: 'var(--ink)', 'font-weight': 700 });

  // Crosshair and tooltip.
  const cross = el('line', { y1: top, y2: bottom, stroke: 'var(--axis)', 'stroke-width': 1, visibility: 'hidden' }, svg);
  const hit = el('rect', { x: left, y: top, width: right - left, height: bottom - top, fill: 'transparent', tabindex: 0 }, svg);
  const at = (i, e) => {
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    showTooltip(e, SPATIAL.map((s) => ({
      value: s.points[i] ? fmt(s.points[i][metric]) : 'out of memory',
      name: `${s.name} · ${SIZES[i]}`, color: s.color })));
  };
  hit.addEventListener('pointermove', (e) => {
    const b = svg.getBoundingClientRect();
    const sx = ((e.clientX - b.left) / b.width) * width;
    let best = 0;
    SIZES.forEach((_, i) => { if (Math.abs(x(i) - sx) < Math.abs(x(best) - sx)) best = i; });
    at(best, e);
  });
  hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); hideTooltip(); });
  hit.addEventListener('blur', () => { cross.setAttribute('visibility', 'hidden'); hideTooltip(); });

  const rows = [];
  SPATIAL.forEach((s) => s.points.forEach((p, i) => rows.push([SIZES[i], s.name.replace(' voxels', ''),
    ...METRICS.map(([k]) => (p ? fmt(p[k]) : 'OOM'))])));
  const open = Boolean(container.querySelector('details')?.open);
  container.replaceChildren(svg, tableView(rows, ['Cuboid', 'Voxel', ...METRICS.map(([, l]) => l)], open));
}

function render() {
  dotPlot($('chart-fusion'), FUSION);
  dotPlot($('chart-heads'), HEADS);
  spatialChart($('chart-spatial'));
}

const picker = $('metric-picker');
for (const [key, name] of METRICS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-checked', String(key === metric));
  b.textContent = name;
  b.addEventListener('click', () => {
    metric = key;
    for (const other of picker.children) other.setAttribute('aria-checked', String(other === b));
    render();
  });
  picker.append(b);
}
render();

// The charts are drawn at the width they are shown at, so redraw them when it changes.
let drawnWidth = $('chart-spatial').clientWidth;
new ResizeObserver(() => {
  const w = $('chart-spatial').clientWidth;
  if (w !== drawnWidth) { drawnWidth = w; render(); }
}).observe(document.querySelector('.charts'));
