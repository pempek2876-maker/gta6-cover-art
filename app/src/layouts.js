// Vice Cover Studio — panel layouts.
//
// A layout is a set of panels that tile the whole cover. Every panel is a
// polygon in normalised coordinates (0..1 across the cover), so the seams
// can run diagonally the way a GTA poster splits its frame. Panels of one
// layout share edge points, so no gap ever shows between them.
//
// Each layout also says where the title block sits: the centre of the
// caption, the centre of the subline above it, and how wide the title may
// run before it wraps. The renderer in cover.js draws the panels first,
// then the title block on top of the seam.

/** The three layouts the editor offers, in menu order. */
export const LAYOUT_IDS = ['hero-split', 'triple-stack', 'duo-band'];

/**
 * One panel: an id, a human label, a polygon, and the photo slot it
 * starts with (0, 1 or 2 — the editor lets the user change it per panel).
 * @typedef {{ id: string, label: string, poly: number[][], slot: number }} PanelDef
 */

/**
 * @typedef {{
 *   id: string, label: string, blurb: string,
 *   panels: PanelDef[],
 *   title: { cx: number, cy: number, align: 'center'|'left', width: number },
 *   subline: { cx: number, align: 'center'|'left' } (its height is derived
 *     from the fitted title size, so it always clears the title)
 * }} LayoutDef
 */

/** @type {Record<string, LayoutDef>} */
export const LAYOUTS = {
  'hero-split': {
    id: 'hero-split',
    label: 'Hero split',
    blurb: 'Big top panel, two panels below',
    panels: [
      {
        id: 'hero', label: 'Hero',
        poly: [[0, 0], [1, 0], [1, 0.58], [0, 0.64]],
        slot: 0,
      },
      {
        id: 'low-left', label: 'Low Left',
        poly: [[0, 0.64], [0.55, 0.58], [0.47, 1], [0, 1]],
        slot: 1,
      },
      {
        id: 'low-right', label: 'Low Right',
        poly: [[0.55, 0.58], [1, 0.58], [1, 1], [0.47, 1]],
        slot: 1,
      },
    ],
    // Title rides the hero seam, centred, so the lettering bridges the panels.
    title: { cx: 0.5, cy: 0.615, align: 'center', width: 0.96 },
    subline: { cx: 0.5, align: 'center' },
  },

  'triple-stack': {
    id: 'triple-stack',
    label: 'Triple stack',
    blurb: 'Three tilted bands, top to bottom',
    panels: [
      {
        id: 'top', label: 'Top',
        poly: [[0, 0], [1, 0], [1, 0.38], [0, 0.42]],
        slot: 0,
      },
      {
        id: 'middle', label: 'Middle',
        poly: [[0, 0.42], [1, 0.38], [1, 0.7], [0, 0.66]],
        slot: 1,
      },
      {
        id: 'bottom', label: 'Bottom',
        poly: [[0, 0.66], [1, 0.7], [1, 1], [0, 1]],
        slot: 0,
      },
    ],
    // Title sits low in the bottom band, where the eye lands last.
    title: { cx: 0.5, cy: 0.87, align: 'center', width: 0.94 },
    subline: { cx: 0.5, align: 'center' },
  },

  'duo-band': {
    id: 'duo-band',
    label: 'Duo band',
    blurb: 'Two tilted halves, side by side',
    panels: [
      {
        id: 'left', label: 'Left',
        poly: [[0, 0], [0.58, 0], [0.46, 1], [0, 1]],
        slot: 0,
      },
      {
        id: 'right', label: 'Right',
        poly: [[0.58, 0], [1, 0], [1, 1], [0.46, 1]],
        slot: 1,
      },
    ],
    // Title runs along the bottom edge, left-aligned, over both halves.
    title: { cx: 0.05, cy: 0.88, align: 'left', width: 0.9 },
    subline: { cx: 0.05, align: 'left' },
  },
};

/**
 * Look a layout up by id, falling back to hero-split for an unknown id
 * (a stale link or a typo in the query string must never blank the app).
 */
export function layoutById(id) {
  return LAYOUTS[id] ?? LAYOUTS['hero-split'];
}

/**
 * A panel polygon scaled from normalised coordinates to cover pixels.
 * Returns the same point order, as [x, y] pairs in pixels.
 */
export function panelPixels(panel, width, height) {
  return panel.poly.map(([nx, ny]) => [nx * width, ny * height]);
}

/**
 * The panel's bounding box in cover pixels: [x, y, w, h].
 * The renderer uses it to size the photo's cover-fit before clipping.
 */
export function panelBox(panel, width, height) {
  const pts = panelPixels(panel, width, height);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return [x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0];
}

/**
 * Point-in-polygon test (ray casting) for normalised coordinates.
 * The editor uses it to work out which panel a click landed in.
 */
export function pointInPanel(nx, ny, panel) {
  const poly = panel.poly;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const crosses = yi > ny !== yj > ny
      && nx < ((xj - xi) * (ny - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}
