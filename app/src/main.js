// Vice Cover Studio: wires the page. Pick up to three photos (or the samples),
// choose a poster layout and a colour grade, crop each panel by dragging it,
// write the caption, export a PNG. Photos are read on this machine only and
// never leave it; the app makes no network request at all.
import { drawCoverArt, GRADES, CAPTION_COLORS } from './cover.js';
import { buildLayouts } from './layouts.js';
import { runShot } from './shots.js';

export const EXPORT_SIZES = {
  square: { name: 'Square · 1080 x 1080', w: 1080, h: 1080 },
  portrait: { name: 'Portrait · 1080 x 1350', w: 1080, h: 1350 },
  wide: { name: 'Wide · 1920 x 1080', w: 1920, h: 1080 },
};

const SURPRISE_CAPTIONS = [
  ['NEON NIGHTS', 'OCEAN DRIVE'],
  ['SUNSET HEIST', 'VICE CITY'],
  ['PALM SHADOWS', 'AFTER DARK'],
  ['CHROME DREAMS', 'MIAMI HEAT'],
  ['MIDNIGHT RUN', 'SOUTH BEACH'],
  ['GOLDEN GETAWAY', 'ROUTE 27'],
];

const state = {
  layoutId: 'hero-split',
  photos: [null, null, null],
  assign: {},
  crops: {},
  gradeId: 'sunset',
  caption: 'SUNSET HEIST',
  subline: 'OCEAN DRIVE',
  captionColor: 'white',
  captionScale: 1,
  exportSize: 'portrait',
  activePanel: 'hero',
};

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));

function setStatus(text) { statusEl.textContent = text; }

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** The panels of the current layout at the current export size. */
function currentPanels() {
  const size = EXPORT_SIZES[state.exportSize];
  return buildLayouts(size.w, size.h).find((l) => l.id === state.layoutId).panels;
}

function redraw() {
  const size = EXPORT_SIZES[state.exportSize];
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  const ctx = canvas.getContext('2d');
  drawCoverArt(ctx, size.w, size.h, state);
}

/** Renders the cover at full export size on a fresh canvas and returns it. */
export function renderExport() {
  const size = EXPORT_SIZES[state.exportSize];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCoverArt(off.getContext('2d'), size.w, size.h, state);
  return off;
}

/** The export as a PNG blob. */
export function exportPNG() {
  return new Promise((resolve) => renderExport().toBlob(resolve, 'image/png'));
}

/** Scales the full-size export to a JPEG data URL within maxSide, for shots. */
export function exportJPEGDataURL(maxSide = 1280, quality = 0.88) {
  const src = renderExport();
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  const tw = Math.max(1, Math.round(src.width * scale));
  const th = Math.max(1, Math.round(src.height * scale));
  const out = document.createElement('canvas');
  out.width = tw;
  out.height = th;
  out.getContext('2d').drawImage(src, 0, 0, tw, th);
  return { dataUrl: out.toDataURL('image/jpeg', quality), width: tw, height: th };
}

// ---- photo slots -----------------------------------------------------------

const slotNames = ['Photo 1', 'Photo 2', 'Photo 3'];
const slotEls = [0, 1, 2].map((i) => document.getElementById(`slot-${i}`));

function refreshSlots() {
  slotEls.forEach((el, i) => {
    el.classList.toggle('empty', !state.photos[i]);
    el.querySelector('.thumb').textContent = state.photos[i] ? '✓' : '+';
    el.querySelector('.slot-label').textContent =
      state.photos[i] ? (state.photos[i].dataset.label || slotNames[i]) : `${slotNames[i]} — empty`;
  });
  refreshPanelPhotoSelect();
}

async function setSlot(i, img, label) {
  img.dataset.label = label;
  state.photos[i] = img;
  refreshSlots();
  redraw();
}

slotEls.forEach((el, i) => {
  el.querySelector('input[type=file]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const img = await loadImage(URL.createObjectURL(file));
      await setSlot(i, img, file.name.replace(/\.[^.]+$/, '').slice(0, 18) || slotNames[i]);
      setStatus(`${slotNames[i]} loaded: ${file.name}`);
    } catch {
      setStatus(`Could not read ${file.name} as an image.`);
    }
    e.target.value = '';
  });
});

document.getElementById('sample-pier').addEventListener('click', async () => {
  state.photos[0] = await loadImage('samples/pier.jpg');
  state.photos[0].dataset.label = 'Pier (sample)';
  refreshSlots(); redraw();
  setStatus('Sample photo loaded into Photo 1.');
});
document.getElementById('sample-boulevard').addEventListener('click', async () => {
  state.photos[1] = await loadImage('samples/boulevard.jpg');
  state.photos[1].dataset.label = 'Boulevard (sample)';
  refreshSlots(); redraw();
  setStatus('Sample photo loaded into Photo 2.');
});

// ---- panels: pick one, choose its photo, crop by dragging ------------------

const panelTabsEl = document.getElementById('panel-tabs');
const panelPhotoEl = document.getElementById('panel-photo');
const zoomEl = document.getElementById('panel-zoom');
const zoomValEl = document.getElementById('zoom-val');

function refreshPanelTabs() {
  panelTabsEl.innerHTML = '';
  for (const panel of currentPanels()) {
    if (panel.slot === -1) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = panel.id.replace('-', ' ');
    b.className = panel.id === state.activePanel ? 'tab active' : 'tab';
    b.addEventListener('click', () => { state.activePanel = panel.id; refreshPanelTabs(); refreshPanelPhotoSelect(); syncZoom(); });
    panelTabsEl.appendChild(b);
  }
  if (!currentPanels().some((p) => p.id === state.activePanel && p.slot !== -1)) {
    state.activePanel = currentPanels().find((p) => p.slot !== -1)?.id ?? 'hero';
  }
}

function refreshPanelPhotoSelect() {
  const panel = currentPanels().find((p) => p.id === state.activePanel);
  if (!panel) return;
  const current = state.assign[panel.id] ?? panel.slot;
  panelPhotoEl.innerHTML = '';
  const opts = [
    [-1, 'Empty panel'],
    ...state.photos.map((img, i) => [i, img ? (img.dataset.label || slotNames[i]) : `${slotNames[i]} (empty)`]),
  ];
  for (const [value, label] of opts) {
    const o = document.createElement('option');
    o.value = String(value);
    o.textContent = label;
    if (value === current) o.selected = true;
    panelPhotoEl.appendChild(o);
  }
}

panelPhotoEl.addEventListener('change', () => {
  state.assign[state.activePanel] = Number(panelPhotoEl.value);
  redraw();
});

function cropOf(panelId) {
  return (state.crops[panelId] ??= { zoom: 1, ox: 0, oy: 0 });
}

function syncZoom() {
  const crop = cropOf(state.activePanel);
  zoomEl.value = String(crop.zoom);
  zoomValEl.textContent = `${crop.zoom.toFixed(2)}x`;
}

zoomEl.addEventListener('input', () => {
  cropOf(state.activePanel).zoom = Number(zoomEl.value);
  syncZoom();
  redraw();
});

document.getElementById('crop-reset').addEventListener('click', () => {
  state.crops[state.activePanel] = { zoom: 1, ox: 0, oy: 0 };
  syncZoom();
  redraw();
  setStatus('Crop reset for this panel.');
});

// Drag the preview to pan the active panel's photo.
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  drag = { x: e.clientX, y: e.clientY, rect, crop: { ...cropOf(state.activePanel) } };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const size = EXPORT_SIZES[state.exportSize];
  const panel = currentPanels().find((p) => p.id === state.activePanel);
  if (!panel) return;
  const boxW = Math.max(...panel.points.map((p) => p[0])) - Math.min(...panel.points.map((p) => p[0]));
  const boxH = Math.max(...panel.points.map((p) => p[1])) - Math.min(...panel.points.map((p) => p[1]));
  const dx = ((e.clientX - drag.x) / drag.rect.width) * size.w;
  const dy = ((e.clientY - drag.y) / drag.rect.height) * size.h;
  const crop = cropOf(state.activePanel);
  crop.ox = Math.max(-0.45, Math.min(0.45, drag.crop.ox + dx / boxW));
  crop.oy = Math.max(-0.45, Math.min(0.45, drag.crop.oy + dy / boxH));
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });

// ---- layout, grade, caption, size ------------------------------------------

const layoutEl = document.getElementById('layout-pick');
for (const layout of buildLayouts(1080, 1350)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pick' + (layout.id === state.layoutId ? ' active' : '');
  b.textContent = layout.name;
  b.title = layout.blurb;
  b.dataset.pickId = layout.id;
  b.addEventListener('click', () => {
    state.layoutId = layout.id;
    layoutEl.querySelectorAll('.pick').forEach((x) => x.classList.toggle('active', x === b));
    refreshPanelTabs(); refreshPanelPhotoSelect(); syncZoom();
    redraw();
  });
  layoutEl.appendChild(b);
}

const gradeEl = document.getElementById('grade-pick');
for (const grade of GRADES) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pick grade-' + grade.id + (grade.id === state.gradeId ? ' active' : '');
  b.textContent = grade.name;
  b.title = grade.blurb;
  b.dataset.pickId = grade.id;
  b.addEventListener('click', () => {
    state.gradeId = grade.id;
    gradeEl.querySelectorAll('.pick').forEach((x) => x.classList.toggle('active', x === b));
    redraw();
  });
  gradeEl.appendChild(b);
}

const captionEl = document.getElementById('caption');
const sublineEl = document.getElementById('subline');
captionEl.addEventListener('input', () => { state.caption = captionEl.value; redraw(); });
sublineEl.addEventListener('input', () => { state.subline = sublineEl.value; redraw(); });

const colorEl = document.getElementById('color-pick');
for (const color of CAPTION_COLORS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pick' + (color.id === state.captionColor ? ' active' : '');
  b.textContent = color.name;
  b.dataset.pickId = color.id;
  b.addEventListener('click', () => {
    state.captionColor = color.id;
    colorEl.querySelectorAll('.pick').forEach((x) => x.classList.toggle('active', x === b));
    redraw();
  });
  colorEl.appendChild(b);
}

const scaleEl = document.getElementById('caption-scale');
scaleEl.addEventListener('input', () => {
  state.captionScale = Number(scaleEl.value);
  document.getElementById('scale-val').textContent = `${state.captionScale.toFixed(2)}x`;
  redraw();
});

const sizeEl = document.getElementById('size-pick');
for (const [id, size] of Object.entries(EXPORT_SIZES)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pick' + (id === state.exportSize ? ' active' : '');
  b.textContent = size.name;
  b.dataset.pickId = id;
  b.addEventListener('click', () => {
    state.exportSize = id;
    sizeEl.querySelectorAll('.pick').forEach((x) => x.classList.toggle('active', x === b));
    document.getElementById('cover-wrap').dataset.size = id;
    refreshPanelTabs(); refreshPanelPhotoSelect();
    redraw();
  });
  sizeEl.appendChild(b);
}

document.getElementById('surprise').addEventListener('click', () => {
  const layouts = buildLayouts(1080, 1350);
  state.layoutId = layouts[Math.floor(Math.random() * layouts.length)].id;
  state.gradeId = GRADES[Math.floor(Math.random() * GRADES.length)].id;
  state.captionColor = CAPTION_COLORS[Math.floor(Math.random() * CAPTION_COLORS.length)].id;
  const [cap, sub] = SURPRISE_CAPTIONS[Math.floor(Math.random() * SURPRISE_CAPTIONS.length)];
  state.caption = cap;
  state.subline = sub;
  captionEl.value = cap;
  sublineEl.value = sub;
  // Re-sync the pick buttons.
  layoutEl.querySelectorAll('.pick').forEach((x, i) => x.classList.toggle('active', layouts[i].id === state.layoutId));
  gradeEl.querySelectorAll('.pick').forEach((x, i) => x.classList.toggle('active', GRADES[i].id === state.gradeId));
  colorEl.querySelectorAll('.pick').forEach((x, i) => x.classList.toggle('active', CAPTION_COLORS[i].id === state.captionColor));
  refreshPanelTabs(); refreshPanelPhotoSelect();
  redraw();
  setStatus(`Surprise: ${cap} — ${state.gradeId} grade.`);
});

document.getElementById('export').addEventListener('click', async () => {
  const size = EXPORT_SIZES[state.exportSize];
  const blob = await exportPNG();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vice-cover-${size.w}x${size.h}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  setStatus(`Saved vice-cover-${size.w}x${size.h}.png (${(blob.size / 1024).toFixed(0)} KiB).`);
});

// ---- boot ------------------------------------------------------------------

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
window.__cover = { state, redraw, renderExport, exportPNG, exportJPEGDataURL, EXPORT_SIZES };

async function boot() {
  try {
    await document.fonts.load('100px Anton');
    await document.fonts.ready;
  } catch { /* fall back to the system sans if Anton fails */ }
  if (!shot) {
    // First paint already looks like a poster: load both samples.
    try {
      state.photos[0] = await loadImage('samples/pier.jpg');
      state.photos[0].dataset.label = 'Pier (sample)';
      state.photos[1] = await loadImage('samples/boulevard.jpg');
      state.photos[1].dataset.label = 'Boulevard (sample)';
    } catch (e) { window.__errors.push(String(e)); }
    refreshSlots();
    refreshPanelTabs();
    refreshPanelPhotoSelect();
    syncZoom();
    redraw();
  }
}

if (shot) {
  runShot(shot, query, { state, loadImage, redraw, exportJPEGDataURL, setStatus, refreshSlots, refreshPanelTabs, refreshPanelPhotoSelect, syncZoom, EXPORT_SIZES });
} else {
  boot();
}
