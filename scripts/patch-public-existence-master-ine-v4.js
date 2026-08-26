const fs=require('fs');
const p='public/app.js';
let s=fs.readFileSync(p,'utf8');
const marker='function renderInePautaTable(m){';
const at=s.indexOf(marker);
if(at<0)throw new Error('No se encontró renderInePautaTable.');
const helper=`
// V50.1: INE oficial automático por período desde molino_ine_sales_exact.
const OFFICIAL_INE_CACHE=globalThis.__molinoOfficialIneCache||(globalThis.__molinoOfficialIneCache=new Map());
function normalizeOfficialInePeriod(v){return typeof normalizeInePeriodClient==='function'?normalizeInePeriodClient(v):String(v??'').trim()}
function officialIneFromRpcPayload(data,key){
 if(!data?.ok||!Array.isArray(data.families))return null;
 const items=data.families.map(r=>{const kg=Number(r?.kg??0)||0,neto=Number(r?.neto??0)||0;return{name:String(r?.familia??r?.name??'').trim(),kg,neto,promedio:Number(r?.promedio??(kg?neto/kg:0))||0,vn:Number(r?.vn_pct??r?.vn??0)||0,kgp:Number(r?.kg_pct??r?.kgp??0)||0}});
 const totalKg=Number(data.total_kg??items.reduce((a,x)=>a+x.kg,0))||0,totalNeto=Number(data.total_neto??items.reduce((a,x)=>a+x.neto,0))||0;
 items.forEach(x=>{if(!x.promedio&&x.kg)x.promedio=x.neto/x.kg;if(!x.vn)x.vn=totalNeto?x.neto/totalNeto:0;if(!x.kgp)x.kgp=totalKg?x.kg/totalKg:0});
 const kgHarinas=Number(data.kg_harinas??items.slice(0,3).reduce((a,x)=>a+x.kg,0))||0,netoHarinas=Number(data.neto_harinas??items.slice(0,3).reduce((a,x)=>a+x.neto,0))||0;
 return{available:true,key,periodo:ineMonthLabel(key),items,totalKg,totalNeto,totalPromedio:Number(data.total_promedio??(totalKg?totalNeto/totalKg:0))||0,netoHarinas,kgHarinas,promedioHarinas:Number(data.promedio_harinas??(kgHarinas?netoHarinas/kgHarinas:0))||0,source:'EXCEL_MAESTRO_INE_RPC',formulaSource:'MAESTRO_FORMULA_FIJA_UNIVERSAL'};
}
async function resolveOfficialInePeriod(periodKey){
 const key=normalizeOfficialInePeriod(periodKey);if(!key)return null;if(OFFICIAL_INE_CACHE.has(key))return OFFICIAL_INE_CACHE.get(key);
 try{const session=await(window.MolinoCloud?.getSession?window.MolinoCloud.getSession():null);if(!session?._identifier)return null;const sb=await window.MolinoCloud.client();const [year,month]=key.split('-').map(Number);const {data,error}=await sb.rpc('molino_ine_sales_exact',{p_rut:session._identifier,p_pin:session._password,p_anio:year,p_mes:month});if(error||!data?.ok)return null;const result=officialIneFromRpcPayload(data,key);if(result)OFFICIAL_INE_CACHE.set(key,result);return result}catch(e){console.warn('INE oficial por período no disponible',e);return null}
}
function exactIneForExistenceDisplay(m){
 if(m?.quality?.sourceType!=='existencia')return m||null;
 const key=normalizeOfficialInePeriod(m?.periodo||m?.periodKey||m?.key);const cached=OFFICIAL_INE_CACHE.get(key);if(cached)return{...cached,key:String(m?.key||key),periodo:m?.periodo||cached.periodo};
 const maps=[state?.snapshot?.masterIneByPeriod||{}];for(const source of maps){for(const [k,v] of Object.entries(source)){if(normalizeOfficialInePeriod(k)!==key)continue;if(v?.items?.length)return {...v,key:String(m?.key||key),periodo:m?.periodo||v.periodo||key,available:true,source:'EXCEL_MAESTRO_INE_2'}}}
 if(m?.derivedIne?.available){const d={...m.derivedIne,source:'REGISTRO_FORMULA_MAESTRO_FALLBACK'};return d}return null;
}
`;
s=s.slice(0,at)+helper+s.slice(at);
const bindMarker="  $('existPrint')?.addEventListener('click',()=>printIneReport(selected));";
if(!s.includes(bindMarker))throw new Error('No se encontró el punto de renderExistencias.');
s=s.replace(bindMarker,bindMarker+`\n  if(selected?.key){const k=normalizeOfficialInePeriod(selected.key);if(!OFFICIAL_INE_CACHE.has(k))Promise.resolve().then(async()=>{const official=await resolveOfficialInePeriod(k);if(official&&state.existenceSelected===selected.key)renderExistencias()})}`);
fs.writeFileSync(p,s);
console.log('PUBLIC EXISTENCE MASTER INE V4 AUTO-RPC-SAME-PERIOD: PASS');
