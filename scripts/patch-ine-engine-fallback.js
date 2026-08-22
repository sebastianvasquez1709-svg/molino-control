const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'ine-engine-maestro.js');
let src = fs.readFileSync(file, 'utf8');

const exact = `  async function loadMaestroParameters() {\n    const sb = await getSupabaseClient();\n    const { data, error } = await sb.rpc('maestro_ine_parameters');\n    if (error) throw error;\n    if (!data || !data.code_map || !data.controls) throw new Error('La parametrización INE del Maestro está incompleta.');\n    return data;\n  }`;

const replacement = `  async function loadMaestroParameters() {\n    try {\n      const sb = await getSupabaseClient();\n      const { data, error } = await sb.rpc('maestro_ine_parameters');\n      if (!error && data && data.code_map && data.controls) return data;\n    } catch (_) {}\n\n    const response = await fetch('/ine-maestro-static.json', { cache: 'no-store' });\n    if (!response.ok) throw new Error('No fue posible cargar la parametrización INE del Maestro.');\n    const fallback = await response.json();\n    if (!fallback || !fallback.code_map || !fallback.controls) throw new Error('La parametrización estática del Maestro está incompleta.');\n    return fallback;\n  }`;

if (!src.includes(exact)) {
  console.log('Fallback already applied or target function changed.');
  process.exit(0);
}
src = src.replace(exact, replacement);
fs.writeFileSync(file, src, 'utf8');
console.log('Embedded fallback applied to ine-engine-maestro.js');
