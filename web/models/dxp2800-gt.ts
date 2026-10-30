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
    fan: { chip: 'Chipsea CS201x embedded controller', fans: { fan1: 'cpu', fan3: 'case' }, kind: 'probe' },
    verified: {
        leds: {
            status: 'expected',
            note: "AMD DesignWare I2C controller like the DXP4800 GT, no Intel SMBus; miskcoo's driver for it is work in progress (issues 122, 123). Bay order guessed."
        },
        fans: {
            status: 'expected',
            note: "Fan control stays off until you run `ugreen-nas-fan cs201x confirm`. Registers and the CPU/case fan roles are from UGREEN's own CS201x driver; nobody has run them on a device with this plugin. 25 % floor, stall point not measured."
        },
        case: { status: 'expected', note: 'Drawn after the product photos, not compared on a device.' },
        sensors: { status: 'expected' }
    },
    sources: ['https://ai.ugreen.com/products/ugreen-nasync-dxp2800-gt-2-bay-nas-storage', 'https://github.com/miskcoo/ugreen_leds_controller/issues/122'],
    note: 'Two bays (U.2 capable), two M.2 slots, one 10G LAN port. LEDs are enabled but nobody has confirmed them. Case view (front, rear) after the product photos; fan control after `ugreen-nas-fan cs201x confirm` (Chipsea CS201x embedded controller; wiring from the UGREEN driver, unconfirmed on a device).',
    shots: true
} satisfies Model;
