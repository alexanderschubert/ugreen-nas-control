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
    UGREEN_LED_CRON="$T/boot/x.cron" UGREEN_LED_CFG="$T/boot/leds.cfg" UGREEN_UPDATE_CRON="$T/update_cron" \
    UGREEN_NAS_FAN=/bin/true bash "$CTL" "$@"
}

check() { # name, condition result
    if [ "$2" = ok ]; then echo "ok   $1"; else echo "FAIL $1"; fails=$((fails + 1)); fi
}

blocker() { run led-status | sed -n 's/.*"blocker": "\([^"]*\)".*/\1/p'; }

check "no blocker on a DXP6800 Pro" "$([ -z "$(blocker)" ] && echo ok)"

echo "DXP4800 Plus" > "$T/dmi/product_name"
check "other model is blocked" "$([ "$(blocker)" = model ] && echo ok)"
run led-enable >/dev/null 2>&1
check "other model cannot be enabled" "$([ ! -e "$T/boot/led.enabled" ] && [ ! -e "$T/calls" ] && echo ok)"

echo "DXP4800 GT" > "$T/dmi/product_name"
check "no blocker on a DXP4800 GT" "$([ -z "$(blocker)" ] && echo ok)"
echo "DXP6800 Pro" > "$T/dmi/product_name"

touch "$T/boot/ugreen-led-control.plg"
check "standalone plugin blocks" "$([ "$(blocker)" = standalone ] && echo ok)"
run led-enable >/dev/null 2>&1
check "standalone plugin: not enabled" "$([ ! -e "$T/boot/led.enabled" ] && echo ok)"
rm "$T/boot/ugreen-led-control.plg"

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

touch "$T/boot/ugreen-led-control.plg"
: > "$T/calls"
run led-boot >/dev/null 2>&1
check "conflict after enabling: boot starts nothing" "$([ ! -s "$T/calls" ] && echo ok)"
rm "$T/boot/ugreen-led-control.plg"

run led-disable >/dev/null 2>&1
check "disable removes flag and cron" "$([ ! -e "$T/boot/led.enabled" ] && [ ! -e "$T/boot/x.cron" ] && echo ok)"
check "disable stops daemon and effect" "$(grep -q '^ctl daemon stop' "$T/calls" && grep -q '^ctl fx stop' "$T/calls" && echo ok)"

echo
[ "$fails" -eq 0 ] && echo "All checks passed." || { echo "$fails failed."; exit 1; }
