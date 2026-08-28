#!/bin/sh
set -eu
sh scripts/vercel-build-v5.sh
node scripts/patch-report-maestro-rpc-local-v1.js
node scripts/patch-report-rpc-global-guard-v2.js
node scripts/patch-report-script-cachebust-v1.js
node --check public/reports-sacos-granel-professional-v1.js
node --check public/reports-maestro-v11.js
node --check public/report-rpc-boot-v2.js
node - <<'NODE'
const fs=require('fs');
const offenders=[];
for(const f of fs.readdirSync('public')){
  if(!f.endsWith('.js')) continue;
  if(['report-rpc-compat-v1.js','report-rpc-boot-v2.js'].includes(f)) continue;
  const s=fs.readFileSync('public/'+f,'utf8');
  if(/\.rpc\(['\"]molino_sacos_granel_report_v3['\"]/.test(s)) offenders.push(f);
}
if(offenders.length) throw new Error('RPC V3 directo sigue presente en: '+offenders.join(', '));
const index=fs.readFileSync('public/index.html','utf8');
if(!index.includes('report-rpc-boot-v2.js?v=report-rpc-boot-v2')) throw new Error('Falta RPC boot V2 en public/index.html');
if(!index.includes('reports-maestro-v11.js?v=report-local-auth-v2')) throw new Error('Falta cache bust Maestro V11 en public/index.html');
if(!index.includes('reports-sacos-granel-professional-v1.js?v=report-local-auth-v2')) throw new Error('Falta cache bust reporte profesional en public/index.html');
if(!fs.readFileSync('public/index-auto.html','utf8').includes('report-rpc-boot-v2.js?v=report-rpc-boot-v2')) throw new Error('Falta RPC boot V2 en public/index-auto.html');
console.log('REPORT MAESTRO LEGACY RPC REMOVED: PASS');
console.log('NO DIRECT REPORT V3 CALLS: PASS');
console.log('REPORT RPC BOOTSTRAP V2: PASS');
console.log('REPORT CACHEBUST V2: PASS');
console.log('=== MOLINO CONTROL · BUILD V9 · REPORT EXECUTION PATH SEALED ===');
NODE
