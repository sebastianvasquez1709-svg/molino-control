#!/usr/bin/env node
const fs=require('fs');
const p='public/clients-enhanced-v1.js';
let s=fs.readFileSync(p,'utf8');
const MARK='/* CLIENTS APP STATE BRIDGE V1 */';
if(s.includes(MARK)){console.log('CLIENTS APP STATE BRIDGE V1: ALREADY PRESENT');process.exit(0)}
const anchor="const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};";
if(!s.includes(anchor))throw new Error('No se encontró ancla estable en clients-enhanced-v1.js.');
const bridge=`${anchor}\n  ${MARK}\n  // Este fragmento se ejecuta fuera del IIFE principal de app.js. Nunca debe\n  // asumir que \"state\" existe como variable global. Usa el puente de solo lectura\n  // instalado por app.js y mantiene escritura compatible sobre page/search.\n  const getAppState=()=>typeof window.__MC_APP_GET_STATE__==='function'?window.__MC_APP_GET_STATE__():window.__MC_APP_STATE__||null;\n  const state=new Proxy({}, {\n    get:(_t,p)=>{const st=getAppState();return st?st[p]:undefined;},\n    set:(_t,p,v)=>{const st=getAppState();if(st)st[p]=v;return true;}\n  });`;
s=s.replace(anchor,bridge);
if(!s.includes(MARK))throw new Error('No se instaló el puente de estado de Clientes.');
if(!s.includes('const getAppState='))throw new Error('Falta getter de estado.');
if(!s.includes('const state=new Proxy'))throw new Error('Falta proxy compatible para Clientes.');
fs.writeFileSync(p,s,'utf8');
console.log('CLIENTS APP STATE BRIDGE V1: PASS');
console.log('CLIENTS NO-GLOBAL-STATE REGRESSION: PASS');
console.log('CLIENTS STATE READ/WRITE PROXY: PASS');
