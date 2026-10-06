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

    $unraid = str_starts_with((string)($dynamix['display']['locale'] ?? ''), 'de') ? 'de' : 'en';
    $setting = in_array($settings['ui_lang'] ?? '', ['de', 'en'], true) ? $settings['ui_lang'] : 'auto';

    return [$setting === 'auto' ? $unraid : $setting, $setting];
}
