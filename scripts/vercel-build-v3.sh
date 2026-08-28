#!/bin/sh
set -eu
node scripts/patch-worker-index-v1.js
node scripts/patch-maestro-storage-hardening-v1.js
node scripts/patch-remove-legacy-credentials-v1.js
node scripts/patch-maestro-operational-safety-v1.js
node scripts/patch-live-ine-loader-v1.js
sh scripts/vercel-build-v2.sh
node scripts/test-maestro-storage-contract-v1.js
node scripts/patch-public-existence-master-ine-v2.js
node scripts/patch-public-existence-master-ine-v3.js
node scripts/patch-public-existence-master-ine-v4.js
node scripts/patch-existence-display-sync-v1.js
node scripts/patch-existence-live-sync-v3.js
node scripts/patch-existence-live-sync-v4.js
node scripts/patch-private-live-refresh-v1.js
node scripts/patch-private-existence-reactive-reengine-v1.js
node scripts/patch-private-existence-reactive-reengine-v2.js
node --check public/app.js
node --check public/molino-cloud.js
node - <<'NODE'
const fs=require('fs');
const p=fs.readFileSync('public/app.js','utf8');
const c=fs.readFileSync('public/molino-cloud.js','utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
assert(p.includes('MAESTRO_STORAGE_HARDENING_V1'),'MAESTRO hardening no llegó al artefacto público.');
assert(p.includes('REMOVE_LEGACY_CREDENTIALS_V1'),'La limpieza de credenciales legacy no llegó al artefacto público.');
assert(p.includes('MAESTRO_OPERATIONAL_SAFETY_V1'),'Protecciones operativas no llegaron al artefacto público.');
assert(p.includes('ROOT_SNAPSHOT_STORAGE_V1'),'Falta almacenamiento raíz del Maestro.');
assert(p.includes('MC_PRIVATE_LIVE_REFRESH_V1'),'Falta refresco en vivo del módulo privado.');
assert(p.includes('PRIVATE EXISTENCE REACTIVE REENGINEERING V1'),'Falta la reingeniería reactiva de Indicadores/Existencia.');
assert(p.includes('PRIVATE EXISTENCE REACTIVE REENGINEERING V2'),'Falta el cierre de scope de la reingeniería reactiva.');
assert(p.includes('const existenceRows=Array.isArray(state.existenceRecords)'),'Indicadores privados no usa la fuente canónica de Existencia.');
assert(p.includes('if(m?.displayIne?.items?.length)'),'El indicador no prioriza el INE sincronizado del registro.');
assert(p.includes('molino:data-change'),'Falta el bus de invalidación reactiva.');
assert(p.includes('window.__refreshPrivateExistenceModules'),'Falta hook determinista de refresco.');
assert(p.includes('b.addEventListener(\'click\',()=>window.show(b.dataset.view))'),'La navegación no pasa por el refresco reactivo.');
assert(p.includes('OFFICIAL_INE_CACHE.delete(key)'),'El caché INE no se invalida al cambiar Existencia.');
assert(p.includes('months.find(x=>String(x.key)===String(state.ineSelected))||existenceSelected'),'El selector de mes no tiene prioridad explícita.');
assert(p.includes('function existenceUnifiedDisplayModel(m){'),'Falta modelo canónico de visualización Existencia.');
assert(p.includes('function renderExistencias(){'),'Falta renderizador de Existencia.');
assert(p.includes('Imprimir este informe'),'Falta acción de impresión del informe de Existencia.');
assert(p.includes('displayIneFetchedAt'),'Falta marca de sincronización INE en vivo.');
assert(p.includes('state.existenceSelected=last.key'),'El upload no selecciona el último registro cargado.');
assert(p.includes('const official=await resolveOfficialInePeriod(last.key)'),'El upload no solicita INE del mismo período.');
assert(p.includes('REGISTRO DE EXISTENCIA · INE'),'Falta impresión completa Registro+INE.');
assert(p.includes('EXISTENCE LIVE SYNC V4'),'Falta la corrección final de persistencia/refresco de Existencia.');
assert(p.includes("e.target.value='';"),'Falta habilitar la recarga del mismo archivo.');
assert(p.includes('await persistExistenceRecords(state.existenceRecords);'),'Falta persistencia del INE sincronizado.');
assert(!/\bADMIN_RUT\b/.test(p),'Persisten identificadores ADMIN_RUT en el bundle público.');
assert(!/\bACCESS_KEY\b/.test(p),'Persisten identificadores ACCESS_KEY en el bundle público.');
assert(c.includes('molino_ine_sales_periods'),'Falta carga del índice de períodos INE.');
assert(c.includes('molino_ine_sales_exact'),'Falta carga del INE exacto.');
assert(c.includes('snap.masterIneByPeriod'),'El snapshot público no expone masterIneByPeriod.');
console.log('PUBLIC MAESTRO HARDENING CHECK: PASS');
console.log('PUBLIC MAESTRO OPERATIONAL SAFETY CHECK: PASS');
console.log('NO LEGACY PUBLIC CREDENTIALS CHECK: PASS');
console.log('LIVE EXACT INE HYDRATION CHECK: PASS');
console.log('PRIVATE LIVE REFRESH CHECK: PASS');
console.log('PRIVATE/EXISTENCE REACTIVE REENGINEERING V1 CHECK: PASS');
console.log('PRIVATE/EXISTENCE REACTIVE REENGINEERING V2 CHECK: PASS');
console.log('EXISTENCE DISPLAY/PRINT SYNC CHECK: PASS');
console.log('EXISTENCE LIVE SYNC V3 CHECK: PASS');
console.log('EXISTENCE LIVE SYNC V4 CHECK: PASS');
NODE
echo '=== MOLINO CONTROL · BUILD V21 · PRIVATE/EXISTENCE REACTIVE SCOPE + CACHE FIX ==='
