#!/bin/bash
#
# A fake Unraid in Docker around the real plugin files: the real LED backend (ugreen-led-ctl) and
# api.php run against a stand-in for the LED chip (fake-led-i2c keeps the registers in files),
# the NAS Control page is rendered by view.php, its API is a fixed mock (DXP6800 Pro).
# No hardware is touched.
#
#   scripts/harness/run.sh          start (or restart) the container
#   scripts/harness/run.sh sync     copy the repo files again after an edit
#   scripts/harness/run.sh stop
#
# Then open http://localhost:8780/plugins/ugreen-nas-control/view.php
# Light theme: docker exec ugreen-fake sh -c 'echo ui_theme=\"light\" > /boot/config/plugins/ugreen-nas-control/fan.cfg'
#
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
WORK="${HARNESS_DIR:-${TMPDIR:-/tmp}/ugreen-harness}"
PLUGIN="$WORK/plugin"
NAME=ugreen-fake

sync_files() {
    mkdir -p "$PLUGIN/led/backend"
    cp -R "$ROOT"/led/src/web/. "$PLUGIN/led/"
    cp -R "$ROOT"/led/src/backend/. "$PLUGIN/led/backend/"
    cp "$HERE/fake-led-i2c" "$PLUGIN/led/backend/ugreen-led-i2c"
    for d in css js images icons include; do
        mkdir -p "$PLUGIN/$d"
        cp -R "$ROOT/src/web/$d/." "$PLUGIN/$d/"
    done
    cp "$ROOT"/src/web/*.page "$PLUGIN/"
    cp "$HERE/nas-api-mock.php" "$PLUGIN/api.php"
    cp "$HERE/view.php" "$PLUGIN/view.php"
}

case "${1:-start}" in
    sync) sync_files ;;
    stop) docker rm -f "$NAME" >/dev/null 2>&1 || true ;;
    start)
        mkdir -p "$WORK"
        sync_files
        docker rm -f "$NAME" >/dev/null 2>&1 || true
        docker run -d --name "$NAME" -p 127.0.0.1:8780:8780 \
            -v "$PLUGIN:/usr/local/emhttp/plugins/ugreen-nas-control" \
            -v "$HERE:/h" php:8.3-cli bash /h/start.sh >/dev/null
        echo "http://localhost:8780/plugins/ugreen-nas-control/view.php"
        ;;
    *) echo "usage: run.sh [start|sync|stop]" >&2; exit 2 ;;
esac
