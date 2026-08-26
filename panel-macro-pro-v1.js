/* Molino Control · Panel Macro PRO V1
 * LYRA: presentation layer only. No business data hardcoded.
 * Logo/global shell intentionally untouched.
 */
(() => {
  'use strict';
  const VERSION = '1.0.0';
  const STYLE_ID = 'mc-macro-pro-style';
  const $ = id => document.getElementById(id);
  const num = v => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const money = v => num(v).toLocaleString('es-CL', { maximumFractionDigits: 0 });
  const qty = v => num(v).toLocaleString('es-CL', { maximumFractionDigits: 2 });
  const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const dateKey = v => { const s = String(v || ''); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0,10) : ''; };
  const monthKey = v => dateKey(v).slice(0,7);
  const monthLabel = k => { if (!/^\d{4}-\d{2}$/.test(k)) return 'Sin período'; const [y,m] = k.split('-').map(Number); return new Date(y,m-1,1).toLocaleDateString('es-CL',{month:'short',year:'numeric'}).replace('.',''); };
  const sum = (rows, fn) => rows.reduce((a,r) => a + num(fn(r)), 0);

  function installStyle(){
    if($(STYLE_ID)) return;
    const s = document.createElement('style'); s.id = STYLE_ID;
    s.textContent = `
      .mcPro{--bg:#08090b;--panel:#101214;--panel2:#151719;--line:#292d31;--text:#f4f5f6;--muted:#969da5;--blue:#2f80ff;--green:#28c76f;--purple:#9b6cff;--orange:#f59e0b;--cyan:#22d3ee;--red:#ef5350;--pink:#e85aad;min-height:calc(100vh - 120px);padding:18px;background:linear-gradient(145deg,#070809,#101214 55%,#08090b);color:var(--text);font-family:Inter,Segoe UI,Arial,sans-serif;border-radius:18px;overflow:hidden}
      .mcPro *{box-sizing:border-box}.mcPro button{font:inherit}.mcProHead{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:16px}.mcProTitle{display:flex;align-items:center;gap:12px}.mcProMark{width:42px;height:42px;border:1px solid #3a3e43;border-radius:12px;display:grid;place-items:center;background:#111315;color:#fff;font-size:20px}.mcProTitle h1{font-size:24px;margin:0;letter-spacing:-.5px}.mcProTitle p{font-size:11px;color:var(--muted);margin:4px 0 0}.mcProTools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.mcProStatus{font-size:10px;color:#b9c0c7;border:1px solid #30353a;border-radius:999px;padding:7px 10px;background:#101214}.mcProStatus i{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--green);margin-right:6px}.mcProBtn{border:1px solid #353a40;background:#151719;color:#e7e9eb;border-radius:9px;padding:8px 11px;font-weight:800;cursor:pointer}.mcProBtn:hover{background:#1c1f22;border-color:#4b5158}.mcProPeriod{font-size:11px;color:#cbd0d5;border:1px solid #30353a;border-radius:9px;padding:8px 11px;background:#101214}
      .mcProKpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.mcProKpi{background:linear-gradient(180deg,#141618,#0f1113);border:1px solid var(--line);border-radius:12px;padding:13px;min-height:108px;position:relative;overflow:hidden}.mcProKpi:after{content:"";position:absolute;right:-28px;bottom:-42px;width:100px;height:100px;border-radius:50%;background:var(--accent,#fff);opacity:.07}.mcProKpi small{display:block;color:#a6adb4;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.mcProKpi strong{display:block;font-size:21px;margin-top:8px;letter-spacing:-.4px}.mcProKpi span{display:block;color:#727a82;font-size:9px;margin-top:5px}.cBlue{--accent:var(--blue);border-top:2px solid var(--blue)}.cGreen{--accent:var(--green);border-top:2px solid var(--green)}.cPurple{--accent:var(--purple);border-top:2px solid var(--purple)}.cOrange{--accent:var(--orange);border-top:2px solid var(--orange)}.cCyan{--accent:var(--cyan);border-top:2px solid var(--cyan)}.cRed{--accent:var(--red);border-top:2px solid var(--red)}
      .mcProGrid{display:grid;grid-template-columns:1.35fr .8fr 1.05fr;gap:10px;margin-top:10px}.mcProGrid2{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:10px}.mcPanel{background:linear-gradient(180deg,#111315,#0e1012);border:1px solid var(--line);border-radius:12px;padding:14px;min-width:0}.mcPanel h3{margin:0;color:#f5f6f7;font-size:13px}.mcPanelSub{color:#747c84;font-size:9px;margin-top:3px}.mcTrend{height:190px;display:flex;align-items:end;gap:8px;padding:18px 5px 4px;border-bottom:1px solid #25282c;margin-top:8px}.mcTrendCol{height:100%;flex:1;display:flex;align-items:end;justify-content:center;position:relative}.mcTrendBar{width:min(34px,80%);height:max(3%,var(--h));background:linear-gradient(180deg,#2f80ff,#1854aa);border-radius:6px 6px 2px 2px;box-shadow:0 0 16px rgba(47,128,255,.15)}.mcTrendVal{position:absolute;top:-14px;color:#cfd4d9;font-size:8px;white-space:nowrap}.mcTrendLabel{font-size:8px;color:#737b83;position:absolute;bottom:-17px;white-space:nowrap}.mcTrendLegend{display:flex;justify-content:space-between;margin-top:23px;color:#8d959d;font-size:9px}.mcDonutWrap{display:flex;align-items:center;gap:16px;margin-top:16px}.mcDonut{width:126px;height:126px;border-radius:50%;position:relative;flex:none}.mcDonut:after{content:"";position:absolute;inset:30px;background:#101214;border-radius:50%;border:1px solid #292d31}.mcDonutCenter{position:absolute;inset:0;display:grid;place-items:center;z-index:2;font-weight:900;font-size:16px}.mcDonutCenter span{display:block;font-size:8px;color:#777f87;text-align:center;font-weight:600}.mcLegend{display:grid;gap:8px;min-width:0;flex:1}.mcLeg{display:grid;grid-template-columns:10px 1fr auto;gap:6px;align-items:center;font-size:9px;color:#aab1b8}.mcLeg i{width:8px;height:8px;border-radius:50%;background:var(--c)}.mcLeg b{color:#e5e7e9}.mcBars{display:grid;gap:8px;margin-top:15px}.mcBar{display:grid;grid-template-columns:120px 1fr 88px;gap:8px;align-items:center;font-size:9px}.mcBar label{color:#aeb5bc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mcTrack{height:8px;border-radius:999px;background:#22262a;overflow:hidden}.mcTrack i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--bar,#2f80ff),rgba(255,255,255,.55));}.mcBar b{text-align:right;color:#e7e9eb;font-size:9px}.mcList{display:grid;gap:7px;margin-top:13px}.mcListRow{display:grid;grid-template-columns:1fr 92px;gap:8px;align-items:center;border-bottom:1px solid #202327;padding:5px 0;font-size:9px}.mcListRow:last-child{border-bottom:0}.mcListRow span{color:#adb4bb;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mcListRow b{text-align:right;color:#f1f2f3}.mcMetricGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:12px}.mcMini{border:1px solid #25292d;border-radius:9px;background:#121416;padding:10px}.mcMini small{display:block;color:#7d858d;font-size:8px;text-transform:uppercase}.mcMini b{display:block;font-size:17px;margin-top:4px}.mcFooter{margin-top:10px;border:1px solid #22262a;background:#0d0f11;border-radius:10px;padding:10px;color:#777f87;font-size:9px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.mcError{border:1px solid rgba(239,83,80,.35);background:rgba(239,83,80,.08);color:#ffb3af;padding:15px;border-radius:10px;margin-top:10px;font-size:11px}.mcLoading{border:1px solid #292d31;background:#101214;color:#9299a0;border-radius:10px;padding:30px;text-align:center}.mcPulse{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--green);margin-right:7px;animation:mcPulse 1.2s infinite}@keyframes mcPulse{50%{opacity:.35}}
      @media(max-width:1250px){.mcProKpis{grid-template-columns:repeat(3,1fr)}.mcProGrid{grid-template-columns:1.2fr .8fr}.mcProGrid>.mcPanel:last-child{grid-column:1/-1}.mcProGrid2{grid-template-columns:1fr 1fr}.mcProGrid2>.mcPanel:last-child{grid-column:1/-1}}
      @media(max-width:760px){.mcPro{padding:12px}.mcProKpis{grid-template-columns:repeat(2,1fr)}.mcProGrid,.mcProGrid2{grid-template-columns:1fr}.mcProGrid>.mcPanel:last-child,.mcProGrid2>.mcPanel:last-child{grid-column:auto}.mcProHead{align-items:flex-start;flex-direction:column}.mcBar{grid-template-columns:90px 1fr 75px}.mcDonutWrap{align-items:flex-start;flex-direction:column}.mcMetricGrid{grid-template-columns:1fr 1fr}.mcProKpi strong{font-size:19px}}
      @media(max-width:460px){.mcProKpis,.mcMetricGrid{grid-template-columns:1fr}.mcProTitle h1{font-size:21px}}
      @media(prefers-reduced-motion:reduce){.mcPulse{animation:none}.mcPro *{scroll-behavior:auto!important}}
    `;
    document.head.appendChild(s);
  }

  function classify(type){
    const t=String(type||'').toUpperCase();
    return {invoice:/FACTURA/.test(t),boleta:/BOLETA/.test(t),guide:/GU[IÍ]A/.test(t),nc:/NOTA DE CR[EÉ]DITO/.test(t),nd:/NOTA DE D[EÉ]BITO/.test(t)};
  }
  function calculate(s){
    const docs=Array.isArray(s?.documents)?s.documents:[];
    const dispatches=Array.isArray(s?.dispatches)?s.dispatches:[];
    const clients=Array.isArray(s?.clients)?s.clients:[];
    const products=Array.isArray(s?.products)?s.products:[];
    const sales=docs.filter(d=>{const c=classify(d?.tipo);return c.invoice||c.boleta});
    const adj=docs.filter(d=>{const c=classify(d?.tipo);return c.nc||c.nd});
    const net=sum(sales,d=>d?.neto)+sum(adj,d=>d?.neto);
    const iva=sum(sales,d=>d?.iva)+sum(adj,d=>d?.iva);
    const total=sum(sales,d=>d?.total)+sum(adj,d=>d?.total);
    const kg=sum(sales,d=>d?.datos?.kilos);
    const sacos=sum(sales,d=>d?.datos?.sacos);
    const dkg=sum(dispatches,d=>d?.kg??d?.kilos);
    const dsacos=sum(dispatches,d=>d?.sacos);
    const granel=sum(dispatches.filter(d=>/GRANEL/i.test(String(d?.producto||''))),d=>d?.kg??d?.kilos);
    const months={}; sales.forEach(d=>{const k=monthKey(d?.fecha);if(k)months[k]=(months[k]||0)+num(d?.neto)});
    const monthly=Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).slice(-8);
    const cMap={}; sales.forEach(d=>{const k=String(d?.cliente||'Sin cliente').trim()||'Sin cliente';cMap[k]=(cMap[k]||0)+num(d?.neto)});
    const topClients=Object.entries(cMap).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,8);
    const pMap={}; dispatches.forEach(d=>{const k=String(d?.producto||'Sin producto').trim()||'Sin producto';pMap[k]=(pMap[k]||0)+num(d?.kg??d?.kilos)});
    const topProducts=Object.entries(pMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const counts={invoice:docs.filter(d=>classify(d?.tipo).invoice).length,boleta:docs.filter(d=>classify(d?.tipo).boleta).length,nc:docs.filter(d=>classify(d?.tipo).nc).length,nd:docs.filter(d=>classify(d?.tipo).nd).length,guide:docs.filter(d=>classify(d?.tipo).guide).length};
    return {docs,dispatches,clients,products,sales,adj,net,iva,total,kg,sacos,dkg,dsacos,granel,monthly,topClients,topProducts,counts};
  }
  function bars(items,format,accent){
    if(!items.length)return '<div class="mcLoading">Sin datos para mostrar.</div>';
    const max=Math.max(1,...items.map(x=>Math.abs(x[1])));
    return '<div class="mcBars">'+items.map(([k,v])=>`<div class="mcBar"><label title="${esc(k)}">${esc(k)}</label><div class="mcTrack"><i style="--bar:${accent};width:${Math.max(3,Math.round(Math.abs(v)/max*100))}%"></i></div><b>${format(v)}</b></div>`).join('')+'</div>';
  }
  function renderError(err){
    const c=$('content');if(!c)return;
    c.innerHTML=`<div class="mcPro"><div class="mcProHead"><div class="mcProTitle"><div class="mcProMark">▦</div><div><h1>Panel Macro</h1><p>Centro de Control Ejecutivo</p></div></div><button class="mcProBtn" id="mcProRetry">↻ Reintentar</button></div><div class="mcError">${esc(err?.message||err||'No fue posible cargar los datos del Maestro.')}</div></div>`;
    $('mcProRetry')?.addEventListener('click',render);
  }
  async function render(){
    installStyle();
    const c=$('content');if(!c)return;
    const t=$('pageTitle');if(t)t.textContent='Panel Macro';
    c.innerHTML='<div class="mcPro"><div class="mcProHead"><div class="mcProTitle"><div class="mcProMark">▦</div><div><h1>Panel Macro</h1><p>Centro de Control Ejecutivo · validando Maestro</p></div></div><div class="mcProStatus"><i></i> CARGANDO DATOS REALES</div></div><div class="mcLoading"><span class="mcPulse"></span>Conectando con MolinoCloud y validando información operacional…</div></div>';
    try{
      const snap=await window.MolinoCloud.snapshot({force:true});
      const m=calculate(snap);
      if(!m.docs.length&&!m.clients.length&&!m.dispatches.length)throw new Error('La capa de datos respondió sin registros operacionales. No se mostrarán ceros ficticios.');
      const months=m.monthly;const maxM=Math.max(1,...months.map(x=>Math.abs(x[1])));const last=months[months.length-1]?.[1]||0;const prev=months[months.length-2]?.[1]||0;const delta=prev?((last-prev)/Math.abs(prev))*100:null;const avg=m.kg?m.net/m.kg:0;
      const mix=[['Facturas',m.counts.invoice,'#2f80ff'],['Boletas',m.counts.boleta,'#28c76f'],['NC',m.counts.nc,'#f59e0b'],['ND',m.counts.nd,'#ef5350'],['Guías',m.counts.guide,'#9b6cff']];const mixTotal=Math.max(1,mix.reduce((a,x)=>a+x[1],0));let pos=0;const stops=mix.map(x=>{const start=pos;pos+=x[1]/mixTotal*100;return `${x[2]} ${start}% ${pos}%`}).join(',');
      c.innerHTML=`<div class="mcPro">
        <div class="mcProHead"><div class="mcProTitle"><div class="mcProMark">▦</div><div><h1>Panel Macro</h1><p>Centro de Control Ejecutivo · Molino San Miguel LTDA.</p></div></div><div class="mcProTools"><span class="mcProStatus"><i></i> MAESTRO CONECTADO</span><span class="mcProPeriod">Período: ${esc(months.length?monthLabel(months[months.length-1][0]):'Actual')}</span><button class="mcProBtn" id="mcProRefresh">↻ Actualizar</button></div></div>
        <div class="mcProKpis">
          <div class="mcProKpi cBlue"><small>Venta neta</small><strong>$ ${money(m.net)}</strong><span>Facturas + Boletas ± NC/ND</span></div>
          <div class="mcProKpi cGreen"><small>Venta total</small><strong>$ ${money(m.total)}</strong><span>Neto + IVA ajustado</span></div>
          <div class="mcProKpi cPurple"><small>IVA</small><strong>$ ${money(m.iva)}</strong><span>Documentos comerciales</span></div>
          <div class="mcProKpi cOrange"><small>KG vendidos</small><strong>${qty(m.kg)}</strong><span>Maestro · ventas</span></div>
          <div class="mcProKpi cOrange"><small>Sacos</small><strong>${qty(m.sacos)}</strong><span>Valor Maestro</span></div>
          <div class="mcProKpi cCyan"><small>Granel despachado</small><strong>${qty(m.granel)} kg</strong><span>Despachos</span></div>
        </div>
        <div class="mcProGrid">
          <section class="mcPanel"><h3>Evolución de ventas netas</h3><div class="mcPanelSub">Últimos períodos disponibles</div><div class="mcTrend">${months.map(([k,v])=>`<div class="mcTrendCol"><span class="mcTrendVal">${money(v/1000000)}M</span><div class="mcTrendBar" style="--h:${Math.max(3,Math.round(Math.abs(v)/maxM*86))}%"></div><span class="mcTrendLabel">${esc(monthLabel(k))}</span></div>`).join('')}</div><div class="mcTrendLegend"><span>Último: $ ${money(last)}</span><span>Variación: ${delta===null?'—':(delta>=0?'+':'')+delta.toFixed(1)+'%'}</span><span>Promedio: $ ${money(months.length?sum(months,x=>x[1])/months.length:0)}</span></div></section>
          <section class="mcPanel"><h3>Mix documental</h3><div class="mcPanelSub">Volumen del snapshot operacional</div><div class="mcDonutWrap"><div class="mcDonut" style="background:conic-gradient(${stops})"><div class="mcDonutCenter">${m.docs.length.toLocaleString('es-CL')}<span>TOTAL</span></div></div><div class="mcLegend">${mix.map(x=>`<div class="mcLeg" style="--c:${x[2]}"><i></i><span>${x[0]}</span><b>${x[1].toLocaleString('es-CL')}</b></div>`).join('')}</div></div></section>
          <section class="mcPanel"><h3>Top clientes · venta neta</h3><div class="mcPanelSub">Ranking comercial</div>${bars(m.topClients,v=>'$ '+money(v),'#2f80ff')}</section>
        </div>
        <div class="mcProGrid2">
          <section class="mcPanel"><h3>Top productos · KG despachados</h3><div class="mcPanelSub">Ranking operacional</div>${bars(m.topProducts,v=>qty(v)+' kg','#28c76f')}</section>
          <section class="mcPanel"><h3>Control comercial</h3><div class="mcMetricGrid"><div class="mcMini"><small>Facturas</small><b>${m.counts.invoice.toLocaleString('es-CL')}</b></div><div class="mcMini"><small>Boletas</small><b>${m.counts.boleta.toLocaleString('es-CL')}</b></div><div class="mcMini"><small>NC</small><b>${m.counts.nc.toLocaleString('es-CL')}</b></div><div class="mcMini"><small>ND</small><b>${m.counts.nd.toLocaleString('es-CL')}</b></div><div class="mcMini"><small>Guías</small><b>${m.counts.guide.toLocaleString('es-CL')}</b></div><div class="mcMini"><small>Valor promedio/kg</small><b>$ ${money(avg)}</b></div></div></section>
          <section class="mcPanel"><h3>Control operativo</h3><div class="mcMetricGrid"><div class="mcMini"><small>Despachos</small><b>${m.dispatches.length.toLocaleString('es-CL')}</b></div><div class="mcMini"><small>KG despachados</small><b>${qty(m.dkg)}</b></div><div class="mcMini"><small>Sacos despachados</small><b>${qty(m.dsacos)}</b></div><div class="mcMini"><small>Clientes</small><b>${m.clients.length.toLocaleString('es-CL')}</b></div><div class="mcMini"><small>Productos</small><b>${m.products.length.toLocaleString('es-CL')}</b></div><div class="mcMini"><small>Granel</small><b>${qty(m.granel)} kg</b></div></div></section>
        </div>
        <div class="mcFooter"><span>Datos obtenidos del Maestro en tiempo real · Guías separadas de ventas · NC/ND tratados como ajustes.</span><span>${m.docs.length.toLocaleString('es-CL')} documentos · ${m.dispatches.length.toLocaleString('es-CL')} despachos</span></div>
      </div>`;
      $('mcProRefresh')?.addEventListener('click',render);
    }catch(e){renderError(e)}
  }
  function install(){
    if(window.__MC_MACRO_PRO__)return;
    const original=window.show;
    if(typeof original==='function')window.show=function(page,...args){if(page==='macro'){render();return}return original.apply(this,[page,...args]);};
    window.__MC_MACRO_PRO__=Object.freeze({version:VERSION,render});
    setTimeout(()=>{const title=$('pageTitle');const app=$('app');if(app&&!app.classList.contains('hidden')&&title&&/Panel Macro/i.test(title.textContent||''))render();},60);
  }
  install();
})();
