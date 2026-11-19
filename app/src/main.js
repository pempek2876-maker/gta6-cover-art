// Vice Cover Studio — app entry point.
//
// Owns the editor state (photos, per-panel crops, layout, grade,
// caption), wires the controls in index.html to it, and repaints the
// canvas on every change. It also serves the three screenshot modes
// (?shot=cover / editor / export) and reports back through
// window.__shot / window.__export, which the screenshot driver reads.

import { LAYOUTS, layoutById, pointInPanel } from './layouts.js';
import { drawCover } from './cover.js';
import { FULL_SIZES, SAMPLE_PHOTOS, SHOT_SIZES, resolveShot } from './shots.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

/** Errors the page hit while starting up, for the screenshot driver. */
window.__errors = [];
window.__shot = { ready: false };

/** The whole editor state in one place. */
const state = {
  layoutId: 'hero-split',
  gradeId: 'neon',
  caption: 'NEON NIGHTS',
  subline: 'OCEAN DRIVE',
  sizeId: 'square',
  /** Loaded photos: { id, label, img } — at most three. */
  photos: [],
  /** Per-panel crop, keyed by panel id so it survives layout switches. */
  crops: new Map(),
  selectedPanel: 0,
};

/** A panel's crop, creating the default (slot from the layout) on demand. */
function cropFor(panel) {
  let crop = state.crops.get(panel.id);
  if (!crop) {
    crop = { slot: panel.slot, zoom: 1, panX: 0, panY: 0 };
    state.crops.set(panel.id, crop);
  }
  return crop;
}

/** The drawCover state for the current layout and photos. */
function coverState() {
  const layout = layoutById(state.layoutId);
  return {
    layoutId: state.layoutId,
    gradeId: state.gradeId,
    caption: state.caption,
    subline: state.subline,
    panels: layout.panels.map((panel) => {
      const crop = cropFor(panel);
      return {
        photo: state.photos[crop.slot]?.img ?? null,
        zoom: crop.zoom,
        panX: crop.panX,
        panY: crop.panY,
      };
    }),
  };
}

/** Load one image file, resolving to null (not rejecting) on failure. */
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      window.__errors.push(`could not load ${src}`);
      resolve(null);
    };
    img.src = src;
  });
}

/** Load the bundled sample photos into the first slots. */
async function loadSamples() {
  for (const sample of SAMPLE_PHOTOS) {
    if (state.photos.length >= 3) break;
    if (state.photos.some((p) => p.id === sample.id)) continue;
    const img = await loadImage(sample.src);
    if (img) state.photos.push({ id: sample.id, label: `${sample.label} (sample)`, img });
  }
}

/** Load a user-chosen file into the next free slot. */
async function addUserPhoto(file) {
  if (state.photos.length >= 3) {
    window.__errors.push('photo slots are full (3 max)');
    return;
  }
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  if (!img) return;
  state.photos.push({
    id: `user-${Date.now()}`,
    label: file.name.replace(/\.[^.]+$/, '').slice(0, 18) || 'Your photo',
    img,
  });
  refreshPhotoUI();
  repaint();
}

/** Paint the visible canvas at its current backing size. */
function repaint() {
  drawCover(ctx, canvas.width, canvas.height, coverState());
}

/** Size the visible canvas for the current mode, then repaint. */
function sizeCanvas(shot) {
  if (shot === 'cover' || shot === 'export') {
    if (shot === 'cover') {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    } else {
      const s = SHOT_SIZES[state.sizeId];
      canvas.width = s.width;
      canvas.height = s.height;
    }
  } else {
    const s = FULL_SIZES[state.sizeId];
    canvas.width = s.width;
    canvas.height = s.height;
  }
  repaint();
}

// ------------------------------------------------------------------ controls

const $ = (id) => document.getElementById(id);

/** The three photo slots under "Photos". */
function refreshPhotoUI() {
  const box = $('photo-slots');
  box.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const photo = state.photos[i];
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = `slot${photo ? ' filled' : ''}`;
    slot.innerHTML = photo
      ? `<span class="tick" aria-hidden="true">&#10003;</span><span>${escapeHtml(photo.label)}</span>`
      : '<span class="plus" aria-hidden="true">+</span><span>Photo ' + (i + 1) + ' — empty</span>';
    slot.title = photo ? `Use ${photo.label} in the selected panel` : 'Empty slot';
    slot.addEventListener('click', () => {
      if (!photo) {
        $('photo-file').click();
        return;
      }
      const layout = layoutById(state.layoutId);
      const panel = layout.panels[state.selectedPanel];
      cropFor(panel).slot = i;
      refreshPanelUI();
      repaint();
    });
    box.appendChild(slot);
  }
}

/** Panel tabs + the per-panel controls (photo select, zoom). */
function refreshPanelUI() {
  const layout = layoutById(state.layoutId);
  const tabs = $('panel-tabs');
  tabs.innerHTML = '';
  layout.panels.forEach((panel, i) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `btn${i === state.selectedPanel ? ' active' : ''}`;
    tab.setAttribute('role', 'tab');
    tab.textContent = panel.label;
    tab.addEventListener('click', () => {
      state.selectedPanel = i;
      refreshPanelUI();
    });
    tabs.appendChild(tab);
  });

  const panel = layout.panels[state.selectedPanel];
  const crop = cropFor(panel);
  const select = $('panel-photo');
  select.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = photo.label;
    select.appendChild(opt);
  });
  if (state.photos.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No photo yet';
    select.appendChild(opt);
  }
  select.value = String(crop.slot);
  $('zoom').value = String(crop.zoom);
  $('zoom-value').textContent = `${crop.zoom.toFixed(2)}×`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Wire every control in the sidebar to the state. */
function wireControls(plan) {
  $('layout').value = state.layoutId;
  $('layout').addEventListener('change', (e) => {
    state.layoutId = e.target.value;
    state.selectedPanel = 0;
    refreshPanelUI();
    repaint();
  });

  $('grade').value = state.gradeId;
  $('grade').addEventListener('change', (e) => {
    state.gradeId = e.target.value;
    repaint();
  });

  $('caption').value = state.caption;
  $('caption').addEventListener('input', (e) => {
    state.caption = e.target.value.toUpperCase();
    repaint();
  });

  $('subline').value = state.subline;
  $('subline').addEventListener('input', (e) => {
    state.subline = e.target.value.toUpperCase();
    repaint();
  });

  $('export-size').value = state.sizeId;
  $('export-size').addEventListener('change', (e) => {
    state.sizeId = e.target.value;
    sizeCanvas(plan.shot);
  });

  $('panel-photo').addEventListener('change', (e) => {
    const layout = layoutById(state.layoutId);
    cropFor(layout.panels[state.selectedPanel]).slot = Number(e.target.value);
    refreshPhotoUI();
    repaint();
  });

  $('zoom').addEventListener('input', (e) => {
    const layout = layoutById(state.layoutId);
    const crop = cropFor(layout.panels[state.selectedPanel]);
    crop.zoom = Number(e.target.value);
    $('zoom-value').textContent = `${crop.zoom.toFixed(2)}×`;
    repaint();
  });

  $('reset-crop').addEventListener('click', () => {
    const layout = layoutById(state.layoutId);
    const crop = cropFor(layout.panels[state.selectedPanel]);
    crop.zoom = 1;
    crop.panX = 0;
    crop.panY = 0;
    refreshPanelUI();
    repaint();
  });

  $('photo-file').addEventListener('change', (e) => {
    addUserPhoto(e.target.files?.[0]);
    e.target.value = '';
  });

  $('sample-pier').addEventListener('click', async () => {
    if (!state.photos.some((p) => p.id === 'pier')) {
      const img = await loadImage('samples/pier.jpg');
      if (img) state.photos.push({ id: 'pier', label: 'Pier (sample)', img });
    }
    refreshPhotoUI();
    refreshPanelUI();
    repaint();
  });

  $('sample-boulevard').addEventListener('click', async () => {
    if (!state.photos.some((p) => p.id === 'boulevard')) {
      const img = await loadImage('samples/boulevard.jpg');
      if (img) state.photos.push({ id: 'boulevard', label: 'Boulevard (sample)', img });
    }
    refreshPhotoUI();
    refreshPanelUI();
    repaint();
  });

  $('download').addEventListener('click', () => {
    const size = FULL_SIZES[state.sizeId];
    const off = document.createElement('canvas');
    off.width = size.width;
    off.height = size.height;
    drawCover(off.getContext('2d'), size.width, size.height, coverState());
    off.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vice-cover-${state.sizeId}-${size.width}x${size.height}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, 'image/png');
  });

  wireDragging();
}

// ------------------------------------------------------------------ dragging

/** Drag a panel to pan its photo; a plain click selects the panel. */
function wireDragging() {
  let drag = null;
  const toCanvas = (e) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (document.body.classList.contains('cover-mode')) return;
    const p = toCanvas(e);
    const layout = layoutById(state.layoutId);
    const hit = layout.panels.findIndex((panel) =>
      pointInPanel(p.x / canvas.width, p.y / canvas.height, panel));
    if (hit < 0) return;
    state.selectedPanel = hit;
    refreshPanelUI();
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('dragging');
    drag = { panel: layout.panels[hit], start: p, moved: false };
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toCanvas(e);
    const dx = p.x - drag.start.x;
    const dy = p.y - drag.start.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    if (!drag.moved) return;
    const crop = cropFor(drag.panel);
    crop.panX = Math.max(-0.5, Math.min(0.5, crop.panX + dx / canvas.width));
    crop.panY = Math.max(-0.5, Math.min(0.5, crop.panY + dy / canvas.height));
    drag.start = p;
    repaint();
  });

  const endDrag = () => {
    drag = null;
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
}

// ------------------------------------------------------------------ boot

/**
 * Start the app: read the shot plan, load the Anton display font and the
 * sample photos, then paint and announce readiness to the driver.
 */
async function boot() {
  const plan = resolveShot(window.location.search);
  state.layoutId = plan.layout;
  state.gradeId = plan.grade;
  state.caption = plan.caption;
  state.subline = plan.subline;
  state.sizeId = plan.size;

  if (plan.shot === 'cover') document.body.classList.add('cover-mode');
  if (plan.shot === 'export') document.body.classList.add('export-mode');

  try {
    await document.fonts.load('100px Anton');
    await document.fonts.ready;
  } catch (err) {
    window.__errors.push(`font load failed: ${err.message}`);
  }

  await loadSamples();
  wireControls(plan);
  refreshPhotoUI();
  refreshPanelUI();
  sizeCanvas(plan.shot);

  if (plan.shot === 'export') {
    // The screenshot export is a JPEG: a photographic cover as PNG runs
    // ~2 MB at 1080x1080 (past the gate's 256 KiB screenshot cap), while
    // JPEG at 0.88 lands near 200 KB. The gate accepts PNG or JPEG, and
    // the Download button still writes the product's real PNG.
    const size = SHOT_SIZES[state.sizeId];
    window.__export = {
      width: size.width,
      height: size.height,
      quality: 0.88,
      dataUrl: canvas.toDataURL('image/jpeg', 0.88),
    };
  }

  window.__shot.ready = true;
}

boot().catch((err) => {
  window.__errors.push(`boot failed: ${err.message}`);
});
