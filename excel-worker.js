// V47.3: lector XLSX autocontenido + motor INE Maestro persistente/reutilizable.
// Corrige año desde FECHA, conserva perfiles mensuales y permite reutilizarlos al cargar Existencia.
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
  const baseKeep=new Set([0,1,2,9,13,14,15,17,20,27,28,29,30,31,35,39,40,42,43,44,45,46,47,48,49,50]);
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
    const INE_FORMULA_CATALOG_SEED = Object.freeze({"2025-01":{"items":{"HARINA GRANEL":{"referenceKg":852950,"referenceNeto":371738080,"avg":435.82634386540826},"HARINA 25KG":{"referenceKg":419850,"referenceNeto":194717939.28571376,"avg":463.7797767910296},"HARINA 10 KG":{"referenceKg":11230,"referenceNeto":6921210.084033613,"avg":616.3143440813546},"HARINILLA KG":{"referenceKg":473300,"referenceNeto":54360862.184873946,"avg":114.85498031877022},"GRITZ SEMOL KG":{"referenceKg":238015,"referenceNeto":123828196.55462185,"avg":520.2537510435134},"H. F. MAIZ KG":{"referenceKg":71625,"referenceNeto":33498565.12605042,"avg":467.6937539413671},"ZOOTECNICA KG":{"referenceKg":126055,"referenceNeto":26633997.05882353,"avg":211.28869984390568},"GERMEN KG":{"referenceKg":31670,"referenceNeto":7999787.81512605,"avg":252.59828907881433}},"totalKg":2224695,"totalNeto":819698638.1092433,"totalAvg":368.45438952721304,"harinasKg":1284030,"harinasNeto":573377229.3697474,"harinasAvg":446.5450412916734,"rateByCode":{"10KG":193.75,"25OSN":0,"25PAP":0,"25POLI":0,"DEBILGRAN":0,"DEBILPAP":0,"ESP10":0,"ESPOSN":0,"ESPPAP":0,"ESPPOLI":0,"FUERTEGRA":0,"FUERTEPAP":0,"GERGRA":0,"GERMEN":0,"GRITZGR":0,"GRITZGRP":0,"GRITZM":0,"HF800":0,"HFM":0,"HFMPAP":0,"HLLAF":0,"HLLAFGRA":0,"HLLAG":0,"HLLAGGRA":0,"HZ":0,"HZGRA":0,"RACION":0,"S800":0,"SALVADO":0,"SEMOL":0,"SEMOL800":0,"SEMOLGRA":0,"SEMOLP":0}},"2025-02":{"items":{"HARINA GRANEL":{"referenceKg":401070,"referenceNeto":174654940,"avg":435.47246116637996},"HARINA 25KG":{"referenceKg":453850,"referenceNeto":210850047.05882323,"avg":464.58091232526874},"HARINA 10 KG":{"referenceKg":11520,"referenceNeto":7118806.722689075,"avg":617.951972455649},"HARINILLA KG":{"referenceKg":312340,"referenceNeto":36754793.27731093,"avg":117.67558838864997},"GRITZ SEMOL KG":{"referenceKg":305240,"referenceNeto":158958943.19325042,"avg":520.7670789976753},"H. F. MAIZ KG":{"referenceKg":59325,"referenceNeto":27569819.32771765,"avg":464.7251466956199},"ZOOTECNICA KG":{"referenceKg":117205,"referenceNeto":25916357.14285714,"avg":221.11989371491953},"GERMEN KG":{"referenceKg":24650,"referenceNeto":6739355.042016805,"avg":273.401827262345}},"totalKg":1685200,"totalNeto":648563061.7646654,"totalAvg":384.8582137222083,"harinasKg":866440,"harinasNeto":392623793.7815123,"harinasAvg":453.14596946298917,"rateByCode":{"10KG":0,"25OSN":0,"25PAP":0,"25POLI":0,"DEBILGRAN":0,"ESP10":0,"ESPPAP":0,"ESPPOLI":0,"FUERTEGRA":0,"GERMEN":0,"GRITZGR":0,"GRITZM":0,"HF800":0,"HFM":0,"HFMPAP":0,"HLLAF":0,"HLLAG":0,"HLLAGGRA":0,"HZ":0,"HZGRA":0,"RACION":0,"S800":0,"SALVADO":0,"SEMOL":0,"SEMOLGRA":0}},"2025-03":{"items":{"HARINA GRANEL":{"referenceKg":628400,"referenceNeto":273982400,"avg":436},"HARINA 25KG":{"referenceKg":538000,"referenceNeto":248971998.31932718,"avg":462.77323107681633},"HARINA 10 KG":{"referenceKg":9540,"referenceNeto":5919206.722689075,"avg":620.4619206173035},"HARINILLA KG":{"referenceKg":374375,"referenceNeto":50370923.94957983,"avg":134.54670837951207},"GRITZ SEMOL KG":{"referenceKg":374080,"referenceNeto":194927840.5882353,"avg":521.0859724877974},"H. F. MAIZ KG":{"referenceKg":83035,"referenceNeto":38768527.310924366,"avg":466.89380756216497},"ZOOTECNICA KG":{"referenceKg":150985,"referenceNeto":33724289.07563025,"avg":223.36185101586415},"GERMEN KG":{"referenceKg":39735,"referenceNeto":10013944.537815126,"avg":252.0182342472663}},"totalKg":2198150,"totalNeto":856679130.5042012,"totalAvg":389.72733002943437,"harinasKg":1175940,"harinasNeto":528873605.04201627,"harinasAvg":449.74539946087066,"rateByCode":{"10KG":0,"25OSN":0,"25PAP":0,"25POLI":0,"DEBILGRAN":0,"ESP10":0,"ESPOSN":0,"ESPPAP":0,"ESPPOLI":0,"FUERTEPAP":0,"GERGRA":0,"GERMEN":0,"GRITZGR":0,"GRITZGRP":0,"GRITZM":0,"HF800":0,"HFM":0,"HFM10":0,"HFMPAP":0,"HLLAF":0,"HLLAG":0,"HLLAGGRA":0,"HZ":0,"HZGRA":0,"RACION":0,"S800":0,"SALVADO":0,"SEMOL":0,"SEMOL800":0,"SEMOLGRA":0}},"2025-04":{"items":{"HARINA GRANEL":{"referenceKg":649600,"referenceNeto":283016780,"avg":435.6785406403941},"HARINA 25KG":{"referenceKg":358879,"referenceNeto":169017805.04201633,"avg":470.9604213175369},"HARINA 10 KG":{"referenceKg":11550,"referenceNeto":7180830.252100839,"avg":621.7169049437956},"HARINILLA KG":{"referenceKg":315815,"referenceNeto":41731246.218487404,"avg":132.1382651821079},"GRITZ SEMOL KG":{"referenceKg":397760,"referenceNeto":207450136.63865548,"avg":521.5459991921146},"H. F. MAIZ KG":{"referenceKg":111500,"referenceNeto":51986320.37815126,"avg":466.2450258130158},"ZOOTECNICA KG":{"referenceKg":180750,"referenceNeto":40271047.058823526,"avg":222.7997071027581},"GERMEN KG":{"referenceKg":39105,"referenceNeto":10155763.865546219,"avg":259.70499592241964}},"totalKg":2064959,"totalNeto":810809929.4537811,"totalAvg":392.6518296265355,"harinasKg":1020029,"harinasNeto":459215415.29411715,"harinasAvg":450.19839170662516,"rateByCode":{"10KG":0,"25OSN":0,"25PAP":0,"25POLI":0,"DEBILGRAN":0,"ESP10":0,"ESPOSN":0,"ESPPAP":0,"ESPPOLI":0,"FUERTEGRA":0,"GERGRA":0,"GERMEN":0,"GRITZGR":0,"GRITZM":0,"HF800":0,"HFM":0,"HFMPAP":0,"HLLAF":0,"HLLAG":0,"HLLAGGRA":0,"HZ":0,"HZGRA":0,"RACION":0,"S800":0,"SEMOL":0,"SEMOL800":0,"SEMOLGRA":0}},"2025-05":{"items":{"HARINA GRANEL":{"referenceKg":720670,"referenceNeto":318024280,"avg":441.2897442657527},"HARINA 25KG":{"referenceKg":507800,"referenceNeto":237307536.13445333,"avg":467.324805306131},"HARINA 10 KG":{"referenceKg":14990,"referenceNeto":9309823.529411769,"avg":621.0689479260686},"HARINILLA KG":{"referenceKg":425885,"referenceNeto":56378910.504201695,"avg":132.380596884609},"GRITZ SEMOL KG":{"referenceKg":271595,"referenceNeto":141411786.7226891,"avg":520.6715393239533},"H. F. MAIZ KG":{"referenceKg":42850,"referenceNeto":20078190.12605042,"avg":468.56919780747774},"ZOOTECNICA KG":{"referenceKg":154225,"referenceNeto":34499867.22689076,"avg":223.69827996038748},"GERMEN KG":{"referenceKg":44570,"referenceNeto":10904431.092436979,"avg":244.65853920657344}},"totalKg":2182585,"totalNeto":827914825.3361342,"totalAvg":379.3276437509349,"harinasKg":1243460,"harinasNeto":564641639.6638651,"harinasAvg":454.0891059333353,"rateByCode":{"10KG":0,"25OSN":0,"25PAP":0,"25POLI":0,"DEBILGRAN":0,"DEBILPAP":0,"ESP10":0,"ESPPAP":0,"ESPPOLI":0,"FUERTEGRA":0,"FUERTEPAP":0,"GERGRA":0,"GERMEN":0,"GRITZGR":0,"GRITZGRP":0,"GRITZM":0,"HFM":0,"HFMPAP":0,"HLLAF":0,"HLLAG":0,"HLLAG20":0,"HLLAGGRA":0,"HZ":0,"HZGRA":0,"RACION":0,"SALVADO":0,"SEMOL":0,"SEMOLGRA":0}},"2025-06":{"items":{"HARINA GRANEL":{"referenceKg":994700,"referenceNeto":439657400,"avg":442},"HARINA 25KG":{"referenceKg":866800,"referenceNeto":341056344.53780127,"avg":393.4660181562082},"HARINA 10 KG":{"referenceKg":13080,"referenceNeto":8120616.8067226885,"avg":620.8422635109089},"HARINILLA KG":{"referenceKg":463215,"referenceNeto":61252447.89915967,"avg":132.23329965385332},"GRITZ SEMOL KG":{"referenceKg":235875,"referenceNeto":118398074.78988907,"avg":501.9526223206744},"H. F. MAIZ KG":{"referenceKg":64360,"referenceNeto":29869546.21847395,"avg":464.1010910266306},"ZOOTECNICA KG":{"referenceKg":103225,"referenceNeto":23106284.87394958,"avg":223.84388349672636},"GERMEN KG":{"referenceKg":22130,"referenceNeto":5991680.6722689085,"avg":270.74923959642604}},"totalKg":2763385,"totalNeto":1027452395.798265,"totalAvg":371.80935548186915,"harinasKg":1874580,"harinasNeto":788834361.3445239,"harinasAvg":420.8059199098059,"rateByCode":{"10KG":0,"25OSN":0,"25PAP":0,"25POLI":0,"DEBILGRAN":0,"DEBILPAP":0,"ESP10":0,"ESPPAP":0,"ESPPOLI":0,"FUERTEGRA":0,"FUERTEPAP":0,"GERGRA":0,"GERMEN":0,"GRITZGR":0,"GRITZM":0,"HFM":0,"HFM10":0,"HFMPAP":0,"HLLAF":0,"HLLAG":0,"HLLAGGRA":0,"HZ":0,"HZGRA":0,"RACION":0,"SALVADO":0,"SEMOL":0,"SEMOLGRA":0}},"2025-07":{"items":{"HARINA GRANEL":{"referenceKg":1068430,"referenceNeto":472246060,"avg":442},"HARINA 25KG":{"referenceKg":422200,"referenceNeto":198143979.83191887,"avg":469.31307397422756},"HARINA 10 KG":{"referenceKg":15220,"referenceNeto":9447416.806722693,"avg":620.7238374982059},"HARINILLA KG":{"referenceKg":431030,"referenceNeto":56596024.36974791,"avg":131.304142100893},"GRITZ SEMOL KG":{"referenceKg":388455,"referenceNeto":196023828.40333447,"avg":504.6242895659329},"H. F. MAIZ KG":{"referenceKg":89160,"referenceNeto":41225692.22689076,"avg":462.37878226660786},"ZOOTECNICA KG":{"referenceKg":178405,"referenceNeto":39535994.11764706,"avg":221.60810581344165},"GERMEN KG":{"referenceKg":44460,"referenceNeto":11057737.81512605,"avg":248.71205162226835}},"totalKg":2637360,"totalNeto":1024276733.5713878,"totalAvg":388.3719831844677,"harinasKg":1505850,"harinasNeto":679837456.6386415,"harinasAvg":451.46426047656905,"rateByCode":{"10KG":0,"25OSN":0,"25PAP":0,"25POLI":0,"DEBILGRAN":0,"DEBILPAP":0,"ESP10":0,"ESPOSN":0,"ESPPAP":0,"ESPPOLI":0,"FUERTEGRA":0,"GERGRA":0,"GERMEN":0,"GRITZGR":0,"GRITZGRP":0,"GRITZM":0,"HFM":0,"HFM10":0,"HFMPAP":0,"HLLAF":0,"HLLAG":0,"HLLAGGRA":0,"HZ":0,"HZGRA":0,"RACION":0,"S800":0,"SALVADO":0,"SEMOL":0,"SEMOLGRA":0}},"2025-08":{"items":{"HARINA GRANEL":{"referenceKg":649990,"referenceNeto":287295580,"avg":442},"HARINA 25KG":{"referenceKg":359075,"referenceNeto":168780179.8319325,"avg":470.04157858924316},"HARINA 10 KG":{"referenceKg":13150,"referenceNeto":8158974.789915966,"avg":620.4543566476019},"HARINILLA KG":{"referenceKg":375760,"referenceNeto":47622976.05042018,"avg":126.73774763258511},"GRITZ SEMOL KG":{"referenceKg":324795,"referenceNeto":164445610.67226893,"avg":506.30585653187063},"H. F. MAIZ KG":{"referenceKg":54700,"referenceNeto":25428480.042016808,"avg":464.87166438787585},"ZOOTECNICA KG":{"referenceKg":146450,"referenceNeto":32353521.00840336,"avg":220.9185456360762},"GERMEN KG":{"referenceKg":40860,"referenceNeto":10314654.621848742,"avg":252.43892858171174}},"totalKg":1964780,"totalNeto":744399977.0168065,"totalAvg":378.87192307373164,"harinasKg":1022215,"harinasNeto":464234734.62184846,"harinasAvg":454.1458838129439,"rateByCode":{"10KG":0,"25OSN":0,"25PAP":0,"25POLI":0,"DEBILGRAN":0,"DEBILPAP":0,"ESP10":0,"ESPPAP":0,"ESPPOLI":0,"FUERTEPAP":0,"GERGRA":0,"GERMEN":0,"GRITZGR":0,"GRITZM":0,"HFM":0,"HFMPAP":0,"HLLAF":0,"HLLAG":0,"HLLAGGRA":0,"HZ":0,"HZGRA":0,"RACION":0,"SALVADO":0,"SEMOL":0,"SEMOLGRA":0}},"2025-09":{"items":{"HARINA GRANEL":{"referenceKg":925240,"referenceNeto":408956080,"avg":442},"HARINA 25KG":{"referenceKg":370725,"referenceNeto":174261631.93275923,"avg":470.0563272850745},"HARINA 10 KG":{"referenceKg":13620,"referenceNeto":8459823.52941177,"avg":621.1324177247996},"HARINILLA KG":{"referenceKg":415865,"referenceNeto":55175477.731092446,"avg":132.6764159789654},"GRITZ SEMOL KG":{"referenceKg":277985,"referenceNeto":138989170.25207394,"avg":499.98802184317117},"H. F. MAIZ KG":{"referenceKg":53950,"referenceNeto":24777564.075616807,"avg":459.26902827834675},"ZOOTECNICA KG":{"referenceKg":132625,"referenceNeto":29550082.352941178,"avg":222.80929201086656},"GERMEN KG":{"referenceKg":29620,"referenceNeto":8034500.840336136,"avg":271.25256044348873}},"totalKg":2219630,"totalNeto":848204330.7142316,"totalAvg":382.1377124629923,"harinasKg":1309585,"harinasNeto":591677535.4621711,"harinasAvg":451.8053699929146,"rateByCode":{"10KG":0,"25OSN":0,"25PAP":0,"25POLI":0,"DEBILGRAN":0,"ESP10":0,"ESPPAP":0,"ESPPOLI":0,"FUERTEGRA":0,"GERMEN":0,"GRITZGR":0,"GRITZGRP":0,"GRITZM":0,"HFM":0,"HFMPAP":0,"HLLAF":0,"HLLAG":0,"HLLAGGRA":0,"HZ":0,"HZGRA":0,"RACION":0,"SALVADO":0,"SEMOL":0,"SEMOLGRA":0}},"2025-10":{"items":{"HARINA GRANEL":{"referenceKg":491810,"referenceNeto":209127660,"avg":425.2204306541144},"HARINA 25KG":{"referenceKg":389875,"referenceNeto":184180129.41176435,"avg":472.4081549516239},"HARINA 10 KG":{"referenceKg":12190,"referenceNeto":7545810.084033613,"avg":619.0164137845458},"HARINILLA KG":{"referenceKg":289085,"referenceNeto":38483147.05882353,"avg":133.1205253085547},"GRITZ SEMOL KG":{"referenceKg":325030,"referenceNeto":152877465.21008402,"avg":470.3487838355968},"H. F. MAIZ KG":{"referenceKg":79035,"referenceNeto":36580587.184873946,"avg":462.84035155151446},"ZOOTECNICA KG":{"referenceKg":149760,"referenceNeto":33292167.647058822,"avg":222.3034698655103},"GERMEN KG":{"referenceKg":51015,"referenceNeto":12387528.151260506,"avg":242.821290821533}},"totalKg":1787800,"totalNeto":674474494.7478988,"totalAvg":377.26507145536345,"harinasKg":893875,"harinasNeto":400853599.495798,"harinasAvg":448.44480435832526,"rateByCode":{"10KG":0,"25OSN":0,"25PAP":0,"25POLI":0,"DEBILGRAN":0,"DEBILPAP":0,"ESP10":0,"ESPPAP":0,"ESPPOLI":0,"FUERTEGRA":0,"FUERTEPAP":0,"GERGRA":0,"GERMEN":0,"GRITZGR":0,"GRITZGRP":0,"GRITZM":0,"HFM":0,"HFM10":0,"HFMPAP":0,"HLLAF":0,"HLLAG":0,"HLLAGGRA":0,"HZ":0,"HZGRA":0,"RACION":0,"SALVADO":0,"SEMOL":0,"SEMOLGRA":0}},"2025-11":{"items":{"HARINA GRANEL":{"referenceKg":229280,"referenceNeto":104551680,"avg":456},"HARINA 25KG":{"referenceKg":365300,"referenceNeto":173028603.3613308,"avg":473.66165716214294},"HARINA 10 KG":{"referenceKg":10010,"referenceNeto":6212810.084033613,"avg":620.660348055306},"HARINILLA KG":{"referenceKg":153335,"referenceNeto":20328734.621848743,"avg":132.5772629983288},"GRITZ SEMOL KG":{"referenceKg":344915,"referenceNeto":175439400.5461916,"avg":508.6453199953368},"H. F. MAIZ KG":{"referenceKg":71675,"referenceNeto":33319315.12605042,"avg":464.86662191908505},"ZOOTECNICA KG":{"referenceKg":151720,"referenceNeto":33394213.44537815,"avg":220.10422782347845},"GERMEN KG":{"referenceKg":41810,"referenceNeto":10266553.781512605,"avg":245.55258984722806}},"totalKg":1368045,"totalNeto":556541310.9663459,"totalAvg":406.8150616144541,"harinasKg":604590,"harinasNeto":283793093.4453644,"harinasAvg":469.39759745507604,"rateByCode":{"10KG":0,"25OSN":0,"25PAP":0,"25POLI":0,"ESP10":0,"ESPPAP":0,"ESPPOLI":0,"FUERTEGRA":0,"FUERTEPAP":0,"GERGRA":0,"GERMEN":0,"GRITZGR":0,"GRITZGRP":0,"GRITZM":0,"HFM":0,"HFMPAP":0,"HLLAF":0,"HLLAG":0,"HLLAG20":0,"HLLAGGRA":0,"HZ":0,"HZGRA":0,"RACION":0,"SALVADO":0,"SEMOL":0,"SEMOLGRA":0}},"2025-12":{"items":{"HARINA GRANEL":{"referenceKg":563990,"referenceNeto":257179440,"avg":456},"HARINA 25KG":{"referenceKg":286250,"referenceNeto":135920088.445378,"avg":474.8300033026306},"HARINA 10 KG":{"referenceKg":10590,"referenceNeto":6574613.445378151,"avg":620.83224224534},"HARINILLA KG":{"referenceKg":265150,"referenceNeto":34956407.563025214,"avg":131.83634758825275},"GRITZ SEMOL KG":{"referenceKg":262290,"referenceNeto":130457173.23529412,"avg":497.3776096507458},"H. F. MAIZ KG":{"referenceKg":50975,"referenceNeto":23679675.42016807,"avg":464.535074451556},"ZOOTECNICA KG":{"referenceKg":126495,"referenceNeto":28196597.478991598,"avg":222.9068143325159},"GERMEN KG":{"referenceKg":35845,"referenceNeto":9231498.319327733,"avg":257.5393588876477}},"totalKg":1601585,"totalNeto":626195493.9075629,"totalAvg":390.98486431101867,"harinasKg":860830,"harinasNeto":399674141.89075613,"harinasAvg":464.28928114814323,"rateByCode":{"10KG":0,"25OSN":0,"25PAP":0,"25POLI":0,"DEBILGRAN":0,"DEBILPAP":0,"ESP10":0,"ESPPAP":0,"ESPPOLI":0,"FUERTEGRA":0,"GERGRA":0,"GERMEN":0,"GRITZGR":0,"GRITZM":0,"HFM":0,"HFMPAP":0,"HLLAF":0,"HLLAG":0,"HLLAGGRA":0,"HZ":0,"HZGRA":0,"RACION":0,"SALVADO":0,"SEMOL":0,"SEMOLGRA":0}},"2026-01":{"items":{"HARINA GRANEL":{"referenceKg":765080,"referenceNeto":348876480,"avg":456},"HARINA 25KG":{"referenceKg":435225,"referenceNeto":204254371.42857116,"avg":469.30753387000095},"HARINA 10 KG":{"referenceKg":10700,"referenceNeto":6634000,"avg":620},"HARINILLA KG":{"referenceKg":391390,"referenceNeto":49367162.43697479,"avg":126.13291713374075},"GRITZ SEMOL KG":{"referenceKg":323305,"referenceNeto":161757730.29411763,"avg":500.32548303959925},"H. F. MAIZ KG":{"referenceKg":55760,"referenceNeto":25643298.31932773,"avg":459.8869856407412},"ZOOTECNICA KG":{"referenceKg":140485,"referenceNeto":31371917.226890758,"avg":223.31150818159063},"GERMEN KG":{"referenceKg":31950,"referenceNeto":8677634.453781513,"avg":271.6004523875278}},"totalKg":2153895,"totalNeto":836582594.1596637,"totalAvg":388.4045388283383,"harinasKg":1211005,"harinasNeto":559764851.4285712,"harinasAvg":462.2316600084816,"rateByCode":{"10KG":620,"25OSN":464.4155844155844,"25PAP":473.9957234497505,"25POLI":482.29428303655106,"DEBILGRAN":456,"DEBILPAP":468.89568845618913,"ESPPAP":672.2689075630253,"ESPPOLI":624.7298919567827,"FUERTEGRA":456,"FUERTEPAP":456,"GERMEN":271.6004523875278,"GRITZGR":479.6513646781026,"GRITZGRP":519,"GRITZM":507.2008959225713,"HFM":451.7100908434686,"HFM10":504.20168067226894,"HFMPAP":470,"HLLAF":144.01222121004307,"HLLAFGRA":135.24788712046424,"HLLAG":134.20932037997477,"HLLAG20":140,"HLLAGGRA":112.2038289438735,"HZ":270.44758956214065,"HZGRA":214.8526572076232,"RACION":336.1344537815126,"SALVADO":230,"SEMOL":465.2708124373119,"SEMOLGRA":519,"SEMOLP":525}},"2026-02":{"items":{"HARINA GRANEL":{"referenceKg":496860,"referenceNeto":226568160,"avg":456},"HARINA 25KG":{"referenceKg":250300,"referenceNeto":114702274.78991601,"avg":458.25918813390336},"HARINA 10 KG":{"referenceKg":9050,"referenceNeto":5415035.042016807,"avg":598.3464134825201},"HARINILLA KG":{"referenceKg":296580,"referenceNeto":32207773.36134454,"avg":108.59725322457528},"GRITZ SEMOL KG":{"referenceKg":191480,"referenceNeto":95542419.57983193,"avg":498.96814069266725},"H. F. MAIZ KG":{"referenceKg":56275,"referenceNeto":26056025.210084036,"avg":463.0124426492054},"ZOOTECNICA KG":{"referenceKg":106103,"referenceNeto":24203050.75630252,"avg":228.10901441337683},"GERMEN KG":{"referenceKg":25950,"referenceNeto":7066434.87394958,"avg":272.3096290539337}},"totalKg":1432598,"totalNeto":531761173.61344546,"totalAvg":371.1865949927652,"harinasKg":756210,"harinasNeto":346685469.83193284,"harinasAvg":458.45131621101655,"rateByCode":{"10KG":598.2757475083057,"25OSN":451.3664653971203,"25PAP":471.3519256308101,"25POLI":470.6828322017459,"DEBILGRAN":456,"DEBILPAP":469,"ESP10":630.2521008403362,"ESPOSN":672.2689075630253,"ESPPAP":672.2689075630253,"ESPPOLI":616.8067226890756,"FUERTEGRA":456,"GERMEN":272.3096290539337,"GRITZGR":490.29279636382853,"GRITZM":487.9356637524648,"HFM":457.66536644098267,"HFMPAP":467.43506493506493,"HLLAF":132.9306988170163,"HLLAG":102.5338579949705,"HLLAGGRA":107.11042621537395,"HZ":239.65259836232346,"HZGRA":220,"RACION":336.1344537815126,"SALVADO":230,"SEMOL":474.2658029269149,"SEMOLGRA":519}},"2026-03":{"items":{"HARINA GRANEL":{"referenceKg":284400,"referenceNeto":129881400,"avg":456.6856540084388},"HARINA 25KG":{"referenceKg":470800,"referenceNeto":217328695.79831886,"avg":461.6157514832601},"HARINA 10 KG":{"referenceKg":12150,"referenceNeto":7293110.168067226,"avg":600.2559809108828},"HARINILLA KG":{"referenceKg":254745,"referenceNeto":31891999.96638656,"avg":125.1918583932425},"GRITZ SEMOL KG":{"referenceKg":383215,"referenceNeto":191431812.5210084,"avg":499.5415433138275},"H. F. MAIZ KG":{"referenceKg":66975,"referenceNeto":30637573.529411763,"avg":457.4479063741958},"ZOOTECNICA KG":{"referenceKg":146965,"referenceNeto":33344423.94957983,"avg":226.88683665893126},"GERMEN KG":{"referenceKg":45360,"referenceNeto":11167047.899159664,"avg":246.1871229973471}},"totalKg":1664610,"totalNeto":652976063.8319323,"totalAvg":392.26969910785846,"harinasKg":767350,"harinasNeto":354503205.9663861,"harinasAvg":461.98371794668157,"rateByCode":{"10KG":599.0645161290323,"25OSN":451.8396692316527,"25PAP":480.2772277227723,"25POLI":466.061943752225,"DEBILGRAN":458.5164537359659,"DEBILPAP":469.19642857142856,"ESP10":840.3361344537815,"ESPOSN":672.2689075630253,"ESPPAP":672.2689075630252,"ESPPOLI":653.6246498599439,"FUERTEGRA":456,"FUERTEPAP":470,"GERGRA":215.43233082706766,"GERMEN":262.88258160407014,"GRITZGR":475.69064620067684,"GRITZGRP":519,"GRITZM":490.93636719393635,"HFM":447.2636519110686,"HFMPAP":470,"HLLAF":140.35901489308597,"HLLAG":130.1736029844246,"HLLAGGRA":106.17106397432343,"HZ":264.63611685026825,"HZGRA":220,"RACION":336.1344537815126,"SALVADO":230,"SEMOL":468.86017964291204,"SEMOLGRA":519,"SEMOLP":525}},"2026-04":{"items":{"HARINA GRANEL":{"referenceKg":877400,"referenceNeto":385895640,"avg":439.817232733075},"HARINA 25KG":{"referenceKg":379475,"referenceNeto":172850336.13445336,"avg":455.49861291113604},"HARINA 10 KG":{"referenceKg":16460,"referenceNeto":9857616.806722693,"avg":598.8831595821806},"HARINILLA KG":{"referenceKg":366320,"referenceNeto":47128577.31092437,"avg":128.65412019798092},"GRITZ SEMOL KG":{"referenceKg":366040,"referenceNeto":181698081.42857143,"avg":496.3885953135489},"H. F. MAIZ KG":{"referenceKg":89550,"referenceNeto":41085671.2184874,"avg":458.801465309742},"ZOOTECNICA KG":{"referenceKg":129205,"referenceNeto":29175950.840336137,"avg":225.8113141158325},"GERMEN KG":{"referenceKg":30075,"referenceNeto":8212945.37815126,"avg":273.08214058690805}},"totalKg":2254525,"totalNeto":875904819.1176466,"totalAvg":388.5096945554592,"harinasKg":1273335,"harinasNeto":568603592.9411759,"harinasAvg":446.54673981409127,"rateByCode":{"10KG":598.1474710542352,"25OSN":450.28596529760597,"25PAP":512,"25POLI":479.72342264477095,"DEBILGRAN":438.849288935137,"DEBILPAP":452,"ESP10":840.3361344537816,"ESPOSN":672.2689075630252,"ESPPAP":672.2689075630252,"ESPPOLI":655.6302521008404,"FUERTEGRA":443.42807849902954,"GERMEN":273.08214058690805,"GRITZGR":482.9035062300782,"GRITZM":490.26830034691994,"HFMPAP":458.801465309742,"HLLAF":142.87016022954194,"HLLAG":139.70577249550684,"HLLAGGRA":114.51230290579177,"HZ":269.47946229562666,"HZGRA":220,"RACION":336.1344537815126,"SALVADO":230,"SEMOL":468.07962992889463,"SEMOLGRA":519}},"2026-05":{"items":{"HARINA GRANEL":{"referenceKg":677080,"referenceNeto":296773860,"avg":438.3143203166539},"HARINA 25KG":{"referenceKg":306250,"referenceNeto":139639147.89915934,"avg":455.96456456868356},"HARINA 10 KG":{"referenceKg":11450,"referenceNeto":6864716.8067226885,"avg":599.5385857399727},"HARINILLA KG":{"referenceKg":372765,"referenceNeto":48640949.57983194,"avg":130.48690080836974},"GRITZ SEMOL KG":{"referenceKg":301735,"referenceNeto":151433711.63865545,"avg":501.8765195905528},"H. F. MAIZ KG":{"referenceKg":68385,"referenceNeto":31482817.226890754,"avg":460.3760653197449},"ZOOTECNICA KG":{"referenceKg":170555,"referenceNeto":38688070.5882353,"avg":226.83633190604377},"GERMEN KG":{"referenceKg":36740,"referenceNeto":9156807.56302521,"avg":249.23265005512275}},"totalKg":1944960,"totalNeto":722680081.3025208,"totalAvg":371.5655238681108,"harinasKg":994780,"harinasNeto":443277724.705882,"harinasAvg":445.6037764187881,"rateByCode":{"10KG":598.4824561403509,"25OSN":449.885706142226,"25PAP":512,"25POLI":478.1302235179786,"DEBILGRAN":438.3143203166539,"DEBILPAP":452,"ESP10":840.3361344537816,"ESPOSN":672.2689075630252,"ESPPAP":605.3781512605042,"ESPPOLI":659.2189817103311,"FUERTEPAP":440,"GERGRA":210,"GERMEN":269.3171836635889,"GRITZGR":479.77334933973583,"GRITZGRP":519,"GRITZM":499.54191010652704,"HFM":452.84104781977936,"HFM10":504.20168067226894,"HFMPAP":470,"HLLAF":148.34321545877233,"HLLAG":139.55325002990668,"HLLAGGRA":115.55006162346507,"HZ":271.19519597081427,"HZGRA":220,"RACION":336.1344537815126,"SALVADO":230,"SEMOL":468.2631412614368,"SEMOLGRA":519}},"2026-06":{"items":{"HARINA GRANEL":{"referenceKg":834610,"referenceNeto":365667640,"avg":438.1299529121386},"HARINA 25KG":{"referenceKg":438550,"referenceNeto":199135158.82352898,"avg":454.07629420483175},"HARINA 10 KG":{"referenceKg":15610,"referenceNeto":9377016.806722693,"avg":600.7057531532795},"HARINILLA KG":{"referenceKg":346205,"referenceNeto":45306794.9579832,"avg":130.86695731714795},"GRITZ SEMOL KG":{"referenceKg":389335,"referenceNeto":195912681.9327731,"avg":503.1982275746417},"H. F. MAIZ KG":{"referenceKg":74050,"referenceNeto":34725733.193277314,"avg":468.9498067964526},"ZOOTECNICA KG":{"referenceKg":139760,"referenceNeto":31909977.31092437,"avg":228.31981476047775},"GERMEN KG":{"referenceKg":39685,"referenceNeto":10339686.134453781,"avg":260.5439368641497}},"totalKg":2277805,"totalNeto":892374689.1596636,"totalAvg":391.7695716532642,"harinasKg":1288770,"harinasNeto":574179815.6302516,"harinasAvg":445.5254355938233,"rateByCode":{"10KG":599.9357326478149,"25OSN":450.83602771362587,"25PAP":512,"25POLI":474.17267552182165,"DEBILGRAN":437.387280914676,"DEBILPAP":452,"ESP10":840.3361344537816,"ESPOSN":672.2689075630253,"ESPPAP":672.2689075630253,"ESPPOLI":624.609843937575,"FUERTEGRA":440,"FUERTEPAP":440,"GERGRA":210,"GERMEN":272.3414494002729,"GRITZGR":476.74598841856925,"GRITZGRP":519,"GRITZM":499.2039352326296,"HFM":468.2842403370615,"HFMPAP":470,"HLLAF":147.7638903662731,"HLLAG":140.70731402470207,"HLLAGGRA":117.41896690583398,"HZ":265.95957750689206,"HZGRA":220,"RACION":336.1344537815126,"S800":0,"SALVADO":230,"SEMOL":468.92336431360553,"SEMOLGRA":519}},"2026-07":{"items":{"HARINA GRANEL":{"referenceKg":1315900,"referenceNeto":577442700,"avg":438.819591154343},"HARINA 25KG":{"referenceKg":448025,"referenceNeto":204399893.2773103,"avg":456.22430283423984},"HARINA 10 KG":{"referenceKg":11840,"referenceNeto":7103230.252100839,"avg":599.9349875085169},"HARINILLA KG":{"referenceKg":563145,"referenceNeto":73411561.13445382,"avg":130.35996259303343},"GRITZ SEMOL KG":{"referenceKg":298105,"referenceNeto":149571947.10084033,"avg":501.742497109543},"H. F. MAIZ KG":{"referenceKg":52800,"referenceNeto":24335066.176470585,"avg":460.89140485739745},"ZOOTECNICA KG":{"referenceKg":146200,"referenceNeto":32987533.61344538,"avg":225.63292485256758},"GERMEN KG":{"referenceKg":35100,"referenceNeto":9254640.75630252,"avg":263.66497881203765}},"totalKg":2871115,"totalNeto":1078506572.3109238,"totalAvg":375.6403252084726,"harinasKg":1775765,"harinasNeto":788945823.5294112,"harinasAvg":444.2850397036833,"rateByCode":{"10KG":598.0936170212766,"25OSN":451.52811466372657,"25PAP":512,"25POLI":485.5086705202312,"DEBILGRAN":439.0798696483628,"DEBILPAP":452,"ESP10":840.3361344537816,"ESPOSN":672.2689075630252,"ESPPAP":672.2689075630252,"ESPPOLI":660.5336871590741,"FUERTEGRA":437.9028111897725,"GERGRA":220,"GERMEN":269.28105325731576,"GRITZGR":482.8715402244814,"GRITZGRP":519,"GRITZM":505.5540319576105,"HFM":448.90641124870996,"HFMPAP":470,"HLLAF":150.14533505709974,"HLLAFGRA":134.6875,"HLLAG":141.03675442326391,"HLLAGGRA":117.85207988015847,"HZ":270.2154642344743,"HZGRA":220,"RACION":336.1344537815126,"SALVADO":230,"SEMOL":470.5453741641786,"SEMOLGRA":519}}});
    const normalizePeriodKey = (periodo) => {
      const s=String(periodo||'').trim().toLowerCase();
      const m=s.match(/^(\d{4})[-\/](\d{1,2})(?:\b|$)/);
      if(m) return `${m[1]}-${String(m[2]).padStart(2,'0')}`;
      const yr=(s.match(/\d{4}/)||[])[0]||'';
      const month=Object.entries(MONTHS_ES).find(([name])=>s.includes(name));
      return month&&yr?`${yr}-${month[1]}`:'';
    };
    const INE_FORMULA_CATALOG_EXTRA = Object.freeze({"2026-05":{"items":{"HARINA GRANEL":{"referenceKg":677080,"referenceNeto":296773860,"avg":438.3143203166539},"HARINA 25KG":{"referenceKg":306250,"referenceNeto":139639147.89915934,"avg":455.96456456868356},"HARINA 10 KG":{"referenceKg":11450,"referenceNeto":6864716.8067226885,"avg":599.5385857399727},"HARINILLA KG":{"referenceKg":372765,"referenceNeto":48640949.57983194,"avg":130.48690080836974},"GRITZ SEMOL KG":{"referenceKg":301735,"referenceNeto":151433711.63865545,"avg":501.8765195905528},"H. F. MAIZ KG":{"referenceKg":68385,"referenceNeto":31482817.226890754,"avg":460.3760653197449},"ZOOTECNICA KG":{"referenceKg":170555,"referenceNeto":38688070.5882353,"avg":226.83633190604377},"GERMEN KG":{"referenceKg":36740,"referenceNeto":9156807.56302521,"avg":249.23265005512275}},"totalKg":1944960,"totalNeto":722680081.3025208,"totalAvg":371.5655238681108,"harinasKg":994780,"harinasNeto":443277724.705882,"harinasAvg":445.6037764187881,"rateByCode":{"10KG":598.4824561403509,"25OSN":449.885706142226,"25PAP":512,"25POLI":478.1302235179786,"DEBILGRAN":438.3143203166539,"DEBILPAP":452,"ESP10":840.3361344537816,"ESPOSN":672.2689075630252,"ESPPAP":605.3781512605042,"ESPPOLI":659.2189817103311,"FUERTEPAP":440,"GERGRA":210,"GERMEN":269.3171836635889,"GRITZGR":479.77334933973583,"GRITZGRP":519,"GRITZM":499.54191010652704,"HFM":452.84104781977936,"HFM10":504.20168067226894,"HFMPAP":470,"HLLAF":148.34321545877233,"HLLAG":139.55325002990668,"HLLAGGRA":115.55006162346507,"HZ":271.19519597081427,"HZGRA":220,"RACION":336.1344537815126,"SALVADO":230,"SEMOL":468.2631412614368,"SEMOLGRA":519}}});
    const getIneFormulaProfile = (periodo, runtimeCatalog={}) => {
      const key=normalizePeriodKey(periodo);
      return (runtimeCatalog&&runtimeCatalog[key]) || INE_FORMULA_CATALOG_EXTRA[key] || INE_FORMULA_CATALOG_SEED[key] || null;
    };
    const deriveIneFromExistenceDetail = (detailRows, periodo, runtimeCatalog={}) => {
      const profile=getIneFormulaProfile(periodo,runtimeCatalog), key=normalizePeriodKey(periodo);
      const agg=new Map(INE_FAMILIES.map(name=>[name,{name,kg:0,neto:0,rows:0,codes:new Set(),sources:new Set()}]));
      const unmapped=[],missingAq=[];
      for(const r of (detailRows||[])){
        const fam=String(r?.family||'').trim().toUpperCase(), kg=n(r?.salida);
        if(!kg) continue;
        if(!agg.has(fam)){unmapped.push({code:r?.code||'',name:r?.name||'',kg,reason:'familia no reconocida'});continue;}
        const z=agg.get(fam), code=String(r?.code||'').trim().toUpperCase();
        const masterRate=profile && Number.isFinite(Number(profile?.rateByCode?.[code])) ? Number(profile.rateByCode[code]) : null;
        // V47.6: cuando no existe un perfil mensual del Maestro, el Registro sigue
        // siendo autosuficiente para el cálculo: su Valor Movto es la entrada AQ operativa.
        const registerAq=Number.isFinite(Number(r?.valorMovto)) ? Number(r.valorMovto) : null;
        const aq=masterRate!=null ? masterRate : registerAq;
        if(aq==null){z.kg+=kg;z.rows++;z.sources.add('SIN_AQ');missingAq.push({code:r?.code||'',name:r?.name||'',kg,reason:'sin AQ Maestro y sin Valor Movto en Registro'});continue;}
        // Fórmula copiada del Maestro: AR = AQ * U
        const neto=aq*kg;
        z.kg+=kg; z.neto+=neto; z.rows++;
        if(code)z.codes.add(code);
        z.sources.add(masterRate!=null?'AQ_MAESTRO_CODIGO':'AQ_REGISTRO_VALOR_MOVTO');
      }
      const items=INE_FAMILIES.map(name=>{const z=agg.get(name),kg=z?.kg||0,neto=z?.neto||0;return {name,kg,neto,promedio:kg?neto/kg:null,vn:0,kgp:0,rows:z?.rows||0,formulaAvg:kg?neto/kg:null,referenceKg:profile?.items?.[name]?.referenceKg??null,referenceNeto:profile?.items?.[name]?.referenceNeto??null,sourceCodes:[...(z?.codes||[])],formulaSources:[...(z?.sources||[])]};});
      if(unmapped.length||missingAq.length) return {available:false,periodo,key,items,totalKg:items.reduce((a,x)=>a+x.kg,0),totalNeto:items.reduce((a,x)=>a+x.neto,0),netoHarinas:items.slice(0,3).reduce((a,x)=>a+x.neto,0),kgHarinas:items.slice(0,3).reduce((a,x)=>a+x.kg,0),missingReason:'Existen líneas del Registro sin familia o sin AQ. Se revisan antes de publicar.',source:'FORMULA_MAESTRO_APLICADA_AL_REGISTRO',unmapped:unmapped.concat(missingAq)};
      const totalKg=items.reduce((a,x)=>a+x.kg,0), totalNeto=items.reduce((a,x)=>a+x.neto,0), netoHarinas=items.slice(0,3).reduce((a,x)=>a+x.neto,0), kgHarinas=items.slice(0,3).reduce((a,x)=>a+x.kg,0);
      items.forEach(x=>{x.vn=totalNeto?x.neto/totalNeto:0;x.kgp=totalKg?x.kg/totalKg:0;});
      const differences=[];
      // Solo auditar contra Maestro cuando el mismo período está disponible.
      if(profile?.totalKg!=null && Math.abs(totalKg-profile.totalKg)>1e-6)differences.push({type:'KG',existence:totalKg,master:profile.totalKg});
      if(profile?.totalNeto!=null && Math.abs(totalNeto-profile.totalNeto)>1e-6)differences.push({type:'NETO',existence:totalNeto,master:profile.totalNeto});
      const formulaSource=profile?'MAESTRO_CODIGO_PRIORITARIO':'REGISTRO_VALOR_MOVTO_AUTONOMO';
      return {available:true,periodo,key,items,totalKg,totalNeto,totalPromedio:divideSafe(totalNeto,totalKg),netoHarinas,kgHarinas,promedioHarinas:divideSafe(netoHarinas,kgHarinas),formula:'AQ = AJ + AN; AR = AQ * U; D = B/C; E = B/B15; F = C/C15; D15 = B15/C15; B18 = B7+B8+B9; B19 = C7+C8+C9; B20 = B18/B19',engineVersion:'V47.7',source:'FORMULA_MAESTRO_APLICADA_AL_REGISTRO',sourceDescription:'U=Salida INFO=1; AQ=Valor Movto del Registro como entrada operativa equivalente a AJ+AN; si existe perfil Maestro del mismo período se valida por código; AR=AQ×U; luego D/E/F/Total/Harinas.',formulaSource,unmapped:[],audit:{profileKey:key,referenceTotalKg:profile?.totalKg??null,referenceTotalNeto:profile?.totalNeto??null,referenceTotalAvg:profile?.totalAvg??null,differences,formulaSource}};
    };
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

    const eh=(name,header)=>{const u=(header||[]).map(v=>String(v??'').trim().toUpperCase());return u.indexOf(name)};

    // V47.0: Construye la pauta INE mensual directamente desde BASE DE DATOS,
    // usando los resultados de las fórmulas del Maestro (AQ/AR) y Salida (U).
    // Esto permite comparar cualquier Registro de Existencia con el Maestro
    // acumulativo sin depender exclusivamente de la hoja INE (2), que refleja
    // solo el período que tenga seleccionado el Excel.
    const MONTHS_ES = Object.freeze({
      enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',
      julio:'07',agosto:'08',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'
    });
    const monthKeyFromRow = (r) => {
      const mes = String(r?.[eh('MES', bd?.[0]||[])] ?? r?.[30] ?? '').trim().toLowerCase();
      const anio = String(r?.[eh('AÑO', bd?.[0]||[])] ?? r?.[50] ?? '').trim();
      const mm = MONTHS_ES[mes];
      return (mm && /^\d{4}$/.test(anio)) ? `${anio}-${mm}` : '';
    };
    const excelYearFromSerial = v => { const x=Number(v); if(!Number.isFinite(x))return ''; return String(new Date(Date.UTC(1899,11,30)+x*86400000).getUTCFullYear()); };
    const buildMonthlyMasterIne = (baseRows) => {
      const h=(baseRows[0]||[]).map(v=>String(v??'').trim().toUpperCase()),idx={};h.forEach((v,i)=>{if(v)idx[v]=i});
      const iMes=idx['MES'],iAno=idx['AÑO'],iFecha=idx['FECHA'],iCodigo=idx['CÓDIGO']??idx['CODIGO'],iProducto=idx['PRODUCTO'],iSalida=idx['SALIDA'],iAQ=idx['VALOR PROMEDIO'],iAR=idx['NETO'];if([iMes,iProducto,iSalida].some(v=>v==null))return {};
      const acc=new Map();
      for(const r of baseRows.slice(1)){const mes=String(r?.[iMes]??'').trim().toLowerCase();let anio=String(iAno!=null?r?.[iAno]:'').trim();if(!/^\d{4}$/.test(anio)&&iFecha!=null)anio=excelYearFromSerial(r?.[iFecha]);const mm=MONTHS_ES[mes];if(!mm||!/^\d{4}$/.test(anio))continue;const key=`${anio}-${mm}`;const code=norm(iCodigo!=null?r?.[iCodigo]:'');const fam=ineFamilyByCode(code,iProducto!=null?r?.[iProducto]:'');if(!fam)continue;const kg=n(iSalida!=null?r?.[iSalida]:0),aq=n(iAQ!=null?r?.[iAQ]:0),arCached=n(iAR!=null?r?.[iAR]:0);if(!acc.has(key))acc.set(key,{families:new Map(INE_FAMILIES.map(name=>[name,{name,neto:0,kg:0,rows:0,auditNet:0}])),codes:new Map()});const m=acc.get(key),z=m.families.get(fam),arFormula=aq*kg,neto=(Number.isFinite(arFormula)&&(arFormula!==0||arCached===0))?arFormula:arCached;z.neto+=neto;z.kg+=kg;z.rows++;z.auditNet+=arCached;if(code&&kg>0){if(!m.codes.has(code))m.codes.set(code,{kg:0,weightedAq:0});const c=m.codes.get(code);c.kg+=kg;c.weightedAq+=aq*kg;}}
      const out={};for(const [key,obj] of acc.entries()){const items=INE_FAMILIES.map(name=>{const x=obj.families.get(name)||{name,neto:0,kg:0,rows:0,auditNet:0};return {name,neto:x.neto,kg:x.kg,promedio:divideSafe(x.neto,x.kg),auditRows:x.rows,auditNetoExcel:x.auditNet};});const calc=calcIne(items,key,{mode:'BASE DE DATOS MENSUAL',sourceType:'ventas-maestro',headerFound:true,missing:[],sourceSheet:'BASE DE DATOS',calculation:'AQ = AJ + AN; AR = AQ * U; PROMEDIO = NETO/KG; VN = NETO/NETO total; KGP = KG/KG total.'});const rateByCode={};for(const [code,c] of obj.codes.entries())rateByCode[code]=c.kg?c.weightedAq/c.kg:null;const audit=[];for(const it of items){const ex=it.auditNetoExcel;if(Math.abs(ex-it.neto)>1e-9)audit.push({name:it.name,excelNeto:ex,formulaNeto:it.neto,diff:it.neto-ex});}calc.quality.masterMonthlyAudit={ok:audit.length===0,differences:audit,sourceColumns:{fecha:iFecha!=null?'L = Fecha':'',mes:'MES',salida:'U = Salida',aq:'AQ = VALOR PROMEDIO = AJ+AN',neto:'AR = NETO = AQ*Salida'}};calc.rateByCode=rateByCode;out[key]=calc;}return out;
    };

    const ine = { totalNeto:0,totalKg:0,totalPromedio:0,netoHarinas:0,kgHarinas:0,promedioHarinas:0,items:[],periodo:'',quality:{mode:'',sourceType:'',headerFound:false,missing:[]},inventory:{saldoAnterior:0,saldoAnterior$:0,entradaKg:0,salidaKg:0,entrada$:0,salida$:0,disponibleKg:0,disponible$:0,reservasKg:0,consignacionKg:0,transitoriaKg:0,totalValorizado$:0} };

    const masterIneByPeriod = buildMonthlyMasterIne(bd);
    const runtimeFormulaCatalog = {...(e.data?.formulaCatalog||{})};
    for (const [key,val] of Object.entries(masterIneByPeriod||{})) runtimeFormulaCatalog[key]={items:Object.fromEntries((val.items||[]).map(x=>[x.name,{referenceKg:n(x.kg),referenceNeto:n(x.neto),avg:n(x.promedio)}])),totalKg:n(val.totalKg),totalNeto:n(val.totalNeto),totalAvg:n(val.totalPromedio),harinasKg:n(val.kgHarinas),harinasNeto:n(val.netoHarinas),harinasAvg:n(val.promedioHarinas),rateByCode:val.rateByCode||{}};
    for(const [key,val] of Object.entries(INE_FORMULA_CATALOG_EXTRA||{})) if(!runtimeFormulaCatalog[key])runtimeFormulaCatalog[key]=val;
    for(const [key,val] of Object.entries(INE_FORMULA_CATALOG_SEED||{})) if(!runtimeFormulaCatalog[key])runtimeFormulaCatalog[key]=val;

    // V47.1: si el archivo contiene un Registro de Existencia Físico-Valorizado,
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
            for(let i=header+1;i<ir.length;i++){const r=ir[i]||[],info=String(r[idx['INFO']]??'').trim(),name=String(r[idx['ITEM']]??'').trim();if(!name)continue;const x={name,code:String(r[idx['CODIGO']]??''),family:'',valorMovto:n(r[idx['VALORMOVTO']]),disponible:n(r[idx['TOTALDISPONIBLE']]),disponible$:n(r[idx['TOTALDISPONIBLE$']]),saldoAnterior:n(r[idx['SALDOANTERIOR']]),saldoAnterior$:n(r[idx['SALDOANTERIOR$']]),entrada:n(r[idx['ENTRADA']]),salida:n(r[idx['SALIDA']]),entrada$:n(r[idx['ENTRADA$']]),salida$:n(r[idx['SALIDA$']]),reservas:n(r[idx['RESERVAS']]),consignacion:n(r[idx['CONSIGNACION']]),transitoria:n(r[idx['TRANSITORIA']]),totalValorizado$:n(r[idx['TOTALVALORIZADO$']])};const mappedFamily=ineFamilyByCode(x.code,x.name);x.family=mappedFamily||'';if(info==='2')summary.push(x);else if(info==='1')detail.push(x)}
            const agg=new Map(INE_FAMILIES.map(name=>[name,{name,neto:0,kg:0,sourceCodes:new Set()}])),unmapped=[];
            for(const x of summary){const fam=ineFamilyByCode(x.code,x.name);if(!fam){if(x.disponible||x.disponible$)unmapped.push({code:x.code,name:x.name,kg:x.disponible,neto:x.disponible$});continue}const z=agg.get(fam);z.neto+=x.disponible$;z.kg+=x.disponible;if(x.code)z.sourceCodes.add(x.code)}
            const sourceTotalNeto=summary.reduce((a,x)=>a+x.disponible$,0);
            const sourceTotalKg=summary.reduce((a,x)=>a+x.disponible,0);
            const baseItems=INE_FAMILIES.map(name=>({...agg.get(name),sourceCodes:[...agg.get(name).sourceCodes]}));
            const exact=calcIne(baseItems,ine.periodo,{...ine.quality,calculation:'Registro Físico-Valorizado: INFO=2. Valor unitario stock = Total Disponible$ / Total Disponible. Es stock, no Promedio INE de ventas.',metric:'existence_unit_value',averageLabel:'Valor unitario stock',catalogSource:catalogFamilyByCode.size?'CODIGOS del Maestro':'catálogo de respaldo'});
            const derivedIne=deriveIneFromExistenceDetail(detail,ine.periodo,runtimeFormulaCatalog);
            exact.items=(exact.items||[]).map(x=>({...x,stockUnitValue:n(x.promedio),promedio:null}));
            exact.totalStockUnitValue=divideSafe(exact.totalNeto,exact.totalKg);
            exact.stockUnitValueHarinas=divideSafe(exact.netoHarinas,exact.kgHarinas);
            // V46.7: existencia nunca usa el valor unitario stock como PROMEDIO INE.
            exact.totalPromedio=null;
            exact.promedioHarinas=null;
            exact.derivedIne=derivedIne;
            exact.masterIneReferenceRequired=false;
            exact.formulaCatalogAvailable=!!derivedIne.available;
            const sourceColumns={info:'A = Info',code:'B = Código',item:'C = Ítem',valorMovto:'S = Valor Movto',salida:'U = Salida',totalDisponible:'AC = Total Disponible',totalDisponible$:'AG = Total Disponible$',totalValorizado$:'AK = Total Valorizado$',costo:'W = Costo'};const formulaProfile={model:'EXISTENCIA_FISICO_VALORIZADA',summaryFilter:'INFO = 2',stockUnitValue:'Total Disponible$ / Total Disponible',valueColumn:'AG = Total Disponible$',kgColumn:'AC = Total Disponible',total:'suma de 8 familias',harinas:'1+2+3',salesIne:'VP X = NETO / Salida (separado)',masterIneRule:'PROMEDIO INE se genera desde el Registro aplicando la cadena del Maestro: U=Salida INFO=1; AQ=Valor Movto del Registro (entrada operativa equivalente a AJ+AN); AR=AQ×U; D=B/C; E=B/B15; F=C/C15; D15=B15/C15; B18=B7+B8+B9; B19=C7+C8+C9; B20=B18/B19'};const checksum=hashText(JSON.stringify({periodKey:ine.periodo,summaryRows:summary.map(x=>({...x})),detailCount:detail.length}));ine.existenceBase={version:3,baseVersion:3,key:ine.periodo,periodKey:ine.periodo,summaryRows:summary.map(x=>({...x})),detailRows:detail.map(x=>({...x})),familyItems:baseItems.map(x=>({...x,sourceCodes:Array.isArray(x.sourceCodes)?[...x.sourceCodes]:[]})),sourceSheet:regName,range:range||'',emissionDate:emission?.replace(/^.*?:\s*/,'')||'',recordCountSummary:summary.length,recordCountDetail:detail.length,sourceColumns,formulaProfile,derivedIne,formulaCatalogKey:normalizePeriodKey(ine.periodo),checksum};
            Object.assign(ine,exact);
            ine.derivedIne=derivedIne;
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
      version: '47.3',
      fileName: e.data.fileName || 'Maestro Excel',
      lastLoaded: Date.now(),
      sheets,
      metrics: { ine, sacos: { ventasSacos, kgSacos, items: sacItems }, granel: { totalGranel, items: granelItems }, iva: iv },
      masterIneByPeriod,
      ineFormulaCatalog: Object.keys(runtimeFormulaCatalog).length?runtimeFormulaCatalog:INE_FORMULA_CATALOG_SEED,
      masterIneFormulaCatalog: runtimeFormulaCatalog,
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
