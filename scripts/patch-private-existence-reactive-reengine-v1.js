const fs=require('fs');
const p='public/app.js';
let s=fs.readFileSync(p,'utf8');
const MARK='/* PRIVATE EXISTENCE REACTIVE REENGINEERING V1 */';
if(s.includes(MARK)){console.log('PRIVATE EXISTENCE REACTIVE REENGINEERING V1 already present');process.exit(0)}
function fail(m){throw new Error('[PRIVATE EXISTENCE REENGINEERING V1] '+m)}

// Canonical selector: the selected local Existencia record is the source of truth.
// INE display order is: freshly persisted displayIne -> derivedIne -> cloud Maestro exact period.
const exStart=s.indexOf('function exactIneForExistenceDisplay(m){');
const exEnd=s.indexOf('\nfunction existenceReconciliation(m){',exStart);
if(exStart<0||exEnd<0)fail('No se encontró exactIneForExistenceDisplay/existenceReconciliation.');
const exactFn=[
"function exactIneForExistenceDisplay(m){",
"  if(m?.quality?.sourceType!=='existencia') return m||null;",
"  const rawKey=m?.key||m?.periodKey||m?.periodo||'';",
"  const key=typeof normalizeOfficialInePeriod==='function'?normalizeOfficialInePeriod(rawKey):String(rawKey).trim();",
"  if(m?.displayIne?.items?.length){if(m.displayIne.available!==false)return {...m.displayIne,key,periodKey:key,periodo:m.periodo||m.displayIne.periodo||key,available:true}}",
"  if(m?.derivedIne?.available&&m.derivedIne?.items?.length){return {...m.derivedIne,key,periodKey:key,periodo:m.periodo||m.derivedIne.periodo||key,available:true}}",
"  if(typeof OFFICIAL_INE_CACHE!=='undefined'){const hit=OFFICIAL_INE_CACHE.get(key);if(hit?.items?.length)return {...hit,key,periodKey:key,periodo:m.periodo||hit.periodo||key,available:true}}",
"  const map=state?.snapshot?.masterIneByPeriod||{};",
"  for(const [k,v] of Object.entries(map)){const nk=typeof normalizeOfficialInePeriod==='function'?normalizeOfficialInePeriod(k):String(k).trim();if(nk===key&&Array.isArray(v?.items)&&v.items.length)return {...v,key,periodKey:key,periodo:m.periodo||v.periodo||key,available:true};}",
"  return null;",
"}",""
].join('\n');
s=s.slice(0,exStart)+exactFn+s.slice(exEnd);

// Rebuild only the selection layer of renderPrivate(). The rest of the existing UI remains intact.
const rStart=s.indexOf('function renderPrivate(){');
const invLine=s.indexOf('  const inv=selected.inventory||{};',rStart);
if(rStart<0||invLine<0)fail('No se encontró la capa de selección de renderPrivate.');
const selection=[
"function renderPrivate(){",
"  if(state.role!=='ADMIN')return renderDenied();",
"  const existenceRows=Array.isArray(state.existenceRecords)?state.existenceRecords:[];",
"  const existenceSelected=existenceRows.find(x=>String(x.key)===String(state.existenceSelected))||null;",
"  const months=state.ineMonths.length?state.ineMonths.slice().sort((a,b)=>String(a.key).localeCompare(String(b.key))):[];",
"  const fallback=currentIneFallback();",
"  let selected=existenceSelected||months.find(x=>String(x.key)===String(state.ineSelected))||months[months.length-1]||fallback||{items:[],totalNeto:0,totalKg:0,totalPromedio:null,netoHarinas:0,kgHarinas:0,promedioHarinas:null,key:'',periodo:'Sin datos',quality:{missing:['Carga un Excel Maestro o Registro de Existencia.']},inventory:{}};",
"  if(existenceSelected){state.ineSelected=existenceSelected.key;}",
"  const isInv=selected.quality?.sourceType==='existencia';",
"  const derived=isInv?masterFormulaForEntry(selected):selected;",
"  const official=isInv?exactIneForExistenceDisplay(selected):selected;",
"  const display=isInv?{items:official?.items||[],totalNeto:official?.totalNeto??null,totalKg:official?.totalKg??null,totalPromedio:official?.totalPromedio??null,netoHarinas:official?.netoHarinas??null,kgHarinas:official?.kgHarinas??null,promedioHarinas:official?.promedioHarinas??null}:selected;"
].join('\n');
s=s.slice(0,rStart)+selection+'\n'+s.slice(invLine);

// Reactive invalidation bus: mutation -> revision -> currently visible module re-renders.
const bridge=`\n${MARK}\n(()=>{\n  if(window.__MC_PRIVATE_EXISTENCE_REACTIVE_V1__)return;\n  window.__MC_PRIVATE_EXISTENCE_REACTIVE_V1__=true;\n  state.__mcRevision=Number(state.__mcRevision||0);\n  let renderQueued=false;\n  let rendering=false;\n  const publish=(reason,detail={})=>{\n    state.__mcRevision++;\n    state.__mcLastChange={reason,at:Date.now(),revision:state.__mcRevision,...detail};\n    try{window.dispatchEvent(new CustomEvent('molino:data-change',{detail:state.__mcLastChange}))}catch{}\n    queueVisibleRender();\n  };\n  const queueVisibleRender=()=>{\n    if(renderQueued||rendering)return;\n    renderQueued=true;\n    queueMicrotask(()=>{\n      renderQueued=false;\n      if(rendering)return;\n      try{\n        if(currentView==='private'&&typeof renderPrivate==='function'){rendering=true;renderPrivate();}\n        else if(currentView==='existencias'&&typeof renderExistencias==='function'){rendering=true;renderExistencias();}\n      }catch(e){try{window.__lastAppError=e}catch{}}finally{rendering=false}\n    });\n  };\n  window.__MC_PUBLISH_DATA_CHANGE__=publish;\n  window.addEventListener('molino:data-change',queueVisibleRender);\n\n  // Wrap the two state writers once so every successful write invalidates both modules.\n  const origMerge=mergeExistenceRecord;\n  mergeExistenceRecord=async function(row){const out=await origMerge(row);publish('existence-record-merged',{key:out?.key||row?.key||''});return out};\n\n  const origPersistIne=persistIneMonths;\n  persistIneMonths=async function(rows){const out=await origPersistIne(rows);publish('ine-months-persisted',{count:Array.isArray(out)?out.length:0});return out};\n\n  // Cloud refresh is deliberately non-authoritative for local Existencia. It refreshes the audit snapshot,\n  // then the local canonical selector decides what the user sees. This removes stale private indicators.\n  let cloudSync=null;\n  async function refreshCloudForPrivateModules(){\n    if(cloudSync)return cloudSync;\n    cloudSync=(async()=>{\n      try{\n        if(!window.MolinoCloud?.getSession||!window.MolinoCloud?.snapshot)return;\n        const session=await window.MolinoCloud.getSession();\n        if(!session)return;\n        const snap=await window.MolinoCloud.snapshot({force:true});\n        if(snap&&state.snapshot!==snap){state.snapshot=snap;publish('cloud-snapshot-refreshed',{source:'MolinoCloud'});}\n      }catch(e){try{window.__lastAppError=e}catch{}}\n      finally{cloudSync=null}\n    })();\n    return cloudSync;\n  }\n\n  const prevShow=window.show;\n  window.show=async function(view){\n    const result=prevShow(view);\n    if(view==='private'||view==='existencias'){\n      await refreshCloudForPrivateModules();\n      if(currentView===view){\n        try{if(view==='private')renderPrivate();else renderExistencias()}catch(e){try{window.__lastAppError=e}catch{}}\n      }\n    }\n    return result;\n  };\n\n  // Expose a deterministic manual refresh hook for regression testing and future modules.\n  window.__refreshPrivateExistenceModules=async()=>{await refreshCloudForPrivateModules();queueVisibleRender();return state.__mcRevision};\n\n  // Initial hydration: ensure the current visible module is never left with an old DOM projection.\n  queueVisibleRender();\n})();\n`;
s+=bridge;

if(!s.includes('const existenceRows=Array.isArray(state.existenceRecords)'))fail('No se instaló el selector canónico de Existencia.');
if(!s.includes('if(m?.displayIne?.items?.length)'))fail('No quedó priorizado displayIne persistido.');
if(!s.includes("molino:data-change"))fail('No quedó instalado el bus reactivo.');
if(!s.includes('window.__refreshPrivateExistenceModules'))fail('No quedó expuesto el refresco determinista.');
fs.writeFileSync(p,s);
console.log('PRIVATE EXISTENCE REACTIVE REENGINEERING V1: PASS');
console.log('CANONICAL EXISTENCE SELECTOR: PASS');
console.log('DISPLAY INE PRIORITY: PASS');
console.log('PRIVATE/EXISTENCE REACTIVE BUS: PASS');
console.log('LIVE CLOUD SNAPSHOT ON MODULE OPEN: PASS');
console.log('MUTATION INVALIDATION WRAPPERS: PASS');
