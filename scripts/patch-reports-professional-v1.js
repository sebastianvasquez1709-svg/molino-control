#!/usr/bin/env node
const fs=require('fs');
const p='index.html';
let s=fs.readFileSync(p,'utf8');
const tag='<script src="/reports-sacos-granel-professional-v1.js"></script>';
if(!s.includes('</body>')) throw new Error('No se encontró </body> en index.html');
s=s.replace(/<script src="\/reports-sacos-granel-professional-v1\.js"><\/script>\s*/g,'');
s=s.replace('</body>',tag+'\n</body>');
fs.writeFileSync(p,s,'utf8');
const count=(s.match(/reports-sacos-granel-professional-v1\.js/g)||[]).length;
if(count!==1) throw new Error(`Integración profesional duplicada: ${count}`);
console.log('REPORTS PROFESSIONAL V1: IDEMPOTENT INTEGRATION PASS');
