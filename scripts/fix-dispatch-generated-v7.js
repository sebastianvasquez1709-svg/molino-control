const fs=require('fs');
const path=require('path');
const file=path.join(process.cwd(),'app.js');
let src=fs.readFileSync(file,'utf8');
const renderStart=src.indexOf('function renderDispatches(){');
if(renderStart<0)throw new Error('renderDispatches no encontrado.');
const init="\n if(!Array.isArray(state.dispatchPlan)||!state.dispatchPlan.length)state.dispatchPlan=dispatchPlans();";
if(!src.includes('state.dispatchPlan=dispatchPlans();',renderStart)){
 const p=renderStart+'function renderDispatches(){'.length;
 src=src.slice(0,p)+init+src.slice(p);
}
const tableStart=src.indexOf(' body.innerHTML=rows.map(r=>');
if(tableStart<0)throw new Error('Tabla de despachos no encontrada.');
const tableEnd=src.indexOf('\n}',tableStart);
if(tableEnd<0)throw new Error('Fin de tabla no encontrado.');
const replacement=` body.innerHTML=rows.map(r=>'<tr><td>'+esc(r.fecha||'')+'</td><td><strong>'+esc(r.cliente||'Sin cliente')+'</strong></td><td>'+esc(r.rut||'')+'</td><td>'+esc(r.destination||'')+'</td><td>'+esc(r.producto||'')+'</td><td>'+esc(r.formato||'')+'</td><td class="num">'+money(r.cantidad)+'</td><td class="num"><b>'+money(r.kg)+'</b></td><td>'+esc(r.folio||'')+'</td><td>'+esc(r.oc||'O/C PENDIENTE')+'</td><td>'+esc(r.observacion||'')+'</td><td><button class="dispatchDeleteBtn" type="button" data-dispatch-delete="'+esc(String(r.id||''))+'" title="Eliminar únicamente esta fila">🗑️ <span>Eliminar</span></button></td></tr>').join('')||'<tr><td colspan="12"><div class="dispatchEmpty">No hay despachos dentro del período seleccionado.</div></td></tr>';
 body.querySelectorAll('[data-dispatch-delete]').forEach(btn=>btn.addEventListener('click',()=>window.deleteDispatchById(btn.dataset.dispatchDelete)));`;
src=src.slice(0,tableStart)+replacement+src.slice(tableEnd);
fs.writeFileSync(file,src);
console.log('DISPATCH GENERATED V7 FIX APPLIED');
