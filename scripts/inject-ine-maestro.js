const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'index.html');
const marker = '<script src="/ine-engine-maestro.js"></script>';
let html = fs.readFileSync(file, 'utf8');
if (html.includes(marker)) {
  console.log('INE Maestro engine already injected.');
  process.exit(0);
}
const idx = html.toLowerCase().lastIndexOf('</body>');
if (idx < 0) throw new Error('No se encontró </body> en index.html');
html = html.slice(0, idx) + `\n${marker}\n` + html.slice(idx);
fs.writeFileSync(file, html, 'utf8');
console.log('Injected INE Maestro engine into index.html');
