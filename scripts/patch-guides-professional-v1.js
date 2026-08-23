const fs=require('fs');

const file='app.js';
let src=fs.readFileSync(file,'utf8');

// 1) El módulo "Documentos" deja de ser visible en la navegación.
src=src.replace("['documents','🧾 Documentos'],",'');

// 2) El render de Guías se reemplaza por una vista operativa profesional.
const start=src.indexOf('function renderGuides(){');
const end=src.indexOf('\nfunction renderNC(){',start);
if(start<0||end<0) throw new Error('No se encontró el bloque renderGuides/renderNC.');

const renderer=`function renderGuides(){
  const source=Array.isArray(state.snapshot?.guides)?state.snapshot.guides:[];
  const q=String(state.search.guides||'').trim();
  const ql=q.toLowerCase();
  const normRow=(g)=>({
    folio:g.folio??g.numero??g.nro??g.guia??'',
    fecha:g.fecha??g.date??'',
    cliente:g.cliente??g.razonSocial??g.nombreCliente??'',
    rut:g.rut??g.RUT??'',
    destino:g.destino??g.direccion??g.direccionEntrega??'',
    comuna:g.comuna??'',
    estado:g.estado??g.status??'Emitida',
    oc:g.oc??g.ordenCompra??g.orden??'',
    productos:Array.isArray(g.items)?g.items:(Array.isArray(g.detalle)?g.detalle:[]),
    kg:n(g.kg??g.totalKg??g.pesoKg??0),
    sacos:n(g.sacos??g.totalSacos??0),
    observacion:g.observacion??g.obs??'',
    raw:g
  });
  const rows=source.map(normRow);
  const filtered=ql?rows.filter(r=>[r.folio,r.fecha,r.cliente,r.rut,r.destino,r.comuna,r.estado,r.oc,r.observacion,...r.productos.flatMap(x=>[x?.producto,x?.detalle,x?.unidad])].join(' ').toLowerCase().includes(ql)):rows;
  const totalKg=filtered.reduce((a,r)=>a+n(r.kg),0);
  const totalSacos=filtered.reduce((a,r)=>a+n(r.sacos),0);
  const states=[...new Set(filtered.map(r=>String(r.estado||'Emitida')).filter(Boolean))];
  const today=new Date();
  const stamp=today.toLocaleDateString('es-CL');
  $('content').innerHTML=\`
  <div class="card invoiceModule">
    <div class="sectionTitle">
      <div><div class="pill">GUÍAS DE DESPACHO</div><h3 style="margin-top:8px">Control profesional de guías</h3><div class="note">Consulta, filtra, revisa y prepara tus guías para operación y entrega.</div></div>
      <div class="toolbar"><button class="secondary" type="button" id="guideClear">Limpiar</button><button class="secondary" type="button" id="guideCsv">⬇️ Exportar CSV</button><button class="primary" type="button" id="guidePrint">🖨️ Imprimir</button></div>
    </div>
    <div class="kpiRow" style="margin:14px 0">
      <div class="kpi"><small>Guías visibles</small><b>${filtered.length}</b></div>
      <div class="kpi"><small>KG visibles</small><b>${money(totalKg)}</b></div>
      <div class="kpi"><small>Sacos visibles</small><b>${money(totalSacos)}</b></div>
      <div class="kpi"><small>Estados</small><b>${states.length}</b></div>
    </div>
    <div class="card" style="padding:13px;background:#f8fafc;margin-bottom:12px">
      <div class="toolbar">
        <input id="guideQ" class="grow" placeholder="Buscar folio, cliente, RUT, destino, O/C o producto…" value="${esc(q)}">
        <select id="guideStatus"><option value="">Todos los estados</option>${states.map(s=>\`<option value="${esc(s)}">${esc(s)}</option>\`).join('')}</select>
      </div>
    </div>
    <div class="invoiceResultsHeader"><span>${filtered.length} guía${filtered.length===1?'':'s'} encontrada${filtered.length===1?'':'s'}</span><span>Consulta emitida ${stamp}</span></div>
    <div class="tableWrap invoiceTableWrap"><table class="table invoiceTable"><thead><tr>
      <th>Guía</th><th>Fecha</th><th>Cliente / RUT</th><th>Destino</th><th>O/C</th><th>Detalle</th><th>KG</th><th>Sacos</th><th>Estado</th><th>Observación</th>
    </tr></thead><tbody id="guideBody"></tbody></table></div>
  </div>\`;
  const paint=()=>{
    const term=String(state.search.guides||'').trim().toLowerCase();
    const statusFilter=String($('guideStatus')?.value||'');
    const list=rows.filter(r=>{const hit=!term||[r.folio,r.fecha,r.cliente,r.rut,r.destino,r.comuna,r.estado,r.oc,r.observacion,...r.productos.flatMap(x=>[x?.producto,x?.detalle,x?.unidad])].join(' ').toLowerCase().includes(term);return hit&&(!statusFilter||String(r.estado)===statusFilter)});
    $('guideBody').innerHTML=list.map(r=>{
      const detail=r.productos.length?r.productos.map(x=>{
        const p=x?.producto||x?.detalle||'Ítem';
        const kg=x?.kg!=null&&x.kg!==''?` · ${money(x.kg)} KG`:'';
        const sac=x?.sacos!=null&&x.sacos!==''?` · ${money(x.sacos)} sacos`:'';
        return `<div><strong>${esc(p)}</strong><span class="note">${esc(kg+sac)}</span></div>`
      }).join(''):'<span class="note">Sin detalle registrado</span>';
      return `<tr><td><strong>N° ${esc(r.folio)}</strong></td><td>${esc(r.fecha)}</td><td><strong>${esc(r.cliente||'Sin cliente')}</strong><br><span class="note">${esc(formatRut(r.rut||'RUT no informado'))}</span></td><td>${esc([r.destino,r.comuna].filter(Boolean).join(' · '))}</td><td>${esc(r.oc||'')}</td><td>${detail}</td><td><b>${money(r.kg)}</b></td><td>${money(r.sacos)}</td><td><span class="pill">${esc(r.estado)}</span></td><td>${esc(r.observacion||'')}</td></tr>`
    }).join('')||'<tr><td colspan="10" class="empty">No hay guías que coincidan con el filtro.</td></tr>';
  };
  let timer;
  $('guideQ').oninput=e=>{state.search.guides=e.target.value;clearTimeout(timer);timer=setTimeout(paint,100)};
  $('guideStatus').onchange=paint;
  $('guideClear').onclick=()=>{state.search.guides='';renderGuides()};
  $('guideCsv').onclick=()=>{
    const list=rows.filter(r=>{const term=String(state.search.guides||'').trim().toLowerCase();const sf=String($('guideStatus')?.value||'');return (!term||[r.folio,r.fecha,r.cliente,r.rut,r.destino,r.comuna,r.estado,r.oc,r.observacion,...r.productos.flatMap(x=>[x?.producto,x?.detalle,x?.unidad])].join(' ').toLowerCase().includes(term))&&(!sf||String(r.estado)===sf)});
    const out=['Guía;Fecha;Cliente;RUT;Destino;O/C;Estado;Producto;KG;Sacos;Observación'];
    list.forEach(r=>{if(r.productos.length)r.productos.forEach(x=>out.push([r.folio,r.fecha,r.cliente,r.rut,r.destino,r.oc,r.estado,x?.producto||x?.detalle||'',x?.kg||'',x?.sacos||'',r.observacion].map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')));else out.push([r.folio,r.fecha,r.cliente,r.rut,r.destino,r.oc,r.estado,'',r.kg,r.sacos,r.observacion].map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';'))});
    const a=document.createElement('a');const u=URL.createObjectURL(new Blob(['\\ufeff'+out.join('\\n')],{type:'text/csv;charset=utf-8'}));a.href=u;a.download='guias_molino_control.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)
  };
  $('guidePrint').onclick=()=>{
    const body=rows.filter(r=>{const term=String(state.search.guides||'').trim().toLowerCase();const sf=String($('guideStatus')?.value||'');return (!term||[r.folio,r.fecha,r.cliente,r.rut,r.destino,r.comuna,r.estado,r.oc,r.observacion,...r.productos.flatMap(x=>[x?.producto,x?.detalle,x?.unidad])].join(' ').toLowerCase().includes(term))&&(!sf||String(r.estado)===sf)}).map(r=>`<tr><td>${esc(r.folio)}</td><td>${esc(r.fecha)}</td><td>${esc(r.cliente)}</td><td>${esc(r.rut)}</td><td>${esc(r.destino)}</td><td>${esc(r.oc)}</td><td>${money(r.kg)}</td><td>${money(r.sacos)}</td><td>${esc(r.estado)}</td></tr>`).join('');
    const w=window.open('','_blank');if(!w){alert('El navegador bloqueó la ventana de impresión.');return}w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Guías de Despacho</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#172033}h1{color:#123a78}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #cfd7e3;padding:6px;text-align:left}th{background:#eef4fb}</style></head><body><h1>Molinos San Miguel Ltda. — Guías de Despacho</h1><p>Reporte generado ${stamp}</p><table><thead><tr><th>Guía</th><th>Fecha</th><th>Cliente</th><th>RUT</th><th>Destino</th><th>O/C</th><th>KG</th><th>Sacos</th><th>Estado</th></tr></thead><tbody>'+body+'</tbody></table></body></html>');w.document.close();w.focus();setTimeout(()=>w.print(),300)
  };
  paint();
}
`;
src=src.slice(0,start)+renderer+src.slice(end);

fs.writeFileSync(file,src);
console.log('GUIDES PROFESSIONAL V1: PASS');
