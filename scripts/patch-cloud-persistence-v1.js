const fs=require('fs');
const appPath='app.js';
let app=fs.readFileSync(appPath,'utf8');
function fail(msg){throw new Error('[CLOUD PERSISTENCE V1] '+msg)}
const marker="const CONTACTS_DB='molino-client-contacts-v1';";
if(!app.includes(marker)) fail('No se encontró CONTACTS_DB');
const bridge=`
// V50.1 CLOUD PERSISTENCE: transitional cloud layer.
// Contacts/dispatch keep the pre-existing RPC path; Existencia is routed through
// MolinoCloudStateV2 because the current login is a local compatibility session,
// not a Supabase Auth session. This avoids silently losing monthly history.
async function cloudAdminSession(){try{return window.MolinoCloud?.getSession?await window.MolinoCloud.getSession():null}catch{return null}}
async function cloudRpc(name,args={}){const sb=await window.MolinoCloud.client();const {data,error}=await sb.rpc(name,args);if(error)throw error;return data}
async function cloudLoadContacts(){try{if(!await cloudAdminSession())return null;const rows=await cloudRpc('app_contacts_list');const book={};for(const row of (rows||[]))book[row.client_key]=row.payload||{};if(Object.keys(book).length)localStorage.setItem(CONTACTS_DB,JSON.stringify(book));return book}catch(e){console.warn('Cloud contacts unavailable',e);return null}}
async function cloudSaveContact(key,payload){try{if(!await cloudAdminSession())return;await cloudRpc('app_contacts_upsert',{p_key:key,p_payload:payload||{}})}catch(e){console.warn('Cloud contact save unavailable',e)}}
async function cloudLoadDispatches(){try{if(!await cloudAdminSession())return null;const rows=await cloudRpc('app_dispatch_list');return (rows||[]).map(r=>r.payload).filter(Boolean)}catch(e){console.warn('Cloud dispatches unavailable',e);return null}}
async function cloudReplaceDispatches(rows){try{if(!await cloudAdminSession())return;await cloudRpc('app_dispatch_replace',{p_rows:Array.isArray(rows)?rows:[]})}catch(e){console.warn('Cloud dispatch save unavailable',e)}}
async function cloudExistenceBridge(){
  try{
    if(window.MolinoCloudStateV2)return window.MolinoCloudStateV2;
    await import('/molino-cloud-state-v2.js');
    return window.MolinoCloudStateV2||null;
  }catch(e){console.warn('Durable existence bridge unavailable',e);return null}
}
async function cloudLoadExistence(){
  try{
    if(!await cloudAdminSession())return null;
    const b=await cloudExistenceBridge();
    if(!b)return null;
    return await b.listExistence();
  }catch(e){console.warn('Cloud existence unavailable',e);return null}
}
async function cloudReplaceExistence(rows){
  try{
    if(!await cloudAdminSession())return;
    const b=await cloudExistenceBridge();
    if(!b)return;
    const clean=(Array.isArray(rows)?rows:[]).filter(x=>x&&x.key);
    const desired=new Set(clean.map(x=>String(x.key)));
    const existing=await b.listExistence().catch(()=>[]);
    for(const row of clean)await b.upsertExistence(row);
    for(const row of existing)if(row?.key&&!desired.has(String(row.key)))await b.deleteExistence(row.key);
  }catch(e){console.warn('Cloud existence save unavailable',e)}
}
async function hydrateCloudData(){
  // Hydration is read-only: it may refresh local caches, but never writes the
  // cloud state back during application boot.
  const contacts=await cloudLoadContacts(); if(contacts) applyClientContacts();
  const dispatches=await cloudLoadDispatches(); if(Array.isArray(dispatches)){
    state.dispatchPlan=dispatches.map(normalizeDispatchItem);
    try{localStorage.setItem('molino_dispatch_plan_v1',JSON.stringify(state.dispatchPlan))}catch{}
  }
  const existence=await cloudLoadExistence(); if(Array.isArray(existence)&&existence.length){
    state.existenceRecords=existence;
    for(const row of existence){const base=normalizeExistenceBase(row);if(base)await persistExistenceBaseRecord(base)}
    state.existenceBaseRecords=await readExistenceBaseRecords()
  }
}
`;
if(!app.includes('CLOUD PERSISTENCE: transitional cloud layer')) app=app.replace(marker,marker+bridge);
app=app.replace(/const EMBEDDED_LOGO_DATA='data:image\/jpeg;base64,[^']+';/,"const EMBEDDED_LOGO_DATA='/logo molino.jpg';");
const saveContactOld="function saveContactForClient(c,data){if(!c)return;const book=loadClientContacts();book[contactKey(c)]={...clientContact(c),...data};saveClientContacts(book);applyClientContacts()}";
const saveContactNew="function saveContactForClient(c,data){if(!c)return;const key=contactKey(c),book=loadClientContacts();const payload={...clientContact(c),...data};book[key]=payload;saveClientContacts(book);applyClientContacts();cloudSaveContact(key,payload)}";
if(app.includes(saveContactOld)) app=app.replace(saveContactOld,saveContactNew); else fail('No se encontró saveContactForClient');
const saveDispatchOld="function saveDispatchPlans(){try{localStorage.setItem('molino_dispatch_plan_v1',JSON.stringify(state.dispatchPlan))}catch(e){console.warn(e)}}";
const saveDispatchNew="function saveDispatchPlans(){try{localStorage.setItem('molino_dispatch_plan_v1',JSON.stringify(state.dispatchPlan));cloudReplaceDispatches(state.dispatchPlan)}catch(e){console.warn(e)}}";
if(app.includes(saveDispatchOld)) app=app.replace(saveDispatchOld,saveDispatchNew); else fail('No se encontró saveDispatchPlans');
const readExistStart='async function readExistenceRecords(){';
const readExistEnd='\nasync function persistExistenceRecords';
const readStart=app.indexOf(readExistStart);const readEnd=app.indexOf(readExistEnd,readStart);
if(readStart<0||readEnd<0)fail('No se encontró readExistenceRecords');
const readExistNew=`async function readExistenceRecords(){
  const cloud=await cloudLoadExistence();
  if(Array.isArray(cloud)&&cloud.length){state.existenceRecords=cloud;return cloud.sort((a,b)=>String(a.key).localeCompare(String(b.key)))}
  try{const db=await idb();const rows=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE_EXISTENCE,'readonly');const r=tx.objectStore(STORE_EXISTENCE).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)});db.close();if(rows.length)return rows.sort((a,b)=>String(a.key).localeCompare(String(b.key)))}catch(e){console.warn('No fue posible restaurar Registros de Existencia',e)}
  const legacy=legacyExistenceRecords();state.existenceRecords=legacy;return legacy.sort((a,b)=>String(a.key).localeCompare(String(b.key)));
}`;
app=app.slice(0,readStart)+readExistNew+app.slice(readEnd);
const persistStart='async function persistExistenceRecords(rows){';
const persistEnd='\nasync function readExistenceBaseRecords';
const pStart=app.indexOf(persistStart);const pEnd=app.indexOf(persistEnd,pStart);
if(pStart<0||pEnd<0)fail('No se encontró persistExistenceRecords');
const persistNew=`async function persistExistenceRecords(rows){
  const clean=(Array.isArray(rows)?rows:[]).filter(x=>x&&x.key);
  state.existenceRecords=clean;
  try{localStorage.setItem(EXISTENCE_DB,JSON.stringify(clean.map(x=>({...x,detailRows:undefined,existenceBase:undefined}))));}catch{}
  let db;try{db=await idb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE_EXISTENCE,'readwrite');const os=tx.objectStore(STORE_EXISTENCE);os.clear();for(const row of clean)os.put(row);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('No se pudo guardar Registros de Existencia'))});}catch(e){console.warn('No fue posible persistir Registros de Existencia en IndexedDB',e)}finally{try{db?.close()}catch{}}
  await cloudReplaceExistence(clean);
  return clean;
}`;
app=app.slice(0,pStart)+persistNew+app.slice(pEnd);
const bootNeed="async function boot(){if(!state.invoiceFilters.month)state.invoiceFilters.month=currentMonthKey();state.dispatchPlan=dispatchPlans();";
const bootWith="async function boot(){if(!state.invoiceFilters.month)state.invoiceFilters.month=currentMonthKey();state.dispatchPlan=dispatchPlans();await hydrateCloudData().catch(e=>console.warn('Cloud hydration skipped',e));";
if(app.includes(bootNeed)) app=app.replace(bootNeed,bootWith); else fail('No se encontró inicio de boot');
fs.writeFileSync(appPath,app);
console.log('CLOUD PERSISTENCE V1: PASS');
console.log('EXISTENCE DURABLE LOCAL-BRIDGE ROUTING: PASS');
