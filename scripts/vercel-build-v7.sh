#!/bin/sh
set -eu
sh scripts/vercel-build-v5.sh
node scripts/patch-report-maestro-rpc-local-v1.js
node scripts/patch-report-rpc-global-guard-v2.js
node --check public/reports-sacos-granel-professional-v1.js
node --check public/reports-maestro-v11.js
node --check public/report-rpc-boot-v2.js
node - <<'NODE'
const fs=require('fs');
const p=fs.readFileSync('public/reports-maestro-v11.js','utf8');
if(!p.includes('REPORT MAESTRO LOCAL AUTH V1')) throw new Error('Falta migración del renderer Maestro V11.');
if(!p.includes('molino_sacos_granel_report_local')) throw new Error('Falta RPC local en renderer Maestro V11.');
const dir='public';
const offenders=[];
for(const f of fs.readdirSync(dir)){
  if(!f.endsWith('.js')) continue;
  if(['report-rpc-compat-v1.js','report-rpc-boot-v2.js'].includes(f)) continue;
  const s=fs.readFileSync(dir+'/'+f,'utf8');
  if(/\.rpc\(['\"]molino_sacos_granel_report_v3['\"]/.test(s)) offenders.push(f);
}
if(offenders.length) throw new Error('Todavía existen llamadas directas al RPC V3 en: '+offenders.join(', '));
for(const pth of ['public/index.html','public/index-auto.html']){
 if(fs.existsSync(pth)){
  const s=fs.readFileSync(pth,'utf8');
  if(!s.includes('report-rpc-boot-v2.js?v=report-rpc-boot-v2')) throw new Error('Falta boot RPC V2 en '+pth);
 }
}
console.log('REPORT MAESTRO LEGACY RPC MIGRATION: PASS');
console.log('NO DIRECT REPORT V3 CALLS: PASS');
console.log('REPORT RPC BOOTSTRAP V2: PASS');
console.log('=== MOLINO CONTROL · BUILD V7 · REPORT PATHS CLOSED ===');
NODE
