# Releasing

For maintainers. Contributors only need [CONTRIBUTING.md](../.github/CONTRIBUTING.md).

## Branches

- `next` is the development and default branch. Every PR targets it. Each push builds the beta.
- `main` holds released code only. The installed plugin reads `plugin/ugreen-nas-control.plg` from `main` (raw URL), and the Community Applications entry points there too.
- `site` holds the Pages playground (`docs/site/` only).
- Feature PRs never touch `plugin/ugreen-nas-control.plg` or `CHANGELOG.md`; the CI `guard` job fails them unless the branch is `release/*`. Each PR adds one fragment `.changes/<slug>.md` ([format](../.changes/README.md)) or carries the label `no-changelog`.

## Versions

Unraid compares plugin versions as text, so the scheme is fixed:

- Stable `X.Y`, two numbers. After `3.9` comes `4.0`, never `3.10`.
- Beta `X.Y.bNNNNNN`: X.Y is the latest stable, N the CI run number zero-padded to six digits. `3.6.b000042` sorts above `3.6` and below `3.7`.

More in `plugin/README.md`.

## Beta

`.github/workflows/beta.yml` runs on every push to `next`: builds the binaries, packs the release archive `ugreen-nas-control-<version>.tar.xz`, renders `ugreen-nas-control-beta.plg` and replaces the assets of the rolling prerelease `beta` (archive, plg, `SHA256SUMS`). Install URL:
`https://github.com/alexanderschubert/ugreen-nas-control/releases/download/beta/ugreen-nas-control-beta.plg`. The beta plg keeps the plugin `name` `ugreen-nas-control` (icon and README lookup in the Plugins page), only the file name differs; installing one channel refuses while the other is installed. A run never replaces a newer beta (versions compare as text); after the workflow was recreated, delete the `beta` release once so run numbers can start again. The newest five archives stay attached, so a box that lost its boot cache can fetch the version it runs. The beta is announced in the forum thread and the README, not in Community Applications.

## Release

1. Check `next` is green and the fragments in `.changes/` read well. Run `just models-check`: it lists stale checks; re-test them first, see [Re-test the maintainer boxes](#re-test-the-maintainer-boxes).
2. **Actions, Release, Run workflow** on `next`, input the version `X.Y`. The workflow folds the fragments into `CHANGELOG.md` and the plugin's change list, builds the binaries and the archive, renders the `.plg` with its hashes, pushes `release/X.Y`, creates the **draft** release `vX.Y` (archive, `.plg`, `SHA256SUMS`, SBOM; no tag, no public URL) and opens the PR `release/X.Y` to `main`.
3. The required check `ci-ok` includes the job `release`: it rebuilds from the branch and fails unless the rebuilt `.plg` and archive equal the committed `.plg` and the draft's assets. Without `RELEASE_PR_TOKEN` the workflow starts CI on `release/X.Y` itself (`workflow_dispatch`); the checks attach to the same commit.
4. Merge the PR with a **merge commit** (`main` and `next` then share history). The push to `main` verifies the draft's assets against the `.plg` on `main`, attests them (build provenance), deploys the Pages site, then creates the tag `vX.Y` at the merge commit and publishes the draft. A failed site deploy keeps the release a draft; re-run the workflow to retry. Only now do the raw `.plg` on `main` and the download URLs work together. A failed run is safe to re-run: a published release with its archive is skipped, a draft is verified and published.
5. A `main` to `next` PR opens (merge commit; a fast-forward in effect unless `next` moved on). Merge it.
6. The site was already deployed in step 4.
7. Post the release in the forum thread. Rollback: release a new `X.Y+1` with the fix; a published asset is never replaced because installs check its hash.

The site can be deployed at any time without a release: Actions, Pages, Run workflow (input `ref`, default `main`). Releases deploy it automatically and wait for it.

A direct change of the `.plg` on `main` without a draft release fails the publish job ("No draft release"). A release that lacks the archive or the `.plg` fails it too; delete the release and run the workflow again.

The `<PluginURL>` in `plugins/ugreen-nas-control.xml` must stay identical to the `pluginURL` of the `.plg`, and `<MinVer>` equal to `min` in the template; `just plg-check` enforces both. After a change of either XML file, run Validate and Scan at <https://ca.unraid.net/submit/new>. The Overview text lives in `plugins/ugreen-nas-control.xml`; icon and screenshots there point at the Pages site.

## Re-test the maintainer boxes

`just models-check` warns about every `verified` record in `web/models/` that is more than three releases older than the newest release. Before a release, install the beta on both boxes and re-test what is listed:

| Box                                    | Model         | Test                                                                                                                                              |
| -------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| DXP4800 GT (tower)                     | `dxp4800-gt`  | LEDs: colours and Identify per bay. Fans: modes, curves, rpm. Case view: also M.2 slot numbers and LAN 1 = eth0. Sensors: CPU, board, NVMe, disks |
| DXP6800 Pro (upstream development box) | `dxp6800-pro` | LEDs, fans, case view with the inside, sensors                                                                                                    |

For each capability that works, set `version` (the release under test), `date` and `by` in the model file; for one that does not, set `partial` with a `note`, or `expected` and drop `date`. Then `just docs` and commit the model file with the regenerated tables.

## One-time setup

Not stored in the repo; do it in this order before the first release:

1. Create `next` from `main` and make it the default branch (Settings, Branches). Workflows with `workflow_dispatch` (Release) must exist on the default branch.
2. Rulesets on `next` and `main`: require a PR, require the status check `ci-ok`, block force pushes. No linear-history rule.
3. Merge methods: squash and merge commits allowed. Feature PRs into `next` are squashed (the PR title becomes the commit message); the release PR `release/X.Y` to `main` and the back-merge PR use a merge commit. Delete branches on merge.
4. Settings, Actions, General, Workflow permissions: enable **Allow GitHub Actions to create and approve pull requests**. Without it `gh pr create` in the release and back-merge jobs fails with 403.
5. Optional secret `RELEASE_PR_TOKEN`: a GitHub App installation token or fine-grained PAT with contents and pull-requests write. PRs opened with it start CI by themselves. Without it the release PR still gets its checks (step 3 above), but the back-merge PR (`main` to `next`) gets none; merge it with the ruleset bypass of an admin.
6. Pages: Source = GitHub Actions; Settings, Environments, `github-pages`: allow the branches `main`, `next` and `site`. Then run the `Pages` workflow once with **Run workflow** on `main`/`next` before the first release. The Community Applications icon is served from the Pages site, which otherwise answers 404 until the first push to `main`. The store screenshots are `docs/ca/*.png` on `main` (`just ca-shots`).
7. `.github/CODEOWNERS` assigns reviewers by path.
8. Settings, Environments: create `beta` and add a required reviewer. The Beta workflow builds and attests on every push to `next`, then waits for approval before it replaces the rolling `beta` prerelease. It only runs when the repository variable `BETA_ENABLED` is `true`.

See also: [Unraid compatibility](unraid.md) (supported versions, test matrix, Unraid 8 plan).
