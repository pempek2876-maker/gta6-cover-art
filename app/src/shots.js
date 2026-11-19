// Fixed scenes for screenshots: ?shot=editor shows the page with sample
// photos loaded; ?shot=cover shows one cover full-screen; ?shot=export
// renders the export PNG and hands the driver a scaled JPEG of it.
// Query params: size=square|portrait|wide, layout=..., grade=...,
// caption=..., subline=..., color=white|sunset|neon.
// window.__shot.ready is set once the scene has painted.
export async function runShot(shot, query, api) {
  const { state, loadImage, redraw, exportJPEGDataURL, refreshSlots, refreshPanelTabs, refreshPanelPhotoSelect, syncZoom } = api;
  const size = query.get('size');
  if (size && api.EXPORT_SIZES?.[size]) state.exportSize = size;
  if (query.get('layout')) state.layoutId = query.get('layout');
  if (query.get('grade')) state.gradeId = query.get('grade');
  if (query.get('caption')) state.caption = query.get('caption');
  if (query.get('subline')) state.subline = query.get('subline');
  if (query.get('color')) state.captionColor = query.get('color');
  const captionInput = document.getElementById('caption');
  const sublineInput = document.getElementById('subline');
  if (captionInput) captionInput.value = state.caption;
  if (sublineInput) sublineInput.value = state.subline;
  document.getElementById('cover-wrap').dataset.size = state.exportSize;

  try {
    await document.fonts.load('100px Anton');
    await document.fonts.ready;
  } catch { /* system sans fallback */ }

  try {
    state.photos[0] = await loadImage('samples/pier.jpg');
    state.photos[0].dataset.label = 'Pier (sample)';
    state.photos[1] = await loadImage('samples/boulevard.jpg');
    state.photos[1].dataset.label = 'Boulevard (sample)';
  } catch (e) {
    window.__errors.push(String(e));
  }

  if (shot === 'cover' || shot === 'export') document.body.classList.add('shot-cover');
  refreshSlots();
  refreshPanelTabs();
  refreshPanelPhotoSelect();
  syncZoom();
  // Re-sync the pick buttons to the scene's choices.
  for (const [sel, id] of [['#layout-pick .pick', state.layoutId], ['#grade-pick .pick', state.gradeId], ['#size-pick .pick', state.exportSize], ['#color-pick .pick', state.captionColor]]) {
    document.querySelectorAll(sel).forEach((b) => b.classList.toggle('active', b.dataset.pickId === id));
  }
  redraw();

  if (shot === 'export') {
    // The exported PNG, scaled to the screenshot limits, as a JPEG.
    let quality = 0.88;
    let shot_out = exportJPEGDataURL(1280, quality);
    while (shot_out.dataUrl.length * 0.75 > 250 * 1024 && quality > 0.55) {
      quality -= 0.08;
      shot_out = exportJPEGDataURL(1280, quality);
    }
    window.__export = { ...shot_out, quality };
  }

  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shot = { ready: true, shot };
  }));
}
