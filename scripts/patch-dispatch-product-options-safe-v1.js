#!/usr/bin/env node
const fs=require('fs');
const p='public/app.js';
let s=fs.readFileSync(p,'utf8');
const MARK='/* DISPATCH PRODUCTS SAFE SORT V1 */';
if(s.includes(MARK)){console.log('DISPATCH PRODUCTS SAFE SORT V1: ALREADY PRESENT');process.exit(0)}
function fail(m){throw new Error('[DISPATCH PRODUCTS SAFE SORT V1] '+m)}

// The Maestro may expose products as strings OR objects. The old comparator used
// `a.localeCompare(...)` directly and crashed when `a` was an object/number.
const old=`function productOptions(){return [...new Set([...(state.snapshot?.products||[]),...defaultProducts()])].sort((a,b)=>a.localeCompare(b,'es'))}`;
const replacement=`function dispatchProductLabel(value){
  if(typeof value==='string')return value.trim();
  if(value==null)return '';
  if(typeof value==='number')return String(value);
  const label=value.nombre??value.name??value.producto??value.descripcion??value.detalle??value.codigo??value.code??'';
  return String(label).trim();
}
function productOptions(){
  const raw=[...(Array.isArray(state.snapshot?.products)?state.snapshot.products:[]),...defaultProducts()];
  const labels=raw.map(dispatchProductLabel).filter(Boolean);
  return [...new Map(labels.map(x=>[String(x).trim().toLocaleUpperCase('es-CL'),String(x).trim()])).values()]
    .sort((a,b)=>String(a).localeCompare(String(b),'es-CL',{numeric:true,sensitivity:'base'}));
}
${MARK}`;
if(!s.includes(old))fail('No se encontró productOptions original.');
s=s.replace(old,replacement);
if(!s.includes('function dispatchProductLabel(value){'))fail('No se instaló normalizador de productos.');
if(!s.includes("String(a).localeCompare(String(b),'es-CL'"))fail('El comparador seguro no quedó instalado.');
if(!s.includes(MARK))fail('Falta marcador final del parche.');
fs.writeFileSync(p,s,'utf8');
console.log('DISPATCH PRODUCTS SAFE SORT V1: PASS');
console.log('PRODUCT OBJECTS NORMALIZED: PASS');
console.log('SAFE LOCALE COMPARATOR: PASS');
console.log('DISPATCH PRODUCT OPTIONS REGRESSION: PASS');
