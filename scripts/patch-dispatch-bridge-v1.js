#!/usr/bin/env node
const fs=require('fs');
const app='app.js';
let src=fs.readFileSync(app,'utf8');
const marker='MolinoDispatchBridge';
if(!src.includes(marker)){
  const at=src.lastIndexOf('\n})();');
  if(at<0)throw new Error('No se encontró cierre de app.js para el bridge de despachos.');
  const code='\nwindow.MolinoDispatchBridge={state,save:saveDispatchPlans,show:(view)=>show(view),formatWeight:dispatchFormatWeight,normalize:normalizeDispatchItem};\n';
  src=src.slice(0,at)+code+src.slice(at);
  fs.writeFileSync(app,src,'utf8');
}
console.log('DISPATCH BRIDGE V1: PASS');
