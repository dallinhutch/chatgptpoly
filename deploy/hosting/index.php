<?php
declare(strict_types=1);
// The public directory contains this proxy and rewrite rules only. App and secrets stay outside it.
$base='/home/u152823332/apps/polylab';
if (!in_array($_SERVER['REQUEST_METHOD'], ['GET','HEAD','POST'], true)) { http_response_code(405); exit; }
if (($_SERVER['HTTPS'] ?? '') !== 'on') { header('Location: https://paycheckadvisor.com'.($_SERVER['REQUEST_URI'] ?? '/'), true, 308); exit; }
if (!in_array(strtolower($_SERVER['HTTP_HOST'] ?? ''), ['paycheckadvisor.com','www.paycheckadvisor.com'], true)) { http_response_code(400); exit; }
if (strtolower($_SERVER['HTTP_HOST']) === 'www.paycheckadvisor.com') { header('Location: https://paycheckadvisor.com'.$_SERVER['REQUEST_URI'], true, 308); exit; }
$uri=$_SERVER['REQUEST_URI'] ?? '/';
if (strlen($uri)>8192 || str_contains($uri,"\r") || str_contains($uri,"\n") || !str_starts_with($uri,'/')) { http_response_code(400); exit; }
$body=file_get_contents('php://input', false, null, 0, 1048577);
if (strlen($body)>1048576) { http_response_code(413); exit; }
$headers=['Host: paycheckadvisor.com','X-Forwarded-Proto: https','X-Forwarded-Host: paycheckadvisor.com'];
foreach (['HTTP_COOKIE'=>'Cookie','HTTP_ORIGIN'=>'Origin','CONTENT_TYPE'=>'Content-Type','HTTP_ACCEPT'=>'Accept','HTTP_RSC'=>'RSC','HTTP_NEXT_ROUTER_STATE_TREE'=>'Next-Router-State-Tree','HTTP_NEXT_URL'=>'Next-Url'] as $key=>$name) {
  if(isset($_SERVER[$key]) && !preg_match('/[\r\n]/',$_SERVER[$key])) $headers[]=$name.': '.$_SERVER[$key];
}
$ch=curl_init('http://127.0.0.1:31823'.$uri);
curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>45,CURLOPT_CUSTOMREQUEST=>$_SERVER['REQUEST_METHOD'],CURLOPT_HTTPHEADER=>$headers,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_HEADER=>true]);
if($_SERVER['REQUEST_METHOD']==='POST')curl_setopt($ch,CURLOPT_POSTFIELDS,$body);
$response=curl_exec($ch);
if($response===false){
  // A fixed command, with a lock, can restart the user-owned service after a hosting restart.
  if(function_exists('proc_open')) {
    $command='nohup /usr/bin/flock -n /home/u152823332/apps/polylab/supervisor.lock /opt/alt/alt-nodejs24/root/usr/bin/node --env-file=/home/u152823332/apps/polylab/production.env /home/u152823332/apps/polylab/hosting/supervisor.mjs >> /home/u152823332/apps/polylab/logs/supervisor.log 2>&1 < /dev/null &';
    $process=proc_open(['/bin/sh','-c',$command],[0=>['file','/dev/null','r'],1=>['file',$base.'/logs/proxy-start.log','a'],2=>['file',$base.'/logs/proxy-start.log','a']],$pipes);
    if(is_resource($process))proc_close($process);
  }
  http_response_code(503);header('Retry-After: 10');header('Content-Type: text/html; charset=UTF-8');echo '<!doctype html><title>PolyLab</title><h1>PolyLab is starting</h1><p>Please refresh in a few seconds.</p>';exit;
}
$size=curl_getinfo($ch,CURLINFO_HEADER_SIZE);$status=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);http_response_code($status);
foreach(explode("\r\n",substr($response,0,$size)) as $line){if(str_contains($line,':')){$name=strtolower(strtok($line,':'));if(!in_array($name,['connection','transfer-encoding','content-length','keep-alive'],true))header($line,false);}}
echo substr($response,$size);
