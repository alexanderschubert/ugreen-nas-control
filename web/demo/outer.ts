// The demo page: model switcher, view, theme and language, reset; the plugin runs in the frame below.
// Everything is in the URL, so a view can be shared: ?model=dxp4800-gt&page=fans&theme=dark&lang=de[&view=dashboard]
import { KEY, resetDemo, seedPrefs } from './api';
import { LED_ICONS, NAS_ICONS, SITE_ICONS, STATUS_ICONS, svgIcon } from '../src/core/icons';
import { CAPABILITIES, CAPABILITY_LABEL, EVIDENCE_LABEL, checkText, monthYear } from '../models/schema';
import { LANGS } from '../src/core/i18n';
import { browserStore, findModel, MODELS, PAGES, pageAvailable } from './shared';

/** The address of the .plg, put in by tools/demo.ts at build time. */
declare const __PLG_URL__: string;

const store = browserStore();
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const frame = $<HTMLIFrameElement>('frame');
const select = $<HTMLSelectElement>('model');
const themeSelect = $<HTMLSelectElement>('theme');
const langSelect = $<HTMLSelectElement>('lang');

const LANG_NAMES: Record<(typeof LANGS)[number], string> = {
    de: 'Deutsch',
    en: 'English',
    es: 'Español',
    fr: 'Français',
    it: 'Italiano',
    nl: 'Nederlands',
    zh: '简体中文'
};
for (const l of LANGS) langSelect.append(new Option(LANG_NAMES[l], l));

const params = new URLSearchParams(location.search);
/** Inside the site's dialog: no back links, the dialog has its own header. */
const embed = params.get('embed') === '1';
document.documentElement.classList.toggle('embed', embed);

/** The site's theme choice (same key as docs/site/build.ts; the demo is served from the same origin), else the browser's. */
const SITE_THEME = 'theme';
const validTheme = (v: string | null | undefined): v is 'dark' | 'light' => v === 'dark' || v === 'light';
function siteTheme(): 'dark' | 'light' {
    let stored: string | null = null;
    try {
        stored = localStorage.getItem(SITE_THEME);
    } catch {
        // storage blocked: the browser's scheme decides
    }
    return validTheme(stored) ? stored : matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
// A theme= link wins on the first load; otherwise the demo starts with the site's theme.
const linked = params.get('theme');
seedPrefs(store, { lang: params.get('lang'), theme: params.get('theme') === 'auto' ? 'auto' : validTheme(linked) ? linked : siteTheme() });

let modelId = findModel(params.get('model')).id;
let view: 'plugin' | 'dashboard' = params.get('view') === 'dashboard' ? 'dashboard' : 'plugin';
const wanted = params.get('page') ?? '';
let page = wanted in PAGES ? wanted : 'overview';
if (!pageAvailable(findModel(modelId), page)) page = 'overview';

const prefs = (): { ui_lang?: string; ui_theme?: string } => JSON.parse(store.getItem(`${KEY}prefs`) ?? '{}');

for (const series of ['DX', 'DXP', 'iDX']) {
    const group = document.createElement('optgroup');
    group.label = `${series} series`;
    for (const m of MODELS.filter(x => x.series === series)) group.append(new Option(m.name, m.id));
    if (group.children.length) select.append(group);
}

function query(): URLSearchParams {
    const p = new URLSearchParams({ model: modelId });
    if (params.has('scenario')) p.set('scenario', params.get('scenario') ?? '');
    if (view === 'dashboard') p.set('view', 'dashboard');
    else if (page !== 'overview') p.set('page', page);
    const { ui_lang: lang, ui_theme: theme } = prefs();
    if (theme && theme !== 'dark') p.set('theme', theme);
    if (lang && lang !== 'en') p.set('lang', lang);
    return p;
}

const ICON_TABLE: Record<string, string> = { ...LED_ICONS, ...NAS_ICONS, ...SITE_ICONS };
document.querySelectorAll<HTMLElement>('[data-icon]').forEach(el => {
    el.innerHTML = svgIcon(ICON_TABLE[el.dataset.icon ?? ''] ?? '', 16, '');
});
const CAP_ICON = { leds: 'bulb', fans: 'fan', case: 'box', sensors: 'thermo' } as const;

function badges(): void {
    const m = findModel(modelId);
    const el = $('badges');
    el.replaceChildren();
    for (const cap of CAPABILITIES) {
        const c = m.verified[cap];
        if (c.status === 'unsupported') continue;
        const s = document.createElement('span');
        s.className = `badge st-${c.status}`;
        const when = [c.version ?? '', monthYear(c.date)].filter(Boolean).join(', ');
        s.title = [`${CAPABILITY_LABEL[cap]}: ${checkText(c)}`, c.by ? `by ${c.by}` : '', c.note ?? ''].filter(Boolean).join('. ');
        s.innerHTML = `${svgIcon(NAS_ICONS[CAP_ICON[cap]], 16, '')}<span>${CAPABILITY_LABEL[cap]}</span><span class="state">${svgIcon(STATUS_ICONS[c.status], 14, 'glyph')}${EVIDENCE_LABEL[c.status]}${when ? `<small>${when}</small>` : ''}</span>`;
        el.append(s);
    }
}

function sync(reload: boolean): void {
    const { ui_lang: lang, ui_theme: theme } = prefs();
    select.value = modelId;
    themeSelect.value = theme === 'light' ? 'light' : 'dark';
    langSelect.value = LANGS.find(l => l === lang) ?? 'en';
    document.querySelectorAll<HTMLElement>('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    badges();
    const q = query();
    const mine = new URLSearchParams(q);
    if (embed) mine.set('embed', '1');
    history.replaceState(null, '', `?${mine}`);
    const exit = new URLSearchParams(q);
    exit.set('demo', exit.get('model') ?? '');
    exit.delete('model');
    $<HTMLAnchorElement>('exit').href = `../?${exit}`;
    if (embed) parent.postMessage({ demo: 'url', search: q.toString() }, location.origin);
    document.title = `${findModel(modelId).name}: UGREEN NAS Control demo`;
    if (!reload) return;
    const p = new URLSearchParams({ model: modelId });
    if (params.has('scenario')) p.set('scenario', params.get('scenario') ?? '');
    if (view === 'plugin' && page !== 'overview') p.set('page', page);
    frame.src = `${view === 'dashboard' ? 'tile' : 'app'}.html?${p}`;
}

select.addEventListener('change', () => {
    modelId = select.value;
    if (!pageAvailable(findModel(modelId), page)) page = 'overview';
    sync(true);
});
document.querySelectorAll<HTMLElement>('[data-view]').forEach(b =>
    b.addEventListener('click', () => {
        view = b.dataset.view === 'dashboard' ? 'dashboard' : 'plugin';
        sync(true);
    })
);
function setTheme(theme: string, source: 'bar' | 'outside'): void {
    if (prefs().ui_theme === theme && source === 'outside') return;
    seedPrefs(store, { theme });
    if (source === 'bar') {
        try {
            localStorage.setItem(SITE_THEME, theme);
        } catch {
            // storage blocked: the message below still reaches the site
        }
        if (embed) parent.postMessage({ demo: 'theme', theme }, location.origin);
    }
    sync(true);
}
themeSelect.addEventListener('change', () => setTheme(themeSelect.value, 'bar'));
window.addEventListener('storage', event => {
    if (event.key === SITE_THEME && validTheme(event.newValue)) setTheme(event.newValue, 'outside');
});
langSelect.addEventListener('change', () => {
    seedPrefs(store, { lang: langSelect.value });
    sync(true);
});
$('reset').addEventListener('click', () => {
    resetDemo(store, Object.keys(localStorage));
    page = 'overview';
    sync(true);
});
window.addEventListener('message', event => {
    if (event.origin !== location.origin) return;
    if (event.data?.demo === 'theme' && validTheme(event.data.theme)) {
        setTheme(event.data.theme, 'outside');
    } else if (event.data?.demo === 'nav') {
        page = String(event.data.page);
        sync(false);
    } else if (event.data?.demo === 'esc') {
        if (embed) parent.postMessage({ demo: 'close' }, location.origin);
    } else if (event.data?.demo === 'open') {
        view = 'plugin';
        page = pageAvailable(findModel(modelId), String(event.data.page)) ? String(event.data.page) : 'overview';
        sync(true);
    }
});

sync(true);

$('install').addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(__PLG_URL__);
    } catch {
        const box = Object.assign(document.createElement('textarea'), { value: __PLG_URL__ });
        document.body.append(box);
        box.select();
        document.execCommand('copy');
        box.remove();
    }
    $('install-label').textContent = 'Copied';
    $('copied').hidden = false;
    setTimeout(() => ($('install-label').textContent = 'Copy install URL'), 2500);
    setTimeout(() => ($('copied').hidden = true), 12000);
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && embed) parent.postMessage({ demo: 'close' }, location.origin);
});
