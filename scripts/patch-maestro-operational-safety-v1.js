const fs=require('fs');
const p='app.js';
let app=fs.readFileSync(p,'utf8');
const marker='/* MAESTRO_OPERATIONAL_SAFETY_V1 */';
if(app.includes(marker)){console.log('MAESTRO OPERATIONAL SAFETY V1: ALREADY PRESENT');process.exit(0)}

// 1) Nunca borra el Maestro persistido por accidente.
const clearPattern=/\$\('clearBtn'\)\.onclick=\(\)=>\{state\.snapshot=null;deleteSnapshot\(\);renderMaestro\(\)\}/;
if(clearPattern.test(app)){
  app=app.replace(clearPattern,"$('clearBtn').onclick=async()=>{if(!confirm('¿Eliminar el Maestro guardado en este equipo? Esta acción no elimina copias cloud.'))return;try{await deleteSnapshot();state.snapshot=null;await audit('MAESTRO_ELIMINADO','');renderMaestro();toast('Maestro local eliminado.','ok')}catch(e){toast('No se pudo eliminar el Maestro local.','err')}}");
}

// 2) La hidratación cloud nunca debe leer y volver a escribir los mismos despachos.
const oldDispatch=/state\.dispatchPlan=dispatches\.map\(normalizeDispatchItem\)\s*;\s*saveDispatchPlans\(\)/;
if(oldDispatch.test(app)){
  app=app.replace(oldDispatch,"state.dispatchPlan=dispatches.map(normalizeDispatchItem);try{localStorage.setItem('molino_dispatch_plan_v1',JSON.stringify(state.dispatchPlan))}catch{}");
}

// 3) Marca técnica para detectar que las protecciones llegaron al bundle.
const end=app.lastIndexOf('})();');
if(end<0)throw new Error('[MAESTRO OPERATIONAL SAFETY V1] No se encontró el cierre de app.js.');
const bridge=`\n  ${marker}\n  window.__MC_MAESTRO_STORAGE__={version:'ATOMIC_V1',hasSnapshot:()=>!!state.snapshot,fileName:()=>state.snapshot?.fileName||'',clearLocal:async()=>{await deleteSnapshot();state.snapshot=null;return true}};\n`;
app=app.slice(0,end)+bridge+app.slice(end);

const hydrateStart=app.indexOf('async function hydrateCloudData');
const hydrateEnd=hydrateStart>=0?app.indexOf('\n}',hydrateStart):-1;
const hydrateBody=hydrateStart>=0&&hydrateEnd>hydrateStart?app.slice(hydrateStart,hydrateEnd):'';
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
assert(app.includes(marker),'No se instaló el marcador de seguridad.');
assert(app.includes('¿Eliminar el Maestro guardado en este equipo?'),'Falta confirmación de borrado local.');
assert(app.includes("localStorage.setItem('molino_dispatch_plan_v1',JSON.stringify(state.dispatchPlan))"),'Falta persistencia local de despachos hidratados.');
assert(!hydrateBody.includes('saveDispatchPlans('),'La hidratación cloud todavía intenta guardar despachos.');
assert(app.includes("storageVersion:'ATOMIC_V1'"),'No está activo el contrato de almacenamiento atómico.');
fs.writeFileSync(p,app);
console.log('MAESTRO OPERATIONAL SAFETY V1: PASS');
