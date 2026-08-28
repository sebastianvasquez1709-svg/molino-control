#!/usr/bin/env node
const fs=require('fs');
const app=fs.readFileSync('index-auto.html','utf8');
const compat=fs.readFileSync('report-rpc-compat-v1.js','utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
assert(app.includes('/report-rpc-compat-v1.js?v=rpc-compat-v1'),'index-auto no inyecta el bridge RPC.');
assert(compat.includes("name!=='molino_sacos_granel_report_v3'"),'El bridge no intercepta v3.');
assert(compat.includes("molino_sacos_granel_report_local"),'El bridge no redirige al RPC local.');
assert(compat.includes('mc.getSession()'),'El bridge no reutiliza la sesión local.');
assert(compat.includes('mc.client=wrappedClient'),'El bridge no envuelve el cliente real.');
console.log('REPORT RPC COMPAT BRIDGE CHECK: PASS');
console.log('OLD V3 DIRECT CALL PROTECTED: PASS');
console.log('LOCAL SESSION FALLBACK: PASS');
