---
type: fix
---

Script inputs work on Unraid: `/boot` is vfat and files there can never be executable, so the script now runs through the interpreter named in its shebang (`bash`, `sh`, `php`, also via `env`). A missing shebang or another interpreter is reported in the input test.
