#!/bin/sh
set -eu

echo '=== MOLINO CONTROL · PRODUCTION PREFLIGHT ==='

check_core(){
  node --check app.js
  node --check excel-worker.js
  node --check ine-engine-maestro.js
  node --check reports-maestro-v11.js
  node --check dispatch-controls-v12.js
}

run_patch(){
  script="$1"
  echo "--- PATCH: $script"
  node "$script"
  check_core
}

# Cada patch se aplica y se valida inmediatamente. Si un patch genera un JavaScript inválido,
# el build se detiene en ese punto y Vercel no recibe una versión rota.
run_patch scripts/patch-cloud-persistence-v1.js
run_patch scripts/patch-guides-professional-v1.js
run_patch scripts/patch-fast-docs-v1.js
run_patch scripts/patch-counter-sacogranel-v2.js
run_patch scripts/patch-counter-snapshot-compat-v1.js
run_patch scripts/patch-existence-sacogranel-reports-v1.js
run_patch scripts/patch-reports-sacos-undefined-v1.js
run_patch scripts/patch-formula-zero-rows-v1.js
run_patch scripts/patch-reports-cloud-v7.js
run_patch scripts/patch-dispatch-bridge-v1.js
run_patch scripts/patch-reports-v11-safe-v1.js

# Validación final de archivos auxiliares y fragmentos.
node --check scripts/counter-worker-frag.js
node --check scripts/existence-sacogranel-reports-v1.jsfrag
node --check scripts/guides-renderer.jsfrag
node --check scripts/fast-docs-injection.jsfrag
node --check scripts/dispatch-bridge-v1.jsfrag
node --check scripts/reports-sacos-undefined-v1.jsfrag
node --check scripts/formula-zero-rows-v1.jsfrag

node - <<'NODE'
const fs=require('fs');
const app=fs.readFileSync('app.js','utf8');
const worker=fs.readFileSync('excel-worker.js','utf8');
const report=fs.readFileSync('reports-maestro-v11.js','utf8');
const dispatch=fs.readFileSync('dispatch-controls-v12.js','utf8');
const guides=fs.readFileSync('scripts/guides-renderer.jsfrag','utf8');
if(!app.includes('function renderGuides(){'))throw new Error('Falta Guías profesional.');
if(!app.includes('FAST DOCUMENT MODULES V1'))throw new Error('Falta optimización documental.');
if(!app.includes('function renderInvoices(){')||!app.includes('function renderBoletas(){'))throw new Error('Facturas/Boletas fuera de servicio.');
if(!app.includes('function renderSacosGranel(){'))throw new Error('Falta contador Sacos/Granel.');
if(!app.includes("['counterExistence','📊 Informes Sacos / Granel']"))throw new Error('Falta navegación de informes Sacos/Granel.');
if(!app.includes('MolinoDispatchBridge'))throw new Error('Falta bridge seguro de Despachos.');
if(!dispatch.includes('data-dv12-edit')||!dispatch.includes('data-dv12-delete'))throw new Error('Faltan acciones de modificar/eliminar despacho.');
if(!dispatch.includes('dispatchEnhancedV12'))throw new Error('Falta corrección de scroll de despachos.');
if(!worker.includes('COUNTER SACOS GRANEL V1'))throw new Error('Falta motor del contador en worker.');
if(!report.includes('molino_sacos_granel_report_v3'))throw new Error('Falta RPC V11 de informes.');
if(!report.includes('GRANEL AF = KG'))throw new Error('Falta auditoría específica de granel.');
if(report.includes('JULY_SNAPSHOT'))throw new Error('El informe V11 no puede contener snapshots hardcodeados.');
if(report.includes("toast?.('No hay filas para exportar.','warn')"))throw new Error('Quedó una referencia toast no segura en Reportes V11.');
if(!guides.includes('const csvCell='))throw new Error('Guías no usa el helper CSV seguro.');
console.log('CORE MODULES STATIC CHECK: PASS');
console.log('GUIDES RENDERER STATIC CHECK: PASS');
console.log('DISPATCH CONTROLS V12 CHECK: PASS');
console.log('REPORTS SACOS/GRANEL V11 CHECK: PASS');
console.log('REPORTS V11 SAFE GUARD CHECK: PASS');
console.log('NO HARDCODED REPORT SNAPSHOT CHECK: PASS');
NODE

rm -rf public
mkdir -p public
find . -maxdepth 1 -type f ! -name 'vercel.json' -exec cp -p {} public/ \;
if [ -d docs ]; then cp -R docs public/; fi

node - <<'NODE'
const fs=require('fs');
const p='public/index.html';
let s=fs.readFileSync(p,'utf8');
s=s.replace(/<script src="\/ine-sacos-granel-automatico-v4\.js"><\/script>\s*/g,'');
s=s.replace(/<script src="\/dispatch-controls-v12\.js"><\/script>\s*/g,'');
s=s.replace(/<script src="\/reports-maestro-v11\.js"><\/script>\s*/g,'');
const marker1='<script src="/dispatch-controls-v12.js"></script>';
const marker2='<script src="/reports-maestro-v11.js"></script>';
if(!s.includes('</body></html>'))throw new Error('No se encontró cierre de index.html.');
s=s.replace('</body></html>',marker1+'\n'+marker2+'\n</body></html>');
fs.writeFileSync(p,s);
const pub=fs.readFileSync(p,'utf8');
if(!pub.includes(marker1)||!pub.includes(marker2))throw new Error('No se integraron los módulos finales.');
if(pub.includes('ine-sacos-granel-automatico-v4.js'))throw new Error('No se debe publicar el renderer V4 legacy.');
console.log('FINAL MODULE INDEX INTEGRATION: PASS');
NODE

echo '=== MOLINO CONTROL · BUILD READY ==='