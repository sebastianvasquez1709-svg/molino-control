const fs=require('fs');
const p='app.js';
let s=fs.readFileSync(p,'utf8');
const old=`function exactIneForExistenceDisplay(m){
  if(m?.quality?.sourceType!=='existencia') return m||null;
  return m?.derivedIne?.available ? m.derivedIne : null;
}`;
const neu=`function exactIneForExistenceDisplay(m){
  if(m?.quality?.sourceType!=='existencia') return m||null;
  // V1: cuando existe el mismo período en BASE DE DATOS/INE (2) del Maestro,
  // la vista de Registros de Existencia usa ese resultado como INE oficial.
  // El stock del Registro permanece independiente y no se mezcla con INE.
  const key=String(m?.key||m?.periodKey||'').trim();
  const master=state?.snapshot?.masterIneByPeriod?.[key] || state?.snapshot?.masterIneByPeriod?.[String(m?.periodo||'').trim()];
  if(master && Array.isArray(master.items) && Number.isFinite(Number(master.totalNeto)) && Number.isFinite(Number(master.totalKg))){
    return {
      ...master,
      key,
      periodo:m?.periodo||key,
      available:true,
      source:'EXCEL_MAESTRO_INE_2',
      sourceDescription:'INE oficial del mismo período del Excel Maestro; el Registro de Existencia se conserva como fuente separada para stock y conciliación.',
      audit:{...(master.audit||{}),sourceReconciliation:{status:'MASTER_PRIMARY',samePeriodMaster:true,registrationAvailable:!!m?.derivedIne?.available,message:'Se muestra el INE del mismo período del Maestro. El INE recalculado desde el Registro se conserva para conciliación y auditoría.'}}
    };
  }
  return m?.derivedIne?.available ? {...m.derivedIne,source:'REGISTRO_FORMULA_FALLBACK'} : null;
}`;
if(!s.includes(old)) throw new Error('No se encontró exactIneForExistenceDisplay esperado.');
s=s.replace(old,neu);
const oldText='Stock e INE permanecen separados. El INE del período se calcula directamente desde este Registro con la fórmula universal del Maestro.';
const newText='Stock e INE permanecen separados. El INE visible usa el mismo período del Excel Maestro cuando está disponible; el Registro queda como fuente de stock y conciliación.';
s=s.replace(oldText,newText);
fs.writeFileSync(p,s);
console.log('EXISTENCE MASTER INE V1: Registro usa INE del mismo período del Maestro; stock separado.');
