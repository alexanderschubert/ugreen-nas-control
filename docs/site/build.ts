// Builds the static site into .build/site from web/models/ (the registry) and docs/site/style.css. One landing page (hero with the
// live case view of the chosen model, UGOS comparison, support matrix, install steps) plus one short page per model so the old
// /models/<id>/ links keep working. The live demo (web/tools/demo.ts) is copied to .build/site/demo. Plain HTML written by TypeScript.
//
//   bun docs/site/build.ts
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadModels } from '../../web/models/index';
import { CAPABILITIES, type Capability, type Check, type Evidence, type Model, SERIES, monthYear, overallStatus } from '../../web/models/schema';
import {
    ARM_NOTE,
    CA_LIVE,
    CAPABILITY_LABEL,
    EVIDENCE_HELP,
    EVIDENCE_LABEL,
    FORUM,
    GITHUB,
    HEADLINE,
    KEYWORDS,
    META_DESC,
    OVERALL_HELP,
    OVERALL_LABEL,
    PLG_URL,
    SITE_URL,
    SUBLINE,
    checkText
} from './content';
import { demoModal } from '../../web/demo/site-modal';
import { CAPABILITY_ICON, capIcon, icon, statusIcon } from './icons';
import { liveFront, pluginCss } from './live';

const root = resolve(import.meta.dir, '../..');
const dist = join(root, '.build/site');
const built = join(root, '.build');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const demoUrl = (rel: string, m: Model, view = '') => `${rel}demo/?model=${m.id}${view ? `&view=${view}` : ''}`;
const DEFAULT_MODEL = 'dxp6800-pro';

// ---- pieces -----------------------------------------------------------------------------------------------

/** Drive bays of a model; the registry leaves some null, there the model number starts with the bay count (DXP6800 -> 6). */
const bayCount = (m: Model) => m.bays || m.m2Slots || 4;

/** Text-free front: one slot per bay with its drive LED, the same for every model; for models without a case view. */
const mini = (m: Model) => {
    const n = bayCount(m);
    return `<div class="mini" style="--n:${n}" aria-hidden="true">${'<i></i>'.repeat(n)}</div>`;
};

/** The plugin's own width rule for the front: 100 px per bay plus the frame. */
const naturalWidth = (m: Model) => bayCount(m) * 100 + 120;

/** The plugin's own front drawing for the model page, scaled to fit; the mini front for models without a case view. */
function front(m: Model): string {
    const live = liveFront(m);
    if (!live) return mini(m);
    const natural = naturalWidth(m);
    const z = (w: number) => Math.min(1, w / natural).toFixed(3);
    return `<div class="thumb" aria-hidden="true"><div class="nas-live unc-hero" style="width:${natural}px;--zd:${z(360)};--zm:${z(340)}">${live}</div></div>`;
}

/** What one check says in words, for tooltips and screen readers: "LEDs: Verified on 3.6, Oct 2026". */
const checkLine = (m: Model, cap: Capability) => `${CAPABILITY_LABEL[cap]}: ${checkText(m.verified[cap])}`;

/** The hero's picture of one model: the front as the plugin draws it, scaled to the column by the page script. */
function stagePicture(m: Model): string {
    const live = liveFront(m);
    if (!live) return `<div class="plate bare">${mini(m)}<p>No case view on this model. The bays are drawn without drive details.</p></div>`;
    return `<div class="plate"><div class="fit" data-natural="${naturalWidth(m)}" aria-hidden="true"><div class="nas-live unc-hero" style="width:${naturalWidth(m)}px">${live}</div></div></div>`;
}

const chip = (iconName: string, label: string, status: Evidence, title: string) => {
    const state = status === 'unsupported' ? 'Not offered' : EVIDENCE_LABEL[status];
    return `<li class="st-${status}" title="${esc(title)}"><span class="cap">${icon(iconName, 20)}<span class="badge">${statusIcon(status, 11)}</span></span><span><b>${label}</b><small>${state}</small></span></li>`;
};

function stage(m: Model, rel: string): string {
    const all = overallStatus(m);
    const chips = CAPABILITIES.map(c => chip(CAPABILITY_ICON[c], CAPABILITY_LABEL[c], m.verified[c].status, checkLine(m, c)));
    const wd = m.fan?.watchdog;
    if (wd) chips.push(chip('shield', 'Watchdog', wd.status, `Watchdog: ${checkText(wd)}. ${wd.note ?? ''}`));
    return `<div class="stage" data-model="${m.id}"${m.id === DEFAULT_MODEL ? '' : ' hidden'}>
  ${stagePicture(m)}
  <ul class="chips" aria-label="What works on the ${esc(m.name)}">${chips.join('')}</ul>
  <p class="sum st-${all}">${statusIcon(all, 16)}<span><b>${OVERALL_LABEL[all]}.</b> ${esc(OVERALL_HELP[all])}</span></p>
  <p class="acts"><a class="btn quiet" href="${demoUrl(rel, m)}">${icon('play', 16)}Try the ${esc(m.name)} in the live demo</a><a class="textlink" href="${demoUrl(rel, m, 'dashboard')}">See the dashboard tile</a></p>
</div>`;
}

const modelPicker = (listed: Model[]) =>
    `<select id="model">${SERIES.map(series => {
        const group = listed.filter(m => m.series === series);
        return group.length
            ? `<optgroup label="${series} series">${group.map(m => `<option value="${m.id}"${m.id === DEFAULT_MODEL ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</optgroup>`
            : '';
    }).join('')}</select>`;

const SCRIPT = `
document.addEventListener('click',e=>{
  const c=e.target.closest('[data-copy]');
  if(c)navigator.clipboard.writeText(c.dataset.copy).then(()=>{const l=c.querySelector('.lbl'),o=l.textContent;l.textContent='Copied';setTimeout(()=>{l.textContent=o},1600)});
  if(e.target.closest('#theme')){const t=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=t;try{localStorage.setItem('theme',t)}catch(_){}}
});
(()=>{
  const sel=document.getElementById('model');
  const fit=()=>document.querySelectorAll('.stage:not([hidden]) .fit').forEach(f=>{f.firstElementChild.style.zoom=Math.min(1,f.clientWidth/f.dataset.natural)});
  const show=()=>{if(sel)document.querySelectorAll('.stage').forEach(s=>{s.hidden=s.dataset.model!==sel.value});fit()};
  if(sel)sel.addEventListener('change',show);
  addEventListener('resize',fit);show();
  setTimeout(()=>document.documentElement.classList.add('booted'),3500);
})();`;
const THEME_INIT = `(()=>{let t;try{t=localStorage.getItem('theme')}catch(_){}if(!t)t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=t})()`;

function layout(o: { title: string; desc: string; rel: string; body: string; path: string; ld?: object }): string {
    const img = `${SITE_URL}social-preview.png`;
    const social = existsSync(join(built, 'social-preview.png'))
        ? `<meta property="og:image" content="${img}"><meta property="og:image:width" content="1280"><meta property="og:image:height" content="640"><meta property="og:image:alt" content="UGREEN NAS Control: ${esc(HEADLINE)}"><meta name="twitter:image" content="${img}">`
        : '';
    const ld = o.ld ? `\n<script type="application/ld+json">${JSON.stringify(o.ld)}</script>` : '';
    return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<meta name="keywords" content="${esc(KEYWORDS)}">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#2B2F33">
<link rel="canonical" href="${SITE_URL}${o.path}">
<link rel="icon" href="${o.rel}icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${o.rel}icon.png">
<meta property="og:site_name" content="UGREEN NAS Control"><meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.desc)}"><meta property="og:type" content="website"><meta property="og:url" content="${SITE_URL}${o.path}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(o.title)}"><meta name="twitter:description" content="${esc(o.desc)}">
${social}${ld}
<script>${THEME_INIT}</script>
<link rel="preload" href="${o.rel}fonts/Archivo-latin-wdth.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${o.rel}style.css">
</head>
<body>
<header class="top"><div class="bar">
  <a class="brand" href="${o.rel}"><img src="${o.rel}icon.svg" alt="" width="28" height="28"><span>UGREEN NAS Control</span></a>
  <nav class="menu" aria-label="Sections"><a href="${o.rel}#features">Features</a><a href="${o.rel}#models">Models</a><a href="${o.rel}#install">Install</a></nav>
  <a class="iconbtn" href="${GITHUB}" aria-label="Source on GitHub">${icon('github')}</a>
  <button class="iconbtn" id="theme" type="button" aria-label="Switch between light and dark theme"><span class="dark-only">${icon('sun')}</span><span class="light-only">${icon('moon')}</span></button>
</div></header>
<main>
${o.body}
</main>
${FOOTER}
${o.path === '' ? demoModal(o.rel) : ''}
<script>${SCRIPT}</script>
</body>
</html>
`;
}

const copyBox = () =>
    `<div class="copy"><code aria-label="Plugin URL">${PLG_URL}</code><button type="button" data-copy="${PLG_URL}" aria-label="Copy the plugin URL">${icon('copy', 16)}<span class="lbl">Copy</span></button></div>`;

const installHint = CA_LIVE
    ? 'Community Applications: search <b>UGREEN NAS Control</b>. Or in Plugins, Install Plugin, paste this URL:'
    : 'In Unraid, open Plugins, Install Plugin and paste this URL:';

const FOOTER = `<footer><div class="foot">
  <nav aria-label="Project"><a href="${GITHUB}">GitHub</a><a href="${FORUM}">Unraid forum</a><a href="${GITHUB}/blob/main/docs/third-party.md">Credits and licences</a><a href="${GITHUB}/blob/main/LICENSE">MIT license</a></nav>
  <p>${esc(ARM_NOTE)}</p>
  <p>Not affiliated with UGREEN or Lime Technology. Product names belong to their owners. Set in Archivo (SIL Open Font License 1.1).</p>
</div></footer>`;

// ---- landing sections -------------------------------------------------------------------------------------

/** One cell of the support table: status glyph, label, and when/who as a second line; the note is the tooltip. */
function cell(c: Check | undefined, name: string, tipExtra = ''): string {
    if (!c || c.status === 'unsupported')
        return `<td class="st-unsupported" data-label="${esc(name)}" title="${esc(name)}: not offered">${statusIcon('unsupported')}<span class="sr">Not offered</span></td>`;
    const when = [c.version ? `on ${c.version}` : '', c.date ? monthYear(c.date) : ''].filter(Boolean).join(', ') || (c.by ?? '');
    const tip = [`${name}: ${checkText(c)}`, c.by ? `by ${c.by}` : '', c.note ?? '', tipExtra].filter(Boolean).join('. ');
    const label = `<span class="lbl">${EVIDENCE_LABEL[c.status]}</span>${when ? `<small>${esc(when)}</small>` : ''}`;
    const body = c.ref ? `<a href="${esc(c.ref)}" rel="noopener">${label}</a>` : label;
    return `<td class="st-${c.status}" data-label="${esc(name)}" title="${esc(tip)}">${statusIcon(c.status)}<span class="what">${body}</span></td>`;
}

const ORDER = ['verified', 'community', 'partial', 'expected'] as const;

/** Evidence of one feature across the models, counted from the registry: "Verified on DXP6800 Pro, DXP4800 GT". */
function evidence(entries: { model: string; check: Check }[]): string {
    const by = new Map<Evidence, string[]>();
    for (const e of entries) by.set(e.check.status, [...(by.get(e.check.status) ?? []), e.model]);
    const lines = ORDER.filter(k => by.has(k)).map(k => {
        const names = by.get(k) ?? [];
        const who = names.length <= 3 ? names.join(', ') : `${names.length} models`;
        return `<li class="st-${k}">${statusIcon(k)}<span><b>${EVIDENCE_LABEL[k]}</b> on ${esc(who)}</span></li>`;
    });
    return `<ul class="ev">${lines.join('')}</ul>`;
}

interface Feature {
    icon: string;
    name: string;
    ugos: string;
    stock: string;
    plugin: string;
    proof: string;
}

function features(listed: Model[]): Feature[] {
    const cap = (c: Capability) => evidence(listed.filter(m => m.verified[c].status !== 'unsupported').map(m => ({ model: m.name, check: m.verified[c] })));
    const dog = listed.filter(m => m.fan?.watchdog);
    const untracked = '<p class="lim">Not tracked per model.</p>';
    return [
        {
            icon: 'fan',
            name: 'Fan curves',
            ugos: 'Built in',
            stock: 'BIOS curve only',
            plugin: 'Modes from Quiet to Full speed or your own curves, with measured rpm and safety limits.',
            proof: cap('fans')
        },
        {
            icon: 'bulb',
            name: 'LEDs',
            ugos: 'Built in',
            stock: 'No driver',
            plugin: 'Colour, effects and brightness per LED, disk activity, errors, network speed and night mode.',
            proof: cap('leds')
        },
        {
            icon: 'box',
            name: 'Case view',
            ugos: '',
            stock: 'None',
            plugin: 'Front, rear ports with LAN speeds, and the inside on mapped models, with live drive state.',
            proof: cap('case')
        },
        {
            icon: 'thermo',
            name: 'Temperatures',
            ugos: 'Built in',
            stock: 'Drives, other sensors need extra plugins',
            plugin: 'CPU, board, iGPU, fan controller, LAN chips, NVMe and disks. Sleeping disks stay asleep.',
            proof: cap('sensors')
        },
        {
            icon: 'home',
            name: 'Dashboard tile',
            ugos: '',
            stock: 'None',
            plugin: 'Fans, temperatures, SSDs and live LEDs on the Unraid dashboard.',
            proof: untracked
        },
        {
            icon: 'net',
            name: 'MQTT',
            ugos: '',
            stock: 'No publisher',
            plugin: 'Publishes status for displays and Home Assistant. Off until you set a broker.',
            proof: untracked
        },
        {
            icon: 'shield',
            name: 'Hardware watchdog',
            ugos: 'Built in',
            stock: '',
            plugin: 'If the BIOS arms the EC watchdog, the plugin keeps it fed while Unraid runs. If Unraid hangs, the box restarts itself. The plugin never arms it.',
            proof: `${evidence(dog.map(m => ({ model: m.fixtureDmi, check: m.fan?.watchdog as Check })))}<p class="lim">Only these models have the EC watchdog.</p>`
        }
    ];
}

const dash = (label: string) => `<td data-label="${label}"><span class="nil" aria-hidden="true">&ndash;</span><span class="sr">No claim</span></td>`;

function comparison(listed: Model[]): string {
    const rows = features(listed)
        .map(
            f =>
                `<tr role="row"><th scope="row" role="rowheader"><span class="feat">${icon(f.icon, 20)}${f.name}</span></th>${f.ugos ? `<td role="cell" data-label="UGOS">${f.ugos}</td>` : dash('UGOS')}${f.stock ? `<td role="cell" data-label="Stock Unraid">${f.stock}</td>` : dash('Stock Unraid')}<td role="cell" class="plug" data-label="Unraid with this plugin"><p>${f.plugin}</p>${f.proof}</td></tr>`
        )
        .join('');
    return `<section class="band" id="features" aria-labelledby="cmp">
  <h2 id="cmp">What UGOS did for the hardware, now on Unraid</h2>
  <p class="intro">UGOS drove the fans, LEDs and sensors of your box. Stock Unraid does not know that hardware. The plugin brings it back, and says per model how well each part is confirmed.</p>
  <table class="compare" role="table"><caption class="sr">Features compared across UGOS, stock Unraid and Unraid with this plugin</caption>
  <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Feature</th><th scope="col" role="columnheader">UGOS</th><th scope="col" role="columnheader">Stock Unraid</th><th scope="col" role="columnheader">Unraid with this plugin</th></tr></thead>
  <tbody role="rowgroup">${rows}</tbody></table>
  <p class="foot-note">A dash means no claim is made. Evidence labels come from the model registry; the table below has them per model.</p>
</section>`;
}

function support(listed: Model[], rel: string): string {
    const rows = listed
        .map(m => {
            const all = overallStatus(m);
            const wd = m.fan?.watchdog;
            return `<tr><th scope="row"><a href="${demoUrl(rel, m)}">${esc(m.name)}</a></th>${CAPABILITIES.map(c => cell(m.verified[c], CAPABILITY_LABEL[c])).join('')}${cell(wd, 'Watchdog', wd && m.id === 'idx6011' ? 'iDX6011 Pro only' : '')}<td class="st-${all} overall" data-label="Overall" title="${esc(OVERALL_HELP[all])}">${statusIcon(all)}<span class="what"><span class="lbl">${OVERALL_LABEL[all]}</span></span></td></tr>`;
        })
        .join('');
    const head = [...CAPABILITIES.map(c => [CAPABILITY_ICON[c], CAPABILITY_LABEL[c]]), ['shield', 'Watchdog'], ['check', 'Overall']]
        .map(([i, l]) => `<th scope="col"><span class="hd">${icon(i ?? '', 18)}<span class="lbl">${l}</span></span></th>`)
        .join('');
    const legend = (['verified', 'community', 'partial', 'expected', 'unsupported'] as const)
        .map(e => `<li class="st-${e}" title="${esc(EVIDENCE_HELP[e])}">${statusIcon(e)}<span>${EVIDENCE_LABEL[e]}</span></li>`)
        .join('');
    return `<section class="band" id="models" aria-labelledby="sup">
  <h2 id="sup">Support by model</h2>
  <p class="intro">Each cell is checked on its own. Verified means a maintainer ran it on their own device with the plugin. Hover a cell for details, follow it for the evidence. Pick a model to open its live demo.</p>
  <ul class="legend">${legend}</ul>
  <div class="matrix"><table><thead><tr><th scope="col">Model</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
</section>`;
}

function install(): string {
    return `<section class="band" id="install" aria-labelledby="ins">
  <h2 id="ins">Install</h2>
  <ol class="steps">
    <li><h3>Add the plugin</h3><p>In Unraid, open Plugins, Install Plugin, paste the URL from the top of this page and press Install.</p><p class="req">Unraid 7.2 or newer. x86 UGREEN models only.</p></li>
    <li><h3>Confirm your model</h3><p>Open Settings, UGREEN NAS Control. The plugin names the model it found. If yours is marked Expected, About, Confirm my device helps move it up.</p></li>
    <li><h3>Done</h3><p>Pick a fan mode, switch the LEDs on, and the case view and the dashboard tile fill with live data.</p></li>
  </ol>
</section>`;
}

// ---- pages ------------------------------------------------------------------------------------------------

function landing(listed: Model[]): string {
    const rel = './';
    const body = `
<section class="hero">
  <div class="hero-text">
    <h1>${esc(HEADLINE)}</h1>
    <p class="lead">${esc(SUBLINE)}</p>
    <div class="getit"><p>${installHint}</p>${copyBox()}</div>
  </div>
  <div class="stagebox">
    <div class="pick"><label for="model">Your model</label>${modelPicker(listed)}</div>
    ${listed.map(m => stage(m, rel)).join('\n')}
  </div>
</section>
${comparison(listed)}
${support(listed, rel)}
${install()}`;
    return layout({
        title: 'UGREEN NAS Control: Unraid on your UGREEN, with everything UGOS did for the hardware',
        desc: META_DESC,
        rel,
        body,
        path: '',
        ld: {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'UGREEN NAS Control',
            applicationCategory: 'UtilitiesApplication',
            operatingSystem: 'Unraid 7.2 or newer',
            description: META_DESC,
            license: 'https://opensource.org/license/mit',
            url: SITE_URL,
            downloadUrl: PLG_URL,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
        }
    });
}

/** Kept so old /models/<id>/ links and search results stay alive: a short summary and the way into the demo. */
function modelPage(m: Model): string {
    const rel = '../../';
    const all = overallStatus(m);
    const lines = CAPABILITIES.map(c => {
        const k = m.verified[c];
        const text = k.status === 'unsupported' ? 'not offered' : checkText(k);
        const ref = k.ref ? ` <a href="${esc(k.ref)}" rel="noopener">Evidence</a>` : '';
        return `<li class="st-${k.status}">${capIcon(c, k.status, 22)}<span><b>${CAPABILITY_LABEL[c]}</b>: ${esc(text)}${k.note ? `<br><small>${esc(k.note)}</small>` : ''}${ref}</span></li>`;
    }).join('');
    const body = `
<section class="band model">
  <h1>${esc(m.name)}</h1>
  <p class="lead">${esc(m.note)}</p>
  <div class="solo">${front(m)}</div>
  <p class="overall-line st-${all}">${statusIcon(all, 16)}<span>${OVERALL_LABEL[all]}: ${esc(OVERALL_HELP[all])}</span></p>
  <ul class="caps">${lines}</ul>
  <p><a class="btn" href="${demoUrl(rel, m)}">${icon('play', 16)}Open the live plugin for the ${esc(m.name)}</a></p>
  <div class="getit"><p>${installHint}</p>${copyBox()}</div>
</section>`;
    return layout({
        title: `${m.name} on Unraid: fans, LEDs and case view | UGREEN NAS Control`,
        desc: `UGREEN ${m.name} (NASync) under Unraid: ${m.note}`,
        rel,
        body,
        path: `models/${m.id}/`
    });
}

// ---- build ------------------------------------------------------------------------------------------------

const models = await loadModels();
const listed = models.filter(m => m.led !== 'none');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
// The live demo (just demo) is part of the site; build.ts wipes dist, so it is copied back in here.
if (existsSync(join(built, 'demo'))) cpSync(join(built, 'demo'), join(dist, 'demo'), { recursive: true });
if (existsSync(join(built, 'social-preview.png'))) cpSync(join(built, 'social-preview.png'), join(dist, 'social-preview.png'));
// The plugin's colour tokens and front drawing come first, the site's own rules build on them.
writeFileSync(join(dist, 'style.css'), `${pluginCss()}\n${readFileSync(join(import.meta.dir, 'style.css'), 'utf8')}`);
cpSync(join(root, 'web/assets/icon.svg'), join(dist, 'icon.svg'));
cpSync(join(import.meta.dir, 'fonts'), join(dist, 'fonts'), { recursive: true });
// The Community Applications entries (ca_profile.xml, plugins/*.xml) load the plugin icon from here; the PNG is built (just web-build), not tracked.
cpSync(join(root, '.build/plugin/images/ugreen-nas-control.png'), join(dist, 'icon.png'));
writeFileSync(join(dist, '.nojekyll'), '');

writeFileSync(join(dist, 'index.html'), landing(listed));
for (const m of listed) {
    mkdirSync(join(dist, 'models', m.id), { recursive: true });
    writeFileSync(join(dist, 'models', m.id, 'index.html'), modelPage(m));
}
writeFileSync(
    join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['', ...listed.map(m => `models/${m.id}/`)].map(p => `<url><loc>${SITE_URL}${p}</loc></url>`).join('\n')}\n</urlset>\n`
);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`);
console.log(`site: ${1 + listed.length} pages -> ${dist}`);
