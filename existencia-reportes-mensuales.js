(()=>{
'use strict';
/**
 * Molino Control — Informes mensuales desde Registro de Existencia.
 * V3: conserva la estructura V2 y corrige las fórmulas copiadas desde el
 * Excel Maestro auditado "TODOS EL AÑO 2025!!!!!!!!!.xlsx".
 * Regla: INFO=1 alimenta INE/informes; INFO=2 queda como stock separado.
 */
const DB='molino-control-data';
const STORE='existenceRecords';
const STORE_BASE='existenceBase';
const VERSION='EXISTENCIA_REPORTES_MODELO_V3';
const REPORT_SHEETS=['INE  (2)','ENVASE (3)','ENVASE','nestle sacos','Nestle y CPW','cpw graneles','nestle Graneles'];
const INE_FAMILIES=['HARINA GRANEL','HARINA 25KG','HARINA 10 KG','HARINILLA KG','GRITZ SEMOL KG','H. F. MAIZ KG','ZOOTECNICA KG','GERMEN KG'];
const FORMULAS=Object.freeze({
  AA2:`=IFERROR(VLOOKUP(B2,CODIGOS!$A$2:$G$95,2,0)," ")`,
  AB2:`=IFERROR(VLOOKUP(B2,CODIGOS!$A$1:$D$50,3,0)," ")`,
  AC2:`=IFERROR(VLOOKUP(B2,CODIGOS!$A$1:$D$50,4,0)," ")`,
  AD2:`=IFERROR(VLOOKUP(B2,CODIGOS!$A$1:$E$50,5,0)," ")`,
  AE2:`=TEXT(L2,"MMMM")`,
  AF2:`=IF(AC2=CODIGOS!$J$2,'BASE DE DATOS'!U2,IF('BASE DE DATOS'!AC2=CODIGOS!$J$3,'BASE DE DATOS'!U2,IF('BASE DE DATOS'!AC2=CODIGOS!$J$4,'BASE DE DATOS'!U2,IF('BASE DE DATOS'!AC2=CODIGOS!$J$5,'BASE DE DATOS'!U2,IF('BASE DE DATOS'!AC2=CODIGOS!$J$6,'BASE DE DATOS'!U2,IF('BASE DE DATOS'!AC2=CODIGOS!$J$7,'BASE DE DATOS'!U2,IF('BASE DE DATOS'!AC2=CODIGOS!$J$8,'BASE DE DATOS'!U2,IF(AB2=CODIGOS!$I$2,'BASE DE DATOS'!U2/10,IF(P2=CODIGOS!$J$11,'BASE DE DATOS'!U2/25,IF(AC2=CODIGOS!$J$12,'BASE DE DATOS'!U2/800,IF('BASE DE DATOS'!AC2=CODIGOS!$J$13,'BASE DE DATOS'!U2/800,IF(B2=CODIGOS!$A$39,'BASE DE DATOS'!U2/10,IF(B2=CODIGOS!$A$24,'BASE DE DATOS'!U2/10,'BASE DE DATOS'!U2/25)))))))))))))`,
  AG2:`=IFERROR(VLOOKUP(B2,CODIGOS!A:F,6,0)," ")`,
  AH2:`=IFERROR(VLOOKUP(B2,CODIGOS!A:G,7,0)," ")`,
  AI2:`=IF(AB2=$AP$3,U2/25,IF(AB2=$AP$4,U2/10,U2))`,
  AJ2:`=IF(OR(N2=CODIGOS!$K$2,N2=CODIGOS!$K$4),'BASE DE DATOS'!S2,0)`,
  AK2:`=IF(OR(N2=CODIGOS!$K$2,N2=CODIGOS!$K$4),S2*U2,0)`,
  AL2:`=IF(OR(AB2=$AP$3,AB2=$AP$4,AB2=$AP$2),AK2,0)`,
  AM2:`=IF(N2=CODIGOS!$K$3,'BASE DE DATOS'!S2," ")`,
  AN2:`=IFERROR(VLOOKUP(AM2,CODIGOS!$R$16:$S$111,2,0),0)`,
  AO2:`=+N2`,
  AQ2:`=AJ2+AN2`,
  AR2:`=+AQ2*U2`,
  AS2:`=AR2*$AP$5`,
  AT2:`=+AL2*$AP$6`,
  AU2:`=AR2+AS2+AT2`,
  AV2:`=IFERROR(VLOOKUP(O2,GUIAS!A:P,12,0),O2)`,
  AW2:`=IF(AO2=$AP$7,$AP$8,AO2)`,
  AX2:`=IF(AH2="GRANEL","GRANEL","SACOS")`,
  AY2:`=TEXT(L2,"YYYY")`,
  AZ2:`=+AE2`,
  INE_D7:`=B7/C7`, INE_E7:`=B7/$B$15`, INE_F7:`=C7/$C$15`,
  INE_B15:`=SUM(B7:B14)`, INE_C15:`=SUM(C7:C14)`, INE_D15:`=B15/C15`,
  INE_B18:`=+B7+B8+B9`, INE_B19:`=+C7+C8+C9`, INE_B20:`=+B18/B19`,
  GUIAS_P2:`=TEXT(M2,"MMMM")`,
  LIBRO_P2:`=VLOOKUP(A2,$W$2:$X$5,2,0)`,
  LIBRO_Q2:`=VLOOKUP(B2,BOLETAS!$A:$B,2,0)`,
  LIBRO_R2:`=+I2-Q2`,
  LIBRO_S2:`=VLOOKUP(B2,BOLETAS!$I:$J,2)`,
  LIBRO_T2:`=+I2-S2`,
  LIBRO_U2:`=TEXT(C2,"MMMM")`,
  NESTLE_SACOS_H16:`=+H10*25`,
  NESTLE_SACOS_H17:`=+I11*25`,
  NESTLE_SACOS_H18:`=+I12*25`,
  NESTLE_SACOS_H20:`=SUM(H16:H18)`,
  NESTLE_CPW_H16:`=+H10`,
  NESTLE_CPW_H17:`=+H11`,
  NESTLE_CPW_H18:`=+I12`,
  NESTLE_CPW_H20:`=SUM(H16:H18)`
});
const CODE_FAMILY=Object.freeze({'10KG':'HARINA 10 KG','25OSN':'HARINA 25KG','25PAP':'HARINA 25KG','25POLI':'HARINA 25KG','DB':'HARINA GRANEL','DEBILGRAN':'HARINA GRANEL','DEBILPAP':'HARINA 25KG','DEBILPAPEL':'HARINA 25KG','DN':'HARINA GRANEL','ESP10':'HARINA 10 KG','ESPOSN':'HARINA 25KG','ESPPAP':'HARINA 25KG','ESPPOLI':'HARINA 25KG','FUERTEGRA':'HARINA GRANEL','FUERTEPAP':'HARINA 25KG','GERGRA':'GERMEN KG','GERMEN':'GERMEN KG','GRITZGR':'GRITZ SEMOL KG','GRITZGRP':'GRITZ SEMOL KG','GRITZM':'GRITZ SEMOL KG','HF800':'H. F. MAIZ KG','HFM':'H. F. MAIZ KG','HFM10':'H. F. MAIZ KG','HFM800':'H. F. MAIZ KG','HFMPAP':'H. F. MAIZ KG','HLLAF':'HARINILLA KG','HLLAFGRA':'HARINILLA KG','HLLAG':'HARINILLA KG','HLLAGGRA':'HARINILLA KG','HZ':'ZOOTECNICA KG','HZGRA':'ZOOTECNICA KG','RACION':'HARINA 25KG','S800':'GRITZ SEMOL KG','SALVADO':'HARINILLA KG','SEMOL':'GRITZ SEMOL KG','SEMOL800':'GRITZ SEMOL KG','SEMOLGRA':'GRITZ SEMOL KG','GRITZGR10':'GRITZ SEMOL KG','HLLAG20':'HARINILLA KG','SEMOLP':'GRITZ SEMOL KG'});
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const esc=s=>String(s??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\':'&#39;','"':'&quot;'}[m]));
const num=v=>{if(typeof v==='number')return Number.isFinite(v)?v:0;if(v==null||v==='')return 0;const s=String(v).replace(/\s/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.');const n=Number(s);return Number.isFinite(n)?n:0};
const fmt=v=>num(v).toLocaleString('es-CL',{maximumFractionDigits:2});
const money=v=>'$ '+num(v).toLocaleString('es-CL',{maximumFractionDigits:0});
const pct=v=>num(v).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
function val(r,keys){for(const k of keys){if(r&&r[k]!==undefined&&r[k]!==null&&r[k]!=='')return r[k]}return ''}
function nval(r,keys){return num(val(r,keys))}
function infoOf(r){return String(val(r,['info','Info','INFO','informacion','Información'])).trim()}
function isInfo(r,n){const i=infoOf(r);return i===''?true:i===String(n)}
function codeOf(r){return norm(val(r,['code','codigo','Código','CODIGO'])).replace(/\s+/g,'')}
function itemOf(r){return String(val(r,['item','ITEM','Ítem','name','nombre','detalle','detail'])).trim()}
function familyOf(r){const code=codeOf(r);if(CODE_FAMILY[code])return CODE_FAMILY[code];const raw=norm(val(r,['family','familia','clase','clasificacion','clasificación','item','name','detalle','detail']));if(/HARINA.*10/.test(raw))return 'HARINA 10 KG';if(/HARINA.*25/.test(raw))return 'HARINA 25KG';if(/HARINA.*GRANEL|\bGRANEL\b/.test(raw))return 'HARINA GRANEL';if(/HARINILLA|SALVADO/.test(raw))return 'HARINILLA KG';if(/GRITZ|SEMOL/.test(raw))return 'GRITZ SEMOL KG';if(/H\.? ?F\.? ?MAIZ|HFM|MAIZ.*HARINA/.test(raw))return 'H. F. MAIZ KG';if(/ZOOT/.test(raw))return 'ZOOTECNICA KG';if(/GERMEN/.test(raw))return 'GERMEN KG';return ''}
function originOf(r){return String(val(r,['origenDestino','origen','Origen/Destino','destino','cliente','client','source'])).trim()||'SIN ORIGEN/DESTINO'}
function salidaKg(r){return nval(r,['salida','Salida','salidaKg','kgSalida','U','u','kg','KG'])}
function entradaKg(r){return nval(r,['entrada','Entrada','entradaKg'])}
function salidaValor(r){return nval(r,['salida$','Salida$','salidaValor','valorSalida','valorMovto$','valorMovimiento$'])}
function sacosFactor(r){const c=codeOf(r),s=norm([itemOf(r),originOf(r)].join(' '));if(/GRANEL/.test(s))return 1;if(/BIG ?BAG/.test(s)||/800/.test(s)||/800/.test(c))return 800;if(['ESP10','10KG','FESP10','A39','A24'].includes(c)||/10 ?KG|SACO X 10/.test(s))return 10;return 25}
function sacosEq(r){const k=salidaKg(r),f=sacosFactor(r);return f>1?k/f:k}
function movementRows(r){const source=Array.isArray(r?.detailRows)?r.detailRows:[];if(!source.length)return [];return source.filter(x=>isInfo(x,1)).filter(x=>Math.abs(salidaKg(x))+Math.abs(entradaKg(x))+Math.abs(salidaValor(x))>0)}
function stockRows(r){const source=Array.isArray(r?.summaryRows)?r.summaryRows:[];if(source.length)return source.filter(x=>isInfo(x,2));return []}
function aggregateFamilies(rows){const map=new Map();for(const r of rows){const fam=familyOf(r)||'NO MAPEADO';const key=norm(fam);const o=map.get(key)||{family:fam,kg:0,sacos:0,valor:0,rows:0,codes:new Set()};o.kg+=salidaKg(r);o.sacos+=sacosEq(r);o.valor+=salidaValor(r);o.rows++;const c=codeOf(r);if(c)o.codes.add(c);map.set(key,o)}return [...map.values()]}
function aggregateOrigins(rows,filter){const map=new Map();for(const r of rows){const origin=originOf(r),family=familyOf(r)||itemOf(r)||'NO MAPEADO';const x={origin,family,row:r};if(filter&&!filter(x))continue;const key=origin+'|'+family;const o=map.get(key)||{origin,family,kg:0,sacos:0,valor:0,rows:0};o.kg+=salidaKg(r);o.sacos+=sacosEq(r);o.valor+=salidaValor(r);o.rows++;map.set(key,o)}return [...map.values()].sort((a,b)=>b.kg-a.kg||a.origin.localeCompare(b.origin))}
function totals(rows){return rows.reduce((a,r)=>({kg:a.kg+salidaKg(r),sacos:a.sacos+sacosEq(r),valor:a.valor+salidaValor(r)}),{kg:0,sacos:0,valor:0})}
function periodLabel(r){return r?.periodo||r?.periodKey||r?.key||'Período sin nombre'}
function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,5);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function readStore(name){const db=await openDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(name,'readonly');const q=tx.objectStore(name).getAll();q.onsuccess=()=>resolve(q.result||[]);q.onerror=()=>reject(q.error)})}finally{db.close()}}
async function loadRecords(){let rows=[];let bases=[];try{rows=await readStore(STORE)}catch{}try{bases=await readStore(STORE_BASE)}catch{}const bm=new Map(bases.map(x=>[String(x.key),x]));return rows.map(x=>{const b=bm.get(String(x.key))||{};return {...x,existenceBase:x.existenceBase||b,detailRows:x.detailRows||b.detailRows||[],summaryRows:x.summaryRows||b.summaryRows||[],familyItems:x.familyItems||b.familyItems||[]}}).filter(x=>x&&x.key).sort((a,b)=>String(a.key).localeCompare(String(b.key)))}
function normalizeIneItems(r){const d=r?.derivedIne;if(!d?.available||!Array.isArray(d.items))return null;const by=new Map(d.items.map(x=>[norm(x.name||x.family),x]));const out=INE_FAMILIES.map(name=>{const x=by.get(norm(name))||{};return {name,neto:num(x.neto),kg:num(x.kg),promedio:x.promedio==null?(num(x.kg)?num(x.neto)/num(x.kg):0):num(x.promedio),vn:num(x.vn),kgp:num(x.kgp)}});const totalNeto=num(d.totalNeto)||out.reduce((a,x)=>a+x.neto,0);const totalKg=num(d.totalKg)||out.reduce((a,x)=>a+x.kg,0);for(const x of out){if(!x.vn)x.vn=totalNeto?x.neto/totalNeto:0;if(!x.kgp)x.kgp=totalKg?x.kg/totalKg:0}const nH=out.slice(0,3).reduce((a,x)=>a+x.neto,0),kH=out.slice(0,3).reduce((a,x)=>a+x.kg,0);return {items:out,totalNeto,totalKg,totalPromedio:totalKg?totalNeto/totalKg:0,netoHarinas:nH,kgHarinas:kH,promedioHarinas:kH?nH/kH:0,formulaSource:d.formulaSource||'MAESTRO_FORMULA_FIJA_UNIVERSAL',available:true}}
function quality(r){const moves=movementRows(r),stocks=stockRows(r),ine=normalizeIneItems(r),unmapped=moves.filter(x=>!familyOf(x)).length;return {moves:moves.length,stocks:stocks.length,unmapped,ine:!!ine,base:!!r?.existenceBase,formula:ine?.formulaSource||'',integrity:r?.quality?.integrityOk!==false}}
function pageHeader(title,r){return `<div class="ph"><div><div class="brand">MOLINOS SAN MIGUEL LTDA</div><h2>${esc(title)}</h2><div>Mes: <b>${esc(periodLabel(r))}</b> · Registro de Existencia</div></div><div class="meta">Informe mensual<br>Molino Control</div></div>`}
function table(headers,rows){return `<table class="reportTable"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c??''}</td>`).join('')}</tr>`).join('')}</tbody></table>`}
function renderIne(r){const d=normalizeIneItems(r);if(!d)return `<section class="sheet"><div class="warning"><b>INE no disponible para este período.</b><br>El Registro no contiene un INE derivado INFO=1 validado con la fórmula universal.</div></section>`;const rows=d.items.map(x=>[esc(x.name),money(x.neto),fmt(x.kg),money(x.promedio),pct(x.vn*100),pct(x.kgp*100)]);rows.push(['TOTAL GENERAL',money(d.totalNeto),fmt(d.totalKg),money(d.totalPromedio),'100,0%','100,0%']);return `<section class="sheet">${pageHeader('INE (2)',r)}${table(['Familia','Valor NETO','Cantidad kg','Promedio','V.N %','KG %'],rows)}<div class="summary"><span>NETO HARINAS <b>${money(d.netoHarinas)}</b></span><span>KG HARINAS <b>${fmt(d.kgHarinas)}</b></span><span>VALOR PROMEDIO HARINAS <b>${money(d.promedioHarinas)}</b></span></div></section>`}
function renderEnv3(r){const moves=movementRows(r);const gr=moves.filter(x=>/GRANEL/.test(norm(itemOf(x)))||familyOf(x)==='HARINA GRANEL').reduce((a,x)=>a+salidaKg(x),0);const papel=moves.filter(x=>/PAPEL/.test(norm(itemOf(x)))).reduce((a,x)=>a+salidaKg(x),0);return `<section class="sheet">${pageHeader('ENVASE (3)',r)}${table(['MES','GRANEL','PAPEL','TOTAL GENERAL'],[[esc(periodLabel(r)),fmt(gr),fmt(papel),fmt(gr+papel)]])}</section>`}
function renderEnv(r){const moves=movementRows(r);const rows=aggregateOrigins(moves,x=>/ENVASE|PAPEL|GRANEL/.test(norm(x.family+' '+itemOf(x.row))));const body=rows.map(x=>[esc(x.origin),esc(x.family),fmt(x.kg),fmt(x.sacos),money(x.valor)]);const t=rows.reduce((a,x)=>({kg:a.kg+x.kg,sacos:a.sacos+x.sacos,valor:a.valor+x.valor}),{kg:0,sacos:0,valor:0});body.push(['TOTAL GENERAL','',fmt(t.kg),fmt(t.sacos),money(t.valor)]);return `<section class="sheet">${pageHeader('ENVASE',r)}${table(['Origen/Destino','Detalle','KG','Sacos equivalentes','Valor'],body)}</section>`}
function renderNestleSacos(r){const fam=aggregateFamilies(movementRows(r));const order=['HARINA 25KG','HARINA 10 KG','GRITZ SEMOL KG','H. F. MAIZ KG','HARINILLA KG','ZOOTECNICA KG','GERMEN KG','HARINA GRANEL'];const data=order.map(name=>{const x=fam.find(z=>norm(z.family)===norm(name));return [esc(name),fmt(x?.sacos||0),fmt(x?.kg||0)]});const totalSacos=data.reduce((a,x)=>a+num(x[1]),0), totalKg=data.reduce((a,x)=>a+num(x[2]),0);data.push(['TOTAL',fmt(totalSacos),fmt(totalKg)]);return `<section class="sheet">${pageHeader('nestle sacos',r)}${table(['CLASIFICACION','VENTAS * SACOS','KG'],data)}</section>`}
function renderNestleCPW(r){const rows=aggregateOrigins(movementRows(r),x=>/NESTLE|CPW|HEREDIA/.test(norm(x.origin))&&(/GRANEL/.test(norm(x.family+' '+itemOf(x.row)))||familyOf(x.row)==='HARINA GRANEL'));const data=rows.map(x=>[esc(x.origin),esc(x.family),fmt(x.kg)]);const total=rows.reduce((a,x)=>a+x.kg,0);data.push(['TOTAL GRANEL','',fmt(total)]);return `<section class="sheet">${pageHeader('Nestle y CPW',r)}${table(['Origen/Destino','Detalle','KG'],data)}</section>`}
function renderCPW(r){const rows=aggregateOrigins(movementRows(r),x=>/CPW|CEREALES/.test(norm(x.origin))&&(/GRANEL/.test(norm(x.family+' '+itemOf(x.row)))||familyOf(x.row)==='HARINA GRANEL'));const data=rows.map(x=>[esc(x.origin),esc(x.family),fmt(x.kg),money(x.valor)]);const total=rows.reduce((a,x)=>({kg:a.kg+x.kg,valor:a.valor+x.valor}),{kg:0,valor:0});data.push(['TOTAL GENERAL','',fmt(total.kg),money(total.valor)]);return `<section class="sheet">${pageHeader('cpw graneles',r)}${table(['Origen/Destino','Detalle','KG','Valor'],data)}</section>`}
function renderNestleGranel(r){const rows=aggregateOrigins(movementRows(r),x=>/NESTLE/.test(norm(x.origin))&&(/GRANEL/.test(norm(x.family+' '+itemOf(x.row)))||familyOf(x.row)==='HARINA GRANEL'));const data=rows.map(x=>[esc(x.origin),esc(x.family),fmt(x.kg),money(x.valor)]);const total=rows.reduce((a,x)=>({kg:a.kg+x.kg,valor:a.valor+x.valor}),{kg:0,valor:0});data.push(['TOTAL GENERAL','',fmt(total.kg),money(total.valor)]);return `<section class="sheet">${pageHeader('nestle Graneles',r)}${table(['Origen/Destino','Detalle','KG','Valor'],data)}</section>`}
function build(r){return [renderIne(r),renderEnv3(r),renderEnv(r),renderNestleSacos(r),renderNestleCPW(r),renderCPW(r),renderNestleGranel(r)].join('')}
function previewHtml(r){return build(r).replace(/<section class="sheet"/g,'<div class="previewBlock"').replace(/<\/section>/g,'</div>')}
function statusHtml(q){const cls=q.integrity&&q.unmapped===0&&q.ine?'ok':'warn';return `<div class="status ${cls}" style="margin-top:12px"><b>${q.integrity?'Integridad del Registro OK':'Revisar integridad del Registro'}</b> · INFO=1: ${q.moves.toLocaleString('es-CL')} movimientos · INFO=2: ${q.stocks.toLocaleString('es-CL')} resúmenes · No mapeados: ${q.unmapped.toLocaleString('es-CL')} · INE: ${q.ine?'disponible':'no disponible'}</div>`}
async function openPanel(){const content=document.getElementById('content'),title=document.getElementById('pageTitle');if(!content)return;title.textContent='Informes mensuales · Sacos / Granel';content.innerHTML='<div class="card"><h3>Generando informes…</h3></div>';let records=await loadRecords();let selected=records[records.length-1]||null;const options=records.slice().reverse().map(r=>`<option value="${esc(r.key)}">${esc(periodLabel(r))}</option>`).join('');content.innerHTML=`<div class="card"><div class="sectionTitle"><div><h3>📄 Informes mensuales listos para imprimir</h3><div class="note">Fuente: Registros de Existencia ya guardados. INFO=1 se usa para INE/informes y INFO=2 permanece como stock.</div></div><div class="toolbar"><select id="mrMonth">${options||'<option value="">Sin registros cargados</option>'}</select><button class="primary" id="mrPrintAll" ${selected?'':'disabled'}>🖨️ Imprimir mes completo</button><button class="secondary" id="mrRefresh">↻ Actualizar</button></div></div><div class="sheetList">${REPORT_SHEETS.map(s=>`<span class="sheetTag">${esc(s)}</span>`).join('')}</div><div id="mrQuality">${selected?statusHtml(quality(selected)):''}</div><div id="mrPreview" style="margin-top:14px">${selected?previewHtml(selected):'<div class="empty">No hay Registros de Existencia guardados.</div>'}</div></div>`;const sel=document.getElementById('mrMonth');const draw=()=>{selected=records.find(r=>String(r.key)===String(sel.value))||records[records.length-1]||null;document.getElementById('mrQuality').innerHTML=selected?statusHtml(quality(selected)):'';document.getElementById('mrPreview').innerHTML=selected?previewHtml(selected):'<div class="empty">Sin registro</div>'};sel.onchange=draw;document.getElementById('mrRefresh').onclick=openPanel;document.getElementById('mrPrintAll').onclick=()=>selected&&printAll(selected)}
function printAll(r){const css=`<style>@page{size:A4 landscape;margin:9mm}*{box-sizing:border-box}body{font-family:Arial,Segoe UI,sans-serif;color:#111;margin:0}.sheet{page-break-after:always}.sheet:last-child{page-break-after:auto}.ph{display:flex;justify-content:space-between;border-bottom:2px solid #123a78;padding-bottom:8px;margin-bottom:10px}.brand{font-weight:800;color:#123a78;font-size:16px}.ph h2{margin:4px 0;font-size:20px}.meta{text-align:right;font-size:10px;color:#555}.reportTable{width:100%;border-collapse:collapse;font-size:9px}.reportTable th,.reportTable td{border:1px solid #777;padding:4px 5px}.reportTable th{background:#e9eef6}.summary{display:flex;justify-content:space-between;border:1px solid #777;padding:7px;margin-top:8px;font-size:10px}</style>`;const html=`<!doctype html><html><head><meta charset="utf-8">${css}</head><body>${build(r)}</body></html>`;const w=window.open('','_blank','width=1200,height=900');if(!w){alert('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para Molino Control.');return}w.document.open();w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),500)}
function mount(){const nav=document.getElementById('nav');if(!nav)return false;if(document.getElementById('monthlyReportsNav'))return true;const group=document.createElement('div');group.className='navGroup';group.innerHTML='<div class="navLabel">INFORMES</div><button type="button" id="monthlyReportsNav">📄 Informes mensuales</button>';nav.appendChild(group);document.getElementById('monthlyReportsNav').onclick=openPanel;return true}
let tries=0;const timer=setInterval(()=>{tries++;if(mount()||tries>80)clearInterval(timer)},150);
window.MolinoMonthlyReports={version:VERSION,formulas:FORMULAS,open:openPanel,build,quality};
})();