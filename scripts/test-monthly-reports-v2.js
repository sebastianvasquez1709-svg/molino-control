const fs=require('fs');
const vm=require('vm');
const path=process.argv[2]||'public/existencia-reportes-mensuales.js';
const source=fs.readFileSync(path,'utf8');
const window={};
const document={getElementById:()=>null,addEventListener:()=>{},head:{appendChild:()=>{}},createElement:()=>({})};
const context={window,document,location:{origin:'https://example.test'},console,setInterval:()=>1,clearInterval:()=>{},setTimeout,clearTimeout,indexedDB:{}};
vm.createContext(context);
vm.runInContext(source,context,{filename:path});
const api=window.MolinoMonthlyReportsV2;
if(!api)throw new Error('No se expuso MolinoMonthlyReportsV2.');
if(api.VERSION!=='EXISTENCIA_REPORTES_MODELO_V2')throw new Error('Versión inesperada de informes mensuales.');
const record={
  key:'2026-08',periodo:'Agosto 2026',
  detailRows:[
    {codigo:'ESP10',family:'HARINA 10 KG',salida:1000,'salida$':600000,origenDestino:'CLIENTE'},
    {codigo:'HFM800',family:'H. F. MAIZ KG BIG BAG 800 KG',salida:1600,'salida$':700000,origenDestino:'NESTLE'},
    {codigo:'DB',family:'HARINA GRANEL',salida:5000,'salida$':2000000,origenDestino:'NESTLE'},
    {codigo:'DEBILGRAN',family:'HARINA GRANEL',salida:7000,'salida$':2800000,origenDestino:'OTRO CLIENTE'},
    {codigo:'HLLAGGRA',family:'HARINILLA KG',classification:'GRANEL',ax:'GRANEL',salida:3218370,af:3218370,'salida$':1},
    {codigo:'SEMOLGRA',family:'GRITZ SEMOL KG',classification:'GRANEL',ax:'GRANEL',salida:2847390,af:2847390,'salida$':1},
    {codigo:'HZGRA',family:'ZOOTECNICA KG',classification:'GRANEL',ax:'GRANEL',salida:2174533,af:2174533,'salida$':1},
    {codigo:'GERGRA',family:'GERMEN KG',classification:'GRANEL',ax:'GRANEL',salida:168660,af:168660,'salida$':1},
    {codigo:'HLLAFGRA',family:'HARINILLA KG',classification:'GRANEL',ax:'GRANEL',salida:19070,af:19070,'salida$':1}
  ],
  derivedIne:{available:true,items:[
    {name:'HARINA GRANEL',neto:4800000,kg:12000,promedio:400},
    {name:'HARINA 10 KG',neto:600000,kg:1000,promedio:600}
  ]}
};
const sheets=api.buildSheets(record);
if(sheets.length!==7)throw new Error('Se esperaban 7 hojas de informe.');
const sack=sheets.find(x=>x.key==='nestleSacos')?.html||'';
if(!sack.includes('102'))throw new Error('Big Bag/10KG no respetan el conteo AF esperado (100 + 2).');
const modeled=api.modelRows(record);
for(const expected of [3218370,2847390,2174533,168660,19070]){
  if(!modeled.some(x=>x.kg===expected&&x.af===expected))throw new Error('AF granel real no preservado: '+expected);
}
const nestle=sheets.find(x=>x.key==='nestleGranel')?.html||'';
if(!nestle.includes('5.000'))throw new Error('Nestle Granel no contiene sus 5.000 KG.');
if(nestle.includes('12.000'))throw new Error('Nestle Granel está sumando granel de otros clientes.');
const ine=sheets.find(x=>x.key==='ine')?.html||'';
for(const family of ['HARINA GRANEL','HARINA 25KG','HARINA 10 KG','HARINILLA KG','GRITZ SEMOL KG','H. F. MAIZ KG','ZOOTECNICA KG','GERMEN KG']){
  if(!ine.includes(family))throw new Error('Falta familia INE: '+family);
}
if(source.includes("window.open('','_blank'"))throw new Error('La impresión volvió al popup que causaba problemas de navegación.');
if(!source.includes("document.createElement('iframe')"))throw new Error('Falta impresión aislada por iframe.');
console.log('MONTHLY REPORTS V2: PASS');
console.log('BIG BAG 800 KG RULE: PASS');
console.log('REAL GRANEL AF REGRESSION: PASS');
console.log('FILTERED GRANEL TOTALS: PASS');
console.log('INE 8 FAMILIES: PASS');
console.log('IFRAME PRINT SAFETY: PASS');
