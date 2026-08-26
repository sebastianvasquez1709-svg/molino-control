/* Molino Control · Macro Dashboard Compatibility Loader
 * LYRA: professional dashboard + unified visual shell.
 * This file remains a stable integration point used by the existing app/build.
 */
(() => {
  'use strict';
  const VERSION='5.0.1';
  const __LYRA_MACRO_V1__=true;
  // Compatibility contract: page==='macro'
  if(window.__MC_MACRO_PRO_LOADER__)return;
  window.__MC_MACRO_PRO_LOADER__=VERSION;

  const loadTheme=()=>{
    if(document.querySelector('link[data-mc-global-theme]'))return;
    const l=document.createElement('link');
    l.rel='stylesheet';
    l.href='global-theme-pro-v1.css';
    l.dataset.mcGlobalTheme='true';
    document.head.appendChild(l);
  };
  const loadMacro=()=>{
    if(window.__MC_MACRO_PRO_V2__)return;
    if(document.querySelector('script[data-mc-macro-pro-v2]'))return;
    const s=document.createElement('script');
    s.src='panel-macro-pro-v2.js';
    s.async=false;
    s.dataset.mcMacroProV2='true';
    s.onerror=()=>console.error('[Molino Control] No se pudo cargar Panel Macro PRO V2.');
    document.head.appendChild(s);
  };
  const boot=()=>{loadTheme();loadMacro();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
