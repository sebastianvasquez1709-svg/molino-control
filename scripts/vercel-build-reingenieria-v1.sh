#!/bin/sh
set -eu

echo '=== MOLINO CONTROL · REINGENIERÍA V1 · PIPELINE CONSOLIDADO ==='

# 1) Núcleo heredado ya estabilizado. Se ejecuta una sola vez.
sh scripts/vercel-build-v3.sh

# 2) Correcciones posteriores que antes estaban encadenadas V4 → V5 → V9.
node scripts/patch-clients-state-bridge-v1.js
node --check public/clients-enhanced-v1.js

node scripts/patch-report-local-auth-v1.js
node --check public/reports-sacos-granel-professional-v1.js

node scripts/patch-report-maestro-rpc-local-v1.js
node scripts/patch-report-rpc-global-guard-v2.js
node scripts/patch-report-script-cachebust-v1.js

# 3) Módulos reingenierizados: historial durable + informes mensuales V2.
node --check public/molino-cloud-state-v2.js
node --check public/existencia-reportes-mensuales.js
node scripts/test-monthly-reports-v2.js public/existencia-reportes-mensuales.js

# 4) Contratos críticos de los módulos que el usuario ya usa.
node --check public/app.js
node --check public/excel-worker.js
node --check public/molino-cloud.js
node --check public/dispatch-controls-v12.js
node --check public/reports-maestro-v11.js
node --check public/reports-sacos-granel-professional-v1.js
node --check public/clients-enhanced-v1.js
node --check public/dashboard-macro-enhanced-v1.js
node --check public/report-rpc-boot-v2.js

node - <<'NODE'
const fs=require('fs');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const app=fs.readFileSync('public/app.js','utf8');
const index=fs.readFileSync('public/index.html','utf8');
const monthly=fs.readFileSync('public/existencia-reportes-mensuales.js','utf8');
const cloud=fs.readFileSync('public/molino-cloud-state-v2.js','utf8');

assert(app.includes('function renderInvoices(){'),'Facturas no está disponible.');
assert(app.includes('function renderBoletas(){'),'Boletas no está disponible.');
assert(app.includes('function renderGuides(){'),'Guías no está disponible.');
assert(app.includes('function renderDispatches(){'),'Despachos no está disponible.');
assert(app.includes('function renderExistencias(){'),'Registro de Existencia no está disponible.');
assert(index.includes('/existencia-reportes-mensuales.js'),'Falta cargar Informes mensuales.');
assert(monthly.includes('EXISTENCIA_REPORTES_MODELO_V2'),'No llegó Informes Mensuales V2 a producción.');
assert(monthly.includes('MolinoCloudStateV2'),'Informes mensuales no está conectado al historial durable.');
assert(cloud.includes("const RPC='molino_existence_state_local'"),'Falta RPC durable de Existencia.');
assert(!monthly.includes("window.open('','_blank'"),'Persistió impresión por popup.');
assert(monthly.includes("document.createElement('iframe')"),'Falta impresión aislada por iframe.');
assert(monthly.includes("BIG BAG 800 KG → SALIDA / 800"),'Falta regla Big Bag /800.');
assert(monthly.includes("GRANEL → SALIDA"),'Falta regla Granel = Salida del Maestro.');

const rpcBoot=fs.readFileSync('public/report-rpc-boot-v2.js','utf8');
const maestro=fs.readFileSync('public/reports-maestro-v11.js','utf8');
const pro=fs.readFileSync('public/reports-sacos-granel-professional-v1.js','utf8');
assert(rpcBoot.length>0&&maestro.length>0&&pro.length>0,'Módulos de reportes existentes incompletos.');

console.log('CORE ROUTES REGRESSION: PASS');
console.log('MONTHLY REPORTS V2 INTEGRATION: PASS');
console.log('DURABLE EXISTENCE BRIDGE ASSET: PASS');
console.log('NO POPUP PRINT REGRESSION: PASS');
console.log('SACOS/GRANEL MASTER RULES: PASS');
console.log('=== MOLINO CONTROL · REINGENIERÍA V1 · BUILD PASS ===');
NODE
