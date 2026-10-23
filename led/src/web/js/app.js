(() => {
    'use strict';

    const API = '/plugins/ugreen-nas-control/led/api.php';
    const root = document.getElementById('ulc');

    if (!root) return;

    const LANG = ['de', 'en', 'es'].includes(window.UGREEN_LED_LANG) ? window.UGREEN_LED_LANG : 'en';
    const TEXTS = window.ULC_I18N || { de: {}, en: {}, es: {} };

    // t('led.bay', { n: 2 }) -> "Schacht 2" / "Bay 2"; English fills gaps in other languages.
    const t = (key, vars = {}) => String(TEXTS[LANG]?.[key] ?? TEXTS.en[key] ?? TEXTS.de[key] ?? key)
        .replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));

    // "auto" follows Unraid: light when the page behind the plugin is light.
    function resolveTheme(setting) {
        if (setting === 'light' || setting === 'dark') return setting;

        for (let el = document.body; el; el = el.parentElement) {
            const match = getComputedStyle(el).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
            if (match && (match[4] === undefined || Number(match[4]) > 0.5)) {
                const [r, g, b] = [match[1], match[2], match[3]].map(Number);
                return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? 'light' : 'dark';
            }
        }
        return 'dark';
    }

    root.dataset.theme = resolveTheme(window.UGREEN_LED_THEME);

    const q = selector => root.querySelector(selector);
    const qa = selector => [...root.querySelectorAll(selector)];
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    /*
     * ---------------------------------------------------------
     * Static data
     * ---------------------------------------------------------
     */

    const ICONS = {
        nas: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7.5 7v8M12 7v8M16.5 7v8M7 18.5h.01M17 18.5h.01"/>',
        home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/>',
        bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>',
        drives: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
        sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4M5 17v4M3 19h4"/>',
        clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
        gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
        info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
        activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
        network: '<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M5 16v-3h14v3M12 12V8"/>',
        wave: '<path d="M2 12c2.5-5 5-5 7.5 0s5 5 7.5 0 3.5-3.5 5-2"/>',
        rainbow: '<path stroke="#ff3b30" d="M22 18a10 10 0 0 0-20 0"/><path stroke="#ffd60a" d="M18.5 18a6.5 6.5 0 0 0-13 0"/><path stroke="#34c759" d="M15 18a3 3 0 0 0-6 0"/>',
        thermo: '<path stroke="#ff6b5e" d="M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/>',
        reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
        refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
        play: '<path fill="currentColor" d="m7 4 13 8-13 8z"/>'
    };

    const icon = name =>
        `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

    const DEFAULTS = {
        power: '#ffffff',
        netdev: '#00c853',
        disk: '#ffa000',
        error: '#ff3b30',
        brightness: 80
    };

    // on/off times in ms that the driver accepts for breath and blink.
    const SPEEDS = [
        { label: 'speed.0', breath: [3000, 2000], blink: [1000, 1000] },
        { label: 'speed.1', breath: [2000, 1500], blink: [700, 700] },
        { label: 'speed.2', breath: [1200, 900], blink: [450, 450] },
        { label: 'speed.3', breath: [700, 500], blink: [250, 250] },
        { label: 'speed.4', breath: [400, 300], blink: [120, 120] }
    ];

    const EFFECTS = [
        { id: 'static', icon: 'bulb' },
        { id: 'breath', icon: 'wave' },
        { id: 'blink', icon: 'activity' },
        { id: 'rainbow', icon: 'rainbow', software: true },
        { id: 'temperature', icon: 'thermo', software: true },
        { id: 'off', icon: 'power' }
    ];

    const state = {
        model: 'UGREEN NAS',
        bays: 0,
        order: [],
        leds: {},
        status: {},
        bayInfo: [],
        schedule: null,
        busy: 0,
        writeSeq: 0,
        tab: 'system',
        target: 'all',
        speed: 2,
        dragging: false
    };

    const disks = () => state.order.filter(led => led.startsWith('disk'));

    const targetLeds = target =>
        target === 'all' ? state.order
            : target === 'disks' ? disks()
                : [target];

    const statusMode = () => state.status.mode === 'status';

    // Rainbow/temperature run as a process on a set of LEDs (status.fx, status.fx_leds).
    const fxLeds = () => (state.status.fx_leds || '').split(',').filter(Boolean);
    const fxOn = led => Boolean(state.status.fx) && fxLeds().includes(led);

    // ms per rainbow step (10°) for the speed levels, as in ugreen-led-i2c.
    const RAINBOW_STEP_MS = [600, 400, 250, 150, 80];

    // In status mode the daemon drives disk and network LEDs; only colour and brightness stay manual.
    // The network LED can be left manual (netdev_status).
    const netdevManual = () => state.status.netdev_status === 'manual';
    const managed = led => statusMode() && (led.startsWith('disk') || (led === 'netdev' && !netdevManual()));

    const ledLabel = led =>
        led === 'power' ? t('led.power')
            : led === 'netdev' ? t('led.netdev')
                : t('led.bay', { n: led.slice(4) });

    const effectName = id => t(`effect.${id}`);

    /*
     * ---------------------------------------------------------
     * Helpers
     * ---------------------------------------------------------
     */

    const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);

    function rgbToHex(value) {
        const parts = String(value).trim().split(/\s+/).map(Number);

        if (parts.length < 3 || parts.some(Number.isNaN)) return '#ffffff';

        return '#' + parts.slice(0, 3)
            .map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0'))
            .join('');
    }

    function hexToRgb(hex) {
        const value = hex.replace('#', '');

        return {
            r: parseInt(value.slice(0, 2), 16),
            g: parseInt(value.slice(2, 4), 16),
            b: parseInt(value.slice(4, 6), 16)
        };
    }

    const normalizeHex = value => {
        const match = String(value).trim().match(/^#?([0-9a-f]{6})$/i);
        return match ? `#${match[1].toLowerCase()}` : null;
    };

    const levelFromPercent = percent => Math.round(percent * 2.55);

    function setRangeFill(input) {
        const min = Number(input.min) || 0;
        const max = Number(input.max) || 100;
        input.style.setProperty('--fill', `${(input.value - min) / (max - min) * 100}%`);
    }

    function toast(message, type = 'success') {
        const element = q('#ulc-toast');

        element.textContent = message;
        element.className = `ulc-toast show ${type}`;

        if (type === 'error') console.error('[UGREEN LED]', message);

        clearTimeout(element._timer);
        element._timer = setTimeout(() => {
            element.className = 'ulc-toast';
        }, type === 'error' ? 6000 : 2500);
    }

    /*
     * ---------------------------------------------------------
     * API
     * ---------------------------------------------------------
     */

    // Every write counts twice (start, end), so a read that was in flight while a
    // write ran can be told apart and dropped: its values are older than the write.
    async function api(params, post = false) {
        if (!post) return request(params, false);

        state.writeSeq++;

        try {
            return await request(params, true);
        } finally {
            state.writeSeq++;
        }
    }

    async function request(params, post) {
        const options = { credentials: 'same-origin' };
        let url = API;

        if (post) {
            options.method = 'POST';
            // Unraid rejects POSTs without the WebGUI csrf_token before api.php runs.
            options.body = new URLSearchParams({
                ...params,
                csrf_token: window.UGREEN_LED_CSRF_TOKEN || ''
            });
        } else {
            url += '?' + new URLSearchParams(params);
        }

        const response = await fetch(url, options);
        const text = await response.text();
        let data;

        try {
            data = JSON.parse(text);
        } catch (error) {
            throw new Error(t('error.response', { status: response.status }));
        }

        if (!response.ok || data.ok === false) {
            // Known api.php messages are translated by their English text.
            const message = data.error && (TEXTS[LANG]?.[`api.${data.error}`] ?? TEXTS.en[`api.${data.error}`]);
            throw new Error(message || data.error || t('error.api', { status: response.status }));
        }

        return data;
    }

    async function write(leds, action, extra = {}) {
        if (!leds.length) return;

        state.busy++;

        try {
            await api({ action, led: leds.join(','), ...extra }, true);
        } finally {
            state.busy--;
        }
    }

    // Run a user action: report errors and re-read the hardware afterwards.
    async function run(action, success) {
        try {
            await action();
            if (success) toast(success);
        } catch (error) {
            toast(error.message, 'error');
        }

        // An action may have started or ended a rainbow/temperature effect.
        await loadStatus();
        await refresh();
    }

    /*
     * ---------------------------------------------------------
     * Loading
     * ---------------------------------------------------------
     */

    async function loadStatus() {
        try {
            const data = await api({ action: 'status' });

            state.status = data;
            state.model = data.model || 'UGREEN NAS';

            const order = Array.isArray(data.leds) ? data.leds : [];
            const baysChanged = data.bays !== state.bays || order.join() !== state.order.join();

            state.bays = data.bays;
            state.order = order;

            if (baysChanged) buildLayout();

            renderStatus(true);
            renderMode();
            renderNight();
            renderAlerts();
            renderDisplay();
            renderNetwork();
            renderShutdown();
            await loadBays();
        } catch (error) {
            renderStatus(false, error.message);
        }
    }

    async function loadBays() {
        try {
            const data = await api({ action: 'bays' });
            state.bayInfo = data.bays || [];
        } catch (error) {
            state.bayInfo = [];
        }

        renderBays();
    }

    async function refresh() {
        if (!state.order.length) return;

        const seq = state.writeSeq;

        try {
            const data = await api({ action: 'all' });

            // A write ran while this read was in flight; its own refresh follows.
            if (state.busy || seq !== state.writeSeq) return;

            const leds = {};

            for (const [name, led] of Object.entries(data.leds || {})) {
                leds[name] = {
                    color: rgbToHex(led.color),
                    brightness: Number(led.brightness) || 0,
                    effect: led.effect || 'none'
                };
            }

            state.leds = leds;
            render();
        } catch (error) {
            renderStatus(false, error.message);
        }
    }

    /*
     * ---------------------------------------------------------
     * Rendering
     * ---------------------------------------------------------
     */

    function renderStatus(online, error) {
        const badge = q('#ulc-online');

        badge.textContent = online ? t('online') : t('offline');
        badge.className = `ulc-badge ${online ? 'online' : 'offline'}`;
        badge.title = error || '';

        q('#ulc-banner').hidden = !online;
        q('#ulc-mapping-hint').hidden = !state.status.mapping || state.status.mapping === 'tested';
        q('#ulc-foreign').hidden = !state.status.foreign_monitor;

        qa('[data-model]').forEach(element => {
            element.textContent = state.model;
        });

        q('#ulc-version').textContent = window.UGREEN_LED_VERSION || '';

        const facts = [
            [t('fact.model'), state.model],
            [t('fact.bays'), state.bays || '—'],
            [t('fact.mapping'), state.status.mapping ? t(`mapping.${state.status.mapping}`) : '—'],
            [t('fact.control'), state.status.controller ? `${state.status.controller} (${t('fact.no_kernel_module')})` : '—'],
            [t('fact.controller'), state.status.i2c_address
                ? t('fact.controller_on', { bus: state.status.i2c_bus, address: state.status.i2c_address })
                : t('fact.controller_off')],
            [t('fact.leds'), state.order.length ? state.order.join(', ') : t('fact.none')],
            [t('fact.ports'), (state.status.network_ports || []).length
                ? state.status.network_ports.map(portTitle).join(' · ')
                : '—'],
            [t('fact.kernel'), state.status.kernel || '—'],
            [t('fact.monitor'), state.status.foreign_monitor ? t('fact.monitor_on') : t('fact.monitor_off')],
            [t('fact.saved'), state.status.settings_saved ? t('fact.saved_yes') : t('fact.saved_no')],
            [t('fact.version'), window.UGREEN_LED_VERSION || '—'],
            [t('fact.status'), online ? t('fact.connected') : t('fact.disconnected', { error: error || '' })]
        ];

        q('#ulc-facts').innerHTML = facts
            .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`)
            .join('');
    }

    // Parts that depend on the bay count are built once and then only updated.
    function buildLayout() {
        qa('[data-nas]').forEach(element => {
            element.style.setProperty('--bays', String(disks().length || 1));
            element.innerHTML =
                '<div class="ulc-nas-bays">' +
                disks().map((led, i) => `
                    <div class="ulc-bay">
                        <span class="ulc-bay-no">${String(i + 1).padStart(2, '0')}</span>
                        <span class="ulc-bay-info" data-bay-info="${led}"></span>
                        <span class="ulc-bay-knob"></span>
                        <span class="ulc-led" data-led="${led}"></span>
                    </div>`).join('') +
                '</div>' +
                '<div class="ulc-nas-front">' +
                '<span class="ulc-led" data-led="power"></span><span class="ulc-led-label">Power</span>' +
                '<span class="ulc-led" data-led="netdev"></span><span class="ulc-led-label">LAN</span><span class="ulc-led-label ulc-link-speed" data-link-speed hidden></span>' +
                '<span class="ulc-nas-brand">UGREEN</span>' +
                '</div>';
        });

        buildColors();
        buildTable(q('#ulc-led-table'), state.order);
        buildTable(q('#ulc-bay-table'), disks());
    }

    function render() {
        qa('.ulc-led[data-led]').forEach(element => paintLed(element, element.dataset.led));
        renderGeneral();
        renderColors();
        renderEffects();
        renderTables();
    }

    function paintLed(element, led) {
        const s = state.leds[led];

        if (!s) return;

        const on = s.brightness > 0;
        const effect = on ? s.effect : 'none';
        const speed = SPEEDS[state.speed][effect === 'blink' ? 'blink' : 'breath'];

        element.classList.toggle('off', !on);
        element.classList.toggle('fx-breath', effect === 'breath');
        element.classList.toggle('fx-blink', effect === 'blink');
        element.classList.toggle('fx-rainbow', on && fxOn(led) && state.status.fx === 'rainbow');
        element.classList.toggle('reverse', Boolean(state.status.fx_reverse));
        element.style.setProperty('--rainbow', `${RAINBOW_STEP_MS[state.status.fx_speed ?? 2] * 36}ms`);
        element.style.setProperty('--c', s.color);
        element.style.setProperty('--level', (s.brightness / 255).toFixed(2));
        element.style.setProperty('--speed', `${speed[0] + speed[1]}ms`);
        element.title = `${ledLabel(led)}: ${s.color.toUpperCase()}, ${Math.round(s.brightness / 2.55)} %`;
    }

    // Brightness 0-255 to show for an LED: the saved value whenever night mode or
    // the status daemon (spun-down disks are dimmed) changes what the LED itself
    // shows; the setting is what the user chose, not what the daemon derived.
    function dayLevel(led) {
        const saved = state.status.saved_brightness?.[led];
        return (state.status.night || statusMode()) && saved != null ? saved : state.leds[led]?.brightness || 0;
    }

    // "eth0 10G ✕" for a port without link, "eth1 2.5G" with one; one port: just the speed.
    // Colour of a port's socket: the colour set for its speed when "by link speed" is on.
    function portColor(port) {
        if (!port.link || !state.status.netdev_speed_enabled) return '';

        const step = LINK_SPEEDS.filter(s => port.speed >= s).pop() || LINK_SPEEDS[0];
        const rgb = (state.status.netdev_speed_colors || {})[step];

        return rgb ? rgbToHex(rgb) : SPEED_DEFAULTS[step];
    }

    function renderLinkSpeed() {
        const ports = state.status.network_ports || [];
        const speed = Number(state.status.netdev_speed) || 0;
        const items = ports.length > 1
            ? ports.map(port => ({
                text: speedShort(port.link ? port.speed : port.max),
                down: !port.link,
                color: portColor(port),
                title: portTitle(port)
            }))
            : speed > 0 ? [{ text: speedShort(speed), down: false, color: portColor({ link: true, speed }), title: t('display.speed_current', { speed: speedLabel(speed) }) }] : [];

        qa('[data-link-speed]').forEach(element => {
            element.replaceChildren(...items.map(item => {
                const span = document.createElement('span');
                span.innerHTML = item.down ? PORT_ICON_DOWN : PORT_ICON;
                span.append(document.createTextNode(item.text));
                span.title = item.title;
                if (item.down) span.className = 'down';
                if (item.color) span.style.setProperty('--port', item.color);
                return span;
            }));
            element.hidden = !items.length;
        });
    }

    function portTitle(port) {
        const max = port.max ? ` (${t('fact.port_max', { speed: speedLabel(port.max) })})` : '';
        return `${port.name}: ${port.link ? (port.speed > 0 ? speedLabel(port.speed) : t('fact.port_up')) : t('fact.port_down')}${max}`;
    }

    function renderGeneral() {
        renderLinkSpeed();

        const values = state.order.map(dayLevel);
        const max = Math.max(0, ...values);
        const note = q('#ulc-night-note');

        note.hidden = !state.status.night;
        if (state.status.night) {
            note.textContent = t(state.schedule?.action === 'off' ? 'night.note_off' : 'night.note_dim', { time: state.schedule?.end || '' });
        }

        q('#ulc-enabled').checked = max > 0;

        if (!state.dragging && max > 0) {
            const percent = Math.round(max / 2.55);
            const slider = q('#ulc-brightness');

            slider.value = percent;
            setRangeFill(slider);
            q('#ulc-brightness-value').textContent = `${percent}%`;
        }
    }

    /* LED colours card */

    function colorRows() {
        if (state.tab === 'bays') {
            return disks().map(led => ({
                key: led,
                label: ledLabel(led),
                icon: 'drives',
                leds: [led],
                def: DEFAULTS.disk
            }));
        }

        return [
            { key: 'power', label: t('led.power'), icon: 'power', leds: ['power'], def: DEFAULTS.power },
            { key: 'netdev', label: t('led.netdev'), icon: 'network', leds: ['netdev'], def: DEFAULTS.netdev },
            { key: 'disks', label: t('colors.disks'), sub: t('colors.all_bays'), icon: 'drives', leds: disks(), def: DEFAULTS.disk },
            { key: 'error', label: t('colors.error'), sub: statusMode() ? '' : t('colors.status_only'), icon: 'alert', leds: [], def: DEFAULTS.error, soon: !statusMode() }
        ].filter(row => row.key === 'error' || row.leds.every(led => state.order.includes(led)));
    }

    // Network LED by link speed (Mbit/s); the backend picks the largest step at or below the speed.
    const LINK_SPEEDS = [10, 100, 1000, 2500, 5000, 10000];
    const SPEED_DEFAULTS = { 10: '#ff3b30', 100: '#ff8c00', 1000: '#ffd60a', 2500: '#00c853', 5000: '#00c8c8', 10000: '#0078ff' };

    // An RJ45 socket: the network ports next to the LAN LED.
    const PORT_ICON_DOWN = '<svg class="ulc-port-ico" viewBox="0 0 20 16" aria-hidden="true"><rect x="1.5" y="2.5" width="17" height="12" rx="1.8"/><path d="M7.5 2.5V1.2h5v1.3"/><path d="M7.4 6.4l5.2 5.2M12.6 6.4l-5.2 5.2"/></svg>';
    const PORT_ICON = '<svg class="ulc-port-ico" viewBox="0 0 20 16" aria-hidden="true"><rect x="1.5" y="2.5" width="17" height="12" rx="1.8"/><path d="M7.5 2.5V1.2h5v1.3"/><path d="M5 8v4M6.6 8v4M8.2 8v4M9.8 8v4M11.4 8v4M13 8v4M14.6 8v4"/></svg>';

    // "2.5G", "1G", "100M": the negotiated link speed next to the LAN LED.
    const speedShort = mbps => mbps >= 1000 ? `${mbps / 1000}G` : mbps > 0 ? `${mbps}M` : '';

    const speedLabel = mbps => mbps >= 1000
        ? `${String(mbps / 1000).replace('.', LANG === 'en' ? '.' : ',')} Gbit/s`
        : `${mbps} Mbit/s`;

    const colorInput = (value, disabled = false) => `
        <div class="ulc-color-input">
            <label class="ulc-swatch" style="--c:${value}">
                <input type="color" value="${value}" ${disabled ? 'disabled' : ''} aria-label="${t('colors.pick')}">
            </label>
            <input type="text" value="${value.toUpperCase()}" maxlength="7" spellcheck="false" ${disabled ? 'disabled' : ''} aria-label="${t('colors.hex')}">
        </div>`;

    function buildColors() {
        const container = q('#ulc-colors');

        container._rows = colorRows();
        container.innerHTML = container._rows.map(row => `
            <div class="ulc-color-row ${row.soon ? 'ulc-disabled' : ''}" data-row="${row.key}">
                ${icon(row.icon)}
                <span>${escapeHtml(row.label)} ${row.sub ? `<small>${escapeHtml(row.sub)}</small>` : ''}</span>
                ${colorInput(row.def, row.soon)}
                <button type="button" class="ulc-icon-btn" data-reset title="${t('colors.reset')}" ${row.soon ? 'disabled' : ''}>${icon('reset')}</button>
            </div>`).join('');

        renderColors();
    }

    function setColorInput(container, value) {
        container.querySelector('.ulc-swatch').style.setProperty('--c', value);
        container.querySelector('input[type="color"]').value = value;
        container.querySelector('input[type="text"]').value = value.toUpperCase();
    }

    function renderColors() {
        const container = q('#ulc-colors');

        for (const row of container._rows || []) {
            const element = container.querySelector(`[data-row="${row.key}"]`);

            if (!element || element.contains(document.activeElement)) continue;

            if (row.key === 'error') {
                setColorInput(element, rgbToHex(state.status.disk_error_color || '255 59 48'));
                continue;
            }

            const led = row.leds[0];
            if (led && state.leds[led]) setColorInput(element, state.leds[led].color);
        }
    }

    /* Effects card */

    function currentEffect(leds) {
        const s = state.leds[leds[0]];

        if (!s) return null;
        if (s.brightness === 0) return 'off';
        if (leds.length && leds.every(fxOn)) return state.status.fx;

        return s.effect === 'none' ? 'static' : s.effect;
    }

    function buildEffects() {
        q('#ulc-effects').innerHTML = EFFECTS.map(effect => `
            <button type="button" class="ulc-effect" data-effect="${effect.id}">
                ${icon(effect.icon)}
                <strong>${escapeHtml(effectName(effect.id))}</strong>
                <small>${escapeHtml(t(`effect.${effect.id}_text`))}</small>
            </button>`).join('');
    }

    function renderEffects() {
        const active = currentEffect(targetLeds(state.target));

        qa('[data-effect]').forEach(button => {
            button.classList.toggle('active', button.dataset.effect === active);
        });
    }

    /* Per-LED tables */

    function buildTable(container, leds) {
        container.innerHTML = leds.map(led => `
            <div class="ulc-led-row" data-led-row="${led}">
                <span class="ulc-led" data-led="${led}"></span>
                <span>${escapeHtml(ledLabel(led))}<small data-led-sub="${led}"></small></span>
                ${colorInput('#ffffff')}
                <input type="range" min="0" max="100" step="1" value="0" data-brightness aria-label="${t('brightness.label')}">
                <div class="ulc-effect-cell">
                    <select data-led-effect aria-label="${t('effect.label')}">
                        <option value="static">${t('effect.static')}</option>
                        <option value="breath">${t('effect.breath')}</option>
                        <option value="blink">${t('effect.blink')}</option>
                        <option value="off">${t('effect.off_short')}</option>
                        <option value="rainbow" disabled>${t('effect.rainbow')}</option>
                        <option value="temperature" disabled>${t('effect.temperature')}</option>
                    </select>
                    <span class="ulc-managed" data-managed hidden title="${t('managed.title')}">${t('managed.label')}</span>
                </div>
            </div>`).join('');
    }

    function renderTables() {
        qa('[data-led-row]').forEach(row => {
            const led = row.dataset.ledRow;
            const s = state.leds[led];
            const effect = row.querySelector('[data-led-effect]');

            // In status mode the effect belongs to the daemon; say so instead of a dead select.
            effect.hidden = managed(led);
            row.querySelector('[data-managed]').hidden = !managed(led);

            if (!s || row.contains(document.activeElement)) return;

            setColorInput(row, s.color);

            const range = row.querySelector('[data-brightness]');
            range.value = Math.round(dayLevel(led) / 2.55);
            setRangeFill(range);

            effect.value = currentEffect([led]);
        });
    }

    /* Night mode */

    async function loadSchedule() {
        try {
            state.schedule = await api({ action: 'schedule' });
        } catch (error) {
            return;
        }

        const card = q('#ulc-night-card');
        if (!card.contains(document.activeElement)) {
            q('#ulc-night-enabled').checked = state.schedule.enabled;
            q('#ulc-night-start').value = state.schedule.start;
            q('#ulc-night-end').value = state.schedule.end;
            q('#ulc-night-action').value = state.schedule.action;

            const slider = q('#ulc-night-brightness');
            slider.value = Math.max(1, Math.round(state.schedule.brightness / 2.55));
            setRangeFill(slider);
            q('#ulc-night-brightness-value').textContent = `${slider.value}%`;
        }

        renderNight();
        renderGeneral(); // its night note names the end time
    }

    function renderNight() {
        const schedule = state.schedule;
        const night = Boolean(state.status.night);

        q('#ulc-night-badge').hidden = !night;
        q('#ulc-night-brightness').closest('.ulc-inline').classList.toggle('disabled', q('#ulc-night-action').value === 'off');

        if (!schedule) return;

        q('#ulc-night-state').textContent = !schedule.enabled
            ? t('night.state_off')
            : night
                ? t('night.state_night', { time: schedule.end })
                : t('night.state_day', { time: schedule.start });
    }

    function saveSchedule() {
        const start = q('#ulc-night-start').value;
        const end = q('#ulc-night-end').value;

        if (!start || !end) {
            toast(t('night.need_times'), 'error');
            return;
        }

        return run(async () => {
            await api({
                action: 'schedule',
                enabled: q('#ulc-night-enabled').checked ? '1' : '0',
                start,
                end,
                night_action: q('#ulc-night-action').value,
                brightness: levelFromPercent(Number(q('#ulc-night-brightness').value))
            }, true);

            await loadStatus();
            await loadSchedule();
        }, t('night.saved'));
    }

    function renderMode() {
        const status = statusMode();
        const target = q('#ulc-target');

        q('#ulc-mode').value = status ? 'status' : 'manual';

        if (document.activeElement !== q('#ulc-direction')) {
            q('#ulc-direction').value = state.status.fx_reverse ? 'backward' : 'forward';
        }
        q('#ulc-idle').checked = Boolean(state.status.fx_idle);
        q('#ulc-mode-hint').hidden = !status;
        q('#ulc-netdev-row').hidden = !status;
        if (document.activeElement !== q('#ulc-netdev-status')) {
            q('#ulc-netdev-status').value = state.status.netdev_status || 'activity';
        }
        qa('[data-status-hint]').forEach(hint => {
            hint.hidden = !status;
        });

        // Effects would fight the daemon on disk and network LEDs.
        [...target.options].forEach(option => {
            option.disabled = status && option.value !== 'power' && !(option.value === 'netdev' && netdevManual());
        });

        if (status && [...target.options].some(option => option.value === state.target && option.disabled)) {
            state.target = 'power';
            target.value = 'power';
        }

        const container = q('#ulc-colors');
        const errorRow = (container._rows || []).find(row => row.key === 'error');

        if (errorRow && errorRow.soon === status) buildColors();

        renderEffects();
        renderTables();
    }

    function renderBays() {
        const container = q('#ulc-bays');

        if (!state.bayInfo.length) {
            container.innerHTML = `<p class="ulc-muted">${escapeHtml(t('bays.none'))}</p>`;
            return;
        }

        container.innerHTML = state.bayInfo.map(bay => {
            const kind = !bay.device ? 'empty' : bay.error ? 'error' : '';
            const text = !bay.device ? t('bays.empty')
                : bay.status ? t(`disk.${bay.status}`)
                    : t('bays.outside');

            return `
                <div class="ulc-bay-card ${kind}">
                    <strong><span class="ulc-led" data-led="${escapeHtml(bay.led)}"></span>${escapeHtml(t('led.bay', { n: bay.bay }))}</strong>
                    <small>${bay.device ? `/dev/${escapeHtml(bay.device)}${bay.slot ? ` · ${escapeHtml(bay.slot)}` : ''}` : escapeHtml(t('bays.no_disk'))}</small>
                    ${bay.serial ? `<small>${escapeHtml(bay.serial)}</small>` : ''}
                    <span class="ulc-state ${kind}">${escapeHtml(text)}</span>
                    ${bay.device ? `<small>${escapeHtml(bayCondition(bay))}</small>` : ''}
                    ${bay.smart_warnings ? `
                        <span class="ulc-state warning">${escapeHtml(t('bays.smart', { list: smartText(bay.smart_warnings) }))}</span>
                        <button type="button" class="ulc-btn small" data-smart-ack="${escapeHtml(bay.led)}" title="${escapeHtml(t('smart.ack_title'))}">${icon('check')}${escapeHtml(t('smart.ack'))}</button>` : ''}
                    ${identifyButton(bay.led)}
                </div>`;
        }).join('');

        container.querySelectorAll('.ulc-led[data-led]').forEach(element => paintLed(element, element.dataset.led));

        renderCaseInfo();
        renderLedSubtitles();
    }

    // Under a bay's name in the LED tables: the Unraid disk in it, not the
    // controller's internal LED name (disk1..disk8), which reads like a slot.
    function renderLedSubtitles() {
        qa('[data-led-sub]').forEach(element => {
            const bay = state.bayInfo.find(b => b.led === element.dataset.ledSub);

            // In status mode a spun-down disk's LED differs from its setting.
            const standby = bay && bay.device && bay.standby && statusMode()
                ? t(`led.standby_${state.status.standby_mode || 'dim'}`, { pct: state.status.standby_level ?? 30 })
                : '';

            // In status mode an error or SMART warning wins over the colour set here.
            const override = bay && bay.device && statusMode()
                ? bay.error && state.status.error_enabled !== false ? t('led.error_override')
                    : bay.smart_warnings && state.status.smart_enabled !== false ? t('led.smart_override') : ''
                : '';

            element.textContent = !bay ? ''
                : !bay.device ? t('bays.no_disk')
                    : [bay.slot, `/dev/${bay.device}`, standby, override].filter(Boolean).join(' · ');
        });
    }

    // Temperature or state in the middle of each bay of the case pictures.
    function renderCaseInfo() {
        qa('[data-bay-info]').forEach(element => {
            const bay = state.bayInfo.find(b => b.led === element.dataset.bayInfo);
            let text = '';
            let kind = '';

            if (bay && bay.device) {
                if (bay.error) {
                    text = t('case.error');
                    kind = 'error';
                } else if (bay.smart_warnings) {
                    text = 'SMART';
                    kind = 'warning';
                } else if (bay.standby) {
                    text = t('bays.standby');
                    kind = 'standby';
                } else {
                    text = bay.temp != null ? `${bay.temp}°` : 'OK';
                }
            }

            element.textContent = text;
            element.className = `ulc-bay-info ${kind}`;
            element.title = bay && bay.device
                ? [t('led.bay', { n: bay.bay }), bay.status ? t(`disk.${bay.status}`) : '', bayCondition(bay)].filter(Boolean).join(' · ')
                : '';
        });
    }

    // "Standby", "38 °C" and read/write errors, as far as Unraid knows them.
    function bayCondition(bay) {
        const parts = [bay.standby ? t('bays.standby') : bay.temp != null ? `${bay.temp} °C` : ''];
        if (bay.errors > 0) parts.push(t('bays.errors', { n: bay.errors }));
        return parts.filter(Boolean).join(' · ');
    }

    // "5=8 errors=2" -> "8 umgelagerte Sektoren, 2 Lese-/Schreibfehler"
    function smartText(warnings) {
        return warnings.split(' ').map(pair => {
            const [name, value] = pair.split('=');
            return t(`smart.${name}`, { n: value });
        }).join(', ');
    }

    function ackSmart(led) {
        return run(
            () => api({ action: 'smart_ack', led }, true),
            t('smart.acked', { n: led.slice(4) })
        );
    }

    /* Status display (parity check, standby) */

    function renderDisplay() {
        const status = state.status;
        const sync = q('#ulc-sync-state');

        sync.hidden = !status.sync_action;
        if (status.sync_action) {
            sync.textContent = t(`sync.${status.sync_action}`, { percent: status.sync_percent });
        }

        const card = q('#ulc-display-card');
        if (card.contains(document.activeElement)) return;

        q('#ulc-sync-enabled').checked = status.sync_enabled !== false;

        const color = q('#ulc-sync-color');
        if (!color.firstElementChild) color.innerHTML = colorInput('#0078ff');
        setColorInput(color, rgbToHex(status.sync_color || '0 120 255'));

        q('#ulc-standby-mode').value = status.standby_mode || 'dim';
        q('#ulc-disk-color-mode').value = status.disk_color_mode || 'own';
        q('#ulc-smart-enabled').checked = status.smart_enabled !== false;
        q('#ulc-error-enabled').checked = status.error_enabled !== false;
        q('#ulc-activity-enabled').checked = status.activity_enabled !== false;

        const smartColor = q('#ulc-smart-color');
        if (!smartColor.firstElementChild) smartColor.innerHTML = colorInput('#ff8c00');
        setColorInput(smartColor, rgbToHex(status.smart_color || '255 140 0'));

        const level = q('#ulc-standby-level');
        level.value = status.standby_level || 30;
        setRangeFill(level);
        q('#ulc-standby-level-value').textContent = `${level.value}%`;
        level.closest('.ulc-inline').classList.toggle('disabled', q('#ulc-standby-mode').value !== 'dim');
    }

    /* Power LED on shutdown and reboot */

    function renderShutdown() {
        const status = state.status;

        if (q('#ulc-shutdown-card').contains(document.activeElement)) return;

        q('#ulc-shutdown-enabled').checked = Boolean(status.shutdown_blink);
        q('#ulc-shutdown-effect').value = status.shutdown_effect || 'blink';

        const color = q('#ulc-shutdown-color');
        if (!color.firstElementChild) color.innerHTML = colorInput('#ff8c00');
        setColorInput(color, rgbToHex(status.shutdown_color || '255 140 0'));
    }

    function saveShutdown() {
        const hex = normalizeHex(q('#ulc-shutdown-color input[type="text"]').value);

        if (!hex) {
            toast(t('colors.invalid'), 'error');
            return;
        }

        return run(
            () => api({
                action: 'shutdown',
                enabled: q('#ulc-shutdown-enabled').checked ? '1' : '0',
                effect: q('#ulc-shutdown-effect').value,
                ...hexToRgb(hex)
            }, true),
            t('shutdown.saved')
        );
    }

    /* Network LED by link speed (LED settings) */

    function renderNetwork() {
        const status = state.status;
        const current = q('#ulc-speed-current');
        const speedOn = Boolean(status.netdev_speed_enabled);

        current.textContent = status.netdev_speed > 0
            ? t('display.speed_current', { speed: speedLabel(status.netdev_speed) })
            : t('display.speed_unknown');

        if (q('#ulc-network-card').contains(document.activeElement)) return;

        q('#ulc-speed-enabled').checked = speedOn;
        q('#ulc-speed-colors').hidden = !speedOn;
        current.hidden = !speedOn;

        LINK_SPEEDS.forEach(speed => {
            const saved = (status.netdev_speed_colors || {})[speed];
            setColorInput(q(`[data-speed="${speed}"]`), saved ? rgbToHex(saved) : SPEED_DEFAULTS[speed]);
        });
    }

    function saveNetwork() {
        const speeds = {};

        for (const speed of LINK_SPEEDS) {
            const speedHex = normalizeHex(q(`[data-speed="${speed}"] input[type="text"]`).value);

            if (!speedHex) {
                toast(t('colors.invalid'), 'error');
                return;
            }

            const c = hexToRgb(speedHex);
            speeds[`speed_${speed}`] = `${c.r} ${c.g} ${c.b}`;
        }

        return run(
            () => api({
                action: 'netdev_speed',
                speed_enabled: q('#ulc-speed-enabled').checked ? '1' : '0',
                ...speeds
            }, true),
            t('display.netdev_saved')
        );
    }

    function saveDisplay() {
        const hex = normalizeHex(q('#ulc-sync-color input[type="text"]').value);
        const smartHex = normalizeHex(q('#ulc-smart-color input[type="text"]').value);

        if (!hex || !smartHex) {
            toast(t('colors.invalid'), 'error');
            return;
        }

        const smart = hexToRgb(smartHex);

        return run(
            () => api({
                action: 'status_display',
                disk_color_mode: q('#ulc-disk-color-mode').value,
                smart_enabled: q('#ulc-smart-enabled').checked ? '1' : '0',
                error_enabled: q('#ulc-error-enabled').checked ? '1' : '0',
                activity_enabled: q('#ulc-activity-enabled').checked ? '1' : '0',
                smart_r: smart.r,
                smart_g: smart.g,
                smart_b: smart.b,
                sync_enabled: q('#ulc-sync-enabled').checked ? '1' : '0',
                standby_mode: q('#ulc-standby-mode').value,
                standby_level: q('#ulc-standby-level').value,
                ...hexToRgb(hex)
            }, true),
            t('display.saved')
        );
    }

    const identifying = led => (state.status.identify || []).includes(led);

    function identifyButton(led) {
        const active = identifying(led);

        return `<button type="button" class="ulc-btn small ${active ? 'primary' : ''}" data-identify="${escapeHtml(led)}" title="${escapeHtml(t('identify.title'))}">
            ${icon(active ? 'reset' : 'bulb')}${escapeHtml(t(active ? 'identify.stop' : 'identify.button'))}
        </button>`;
    }

    // The LED blinks white for 30 s; afterwards the backend restores it on its own.
    async function identify(led) {
        const stop = identifying(led);

        await run(
            () => api({ action: 'identify', led, value: stop ? 'stop' : 'start' }, true),
            stop ? t('identify.stopped') : t('identify.started', { n: led.slice(4) })
        );

        clearTimeout(state.identifyTimer);
        if (!stop) state.identifyTimer = setTimeout(loadStatus, 31000);
    }

    /* Unraid alerts */

    function renderAlerts() {
        const status = state.status;
        const card = q('#ulc-alert-card');

        q('#ulc-alert-badge').hidden = !status.alert_active;

        q('#ulc-alert-state').textContent = !status.alert_enabled
            ? t('alerts.state_off')
            : status.alert_count > 0
                ? t('alerts.state_active', { n: status.alert_count })
                : t('alerts.state_none');

        if (card.contains(document.activeElement)) return;

        q('#ulc-alert-enabled').checked = Boolean(status.alert_enabled);
        q('#ulc-alert-level').value = status.alert_level || 'warning';

        const color = q('#ulc-alert-color');
        if (!color.firstElementChild) color.innerHTML = colorInput('#ff3b30');
        setColorInput(color, rgbToHex(status.alert_color || '255 59 48'));
    }

    function saveAlerts() {
        const hex = normalizeHex(q('#ulc-alert-color input[type="text"]').value);

        if (!hex) {
            toast(t('colors.invalid'), 'error');
            return;
        }

        return run(
            () => api({
                action: 'alerts',
                enabled: q('#ulc-alert-enabled').checked ? '1' : '0',
                level: q('#ulc-alert-level').value,
                ...hexToRgb(hex)
            }, true),
            t('alerts.saved')
        );
    }

    async function setMode(mode) {
        await run(
            () => api({ action: 'mode', value: mode }, true),
            mode === 'status' ? t('mode.status_on') : t('mode.manual_on')
        );

        await loadStatus();
    }

    function applyErrorColor(hex) {
        const value = normalizeHex(hex);

        if (!value) {
            toast(t('colors.invalid'), 'error');
            renderColors();
            return;
        }

        state.status.disk_error_color = Object.values(hexToRgb(value)).join(' ');

        return run(
            () => api({ action: 'error_color', ...hexToRgb(value) }, true),
            t('colors.error_saved')
        );
    }

    /*
     * ---------------------------------------------------------
     * Actions
     * ---------------------------------------------------------
     */

    // Show a change in the preview right away; the next refresh confirms it.
    function preview(leds, change) {
        for (const led of leds) {
            if (state.leds[led]) Object.assign(state.leds[led], change);
        }

        qa('.ulc-led[data-led]').forEach(element => paintLed(element, element.dataset.led));
    }

    const globalLevel = () => levelFromPercent(Number(q('#ulc-brightness').value) || DEFAULTS.brightness);

    function applyColor(leds, hex) {
        const value = normalizeHex(hex);

        if (!value) {
            toast(t('colors.invalid'), 'error');
            renderColors();
            return;
        }

        preview(leds, { color: value });

        return run(
            () => write(leds, 'color', hexToRgb(value)),
            t('colors.applied')
        );
    }

    async function setEffect(leds, effect) {
        const speed = SPEEDS[state.speed];
        const dark = leds.filter(led => (state.leds[led]?.brightness || 0) === 0);

        if (effect === 'off') {
            await write(leds, 'off');
            return;
        }

        // breath/blink and "static" need a lit LED to be visible.
        if (dark.length) {
            await write(dark, 'brightness', { value: globalLevel() });
        }

        if (effect === 'static') {
            await write(leds, 'stop');
        } else {
            const [on, off] = speed[effect];
            await write(leds, effect, { on, off });
        }
    }

    // Rainbow/temperature: one effect process at a time, with the current settings.
    function applySoftwareEffect(leds, effect, name) {
        return run(
            () => api({
                action: 'fx',
                value: effect,
                led: leds.join(','),
                speed: state.speed,
                reverse: q('#ulc-direction').value === 'backward' ? '1' : '0',
                idle: q('#ulc-idle').checked ? '1' : '0'
            }, true),
            t('effect.applied', { name })
        );
    }

    function applyEffect(leds, effect) {
        const name = effectName(effect);

        if (EFFECTS.find(e => e.id === effect)?.software) {
            return applySoftwareEffect(leds, effect, name);
        }

        preview(leds, effect === 'off'
            ? { brightness: 0 }
            : { effect: effect === 'static' ? 'none' : effect });

        return run(() => setEffect(leds, effect), t('effect.applied', { name }));
    }

    function applyBrightness(leds, percent) {
        const value = levelFromPercent(percent);

        preview(leds, { brightness: value });

        return run(
            () => write(leds, 'brightness', { value }),
            t('brightness.applied', { percent })
        );
    }

    async function testLeds() {
        const button = q('#ulc-test');
        const before = JSON.parse(JSON.stringify(state.leds));
        const leds = state.order.filter(led => before[led]?.brightness > 0);

        if (!leds.length) {
            toast(t('test.all_off'), 'error');
            return;
        }

        button.disabled = true;

        await run(async () => {
            await write(leds, 'blink', { on: 150, off: 150 });
            preview(leds, { effect: 'blink' });
            await sleep(3000);

            // Put every LED back to the effect it had before.
            const groups = { none: [], breath: [], blink: [] };
            leds.forEach(led => (groups[before[led].effect] || groups.none).push(led));

            await write(groups.none, 'stop');

            for (const effect of ['breath', 'blink']) {
                const [on, off] = SPEEDS[state.speed][effect];
                await write(groups[effect], effect, { on, off });
            }
        }, t('test.done'));

        button.disabled = false;
    }

    function resetDefaults() {
        if (!window.confirm(t('reset.confirm'))) {
            return;
        }

        return run(async () => {
            const colors = [
                [['power'], DEFAULTS.power],
                [['netdev'], DEFAULTS.netdev],
                [disks(), DEFAULTS.disk]
            ];

            for (const [leds, hex] of colors) {
                await write(leds.filter(led => state.order.includes(led)), 'color', hexToRgb(hex));
            }

            await write(state.order, 'stop');
            await write(state.order, 'brightness', { value: levelFromPercent(DEFAULTS.brightness) });
        }, t('reset.done'));
    }

    /*
     * ---------------------------------------------------------
     * Navigation
     * ---------------------------------------------------------
     */

    // The effects view shows the same two cards as the overview.
    function showView(view) {
        qa('[data-nav]').forEach(button => button.classList.toggle('active', button.dataset.nav === view));
        qa('.ulc-view').forEach(section => section.classList.toggle('active', section.dataset.view === view));

        const inEffects = view === 'effects';

        q(inEffects ? '[data-slot="effects-view"]' : '[data-slot="effects-home"]').append(q('#ulc-effects-card'));
        q(inEffects ? '[data-slot="settings-view"]' : '[data-slot="settings-home"]').append(q('#ulc-settings-card'));
    }

    /*
     * ---------------------------------------------------------
     * Events
     * ---------------------------------------------------------
     */

    // Saves a settings card on every committed change; changes made while a save
    // is running are saved right after it.
    function autoSave(card, save) {
        let running = null;
        let again = false;

        card.addEventListener('change', async () => {
            if (running) {
                again = true;
                return;
            }
            do {
                again = false;
                running = save();
                await running;
            } while (again);
            running = null;
        });
    }

    function bindColorInputs(container, applyFor) {
        container.addEventListener('input', event => {
            const input = event.target;
            const box = input.closest('.ulc-color-input');
            if (!box) return;

            if (input.type === 'color') {
                box.querySelector('.ulc-swatch').style.setProperty('--c', input.value);
                box.querySelector('input[type="text"]').value = input.value.toUpperCase();
                return;
            }

            // A typed hex value previews as soon as it is complete (GitHub issue #30).
            const hex = input.type === 'text' ? normalizeHex(input.value) : null;
            if (hex) {
                box.querySelector('.ulc-swatch').style.setProperty('--c', hex);
                box.querySelector('input[type="color"]').value = hex;
            }
        });

        container.addEventListener('change', event => {
            const input = event.target;

            if (input.type !== 'color' && input.type !== 'text') return;
            if (!input.closest('.ulc-color-input')) return;

            applyFor(input, input.value);
        });
    }

    function bindEvents() {
        qa('[data-ulc-icon]').forEach(element => {
            element.innerHTML = icon(element.dataset.ulcIcon);
        });

        qa('[data-nav]').forEach(button => {
            button.addEventListener('click', () => showView(button.dataset.nav));
        });

        /* General */

        q('#ulc-enabled').addEventListener('change', event => {
            const on = event.target.checked;

            if (on) {
                applyBrightness(state.order, Number(q('#ulc-brightness').value) || DEFAULTS.brightness);
            } else {
                preview(state.order, { brightness: 0 });
                run(() => write(state.order, 'off'), t('all_off'));
            }
        });

        const brightness = q('#ulc-brightness');

        brightness.addEventListener('input', () => {
            state.dragging = true;
            setRangeFill(brightness);
            q('#ulc-brightness-value').textContent = `${brightness.value}%`;
        });

        brightness.addEventListener('change', async () => {
            await applyBrightness(state.order, Number(brightness.value));
            state.dragging = false;
        });

        q('#ulc-mode').addEventListener('change', event => setMode(event.target.value));

        // Like everything else on the page, these cards save every change at once
        // (a range when it is let go, a colour when it is picked or typed).
        bindColorInputs(q('#ulc-alert-color'), () => {});
        bindColorInputs(q('#ulc-sync-color'), () => {});
        bindColorInputs(q('#ulc-smart-color'), () => {});
        const speedColors = q('#ulc-speed-colors');
        speedColors.innerHTML = LINK_SPEEDS.map(speed => `
            <label>${escapeHtml(t('display.speed_color', { speed: speedLabel(speed) }))}</label>
            <div data-speed="${speed}">${colorInput(SPEED_DEFAULTS[speed])}</div>`).join('');
        bindColorInputs(speedColors, () => {});
        q('#ulc-speed-enabled').addEventListener('change', event => {
            speedColors.hidden = !event.target.checked;
            q('#ulc-speed-current').hidden = !event.target.checked;
        });

        autoSave(q('#ulc-display-card'), saveDisplay);
        autoSave(q('#ulc-network-card'), saveNetwork);

        bindColorInputs(q('#ulc-shutdown-color'), () => {});
        autoSave(q('#ulc-shutdown-card'), saveShutdown);

        // The test uses the saved colour and effect, so it follows a change made a moment ago.
        q('#ulc-shutdown-test').addEventListener('click', async () => {
            await saveShutdown();
            run(() => api({ action: 'shutdown_test' }, true), t('shutdown.test_started'));
        });
        autoSave(q('#ulc-alert-card'), saveAlerts);
        autoSave(q('#ulc-night-card'), saveSchedule);

        const standbyLevel = q('#ulc-standby-level');
        standbyLevel.addEventListener('input', () => {
            setRangeFill(standbyLevel);
            q('#ulc-standby-level-value').textContent = `${standbyLevel.value}%`;
        });
        q('#ulc-netdev-status').addEventListener('change', event => run(
            () => api({ action: 'netdev_status', value: event.target.value }, true),
            t('display.netdev_saved')
        ));

        q('#ulc-standby-mode').addEventListener('change', event => {
            standbyLevel.closest('.ulc-inline').classList.toggle('disabled', event.target.value !== 'dim');
        });

        q('#ulc-bays').addEventListener('click', event => {
            const button = event.target.closest('[data-identify]');
            if (button) identify(button.dataset.identify);

            const ack = event.target.closest('[data-smart-ack]');
            if (ack) ackSmart(ack.dataset.smartAck);
        });

        const theme = q('#ulc-theme');
        theme.value = window.UGREEN_LED_THEME || 'dark';

        theme.addEventListener('change', async () => {
            root.dataset.theme = resolveTheme(theme.value);
            window.UGREEN_LED_THEME = theme.value;

            try {
                await api({ action: 'theme', value: theme.value }, true);
                toast(t('theme.saved'));
            } catch (error) {
                toast(error.message, 'error');
            }
        });

        const dashSize = q('#ulc-dash-size');
        dashSize.value = window.UGREEN_LED_DASH_SIZE === 'full' ? 'full' : 'compact';
        dashSize.addEventListener('change', () => run(
            () => api({ action: 'dash_size', value: dashSize.value }, true),
            t('theme.dash_saved')
        ));

        const language = q('#ulc-language');

        // A language shows up once it has translations.
        [...language.options].forEach(option => {
            if (option.value !== 'auto' && !Object.keys(TEXTS[option.value] || {}).length) option.remove();
        });
        language.value = window.UGREEN_LED_LANG_SETTING || 'auto';

        // The page is built in one language, so a new one needs a reload.
        language.addEventListener('change', async () => {
            try {
                await api({ action: 'lang', value: language.value }, true);
                window.location.reload();
            } catch (error) {
                toast(error.message, 'error');
            }
        });

        /* Night mode */

        const nightBrightness = q('#ulc-night-brightness');

        nightBrightness.addEventListener('input', () => {
            setRangeFill(nightBrightness);
            q('#ulc-night-brightness-value').textContent = `${nightBrightness.value}%`;
        });

        q('#ulc-night-action').addEventListener('change', renderNight);

        /* Colours */

        qa('[data-tab]').forEach(button => {
            button.addEventListener('click', () => {
                state.tab = button.dataset.tab;
                qa('[data-tab]').forEach(tab => tab.classList.toggle('active', tab === button));
                buildColors();
            });
        });

        const colors = q('#ulc-colors');

        const applyRow = (key, value) => {
            const row = colors._rows.find(r => r.key === key);

            if (!row || row.soon) return;
            if (key === 'error') return applyErrorColor(value);
            if (row.leds.length) return applyColor(row.leds, value);
        };

        bindColorInputs(colors, (input, value) => applyRow(input.closest('[data-row]').dataset.row, value));

        colors.addEventListener('click', event => {
            const button = event.target.closest('[data-reset]');
            if (!button || button.disabled) return;

            const key = button.closest('[data-row]').dataset.row;
            const row = colors._rows.find(r => r.key === key);
            if (row) applyRow(key, row.def);
        });

        /* Effects */

        q('#ulc-effects').addEventListener('click', event => {
            const button = event.target.closest('[data-effect]');
            if (!button || button.disabled) return;

            applyEffect(targetLeds(state.target), button.dataset.effect);
        });

        q('#ulc-target').addEventListener('change', event => {
            state.target = event.target.value;
            renderEffects();
        });

        const speed = q('#ulc-speed');

        speed.addEventListener('input', () => {
            setRangeFill(speed);
            q('#ulc-speed-value').textContent = t(SPEEDS[speed.value].label);
        });

        speed.addEventListener('change', () => {
            state.speed = Number(speed.value);

            try {
                localStorage.setItem('ulc-speed', speed.value);
            } catch (error) {
                // Storage may be blocked; the speed then just isn't remembered.
            }

            const leds = targetLeds(state.target);
            const effect = currentEffect(leds);

            if (['breath', 'blink', 'rainbow'].includes(effect)) {
                applyEffect(leds, effect);
            } else {
                render();
            }
        });

        // Direction and idle-only belong to the running rainbow/temperature effect.
        const reapplySoftwareEffect = () => {
            const leds = targetLeds(state.target);
            const effect = currentEffect(leds);

            if (effect === 'rainbow' || effect === 'temperature') applyEffect(leds, effect);
        };

        q('#ulc-direction').addEventListener('change', reapplySoftwareEffect);
        q('#ulc-idle').addEventListener('change', reapplySoftwareEffect);

        /* Preview */

        q('#ulc-test').addEventListener('click', testLeds);
        q('#ulc-reset').addEventListener('click', resetDefaults);

        /* Per-LED tables */

        for (const table of [q('#ulc-led-table'), q('#ulc-bay-table')]) {
            bindColorInputs(table, (input, value) => applyColor([input.closest('[data-led-row]').dataset.ledRow], value));

            table.addEventListener('input', event => {
                if (event.target.matches('[data-brightness]')) setRangeFill(event.target);
            });

            table.addEventListener('change', event => {
                const row = event.target.closest('[data-led-row]');
                if (!row) return;

                const led = row.dataset.ledRow;

                if (event.target.matches('[data-brightness]')) {
                    applyBrightness([led], Number(event.target.value));
                } else if (event.target.matches('[data-led-effect]')) {
                    applyEffect([led], event.target.value);
                }
            });
        }
    }

    /*
     * ---------------------------------------------------------
     * Init
     * ---------------------------------------------------------
     */

    // Static texts of the page; data-i18n-html entries are our own trusted markup.
    function translatePage() {
        qa('[data-i18n]').forEach(element => {
            element.textContent = t(element.dataset.i18n);
        });
        qa('[data-i18n-html]').forEach(element => {
            element.innerHTML = t(element.dataset.i18nHtml);
        });
    }

    async function init() {
        translatePage();

        try {
            const saved = localStorage.getItem('ulc-speed');
            if (saved !== null && SPEEDS[Number(saved)]) state.speed = Number(saved);
        } catch (error) {
            // No storage: keep the default speed.
        }

        const speed = q('#ulc-speed');
        speed.value = state.speed;
        q('#ulc-speed-value').textContent = t(SPEEDS[state.speed].label);

        qa('input[type="range"]').forEach(setRangeFill);

        buildEffects();
        bindEvents();

        await loadStatus();
        await refresh();
        await loadSchedule();

        setInterval(() => {
            if (!document.hidden && !state.busy && !state.dragging) refresh();
        }, 4000);

        setInterval(() => {
            if (!document.hidden) loadStatus();
        }, 30000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
