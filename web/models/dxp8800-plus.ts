import type { Model } from './schema';

export default {
    id: 'dxp8800-plus',
    name: 'DXP8800 Plus',
    series: 'DXP',
    dmiPattern: '^DXP8800 Plus$',
    fixtureDmi: 'DXP8800 Plus',
    cpu: 'Intel Core i5-1235U',
    bays: 8,
    m2Slots: 2,
    m2: null,
    lan: { maxMbit: [10000, 10000] },
    led: 'bays',
    caseView: 'front-rear',
    caseVariant: 'rear8800',
    fan: { chip: 'ITE IT8613E', fans: { fan2: 'cpu', fan3: 'case' }, kind: 'probe' },
    verified: {
        leds: {
            status: 'community',
            by: 'miskcoo and users',
            ref: 'https://github.com/miskcoo/ugreen_leds_controller',
            note: "LED protocol verified on this model by miskcoo's driver, confirmed by users of this plugin."
        },
        fans: {
            status: 'expected',
            note: 'Same IT8613E as the DXP6800 Pro, header wiring not known: the fan probe finds which output drives which fan and fan control stays off until you confirm its result. Not run on this model yet.'
        },
        case: { status: 'expected', note: 'Drawn as a row of ports from review port lists.' },
        sensors: { status: 'expected' }
    },
    sources: ['https://ai.ugreen.com/products/ugreen-nasync-dxp8800-plus-nas-storage'],
    note: 'Eight bays, two M.2 slots, two 10G LAN ports and two Thunderbolt 4 ports. Fan control after a fan probe.',
    shots: true
} satisfies Model;
