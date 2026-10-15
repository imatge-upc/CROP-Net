// Interactive 3D viewer: a Fuji-SfM tree, its ground truth and the predictions.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const OPERATING_POINT = 0.43;  // confidence threshold chosen on the validation trees
const CUBOID = 0.5, STRIDE = 0.4;

const $ = (id) => document.getElementById(id);
const container = $('viewer');
const stage = $('stage');
const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
camera.up.set(0, 1, 0);  // Fuji-SfM trees are y-up
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const lineMaterials = [];
function lineMaterial(color, width) {
  const material = new LineMaterial({ color: new THREE.Color(color), linewidth: width });
  lineMaterials.push(material);
  return material;
}

function resize() {
  const { clientWidth: w, clientHeight: h } = stage;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  for (const m of lineMaterials) m.resolution.set(w, h);
}
new ResizeObserver(resize).observe(stage);

// Boxes are [cx, cy, cz, sx, sy, sz, (score)], axis-aligned.
function edgePositions(boxes) {
  const out = new Float32Array(boxes.length * 72);
  let o = 0;
  for (const [cx, cy, cz, sx, sy, sz] of boxes) {
    const x = [cx - sx / 2, cx + sx / 2], y = [cy - sy / 2, cy + sy / 2], z = [cz - sz / 2, cz + sz / 2];
    const corner = (i, j, k) => [x[i], y[j], z[k]];
    const edges = [
      [[0, 0, 0], [1, 0, 0]], [[0, 1, 0], [1, 1, 0]], [[0, 0, 1], [1, 0, 1]], [[0, 1, 1], [1, 1, 1]],
      [[0, 0, 0], [0, 1, 0]], [[1, 0, 0], [1, 1, 0]], [[0, 0, 1], [0, 1, 1]], [[1, 0, 1], [1, 1, 1]],
      [[0, 0, 0], [0, 0, 1]], [[1, 0, 0], [1, 0, 1]], [[0, 1, 0], [0, 1, 1]], [[1, 1, 0], [1, 1, 1]]];
    for (const [a, b] of edges) {
      out.set(corner(...a), o); out.set(corner(...b), o + 3); o += 6;
    }
  }
  return out;
}

function boxLines(boxes, material) {
  if (!boxes.length) return null;
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(edgePositions(boxes));
  return new LineSegments2(geometry, material);
}

const state = { tree: null, score: OPERATING_POINT };
const cache = new Map();
const layers = { points: null, cuboids: null, boxes: new THREE.Group() };
scene.add(layers.boxes);
let pointMaterial = null;

const materials = {
  gt: lineMaterial(token('--gt'), 2.5),
  pred: lineMaterial(token('--pred'), 2.5),
};

async function fetchTree(id) {
  if (!cache.has(id)) {
    cache.set(id, Promise.all([
      fetch(`data/${id}.json`).then((r) => r.json()),
      fetch(`data/${id}.bin`).then((r) => r.arrayBuffer()),
    ]).then(([meta, buffer]) => ({ meta, buffer })));
  }
  return cache.get(id);
}

function buildPoints(meta, buffer) {
  const n = meta.points;
  const q = new Uint16Array(buffer, 0, n * 3);
  const rgb = new Uint8Array(buffer, n * 6, n * 3);
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) {
    const a = i % 3;
    positions[i] = meta.min[a] + (q[i] / 65535) * (meta.max[a] - meta.min[a]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3, true));
  pointMaterial = pointMaterial || new THREE.PointsMaterial({ size: 0.004, vertexColors: true });
  return { object: new THREE.Points(geometry, pointMaterial), positions };
}

// The cuboid grid of tools/prepare_data/make_cuboids.py, drawn where the tree has points.
function buildCuboids(meta, positions) {
  const counts = new Map();
  for (let i = 0; i < meta.points; i++) {
    const key = [0, 1, 2].map((a) => Math.floor((positions[3 * i + a] - meta.min[a]) / STRIDE)).join(',');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const boxes = [];
  for (const [key, count] of counts) {
    if (count < 40) continue;
    const origin = key.split(',').map((v, a) => meta.min[a] + Number(v) * STRIDE);
    boxes.push([origin[0] + CUBOID / 2, origin[1] + CUBOID / 2, origin[2] + CUBOID / 2, CUBOID, CUBOID, CUBOID]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(edgePositions(boxes), 3));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: new THREE.Color(token('--cuboid')), transparent: true, opacity: 0.35, depthWrite: false }));
  lines.visible = $('show-cuboids').checked;
  return lines;
}

function drawBoxes() {
  const { meta } = state.tree;
  for (const child of layers.boxes.children) child.geometry.dispose();
  layers.boxes.clear();
  const add = (boxes, material) => { const l = boxLines(boxes, material); if (l) layers.boxes.add(l); };
  if ($('show-gt').checked) add(meta.gt, materials.gt);
  if (Array.isArray(meta.pred) && $('show-pred').checked) {
    add(meta.pred.filter((p) => p[6] >= state.score), materials.pred);
  }
}

async function showTree(id) {
  $('loading').style.display = 'grid';
  for (const button of $('tree-tabs').children) {
    button.setAttribute('aria-selected', String(button.dataset.id === id));
  }
  const { meta, buffer } = await fetchTree(id);
  if (layers.points) scene.remove(layers.points);
  if (layers.cuboids) scene.remove(layers.cuboids);
  const built = buildPoints(meta, buffer);
  layers.points = built.object;
  layers.cuboids = buildCuboids(meta, built.positions);
  scene.add(layers.points, layers.cuboids);
  state.tree = { id, meta, center: meta.min.map((v, a) => (v + meta.max[a]) / 2), extent: meta.max.map((v, a) => v - meta.min[a]) };

  const hasPred = Array.isArray(meta.pred);
  for (const row of ['pred-row', 'score-row']) $(row).style.display = hasPred ? '' : 'none';
  $('viewer-caption').textContent = hasPred
    ? `Tree ${meta.tree} of Fuji-SfM: ${meta.gt.length} annotated apples and the predictions of the model trained without this tree (fold ${meta.tree}), after the global NMS (IoU ${meta.nms}).`
    : `Tree ${meta.tree} of Fuji-SfM reconstructed with structure-from-motion, with its ${meta.gt.length} annotated apples.`;
  drawBoxes();
  home();
  $('loading').style.display = 'none';
}

function home() {
  const { center, extent } = state.tree;
  const distance = Math.max(extent[1], extent[0]) * 1.45;
  controls.target.set(center[0], center[1], center[2]);
  camera.position.set(center[0] + 0.15 * distance, center[1] + 0.1 * distance, center[2] + distance);
  controls.update();
}

async function init() {
  const trees = await fetch('data/trees.json').then((r) => r.json());
  const tabs = $('tree-tabs');
  for (const t of trees) {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.dataset.id = t.id;
    button.append(document.createTextNode(`Tree ${t.tree}`));
    const small = document.createElement('small');
    small.textContent = `${t.apples} apples`;
    button.append(small);
    button.addEventListener('click', () => showTree(t.id));
    tabs.append(button);
  }
  $('show-gt').addEventListener('change', drawBoxes);
  $('show-pred').addEventListener('change', drawBoxes);
  $('show-cuboids').addEventListener('change', (e) => { if (layers.cuboids) layers.cuboids.visible = e.target.checked; });
  $('point-size').addEventListener('input', (e) => { if (pointMaterial) pointMaterial.size = 0.001 * e.target.value; });
  $('score').addEventListener('input', (e) => {
    state.score = Number(e.target.value);
    $('score-value').textContent = state.score.toFixed(2);
    drawBoxes();
  });
  $('score-reset').addEventListener('click', () => {
    $('score').value = OPERATING_POINT;
    $('score').dispatchEvent(new Event('input'));
  });
  $('reset-view').addEventListener('click', home);
  const withPred = trees.filter((t) => t.predictions);
  for (const button of document.querySelectorAll('[data-show]')) {
    const predictions = button.dataset.show === 'predictions';
    if (predictions && !withPred.length) { button.hidden = true; continue; }
    button.addEventListener('click', async () => {
      if (predictions && !Array.isArray(state.tree.meta.pred)) await showTree(withPred[0].id);
      const box = $(predictions ? 'show-pred' : 'show-cuboids');
      if (!box.checked) { box.checked = true; box.dispatchEvent(new Event('change')); }
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  await showTree((withPred[0] || trees[0]).id);
}

init().catch((err) => { $('loading').textContent = `Could not load the data: ${err}`; });
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
