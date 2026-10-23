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
            <div class="unc-fan ${fan.rpm === 0 ? 'stopped' : ''}" title="${escapeHtml(fan.pct == null ? t('fan.auto') : t('fan.speed', { pct: fan.pct }))}">
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

    // A titled row of chips with a detail area below it (shared by the drive bays and the NVMe SSDs).
    function paintChips(box, title, subtitle, chips) {
        if (!chips.length) {
            box.hidden = true;
            return;
        }

        box.hidden = false;
        box.innerHTML = `
            <div class="unc-bays-head"><strong>${escapeHtml(title)}</strong><small class="unc-muted">${escapeHtml(subtitle)}</small></div>
            <div class="unc-chips">${chips.join('')}</div>
            <div class="unc-bay-detail" data-detail><span class="unc-muted">${escapeHtml(t('dash.hover'))}</span></div>`;

        // The details show below the row, inside the tile: a floating tooltip is cut off by the tile's edge.
        const detail = box.querySelector('[data-detail]');
        const hint = detail.innerHTML;
        box.querySelectorAll('.unc-chip').forEach(chip => {
            chip.addEventListener('mouseenter', () => {
                const lines = chip.dataset.lines ? JSON.parse(chip.dataset.lines) : [];
                detail.innerHTML = lines.length ? lines.map(l => `<span>${escapeHtml(l)}</span>`).join('') : hint;
            });
            chip.addEventListener('mouseleave', () => { detail.innerHTML = hint; });
        });
    }

    function nvmeChip(label, ssd) {
        if (!ssd) return `<span class="unc-chip empty"><b>${escapeHtml(label)}</b></span>`;

        const [warm, hot] = LIMITS.nvme;
        const level = ssd.temp == null ? 'ok' : ssd.temp >= hot ? 'hot' : ssd.temp >= warm ? 'warm' : 'ok';
        const slot = ssd.slot === 'pcie' ? t('case.pcie_slot') : t('case.m2_slot', { n: ssd.slot.replace('m2-', '') });
        const lines = [
            ssd.temp != null ? `${ssd.temp} °C` : '–',
            `${ssd.id} · ${size(ssd.size_bytes)} · ${slot}`,
            ssd.model
        ].filter(Boolean);

        return `<span class="unc-chip ${level}" data-lines="${escapeHtml(JSON.stringify(lines))}"><b>${escapeHtml(label)}</b></span>`;
    }

    function paintDrives(root, hw) {
        const bays = hw?.bays || [];
        paintChips(
            root.querySelector('[data-bays]'),
            t('dash.drives'),
            t('dash.bays_used', { n: bays.filter(b => b.present).length, total: bays.length }),
            bays.map(bayChip)
        );

        // The two M.2 slots first (empty ones shown), then the SSDs on a card in the PCIe slot.
        const ssds = hw?.nvme || [];
        const chips = ssds.length ? [1, 2].map(n => nvmeChip(`M${n}`, ssds.find(d => d.slot === `m2-${n}`))) : [];
        ssds.filter(d => d.slot === 'pcie').forEach((d, i) => chips.push(nvmeChip(`P${i + 1}`, d)));

        paintChips(root.querySelector('[data-nvme]'), t('dash.nvme_title'), t('tile.nvme_val', { n: ssds.length }), chips);
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

            const hw = await fetch(`${API}?action=hardware`, { credentials: 'same-origin' }).then(r => r.json()).catch(() => null);
            paintDrives(root, hw && hw.ok !== false ? hw : null);
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
