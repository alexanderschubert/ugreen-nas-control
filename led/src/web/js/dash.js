// Dashboard tile: the case picture with live LED colours and each bay's
// temperature or state, plus mode / night / alert in the tile header.
(() => {
    'use strict';

    const API = '/plugins/ugreen-nas-control/led/api.php';
    const LANG = ['de', 'en', 'es'].includes(window.UGREEN_LED_LANG) ? window.UGREEN_LED_LANG : 'en';
    const TEXTS = window.ULC_I18N || { de: {}, en: {}, es: {} };

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

    const state = { status: {}, leds: {}, bays: [], layout: '' };

    async function get(action) {
        const response = await fetch(`${API}?action=${action}`, { credentials: 'same-origin' });
        const data = await response.json();

        if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
        return data;
    }

    function rgbToHex(value) {
        const parts = String(value).trim().split(/\s+/).map(Number);
        if (parts.length < 3 || parts.some(Number.isNaN)) return '#ffffff';
        return '#' + parts.slice(0, 3).map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('');
    }

    // "2.5G", "1G", "100M": the negotiated link speed next to the LAN LED.
    const speedShort = mbps => mbps >= 1000 ? `${mbps / 1000}G` : mbps > 0 ? `${mbps}M` : '';

    // An RJ45 socket: the network ports next to the LAN LED.
    const PORT_ICON_DOWN = '<svg class="ulc-port-ico" viewBox="0 0 20 16" aria-hidden="true"><rect x="1.5" y="2.5" width="17" height="12" rx="1.8"/><path d="M7.5 2.5V1.2h5v1.3"/><path d="M7.4 6.4l5.2 5.2M12.6 6.4l-5.2 5.2"/></svg>';
    const PORT_ICON = '<svg class="ulc-port-ico" viewBox="0 0 20 16" aria-hidden="true"><rect x="1.5" y="2.5" width="17" height="12" rx="1.8"/><path d="M7.5 2.5V1.2h5v1.3"/><path d="M5 8v4M6.6 8v4M8.2 8v4M9.8 8v4M11.4 8v4M13 8v4M14.6 8v4"/></svg>';

    const speedName = mbps => mbps >= 1000 ? `${String(mbps / 1000)} Gbit/s` : `${mbps} Mbit/s`;

    const LINK_STEPS = [10, 100, 1000, 2500, 5000, 10000];
    const STEP_DEFAULTS = { 10: '#ff3b30', 100: '#ff8c00', 1000: '#ffd60a', 2500: '#00c853', 5000: '#00c8c8', 10000: '#0078ff' };

    // Colour of a port's socket: the colour set for its speed when "by link speed" is on.
    function portColor(port) {
        if (!port.link || !state.status.netdev_speed_enabled) return '';

        const step = LINK_STEPS.filter(s => port.speed >= s).pop() || LINK_STEPS[0];
        const rgb = (state.status.netdev_speed_colors || {})[step];

        return rgb ? rgbToHex(rgb) : STEP_DEFAULTS[step];
    }

    // "eth0 10G ✕" for a port without link, "eth1 2.5G" with one; one port: just the speed.
    function paintSpeed(root) {
        const ports = state.status.network_ports || [];
        const speed = Number(state.status.netdev_speed) || 0;
        const items = ports.length > 1
            ? ports.map(port => ({
                text: speedShort(port.link ? port.speed : port.max),
                down: !port.link,
                color: portColor(port),
                title: `${port.name}: ${port.link ? speedName(port.speed) : t('fact.port_down')}`
            }))
            : speed > 0 ? [{ text: speedShort(speed), down: false, color: portColor({ link: true, speed }), title: speedName(speed) }] : [];

        root.querySelectorAll('[data-link-speed]').forEach(element => {
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

    const disks = () => (state.status.leds || []).filter(led => led.startsWith('disk'));

    function build(nas) {
        const bays = disks();
        const layout = bays.join();

        if (state.layout === layout) return;
        state.layout = layout;

        nas.style.setProperty('--bays', String(bays.length || 1));
        nas.innerHTML =
            '<div class="ulc-nas-bays">' +
            bays.map((led, i) => `
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
    }

    function paintLeds(root) {
        root.querySelectorAll('.ulc-led[data-led]').forEach(element => {
            const s = state.leds[element.dataset.led];
            if (!s) return;

            const brightness = Number(s.brightness) || 0;
            const effect = brightness > 0 ? s.effect : 'none';

            element.classList.toggle('off', brightness === 0);
            element.classList.toggle('fx-breath', effect === 'breath');
            element.classList.toggle('fx-blink', effect === 'blink');
            element.style.setProperty('--c', rgbToHex(s.color));
            element.style.setProperty('--level', (brightness / 255).toFixed(2));
            element.style.setProperty('--speed', `${(Number(s.on_ms) || 1200) + (Number(s.off_ms) || 900)}ms`);
        });
    }

    function paintBays(root) {
        root.querySelectorAll('[data-bay-info]').forEach(element => {
            const bay = state.bays.find(b => b.led === element.dataset.bayInfo);
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
                ? [t('led.bay', { n: bay.bay }), bay.slot, bay.status ? t(`disk.${bay.status}`) : ''].filter(Boolean).join(' · ')
                : '';
        });
    }

    function paintHeader(online) {
        const line = document.getElementById('ulc-dash-state');
        if (!line) return;

        if (!online) {
            line.textContent = t('offline');
            return;
        }

        const parts = [state.status.mode === 'status' ? t('mode.status') : t('mode.manual')];
        if (state.status.night) parts.push(t('head.night'));

        line.innerHTML = '';
        line.append(parts.join(' · '));

        if (state.status.alert_active) {
            const alert = document.createElement('span');
            alert.className = 'ulc-dash-alert';
            alert.textContent = ` · ${t('head.alert')}`;
            line.append(alert);
        }
    }

    async function loadSlow(root) {
        try {
            [state.status, { bays: state.bays }] = await Promise.all([get('status'), get('bays')]);
            build(root.querySelector('[data-nas]'));
            paintHeader(true);
            paintBays(root);
            paintLeds(root);
            paintSpeed(root);
        } catch (error) {
            paintHeader(false);
        }
    }

    async function loadLeds(root) {
        try {
            state.leds = (await get('all')).leds || {};
            paintLeds(root);
        } catch (error) {
            // The next round tries again; the header shows offline after loadSlow fails.
        }
    }

    async function init() {
        const root = document.getElementById('ulc-dash');
        if (!root) return;

        root.dataset.theme = resolveTheme(window.UGREEN_LED_THEME);
        root.dataset.size = window.UGREEN_LED_DASH_SIZE === 'full' ? 'full' : 'compact';

        const settings = document.getElementById('ulc-dash-settings');
        if (settings) settings.title = t('dash.settings');

        await loadSlow(root);
        await loadLeds(root);

        setInterval(() => { if (!document.hidden) loadLeds(root); }, 10000);
        setInterval(() => { if (!document.hidden) loadSlow(root); }, 30000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
