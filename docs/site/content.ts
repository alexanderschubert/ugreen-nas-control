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
    'Unraid plugin for UGREEN NAS (DX, DXP, iDX): fan curves, LEDs, case view, sensors, a dashboard tile and the hardware watchdog kept on (DXP4800 GT, iDX6011 Pro). No kernel module. The page runs the real plugin interface on sample data.';
export const KEYWORDS = 'UGREEN NAS, Unraid plugin, DXP6800 Pro, DXP4800, DXP8800, fan control, LED control, case view, Community Applications';
export const HEADLINE = 'Unraid on UGREEN. Done right.';
export const SUBLINE =
    'Keep the BIOS watchdog on: the plugin feeds it, and a frozen box reboots itself. Plus fan curves, LEDs and a live case view. The box below is the real plugin: click it.';
/** Under the headline of the social preview image. */
export const SOCIAL_SUB = 'Fans, LEDs, case view, and a hardware watchdog you can leave on, for UGREEN NAS on Unraid.';

/** The ARM models of the home series cannot run Unraid; the one sentence that says so on the site and in the README. */
export const ARM_NOTE = "Runs on every UGREEN NAS that runs Unraid: the x86 DX, DXP and iDX series. (The ARM-based DH models can't run Unraid.)";

export const CASE_LABEL = { none: 'none', 'front-rear': 'front and rear', full: 'front, rear and inside' } as const;

export function capabilities(m: Model): Capability[] {
    return offered(m);
}
