// Vice Panels editor: wires the page to the cover renderer.
//
// The maker loads photos (files from their machine, or the two samples), arranges them across the panels of
// a layout, grades the colours, letters a caption and exports a PNG at a post size. All state lives in one
// object; every control edits it and asks for a redraw, and the canvas is always painted at full export
// resolution so the preview is the export. A `?shot=` address sets up a fixed scene instead, for screenshots:
// ?shot=editor shows the workshop with the samples loaded, ?shot=cover shows one finished cover edge to edge.

import { LAYOUTS, GRADES, layoutById, gradeById } from "./layouts.js";
import { drawCoverArt, panelRects } from "./render.js";

const SIZES = {
  "1080x1080": [1080, 1080],
  "1080x1350": [1080, 1350],
  "1920x1080": [1920, 1080],
};

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const status = document.getElementById("status");

const state = {
  size: "1920x1080",
  layoutId: "cover-story",
  mode: "multi",
  photos: [], // { img, url, name }
  cells: [], // per panel: { photo, dx, dy, zoom }
  spread: { photo: 0, dx: 0, dy: 0, zoom: 1 },
  selected: 0,
  gradeId: "sunset",
  strength: 0.85,
  borderColor: "#ffffff",
  title: "Vice City Nights",
  subtitle: "One last ride along the boulevard",
  titleSize: 1,
  titlePos: "bottom",
  titleScheme: "white",
};

/** Loads an image from a URL, resolving once it can be drawn. */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Keeps the cells array matched to the layout, filling fresh panels with the next unused photo. */
function ensureCells() {
  const count = layoutById(state.layoutId).panels.length;
  while (state.cells.length < count) {
    const used = new Set(state.cells.map((c) => c.photo));
    let photo = -1;
    for (let i = 0; i < state.photos.length; i++) if (!used.has(i)) { photo = i; break; }
    state.cells.push({ photo, dx: 0, dy: 0, zoom: 1 });
  }
  state.cells.length = count;
  if (state.selected >= count) state.selected = 0;
}

/** The placement the zoom slider and drag gestures edit: the spread photo, or the selected panel's cell. */
function currentTarget() {
  if (state.mode === "spread") return state.spread;
  ensureCells();
  return state.cells[state.selected];
}

/** Paints the cover at the export size; `showSelection` draws the editor's dashed panel outline. */
function redraw(showSelection = true) {
  ensureCells();
  const [W, H] = SIZES[state.size];
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  const imgOf = (i) => (state.photos[i] ? state.photos[i].img : null);
  drawCoverArt(ctx, W, H, {
    layout: layoutById(state.layoutId),
    mode: state.mode,
    spread: { img: imgOf(state.spread.photo), dx: state.spread.dx, dy: state.spread.dy, zoom: state.spread.zoom },
    cells: state.cells.map((c) => ({ img: imgOf(c.photo), dx: c.dx, dy: c.dy, zoom: c.zoom })),
    grade: gradeById(state.gradeId),
    strength: state.strength,
    borderColor: state.borderColor,
    title: state.title,
    subtitle: state.subtitle,
    titleSize: state.titleSize,
    titlePos: state.titlePos,
    titleScheme: state.titleScheme,
    selected: state.selected,
    showSelection,
  });
  syncTrayActive();
}

/* ---------- photos ---------- */

const tray = document.getElementById("tray");

function syncTrayActive() {
  const activePhoto = state.mode === "spread" ? state.spread.photo : (state.cells[state.selected]?.photo ?? -1);
  tray.querySelectorAll("figure").forEach((fig, i) => fig.classList.toggle("active", i === activePhoto));
}

function renderTray() {
  tray.replaceChildren();
  state.photos.forEach((photo, i) => {
    const fig = document.createElement("figure");
    const img = document.createElement("img");
    img.src = photo.url;
    img.alt = photo.name;
    const cap = document.createElement("figcaption");
    cap.textContent = photo.name;
    fig.append(img, cap);
    fig.title = "Put this photo in the selected panel";
    fig.addEventListener("click", () => {
      if (state.mode === "spread") state.spread.photo = i;
      else { ensureCells(); state.cells[state.selected].photo = i; }
      redraw();
    });
    tray.append(fig);
  });
  syncTrayActive();
}

async function addPhoto(url, name) {
  const img = await loadImage(url);
  state.photos.push({ img, url, name });
  if (state.mode === "spread" && state.spread.photo < 0) state.spread.photo = 0;
  ensureCells();
  renderTray();
  redraw();
}

async function addFiles(files) {
  const images = [...files].filter((f) => f.type.startsWith("image/"));
  for (const file of images) await addPhoto(URL.createObjectURL(file), file.name);
  if (images.length) status.textContent = `Added ${images.length} photo${images.length > 1 ? "s" : ""}.`;
}

async function addSamples() {
  for (const name of ["boulevard", "pier"]) {
    if (state.photos.some((p) => p.name === `${name}.jpg`)) continue;
    const blob = await (await fetch(`./samples/${name}.jpg`)).blob();
    await addPhoto(URL.createObjectURL(blob), `${name}.jpg`);
  }
  status.textContent = "Sample photos loaded: a boulevard at dusk and a pier at sunset.";
}

document.getElementById("fileinput").addEventListener("change", (e) => {
  addFiles(e.target.files);
  e.target.value = "";
});
document.getElementById("sample-both").addEventListener("click", addSamples);

const dropzone = document.getElementById("dropzone");
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragging"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragging"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragging");
  addFiles(e.dataTransfer.files);
});
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") document.getElementById("fileinput").click();
});

/* ---------- layout, mode, grade ---------- */

function segButton(label, isOn, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "seg" + (isOn ? " on" : "");
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

const layoutsBox = document.getElementById("layouts");
function renderLayoutButtons() {
  layoutsBox.replaceChildren(...LAYOUTS.map((layout) =>
    segButton(layout.name, layout.id === state.layoutId, () => {
      state.layoutId = layout.id;
      ensureCells();
      renderLayoutButtons();
      syncZoom();
      redraw();
    })));
}
renderLayoutButtons();

const gradesBox = document.getElementById("grades");
function renderGradeButtons() {
  gradesBox.replaceChildren(...GRADES.map((grade) =>
    segButton(grade.name, grade.id === state.gradeId, () => {
      state.gradeId = grade.id;
      renderGradeButtons();
      redraw();
    })));
}
renderGradeButtons();

function setMode(mode) {
  state.mode = mode;
  document.getElementById("mode-spread").classList.toggle("on", mode === "spread");
  document.getElementById("mode-multi").classList.toggle("on", mode === "multi");
  syncZoom();
  redraw();
}
document.getElementById("mode-spread").addEventListener("click", () => setMode("spread"));
document.getElementById("mode-multi").addEventListener("click", () => setMode("multi"));
document.getElementById("mode-multi").classList.add("on");

const zoomSlider = document.getElementById("zoom");
function syncZoom() { zoomSlider.value = String(currentTarget().zoom); }
zoomSlider.addEventListener("input", () => {
  currentTarget().zoom = Number(zoomSlider.value);
  redraw();
});
document.getElementById("center-photo").addEventListener("click", () => {
  const t = currentTarget();
  t.dx = 0; t.dy = 0; t.zoom = 1;
  syncZoom();
  redraw();
});
document.getElementById("clear-panel").addEventListener("click", () => {
  if (state.mode !== "multi") return;
  ensureCells();
  state.cells[state.selected].photo = -1;
  redraw();
});

document.getElementById("strength").addEventListener("input", (e) => {
  state.strength = Number(e.target.value);
  redraw();
});
document.getElementById("border").addEventListener("change", (e) => {
  state.borderColor = e.target.value;
  redraw();
});

/* ---------- caption ---------- */

document.getElementById("title").addEventListener("input", (e) => { state.title = e.target.value; redraw(); });
document.getElementById("subtitle").addEventListener("input", (e) => { state.subtitle = e.target.value; redraw(); });
document.getElementById("titlesize").addEventListener("input", (e) => { state.titleSize = Number(e.target.value); redraw(); });
document.getElementById("titlecolors").addEventListener("change", (e) => { state.titleScheme = e.target.value; redraw(); });

function setTitlePos(pos) {
  state.titlePos = pos;
  document.getElementById("pos-bottom").classList.toggle("on", pos === "bottom");
  document.getElementById("pos-top").classList.toggle("on", pos === "top");
  redraw();
}
document.getElementById("pos-bottom").addEventListener("click", () => setTitlePos("bottom"));
document.getElementById("pos-top").addEventListener("click", () => setTitlePos("top"));
document.getElementById("pos-bottom").classList.add("on");

/* ---------- canvas gestures: select, drag to pan, wheel to zoom ---------- */

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}

function panelAt(x, y) {
  const rects = panelRects(layoutById(state.layoutId), canvas.width, canvas.height);
  return rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

let drag = null;
canvas.addEventListener("pointerdown", (e) => {
  const p = canvasPoint(e);
  const hit = panelAt(p.x, p.y);
  if (state.mode === "multi" && hit >= 0) {
    state.selected = hit;
    syncZoom();
  }
  drag = { x: p.x, y: p.y };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const t = currentTarget();
  const unit = state.mode === "spread"
    ? { w: canvas.width, h: canvas.height }
    : panelRects(layoutById(state.layoutId), canvas.width, canvas.height)[state.selected];
  t.dx += (p.x - drag.x) / unit.w;
  t.dy += (p.y - drag.y) / unit.h;
  drag = p;
  redraw();
});
canvas.addEventListener("pointerup", () => { drag = null; });
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const p = canvasPoint(e);
  if (state.mode === "multi") {
    const hit = panelAt(p.x, p.y);
    if (hit >= 0 && hit !== state.selected) { state.selected = hit; }
  }
  const t = currentTarget();
  t.zoom = Math.min(3, Math.max(1, t.zoom * Math.exp(-e.deltaY * 0.0012)));
  syncZoom();
  redraw();
}, { passive: false });

/* ---------- export ---------- */

function setSize(size) {
  state.size = size;
  document.querySelectorAll(".size-seg").forEach((b) => b.classList.toggle("on", b.dataset.size === size));
  redraw();
}
document.querySelectorAll(".size-seg").forEach((b) =>
  b.addEventListener("click", () => setSize(b.dataset.size)));
document.querySelector('.size-seg[data-size="1920x1080"]').classList.add("on");

document.getElementById("export").addEventListener("click", () => {
  redraw(false);
  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vice-panels-${state.size}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status.textContent = `Saved vice-panels-${state.size}.png`;
    redraw(true);
  }, "image/png");
});

/* ---------- the display font, then the first paint ---------- */

async function loadDisplayFont() {
  try {
    const face = new FontFace("CoverDisplay", "url(./fonts/display.ttf)");
    await face.load();
    document.fonts.add(face);
  } catch {
    // The canvas falls back to a heavy system sans; the app still works.
  }
}

/* ---------- screenshot scenes (?shot=) ---------- */

async function runShotScene(query) {
  const kind = query.get("shot");
  if (query.get("size")) setSize(query.get("size"));
  if (query.get("layout")) { state.layoutId = query.get("layout"); renderLayoutButtons(); }
  if (query.get("grade")) { state.gradeId = query.get("grade"); renderGradeButtons(); }
  if (query.get("title")) {
    state.title = query.get("title");
    document.getElementById("title").value = state.title;
  }
  if (query.get("subtitle")) {
    state.subtitle = query.get("subtitle");
    document.getElementById("subtitle").value = state.subtitle;
  }
  if (query.get("scheme")) state.titleScheme = query.get("scheme");
  if (query.get("pos")) setTitlePos(query.get("pos"));
  await addSamples();
  if (query.get("mode") === "spread") {
    setMode("spread");
    state.spread.photo = 0;
    state.spread.zoom = 1.12;
  } else {
    setMode("multi");
    // Dress the panels: hero takes the boulevard, the rest alternate pier and boulevard.
    state.cells.forEach((cell, i) => { cell.photo = i === 0 ? 0 : i % 2; });
  }
  if (kind === "cover") document.body.classList.add("shotmode");
  redraw(kind !== "cover");
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

const query = new URLSearchParams(location.search);
(async () => {
  await loadDisplayFont();
  if (query.get("shot")) await runShotScene(query);
  else redraw();
})();
