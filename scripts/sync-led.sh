#!/bin/bash
#
# Copies the LED part of alexanderschubert/ugreen-led-control into led/, with the
# paths and the plugin name rewritten for this plugin. Nothing else is changed, so
# a new LED release shows up as a small diff.
#
#   scripts/sync-led.sh /path/to/ugreen-led-control [ref]     (ref: tag or commit, default HEAD)
#
# led/VERSION records "<describe> <commit> <repo url>". The URL comes from LED_REPO
# (default: alexanderschubert/ugreen-led-control); scripts/check-led.sh fetches that
# commit and fails if led/ differs from a fresh copy. LED_OUT (default led/) moves the
# output, which is how the check works without touching the checkout.
#
set -euo pipefail

SRC="${1:?usage: sync-led.sh <path to the ugreen-led-control checkout> [ref]}"
REF="${2:-HEAD}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${LED_OUT:-${ROOT}/led}"
REPO="${LED_REPO:-https://github.com/alexanderschubert/ugreen-led-control}"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

FLAG="/boot/config/plugins/ugreen-nas-control/led.enabled"

git -C "${SRC}" archive "${REF}" i2c src/backend/ugreen-led-ctl src/event/stopping \
    src/web/UGREENLEDControl.page src/web/UGREENLEDDashboard.page src/web/api.php \
    src/web/js/app.js src/web/js/dash.js src/web/js/i18n.js src/web/css/app.css \
    src/web/include/lang.php src/web/icons/ugreen-led-control.png \
    src/web/images/ugreen-led-control.png | tar -x -C "${TMP}"

rm -rf "${OUT}"
mkdir -p "${OUT}"
cp -R "${TMP}/i2c" "${TMP}/src" "${OUT}/"
rm -f "${OUT}/i2c/ugreen-led-i2c"

# Plugin name and paths. The LED files live in <plugin>/led/, the pages and the
# event hook (which Unraid only finds in the plugin's top directory) are copied
# there by the .plg.
rewrite() {
    sed -i.orig \
        -e 's#/boot/config/plugins/ugreen-led-control\.plg#/boot/config/plugins/ugreen-nas-control.plg#g' \
        -e 's#/boot/config/plugins/ugreen-led-control/#/boot/config/plugins/ugreen-nas-control/#g' \
        -e 's#plugins/ugreen-led-control/#plugins/ugreen-nas-control/led/#g' \
        "$1"
    rm -f "$1.orig"
}

while IFS= read -r file; do
    rewrite "${file}"
done < <(find "${OUT}/src" -type f \( -name '*.php' -o -name '*.js' -o -name '*.page' -o -name '*.css' -o -name 'ugreen-led-ctl' -o -name stopping \))

# Fixed modes, so the result does not depend on the source checkout or the umask.
find "${OUT}" -type f -exec chmod 644 {} +
chmod 755 "${OUT}/src/backend/ugreen-led-ctl" "${OUT}/src/event/stopping"

# The LED pages exist only while the switch in UGREEN NAS Control is on.
python3 - "${OUT}/src/web" "${FLAG}" <<'PY'
import sys
web, flag = sys.argv[1:]
cond = f"is_file('{flag}')"

p = f"{web}/UGREENLEDControl.page"
s = open(p).read()
assert 'Cond=' not in s.split('---')[0]
s = s.replace('Markdown="false"', f'Cond="{cond}"\nMarkdown="false"', 1)
open(p, 'w').write(s)

p = f"{web}/UGREENLEDDashboard.page"
s = open(p).read()
assert 'Cond="' in s.split('---')[0]
s = s.replace('Cond="', f'Cond="{cond} && ', 1)
open(p, 'w').write(s)
PY

# The event hook runs at every array stop; with the LEDs switched off it must do nothing.
python3 - "${OUT}/src/event/stopping" "${FLAG}" <<'PY'
import sys
p, flag = sys.argv[1:]
s = open(p).read()
head, rest = s.split('\n', 1)
open(p, 'w').write(f'{head}\n[ -f {flag} ] || exit 0\n{rest}')
PY

echo "$(git -C "${SRC}" describe --tags --always "${REF}") $(git -C "${SRC}" rev-parse "${REF}") ${REPO}" > "${OUT}/VERSION"
echo "Copied $(cat "${OUT}/VERSION") to ${OUT#"${ROOT}/"}/."
