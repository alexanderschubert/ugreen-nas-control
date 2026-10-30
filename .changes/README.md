# Changelog fragments

Every PR adds one file `.changes/<slug>.md` (lowercase, dashes), unless nothing a user sees changes.

```
---
type: feat
---
Fans: "Measure fans" stores the rpm per speed.
```

- `type`: `feat`, `fix`, `model`, `docs` or `chore`. It sets the release size: `fix` patch, `feat` and `model` minor, `docs` and `chore` none ([Versions](../docs/releasing.md#versions)). Text: one line, plain words, no leading `- `.
- Never edit `plugin/ugreen-nas-control.plg`, `CHANGELOG.md` or a version: the release folds the fragments into `CHANGELOG.md` and the plugin's change list.
- `bun plugin/tools/changes.ts check` validates them (CI runs it).
