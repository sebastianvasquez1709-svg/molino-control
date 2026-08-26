#!/bin/sh
set -eu

echo '=== MOLINO CONTROL · TRANSACTIONAL PREFLIGHT ==='
ROOT="$PWD"
ORIG_APP_SHA="$(sha256sum app.js | awk '{print $1}')"
BUILD_DIR="$(mktemp -d /tmp/molino-control-build.XXXXXX)"
cleanup(){ rm -rf "$BUILD_DIR"; }
trap cleanup EXIT INT TERM

tar --exclude='./.git' --exclude='./.vercel' --exclude='./node_modules' --exclude='./public' -cf - . | tar -xf - -C "$BUILD_DIR"
cd "$BUILD_DIR"

check_core(){
  node --check app.js
  node --check excel-worker.js
  node --check ine-engine-maestro.js
  node --check reports-maestro-v11.js
  node --check dispatch-controls-v12.js
  node --check reports-sacos-granel-professional-v1.js
  node --check clients-enhanced-v1.js
  node --check dashboard-macro-enhanced-v1.js
  node --check panel-macro-pro-v3.js
  node --check panel-macro-pro-v4.js
  node --check panel-macro-pro-v5.js
}

check_fragment(){
  label="$1"
  file="$2"
  [ -f "$file" ] || { echo "MISSING FRAGMENT: $file" >&2; exit 1; }
  echo "--- FRAGMENT CHECK: $label"
  node --check < "$file"
}

run_patch(){
  script="$1"
  [ -f "$script" ] || { echo "MISSING PATCH: $script" >&2; exit 1; }
  echo "--- PATCH: $script"
  node "$script"
  check_core
}

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
run_patch scripts/patch-reports-professional-v1.js
run_patch scripts/patch-macro-state-bridge-v1.js

check_fragment 'counter worker' scripts/counter-worker-frag.js
check_fragment 'existence reports' scripts/existence-sacogranel-reports-v1.jsfrag
check_fragment 'guides renderer' scripts/guides-renderer.jsfrag
check_fragment 'fast documents' scripts/fast-docs-injection.jsfrag

node - <<'NODE'
const fs=require('fs');
const app=fs.readFileSync('app.js','utf8');
const worker=fs.readFileSync('excel-worker.js','utf8');
const report=fs.readFileSync('reports-maestro-v11.js','utf8');
const dispatch=fs.readFileSync('dispatch-controls-v12.js','utf8');
const pro=fs.readFileSync('reports-sacos-granel-professional-v1.js','utf8');
const clients=fs.readFileSync('clients-enhanced-v1.js','utf8');
const macro=fs.readFileSync('dashboard-macro-enhanced-v1.js','utf8');
const macroV4=fs.readFileSync('panel-macro-pro-v4.js','utf8');
const macroV5=fs.readFileSync('panel-macro-pro-v5.js','utf8');
const guides=fs.readFileSync('scripts/guides-renderer.jsfrag','utf8');
const fast=fs.readFileSync('scripts/fast-docs-injection.jsfrag','utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
assert(app.includes('function renderGuides(){'),'Falta Guías profesional.');
assert(app.includes('FAST DOCUMENT MODULES V1'),'Falta optimización documental.');
assert(app.includes('function renderInvoices(){')&&app.includes('function renderBoletas(){'),'Facturas/Boletas fuera de servicio.');
assert(app.includes('function renderSacosGranel(){'),'Falta contador Sacos/Granel.');
assert(app.includes("['counterExistence','📊 Informes Sacos / Granel']"),'Falta navegación de informes Sacos/Granel.');
assert(app.includes('MolinoDispatchBridge'),'Falta bridge seguro de Despachos.');
assert(dispatch.includes('data-dv12-edit')&&dispatch.includes('data-dv12-delete'),'Faltan acciones de modificar/eliminar despacho.');
assert(dispatch.includes('dispatchEnhancedV12'),'Falta corrección de scroll de despachos.');
assert(worker.includes('COUNTER SACOS GRANEL V1'),'Falta motor del contador en worker.');
assert(report.includes('molino_sacos_granel_report_v3'),'Falta RPC V11 de informes.');
assert(report.includes('GRANEL AF = KG'),'Falta auditoría específica de granel.');
assert(!report.includes('JULY_SNAPSHOT'),'El informe V11 no puede contener snapshots hardcodeados.');
assert(!report.includes("toast?.('No hay filas para exportar.','warn')"),'Quedó una referencia toast no segura en Reportes V11.');
assert(pro.includes('mcReportRoot')&&pro.includes('molino_sacos_granel_report_v3'),'Módulo profesional Sacos/Granel incompleto.');
assert(clients.includes('window.renderClients=render'),'Módulo Clientes mejorado no expone render seguro.');
assert(clients.includes('__LYRA_CLIENTS_V1__'),'Falta marcador de versión de Clientes.');
assert(macro.includes('__LYRA_MACRO_V1__')&&macro.includes("page==='macro'"),'Módulo Panel Macro V1 incompleto.');
assert(macroV4.includes('__MC_MACRO_PRO_V4__'),'Renderer Macro V4 incompleto.');
assert(macroV5.includes('__MC_MACRO_PRO_V5__'),'Renderer Macro V5 incompleto.');
assert(app.includes('MC_APP_STATE_BRIDGE_V1'),'Falta puente de estado de la app.');
assert(guides.includes('const csvCell=')&&guides.includes('const csvLine='),'Guías no usa helpers CSV seguros.');
assert((app.match(/FAST DOCUMENT MODULES V1/g)||[]).length===1,'La inyección FAST DOCUMENTS quedó duplicada.');
assert((app.match(/MolinoDispatchBridge/g)||[]).length===1,'El bridge de Despachos quedó duplicado.');
assert((app.match(/REPORTS SACOS\/GRANEL UNDEFINED-REFERENCE GUARD V1/g)||[]).length===1,'El guard de informes quedó duplicado.');
assert((app.match(/FORMULA_ZERO_ROWS_GUARD_V1/g)||[]).length===1,'El guard formulaZeroRows quedó duplicado.');
assert((fast.match(/FAST DOCUMENT MODULES V1/g)||[]).length===1,'Fragmento FAST DOCUMENTS inválido.');
console.log('CORE MODULES STATIC CHECK: PASS');
console.log('GUIDES RENDERER STATIC CHECK: PASS');
console.log('DISPATCH CONTROLS V12 CHECK: PASS');
console.log('REPORTS SACOS/GRANEL V11 CHECK: PASS');
console.log('REPORTS V11 SAFE GUARD CHECK: PASS');
console.log('REPORTS PROFESSIONAL UI CHECK: PASS');
console.log('CLIENTS ENHANCED V1 CHECK: PASS');
console.log('MACRO ENHANCED V1 CHECK: PASS');
console.log('MACRO V4 CHECK: PASS');
console.log('MACRO V5 CHECK: PASS');
console.log('APP STATE BRIDGE CHECK: PASS');
console.log('INJECTION DUPLICATION CHECK: PASS');
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
s=s.replace(/<script src="\/reports-sacos-granel-professional-v1\.js"><\/script>\s*/g,'');
if(!s.includes('</body></html>'))throw new Error('No se encontró cierre de index.html.');
const markers=['<script src="app.js"></script>','<script src="clients-enhanced-v1.js"></script>','<script src="dashboard-macro-enhanced-v1.js"></script>','<script src="/dispatch-controls-v12.js"></script>','<script src="/reports-maestro-v11.js"></script>','<script src="/reports-sacos-granel-professional-v1.js"></script>'];
if(!s.includes(markers[0]))throw new Error('No se encontró app.js en index.html.');
s=s.replace('</body></html>',markers.slice(1).join('\n')+'\n</body></html>');
fs.writeFileSync(p,s);
const pub=fs.readFileSync(p,'utf8');
for(const m of markers.slice(1)) if(!pub.includes(m))throw new Error('No se integró '+m);
if((pub.match(/clients-enhanced-v1\.js/g)||[]).length!==1)throw new Error('El módulo Clientes quedó duplicado.');
if((pub.match(/dashboard-macro-enhanced-v1\.js/g)||[]).length!==1)throw new Error('El módulo Macro quedó duplicado.');
if((pub.match(/reports-sacos-granel-professional-v1\.js/g)||[]).length!==1)throw new Error('El módulo profesional quedó duplicado.');
if(pub.includes('ine-sacos-granel-automatico-v4.js'))throw new Error('No se debe publicar el renderer V4 legacy.');
console.log('FINAL MODULE INDEX INTEGRATION: PASS');
console.log('MACRO SCRIPT UNIQUENESS: PASS');
console.log('PROFESSIONAL REPORT SCRIPT UNIQUENESS: PASS');
NODE

cd "$ROOT"
AFTER_APP_SHA="$(sha256sum app.js | awk '{print $1}')"
[ "$ORIG_APP_SHA" = "$AFTER_APP_SHA" ] || { echo 'SOURCE MUTATION DETECTED: app.js changed outside build workspace' >&2; exit 1; }
rm -rf public
cp -a "$BUILD_DIR/public" "$ROOT/public"

echo '=== MOLINO CONTROL · BUILD READY · SOURCE UNCHANGED ==='
