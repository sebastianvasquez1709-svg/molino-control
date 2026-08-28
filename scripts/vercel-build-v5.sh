#!/bin/sh
set -eu
sh scripts/vercel-build-v4.sh
node scripts/patch-report-local-auth-v1.js
node --check public/reports-sacos-granel-professional-v1.js
node - <<'NODE'
const fs=require('fs');
const p=fs.readFileSync('public/reports-sacos-granel-professional-v1.js','utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
assert(p.includes('REPORT LOCAL AUTH V1'),'Falta la corrección de autenticación local del informe Sacos/Granel.');
assert(p.includes('molino_sacos_granel_report_local'),'El informe sigue llamando al RPC protegido directamente.');
assert(p.includes('const rut=session?._identifier,pin=session?._password'),'El informe no reutiliza la sesión local existente.');
assert(!p.includes("sb.rpc('molino_sacos_granel_report_v3',args)"),'Persistió la llamada directa al RPC protegido.');
console.log('SACOS/GRANEL LOCAL AUTH CHECK: PASS');
console.log('SACOS/GRANEL PROTECTED RPC DIRECT CALL REMOVED: PASS');
console.log('SACOS/GRANEL SESSION REUSE CHECK: PASS');
console.log('=== MOLINO CONTROL · BUILD V24 · LOCAL SESSION REPORT AUTH ===');
NODE
