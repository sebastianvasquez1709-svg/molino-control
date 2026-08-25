#!/usr/bin/env node
const fs=require('fs');
const p='index.html';
let s=fs.readFileSync(p,'utf8');
const tag='<script src="/lyra-experience-v1.js"></script>';
s=s.replace(/<script src="\/lyra-experience-v1\.js"><\/script>\s*/g,'');
if(!s.includes('</body></html>') && !s.includes('</body>')) throw new Error('No se encontró cierre del documento.');
s=s.replace('</body></html>',tag+'\n</body></html>');
if(!s.includes(tag)) s=s.replace('</body>',tag+'\n</body>');
fs.writeFileSync(p,s,'utf8');
const count=(s.match(/lyra-experience-v1\.js/g)||[]).length;
if(count!==1) throw new Error(`LYRA experience script duplicado: ${count}`);
console.log('LYRA EXPERIENCE V1: IDEMPOTENT INTEGRATION PASS');
