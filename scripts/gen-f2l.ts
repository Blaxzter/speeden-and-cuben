/**
 * Derive all 41 F2L cases and an optimal solution for each.
 *
 * Search only <R, U, F>: the BL slot lives in none of those layers, so it can
 * never be disturbed, and every FR-slot case is still reachable.
 *
 * Last-layer pieces are irrelevant to an F2L case, so they collapse to a
 * wildcard. That makes the case space tiny (5x3 corner placements x 5x2 edge
 * placements = 150 states, 42 classes up to AUF) and lets us enumerate targets
 * directly instead of blindly expanding a BFS frontier until it eats the heap.
 *
 * Solutions come from meet-in-the-middle: a table of everything reachable from
 * solved in <=6 moves, plus a <=6 move search out of each case. That reaches
 * 12 moves using a table of only ~10^5 entries.
 */
import { cube3x3x3 } from "cubing/puzzles";
import { writeFileSync } from "node:fs";

const kpuzzle = await cube3x3x3.kpuzzle();
const solvedPattern = kpuzzle.defaultPattern();
const MOVES = ["R", "R2", "R'", "U", "U2", "U'", "F", "F2", "F'"];
const U_MOVE = 3;
const WILD = -1;

type Perm = { ep: number[]; eo: number[]; cp: number[]; co: number[] };
const table: Perm[] = MOVES.map((m) => {
  const p = solvedPattern.applyAlg(m) as any;
  return {
    ep: p.patternData.EDGES.pieces.slice(),
    eo: p.patternData.EDGES.orientation.slice(),
    cp: p.patternData.CORNERS.pieces.slice(),
    co: p.patternData.CORNERS.orientation.slice(),
  };
});

type State = { ep: number[]; eo: number[]; cp: number[]; co: number[] };

const apply = (s: State, m: Perm): State => ({
  ep: m.ep.map((src) => s.ep[src]),
  eo: m.ep.map((src, i) => (s.eo[src] + m.eo[i]) % 2),
  cp: m.cp.map((src) => s.cp[src]),
  co: m.cp.map((src, i) => (s.co[src] + m.co[i]) % 3),
});

const key = (s: State) => {
  let k = "";
  for (let i = 0; i < 12; i++) k += s.ep[i] >= 4 ? String(s.ep[i]) + String(s.eo[i]) : "x";
  for (let i = 0; i < 8; i++) k += s.cp[i] >= 4 ? String(s.cp[i]) + String(s.co[i]) : "y";
  return k;
};

const identity = (): State => ({
  ep: [...Array(12).keys()],
  eo: Array(12).fill(0),
  cp: [...Array(8).keys()],
  co: Array(8).fill(0),
});

// The hints below assume orientation is measured so that U/D turns preserve it
// (orientation 0 for a U-layer corner therefore means the cross colour faces up).
{
  const after = apply(identity(), table[U_MOVE]);
  const ok = after.co.every((v) => v === 0) && after.eo.every((v) => v === 0);
  console.error("convention check: U preserves all orientations = " + ok);
  if (!ok) throw new Error("unexpected orientation convention");
}

const CORNER_POS = [0, 1, 2, 3, 4]; // 0..3 = U layer (UFR, URB, UBL, UFL), 4 = FR slot
const EDGE_POS = [0, 1, 2, 3, 8]; // 0..3 = U layer (UF, UR, UB, UL), 8 = FR slot

function buildCase(cPos: number, cOri: number, ePos: number, eOri: number): State {
  const s: State = {
    ep: [WILD, WILD, WILD, WILD, 4, 5, 6, 7, WILD, 9, 10, 11],
    eo: Array(12).fill(0),
    cp: [WILD, WILD, WILD, WILD, WILD, 5, 6, 7],
    co: Array(8).fill(0),
  };
  s.cp[cPos] = 4;
  s.co[cPos] = cOri;
  s.ep[ePos] = 8;
  s.eo[ePos] = eOri;
  return s;
}

const sigOf = (s: State) => {
  const cPos = s.cp.indexOf(4);
  const ePos = s.ep.indexOf(8);
  return [cPos, s.co[cPos], ePos, s.eo[ePos]].join(",");
};

const canonOf = (s: State) => {
  const forms: string[] = [];
  let t = s;
  for (let k = 0; k < 4; k++) {
    forms.push(sigOf(t));
    t = apply(t, table[U_MOVE]);
  }
  return forms.sort()[0];
};

/**
 * Every case is shown from one fixed camera, so pick the AUF representative that
 * puts the pieces where you can actually see them: corner at front-right when it
 * is in the U layer, otherwise the edge at front. AUF is free, so this only
 * changes how the case is presented, never which case it is.
 */
const presentation = (s: State) => {
  const cPos = s.cp.indexOf(4);
  const ePos = s.ep.indexOf(8);
  if (cPos !== 4) return cPos === 0 ? 0 : 1;
  return ePos === 0 || ePos === 8 ? 0 : 1;
};

const classes = new Map<string, State>();
for (const cPos of CORNER_POS) {
  for (let cOri = 0; cOri < 3; cOri++) {
    for (const ePos of EDGE_POS) {
      for (let eOri = 0; eOri < 2; eOri++) {
        if (cPos === 4 && cOri === 0 && ePos === 8 && eOri === 0) continue; // solved
        const s = buildCase(cPos, cOri, ePos, eOri);
        const c = canonOf(s);
        const prev = classes.get(c);
        if (!prev || presentation(s) < presentation(prev)) classes.set(c, s);
      }
    }
  }
}
console.error("enumerated " + classes.size + " F2L case classes (expect 41)");

const TABLE_DEPTH = 6;
const SEARCH_DEPTH = 6;

const startQ: State = (() => {
  const s = identity();
  return { ...s, ep: s.ep.map((p) => (p >= 4 ? p : WILD)), cp: s.cp.map((p) => (p >= 4 ? p : WILD)) };
})();

const fwd = new Map<string, string[]>([[key(startQ), []]]);
{
  let frontier: { s: State; path: string[] }[] = [{ s: startQ, path: [] }];
  for (let d = 1; d <= TABLE_DEPTH; d++) {
    const next: { s: State; path: string[] }[] = [];
    for (const { s, path } of frontier) {
      const last = path.length ? path[path.length - 1][0] : "";
      for (let mi = 0; mi < MOVES.length; mi++) {
        if (MOVES[mi][0] === last) continue;
        const ns = apply(s, table[mi]);
        const k = key(ns);
        if (fwd.has(k)) continue;
        const np = [...path, MOVES[mi]];
        fwd.set(k, np);
        next.push({ s: ns, path: np });
      }
    }
    frontier = next;
  }
  console.error("forward table: " + fwd.size + " states within " + TABLE_DEPTH + " moves");
}

const invert = (path: string[]) =>
  path
    .slice()
    .reverse()
    .map((m) => (m.endsWith("2") ? m : m.endsWith("'") ? m[0] : m + "'"));

// Prefer algs that read like the ones cubers actually use: shorter first, then
// fewer F moves, then a leading U (the AUF) rather than a U buried mid-alg.
const score = (a: string[]) =>
  a.length * 100 + a.filter((m) => m[0] === "F").length * 10 - (a[0] && a[0][0] === "U" ? 1 : 0);

function solve(target: State): string[] {
  let best: string[] | null = null;
  const walk = (s: State, q: string[], depth: number) => {
    const hit = fwd.get(key(s));
    if (hit) {
      const cand = [...q, ...invert(hit)];
      if (!best || score(cand) < score(best)) best = cand;
    }
    if (depth === 0) return;
    const last = q.length ? q[q.length - 1][0] : "";
    for (let mi = 0; mi < MOVES.length; mi++) {
      if (MOVES[mi][0] === last) continue;
      walk(apply(s, table[mi]), [...q, MOVES[mi]], depth - 1);
    }
  };
  for (let d = 0; d <= SEARCH_DEPTH; d++) {
    walk(target, [], d);
    if (best) break;
  }
  if (!best) throw new Error("no solution within " + (TABLE_DEPTH + SEARCH_DEPTH) + " moves");
  return best;
}

const CNAME = ["front-right", "back-right", "back-left", "front-left", "the slot"];
const ENAME = ["front", "right", "back", "left"];

const results = classes.size
  ? [...classes.values()].map((s) => {
      const moves = solve(s);
      const alg = moves.join(" ");
      const cPos = s.cp.indexOf(4);
      const ePos = s.ep.indexOf(8);
      const cOri = s.co[cPos];
      const eOri = s.eo[ePos];
      const cornerIn = cPos === 4;
      const edgeIn = ePos === 8;
      const group = cornerIn && edgeIn
        ? "Both pieces in the slot"
        : cornerIn
          ? "Corner in slot, edge in U layer"
          : edgeIn
            ? "Edge in slot, corner in U layer"
            : "Both pieces in the U layer";
      // Orientation wording derived empirically in scripts/probe-ori.ts:
      // at UFR  0 = cross colour up,    1 = on the right face, 2 = on the front face
      // at DFR  0 = correctly in place, 1 = on the front face, 2 = on the right face
      const U_ORI = ["facing up", "facing right", "facing front"];
      const SLOT_ORI = ["", "facing front", "facing right"];
      const cDesc = cornerIn
        ? cOri === 0
          ? "Corner is already solved in the slot"
          : "Corner is in the slot but twisted, cross colour " + SLOT_ORI[cOri]
        : "Corner in the U layer at " + CNAME[cPos] + ", cross colour " + U_ORI[cOri];
      const eDesc = edgeIn
        ? eOri === 1
          ? "edge is in the slot but flipped"
          : "edge is already solved in the slot"
        : "edge in the U layer at " + ENAME[ePos] + (eOri === 1 ? ", flipped" : "");
      const SHORT_E = ["F", "R", "B", "L"];
      const edgeShort = edgeIn
        ? eOri
          ? "edge in slot, flipped"
          : "edge solved"
        : "edge " + SHORT_E[ePos] + (eOri ? " flipped" : "");
      const cornerShort = cornerIn
        ? cOri === 0
          ? "Corner solved"
          : "Corner twisted " + SLOT_ORI[cOri].replace("facing ", "")
        : "Cross " + U_ORI[cOri].replace("facing ", "");
      const name = cornerShort + " · " + edgeShort;
      return {
        alg,
        group,
        name,
        hint: cDesc + "; " + eDesc + ".",
        len: moves.length,
        rec: { cornerPos: cPos, cornerOri: cOri, edgePos: ePos, edgeOri: eOri },
      };
    })
  : [];

const ORDER = [
  "Both pieces in the U layer",
  "Corner in slot, edge in U layer",
  "Edge in slot, corner in U layer",
  "Both pieces in the slot",
];
results.sort(
  (a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group) || a.len - b.len || a.alg.localeCompare(b.alg),
);

const out = ['import type { CubeCase } from "./types";', "", "export const F2L_CASES: CubeCase[] = ["];
results.forEach((r, i) => {
  const n = i + 1;
  const id = "f2l-" + String(n).padStart(2, "0");
  out.push('  { id: "' + id + '", label: "' + n + '", name: "' + r.name + '", group: "' + r.group + '", hint: "' + r.hint + '",');
  out.push('    algs: ["' + r.alg + '"],');
  out.push(
    "    recognition: { cornerPos: " + r.rec.cornerPos + ", cornerOri: " + r.rec.cornerOri +
      ", edgePos: " + r.rec.edgePos + ", edgeOri: " + r.rec.edgeOri + " } },",
  );
});
out.push("];", "");
writeFileSync("src/data/f2l.ts", out.join("\n"));
console.error("\nwrote " + results.length + " cases; longest alg = " + Math.max(...results.map((r) => r.len)) + " moves");
