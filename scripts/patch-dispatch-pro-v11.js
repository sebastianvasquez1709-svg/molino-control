#!/usr/bin/env node
const fs=require('fs');const path=require('path');
const appPath=path.resolve('app.js');const fragPath=path.resolve('scripts/dispatch-pro-v11.frag');
let src=fs.readFileSync(appPath,'utf8');
const marker='// DISPATCH PRO V11 — in-place edit/delete without replacing the core dispatch renderer.';
if(!src.includes(marker)){
 const insertAt=src.lastIndexOf('\n})();');
 if(insertAt<0)throw new Error('No se encontró cierre de app.js para integrar Dispatch V11.');
 src=src.slice(0,insertAt)+'\n'+fs.readFileSync(fragPath,'utf8')+'\n'+src.slice(insertAt);
}
const cssMarker='/* DISPATCH UI V11 */';
const css=`\n${cssMarker}\n.dispatchEnhanceHost .tableWrap{max-height:none;overflow-x:auto;overflow-y:visible}.dispatchEnhanceHost .table{min-width:1240px}.dispatchActionBtns{display:flex;gap:6px;flex-wrap:nowrap}.dispatchModalOverlayV11{position:fixed;inset:0;background:rgba(11,34,66,.48);backdrop-filter:blur(3px);z-index:20000;display:flex;align-items:center;justify-content:center;padding:20px}.dispatchModalV11{width:min(760px,96vw);max-height:92vh;overflow:auto;background:#fff;border:1px solid #d9e2ef;border-radius:18px;box-shadow:0 26px 80px rgba(10,35,70,.28);padding:20px}.dispatchModalHeadV11{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid #e5ebf2;padding-bottom:12px;margin-bottom:14px}.dispatchModalHeadV11 h3{margin:7px 0 3px;color:#123a78}.dispatchModalGridV11{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.dispatchModalGridV11 .full{grid-column:1/-1}.dispatchModalActionsV11{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid #e5ebf2}@media(max-width:680px){.dispatchModalGridV11{grid-template-columns:1fr}.dispatchModalGridV11 .full{grid-column:auto}.dispatchModalActionsV11{flex-direction:column}.dispatchModalActionsV11 button{width:100%}}\n`;
if(!src.includes(cssMarker)){const pos=src.lastIndexOf('</style>');if(pos<0)throw new Error('No se encontró bloque CSS para Dispatch V11.');src=src.slice(0,pos)+css+src.slice(pos)}
fs.writeFileSync(appPath,src,'utf8');console.log('DISPATCH UI V11: PATCHED');
