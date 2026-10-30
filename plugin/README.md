# plugin/

`ugreen-nas-control.plg` is generated. Do not edit it, and do not touch it in a feature PR.

- `ugreen-nas-control.plg.tmpl`: the .plg with placeholders, including the install and remove scripts.
- `files.txt`: every shipped file (`source dest mode`; `release:<name>` = binary from `.build/bin/`). The one Go binary is `backend/ugreen-nas`; the four tool names are links to it, lines of the form `release:<tool> <dest> -> <target>`. The packer, the harness and the template read the same list. Sources under `web/plugin` that are not tracked (bundles, PNG icons) come from `just web-build`.
- `bun plugin/tools/plg.ts pack [--version X.Y] [--beta --run N] [--out DIR]` builds the web files and writes `ugreen-nas-control-<version>.tar.xz`: every file of `files.txt` at its install-relative path, binaries from `.build/bin/`; the default output is `.build/dist/`. The archive is reproducible (sorted entries, fixed mtime, owner root): the same sources give the same SHA256.
- `bun plugin/tools/plg.ts render [--version X.Y] [--beta --run N] [--out DIR]` writes `ugreen-nas-control.plg` (or `-beta.plg`) with SHA256 and MD5 of that archive, the only download. `just plg` runs both.
- `bun plugin/tools/plg.ts check`: manifest and tree agree, the archive has exactly the manifest's files, links and modes, the tool names and the event hook keep their install paths, it is reproducible, both channels render, XML is well-formed.
- The change list comes from `../CHANGELOG.md` (latest 20 releases); fragments in `../.changes/` feed it at release.

## Versions

Unraid compares plugin versions as text (`strcmp` in `dynamix.plugin.manager/scripts/plugin`), so `3.10` sorts below `3.9`.

- Stable: `X.Y`, two numbers. After `3.9` comes `4.0`, never `3.10`.
- Beta: `X.Y.bNNNNNN`, X.Y = latest stable, N = CI run number, zero-padded to six digits. `3.6.b000042` sorts above `3.6` and below `3.7`, and betas sort by run. A beta never outranks the next stable.
- Both channels use the plugin `name` `ugreen-nas-control` (the Plugins page looks up icon and README by it); the file name (`ugreen-nas-control.plg` or `-beta.plg`) tells them apart. The settings page reads the version from whichever file exists.
- Stable installs from `main`'s `.plg` (raw URL). Beta installs `ugreen-nas-control-beta.plg` from the rolling `beta` prerelease.

## Install and remove

- The archive is cached per version in `/boot/config/plugins/ugreen-nas-control/<version>/`. Its listing is checked first (only files, folders and links; no absolute path, no `..`), then it is unpacked (`tar -xJm --no-same-owner --no-same-permissions`, so files get the install time) into a hidden staging folder, checked against the expected file and link list, and swapped in with `mv`. Any error fails the install and leaves the running version untouched. Daemons are stopped before the swap and started after. No Slackware package tools are used.
- Only cache folders named like a version are pruned.
- Stable and beta refuse to install while the other is installed. Switch: remove one on the Plugins page (settings stay), then install the other.
- Remove keeps `fan.cfg`, `leds.cfg`, `fan_rpm.json`, `led.enabled` in `/boot/config/plugins/ugreen-nas-control/`. Wipe them with `rm -rf /boot/config/plugins/ugreen-nas-control`.
- `min="7.2.0"`. The loader supports `min` on the plugin and `Min`/`Max` on a `<FILE>`.
