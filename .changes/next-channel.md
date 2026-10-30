---
type: chore
---

Next channel: every push to `next` publishes a rolling build `X.(Y+1)-next.NNNNNN` as `ugreen-nas-control.plg` (GitHub Pages, `/next/`), replacing the beta channel. It installs over stable and local test builds in place; going back to a lower version needs `plugin install <url> forced`.
