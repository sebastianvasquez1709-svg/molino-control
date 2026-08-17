importScripts('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');

self.onmessage = async (e) => {
  try {
    if (e.data?.type !== 'parse') return;
    const wb = XLSX.read(e.data.buffer, { type: 'array', cellDates: true, cellNF: false, cellStyles: false });
    const sheets = wb.SheetNames || [];
    const post = (message, percent) => self.postMessage({ type: 'progress', message, percent });
    const sheetPart = p => sheets.find(s => s.toUpperCase().includes(p.toUpperCase())) || null;
    const rowsOf = name => name && wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true }) : [];
    const rowsPart = p => rowsOf(sheetPart(p));
    const norm = v => String(v ?? '').toUpperCase().replace(/[.\-\s]/g, '');
    const normName = v => String(v ?? '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,' ').trim().replace(/\s+/g,' ');
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
    // El Maestro puede traer una hoja INE (pivot de ventas) o un Excel mensual
    // independiente con el formato REGISTRO DE EXISTENCIAS [FISICO - VALORIZADO].
    // Si no existe la hoja INE, usamos automáticamente el Registro de Existencia
    // para que el Panel Privado nunca quede en $0 por no encontrar una hoja llamada INE.
    let ir = rowsPart('INE');
    let ineSource = sheetPart('INE') || '';
    const ine = { totalNeto: 0, totalKg: 0, totalPromedio: 0, netoHarinas: 0, kgHarinas: 0, promedioHarinas: 0, items: [], periodo: '', quality: { mode:'', sourceType:'', headerFound:false, missing:[] }, inventory: { saldoAnterior:0, saldoAnterior$:0, entradaKg:0, salidaKg:0, entrada$:0, salida$:0, disponibleKg:0, disponible$:0, reservasKg:0, consignacionKg:0, transitoriaKg:0, totalValorizado$:0 } };
    const rh = ir.findIndex(r => String(r?.[0] || '').toUpperCase().includes('ETIQUETAS DE FILA'));
    if (rh >= 0) {
      ine.quality={mode:'INE/Pivot',sourceType:'ventas',headerFound:true,missing:[]};
      ine.periodo = String(ir[2]?.[1] || '') + ' ' + String(ir[3]?.[1] || '');
      for (let i = rh + 1; i < ir.length; i++) {
        const name = String(ir[i]?.[0] ?? '').trim();
        if (!name) continue;
        const net = n(ir[i]?.[1]), kg = n(ir[i]?.[2]), avg = n(ir[i]?.[3]);
        if (/TOTAL GENERAL/i.test(name)) { ine.totalNeto = net; ine.totalKg = kg; ine.totalPromedio = avg; continue; }
        if (net || kg) ine.items.push({ name, neto: net, kg, promedio: avg, vn: n(ir[i]?.[4]), kgp: n(ir[i]?.[5]) });
      }
      for (const r of ir) {
        const label = String(r?.[0] ?? '').toUpperCase();
        if (label === 'NETO HARINAS') ine.netoHarinas = n(r?.[1]);
        if (label.includes('KG HARINAS')) ine.kgHarinas = n(r?.[1]);
        if (label.includes('VALOR PROMEDIO HARINAS')) ine.promedioHarinas = n(r?.[1]);
      }
    } else {
      const regName = sheets.find(name => rowsOf(name).slice(0,7).flat().some(v => /REGISTRO DE EXISTENCIAS/i.test(String(v ?? ''))));
      if (regName) {
        ir = rowsOf(regName); ineSource = regName;
        const flat = ir.flat().map(v => String(v ?? '').trim());
        const range = flat.find(v => /Rango de fechas/i.test(v));
        const emission = flat.find(v => /Fecha de emisión/i.test(v));
        const rm = range?.match(/Rango de fechas\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+al\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
        if (rm) ine.periodo = rm[1].split('/')[2]+'-'+rm[1].split('/')[1].padStart(2,'0');
        const header = ir.findIndex(r => { const u=(r||[]).map(v=>String(v??'').trim().toUpperCase()); return u.includes('INFO') && u.includes('ÍTEM') && u.includes('TOTAL DISPONIBLE') && u.includes('TOTAL DISPONIBLE$'); });
        if (header >= 0) {
          const h=(ir[header]||[]).map(v=>String(v??'').trim().toUpperCase()); const idx={}; h.forEach((v,i)=>{if(v)idx[v]=i});
          ine.quality={mode:'Registro de Existencia',sourceType:'existencia',headerFound:true,missing:[],range:range||'',emissionDate:emission?.replace(/^.*?:\s*/,'')||''};
          const summary=[],detail=[];
          for(let i=header+1;i<ir.length;i++){const r=ir[i]||[];const info=String(r[idx['INFO']]??'').trim();const name=String(r[idx['ÍTEM']]??'').trim();if(!name)continue;const x={name,code:String(r[idx['CÓDIGO']]??''),disponible:n(r[idx['TOTAL DISPONIBLE']]),disponible$:n(r[idx['TOTAL DISPONIBLE$']]),saldoAnterior:n(r[idx['SALDO ANTERIOR']]),saldoAnterior$:n(r[idx['SALDO ANTERIOR$']]),entrada:n(r[idx['ENTRADA']]),salida:n(r[idx['SALIDA']]),entrada$:n(r[idx['ENTRADA$']]),salida$:n(r[idx['SALIDA$']]),reservas:n(r[idx['RESERVAS']]),consignacion:n(r[idx['CONSIGNACIÓN']]),transitoria:n(r[idx['TRANSITORIA']]),totalValorizado$:n(r[idx['TOTAL VALORIZADO$']])};if(info==='2')summary.push(x);else if(info==='1')detail.push(x);}
          ine.items=summary.map(x=>({name:x.name,code:x.code,neto:x.disponible$,kg:x.disponible,promedio:x.disponible?x.disponible$/x.disponible:0,vn:0,kgp:0})).filter(x=>x.neto||x.kg);
          ine.totalKg=ine.items.reduce((a,x)=>a+x.kg,0); ine.totalNeto=ine.items.reduce((a,x)=>a+x.neto,0); ine.totalPromedio=ine.totalKg?ine.totalNeto/ine.totalKg:0;
          const har=ine.items.filter(x=>/^HARINA\b/i.test(x.name)); ine.netoHarinas=har.reduce((a,x)=>a+x.neto,0); ine.kgHarinas=har.reduce((a,x)=>a+x.kg,0); ine.promedioHarinas=ine.kgHarinas?ine.netoHarinas/ine.kgHarinas:0;
          ine.items=ine.items.map(x=>({...x,vn:ine.totalNeto?x.neto/ine.totalNeto:0,kgp:ine.totalKg?x.kg/ine.totalKg:0}));
          ine.inventory.saldoAnterior=summary.reduce((a,x)=>a+x.saldoAnterior,0); ine.inventory.saldoAnterior$=summary.reduce((a,x)=>a+x.saldoAnterior$,0); ine.inventory.entradaKg=detail.reduce((a,x)=>a+x.entrada,0); ine.inventory.salidaKg=detail.reduce((a,x)=>a+x.salida,0); ine.inventory.entrada$=detail.reduce((a,x)=>a+x.entrada$,0); ine.inventory.salida$=detail.reduce((a,x)=>a+x.salida$,0); ine.inventory.disponibleKg=ine.totalKg; ine.inventory.disponible$=ine.totalNeto; ine.inventory.reservasKg=summary.reduce((a,x)=>a+x.reservas,0); ine.inventory.consignacionKg=summary.reduce((a,x)=>a+x.consignacion,0); ine.inventory.transitoriaKg=summary.reduce((a,x)=>a+x.transitoria,0); ine.inventory.totalValorizado$=summary.reduce((a,x)=>a+x.totalValorizado$,0);
        } else { ine.quality={mode:'',sourceType:'',headerFound:false,missing:['Se encontró un archivo, pero no se reconoció la tabla de Registro de Existencia.']}; }
      } else { ine.quality={mode:'',sourceType:'',headerFound:false,missing:['No se encontró una hoja INE ni un Registro de Existencia.']}; }
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
