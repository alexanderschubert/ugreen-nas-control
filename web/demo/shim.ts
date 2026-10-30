// Runs in the plugin frame before the plugin's own scripts (web/tools/demo.ts puts it first in <head>): answers the
// plugin's api.php requests from web/demo/api.ts, and gives the page the globals Unraid's PHP would have written.
import { createDemo, pageGlobals } from './api';
import { browserStore, findModel, PAGES, pageOfNav } from './shared';

const params = new URLSearchParams(location.search);
const model = findModel(params.get('model'));
const store = browserStore();
const demo = createDemo(model, store, { live: true, scenario: params.get('scenario') });
const g = pageGlobals(store, model.id, navigator.language);

// The page was rendered with the LED pages on or off; the switch may have changed (the plugin reloads after it).
const root = document.documentElement;
const file = root.dataset.demo ?? 'app';
if ((root.dataset.led === '1') !== g.led) {
    location.replace(`${file}${g.led ? '' : '-noled'}.html${location.search}`);
}

(window as unknown as { __UNC_DEMO: unknown }).__UNC_DEMO = {
    UGREEN_NAS_LANG: g.lang,
    UGREEN_NAS_LANG_SETTING: g.setting,
    UGREEN_NAS_THEME: g.theme,
    UGREEN_LED_LANG: g.lang,
    UGREEN_LED_THEME: g.theme
};

const original = window.fetch;
const real = original.bind(window);
window.fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : String(input), location.href);
        if (!/\/api\.php$/.test(url.pathname)) return real(input, init);
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        const body = init?.body instanceof URLSearchParams ? init.body : new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
        await new Promise(done => setTimeout(done, 40));
        const answer = demo.handle(method, url.pathname, url.searchParams, body);
        return new Response(JSON.stringify(answer.json), { status: answer.status, headers: { 'content-type': 'application/json' } });
    },
    { preconnect: original.preconnect }
);

// Deep link to a page: the plugin opens the view it finds in sessionStorage (it does so after switching the LEDs).
const page = params.get('page');
if (page && PAGES[page]) {
    sessionStorage.setItem('unc-nav', PAGES[page]);
    params.delete('page');
    history.replaceState(null, '', `${location.pathname}?${params}`);
}

// The page behind the plugin follows its colour scheme (Unraid's own page does that in the real thing).
const background = (theme: string | undefined) => (theme === 'light' ? (file === 'tile' ? '#f2f2f2' : '#f4f6f9') : file === 'tile' ? '#1c1d21' : '#0b0e12');
const paint = () => {
    const scheme =
        document.querySelector<HTMLElement>('[data-theme]')?.dataset.theme ??
        (g.theme === 'auto' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : g.theme);
    root.style.setProperty('--demo-bg', background(scheme));
    root.style.setProperty('--demo-fg', scheme === 'light' ? '#1c1b1b' : '#f2f2f2');
};
paint();
new MutationObserver(paint).observe(root, { attributes: true, attributeFilter: ['data-theme'], subtree: true });

// Tell the demo page which view is open, so its URL can be shared (also after a reload, which opens the overview again).
const first = pageOfNav(sessionStorage.getItem('unc-nav') ?? 'overview');
window.addEventListener('load', () => parent.postMessage({ demo: 'nav', page: first }, location.origin));

document.addEventListener('click', event => {
    const nav = (event.target as Element | null)?.closest<HTMLElement>('[data-nav]')?.dataset.nav;
    if (nav) parent.postMessage({ demo: 'nav', page: pageOfNav(nav) }, location.origin);
});

// The dashboard tile links to the plugin's settings page: open the plugin view of the demo instead.
document.addEventListener(
    'click',
    event => {
        const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="/Settings/"]');
        if (!link) return;
        event.preventDefault();
        parent.postMessage({ demo: 'open', page: pageOfNav(link.dataset.nav ?? 'overview') }, location.origin);
    },
    true
);

// Esc inside the plugin closes the site's dialog around the demo.
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') parent.postMessage({ demo: 'esc' }, location.origin);
});
