import type { Model } from './schema';

export default {
    id: 'dxp2800-gt',
    name: 'DXP2800 GT',
    series: 'DXP',
    dmiPattern: '^DXP2800 GT',
    fixtureDmi: 'DXP2800 GT',
    cpu: 'AMD Ryzen Embedded R2514',
    bays: 2,
    m2Slots: 2,
    m2: null,
    lan: { maxMbit: [10000] },
    led: 'bays',
    caseView: 'front-rear',
    caseVariant: 'rear2800',
    fan: null,
    verified: {
        leds: {
            status: 'expected',
            note: "AMD DesignWare I2C controller like the DXP4800 GT, no Intel SMBus; miskcoo's driver for it is work in progress (issues 122, 123). Bay order guessed."
        },
        fans: { status: 'unsupported' },
        case: { status: 'expected', note: 'Drawn after the product photos, not compared on a device.' },
        sensors: { status: 'expected' }
    },
    sources: ['https://ai.ugreen.com/products/ugreen-nasync-dxp2800-gt-2-bay-nas-storage', 'https://github.com/miskcoo/ugreen_leds_controller/issues/122'],
    note: 'Two bays (U.2 capable), two M.2 slots, one 10G LAN port. LEDs are enabled but nobody has confirmed them. Case view (front, rear) after the product photos; no fan control (Chipsea CS201x embedded controller, read-only probe: ugreen-nas-fan cs201x).',
    shots: true
} satisfies Model;
