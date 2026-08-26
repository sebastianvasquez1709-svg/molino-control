const fs=require('fs');
const p='app.js';
let app=fs.readFileSync(p,'utf8');
const marker='/* MC_APP_STATE_BRIDGE_V1 */';
if(app.includes(marker)){console.log('MACRO STATE BRIDGE V1: ALREADY PRESENT');process.exit(0);}
const idx=app.lastIndexOf('})();');
if(idx<0)throw new Error('No se encontró el cierre de app.js para instalar el bridge de estado.');
const bridge=`\n  ${marker}\n  // Puente de solo lectura: permite a módulos de presentación reutilizar el snapshot ya cargado por la app.\n  // No expone credenciales ni modifica state.\n  window.__MC_APP_STATE__=state;\n  window.__MC_APP_GET_STATE__=()=>state;\n`;
app=app.slice(0,idx)+bridge+app.slice(idx);
fs.writeFileSync(p,app);
console.log('MACRO STATE BRIDGE V1: PATCHED');
