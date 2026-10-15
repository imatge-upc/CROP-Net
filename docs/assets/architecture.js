// Interactive diagram of the CROP-Net architecture. The overview follows the
// figure of the paper; clicking a block opens its inside, drawn from the code in
// cropnet/models with the grammar of the paper's block figures: rectangles are
// learned layers, parallelograms tensors and circles element-wise operations.
const NS = 'http://www.w3.org/2000/svg';
// Links to the source files, null until the code is public.
const CODE = null;  // 'https://github.com/imatge-upc/CROP-Net/blob/main/'
const $ = (id) => document.getElementById(id);

function el(name, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.append(node);
  return node;
}

// Text with real super- and subscripts: parts are strings or [string, 'sup' | 'sub'].
function text(parent, x, y, parts, attrs = {}) {
  const t = el('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
    fill: 'var(--ink)', 'font-size': 16, ...attrs }, parent);
  for (const part of [].concat(parts)) {
    const [s, kind] = Array.isArray(part) ? part : [part, null];
    const span = el('tspan', kind ? { 'baseline-shift': kind === 'sup' ? 'super' : 'sub', 'font-size': '72%' } : {}, t);
    span.textContent = s;
  }
  return t;
}
const F = (p) => ['F', [p, 'sup']];
const K = (k) => [String(k), ['3', 'sup']];  // a k x k x k kernel

// Width of text parts in the page font, to size the boxes around them.
const measure = document.createElement('canvas').getContext('2d');
function textWidth(parts, size, weight = 400) {
  const family = getComputedStyle(document.body).fontFamily;
  let width = 0;
  for (const part of [].concat(parts)) {
    const [s, kind] = Array.isArray(part) ? part : [part, null];
    measure.font = `${weight} ${kind ? 0.72 * size : size}px ${family}`;
    width += measure.measureText(s).width;
  }
  return width;
}

function arrowMarker(svg, id) {
  const defs = el('defs', {}, svg);
  const marker = el('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7,
    orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--arrow)' }, marker);
}

function arrow(svg, points, marker = 'arrow') {
  el('polyline', { points: points.map((p) => p.join(',')).join(' '), fill: 'none', stroke: 'var(--arrow)',
    'stroke-width': 2, 'marker-end': `url(#${marker})` }, svg);
}
function arrowLabel(svg, x, y, parts) {
  text(svg, x, y, parts, { 'font-size': 16, 'font-style': 'italic', fill: 'var(--muted)' });
}

const KINDS = {
  backbone: ['--backbone-fill', '--backbone-line'],
  up: ['--up-fill', '--up-line'],
  fuse: ['--fuse-fill', '--fuse-line'],
  proj: ['--proj-fill', '--proj-line'],
  head: ['--head-fill', '--head-line'],
  io: ['--io-fill', '--io-line'],
};

// ---------------------------------------------------------------------------
// The blocks of the overview, sized as in configs/cropnet_fujisfm.py: 1 mm
// voxels, a Minkowski ResNet-34 with 64, 128, 256 and 256 channels after a
// stem that reaches 4 mm, and a neck and head of 256 channels.

const STAGES = {
  rs64: { cin: 64, cout: 64, n: 3, from: 4, to: 8, role: 'As in TR3D, the neck does not use this level.' },
  rs128: { cin: 64, cout: 128, n: 4, from: 8, to: 16,
    role: 'Its output is the lateral input F<sup>l</sup> of the lower Fusion Block.' },
  rs256a: { cin: 128, cout: 256, n: 6, from: 16, to: 32,
    role: 'Its output is the lateral input F<sup>l</sup> of the upper Fusion Block.' },
  rs256b: { cin: 256, cout: 256, n: 3, from: 32, to: 64, role: 'It is the coarsest level, where the top-down neck starts.' },
};

const BLOCKS = {
  input: { view: 'input' },
  ...Object.fromEntries(Object.entries(STAGES).map(([id, p]) => [id, { view: 'stage', p }])),
  upTop: { view: 'up', p: { cin: 256, cout: 256, from: 64, to: 32, level: 'upper' } },
  upLow: { view: 'up', p: { cin: 256, cout: 128, from: 32, to: 16, level: 'lower' } },
  fuseTop: { view: 'fuse', p: { c: 256, mm: 32, level: 'upper' } },
  fuseLow: { view: 'fuse', p: { c: 128, mm: 16, level: 'lower' } },
  projTop: { view: 'proj', p: { cin: 256, mm: 32, level: 'upper' } },
  projLow: { view: 'proj', p: { cin: 128, mm: 16, level: 'lower' } },
  headTop: { view: 'head' },
  headLow: { view: 'head' },
  clsTop: { view: 'head', out: 'cls' },
  clsLow: { view: 'head', out: 'cls' },
  regTop: { view: 'head', out: 'reg' },
  regLow: { view: 'head', out: 'reg' },
};

// Title, description and tensor shapes of a block, shown when it is hovered or selected.
function info(id) {
  const { view, p, out } = BLOCKS[id];
  if (view === 'input') {
    return ['Input cuboid', 'One 0.5 m cuboid of the tree, voxelized at 1 mm: every occupied voxel carries its RGB ' +
      'colour as a 3-channel feature, and empty space is never stored. A stem takes it to 64 channels at 4 mm.',
      'N × 3 → N′ × 64'];
  }
  if (view === 'stage') {
    return [`Residual stage, C = ${p.cout}`, `${p.n} residual blocks, each of two 3<sup>3</sup> sparse convolutions ` +
      `with a shortcut; the first has stride 2, so the voxels grow from ${p.from} to ${p.to} mm. ${p.role}`,
      `N × ${p.cin} → N′ × ${p.cout}`];
  }
  if (view === 'up') {
    return ['Upsample', 'Generative transposed sparse convolution with stride 2, batch norm and ReLU: brings the ' +
      `coarser map to the finer level (${p.from} → ${p.to} mm). Its output is the up-sampled input F<sup>u</sup> ` +
      `of the ${p.level} Fusion Block.`, `N × ${p.cin} → N′ × ${p.cout}`];
  }
  if (view === 'fuse') {
    return ['Fusion Block', 'The MultiHeadFusionBlock merges the up-sampled map F<sup>u</sup> with the lateral ' +
      `backbone map F<sup>l</sup> of the same level, at ${p.mm} mm voxels, where TR3D simply adds them.`,
      `N × ${p.c}, N × ${p.c} → N × ${p.c}`];
  }
  if (view === 'proj') {
    return ['Projection', '3<sup>3</sup> sparse convolution with batch norm and ReLU to the 256 channels of the ' +
      `detection head, at ${p.mm} mm voxels.`, `N × ${p.cin} → N × 256`];
  }
  if (out === 'cls') {
    return ['Class logit', 'Apple logit of every active voxel; a sigmoid turns it into the score that the confidence ' +
      'threshold and the NMS use.', 'N × 1'];
  }
  if (out === 'reg') {
    return ['Box regression', 'Box relative to the voxel: centre offset (Δx, Δy, Δz), size (l, w, h) and yaw encoded ' +
      'as (sin 2θ, cos 2θ).', 'N × 8'];
  }
  return ['Detection head', 'Anchor-free and shared by both levels: two 1<sup>3</sup> sparse convolutions predict, ' +
    'at every active voxel, an apple logit and a box.', 'N × 256 → N × 1, N × 8'];
}

let hoveredId = null, openId = null, heads = 4;

const DEFAULT_INFO = '<h4>One forward pass per cuboid</h4><p>CROP-Net is TR3D, an anchor-free sparse-voxel ' +
  'detector, with a MultiHeadFusionBlock in place of the element-wise sum of its top-down neck. Hover over a ' +
  'block to see what it does, and click it to look inside.</p>';

function infoContent(id) {
  const [title, body, shape] = info(id);
  return `<h4>${title}</h4><p>${body}</p><p class="shape">${shape}</p><button type="button" class="link">` +
    `${openId === id ? 'Hide the inside view' : 'Look inside the block'}</button>`;
}

function showInfo(id) {
  const box = $('arch-info');
  box.innerHTML = infoContent(id);
  box.querySelector('button').addEventListener('click', () => toggleInside(id));
}

// The info panel sits above the diagram, so it keeps the height of its longest
// text: hovering a block must never move the diagram under the pointer.
function sizeInfo() {
  const box = $('arch-info');
  const probe = document.createElement('aside');
  probe.className = 'arch-info';
  probe.style.cssText = `position: absolute; visibility: hidden; top: 0; left: 0; width: ${box.offsetWidth}px; min-height: 0`;
  document.body.append(probe);
  let height = 0;
  for (const html of [DEFAULT_INFO, ...Object.keys(BLOCKS).map(infoContent)]) {
    probe.innerHTML = html;
    height = Math.max(height, probe.offsetHeight);
  }
  probe.remove();
  box.style.minHeight = `${height}px`;
}

function block(svg, id, kind, x, y, w, h, title, sub = null, shape = 'rect') {
  const [fill, line] = KINDS[kind];
  const g = el('g', { class: 'block', tabindex: 0, role: 'button', 'aria-label': `${info(id)[0]}, look inside` }, svg);
  g.dataset.id = id;
  if (shape === 'para') {
    const s = 12;
    el('polygon', { points: `${x + s},${y} ${x + w},${y} ${x + w - s},${y + h} ${x},${y + h}`,
      fill: `var(${fill})`, stroke: `var(${line})`, 'stroke-width': 2 }, g);
  } else {
    el('rect', { x, y, width: w, height: h, rx: 8, fill: `var(${fill})`, stroke: `var(${line})`, 'stroke-width': 2.5 }, g);
  }
  text(g, x + w / 2, y + h / 2 - (sub ? 10 : 0), title, { 'font-weight': 700 });
  if (sub) text(g, x + w / 2, y + h / 2 + 12, sub, { 'font-size': 14, fill: 'var(--ink-2)' });
  const select = () => {
    for (const other of svg.querySelectorAll('.block.active')) other.classList.remove('active');
    g.classList.add('active');
    hoveredId = id;
    showInfo(id);
  };
  g.addEventListener('pointerenter', select);
  g.addEventListener('focus', select);
  g.addEventListener('click', () => { select(); toggleInside(id); });
  g.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); toggleInside(id); }
  });
  return g;
}

function drawArchitecture() {
  const svg = el('svg', { viewBox: '0 0 980 530', role: 'img', 'aria-label': 'CROP-Net architecture' });
  arrowMarker(svg, 'arrow');
  const column = (x, label) => text(svg, x, 16, label, { 'font-size': 13, fill: 'var(--muted)', 'letter-spacing': '0.08em' });
  column(115, 'BACKBONE');
  column(350, 'NECK');
  column(760, 'HEAD');

  // Backbone, bottom-up.
  const bx = 40, bw = 150, bh = 56;
  const y = { rs256b: 40, rs256a: 156, rs128: 300, rs64: 392, input: 464 };
  arrow(svg, [[bx + bw / 2, y.input], [bx + bw / 2, y.rs64 + bh + 2]]);
  arrow(svg, [[bx + bw / 2, y.rs64], [bx + bw / 2, y.rs128 + bh + 2]]);
  arrow(svg, [[bx + bw / 2, y.rs128], [bx + bw / 2, y.rs256a + bh + 2]]);
  arrow(svg, [[bx + bw / 2, y.rs256a], [bx + bw / 2, y.rs256b + bh + 2]]);
  block(svg, 'input', 'io', bx, y.input, bw, 58, 'Input cuboid', '0.5 m · 1 mm voxels', 'para');
  block(svg, 'rs64', 'backbone', bx, y.rs64, bw, bh, 'Residual Stage', 'C = 64');
  block(svg, 'rs128', 'backbone', bx, y.rs128, bw, bh, 'Residual Stage', 'C = 128');
  block(svg, 'rs256a', 'backbone', bx, y.rs256a, bw, bh, 'Residual Stage', 'C = 256');
  block(svg, 'rs256b', 'backbone', bx, y.rs256b, bw, bh, 'Residual Stage', 'C = 256');

  // Neck, top-down.
  const nx = 270, nw = 160;
  const up2 = 46, fuse2 = 156, up1 = 234, fuse1 = 300;
  arrow(svg, [[bx + bw, y.rs256b + bh / 2], [nx - 2, up2 + 22]]);
  arrow(svg, [[nx + nw / 2, up2 + 44], [nx + nw / 2, fuse2 - 2]]);
  arrowLabel(svg, nx + nw / 2 + 24, (up2 + 44 + fuse2) / 2, F('u'));
  arrow(svg, [[bx + bw, y.rs256a + bh / 2], [nx - 2, fuse2 + bh / 2]]);
  arrowLabel(svg, (bx + bw + nx) / 2, y.rs256a + bh / 2 - 17, F('l'));
  arrow(svg, [[nx + nw / 2, fuse2 + bh], [nx + nw / 2, up1 - 2]]);
  arrow(svg, [[nx + nw / 2, up1 + 40], [nx + nw / 2, fuse1 - 2]]);
  arrowLabel(svg, nx + nw / 2 + 24, (up1 + 40 + fuse1) / 2, F('u'));
  arrow(svg, [[bx + bw, y.rs128 + bh / 2], [nx - 2, fuse1 + bh / 2]]);
  arrowLabel(svg, (bx + bw + nx) / 2, y.rs128 + bh / 2 - 17, F('l'));
  block(svg, 'upTop', 'up', nx, up2, nw, 44, 'Upsample');
  block(svg, 'fuseTop', 'fuse', nx, fuse2, nw, bh, 'Fusion Block');
  block(svg, 'upLow', 'up', nx, up1, nw, 40, 'Upsample');
  block(svg, 'fuseLow', 'fuse', nx, fuse1, nw, bh, 'Fusion Block');

  // Projection, head and outputs per level.
  const px = 466, pw = 140, hx = 640, hw = 168, ox = 842, ow = 124;
  for (const [level, top] of [['Top', fuse2], ['Low', fuse1]]) {
    arrow(svg, [[nx + nw, top + bh / 2], [px - 2, top + bh / 2]]);
    arrow(svg, [[px + pw, top + bh / 2], [hx - 2, top + bh / 2]]);
    arrow(svg, [[hx + hw, top + bh / 2 - 8], [ox + 6, top - 8]]);
    arrow(svg, [[hx + hw, top + bh / 2 + 8], [ox + 6, top + bh + 8]]);
    block(svg, `proj${level}`, 'proj', px, top, pw, bh, 'Projection');
    block(svg, `head${level}`, 'head', hx, top, hw, bh, 'Detection Head');
    block(svg, `cls${level}`, 'io', ox, top - 34, ow, 46, 'Class logit', 'N × 1', 'para');
    block(svg, `reg${level}`, 'io', ox, top + bh - 12, ow, 46, 'Box reg.', 'N × 8', 'para');
  }
  $('arch').append(svg);
}

// ---------------------------------------------------------------------------
// Drawing kit for the inside views. Each view is drawn at its natural size and
// only scaled down to fit, so all of them share the same text size.

const BOX_H = 48, T_W = 116, T_H = 58, GAP = 22, PAD = 16, LINK = 28, EDGE = 8, LABEL = 15;

function view(width, height, label) {
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': label });
  arrowMarker(svg, 'arrow-i');
  return svg;
}
const link = (svg, points) => arrow(svg, points, 'arrow-i');
function curve(svg, [x0, y0], [x1, y1]) {
  const mx = (x0 + x1) / 2;
  el('path', { d: `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}`, fill: 'none', stroke: 'var(--arrow)',
    'stroke-width': 2, 'marker-end': 'url(#arrow-i)' }, svg);
}

const boxWidth = (parts, sub = null) => Math.max(textWidth(parts, LABEL, 700), sub ? textWidth(sub, 12.5) : 0) + 30;

// A layer; returns its right edge.
function layer(svg, x, cy, kind, parts, { sub = null, dashed = false, w = boxWidth(parts, sub) } = {}) {
  const [fill, line] = KINDS[kind];
  el('rect', { x, y: cy - BOX_H / 2, width: w, height: BOX_H, rx: 7, fill: `var(${fill})`, stroke: `var(${line})`,
    'stroke-width': 2, 'stroke-dasharray': dashed ? '6 4' : 'none' }, svg);
  text(svg, x + w / 2, cy - (sub ? 8 : 0), parts, { 'font-weight': 700, 'font-size': LABEL });
  if (sub) text(svg, x + w / 2, cy + 13, sub, { 'font-size': 12.5, fill: 'var(--ink-2)' });
  return x + w;
}

// A tensor: its shape, or with `name` a named output and its shape.
function tensor(svg, x, cy, title, sub = null, { w = T_W, name = false } = {}) {
  const s = 12, y = cy - T_H / 2;
  el('polygon', { points: `${x + s},${y} ${x + w},${y} ${x + w - s},${y + T_H} ${x},${y + T_H}`,
    fill: 'var(--io-fill)', stroke: 'var(--io-line)', 'stroke-width': 2 }, svg);
  text(svg, x + w / 2, cy - (sub ? 9 : 0), title,
    name ? { 'font-weight': 700, 'font-size': LABEL } : { 'font-style': 'italic' });
  if (sub) {
    text(svg, x + w / 2, cy + 13, sub,
      name ? { 'font-style': 'italic', 'font-size': 14, fill: 'var(--ink-2)' } : { 'font-size': 12.5, fill: 'var(--ink-2)' });
  }
}
// Where arrows meet the slanted sides of a tensor, at its mid-height.
const tensorIn = (x) => x + 6;
const tensorOut = (x, w = T_W) => x + w - 6;

function container(svg, x, y, w, h, kind, label = null) {
  const [fill, line] = KINDS[kind];
  el('rect', { x, y, width: w, height: h, rx: 12, fill: `var(${fill})`, 'fill-opacity': 0.4,
    stroke: `var(${line})`, 'stroke-width': 2.5 }, svg);
  if (label) {
    text(svg, x + 14, y + 16, label, { 'text-anchor': 'start', 'font-size': 13, 'font-weight': 700, fill: `var(${line})` });
  }
}

function plus(svg, cx, cy) {
  el('circle', { cx, cy, r: 12, fill: 'var(--card)', stroke: 'var(--ink-2)', 'stroke-width': 2 }, svg);
  el('path', { d: `M${cx - 6},${cy} h12 M${cx},${cy - 6} v12`, stroke: 'var(--ink-2)', 'stroke-width': 2 }, svg);
}

// Input tensor, the layers of the block in a row inside its container, output tensor.
function chain(label, kind, input, layers, output) {
  const widths = layers.map(([parts, sub]) => boxWidth(parts, sub));
  const cx = EDGE + T_W + LINK;
  const cw = 2 * PAD + widths.reduce((a, b) => a + b, 0) + GAP * (layers.length - 1);
  const ox = cx + cw + LINK, cy = 62;
  const svg = view(ox + T_W + EDGE, 124, label);
  container(svg, cx, cy - 46, cw, 92, kind);
  tensor(svg, EDGE, cy, ...input);
  tensor(svg, ox, cy, ...output);
  let x = cx + PAD;
  const xs = widths.map((w) => { const left = x; x += w + GAP; return left; });
  layers.forEach(([parts, sub], i) => layer(svg, xs[i], cy, kind, parts, { sub, w: widths[i] }));
  link(svg, [[tensorOut(EDGE), cy], [xs[0] - 1, cy]]);
  xs.forEach((left, i) => link(svg, [[left + widths[i], cy],
    [i + 1 < xs.length ? xs[i + 1] - 1 : tensorIn(ox) - 1, cy]]));
  return svg;
}

// Voxelization of the cuboid and the stem of the Minkowski ResNet-34.
function drawInput() {
  const cy = 76, kind = 'backbone';
  const voxelize = [['Voxelize'], '1 mm grid'];
  const stem = [['SparseConv ', ...K(3), ' ↓2'], ['BN'], ['ReLU'], ['MaxPool ', ...K(2), ' ↓2']];
  const vx = EDGE + T_W + LINK, vw = boxWidth(...voxelize);
  const tx = vx + vw + LINK, cx = tx + T_W + LINK;
  const widths = stem.map((parts) => boxWidth(parts));
  const cw = 2 * PAD + widths.reduce((a, b) => a + b, 0) + GAP * (stem.length - 1);
  const ox = cx + cw + LINK;
  const svg = view(ox + T_W + EDGE, 146, 'Voxelization and stem');
  container(svg, cx, cy - 58, cw, 108, kind, 'Stem');
  tensor(svg, EDGE, cy, 'Points', 'x, y, z, r, g, b', { name: true });
  tensor(svg, tx, cy, 'N × 3', '1 mm voxels');
  tensor(svg, ox, cy, 'N′ × 64', '4 mm voxels');
  layer(svg, vx, cy, 'io', voxelize[0], { sub: voxelize[1], dashed: true, w: vw });
  let x = cx + PAD;
  const xs = widths.map((w) => { const left = x; x += w + GAP; return left; });
  stem.forEach((parts, i) => layer(svg, xs[i], cy, kind, parts, { w: widths[i] }));
  link(svg, [[tensorOut(EDGE), cy], [vx - 1, cy]]);
  link(svg, [[vx + vw, cy], [tensorIn(tx) - 1, cy]]);
  link(svg, [[tensorOut(tx), cy], [xs[0] - 1, cy]]);
  xs.forEach((left, i) => link(svg, [[left + widths[i], cy],
    [i + 1 < xs.length ? xs[i + 1] - 1 : tensorIn(ox) - 1, cy]]));
  return svg;
}

// A residual stage: its strided first block in full, then the other blocks.
function drawStage(p) {
  const kind = 'backbone', ym = 84, ys = 172, R = 12;
  const main = [['SparseConv ', ...K(3), ' ↓2'], ['BN'], ['ReLU'], ['SparseConv ', ...K(3)], ['BN']];
  const shortcut = [['SparseConv ', ...K(1), ' ↓2'], ['BN']];
  const repeat = [[`Residual block × ${p.n - 1}`], 'stride 1, identity shortcut'];

  const c1 = EDGE + T_W + LINK;
  let x = c1 + PAD;
  const mx = main.map((parts) => { const left = x; x += boxWidth(parts) + GAP; return left; });
  const px = x + R;               // the sum
  const rx = px + R + GAP;        // the last ReLU
  const c1w = rx + boxWidth(['ReLU']) + PAD - c1;
  const c2 = c1 + c1w + LINK, rw = boxWidth(...repeat), c2w = 2 * PAD + rw;
  const svg = view(c2 + c2w + EDGE, 220, `Residual stage of ${p.n} blocks`);

  container(svg, c1, 30, c1w, 176, kind, 'Block 1 · stride 2');
  container(svg, c2, ym - 54, c2w, 108, kind, `Blocks 2–${p.n}`);
  const ox = c2 + c2w / 2 - T_W / 2;
  tensor(svg, EDGE, ym, `N × ${p.cin}`, `${p.from} mm voxels`);
  tensor(svg, ox, ys, `N′ × ${p.cout}`, `${p.to} mm voxels`);
  main.forEach((parts, i) => layer(svg, mx[i], ym, kind, parts));
  plus(svg, px, ym);
  const reluRight = layer(svg, rx, ym, kind, ['ReLU']);
  layer(svg, c2 + PAD, ym, kind, repeat[0], { sub: repeat[1], w: rw });

  // The shortcut, centred under the main path.
  const sw = shortcut.map((parts) => boxWidth(parts));
  const sx = (mx[0] + px) / 2 - (sw[0] + GAP + sw[1]) / 2;
  layer(svg, sx, ys, kind, shortcut[0], { w: sw[0] });
  const shortRight = layer(svg, sx + sw[0] + GAP, ys, kind, shortcut[1], { w: sw[1] });

  const bx = c1 + PAD / 2;        // where the shortcut leaves the input
  link(svg, [[tensorOut(EDGE), ym], [mx[0] - 1, ym]]);
  el('circle', { cx: bx, cy: ym, r: 3.5, fill: 'var(--arrow)' }, svg);
  main.forEach((parts, i) => link(svg, [[mx[i] + boxWidth(parts), ym],
    [i + 1 < main.length ? mx[i + 1] - 1 : px - R - 1, ym]]));
  link(svg, [[px + R, ym], [rx - 1, ym]]);
  link(svg, [[bx, ym], [bx, ys], [sx - 1, ys]]);
  link(svg, [[sx + sw[0], ys], [sx + sw[0] + GAP - 1, ys]]);
  link(svg, [[shortRight, ys], [px, ys], [px, ym + R + 1]]);
  link(svg, [[reluRight, ym], [c2 + PAD - 1, ym]]);
  link(svg, [[c2 + c2w / 2, ym + BOX_H / 2], [c2 + c2w / 2, ys - T_H / 2 - 1]]);
  return svg;
}

// The detection head: two parallel 1x1x1 convolutions on the same features.
function drawHead() {
  const kind = 'head', y1 = 70, y2 = 170, cy = (y1 + y2) / 2;
  const rows = [
    [['SparseConv ', ...K(1), '  (cls)'], 'Class logit', 'N × 1'],
    [['SparseConv ', ...K(1), '  (reg)'], 'Box reg.', 'N × 8'],
  ];
  const cx = EDGE + T_W + 60;
  const bw = Math.max(...rows.map(([parts]) => boxWidth(parts)));
  const cw = 2 * PAD + bw, ox = cx + cw + LINK + 12, ow = 128;
  const svg = view(ox + ow + EDGE, 240, 'Detection head');
  container(svg, cx, 24, cw, 192, kind);
  tensor(svg, EDGE, cy, 'N × 256');
  rows.forEach(([parts, name, shape], i) => {
    const y = i ? y2 : y1;
    tensor(svg, ox, y, name, shape, { w: ow, name: true });
    const right = layer(svg, cx + PAD, y, kind, parts, { w: bw });
    curve(svg, [tensorOut(EDGE), cy], [cx + PAD - 1, y]);
    link(svg, [[right, y], [tensorIn(ox) - 1, y]]);
  });
  return svg;
}

// Inside the MultiHeadFusionBlock, with the number of heads H.
const HEADS = {
  1: { ap: '82.18 ± 4.14', ar: '91.17 ± 2.87', f1: '83.64 ± 3.17' },
  2: { ap: '85.62 ± 3.65', ar: '90.50 ± 2.98', f1: '85.10 ± 3.47' },
  4: { ap: '87.11 ± 5.74', ar: '93.56 ± 4.20', f1: '87.39 ± 3.82' },
  8: { ap: '74.91 ± 16.90', ar: '87.00 ± 7.05', f1: '75.00 ± 14.77' },
};

function drawFusion(H) {
  const rowH = 36, gap = 8;
  const inner = H * rowH + (H - 1) * gap;
  const height = Math.max(260, inner + 110);
  const mid = height / 2 + 10;
  const svg = el('svg', { viewBox: `0 0 1000 ${height}`, width: 1000, height, role: 'img',
    'aria-label': `MultiHeadFusionBlock with ${H} heads` });
  arrowMarker(svg, 'arrow-f');
  const arr = (pts) => arrow(svg, pts, 'arrow-f');
  const para = (x, yy, w, h, title, sub) => {
    const s = 12;
    el('polygon', { points: `${x + s},${yy} ${x + w},${yy} ${x + w - s},${yy + h} ${x},${yy + h}`,
      fill: 'var(--io-fill)', stroke: 'var(--io-line)', 'stroke-width': 2 }, svg);
    text(svg, x + w / 2, yy + h / 2 - 9, title, { 'font-weight': 700, 'font-style': 'italic' });
    text(svg, x + w / 2, yy + h / 2 + 12, sub, { 'font-size': 14, fill: 'var(--ink-2)' });
  };

  para(16, mid - 96, 110, 52, F('u'), 'N × C');
  para(16, mid + 44, 110, 52, F('l'), 'N × C');
  para(160, mid - 26, 170, 52, ['Union [', ...F('u'), ', ', ...F('l'), ']'], 'N × 2C');
  arr([[114, mid - 44], [184, mid - 28]]);
  arr([[114, mid + 44], [184, mid + 28]]);

  // Heads container.
  const cx = 366, cw = 320, top = mid - inner / 2;
  el('rect', { x: cx, y: top - 36, width: cw, height: inner + 54, rx: 12, fill: 'var(--fuse-fill)',
    'fill-opacity': 0.45, stroke: 'var(--fuse-line)', 'stroke-width': 2.5 }, svg);
  text(svg, cx + cw / 2, top - 18, `× H = ${H} ${H === 1 ? 'head' : 'heads'}`,
    { 'font-size': 15, 'font-weight': 700, fill: 'var(--fuse-line)' });
  for (let h = 0; h < H; h++) {
    const yy = top + h * (rowH + gap);
    el('rect', { x: cx + 14, y: yy, width: cw - 28, height: rowH, rx: 6, fill: 'var(--card)',
      stroke: 'var(--fuse-line)', 'stroke-width': 1.2 }, svg);
    const g = (pathway) => (H === 1 ? ['σ(g', [pathway, 'sup'], ')'] : ['σ(g', [String(h + 1), 'sub'], [pathway, 'sup'], ')']);
    text(svg, cx + cw / 2, yy + rowH / 2,
      [...g('u'), ' ⊙ ', ...F('u'), '  +  ', ...g('l'), ' ⊙ ', ...F('l')], { 'font-size': 15 });
    arr([[330, mid], [cx + 12, yy + rowH / 2]]);
    arr([[cx + cw - 14, yy + rowH / 2], [716, mid]]);
  }
  para(718, mid - 26, 112, 52, 'Concat', 'N × H·C');
  el('rect', { x: 850, y: mid - 30, width: 128, height: 60, rx: 7, fill: 'var(--fuse-fill)',
    stroke: 'var(--fuse-line)', 'stroke-width': 2.2 }, svg);
  text(svg, 914, mid - 10, ['1', ['3', 'sup'], ' conv'], { 'font-weight': 700, 'font-size': 15 });
  text(svg, 914, mid + 12, 'BN · ReLU', { 'font-size': 13, fill: 'var(--ink-2)' });
  arr([[830, mid], [848, mid]]);
  para(870, mid + 62, 96, 50, 'Y', 'N × C');
  arr([[914, mid + 30], [914, mid + 60]]);
  return svg;
}

function fusionText(p) {
  const m = HEADS[heads];
  return 'Each head <i>h</i> owns two gate vectors, g<sub>h</sub><sup>u</sup> and g<sub>h</sub><sup>l</sup>, with one ' +
    'value per channel: they are learned during training and fixed afterwards, so they do not depend on the input. ' +
    `With H = ${heads}: AP@0.25 ${m.ap}, AR@0.25 ${m.ar}, F1@0.25 ${m.f1}` +
    (heads === 4 ? ' (the configuration of CROP-Net). ' : '. ') +
    'After the block, as in TR3D, a 3<sup>3</sup> sparse convolution with batch norm and ReLU refines Y; its output ' +
    `goes to the Projection${p.level === 'upper' ? ' and to the Upsample of the lower level' : ''}.`;
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);

// Title, subtitle, figure, explanation and source files of every inside view.
const VIEWS = {
  input: () => ({
    title: 'Inside the input: voxelization and stem',
    sub: '0.5 m cuboid · 1 → 4 mm voxels · 3 → 64 channels',
    figure: drawInput(),
    text: 'The points of the cuboid, in metres, are divided by the voxel size and quantized to integer coordinates; ' +
      'every occupied voxel carries its RGB colour, scaled to [0, 1], as a 3-channel feature, and empty space is ' +
      'never stored. The stem of the Minkowski ResNet-34, which the overview folds into the input, halves the ' +
      'resolution twice (1 → 2 → 4 mm) and lifts the features to 64 channels before the first residual stage.',
    code: ['cropnet/models/detector.py', 'cropnet/models/backbone.py'],
  }),
  stage: (p) => ({
    title: 'Inside a Residual Stage',
    sub: `${p.n} residual blocks · ${p.cin} → ${p.cout} channels · ${p.from} → ${p.to} mm voxels`,
    figure: drawStage(p),
    text: 'The first block, drawn in full, strides by 2 in its first convolution and in the 1<sup>3</sup> ' +
      `convolution of its shortcut, so both paths reach the halved resolution${p.cin === p.cout ? '' : ` with ${p.cout} channels`} ` +
      `before they are added. The other ${p.n - 1} blocks keep the resolution and add their input back unchanged. ${p.role}`,
    code: ['cropnet/models/backbone.py'],
  }),
  up: (p) => ({
    title: 'Inside the Upsample',
    sub: `${cap(p.level)} level · ${p.cin} → ${p.cout} channels · ${p.from} → ${p.to} mm voxels`,
    figure: chain('Upsample', 'up', [`N × ${p.cin}`, `${p.from} mm voxels`],
      [[['Gen. Transp. ', ...K(3), ' ↑2']], [['BN']], [['ReLU']]], [`N′ × ${p.cout}`, `${p.to} mm voxels`]),
    text: 'The generative transposed convolution doubles the resolution and creates the active voxels of the finer ' +
      'grid around every coarse voxel, instead of reusing those of the backbone. The Fusion Block then aligns this ' +
      'map, F<sup>u</sup>, with the lateral map F<sup>l</sup> on the union of their voxels.',
    code: ['cropnet/models/neck.py'],
  }),
  fuse: (p) => ({
    title: 'Inside the MultiHeadFusionBlock',
    sub: `${cap(p.level)} level · C = ${p.c} · ${p.mm} mm voxels`,
    figure: drawFusion(heads),
    text: fusionText(p),
    code: ['cropnet/models/fusion.py', 'cropnet/models/neck.py'],
  }),
  proj: (p) => ({
    title: 'Inside the Projection',
    sub: `${cap(p.level)} level · ${p.cin} → 256 channels · ${p.mm} mm voxels`,
    figure: chain('Projection', 'proj', [`N × ${p.cin}`, `${p.mm} mm voxels`],
      [[['SparseConv ', ...K(3)]], [['BN']], [['ReLU']]], ['N × 256', `${p.mm} mm voxels`]),
    text: 'With stride 1 the convolution keeps the voxels and gathers the 3 × 3 × 3 neighbourhood of each one, ' +
      `${p.cin === 256 ? 'keeping the 256 channels' : `taking the ${p.cin} channels to the 256`} that the shared ` +
      'detection head expects.',
    code: ['cropnet/models/neck.py'],
  }),
  head: () => ({
    title: 'Inside the Detection Head',
    sub: 'Shared by both levels · 16 and 32 mm voxels',
    figure: drawHead(),
    text: 'The same two 1<sup>3</sup> convolutions run at both levels. A sigmoid turns the class logit into an apple ' +
      'score, and the 8 regression values give a box relative to the voxel: centre offset (Δx, Δy, Δz), size ' +
      '(l, w, h) and yaw as (sin 2θ, cos 2θ). In training, every apple is assigned to the finer level, where the 25 ' +
      'voxels closest to its centre are its positives (focal loss on the scores, DIoU loss on the boxes). At test ' +
      'time, the boxes scoring above 0.001 among the 10 000 best voxels of a cuboid go through a 3D NMS at IoU 0.35, ' +
      'and the boxes of all the cuboids then meet in the global NMS of the tree.',
    code: ['cropnet/models/head.py'],
  }),
};

function renderInside() {
  const { view: kind, p } = BLOCKS[openId];
  const v = VIEWS[kind](p);
  $('inside-title').textContent = v.title;
  $('inside-sub').textContent = v.sub;
  $('inside-figure').replaceChildren(v.figure);
  $('inside-text').innerHTML = v.text;
  $('heads-picker').hidden = kind !== 'fuse';
  const code = $('inside-code');
  code.hidden = !CODE;
  if (CODE) {
    code.replaceChildren('Code: ');
    v.code.forEach((path, i) => {
      const a = document.createElement('a');
      a.href = CODE + path;
      a.textContent = path;
      code.append(...(i ? [', ', a] : [a]));
    });
  }
}

function markOpen() {
  for (const g of document.querySelectorAll('#arch .block')) g.classList.toggle('open', g.dataset.id === openId);
}

function toggleInside(id) {
  const panel = $('inside');
  if (openId === id) {
    openId = null;
    panel.hidden = true;
  } else {
    openId = id;
    renderInside();
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  markOpen();
  if (hoveredId) showInfo(hoveredId);
}

function headsPicker() {
  const picker = $('heads-picker');
  for (const H of [1, 2, 4, 8]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(H === heads));
    b.textContent = `H = ${H}`;
    b.addEventListener('click', () => {
      heads = H;
      for (const other of picker.children) other.setAttribute('aria-checked', String(other === b));
      if (openId && BLOCKS[openId].view === 'fuse') renderInside();
    });
    picker.append(b);
  }
}

drawArchitecture();
$('arch-info').innerHTML = DEFAULT_INFO;
headsPicker();
let infoWidth = 0;
new ResizeObserver(() => {
  const w = $('arch-info').offsetWidth;
  if (w !== infoWidth) { infoWidth = w; sizeInfo(); }
}).observe($('arch-info'));
$('inside-close').addEventListener('click', () => { if (openId) toggleInside(openId); });
$('inside').addEventListener('keydown', (e) => { if (e.key === 'Escape' && openId) toggleInside(openId); });
