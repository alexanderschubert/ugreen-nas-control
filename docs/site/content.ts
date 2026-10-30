// Words of the site. Facts come from web/models/ and the README; keep claims to what the plugin does.
import { type Capability, type Model, offered } from '../../web/models/schema';
export { CAPABILITY_LABEL, EVIDENCE_HELP, EVIDENCE_LABEL, OVERALL_HELP, OVERALL_LABEL, checkText } from '../../web/models/schema';

export const REPO = process.env.GITHUB_REPOSITORY ?? 'alexanderschubert/ugreen-nas-control';
export const [OWNER = '', NAME = ''] = REPO.split('/');
export const SITE_URL = process.env.SITE_URL ?? `https://${OWNER.toLowerCase()}.github.io/${NAME}/`;
/** main is the released site at the root; next and site are previews in a subdirectory (noindex, banner, canonical to ROOT_URL). */
export const SITE_STREAM = process.env.SITE_STREAM ?? 'main';
export const PREVIEW = SITE_STREAM !== 'main';
export const ROOT_URL = process.env.ROOT_URL ?? `https://${OWNER.toLowerCase()}.github.io/${NAME}/`;
export const GITHUB = `https://github.com/${REPO}`;
export const PLG_URL = `https://raw.githubusercontent.com/${REPO}/main/plugin/ugreen-nas-control.plg`;
export const FORUM = 'https://forums.unraid.net/topic/201044-plugin-ugreen-nas-control-led-fan-and-system-control-for-ugreen-dxdxp-nas/';
/** Flip to true once the Community Applications entry is live: the Apps tab becomes the first install route. */
export const CA_LIVE = false;

/** Meta description and keywords: the one place besides the hero where the official line name appears for search. */
export const META_DESC =
    "The Unraid control plugin for UGREEN NAS (DX, DXP, iDX): fan curves, LEDs, case view, sensors, a dashboard tile and the hardware watchdog petted through the registers UGREEN's own drivers use (DXP4800 GT, iDX6011 Pro). No kernel module. The page runs the real plugin interface on sample data.";
export const KEYWORDS =
    'UGREEN NAS, Unraid plugin, DXP6800 Pro, DXP4800, DXP8800, DXP2800 GT, iDX6011, fan control, LED control, watchdog, case view, Community Applications';
export const HEADLINE = 'The Unraid control plugin for UGREEN NAS. Fans, LEDs, watchdog.';
export const SUBLINE =
    'Hardware facts come from the driver sources UGREEN publishes. Fan curves, LEDs, the watchdog and a live case view; models without confirmed wiring get a probe first. The box below is the real plugin: click it.';
/** Under the headline of the social preview image. */
export const SOCIAL_SUB = "No kernel module. Built on UGREEN's published driver sources.";

/** Strip under the hero: three short facts. */
export const STRIP = [
    ['Fans. LEDs. Watchdog.', 'One plugin, one settings page.'],
    ["From UGREEN's own sources.", 'Register facts read from the drivers UGREEN publishes.'],
    ['No kernel module.', 'No rebuild after Unraid updates.']
] as const;

/** Watchdog band. Scoped to what UGREEN's source and this repo show: pet-only, never arm. */
export const WATCHDOG = {
    title: 'Pets the hardware watchdog. Never arms it.',
    sub: "If the embedded-controller watchdog is running, the plugin feeds it through the same registers UGREEN's own driver uses (DXP4800 GT, iDX6011 Pro). If the system freezes, the feed stops and the hardware resets the box.",
    body: "UGREEN's driver arms the watchdog only when something opens /dev/watchdog. The plugin never does: it feeds a timer that is already running and clears the timer when it stops, so stopping or uninstalling never triggers a reset. Whether your BIOS arms it is not known; the card shows what the controller reports. That a feed alone reloads the counter is not yet confirmed on hardware.",
    steps: [
        ['shield', 'Something arms it', "UGREEN's driver, another tool or the firmware. The plugin only reads whether it is on."],
        ['refresh', 'The plugin feeds it', 'A small service rewrites the timeout on a steady beat while the system is alive.'],
        ['reset', 'A frozen box reboots itself', 'The beat stops, the timer runs out, the hardware resets the box.']
    ],
    other: "No feed for any other model. The DXP2800 GT has none yet: UGREEN's driver switches off a watchdog that is already running when it loads, so firmware can leave one on. The DXP2800, DXP4800, DXP6800 and DXP8800 with the ITE IT8613E chip have none either."
} as const;

/** Band that says where the hardware facts come from and what is and is not confirmed. */
export const SOURCES = {
    title: "Built on UGREEN's published driver sources.",
    sub: 'UGREEN publishes its GPL kernel drivers (github.com/ugreen-opensource, kernel-6.12, drivers/ugreen). The plugin takes chip IDs, register addresses and frame formats from them and cites file and line. No UGREEN code is copied; the plugin is MIT. Nobody has checked that the published sources match the modules inside UGOS, so this page says "from the published sources" and nothing more.',
    points: [
        [
            'Fans',
            "DXP4800 GT and iDX6011 Pro use the registers in UGREEN's IT5571 drivers. The fan probes for the DXP2800, DXP4800 and DXP8800 Plus check their result against the wiring in UGREEN's IT8613E driver."
        ],
        [
            'DXP2800 GT',
            "Fan control for its Chipsea CS201x chip follows UGREEN's driver. It stays off until you run a one-minute probe and confirm. Vendor-sourced, not yet confirmed on hardware."
        ],
        [
            'LEDs',
            "The LED protocol comes from miskcoo's ugreen_leds_controller and matches UGREEN's published LED driver. Which models are confirmed on hardware is in the matrix below."
        ],
        ['Not claimed', 'This is not endorsed or certified by UGREEN. The register facts are read from published sources; hardware status stays in the matrix.']
    ],
    link: 'Sources, file by file',
    note: 'UGREEN is a trademark of its owner. This project is not affiliated with UGREEN.'
} as const;

/** The ARM models of the home series cannot run Unraid; the one sentence that says so on the site and in the README. */
export const ARM_NOTE = "Runs on every UGREEN NAS that runs Unraid: the x86 DX, DXP and iDX series. (The ARM-based DH models can't run Unraid.)";

export const CASE_LABEL = { none: 'none', 'front-rear': 'front and rear', full: 'front, rear and inside' } as const;

export function capabilities(m: Model): Capability[] {
    return offered(m);
}
