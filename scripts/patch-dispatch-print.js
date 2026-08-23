const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'app.js');
let src = fs.readFileSync(file, 'utf8');

const start = src.indexOf('function makePrintHtml(rows,from,to,logo){');
const end = src.indexOf('\nfunction buildPrintPlan(){', start);
if (start < 0 || end < 0) throw new Error('No se encontró el bloque makePrintHtml/buildPrintPlan.');

const replacement = String.raw`function makePrintHtml(rows,from,to,logo){
 const weekLabel='Semana '+(from||'____/__/__')+' — '+(to||'____/__/__');
 const safeRows=Array.isArray(rows)?rows:[];
 const escText=value=>esc(String(value??''));
 const tr=safeRows.map((r,i)=>{
   const qty=money(r.cantidad);
   const kg=money(r.kg);
   const obs=String(r.observacion||'').trim();
   return '<tr>'+
     '<td class="c-num">'+(i+1)+'</td>'+ 
     '<td class="c-client">'+escText(r.cliente)+'</td>'+ 
     '<td class="c-rut">'+escText(r.rut)+'</td>'+ 
     '<td class="c-dest">'+escText(r.destination)+'</td>'+ 
     '<td class="c-product">'+escText(r.producto)+'</td>'+ 
     '<td class="c-format">'+escText(r.formato)+'</td>'+ 
     '<td class="c-qty num">'+escText(qty)+'</td>'+ 
     '<td class="c-kg num">'+escText(kg)+'</td>'+ 
     '<td class="c-date">'+escText(r.fecha)+'</td>'+ 
     '<td class="c-oc">'+escText(r.oc||'O/C PENDIENTE')+'</td>'+ 
     '<td class="c-obs">'+escText(obs)+'</td>'+ 
   '</tr>';
 }).join('');
 const totalKg=safeRows.reduce((s,r)=>s+n(r.kg),0);
 const totalQty=safeRows.reduce((s,r)=>s+n(r.cantidad),0);
 const logoHtml=logo
   ? '<img src="'+String(logo)+'" alt="Molinos San Miguel" class="printLogo">'
   : '<div class="logoFallback">MOLINOS<br>SAN MIGUEL</div>';
 const empty='<tr><td colspan="11" class="empty">Sin despachos registrados.</td></tr>';
 return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Planilla de Despachos - Molino Control</title><style>'+ 
 '@page{size:A4 landscape;margin:7mm 6mm 7mm 6mm}'+
 'html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}'+
 'body{font-size:9px;line-height:1.3;-webkit-print-color-adjust:exact;print-color-adjust:exact;letter-spacing:normal}'+
 '.sheet{width:100%;box-sizing:border-box}'+
 '.header{display:grid;grid-template-columns:82px 1fr 160px;align-items:center;border-bottom:2px solid #123a78;padding-bottom:7px;margin-bottom:7px;gap:8px}'+
 '.printLogo{width:70px;height:52px;object-fit:contain}'+
 '.logoFallback{width:70px;font-weight:800;color:#123a78;text-align:center;font-size:10px;line-height:1.1}'+
 '.title{text-align:center;font-size:16px;font-weight:800;color:#123a78;letter-spacing:.1px}'+
 '.sub{text-align:center;font-size:10px;margin-top:3px}'+
 '.meta{text-align:right;font-size:8px;line-height:1.35}'+
 '.table{width:100%;border-collapse:collapse;table-layout:fixed;overflow:visible}'+
 '.table th,.table td{border:1px solid #4b5563;padding:3.5px 4px;vertical-align:middle;white-space:normal;overflow-wrap:anywhere;word-break:normal;line-height:1.32;font-variant-ligatures:none}'+
 '.table th{background:#e8eef7;color:#123a78;font-weight:800;text-align:center;white-space:nowrap;overflow-wrap:normal}'+
 '.table td.num{white-space:nowrap;text-align:right;overflow-wrap:normal}'+
 '.table td.c-rut,.table td.c-date{white-space:nowrap;overflow-wrap:normal}'+
 '.table .c-num{width:3%}.table .c-client{width:13%}.table .c-rut{width:8%}.table .c-dest{width:12%}.table .c-product{width:13%}.table .c-format{width:8%}.table .c-qty{width:6%}.table .c-kg{width:7%}.table .c-date{width:8%}.table .c-oc{width:9%}.table .c-obs{width:13%}'+
 '.empty{text-align:center;padding:20px}'+
 '.totals{display:flex;justify-content:flex-end;gap:16px;flex-wrap:wrap;font-weight:800;margin-top:7px;font-size:9px}'+
 '.footer{margin-top:8px;border-top:1px solid #94a3b8;padding-top:5px;display:flex;justify-content:space-between;gap:12px;font-size:8px}'+
 '.sign{margin-top:15px;display:grid;grid-template-columns:1fr 1fr;gap:60px;font-size:8px}'+
 '.line{border-top:1px solid #111;text-align:center;padding-top:3px}'+
 'thead{display:table-header-group}tbody{display:table-row-group}tr{page-break-inside:avoid;break-inside:avoid}'+
 'button{display:none}'+
 '@media screen{body{padding:14px;background:#eef2f7}.sheet{max-width:1500px;margin:0 auto;background:#fff;padding:14px;box-shadow:0 8px 28px rgba(15,53,109,.10)}}'+
 '</style></head><body><div class="sheet">'+
 '<div class="header">'+logoHtml+'<div><div class="title">REPARTOS / PLANILLA DE DESPACHOS</div><div class="sub">MOLINOS SAN MIGUEL LTDA · '+escText(weekLabel)+'</div></div><div class="meta">Fecha impresión: '+new Date().toLocaleDateString('es-CL')+'<br>Registros: '+safeRows.length+'</div></div>'+ 
 '<table class="table"><colgroup><col class="c-num"><col class="c-client"><col class="c-rut"><col class="c-dest"><col class="c-product"><col class="c-format"><col class="c-qty"><col class="c-kg"><col class="c-date"><col class="c-oc"><col class="c-obs"></colgroup>'+ 
 '<thead><tr><th>#</th><th>Cliente</th><th>RUT</th><th>Destino</th><th>Producto</th><th>Formato</th><th>Cant.</th><th>KG</th><th>Fecha</th><th>O/C</th><th>Observación</th></tr></thead>'+ 
 '<tbody>'+ (tr||empty) +'</tbody></table>'+ 
 '<div class="totals"><span>Total registros: '+safeRows.length+'</span><span>Total KG: '+money(totalKg)+'</span><span>Total unidades: '+money(totalQty)+'</span></div>'+ 
 '<div class="footer"><div>Planilla generada desde Molino Control.</div><div>Hoja semanal de repartos</div></div>'+ 
 '<div class="sign"><div class="line">Preparado / Programado</div><div class="line">Revisado / Despachado</div></div>'+ 
 '</div></body></html>';
}`;

src = src.slice(0, start) + replacement + src.slice(end);

// Reemplazo definitivo del flujo de impresión: nunca usa location.reload(),
// no cambia la vista activa y no depende de ventanas emergentes bloqueadas.
const marker = '// DISPATCH_PRINT_V2_STATE_SAFE';
if (!src.includes(marker)) {
  const close = src.lastIndexOf('\n})();');
  if (close < 0) throw new Error('No se encontró el cierre del IIFE principal.');
  const injection = String.raw`

${marker}
function makeDispatchPrintHtmlV2(rows,from,to,logo){
 const safeRows=Array.isArray(rows)?rows:[];
 const weekLabel='Semana '+(from||'____/__/__')+' — '+(to||'____/__/__');
 const escText=value=>esc(String(value??''));
 const tr=safeRows.map((r,i)=>{
   const qty=money(r.cantidad), kg=money(r.kg), obs=String(r.observacion||'').trim();
   return '<tr>'+
    '<td class="num c-num">'+(i+1)+'</td>'+ 
    '<td class="c-client">'+escText(r.cliente)+'</td>'+ 
    '<td class="c-rut">'+escText(r.rut)+'</td>'+ 
    '<td class="c-dest">'+escText(r.destination)+'</td>'+ 
    '<td class="c-product">'+escText(r.producto)+'</td>'+ 
    '<td class="c-format">'+escText(r.formato)+'</td>'+ 
    '<td class="num c-qty">'+escText(qty)+'</td>'+ 
    '<td class="num c-kg">'+escText(kg)+'</td>'+ 
    '<td class="c-date">'+escText(r.fecha)+'</td>'+ 
    '<td class="c-oc">'+escText(r.oc||'O/C PENDIENTE')+'</td>'+ 
    '<td class="c-obs">'+escText(obs)+'</td>'+ 
   '</tr>';
 }).join('');
 const totalKg=safeRows.reduce((s,r)=>s+n(r.kg),0), totalQty=safeRows.reduce((s,r)=>s+n(r.cantidad),0);
 const logoHtml=logo?'<img src="'+String(logo)+'" alt="Molinos San Miguel" class="printLogo">':'<div class="logoFallback">MOLINOS<br>SAN MIGUEL</div>';
 return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Molino Control - Planilla de Despachos</title><style>'+
  '@page{size:A4 landscape;margin:6mm}'+
  'html,body{margin:0;padding:0;background:#fff;color:#101828;font-family:Arial,Helvetica,sans-serif;font-size:8.7px;line-height:1.35;letter-spacing:normal;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
  '*{box-sizing:border-box}'+
  '.sheet{width:100%;max-width:100%;margin:0 auto}'+
  '.header{display:grid;grid-template-columns:78px 1fr 150px;gap:8px;align-items:center;border-bottom:2px solid #123a78;padding-bottom:6px;margin-bottom:6px}'+
  '.printLogo{width:68px;height:48px;object-fit:contain}'+
  '.logoFallback{width:68px;text-align:center;color:#123a78;font-weight:800;font-size:9px;line-height:1.1}'+
  '.title{text-align:center;color:#123a78;font-size:15px;font-weight:800;letter-spacing:0}'+
  '.sub{text-align:center;font-size:9px;margin-top:2px}'+
  '.meta{text-align:right;font-size:7.8px;line-height:1.35}'+
  'table{width:100%;border-collapse:collapse;table-layout:fixed}'+
  'th,td{border:1px solid #667085;padding:3px 3.5px;vertical-align:middle;white-space:normal;overflow-wrap:anywhere;word-break:normal;font-variant-ligatures:none;line-height:1.35}'+
  'th{background:#e8eef7;color:#123a78;font-weight:800;text-align:center;white-space:nowrap;overflow-wrap:normal}'+
  'td.num{text-align:right;white-space:nowrap;overflow-wrap:normal}'+
  'td.c-rut,td.c-date{white-space:nowrap;overflow-wrap:normal}'+
  '.c-num{width:3%}.c-client{width:13%}.c-rut{width:8%}.c-dest{width:12%}.c-product{width:13%}.c-format{width:8%}.c-qty{width:6%}.c-kg{width:7%}.c-date{width:8%}.c-oc{width:9%}.c-obs{width:13%}'+
  'thead{display:table-header-group}tfoot{display:table-footer-group}tr{page-break-inside:avoid;break-inside:avoid}'+
  '.totals{margin-top:6px;display:flex;justify-content:flex-end;gap:14px;flex-wrap:wrap;font-size:8.5px;font-weight:800}'+
  '.footer{margin-top:6px;border-top:1px solid #98a2b3;padding-top:4px;display:flex;justify-content:space-between;font-size:7.5px}'+
  '.sign{margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:80px;font-size:7.5px}.line{border-top:1px solid #111;text-align:center;padding-top:3px}'+
  '</style></head><body><div class="sheet">'+
  '<div class="header">'+logoHtml+'<div><div class="title">REPARTOS / PLANILLA DE DESPACHOS</div><div class="sub">MOLINOS SAN MIGUEL LTDA · '+escText(weekLabel)+'</div></div><div class="meta">Fecha impresión: '+new Date().toLocaleDateString('es-CL')+'<br>Registros: '+safeRows.length+'</div></div>'+ 
  '<table><colgroup><col class="c-num"><col class="c-client"><col class="c-rut"><col class="c-dest"><col class="c-product"><col class="c-format"><col class="c-qty"><col class="c-kg"><col class="c-date"><col class="c-oc"><col class="c-obs"></colgroup>'+ 
  '<thead><tr><th>#</th><th>Cliente</th><th>RUT</th><th>Destino</th><th>Producto</th><th>Formato</th><th>Cant.</th><th>KG</th><th>Fecha</th><th>O/C</th><th>Observación</th></tr></thead>'+ 
  '<tbody>'+ (tr||'<tr><td colspan="11" style="text-align:center;padding:18px">Sin despachos registrados.</td></tr>') +'</tbody></table>'+ 
  '<div class="totals"><span>Total registros: '+safeRows.length+'</span><span>Total KG: '+money(totalKg)+'</span><span>Total unidades: '+money(totalQty)+'</span></div>'+ 
  '<div class="footer"><span>Planilla generada desde Molino Control.</span><span>Hoja semanal de repartos</span></div>'+ 
  '<div class="sign"><div class="line">Preparado / Programado</div><div class="line">Revisado / Despachado</div></div>'+ 
  '</div></body></html>';
}

window.printDispatchPlan=()=>{
 try{
   const from=$('weekFrom')?.value||'';
   const to=$('weekTo')?.value||'';
   const rows=getDispatchPrintRows();
   const html=makeDispatchPrintHtmlV2(rows,from,to,EMBEDDED_LOGO_DATA);
   const old=$('dispatchPrintFrame');
   if(old)old.remove();
   const frame=document.createElement('iframe');
   frame.id='dispatchPrintFrame';
   frame.title='Vista de impresión de despachos';
   frame.setAttribute('aria-hidden','true');
   frame.style.position='fixed';
   frame.style.left='-12000px';
   frame.style.top='0';
   frame.style.width='1100px';
   frame.style.height='800px';
   frame.style.border='0';
   frame.style.opacity='0';
   frame.style.pointerEvents='none';
   document.body.appendChild(frame);
   let printed=false;
   const doPrint=()=>{
     if(printed)return;
     printed=true;
     try{
       const w=frame.contentWindow;
       if(!w)return;
       w.focus();
       w.print();
     }finally{
       setTimeout(()=>{try{frame.remove()}catch{}},1500);
     }
   };
   frame.onload=()=>setTimeout(()=>{
     try{
       const d=frame.contentDocument;
       if(d?.fonts?.ready){d.fonts.ready.then(()=>requestAnimationFrame(()=>requestAnimationFrame(doPrint))).catch(doPrint)}
       else requestAnimationFrame(()=>requestAnimationFrame(doPrint));
     }catch{doPrint()}
   },80);
   frame.srcdoc=html;
   setTimeout(doPrint,1000);
 }catch(e){
   console.error('DISPATCH_PRINT_V2',e);
   toast('No se pudo preparar la impresión. Revisa la consola.','err');
 }
};
`;
  src = src.slice(0, close) + injection + src.slice(close);
}

fs.writeFileSync(file, src);
console.log('Dispatch print V2 patch applied.');
