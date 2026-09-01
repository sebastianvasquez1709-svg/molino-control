/* Molino Control · Panel Macro PRO V6
 * Root fix: reuse the already-authenticated app snapshot instead of requiring a second in-memory session.
 * Presentation/analytics only. No credentials stored, no data mutations.
 */
(() => {
  'use strict';
  if (window.__MC_MACRO_PRO_V6__) return;
  window.__MC_MACRO_PRO_V6__ = true;

  const STYLE_ID='mc-macro-pro-v6-style';
  const $=id=>document.getElementById(id);
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
  const money=v=>Math.round(n(v)).toLocaleString('es-CL');
  const qty=v=>n(v).toLocaleString('es-CL',{maximumFractionDigits:2});
  const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const classify=t=>{const s=String(t||'').toUpperCase();return{invoice:/FACTURA/.test(s),boleta:/BOLETA/.test(s),guide:/GU[IÍ]A/.test(s),nc:/NOTA DE CR[EÉ]DITO/.test(s),nd:/NOTA DE D[EÉ]BITO/.test(s)}};
  const signed=(d,field)=>{const v=Math.abs(n(d?.[field]));const c=classify(d?.tipo);return c.nc?-v:c.nd?v:n(d?.[field])};
  const commercial=d=>{const c=classify(d?.tipo);return c.invoice||c.boleta||c.nc||c.nd};
  function parseDate(v){
    if(v instanceof Date&&!Number.isNaN(v.getTime()))return v;
    if(typeof v==='number'&&v>20000&&v<60000){const d=new Date(Date.UTC(1899,11,30));d.setUTCDate(d.getUTCDate()+v);return d;}
    const s=String(v??'').trim();if(!s)return null;
    let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m){const d=new Date(+m[1],+m[2]-1,+m[3]);return Number.isNaN(d.getTime())?null:d}
    m=s.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);if(m){const d=new Date(+m[3],+m[2]-1,+m[1]);return Number.isNaN(d.getTime())?null:d}
    const d=new Date(s);return Number.isNaN(d.getTime())?null:d;
  }
  const monthKey=v=>{const d=parseDate(v);return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`:''};
  const sum=(a,f)=>a.reduce((s,x)=>s+n(f(x)),0);

  function style(){
    if($(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      html.mcMacroActive,html.mcMacroActive body{background:#07090b!important;color:#eef1f4!important}
      .mcMacroActive .sidebar{background:linear-gradient(180deg,#050608,#0b0d10 55%,#050608)!important;border-right:1px solid #24282d!important}
      .mcMacroActive .topbar{background:#080b0e!important;border-bottom:1px solid #24282d!important}
      .mcMacroActive .content{max-width:none!important;padding:14px!important;background:linear-gradient(180deg,#07090b,#0a0c0f)!important}
      .mcV6{--blue:#2b83ff;--green:#28c76f;--purple:#9b6cff;--orange:#f3a400;--cyan:#19c7da;--red:#ef5350;max-width:1700px;margin:0 auto;padding:16px;background:linear-gradient(145deg,#060708,#0c0f12 55%,#070809);border:1px solid #20262c;border-radius:18px;min-height:calc(100vh - 106px);box-shadow:0 16px 50px rgba(0,0,0,.28);font-family:Inter,Segoe UI,Arial,sans-serif}
      .mcV6 *{box-sizing:border-box}.mcV6Head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:12px}.mcV6Title h1{font-size:28px;letter-spacing:-.6px;margin:0;color:#fff}.mcV6Title p{margin:3px 0;color:#7d8791;font-size:10px}.mcV6Tools{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.mcV6Chip,.mcV6Btn{background:#101417;border:1px solid #2c333a;color:#dce2e7;border-radius:9px;padding:8px 10px;font-size:10px;font-weight:800}.mcV6Btn{cursor:pointer}.mcV6Status{display:inline-flex;align-items:center;gap:6px;border:1px solid #28543a;background:#0e1711;color:#a4e9bc;border-radius:999px;padding:7px 10px;font-size:10px;font-weight:800}.mcV6Status i{width:7px;height:7px;border-radius:50%;background:var(--green)}
      .mcV6Kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}.mcV6Kpi{background:linear-gradient(180deg,#121518,#0d1012);border:1px solid #282e34;border-radius:12px;min-height:112px;padding:12px;border-top:2px solid var(--accent)}.mcV6Kpi small{color:#8f98a1;font-size:8px;text-transform:uppercase;letter-spacing:.09em}.mcV6Kpi strong{display:block;color:#fff;font-size:21px;line-height:1.15;margin-top:7px}.mcV6Kpi span{display:block;color:#69747e;font-size:8px;margin-top:5px}
      .aBlue{--accent:var(--blue)}.aGreen{--accent:var(--green)}.aPurple{--accent:var(--purple)}.aOrange{--accent:var(--orange)}.aCyan{--accent:var(--cyan)}
      .mcV6Grid{display:grid;grid-template-columns:1.35fr .9fr 1fr;gap:9px;margin-top:9px}.mcV6Grid2{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-top:9px}.mcV6Panel{background:linear-gradient(180deg,#111417,#0d1012);border:1px solid #252c32;border-radius:12px;padding:13px;min-width:0}.mcV6Panel h3{margin:0;font-size:12px;color:#f6f7f8}.mcV6Sub{margin-top:3px;color:#747f89;font-size:8px}.mcV6Loading{display:grid;place-items:center;min-height:180px;color:#818c95;border:1px solid #2a3036;border-radius:10px;background:#0f1215}.mcV6Error{padding:20px;border:1px solid #5b3030;background:#1b0e0e;color:#ffb7b3;border-radius:10px}.mcV6Error strong{display:block;color:#ffd0cd;margin-bottom:5px}
      .mcV6Line svg{width:100%;height:220px;display:block;margin-top:8px}.mcGridLine{stroke:#252b31;stroke-width:1}.mcAxis{fill:#717c85;font-size:8px}.mcValue{fill:#e3e8ec;font-size:8px;font-weight:800}.mcPath{fill:none;stroke:var(--blue);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.mcPoint{fill:#0c1013;stroke:var(--blue);stroke-width:3}.mcArea{fill:rgba(43,131,255,.10)}
      .mcBars{display:grid;gap:7px;margin-top:12px}.mcBar{display:grid;grid-template-columns:120px 1fr 86px;gap:7px;align-items:center}.mcBar label{font-size:8px;color:#aeb6bd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mcTrack{height:8px;background:#22282e;border-radius:999px;overflow:hidden}.mcTrack i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--bar),rgba(255,255,255,.48))}.mcBar b{font-size:8px;text-align:right;color:#edf0f2}
      .mcDocs{display:grid;gap:8px;margin-top:13px}.mcDoc{display:grid;grid-template-columns:75px 1fr 48px;gap:7px;align-items:center;font-size:8px}.mcDoc span{color:#aab3ba}.mcDoc b{text-align:right;color:#eef1f3}.mcDocTrack{height:9px;background:#22282e;border-radius:999px;overflow:hidden}.mcDocTrack i{display:block;height:100%;border-radius:999px;background:var(--c)}
      .mcTiles{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:12px}.mcTile{background:#111518;border:1px solid #252c32;border-left:2px solid var(--c);border-radius:9px;padding:9px}.mcTile small{display:block;color:#7d8892;font-size:7px;text-transform:uppercase}.mcTile b{display:block;color:#fff;font-size:16px;margin-top:4px}.mcAudit{display:grid;gap:7px;margin-top:10px}.mcAuditRow{display:flex;justify-content:space-between;gap:8px;padding:8px 9px;border:1px solid #252c32;border-radius:9px;background:#101417;font-size:8px}.mcAuditRow span{color:#aeb6bd}.mcAuditRow b{color:#fff}.mcAuditRow.ok b{color:#8ee4aa}.mcAuditRow.warn b{color:#f6cf83}.mcFooter{margin-top:9px;padding:9px 11px;border:1px solid #22282e;border-radius:9px;background:#0a0d10;color:#727d86;font-size:8px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
      @media(max-width:1250px){.mcV6Kpis{grid-template-columns:repeat(3,1fr)}.mcV6Grid{grid-template-columns:1.15fr .85fr}.mcV6Grid>.mcV6Panel:last-child{grid-column:1/-1}.mcV6Grid2{grid-template-columns:1fr 1fr}.mcV6Grid2>.mcV6Panel:last-child{grid-column:1/-1}}
      @media(max-width:760px){.mcV6{padding:11px}.mcV6Head{flex-direction:column}.mcV6Kpis{grid-template-columns:repeat(2,1fr)}.mcV6Grid,.mcV6Grid2{grid-template-columns:1fr}.mcV6Grid>.mcV6Panel:last-child,.mcV6Grid2>.mcV6Panel:last-child{grid-column:auto}.mcTiles{grid-template-columns:1fr 1fr}.mcBar{grid-template-columns:90px 1fr 74px}}
      @media(max-width:460px){.mcV6Kpis,.mcTiles{grid-template-columns:1fr}.mcV6Title h1{font-size:23px}}
    `;document.head.appendChild(s);
  }
  function monthlyChart(monthly){
    if(!monthly.length)return '<div class="mcV6Loading">No hay períodos de venta disponibles.</div>';
    const w=720,h=220,p=24,max=Math.max(1,...monthly.map(x=>Math.abs(n(x.neto)))),den=Math.max(1,monthly.length-1);
    const pts=monthly.map((x,i)=>({x:p+i*((w-p*2)/den),y:h-p-(Math.abs(n(x.neto))/max)*(h-p*2),v:n(x.neto),k:x.periodo}));
    const path=pts.map((q,i)=>(i?'L':'M')+q.x.toFixed(1)+','+q.y.toFixed(1)).join(' ');
    const area=`M ${pts[0].x} ${h-p} L ${pts.map(q=>q.x+' '+q.y).join(' L ')} L ${pts.at(-1).x} ${h-p} Z`;
    return `<div class="mcV6Line"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line class="mcGridLine" x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}"/><line class="mcGridLine" x1="${p}" y1="${h/2}" x2="${w-p}" y2="${h/2}"/><line class="mcGridLine" x1="${p}" y1="${p}" x2="${w-p}" y2="${p}"/><path d="${area}" class="mcArea"/><path d="${path}" class="mcPath"/>${pts.map(q=>`<circle class="mcPoint" cx="${q.x}" cy="${q.y}" r="4"/><text class="mcValue" x="${q.x}" y="${Math.max(11,q.y-8)}" text-anchor="middle">$${money(q.v/1000000)}M</text><text class="mcAxis" x="${q.x}" y="${h-6}" text-anchor="middle">${esc(q.k)}</text>`).join('')}</svg></div>`;
  }
  function bars(items,format,accent){if(!items.length)return '<div class="mcV6Loading">Sin datos para mostrar.</div>';const max=Math.max(1,...items.map(x=>Math.abs(n(x.value))));return '<div class="mcBars">'+items.map(x=>`<div class="mcBar"><label title="${esc(x.label)}">${esc(x.label)}</label><div class="mcTrack"><i style="--bar:${accent};width:${Math.max(3,Math.round(Math.abs(n(x.value))/max*100))}%"></i></div><b>${format(x.value)}</b></div>`).join('')+'</div>'}
  function productTable(items,total){
    if(!items.length)return '<div class="mcV6Loading">Sin datos para mostrar.</div>';
    const base=Math.max(1,n(total));
    return '<table class="mcProductTable" aria-label="Productos con mayor volumen"><thead><tr><th>Producto</th><th>KG</th><th>Participación</th></tr></thead><tbody>'+
      items.map(x=>'<tr><td>'+esc(x.label)+'</td><td>'+qty(x.value)+'</td><td>'+((n(x.value)/base)*100).toFixed(1)+'%</td></tr>').join('')+
      '</tbody></table>';
  }
  function buildModel(s){
    const docs=Array.isArray(s?.documents)?s.documents:[];const dispatches=Array.isArray(s?.dispatches)?s.dispatches:[];
    const comm=docs.filter(commercial),sales=docs.filter(d=>{const c=classify(d?.tipo);return c.invoice||c.boleta});
    const net=sum(comm,d=>signed(d,'neto')),iva=sum(comm,d=>signed(d,'iva')),total=sum(comm,d=>signed(d,'total'));
    const kg=sum(sales,d=>Math.max(0,n(d?.datos?.kilos))),sacos=sum(sales,d=>Math.max(0,n(d?.datos?.sacos)));
    const dkg=sum(dispatches,d=>Math.max(0,n(d?.kilos??d?.kg))),granel=sum(dispatches.filter(d=>/GRANEL/i.test(String(d?.producto||''))),d=>Math.max(0,n(d?.kilos??d?.kg)));
    const months={};comm.forEach(d=>{const k=monthKey(d?.fecha);if(k)months[k]=(months[k]||0)+signed(d,'neto')});const monthly=Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12).map(([periodo,neto])=>({periodo,neto}));
    const cm={};comm.forEach(d=>{const label=String(d?.cliente||'Sin cliente').trim()||'Sin cliente';cm[label]=(cm[label]||0)+signed(d,'neto')});const topClients=Object.entries(cm).filter(([,v])=>v!==0).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([label,value])=>({label,value}));
    const pm={};sales.forEach(d=>{const label=String(d?.producto||d?.datos?.producto||d?.datos?.producto_tipo||'Sin producto').trim()||'Sin producto';pm[label]=(pm[label]||0)+Math.max(0,n(d?.datos?.kilos))});const topProducts=Object.entries(pm).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([label,value])=>({label,value}));
    const counts={facturas:docs.filter(d=>classify(d?.tipo).invoice).length,boletas:docs.filter(d=>classify(d?.tipo).boleta).length,nc:docs.filter(d=>classify(d?.tipo).nc).length,nd:docs.filter(d=>classify(d?.tipo).nd).length,guias:docs.filter(d=>classify(d?.tipo).guide).length,documents:docs.length};
    const qa={sin_fecha:docs.filter(d=>!parseDate(d?.fecha)).length,comerciales_cero_neto:comm.filter(d=>n(d?.neto)===0).length,facturas_negativas:sales.filter(d=>classify(d?.tipo).invoice&&n(d?.neto)<0).length,sin_cliente:comm.filter(d=>!String(d?.cliente||'').trim()).length};
    return {net,iva,total,kg,sacos,dkg,granel,monthly,topClients,topProducts,counts,qa,clientes:Array.isArray(s?.clients)?s.clients.length:0,productos:Array.isArray(s?.products)?s.products.length:0,despachos:dispatches.length,precioKg:kg?net/kg:0};
  }
  function errorView(msg){const c=$('content');if(!c)return;c.innerHTML=`<div class="mcV6"><div class="mcV6Head"><div><div class="mcV6Title"><h1>PANEL MACRO</h1><p>CENTRO DE CONTROL EJECUTIVO · MOLINO SAN MIGUEL LTDA.</p></div></div><button class="mcV6Btn" id="mcV6Retry">↻ Reintentar</button></div><div class="mcV6Error"><strong>No se pudo cargar el Centro de Control</strong>${esc(msg)}</div></div>`;$('mcV6Retry')?.addEventListener('click',render)}
  function getState(){return typeof window.__MC_APP_GET_STATE__==='function'?window.__MC_APP_GET_STATE__():window.__MC_APP_STATE__||null}
  async function getData(){
    for(let i=0;i<30;i++){
      const st=getState();if(st?.snapshot?.documents?.length||st?.snapshot?.clients?.length||st?.snapshot?.dispatches?.length)return st.snapshot;
      await new Promise(r=>setTimeout(r,250));
    }
    throw new Error('El Maestro todavía no está cargado en la sesión activa.');
  }
  async function renderLegacy(){
    style();document.documentElement.classList.add('mcMacroActive');const c=$('content');if(!c)return;const title=$('pageTitle');if(title)title.textContent='Panel Macro';
    c.innerHTML='<div class="mcV6"><div class="mcV6Head"><div><div class="mcV6Title"><h1>PANEL MACRO</h1><p>CENTRO DE CONTROL EJECUTIVO · MOLINO SAN MIGUEL LTDA.</p></div></div><div class="mcV6Tools"><span class="mcV6Status"><i></i> DATOS DE LA SESIÓN ACTIVA</span><span class="mcV6Chip">Analítica ejecutiva</span><button class="mcV6Btn" id="mcV6Refresh">↻ Actualizar</button></div></div><div class="mcV6Loading">Cargando datos del Maestro…</div></div>';
    try{
      const snap=await getData(),m=buildModel(snap);const last=m.monthly.at(-1)?.neto??null,prev=m.monthly.at(-2)?.neto??null,mom=(last!==null&&prev!==null&&prev!==0)?((last-prev)/Math.abs(prev))*100:null,avg=m.monthly.length?sum(m.monthly,x=>x.neto)/m.monthly.length:0;
      const docRows=[['Facturas',m.counts.facturas,'#2b83ff'],['Boletas',m.counts.boletas,'#28c76f'],['NC',m.counts.nc,'#f3a400'],['ND',m.counts.nd,'#ef5350'],['Guías',m.counts.guias,'#9b6cff']];
      c.innerHTML=`<div class="mcV6"><div class="mcV6Head"><div><div class="mcV6Title"><h1>PANEL MACRO</h1><p>CENTRO DE CONTROL EJECUTIVO · MOLINO SAN MIGUEL LTDA.</p></div></div><div class="mcV6Tools"><span class="mcV6Status"><i></i> MAESTRO CARGADO</span><span class="mcV6Chip">${esc(m.monthly.at(-1)?.periodo||'Período actual')}</span><button class="mcV6Btn" id="mcV6Refresh">↻ Actualizar</button></div></div>
      <div class="mcV6Kpis"><div class="mcV6Kpi aBlue"><small>Venta neta</small><strong>$ ${money(m.net)}</strong><span>Facturas + Boletas ± NC/ND</span></div><div class="mcV6Kpi aGreen"><small>Venta total</small><strong>$ ${money(m.total)}</strong><span>Neto + IVA ajustado</span></div><div class="mcV6Kpi aPurple"><small>IVA</small><strong>$ ${money(m.iva)}</strong><span>Documentos comerciales</span></div><div class="mcV6Kpi aOrange"><small>KG vendidos</small><strong>${qty(m.kg)}</strong><span>Facturas + Boletas</span></div><div class="mcV6Kpi aOrange"><small>Sacos vendidos</small><strong>${qty(m.sacos)}</strong><span>Maestro comercial</span></div><div class="mcV6Kpi aCyan"><small>Granel despachado</small><strong>${qty(m.granel)} kg</strong><span>${qty(m.despachos)} despachos</span></div></div>
      <div class="mcV6Grid"><section class="mcV6Panel"><h3>EVOLUCIÓN DE VENTAS NETAS</h3><div class="mcV6Sub">Últimos 12 períodos disponibles</div>${monthlyChart(m.monthly)}<div class="mcFooter"><span>Último: ${last===null?'—':'$ '+money(last)}</span><span>Variación: ${mom===null?'—':(mom>=0?'+':'')+mom.toFixed(1)+'%'}</span><span>Promedio: $ ${money(avg)}</span></div></section><section class="mcV6Panel"><h3>MIX DOCUMENTAL</h3><div class="mcV6Sub">Cantidad de documentos</div><div class="mcDocs">${docRows.map(([label,value,color])=>`<div class="mcDoc"><span>${label}</span><div class="mcDocTrack"><i style="--c:${color};width:${Math.max(2,Math.round(value/Math.max(1,m.counts.documents)*100))}%"></i></div><b>${value.toLocaleString('es-CL')}</b></div>`).join('')}</div><div class="mcFooter"><span>${m.counts.documents.toLocaleString('es-CL')} documentos</span><span>${m.counts.guias.toLocaleString('es-CL')} guías</span></div></section><section class="mcV6Panel"><h3>TOP 10 CLIENTES</h3><div class="mcV6Sub">Venta neta ajustada</div>${bars(m.topClients,x=>'$ '+money(x),'#2b83ff')}</section></div>
      <div class="mcV6Grid2"><section class="mcV6Panel"><h3>TOP 10 PRODUCTOS</h3><div class="mcV6Sub">KG vendidos</div>${bars(m.topProducts,x=>qty(x)+' kg','#28c76f')}</section><section class="mcV6Panel"><h3>CONTROL COMERCIAL</h3><div class="mcTiles"><div class="mcTile" style="--c:#2b83ff"><small>Facturas</small><b>${m.counts.facturas.toLocaleString('es-CL')}</b></div><div class="mcTile" style="--c:#28c76f"><small>Boletas</small><b>${m.counts.boletas.toLocaleString('es-CL')}</b></div><div class="mcTile" style="--c:#f3a400"><small>NC</small><b>${m.counts.nc.toLocaleString('es-CL')}</b></div><div class="mcTile" style="--c:#ef5350"><small>ND</small><b>${m.counts.nd.toLocaleString('es-CL')}</b></div><div class="mcTile" style="--c:#9b6cff"><small>Guías</small><b>${m.counts.guias.toLocaleString('es-CL')}</b></div><div class="mcTile" style="--c:#19c7da"><small>Precio neto/kg</small><b>$ ${money(m.precioKg)}</b></div></div></section><section class="mcV6Panel"><h3>CONTROL OPERATIVO</h3><div class="mcTiles"><div class="mcTile" style="--c:#2b83ff"><small>Despachos</small><b>${m.despachos.toLocaleString('es-CL')}</b></div><div class="mcTile" style="--c:#28c76f"><small>KG despachados</small><b>${qty(m.dkg)}</b></div><div class="mcTile" style="--c:#f3a400"><small>Sacos</small><b>${qty(m.sacos)}</b></div><div class="mcTile" style="--c:#9b6cff"><small>Clientes</small><b>${m.clientes.toLocaleString('es-CL')}</b></div><div class="mcTile" style="--c:#19c7da"><small>Productos</small><b>${m.productos.toLocaleString('es-CL')}</b></div><div class="mcTile" style="--c:#ef5350"><small>Granel</small><b>${qty(m.granel)} kg</b></div></div></section></div>
      <section class="mcV6Panel" style="margin-top:9px"><h3>AUDITORÍA DEL DATO</h3><div class="mcV6Sub">Controles preventivos del Centro de Control</div><div class="mcAudit"><div class="mcAuditRow ${m.qa.sin_fecha===0?'ok':'warn'}"><span>Documentos sin fecha</span><b>${m.qa.sin_fecha}</b></div><div class="mcAuditRow ${m.qa.comerciales_cero_neto===0?'ok':'warn'}"><span>Comerciales con neto $0</span><b>${m.qa.comerciales_cero_neto}</b></div><div class="mcAuditRow ${m.qa.facturas_negativas===0?'ok':'warn'}"><span>Facturas negativas</span><b>${m.qa.facturas_negativas}</b></div><div class="mcAuditRow ${m.qa.sin_cliente===0?'ok':'warn'}"><span>Comerciales sin cliente</span><b>${m.qa.sin_cliente}</b></div></div></section><div class="mcFooter"><span>Fuente: snapshot Maestro de la sesión activa · sin segunda autenticación.</span><span>${m.counts.documents.toLocaleString('es-CL')} documentos · ${m.despachos.toLocaleString('es-CL')} despachos</span></div></div>`;
      $('mcV6Refresh')?.addEventListener('click',render);
    }catch(e){errorView(e?.message||String(e))}
  }
  async function render(){
    style();
    document.documentElement.classList.add('mcMacroActive');
    const c=$('content');
    if(!c)return;
    const title=$('pageTitle');
    if(title)title.textContent='Panel Macro';
    c.innerHTML='<div class="mcV6"><section class="mcV6Hero"><div class="mcV6Title"><div class="mcV6Eyebrow"><i></i>Centro de control operativo</div><h1>Panel Macro</h1><p>Consolidando producción comercial, ventas, despachos y calidad del dato desde el Maestro activo.</p></div><div class="mcV6Tools"><span class="mcV6Status"><i></i>DATOS DE LA SESIÓN ACTIVA</span><button class="mcV6Btn" id="mcV6Refresh">↻ Actualizar</button></div></section><div class="mcV6Loading">Cargando datos del Maestro…</div></div>';
    try{
      const snap=await getData();
      const m=buildModel(snap);
      const last=m.monthly.at(-1)?.neto??null;
      const prev=m.monthly.at(-2)?.neto??null;
      const mom=(last!==null&&prev!==null&&prev!==0)?((last-prev)/Math.abs(prev))*100:null;
      const avg=m.monthly.length?sum(m.monthly,x=>x.neto)/m.monthly.length:0;
      const issues=Object.values(m.qa).reduce((a,b)=>a+n(b),0);
      const period=esc(m.monthly.at(-1)?.periodo||'Período actual');
      const variation=mom===null?'Sin base':(mom>=0?'+':'')+mom.toFixed(1)+'%';
      const docRows=[['Facturas',m.counts.facturas,'#75a5ff'],['Boletas',m.counts.boletas,'#55d7aa'],['NC',m.counts.nc,'#ffbd69'],['ND',m.counts.nd,'#ff7881'],['Guías',m.counts.guias,'#a784ff']];
      const auditRows=[
        ['Documentos sin fecha',m.qa.sin_fecha],
        ['Comerciales con neto $0',m.qa.comerciales_cero_neto],
        ['Facturas negativas',m.qa.facturas_negativas],
        ['Comerciales sin cliente',m.qa.sin_cliente]
      ];
      c.innerHTML=[
        '<div class="mcV6">',
        '<section class="mcV6Hero">',
          '<div class="mcV6Title"><div class="mcV6Eyebrow"><i></i>Operación conectada · Molino San Miguel</div><h1>Control total de la operación</h1><p>Ventas, volumen, despachos y auditoría reunidos en una lectura ejecutiva con profundidad operativa.</p></div>',
          '<div class="mcV6Tools"><span class="mcV6Status"><i></i>MAESTRO CARGADO</span><div class="mcV6HeroMetric"><small>Variación del último período</small><strong>'+variation+'</strong></div><div class="mcV6ToolRow"><span class="mcV6Chip">'+period+'</span><button class="mcV6Btn" id="mcV6Refresh">↻ Actualizar</button></div></div>',
        '</section>',
        '<section class="mcV6Kpis" aria-label="Indicadores principales">',
          '<article class="mcV6Kpi aBlue"><small>Venta neta</small><strong>$ '+money(m.net)+'</strong><span>Facturas + Boletas ± NC/ND</span></article>',
          '<article class="mcV6Kpi aGreen"><small>KG vendidos</small><strong>'+qty(m.kg)+' kg</strong><span>Volumen comercial consolidado</span></article>',
          '<article class="mcV6Kpi aCyan"><small>KG despachados</small><strong>'+qty(m.dkg)+' kg</strong><span>'+qty(m.despachos)+' despachos registrados</span></article>',
          '<article class="mcV6Kpi aOrange"><small>Precio neto por KG</small><strong>$ '+money(m.precioKg)+'</strong><span>Promedio ponderado real</span></article>',
        '</section>',
        '<section class="mcV6GridMain">',
          '<article class="mcV6Panel"><h3>EVOLUCIÓN DE VENTAS NETAS</h3><div class="mcV6Sub">Últimos 12 períodos disponibles</div>'+monthlyChart(m.monthly)+'<div class="mcFooter"><span>Último: '+(last===null?'—':'$ '+money(last))+'</span><span>Variación: '+variation+'</span><span>Promedio: $ '+money(avg)+'</span></div></article>',
          '<aside class="mcV6Panel"><h3>ALERTAS Y AUDITORÍA</h3><div class="mcV6Sub">'+(issues===0?'Sin observaciones críticas':issues+' observaciones requieren revisión')+'</div><div class="mcAudit">'+auditRows.map(x=>'<div class="mcAuditRow '+(x[1]===0?'ok':'warn')+'"><span>'+esc(x[0])+'</span><b>'+n(x[1]).toLocaleString('es-CL')+'</b></div>').join('')+'</div><div class="mcFooter"><span>Control preventivo activo</span><span>'+m.counts.documents.toLocaleString('es-CL')+' documentos</span></div></aside>',
        '</section>',
        '<section class="mcV6GridData">',
          '<article class="mcV6Panel"><h3>TOP 10 CLIENTES</h3><div class="mcV6Sub">Venta neta ajustada</div>'+bars(m.topClients,x=>'$ '+money(x),'#75a5ff')+'</article>',
          '<article class="mcV6Panel"><h3>PRODUCTOS CON MAYOR VOLUMEN</h3><div class="mcV6Sub">Tabla compacta · KG vendidos y participación</div>'+productTable(m.topProducts,m.kg)+'</article>',
        '</section>',
        '<section class="mcV6GridOps">',
          '<article class="mcV6Panel"><h3>MIX DOCUMENTAL</h3><div class="mcV6Sub">Cantidad de documentos por tipo</div><div class="mcDocs">'+docRows.map(x=>'<div class="mcDoc"><span>'+esc(x[0])+'</span><div class="mcDocTrack"><i style="--c:'+x[2]+';width:'+Math.max(2,Math.round(x[1]/Math.max(1,m.counts.documents)*100))+'%"></i></div><b>'+x[1].toLocaleString('es-CL')+'</b></div>').join('')+'</div></article>',
          '<article class="mcV6Panel"><h3>CONTROL COMERCIAL</h3><div class="mcTiles"><div class="mcTile" style="--c:#75a5ff"><small>Venta total</small><b>$ '+money(m.total)+'</b></div><div class="mcTile" style="--c:#a784ff"><small>IVA</small><b>$ '+money(m.iva)+'</b></div><div class="mcTile" style="--c:#55d7aa"><small>Clientes</small><b>'+m.clientes.toLocaleString('es-CL')+'</b></div><div class="mcTile" style="--c:#ffbd69"><small>Sacos</small><b>'+qty(m.sacos)+'</b></div><div class="mcTile" style="--c:#54d3e6"><small>Productos</small><b>'+m.productos.toLocaleString('es-CL')+'</b></div><div class="mcTile" style="--c:#ff7881"><small>NC / ND</small><b>'+(m.counts.nc+m.counts.nd).toLocaleString('es-CL')+'</b></div></div></article>',
          '<article class="mcV6Panel"><h3>CONTROL OPERATIVO</h3><div class="mcTiles"><div class="mcTile" style="--c:#75a5ff"><small>Despachos</small><b>'+m.despachos.toLocaleString('es-CL')+'</b></div><div class="mcTile" style="--c:#55d7aa"><small>KG despachados</small><b>'+qty(m.dkg)+'</b></div><div class="mcTile" style="--c:#54d3e6"><small>Granel</small><b>'+qty(m.granel)+' kg</b></div><div class="mcTile" style="--c:#a784ff"><small>Guías</small><b>'+m.counts.guias.toLocaleString('es-CL')+'</b></div><div class="mcTile" style="--c:#ffbd69"><small>Documentos</small><b>'+m.counts.documents.toLocaleString('es-CL')+'</b></div><div class="mcTile" style="--c:#ff7881"><small>Alertas</small><b>'+issues.toLocaleString('es-CL')+'</b></div></div></article>',
        '</section>',
        '<div class="mcFooter"><span>Fuente: snapshot Maestro de la sesión activa · fórmulas y datos originales preservados.</span><span>Panel Macro PRO V6 · '+period+'</span></div>',
        '</div>'
      ].join('');
      $('mcV6Refresh')?.addEventListener('click',render);
    }catch(e){errorView(e?.message||String(e))}
  }
  function install(){
    const original=window.show;
    if(typeof original==='function'&&!window.__MC_MACRO_V6_SHOW_WRAPPED__){window.__MC_MACRO_V6_SHOW_WRAPPED__=true;window.show=function(page,...args){const p=String(page||'').toLowerCase();if(p.includes('macro')||p.includes('control')){render();return}return original.apply(this,[page,...args])}}
    const target=$('content');if(target)new MutationObserver(()=>{const title=$('pageTitle');const active=title&&/panel macro|centro de control/i.test(title.textContent||'');document.documentElement.classList.toggle('mcMacroActive',!!active);if(active&&!document.querySelector('.mcV6'))render()}).observe(target,{childList:true,subtree:false});
    setTimeout(()=>{const title=$('pageTitle');if(title&&/panel macro|centro de control/i.test(title.textContent||''))render()},100);
  }
  install();
})();
