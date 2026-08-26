/* Molino Control · Macro Dashboard Compatibility Loader
 * LYRA: the professional dashboard lives in panel-macro-pro-v2.js.
 * This file remains the stable integration point used by the existing app/build.
 */
(() => {
  'use strict';
  const VERSION='4.0.0';
  const __LYRA_MACRO_V1__=true;
  // Compatibility contract: page==='macro'
  if(window.__MC_MACRO_PRO_LOADER__)return;
  window.__MC_MACRO_PRO_LOADER__=VERSION;
  const load=()=>{
    if(window.__MC_MACRO_PRO_V2__)return;
    if(document.querySelector('script[data-mc-macro-pro-v2]'))return;
    const s=document.createElement('script');
    s.src='panel-macro-pro-v2.js';
    s.async=false;
    s.dataset.mcMacroProV2='true';
    s.onerror=()=>console.error('[Molino Control] No se pudo cargar Panel Macro PRO V2.');
    document.head.appendChild(s);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
