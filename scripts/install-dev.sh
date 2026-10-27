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

# The LED part (led/) is installed too; its tool build/ugreen-led-i2c is the CI artifact "ugreen-led-i2c".
LED_TOOL_NOTE=""
if [ ! -f "$ROOT/build/ugreen-led-i2c" ]; then
    LED_TOOL_NOTE="build/ugreen-led-i2c missing: the LED part cannot be switched on in this build."
fi

# The running daemon belongs to the old files; stopping it restores the BIOS fan values.
if [ -x "$DEST/backend/ugreen-nas-ctl" ]; then
    "$DEST/backend/ugreen-nas-ctl" led-stop >/dev/null 2>&1 || true
    "$DEST/backend/ugreen-nas-ctl" stop >/dev/null 2>&1 || true
fi

rm -rf "$DEST"
mkdir -p "$DEST/backend" "$DEST/css" "$DEST/js" "$DEST/include" "$DEST/images" "$DEST/icons"

cp "$ROOT/src/backend/ugreen-nas-ctl" "$DEST/backend/"
cp "$ROOT/build/ugreen-nas-fan" "$DEST/backend/"
cp "$ROOT/src/web/api.php" "$ROOT/src/web/UGREENNASControl.page" "$ROOT/src/web/UGREENNASDashboard.page" "$DEST/"
cp "$ROOT/src/web/css/app.css" "$ROOT/src/web/css/led-embed.css" "$DEST/css/"
cp "$ROOT/src/web/js/app.js" "$ROOT/src/web/js/i18n.js" "$ROOT/src/web/js/dash.js" "$ROOT/src/web/js/ledfx.js" "$DEST/js/"
cp "$ROOT/src/web/include/lang.php" "$DEST/include/"
cp "$ROOT/src/web/images/ugreen-nas-control.png" "$DEST/images/"
cp "$ROOT/src/web/icons/ugreen-nas-control.png" "$DEST/icons/"
cp "$ROOT/src/README.md" "$DEST/"


LED="$ROOT/led/src"
mkdir -p "$DEST/led/backend" "$DEST/led/css" "$DEST/led/js" "$DEST/led/include" "$DEST/led/images" "$DEST/event"
cp "$LED/backend/ugreen-led-ctl" "$DEST/led/backend/"
[ -f "$ROOT/build/ugreen-led-i2c" ] && cp "$ROOT/build/ugreen-led-i2c" "$DEST/led/backend/"
cp "$LED/web/api.php" "$DEST/led/"
cp "$LED/web/css/app.css" "$DEST/led/css/"
cp "$LED/web/js/app.js" "$LED/web/js/i18n.js" "$DEST/led/js/"
cp "$LED/web/include/lang.php" "$LED/web/include/views.php" "$DEST/led/include/"
cp "$LED/web/images/ugreen-led-control.png" "$DEST/led/images/"
cp "$LED/event/stopping" "$DEST/event/"

chmod 755 "$DEST/backend/ugreen-nas-ctl" "$DEST/backend/ugreen-nas-fan" "$DEST/led/backend/ugreen-led-ctl" "$DEST/event/stopping"
[ -f "$DEST/led/backend/ugreen-led-i2c" ] && chmod 755 "$DEST/led/backend/ugreen-led-i2c"
find "$DEST" -type f ! -path "$DEST/backend/*" ! -path "$DEST/led/backend/*" ! -path "$DEST/event/*" -exec chmod 644 {} +

# The copy replaced the .page files, and with them a favorite's Menu label.
if [ -x /usr/local/emhttp/webGui/scripts/restore_favorites ]; then
    /usr/local/emhttp/webGui/scripts/restore_favorites
fi

"$DEST/backend/ugreen-nas-fan" probe
"$DEST/backend/ugreen-nas-ctl" start

echo
"$DEST/backend/ugreen-nas-ctl" led-boot || true
[ -z "$LED_TOOL_NOTE" ] || echo "$LED_TOOL_NOTE"

echo "Installation complete."
