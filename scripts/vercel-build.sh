#!/bin/sh
set -eu
# Stable production build: preserve core module navigation and dispatch/INE fixes.
node scripts/patch-dispatch-print.js
node scripts/patch-dispatch-print-v3.js
node scripts/patch-dispatch-ux-v6.js
node scripts/fix-dispatch-generated-v7.js
node scripts/patch-dispatch-edit-v8.js
node scripts/patch-ine-engine-fallback.js
node scripts/patch-ine-engine-input.js
node --check scripts/fix-dispatch-generated-v7.js
node --check scripts/patch-dispatch-edit-v8.js
node --check scripts/patch-ine-engine-fallback.js
node --check scripts/patch-ine-engine-input.js
node --check app.js
node - <<'NODE'
const fs=require('fs');
const app=fs.readFileSync('app.js','utf8');
const required=['dispatchProHero','dispatchDeleteBtn','window.deleteDispatchById','window.editDispatchById'];
for(const marker of required){if(!app.includes(marker))throw new Error('Falta marcador requerido: '+marker)}
if(!/state\.dispatchPlan\.splice\(idx,1\)/.test(app))throw new Error('La eliminación no es individual.')
if(!/data-dispatch-delete/.test(app))throw new Error('Falta control de eliminación por fila.')
if(!/data-dispatch-edit/.test(app))throw new Error('Falta control de modificación por fila.')
if(!/Guardar cambios/.test(app))throw new Error('Falta modo de edición.')
if(app.includes('DOCUMENT_MODULES_V1')||app.includes('DOCUMENT_SEARCH_V2')||app.includes('DOCUMENT_SCROLL_V3'))throw new Error('No deben inyectarse parches experimentales de documentos.')
console.log('CORE NAVIGATION + DISPATCH + INE STABLE CHECK: PASS')
NODE
rm -rf public
mkdir -p public
find . -maxdepth 1 -type f ! -name 'vercel.json' -exec cp -p {} public/ \;
if [ -d docs ]; then cp -R docs public/; fi
