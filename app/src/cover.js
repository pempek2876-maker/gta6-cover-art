// The cover renderer: draws the whole poster onto a 2D context at any size.
// Everything is drawn, never uploaded: photos come from the user's machine,
// the lettering is the bundled Anton font, the skyline and sun are procedural.
//
// State shape (see main.js for the live defaults):
//   layoutId, photos[3] (Image or null), assign {panelId: slot},
//   crops {panelId: {zoom, ox, oy}}, gradeId, caption, subline,
//   captionColor ('white' | 'sunset' | 'neon'), captionScale (0.7–1.4)
import { pickLayout, polygonCenter } from './layouts.js';

export const GRADES = [
  { id: 'sunset', name: 'Vice Sunset', blurb: 'Orange sun, magenta dusk.' },
  { id: 'neon', name: 'Neon Night', blurb: 'Magenta and cyan after dark.' },
  { id: 'golden', name: 'Golden Hour', blurb: 'Warm late-afternoon light.' },
  { id: 'noir', name: 'Noir', blurb: 'Black and white, hard contrast.' },
];

export const CAPTION_COLORS = [
  { id: 'white', name: 'White' },
  { id: 'sunset', name: 'Sunset fade' },
  { id: 'neon', name: 'Neon fade' },
];

/** Deterministic pseudo-random from a seed, for the skyline. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Traces a polygon path on ctx. */
function tracePolygon(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

/** Bounding box of a polygon. */
function polygonBox(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Draws one photo into a panel: cover-fit, zoomed, panned by the crop.
 * When the slot is empty, paints a deep violet placeholder with a sun.
 */
function drawPanelPhoto(ctx, panel, photo, crop, gradeId) {
  const box = polygonBox(panel.points);
  ctx.save();
  tracePolygon(ctx, panel.points);
  ctx.clip();
  if (!photo || !photo.naturalWidth || !photo.naturalHeight) {
    // Empty slot — or an image that failed to decode — gets the gradient
    // placeholder instead of a divide-by-zero draw.
    const g = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
    g.addColorStop(0, '#3b1155');
    g.addColorStop(0.55, '#8f1d5e');
    g.addColorStop(1, '#ff7a3d');
    ctx.fillStyle = g;
    ctx.fillRect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
    drawSun(ctx, box.x + box.w * 0.5, box.y + box.h * 0.42, box.w * 0.16);
  } else {
    const zoom = crop?.zoom ?? 1;
    const scale = Math.max(box.w / photo.naturalWidth, box.h / photo.naturalHeight) * zoom;
    const pw = photo.naturalWidth * scale;
    const ph = photo.naturalHeight * scale;
    const ox = (crop?.ox ?? 0) * box.w;
    const oy = (crop?.oy ?? 0) * box.h;
    if (gradeId === 'noir') ctx.filter = 'grayscale(1) contrast(1.12) brightness(1.06)';
    ctx.drawImage(photo, box.x + (box.w - pw) / 2 + ox, box.y + (box.h - ph) / 2 + oy, pw, ph);
    ctx.filter = 'none';
  }
  ctx.restore();
}

/** A flat gradient sun disc with a soft halo. */
function drawSun(ctx, cx, cy, r) {
  const halo = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.6);
  halo.addColorStop(0, 'rgba(255, 190, 90, 0.55)');
  halo.addColorStop(1, 'rgba(255, 190, 90, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(cx - r * 2.6, cy - r * 2.6, r * 5.2, r * 5.2);
  const disc = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  disc.addColorStop(0, '#ffe9a3');
  disc.addColorStop(0.55, '#ffb347');
  disc.addColorStop(1, '#ff5e62');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/** A procedural city skyline silhouette with lit windows, for the band. */
function drawSkyline(ctx, x, y, w, h, seed) {
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.fillStyle = '#160a24';
  let bx = x;
  while (bx < x + w) {
    const bw = w * (0.05 + rnd() * 0.07);
    const bh = h * (0.35 + rnd() * 0.6);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    // Antenna on some towers.
    if (rnd() > 0.72) ctx.fillRect(bx + bw / 2 - 1, y + h - bh - h * 0.14, 2, h * 0.14);
    // Lit windows.
    ctx.fillStyle = 'rgba(255, 205, 110, 0.85)';
    const cols = Math.max(1, Math.floor(bw / (w * 0.016)));
    const rows = Math.max(1, Math.floor(bh / (h * 0.09)));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rnd() > 0.62) {
          ctx.fillRect(bx + 3 + c * (bw - 6) / cols, y + h - bh + 4 + r * (bh - 8) / rows, 2.5, 3.5);
        }
      }
    }
    ctx.fillStyle = '#160a24';
    bx += bw + 1;
  }
  ctx.restore();
}

/** Colour-grade wash over the whole cover, after the photos. */
function applyGrade(ctx, w, h, gradeId) {
  ctx.save();
  if (gradeId === 'sunset') {
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, 'rgba(255, 120, 60, 0.05)');
    wash.addColorStop(0.62, 'rgba(255, 90, 60, 0.10)');
    wash.addColorStop(1, 'rgba(190, 30, 120, 0.30)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'screen';
    const glow = ctx.createRadialGradient(w * 0.82, h * 0.1, 0, w * 0.82, h * 0.1, w * 0.5);
    glow.addColorStop(0, 'rgba(255, 190, 100, 0.28)');
    glow.addColorStop(1, 'rgba(255, 190, 100, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  } else if (gradeId === 'neon') {
    ctx.globalCompositeOperation = 'screen';
    const pink = ctx.createRadialGradient(w * 0.12, h * 0.08, 0, w * 0.12, h * 0.08, w * 0.55);
    pink.addColorStop(0, 'rgba(255, 60, 200, 0.38)');
    pink.addColorStop(1, 'rgba(255, 60, 200, 0)');
    ctx.fillStyle = pink;
    ctx.fillRect(0, 0, w, h);
    const cyan = ctx.createRadialGradient(w * 0.9, h * 0.95, 0, w * 0.9, h * 0.95, w * 0.6);
    cyan.addColorStop(0, 'rgba(40, 220, 255, 0.36)');
    cyan.addColorStop(1, 'rgba(40, 220, 255, 0)');
    ctx.fillStyle = cyan;
    ctx.fillRect(0, 0, w, h);
  } else if (gradeId === 'golden') {
    const wash = ctx.createLinearGradient(0, 0, w, h);
    wash.addColorStop(0, 'rgba(255, 180, 70, 0.16)');
    wash.addColorStop(1, 'rgba(255, 130, 40, 0.22)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'screen';
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, w * 0.6);
    glow.addColorStop(0, 'rgba(255, 220, 140, 0.20)');
    glow.addColorStop(1, 'rgba(255, 220, 140, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
  // Vignette on every grade: it sells the poster look.
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(10, 0, 20, 0.32)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/** Bold poster lettering: Anton, black outline, gradient or white fill. */
function drawCaption(ctx, text, cx, baselineY, maxWidth, size, colorId) {
  const clean = (text || '').trim().toUpperCase();
  if (!clean) return;
  let s = size;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const setFont = (px) => { ctx.font = `${px}px Anton, 'Arial Narrow', sans-serif`; };
  setFont(s);
  try { ctx.letterSpacing = `${Math.max(1, s * 0.015)}px`; } catch { /* older canvas */ }
  while (ctx.measureText(clean).width > maxWidth && s > 10) {
    s -= 2;
    setFont(s);
  }
  let fill;
  if (colorId === 'sunset') {
    fill = ctx.createLinearGradient(0, baselineY - s, 0, baselineY);
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(0.55, '#ffe9a3');
    fill.addColorStop(1, '#ff7a3d');
  } else if (colorId === 'neon') {
    fill = ctx.createLinearGradient(0, baselineY - s, 0, baselineY);
    fill.addColorStop(0, '#a5f3ff');
    fill.addColorStop(0.5, '#ffffff');
    fill.addColorStop(1, '#ff5ce1');
  } else {
    fill = '#ffffff';
  }
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = '#14060f';
  ctx.lineWidth = Math.max(3, s * 0.10);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = s * 0.10;
  ctx.shadowOffsetY = s * 0.03;
  ctx.strokeText(clean, cx, baselineY);
  ctx.fillStyle = fill;
  ctx.fillText(clean, cx, baselineY);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  return s;
}

/** Small tracked-out caps line under the caption. */
function drawSubline(ctx, text, cx, y, maxWidth, size) {
  const clean = (text || '').trim().toUpperCase();
  if (!clean) return;
  let s = size;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const setFont = (px) => { ctx.font = `700 ${px}px system-ui, sans-serif`; };
  setFont(s);
  try { ctx.letterSpacing = `${s * 0.32}px`; } catch { /* ignore */ }
  while (ctx.measureText(clean).width > maxWidth && s > 8) {
    s -= 1;
    setFont(s);
  }
  ctx.fillStyle = '#ffe9a3';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = s * 0.3;
  ctx.fillText(clean, cx, y);
  ctx.shadowBlur = 0;
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
}

/**
 * Draws the full cover. ctx must belong to a canvas of exactly W x H.
 * Photos are HTMLImageElements (or null); everything else is plain state.
 */
export function drawCoverArt(ctx, W, H, state) {
  const layout = pickLayout(W, H, state.layoutId);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#160a24';
  ctx.fillRect(0, 0, W, H);

  // 1. Panels: photo (or placeholder), clipped to each polygon.
  for (const panel of layout.panels) {
    if (panel.slot === -1) {
      // Caption band: deep violet with a sun and a skyline.
      const box = polygonBox(panel.points);
      ctx.save();
      tracePolygon(ctx, panel.points);
      ctx.clip();
      const g = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
      g.addColorStop(0, '#2a0f45');
      g.addColorStop(1, '#12041f');
      ctx.fillStyle = g;
      ctx.fillRect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
      drawSun(ctx, box.x + box.w * 0.82, box.y + box.h * 0.28, box.h * 0.16);
      drawSkyline(ctx, box.x, box.y + box.h * 0.45, box.w, box.h * 0.55, 20261119);
      ctx.restore();
      continue;
    }
    const slot = state.assign?.[panel.id] ?? panel.slot;
    // An empty slot falls back to a neighbouring loaded photo, so a poster
    // never shows a blank panel while any photo is loaded at all.
    const order = [slot, (slot + 2) % 3, (slot + 1) % 3];
    const photo = order.map((i) => state.photos?.[i]).find((p) => p) ?? null;
    drawPanelPhoto(ctx, panel, photo, state.crops?.[panel.id], state.gradeId);
  }

  // 2. Grade wash + vignette over the photos.
  applyGrade(ctx, W, H, state.gradeId);

  // 3. White poster gutters between panels.
  const gutter = Math.max(3, Math.round(W * 0.005));
  ctx.save();
  ctx.lineJoin = 'round';
  for (const panel of layout.panels) {
    tracePolygon(ctx, panel.points);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = gutter;
    ctx.stroke();
    tracePolygon(ctx, panel.points);
    ctx.strokeStyle = 'rgba(20, 6, 15, 0.35)';
    ctx.lineWidth = Math.max(1, gutter * 0.25);
    ctx.stroke();
  }
  ctx.restore();

  // 4. Lettering on its anchor panel.
  const anchor = layout.panels.find((p) => p.caption);
  if (anchor) {
    const box = polygonBox(anchor.points);
    const scale = state.captionScale ?? 1;
    if (anchor.caption === 'hero') {
      const size = W * 0.105 * scale;
      // The hero panel's foot is a diagonal, so the subline goes ABOVE the
      // caption: below it would cross the gutter into the panels beneath.
      const baseline = box.y + box.h - H * 0.045;
      drawSubline(ctx, state.subline, W / 2, baseline - size * 1.12, W * 0.8, W * 0.022 * scale);
      drawCaption(ctx, state.caption, W / 2, baseline, W * 0.94, size, state.captionColor);
    } else {
      // Band: lettering centred in the band, skyline below it.
      const [cx, cy] = polygonCenter(anchor.points);
      const size = W * 0.115 * scale;
      const used = drawCaption(ctx, state.caption, cx, cy + size * 0.18, W * 0.94, size, state.captionColor);
      if (used) drawSubline(ctx, state.subline, cx, cy + size * 0.18 + used * 0.45, W * 0.8, W * 0.022 * scale);
    }
  }
}
