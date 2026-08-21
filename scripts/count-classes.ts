// Decisive check: enumerate every possible last-layer state from first principles
// and count equivalence classes. The known answers are 57 OLL + solved = 58,
// 21 PLL + solved = 22, 41 F2L + solved = 42. Whichever notion of "same case"
// reproduces those counts is the correct one for the verifier to use.
const shifts = <T,>(a: T[], k: number) => a.map((_, i) => a[(i + k) % a.length]);
const key = (...xs: unknown[]) => JSON.stringify(xs);

// ---- OLL: corner orientations (sum 0 mod 3) x edge orientations (sum even) ----
const ollStates: [number[], number[]][] = [];
for (let m = 0; m < 81; m++) {
  const c = [m % 3, Math.floor(m / 3) % 3, Math.floor(m / 9) % 3, Math.floor(m / 27) % 3];
  if (c.reduce((a, b) => a + b, 0) % 3 !== 0) continue;
  for (let n = 0; n < 16; n++) {
    const e = [0, 1, 2, 3].map((i) => (n >> i) & 1);
    if (e.reduce((a, b) => a + b, 0) % 2 !== 0) continue;
    ollStates.push([c, e]);
  }
}
const ollOneSided = new Set(ollStates.map(([c, e]) =>
  [0, 1, 2, 3].map((k) => key(shifts(c, k), shifts(e, k))).sort()[0]));
console.log(`OLL states: ${ollStates.length}  -> one-sided AUF classes: ${ollOneSided.size} (expect 58)`);

// ---- PLL: corner perm x edge perm, total parity even ----
const perms = (function p(a: number[]): number[][] {
  return a.length <= 1 ? [a] : a.flatMap((x, i) => p([...a.slice(0, i), ...a.slice(i + 1)]).map((r) => [x, ...r]));
})([0, 1, 2, 3]);
const sgn = (p: number[]) => { let s = 1; for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) s = -s; return s; };
const pllStates = perms.flatMap((cp) => perms.filter((ep) => sgn(cp) * sgn(ep) === 1).map((ep) => [cp, ep] as [number[], number[]]));
// left action = post-AUF (shift positions); right action = pre-AUF (relabel pieces)
const compose = (p: number[], k: number) => p.map((v) => (v + k) % 4);
const oneSided = new Set(pllStates.map(([c, e]) =>
  [0, 1, 2, 3].map((k) => key(shifts(c, k), shifts(e, k))).sort()[0]));
const twoSided = new Set(pllStates.map(([c, e]) => {
  const f: string[] = [];
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) f.push(key(compose(shifts(c, a), b), compose(shifts(e, a), b)));
  return f.sort()[0];
}));
console.log(`PLL states: ${pllStates.length}  -> one-sided: ${oneSided.size}   two-sided: ${twoSided.size} (expect 22)`);

// ---- F2L: FR pair placements (4 U slots + the slot itself) ----
const f2lStates: [number, number, number, number][] = [];
for (let cp = 0; cp < 5; cp++) for (let co = 0; co < 3; co++)
  for (let ep = 0; ep < 5; ep++) for (let eo = 0; eo < 2; eo++) f2lStates.push([cp, co, ep, eo]);
// position 4 == "in the slot" and is fixed by AUF; positions 0..3 cycle.
const shiftPos = (p: number, k: number) => (p === 4 ? 4 : (p + k) % 4);
const f2lClasses = new Set(f2lStates.map(([cp, co, ep, eo]) =>
  [0, 1, 2, 3].map((k) => key(shiftPos(cp, k), co, shiftPos(ep, k), eo)).sort()[0]));
console.log(`F2L states: ${f2lStates.length}  -> one-sided AUF classes: ${f2lClasses.size} (expect 42)`);
