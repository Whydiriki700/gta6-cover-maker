// Vice Grid — the cover renderer. Draws one finished cover onto a canvas:
// photo panels in the chosen layout, the Vice grade, and the caption.
// Photos are plain HTMLImageElements; transforms are cover-fit plus zoom/pan.

import { layoutById, gradeById, captionById } from './layouts.js';

const GUTTER = 6; // px gap between panels at 1080 wide, scaled to the canvas

function fitRect(img, pw, ph, zoom, px, py) {
  const base = Math.max(pw / img.naturalWidth, ph / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * base;
  const dh = img.naturalHeight * base;
  return {
    x: (pw - dw) / 2 + px * pw,
    y: (ph - dh) / 2 + py * ph,
    w: dw,
    h: dh,
  };
}

function gradeFilter(grade, strength) {
  const f = grade.filter;
  const s = strength / 100;
  const sat = 1 + (f.saturate - 1) * s;
  const con = 1 + (f.contrast - 1) * s;
  const bri = 1 + (f.brightness - 1) * s;
  const hue = f.hue * s;
  return `saturate(${sat.toFixed(3)}) contrast(${con.toFixed(3)}) brightness(${bri.toFixed(3)}) hue-rotate(${hue.toFixed(1)}deg)`;
}

function tintWash(ctx, x, y, w, h, grade, strength) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, grade.sky[0]);
  g.addColorStop(1, grade.sky[1]);
  ctx.save();
  ctx.globalAlpha = grade.tint * (strength / 100);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function shade(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function fitFont(ctx, text, maxWidth, startPx, family, weight) {
  let px = startPx;
  while (px > 12) {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return px;
    px -= 2;
  }
  return px;
}

function drawHeadline(ctx, text, x, y, maxWidth, px, color, outline) {
  ctx.font = `400 ${px}px Anton, "Arial Black", sans-serif`;
  ctx.textBaseline = 'alphabetic';
  if (outline) {
    ctx.lineWidth = Math.max(2, px * 0.09);
    ctx.strokeStyle = outline;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const layout = layoutById(state.layout);
  const grade = gradeById(state.grade);
  const caption = captionById(state.caption);
  const strength = state.strength ?? 70;
  const gap = (GUTTER * W) / 1080;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0d0b12';
  ctx.fillRect(0, 0, W, H);

  const photos = state.photos || [];
  const spread = state.mode === 'spread';
  const hero = spread ? photos[0] : null;

  if (spread && hero && hero.img) {
    const r = fitRect(hero.img, W, H, hero.zoom, hero.px, hero.py);
    ctx.save();
    ctx.filter = gradeFilter(grade, strength);
    ctx.drawImage(hero.img, r.x, r.y, r.w, r.h);
    ctx.restore();
    tintWash(ctx, 0, 0, W, H, grade, strength);
    shade(ctx, 0, 0, W, H);
  } else {
    for (let i = 0; i < layout.panels.length; i++) {
      const p = layout.panels[i];
      const x = p.x * W;
      const y = p.y * H;
      const w = p.w * W;
      const h = p.h * H;
      const slot = photos[i];
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + gap / 2, y + gap / 2, w - gap, h - gap);
      ctx.clip();
      if (slot && slot.img) {
        const r = fitRect(slot.img, w - gap, h - gap, slot.zoom, slot.px, slot.py);
        ctx.filter = gradeFilter(grade, strength);
        ctx.drawImage(slot.img, x + gap / 2 + r.x, y + gap / 2 + r.y, r.w, r.h);
        ctx.filter = 'none';
        tintWash(ctx, x, y, w, h, grade, strength);
        shade(ctx, x, y, w, h);
      } else {
        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, '#2a2140');
        g.addColorStop(1, '#120e1c');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = `400 ${Math.round(H * 0.022)}px Anton, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('ADD PHOTO', x + w / 2, y + h / 2);
        ctx.textAlign = 'left';
      }
      ctx.restore();
    }
  }

  // Panel divider lines, drawn over the joins.
  ctx.save();
  ctx.strokeStyle = 'rgba(10,6,16,0.9)';
  ctx.lineWidth = gap;
  for (let i = 0; i < layout.panels.length; i++) {
    const p = layout.panels[i];
    ctx.strokeRect(p.x * W, p.y * H, p.w * W, p.h * H);
  }
  ctx.restore();

  drawCaption(ctx, caption, state, grade, W, H);

  // Vignette to hold the edges together.
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function drawCaption(ctx, caption, state, grade, W, H) {
  const headline = (state.headline || 'VICE GRID').toUpperCase();
  const subtitle = state.subtitle || '';
  const top = state.placement === 'top';
  const pad = W * 0.045;

  if (caption.id === 'slant') {
    const bandH = H * 0.16;
    const y = top ? H * 0.05 : H - bandH - H * 0.05;
    ctx.save();
    ctx.translate(0, y + bandH / 2);
    ctx.rotate(-0.045);
    ctx.translate(0, -bandH / 2);
    ctx.fillStyle = grade.ink;
    ctx.fillRect(-W * 0.05, 0, W * 1.1, bandH);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-W * 0.05, bandH - H * 0.012, W * 1.1, H * 0.012);
    const size = fitFont(ctx, headline, W - pad * 2, H * 0.085, 'Anton', 400);
    drawHeadline(ctx, headline, pad, bandH * 0.62, W - pad * 2, size, '#ffffff', 'rgba(0,0,0,0.55)');
    if (subtitle) {
      ctx.font = `400 ${Math.round(H * 0.026)}px "Helvetica Neue", Arial, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(subtitle.toUpperCase(), pad, bandH * 0.88);
    }
    ctx.restore();
    return;
  }

  if (caption.id === 'block') {
    const maxW = W - pad * 2;
    const size = fitFont(ctx, headline, maxW, H * 0.11, 'Anton', 400);
    ctx.font = `400 ${size}px Anton, "Arial Black", sans-serif`;
    const lines = wrapLines(ctx, headline, maxW);
    const lineH = size * 0.94;
    const blockH = lines.length * lineH + (subtitle ? H * 0.05 : 0);
    let y = top ? H * 0.06 + size * 0.8 : H - H * 0.06 - blockH + size * 0.8;
    for (const line of lines) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(pad - W * 0.01, y - size * 0.72, ctx.measureText(line).width + W * 0.02, size * 0.86);
      drawHeadline(ctx, line, pad, y, maxW, size, '#ffffff', '#000000');
      y += lineH;
    }
    if (subtitle) {
      ctx.font = `700 ${Math.round(H * 0.024)}px "Helvetica Neue", Arial, sans-serif`;
      ctx.fillStyle = grade.ink;
      ctx.fillRect(pad, y + H * 0.008, ctx.measureText(subtitle.toUpperCase()).width + W * 0.02, H * 0.036);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(subtitle.toUpperCase(), pad + W * 0.01, y + H * 0.033);
    }
    return;
  }

  if (caption.id === 'badge') {
    const maxW = W * 0.62;
    const size = fitFont(ctx, headline, maxW, H * 0.062, 'Anton', 400);
    ctx.font = `400 ${size}px Anton, "Arial Black", sans-serif`;
    const tw = Math.min(maxW, ctx.measureText(headline).width);
    const bw = tw + pad * 1.4;
    const bh = size * 1.15 + (subtitle ? H * 0.045 : H * 0.02);
    const bx = pad;
    const by = top ? H * 0.05 : H - bh - H * 0.05;
    ctx.save();
    ctx.fillStyle = 'rgba(8,5,14,0.82)';
    roundRect(ctx, bx, by, bw, bh, H * 0.02);
    ctx.fill();
    ctx.strokeStyle = grade.ink;
    ctx.lineWidth = Math.max(2, H * 0.004);
    roundRect(ctx, bx, by, bw, bh, H * 0.02);
    ctx.stroke();
    drawHeadline(ctx, headline, bx + pad * 0.7, by + size * 0.95, maxW, size, '#ffffff', null);
    if (subtitle) {
      ctx.font = `400 ${Math.round(H * 0.022)}px "Helvetica Neue", Arial, sans-serif`;
      ctx.fillStyle = grade.ink;
      ctx.fillText(subtitle.toUpperCase(), bx + pad * 0.7, by + size * 0.95 + H * 0.038);
    }
    ctx.restore();
    return;
  }

  // marquee
  const stripH = H * 0.11;
  const y = top ? 0 : H - stripH;
  ctx.fillStyle = 'rgba(8,5,14,0.88)';
  ctx.fillRect(0, y, W, stripH);
  ctx.fillStyle = grade.ink;
  ctx.fillRect(0, top ? y + stripH - H * 0.008 : y, W, H * 0.008);
  const size = fitFont(ctx, headline, W * 0.55, H * 0.055, 'Anton', 400);
  drawHeadline(ctx, headline, pad, y + stripH * 0.62, W * 0.55, size, '#ffffff', null);
  if (subtitle) {
    ctx.font = `400 ${Math.round(H * 0.024)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'right';
    ctx.fillText(subtitle.toUpperCase(), W - pad, y + stripH * 0.6);
    ctx.textAlign = 'left';
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
