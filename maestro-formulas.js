/* Molinos San Miguel · Motor canónico del Maestro
 * Una sola implementación para la app, el Web Worker y las pruebas.
 * Réplica: AJ/AM/AN -> AQ -> AR, AF, AX e INE (2).
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.MolinoMaestroFormula=api;
})(typeof globalThis!=='undefined'?globalThis:self,function(){
  'use strict';

  const VERSION='MAESTRO_CANONICAL_V1';
  const FAMILIES=Object.freeze([
    'HARINA GRANEL','HARINA 25KG','HARINA 10 KG','HARINILLA KG',
    'GRITZ SEMOL KG','H. F. MAIZ KG','ZOOTECNICA KG','GERMEN KG'
  ]);
  const MANUAL_OVERRIDES=Object.freeze({
    G20:'GERMEN KG',
    DEBILPOLI:'HARINA 25KG'
  });

  function number(v){
    if(typeof v==='number')return Number.isFinite(v)?v:0;
    if(v==null||v==='')return 0;
    const raw=String(v).trim().replace(/\$/g,'').replace(/\s/g,'');
    const normalized=/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)
      ?raw.replace(/\./g,'').replace(',','.')
      :raw.replace(',','.');
    const out=Number(normalized);
    return Number.isFinite(out)?out:0;
  }
  function text(v){return String(v??'').trim()}
  function normalize(v){return text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim()}
  function normalizeDoc(v){return normalize(v).replace(/[\[\]()]/g,' ').replace(/\s+/g,' ').trim()}
  function normalizeCode(v){return normalize(v).replace(/\s+/g,'')}
  function movtoKey(v){const x=Number(v);return Number.isFinite(x)?String(x):text(v)}
  function canonicalFamily(v){
    const key=normalize(v).replace(/[^A-Z0-9]+/g,' ').trim();
    return FAMILIES.find(f=>normalize(f).replace(/[^A-Z0-9]+/g,' ').trim()===key)||'';
  }
  function strictDate(y,m,d){
    const yy=Number(y),mm=Number(m),dd=Number(d);
    const out=new Date(Date.UTC(yy,mm-1,dd));
    return out.getUTCFullYear()===yy&&out.getUTCMonth()===mm-1&&out.getUTCDate()===dd
      ?`${String(yy).padStart(4,'0')}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`:'';
  }
  function parseDate(v){
    if(v instanceof Date&&!Number.isNaN(v.getTime()))return strictDate(v.getFullYear(),v.getMonth()+1,v.getDate());
    if(typeof v==='number'&&v>0){const d=new Date(Date.UTC(1899,11,30));d.setUTCDate(d.getUTCDate()+Math.floor(v));return strictDate(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate())}
    const s=text(v);if(!s)return '';
    let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);if(m)return strictDate(m[1],m[2],m[3]);
    m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);if(m)return strictDate(m[3],m[2],m[1]);
    if(/^\d+(?:\.\d+)?$/.test(s)){const serial=Number(s);if(serial>0){const d=new Date(Date.UTC(1899,11,30));d.setUTCDate(d.getUTCDate()+Math.floor(serial));return strictDate(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate())}}
    return '';
  }
  function isCreditNote(v){
    const d=normalizeDoc(v);
    return /^(NA|NT|NX|NY)(?:\b|$)/.test(d)||/NOTA\s+(?:DE\s+)?CREDITO/.test(d);
  }
  function docKind(v,docs={}){
    if(isCreditNote(v))return 'credit-note';
    const d=normalizeDoc(v);
    const invoice=normalizeDoc(docs.invoice||'Factura[FT]');
    const receipt=normalizeDoc(docs.receipt||'Boleta[BT]');
    const dispatch=normalizeDoc(docs.dispatch||docs.ticket||'Guía[ST]');
    if(d===invoice||d==='FT'||d==='FACTURA FT')return 'invoice';
    if(d===receipt||d==='BT'||d==='BOLETA BT')return 'receipt';
    if(d===dispatch||d==='ST'||d==='GUIA ST')return 'dispatch';
    return 'other';
  }
  function nonEmpty(matrix,row,col){return text(matrix?.[row]?.[col])}
  function parseCodigosMatrix(matrix){
    const rows=Array.isArray(matrix)?matrix:[];
    const familyByCode={},classificationByCode={},detailByCode={},productByCode={};
    for(let i=1;i<rows.length;i++){
      const code=normalizeCode(rows[i]?.[0]);if(!code)continue;
      const family=canonicalFamily(rows[i]?.[2]);
      if(family)familyByCode[code]=family;
      productByCode[code]=text(rows[i]?.[1]);
      detailByCode[code]=text(rows[i]?.[3]);
      classificationByCode[code]=text(rows[i]?.[6]);
    }
    const boletaPrices={};
    for(let i=15;i<=110&&i<rows.length;i++){
      const key=movtoKey(rows[i]?.[17]);
      const raw=rows[i]?.[18];
      if(key!==''&&raw!==''&&raw!=null)boletaPrices[key]=number(raw);
    }
    const params={
      version:VERSION,
      catalogLoaded:Object.keys(familyByCode).length>0,
      familyByCode,classificationByCode,detailByCode,productByCode,boletaPrices,
      documents:{invoice:nonEmpty(rows,1,10)||'Factura[FT]',receipt:nonEmpty(rows,2,10)||'Boleta[BT]',dispatch:nonEmpty(rows,3,10)||'Guía[ST]'},
      af:{
        nonDivideDetails:Array.from({length:7},(_,i)=>nonEmpty(rows,i+1,9)).filter(Boolean),
        tenKgProduct:nonEmpty(rows,1,8),
        divideCustomer:nonEmpty(rows,10,9),
        divide800Details:[nonEmpty(rows,11,9),nonEmpty(rows,12,9)].filter(Boolean),
        divide10Codes:[nonEmpty(rows,38,0),nonEmpty(rows,23,0)].filter(Boolean)
      },
      manualOverrides:{...MANUAL_OVERRIDES}
    };
    for(const [code,family] of Object.entries(MANUAL_OVERRIDES))if(!params.familyByCode[code])params.familyByCode[code]=family;
    return params;
  }
  function fromStaticConfig(config={}){
    const familyByCode={},classificationByCode={},detailByCode={},productByCode={};
    for(const [rawCode,meta] of Object.entries(config.code_map||{})){
      const code=normalizeCode(rawCode),family=canonicalFamily(meta?.C??meta?.producto);
      if(family)familyByCode[code]=family;
      productByCode[code]=text(meta?.B??meta?.envase);
      detailByCode[code]=text(meta?.D??meta?.detalle);
      classificationByCode[code]=text(meta?.G??meta?.clasificacion);
    }
    for(const [code,family] of Object.entries(MANUAL_OVERRIDES))if(!familyByCode[code])familyByCode[code]=family;
    const c=config.controls||{};
    return {
      version:VERSION,catalogLoaded:Object.keys(familyByCode).length>0,
      familyByCode,classificationByCode,detailByCode,productByCode,
      boletaPrices:{...(config.boleta_prices||{})},manualOverrides:{...MANUAL_OVERRIDES},
      documents:{invoice:c.invoice||'Factura[FT]',receipt:c.receipt||'Boleta[BT]',dispatch:c.dispatch||'Guía[ST]'},
      af:{nonDivideDetails:[...(c.non_divide_details||[])],tenKgProduct:'HARINA 10 KG',divideCustomer:c.divide_customer||'',divide800Details:[...(c.divide_800_details||[])],divide10Codes:[...(c.divide_10_codes||[])]}
    };
  }
  function familyFor(row,params={}){
    const direct=canonicalFamily(row?.family??row?.familia);
    if(direct)return direct;
    return params.familyByCode?.[normalizeCode(row?.code??row?.codigo)]||'';
  }
  function classificationFor(row,params={}){
    const code=normalizeCode(row?.code??row?.codigo);
    return text(row?.classification??row?.clasificacion??row?.AH??params.classificationByCode?.[code]);
  }
  function calculateRow(row={},params={}){
    const rawDoc=text(row.docto??row.tipoDocumento??row.N);
    const kind=docKind(rawDoc,params.documents);
    const S=number(row.valorMovto??row.S),U=number(row.salida??row.U);
    const AJ=(kind==='invoice'||kind==='dispatch')?S:0;
    const AM=kind==='receipt'?S:null;
    const key=AM===null?'':movtoKey(AM);
    const matched=AM===null||Object.prototype.hasOwnProperty.call(params.boletaPrices||{},key);
    const AN=AM===null?0:(matched?number(params.boletaPrices[key]):0);
    const AQ=AJ+AN,AR=AQ*U;
    const classification=classificationFor(row,params);
    return {doc:rawDoc,kind,S,U,AJ,AM,AN,AQ,AR,receiptMatched:matched,isCreditNote:kind==='credit-note',isSale:['invoice','dispatch','receipt'].includes(kind),excludedNoContabilizado:normalize(classification)==='NO CONTABILIZADO'};
  }
  function calculateAf(row={},params={}){
    const cached=row.af??row.AF;
    const U=number(row.salida??row.U);
    const af=params.af||{};
    const code=normalizeCode(row.code??row.codigo??row.B);
    const product=normalize(row.product??row.producto??row.AB??params.productByCode?.[code]);
    const origin=normalize(row.origin??row.origenDestino??row.origen??row.P);
    const detail=normalize(row.detail??row.detalle??row.AC??params.detailByCode?.[code]);
    const nonDivide=new Set((af.nonDivideDetails||[]).map(normalize));
    const divide800=new Set((af.divide800Details||[]).map(normalize));
    const divide10=new Set((af.divide10Codes||[]).map(normalizeCode));
    if(nonDivide.has(detail))return {value:U,rule:'CODIGOS!J2:J8 -> U',factor:1,source:'formula'};
    if(af.tenKgProduct&&product===normalize(af.tenKgProduct))return {value:U/10,rule:'CODIGOS!I2 -> U/10',factor:10,source:'formula'};
    if(af.divideCustomer&&origin===normalize(af.divideCustomer))return {value:U/25,rule:'CODIGOS!J11 -> U/25',factor:25,source:'formula'};
    if(divide800.has(detail))return {value:U/800,rule:'CODIGOS!J12:J13 -> U/800',factor:800,source:'formula'};
    if(divide10.has(code))return {value:U/10,rule:'CODIGOS!A39/A24 -> U/10',factor:10,source:'formula'};
    if(params.catalogLoaded)return {value:U/25,rule:'Maestro default -> U/25',factor:25,source:'formula'};
    if(cached!==undefined&&cached!==null&&cached!=='')return {value:number(cached),rule:'AF almacenado por el Maestro',factor:U&&number(cached)?U/number(cached):0,source:'cached'};
    return {value:U/25,rule:'Respaldo sin CODIGOS -> U/25',factor:25,source:'fallback'};
  }
  function calculateAx(row={},params={}){
    const cached=text(row.ax??row.AX);if(cached)return normalize(cached)==='GRANEL'?'GRANEL':'SACOS';
    return normalize(classificationFor(row,params))==='GRANEL'?'GRANEL':'SACOS';
  }
  function summarize(rows,params={},period=''){
    const groups=new Map(FAMILIES.map(name=>[name,{name,kg:0,neto:0,rows:0,codes:new Set()}]));
    const unmapped=[],unmatchedReceipts=[],excludedCreditNotes=[],excludedNoContabilizado=[],excludedOtherDocs=[],manualOverrides=[];
    let formulaRows=0,formulaZeroRows=0;
    for(const row of Array.isArray(rows)?rows:[]){
      const fx=calculateRow(row,params),code=normalizeCode(row?.code??row?.codigo);
      if(fx.isCreditNote){excludedCreditNotes.push({code,docto:fx.doc,folio:text(row?.folio),kg:fx.U});continue}
      if(fx.excludedNoContabilizado){excludedNoContabilizado.push({code,docto:fx.doc,folio:text(row?.folio),kg:fx.U});continue}
      if(!fx.isSale){if(fx.U)excludedOtherDocs.push({code,docto:fx.doc,folio:text(row?.folio),kg:fx.U});continue}
      if(!fx.U)continue;
      const family=familyFor(row,params);
      if(!family||!groups.has(family)){unmapped.push({code,name:text(row?.name??row?.item),docto:fx.doc,folio:text(row?.folio),kg:fx.U,reason:'Código sin familia INE en CODIGOS'});continue}
      if(fx.kind==='receipt'&&!fx.receiptMatched)unmatchedReceipts.push({code,folio:text(row?.folio),reference:fx.S,kg:fx.U,reason:'Referencia de Boleta sin coincidencia exacta en CODIGOS!R16:S111'});
      if(Object.prototype.hasOwnProperty.call(MANUAL_OVERRIDES,code)&&!params.classificationByCode?.[code])manualOverrides.push({code,family});
      const group=groups.get(family);group.kg+=fx.U;group.neto+=fx.AR;group.rows++;if(code)group.codes.add(code);
      formulaRows++;if(Math.abs(fx.AQ)<1e-12)formulaZeroRows++;
    }
    const items=FAMILIES.map(name=>{const x=groups.get(name);return{name,kg:x.kg,neto:x.neto,promedio:x.kg?x.neto/x.kg:null,vn:0,kgp:0,rows:x.rows,sourceCodes:[...x.codes]}});
    const totalKg=items.reduce((s,x)=>s+x.kg,0),totalNeto=items.reduce((s,x)=>s+x.neto,0);
    const kgHarinas=items.slice(0,3).reduce((s,x)=>s+x.kg,0),netoHarinas=items.slice(0,3).reduce((s,x)=>s+x.neto,0);
    for(const x of items){x.vn=totalNeto?x.neto/totalNeto:0;x.kgp=totalKg?x.kg/totalKg:0}
    const certified=!!params.catalogLoaded&&!unmapped.length&&!unmatchedReceipts.length;
    return {available:certified,certified,key:text(period),periodo:text(period),items,totalKg,totalNeto,totalPromedio:totalKg?totalNeto/totalKg:null,netoHarinas,kgHarinas,promedioHarinas:kgHarinas?netoHarinas/kgHarinas:null,formulaSource:'MAESTRO_FORMULA_FIJA_UNIVERSAL',engineVersion:VERSION,usesRegisterFormula:true,unmapped,unmatchedReceipts,excludedCreditNotes,excludedNoContabilizado,excludedOtherDocs,manualOverrides,audit:{formulaVersion:VERSION,formulaRows,formulaZeroRows,lookupEntries:Object.keys(params.boletaPrices||{}).length,catalogEntries:Object.keys(params.familyByCode||{}).length,excludedCreditNotes:excludedCreditNotes.length,excludedNoContabilizado:excludedNoContabilizado.length,excludedOtherDocs:excludedOtherDocs.length,manualOverrides:manualOverrides.length}};
  }
  return Object.freeze({VERSION,FAMILIES,MANUAL_OVERRIDES,number,normalize,normalizeDoc,normalizeCode,movtoKey,canonicalFamily,parseDate,isCreditNote,docKind,parseCodigosMatrix,fromStaticConfig,familyFor,classificationFor,calculateRow,calculateAf,calculateAx,summarize});
});
