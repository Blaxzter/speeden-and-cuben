/**
 * Mini cube diagrams for the F2L case finder.
 *
 * "Corner is at front-right" only means something once you can see it, so every
 * finder option draws its own answer on a small isometric cube in the same
 * orientation as the case thumbnails: cross colour on the bottom, front and
 * right faces toward the camera, everything irrelevant left grey.
 *
 * The sticker layouts below were read off the rendered cube rather than guessed
 * — see the orientation tables for what each stored orientation index means.
 */

export type Cross = "white" | "yellow";
export type Face = "U" | "D" | "F" | "R" | "B" | "L";
/** The three faces this camera can actually see. */
type Visible = "U" | "F" | "R";
/** [column, row] on a face, counted from the top-left as drawn. */
type Cell = [number, number];

// Sampled off the rendered players so an icon reads as the same cube, with the
// greys pulled a little darker than the players' — at 42px a highlight has to
// win against 26 other stickers.
const SOLID = { white: "#ffffff", yellow: "#ffe000", blue: "#2068ff", green: "#00c832", red: "#f01c1c" };

type Slot = "cross" | "front" | "right";
type Palette = Record<Slot, string>;
const palette = (cross: Cross): Palette =>
  cross === "white"
    ? { cross: SOLID.white, front: SOLID.blue, right: SOLID.red }
    : { cross: SOLID.yellow, front: SOLID.green, right: SOLID.red };

// ---------------------------------------------------------------- geometry
//
// Which visible stickers a piece occupies. A piece at back-left shows only its
// U sticker; the icon draws what you would really see, nothing more.

const CORNER_CELLS: Record<number, Partial<Record<Visible, Cell>>> = {
  0: { U: [2, 2], F: [2, 0], R: [0, 0] }, // front-right
  1: { U: [2, 0], R: [2, 0] }, //            back-right
  2: { U: [0, 0] }, //                       back-left
  3: { U: [0, 2], F: [0, 0] }, //            front-left
  4: { F: [2, 2], R: [0, 2] }, //            in the slot
};
const EDGE_CELLS: Record<number, Partial<Record<Visible, Cell>>> = {
  0: { U: [1, 2], F: [1, 0] }, //            front
  1: { U: [2, 1], R: [1, 0] }, //            right
  2: { U: [1, 0] }, //                       back
  3: { U: [0, 1] }, //                       left
  8: { F: [2, 1], R: [0, 1] }, //            in the slot
};
const cellsOf = (kind: Kind, pos: number) => (kind === "corner" ? CORNER_CELLS : EDGE_CELLS)[pos] ?? {};

// ---------------------------------------------------------------- orientation
//
// Orientation is stored as an index, and the index is measured around the
// piece, so which face the cross sticker lands on depends on where the piece
// is. These tables list each piece's faces in that cyclic order; the colour
// tables then say which sticker sits on face 0, 1 and 2 for each index.

const CORNER_FACES: Record<number, [Face, Face, Face]> = {
  0: ["U", "F", "R"],
  1: ["U", "R", "B"],
  2: ["U", "B", "L"],
  3: ["U", "L", "F"],
  4: ["D", "R", "F"], // seen from below, so the last two swap round
};
const EDGE_FACES: Record<number, [Face, Face]> = {
  0: ["U", "F"],
  1: ["U", "R"],
  2: ["U", "B"],
  3: ["U", "L"],
  8: ["F", "R"],
};
const CORNER_ORI: [Slot, Slot, Slot][] = [
  ["cross", "right", "front"],
  ["right", "front", "cross"],
  ["front", "cross", "right"],
];
const EDGE_ORI: [Slot, Slot][] = [
  ["front", "right"], // not flipped: the front colour is the one on top
  ["right", "front"],
];

/** The face the cross sticker points at, for a corner at `pos` with `ori`. */
export const crossFace = (pos: number, ori: number): Face =>
  CORNER_FACES[pos][CORNER_ORI[ori].indexOf("cross")];

export const FACE_WORD: Record<Face, string> = {
  U: "up",
  D: "down",
  F: "front",
  R: "right",
  B: "back",
  L: "left",
};

// ---------------------------------------------------------------- drawing

const NS = "http://www.w3.org/2000/svg";
/** Isometric projection: x runs right, y up, z toward the viewer. */
const iso = (x: number, y: number, z: number): [number, number] => [(x - z) * 0.866, (x + z) * 0.5 - y];

function quad(face: Visible, col: number, row: number): [number, number][] {
  if (face === "U") {
    return [iso(col, 3, row), iso(col + 1, 3, row), iso(col + 1, 3, row + 1), iso(col, 3, row + 1)];
  }
  if (face === "F") {
    const y = 3 - row;
    return [iso(col, y, 3), iso(col + 1, y, 3), iso(col + 1, y - 1, 3), iso(col, y - 1, 3)];
  }
  const z = 3 - col;
  const y = 3 - row;
  return [iso(3, y, z), iso(3, y, z - 1), iso(3, y - 1, z - 1), iso(3, y - 1, z)];
}

const corners = (face: Visible, [col, row]: Cell) =>
  quad(face, col, row).map(([x, y]) => x.toFixed(3) + "," + y.toFixed(3)).join(" ");

/** A flat fill on every face reads as a hexagon, so darken the side faces. */
const SHADE: Record<Visible, number> = { U: 1, R: 0.84, F: 0.68 };
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const parts = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return "#" + parts.map((v) => Math.round(v * k).toString(16).padStart(2, "0")).join("");
};

const DIM = "#5c616d";
const SPOT = "#f5c518";
/** The same accent, dimmed until it reads as context rather than as an answer. */
const GHOST = "#8a7c4a";

type Kind = "corner" | "edge";
export interface IconSpec {
  cross: Cross;
  /** Draw this piece in its real sticker colours — answers "which way round". */
  piece?: { kind: Kind; pos: number; ori: number };
  /** Light up a position without claiming an orientation — answers "where". */
  spot?: { kind: Kind; pos: number };
  /**
   * The piece this question is *not* about, drawn faintly where the finder
   * already knows it sits. "Edge is at back" says nothing on its own — a U turn
   * moves it anywhere — so the edge tiles show the corner too, and what a tile
   * really asks becomes "how do these two sit?".
   */
  ghost?: { kind: Kind; pos: number };
}

export function cubeIcon(spec: IconSpec): SVGSVGElement {
  const pal = palette(spec.cross);
  const fill = new Map<string, string>();
  const key = (f: Visible, c: Cell) => f + c[0] + c[1];

  // Centres never move, which makes them the reference every answer is read
  // against: the edge is unflipped exactly when the sticker on top matches the
  // front centre, and the pair belongs where those two colours meet. The top
  // centre stays grey — it is last-layer colour, and the players dim it too.
  fill.set(key("F", [1, 1]), pal.front);
  fill.set(key("R", [1, 1]), pal.right);

  const paint = (kind: Kind, pos: number, colour: string) => {
    for (const [face, cell] of Object.entries(cellsOf(kind, pos))) fill.set(key(face as Visible, cell), colour);
  };
  if (spec.ghost) paint(spec.ghost.kind, spec.ghost.pos, GHOST);
  if (spec.spot) paint(spec.spot.kind, spec.spot.pos, SPOT);
  if (spec.piece) {
    const { kind, pos, ori } = spec.piece;
    const faces: Face[] = kind === "corner" ? CORNER_FACES[pos] : EDGE_FACES[pos];
    const order: Slot[] = kind === "corner" ? CORNER_ORI[ori] : EDGE_ORI[ori];
    const cells = cellsOf(kind, pos);
    faces.forEach((face, i) => {
      const cell = cells[face as Visible];
      if (cell) fill.set(key(face as Visible, cell), pal[order[i]]);
    });
  }

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "-2.78 -3.18 5.56 6.36");
  svg.setAttribute("class", "opt-icon");
  svg.setAttribute("aria-hidden", "true");
  for (const face of ["U", "R", "F"] as Visible[]) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const p = document.createElementNS(NS, "polygon");
        p.setAttribute("points", corners(face, [col, row]));
        p.setAttribute("fill", shade(fill.get(key(face, [col, row])) ?? DIM, SHADE[face]));
        svg.append(p);
      }
    }
  }
  return svg;
}
