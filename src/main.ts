import "cubing/twisty";
import "./style.css";
import { F2L_CASES } from "./data/f2l";
import { OLL_CASES } from "./data/oll";
import { PLL_CASES } from "./data/pll";
import type { CaseSet, CubeCase, F2LRecognition } from "./data/types";
import { THUMBS } from "./data/thumbs.generated";
import { cubeIcon, crossFace, FACE_WORD, type IconSpec } from "./finder-icons";
import { cubeThumb, llThumb } from "./cube-thumb";
import { SETUP_ALG, stickeringMask, type Cross } from "./stickering";

const SETS: Record<CaseSet, CubeCase[]> = { F2L: F2L_CASES, OLL: OLL_CASES, PLL: PLL_CASES };
const SET_ORDER: CaseSet[] = ["F2L", "OLL", "PLL"];

const BLURB: Record<CaseSet, string> = {
  F2L: "First two layers — solve a corner/edge pair into its slot.",
  OLL: "Orient the last layer — make the whole top face one colour.",
  PLL: "Permute the last layer — move the pieces into place.",
};

// ---------------------------------------------------------------- state

type Finder = { cornerPos: number | null; cornerOri: number | null; edgePos: number | null; edgeOri: number | null };
const emptyFinder = (): Finder => ({ cornerPos: null, cornerOri: null, edgePos: null, edgeOri: null });

function stored<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* blocked storage — the setting simply will not persist */
  }
}

/**
 * Playback speed bounds, shared by the slider and by the clamp below.
 *
 * The player multiplies elapsed real time by this to advance its timeline, and
 * it does not sanity-check the multiplier: a non-finite tempo turns every
 * computed timestamp into NaN, which compares false against both ends of the
 * timeline, so the animation stops advancing while the player still reports
 * itself as playing. Nothing short of a reload recovers from that, so a value
 * arriving from storage is clamped rather than trusted.
 */
const SPEED_MIN = 0.25;
const SPEED_MAX = 3;
const SPEED_STEP = 0.25;
const clampSpeed = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(SPEED_MAX, Math.max(SPEED_MIN, n)) : 1;
};

const state = {
  set: "F2L" as CaseSet,
  query: "",
  group: null as string | null,
  selected: F2L_CASES[0].id as string | null,
  algIndex: 0,
  speed: clampSpeed(stored<number>("speed", 1)),
  cross: stored<Cross>("cross", "white"),
  finder: emptyFinder(),
};

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const el = (tag: string, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const tokens = (alg: string) => alg.trim().split(/\s+/).filter(Boolean);
const isRotation = (m: string) => /^[xyz]['2]?$/.test(m);
/**
 * Algs are stored rotation-neutral so the stickering mask stays aligned (see
 * scripts/fix-rotations.ts), but the cancelling rotation on the end is an
 * implementation detail — cubers do not write it, so it is not shown.
 */
const displayTokens = (alg: string) => {
  const t = tokens(alg);
  while (t.length && isRotation(t[t.length - 1])) t.pop();
  return t;
};
const displayAlg = (alg: string) => displayTokens(alg).join(" ");
const moveCount = (alg: string) => displayTokens(alg).filter((m) => !isRotation(m)).length;

// ---------------------------------------------------------------- filtering

/**
 * Every case is stored in one fixed presentation — corner at front-right where
 * it is in the U layer, otherwise edge at front — because turning the U layer
 * is free and never changes which case you are looking at. Nobody holds their
 * cube that way by chance, so match the finder's readings against the case in
 * *any* U turn rather than only the stored one. Corner and edge share the turn:
 * it is one cube, so their positions move together. Orientation is unaffected,
 * which is what makes the "cross sticker" and "flipped" answers absolute.
 */
function finderMatches(r: F2LRecognition, f: Finder): boolean {
  for (let auf = 0; auf < 4; auf++) {
    const turn = (p: number) => (p > 3 ? p : (p + auf) % 4);
    if (f.cornerPos !== null && turn(f.cornerPos) !== r.cornerPos) continue;
    if (f.edgePos !== null && turn(f.edgePos) !== r.edgePos) continue;
    if (f.cornerOri !== null && f.cornerOri !== r.cornerOri) continue;
    if (f.edgeOri !== null && f.edgeOri !== r.edgeOri) continue;
    return true;
  }
  return false;
}

/**
 * The running total under the questions. Two of the four answers cannot narrow
 * anything by themselves — any U-layer position matches every U-layer case —
 * so without a total a correct filter reads as a broken one.
 */
function finderProgress(): string {
  const all = SETS.F2L;
  const answered = Object.values(state.finder).filter((v) => v !== null).length;
  const left = all.filter((c) => c.recognition && finderMatches(c.recognition, state.finder)).length;
  if (answered === 0) return `Answer above to narrow all ${all.length} cases down.`;
  // The one reading no case answers to is the pair already solved.
  if (left === 0) return "That pair is already solved — no case to insert.";
  if (left === 1) return "One case left — it is the selected one.";
  return `${left} of ${all.length} cases left.`;
}

function visibleCases(): CubeCase[] {
  const q = state.query.trim().toLowerCase();
  const f = state.finder;
  return SETS[state.set].filter((c) => {
    if (state.group && c.group !== state.group) return false;
    if (state.set === "F2L" && c.recognition && !finderMatches(c.recognition, f)) return false;
    if (!q) return true;
    return (
      c.label.toLowerCase() === q ||
      c.name.toLowerCase().includes(q) ||
      c.group.toLowerCase().includes(q) ||
      (c.hint ?? "").toLowerCase().includes(q) ||
      c.algs.some((a) => displayAlg(a).toLowerCase().includes(q))
    );
  });
}

// ---------------------------------------------------------------- players

/** Cards by case id, so selecting one does not force a grid rebuild. */
const cardElements = new Map<string, HTMLElement>();

type Player = HTMLElement & {
  alg: string;
  experimentalSetupAlg: string;
  experimentalSetupAnchor: string;
  tempoScale: number;
  experimentalStickeringMaskOrbits: unknown;
  experimentalModel: any;
  play(): void;
  pause(): void;
  jumpToStart(): void;
  jumpToEnd(): void;
};

/** The detail panel's player — the only live cube left in the app. */
function makePlayer(c: CubeCase, opts: { detail: boolean; set: CaseSet }): Player {
  const p = document.createElement("twisty-player") as Player;
  p.setAttribute("puzzle", "3x3x3");
  p.setAttribute("alg", c.algs[opts.detail ? state.algIndex : 0] ?? c.algs[0]);
  // The alg *ends* solved, so the player opens on the case itself.
  p.setAttribute("experimental-setup-anchor", "end");
  const setup = SETUP_ALG[state.cross];
  if (setup) p.setAttribute("experimental-setup-alg", setup);
  p.setAttribute("visualization", "3D");
  p.setAttribute("background", "none");
  p.setAttribute("control-panel", "none");
  p.setAttribute("viewer-link", "none");
  p.setAttribute("hint-facelets", "none");
  // Must be assigned as a property — the attribute form is ignored.
  p.experimentalStickeringMaskOrbits = stickeringMask(opts.set, state.cross);
  return p;
}

// ---------------------------------------------------------------- render

function renderSetNav() {
  const nav = $("#setnav");
  nav.replaceChildren();
  for (const s of SET_ORDER) {
    const b = el("button") as HTMLButtonElement;
    b.setAttribute("aria-selected", String(state.set === s));
    b.append(el("span", undefined, s), el("span", "count", String(SETS[s].length)));
    b.onclick = () => {
      state.set = s;
      state.group = null;
      state.selected = SETS[s][0].id;
      state.algIndex = 0;
      state.finder = emptyFinder();
      renderAll();
    };
    nav.append(b);
  }
}

function renderCrossToggle() {
  const host = $("#crosstoggle");
  host.replaceChildren();
  host.title = "Which colour your cross is on";
  for (const c of ["white", "yellow"] as Cross[]) {
    const b = el("button", "cross-btn") as HTMLButtonElement;
    b.setAttribute("aria-pressed", String(state.cross === c));
    b.append(el("span", `swatch swatch-${c}`), el("span", undefined, c === "white" ? "White" : "Yellow"));
    b.onclick = () => {
      if (state.cross === c) return;
      state.cross = c;
      store("cross", c);
      renderAll();
    };
    host.append(b);
  }
}

// ---------------------------------------------------------------- finder options
//
// Each option carries the mini cube that shows what it means. The two "where is
// it" questions light the position up in the accent colour rather than painting
// real stickers, because a position says nothing about which way round the
// piece sits — that is the next question, and it draws the real colours.

type Opt = { v: number; label: string; icon: IconSpec };

/**
 * Which orientation answer each position answer gives its meaning to.
 *
 * "Facing back" is not a fact about a corner, it is a fact about a corner at
 * back-left: the same twist reads as "facing front" once the piece is at
 * front-right. So an orientation question waits for its position (it would
 * otherwise quietly word itself for front-right), and a position that moves
 * afterwards retires the orientation instead of re-labelling the tile the user
 * already picked.
 */
const ORI_OF: Partial<Record<keyof Finder, keyof Finder>> = { cornerPos: "cornerOri", edgePos: "edgeOri" };
const POS_OF: Partial<Record<keyof Finder, keyof Finder>> = { cornerOri: "cornerPos", edgeOri: "edgePos" };
const LOCK_NOTE: Partial<Record<keyof Finder, string>> = {
  cornerOri: "Say where the corner is first — the cross sticker is read against it.",
  edgeOri: "Say where the edge is first.",
};

/** The other piece's answered position, for the position tiles to draw faintly. */
const ghostOf = (kind: "corner" | "edge"): IconSpec["ghost"] => {
  const pos = kind === "corner" ? state.finder.cornerPos : state.finder.edgePos;
  return pos === null ? undefined : { kind, pos };
};

const cornerPosOpts = (): Opt[] =>
  [
    { v: 0, label: "Front-right" },
    { v: 1, label: "Back-right" },
    { v: 2, label: "Back-left" },
    { v: 3, label: "Front-left" },
    { v: 4, label: "In slot" },
  ].map((o) => ({ ...o, icon: { cross: state.cross, spot: { kind: "corner", pos: o.v }, ghost: ghostOf("edge") } }));

const cornerOriOpts = (): Opt[] => {
  // Which face "orientation 1" lands on depends on where the corner is, so the
  // label has to follow the answer above rather than always saying front-right.
  const pos = state.finder.cornerPos ?? 0;
  return [0, 1, 2].map((ori) => ({
    v: ori,
    label: pos === 4 && ori === 0 ? "Already solved" : "Facing " + FACE_WORD[crossFace(pos, ori)],
    icon: { cross: state.cross, piece: { kind: "corner", pos, ori } },
  }));
};

const edgePosOpts = (): Opt[] =>
  [
    { v: 0, label: "Front" },
    { v: 1, label: "Right" },
    { v: 2, label: "Back" },
    { v: 3, label: "Left" },
    { v: 8, label: "In slot" },
  ].map((o) => ({ ...o, icon: { cross: state.cross, spot: { kind: "edge", pos: o.v }, ghost: ghostOf("corner") } }));

const edgeOriOpts = (): Opt[] => {
  const pos = state.finder.edgePos ?? 0;
  return [
    { v: 0, label: "Not flipped" },
    { v: 1, label: "Flipped" },
  ].map((o) => ({ ...o, icon: { cross: state.cross, piece: { kind: "edge", pos, ori: o.v } } }));
};

function optRow<K extends keyof Finder>(k: K, opts: Opt[], cols: number, locked: boolean) {
  const row = el("div", "opt-row");
  row.style.setProperty("--cols", String(cols));
  for (const o of opts) {
    const b = el("button", "opt") as HTMLButtonElement;
    b.disabled = locked;
    b.setAttribute("aria-pressed", String(state.finder[k] === o.v));
    b.append(cubeIcon(o.icon), el("span", "opt-label", o.label));
    b.onclick = () => {
      state.finder[k] = (state.finder[k] === o.v ? null : o.v) as Finder[K];
      const ori = ORI_OF[k];
      if (ori) state.finder[ori] = null;
      ensureSelectionVisible();
      renderAll();
    };
    row.append(b);
  }
  return row;
}

/** How many filters the user has actually set — what the collapsed bar reports. */
function activeFilterCount() {
  const answered = state.set === "F2L" ? Object.values(state.finder).filter((v) => v !== null).length : 0;
  return answered + (state.group === null ? 0 : 1);
}

const isPhone = () => window.matchMedia("(max-width: 760px)").matches;

/** Picking a group is one decision, so on a phone it hands the screen back. */
function collapseOnPhone() {
  if (isPhone()) $("#sidebar").classList.remove("open");
}

function renderSidebar() {
  const side = $("#sidebar");
  side.replaceChildren();

  // The finder is four picture questions tall. Left open above the grid on a
  // phone it swallows the screen and leaves barely one row of cases in view,
  // so there it collapses behind this bar and opens over the grid on demand.
  // Wider layouts hide the bar and keep the column open, as before.
  const toggle = el("button", "side-toggle") as HTMLButtonElement;
  const answers = activeFilterCount();
  side.classList.toggle("filtered", answers > 0);
  toggle.setAttribute("aria-controls", "side-body");
  toggle.setAttribute("aria-expanded", String(side.classList.contains("open")));
  toggle.append(el("span", undefined, state.set === "F2L" ? "Find your case" : "Filter cases"));
  if (answers > 0) toggle.append(el("span", "side-toggle-count", `${answers} active`));
  const chevron = el("span", "side-toggle-chevron");
  chevron.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9.5 12 15.5 18 9.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  toggle.append(chevron);
  toggle.onclick = () => {
    toggle.setAttribute("aria-expanded", String(side.classList.toggle("open")));
  };
  side.append(toggle);

  const body = el("div", "side-body");
  body.id = "side-body";
  side.append(body);

  if (state.set === "F2L") {
    // Redundant on a phone, where the collapse bar already says it — hidden
    // there by CSS rather than by not rendering it, so a resize needs no rerun.
    body.append(el("div", "side-title finder-title", "Find your case"));
    const box = el("div", "finder");
    box.append(
      el(
        "p",
        undefined,
        "Look at your cube as it sits and pick the picture that matches. Turning the top layer is free, so where a piece sits says nothing on its own — what picks the case is how the corner and edge sit relative to each other. All four answers together leave exactly one.",
      ),
    );

    const groups: [string, keyof Finder, Opt[], number][] = [
      ["Corner is at", "cornerPos", cornerPosOpts(), 3],
      ["Corner's cross sticker", "cornerOri", cornerOriOpts(), 3],
      ["Edge is at", "edgePos", edgePosOpts(), 3],
      ["Edge is", "edgeOri", edgeOriOpts(), 2],
    ];
    for (const [label, key, opts, cols] of groups) {
      const pos = POS_OF[key];
      const locked = pos !== undefined && state.finder[pos] === null;
      const g = el("div", "finder-group");
      g.append(el("div", "finder-label", label), optRow(key, opts, cols, locked));
      if (locked) g.append(el("p", "finder-locked", LOCK_NOTE[key]));
      box.append(g);
    }

    box.append(el("p", "finder-count", finderProgress()));

    const reset = el("button", "finder-reset", "Clear finder") as HTMLButtonElement;
    reset.onclick = () => {
      state.finder = emptyFinder();
      renderAll();
    };
    box.append(reset);
    body.append(box);
  }

  const groups = [...new Set(SETS[state.set].map((c) => c.group))];
  body.append(el("div", "side-title", state.set === "F2L" ? "Case type" : "Shape"));
  const list = el("div", "chip-list");

  const all = el("button", "chip") as HTMLButtonElement;
  all.setAttribute("aria-pressed", String(state.group === null));
  all.append(el("span", undefined, "All cases"), el("span", "n", String(SETS[state.set].length)));
  all.onclick = () => {
    state.group = null;
    collapseOnPhone();
    renderAll();
  };
  list.append(all);

  for (const g of groups) {
    const n = SETS[state.set].filter((c) => c.group === g).length;
    const b = el("button", "chip") as HTMLButtonElement;
    b.setAttribute("aria-pressed", String(state.group === g));
    b.append(el("span", undefined, g), el("span", "n", String(n)));
    b.onclick = () => {
      state.group = state.group === g ? null : g;
      collapseOnPhone();
      renderAll();
    };
    list.append(b);
  }
  body.append(list);
}

/** Keep a case selected so the detail panel (and its player) stays on screen. */
function ensureSelectionVisible() {
  const visible = visibleCases();
  if (!visible.length) return;
  if (!visible.some((c) => c.id === state.selected)) {
    state.selected = visible[0].id;
    state.algIndex = 0;
  }
}

function renderGrid() {
  const grid = $("#grid");
  const cases = visibleCases();
  grid.replaceChildren();
  cardElements.clear();

  $("#grid-title").textContent = state.set;
  $("#grid-count").textContent = `${cases.length} of ${SETS[state.set].length} cases · ${BLURB[state.set]}`;
  ($("#empty") as HTMLElement).hidden = cases.length > 0;

  // Cases are stored in their conventional numeric order, in which groups
  // interleave (OLL 1-4 and 17-20 are all dots). Bucket them so each group
  // heading appears exactly once.
  const buckets = new Map<string, CubeCase[]>();
  for (const c of cases) {
    const b = buckets.get(c.group);
    if (b) b.push(c);
    else buckets.set(c.group, [c]);
  }

  for (const [group, members] of buckets) {
    if (!state.group) grid.append(el("div", "group-head", group));
    for (const c of members) renderCard(c, grid);
  }
}

function renderCard(c: CubeCase, grid: HTMLElement) {
  const card = el("button", "case") as HTMLButtonElement;
  card.setAttribute("aria-current", String(state.selected === c.id));
  card.title = c.name;

  const thumb = el("div", "thumb");
  const colours = THUMBS[c.id][state.cross];
  thumb.append(state.set === "F2L" ? cubeThumb(colours) : llThumb(colours));

  const foot = el("div", "case-foot");
  foot.append(
    el("span", "case-label", state.set === "F2L" ? c.label : `${state.set} ${c.label}`),
    el("span", "case-sub", `${moveCount(c.algs[0])}`),
  );
  card.append(thumb, foot);
  card.onclick = () => {
    state.selected = c.id;
    state.algIndex = 0;
    // Moving the highlight does not need the grid rebuilt.
    updateSelection();
    renderDetail();
    $("#detail").classList.add("open");
  };
  grid.append(card);
  cardElements.set(c.id, card);
}

function updateSelection() {
  for (const [id, card] of cardElements) {
    card.setAttribute("aria-current", String(state.selected === id));
  }
}

const ICONS = {
  restart: `<path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" fill="currentColor"/>`,
  prev: `<path d="M8 6h2.2v12H8zM19 6v12l-8-6z" fill="currentColor"/>`,
  next: `<path d="M13.8 6H16v12h-2.2zM5 6l8 6-8 6z" fill="currentColor"/>`,
  play: `<path d="M8 5l11 7-11 7z" fill="currentColor"/>`,
  pause: `<path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z" fill="currentColor"/>`,
  end: `<path d="M6 5l9 7-9 7zM16.8 5H19v14h-2.2z" fill="currentColor"/>`,
};
const iconBtn = (path: string, label: string) => {
  const b = el("button", "tbtn") as HTMLButtonElement;
  b.title = label;
  b.setAttribute("aria-label", label);
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
  return b;
};

// ------------------------------------------------------------- option icons
//
// "Hint stickers" and "Back view" both describe something the cube *looks like*
// once they are on, which a word can only approximate. Each toggle therefore
// draws its own answer, in the same isometric projection the finder icons use
// so that a cube reads as the same cube everywhere in the app.

/** Isometric projection of a unit cube, centred on (cx, cy) with radius `s`. */
const isoCube = (cx: number, cy: number, s: number) => {
  const at = (x: number, y: number) => `${(cx + x * s).toFixed(2)},${(cy + y * s).toFixed(2)}`;
  const top = at(0, -1);
  const upRight = at(0.866, -0.5);
  const downRight = at(0.866, 0.5);
  const bottom = at(0, 1);
  const downLeft = at(-0.866, 0.5);
  const upLeft = at(-0.866, -0.5);
  const middle = at(0, 0);
  // The faces are filled with currentColor at three opacities: a flat fill would
  // read as a hexagon, and inheriting the colour lets the button tint the whole
  // diagram when it is pressed.
  return (
    `<polygon points="${top} ${upRight} ${middle} ${upLeft}" fill="currentColor"/>` +
    `<polygon points="${middle} ${upRight} ${downRight} ${bottom}" fill="currentColor" opacity=".72"/>` +
    `<polygon points="${upLeft} ${middle} ${bottom} ${downLeft}" fill="currentColor" opacity=".45"/>`
  );
};

/** One floating hint sticker: a face's rhombus, lifted clear of the cube. */
const ghostSticker = (cx: number, cy: number, s: number) => {
  const at = (x: number, y: number) => `${(cx + x * s).toFixed(2)},${(cy + y * s).toFixed(2)}`;
  return (
    `<polygon points="${at(0, -0.5)} ${at(0.866, 0)} ${at(0, 0.5)} ${at(-0.866, 0)}" ` +
    `fill="currentColor" opacity=".42"/>`
  );
};

const OPT_ICONS = {
  // Stickers off the faces you cannot see, hovering just clear of the cube —
  // which is what the player's "floating" hint facelets actually look like.
  hint: isoCube(11.5, 14.2, 6.6) + ghostSticker(4.9, 7.5, 4.1) + ghostSticker(18.6, 8.3, 4.1),
  // A second, smaller cube parked in the corner, where the back view goes.
  back: isoCube(9.6, 14.4, 6.8) + isoCube(18.1, 6.4, 4.2),
};

/**
 * A TwistyPlayer builds its 3D view exactly once, when a shared IntersectionObserver
 * inside cubing.js first reports it on screen, and it guards that with a flag it
 * never resets (upstream comment: "TODO: support resetting"). Detaching a player
 * from the DOM therefore kills it permanently — re-inserting does not bring it back.
 *
 * So the detail panel is built once and then *updated in place*. The player is
 * created during the initial render and never removed; only text, chips and the
 * algorithm list are rebuilt when you pick a different case.
 */
type DetailShell = {
  empty: HTMLElement;
  inner: HTMLElement;
  eyebrow: HTMLElement;
  title: HTMLElement;
  player: Player;
  play: HTMLButtonElement;
  scrub: HTMLInputElement;
  chipRow: HTMLElement;
  startDot: HTMLButtonElement;
  speed: HTMLInputElement;
  speedOut: HTMLElement;
  hint: HTMLElement;
  algLabel: HTMLElement;
  algList: HTMLElement;
  chips: HTMLButtonElement[];
};

let shell: DetailShell | null = null;
/**
 * Where the chip row can park the timeline. `stops[0]` is the case as it
 * arrives, and `stops[i + 1]` is the cube once move `i` has been turned — so
 * there is always one stop more than there are moves, which is why the row opens
 * with a dot. A chip means "the cube after this move", never "the cube waiting
 * to do it".
 */
let stops: Promise<number[]> = Promise.resolve([0]);
let timeRange = { start: 0, end: 1 };
let scrubbing = false;

/** Paint a range input's accent fill up to wherever its thumb currently sits. */
const paintRange = (input: HTMLInputElement) => {
  const min = Number(input.min);
  const max = Number(input.max);
  const fraction = max > min ? (Number(input.value) - min) / (max - min) : 0;
  input.style.setProperty("--fill", `${Math.max(0, Math.min(100, fraction * 100))}%`);
};

// ------------------------------------------------------------- chip seeking
//
// Clicking a marker in the row used to snap the cube straight to that point,
// which makes everything you skipped invisible. Instead the timeline is driven
// by hand, so the turns you asked to travel through are still turns you watch.

/** Fast-forward is at least this much quicker than normal playback... */
const FF_SCALE = 3;
/** ...and never takes longer than this many milliseconds, however far it travels. */
const FF_BUDGET = 700;

let seekRaf: number | null = null;
/** Bumped by every transport command, so a slower one can tell it was superseded. */
let transportSeq = 0;

/**
 * Abort a running seek, and invalidate any transport command still waiting on a
 * promise. Every transport control calls this first, so the token it returns
 * also tells the slower handlers — `step`, a move chip — that a newer command
 * has arrived and they must stop before touching the player.
 */
function cancelSeek() {
  if (seekRaf !== null) cancelAnimationFrame(seekRaf);
  seekRaf = null;
  return ++transportSeq;
}

/** How far a timestamp may sit from a stop and still count as standing on it. */
const EPS = 1;

/** The stop the timeline is standing on, or the last one it went past. */
const currentStop = (list: number[], timestamp: number) => {
  let i = 0;
  for (let k = 0; k < list.length; k++) if (list[k] <= timestamp + EPS) i = k;
  return i;
};

/** One stretch of a seek: where it ends, and how fast to cover it. */
type SeekLeg = { to: number; rate: number };

/**
 * Walk the timeline through `legs` instead of jumping to the end of them. `rate`
 * is timeline-ms per real-ms — the same unit as the player's tempoScale, so a
 * rate of `state.speed` is indistinguishable from ordinary playback.
 */
function seekAlong(p: Player, from: number, legs: SeekLeg[]) {
  cancelSeek();
  p.pause();
  const runLeg = (index: number, start: number) => {
    const leg = legs[index];
    if (!leg) return void (seekRaf = null);
    const span = leg.to - start;
    if (!span) return runLeg(index + 1, start);
    // Position is derived from the wall clock rather than accumulated per frame,
    // so a slow device drops frames instead of dragging the seek out, and a tab
    // that was hidden mid-seek simply arrives.
    const duration = Math.abs(span) / leg.rate;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      p.experimentalModel.timestampRequest.set(start + span * progress);
      if (progress < 1) seekRaf = requestAnimationFrame(tick);
      else runLeg(index + 1, leg.to);
    };
    seekRaf = requestAnimationFrame(tick);
  };
  runLeg(0, from);
}

/**
 * Walk the cube to a stop, which is what clicking any marker in the row does.
 * A neighbouring stop is one ordinary move away, so it simply plays. Anything
 * further away is fast-forwarded as far as the stop before the one you clicked,
 * and the move that actually lands you there plays at the normal tempo.
 */
async function seekToStop(p: Player, target: number) {
  const seq = cancelSeek();
  const list = await stops;
  const to = list[target] ?? 0;
  const { timestamp } = await p.experimentalModel.detailedTimelineInfo.get();
  if (seq !== transportSeq) return;
  const cur = currentStop(list, timestamp);
  if (Math.abs(target - cur) <= 1) return seekAlong(p, timestamp, [{ to, rate: state.speed }]);
  const handoff = list[target > cur ? target - 1 : target + 1];
  const rate = Math.max(state.speed * FF_SCALE, Math.abs(handoff - timestamp) / FF_BUDGET);
  seekAlong(p, timestamp, [
    { to: handoff, rate },
    { to, rate: state.speed },
  ]);
}

/**
 * What the player is currently showing. Requesting a timestamp — scrubbing, the
 * step buttons, a move chip — leaves that request standing on the model, so a
 * newly picked case would otherwise open part-way through its alg.
 */
let shownKey = "";

/** Point the persistent player at a different case. */
function configurePlayer(p: Player, c: CubeCase, set: CaseSet) {
  cancelSeek();
  // Attributes, not property assignment: the thumbnails are configured this way
  // and render reliably, whereas assigning `alg` as a property does not.
  p.setAttribute("alg", c.algs[state.algIndex] ?? c.algs[0]);
  p.setAttribute("experimental-setup-anchor", "end");
  const setup = SETUP_ALG[state.cross];
  if (setup) p.setAttribute("experimental-setup-alg", setup);
  else p.removeAttribute("experimental-setup-alg");
  p.experimentalStickeringMaskOrbits = stickeringMask(set, state.cross);
  p.tempoScale = state.speed;
  stops = p.experimentalModel.indexer.get().then((indexer: any) => [
    // A move's start is also the previous move's finish, so the starts double as
    // the stops for every move but the last — which finishes where the alg does.
    ...Array.from({ length: indexer.numAnimatedLeaves() }, (_, k) => indexer.indexToMoveStartTimestamp(k)),
    indexer.algDuration(),
  ]);

  // Rewind only when the player is pointed somewhere new: renderDetail() also runs
  // on every search keystroke and filter click, which must not interrupt playback.
  const key = `${set}/${c.id}/${state.algIndex}/${state.cross}`;
  if (key === shownKey) return;
  shownKey = key;
  p.pause();
  // jumpToStart() parks the timeline on the keyword "start" rather than a number,
  // so it stays anchored even as the new alg's own length settles in.
  p.jumpToStart();
}

function buildDetailShell(): DetailShell {
  const host = $("#detail");
  host.replaceChildren();

  const empty = el("div", "detail-empty");
  empty.append(
    el("p", undefined, "Pick a case to see it in 3D."),
    el(
      "p",
      undefined,
      "Every algorithm here is verified against a cube model — all three sets are provably complete.",
    ),
  );
  host.append(empty);

  const inner = el("div", "detail-inner");
  const close = el("button", "close-detail", "← Back to cases") as HTMLButtonElement;
  close.onclick = () => host.classList.remove("open");
  const eyebrow = el("div", "eyebrow");
  const title = el("h2");
  inner.append(close, eyebrow, title);

  const wrap = el("div", "player-wrap");
  inner.append(wrap);

  const transport = el("div", "transport");
  const bRestart = iconBtn(ICONS.restart, "Restart");
  const bPrev = iconBtn(ICONS.prev, "Previous move");
  const play = iconBtn(ICONS.play, "Play");
  play.classList.add("tbtn-primary");
  const bNext = iconBtn(ICONS.next, "Next move");
  const bEnd = iconBtn(ICONS.end, "Jump to solved");
  /**
   * The button's face, painted from what we just asked the player to do and then
   * corrected by the player itself. Waiting for the player to answer would leave
   * the icon lagging behind the click, because it batches its notifications to
   * the end of the tick — and a background tab stretches that tick out.
   */
  const paintPlay = (isPlaying: boolean) => {
    play.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${isPlaying ? ICONS.pause : ICONS.play}</svg>`;
    play.title = isPlaying ? "Pause" : "Play";
    play.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  };
  const scrub = el("input", "scrub") as HTMLInputElement;
  scrub.type = "range";
  scrub.min = "0";
  scrub.max = "1000";
  scrub.value = "0";
  scrub.setAttribute("aria-label", "Scrub through the algorithm");
  transport.append(bRestart, bPrev, play, bNext, bEnd, scrub);
  inner.append(transport);

  const chipRow = el("div", "chips");
  inner.append(chipRow);

  const optStrip = el("div", "opt-strip");
  const speedGroup = el("div", "opt-speed");
  const speed = el("input", "speed") as HTMLInputElement;
  speed.type = "range";
  speed.min = String(SPEED_MIN);
  speed.max = String(SPEED_MAX);
  speed.step = String(SPEED_STEP);
  speed.value = String(state.speed);
  speed.setAttribute("aria-label", "Playback speed");
  const speedOut = el("span", "speed-val", `${state.speed}×`);
  // The track is filled from the JS side, so it has to be painted once up front
  // as well — the stored speed is rarely the one the stylesheet would guess.
  paintRange(speed);
  speedGroup.append(el("span", "speed-label", "Speed"), speed, speedOut);

  const toggle = (label: string, icon: string, onChange: (on: boolean) => void) => {
    const b = el("button", "opt-toggle") as HTMLButtonElement;
    b.type = "button";
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;
    b.append(el("span", undefined, label));
    b.onclick = () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(on));
      onChange(on);
    };
    return b;
  };
  const toggles = el("div", "opt-toggles");
  toggles.append(
    toggle("Hint stickers", OPT_ICONS.hint, (on) =>
      shell?.player.setAttribute("hint-facelets", on ? "floating" : "none"),
    ),
    toggle("Back view", OPT_ICONS.back, (on) =>
      shell?.player.setAttribute("back-view", on ? "top-right" : "none"),
    ),
  );
  optStrip.append(speedGroup, toggles);
  inner.append(optStrip);

  const hint = el("p", "detail-hint");
  const algLabel = el("div", "section-label", "Algorithm");
  const algList = el("div", "alg-list");
  inner.append(hint, algLabel, algList);

  host.append(inner);

  // Created only now that its container is attached, during the first render.
  const player = makePlayer(SETS[state.set][0], { detail: true, set: state.set });
  wrap.append(player);

  /**
   * The row lists positions, not moves. Without the dot the first chip has to
   * stand in for "nothing has happened yet" as well as for its own move, so R
   * sits lit before the R has been turned and clicking it looks like it does
   * nothing at all.
   */
  const startDot = el("button", "chip-start") as HTMLButtonElement;
  startDot.type = "button";
  startDot.title = "Back to the start";
  startDot.setAttribute("aria-label", "Back to the start");
  startDot.onclick = () => void seekToStop(player, 0);
  chipRow.append(startDot);

  const built: DetailShell = {
    empty, inner, eyebrow, title, player, play, scrub, chipRow, startDot,
    speed, speedOut, hint, algLabel, algList, chips: [],
  };

  speed.oninput = () => {
    state.speed = clampSpeed(speed.value);
    store("speed", state.speed);
    player.tempoScale = state.speed;
    speedOut.textContent = `${state.speed}×`;
    paintRange(speed);
  };

  bRestart.onclick = () => {
    cancelSeek();
    player.jumpToStart();
  };
  bEnd.onclick = () => {
    cancelSeek();
    player.jumpToEnd();
  };
  /**
   * Whether the cube is playing is read back from the player on every click,
   * never from a copy kept on this side.
   *
   * The player only notifies a listener when the value it is handed differs from
   * the one that listener last saw, and it batches the notification to the end of
   * the tick — so a burst of transport commands that settles back on the value
   * already delivered produces no notification at all. A cached flag can miss a
   * transition permanently that way, and this button used to do exactly that:
   * once its copy said "playing" while the player was paused, every further
   * click asked an already-paused player to pause, which changes nothing and so
   * notifies nobody. The button stayed stuck until the page was reloaded.
   */
  play.onclick = async () => {
    const seq = cancelSeek();
    const model = player.experimentalModel;
    const { playing } = await model.playingInfo.get();
    if (seq !== transportSeq) return;
    if (playing) {
      player.pause();
      return paintPlay(false);
    }
    // Hitting play while parked on the solved state should replay the case.
    const { atEnd } = await model.detailedTimelineInfo.get();
    if (seq !== transportSeq) return;
    if (atEnd) player.jumpToStart();
    player.play();
    paintPlay(true);
  };

  const step = async (delta: number) => {
    const seq = cancelSeek();
    const list = await stops;
    const info = await player.experimentalModel.detailedTimelineInfo.get();
    if (seq !== transportSeq) return;
    player.pause();
    if (delta > 0) {
      const next = list.find((t) => t > info.timestamp + EPS);
      if (next === undefined) player.jumpToEnd();
      else player.experimentalModel.timestampRequest.set(next);
    } else {
      const before = list.filter((t) => t < info.timestamp - EPS);
      if (!before.length) player.jumpToStart();
      else player.experimentalModel.timestampRequest.set(before[before.length - 1]);
    }
  };
  bPrev.onclick = () => void step(-1);
  bNext.onclick = () => void step(1);

  const seek = () => {
    const fraction = Number(scrub.value) / 1000;
    paintRange(scrub);
    player.experimentalModel.timestampRequest.set(
      timeRange.start + fraction * (timeRange.end - timeRange.start),
    );
  };
  scrub.oninput = () => {
    cancelSeek();
    scrubbing = true;
    player.pause();
    seek();
  };
  scrub.onchange = () => {
    seek();
    scrubbing = false;
  };

  const model = player.experimentalModel;
  // Presentation only — what the button *does* is decided by reading the player
  // back, so a notification this listener never receives cannot wedge anything.
  model.playingInfo.addFreshListener((info: { playing: boolean }) => paintPlay(info.playing));

  model.detailedTimelineInfo.addFreshListener(
    (info: { timestamp: number; timeRange: { start: number; end: number }; atEnd: boolean }) => {
      timeRange = info.timeRange;
      const span = timeRange.end - timeRange.start || 1;
      const fraction = (info.timestamp - timeRange.start) / span;
      if (!scrubbing) {
        scrub.value = String(Math.round(fraction * 1000));
        paintRange(scrub);
      }
      void stops.then((list) => {
        if (!built.chips.length) return;
        const at = info.atEnd ? built.chips.length : currentStop(list, info.timestamp);
        // Mid-turn the cube stands on neither marker: it has left `at` and has
        // not arrived at the next one, so that move is outlined rather than lit.
        const turning = at < built.chips.length && info.timestamp > list[at] + EPS ? at : -1;
        built.startDot.classList.toggle("current", at === 0);
        built.chips.forEach((chip, n) => {
          chip.classList.toggle("current", n === at - 1);
          chip.classList.toggle("turning", n === turning);
        });
      });
    },
  );

  return built;
}

function renderDetail() {
  shell ??= buildDetailShell();
  const s = shell;
  const c = SETS[state.set].find((x) => x.id === state.selected);

  s.empty.hidden = !!c;
  // The player must stay in the document, so the panel is hidden rather than removed.
  s.inner.style.display = c ? "" : "none";
  if (!c) return;

  s.eyebrow.textContent = `${state.set} ${c.label}`;
  s.title.textContent = c.name;
  s.hint.textContent = c.hint ?? "";
  s.hint.hidden = !c.hint;

  const alg = c.algs[state.algIndex] ?? c.algs[0];
  s.chipRow.replaceChildren(s.startDot);
  s.chips = displayTokens(alg).map((m, i) => {
    const chip = el("button", "chip-move", m) as HTMLButtonElement;
    chip.title = `Play through ${m}`;
    chip.onclick = () => void seekToStop(s.player, i + 1);
    s.chipRow.append(chip);
    return chip;
  });

  s.algLabel.textContent = c.algs.length > 1 ? "Algorithms" : "Algorithm";
  s.algList.replaceChildren();
  c.algs.forEach((a, i) => {
    const row = el("button", "alg-block") as HTMLButtonElement;
    row.setAttribute("aria-current", String(i === state.algIndex));
    row.append(el("span", "alg-text", displayAlg(a)), el("span", "alg-meta", `${moveCount(a)} moves`));
    const copy = el("button", "copy-btn", "Copy") as HTMLButtonElement;
    copy.onclick = (ev) => {
      ev.stopPropagation();
      navigator.clipboard?.writeText(displayAlg(a));
      copy.textContent = "Copied";
      setTimeout(() => (copy.textContent = "Copy"), 1200);
    };
    row.append(copy);
    row.onclick = () => {
      state.algIndex = i;
      renderDetail();
    };
    s.algList.append(row);
  });

  configurePlayer(s.player, c, state.set);
}

function renderAll() {
  renderSetNav();
  renderCrossToggle();
  renderSidebar();
  renderDetail();
  renderGrid();
}

// ---------------------------------------------------------------- events

const search = $("#search") as HTMLInputElement;
search.addEventListener("input", () => {
  state.query = search.value;
  ensureSelectionVisible();
  renderGrid();
  updateSelection();
  renderDetail();
});

// ---------------------------------------------------------------- support

/**
 * The title bar's support affordance: one coffee icon opening a card that
 * carries both ways to chip in, so the bar spends a single slot rather than
 * letting two links compete for it.
 *
 * The card is anchored to the button in CSS rather than positioned against the
 * viewport, which the topbar allows because it never scrolls -- it is a fixed
 * row of the #app flex column. A resize can still move the button out from
 * under it, so that closes it.
 */
const SUPPORT_CARD_W = 268;

const supportBtn = $<HTMLButtonElement>("#supportbtn");
const supportCard = $("#supportcard");

/**
 * Right-align the card to the button, then clamp it into the viewport. The bar
 * wraps differently at every width and the button moves with it, so a card
 * anchored to the button in CSS alone hangs off an edge as soon as the button
 * is within a card's width of one -- which on a phone it always is.
 */
function placeSupportCard() {
  const b = supportBtn.getBoundingClientRect();
  const left = Math.min(b.right - SUPPORT_CARD_W, window.innerWidth - SUPPORT_CARD_W - 8);
  supportCard.style.left = `${Math.max(8, left)}px`;
  supportCard.style.top = `${b.bottom + 9}px`;
}

function setSupportOpen(open: boolean) {
  if (open) placeSupportCard();
  supportCard.hidden = !open;
  supportBtn.setAttribute("aria-expanded", String(open));
}

supportBtn.onclick = () => setSupportOpen(supportCard.hidden);

// Capture phase: the grid and the finder both stop propagation on their own
// pointer handlers, and a click on either should still shut the card.
document.addEventListener(
  "pointerdown",
  (e) => {
    if (supportCard.hidden) return;
    const t = e.target as Node;
    if (supportCard.contains(t) || supportBtn.contains(t)) return;
    setSupportOpen(false);
  },
  true,
);

// Follow the button rather than close. On a phone the URL bar sliding away
// fires resize, and a card that dismissed itself mid-scroll would read as a bug.
window.addEventListener("resize", () => {
  if (!supportCard.hidden) placeSupportCard();
});

document.addEventListener("keydown", (e) => {
  const typing = document.activeElement === search;
  if (e.key === "/" && !typing) {
    e.preventDefault();
    search.focus();
    search.select();
  }
  if (e.key === "Escape") {
    // Whatever is topmost wins, so the card needs no key of its own.
    if (!supportCard.hidden) {
      setSupportOpen(false);
    } else if (typing && search.value) {
      search.value = "";
      state.query = "";
      renderGrid();
    } else {
      $("#detail").classList.remove("open");
      $("#sidebar").classList.remove("open");
    }
  }
  if (e.key === " " && !typing && state.selected) {
    const btn = document.querySelector(".transport .tbtn-primary") as HTMLButtonElement | null;
    if (btn) {
      e.preventDefault();
      btn.click();
    }
  }
});

renderAll();
