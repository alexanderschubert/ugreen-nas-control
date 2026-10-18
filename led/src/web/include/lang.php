<?php
// Interface language of the settings page and the dashboard tile: the saved
// choice (ui_lang in leds.cfg), or Unraid's own language for "auto".
function ulc_language(): array
{
    $settings = is_file('/boot/config/plugins/ugreen-nas-control/leds.cfg')
        ? (parse_ini_file('/boot/config/plugins/ugreen-nas-control/leds.cfg') ?: [])
        : [];
    $dynamix = is_file('/boot/config/plugins/dynamix/dynamix.cfg')
        ? (parse_ini_file('/boot/config/plugins/dynamix/dynamix.cfg', true) ?: [])
        : [];

    $locale = substr((string)($dynamix['display']['locale'] ?? ''), 0, 2);
    $unraid = in_array($locale, ['de', 'es'], true) ? $locale : 'en';
    $setting = in_array($settings['ui_lang'] ?? '', ['de', 'en', 'es'], true) ? $settings['ui_lang'] : 'auto';

    return [$setting === 'auto' ? $unraid : $setting, $setting];
}

// Dashboard tile: "compact" (default: the LEDs, with a state only for problems)
// or "full" (case picture with every bay's temperature or state).
function ulc_dash_size(): string
{
    $settings = is_file('/boot/config/plugins/ugreen-nas-control/leds.cfg')
        ? (parse_ini_file('/boot/config/plugins/ugreen-nas-control/leds.cfg') ?: [])
        : [];

    return ($settings['ui_dash'] ?? '') === 'full' ? 'full' : 'compact';
}

// Colour theme of the settings page and the dashboard tile: "dark" (default),
// "light", or "auto" (decided in the browser from the page's own background).
function ulc_theme(): string
{
    $settings = is_file('/boot/config/plugins/ugreen-nas-control/leds.cfg')
        ? (parse_ini_file('/boot/config/plugins/ugreen-nas-control/leds.cfg') ?: [])
        : [];

    return in_array($settings['ui_theme'] ?? '', ['light', 'auto'], true) ? $settings['ui_theme'] : 'dark';
}
