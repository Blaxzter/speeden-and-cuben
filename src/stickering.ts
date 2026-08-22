/**
 * Which stickers a case actually cares about.
 *
 * cubing.js ships with white on U and yellow on D, so out of the box the cube
 * looks like a yellow-cross solve. Rotating it with x2 puts white on the bottom
 * where most cubers keep it — but the built-in stickering masks ("OLL", "PLL",
 * "F2L") are keyed by piece identity, so after a rotation they dim the layer
 * that has moved to the *bottom*. We therefore build the masks ourselves and
 * point them at whichever pieces form the last layer in the chosen orientation.
 *
 * This lives apart from the UI because two things need it: the detail panel's
 * live player, and scripts/gen-thumbs.ts, which bakes the same masking into the
 * static grid diagrams. They have to agree, so they read it from one place.
 */

import type { CaseSet } from "./data/types";

export type Cross = "white" | "yellow";

/** Pieces whose home is the last layer, per orientation. */
const LL_PIECES: Record<Cross, number[]> = { white: [4, 5, 6, 7], yellow: [0, 1, 2, 3] };
/** Index of the last-layer centre (CENTERS is ordered U L F R B D). */
const LL_CENTRE: Record<Cross, number> = { white: 5, yellow: 0 };
// x2 keeps white on the bottom AND turns the nicer pair of side faces toward
// the camera: blue front / red right, instead of z2's green front / orange right.
export const SETUP_ALG: Record<Cross, string> = { white: "x2", yellow: "" };

export type FaceletMask = "regular" | "ignored";

export function stickeringMask(set: CaseSet, cross: Cross) {
  const ll = LL_PIECES[cross];
  const facelets = (piece: number, count: number): FaceletMask[] => {
    const isLL = ll.includes(piece);
    if (set === "F2L") return Array(count).fill(isLL ? "ignored" : "regular");
    if (set === "PLL") return Array(count).fill(isLL ? "regular" : "ignored");
    // OLL only cares whether a last-layer sticker points along the U/D axis,
    // which is always facelet 0 — the sticker orientation is measured from.
    return Array.from({ length: count }, (_, f) => (isLL && f === 0 ? "regular" : "ignored"));
  };
  const centre = (i: number): FaceletMask => {
    if (i === LL_CENTRE[cross]) return set === "F2L" ? "ignored" : "regular";
    return set === "F2L" ? "regular" : "ignored";
  };
  return {
    orbits: {
      EDGES: { pieces: Array.from({ length: 12 }, (_, i) => ({ facelets: facelets(i, 2) })) },
      CORNERS: { pieces: Array.from({ length: 8 }, (_, i) => ({ facelets: facelets(i, 3) })) },
      CENTERS: { pieces: Array.from({ length: 6 }, (_, i) => ({ facelets: [centre(i)] })) },
    },
  };
}
