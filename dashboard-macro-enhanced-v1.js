/* Molino Control · Panel Macro Compatibility Loader
 * LYRA: professional dashboard + unified visual shell.
 * Stable integration point used by the existing app/build.
 */
(() => {
  'use strict';
  const VERSION='9.0.0';
  const __LYRA_MACRO_V1__=true;
  // Compatibility contract: page==='macro'
  if(window.__MC_MACRO_PRO_LOADER__)return;
  window.__MC_MACRO_PRO_LOADER__=VERSION;
  const loadTheme=()=>{
    if(document.querySelector('link[data-mc-global-theme]'))return;
    const l=document.createElement('link');l.rel='stylesheet';l.href='global-theme-premium-v2.css';l.dataset.mcGlobalTheme='true';document.head.appendChild(l);
  };
  const loadPremium=()=>{
    if(document.querySelector('link[data-mc-macro-premium]'))return;
    const l=document.createElement('link');l.rel='stylesheet';l.href='panel-macro-premium-v2.css';l.dataset.mcMacroPremium='true';document.head.appendChild(l);
  };
  const loadMacro=()=>{
    if(window.__MC_MACRO_PRO_V6__){loadPremium();return}
    if(document.querySelector('script[data-mc-macro-pro-v6]'))return;
    const s=document.createElement('script');s.src='panel-macro-pro-v6.js';s.async=false;s.dataset.mcMacroProV6='true';
    s.onload=loadPremium;
    s.onerror=()=>console.error('[Molino Control] No se pudo cargar Panel Macro PRO V6.');document.head.appendChild(s);
  };
  const boot=()=>{loadTheme();loadMacro()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
