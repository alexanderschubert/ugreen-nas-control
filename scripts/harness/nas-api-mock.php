<?php
// The NAS Control API of the fake Unraid: fixed data (DXP6800 Pro); only the LED switch is real.
header('Content-Type: application/json');
$flag = '/boot/config/plugins/ugreen-nas-control/led.enabled';
$m = $_SERVER['REQUEST_METHOD'];
if ($m === 'POST') {
    $a = $_POST['action'] ?? '';
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
    echo json_encode(['ok'=>true,'model'=>'DXP6800 Pro','memory'=>[['locator'=>'D0','size_mb'=>32768,'type'=>'DDR5','speed_mt'=>5600,'configured_mt'=>4800,'manufacturer'=>'Micron','part_number'=>'CT32G56C46S5'],['locator'=>'D1','size_mb'=>32768,'type'=>'DDR5','speed_mt'=>5600,'configured_mt'=>4800,'manufacturer'=>'Micron','part_number'=>'CT32G56C46S5']],
      'nvme'=>[['id'=>'nvme3','model'=>'Samsung SSD 990 PRO 2TB','size_bytes'=>2e12,'slot'=>'m2-1','pci'=>'x','temp'=>44,'role'=>'cache','boot'=>false],['id'=>'nvme1','model'=>'WD Red SN700 1000GB','size_bytes'=>1e12,'slot'=>'system','pci'=>'y','temp'=>38,'role'=>'','boot'=>true]],
      'bays'=>$bays,'net'=>[['name'=>'eth0','link'=>true,'speed_mbit'=>10000],['name'=>'eth1','link'=>false,'speed_mbit'=>0]]]); exit;
}
echo json_encode(['ok'=>true,'running'=>true,'chip'=>'IT8613',
 'info'=>['model'=>'DXP6800 Pro','bios'=>'1.0','bios_date'=>'01/01/2024','cpu'=>'12th Gen Intel(R) Core(TM) i5-1235U @ 2.50GHz','threads'=>12,'memory_kb'=>67108864,'kernel'=>'6.18.38-Unraid','unraid'=>'7.3.2','uptime'=>400000],
 'sensors'=>['cpu'=>54,'cpu_cores'=>[],'nvme'=>[],'disks'=>[['name'=>'disk2','device'=>'sdd','temp'=>47,'standby'=>false,'hdd'=>true]],'board'=>30],
 'presets'=>['standard'=>['40:30,70:100','30:30,50:100']],
 'fans'=>[['id'=>'fan2','role'=>'cpu','rpm'=>1500,'pct'=>40,'auto'=>false],['id'=>'fan3','role'=>'case','rpm'=>900,'pct'=>30,'auto'=>false],['id'=>'fan4','role'=>'case','rpm'=>880,'pct'=>30,'auto'=>false]],
 'chip_temps'=>[38],'daemon'=>['cpu_temp'=>54,'case_temp'=>47,'case_from'=>'disk'],
 'settings'=>['mode'=>'standard','min_pct'=>25,'cpu_crit'=>90,'disk_crit'=>55,'nvme_offset'=>15,'stall_notify'=>true,'ui_lang'=>'auto'],
 'led'=>['enabled'=>is_file($flag),'supported'=>true,'blocker'=>'','warning'=>is_dir('/usr/local/emhttp/plugins/ugreen-led-control')?'standalone':'','model'=>'DXP6800 Pro']]);
