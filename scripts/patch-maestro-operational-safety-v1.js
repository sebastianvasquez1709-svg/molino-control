const fs=require('fs');
const p='app.js';
let app=fs.readFileSync(p,'utf8');
const marker='/* MAESTRO_OPERATIONAL_SAFETY_V1 */';
if(app.includes(marker)){console.log('MAESTRO OPERATIONAL SAFETY V1: ALREADY PRESENT');process.exit(0)}

// 1) Nunca borra el Maestro persistido por accidente.
const clearOld="$('clearBtn').onclick=()=>{state.snapshot=null;deleteSnapshot();renderMaestro()}";
const clearNew="$('clearBtn').onclick=async()=>{if(!confirm('¿Eliminar el Maestro guardado en este equipo? Esta acción no elimina copias cloud.'))return;try{await deleteSnapshot();state.snapshot=null;await audit('MAESTRO_ELIMINADO','');renderMaestro();toast('Maestro local eliminado.','ok')}catch(e){toast('No se pudo eliminar el Maestro local.','err')}}";
if(app.includes(clearOld)) app=app.replace(clearOld,clearNew);

// 2) La hidratación cloud nunca debe leer y volver a escribir los mismos despachos.
const hydrateOld="if(Array.isArray(dispatches)){state.dispatchPlan=dispatches.map(normalizeDispatchItem);saveDispatchPlans()}";
const hydrateNew="if(Array.isArray(dispatches)){state.dispatchPlan=dispatches.map(normalizeDispatchItem);try{localStorage.setItem('molino_dispatch_plan_v1',JSON.stringify(state.dispatchPlan))}catch{}}";
if(app.includes(hydrateOld)) app=app.replace(hydrateOld,hydrateNew);

// 3) Marca técnica para detectar que las protecciones llegaron al bundle.
const end=app.lastIndexOf('})();');
if(end<0) throw new Error('[MAESTRO OPERATIONAL SAFETY V1] No se encontró el cierre de app.js.');
const bridge=`\n  ${marker}\n  window.__MC_MAESTRO_STORAGE__={\n    version:'ATOMIC_V1',\n    hasSnapshot:()=>!!state.snapshot,\n    fileName:()=>state.snapshot?.fileName||'',\n    clearLocal:async()=>{await deleteSnapshot();state.snapshot=null;return true}\n  };\n`;
app=app.slice(0,end)+bridge+app.slice(end);

const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
assert(app.includes(marker),'No se instaló el marcador de seguridad.');
assert(app.includes('¿Eliminar el Maestro guardado en este equipo?'),'Falta confirmación de borrado local.');
assert(!app.includes("state.dispatchPlan=dispatches.map(normalizeDispatchItem);saveDispatchPlans()"),'Quedó escritura cloud durante hidratación.');
assert(app.includes("localStorage.setItem('molino_dispatch_plan_v1',JSON.stringify(state.dispatchPlan))"),'Falta persistencia local de despachos hidratados.');
assert(app.includes("storageVersion:'ATOMIC_V1'"),'No está activo el contrato de almacenamiento atómico.');
fs.writeFileSync(p,app);
console.log('MAESTRO OPERATIONAL SAFETY V1: PASS');
