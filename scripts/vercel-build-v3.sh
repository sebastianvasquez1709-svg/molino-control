#!/bin/sh
set -eu
node scripts/patch-worker-index-v1.js
node scripts/patch-maestro-storage-hardening-v1.js
node scripts/patch-remove-legacy-credentials-v1.js
node scripts/patch-maestro-operational-safety-v1.js
sh scripts/vercel-build-v2.sh
node scripts/patch-public-existence-master-ine-v2.js
node scripts/patch-public-existence-master-ine-v3.js
node scripts/patch-public-existence-master-ine-v4.js
node --check public/app.js
node - <<'NODE'
const fs=require('fs');
const p=fs.readFileSync('public/app.js','utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
assert(p.includes('MAESTRO_STORAGE_HARDENING_V1'),'MAESTRO hardening no llegó al artefacto público.');
assert(p.includes('REMOVE_LEGACY_CREDENTIALS_V1'),'La limpieza de credenciales legacy no llegó al artefacto público.');
assert(p.includes('MAESTRO_OPERATIONAL_SAFETY_V1'),'Protecciones operativas no llegaron al artefacto público.');
assert(p.includes('ROOT_SNAPSHOT_STORAGE_V1'),'Falta almacenamiento raíz del Maestro.');
assert(!/\bADMIN_RUT\b/.test(p),'Persisten identificadores ADMIN_RUT en el bundle público.');
assert(!/\bACCESS_KEY\b/.test(p),'Persisten identificadores ACCESS_KEY en el bundle público.');
assert(p.includes('El Maestro que estaba activo no fue sustituido'),'Falta protección del Maestro anterior ante fallo de carga.');
assert(p.includes('¿Eliminar el Maestro guardado en este equipo?'),'Falta confirmación para eliminar el Maestro.');
assert(!p.includes("state.dispatchPlan=dispatches.map(normalizeDispatchItem);saveDispatchPlans()"),'Quedó escritura cloud durante hidratación.');
console.log('PUBLIC MAESTRO HARDENING CHECK: PASS');
console.log('PUBLIC MAESTRO OPERATIONAL SAFETY CHECK: PASS');
console.log('NO LEGACY PUBLIC CREDENTIALS CHECK: PASS');
NODE
echo '=== MOLINO CONTROL · BUILD V8 · MAESTRO STORAGE + OPERATIONAL SAFETY ==='
