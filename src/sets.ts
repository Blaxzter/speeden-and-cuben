/**
 * The three case sets, in one place.
 *
 * Both the UI and the URL encoder have to agree on what "OLL" contains — the
 * encoder resolves `?case=21` against the set the path names — so neither owns
 * the table.
 */

import { F2L_CASES } from "./data/f2l";
import { OLL_CASES } from "./data/oll";
import { PLL_CASES } from "./data/pll";
import type { CaseSet, CubeCase } from "./data/types";

export const SETS: Record<CaseSet, CubeCase[]> = { F2L: F2L_CASES, OLL: OLL_CASES, PLL: PLL_CASES };

/** Solve order, which is the order the nav lists them in. */
export const SET_ORDER: CaseSet[] = ["F2L", "OLL", "PLL"];
