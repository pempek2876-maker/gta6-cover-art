// shots.js — scripted screenshot scenes for Vice Cover Studio v2.
//
// Loaded instead of the editor when the page opens with ?shot=:
//   ?shot=cover&photo=boulevard&caption=OCEAN%20DRIVE&preset=sunset-heist&size=16:9
//   ?shot=editor&photo=neon&caption=NEON%20NIGHTS
// It renders the requested scene, then sets window.__shot.ready and exposes
// window.__export (a JPEG data URL of the exported cover at shot size) so
// the screenshot driver can save it. Everything is drawn by the app itself.

import { defaultState, applyPreset, renderCover, SIZES } from './cover.js';

const params = new URLSearchParams(location.search);
const SAMPLE_PATHS = {
  boulevard: 'samples/boulevard.jpg',
  neon: 'samples/neon.jpg',
  rooftop: 'samples/rooftop.jpg',
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

function shotSize() {
  const id = params.get('size') || '16:9';
  const found = SIZES.find((s) => s.id === id);
  if (found) return found;
  const [w, h] = id.split('x').map(Number);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return { id, label: `${w} x ${h}`, w, h };
  }
  return SIZES[3];
}

async function buildState() {
  const state = defaultState();
  const preset = params.get('preset') || 'sunset-heist';
  applyPreset(state, preset);
  const caption = params.get('caption');
  if (caption) state.title = caption.toUpperCase();
  const kicker = params.get('kicker');
  if (kicker) state.kicker = kicker.toUpperCase();
  const subtitle = params.get('subtitle');
  if (subtitle) state.subtitle = subtitle.toUpperCase();
  const grade = params.get('grade');
  if (grade) state.grade = grade;
  const layout = params.get('layout');
  if (layout) state.layout = layout;
  const photoId = params.get('photo') || 'boulevard';
  const photo2 = params.get('photo2') || 'neon';
  const photo3 = params.get('photo3') || 'rooftop';
  const [img1, img2, img3] = await Promise.all([
    loadImage(SAMPLE_PATHS[photoId] || SAMPLE_PATHS.boulevard).catch(() => null),
    loadImage(SAMPLE_PATHS[photo2] || SAMPLE_PATHS.neon).catch(() => null),
    loadImage(SAMPLE_PATHS[photo3] || SAMPLE_PATHS.rooftop).catch(() => null),
  ]);
  if (img1) state.photos[0].img = img1;
  if (img2) state.photos[1].img = img2;
  if (img3) state.photos[2].img = img3;
  // Per-panel crop tweaks from the query (?ox2=-0.18 pans that panel's
  // photo left so its subject lands in frame; ?zoom2=1.2 zooms it in).
  for (let i = 0; i < 3; i++) {
    const ox = Number(params.get(`ox${i + 1}`));
    if (Number.isFinite(ox)) state.photos[i].ox = ox;
    const oy = Number(params.get(`oy${i + 1}`));
    if (Number.isFinite(oy)) state.photos[i].oy = oy;
    const zoom = Number(params.get(`zoom${i + 1}`));
    if (Number.isFinite(zoom) && zoom >= 1) state.photos[i].zoom = zoom;
  }
  return state;
}

async function runShot() {
  window.__errors = [];
  window.addEventListener('error', (ev) => {
    window.__errors.push(String(ev.message || ev.error || 'error'));
  });
  try {
    await document.fonts.load('64px Anton');
    await document.fonts.ready;
  } catch {
    // Anton missing: the fallback sans still renders the cover.
  }
  const state = await buildState();
  const mode = params.get('shot');
  const size = shotSize();
  if (mode === 'cover') {
    const canvas = renderCover(state, size.w, size.h);
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.style.background = '#000';
    canvas.style.display = 'block';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.objectFit = 'contain';
    document.body.appendChild(canvas);
    // The exported cover, scaled to the shot size as a JPEG the gate accepts.
    // Step the quality down until it fits the 256 KiB screenshot cap.
    const shot = document.createElement('canvas');
    const scale = Math.min(1, 1280 / Math.max(size.w, size.h));
    shot.width = Math.round(size.w * scale);
    shot.height = Math.round(size.h * scale);
    shot.getContext('2d').drawImage(canvas, 0, 0, shot.width, shot.height);
    let dataUrl = '';
    let quality = 0.9;
    for (const q of [0.9, 0.82, 0.75, 0.65, 0.55]) {
      quality = q;
      dataUrl = shot.toDataURL('image/jpeg', q);
      if (dataUrl.length * 0.75 <= 250000) break;
    }
    window.__export = {
      width: shot.width,
      height: shot.height,
      quality,
      dataUrl,
    };
  } else {
    // Editor scene: show the app with a photo loaded, preview rendered.
    const { bootEditorForShot } = await import('./main.js');
    bootEditorForShot(state, size);
  }
  window.__shot = { ready: true, mode, size: `${size.w}x${size.h}` };
}

runShot().catch((err) => {
  window.__errors = window.__errors || [];
  window.__errors.push(String((err && err.message) || err));
  window.__shot = { ready: false, error: String((err && err.message) || err) };
});
