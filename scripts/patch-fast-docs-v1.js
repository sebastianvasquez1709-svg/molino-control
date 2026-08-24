const fs=require('fs');
const cp=require('child_process');
const app='app.js';
const fragment='scripts/fast-docs-injection.jsfrag';
const original=fs.readFileSync(app,'utf8');
try{
  let src=original;
  const injection=fs.readFileSync(fragment,'utf8').trimEnd();
  if(!injection.includes('FAST DOCUMENT MODULES V1'))throw new Error('Fragmento de navegación rápida inválido.');
  cp.execFileSync(process.execPath,['--check'],{input:injection,stdio:['pipe','inherit','inherit']});
  if(!src.includes('FAST DOCUMENT MODULES V1')){
    const close=src.lastIndexOf('\n})();');
    if(close<0)throw new Error('No se encontró el cierre principal de app.js.');
    src=src.slice(0,close)+'\n'+injection+'\n'+src.slice(close);
  }
  fs.writeFileSync(app,src);
  cp.execFileSync(process.execPath,['--check',app],{stdio:'inherit'});
  console.log('FAST DOCUMENT MODULES + CLIENT DOCUMENT SEARCH V1: PASS');
}catch(err){
  fs.writeFileSync(app,original);
  console.error('[FAST DOCUMENT MODULES V1] Rollback por error de sintaxis: '+(err?.message||String(err)));
  process.exit(1);
}