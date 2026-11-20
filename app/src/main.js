// Vice Grid editor: wires the page to the cover painter.
//
// The maker loads photos (files from their machine, or the two samples),
// arranges them across the panels of a layout, grades the colours, letters a
// caption and exports a PNG at a post size. All state lives in one object;
// every control edits it and asks for a repaint, and the canvas is always
// painted at full export resolution so the preview is the export. A `?shot=`
// address sets up a fixed scene instead, for screenshots: ?shot=editor shows
// the workshop with the samples loaded, ?shot=cover shows one finished cover
// edge to edge.

import { LAYOUTS, GRADES, layoutById, gradeById, panelCount } from "./layouts.js";
import { paintCover, layoutRects } from "./render.js";

const SIZES = {
  "1080x1080": [1080, 1080],
  "1080x1350": [1080, 1350],
  "1920x1080": [1920, 1080],
};

const board = document.getElementById("stage");
const bctx = board.getContext("2d");
const statusLine = document.getElementById("status");

const app = {
  size: "1920x1080",
  layoutId: "cover-story",
  mode: "multi",
  library: [], // { img, url, name }
  slots: [], // per panel: { photo, dx, dy, zoom }
  hero: { photo: 0, dx: 0, dy: 0, zoom: 1 },
  active: 0,
  gradeId: "sunset",
  gradeMix: 0.85,
  border: "#ffffff",
  title: "Vice City Nights",
  subtitle: "One last ride along the boulevard",
  titleScale: 1,
  captionPos: "bottom",
  captionStyle: "white",
};

/** Loads an image from a URL, resolving once it can be drawn. */
function fetchImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Keeps the slots array matched to the layout, filling fresh panels with the next unused photo. */
function fitSlots() {
  const count = panelCount(app.layoutId);
  while (app.slots.length < count) {
    const used = new Set(app.slots.map((s) => s.photo));
    let photo = -1;
    for (let i = 0; i < app.library.length; i++) if (!used.has(i)) { photo = i; break; }
    app.slots.push({ photo, dx: 0, dy: 0, zoom: 1 });
  }
  app.slots.length = count;
  if (app.active >= count) app.active = 0;
}

/** The placement the zoom slider and drag gestures edit: the spread photo, or the active panel's slot. */
function activePlacement() {
  if (app.mode === "spread") return app.hero;
  fitSlots();
  return app.slots[app.active];
}

/** Paints the cover at the export size; `showSelection` draws the editor's dashed panel outline. */
function paint(showSelection = true) {
  fitSlots();
  const [W, H] = SIZES[app.size];
  if (board.width !== W || board.height !== H) {
    board.width = W;
    board.height = H;
  }
  const imgOf = (i) => (app.library[i] ? app.library[i].img : null);
  paintCover(bctx, W, H, {
    layout: layoutById(app.layoutId),
    mode: app.mode,
    spread: { img: imgOf(app.hero.photo), dx: app.hero.dx, dy: app.hero.dy, zoom: app.hero.zoom },
    cells: app.slots.map((s) => ({ img: imgOf(s.photo), dx: s.dx, dy: s.dy, zoom: s.zoom })),
    grade: gradeById(app.gradeId),
    strength: app.gradeMix,
    borderColor: app.border,
    title: app.title,
    subtitle: app.subtitle,
    titleSize: app.titleScale,
    titlePos: app.captionPos,
    titleScheme: app.captionStyle,
    selected: app.active,
    showSelection,
  });
  markShelfActive();
}

/* ---------- photos ---------- */

const shelf = document.getElementById("tray");

function markShelfActive() {
  const activePhoto = app.mode === "spread" ? app.hero.photo : (app.slots[app.active]?.photo ?? -1);
  shelf.querySelectorAll("figure").forEach((fig, i) => fig.classList.toggle("active", i === activePhoto));
}

function renderShelf() {
  shelf.replaceChildren();
  app.library.forEach((photo, i) => {
    const fig = document.createElement("figure");
    const img = document.createElement("img");
    img.src = photo.url;
    img.alt = photo.name;
    const cap = document.createElement("figcaption");
    cap.textContent = photo.name;
    fig.append(img, cap);
    fig.title = "Put this photo in the selected panel";
    fig.addEventListener("click", () => {
      if (app.mode === "spread") app.hero.photo = i;
      else { fitSlots(); app.slots[app.active].photo = i; }
      paint();
    });
    shelf.append(fig);
  });
  markShelfActive();
}

async function ingestPhoto(url, name) {
  const img = await fetchImage(url);
  app.library.push({ img, url, name });
  if (app.mode === "spread" && app.hero.photo < 0) app.hero.photo = 0;
  fitSlots();
  renderShelf();
  paint();
}

async function ingestFiles(files) {
  const images = [...files].filter((f) => f.type.startsWith("image/"));
  for (const file of images) await ingestPhoto(URL.createObjectURL(file), file.name);
  if (images.length) statusLine.textContent = `Added ${images.length} photo${images.length > 1 ? "s" : ""}.`;
}

async function ingestSamples() {
  for (const name of ["boulevard", "pier"]) {
    if (app.library.some((p) => p.name === `${name}.jpg`)) continue;
    const blob = await (await fetch(`./samples/${name}.jpg`)).blob();
    await ingestPhoto(URL.createObjectURL(blob), `${name}.jpg`);
  }
  statusLine.textContent = "Sample photos loaded: a boulevard at dusk and a pier at sunset.";
}

document.getElementById("fileinput").addEventListener("change", (e) => {
  ingestFiles(e.target.files);
  e.target.value = "";
});
document.getElementById("sample-both").addEventListener("click", ingestSamples);

const dropArea = document.getElementById("dropzone");
dropArea.addEventListener("dragover", (e) => { e.preventDefault(); dropArea.classList.add("dragging"); });
dropArea.addEventListener("dragleave", () => dropArea.classList.remove("dragging"));
dropArea.addEventListener("drop", (e) => {
  e.preventDefault();
  dropArea.classList.remove("dragging");
  ingestFiles(e.dataTransfer.files);
});
dropArea.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") document.getElementById("fileinput").click();
});

/* ---------- layout, mode, grade ---------- */

function chipButton(label, isOn, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "seg" + (isOn ? " on" : "");
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

const layoutRow = document.getElementById("layouts");
function renderLayoutChips() {
  layoutRow.replaceChildren(...LAYOUTS.map((layout) =>
    chipButton(layout.name, layout.id === app.layoutId, () => {
      app.layoutId = layout.id;
      fitSlots();
      renderLayoutChips();
      syncZoomSlider();
      paint();
    })));
}
renderLayoutChips();

const gradeRow = document.getElementById("grades");
function renderGradeChips() {
  gradeRow.replaceChildren(...GRADES.map((grade) =>
    chipButton(grade.name, grade.id === app.gradeId, () => {
      app.gradeId = grade.id;
      renderGradeChips();
      paint();
    })));
}
renderGradeChips();

function pickMode(mode) {
  app.mode = mode;
  document.getElementById("mode-spread").classList.toggle("on", mode === "spread");
  document.getElementById("mode-multi").classList.toggle("on", mode === "multi");
  syncZoomSlider();
  paint();
}
document.getElementById("mode-spread").addEventListener("click", () => pickMode("spread"));
document.getElementById("mode-multi").addEventListener("click", () => pickMode("multi"));
document.getElementById("mode-multi").classList.add("on");

const zoomCtl = document.getElementById("zoom");
function syncZoomSlider() { zoomCtl.value = String(activePlacement().zoom); }
zoomCtl.addEventListener("input", () => {
  activePlacement().zoom = Number(zoomCtl.value);
  paint();
});
document.getElementById("center-photo").addEventListener("click", () => {
  const t = activePlacement();
  t.dx = 0; t.dy = 0; t.zoom = 1;
  syncZoomSlider();
  paint();
});
document.getElementById("clear-panel").addEventListener("click", () => {
  if (app.mode !== "multi") return;
  fitSlots();
  app.slots[app.active].photo = -1;
  paint();
});

document.getElementById("strength").addEventListener("input", (e) => {
  app.gradeMix = Number(e.target.value);
  paint();
});
document.getElementById("border").addEventListener("change", (e) => {
  app.border = e.target.value;
  paint();
});

/* ---------- caption ---------- */

document.getElementById("title").addEventListener("input", (e) => { app.title = e.target.value; paint(); });
document.getElementById("subtitle").addEventListener("input", (e) => { app.subtitle = e.target.value; paint(); });
document.getElementById("titlesize").addEventListener("input", (e) => { app.titleScale = Number(e.target.value); paint(); });
document.getElementById("titlecolors").addEventListener("change", (e) => { app.captionStyle = e.target.value; paint(); });

function pickCaptionPos(pos) {
  app.captionPos = pos;
  document.getElementById("pos-bottom").classList.toggle("on", pos === "bottom");
  document.getElementById("pos-top").classList.toggle("on", pos === "top");
  paint();
}
document.getElementById("pos-bottom").addEventListener("click", () => pickCaptionPos("bottom"));
document.getElementById("pos-top").addEventListener("click", () => pickCaptionPos("top"));
document.getElementById("pos-bottom").classList.add("on");

/* ---------- board gestures: select, drag to pan, wheel to zoom ---------- */

function boardPoint(e) {
  const r = board.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (board.width / r.width),
    y: (e.clientY - r.top) * (board.height / r.height),
  };
}

function panelHit(x, y) {
  const rects = layoutRects(layoutById(app.layoutId), board.width, board.height);
  return rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

let dragStart = null;
board.addEventListener("pointerdown", (e) => {
  const p = boardPoint(e);
  const hit = panelHit(p.x, p.y);
  if (app.mode === "multi" && hit >= 0) {
    app.active = hit;
    syncZoomSlider();
  }
  dragStart = { x: p.x, y: p.y };
  board.setPointerCapture(e.pointerId);
  paint();
});
board.addEventListener("pointermove", (e) => {
  if (!dragStart) return;
  const p = boardPoint(e);
  const t = activePlacement();
  const unit = app.mode === "spread"
    ? { w: board.width, h: board.height }
    : layoutRects(layoutById(app.layoutId), board.width, board.height)[app.active];
  t.dx += (p.x - dragStart.x) / unit.w;
  t.dy += (p.y - dragStart.y) / unit.h;
  dragStart = p;
  paint();
});
board.addEventListener("pointerup", () => { dragStart = null; });
board.addEventListener("wheel", (e) => {
  e.preventDefault();
  const p = boardPoint(e);
  if (app.mode === "multi") {
    const hit = panelHit(p.x, p.y);
    if (hit >= 0 && hit !== app.active) { app.active = hit; }
  }
  const t = activePlacement();
  t.zoom = Math.min(3, Math.max(1, t.zoom * Math.exp(-e.deltaY * 0.0012)));
  syncZoomSlider();
  paint();
}, { passive: false });

/* ---------- export ---------- */

function pickSize(size) {
  app.size = size;
  document.querySelectorAll(".size-seg").forEach((b) => b.classList.toggle("on", b.dataset.size === size));
  paint();
}
document.querySelectorAll(".size-seg").forEach((b) =>
  b.addEventListener("click", () => pickSize(b.dataset.size)));
document.querySelector('.size-seg[data-size="1920x1080"]').classList.add("on");

document.getElementById("export").addEventListener("click", () => {
  paint(false);
  board.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vice-grid-${app.size}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    statusLine.textContent = `Saved vice-grid-${app.size}.png`;
    paint(true);
  }, "image/png");
});

/* ---------- the display font, then the first paint ---------- */

async function loadCoverFont() {
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
  if (query.get("size")) pickSize(query.get("size"));
  if (query.get("layout")) { app.layoutId = query.get("layout"); renderLayoutChips(); }
  if (query.get("grade")) { app.gradeId = query.get("grade"); renderGradeChips(); }
  if (query.get("title")) {
    app.title = query.get("title");
    document.getElementById("title").value = app.title;
  }
  if (query.get("subtitle")) {
    app.subtitle = query.get("subtitle");
    document.getElementById("subtitle").value = app.subtitle;
  }
  if (query.get("scheme")) app.captionStyle = query.get("scheme");
  if (query.get("pos")) pickCaptionPos(query.get("pos"));
  await ingestSamples();
  if (query.get("mode") === "spread") {
    pickMode("spread");
    app.hero.photo = 0;
    app.hero.zoom = 1.12;
  } else {
    pickMode("multi");
    // Dress the panels: hero takes the boulevard, the rest alternate pier and boulevard.
    app.slots.forEach((slot, i) => { slot.photo = i === 0 ? 0 : i % 2; });
  }
  if (kind === "cover") document.body.classList.add("shotmode");
  paint(kind !== "cover");
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

const query = new URLSearchParams(location.search);
(async () => {
  await loadCoverFont();
  if (query.get("shot")) await runShotScene(query);
  else paint();
})();
