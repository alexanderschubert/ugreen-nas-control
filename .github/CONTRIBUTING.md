# Contributing

Bug reports, model reports, translations and code are welcome. Be kind: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Setup

```
git clone https://github.com/<you>/ugreen-nas-control && cd ugreen-nas-control
just setup && just check
```

With nix installed, every `just` recipe runs inside the flake's dev shell (go, bun, php, shellcheck and the rest), from any shell; nothing else to install. `just check` installs the locked JS dependencies (`bun install --frozen-lockfile`) and runs everything CI runs; `just setup` enables the pre-commit hook (staged-only format and syntax checks), `just fmt` formats every file type. Without nix, install the tools listed in `flake.nix` yourself. More: [docs/development.md](../docs/development.md).

## Branches

| Branch | Holds                                                                                                 | Pages    |
| ------ | ----------------------------------------------------------------------------------------------------- | -------- |
| `main` | the released plugin; releases are tags `vX.Y`                                                         | `/`      |
| `next` | development; feature PRs target it                                                                    | `/next/` |
| `site` | design playground for the site, branched from `next`, `docs/site/` only; merged into `next` when done | `/lab/`  |

A push to any of the three rebuilds the whole Pages deployment. `/next/` and `/lab/` are marked noindex and show a preview banner.

## Workflow

1. Branch from `next` (`git fetch upstream && git switch -c my-change upstream/next`). `main` is for releases only.
2. One topic per PR. Rebase on `next` right before you open it.
3. Several PRs touching the same file: stack them (each branched on the previous) or send one PR. Do not open parallel PRs that edit the same lines.
4. Add one fragment `.changes/<slug>.md` ([format](../.changes/README.md)), or ask for the label `no-changelog` when nothing a user sees changes.
5. `just check` before you push. Run `just harness` and look at UI changes; say in the PR which model you tested on, or that you used the harness only.
6. PR title: `type(scope): summary`, for example `feat(led): night mode per bay`. Types: `feat`, `fix`, `model`, `docs`, `chore`. The squash commit uses it.

## Rules

- Never edit `plugin/ugreen-nas-control.plg`, `CHANGELOG.md` or a version number. The release workflow writes them; CI rejects PRs that touch them.
- Never commit generated files (JS bundles, PNG icons, `.build/`). The plugin ships what `just web-build` makes from `web/src`; `just generated-check` fails when a generated file is tracked.
- New texts need keys in every language (`en`, `de`, `es`, `fr`, `it`, `nl`, `zh`); see [docs/translations.md](../docs/translations.md).
- Scripts are TypeScript on Bun. No Python, no Node.
- Generated docs blocks (the models tables) come from `web/models/`: run `just docs`.
- Keep docs to current facts: no history, no marketing words.
- Comments only for facts the code cannot show: hardware register sources, safety invariants and why they hold, Unraid or browser quirks, deliberate deviations from the obvious approach.
- No comment that restates the code, names the next block, narrates a step or tells history.
- AI-assisted PRs are fine if you tested the result (harness or hardware) and say so.

## What CI checks

Everything `just check` runs (format, PHP syntax, XML, docs links, models, generated files, plus the parts below). Go: lint, tests with `-race`, static build, the Go tools against the goldens recorded from the old shell scripts. Shell: shellcheck, shfmt on the few remaining files. Frontend: format, lint, types, tests, i18n parity, the sources build. Plugin: manifest, `.plg` render, fragments. Models registry. Generated files: none tracked outside `.gitattributes`. Workflows: actionlint, zizmor. Guard: no `.plg` or `CHANGELOG.md` in the PR, fragment present. Release PR: the rebuild equals the draft release. The single required check is `ci-ok`.

## Report a new model

Run `/usr/local/emhttp/plugins/ugreen-nas-control/backend/ugreen-nas-ctl report` on the Unraid box and paste the JSON into the [model report form](https://github.com/alexanderschubert/ugreen-nas-control/issues/new?template=model-report.yml), then tick what works; or use **About, Confirm my device** in the plugin. A report moves a capability from _expected_ to _community_ ([how verification works](../docs/hardware.md#how-verification-works)). To add the model yourself: [docs/development.md](../docs/development.md#add-a-model) and [docs/hardware.md](../docs/hardware.md).

## Bugs and ideas

Use the [issue forms](https://github.com/alexanderschubert/ugreen-nas-control/issues/new/choose) or ask in the [forum thread](https://forums.unraid.net/topic/201044-plugin-ugreen-nas-control-led-fan-and-system-control-for-ugreen-dxdxp-nas/). Security problems: [SECURITY.md](SECURITY.md).
