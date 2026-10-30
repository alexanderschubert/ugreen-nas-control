# Development

## Setup

```
git clone https://github.com/alexanderschubert/ugreen-nas-control && cd ugreen-nas-control
just check
```

With nix installed, plain `just <recipe>` works from any shell: each recipe line runs in the flake's dev shell (go, bun, php 8.4, shellcheck, shfmt, golangci-lint, actionlint, zizmor, xmllint, about 0.5 s per line; skipped when `IN_NIX_SHELL` is set). Without nix, install the same tools yourself (versions: `flake.nix`). CI runs every check as `nix develop .#<shell> -c just <recipe>` with a lean per-job shell from `flake.nix` (`go`, `web`, `e2e`, `site`, `plugin`, `release`, `lint`: only the tools that job's recipes run, plus just and git; the `check` job uses the full default shell), so a green `just check` locally is a green CI. A recipe that gains a tool needs it added to the matching shell in `flake.nix`.

## Recipes

`just` lists them; the ones you use:

| Recipe                                              | What                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `just check`                                        | Everything CI runs. Run it before you push.                                                                                                                                                                                                                                                                       |
| `just fmt`                                          | Format everything (writes files): Bun, Go, shell, PHP, XML, Nix.                                                                                                                                                                                                                                                  |
| `just lint`, `just test`                            | Subsets of `check`.                                                                                                                                                                                                                                                                                               |
| `just go-lint`, `just go-test`, `just go-build`     | One Go module (`backend/go.mod`; the recipes run in `backend/`). Lint and tests run with and without `-tags testhooks` (the tag that lets tests redirect the tools with `UGREEN_*` variables); the build is the release build without it and writes the one binary `.build/bin/ugreen-nas` (linux/amd64, static). |
| `just parity`                                       | The Go tools against the goldens in `backend/internal/led/parity/testdata/golden` (recorded from the shell scripts they replaced): every scenario must print and leave behind the same (prints `parity:` lines, about 30 s).                                                                                      |
| `just sh-lint`                                      | shellcheck and `shfmt -d` on the remaining shell files: the event hook, the dev installer, the harness fakes, the test stubs, the git hook.                                                                                                                                                                       |
| `just web-check`, `just web-build`, `just web-test` | Frontend: format, lint, types, tests, i18n parity, and "the sources build". `web-build` assembles the install tree at `.build/plugin`; `web-check` and `web-test` build it first (the demo test reads it).                                                                                                        |
| `just plg`, `just plg-check`, `just changes-check`  | `plg`: build the release archive and the `.plg` into `.build/dist/`. `plg-check`: validate manifest, archive and `.plg`. `changes-check`: validate `.changes/` fragments.                                                                                                                                         |
| `just generated-check`                              | Fails when a generated file is tracked, a tracked file is gitignored, a generator writes to a tracked path, or the web build writes outside `.build/`.                                                                                                                                                            |
| `just models-check`                                 | Validate the `web/models/` registry.                                                                                                                                                                                                                                                                              |
| `just docs`, `just docs-check`                      | Regenerate / verify the generated docs blocks and every link in the docs.                                                                                                                                                                                                                                         |
| `just harness [model]`                              | Fake Unraid in a temp dir.                                                                                                                                                                                                                                                                                        |
| `just e2e [--old] [--update]`                       | UI end-to-end run (Bun.WebView) against `web/tools/e2e/golden.json`.                                                                                                                                                                                                                                              |
| `just shots [model ...]`, `just site`               | Screenshots and the static site.                                                                                                                                                                                                                                                                                  |
| `just workflows-lint`                               | actionlint on `.github/workflows`.                                                                                                                                                                                                                                                                                |

## Frontend

The browser code is TypeScript in `web/src/` (`features/nas`, `features/led`, `dash`, `core`). `bun run build` (`web/tools/build.ts`, or `just web-build`) bundles it into the classic scripts the plugin ships, `.build/plugin/js/{app,dash,ledfx,i18n}.js` and `.build/plugin/led/js/{app,i18n}.js`, and renders the PNG icons from `web/assets/*.svg`. The same step copies the tracked `web/plugin` and `plugin/event` files there at their install paths (`plugin/files.txt`), so `.build/plugin` is the complete install tree; the build writes nothing into the source tree (`just generated-check` runs it and fails otherwise). None of it is tracked; `just harness`, `shots`, `e2e` and `site` build them first, and `just web-check` proves the sources build.

**Generated files are never committed.** Generators write only to gitignored paths (`scripts/generated.ts`); the few tracked generated files are marked `linguist-generated` in `.gitattributes` with the reason. `just generated-check` (part of `just check`) enforces it.

`web/package.json` scripts: `build`, `test` (`bun test src`; run in `web/`, `bun install` puts `node_modules` there), `lint`, `i18n`, `check`. Bun does formatting (`bun fmt`, configured in `web/bunfig.toml`), type checking and tests; there is no Node, Biome or Playwright.

## Code style

One standard per file type, applied by `just fmt`, verified by `just fmt-check` (part of `just check` and CI) and, for staged files, by the pre-commit hook. `.editorconfig` carries the same indentation (4 spaces; tabs for Go; 2 for XML and Nix).

| Files                                                                    | Formatter                              | Linter                           | Config                   |
| ------------------------------------------------------------------------ | -------------------------------------- | -------------------------------- | ------------------------ |
| TS, JS, CSS, HTML, JSON, YAML, Markdown                                  | `bun fmt`                              | `bun check`, `web/tools/lint.ts` | `web/bunfig.toml`        |
| Go                                                                       | gofmt, goimports (`golangci-lint fmt`) | `golangci-lint run`              | `backend/.golangci.yml`  |
| Shell (`*.sh`, `plugin/event/*`, harness scripts, parity fixtures, hook) | `shfmt -i 4 -ci`                       | `shellcheck`                     | `.editorconfig`          |
| PHP (`*.php`)                                                            | `php-cs-fixer`, PER-CS 2.0             | `php -l`                         | `.php-cs-fixer.dist.php` |
| XML (`ca_profile.xml`, `plugins/*.xml`)                                  | `xmllint --format`                     | `xmllint --noout`                | `justfile`               |
| SVG (`web/assets/*.svg`)                                                 | none                                   | `xmllint --noout`                | `justfile`               |
| Nix (`flake.nix`)                                                        | `nixfmt`                               |                                  |                          |
| GitHub workflows                                                         | `bun fmt`                              | `actionlint`, `zizmor`           |                          |

Not formatted:

- `web/plugin/*.page`: Unraid page files, a `key=value` header and `---` before PHP mixed with HTML; no formatter reads that safely. `just php-lint` syntax-checks the PHP part.
- `plugin/ugreen-nas-control.plg.tmpl` and the rendered `.plg`: XML with entities and inline shell scripts; a formatter would change the scripts. `plugin/tools/plg.ts check` (`just plg-check`) proves the rendered file is well-formed.
- SVG: hand-drawn, only checked for well-formedness.
- `backend/go.mod`, `web/bun.lock`, `flake.lock`, `LICENSE`, `.gitignore`, `.gitattributes`, `CODEOWNERS`, `plugin/files.txt`, PNG: tool-owned or not code.

Generated files (`.gitattributes`) are not formatted by hand: their generators call `scripts/format.ts` (`bun fmt --stdin-filepath`), so `just docs` and `just e2e --update` write output that `just fmt-check` accepts. `CHANGELOG.md` is written in the formatted layout by `plugin/tools/changes.ts`; `.plg` is not formatted.

## Harness

`just harness` starts `php -S` on 127.0.0.1 around the real plugin files (`web/tools/harness/serve.ts`). Files are laid out like the plugin installs them (`.build/plugin`, made by `just web-build`) in a temp directory; nothing outside it is written and no hardware is touched. The NAS API answers from the sample data of one model, the LED API is the real `web/plugin/led/api.php` on a fake backend. `just e2e --old` serves the hand-written front end of `upstream/main` (`src/web/js`, `led/src/web/js`, mapped in `web/tools/harness/serve.ts`) on the same layout to compare the UIs.

```
just harness dxp4800-gt     # any id from web/models/
```

Open the printed URL. `?p=dash` shows the dashboard tile, `?shot=1` freezes the clock and animations. Details: `web/tools/harness/README.md`. What it does not cover: the Go tools against real chips, Unraid's own page chrome, and code paths that need the `/sys` of a UGREEN device. Those need hardware; say in the PR which model you tested on.

## Screenshots and the site

`just shots` drives the harness with `Bun.WebView` for every model in `web/models/` with `shots: true`, every applicable page and both themes. Output: `.build/shots/<model>/<page>-<theme>.png` and `index.json`. Pages: overview, case, fans, sensors, leds, settings, about, dashboard. macOS uses WebKit; Linux uses Chromium over CDP ([Bun.WebView](https://bun.sh/docs/runtime/webview)): the flake devShell provides it with Inter and DejaVu fonts and sets `BUN_CHROME_PATH` and `FONTCONFIG_FILE` (outside the shell: `BUN_CHROME_PATH`, `chromium` on PATH, or nixpkgs on demand). The `e2e` CI job (not yet required by `ci-ok`; the Linux run is untested; Chrome on macOS (`E2E_BACKEND=chrome`) passes single scenarios but a full run still shows 232 diffs and crashes, so the golden is only proven for WebKit) runs `just e2e` and `just shots dxp4800-gt` on Linux in the `e2e` job and uploads `.build/shots` and the e2e output on failure. `SHOTS_SCALE=2` renders at double resolution.

`just site` validates `web/models/` and builds `.build/site` (one page per model). `just site-preview` builds it and serves it at `http://localhost:8788/ugreen-nas-control/`, the base path of GitHub Pages (rebuilds on changes). `SITE_STREAM=next just site` adds the preview banner and noindex of the `/next/` and `/lab/` streams (base URL via `SITE_URL`, released site via `ROOT_URL`). The Pages workflow publishes `main` at `/`, `next` at `/next/` and `site` at `/lab/` in one deployment (landing page, model pages, live demo; no screenshots). The only committed screenshots are the four for the Community Applications listing: `just ca-shots` renders DXP6800 Pro overview, fans, case and LEDs (dark) into `docs/ca/`, declared in `.gitattributes`; `plugins/ugreen-nas-control.xml` links them on `main` (the store takes plain `<Screenshot>` image URLs, one tag per image).

## Tests

| What                                                     | Where                                                                                                                              | Needs hardware |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Go unit tests (fake `Ports` interface), `-race`          | `backend/internal/fan`, `backend/internal/led/chip`, `backend/internal/led/ledctl`, `backend/internal/hw`, `backend/internal/mqtt` | no             |
| `ugreen-nas-ctl`: LED switch, rivals, fan daemon, report | `backend/internal/nasctl`, `backend/internal/led/parity` (`just parity`)                                                           | no             |
| Go tools vs the recorded shell behaviour                 | `backend/internal/led/parity` (`just parity`)                                                                                      | no             |
| Archive: file list, links, modes, install paths          | `bun plugin/tools/plg.ts check` (`just plg-check`)                                                                                 | no             |
| UI in a real browser against recorded requests           | `web/tools/e2e` (`just e2e`; CI job `e2e`, not in `check`)                                                                         | no             |
| Frontend unit tests, i18n parity, the sources build      | `web/src/**/*.test.ts`, `web/tools/check-i18n.ts`                                                                                  | no             |
| `.plg` renders, manifest matches tree, XML well-formed   | `plugin/tools/plg.ts check`                                                                                                        | no             |
| Fan chip, LED controller, real Unraid                    | by hand                                                                                                                            | yes            |

## Add a model

1. Copy a similar file in `web/models/` to `web/models/<id>.ts` (lowercase, dashes). The schema and field docs are in `web/models/schema.ts`.
2. `just models-check`, then `just harness <id>` and look at it.
3. `just docs` to refresh the tables; commit the changed `README.md` and `docs/hardware.md`.
4. If the plugin itself must learn the model (DMI pattern, case drawing, fan wiring), change `web/src/features/nas/app.ts` (`MODELS`) and, for fan wiring, `backend/internal/fan/hardware.go`; add the Go tests. The registry only drives docs, harness, screenshots and the site.
5. Add a `.changes/` fragment of type `model`.

Status words are defined in [hardware.md](hardware.md).

## Conventions

- Branch from `next`, one topic per PR, squash merge. See [CONTRIBUTING.md](../.github/CONTRIBUTING.md).
- PR title: `type(scope): summary`, for example `fix(fan): hold the minimum speed in Quiet mode`. Types: `feat`, `fix`, `model`, `docs`, `chore`.
- One fragment per PR in `.changes/` ([format](../.changes/README.md)).
- Do not edit `plugin/ugreen-nas-control.plg` or `CHANGELOG.md`; do not commit generated files (`just generated-check`).
- i18n keys: `page.section.item` style, added in `en`, `de` and `es` together ([translations.md](translations.md)).
- Test installs on a real NAS: see [Testing on a real NAS](#testing-on-a-real-nas).
- After an incident, add the gotcha to the doc of the matching topic.

## Testing on a real NAS

`just plg-serve [X.Y] [host]` (on the dev machine) builds the Go binary and the web files, packs the archive, renders a test plg and serves `.build/plg-test` with `Bun.serve` on `0.0.0.0:8790` (`--port`, `--host IP` on `bun plugin/tools/plg.ts serve`). It prints the command to run in the NAS terminal (as root):

```
plugin install http://<lan-ip>:8790/ugreen-nas-control.plg
```

This runs the real install path: plugin manager, install script, boot cache, daemons. Ctrl-C stops the server.

`just plg-serve` writes the dev machine's LAN IP into the plg, which a NAS on another VLAN cannot reach. Then serve on loopback and tunnel the port from the dev machine: `just plg-serve '' 127.0.0.1` (same as `bun plugin/tools/plg.ts serve --host 127.0.0.1`), keep `ssh -R 8790:127.0.0.1:8790 <nas>` open, and run `plugin install http://127.0.0.1:8790/ugreen-nas-control.plg` on the NAS.

- Version `X.Y.tYYYYMMDDHHMM` (X.Y = latest release in `CHANGELOG.md`). The plugin manager compares versions with `strcmp` and refuses to install the same or a lower one, so a test version sorts above `X.Y` and below the next release `X.(Y+1)`; every serve run gets a new minute stamp.
- Only `--test` renders accept `--release-url` and `--plugin-url`; `just plg-check` refuses a stable or beta plg whose release URL is not a GitHub release of this repository.
- The plg installs as `ugreen-nas-control.plg`, replacing the official one. Roll back: `plugin remove ugreen-nas-control.plg`, then `plugin install https://raw.githubusercontent.com/alexanderschubert/ugreen-nas-control/main/plugin/ugreen-nas-control.plg`. `fan.cfg`, `leds.cfg` and the other settings in `/boot/config/plugins/ugreen-nas-control/` survive the remove.
- The NAS must reach the dev machine on port 8790. Say in the PR which model you tested on.
