const fs=require('fs');
const p='public/app.js';
let s=fs.readFileSync(p,'utf8');

const marker='function exactIneForExistenceDisplay(m){';
const exactStart=s.indexOf(marker);
const exactEnd=s.indexOf('\n}\n\nfunction existenceReconciliation',exactStart);
if(exactStart<0||exactEnd<0)throw new Error('No se encontró exactIneForExistenceDisplay.');

const helper=`
// V50.1: INE oficial por período desde el motor Maestro (Supabase RPC), con caché de sesión.
const OFFICIAL_INE_CACHE=globalThis.__molinoOfficialIneCache || (globalThis.__molinoOfficialIneCache=new Map());
function normalizeOfficialInePeriod(v){
  if(typeof normalizeInePeriodClient==='function') return normalizeInePeriodClient(v);
  return String(v??'').trim();
}
function officialIneFromRpcPayload(data,periodKey){
  if(!data?.ok || !Array.isArray(data.families)) return null;
  const items=data.families.map(r=>({
    name:String(r?.familia??r?.name??'').trim(),
    neto:Number(r?.neto??0)||0,
    kg:Number(r?.kg??0)||0,
    promedio:Number(r?.promedio??((Number(r?.kg)||0)?(Number(r?.neto)||0)/(Number(r?.kg)||0):0))||0,
    vn:Number(r?.vn_pct??r?.vn??0)||0,
    kgp:Number(r?.kg_pct??r?.kgp??0)||0
  }));
  const totalKg=Number(data.total_kg??items.reduce((a,x)=>a+x.kg,0))||0;
  const totalNeto=Number(data.total_neto??items.reduce((a,x)=>a+x.neto,0))||0;
  items.forEach(x=>{if(!x.vn)x.vn=totalNeto?x.neto/totalNeto:0;if(!x.kgp)x.kgp=totalKg?x.kg/totalKg:0;if(!x.promedio&&x.kg)x.promedio=x.neto/x.kg});
  const kgHarinas=Number(data.kg_harinas??items.slice(0,3).reduce((a,x)=>a+x.kg,0))||0;
  const netoHarinas=Number(data.neto_harinas??items.slice(0,3).reduce((a,x)=>a+x.neto,0))||0;
  return {
    available:true,
    key:periodKey,
    periodo:ineMonthLabel(periodKey),
    items,
    totalKg,
    totalNeto,
    totalPromedio:Number(data.total_promedio??(totalKg?totalNeto/totalKg:0))||0,
    netoHarinas,
    kgHarinas,
    promedioHarinas:Number(data.promedio_harinas??(kgHarinas?netoHarinas/kgHarinas:0))||0,
    source:'EXCEL_MAESTRO_INE_RPC',
    sourceDescription:'INE oficial calculado automáticamente por el motor Maestro para el mismo período seleccionado.',
    formulaSource:'MAESTRO_FORMULA_FIJA_UNIVERSAL'
  };
}
async function resolveOfficialInePeriod(periodKey){
  const key=normalizeOfficialInePeriod(periodKey);
  if(!key)return null;
  if(OFFICIAL_INE_CACHE.has(key))return OFFICIAL_INE_CACHE.get(key);
  try{
    const session=await (window.MolinoCloud?.getSession?window.MolinoCloud.getSession():null);
    if(!session?._identifier) return null;
    const sb=await window.MolinoCloud.client();
    const [year,month]=key.split('-').map(Number);
    const {data,error}=await sb.rpc('molino_ine_sales_exact',{p_rut:session._identifier,p_pin:session._password,p_anio:year,p_mes:month});
    if(error||!data?.ok) return null;
    const result=officialIneFromRpcPayload(data,key);
    if(result)OFFICIAL_INE_CACHE.set(key,result);
    return result;
  }catch(e){console.warn('INE oficial por período no disponible',e);return null;}
}
`;
s=s.slice(0,exactStart)+helper+s.slice(exactStart);

const newExact=`function exactIneForExistenceDisplay(m){
  if(m?.quality?.sourceType!=='existencia') return m||null;
  const targetKey=typeof normalizeInePeriodClient==='function' ? normalizeInePeriodClient(m?.periodo||m?.periodKey||m?.key) : String(m?.key||m?.periodo||'').trim();
  const cached=OFFICIAL_INE_CACHE.get(targetKey);
  if(cached) return {...cached,key:String(m?.key||targetKey),periodo:m?.periodo||cached.periodo||targetKey};
  const normalizeMaster=(raw)=>{
    if(!raw||!Array.isArray(raw.items)||!Number.isFinite(Number(raw.totalNeto))||!Number.isFinite(Number(raw.totalKg)))return null;
    const items=raw.items.map(x=>{const kg=Number(x?.kg)||0,neto=Number(x?.neto)||0;return {...x,kg,neto,promedio:kg?neto/kg:0,vn:0,kgp:0};});
    const totalKg=items.reduce((a,x)=>a+Number(x.kg||0),0), totalNeto=items.reduce((a,x)=>a+Number(x.neto||0),0);
    items.forEach(x=>{x.vn=totalNeto?x.neto/totalNeto:0;x.kgp=totalKg?x.kg/totalKg:0});
    const kgHarinas=items.slice(0,3).reduce((a,x)=>a+x.kg,0),netoHarinas=items.slice(0,3).reduce((a,x)=>a+x.neto,0);
    return {...raw,key:String(m?.key||targetKey),periodo:m?.periodo||raw.periodo||targetKey,items,totalKg,totalNeto,totalPromedio:totalKg?totalNeto/totalKg:0,kgHarinas,netoHarinas,promedioHarinas:kgHarinas?netoHarinas/kgHarinas:0,available:true,source:'EXCEL_MAESTRO_INE_2',formulaSource:'MAESTRO_FORMULA_FIJA_UNIVERSAL'};
  };
  const candidates=[];
  const map=state?.snapshot?.masterIneByPeriod||{};
  for(const [k,v] of Object.entries(map)){const nk=typeof normalizeInePeriodClient==='function'?normalizeInePeriodClient(k):String(k);if(nk===targetKey)candidates.push(v);}
  for(const v of (state?.ineMonths||[])){if(v?.quality?.sourceType==='existencia')continue;const nk=typeof normalizeInePeriodClient==='function'?normalizeInePeriodClient(v?.key||v?.periodo):String(v?.key||v?.periodo||'');if(nk===targetKey)candidates.push(v);}
  const master=candidates.map(normalizeMaster).find(Boolean);
  if(master)return master;
  if(m?.derivedIne?.available){
    const d=normalizeMaster(m.derivedIne);
    if(d)return {...d,source:'REGISTRO_FORMULA_MAESTRO_FALLBACK',sourceDescription:'INE recalculado desde el Registro con fórmulas del Maestro; se reemplaza automáticamente cuando el motor oficial por período queda disponible.'};
  }
  return null;
}`;
const newExactStart=s.indexOf(marker);
const newExactEnd=s.indexOf('\n}\n\nfunction existenceReconciliation',newExactStart);
s=s.slice(0,newExactStart)+newExact+s.slice(newExactEnd+2);

const bindMarker="  $('existPrint')?.addEventListener('click',()=>printIneReport(selected));";
if(!s.includes(bindMarker)) throw new Error('No se encontró el punto de renderExistencias para el refresco automático.');
const inject=`  $('existPrint')?.addEventListener('click',()=>printIneReport(selected));
  // V50.1: al abrir/cambiar un Registro se consulta automáticamente el INE oficial del mismo período.
  if(selected?.key){
    const _officialKey=normalizeOfficialInePeriod(selected.key);
    if(!OFFICIAL_INE_CACHE.has(_officialKey)){
      Promise.resolve().then(async()=>{
        const official=await resolveOfficialInePeriod(_officialKey);
        if(official && state.existenceSelected===selected.key) renderExistencias();
      });
    }
  }`;
s=s.replace(bindMarker,inject);

// Impresión: garantizar que use el INE oficial cacheado cuando ya fue resuelto.
const printMarker="  const source=exactDisplay||m;";
if(s.includes(printMarker))s=s.replace(printMarker,"  const source=exactDisplay||m;\n  // V50.1: la impresión comparte exactamente la misma fuente oficial por período que la pantalla.");

fs.writeFileSync(p,s);
console.log('PUBLIC EXISTENCE MASTER INE V4 AUTO-RPC-SAME-PERIOD: PASS');
