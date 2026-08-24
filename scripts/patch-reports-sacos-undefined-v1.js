const fs=require('fs');
const appPath='app.js';
let app=fs.readFileSync(appPath,'utf8');
const marker="const APP_VERSION='V49.5';";
const patch="// REPORTS SACOS/GRANEL UNDEFINED-REFERENCE GUARD V1\n// Some legacy report fragments resolve `sacos` as a global identifier.\n// Keep a harmless compatibility value so the Reports module cannot crash before rendering.\nif(typeof globalThis.sacos==='undefined') globalThis.sacos=[];\n";
if(!app.includes('REPORTS SACOS/GRANEL UNDEFINED-REFERENCE GUARD V1')){
  if(!app.includes(marker))throw new Error('[REPORTS SACOS/GRANEL GUARD V1] APP_VERSION marker not found');
  app=app.replace(marker,marker+'\n'+patch);
  fs.writeFileSync(appPath,app);
}
console.log('REPORTS SACOS/GRANEL UNDEFINED-REFERENCE GUARD V1: PATCHED');
