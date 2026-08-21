/*
 * Deploy gate: refuse to ship a build whose Impressum still reads
 * "[YOUR FULL NAME]".
 *
 * The operator details are injected from VITE_LEGAL_* build env vars (see
 * src/legal/legal-info.ts). When they are set, the `||` fallbacks in that file
 * become dead code and the bundler folds them away entirely — so finding a
 * placeholder anywhere in dist/ is a reliable signal that the build environment
 * was not configured.
 *
 * Runs as part of `pnpm deploy` locally and of the Workers Builds build command
 * on Cloudflare, so neither path can publish a broken legal notice. A plain
 * `pnpm build` deliberately does NOT run it: a contributor without the env vars
 * should still be able to build, and the pages say so in a visible draft notice.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";

/** The literal fallbacks from legal-info.ts, minus the brackets' regex meaning. */
const PLACEHOLDERS = [
  "[YOUR FULL NAME]",
  "[STREET AND HOUSE NUMBER]",
  "[POSTAL CODE] [CITY]",
  "[YOUR-EMAIL]",
];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

let dist: string[];
try {
  dist = [...walk(DIST)];
} catch {
  console.error(`✗ No ${DIST}/ to check — run \`pnpm build\` first.`);
  process.exit(1);
}

const hits: string[] = [];
for (const file of dist) {
  if (!/\.(js|css|html)$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const placeholder of PLACEHOLDERS) {
    if (text.includes(placeholder)) hits.push(`${file}: ${placeholder}`);
  }
}

if (hits.length > 0) {
  console.error("✗ Built with placeholder operator details — refusing to deploy.\n");
  for (const hit of hits) console.error(`    ${hit}`);
  console.error(
    "\n  The VITE_LEGAL_* build environment variables are missing or empty.\n" +
      "  Locally: copy .env.example to .env.local and fill it in.\n" +
      "  On Cloudflare: Workers → speeden-and-cuben → Settings → Build →\n" +
      "  Variables and Secrets.\n",
  );
  process.exit(1);
}

console.log("✓ Operator details baked in — legal pages are publishable.");
