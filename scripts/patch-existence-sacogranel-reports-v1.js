const fs=require('fs');
const path=require('path');
const appPath='app.js';
const frag=fs.readFileSync(path.join(__dirname,'existence-sacogranel-reports-v1.jsfrag'),'utf8').trim();
let app=fs.readFileSync(appPath,'utf8');
function fail(msg){throw new Error('[EXISTENCE SACOS/GRANEL REPORTS V1] '+msg)}
if(!app.includes('function renderExistenceReports(){')){
  const anchor='function renderDocuments(){';
  if(!app.includes(anchor))fail('No se encontró ancla para insertar el módulo de informes.');
  app=app.replace(anchor,frag+'\n'+anchor);
}
if(!app.includes("['counterExistence','📊 Informes Sacos / Granel']")){
  const anchor="['counter','📦 Sacos / Granel']";
  if(!app.includes(anchor))fail('No se encontró navegación del contador.');
  app=app.replace(anchor,anchor+",['counterExistence','📊 Informes Sacos / Granel']");
}
if(!app.includes("counterExistence:'Informes sacos y graneles'")){
  const anchor="counter:'Contador de sacos y graneles'";
  if(!app.includes(anchor))fail('No se encontró título del contador.');
  app=app.replace(anchor,anchor+",counterExistence:'Informes sacos y graneles'");
}
if(!app.includes('counterExistence:renderExistenceReports')){
  const anchor='existencias:renderExistencias,counter:renderSacosGranel,documents:renderDocuments';
  if(!app.includes(anchor))fail('No se encontró mapa de renderizadores.');
  app=app.replace(anchor,'existencias:renderExistencias,counter:renderSacosGranel,counterExistence:renderExistenceReports,documents:renderDocuments');
}
fs.writeFileSync(appPath,app);
console.log('EXISTENCE SACOS/GRANEL REPORTS V1: PATCHED');
