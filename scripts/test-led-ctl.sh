#!/bin/bash
#
# Checks the switch and the conflict rules of the LED part of ugreen-nas-ctl against
# a fake system: no hardware, no /boot. Run: scripts/test-led-ctl.sh
#
set -u

CTL="$(cd "$(dirname "$0")/.." && pwd)/src/backend/ugreen-nas-ctl"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
fails=0

mkdir -p "$T/dmi" "$T/boot" "$T/web" "$T/led"
echo "DXP6800 Pro" > "$T/dmi/product_name"
: > "$T/modules"

# Stand-ins for the LED tools: they only note what they were asked to do.
cat > "$T/led/ugreen-led-ctl" <<STUB
#!/bin/bash
echo "ctl \$*" >> "$T/calls"
STUB
cat > "$T/led/ugreen-led-i2c" <<STUB
#!/bin/bash
echo "i2c \$*" >> "$T/calls"
STUB
cat > "$T/update_cron" <<STUB
#!/bin/bash
echo "update_cron" >> "$T/calls"
STUB
chmod +x "$T"/led/* "$T/update_cron"

run() {
    UGREEN_DMI="$T/dmi" UGREEN_PLUGINS_BOOT="$T/boot" UGREEN_PLUGINS_WEB="$T/web" \
    UGREEN_PROC_MODULES="$T/modules" UGREEN_LED_DIR="$T/led" UGREEN_LED_FLAG="$T/boot/led.enabled" \
    UGREEN_LED_IMPORT_SRC="$T/old/leds.cfg" UGREEN_LED_CRON="$T/boot/x.cron" UGREEN_LED_CFG="$T/boot/leds.cfg" UGREEN_UPDATE_CRON="$T/update_cron" \
    UGREEN_LED_LEGACY_PIDS="$T/legacy.pid" \
    UGREEN_NAS_FAN=/bin/true bash "$CTL" "$@"
}

check() { # name, condition result
    if [ "$2" = ok ]; then echo "ok   $1"; else echo "FAIL $1"; fails=$((fails + 1)); fi
}

blocker() { run led-status | sed -n 's/.*"blocker": "\([^"]*\)".*/\1/p'; }

check "no blocker on a DXP6800 Pro" "$([ -z "$(blocker)" ] && echo ok)"

echo "PRIME Z790-P" > "$T/dmi/product_name"
check "a board that is not a UGREEN is blocked" "$([ "$(blocker)" = model ] && echo ok)"
run led-enable >/dev/null 2>&1
check "a board that is not a UGREEN cannot be enabled" "$([ ! -e "$T/boot/led.enabled" ] && [ ! -e "$T/calls" ] && echo ok)"

echo "DXP4800 GT" > "$T/dmi/product_name"
check "no blocker on a DXP4800 GT" "$([ -z "$(blocker)" ] && echo ok)"
echo "DXP6800 Pro" > "$T/dmi/product_name"

warning() { run led-status | sed -n 's/.*"warning": "\([^"]*\)".*/\1/p'; }

check "no warning without the standalone plugin" "$([ -z "$(warning)" ] && echo ok)"
touch "$T/boot/ugreen-led-control.plg"
check "standalone plugin is a warning" "$([ "$(warning)" = standalone ] && echo ok)"
check "standalone plugin is no blocker" "$([ -z "$(blocker)" ] && echo ok)"
run led-enable >/dev/null 2>&1
check "standalone plugin: still enabled" "$([ -e "$T/boot/led.enabled" ] && echo ok)"
run led-disable >/dev/null 2>&1
rm "$T/boot/ugreen-led-control.plg" "$T/calls"

mkdir "$T/web/ugreenleds-driver"
check "driver plugin blocks" "$([ "$(blocker)" = driver ] && echo ok)"
rmdir "$T/web/ugreenleds-driver"

echo "led_ugreen 16384 0 - Live 0x0" > "$T/modules"
check "kernel module blocks" "$([ "$(blocker)" = module ] && echo ok)"
: > "$T/modules"

run led-boot >/dev/null 2>&1
check "switched off: boot does nothing" "$([ ! -e "$T/calls" ] && echo ok)"

run led-enable >/dev/null 2>&1
check "enable creates the flag" "$([ -e "$T/boot/led.enabled" ] && echo ok)"
check "enable applies the settings" "$(grep -q '^ctl apply' "$T/calls" && echo ok)"
check "enable writes the night mode cron" "$(grep -q 'schedule' "$T/boot/x.cron" && echo ok)"

touch "$T/boot/ugreenleds-driver.plg"
: > "$T/calls"
run led-boot >/dev/null 2>&1
check "conflict after enabling: boot starts nothing" "$([ ! -s "$T/calls" ] && echo ok)"
rm "$T/boot/ugreenleds-driver.plg"

run led-disable >/dev/null 2>&1
check "disable removes flag and cron" "$([ ! -e "$T/boot/led.enabled" ] && [ ! -e "$T/boot/x.cron" ] && echo ok)"
check "disable stops daemon and effect" "$(grep -q '^ctl daemon stop' "$T/calls" && grep -q '^ctl fx stop' "$T/calls" && echo ok)"

# led-stop leaves a foreign process (the standalone plugin's daemon) alone, but ends a
# leftover daemon of this plugin's own led/ directory that still uses the old shared pidfile.
# Needs /proc to read command lines.
if [ -d /proc/self ]; then
    printf '#!/bin/bash\nsleep 30\ntrue\n' > "$T/led/fake-daemon"
    chmod +x "$T/led/fake-daemon"

    sleep 30 & foreign=$!
    echo "$foreign" > "$T/legacy.pid"
    run led-stop >/dev/null 2>&1
    check "led-stop keeps a foreign daemon" "$(kill -0 "$foreign" 2>/dev/null && [ -e "$T/legacy.pid" ] && echo ok)"
    kill "$foreign"; wait "$foreign" 2>/dev/null

    "$T/led/fake-daemon" & own=$!
    sleep 0.3
    echo "$own" > "$T/legacy.pid"
    run led-stop >/dev/null 2>&1
    wait "$own" 2>/dev/null; rc=$?
    check "led-stop ends a leftover daemon of its own directory" "$([ "$rc" -eq 143 ] && [ ! -e "$T/legacy.pid" ] && echo ok)"
fi

# Every UGREEN model UGREEN LED Control knew is allowed; confirmed ones are not marked untested.
for model in "DXP4800 Plus" "DX4600 Pro" "DXP8800 Plus" "DXP4800 GT" "DXP480T Plus"; do
    echo "$model" > "$T/dmi/product_name"
    check "$model: LEDs offered, not untested" "$([ -z "$(blocker)" ] && [ "$(run led-status | sed -n 's/.*"untested": \([a-z]*\).*/\1/p')" = false ] && echo ok)"
done
echo "DXP9999 Future" > "$T/dmi/product_name"
check "an unknown DXP model is offered, marked untested" "$([ -z "$(blocker)" ] && [ "$(run led-status | sed -n 's/.*"untested": \([a-z]*\).*/\1/p')" = true ] && echo ok)"

# iDX6011 Pro: the LEDs are offered, marked untested; the DXP6800 Pro is not.
untested() { run led-status | sed -n 's/.*"untested": \([a-z]*\).*/\1/p'; }
echo "iDX6011 Pro" > "$T/dmi/product_name"
check "iDX6011 Pro is no blocked model" "$([ -z "$(blocker)" ] && echo ok)"
check "iDX6011 Pro is marked untested" "$([ "$(untested)" = true ] && echo ok)"
rm -f "$T/boot/led.enabled"
run led-enable >/dev/null 2>&1
check "iDX6011 Pro can be switched on" "$([ -e "$T/boot/led.enabled" ] && echo ok)"
run led-disable >/dev/null 2>&1
echo "DXP6800 Pro" > "$T/dmi/product_name"
check "DXP6800 Pro is not marked untested" "$([ "$(untested)" = false ] && echo ok)"
rm -f "$T/boot/led.enabled" "$T/calls"

# Take over the settings of an installed UGREEN LED Control.
mkdir -p "$T/old"
import_flag() { run led-status | sed -n 's/.*"import_available": \([a-z]*\).*/\1/p'; }
rm -f "$T/boot/leds.cfg" "$T/boot/leds.cfg.bak" "$T/boot/led.enabled" "$T/calls"

check "no import without the old settings" "$([ "$(import_flag)" = false ] && echo ok)"
printf 'brightness="128"\nmode="status"\n' > "$T/old/leds.cfg"
check "import offered with the old settings" "$([ "$(import_flag)" = true ] && echo ok)"

run led-enable >/dev/null 2>&1
check "first enable takes the old settings over" "$(cmp -s "$T/old/leds.cfg" "$T/boot/leds.cfg" && echo ok)"
check "no import left to offer afterwards" "$([ "$(import_flag)" = false ] && echo ok)"

printf 'brightness="10"\n' > "$T/boot/leds.cfg"
check "changed settings are offered again" "$([ "$(import_flag)" = true ] && echo ok)"
run led-import >/dev/null 2>&1
check "import replaces the settings" "$(cmp -s "$T/old/leds.cfg" "$T/boot/leds.cfg" && echo ok)"
check "import keeps a backup of the settings it replaced" "$(grep -q 'brightness="10"' "$T/boot/leds.cfg.bak" && echo ok)"
check "import applies them while running" "$(grep -q '^ctl apply' "$T/calls" && echo ok)"
rm "$T/old/leds.cfg"
before="$(cat "$T/boot/leds.cfg")"
run led-import >/dev/null 2>&1; rc=$?
check "import without the old settings fails and changes nothing" "$([ "$rc" -ne 0 ] && [ "$(cat "$T/boot/leds.cfg")" = "$before" ] && echo ok)"

echo
[ "$fails" -eq 0 ] && echo "All checks passed." || { echo "$fails failed."; exit 1; }
