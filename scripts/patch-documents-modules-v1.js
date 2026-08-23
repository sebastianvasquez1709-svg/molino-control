const fs=require('fs');
const path=require('path');
const file=path.join(process.cwd(),'app.js');
let src=fs.readFileSync(file,'utf8');
const close=src.lastIndexOf('\n})();');
if(close<0)throw new Error('No se encontró cierre IIFE.');
const injection=String.raw`
// DOCUMENT_MODULES_V1
(function(){
 const num=v=>Number(v||0);
 const sum=(rows,key)=>rows.reduce((a,r)=>a+num(r?.[key]),0);
 const addShell=(view,kind,title,kicker,subtitle,rows,metrics,fields)=>{
  const host=document.querySelector('#content'); if(!host)return;
  const card=host.querySelector('.card'); if(!card)return;
  card.classList.add('docModule',kind);
  card.setAttribute('data-doc-type',kind);
  const header=card.querySelector('.sectionTitle');
  if(header){
   const titleBox=header.querySelector('div:first-child')||header;
   const old=titleBox.querySelector('h3');
   if(old){old.innerHTML=title;old.classList.add('docModuleTitle')}
   const note=titleBox.querySelector('.note');
   if(note)note.textContent=subtitle;
   const kickerEl=document.createElement('div');kickerEl.className='docKicker';kickerEl.textContent=kicker;
   titleBox.prepend(kickerEl);
  }
  const stats=document.createElement('div');stats.className='docStats';
  stats.innerHTML=metrics.map(m=>'<div class="docStat"><small>'+m.label+'</small><b>'+m.value+'</b><span>'+m.note+'</span></div>').join('');
  card.insertBefore(stats,card.querySelector('.invoiceFilters,.tableWrap,.invoiceCalendar,#boletaCount,#guideCount')||card.children[1]);
  const info=document.createElement('div');info.className='docInfoBar';
  info.innerHTML='<strong>Información disponible</strong><span>'+fields.map(x=>'<em>'+x+'</em>').join('')+'</span>';
  card.insertBefore(info,stats.nextSibling);
  const table=card.querySelector('table');
  if(table)table.classList.add('docDataTable');
 };
 const origInv=renderInvoices;
 renderInvoices=function(){origInv();const rows=state.snapshot?.invoices||[];addShell('invoices','docInvoices','💶 Facturas','DOCUMENTOS TRIBUTARIOS · FACTURACIÓN','Factura electrónica con cliente, RUT, importes y volumen.',rows,[{label:'Facturas',value:rows.length.toLocaleString('es-CL'),note:'documentos registrados'},{label:'Neto',value:'$ '+money(sum(rows,'neto')),note:'base afecta'},{label:'IVA',value:'$ '+money(sum(rows,'iva')),note:'impuesto registrado'},{label:'Total',value:'$ '+money(sum(rows,'total')),note:'valor documental'},{label:'KG',value:money(sum(rows,'kg')),note:'volumen asociado'}],['Folio','Fecha','Cliente / RUT','Productos','Neto','IVA','Total','KG','Sacos','Estado','Detalle']);};
 const origGuide=renderGuides;
 renderGuides=function(){origGuide();const rows=state.snapshot?.guides||[];const estados=new Set(rows.map(r=>String(r.estado||'').trim()).filter(Boolean)).size;addShell('guides','docGuides','🚚 Guías de despacho','DOCUMENTOS DE MOVILIZACIÓN · DESPACHOS','Guías con receptor, operación, referencias e importes.',rows,[{label:'Guías',value:rows.length.toLocaleString('es-CL'),note:'documentos registrados'},{label:'Estados',value:String(estados),note:'estados detectados'},{label:'Neto',value:'$ '+money(sum(rows,'neto')),note:'base documental'},{label:'IVA',value:'$ '+money(sum(rows,'iva')),note:'impuesto registrado'},{label:'Total',value:'$ '+money(sum(rows,'total')),note:'valor documental'}],['Folio','Fecha','Estado','Operación','RUT receptor','Receptor','Neto','IVA','Total','Referencia']);};
 const origBol=renderBoletas;
 renderBoletas=function(){origBol();const rows=state.snapshot?.boletas||[];addShell('boletas','docBoletas','🧾 Boletas','DOCUMENTOS TRIBUTARIOS · BOLETAS','Boletas con detalle de productos, cantidades y totales.',rows,[{label:'Boletas',value:rows.length.toLocaleString('es-CL'),note:'documentos registrados'},{label:'Neto',value:'$ '+money(sum(rows,'neto')),note:'base registrada'},{label:'IVA',value:'$ '+money(sum(rows,'iva')),note:'impuesto registrado'},{label:'Total',value:'$ '+money(sum(rows,'total')),note:'valor documental'},{label:'KG',value:money(sum(rows,'kg')),note:'volumen vendido'}],['Folio','Fecha','Cliente / RUT','Producto / detalle','KG','Sacos','Neto','IVA','Total']);};
 const style=document.createElement('style');style.id='document-modules-v1';style.textContent=`
 .docModule{overflow:hidden;border:1px solid #dbe5ef!important;box-shadow:0 10px 30px rgba(18,58,120,.06)}
 .docModule .sectionTitle{padding:18px 20px 16px;margin:-1px -1px 14px;border-bottom:1px solid rgba(255,255,255,.18);align-items:flex-end}
 .docModuleTitle{font-size:24px!important;letter-spacing:-.02em}
 .docKicker{font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;margin-bottom:4px;opacity:.78}
 .docInvoices .sectionTitle{background:linear-gradient(135deg,#0f3b78,#2569b5);color:#fff}.docBoletas .sectionTitle{background:linear-gradient(135deg,#8b4a00,#cf7b16);color:#fff}.docGuides .sectionTitle{background:linear-gradient(135deg,#075b55,#129282);color:#fff}
 .docInvoices .sectionTitle .note,.docBoletas .sectionTitle .note,.docGuides .sectionTitle .note{color:rgba(255,255,255,.84)}
 .docStats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:0 18px 12px}
 .docStat{background:#f8fbff;border:1px solid #e1e9f2;border-radius:13px;padding:11px 12px}.docStat small{display:block;color:#667085;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.docStat b{display:block;font-size:20px;color:#173f78;margin:3px 0}.docStat span{font-size:10px;color:#98a2b3}
 .docBoletas .docStat b{color:#8b4a00}.docGuides .docStat b{color:#075b55}
 .docInfoBar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:9px 12px;margin:0 18px 12px;border-radius:11px;background:#f6f8fb;border:1px dashed #d9e1ea;color:#667085;font-size:10px}.docInfoBar strong{color:#344054}.docInfoBar span{display:flex;gap:6px;flex-wrap:wrap}.docInfoBar em{font-style:normal;padding:4px 7px;border-radius:999px;background:#fff;border:1px solid #e2e8f0;color:#475467}
 .docDataTable th{white-space:nowrap}.docDataTable td{vertical-align:top}.docDataTable tbody tr:hover{background:#fbfdff}.docModule .tableWrap{margin:0 18px 18px}.docModule .pager{margin:0 18px 18px}
 @media(max-width:1000px){.docStats{grid-template-columns:repeat(3,minmax(0,1fr))}}
 @media(max-width:680px){.docStats{grid-template-columns:repeat(2,minmax(0,1fr));margin:0 10px 10px}.docInfoBar{margin:0 10px 10px}.docModule .tableWrap{margin:0 10px 12px}.docModule .sectionTitle{padding:15px 12px}.docModuleTitle{font-size:20px!important}}
 `;document.head.appendChild(style);
})();
`;
src=src.slice(0,close)+injection+src.slice(close);fs.writeFileSync(file,src);console.log('DOCUMENT MODULES V1 APPLIED');
