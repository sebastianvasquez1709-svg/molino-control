#!/bin/sh
set -eu
sh scripts/vercel-build-v5.sh
node scripts/patch-report-rpc-global-guard-v2.js
node --check public/report-rpc-boot-v2.js
node - <<'NODE'
const fs=require('fs');
for(const p of ['public/index.html','public/index-auto.html']){
  if(!fs.existsSync(p)) continue;
  const s=fs.readFileSync(p,'utf8');
  if(!s.includes('report-rpc-boot-v2.js?v=report-rpc-boot-v2')) throw new Error('Falta bootstrap RPC V2 en '+p);
}
console.log('REPORT RPC BOOT V2 CHECK: PASS');
NODE
node - <<'NODE'
const fs=require('fs');
const dir='public';
const banned=new RegExp("sb\\.rpc\\(['\\\"]molino_sacos_granel_report_v3['\\\"]");
const offenders=[];
for(const f of fs.readdirSync(dir)){
  if(!f.endsWith('.js')) continue;
  const p=dir+'/'+f;
  const s=fs.readFileSync(p,'utf8');
  if(f==='report-rpc-compat-v1.js'||f==='report-rpc-boot-v2.js') continue;
  if(banned.test(s)) offenders.push(f);
}
if(offenders.length) throw new Error('RPC V3 directo sigue presente en: '+offenders.join(', '));
console.log('NO DIRECT REPORT V3 CALLS IN PUBLIC JS: PASS');
NODE
echo '=== MOLINO CONTROL · BUILD V6 · REPORT RPC BOOTSTRAP HARDENING ==='
