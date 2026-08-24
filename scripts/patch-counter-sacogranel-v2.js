const fs=require('fs');
const path=require('path');
const appPath='app.js';
const workerPath='excel-worker.js';
const workerFrag=fs.readFileSync(path.join(__dirname,'counter-worker-frag.js'),'utf8').trim();
const appFrag=fs.readFileSync(path.join(__dirname,'counter-sacogranel.jsfrag'),'utf8').trim();
function fail(msg){throw new Error('[COUNTER SACOS/GRANEL V2] '+msg)}
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}
let worker=read(workerPath);
if(!worker.includes('// COUNTER SACOS GRANEL V1')){
  const keepCurrent=/const baseKeep=new Set\(\[[^\]]+\]\);/;
  if(!keepCurrent.test(worker))fail('No se encontró baseKeep en excel-worker.js');
  worker=worker.replace(keepCurrent,m=>{
    const nums=(m.match(/\d+/g)||[]).map(Number);
    [31,32,33].forEach(x=>{if(!nums.includes(x))nums.push(x)});
    nums.sort((a,b)=>a-b);
    return 'const baseKeep=new Set(['+nums.join(',')+']);';
  });
  const anchor='const productSet = new Set();';
  if(!worker.includes(anchor))fail('No se encontró ancla productSet.');
  worker=worker.replace(anchor,anchor+'\n'+workerFrag+'\n');
  const snap='metrics: { ine, sacos: { ventasSacos, kgSacos, items: sacItems }, granel: { totalGranel, items: granelItems }, iva: iv },';
  if(!worker.includes(snap))fail('No se encontró objeto metrics del snapshot.');
  worker=worker.replace(snap,'metrics: { ine, sacos: { ventasSacos, kgSacos, items: sacItems }, granel: { totalGranel, items: granelItems }, counter, iva: iv },');
  write(workerPath,worker);
}
let app=read(appPath);
if(!app.includes('function renderSacosGranel(){')){
  const anchor='function renderDocuments(){';
  if(!app.includes(anchor))fail('No se encontró ancla renderDocuments.');
  app=app.replace(anchor,appFrag+'\n'+anchor);
}
if(!app.includes("['counter','📦 Sacos / Granel']")){
  const old="['dashboard','📊 Panel Macro'],['maestro','📥 Maestro Excel'],['private','📈 Indicadores privados'],['existencias','📦 Registros de existencia']";
  if(!app.includes(old))fail('No se encontró grupo CONTROL.');
  app=app.replace(old,old+",['counter','📦 Sacos / Granel']");
}
if(!app.includes("counter:'Contador de sacos y graneles'"))app=app.replace("existencias:'Registros de existencia'","existencias:'Registros de existencia',counter:'Contador de sacos y graneles'");
if(!app.includes('counter:renderSacosGranel')){
  const oldMap='existencias:renderExistencias,documents:renderDocuments';
  if(!app.includes(oldMap))fail('No se encontró mapa de renderizadores.');
  app=app.replace(oldMap,'existencias:renderExistencias,counter:renderSacosGranel,documents:renderDocuments');
}
write(appPath,app);
console.log('COUNTER SACOS/GRANEL V2: PATCHED');
