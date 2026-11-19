// Vice Cover Studio — shot scenes.
//
// The app is driven by its query string, so a screenshot run can ask for
// one exact scene: which mode (cover / editor / export), which post size,
// layout, grade and caption. This module is the single place that turns
// those parameters into a render plan, so the editor, the cover shot and
// the export shot can never drift apart.
//
//   ?shot=cover|editor|export
//   &size=wide|portrait|square
//   &layout=hero-split|triple-stack|duo-band
//   &grade=neon|sunset|golden
//   &caption=...&subline=...

import { LAYOUT_IDS } from './layouts.js';
import { GRADE_IDS } from './cover.js';

/** The two sample photos shipped with the app (AI-made for make.fun). */
export const SAMPLE_PHOTOS = [
  { id: 'pier', label: 'Pier', src: 'samples/pier.jpg' },
  { id: 'boulevard', label: 'Boulevard', src: 'samples/boulevard.jpg' },
];

/** Post sizes the editor exports at full resolution (the real PNG). */
export const FULL_SIZES = {
  square: { label: 'Square', width: 1080, height: 1080 },
  portrait: { label: 'Portrait', width: 1080, height: 1350 },
  wide: { label: 'Wide', width: 1920, height: 1080 },
};

/**
 * The sizes a screenshot export uses instead: the same shapes, scaled so
 * the file fits the gate (long side at most 1280, short side at least 480).
 * The screenshot export itself is a JPEG at 0.88 (see main.js): a photo
 * cover as PNG runs ~2 MB at this size, past the 256 KiB cap.
 */
export const SHOT_SIZES = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1024, height: 1280 },
  wide: { width: 1280, height: 720 },
};

export const SIZE_IDS = ['square', 'portrait', 'wide'];
export const SHOT_IDS = ['cover', 'editor', 'export'];

/** One of a small set, or the fallback when the value is unknown. */
function pickOne(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/**
 * Read the query string into a shot plan. Every field has a safe
 * default, so a bare index.html with no parameters still opens a
 * working editor.
 */
export function resolveShot(search) {
  const q = new URLSearchParams(search || '');
  const shot = pickOne(q.get('shot'), SHOT_IDS, 'editor');
  const size = pickOne(q.get('size'), SIZE_IDS, 'square');
  const layout = pickOne(q.get('layout'), LAYOUT_IDS, 'hero-split');
  const grade = pickOne(q.get('grade'), GRADE_IDS, 'neon');
  const caption = (q.get('caption') || 'NEON NIGHTS').slice(0, 28);
  const subline = (q.get('subline') || 'OCEAN DRIVE').slice(0, 28);
  return { shot, size, layout, grade, caption, subline };
}

/** The four scenes the entry's screenshots are taken from. */
export const SHOT_SCENES = [
  {
    name: '1-cover.jpg',
    query: '?shot=cover&size=wide&layout=hero-split&grade=neon&caption=NEON%20NIGHTS&subline=OCEAN%20DRIVE',
    width: 1280,
    height: 720,
    note: 'Exported-style cover, wide, neon grade',
  },
  {
    name: '2-editor.jpg',
    query: '?shot=editor&size=portrait&layout=hero-split&grade=sunset&caption=SUNSET%20HEIST&subline=OCEAN%20DRIVE',
    width: 1280,
    height: 720,
    note: 'Editor with a photo loaded, portrait preview',
  },
  {
    name: '3-cover.jpg',
    query: '?shot=export&size=square&layout=triple-stack&grade=sunset&caption=GOLDEN%20GETAWAY&subline=ROUTE%2027',
    width: 1080,
    height: 1080,
    note: 'Exported square cover, triple-stack, sunset grade',
  },
  {
    name: '4-cover.jpg',
    query: '?shot=export&size=portrait&layout=duo-band&grade=golden&caption=PALM%20SHADOWS&subline=AFTER%20DARK',
    width: 1024,
    height: 1280,
    note: 'Exported portrait cover, duo-band, golden grade',
  },
];
