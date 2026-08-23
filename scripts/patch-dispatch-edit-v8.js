const fs=require('fs');
const path=require('path');
const file=path.join(process.cwd(),'app.js');
let src=fs.readFileSync(file,'utf8');

const tableStart=src.indexOf('function renderDispatchPlanTable(){');
const tableEnd=src.indexOf('window.deleteDispatchById=',tableStart);
if(tableStart<0||tableEnd<0)throw new Error('No se encontró la tabla de despachos V7.');

const tableFn=`function renderDispatchPlanTable(){
 const body=$('dispatchPlanBody');if(!body)return;
 const all=Array.isArray(state.dispatchPlan)?state.dispatchPlan:[];
 const from=$('weekFrom')?.value||'';
 const to=$('weekTo')?.value||'';
 const rows=all.map((r,i)=>({...r,_index:i})).filter(r=>(!from||!r.fecha||r.fecha>=from)&&(!to||!r.fecha||r.fecha<=to));
 const sumKg=rows.reduce((a,r)=>a+n(r.kg),0);
 const summary=$('dispatchPlanSummary');
 if(summary)summary.innerHTML='<span><b>'+rows.length+'</b> filas visibles</span><span><b>'+money(sumKg)+'</b> KG visibles</span><span><b>'+all.length+'</b> filas guardadas</span>';
 body.innerHTML=rows.map(r=>'<tr><td>'+esc(r.fecha||'')+'</td><td><strong>'+esc(r.cliente||'Sin cliente')+'</strong></td><td>'+esc(r.rut||'')+'</td><td class="dispatchDestinationCell">'+esc(r.destination||'')+'</td><td>'+esc(r.producto||'')+'</td><td><span class="dispatchFormatPill">'+esc(r.formato||'')+'</span></td><td class="num">'+money(r.cantidad)+'</td><td class="num"><b>'+money(r.kg)+'</b></td><td>'+esc(r.folio||'')+'</td><td>'+esc(r.oc||'O/C PENDIENTE')+'</td><td class="dispatchObsCell">'+esc(r.observacion||'')+'</td><td><div class="dispatchRowActions"><button class="dispatchEditBtn" type="button" data-dispatch-edit="'+esc(String(r.id||''))+'">✏️ <span>Modificar</span></button><button class="dispatchDeleteBtn" type="button" data-dispatch-delete="'+esc(String(r.id||''))+'">🗑️ <span>Eliminar</span></button></div></td></tr>').join('')||'<tr><td colspan="12"><div class="dispatchEmpty">No hay despachos guardados dentro del período seleccionado.</div></td></tr>';
 body.querySelectorAll('[data-dispatch-edit]').forEach(btn=>btn.addEventListener('click',()=>window.editDispatchById(btn.dataset.dispatchEdit)));
 body.querySelectorAll('[data-dispatch-delete]').forEach(btn=>btn.addEventListener('click',()=>window.deleteDispatchById(btn.dataset.dispatchDelete)));
}`;

src=src.slice(0,tableStart)+tableFn+'\n'+src.slice(tableEnd);

const close=src.lastIndexOf('\n})();');
if(close<0)throw new Error('No se encontró cierre IIFE principal.');

const injection=`
// DISPATCH_EDIT_V8_PRO
(function(){
 const EDIT_KEY='__dispatchEditingIdV8';
 function field(id){return $(id)}
 function clearEditFields(){
  ['dClientSearch','dClientKey','dRut','dDestination','dDate','dFolio','dOC','dProduct','dQty','dKg','dObs'].forEach(id=>{const el=field(id);if(el)el.value=''});
  const fmt=field('dFormat');if(fmt)fmt.value='Sacos 25 KG';
  const advice=field('dWeatherAdvice');if(advice){advice.className='dispatchWeatherAdvice dispatchWeatherIdle';advice.textContent='Selecciona un destino y presiona Evaluar clima.'}
  if(Array.isArray(state.dispatchDraftItems)){state.dispatchDraftItems=[];if(typeof renderDraftItems==='function')renderDraftItems()}
 }
 function exitEditMode(clear){
  window[EDIT_KEY]='';
  const btn=[...document.querySelectorAll('button')].find(b=>/Guardar (despacho|cambios)/i.test((b.textContent||'').trim()));
  if(btn)btn.textContent='✅ Guardar despacho';
  if(clear)clearEditFields();
 }
 window.editDispatchById=function(id){
  const key=String(id||'').trim();
  const row=Array.isArray(state.dispatchPlan)?state.dispatchPlan.find(r=>String(r.id||'')===key):null;
  if(!row){toast('No se pudo identificar el despacho.','err');return}
  window[EDIT_KEY]=key;
  const values={
   dClientSearch:row.cliente||'',dClientKey:row.rut||'',dRut:row.rut||'',dDestination:row.destination||'',dDate:row.fecha||'',dFolio:row.folio||'',dOC:row.oc||'O/C PENDIENTE',
   dProduct:row.producto||'',dFormat:row.formato||'Sacos 25 KG',dQty:row.cantidad??'',dKg:row.kg??'',dObs:row.observacion||''
  };
  Object.entries(values).forEach(([id,val])=>{const el=field(id);if(el)el.value=String(val)})
  const btn=[...document.querySelectorAll('button')].find(b=>/Guardar despacho/i.test((b.textContent||'')));
  if(btn)btn.textContent='💾 Guardar cambios';
  const card=document.querySelector('.dispatchFormCard');if(card)card.scrollIntoView({behavior:'smooth',block:'start'});
  const focus=field('dProduct');if(focus)focus.focus();
  toast('✏️ Editando el despacho seleccionado.','ok');
 };
 function collectEditedRow(old){
  const qty=Number(field('dQty')?.value||0);
  const kg=Number(field('dKg')?.value||0);
  return {...old,
   cliente:String(field('dClientSearch')?.value||old.cliente||'').trim(),
   rut:formatRut(field('dRut')?.value||old.rut||''),
   destination:String(field('dDestination')?.value||'').trim(),
   fecha:String(field('dDate')?.value||old.fecha||''),
   folio:String(field('dFolio')?.value||'').trim(),
   oc:String(field('dOC')?.value||'O/C PENDIENTE').trim()||'O/C PENDIENTE',
   producto:String(field('dProduct')?.value||'').trim(),
   formato:String(field('dFormat')?.value||old.formato||'Sacos 25 KG').trim(),
   cantidad:Number.isFinite(qty)?qty:0,
   kg:Number.isFinite(kg)?kg:0,
   observacion:String(field('dObs')?.value||'').trim()
  };
 }
 function setupSave(){
  const btn=[...document.querySelectorAll('button')].find(b=>/Guardar (despacho|cambios)/i.test((b.textContent||'').trim()));
  if(!btn||btn.dataset.dispatchEditBound==='1')return;
  const original=btn.onclick;
  btn.dataset.dispatchEditBound='1';
  btn.onclick=function(ev){
   const editId=String(window[EDIT_KEY]||'').trim();
   if(!editId){if(typeof original==='function')return original.call(this,ev);return true}
   const idx=state.dispatchPlan.findIndex(r=>String(r.id||'')===editId);
   if(idx<0){toast('El despacho ya no existe.','err');exitEditMode(true);return false}
   const old=state.dispatchPlan[idx];
   const edited=collectEditedRow(old);
   if(!edited.producto){toast('El producto es obligatorio.','err');return false}
   if(!edited.fecha){toast('La fecha de despacho es obligatoria.','err');return false}
   if(!(edited.kg>0)){toast('La cantidad en KG debe ser mayor que 0.','err');return false}
   state.dispatchPlan[idx]=edited;
   saveDispatchPlans();
   exitEditMode(true);
   renderDispatches();
   toast('✅ Despacho modificado correctamente.','ok');
   return false;
  };
 }
 const originalRender=renderDispatches;
 renderDispatches=function(){
  originalRender();
  const from=field('weekFrom'),to=field('weekTo');
  if(from&&to&&!window.__dispatchFilterTouchedV8){from.value='';to.value='';}
  if(from)from.addEventListener('change',()=>window.__dispatchFilterTouchedV8=true,{once:true});
  if(to)to.addEventListener('change',()=>window.__dispatchFilterTouchedV8=true,{once:true});
  renderDispatchPlanTable();
  setupSave();
 };
 document.addEventListener('click',ev=>{
  const el=ev.target?.closest?.('.dispatchDeleteBtn');
  if(!el)return;
  const id=el.dataset.dispatchDelete;
  if(id)window.deleteDispatchById(id);
 });
})();
`;

const style=`
(function(){if(document.getElementById('dispatch-edit-v8'))return;const s=document.createElement('style');s.id='dispatch-edit-v8';s.textContent='.dispatchRowActions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.dispatchEditBtn{background:#eef6ff;color:#174b91;border:1px solid #bfd7ef;border-radius:10px;padding:7px 9px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap}.dispatchEditBtn:hover{background:#e2efff}@media(max-width:650px){.dispatchEditBtn span,.dispatchDeleteBtn span{display:none}}';document.head.appendChild(s)})();
`;

src=src.slice(0,close)+injection+style+'\n'+src.slice(close);
fs.writeFileSync(file,src);
console.log('DISPATCH EDIT V8 APPLIED');
`;
