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
    'The Unraid control plugin for UGREEN NAS (DX, DXP, iDX): fan curves, LEDs, case view, sensors, a dashboard tile, the hardware watchdog petted only when it is running, power on after AC loss and a read-only front-panel view. No kernel module. The page runs the real plugin interface on sample data.';
export const KEYWORDS =
    'UGREEN NAS, Unraid plugin, DXP6800 Pro, DXP4800, DXP8800, DXP2800 GT, iDX6011, fan control, LED control, watchdog, case view, Community Applications';
export const HEADLINE = 'The Unraid control plugin for UGREEN NAS. Fans, LEDs, watchdog.';
export const SUBLINE =
    'Hardware facts come from the driver sources UGREEN publishes. Fan curves, LEDs, the watchdog, power on after AC loss and a live case view; models without confirmed wiring get a probe first. The box below is the real plugin: click it.';
/** Headline of the social preview image: one short sentence per line, the card has room for 21 characters at three lines. */
export const SOCIAL_HEAD = 'Unraid plugin. For UGREEN NAS. Fans, LEDs, watchdog.';
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
    sub: "If the watchdog is running, the plugin feeds it. On the DXP4800 GT and iDX6011 Pro that is the embedded controller, through the registers UGREEN's own driver uses. On the IT8613E models it feeds only a timer it has seen count down. If the system freezes, the feed stops and the hardware resets the box.",
    body: "UGREEN's driver arms the watchdog only when something opens /dev/watchdog. The plugin never does: it feeds a timer that is already running. When it stops, it clears a timer only if it fed it, so stopping or uninstalling never triggers a reset. Whether your BIOS arms it is not known; the card shows what the controller reports. That a feed alone reloads the counter is not yet confirmed on hardware; the card says so if a feed did not take.",
    steps: [
        ['shield', 'Something arms it', "UGREEN's driver, another tool or the firmware. The plugin only reads whether it is on."],
        [
            'refresh',
            'The plugin feeds it',
            'A small service rewrites the timeout on a steady beat while the system is alive. On the IT8613E it waits until the timer was seen counting down.'
        ],
        ['reset', 'A frozen box reboots itself', 'The beat stops, the timer runs out, the hardware resets the box.']
    ],
    other: "IT8613E models (DXP2800, DXP4800, DXP4800 Plus and Pro, DXP6800 Pro, DXP8800 Plus): the plugin writes only after two reads show the timer counting, and it does nothing while the kernel's it87_wdt module is loaded. No feed on the DXP2800 GT, the plain iDX6011 and iDX6012 (read only), or any other model. UGREEN's DXP2800 GT driver switches off a watchdog that is already running when it loads, so firmware can leave one on."
} as const;

/** Band that says where the hardware facts come from and what is and is not confirmed. */
export const SOURCES = {
    title: "Built on UGREEN's published driver sources.",
    sub: 'UGREEN publishes its GPL kernel drivers (github.com/ugreen-opensource, kernel-6.12, drivers/ugreen). The plugin takes chip IDs, register addresses and frame formats from them and cites file and line. No UGREEN code is copied; the plugin is MIT. Nobody has checked that the published sources match the modules inside UGOS, so this page says "from the published sources" and nothing more.',
    points: [
        [
            'Fans',
            "DXP4800 GT and iDX6011 Pro use the registers in UGREEN's IT5571 drivers. The fan probes for the DXP2800, DXP4800 and DXP8800 Plus check their result against the wiring in UGREEN's IT8613E driver. The plain iDX6011 and iDX6012 get readings only."
        ],
        [
            'DXP2800 GT',
            "Fan control for its Chipsea CS201x chip follows UGREEN's driver and stays off until you run a one-minute probe and confirm. The LEDs go through the chip's ARGB block and are opt-in. Vendor-sourced, not yet confirmed on hardware."
        ],
        [
            'LEDs',
            "The LED protocol comes from miskcoo's ugreen_leds_controller and matches UGREEN's published LED driver. DXP2800 boards whose LED controller does not answer the usual frame (V1.2) fall back to the frame UGREEN's driver uses; not confirmed on such a board. Which models are confirmed on hardware is in the matrix below."
        ],
        ['Not claimed', 'This is not endorsed or certified by UGREEN. The register facts are read from published sources; hardware status stays in the matrix.']
    ],
    credits: [
        ['miskcoo', 'https://github.com/miskcoo/ugreen_leds_controller', 'the LED protocol and bay mapping'],
        ['UGREEN', 'https://github.com/ugreen-opensource', 'the published driver sources'],
        [
            'Geoff Davis',
            'https://geoffdavis.com/posts/ugreen-gpl-sources-verified/#the-part-nobody-asked-for-oem-hardware-drivers',
            'requested the sources from UGREEN under the GPL and reviewed the release'
        ]
    ],
    link: 'Sources, file by file',
    note: 'UGREEN is a trademark of its owner. This project is not affiliated with UGREEN.'
} as const;

/** Band for the smaller controls: front panel, power after AC loss, new models, rival detection. Each line carries its evidence. */
export const EXTRAS = {
    title: 'Front panel, power and new models.',
    sub: "Smaller controls, each described in UGREEN's driver sources. None is confirmed on hardware yet; the page says so on every line.",
    points: [
        [
            'Front-panel buttons',
            'Read only. Shows whether power and reset are held and times a press. A press triggers nothing. Not yet confirmed on hardware.'
        ],
        ['Beeper test', 'Sounds the beeper for a set time on models where UGREEN names a beeper path, and refuses on the rest. Not yet confirmed on hardware.'],
        [
            'Power on after AC loss',
            'An explicit setting: on, stay off, or last state where the board has it. Written only when you choose, never by the fan service. The DXP4800 GT cannot be read back. The plain iDX6011 and iDX6012 are read only. Not yet confirmed on hardware.'
        ],
        [
            'New models',
            "DXP6800 and Plus, DXP6800S, DXP8800 and Pro, DXP2800S and DH2600, from UGREEN's product list. Expected to work; nobody has run them. The DH2600 gets sensors only."
        ],
        [
            'Rival tools',
            "Detects FanCtrl Plus, Dynamix Auto Fan, it87 and LED plugins, and UGREEN's own kernel modules. While one drives the same chip, the plugin only reads. It never removes the other tool."
        ]
    ]
} as const;

/** The ARM models of the home series cannot run Unraid; the one sentence that says so on the site and in the README. */
export const ARM_NOTE = "Runs on every UGREEN NAS that runs Unraid: the x86 DX, DXP and iDX series. (The ARM-based DH models can't run Unraid.)";

export const CASE_LABEL = { none: 'none', 'front-rear': 'front and rear', full: 'front, rear and inside' } as const;

export function capabilities(m: Model): Capability[] {
    return offered(m);
}
