// The 1280x640 social preview, rendered by web/tools/shots.ts: the plugin's own drawing of a DXP6800 Pro front next to the name.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadModels } from '../../web/models/index';
import { liveFront, pluginCss } from './live';

const root = resolve(import.meta.dir, '../..');
const model = (await loadModels()).find(m => m.id === 'dxp6800-pro');
if (!model) throw new Error('social preview: model dxp6800-pro missing in web/models');
const front = liveFront(model);
const css = pluginCss();

export function socialHtml(): string {
    const icon = `data:image/svg+xml;base64,${readFileSync(resolve(root, 'web/assets/icon.svg')).toString('base64')}`;
    return `<!doctype html><html><head><meta charset="utf-8"><style>
${css}
*{box-sizing:border-box;margin:0}
body{width:1280px;height:640px;overflow:hidden;background:var(--unc-bg);color:var(--unc-text);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;position:relative}
.dots{position:absolute;inset:0;background:radial-gradient(circle at 1px 1px,#ffffff14 1.2px,transparent 1.6px) 0 0/22px 22px}
.glow{position:absolute;left:560px;top:60px;width:760px;height:520px;background:radial-gradient(closest-side,#2f7cf62e,transparent)}
.text{position:absolute;left:64px;top:64px;bottom:64px;width:470px;display:flex;flex-direction:column;justify-content:space-between}
img.icon{width:112px;height:112px;border-radius:26px}
h1{font-size:44px;line-height:1;letter-spacing:-.035em;font-weight:760;margin-bottom:22px}
p{font-size:29px;line-height:1.3;color:var(--unc-muted)}
.leds{display:flex;gap:10px}
.leds b{width:44px;height:8px;border-radius:4px}
.nas{position:absolute;left:590px;top:150px;width:640px}
.nas .nas-live{color:var(--unc-text);font:14px/1.45 Inter,-apple-system,"Segoe UI",sans-serif;width:720px;zoom:.89}
.nas-live *{box-sizing:border-box}
</style></head><body><div class="dots"></div><div class="glow"></div>
<div class="text"><img class="icon" src="${icon}" alt=""><div><h1>Unraid on your UGREEN, with everything UGOS did for the hardware.</h1><p>Fan curves, LEDs, case view, watchdog</p></div>
<div class="leds"><b style="background:#ff3b30"></b><b style="background:#ffd60a"></b><b style="background:#34c759"></b><b style="background:#0a84ff"></b></div></div>
<div class="nas"><div class="nas-live unc-hero">${front}</div></div></body></html>`;
}
