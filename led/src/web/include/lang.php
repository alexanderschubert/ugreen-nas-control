<?php
// Dashboard tile: "compact" (default: the LEDs, with a state only for problems)
// or "full" (case picture with every bay's temperature or state).
function ulc_dash_size(): string
{
    $settings = is_file('/boot/config/plugins/ugreen-nas-control/leds.cfg')
        ? (parse_ini_file('/boot/config/plugins/ugreen-nas-control/leds.cfg') ?: [])
        : [];

    return ($settings['ui_dash'] ?? '') === 'full' ? 'full' : 'compact';
}
