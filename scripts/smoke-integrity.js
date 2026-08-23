const fs = require('fs');
const path = require('path');

const root = process.cwd();
const required = [
  'index.html',
  'app.js',
  'molino-cloud.js',
  'ine-engine-maestro.js',
  'ine-maestro-static.json',
  'maestro-health.js'
];

for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`Falta archivo crítico: ${rel}`);
}

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const ine = fs.readFileSync(path.join(root, 'ine-engine-maestro.js'), 'utf8');
const cloud = fs.readFileSync(path.join(root, 'molino-cloud.js'), 'utf8');
const maestro = JSON.parse(fs.readFileSync(path.join(root, 'ine-maestro-static.json'), 'utf8'));

const failures = [];
const warnings = [];

if (!index.includes('/ine-engine-maestro.js')) failures.push('index.html no carga ine-engine-maestro.js');
if (!ine.includes('MAESTRO_2025_2026')) failures.push('INE engine no declara versión Maestro');
if (!ine.includes('P.FCV') || !ine.includes('P.BOLETA') || !ine.includes('VALOR PROMEDIO')) failures.push('INE engine perdió marcadores de fórmula');
if (!maestro.code_map || !maestro.controls) failures.push('ine-maestro-static.json está incompleto');
if (!cloud.includes('snapshot') || !cloud.includes('health')) failures.push('Cloud layer perdió funciones críticas');

// Auditoría deliberadamente no bloqueante: la autenticación heredada sigue usando
// constantes de prototipo mientras se migra a Auth/RBAC de Supabase.
if (/ADMIN_RUT\s*=/.test(app) || /ACCESS_KEY\s*=/.test(app)) {
  warnings.push('Autenticación heredada con credenciales embebidas sigue presente en app.js; requiere migración a Auth/RBAC real.');
}
if (/Clave de prototipo actual/i.test(index) || /value="184467267"/.test(index)) {
  failures.push('index.html aún expone credenciales/prototipo en la pantalla de acceso');
}

if (failures.length) {
  console.error('SMOKE INTEGRITY: FAIL');
  failures.forEach(x => console.error(`- ${x}`));
  process.exit(1);
}

console.log('SMOKE INTEGRITY: PASS');
warnings.forEach(x => console.warn(`WARN: ${x}`));
