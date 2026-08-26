const fs=require('fs');
const p='public/app.js';
let s=fs.readFileSync(p,'utf8');
const start=s.indexOf('function exactIneForExistenceDisplay(m){');
if(start<0) throw new Error('No se encontró exactIneForExistenceDisplay en public/app.js.');
const end=s.indexOf('\nfunction existenceReconciliation',start);
if(end<0) throw new Error('No se encontró límite de exactIneForExistenceDisplay.');
const neu=`function normalizeMasterPeriodKey(v){
  const raw=String(v??'').trim().toLowerCase();
  if(/^\\d{4}-\\d{2}$/.test(raw)) return raw;
  const months={enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',julio:'07',agosto:'08',septiembre:'09',setiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'};
  const y=(raw.match(/\\d{4}/)||[])[0]||'';
  const m=Object.entries(months).find(([name])=>raw.includes(name));
  if(y&&m) return y+'-'+m[1];
  const q=raw.match(/(\\d{4})[-\\/](\\d{1,2})/); if(q) return q[1]+'-'+String(parseInt(q[2],10)).padStart(2,'0');
  return raw;
}
function resolveSamePeriodMasterIne(m){
  const target=normalizeMasterPeriodKey(m?.key||m?.periodKey||m?.periodo||'');
  if(!target) return null;
  const sources=[];
  const snap=state?.snapshot||{};
  sources.push(snap.masterIneByPeriod, snap.ineMonths, state?.ineMonths);
  for(const source of sources){
    if(!source) continue;
    const entries=Array.isArray(source)
      ? source.map((v,i)=>[String(v?.key||v?.periodKey||v?.periodo||i),v])
      : Object.entries(source);
    for(const [k,raw] of entries){
      const candidate=raw?.value||raw?.result||raw?.data||raw;
      const candidateKey=normalizeMasterPeriodKey(candidate?.key||candidate?.periodKey||candidate?.periodo||k);
      if(candidateKey!==target) continue;
      if(Array.isArray(candidate?.items) && Number.isFinite(Number(candidate?.totalNeto)) && Number.isFinite(Number(candidate?.totalKg))) return candidate;
    }
  }
  return null;
}
function exactIneForExistenceDisplay(m){
  if(m?.quality?.sourceType!=='existencia') return m||null;
  const key=String(m?.key||m?.periodKey||'').trim();
  const master=resolveSamePeriodMasterIne(m);
  if(master){
    return {
      ...master,
      key,
      periodo:m?.periodo||master?.periodo||key,
      available:true,
      source:'EXCEL_MAESTRO_INE_2_AUTO',
      sourceDescription:'INE del Excel Maestro del mismo período seleccionado automáticamente al calcular/mostrar el INE. Stock del Registro queda separado.',
      audit:{...(master.audit||{}),sourceReconciliation:{status:'MASTER_PRIMARY_AUTO',samePeriodMaster:true,registrationAvailable:!!m?.derivedIne?.available,message:'Selección automática del INE del mismo período del Maestro. El cálculo del Registro se conserva solo para conciliación.'}}
    };
  }
  return m?.derivedIne?.available ? {...m.derivedIne,source:'REGISTRO_FORMULA_FALLBACK'} : null;
}
`;
s=s.slice(0,start)+neu+s.slice(end);
s=s.replace('Stock e INE permanecen separados. El INE del período se calcula directamente desde este Registro con la fórmula universal del Maestro.','Stock e INE permanecen separados. Al calcular el INE se selecciona automáticamente el resultado del mismo período del Excel Maestro; el Registro queda como stock y conciliación.');
fs.writeFileSync(p,s);
console.log('PUBLIC EXISTENCE MASTER INE V2 AUTO-SAME-PERIOD: PASS');
