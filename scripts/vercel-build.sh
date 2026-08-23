#!/bin/sh
set -eu
node scripts/patch-dispatch-print.js
node scripts/patch-dispatch-print-v3.js
node scripts/patch-dispatch-ux-v6.js
node scripts/fix-dispatch-generated-v7.js
node scripts/patch-dispatch-edit-v8.js
node --check scripts/fix-dispatch-generated-v7.js
node --check scripts/patch-dispatch-edit-v8.js
node --check app.js
node - <<'NODE'
const fs=require('fs');
const app=fs.readFileSync('app.js','utf8');
const required=['dispatchProHero','dispatchDeleteBtn','window.deleteDispatchById','window.editDispatchById','DISPATCH_UX_V6_PRO','DISPATCH_EDIT_V8_PRO'];
for(const marker of required){if(!app.includes(marker))throw new Error('Falta marcador requerido: '+marker)}
if(!/state\.dispatchPlan\.splice\(idx,1\)/.test(app))throw new Error('La eliminación no es individual.')
if(!/data-dispatch-delete/.test(app))throw new Error('Falta control de eliminación por fila.')
if(!/data-dispatch-edit/.test(app))throw new Error('Falta control de modificación por fila.')
if(!/Guardar cambios/.test(app))throw new Error('Falta modo de edición.')
console.log('DISPATCH UX STATIC CHECK: PASS')
NODE
rm -rf public
mkdir -p public
find . -maxdepth 1 -type f ! -name 'vercel.json' -exec cp -p {} public/ \;
if [ -d docs ]; then cp -R docs public/; fi
