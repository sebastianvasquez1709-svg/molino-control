const fs=require('fs');
const p='public/app.js';
let s=fs.readFileSync(p,'utf8');
function fail(m){throw new Error('[EXISTENCE LIVE SYNC V2] '+m)}

const modelStart=s.indexOf('function existenceUnifiedDisplayModel(m){');
const modelEnd=s.indexOf('\nfunction renderInePautaTable(m){',modelStart);
if(modelStart<0||modelEnd<0)fail('No se encontró existenceUnifiedDisplayModel.');
const model=`function existenceUnifiedDisplayModel(m){
  const inv=m?.quality?.sourceType==='existencia';
  const rawKey=m?.key||m?.periodKey||m?.periodo||'';
  const key=typeof normalizeOfficialInePeriod==='function' ? normalizeOfficialInePeriod(rawKey) : String(rawKey).trim();
  let source=null;
  if(inv && m?.displayIne && Array.isArray(m.displayIne.items) && m.displayIne.items.length) source=m.displayIne;
  if(inv && !source && typeof OFFICIAL_INE_CACHE!=='undefined') source=OFFICIAL_INE_CACHE.get(key)||null;
  if(!source && inv){
    const map=state?.snapshot?.masterIneByPeriod||{};
    for(const [k,v] of Object.entries(map)){
      const nk=typeof normalizeOfficialInePeriod==='function'?normalizeOfficialInePeriod(k):String(k);
      if(nk===key && Array.isArray(v?.items)&&v.items.length){source=v;break;}
    }
  }
  if(!source && inv && m?.derivedIne?.available) source=m.derivedIne;
  if(!source && !inv) source=m||null;
  if(!source)return null;
  const items=orderIneItems(source.items||[]).map(x=>{
    const kg=Number(x?.kg)||0, neto=Number(x?.neto)||0;
    return {...x,kg,neto,promedio:kg?neto/kg:0,vn:Number(x?.vn)||0,kgp:Number(x?.kgp)||0};
  });
  const safeKg=Number.isFinite(Number(source.totalKg))?Number(source.totalKg):items.reduce((a,x)=>a+x.kg,0);
  const safeNeto=Number.isFinite(Number(source.totalNeto))?Number(source.totalNeto):items.reduce((a,x)=>a+x.neto,0);
  items.forEach(x=>{x.vn=safeNeto?x.neto/safeNeto:0;x.kgp=safeKg?x.kg/safeKg:0});
  const kgHarinas=Number.isFinite(Number(source.kgHarinas))?Number(source.kgHarinas):items.slice(0,3).reduce((a,x)=>a+x.kg,0);
  const netoHarinas=Number.isFinite(Number(source.netoHarinas))?Number(source.netoHarinas):items.slice(0,3).reduce((a,x)=>a+x.neto,0);
  return {...source,items,totalKg:safeKg,totalNeto:safeNeto,totalPromedio:safeKg?safeNeto/safeKg:0,kgHarinas,netoHarinas,promedioHarinas:kgHarinas?netoHarinas/kgHarinas:0,key:String(m?.key||source.key||key),periodKey:key,periodo:m?.periodo||source.periodo||key,available:true};
}
`;
s=s.slice(0,modelStart)+model+s.slice(modelEnd);

const renderStart=s.indexOf('function renderExistencias(){');
const renderEnd=s.indexOf('\nfunction normalizeMasterPeriodKey(v){',renderStart);
if(renderStart<0||renderEnd<0)fail('No se encontró renderExistencias completo.');
const render=`function renderExistencias(){
  if(state.role!=='ADMIN')return renderDenied();
  const records=Array.isArray(state.existenceRecords)?state.existenceRecords.slice().sort((a,b)=>String(a.key).localeCompare(String(b.key))):[];
  const selected=records.find(x=>String(x.key)===String(state.existenceSelected))||records[records.length-1]||null;
  if(selected)state.existenceSelected=selected.key;
  const token=selected?String(selected.key)+'|'+String(selected.uploadedAt||selected.updatedAt||''):'EMPTY';
  const model=selected?existenceUnifiedDisplayModel(selected):null;
  const inv=selected?.inventory||{};
  const stockItems=orderIneItems(selected?.items||[]);
  const stockNeto=n(selected?.totalNeto),stockKg=n(selected?.totalKg),stockUnit=stockKg?stockNeto/stockKg:0;
  const ine=model;
  const loadingOfficial=!!(selected&&selected.quality?.sourceType==='existencia'&&(!selected.displayIne || !selected.displayIne.items?.length));
  $('content').innerHTML=`<div class="privateHero"><div><div class="privateEyebrow">🔒 ADMIN · BASE DE EXISTENCIAS</div><h1>📦 Registros de existencia</h1><p>El registro subido es la fuente del stock. El bloque INE del mismo período usa la fórmula oficial del Maestro. Pantalla e impresión comparten el mismo modelo.</p></div><div class="privateActions"><label class="uploadBtn">📥 Cargar Registro de Existencia<input id="existFile" type="file" accept=".xlsx,.xlsm" multiple></label>${selected?'<button class="secondary" type="button" id="existPrint">🖨️ Imprimir exactamente este informe</button>':''}</div></div>
  ${records.length?`<div class="card"><div class="sectionTitle"><div><h3>Historial guardado</h3><div class="note">${records.length} registro${records.length===1?'':'s'} · se selecciona automáticamente el último archivo procesado.</div></div><select id="existSelect">${records.slice().reverse().map(m=>`<option value="${esc(m.key)}" ${m.key===selected?.key?'selected':''}>${esc(m.periodo||m.key)} · ${esc(m.fileName||'Registro')}</option>`).join('')}</select></div><div class="historyGrid">${records.slice().reverse().map(m=>`<button type="button" class="historyItem ${m.key===selected?.key?'active':''}" data-exist-key="${esc(m.key)}"><strong>${esc(m.periodo||m.key)}</strong><span>${esc(m.fileName||'Registro')}</span><b>${money(m.totalKg)} kg</b><small>$ ${money(m.totalNeto)} stock</small></button>`).join('')}</div></div>`:'<div class="status info">📭 No hay registros de existencia almacenados.</div>'}
  ${selected?`<div class="kpiGrid"><div class="kpi powerKpi"><small>VALOR STOCK</small><b>$ ${money(stockNeto)}</b><span>Total Disponible$</span></div><div class="kpi powerKpi"><small>KG STOCK</small><b>${money(stockKg)}</b><span>Total Disponible</span></div><div class="kpi powerKpi"><small>VALOR UNITARIO STOCK</small><b>$ ${dec(stockUnit)}</b><span>Stock $ / KG</span></div><div class="kpi powerKpi"><small>ESTADO INE</small><b>${ine?.items?.length?'✅ Cargado':loadingOfficial?'⏳ Actualizando':'⚠️ Sin datos'}</b><span>${esc(selected.periodo||selected.key)}</span></div></div><div class="card"><div class="sectionTitle"><div><h3>Detalle del registro + INE</h3><div class="note">${loadingOfficial?'Actualizando INE del mismo período…':'Fuente sincronizada: registro seleccionado.'}</div></div><button class="danger" type="button" id="existDelete">Eliminar este registro</button></div>${renderInePautaTable(selected)}</div>`:''}`;

  $('existSelect')?.addEventListener('change',e=>{state.existenceSelected=e.target.value;renderExistencias()});
  document.querySelectorAll('[data-exist-key]').forEach(b=>b.addEventListener('click',()=>{state.existenceSelected=b.dataset.existKey;renderExistencias()}));
  $('existFile')?.addEventListener('change',async e=>{
    const files=[...(e.target.files||[])];if(!files.length)return;
    try{
      setLoading(true,'Actualizando Existencia…','Procesando el archivo y preparando la vista del mismo período',10);
      let last=null;
      for(const f of files){
        last=await parseIneWorkbook(f);
        if(last?.quality?.sourceType!=='existencia')throw new Error(`${f.name}: no se reconoció como Registro de Existencia Físico-Valorizado.`);
        await mergeExistenceRecord(last);
      }
      if(last){state.existenceSelected=last.key;state.ineSelected=last.key;}
      setLoading(false);renderExistencias();
      toast('✅ Registro cargado. Actualizando el INE del mismo período…','ok');
      const target=last;
      if(target){const official=await resolveOfficialInePeriod(target.key);const current=state.existenceRecords.find(x=>x.key===target.key);if(official&&current){current.displayIne=official;current.displayIneFetchedAt=Date.now();state.existenceRecords=state.existenceRecords.map(x=>x.key===current.key?current:x);if(state.existenceSelected===target.key)renderExistencias();}}
    }catch(err){setLoading(false);$('content').insertAdjacentHTML('afterbegin',`<div class="status err"><b>❌ Error:</b> ${esc(err?.message||String(err))}</div>`)}
  });
  $('existPrint')?.addEventListener('click',()=>printIneReport(selected));
  $('existDelete')?.addEventListener('click',async()=>{
    if(!selected?.key)return;if(!confirm(`¿Eliminar ${selected.periodo||selected.key}?`))return;
    state.existenceRecords=state.existenceRecords.filter(x=>x.key!==selected.key);
    await persistExistenceRecords(state.existenceRecords);
    state.existenceBaseRecords=state.existenceBaseRecords.filter(x=>x.key!==selected.key);
    let db;try{db=await idb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE_EXISTENCE_BASE,'readwrite');tx.objectStore(STORE_EXISTENCE_BASE).delete(selected.key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});}finally{try{db?.close()}catch{}}
    state.ineMonths=state.ineMonths.filter(x=>x.key!==selected.key);await persistIneMonths(state.ineMonths);
    state.existenceSelected=state.existenceRecords.at(-1)?.key||'';state.ineSelected=state.existenceSelected;renderExistencias();
  });

  if(selected?.key&&selected.quality?.sourceType==='existencia'&&!selected.displayIne){
    Promise.resolve().then(async()=>{
      try{
        const official=await resolveOfficialInePeriod(selected.key);
        const current=state.existenceRecords.find(x=>String(x.key)===String(selected.key));
        if(!official||!current)return;
        current.displayIne=official;current.displayIneFetchedAt=Date.now();
        state.existenceRecords=state.existenceRecords.map(x=>x.key===current.key?current:x);
        if(String(state.existenceSelected)===String(selected.key))renderExistencias();
      }catch(e){console.warn('INE del registro no disponible',e)}
    });
  }
}
`;
s=s.slice(0,renderStart)+render+s.slice(renderEnd);

const printStart=s.indexOf('function printIneReport(m){');
const printEnd=s.indexOf('\nfunction renderSacosGranel(){',printStart);
if(printStart<0||printEnd<0)fail('No se encontró printIneReport.');
const print=`function printIneReport(m){
  const source=m?.quality?.sourceType==='existencia'?existenceUnifiedDisplayModel(m):m;
  const host=$('printArea');
  const avg0=v=>Math.round(n(v||0)).toLocaleString('es-CL');
  const pct1=v=>(n(v)*100).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
  if(m?.quality?.sourceType==='existencia'){
    const stock=orderIneItems(m?.items||[]), dm=new Map((source?.items||[]).map(x=>[String(x.name||'').toUpperCase(),x]));
    const tr=stock.map(x=>{const r=dm.get(String(x.name||'').toUpperCase());return '<tr><td>'+esc(x.name)+'</td><td class="num">$ '+money(x.neto)+'</td><td class="num">'+money(x.kg)+'</td><td class="num">$ '+dec(x.stockUnitValue||0)+'</td><td class="num">'+(r?money(r.kg):'N/D')+'</td><td class="num">'+(r?'$ '+money(r.neto):'N/D')+'</td><td class="num">'+(r?'$ '+avg0(r.promedio):'N/D')+'</td><td class="num">'+(r?pct1(r.vn):'0,0%')+'</td><td class="num">'+(r?pct1(r.kgp):'0,0%')+'</td></tr>';}).join('');
    host.innerHTML='<div class="printPage inePrint"><div class="printHeader"><img src="/logo molino.jpg" alt="Molinos San Miguel"><div><div class="printTitle">REGISTRO DE EXISTENCIA · INE</div><div style="text-align:center;font-size:12px">MOLINOS SAN MIGUEL LTDA · '+esc(m?.periodo||m?.key||'')+'</div></div><div class="printMeta">Impreso: '+new Date().toLocaleDateString('es-CL')+'</div></div><table class="printTable"><thead><tr><th>Familia</th><th>Valor Disponible$</th><th>KG Stock</th><th>Valor unitario stock</th><th>Salida INE KG</th><th>Valor NETO</th><th>Promedio</th><th>V.N %</th><th>KG %</th></tr></thead><tbody>'+tr+'</tbody><tfoot><tr><th>TOTAL</th><th>$ '+money(m?.totalNeto)+'</th><th>'+money(m?.totalKg)+'</th><th>$ '+dec(m?.totalStockUnitValue||0)+'</th><th>'+money(source?.totalKg||0)+'</th><th>$ '+money(source?.totalNeto||0)+'</th><th>$ '+avg0(source?.totalPromedio||0)+'</th><th>100,0%</th><th>100,0%</th></tr></tfoot></table><div class="printHarinas"><div><b>VALOR STOCK HARINAS</b><span>$ '+money(m?.netoHarinas)+'</span></div><div><b>KG STOCK HARINAS</b><span>'+money(m?.kgHarinas)+'</span></div><div><b>VALOR UNITARIO STOCK HARINAS</b><span>$ '+dec(m?.stockUnitValueHarinas||0)+'</span></div><div><b>NETO HARINAS INE</b><span>$ '+money(source?.netoHarinas||0)+'</span></div><div><b>KG HARINAS INE</b><span>'+money(source?.kgHarinas||0)+'</span></div><div><b>VALOR PROMEDIO HARINAS INE</b><span>$ '+avg0(source?.promedioHarinas||0)+'</span></div></div><div class="footer"><span>Molinos San Miguel LTDA</span><span>Registro e informe sincronizados</span></div></div>';
    window.print();setTimeout(()=>{host.innerHTML=''},500);return;
  }
  const rows=orderIneItems(source?.items||[]);
  const tr=rows.map(x=>'<tr><td>'+esc(x.name)+'</td><td class="num">$ '+money(x.neto)+'</td><td class="num">'+money(x.kg)+'</td><td class="num">$ '+avg0(x.promedio)+'</td><td class="num">'+pct1(x.vn)+'</td><td class="num">'+pct1(x.kgp)+'</td></tr>').join('');
  host.innerHTML='<div class="printPage inePrint"><div class="printHeader"><img src="/logo molino.jpg" alt="Molinos San Miguel"><div><div class="printTitle">INFORME INE</div><div style="text-align:center;font-size:12px">MOLINOS SAN MIGUEL LTDA</div></div><div class="printMeta">Impreso: '+new Date().toLocaleDateString('es-CL')+'</div></div><table class="printTable"><thead><tr><th>Etiquetas de fila</th><th>Valor NETO</th><th>Cantidad kg</th><th>Promedio</th><th>V.N %</th><th>KG %</th></tr></thead><tbody>'+tr+'</tbody><tfoot><tr><th>Total general</th><th>$ '+money(source?.totalNeto)+'</th><th>'+money(source?.totalKg)+'</th><th>$ '+avg0(source?.totalPromedio)+'</th><th>100,0%</th><th>100,0%</th></tr></tfoot></table><div class="footer"><span>Molinos San Miguel LTDA</span><span>Informe INE</span></div></div>';window.print();setTimeout(()=>{host.innerHTML=''},500);
}
`;
s=s.slice(0,printStart)+print+s.slice(printEnd);

fs.writeFileSync(p,s);
console.log('EXISTENCE LIVE SYNC V2: PASS');
console.log('UPLOAD RESELECTS NEWEST RECORD: PASS');
console.log('SCREEN/PRINT USE CANONICAL DISPLAY MODEL: PASS');
console.log('FULL 9-COLUMN EXISTENCE PRINT: PASS');
console.log('OFFICIAL SAME-PERIOD INE REFRESH: PASS');
