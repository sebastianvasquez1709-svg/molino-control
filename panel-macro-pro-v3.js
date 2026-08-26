/* Molino Control · Panel Macro PRO V3
 * LYRA presentation layer only. Real snapshot data; no business mutations.
 * Robust dates, signed document semantics, KPI safeguards, and executive visuals.
 */
(() => {
  'use strict';
  if (window.__MC_MACRO_PRO_V3__) return;
  window.__MC_MACRO_PRO_V3__ = true;

  const STYLE_ID='mc-macro-pro-v3-style';
  const $=id=>document.getElementById(id);
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
  const money=v=>Math.round(n(v)).toLocaleString('es-CL');
  const qty=v=>n(v).toLocaleString('es-CL',{maximumFractionDigits:2});
  const pct=v=>`${n(v).toFixed(1)}%`;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const sum=(rows,fn)=>rows.reduce((a,r)=>a+n(fn(r)),0);

  function parseDate(v){
    if(v instanceof Date&&!Number.isNaN(v.getTime())) return v;
    if(typeof v==='number'&&v>20000&&v<60000){const d=new Date(Date.UTC(1899,11,30));d.setUTCDate(d.getUTCDate()+v);return d;}
    const s=String(v??'').trim();
    if(!s) return null;
    let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m){const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));return Number.isNaN(d.getTime())?null:d;}
    m=s.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})/); if(m){const d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));return Number.isNaN(d.getTime())?null:d;}
    const d=new Date(s);return Number.isNaN(d.getTime())?null:d;
  }
  const monthKey=v=>{const d=parseDate(v);return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`:''};
  const monthLabel=k=>{const m=String(k||'').match(/^(\d{4})-(\d{2})$/);if(!m)return 'Sin período';return new Date(Number(m[1]),Number(m[2])-1,1).toLocaleDateString('es-CL',{month:'short',year:'numeric'}).replace('.','');};
  const classify=t=>{const s=String(t||'').toUpperCase();return{invoice:/FACTURA/.test(s),boleta:/BOLETA/.test(s),guide:/GU[IÍ]A/.test(s),nc:/NOTA DE CR[EÉ]DITO/.test(s),nd:/NOTA DE D[EÉ]BITO/.test(s)};};

  // Accounting semantics: sales docs add; credit notes subtract; debit notes add.
  function signedDoc(d,field){
    const c=classify(d?.tipo); const value=n(d?.[field]);
    if(c.nc) return -Math.abs(value);
    if(c.nd) return Math.abs(value);
    return value;
  }
  function salesLike(d){const c=classify(d?.tipo);return c.invoice||c.boleta||c.nc||c.nd;}

  function model(s){
    const docs=Array.isArray(s?.documents)?s.documents:[];
    const dispatches=Array.isArray(s?.dispatches)?s.dispatches:[];
    const clients=Array.isArray(s?.clients)?s.clients:[];
    const products=Array.isArray(s?.products)?s.products:[];
    const commercial=docs.filter(salesLike);
    const saleDocs=docs.filter(d=>{const c=classify(d?.tipo);return c.invoice||c.boleta});
    const net=sum(commercial,d=>signedDoc(d,'neto'));
    const iva=sum(commercial,d=>signedDoc(d,'iva'));
    const total=sum(commercial,d=>signedDoc(d,'total'));
    const kg=sum(saleDocs,d=>Math.max(0,n(d?.datos?.kilos)));
    const sacos=sum(saleDocs,d=>Math.max(0,n(d?.datos?.sacos)));
    const dkg=sum(dispatches,d=>Math.max(0,n(d?.kg??d?.kilos)));
    const dsacos=sum(dispatches,d=>Math.max(0,n(d?.sacos)));
    const granel=sum(dispatches.filter(d=>/GRANEL/i.test(String(d?.producto||''))),d=>Math.max(0,n(d?.kg??d?.kilos)));
    const priceKg=kg>0?net/kg:null;

    const months={};
    commercial.forEach(d=>{const k=monthKey(d?.fecha);if(k)months[k]=(months[k]||0)+signedDoc(d,'neto')});
    const monthly=Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12);
    const current=monthly.at(-1)?.[1]??null, previous=monthly.at(-2)?.[1]??null;
    const mom=(current!==null&&previous!==null&&previous!==0)?((current-previous)/Math.abs(previous))*100:null;

    const clientMap={}; commercial.forEach(d=>{const key=String(d?.cliente||'Sin cliente').trim()||'Sin cliente';clientMap[key]=(clientMap[key]||0)+signedDoc(d,'neto')});
    const topClients=Object.entries(clientMap).filter(([,v])=>v!==0).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const top5Share=net?sum(topClients.slice(0,5),x=>x[1])/net*100:null;

    const productSales={};
    saleDocs.forEach(d=>{const key=String(d?.producto||d?.producto_tipo||'Sin producto').trim()||'Sin producto';productSales[key]=(productSales[key]||0)+Math.max(0,n(d?.datos?.kilos))});
    const topProducts=Object.entries(productSales).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,10);

    const dispatchProducts={};
    dispatches.forEach(d=>{const key=String(d?.producto||'Sin producto').trim()||'Sin producto';dispatchProducts[key]=(dispatchProducts[key]||0)+Math.max(0,n(d?.kg??d?.kilos))});
    const topDispatchProducts=Object.entries(dispatchProducts).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,8);

    const counts={
      invoice:docs.filter(d=>classify(d?.tipo).invoice).length,
      boleta:docs.filter(d=>classify(d?.tipo).boleta).length,
      nc:docs.filter(d=>classify(d?.tipo).nc).length,
      nd:docs.filter(d=>classify(d?.tipo).nd).length,
      guide:docs.filter(d=>classify(d?.tipo).guide).length
    };
    const qa={
      withoutDate:docs.filter(d=>!parseDate(d?.fecha)).length,
      commercialZeroNet:commercial.filter(d=>n(d?.neto)===0).length,
      invoicesNegative:saleDocs.filter(d=>classify(d?.tipo).invoice&&n(d?.neto)<0).length,
      noClient:commercial.filter(d=>!(String(d?.cliente||'').trim())).length
    };
    return {docs,dispatches,clients,products,commercial,saleDocs,net,iva,total,kg,sacos,dkg,dsacos,granel,priceKg,monthly,current,previous,mom,topClients,top5Share,topProducts,topDispatchProducts,counts,qa};
  }

  function style(){
    if($(STYLE_ID)) return;
    const s=document.createElement('style');s.id=STYLE_ID;
    s.textContent=`
      html.mcMacroActive,html.mcMacroActive body{background:#07090b!important;color:#eef1f4!important}
      .mcMacroActive .sidebar{background:linear-gradient(180deg,#050608,#0b0d10 55%,#050608)!important;border-right:1px solid #24282d!important}
      .mcMacroActive .topbar{background:#080b0e!important;border-bottom:1px solid #24282d!important;box-shadow:none!important}
      .mcMacroActive .content{max-width:none!important;padding:14px!important;background:linear-gradient(180deg,#07090b,#0a0c0f)!important}
      .mcV3{--blue:#2b83ff;--green:#28c76f;--purple:#9b6cff;--orange:#f3a400;--cyan:#19c7da;--red:#ef5350;--line:#282e34;--muted:#808a94;max-width:1700px;margin:0 auto;padding:16px;background:linear-gradient(145deg,#060708,#0c0f12 55%,#070809);border:1px solid #20262c;border-radius:18px;min-height:calc(100vh - 106px);box-shadow:0 16px 50px rgba(0,0,0,.28);font-family:Inter,Segoe UI,Arial,sans-serif}
      .mcV3 *{box-sizing:border-box}.mcV3Head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:12px}.mcV3Title h1{font-size:28px;letter-spacing:-.6px;margin:0;color:#fff}.mcV3Title p{margin:3px 0;color:#7d8791;font-size:10px}.mcV3Tools{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.mcV3Chip,.mcV3Btn{background:#101417;border:1px solid #2c333a;color:#dce2e7;border-radius:9px;padding:8px 10px;font-size:10px;font-weight:800}.mcV3Btn{cursor:pointer}.mcV3Status{display:inline-flex;align-items:center;gap:6px;border:1px solid #28543a;background:#0e1711;color:#a4e9bc;border-radius:999px;padding:7px 10px;font-size:10px;font-weight:800}.mcV3Status i{width:7px;height:7px;border-radius:50%;background:var(--green)}
      .mcV3Kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}.mcV3Kpi{background:linear-gradient(180deg,#121518,#0d1012);border:1px solid var(--line);border-radius:12px;min-height:112px;padding:12px;border-top:2px solid var(--accent)}.mcV3Kpi small{color:#8f98a1;font-size:8px;text-transform:uppercase;letter-spacing:.09em}.mcV3Kpi strong{display:block;color:#fff;font-size:21px;line-height:1.15;margin-top:7px}.mcV3Kpi span{display:block;color:#69747e;font-size:8px;margin-top:5px}.aBlue{--accent:var(--blue)}.aGreen{--accent:var(--green)}.aPurple{--accent:var(--purple)}.aOrange{--accent:var(--orange)}.aCyan{--accent:var(--cyan)}.aRed{--accent:var(--red)}
      .mcV3Grid{display:grid;grid-template-columns:1.35fr .9fr 1fr;gap:9px;margin-top:9px}.mcV3Grid2{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-top:9px}.mcV3Panel{background:linear-gradient(180deg,#111417,#0d1012);border:1px solid #252c32;border-radius:12px;padding:13px;min-width:0}.mcV3Panel h3{margin:0;font-size:12px;color:#f6f7f8}.mcV3Sub{margin-top:3px;color:#747f89;font-size:8px}.mcV3Note{margin-top:8px;color:#818c95;font-size:8px;line-height:1.4}.mcV3Loading{display:grid;place-items:center;min-height:220px;color:#818c95;border:1px solid #2a3036;border-radius:10px;background:#0f1215}.mcV3Error{padding:20px;border:1px solid #5b3030;background:#1b0e0e;color:#ffb7b3;border-radius:10px}
      .mcBars{display:grid;gap:7px;margin-top:12px}.mcBar{display:grid;grid-template-columns:120px 1fr 86px;gap:7px;align-items:center}.mcBar label{font-size:8px;color:#aeb6bd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mcTrack{height:8px;background:#22282e;border-radius:999px;overflow:hidden}.mcTrack i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--bar),rgba(255,255,255,.48))}.mcBar b{font-size:8px;text-align:right;color:#edf0f2}
      .mcLine{margin-top:8px}.mcLine svg{display:block;width:100%;height:220px}.mcGridLine{stroke:#252b31;stroke-width:1}.mcAxisLabel{fill:#717c85;font-size:8px}.mcValueLabel{fill:#e3e8ec;font-size:8px;font-weight:800}.mcLinePath{fill:none;stroke:var(--blue);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.mcPoint{fill:#0c1013;stroke:var(--blue);stroke-width:3}.mcArea{fill:rgba(43,131,255,.10)}
      .mcDocMix{display:grid;gap:8px;margin-top:13px}.mcDoc{display:grid;grid-template-columns:78px 1fr 55px;gap:7px;align-items:center;font-size:8px}.mcDoc span{color:#aab3ba}.mcDoc b{text-align:right;color:#eef1f3}.mcDocTrack{height:9px;background:#22282e;border-radius:999px;overflow:hidden}.mcDocTrack i{display:block;height:100%;border-radius:999px;background:var(--c)}
      .mcTiles{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:12px}.mcTile{background:#111518;border:1px solid #252c32;border-left:2px solid var(--c);border-radius:9px;padding:9px}.mcTile small{display:block;color:#7d8892;font-size:7px;text-transform:uppercase}.mcTile b{display:block;color:#fff;font-size:16px;margin-top:4px}.mcAudit{display:grid;gap:7px;margin-top:10px}.mcAuditRow{display:flex;justify-content:space-between;gap:8px;padding:8px 9px;border:1px solid #252c32;border-radius:9px;background:#101417;font-size:8px}.mcAuditRow span{color:#aeb6bd}.mcAuditRow b{color:#fff}.mcAuditRow.ok b{color:#8ee4aa}.mcAuditRow.warn b{color:#f6cf83}.mcFooter{margin-top:9px;padding:9px 11px;border:1px solid #22282e;border-radius:9px;background:#0a0d10;color:#727d86;font-size:8px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
      @media(max-width:1250px){.mcV3Kpis{grid-template-columns:repeat(3,1fr)}.mcV3Grid{grid-template-columns:1.15fr .85fr}.mcV3Grid>.mcV3Panel:last-child{grid-column:1/-1}.mcV3Grid2{grid-template-columns:1fr 1fr}.mcV3Grid2>.mcV3Panel:last-child{grid-column:1/-1}}
      @media(max-width:760px){.mcV3{padding:11px}.mcV3Head{flex-direction:column}.mcV3Kpis{grid-template-columns:repeat(2,1fr)}.mcV3Grid,.mcV3Grid2{grid-template-columns:1fr}.mcV3Grid>.mcV3Panel:last-child,.mcV3Grid2>.mcV3Panel:last-child{grid-column:auto}.mcTiles{grid-template-columns:1fr 1fr}.mcBar{grid-template-columns:90px 1fr 74px}}
      @media(max-width:460px){.mcV3Kpis,.mcTiles{grid-template-columns:1fr}.mcV3Title h1{font-size:23px}}
      @media(prefers-reduced-motion:reduce){.mcV3 *{scroll-behavior:auto!important}}
    `;
    document.head.appendChild(s);
  }

  function lineChart(monthly){
    if(!monthly.length) return '<div class="mcV3Loading">No hay períodos con fecha válida para graficar.</div>';
    const w=720,h=220,p=26,max=Math.max(1,...monthly.map(x=>Math.abs(x[1]))),den=Math.max(1,monthly.length-1);
    const pts=monthly.map((x,i)=>({x:p+i*((w-p*2)/den),y:h-p-(Math.abs(x[1])/max)*(h-p*2),v:x[1],k:x[0]}));
    const path=pts.map((q,i)=>(i?'L':'M')+q.x.toFixed(1)+','+q.y.toFixed(1)).join(' ');
    const area=`M ${pts[0].x} ${h-p} L ${pts.map(q=>q.x+' '+q.y).join(' L ')} L ${pts[pts.length-1].x} ${h-p} Z`;
    return `<div class="mcLine"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line class="mcGridLine" x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}"/><line class="mcGridLine" x1="${p}" y1="${h/2}" x2="${w-p}" y2="${h/2}"/><line class="mcGridLine" x1="${p}" y1="${p}" x2="${w-p}" y2="${p}"/><path d="${area}" class="mcArea"/><path d="${path}" class="mcLinePath"/>${pts.map(q=>`<circle class="mcPoint" cx="${q.x}" cy="${q.y}" r="4"/><text class="mcValueLabel" x="${q.x}" y="${Math.max(11,q.y-8)}" text-anchor="middle">${money(q.v/1000000)}M</text><text class="mcAxisLabel" x="${q.x}" y="${h-6}" text-anchor="middle">${esc(monthLabel(q.k))}</text>`).join('')}</svg></div>`;
  }

  function bars(items,format,accent){
    if(!items.length)return '<div class="mcV3Loading">Sin datos</div>';
    const max=Math.max(1,...items.map(x=>Math.abs(x[1])));
    return `<div class="mcBars">${items.map(([k,v])=>`<div class="mcBar"><label title="${esc(k)}">${esc(k)}</label><div class="mcTrack"><i style="--bar:${accent};width:${Math.max(3,Math.round(Math.abs(v)/max*100))}%"></i></div><b>${format(v)}</b></div>`).join('')}</div>`;
  }

  async function render(){
    style();
    document.documentElement.classList.add('mcMacroActive');
    const c=$('content');if(!c)return;
    const pt=$('pageTitle');if(pt)pt.textContent='Panel Macro';
    c.innerHTML='<div class="mcV3"><div class="mcV3Head"><div class="mcV3Title"><h1>PANEL MACRO</h1><p>CENTRO DE CONTROL EJECUTIVO · MOLINO SAN MIGUEL LTDA.</p></div><div class="mcV3Tools"><span class="mcV3Status"><i></i> MAESTRO CONECTADO</span><span class="mcV3Chip">Cargando…</span><button class="mcV3Btn" id="mcV3Retry">↻ Actualizar</button></div></div><div class="mcV3Loading">Validando datos reales del Maestro…</div></div>';
    try{
      const snap=await window.MolinoCloud.snapshot({force:true});
      const m=model(snap);
      if(!m.docs.length&&!m.clients.length&&!m.dispatches.length) throw new Error('El Maestro no devolvió registros operacionales.');
      const month= m.monthly.at(-1)?.[0]||'';
      const monthValue=m.current??0;
      const avgMonthly=m.monthly.length?sum(m.monthly,x=>x[1])/m.monthly.length:0;
      const latestDate=m.docs.map(d=>parseDate(d?.fecha)).filter(Boolean).sort((a,b)=>b-a)[0];
      const period=latestDate?latestDate.toLocaleDateString('es-CL',{month:'long',year:'numeric'}):'Período actual';
      const docMix=[['Facturas',m.counts.invoice,'#2b83ff'],['Boletas',m.counts.boleta,'#28c76f'],['NC',m.counts.nc,'#f3a400'],['ND',m.counts.nd,'#ef5350'],['Guías',m.counts.guide,'#9b6cff']];
      const maxDoc=Math.max(1,...docMix.map(x=>x[1]));
      c.innerHTML=`
        <div class="mcV3">
          <div class="mcV3Head"><div class="mcV3Title"><h1>PANEL MACRO</h1><p>CENTRO DE CONTROL EJECUTIVO · MOLINO SAN MIGUEL LTDA.</p></div><div class="mcV3Tools"><span class="mcV3Status"><i></i> MAESTRO CONECTADO</span><span class="mcV3Chip">${esc(period)}</span><button class="mcV3Btn" id="mcV3Retry">↻ Actualizar</button></div></div>
          <div class="mcV3Kpis">
            <div class="mcV3Kpi aBlue"><small>Venta neta ajustada</small><strong>$ ${money(m.net)}</strong><span>Facturas + Boletas + ND − NC</span></div>
            <div class="mcV3Kpi aGreen"><small>Venta total ajustada</small><strong>$ ${money(m.total)}</strong><span>Neto + IVA según documentos</span></div>
            <div class="mcV3Kpi aPurple"><small>IVA ajustado</small><strong>$ ${money(m.iva)}</strong><span>Base comercial</span></div>
            <div class="mcV3Kpi aOrange"><small>KG vendidos</small><strong>${qty(m.kg)}</strong><span>Solo documentos de venta</span></div>
            <div class="mcV3Kpi aOrange"><small>Precio neto / KG</small><strong>${m.priceKg===null?'—':'$ '+money(m.priceKg)}</strong><span>Venta neta ÷ KG vendidos</span></div>
            <div class="mcV3Kpi aCyan"><small>KG despachados</small><strong>${qty(m.dkg)}</strong><span>Operación de despachos</span></div>
          </div>

          <div class="mcV3Grid">
            <section class="mcV3Panel"><h3>EVOLUCIÓN DE VENTAS NETAS</h3><div class="mcV3Sub">Últimos 12 períodos válidos del Maestro</div>${lineChart(m.monthly)}<div class="mcFooter"><span>Último período: $ ${money(monthValue)}</span><span>Variación MoM: ${m.mom===null?'—':pct(m.mom)}</span><span>Promedio: $ ${money(avgMonthly)}</span></div></section>
            <section class="mcV3Panel"><h3>MIX DOCUMENTAL</h3><div class="mcV3Sub">Comparación por volumen de documentos</div><div class="mcDocMix">${docMix.map(([k,v,c])=>`<div class="mcDoc"><span>${k}</span><div class="mcDocTrack"><i style="--c:${c};width:${Math.max(2,Math.round(v/maxDoc*100))}%"></i></div><b>${v.toLocaleString('es-CL')}</b></div>`).join('')}</div><div class="mcV3Note">Separa Guías de la venta y conserva NC/ND como ajustes.</div></section>
            <section class="mcV3Panel"><h3>TOP 10 CLIENTES</h3><div class="mcV3Sub">Venta neta ajustada</div>${bars(m.topClients,v=>'$ '+money(v),'#2b83ff')}<div class="mcV3Note">Top 5 representa ${m.top5Share===null?'—':pct(m.top5Share)} del neto total.</div></section>
          </div>

          <div class="mcV3Grid2">
            <section class="mcV3Panel"><h3>TOP 10 PRODUCTOS</h3><div class="mcV3Sub">KG vendidos</div>${bars(m.topProducts,v=>qty(v)+' kg','#28c76f')}</section>
            <section class="mcV3Panel"><h3>CONTROL COMERCIAL</h3><div class="mcTiles"><div class="mcTile" style="--c:#2b83ff"><small>Facturas</small><b>${m.counts.invoice.toLocaleString('es-CL')}</b></div><div class="mcTile" style="--c:#28c76f"><small>Boletas</small><b>${m.counts.boleta.toLocaleString('es-CL')}</b></div><div class="mcTile" style="--c:#f3a400"><small>NC</small><b>${m.counts.nc.toLocaleString('es-CL')}</b></div><div class="mcTile" style="--c:#ef5350"><small>ND</small><b>${m.counts.nd.toLocaleString('es-CL')}</b></div><div class="mcTile" style="--c:#9b6cff"><small>Guías</small><b>${m.counts.guide.toLocaleString('es-CL')}</b></div><div class="mcTile" style="--c:#19c7da"><small>Clientes</small><b>${m.clients.length.toLocaleString('es-CL')}</b></div></div></section>
            <section class="mcV3Panel"><h3>CONTROL OPERATIVO</h3><div class="mcTiles"><div class="mcTile" style="--c:#2b83ff"><small>Despachos</small><b>${m.dispatches.length.toLocaleString('es-CL')}</b></div><div class="mcTile" style="--c:#28c76f"><small>KG despachados</small><b>${qty(m.dkg)}</b></div><div class="mcTile" style="--c:#f3a400"><small>Sacos despachados</small><b>${qty(m.dsacos)}</b></div><div class="mcTile" style="--c:#19c7da"><small>Granel</small><b>${qty(m.granel)} kg</b></div><div class="mcTile" style="--c:#9b6cff"><small>Productos</small><b>${m.products.length.toLocaleString('es-CL')}</b></div><div class="mcTile" style="--c:#ef5350"><small>Valor neto/kg</small><b>${m.priceKg===null?'—':'$ '+money(m.priceKg)}</b></div></div></section>
          </div>

          <div class="mcV3Grid2">
            <section class="mcV3Panel"><h3>TOP PRODUCTOS DESPACHADOS</h3><div class="mcV3Sub">Operación · KG</div>${bars(m.topDispatchProducts,v=>qty(v)+' kg','#19c7da')}</section>
            <section class="mcV3Panel"><h3>CONTROL DE CALIDAD DEL DATO</h3><div class="mcAudit"><div class="mcAuditRow ${m.qa.withoutDate?'warn':'ok'}"><span>Documentos sin fecha válida</span><b>${m.qa.withoutDate.toLocaleString('es-CL')}</b></div><div class="mcAuditRow ${m.qa.commercialZeroNet?'warn':'ok'}"><span>Documentos comerciales con neto $0</span><b>${m.qa.commercialZeroNet.toLocaleString('es-CL')}</b></div><div class="mcAuditRow ${m.qa.invoicesNegative?'warn':'ok'}"><span>Facturas con neto negativo</span><b>${m.qa.invoicesNegative.toLocaleString('es-CL')}</b></div><div class="mcAuditRow ${m.qa.noClient?'warn':'ok'}"><span>Documentos comerciales sin cliente</span><b>${m.qa.noClient.toLocaleString('es-CL')}</b></div></div></section>
            <section class="mcV3Panel"><h3>RESUMEN EJECUTIVO</h3><div class="mcTiles"><div class="mcTile" style="--c:#2b83ff"><small>Documentos</small><b>${m.docs.length.toLocaleString('es-CL')}</b></div><div class="mcTile" style="--c:#28c76f"><small>KG vendidos</small><b>${qty(m.kg)}</b></div><div class="mcTile" style="--c:#f3a400"><small>Sacos vendidos</small><b>${qty(m.sacos)}</b></div><div class="mcTile" style="--c:#19c7da"><small>Granel despachado</small><b>${qty(m.granel)} kg</b></div><div class="mcTile" style="--c:#9b6cff"><small>Precio neto/kg</small><b>${m.priceKg===null?'—':'$ '+money(m.priceKg)}</b></div><div class="mcTile" style="--c:#ef5350"><small>MoM</small><b>${m.mom===null?'—':pct(m.mom)}</b></div></div></section>
          </div>
          <div class="mcFooter"><span>Datos: snapshot Maestro · reglas semánticas: venta + ND − NC · Guías excluidas de ventas.</span><span>${month?`Último período válido: ${esc(monthLabel(month))}`:'Sin período válido'}</span></div>
        </div>`;
      $('mcV3Retry')?.addEventListener('click',render);
    }catch(e){
      c.innerHTML=`<div class="mcV3"><div class="mcV3Head"><div class="mcV3Title"><h1>PANEL MACRO</h1><p>CENTRO DE CONTROL EJECUTIVO · MOLINO SAN MIGUEL LTDA.</p></div><button class="mcV3Btn" id="mcV3Retry">↻ Reintentar</button></div><div class="mcV3Error">${esc(e?.message||e||'No fue posible cargar el Maestro.')}</div></div>`;
      $('mcV3Retry')?.addEventListener('click',render);
    }
  }

  function install(){
    const original=window.show;
    if(typeof original==='function'&&!window.__MC_MACRO_SHOW_WRAPPED_V3__){
      window.__MC_MACRO_SHOW_WRAPPED_V3__=true;
      window.show=function(page,...args){const p=String(page||'').toLowerCase();if(p.includes('macro')||p.includes('control')){render();return}return original.apply(this,[page,...args]);};
    }
    const obs=new MutationObserver(()=>{const title=$('pageTitle');if(title&&/panel macro|centro de control/i.test(title.textContent||'')){if(!document.querySelector('.mcV3'))render();document.documentElement.classList.add('mcMacroActive')}else if(!document.querySelector('.mcV3'))document.documentElement.classList.remove('mcMacroActive')});
    const t=$('pageTitle');if(t)obs.observe(t,{childList:true,subtree:true,characterData:true});
    setTimeout(()=>{const title=$('pageTitle');if(title&&/panel macro|centro de control/i.test(title.textContent||''))render();},120);
  }
  install();
})();
