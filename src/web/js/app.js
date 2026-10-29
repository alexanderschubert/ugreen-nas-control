(() => {
    'use strict';

    const API = '/plugins/ugreen-nas-control/api.php';
    const root = document.getElementById('unc');

    if (!root) return;

    const LANG = ['de', 'en', 'es'].includes(window.UGREEN_NAS_LANG) ? window.UGREEN_NAS_LANG : 'de';
    const TEXTS = window.UNC_I18N || { de: {}, en: {} };

    // English fills gaps in other languages, German after it.
    const t = (key, vars = {}) => String(TEXTS[LANG]?.[key] ?? TEXTS.en?.[key] ?? TEXTS.de[key] ?? key)
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

    root.dataset.theme = resolveTheme(window.UGREEN_NAS_THEME);

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
        gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
        bios: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3M7 9h4M7 13h10"/>',
        leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19 13 11"/>',
        gauge: '<path d="M4 18a9 9 0 1 1 16 0"/><path d="m12 13 4-5"/>',
        flame: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-13-3 2-5 5-5 8-1-1-2-2-2-4-1 2-2 4-2 7 0 5 3 9 7 9z"/>',
        max: '<path d="M12 3v12M7 8l5-5 5 5M5 21h14"/>',
        bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.300 21a1.900 1.900 0 0 0 3.400 0"/>',
        clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
        box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
        ram: '<rect x="2" y="6" width="20" height="10" rx="1.5"/><path d="M5 9h3v4H5zM10.5 9h3v4h-3zM16 9h3v4h-3zM6 16v3M10 16v3M14 16v3M18 16v3"/>',
        m2: '<rect x="2" y="8" width="20" height="8" rx="1.5"/><path d="M6 10.5h4v3H6zM12 10.5h3v3h-3z"/><circle cx="19" cy="12" r="1.2"/>',
        pcie: '<rect x="3" y="4" width="18" height="11" rx="1.5"/><path d="M7 15v4M10 15v4M13 15v4M16 15v4M3 20h18"/><path d="M7 8h5v3H7z"/>',
        drives: '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/>',
        net: '<rect x="6" y="3" width="12" height="9" rx="1.5"/><path d="M12 12v4M5 16h14v5H5zM9 18.5h.01M12 18.5h.01M15 18.5h.01"/>',
        bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
        board: '<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/><path d="M6 6h.01M18 6h.01M6 18h.01M18 18h.01"/>',
        thermo: '<path d="M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/>',
        pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
        rear: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M7 17h2M11 17h2M15 17h2"/>'
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
        caseFollows: false,
        minEdit: null,
        flowStep: null,
        calibError: '',
        // "Customize this curve" in a preset mode: the editor holds a copy and the next save switches to Custom.
        arm: false,
        curvesDirty: false,
        safetyDirty: false,
        saveError: { curves: '', safety: '' },
        edits: {},
        // What the unsaved changes on a fan page are, for the save bar.
        touched: { curves: new Set(), safety: new Set() },
        // Saved a moment ago: the bar says so until the next edit.
        saved: { curves: false, safety: false },
        busy: false,
        hw: null,
        hwError: false,
        view: 'overview',
        nav: 'overview',
        leds: null,
        ledMode: null,
        ledSchedule: null
    };

    /*
     * ---------------------------------------------------------
     * Helpers
     * ---------------------------------------------------------
     */

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

    const deg = value => value == null ? '–' : `${value} °C`;

    const chipName = name => String(name || '').replace('IT8613', 'ITE IT8613E').replace('IT5571', 'ITE IT5571');

    function setRangeFill(input) {
        const min = Number(input.min) || 0;
        const max = Number(input.max) || 100;
        input.style.setProperty('--fill', `${(input.value - min) / (max - min) * 100}%`);
    }

    /*
     * ---------------------------------------------------------
     * Components: one render function and one CSS family (.unc-<name> in app.css) each. Pages call these and never
     * repeat their markup. Static markup in UGREENNASControl.page holds a placeholder instead,
     * <span data-unc="<name>" data-unc-<param>="…">; mountStatic() swaps it for the component at start. Attributes
     * without the data-unc prefix (id, data-nav, hidden…) go to the component's main element.
     *
     * cardHead    — card title row: icon, title, actions on the right — every card of the app, Sensors groups (cardhead)
     * sectionHead — h3 inside a card, optional action beside it — Fans (mode, curves, for all curves), About (sechead)
     * pill        — chip with a tone (ok warn bad accent violet plain), optional icon/sub text, button via tag — title badges, controller chips, sensor badges and state, drive role, LED chip
     * btn         — button: secondary (default), primary or small, optional icon — save bars, presets, measure, card head actions (btn)
     * linkBtn     — ghost button, text only — measure again, navLink
     * navLink     — linkBtn to a page of the sidebar — Overview, Fans (lowest speed)
     * switchRow   — toggle with title and hint, the hint may be filled later by id — Fans (case helps CPU), Safety, Settings, LEDs (switch)
     * rangeField  — slider and its value box with unit; derived: no slider, a calculated value — Fans (lowest speed), Safety limits and offset (range)
     * saveBar     — state text, Discard, Save — Fans, Safety (savebar)
     * note        — callout with a tone, box adds a panel — hints, limit warnings, measure steps, emergency alerts (page)
     * emptyText   — muted text for loading, nothing to show, not available — Overview, Case, Fans, Safety
     * fanTile     — fan with icon, name, source, rpm, power bar — Overview cooling, Fans page
     * meter       — thin bar for a percentage, tone warn or bad — fan tiles, drive cards, Safety limits
     * linkRow     — row of links (and a chip) at the foot of a card, spacing from the component — Overview, Fans
     * glyph       — small muted icon before a label — Overview, Sensors, Safety limits (glyph)
     * statChip    — label (with icon) and value: inline, stack (label over value) or row (label left, value right) — Overview heat row, SSDs, LAN ports, Sensors values
     * tempBadge   — text and level (ok warm hot na), coloured only when warm or hot; tempOf(temp, kind) builds it from a reading, standbyBadge() for a sleeping drive — Overview, Case, Safety, Sensors
     * chipCheck   — tickable chip, the circle fills when ticked — Safety (ignore drives), About (confirm device)
     * sensorRow   — one reading with source, badges and values — Sensors, Case (inside)
     * sensorDevice — a controller the plugin found: what it is, where, whether it answers — Sensors (top)
     * modeTiles   — the mode picker as tiles — Overview, Fans
     * stepper (.unc-stepper), link tile (.unc-link-tile) and the drive card (driveCard) are built in their own sections
     * saved()     — the one confirmation for a setting that saves on change (language, colour scheme, fan control, mode): toast "Saved"
     * ---------------------------------------------------------
     */

    const cardHead = (title, { ico = '', actions = '', tag = 'div', titleId = '' } = {}) => `
        <${tag} class="unc-card-head">
            <h2>${ico ? `<span class="unc-ico">${icon(ico)}</span>` : ''}<span${titleId ? ` id="${titleId}"` : ''}>${escapeHtml(title)}</span></h2>${actions}
        </${tag}>`;

    // A section inside a card. With actions it is a row with the action on the right; id goes to the h3 (aria-labelledby).
    const sectionHead = (title, { actions = '', id = '' } = {}) => {
        const h3 = `<h3 class="unc-sec"${id ? ` id="${id}"` : ''}>${escapeHtml(title)}</h3>`;

        return actions ? `<div class="unc-sec-head">${h3}${actions}</div>` : h3;
    };

    const pill = ({ tone = 'plain', text, sub = '', ico = '', disc = false, lg = false, tag = 'span', attrs = '' }) => `
        <${tag} class="unc-pill is-${tone}${disc ? ' is-disc' : ''}${lg ? ' is-lg' : ''}"${tag === 'button' ? ' type="button"' : ''} ${attrs}>${ico ? `<span class="unc-ico">${icon(ico)}</span>` : ''}<span>${escapeHtml(text)}</span>${sub ? `<small>${escapeHtml(sub)}</small>` : ''}</${tag}>`;

    // html is already escaped. tone: info warn bad violet; box makes it a panel; ico puts an icon before the content.
    const note = (html, { tone = 'info', box = false, ico = '', tag = 'p', attrs = '' } = {}) => `
        <${tag} class="unc-note is-${tone}${box ? ' is-box' : ''}${ico ? ' is-icon' : ''}" ${attrs}>${ico ? `<span class="unc-ico">${icon(ico)}</span><div>${html}</div>` : html}</${tag}>`;

    const emptyText = (text, cls = '') => `<p class="unc-empty ${cls ? `is-${cls}` : ''}">${escapeHtml(text)}</p>`;

    // The fan's icon turns with its rpm (fanIcon); the bar is its power. sub: what drives it; hint: the long form as tooltip.
    function fanTile(fan, fans, { sub, hint = '', why = '' }) {
        const running = fan.rpm > 0 && !fan.error;
        const rpm = fan.rpm > 0 ? `${fan.rpm} <small>${escapeHtml(t('fan.rpm'))}</small>` : escapeHtml(t(fan.error ? 'fan.error' : 'fan.stopped'));
        const power = fan.error ? '' : fan.pct == null ? t('fan.auto') : t('fan.speed', { pct: fan.pct });

        return `
            <div class="unc-fantile ${running ? '' : 'stopped'}" ${hint ? `title="${escapeHtml(hint)}"` : ''}>
                ${fanIcon(fan, icon('fan'))}
                <div class="unc-fantile-text">
                    <strong>${escapeHtml(fanName(fan, fans))}</strong>
                    <span>${escapeHtml(sub)}</span>
                    ${why ? `<em>${escapeHtml(why)}</em>` : ''}
                </div>
                <div class="unc-fantile-val"><b>${rpm}</b><span>${escapeHtml(power)}</span></div>
                ${meter(fan.pct ?? 0)}
            </div>`;
    }

    const meter = (pct, tone = '') => `<span class="unc-meter${tone ? ` is-${tone}` : ''}"><span style="width:${pct}%"></span></span>`;

    // tone: primary or secondary (default); small sits in card heads. attrs is html, already escaped.
    const btn = ({ label, ico = '', tone = '', small = false, attrs = '' }) => `<button type="button" class="unc-btn${tone === 'primary' ? ' primary' : ''}${small ? ' small' : ''}" ${attrs}>${ico ? `<span class="unc-ico">${icon(ico)}</span>` : ''}<span>${escapeHtml(label)}</span></button>`;

    const linkBtn = (label, attrs = '') => `<button type="button" class="unc-linkbtn" ${attrs}>${escapeHtml(label)}</button>`;

    const navLink = (nav, key) => linkBtn(t(key), `data-nav="${nav}"`);

    // hint: text; hintId: an empty small the page fills later; cls: extra class on the row.
    const switchRow = ({ id, title, hint = '', hintId = '', cls = '', attrs = '' }) => `
        <label class="unc-switch-row${cls ? ` ${cls}` : ''}" ${attrs}>
            <span class="unc-switch"><input type="checkbox" id="${id}"><span></span></span>
            <span><strong>${escapeHtml(title)}</strong><small${hintId ? ` id="${hintId}"` : ''}>${escapeHtml(hint)}</small></span>
        </label>`;

    // A slider with its value in a box; showValue / the page keeps `#<id>-value` current. derived: no slider, a calculated
    // value (dashed box) and a small text `derived` (an id) in front of it.
    const rangeField = ({ id, min = 0, max = 100, step = 1, value, unit, derived = '', labelledby = '' }) => `
        <div class="unc-range">
            ${derived ? `<small class="unc-lim-derived" id="${derived}"></small>` : `<input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"${labelledby ? ` aria-labelledby="${labelledby}"` : ''}>`}
            <output class="unc-value${derived ? ' is-derived' : ''}" id="${id}-value">${value} ${unit}</output>
        </div>`;

    const saveBar = (name, saveId) => `
        <div class="unc-savebar" data-savebar="${name}">
            <span class="unc-savestate">${escapeHtml(t('save.clean'))}</span>
            ${btn({ label: t('save.discard'), attrs: `data-discard="${name}" disabled` })}
            ${btn({ label: t('common.save'), ico: 'check', tone: 'primary', attrs: `id="${saveId}" disabled` })}
        </div>`;

    // Static spots in the page that hold a component: <span data-unc="btn" data-unc-label="<i18n key>" …>. Parameters are
    // data-unc-*; every other attribute is passed on. Inner html (card head actions) is kept. Buttons first: they sit in heads.
    function mountStatic() {
        const mount = (name, render) => qa(`[data-unc="${name}"]`).forEach(el => {
            const p = key => el.getAttribute(`data-unc-${key}`);
            const text = key => (p(key) ? t(p(key)) : '');
            const attrs = [...el.attributes].filter(a => !a.name.startsWith('data-unc')).map(a => `${a.name}="${escapeHtml(a.value)}"`).join(' ');

            el.outerHTML = render({ p, text, attrs, inner: el.innerHTML });
        });

        mount('btn', ({ p, text, attrs }) => btn({ label: text('label'), ico: p('ico') || '', tone: p('tone') || '', small: p('small') != null, attrs }));
        mount('cardhead', ({ p, text, inner }) => cardHead(text('title'), { ico: p('ico') || '', actions: inner, tag: p('tag') || 'div', titleId: p('title-id') || '' }));
        mount('sechead', ({ p, text, inner }) => sectionHead(text('title'), { actions: inner, id: p('id') || '' }));
        mount('switch', ({ p, text, attrs }) => switchRow({ id: p('input'), title: text('title'), hint: text('hint'), hintId: p('hint-id') || '', cls: p('cls') || '', attrs }));
        mount('range', ({ p }) => rangeField({ id: p('input'), min: p('min'), max: p('max'), step: p('step') || 1, value: p('value'), unit: p('unit'), derived: p('derived') || '', labelledby: p('labelledby') || '' }));
        mount('savebar', ({ p }) => saveBar(p('name'), p('save')));
        mount('glyph', ({ p }) => glyph(icon(p('ico')), 'lg'));
        q('#unc-case-src-link').innerHTML = linkRow(navLink('safety', 'curves.case_src_link'));
    }

    // Drive names as people read them: Unraid's own name, model without the underscores of the device id.
    const friendly = value => String(value || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    const driveLabel = name => name === 'flash' ? t('sensors.boot_usb') : name;
    // The serial is the last word of the device id ("Samsung_SSD_850_EVO_S21HN…").
    const driveSerial = bay => { const id = friendly(bay.id); return id && id !== friendly(bay.model) ? id.split(' ').pop() : ''; };

    const linkRow = (...items) => `<div class="unc-links">${items.join('')}</div>`;

    // markup: an icon (icon(), a fan, the Unraid mark); cls: lg for rows, warn for an alert.
    const glyph = (markup, cls = '') => `<span class="unc-glyph ${cls ? `is-${cls}` : ''}">${markup}</span>`;

    const chipCheck = (attr, checked, html) => `
        <label class="unc-chipcheck"><input type="checkbox" ${attr} ${checked ? 'checked' : ''}><i class="unc-chipcheck-box"></i><span>${html}</span></label>`;

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

    // The confirmation for a setting that saves on change. Settings that reload the page leave a flag for the next load.
    const saved = () => toast(t('save.saved'));

    function reloadSaved() {
        try { sessionStorage.setItem('unc-saved', '1'); } catch (error) { /* then no confirmation */ }
        location.reload();
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

        // A write makes shared GET results (UNCPoll) older than the write: drop them before and after.
        if (post) window.UNCPoll.invalidate();
        const response = await fetch(url, options);
        if (post) window.UNCPoll.invalidate();
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

    // One case fan is "Case fan", several are "Case fan 1", "Case fan 2"; the group is "Case fan" or "Case fans".
    const caseFans = fans => (fans || []).filter(f => f.role === 'case');
    const fanName = (fan, fans) => fan.role === 'cpu'
        ? t('fan.cpu')
        : caseFans(fans).length === 1 ? t('fan.case_one') : t('fan.case', { n: caseFans(fans).indexOf(fan) + 1 });
    const caseGroupName = () => t(caseFans(state.data?.fans).length === 1 ? 'fan.case_one' : 'curves.case');

    /*
     * ---------------------------------------------------------
     * Rendering
     * ---------------------------------------------------------
     */

    // Page title and subtitle follow the sidebar entry; the controller chips show what the page is about.
    const SUBTITLES = {
        overview: 'sub.overview',
        case: 'case.intro',
        sensors: 'sub.sensors',
        curves: 'curves.intro',
        safety: 'safety.intro',
        'led:overview': 'leds.intro',
        'led:drives': 'sub.led_drives',
        'led:schedules': 'sub.led_schedules',
        'led:system': 'sub.led_system',
        settings: 'sub.settings',
        about: 'sub.about'
    };

    function renderTitle() {
        const nav = state.nav;

        q('#unc-title').textContent = t(`nav.${nav.replace(':', '_')}`);
        q('#unc-subtitle').innerHTML = t(SUBTITLES[nav] || 'sub.overview');
        qa('[data-model]').forEach(element => {
            element.textContent = state.data?.info?.model || 'UGREEN NAS';
        });
        renderBanners();
    }

    // The controller chips in the title row, the same everywhere: the fan controller on the fan pages, the LED controller
    // on the LED pages, both elsewhere. Green when found, red with the reason when not.
    function renderBanners() {
        const data = state.data;
        const nav = state.nav;
        const fanPage = nav === 'curves' || nav === 'safety';
        const ledPage = nav.startsWith('led:');
        const show = [];

        if (data?.ok) {
            // A model without fan control shows no fan controller chip, found or not: the Settings page says so.
            if (!ledPage && (!modelName() || fanKnown())) {
                if (data.chip) show.push([t('banner.connected'), chipName(data.chip), true]);
                else if (data.chip_error) show.push([t('warn.chip'), data.chip_error, false]);
            }
            // A single missed probe is not "not found": see ledControllerState().
            const controller = ledControllerState();
            if (!fanPage && controller) {
                const found = controller === 'found';
                show.push([t(found ? 'banner.led' : 'banner.led_off'), found && state.ledStatus.i2c_address ? `I²C ${state.ledStatus.i2c_address}` : '', found]);
            }
        }

        q('#unc-banners').innerHTML = show.map(([text, sub, good]) => pill({ tone: good ? 'ok' : 'bad', ico: good ? 'check' : 'alert', disc: true, text, sub })).join('');
    }

    // The LEDs are dimmed or off right now because of the night mode.
    function renderNightBadge() {
        const badge = q('#unc-night');

        if (badge) badge.hidden = !(ledsOn() && state.ledStatus?.night);
    }

    function renderHead() {
        const data = state.data;
        const online = Boolean(data && data.ok);
        const badge = q('#unc-online');

        badge.textContent = online ? t('head.online') : t('head.offline');
        badge.classList.toggle('is-ok', online);
        badge.classList.toggle('is-bad', !online);
        renderNightBadge();

        if (!online) return;

        renderTitle();

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

    function renderFanSwitch() {
        const input = q('#unc-fan-enabled');

        input.checked = !fanOff();
        q('#unc-fan-state').textContent = t(fanOff() ? 'fanctl.off' : 'fanctl.on');
    }

    // The Overview's cooling card: a dial per fan (the icon turns with the real rpm), the temperatures that drive the curves, the links to the curves.
    function renderFans() {
        const data = state.data;
        const fans = data.fans || [];
        const off = fanKnown() && fanOff();
        const heat = heatRow();

        // No cooling card on a model without fan control: there is nothing to show or to set.
        q('.unc-ov-cool').classList.toggle('fan-off', off);
        q('.unc-ov-cool').hidden = (Boolean(modelName()) && !fanKnown()) || (!heat && (off || !fans.length));
        q('.unc-ov').classList.toggle('no-cool', q('.unc-ov-cool').hidden);
        q('#unc-heat').innerHTML = heat;

        if (off) {
            q('#unc-fans').innerHTML = emptyText(t('fanctl.off_note'));
            q('#unc-follow').textContent = '';
            return;
        }

        q('#unc-fans').innerHTML = fans.map(fan => fanTile(fan, fans, { sub: fanSourceShort(fan), hint: fanSource(fan) })).join('');

        q('#unc-follow').innerHTML = followLinks();
    }

    // The temperatures the curves read, coloured only when warm or hot. The board chip also holds the fan controller's sensor.
    function heatRow() {
        const data = state.data;
        const s = data.sensors || {};
        const chip = (data.chip_temps || []).find(v => v != null);
        const item = (label, value, kind, iconName, hint = '') => {
            return value == null ? '' : statChip({ ico: icon(iconName), label, value: tempOf(value, kind), hint, cls: 'is-stack is-lg' });
        };

        return [
            item(t('temps.cpu'), s.cpu, 'cpu', 'chip'),
            item(t('temps.gpu'), s.gpu, 'cpu', 'pcie'),
            item(t('temps.board'), s.board, 'other', 'board', chip == null ? '' : `${t('cc.chip')} ${chip} °C`)
        ].join('');
    }

    // What drives a fan right now, in words: shared by the Fans page tiles and the Overview cards.
    function fanSource(fan) {
        const data = state.data;
        const daemon = data.running ? data.daemon : null;
        const mode = data.settings?.mode;
        const kind = fan.role === 'cpu' ? 'cpu' : 'case';
        const info = daemon && !daemon.failsafe && !['bios', 'full'].includes(mode) ? nowInfo(kind) : null;

        if (!data.running) return t('follow.stopped');
        if (daemon?.failsafe) return t('curves.why_emergency');
        if (mode === 'bios') return t('follow.bios');
        if (mode === 'full') return t('mode.note_full');
        if (kind === 'cpu' || info?.byCpu) return t('follow.cpu', { temp: deg(daemon?.cpu_temp ?? data.sensors?.cpu) });
        return caseFollowText();
    }

    // The same in a few words for the Overview dials: no temperatures (they are shown elsewhere).
    function fanSourceShort(fan) {
        const data = state.data;
        const daemon = data.running ? data.daemon : null;
        const mode = data.settings?.mode;
        const kind = fan.role === 'cpu' ? 'cpu' : 'case';
        const info = daemon && !daemon.failsafe && !['bios', 'full'].includes(mode) ? nowInfo(kind) : null;

        if (!data.running || daemon?.failsafe) return fanSource(fan);
        if (mode === 'bios' || mode === 'full') return t(`mode.${mode}`);
        if (kind === 'cpu' || info?.byCpu) return t('ov.follows_cpu');

        const src = caseSource();

        return src.from === 'disk' ? t('ov.follows_disk') : src.from === 'nvme' ? t('ov.follows_nvme', { name: src.label }) : t('ov.follows_none');
    }

    // The Fans page: one tile per fan with the live speed, what drives it and, if it differs from the curve, why.
    function renderNow() {
        const data = state.data;
        const fans = data.fans || [];
        const box = q('#unc-now');

        if (fanOff()) {
            box.innerHTML = emptyText(t('fanctl.off_note'));
            return;
        }

        const daemon = data.running ? data.daemon : null;
        const mode = data.settings?.mode;

        box.innerHTML = fans.map(fan => {
            const kind = fan.role === 'cpu' ? 'cpu' : 'case';
            const info = daemon && !daemon.failsafe && !['bios', 'full'].includes(mode) ? nowInfo(kind) : null;

            return fanTile(fan, fans, { sub: fanSource(fan), why: info?.why });
        }).join('');
    }

    function followLinks() {
        return linkRow(navLink('curves', 'follow.edit'), navLink('safety', 'follow.safety'), navLink('sensors', 'ov.all_sensors'));
    }

    // The description of a mode; the presets quote where their curves start.
    function modeSub(id) {
        const preset = state.data?.presets?.[id];
        const first = preset ? preset.map(text => parseCurve(text)[0]?.pct ?? 0) : [0, 0];

        return t(`mode.${id}_sub`, { cpu: first[0], case: first[1] });
    }

    // The mode buttons, shared by the Overview and the Fans page.
    function modeTiles(mode, disabled) {
        return MODES.map(m => `
            <button type="button" class="unc-effect ${m.id === mode ? 'active' : ''}" data-mode="${m.id}" title="${escapeHtml(modeSub(m.id))}" ${disabled}>
                ${icon(m.icon)}
                <strong>${escapeHtml(t(`mode.${m.id}`))}</strong>
                <small>${escapeHtml(modeSub(m.id))}</small>
            </button>`).join('');
    }

    function renderModes() {
        const mode = state.data?.settings?.mode || 'standard';
        const disabled = state.data?.chip ? '' : 'disabled';
        q('#unc-modes').innerHTML = modeTiles(mode, disabled);

        // Fans speed up and slow down gradually only where a curve is in charge.
        const ramp = mode === 'bios' || mode === 'full' ? '' : t('mode.hint_curve');
        const hint = q('#unc-mode-hint');
        hint.textContent = mode === 'bios' ? t('mode.hint_bios') : mode === 'full' ? t('mode.note_full') : ramp;
        hint.hidden = !hint.textContent;

        // The Fans page: the same tiles, one line about the chosen mode below.
        q('#unc-modes-fans').innerHTML = modeTiles(mode, disabled);
        q('#unc-mode-note').textContent = mode === 'bios' ? t('mode.hint_bios') : mode === 'full' ? t('mode.note_full') : [mode === 'custom' || (['quiet', 'standard', 'performance'].includes(mode) && !state.data?.presets?.[mode]) ? '' : modeSub(mode) + '.', ramp].filter(Boolean).join(' ');
    }

    const ssdSlotLabel = n => n.slot === 'pcie' ? t('in.pcie_card') : n.slot === 'system' ? t('slot.system') : n.slot === 'm2' ? 'M.2' : t('case.m2_slot', { n: n.slot.replace('m2-', '') });

    function uptime(seconds) {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor(seconds % 86400 / 3600);
        const m = Math.floor(seconds % 3600 / 60);
        return d > 0 ? t('uptime.days', { d, h }) : t('uptime.hours', { h, m });
    }

    // 'found' | 'missing' | '' (unknown, or one miss that may be transient). The backend retries and
    // remembers the bus; "missing" needs an empty probe in three reads in a row and no LED answering.
    function ledControllerState() {
        const status = state.ledStatus;
        if (!ledsOn() || !status) return '';
        if (status.i2c_address || Object.keys(state.leds || {}).length) return 'found';
        return (state.ledMisses || 0) >= 3 ? 'missing' : '';
    }

    // The LED controller for the System facts: what it reports, or why the LED part is off.
    function ledController() {
        const led = state.data?.led;
        const status = state.ledStatus;

        if (ledsOn()) {
            const controller = ledControllerState();
            if (!controller) return '';
            return controller === 'found'
                ? (status.i2c_address ? t('ledfacts.controller_on', { bus: status.i2c_bus, address: status.i2c_address }) : t('ledfacts.controller_on_short'))
                : t('ledfacts.controller_off');
        }
        if (!led) return '';
        if (led.blocker === 'model') return t('system.ledctl_model');
        if (led.blocker) return t('system.ledctl_blocked');
        return t(led.warning === 'standalone' && !led.enabled ? 'system.ledctl_standalone' : 'system.ledctl_off');
    }

    // Every UGREEN NASync model by series and what this plugin does for it: [series, model, test regex of the DMI name, LEDs, case view, fans].
    // LEDs: verified | confirmed | reported (by users) | untested | power (power LED only) | none; case: full | fr | ''.
    const MODELS = [
        // DX: the first generation
        ['DX', 'DX4600 Pro', /^DX4600/, 'verified', '', false],
        ['DX', 'DX4700 / Plus', /^DX4700/, 'reported', '', false],
        // DXP: 2 bays to 8 bays, by size
        ['DXP', 'DXP2800', /^DXP2800$/, 'reported', 'fr', false],
        ['DXP', 'DXP2800 GT', /^DXP2800 GT/, 'untested', 'fr', false],
        ['DXP', 'DXP480T Plus', /^DXP480T/, 'power', '', false],
        ['DXP', 'DXP4800 / Plus / Pro', /^DXP4800( Plus| Pro)?$/, 'confirmed', 'fr', false],
        ['DXP', 'DXP4800 GT', /^DXP4800.*GT/, 'confirmed', 'full', true],
        ['DXP', 'DXP6800 Pro', /^DXP6800 Pro$/, 'verified', 'full', true],
        ['DXP', 'DXP6800 Ultra', /^DXP6800 Ultra/, 'untested', '', false],
        ['DXP', 'DXP8800 Plus', /^DXP8800 Plus$/, 'verified', 'fr', false],
        ['DXP', 'DXP8800 Ultra', /^DXP8800 Ultra/, 'untested', '', false],
        // iDX: with the display and the local AI
        ['iDX', 'iDX6011 / Pro', /^iDX6011/, 'untested', 'fr', false],
        // DH: the home series
        ['DH', 'DH2300, DH4300 Plus', /^DH/, 'none', '', false]
    ];

    // The list is long: folded away until opened; the choice is remembered in this browser.
    function bindModelsFold() {
        const fold = q('#unc-models-fold');

        try { fold.open = localStorage.getItem('unc-models-open') === '1'; } catch (error) { /* closed */ }
        fold.addEventListener('toggle', () => {
            try { localStorage.setItem('unc-models-open', fold.open ? '1' : '0'); } catch (error) { /* not remembered */ }
        });
    }

    // What the user can confirm on this device: [key, text key, shown when, line in the issue].
    const CONFIRMS = [
        ['leds', 'models.confirm_leds', () => state.data?.led?.supported !== false, 'LEDs: colours and effects work'],
        ['bays', 'models.confirm_bays', () => state.data?.led?.supported !== false, 'LEDs: the right bay blinks with "Identify" (bay order is right)'],
        ['case', 'models.confirm_case', () => caseKnown(), 'Case view: front and rear look like my device'],
        ['inside', 'models.confirm_inside', () => Boolean(state.hw) && !caseModel(state.hw).noInside && caseKnown(), 'Case view: the inside matches (M.2 slots, RAM)'],
        ['fans', 'models.confirm_fans', () => fanKnown() && !fanOff(), 'Fan control: modes and curves work, the fans react'],
        ['temps', 'models.confirm_temps', () => true, 'Temperatures and the dashboard tile show the right values']
    ];

    function renderConfirm() {
        const box = q('#unc-confirm-list');
        const ticked = new Set(qa('#unc-confirm-list input:checked').map(input => input.dataset.confirm));

        box.innerHTML = CONFIRMS.filter(([, , when]) => when()).map(([key, text]) => chipCheck(`data-confirm="${key}"`, ticked.has(key), escapeHtml(t(text)))).join('');
    }

    // A pre-filled GitHub issue: model, versions and what was ticked. Nothing is sent from here; the user submits it on GitHub.
    function openConfirmIssue() {
        const info = state.data?.info || {};
        const model = modelName() || 'unknown';
        const marked = new Set(qa('#unc-confirm-list input:checked').map(input => input.dataset.confirm));
        const lines = CONFIRMS.filter(([, , when]) => when()).map(([key, , , line]) => `- [${marked.has(key) ? 'x' : ' '}] ${line}`);
        const comment = q('#unc-confirm-text').value.trim();
        const body = [
            `Model: ${model}`,
            `Plugin: ${window.UGREEN_NAS_VERSION || '?'}`,
            `Unraid: ${info.unraid || '?'}, kernel ${info.kernel || '?'}`,
            `Fan chip: ${state.data?.chip || 'none'}; LED controller: ${state.ledStatus?.i2c_address ? `I2C ${state.ledStatus.i2c_address}` : 'not found'}`,
            '',
            ...lines,
            ...(comment ? ['', comment] : [])
        ].join('\n');
        const url = `https://github.com/alexanderschubert/ugreen-nas-control/issues/new?labels=${encodeURIComponent('model-report')}&title=${encodeURIComponent(`Model report: ${model}`)}&body=${encodeURIComponent(body)}`;

        window.open(url, '_blank', 'noopener');
    }

    function renderModels() {
        const mine = modelName();
        const cell = (kind, text) => `<td class="m-${kind}">${escapeHtml(text)}</td>`;

        q('#unc-models').innerHTML = `
            <table class="unc-table unc-models">
                <thead><tr>
                    <th>${escapeHtml(t('models.col_model'))}</th><th>${escapeHtml(t('models.col_leds'))}</th>
                    <th>${escapeHtml(t('models.col_case'))}</th><th>${escapeHtml(t('models.col_fans'))}</th>
                </tr></thead>
                <tbody>${MODELS.map(([series, name, re, leds, view, fans], i) => `${i === 0 || MODELS[i - 1][0] !== series ? `
                    <tr class="series"><th colspan="4">${escapeHtml(t('models.series', { s: series }))}</th></tr>` : ''}
                    <tr class="${re.test(mine) ? 'mine' : ''}">
                        <td><b>${escapeHtml(name)}</b>${re.test(mine) ? ` <small class="unc-muted">${escapeHtml(t('models.mine'))}</small>` : ''}</td>
                        ${cell(leds, t(`models.st_${leds}`))}
                        ${cell(view || 'none', view ? t(`models.case_${view}`) : '–')}
                        ${cell(fans ? 'yes' : 'none', fans ? '✓' : '–')}
                    </tr>`).join('')}
                </tbody>
            </table>
            ${note(escapeHtml(t('models.footnote')))}`;
    }

    function renderSystem() {
        const data = state.data;
        const info = data.info || {};
        const facts = [
            ['system.model', info.model],
            ['system.bios', [info.bios, biosDate(info.bios_date)].filter(Boolean).join(' · ')],
            ['system.cpu', [info.cpu, info.threads ? t('system.threads', { n: info.threads }) : ''].filter(Boolean).join(' · ')],
            ['system.memory', ramMB(info) ? `${Math.round(ramMB(info) / 1024)} GB` : ''],
            ['system.unraid', info.unraid],
            ['system.kernel', info.kernel],
            ['system.uptime', info.uptime ? uptime(info.uptime) : ''],
            ['system.chip', data.chip ? chipName(data.chip) : data.chip_error ? '–' : ''],
            ['system.ledctl', ledController()],
            ...ledFacts()
        ];

        q('#unc-system').innerHTML = facts
            .filter(([, value]) => value)
            .map(([key, value]) => `<dt>${escapeHtml(t(key))}</dt><dd>${escapeHtml(value)}</dd>`)
            .join('');
    }

    /* Curves */

    // What the case fans follow. The daemon compares every tick the hottest awake, non-ignored disk with the hottest
    // non-ignored NVMe minus the offset: the disk wins when it is at least as warm, otherwise the SSD; with all
    // disks asleep only the SSD is left. The daemon's values count; while its state is missing (stopped,
    // restarting) the same rule runs on the sensors.
    function caseSource() {
        const settings = state.data?.settings || {};
        const sensors = state.data?.sensors || {};
        const daemon = state.data?.daemon;
        const ignored = new Set(settings.ignore_drives || []);
        const hottestDrive = list => (list || []).filter(d => !ignored.has(d.name) && !d.standby && d.temp != null).reduce((top, d) => !top || d.temp > top.temp ? d : top, null);
        const diskDrive = hottestDrive(sensors.disks);
        const disk = diskDrive?.temp ?? null;
        const nvmeDrive = hottestDrive(sensors.nvme);
        const nvme = nvmeDrive?.temp ?? null;
        // "NVMe cache": the Unraid role of the drive (cache, a pool name); plain "NVMe" while the roles are unknown, never the device name (nvme0).
        const role = String((state.hw?.nvme || []).find(n => n.id === nvmeDrive?.name)?.role || '');
        const label = !role ? 'NVMe' : /^nvme/i.test(role) ? role : `NVMe ${role}`;
        const offset = settings.nvme_offset ?? 15;
        const eff = nvme == null ? null : nvme - offset;
        const calc = disk != null && (eff == null || disk >= eff) ? 'disk' : eff != null ? 'nvme' : '';

        if (daemon?.case_temp != null) {
            const from = daemon.case_from || calc;
            return { from, drive: (from === 'disk' ? diskDrive : nvmeDrive)?.name, label, temp: daemon.case_temp, disk, nvme: nvme ?? (from === 'nvme' ? daemon.case_temp + offset : null), offset, eff: eff ?? (from === 'nvme' ? daemon.case_temp : null) };
        }
        return { from: calc, drive: (calc === 'disk' ? diskDrive : nvmeDrive)?.name, label, temp: calc === 'disk' ? disk : eff, disk, nvme, offset, eff };
    }

    const caseTemp = () => caseSource().temp;

    // Where the case fans' temperature comes from, with the numbers.
    function caseFollowText() {
        const src = caseSource();

        if (src.from === 'disk') return t('follow.disk', { temp: deg(src.temp) });
        if (src.from === 'nvme') return t(src.disk == null ? 'follow.nvme' : 'follow.nvme_awake', { name: src.label, nvme: deg(src.nvme), temp: deg(src.eff) });
        return t('follow.none');
    }

    // The daemon never runs a fan below this speed (Safety page), whatever the curve says.
    // An unsaved value from the field on the curves page counts for the preview.
    const minPct = () => Math.min(60, Math.max(10, Number(state.minEdit ?? state.data?.settings?.min_pct ?? 25) || 25));

    // Round rpm ticks for the right axis, placed where the measured table reaches them.
    function rpmTicks(kind) {
        const rows = state.data?.calibration?.table?.fans?.[fanOfKind(kind)?.id];
        if (!rows || rows.length < 2) return [];
        const lo = rows[0][1];
        const hi = rows[rows.length - 1][1];
        const step = [100, 250, 500, 1000].find(s => (hi - lo) / s <= 6) || 1000;
        const ticks = [];

        for (let rpm = Math.ceil(lo / step) * step; rpm <= hi; rpm += step) {
            const i = rows.findIndex(r => r[1] >= rpm);
            if (i < 1) continue;
            const [p0, r0] = rows[i - 1];
            const [p1, r1] = rows[i];
            ticks.push({ rpm, pct: r1 === r0 ? p1 : p0 + (p1 - p0) * (rpm - r0) / (r1 - r0) });
        }
        return ticks;
    }

    // The curve as the fan runs it: raised to the minimum, with the crossing points added.
    function effectivePoints(points, min, max, floor) {
        if (!points.length) return [];
        const all = [{ temp: min, pct: points[0].pct }, ...points, { temp: max, pct: points[points.length - 1].pct }];
        const out = [];

        all.forEach((p, i) => {
            const prev = all[i - 1];
            if (prev && (prev.pct - floor) * (p.pct - floor) < 0) {
                out.push({ temp: prev.temp + (p.temp - prev.temp) * (floor - prev.pct) / (p.pct - prev.pct), pct: floor });
            }
            out.push({ temp: p.temp, pct: Math.max(p.pct, floor) });
        });
        return out;
    }

    // The live line under the switch: today's numbers behind the case fan speed.
    function paintMix() {
        const line = q('#unc-mix-now');
        const cpu = cpuDemand();
        const temp = caseTemp();

        const foot = q('#unc-mix-cpu');

        foot.classList.toggle('on', cpu != null);
        q('#unc-mix-cpu-title').textContent = t(cpu != null ? 'curves.mix_cpu_on' : 'curves.mix_cpu_off');
        q('#unc-mix-cpu-hint').textContent = t(cpu != null ? 'curves.mix_cpu_on_hint' : 'curves.mix_cpu_off_hint');
        line.hidden = cpu == null;
        if (cpu == null) return;
        const curve = curveAt(state.curves.case, temp ?? -1);
        const pct = Math.max(curve, cpu, minPct());
        // Everything in case-fan terms: the CPU temperature is only the reason for the speed.
        line.textContent = cpu > curve && cpu >= minPct()
            ? t('curves.mix_now_cpu', { pct, rpm: rpmNote('case', pct), temp: state.data.sensors.cpu })
            : t('curves.mix_now', { pct, rpm: rpmNote('case', pct), cpu, cpurpm: rpmNote('case', cpu) });
    }

    function showCurveMin() {
        const input = q('#unc-curve-min');
        setRangeFill(input);
        q('#unc-curve-min-value').textContent = `${input.value} %`;
    }

    // The case fans with "help cool the CPU" on: what the CPU curve asks for at the current CPU temperature, else null.
    // The daemon runs the case fans at the higher of this and the case curve, then raises it to the minimum.
    function cpuDemand() {
        const cpuNow = state.data?.sensors?.cpu;
        return state.caseFollows && cpuNow != null ? curveAt(state.curves.cpu, cpuNow) : null;
    }

    // What a fan group gets right now and why: the chart marker and the status tiles both read this.
    function nowInfo(kind) {
        const now = kind === 'cpu' ? state.data?.sensors?.cpu : caseTemp();
        if (now == null) return null;

        const points = state.curves[kind];
        const curve = curveAt(points, now);
        const daemon = state.data?.daemon;
        const fan = fanOfKind(kind);
        // The case fans take the higher of both curves when the mix is on; the daemon says which one won.
        const cpuNow = state.data?.sensors?.cpu;
        const cpuCurve = cpuNow == null ? 0 : curveAt(state.curves.cpu, cpuNow);
        const byCpu = kind === 'case' && (daemon?.case_driver && !state.curvesDirty
            ? daemon.case_driver === 'cpu'
            : state.caseFollows && cpuCurve > curve);
        const wanted = Math.max(byCpu ? cpuCurve : curve, minPct());
        // What the fan really gets: the daemon's target. Without one the daemon is not driving this fan:
        // a measurement runs or the BIOS is in charge.
        const driven = daemon?.failsafe ? 100 : daemon?.targets?.[fan?.id];
        const idle = driven == null && Boolean(daemon) && Boolean(fan);
        // The daemon ramps down slowly (after a spike or any drop of the curve): the fan is above the curve.
        const slowing = !idle && !state.curvesDirty && !daemon?.failsafe && driven != null && driven > wanted;
        let why = '';

        if (daemon?.failsafe) why = t('curves.why_emergency');
        else if (idle) why = state.data?.calibration?.progress?.state === 'running' ? t('curves.why_calibrating') : daemon.mode === 'bios' ? t('curves.why_bios') : '';
        else if (slowing) why = t('curves.why_slowing');
        else if (byCpu) why = t('curves.why_cpu', { temp: cpuNow, cpu: cpuCurve, curve, rpm: rpmNote('case', cpuCurve) });
        else if (curve < minPct()) why = t('curves.why_min', { curve });

        return { now, byCpu, wanted, target: state.curvesDirty ? wanted : driven ?? wanted, idle, slowing, why };
    }

    function drawChart(kind) {
        const box = q(`[data-curve="${kind}"]`);
        const svg = box.querySelector('[data-chart]');
        const points = state.curves[kind];
        const { min, max } = CHART[kind];
        // The chart is as wide as its card, drawn 1:1 so the text keeps its size.
        const W = Math.round(svg.clientWidth) || 320;
        const H = 200;
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.dataset.w = W;
        const L = 34;
        const ticks = rpmTicks(kind);
        const R = ticks.length ? 44 : 10;
        const T = 24;
        const B = 26;
        const x = temp => L + (Math.max(min, Math.min(max, temp)) - min) / (max - min) * (W - L - R);
        const y = pct => T + (1 - pct / 100) * (H - T - B);

        let grid = '';
        for (let pct = 0; pct <= 100; pct += 25) {
            grid += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(pct)}" y2="${y(pct)}"/>`;
            grid += `<text class="axis" x="${L - 6}" y="${y(pct) + 4}" text-anchor="end">${pct}%</text>`;
        }
        if (!ticks.length && fanOfKind(kind) && !state.data?.calibration?.table) {
            grid += `<text class="axis hint" x="${L}" y="${T - 12}">${escapeHtml(t('curves.rpm_unmeasured'))}</text>`;
        }
        if (ticks.length) {
            grid += `<text class="axis" x="${W - R + 6}" y="${T - 14}">${escapeHtml(t('fan.rpm'))}</text>`;
            grid += ticks.map(k => `<line class="tick" x1="${W - R}" x2="${W - R + 4}" y1="${y(k.pct)}" y2="${y(k.pct)}"/>
                <text class="axis" x="${W - R + 6}" y="${y(k.pct) + 4}">${k.rpm}</text>`).join('');
        }
        const step = kind === 'cpu' ? 20 : 10;
        for (let temp = min; temp <= max; temp += step) {
            grid += `<text class="axis" x="${x(temp)}" y="${H - 8}" text-anchor="middle">${temp}°</text>`;
        }

        // The line runs flat to both edges, as the daemon holds the end values.
        const line = points.length
            ? [`${x(min)},${y(points[0].pct)}`, ...points.map(p => `${x(p.temp)},${y(p.pct)}`), `${x(max)},${y(points[points.length - 1].pct)}`].join(' ')
            : '';

        const info = nowInfo(kind);
        let marker = '';
        if (info) {
            const { now, target, wanted, slowing, idle } = info;
            const text = `${t('curves.now')} ${now}°${idle ? '' : ` → ${target}%`}${info.byCpu && !idle && !slowing ? ` ${t('curves.by_cpu')}` : ''}`;
            // The text sits on the roomier side of the marker and stays inside the plot.
            const crit = state.data?.settings?.[kind === 'cpu' ? 'cpu_crit' : 'disk_crit'];
            const width = text.length * 6.3;
            const fits = side => side > 0 ? x(now) + 6 + width < W - R : x(now) - 6 - width > L;
            // The emergency line must not cut through the text: take the side it is not on, else the other one.
            const hits = side => crit >= min && crit <= max && (side > 0
                ? x(crit) > x(now) && x(crit) < x(now) + 12 + width
                : x(crit) < x(now) && x(crit) > x(now) - 12 - width);
            const right = fits(1) && !hits(1) ? true : fits(-1) && !hits(-1) ? false : fits(1);
            const tx = right ? x(now) + 6 : x(now) - 6;
            marker = `<line class="now" x1="${x(now)}" x2="${x(now)}" y1="${T}" y2="${H - B}"/>
                <circle class="now-dot" cx="${x(now)}" cy="${y(slowing ? target : wanted)}" r="4"/>
                <text class="now-text" x="${tx}" y="${T + 12}" text-anchor="${right ? 'start' : 'end'}">${escapeHtml(text)}</text>`;
        }

        // Below the minimum speed the curve is only a wish: the band is shaded, the wish is drawn faded and dashed,
        // its points hollow; the solid line runs along the limit line, as the fan does.
        const minimum = minPct();
        // The case chart with the CPU help on: the CPU curve's demand at today's CPU temperature is a second floor.
        const demand = kind === 'case' ? cpuDemand() : null;
        const floor = Math.max(minimum, demand ?? 0);
        const effectiveList = effectivePoints(points, min, max, floor);
        const effective = effectiveList.map(p => `${x(p.temp)},${y(p.pct)}`).join(' ');
        let cpuWins = '';
        let cpuLine = '';
        if (demand != null) {
            // Shaded: where the CPU decides, between the case curve and the line the fans really follow.
            if (demand > minimum && points.length) {
                const plain = [{ temp: min, pct: points[0].pct }, ...points, { temp: max, pct: points[points.length - 1].pct }];
                cpuWins = `<polygon class="cpuwins" points="${[...effectiveList, ...plain.slice().reverse()].map(p => `${x(p.temp)},${y(p.pct)}`).join(' ')}"/>`;
            }
            const above = demand < 88;
            cpuLine = `<line class="cpuline" x1="${L}" x2="${W - R}" y1="${y(demand)}" y2="${y(demand)}"/>
                <text class="cpu-text" x="${W - R - 4}" y="${y(demand) + (above ? -5 : 13)}" text-anchor="end">${escapeHtml(t('curves.cpu_asks', { temp: state.data.sensors.cpu, pct: demand, rpm: rpmNote('case', demand) }))}</text>`;
        }
        const band = `<rect class="minband" x="${L}" y="${y(minimum)}" width="${W - L - R}" height="${H - B - y(minimum)}"/>`;
        const limit = `<line class="minline" x1="${L}" x2="${W - R}" y1="${y(minimum)}" y2="${y(minimum)}"/>`;
        const minLabel = `<text class="min-text" x="${L + 4}" y="${y(minimum) + 11}">${escapeHtml(t('curves.min', { pct: minimum }))}</text>`;

        // The emergency limit: from here on all fans run at 100 %. The case axis is the case temperature, so
        // an NVMe drive (minus the offset) trips it at the same line.
        const crit = state.data?.settings?.[kind === 'cpu' ? 'cpu_crit' : 'disk_crit'];
        let emergency = '';
        if (crit >= min && crit <= max) {
            const left = x(crit) > L + 100;
            emergency = `<line class="crit" x1="${x(crit)}" x2="${x(crit)}" y1="${T - 6}" y2="${H - B}"/>
                <text class="crit-text" x="${x(crit) + (left ? -4 : 4)}" y="${T - 10}" text-anchor="${left ? 'end' : 'start'}">${escapeHtml(t('curves.crit', { temp: crit }))}</text>`;
        }

        svg.innerHTML = `${grid}${band}${cpuWins}${emergency}${cpuLine}
            <polyline class="curve clipped" points="${line}"/>
            <polyline class="curve" points="${effective}"/>
            ${points.map(p => `<circle class="point${p.pct < floor ? ' clipped' : ''}" cx="${x(p.temp)}" cy="${y(p.pct)}" r="4"/>`).join('')}
            ${limit}
            ${minLabel}
            ${marker}`;

        // Not blocking: a curve that ends below 100 % leaves the emergency limit as the only backstop.
        const last = points[points.length - 1];
        box.querySelector('[data-curve-warn]').hidden = !last || last.pct >= 100;
    }

    // Expected rpm of a fan at a speed: linear between the measured points; below the lowest one only the
    // measured 0 counts. null: not measured.
    function fanOfKind(kind) {
        return (state.data?.fans || []).find(f => f.role === kind);
    }

    function rpmAt(kind, pct) {
        const rows = state.data?.calibration?.table?.fans?.[fanOfKind(kind)?.id];
        if (!rows?.length || !Number.isFinite(pct)) return null;
        if (pct < rows[0][0]) return pct <= 0 && rows[0][1] === 0 ? 0 : null;
        if (pct >= rows[rows.length - 1][0]) return rows[rows.length - 1][1];
        const i = rows.findIndex(r => r[0] > pct);
        const [p0, r0] = rows[i - 1];
        const [p1, r1] = rows[i];
        return Math.round(r0 + (r1 - r0) * (pct - p0) / (p1 - p0));
    }

    // " ≈ 830 rpm" for the case or CPU fan at a speed, empty while the fans are not measured.
    const rpmNote = (kind, pct) => {
        const rpm = rpmAt(kind, pct);

        return rpm == null ? '' : ` ≈ ${rpm} ${t('fan.rpm')}`;
    };

    // The rpm of the speed the fan really gets: a point below the minimum shows the minimum's rpm and says so.
    const rpmHtml = (kind, pct) => {
        const floor = minPct();
        const rpm = rpmAt(kind, Math.max(pct, floor));
        const text = rpm == null ? '—' : String(rpm);
        return escapeHtml(text) + (pct < floor ? `<small>${escapeHtml(t('curves.raised', { pct: floor }))}</small>` : '');
    };

    // Preset curves are a preview; points can be edited in Custom, or after "Customize this curve".
    const curvesEditable = () => state.data?.settings?.mode === 'custom' || state.arm;

    function buildPoints(kind) {
        const box = q(`[data-curve="${kind}"] [data-points]`);
        const lock = curvesEditable() ? '' : 'disabled';

        box.innerHTML = `
            <div class="unc-point unc-point-head" aria-hidden="true"><span></span><span>°C</span><span>%</span><span>${escapeHtml(t('fan.rpm'))}</span></div>`
            + state.curves[kind].map((p, i) => `
            <div class="unc-point">
                <span class="unc-muted">${i + 1}</span>
                <input type="number" min="0" max="120" step="1" value="${p.temp}" data-i="${i}" data-field="temp" aria-label="°C ${i + 1}" ${lock}>
                <input type="number" min="0" max="100" step="1" value="${p.pct}" data-i="${i}" data-field="pct" aria-label="% ${i + 1}" ${lock}>
                <span class="unc-rpm" data-rpm>${rpmHtml(kind, p.pct)}</span>
            </div>`).join('');

        box.querySelectorAll('input').forEach(input => {
            // An empty or out-of-range field keeps the last good value (Number('') would be 0); leaving the field shows it again.
            input.addEventListener('change', () => {
                input.value = state.curves[kind][Number(input.dataset.i)][input.dataset.field];
            });
            input.addEventListener('input', () => {
                if (input.value.trim() === '' || !input.validity.valid) return;
                const value = Number(input.value);
                if (!Number.isFinite(value)) return;
                state.curves[kind][Number(input.dataset.i)][input.dataset.field] = value;
                markDirty('curves', kind);
                state.saveError.curves = '';
                renderSaveBars();
                drawChart(kind);
                // The CPU curve feeds the case chart when the case fans help cool the CPU.
                if (kind === 'cpu') drawChart('case');
                paintMix();
                paintRpm(kind);
            });
        });
    }

    // The expected rpm next to each point.
    function paintRpm(kind) {
        const box = q(`[data-curve="${kind}"]`);
        box.querySelectorAll('[data-rpm]').forEach((element, i) => {
            const point = state.curves[kind][i];
            if (point) element.innerHTML = rpmHtml(kind, point.pct);
        });
    }

    // Always day.month.year, 24 h, whatever the UI language: "27.10.2026 23:41".
    const berlin = seconds => new Date(seconds * 1000).toLocaleString('de-DE', {
        timeZone: 'Europe/Berlin', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).replace(',', '');

    // Custom curves start with measuring the fans: a full explanation until it was done once, a summary line
    // afterwards, progress while it runs, the reason when it stopped.
    const CALIB_STEPS_PER_FAN = 12;
    const CALIB_SECONDS_PER_STEP = 11;
    const calibMinutes = steps => Math.max(1, Math.round(steps * CALIB_SECONDS_PER_STEP / 60));
    const calibTotalSteps = () => (state.data?.fans?.length || 0) * CALIB_STEPS_PER_FAN;

    // CPU fan and case fans with their measured rows (only those that were measured).
    function measuredFans() {
        const fans = state.data?.calibration?.table?.fans || {};
        return [['cpu', t('fan.cpu')], ['case', caseGroupName()]]
            .map(([kind, label]) => ({ kind, label, rows: fans[fanOfKind(kind)?.id] }))
            .filter(fan => fan.rows?.length);
    }

    // The lowest measured speed at which a fan turns, null when it never does.
    const spinsFrom = rows => rows.find(r => r[1] > 0)?.[0] ?? null;

    const calibRunning = () => state.data?.calibration?.progress?.state === 'running' || state.calibStarting;
    const calibFailed = () => {
        const calib = state.data?.calibration || {};
        const p = calib.progress;

        return !calibRunning() && Boolean(state.calibError || (p?.state === 'aborted' && p.time > (calib.table?.time || 0)));
    };

    // The stepper shows one step: the one clicked, else the first thing to do (measuring, then the curves).
    // A running measurement always shows itself; a failed one shows its error on the measure step but does not lock the stepper.
    function selectedStep() {
        if (calibRunning()) return 'measure';

        return state.flowStep || (measuredFans().length ? 'curves' : 'measure');
    }

    // Fans that stand still at the chosen lowest speed.
    function minStall() {
        return measuredFans().filter(fan => minPct() < (spinsFrom(fan.rows) ?? 101));
    }

    async function startMeasure(confirm) {
        if (confirm && !window.confirm(t('calib.confirm', { min: calibMinutes(calibTotalSteps()) }))) return;
        state.calibStarting = true;
        state.calibError = '';
        renderMeasure();
        try {
            await api({ action: 'calibrate' }, true);
        } catch (error) {
            state.calibError = error.message;
        }
        state.calibStarting = false;
        await load();
    }

    function measureBodyHtml(flow) {
        const calib = state.data?.calibration || {};
        const p = calib.progress;
        const hasFans = Boolean(state.data?.fans?.length);
        const measureAttrs = confirm => `data-measure${confirm ? ' data-confirm' : ''}${hasFans ? '' : ' disabled'}`;
        const button = (label, primary) => btn({ label, ico: 'fan', tone: primary ? 'primary' : '', attrs: measureAttrs(false) });
        const measured = measuredFans();

        if (calibRunning()) {
            const steps = p?.steps || calibTotalSteps();
            const running = p?.state === 'running';
            const step = running ? p.step : 0;
            const fan = (state.data?.fans || []).find(x => x.id === p?.fan);
            const live = fan?.rpm > 0 ? ` <span class="unc-muted">· ${escapeHtml(t('calib.live', { rpm: fan.rpm }))}</span>` : '';
            const now = running ? escapeHtml(t('calib.running', { fan: fan ? fanName(fan, state.data.fans) : p.fan, pct: p.pct })) + live : escapeHtml(t('calib.starting'));

            return note(`
                <p><strong>${now}</strong></p>
                <div class="unc-measure-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${steps}" aria-valuenow="${step}"><i style="width:${steps ? Math.round(step / steps * 100) : 0}%"></i></div>
                <p class="unc-muted">${escapeHtml(t('calib.step', { step, steps, min: calibMinutes(steps - step) }))}</p>
                <p class="unc-muted">${escapeHtml(t('calib.running_note'))}</p>`, { tone: 'warn', box: true, tag: 'div', attrs: 'role="status"' });
        }

        if (calibFailed()) {
            const text = state.calibError || t('calib.aborted', { reason: t(`calib.reason.${p.reason}`) });

            return note(`
                <p><strong>${escapeHtml(text)}</strong></p>
                <div>${button(t('calib.retry'), false)}</div>`, { tone: 'bad', box: true, tag: 'div', attrs: 'role="alert"' });
        }

        // Presets only get a status line; the explanation belongs to the custom flow.
        if (!flow) {
            return `<p class="unc-measure-line">${measured.length
                ? `<span class="unc-muted">${escapeHtml(measureSummary())}</span> ${linkBtn(t('calib.again'), measureAttrs(true))}`
                : `<span class="unc-muted">${escapeHtml(t('calib.hint_preset'))}</span> ${linkBtn(t('calib.button'), measureAttrs(false))}`}</p>`;
        }

        if (measured.length) {
            return note(`
                <p><strong>${escapeHtml(t('calib.done', { time: berlin(calib.table.time) }))}</strong></p>
                <ul class="unc-min-fans">${measured.map(fan => `<li>${escapeHtml(t('calib.fan_range', { fan: fan.label, lo: fan.rows[0][1], hi: fan.rows[fan.rows.length - 1][1], pct: spinsFrom(fan.rows) ?? 100 }))}</li>`).join('')}</ul>
                <p class="unc-muted">${escapeHtml(t('calib.gain_short'))}</p>
                <div>${linkBtn(t('calib.again'), measureAttrs(true))}</div>`, { box: true, tag: 'div' });
        }

        return note(`
            <p><strong>${escapeHtml(t('calib.lead', { min: calibMinutes(calibTotalSteps()) }))}</strong></p>
            <ul>
                <li>${escapeHtml(t('calib.gain_rpm'))}</li>
                <li>${escapeHtml(t('calib.gain_floor'))}</li>
            </ul>
            <p class="unc-muted">${escapeHtml(t('calib.what'))}</p>
            <div>${button(t('calib.button'), true)}</div>`, { box: true, tag: 'div' });
    }

    // "Measured 27.10.2026 12:01 · CPU fan 752–4060 rpm · case fan 192–1680 rpm"
    function measureSummary() {
        const ranges = measuredFans().map(fan => `${fan.label} ${fan.rows[0][1]}–${fan.rows[fan.rows.length - 1][1]} ${t('fan.rpm')}`);

        return [t('calib.done', { time: berlin(state.data.calibration.table.time) }), ...ranges].join(' · ');
    }

    // Per fan: where it starts turning and its rpm at the chosen lowest speed.
    function minFansHtml() {
        const measured = measuredFans();
        const min = minPct();

        if (!measured.length) return emptyText(t('curves.min_unmeasured'));

        return `<ul class="unc-min-fans">${measured.map(fan => {
            const from = spinsFrom(fan.rows);
            const stall = min < (from ?? 101);
            const text = stall
                ? t('curves.min_fan_stall', { fan: fan.label, from: from ?? 100, pct: min })
                : t('curves.min_fan', { fan: fan.label, from, rpm: rpmAt(fan.kind, min) ?? '—', pct: min });

            return `<li class="${stall ? 'is-warn' : ''}">${escapeHtml(text)}</li>`;
        }).join('')}</ul>`;
    }

    function renderMeasure() {
        const flow = curvesEditable();
        const measured = measuredFans();
        const running = calibRunning();
        const failed = calibFailed();
        const stalls = minStall().length > 0;
        const set = (id, html) => {
            const el = q(id);

            // Rebuilding only on change keeps a focused button focused between polls.
            if (el.dataset.html !== html) {
                el.dataset.html = html;
                el.innerHTML = html;
            }
        };

        q('#unc-flow').classList.toggle('on', flow);

        const points = name => state.curves?.[name]?.length || 0;
        const dirty = state.curvesDirty;
        const steps = {
            measure: {
                done: measured.length > 0 && !running && !failed,
                warn: failed || (!running && !measured.length),
                sum: running ? t('calib.running_title') : failed ? t('calib.failed_title') : measured.length ? t('calib.done', { time: berlin(state.data.calibration.table.time) }) : t('flow.unmeasured'),
            },
            min: {
                done: measured.length > 0 && !stalls,
                warn: stalls,
                sum: [`${minPct()} %`, ...(measured.length ? [`${measured.map(fan => rpmAt(fan.kind, minPct()) ?? '—').join(' / ')} ${t('fan.rpm')}`] : [])].join(' · '),
            },
            curves: {
                done: !dirty,
                warn: dirty,
                sum: [t('flow.curves_sum', { cpu: points('cpu'), case: points('case') }), ...(dirty ? [t('flow.unsaved')] : [])].join(' · '),
            },
        };
        const current = selectedStep();

        set('#unc-measure', measureBodyHtml(flow));
        set('#unc-min-measured', minFansHtml());

        Object.entries(steps).forEach(([step, info]) => {
            const selected = step === current;
            const tab = q(`#unc-t-${step}`);
            const sum = q(`#unc-sum-${step}`);

            tab.classList.toggle('done', info.done);
            tab.classList.toggle('warn', Boolean(info.warn));
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
            sum.textContent = info.sum;
            q(`#unc-p-${step}`).classList.toggle('sel', selected);
        });
        queueDock();
    }

    // Tabs: click or arrow keys select a step; the panel below shows it.
    function selectStep(step) {
        state.flowStep = step;
        renderMeasure();
    }

    // The fan pages save on request: the bar shows whether something is unsaved, the sidebar entry carries a dot.
    function renderSaveBars() {
        [['curves', state.curvesDirty], ['safety', state.safetyDirty]].forEach(([name, dirty]) => {
            const bar = q(`[data-savebar="${name}"]`);
            // A failed save keeps the changes and says why, instead of "Everything saved".
            const error = dirty ? state.saveError[name] : '';

            bar.classList.toggle('dirty', dirty);
            bar.classList.toggle('failed', Boolean(error));
            if (!dirty) state.touched[name].clear();
            const what = [...state.touched[name]].map(w => t(`save.what.${w}`)).join(', ');
            bar.querySelector('.unc-savestate').textContent = error ? t('save.failed', { error })
                : dirty ? (name === 'curves' && state.arm ? t('save.arm') : t('save.dirty', { what }))
                : t(state.saved[name] ? 'save.done' : 'save.clean');
            bar.querySelectorAll('button').forEach(button => { button.disabled = !dirty; });
            q(`.unc-nav [data-nav="${name}"]`).classList.toggle('dirty', dirty);
        });
        if (state.data) renderMeasure();
        queueDock();
    }

    // Keeps the save bar of the visible page in view: fixed above Unraid's footer while its place in the card is
    // below the bottom of the window.
    let dockFrame = 0;
    function floatSaveBars() {
        dockFrame = 0;
        const footer = document.getElementById('footer')?.offsetHeight || 0;
        const limit = window.innerHeight - footer;

        qa('.unc-savedock').forEach(dock => {
            const bar = dock.firstElementChild;
            if (!dock.offsetParent) return;

            bar.classList.remove('float');
            bar.style.cssText = '';
            dock.style.minHeight = `${bar.offsetHeight}px`;
            const rect = dock.getBoundingClientRect();
            if (rect.bottom <= limit) return;

            bar.classList.add('float');
            // Unraid's scroll-to-top arrow sits at the right edge of the window: the bar stops short of it.
            const width = Math.min(rect.width, window.innerWidth - 56 - rect.left);
            bar.style.cssText = `left:${rect.left}px;width:${width}px;bottom:${footer}px`;
        });
    }

    const queueDock = () => { dockFrame = dockFrame || requestAnimationFrame(floatSaveBars); };

    // Every edit counts, so a save only clears the flag if nothing changed while it was running.
    function markDirty(name, what) {
        state[`${name}Dirty`] = true;
        state.saved[name] = false;
        if (what) state.touched[name].add(what);
        state.edits[name] = (state.edits[name] || 0) + 1;
    }

    // Saves a fan page: the unsaved flag is cleared only once the API has confirmed, a failure keeps it.
    async function saveFanPage(name, call, success) {
        const edits = state.edits[name];
        state.saveError[name] = '';

        await run(async () => {
            try {
                await call();
            } catch (error) {
                state.saveError[name] = error.message;
                throw error;
            }

            if (state.edits[name] === edits) {
                state[`${name}Dirty`] = false;
                state.saved[name] = true;
            }
        }, success);
        renderSaveBars();
    }

    // What the curve area shows depends on the mode: nothing for BIOS and Full speed (the mode note says it), a preview
    // for the presets, the editor for Custom.
    function renderCurvesMode() {
        const mode = state.data?.settings?.mode || 'standard';
        const noCurves = mode === 'bios' || mode === 'full';
        const editable = curvesEditable();
        const name = t(`mode.${mode}`);

        q('#unc-curves-block').hidden = noCurves;
        q('#unc-limits-block').hidden = noCurves || editable;
        // Custom curves: the lowest speed is step 2 of the flow; the presets keep it below the curves.
        const limits = q('#unc-limits-body');
        const home = editable ? q('#unc-step-min-body') : q('#unc-limits-block');

        if (limits.parentNode !== home) home.appendChild(limits);
        q('#unc-curves-title').textContent = mode === 'custom' ? t('curves.heading') : t('curves.heading_mode', { mode: name });
        q('#unc-curves-note').textContent = state.arm ? t('curves.armed', { mode: name }) : editable ? '' : t(state.caseFollows ? 'curves.readonly_mix' : 'curves.readonly', { mode: name });
        q('#unc-curves-note').hidden = !q('#unc-curves-note').textContent;
        q('#unc-customize').hidden = editable;
        q('#unc-curve-tools').hidden = !editable;
        qa('.unc-curves .unc-points input').forEach(input => { input.disabled = !editable; });
        qa('.unc-curves').forEach(el => el.classList.toggle('readonly', !editable));
    }

    function discardCurves() {
        state.curvesDirty = false;
        state.arm = false;
        state.saveError.curves = '';
        state.curves = activeCurves();
        state.caseFollows = state.data?.settings?.case_follows_cpu === true;
        state.minEdit = null;
        buildPoints('cpu');
        buildPoints('case');
        renderCurves();
        renderSaveBars();
    }

    function renderCurves() {
        // Rebuilding would take the focus out of a field the user just clicked into.
        if (!state.curvesDirty && !q('.unc-curves').contains(document.activeElement)) {
            state.curves = activeCurves();
            state.caseFollows = state.data?.settings?.case_follows_cpu === true;
            state.minEdit = null;
            buildPoints('cpu');
            buildPoints('case');
        }
        renderCurvesMode();
        q('#unc-case-cpu').checked = state.caseFollows;
        q('#unc-curve-min').value = minPct();
        showCurveMin();
        drawChart('cpu');
        drawChart('case');
        paintMix();
        paintRpm('cpu');
        paintRpm('case');
        q('#unc-case-title').textContent = caseGroupName();
        q('#unc-case-src').textContent = t('curves.case_source', { offset: caseSource().offset });
        renderNow();
        renderMeasure();
    }

    const validCurve = points => points.length >= 2 && points.every((p, i) =>
        Number.isInteger(p.temp) && Number.isInteger(p.pct) &&
        p.temp >= 0 && p.temp <= 120 && p.pct >= 0 && p.pct <= 100 &&
        (i === 0 || p.temp > points[i - 1].temp));

    /* Safety */

    const SAFETY = [
        { id: 'cpu-crit', key: 'cpu_crit', unit: '°C' },
        { id: 'disk-crit', key: 'disk_crit', unit: '°C' },
        { id: 'nvme-offset', key: 'nvme_offset', unit: '°C' }
    ];

    function showSafetyValue(field) {
        const input = q(`#unc-${field.id}`);
        setRangeFill(input);
        q(`#unc-${field.id}-value`).textContent = `${input.value} ${field.unit}`;
    }

    // Every disk and NVMe as a tile to tick the ones that must not drive the case fans: where it sits and its Unraid
    // name ("Bay 4 · parity", "M.2-1 · cache"), the device id as small text, the live temperature on the right.
    function renderIgnoreList() {
        const sensors = state.data?.sensors || {};
        const ignored = new Set(state.data?.settings?.ignore_drives || []);
        const bays = state.hw?.bays || [];
        const slots = state.hw?.nvme || [];
        const drives = [
            ...(sensors.disks || []).filter(d => d.name !== 'flash').map(d => {
                const bay = bays.find(b => b.device === d.device);

                return { name: d.name, ico: icon('drives'), label: bay ? `${t('sensors.bay', { n: bay.bay })} · ${d.name}` : d.name, sub: [d.device, friendly(bay?.model)], temp: d.standby ? standbyBadge() : tempOf(d.temp, d.hdd ? 'disk' : 'nvme') };
            }),
            ...(sensors.nvme || []).map(n => {
                const slot = slots.find(h => h.id === n.name);

                return { name: n.name, ico: slot?.boot ? UNRAID_MARK : icon('m2'), label: slot ? [ssdSlotLabel(slot), slot.role].filter(Boolean).join(' · ') : n.name, sub: [n.name, friendly(slot?.model)], temp: tempOf(n.temp, 'nvme') };
            })
        ].filter(d => d.name);

        q('#unc-ignore-list').innerHTML = drives.length ? drives.map(d => chipCheck(`data-ignore="${escapeHtml(d.name)}"`, ignored.has(d.name), `
            ${glyph(d.ico, 'lg')}
            <span class="unc-cc-name"><strong>${escapeHtml(d.label)}</strong><small class="unc-muted">${escapeHtml(d.sub.filter(Boolean).join(' · '))}</small></span>
            <span class="unc-cc-temp">${d.temp}</span>`)).join('') : emptyText(t('safety.ignore_none'));
    }

    // The ticked names, plus saved ones whose drive isn't listed right now (unplugged, asleep): they stay saved.
    function ignoredDrives() {
        const shown = new Set(qa('#unc-ignore-list [data-ignore]').map(box => box.dataset.ignore));
        const kept = (state.data?.settings?.ignore_drives || []).filter(name => !shown.has(name));

        return [...qa('#unc-ignore-list [data-ignore]:checked').map(box => box.dataset.ignore), ...kept].join(',');
    }

    // The allowance with today's numbers, using the slider's value so the example follows the edit: the hottest NVMe
    // minus the offset is what the case curve sees, as long as no disk is warmer (the daemon's rule).
    function renderNvmeEquation() {
        const { nvme, label, disk } = caseSource();
        const offset = Number(q('#unc-nvme-offset').value);
        const eff = nvme == null ? null : nvme - offset;
        const term = (name, value, cls = '') => `<span class="unc-eq-term ${cls}"><small>${escapeHtml(name)}</small><b>${escapeHtml(value)}</b></span>`;
        const op = sign => `<span class="unc-eq-op">${sign}</span>`;
        const drives = disk == null || disk < eff;

        q('#unc-nvme-eq').innerHTML = nvme == null ? emptyText(t('safety.eq_none')) : `
            ${term(label, deg(nvme))}${op('−')}${term(t('safety.nvme_offset'), deg(offset))}${op('=')}${term(t('safety.eq_case'), deg(eff), 'is-result')}
            ${drives ? pill({ tone: 'accent', ico: 'fan', text: t('sensors.drives_case') }) : pill({ text: t('safety.eq_disk') })}`;
    }

    // Each limit with the live temperature: how far below it is (a bar of temperature over limit), amber when the
    // limit is at or below it and the fans would run at 100 % right now. The limits count as shown in the sliders,
    // so an edit is judged before it is saved. The NVMe limit is the disk limit plus the offset (the daemon's rule).
    function renderLimitsLive() {
        const { disk, nvme } = caseSource();
        const diskCrit = Number(q('#unc-disk-crit').value);
        const offset = Number(q('#unc-nvme-offset').value);
        const rows = [
            ['cpu', state.data?.sensors?.cpu, Number(q('#unc-cpu-crit').value), 'safety.now_none_cpu'],
            ['disk', disk, diskCrit, 'safety.now_disks_asleep'],
            ['nvme', nvme, diskCrit + offset, 'safety.now_no_nvme']
        ];

        q('#unc-nvme-crit-value').textContent = `${diskCrit + offset} °C`;
        q('#unc-nvme-derived').textContent = t('safety.derived', { disk: diskCrit, offset });
        rows.forEach(([id, now, limit, none]) => {
            const reached = now != null && now >= limit;
            const near = now != null && limit - now <= 10;
            const live = q(`#unc-live-${id}`);

            live.textContent = now == null ? t(none) : t(reached ? 'safety.reached' : 'safety.headroom', { temp: deg(now), gap: limit - now });
            // An unreadable CPU puts the fans at 100 % too.
            live.classList.toggle('is-warn', reached || (id === 'cpu' && now == null));
            q(`#unc-meter-${id}`).innerHTML = meter(now == null ? 0 : Math.min(100, Math.round(now / limit * 100)), reached ? 'bad' : near ? 'warn' : '');
        });
    }

    function renderSafetyLive() {
        renderNvmeEquation();
        renderLimitsLive();
    }

    function renderSafety() {
        if (state.safetyDirty) return renderSafetyLive();
        const settings = state.data?.settings || {};
        renderIgnoreList();

        SAFETY.forEach(field => {
            if (settings[field.key] != null) q(`#unc-${field.id}`).value = settings[field.key];
            showSafetyValue(field);
        });
        q('#unc-stall-notify').checked = settings.stall_notify !== false;
        renderSafetyLive();
    }

    function discardSafety() {
        state.safetyDirty = false;
        state.saveError.safety = '';
        renderSafety();
        renderSaveBars();
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
        q('#unc-led-import').hidden = !led.import_available;
        // The LED pages come with the page itself: they are there once it has been loaded with the switch on.
        // Without them the LEDs group is the overview with the switch.
        qa('[data-led-only]').forEach(button => { button.hidden = !(led.enabled && window.UNC_LED); });

        q('#unc-led-limited').hidden = fanKnown();
        q('#unc-led-limited').textContent = fanKnown() ? '' : t(caseKnown() ? 'leds.limited_fans' : 'leds.limited', { model: led.model || '?' });
        q('#unc-led-untested').hidden = !led.untested;
        q('#unc-led-untested').textContent = led.untested ? t('leds.untested', { model: led.model || '?' }) : '';

        // A blocker keeps the part off; a warning (the plugin UGREEN LED Control is installed too) only tells.
        const note = led.blocker ? `leds.blocker_${led.blocker}` : led.warning ? `leds.warn_${led.warning}` : '';
        blocker.hidden = !note;
        blocker.textContent = note ? t(note, { model: led.model || '?' }) : '';
    }

    function render() {
        keepScroll(drawAll);
    }

    function drawAll() {
        renderHead();
        if (!state.data?.ok) return;

        renderFans();
        renderModes();
        renderSystem();
        renderModels();
        renderConfirm();
        renderCurves();
        renderSafety();
        renderSaveBars();
        renderLeds();
        renderHero();
        renderOverview();
        renderSensors();
        // Fan control and the case pictures exist for the two models whose wiring is known.
        qa('[data-nav="case"]').forEach(el => { el.hidden = !caseKnown(); });
        // Off: the fan pages and the fan card are out of the way; the switch stays under Settings.
        qa('[data-fan-only]').forEach(el => { el.hidden = !fanKnown() || fanOff(); });
        qa('[data-fan-model]').forEach(el => { el.hidden = !fanKnown(); });
        qa('[data-nofan-model]').forEach(el => { el.hidden = fanKnown() || !modelName(); });
        renderFanSwitch();
        // The case picture shows the fan's live speed.
        if (state.hw && state.nav === 'case') renderRear(state.hw);
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

    // Installed memory in MB: the sum of the modules, else what the kernel reports (a bit less).
    const ramMB = info => (state.hw?.memory || []).reduce((sum, m) => sum + (m.size_mb > 0 ? m.size_mb : 0), 0) || (info?.memory_kb ? info.memory_kb / 1024 : 0);

    const fmtRam = mb => mb >= 1024 ? `${Math.round(mb / 1024)} GB` : `${mb} MB`;

    function tempClass(temp, kind) {
        if (temp == null) return '';
        const [warm, hot] = LIMITS[kind];
        return temp >= hot ? 'hot' : temp >= warm ? 'warm' : 'ok';
    }

    const tempBadge = ({ text, level = '' }) => `<b class="unc-t${level ? ` ${level}` : ''}">${escapeHtml(text)}</b>`;

    const tempOf = (temp, kind) => temp == null ? '' : tempBadge({ text: deg(temp), level: tempClass(temp, kind) });

    // A sleeping drive: the one look for it everywhere (level na is muted).
    const standbyVal = () => ({ text: t('case.standby'), level: 'na' });
    const standbyBadge = () => tempBadge(standbyVal());

    // A label (with icon, sub text) and a value. cls: is-stack (label over value), is-row (label left, value right),
    // is-lg (big figure), is-end (right aligned). value is html; text and level make a tempBadge. after: html behind the value.
    const statChip = ({ ico = '', label = '', sub = '', value = '', text = '', level = '', hint = '', cls = '', after = '' }) => `
        <span class="unc-stat${cls ? ` ${cls}` : ''}"${hint ? ` title="${escapeHtml(hint)}"` : ''}>${label || ico ? `<small class="unc-muted">${ico ? glyph(ico) : ''}${escapeHtml(label)}${sub ? ` <em>${escapeHtml(sub)}</em>` : ''}</small>` : ''}${text ? tempBadge({ text, level }) : value}${after}</span>`;

    function speedText(mbit) {
        if (mbit >= 1000) return `${mbit / 1000} Gbit/s`;
        return `${mbit} Mbit/s`;
    }

    // Port drawings, after the real sockets.
    const SOCKET = {
        usbc: '<svg viewBox="0 0 40 18"><rect x="3" y="3" width="34" height="12" rx="6" class="shell"/><rect x="9" y="7" width="22" height="4" rx="2" class="tongue"/></svg>',
        usba: '<svg viewBox="0 0 40 20"><rect x="2" y="2" width="36" height="16" rx="2" class="shell"/><rect x="6" y="8" width="28" height="5" class="tongue blue"/></svg>',
        usb2: '<svg viewBox="0 0 40 20"><rect x="2" y="2" width="36" height="16" rx="2" class="shell"/><rect x="6" y="8" width="28" height="5" class="tongue"/></svg>',
        hdmi: '<svg viewBox="0 0 48 20"><path d="M3 3h42v8l-5 6H8l-5-6z" class="shell"/><rect x="9" y="7" width="30" height="4" class="tongue"/></svg>',
        sd: '<svg viewBox="0 0 48 12"><rect x="1" y="3" width="46" height="6" rx="1" class="shell"/><rect x="5" y="5.2" width="38" height="1.6" rx=".8" class="tongue"/></svg>',
        usb2x2: '<svg viewBox="0 0 40 36"><rect x="2" y="2" width="36" height="14" rx="2" class="shell"/><rect x="6" y="7" width="28" height="4" class="tongue"/><rect x="2" y="20" width="36" height="14" rx="2" class="shell"/><rect x="6" y="25" width="28" height="4" class="tongue"/></svg>',
        dc: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" class="shell"/><circle cx="16" cy="16" r="5" class="tongue"/><circle cx="16" cy="16" r="1.6" class="pins"/></svg>',
        reset: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" class="shell"/><circle cx="10" cy="10" r="2" class="tongue"/></svg>',
        ac: '<svg viewBox="0 0 56 34"><rect x="2" y="2" width="52" height="30" rx="3" class="shell"/><rect x="14" y="8" width="8" height="12" rx="1" class="tongue"/><rect x="34" y="8" width="8" height="12" rx="1" class="tongue"/><rect x="24" y="22" width="8" height="6" rx="1" class="tongue"/></svg>'
    };

    // Traffic level of a NIC (0 idle, 1 any, 2 from 1 MB/s, 3 from 50 MB/s), from the byte counters of the status poll.
    const netPrev = new Map();
    const netAct = new Map();
    const NET_ACT_STEPS = [50e6, 1e6, 1];

    function updateNetAct(list) {
        const now = Date.now();

        for (const n of Array.isArray(list) ? list : []) {
            const prev = netPrev.get(n.name);

            if (prev && now - prev.t < 1000) continue; // the same response again (shared poll): keep the level
            netPrev.set(n.name, { rx: n.rx, tx: n.tx, t: now });
            if (!prev || n.rx < prev.rx || n.tx < prev.tx) {
                netAct.set(n.name, 0); // first sample or counter reset
                continue;
            }
            const rate = (n.rx - prev.rx + n.tx - prev.tx) / ((now - prev.t) / 1000);
            const i = NET_ACT_STEPS.findIndex(min => rate >= min);

            netAct.set(n.name, i < 0 ? 0 : 3 - i);
        }
    }

    // Sets the level on drawn sockets that render() left in place; redrawn ones get it from rj45().
    function paintNetAct() {
        qa('.rj[data-nic]').forEach(el => {
            const level = netAct.get(el.dataset.nic) || 0;

            el.classList.remove('act-1', 'act-2', 'act-3');
            if (level) el.classList.add(`act-${level}`);
        });
    }

    const rj45 = (link, speed, nic = '') => `
        <svg viewBox="0 0 56 52" class="rj ${link ? 'up' : ''}${netAct.get(nic) ? ` act-${netAct.get(nic)}` : ''}"${nic ? ` data-nic="${escapeHtml(nic)}"` : ''}>
            <rect x="2" y="2" width="52" height="48" rx="3" class="shell"/>
            <rect x="9" y="14" width="38" height="28" rx="2" class="tongue"/>
            <path d="M14 14v8M20 14v8M26 14v8M32 14v8M38 14v8M44 14v8" class="pins"/>
            <rect x="6" y="5" width="10" height="5" rx="1" class="led link"/>
            <rect x="40" y="5" width="10" height="5" rx="1" class="led act ${speed >= 10000 ? 'fast' : ''}"/>
        </svg>`;

    // Sockets per model as [drawing, label]; rear labels are i18n keys, a LAN port is ['lan', index of
    // the interface] in the order it sits on the panel.
    // pcie: the model has a PCIe slot. Any model not listed is drawn like the DXP6800 Pro.
    // strip: front strip with a power button and one LED per LAN / bay (no model uses it now: all have the bay LEDs
    // below the bays like the DXP6800 Pro).
    // fan: the rear fan behind its dust filter. hint: i18n key of the note below the inside view.
    const CASE_DEFAULT = {
        front: [['sd', 'SD'], ['usbc', 'TB4'], ['usbc', 'TB4'], ['usba', '10G']],
        // The back of the DXP6800 Pro is drawn after a photo of the device (rear6800Html).
        rear6800: true,
        rear: [],
        // The inside of the DXP6800 Pro is drawn after a photo of the board (inside6800Html).
        inside6800: true,
        pcie: true,
        sys: true,
        hint: 'case.inside_hint'
    };

    const CASE_MODELS = [
        // DXP4800 GT: the chassis of the DXP4800 Plus (mesh filter with the fan behind it, the ports in one row below),
        // but two 10G LAN ports.
        [/^DXP4800 GT/, {
            front: [['sd', 'SD'], ['usbc', '10G'], ['usba', 'USB3.2']],
            rear4800: true,
            lanLabels: ['LAN 10G', 'LAN 10G'],
            rear: [],
            pcie: false
        }],
        // DXP4800, DXP4800 Plus and DXP4800 Pro: one chassis, drawn after a photo of the Plus. The slots of the
        // M.2 SSDs are not known, so there is no inside view; no fan control either.
        // DXP2800: a shrunken DXP4800, drawn after photos: two bays, USB-C and USB-A at the front (no SD slot), one
        // 2.5G LAN port at the back. No inside view, no fan control.
        [/^DXP2800$/, {
            front: [['usbc', '10G'], ['usba', '10G']],
            rear2800: true,
            rear: [],
            noInside: true
        }],
        // DXP2800 GT: the same chassis in black with a grille like the DXP4800 GT; one 10G LAN port. Drawn after the
        // product photos. No inside view, no fan control.
        [/^DXP2800 GT/, {
            front: [['usbc', '10G'], ['usba', '10G']],
            gt: true,
            rear2800: true,
            lan: 'LAN 10G',
            dc: 'DC 12V',
            rear: [],
            noInside: true
        }],
        // iDX6011 and iDX6011 Pro: six bays and a small display at the front, the ports like the DXP6800 Pro's;
        // the back after a photo (PCIe slot, mesh, vent, power inlet). No inside view, no fan control.
        [/^iDX6011( Pro)?$/, {
            front: [['sd', 'SD'], ['usbc', 'TB4'], ['usbc', 'TB4'], ['usba', '10G']],
            screen: true,
            rear6011: true,
            rear: [],
            noInside: true
        }],
        // DXP8800 Plus: eight bays; the back after a photo (rear8800Html). No inside view, no fan control.
        [/^DXP8800 Plus$/, {
            front: [['sd', 'SD'], ['usbc', 'TB4'], ['usbc', 'TB4'], ['usba', '10G']],
            rear8800: true,
            rear: [],
            noInside: true
        }],
        [/^DXP4800( Plus| Pro)?$/, {
            front: [['sd', 'SD'], ['usbc', '10G'], ['usba', '10G']],
            rear4800: true,
            rear: [],
            noInside: true
        }]
    ];

    // Fan control exists for the two models whose wiring is known; the case pictures also for the DXP4800 family,
    // drawn after the DXP4800 Plus; elsewhere the pages stay out of the way.
    const modelName = () => state.hw?.model || state.data?.info?.model || '';
    const fanKnown = () => /^(DXP6800|DXP4800.*GT)/.test(modelName());
    const fanOff = () => state.data?.settings?.fan_control === false;
    const caseKnown = () => fanKnown() || /^(DXP4800( Plus| Pro)?|DXP8800 Plus|DXP2800( GT)?|iDX6011( Pro)?)$/.test(modelName());

    const caseModel = hw => (CASE_MODELS.find(([re]) => re.test(hw.model || '')) || [null, CASE_DEFAULT])[1];

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
        const info = bay.standby ? t('case.standby') : deg(bay.temp);
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

    function renderFront(hw, target = '#unc-front') {
        const net = hw.net;
        const lan = net.some(n => n.link);
        const speeds = net.map(n => `<span>${n.link ? speedText(n.speed_mbit) : '✕'}</span>`).join('');

        const model = caseModel(hw);
        const ports = `<span class="unc-front-ports">${model.front.map(([kind, label]) => socket(kind, label)).join('')}</span>`;
        const led = (label, on, key) => `<span class="unc-led"><span class="unc-pled ${on ? 'on' : ''}" data-led="${key}"></span><span class="lbl">${escapeHtml(label)}</span></span>`;
        const strip = model.strip ? `
                <div class="unc-nas-front">
                    <span class="unc-pbtn"><span class="unc-pled power"></span></span>
                    <span class="unc-leds">${led('LAN', lan, 'netdev')}${(hw.bays || []).map(b => led(`DISK${b.bay}`, b.present, `disk${b.bay}`)).join('')}</span>
                    <span class="spacer"></span>
                    ${ports}
                </div>
                <div class="unc-nas-model">${escapeHtml(hw.model)}</div>` : `
                <div class="unc-nas-front">
                    <span class="unc-pled power"></span><span class="lbl">${escapeHtml(t('case.power'))}</span>
                    <span class="unc-pled lan ${lan ? 'on' : ''}"></span><span class="lbl">LAN</span>
                    <span class="speeds">${speeds}</span>
                    <span class="spacer"></span>
                    ${ports}
                    <b class="brand">UGREEN</b>
                </div>`;

        q(target).innerHTML = `
            <div class="unc-nas" style="--bays:${(hw.bays || []).length || 6}">
                <div class="unc-nas-bays ${model.screen ? 'with-screen' : ''}">${(hw.bays || []).map(bayHtml).join('')}${model.screen ? '<div class="unc-nscreen" aria-hidden="true"><i></i><b></b></div>' : ''}</div>${strip}
            </div>`;
        applyLeds(q(target));
    }

    // A drive drawn as what it is: a 3.5" hard disk with its platter, or a slim SSD board.
    const DRIVE_HDD_SVG = '<svg viewBox="0 0 72 48" aria-hidden="true"><rect x="2" y="2" width="68" height="44" rx="6" class="d-body"/><circle cx="26" cy="24" r="15" class="d-plat"/><circle cx="26" cy="24" r="4" class="d-hub"/><path d="M26 24 52 9" class="d-arm"/><rect x="50" y="30" width="16" height="11" rx="2" class="d-label"/></svg>';
    const DRIVE_SSD_SVG = '<svg viewBox="0 0 72 48" aria-hidden="true"><rect x="2" y="8" width="68" height="32" rx="5" class="d-ssd"/><rect x="9" y="15" width="14" height="18" rx="2" class="d-chip"/><rect x="27" y="15" width="14" height="18" rx="2" class="d-chip"/><rect x="45" y="15" width="18" height="18" rx="2" class="d-label"/></svg>';

    // "disk1" -> "Array disk 1" and so on; a name Unraid gave a pool stays as it is.
    function driveRoleText(role) {
        const disk = /^disk(\d+)$/.exec(role || '');

        if (disk) return t('drv.role_array', { n: disk[1] });
        if (role === 'parity' || role === 'parity2') return t('drv.role_parity');
        if (role === 'cache') return t('drv.role_cache');
        return role || '';
    }

    function driveCard(bay) {
        const temp = bay.standby ? standbyBadge() : tempOf(bay.temp, bay.hdd ? 'disk' : 'nvme') || tempBadge({ text: '–', level: 'na' });

        return `
            <div class="unc-dcard">
                <div class="d-top"><b class="d-bay">${String(bay.bay).padStart(2, '0')}</b>${pill({ text: driveRoleText(bay.role) || '–' })}</div>
                <div class="d-main">
                    <div class="d-pic ${bay.hdd ? 'hdd' : 'ssd'}">${bay.hdd ? DRIVE_HDD_SVG : DRIVE_SSD_SVG}</div>
                    <div class="d-info">
                        <strong title="${escapeHtml(friendly(bay.model || bay.id))}">${escapeHtml(friendly(bay.model || bay.id) || '–')}</strong>
                        <span>${escapeHtml([fmtSize(bay.size_bytes), t(bay.hdd ? 'case.hdd' : 'case.ssd')].filter(Boolean).join(' · '))}</span>
                        <small class="unc-muted unc-id" title="${escapeHtml([bay.device, friendly(bay.id)].filter(Boolean).join(' · '))}">${escapeHtml(driveSerial(bay))}</small>
                    </div>
                </div>
                <div class="d-temp">${meter(!bay.standby && bay.temp != null ? Math.min(100, bay.temp) : 0)}${temp}</div>
            </div>`;
    }

    function renderDriveList(hw) {
        const bays = hw.bays || [];

        q('#unc-drive-list').innerHTML = bays.some(b => b.present) ? `
            <div class="unc-dcards">${bays.map(b => b.present ? driveCard(b) : `
                <div class="unc-dcard empty"><div class="d-top"><b class="d-bay">${String(b.bay).padStart(2, '0')}</b>${pill({ text: t('case.empty_bay') })}</div></div>`).join('')}
            </div>` : emptyText(t('case.empty'));
    }

    // The same fan as in the GT's rear picture; it turns with the real rpm like the fan tiles.
    const REAR_FAN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" class="ring"/><circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 2 0 3 2 2 4l-4 3.5M14 12c4 0 7 1 7 4 0 2-2 3-4 2l-3.5-4M12 14c0 4-1 7-4 7-2 0-3-2-2-4l4-3.5M10 12c-4 0-7-1-7-4 0-2 2-3 4-2l3.5 4"/></svg>';

    const fanStalled = fan => Boolean(fan) && Boolean(state.data?.running && state.data.daemon?.stalled?.includes(fan.id));

    // "Case fan · 827 rpm · 40 %" under a fan of the rear picture; "stopped" in red when it stalled.
    function rearFanText(fan, n) {
        if (!fan) return t('fan.case', { n });
        const rpm = fan.rpm > 0 ? `${fan.rpm} ${t('fan.rpm')}` : t('fan.stopped');
        return [fanName(fan, state.data.fans), rpm, fan.pct != null ? `${fan.pct} %` : ''].filter(Boolean).join(' · ');
    }

    // The two case fans: they sit behind the blende and show through the mesh, turning with their rpm.
    function rearFansHtml(count) {
        const fans = (state.data?.fans || []).filter(f => f.role === 'case').slice(0, count);

        return Array.from({ length: count }, (_, i) => {
            const fan = fans[i];
            const spin = fan ? fanIcon(fan, REAR_FAN_SVG) : `<span class="unc-fan-icon">${REAR_FAN_SVG}</span>`;

            return `<div class="r-fan ${fanStalled(fan) ? 'stalled' : ''}">${spin}<small>${escapeHtml(rearFanText(fan, i + 1))}</small></div>`;
        }).join('');
    }

    // The back of the DXP6800 Pro after a photo of the device: black body with silver side rims, the big blende
    // (mesh with the UGREEN lettering, the two fans behind it), the PCIe slot on the left, below it the
    // sockets (HDMI, USB 3.2, two USB 2.0, two 10GbE, reset), the power inlet with the PSU fan, the Kensington
    // slot. Positions are in per cent of the picture, so everything scales.
    function rear6800Html(hw) {
        const lan = n => {
            const p = hw.net[n];
            const up = Boolean(p && p.link);

            return `<div class="r-abs r-lan ${up ? 'up' : ''}" style="left:${n ? 39.9 : 32.7}%;top:82%">
                ${rj45(up, p ? p.speed_mbit : 0, p ? p.name : '')}<b>LAN 10G</b><em>${escapeHtml(up ? speedText(p.speed_mbit) : t('case.no_link'))}</em></div>`;
        };
        const port = (x, y, kind, label, cls = '') => `<div class="r-abs r-${cls || kind}" style="left:${x}%;top:${y}%">${SOCKET[kind]}<b>${label}</b></div>`;
        const dots = r => `<circle r="${r}" fill="none" stroke="#8a939e" stroke-width="2.7" stroke-linecap="round" stroke-dasharray="0.1 ${(2 * Math.PI * r / Math.round(2 * Math.PI * r / 6.5)).toFixed(2)}"/>`;
        const screw = (x, y) => `<i class="r-screw" style="left:${x}%;top:${y}%"></i>`;

        return `
            <div class="unc-rear6800">
                <div class="r-body"></div>
                ${screw(3.4, 4.2)}${screw(50.1, 4.2)}${screw(96.5, 4.2)}${screw(3.4, 89.7)}${screw(50.1, 89.7)}${screw(96.5, 89.7)}
                <div class="r-blende">
                    <div class="r-fans">${rearFansHtml(2)}</div>
                    <div class="r-mesh"></div>
                    <svg class="r-brand" viewBox="0 0 190 40" aria-label="UGREEN"><text x="95" y="31" text-anchor="middle" font-family="Arial Black, Helvetica, Arial, sans-serif" font-size="37" font-weight="900" fill="rgba(255,255,255,.1)" stroke="#e9edf1" stroke-width="1.2" stroke-dasharray="1 2.2">UGREEN</text></svg>
                </div>
                <div class="r-pcie"><b>PCIE</b><i></i></div>
                ${port(11.4, 82.2, 'hdmi', 'HDMI')}
                ${port(18.3, 82, 'usba', 'USB3.2')}
                <div class="r-abs r-usb2" style="left:25.4%;top:79.8%">${SOCKET.usb2}<b>USB2.0</b>${SOCKET.usb2}<b>USB2.0</b></div>
                ${lan(0)}${lan(1)}
                ${port(45.3, 80.9, 'reset', 'RESET')}
                <div class="r-psu"></div>
                <div class="r-abs r-inlet" style="left:69.7%;top:81.7%">
                    <svg viewBox="0 0 56 72" aria-hidden="true"><rect x="2" y="2" width="52" height="68" rx="5" fill="#1d2127" stroke="#9aa3ad" stroke-width="2.600"/><rect x="7" y="7" width="42" height="58" rx="3" fill="#0b0d10" stroke="#59626e" stroke-width="1.400"/><path d="M12 13h32v28a7 7 0 0 1-7 7H19a7 7 0 0 1-7-7z" fill="#171b20" stroke="#9aa3ad" stroke-width="1.600"/><rect x="23.500" y="17" width="9" height="14" rx="1.800" fill="#aeb6bf"/><rect x="13.500" y="30" width="9" height="14" rx="1.800" fill="#aeb6bf" transform="rotate(-22 18 37)"/><rect x="33.500" y="30" width="9" height="14" rx="1.800" fill="#aeb6bf" transform="rotate(22 38 37)"/></svg>
                </div>
                <div class="r-abs r-psufan" style="left:82%;top:81.5%">
                    <svg viewBox="-44 -44 88 88" aria-hidden="true"><title>${escapeHtml(t('case.psu_fan_hint'))}</title><circle r="42" fill="#101317" stroke="#8f99a4" stroke-width="2.600"/><g class="r-psu-blades" style="animation-delay:-${((performance.now() / 1000) % 1.1).toFixed(3)}s" fill="none" stroke="#69747f" stroke-width="1.700" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(-37 -37) scale(3.083)"><circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 2 0 3 2 2 4l-4 3.500M14 12c4 0 7 1 7 4 0 2-2 3-4 2l-3.500-4M12 14c0 4-1 7-4 7-2 0-3-2-2-4l4-3.500M10 12c-4 0-7-1-7-4 0-2 2-3 4-2l3.500 4"/></g></g><circle r="40" fill="none" stroke="#2a2f36" stroke-width="1.200"/>${dots(5)}${dots(13)}${dots(21)}${dots(29)}${dots(36)}</svg>
                </div>
                <i class="r-kens" style="left:96.4%;top:78.2%"></i>
                <i class="r-foot" style="left:5.4%"></i><i class="r-foot" style="left:87.2%"></i>
            </div>`;
    }

    // The UGREEN lettering of the DXP4800 family: perforated like the real one (the letters are filled with a dot grid).
    const BRAND_DOTS_SVG = '<svg class="r-brand dots" viewBox="0 0 560 130" aria-label="UGREEN"><defs><pattern id="unc-dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2.7"/></pattern></defs><text x="280" y="115" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="140" font-weight="500" textLength="540" lengthAdjust="spacingAndGlyphs" fill="url(#unc-dots)">UGREEN</text></svg>';

    // The back of the DXP4800 family after a photo of the Plus: a square body, one big mesh with the UGREEN lettering
    // and the fan behind it, below it HDMI, USB 3.2, two USB 2.0, the two LAN ports, reset and the DC inlet.
    function rear4800Html(hw, lanLabels = ['LAN 10G', 'LAN 2.5G']) {
        // LAN 1 is the 10G port, LAN 2 the 2.5G one; the kernel's eth0 / eth1 can be either way round, so the
        // port that supports more is LAN 1 (when ethtool didn't tell, they stay in the kernel's order).
        const ordered = hw.net.slice().sort((a, b) => (b.max_mbit || 0) - (a.max_mbit || 0));
        const lan = (n, x, y, label) => {
            const p = ordered[n];
            const up = Boolean(p && p.link);

            return `<div class="r-abs r-lan ${up ? 'up' : ''}" style="left:${x}%;top:${y}%">
                ${rj45(up, p ? p.speed_mbit : 0, p ? p.name : '')}<b>${label}</b><em>${escapeHtml(up ? speedText(p.speed_mbit) : t('case.no_link'))}</em></div>`;
        };
        const port = (x, y, kind, label, cls = '') => `<div class="r-abs r-${cls || kind}" style="left:${x}%;top:${y}%">${SOCKET[kind]}<b>${label}</b></div>`;
        const screw = (x, y) => `<i class="r-screw" style="left:${x}%;top:${y}%"></i>`;

        return `
            <div class="unc-rear6800 unc-rear4800">
                <div class="r-body"></div>
                ${screw(5.1, 5.3)}${screw(94.8, 5.3)}${screw(5.1, 93.3)}${screw(94.8, 93.3)}
                <div class="r-blende">
                    <div class="r-fans">${rearFansHtml(1)}</div>
                    <div class="r-mesh"></div>
                    ${BRAND_DOTS_SVG}
                </div>
                ${port(16, 87.5, 'hdmi', 'HDMI')}
                ${port(29.1, 87.5, 'usba', 'USB3.2')}
                <div class="r-abs r-usb2" style="left:42.9%;top:83.9%">${SOCKET.usb2}<b>USB2.0</b>${SOCKET.usb2}<b>USB2.0</b></div>
                ${lan(1, 56.8, 84.6, lanLabels[1])}${lan(0, 70.7, 84.6, lanLabels[0])}
                ${port(79, 86.5, 'reset', 'RESET')}
                ${port(86.5, 87.1, 'dc', t('case.dc'))}
            </div>`;
    }

    const rearKit = (hw, ordered = hw.net) => ({
        lan: (n, x, y, label) => {
            const p = ordered[n];
            const up = Boolean(p && p.link);

            return `<div class="r-abs r-lan ${up ? 'up' : ''}" style="left:${x}%;top:${y}%">
                ${rj45(up, p ? p.speed_mbit : 0, p ? p.name : '')}<b>${label}</b><em>${escapeHtml(up ? speedText(p.speed_mbit) : t('case.no_link'))}</em></div>`;
        },
        port: (x, y, kind, label, cls = '') => `<div class="r-abs r-${cls || kind}" style="left:${x}%;top:${y}%">${SOCKET[kind]}<b>${label}</b></div>`,
        screw: (x, y) => `<i class="r-screw" style="left:${x}%;top:${y}%"></i>`
    });

    const BRAND_SVG = '<svg class="r-brand" viewBox="0 0 190 40" aria-label="UGREEN"><text x="95" y="31" text-anchor="middle" font-family="Arial Black, Helvetica, Arial, sans-serif" font-size="37" font-weight="900" fill="rgba(255,255,255,.1)" stroke="#e9edf1" stroke-width="1.2" stroke-dasharray="1 2.2">UGREEN</text></svg>';

    // The back of the DXP2800 after a photo: a tall body, the mesh with the magnetic dust filter on top, below it
    // HDMI, USB 3.2, two USB 2.0, the one 2.5G LAN port, reset and the DC inlet.
    function rear2800Html(hw, lan = 'LAN 2.5G', dc = t('case.dc'), gt = false) {
        const k = rearKit(hw);

        return `
            <div class="unc-rear6800 unc-rear2800 ${gt ? 'unc-rear4800' : ''}">
                <div class="r-body"></div>
                ${k.screw(8, 4.6)}${k.screw(92, 4.6)}${k.screw(8, 94)}${k.screw(92, 94)}
                <div class="r-blende">
                    <div class="r-fans">${gt ? rearFansHtml(1) : `<div class="r-fan"><span class="unc-fan-icon">${REAR_FAN_SVG}</span></div>`}</div>
                    <div class="r-mesh"></div>
                    ${gt ? BRAND_DOTS_SVG : BRAND_SVG}
                </div>
                ${k.port(13, 87.5, 'hdmi', 'HDMI')}
                ${k.port(28.8, 87.5, 'usba', 'USB3.2')}
                <div class="r-abs r-usb2" style="left:42.4%;top:86%">${SOCKET.usb2}<b>USB2.0</b>${SOCKET.usb2}<b>USB2.0</b></div>
                ${k.lan(0, 61, 86.5, lan)}
                ${k.port(76, 87, 'reset', 'RESET')}
                ${k.port(88, 87.5, 'dc', dc)}
            </div>`;
    }

    // The back of the iDX6011 (Pro) after a photo: the PCIe slot cover on the left, the big mesh with the UGREEN
    // lettering, the vent and the power inlet on the right; below it three USB-A, two 10G LAN ports, HDMI,
    // OCuLink (only the Pro) and reset.
    function rear6011Html(hw) {
        const k = rearKit(hw);
        const pro = /Pro$/.test(hw.model || '');

        return `
            <div class="unc-rear6800 unc-rear6011">
                <div class="r-body"></div>
                ${k.screw(1.8, 5)}${k.screw(50, 5)}${k.screw(98.2, 5)}
                <div class="r-blende">
                    <div class="r-fans">${['', ''].map(() => `<div class="r-fan"><span class="unc-fan-icon">${REAR_FAN_SVG}</span></div>`).join('')}</div>
                    <div class="r-mesh"></div>
                    ${BRAND_SVG}
                </div>
                <div class="r-pcie"><b>PCIE</b><i></i></div>
                <div class="r-vent"></div>
                <div class="r-abs r-ac" style="left:94.5%;top:63.5%">${SOCKET.ac}<b>POWER</b></div>
                ${k.port(16.2, 88, 'usba', 'USB3.2')}${k.port(20.6, 88, 'usba', '', 'usba2')}${k.port(24.8, 88, 'usba', 'USB3.2', 'usba3')}
                ${k.lan(0, 29, 87, 'LAN 10G')}${k.lan(1, 36, 87, 'LAN 10G')}
                ${k.port(43.6, 88, 'hdmi', 'HDMI')}
                ${pro ? k.port(51.2, 88, 'usbc', 'OCuLink') : ''}
                ${k.port(57, 88, 'reset', 'RESET')}
            </div>`;
    }

    // The back of the DXP8800 Plus after a photo: a wide body, one big mesh with the UGREEN lettering and two fans
    // behind it, the PCIe slot with its handle on the left, below it HDMI, USB 3.2, two USB 2.0, two 10G LAN ports,
    // reset and the power inlet.
    function rear8800Html(hw) {
        const k = rearKit(hw);

        return `
            <div class="unc-rear6800 unc-rear8800">
                <div class="r-body"></div>
                ${k.screw(3.1, 5.3)}${k.screw(49.7, 5.3)}${k.screw(96.5, 5.3)}${k.screw(5.1, 89)}${k.screw(49.7, 89)}${k.screw(94.6, 89)}
                <div class="r-blende">
                    <div class="r-fans">${['', ''].map(() => `<div class="r-fan"><span class="unc-fan-icon">${REAR_FAN_SVG}</span></div>`).join('')}</div>
                    <div class="r-mesh"></div>
                    ${BRAND_SVG}
                </div>
                <div class="r-pcie"><b>PCIE</b><i></i></div>
                ${k.port(12.4, 80, 'hdmi', 'HDMI')}
                ${k.port(19.5, 80, 'usba', 'USB3.2')}
                <div class="r-abs r-usb2" style="left:26%;top:80%">${SOCKET.usb2}<b>USB2.0</b>${SOCKET.usb2}<b>USB2.0</b></div>
                ${k.lan(0, 33.1, 80, 'LAN 1')}${k.lan(1, 40.4, 80, 'LAN 2')}
                ${k.port(46.2, 80, 'reset', 'RESET')}
                <div class="r-abs r-ac" style="left:68.5%;top:80%">${SOCKET.ac}<b>POWER</b></div>
            </div>`;
    }

    // The rear fans of the DXP4800 GT (one) and models with several (side by side) behind their dust filter, with their speed, red when stalled.
    function rearFanHtml(count = 1) {
        const fans = caseFans(state.data?.fans);
        const one = i => {
            const fan = fans[i];
            const svg = fan ? fanIcon(fan, REAR_FAN_SVG) : `<span class="unc-fan-icon">${REAR_FAN_SVG}</span>`;

            return `<div class="unc-rear-fan ${fanStalled(fan) ? 'stalled' : ''}">${svg}${fan ? `<small>${escapeHtml(rearFanText(fan, i + 1))}</small>` : ''}</div>`;
        };

        return `<div class="unc-rear-fans">${Array.from({ length: count }, (_, i) => one(i)).join('')}</div>`;
    }

    function renderRear(hw, target = '#unc-rear') {
        const lan = n => {
            const p = hw.net[n];
            const up = Boolean(p && p.link);
            const label = `${t('case.lan', { n: n + 1 })}${p ? ` · ${p.name}` : ''}`;
            return `
                <div class="unc-socket rj45 ${up ? 'up' : ''}">
                    ${rj45(up, p ? p.speed_mbit : 0, p ? p.name : '')}
                    <small>${escapeHtml(label)}</small>
                    <em>${escapeHtml(up ? speedText(p.speed_mbit) : t('case.no_link'))}</em>
                </div>`;
        };

        const model = caseModel(hw);

        if (model.rear6800) {
            q(target).innerHTML = rear6800Html(hw);
            return;
        }

        if (model.rear4800) {
            q(target).innerHTML = rear4800Html(hw, model.lanLabels);
            return;
        }

        if (model.rear2800) {
            q(target).innerHTML = rear2800Html(hw, model.lan, model.dc, model.gt);
            return;
        }

        if (model.rear6011) {
            q(target).innerHTML = rear6011Html(hw);
            return;
        }

        if (model.rear8800) {
            q(target).innerHTML = rear8800Html(hw);
            return;
        }

        q(target).innerHTML = `
            <div class="unc-nas-rear">
                ${model.fan ? rearFanHtml(Number(model.fan) || 1) : ''}
                <div class="unc-rear-ports">
                    ${model.rear.map(([kind, label]) => kind === 'lan' ? lan(label) : socket(kind, t(label))).join('')}
                </div>
            </div>`;
    }

    // The boot SSD carries the Unraid mark; a pool or array member names its Unraid role.
    const UNRAID_MARK = '<svg viewBox="0 0 24 24" aria-hidden="true" class="unc-mark"><rect width="24" height="24" rx="6" fill="#f15a2c"/><path d="M7.5 6.5v6.2a4.5 4.5 0 0 0 9 0V6.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>';

    // What the SSD is for in Unraid, in words that fit an SSD (Unraid calls array members "disk1", which reads like a hard disk).
    function ssdRoleText(role) {
        if (!role) return '';
        if (role === 'cache') return t('nvme.role_cache');
        if (/^parity\d?$/.test(role)) return t('nvme.role_parity');

        const array = role.match(/^disk(\d+)$/);
        return array ? t('nvme.role_array', { n: array[1] }) : t('nvme.role', { name: role });
    }

    function ssdUseText(n) {
        if (n.boot) return t('nvme.boot');
        return ssdRoleText(n.role);
    }

    // The board of the DXP6800 Pro seen from above, after a photo of the device: the ribbed cover plate with the lettering,
    // the two SO-DIMM sockets, the M.2 slots (left upright, top across), the system slot bottom right and the
    // PCIe slot at the bottom. Real-looking modules; labels, sizes, temperatures and roles come from the system.
    const goldFingers = (x, y, w, h, n, notchAt) => {
        const step = w / n;
        let out = '';

        for (let i = 0; i < n; i++) {
            if (notchAt != null && i >= notchAt && i < notchAt + 2) continue;
            out += `<rect x="${(x + i * step).toFixed(2)}" y="${y}" width="${(step * .62).toFixed(2)}" height="${h}" fill="#d9b44a"/>`;
        }
        return out;
    };

    const tempColour = temp => ({ ok: '#22c55e', warm: '#f59e0b', hot: '#ef4444' })[tempClass(temp, 'nvme')] || '#8b96a3';

    // An M.2 SSD in its own coordinates (0,0)-(L,H): gold contacts left, controller and NAND chips, the label, the screw hole.
    function nvmeModule(L, H, ssd) {
        const name = String(ssd.model || ssd.id).replace(/ SSD/, '').replace(/\s+/g, ' ').trim();
        const size = fmtSize(ssd.size_bytes);
        const fs = Math.min(H * .2, (L * .4) / (Math.max(name.length, 1) * .58)).toFixed(1);
        const mark = ssd.boot
            ? `<rect x="${(L * .9 - 14).toFixed(1)}" y="${(H * .14).toFixed(1)}" width="14" height="14" rx="4" fill="#f15a2c"/><path d="M${(L * .9 - 10.5).toFixed(1)} ${(H * .14 + 3.5).toFixed(1)}v4.500a3.500 3.500 0 0 0 7 0V${(H * .14 + 3.5).toFixed(1)}" fill="none" stroke="#fff" stroke-width="1.800" stroke-linecap="round"/>`
            : '';

        return `<rect width="${L}" height="${H}" rx="3" fill="#17394f" stroke="#2c6a8f" stroke-width="1.200"/>
            ${goldFingers(1, H * .12, L * .085, H * .76, 9, 4)}
            <rect x="${L * .095}" y="${H * .12}" width="2" height="${H * .76}" fill="#0f2535"/>
            <rect x="${L * .14}" y="${H * .26}" width="${L * .12}" height="${H * .48}" rx="1.500" fill="#2a2f36" stroke="#4a5460" stroke-width=".8"/>
            <rect x="${L * .28}" y="${H * .12}" width="${L * .11}" height="${H * .76}" rx="1.500" fill="#20252b" stroke="#3a424c" stroke-width=".8"/>
            <rect x="${L * .4}" y="${H * .16}" width="${L * .44}" height="${H * .68}" rx="2" fill="#f1f3f5"/>
            <text x="${L * .42}" y="${H * .42}" fill="#14181d" font-size="${fs}" font-weight="800">${escapeHtml(name)}</text>
            <text x="${L * .42}" y="${H * .68}" fill="#4a5460" font-size="${(H * .15).toFixed(1)}">${escapeHtml(size)}</text>
            <circle cx="${L - 5}" cy="${H / 2}" r="${H * .17}" fill="#0b0d0f" stroke="#c9ced4" stroke-width="1.600"/>${mark}`;
    }

    // A SO-DIMM: green board, four chips, the label, gold contacts along the bottom, the latch notches.
    function ramModule(L, H, mod) {
        const speed = mod.configured_mt || mod.speed_mt;

        return `<rect width="${L}" height="${H}" rx="3" fill="#1f6a43" stroke="#2f9a63" stroke-width="1.200"/>
            ${goldFingers(1, H * .86, L - 2, H * .12, 64, 26)}
            <circle cx="0" cy="${H * .42}" r="${H * .1}" fill="#0b0d0f"/><circle cx="${L}" cy="${H * .42}" r="${H * .1}" fill="#0b0d0f"/>
            ${[0, 1, 2, 3].map(i => `<rect x="${L * .06 + i * L * .225}" y="${H * .12}" width="${L * .17}" height="${H * .46}" rx="1.500" fill="#14171a" stroke="#2b3036" stroke-width=".8"/>`).join('')}
            <rect x="${L * .2}" y="${H * .3}" width="${L * .6}" height="${H * .3}" rx="2" fill="#f1f3f5"/>
            <text x="${L * .22}" y="${H * .43}" fill="#14181d" font-size="${Math.max(8, H * .15).toFixed(1)}" font-weight="800">${escapeHtml(`${fmtRam(mod.size_mb)} ${mod.type}${speed ? ` · ${speed}` : ''}`)}</text>
            <text x="${L * .22}" y="${H * .55}" fill="#4a5460" font-size="${Math.max(6, H * .11).toFixed(1)}">${escapeHtml(mod.manufacturer || '')}</text>`;
    }

    // A module in a box of w x h: upright with its contacts at the bottom, or lying.
    const place = (x, y, L, upright, inner) => upright
        ? `<g transform="translate(${x} ${y + L}) rotate(-90)">${inner}</g>`
        : `<g transform="translate(${x} ${y})">${inner}</g>`;

    const tempBadge6800 = (x, y, temp) => temp == null ? '' : `<rect x="${x}" y="${y}" width="46" height="16" rx="8" fill="${tempColour(temp)}"/><text x="${x + 23}" y="${y + 11.5}" fill="#0b0e12" font-size="10.5" font-weight="800" text-anchor="middle">${temp} °C</text>`;
    const boardText = (x, y, text) => `<text x="${x}" y="${y}" style="fill:var(--bd-text)" font-size="11.5">${escapeHtml(text)}</text>`;

    function inside6800Html(hw) {
        const ssd = slot => hw.nvme.find(d => d.slot === slot);
        const ramSocket = (x, mod, n) => {
            const socket = `<rect x="${x}" y="150" width="104" height="236" rx="5" style="fill:var(--bd-sock);stroke:var(--bd-sockedge)" stroke-width="2"/><rect x="${x + 49}" y="360" width="6" height="18" rx="2" style="fill:var(--bd-sock2)"/><rect x="${x - 9}" y="178" width="9" height="34" rx="2" fill="#aeb6bf"/><rect x="${x + 104}" y="178" width="9" height="34" rx="2" fill="#aeb6bf"/>`;
            return socket + (mod && mod.size_mb
                ? place(x + 4, 154, 228, true, ramModule(228, 96, mod))
                : `<g transform="rotate(-90 ${x + 52} 268)"><text x="${x + 52}" y="272" style="fill:var(--bd-text2)" font-size="12" text-anchor="middle">${escapeHtml(t('in.ram_empty', { n }))}</text></g>`);
        };
        // An M.2 slot: the module (or the dashed outline of the empty slot) and, next to it, temperature, name and role.
        const m2 = (x, y, upright, drive, label, bx, by) => {
            if (!drive) {
                return `${place(x, y, 262, upright, '<rect width="262" height="74" rx="3" fill="none" style="stroke:var(--bd-sockedge)" stroke-width="2" stroke-dasharray="6 5"/>')}${boardText(bx, by + 11, t('in.slot_empty', { label }))}`;
            }
            const role = drive.boot ? t('nvme.boot') : ssdRoleText(drive.role);

            return `${place(x, y, 262, upright, nvmeModule(262, 74, drive))}${tempBadge6800(bx, by, drive.temp)}${boardText(bx + 54, by + 11, label)}${role ? boardText(bx + 54, by + 24, role) : ''}`;
        };

        const card = ssd('pcie');
        const memory = hw.memory;

        return `
            <svg class="unc-board-svg" viewBox="0 0 1000 640" role="img" aria-label="${escapeHtml(t('case.inside'))}">
                <defs>
                    <pattern id="unc-ribs" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" style="fill:var(--bd-ribA)"/><rect width="8" height="3.5" style="fill:var(--bd-ribB)"/></pattern>
                    <linearGradient id="unc-pcb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--bd-g1)"/><stop offset="1" style="stop-color:var(--bd-g2)"/></linearGradient>
                </defs>
                <rect x="10" y="10" width="980" height="620" rx="16" fill="url(#unc-pcb)" style="stroke:var(--bd-edge)" stroke-width="3"/>
                <rect x="940" y="30" width="38" height="580" rx="8" fill="#a8afb8"/><rect x="948" y="60" width="22" height="34" rx="4" fill="#5d646d"/><rect x="948" y="520" width="22" height="34" rx="4" fill="#5d646d"/>
                <path d="M50 70h620l120 90v320H50z" fill="url(#unc-ribs)" style="stroke:var(--bd-plate)" stroke-width="2"/>
                <g transform="rotate(-90 300 290)"><text x="300" y="304" style="fill:var(--bd-ink)" font-size="64" font-weight="900" text-anchor="middle" letter-spacing="6">UGREEN</text></g>
                <circle cx="400" cy="140" r="9" fill="#b87333"/><circle cx="720" cy="430" r="9" fill="#b87333"/><circle cx="240" cy="470" r="9" fill="#b87333"/>
                ${m2(86, 96, true, ssd('m2-1'), t('in.m2', { n: 1 }), 172, 104)}
                ${m2(340, 22, false, ssd('m2-2'), t('in.m2', { n: 2 }), 612, 40)}
                ${boardText(452, 140, t('in.dimm', { type: memory.find(m => m.type)?.type || 'DDR5' }))}
                ${ramSocket(452, memory[1], 2)}
                ${ramSocket(578, memory[0], 1)}
                ${m2(560, 522, false, ssd('system'), t('in.system'), 560, 484)}
                <rect x="60" y="604" width="390" height="24" rx="6" style="fill:var(--bd-sock);stroke:var(--bd-sockedge)" stroke-width="2"/>
                <text x="255" y="620" style="fill:var(--bd-text2)" font-size="12" text-anchor="middle">${escapeHtml(t('case.pcie_slot'))}${card ? '' : ` · ${escapeHtml(t('case.free'))}`}</text>
                ${card ? `${tempBadge6800(76, 478, card.temp)}${boardText(130, 489, t('in.pcie_card'))}${boardText(130, 502, card.boot ? t('nvme.boot') : ssdRoleText(card.role))}
                    <rect x="76" y="512" width="330" height="86" rx="4" fill="#142a2a" stroke="#2f9a63" stroke-width="1.500"/>${goldFingers(100, 590, 260, 8, 38, null)}<rect x="62" y="522" width="14" height="66" rx="3" fill="#aeb6bf"/>${place(98, 520, 252, false, nvmeModule(252, 64, card))}` : ''}
            </svg>`;
    }

    // The SSD in a slot as a Sensors-style row: slot and use, model and size, the device id as tooltip; an empty slot says so.
    function ssdSlotRow(name, ssd) {
        if (!ssd) return sensorRow({ ico: icon('m2'), name, vals: [{ label: '', text: t('case.empty'), level: 'na' }] });

        return sensorRow({
            ico: ssd.boot ? UNRAID_MARK : icon('m2'),
            name,
            src: [friendly(ssd.model || ssd.id), fmtSize(ssd.size_bytes)].filter(Boolean).join(' · '),
            title: ssd.id,
            badges: ssdUseText(ssd) ? [pill({ text: ssdUseText(ssd) })] : [],
            vals: [tempVal(ssd.temp, 'nvme')]
        });
    }

    // Case, Inside for the models without a drawing: memory and SSD slots as cards of rows, like the Sensors page.
    function insideListHtml(hw) {
        const model = caseModel(hw);
        const ssd = slot => hw.nvme.find(d => d.slot === slot);
        const card = hw.nvme.filter(d => d.slot === 'pcie');
        const ssds = [
            ssdSlotRow(t('case.m2_slot', { n: 1 }), ssd('m2-1')),
            ssdSlotRow(t('case.m2_slot', { n: 2 }), ssd('m2-2')),
            model.sys ? ssdSlotRow(t('case.sys_slot'), ssd('system')) : '',
            ...(model.pcie ? (card.length ? card.map(c => ssdSlotRow(t('case.pcie_slot'), c)) : [sensorRow({ ico: icon('pcie'), name: t('case.pcie_slot'), vals: [{ label: '', text: t('case.free'), level: 'na' }] })]) : [])
        ].filter(Boolean);

        return `
            ${sectionHead(t('sensors.group_ssd'))}
            <div class="unc-sn-list">${ssds.join('')}</div>
            ${sectionHead(t('sensors.group_mem'))}
            <div class="unc-sn-list">${memoryRows(hw.memory).join('')}</div>`;
    }

    // A model without a hint (the DXP4800 GT) gets no note at all.
    function setHint(element, key) {
        element.hidden = !key;
        if (key) element.dataset.i18n = key; else element.removeAttribute('data-i18n');
        element.textContent = key ? t(key) : '';
    }

    function renderInside(hw, target = '#unc-inside') {
        // Without known slots there is nothing to draw: the card stays away.
        q(target).closest('article').hidden = Boolean(caseModel(hw).noInside);
        if (caseModel(hw).noInside) return;

        if (caseModel(hw).inside6800) {
            const hint = q('#unc-inside-hint');

            q(target).classList.add('board-svg');
            setHint(hint, caseModel(hw).hint);
            q(target).innerHTML = inside6800Html(hw);
            return;
        }

        q(target).classList.remove('board-svg');
        setHint(q('#unc-inside-hint'), caseModel(hw).hint);
        q(target).innerHTML = insideListHtml(hw);
    }

    function renderCase() {
        if (!state.hw) {
            const text = t(state.hwError ? 'case.error' : 'case.loading');
            ['#unc-drive-list', '#unc-rear', '#unc-inside'].forEach(id => {
                q(id).innerHTML = emptyText(text);
            });
            return;
        }
        renderDriveList(state.hw);
        renderRear(state.hw);
        renderInside(state.hw);
    }

    /*
     * ---------------------------------------------------------
     * LEDs live: the colours the LED controller shows right now, drawn into the case pictures
     * ---------------------------------------------------------
     */

    const LED_API = '/plugins/ugreen-nas-control/led/api.php';
    const LED_POLL_MS = 15000;
    const STATUS_POLL_MS = 60000;

    // Shared with the LED pages (js/ledfx.js UNCPoll): one request per URL while it is in flight or younger than maxAge.
    async function ledGet(action, maxAge = 0) {
        const { ok, status, text } = await window.UNCPoll.fetchText(`${LED_API}?action=${action}`, maxAge);
        const data = JSON.parse(text);

        if (!ok || data.ok === false) throw new Error(data.error || `HTTP ${status}`);
        return data;
    }

    // The LED pages ship with the page: only then (and with the switch on) there is anything to read.
    const ledsOn = () => Boolean(window.UNC_LED && state.data?.led?.enabled);

    // What else the LED controller reports (the controller itself is the "LED controller" fact above).
    function ledFacts() {
        const status = state.ledStatus;
        if (!ledsOn() || !status) return [];

        const found = Object.keys(state.leds || {});
        return [
            ['ledfacts.mapping', status.mapping ? t(`ledfacts.mapping_${status.mapping}`) : ''],
            ['ledfacts.leds', found.length ? found.join(', ') : t('ledfacts.none')],
            ['ledfacts.monitor', status.foreign_monitor ? t('ledfacts.monitor_on') : t('ledfacts.monitor_off')],
            ['ledfacts.saved', status.settings_saved ? t('ledfacts.saved_yes') : t('ledfacts.saved_no')]
        ];
    }

    // Slow reads, see the intervals at the bottom: led/all every LED_POLL_MS, the costly led/status once a minute.
    async function loadLeds(maxAge = LED_POLL_MS * 0.8) {
        if (!ledsOn()) {
            state.leds = null;
            if (state.ledStatus) {
                state.ledStatus = null;
                renderSystem();
                renderBanners();
                renderNightBadge();
            }
            return;
        }

        try {
            const [all, status] = await Promise.all([ledGet('all', maxAge).then(data => ({ ...data, leds: window.UNCLedFx.stamp(data.leds) })), ledGet('status', STATUS_POLL_MS * 0.9)]);
            state.leds = all.leds || {};
            state.ledMode = { mode: status.mode, fx: status.fx };
            state.ledBays = Number(status.bays) || 0;
            state.ledStatus = status;
            state.ledMisses = status.i2c_address ? 0 : (state.ledMisses || 0) + 1;
            if (state.data) renderSystem();
            renderBanners();
            renderNightBadge();
        } catch (error) {
            state.leds = null;
            return;
        }

        // Only the night hint depends on it: a failed read must not hide the LED data.
        state.ledSchedule = await ledGet('schedule', STATUS_POLL_MS * 0.9).catch(() => state.ledSchedule);
    }

    // Drawing (colour, brightness mapping, blink/breathe/rainbow animation) is the shared renderer's, js/ledfx.js.
    function paintLed(element, led, name) {
        window.UNCLedFx.paint(element, led, name, state.ledStatus);
    }

    function applyLeds(container) {
        if (!container || !state.leds) return;

        container.querySelectorAll('.unc-nbay').forEach((bay, i) => paintLed(bay.querySelector('.bar'), state.leds[`disk${i + 1}`], `disk${i + 1}`));
        paintLed(container.querySelector('.unc-pled.power'), state.leds.power, 'power');
        paintLed(container.querySelector('.unc-pled.lan'), state.leds.netdev, 'netdev');
        container.querySelectorAll('.unc-led .unc-pled[data-led]').forEach(el => paintLed(el, state.leds[el.dataset.led], el.dataset.led));
    }

    function ledModeText() {
        const m = state.ledMode;
        if (!m) return '';
        if (m.fx) return t(`led.fx_${m.fx}`) !== `led.fx_${m.fx}` ? t(`led.fx_${m.fx}`) : m.fx;
        return t(m.mode === 'status' ? 'led.mode_status' : 'led.mode_manual');
    }

    async function loadHardware() {
        try {
            // The tool prints a list it found nothing for (no NVMe, no dmidecode, no NIC) as null.
            const hw = await api({ action: 'hardware' });
            state.hw = hw && { ...hw, memory: hw.memory || [], nvme: hw.nvme || [], net: hw.net || [] };
            state.hwError = false;
        } catch (error) {
            // A failed read keeps the last picture: dropping it would shrink the page under the reader and jump to the top.
            if (!state.hw) state.hwError = true;
        }
        keepScroll(() => {
            renderCase();
            if (state.data?.ok) {
                renderFans();
                renderHero();
                renderOverview();
                renderSensors();
            }
        });
    }

    // Redrawing big parts of the page can make it shorter for a moment; the browser then scrolls up and stays there.
    function keepScroll(draw) {
        const y = window.scrollY;

        draw();
        if (window.scrollY !== y) window.scrollTo(0, y);
    }

    /*
     * ---------------------------------------------------------
     * Overview: case and drives, cooling, compute, network
     * ---------------------------------------------------------
     */

    // "12th Gen Intel(R) Core(TM) i5-1235U @ 2.50GHz" -> "Core i5-1235U"
    const shortCpu = name => String(name || '').replace(/\(R\)|\(TM\)|CPU|@.*$|^\d+th Gen\s+Intel\s*/gi, '').replace(/\s+/g, ' ').trim();
    // dmidecode gives MM/DD/YYYY
    const biosDate = s => String(s || '').replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$2.$1.$3');

    function renderHero() {
        const hw = state.hw;
        const info = state.data?.info || {};
        const stage = q('#unc-hero');

        if (!hw) {
            stage.className = 'unc-hero';
            stage.innerHTML = emptyText(t(state.hwError ? 'case.error' : 'case.loading'));
            return;
        }

        if (!caseKnown()) {
            stage.className = 'unc-hero';
            stage.innerHTML = emptyText(t('case.unknown', { model: hw.model || info.model || '?' }), 'center');
            return;
        }

        // The overview shows the front; the rear and the inside are on the Case page.
        stage.className = 'unc-hero front';
        renderFront(hw, '#unc-hero');
    }

    function renderOverview() {
        renderCaseFoot();
        renderBoard();
    }

    // Under the front view: one temperature per SSD, the LED chip, the link to the drive list.
    function renderCaseFoot() {
        const data = state.data || {};
        const extras = data.sensors?.nvme_extra || [];
        const [warm] = LIMITS.nvme;
        const slots = state.hw?.nvme?.length
            ? state.hw.nvme.map(n => ({ id: n.id, label: ssdSlotLabel(n), model: n.model || n.id, temp: n.temp, boot: n.boot }))
            : (data.sensors?.nvme || []).map(n => ({ id: n.name, label: n.name, model: n.label || n.name, temp: n.temp }));
        const ssds = slots.filter(n => n.temp != null).map(n => {
            const hot = extras.filter(e => e.name === n.id && e.temp != null);
            const warn = hot.find(e => e.temp >= warm);
            const hint = [n.model, ...hot.map(e => `${e.label || t('temps.sensor')} ${e.temp} °C`), warn ? t('temps.hint_nvme_extra') : ''].filter(Boolean).join('\n');

            return statChip({ ico: n.boot ? UNRAID_MARK : icon('m2'), label: n.label, value: tempOf(n.temp, 'nvme'), after: warn ? glyph(icon('alert'), 'warn') : '', hint });
        });
        let led = '';

        // LED chip: mode, brightness and the night mode; opens the LED overview.
        if (ledsOn() && state.ledMode) {
            const sched = state.ledSchedule;
            const brightness = state.leds ? `${Math.round((Number(state.leds.power?.brightness) || 0) / 2.55)} %` : '';
            const night = sched ? `${t('head.night')} ${sched.enabled ? `${sched.start}–${sched.end}` : t('leds.off').toLowerCase()}` : '';

            led = pill({ tag: 'button', ico: 'bulb', text: [`${t('led.title')} ${ledModeText()}`, brightness, night].filter(Boolean).join(' · '), attrs: 'data-nav="led:overview"' });
        }

        q('#unc-ov-foot').hidden = !ssds.length && !led && !caseKnown();
        q('#unc-ov-foot').innerHTML = `
            ${ssds.length ? `<div class="unc-m2">${ssds.join('')}</div>` : ''}
            ${linkRow(caseKnown() && state.hw ? navLink('case', 'ov.drive_details') : '<span></span>', led)}`;
    }

    // The LAN ports named like the rear view: the port that supports more speed is LAN 1.
    const lanPorts = () => (state.hw?.net || []).slice().sort((a, b) => (b.max_mbit || 0) - (a.max_mbit || 0));

    // Compute (processor, graphics, memory) and Network (links, chip temperature per port).
    function renderBoard() {
        const data = state.data || {};
        const info = data.info || {};
        const hw = state.hw;
        const [cpu, igpu] = shortCpu(info.cpu).split(/\s+with\s+/i);
        const modules = hw?.memory || [];
        const filled = modules.filter(m => m.size_mb > 0);
        const ram = ramMB(info);
        const mt = filled[0] && (filled[0].configured_mt || filled[0].speed_mt);
        const part = filled[0] ? [filled[0].manufacturer, filled[0].part_number].filter(Boolean).join(' · ') : '';
        const link = (nav, key) => caseKnown() && hw ? linkRow(navLink(nav, key)) : '';

        q('#unc-ov-compute').innerHTML = `
            <p class="unc-ov-main">${glyph(icon('chip'))}<strong>${escapeHtml(cpu || '–')}</strong>${info.threads ? ` <span class="unc-muted">${escapeHtml(t('cc.threads', { n: info.threads }))}</span>` : ''}</p>
            ${igpu ? `<p class="unc-muted">${glyph(icon('pcie'))}${escapeHtml(igpu)}</p>` : ''}
            ${ram ? `<p class="unc-ov-ram" title="${escapeHtml(part)}">${glyph(icon('ram'))}<strong>${Math.round(ram / 1024)} GB ${escapeHtml(filled[0]?.type || '')}</strong>
                ${modules.length ? `<span class="unc-dimms">${modules.map(m => `<span class="${m.size_mb ? '' : 'empty'}">${m.size_mb ? fmtRam(m.size_mb) : '–'}</span>`).join('')}</span>` : ''}
                ${mt ? `<span class="unc-muted">${mt} MT/s</span>` : ''}</p>` : emptyText(t('cc.none'))}
            ${link('case', 'ov.inside')}`;

        const ports = lanPorts();
        const nics = data.sensors?.nic || [];

        q('#unc-ov-net').innerHTML = `${ports.length ? `<div class="unc-ports">${ports.map((n, i) => {
            const chips = nics.filter(c => c.iface === n.name && c.temp != null);
            const temp = chips.length ? Math.max(...chips.map(c => c.temp)) : null;
            const hint = [`${t('temps.nic_chip')} · ${n.name}`, chips.map(c => `${c.label} ${c.temp} °C`).join(' / ')].filter(Boolean).join('\n');

            return `<div>${statChip({ ico: icon('net'), label: ports.length > 1 ? t('case.lan', { n: i + 1 }) : t('case.lan_one'), sub: n.name, text: n.link ? speedText(n.speed_mbit) : t('cc.no_link'), level: n.link ? '' : 'na', hint, cls: 'is-row' })}${n.link && temp != null ? tempOf(temp, 'other') : '<span></span>'}</div>`;
        }).join('')}</div>` : emptyText(t('cc.none'))}${link('case', 'ov.rear')}`;
    }

    /*
     * ---------------------------------------------------------
     * Sensors: everything the plugin can read, by part
     * ---------------------------------------------------------
     */

    // A sensor that isn't wired reports nonsense (an NVMe sensor 2 that isn't there, -128 from an empty ITE input).
    const plausible = value => value != null && value > -40 && value < 125 ? value : null;

    const tempVal = (value, kind, label = '') => {
        const temp = plausible(value);

        return { label, text: deg(temp), level: temp == null ? 'na' : tempClass(temp, kind) };
    };

    // One reading: picture, name with its source, badges (what it drives, its limit), one or more values.
    function sensorRow({ ico, name, src = '', badges = [], vals, title = '' }) {
        return `
            <div class="unc-sn-row ${vals.length > 1 ? 'multi' : ''}"${title ? ` title="${escapeHtml(title)}"` : ''}>
                ${glyph(ico, 'lg')}
                <span class="unc-sn-name"><strong>${escapeHtml(name)}</strong>${src ? `<small class="unc-muted">${escapeHtml(src)}</small>` : ''}</span>
                <span class="unc-sn-badges">${badges.join('')}</span>
                <span class="unc-sn-vals">${vals.map(v => statChip({ label: v.label, text: v.text, level: v.level, cls: 'is-stack is-end' })).join('')}</span>
            </div>`;
    }

    // A controller the plugin found: what it is, where it sits, whether it answers.
    function sensorDevice(iconName, title, main, lines, state, good) {
        return `
            <div class="unc-sn-dev">
                <span class="unc-sn-devico">${icon(iconName)}</span>
                <div>
                    <small class="unc-muted">${escapeHtml(title)}</small>
                    <strong>${escapeHtml(main)}</strong>
                    ${lines.filter(Boolean).map(line => `<small class="unc-muted">${escapeHtml(line)}</small>`).join('')}
                </div>
                ${state ? pill({ tone: good, text: state }) : ''}
            </div>`;
    }

    // One row per memory slot: size and type, speed; the modules have no temperature sensor to read.
    const memoryRows = modules => modules.map((m, i) => sensorRow({
        ico: icon('ram'),
        name: t('case.ram_slot', { n: i + 1 }),
        src: m.size_mb ? [m.manufacturer, m.part_number].filter(Boolean).join(' · ') : '',
        title: m.configured_mt && m.configured_mt !== m.speed_mt ? t('case.running_at', { speed: m.configured_mt, max: m.speed_mt }) : '',
        vals: m.size_mb
            ? [{ label: '', text: `${fmtRam(m.size_mb)} ${m.type || ''}`.trim(), level: '' }, { label: t('sensors.speed'), text: `${m.configured_mt || m.speed_mt} MT/s`, level: '' }]
            : [{ label: '', text: t('case.empty'), level: 'na' }]
    }));

    function sensorDevices() {
        const data = state.data;
        const info = data.info || {};
        const led = ledControllerState();
        const status = state.ledStatus;
        const ports = /IT5571/.test(data.chip || '') ? '0x62 / 0x66' : '';
        const fanState = !data.chip ? ['sensors.not_found', 'bad'] : fanOff() ? ['sensors.ctl_off', 'warn'] : ['sensors.ctl_on', 'ok'];
        const ledState = led === 'found' ? ['sensors.found', 'ok'] : led === 'missing' ? ['sensors.not_found', 'bad'] : null;

        return [
            sensorDevice('fan', t('system.chip'), data.chip ? chipName(data.chip) : '–',
                [ports && t('sensors.ports', { ports }), (data.fans || []).length ? t('sensors.fans_n', { n: data.fans.length }) : ''],
                t(fanState[0]), fanState[1]),
            ledsOn()
                ? sensorDevice('bulb', t('system.ledctl'), status?.controller || t('led.title'),
                    [status?.i2c_address ? t('sensors.led_bus', { bus: status.i2c_bus, address: status.i2c_address }) : ledController()],
                    ledState ? t(ledState[0]) : '', ledState?.[1])
                : sensorDevice('bulb', t('system.ledctl'), t('led.title'), [ledController()], t('sensors.ctl_off'), 'warn'),
            sensorDevice('bios', t('system.model'), info.model || '–',
                [[info.bios ? `${t('system.bios')} ${info.bios}` : '', biosDate(info.bios_date)].filter(Boolean).join(' · '), [shortCpu(info.cpu).split(/\s+with\s+/i)[0], info.threads ? t('cc.threads', { n: info.threads }) : ''].filter(Boolean).join(' · ')], '', '')
        ].join('');
    }

    function renderSensors() {
        const data = state.data;
        const s = data.sensors || {};
        const info = data.info || {};
        const settings = data.settings || {};
        // Limits and "drives the fan" only matter while the plugin steers the fans.
        const steering = fanKnown() && !fanOff();
        const intel = /intel/i.test(info.cpu || '');
        const caseSrc = caseSource();
        const ignored = new Set(settings.ignore_drives || []);
        const limit = value => pill({ text: t('sensors.limit', { temp: value }) });
        const driver = (name, from) => steering && caseSrc.from === from && caseSrc.drive === name ? pill({ tone: 'accent', ico: 'fan', text: t('sensors.drives_case') }) : '';
        const skipped = name => steering && ignored.has(name) ? pill({ text: t('sensors.ignored') }) : '';
        const diskCrit = settings.disk_crit ?? 55;
        const nvmeCrit = diskCrit + (settings.nvme_offset ?? 15);
        const groups = [];
        const group = (titleKey, iconName, rows, { one = false, hint = '' } = {}) => {
            if (!rows.length && !hint) return;
            groups.push(`
                <article class="unc-card unc-sn-group">
                    ${cardHead(t(titleKey), { ico: iconName })}
                    ${rows.length ? `<div class="unc-sn-list ${one ? 'one' : ''}">${rows.join('')}</div>` : ''}
                    ${hint ? note(escapeHtml(hint)) : ''}
                </article>`);
        };

        // Processor and board
        const board = [];
        const cores = (s.cpu_cores || []).map(c => c.temp).filter(v => v != null);

        board.push(sensorRow({ ico: icon('chip'), name: t('temps.cpu'), src: intel ? 'coretemp' : 'k10temp', vals: [tempVal(s.cpu, 'cpu')],
            badges: [steering ? pill({ tone: 'accent', ico: 'fan', text: t('sensors.drives_cpu') }) : '', steering ? limit(settings.cpu_crit ?? 90) : ''] }));
        if (cores.length) board.push(sensorRow({ ico: icon('gauge'), name: t('sensors.cores'), src: intel ? 'coretemp' : 'k10temp', vals: [tempVal(Math.max(...cores), 'cpu')] }));
        board.push(sensorRow({ ico: icon('pcie'), name: t('temps.gpu'), src: intel ? 'i915' : 'amdgpu', vals: [tempVal(s.gpu, 'cpu')] }));
        board.push(sensorRow({ ico: icon('board'), name: t('temps.board'), src: data.chip ? chipName(data.chip) : 'acpitz', vals: [tempVal(s.board, 'other')] }));
        (data.chip_temps || []).forEach((temp, i) => {
            if (plausible(temp) != null) board.push(sensorRow({ ico: icon('fan'), name: t('sensors.chip_sensor', { n: i + 1 }), src: chipName(data.chip), vals: [tempVal(temp, 'other')] }));
        });
        group('sensors.group_board', 'chip', board);

        // Fans
        const fans = data.fans || [];
        group('sensors.group_fans', 'fan', fans.map(fan => sensorRow({
            ico: fanIcon(fan, icon('fan')),
            name: fanName(fan, fans),
            src: [data.chip, fan.id].filter(Boolean).join(' · '),
            badges: steering ? [pill({ text: fanSourceShort(fan) })] : [],
            vals: [
                { label: '', text: fan.rpm > 0 ? `${fan.rpm} ${t('fan.rpm')}` : t(fan.error ? 'fan.error' : 'fan.stopped'), level: fan.rpm > 0 && !fan.error ? '' : 'hot' },
                { label: t('sensors.power'), text: fan.error ? '–' : fan.pct == null ? t('sensors.auto') : `${fan.pct} %`, level: '' }
            ]
        })), { hint: fanOff() ? t('fanctl.off_note') : '' });

        // NVMe SSDs: the composite value steers the fans, the extra sensors are shown only.
        const extras = s.nvme_extra || [];
        const ssds = state.hw?.nvme?.length
            ? state.hw.nvme.map(n => ({ id: n.id, label: ssdSlotLabel(n), model: n.model || n.id, temp: n.temp, boot: n.boot }))
            : (s.nvme || []).map(n => ({ id: n.name, label: n.name, model: n.label || n.name, temp: n.temp }));

        group('sensors.group_ssd', 'm2', ssds.map(n => sensorRow({
            ico: n.boot ? UNRAID_MARK : icon('m2'),
            name: n.label,
            src: n.model,
            badges: [driver(n.id, 'nvme'), skipped(n.id), steering ? limit(nvmeCrit) : ''],
            vals: [tempVal(n.temp, 'nvme', t('sensors.composite')), ...extras.filter(e => e.name === n.id && plausible(e.temp) != null).map(e => tempVal(e.temp, 'nvme', e.label || t('temps.sensor')))]
        })), { one: true });

        // Drives: a sleeping drive shows "Standby"; the temperature is Unraid's last reading, never a new one.
        const bays = state.hw?.bays || [];
        group('sensors.group_drives', 'drives', (s.disks || []).map(d => {
            const bay = bays.find(b => b.device === d.device);
            const kind = d.hdd ? 'disk' : 'nvme';

            return sensorRow({
                ico: icon('drives'),
                name: driveLabel(d.name),
                src: [bay ? t('sensors.bay', { n: bay.bay }) : '', friendly(bay?.model)].filter(Boolean).join(' · '),
                title: d.device,
                badges: [driver(d.name, 'disk'), skipped(d.name), steering && !d.standby && plausible(d.temp) != null ? limit(diskCrit) : ''],
                vals: [d.standby ? standbyVal() : tempVal(d.temp, kind)]
            });
        }), { hint: t('sensors.drives_note') });

        // Network: both chips of each port next to the link.
        const nics = s.nic || [];
        const ports = lanPorts();
        const nicRow = (name, iface, port) => {
            const chips = nics.filter(c => c.iface === iface);
            const speed = port ? (port.link ? speedText(port.speed_mbit) : t('cc.no_link')) : '';
            const max = port?.link && port.max_mbit > port.speed_mbit ? t('sensors.up_to', { speed: speedText(port.max_mbit) }) : '';

            return sensorRow({
                ico: icon('net'),
                name,
                src: [iface, speed, max].filter(Boolean).join(' · '),
                vals: chips.length ? chips.map(c => tempVal(c.temp, 'other', c.label || t('temps.nic_chip'))) : [tempVal(null, 'other')]
            });
        };

        group('sensors.group_net', 'net', [
            ...ports.map((p, i) => nicRow(ports.length > 1 ? t('case.lan', { n: i + 1 }) : t('case.lan_one'), p.name, p)),
            ...[...new Set(nics.map(c => c.iface))].filter(iface => !ports.some(p => p.name === iface)).map(iface => nicRow(iface, iface, null))
        ], { one: true });

        // Memory: size and speed per module; the modules have no temperature sensor to read.
        const rams = memoryRows(state.hw?.memory || []);

        if (!rams.length && info.memory_kb) rams.push(sensorRow({ ico: icon('ram'), name: t('system.memory'), vals: [{ label: '', text: `${Math.round(info.memory_kb / 1048576)} GB`, level: '' }] }));
        group('sensors.group_mem', 'ram', rams, { hint: t('sensors.mem_note') });

        q('#unc-sensors').innerHTML = `<div class="unc-sn-devs">${sensorDevices()}</div>${groups.join('')}`;
    }

    /*
     * ---------------------------------------------------------
     * Loading
     * ---------------------------------------------------------
     */

    // Only the newest request may write the state: a poll that started before a save would bring back the old settings.
    let loadSeq = 0;

    async function load() {
        const seq = ++loadSeq;
        let data;

        try {
            data = await api({ action: 'status' });
            // A stopped daemon leaves its last state file behind: not current.
            if (data && !data.running) data.daemon = null;
        } catch (error) {
            data = null;
        }
        if (seq !== loadSeq) return;
        state.data = data;
        updateNetAct(data?.net_io);
        render();
        paintNetAct();
    }

    /*
     * ---------------------------------------------------------
     * Events
     * ---------------------------------------------------------
     */

    const polls = {};

    function showView(nav) {
        // "led:colours": the LED pages are one view of ours, each of their pages an entry of the sidebar.
        const [view, sub] = nav.split(':');

        state.view = view;
        state.nav = nav;
        renderTitle();
        if (view === 'led') {
            window.ULC?.show(sub);
            // The switch belongs to the overview page only.
            q('#unc-led-head').hidden = sub !== 'overview';
        }
        if (view === 'case' || view === 'overview' || view === 'sensors') polls.hardware?.poke();
        if (view === 'case' || view === 'overview' || view === 'sensors') polls.leds?.poke();
        polls.status?.poke();
        qa('[data-nav]').forEach(button => button.classList.toggle('active', button.dataset.nav === nav));
        qa('.unc-view').forEach(section => section.classList.toggle('active', section.dataset.view === view));
        queueDock();
    }

    // The LED pages ask for a page of the sidebar ("Status options" on the drive LEDs card).
    window.UNC_NAV = nav => showView(nav);

    function bindEvents() {
        qa('[data-unc-icon]').forEach(element => {
            element.innerHTML = icon(element.dataset.uncIcon);
        });

        qa('[data-nav]').forEach(button => {
            button.addEventListener('click', () => showView(button.dataset.nav));
        });
        // The links in the "what drives the fans" rows and the LED chip are drawn with their parents.
        q('.unc-ov').addEventListener('click', event => {
            const link = event.target.closest('[data-nav]');
            if (link) showView(link.dataset.nav);
        });



        // The mode applies at once. Unsaved curve edits would no longer match it: ask before dropping them.
        ['#unc-modes', '#unc-modes-fans'].forEach(id => q(id).addEventListener('click', event => {
            const button = event.target.closest('[data-mode]');
            if (!button || button.disabled) return;

            const mode = button.dataset.mode;
            if (state.curvesDirty) {
                if (!window.confirm(t('mode.discard_confirm'))) return;
                discardCurves();
            }
            run(() => api({ action: 'mode', value: mode }, true), t('save.saved'));
        }));

        qa('[data-preset]').forEach(button => button.addEventListener('click', () => {
            const mode = button.dataset.preset;
            const preset = state.data?.presets?.[mode];
            if (!preset || !curvesEditable()) return;

            state.curves = { cpu: parseCurve(preset[0]), case: parseCurve(preset[1]) };
            markDirty('curves', 'cpu');
            markDirty('curves', 'case');
            buildPoints('cpu');
            buildPoints('case');
            renderCurves();
            renderSaveBars();
            toast(t('curves.loaded', { mode: t(`mode.${mode}`) }));
        }));

        q('#unc-flow').addEventListener('click', event => {
            const tab = event.target.closest('[role="tab"]');
            const start = event.target.closest('[data-measure]');

            if (tab) selectStep(tab.dataset.step);
            if (start) startMeasure(start.hasAttribute('data-confirm'));
        });

        q('#unc-stepper').addEventListener('keydown', event => {
            const tabs = qa('#unc-stepper [role="tab"]');
            const at = tabs.indexOf(document.activeElement);
            const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: tabs.length - 1 }[event.key];

            if (to === undefined || at < 0) return;
            event.preventDefault();
            const tab = tabs[(to + tabs.length) % tabs.length];
            selectStep(tab.dataset.step);
            tab.focus();
        });

        q('[data-discard="curves"]').addEventListener('click', discardCurves);

        q('#unc-customize').addEventListener('click', () => {
            state.arm = true;
            state.curves = activeCurves();
            markDirty('curves');
            state.saveError.curves = '';
            buildPoints('cpu');
            buildPoints('case');
            renderCurves();
            renderSaveBars();
        });

        // The minimum speed lives only here: saved with the curves in Custom, via the min action in a preset mode.
        q('#unc-curve-min').addEventListener('input', event => {
            const v = parseInt(event.target.value, 10);
            if (Number.isNaN(v)) return;
            const lo = Number(event.target.min) || 10, hi = Number(event.target.max) || 60;
            state.minEdit = Math.max(lo, Math.min(hi, v));
            markDirty('curves', 'min');
            state.saveError.curves = '';
            showCurveMin();
            renderSaveBars();
            renderCurves();
        });

        qa('[data-chart]').forEach(svg => new ResizeObserver(() => {
            if (Math.round(svg.clientWidth) && svg.dataset.w !== String(Math.round(svg.clientWidth))) drawChart(svg.closest('[data-curve]').dataset.curve);
        }).observe(svg));

        q('#unc-case-cpu').addEventListener('change', event => {
            state.caseFollows = event.target.checked;
            markDirty('curves', 'mix');
            state.saveError.curves = '';
            renderSaveBars();
            renderCurvesMode();
            drawChart('case');
            paintMix();
        });

        q('[data-discard="safety"]').addEventListener('click', discardSafety);

        window.addEventListener('scroll', queueDock, true);
        window.addEventListener('resize', queueDock);

        // Unsaved fan settings are lost on reload: ask first.
        window.addEventListener('beforeunload', event => {
            if (state.curvesDirty || state.safetyDirty) event.preventDefault();
        });

        q('#unc-curves-save').addEventListener('click', () => {
            const { cpu, case: cs } = state.curves;

            // A preset mode keeps its mode: only the lowest speed and the CPU help switch are saved.
            if (!curvesEditable()) {
                saveFanPage('curves', () => api({ action: 'min', min_pct: minPct(), case_follows_cpu: state.caseFollows ? '1' : '0' }, true), t('save.applied'));
                return;
            }

            if (!validCurve(cpu) || !validCurve(cs)) {
                toast(t('curves.invalid'), 'error');
                return;
            }

            saveFanPage('curves', () => api({ action: 'curves', cpu_curve: curveText(cpu), case_curve: curveText(cs), case_follows_cpu: state.caseFollows ? '1' : '0', min_pct: minPct() }, true), t('curves.saved')).then(() => { if (!state.curvesDirty) { state.arm = false; renderCurvesMode(); } });
        });

        SAFETY.forEach(field => {
            q(`#unc-${field.id}`).addEventListener('input', () => {
                markDirty('safety', field.id);
                state.saveError.safety = '';
                showSafetyValue(field);
                renderSafetyLive();
                renderSaveBars();
            });
        });
        q('#unc-ignore-list').addEventListener('change', () => {
            markDirty('safety', 'ignore');
            state.saveError.safety = '';
            renderSaveBars();
        });
        q('#unc-stall-notify').addEventListener('change', () => {
            markDirty('safety', 'stall');
            state.saveError.safety = '';
            renderSaveBars();
        });

        q('#unc-safety-save').addEventListener('click', () => {
            const values = Object.fromEntries(SAFETY.map(field => [field.key, q(`#unc-${field.id}`).value]));

            saveFanPage('safety', () => api({
                action: 'safety',
                ...values,
                stall_notify: q('#unc-stall-notify').checked ? '1' : '0',
                ignore_drives: ignoredDrives()
            }, true), t('safety.saved'));
        });

        bindModelsFold();
        q('#unc-confirm-send').addEventListener('click', openConfirmIssue);

        q('#unc-fan-enabled').addEventListener('change', event => {
            const on = event.target.checked;

            run(async () => {
                await api({ action: 'fan_control', value: on ? 'on' : 'off' }, true);
                await load();
            }, t('save.saved'));
        });

        q('#unc-led-import-btn').addEventListener('click', () => {
            run(async () => {
                await api({ action: 'led_import' }, true);
                // The LED pages read their settings when they load.
                location.reload();
            }, t('leds.imported'));
        });

        q('#unc-led-enabled').addEventListener('change', event => {
            const on = event.target.checked;

            run(async () => {
                await api({ action: 'led', value: on ? 'on' : 'off' }, true);
                // The LED pages are part of the page, so it loads again with or without them; back on the overview.
                try { sessionStorage.setItem('unc-nav', 'led:overview'); } catch (error) { /* then it opens on the cockpit */ }
                reloadSaved();
            });
        });

        const theme = q('#unc-theme');
        theme.value = window.UGREEN_NAS_THEME || 'dark';

        theme.addEventListener('change', async () => {
            root.dataset.theme = resolveTheme(theme.value);
            // The LED pages sit in their own root; they follow the scheme at once.
            const ledRoot = document.getElementById('ulc');
            if (ledRoot) ledRoot.dataset.theme = root.dataset.theme;
            window.UGREEN_NAS_THEME = theme.value;

            try {
                await api({ action: 'theme', value: theme.value }, true);
                saved();
            } catch (error) {
                toast(error.message, 'error');
            }
        });

        q('#unc-language').addEventListener('change', async event => {
            try {
                await api({ action: 'lang', value: event.target.value }, true);
                reloadSaved();
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

    function paintLedsNow() {
        applyLeds(q('#unc-hero'));
        renderCaseFoot();
    }

    async function init() {
        translatePage();
        mountStatic();
        bindEvents();

        q('#unc-version').textContent = window.UGREEN_NAS_VERSION || '';
        q('#unc-language').value = window.UGREEN_NAS_LANG_SETTING || 'auto';

        // After switching the LEDs on or off the page loads again: back to where the switch is.
        try {
            const nav = sessionStorage.getItem('unc-nav');
            sessionStorage.removeItem('unc-nav');
            if (nav) showView(nav);
            if (sessionStorage.getItem('unc-saved')) { sessionStorage.removeItem('unc-saved'); saved(); }
        } catch (error) { /* storage blocked */ }

        await load();
        loadHardware().then(() => loadLeds()).then(paintLedsNow);

        // Polling cost: the NAS runs a process per request, so each resource has its own pace and only
        // runs on the views that show it (hidden/idle tabs: see UNCPoll). The fan daemon itself refreshes every 2 s.
        const LIVE = ['overview', 'case', 'curves', 'sensors'];
        const decor = () => state.view === 'case' || state.view === 'overview' || state.view === 'sensors';

        polls.status = window.UNCPoll.every(() => (state.busy ? null : load()), () => (state.data?.calibration?.progress?.state === 'running' ? 3000 : LIVE.includes(state.view) ? 5000 : 15000));
        polls.hardware = window.UNCPoll.every(() => (state.busy ? null : loadHardware()), 60000, decor);
        // On the LED pages the LED app polls led/all itself (every 10 s); elsewhere the LEDs are decoration.
        polls.leds = window.UNCPoll.every(() => (state.busy ? null : loadLeds().then(paintLedsNow)), LED_POLL_MS, decor);
    }

    init();
})();
