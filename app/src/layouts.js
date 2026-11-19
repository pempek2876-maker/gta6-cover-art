// Panel layouts for the Vice City cover: every layout is a set of polygons
// over the cover rectangle, cut on diagonals the way GTA poster art splits
// its panels. A layout is a function of (width, height) so the same poster
// works in square, portrait and wide export sizes.
//
// A panel: { id, points: [[x, y], ...] (clockwise, cover space),
//            slot: which photo slot fills it by default (0, 1 or 2),
//            caption: 'hero' | 'band' | null — where the big lettering sits }.
// The renderer draws each panel clipped to its polygon, then strokes the
// gutters white so the cuts read as poster seams.

/**
 * Builds the three poster layouts for a cover of size w x h.
 * Returns { id, name, blurb, panels } per layout.
 */
export function buildLayouts(w, h) {
  const heroSplit = {
    id: 'hero-split',
    name: 'Hero Split',
    blurb: 'One big hero photo over two smaller panels, cut on a diagonal.',
    panels: [
      // Hero: full width, bottom edge slopes down to the left.
      { id: 'hero', slot: 0, caption: 'hero',
        points: [[0, 0], [w, 0], [w, h * 0.54], [0, h * 0.63]] },
      // Lower left: under the hero's low edge, right edge slopes.
      { id: 'low-left', slot: 1, caption: null,
        points: [[0, h * 0.63], [w * 0.55, h * 0.54], [w * 0.47, h], [0, h]] },
      // Lower right: fills the rest.
      { id: 'low-right', slot: 2, caption: null,
        points: [[w * 0.55, h * 0.54], [w, h * 0.54], [w, h], [w * 0.47, h]] },
    ],
  };

  const tripleStack = {
    id: 'triple-stack',
    name: 'Triple Stack',
    blurb: 'A tall feature panel beside a column of two, for portrait covers.',
    panels: [
      // Tall left panel, right edge slopes out toward the bottom.
      { id: 'tall', slot: 0, caption: 'hero',
        points: [[0, 0], [w * 0.56, 0], [w * 0.48, h], [0, h]] },
      // Upper right.
      { id: 'top-right', slot: 1, caption: null,
        points: [[w * 0.56, 0], [w, 0], [w, h * 0.46], [w * 0.52, h * 0.52]] },
      // Lower right, top edge slopes up to the right.
      { id: 'bottom-right', slot: 2, caption: null,
        points: [[w * 0.52, h * 0.52], [w, h * 0.46], [w, h], [w * 0.48, h]] },
    ],
  };

  const duoBand = {
    id: 'duo-band',
    name: 'Duo Band',
    blurb: 'Two photos on top, one wide caption band with a skyline below.',
    panels: [
      // Upper left, bottom edge slopes down to the right.
      { id: 'top-left', slot: 0, caption: null,
        points: [[0, 0], [w * 0.53, 0], [w * 0.47, h * 0.60], [0, h * 0.66]] },
      // Upper right.
      { id: 'top-right', slot: 1, caption: null,
        points: [[w * 0.53, 0], [w, 0], [w, h * 0.60], [w * 0.47, h * 0.60]] },
      // Caption band: solid colour, skyline silhouette, big lettering.
      // slot -1 means "no photo": the band is drawn, not filled.
      { id: 'band', slot: -1, caption: 'band',
        points: [[0, h * 0.66], [w * 0.47, h * 0.60], [w, h * 0.60], [w, h], [0, h]] },
    ],
  };

  return [heroSplit, tripleStack, duoBand];
}

/** Finds the layout with this id, defaulting to the first. */
export function pickLayout(w, h, id) {
  const layouts = buildLayouts(w, h);
  return layouts.find((l) => l.id === id) ?? layouts[0];
}

/** Centroid of a polygon, for anchoring captions and labels. */
export function polygonCenter(points) {
  if (!points.length) return [0, 0];
  let x = 0;
  let y = 0;
  for (const [px, py] of points) { x += px; y += py; }
  return [x / points.length, y / points.length];
}
