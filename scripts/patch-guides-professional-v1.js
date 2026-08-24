const fs=require('fs');
const cp=require('child_process');
const file='app.js';
const original=fs.readFileSync(file,'utf8');
let src=original;
try{
  src=src.replace("['documents','🧾 Documentos'],",'');
  const start=src.indexOf('function renderGuides(){');
  const end=src.indexOf('\nfunction renderNC(){',start);
  if(start<0||end<0)throw new Error('No se encontró el bloque renderGuides/renderNC.');
  const renderer=fs.readFileSync('scripts/guides-renderer.jsfrag','utf8').trimEnd();
  if(!renderer.includes('function renderGuides(){'))throw new Error('Renderer de Guías vacío o inválido.');
  cp.execFileSync(process.execPath,['--check'],{input:renderer,stdio:['pipe','inherit','inherit']});
  src=src.slice(0,start)+renderer+'\n'+src.slice(end);
  fs.writeFileSync(file,src);
  cp.execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
  console.log('GUIDES PROFESSIONAL V1: PASS');
}catch(err){
  fs.writeFileSync(file,original);
  console.error('[GUIDES PROFESSIONAL V1] Rollback por error de sintaxis: '+(err?.message||String(err)));
  process.exit(1);
}