// scene.js — procedural Vice City scene painter for Vice Cover Studio v2.
//
// Everything here is drawn, never borrowed: the sunset sky, the sun disc, the
// downtown skyline, palm silhouettes, a low sports-car silhouette and a neon
// sign are all computed from a seeded random stream, so the same seed always
// paints the same city. The cover renderer (cover.js) calls drawScene first
// and layers the photo panels and the title block on top of it.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A grade is the whole colour story of a cover: sky stops, sun, skyline ink,
// title gradient, accent lines and the panel treatment tints.
export const GRADES = {
  sunset: {
    label: 'Sunset',
    sky: ['#2b1055', '#7597de', '#ff7e5f', '#feb47b', '#ffd194'],
    sun: '#fff3b0',
    sunGlow: 'rgba(255, 170, 80, 0.55)',
    skyline: '#1c0b33',
    skylineFar: '#3a1c5e',
    palm: '#14082a',
    car: '#12081f',
    haze: 'rgba(255, 126, 95, 0.16)',
    titleTop: '#fff8e7',
    titleMid: '#ffd166',
    titleBottom: '#ff5e62',
    titleStroke: '#1a0b2e',
    accent: '#ff9e57',
    neon: '#ff5da2',
    neon2: '#37e6ff',
    band: 'rgba(16, 6, 32, 0.92)',
    duotoneA: '#ff7e5f',
    duotoneB: '#2b1055',
  },
  neon: {
    label: 'Neon Night',
    sky: ['#050514', '#0b1035', '#131a4d', '#3b1d5e', '#7a1e6e'],
    sun: '#ff6ec7',
    sunGlow: 'rgba(255, 110, 199, 0.45)',
    skyline: '#070418',
    skylineFar: '#171238',
    palm: '#05030f',
    car: '#04020c',
    haze: 'rgba(55, 230, 255, 0.12)',
    titleTop: '#eafcff',
    titleMid: '#37e6ff',
    titleBottom: '#ff5da2',
    titleStroke: '#05030f',
    accent: '#37e6ff',
    neon: '#ff5da2',
    neon2: '#37e6ff',
    band: 'rgba(4, 2, 16, 0.93)',
    duotoneA: '#ff5da2',
    duotoneB: '#0b1035',
  },
  dawn: {
    label: 'Pastel Dawn',
    sky: ['#b8c6f2', '#e8b4d9', '#ffc9a3', '#ffe3b3', '#fff6dd'],
    sun: '#fffbe8',
    sunGlow: 'rgba(255, 205, 150, 0.5)',
    skyline: '#6d5a8e',
    skylineFar: '#9787b8',
    palm: '#4c3a6e',
    car: '#3d2d5c',
    haze: 'rgba(255, 255, 255, 0.18)',
    titleTop: '#ffffff',
    titleMid: '#ffd9ec',
    titleBottom: '#ff8fb5',
    titleStroke: '#4c3a6e',
    accent: '#ff8fb5',
    neon: '#ff6fa5',
    neon2: '#7ac8ff',
    band: 'rgba(76, 58, 110, 0.9)',
    duotoneA: '#ffb3c8',
    duotoneB: '#8f7cc0',
  },
};

export function gradeById(id) {
  return GRADES[id] || GRADES.sunset;
}

// Sky: vertical gradient plus a warm haze band low down, plus a few soft
// horizontal cloud streaks that catch the light.
export function drawSky(ctx, w, h, grade, rand) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  const stops = grade.sky;
  for (let i = 0; i < stops.length; i++) {
    sky.addColorStop(i / (stops.length - 1), stops[i]);
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = grade.haze;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 7; i++) {
    const cy = h * (0.08 + rand() * 0.4);
    const cw = w * (0.18 + rand() * 0.3);
    const cx = rand() * w - cw * 0.2;
    const ch = h * (0.012 + rand() * 0.02);
    roundRect(ctx, cx, cy, cw, ch, ch / 2);
    ctx.fill();
  }
  ctx.restore();
}

// Sun disc with a soft glow halo, half-sunk toward the horizon line.
export function drawSun(ctx, w, h, grade, cx, cy, r) {
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.6);
  glow.addColorStop(0, grade.sunGlow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 2.6, cy - r * 2.6, r * 5.2, r * 5.2);
  ctx.fillStyle = grade.sun;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Retro slats cut across the lower half of the disc.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 4; i++) {
    const y = cy + r * (0.15 + i * 0.22);
    ctx.fillRect(cx - r, y, r * 2, r * 0.055);
  }
  ctx.restore();
}

// Two depth layers of downtown towers with lit windows, sitting on horizonY.
export function drawSkyline(ctx, w, h, grade, horizonY, rand, seed) {
  const far = mulberry32(seed + 11);
  const near = mulberry32(seed + 77);
  drawTowerRow(ctx, w, horizonY, grade.skylineFar, far, 0.55, h);
  drawTowerRow(ctx, w, horizonY, grade.skyline, near, 1, h);
  // A few antenna beacons blinking on the tallest far towers.
  ctx.fillStyle = grade.neon2;
  for (let i = 0; i < 5; i++) {
    const bx = w * (0.06 + far() * 0.88);
    ctx.beginPath();
    ctx.arc(bx, horizonY - h * (0.16 + far() * 0.1), Math.max(1.5, w * 0.0016), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTowerRow(ctx, w, horizonY, color, rand, scale, h) {
  ctx.fillStyle = color;
  let x = -w * 0.02;
  while (x < w * 1.02) {
    const tw = w * (0.035 + rand() * 0.075) * scale;
    const th = h * (0.1 + rand() * 0.22) * scale;
    const top = horizonY - th;
    ctx.fillRect(x, top, tw, th);
    // Rooftop antenna on some towers.
    if (rand() < 0.3) {
      ctx.fillRect(x + tw * 0.45, top - th * 0.18, tw * 0.08, th * 0.18);
    }
    // Lit windows: tiny warm rectangles scattered on the facade.
    ctx.save();
    ctx.fillStyle = 'rgba(255, 214, 130, 0.75)';
    const cols = Math.max(2, Math.floor(tw / (w * 0.012)));
    const rows = Math.max(3, Math.floor(th / (h * 0.03)));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rand() < 0.22) {
          ctx.fillRect(x + tw * (0.12 + (c / cols) * 0.76), top + th * (0.08 + (r / rows) * 0.84), Math.max(1.5, w * 0.004), Math.max(1.5, h * 0.008));
        }
      }
    }
    ctx.restore();
    ctx.fillStyle = color;
    x += tw + w * (0.004 + rand() * 0.012);
  }
  // Ground line under the row.
  ctx.fillRect(0, horizonY, w, Math.max(2, h * 0.004));
}

// One palm silhouette: curved trunk, seven drooping fronds.
export function drawPalm(ctx, x, y, s, color, lean, rand) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  // Trunk, slightly bowed.
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(6, -55, 2, -110);
  ctx.stroke();
  // Fronds fan out from the crown.
  const crownX = 2;
  const crownY = -110;
  for (let i = 0; i < 7; i++) {
    const a = (-165 + i * 27.5) * (Math.PI / 180);
    const len = 52 + rand() * 18;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(
      crownX + Math.cos(a) * len * 0.6,
      crownY + Math.sin(a) * len * 0.55 - 14,
      crownX + Math.cos(a) * len,
      crownY + Math.sin(a) * len + 16,
    );
    ctx.stroke();
  }
  // Coconuts.
  ctx.beginPath();
  ctx.arc(crownX - 5, crownY + 4, 4.5, 0, Math.PI * 2);
  ctx.arc(crownX + 6, crownY + 5, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Low sports-car silhouette in profile: long hood, cabin, rear haunch.
export function drawCar(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-150, 0);
  ctx.lineTo(-148, -16);
  ctx.quadraticCurveTo(-120, -22, -88, -24);
  ctx.quadraticCurveTo(-58, -52, -18, -54);
  ctx.quadraticCurveTo(28, -56, 62, -50);
  ctx.quadraticCurveTo(96, -44, 118, -26);
  ctx.quadraticCurveTo(142, -22, 150, -14);
  ctx.lineTo(150, 0);
  ctx.closePath();
  ctx.fill();
  // Wheel cut-outs read as dark arches against the body.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.arc(-92, -2, 24, Math.PI, 0);
  ctx.arc(88, -2, 24, Math.PI, 0);
  ctx.fill();
  // A thin neon underglow line under the chassis.
  ctx.fillStyle = 'rgba(255, 93, 162, 0.85)';
  ctx.fillRect(-150, 2, 300, 3);
  ctx.restore();
}

// Neon sign text: glowing caps with a soft halo, drawn on the scene itself.
export function drawNeonSign(ctx, text, x, y, size, color, glowColor) {
  ctx.save();
  ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = size * 0.55;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = size * 0.18;
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.85;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Film grain: a seeded noise tile stamped at low alpha in overlay mode.
export function drawGrain(ctx, w, h, seed, strength) {
  const tile = 140;
  const off = document.createElement('canvas');
  off.width = tile;
  off.height = tile;
  const octx = off.getContext('2d');
  const img = octx.createImageData(tile, tile);
  const rand = mulberry32(seed + 999);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  const pattern = ctx.createPattern(off, 'repeat');
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// Vignette: darkened corners so the middle of the cover pops.
export function drawVignette(ctx, w, h, strength) {
  const g = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// Halftone dots across a band: the print-poster texture on the title strip.
export function drawHalftone(ctx, x, y, w, h, color, seed) {
  const rand = mulberry32(seed + 4242);
  ctx.save();
  ctx.fillStyle = color;
  const step = Math.max(7, w * 0.011);
  for (let yy = y; yy < y + h; yy += step) {
    for (let xx = x; xx < x + w; xx += step) {
      const r = step * (0.12 + rand() * 0.22);
      ctx.beginPath();
      ctx.arc(xx + step / 2, yy + step / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
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

// Full scene in one call: sky, sun, skyline, palms at the edges, car low.
// The horizon sits just above the title band, so the street strip —
// skyline bases, palms and the car — stays visible between the panels.
export function drawScene(ctx, w, h, grade, seed) {
  const rand = mulberry32(seed);
  const horizonY = h * 0.7;
  drawSky(ctx, w, h, grade, rand);
  drawSun(ctx, w, h, grade, w * 0.72, h * 0.3, Math.min(w, h) * 0.16);
  drawSkyline(ctx, w, h, grade, horizonY, rand, seed);
  // Palms frame the left and right edges, rooted at the horizon line so
  // their fronds lean over the panels without crossing the title band.
  drawPalm(ctx, w * 0.02, h * 0.74, Math.min(w, h) * 0.0028, grade.palm, 0.1, rand);
  drawPalm(ctx, w * 0.09, h * 0.76, Math.min(w, h) * 0.0021, grade.palm, -0.06, rand);
  drawPalm(ctx, w * 0.98, h * 0.74, Math.min(w, h) * 0.0026, grade.palm, -0.12, rand);
  drawPalm(ctx, w * 0.91, h * 0.76, Math.min(w, h) * 0.0019, grade.palm, 0.08, rand);
  // The car cruises the midground strip, just above the horizon line.
  drawCar(ctx, w * 0.5, horizonY - h * 0.012, Math.min(w, h) * 0.0028, grade.car);
}
