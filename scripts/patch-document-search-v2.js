const fs=require('fs');
const path=require('path');
const file=path.join(process.cwd(),'app.js');
let src=fs.readFileSync(file,'utf8');
const close=src.lastIndexOf('\n})();');
if(close<0)throw new Error('No se encontró cierre IIFE.');
const injection=String.raw`
// DOCUMENT_SEARCH_V2
(function(){
  const num=v=>Number(v||0);
  const text=v=>String(v??'').trim();
  const norm=v=>text(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const isoDate=v=>{const s=text(v);if(!s)return '';if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);const d=new Date(s);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10)};
  const today=()=>{const d=new Date();return d.toISOString().slice(0,10)};
  const monthStart=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01'};
  const fmtRut=v=>typeof formatRut==='function'?formatRut(v):text(v);
  const money0=v=>'$ '+money(num(v));
  const stateKey={invoices:{q:'',from:'',to:'',status:'',sort:'dateDesc'},boletas:{q:'',from:'',to:'',sort:'dateDesc'},guides:{q:'',from:'',to:'',status:'',operation:'',sort:'dateDesc'}};
  function criteria(kind){return state.__docFiltersV2&&state.__docFiltersV2[kind]?state.__docFiltersV2[kind]:stateKey[kind]}
  function setCriteria(kind,patch){state.__docFiltersV2=state.__docFiltersV2||{};state.__docFiltersV2[kind]={...criteria(kind),...patch}}
  function matchesCommon(r,f,extra){
    const q=norm(f.q); if(q){const blob=norm([r.folio,r.cliente,r.rut,r.receptor,r.estado,r.operacion,r.ref,r.fuente,(r.items||[]).map(x=>[x.producto,x.detalle].join(' ')).join(' ')].join(' '));if(!blob.includes(q))return false}
    const d=isoDate(r.fecha); if(f.from&&(!d||d<f.from))return false; if(f.to&&(!d||d>f.to))return false;
    if(extra)return extra(r);
    return true;
  }
  function sortRows(rows,sort){const a=[...rows];return a.sort((x,y)=>{if(sort==='dateAsc')return isoDate(x.fecha).localeCompare(isoDate(y.fecha));if(sort==='totalDesc')return num(y.total)-num(x.total);if(sort==='totalAsc')return num(x.total)-num(y.total);if(sort==='folioAsc')return text(x.folio).localeCompare(text(y.folio),'es',{numeric:true});if(sort==='folioDesc')return text(y.folio).localeCompare(text(x.folio),'es',{numeric:true});return isoDate(y.fecha).localeCompare(isoDate(x.fecha))})}
  function shell(kind,title,subtitle,accent,extraHtml){
    const content=$('content');if(!content)return null;
    const card=content.querySelector('.card');if(!card)return null;
    card.innerHTML='<div class="docV2Head"><div><div class="docV2Kicker">'+accent.kicker+'</div><h3>'+title+'</h3><div class="docV2Sub">'+subtitle+'</div></div><div class="docV2Actions"><button class="ghost" type="button" data-doc-quick="today">Hoy</button><button class="ghost" type="button" data-doc-quick="month">Este mes</button><button class="ghost" type="button" data-doc-clear="1">Limpiar</button></div></div><div class="docV2Filters"><div class="docV2Search"><span>⌕</span><input id="docV2Q" placeholder="Buscar folio, cliente, RUT, producto o detalle…" /></div><div class="docV2Date"><label>Desde<input id="docV2From" type="date"></label><label>Hasta<input id="docV2To" type="date"></label></div>'+extraHtml+'</div><div id="docV2Stats" class="docV2Stats"></div><div class="docV2Tools"><span id="docV2Count"></span><div><button class="ghost" type="button" id="docV2Export">⬇️ Exportar</button><select id="docV2Sort"><option value="dateDesc">Más recientes</option><option value="dateAsc">Más antiguos</option><option value="totalDesc">Mayor total</option><option value="totalAsc">Menor total</option><option value="folioAsc">Folio A→Z</option><option value="folioDesc">Folio Z→A</option></select></div></div><div class="tableWrap"><table class="table docV2Table"><thead id="docV2Head"></thead><tbody id="docV2Body"></tbody></table></div>';
    return card;
  }
  function bindCommon(card,kind,render,exportFn){
    const f=criteria(kind);
    card.querySelector('#docV2Q').value=f.q||'';card.querySelector('#docV2From').value=f.from||'';card.querySelector('#docV2To').value=f.to||'';card.querySelector('#docV2Sort').value=f.sort||'dateDesc';
    card.querySelector('#docV2Q').oninput=e=>{setCriteria(kind,{q:e.target.value});render()};
    card.querySelector('#docV2From').onchange=e=>{setCriteria(kind,{from:e.target.value});render()};
    card.querySelector('#docV2To').onchange=e=>{setCriteria(kind,{to:e.target.value});render()};
    card.querySelector('#docV2Sort').onchange=e=>{setCriteria(kind,{sort:e.target.value});render()};
    card.querySelector('[data-doc-quick="today"]').onclick=()=>{setCriteria(kind,{from:today(),to:today()});render()};
    card.querySelector('[data-doc-quick="month"]').onclick=()=>{setCriteria(kind,{from:monthStart(),to:today()});render()};
    card.querySelector('[data-doc-clear]').onclick=()=>{setCriteria(kind,stateKey[kind]);render()};
    card.querySelector('#docV2Export').onclick=exportFn;
  }
  function invoiceModule(){
    const card=shell('invoices','💶 Facturas','Búsqueda rápida + filtros de período + ordenamiento por valor o folio.',{kicker:'DOCUMENTOS TRIBUTARIOS · FACTURACIÓN'},'<select id="docV2Status"><option value="">Todos los estados</option><option value="registrado">Registrado</option><option value="aceptado">Aceptado</option><option value="rechazado">Rechazado</option></select>');
    const f=criteria('invoices');const rows=sortRows((state.snapshot?.invoices||[]).filter(r=>matchesCommon(r,f,x=>!f.status||norm(r.estado)===norm(f.status))),f.sort);const total=rows.reduce((a,r)=>a+num(r.total),0),net=rows.reduce((a,r)=>a+num(r.neto),0),kg=rows.reduce((a,r)=>a+num(r.kg),0);
    card.querySelector('#docV2Status').value=f.status||'';
    card.querySelector('#docV2Status').onchange=e=>{setCriteria('invoices',{status:e.target.value});invoiceModule()};
    bindCommon(card,'invoices',invoiceModule,window.exportInvoices);
    card.querySelector('#docV2Stats').innerHTML='<div><small>Resultados</small><b>'+rows.length.toLocaleString('es-CL')+'</b></div><div><small>Neto</small><b>'+money0(net)+'</b></div><div><small>IVA</small><b>'+money0(rows.reduce((a,r)=>a+num(r.iva),0))+'</b></div><div><small>Total filtrado</small><b>'+money0(total)+'</b></div><div><small>KG</small><b>'+money(kg)+'</b></div>';
    card.querySelector('#docV2Count').textContent=rows.length.toLocaleString('es-CL')+' facturas encontradas';
    card.querySelector('#docV2Head').innerHTML='<tr><th>Factura</th><th>Cliente / RUT</th><th>Productos</th><th>Estado</th><th>Neto</th><th>IVA</th><th>Total</th><th>KG</th><th>Sacos</th><th>Acciones</th></tr>';
    card.querySelector('#docV2Body').innerHTML=rows.map(x=>'<tr><td><strong>N° '+esc(x.folio)+'</strong><div class="note">'+esc(safeDate(x.fecha))+'</div></td><td><strong>'+esc(x.cliente||'Sin cliente')+'</strong><div class="note">'+esc(fmtRut(x.rut||''))+'</div></td><td>'+esc((x.productos||[]).join(' · '))+'</td><td><span class="docBadge">'+esc(x.estado||'—')+'</span></td><td class="num">'+money0(x.neto)+'</td><td class="num">'+money0(x.iva)+'</td><td class="num"><b>'+money0(x.total)+'</b></td><td class="num">'+money(x.kg)+'</td><td class="num">'+money(x.sacos)+'</td><td><div class="docRowActions"><button class="primary smallBtn" type="button" onclick="openInvoice(\''+esc(normalize(x.folio))+ '\')">Ver detalle</button>'+(x.rut?'<button class="ghost smallBtn" type="button" onclick="showClientByRut(\''+esc(x.rut)+'\')">Cliente</button>':'')+'<button class="ghost smallBtn" type="button" data-copy="'+esc(x.folio)+'">Copiar folio</button></div></td></tr>').join('')||'<tr><td colspan="10"><div class="empty">No hay facturas con estos filtros.</div></td></tr>';
    card.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);toast('Folio copiado.','ok')}catch{toast('No se pudo copiar el folio.','err')}});
  }
  function boletaModule(){
    const card=shell('boletas','🧾 Boletas','Busca por folio, cliente, RUT, producto o detalle y filtra por período.',{kicker:'DOCUMENTOS TRIBUTARIOS · BOLETAS'},'');
    const f=criteria('boletas');const rows=sortRows((state.snapshot?.boletas||[]).filter(r=>matchesCommon(r,f)),f.sort);const total=rows.reduce((a,r)=>a+num(r.total),0);
    bindCommon(card,'boletas',boletaModule,window.__exportBoletasV2||(()=>window.exportDocuments&&window.exportDocuments()));
    card.querySelector('#docV2Stats').innerHTML='<div><small>Resultados</small><b>'+rows.length.toLocaleString('es-CL')+'</b></div><div><small>Neto</small><b>'+money0(rows.reduce((a,r)=>a+num(r.neto),0))+'</b></div><div><small>IVA</small><b>'+money0(rows.reduce((a,r)=>a+num(r.iva),0))+'</b></div><div><small>Total filtrado</small><b>'+money0(total)+'</b></div><div><small>KG</small><b>'+money(rows.reduce((a,r)=>a+num(r.kg),0))+'</b></div>';
    card.querySelector('#docV2Count').textContent=rows.length.toLocaleString('es-CL')+' boletas encontradas';
    card.querySelector('#docV2Head').innerHTML='<tr><th>Boleta</th><th>Fecha</th><th>Cliente / RUT</th><th>Detalle</th><th>KG</th><th>Sacos</th><th>Neto</th><th>IVA</th><th>Total</th></tr>';
    card.querySelector('#docV2Body').innerHTML=rows.map(b=>'<tr><td><strong>N° '+esc(b.folio)+'</strong></td><td>'+esc(safeDate(b.fecha))+'</td><td><strong>'+esc(b.cliente||'Sin cliente')+'</strong><div class="note">'+esc(fmtRut(b.rut||''))+'</div></td><td>'+((b.items||[]).map(x=>'<div><strong>'+esc(x.producto||x.detalle||'Ítem')+'</strong>'+(x.detalle&&x.detalle!==x.producto?' · '+esc(x.detalle):'')+(x.sacos?' · '+money(x.sacos)+' sacos':'')+(x.kg?' · '+money(x.kg)+' kg':'')+'</div>').join('')||'<span class="note">Sin detalle</span>')+'</td><td class="num">'+money(b.kg)+'</td><td class="num">'+money(b.sacos)+'</td><td class="num">'+money0(b.neto)+'</td><td class="num">'+money0(b.iva)+'</td><td class="num"><b>'+money0(b.total)+'</b></td></tr>').join('')||'<tr><td colspan="9"><div class="empty">No hay boletas con estos filtros.</div></td></tr>';
  }
  function guideModule(){
    const card=shell('guides','🚚 Guías de despacho','Busca receptor, RUT, folio o referencia y filtra por estado, operación y período.',{kicker:'DOCUMENTOS DE MOVILIZACIÓN · DESPACHOS'},'<select id="docV2Status"><option value="">Todos los estados</option></select><select id="docV2Operation"><option value="">Todas las operaciones</option></select>');
    const rowsAll=state.snapshot?.guides||[];const statuses=[...new Set(rowsAll.map(r=>text(r.estado)).filter(Boolean))].sort();const ops=[...new Set(rowsAll.map(r=>text(r.operacion)).filter(Boolean))].sort();const statusEl=card.querySelector('#docV2Status'),opEl=card.querySelector('#docV2Operation');statuses.forEach(v=>statusEl.insertAdjacentHTML('beforeend','<option value="'+esc(v)+'">'+esc(v)+'</option>'));ops.forEach(v=>opEl.insertAdjacentHTML('beforeend','<option value="'+esc(v)+'">'+esc(v)+'</option>'));
    const f=criteria('guides');statusEl.value=f.status||'';opEl.value=f.operation||'';const rows=sortRows(rowsAll.filter(r=>matchesCommon(r,f,x=>(!f.status||norm(x.estado)===norm(f.status))&&(!f.operation||norm(x.operacion)===norm(f.operation)))),f.sort);
    statusEl.onchange=e=>{setCriteria('guides',{status:e.target.value});guideModule()};opEl.onchange=e=>{setCriteria('guides',{operation:e.target.value});guideModule()};bindCommon(card,'guides',guideModule,window.exportGuides);
    card.querySelector('#docV2Stats').innerHTML='<div><small>Resultados</small><b>'+rows.length.toLocaleString('es-CL')+'</b></div><div><small>Estados</small><b>'+new Set(rows.map(r=>text(r.estado)).filter(Boolean)).size+'</b></div><div><small>Neto</small><b>'+money0(rows.reduce((a,r)=>a+num(r.neto),0))+'</b></div><div><small>IVA</small><b>'+money0(rows.reduce((a,r)=>a+num(r.iva),0))+'</b></div><div><small>Total</small><b>'+money0(rows.reduce((a,r)=>a+num(r.total),0))+'</b></div>';
    card.querySelector('#docV2Count').textContent=rows.length.toLocaleString('es-CL')+' guías encontradas';
    card.querySelector('#docV2Head').innerHTML='<tr><th>Folio</th><th>Fecha</th><th>Estado</th><th>Operación</th><th>RUT receptor</th><th>Receptor</th><th>Neto</th><th>IVA</th><th>Total</th><th>Referencia</th></tr>';
    card.querySelector('#docV2Body').innerHTML=rows.map(x=>'<tr><td><strong>'+esc(x.folio)+'</strong></td><td>'+esc(safeDate(x.fecha))+'</td><td><span class="docBadge">'+esc(x.estado||'—')+'</span></td><td>'+esc(x.operacion||'—')+'</td><td>'+esc(fmtRut(x.rut||''))+'</td><td><strong>'+esc(x.receptor||'Sin receptor')+'</strong></td><td class="num">'+money0(x.neto)+'</td><td class="num">'+money0(x.iva)+'</td><td class="num"><b>'+money0(x.total)+'</b></td><td>'+esc(x.ref||'—')+'</td></tr>').join('')||'<tr><td colspan="10"><div class="empty">No hay guías con estos filtros.</div></td></tr>';
  }
  function install(){
    const origInv=renderInvoices,origBol=renderBoletas,origGuide=renderGuides;
    renderInvoices=function(){try{origInv();invoiceModule()}catch(e){console.error(e);origInv()}};
    renderBoletas=function(){try{origBol();boletaModule()}catch(e){console.error(e);origBol()}};
    renderGuides=function(){try{origGuide();guideModule()}catch(e){console.error(e);origGuide()}};
  }
  window.__exportBoletasV2=window.__exportBoletasV2||(()=>{const rows=state.snapshot?.boletas||[];if(!rows.length){toast('No hay boletas para exportar.','err');return}const out=['Folio;Fecha;Cliente;RUT;Producto;Detalle;KG;Sacos;Neto;IVA;Total'];rows.forEach(b=>(b.items||[{producto:'',detalle:'',kg:b.kg,sacos:b.sacos}]).forEach(x=>out.push([b.folio,b.fecha,b.cliente,b.rut,x.producto,x.detalle,x.kg,x.sacos,b.neto,b.iva,b.total].map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';'))));const a=document.createElement('a'),u=URL.createObjectURL(new Blob(['\ufeff'+out.join('\n')],{type:'text/csv;charset=utf-8'}));a.href=u;a.download='boletas_molino_control.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)});
  install();
  const style=document.createElement('style');style.id='document-search-v2';style.textContent='.docV2Head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:18px 20px;background:linear-gradient(135deg,#0f3b78,#2569b5);color:#fff}.docBoletas .docV2Head{background:linear-gradient(135deg,#8b4a00,#cf7b16)}.docGuides .docV2Head{background:linear-gradient(135deg,#075b55,#129282)}.docV2Head h3{margin:0 0 4px;font-size:24px}.docV2Kicker{font-size:10px;font-weight:900;letter-spacing:.14em;opacity:.8}.docV2Sub{font-size:12px;opacity:.88}.docV2Actions{display:flex;gap:6px;flex-wrap:wrap}.docV2Actions .ghost{color:inherit;border-color:rgba(255,255,255,.35);background:rgba(255,255,255,.08)}.docV2Filters{display:grid;grid-template-columns:minmax(280px,2fr) minmax(220px,1fr) auto;gap:10px;padding:14px 18px 8px;align-items:end}.docV2Search{display:flex;align-items:center;gap:8px;border:1px solid #dbe3ec;border-radius:12px;padding:0 12px;background:#fff}.docV2Search span{font-size:20px;color:#64748b}.docV2Search input{border:0!important;outline:0!important;width:100%;padding:11px 0}.docV2Date{display:grid;grid-template-columns:1fr 1fr;gap:8px}.docV2Date label,.docV2Filters select{font-size:10px;font-weight:800;color:#667085}.docV2Date input,.docV2Filters select{display:block;width:100%;margin-top:4px;padding:9px;border:1px solid #dbe3ec;border-radius:10px;background:#fff}.docV2Stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;padding:8px 18px 12px}.docV2Stats>div{background:#f8fbff;border:1px solid #e1e9f2;border-radius:12px;padding:10px 11px}.docV2Stats small{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#667085;font-weight:900}.docV2Stats b{display:block;font-size:18px;color:#173f78;margin-top:3px}.docTools{}.docV2Tools{display:flex;justify-content:space-between;align-items:center;padding:0 18px 10px;color:#667085;font-size:11px}.docV2Tools>div{display:flex;gap:7px}.docV2Tools select{border:1px solid #dbe3ec;border-radius:9px;padding:7px;background:#fff}.docV2Table th{white-space:nowrap}.docV2Table td{vertical-align:top}.docV2Table tbody tr:hover{background:#fbfdff}.docRowActions{display:flex;gap:5px;flex-wrap:wrap}.docBadge{display:inline-block;padding:4px 8px;border-radius:999px;background:#eef4ff;border:1px solid #d5e2fb;color:#174b91;font-size:10px;font-weight:800}.docModule .tableWrap{margin:0 18px 18px}.docModule .docV2Filters+.docV2Stats{}.docV2Search:focus-within{border-color:#5b8fd8;box-shadow:0 0 0 3px rgba(37,105,181,.08)}@media(max-width:950px){.docV2Filters{grid-template-columns:1fr 1fr}.docV2Search{grid-column:1/-1}.docV2Stats{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:680px){.docV2Head{padding:14px 12px;flex-direction:column}.docV2Filters{grid-template-columns:1fr;padding:10px}.docV2Date{grid-template-columns:1fr 1fr}.docV2Stats{grid-template-columns:repeat(2,minmax(0,1fr));padding:6px 10px 10px}.docV2Tools{padding:0 10px 8px}.docModule .tableWrap{margin:0 10px 12px;overflow:auto}.docV2Table{min-width:980px}}';document.head.appendChild(style);
})();
`;
src=src.slice(0,close)+injection+src.slice(close);fs.writeFileSync(file,src);console.log('DOCUMENT SEARCH V2 APPLIED');
