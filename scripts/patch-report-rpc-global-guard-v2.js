#!/usr/bin/env node
const fs=require('fs');
const targets=['public/index.html','public/index-auto.html'];
const tag='<script src="/report-rpc-boot-v2.js?v=report-rpc-boot-v2"></script>';
for(const p of targets){
  if(!fs.existsSync(p)) continue;
  let s=fs.readFileSync(p,'utf8');
  if(s.includes('report-rpc-boot-v2.js')) continue;
  const needle='</head>';
  if(!s.includes(needle)) throw new Error(`[REPORT RPC BOOT V2] Missing </head> in ${p}`);
  s=s.replace(needle,`${tag}\n${needle}`);
  fs.writeFileSync(p,s,'utf8');
}
console.log('REPORT RPC BOOT V2 HTML INJECTION: PASS');
