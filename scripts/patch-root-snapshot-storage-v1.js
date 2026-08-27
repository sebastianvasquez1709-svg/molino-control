const fs=require('fs');
const p='app.js';
let app=fs.readFileSync(p,'utf8');
const marker='/* ROOT_SNAPSHOT_STORAGE_V1 */';
if(app.includes(marker)){console.log('ROOT SNAPSHOT STORAGE V1: ALREADY PRESENT');process.exit(0);}
const start='async function readSnapshot(){';
const end='\n    async function audit(';
const idx=app.indexOf(start);
const endIdx=app.indexOf(end,idx);
if(idx<0||endIdx<0)throw new Error('[ROOT SNAPSHOT STORAGE V1] No se encontró el bloque íntegro de readSnapshot.');
const replacement=`/* ROOT_SNAPSHOT_STORAGE_V1 */
async function readSnapshotLocal(){
  let db;
  try{
    db=await idb();
    const loaded=await new Promise((resolve,reject)=>{
      const tx=db.transaction([STORE_META,STORE_PARTS],'readonly');
      const metaReq=tx.objectStore(STORE_META).get('snapshot');
      const partsReq=tx.objectStore(STORE_PARTS).getAll();
      let meta=null,parts=[];
      metaReq.onsuccess=()=>{meta=metaReq.result||null};
      partsReq.onsuccess=()=>{parts=Array.isArray(partsReq.result)?partsReq.result:[]};
      tx.oncomplete=()=>resolve({meta,parts});
      tx.onerror=()=>reject(tx.error||new Error('No se pudo leer el almacenamiento local del Maestro.'));
      tx.onabort=()=>reject(tx.error||new Error('Lectura local del Maestro abortada.'));
    });
    if(!loaded.meta)return null;
    const groups={documents:[],clients:[],guides:[],nc:[],invoices:[],boletas:[]};
    for(const part of loaded.parts){
      const id=String(part?.id||'');
      const pos=id.indexOf(':');
      if(pos<1)continue;
      const name=id.slice(0,pos);
      if(!Object.prototype.hasOwnProperty.call(groups,name))continue;
      const data=Array.isArray(part.data)?part.data:[];
      groups[name].push({id,data});
    }
    for(const name of Object.keys(groups))groups[name]=groups[name].sort((a,b)=>String(a.id).localeCompare(String(b.id),'en',{numeric:true})).flatMap(x=>x.data);
    const expected=loaded.meta.collections||{};
    for(const name of Object.keys(groups)){
      const expectedChunks=Number(expected[name]||0);
      const actualParts=loaded.parts.filter(part=>String(part?.id||'').startsWith(name+':')).length;
      if(expectedChunks>0&&actualParts<expectedChunks)throw new Error('El Maestro local está incompleto; falta información almacenada.');
    }
    return {...loaded.meta,...groups};
  }catch(e){
    console.warn('Lectura local del Maestro no disponible',e);
    return null;
  }finally{try{db?.close()}catch{}}
}
async function readSnapshot(){
  // Primero recuperamos la copia local: es la fuente de verdad de la carga del Excel
  // y evita que el arranque dependa de un snapshot cloud masivo.
  const local=await readSnapshotLocal();
  if(local)return local;
  try{
    if(window.MolinoCloud && await MolinoCloud.getSession()) return await MolinoCloud.snapshot({force:true});
  }catch(e){ console.warn('Snapshot cloud no disponible; no se pudo recuperar una copia local',e); }
  return null;
}
`;
app=app.slice(0,idx)+replacement+app.slice(endIdx);
fs.writeFileSync(p,app);
console.log('ROOT SNAPSHOT STORAGE V1: PATCHED');
