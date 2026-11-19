// The cover renderer: paints the whole poster onto a 2D canvas context.
//
// The poster is built in layers. First the border colour fills the canvas, then each panel is clipped and
// painted with its photo (cover-fit, with the maker's pan and zoom), the colour grade is laid over the photo
// as soft-light tints, and the panel's edge is keyed with a soft inner shadow. A vignette and a whisper of
// film grain finish the print, and the caption is lettered over a shade band so it stays readable on any
// photo. Everything is drawn from the state object the editor passes in; the same function paints the live
// preview and the exported PNG, so what the maker sees is exactly what they share.

let grainTile = null;

/** A small tile of random grey noise, drawn once and reused as a pattern for the print grain. */
function getGrainTile() {
  if (grainTile) return grainTile;
  const tile = document.createElement("canvas");
  tile.width = 140;
  tile.height = 140;
  const tctx = tile.getContext("2d");
  const data = tctx.createImageData(140, 140);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 96 + Math.floor(Math.random() * 64);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  tctx.putImageData(data, 0, 0);
  grainTile = tile;
  return tile;
}

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Draws `img` into `rect` cover-fit, scaled by `zoom`, panned by (`dx`, `dy`) as fractions of the rect, and
 * clamped so the photo always covers the whole rect (no empty edges, ever).
 */
function drawPhotoCover(ctx, rect, img, dx, dy, zoom) {
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const maxX = Math.max(0, (dw - rect.w) / 2);
  const maxY = Math.max(0, (dh - rect.h) / 2);
  const ox = rect.x + (rect.w - dw) / 2 + clamp(dx * rect.w, -maxX, maxX);
  const oy = rect.y + (rect.h - dh) / 2 + clamp(dy * rect.h, -maxY, maxY);
  ctx.drawImage(img, ox, oy, dw, dh);
}

/** A drawn stand-in scene for a panel with no photo yet: dusk sky, a low sun and palm silhouettes. */
function drawPlaceholderScene(ctx, rect, seed) {
  const sky = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  sky.addColorStop(0, "#3b1d5e");
  sky.addColorStop(0.55, "#b03060");
  sky.addColorStop(1, "#ff8c42");
  ctx.fillStyle = sky;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const sunR = Math.min(rect.w, rect.h) * 0.16;
  const sunX = rect.x + rect.w * (0.3 + 0.14 * (seed % 3));
  const sunY = rect.y + rect.h * 0.62;
  ctx.fillStyle = "rgba(255, 214, 90, 0.9)";
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#160a24";
  ctx.fillRect(rect.x, rect.y + rect.h * 0.78, rect.w, rect.h * 0.22);
  drawPalm(ctx, rect.x + rect.w * 0.16, rect.y + rect.h * 0.8, rect.h * 0.34);
  drawPalm(ctx, rect.x + rect.w * 0.84, rect.y + rect.h * 0.82, rect.h * 0.26);
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.font = `600 ${Math.max(11, Math.min(rect.w, rect.h) * 0.055)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("ADD A PHOTO", rect.x + rect.w / 2, rect.y + rect.h * 0.94);
}

/** A simple palm silhouette: a curved trunk and six fronds, drawn in the current fill colour. */
function drawPalm(ctx, baseX, baseY, height) {
  ctx.strokeStyle = "#160a24";
  ctx.fillStyle = "#160a24";
  ctx.lineWidth = Math.max(2, height * 0.045);
  ctx.lineCap = "round";
  const topX = baseX + height * 0.16;
  const topY = baseY - height;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(baseX + height * 0.02, baseY - height * 0.6, topX, topY);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI * (0.08 + (i / 5) * 0.84);
    const len = height * 0.42;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(angle) * len * 0.6,
      topY - Math.sin(angle) * len * 0.6 - height * 0.05,
      topX + Math.cos(angle) * len,
      topY - Math.sin(angle) * len * 0.35 + height * 0.1,
    );
    ctx.stroke();
  }
}

/** Lays one grade overlay (a vertical tint gradient) over a rect, its strength scaled by `strength`. */
function paintGradeOverlay(ctx, rect, overlay, strength) {
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  for (const [at, colour] of overlay.stops) grad.addColorStop(at, colour);
  ctx.save();
  ctx.globalCompositeOperation = overlay.mode;
  ctx.globalAlpha = strength;
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Paints one panel: photo or placeholder, grade, alternating collage tint, and a soft inner shadow. */
function paintPanel(ctx, rect, cell, grade, strength, panelIndex) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (cell && cell.img) {
    ctx.filter = grade.filter;
    drawPhotoCover(ctx, rect, cell.img, cell.dx, cell.dy, cell.zoom);
    ctx.filter = "none";
  } else {
    drawPlaceholderScene(ctx, rect, panelIndex);
  }
  for (const overlay of grade.overlays) paintGradeOverlay(ctx, rect, overlay, strength);
  // Neighbouring panels lean warm and cool in turn, the way pasted poster panels catch different light.
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = panelIndex % 2 === 0 ? "rgba(255, 140, 60, 0.5)" : "rgba(60, 160, 255, 0.5)";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
  // Inner shadow: a soft dark keyline just inside the panel's edge.
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.strokeStyle = "rgba(10, 4, 18, 0.35)";
  ctx.lineWidth = Math.max(6, rect.w * 0.03);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Letters the caption: a big display title with a painted edge, and the subtitle on a slanted banner. */
function letterCaption(ctx, W, H, state) {
  const title = state.title.trim().toUpperCase();
  const subtitle = state.subtitle.trim().toUpperCase();
  if (!title && !subtitle) return;
  const unit = Math.min(W, H);
  const pad = unit * 0.05;
  const atBottom = state.titlePos === "bottom";

  // A shade band behind the lettering keeps it readable over bright panels: darkest at the poster's
  // edge, fading to nothing a third of the way in, so it never cuts a visible line across a panel.
  const bandH = unit * 0.34;
  const shade = atBottom
    ? ctx.createLinearGradient(0, H - bandH, 0, H)
    : ctx.createLinearGradient(0, 0, 0, bandH);
  shade.addColorStop(0, atBottom ? "rgba(8, 3, 16, 0)" : "rgba(8, 3, 16, 0.52)");
  shade.addColorStop(1, atBottom ? "rgba(8, 3, 16, 0.52)" : "rgba(8, 3, 16, 0)");
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
        const g = ctx.createLinearGradient(0, 0, 0, unit * 0.2);
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
    titleSize = unit * 0.128 * state.titleSize;
    ctx.textAlign = "center";
    const setFont = (s) => { ctx.font = `${s}px CoverDisplay, "Arial Black", sans-serif`; };
    setFont(titleSize);
    while (ctx.measureText(title).width > W * 0.92 && titleSize > 14) {
      titleSize *= 0.96;
      setFont(titleSize);
    }
    titleBaseline = atBottom ? H - pad - titleSize * 0.16 : pad + titleSize * 0.92;
    if (subtitle) titleBaseline += atBottom ? -unit * 0.055 : unit * 0.055;
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = titleSize * 0.1;
    ctx.shadowOffsetY = titleSize * 0.045;
    ctx.strokeStyle = scheme.edge;
    ctx.lineWidth = titleSize * 0.15;
    ctx.strokeText(title, W / 2, titleBaseline);
    ctx.fillStyle = scheme.fill();
    ctx.fillText(title, W / 2, titleBaseline);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  if (subtitle) {
    const subSize = unit * 0.031 * (0.8 + state.titleSize * 0.2);
    ctx.font = `600 ${subSize}px "Segoe UI", system-ui, sans-serif`;
    try { ctx.letterSpacing = `${subSize * 0.22}px`; } catch { /* older canvas: spacing is a garnish */ }
    const textW = ctx.measureText(subtitle).width + subSize * 0.22 * subtitle.length;
    const bannerW = Math.min(W * 0.94, textW + subSize * 1.7);
    const bannerH = subSize * 1.9;
    const cx = W / 2;
    const cy = atBottom ? H - pad - bannerH * 0.42 : pad + (title ? titleSize * 1.18 : 0) + bannerH * 0.6;
    const slant = bannerH * 0.32;
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
    ctx.fillText(subtitle, cx, cy + subSize * 0.36);
    try { ctx.letterSpacing = "0px"; } catch { /* reset */ }
  }
}

/**
 * Paints the full cover described by `state` onto `ctx` at (`W`, `H`).
 * state: { layout, mode, spread, cells, grade, strength, borderColor, title, subtitle, titleSize,
 *          titlePos, titleScheme, selected, showSelection }
 */
export function drawCoverArt(ctx, W, H, state) {
  const gap = Math.max(5, Math.round(Math.min(W, H) * 0.009));
  ctx.fillStyle = state.borderColor;
  ctx.fillRect(0, 0, W, H);

  const rects = state.layout.panels.map((p) => ({
    x: p.x * W + gap / 2,
    y: p.y * H + gap / 2,
    w: p.w * W - gap,
    h: p.h * H - gap,
  }));

  rects.forEach((rect, i) => {
    if (state.mode === "spread") {
      // One photo across the whole poster: paint it in full-canvas coordinates inside each panel's clip,
      // so the slices line up across the borders.
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();
      if (state.spread.img) {
        ctx.filter = state.grade.filter;
        drawPhotoCover(ctx, { x: 0, y: 0, w: W, h: H }, state.spread.img, state.spread.dx, state.spread.dy, state.spread.zoom);
        ctx.filter = "none";
      } else {
        drawPlaceholderScene(ctx, { x: 0, y: 0, w: W, h: H }, 1);
      }
      for (const overlay of state.grade.overlays) paintGradeOverlay(ctx, rect, overlay, state.strength);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();
      ctx.strokeStyle = "rgba(10, 4, 18, 0.35)";
      ctx.lineWidth = Math.max(6, rect.w * 0.03);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    } else {
      paintPanel(ctx, rect, state.cells[i], state.grade, state.strength, i);
    }
  });

  // Vignette and print grain over the panels, under the lettering.
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.78);
  vig.addColorStop(0, "rgba(8, 2, 16, 0)");
  vig.addColorStop(1, "rgba(8, 2, 16, 0.30)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = ctx.createPattern(getGrainTile(), "repeat");
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  letterCaption(ctx, W, H, state);

  // A fine keyline around the whole poster, like a trimmed print edge.
  ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
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
export function panelRects(layout, W, H) {
  const gap = Math.max(5, Math.round(Math.min(W, H) * 0.009));
  return layout.panels.map((p) => ({
    x: p.x * W + gap / 2,
    y: p.y * H + gap / 2,
    w: p.w * W - gap,
    h: p.h * H - gap,
  }));
}
