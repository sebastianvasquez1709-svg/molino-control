
// DISPATCH PRO V11 — in-place edit/delete without replacing the core dispatch renderer.
const __dispatchBaseShowV11=show;
const __dispatchGlobalShowV11=window.show;
function __dispatchToastV11(msg,kind='ok'){if(typeof toast==='function')return toast(msg,kind);try{alert(msg)}catch{}}
function __dispatchFormatWeightV11(v){const s=String(v||'').toUpperCase();if(/25\s*KG/.test(s))return 25;if(/10\s*KG/.test(s))return 10;return 0}
function __dispatchEscapeV11(v){return typeof esc==='function'?esc(v):String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]))}
function enhanceDispatchUIV11(){
  const cards=[...document.querySelectorAll('#content .card')];
  const host=cards.find(c=>/Planilla semanal/i.test(c.textContent||''));
  if(!host)return;
  host.classList.add('dispatchEnhanceHost');
  const table=host.querySelector('table');
  if(!table)return;
  const head=table.querySelector('thead tr'),body=table.querySelector('tbody');
  if(!head||!body)return;
  if(!head.querySelector('[data-dispatch-actions-head]')){const th=document.createElement('th');th.textContent='Acciones';th.dataset.dispatchActionsHead='1';head.appendChild(th)}
  const rows=Array.isArray(state.dispatchPlan)?state.dispatchPlan:[];
  [...body.querySelectorAll('tr')].forEach((tr,i)=>{
    const row=rows[i];
    if(!row||tr.querySelector('[data-dispatch-action-cell]'))return;
    const td=document.createElement('td');td.dataset.dispatchActionCell='1';td.innerHTML=`<div class="dispatchActionBtns"><button type="button" class="secondary smallBtn" data-dispatch-edit="${__dispatchEscapeV11(row.id||i)}">✏️ Modificar</button><button type="button" class="danger smallBtn" data-dispatch-delete="${__dispatchEscapeV11(row.id||i)}">🗑️ Eliminar</button></div>`;tr.appendChild(td);
  });
  body.querySelectorAll('[data-dispatch-edit]').forEach(b=>b.onclick=()=>editDispatchV11(b.dataset.dispatchEdit));
  body.querySelectorAll('[data-dispatch-delete]').forEach(b=>b.onclick=()=>deleteDispatchV11(b.dataset.dispatchDelete));
}
function closeDispatchModalV11(){document.getElementById('dispatchEditModalV11')?.remove()}
function editDispatchV11(id){
  const rows=Array.isArray(state.dispatchPlan)?state.dispatchPlan:[];
  const row=rows.find(x=>String(x.id)===String(id));
  if(!row){__dispatchToastV11('No se encontró el despacho.','err');return}
  closeDispatchModalV11();
  const clients=state.snapshot?.clients||[];
  const matchClient=(clients.find(c=>String(c.key)===String(row.clientKey||''))||clients.find(c=>normalize(c.rut||'')===normalize(row.rut||'')));
  const opts=clients.slice().sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||''),'es')).map(c=>`<option value="${__dispatchEscapeV11(c.key)}" ${matchClient&&String(c.key)===String(matchClient.key)?'selected':''}>${__dispatchEscapeV11(c.nombre||'')} · ${__dispatchEscapeV11(formatRut(c.rut||''))}</option>`).join('');
  const overlay=document.createElement('div');overlay.id='dispatchEditModalV11';overlay.className='dispatchModalOverlayV11';overlay.innerHTML=`<div class="dispatchModalV11" role="dialog" aria-modal="true"><div class="dispatchModalHeadV11"><div><div class="pill">✏️ MODIFICAR DESPACHO</div><h3>${__dispatchEscapeV11(row.cliente||'Cliente')}</h3><div class="note">Modificación segura sobre la línea existente.</div></div><button type="button" class="ghost" id="dispatchModalCloseV11">✕ Cerrar</button></div><div class="dispatchModalGridV11"><div class="full"><label>Cliente</label><select id="dmClientV11"><option value="">Mantener cliente actual</option>${opts}</select></div><div><label>Fecha</label><input id="dmDateV11" type="date" value="${__dispatchEscapeV11(row.fecha||'')}"></div><div><label>Destino</label><input id="dmDestV11" value="${__dispatchEscapeV11(row.destination||'')}"></div><div class="full"><label>Producto</label><input id="dmProductV11" value="${__dispatchEscapeV11(row.producto||'')}"></div><div><label>Formato</label><select id="dmFormatV11"><option ${row.formato==='Sacos 25 KG'?'selected':''}>Sacos 25 KG</option><option ${row.formato==='Sacos 10 KG'?'selected':''}>Sacos 10 KG</option><option ${row.formato==='Granel O/C'?'selected':''}>Granel O/C</option></select></div><div><label>Cantidad</label><input id="dmQtyV11" type="number" min="0" step="1" value="${__dispatchEscapeV11(row.cantidad??'')}"></div><div><label>KG</label><input id="dmKgV11" type="number" min="0" step="1" value="${__dispatchEscapeV11(row.kg??'')}"></div><div><label>Folio / referencia</label><input id="dmFolioV11" value="${__dispatchEscapeV11(row.folio||'')}"></div><div><label>O/C</label><input id="dmOcV11" value="${__dispatchEscapeV11(row.oc||'O/C PENDIENTE')}"></div><div class="full"><label>Observación</label><input id="dmObsV11" value="${__dispatchEscapeV11(row.observacion||'')}"></div></div><div class="dispatchModalActionsV11"><button type="button" class="ghost" id="dispatchModalCancelV11">Cancelar</button><button type="button" class="primary" id="dispatchModalSaveV11">💾 Guardar cambios</button></div></div>`;
  document.body.appendChild(overlay);
  const recalc=()=>{const w=__dispatchFormatWeightV11(document.getElementById('dmFormatV11')?.value),q=Number(document.getElementById('dmQtyV11')?.value||0)||0,k=document.getElementById('dmKgV11');if(k&&w>0){k.value=q?String(q*w):'';k.readOnly=true}else if(k){k.readOnly=false}};
  document.getElementById('dmFormatV11').onchange=recalc;document.getElementById('dmQtyV11').oninput=recalc;recalc();
  document.getElementById('dispatchModalCloseV11').onclick=closeDispatchModalV11;document.getElementById('dispatchModalCancelV11').onclick=closeDispatchModalV11;
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeDispatchModalV11()});
  document.getElementById('dispatchModalSaveV11').onclick=()=>{
    const ckey=document.getElementById('dmClientV11').value,client=clients.find(c=>String(c.key)===String(ckey));
    const formato=document.getElementById('dmFormatV11').value,cantidad=Number(document.getElementById('dmQtyV11').value||0)||0,kg0=Number(document.getElementById('dmKgV11').value||0)||0,w=__dispatchFormatWeightV11(formato),kg=w&&cantidad?cantidad*w:kg0;
    const product=document.getElementById('dmProductV11').value.trim(),date=document.getElementById('dmDateV11').value,dest=document.getElementById('dmDestV11').value.trim();
    if(!date||!product||!dest||(!cantidad&&!kg)){__dispatchToastV11('⚠️ Completa fecha, destino, producto y cantidad/KG.','warn');return}
    const next={...row,fecha:date,destination:dest,producto:product,formato,cantidad,kg,folio:document.getElementById('dmFolioV11').value.trim(),oc:(document.getElementById('dmOcV11').value.trim()||'O/C PENDIENTE'),observacion:document.getElementById('dmObsV11').value.trim(),updatedAt:Date.now()};
    if(client){next.clientKey=client.key;next.cliente=client.nombre||next.cliente;next.rut=formatRut(client.rut||next.rut||'')}
    const ix=rows.findIndex(x=>String(x.id)===String(id));if(ix<0){closeDispatchModalV11();return}
    rows[ix]=normalizeDispatchItem(next);state.dispatchPlan=rows;
    try{saveDispatchPlans()}catch(e){console.warn(e)}
    closeDispatchModalV11();__dispatchToastV11('✅ Despacho modificado correctamente.','ok');window.show('dispatches');
  };
}
function deleteDispatchV11(id){
  const rows=Array.isArray(state.dispatchPlan)?state.dispatchPlan:[];const ix=rows.findIndex(x=>String(x.id)===String(id));if(ix<0){__dispatchToastV11('No se encontró el despacho.','err');return}
  const row=rows[ix];if(!confirm(`¿Eliminar el despacho de ${row.cliente||'cliente sin nombre'} · ${row.producto||'producto'}?`))return;
  rows.splice(ix,1);state.dispatchPlan=rows;try{saveDispatchPlans()}catch(e){console.warn(e)}__dispatchToastV11('🗑️ Despacho eliminado.','ok');window.show('dispatches');
}
show=function(view){if(view==='dispatches'){const r=__dispatchBaseShowV11(view);setTimeout(enhanceDispatchUIV11,0);return r}return __dispatchGlobalShowV11(view)};
window.show=show;
