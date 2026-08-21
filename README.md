# Speed Cuben

A CFOP algorithm reference with live 3D playback — all **41 F2L**, **57 OLL** and
**21 PLL** cases, browsable fast.

## Why the algorithms are trustworthy

Every algorithm is checked against a real cube model (`cubing.js`'s `KPuzzle`)
rather than transcribed and hoped over. `pnpm verify` asserts that:

- **OLL / PLL** algs leave the first two layers solved; PLL algs also leave the
  last layer fully oriented.
- **F2L** algs disturb neither the cross nor the other three slots.
- Each set contains **exactly** as many distinct cases as it should — 41 / 57 / 21.

That last check is the strong one. There are exactly 216 last-layer orientation
states, 288 permutation states and 150 F2L pair placements; folding each by the
right notion of AUF gives 58, 22 and 42 classes (the extra one in each is the
solved case). So 57 *distinct* verified OLL algs can only be the complete OLL set
— a wrong or duplicated alg would change the count. `scripts/count-classes.ts`
derives those numbers from first principles.

The F2L algorithms are not transcribed at all: `scripts/gen-f2l.ts` enumerates the
41 cases and searches for an optimal solution to each, so they are correct by
construction.

## Commands

```bash
pnpm install
pnpm dev       # local dev server
pnpm verify    # re-check every algorithm
pnpm build     # typecheck + production build into dist/
pnpm deploy    # build, then wrangler deploy
```

## Legal pages

`/impressum` and `/datenschutz` are separate static pages (`impressum.html`,
`datenschutz.html`), built as extra Vite entry points and linked from the footer
on every page — a German Impressum has to be reachable from anywhere on the site.

The **operator details are never committed**. `src/legal/legal-info.ts` reads them
from `VITE_LEGAL_*` build-time env vars; copy `.env.example` to a (gitignored)
`.env.local` and fill it in. Without them the pages render `[PLACEHOLDER]` values
and a visible draft notice, so an unconfigured build can't quietly ship a broken
Impressum.

In CI the same values come from **GitHub Actions secrets** instead — Vite exposes
any `VITE_`-prefixed process env var and gives it priority over the `.env` files,
so nothing in the code has to know the difference. Forks and pull requests, which
cannot read secrets, still build green (with placeholders); the deploy is gated on
a check that fails if any placeholder made it into `dist/`, so a build missing the
secrets can never reach the live site.

The privacy policy itself lives in `src/legal/datenschutz.generated.html` — paste
generator output straight in; `{{NAME}}` / `{{STREET}}` / `{{CITY}}` /
`{{COUNTRY}}` / `{{EMAIL}}` / `{{PHONE}}` tokens are substituted at runtime from
the same env-injected values, which is what keeps the address out of the repo.

Note the Impressum is *meant* to be public — this only keeps the address out of
git history, it does not hide it from visitors.

## Deploying

`wrangler.jsonc` is set up as an **assets-only Worker** — Cloudflare serves
`dist/` directly, no Worker script needed. `/impressum` resolves to
`impressum.html` via `html_handling`, so the SPA fallback only catches genuinely
unknown paths.

```bash
npx wrangler login   # first time only
cp .env.example .env.local && $EDITOR .env.local   # first time only
pnpm deploy
```

Pushing to `main` does the same thing via `.github/workflows/deploy.yml`, which
needs these repository secrets:

| Secret | Purpose |
| --- | --- |
| `VITE_LEGAL_NAME` / `_STREET` / `_CITY` / `_COUNTRY` / `_EMAIL` / `_PHONE` | Operator details baked into the legal pages |
| `CLOUDFLARE_ACCOUNT_ID` | Target account |
| `CLOUDFLARE_API_TOKEN` | Deploy credential — create one with the *Edit Cloudflare Workers* template at <https://dash.cloudflare.com/profile/api-tokens> |

Live at <https://speeden-and-cuben.fabraham.dev>.

## Notes

- **Cross colour is a toggle** in the header (white / yellow), remembered per
  browser. cubing.js has a fixed colour scheme with white on U, so "white cross"
  is rendered by orienting the cube with `x2` — which also turns the nicer pair of
  side faces toward the camera (blue front, red right).
- The built-in `experimental-stickering` masks are keyed by piece identity, so
  they dim the wrong layer once the cube is re-oriented. `stickeringMask()` in
  `src/main.ts` builds the masks instead and points them at whichever pieces form
  the last layer in the chosen orientation. Greyed-out stickers use `"ignored"` —
  `"dim"` renders at full colour.
- For the same reason every alg must finish with the cube in the orientation it
  started, or the mask drifts between the case and the solved state. Seven PLL
  algs (the A perms, E and V) end mid-rotation, so `scripts/fix-rotations.ts`
  appends a cancelling rotation; the UI hides that trailing token, and `pnpm
  verify` fails if any alg is not rotation-neutral.
- F2L cases are always presented with the corner at **front-right** where it is in
  the U layer, so the fixed camera never hides the pieces you need to see. AUF is
  free, so this changes presentation only, never the case.
- **Never set `display` on a `twisty-player`.** It lays its shadow DOM out from its
  own `:host` display; overriding it (e.g. `display: block`) collapses the internal
  visualization wrapper to zero height and the cube renders into a 0px canvas —
  the element still reports the right size and the model reports no errors, so it
  just looks silently blank.
- A player also builds its 3D view only once, from a shared IntersectionObserver,
  behind a flag cubing.js never resets. Detaching one from the DOM kills it for
  good, so the detail panel is built once and updated in place rather than
  re-rendered, and selecting a case no longer rebuilds the grid.
- F2L solutions are searched over `<R, U, F>`. The BL slot lies in none of those
  layers, so it is structurally impossible to disturb.
