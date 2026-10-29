<?php
// The NAS Control API of the fake Unraid: fixed data (DXP6800 Pro); only the LED switch is real.
header('Content-Type: application/json');
$flag = '/boot/config/plugins/ugreen-nas-control/led.enabled';
// docker exec ugreen-fake sh -c 'echo "iDX6011 Pro" > /tmp/model' to try another model
$model = is_file('/tmp/model') ? trim(file_get_contents('/tmp/model')) : 'DXP6800 Pro';
$known = (bool) preg_match('/^(DXP6800|DXP4800.*GT)/', $model);
$family = (bool) preg_match('/^(DXP4800( Plus| Pro)?|DXP8800 Plus|DXP2800( GT)?|iDX6011( Pro)?)$/', $model);
$m = $_SERVER['REQUEST_METHOD'];
// The lowest fan speed and the CPU help switch are the settings the mock keeps (the "min" action).
function valid_min_pct($value) { $min = filter_var($value, FILTER_VALIDATE_INT); return $min === false || $min < 10 || $min > 60 ? null : $min; }
$minPct = is_file('/tmp/min_pct') ? (int) file_get_contents('/tmp/min_pct') : 25;
if ($m === 'POST') {
    $a = $_POST['action'] ?? '';
    if ($a === 'led_import') {
        $src = '/boot/config/plugins/ugreen-led-control/leds.cfg';
        $dst = '/boot/config/plugins/ugreen-nas-control/leds.cfg';
        if (!is_file($src)) { http_response_code(409); echo json_encode(['ok' => false, 'error' => 'No settings']); exit; }
        if (is_file($dst)) { copy($dst, $dst . '.bak'); }
        copy($src, $dst);
        echo json_encode(['ok' => true]); exit;
    }
    if ($a === 'fan_control') {
        if (($_POST['value'] ?? '') === 'off') { touch('/tmp/fanoff'); } else { @unlink('/tmp/fanoff'); }
        echo json_encode(['ok' => true]); exit;
    }
    if ($a === 'min') {
        $min = valid_min_pct($_POST['min_pct'] ?? null);
        if ($min === null) { http_response_code(400); echo json_encode(['ok' => false, 'error' => 'Invalid value for min_pct']); exit; }
        file_put_contents('/tmp/min_pct', (string) $min);
        if (isset($_POST['case_follows_cpu'])) { file_put_contents('/tmp/case_follows', $_POST['case_follows_cpu'] === '1' ? '1' : '0'); }
        echo json_encode(['ok' => true]); exit;
    }
    if ($a === 'led') {
        if (($_POST['value'] ?? '') === 'on') { touch($flag); } else { @unlink($flag); }
    }
    echo json_encode(['ok' => true]); exit;
}
if (($_GET['action'] ?? '') === 'hardware') {
    $bays = [
        ['bay'=>1,'present'=>true,'device'=>'sdc','model'=>'ST8000VN004','size_bytes'=>8e12,'hdd'=>true,'role'=>'disk1','id'=>'a','temp'=>36,'standby'=>false],
        ['bay'=>2,'present'=>true,'device'=>'sdd','model'=>'ST8000VN004','size_bytes'=>8e12,'hdd'=>true,'role'=>'disk2','id'=>'b','temp'=>47,'standby'=>false],
        ['bay'=>3,'present'=>true,'device'=>'sde','model'=>'ST8000VN004','size_bytes'=>8e12,'hdd'=>true,'role'=>'parity','id'=>'c','temp'=>null,'standby'=>true],
        ['bay'=>4,'present'=>false,'hdd'=>false],
        ['bay'=>5,'present'=>true,'device'=>'sda','model'=>'Samsung SSD 870 EVO 4TB','size_bytes'=>4e12,'hdd'=>false,'role'=>'cache','id'=>'d','temp'=>33,'standby'=>false],
        ['bay'=>6,'present'=>false,'hdd'=>false]];
    echo json_encode(['ok'=>true,'model'=>$model,'memory'=>[['locator'=>'D0','size_mb'=>32768,'type'=>'DDR5','speed_mt'=>5600,'configured_mt'=>4800,'manufacturer'=>'Micron','part_number'=>'CT32G56C46S5'],['locator'=>'D1','size_mb'=>32768,'type'=>'DDR5','speed_mt'=>5600,'configured_mt'=>4800,'manufacturer'=>'Micron','part_number'=>'CT32G56C46S5']],
      'nvme'=>[['id'=>'nvme3','model'=>'Samsung SSD 990 PRO 2TB','size_bytes'=>2e12,'slot'=>($family ? 'm2' : 'm2-1'),'pci'=>'x','temp'=>44,'role'=>'cache','boot'=>false],['id'=>'nvme1','model'=>'WD Red SN700 1000GB','size_bytes'=>1e12,'slot'=>($family ? 'm2' : 'system'),'pci'=>'y','temp'=>38,'role'=>'','boot'=>true]],
      'bays'=>$family ? ($model === 'DXP8800 Plus' ? array_merge($bays, [['bay'=>7,'present'=>false,'hdd'=>false],['bay'=>8,'present'=>false,'hdd'=>false]]) : (strpos($model, 'DXP2800') === 0 ? array_slice($bays, 0, 2) : (strpos($model, 'iDX6011') === 0 ? $bays : array_slice($bays, 0, 4)))) : ($known ? $bays : []),'net'=>strpos($model, 'DXP2800') === 0 ? [['name'=>'eth0','link'=>true,'speed_mbit'=>$model === 'DXP2800' ? 2500 : 10000,'max_mbit'=>$model === 'DXP2800' ? 2500 : 10000]] : ($family ? [['name'=>'eth0','link'=>true,'speed_mbit'=>2500,'max_mbit'=>2500],['name'=>'eth1','link'=>false,'speed_mbit'=>0,'max_mbit'=>10000]] : [['name'=>'eth0','link'=>true,'speed_mbit'=>10000,'max_mbit'=>10000],['name'=>'eth1','link'=>false,'speed_mbit'=>0,'max_mbit'=>10000]])]); exit;
}
$old = '/boot/config/plugins/ugreen-led-control/leds.cfg';
$imp = is_file($old) && @file_get_contents($old) !== @file_get_contents('/boot/config/plugins/ugreen-nas-control/leds.cfg');
echo json_encode(['ok'=>true,'running'=>true,'chip'=>'IT8613',
 'info'=>['model'=>$model,'bios'=>'1.0','bios_date'=>'01/01/2024','cpu'=>'12th Gen Intel(R) Core(TM) i5-1235U @ 2.50GHz','threads'=>12,'memory_kb'=>67108864,'kernel'=>'6.18.38-Unraid','unraid'=>'7.3.2','uptime'=>400000],
 'sensors'=>['cpu'=>54,'cpu_cores'=>[],'nvme'=>[['name'=>'nvme3','temp'=>44]],'gpu'=>51,'nvme_extra'=>[['name'=>'nvme1','label'=>'Sensor 1','temp'=>64],['name'=>'nvme1','label'=>'Sensor 2','temp'=>42]],'nic'=>[['iface'=>'eth0','label'=>'PHY','temp'=>66],['iface'=>'eth0','label'=>'MAC','temp'=>66],['iface'=>'eth1','label'=>'PHY','temp'=>64],['iface'=>'eth1','label'=>'MAC','temp'=>64]],'disks'=>[['name'=>'disk2','device'=>'sdd','temp'=>47,'standby'=>false,'hdd'=>true]],'board'=>30],
 'net_io'=>[['name'=>'eth0','rx'=>time()*40000000,'tx'=>time()*9000000],['name'=>'eth1','rx'=>time()*300000,'tx'=>time()*120000]],
 'presets'=>['quiet'=>['50:15,80:100','40:20,55:100'],'standard'=>['40:30,70:100','30:30,50:100'],'performance'=>['35:35,65:100','30:35,50:100']],
 'fans'=>is_file('/tmp/fanoff') ? [] : [['id'=>'fan2','role'=>'cpu','rpm'=>1500,'pct'=>40,'auto'=>false],['id'=>'fan3','role'=>'case','rpm'=>900,'pct'=>30,'auto'=>false],['id'=>'fan4','role'=>'case','rpm'=>880,'pct'=>30,'auto'=>false]],
 'calibration'=>['table'=>['time'=>1761555600,'fans'=>['fan2'=>[[10,700],[20,1300],[40,2100],[70,3200],[100,4100]],'fan3'=>[[10,190],[20,420],[40,820],[70,1300],[100,1680]]]],'progress'=>null],
 'chip_temps'=>[38],'daemon'=>['cpu_temp'=>54,'case_temp'=>47,'case_from'=>'disk','case_driver'=>'case','failsafe'=>'','stalled'=>[],'targets'=>['fan2'=>40,'fan3'=>30,'fan4'=>30]],
 'settings'=>['mode'=>'standard','min_pct'=>$minPct,'cpu_crit'=>90,'disk_crit'=>55,'nvme_offset'=>15,'stall_notify'=>true,'fan_control'=>!is_file('/tmp/fanoff'),'case_follows_cpu'=>@file_get_contents('/tmp/case_follows') === '1','ignore_drives'=>['cache'],'ui_lang'=>'auto'],
 'led'=>['enabled'=>is_file($flag),'supported'=>true,'blocker'=>'','untested'=>strpos($model,'iDX6011')===0,'warning'=>is_dir('/usr/local/emhttp/plugins/ugreen-led-control')?'standalone':'','import_available'=>$imp,'model'=>$model]]);
