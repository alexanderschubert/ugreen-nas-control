#!/bin/bash
# Installs the working copy on the NAS, without a release.
# Needs build/ugreen-nas-fan: the CI artifact of the "Fan tool" workflow or a release binary.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="/usr/local/emhttp/plugins/ugreen-nas-control"

echo "Installing UGREEN NAS Control development build..."
echo "Source: $ROOT"
echo "Target: $DEST"

if [ ! -f "$ROOT/build/ugreen-nas-fan" ]; then
    echo "build/ugreen-nas-fan missing – download the CI artifact or a release binary first." >&2
    exit 1
fi

# The running daemon belongs to the old files; stopping it restores the BIOS fan values.
if [ -x "$DEST/backend/ugreen-nas-ctl" ]; then
    "$DEST/backend/ugreen-nas-ctl" stop >/dev/null 2>&1 || true
fi

rm -rf "$DEST"
mkdir -p "$DEST/backend" "$DEST/css" "$DEST/js" "$DEST/include" "$DEST/images" "$DEST/icons"

cp "$ROOT/src/backend/ugreen-nas-ctl" "$DEST/backend/"
cp "$ROOT/build/ugreen-nas-fan" "$DEST/backend/"
cp "$ROOT/src/web/api.php" "$ROOT/src/web/UGREENNASControl.page" "$ROOT/src/web/UGREENNASDashboard.page" "$DEST/"
cp "$ROOT/src/web/css/app.css" "$DEST/css/"
cp "$ROOT/src/web/js/app.js" "$ROOT/src/web/js/i18n.js" "$ROOT/src/web/js/dash.js" "$DEST/js/"
cp "$ROOT/src/web/include/lang.php" "$DEST/include/"
cp "$ROOT/src/web/images/ugreen-nas-control.png" "$DEST/images/"
cp "$ROOT/src/web/icons/ugreen-nas-control.png" "$DEST/icons/"

chmod 755 "$DEST/backend/ugreen-nas-ctl" "$DEST/backend/ugreen-nas-fan"
find "$DEST" -type f ! -path "$DEST/backend/*" -exec chmod 644 {} +

"$DEST/backend/ugreen-nas-fan" probe
"$DEST/backend/ugreen-nas-ctl" start

echo
echo "Installation complete."
