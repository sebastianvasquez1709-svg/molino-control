const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'ine-engine-maestro.js');
let src = fs.readFileSync(file, 'utf8');

const exact = `  function isExistenceInput(input) {\n    const txt = norm((input.closest('section,article,.card,.content,form,div')?.textContent || '').slice(0, 700));\n    if (/REGISTRO DE EXISTENCIA|CARGAR REGISTRO|SUBIR REGISTRO/.test(txt)) return true;\n    const name = norm(input.getAttribute('name') || input.id || '');\n    return /EXIST|REGISTRO/.test(name);\n  }`;

const replacement = `  function isExistenceInput(input) {\n    let node = input;\n    for (let level = 0; level < 7 && node; level++, node = node.parentElement) {\n      const txt = norm(String(node.textContent || '').slice(0, 1800));\n      if (/REGISTRO DE EXISTENCIA|CARGAR REGISTRO|SUBIR REGISTRO/.test(txt)) return true;\n    }\n    const name = norm(input.getAttribute('name') || input.id || '');\n    const accept = norm(input.getAttribute('accept') || '');\n    return /EXIST|REGISTRO/.test(name) || (/XLSX|XLS/.test(accept) && /EXIST/.test(name));\n  }`;

if (!src.includes(exact)) {
  console.log('Input detector target not found; leaving file unchanged.');
  process.exit(0);
}
src = src.replace(exact, replacement);
fs.writeFileSync(file, src, 'utf8');
console.log('Robust Registro de Existencia input detector applied.');
