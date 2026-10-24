<?php
// Renders the .page file like Unraid does: header cut off, the autov calls resolved.
$src = file_get_contents('/usr/local/emhttp/plugins/ugreen-nas-control/UGREENNASControl.page');
$body = explode("\n---\n", $src, 2)[1];
$body = preg_replace("/<\\?autov\\('([^']*)'\\)\\?>/", '$1', $body);
echo '<!doctype html><html><head><meta charset="utf-8"><title>UGREEN NAS Control</title></head><body style="margin:0;background:#0b0e12">';
eval('?>' . $body);
echo '</body></html>';
