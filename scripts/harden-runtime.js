const fs = require('fs');
const path = require('path');

const root = process.cwd();

function patchFile(rel, transformations) {
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, 'utf8');
  const original = src;
  for (const [label, transform] of transformations) {
    src = transform(src);
    if (src !== original) console.log(`${rel}: ${label}`);
  }
  if (src !== original) fs.writeFileSync(file, src, 'utf8');
  return src !== original;
}

patchFile('index.html', [
  ['remove production-prefilled RUT', src => src.replace('value="184467267" ', '')],
  ['hide prototype password hint', src => src.replace(/<div class="hint">Clave de prototipo actual:[\s\S]*?<\/div>/, '<div class="hint">Ingrese sus credenciales de acceso para continuar.</div>')]
]);

patchFile('ine-engine-maestro.js', [
  ['deduplicate INE output host', src => src.replace(
    /function injectCardHost\(input\) \{\n    const host = document\.createElement\('div'\);/,
    `function injectCardHost(input) {\n    input.parentElement?.parentElement?.querySelectorAll('[data-molino-ine-host]')?.forEach(node => node.remove());\n    const host = document.createElement('div');`
  )],
  ['validate uploaded existence file', src => src.replace(
    /const file = input\.files\?\.\[0\];\n    if \(!file\) return;/,
    `const file = input.files?.[0];\n    if (!file) return;\n    const ext = String(file.name || '').toLowerCase().split('.').pop();\n    if (!['xlsx','xls'].includes(ext)) {\n      const status = statusHost(input);\n      status.textContent = 'INE Maestro: el archivo debe ser XLSX o XLS.';\n      status.style.color = '#b42318';\n      input.value = '';\n      return;\n    }\n    const MAX_FILE_BYTES = 60 * 1024 * 1024;\n    if (file.size > MAX_FILE_BYTES) {\n      const status = statusHost(input);\n      status.textContent = 'INE Maestro: el archivo supera el límite seguro de 60 MB.';\n      status.style.color = '#b42318';\n      input.value = '';\n      return;\n    }`
  )]
]);

console.log('Runtime hardening complete.');
