const fs=require('fs');
const p='public/app.js';
let s=fs.readFileSync(p,'utf8');
const marker='/* MC_PRIVATE_LIVE_REFRESH_V1 */';
if(s.includes(marker)){console.log('PRIVATE LIVE REFRESH V1 already present');process.exit(0)}
const bridge=`\n${marker}\n(()=>{\n  const baseShow=window.show;\n  if(typeof baseShow!=='function') return;\n  window.show=async function(view){\n    if(view!=='private') return baseShow(view);\n    const st=window.__MC_APP_STATE__;\n    const hasLive=!!(st?.snapshot?.masterIneByPeriod && Object.values(st.snapshot.masterIneByPeriod).some(x=>Array.isArray(x?.items)&&x.items.length&&Number(x?.totalKg||0)>0));\n    if(!hasLive && window.MolinoCloud?.getSession){\n      try{\n        const session=await window.MolinoCloud.getSession();\n        if(session){\n          const snap=await window.MolinoCloud.snapshot({force:true});\n          if(snap && st){\n            st.snapshot=snap;\n            const latest=Object.values(snap.masterIneByPeriod||{}).find(x=>Array.isArray(x?.items)&&x.items.length)||snap.metrics?.ine;\n            if(latest){st.ineSelected=latest.key||'';}\n          }\n        }\n      }catch(e){try{window.__lastAppError=e;window.toast?.('⚠️ No se pudo actualizar INE en línea.','err')}catch{}}\n    }\n    return baseShow(view);\n  };\n})();\n`;
s=s.replace(/\s*\/\/\s*V50\.0 CLOUD PERSISTENCE[\s\S]*?async function boot\(\)/,m=>m); // keep file deterministic; no-op
s+=bridge;
fs.writeFileSync(p,s);
console.log('PRIVATE LIVE REFRESH V1: PASS');