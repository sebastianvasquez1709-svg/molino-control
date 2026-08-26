/* Molino Control · Panel Macro PRO V4
 * Root-fix renderer: uses lightweight aggregated RPC instead of full app snapshot.
 * Presentation + analytics only. No document/client/dispatch mutations.
 */
(() => {
  'use strict';
  if (window.__MC_MACRO_PRO_V4__) return;
  window.__MC_MACRO_PRO_V4__ = true;

  const STYLE_ID = 'mc-macro-pro-v4-style';
  const $ = id => document.getElementById(id);
  const n = v => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const money = v => Math.round(n(v)).toLocaleString('es-CL');
  const qty = v => n(v).toLocaleString('es-CL', { maximumFractionDigits: 2 });
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[m]));
  const sum = (rows, fn) => rows.reduce((a, r) => a + n(fn(r)), 0);

  function style(){
    if ($(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      html.mcMacroActive,html.mcMacroActive body{background:#07090b!important;color:#eef1f4!important}
      .mcMacroActive .sidebar{background:linear-gradient(180deg,#050608,#0b0d10 55%,#050608)!important;border-right:1px solid #24282d!important}
      .mcMacroActive .topbar{background:#080b0e!important;border-bottom:1px solid #24282d!important;box-shadow:none!important}
      .mcMacroActive .content{max-width:none!important;padding:14px!important;background:linear-gradient(180deg,#07090b,#0a0c0f)!important}
      .mcV4{--blue:#2b83ff;--green:#28c76f;--purple:#9b6cff;--orange:#f3a400;--cyan:#19c7da;--red:#ef5350;--line:#282e34;--muted:#808a94;max-width:1700px;margin:0 auto;padding:16px;background:linear-gradient(145deg,#060708,#0c0f12 55%,#070809);border:1px solid #20262c;border-radius:18px;min-height:calc(100vh - 106px);box-shadow:0 16px 50px rgba(0,0,0,.28);font-family:Inter,Segoe UI,Arial,sans-serif}
      .mcV4 *{box-sizing:border-box}.mcV4Head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:12px}.mcV4Title h1{font-size:28px;letter-spacing:-.6px;margin:0;color:#fff}.mcV4Title p{margin:3px 0;color:#7d8791;font-size:10px}.mcV4Tools{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.mcV4Chip,.mcV4Btn{background:#101417;border:1px solid #2c333a;color:#dce2e7;border-radius:9px;padding:8px 10px;font-size:10px;font-weight:800}.mcV4Btn{cursor:pointer}.mcV4Status{display:inline-flex;align-items:center;gap:6px;border:1px solid #28543a;background:#0e1711;color:#a4e9bc;border-radius:999px;padding:7px 10px;font-size:10px;font-weight:800}.mcV4Status i{width:7px;height:7px;border-radius:50%;background:var(--green)}
      .mcV4Kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}.mcV4Kpi{background:linear-gradient(180deg,#121518,#0d1012);border:1px solid var(--line);border-radius:12px;min-height:112px;padding:12px;border-top:2px solid var(--accent)}.mcV4Kpi small{color:#8f98a1;font-size:8px;text-transform:uppercase;letter-spacing:.09em}.mcV4Kpi strong{display:block;color:#fff;font-size:21px;line-height:1.15;margin-top:7px}.mcV4Kpi span{display:block;color:#69747e;font-size:8px;margin-top:5px}.aBlue{--accent:var(--blue)}.aGreen{--accent:var(--green)}.aPurple{--accent:var(--purple)}.aOrange{--accent:var(--orange)}.aCyan{--accent:var(--cyan)}.aRed{--accent:var(--red)}
      .mcV4Grid{display:grid;grid-template-columns:1.35fr .9fr 1fr;gap:9px;margin-top:9px}.mcV4Grid2{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-top:9px}.mcV4Panel{background:linear-gradient(180deg,#111417,#0d1012);border:1px solid #252c32;border-radius:12px;padding:13px;min-width:0}.mcV4Panel h3{margin:0;font-size:12px;color:#f6f7f8}.mcV4Sub{margin-top:3px;color:#747f89;font-size:8px}.mcV4Loading{display:grid;place-items:center;min-height:220px;color:#818c95;border:1px solid #2a3036;border-radius:10px;background:#0f1215}.mcV4Error{padding:20px;border:1px solid #5b3030;background:#1b0e0e;color:#ffb7b3;border-radius:10px}.mcV4Error strong{display:block;color:#ffd0cd;margin-bottom:6px}
      .mcV4Bars{display:grid;gap:7px;margin-top:12px}.mcV4Bar{display:grid;grid-template-columns:120px 1fr 86px;gap:7px;align-items:center}.mcV4Bar label{font-size:8px;color:#aeb6bd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mcV4Track{height:8px;background:#22282e;border-radius:999px;overflow:hidden}.mcV4Track i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--bar),rgba(255,255,255,.48))}.mcV4Bar b{font-size:8px;text-align:right;color:#edf0f2}
      .mcV4Line{margin-top:8px}.mcV4Line svg{display:block;width:100%;height:220px}.mcV4GridLine{stroke:#252b31;stroke-width:1}.mcV4AxisLabel{fill:#717c85;font-size:8px}.mcV4ValueLabel{fill:#e3e8ec;font-size:8px;font-weight:800}.mcV4LinePath{fill:none;stroke:var(--blue);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.mcV4Point{fill:#0c1013;stroke:var(--blue);stroke-width:3}.mcV4Area{fill:rgba(43,131,255,.10)}
      .mcV4DocMix{display:grid;gap:8px;margin-top:13px}.mcV4Doc{display:grid;grid-template-columns:78px 1fr 55px;gap:7px;align-items:center;font-size:8px}.mcV4Doc span{color:#aab3ba}.mcV4Doc b{text-align:right;color:#eef1f3}.mcV4DocTrack{height:9px;background:#22282e;border-radius:999px;overflow:hidden}.mcV4DocTrack i{display:block;height:100%;border-radius:999px;background:var(--c)}
      .mcV4Tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:12px}.mcV4Tile{background:#111518;border:1px solid #252c32;border-left:2px solid var(--c);border-radius:9px;padding:9px}.mcV4Tile small{display:block;color:#7d8892;font-size:7px;text-transform:uppercase}.mcV4Tile b{display:block;color:#fff;font-size:16px;margin-top:4px}.mcV4Audit{display:grid;gap:7px;margin-top:10px}.mcV4AuditRow{display:flex;justify-content:space-between;gap:8px;padding:8px 9px;border:1px solid #252c32;border-radius:9px;background:#101417;font-size:8px}.mcV4AuditRow span{color:#aeb6bd}.mcV4AuditRow b{color:#fff}.mcV4AuditRow.ok b{color:#8ee4aa}.mcV4AuditRow.warn b{color:#f6cf83}.mcV4Footer{margin-top:9px;padding:9px 11px;border:1px solid #22282e;border-radius:9px;background:#0a0d10;color:#727d86;font-size:8px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
      @media(max-width:1250px){.mcV4Kpis{grid-template-columns:repeat(3,1fr)}.mcV4Grid{grid-template-columns:1.15fr .85fr}.mcV4Grid>.mcV4Panel:last-child{grid-column:1/-1}.mcV4Grid2{grid-template-columns:1fr 1fr}.mcV4Grid2>.mcV4Panel:last-child{grid-column:1/-1}}
      @media(max-width:760px){.mcV4{padding:11px}.mcV4Head{flex-direction:column}.mcV4Kpis{grid-template-columns:repeat(2,1fr)}.mcV4Grid,.mcV4Grid2{grid-template-columns:1fr}.mcV4Grid>.mcV4Panel:last-child,.mcV4Grid2>.mcV4Panel:last-child{grid-column:auto}.mcV4Tiles{grid-template-columns:1fr 1fr}.mcV4Bar{grid-template-columns:90px 1fr 74px}}
      @media(max-width:460px){.mcV4Kpis,.mcV4Tiles{grid-template-columns:1fr}.mcV4Title h1{font-size:23px}}
      @media(prefers-reduced-motion:reduce){.mcV4 *{scroll-behavior:auto!important}}
    `;
    document.head.appendChild(s);
  }

  function monthlyChart(rows){
    if(!rows?.length) return '<div class="mcV4Loading">No hay períodos de venta disponibles.</div>';
    const w=720,h=220,p=24,max=Math.max(1,...rows.map(x=>Math.abs(n(x.neto))));
    const den=Math.max(1,rows.length-1);
    const pts=rows.map((x,i)=>({x:p+i*((w-p*2)/den),y:h-p-(Math.abs(n(x.neto))/max)*(h-p*2),v:n(x.neto),k:x.periodo}));
    const path=pts.map((q,i)=>(i?'L':'M')+q.x.toFixed(1)+','+q.y.toFixed(1)).join(' ');
    const area=`M ${pts[0].x} ${h-p} L ${pts.map(q=>q.x+' '+q.y).join(' L ')} L ${pts.at(-1).x} ${h-p} Z`;
    return `<div class="mcV4Line"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line class="mcV4GridLine" x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}"/><line class="mcV4GridLine" x1="${p}" y1="${h/2}" x2="${w-p}" y2="${h/2}"/><line class="mcV4GridLine" x1="${p}" y1="${p}" x2="${w-p}" y2="${p}"/><path d="${area}" class="mcV4Area"/><path d="${path}" class="mcV4LinePath"/>${pts.map(q=>`<circle class="mcV4Point" cx="${q.x}" cy="${q.y}" r="4"/><text class="mcV4ValueLabel" x="${q.x}" y="${Math.max(11,q.y-8)}" text-anchor="middle">$${money(q.v/1000000)}M</text><text class="mcV4AxisLabel" x="${q.x}" y="${h-6}" text-anchor="middle">${esc(q.k)}</text>`).join('')}</svg></div>`;
  }

  function bars(items, format, accent){
    if(!items?.length) return '<div class="mcV4Loading">Sin datos para mostrar.</div>';
    const max=Math.max(1,...items.map(x=>Math.abs(n(x.neto ?? x.kg))));
    return '<div class="mcV4Bars">'+items.map(x=>{
      const key=x.cliente ?? x.producto ?? 'Sin dato';
      const val=n(x.neto ?? x.kg);
      return `<div class="mcV4Bar"><label title="${esc(key)}">${esc(key)}</label><div class="mcV4Track"><i style="--bar:${accent};width:${Math.max(3,Math.round(Math.abs(val)/max*100))}%"></i></div><b>${format(val)}</b></div>`;
    }).join('')+'</div>';
  }

  function docMix(rows){
    if(!rows?.length) return '<div class="mcV4Loading">Sin documentos.</div>';
    const colors={Facturas:'#2b83ff',Boletas:'#28c76f',NC:'#f3a400',ND:'#ef5350',Guías:'#9b6cff'};
    const max=Math.max(1,...rows.map(x=>n(x.cantidad)));
    return '<div class="mcV4DocMix">'+rows.map(x=>`<div class="mcV4Doc"><span>${esc(x.tipo)}</span><div class="mcV4DocTrack"><i style="--c:${colors[x.tipo]||'#19c7da'};width:${Math.max(2,Math.round(n(x.cantidad)/max*100))}%"></i></div><b>${n(x.cantidad).toLocaleString('es-CL')}</b></div>`).join('')+'</div>';
  }

  async function fetchMacro(){
    const session = await window.MolinoCloud.getSession();
    if(!session?._identifier || !session?._password) throw new Error('Sesión no disponible. Vuelve a iniciar sesión.');
    const sb = await window.MolinoCloud.client();
    let timer;
    try {
      const request = sb.rpc('molino_macro_dashboard_local',{p_rut:session._identifier,p_pin:session._password});
      return await Promise.race([request.then(({data,error})=>{if(error)throw error;if(!data)throw new Error('Supabase no devolvió datos del Panel Macro.');return data;}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('El Panel Macro tardó demasiado en responder. La fuente de datos sigue protegida; vuelve a intentar.')),8000);})]);
    } finally { clearTimeout(timer); }
  }

  function renderError(err){
    const c=$('content');if(!c)return;
    c.innerHTML=`<div class="mcV4"><div class="mcV4Head"><div><div class="mcV4Title"><h1>PANEL MACRO</h1><p>CENTRO DE CONTROL EJECUTIVO · MOLINO SAN MIGUEL LTDA.</p></div></div><button class="mcV4Btn" id="mcV4Retry">↻ Reintentar</button></div><div class="mcV4Error"><strong>No se pudo cargar el Centro de Control</strong>${esc(err?.message||String(err)||'Error desconocido.')}</div></div>`;
    $('mcV4Retry')?.addEventListener('click',render);
  }

  async function render(){
    style();
    document.documentElement.classList.add('mcMacroActive');
    const c=$('content');if(!c)return;
    const title=$('pageTitle');if(title)title.textContent='Panel Macro';
    c.innerHTML='<div class="mcV4"><div class="mcV4Head"><div><div class="mcV4Title"><h1>PANEL MACRO</h1><p>CENTRO DE CONTROL EJECUTIVO · MOLINO SAN MIGUEL LTDA.</p></div></div><div class="mcV4Tools"><span class="mcV4Status"><i></i> MAESTRO CONECTADO</span><span class="mcV4Chip">Analítica en tiempo real</span><button class="mcV4Btn" id="mcV4Refresh">↻ Actualizar</button></div></div><div class="mcV4Loading">Cargando indicadores optimizados…</div></div>';
    try{
      const d=await fetchMacro();
      const k=d.kpis||{}, counts=d.counts||{}, op=d.operational||{}, qa=d.qa||{}, monthly=d.monthly||[];
      const current=monthly.at(-1)?.neto ?? null, prev=monthly.at(-2)?.neto ?? null;
      const mom=(current!==null&&prev!==null&&prev!==0)?((current-prev)/Math.abs(prev))*100:null;
      const avgMonthly=monthly.length?sum(monthly,x=>x.neto)/monthly.length:0;
      c.innerHTML=`<div class="mcV4">
        <div class="mcV4Head"><div><div class="mcV4Title"><h1>PANEL MACRO</h1><p>CENTRO DE CONTROL EJECUTIVO · MOLINO SAN MIGUEL LTDA.</p></div></div><div class="mcV4Tools"><span class="mcV4Status"><i></i> DATOS ACTUALIZADOS</span><span class="mcV4Chip">${esc(monthly.at(-1)?.periodo||'Período actual')}</span><button class="mcV4Btn" id="mcV4Refresh">↻ Actualizar</button></div></div>
        <div class="mcV4Kpis">
          <div class="mcV4Kpi aBlue"><small>Venta neta</small><strong>$ ${money(k.ventaNeta)}</strong><span>Facturas + Boletas ± NC/ND</span></div>
          <div class="mcV4Kpi aGreen"><small>Venta total</small><strong>$ ${money(k.ventaTotal)}</strong><span>Neto + IVA ajustado</span></div>
          <div class="mcV4Kpi aPurple"><small>IVA</small><strong>$ ${money(k.iva)}</strong><span>Documentos comerciales</span></div>
          <div class="mcV4Kpi aOrange"><small>KG vendidos</small><strong>${qty(k.kgVendidos)}</strong><span>Facturas + Boletas</span></div>
          <div class="mcV4Kpi aOrange"><small>Sacos vendidos</small><strong>${qty(k.sacosVendidos)}</strong><span>Maestro comercial</span></div>
          <div class="mcV4Kpi aCyan"><small>Granel despachado</small><strong>${qty(k.granelDespachado)} kg</strong><span>Operación</span></div>
        </div>
        <div class="mcV4Grid">
          <section class="mcV4Panel"><h3>EVOLUCIÓN DE VENTAS NETAS</h3><div class="mcV4Sub">Últimos 12 períodos disponibles</div>${monthlyChart(monthly)}<div class="mcV4Footer"><span>Último: ${current===null?'—':'$ '+money(current)}</span><span>Variación: ${mom===null?'—':(mom>=0?'+':'')+mom.toFixed(1)+'%'}</span><span>Promedio: $ ${money(avgMonthly)}</span></div></section>
          <section class="mcV4Panel"><h3>MIX DOCUMENTAL</h3><div class="mcV4Sub">Volumen documental</div>${docMix(d.docMix||[])}<div class="mcV4Footer"><span>${n(counts.documents).toLocaleString('es-CL')} documentos</span><span>${n(counts.guias).toLocaleString('es-CL')} guías</span></div></section>
          <section class="mcV4Panel"><h3>TOP 10 CLIENTES</h3><div class="mcV4Sub">Venta neta ajustada</div>${bars(d.topClients,x=>'$ '+money(x),'#2b83ff')}</section>
        </div>
        <div class="mcV4Grid2">
          <section class="mcV4Panel"><h3>TOP 10 PRODUCTOS</h3><div class="mcV4Sub">KG vendidos</div>${bars(d.topProducts,x=>qty(x)+' kg','#28c76f')}</section>
          <section class="mcV4Panel"><h3>CONTROL COMERCIAL</h3><div class="mcV4Tiles"><div class="mcV4Tile" style="--c:#2b83ff"><small>Facturas</small><b>${n(counts.facturas).toLocaleString('es-CL')}</b></div><div class="mcV4Tile" style="--c:#28c76f"><small>Boletas</small><b>${n(counts.boletas).toLocaleString('es-CL')}</b></div><div class="mcV4Tile" style="--c:#f3a400"><small>NC</small><b>${n(counts.nc).toLocaleString('es-CL')}</b></div><div class="mcV4Tile" style="--c:#ef5350"><small>ND</small><b>${n(counts.nd).toLocaleString('es-CL')}</b></div><div class="mcV4Tile" style="--c:#9b6cff"><small>Guías</small><b>${n(counts.guias).toLocaleString('es-CL')}</b></div><div class="mcV4Tile" style="--c:#19c7da"><small>Precio neto/kg</small><b>$ ${money(k.precioKg)}</b></div></div></section>
          <section class="mcV4Panel"><h3>CONTROL OPERATIVO</h3><div class="mcV4Tiles"><div class="mcV4Tile" style="--c:#2b83ff"><small>Despachos</small><b>${n(op.despachos).toLocaleString('es-CL')}</b></div><div class="mcV4Tile" style="--c:#28c76f"><small>KG despachados</small><b>${qty(op.kgDespachados)}</b></div><div class="mcV4Tile" style="--c:#f3a400"><small>Sacos despachados</small><b>${qty(op.sacosDespachados)}</b></div><div class="mcV4Tile" style="--c:#9b6cff"><small>Clientes</small><b>${n(op.clientes).toLocaleString('es-CL')}</b></div><div class="mcV4Tile" style="--c:#19c7da"><small>Productos</small><b>${n(op.productos).toLocaleString('es-CL')}</b></div><div class="mcV4Tile" style="--c:#ef5350"><small>Granel</small><b>${qty(k.granelDespachado)} kg</b></div></div></section>
        </div>
        <section class="mcV4Panel" style="margin-top:9px"><h3>AUDITORÍA DEL DATO</h3><div class="mcV4Sub">Controles preventivos del Centro de Control</div><div class="mcV4Audit"><div class="mcV4AuditRow ${n(qa.sin_fecha)===0?'ok':'warn'}"><span>Documentos sin fecha</span><b>${n(qa.sin_fecha)}</b></div><div class="mcV4AuditRow ${n(qa.comerciales_cero_neto)===0?'ok':'warn'}"><span>Comerciales con neto $0</span><b>${n(qa.comerciales_cero_neto)}</b></div><div class="mcV4AuditRow ${n(qa.facturas_negativas)===0?'ok':'warn'}"><span>Facturas negativas</span><b>${n(qa.facturas_negativas)}</b></div><div class="mcV4AuditRow warn"><span>Comerciales sin cliente</span><b>${n(qa.sin_cliente)}</b></div></div></section>
        <div class="mcV4Footer"><span>Fuente: RPC analítico del Maestro · no carga el snapshot documental completo.</span><span>${n(counts.documents).toLocaleString('es-CL')} documentos · ${n(op.despachos).toLocaleString('es-CL')} despachos</span></div>
      </div>`;
      $('mcV4Refresh')?.addEventListener('click',render);
    }catch(e){ renderError(e); }
  }

  function install(){
    const original=window.show;
    if(typeof original==='function'&&!window.__MC_MACRO_V4_SHOW_WRAPPED__){
      window.__MC_MACRO_V4_SHOW_WRAPPED__=true;
      window.show=function(page,...args){const p=String(page||'').toLowerCase();if(p.includes('macro')||p.includes('control')){render();return}return original.apply(this,[page,...args]);};
    }
    const observer=new MutationObserver(()=>{
      const title=$('pageTitle');
      const active=title&&/panel macro|centro de control/i.test(title.textContent||'');
      document.documentElement.classList.toggle('mcMacroActive',!!active);
      if(active&&!document.querySelector('.mcV4'))render();
    });
    const target=$('content'); if(target) observer.observe(target,{childList:true,subtree:false});
    setTimeout(()=>{const title=$('pageTitle');if(title&&/panel macro|centro de control/i.test(title.textContent||''))render();},100);
  }

  install();
})();
