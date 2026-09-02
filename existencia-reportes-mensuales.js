/* Molino Control · Informes Mensuales V2
 * Reingeniería: modelo mensual imprimible desde Registro de Existencia,
 * persistencia local + sincronización durable Supabase, y auditoría técnica
 * separada de la salida para Gerencia.
 */
(()=>{
'use strict';

const VERSION='EXISTENCIA_REPORTES_MODELO_V2';
const DB='molino-control-data';
const STORE='existenceRecords';
const STORE_BASE='existenceBase';
const REPORT_SHEETS=[
  ['ine','INE (2)'],
  ['env3','ENVASE (3)'],
  ['env','ENVASE'],
  ['nestleSacos','nestle sacos'],
  ['nestleCpw','Nestle y CPW'],
  ['cpw','cpw graneles'],
  ['nestleGranel','nestle Graneles']
];
const INE_ORDER=['HARINA GRANEL','HARINA 25KG','HARINA 10 KG','HARINILLA KG','GRITZ SEMOL KG','H. F. MAIZ KG','ZOOTECNICA KG','GERMEN KG'];
const FORMULAS={
  AF2:`=IF(AC2=CODIGOS!$J$2,'BASE DE DATOS'!U2,IF('BASE DE DATOS'!AC2=CODIGOS!$J$3,'BASE DE DATOS'!U2,IF('BASE DE DATOS'!AC2=CODIGOS!$J$4,'BASE DE DATOS'!U2,IF('BASE DE DATOS'!AC2=CODIGOS!$J$5,'BASE DE DATOS'!U2,IF('BASE DE DATOS'!AC2=CODIGOS!$J$6,'BASE DE DATOS'!U2,IF('BASE DE DATOS'!AC2=CODIGOS!$J$7,'BASE DE DATOS'!U2,IF('BASE DE DATOS'!AC2=CODIGOS!$J$8,'BASE DE DATOS'!U2,IF(AB2=CODIGOS!$I$2,'BASE DE DATOS'!U2/10,IF(P2=CODIGOS!$J$11,'BASE DE DATOS'!U2/25,IF(AC2=CODIGOS!$J$12,'BASE DE DATOS'!U2/800,IF('BASE DE DATOS'!AC2=CODIGOS!$J$13,'BASE DE DATOS'!U2/800,IF(B2=CODIGOS!$A$39,'BASE DE DATOS'!U2/10,IF(B2=CODIGOS!$A$24,'BASE DE DATOS'!U2/10,'BASE DE DATOS'!U2/25)))))))))))))`,
  AI2:`=IF(AB2=$AP$3,U2/25,IF(AB2=$AP$4,U2/10,U2))`,
  AJ2:`=IF(OR(N2=CODIGOS!$K$2,N2=CODIGOS!$K$4),'BASE DE DATOS'!S2,0)`,
  AK2:`=IF(OR(N2=CODIGOS!$K$2,N2=CODIGOS!$K$4),S2*U2,0)`,
  AL2:`=IF(OR(AB2=$AP$3,AB2=$AP$4,AB2=$AP$2),AK2,0)`,
  AM2:`=IF(N2=CODIGOS!$K$3,'BASE DE DATOS'!S2," ")`,
  AN2:`=IFERROR(VLOOKUP(AM2,CODIGOS!$R$16:$S$111,2,0),0)`,
  AQ2:`=AJ2+AN2`,
  AR2:`=AQ2*U2`,
  INE_D7:`=B7/C7`,
  INE_E7:`=B7/$B$15`,
  INE_F7:`=C7/$C$15`,
  INE_B15:`=SUM(B7:B14)`,
  INE_C15:`=SUM(C7:C14)`,
  INE_D15:`=B15/C15`,
  INE_B18:`=B7+B8+B9`,
  INE_B19:`=C7+C8+C9`,
  INE_B20:`=B18/B19`
};

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const num=v=>{
  if(typeof v==='number')return Number.isFinite(v)?v:0;
  if(v==null||v==='')return 0;
  const raw=String(v).trim();
  if(!raw)return 0;
  const normalized=/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)
    ? raw.replace(/\./g,'').replace(',','.')
    : raw.replace(',','.');
  const n=Number(normalized.replace(/[^\d.-]/g,''));
  return Number.isFinite(n)?n:0;
};
const fmt=(v,d=2)=>num(v).toLocaleString('es-CL',{maximumFractionDigits:d});
const money=v=>'$ '+num(v).toLocaleString('es-CL',{maximumFractionDigits:0});
function val(r,keys){for(const k of keys){if(r&&r[k]!==undefined&&r[k]!==null&&r[k]!=='')return r[k]}return ''}
function nval(r,keys){return num(val(r,keys))}
function normalizeText(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim()}
function periodLabel(r){return r?.periodo||r?.periodKey||r?.key||'Período sin nombre'}

function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function readStore(name){
  const db=await openDb();
  try{
    if(!db.objectStoreNames.contains(name))return [];
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(name,'readonly');
      const q=tx.objectStore(name).getAll();
      q.onsuccess=()=>resolve(q.result||[]);
      q.onerror=()=>reject(q.error);
    });
  } finally { db.close(); }
}
async function loadLocalRecords(){
  let rows=[],bases=[];
  try{rows=await readStore(STORE)}catch(e){console.warn('[REPORTES V2] existenceRecords no disponible',e)}
  try{bases=await readStore(STORE_BASE)}catch(e){console.warn('[REPORTES V2] existenceBase no disponible',e)}
  const bmap=new Map(bases.map(x=>[String(x.key),x]));
  return (Array.isArray(rows)?rows:[]).map(x=>{
    const base=bmap.get(String(x.key));
    return {
      ...x,
      existenceBase:x.existenceBase||base||null,
      detailRows:x.detailRows||base?.detailRows||[],
      summaryRows:x.summaryRows||base?.summaryRows||[],
      familyItems:x.familyItems||base?.familyItems||[]
    };
  }).filter(x=>x?.key).sort((a,b)=>String(a.key).localeCompare(String(b.key)));
}
async function getCloudBridge(){
  if(window.MolinoCloudStateV2)return window.MolinoCloudStateV2;
  try{
    await import('/molino-cloud-state-v2.js');
    return window.MolinoCloudStateV2||null;
  }catch(e){
    console.warn('[REPORTES V2] No se pudo cargar el puente durable',e);
    return null;
  }
}
async function loadRecords(){
  const local=await loadLocalRecords();
  const bridge=await getCloudBridge();
  if(!bridge)return {rows:local,cloudAvailable:false,migrated:0};
  const merged=await bridge.mergeAndMigrate(local);
  return {rows:merged.rows||local,cloudAvailable:!!merged.cloudAvailable,migrated:Number(merged.migrated||0),error:merged.error||null};
}

function sourceRows(record){
  const base=record?.existenceBase||record;
  const detail=Array.isArray(record?.detailRows)&&record.detailRows.length?record.detailRows:
    (Array.isArray(base?.detailRows)?base.detailRows:[]);
  if(detail.length)return detail;
  return (Array.isArray(record?.items)?record.items:[]).map(x=>({...x,salida:nval(x,['kg','cantidad','salida']),family:x.family||x.name||''}));
}
function rowCode(r){return normalizeText(val(r,['code','codigo','CODIGO','Código']))}
function rowFamily(r){return String(val(r,['family','familia','detalle','detail','item','name','Ítem'])||'SIN FAMILIA').trim()}
function rowOrigin(r){return String(val(r,['origenDestino','origen','destino','cliente','client','source','Origen/Destino'])||'SIN ORIGEN/DESTINO').trim()}
function rowKg(r){return nval(r,['salida','salidaKg','Salida','U','u','kg','cantidad','cantidadSalida'])}
function rowValue(r){return nval(r,['salida$','salidaValor','valorSalida','valorMovto$','Valor Movto','valor'])}
function rowText(r){return normalizeText([rowCode(r),rowFamily(r),rowOrigin(r),val(r,['producto','product','AB']),val(r,['detalle','detail','AC']),val(r,['classification','clasificacion','AH']),val(r,['ax','AX'])].join(' '))}
function isBigBag(r){const c=rowCode(r),t=rowText(r);return ['HF800','HFM800','SEMOL800','S800'].includes(c)||/BIG ?BAG|800 ?KG/.test(t)}
function isTenKg(r){const c=rowCode(r),t=rowText(r);return ['10KG','ESP10','HFM10','GRITZGR10','A24','A39'].includes(c)||/(^| )10 ?KG( |$)|SACO X 10/.test(t)}
function isGranel(r){
  const ax=normalizeText(val(r,['ax','AX'])),classification=normalizeText(val(r,['classification','clasificacion','AH']));
  if(ax)return ax==='GRANEL';
  if(classification==='GRANEL')return true;
  const t=rowText(r);return !isBigBag(r)&&/(^| )GRANEL( |$)|A GRANEL/.test(t);
}
function modelAf(r){
  const kg=rowKg(r);
  const exactKey=['af','AF','ventasSacos','VENTASSACOS'].find(k=>r&&Object.prototype.hasOwnProperty.call(r,k)&&r[k]!==''&&r[k]!=null);
  if(exactKey)return {value:num(r[exactKey]),rule:'AF validado del Maestro',factor:num(r[exactKey])?kg/num(r[exactKey]):0};
  if(isBigBag(r))return {value:kg/800,rule:'BIG BAG 800 KG → SALIDA / 800',factor:800};
  if(isTenKg(r))return {value:kg/10,rule:'FORMATO 10 KG → SALIDA / 10',factor:10};
  if(isGranel(r))return {value:kg,rule:'GRANEL → SALIDA',factor:1};
  return {value:kg/25,rule:'SACO 25 KG → SALIDA / 25',factor:25};
}
function physicalUnits(r){
  if(isGranel(r))return 0;
  return modelAf(r).value;
}
function modelRow(r){
  const af=modelAf(r);
  return {source:r,code:rowCode(r),family:rowFamily(r),origin:rowOrigin(r),kg:rowKg(r),value:rowValue(r),af:af.value,afRule:af.rule,factor:af.factor,physicalUnits:physicalUnits(r),granel:isGranel(r),bigBag:isBigBag(r)};
}
function modelRows(record){return sourceRows(record).map(modelRow).filter(x=>x.kg!==0||x.value!==0)}
function sumModel(rows){return rows.reduce((a,x)=>({kg:a.kg+x.kg,value:a.value+x.value,af:a.af+x.af,physicalUnits:a.physicalUnits+x.physicalUnits}),{kg:0,value:0,af:0,physicalUnits:0})}
function groupRows(rows,keyFn){
  const map=new Map();
  for(const x of rows){
    const key=keyFn(x)||'SIN CLASIFICAR';
    const o=map.get(key)||{key,kg:0,value:0,af:0,physicalUnits:0,count:0};
    o.kg+=x.kg;o.value+=x.value;o.af+=x.af;o.physicalUnits+=x.physicalUnits;o.count++;
    map.set(key,o);
  }
  return [...map.values()].sort((a,b)=>b.kg-a.kg);
}

function ineItems(record){
  const candidates=[record?.displayIne,record?.derivedIne,record?.existenceBase?.derivedIne];
  for(const c of candidates)if(c?.available!==false&&Array.isArray(c?.items)&&c.items.length)return c.items;
  if(record?.quality?.sourceType!=='existencia'&&Array.isArray(record?.items)&&record.items.length)return record.items;
  return [];
}
function orderedIne(record){
  const items=ineItems(record);
  const map=new Map(items.map(x=>[normalizeText(x.name||x.family),x]));
  return INE_ORDER.map(name=>{
    const x=map.get(normalizeText(name));
    return {name,neto:x?num(x.neto):null,kg:x?num(x.kg):null,promedio:x?.promedio==null?null:num(x.promedio)};
  });
}
function td(v,cls=''){return `<td${cls?` class="${cls}"`:''}>${v}</td>`}
function table(headers,rows,classes=[]){
  return `<div class="mrTableWrap"><table class="mrTable"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map((c,i)=>td(c,classes[i]||'')).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}" class="mrEmpty">Sin datos para este informe.</td></tr>`}</tbody></table></div>`;
}
function pageHeader(title,r){
  return `<div class="mrPageHead"><div class="mrBrand"><img src="/logo molino.jpg" alt="Molinos San Miguel"><div><b>MOLINOS SAN MIGUEL LTDA</b><h2>${esc(title)}</h2><span>Mes: ${esc(periodLabel(r))} · Fuente: Registro de Existencia</span></div></div><div class="mrVersion">Modelo automático<br>${esc(VERSION)}</div></div>`;
}
function summary(items){return `<div class="mrSummary">${items.map(([k,v])=>`<div><span>${esc(k)}</span><b>${v}</b></div>`).join('')}</div>`}
function sheet(key,title,r,body){return {key,title,html:`<section class="mrSheet" data-sheet="${esc(key)}">${pageHeader(title,r)}${body}</section>`}}

function renderIne(r){
  const rows=orderedIne(r);
  const available=rows.some(x=>x.neto!==null&&x.kg!==null);
  const totalNeto=rows.reduce((a,x)=>a+num(x.neto),0),totalKg=rows.reduce((a,x)=>a+num(x.kg),0);
  const body=rows.map(x=>{
    const p=x.promedio!=null?x.promedio:(x.kg?num(x.neto)/num(x.kg):null);
    return [esc(x.name),x.neto==null?'N/D':money(x.neto),x.kg==null?'N/D':fmt(x.kg,0),p==null?'N/D':money(p),!available||!totalNeto||x.neto==null?'N/D':((num(x.neto)/totalNeto)*100).toFixed(1)+'%',!available||!totalKg||x.kg==null?'N/D':((num(x.kg)/totalKg)*100).toFixed(1)+'%'];
  });
  if(available)body.push(['TOTAL GENERAL',money(totalNeto),fmt(totalKg,0),money(totalKg?totalNeto/totalKg:0),'100,0%','100,0%']);
  const hn=rows.slice(0,3).reduce((a,x)=>a+num(x.neto),0),hk=rows.slice(0,3).reduce((a,x)=>a+num(x.kg),0);
  const note=available?'':'<div class="mrWarn">Este Registro no contiene un INE derivado validado. No se inventan NETO/KG de ventas desde el stock.</div>';
  return sheet('ine','INE (2) · Ventas mes',r,note+table(['Familia','Valor NETO','Cantidad KG','Promedio','V.N %','KG %'],body,['','num','num','num','num','num'])+summary([['NETO HARINAS',available?money(hn):'N/D'],['KG HARINAS',available?fmt(hk,0):'N/D'],['VALOR PROMEDIO HARINAS',available&&hk?money(hn/hk):'N/D']]));
}
function renderEnv3(r){
  const rows=modelRows(r);
  const granel=rows.filter(x=>x.granel).reduce((a,x)=>a+x.kg,0);
  const papel=rows.filter(x=>/PAPEL/.test(normalizeText(x.family))).reduce((a,x)=>a+x.kg,0);
  return sheet('env3','ENVASE (3)',r,table(['MES','GRANEL KG','PAPEL KG','TOTAL GENERAL KG'],[[esc(periodLabel(r)),fmt(granel,0),fmt(papel,0),fmt(granel+papel,0)]],['','num','num','num']));
}
function renderEnv(r){
  const rows=modelRows(r).filter(x=>x.granel||/PAPEL|ENVASE/.test(normalizeText(x.family)));
  const grouped=groupRows(rows,x=>`${x.origin}|||${x.family}`);
  const body=grouped.map(g=>{const [origin,family]=g.key.split('|||');return [esc(origin),esc(family),fmt(g.kg,0),fmt(g.af,2),money(g.value)]});
  const total=sumModel(rows);
  if(rows.length)body.push(['TOTAL GENERAL','',fmt(total.kg,0),fmt(total.af,2),money(total.value)]);
  return sheet('env','ENVASE · Detalle',r,table(['Origen/Destino','Detalle','KG','VENTAS * SACOS (AF)','Valor'],body,['','','num','num','num']));
}
function classLabel(x){
  const t=normalizeText(`${x.code} ${x.family}`);
  if(x.granel)return 'GRANEL';
  if(x.bigBag)return 'BIG.BAG 800 KG';
  if(/HARINA/.test(t)&&isTenKg(x.source))return 'HARINA *10 KG';
  if(/HARINA/.test(t))return 'HARINA *25 KG';
  if(/GRITZ|SEMOL/.test(t))return 'GRITZ / SEMOLINA';
  if(/HFM|H\. F\. MAIZ|HARINA FINA MAIZ/.test(t))return 'HFM';
  if(/HARINILLA|SALVADO/.test(t))return 'HARINILLA';
  if(/GERMEN/.test(t))return 'GERMEN';
  if(/ZOOT|RACION/.test(t))return 'ZOOTECNICA';
  return x.family||x.code||'SIN CLASIFICAR';
}
function renderNestleSacos(r){
  const rows=modelRows(r).filter(x=>!x.granel);
  const grouped=groupRows(rows,classLabel);
  const body=grouped.map(g=>[esc(g.key),fmt(g.af,2),fmt(g.kg,0),fmt(g.physicalUnits,2)]);
  const total=sumModel(rows);
  if(rows.length)body.push(['TOTAL GENERAL',fmt(total.af,2),fmt(total.kg,0),fmt(total.physicalUnits,2)]);
  return sheet('nestleSacos','nestle sacos',r,table(['CLASIFICACIÓN','VENTAS * SACOS (AF)','KG','UNIDADES FÍSICAS'],body,['','num','num','num'])+`<p class="mrNote">VENTAS * SACOS replica la semántica del Maestro: 10 KG ÷10, 25 KG ÷25 y Big Bag ÷800. El granel se informa en sus hojas específicas.</p>`);
}
function renderOriginGranel(r,key,title,pattern){
  const rows=modelRows(r).filter(x=>x.granel&&pattern.test(normalizeText(x.origin)));
  const grouped=groupRows(rows,x=>`${x.origin}|||${x.family}`);
  const body=grouped.map(g=>{const [origin,family]=g.key.split('|||');return [esc(origin),esc(family),fmt(g.kg,0),fmt(g.af,2),money(g.value)]});
  const total=sumModel(rows);
  if(rows.length)body.push(['TOTAL GENERAL','',fmt(total.kg,0),fmt(total.af,2),money(total.value)]);
  return sheet(key,title,r,table(['Origen/Destino','Detalle','KG','AF / KG granel','Valor'],body,['','','num','num','num']));
}
function renderNestleCpw(r){return renderOriginGranel(r,'nestleCpw','Nestle y CPW',/NESTLE|CPW|HEREDIA/)}
function renderCpw(r){return renderOriginGranel(r,'cpw','cpw graneles',/CPW|CEREALES/)}
function renderNestleGranel(r){return renderOriginGranel(r,'nestleGranel','nestle Graneles',/NESTLE/)}

function buildSheets(r){return [renderIne(r),renderEnv3(r),renderEnv(r),renderNestleSacos(r),renderNestleCpw(r),renderCpw(r),renderNestleGranel(r)]}
function auditPanel(r){
  const rows=modelRows(r);
  const ruleCounts=groupRows(rows,x=>x.afRule).map(x=>`<tr><td>${esc(x.key)}</td><td class="num">${x.count}</td><td class="num">${fmt(x.kg,0)}</td><td class="num">${fmt(x.af,2)}</td></tr>`).join('');
  const formulaRows=Object.entries(FORMULAS).map(([k,v])=>`<div class="mrFormula"><b>${esc(k)}</b><code>${esc(v)}</code></div>`).join('');
  return `<details class="mrAudit"><summary>🔎 Auditoría técnica y fórmulas del Maestro</summary><p>Esta sección sirve para validar el motor. <b>No se imprime</b> en el informe para Gerencia.</p><div class="mrTableWrap"><table class="mrTable"><thead><tr><th>Regla aplicada</th><th>Filas</th><th>KG</th><th>Resultado AF</th></tr></thead><tbody>${ruleCounts||'<tr><td colspan="4">Sin filas</td></tr>'}</tbody></table></div><div class="mrFormulaGrid">${formulaRows}</div></details>`;
}
function ensureStyles(){
  if(document.getElementById('mrV2Styles'))return;
  const style=document.createElement('style');
  style.id='mrV2Styles';
  style.textContent=`
  .mrHero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;background:linear-gradient(135deg,#123a78,#1e56a0);color:#fff;border-radius:18px;padding:20px;margin-bottom:14px}
  .mrHero h1{margin:4px 0 6px;font-size:24px}.mrHero p{margin:0;opacity:.9}.mrActions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.mrActions select{min-width:210px;background:#fff}
  .mrStatus{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.mrBadge{display:inline-flex;padding:6px 10px;border-radius:999px;background:#eef4ff;color:#174ea6;font-size:12px;font-weight:800}.mrBadge.ok{background:#ecfdf3;color:#067647}.mrBadge.warn{background:#fff8eb;color:#9a6700}
  .mrPreview{display:grid;gap:16px}.mrPreviewCard{background:#fff;border:1px solid #d9e2ef;border-radius:14px;overflow:hidden}.mrPreviewTools{display:flex;justify-content:flex-end;padding:8px 10px;border-bottom:1px solid #edf1f6;background:#f8fafc}
  .mrSheet{padding:18px}.mrPageHead{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #123a78;padding-bottom:10px;margin-bottom:12px}.mrBrand{display:flex;gap:12px;align-items:center}.mrBrand img{width:58px;height:58px;object-fit:contain}.mrBrand b{color:#123a78}.mrBrand h2{margin:2px 0;font-size:19px}.mrBrand span,.mrVersion{font-size:11px;color:#667085}.mrVersion{text-align:right}
  .mrTableWrap{overflow:auto;border:1px solid #d9e2ef;border-radius:10px}.mrTable{width:100%;border-collapse:collapse;font-size:11px;background:#fff}.mrTable th,.mrTable td{border-bottom:1px solid #edf1f6;padding:7px 8px;text-align:left;white-space:nowrap}.mrTable th{background:#eef4fb;color:#344054}.mrTable .num{text-align:right;font-variant-numeric:tabular-nums}.mrTable tbody tr:last-child td{font-weight:800;border-top:2px solid #123a78}.mrEmpty{text-align:center!important;color:#667085;padding:24px!important}
  .mrSummary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.mrSummary>div{border:1px solid #d9e2ef;border-radius:10px;padding:10px;background:#f8fafc}.mrSummary span{display:block;font-size:10px;color:#667085}.mrSummary b{display:block;margin-top:3px;color:#123a78}.mrWarn{background:#fff8eb;color:#9a6700;border:1px solid #f5df9a;border-radius:10px;padding:10px;margin-bottom:10px}.mrNote{font-size:10px;color:#667085}
  .mrAudit{margin-top:16px;background:#fff;border:1px solid #d9e2ef;border-radius:12px;padding:12px}.mrAudit summary{cursor:pointer;font-weight:800;color:#123a78}.mrFormulaGrid{display:grid;gap:6px;margin-top:10px}.mrFormula{display:grid;grid-template-columns:110px 1fr;gap:8px}.mrFormula code{white-space:pre-wrap;word-break:break-word;background:#f8fafc;border:1px solid #edf1f6;padding:6px;border-radius:6px;font-size:10px}
  @media(max-width:800px){.mrHero{flex-direction:column}.mrActions{width:100%}.mrActions>*{flex:1}.mrSummary{grid-template-columns:1fr}.mrPageHead{flex-direction:column}.mrVersion{text-align:left}}
  `;
  document.head.appendChild(style);
}
function printableCss(){
  return `@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,Segoe UI,sans-serif;color:#111;margin:0}.mrSheet{page-break-after:always;padding:0}.mrSheet:last-child{page-break-after:auto}.mrPageHead{display:flex;justify-content:space-between;gap:12px;border-bottom:2px solid #123a78;padding-bottom:8px;margin-bottom:9px}.mrBrand{display:flex;gap:10px;align-items:center}.mrBrand img{width:50px;height:50px;object-fit:contain}.mrBrand b{color:#123a78;font-size:13px}.mrBrand h2{margin:2px 0;font-size:17px}.mrBrand span,.mrVersion{font-size:9px;color:#555}.mrVersion{text-align:right}.mrTable{width:100%;border-collapse:collapse;font-size:8.5px}.mrTable th,.mrTable td{border:1px solid #777;padding:4px 5px;white-space:normal}.mrTable th{background:#e9eef6}.mrTable .num{text-align:right}.mrTable tbody tr:last-child td{font-weight:bold}.mrTableWrap{overflow:visible}.mrSummary{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:7px}.mrSummary>div{border:1px solid #777;padding:6px}.mrSummary span{display:block;font-size:8px}.mrSummary b{font-size:10px}.mrWarn{border:1px solid #b7791f;padding:7px;font-size:9px}.mrNote{font-size:8px;color:#555}.mrAudit,.mrPreviewTools{display:none!important}`;
}
function printSheets(record,onlyKey=null){
  const sheets=buildSheets(record).filter(x=>!onlyKey||x.key===onlyKey);
  if(!sheets.length)return;
  let frame=document.getElementById('mrPrintFrameV2');
  if(frame)frame.remove();
  frame=document.createElement('iframe');
  frame.id='mrPrintFrameV2';
  frame.setAttribute('aria-hidden','true');
  frame.style.cssText='position:fixed;width:1px;height:1px;right:0;bottom:0;border:0;opacity:.01;pointer-events:none';
  document.body.appendChild(frame);
  const doc=frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${esc(location.origin)}/"><title>${esc(periodLabel(record))} · Informes Molino</title><style>${printableCss()}</style></head><body>${sheets.map(x=>x.html).join('')}</body></html>`);
  doc.close();
  const cleanup=()=>setTimeout(()=>frame?.remove(),500);
  const doPrint=()=>{try{frame.contentWindow.focus();frame.contentWindow.print();setTimeout(cleanup,1500)}catch(e){console.error(e);cleanup();alert('No se pudo abrir la impresión.')}};
  if(doc.readyState==='complete')setTimeout(doPrint,350);else frame.onload=()=>setTimeout(doPrint,350);
}
function renderPreview(record){
  const sheets=buildSheets(record);
  return sheets.map(s=>`<div class="mrPreviewCard"><div class="mrPreviewTools"><button class="secondary" type="button" data-mr-print="${esc(s.key)}">🖨️ Imprimir ${esc(s.title)}</button></div>${s.html.replace('<section class="mrSheet"','<div class="mrSheet"').replace('</section>','</div>')}</div>`).join('');
}
async function openPanel(){
  ensureStyles();
  const content=document.getElementById('content'),title=document.getElementById('pageTitle');
  if(!content)return;
  if(title)title.textContent='Informes mensuales · Sacos / Granel';
  content.innerHTML='<div class="card"><h3>⏳ Preparando informes mensuales…</h3><p class="note">Leyendo el historial guardado y sincronizando sin borrar registros.</p></div>';
  let result;
  try{result=await loadRecords()}catch(e){
    console.error(e);
    content.innerHTML=`<div class="card"><h3>⚠️ No se pudo leer el historial</h3><div class="status err">${esc(e?.message||String(e))}</div><button class="secondary" id="mrRetryV2">Reintentar</button></div>`;
    document.getElementById('mrRetryV2').onclick=openPanel;
    return;
  }
  const records=result.rows||[];
  let selected=records[records.length-1]||null;
  const options=records.slice().reverse().map(r=>`<option value="${esc(r.key)}">${esc(periodLabel(r))}</option>`).join('');
  content.innerHTML=`<div class="mrHero"><div><small>MOLINOS SAN MIGUEL LTDA · INFORMES</small><h1>📄 Informes mensuales automáticos</h1><p>Un Registro de Existencia por mes → modelos listos para revisar e imprimir.</p></div><div class="mrActions"><select id="mrMonthV2">${options||'<option value="">Sin registros</option>'}</select><button class="primary" id="mrPrintAllV2" ${selected?'':'disabled'}>🖨️ Imprimir mes completo</button><button class="secondary" id="mrRefreshV2">↻ Sincronizar</button></div></div><div class="mrStatus"><span class="mrBadge ${result.cloudAvailable?'ok':'warn'}">${result.cloudAvailable?'☁️ Historial durable conectado':'💾 Modo local'}</span><span class="mrBadge">${records.length} período${records.length===1?'':'s'} disponible${records.length===1?'':'s'}</span>${result.migrated?`<span class="mrBadge ok">↑ ${result.migrated} período${result.migrated===1?'':'s'} migrado${result.migrated===1?'':'s'} a Supabase</span>`:''}</div><div id="mrPreviewV2" class="mrPreview">${selected?renderPreview(selected):'<div class="card empty">No hay Registros de Existencia guardados. Carga un Registro en “Registros de existencia”; este módulo lo reutilizará automáticamente.</div>'}</div><div id="mrAuditV2">${selected?auditPanel(selected):''}</div>`;
  const sel=document.getElementById('mrMonthV2');
  const draw=()=>{
    selected=records.find(r=>String(r.key)===String(sel.value))||records[records.length-1]||null;
    document.getElementById('mrPreviewV2').innerHTML=selected?renderPreview(selected):'<div class="card empty">Sin registro seleccionado.</div>';
    document.getElementById('mrAuditV2').innerHTML=selected?auditPanel(selected):'';
    document.querySelectorAll('[data-mr-print]').forEach(b=>b.onclick=()=>selected&&printSheets(selected,b.dataset.mrPrint));
  };
  if(sel&&selected)sel.value=selected.key;
  sel.onchange=draw;
  document.getElementById('mrRefreshV2').onclick=openPanel;
  document.getElementById('mrPrintAllV2').onclick=()=>selected&&printSheets(selected);
  draw();
}
function mount(){
  const nav=document.getElementById('nav');
  if(!nav)return false;
  let btn=document.getElementById('monthlyReportsNav');
  if(btn){btn.onclick=openPanel;btn.textContent='📄 Informes mensuales';return true}
  const group=document.createElement('div');
  group.className='navGroup';
  group.innerHTML='<div class="navLabel">INFORMES</div><button type="button" id="monthlyReportsNav">📄 Informes mensuales</button>';
  nav.appendChild(group);
  document.getElementById('monthlyReportsNav').onclick=openPanel;
  return true;
}
let attempts=0;
const timer=setInterval(()=>{attempts++;if(mount()||attempts>80)clearInterval(timer)},250);
document.addEventListener('DOMContentLoaded',()=>mount(),{once:true});
window.MolinoMonthlyReportsV2=Object.freeze({VERSION,openPanel,printSheets,buildSheets,loadRecords,modelRows});
})();
