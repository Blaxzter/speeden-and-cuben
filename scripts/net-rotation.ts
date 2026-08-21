/**
 * Any alg that leaves the cube in a different orientation than it started breaks
 * an identity-keyed stickering mask: the pieces forming the last layer at the
 * start are not the ones forming it at the end. List them, with the rotation
 * needed to cancel it out.
 */
import { cube3x3x3 } from "cubing/puzzles";
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

let n = 0;
for (const [name, cases] of [["F2L", F2L_CASES], ["OLL", OLL_CASES], ["PLL", PLL_CASES]] as const) {
  for (const c of cases) {
    c.algs.forEach((alg, i) => {
      const fix = fixFor(alg);
      if (fix) {
        n++;
        console.log(`${name} ${c.label.padEnd(4)} alg[${i}]  needs "${fix}"   ${alg}`);
      }
    });
  }
}
console.log(n === 0 ? "\nAll algs are rotation-neutral." : `\n${n} alg(s) leave the cube rotated.`);
