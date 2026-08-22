/**
 * Bake the case-grid diagrams.
 *
 * The grid draws every case as a static SVG (see src/cube-thumb.ts) rather than
 * mounting a live player per card, which means something has to work out what
 * colour each visible sticker is. That is a pure function of the algorithm, so
 * it is done here, once, at build time: the grid then renders with no cube
 * logic at runtime at all.
 *
 * Run with `pnpm gen:thumbs`. `pnpm verify` re-runs it and fails if the
 * committed file is stale, so the data cannot drift away from the algs.
 */

import { Alg } from "cubing/alg";
import type { KPattern } from "cubing/kpuzzle";
import { writeFileSync, readFileSync } from "node:fs";
import { SOLVED } from "./cube-check";
import { F2L_CASES } from "../src/data/f2l";
import { OLL_CASES } from "../src/data/oll";
import { PLL_CASES } from "../src/data/pll";
import type { CaseSet, CubeCase } from "../src/data/types";
import { SETUP_ALG, stickeringMask, type Cross } from "../src/stickering";
import { VISIBLE, LL_VISIBLE, SLOT_NAMES } from "../src/cube-thumb";
import { crossFace } from "../src/finder-icons";

const OUT = new URL("../src/data/thumbs.generated.ts", import.meta.url);

const SETS: [CaseSet, CubeCase[]][] = [
  ["F2L", F2L_CASES],
  ["OLL", OLL_CASES],
  ["PLL", PLL_CASES],
];

/**
 * The state a card shows.
 *
 * The player is given the algorithm with `experimental-setup-anchor="end"`, so
 * the setup alg describes where the animation *finishes* and the card sits at
 * the start: solve the case and you arrive at the setup state. Running the alg
 * backwards from there is therefore exactly what the card displays.
 */
function thumbPattern(alg: string, cross: Cross): KPattern {
  const setup = SETUP_ALG[cross];
  const base = setup ? SOLVED.applyAlg(setup) : SOLVED;
  return base.applyAlg(new Alg(alg).invert());
}

/**
 * cubing.js moves whole cubies rather than recolouring stickers: the piece at
 * slot `i` is `pieces[i]`, turned by `orientation[i]` about its own axis. A
 * cubie's stickers are named in the same order as its home slot, so the sticker
 * showing on face-position `f` of a slot is the piece's own facelet `f + o`.
 *
 * The `+` is the whole game — get it backwards and every twisted corner comes
 * out mirrored, which still looks like a plausible cube. `checkRecognition`
 * below pins the direction down against the hand-checked case data.
 *
 * Reading the piece name's length as the cycle keeps centres honest: they carry
 * four orientations but only one sticker, so their facelet is always 0.
 */
type Facelet = { orbit: "CORNERS" | "EDGES" | "CENTERS"; slot: number; facelet: number };

function stickerColours(
  pattern: KPattern,
  set: CaseSet,
  cross: Cross,
  stickers: readonly Facelet[],
): string {
  const mask = stickeringMask(set, cross).orbits;
  const data = (pattern as unknown as { patternData: Record<string, { pieces: number[]; orientation: number[] }> })
    .patternData;

  return stickers
    .map((s) => {
      const orbit = data[s.orbit];
      const piece = orbit.pieces[s.slot];
      const ori = orbit.orientation[s.slot];
      const name: string = SLOT_NAMES[s.orbit][piece];
      const facelet = (s.facelet + ori) % name.length;
      const shown = mask[s.orbit].pieces[piece].facelets[facelet];
      return shown === "ignored" ? "." : name[facelet];
    })
    .join("");
}

/**
 * F2L keeps the cube; OLL and PLL are recognised off the flat last-layer
 * diagram, which is what the live players drew for them too.
 */
const stickersFor = (set: CaseSet): readonly Facelet[] => (set === "F2L" ? VISIBLE : LL_VISIBLE);

/**
 * Every visible sticker must be accounted for, and the six colours must come
 * out nine-a-side across the whole cube — a mirrored orientation convention
 * still passes that, but a mis-indexed one does not.
 */
function sanityCheck(pattern: KPattern, id: string) {
  const data = (pattern as unknown as { patternData: Record<string, { pieces: number[]; orientation: number[] }> })
    .patternData;
  const tally: Record<string, number> = {};
  for (const [orbit, names] of Object.entries(SLOT_NAMES)) {
    const o = data[orbit];
    for (let slot = 0; slot < names.length; slot++) {
      const name: string = names[o.pieces[slot]];
      for (const letter of name) tally[letter] = (tally[letter] ?? 0) + 1;
    }
  }
  for (const face of "ULFRBD") {
    if (tally[face] !== 9) throw new Error(`${id}: face ${face} has ${tally[face]} stickers, expected 9`);
  }
}

/**
 * Where each F2L recognition slot sits on screen, so a case's hand-written
 * `recognition` can be read straight off the colours we just computed.
 * `types.ts`: 0=UFR 1=URB 2=UBL 3=UFL, 4 = already in the slot.
 */
const CORNER_CELL: Record<number, Vec3Key> = {
  0: "1,1,1",
  1: "1,1,-1",
  2: "-1,1,-1",
  3: "-1,1,1",
  4: "1,-1,1",
};
type Vec3Key = string;
const cellKey = (at: readonly [number, number, number]) => at.join(",");

/** The cross colour is whichever face the cube is being solved onto. */
const CROSS_LETTER: Record<Cross, string> = { white: "U", yellow: "D" };

/**
 * The one check that fixes the orientation convention.
 *
 * Every F2L case carries a `recognition` record that was written and checked by
 * hand against the rendered cube, and `crossFace` turns it into a claim about
 * which face the corner's cross sticker points at. That claim is independent of
 * everything in this script, so agreeing with it means the piece lookup, the
 * facelet indexing and the orientation direction are all right — and disagreeing
 * is exactly what a flipped orientation sign looks like.
 */
function checkRecognition(colours: string, c: CubeCase, cross: Cross) {
  const r = c.recognition;
  if (!r) return;
  const want = crossFace(r.cornerPos, r.cornerOri);
  if (want !== "U" && want !== "F" && want !== "R") return; // pointing away from the camera
  const cell = CORNER_CELL[r.cornerPos];
  const index = VISIBLE.findIndex((s) => s.face === want && cellKey(s.at) === cell);
  if (index < 0) throw new Error(`${c.id}: no visible ${want} sticker at corner ${r.cornerPos}`);
  const got = colours[index];
  if (got !== CROSS_LETTER[cross]) {
    throw new Error(
      `${c.id} (${cross}): recognition says the cross sticker faces ${want}, ` +
        `but that sticker came out "${got}" — check the orientation convention`,
    );
  }
}

const rows: string[] = [];
let count = 0;
for (const [set, cases] of SETS) {
  for (const c of cases) {
    const perCross = (["white", "yellow"] as Cross[]).map((cross) => {
      const pattern = thumbPattern(c.algs[0], cross);
      sanityCheck(pattern, c.id);
      const colours = stickerColours(pattern, set, cross, stickersFor(set));
      checkRecognition(colours, c, cross);
      return `${cross}: "${colours}"`;
    });
    rows.push(`  "${c.id}": { ${perCross.join(", ")} },`);
    count++;
  }
}

const file = `// Generated by scripts/gen-thumbs.ts — do not edit by hand.
//
// One entry per case, one string per cross colour. Each string is 27 characters
// in the order of \`VISIBLE\` in src/cube-thumb.ts (U face, then F, then R, each
// read left-to-right and top-to-bottom): a face letter for a sticker the case
// cares about, or "." for one its stickering mask dims.

export type ThumbColours = { white: string; yellow: string };

export const THUMBS: Record<string, ThumbColours> = {
${rows.join("\n")}
};
`;

const check = process.argv.includes("--check");
if (check) {
  const existing = readFileSync(OUT, "utf8");
  if (existing !== file) {
    console.error("thumbs.generated.ts is stale — run `pnpm gen:thumbs`");
    process.exit(1);
  }
  console.log(`thumbs.generated.ts is up to date (${count} cases)`);
} else {
  writeFileSync(OUT, file);
  console.log(`wrote thumbs.generated.ts (${count} cases)`);
}
