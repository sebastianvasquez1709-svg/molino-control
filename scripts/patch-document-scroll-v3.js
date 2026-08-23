const fs=require('fs');
const path=require('path');
const file=path.join(process.cwd(),'app.js');
let src=fs.readFileSync(file,'utf8');
const close=src.lastIndexOf('\n})();');
if(close<0)throw new Error('No se encontró cierre IIFE.');
const injection=String.raw`
// DOCUMENT_SCROLL_V3
(function(){
  function enhance(kind){
    const card=document.querySelector('#content .docModule')||document.querySelector('#content .card');
    if(!card)return;
    const tableWrap=card.querySelector('.docV2Table')?.closest('.tableWrap')||card.querySelector('.tableWrap');
    if(!tableWrap)return;
    if(tableWrap.dataset.scrollV3==='1')return;
    tableWrap.dataset.scrollV3='1';
    tableWrap.classList.add('docScrollWrap');
    const table=tableWrap.querySelector('table');
    if(table)table.classList.add('docScrollableTable');

    const old=card.querySelector('.docScrollControls');
    if(old)old.remove();
    const controls=document.createElement('div');
    controls.className='docScrollControls';
    controls.innerHTML='<span class="docScrollHint">Desplazamiento</span><button type="button" class="ghost" data-scroll-top title="Subir al inicio">↑</button><button type="button" class="ghost" data-scroll-step-up title="Subir">⌃</button><button type="button" class="ghost" data-scroll-step-down title="Bajar">⌄</button><button type="button" class="ghost" data-scroll-bottom title="Bajar al final">↓</button>';
    const tools=card.querySelector('.docV2Tools');
    if(tools)tools.insertAdjacentElement('afterend',controls);else card.insertBefore(controls,tableWrap);
    const step=()=>Math.max(180,Math.round(tableWrap.clientHeight*0.72));
    controls.querySelector('[data-scroll-top]').onclick=()=>tableWrap.scrollTo({top:0,behavior:'smooth'});
    controls.querySelector('[data-scroll-bottom]').onclick=()=>tableWrap.scrollTo({top:tableWrap.scrollHeight,behavior:'smooth'});
    controls.querySelector('[data-scroll-step-up]').onclick=()=>tableWrap.scrollBy({top:-step(),behavior:'smooth'});
    controls.querySelector('[data-scroll-step-down]').onclick=()=>tableWrap.scrollBy({top:step(),behavior:'smooth'});

    const update=()=>{
      controls.classList.toggle('isTop',tableWrap.scrollTop<=4);
      controls.classList.toggle('isBottom',tableWrap.scrollTop+tableWrap.clientHeight>=tableWrap.scrollHeight-4);
    };
    tableWrap.addEventListener('scroll',update,{passive:true});
    update();
  }
  const wire=(name,fn)=>{
    const original=window[name];
    if(typeof original!=='function'||original.__scrollV3Wrapped)return;
    const wrapped=function(){const out=original.apply(this,arguments);enhance(name);return out};
    wrapped.__scrollV3Wrapped=true;
    window[name]=wrapped;
  };
  wire('renderInvoices', '');
  wire('renderBoletas', '');
  wire('renderGuides', '');

  const style=document.createElement('style');
  style.id='document-scroll-v3';
  style.textContent=`
    .docScrollControls{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin:0 18px 8px;position:relative;z-index:3}
    .docScrollControls .docScrollHint{margin-right:auto;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#667085}
    .docScrollControls button{min-width:34px;height:30px;padding:0 9px;border-radius:9px;font-size:15px;line-height:1;font-weight:900}
    .docScrollWrap{position:relative;max-height:58vh;min-height:180px;overflow:auto!important;scroll-behavior:smooth;scrollbar-gutter:stable both-edges;border:1px solid #dbe5ef;border-radius:12px;background:#fff}
    .docScrollWrap::-webkit-scrollbar{width:12px;height:12px}
    .docScrollWrap::-webkit-scrollbar-track{background:#eef2f6;border-radius:10px}
    .docScrollWrap::-webkit-scrollbar-thumb{background:#9aa9ba;border-radius:10px;border:3px solid #eef2f6}
    .docScrollWrap::-webkit-scrollbar-thumb:hover{background:#6f8196}
    .docScrollWrap{scrollbar-color:#9aa9ba #eef2f6;scrollbar-width:auto}
    .docScrollableTable{min-width:980px;margin:0}
    .docScrollableTable thead th{position:sticky;top:0;z-index:2;background:#f8fafc;box-shadow:0 1px 0 #dbe5ef}
    .docScrollWrap td,.docScrollWrap th{white-space:nowrap}
    .docScrollWrap td:nth-child(2),.docScrollWrap td:nth-child(3),.docScrollWrap td:nth-child(4),.docScrollWrap th:nth-child(2),.docScrollWrap th:nth-child(3),.docScrollWrap th:nth-child(4){white-space:normal;min-width:150px}
    .docScrollWrap .docRowActions{display:flex;flex-wrap:wrap;gap:5px}
    .docScrollControls.isTop [data-scroll-top],.docScrollControls.isBottom [data-scroll-bottom]{opacity:.45;pointer-events:none}
    @media(max-width:680px){
      .docScrollControls{margin:0 10px 8px}
      .docScrollControls .docScrollHint{font-size:9px}
      .docScrollWrap{max-height:62vh;min-height:160px}
      .docScrollableTable{min-width:900px}
    }
  `;
  document.head.appendChild(style);
  window.__enhanceDocumentScrollV3=enhance;
})();
`;
src=src.slice(0,close)+injection+src.slice(close);fs.writeFileSync(file,src);console.log('DOCUMENT SCROLL V3 APPLIED');
