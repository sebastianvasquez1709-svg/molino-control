// COUNTER SACOS GRANEL V1
const counterParamRows=rowsPart('CODIGOS');
const counterCell=(row,col)=>String(counterParamRows?.[row-1]?.[col]??'').trim();
const counterParams={
  granelDetails:[2,3,4,5,6,7,8].map(r=>counterCell(r,9)).filter(Boolean),
  harina10:counterCell(2,8),
  specialCustomer25:counterCell(11,9),
  bigBagHfm800:counterCell(12,9),
  bigBagSemolina800:counterCell(13,9),
  code10A39:counterCell(39,0),
  code10A24:counterCell(24,0)
};
const counterNorm=v=>String(v??'').trim().toUpperCase().replace(/\s+/g,' ');
const counterRule=o=>{
  const code=counterNorm(get(o,['CODIGO','CÓDIGO']));
  const product=counterNorm(get(o,['PRODUCTO','ITEM','ÍTEM']));
  const detail=counterNorm(get(o,['DETALLE']));
  const origin=counterNorm(get(o,['ORIGEN/DESTINO']));
  const granelSet=new Set(counterParams.granelDetails.map(counterNorm));
  if(granelSet.has(detail))return {rule:'GRANEL_DESCRIPCION_CODIGOS_J2_J8',divisor:1,mode:'GRANEL'};
  if(product===counterNorm(counterParams.harina10))return {rule:'SACO_10KG_PRODUCTO_CODIGOS_I2',divisor:10,mode:'SACO'};
  if(origin===counterNorm(counterParams.specialCustomer25))return {rule:'SACO_25KG_EXCEPCION_CLIENTE_CODIGOS_J11',divisor:25,mode:'SACO'};
  if(detail===counterNorm(counterParams.bigBagHfm800))return {rule:'BIG_BAG_HFM_800KG_CODIGOS_J12',divisor:800,mode:'SACO'};
  if(detail===counterNorm(counterParams.bigBagSemolina800))return {rule:'BIG_BAG_SEMOLINA_800KG_CODIGOS_J13',divisor:800,mode:'SACO'};
  if(code===counterNorm(counterParams.code10A39)||code===counterNorm(counterParams.code10A24))return {rule:'SACO_10KG_EXCEPCION_CODIGOS_A24_A39',divisor:10,mode:'SACO'};
  return {rule:'SACO_25KG_DEFAULT',divisor:25,mode:'SACO'};
};
const counterReports=(()=>{
  const out={};
  const periodOf=rows=>{const y=String(rows?.[0]?.[2]??'').trim(),m=String(rows?.[1]?.[2]??'').trim().toLowerCase();return y&&m?y+'-'+(MONTHS_ES[m]||m):''};
  const find=(rows,pred)=>rows.find(pred);
  const push=(key,sheet,period,metric,value,unit,note='')=>{if(value===''||value==null)return;out[key]={sheet,period,metric,value:n(value),unit,note}};
  const ns=rowsPart('NESTLE SACOS');
  const ny=rowsPart('NESTLE Y CPW');
  const cg=rowsPart('CPW GRANELES');
  const ng=rowsPart('NESTLE GRANELES');
  const ev=rowsPart('ENVASE');
  const ev3=rowsPart('ENVASE (3)');
  const h2=rowsPart('Hoja2');
  const totalGeneral=rows=>find(rows,r=>counterNorm(r?.[1])==='TOTAL GENERAL');
  const nrow=rows=>find(rows,r=>counterNorm(r?.[1])==='N.A'&&counterNorm(r?.[2])==='GRANEL');
  const tr=totalGeneral(ns); if(tr)push('NESTLE SACOS MIXTO','NESTLE SACOS',periodOf(ns),'VENTAS * SACOS · TOTAL GENERAL',tr?.[3],'mixto: sacos + kg granel','Filtro propio del informe.');
  const nsKg=find(ns,r=>counterNorm(r?.[6])==='TOTAL SACOS KG'); if(nsKg)push('NESTLE SACOS KG','NESTLE SACOS',periodOf(ns),'TOTAL SACOS KG',nsKg?.[7],'kg','Subtotal de sacos del informe.');
  const nyG=find(ny,r=>counterNorm(r?.[6]).includes('TOTAL GRANEL')); if(nyG)push('NESTLE Y CPW GRANEL','NESTLE Y CPW',periodOf(ny),'TOTAL GRANEL',nyG?.[7],'kg','Alcance del informe Nestlé + CPW.');
  const cpT=totalGeneral(cg); if(cpT)push('CPW GRANELES MIXTO','CPW GRANELES',periodOf(cg),'VENTAS * SACOS · TOTAL GENERAL',cpT?.[3],'mixto','Informe CPW.');
  const cpG=nrow(cg); if(cpG)push('CPW GRANELES KG','CPW GRANELES',periodOf(cg),'GRANEL (N.A.)',cpG?.[3],'kg','Fila N.A. / GRANEL.');
  const ngT=totalGeneral(ng); if(ngT)push('NESTLE GRANELES MIXTO','NESTLE GRANELES',periodOf(ng),'VENTAS * SACOS · TOTAL GENERAL',ngT?.[3],'mixto','Informe Nestlé.');
  const ngG=nrow(ng); if(ngG)push('NESTLE GRANELES KG','NESTLE GRANELES',periodOf(ng),'GRANEL (N.A.)',ngG?.[3],'kg','Fila N.A. / GRANEL.');
  const evT=find(ev,r=>counterNorm(r?.[0])==='TOTAL GENERAL');
  if(evT){push('ENVASE GRANEL','ENVASE',periodOf(ev),'ENVASE = GRANEL',evT?.[3],'kg','Pivot por envase.');push('ENVASE SACOS','ENVASE',periodOf(ev),'ENVASE = SACOS/PAPEL',evT?.[4],'kg','Pivot por envase.');push('ENVASE TOTAL','ENVASE',periodOf(ev),'ENVASE = TOTAL GENERAL',evT?.[5],'kg','No asumir alcance universal.');}
  const h2T=find(h2,r=>counterNorm(r?.[0])==='TOTAL GENERAL'); if(h2T)push('HOJA2 APOYO','Hoja2','multi-mes','SALIDA $ GERMEN/ZOOT',h2T?.[5],'$','Apoyo monetario; no se usa en conteo físico.');
  if(ev3?.length)out['ENVASE3 FILTROS']={sheet:'ENVASE (3)',period:periodOf(ev3),metric:'Suma de VENTAS * SACOS',value:0,unit:'mixto',note:'Hoja de filtro/pivote sin total materializado.'};
  return out;
})();
const counterPeriodsMap=new Map();
const counterDiffAll=[];const sgDiffAll=[];const counterUnmapped=new Set();const counterRuleCounts=new Map();
for(const o of baseObjects){
  const monthRaw=String(get(o,['MES'])||'').trim().toLowerCase();
  const yearRaw=String(get(o,['AÑO','ANO'])||'').trim();
  const mm=MONTHS_ES[monthRaw]||'';
  if(!/^\d{4}$/.test(yearRaw)||!mm)continue;
  const key=yearRaw+'-'+mm;
  if(!counterPeriodsMap.has(key))counterPeriodsMap.set(key,{key,label:monthRaw.charAt(0).toUpperCase()+monthRaw.slice(1)+' '+yearRaw,rows:0,codes:new Set(),sacosUnits:0,sacosKg:0,granelKg:0,totalKg:0,byCode:new Map(),byFamily:new Map(),formulaMatches:0,formulaDifferences:[],sgDifferences:[],unmappedCodes:new Set(),ruleCounts:new Map()});
  const p=counterPeriodsMap.get(key);
  const code=String(get(o,['CODIGO','CÓDIGO'])||'').trim().toUpperCase();
  const product=String(get(o,['PRODUCTO','ITEM','ÍTEM'])||'').trim();
  const detail=String(get(o,['DETALLE'])||'').trim();
  const outKg=n(get(o,['SALIDA']));
  const storedBags=n(get(o,['VENTAS * SACOS']));
  const storedSG=counterNorm(get(o,['S/G']));
  const classification=counterNorm(get(o,['CLASIFICACION']));
  const family=ineFamilyByCode(code,product)||'SIN MAPEO';
  const rule=counterRule(o);
  const expectedBags=outKg/rule.divisor;
  const expectedSG=classification==='GRANEL'?'GRANEL':'SACOS';
  const rowRef={folio:String(get(o,['FOLIO'])||''),code,product,detail,expectedBags,storedBags,expectedSG,storedSG,rule:rule.rule};
  p.rows++;p.codes.add(code);p.totalKg+=outKg;
  if(expectedSG==='GRANEL')p.granelKg+=outKg;else{p.sacosKg+=outKg;p.sacosUnits+=expectedBags;}
  if(Math.abs(storedBags-expectedBags)>0.00001){p.formulaDifferences.push(rowRef);counterDiffAll.push({...rowRef,key})}else p.formulaMatches++;
  if(storedSG&&storedSG!==expectedSG){p.sgDifferences.push(rowRef);sgDiffAll.push({...rowRef,key})}
  if(!catalogFamilyByCode.has(code)&&code)p.unmappedCodes.add(code),counterUnmapped.add(code);
  const rc=p.ruleCounts.get(rule.rule)||{rule:rule.rule,rows:0,sacos:0,kg:0};rc.rows++;rc.kg+=outKg;if(expectedSG==='SACOS')rc.sacos+=expectedBags;p.ruleCounts.set(rule.rule,rc);const gr=counterRuleCounts.get(rule.rule)||{rule:rule.rule,rows:0};gr.rows++;counterRuleCounts.set(rule.rule,gr);
  const ck=code+'|'+expectedSG+'|'+rule.rule;const bc=p.byCode.get(ck)||{code,product,detail,family,clase:expectedSG,rule:rule.rule,rows:0,kg:0,sacos:0};bc.rows++;bc.kg+=outKg;if(expectedSG==='SACOS')bc.sacos+=expectedBags;p.byCode.set(ck,bc);
  const fk=family+'|'+expectedSG;const bf=p.byFamily.get(fk)||{family,clase:expectedSG,rows:0,kg:0,sacos:0};bf.rows++;bf.kg+=outKg;if(expectedSG==='SACOS')bf.sacos+=expectedBags;p.byFamily.set(fk,bf);
}
const ineSheet=rowsPart('INE (2)');
let ineRef={period:'',kg:null,neto:null};
if(ineSheet?.length){const y=String(ineSheet?.[3]?.[1]??'').trim();const m=String(ineSheet?.[2]?.[1]??'').trim().toLowerCase();const key=y&&MONTHS_ES[m]?y+'-'+MONTHS_ES[m]:'';const total=ineSheet.find(r=>counterNorm(r?.[0])==='TOTAL GENERAL');ineRef={period:key,kg:total?n(total?.[2]):null,neto:total?n(total?.[1]):null};}
const counterPeriods={};
const famOrder=['HARINA GRANEL','HARINA 25KG','HARINA 10 KG','HARINILLA KG','GRITZ SEMOL KG','H. F. MAIZ KG','ZOOTECNICA KG','GERMEN KG'];
for(const [key,p] of counterPeriodsMap.entries()){
  p.ineReferenceKg=ineRef.period===key?ineRef.kg:null;p.ineReferenceNeto=ineRef.period===key?ineRef.neto:null;
  p.byCode=[...p.byCode.values()].sort((a,b)=>b.kg-a.kg);
  p.byFamily=[...p.byFamily.values()].sort((a,b)=>(famOrder.indexOf(a.family)-famOrder.indexOf(b.family))||b.kg-a.kg);
  p.formulaDifferences=p.formulaDifferences.slice(0,100);p.sgDifferences=p.sgDifferences.slice(0,100);p.unmappedCodes=[...p.unmappedCodes].sort();p.ruleCounts=[...p.ruleCounts.values()].sort((a,b)=>b.rows-a.rows);p.codesCount=p.codes.size;delete p.codes;
  counterPeriods[key]=p;
}
const counter={version:'COUNTER_SACOS_GRANEL_V1',sourceSheets:['CODIGOS','BASE DE DATOS','INE (2)','NESTLE SACOS','NESTLE Y CPW','CPW GRANELES','NESTLE GRANELES','ENVASE','ENVASE (3)','Hoja2'],formula:'AF = IF(AC=CODIGOS!J2:J8,SALIDA,IF(PRODUCTO=I2,SALIDA/10,IF(ORIGEN/DESTINO=J11,SALIDA/25,IF(DETALLE=J12,SALIDA/800,IF(DETALLE=J13,SALIDA/800,IF(CODIGO=A39/A24,SALIDA/10,SALIDA/25)))))); AX = IF(CLASIFICACION="GRANEL","GRANEL","SACOS")',parameters:counterParams,periods:counterPeriods,reports:counterReports,ineReference:ineRef,audit:{formulaDifferences:counterDiffAll.slice(0,100),sgDifferences:sgDiffAll.slice(0,100),unmappedCodes:[...counterUnmapped].sort(),rules:[...counterRuleCounts.values()].sort((a,b)=>b.rows-a.rows)}};
// END COUNTER SACOS GRANEL V1
