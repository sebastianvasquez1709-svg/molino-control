const fs=require('fs');
const p='public/app.js';
let s=fs.readFileSync(p,'utf8');

const exactStart=s.indexOf('function exactIneForExistenceDisplay(m){');
const exactEnd=s.indexOf('\n}\n\nfunction existenceReconciliation',exactStart);
if(exactStart<0||exactEnd<0)throw new Error('No se encontró exactIneForExistenceDisplay.');
const exact=`function exactIneForExistenceDisplay(m){
  if(m?.quality?.sourceType!=='existencia') return m||null;
  const targetKey=typeof normalizeInePeriodClient==='function' ? normalizeInePeriodClient(m?.periodo||m?.periodKey||m?.key) : String(m?.key||m?.periodo||'').trim();
  const normalizeMaster=(raw)=>{
    if(!raw||!Array.isArray(raw.items)||!Number.isFinite(Number(raw.totalNeto))||!Number.isFinite(Number(raw.totalKg)))return null;
    const items=raw.items.map(x=>{
      const kg=Number(x?.kg)||0,neto=Number(x?.neto)||0;
      return {...x,kg,neto,promedio:kg?neto/kg:0,vn:0,kgp:0};
    });
    const totalKg=items.reduce((a,x)=>a+Number(x.kg||0),0);
    const totalNeto=items.reduce((a,x)=>a+Number(x.neto||0),0);
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
    if(d)return {...d,source:'REGISTRO_FORMULA_MAESTRO_FALLBACK',sourceDescription:'INE recalculado automáticamente desde el Registro con las fórmulas exactas del Maestro.'};
  }
  return null;
}`;
s=s.slice(0,exactStart)+exact+s.slice(exactEnd+3);

// Evita que el Registro de Existencia reemplace el INE mensual del Maestro al arrancar.
const bootMarker="  // V46.0: REGISTRO DE EXISTENCIA es la fuente INE prioritaria por período.";
const bootEnd="  buildNav();try{const saved=localStorage.getItem('molino_user');";
const b0=s.indexOf(bootMarker), b1=s.indexOf(bootEnd,b0);
if(b0>=0&&b1>b0){
  const replacement="  // V49.5: Registro de Existencia e INE Maestro quedan separados. El INE se resuelve automáticamente por período desde el Maestro.\n  state.ineMonths=(state.ineMonths||[]).filter(x=>x?.quality?.sourceType!=='existencia');\n";
  s=s.slice(0,b0)+replacement+s.slice(b1);
}

// Impide que una importación de Existencia contamine el histórico INE.
const oldImport="  const ineRows=state.ineMonths.filter(x=>x.key!==entry.key);\n  ineRows.push(entry);await persistIneMonths(ineRows);\n";
if(s.includes(oldImport))s=s.replace(oldImport,'  // Registro de Existencia se persiste solo en existenceRecords/existenceBase; no sustituye el INE Maestro mensual.\n');

// Garantiza que la tabla principal nunca muestre PROMEDIO=0 cuando hay NETO y KG.
const oldDm="    const dm=new Map((d?.items||[]).map(x=>[String(x.name||'').toUpperCase(),x]));";
const newDm="    const dm=new Map((d?.items||[]).map(x=>{const kg=Number(x?.kg)||0,neto=Number(x?.neto)||0;return [String(x.name||'').toUpperCase(),{...x,kg,neto,promedio:kg?neto/kg:0,vn:Number(x?.vn)||0,kgp:Number(x?.kgp)||0}]}));";
if(s.includes(oldDm))s=s.replace(oldDm,newDm);

fs.writeFileSync(p,s);
console.log('PUBLIC EXISTENCE MASTER INE V3 AUTO-PERIOD + EXACT AVERAGES: PASS');
