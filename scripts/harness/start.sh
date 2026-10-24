#!/bin/bash
# Fake Unraid around the real LED backend and api.php.
set -e
P=/usr/local/emhttp/plugins/ugreen-nas-control
cp /h/fake-led-i2c $P/led/backend/ugreen-led-i2c
chmod +x $P/led/backend/ugreen-led-i2c $P/led/backend/ugreen-led-ctl
mkdir -p /boot/config/plugins/ugreen-nas-control /var/local/emhttp/smart /var/run
touch /boot/config/plugins/ugreen-nas-control/led.enabled
cat > /var/local/emhttp/var.ini <<'INI'
csrf_token="fake"
mdState="STARTED"
INI
cat > /var/local/emhttp/disks.ini <<'INI'
["disk1"]
name="disk1"
device="sda"
status="DISK_OK"
temp="36"
spundown="0"
["parity"]
name="parity"
device="sdb"
status="DISK_OK"
temp="*"
spundown="1"
["cache"]
name="cache"
device="nvme0n1"
status="DISK_OK"
temp="44"
INI
exec php -S 0.0.0.0:8780 -t /usr/local/emhttp
