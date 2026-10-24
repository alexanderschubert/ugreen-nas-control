# Icon

- `icon.svg`: the plugin icon (Plugins page, sidebar, About page, README): a NAS as a small cube with a coloured LED under each of four bays and a white fan in the lid
- `icon-small.svg`: the same with fewer, bolder parts, for the small icon (Settings menu, 18 px)

The PNGs are `src/web/images/ugreen-nas-control.png` (256 px, from `icon.svg`) and
`src/web/icons/ugreen-nas-control.png` (64 px, from `icon-small.svg`). The corners are transparent, so there is
nothing to cut out afterwards:

```
docker run --rm -v "$PWD:/w" alpine sh -c 'apk add --no-cache rsvg-convert >/dev/null && cd /w \
  && rsvg-convert -w 256 -h 256 assets/icon.svg -o src/web/images/ugreen-nas-control.png \
  && rsvg-convert -w 64 -h 64 assets/icon-small.svg -o src/web/icons/ugreen-nas-control.png'
```
