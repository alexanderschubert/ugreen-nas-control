<?php

declare(strict_types=1);

// The fan probe for models whose header wiring is not known (api.php actions fan_probe_*). The work is the fan tool's
// (`probe-fans status|run|confirm|forget|tachs`: backend/internal/fan/probe_cmd.go); this checks the request and relays
// the answer. Uses respond(), run() and run_detached() from api.php.

// What the tool printed on stderr as "ERROR: text", without the prefix.
function fan_tool_error(string $output): string
{
    $text = trim((string) preg_replace('/^ERROR:\s*/m', '', $output));

    return $text !== '' ? $text : 'The fan tool failed';
}

// The tool's JSON answer, or a failure response (409: the tool refused, 500: it did not answer).
function fan_tool_json(array $args): array
{
    $result = run(FAN_TOOL, $args);
    $data = json_decode($result['output'], true);

    if (is_array($data) && ($data['ok'] ?? false) === true) {
        return $data;
    }
    if ($result['code'] !== 0 && !is_array($data)) {
        respond(['ok' => false, 'error' => fan_tool_error($result['message'])], 409);
    }

    respond(['ok' => false, 'error' => is_array($data) ? (string) ($data['error'] ?? 'Unknown error') : $result['message']], 500);
}

function fan_probe_status(): never
{
    respond(fan_tool_json(['probe-fans', 'status']));
}

function fan_probe_tachs(): never
{
    respond(fan_tool_json(['probe-fans', 'tachs']));
}

// POST fan_probe_run: the probe spins each output in turn (minutes) and runs in the background; its progress comes with
// fan_probe_status. A refused start (another fan tool runs, fan control off, wrong model) is a 409.
function fan_probe_run(): never
{
    run_detached(['probe-fans', 'run'], 'The probe did not start');
    respond(['ok' => true]);
}

// map[pwmN]=cpu|case -> ['pwmN=cpu', ...]; null when empty, a key is not pwm1..pwm9 or a role is neither cpu nor case.
function fan_probe_choice(mixed $map): ?array
{
    if (!is_array($map) || $map === [] || count($map) > 9) {
        return null;
    }

    $args = [];
    foreach ($map as $pwm => $role) {
        if (!is_string($pwm) || preg_match('/^pwm[1-9]$/D', $pwm) !== 1 || !in_array($role, ['cpu', 'case'], true)) {
            return null;
        }
        $args[] = $pwm . '=' . $role;
    }

    return $args;
}

// POST fan_probe_confirm map[pwmN]=cpu|case: make the last probe result the fan map (outputs without a single fan are refused).
function fan_probe_confirm(array $input): never
{
    $choice = fan_probe_choice($input['map'] ?? null);

    if ($choice === null) {
        respond(['ok' => false, 'error' => 'Invalid map'], 400);
    }

    respond(fan_tool_json(array_merge(['probe-fans', 'confirm'], $choice)));
}

// POST fan_probe_forget: delete the fan map; fan control is off again on this model until a new result is confirmed.
function fan_probe_forget(): never
{
    $result = run(FAN_TOOL, ['probe-fans', 'forget']);

    if ($result['code'] !== 0) {
        respond(['ok' => false, 'error' => fan_tool_error($result['message'])], 409);
    }

    respond(['ok' => true]);
}
