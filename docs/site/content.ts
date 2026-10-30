// Words of the site. Facts come from web/models/ and the README; keep claims to what the plugin does.
import { type Capability, type Model, offered } from '../../web/models/schema';
export { CAPABILITY_LABEL, EVIDENCE_HELP, EVIDENCE_LABEL, OVERALL_HELP, OVERALL_LABEL, checkText } from '../../web/models/schema';

export const REPO = process.env.GITHUB_REPOSITORY ?? 'alexanderschubert/ugreen-nas-control';
export const [OWNER = '', NAME = ''] = REPO.split('/');
export const SITE_URL = process.env.SITE_URL ?? `https://${OWNER.toLowerCase()}.github.io/${NAME}/`;
export const GITHUB = `https://github.com/${REPO}`;
export const PLG_URL = `https://raw.githubusercontent.com/${REPO}/main/plugin/ugreen-nas-control.plg`;
export const FORUM = 'https://forums.unraid.net/topic/201044-plugin-ugreen-nas-control-led-fan-and-system-control-for-ugreen-dxdxp-nas/';
/** Flip to true once the Community Applications entry is live: the Apps tab becomes the first install route. */
export const CA_LIVE = false;

/** Meta description and keywords: the one place besides the hero where the official line name appears for search. */
export const META_DESC =
    'Unraid plugin for UGREEN NASync (DX, DXP, iDX) with what UGOS did for the hardware: fan curves, LEDs, a live case view, temperatures, a dashboard tile, MQTT and a hardware watchdog. No kernel module.';
export const KEYWORDS = 'UGREEN NAS, UGREEN NASync, Unraid plugin, DXP6800 Pro, DXP4800, DXP8800, fan control, LED control, case view, Community Applications';
export const HEADLINE = 'Unraid on your UGREEN, with everything UGOS did for the hardware.';
export const SUBLINE =
    'Fan curves, LED control, a live case view, temperatures, a dashboard tile, MQTT and a hardware watchdog for UGREEN NASync boxes. One plugin, no kernel module.';

/** The ARM models of the home series cannot run Unraid; the one sentence that says so on the site and in the README. */
export const ARM_NOTE =
    'The DH2300 and DH4300 Plus use ARM chips (Rockchip) and cannot run Unraid, which needs a 64-bit x86 CPU; this plugin supports the x86 models only.';

export const CASE_LABEL = { none: 'none', 'front-rear': 'front and rear', full: 'front, rear and inside' } as const;

export function capabilities(m: Model): Capability[] {
    return offered(m);
}
