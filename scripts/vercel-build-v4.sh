#!/bin/sh
set -eu
sh scripts/vercel-build-v3.sh
node scripts/patch-clients-state-bridge-v1.js
node --check public/clients-enhanced-v1.js
node - <<'NODE'
const fs=require('fs');
const p=fs.readFileSync('public/clients-enhanced-v1.js','utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
assert(p.includes('CLIENTS APP STATE BRIDGE V1'),'Falta el puente de estado del módulo Clientes.');
assert(p.includes('const getAppState='),'Clientes no tiene getter de estado seguro.');
assert(p.includes('const state=new Proxy'),'Clientes sigue dependiendo de una variable global state.');
console.log('CLIENTS APP STATE BRIDGE CHECK: PASS');
console.log('CLIENTS NO-GLOBAL-STATE CHECK: PASS');
console.log('=== MOLINO CONTROL · BUILD V23 · CLIENTS STATE SCOPE FIX ===');
NODE
