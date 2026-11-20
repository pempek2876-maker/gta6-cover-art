// cover.js — the cover renderer for Vice Cover Studio v2.
//
// drawCover paints one finished cover on any 2D canvas: a procedural Vice
// City scene (scene.js) at the back, tilted photo panels with white poster
// frames in the middle, a foreground car-and-palm layer, and a title block
// with gradient display type, a hard offset shadow and a "VI" lockup.
// renderCover builds an export-size canvas; exportAllSizes renders the four
// common post sizes in one step.

import {
  gradeById,
  drawScene,
  drawNeonSign,
  drawGrain,
  drawVignette,
  drawHalftone,
} from './scene.js';

export const LAYOUTS = {
  'hero-split': 'Hero Split',
  triptych: 'Triptych',
  'full-bleed': 'Full Bleed',
  quad: 'Quad Grid',
};

export const SIZES = [
  { id: '1:1', label: 'Square 1080 × 1080', w: 1080, h: 1080 },
  { id: '4:5', label: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  { id: '9:16', label: 'Story 1080 × 1920', w: 1080, h: 1920 },
  { id: '16:9', label: 'Wide 1920 × 1080', w: 1920, h: 1080 },
];

export const PRESETS = {
  'sunset-heist': {
    label: 'Sunset Heist',
    layout: 'hero-split',
    grade: 'sunset',
    title: 'OCEAN DRIVE',
    kicker: 'VICE CITY \u2022 EST. 2026',
    subtitle: 'NEON NIGHTS',
    neon: 'OPEN ALL NIGHT',
  },
  'neon-nights': {
    label: 'Neon Nights',
    layout: 'triptych',
    grade: 'neon',
    title: 'NEON NIGHTS',
    kicker: 'VICE CITY \u2022 AFTER DARK',
    subtitle: 'TWO FRIENDS \u2022 ONE CITY',
    neon: 'VICE CITY',
  },
  'pastel-getaway': {
    label: 'Pastel Getaway',
    layout: 'full-bleed',
    grade: 'dawn',
    title: 'VICE CITY',
    kicker: 'GOLDEN HOUR \u2022 ROOFTOP',
    subtitle: 'PASTEL DAWN',
    neon: 'GOLDEN HOUR',
  },
};

export function defaultState() {
  return {
    layout: 'hero-split',
    grade: 'sunset',
    title: 'OCEAN DRIVE',
    kicker: 'VICE CITY \u2022 EST. 2026',
    subtitle: 'NEON NIGHTS',
    neon: 'OPEN ALL NIGHT',
    seed: 7,
    grain: 0.1,
    vignette: 0.3,
    halftone: true,
    onePhotoAll: false,
    photos: [
      { img: null, zoom: 1, ox: 0, oy: 0, grade: 'auto' },
      { img: null, zoom: 1, ox: 0, oy: 0, grade: 'auto' },
      { img: null, zoom: 1, ox: 0, oy: 0, grade: 'auto' },
    ],
  };
}

export function applyPreset(state, presetId) {
  const p = PRESETS[presetId];
  if (!p) return;
  state.layout = p.layout;
  state.grade = p.grade;
  state.title = p.title;
  state.kicker = p.kicker;
  state.subtitle = p.subtitle;
  state.neon = p.neon;
}

// ---- geometry helpers -------------------------------------------------

function tracePoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function polyBBox(pts) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Shrink a convex polygon toward its centroid by `pad` pixels.
function insetPoly(pts, pad) {
  let cx = 0;
  let cy = 0;
  for (const [x, y] of pts) {
    cx += x;
    cy += y;
  }
  cx /= pts.length;
  cy /= pts.length;
  return pts.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return [x - (dx / len) * pad, y - (dy / len) * pad];
  });
}

function fitFont(ctx, text, maxWidth, startSize, family) {
  let size = startSize;
  ctx.font = `${size}px ${family}`;
  while (size > 12 && ctx.measureText(text).width > maxWidth) {
    size *= 0.94;
    ctx.font = `${size}px ${family}`;
  }
  return size;
}

// ---- photo panels -----------------------------------------------------

function drawPhotoCover(ctx, box, photo) {
  const img = photo.img;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(box.w / iw, box.h / ih);
  const scale = base * (photo.zoom || 1);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = box.x + (box.w - dw) / 2 + (photo.ox || 0) * box.w;
  const dy = box.y + (box.h - dh) / 2 + (photo.oy || 0) * box.h;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawPhotoPlaceholder(ctx, box, grade) {
  const g = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
  g.addColorStop(0, grade.duotoneA);
  g.addColorStop(1, grade.duotoneB);
  ctx.fillStyle = g;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `${Math.max(14, box.h * 0.09)}px Anton, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ADD PHOTO', box.x + box.w / 2, box.y + box.h / 2);
}

// A grade wash over a photo: grayscale + a two-colour overlay so the panel
// reads as poster art instead of a raw snapshot. 'photo' keeps it natural.
function applyPanelGrade(ctx, box, mode, grade) {
  if (mode === 'photo') return;
  const g = mode === 'auto' ? grade : gradeById(mode);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const wash = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
  wash.addColorStop(0, g.duotoneA);
  wash.addColorStop(1, g.duotoneB);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = wash;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = g.duotoneA;
  ctx.fillRect(box.x, box.y, box.w, box.h * 0.5);
  ctx.fillStyle = g.duotoneB;
  ctx.fillRect(box.x, box.y + box.h * 0.5, box.w, box.h * 0.5);
  ctx.restore();
}

function drawPanel(ctx, pts, photo, grade, state) {
  const box = polyBBox(pts);
  const frame = Math.max(4, box.w * 0.014);
  // White poster frame with a soft drop shadow.
  ctx.save();
  tracePoly(ctx, pts);
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = box.w * 0.035;
  ctx.shadowOffsetY = box.w * 0.014;
  ctx.fillStyle = '#fdfdf8';
  ctx.fill();
  ctx.restore();
  const inner = insetPoly(pts, frame);
  const ibox = polyBBox(inner);
  ctx.save();
  tracePoly(ctx, inner);
  ctx.clip();
  if (photo && photo.img) {
    drawPhotoCover(ctx, ibox, photo);
  } else {
    drawPhotoPlaceholder(ctx, ibox, grade);
  }
  applyPanelGrade(ctx, ibox, photo ? photo.grade : 'auto', grade);
  ctx.restore();
  ctx.save();
  tracePoly(ctx, inner);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1.5, box.w * 0.004);
  ctx.stroke();
  ctx.restore();
}

// Panel polygons per layout. Every layout returns three polygons in
// photo order: hero, second, third.
export function panelPolys(layout, W, H) {
  const g = Math.max(6, W * 0.008); // gutter
  const top = H * 0.1;
  const bottom = H * 0.7;
  const left = W * 0.035;
  const right = W * 0.965;
  if (layout === 'triptych') {
    const w3 = (right - left - g * 2) / 3;
    const mid = (x0, x1, y0, y1, drop) => [
      [x0, y0],
      [x1, y0],
      [x1, y1 + drop],
      [x0, y1 + drop],
    ];
    return [
      mid(left, left + w3, top, bottom, 0),
      mid(left + w3 + g, left + w3 * 2 + g, top - H * 0.015, bottom, H * 0.02),
      mid(left + w3 * 2 + g * 2, right, top, bottom, 0),
    ];
  }
  if (layout === 'full-bleed') {
    return [
      [
        [left, top],
        [right, top],
        [right, bottom],
        [left, bottom],
      ],
      [
        [left, top],
        [right, top],
        [right, bottom],
        [left, bottom],
      ],
      [
        [left, top],
        [right, top],
        [right, bottom],
        [left, bottom],
      ],
    ];
  }
  if (layout === 'quad') {
    const midY = (top + bottom) / 2;
    const midX = (left + right) / 2;
    return [
      [
        [left, top],
        [midX - g / 2, top],
        [midX - g / 2, midY - g / 2],
        [left, midY - g / 2],
      ],
      [
        [midX + g / 2, top],
        [right, top],
        [right, midY - g / 2],
        [midX + g / 2, midY - g / 2],
      ],
      [
        [left, midY + g / 2],
        [right, midY + g / 2],
        [right, bottom],
        [left, bottom],
      ],
    ];
  }
  // hero-split: hero panel with a diagonal right edge, two stacked panels
  // on the right whose left edge follows the same slant.
  const heroX = left + (right - left) * 0.58;
  const slant = W * 0.045;
  const midY = (top + bottom) / 2;
  const slantAt = (y) => heroX - slant * ((y - top) / (bottom - top));
  return [
    [
      [left, top],
      [heroX, top],
      [heroX - slant, bottom],
      [left, bottom],
    ],
    [
      [heroX + g, top],
      [right, top],
      [right, midY - g / 2],
      [slantAt(midY - g / 2) + g, midY - g / 2],
    ],
    [
      [slantAt(midY + g / 2) + g, midY + g / 2],
      [right, midY + g / 2],
      [right, bottom],
      [heroX - slant, bottom],
    ],
  ];
}

// ---- title block ------------------------------------------------------

function drawTitleBlock(ctx, W, H, state, grade) {
  const bandY = H * 0.72;
  const bandH = H * 0.26;
  const slant = W * 0.02;
  // Dark band with a slanted top edge.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, bandY + slant);
  ctx.lineTo(W, bandY);
  ctx.lineTo(W, bandY + bandH);
  ctx.lineTo(0, bandY + bandH);
  ctx.closePath();
  ctx.fillStyle = grade.band;
  ctx.fill();
  ctx.restore();
  // Halftone print texture along the top of the band.
  if (state.halftone) {
    ctx.save();
    ctx.globalAlpha = 0.1;
    drawHalftone(ctx, 0, bandY, W, bandH * 0.18, '#ffffff', state.seed);
    ctx.restore();
  }
  // Neon accent rule on the band's top edge.
  ctx.save();
  ctx.strokeStyle = grade.neon;
  ctx.lineWidth = Math.max(2, H * 0.004);
  ctx.shadowColor = grade.neon;
  ctx.shadowBlur = H * 0.012;
  ctx.beginPath();
  ctx.moveTo(0, bandY + slant);
  ctx.lineTo(W, bandY);
  ctx.stroke();
  ctx.restore();

  const tx = W * 0.04;
  const titleSize = fitFont(
    ctx,
    state.title,
    W * 0.92,
    H * 0.125,
    "Anton, 'Arial Black', sans-serif",
  );
  const titleY = bandY + bandH * 0.56;
  // Kicker above the title.
  ctx.save();
  ctx.font = `${Math.max(12, H * 0.021)}px Anton, 'Arial Black', sans-serif`;
  try {
    ctx.letterSpacing = `${Math.max(3, W * 0.004)}px`;
  } catch {
    // Older canvas: no letter-spacing support, plain text still reads.
  }
  ctx.fillStyle = grade.accent;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(state.kicker, tx, bandY + bandH * 0.2);
  ctx.restore();
  // Title: hard offset shadow, dark outline, sunset gradient fill.
  ctx.save();
  ctx.font = `${titleSize}px Anton, 'Arial Black', sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const grad = ctx.createLinearGradient(0, titleY - titleSize * 0.55, 0, titleY + titleSize * 0.55);
  grad.addColorStop(0, grade.titleTop);
  grad.addColorStop(0.55, grade.titleMid);
  grad.addColorStop(1, grade.titleBottom);
  const ox = titleSize * 0.035;
  const oy = titleSize * 0.04;
  ctx.fillStyle = grade.titleStroke;
  ctx.fillText(state.title, tx + ox, titleY + oy);
  ctx.strokeStyle = grade.titleStroke;
  ctx.lineWidth = titleSize * 0.055;
  ctx.strokeText(state.title, tx, titleY);
  ctx.fillStyle = grad;
  ctx.fillText(state.title, tx, titleY);
  ctx.restore();
  // Subtitle under the title.
  ctx.save();
  ctx.font = `${Math.max(12, H * 0.024)}px Anton, 'Arial Black', sans-serif`;
  try {
    ctx.letterSpacing = `${Math.max(3, W * 0.005)}px`;
  } catch {
    // No letter-spacing support.
  }
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(state.subtitle, tx, bandY + bandH * 0.92);
  ctx.restore();
  // "VI" lockup badge, top-right of the band.
  const badgeW = W * 0.085;
  const badgeH = bandH * 0.62;
  const bx = W - tx - badgeW;
  const by = bandY + bandH * 0.16;
  ctx.save();
  ctx.translate(bx + badgeW / 2, by + badgeH / 2);
  ctx.rotate(-0.04);
  ctx.translate(-badgeW / 2, -badgeH / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.strokeStyle = grade.accent;
  ctx.lineWidth = Math.max(2, W * 0.003);
  ctx.beginPath();
  ctx.roundRect(0, 0, badgeW, badgeH, Math.min(10, badgeW * 0.12));
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  const viSize = fitFont(ctx, 'VI', badgeW * 0.8, badgeH * 0.52, "Anton, 'Arial Black', sans-serif");
  ctx.font = `${viSize}px Anton, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VI', badgeW / 2, badgeH * 0.42);
  const labelSize = fitFont(ctx, 'VICE CITY', badgeW * 0.86, badgeH * 0.13, "Anton, 'Arial Black', sans-serif");
  ctx.font = `${labelSize}px Anton, 'Arial Black', sans-serif`;
  ctx.fillStyle = grade.accent;
  ctx.fillText('VICE CITY', badgeW / 2, badgeH * 0.82);
  ctx.restore();
}

// ---- main draw ----------------------------------------------------------

export function drawCover(ctx, W, H, state) {
  const grade = gradeById(state.grade);
  drawScene(ctx, W, H, grade, state.seed);
  // Neon sign glowing in the top strip.
  drawNeonSign(
    ctx,
    state.neon,
    W * 0.22,
    H * 0.052,
    Math.max(16, H * 0.032),
    grade.neon,
    grade.neon,
  );
  // Small caption chip top-right, above the panels.
  ctx.save();
  ctx.font = `${Math.max(11, H * 0.018)}px Anton, 'Arial Black', sans-serif`;
  try {
    ctx.letterSpacing = '3px';
  } catch {
    // Plain text fallback.
  }
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  ctx.fillText('A VICE COVER STUDIO POSTER', W * 0.965, H * 0.052);
  ctx.restore();

  const polys = panelPolys(state.layout, W, H);
  const photos = state.photos || [];
  if (state.layout === 'full-bleed') {
    // One photo fills the whole panel area; the other two hide.
    drawPanel(ctx, polys[0], photos[0] || null, grade, state);
  } else {
    for (let i = 0; i < 3; i++) {
      const photo = state.onePhotoAll && photos[0] ? photos[0] : photos[i];
      drawPanel(ctx, polys[i], photo || null, grade, state);
    }
  }
  drawTitleBlock(ctx, W, H, state, grade);
  if (state.grain > 0) drawGrain(ctx, W, H, state.seed, state.grain);
  if (state.vignette > 0) drawVignette(ctx, W, H, state.vignette);
  // Thin outer frame, the poster's edge.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(2, W * 0.004);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
  ctx.restore();
}

export function renderCover(state, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, w, h, state);
  return canvas;
}

export function exportAllSizes(state) {
  return SIZES.map((s) => ({ ...s, canvas: renderCover(state, s.w, s.h) }));
}
