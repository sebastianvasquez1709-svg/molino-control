const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'app.js');
let src = fs.readFileSync(file, 'utf8');

// Elimina el fallback heredado que recargaba la aplicación y devolvía al login.
src = src.replace(/try\{window\.print\(\)\}\s*finally\{location\.reload\(\)\}/g, 'try{window.print()}catch{}');

const marker = '// DISPATCH_PRINT_V3_CHROME_SAFE';
if (!src.includes(marker)) {
  const close = src.lastIndexOf('\n})();');
  if (close < 0) throw new Error('No se encontró el cierre del IIFE principal.');
  const injection = String.raw`

${marker}
// Chrome bloquea window.print() en iframes sin modales permitidos.
// Esta versión conserva la vista/estado de Despachos y nunca recarga la aplicación.
window.printDispatchPlan=()=>{
 try{
   const from=$('weekFrom')?.value||'';
   const to=$('weekTo')?.value||'';
   const rows=getDispatchPrintRows();
   const html=makeDispatchPrintHtmlV2(rows,from,to,EMBEDDED_LOGO_DATA);
   const previous=$('dispatchPrintFrame');
   if(previous)previous.remove();

   const frame=document.createElement('iframe');
   frame.id='dispatchPrintFrame';
   frame.title='Impresión de despachos';
   frame.setAttribute('aria-hidden','true');
   frame.setAttribute('sandbox','allow-modals allow-same-origin');
   frame.setAttribute('allow','modals');
   Object.assign(frame.style,{
     position:'fixed',left:'-12000px',top:'0',width:'1100px',height:'800px',
     border:'0',opacity:'0',pointerEvents:'none'
   });
   document.body.appendChild(frame);

   let printed=false;
   let timer=0;
   const cleanup=()=>{
     clearTimeout(timer);
     setTimeout(()=>{try{frame.remove()}catch{}},1200);
   };
   const doPrint=()=>{
     if(printed)return;
     printed=true;
     try{
       const w=frame.contentWindow;
       if(!w){cleanup();return;}
       w.onafterprint=cleanup;
       w.focus();
       w.print();
       cleanup();
     }catch(e){
       console.error('DISPATCH_PRINT_V3',e);
       cleanup();
       toast('No se pudo abrir la impresión.','err');
     }
   };

   frame.onload=()=>{
     setTimeout(()=>{
       try{
         const d=frame.contentDocument;
         if(d?.fonts?.ready){
           d.fonts.ready.then(()=>requestAnimationFrame(()=>requestAnimationFrame(doPrint))).catch(doPrint);
         }else{
           requestAnimationFrame(()=>requestAnimationFrame(doPrint));
         }
       }catch{doPrint()}
     },80);
   };
   frame.srcdoc=html;
   timer=setTimeout(doPrint,1200);
 }catch(e){
   console.error('DISPATCH_PRINT_V3',e);
   toast('No se pudo preparar la impresión de despachos.','err');
 }
};
`;
  src = src.slice(0, close) + injection + src.slice(close);
}

fs.writeFileSync(file, src);
console.log('Dispatch print V3 Chrome-safe patch applied.');
