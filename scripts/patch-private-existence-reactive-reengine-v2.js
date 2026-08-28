const fs=require('fs');
const p='public/app.js';
let s=fs.readFileSync(p,'utf8');
const MARK='/* PRIVATE EXISTENCE REACTIVE REENGINEERING V1 */';
const fixed='/* PRIVATE EXISTENCE REACTIVE REENGINEERING V2 */';
if(s.includes(fixed)){console.log('PRIVATE EXISTENCE REACTIVE REENGINEERING V2: ALREADY PRESENT');process.exit(0)}
function fail(m){throw new Error('[PRIVATE EXISTENCE REACTIVE REENGINEERING V2] '+m)}

// The V1 patch appended a closure after the application IIFE and therefore had no access
// to the lexical `state`/`currentView`. Move that bridge inside the application's root scope.
const bridgeStart=s.lastIndexOf(MARK);
const outerEnd=s.lastIndexOf('})();');
if(bridgeStart<0||outerEnd<0||bridgeStart>outerEnd)fail('No se encontró el bridge reactivo V1 al final del artefacto.');
const bridge=s.slice(bridgeStart,outerEnd);
s=s.slice(0,bridgeStart)+s.slice(outerEnd);
const rootEnd=s.lastIndexOf('})();');
if(rootEnd<0)fail('No se encontró cierre raíz después de mover el bridge.');
const safeBridge=bridge.replace('const MARK', 'const MARK_UNUSED');

// Repair month selection: explicit INE selection wins over a remembered Existencia record.
const oldSel="  let selected=existenceSelected||months.find(x=>String(x.key)===String(state.ineSelected))||months[months.length-1]||fallback||{items:[],totalNeto:0,totalKg:0,totalPromedio:null,netoHarinas:0,kgHarinas:0,promedioHarinas:null,key:'',periodo:'Sin datos',quality:{missing:['Carga un Excel Maestro o Registro de Existencia.']},inventory:{}};";
const newSel="  let selected=months.find(x=>String(x.key)===String(state.ineSelected))||existenceSelected||months[months.length-1]||fallback||{items:[],totalNeto:0,totalKg:0,totalPromedio:null,netoHarinas:0,kgHarinas:0,promedioHarinas:null,key:'',periodo:'Sin datos',quality:{missing:['Carga un Excel Maestro o Registro de Existencia.']},inventory:{}};";
if(s.includes(oldSel))s=s.replace(oldSel,newSel);

// Invalidate official INE cache whenever the existence period is merged/persisted.
safeBridge=safeBridge.replace("mergeExistenceRecord=async function(row){const out=await origMerge(row);publish('existence-record-merged',{key:out?.key||row?.key||''});return out};","mergeExistenceRecord=async function(row){const out=await origMerge(row);const key=typeof normalizeOfficialInePeriod==='function'?normalizeOfficialInePeriod(out?.key||row?.key||''):String(out?.key||row?.key||'');try{if(typeof OFFICIAL_INE_CACHE!=='undefined')OFFICIAL_INE_CACHE.delete(key)}catch{}publish('existence-record-merged',{key});return out};");

// Prevent the moved bridge's own inner marker from being mistaken for the outer marker.
safeBridge=safeBridge.replace(MARK,fixed);
s=s.slice(0,rootEnd)+safeBridge+'\n'+s.slice(rootEnd);

// Route navigation clicks through the wrapped window.show so private/existence live refresh actually runs.
s=s.replace("b.addEventListener('click',()=>show(b.dataset.view))","b.addEventListener('click',()=>window.show(b.dataset.view))");

if(/\bstate\.__mcRevision/.test(s.slice(rootEnd+safeBridge.length)))fail('El bridge reactivo quedó fuera del scope raíz.');
if(!s.includes(fixed))fail('No quedó instalado el bridge V2.');
if(!s.includes('b.addEventListener(\'click\',()=>window.show(b.dataset.view))'))fail('La navegación no usa window.show.');
if(!s.includes('months.find(x=>String(x.key)===String(state.ineSelected))||existenceSelected'))fail('No quedó corregida la precedencia del selector INE.');
if(!s.includes("OFFICIAL_INE_CACHE.delete(key)"))fail('No quedó invalidación de caché por período.');
fs.writeFileSync(p,s);
console.log('PRIVATE EXISTENCE REACTIVE REENGINEERING V2: PASS');
console.log('REACTIVE BRIDGE INSIDE ROOT SCOPE: PASS');
console.log('NAVIGATION USES WRAPPED SHOW: PASS');
console.log('EXPLICIT INE SELECTION PRIORITY: PASS');
console.log('OFFICIAL INE CACHE INVALIDATION: PASS');
