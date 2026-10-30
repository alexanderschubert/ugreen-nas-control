// Icons of the site: the plugin's own line icons (web/src/core/icons.ts), so site, demo and plugin draw the same
// glyphs with the same stroke grammar (24x24, stroke 1.8, round caps, currentColor).
import { LED_ICONS, NAS_ICONS, SITE_ICONS, STATUS_ICONS, svgIcon } from '../../web/src/core/icons';
import type { Capability, Evidence } from '../../web/models/schema';

const ALL: Record<string, string> = { ...LED_ICONS, ...NAS_ICONS, ...SITE_ICONS };

/** Capability -> the plugin icon its page uses in the sidebar (UGREENNASControl.page). */
export const CAPABILITY_ICON: Record<Capability, string> = { leds: 'bulb', fans: 'fan', case: 'box', sensors: 'thermo' };

export const icon = (name: string, size = 20): string => svgIcon(ALL[name] ?? '', size);
export const statusIcon = (status: Evidence, size = 14): string => svgIcon(STATUS_ICONS[status], size, 'ico st-glyph');
/** A capability icon with the status of the check as a badge in its corner. */
export const capIcon = (cap: Capability, status: Evidence, size = 20): string =>
    `<span class="cap st-${status}">${svgIcon(NAS_ICONS[CAPABILITY_ICON[cap] as keyof typeof NAS_ICONS], size)}<span class="badge">${statusIcon(status, 11)}</span></span>`;
