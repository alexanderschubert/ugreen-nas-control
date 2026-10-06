// Dashboard tile: fan speeds, CPU / disk / NVMe temperatures, and the fan mode
// (or an emergency) in the tile header.
(() => {
    'use strict';

    const API = '/plugins/ugreen-nas-control/api.php';
    const LANG = window.UGREEN_NAS_LANG === 'en' ? 'en' : 'de';
    const TEXTS = window.UNC_I18N || { de: {}, en: {} };

    const t = (key, vars = {}) => String(TEXTS[LANG][key] ?? TEXTS.de[key] ?? key)
        .replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));

    const FAN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 2 0 3 2 2 4l-4 3.5M14 12c4 0 7 1 7 4 0 2-2 3-4 2l-3.5-4M12 14c0 4-1 7-4 7-2 0-3-2-2-4l4-3.5M10 12c-4 0-7-1-7-4 0-2 2-3 4-2l3.5 4"/></svg>';

    const LIMITS = { cpu: [70, 85], disk: [45, 50], nvme: [60, 70] };

    const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);

    const hottest = list => list.reduce((max, v) => v != null && (max == null || v > max) ? v : max, null);

    function tempRow(label, value, kind) {
        const [warm, hot] = LIMITS[kind];
        const level = value == null ? '' : value >= hot ? 'hot' : value >= warm ? 'warm' : '';
        const width = value == null ? 0 : Math.max(2, Math.min(100, value));

        return `
            <div class="unc-temp ${level}">
                <span>${escapeHtml(label)}</span>
                <span class="unc-meter"><span style="width:${width}%"></span></span>
                <strong>${value == null ? '–' : `${value} °C`}</strong>
            </div>`;
    }

    function paint(root, data) {
        const fans = data.fans || [];
        const cases = fans.filter(f => f.role === 'case');

        root.querySelector('[data-fans]').innerHTML = fans.map(fan => `
            <div class="unc-fan ${fan.rpm === 0 ? 'stopped' : ''}" title="${escapeHtml(t('fan.speed', { pct: fan.pct }))}">
                <span class="unc-fan-icon ${fan.rpm > 0 ? 'spin' : ''}" style="--spin:${Math.max(0.3, 2400 / Math.max(fan.rpm, 1)).toFixed(2)}s">${FAN}</span>
                <small class="unc-muted">${escapeHtml(fan.role === 'cpu' ? t('fan.cpu') : t('fan.case', { n: cases.indexOf(fan) + 1 }))}</small>
                <span class="unc-fan-rpm">${fan.rpm > 0 ? `${fan.rpm} <small>${escapeHtml(t('fan.rpm'))}</small>` : escapeHtml(t('fan.stopped'))}</span>
            </div>`).join('');

        const s = data.sensors || {};
        const rows = [tempRow(t('temps.cpu'), s.cpu, 'cpu')];
        const disk = hottest((s.disks || []).filter(d => d.hdd).map(d => d.temp));
        const nvme = hottest((s.nvme || []).map(n => n.temp));

        if (disk != null) rows.push(tempRow(t('dash.disk'), disk, 'disk'));
        if (nvme != null) rows.push(tempRow(t('dash.nvme'), nvme, 'nvme'));

        root.querySelector('[data-temps]').innerHTML = rows.join('');
    }

    function paintHeader(data) {
        const line = document.getElementById('unc-dash-state');
        if (!line) return;

        line.innerHTML = '';

        if (!data) {
            line.textContent = t('head.offline');
            return;
        }

        const failsafe = data.running && data.daemon?.failsafe;
        line.append(t(`mode.${data.settings?.mode || 'standard'}`));

        if (failsafe || data.chip_error) {
            const alert = document.createElement('span');
            alert.className = 'unc-dash-alert';
            alert.textContent = ` · ${failsafe ? t('warn.failsafe') : t('warn.chip')}`;
            line.append(alert);
        }
    }

    async function load(root) {
        try {
            const response = await fetch(`${API}?action=status`, { credentials: 'same-origin' });
            const data = await response.json();

            if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
            paint(root, data);
            paintHeader(data);
        } catch (error) {
            paintHeader(null);
        }
    }

    function init() {
        const root = document.getElementById('unc-dash');
        if (!root) return;

        const settings = document.getElementById('unc-dash-settings');
        if (settings) settings.title = t('dash.settings');

        load(root);
        setInterval(() => { if (!document.hidden) load(root); }, 5000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
