// Vice Grid — editor wiring: state, controls, photo pan/zoom, export.
// Photos live only in this page's memory (uploads are read locally, never sent).

import { LAYOUTS, GRADES, CAPTIONS, EXPORT_SIZES, layoutById, sizeById } from './layouts.js';
import { drawCover } from './render.js';

const $ = (id) => document.getElementById(id);

const state = {
  layout: 'cover-story',
  grade: 'neon',
  strength: 70,
  mode: 'spread',
  caption: 'slant',
  placement: 'bottom',
  headline: 'Sunset Heist',
  subtitle: 'Leonida Nights',
  size: 'square',
  photos: [], // slots: { img, zoom, px, py }
  selected: 0,
};

const SAMPLES = [
  { name: 'Pier dusk', src: 'samples/pier.jpg' },
  { name: 'Boulevard', src: 'samples/boulevard.jpg' },
];

let preview = null;
let drag = null;

function blankSlot() {
  return { img: null, zoom: 1, px: 0, py: 0 };
}

function ensureSlots() {
  const n = layoutById(state.layout).panels.length;
  while (state.photos.length < n) state.photos.push(blankSlot());
  if (state.selected >= n) state.selected = 0;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function setSlotPhoto(i, src) {
  const img = await loadImage(src);
  state.photos[i] = { img, zoom: 1, px: 0, py: 0 };
  render();
}

async function applySample(name) {
  const sample = SAMPLES.find((s) => s.name === name) || SAMPLES[0];
  if (state.mode === 'spread') {
    await setSlotPhoto(0, sample.src);
  } else {
    await setSlotPhoto(state.selected, sample.src);
  }
}

function render() {
  ensureSlots();
  const size = sizeById(state.size);
  if (preview.width !== size.w || preview.height !== size.h) {
    preview.width = size.w;
    preview.height = size.h;
  }
  drawCover(preview, state);
  syncControls();
}

function syncControls() {
  for (const b of document.querySelectorAll('[data-layout]')) {
    b.classList.toggle('on', b.dataset.layout === state.layout);
  }
  for (const b of document.querySelectorAll('[data-grade]')) {
    b.classList.toggle('on', b.dataset.grade === state.grade);
  }
  for (const b of document.querySelectorAll('[data-caption]')) {
    b.classList.toggle('on', b.dataset.caption === state.caption);
  }
  for (const b of document.querySelectorAll('[data-size]')) {
    b.classList.toggle('on', b.dataset.size === state.size);
  }
  for (const b of document.querySelectorAll('[data-mode]')) {
    b.classList.toggle('on', b.dataset.mode === state.mode);
  }
  for (const b of document.querySelectorAll('[data-place]')) {
    b.classList.toggle('on', b.dataset.place === state.placement);
  }
  $('strength').value = String(state.strength);
  $('strength-val').textContent = state.strength + '%';
  $('headline').value = state.headline;
  $('subtitle').value = state.subtitle;
  $('panel-label').textContent =
    state.mode === 'spread'
      ? 'Spread photo — one image fills every panel'
      : `Panel ${state.selected + 1} of ${layoutById(state.layout).panels.length} selected`;
}

function panelAt(clientX, clientY) {
  const r = preview.getBoundingClientRect();
  const fx = (clientX - r.left) / r.width;
  const fy = (clientY - r.top) / r.height;
  const panels = layoutById(state.layout).panels;
  for (let i = 0; i < panels.length; i++) {
    const p = panels[i];
    if (fx >= p.x && fx < p.x + p.w && fy >= p.y && fy < p.y + p.h) return i;
  }
  return 0;
}

function exportPng() {
  const size = sizeById(state.size);
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off, state);
  off.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-grid-${state.layout}-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
}

function buildButtons() {
  const mk = (host, items, attr, fn) => {
    const el = $(host);
    el.innerHTML = '';
    for (const item of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick';
      b.dataset[attr] = item.id;
      b.textContent = item.name;
      b.title = item.blurb || item.hint || item.label || '';
      b.addEventListener('click', () => {
        fn(item.id);
        render();
      });
      el.appendChild(b);
    }
  };
  mk('layout-picks', LAYOUTS, 'layout', (v) => {
    state.layout = v;
    state.selected = 0;
  });
  mk('grade-picks', GRADES, 'grade', (v) => {
    state.grade = v;
  });
  mk('caption-picks', CAPTIONS, 'caption', (v) => {
    state.caption = v;
  });
  mk('size-picks', EXPORT_SIZES, 'size', (v) => {
    state.size = v;
  });
}

function wire() {
  preview = $('stage');
  buildButtons();

  $('mode-spread').addEventListener('click', () => {
    state.mode = 'spread';
    render();
  });
  $('mode-panels').addEventListener('click', () => {
    state.mode = 'panels';
    render();
  });
  $('place-top').addEventListener('click', () => {
    state.placement = 'top';
    render();
  });
  $('place-bottom').addEventListener('click', () => {
    state.placement = 'bottom';
    render();
  });
  $('strength').addEventListener('input', (e) => {
    state.strength = Number(e.target.value);
    render();
  });
  $('headline').addEventListener('input', (e) => {
    state.headline = e.target.value;
    render();
  });
  $('subtitle').addEventListener('input', (e) => {
    state.subtitle = e.target.value;
    render();
  });
  $('export-btn').addEventListener('click', exportPng);

  const file = $('upload');
  $('upload-btn').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    try {
      const img = await loadImage(url);
      const target = state.mode === 'spread' ? 0 : state.selected;
      state.photos[target] = { img, zoom: 1, px: 0, py: 0 };
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    file.value = '';
    render();
  });

  const sampleRow = $('sample-row');
  for (const s of SAMPLES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.textContent = s.name;
    b.addEventListener('click', () => applySample(s.name));
    sampleRow.appendChild(b);
  }

  preview.addEventListener('pointerdown', (e) => {
    const i = panelAt(e.clientX, e.clientY);
    state.selected = i;
    drag = { x: e.clientX, y: e.clientY, moved: false };
    preview.setPointerCapture(e.pointerId);
    syncControls();
  });
  preview.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const slot = state.photos[state.selected];
    if (!slot || !slot.img) return;
    const r = preview.getBoundingClientRect();
    const dx = (e.clientX - drag.x) / r.width;
    const dy = (e.clientY - drag.y) / r.height;
    if (Math.abs(dx) + Math.abs(dy) > 0.002) drag.moved = true;
    const target = state.mode === 'spread' ? state.photos[0] : slot;
    target.px = Math.max(-0.6, Math.min(0.6, target.px + dx));
    target.py = Math.max(-0.6, Math.min(0.6, target.py + dy));
    drag.x = e.clientX;
    drag.y = e.clientY;
    render();
  });
  preview.addEventListener('pointerup', () => {
    drag = null;
  });
  preview.addEventListener('wheel', (e) => {
    e.preventDefault();
    const slot = state.mode === 'spread' ? state.photos[0] : state.photos[state.selected];
    if (!slot || !slot.img) return;
    const f = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    slot.zoom = Math.max(1, Math.min(4, slot.zoom * f));
    render();
  }, { passive: false });
}

// Screenshot presets: ?shot=cover draws the cover alone; ?shot=editor shows
// the editor with a photo loaded. The kit's shots.json drives these.
async function applyPreset() {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return;
  if (q.get('layout')) state.layout = q.get('layout');
  if (q.get('grade')) state.grade = q.get('grade');
  if (q.get('scheme')) state.caption = q.get('scheme');
  if (q.get('caption')) state.headline = q.get('caption');
  if (q.get('headline')) state.headline = q.get('headline');
  if (q.get('subtitle')) state.subtitle = q.get('subtitle');
  if (q.get('mode')) state.mode = q.get('mode');
  const photo = q.get('photo') || 'pier';
  const sample = SAMPLES.find((s) => s.src.includes(photo)) || SAMPLES[0];
  if (state.mode === 'spread') {
    await setSlotPhoto(0, sample.src);
  } else {
    const n = layoutById(state.layout).panels.length;
    for (let i = 0; i < n; i++) {
      await setSlotPhoto(i, SAMPLES[i % SAMPLES.length].src);
    }
  }
  if (shot === 'cover') {
    document.body.classList.add('cover-only');
  }
  document.title = `Vice Grid — ${shot}`;
}

async function boot() {
  try {
    await document.fonts.load('48px Anton');
    await document.fonts.ready;
  } catch (err) {
    // The display font is a nice-to-have; the fallback stack still works.
  }
  wire();
  ensureSlots();
  await applyPreset();
  render();
}

boot();
