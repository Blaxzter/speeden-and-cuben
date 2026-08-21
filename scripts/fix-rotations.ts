/**
 * Append a cancelling rotation to any alg that leaves the cube re-oriented, so a
 * piece-identity stickering mask stays aligned from the case through to solved.
 * A trailing whole-cube rotation never changes which case an alg solves; the UI
 * hides it from the printed algorithm.
 */
import { cube3x3x3 } from "cubing/puzzles";
import { readFileSync, writeFileSync } from "node:fs";
import { F2L_CASES } from "../src/data/f2l";
import { OLL_CASES } from "../src/data/oll";
import { PLL_CASES } from "../src/data/pll";

const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();
const ROTATIONS = [
  "", "y", "y2", "y'", "x", "x y", "x y2", "x y'", "x2", "x2 y", "x2 y2", "x2 y'",
  "x'", "x' y", "x' y2", "x' y'", "z", "z y", "z y2", "z y'", "z'", "z' y", "z' y2", "z' y'",
];
const fixFor = (alg: string): string | null => {
  const p = SOLVED.applyAlg(alg) as any;
  for (const rot of ROTATIONS) {
    const q = (rot === "" ? p : p.applyAlg(rot)) as any;
    if (q.patternData.CENTERS.pieces.every((v: number, i: number) => v === i)) return rot;
  }
  throw new Error("no rotation restores centres for: " + alg);
};

for (const [file, cases] of [
  ["src/data/f2l.ts", F2L_CASES],
  ["src/data/oll.ts", OLL_CASES],
  ["src/data/pll.ts", PLL_CASES],
] as const) {
  let text = readFileSync(file, "utf8");
  let changed = 0;
  for (const c of cases) {
    for (const alg of c.algs) {
      const fix = fixFor(alg);
      if (!fix) continue;
      const from = `"${alg}"`;
      if (!text.includes(from)) throw new Error("could not locate alg in " + file + ": " + alg);
      text = text.replace(from, `"${alg} ${fix}"`);
      changed++;
    }
  }
  if (changed) {
    writeFileSync(file, text);
    console.log(`${file}: ${changed} alg(s) made rotation-neutral`);
  } else {
    console.log(`${file}: already rotation-neutral`);
  }
}
