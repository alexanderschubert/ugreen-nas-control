<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

const PLUGIN_DIR = '/usr/local/emhttp/plugins/ugreen-nas-control';
const FAN_TOOL = PLUGIN_DIR . '/backend/ugreen-nas-fan';
const CTL = PLUGIN_DIR . '/backend/ugreen-nas-ctl';

// Saved settings, read by the fan daemon every 2 seconds.
const CONFIG_FILE = '/boot/config/plugins/ugreen-nas-control/fan.cfg';

const MODES = ['bios', 'quiet', 'standard', 'performance', 'full', 'custom'];

function respond(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

function run(string $tool, array $args): array
{
    $output = [];
    $returnCode = 0;

    exec(escapeshellarg($tool) . ' ' . implode(' ', array_map('escapeshellarg', $args)) . ' 2>&1', $output, $returnCode);

    return [
        'code' => $returnCode,
        'output' => implode("\n", $output)
    ];
}

function read_settings(): array
{
    // Values are always quoted, so parse_ini_file keeps "0" as it is.
    return is_file(CONFIG_FILE) ? (parse_ini_file(CONFIG_FILE) ?: []) : [];
}

function save_settings(array $changes): bool
{
    $config = array_merge(read_settings(), array_map('strval', $changes));

    ksort($config);

    $content = '';
    foreach ($config as $key => $value) {
        $content .= "{$key}=\"{$value}\"\n";
    }

    if (!is_dir(dirname(CONFIG_FILE))) {
        @mkdir(dirname(CONFIG_FILE), 0777, true);
    }

    $tmp = CONFIG_FILE . '.tmp';

    return file_put_contents($tmp, $content) !== false && rename($tmp, CONFIG_FILE);
}

// "40:30,60:50,..." with 2-8 points, temperatures 0-120 °C rising, speeds 0-100 %.
function valid_curve(string $curve): bool
{
    $points = explode(',', $curve);

    if (count($points) < 2 || count($points) > 8) {
        return false;
    }

    $last = -1;
    foreach ($points as $point) {
        if (!preg_match('/^(\d{1,3}):(\d{1,3})$/', $point, $m)) {
            return false;
        }
        [$temp, $pct] = [(int)$m[1], (int)$m[2]];
        if ($temp > 120 || $pct > 100 || $temp <= $last) {
            return false;
        }
        $last = $temp;
    }

    return true;
}

if (!is_executable(FAN_TOOL) || !is_executable(CTL)) {
    respond([
        'ok' => false,
        'error' => 'UGREEN NAS Control backend not installed'
    ], 500);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $action = $_GET['action'] ?? 'status';

    if ($action !== 'status') {
        respond([
            'ok' => false,
            'error' => 'Unknown action'
        ], 400);
    }

    $result = run(FAN_TOOL, ['status']);
    $data = json_decode($result['output'], true);

    if (!is_array($data)) {
        respond([
            'ok' => false,
            'error' => $result['output']
        ], 500);
    }

    $config = read_settings();

    $data['running'] = run(CTL, ['status'])['code'] === 0;
    $data['settings'] = [
        'mode' => in_array($config['mode'] ?? '', MODES, true) ? $config['mode'] : 'standard',
        'cpu_curve' => $config['cpu_curve'] ?? '',
        'case_curve' => $config['case_curve'] ?? '',
        'min_pct' => (int)($config['min_pct'] ?? 25),
        'cpu_crit' => (int)($config['cpu_crit'] ?? 90),
        'disk_crit' => (int)($config['disk_crit'] ?? 55),
        'nvme_offset' => (int)($config['nvme_offset'] ?? 15),
        'stall_notify' => ($config['stall_notify'] ?? '1') !== '0',
        'ui_lang' => $config['ui_lang'] ?? 'auto'
    ];

    respond($data);
}

if ($method !== 'POST') {
    respond([
        'ok' => false,
        'error' => 'Method not allowed'
    ], 405);
}

// Unraid's local_prepend.php has already rejected POSTs without a valid csrf_token.
$input = $_POST;
$action = $input['action'] ?? '';

if ($action === 'mode') {
    $mode = (string)($input['value'] ?? '');

    if (!in_array($mode, MODES, true)) {
        respond([
            'ok' => false,
            'error' => 'Invalid mode'
        ], 400);
    }

    if (!save_settings(['mode' => $mode])) {
        respond([
            'ok' => false,
            'error' => CONFIG_FILE . ' is not writable'
        ], 500);
    }

    // The daemon also runs in "bios" mode, where it only hands the fans back and watches.
    $result = run(CTL, ['start']);

    if ($result['code'] !== 0) {
        respond([
            'ok' => false,
            'error' => $result['output']
        ], 500);
    }

    respond(['ok' => true]);
}

if ($action === 'curves') {
    $cpu = (string)($input['cpu_curve'] ?? '');
    $case = (string)($input['case_curve'] ?? '');

    if (!valid_curve($cpu) || !valid_curve($case)) {
        respond([
            'ok' => false,
            'error' => 'Invalid fan curve'
        ], 400);
    }

    // Saving a curve switches to it.
    if (!save_settings(['cpu_curve' => $cpu, 'case_curve' => $case, 'mode' => 'custom'])) {
        respond([
            'ok' => false,
            'error' => CONFIG_FILE . ' is not writable'
        ], 500);
    }

    run(CTL, ['start']);
    respond(['ok' => true]);
}

if ($action === 'safety') {
    $limits = [
        'min_pct' => [10, 60],
        'cpu_crit' => [70, 105],
        'disk_crit' => [40, 70],
        'nvme_offset' => [0, 40]
    ];
    $changes = [];

    foreach ($limits as $key => [$min, $max]) {
        $value = filter_var($input[$key] ?? null, FILTER_VALIDATE_INT);

        if ($value === false || $value < $min || $value > $max) {
            respond([
                'ok' => false,
                'error' => "Invalid value for {$key}"
            ], 400);
        }

        $changes[$key] = $value;
    }

    $changes['stall_notify'] = ($input['stall_notify'] ?? '') === '1' ? '1' : '0';

    if (!save_settings($changes)) {
        respond([
            'ok' => false,
            'error' => CONFIG_FILE . ' is not writable'
        ], 500);
    }

    respond(['ok' => true]);
}

if ($action === 'lang') {
    $lang = (string)($input['value'] ?? '');

    if (!in_array($lang, ['auto', 'de', 'en'], true)) {
        respond([
            'ok' => false,
            'error' => 'Invalid language'
        ], 400);
    }

    if (!save_settings(['ui_lang' => $lang])) {
        respond([
            'ok' => false,
            'error' => CONFIG_FILE . ' is not writable'
        ], 500);
    }

    respond(['ok' => true]);
}

respond([
    'ok' => false,
    'error' => 'Unknown action'
], 400);
