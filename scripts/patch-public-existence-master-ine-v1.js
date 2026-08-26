const fs=require('fs');
const p='public/app.js';
let s=fs.readFileSync(p,'utf8');
const old=`function exactIneForExistenceDisplay(m){
  if(m?.quality?.sourceType!=='existencia') return m||null;
  return m?.derivedIne?.available ? m.derivedIne : null;
}`;
const neu=`function exactIneForExistenceDisplay(m){
  if(m?.quality?.sourceType!=='existencia') return m||null;
  const key=String(m?.key||m?.periodKey||'').trim();
  const master=state?.snapshot?.masterIneByPeriod?.[key] || state?.snapshot?.masterIneByPeriod?.[String(m?.periodo||'').trim()];
  if(master && Array.isArray(master.items) && Number.isFinite(Number(master.totalNeto)) && Number.isFinite(Number(master.totalKg))){
    return {
      ...master,
      key,
      periodo:m?.periodo||key,
      available:true,
      source:'EXCEL_MAESTRO_INE_2',
      sourceDescription:'INE oficial del mismo período del Excel Maestro; el Registro de Existencia permanece separado para stock y conciliación.',
      audit:{...(master.audit||{}),sourceReconciliation:{status:'MASTER_PRIMARY',samePeriodMaster:true,registrationAvailable:!!m?.derivedIne?.available,message:'El INE visible coincide con el mismo período del Maestro. El INE recalculado desde el Registro queda para conciliación.'}}
    };
  }
  return m?.derivedIne?.available ? {...m.derivedIne,source:'REGISTRO_FORMULA_FALLBACK'} : null;
}`;
if(!s.includes(old)) throw new Error('No se encontró exactIneForExistenceDisplay en public/app.js.');
s=s.replace(old,neu);
s=s.replace('Stock e INE permanecen separados. El INE del período se calcula directamente desde este Registro con la fórmula universal del Maestro.','Stock e INE permanecen separados. El INE visible usa el mismo período del Excel Maestro cuando está disponible; el Registro queda como fuente de stock y conciliación.');
fs.writeFileSync(p,s);
console.log('PUBLIC EXISTENCE MASTER INE V1: PASS');
