/* Molino Control · Macro Dashboard Compatibility Loader
 * LYRA: the professional dashboard lives in panel-macro-pro-v1.js.
 * This file remains as the stable integration point used by the existing app/build.
 */
(() => {
  'use strict';
  const VERSION = '3.0.1';
  const __LYRA_MACRO_V1__ = true;
  if (window.__MC_MACRO_PRO_LOADER__) return;
  window.__MC_MACRO_PRO_LOADER__ = VERSION;
  const load = () => {
    if (window.__MC_MACRO_PRO__) return;
    if (document.querySelector('script[data-mc-macro-pro]')) return;
    const s = document.createElement('script');
    s.src = 'panel-macro-pro-v1.js';
    s.async = false;
    s.dataset.mcMacroPro = 'true';
    s.onerror = () => console.error('[Molino Control] No se pudo cargar Panel Macro PRO.');
    document.head.appendChild(s);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})();
