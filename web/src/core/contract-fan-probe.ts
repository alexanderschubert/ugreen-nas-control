/*
 * The probe, backlight and capability answers of the fan tool (web/plugin/include/fan_probe.php, fan_backlight.php;
 * backend/internal/fan/probe_cmd.go, probe.go, caps.go, ec_watchdog.go).
 *
 * Probe: only on models with fan_caps.kind === 'probe' (IT8613E boards whose header wiring is unknown). Without a
 * confirmed map the daemon never starts and the status has no fans: fan control stays off until fan_probe_confirm.
 * Only outputs with status 'mapped' can be confirmed; roles are 'cpu' or 'case'. A refused start (another fan tool
 * running, fan control off) is HTTP 409 with the reason.
 */
import type { ApiOk } from './contract';

/** `fan_caps` of the status: what the page may offer; absent for a model without fan control. */
export interface FanCaps {
    kind: 'fixed' | 'probe';
    /** Fans the plugin drives; 0 on a probe model until a map is confirmed. */
    channels: number;
    /** The EC watchdog petter runs here (DXP4800 GT and iDX6011 Pro only); see Watchdog. */
    watchdog: boolean;
    /** The LCD backlight can be read and set (iDX Pro). */
    backlight: boolean;
}

/**
 * `watchdog` of the status: null when nothing was sampled (no petter on this model, or nothing ticked since boot).
 * The plugin never arms the watchdog, it only feeds one the BIOS armed.
 */
export interface Watchdog {
    armed: boolean;
    /** Seconds until the EC resets the box without a feed. */
    timeout: number;
    interval: number;
    /** Unix time of the last feed, 0 = never. */
    last_pet: number;
    time: number;
    /** off: not armed; armed: fed in time; action_needed: armed, but not fed for more than twice the interval. */
    state: 'off' | 'armed' | 'action_needed';
}

export interface ProbeOutput {
    pwm: string;
    status: 'mapped' | 'no_fan' | 'ambiguous';
    /** Tach input that followed the output (mapped). */
    tach?: string;
    candidates?: string[];
    base_rpm: number;
    peak_rpm: number;
}

export interface ProbeProposal {
    version: 1;
    model: string;
    chip: string;
    /** Unix time; a result older than the backend's limit is dropped. */
    time: number;
    outputs: ProbeOutput[];
    /** What community reports say, never trusted: the outputs that should move a fan. */
    expected?: { pwms?: string[]; tachs?: string[] };
    agrees?: boolean;
}

export interface FanMapOutput {
    id: string;
    role: 'cpu' | 'case';
    pwm: string;
    tach: string;
}

export interface FanMap {
    version: 1;
    model: string;
    chip: string;
    time: number;
    outputs: FanMapOutput[];
}

export interface ProbeProgress {
    state: 'running' | 'done' | 'aborted';
    pwm?: string;
    step: number;
    steps: number;
    reason?: string;
    time: number;
}

/** GET fan_probe_status. */
export type FanProbeStatusResponse = ApiOk & {
    model: string;
    /** fixed, probe or '' (no fan control). */
    kind: 'fixed' | 'probe' | '';
    /** The confirmed map, null until confirmed. */
    map: FanMap | null;
    /** A map file exists but does not fit this NAS. */
    map_error?: string;
    /** Last complete run, waiting for fan_probe_confirm. */
    proposal: ProbeProposal | null;
    progress: ProbeProgress | null;
    /** false until a map is confirmed (probe models). */
    fan_control_possible: boolean;
};

/** GET fan_probe_tachs: read-only rpm of every tach input. */
export type FanProbeTachsResponse = ApiOk & { tachs: { id: string; rpm: number }[] };

/** POST fan_probe_confirm with map[pwmN]=cpu|case. */
export type FanProbeConfirmResponse = ApiOk & { map: FanMap };

/** GET fan_backlight: brightness in percent (100 = full, 0 = off) and the raw register. */
export type FanBacklightResponse = ApiOk & { pct: number; raw: number };

/** POST fan_backlight pct=0..100 */
export type FanBacklightSetResponse = ApiOk & { pct: number };
