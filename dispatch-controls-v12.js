(()=>{
'use strict';
const BR=()=>window.MolinoDispatchBridge||null;
const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const fmt=v=>Number(v||0).toLocaleString('es-CL',{maximumFractionDigits:2});
function weightFor(format){const s=String(format||'').toUpperCase();if(/25\s*KG/.test(s))return 25;if(/10\s*KG/.test(s))return 10;return 0}
function toast(msg){if(typeof window.toast==='function')window.toast(msg,'ok');else{const x=document.createElement('div');x.textContent=msg;x.style.cssText='position:fixed;right:18px;bottom:18px;z-index:30000;background:#123a78;color:#fff;padding:12px 16px;border-radius:12px;font-weight:800;box-shadow:0 12px 30px rgba(0,0,0,.22)';document.body.appendChild(x);setTimeout(()=>x.remove(),2600)}}
function bridgeState(){return BR()?.state||null}
function enhance(){
 const st=bridgeState();if(!st)return;
 const cards=[...document.querySelectorAll('#content .card')];
 const host=cards.find(c=>/Planilla semanal/i.test(c.textContent||''));
 if(!host)return;
 host.classList.add('dispatchEnhancedV12');
 const table=host.querySelector('table');if(!table)return;
 const head=table.querySelector('thead tr'),body=table.querySelector('tbody');if(!head||!body)return;
 if(!head.querySelector('[data-dispatch-actions]')){const th=document.createElement('th');th.textContent='Acciones';th.dataset.dispatchActions='1';head.appendChild(th)}
 const rows=Array.isArray(st.dispatchPlan)?st.dispatchPlan:[];
 [...body.querySelectorAll('tr')].forEach((tr,i)=>{
  const row=rows[i];if(!row||tr.querySelector('[data-dispatch-row-actions]'))return;
  const td=document.createElement('td');td.dataset.dispatchRowActions='1';td.innerHTML=`<div class="dispatchV12Btns"><button class="secondary smallBtn" type="button" data-dv12-edit="${esc(row.id||i)}">✏️ Modificar</button><button class="danger smallBtn" type="button" data-dv12-delete="${esc(row.id||i)}">🗑️ Eliminar</button></div>`;tr.appendChild(td)
 });
 body.querySelectorAll('[data-dv12-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.dv12Edit));
 body.querySelectorAll('[data-dv12-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.dv12Delete));
}
function closeModal(){document.getElementById('dispatchV12Modal')?.remove()}
function findClient(clients,row){return clients.find(c=>String(c.key)===String(row.clientKey||''))||clients.find(c=>String(c.rut||'').replace(/[^0-9kK]/g,'').toUpperCase()===String(row.rut||'').replace(/[^0-9kK]/g,'').toUpperCase())||null}
function edit(id){
 const st=bridgeState();if(!st)return;const rows=Array.isArray(st.dispatchPlan)?st.dispatchPlan:[];const row=rows.find(x=>String(x.id)===String(id));if(!row)return;
 const clients=st.snapshot?.clients||[];const current=findClient(clients,row);
 const opts=clients.slice().sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||''),'es')).map(c=>`<option value="${esc(c.key)}" ${current&&String(c.key)===String(current.key)?'selected':''}>${esc(c.nombre||'')} · ${esc(c.rut||'')}</option>`).join('');
 const modal=document.createElement('div');modal.id='dispatchV12Modal';modal.className='dispatchV12Overlay';modal.innerHTML=`<div class="dispatchV12Modal" role="dialog" aria-modal="true"><div class="dispatchV12Head"><div><span class="pill">✏️ MODIFICAR DESPACHO</span><h3>${esc(row.cliente||'Cliente')}</h3><div class="note">Los KG se recalculan para Sacos 25 KG y Sacos 10 KG.</div></div><button type="button" class="ghost" id="dv12Close">✕</button></div><div class="dispatchV12Grid"><div class="full"><label>Cliente</label><select id="dv12Client"><option value="">Mantener cliente actual</option>${opts}</select></div><div><label>Fecha</label><input id="dv12Date" type="date" value="${esc(row.fecha||'')}"></div><div><label>Destino</label><input id="dv12Dest" value="${esc(row.destination||'')}"></div><div class="full"><label>Producto</label><input id="dv12Product" value="${esc(row.producto||'')}"></div><div><label>Formato</label><select id="dv12Format"><option value="Sacos 25 KG" ${row.formato==='Sacos 25 KG'?'selected':''}>Sacos 25 KG</option><option value="Sacos 10 KG" ${row.formato==='Sacos 10 KG'?'selected':''}>Sacos 10 KG</option><option value="Granel O/C" ${row.formato==='Granel O/C'?'selected':''}>Granel O/C</option></select></div><div><label>Cantidad</label><input id="dv12Qty" type="number" min="0" step="1" value="${esc(row.cantidad??'')}"></div><div><label>KG</label><input id="dv12Kg" type="number" min="0" step="1" value="${esc(row.kg??'')}"></div><div><label>Folio</label><input id="dv12Folio" value="${esc(row.folio||'')}"></div><div><label>O/C</label><input id="dv12OC" value="${esc(row.oc||'O/C PENDIENTE')}"></div><div class="full"><label>Observación</label><input id="dv12Obs" value="${esc(row.observacion||'')}"></div></div><div class="dispatchV12Actions"><button class="ghost" type="button" id="dv12Cancel">Cancelar</button><button class="primary" type="button" id="dv12Save">💾 Guardar cambios</button></div></div>`;
 document.body.appendChild(modal);
 const recalc=()=>{const f=document.getElementById('dv12Format').value,w=weightFor(f),q=Number(document.getElementById('dv12Qty').value||0)||0,k=document.getElementById('dv12Kg');if(w>0){k.readOnly=true;k.value=q?String(q*w):''}else k.readOnly=false};
 document.getElementById('dv12Format').onchange=recalc;document.getElementById('dv12Qty').oninput=recalc;recalc();
 document.getElementById('dv12Close').onclick=closeModal;document.getElementById('dv12Cancel').onclick=closeModal;modal.onclick=e=>{if(e.target===modal)closeModal()};
 document.getElementById('dv12Save').onclick=()=>{
  const ckey=document.getElementById('dv12Client').value,c=clients.find(x=>String(x.key)===String(ckey));
  const format=document.getElementById('dv12Format').value,qty=Number(document.getElementById('dv12Qty').value||0)||0,k0=Number(document.getElementById('dv12Kg').value||0)||0,w=weightFor(format),kg=w&&qty?qty*w:k0;
  const next={...row,fecha:document.getElementById('dv12Date').value,destination:document.getElementById('dv12Dest').value.trim(),producto:document.getElementById('dv12Product').value.trim(),formato:format,cantidad:qty,kg,folio:document.getElementById('dv12Folio').value.trim(),oc:document.getElementById('dv12OC').value.trim()||'O/C PENDIENTE',observacion:document.getElementById('dv12Obs').value.trim(),updatedAt:Date.now()};
  if(c){next.clientKey=c.key;next.cliente=c.nombre||next.cliente;next.rut=c.rut||next.rut}
  if(!next.fecha||!next.destination||!next.producto||(!qty&&!kg)){alert('Completa fecha, destino, producto y cantidad/KG.');return}
  const ix=rows.findIndex(x=>String(x.id)===String(id));if(ix<0)return;rows[ix]=BR().normalize?BR().normalize(next):next;st.dispatchPlan=rows;try{BR().save()}catch(e){console.warn(e)}closeModal();toast('✅ Despacho modificado correctamente.');BR().show('dispatches');setTimeout(enhance,80);
 };
}
function remove(id){const st=bridgeState();if(!st)return;const rows=Array.isArray(st.dispatchPlan)?st.dispatchPlan:[],ix=rows.findIndex(x=>String(x.id)===String(id));if(ix<0)return;const row=rows[ix];if(!confirm(`¿Eliminar el despacho de ${row.cliente||'cliente sin nombre'} · ${row.producto||'producto'}?`))return;rows.splice(ix,1);st.dispatchPlan=rows;try{BR().save()}catch(e){console.warn(e)}toast('🗑️ Despacho eliminado.');BR().show('dispatches');setTimeout(enhance,80)}
function intercept(){
 const br=BR();if(!br)return;
 if(!window.__dispatchV12Wrapped){
  const original=window.show;
  window.show=function(view){const result=view==='dispatches'?br.show(view):original(view);if(view==='dispatches')setTimeout(enhance,60);return result};
  window.__dispatchV12Wrapped=true;
 }
 document.removeEventListener('click',window.__dispatchV12Capture,true);
 window.__dispatchV12Capture=e=>{const b=e.target?.closest?.('[data-view="dispatches"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();br.show('dispatches');setTimeout(enhance,60)};
 document.addEventListener('click',window.__dispatchV12Capture,true);
 if(document.getElementById('content'))enhance();
}
const css=document.createElement('style');css.textContent=`.dispatchEnhancedV12 .tableWrap{max-height:none!important;overflow-x:auto!important;overflow-y:visible!important}.dispatchEnhancedV12 .table{min-width:1240px}.dispatchV12Btns{display:flex;gap:6px;flex-wrap:nowrap}.dispatchV12Overlay{position:fixed;inset:0;z-index:25000;background:rgba(9,31,61,.48);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px}.dispatchV12Modal{width:min(760px,96vw);max-height:92vh;overflow:auto;background:#fff;border:1px solid #d8e2ee;border-radius:18px;box-shadow:0 24px 80px rgba(8,32,63,.28);padding:20px}.dispatchV12Head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding-bottom:12px;border-bottom:1px solid #e5ebf2}.dispatchV12Head h3{margin:7px 0 2px;color:#123a78}.dispatchV12Grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}.dispatchV12Grid .full{grid-column:1/-1}.dispatchV12Actions{display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #e5ebf2;padding-top:12px;margin-top:16px}@media(max-width:680px){.dispatchV12Grid{grid-template-columns:1fr}.dispatchV12Grid .full{grid-column:auto}.dispatchV12Actions{flex-direction:column}.dispatchV12Actions button{width:100%}}`;document.head.appendChild(css);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',intercept);else intercept();
})();
