#!/bin/sh
set -eu
# Stable build: reviewed Guides + fast document navigation + audited Sacos/Granel counter + existence reports + automatic INE/Sacos/Granel registry.
node scripts/patch-guides-professional-v1.js
node scripts/patch-fast-docs-v1.js
node scripts/patch-counter-sacogranel-v2.js
node scripts/patch-counter-snapshot-compat-v1.js
node scripts/patch-existence-sacogranel-reports-v1.js
node --check app.js
node --check scripts/patch-guides-professional-v1.js
node --check scripts/patch-fast-docs-v1.js
node --check scripts/patch-counter-sacogranel-v2.js
node --check scripts/patch-counter-snapshot-compat-v1.js
node --check scripts/patch-existence-sacogranel-reports-v1.js
node --check < scripts/existence-sacogranel-reports-v1.jsfrag
node --check scripts/counter-worker-frag.js
node --check excel-worker.js
node --check ine-engine-maestro.js
node --check ine-sacos-granel-automatico-v4.js
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
if(!app.includes('function renderExistenceReports(){'))throw new Error('Falta el módulo de informes Sacos/Granel desde Registro.');
if(!app.includes("['counterExistence','📊 Informes Sacos / Granel']"))throw new Error('Falta navegación a informes Sacos/Granel.');
if(!app.includes('counterExistence:renderExistenceReports'))throw new Error('Falta renderizador de informes Sacos/Granel.');
if(!app.includes('COUNTER_SNAPSHOT_COMPAT_V1'))throw new Error('Falta compatibilidad con snapshots anteriores del Maestro.');
if(!worker.includes('COUNTER SACOS GRANEL V1'))throw new Error('Falta el motor del contador en excel-worker.js.');
if(!worker.includes('counter, iva: iv'))throw new Error('El snapshot no publica metrics.counter.');
console.log('CORE MODULES STATIC CHECK: PASS');
NODE
rm -rf public
mkdir -p public
find . -maxdepth 1 -type f ! -name 'vercel.json' -exec cp -p {} public/ \;
if [ -d docs ]; then cp -R docs public/; fi
node - <<'NODE'
const fs=require('fs');
const p='public/index.html';
let s=fs.readFileSync(p,'utf8');
const marker='<script src="/ine-sacos-granel-automatico-v4.js"></script>';
if(!s.includes(marker)){
  if(s.includes('</body></html>')) s=s.replace('</body></html>', marker+'\n</body></html>');
  else throw new Error('No se encontró cierre de index.html para integrar el módulo automático.');
  fs.writeFileSync(p,s);
}
if(!fs.readFileSync(p,'utf8').includes('ine-sacos-granel-automatico-v4.js'))throw new Error('No se integró el módulo automático al index publicado.');
console.log('AUTO INE/SACOS/GRANEL INDEX INTEGRATION: PASS');
NODE
