import type { Model } from './schema';

export default {
    id: 'dxp2800',
    name: 'DXP2800',
    series: 'DXP',
    dmiPattern: '^DXP2800$',
    fixtureDmi: 'DXP2800',
    cpu: 'Intel N100',
    bays: 2,
    m2Slots: 2,
    m2: null,
    lan: { maxMbit: [2500] },
    led: 'bays',
    caseView: 'front-rear',
    caseVariant: 'rear2800',
    fan: { chip: 'ITE IT8613E', fans: { fan3: 'case' }, kind: 'probe' },
    verified: {
        leds: {
            status: 'community',
            by: 'users',
            note: 'Reported working by users. Boards from December 2025 (V1.2, rev 251215) use LED chip 0xc5b2, which ignores the write protocol used here (miskcoo issue 128): LEDs do not work there yet.'
        },
        fans: {
            status: 'expected',
            note: 'Same IT8613E as the DXP6800 Pro, header wiring not known: the fan probe finds which output drives which fan and fan control stays off until you confirm its result. Not run on this model yet. One fan was reported on tach 3 (1726 rpm), none on tach 2.'
        },
        case: { status: 'expected', note: 'Drawn after photos, not compared on a device.' },
        sensors: { status: 'expected' }
    },
    sources: [
        'https://datacenterdisk.com/nas-devices/ugreen',
        'https://nascompares.com/2024/02/05/the-ugreen-nasync-dxp-nas-series-should-you-buy/',
        'https://github.com/miskcoo/ugreen_leds_controller/issues/128',
        'https://github.com/IT-Kuny/UGREEN-DXP-FAN-NAS-Driver'
    ],
    note: 'Two bays, two M.2 slots, one 2.5G LAN port. The V1.2 board (December 2025) has a new LED chip that does not work with this plugin yet.',
    shots: true
} satisfies Model;
