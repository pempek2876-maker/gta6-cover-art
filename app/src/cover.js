// Vice Cover Studio — the cover renderer.
//
// drawCover paints one whole cover on any 2D canvas context: the layout's
// panels filled with the user's photos, a Vice City colour grade over the
// top, white poster gutters, then the bold title block. Everything is
// drawn, never composited from images, so the same state always paints
// the same pixels — the export PNG is deterministic.

import { layoutById, panelBox, panelPixels } from './layouts.js';

/** The three grades the editor offers, in menu order. */
export const GRADE_IDS = ['neon', 'sunset', 'golden'];

/** A grade's paint recipe: gradient stops and how strongly they land. */
const GRADES = {
  neon: {
    label: 'Neon nights',
    // Magenta sky melting into teal street light.
    wash: { stops: [[0, '#ff2e88'], [0.55, '#b83280'], [1, '#00c2a8']], mode: 'overlay', alpha: 0.34 },
    glow: { x: 0.82, y: 0.1, r: 0.55, color: '#ff5da2', alpha: 0.22 },
    shade: { color: '#0a1030', alpha: 0.1 },
  },
  sunset: {
    label: 'Vice sunset',
    // Orange horizon, pink mid-sky, purple dusk.
    wash: { stops: [[0, '#ff9a3d'], [0.5, '#ff2e88'], [1, '#5b1a72']], mode: 'soft-light', alpha: 0.6 },
    glow: { x: 0.5, y: 0.05, r: 0.7, color: '#ffb347', alpha: 0.3 },
    shade: { color: '#2a0a2e', alpha: 0.08 },
  },
  golden: {
    label: 'Golden hour',
    // Warm amber light over everything.
    wash: { stops: [[0, '#ffd166'], [0.6, '#ff9a3d'], [1, '#c25e1e']], mode: 'overlay', alpha: 0.38 },
    glow: { x: 0.18, y: 0.08, r: 0.6, color: '#ffe9a8', alpha: 0.26 },
    shade: { color: '#3d2200', alpha: 0.1 },
  },
};

/** Look a grade up by id, falling back to neon for an unknown id. */
export function gradeById(id) {
  return GRADES[id] ?? GRADES.neon;
}

/**
 * A tiny deterministic PRNG (mulberry32). The grain it seeds is the same
 * on every run, so two exports of one cover are byte-identical.
 */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A path through a panel polygon, in cover pixels. */
function tracePanel(ctx, panel, width, height) {
  const pts = panelPixels(panel, width, height);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/**
 * Paint one photo into one panel: cover-fit (the photo fills the panel's
 * box, cropped), then zoomed around its centre and panned by the panel's
 * offsets. A missing photo paints a flat dusk gradient instead, so the
 * cover never has a hole in it.
 */
function paintPhoto(ctx, img, panel, width, height, crop) {
  tracePanel(ctx, panel, width, height);
  ctx.save();
  ctx.clip();
  const [bx, by, bw, bh] = panelBox(panel, width, height);
  if (!img || !img.naturalWidth) {
    const g = ctx.createLinearGradient(bx, by, bx, by + bh);
    g.addColorStop(0, '#3d1560');
    g.addColorStop(1, '#12041f');
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw, bh);
    ctx.restore();
    return;
  }
  const zoom = crop?.zoom ?? 1;
  const panX = crop?.panX ?? 0; // -0.5 .. 0.5 of the panel width
  const panY = crop?.panY ?? 0;
  const scale = Math.max(bw / img.naturalWidth, bh / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = bx + (bw - dw) / 2 + panX * bw;
  const dy = by + (bh - dh) / 2 + panY * bh;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/**
 * Wash the whole cover with the grade's colours: a vertical gradient in
 * the grade's blend mode, a warm glow, then a faint dark shade so the
 * lettering stays readable.
 */
function paintGrade(ctx, width, height, gradeId) {
  const grade = gradeById(gradeId);
  const { wash, glow, shade } = grade;
  const g = ctx.createLinearGradient(0, 0, 0, height);
  for (const [at, color] of wash.stops) g.addColorStop(at, color);
  ctx.save();
  ctx.globalCompositeOperation = wash.mode;
  ctx.globalAlpha = wash.alpha;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const glowG = ctx.createRadialGradient(
    glow.x * width, glow.y * height, 0,
    glow.x * width, glow.y * height, glow.r * Math.max(width, height),
  );
  glowG.addColorStop(0, glow.color);
  glowG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = glow.alpha;
  ctx.fillStyle = glowG;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = shade.alpha;
  ctx.fillStyle = shade.color;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/** Crisp white gutters along every panel seam, poster-style. */
function paintGutters(ctx, layout, width, height) {
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, width * 0.004);
  ctx.lineJoin = 'round';
  for (const panel of layout.panels) {
    tracePanel(ctx, panel, width, height);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * The biggest Anton size (in px) that fits `text` inside `maxWidth`,
 * starting from `start` and shrinking in steps. Anton has no lowercase
 * variant worth using here — captions are uppercased by the caller.
 */
function fitTitleSize(ctx, text, start, maxWidth) {
  let size = start;
  while (size > 12) {
    ctx.font = `${size}px Anton, sans-serif`;
    // The outline stroke adds ~lineWidth to the drawn width, so the
    // measure must leave room for it or the title clips at the edges.
    const drawn = ctx.measureText(text).width + size * 0.11;
    if (drawn <= maxWidth) return size;
    size -= 2;
  }
  return size;
}

/** The title block: letterspaced gold subline, then the big white title. */
function paintTitle(ctx, layout, width, height, caption, subline) {
  const titleText = (caption || 'VICE CITY').toUpperCase().slice(0, 28);
  const subText = (subline || '').toUpperCase().slice(0, 28);
  const t = layout.title;
  const s = layout.subline;

  // Alphabetic baseline, so the title and the subline can be stacked
  // by their real cap heights: with a 'middle' baseline the all-caps
  // title's em box hangs below its glyphs and the subline collided with
  // it. The layout's cy is the centre of the title's cap height.
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = t.align;

  const tx = t.cx * width;
  const maxW = t.width * width * 0.96;
  const size = fitTitleSize(ctx, titleText, width * 0.135, maxW);
  const titleY = t.cy * height;
  // Anton's caps run nearly the full em (measured: glyph height ~1.0em
  // including the outline), not the 0.72em a text face would. Centre the
  // whole glyph box on titleY and stack the subline above its top edge.
  const titleBaseline = titleY + size * 0.5;
  const titleCapTop = titleBaseline - size * 1.0;

  // Subline first, above the title, in spaced-out gold capitals. Its
  // baseline sits one gap above the title's cap top, so it always clears.
  if (subText) {
    const subSize = Math.max(12, width * 0.038);
    ctx.font = `600 ${subSize}px system-ui, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(subSize * 0.38)}px`; } catch { /* older canvas: no letter spacing */ }
    const subBaseline = titleCapTop - size * 0.12;
    const sx = s.cx * width;
    ctx.textAlign = s.align;
    ctx.lineWidth = Math.max(2, subSize * 0.16);
    ctx.strokeStyle = 'rgba(18, 4, 31, 0.9)';
    ctx.lineJoin = 'round';
    ctx.strokeText(subText, sx, subBaseline);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(subText, sx, subBaseline);
    try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
    ctx.textAlign = t.align;
  }

  // The title: thick dark outline, white fill, so it reads over any photo.
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.lineWidth = Math.max(4, size * 0.11);
  ctx.strokeStyle = '#12041f';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeText(titleText, tx, titleBaseline);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(titleText, tx, titleBaseline);
  ctx.restore();
}

/** A whisper of print texture: a few large, soft light/dark blooms, seeded
 * so they never change between exports. Deliberately low-frequency: the
 * per-pixel noise this replaced made exported PNGs ~10x bigger, past the
 * gate's 256 KiB cap, while looking no better at post size. */
function paintGrain(ctx, width, height) {
  const rand = seededRandom(20261119);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  for (let i = 0; i < 26; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const r = (0.06 + rand() * 0.2) * Math.max(width, height);
    const light = rand() > 0.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, light ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}

/** Darkened corners, so the cover feels printed, not pasted. */
function paintVignette(ctx, width, height) {
  const g = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.42,
    width / 2, height / 2, Math.max(width, height) * 0.75,
  );
  g.addColorStop(0, 'rgba(8, 2, 18, 0)');
  g.addColorStop(1, 'rgba(8, 2, 18, 0.38)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Paint a whole cover.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width cover width in px
 * @param {number} height cover height in px
 * @param {{
 *   layoutId: string, gradeId: string, caption: string, subline: string,
 *   panels: { photo: HTMLImageElement|null, zoom: number, panX: number, panY: number }[]
 * }} state
 */
export function drawCover(ctx, width, height, state) {
  const layout = layoutById(state.layoutId);
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#12041f';
  ctx.fillRect(0, 0, width, height);

  layout.panels.forEach((panel, i) => {
    paintPhoto(ctx, state.panels[i]?.photo ?? null, panel, width, height, state.panels[i]);
  });

  paintGrade(ctx, width, height, state.gradeId);
  paintGutters(ctx, layout, width, height);
  paintTitle(ctx, layout, width, height, state.caption, state.subline);
  paintGrain(ctx, width, height);
  paintVignette(ctx, width, height);
  ctx.restore();
}
