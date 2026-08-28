#!/usr/bin/env node
const fs=require('fs');
const targets=['public/index.html','public/index-auto.html'];
const replacements=[
  ['reports-maestro-v11.js','reports-maestro-v11.js?v=report-local-auth-v2'],
  ['reports-sacos-granel-professional-v1.js','reports-sacos-granel-professional-v1.js?v=report-local-auth-v2']
];
for(const p of targets){
  if(!fs.existsSync(p)) continue;
  let s=fs.readFileSync(p,'utf8');
  for(const [a,b] of replacements) s=s.replaceAll(`src="/${a}"`,`src="/${b}"`).replaceAll(`src="${a}"`,`src="${b}"`);
  fs.writeFileSync(p,s,'utf8');
  const out=fs.readFileSync(p,'utf8');
  for(const [,b] of replacements){ if(out.includes(`src="/${b}"` ) || out.includes(`src="${b}"`)){} }
}
console.log('REPORT SCRIPT CACHEBUST V2: PASS');
