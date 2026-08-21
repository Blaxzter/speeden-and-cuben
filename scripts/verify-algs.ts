import { Alg } from "cubing/alg";
import {
  SOLVED, normalize, f2lSolved, crossSolved, slotSolved,
  llOriented, ollSignature, pllSignature, f2lSignature, canonical, canonicalPLL, SLOTS,
} from "./cube-check";
import type { CubeCase } from "../src/data/types";

let failures = 0;
const fail = (id: string, msg: string) => { failures++; console.log(`  FAIL ${id}: ${msg}`); };

/**
 * The UI dims pieces with a stickering mask keyed by piece identity, which only
 * stays aligned if an alg finishes with the cube in the orientation it started.
 * scripts/fix-rotations.ts appends a cancelling rotation where needed; this
 * guards the invariant so a newly added alg cannot silently break the display.
 */
function checkRotationNeutral(label: string, cases: CubeCase[]) {
  for (const c of cases) {
    c.algs.forEach((alg, idx) => {
      const centres = (SOLVED.applyAlg(alg) as any).patternData.CENTERS.pieces;
      if (!centres.every((v: number, i: number) => v === i)) {
        fail(c.id, `alg[${idx}] leaves the cube rotated (run scripts/fix-rotations.ts): "${alg}"`);
      }
    });
  }
  void label;
}

function checkPLL(cases: CubeCase[]) {
  console.log(`\nPLL (${cases.length} cases)`);
  const seen = new Map<string, string>();
  for (const c of cases) {
    c.algs.forEach((alg, idx) => {
      let p;
      try { p = normalize(SOLVED.applyAlg(alg)); }
      catch (e) { return fail(c.id, `alg[${idx}] "${alg}" -> ${(e as Error).message}`); }
      if (!f2lSolved(p)) return fail(c.id, `alg[${idx}] breaks F2L: "${alg}"`);
      if (!llOriented(p)) return fail(c.id, `alg[${idx}] leaves LL misoriented (not a PLL): "${alg}"`);
      if (pllSignature(p) === pllSignature(SOLVED)) return fail(c.id, `alg[${idx}] is a no-op on LL: "${alg}"`);
      // Every listed alg for a case must produce the same case.
      const canon = canonicalPLL(alg);
      if (idx === 0) {
        const dup = seen.get(canon);
        if (dup) fail(c.id, `same case as ${dup}`);
        seen.set(canon, c.id);
      } else if (canonicalPLL(c.algs[0]) !== canon) {
        fail(c.id, `alg[${idx}] is a different case than alg[0]: "${alg}"`);
      }
    });
  }
  console.log(`  distinct cases: ${seen.size}/21 ${seen.size === 21 ? "(complete PLL set)" : "<-- MISMATCH"}`);
  if (seen.size !== 21) failures++;
}

function checkOLL(cases: CubeCase[]) {
  console.log(`\nOLL (${cases.length} cases)`);
  const seen = new Map<string, string>();
  for (const c of cases) {
    c.algs.forEach((alg, idx) => {
      let p;
      try { p = normalize(SOLVED.applyAlg(alg)); }
      catch (e) { return fail(c.id, `alg[${idx}] "${alg}" -> ${(e as Error).message}`); }
      if (!f2lSolved(p)) return fail(c.id, `alg[${idx}] breaks F2L: "${alg}"`);
      if (llOriented(p)) return fail(c.id, `alg[${idx}] does not misorient LL (not an OLL): "${alg}"`);
      const canon = canonical(alg, ollSignature);
      if (idx === 0) {
        const dup = seen.get(canon);
        if (dup) fail(c.id, `same case as ${dup}`);
        seen.set(canon, c.id);
      } else if (canonical(c.algs[0], ollSignature) !== canon) {
        fail(c.id, `alg[${idx}] is a different case than alg[0]: "${alg}"`);
      }
    });
  }
  console.log(`  distinct cases: ${seen.size}/57 ${seen.size === 57 ? "(complete OLL set)" : "<-- MISMATCH"}`);
  if (seen.size !== 57) failures++;
}

function checkF2L(cases: CubeCase[]) {
  console.log(`\nF2L (${cases.length} cases)`);
  const seen = new Map<string, string>();
  const others = ["FL", "BL", "BR"] as (keyof typeof SLOTS)[];
  for (const c of cases) {
    c.algs.forEach((alg, idx) => {
      // The case is what you see BEFORE the alg: apply the inverse to a solved cube.
      const inv = new Alg(alg).invert().toString();
      let p;
      try { p = normalize(SOLVED.applyAlg(inv)); }
      catch (e) { return fail(c.id, `alg[${idx}] "${alg}" -> ${(e as Error).message}`); }
      if (!crossSolved(p)) return fail(c.id, `alg[${idx}] disturbs the cross: "${alg}"`);
      for (const s of others) {
        if (!slotSolved(p, s)) return fail(c.id, `alg[${idx}] disturbs the ${s} slot: "${alg}"`);
      }
      if (slotSolved(p, "FR")) return fail(c.id, `alg[${idx}] is a no-op (FR already solved): "${alg}"`);
      const canon = canonical(alg, f2lSignature);
      if (idx === 0) {
        const dup = seen.get(canon);
        if (dup) fail(c.id, `same case as ${dup}`);
        seen.set(canon, c.id);
      } else if (canonical(c.algs[0], f2lSignature) !== canon) {
        fail(c.id, `alg[${idx}] is a different case than alg[0]: "${alg}"`);
      }
    });
  }
  console.log(`  distinct cases: ${seen.size}/41 ${seen.size === 41 ? "(complete F2L set)" : "<-- MISMATCH"}`);
  if (seen.size !== 41) failures++;
}

const load = async (p: string, k: string) => { try { return (await import(p))[k] as CubeCase[]; } catch { return null; } };
const pll = await load("../src/data/pll", "PLL_CASES");
const oll = await load("../src/data/oll", "OLL_CASES");
const f2l = await load("../src/data/f2l", "F2L_CASES");
if (pll) { checkPLL(pll); checkRotationNeutral("PLL", pll); }
if (oll) { checkOLL(oll); checkRotationNeutral("OLL", oll); }
if (f2l) { checkF2L(f2l); checkRotationNeutral("F2L", f2l); }

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
