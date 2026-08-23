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
 'body{font-size:9px;line-height:1.25;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
 '.sheet{width:100%;box-sizing:border-box}'+
 '.header{display:grid;grid-template-columns:82px 1fr 160px;align-items:center;border-bottom:2px solid #123a78;padding-bottom:7px;margin-bottom:7px;gap:8px}'+
 '.printLogo{width:70px;height:52px;object-fit:contain}'+
 '.logoFallback{width:70px;font-weight:800;color:#123a78;text-align:center;font-size:10px;line-height:1.1}'+
 '.title{text-align:center;font-size:16px;font-weight:800;color:#123a78;letter-spacing:.1px}'+
 '.sub{text-align:center;font-size:10px;margin-top:3px}'+
 '.meta{text-align:right;font-size:8px;line-height:1.35}'+
 '.table{width:100%;border-collapse:collapse;table-layout:fixed}'+
 '.table th,.table td{border:1px solid #4b5563;padding:3px 4px;vertical-align:middle;white-space:normal;overflow-wrap:break-word;word-break:normal;line-height:1.22}'+
 '.table th{background:#e8eef7;color:#123a78;font-weight:800;text-align:center;white-space:nowrap}'+
 '.table td.num{white-space:nowrap;text-align:right}'+
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
fs.writeFileSync(file, src);
console.log('Dispatch print block patched.');
`;

if (/class=\\\\\"/.test(replacement) || /<div class=\\\\\"/.test(replacement)) {
  throw new Error('Patch contiene escapes de comillas no válidos.');
}
