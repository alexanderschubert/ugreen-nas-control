(() => {
    'use strict';

    const API = '/plugins/ugreen-nas-control/api.php';
    const root = document.getElementById('unc');

    if (!root) return;

    const LANG = window.UGREEN_NAS_LANG === 'en' ? 'en' : 'de';
    const TEXTS = window.UNC_I18N || { de: {}, en: {} };

    // German fills gaps in other languages.
    const t = (key, vars = {}) => String(TEXTS[LANG][key] ?? TEXTS.de[key] ?? key)
        .replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));

    const q = selector => root.querySelector(selector);
    const qa = selector => [...root.querySelectorAll(selector)];

    /*
     * ---------------------------------------------------------
     * Static data
     * ---------------------------------------------------------
     */

    const ICONS = {
        home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/>',
        curve: '<path d="M3 3v18h18"/><path d="M7 16c3 0 4-8 7-8s3 4 6 4"/>',
        shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
        info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
        reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
        fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 2 0 3 2 2 4l-4 3.5M14 12c4 0 7 1 7 4 0 2-2 3-4 2l-3.5-4M12 14c0 4-1 7-4 7-2 0-3-2-2-4l4-3.5M10 12c-4 0-7-1-7-4 0-2 2-3 4-2l3.5 4"/>',
        chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
        bios: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3M7 9h4M7 13h10"/>',
        leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19 13 11"/>',
        gauge: '<path d="M4 18a9 9 0 1 1 16 0"/><path d="m12 13 4-5"/>',
        flame: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-13-3 2-5 5-5 8-1-1-2-2-2-4-1 2-2 4-2 7 0 5 3 9 7 9z"/>',
        max: '<path d="M12 3v12M7 8l5-5 5 5M5 21h14"/>',
        box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
        ram: '<rect x="2" y="6" width="20" height="10" rx="1.5"/><path d="M5 9h3v4H5zM10.5 9h3v4h-3zM16 9h3v4h-3zM6 16v3M10 16v3M14 16v3M18 16v3"/>',
        m2: '<rect x="2" y="8" width="20" height="8" rx="1.5"/><path d="M6 10.5h4v3H6zM12 10.5h3v3h-3z"/><circle cx="19" cy="12" r="1.2"/>',
        pcie: '<rect x="3" y="4" width="18" height="11" rx="1.5"/><path d="M7 15v4M10 15v4M13 15v4M16 15v4M3 20h18"/><path d="M7 8h5v3H7z"/>',
        drives: '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/>',
        net: '<rect x="6" y="3" width="12" height="9" rx="1.5"/><path d="M12 12v4M5 16h14v5H5zM9 18.5h.01M12 18.5h.01M15 18.5h.01"/>',
        bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
        pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'
    };

    const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

    const MODES = [
        { id: 'bios', icon: 'bios' },
        { id: 'quiet', icon: 'leaf' },
        { id: 'standard', icon: 'gauge' },
        { id: 'performance', icon: 'flame' },
        { id: 'full', icon: 'max' },
        { id: 'custom', icon: 'pen' }
    ];

    // Axis of the curve charts; the case fans see disk temperatures.
    const CHART = {
        cpu: { min: 20, max: 100 },
        case: { min: 20, max: 70 }
    };

    // Colour steps of the temperature bars: [warm, hot] in °C.
    const LIMITS = {
        cpu: [70, 85],
        disk: [45, 50],
        nvme: [60, 70],
        other: [55, 70]
    };

    const state = {
        data: null,
        curves: { cpu: [], case: [] },
        curvesDirty: false,
        safetyDirty: false,
        busy: false,
        hw: null,
        hwError: false,
        view: 'overview'
    };

    /*
     * ---------------------------------------------------------
     * Helpers
     * ---------------------------------------------------------
     */

    const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);

    const deg = value => value == null ? '–' : `${value} °C`;

    function setRangeFill(input) {
        const min = Number(input.min) || 0;
        const max = Number(input.max) || 100;
        input.style.setProperty('--fill', `${(input.value - min) / (max - min) * 100}%`);
    }

    function toast(message, type = 'success') {
        const element = q('#unc-toast');

        element.textContent = message;
        element.className = `unc-toast show ${type}`;

        if (type === 'error') console.error('[UGREEN NAS]', message);

        clearTimeout(element._timer);
        element._timer = setTimeout(() => {
            element.className = 'unc-toast';
        }, type === 'error' ? 6000 : 2500);
    }

    async function api(params, post = false) {
        const options = { credentials: 'same-origin' };
        let url = API;

        if (post) {
            options.method = 'POST';
            // Unraid rejects POSTs without the WebGUI csrf_token before api.php runs.
            options.body = new URLSearchParams({
                ...params,
                csrf_token: window.UGREEN_NAS_CSRF_TOKEN || ''
            });
        } else {
            url += '?' + new URLSearchParams(params);
        }

        const response = await fetch(url, options);
        let data;

        try {
            data = await response.json();
        } catch (error) {
            throw new Error(`HTTP ${response.status}`);
        }

        if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
        return data;
    }

    async function run(action, success) {
        state.busy = true;
        try {
            await action();
            if (success) toast(success);
        } catch (error) {
            toast(error.message, 'error');
        }
        state.busy = false;
        await load();
    }

    const parseCurve = text => String(text || '').split(',').map(part => {
        const [temp, pct] = part.split(':').map(Number);
        return { temp, pct };
    }).filter(p => Number.isFinite(p.temp) && Number.isFinite(p.pct));

    const curveText = points => points.map(p => `${p.temp}:${p.pct}`).join(',');

    // Speed for a temperature, linear between the points (as the daemon does it).
    function curveAt(points, temp) {
        if (!points.length) return 100;
        if (temp <= points[0].temp) return points[0].pct;
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1];
            const b = points[i];
            if (temp <= b.temp) {
                return b.temp === a.temp ? b.pct : Math.round(a.pct + (temp - a.temp) / (b.temp - a.temp) * (b.pct - a.pct));
            }
        }
        return points[points.length - 1].pct;
    }

    // Curves of the active mode: a preset, or the saved custom curves.
    function activeCurves() {
        const data = state.data || {};
        const settings = data.settings || {};
        const presets = data.presets || {};
        const preset = presets[settings.mode] || presets.standard || ['', ''];

        if (settings.mode === 'custom') {
            return {
                cpu: parseCurve(settings.cpu_curve || preset[0]),
                case: parseCurve(settings.case_curve || preset[1])
            };
        }
        if (settings.mode === 'bios' || settings.mode === 'full') {
            return { cpu: parseCurve(presets.standard?.[0]), case: parseCurve(presets.standard?.[1]) };
        }
        return { cpu: parseCurve(preset[0]), case: parseCurve(preset[1]) };
    }

    const fanName = (fan, fans) => fan.role === 'cpu'
        ? t('fan.cpu')
        : t('fan.case', { n: fans.filter(f => f.role === 'case').indexOf(fan) + 1 });

    /*
     * ---------------------------------------------------------
     * Rendering
     * ---------------------------------------------------------
     */

    function renderHead() {
        const data = state.data;
        const online = Boolean(data && data.ok);
        const badge = q('#unc-online');

        badge.textContent = online ? t('head.online') : t('head.offline');
        badge.classList.toggle('online', online);
        badge.classList.toggle('offline', !online);

        if (!online) return;

        qa('[data-model]').forEach(element => {
            element.textContent = data.info?.model || 'UGREEN NAS';
        });

        q('#unc-banner').hidden = !data.chip;
        q('#unc-chip').textContent = data.chip ? data.chip.replace('IT8613', 'ITE IT8613E').replace('IT5571', 'ITE IT5571') : '';

        q('#unc-chip-error').hidden = !data.chip_error;
        q('#unc-chip-error-text').textContent = data.chip_error || '';

        const daemon = data.running ? data.daemon : null;
        q('#unc-failsafe').hidden = !daemon?.failsafe;
        q('#unc-failsafe-text').textContent = daemon?.failsafe ? t(`failsafe.${daemon.failsafe}`) : '';

        const stalled = (daemon?.stalled || []).map(id => {
            const fan = (data.fans || []).find(f => f.id === id);
            return fan ? fanName(fan, data.fans) : id;
        });
        q('#unc-stalled').hidden = !stalled.length;
        q('#unc-stalled-text').textContent = stalled.length ? t('stalled.text', { list: stalled.join(', ') }) : '';
    }

    function renderFans() {
        const data = state.data;
        const fans = data.fans || [];

        q('#unc-fans').innerHTML = fans.map(fan => `
            <div class="unc-fan ${fan.rpm === 0 ? 'stopped' : ''}">
                <span class="unc-fan-icon ${fan.rpm > 0 ? 'spin' : ''}" style="--spin:${Math.max(0.3, 2400 / Math.max(fan.rpm, 1)).toFixed(2)}s">${icon('fan')}</span>
                <div>
                    <strong>${escapeHtml(fanName(fan, fans))}</strong>
                    <span class="unc-fan-rpm">${fan.rpm > 0 ? `${fan.rpm} <small>${escapeHtml(t('fan.rpm'))}</small>` : escapeHtml(t('fan.stopped'))}</span>
                    <span class="unc-meter"><span style="width:${fan.pct ?? 0}%"></span></span>
                    <small class="unc-muted">${escapeHtml(fan.error ? t('fan.error') : fan.pct == null ? t('fan.auto') : t('fan.speed', { pct: fan.pct }))}</small>
                </div>
            </div>`).join('');

        const mode = data.settings?.mode;
        const daemon = data.running ? data.daemon : null;
        let follow = [];

        if (!data.running) {
            follow = [t('follow.stopped')];
        } else if (mode === 'bios') {
            follow = [t('follow.bios')];
        } else if (daemon && !daemon.failsafe && mode !== 'full') {
            follow.push(t('follow.cpu', { temp: deg(daemon.cpu_temp) }));
            follow.push(daemon.case_from ? t(`follow.${daemon.case_from}`, { temp: deg(daemon.case_temp) }) : t('follow.none'));
        }
        q('#unc-follow').textContent = follow.join(' ');
    }

    function renderModes() {
        const mode = state.data?.settings?.mode || 'standard';

        q('#unc-modes').innerHTML = MODES.map(m => `
            <button type="button" class="unc-effect ${m.id === mode ? 'active' : ''}" data-mode="${m.id}" ${state.data?.chip ? '' : 'disabled'}>
                ${icon(m.icon)}
                <strong>${escapeHtml(t(`mode.${m.id}`))}</strong>
                <small>${escapeHtml(t(`mode.${m.id}_sub`))}</small>
            </button>`).join('');

        q('#unc-mode-hint').textContent = mode === 'bios' ? t('mode.hint_bios') : t('mode.hint_curve');
    }

    function tempRow(label, value, kind, extra = '') {
        const [warm, hot] = LIMITS[kind] || LIMITS.other;
        const level = value == null ? '' : value >= hot ? 'hot' : value >= warm ? 'warm' : '';
        const width = value == null ? 0 : Math.max(2, Math.min(100, value));

        return `
            <div class="unc-temp ${level}">
                <span>${escapeHtml(label)}${extra ? ` <small class="unc-muted">${escapeHtml(extra)}</small>` : ''}</span>
                <span class="unc-meter"><span style="width:${width}%"></span></span>
                <strong>${escapeHtml(deg(value))}</strong>
            </div>`;
    }

    function renderTemps() {
        const data = state.data;
        const s = data.sensors || {};
        const rows = [];

        if (s.cpu != null) rows.push(tempRow(t('temps.cpu'), s.cpu, 'cpu'));

        const cores = (s.cpu_cores || []).map(c => c.temp).filter(v => v != null);
        if (cores.length) rows.push(tempRow(t('temps.cores'), Math.max(...cores), 'cpu'));

        if (s.board != null) rows.push(tempRow(t('temps.board'), s.board, 'other'));

        (data.chip_temps || []).forEach((temp, i) => {
            if (temp != null) rows.push(tempRow(t('temps.chip', { n: i + 1 }), temp, 'other'));
        });

        (s.nvme || []).forEach(n => rows.push(tempRow(n.name, n.temp, 'nvme', n.label || '')));

        (s.disks || []).forEach(d => {
            if (d.standby) {
                rows.push(`
                    <div class="unc-temp standby">
                        <span>${escapeHtml(d.name)} <small class="unc-muted">${escapeHtml(d.device)}</small></span>
                        <span class="unc-meter"><span style="width:0"></span></span>
                        <strong>${escapeHtml(t('temps.standby'))}</strong>
                    </div>`);
            } else if (d.temp != null) {
                rows.push(tempRow(d.name, d.temp, d.hdd ? 'disk' : 'nvme', d.device));
            }
        });

        q('#unc-temps').innerHTML = rows.join('') || `<p class="unc-muted">${escapeHtml(t('temps.none'))}</p>`;
    }

    function uptime(seconds) {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor(seconds % 86400 / 3600);
        const m = Math.floor(seconds % 3600 / 60);
        return d > 0 ? t('uptime.days', { d, h }) : t('uptime.hours', { h, m });
    }

    function renderSystem() {
        const data = state.data;
        const info = data.info || {};
        const facts = [
            ['system.model', info.model],
            ['system.bios', [info.bios, info.bios_date].filter(Boolean).join(' · ')],
            ['system.cpu', [info.cpu, info.threads ? t('system.threads', { n: info.threads }) : ''].filter(Boolean).join(' · ')],
            ['system.memory', info.memory_kb ? `${Math.round(info.memory_kb / 1048576)} GB` : ''],
            ['system.unraid', info.unraid],
            ['system.kernel', info.kernel],
            ['system.uptime', info.uptime ? uptime(info.uptime) : ''],
            ['system.chip', data.chip ? data.chip.replace('IT8613', 'ITE IT8613E').replace('IT5571', 'ITE IT5571') : data.chip_error ? '–' : '']
        ];

        q('#unc-system').innerHTML = facts
            .filter(([, value]) => value)
            .map(([key, value]) => `<dt>${escapeHtml(t(key))}</dt><dd>${escapeHtml(value)}</dd>`)
            .join('');
    }

    /* Curves */

    function drawChart(kind) {
        const box = q(`[data-curve="${kind}"]`);
        const svg = box.querySelector('[data-chart]');
        const points = state.curves[kind];
        const { min, max } = CHART[kind];
        const W = 320;
        const H = 200;
        const L = 34;
        const R = 10;
        const T = 10;
        const B = 26;
        const x = temp => L + (Math.max(min, Math.min(max, temp)) - min) / (max - min) * (W - L - R);
        const y = pct => T + (1 - pct / 100) * (H - T - B);

        let grid = '';
        for (let pct = 0; pct <= 100; pct += 25) {
            grid += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(pct)}" y2="${y(pct)}"/>`;
            grid += `<text class="axis" x="${L - 6}" y="${y(pct) + 4}" text-anchor="end">${pct}%</text>`;
        }
        const step = kind === 'cpu' ? 20 : 10;
        for (let temp = min; temp <= max; temp += step) {
            grid += `<text class="axis" x="${x(temp)}" y="${H - 8}" text-anchor="middle">${temp}°</text>`;
        }

        // The line runs flat to both edges, as the daemon holds the end values.
        const line = points.length
            ? [`${x(min)},${y(points[0].pct)}`, ...points.map(p => `${x(p.temp)},${y(p.pct)}`), `${x(max)},${y(points[points.length - 1].pct)}`].join(' ')
            : '';

        const daemon = state.data?.daemon;
        const now = kind === 'cpu' ? state.data?.sensors?.cpu : daemon?.case_temp;
        let marker = '';
        if (now != null) {
            const pct = curveAt(points, now);
            marker = `<line class="now" x1="${x(now)}" x2="${x(now)}" y1="${T}" y2="${H - B}"/>
                <circle class="now-dot" cx="${x(now)}" cy="${y(pct)}" r="4"/>
                <text class="now-text" x="${Math.min(x(now) + 6, W - R - 70)}" y="${T + 12}">${escapeHtml(t('curves.now'))} ${now}° → ${pct}%</text>`;
        }

        svg.innerHTML = `${grid}
            <polyline class="curve" points="${line}"/>
            ${points.map(p => `<circle class="point" cx="${x(p.temp)}" cy="${y(p.pct)}" r="4"/>`).join('')}
            ${marker}`;
    }

    function buildPoints(kind) {
        const box = q(`[data-curve="${kind}"] [data-points]`);

        box.innerHTML = state.curves[kind].map((p, i) => `
            <div class="unc-point">
                <span class="unc-muted">${i + 1}</span>
                <label><input type="number" min="0" max="120" step="1" value="${p.temp}" data-i="${i}" data-field="temp"> °C</label>
                <span class="unc-muted">→</span>
                <label><input type="number" min="0" max="100" step="1" value="${p.pct}" data-i="${i}" data-field="pct"> %</label>
            </div>`).join('');

        box.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => {
                const value = Number(input.value);
                if (!Number.isFinite(value)) return;
                state.curves[kind][Number(input.dataset.i)][input.dataset.field] = value;
                state.curvesDirty = true;
                drawChart(kind);
            });
        });
    }

    function renderCurves() {
        // Rebuilding would take the focus out of a field the user just clicked into.
        if (!state.curvesDirty && !q('.unc-curves').contains(document.activeElement)) {
            state.curves = activeCurves();
            buildPoints('cpu');
            buildPoints('case');
        }
        drawChart('cpu');
        drawChart('case');
    }

    const validCurve = points => points.length >= 2 && points.every((p, i) =>
        Number.isInteger(p.temp) && Number.isInteger(p.pct) &&
        p.temp >= 0 && p.temp <= 120 && p.pct >= 0 && p.pct <= 100 &&
        (i === 0 || p.temp > points[i - 1].temp));

    /* Safety */

    const SAFETY = [
        { id: 'min', key: 'min_pct', unit: '%' },
        { id: 'cpu-crit', key: 'cpu_crit', unit: '°C' },
        { id: 'disk-crit', key: 'disk_crit', unit: '°C' },
        { id: 'nvme-offset', key: 'nvme_offset', unit: '°C' }
    ];

    function showSafetyValue(field) {
        const input = q(`#unc-${field.id}`);
        setRangeFill(input);
        q(`#unc-${field.id}-value`).textContent = `${input.value} ${field.unit}`;
    }

    function renderSafety() {
        if (state.safetyDirty) return;
        const settings = state.data?.settings || {};

        SAFETY.forEach(field => {
            if (settings[field.key] != null) q(`#unc-${field.id}`).value = settings[field.key];
            showSafetyValue(field);
        });
        q('#unc-stall-notify').checked = settings.stall_notify !== false;
    }

    function renderLeds() {
        const led = state.data.led || {};
        const input = q('#unc-led-enabled');
        const blocker = q('#unc-led-blocker');

        input.checked = Boolean(led.enabled);
        // Off is always possible; on only without a blocker.
        input.disabled = !led.enabled && Boolean(led.blocker);
        q('#unc-led-row').classList.toggle('unc-disabled', input.disabled);
        q('#unc-led-state').textContent = t(led.enabled ? 'leds.on' : 'leds.off');
        q('#unc-led-open').hidden = !led.enabled;

        blocker.hidden = !led.blocker;
        blocker.textContent = led.blocker
            ? t(`leds.blocker_${led.blocker}`, { model: led.model || '?' })
            : '';
    }

    function render() {
        renderHead();
        if (!state.data?.ok) return;

        renderFans();
        renderModes();
        renderTemps();
        renderSystem();
        renderCurves();
        renderSafety();
        renderLeds();
    }

    /*
     * ---------------------------------------------------------
     * Case: tiles, front, rear and inside
     * ---------------------------------------------------------
     */

    // Drive sizes are sold in powers of ten.
    function fmtSize(bytes) {
        if (!bytes) return '';
        const tb = bytes / 1e12;
        if (tb >= 1) return `${tb >= 10 ? Math.round(tb) : Math.round(tb * 10) / 10} TB`;
        return `${Math.round(bytes / 1e9)} GB`;
    }

    const fmtRam = mb => mb >= 1024 ? `${Math.round(mb / 1024)} GB` : `${mb} MB`;

    function tempClass(temp, kind) {
        if (temp == null) return '';
        const [warm, hot] = LIMITS[kind];
        return temp >= hot ? 'hot' : temp >= warm ? 'warm' : 'ok';
    }

    const tempBadge = (temp, kind) => temp == null ? '' : `<b class="unc-t ${tempClass(temp, kind)}">${temp} °C</b>`;

    function speedText(mbit) {
        if (mbit >= 1000) return `${mbit / 1000} Gbit/s`;
        return `${mbit} Mbit/s`;
    }

    function renderCaseTiles(hw) {
        const info = state.data?.info || {};
        const ramMB = hw.memory.reduce((sum, m) => sum + m.size_mb, 0);
        const modules = hw.memory.filter(m => m.size_mb > 0);
        const bays = hw.bays || [];
        const filled = bays.filter(b => b.present);
        const driveBytes = filled.reduce((sum, b) => sum + b.size_bytes, 0);
        const hottestBay = Math.max(-1, ...filled.map(b => b.temp ?? -1));
        const nvmeBytes = hw.nvme.reduce((sum, n) => sum + n.size_bytes, 0);
        const hottestNvme = Math.max(-1, ...hw.nvme.map(n => n.temp ?? -1));
        const links = hw.net.filter(n => n.link);
        const cpuTemp = state.data?.sensors?.cpu;

        const tiles = [
            ['cpu', t('tile.cpu'), (info.cpu || '').replace(/\(R\)|\(TM\)|CPU|^\d+th Gen\s+Intel\s*/gi, '').replace(/\s+/g, ' ').trim() || '–',
                [info.threads ? t('system.threads', { n: info.threads }) : '', cpuTemp != null ? deg(cpuTemp) : ''].filter(Boolean).join(' · ')],
            ['ram', t('tile.ram'), ramMB ? `${fmtRam(ramMB)} ${modules[0]?.type || ''}`.trim() : '–',
                modules.length ? t('tile.ram_sub', { n: modules.length, size: fmtRam(modules[0].size_mb), speed: modules[0].configured_mt || modules[0].speed_mt }) : ''],
            ['drives', t('tile.drives'), bays.length ? t('tile.drives_val', { n: filled.length, total: bays.length }) : '–',
                [fmtSize(driveBytes), hottestBay >= 0 ? t('tile.hottest', { t: deg(hottestBay) }) : ''].filter(Boolean).join(' · ')],
            ['nvme', t('tile.nvme'), t('tile.nvme_val', { n: hw.nvme.length }),
                [fmtSize(nvmeBytes), hottestNvme >= 0 ? t('tile.hottest', { t: deg(hottestNvme) }) : ''].filter(Boolean).join(' · ')],
            ['net', t('tile.net'), links.length ? links.map(n => speedText(n.speed_mbit)).join(' · ') : t('tile.net_none'),
                hw.net.map(n => `${n.name}${n.link ? '' : ' ✕'}`).join(' · ')]
        ];

        const tileIcon = { cpu: 'chip', ram: 'ram', drives: 'drives', nvme: 'm2', net: 'net' };

        q('#unc-case-tiles').innerHTML = tiles.map(([id, title, value, sub]) => `
            <div class="unc-tile ${id}">
                <span class="unc-tile-ico">${icon(tileIcon[id])}</span>
                <small>${escapeHtml(title)}</small>
                <strong>${escapeHtml(value)}</strong>
                <span>${escapeHtml(sub)}</span>
            </div>`).join('');
    }

    // Port drawings, after the real sockets.
    const SOCKET = {
        usbc: '<svg viewBox="0 0 40 18"><rect x="3" y="3" width="34" height="12" rx="6" class="shell"/><rect x="9" y="7" width="22" height="4" rx="2" class="tongue"/></svg>',
        usba: '<svg viewBox="0 0 40 20"><rect x="2" y="2" width="36" height="16" rx="2" class="shell"/><rect x="6" y="8" width="28" height="5" class="tongue blue"/></svg>',
        usb2: '<svg viewBox="0 0 40 20"><rect x="2" y="2" width="36" height="16" rx="2" class="shell"/><rect x="6" y="8" width="28" height="5" class="tongue"/></svg>',
        hdmi: '<svg viewBox="0 0 48 20"><path d="M3 3h42v8l-5 6H8l-5-6z" class="shell"/><rect x="9" y="7" width="30" height="4" class="tongue"/></svg>',
        ac: '<svg viewBox="0 0 56 34"><rect x="2" y="2" width="52" height="30" rx="3" class="shell"/><rect x="14" y="8" width="8" height="12" rx="1" class="tongue"/><rect x="34" y="8" width="8" height="12" rx="1" class="tongue"/><rect x="24" y="22" width="8" height="6" rx="1" class="tongue"/></svg>'
    };

    const rj45 = (link, speed) => `
        <svg viewBox="0 0 56 52" class="rj ${link ? 'up' : ''}">
            <rect x="2" y="2" width="52" height="48" rx="3" class="shell"/>
            <rect x="9" y="14" width="38" height="28" rx="2" class="tongue"/>
            <path d="M14 14v8M20 14v8M26 14v8M32 14v8M38 14v8M44 14v8" class="pins"/>
            <rect x="6" y="5" width="10" height="5" rx="1" class="led link"/>
            <rect x="40" y="5" width="10" height="5" rx="1" class="led act ${speed >= 10000 ? 'fast' : ''}"/>
        </svg>`;

    const socket = (kind, label, extra = '') => `
        <div class="unc-socket ${kind}">
            ${SOCKET[kind]}
            <small>${escapeHtml(label)}</small>
            ${extra}
        </div>`;

    function bayHtml(bay) {
        const no = String(bay.bay).padStart(2, '0');
        if (!bay.present) {
            return `
                <div class="unc-nbay empty">
                    <span class="no">${no}</span>
                    <span class="info empty">${escapeHtml(t('case.empty'))}</span>
                    <span class="knob"></span>
                    <span class="bar"></span>
                </div>`;
        }
        const kind = bay.hdd ? 'disk' : 'nvme';
        const state = bay.standby ? 'standby' : tempClass(bay.temp, kind) || 'ok';
        const info = bay.standby ? t('case.standby') : (bay.temp != null ? `${bay.temp}°` : '–');
        return `
            <div class="unc-nbay" title="${escapeHtml([bay.role, bay.id || bay.model].filter(Boolean).join(' · '))}">
                <span class="no">${no}</span>
                <span class="info ${state}">${escapeHtml(info)}</span>
                <span class="role">${escapeHtml(bay.role || bay.device)}</span>
                <span class="size">${escapeHtml([fmtSize(bay.size_bytes), t(bay.hdd ? 'case.hdd' : 'case.ssd')].join(' · '))}</span>
                <span class="knob"></span>
                <span class="bar ${state}"></span>
            </div>`;
    }

    function renderFront(hw) {
        const net = hw.net || [];
        const lan = net.some(n => n.link);
        const speeds = net.map(n => `<span>${n.link ? speedText(n.speed_mbit) : '✕'}</span>`).join('');

        q('#unc-front').innerHTML = `
            <div class="unc-nas">
                <div class="unc-nas-bays">${(hw.bays || []).map(bayHtml).join('')}</div>
                <div class="unc-nas-front">
                    <span class="unc-pled power"></span><span class="lbl">${escapeHtml(t('case.power'))}</span>
                    <span class="unc-pled lan ${lan ? 'on' : ''}"></span><span class="lbl">LAN</span>
                    <span class="speeds">${speeds}</span>
                    <span class="spacer"></span>
                    <span class="unc-front-ports">
                        ${socket('usbc', 'TB4')}
                        ${socket('usbc', 'TB4')}
                        ${socket('usba', '10G')}
                    </span>
                    <b class="brand">UGREEN</b>
                </div>
            </div>`;
    }

    function renderDriveList(hw) {
        const rows = (hw.bays || []).filter(b => b.present).map(b => `
            <tr>
                <td>${String(b.bay).padStart(2, '0')}</td>
                <td>${escapeHtml(b.role || '–')} <small class="unc-muted">${escapeHtml(b.device)}</small></td>
                <td class="unc-id">${escapeHtml(b.id || b.model || '–')}</td>
                <td>${escapeHtml([fmtSize(b.size_bytes), t(b.hdd ? 'case.hdd' : 'case.ssd')].join(' · '))}</td>
                <td>${b.standby ? escapeHtml(t('case.standby')) : tempBadge(b.temp, b.hdd ? 'disk' : 'nvme') || '–'}</td>
            </tr>`).join('');

        q('#unc-drive-list').innerHTML = rows ? `
            <table class="unc-table">
                <thead><tr>
                    <th>${escapeHtml(t('case.col_bay'))}</th>
                    <th>${escapeHtml(t('case.col_role'))}</th>
                    <th>${escapeHtml(t('case.col_disk'))}</th>
                    <th>${escapeHtml(t('case.col_size'))}</th>
                    <th>${escapeHtml(t('case.col_temp'))}</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>` : `<p class="unc-muted">${escapeHtml(t('case.empty'))}</p>`;
    }

    function renderRear(hw) {
        const lan = n => {
            const p = hw.net[n];
            const up = Boolean(p && p.link);
            const label = `${t('case.lan', { n: n + 1 })}${p ? ` · ${p.name}` : ''}`;
            return `
                <div class="unc-socket rj45 ${up ? 'up' : ''}">
                    ${rj45(up, p ? p.speed_mbit : 0)}
                    <small>${escapeHtml(label)}</small>
                    <em>${escapeHtml(up ? speedText(p.speed_mbit) : t('case.no_link'))}</em>
                </div>`;
        };

        q('#unc-rear').innerHTML = `
            <div class="unc-nas-rear">
                <div class="unc-rear-ports">
                    ${socket('ac', t('case.ac'))}
                    ${socket('hdmi', t('case.hdmi'))}
                    ${lan(0)}
                    ${lan(1)}
                    ${socket('usba', t('case.usb_a'))}
                    ${socket('usb2', t('case.usb2'))}
                    ${socket('usb2', t('case.usb2'))}
                </div>
            </div>`;
    }

    function nvmeHtml(n) {
        return `
            <div class="unc-ssd">
                <strong><span class="unc-slot-ico">${icon('m2')}</span>${escapeHtml(n.model || n.id)}</strong>
                <span>${escapeHtml([n.id, fmtSize(n.size_bytes)].filter(Boolean).join(' · '))}</span>
                ${tempBadge(n.temp, 'nvme')}
            </div>`;
    }

    function renderInside(hw) {
        const ramSlots = hw.memory.map((m, i) => {
            const slot = t('case.ram_slot', { n: i + 1 });
            if (!m.size_mb) {
                return `<div class="unc-slot ram empty"><div class="unc-slot-head"><span class="unc-slot-ico">${icon('ram')}</span><small>${escapeHtml(slot)}</small></div><span>${escapeHtml(t('case.empty'))}</span></div>`;
            }
            const speed = m.configured_mt && m.configured_mt !== m.speed_mt
                ? t('case.running_at', { speed: m.configured_mt, max: m.speed_mt })
                : `${m.speed_mt} MT/s`;
            return `
                <div class="unc-slot ram">
                    <div class="unc-slot-head"><span class="unc-slot-ico">${icon('ram')}</span><small>${escapeHtml(slot)}</small></div>
                    <strong>${escapeHtml(`${fmtRam(m.size_mb)} ${m.type}`)}</strong>
                    <span>${escapeHtml(speed)}</span>
                    <span class="unc-model">${escapeHtml([m.manufacturer, m.part_number].filter(Boolean).join(' · '))}</span>
                </div>`;
        }).join('');

        const m2 = n => {
            const ssd = hw.nvme.find(d => d.slot === `m2-${n}`);
            return `
                <div class="unc-slot m2 ${ssd ? '' : 'empty'}">
                    <div class="unc-slot-head"><span class="unc-slot-ico">${icon('m2')}</span><small>${escapeHtml(t('case.m2_slot', { n }))}</small></div>
                    ${ssd ? nvmeHtml(ssd) : `<span>${escapeHtml(t('case.empty'))}</span>`}
                </div>`;
        };

        const card = hw.nvme.filter(d => d.slot === 'pcie');
        const pcie = `
            <div class="unc-slot pcie ${card.length ? '' : 'empty'}">
                <div class="unc-slot-head"><span class="unc-slot-ico">${icon('pcie')}</span><small>${escapeHtml(t('case.pcie_slot'))}</small></div>
                ${card.length
                    ? `<span class="unc-model">${escapeHtml(t('case.pcie_card', { n: card.length }))}</span>${card.map(nvmeHtml).join('')}`
                    : `<span>${escapeHtml(t('case.free'))}</span>`}
            </div>`;

        q('#unc-inside').innerHTML = `
            <div class="unc-board-col">${ramSlots}</div>
            <div class="unc-board-col">${m2(1)}${m2(2)}</div>
            <div class="unc-board-col">${pcie}</div>`;
    }

    function renderCase() {
        if (!state.hw) {
            const text = t(state.hwError ? 'case.error' : 'case.loading');
            ['#unc-case-tiles', '#unc-front', '#unc-drive-list', '#unc-rear', '#unc-inside'].forEach(id => {
                q(id).innerHTML = `<p class="unc-muted">${escapeHtml(text)}</p>`;
            });
            return;
        }
        renderCaseTiles(state.hw);
        renderFront(state.hw);
        renderDriveList(state.hw);
        renderRear(state.hw);
        renderInside(state.hw);
    }

    async function loadHardware() {
        try {
            state.hw = await api({ action: 'hardware' });
            state.hwError = false;
        } catch (error) {
            state.hw = null;
            state.hwError = true;
        }
        renderCase();
    }

    /*
     * ---------------------------------------------------------
     * Loading
     * ---------------------------------------------------------
     */

    async function load() {
        try {
            state.data = await api({ action: 'status' });
        } catch (error) {
            state.data = null;
        }
        render();
    }

    /*
     * ---------------------------------------------------------
     * Events
     * ---------------------------------------------------------
     */

    function showView(view) {
        state.view = view;
        if (view === 'case') loadHardware();
        qa('[data-nav]').forEach(button => button.classList.toggle('active', button.dataset.nav === view));
        qa('.unc-view').forEach(section => section.classList.toggle('active', section.dataset.view === view));
    }

    function bindEvents() {
        qa('[data-unc-icon]').forEach(element => {
            element.innerHTML = icon(element.dataset.uncIcon);
        });

        qa('[data-nav]').forEach(button => {
            button.addEventListener('click', () => showView(button.dataset.nav));
        });

        q('#unc-modes').addEventListener('click', event => {
            const button = event.target.closest('[data-mode]');
            if (!button || button.disabled) return;

            const mode = button.dataset.mode;
            run(() => api({ action: 'mode', value: mode }, true), t('mode.saved', { mode: t(`mode.${mode}`) }));
        });

        q('#unc-curve-load').addEventListener('click', () => {
            const mode = q('#unc-curve-preset').value;
            const preset = state.data?.presets?.[mode];
            if (!preset) return;

            state.curves = { cpu: parseCurve(preset[0]), case: parseCurve(preset[1]) };
            state.curvesDirty = true;
            buildPoints('cpu');
            buildPoints('case');
            renderCurves();
            toast(t('curves.loaded', { mode: t(`mode.${mode}`) }));
        });

        q('#unc-curves-save').addEventListener('click', () => {
            const { cpu, case: cs } = state.curves;

            if (!validCurve(cpu) || !validCurve(cs)) {
                toast(t('curves.invalid'), 'error');
                return;
            }

            state.curvesDirty = false;
            run(() => api({ action: 'curves', cpu_curve: curveText(cpu), case_curve: curveText(cs) }, true), t('curves.saved'));
        });

        SAFETY.forEach(field => {
            q(`#unc-${field.id}`).addEventListener('input', () => {
                state.safetyDirty = true;
                showSafetyValue(field);
            });
        });
        q('#unc-stall-notify').addEventListener('change', () => {
            state.safetyDirty = true;
        });

        q('#unc-safety-save').addEventListener('click', () => {
            const values = Object.fromEntries(SAFETY.map(field => [field.key, q(`#unc-${field.id}`).value]));

            state.safetyDirty = false;
            run(() => api({
                action: 'safety',
                ...values,
                stall_notify: q('#unc-stall-notify').checked ? '1' : '0'
            }, true), t('safety.saved'));
        });

        q('#unc-led-enabled').addEventListener('change', event => {
            const on = event.target.checked;

            run(() => api({ action: 'led', value: on ? 'on' : 'off' }, true), t(on ? 'leds.switched_on' : 'leds.switched_off'));
        });

        q('#unc-language').addEventListener('change', async event => {
            try {
                await api({ action: 'lang', value: event.target.value }, true);
                location.reload();
            } catch (error) {
                toast(error.message, 'error');
            }
        });
    }

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
        bindEvents();

        q('#unc-version').textContent = window.UGREEN_NAS_VERSION || '';
        q('#unc-language').value = window.UGREEN_NAS_LANG_SETTING || 'auto';

        await load();

        setInterval(() => {
            if (!document.hidden && !state.busy) load();
            if (!document.hidden && state.view === 'case' && !state.busy) loadHardware();
        }, 3000);
    }

    init();
})();
