#!/usr/bin/env node
const fs=require('fs');
const p='index.html';
let s=fs.readFileSync(p,'utf8');
const tag='<script src="/reports-sacos-granel-professional-v1.js"></script>';
if(!s.includes(tag)){
  if(!s.includes('</body>')) throw new Error('No se encontró </body> en index.html');
  s=s.replace('</body>',tag+'\n</body>');
  fs.writeFileSync(p,s,'utf8');
}
console.log('REPORTS PROFESSIONAL V1: INDEX INTEGRATION PASS');
