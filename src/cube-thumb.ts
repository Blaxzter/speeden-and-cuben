/**
 * Static cube diagrams for the case grid.
 *
 * The grid used to mount a real <twisty-player> per card: 41 live Three.js
 * scenes, each with orbit controls, a drag tracker and a resize observer, to
 * draw 41 pictures that never move. Nothing in the grid animates — the players
 * are paused on their case, hint stickers are off, and the detail panel owns
 * every control — so the cards are drawn here as inert SVG instead.
 *
 * "The same picture" is meant literally. Every constant below is quoted from
 * cubing.js so that a card looks like the player it replaced; the comments say
 * where each one comes from. cubing.js draws the cube with unlit
 * MeshBasicMaterial, which is what makes this reproducible at all: a sticker is
 * one flat colour, with no lighting term to imitate.
 */

// --------------------------------------------------------------- geometry
//
// cubing.js coordinates: +x is R, +y is U, +z is F. Cubie centres sit at
// -1/0/1 on each axis and the whole cube is then scaled by CUBE_SCALE, so the
// assembled block spans -0.5..0.5.

/** Cube3D.ts: `this.scale.set(CUBE_SCALE, …)` with `CUBE_SCALE = 1 / 3`. */
const CUBE_SCALE = 1 / 3;
/** Cube3D.ts `cubieDimensions.stickerElevation` — how far a sticker floats off the cubie centre. */
const STICKER_ELEVATION = 0.503;
/** Cube3D.ts `DEFAULT_STICKER_SCALE`, applied to a 1x1 sticker quad. */
const FACELET_SCALE = 0.85;
/** Cube3D.ts: each cubie foundation box is `scale.setScalar(0.99)` of a 1x1x1 box. */
const FOUNDATION_SCALE = 0.99;

/** OrbitCoordinatesProp.ts `cubeCube3DCameraOrbitCoordinates`. */
const CAMERA = { latitude: 35, longitude: 30, distance: 6 };
/** Twisty3DVantage.ts: `new ThreePerspectiveCamera(20, aspectRatio, 0.1, 20)`. */
const FOV_DEGREES = 20;

const DEG = Math.PI / 180;

type Vec3 = readonly [number, number, number];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * Three's Spherical measures phi from +y and theta round the y axis, and
 * `setCameraFromOrbitCoordinates` feeds it `(90 - latitude, longitude)`.
 */
const EYE: Vec3 = (() => {
  const phi = (90 - CAMERA.latitude) * DEG;
  const theta = CAMERA.longitude * DEG;
  const r = CAMERA.distance;
  return [r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.cos(theta)];
})();

// `camera.lookAt(0, 0, 0)` with the default up vector, as a view basis.
const ZAXIS = norm(EYE); // points back towards the camera
const XAXIS = norm(cross([0, 1, 0], ZAXIS));
const YAXIS = cross(ZAXIS, XAXIS);

/** Half-height of the frustum at unit depth. The thumb is square, so aspect is 1. */
const FOCAL = 1 / Math.tan((FOV_DEGREES * DEG) / 2);

/** The SVG user-space box. NDC [-1, 1] maps across it, matching the canvas the player filled. */
const VIEW = 100;

/** Project a point in cube space to SVG user space. */
function project(p: Vec3): [number, number] {
  const d = sub([p[0] * CUBE_SCALE, p[1] * CUBE_SCALE, p[2] * CUBE_SCALE], EYE);
  const depth = -dot(d, ZAXIS); // the camera looks down its own -z
  const ndcX = (FOCAL * dot(d, XAXIS)) / depth;
  const ndcY = (FOCAL * dot(d, YAXIS)) / depth;
  return [(ndcX + 1) * (VIEW / 2), (1 - ndcY) * (VIEW / 2)];
}

const pt = ([x, y]: [number, number]) => `${x.toFixed(2)},${y.toFixed(2)}`;

// --------------------------------------------------------------- stickers
//
// Only the U, F and R faces are ever visible from this camera, and hint
// stickers are off, so the diagram is 27 squares. Each one is fixed in space:
// what a case changes is only its colour.

/** The three visible faces, with the axes that span a sticker on each. */
const FACES = {
  U: { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  F: { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  R: { normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
} as const satisfies Record<string, { normal: Vec3; u: Vec3; v: Vec3 }>;

export type VisibleFace = keyof typeof FACES;

/**
 * Where each visible sticker lives, and which facelet of the puzzle it is.
 *
 * `slot` indexes cubing.js's `pieceDefs` for the orbit and `facelet` indexes
 * that slot's own stickers. cubing.js names each slot by its faces in facelet
 * order ("UFR", "ULF", "FR", ...), so a slot's name gives both: the sticker on
 * face X of slot S is facelet `S.name.indexOf(X)`. The names are quoted below
 * so that stays checkable by eye.
 */
export type Sticker = {
  face: VisibleFace;
  /** Cubie centre, in cubie units. */
  at: Vec3;
  orbit: "CORNERS" | "EDGES" | "CENTERS";
  slot: number;
  facelet: number;
};

/** cubing.js `pieceDefs`, in order. The letters are the facelet order. */
export const SLOT_NAMES = {
  CORNERS: ["UFR", "URB", "UBL", "ULF", "DRF", "DFL", "DLB", "DBR"],
  EDGES: ["UF", "UR", "UB", "UL", "DF", "DR", "DB", "DL", "FR", "FL", "BR", "BL"],
  CENTERS: ["U", "L", "F", "R", "B", "D"],
} as const;

function stickerAt(face: VisibleFace, at: Vec3): Sticker {
  const touching = at.filter((v) => v !== 0).length;
  const orbit = touching === 3 ? "CORNERS" : touching === 2 ? "EDGES" : "CENTERS";
  // Name the cubie by the faces it touches, then find the slot holding that set
  // of letters — the same cubie, however cubing.js happens to order them.
  const letters = [
    at[1] > 0 ? "U" : at[1] < 0 ? "D" : "",
    at[2] > 0 ? "F" : at[2] < 0 ? "B" : "",
    at[0] > 0 ? "R" : at[0] < 0 ? "L" : "",
  ].join("");
  const names: readonly string[] = SLOT_NAMES[orbit];
  const slot = names.findIndex(
    (n) => n.length === letters.length && [...n].every((c) => letters.includes(c)),
  );
  if (slot < 0) throw new Error(`no ${orbit} slot for ${letters}`);
  return { face, at, orbit, slot, facelet: names[slot].indexOf(face) };
}

const U_CELLS: Vec3[] = [
  [-1, 1, -1], [0, 1, -1], [1, 1, -1],
  [-1, 1, 0], [0, 1, 0], [1, 1, 0],
  [-1, 1, 1], [0, 1, 1], [1, 1, 1],
];
const F_CELLS: Vec3[] = [
  [-1, 1, 1], [0, 1, 1], [1, 1, 1],
  [-1, 0, 1], [0, 0, 1], [1, 0, 1],
  [-1, -1, 1], [0, -1, 1], [1, -1, 1],
];
const R_CELLS: Vec3[] = [
  [1, 1, 1], [1, 1, 0], [1, 1, -1],
  [1, 0, 1], [1, 0, 0], [1, 0, -1],
  [1, -1, 1], [1, -1, 0], [1, -1, -1],
];

/**
 * The 27 visible stickers: U, then F, then R, each face read left-to-right and
 * top-to-bottom as drawn. The order is arbitrary but shared — the generated
 * colour strings in `src/data/thumbs.generated.ts` are indexed by it.
 */
export const VISIBLE: Sticker[] = [
  ...U_CELLS.map((at) => stickerAt("U", at)),
  ...F_CELLS.map((at) => stickerAt("F", at)),
  ...R_CELLS.map((at) => stickerAt("R", at)),
];

/** The four corners of a sticker's quad, in cube space. */
function stickerQuad(s: Sticker): Vec3[] {
  const { normal, u, v } = FACES[s.face];
  const h = FACELET_SCALE / 2;
  const c: Vec3 = [
    s.at[0] + normal[0] * STICKER_ELEVATION,
    s.at[1] + normal[1] * STICKER_ELEVATION,
    s.at[2] + normal[2] * STICKER_ELEVATION,
  ];
  const offsets: [number, number][] = [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ];
  return offsets.map(
    ([a, b]) =>
      [
        c[0] + u[0] * a + v[0] * b,
        c[1] + u[1] * a + v[1] * b,
        c[2] + u[2] * a + v[2] * b,
      ] as Vec3,
  );
}

// --------------------------------------------------------------- colours
//
// These are the `axesInfo` literals from Cube3D.ts, in face order U L F R B D,
// plus `ignoredMaterial`'s grey for the stickers a case does not care about.
//
// cubing.js hands those literals to `convertLinearToSRGB()` and then renders
// with `outputColorSpace = "srgb-linear"`, which looks like it should brighten
// them — it does not. The two cancel, and the pixels that reach the screen are
// the literals unchanged; the values below were read back off a rendered player
// to be sure, which is also where the blue's `66` comes from (the literal says
// `63`, and the render rounds).

export const STICKER_COLOURS: Record<string, string> = {
  U: "#ffffff",
  L: "#ff8000",
  F: "#00ff00",
  R: "#ff0000",
  B: "#2266ff",
  D: "#ffff00",
  ".": "#666666",
};

/**
 * The cubie foundation is a 30%-opaque black box per cubie, so the body of the
 * cube is really several translucent layers over the card: 0.3 black over the
 * card's own colour is what shows through the gaps between stickers, and the
 * crevices where a ray crosses two boxes go darker still. Depth-sorting 26
 * boxes to reproduce that would repaint a shape that comes out the same in
 * every case, so it is one flat silhouette in the colour the gaps settle at.
 */
const BODY = "#080b0e";

// --------------------------------------------------------------- drawing

/** Convex hull (gift wrap), for the cube's silhouette. */
function hull(points: [number, number][]): [number, number][] {
  const start = points.reduce((a, b) => (b[0] < a[0] || (b[0] === a[0] && b[1] < a[1]) ? b : a));
  const out: [number, number][] = [];
  let current = start;
  do {
    out.push(current);
    let next = points[0];
    for (const p of points) {
      if (p === current) continue;
      const turn =
        (next[0] - current[0]) * (p[1] - current[1]) - (next[1] - current[1]) * (p[0] - current[0]);
      if (next === current || turn < 0) next = p;
    }
    current = next;
  } while (current !== start && out.length <= points.length);
  return out;
}

/** Pre-projected sticker outlines, in `VISIBLE` order. */
const QUADS = VISIBLE.map((s) => stickerQuad(s).map(project).map(pt).join(" "));

/**
 * The outline of the assembled cube, which the stickers are drawn on top of.
 *
 * The foundation block alone is not quite the silhouette: a sticker floats at
 * 0.503 while the foundation only reaches 0.495, so the outer stickers stand
 * proud of it by a hair and set the real outline along those edges. Hulling the
 * stickers in with the block accounts for that — worth the two pixels, since
 * otherwise the whole cube reads as slightly too small next to the player.
 */
const SILHOUETTE = (() => {
  const h = 1.5 * FOUNDATION_SCALE;
  const points: Vec3[] = [];
  for (const x of [-h, h]) for (const y of [-h, h]) for (const z of [-h, h]) points.push([x, y, z]);
  for (const s of VISIBLE) points.push(...stickerQuad(s));
  return hull(points.map(project)).map(pt).join(" ");
})();

const NS = "http://www.w3.org/2000/svg";

/**
 * Draw one case.
 *
 * `colours` is one character per entry of `VISIBLE`: a face letter for a
 * sticker the case cares about, or "." for one the stickering mask dims.
 */
export function cubeThumb(colours: string): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${VIEW} ${VIEW}`);
  svg.setAttribute("aria-hidden", "true");

  const body = document.createElementNS(NS, "polygon");
  body.setAttribute("points", SILHOUETTE);
  body.setAttribute("fill", BODY);
  svg.append(body);

  for (let i = 0; i < QUADS.length; i++) {
    const quad = document.createElementNS(NS, "polygon");
    quad.setAttribute("points", QUADS[i]);
    quad.setAttribute("fill", STICKER_COLOURS[colours[i]] ?? STICKER_COLOURS["."]);
    svg.append(quad);
  }
  return svg;
}

// ------------------------------------------------------- last-layer diagram
//
// OLL and PLL are recognised off the flat last-layer diagram rather than a
// cube, which is what cubing.js's "experimental-2D-LL" visualization draws, so
// those cards keep that shape. The measurements come from cubing.js's own LL
// SVG: a 3x3 of 64-unit cells from 32 to 224, with 28-deep flaps outside it at
// 4..32 and 224..252, all inside a "-16 -16 288 288" box.
//
// The flaps meet at the diagram's corners, where the two side stickers of a
// corner piece split the 28x28 square between them along its diagonal — hence
// the trapezoids below rather than plain rectangles.

const LL_ORIGIN = 32;
const LL_CELL = 64;
const LL_OUTER = 252;
const LL_INSET = 4;

/** Which cell of the diagram each last-layer slot is drawn in, as [col, row]. */
const LL_CORNER_CELL: [number, number][] = [
  [2, 2], // UFR
  [2, 0], // URB
  [0, 0], // UBL
  [0, 2], // ULF
];
const LL_EDGE_CELL: [number, number][] = [
  [1, 2], // UF
  [2, 1], // UR
  [1, 0], // UB
  [0, 1], // UL
];

const cellX = (col: number) => LL_ORIGIN + col * LL_CELL;
const cellY = (row: number) => LL_ORIGIN + row * LL_CELL;

const rectPoints = (x: number, y: number, w: number, h: number) =>
  [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
    .map(([a, b]) => `${a},${b}`)
    .join(" ");

/** The flap outside an edge cell: a plain rectangle on whichever side it faces. */
function edgeFlap(col: number, row: number): string {
  if (col === 2) return rectPoints(224, cellY(row), 28, LL_CELL);
  if (col === 0) return rectPoints(LL_INSET, cellY(row), 28, LL_CELL);
  if (row === 2) return rectPoints(cellX(col), 224, LL_CELL, 28);
  return rectPoints(cellX(col), LL_INSET, LL_CELL, 28);
}

/**
 * One half of a corner's flap. `axis` picks which of the two it is: "x" for the
 * flap on the left/right side, "y" for the one along the top/bottom. Each runs
 * from the cell's far edge out to the diagram corner, mitred so the pair meets
 * on the diagonal.
 */
function cornerFlap(col: number, row: number, axis: "x" | "y"): string {
  const innerX = col === 2 ? 224 : LL_ORIGIN;
  const outerX = col === 2 ? LL_OUTER : LL_INSET;
  const innerY = row === 2 ? 224 : LL_ORIGIN;
  const outerY = row === 2 ? LL_OUTER : LL_INSET;
  const farX = col === 2 ? cellX(col) : cellX(col) + LL_CELL;
  const farY = row === 2 ? cellY(row) : cellY(row) + LL_CELL;
  const quad: [number, number][] =
    axis === "x"
      ? [
          [innerX, farY],
          [outerX, farY],
          [outerX, outerY],
          [innerX, innerY],
        ]
      : [
          [farX, innerY],
          [farX, outerY],
          [outerX, outerY],
          [innerX, innerY],
        ];
  return quad.map(([a, b]) => `${a},${b}`).join(" ");
}

/** A last-layer sticker: which facelet it is, and where it is drawn. */
export type LLSticker = {
  orbit: "CORNERS" | "EDGES" | "CENTERS";
  slot: number;
  face: string;
  facelet: number;
  points: string;
};

const llSticker = (
  orbit: LLSticker["orbit"],
  slot: number,
  face: string,
  points: string,
): LLSticker => ({ orbit, slot, face, facelet: SLOT_NAMES[orbit][slot].indexOf(face), points });

/**
 * The 21 stickers of the diagram: the nine on the U face first, read
 * left-to-right and top-to-bottom, then the side flaps. As with `VISIBLE`, the
 * order is shared with the generated colour strings.
 */
export const LL_VISIBLE: LLSticker[] = (() => {
  const top: (LLSticker | null)[] = [null, null, null, null, null, null, null, null, null];
  const place = (col: number, row: number, s: LLSticker) => {
    top[row * 3 + col] = s;
  };
  LL_CORNER_CELL.forEach(([col, row], slot) =>
    place(col, row, llSticker("CORNERS", slot, "U", rectPoints(cellX(col), cellY(row), LL_CELL, LL_CELL))),
  );
  LL_EDGE_CELL.forEach(([col, row], slot) =>
    place(col, row, llSticker("EDGES", slot, "U", rectPoints(cellX(col), cellY(row), LL_CELL, LL_CELL))),
  );
  place(1, 1, llSticker("CENTERS", 0, "U", rectPoints(cellX(1), cellY(1), LL_CELL, LL_CELL)));

  const sides: LLSticker[] = [];
  LL_CORNER_CELL.forEach(([col, row], slot) => {
    // The two side letters of the slot's name, each on its own flap.
    for (const face of SLOT_NAMES.CORNERS[slot].slice(1)) {
      const axis = face === "R" || face === "L" ? "x" : "y";
      sides.push(llSticker("CORNERS", slot, face, cornerFlap(col, row, axis)));
    }
  });
  LL_EDGE_CELL.forEach(([col, row], slot) => {
    const face = SLOT_NAMES.EDGES[slot][1];
    sides.push(llSticker("EDGES", slot, face, edgeFlap(col, row)));
  });

  return [...(top as LLSticker[]), ...sides];
})();

/**
 * The 2D diagram has its own palette — cubing.js writes plain CSS colours into
 * the SVG rather than the gamma-converted ones the 3D renderer uses, so these
 * are its literals, not `STICKER_COLOURS`.
 */
export const LL_COLOURS: Record<string, string> = {
  U: "white",
  L: "orange",
  F: "limegreen",
  R: "red",
  B: "#26f",
  D: "yellow",
  // `colorMaps.ignored` in the SVG renderer.
  ".": "#555555",
};

/** Draw one OLL or PLL case, `colours` indexed by `LL_VISIBLE`. */
export function llThumb(colours: string): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "-16 -16 288 288");
  svg.setAttribute("aria-hidden", "true");
  // cubing.js strokes every sticker black at width 4 with rounded joins.
  svg.setAttribute("stroke", "#000000");
  svg.setAttribute("stroke-width", "4");
  svg.setAttribute("stroke-linejoin", "round");

  LL_VISIBLE.forEach((s, i) => {
    const quad = document.createElementNS(NS, "polygon");
    quad.setAttribute("points", s.points);
    quad.setAttribute("fill", LL_COLOURS[colours[i]] ?? LL_COLOURS["."]);
    svg.append(quad);
  });
  return svg;
}
