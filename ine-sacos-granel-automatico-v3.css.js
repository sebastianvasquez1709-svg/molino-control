(()=>{
'use strict';
const css=`
.autoMonth{display:grid;grid-template-columns:2fr repeat(4,1fr);gap:10px;padding:12px;border:1px solid #d9e2ef;border-radius:12px;background:#f8fbff;margin-top:8px;align-items:center}
.autoMonth>div{min-width:0}.autoMonth b,.autoMonth strong{display:block;color:#123a78}.autoMonth span,.autoMonth small{display:block;color:#667085;font-size:11px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.autoKpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0 18px}.autoKpis>div{border:1px solid #d9e2ef;border-radius:11px;background:#fff;padding:12px}.autoKpis small{display:block;color:#667085}.autoKpis b{display:block;color:#123a78;font-size:18px;margin-top:4px}
.autoTableWrap{overflow:auto;max-height:560px;border:1px solid #d9e2ef;border-radius:10px}.autoTable{width:100%;border-collapse:collapse;background:#fff}.autoTable th,.autoTable td{padding:8px 9px;border-bottom:1px solid #edf1f6;text-align:left;font-size:12px;white-space:nowrap}.autoTable th{background:#eef4fb;color:#344054;position:sticky;top:0;z-index:2}.autoAudit{margin-top:12px;padding:10px 12px;border-radius:10px;background:#f4f7fb;color:#475467;font-size:12px}
@media(max-width:1100px){.autoMonth{grid-template-columns:1.5fr repeat(2,1fr)}.autoKpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:650px){.autoMonth{grid-template-columns:1fr}.autoKpis{grid-template-columns:1fr}}
`;
if(!document.getElementById('autoReportsStyle')){const s=document.createElement('style');s.id='autoReportsStyle';s.textContent=css;document.head.appendChild(s)}
})();