#!/bin/sh
set -eu
# Stable build: reviewed Guides integration + fast document navigation/client lookup.
node scripts/patch-guides-professional-v1.js
node scripts/patch-fast-docs-v1.js
node --check app.js
node --check scripts/patch-guides-professional-v1.js
node --check scripts/patch-fast-docs-v1.js
node --check excel-worker.js
node --check ine-engine-maestro.js
# Guardrails: Documents must not be exposed in navigation; Guides and client lookup must exist.
node - <<'NODE'
const fs=require('fs');
const app=fs.readFileSync('app.js','utf8');
if(app.includes("['documents','🧾 Documentos'],"))throw new Error('El módulo Documentos sigue expuesto en navegación.');
if(!app.includes('function renderGuides(){'))throw new Error('Falta el módulo profesional de Guías.');
if(!app.includes('guideQ')||!app.includes('guideCsv')||!app.includes('guidePrint'))throw new Error('Faltan controles profesionales de Guías.');
if(!app.includes('function renderInvoices(){')||!app.includes('function renderBoletas(){'))throw new Error('No se deben romper Facturas/Boletas.');
if(!app.includes('FAST DOCUMENT MODULES V1'))throw new Error('Falta la optimización de carga documental.');
if(!app.includes('openClientDocuments'))throw new Error('Falta búsqueda de documentos por cliente.');
if(!app.includes('Ver facturas y guías'))throw new Error('Falta acceso directo a facturas y guías por cliente.');
console.log('GUIDES + FAST DOCUMENT NAV + CLIENT DOCUMENT SEARCH: PASS');
NODE
rm -rf public
mkdir -p public
find . -maxdepth 1 -type f ! -name 'vercel.json' -exec cp -p {} public/ \;
if [ -d docs ]; then cp -R docs public/; fi
