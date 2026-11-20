// The cover painter: draws the whole poster onto a 2D canvas.
//
// The poster is assembled in passes. The border colour fills the canvas,
// then every panel is clipped and filled with its photo (cover-fit, with the
// maker's pan and zoom), the colour grade is washed over the photo, and the
// panel edge gets a soft inner shadow. A vignette and a whisper of film grain
// finish the print, and the caption is lettered over a shade band so it stays
// readable on any photo. One function paints both the live preview and the
// exported PNG from the same state object, so what the maker sees is exactly
// what they share.
//
// A panel rectangle is { x, y, w, h } in canvas pixels. A cell is
// { img, dx, dy, zoom }: the photo to draw, its pan as fractions of the panel,
// and its zoom. The spread photo is a cell drawn in full-canvas coordinates
// inside each panel's clip, so its slices line up across the borders.

let grainPatternTile = null;

/** One small tile of grey noise, built once and reused as the print-grain pattern. */
function grainTile() {
  if (grainPatternTile) return grainPatternTile;
  const tile = document.createElement("canvas");
  tile.width = 128;
  tile.height = 128;
  const t = tile.getContext("2d");
  const pixels = t.createImageData(128, 128);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const v = 100 + Math.floor(Math.random() * 56);
    pixels.data[i] = v;
    pixels.data[i + 1] = v;
    pixels.data[i + 2] = v;
    pixels.data[i + 3] = 255;
  }
  t.putImageData(pixels, 0, 0);
  grainPatternTile = tile;
  return tile;
}

function clamp01(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

/**
 * Fits `img` over `rect` (cover), scaled by `zoom` and panned by (`dx`, `dy`)
 * in fractions of the rect, clamped so the photo never leaves an empty edge.
 */
function placePhoto(ctx, rect, img, dx, dy, zoom) {
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const slackX = Math.max(0, (dw - rect.w) / 2);
  const slackY = Math.max(0, (dh - rect.h) / 2);
  const ox = rect.x + (rect.w - dw) / 2 + clamp01(dx * rect.w, -slackX, slackX);
  const oy = rect.y + (rect.h - dh) / 2 + clamp01(dy * rect.h, -slackY, slackY);
  ctx.drawImage(img, ox, oy, dw, dh);
}

/** A drawn stand-in for a panel with no photo yet: dusk sky, low sun, palms, sea. */
function drawEmptyPanel(ctx, rect, seed) {
  const sky = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  sky.addColorStop(0, "#2c1552");
  sky.addColorStop(0.5, "#a82a5c");
  sky.addColorStop(1, "#ff9046");
  ctx.fillStyle = sky;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const sunR = Math.min(rect.w, rect.h) * 0.15;
  const sunX = rect.x + rect.w * (0.68 - 0.12 * (seed % 3));
  const sunY = rect.y + rect.h * 0.58;
  ctx.fillStyle = "rgba(255, 218, 96, 0.92)";
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  // Sea band, then a dark strip of sand with two palms.
  ctx.fillStyle = "#1d2f5e";
  ctx.fillRect(rect.x, rect.y + rect.h * 0.72, rect.w, rect.h * 0.1);
  ctx.fillStyle = "#150a22";
  ctx.fillRect(rect.x, rect.y + rect.h * 0.82, rect.w, rect.h * 0.18);
  drawPalmTree(ctx, rect.x + rect.w * 0.2, rect.y + rect.h * 0.84, rect.h * 0.3);
  drawPalmTree(ctx, rect.x + rect.w * 0.78, rect.y + rect.h * 0.86, rect.h * 0.22);
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.font = `600 ${Math.max(11, Math.min(rect.w, rect.h) * 0.05)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("ADD A PHOTO", rect.x + rect.w / 2, rect.y + rect.h * 0.96);
}

/** A palm silhouette: one curved trunk and seven fronds. */
function drawPalmTree(ctx, baseX, baseY, height) {
  ctx.strokeStyle = "#150a22";
  ctx.fillStyle = "#150a22";
  ctx.lineWidth = Math.max(2, height * 0.05);
  ctx.lineCap = "round";
  const crownX = baseX - height * 0.14;
  const crownY = baseY - height;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(baseX - height * 0.04, baseY - height * 0.55, crownX, crownY);
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const angle = Math.PI * (0.05 + (i / 6) * 0.9);
    const len = height * 0.46;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(
      crownX - Math.cos(angle) * len * 0.55,
      crownY - Math.sin(angle) * len * 0.55 - height * 0.06,
      crownX - Math.cos(angle) * len,
      crownY - Math.sin(angle) * len * 0.3 + height * 0.12,
    );
    ctx.stroke();
  }
}

/** Paints one grade wash (a vertical tint gradient) over a rect at `strength`. */
function washPanel(ctx, rect, wash, strength) {
  const [blend, opacity, stops] = wash;
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  for (const [at, colour] of stops) grad.addColorStop(at, colour);
  ctx.save();
  ctx.globalCompositeOperation = blend;
  ctx.globalAlpha = strength * opacity;
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Tints neighbouring panels warm and cool in turn, like pasted poster panels catching different light. */
function collageTint(ctx, rect, index) {
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = index % 2 === 0 ? "rgba(255, 148, 64, 0.5)" : "rgba(64, 168, 255, 0.5)";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** A soft dark keyline just inside a panel's edge. */
function innerKeyline(ctx, rect) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.strokeStyle = "rgba(10, 4, 18, 0.38)";
  ctx.lineWidth = Math.max(6, rect.w * 0.028);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Paints one panel in per-photo mode: photo or stand-in, grade, tint, keyline. */
function paintCell(ctx, rect, cell, grade, strength, index) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (cell && cell.img) {
    ctx.filter = grade.css;
    placePhoto(ctx, rect, cell.img, cell.dx, cell.dy, cell.zoom);
    ctx.filter = "none";
  } else {
    drawEmptyPanel(ctx, rect, index);
  }
  for (const wash of grade.washes) washPanel(ctx, rect, wash, strength);
  collageTint(ctx, rect, index);
  ctx.restore();
  innerKeyline(ctx, rect);
}

/** Paints one panel in spread mode: the shared photo in full-canvas coordinates, clipped to the panel. */
function paintSpreadPanel(ctx, rect, spread, grade, strength, index) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (spread.img) {
    ctx.filter = grade.css;
    placePhoto(ctx, { x: 0, y: 0, w: ctx.canvas.width, h: ctx.canvas.height }, spread.img, spread.dx, spread.dy, spread.zoom);
    ctx.filter = "none";
  } else {
    drawEmptyPanel(ctx, { x: 0, y: 0, w: ctx.canvas.width, h: ctx.canvas.height }, 1);
  }
  for (const wash of grade.washes) washPanel(ctx, rect, wash, strength);
  collageTint(ctx, rect, index);
  ctx.restore();
  innerKeyline(ctx, rect);
}

/** Letters the caption: a big display title with a painted edge, and the subtitle on a slanted banner. */
function drawCaption(ctx, W, H, state) {
  const title = state.title.trim().toUpperCase();
  const subtitle = state.subtitle.trim().toUpperCase();
  if (!title && !subtitle) return;
  const unit = Math.min(W, H);
  const pad = unit * 0.05;
  const atBottom = state.titlePos === "bottom";

  // A shade band behind the lettering keeps it readable over bright panels:
  // darkest at the poster's edge, fading to nothing a third of the way in, so
  // it never cuts a visible line across a panel.
  const bandH = unit * 0.36;
  const shade = atBottom
    ? ctx.createLinearGradient(0, H - bandH, 0, H)
    : ctx.createLinearGradient(0, 0, 0, bandH);
  shade.addColorStop(0, atBottom ? "rgba(8, 3, 16, 0)" : "rgba(8, 3, 16, 0.55)");
  shade.addColorStop(1, atBottom ? "rgba(8, 3, 16, 0.55)" : "rgba(8, 3, 16, 0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, atBottom ? H - bandH : 0, W, bandH);

  const schemes = {
    white: { fill: () => "#ffffff", edge: "#16101d", banner: "#ff2e88", bannerText: "#ffffff" },
    sunset: {
      fill: () => {
        const g = ctx.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, "#ffd319");
        g.addColorStop(0.55, "#ff7a18");
        g.addColorStop(1, "#ff2975");
        return g;
      },
      edge: "#2a0a2e",
      banner: "#19e3c2",
      bannerText: "#0b2030",
    },
    neon: { fill: () => "#ff2e88", edge: "#0d1030", banner: "#ffd319", bannerText: "#231a04" },
    gold: {
      fill: () => {
        const g = ctx.createLinearGradient(0, 0, 0, unit * 0.22);
        g.addColorStop(0, "#ffe259");
        g.addColorStop(1, "#ffa751");
        return g;
      },
      edge: "#241203",
      banner: "#16101d",
      bannerText: "#ffd319",
    },
  };
  const scheme = schemes[state.titleScheme] ?? schemes.white;

  let titleSize = 0;
  let titleBaseline = 0;
  if (title) {
    titleSize = unit * 0.13 * state.titleSize;
    ctx.textAlign = "center";
    const setFont = (s) => { ctx.font = `${s}px CoverDisplay, "Arial Black", sans-serif`; };
    setFont(titleSize);
    while (ctx.measureText(title).width > W * 0.92 && titleSize > 14) {
      titleSize *= 0.96;
      setFont(titleSize);
    }
    // A headline that still does not fit at the smallest size gets shortened
    // with an ellipsis instead of spilling past the poster's edge.
    let shownTitle = title;
    while (ctx.measureText(shownTitle).width > W * 0.92 && shownTitle.length > 4) {
      shownTitle = shownTitle.slice(0, -2) + "…";
    }
    titleBaseline = atBottom ? H - pad - titleSize * 0.14 : pad + titleSize * 0.94;
    if (subtitle) titleBaseline += atBottom ? -unit * 0.06 : unit * 0.06;
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = titleSize * 0.09;
    ctx.shadowOffsetY = titleSize * 0.05;
    ctx.strokeStyle = scheme.edge;
    ctx.lineWidth = titleSize * 0.16;
    ctx.strokeText(shownTitle, W / 2, titleBaseline);
    ctx.fillStyle = scheme.fill();
    ctx.fillText(shownTitle, W / 2, titleBaseline);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  if (subtitle) {
    const subSize = unit * 0.032 * (0.8 + state.titleSize * 0.2);
    ctx.font = `600 ${subSize}px "Segoe UI", system-ui, sans-serif`;
    try { ctx.letterSpacing = `${subSize * 0.24}px`; } catch { /* older canvas: spacing is a garnish */ }
    const textW = ctx.measureText(subtitle).width + subSize * 0.24 * subtitle.length;
    const bannerW = Math.min(W * 0.94, textW + subSize * 1.8);
    const bannerH = subSize * 2.0;
    const cx = W / 2;
    const cy = atBottom ? H - pad - bannerH * 0.4 : pad + (title ? titleSize * 1.2 : 0) + bannerH * 0.62;
    const slant = bannerH * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx - bannerW / 2 + slant, cy - bannerH / 2);
    ctx.lineTo(cx + bannerW / 2 + slant, cy - bannerH / 2);
    ctx.lineTo(cx + bannerW / 2 - slant, cy + bannerH / 2);
    ctx.lineTo(cx - bannerW / 2 - slant, cy + bannerH / 2);
    ctx.closePath();
    ctx.fillStyle = scheme.banner;
    ctx.fill();
    ctx.fillStyle = scheme.bannerText;
    ctx.textAlign = "center";
    ctx.fillText(subtitle, cx, cy + subSize * 0.38);
    try { ctx.letterSpacing = "0px"; } catch { /* reset */ }
  }
}

/**
 * Paints the full cover described by `state` onto `ctx` at (`W`, `H`).
 * state: { layout, mode, spread, cells, grade, strength, borderColor, title, subtitle, titleSize,
 *          titlePos, titleScheme, selected, showSelection }
 */
export function paintCover(ctx, W, H, state) {
  const gap = Math.max(5, Math.round(Math.min(W, H) * 0.01));
  ctx.fillStyle = state.borderColor;
  ctx.fillRect(0, 0, W, H);

  const rects = state.layout.panels.map(([x, y, w, h]) => ({
    x: x * W + gap / 2,
    y: y * H + gap / 2,
    w: w * W - gap,
    h: h * H - gap,
  }));

  rects.forEach((rect, i) => {
    if (state.mode === "spread") paintSpreadPanel(ctx, rect, state.spread, state.grade, state.strength, i);
    else paintCell(ctx, rect, state.cells[i], state.grade, state.strength, i);
  });

  // Vignette and print grain over the panels, under the lettering.
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.8);
  vig.addColorStop(0, "rgba(8, 2, 16, 0)");
  vig.addColorStop(1, "rgba(8, 2, 16, 0.32)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = ctx.createPattern(grainTile(), "repeat");
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  drawCaption(ctx, W, H, state);

  // A fine keyline around the whole poster, like a trimmed print edge.
  ctx.strokeStyle = "rgba(0, 0, 0, 0.42)";
  ctx.lineWidth = Math.max(2, W * 0.0016);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);

  if (state.showSelection && state.selected >= 0 && rects[state.selected]) {
    const r = rects[state.selected];
    ctx.save();
    ctx.strokeStyle = "#19e3c2";
    ctx.lineWidth = Math.max(3, W * 0.0035);
    ctx.setLineDash([W * 0.02, W * 0.012]);
    ctx.strokeRect(r.x + ctx.lineWidth, r.y + ctx.lineWidth, r.w - ctx.lineWidth * 2, r.h - ctx.lineWidth * 2);
    ctx.restore();
  }
}

/** The panel rectangles (in canvas pixels) for a layout at (`W`, `H`): the editor's hit-testing map. */
export function layoutRects(layout, W, H) {
  const gap = Math.max(5, Math.round(Math.min(W, H) * 0.01));
  return layout.panels.map(([x, y, w, h]) => ({
    x: x * W + gap / 2,
    y: y * H + gap / 2,
    w: w * W - gap,
    h: h * H - gap,
  }));
}
