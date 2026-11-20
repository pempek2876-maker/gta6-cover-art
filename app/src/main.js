// main.js — the Vice Cover Studio v2 editor.
//
// Owns the editor state, wires every control to the cover renderer
// (cover.js), and paints the live preview. Photos stay on the machine:
// file inputs are read with FileReader into data URLs, never uploaded.
// In ?shot= mode this module hands over to shots.js, which drives the
// scripted screenshots instead of the editor.

import { defaultState, applyPreset, renderCover, exportAllSizes, SIZES, panelPolys } from './cover.js';
import { GRADES } from './scene.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

if (params.get('shot')) {
  await import('./shots.js');
} else {
  bootEditor();
}

const SAMPLES = [
  { id: 'boulevard', src: 'samples/boulevard.jpg', label: 'Boulevard' },
  { id: 'neon', src: 'samples/neon.jpg', label: 'Neon Street' },
  { id: 'rooftop', src: 'samples/rooftop.jpg', label: 'Rooftop' },
];

let state = defaultState();
let selectedSize = SIZES[0];
let selectedPanel = 0;
let fontsReady = false;

function bootEditor() {
  buildPanelCards();
  buildControlButtons();
  bindTextInputs();
  bindExportButtons();
  bindSliders();
  loadSamplesIntoPanels().then(() => {
    renderPreview();
    setStatus('3 sample photos loaded — drop in your own or hit a preset.');
  });
  document.fonts.load('64px Anton').then(() => {
    fontsReady = true;
    renderPreview();
  }).catch(() => {
    fontsReady = false;
  });
  window.addEventListener('resize', renderPreview);
}

function setStatus(text) {
  const el = $('status');
  if (el) el.textContent = text;
}

// ---- panel cards --------------------------------------------------------

function buildPanelCards() {
  const host = $('panels');
  if (!host) return;
  const names = ['Hero panel', 'Panel 2', 'Panel 3'];
  for (let i = 0; i < 3; i++) {
    const card = document.createElement('section');
    card.className = 'panel-card';
    card.dataset.panel = String(i);
    card.innerHTML =
      `<h3>${names[i]}</h3>` +
      `<label class="file-btn">Choose photo<input type="file" id="file${i}" accept="image/*"></label>` +
      `<button type="button" class="mini-btn" id="clear${i}">Clear</button>` +
      `<div class="sample-row" id="samples${i}"></div>` +
      `<label>Zoom <input type="range" id="zoom${i}" min="1" max="2.5" step="0.01" value="1"></label>` +
      `<label>Left–right <input type="range" id="ox${i}" min="-0.4" max="0.4" step="0.01" value="0"></label>` +
      `<label>Up–down <input type="range" id="oy${i}" min="-0.4" max="0.4" step="0.01" value="0"></label>` +
      `<label>Grade <select id="grade${i}">` +
      `<option value="auto">Match cover</option>` +
      `<option value="photo">Natural photo</option>` +
      `<option value="sunset">Sunset</option>` +
      `<option value="neon">Neon Night</option>` +
      `<option value="dawn">Pastel Dawn</option>` +
      `</select></label>`;
    host.appendChild(card);
    const sampleRow = card.querySelector(`#samples${i}`);
    for (const s of SAMPLES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sample-btn';
      b.textContent = s.label;
      b.addEventListener('click', () => {
        loadImage(s.src).then((img) => {
          state.photos[i].img = img;
          markPanelActive(i);
          renderPreview();
          setStatus(`${s.label} loaded into ${names[i].toLowerCase()}.`);
        });
      });
      sampleRow.appendChild(b);
    }
    $(`file${i}`).addEventListener('change', (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        loadImage(reader.result).then((img) => {
          state.photos[i].img = img;
          state.photos[i].zoom = 1;
          state.photos[i].ox = 0;
          state.photos[i].oy = 0;
          syncPanelInputs(i);
          markPanelActive(i);
          renderPreview();
          setStatus(`${file.name} loaded into ${names[i].toLowerCase()}.`);
        });
      };
      reader.readAsDataURL(file);
    });
    $(`clear${i}`).addEventListener('click', () => {
      state.photos[i].img = null;
      renderPreview();
      setStatus(`${names[i]} cleared.`);
    });
    for (const key of ['zoom', 'ox', 'oy']) {
      $(`${key}${i}`).addEventListener('input', (ev) => {
        state.photos[i][key] = Number(ev.target.value);
        renderPreview();
      });
    }
    $(`grade${i}`).addEventListener('change', (ev) => {
      state.photos[i].grade = ev.target.value;
      renderPreview();
    });
    card.addEventListener('click', () => {
      selectedPanel = i;
      markPanelActive(i);
      renderPreview();
    });
  }
  markPanelActive(0);
}

function syncPanelInputs(i) {
  $(`zoom${i}`).value = String(state.photos[i].zoom);
  $(`ox${i}`).value = String(state.photos[i].ox);
  $(`oy${i}`).value = String(state.photos[i].oy);
  $(`grade${i}`).value = state.photos[i].grade;
}

function markPanelActive(i) {
  selectedPanel = i;
  for (const card of document.querySelectorAll('.panel-card')) {
    card.classList.toggle('active', Number(card.dataset.panel) === i);
  }
}

// ---- buttons, text, sliders --------------------------------------------

function buildControlButtons() {
  for (const btn of document.querySelectorAll('[data-layout]')) {
    btn.addEventListener('click', () => {
      state.layout = btn.dataset.layout;
      markActive('[data-layout]', btn);
      renderPreview();
      setStatus(`Layout: ${btn.textContent.trim()}.`);
    });
  }
  for (const btn of document.querySelectorAll('[data-grade]')) {
    btn.addEventListener('click', () => {
      state.grade = btn.dataset.grade;
      markActive('[data-grade]', btn);
      renderPreview();
      setStatus(`Grade: ${GRADES[btn.dataset.grade].label}.`);
    });
  }
  for (const btn of document.querySelectorAll('[data-preset]')) {
    btn.addEventListener('click', () => {
      applyPreset(state, btn.dataset.preset);
      syncTextInputs();
      markActive('[data-layout]', document.querySelector(`[data-layout="${state.layout}"]`));
      markActive('[data-grade]', document.querySelector(`[data-grade="${state.grade}"]`));
      renderPreview();
      setStatus(`Preset ${btn.textContent.trim()} applied — one click, cover ready.`);
    });
  }
  for (const btn of document.querySelectorAll('[data-size]')) {
    btn.addEventListener('click', () => {
      selectedSize = SIZES.find((s) => s.id === btn.dataset.size) || SIZES[0];
      markActive('[data-size]', btn);
      renderPreview();
      setStatus(`Export size: ${selectedSize.label}.`);
    });
  }
  markActive('[data-layout]', document.querySelector('[data-layout="hero-split"]'));
  markActive('[data-grade]', document.querySelector('[data-grade="sunset"]'));
  markActive('[data-size]', document.querySelector('[data-size="1:1"]'));
}

function markActive(selector, activeBtn) {
  for (const btn of document.querySelectorAll(selector)) {
    btn.classList.toggle('active', btn === activeBtn);
  }
}

function bindTextInputs() {
  $('titleInput').addEventListener('input', (ev) => {
    state.title = ev.target.value.toUpperCase();
    renderPreview();
  });
  $('kickerInput').addEventListener('input', (ev) => {
    state.kicker = ev.target.value.toUpperCase();
    renderPreview();
  });
  $('subtitleInput').addEventListener('input', (ev) => {
    state.subtitle = ev.target.value.toUpperCase();
    renderPreview();
  });
  $('neonInput').addEventListener('input', (ev) => {
    state.neon = ev.target.value.toUpperCase();
    renderPreview();
  });
}

function syncTextInputs() {
  $('titleInput').value = state.title;
  $('kickerInput').value = state.kicker;
  $('subtitleInput').value = state.subtitle;
  $('neonInput').value = state.neon;
}

function bindSliders() {
  $('grainRange').addEventListener('input', (ev) => {
    state.grain = Number(ev.target.value);
    renderPreview();
  });
  $('vignetteRange').addEventListener('input', (ev) => {
    state.vignette = Number(ev.target.value);
    renderPreview();
  });
  $('halftoneCheck').addEventListener('change', (ev) => {
    state.halftone = ev.target.checked;
    renderPreview();
  });
  $('onePhotoAll').addEventListener('change', (ev) => {
    state.onePhotoAll = ev.target.checked;
    renderPreview();
    setStatus(ev.target.checked ? 'One photo fills every panel.' : 'Each panel keeps its own photo.');
  });
}

function bindExportButtons() {
  $('exportBtn').addEventListener('click', () => {
    const canvas = renderCover(state, selectedSize.w, selectedSize.h);
    downloadCanvas(canvas, `vice-cover-${selectedSize.id}.png`);
    setStatus(`Exported ${selectedSize.label} PNG.`);
  });
  $('exportAllBtn').addEventListener('click', () => {
    const all = exportAllSizes(state);
    all.forEach((entry, i) => {
      setTimeout(() => downloadCanvas(entry.canvas, `vice-cover-${entry.id}.png`), i * 350);
    });
    setStatus('Exporting all 4 post sizes — 1:1, 4:5, 9:16, 16:9.');
  });
}

function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
}

// ---- preview ------------------------------------------------------------

function renderPreview() {
  const canvas = $('preview');
  if (!canvas) return;
  const wrap = $('previewWrap');
  const maxW = wrap ? Math.min(wrap.clientWidth - 8, 980) : 900;
  const scale = maxW / selectedSize.w;
  const pw = Math.round(selectedSize.w * scale);
  const ph = Math.round(selectedSize.h * scale);
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext('2d');
  const off = renderCover(state, pw, ph);
  ctx.drawImage(off, 0, 0);
  // Outline the selected panel so drag-pan has a visible target.
  const polys = panelPolys(state.layout, pw, ph);
  const poly = polys[selectedPanel];
  if (poly) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
    ctx.strokeStyle = '#37e6ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.restore();
  }
  if (!fontsReady) {
    // Anton may still be loading; repaint once it arrives.
    document.fonts.ready.then(() => {
      fontsReady = true;
      renderPreview();
    });
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

async function loadSamplesIntoPanels() {
  const loads = SAMPLES.map((s) => loadImage(s.src).catch(() => null));
  const imgs = await Promise.all(loads);
  for (let i = 0; i < 3; i++) {
    if (imgs[i] && !state.photos[i].img) state.photos[i].img = imgs[i];
  }
}

// Shot mode entry: the editor booted with a prebuilt state (from shots.js)
// so the screenshot shows the app with photos already loaded.
export function bootEditorForShot(presetState, size) {
  state = presetState;
  if (size) {
    selectedSize = SIZES.find((s) => s.w === size.w && s.h === size.h) || size;
  }
  bootEditor();
  syncTextInputs();
  for (let i = 0; i < 3; i++) syncPanelInputs(i);
  markActive('[data-size]', document.querySelector(`[data-size="${selectedSize.id}"]`));
  markActive('[data-layout]', document.querySelector(`[data-layout="${state.layout}"]`));
  markActive('[data-grade]', document.querySelector(`[data-grade="${state.grade}"]`));
  setStatus('Editor with photos loaded — pick a preset, then export.');
}

// Drag on the preview pans the photo under the cursor; the wheel zooms it.
function bindPreviewGestures() {
  const canvas = $('preview');
  if (!canvas) return;
  let drag = null;
  canvas.addEventListener('pointerdown', (ev) => {
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const polys = panelPolys(state.layout, canvas.width, canvas.height);
    for (let i = 0; i < polys.length; i++) {
      if (pointInPoly(x, y, polys[i])) {
        selectedPanel = i;
        markPanelActive(i);
        drag = { i, x, y, ox: state.photos[i].ox, oy: state.photos[i].oy };
        canvas.setPointerCapture(ev.pointerId);
        renderPreview();
        break;
      }
    }
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const box = { w: canvas.width, h: canvas.height };
    state.photos[drag.i].ox = clamp(drag.ox + (x - drag.x) / box.w, -0.4, 0.4);
    state.photos[drag.i].oy = clamp(drag.oy + (y - drag.y) / box.h, -0.4, 0.4);
    syncPanelInputs(drag.i);
    renderPreview();
  });
  canvas.addEventListener('pointerup', () => {
    drag = null;
  });
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const photo = state.photos[selectedPanel];
    photo.zoom = clamp(photo.zoom * (ev.deltaY < 0 ? 1.08 : 0.93), 1, 2.5);
    syncPanelInputs(selectedPanel);
    renderPreview();
  }, { passive: false });
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// Gestures bind once the DOM is ready; the editor boots above.
if (!params.get('shot')) {
  window.addEventListener('DOMContentLoaded', bindPreviewGestures);
  if (document.readyState !== 'loading') bindPreviewGestures();
}
