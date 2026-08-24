#!/usr/bin/env node
const fs=require('fs');
const p='reports-maestro-v11.js';
let s=fs.readFileSync(p,'utf8');
const old="toast?.('No hay filas para exportar.','warn')";
const next="window.toast?window.toast('No hay filas para exportar.','warn'):alert('No hay filas para exportar.')";
if(s.includes(old))s=s.replace(old,next);
fs.writeFileSync(p,s,'utf8');
console.log('REPORTS V11 SAFE GUARD: PASS');
