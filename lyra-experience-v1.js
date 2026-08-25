(()=>{
'use strict';
if(window.__LYRA_EXPERIENCE_V1__) return;
window.__LYRA_EXPERIENCE_V1__=true;
const STYLE='lyraExperienceStyleV1';
const ready=()=>{
  if(document.getElementById(STYLE)) return;
  const s=document.createElement('style');
  s.id=STYLE;
  s.textContent=`
  :root{--lyra-shadow:0 10px 28px rgba(18,58,120,.08);--lyra-shadow-strong:0 16px 42px rgba(18,58,120,.14)}
  body.lyra-ready .topbar{transition:box-shadow .22s ease,background-color .22s ease}
  body.lyra-scrolled .topbar{box-shadow:0 6px 18px rgba(18,58,120,.08)}
  body.lyra-ready .card,body.lyra-ready .clientCard,body.lyra-ready .invoiceCard,body.lyra-ready .weatherCard{transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
  body.lyra-ready .card:hover,body.lyra-ready .clientCard:hover,body.lyra-ready .invoiceCard:hover,body.lyra-ready .weatherCard:hover{transform:translateY(-1px);box-shadow:var(--lyra-shadow);border-color:#cbd9ea}
  body.lyra-ready button:not(:disabled),body.lyra-ready .nav button:not(:disabled){transition:transform .12s ease,box-shadow .12s ease,background-color .12s ease}
  body.lyra-ready button:not(:disabled):active,body.lyra-ready .nav button:not(:disabled):active{transform:translateY(1px)}
  body.lyra-ready button:focus-visible,body.lyra-ready a:focus-visible,body.lyra-ready input:focus-visible,body.lyra-ready select:focus-visible{outline:3px solid rgba(45,115,213,.28);outline-offset:2px}
  body.lyra-ready .tableWrap,body.lyra-ready .invoiceTableWrap{scrollbar-width:thin;scrollbar-color:#b8c7da transparent}
  body.lyra-ready .tableWrap::after,body.lyra-ready .invoiceTableWrap::after{content:'';display:block;height:1px}
  .lyra-skeleton{display:grid;gap:10px;padding:16px;border:1px solid #dce6f1;border-radius:14px;background:#fff}
  .lyra-skeleton span{height:12px;border-radius:8px;background:linear-gradient(90deg,#edf2f8,#f8fafc,#edf2f8);background-size:200% 100%;animation:lyraShimmer 1.35s infinite}
  .lyra-skeleton span:nth-child(1){width:38%}.lyra-skeleton span:nth-child(2){width:76%}.lyra-skeleton span:nth-child(3){width:63%}.lyra-skeleton span:nth-child(4){width:91%}
  @keyframes lyraShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
  @media(prefers-reduced-motion:reduce){body.lyra-ready *,body.lyra-ready *::before,body.lyra-ready *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
  @media(max-width:700px){body.lyra-ready .topbar{padding:12px 14px}body.lyra-ready .topbarBrand small{font-size:10px}.lyra-skeleton{padding:13px}}
  `;
  document.head.appendChild(s);
};
const scroll=()=>document.body.classList.toggle('lyra-scrolled',window.scrollY>6);
const enhance=()=>{
  ready();
  document.body.classList.add('lyra-ready');
  window.addEventListener('scroll',scroll,{passive:true});
  scroll();
  document.querySelectorAll('button').forEach(btn=>{if(!btn.getAttribute('aria-label')&&!btn.textContent.trim())btn.setAttribute('aria-label','Acción');});
  const nav=document.querySelector('.nav');
  if(nav){
    nav.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;b.classList.add('lyra-pressed');setTimeout(()=>b.classList.remove('lyra-pressed'),160);},{passive:true});
  }
  document.querySelectorAll('input,select').forEach(el=>el.setAttribute('autocomplete',el.tagName==='SELECT'?'off':(el.type==='password'?'current-password':'off')));
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
})();
