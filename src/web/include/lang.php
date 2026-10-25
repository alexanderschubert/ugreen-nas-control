<?php
// Interface language of the settings page and the dashboard tile: the saved
// choice (ui_lang in fan.cfg), or Unraid's own language for "auto".
function unc_language(): array
{
    $settings = is_file('/boot/config/plugins/ugreen-nas-control/fan.cfg')
        ? (parse_ini_file('/boot/config/plugins/ugreen-nas-control/fan.cfg') ?: [])
        : [];
    $dynamix = is_file('/boot/config/plugins/dynamix/dynamix.cfg')
        ? (parse_ini_file('/boot/config/plugins/dynamix/dynamix.cfg', true) ?: [])
        : [];

    $locale = (string)($dynamix['display']['locale'] ?? '');
    $unraid = str_starts_with($locale, 'de') ? 'de' : (str_starts_with($locale, 'es') ? 'es' : 'en');
    $setting = in_array($settings['ui_lang'] ?? '', ['de', 'en', 'es'], true) ? $settings['ui_lang'] : 'auto';

    return [$setting === 'auto' ? $unraid : $setting, $setting];
}

// Colour theme of the settings page and the dashboard tile: "dark" (default),
// "light", or "auto" (decided in the browser from the page's own background).
function unc_theme(): string
{
    $settings = is_file('/boot/config/plugins/ugreen-nas-control/fan.cfg')
        ? (parse_ini_file('/boot/config/plugins/ugreen-nas-control/fan.cfg') ?: [])
        : [];

    return in_array($settings['ui_theme'] ?? '', ['light', 'auto'], true) ? $settings['ui_theme'] : 'dark';
}
