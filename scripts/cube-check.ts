import { cube3x3x3 } from "cubing/puzzles";
import type { KPattern } from "cubing/kpuzzle";
import { Alg } from "cubing/alg";

export const kpuzzle = await cube3x3x3.kpuzzle();
export const SOLVED = kpuzzle.defaultPattern();

// Derived empirically (see scripts/probe.ts):
// EDGES  0=UF 1=UR 2=UB 3=UL | 4=DF 5=DR 6=DB 7=DL | 8=FR 9=FL 10=BR 11=BL
// CORNERS 0=UFR 1=URB 2=UBL 3=UFL | 4=DFR 5=DFL 6=DBL 7=DRB
export const CROSS_EDGES = [4, 5, 6, 7];
export const LL_EDGES = [0, 1, 2, 3];
export const LL_CORNERS = [0, 1, 2, 3];
export const SLOTS = {
  FR: { corner: 4, edge: 8 },
  FL: { corner: 5, edge: 9 },
  BL: { corner: 6, edge: 11 },
  BR: { corner: 7, edge: 10 },
} as const;

const ROTATIONS = [
  "", "y", "y2", "y'",
  "x", "x y", "x y2", "x y'",
  "x2", "x2 y", "x2 y2", "x2 y'",
  "x'", "x' y", "x' y2", "x' y'",
  "z", "z y", "z y2", "z y'",
  "z'", "z' y", "z' y2", "z' y'",
];

type Orbit = "EDGES" | "CORNERS" | "CENTERS";
const data = (p: KPattern, orbit: Orbit) => (p as any).patternData[orbit];

/** Undo any net whole-cube rotation baked into an alg, so checks are frame-independent. */
export function normalize(p: KPattern): KPattern {
  for (const rot of ROTATIONS) {
    const q = rot === "" ? p : p.applyAlg(rot);
    const c = data(q, "CENTERS");
    if (c.pieces.every((v: number, i: number) => v === i)) return q;
  }
  throw new Error("no rotation restores centers");
}

export const edgeSolved = (p: KPattern, i: number) =>
  data(p, "EDGES").pieces[i] === i && data(p, "EDGES").orientation[i] === 0;
export const cornerSolved = (p: KPattern, i: number) =>
  data(p, "CORNERS").pieces[i] === i && data(p, "CORNERS").orientation[i] === 0;

export const crossSolved = (p: KPattern) => CROSS_EDGES.every((i) => edgeSolved(p, i));
export const slotSolved = (p: KPattern, s: keyof typeof SLOTS) =>
  cornerSolved(p, SLOTS[s].corner) && edgeSolved(p, SLOTS[s].edge);
export const f2lSolved = (p: KPattern) =>
  crossSolved(p) && (Object.keys(SLOTS) as (keyof typeof SLOTS)[]).every((s) => slotSolved(p, s));

/** Orientation-only fingerprint of the last layer (defines an OLL case). */
export const ollSignature = (p: KPattern) =>
  JSON.stringify([
    LL_CORNERS.map((i) => data(p, "CORNERS").orientation[i]),
    LL_EDGES.map((i) => data(p, "EDGES").orientation[i]),
  ]);

/** Permutation-only fingerprint of the last layer (defines a PLL case). */
export const pllSignature = (p: KPattern) =>
  JSON.stringify([
    LL_CORNERS.map((i) => data(p, "CORNERS").pieces[i]),
    LL_EDGES.map((i) => data(p, "EDGES").pieces[i]),
  ]);

/** Where the FR pair lives + how it is oriented (defines an F2L case). */
export const f2lSignature = (p: KPattern) => {
  const c = data(p, "CORNERS"), e = data(p, "EDGES");
  const cPos = c.pieces.indexOf(4), ePos = e.pieces.indexOf(8);
  return JSON.stringify([cPos, c.orientation[cPos], ePos, e.orientation[ePos]]);
};

export const llOriented = (p: KPattern) =>
  LL_CORNERS.every((i) => data(p, "CORNERS").orientation[i] === 0) &&
  LL_EDGES.every((i) => data(p, "EDGES").orientation[i] === 0);

/**
 * The case as you actually SEE it at the cube: apply the inverse of the
 * solution to a solved cube, then undo any net rotation the alg baked in.
 */
export function casePattern(alg: string): KPattern {
  return normalize(SOLVED.applyAlg(new Alg(alg).invert()));
}

/**
 * Canonical fingerprint modulo AUF. Turning the U layer gives the same physical
 * case (you would just adjust before executing), and a U turn cyclically shifts
 * the last-layer arrays -- so fold the 4 shifts into one representative.
 */
export function canonical(alg: string, sig: (p: KPattern) => string): string {
  let p = casePattern(alg);
  const forms: string[] = [];
  for (let k = 0; k < 4; k++) {
    forms.push(sig(p));
    p = p.applyAlg("U");
  }
  return forms.sort()[0];
}

/**
 * PLL identity is two-sided: you adjust U before executing AND after. Enumerating
 * only the 4 post-AUF shifts splits real cases apart (72 classes instead of 22),
 * so fold both sides. See scripts/count-classes.ts for the numeric proof.
 */
export function canonicalPLL(alg: string): string {
  const invA = new Alg(alg).invert().toString();
  const forms: string[] = [];
  for (let pre = 0; pre < 4; pre++) {
    let p = SOLVED;
    for (let i = 0; i < pre; i++) p = p.applyAlg("U");
    p = normalize(p.applyAlg(invA));
    for (let post = 0; post < 4; post++) {
      forms.push(pllSignature(p));
      p = p.applyAlg("U");
    }
  }
  return forms.sort()[0];
}
