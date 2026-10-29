// Dashboard tile: fans with what drives them, CPU / disk / NVMe temperatures, drives, NVMe and LEDs.
// The tile header carries the essentials (mode, fan speeds, hottest temperature, alerts), so they
// stay visible when Unraid collapses the tile.
(() => {
    'use strict';

    const API = '/plugins/ugreen-nas-control/api.php';
    const POLL_MS = 15000;
    const LANG = ['de', 'en', 'es'].includes(window.UGREEN_NAS_LANG) ? window.UGREEN_NAS_LANG : 'de';
    const TEXTS = window.UNC_I18N || { de: {}, en: {} };

    const t = (key, vars = {}) => String(TEXTS[LANG]?.[key] ?? TEXTS.en?.[key] ?? TEXTS.de[key] ?? key)
        .replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));

    const FAN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 2 0 3 2 2 4l-4 3.5M14 12c4 0 7 1 7 4 0 2-2 3-4 2l-3.5-4M12 14c0 4-1 7-4 7-2 0-3-2-2-4l4-3.5M10 12c-4 0-7-1-7-4 0-2 2-3 4-2l3.5 4"/></svg>';

    const LIMITS = { cpu: [70, 85], disk: [45, 50], nvme: [60, 70] };

    const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);

    // Fan icons turn by script, not by CSS animation: a CSS duration change or a re-render
    // would restart the angle. The angle lives per fan id; only the speed follows the rpm.
    const fanSpin = new Map();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let fanLast = 0;
    let fanFrame = 0;

    function fanTick(now) {
        const dt = Math.min(0.1, (now - fanLast) / 1000);
        let moving = false;

        fanLast = now;
        fanSpin.forEach(fan => {
            if (fan.rpm > 0) {
                fan.angle = (fan.angle + dt * 360 / Math.max(0.3, 2400 / fan.rpm)) % 360;
                moving = true;
            }
        });
        document.querySelectorAll('.unc-fan-icon[data-fan]').forEach(el => {
            el.style.transform = `rotate(${fanSpin.get(el.dataset.fan)?.angle || 0}deg)`;
        });
        fanFrame = moving ? requestAnimationFrame(fanTick) : 0;
    }

    // Icon markup for a fan; keeps its current angle and sets the new speed.
    function fanIcon(fan, svg) {
        const state = fanSpin.get(fan.id) || { angle: 0, rpm: 0 };

        state.rpm = reduceMotion.matches ? 0 : fan.rpm;
        fanSpin.set(fan.id, state);

        if (state.rpm > 0 && !fanFrame) {
            fanLast = performance.now();
            fanFrame = requestAnimationFrame(fanTick);
        }
        return `<span class="unc-fan-icon" data-fan="${escapeHtml(fan.id)}" style="transform:rotate(${state.angle}deg)">${svg}</span>`;
    }

    const hottest = list => list.reduce((max, v) => v != null && (max == null || v > max) ? v : max, null);

    function tempRow(label, value, kind) {
        const [warm, hot] = LIMITS[kind];
        const level = value == null ? '' : value >= hot ? 'hot' : value >= warm ? 'warm' : '';
        const width = value == null ? 0 : Math.max(2, Math.min(100, value));

        return `
            <div class="unc-temp ${level}">
                <span>${escapeHtml(label)}</span>
                <strong>${value == null ? '–' : `${value} °C`}</strong>
                <span class="unc-meter"><span style="width:${width}%"></span></span>
            </div>`;
    }

    const fanName = (fan, cases) => fan.role === 'cpu' ? t('fan.cpu') : cases.length === 1 ? t('fan.case_one') : t('fan.case', { n: cases.indexOf(fan) + 1 });

    // CPU, disk and NVMe temperatures as [label, value, kind] (disk and NVMe only when present).
    function temperatures(data) {
        const s = data.sensors || {};
        const rows = [[t('temps.cpu'), s.cpu, 'cpu']];
        const disk = hottest((s.disks || []).filter(d => d.hdd).map(d => d.temp));
        const nvme = hottest((s.nvme || []).map(n => n.temp));

        if (disk != null) rows.push([t('dash.disk'), disk, 'disk']);
        if (nvme != null) rows.push([t('dash.nvme'), nvme, 'nvme']);
        return rows;
    }

    // What a fan follows right now and the speed that results, e.g. "CPU 51 °C → 13 %". Empty without a curve.
    function fanDriver(fan, data, rows) {
        const daemon = data.running ? data.daemon : null;
        const target = daemon?.failsafe ? 100 : daemon?.targets?.[fan.id];
        if (target == null) return '';

        const temp = kind => rows.find(r => r[2] === kind)?.[1];
        const from = fan.role === 'cpu' || daemon.case_driver === 'cpu' ? ['cpu', daemon.cpu_temp]
            : daemon.case_from === 'disk' ? ['disk', daemon.case_temp]
            : daemon.case_from === 'nvme' ? ['nvme', daemon.case_temp] : null;
        const name = from && from[1] != null ? rows.find(r => r[2] === from[0])?.[0] : '';
        const label = name && !daemon.failsafe ? `${name} ${from[1]} °C ` : '';

        return `${label}→ ${target} %`;
    }

    function paint(root, data) {
        const fans = data.fans || [];
        const cases = fans.filter(f => f.role === 'case');
        const rows = temperatures(data);

        root.querySelector('[data-fans]').innerHTML = fans.map(fan => `
            <div class="unc-fan ${fan.rpm === 0 ? 'stopped' : ''}" title="${escapeHtml(fan.error ? t('fan.error') : fan.pct == null ? t('fan.auto') : t('fan.speed', { pct: fan.pct }))}">
                ${fanIcon(fan, FAN)}
                <div>
                    <small class="unc-muted">${escapeHtml(fanName(fan, cases))}</small>
                    <span class="unc-fan-rpm">${fan.rpm > 0 ? `${fan.rpm} <small>${escapeHtml(t('fan.rpm'))}</small>` : escapeHtml(t('fan.stopped'))}</span>
                    <small class="unc-muted">${escapeHtml(fanDriver(fan, data, rows))}</small>
                </div>
            </div>`).join('');

        // An emergency or a stopped fan: a red line above the fans, linking to the Safety / Fans page.
        const alerts = alertTexts(data);
        const alert = root.querySelector('[data-alert]');

        alert.hidden = !alerts.length;
        alert.innerHTML = alerts.map(text => `<div>${escapeHtml(text)}</div>`).join('')
            + (alerts.length ? `<a href="/Settings/UGREENNASControl">${escapeHtml(t('dash.settings'))}</a>` : '');

        root.querySelector('[data-temps]').innerHTML = rows.map(r => tempRow(...r)).join('');
    }

    // Names of the fans the daemon reports as stalled (0 rpm although driven).
    function stalledNames(data) {
        const fans = data.fans || [];
        const cases = fans.filter(f => f.role === 'case');

        return ((data.running ? data.daemon?.stalled : null) || []).map(id => fans.find(f => f.id === id)).filter(Boolean).map(f => fanName(f, cases));
    }

    // Emergency (fail-safe) and stopped fans, as texts.
    function alertTexts(data) {
        const daemon = data.running ? data.daemon : null;
        const stalled = stalledNames(data);

        return [daemon?.failsafe ? `${t('warn.failsafe')} ${t(`failsafe.${daemon.failsafe}`)}` : '', stalled.length ? t('stalled.text', { list: stalled.join(', ') }) : ''].filter(Boolean);
    }

    // Drive bays like the Disk Location plugin: one chip per bay, details on hover.
    const size = bytes => bytes >= 1e12 ? `${Math.round(bytes / 1e11) / 10} TB` : `${Math.round(bytes / 1e9)} GB`;

    function bayChip(bay) {
        const no = bay.bay;
        if (!bay.present) return `<span class="unc-chip empty"><b>${no}</b></span>`;

        const [warm, hot] = bay.hdd ? LIMITS.disk : LIMITS.nvme;
        const level = bay.standby ? 'standby' : bay.temp == null ? 'ok' : bay.temp >= hot ? 'hot' : bay.temp >= warm ? 'warm' : 'ok';
        const state = bay.standby ? t('case.standby') : bay.temp != null ? `${bay.temp} °C` : '–';
        const lines = [
            state,
            `${bay.role || ''} ${bay.device} · ${size(bay.size_bytes)} ${t(bay.hdd ? 'case.hdd' : 'case.ssd')}`.trim(),
            bay.model,
            bay.id
        ].filter(Boolean);

        return `<span class="unc-chip ${level}" data-lines="${escapeHtml(JSON.stringify(lines))}"><b>${no}</b></span>`;
    }

    // What an SSD is for in Unraid: the boot SSD gets the Unraid mark, pool and cache members a stack, array disks a drive.
    const UNRAID = '<svg viewBox="0 0 24 24" aria-hidden="true" class="unc-mark"><rect width="24" height="24" rx="6" fill="#f15a2c"/><path d="M7.5 6.5v6.2a4.5 4.5 0 0 0 9 0V6.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>';
    const GLYPH = {
        pool: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.300 8-3V6M4 12v6c0 1.700 3.600 3 8 3s8-1.300 8-3v-6"/></svg>',
        drive: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h.01M11 15h6"/></svg>',
        m2: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="8" width="20" height="8" rx="1.500"/><path d="M6 10.500h4v3H6zM12 10.500h3v3h-3z"/><circle cx="19" cy="12" r="1.200"/></svg>'
    };

    function ssdRoleText(role) {
        if (role === 'cache') return t('nvme.role_cache');
        if (/^parity\d?$/.test(role)) return t('nvme.role_parity');

        const array = role.match(/^disk(\d+)$/);
        return array ? t('nvme.role_array', { n: array[1] }) : t('nvme.role', { name: role });
    }

    function ssdUse(ssd) {
        if (ssd.boot) return { icon: UNRAID, text: t('nvme.boot') };
        if (!ssd.role) return { icon: GLYPH.m2, text: '' };
        const array = /^(parity\d?|disk\d+)$/.test(ssd.role);
        return { icon: array ? GLYPH.drive : GLYPH.pool, text: ssdRoleText(ssd.role) };
    }

    // A titled row of chips (shared by the drive bays and the NVMe SSDs). Hovering a chip puts its
    // details into the subtitle.
    function paintChips(box, title, subtitle, chips) {
        box.hidden = !chips.length;
        if (!chips.length) {
            box.innerHTML = '';
            return;
        }

        box.innerHTML = `
            <div class="unc-bays-head"><strong>${escapeHtml(title)}</strong><small class="unc-muted" data-sub>${escapeHtml(subtitle)}</small></div>
            <div class="unc-chips">${chips.join('')}</div>`;

        const sub = box.querySelector('[data-sub]');
        const show = text => {
            sub.textContent = text;
            sub.title = text === subtitle ? '' : text;
        };
        box.querySelectorAll('.unc-chip').forEach(chip => {
            chip.addEventListener('mouseenter', () => {
                const lines = chip.dataset.lines ? JSON.parse(chip.dataset.lines) : [];
                show(lines.length ? lines.join(' · ') : subtitle);
            });
            chip.addEventListener('mouseleave', () => show(subtitle));
        });
    }

    function nvmeChip(label, ssd, pcie = true) {
        if (!ssd) return `<span class="unc-chip empty ico"><b>${escapeHtml(label)}</b></span>`;

        const use = ssdUse(ssd);
        const [warm, hot] = LIMITS.nvme;
        const level = ssd.temp == null ? 'ok' : ssd.temp >= hot ? 'hot' : ssd.temp >= warm ? 'warm' : 'ok';
        const slot = ssd.slot === 'system' ? t('case.sys_slot') : ssd.slot === 'pcie' && pcie ? t('case.pcie_slot') : ssd.slot === 'm2' ? 'M.2' : t('case.m2_slot', { n: ssd.slot === 'pcie' ? '?' : ssd.slot.replace('m2-', '') });
        const lines = [
            ssd.temp != null ? `${ssd.temp} °C` : '–',
            use.text,
            `${ssd.id} · ${size(ssd.size_bytes)} · ${slot}`,
            ssd.model
        ].filter(Boolean);

        return `<span class="unc-chip ${level} ico" data-lines="${escapeHtml(JSON.stringify(lines))}">${use.icon}<b>${escapeHtml(label)}</b></span>`;
    }

    function paintDrives(root, hw) {
        const bays = hw?.bays || [];
        paintChips(
            root.querySelector('[data-bays]'),
            t('dash.drives'),
            t('dash.bays_used', { n: bays.filter(b => b.present).length, total: bays.length }),
            bays.map(bayChip)
        );

        // Slots and cards are only known for the two supported models.
        if (!/^(DXP6800|DXP4800.*GT)/.test(hw?.model || '')) {
            paintChips(root.querySelector('[data-nvme]'), '', '', []);
            return;
        }

        // The two M.2 slots first (empty ones shown), then the SSDs on a card in the PCIe slot.
        const ssds = hw?.nvme || [];
        // The DXP4800 GT has no PCIe slot: an SSD outside its two M.2 ports is not on a card.
        const pcie = !/^DXP4800 GT/.test(hw?.model || '');
        const chips = ssds.length ? [1, 2].map(n => nvmeChip(`M${n}`, ssds.find(d => d.slot === `m2-${n}`), pcie)) : [];
        // The DXP6800 Pro has an internal M.2 slot for the UGOS module as well.
        if (ssds.length && pcie) chips.push(nvmeChip('S', ssds.find(d => d.slot === 'system'), pcie));
        ssds.filter(d => d.slot === 'pcie').forEach((d, i) => chips.push(nvmeChip(`P${i + 1}`, d, pcie)));

        paintChips(root.querySelector('[data-nvme]'), t('dash.nvme_title'), t('tile.nvme_val', { n: ssds.length }), chips);
    }

    // What the LED controller shows right now: { leds, status }, or null without the LED part.
    async function fetchLeds(root) {
        const api = root.dataset.ledApi;
        if (!api) return null;

        try {
            // led/status costs the NAS over a second of CPU: once a minute. led/all draws the bars.
            const [all, status] = await Promise.all([
                window.UNCPoll.json(`${api}?action=all`, POLL_MS * 0.8).then(data => ({ ...data, leds: window.UNCLedFx.stamp(data.leds) })),
                window.UNCPoll.json(`${api}?action=status`, 55000)
            ]);
            return all.ok === false || !all.leds ? null : { leds: all.leds, status };
        } catch (error) {
            return null;
        }
    }

    // One bar per bay in the colour the LED shows, with the mode next to the title.
    function ledLineHtml(led, hw) {
        if (!led) return '';

        // The LED controller says how many bays the model has; the case layout only knows two models.
        const count = Number(led.status?.bays) || (hw?.bays || []).length || 6;
        const bars = [];
        for (let i = 1; i <= count; i++) {
            bars.push(`<i data-led="disk${i}"></i>`);
        }

        const mode = led.status?.fx ? led.status.fx : t(led.status?.mode === 'status' ? 'led.mode_status' : 'led.mode_manual');
        return `<div class="unc-ledline"><div class="unc-bays-head"><strong>${escapeHtml(t('dash.leds'))}</strong><small class="unc-muted">${escapeHtml(mode)}</small></div><div class="unc-ledrow">${bars.join('')}</div></div>`;
    }

    // The LED row goes under the drive chips, also for models without known bays.
    function paintLeds(root, hw, led) {
        const box = root.querySelector('[data-bays]');
        const html = ledLineHtml(led, hw);

        if (!box || !html) return;
        box.hidden = false;
        box.insertAdjacentHTML('beforeend', html);
        // Colour, brightness and animation come from the shared renderer (ledfx.js), from the state just read.
        box.querySelectorAll('.unc-ledrow i[data-led]').forEach(el => window.UNCLedFx.paint(el, led.leds[el.dataset.led], el.dataset.led, led.status));
    }

    // The tile header: mode and alerts, and while the tile is collapsed the essentials (fan speeds, hottest temperature).
    function paintHeader(data) {
        const line = document.getElementById('unc-dash-state');
        if (!line) return;

        line.innerHTML = '';

        if (!data) {
            line.textContent = t('head.offline');
            return;
        }

        const part = (text, className = '') => {
            const el = document.createElement('span');
            el.className = className;
            el.textContent = text;
            line.append(el);
        };
        const rpm = (data.fans || []).map(f => f.rpm || 0);
        const top = temperatures(data).reduce((max, r) => r[1] != null && (!max || r[1] > max[1]) ? r : max, null);

        const failsafe = data.running && data.daemon?.failsafe;

        // A model without fan control has no fan mode and no fan-chip fault to show.
        const model = data.info?.model || '';
        const noFan = Boolean(model) && !/^(DXP6800|DXP4800.*GT)/.test(model);

        if (!noFan) part(t(`mode.${data.settings?.mode || 'standard'}`));
        if (failsafe || (data.chip_error && !noFan)) part(` · ${failsafe ? t('warn.failsafe') : t('warn.chip')}`, 'unc-dash-alert');
        else if (stalledNames(data).length) part(` · ${stalledNames(data).join(', ')}: ${t('fan.stopped')}`, 'unc-dash-alert');
        if (rpm.length) part(` · ${rpm.join(' / ')} ${t('fan.rpm')}`, 'unc-dash-sum');
        if (top) part(` · ${top[0]} ${top[1]} °C`, 'unc-dash-sum');
        if (line.firstChild?.textContent.startsWith(' · ')) line.firstChild.textContent = line.firstChild.textContent.slice(3);
    }

    async function load(root) {
        try {
            const response = await fetch(`${API}?action=status`, { credentials: 'same-origin' });
            const data = await response.json();

            if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
            paint(root, data);
            paintHeader(data);

            // Drives and LEDs are read together and drawn in one go: drawing the drives first and adding the
            // LED row after its own request made the row vanish for a moment on every refresh.
            const [raw, led] = await Promise.all([
                // Static facts (drives, memory, NICs): once a minute.
                window.UNCPoll.json(`${API}?action=hardware`, 55000).catch(() => null),
                fetchLeds(root)
            ]);
            const hw = raw && raw.ok !== false ? raw : null;

            // Nothing changed: leave the rows alone (a hovered bay keeps its details).
            // now_ms and rx move on every read; they are not a change.
            const key = JSON.stringify([hw, led], (k, v) => k === 'now_ms' || k === 'rx' ? undefined : v);
            if (key === root.dataset.key) return;
            root.dataset.key = key;

            paintDrives(root, hw);
            paintLeds(root, hw, led);
        } catch (error) {
            paintHeader(null);
        }
    }

    // The tile draws no background of its own, so it always follows the dashboard behind it (whatever the colour
    // scheme of the settings page says): light when that page is light.
    function resolveTheme() {
        for (let el = document.body; el; el = el.parentElement) {
            const match = getComputedStyle(el).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
            if (match && (match[4] === undefined || Number(match[4]) > 0.5)) {
                const [r, g, b] = [match[1], match[2], match[3]].map(Number);
                return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? 'light' : 'dark';
            }
        }
        return 'dark';
    }

    function init() {
        const root = document.getElementById('unc-dash');
        if (!root) return;

        root.dataset.theme = resolveTheme();

        const settings = document.getElementById('unc-dash-settings');
        if (settings) settings.title = t('dash.settings');

        load(root);
        // Hidden tab: no polling at all (UNCPoll). The dashboard is often left open on a screen, so no idle pause here.
        window.UNCPoll.setIdle(Infinity);
        window.UNCPoll.every(() => load(root), POLL_MS);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
