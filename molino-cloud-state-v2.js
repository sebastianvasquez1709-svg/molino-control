/* Molino Control · Reingeniería V1 · Durable Existence State
 * Puente transitorio sobre la sesión local actual. Centraliza el historial
 * de Registros de Existencia en Supabase y conserva IndexedDB como fallback.
 */
(()=>{
'use strict';
const VERSION='MC_CLOUD_STATE_V2';
const RPC='molino_existence_state_local';
const timeout=(p,ms=12000)=>new Promise((resolve,reject)=>{const id=setTimeout(()=>reject(new Error('Tiempo de espera agotado al sincronizar Existencia.')),ms);Promise.resolve(p).then(v=>{clearTimeout(id);resolve(v)},e=>{clearTimeout(id);reject(e)})});
function cleanRecord(row){
  if(!row||!row.key)return null;
  const out={...row};
  delete out.existenceBase;
  return out;
}
async function localSession(){
  const s=await window.MolinoCloud?.getSession?.();
  if(!s?._identifier||!s?._password)throw new Error('No existe una sesión local activa para sincronizar.');
  return s;
}
async function call(action,payload={}){
  const s=await localSession();
  const sb=await window.MolinoCloud.client();
  const req=sb.rpc(RPC,{p_rut:s._identifier,p_pin:s._password,p_action:action,p_payload:payload||{}});
  const {data,error}=await timeout(req);
  if(error)throw error;
  if(!data?.ok)throw new Error(data?.message||'Supabase rechazó la operación de Existencia.');
  return data;
}
async function listExistence(){
  const data=await call('list',{});
  return (Array.isArray(data.rows)?data.rows:[]).map(r=>({
    ...((r&&r.payload)||{}),
    key:r.key,
    periodo:r.periodo||r?.payload?.periodo||r.key,
    cloudUpdatedAt:r.updated_at||null,
    cloudSynced:true
  })).filter(x=>x.key).sort((a,b)=>String(a.key).localeCompare(String(b.key)));
}
async function upsertExistence(row){
  const clean=cleanRecord(row);
  if(!clean)throw new Error('Registro de Existencia inválido.');
  const data=await call('upsert',{key:String(clean.key),periodo:String(clean.periodo||clean.key),payload:clean});
  return data.row||null;
}
async function deleteExistence(key){
  if(!key)return false;
  const data=await call('delete',{key:String(key)});
  return data.deleted===true;
}
async function mergeAndMigrate(localRows=[]){
  const local=(Array.isArray(localRows)?localRows:[]).filter(x=>x&&x.key);
  let cloud=[];
  try{cloud=await listExistence();}catch(err){
    console.warn('[MC_CLOUD_STATE_V2] Cloud no disponible; se conserva historial local.',err);
    return {rows:local,cloudAvailable:false,migrated:0,error:err};
  }
  const cloudByKey=new Map(cloud.map(x=>[String(x.key),x]));
  let migrated=0;
  for(const row of local){
    const key=String(row.key);
    if(cloudByKey.has(key))continue;
    try{await upsertExistence(row);cloudByKey.set(key,{...row,cloudSynced:true});migrated++;}
    catch(err){console.warn('[MC_CLOUD_STATE_V2] No se pudo migrar '+key,err);}
  }
  // La nube tiene prioridad cuando ya existe el mismo período: evita que un
  // snapshot local antiguo pise un registro durable más reciente.
  const merged=new Map(local.map(x=>[String(x.key),x]));
  for(const row of cloudByKey.values())merged.set(String(row.key),row);
  return {rows:[...merged.values()].sort((a,b)=>String(a.key).localeCompare(String(b.key))),cloudAvailable:true,migrated};
}
window.MolinoCloudStateV2=Object.freeze({VERSION,listExistence,upsertExistence,deleteExistence,mergeAndMigrate});
})();
