# Unraid compatibility

Facts checked on 2026-10-29. "(unverified)" marks anything not read in an official source or in our code. Re-check the release table and section 3 before every release (the checklist is in section 2.4).

## 1. Supported versions

### 1.1 What we declare

| Where                                       | Value             | Meaning                                                                                                            |
| ------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `plugin/ugreen-nas-control.plg.tmpl:21`     | `min="7.2.0"`     | The plugin manager refuses install and update below it, and at boot moves the `.plg` to `plugins-error`. No `max`. |
| `plugins/ugreen-nas-control.xml` `<MinVer>` | `7.2.0`           | Community Applications hides the app below it. `just plg-check` keeps it equal to `min`.                           |
| `web/models/*.ts`                           | no Unraid version | `fixture.ts:122` (`unraid: '7.3.2'`) is sample data for the harness, not a declared range.                         |
| `web/plugin/UGREENNASDashboard.page`        | no `Cond`         | `min` already excludes every release without the 7.2 tile layout (lines 20-30).                                    |

No `max` and no `Unraid` attribute: the plugin must stay installable on a new release the day it ships. The loader compares `check_version` (the installed Unraid version, for example `7.4.0-rc.2`) with `version_compare`; a `max` below the running version fails the install and moves the `.plg` to `plugins-error` at boot ([plugin script, lines 717-730](https://raw.githubusercontent.com/unraid/webgui/master/emhttp/plugins/dynamix.plugin.manager/scripts/plugin)). `version_compare('7.4.0-rc.2', '7.4.0', '<')` is true, so a `min="7.4.0"` would also reject the release candidates.

`min` is `7.2.0` because the tile header uses the 7.2 flexbox layout (1.3, row 2); 7.0.x and 7.1.x were never tested.

### 1.2 Releases and PHP

Source: [Unraid News](https://unraid.net/blog) and the release notes at `https://docs.unraid.net/unraid-os/release-notes/<version>/`.

| Release       | Date       | PHP                                                                      | Status on 2026-10-29                                                  |
| ------------- | ---------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 7.0.0         | 2025-01-09 | 8.3.8                                                                    | older                                                                 |
| 7.1.0         | 2025-05-05 | 8.3.19                                                                   | older                                                                 |
| 7.2.0         | 2025-10-29 | 8.3.26                                                                   | responsive webGUI                                                     |
| 7.2.5 - 7.2.7 | 2026-04-30 | 8.3.29 - 8.3.31                                                          |                                                                       |
| 7.2.8         | 2026-07-29 | 8.4.23                                                                   | PHP 8.3 to 8.4 inside the 7.2 branch                                  |
| 7.2.9         | 2026-10-23 | 8.4.27                                                                   | [security update for 7.2](https://unraid.net/blog/unraid-7-2-9)       |
| 7.3.0         | 2026-05-12 | 8.4.21                                                                   | stable                                                                |
| 7.3.4         | 2026-10-22 | 8.4.27                                                                   | [latest stable](https://unraid.net/blog/unraid-7-3-4)                 |
| 7.4.0-rc.2    | 2026-10-22 | 8.4.27 ([notes](https://docs.unraid.net/unraid-os/release-notes/7.4.0/)) | newest, release candidate; no 7.4.0 stable yet (blog list shows none) |

So the plugin must run on PHP 8.3 (7.2.0 to 7.2.7) and 8.4 (7.2.8 and later). `web/plugin/api.php:16` uses the `never` return type (PHP 8.1 or newer); every row above ships 8.3 or 8.4. The flake lint uses `php84` (`flake.nix:50`). The harness runs the PHP of the dev machine (`php -S`); the 8.3 and 8.4 rows are covered by the test matrix in 2.

7.4.0 stable date: unannounced (unverified). Two PHP RCE fixes (CVE-2026-109618/109619) are in PHP 8.4.27, which is why 7.3.4, 7.2.9 and 7.4.0-rc.2 shipped together; test on 8.4.27 builds, not on older 8.4.x.

### 1.3 webGUI changes 7.2 to 7.4 against our code

Sources: [7.2.0 notes](https://docs.unraid.net/unraid-os/release-notes/7.2.0/), [7.3.0](https://docs.unraid.net/unraid-os/release-notes/7.3.0/), [7.3.3](https://docs.unraid.net/unraid-os/release-notes/7.3.3/), [7.4.0](https://docs.unraid.net/unraid-os/release-notes/7.4.0/), [rc.1 post](https://unraid.net/blog/unraid-7-4-0-rc1), [responsive migration guide](https://forums.unraid.net/topic/192172-responsive-webgui-plugin-migration-guide/), webgui source on `master`.

| Change                                                                                                                                                                                                                                                                      | Our code                                                                                                                                                                                                                                                            | Result                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.2: responsive webGUI; "some plugins may have visual issues"; opt-out `ResponsiveLayout="false"` forces a 1200 px minimum (last resort)                                                                                                                                    | `UGREENNASControl.page:1-4` has no `ResponsiveLayout` (responsive stays on); own grid with breakpoints `css/app.css:1407` (900 px) and `:1433` (560 px); `.unc-nav` scrolls horizontally on narrow screens                                                          | none found by reading; layout below 768 px and the case view are not checked on a real 7.2+ box (open item in 2.3)                                                                                            |
| 7.2: do not add elements to title bars                                                                                                                                                                                                                                      | the page adds nothing to the title bar; the brand and navigation live inside the page body (`UGREENNASControl.page:49-59`)                                                                                                                                          | none found                                                                                                                                                                                                    |
| 7.2: wide tables in `div.TableContainer`, buttons in `<span>`, no fixed widths or floats                                                                                                                                                                                    | no `<table>` in the page or `led/include/views.php`; `float` appears only as `float: none` (`css/app.css:858`, `:1180`)                                                                                                                                             | none found                                                                                                                                                                                                    |
| 7.2: dashboard tile uses `tile-header`, `tile-header-left`, `tile-header-right(-controls)`, `h3.tile-header-main`; old tiles used `<i>` + `div.section` with a `<br>` title; guide's own fallback keeps `tile-header` and switches only the title markup below `7.2.0-beta` | `UGREENNASDashboard.page:21-31` is the 7.2 markup, no version branch. `.tile-header*` has CSS only in Unraid 7.2+; our CSS does not define it (`grep tile-header web/plugin/css` finds nothing)                                                                     | Not an issue: `min` is 7.2.0 (1.1), so 7.0 and 7.1 never install it. On 7.2+ none found                                                                                                                       |
| 7.2: `Cond` and `$mytiles` mechanism unchanged                                                                                                                                                                                                                              | `UGREENNASDashboard.page:3,18` match `DashStats.page` on `master` (`$mytiles[...]['column2']`, `tile-header` block)                                                                                                                                                 | none found                                                                                                                                                                                                    |
| CSRF: `master` `local_prepend.php` checks every POST (not `login.php`, `auth-request.php`); token from `$_POST['csrf_token']` or header `X-CSRF-Token`; failure answers HTTP 403 JSON `{"error": "<reason> csrf_token"}`; `hash_equals`                                     | token from `/var/local/emhttp/var.ini` (`UGREENNASControl.page:7-9,30`); client sends `csrf_token` in the POST body (`web/src/core/api.ts:38-44`); non-2xx with JSON body is turned into an error message (`api.ts`, `failed`); GET answers 405 (`api.php:173-178`) | none found. `master` reads `state/var.ini`, we read `/var/local/emhttp/var.ini`; both are the same file on 7.x (the symlink is unverified), so keep the harness check `web/tools/harness/prepend.php` aligned |
| 7.2.5/7.3.0: "WebGUI security hardening for authenticated-session request handling" (no detail published)                                                                                                                                                                   | n/a                                                                                                                                                                                                                                                                 | detail unavailable (unverified); covered by the POST test in 2.2                                                                                                                                              |
| 7.3.3: webGUI displays text "safely, not treated as HTML"                                                                                                                                                                                                                   | the plugin renders its own page; names from Unraid (`disks.ini`) pass through our JS; not checked whether we escape on the PHP side                                                                                                                                 | open: review `led/api.php` output encoding once (unverified)                                                                                                                                                  |
| 7.4: shared task tray, live install progress (CR-only ticks shown as separate updates), per-plugin update checks, failed validation stays visible, remove hooks run when output contains shell characters                                                                   | install and remove scripts print plain lines (`plugin/ugreen-nas-control.plg.tmpl:61-205`); no carriage returns, no `$` or backticks in messages                                                                                                                    | none found; verify the install log looks right in the tray (2.2, step 6)                                                                                                                                      |
| jQuery / Dynamix JS helpers / `swal`                                                                                                                                                                                                                                        | `grep` over `web/plugin` and `web/src` finds none; plain `fetch` (`api.ts`). `<?autov(...)?>` is used for assets (`UGREENNASControl.page:43`, `UGREENNASDashboard.page:46`)                                                                                         | none found                                                                                                                                                                                                    |
| PHP 8.4 deprecations (implicit nullable parameters and others)                                                                                                                                                                                                              | `php -l` runs in `just php-lint` but only with whatever `php` the shell has; the flake pins `php84`. Runtime deprecations in `api.php` and `led/api.php` are not tested with `error_reporting(E_ALL)`                                                               | none known; open item: run the harness with `E_ALL` and fail on deprecations (section 3.4, item 6)                                                                                                            |
| Process start from PHP                                                                                                                                                                                                                                                      | `api.php:28` `exec(escapeshellarg(...))`; `api.php:437` `nohup ... &` via `shell_exec`; `led/api.php:36` `exec($command)`                                                                                                                                           | none found; 7.4 changes nothing here                                                                                                                                                                          |

Incompatibilities found: none. Nothing in 7.2 to 7.4.0-rc.2 lists a plugin API, theme or CSS removal besides the 7.2 responsive refactor.

## 2. Compatibility test plan

### 2.1 Matrix

Rows are Unraid builds, columns are scenarios. Every cell is run on a real box or VM unless 2.3 says the harness covers it. Build list: **7.2.9** (last 7.2, PHP 8.4.27), **7.2.7** (last 7.2 on PHP 8.3), **7.3.4** (stable), **7.4.0-rc.N** (newest RC; replace by 7.4.0 stable when it ships).

| Build           | A fresh install | B upgrade from the previous stable `.plg` | C reboot | D remove (and reinstall) | E next to stable and back |
| --------------- | --------------- | ----------------------------------------- | -------- | ------------------------ | ------------------------- |
| 7.2.7 (PHP 8.3) | run             | run                                       | run      | run                      | run                       |
| 7.2.9 (PHP 8.4) | run             | run                                       | run      | run                      | skip                      |
| 7.3.4           | run             | run                                       | run      | run                      | run                       |
| 7.4.0-rc.N      | run             | run                                       | run      | run                      | run                       |

Hardware: the fan and LED paths need a DXP6800 Pro or DXP4800 GT. Everything else runs on any x86 VM; on a VM the plugin must report "no supported fan controller" and keep the page usable (`plugin/ugreen-nas-control.plg.tmpl:76-79`).

### 2.2 Steps and pass criteria

Preparation on every build: note `cat /etc/unraid-version`, `php -v`, the server clock. Browser console and `/var/log/syslog` open. "Plugins page" = Plugins tab. `/boot/config/plugins/ugreen-nas-control` is the boot folder. Install URL stable: the raw `.plg` on `main`; next: `https://github.com/alexanderschubert/ugreen-nas-control/releases/download/next-build/ugreen-nas-control.plg` (`docs/releasing.md`).

**A. Fresh install**

1. Plugins, Install Plugin, paste the stable URL, Install.
2. Pass: log ends with `Installation complete.`, exit shown as done, no `ERROR`. Files exist: `ls /usr/local/emhttp/plugins/ugreen-nas-control` shows `api.php`, the two `.page` files, `backend/`, `js/`, `css/`, `led/`. `/boot/config/plugins/ugreen-nas-control/<version>/ugreen-nas-control-<version>.tar.xz` exists. `ls /usr/local/emhttp/plugins/.ugreen-nas-control.*` shows nothing.
3. Settings, Utilities, UGREEN NAS Control opens; the version shown on the page equals the installed one; browser console has no errors and no failed request.
4. POST works: change the language (action `lang`, a write). Reload: the setting stuck; `fan.cfg` changed. A POST with a wrong token returns 403 (`curl -s -o /dev/null -w '%{http_code}' -d 'action=lang&value=de&csrf_token=x' http://<ip>/plugins/ugreen-nas-control/api.php`).
5. Dashboard: the tile appears, can be dragged, collapsed and hidden; header icon, title and cog align at 360, 768 and 1600 px widths (browser dev tools). Settings page: navigation scrolls, no horizontal page scroll at 360 px; dark and light theme.
6. Install log in the 7.4 task tray (7.4 only): lines appear live, no garbled output.
7. On a UGREEN box: fan mode change changes `ugreen-nas-fan status` duty within 4 s; LED switch on shows the LEDs; `pgrep -f ugreen-nas-fan` shows one daemon. On a VM: daemon not started, warning in the log, page still loads.

**B. Upgrade from the previous stable (currently 3.6)**

1. Install the previous release from its release URL on `main`, then change settings (fan mode, one LED colour, language), start the daemon.
2. Plugins, Check for Updates, Update (or install the new `.plg`).
3. Pass: log ends with `Installation complete.`; settings unchanged (`diff` of `fan.cfg`, `leds.cfg` before and after); old cache folder `/boot/config/plugins/ugreen-nas-control/3.6/` is gone and the new one exists; other folders created by the user inside the boot folder are still there; fan duty never reads 0 % for more than one poll; one daemon process; the page works after a hard reload (no stale JS: `autov` and `tar -m` give new mtimes).
4. Fail test: delete the archive from the cache folder before the install script runs (or point `<URL>` to a 404 in a local copy). Pass: the install fails with a non-zero exit, the old version keeps running, no half-installed tree.
5. Version order: `5.0.9` then `5.1` and next `5.1-next.000042` between `5.0.3` and `5.2` (loader uses `strcmp`, `plugin/README.md`); run the comparison in `plugin/tools/plg.ts check` locally.

**C. Reboot**

1. With the plugin installed and settings set, reboot with the array started.
2. Pass: the plugin manager reinstalls from the boot cache without network (unplug the cable on one run); the daemon runs again; LED state as configured; the dashboard tile is present; no entry in `/boot/config/plugins-error`; `syslog` has no `ugreen-nas-control` error.
3. Reboot with the array stopped and auto start off: the settings page loads; no PHP error in `syslog`.
4. Shutdown: `event/stopping` (source `plugin/event/stopping`) runs `ugreen-nas-ctl event stopping` (power LED signal if the LED part is on); after power-on the fans were handed back to the BIOS values before power-off (`/var/run/ugreen-nas-control.bios` is gone after reboot and recreated on start).

**D. Remove and reinstall**

1. Plugins, Remove. Pass: fans return to BIOS values (`ugreen-nas-fan status` is gone; check fan rpm with `sensors` or by ear), no process `ugreen-nas-fan`, `/usr/local/emhttp/plugins/ugreen-nas-control` and the hidden `.new`/`.old` folders are gone, cron file removed, `update_cron` ran, settings (`fan.cfg`, `leds.cfg`, `fan_rpm.json`, `led.enabled`) still in the boot folder (`plugin/README.md`, remove).
2. Menu entries gone; a favourite heart on the Settings page does not leave a broken entry.
3. Reinstall: settings come back as before.
4. On 7.4: a remove whose output contains shell characters still completes (hook runs; the 7.4 notes list the fix).

**E. Next and stable**

1. With stable installed, install the next URL. Pass: install refuses with `... is installed. Remove it on the Plugins page first` (`plugin/ugreen-nas-control.plg.tmpl:96-98`).
2. Remove stable, install next. Pass: version `3.7-next.NNNNNN` shown on the page (`UGREENNASControl.page:19-26` reads the next file), settings kept.
3. Remove next, install stable. Pass: as in B. Check Plugins page: exactly one entry, icon and README shown (same plugin `name`).
4. Update check: with next installed, "Check for updates" shows no update unless a newer next build or a newer stable exists.

### 2.3 What the local harness covers

| Check                                                                                           | Command                                               | Covers                                                                                                                      | Does not cover                                                                            |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| PHP syntax                                                                                      | `just php-lint`                                       | `*.php` and the PHP part of `*.page`                                                                                        | runtime deprecations, PHP version differences                                             |
| `.plg` and XML well-formed, manifest equals archive, archive reproducible, both channels render | `just plg-check`, `just xml-lint`                     | `.plg` structure, SHA256/MD5, `min` equals `<MinVer>`                                                                       | what the loader does with it; the install script                                          |
| UI, API contract, POST CSRF rejection, all models, themes                                       | `just harness <model>`, `just shots`, `just web-test` | settings page and tile on php 8.4 with a fake Unraid (`web/tools/harness/README.md`), screenshots per model, page and theme | real Unraid CSS, the 7.2+ responsive layout, the dashboard's drag/collapse, the task tray |
| Go behaviour (fan, LED, parity with the shell backend)                                          | `just go-test`, `just parity`                         | logic without hardware                                                                                                      | `/dev/port`, `/dev/mem`, `/dev/i2c-N` on real chips                                       |
| Install script logic                                                                            | none                                                  | -                                                                                                                           | everything in `INLINE` (stage, swap, prune, remove); needs a box or VM                    |

Needs a real Unraid box or VM, not the harness: all cells of 2.1, the responsive layout with Unraid's CSS, the install log in the task tray, reboot/boot-cache behaviour, `update_cron`, `restore_favorites`, the next/stable switch, and everything touching the chips.

### 2.4 Release checklist (per Unraid release)

1. Read the new release notes under "WebGUI / System" and "Plugins"; grep for `plugin`, `.page`, `jQuery`, `csrf`, `theme`, `dashboard`.
2. Re-read `local_prepend.php`, `DashStats.page` and `dynamix.plugin.manager/scripts/plugin` on `master` against sections 1.1 and 1.3.
3. Run the matrix rows for the new build (2.2 A, B, C, D).
4. Update the tables in section 1; remove rows for builds no longer supported.

## 3. Unraid 8

### 3.1 What is known

| Fact                                                                                                                                                                                                                                                                                                                                        | Source                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Base OS moves to Fedora via Universal Blue uCore; immutable; optional LTS or newer kernel; snapshot-based updates and Secure Boot planned                                                                                                                                                                                                   | [Unraid 8 Announced, 2026-08-17](https://unraid.net/blog/unraid-8-announced), [Q&A, 2026-10-15](https://unraid.net/blog/unraid-8-qa) |
| Plugins move to "a new, more structured system": a developer describes what the plugin does (add to a page, manage a container, provide a web service); the user sees the permissions before installing; a plugin developer SDK comes with it; Unraid builds parts of itself with the same system                                           | Q&A; Announced                                                                                                                       |
| Existing plugins "will need to be adapted"; compatibility is checked while preparing the upgrade; Limetech contacts plugin developers directly "in the coming weeks"                                                                                                                                                                        | Q&A                                                                                                                                  |
| Private alpha "coming soon", public beta targeted for early 2027, then release candidates; stable "when it's ready"; waitlist form on the announcement page                                                                                                                                                                                 | Q&A; Announced                                                                                                                       |
| Containers do not run as root by default; VMs run as a dedicated QEMU user; the UI helps fix permissions; Traefik becomes the reverse proxy; OIDC at launch                                                                                                                                                                                 | Q&A                                                                                                                                  |
| More packages from uCore (Git, Python mentioned); NerdPack/NerdTools replacement undecided; containers recommended for extra tools                                                                                                                                                                                                          | Q&A                                                                                                                                  |
| Developer docs and tooling "are on the way": none public yet. The Unraid API (GraphQL, built in since 7.2) documents no third-party plugin extension; its "API plugins" are npm packages for the Nest server (`github.com/unraid/api`, `api/docs/developer/api-plugins.md`) and are not shown to be the Unraid 8 plugin format (unverified) | [docs.unraid.net/API](https://docs.unraid.net/API/), unraid/api repo                                                                 |

Not known (unverified): the plugin manifest format, whether `.plg` and `.page` files are still read, whether PHP stays in the webGUI, whether `/usr/local/emhttp/plugins`, `/boot/config/plugins` and Slackware package tools exist, how a plugin asks for device access or a long-running service, whether `/dev/port`, `/dev/mem` and `/dev/i2c-N` can be granted, how updates and Community Applications entries work. Do not design against guesses on these.

### 3.2 How our components map

| Ours                                                                                             | Unraid 8 concept (from the Q&A)          | State                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings page `UGREENNASControl.page` (PHP, inline script, CSS)                                  | "adding to a page"                       | Frontend is a TypeScript bundle (`web/src`, built to `.build/plugin/js`) that only talks JSON to `api.php` through a typed client (`web/src/core/api.ts`). The PHP shell passes five `window.*` values.                                                                                                  |
| Dashboard tile `UGREENNASDashboard.page` (`$mytiles`, `tile-header*`)                            | "adding to a page"                       | Tile logic is `web/src/dash`; the markup is a PHP heredoc in the page (lines 18-44). Depends on `DashStats.page` internals.                                                                                                                                                                              |
| `ugreen-nas-fan daemon` started by `ugreen-nas-ctl`                                              | "providing a web service" / a service    | Static Go binary, state in `/var/run/ugreen-nas-control.json`. Today `ugreen-nas-ctl` (the same binary, pidfile) starts it from the install script and from the boot-time reinstall; there is no service unit.                                                                                           |
| LED backend `ugreen-led-ctl` and `ugreen-led-i2c` (Go)                                           | service                                  | `backend/internal/led/ledctl`, shipped in the one binary and checked against the recorded goldens by `just parity` (`docs/architecture.md`).                                                                                                                                                             |
| Hardware access: `/dev/port` (fan chips), `/dev/mem` (DXP4800 GT LEDs), `/dev/i2c-N` (LED SMBus) | permissions the user sees before install | Three raw hardware permissions plus read access to `/boot/config/plugins`, `/var/local/emhttp/*.ini`, `/proc`, `/sys/class/hwmon`. How Unraid 8 expresses and grants them is unknown (3.1). The Q&A names non-root defaults for containers and VMs; whether a plugin service can run as root is unknown. |
| `plg` install and remove scripts (bash `INLINE`)                                                 | replaced by the declarative description  | Already reduced to: unpack one archive, swap, start (`plugin/ugreen-nas-control.plg.tmpl:61-143`). Logic that is not file placement lives in the binary.                                                                                                                                                 |
| Events (`plugin/event/stopping`)                                                                 | unknown                                  | One hook, a one-line `exec` into the binary; behaviour must move into the daemon (SIGTERM) if the event directory goes away.                                                                                                                                                                             |
| Config in `/boot/config/plugins/ugreen-nas-control`                                              | unknown                                  | Plain `fan.cfg`/`leds.cfg`; paths are overridable by `UGREEN_*` environment variables (`docs/architecture.md`).                                                                                                                                                                                          |

### 3.3 What helps and what blocks

Helps:

- One archive with the whole install tree, with a manifest (`plugin/files.txt`) that the packer, harness and template share. A declarative description can be generated from the same list.
- Static Go binaries with no dependencies; fan and LED code behind `backend/internal/hw` and `backend/internal/led/chip`.
- UI is a typed API client plus a built bundle; every path and tool is overridable, so the UI can run against any server speaking the same JSON (`web/tools/harness`, `web/demo`).
- The browser never touches Unraid internals except the CSRF token and the two `.page` shells.
- Rival-tool detection and the lock are in Go, not in PHP.

Blocks:

- `web/plugin/api.php` (and `led/api.php`, `led/include/views.php`) is PHP that shells out per request (`api.php:28,437`, `led/api.php:36`). It also owns config writes, validation and the calibration job. Needs a PHP runtime and Unraid's `local_prepend.php` CSRF check.
- `.page` files: PHP heredocs, `Menu`/`Cond` header, `$mytiles`, `<?autov?>`, `/var/local/emhttp/var.ini` for the token. All webGUI-specific.
- `.plg` install scripts: bash `INLINE` blocks, `/usr/local/emhttp/plugins` paths, `update_cron`, `restore_favorites` (`plugin/ugreen-nas-control.plg.tmpl:142-145,205`), boot reinstall from `/boot`.
- Backends are Go only (one binary, `ugreen-nas`). `docs/decisions.md` records the single daemon `ugreend` as next step, unverified on hardware.
- CSS and the dashboard tile rely on Unraid's own classes and theme detection (`include/lang.php`).

### 3.4 Preparation we can do now (no Unraid 8 docs needed)

Each item is useful on 7.x too. Order by value:

1. **JSON API in Go.** Move the logic of `api.php` and `led/api.php` (validation, config read/write, calibration job, status assembly) into the Go daemon behind a local HTTP/JSON endpoint (unix socket or 127.0.0.1) that returns the contract the TypeScript client already uses. `api.php` shrinks to a proxy: check method, forward body and the CSRF-verified request, return the answer. The contract lives in one place (`web/src/core`, types shared with Go tests, for example generated JSON schema checked in CI). Prove it with `just harness` and `just parity`; the harness swaps the PHP fixture for the Go server.
2. **One daemon process.** The binary already holds all tools (`backend/cmd/ugreen-nas`); merge the fan and LED daemons and the launcher logic of `ugreen-nas-ctl` into one process with one lock.
3. **Thin `.page` files.** Reduce each page to: read the CSRF token and language, emit `window.*` values, mount the bundle. Move the dashboard tile markup into the bundle (render the `tile-header*` header in JS) so a replacement host needs only a mount point. Delete the dead `Cond` (`UGREENNASDashboard.page:3`).
4. **Declare the plugin's needs in one file.** Add a machine-readable list (a new file next to `files.txt`, or a section in it): hardware nodes (`/dev/port`, `/dev/mem`, `/dev/i2c-*`), read paths, written paths, cron, service, page placements (Settings page, Dashboard tile), network (none). Generate the `.plg` from the same source today; generate the Unraid 8 description from it later.
5. **No Slackware or webGUI helpers in install logic.** Install already is unpack and swap; keep it that way and keep `update_cron` and `restore_favorites` behind a feature test (`[ -x ... ]`) so their absence does not fail anything.
6. **Test discipline on 7.x.** Add `E_ALL` + deprecation-as-failure to the PHP harness; add a headless-browser layout check at 360, 768 and 1600 px for the settings page and tile (`just shots` already renders per model and theme); keep the matrix in section 2 current.
7. **Ask Limetech.** Reply to the forum thread and join the waitlist (see 3.1) to be contacted as a plugin developer; ask for: manifest format, hardware permissions (`/dev/port`, `/dev/mem`, i2c), service lifecycle, SDK access. Answers update 3.1.
8. **Keep `max` unset** until an Unraid 8 build exists. A wrong `max` stops installs at boot (1.1).

Declined, do not re-raise unless the situation changes: targeting the Unraid API (GraphQL/Nest) as a plugin host now, because it is not shown to be the Unraid 8 path (3.1); building against guessed Unraid 8 manifest formats.

### 3.5 Trigger to start the port

Start when any of these appears, whichever is first:

- Public Unraid 8 plugin documentation or SDK on `docs.unraid.net` or `github.com/unraid`.
- The Unraid 8 beta (private alpha access for us, public beta early 2027) with an installable test image.
- Limetech contacts us as a plugin developer.

First steps then: read the permission model for hardware devices; write a minimal plugin that shows one value from `ugreen-nas-fan status` on a page; map `plugin/files.txt` and the needs file onto the manifest; run the matrix in section 2 on the alpha. Watch [Unraid News](https://unraid.net/blog) and the "State of 8" series announced in the Q&A.
