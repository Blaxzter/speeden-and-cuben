import { cube3x3x3 } from "cubing/puzzles";

const kpuzzle = await cube3x3x3.kpuzzle();
const solved = kpuzzle.defaultPattern();

console.log("ORBITS:", kpuzzle.definition.orbits.map((o: any) => `${o.orbitName}:${o.numPieces}x${o.numOrientations}`).join("  "));

// Empirically derive which piece indices each face turn touches.
for (const move of ["U", "D", "F", "B", "L", "R"]) {
  const p = solved.applyAlg(move);
  const out: string[] = [];
  for (const orbit of ["EDGES", "CORNERS", "CENTERS"]) {
    const a = (solved as any).patternData[orbit];
    const b = (p as any).patternData[orbit];
    const moved: number[] = [];
    for (let i = 0; i < a.pieces.length; i++) {
      if (a.pieces[i] !== b.pieces[i] || a.orientation[i] !== b.orientation[i]) moved.push(i);
    }
    out.push(`${orbit}[${moved.join(",")}]`);
  }
  console.log(move.padEnd(2), out.join(" "));
}
console.log("\nsolved EDGES pieces:", (solved as any).patternData.EDGES.pieces.join(","));
console.log("solved CORNERS pieces:", (solved as any).patternData.CORNERS.pieces.join(","));
console.log("solved CENTERS pieces:", (solved as any).patternData.CENTERS.pieces.join(","));
