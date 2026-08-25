/* Molino Control · Clientes Enhanced V1
 * Safe presentation layer: no data mutation, no global listeners, no API changes.
 * Depends only on existing app globals: $, state, paginate, esc, money,
 * formatRut, destinationFromClient, editClientContact, openClient, toast.
 */
(() => {
  'use strict';
  const STYLE_ID='mc-clients-enhanced-style-v1';
  const installStyle=()=>{
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style'); s.id=STYLE_ID;
    s.textContent=`
      .mcClientsHead{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}
      .mcClientsTitle{display:flex;gap:10px;align-items:center}
      .mcClientsTitle .mcIcon{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:#edf4fc;font-size:18px}
      .mcClientKpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}
      .mcClientKpi{background:#fff;border:1px solid #dfe7f0;border-radius:12px;padding:12px}
      .mcClientKpi small{display:block;color:#667085;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
      .mcClientKpi strong{display:block;margin-top:3px;font-size:20px;color:#123a78}
      .mcClientTools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .mcClientTools .searchInput{min-width:280px}
      .mcClientChip{padding:6px 10px;border-radius:999px;border:1px solid #d7e2ef;background:#f7faff;color:#344054;font-size:11px;font-weight:700;cursor:pointer}
      .mcClientChip.active{background:#123a78;color:#fff;border-color:#123a78}
      .mcClientQuality{display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:800}
      .mcClientQuality.ok{background:#ecfdf3;color:#067647}
      .mcClientQuality.warn{background:#fff8eb;color:#9a6700}
      .mcClientMeta{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}
      .mcClientMeta span{padding:4px 7px;border-radius:8px;background:#f6f8fb;color:#475467;font-size:10px}
      .mcClientCard{border:1px solid #dce5ef!important;border-radius:14px!important;padding:15px!important;background:#fff;box-shadow:0 5px 18px rgba(15,53,109,.045);min-width:0;transition:.15s}
      .mcClientCard:hover{transform:translateY(-1px);box-shadow:0 9px 24px rgba(15,53,109,.08)}
      .mcClientCard .clientHead{gap:12px}
      .mcClientName{font-weight:800;font-size:15px;color:#123a78;overflow-wrap:anywhere}
      .mcClientSub{font-size:11px;color:#667085;margin-top:3px}
      .mcClientDestination{margin-top:9px;padding:9px 10px;border-radius:10px;background:#f8fafc;border:1px solid #e5ebf2;font-size:11px}
      .mcClientActions{margin-top:12px;display:flex;gap:7px;flex-wrap:wrap}
      .mcClientEmpty{grid-column:1/-1}
      @media(max-width:1050px){.mcClientKpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:560px){.mcClientKpis{grid-template-columns:1fr}.mcClientTools .searchInput{min-width:100%;width:100%}}
    `;
    document.head.appendChild(s);
  };
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
  const docCount=c=>Array.isArray(c?.documentos)?c.documentos.length:n(c?.documentos);
  const normalizeText=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const quality=c=>{const hasRut=!!String(c?.rut||'').trim();const destination=String(destinationFromClient?.(c)||'').trim();return {hasRut,destination};};
  let mode='all';
  function filtered(rows){
    const q=normalizeText(state.search.clients||'').trim();
    return rows.filter(c=>{
      const qi=!q||normalizeText([c?.nombre,c?.rut,c?.nombre_fantasia,c?.key].join(' ')).includes(q);
      if(!qi)return false;
      const ql=quality(c);
      if(mode==='missing-rut'&&ql.hasRut)return false;
      if(mode==='with-destination'&&!ql.destination)return false;
      return true;
    });
  }
  function render(){
    installStyle();
    const rows=Array.isArray(state.snapshot?.clients)?state.snapshot.clients:[];
    const all=rows.length, missingRut=rows.filter(c=>!quality(c).hasRut).length, withDestination=rows.filter(c=>quality(c).destination).length;
    const f=filtered(rows), ps=Math.max(1,Math.ceil(f.length/pageSize()));
    state.page=Math.min(Math.max(1,state.page),ps);
    const start=(state.page-1)*pageSize(), items=f.slice(start,start+pageSize());
    const q=String(state.search.clients||'');
    const chips=[['all','Todos',all],['missing-rut','Sin RUT',missingRut],['with-destination','Con destino',withDestination]];
    $('content').innerHTML=`<div class="card">
      <div class="mcClientsHead">
        <div class="mcClientsTitle"><div class="mcIcon">👥</div><div><h3 style="margin:0">Clientes</h3><div class="note">Maestro operativo · búsqueda rápida, calidad de datos y contactos de despacho.</div></div></div>
        <div class="mcClientTools"><input id="clientQ" class="searchInput grow" placeholder="Buscar nombre, RUT o identificador" value="${esc(q)}"><button class="secondary" type="button" id="clientClear">Limpiar</button><button class="secondary" type="button" id="clientCsv">⬇️ Exportar CSV</button></div>
      </div>
      <div class="mcClientKpis">
        <div class="mcClientKpi"><small>Total clientes</small><strong>${all.toLocaleString('es-CL')}</strong></div>
        <div class="mcClientKpi"><small>Con RUT</small><strong>${(all-missingRut).toLocaleString('es-CL')}</strong></div>
        <div class="mcClientKpi"><small>Sin RUT</small><strong>${missingRut.toLocaleString('es-CL')}</strong></div>
        <div class="mcClientKpi"><small>Con destino</small><strong>${withDestination.toLocaleString('es-CL')}</strong></div>
      </div>
      <div class="mcClientTools" style="margin:4px 0 10px">${chips.map(([k,label,count])=>`<button type="button" class="mcClientChip ${mode===k?'active':''}" data-client-mode="${k}">${label} · ${count}</button>`).join('')}</div>
      <p class="note" id="clientCount">${f.length.toLocaleString('es-CL')} clientes · ${items.length} visibles</p>
      <div id="clientList" class="grid clientGrid"></div><div id="clientPager"></div>
    </div>`;
    const host=$('clientList');
    host.innerHTML=items.map(c=>{
      const ql=quality(c), docs=docCount(c), neto=n(c?.neto), total=n(c?.total), dest=String(destinationFromClient?.(c)||'').trim();
      const badge=ql.hasRut?'<span class="mcClientQuality ok">✓ RUT</span>':'<span class="mcClientQuality warn">⚠ Sin RUT</span>';
      return `<div class="clientCard mcClientCard"><div class="clientHead"><div style="min-width:0"><div class="mcClientName">${esc(c?.nombre||'Cliente')}</div><div class="mcClientSub">${esc(c?.rut?formatRut(c.rut):'RUT no informado')} · ${docs.toLocaleString('es-CL')} documentos</div></div>${badge}</div><div class="mcClientDestination">📍 <strong>Destino:</strong> ${esc(dest||'No registrado')}</div><div class="mcClientMeta"><span>Neto $ ${money(neto)}</span><span>Total $ ${money(total)}</span></div><div class="mcClientActions"><button class="secondary smallBtn" type="button" onclick="editClientContact('${esc(c.key)}')">Contacto</button><button class="primary smallBtn" type="button" onclick="openClient('${esc(c.key)}')">Ver ficha</button></div></div>`;
    }).join('')||'<div class="empty mcClientEmpty">No hay coincidencias con los filtros actuales.</div>';
    updateLocalPager('clientPager',ps,render);
    const input=$('clientQ'); let t; input.oninput=e=>{state.search.clients=e.target.value;state.page=1;clearTimeout(t);t=setTimeout(render,120)};
    $('clientClear').onclick=()=>{state.search.clients='';state.page=1;mode='all';render()};
    $('clientCsv').onclick=()=>window.exportClients();
    document.querySelectorAll('[data-client-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.clientMode;state.page=1;render()}));
  }
  window.renderClients=render;
  window.__LYRA_CLIENTS_V1__=Object.freeze({version:'1.0.0',render,mode:()=>mode});
})();
