#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const appPath = path.resolve('app.js');
let src = fs.readFileSync(appPath, 'utf8');
const start = src.indexOf('function renderDispatches(){');
const end = src.indexOf('\nfunction renderGuides', start);
if (start < 0 || end < 0) throw new Error('No se encontró renderDispatches para aplicar el módulo profesional.');

const replacement = String.raw`function renderDispatches(){
  if(!Array.isArray(state.dispatchPlan))state.dispatchPlan=[];
  if(!state.dispatchPlan.length){try{state.dispatchPlan=dispatchPlans()}catch{}}
  const products=productOptions();
  const clients=state.snapshot?.clients||[];
  const m=state.snapshot?.metrics||emptySnap().metrics;
  const g=m.granel||{},s=m.sacos||{};
  const editingId=state.dispatchEditingId||'';
  const editing=editingId?state.dispatchPlan.find(x=>String(x.id)===String(editingId)):null;
  const savedRows=state.dispatchPlan.slice().sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||'')));

  const escD=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const fmtD=v=>Number(v||0).toLocaleString('es-CL',{maximumFractionDigits:2});
  const moneyD=v=>Number(v||0).toLocaleString('es-CL',{maximumFractionDigits:0});

  $('content').innerHTML=\`<div class="dispatchProRoot">
    <div class="card">
      <div class="sectionTitle dispatchSectionTitle">
        <div><span class="pill">🚚 DESPACHOS</span><h3 style="margin-top:8px">Planificación y control de despachos</h3><div class="note">Crea, modifica o elimina líneas de despacho. Los KG de sacos se recalculan automáticamente según el formato.</div></div>
        <div class="toolbar"><span class="pill">${savedRows.length} líneas</span><button class="secondary" type="button" onclick="printDispatchPlan()">🖨️ Imprimir / PDF</button><button class="secondary" type="button" onclick="downloadDispatchPlanHtml()">⬇️ Descargar</button></div>
      </div>
      <div class="kpiRow dispatchKpis">
        <div class="kpi"><small>VENTAS * SACOS</small><b>${moneyD(s.ventasSacos)}</b></div>
        <div class="kpi"><small>KG SACOS</small><b>${moneyD(s.kgSacos)}</b></div>
        <div class="kpi"><small>KG GRANEL</small><b>${moneyD(g.totalGranel)}</b></div>
        <div class="kpi"><small>LÍNEAS PLANIFICADAS</small><b>${savedRows.length}</b></div>
      </div>
    </div>

    <div class="card dispatchFormCard">
      <div class="sectionTitle">
        <div><h3>${editing?'✏️ Modificar despacho':'📋 Nuevo despacho'}</h3><div class="note">${editing?'Editando una línea existente. Guarda o cancela para volver al modo normal.':'Puedes agregar varios productos a una misma orden.'}</div></div>
        ${editing?'<button class="ghost" type="button" id="dispatchCancelEdit">Cancelar edición</button>':''}
      </div>
      <div class="dispatchForm">
        <div class="autocomplete"><label>Cliente</label><input id="dClientSearch" type="text" autocomplete="off" placeholder="Escribe el nombre del cliente…" value="${escD(editing?.cliente||'')}"><input id="dClientKey" type="hidden" value=""><div id="clientSuggestions" class="suggestions hidden"></div></div>
        <div><label>RUT</label><input id="dRut" type="text" inputmode="numeric" maxlength="15" autocomplete="off" placeholder="Ej. 18.446.726-7" value="${escD(formatRut(editing?.rut||''))}"></div>
        <div><label>Destino registrado / dirección</label><input id="dDestination" list="destinationList" placeholder="Destino del cliente" value="${escD(editing?.destination||'')}"><datalist id="destinationList"></datalist><div class="note" style="margin-top:5px">Se completa desde la ficha del cliente.</div><button class="ghost" type="button" id="dWeatherCheck" style="margin-top:7px;width:100%">🌦️ Evaluar clima</button><div id="dWeatherAdvice" style="margin-top:7px"></div></div>
        <div><label>Fecha despacho</label><input id="dDate" type="date" value="${escD(editing?.fecha||new Date().toISOString().slice(0,10))}"></div>
        <div><label>Folio / referencia</label><input id="dFolio" value="${escD(editing?.folio||'')}" placeholder="Opcional"></div>
        <div><label>O/C</label><input id="dOC" value="${escD(editing?.oc||'O/C PENDIENTE')}" placeholder="Ej. O/C 12345"></div>
        <div class="full"><label>Producto</label><input id="dProduct" list="productList" value="${escD(editing?.producto||'')}" placeholder="Selecciona o escribe producto"><datalist id="productList">${products.map(p=>'<option value="'+escD(p)+'"></option>').join('')}</datalist></div>
        <div><label>Formato</label><select id="dFormat"><option value="Sacos 25 KG" ${editing?.formato==='Sacos 25 KG'?'selected':''}>Sacos 25 KG</option><option value="Sacos 10 KG" ${editing?.formato==='Sacos 10 KG'?'selected':''}>Sacos 10 KG</option><option value="Granel O/C" ${editing?.formato==='Granel O/C'?'selected':''}>Granel O/C</option></select></div>
        <div><label>Cantidad</label><input id="dQty" type="number" min="0" step="1" value="${editing?escD(editing.cantidad??''):''}" placeholder="Sacos / unidades"></div>
        <div><label>KG</label><input id="dKg" type="number" min="0" step="1" value="${editing?escD(editing.kg??''):''}" placeholder="Kilogramos"></div>
        <div><label>Observación</label><input id="dObs" value="${escD(editing?.observacion||'')}" placeholder="Opcional"></div>
        <div class="full"><div class="toolbar"><button class="primary" type="button" id="dispatchSaveBtn">${editing?'💾 Guardar cambios':'✅ Guardar despacho'}</button>${!editing?'<button class="secondary" type="button" id="dispatchAddDraft">➕ Agregar otro producto</button>':''}<button class="ghost" type="button" id="dispatchClear">Limpiar formulario</button></div></div>
      </div>
      <div id="draftItemsPro" class="dispatchItemsPro"></div>
    </div>

    <div class="card dispatchPlanCard">
      <div class="sectionTitle"><div><h3>🗓️ Planilla de despachos</h3><div class="note">Cada línea tiene acciones independientes para modificar o eliminar.</div></div><div class="toolbar"><input id="dispatchPlanQ" class="searchInput" placeholder="Buscar cliente, producto, destino, O/C…"></div></div>
      <div id="dispatchPlanCount" class="invoiceResultsHeader"></div>
      <div class="dispatchTableViewport"><table class="table dispatchPlanTable"><thead><tr><th>Fecha</th><th>Cliente / RUT</th><th>Destino</th><th>Producto</th><th>Formato</th><th>Cantidad</th><th>KG</th><th>Folio</th><th>O/C</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="dispatchPlanBody"></tbody></table></div>
    </div>
  </div>\`;

  const clientKeyFor=(c)=>c?.key||'';
  const findByRutLocal=v=>typeof findClientByRut==='function'?findClientByRut(v):((state.snapshot?.clients||[]).find(c=>normalize(c.rut||'')===normalize(v||''))||null);
  const clientToForm=(c)=>{if(!c)return;selectDispatchClient(c);$('dClientKey').value=clientKeyFor(c);$('dDestination').value=destinationFromClient(c)||$('dDestination').value||''};
  const existingClient=editing?(clients.find(c=>String(c.key)===String(editing.clientKey||''))||findByRutLocal(editing.rut)):null;
  if(existingClient)clientToForm(existingClient);
  else if(editing?.rut){const c=findByRutLocal(editing.rut);if(c)clientToForm(c)}
  setupDispatchClientAutocomplete(clients);
  $('dQty').oninput=updateDispatchKgFromQty;
  $('dFormat').onchange=updateDispatchKgFromQty;
  updateDispatchKgFromQty();
  $('dWeatherCheck').onclick=()=>checkDispatchWeather();
  $('dClear').onclick=()=>{state.dispatchEditingId='';state.dispatchDraftItems=[];renderDispatches()};
  $('dRut').onblur=()=>{const c=findByRutLocal($('dRut').value);if(c)clientToForm(c);$('dRut').value=formatRut($('dRut').value)};
  $('dispatchSaveBtn').onclick=async()=>{
    const client=(clients.find(c=>String(c.key)===(String($('dClientKey').value||'')))||findByRutLocal($('dRut').value))||null;
    const rut=formatRut(client?.rut||$('dRut').value.trim());
    const fecha=$('dDate').value;
    const destination=$('dDestination').value.trim();
    const folio=$('dFolio').value.trim();
    const oc=(($('dOC').value||'').trim()||'O/C PENDIENTE');
    const producto=$('dProduct').value.trim();
    const formato=$('dFormat').value;
    const cantidad=Number($('dQty').value||0)||0;
    const enteredKg=Number($('dKg').value||0)||0;
    const autoWeight=dispatchFormatWeight(formato);
    const kg=autoWeight&&cantidad?cantidad*autoWeight:enteredKg;
    const observacion=$('dObs').value.trim();
    if(!client&&!rut){toast('⚠️ Selecciona un cliente o ingresa un RUT.','warn');$('dClientSearch').focus();return}
    if(!fecha){toast('⚠️ Selecciona la fecha de despacho.','warn');$('dDate').focus();return}
    if(!destination){toast('⚠️ Falta el destino/dirección.','warn');$('dDestination').focus();return}
    if(!producto||(!cantidad&&!kg)){toast('⚠️ Completa producto y cantidad/KG.','warn');$('dProduct').focus();return}
    const base={fecha,cliente:client?.nombre||editing?.cliente||'',rut,destination,folio,oc,producto,formato,cantidad,kg,observacion,clientKey:client?.key||editing?.clientKey||''};
    if(editing){
      const ix=state.dispatchPlan.findIndex(x=>String(x.id)===String(editingId));
      if(ix<0){toast('No se encontró la línea que estabas editando.','err');state.dispatchEditingId='';return renderDispatches()}
      state.dispatchPlan[ix]={...state.dispatchPlan[ix],...normalizeDispatchItem(base),id:state.dispatchPlan[ix].id,updatedAt:Date.now()};
      state.dispatchEditingId='';
      try{saveDispatchPlans();}catch(e){console.warn(e)}
      renderDispatches();toast('✅ Despacho modificado correctamente.','ok');return;
    }
    if(state.dispatchDraftItems.length){
      state.dispatchDraftItems.push(base);
      for(const item of state.dispatchDraftItems.slice()){state.dispatchPlan.push(normalizeDispatchItem({...item,id:Date.now()+'-'+Math.random().toString(36).slice(2),clientKey:client?.key||''}))}
      state.dispatchDraftItems=[];
    }else{
      state.dispatchPlan.push(normalizeDispatchItem({...base,id:Date.now()+'-'+Math.random().toString(36).slice(2)}));
    }
    try{saveDispatchPlans();}catch(e){console.warn(e)}
    renderDispatches();toast('✅ Despacho guardado en la planilla.','ok');
  };
  $('dispatchAddDraft')?.addEventListener('click',()=>{
    const producto=$('dProduct').value.trim(),formato=$('dFormat').value,cantidad=Number($('dQty').value||0)||0,kg0=Number($('dKg').value||0)||0,obs=$('dObs').value.trim();
    const w=dispatchFormatWeight(formato),kg=w&&cantidad?cantidad*w:kg0;
    const client=clients.find(c=>String(c.key)===String($('dClientKey').value||''))||findByRutLocal($('dRut').value);
    if(!producto||(!cantidad&&!kg)){toast('⚠️ Completa producto y cantidad/KG antes de agregar.','warn');return}
    state.dispatchDraftItems.push({cliente:client?.nombre||'',clientKey:client?.key||'',rut:formatRut(client?.rut||$('dRut').value),destination:$('dDestination').value.trim(),fecha:$('dDate').value,folio:$('dFolio').value.trim(),oc:(($('dOC').value||'').trim()||'O/C PENDIENTE'),producto,formato,cantidad,kg,observacion:obs});
    $('dProduct').value='';$('dQty').value='';$('dKg').value='';$('dObs').value='';renderDispatchDraftPro();toast('➕ Producto añadido al pedido.','ok');
  });

  function renderDispatchDraftPro(){const box=$('draftItemsPro');if(!box)return;const arr=Array.isArray(state.dispatchDraftItems)?state.dispatchDraftItems:[];if(!arr.length){box.innerHTML='';return}box.innerHTML='<div class="dispatchDraftBox"><strong>Productos pendientes de guardar</strong><div class="dispatchDraftList">'+arr.map((x,i)=>'<div class="dispatchDraftItem"><span><b>'+escD(x.producto)+'</b> · '+escD(x.formato)+' · '+fmtD(x.cantidad)+' · '+fmtD(x.kg)+' kg</span><button type="button" class="danger smallBtn" data-draft-remove="'+i+'">Quitar</button></div>').join('')+'</div></div>';box.querySelectorAll('[data-draft-remove]').forEach(b=>b.onclick=()=>{state.dispatchDraftItems.splice(Number(b.dataset.draftRemove),1);renderDispatchDraftPro()})}
  renderDispatchDraftPro();

  const paintPlan=()=>{
    const q=String($('dispatchPlanQ')?.value||'').trim().toLowerCase();
    const rows=savedRows.filter(r=>!q||[r.fecha,r.cliente,r.rut,r.destination,r.producto,r.formato,r.folio,r.oc,r.observacion].join(' ').toLowerCase().includes(q));
    $('dispatchPlanCount').innerHTML='<span>'+rows.length.toLocaleString('es-CL')+' líneas visibles</span><span class="note">Total KG: '+moneyD(rows.reduce((a,r)=>a+Number(r.kg||0),0))+' · Unidades: '+moneyD(rows.reduce((a,r)=>a+Number(r.cantidad||0),0))+'</span>';
    $('dispatchPlanBody').innerHTML=rows.map(r=>'<tr><td>'+escD(r.fecha||'')+'</td><td><strong>'+escD(r.cliente||'Cliente sin nombre')+'</strong><br><span class="note">'+escD(formatRut(r.rut||''))+'</span></td><td>'+escD(r.destination||'—')+'</td><td><strong>'+escD(r.producto||'—')+'</strong><br><span class="note">'+escD(r.observacion||'')+'</span></td><td>'+escD(r.formato||'')+'</td><td class="num">'+fmtD(r.cantidad)+'</td><td class="num"><strong>'+fmtD(r.kg)+'</strong></td><td>'+escD(r.folio||'—')+'</td><td>'+escD(r.oc||'O/C PENDIENTE')+'</td><td><span class="pill">Planificado</span></td><td><div class="toolbar actionBtns"><button type="button" class="secondary smallBtn" data-edit-dispatch="'+escD(r.id)+'">✏️ Modificar</button><button type="button" class="danger smallBtn" data-delete-dispatch="'+escD(r.id)+'">🗑️ Eliminar</button></div></td></tr>').join('')||'<tr><td colspan="11" class="empty">No hay despachos con este filtro.</td></tr>';
    $('dispatchPlanBody').querySelectorAll('[data-edit-dispatch]').forEach(b=>b.onclick=()=>window.editDispatchById(b.dataset.editDispatch));
    $('dispatchPlanBody').querySelectorAll('[data-delete-dispatch]').forEach(b=>b.onclick=()=>window.deleteDispatchById(b.dataset.deleteDispatch));
  };
  $('dispatchPlanQ').oninput=paintPlan;
  paintPlan();
}

window.editDispatchById=function(id){const row=(state.dispatchPlan||[]).find(x=>String(x.id)===String(id));if(!row){toast('No se encontró el despacho.','err');return}state.dispatchEditingId=String(id);state.dispatchDraftItems=[];renderDispatches();setTimeout(()=>{$('dProduct')?.focus()},0)};
window.deleteDispatchById=function(id){const ix=(state.dispatchPlan||[]).findIndex(x=>String(x.id)===String(id));if(ix<0){toast('No se encontró el despacho.','err');return}const row=state.dispatchPlan[ix];if(!confirm('¿Eliminar el despacho de '+(row.cliente||'cliente sin nombre')+' — '+(row.producto||'producto')+'?'))return;state.dispatchPlan.splice(ix,1);try{saveDispatchPlans()}catch(e){console.warn(e)}if(String(state.dispatchEditingId)===String(id))state.dispatchEditingId='';renderDispatches();toast('🗑️ Despacho eliminado.','ok')};
`;

const cssMarker='/* DISPATCH PRO V9 */';
const cssInject=`\n${cssMarker}\n.dispatchProRoot .dispatchSectionTitle{margin-top:0}.dispatchFormCard{margin-top:14px}.dispatchPlanCard{margin-top:14px}.dispatchPlanCard .sectionTitle{align-items:flex-start}.dispatchPlanViewport,.dispatchTableViewport{width:100%;overflow-x:auto;overflow-y:visible}.dispatchPlanTable{min-width:1250px}.dispatchPlanTable th,.dispatchPlanTable td{vertical-align:middle}.dispatchPlanTable .actionBtns{flex-wrap:nowrap;min-width:170px}.dispatchDraftBox{margin-top:14px;padding:12px 14px;border:1px solid #dbe5ef;border-radius:12px;background:#f8fafc}.dispatchDraftList{display:grid;gap:7px;margin-top:8px}.dispatchDraftItem{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 10px;background:#fff;border:1px solid #e3eaf3;border-radius:10px}.dispatchKpis .kpi{min-height:88px}.dispatchProRoot .tableWrap{max-height:none}.dispatchProRoot .searchInput{min-width:260px}@media(max-width:900px){.dispatchProRoot .dispatchKpis{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.dispatchProRoot .dispatchKpis{grid-template-columns:1fr}.dispatchDraftItem{align-items:flex-start;flex-direction:column}.dispatchPlanTable{min-width:1150px}}`;

if (!src.includes(cssMarker)) {
  const stylePos = src.lastIndexOf('</style>');
  if (stylePos > 0) src = src.slice(0,stylePos) + cssInject + '\n' + src.slice(stylePos);
}

src = src.slice(0,start) + replacement + src.slice(end);
fs.writeFileSync(appPath, src, 'utf8');
console.log('DISPATCH PRO V9: PATCHED');
