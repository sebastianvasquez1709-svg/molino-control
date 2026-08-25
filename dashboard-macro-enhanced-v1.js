/* Molino Control · Panel Macro Enhanced V1
 * Safe presentation layer: reads the authoritative MolinoCloud snapshot.
 * Does not mutate data, APIs, or the existing application state.
 */
(() => {
  'use strict';
  const STYLE_ID='mc-macro-v1-style';
  const installStyle=()=>{
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style'); s.id=STYLE_ID;
    s.textContent=`
      .mcMacroHead{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
      .mcMacroTitle{display:flex;align-items:center;gap:10px}.mcMacroIcon{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:#edf4fc;font-size:20px}
      .mcMacroSub{font-size:12px;color:#667085;margin-top:3px}.mcMacroKpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0}
      .mcMacroKpi{background:#fff;border:1px solid #dfe7f0;border-radius:14px;padding:15px;min-height:102px;box-shadow:0 5px 18px rgba(15,53,109,.04)}
      .mcMacroKpi small{display:block;color:#667085;font-size:10px;text-transform:uppercase;letter-spacing:.05em}.mcMacroKpi strong{display:block;margin-top:5px;color:#123a78;font-size:24px}.mcMacroKpi span{display:block;color:#667085;font-size:11px;margin-top:3px}
      .mcMacroGrid{display:grid;grid-template-columns:1.2fr .8fr;gap:14px}.mcMacroCard{background:#fff;border:1px solid #dfe7f0;border-radius:14px;padding:16px}.mcMacroCard h4{margin:0;color:#123a78;font-size:15px}.mcMacroList{display:grid;gap:9px;margin-top:12px}.mcMacroRow{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #edf1f6;font-size:12px}.mcMacroRow:last-child{border-bottom:0}.mcMacroRow b{color:#123a78}.mcMacroBadge{display:inline-flex;padding:5px 9px;border-radius:999px;background:#ecfdf3;color:#067647;font-size:10px;font-weight:800}.mcMacroWarn{background:#fff8eb;color:#9a6700}.mcMacroActions{display:flex;gap:8px;flex-wrap:wrap}.mcMacroError{margin-top:12px;padding:12px;border-radius:10px;background:#fff1f1;border:1px solid #efc0c0;color:#b42318;font-size:12px}
      @media(max-width:1050px){.mcMacroKpis{grid-template-columns:repeat(2,minmax(0,1fr))}.mcMacroGrid{grid-template-columns:1fr}}
      @media(max-width:560px){.mcMacroKpis{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  };
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
  const money=v=>n(v).toLocaleString('es-CL',{maximumFractionDigits:0});
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const iso=v=>{const d=v instanceof Date?v:new Date(v);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10)};
  const monthLabel=v=>{const s=String(v||'');if(!/^\d{4}-\d{2}$/.test(s))return s||'Período actual';const [y,m]=s.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('es-CL',{month:'long',year:'numeric'});};
  function calculate(snap){
    const docs=Array.isArray(snap?.documents)?snap.documents:[];
    const isInvoice=d=>/FACTURA/i.test(String(d?.tipo||''));
    const isBoleta=d=>/BOLETA/i.test(String(d?.tipo||''));
    const isGuide=d=>/GU[IÍ]A/i.test(String(d?.tipo||''));
    const isNC=d=>/NOTA DE CR[EÉ]DITO/i.test(String(d?.tipo||''));
    const isND=d=>/NOTA DE D[EÉ]BITO/i.test(String(d?.tipo||''));
    const sales=docs.filter(d=>isInvoice(d)||isBoleta(d));
    const adjustments=docs.filter(d=>isNC(d)||isND(d));
    const invoices=docs.filter(isInvoice), boletas=docs.filter(isBoleta), guides=docs.filter(isGuide), nc=docs.filter(isNC), nd=docs.filter(isND);
    const sum=(rows,k)=>rows.reduce((a,d)=>a+n(d?.[k]),0);
    const sumDato=(rows,k)=>rows.reduce((a,d)=>a+n(d?.datos?.[k]),0);
    const ventasNeto=sum(sales,'neto')+sum(adjustments,'neto');
    const ventasIva=sum(sales,'iva')+sum(adjustments,'iva');
    const ventasTotal=sum(sales,'total')+sum(adjustments,'total');
    const kg=sumDato(sales,'kilos');
    const sacos=sumDato(sales,'sacos');
    const avg=kg?ventasNeto/kg:0;
    const dispatches=Array.isArray(snap?.dispatches)?snap.dispatches:[];
    const dispatchKg=sum(dispatches,'kg'), dispatchSacos=sum(dispatches,'sacos');
    const granel=dispatches.filter(d=>/GRANEL/i.test(String(d?.producto||'')));
    const granelKg=sum(granel,'kg');
    let latest='';for(const d of sales){const x=iso(d?.fecha);if(x&&x>latest)latest=x;}
    return {invoices,boletas,guides,nc,nd,sales,adjustments,ventasNeto,ventasIva,ventasTotal,kg,sacos,avg,dispatches,dispatchKg,dispatchSacos,granelKg,clients:Array.isArray(snap?.clients)?snap.clients.length:0,products:Array.isArray(snap?.products)?snap.products.length:0,latestMonth:latest?latest.slice(0,7):''};
  }
  async function renderMacro(){
    installStyle();
    $('pageTitle').textContent='Panel Macro';
    $('content').innerHTML='<div class="card"><div class="mcMacroHead"><div class="mcMacroTitle"><div class="mcMacroIcon">📊</div><div><h3 style="margin:0">Panel Macro</h3><div class="mcMacroSub">Cargando datos reales del Maestro y Supabase…</div></div></div><div class="mcMacroActions"><button class="secondary" id="mcMacroRefresh" type="button">↻ Actualizar</button></div></div><div class="status info" style="margin-top:14px">Validando datos antes de mostrar indicadores.</div></div>';
    $('mcMacroRefresh').onclick=()=>renderMacro();
    try{
      const snap=await MolinoCloud.snapshot({force:true});
      const m=calculate(snap);
      const maestro=snap?.fileName||'Maestro validado';
      $('content').innerHTML=`<div class="card">
        <div class="mcMacroHead"><div class="mcMacroTitle"><div class="mcMacroIcon">📊</div><div><h3 style="margin:0">Panel Macro</h3><div class="mcMacroSub">${esc(maestro)} · ${esc(monthLabel(m.latestMonth))}</div></div></div><div class="mcMacroActions"><span class="mcMacroBadge">✓ Datos cargados desde Supabase</span><button class="secondary" id="mcMacroRefresh" type="button">↻ Actualizar</button></div></div>
        <div class="mcMacroKpis">
          <div class="mcMacroKpi"><small>Ventas netas</small><strong>$ ${money(m.ventasNeto)}</strong><span>Facturas + Boletas + NC/ND</span></div>
          <div class="mcMacroKpi"><small>Ventas totales</small><strong>$ ${money(m.ventasTotal)}</strong><span>Resultado con IVA</span></div>
          <div class="mcMacroKpi"><small>IVA</small><strong>$ ${money(m.ventasIva)}</strong><span>Documentos de venta y ajustes</span></div>
          <div class="mcMacroKpi"><small>Kilos vendidos</small><strong>${money(m.kg)} kg</strong><span>${money(m.sacos)} sacos registrados</span></div>
        </div>
        <div class="mcMacroGrid">
          <div class="mcMacroCard"><h4>Resumen comercial</h4><div class="mcMacroList">
            <div class="mcMacroRow"><span>Facturas</span><b>${m.invoices.length.toLocaleString('es-CL')}</b></div>
            <div class="mcMacroRow"><span>Boletas</span><b>${m.boletas.length.toLocaleString('es-CL')}</b></div>
            <div class="mcMacroRow"><span>Notas de Crédito</span><b>${m.nc.length.toLocaleString('es-CL')}</b></div>
            <div class="mcMacroRow"><span>Notas de Débito</span><b>${m.nd.length.toLocaleString('es-CL')}</b></div>
            <div class="mcMacroRow"><span>Guías</span><b>${m.guides.length.toLocaleString('es-CL')}</b></div>
            <div class="mcMacroRow"><span>Valor promedio por kg</span><b>$ ${money(m.avg)}</b></div>
          </div></div>
          <div class="mcMacroCard"><h4>Operación</h4><div class="mcMacroList">
            <div class="mcMacroRow"><span>Clientes activos</span><b>${m.clients.toLocaleString('es-CL')}</b></div>
            <div class="mcMacroRow"><span>Productos activos</span><b>${m.products.toLocaleString('es-CL')}</b></div>
            <div class="mcMacroRow"><span>Despachos</span><b>${m.dispatches.length.toLocaleString('es-CL')}</b></div>
            <div class="mcMacroRow"><span>KG despachados</span><b>${money(m.dispatchKg)} kg</b></div>
            <div class="mcMacroRow"><span>Sacos despachados</span><b>${money(m.dispatchSacos)}</b></div>
            <div class="mcMacroRow"><span>Granel despachado</span><b>${money(m.granelKg)} kg</b></div>
          </div></div>
        </div>
        <div class="mcMacroSub" style="margin-top:14px">Control LYRA: los indicadores se recalculan desde documentos reales; las Notas de Crédito/Débito se tratan como ajustes y las Guías no se mezclan con ventas.</div>
      </div>`;
      $('mcMacroRefresh').onclick=()=>renderMacro();
    }catch(err){
      const msg=String(err?.message||err);
      $('content').innerHTML=`<div class="card"><div class="mcMacroHead"><div class="mcMacroTitle"><div class="mcMacroIcon">📊</div><div><h3 style="margin:0">Panel Macro</h3><div class="mcMacroSub">No se pudieron cargar los indicadores.</div></div></div><button class="secondary" id="mcMacroRetry" type="button">↻ Reintentar</button></div><div class="mcMacroError">${esc(msg)}</div></div>`;
      $('mcMacroRetry').onclick=()=>renderMacro();
    }
  }
  function install(){
    if(window.__LYRA_MACRO_V1__)return;
    const original=window.show;
    if(typeof original!=='function')return;
    window.show=function(page,...args){
      if(page==='macro'){renderMacro();return;}
      return original.apply(this,[page,...args]);
    };
    window.__LYRA_MACRO_V1__=Object.freeze({version:'1.0.0',render:renderMacro});
  }
  install();
})();
