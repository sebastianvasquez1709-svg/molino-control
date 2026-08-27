const fs=require('fs');
const target=process.argv[2]||'public/app.js';
const app=fs.readFileSync(target,'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error('[MAESTRO STORAGE CONTRACT V1] '+msg)};
const count=(re)=>[...app.matchAll(re)].length;

assert(app.includes('/* ROOT_SNAPSHOT_STORAGE_V1 */'),`Falta readSnapshotLocal raíz en ${target}.`);
assert(app.includes('/* MAESTRO_STORAGE_HARDENING_V1 */'),'Falta hardening del almacenamiento.');
assert(app.includes("storageVersion:'ATOMIC_V1'"),'Falta contrato ATOMIC_V1.');
assert(/async function readSnapshotLocal\s*\(/.test(app),'readSnapshotLocal no está definido.');
assert(/async function saveSnapshot\s*\(/.test(app),'saveSnapshot no está definido.');
assert(/async function loadExcel\s*\(/.test(app),'loadExcel no está definido.');
assert(app.includes("db.transaction([STORE_META,STORE_PARTS],'readwrite')"),'saveSnapshot no usa transacción conjunta Meta+Parts.');
assert(app.includes("const local=await readSnapshotLocal();"),'readSnapshot no intenta primero almacenamiento local.');
assert(app.includes('await processBuffer(file,{})'),'loadExcel dejó de usar el Worker existente.');
assert(app.includes('await saveSnapshot(snap);'),'loadExcel dejó de persistir el Maestro.');
assert(app.includes('const check=await readSnapshotLocal();'),'loadExcel dejó de verificar el guardado.');
assert(app.includes('const previous=state.snapshot;'),'loadExcel no conserva el Maestro previo.');
assert(app.includes('state.snapshot=previous;'),'loadExcel no restaura el Maestro previo ante fallo.');
assert(app.includes('El Maestro que estaba activo no fue sustituido'),'Falta mensaje de protección del Maestro previo.');
assert(app.includes('¿Eliminar el Maestro guardado en este equipo?'),'El borrado local no tiene confirmación.');
assert(!/\bADMIN_RUT\b/.test(app),'Persistió ADMIN_RUT en el artefacto público.');
assert(!/\bACCESS_KEY\b/.test(app),'Persistió ACCESS_KEY en el artefacto público.');
const hydrateStart=app.indexOf('async function hydrateCloudData');
if(hydrateStart>=0){
  const hydrateEnd=app.indexOf('\n}',hydrateStart);
  const hydrate=hydrateEnd>hydrateStart?app.slice(hydrateStart,hydrateEnd):'';
  assert(!hydrate.includes('saveDispatchPlans('),'hydrateCloudData volvió a introducir writeback de despachos.');
  assert(hydrate.includes('localStorage.setItem(\'molino_dispatch_plan_v1\''),'hydrateCloudData no refresca cache local de despachos.');
}
assert(count(/MAESTRO_STORAGE_HARDENING_V1/g)===1,'Marcador MAESTRO_STORAGE_HARDENING_V1 duplicado.');
assert(count(/ROOT_SNAPSHOT_STORAGE_V1/g)===1,'Marcador ROOT_SNAPSHOT_STORAGE_V1 duplicado.');
console.log(`MAESTRO STORAGE CONTRACT V1: PASS (${target})`);
console.log('ATOMIC SAVE + LOCAL READBACK: PASS');
console.log('PREVIOUS MAESTRO PROTECTION: PASS');
console.log('NO LEGACY BROWSER CREDENTIALS: PASS');
console.log('CLOUD HYDRATION READ-ONLY: PASS');
