/* Molino Control · Panel Macro Enhanced V2
 * LYRA / Principal Engineer: dashboard presentation only.
 * Source of truth: MolinoCloud.snapshot(). No hardcoded business totals.
 * If live data cannot be loaded, show an explicit error — never fake zeros.
 */
(() => {
  'use strict';
  const VERSION='2.0.0';
  const STYLE_ID='mc-macro-v2-style';
  const $id=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
  const money=v=>n(v).toLocaleString('es-CL',{maximumFractionDigits:0});
  const qty=v=>n(v).toLocaleString('es-CL',{maximumFractionDigits:2});
  const dateKey=v=>{const s=String(v||'');return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):''};
  const monthKey=v=>dateKey(v).slice(0,7);
  const monthLabel=key=>{if(!/^\d{4}-\d{2}$/.test(key))return 'Período actual';const [y,m]=key.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('es-CL',{month:'short',year:'numeric'}).replace('.', '')};
  const sum=(rows,getter)=>rows.reduce((a,r)=>a+n(getter(r)),0);

  function installStyle(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`
      :root{--mc-bg:#07111f;--mc-panel:#0d1b2d;--mc-panel2:#10233a;--mc-line:#1e334c;--mc-text:#eaf2fb;--mc-muted:#90a4bc;--mc-blue:#3b82f6;--mc-cyan:#22d3ee;--mc-green:#34d399;--mc-amber:#f59e0b;--mc-red:#fb7185;--mc-shadow:0 18px 50px rgba(0,0,0,.22)}
      .mcV2{color:var(--mc-text);font-family:Inter,Segoe UI,Arial,sans-serif;background:radial-gradient(circle at top right,rgba(35,97,171,.18),transparent 32%),linear-gradient(180deg,#07111f 0%,#091624 100%);border-radius:22px;padding:20px;box-shadow:var(--mc-shadow);min-height:calc(100vh - 150px)}
      .mcV2 *{box-sizing:border-box}.mcV2 button{font-family:inherit}.mcV2Head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:16px}.mcV2Title{display:flex;align-items:center;gap:12px}.mcV2Icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,#153b6f,#1767b6);font-size:22px;box-shadow:0 10px 24px rgba(26,103,182,.25)}.mcV2Title h3{margin:0;color:#fff;font-size:23px;letter-spacing:-.4px}.mcV2Sub{margin-top:4px;color:var(--mc-muted);font-size:12px}.mcV2Actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.mcV2Badge{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid rgba(52,211,153,.25);border-radius:999px;background:rgba(52,211,153,.08);color:#9af2cb;font-size:11px;font-weight:800}.mcV2Btn{border:1px solid var(--mc-line);background:#0f2136;color:#dce8f5;border-radius:10px;padding:9px 12px;font-weight:800;cursor:pointer}.mcV2Btn:hover{border-color:#34577c;background:#132943}.mcV2Hero{display:grid;grid-template-columns:1.25fr .75fr;gap:14px}.mcV2HeroCard,.mcV2Panel{background:linear-gradient(180deg,rgba(14,31,50,.94),rgba(10,24,40,.94));border:1px solid var(--mc-line);border-radius:17px;box-shadow:0 8px 30px rgba(0,0,0,.12)}.mcV2HeroCard{padding:18px 20px;position:relative;overflow:hidden}.mcV2HeroCard:after{content:"";position:absolute;inset:auto -25px -50px auto;width:190px;height:190px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,.16),transparent 65%)}.mcV2Eyebrow{color:#6fc7ff;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.mcV2HeroCard h4{margin:8px 0 4px;font-size:29px;letter-spacing:-.8px}.mcV2HeroCard p{margin:0;color:var(--mc-muted);font-size:12px;max-width:650px}.mcV2HeroMetric{display:flex;gap:22px;flex-wrap:wrap;margin-top:18px}.mcV2HeroMetric div{min-width:140px}.mcV2HeroMetric span{display:block;color:var(--mc-muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em}.mcV2HeroMetric strong{display:block;color:#fff;font-size:20px;margin-top:4px}.mcV2Health{padding:16px}.mcV2Health h4{margin:0 0 12px;font-size:14px}.mcHealthItem{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:11px}.mcHealthItem:last-child{border-bottom:0}.mcHealthItem b{color:#fff}.mcHealthItem span{color:var(--mc-muted)}.mcV2Kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-top:14px}.mcKpi{padding:14px;border:1px solid var(--mc-line);background:linear-gradient(180deg,#0d2034,#0b1a2c);border-radius:15px;min-height:105px}.mcKpi small{display:block;color:var(--mc-muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em}.mcKpi strong{display:block;color:#fff;font-size:22px;margin-top:7px;letter-spacing:-.35px}.mcKpi span{display:block;color:#7fa3c7;font-size:10px;margin-top:4px}.mcAccentBlue{border-top:2px solid var(--mc-blue)}.mcAccentCyan{border-top:2px solid var(--mc-cyan)}.mcAccentGreen{border-top:2px solid var(--mc-green)}.mcAccentAmber{border-top:2px solid var(--mc-amber)}.mcAccentRed{border-top:2px solid var(--mc-red)}.mcV2Grid{display:grid;grid-template-columns:1.4fr .8fr;gap:14px;margin-top:14px}.mcV2Panel{padding:16px}.mcV2Panel h4{margin:0;color:#fff;font-size:14px}.mcV2Panel .mcPanelSub{color:var(--mc-muted);font-size:10px;margin-top:3px}.mcChart{margin-top:14px;display:grid;gap:8px}.mcBarRow{display:grid;grid-template-columns:90px 1fr 100px;gap:8px;align-items:center;font-size:10px}.mcBarLabel{color:#a9bed6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mcTrack{height:10px;border-radius:999px;background:#12253a;overflow:hidden}.mcTrack i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#2466cb,#22d3ee)}.mcBarValue{text-align:right;color:#e7f1fc;font-weight:800}.mcMiniGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.mcMini{padding:10px 11px;border:1px solid rgba(255,255,255,.06);background:#0b1a2a;border-radius:12px}.mcMini small{display:block;color:var(--mc-muted);font-size:9px}.mcMini b{display:block;color:#fff;font-size:17px;margin-top:4px}.mcMix{display:flex;align-items:center;gap:18px;margin-top:14px}.mcDonut{width:126px;height:126px;border-radius:50%;background:conic-gradient(#3b82f6 0 63%,#22d3ee 63% 89%,#f59e0b 89% 98%,#fb7185 98% 100%);position:relative;flex:none}.mcDonut:after{content:"";position:absolute;inset:28px;border-radius:50%;background:#0d1b2d;border:1px solid rgba(255,255,255,.06)}.mcLegend{display:grid;gap:7px;width:100%}.mcLegendRow{display:flex;justify-content:space-between;gap:10px;color:#b5c7dc;font-size:10px}.mcLegendRow b{color:#fff}.mcTopList{display:grid;gap:8px;margin-top:12px}.mcTopRow{display:grid;grid-template-columns:1fr 90px;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:10px}.mcTopRow:last-child{border-bottom:0}.mcTopRow span{color:#b7c9de;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mcTopRow b{text-align:right;color:#fff}.mcV2Footer{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;color:#7187a0;font-size:9px}.mcV2Error{margin-top:12px;padding:14px;background:rgba(251,113,133,.08);border:1px solid rgba(251,113,133,.28);border-radius:12px;color:#ffb3c0;font-size:11px}.mcV2Empty{padding:24px;text-align:center;color:var(--mc-muted);border:1px dashed #2a415d;border-radius:12px;background:#0a1929}
      @media(max-width:1200px){.mcV2Kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.mcV2Hero,.mcV2Grid{grid-template-columns:1fr}}
      @media(max-width:720px){.mcV2{padding:13px;border-radius:16px}.mcV2Kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.mcV2HeroMetric{gap:14px}.mcBarRow{grid-template-columns:78px 1fr 76px}.mcMix{align-items:flex-start;flex-direction:column}}
      @media(max-width:480px){.mcV2Kpis{grid-template-columns:1fr}.mcKpi strong{font-size:20px}.mcV2HeroCard h4{font-size:23px}}
    `;
    document.head.appendChild(s);
  }

  function calculate(snap){
    const docs=Array.isArray(snap?.documents)?snap.documents:[];
    const dispatches=Array.isArray(snap?.dispatches)?snap.dispatches:[];
    const clients=Array.isArray(snap?.clients)?snap.clients:[];
    const products=Array.isArray(snap?.products)?snap.products:[];
    const is=d=>(re)=>re.test(String(d?.tipo||''));
    const invoice=d=>/FACTURA/i.test(String(d?.tipo||''));
    const boleta=d=>/BOLETA/i.test(String(d?.tipo||''));
    const guide=d=>/GU[IÍ]A/i.test(String(d?.tipo||''));
    const nc=d=>/NOTA DE CR[EÉ]DITO/i.test(String(d?.tipo||''));
    const nd=d=>/NOTA DE D[EÉ]BITO/i.test(String(d?.tipo||''));
    const sales=docs.filter(d=>invoice(d)||boleta(d));
    const adjustments=docs.filter(d=>nc(d)||nd(d));
    const salesNeto=sum(sales,d=>d?.neto)+sum(adjustments,d=>d?.neto);
    const salesIva=sum(sales,d=>d?.iva)+sum(adjustments,d=>d?.iva);
    const salesTotal=sum(sales,d=>d?.total)+sum(adjustments,d=>d?.total);
    const kilos=sum(sales,d=>d?.datos?.kilos);
    const sacos=sum(sales,d=>d?.datos?.sacos);
    const dispatchKg=sum(dispatches,d=>d?.kg??d?.kilos);
    const dispatchSacos=sum(dispatches,d=>d?.sacos);
    const granelKg=sum(dispatches.filter(d=>/GRANEL/i.test(String(d?.producto||''))),d=>d?.kg??d?.kilos);
    const months={};
    for(const d of sales){const mk=monthKey(d?.fecha);if(!mk)continue;months[mk]=(months[mk]||0)+n(d?.neto)}
    const monthly=Object.entries(months).sort(([a],[b])=>a.localeCompare(b)).slice(-8);
    const maxMonthly=Math.max(1,...monthly.map(([,v])=>Math.abs(v)));
    const clientMap={};
    for(const d of sales){const key=String(d?.cliente||'Sin cliente').trim()||'Sin cliente';clientMap[key]=(clientMap[key]||0)+n(d?.neto)}
    const topClients=Object.entries(clientMap).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,6);
    const productMap={};
    for(const d of dispatches){const key=String(d?.producto||'Sin producto').trim()||'Sin producto';productMap[key]=(productMap[key]||0)+n(d?.kg??d?.kilos)}
    const topProducts=Object.entries(productMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const docMix=[['Facturas',docs.filter(invoice).length,'#3b82f6'],['Boletas',docs.filter(boleta).length,'#22d3ee'],['NC',docs.filter(nc).length,'#f59e0b'],['ND',docs.filter(nd).length,'#fb7185']];
    const activeDocs=docs.filter(d=>invoice(d)||boleta(d));
    let lastDate='';for(const d of activeDocs){const x=dateKey(d?.fecha);if(x>x)lastDate=x}
    return {docs,sales,adjustments,dispatches,clients,products,salesNeto,salesIva,salesTotal,kilos,sacos,dispatchKg,dispatchSacos,granelKg,monthly,maxMonthly,topClients,topProducts,docMix,lastDate, invoices:docs.filter(invoice).length,boletas:docs.filter(boleta).length,guides:docs.filter(guide).length,nc:docs.filter(nc).length,nd:docs.filter(nd).length};
  }

  function barRows(items,max,format){
    if(!items.length)return '<div class="mcV2Empty">Sin datos suficientes para este gráfico.</div>';
    return `<div class="mcChart">${items.map(([label,val])=>`<div class="mcBarRow"><div class="mcBarLabel" title="${esc(label)}">${esc(label)}</div><div class="mcTrack"><i style="width:${Math.max(2,Math.round(Math.abs(val)/max*100))}%"></i></div><div class="mcBarValue">${format(val)}</div></div>`).join('')}</div>`;
  }

  function renderError(err){
    const content=$id('content');
    if(!content)return;
    content.innerHTML=`<div class="mcV2"><div class="mcV2Head"><div class="mcV2Title"><div class="mcV2Icon">📊</div><div><h3>Panel Macro</h3><div class="mcV2Sub">El dashboard no puede mostrar datos ficticios.</div></div></div><button class="mcV2Btn" id="mcV2Retry">↻ Reintentar</button></div><div class="mcV2Error">${esc(err?.message||err||'No se pudo cargar el Maestro.')}</div></div>`;
    $id('mcV2Retry')?.addEventListener('click',renderMacro);
  }

  async function renderMacro(){
    installStyle();
    const content=$id('content');
    if(!content)return;
    const title=$id('pageTitle');if(title)title.textContent='Panel Macro';
    content.innerHTML='<div class="mcV2"><div class="mcV2Head"><div class="mcV2Title"><div class="mcV2Icon">📊</div><div><h3>Panel Macro</h3><div class="mcV2Sub">Conectando con el Maestro validado…</div></div></div><div class="mcV2Badge">● Cargando datos reales</div></div><div class="mcV2Empty">Validando Supabase, documentos, despachos y Maestro. No se muestran ceros mientras carga.</div></div>';
    try{
      const snap=await window.MolinoCloud.snapshot({force:true});
      const m=calculate(snap);
      if(!m.docs.length && !m.clients.length && !m.dispatches.length) throw new Error('Supabase respondió sin registros operacionales. Revisa la sesión y la capa MolinoCloud antes de continuar.');
      const maxMix=Math.max(1,...m.docMix.map(x=>x[1]));
      const mixStops=[];let acc=0;const totalMix=Math.max(1,m.docMix.reduce((a,x)=>a+x[1],0));for(const [,count,color] of m.docMix){const next=acc+(count/totalMix*100);mixStops.push(`${color} ${acc}% ${next}%`);acc=next}
      const latestMonths=m.monthly.map(([k,v])=>[monthLabel(k),v]);
      const recent=m.monthly.length?m.monthly[m.monthly.length-1][1]:0;
      const prev=m.monthly.length>1?m.monthly[m.monthly.length-2][1]:0;
      const delta=prev?((recent-prev)/Math.abs(prev))*100:null;
      const avgKg=m.kilos?m.salesNeto/m.kilos:0;
      const source=snap?.fileName||'Maestro validado';
      content.innerHTML=`<div class="mcV2">
        <div class="mcV2Head"><div class="mcV2Title"><div class="mcV2Icon">📊</div><div><h3>Centro de Control</h3><div class="mcV2Sub">${esc(source)} · datos operacionales en vivo</div></div></div><div class="mcV2Actions"><span class="mcV2Badge">● Maestro conectado</span><button class="mcV2Btn" id="mcV2Refresh">↻ Actualizar</button></div></div>
        <div class="mcV2Hero">
          <div class="mcV2HeroCard"><div class="mcV2Eyebrow">MOLINO CONTROL · VISIÓN EJECUTIVA</div><h4>$ ${money(m.salesNeto)}</h4><p>Ventas netas consolidadas de Facturas y Boletas, ajustadas por Notas de Crédito y Débito. Las Guías quedan separadas del indicador comercial.</p><div class="mcV2HeroMetric"><div><span>KG vendidos</span><strong>${qty(m.kilos)} kg</strong></div><div><span>Valor promedio</span><strong>$ ${money(avgKg)}/kg</strong></div><div><span>Último período</span><strong>${esc(m.lastDate?monthLabel(m.lastDate.slice(0,7)):'Sin fecha')}</strong></div></div></div>
          <div class="mcV2HeroCard mcV2Health"><h4>Control del sistema</h4><div class="mcHealthItem"><span>Documentos</span><b>${m.docs.length.toLocaleString('es-CL')}</b></div><div class="mcHealthItem"><span>Clientes</span><b>${m.clients.length.toLocaleString('es-CL')}</b></div><div class="mcHealthItem"><span>Productos</span><b>${m.products.length.toLocaleString('es-CL')}</b></div><div class="mcHealthItem"><span>Despachos</span><b>${m.dispatches.length.toLocaleString('es-CL')}</b></div><div class="mcHealthItem"><span>KG despachados</span><b>${qty(m.dispatchKg)}</b></div></div>
        </div>
        <div class="mcV2Kpis">
          <div class="mcKpi mcAccentBlue"><small>Venta neta</small><strong>$ ${money(m.salesNeto)}</strong><span>Facturas + Boletas ± NC/ND</span></div>
          <div class="mcKpi mcAccentCyan"><small>Venta total</small><strong>$ ${money(m.salesTotal)}</strong><span>Neto + IVA después de ajustes</span></div>
          <div class="mcKpi mcAccentGreen"><small>IVA</small><strong>$ ${money(m.salesIva)}</strong><span>Documentos comerciales</span></div>
          <div class="mcKpi mcAccentAmber"><small>KG vendidos</small><strong>${qty(m.kilos)}</strong><span>Desde Maestro</span></div>
          <div class="mcKpi mcAccentBlue"><small>Sacos</small><strong>${qty(m.sacos)}</strong><span>Valor Maestro</span></div>
          <div class="mcKpi mcAccentCyan"><small>Granel despachado</small><strong>${qty(m.granelKg)} kg</strong><span>Desde despachos</span></div>
        </div>
        <div class="mcV2Grid">
          <div class="mcV2Panel"><h4>Evolución de ventas netas</h4><div class="mcPanelSub">Últimos períodos disponibles en el Maestro</div>${barRows(latestMonths,m.maxMonthly,v=>'$ '+money(v))}<div class="mcMiniGrid"><div class="mcMini"><small>Período actual</small><b>$ ${money(recent)}</b></div><div class="mcMini"><small>Variación vs anterior</small><b>${delta===null?'—':(delta>=0?'+':'')+delta.toFixed(1)+'%'}</b></div></div></div>
          <div class="mcV2Panel"><h4>Mix documental</h4><div class="mcPanelSub">Volumen de documentos del snapshot</div><div class="mcMix"><div class="mcDonut" style="background:conic-gradient(${mixStops.join(',')})"></div><div class="mcLegend">${m.docMix.map(([label,count])=>`<div class="mcLegendRow"><span>${label}</span><b>${count.toLocaleString('es-CL')}</b></div>`).join('')}</div></div></div>
        </div>
        <div class="mcV2Grid">
          <div class="mcV2Panel"><h4>Top clientes por venta neta</h4><div class="mcPanelSub">Facturas + Boletas, con ajustes NC/ND</div>${barRows(m.topClients,Math.max(1,...m.topClients.map(([,v])=>Math.abs(v))),v=>'$ '+money(v))}</div>
          <div class="mcV2Panel"><h4>Top productos por KG despachado</h4><div class="mcPanelSub">Consolidado desde el módulo de Despachos</div>${barRows(m.topProducts,Math.max(1,...m.topProducts.map(([,v])=>v)),v=>qty(v)+' kg')}</div>
        </div>
        <div class="mcV2Grid">
          <div class="mcV2Panel"><h4>Control comercial</h4><div class="mcTopList"><div class="mcTopRow"><span>Facturas</span><b>${m.invoices.toLocaleString('es-CL')}</b></div><div class="mcTopRow"><span>Boletas</span><b>${m.boletas.toLocaleString('es-CL')}</b></div><div class="mcTopRow"><span>Notas de Crédito</span><b>${m.nc.toLocaleString('es-CL')}</b></div><div class="mcTopRow"><span>Notas de Débito</span><b>${m.nd.toLocaleString('es-CL')}</b></div><div class="mcTopRow"><span>Guías</span><b>${m.guides.toLocaleString('es-CL')}</b></div></div></div>
          <div class="mcV2Panel"><h4>Control operativo</h4><div class="mcTopList"><div class="mcTopRow"><span>Despachos</span><b>${m.dispatches.length.toLocaleString('es-CL')}</b></div><div class="mcTopRow"><span>KG despachados</span><b>${qty(m.dispatchKg)}</b></div><div class="mcTopRow"><span>Sacos despachados</span><b>${qty(m.dispatchSacos)}</b></div><div class="mcTopRow"><span>Clientes activos</span><b>${m.clients.length.toLocaleString('es-CL')}</b></div><div class="mcTopRow"><span>Productos activos</span><b>${m.products.length.toLocaleString('es-CL')}</b></div></div></div>
        </div>
        <div class="mcV2Footer"><span>LYRA V2 · Presentación separada de la capa de datos · sin cifras hardcodeadas</span><span>${m.docs.length.toLocaleString('es-CL')} documentos · ${m.dispatches.length.toLocaleString('es-CL')} despachos</span></div>
      </div>`;
      $id('mcV2Refresh')?.addEventListener('click',renderMacro);
    }catch(err){renderError(err)}
  }

  function install(){
    if(window.__LYRA_MACRO_V2__)return;
    const original=window.show;
    if(typeof original==='function'){
      window.show=function(page,...args){if(page==='macro'){renderMacro();return}return original.apply(this,[page,...args])};
    }
    window.__LYRA_MACRO_V2__=Object.freeze({version:VERSION,render:renderMacro});
    // app.js may render Macro before this file loads; repair that race explicitly.
    setTimeout(()=>{const title=$id('pageTitle');const app=$id('app');if(app&&!app.classList.contains('hidden')&&title&&/Panel Macro/i.test(title.textContent||'')){renderMacro()}},50);
  }
  install();
})();
