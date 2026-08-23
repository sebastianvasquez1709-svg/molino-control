const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'app.js');
let src = fs.readFileSync(file, 'utf8');
const marker = '// DISPATCH_UX_V4_PRO';

// Replace the legacy dispatch renderer with a more usable, visual and safe module.
const renderStart = src.indexOf('function renderDispatches(){');
const renderEnd = src.indexOf('\nfunction renderGuides(){', renderStart);
if (renderStart < 0 || renderEnd < 0) throw new Error('No se encontró renderDispatches/renderGuides.');

const replacement = String.raw`function renderDispatches(){
 if(!state.dispatchPlan.length)state.dispatchPlan=dispatchPlans();
 const products=productOptions();
 const clients=state.snapshot?.clients||[];
 const m=state.snapshot?.metrics||emptySnap().metrics;
 const g=m.granel,s=m.sacos;
 const totalKg=state.dispatchPlan.reduce((a,r)=>a+n(r.kg),0);
 const totalLines=state.dispatchPlan.length;
 const uniqueClients=new Set(state.dispatchPlan.map(r=>normalizeName(r.cliente||r.rut||'')).filter(Boolean)).size;
 $('content').innerHTML=`
 <section class="dispatchProHero">
   <div class="dispatchHeroBrand">
     <img src="/logo molino.jpg" alt="Molinos San Miguel" class="dispatchHeroLogo">
     <div><div class="dispatchEyebrow">MOLINOS SAN MIGUEL LTDA</div><h1>Despachos</h1><p>Planificación, control y seguimiento de repartos.</p></div>
   </div>
   <div class="dispatchHeroActions">
     <button class="dispatchBtn dispatchBtnLight" type="button" onclick="printDispatchPlan()">🖨️ Imprimir</button>
     <button class="dispatchBtn dispatchBtnSoft" type="button" onclick="downloadDispatchPlanHtml()">⬇️ Descargar</button>
     <a class="dispatchBtn dispatchBtnLight dispatchLink" href="/planilla_despachos_molino_control.docx" download>📄 Word</a>
   </div>
 </section>

 <div class="dispatchKpis">
   <div class="dispatchKpi"><span>Líneas planificadas</span><b>${totalLines}</b><small>Despachos individuales</small></div>
   <div class="dispatchKpi"><span>KG planificados</span><b>${money(totalKg)}</b><small>Según cantidad/formato</small></div>
   <div class="dispatchKpi"><span>Clientes activos</span><b>${uniqueClients}</b><small>En esta planilla</small></div>
   <div class="dispatchKpi"><span>Productos</span><b>${products.length}</b><small>Catálogo disponible</small></div>
 </div>

 <section class="dispatchCard dispatchFormCard">
   <div class="dispatchCardHead"><div><div class="dispatchEyebrow dispatchBlue">NUEVO DESPACHO</div><h2>Crear orden de despacho</h2><p>Completa los datos, agrega uno o varios productos y guarda la orden.</p></div><span class="dispatchCount">${totalLines} registros</span></div>
   <div class="dispatchForm">
     <div class="autocomplete"><label>Cliente</label><input id="dClientSearch" type="text" autocomplete="off" placeholder="Buscar por nombre…"><input id="dClientKey" type="hidden"><div id="clientSuggestions" class="suggestions hidden"></div></div>
     <div><label>RUT</label><input id="dRut" type="text" inputmode="numeric" maxlength="15" autocomplete="off" list="rutList" placeholder="18.446.726-7"><datalist id="rutList">${clients.slice(0,2000).map(c=>`<option value="${esc(formatRut(c.rut||''))}">${esc(c.nombre||'')}</option>`).join('')}</datalist></div>
     <div class="dispatchFieldWide"><label>Destino / dirección</label><input id="dDestination" list="destinationList" placeholder="Dirección o destino de entrega"><datalist id="destinationList"></datalist><small class="dispatchHelp">Se completa desde la ficha del cliente cuando existe.</small></div>
     <div><label>Fecha de despacho</label><input id="dDate" type="date"></div>
     <div><label>Folio / referencia</label><input id="dFolio" placeholder="Opcional"></div>
     <div><label>O/C</label><input id="dOC" type="text" autocomplete="off" placeholder="Ej. O/C 12345" value="O/C PENDIENTE"></div>
     <div class="dispatchFieldWide"><label>Producto</label><input id="dProduct" list="productList" placeholder="Buscar producto…"><datalist id="productList">${products.map(p=>`<option value="${esc(p)}"></option>`).join('')}</datalist></div>
     <div><label>Formato</label><select id="dFormat"><option value="Sacos 25 KG">Sacos 25 KG</option><option value="Sacos 10 KG">Sacos 10 KG</option><option value="Granel O/C">Granel O/C</option></select></div>
     <div><label>Cantidad</label><input id="dQty" type="number" min="0" step="1" placeholder="Sacos / unidades"></div>
     <div><label>KG</label><input id="dKg" type="number" min="0" step="1" placeholder="Kilogramos"></div>
     <div><label>Observación</label><input id="dObs" placeholder="Opcional"></div>
     <div class="dispatchFieldWide"><label>Clima del destino</label>
       <div class="dispatchWeatherInline"><div id="dWeatherAdvice" class="dispatchWeatherAdvice dispatchWeatherIdle">Selecciona un destino y evalúa las condiciones antes de programar.</div><button class="dispatchBtn dispatchBtnWeather" type="button" id="dWeatherCheck">🌦️ Evaluar clima</button></div>
     </div>
     <div class="dispatchFieldWide dispatchFormActions"><button class="dispatchBtn dispatchBtnGhost" type="button" onclick="addDraftItem()">➕ Agregar producto</button><button class="dispatchBtn dispatchBtnPrimary" type="button" onclick="saveDispatch()">✅ Guardar despacho</button><button class="dispatchBtn dispatchBtnGhost" type="button" onclick="clearDispatchForm()">↺ Limpiar</button></div>
   </div>
   <div class="dispatchDraftWrap"><div class="dispatchSubHead"><div><strong>Productos del despacho</strong><span> Puedes combinar formatos dentro de una misma orden.</span></div><span class="dispatchMiniHint">Sacos 25 KG / 10 KG / Granel O/C</span></div><div class="tableWrap"><table class="table dispatchDraftTable"><thead><tr><th>Producto</th><th>Formato</th><th>Cantidad</th><th>KG</th><th>Observación</th><th></th></tr></thead><tbody id="draftItems"></tbody></table></div></div>
 </section>

 <section class="dispatchCard">
   <div class="dispatchCardHead dispatchPlanHead"><div><div class="dispatchEyebrow dispatchBlue">PLANIFICACIÓN</div><h2>Planilla semanal</h2><p>Filtra el período y trabaja directamente sobre los registros.</p></div><div class="dispatchDates"><label>Desde<input id="weekFrom" type="date"></label><label>Hasta<input id="weekTo" type="date"></label></div></div>
   <div class="dispatchToolbar"><button class="dispatchBtn dispatchBtnPrimary" type="button" onclick="printDispatchPlan()">🖨️ Imprimir / PDF</button><button class="dispatchBtn dispatchBtnSoft" type="button" onclick="downloadDispatchPlanHtml()">⬇️ Descargar planilla</button></div>
   <div class="dispatchNotice">💡 Para corregir un error, elimina <b>solo la línea correspondiente</b> con el botón 🗑️. El resto de los despachos queda intacto.</div>
   <div class="tableWrap dispatchPlanTableWrap"><table class="table dispatchPlanTable"><thead><tr><th>Fecha</th><th>Cliente</th><th>RUT</th><th>Destino</th><th>Producto</th><th>Formato</th><th>Cantidad</th><th>KG</th><th>Folio</th><th>O/C</th><th>Observación</th><th>Acción</th></tr></thead><tbody id="dispatchPlanBody"></tbody></table></div>
   <div class="dispatchFooterNote">Los registros se almacenan localmente para el módulo de planificación y no se eliminan en bloque.</div>
 </section>`;
 setupDispatchClientAutocomplete(clients);
 $('dQty').oninput=updateDispatchKgFromQty;
 $('dFormat').onchange=updateDispatchKgFromQty;
 updateDispatchKgFromQty();
 $('dRut').oninput=()=>{const v=$('dRut').value;const c=findClientByRut(v);if(c){selectDispatchClient(c)}else if(!v){$('dClientSearch').value='';$('dClientKey').value=''}};
 $('dRut').onblur=()=>{$('dRut').value=formatRut($('dRut').value);const c=findClientByRut($('dRut').value);if(c)selectDispatchClient(c)};
 $('dWeatherCheck').onclick=()=>checkDispatchWeather();
 $('weekFrom').value=new Date().toISOString().slice(0,10);
 const end=new Date();end.setDate(end.getDate()+6);$('weekTo').value=end.toISOString().slice(0,10);
 renderDraftItems();
 renderDispatchPlanTable();
}`;

src = src.slice(0,renderStart)+replacement+src.slice(renderEnd);

const close=src.lastIndexOf('\n})();');
if(close<0)throw new Error('No se encontró cierre de IIFE principal.');
if(!src.includes(marker)){
 const injection=String.raw`

${marker}
function renderDispatchPlanTable(){
 const body=$('dispatchPlanBody'); if(!body)return;
 const rows=Array.isArray(state.dispatchPlan)?state.dispatchPlan:[];
 body.innerHTML=rows.map((r,i)=>`<tr>
   <td>${esc(r.fecha||'')}</td><td><strong>${esc(r.cliente||'Sin cliente')}</strong></td><td>${esc(r.rut||'')}</td><td>${esc(r.destination||'')}</td><td>${esc(r.producto||'')}</td><td><span class="dispatchFormatPill">${esc(r.formato||'')}</span></td><td class="num">${money(r.cantidad)}</td><td class="num">${money(r.kg)}</td><td>${esc(r.folio||'')}</td><td>${esc(r.oc||'O/C PENDIENTE')}</td><td>${esc(r.observacion||'')}</td><td><button class="dispatchDeleteBtn" type="button" data-dispatch-delete="${esc(String(r.id||''))}" title="Eliminar solo este despacho">🗑️ <span>Eliminar</span></button></td>
 </tr>`).join('')||'<tr><td colspan="12"><div class="dispatchEmpty">No hay despachos registrados en la planilla.</div></td></tr>';
 body.querySelectorAll('[data-dispatch-delete]').forEach(btn=>btn.addEventListener('click',()=>window.deleteDispatchById(btn.dataset.dispatchDelete)));
}
window.deleteDispatchById=(id)=>{
 const key=String(id||'').trim();
 if(!key){toast('No se pudo identificar el despacho.','err');return}
 const idx=state.dispatchPlan.findIndex(r=>String(r.id)===key);
 if(idx<0){toast('El despacho ya no existe en la planilla.','warn');return}
 const row=state.dispatchPlan[idx];
 const label=[row.fecha,row.cliente,row.producto,row.kg?money(row.kg)+' KG':''].filter(Boolean).join(' · ');
 if(!window.confirm('¿Eliminar SOLO este despacho?\\n\\n'+label+'\\n\\nLos demás registros no se modificarán.'))return;
 state.dispatchPlan.splice(idx,1);
 saveDispatchPlans();
 renderDispatches();
 toast('🗑️ Despacho eliminado. Los demás registros se conservaron.','ok');
};
window.checkDispatchWeather=async()=>{
 const advice=$('dWeatherAdvice');
 if(!advice)return;
 const destination=String($('dDestination')?.value||'').trim();
 const rut=String($('dRut')?.value||'').trim();
 const client=findClientByRut(rut)||((state.snapshot?.clients||[]).find(c=>c.key===($('dClientKey')?.value||''))||null);
 const contact=client?clientContact(client):{};
 const query=String(contact.comuna||contact.ciudad||destination||'').trim();
 if(query.length<3){advice.className='dispatchWeatherAdvice dispatchWeatherWarn';advice.innerHTML='⚠️ Primero selecciona un cliente o completa una comuna/destino.';return}
 advice.className='dispatchWeatherAdvice dispatchWeatherLoading';advice.innerHTML='⏳ Consultando clima del destino…';
 try{
  const loc=await geocodeDestination(query);
  const data=await fetchWeatherLocation(loc);
  const current=data.current||{}; const daily=data.daily||{};
  const advisory=advisoryFromWeather(data,'sacos');
  const days=(daily.time||[]).slice(0,3).map((t,i)=>`<div class="dispatchForecastMini"><b>${new Date(t+'T12:00:00').toLocaleDateString('es-CL',{weekday:'short'})}</b><span>${Math.round(Number(daily.temperature_2m_max?.[i]||0))}° / ${Math.round(Number(daily.temperature_2m_min?.[i]||0))}°</span><small>${Math.round(Number(daily.precipitation_probability_max?.[i]||0))}% lluvia</small></div>`).join('');
  advice.className='dispatchWeatherAdvice dispatchWeatherReady';
  advice.innerHTML=`<div class="dispatchWeatherTop"><div><strong>${weatherIcon(current.weather_code)} ${esc(loc.name)}</strong><small>${esc(loc.region||'')} · ${esc(weatherLabel(current.weather_code))}</small></div><b>${Math.round(Number(current.temperature_2m||0))}°C</b></div><div class="dispatchWeatherMetrics">💨 ${Math.round(Number(current.wind_speed_10m||0))} km/h · ráfagas ${Math.round(Number(current.wind_gusts_10m||0))} km/h · 💧 ${Math.round(Number(current.relative_humidity_2m||0))}% · 🌧️ ${Number(current.precipitation||0).toFixed(1)} mm</div><div class="dispatchForecastRow">${days}</div><div class="dispatchWeatherAlert ${advisory.kind}">${esc(advisory.title)}<small>${esc(advisory.detail)}</small></div>`;
 }catch(e){advice.className='dispatchWeatherAdvice dispatchWeatherError';advice.innerHTML='❌ '+esc(e?.message||'No se pudo consultar el clima del destino.');}
};
(function installDispatchUxStyles(){
 if(document.getElementById('dispatch-ux-v4'))return;
 const s=document.createElement('style');s.id='dispatch-ux-v4';s.textContent=`
 .dispatchProHero{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:24px 26px;border-radius:20px;background:linear-gradient(135deg,#0d356f 0%,#1e5aa5 100%);color:#fff;box-shadow:0 16px 42px rgba(13,53,111,.16);margin-bottom:14px}.dispatchHeroBrand{display:flex;align-items:center;gap:15px;min-width:0}.dispatchHeroLogo{width:58px;height:58px;object-fit:contain;background:#fff;border-radius:13px;padding:5px}.dispatchEyebrow{font-size:10px;font-weight:900;letter-spacing:.14em;opacity:.78}.dispatchBlue{color:#174b91;opacity:1}.dispatchProHero h1{margin:3px 0 4px;font-size:30px;letter-spacing:-.5px}.dispatchProHero p{margin:0;color:rgba(255,255,255,.82)}.dispatchHeroActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.dispatchBtn{border-radius:11px;padding:10px 14px;font-weight:800;font-size:12px;display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid transparent;cursor:pointer;text-decoration:none;transition:.16s ease;white-space:nowrap}.dispatchBtn:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(15,53,109,.12)}.dispatchBtnPrimary{background:linear-gradient(135deg,#103a76,#1d5ca8);color:#fff}.dispatchBtnSoft{background:#edf4fc;border-color:#d7e4f4;color:#174b91}.dispatchBtnLight{background:#fff;color:#123a78}.dispatchBtnGhost{background:#fff;border-color:#cbd8e7;color:#344054}.dispatchBtnWeather{background:#eff8f2;border-color:#bde1c8;color:#137333}.dispatchLink{box-sizing:border-box}.dispatchKpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}.dispatchKpi{background:#fff;border:1px solid #dce6f0;border-radius:15px;padding:16px;box-shadow:0 6px 18px rgba(15,53,109,.045)}.dispatchKpi span,.dispatchKpi small{display:block;color:#667085}.dispatchKpi b{display:block;margin:3px 0;font-size:24px;color:#123a78}.dispatchCard{background:#fff;border:1px solid #dce6f0;border-radius:18px;padding:20px;box-shadow:0 6px 20px rgba(15,53,109,.045);margin-top:14px}.dispatchFormCard{margin-top:0}.dispatchCardHead{display:flex;justify-content:space-between;align-items:flex-start;gap:15px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid #e7edf5}.dispatchCardHead h2{margin:4px 0;font-size:19px;color:#163e78}.dispatchCardHead p{margin:0;color:#667085}.dispatchCount{padding:6px 10px;border-radius:999px;background:#edf4fc;color:#174b91;font-size:11px;font-weight:800}.dispatchForm{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px}.dispatchForm label{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#475467;margin-bottom:6px}.dispatchFieldWide{grid-column:1/-1}.dispatchForm input,.dispatchForm select{min-height:43px}.dispatchHelp{display:block;margin-top:5px;color:#7b8794;font-size:11px}.dispatchFormActions{display:flex;gap:8px;flex-wrap:wrap;padding-top:2px}.dispatchWeatherInline{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:stretch}.dispatchWeatherAdvice{min-height:43px;border:1px solid #dbe5f0;border-radius:11px;padding:9px 11px;background:#f8fafc;font-size:11px}.dispatchWeatherIdle{color:#667085}.dispatchWeatherLoading{background:#f5f8fc;color:#475467}.dispatchWeatherWarn{background:#fff8eb;color:#9a6700;border-color:#f3dfae}.dispatchWeatherError{background:#fff1f1;color:#b42318;border-color:#efc0c0}.dispatchWeatherReady{background:#f7fbf8;border-color:#cbe7d3;color:#173d28}.dispatchWeatherTop{display:flex;justify-content:space-between;gap:12px}.dispatchWeatherTop strong{display:block;color:#174b91;font-size:12px}.dispatchWeatherTop small{display:block;color:#667085;margin-top:2px}.dispatchWeatherTop>b{font-size:20px;color:#123a78}.dispatchWeatherMetrics{margin-top:6px;color:#475467}.dispatchForecastRow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:7px}.dispatchForecastMini{background:#fff;border:1px solid #e4eaf1;border-radius:8px;padding:6px;text-align:center}.dispatchForecastMini b,.dispatchForecastMini span,.dispatchForecastMini small{display:block}.dispatchForecastMini small{color:#667085}.dispatchWeatherAlert{margin-top:7px;padding:7px 8px;border-radius:8px;font-weight:800}.dispatchWeatherAlert.ok{background:#e9f8ef;color:#137333}.dispatchWeatherAlert.warn{background:#fff4d6;color:#9a6700}.dispatchWeatherAlert.bad{background:#fff1f1;color:#b42318}.dispatchWeatherAlert small{display:block;margin-top:3px;font-weight:500}.dispatchDraftWrap{margin-top:16px}.dispatchSubHead{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px;color:#344054}.dispatchSubHead span{color:#667085;font-size:11px}.dispatchMiniHint{font-size:10px!important;padding:5px 8px;background:#f2f5f8;border-radius:999px}.dispatchDraftTable td,.dispatchPlanTable td{vertical-align:middle}.dispatchFormatPill{display:inline-flex;padding:4px 7px;border-radius:999px;background:#eef4fb;color:#174b91;font-weight:800;font-size:10px}.dispatchPlanHead{align-items:center}.dispatchDates{display:flex;gap:8px;flex-wrap:wrap}.dispatchDates label{font-size:10px;color:#667085}.dispatchDates input{display:block;margin-top:4px;min-height:39px}.dispatchToolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.dispatchNotice{padding:10px 12px;border:1px solid #dbe8f5;border-radius:10px;background:#f7fbff;color:#42526b;font-size:11px;margin-bottom:10px}.dispatchDeleteBtn{display:inline-flex;align-items:center;gap:5px;border:1px solid #efcccc;background:#fff4f4;color:#b42318;border-radius:9px;padding:6px 8px;font-size:10px;font-weight:800;cursor:pointer}.dispatchDeleteBtn:hover{background:#ffe9e9}.dispatchEmpty{text-align:center;padding:28px;color:#667085}.dispatchFooterNote{margin-top:9px;color:#7b8794;font-size:11px}.dispatchProHero + .dispatchKpis{margin-top:2px}
 @media(max-width:1100px){.dispatchForm{grid-template-columns:repeat(2,minmax(0,1fr))}.dispatchKpis{grid-template-columns:repeat(2,minmax(0,1fr))}.dispatchProHero{flex-direction:column;align-items:flex-start}.dispatchHeroActions{justify-content:flex-start}.dispatchDates{width:100%}}
 @media(max-width:720px){.dispatchForm{grid-template-columns:1fr}.dispatchFieldWide{grid-column:auto}.dispatchKpis{grid-template-columns:1fr}.dispatchWeatherInline{grid-template-columns:1fr}.dispatchBtn{width:100%}.dispatchHeroActions{width:100%}.dispatchCard{padding:15px}.dispatchCardHead{flex-direction:column}.dispatchPlanHead{align-items:flex-start}.dispatchDates label,.dispatchDates input{width:100%}.dispatchForecastRow{grid-template-columns:1fr 1fr 1fr}.dispatchPlanTableWrap{max-height:620px}}
 `;document.head.appendChild(s);
})();
`;
 src=src.slice(0,close)+injection+src.slice(close);
}

fs.writeFileSync(file,src);
console.log('Dispatch UX V4 applied.');
