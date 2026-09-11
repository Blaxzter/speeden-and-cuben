# Speeden & Cuben

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

On Cloudflare the same values come from the **Workers Builds environment**
instead — Vite exposes any `VITE_`-prefixed process env var and gives it priority
over the `.env` files, so nothing in the code has to know where they came from.
They are stored only there and in your local `.env.local`; deliberately **not** in
GitHub, so a repo clone never carries them.

`pnpm check:legal` is the safety net. When the env vars are set the `||` fallbacks
in `legal-info.ts` become dead code and the bundler folds them away, so finding a
`[PLACEHOLDER]` in `dist/` proves the build environment was not configured. It
runs in both deploy paths (`pnpm deploy` and `pnpm ci:build`) and fails the build
rather than publishing an Impressum that reads `[YOUR FULL NAME]`. A plain
`pnpm build` skips it on purpose, so a contributor without the values can still
build — the pages then say so in a visible draft notice.

The privacy policy itself lives in `src/legal/datenschutz.generated.html` — paste
generator output straight in; `{{NAME}}` / `{{STREET}}` / `{{CITY}}` /
`{{COUNTRY}}` / `{{EMAIL}}` / `{{PHONE}}` tokens are substituted at runtime from
the same env-injected values, which is what keeps the address out of the repo.

Note the Impressum is *meant* to be public — this only keeps the address out of
git history, it does not hide it from visitors.

## The URL is the view

Every click that changes *what you are looking at* lands in the address bar, so
a view can be linked, bookmarked, opened in a second tab and walked back through
with the browser's own buttons. The set is the path — `/f2l`, `/oll`, `/pll` —
and everything else is a query parameter named after the question it answers:

| Parameter | Means | Example |
| --- | --- | --- |
| `case` | The selected case, by its label | `/pll?case=T` |
| `alg` | Which algorithm of that case, one-based | `/pll?case=Aa&alg=2` |
| `group` | The case-type chip, slugified | `/oll?group=small-lightning` |
| `corner` `twist` `edge` `flip` | The four F2L finder answers | `/f2l?corner=bl&twist=1&edge=r&flip=1` |
| `shape` | The OLL drawing: 4 corners, 4 edges, then each down corner's side | `/oll?shape=10101010----` |
| `q` | The search box | `/oll?q=sune` |
| `cross` | White or yellow, when it is not the default white | `/f2l?cross=yellow` |

Anything sitting at its default is left out, so an unfiltered page is just
`/oll` — every parameter that *is* there was put there by a click. The selected
case is left out too when it is simply the first one the filters leave standing,
since loading the link picks it again.

Reading is forgiving and writing is canonical: an unknown path, a case that does
not exist, a group belonging to another set or a mangled drawing all decode to
the default rather than to an error, and the first write puts the tidied-up URL
back in the bar. `/oll?case=21&group=dot` asks for a case that filter hides, so
it settles as `/oll?group=dot`.

Playback is deliberately *not* in the URL — speed, where the timeline is parked,
hint stickers. Those are how you are watching, not what. The cross toggle is in
the URL so a shared link shows the cube the way the sharer holds it, but it does
not add a history entry: Back belongs to the case you were looking at, not to
the colour you were looking at it in.

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

Pushing to `main` deploys on its own: the repository is connected to
**Workers Builds**, which watches it and runs the build itself. There is no
GitHub Actions workflow and no CI credential to rotate — Cloudflare already
holds the connection, so nothing about deploying lives in this repo.

Its build settings (Workers → `speeden-and-cuben` → Settings → Build):

| Setting | Value |
| --- | --- |
| Build command | `pnpm run ci:build` |
| Deploy command | `npx wrangler deploy` |
| Variables and Secrets | `VITE_LEGAL_NAME` / `_STREET` / `_CITY` / `_COUNTRY` / `_EMAIL` / `_PHONE` |

`ci:build` is `pnpm verify && pnpm build && pnpm check:legal` — so every deploy
re-derives all 119 algorithms against a real cube model *and* refuses to publish
placeholder operator details.

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
