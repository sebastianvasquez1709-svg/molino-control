// V45.3: lector XLSX autocontenido. No depende de CDN ni de una librería externa.
// Esto permite procesar el Registro de Existencia incluso con conectividad limitada.
const td=new TextDecoder('utf-8');
const u16=(dv,o)=>dv.getUint16(o,true),u32=(dv,o)=>dv.getUint32(o,true);
const xmlText=s=>String(s??'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'\"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
function colIndex(ref){let m=String(ref||'').match(/^([A-Z]+)\d+$/i);if(!m)return 0;let n=0;for(const c of m[1].toUpperCase())n=n*26+c.charCodeAt(0)-64;return n-1}
async function unzipEntries(buf){
  const dv=new DataView(buf), bytes=new Uint8Array(buf);let eocd=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65558);i--){if(u32(dv,i)===0x06054b50){eocd=i;break}}
  if(eocd<0)throw new Error('El archivo no es un XLSX ZIP válido.');
  const count=u16(dv,eocd+10),cdSize=u32(dv,eocd+12),cdOff=u32(dv,eocd+16),out=new Map();let p=cdOff;
  for(let i=0;i<count;i++){if(u32(dv,p)!==0x02014b50)break;const method=u16(dv,p+10),cs=u32(dv,p+20),nameLen=u16(dv,p+28),extraLen=u16(dv,p+30),commentLen=u16(dv,p+32),local=u32(dv,p+42);const name=td.decode(bytes.slice(p+46,p+46+nameLen));const ld=u16(dv,local+26),le=u16(dv,local+28),start=local+30+ld+le;const raw=bytes.slice(start,start+cs);let data;if(method===0)data=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);else if(method===8){const ds=new DecompressionStream('deflate-raw');data=await new Response(new Blob([raw]).stream().pipeThrough(ds)).arrayBuffer()}else throw new Error('Compresión XLSX no soportada: '+method);out.set(name,data);p+=46+nameLen+extraLen+commentLen}
  return out;
}
function attr(tag,name){const re=new RegExp(name+'=\"([^\"]*)\"','i'),m=String(tag).match(re);return m?xmlText(m[1]):''}
function textBetween(xml,tag){const re=new RegExp('<'+tag+'[^>]*>([\\s\\S]*?)</'+tag+'>','gi'),a=[];let m;while((m=re.exec(xml)))a.push(xmlText(m[1].replace(/<[^>]+>/g,'')));return a.join('')}
function parseShared(xml){const a=[];for(const si of String(xml||'').match(/<si(?:\s[^>]*)?>[\s\S]*?<\/si>/gi)||[])a.push(textBetween(si,'t'));return a}
function parseSheet(xml,shared,keepIndexes=null,maxRows=Infinity){const rows=[];const keep=keepIndexes instanceof Set?keepIndexes:null;for(const rm of String(xml||'').match(/<row(?:\s[^>]*)?>[\s\S]*?<\/row>/gi)||[]){if(rows.length>=maxRows)break;const cells=[];for(const cm of rm.match(/<c(?:\s[^>]*)?>[\s\S]*?<\/c>|<c(?:\s[^>]*)?\/>/gi)||[]){const ref=attr(cm,'r'),idx=colIndex(ref);if(idx<0||(keep&& !keep.has(idx)))continue;const type=attr(cm,'t'),v=textBetween(cm,'v'),is=textBetween(cm,'t');let value=null;if(type==='s')value=shared[Number(v)]??'';else if(type==='inlineStr')value=is;else if(type==='b')value=v==='1';else if(type==='str')value=v;else if(v!==''){const num=Number(v);value=Number.isFinite(num)?num:v}cells[idx]=value}rows.push(cells)}return rows}
async function parseXlsx(buf){const z=await unzipEntries(buf),get=async name=>z.has(name)?td.decode(new Uint8Array(await z.get(name))):'';const wb=await get('xl/workbook.xml');const rel=await get('xl/_rels/workbook.xml.rels');const relMap={};for(const m of rel.match(/<Relationship\b[^>]*>/gi)||[]){const id=attr(m,'Id'),target=attr(m,'Target');if(id)relMap[id]=target}
  const shared=z.has('xl/sharedStrings.xml')?parseShared(await get('xl/sharedStrings.xml')):[];
  // El Maestro puede contener hojas de 50 MB o más. No es necesario cargar todas:
  // Molino Control trabaja con estas hojas y conserva sus nombres para diagnóstico.
  // Nombres de hoja tolerantes: Excel puede guardar "INE (2)" o "INE  (2)"
  // según cómo se haya creado/copied el libro. La lógica de negocio es la misma.
  const normSheetName = v => String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
  const targets=new Set(['BASE DE DATOS','INE (2)','NESTLE SACOS','NESTLE Y CPW','LIBRO','GUIAS'].map(normSheetName));
  const baseKeep=new Set([0,1,2,9,13,14,15,17,20,27,28,29,30,31,40,43,44,45,46,47,48,49,50]);
  const sheets=[];
  for(const m of wb.match(/<sheet\b[^>]*>/gi)||[]){const name=attr(m,'name'),rid=attr(m,'r:id')||attr(m,'id');let target=relMap[rid]||'';target=target.replace(/^\.\//,'');target=target.replace(/^\/+/, '').replace(/^\.\//,'');if(!target.startsWith('xl/'))target='xl/'+target;let rows=[];
    if(target&&z.has(target)){
      const xml=await get(target);
      // Detectar Registros de Existencia aunque la hoja tenga un nombre genérico
      // (por ejemplo Hoja2). Solo se escanean las primeras filas para decidir;
      // luego se carga completa únicamente si es candidata. Esto evita volver a
      // cargar innecesariamente hojas gigantes del Maestro.
      let isExistencia=false;
      if(!targets.has(name)){
        const probe=parseSheet(xml,shared,null,40);
        const probeText=probe.flat().map(v=>String(v??'')).join(' | ').toUpperCase();
        isExistencia=/REGISTRO\s+DE\s+EXISTENCIAS|TOTAL\s+DISPONIBLE|TOTAL\s+VALORIZADO/.test(probeText);
      }
      const shouldLoad=targets.has(normSheetName(name))||isExistencia;
      if(shouldLoad)rows=parseSheet(xml,shared,name==='BASE DE DATOS'?baseKeep:null);
    }
    sheets.push({name,rows});}
  return sheets}

self.onmessage = async (e) => {
  try {
    if (e.data?.type !== 'parse') return;
    const parsed = await parseXlsx(e.data.buffer);
    const sheets = parsed.map(x=>x.name);
    const sheetMap = new Map(parsed.map(x=>[x.name,x.rows]));
    const post = (message, percent) => self.postMessage({ type: 'progress', message, percent });
    const sheetPart = p => {
      const target=String(p||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
      return sheets.find(s => {
        const current=String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
        return current.includes(target);
      }) || null;
    };
    const rowsOf = name => name && sheetMap.has(name) ? sheetMap.get(name) : [];
    const rowsPart = p => rowsOf(sheetPart(p));
    const norm = v => String(v ?? '').toUpperCase().replace(/[.\-\s]/g, '');
    const normName = v => String(v ?? '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,' ').trim().replace(/\s+/g,' ');
    const hashText=s=>{let h=2166136261;for(let i=0;i<String(s||'').length;i++){h^=String(s)[i].charCodeAt(0);h=Math.imul(h,16777619)>>>0}return h.toString(16).padStart(8,'0')};
    const n = v => {
      if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
      const x = String(v ?? '').replace(/\$/g, '').replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
      const z = parseFloat(x);
      return Number.isFinite(z) ? z : 0;
    };
    const dateISO = v => {
      const s = String(v ?? '').trim();
      const m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
      if (m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
      const d = new Date(s); return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0,10);
    };
    const headerRow = (rows, req) => {
      const r = req.map(x => x.toUpperCase());
      let best = -1, score = 0;
      for (let i = 0; i < Math.min(rows.length, 40); i++) {
        const t = (rows[i] || []).map(v => String(v ?? '').toUpperCase()).join(' | ');
        const sc = r.filter(x => t.includes(x)).length;
        if (sc > score) { score = sc; best = i; }
      }
      return best;
    };
    const objects = (rows, req, max = 50000) => {
      const h = headerRow(rows, req);
      if (h < 0) return [];
      const header = rows[h].map(v => String(v ?? '').trim());
      const out = [];
      for (let i = h + 1; i < Math.min(rows.length, max); i++) {
        const r = rows[i];
        if (!r || r.every(v => v == null || v === '')) continue;
        const o = {};
        header.forEach((k, j) => { if (k) o[k] = r[j]; });
        out.push(o);
      }
      return out;
    };
    const get = (o, keys) => {
      for (const k of keys) {
        const hit = Object.keys(o).find(x => x.toUpperCase().replace(/\s+/g, ' ').includes(k.toUpperCase()));
        if (hit && o[hit] != null && o[hit] !== '') return o[hit];
      }
      return '';
    };

    post('Leyendo estructura del Maestro', 8);

    // ---------- INE / REGISTRO DE EXISTENCIA ----------
    // Regla de fuente:
    // 1) Si existe BASE DE DATOS del Maestro, esa es la fuente de cálculo.
    //    INE (2) se usa como referencia de diseño/validación, nunca como fuente
    //    maestra derivada.
    // 2) Si no existe BASE DE DATOS, una hoja INE (2) válida es aceptada como
    //    fuente de ventas.
    // 3) Si tampoco existe, se reconoce Registro de Existencia Físico-Valorizado.
    const INE_FAMILIES = [
      'HARINA GRANEL','HARINA 25KG','HARINA 10 KG','HARINILLA KG',
      'GRITZ SEMOL KG','H. F. MAIZ KG','ZOOTECNICA KG','GERMEN KG'
    ];
    const INE_CODE_FAMILY = new Map([
      ['DB','HARINA GRANEL'],['DEBILGRAN','HARINA GRANEL'],['DN','HARINA GRANEL'],['FUERTEGRA','HARINA GRANEL'],
      ['10KG','HARINA 10 KG'],['ESP10','HARINA 10 KG'],
      ['25OSN','HARINA 25KG'],['25PAP','HARINA 25KG'],['25POLI','HARINA 25KG'],['DEBILPAP','HARINA 25KG'],['DEBILPAPEL','HARINA 25KG'],['ESPOSN','HARINA 25KG'],['ESPPAP','HARINA 25KG'],['ESPPOLI','HARINA 25KG'],['FUERTEPAP','HARINA 25KG'],['RACION','HARINA 25KG'],
      ['HLLAF','HARINILLA KG'],['HLLAFGRA','HARINILLA KG'],['HLLAG','HARINILLA KG'],['HLLAGGRA','HARINILLA KG'],['HLLAG20','HARINILLA KG'],['SALVADO','HARINILLA KG'],
      ['S800','GRITZ SEMOL KG'],['SEMOL','GRITZ SEMOL KG'],['SEMOL800','GRITZ SEMOL KG'],['SEMOLGRA','GRITZ SEMOL KG'],['GRITZGR','GRITZ SEMOL KG'],['GRITZGRP','GRITZ SEMOL KG'],['GRITZM','GRITZ SEMOL KG'],['GRITZGR10','GRITZ SEMOL KG'],['SEMOLP','GRITZ SEMOL KG'],
      ['HF800','H. F. MAIZ KG'],['HFM','H. F. MAIZ KG'],['HFM10','H. F. MAIZ KG'],['HFM800','H. F. MAIZ KG'],['HFMPAP','H. F. MAIZ KG'],
      ['HZ','ZOOTECNICA KG'],['HZGRA','ZOOTECNICA KG'],
      ['GERGRA','GERMEN KG'],['GERMEN','GERMEN KG']
    ]);
    const canonicalFamily = name => {
      const x=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim().replace(/\s+/g,' ');
      if(!x)return '';
      const hit=INE_FAMILIES.find(f=>String(f).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim().replace(/\s+/g,' ')===x);
      if(hit)return hit;
      if(/^HARINA\s+GRANEL$/.test(x))return 'HARINA GRANEL';
      if(/^HARINA\s+25KG$/.test(x))return 'HARINA 25KG';
      if(/^HARINA\s+10\s*KG$/.test(x))return 'HARINA 10 KG';
      if(/^HARINILLA\s+KG$/.test(x))return 'HARINILLA KG';
      if(/^GRITZ\s+SEMOL\s+KG$/.test(x))return 'GRITZ SEMOL KG';
      if(/^H\s*F\s*MAIZ\s+KG$/.test(x))return 'H. F. MAIZ KG';
      if(/^ZOOTECNICA\s+KG$/.test(x))return 'ZOOTECNICA KG';
      if(/^GERMEN\s+KG$/.test(x))return 'GERMEN KG';
      return '';
    };
    // Catálogo oficial del Maestro: CODIGOS manda sobre heurísticas.
    const catalogFamilyByCode = new Map();
    try {
      const cr = rowsPart('CODIGOS');
      const h = (cr[0] || []).map(v => String(v ?? '').trim().toUpperCase());
      const ci = h.findIndex(v => v === 'CÓDIGO' || v === 'CODIGO');
      const pi = h.findIndex(v => v === 'PRODUCTO');
      if (ci >= 0 && pi >= 0) for (const r of cr.slice(1)) {
        const code = String(r?.[ci] ?? '').trim().toUpperCase();
        const fam = canonicalFamily(r?.[pi]);
        if (code && fam) catalogFamilyByCode.set(code, fam);
      }
    } catch {}
    const ineFamilyByCode = (code,name) => {
      const c=String(code||'').trim().toUpperCase();
      if (catalogFamilyByCode.has(c)) return catalogFamilyByCode.get(c);
      if (INE_CODE_FAMILY.has(c)) return INE_CODE_FAMILY.get(c);
      return canonicalFamily(name) || (()=>{
        const x=String(name||'').trim().toUpperCase();
        if(/HARINA.*GRANEL|KG HARINA .*GRANEL/.test(x)) return 'HARINA GRANEL';
        if(/HARINA.*10\s*KG/.test(x)) return 'HARINA 10 KG';
        if(/HARINA.*25\s*KG/.test(x)) return 'HARINA 25KG';
        if(/HARINILLA|SALVADO/.test(x)) return 'HARINILLA KG';
        if(/GRITZ|SEMOL/.test(x)) return 'GRITZ SEMOL KG';
        if(/H\.?\s*F\.?\s*MAIZ|MAIZ.*KG/.test(x)) return 'H. F. MAIZ KG';
        if(/ZOOTECNICA/.test(x)) return 'ZOOTECNICA KG';
        if(/GERMEN/.test(x)) return 'GERMEN KG';
        return '';
      })();
    };
    // ================================================================
    // PROMEDIO — REGLA MAESTRA (extraída del Excel Maestro)
    //
    // El PivotTable de la hoja INE (2) usa el campo calculado:
    //   VP X = NETO / Salida
    // y la columna "Promedio" corresponde al resultado de esa fórmula
    // sobre cada agrupación. Para una agrupación, Excel equivale esto a:
    //   D = B / C
    // Total general:
    //   D15 = B15 / C15
    // Harinas:
    //   B18 = B7+B8+B9
    //   B19 = C7+C8+C9
    //   B20 = B18/B19
    //
    // IMPORTANTE: no se usa ningún promedio alternativo. Si el valor
    // leído del Maestro no coincide con la fórmula del Maestro, se marca
    // la inconsistencia para no presentar un dato inventado.
    // ================================================================
    // ================================================================
    // MOTOR DE FÓRMULAS INE — espejo del Excel Maestro
    // Fuente real inspeccionada en el Excel Maestro:
    //   VP X = NETO / Salida
    //   D = B / C
    //   E = B / B15
    //   F = C / C15
    //   B15 = SUM(B7:B14)
    //   C15 = SUM(C7:C14)
    //   D15 = B15 / C15
    //   B18 = B7+B8+B9
    //   B19 = C7+C8+C9
    //   B20 = B18 / B19
    // Para Registro de Existencia el mapeo de columnas es:
    //   B = Total Disponible$
    //   C = Total Disponible
    // Por lo tanto, el promedio automático conserva la misma fórmula:
    //   D = B / C = Total Disponible$ / Total Disponible
    // ================================================================
    const INE_MASTER_FORMULAS = Object.freeze({
      sourceField:'VP X = NETO / Salida',
      familyAverage:'D = B / C',
      valueShare:'E = B / B15',
      kgShare:'F = C / C15',
      totalValue:'B15 = SUM(B7:B14)',
      totalKg:'C15 = SUM(C7:C14)',
      totalAverage:'D15 = B15 / C15',
      flourValue:'B18 = B7+B8+B9',
      flourKg:'B19 = C7+C8+C9',
      flourAverage:'B20 = B18 / B19'
    });
    const divideSafe=(a,b)=>Math.abs(Number(b)||0)>0?Number(a||0)/Number(b):0;
    const calcIne = (items,periodo,quality={}) => {
      const ordered=INE_FAMILIES.map(name=>{
        const x=items.find(v=>canonicalFamily(v.name)===name || String(v.name||'').trim().toUpperCase()===name) || {name,neto:0,kg:0};
        const neto=n(x.neto), kg=n(x.kg);
        const promedio=divideSafe(neto,kg);
        return {name,neto,kg,promedio};
      });
      const totalNeto=ordered.reduce((a,x)=>a+x.neto,0);
      const totalKg=ordered.reduce((a,x)=>a+x.kg,0);
      const netoHarinas=ordered.slice(0,3).reduce((a,x)=>a+x.neto,0);
      const kgHarinas=ordered.slice(0,3).reduce((a,x)=>a+x.kg,0);
      const totalPromedio=divideSafe(totalNeto,totalKg);
      const promedioHarinas=divideSafe(netoHarinas,kgHarinas);
      const itemsOut=ordered.map(x=>({...x,vn:divideSafe(x.neto,totalNeto),kgp:divideSafe(x.kg,totalKg)}));
      const formulaAudit={
        ok:ordered.every(x=>Math.abs(x.promedio-divideSafe(x.neto,x.kg))<=1e-12) &&
           Math.abs(totalPromedio-divideSafe(totalNeto,totalKg))<=1e-12 &&
           Math.abs(promedioHarinas-divideSafe(netoHarinas,kgHarinas))<=1e-12,
        tolerance:1e-12,
        master:{...INE_MASTER_FORMULAS},
        existenceMapping:{
          B:'Total Disponible$',
          C:'Total Disponible',
          D:'B/C',
          E:'B/B15',
          F:'C/C15'
        },
        message:'El promedio automático usa exactamente la estructura de cálculo del Excel Maestro: D=B/C; para Existencia, B=Total Disponible$ y C=Total Disponible.'
      };
      return {totalNeto,totalKg,totalPromedio,netoHarinas,kgHarinas,promedioHarinas,
        items:itemsOut,periodo,
        quality:{...quality,formulaAudit,masterFormulaProfile:{producto:'Hoja INE (2) / Tabla dinámica2',...INE_MASTER_FORMULAS}}
      };
    };

    let ir = rowsPart('INE');
    const ineSourceSheet = sheetPart('INE') || '';
    const bd = rowsPart('BASE DE DATOS');
    const ine = { totalNeto:0,totalKg:0,totalPromedio:0,netoHarinas:0,kgHarinas:0,promedioHarinas:0,items:[],periodo:'',quality:{mode:'',sourceType:'',headerFound:false,missing:[]},inventory:{saldoAnterior:0,saldoAnterior$:0,entradaKg:0,salidaKg:0,entrada$:0,salida$:0,disponibleKg:0,disponible$:0,reservasKg:0,consignacionKg:0,transitoriaKg:0,totalValorizado$:0} };

    // V45.9: si el archivo contiene un Registro de Existencia Físico-Valorizado,
    // este es la fuente del INE. No se permite que BASE DE DATOS o INE (2) lo
    // desplacen: el Registro de Existencia manda para ese período.
    const existenceSheetName=sheets.find(name=>{
      const rr=rowsOf(name);
      if(!rr.length)return false;
      const limit=Math.min(rr.length,250);
      const t=rr.slice(0,limit).flat().map(v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()).join(' | ');
      const title=/REGISTRO\s+DE\s+EXISTENCIAS/.test(t) && /FISICO\s*-?\s*VALORIZADO/.test(t);
      if(title)return true;
      // Respaldo estructural para plantillas donde el título está desplazado.
      return /TOTAL\s*DISPONIBLE/.test(t) && /CODIGO/.test(t) && /ITEM/.test(t) && /INFO/.test(t);
    })||null;

    // --- A) REGISTRO DE EXISTENCIA FÍSICO-VALORIZADO es la fuente INE prioritaria ---
    const bdh=(bd[0]||[]).map(v=>String(v??'').trim().toUpperCase());
    const bidx={}; bdh.forEach((v,i)=>{if(v)bidx[v]=i});
    const hasBase=['PRODUCTO','MES','AÑO','NETO','SALIDA'].every(k=>bidx[k]!=null);
    if(!existenceSheetName && hasBase && bd.length>1){
      const monthRows=[]; const monthsOrder={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};
      for(const r of bd.slice(1)){
        const month=String(r[bidx['MES']]??'').trim().toLowerCase(), year=String(r[bidx['AÑO']]??r[bidx['AÑO ']]??'').trim();
        if(month&&year)monthRows.push({r,month,year});
      }
      if(monthRows.length){
        const latest=monthRows.slice().sort((a,b)=>(Number(b.year)-Number(a.year))||((monthsOrder[b.month]||0)-(monthsOrder[a.month]||0)))[0];
        const targetYear=latest.year,targetMonth=latest.month, grouped=new Map();
        for(const x of monthRows){if(x.year!==targetYear||x.month!==targetMonth)continue;const r=x.r,name=String(r[bidx['PRODUCTO']]??'').trim();if(!name)continue;const net=n(r[bidx['NETO']]),kg=n(r[bidx['SALIDA']]);if(!net&&!kg)continue;const key=canonicalFamily(name)||name.toUpperCase();const z=grouped.get(key)||{name:canonicalFamily(name)||name,neto:0,kg:0};z.neto+=net;z.kg+=kg;grouped.set(key,z)}
        // PATCH INE V45.4 — CAMBIO QUIRÚRGICO SOLO EN INE
        // Si Tabla dinámica2 está completa, los valores B:C:D:E:F son la fuente
        // de verdad. PROMEDIO (D) se COPIA del Excel y no se sustituye.
        const exact=calcIne([...grouped.values()],`${targetMonth} ${targetYear}`,{
          mode:'INE VENTAS · ESPEJO DEL MAESTRO',sourceType:'ventas-maestro',headerFound:true,missing:[],
          sourceSheet:'BASE DE DATOS',metric:'ine_sales_average',averageLabel:'Promedio INE',
          calculation:'Excel Maestro: VP X = NETO / Salida; la pauta INE expresa D = B/C, D15 = B15/C15 y B20 = B18/B19.'
        });
        Object.assign(ine,exact); let ineSource='BASE DE DATOS';
        if(ir.length){
          const rh=ir.findIndex(r=>String(r?.[0]||'').toUpperCase().includes('ETIQUETAS DE FILA'));
          if(rh>=0){
            const ref={}; let masterTotal=null, masterTotalNeto=null, masterTotalKg=null;
            let masterHarinas=null, masterHarinasNeto=null, masterHarinasKg=null;
            for(let i=rh+1;i<ir.length;i++){
              const raw=String(ir[i]?.[0]??'').trim(), label=raw.toUpperCase();
              if(/^TOTAL GENERAL$/i.test(raw)){
                masterTotalNeto=n(ir[i]?.[1]); masterTotalKg=n(ir[i]?.[2]); masterTotal=n(ir[i]?.[3]);
                continue;
              }
              const name=canonicalFamily(raw);
              if(name) ref[name]={neto:n(ir[i]?.[1]),kg:n(ir[i]?.[2]),promedio:n(ir[i]?.[3]),vn:n(ir[i]?.[4]),kgp:n(ir[i]?.[5])};
              if(label.includes('NETO HARINAS')) masterHarinasNeto=n(ir[i]?.[1]);
              if(label.includes('KG HARINAS')) masterHarinasKg=n(ir[i]?.[1]);
              if(label.includes('VALOR PROMEDIO HARINAS')) masterHarinas=n(ir[i]?.[1]);
            }
            const complete=INE_FAMILIES.every(name=>ref[name]) && masterTotal!=null;
            const diffs=[];
            if(complete){
              for(const name of INE_FAMILIES){
                const r=ref[name], expected=r.kg?r.neto/r.kg:0;
                if(Math.abs(expected-r.promedio)>0.000000001) diffs.push({name,excel:r.promedio,formula:expected});
              }
              if(masterTotalNeto!=null && masterTotalKg){
                const expected=masterTotalNeto/masterTotalKg;
                if(Math.abs(expected-masterTotal)>0.000000001) diffs.push({name:'TOTAL GENERAL',excel:masterTotal,formula:expected});
              }
              if(masterHarinas!=null && masterHarinasNeto!=null && masterHarinasKg){
                const expected=masterHarinasNeto/masterHarinasKg;
                if(Math.abs(expected-masterHarinas)>0.000000001) diffs.push({name:'VALOR PROMEDIO HARINAS',excel:masterHarinas,formula:expected});
              }
              // COPIA DIRECTA: Excel manda; la validación nunca sobrescribe.
              ine.items=INE_FAMILIES.map(name=>({...ref[name],name}));
              ine.totalNeto=masterTotalNeto; ine.totalKg=masterTotalKg; ine.totalPromedio=masterTotal;
              ine.netoHarinas=masterHarinasNeto; ine.kgHarinas=masterHarinasKg; ine.promedioHarinas=masterHarinas;
              ine.quality.sourceSheet=ineSourceSheet||'INE (2)'; ineSource=ineSourceSheet||'INE (2)';
              ine.quality.sourceOfTruth='INE (2) / Tabla dinámica2 — valores copiados directamente del Excel Maestro';
              ine.quality.referenceCheck={ok:diffs.length===0,differences:diffs};
              ine.quality.calculation='PROMEDIO COPIADO DIRECTAMENTE DEL EXCEL MAESTRO (INE (2), columna D). B/C se usa solo como auditoría de la fórmula VP X; nunca sustituye el valor almacenado en Excel.';
              ine.quality.masterFormulaProfile={...ine.quality.masterFormulaProfile,source:'INE (2) / Tabla dinámica2',promedio:'D = valor almacenado por Excel (VP X); NO recalcular',vn:'E = valor almacenado por Excel',kgp:'F = valor almacenado por Excel',totalPromedio:'D15 = valor almacenado por Excel',promedioHarinas:'B20 = valor almacenado por Excel',references:{families:'D7:D14',total:'D15',netoHarinas:'B18',kgHarinas:'B19',promedioHarinas:'B20'}};
              if(diffs.length) ine.quality.missing=[`ADVERTENCIA INE: ${diffs.length} valor(es) de Excel no coinciden exactamente con VP X. Se conserva el valor de Excel.`];
            }
            else {
              // No romper la app si cambia la estructura: conservar el respaldo exacto de V45.3.
              ine.quality.referenceCheck={ok:false,differences:[]};
              ine.quality.missing=[...(ine.quality.missing||[]),'ADVERTENCIA INE: Tabla dinámica2 incompleta; se conservó el respaldo exacto del Maestro.'];
            }
          }
        }
      }
    } else {
      // --- B) FUENTE INE (2): solo acepta las 8 filas entre encabezado y Total general ---
      const rh=existenceSheetName ? -1 : ir.findIndex(r=>String(r?.[0]||'').toUpperCase().includes('ETIQUETAS DE FILA'));
      if(rh>=0){
        const items=[]; let periodo=String(ir[2]?.[1]||'')+' '+String(ir[3]?.[1]||'');
        for(let i=rh+1;i<ir.length;i++){
          const name=canonicalFamily(ir[i]?.[0]);
          if(/^TOTAL GENERAL$/i.test(String(ir[i]?.[0]||'').trim()))break;
          if(!name)continue;
          items.push({name,neto:n(ir[i]?.[1]),kg:n(ir[i]?.[2])});
        }
        if(items.length){Object.assign(ine,calcIne(items,periodo.trim(),{mode:'INE/Pivot',sourceType:'ventas',headerFound:true,missing:[],sourceSheet:ineSourceSheet||'INE (2)',calculation:'INE (2): D = B/C; E = B/B15; F = C/C15; B15 = SUM(B7:B14); C15 = SUM(C7:C14); D15 = B15/C15; B18 = B7+B8+B9; B19 = C7+C8+C9; B20 = B18/B19.'}));}
      } else {
        // --- C) REGISTRO DE EXISTENCIA FÍSICO-VALORIZADO ---
        const regName=sheets.find(name=>rowsOf(name).slice(0,40).flat().some(v=>/REGISTRO\s+DE\s+EXISTENCIAS|FISICO\s*-\s*VALORIZADO|TOTAL\s+DISPONIBLE/i.test(String(v??''))));
        if(regName){
          ir=rowsOf(regName); ineSource=regName; const flat=ir.flat().map(v=>String(v??'').trim());
          const range=flat.find(v=>/Rango de fechas/i.test(v)), emission=flat.find(v=>/Fecha de emisión/i.test(v));
          const rm=range?.match(/Rango de fechas\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+al\s+(\d{1,2}\/\d{1,2}\/\d{4})/i); if(rm)ine.periodo=rm[1].split('/')[2]+'-'+rm[1].split('/')[1].padStart(2,'0');
          const headerKey=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9$]+/g,'');
          const header=ir.findIndex(r=>{const u=(r||[]).map(headerKey);return u.includes('INFO')&&u.includes('CODIGO')&&u.includes('ITEM')&&u.includes('TOTALDISPONIBLE')&&(u.some(x=>x.startsWith('TOTALDISPONIBLE'))||u.some(x=>x.startsWith('TOTALFISICO')));});
          if(header>=0){const h=(ir[header]||[]).map(headerKey),idx={};h.forEach((v,i)=>{if(v)idx[v]=i});ine.quality={mode:'Registro de Existencia',sourceType:'existencia',headerFound:true,missing:[],range:range||'',emissionDate:emission?.replace(/^.*?:\s*/,'')||''};const summary=[],detail=[];
            for(let i=header+1;i<ir.length;i++){const r=ir[i]||[],info=String(r[idx['INFO']]??'').trim(),name=String(r[idx['ITEM']]??'').trim();if(!name)continue;const x={name,code:String(r[idx['CODIGO']]??''),family:'',disponible:n(r[idx['TOTALDISPONIBLE']]),disponible$:n(r[idx['TOTALDISPONIBLE$']]),saldoAnterior:n(r[idx['SALDOANTERIOR']]),saldoAnterior$:n(r[idx['SALDOANTERIOR$']]),entrada:n(r[idx['ENTRADA']]),salida:n(r[idx['SALIDA']]),entrada$:n(r[idx['ENTRADA$']]),salida$:n(r[idx['SALIDA$']]),reservas:n(r[idx['RESERVAS']]),consignacion:n(r[idx['CONSIGNACION']]),transitoria:n(r[idx['TRANSITORIA']]),totalValorizado$:n(r[idx['TOTALVALORIZADO$']])};const mappedFamily=ineFamilyByCode(x.code,x.name);x.family=mappedFamily||'';if(info==='2')summary.push(x);else if(info==='1')detail.push(x)}
            const agg=new Map(INE_FAMILIES.map(name=>[name,{name,neto:0,kg:0,sourceCodes:new Set()}])),unmapped=[];
            for(const x of summary){const fam=ineFamilyByCode(x.code,x.name);if(!fam){if(x.disponible||x.disponible$)unmapped.push({code:x.code,name:x.name,kg:x.disponible,neto:x.disponible$});continue}const z=agg.get(fam);z.neto+=x.disponible$;z.kg+=x.disponible;if(x.code)z.sourceCodes.add(x.code)}
            const sourceTotalNeto=summary.reduce((a,x)=>a+x.disponible$,0);
            const sourceTotalKg=summary.reduce((a,x)=>a+x.disponible,0);
            const baseItems=INE_FAMILIES.map(name=>({...agg.get(name),sourceCodes:[...agg.get(name).sourceCodes]}));
            const exact=calcIne(baseItems,ine.periodo,{...ine.quality,calculation:'Registro Físico-Valorizado: INFO=2. Valor unitario stock = Total Disponible$ / Total Disponible. Es stock, no Promedio INE de ventas.',metric:'existence_unit_value',averageLabel:'Valor unitario stock',catalogSource:catalogFamilyByCode.size?'CODIGOS del Maestro':'catálogo de respaldo'});
            exact.items=(exact.items||[]).map(x=>({...x,stockUnitValue:n(x.promedio),promedio:null}));
            exact.totalStockUnitValue=divideSafe(exact.totalNeto,exact.totalKg);
            exact.stockUnitValueHarinas=divideSafe(exact.netoHarinas,exact.kgHarinas);
            // V46.7: existencia nunca usa el valor unitario stock como PROMEDIO INE.
            exact.totalPromedio=null;
            exact.promedioHarinas=null;
            exact.masterIneReferenceRequired=true;
            const sourceColumns={info:'A = Info',code:'B = Código',item:'C = Ítem',totalDisponible:'AC = Total Disponible',totalDisponible$:'AG = Total Disponible$',totalValorizado$:'AK = Total Valorizado$',costo:'W = Costo'};const formulaProfile={model:'EXISTENCIA_FISICO_VALORIZADA',summaryFilter:'INFO = 2',stockUnitValue:'Total Disponible$ / Total Disponible',valueColumn:'AG = Total Disponible$',kgColumn:'AC = Total Disponible',total:'suma de 8 familias',harinas:'1+2+3',salesIne:'VP X = NETO / Salida (separado)',masterIneRule:'PROMEDIO INE solo del Maestro del mismo período'};const checksum=hashText(JSON.stringify({periodKey:ine.periodo,summaryRows:summary.map(x=>({...x})),detailCount:detail.length}));ine.existenceBase={version:2,baseVersion:2,key:ine.periodo,periodKey:ine.periodo,summaryRows:summary.map(x=>({...x})),detailRows:detail.map(x=>({...x})),familyItems:baseItems.map(x=>({...x,sourceCodes:Array.isArray(x.sourceCodes)?[...x.sourceCodes]:[]})),sourceSheet:regName,range:range||'',emissionDate:emission?.replace(/^.*?:\s*/,'')||'',recordCountSummary:summary.length,recordCountDetail:detail.length,sourceColumns,formulaProfile,checksum};
            Object.assign(ine,exact);
            ine.quality.unmapped=unmapped;
            ine.quality.sourceOfTruth='Registro de Existencia Físico-Valorizado: filas INFO=2 + catálogo CODIGOS';
            ine.quality.usedForIne=true;
            ine.quality.sourceSummaryTotals={neto:sourceTotalNeto,kg:sourceTotalKg};
            ine.quality.mappingCoverage={neto:sourceTotalNeto?exact.totalNeto/sourceTotalNeto:1,kg:sourceTotalKg?exact.totalKg/sourceTotalKg:1,unmappedCount:unmapped.length};
            const coverageOk=unmapped.length===0 && Math.abs(exact.totalNeto-sourceTotalNeto)<=0.000001 && Math.abs(exact.totalKg-sourceTotalKg)<=0.000001;
            ine.quality.formulaAudit={...(ine.quality.formulaAudit||{}),ok:!!ine.quality.formulaAudit?.ok && coverageOk,coverageOk,sourceTotalsMatch:Math.abs(exact.totalNeto-sourceTotalNeto)<=0.000001 && Math.abs(exact.totalKg-sourceTotalKg)<=0.000001,existenceMapping:{value:'Total Disponible$',kg:'Total Disponible',unitValue:'Total Disponible$ / Total Disponible'},salesIneFormula:'VP X = NETO / Salida (separada del stock)',message:coverageOk?'Cálculo de stock validado: INFO=2, mapeo 100% contra CODIGOS y valor unitario = Total Disponible$ / Total Disponible.':`El cálculo de stock es válido, pero ${unmapped.length} código(s) no pudo/pudieron asignarse a las 8 familias.`};
            ine.quality.missing=coverageOk?[]:[...(ine.quality.missing||[]),`Cobertura INE del Registro de Existencia: ${(Math.min(ine.quality.mappingCoverage.neto,ine.quality.mappingCoverage.kg)*100).toFixed(2)}%.`];ine.inventory.saldoAnterior=summary.reduce((a,x)=>a+x.saldoAnterior,0);ine.inventory.saldoAnterior$=summary.reduce((a,x)=>a+x.saldoAnterior$,0);ine.inventory.entradaKg=detail.reduce((a,x)=>a+x.entrada,0);ine.inventory.salidaKg=detail.reduce((a,x)=>a+x.salida,0);ine.inventory.entrada$=detail.reduce((a,x)=>a+x.entrada$,0);ine.inventory.salida$=detail.reduce((a,x)=>a+x.salida$,0);ine.inventory.disponibleKg=ine.totalKg;ine.inventory.disponible$=ine.totalNeto;ine.inventory.reservasKg=summary.reduce((a,x)=>a+x.reservas,0);ine.inventory.consignacionKg=summary.reduce((a,x)=>a+x.consignacion,0);ine.inventory.transitoriaKg=summary.reduce((a,x)=>a+x.transitoria,0);ine.inventory.totalValorizado$=summary.reduce((a,x)=>a+x.totalValorizado$,0);
          } else ine.quality={mode:'',sourceType:'',headerFound:false,missing:['Se encontró un archivo, pero no se reconoció la tabla de Registro de Existencia.']};
        } else ine.quality={mode:'',sourceType:'',headerFound:false,missing:['No se encontró BASE DE DATOS, INE (2) ni un Registro de Existencia.']};
      }
    }

    // ---------- SACOS ----------
    post('Procesando INE, Sacos y Granel', 22);
    const sr = rowsPart('NESTLE SACOS');
    let ventasSacos = 0, kgSacos = 0;
    const sacItems = [];
    for (const r of sr) {
      if (String(r?.[1] || '') || String(r?.[2] || '')) {
        const v = n(r?.[3]);
        if (v || r?.[2]) sacItems.push({ clave: String(r?.[1] || ''), clasificacion: String(r?.[2] || ''), ventas: v });
      }
    }
    const totalRow = sr.find(r => String(r?.[1] || '').toUpperCase() === 'TOTAL GENERAL');
    ventasSacos = totalRow ? n(totalRow[3]) : sacItems.filter(x => x.clave !== 'N.A').reduce((s, x) => s + x.ventas, 0);
    const kgRow = sr.find(r => String(r?.[6] || '').toUpperCase().includes('TOTAL SACOS KG'));
    kgSacos = kgRow ? n(kgRow[7]) : 0;

    let granelItems = [];
    const primary = rowsPart('NESTLE Y CPW');
    for (const r of primary) {
      const prod = String(r?.[6] || '').trim();
      if (prod && /GRANEL/i.test(prod) && !/TOTAL/i.test(prod)) {
        const nums = (r.slice(7)).map(n);
        const kg = nums.reduce((a, b) => a + b, 0);
        if (kg) granelItems.push({ fuente: sheetPart('NESTLE Y CPW'), producto: prod, kg });
      }
    }
    let totalGranel = 0;
    const tg = primary.find(r => String(r?.[6] || '').toUpperCase().includes('TOTAL GRANEL'));
    if (tg) totalGranel = n(tg[7]); else totalGranel = granelItems.reduce((s, x) => s + x.kg, 0);

    // ---------- LIBRO ----------
    post('Procesando documentos y facturas', 38);
    const libroRows = rowsPart('LIBRO');
    const libroObjects = objects(libroRows, ['COD. SII', 'NRO. DOCTO.', 'FECHA'], 80000);
    const libroByFolio = new Map();
    for (const o of libroObjects) {
      const folio = String(get(o, ['NRO. DOCTO.', 'NRO. DOCTO', 'NRO']) || '').trim();
      if (!folio) continue;
      const key = norm(folio);
      libroByFolio.set(key, {
        fuente: sheetPart('LIBRO') || 'LIBRO',
        folio,
        fecha: get(o, ['FECHA']),
        tipo: get(o, ['TIPO']),
        cliente: get(o, ['NOMBRE CLIENTE', 'CLIENTE']),
        rut: get(o, ['R.U.T. CLIENTE', 'RUT']),
        estado: get(o, ['ESTADO']),
        codSii: get(o, ['COD. SII']),
        netoExento: n(get(o, ['NETO EXENTO'])),
        netoAfecto: n(get(o, ['NETO AFECTO', 'NETO'])),
        iva: n(get(o, ['I.V.A.', 'IVA'])),
        ivaHarina: n(get(o, ['IVA HARINA', 'IVA HARINAS'])),
        total: n(get(o, ['VALOR TOTAL', 'TOTAL'])),
      });
    }

    // ---------- BASE DE DATOS ----------
    const nameToRut = new Map();
    const rutToName = new Map();
    for (const ref of libroByFolio.values()) { const nn=normName(ref.cliente); const rr=norm(ref.rut); if(nn && rr && !nameToRut.has(nn)) nameToRut.set(nn,String(ref.rut)); if(rr && ref.cliente && !rutToName.has(rr)) rutToName.set(rr,String(ref.cliente)); }
    // Segunda pasada: resolver RUT↔cliente desde todas las filas de LIBRO, no solo folios únicos.
    for (const o of objects(libroRows, ['FOLIO'], 200000)) { const cliente=get(o,['NOMBRE CLIENTE','CLIENTE','RAZON SOCIAL']); const rut=get(o,['R.U.T. CLIENTE','RUT','RUT CLIENTE']); const nn=normName(cliente), rr=norm(rut); if(nn && rr && !nameToRut.has(nn)) nameToRut.set(nn,String(rut)); if(rr && cliente && !rutToName.has(rr)) rutToName.set(rr,String(cliente)); }

    const baseRows = rowsPart('BASE DE DATOS');
    const baseObjects = objects(baseRows, ['CODIGO', 'ITEM', 'FOLIO', 'ORIGEN/DESTINO'], 120000);
    const baseInvoiceLines = [];
    const baseBoletaLines = [];
    const productSet = new Set();
    for (const o of baseObjects) {
      const item = get(o, ['ÍTEM', 'ITEM']);
      const product = get(o, ['PRODUCTO']) || item || get(o, ['DETALLE']);
      if (item) productSet.add(String(item).trim());
      if (product) productSet.add(String(product).trim());
      const detail = get(o, ['DETALLE']);
      if (detail) productSet.add(String(detail).trim());
      const docType = get(o, ['DOCTO', 'TIPO']);
      const tipo = get(o, ['TIPO', 'AO', 'FT/BT']) || docType;
      const folio = String(get(o, ['FOLIO FINAL', 'FOLIO', 'NRO DOCTO']) || '').trim();
      const client = get(o, ['ORIGEN/DESTINO', 'NOMBRE CLIENTE', 'CLIENTE']);
      const docText = String(tipo || '') + ' ' + String(docType || '');
      const isInvoice = /FACTURA\s*\[FT\]|FACTURA|FT\b/i.test(docText);
      const isBoleta = /BOLETA|\bBT\b/i.test(docText);
      const line = {
        fuente: sheetPart('BASE DE DATOS') || 'BASE DE DATOS',
        fecha: get(o, ['FECHA DOCTO', 'FECHA']),
        folio,
        tipo: tipo || (isBoleta ? 'BOLETA' : 'Factura[FT]'),
        cliente: client,
        producto: product,
        detalle: detail,
        unidad: get(o, ['UM']),
        kg: n(get(o, ['SALIDA'])),
        sacos: n(get(o, ['VENTAS * SACOS'])),
        neto: n(get(o, ['NETO', 'AR'])),
        iva: n(get(o, ['IVA', 'AS'])),
        ivaHarina: n(get(o, ['IVA HARINAS', 'AT'])),
        total: n(get(o, ['BRUTO', 'AU'])),
        estado: get(o, ['ESTADO']),
        planta: get(o, ['PLANTA']),
        s_g: get(o, ['S/G']),
      };
      if (isInvoice && folio) baseInvoiceLines.push(line);
      if (isBoleta && folio) baseBoletaLines.push(line);
    }

    // ---------- DOCUMENTOS + CLIENTES ----------
    const documents = [];
    const pushDoc = d => { if (d.folio || d.cliente || d.rut || d.tipo) documents.push(d); };
    for (const o of libroObjects) {
      pushDoc({
        fuente: sheetPart('LIBRO') || 'LIBRO',
        fecha: get(o, ['FECHA']),
        folio: get(o, ['NRO. DOCTO.', 'NRO. DOCTO', 'NRO']),
        tipo: get(o, ['TIPO']),
        cliente: get(o, ['NOMBRE CLIENTE', 'CLIENTE']),
        rut: get(o, ['R.U.T. CLIENTE', 'RUT']),
        producto: get(o, ['PRODUCTO', 'DETALLE']),
        detalle: get(o, ['DETALLE']),
        netoExento: n(get(o, ['NETO EXENTO'])),
        neto: n(get(o, ['NETO AFECTO', 'NETO'])),
        iva: n(get(o, ['I.V.A.', 'IVA'])),
        ivaHarina: n(get(o, ['IVA HARINA', 'IVA HARINAS'])),
        total: n(get(o, ['VALOR TOTAL', 'TOTAL'])),
        estado: get(o, ['ESTADO']),
        codSii: get(o, ['COD. SII']),
        ref: '',
      });
    }
    const gn = sheetPart('GUIAS');
    if (gn) {
      for (const o of objects(rowsOf(gn), ['FOLIO', 'FECHA'], 50000)) {
        pushDoc({
          fuente: gn,
          fecha: get(o, ['FECHA']),
          folio: get(o, ['FOLIO']),
          tipo: get(o, ['TIPO OPER.','TIPO']),
          cliente: get(o, ['NOMBRE RECEPTOR','RECEPTOR']),
          rut: get(o, ['RUT RECEPTOR','RUT']),
          producto: get(o, ['PRODUCTO','DETALLE']),
          detalle: get(o, ['DETALLE']),
          netoExento: 0,
          neto: n(get(o, ['NETO'])),
          iva: n(get(o, ['IVA'])),
          ivaHarina: 0,
          total: n(get(o, ['TOTAL'])),
          estado: get(o, ['ESTADO']),
          codSii: '',
          ref: get(o, ['FOLIO DOC. REF.','FOLIO DOC']),
        });
      }
    }
    for (const x of baseInvoiceLines) pushDoc({ ...x, netoExento: 0, neto: x.neto, ivaHarina: x.ivaHarina, ref: '' });

    // ---------- CONTACTOS / DIRECCIONES ----------
    // Busca información de contacto si alguna hoja la contiene. Si no existe en el Excel,
    // el módulo Clientes permite registrarla manualmente y queda disponible para Despachos.
    const contactMap = new Map();
    const destinationMap = new Map();
    const allSheetsForContacts = sheets;
    const addDestination = (key, value) => {
      const v = String(value ?? '').trim();
      if (!key || !v || v.length < 3) return;
      const list = destinationMap.get(key) || [];
      if (!list.some(x => normName(x) === normName(v))) list.push(v);
      destinationMap.set(key, list);
    };
    const contactObjects = (rows, max=15000) => objects(rows, ['NOMBRE CLIENTE','CLIENTE','NOMBRE RECEPTOR','RECEPTOR','ORIGEN/DESTINO','DIRECCION','DIRECCIÓN','DOMICILIO','COMUNA','TELEFONO','TELÉFONO','CONTACTO'], max);
    const hasContactHeaders = rows => { const txt=(rows.slice(0,35).map(r=>(r||[]).map(v=>String(v??'').toUpperCase()).join(' | ')).join(' || ')); return /(DIRECC|DOMICIL|COMUNA|TELEF|FONO|CONTACTO|CIUDAD|REGION|REGIÓN)/.test(txt) && /(CLIENTE|RECEPTOR|ORIGEN\/DESTINO|RAZON SOCIAL)/.test(txt); };
    for (const sh of allSheetsForContacts) {
      const rows = rowsOf(sh);
      if (!hasContactHeaders(rows)) continue;
      const objs = contactObjects(rows, 15000);
      for (const o of objs) {
        const nombre = get(o,['NOMBRE CLIENTE','CLIENTE','NOMBRE RECEPTOR','RECEPTOR','ORIGEN/DESTINO','RAZON SOCIAL']);
        const rut = get(o,['R.U.T. CLIENTE','RUT RECEPTOR','RUT','RUT CLIENTE']);
        const key = norm(rut) || normName(nombre);
        if (!key) continue;
        const direccion = get(o,['DIRECCIÓN DE DESPACHO','DIRECCION DE DESPACHO','DIRECCIÓN ENTREGA','DIRECCION ENTREGA','DESTINO','DIRECCIÓN','DIRECCION','DOMICILIO','ADDRESS','CALLE']);
        const comuna = get(o,['COMUNA','CIUDAD','LOCALIDAD']);
        const destinoExcel = get(o,['DESTINO','DIRECCIÓN DE DESPACHO','DIRECCION DE DESPACHO','DIRECCIÓN ENTREGA','DIRECCION ENTREGA']);
        const region = get(o,['REGIÓN','REGION']);
        const contacto = get(o,['CONTACTO','NOMBRE CONTACTO']);
        const telefono = get(o,['TELÉFONO','TELEFONO','FONO','CELULAR']);
        const email = get(o,['EMAIL','CORREO']);
        if (destinoExcel) addDestination(key, destinoExcel);
        if (direccion) addDestination(key, direccion);
        if (direccion || comuna || region || contacto || telefono || email) {
          const prev = contactMap.get(key) || {};
          contactMap.set(key,{direccion:direccion||prev.direccion||'',comuna:comuna||prev.comuna||'',region:region||prev.region||'',contacto:contacto||prev.contacto||'',telefono:telefono||prev.telefono||'',email:email||prev.email||''});
        }
      }
    }

    const clientsMap = new Map();
    const addClient = (rut, nombre, doc) => {
      const resolvedRut = rut || (nombre ? nameToRut.get(normName(nombre)) : '') || '';
      const key = norm(resolvedRut || nombre);
      if (!key) return;
      if (!clientsMap.has(key)) clientsMap.set(key, { key, rut: String(resolvedRut || ''), nombre: String(nombre || rutToName.get(norm(resolvedRut)) || '').trim() || '(Sin nombre)', documentos: [], neto: 0, iva: 0, total: 0 });
      const c = clientsMap.get(key);
      if (resolvedRut && !c.rut) c.rut = String(resolvedRut);
      if (nombre && (!c.nombre || c.nombre === '(Sin nombre)')) c.nombre = String(nombre).trim();
      if (doc) { c.documentos.push(doc); c.neto += n(doc.neto); c.iva += n(doc.iva); c.total += n(doc.total); }
    };
    for (const d of documents) if (d.rut || d.cliente) addClient(d.rut, d.cliente, d);

    // Enriquecer base-invoices con RUT/cliente oficial de LIBRO cuando coincida el folio.
    for (const inv of baseInvoiceLines) {
      const ref = libroByFolio.get(norm(inv.folio));
      if (ref) { inv.rut = inv.rut || ref.rut; inv.cliente = inv.cliente || ref.cliente; if (!inv.fecha) inv.fecha = ref.fecha; }
      if (!inv.rut && inv.cliente) inv.rut = nameToRut.get(normName(inv.cliente)) || '';
      if (!inv.cliente && inv.rut) inv.cliente = rutToName.get(norm(inv.rut)) || '';
    }

    // ---------- FACTURAS AGRUPADAS ----------
    post('Organizando facturas y productos', 68);
    const invoiceMap = new Map();
    for (const line of baseInvoiceLines) {
      const key = norm(line.folio);
      if (!invoiceMap.has(key)) invoiceMap.set(key, { folio: line.folio, fecha: line.fecha, tipo: 'FACTURA', cliente: line.cliente || '', rut: line.rut || '', productos: new Set(), items: [], lineas: 0, sacos: 0, kg: 0, neto: 0, iva: 0, ivaHarina: 0, total: 0, fuente: line.fuente, estado: line.estado || '' });
      const inv = invoiceMap.get(key);
      if (line.producto) inv.productos.add(String(line.producto));
      inv.lineas += 1; inv.sacos += n(line.sacos); inv.kg += n(line.kg); inv.neto += n(line.neto); inv.iva += n(line.iva); inv.ivaHarina += n(line.ivaHarina); inv.total += n(line.total); inv.items.push({producto:line.producto||'',detalle:line.detalle||'',unidad:line.unidad||'',kg:n(line.kg),sacos:n(line.sacos),neto:n(line.neto),iva:n(line.iva),total:n(line.total)});
      if (!inv.rut && line.rut) inv.rut = line.rut;
      if (!inv.cliente && line.cliente) inv.cliente = line.cliente;
      if (!inv.fecha && line.fecha) inv.fecha = line.fecha;
    }
    for (const [key, ref] of libroByFolio.entries()) {
      if (!/FACTURA/i.test(String(ref.tipo || ''))) continue;
      if (![...invoiceMap.values()].some(x => norm(x.folio) === key)) {
        invoiceMap.set(key + '|LIBRO', { folio: ref.folio, fecha: ref.fecha, tipo: 'FACTURA', cliente: ref.cliente || '', rut: ref.rut || '', productos: new Set(), items: [], lineas: 0, sacos: 0, kg: 0, neto: ref.netoAfecto, iva: ref.iva, ivaHarina: ref.ivaHarina, total: ref.total, fuente: ref.fuente, estado: ref.estado || '' });
      }
    }
    const invoices = [...invoiceMap.values()].map(x => ({ ...x, rut: x.rut || nameToRut.get(normName(x.cliente)) || '', cliente: x.cliente || rutToName.get(norm(x.rut)) || '', productos: [...x.productos].filter(Boolean), items:x.items||[] })).sort((a,b)=>{const da=dateISO(a.fecha),db=dateISO(b.fecha);return (db||'').localeCompare(da||'')||String(b.folio).localeCompare(String(a.folio),'es',{numeric:true})});

    // ---------- BOLETAS AGRUPADAS CON DETALLE ----------
    // Prioriza BASE DE DATOS para el detalle de productos/cantidades. LIBRO se usa
    // como respaldo cuando una boleta no tiene líneas detalladas en BASE DE DATOS.
    const boletaMap = new Map();
    const addBoletaLine = line => {
      const folio = String(line.folio || '').trim();
      if (!folio) return;
      const key = norm(folio);
      if (!boletaMap.has(key)) boletaMap.set(key, { folio, fecha: line.fecha || '', cliente: line.cliente || '', rut: line.rut || '', items: [], lineas: 0, kg: 0, sacos: 0, neto: 0, iva: 0, total: 0, fuente: line.fuente || 'BASE DE DATOS', estado: line.estado || '' });
      const b = boletaMap.get(key);
      if (line.producto || line.detalle || line.kg || line.sacos) b.items.push({ producto: line.producto || '', detalle: line.detalle || '', unidad: line.unidad || '', kg: n(line.kg), sacos: n(line.sacos), cantidad: n(line.sacos) || n(line.kg) });
      b.lineas += 1; b.kg += n(line.kg); b.sacos += n(line.sacos); b.neto += n(line.neto); b.iva += n(line.iva); b.total += n(line.total);
      if (!b.cliente && line.cliente) b.cliente = line.cliente;
      if (!b.rut && line.rut) b.rut = line.rut;
      if (!b.fecha && line.fecha) b.fecha = line.fecha;
    };
    for (const line of baseBoletaLines) {
      const ref = libroByFolio.get(norm(line.folio));
      if (ref) { line.rut = line.rut || ref.rut; line.cliente = line.cliente || ref.cliente; if (!line.fecha) line.fecha = ref.fecha; }
      if (!line.rut && line.cliente) line.rut = nameToRut.get(normName(line.cliente)) || '';
      if (!line.cliente && line.rut) line.cliente = rutToName.get(norm(line.rut)) || '';
      addBoletaLine(line);
    }
    for (const d of documents) {
      if (!/BOLETA|\bBT\b/i.test(String(d.tipo || ''))) continue;
      const key = norm(d.folio);
      if (!boletaMap.has(key)) addBoletaLine(d);
    }
    const boletas = [...boletaMap.values()].map(b => ({...b, items: b.items.filter(x => x.producto || x.detalle || x.kg || x.sacos)})).sort((a,b) => { const da=dateISO(a.fecha), db=dateISO(b.fecha); return (db||'').localeCompare(da||'') || String(b.folio).localeCompare(String(a.folio),'es',{numeric:true}); });

    // Products: source real names plus manual fallbacks used by the operation.
    ['HARINA GRANEL','HARINA 25 KG','HARINA 10 KG','HARINILLA','GRITZ SEMOL','H.F. MAIZ','ZOOTECNICA','GERMEN','SEMOLINA','GRITZ MEDI','SALVADO','OSN'].forEach(x=>productSet.add(x));
    for (const x of ine.items) if (x.name) productSet.add(String(x.name).trim());
    for (const x of sacItems) if (x.clasificacion) productSet.add(String(x.clasificacion).trim());
    for (const x of granelItems) if (x.producto) productSet.add(String(x.producto).trim());
    for (const x of documents) if (x.producto) productSet.add(String(x.producto).trim());
    const products = [...productSet].filter(Boolean).sort((a,b)=>a.localeCompare(b,'es'));

    // ---------- GUIAS / NC / IVA ----------
    post('Construyendo guías, notas e IVA', 82);
    const guides = [];
    if (gn) for (const o of objects(rowsOf(gn), ['FOLIO', 'FECHA'], 50000)) guides.push({
      folio: get(o,['FOLIO']), fecha: get(o,['FECHA']), estado: get(o,['ESTADO']), operacion: get(o,['TIPO OPER.','TIPO']), rut: get(o,['RUT RECEPTOR','RUT']), receptor: get(o,['NOMBRE RECEPTOR']), neto: n(get(o,['NETO'])), iva: n(get(o,['IVA'])), total: n(get(o,['TOTAL'])), ref: get(o,['FOLIO DOC. REF.','FOLIO DOC'])
    });
    const nc = documents.filter(d => /CREDITO|DEBITO|NOTA DE CREDITO|NOTA DE DEBITO/i.test(String(d.tipo || '')));
    const iv = documents.filter(d=>d.fuente===sheetPart('LIBRO')).reduce((a,d)=>({neto:a.neto+n(d.neto),iva:a.iva+n(d.iva),total:a.total+n(d.total),docs:a.docs+1}),{neto:0,iva:0,total:0,docs:0});

    // ---------- ORDEN + RIESGO DE CRÉDITO ----------
    const latestFirst = rows => [...(rows||[])].sort((a,b)=>{
      const da=dateISO(a.fecha), db=dateISO(b.fecha);
      return (db||'').localeCompare(da||'') || String(b.folio||'').localeCompare(String(a.folio||''),'es',{numeric:true});
    });
    const computeRisk = (client, clientInvoices) => {
      const invs = clientInvoices || [];
      const docs = client.documentos || [];
      const invoiceTotal = invs.reduce((a,i)=>a+Math.abs(n(i.total)),0);
      const nc = docs.filter(d=>/CREDITO|DEBITO|NOTA DE CREDITO|NOTA DE DEBITO/i.test(String(d.tipo||'')));
      const ncAbs = nc.reduce((a,d)=>a+Math.abs(n(d.total)),0);
      const today = Date.now();
      const recent90 = invs.filter(i=>{const d=dateISO(i.fecha); if(!d)return false; const delta=today-Date.parse(d+'T23:59:59'); return delta>=0 && delta<=90*86400000;}).length;
      const recent180 = invs.filter(i=>{const d=dateISO(i.fecha); if(!d)return false; const delta=today-Date.parse(d+'T23:59:59'); return delta>=0 && delta<=180*86400000;}).length;
      const contactFields = Number(!!client.direccion)+Number(!!client.telefono||!!client.email)+Number(!!client.comuna);
      let score=50;
      if(client.rut)score+=10;else score-=10;
      if(contactFields>=2)score+=10;else if(contactFields===1)score+=4;else score-=5;
      if(invs.length>=10)score+=12;else if(invs.length>=5)score+=9;else if(invs.length>=1)score+=4;else score-=15;
      if(recent90>=3)score+=10;else if(recent90>=1)score+=6;else if(recent180>=1)score+=2;else score-=15;
      if(invoiceTotal>=10000000)score+=5;
      const ratio=invoiceTotal?ncAbs/invoiceTotal:0;
      if(ratio>0.15)score-=18;else if(ratio>0.08)score-=8;
      if(nc.length>=5)score-=12;else if(nc.length>=3)score-=6;
      score=Math.max(0,Math.min(100,Math.round(score)));
      const level=score>=75?'BAJO':score>=55?'MEDIO':'ALTO';
      const alerts=[];
      if(!client.rut)alerts.push('RUT no informado o no vinculado.');
      if(!client.direccion)alerts.push('Falta dirección de despacho/contacto.');
      if(!client.telefono&&!client.email)alerts.push('Falta contacto telefónico o correo.');
      if(!invs.length)alerts.push('Sin historial de facturas suficiente.');
      else if(!recent180)alerts.push('Sin compras en los últimos 180 días.');
      if(ratio>0.08)alerts.push(`Notas de crédito/débito: ${(ratio*100).toFixed(1)}% del total histórico.`);
      if(nc.length>=3)alerts.push(`${nc.length} notas de crédito/débito registradas.`);
      return {score,level,alerts,invoices:invs.length,recent90,recent180,ncCount:nc.length,ncRatio:ratio,advice:level==='BAJO'?'Crédito favorable según los datos disponibles.':level==='MEDIO'?'Crédito posible con revisión y condiciones.':'Requiere revisión antes de liberar crédito.'};
    };

    post('Finalizando índices locales', 96);
    documents.splice(0, documents.length, ...latestFirst(documents));
    guides.splice(0, guides.length, ...latestFirst(guides));
    nc.splice(0, nc.length, ...latestFirst(nc));
    const clients = [...clientsMap.values()].map(c=>{
      const ck=norm(c.rut)||normName(c.nombre); const m=contactMap.get(ck)||{};
      const client={...c,direccion:m.direccion||'',comuna:m.comuna||'',region:m.region||'',contacto:m.contacto||'',telefono:m.telefono||'',email:m.email||'',destinos:[...(destinationMap.get(ck)||[])]};
      const fallbackDestination=[client.direccion,client.comuna,client.region].filter(Boolean).join(', ');
      if (fallbackDestination && !client.destinos.some(x=>normName(x)===normName(fallbackDestination))) client.destinos.push(fallbackDestination);
      const invs=invoices.filter(inv=>(client.rut && norm(inv.rut)===norm(client.rut)) || (!client.rut && normName(inv.cliente)===normName(client.nombre)));
      client.latestPurchase=invs.length?invs[0].fecha:'';
      client.invoiceCount=invs.length;
      client.creditRisk=computeRisk(client,invs);
      return client;
    }).sort((a,b)=>{const da=dateISO(a.latestPurchase),db=dateISO(b.latestPurchase);return (db||'').localeCompare(da||'')||a.nombre.localeCompare(b.nombre,'es')});
    const snapshot = {
      version: '40.0',
      fileName: e.data.fileName || 'Maestro Excel',
      lastLoaded: Date.now(),
      sheets,
      metrics: { ine, sacos: { ventasSacos, kgSacos, items: sacItems }, granel: { totalGranel, items: granelItems }, iva: iv },
      documents,
      clients,
      guides,
      nc,
      invoices,
      boletas,
      products,
      destinations: [...new Set(clients.flatMap(c=>c.destinos||[]))].sort((a,b)=>a.localeCompare(b,'es')),
      meta: { documentCount: documents.length, invoiceCount: invoices.length, boletaCount: boletas.length, guideCount: guides.length, clientCount: clients.length }
    };
    self.postMessage({ type: 'result', snapshot });
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
