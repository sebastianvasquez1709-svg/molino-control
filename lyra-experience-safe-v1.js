(()=>{
'use strict';
if(window.__LYRA_EXPERIENCE_SAFE_V1__) return;
window.__LYRA_EXPERIENCE_SAFE_V1__=true;
const id='lyraExperienceSafeV1';
const apply=()=>{
 if(document.getElementById(id)) return;
 const s=document.createElement('style'); s.id=id;
 s.textContent=`
  :root{--lyra-focus:rgba(30,86,160,.22);--lyra-shadow:0 8px 24px rgba(18,58,120,.07)}
  .topbar{transition:box-shadow .18s ease}
  .card,.clientCard,.invoiceCard,.weatherCard{transition:box-shadow .18s ease,border-color .18s ease}
  .card:hover,.clientCard:hover,.invoiceCard:hover,.weatherCard:hover{box-shadow:var(--lyra-shadow);border-color:#cbd8e7}
  button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--lyra-focus);outline-offset:2px}
  .tableWrap,.invoiceTableWrap{scrollbar-width:thin}
  @media(max-width:820px){.content{padding:14px}.toolbar{gap:7px}.dataToolbar input,.searchInput{min-width:0;flex:1 1 220px}}
  @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
 `;
 document.head.appendChild(s);
};
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply();
})();
