/**
 * The OLL shape pad — draw the top of your cube and the grid narrows to it.
 *
 * OLL is the one set you recognise by pattern rather than by name: you look
 * down at the last layer and read the shape off it. So the sidebar hands you
 * the same diagram the cards are drawn with and lets you paint your own cube
 * onto it, sticker by sticker.
 *
 * What makes that a *filter* rather than a picture is that the shape is the
 * case. Every last-layer piece has exactly one sticker in the last layer's
 * colour, so saying where all eight of them point says which of the 57 cases
 * you are holding — the patterns below come out unique to one case each. The
 * top face alone gets you most of the way (usually to two candidates, at worst
 * to six), and the side stickers of the twisted corners settle the rest.
 *
 * Which way round you hold the cube is not part of the case, so a drawing is
 * matched against every case in all four quarter-turns rather than only the one
 * the cards happen to be drawn in.
 */

import { LL_VISIBLE, LL_COLOURS, SLOT_NAMES } from "./cube-thumb";
import { THUMBS } from "./data/thumbs.generated";
import { OLL_CASES } from "./data/oll";
import type { Cross } from "./stickering";

// ---------------------------------------------------------------- geometry

const SLOTS = [0, 1, 2, 3];

function indexOf(orbit: string, slot: number, face: string): number {
  const i = LL_VISIBLE.findIndex((s) => s.orbit === orbit && s.slot === slot && s.face === face);
  if (i < 0) throw new Error(`no ${orbit} ${slot} ${face} sticker in the last-layer diagram`);
  return i;
}

/**
 * The two side faces of each corner, in its slot name's own order — "UFR"
 * gives front then right. Everything below indexes a corner's side stickers
 * 0 and 1 in that order, so the order has to come from one place.
 */
const CORNER_SIDES = SLOTS.map((s) => [...SLOT_NAMES.CORNERS[s].slice(1)]);

/** Each piece's stickers, as indices into `LL_VISIBLE`. */
const CORNER_TOP = SLOTS.map((s) => indexOf("CORNERS", s, "U"));
const CORNER_FLAP = SLOTS.map((s) => CORNER_SIDES[s].map((f) => indexOf("CORNERS", s, f)));
const EDGE_TOP = SLOTS.map((s) => indexOf("EDGES", s, "U"));
const EDGE_FLAP = SLOTS.map((s) => indexOf("EDGES", s, SLOT_NAMES.EDGES[s][1]));
const CENTRE = indexOf("CENTERS", 0, "U");

// ---------------------------------------------------------------- rotation
//
// A quarter turn of the whole cube, derived from the slot names rather than
// tabulated: a piece named by the faces it touches lands on the slot named by
// where those faces went, and its sticker on face X lands on face y(X).

/** Where each face goes under a `y` rotation — the right face comes to the front. */
const Y_FACE: Record<string, string> = { U: "U", R: "F", F: "L", L: "B", B: "R" };

function ySlot(orbit: "CORNERS" | "EDGES", slot: number): number {
  const moved = [...SLOT_NAMES[orbit][slot]].map((f) => Y_FACE[f]);
  const names: readonly string[] = SLOT_NAMES[orbit];
  const i = names.findIndex((n) => n.length === moved.length && moved.every((f) => n.includes(f)));
  if (i < 0) throw new Error(`y takes ${orbit} ${slot} off the puzzle`);
  return i;
}

const Y_CORNER = SLOTS.map((s) => ySlot("CORNERS", s));
const Y_EDGE = SLOTS.map((s) => ySlot("EDGES", s));
/** Which side sticker of the corner's new slot each of its side stickers becomes. */
const Y_SIDE = SLOTS.map((s) =>
  CORNER_SIDES[s].map((f) => CORNER_SIDES[Y_CORNER[s]].indexOf(Y_FACE[f])),
);

// ----------------------------------------------------------------- patterns

/**
 * Where a case keeps its last-layer colour on each piece of the top layer.
 *
 * `side` is only meaningful for a corner that is not already up: it says which
 * of that corner's two side stickers carries the colour, which is the only
 * thing the top face cannot tell you.
 */
type Pattern = { corner: boolean[]; edge: boolean[]; side: number[] };

/**
 * Read a case's pattern off its baked card diagram.
 *
 * The OLL stickering mask keeps exactly one sticker per last-layer piece — the
 * one whose orientation the case is about — and dims the rest to ".", so the
 * lit sticker in the generated string *is* the answer. Both cross colours draw
 * the same shape in different paint, so either string will do.
 */
function patternOf(id: string): Pattern {
  const s = THUMBS[id].white;
  const lit = (i: number) => s[i] !== ".";
  const corner = CORNER_TOP.map(lit);
  return {
    corner,
    edge: EDGE_TOP.map(lit),
    side: CORNER_FLAP.map((pair, i) => (corner[i] ? -1 : pair.findIndex(lit))),
  };
}

const PATTERNS = new Map(OLL_CASES.map((c) => [c.id, patternOf(c.id)] as const));

function rotate(p: Pattern): Pattern {
  const corner: boolean[] = [];
  const edge: boolean[] = [];
  const side: number[] = [];
  for (const s of SLOTS) {
    corner[Y_CORNER[s]] = p.corner[s];
    edge[Y_EDGE[s]] = p.edge[s];
    side[Y_CORNER[s]] = p.side[s] < 0 ? -1 : Y_SIDE[s][p.side[s]];
  }
  return { corner, edge, side };
}

// -------------------------------------------------------------- the drawing

/**
 * What the user has said about their own cube.
 *
 * A blank pad filters nothing, which is why `drawn` exists: "no corner is up"
 * and "I have not said yet" are different claims, and only the first of them is
 * a dot. The first sticker tapped commits the pad, and everything untouched
 * commits with it — you draw the colour you can see, so unpainted means the
 * last-layer colour is not there.
 */
export type OllShape = {
  drawn: boolean;
  /** Per corner slot (UFR URB UBL ULF): its last-layer sticker faces up. */
  corner: boolean[];
  /** Per edge slot (UF UR UB UL): its last-layer sticker faces up. */
  edge: boolean[];
  /** Which side sticker a down corner keeps its colour on, or null for either. */
  side: (number | null)[];
};

export const emptyShape = (): OllShape => ({
  drawn: false,
  corner: [false, false, false, false],
  edge: [false, false, false, false],
  side: [null, null, null, null],
});

/** One sticker of the pad. `side` is absent for the sticker on the top face. */
export type Sticker = { kind: "corner" | "edge"; slot: number; side?: number };

export const stickerKey = (t: Sticker) => `${t.kind}${t.slot}${t.side ?? "u"}`;

const parseSticker = (key: string): Sticker | null => {
  const m = /^(corner|edge)([0-3])([01u])$/.exec(key);
  if (!m) return null;
  const t: Sticker = { kind: m[1] as Sticker["kind"], slot: Number(m[2]) };
  if (m[3] !== "u") t.side = Number(m[3]);
  return t;
};

/** Is the drawing currently showing the last-layer colour on this sticker? */
function isLit(shape: OllShape, t: Sticker): boolean {
  if (!shape.drawn) return false;
  if (t.kind === "edge") return t.side === undefined ? shape.edge[t.slot] : !shape.edge[t.slot];
  if (t.side === undefined) return shape.corner[t.slot];
  return !shape.corner[t.slot] && shape.side[t.slot] === t.side;
}

export type PaintMode = "paint" | "erase";

/** What pressing this sticker starts doing — a lit one clears, a dark one paints. */
export const pressMode = (shape: OllShape, t: Sticker): PaintMode =>
  isLit(shape, t) ? "erase" : "paint";

/** Everything the drawing says, for telling a stroke that changed nothing. */
const signature = (s: OllShape) =>
  `${s.drawn}|${s.corner.join("")}|${s.edge.join("")}|${s.side.join(",")}`;

/**
 * Paint or clear one sticker; true when that actually moved something.
 *
 * Clearing means "the last-layer colour is not here", and where it goes instead
 * is a fact about the piece rather than a choice. An edge has two stickers and
 * its colour is on one of them, so clearing either paints the other. A corner
 * has three, so clearing leaves it twisted with the side not yet said — which
 * is a state of its own, and the one a corner goes back to.
 */
export function paintSticker(shape: OllShape, t: Sticker, mode: PaintMode): boolean {
  const before = signature(shape);
  if (!shape.drawn) Object.assign(shape, emptyShape(), { drawn: true });
  const on = mode === "paint";

  if (t.kind === "edge") {
    shape.edge[t.slot] = t.side === undefined ? on : !on;
  } else if (t.side === undefined) {
    shape.corner[t.slot] = on;
    if (on) shape.side[t.slot] = null;
  } else if (on) {
    shape.corner[t.slot] = false;
    shape.side[t.slot] = t.side;
  } else if (shape.side[t.slot] === t.side) {
    shape.side[t.slot] = null;
  }
  return signature(shape) !== before;
}

// -------------------------------------------------------------- the stroke
//
// A press decides what the whole stroke does, and every sticker the pointer
// then crosses gets the same treatment. That is what makes a drag feel like a
// brush rather than a run of taps — and it is what keeps an edge honest, since
// its side sticker lights up the moment its top one goes dark: a stroke that
// decided "paint" on the way in cannot undo itself on the way past.
//
// Each stroke rebuilds the pad, so none of this can live on the elements. The
// listeners go on the window and the sticker under the pointer is looked up
// afresh every move.

type StrokeHandler = (t: Sticker, mode: PaintMode, fromKey?: boolean) => void;
let stroke: { mode: PaintMode; last: string; onStroke: StrokeHandler } | null = null;

function endStroke() {
  stroke = null;
  window.removeEventListener("pointermove", onStrokeMove);
  window.removeEventListener("pointerup", endStroke);
  window.removeEventListener("pointercancel", endStroke);
}

function onStrokeMove(ev: PointerEvent) {
  if (!stroke) return;
  const key = document.elementFromPoint(ev.clientX, ev.clientY)?.getAttribute("data-sticker");
  // Re-treating a sticker the stroke has already reached is a no-op by
  // construction, so nothing is lost by leaving the pad and coming back.
  if (!key || key === stroke.last) return;
  const t = parseSticker(key);
  if (!t) return;
  stroke.last = key;
  stroke.onStroke(t, stroke.mode);
}

function beginStroke(t: Sticker, mode: PaintMode, onStroke: StrokeHandler) {
  stroke = { mode, last: stickerKey(t), onStroke };
  window.addEventListener("pointermove", onStrokeMove);
  window.addEventListener("pointerup", endStroke);
  window.addEventListener("pointercancel", endStroke);
  onStroke(t, mode);
}

// ----------------------------------------------------------------- matching

type Fit = (p: Pattern, s: OllShape) => boolean;

/** The drawing read as a finished cube: unpainted means the colour is not there. */
function fits(p: Pattern, s: OllShape): boolean {
  for (const i of SLOTS) {
    if (p.corner[i] !== s.corner[i]) return false;
    if (p.edge[i] !== s.edge[i]) return false;
    // An unanswered twist rules nothing out — both sides are still on the table.
    if (!s.corner[i] && s.side[i] !== null && s.side[i] !== p.side[i]) return false;
  }
  return true;
}

/** The drawing read as far as it goes: only the stickers actually painted count. */
function fitsSoFar(p: Pattern, s: OllShape): boolean {
  for (const i of SLOTS) {
    if (s.corner[i] && !p.corner[i]) return false;
    if (s.edge[i] && !p.edge[i]) return false;
    if (!s.corner[i] && s.side[i] !== null && s.side[i] !== p.side[i]) return false;
  }
  return true;
}

/** Which quarter turns of a case line it up with the drawing. */
function turnsMatching(id: string, shape: OllShape, fit: Fit = fits): number[] {
  const base = PATTERNS.get(id);
  if (!base) return [];
  const out: number[] = [];
  let p = base;
  for (let k = 0; k < 4; k++) {
    if (fit(p, shape)) out.push(k);
    p = rotate(p);
  }
  return out;
}

/**
 * The cases a drawing points at, and whether it is pointing at them exactly.
 *
 * Half-drawn, a pad is usually not a cube at all: three oriented edges is a
 * state no cube can be in, and the honest answer to it is an empty grid — which
 * reads as a broken filter rather than as an unfinished drawing. So when
 * nothing is shaped like the pad, the stickers actually painted are kept and
 * the rest of it is treated as not yet said.
 */
export function shapeHits(shape: OllShape): { exact: boolean; ids: string[] } {
  const hit = (fit: Fit) =>
    OLL_CASES.filter((c) => turnsMatching(c.id, shape, fit).length > 0).map((c) => c.id);
  const exact = hit(fits);
  return exact.length > 0 ? { exact: true, ids: exact } : { exact: false, ids: hit(fitsSoFar) };
}

/**
 * The rotation that puts the cube in your hands the way the card draws it, or
 * null when it already is.
 *
 * A case matched after `k` quarter turns means the drawing *is* that case held
 * `y^k` round, so undoing it is `y^(4-k)`. Symmetric cases match at several
 * turns, including none, and a quarter turn is less to do than a half — hence
 * the order the answers are looked for in.
 */
const UNDO_TURN: (string | null)[] = [null, "y'", "y2", "y"];

export function alignTurn(id: string, shape: OllShape): string | null {
  const turns = turnsMatching(id, shape);
  for (const k of [0, 1, 3, 2]) if (turns.includes(k)) return UNDO_TURN[k];
  return null;
}

/** Corners drawn as twisted whose side the user has not pinned down yet. */
export const looseCorners = (shape: OllShape) =>
  SLOTS.filter((s) => !shape.corner[s] && shape.side[s] === null).length;

// ------------------------------------------------------------------ drawing
//
// The pad is the card diagram with hit targets: same geometry, same palette,
// so the shape you paint reads as the shape you are looking for.

type CellState = "unset" | "up" | "down" | "maybe";

function cellStates(shape: OllShape): CellState[] {
  const states: CellState[] = Array(LL_VISIBLE.length).fill(shape.drawn ? "down" : "unset");
  // The last layer's centre is its colour by definition — it also keeps a blank
  // pad looking like a cube rather than an empty grid.
  states[CENTRE] = "up";
  if (!shape.drawn) return states;

  for (const s of SLOTS) {
    states[CORNER_TOP[s]] = shape.corner[s] ? "up" : "down";
    states[EDGE_TOP[s]] = shape.edge[s] ? "up" : "down";
    states[EDGE_FLAP[s]] = shape.edge[s] ? "down" : "up";
    for (const j of [0, 1]) {
      states[CORNER_FLAP[s][j]] = shape.corner[s]
        ? "down"
        : shape.side[s] === null
          ? "maybe"
          : shape.side[s] === j
            ? "up"
            : "down";
    }
  }
  return states;
}

/** Which piece and sticker each diagram cell is, so a tap can be read back. */
const CELL_STICKER: (Sticker | null)[] = (() => {
  const out: (Sticker | null)[] = Array(LL_VISIBLE.length).fill(null);
  for (const s of SLOTS) {
    out[CORNER_TOP[s]] = { kind: "corner", slot: s };
    out[EDGE_TOP[s]] = { kind: "edge", slot: s };
    out[EDGE_FLAP[s]] = { kind: "edge", slot: s, side: 0 };
    for (const j of [0, 1]) out[CORNER_FLAP[s][j]] = { kind: "corner", slot: s, side: j };
  }
  return out;
})();

const CORNER_WORD = ["front-right", "back-right", "back-left", "front-left"];
const EDGE_WORD = ["front", "right", "back", "left"];
const FACE_WORD: Record<string, string> = { F: "front", R: "right", B: "back", L: "left" };

function stickerWord(t: Sticker): string {
  const piece = t.kind === "corner" ? `${CORNER_WORD[t.slot]} corner` : `${EDGE_WORD[t.slot]} edge`;
  if (t.side === undefined) return `${piece}, top sticker`;
  const face = t.kind === "corner" ? CORNER_SIDES[t.slot][t.side] : SLOT_NAMES.EDGES[t.slot][1];
  return `${piece}, ${FACE_WORD[face]} sticker`;
}

/** The letter the generated diagrams paint the last layer in, per cross colour. */
const LL_LETTER: Record<Cross, string> = { white: "D", yellow: "U" };
/** A cell nobody has spoken for yet: darker than the dimmed grey, and emptier. */
const UNSET = "#1c2028";

const NS = "http://www.w3.org/2000/svg";

/** The centre of a polygon, for the dot that marks a corner's two candidates. */
function centroid(points: string): [number, number] {
  const pairs = points.split(" ").map((p) => p.split(",").map(Number));
  const n = pairs.length;
  return [pairs.reduce((a, p) => a + p[0], 0) / n, pairs.reduce((a, p) => a + p[1], 0) / n];
}

export function shapePad(
  shape: OllShape,
  cross: Cross,
  onStroke: StrokeHandler,
  focusKey?: string | null,
): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "-16 -16 288 288");
  svg.setAttribute("class", "pad");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "Your last-layer shape");
  svg.setAttribute("stroke", "#000000");
  svg.setAttribute("stroke-width", "4");
  svg.setAttribute("stroke-linejoin", "round");

  const states = cellStates(shape);
  const ll = LL_COLOURS[LL_LETTER[cross]];
  const dots: SVGCircleElement[] = [];
  const cells: SVGPolygonElement[] = [];

  const poly = (points: string) => {
    const p = document.createElementNS(NS, "polygon");
    p.setAttribute("points", points);
    return p;
  };

  LL_VISIBLE.forEach((s, i) => {
    const state = states[i];
    const sticker = poly(s.points);
    sticker.setAttribute("fill", state === "up" ? ll : state === "unset" ? UNSET : LL_COLOURS["."]);
    svg.append(sticker);

    const target = CELL_STICKER[i];
    if (!target) return;

    if (state === "maybe") {
      // Blending the colour into the grey reads as "a lighter grey" once the
      // last layer is white, so the two candidates are marked, not tinted.
      const [cx, cy] = centroid(s.points);
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("cx", cx.toFixed(2));
      dot.setAttribute("cy", cy.toFixed(2));
      dot.setAttribute("r", "6");
      dot.setAttribute("fill", ll);
      dot.setAttribute("stroke", "none");
      dot.setAttribute("pointer-events", "none");
      dots.push(dot);
    }

    // The same outline again, unpainted, collected for the layer above. SVG has
    // no z-index: a highlight drawn here would be painted over by whichever
    // stickers come after it, which is what a hover under the grid lines is. In
    // a layer of its own there is nothing left to paint over it — the other
    // outlines in that layer are transparent, so they cover nothing.
    const cell = poly(s.points);
    cell.setAttribute("class", "pad-cell");
    cell.setAttribute("fill", "none");
    cell.setAttribute("stroke", "transparent");
    cell.setAttribute("role", "checkbox");
    cell.setAttribute("aria-checked", state === "maybe" ? "mixed" : String(state === "up"));
    cell.setAttribute("aria-label", stickerWord(target));
    cell.setAttribute("tabindex", "0");
    // How the pointer finds this sticker again mid-stroke, once the pad that
    // owns this particular element has been thrown away and redrawn.
    cell.setAttribute("data-sticker", stickerKey(target));
    cell.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      // Keeps a drag from turning into a text selection or a page scroll; the
      // focus it would also have moved is handed back below instead.
      ev.preventDefault();
      // A touch captures the pointer to the cell it went down on, and that cell
      // does not survive the redraw its own stroke triggers. Hand the pointer
      // back to plain hit-testing first, so the rest of the stroke still lands.
      if (cell.hasPointerCapture(ev.pointerId)) cell.releasePointerCapture(ev.pointerId);
      beginStroke(target, pressMode(shape, target), onStroke);
    });
    cell.addEventListener("keydown", (ev) => {
      if (ev.key !== " " && ev.key !== "Enter") return;
      ev.preventDefault();
      onStroke(target, pressMode(shape, target), true);
    });
    // Focus survives the rebuild that every stroke triggers, so a keyboard user
    // is not dropped back onto the document between one sticker and the next.
    if (focusKey === stickerKey(target)) requestAnimationFrame(() => cell.focus({ preventScroll: true }));
    cells.push(cell);
  });

  svg.append(...dots, ...cells);
  return svg;
}
