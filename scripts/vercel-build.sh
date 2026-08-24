#!/bin/sh
set -eu
# Stable build: reviewed Guides + fast document navigation + audited Sacos/Granel counter.
node scripts/patch-guides-professional-v1.js
node scripts/patch-fast-docs-v1.js
node scripts/patch-counter-sacogranel-v2.js
node --check app.js
node --check scripts/patch-guides-professional-v1.js
node --check scripts/patch-fast-docs-v1.js
node --check scripts/patch-counter-sacogranel-v2.js
node --check scripts/counter-worker-frag.js
node --check excel-worker.js
node --check ine-engine-maestro.js
node - <<'NODE'
const fs=require('fs');
const app=fs.readFileSync('app.js','utf8');
const worker=fs.readFileSync('excel-worker.js','utf8');
if(app.includes("['documents','🧾 Documentos'],"))throw new Error('El módulo Documentos sigue expuesto en navegación.');
if(!app.includes('function renderGuides(){'))throw new Error('Falta el módulo profesional de Guías.');
if(!app.includes('guideQ')||!app.includes('guideCsv')||!app.includes('guidePrint'))throw new Error('Faltan controles profesionales de Guías.');
if(!app.includes('function renderInvoices(){')||!app.includes('function renderBoletas(){'))throw new Error('No se deben romper Facturas/Boletas.');
if(!app.includes('FAST DOCUMENT MODULES V1'))throw new Error('Falta la optimización de carga documental.');
if(!app.includes('openClientDocuments'))throw new Error('Falta búsqueda de documentos por cliente.');
if(!app.includes('function renderSacosGranel(){'))throw new Error('Falta el módulo Contador Sacos/Granel.');
if(!app.includes("['counter','📦 Sacos / Granel']"))throw new Error('Falta navegación al contador.');
if(!worker.includes('COUNTER SACOS GRANEL V1'))throw new Error('Falta el motor del contador en excel-worker.js.');
if(!worker.includes('counter, iva: iv'))throw new Error('El snapshot no publica metrics.counter.');
console.log('GUIDES + FAST DOCUMENT NAV + CLIENT DOCUMENT SEARCH + COUNTER SACOS/GRANEL: PASS');
NODE
rm -rf public
mkdir -p public
find . -maxdepth 1 -type f ! -name 'vercel.json' -exec cp -p {} public/ \;
if [ -d docs ]; then cp -R docs public/; fi
