const fs=require('fs');

const file='app.js';
let src=fs.readFileSync(file,'utf8');

// El módulo Documentos deja de estar expuesto en la navegación.
src=src.replace("['documents','🧾 Documentos'],",'');

// Sustituir la vista antigua de Guías por el renderer profesional revisado.
const start=src.indexOf('function renderGuides(){');
const end=src.indexOf('\nfunction renderNC(){',start);
if(start<0||end<0) throw new Error('No se encontró el bloque renderGuides/renderNC.');
const renderer=fs.readFileSync('scripts/guides-renderer.jsfrag','utf8').trimEnd();
src=src.slice(0,start)+renderer+'\n'+src.slice(end);

fs.writeFileSync(file,src);
console.log('GUIDES PROFESSIONAL V1: PASS');
