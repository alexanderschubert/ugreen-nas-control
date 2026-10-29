#!/bin/bash
# Installs the working copy on the NAS, without a release.
# Needs build/ugreen-nas-fan: the CI artifact of the "Fan tool" workflow or a release binary.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="/usr/local/emhttp/plugins/ugreen-nas-control"

if [ ! -d /usr/local/emhttp/plugins ]; then
    echo "/usr/local/emhttp/plugins missing – run this on the Unraid NAS." >&2
    exit 1
fi

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

# Copy into a staging dir first; the old install is only replaced once every copy worked.
STAGE="$DEST.new"
rm -rf "$STAGE"
mkdir -p "$STAGE/backend" "$STAGE/css" "$STAGE/js" "$STAGE/include" "$STAGE/images" "$STAGE/icons"

cp "$ROOT/src/backend/ugreen-nas-ctl" "$STAGE/backend/"
cp "$ROOT/build/ugreen-nas-fan" "$STAGE/backend/"
cp "$ROOT/src/web/api.php" "$ROOT/src/web/UGREENNASControl.page" "$ROOT/src/web/UGREENNASDashboard.page" "$STAGE/"
cp "$ROOT/src/web/css/app.css" "$ROOT/src/web/css/led-embed.css" "$STAGE/css/"
cp "$ROOT/src/web/js/app.js" "$ROOT/src/web/js/i18n.js" "$ROOT/src/web/js/dash.js" "$ROOT/src/web/js/ledfx.js" "$STAGE/js/"
cp "$ROOT/src/web/include/lang.php" "$STAGE/include/"
cp "$ROOT/src/web/images/ugreen-nas-control.png" "$STAGE/images/"
cp "$ROOT/src/web/icons/ugreen-nas-control.png" "$STAGE/icons/"
cp "$ROOT/src/README.md" "$STAGE/"


LED="$ROOT/led/src"
mkdir -p "$STAGE/led/backend" "$STAGE/led/css" "$STAGE/led/js" "$STAGE/led/include" "$STAGE/led/images" "$STAGE/event"
cp "$LED/backend/ugreen-led-ctl" "$STAGE/led/backend/"
[ -f "$ROOT/build/ugreen-led-i2c" ] && cp "$ROOT/build/ugreen-led-i2c" "$STAGE/led/backend/"
cp "$LED/web/api.php" "$STAGE/led/"
cp "$LED/web/css/app.css" "$STAGE/led/css/"
cp "$LED/web/js/app.js" "$LED/web/js/i18n.js" "$STAGE/led/js/"
cp "$LED/web/include/views.php" "$STAGE/led/include/"
cp "$LED/web/images/ugreen-led-control.png" "$STAGE/led/images/"
cp "$LED/event/stopping" "$STAGE/event/"

chmod 755 "$STAGE/backend/ugreen-nas-ctl" "$STAGE/backend/ugreen-nas-fan" "$STAGE/led/backend/ugreen-led-ctl" "$STAGE/event/stopping"
[ -f "$STAGE/led/backend/ugreen-led-i2c" ] && chmod 755 "$STAGE/led/backend/ugreen-led-i2c"
find "$STAGE" -type f ! -path "$STAGE/backend/*" ! -path "$STAGE/led/backend/*" ! -path "$STAGE/event/*" -exec chmod 644 {} +

rm -rf "$DEST"
mv "$STAGE" "$DEST"

# The copy replaced the .page files, and with them a favorite's Menu label.
if [ -x /usr/local/emhttp/webGui/scripts/restore_favorites ]; then
    /usr/local/emhttp/webGui/scripts/restore_favorites
fi

# Like the .plg: without a supported fan controller, only system info and temperatures work.
if "$DEST/backend/ugreen-nas-fan" probe; then
    "$DEST/backend/ugreen-nas-ctl" start
else
    echo "WARNING: No supported fan controller found; fan control not started." >&2
fi

echo
"$DEST/backend/ugreen-nas-ctl" led-boot || true
[ -z "$LED_TOOL_NOTE" ] || echo "$LED_TOOL_NOTE"

echo "Installation complete."
