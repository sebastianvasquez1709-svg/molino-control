const fs=require('fs');
const p='app.js';
let app=fs.readFileSync(p,'utf8');
const marker='/* REMOVE_LEGACY_CREDENTIALS_V1 */';
if(app.includes(marker)){console.log('REMOVE LEGACY CREDENTIALS V1: ALREADY PRESENT');process.exit(0)}
const exact=/const ADMIN_RUT='[^']*',ACCESS_KEY='[^']*',DB='[^']*';/;
if(!exact.test(app))throw new Error('[REMOVE LEGACY CREDENTIALS V1] No se encontró la declaración legacy esperada.');
app=app.replace(exact,"const DB='molino-control-data';");
if(/\bADMIN_RUT\b/.test(app)||/\bACCESS_KEY\b/.test(app))throw new Error('[REMOVE LEGACY CREDENTIALS V1] Quedaron referencias activas a credenciales legacy.');
const end=app.lastIndexOf('})();');
if(end<0)throw new Error('[REMOVE LEGACY CREDENTIALS V1] No se encontró el cierre de app.js.');
app=app.slice(0,end)+`\n  ${marker}\n`+app.slice(end);
fs.writeFileSync(p,app);
console.log('REMOVE LEGACY CREDENTIALS V1: PASS');
