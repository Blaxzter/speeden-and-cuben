export type CaseSet = "F2L" | "OLL" | "PLL";

export interface CubeCase {
  /** Stable id, e.g. "f2l-01", "oll-21", "pll-t". */
  id: string;
  /** Short display label, e.g. "1", "21", "T". */
  label: string;
  /** Human name, e.g. "T Perm", "Sune". */
  name: string;
  /** Sub-grouping used for the browser's section headers. */
  group: string;
  /** Algorithms, best/most common first. */
  algs: string[];
  /** Recognition hint shown next to the case. */
  hint?: string;
  /** Present on F2L cases only; drives the case finder. */
  recognition?: F2LRecognition;
}

/** Where the target pair sits, for the F2L case finder. */
export interface F2LRecognition {
  /** 0=UFR 1=URB 2=UBL 3=UFL (U layer), 4 = already in the slot. */
  cornerPos: number;
  /** 0 = white facing up (or untwisted in-slot), 1/2 = twisted. */
  cornerOri: number;
  /** 0=UF 1=UR 2=UB 3=UL (U layer), 8 = already in the slot. */
  edgePos: number;
  /** 0 = not flipped, 1 = flipped. */
  edgeOri: number;
}
