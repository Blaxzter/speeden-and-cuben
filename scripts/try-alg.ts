import { Alg } from "cubing/alg";
import { SOLVED, normalize, f2lSolved, llOriented, pllSignature, ollSignature, f2lSignature, canonical, canonicalPLL } from "./cube-check";

// usage: tsx scripts/try-alg.ts <pll|oll|f2l> "<reference alg>" "<candidate>" ["<candidate>"...]
const [kind, ref, ...cands] = process.argv.slice(2);
const sig = kind === "pll" ? pllSignature : kind === "oll" ? ollSignature : f2lSignature;
const canon = (a: string) => (kind === "pll" ? canonicalPLL(a) : canonical(a, sig));
const target = canon(ref);

for (const cand of cands) {
  try {
    const p = normalize(SOLVED.applyAlg(cand));
    const same = canon(cand) === target;
    const notes: string[] = [];
    if (kind !== "f2l" && !f2lSolved(p)) notes.push("breaks F2L");
    if (kind === "pll" && !llOriented(p)) notes.push("LL misoriented");
    console.log(`${same && !notes.length ? "OK  " : "BAD "} ${cand}${notes.length ? "   (" + notes.join(", ") + ")" : ""}`);
  } catch (e) { console.log(`ERR  ${cand}  ${(e as Error).message}`); }
}
