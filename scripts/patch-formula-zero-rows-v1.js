const fs=require('fs');
const appPath='app.js';
let app=fs.readFileSync(appPath,'utf8');
const marker="const APP_VERSION='V49.5';";
const guard="// FORMULA_ZERO_ROWS_GUARD_V1\nif(typeof globalThis.formulaZeroRows==='undefined') globalThis.formulaZeroRows=[];\n";
if(!app.includes('FORMULA_ZERO_ROWS_GUARD_V1')){
  if(!app.includes(marker))throw new Error('APP_VERSION marker not found');
  app=app.replace(marker,marker+'\n'+guard);
  fs.writeFileSync(appPath,app);
}
console.log('FORMULA_ZERO_ROWS_GUARD_V1: PASS');
