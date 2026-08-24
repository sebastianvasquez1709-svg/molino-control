const fs=require('fs');
const p='ine-sacos-granel-automatico-v7.js';
let s=fs.readFileSync(p,'utf8');
const old="const ventasSacos=fam.reduce((a,x)=>a+n(x.sacos),0);const kgSacos=matrix.reduce((a,x)=>a+n(x.sacos),0);const kgGranel=detail.reduce((a,x)=>a+n(x.kg),0);const totalKg=kgSacos*25+kgGranel;";
const neu="const selectedPeriod=p.find(x=>x.anio===sel.anio&&x.mes===sel.mes)||{};const ventasSacos=n(selectedPeriod.ventas_sacos);const kgSacos=n(selectedPeriod.kg_sacos);const kgGranel=n(selectedPeriod.kg_granel);const totalKg=kgSacos+kgGranel;";
if(!s.includes(neu)){if(!s.includes(old))throw new Error('No se encontró cálculo V7 a corregir');s=s.replace(old,neu).replace('f(kgSacos*25)','f(kgSacos)');fs.writeFileSync(p,s)}
console.log('REPORTS CLOUD V7: PERIOD TOTALS CORRECTED');
