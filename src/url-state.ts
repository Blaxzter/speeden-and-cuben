/**
 * The address bar as the app's state.
 *
 * Every click that changes *what you are looking at* — which set, which case,
 * how the grid is narrowed — lands in the URL, so a view can be linked,
 * bookmarked, opened in a second tab and walked back through with the browser's
 * own buttons. Nothing about *how you are watching* goes in: playback speed,
 * where the timeline is parked, hint stickers. Those are settings, not a view.
 *
 * The encoding is meant to be read. The set is the path, because the three sets
 * are the app's three pages; everything else is a query parameter named after
 * the question it answers, and anything sitting at its default is left out — so
 * an unfiltered page is just `/oll`, and every parameter that *is* there was
 * put there by a click.
 *
 * Reading is deliberately forgiving and writing is canonical: an unknown path,
 * a case that does not exist, a group belonging to another set or a mangled
 * drawing all decode to the default rather than to an error, and the first
 * write puts the tidied-up URL back in the bar.
 */

import type { CaseSet, CubeCase } from "./data/types";
import { SETS } from "./sets";
import { emptyShape, type OllShape } from "./oll-shape";
import type { Cross } from "./stickering";

/** The F2L finder's answers — an `F2LRecognition` with the unanswered parts left open. */
export type Finder = {
  cornerPos: number | null;
  cornerOri: number | null;
  edgePos: number | null;
  edgeOri: number | null;
};

export const emptyFinder = (): Finder => ({
  cornerPos: null,
  cornerOri: null,
  edgePos: null,
  edgeOri: null,
});

/** Everything the URL carries. */
export type UrlState = {
  set: CaseSet;
  selected: string | null;
  algIndex: number;
  group: string | null;
  query: string;
  cross: Cross;
  finder: Finder;
  shape: OllShape;
};

const PATHS: Record<CaseSet, string> = { F2L: "/f2l", OLL: "/oll", PLL: "/pll" };
const SET_OF_PATH = new Map(
  (Object.entries(PATHS) as [CaseSet, string][]).map(([set, path]) => [path, set]),
);

/** Group names carry spaces and a "+", so the URL names them by slug. */
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// The two "where is it" answers are written as the face the piece sits on
// rather than as the raw index, because that is the answer the user gave. The
// two orientation answers have no such name — "twist 1" means a different face
// depending on where the corner is — so those stay numbers.
const CORNER_AT = ["fr", "br", "bl", "fl"];
const EDGE_AT = ["f", "r", "b", "l"];
const IN_SLOT = "slot";
/** The position value standing for "already in the slot", per piece. */
const SLOTTED = { corner: 4, edge: 8 };

/**
 * The drawing as twelve characters: four corners, four edges, then which side
 * sticker each down corner keeps its colour on (`-` for "not said").
 *
 * It is the one piece of state with no readable spelling — it is a picture —
 * so it gets a compact one instead, short enough to keep a shared link short.
 */
const SHAPE_RE = /^[01]{8}[01-]{4}$/;

function encodeShape(s: OllShape): string | null {
  if (!s.drawn) return null;
  const bit = (b: boolean) => (b ? "1" : "0");
  return (
    s.corner.map(bit).join("") +
    s.edge.map(bit).join("") +
    s.side.map((v) => (v === null ? "-" : String(v))).join("")
  );
}

function decodeShape(raw: string | null): OllShape {
  if (raw === null || !SHAPE_RE.test(raw)) return emptyShape();
  const corner = [...raw.slice(0, 4)].map((c) => c === "1");
  const edge = [...raw.slice(4, 8)].map((c) => c === "1");
  // A corner that is up has no side sticker to argue about, so the pad can
  // never be in that state — normalise rather than carry it into the matcher.
  const side = [...raw.slice(8, 12)].map((c, i) => (corner[i] || c === "-" ? null : Number(c)));
  return { drawn: true, corner, edge, side };
}

/** A case by its label ("21", "T") — or by its id, so a hand-written link still lands. */
const findCase = (set: CaseSet, raw: string | null): CubeCase | undefined => {
  if (raw === null) return undefined;
  const q = raw.toLowerCase();
  return SETS[set].find((c) => c.label.toLowerCase() === q || c.id.toLowerCase() === q);
};

/** A group by its slug, resolved back to the name the data actually uses. */
const findGroup = (set: CaseSet, raw: string | null): string | null => {
  if (raw === null) return null;
  const q = slug(raw);
  return SETS[set].find((c) => slug(c.group) === q)?.group ?? null;
};

/**
 * Where the view lives.
 *
 * `defaultCase` is the case the app would land on unasked — the first one the
 * filters leave standing. A selection that matches it was made by the filters
 * rather than by the user, so it is left out and `/oll?group=fish` stays that
 * short; loading it picks the same case again.
 */
export function toUrl(s: UrlState, defaultCase: string | null): string {
  const p = new URLSearchParams();
  const c = SETS[s.set].find((x) => x.id === s.selected);

  if (c && c.id !== defaultCase) p.set("case", c.label);
  // One-based: "alg=2" is the second algorithm listed, which is how the panel
  // reads to someone who cannot see the array.
  if (c && s.algIndex > 0) p.set("alg", String(s.algIndex + 1));
  if (s.group) p.set("group", slug(s.group));

  // Each finder belongs to one set and is cleared when you leave it, so writing
  // it on any other page would put a filter in the URL that has no control.
  if (s.set === "F2L") {
    const { cornerPos, cornerOri, edgePos, edgeOri } = s.finder;
    if (cornerPos !== null) {
      p.set("corner", cornerPos === SLOTTED.corner ? IN_SLOT : CORNER_AT[cornerPos]);
    }
    if (cornerOri !== null) p.set("twist", String(cornerOri));
    if (edgePos !== null) p.set("edge", edgePos === SLOTTED.edge ? IN_SLOT : EDGE_AT[edgePos]);
    if (edgeOri !== null) p.set("flip", String(edgeOri));
  }
  if (s.set === "OLL") {
    const shape = encodeShape(s.shape);
    if (shape) p.set("shape", shape);
  }

  if (s.query.trim()) p.set("q", s.query);
  // White is the default cross, so only a yellow-cross cuber carries it around.
  if (s.cross !== "white") p.set("cross", s.cross);

  const query = p.toString();
  return PATHS[s.set] + (query ? `?${query}` : "");
}

/** A position answer, back from the face it names. */
const faceAt = (faces: string[], raw: string | null, slotted: number): number | null => {
  if (raw === null) return null;
  const q = raw.toLowerCase();
  if (q === IN_SLOT) return slotted;
  const i = faces.indexOf(q);
  return i < 0 ? null : i;
};

/** A small whole number in `0..max`, or nothing. */
const smallInt = (raw: string | null, max: number): number | null => {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
};

/**
 * Read a view out of a URL.
 *
 * `storedCross` is the visitor's own remembered orientation, used when the link
 * does not name one — a link shared by a yellow-cross cuber says so, and one
 * that says nothing leaves your own setting alone.
 */
export function fromUrl(url: URL, storedCross: Cross): UrlState {
  const p = url.searchParams;
  const set = SET_OF_PATH.get(url.pathname.toLowerCase().replace(/\/+$/, "")) ?? "F2L";

  const crossParam = p.get("cross");
  const cross: Cross = crossParam === "white" || crossParam === "yellow" ? crossParam : storedCross;

  const c = findCase(set, p.get("case"));
  // `alg` is one-based and `Number(null)` is 0, so both a missing and a
  // nonsense value fall through to the first algorithm.
  const wanted = (Number(p.get("alg")) || 1) - 1;
  const algIndex = c ? Math.min(Math.max(0, wanted), c.algs.length - 1) : 0;

  const finder = emptyFinder();
  if (set === "F2L") {
    finder.cornerPos = faceAt(CORNER_AT, p.get("corner"), SLOTTED.corner);
    finder.edgePos = faceAt(EDGE_AT, p.get("edge"), SLOTTED.edge);
    // An orientation is read against a position — the sidebar will not even let
    // you answer one without the other — so a link carrying only the twist
    // describes a state no click can reach. Drop it rather than show a filter
    // with no lit tile behind it.
    if (finder.cornerPos !== null) finder.cornerOri = smallInt(p.get("twist"), 2);
    if (finder.edgePos !== null) finder.edgeOri = smallInt(p.get("flip"), 1);
  }

  return {
    set,
    selected: c?.id ?? SETS[set][0].id,
    algIndex,
    group: findGroup(set, p.get("group")),
    query: p.get("q") ?? "",
    cross,
    finder,
    shape: set === "OLL" ? decodeShape(p.get("shape")) : emptyShape(),
  };
}
