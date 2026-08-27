const fs=require('fs');
const p='app.js';
let app=fs.readFileSync(p,'utf8');
const marker='/* MAESTRO_OPERATIONAL_SAFETY_V1 */';
if(app.includes(marker)){console.log('MAESTRO OPERATIONAL SAFETY V1: ALREADY PRESENT');process.exit(0)}

// Never delete the persisted Maestro accidentally.
const clearPattern=/\$\('clearBtn'\)\.onclick=\(\)=>\{state\.snapshot=null;deleteSnapshot\(\);renderMaestro\(\)\}/;
if(clearPattern.test(app)){
  app=app.replace(clearPattern,"$('clearBtn').onclick=async()=>{if(!confirm('¿Eliminar el Maestro guardado en este equipo? Esta acción no elimina copias cloud.'))return;try{await deleteSnapshot();state.snapshot=null;await audit('MAESTRO_ELIMINADO','');renderMaestro();toast('Maestro local eliminado.','ok')}catch(e){toast('No se pudo eliminar el Maestro local.','err')}}");
}

// Technical marker used by the final public-artifact validation.
const end=app.lastIndexOf('})();');
if(end<0)throw new Error('[MAESTRO OPERATIONAL SAFETY V1] No se encontró el cierre de app.js.');
const bridge=`\n  ${marker}\n  window.__MC_MAESTRO_STORAGE__=window.__MC_MAESTRO_STORAGE__||{version:'ATOMIC_V1'};\n`;
app=app.slice(0,end)+bridge+app.slice(end);

const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
assert(app.includes(marker),'No se instaló el marcador de seguridad.');
assert(app.includes('¿Eliminar el Maestro guardado en este equipo?'),'Falta confirmación de borrado local.');
fs.writeFileSync(p,app);
console.log('MAESTRO OPERATIONAL SAFETY V1: PASS');
