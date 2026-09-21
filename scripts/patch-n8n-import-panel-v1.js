'use strict';
const fs = require('node:fs');

const appPath = 'app.js';
const indexPath = 'index.html';
let app = fs.readFileSync(appPath, 'utf8');
let index = fs.readFileSync(indexPath, 'utf8');

const fail = message => { throw new Error(`[N8N IMPORT PANEL V1] ${message}`); };
const replaceOnce = (source, before, after, label) => {
  const count = source.split(before).length - 1;
  if (count !== 1) fail(`${label}: se esperó 1 coincidencia y se encontraron ${count}.`);
  return source.replace(before, after);
};

if (!app.includes('N8N_IMPORT_PANEL_V1')) {
  app = replaceOnce(
    app,
    'function buildNav(){',
    '// N8N_IMPORT_PANEL_V1\nfunction buildNav(){',
    'marcador de navegación',
  );
  app = replaceOnce(
    app,
    "['SISTEMA',[['admin','⚙️ Administración']]]",
    "['SISTEMA',[['automation','🤖 Automatización n8n'],['admin','⚙️ Administración']]]",
    'entrada de menú',
  );
  app = replaceOnce(
    app,
    "weather:'Clima',admin:'Administración',existencias:'Registros de existencia'",
    "weather:'Clima',automation:'Automatización n8n',admin:'Administración',existencias:'Registros de existencia'",
    'título de vista',
  );
  app = replaceOnce(
    app,
    "if(view==='admin'||view==='private'||view==='existencias')",
    "if(view==='admin'||view==='private'||view==='existencias'||view==='automation')",
    'control de acceso',
  );
  app = replaceOnce(
    app,
    'weather:renderWeather,admin:renderAdminSecure}[view]',
    'weather:renderWeather,automation:()=>window.MolinoAutomationImport?.render?.(),admin:renderAdminSecure}[view]',
    'registro del renderizador',
  );
}

const moduleTag = '<script src="/molino-automation-import.js"></script>';
if (!index.includes(moduleTag)) {
  index = replaceOnce(
    index,
    '<script src="/molino-cloud.js"></script>',
    `<script src="/molino-cloud.js"></script>\n${moduleTag}`,
    'carga del módulo',
  );
}

fs.writeFileSync(appPath, app);
fs.writeFileSync(indexPath, index);

if (!app.includes('N8N_IMPORT_PANEL_V1')) fail('no quedó el marcador en app.js');
if (!app.includes("['automation','🤖 Automatización n8n']")) fail('no quedó la ruta automation');
if (!index.includes(moduleTag)) fail('no quedó el módulo en index.html');
console.log('N8N IMPORT PANEL V1: PASS');
