<?php
// Renders a .page file like Unraid does: header cut off, the autov calls resolved.
// ?p=dash shows the dashboard tile instead of the settings page, on a light dashboard.
$dash = ($_GET['p'] ?? '') === 'dash';
$file = $dash ? 'UGREENNASDashboard.page' : 'UGREENNASControl.page';
$src = file_get_contents("/usr/local/emhttp/plugins/ugreen-nas-control/{$file}");
$body = explode("\n---\n", $src, 2)[1];
$body = preg_replace("/<\\?autov\\('([^']*)'\\)\\?>/", '$1', $body);
$bg = $dash ? '#f2f2f2' : '#0b0e12';
echo "<!doctype html><html><head><meta charset=\"utf-8\"><title>UGREEN NAS Control</title></head><body style=\"margin:0;padding:" . ($dash ? '20px' : '0') . ";background:{$bg}\">";
$mytiles = [];
ob_start();
eval('?>' . $body);
$rest = ob_get_clean();
if ($dash) {
    echo '<table style="width:430px">' . $mytiles['ugreen-nas-control']['column2'] . '</table>';
}
echo $rest;
echo '</body></html>';
