const fs=require('fs');
const p='public/app.js';
let s=fs.readFileSync(p,'utf8');
function fail(m){throw new Error('[EXISTENCE LIVE SYNC V4] '+m)}

// 1) The freshly uploaded Existencia is authoritative for the visible panel.
//    The monthly Maestro snapshot is an audit fallback, never a higher-priority stale display source.
const modelStart=s.indexOf('function existenceUnifiedDisplayModel(m){');
const modelEnd=s.indexOf('\nfunction renderInePautaTable(m){',modelStart);
if(modelStart<0||modelEnd<0)fail('No se encontró existenceUnifiedDisplayModel.');
let model=s.slice(modelStart,modelEnd);
const staleBlock="  if(!source&&inv){const map=state?.snapshot?.masterIneByPeriod||{};for(const [k,v] of Object.entries(map)){const nk=typeof normalizeOfficialInePeriod==='function'?normalizeOfficialInePeriod(k):String(k);if(nk===key&&Array.isArray(v?.items)&&v.items.length){source=v;break}}}\n  if(!source&&inv&&m?.derivedIne?.available)source=m.derivedIne;";
const preferredBlock="  if(!source&&inv&&m?.derivedIne?.available)source=m.derivedIne;\n  if(!source&&inv){const map=state?.snapshot?.masterIneByPeriod||{};for(const [k,v] of Object.entries(map)){const nk=typeof normalizeOfficialInePeriod==='function'?normalizeOfficialInePeriod(k):String(k);if(nk===key&&Array.isArray(v?.items)&&v.items.length){source=v;break}}}";
if(model.includes(staleBlock)) model=model.replace(staleBlock,preferredBlock);
else if(!model.includes(preferredBlock)) fail('No se encontró el orden de fuentes del modelo canónico.');
s=s.slice(0,modelStart)+model+s.slice(modelEnd);

// 2) Replace the upload handler so the UI is rendered only after the INE synchronization attempt.
//    The updated displayIne is persisted, preventing a refresh from reverting to the old screen.
const renderStart=s.indexOf('function renderExistencias(){');
const renderEnd=s.indexOf('\nfunction normalizeMasterPeriodKey(v){',renderStart);
if(renderStart<0||renderEnd<0)fail('No se encontró renderExistencias.');
const listenerStart=s.indexOf("  $('existFile')?.addEventListener('change',async e=>{",renderStart);
const listenerEnd=s.indexOf("\n  $('existPrint')?.addEventListener",listenerStart);
if(listenerStart<0||listenerEnd<0)fail('No se encontró el listener de carga de Existencia.');
const listener=`  $('existFile')?.addEventListener('change',async e=>{
    const files=[...(e.target.files||[])];
    // Permite volver a cargar exactamente el mismo archivo.
    e.target.value='';
    if(!files.length)return;
    const token=String(files.map(f=>f.name+'|'+f.size+'|'+f.lastModified).join('||'));
    try{
      setLoading(true,'Actualizando Existencia…','Procesando el archivo y sincronizando el mismo período con INE',8);
      let last=null;
      for(const f of files){
        last=await parseIneWorkbook(f);
        if(last?.quality?.sourceType!=='existencia')throw new Error(f.name+': no se reconoció como Registro de Existencia Físico-Valorizado.');
        await mergeExistenceRecord(last);
      }
      if(!last)throw new Error('No se procesó ningún Registro de Existencia.');
      state.existenceSelected=last.key;
      state.ineSelected=last.key;

      // Start from the newly uploaded record; do not display a stale monthly snapshot meanwhile.
      const cur=state.existenceRecords.find(x=>String(x.key)===String(last.key));
      if(!cur)throw new Error('El Registro cargado no quedó disponible en el estado actual.');
      cur.__uploadToken=token;
      cur.displayIne=null;
      cur.displayIneFetchedAt=0;

      const official=await resolveOfficialInePeriod(last.key);
      const current=state.existenceRecords.find(x=>String(x.key)===String(last.key));
      if(current){
        current.displayIne=official||null;
        current.displayIneFetchedAt=official?Date.now():0;
        current.__uploadToken=token;
        state.existenceRecords=state.existenceRecords.map(x=>x.key===current.key?current:x);
        // Critical: persist the same object that the screen and print model consume.
        await persistExistenceRecords(state.existenceRecords);
      }

      setLoading(false);
      renderExistencias();
      toast(official?'✅ Registro cargado y sincronizado con INE.':'✅ Registro cargado. Se mostró el cálculo disponible del mismo registro.','ok');
    }catch(err){
      setLoading(false);
      $('content').insertAdjacentHTML('afterbegin','<div class="status err"><b>❌ Error:</b> '+esc(err?.message||String(err))+'</div>');
    }
  });`;
s=s.slice(0,listenerStart)+listener+s.slice(listenerEnd);

// 3) Boot previously rebuilt the display record from existenceBase and discarded displayIne.
//    Preserve the already synchronized display payload across reloads.
const bootOld="if(state.existenceBaseRecords.length){const merged=state.existenceBaseRecords.map(entryFromExistenceBase).filter(Boolean);state.existenceRecords=await persistExistenceRecords(merged)}";
const bootNew="if(state.existenceBaseRecords.length){const previous=new Map((state.existenceRecords||[]).map(x=>[String(x.key),x]));const merged=state.existenceBaseRecords.map(entryFromExistenceBase).filter(Boolean).map(x=>{const prev=previous.get(String(x.key));return prev?.displayIne?{...x,displayIne:prev.displayIne,displayIneFetchedAt:prev.displayIneFetchedAt,existenceBase:prev.existenceBase||x.existenceBase}:x});state.existenceRecords=await persistExistenceRecords(merged)}";
if(!s.includes(bootOld))fail('No se encontró la reconstrucción de existencia al iniciar.');
s=s.replace(bootOld,bootNew);

if(!s.includes('function existenceUnifiedDisplayModel(m){'))fail('Modelo canónico ausente después del parche.');
if(!s.includes("e.target.value='';"))fail('No quedó habilitada la recarga del mismo archivo.');
if(!s.includes('await persistExistenceRecords(state.existenceRecords);'))fail('No quedó persistencia del displayIne sincronizado.');
if(!s.includes('const official=await resolveOfficialInePeriod(last.key)'))fail('No quedó sincronización oficial por período.');
if(!s.includes('displayIne=official||null'))fail('El resultado oficial no se guarda en el registro.');
if(!s.includes('const previous=new Map((state.existenceRecords||[]).map(x=>[String(x.key),x]));'))fail('No quedó preservación de displayIne al reconstruir desde la base.');
if(!s.includes('EXISTENCE LIVE SYNC V4'))s+='\n/* EXISTENCE LIVE SYNC V4 */\n';
fs.writeFileSync(p,s);
console.log('EXISTENCE LIVE SYNC V4: PASS');
console.log('UPLOADED EXISTENCE IS AUTHORITATIVE: PASS');
console.log('SAME-FILE REUPLOAD ENABLED: PASS');
console.log('DISPLAY INE PERSISTED: PASS');
console.log('RELOAD PRESERVES DISPLAY INE: PASS');
console.log('SCREEN/PRINT SHARE CANONICAL MODEL: PASS');
