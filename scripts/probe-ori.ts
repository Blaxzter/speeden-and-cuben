import { cube3x3x3 } from "cubing/puzzles";
const kpuzzle = await cube3x3x3.kpuzzle();
const solved = kpuzzle.defaultPattern();
const read = (alg: string, pos: number) => {
  const p = solved.applyAlg(alg) as any;
  return `${alg.padEnd(3)} -> position ${pos}: piece ${p.patternData.CORNERS.pieces[pos]}, orientation ${p.patternData.CORNERS.orientation[pos]}`;
};
// UFR (position 0). R carries the DFR corner's down-sticker to the FRONT face;
// F' carries it to the RIGHT face.
console.log(read("R", 0), "  => that orientation means cross-colour on F");
console.log(read("F'", 0), "  => that orientation means cross-colour on R");
// DFR (position 4). R' carries the UFR corner's up-sticker to the FRONT face.
console.log(read("R'", 4), "  => that orientation means primary sticker on F");
console.log(read("F", 4), "  => that orientation means primary sticker on R");
