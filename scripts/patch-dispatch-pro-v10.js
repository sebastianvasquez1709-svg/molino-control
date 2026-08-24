#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const appPath=path.resolve('app.js');
const fragPath=path.resolve('scripts/render-dispatch-pro-v10.frag');
let src=fs.readFileSync(appPath,'utf8');
const start=src.indexOf('function renderDispatches(){');
const end=src.indexOf('\nfunction renderGuides',start);
if(start<0||end<0)throw new Error('No se encontró renderDispatches.');
const replacement=fs.readFileSync(fragPath,'utf8');
src=src.slice(0,start)+replacement+src.slice(end);
const marker='/* DISPATCH PRO V10 */';
const css=`\n${marker}\n.dispatchProRoot .dispatchSectionTitle{margin-top:0}.dispatchFormCard{margin-top:14px}.dispatchPlanCard{margin-top:14px}.dispatchPlanCard .sectionTitle{align-items:flex-start}.dispatchTableViewport{width:100%;overflow-x:auto;overflow-y:visible}.dispatchPlanTable{min-width:1250px}.dispatchPlanTable th,.dispatchPlanTable td{vertical-align:middle}.dispatchPlanTable .actionBtns{flex-wrap:nowrap;min-width:180px}.dispatchDraftBox{margin-top:14px;padding:12px 14px;border:1px solid #dbe5ef;border-radius:12px;background:#f8fafc}.dispatchDraftList{display:grid;gap:7px;margin-top:8px}.dispatchDraftItem{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 10px;background:#fff;border:1px solid #e3eaf3;border-radius:10px}.dispatchKpis .kpi{min-height:88px}.dispatchProRoot .tableWrap{max-height:none}.dispatchProRoot .searchInput{min-width:260px}@media(max-width:900px){.dispatchProRoot .dispatchKpis{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.dispatchProRoot .dispatchKpis{grid-template-columns:1fr}.dispatchDraftItem{align-items:flex-start;flex-direction:column}.dispatchPlanTable{min-width:1150px}}\n`;
if(!src.includes(marker)){const p=src.lastIndexOf('</style>');if(p<0)throw new Error('No se encontró bloque CSS.');src=src.slice(0,p)+css+src.slice(p)}
fs.writeFileSync(appPath,src,'utf8');
console.log('DISPATCH PRO V10: PATCHED');
