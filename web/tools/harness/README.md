# Harness

A fake Unraid around the real plugin files, for looking at the UI and for the site screenshots. No hardware, no
Docker, nothing outside a temp dir is written.

```
just harness [model]     # php -S on 127.0.0.1, model = id in web/models/ (default dxp6800-pro)
just shots [model ...]   # screenshots of every model, page and theme -> .build/shots
```

`serve.ts` lays the files out like the plugin installs them (`plugin/files.txt`; built into `.build/plugin`, absolute Unraid paths rewritten into
the temp dir) and starts `php -S` (php 8.4 from the flake).
The NAS API (`api-fixture.php`) answers from the sample data of the model (`web/models/fixture.ts`) and rejects POSTs
without the CSRF token like Unraid. The LED API is the real `web/plugin/led/api.php`; its backend (`fake-led-ctl`)
answers from JSON files. `view.php` renders the `.page` files; `?p=dash` is the dashboard tile, `?shot=1` freezes
the clock and CSS animations.

Add a model: add `web/models/<id>.ts` (see `web/models/schema.ts`), run `bun web/tools/check-models.ts`. Harness, screenshots
and site pick it up.
