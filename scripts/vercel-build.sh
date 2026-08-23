#!/bin/sh
set -eu
# Stable build: apply only the reviewed professional Guides integration, then validate.
# This version intentionally runs the small renderer fragment patch, avoiding the
# previous inline-template generator that caused the Vercel SyntaxError.
node scripts/patch-guides-professional-v1.js
node --check app.js
node --check scripts/patch-guides-professional-v1.js
node --check excel-worker.js
node --check ine-engine-maestro.js
# Guardrails: Documents must not be exposed in navigation; Guides must exist.
node - <<'NODE'
const fs=require('fs');
const app=fs.readFileSync('app.js','utf8');
if(app.includes("['documents','🧾 Documentos'],"))throw new Error('El módulo Documentos sigue expuesto en navegación.');
if(!app.includes('function renderGuides(){'))throw new Error('Falta el módulo profesional de Guías.');
if(!app.includes('guideQ')||!app.includes('guideCsv')||!app.includes('guidePrint'))throw new Error('Faltan controles profesionales de Guías.');
if(!app.includes('function renderInvoices(){')||!app.includes('function renderBoletas(){'))throw new Error('No se deben romper Facturas/Boletas.');
console.log('GUIDES PROFESSIONAL + DOCUMENTS REMOVED FROM NAV: PASS');
NODE
rm -rf public
mkdir -p public
find . -maxdepth 1 -type f ! -name 'vercel.json' -exec cp -p {} public/ \;
if [ -d docs ]; then cp -R docs public/; fi
