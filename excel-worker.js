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

    // ---------- INE ----------
    const ir = rowsPart('INE');
    const ine = { totalNeto: 0, totalKg: 0, totalPromedio: 0, netoHarinas: 0, kgHarinas: 0, promedioHarinas: 0, items: [], periodo: '' };
    const rh = ir.findIndex(r => String(r?.[0] || '').toUpperCase().includes('ETIQUETAS DE FILA'));
    if (rh >= 0) {
      ine.periodo = String(ir[2]?.[1] || '') + ' ' + String(ir[3]?.[1] || '');
      for (let i = rh + 1; i < ir.length; i++) {
        const name = String(ir[i]?.[0] ?? '').trim();
        if (!name) continue;
        const net = n(ir[i]?.[1]), kg = n(ir[i]?.[2]), avg = n(ir[i]?.[3]);
        if (/TOTAL GENERAL/i.test(name)) { ine.totalNeto = net; ine.totalKg = kg; ine.totalPromedio = avg; continue; }
        if (net || kg) ine.items.push({ name, neto: net, kg, promedio: avg, vn: n(ir[i]?.[4]), kgp: n(ir[i]?.[5]) });
      }
    }
    for (const r of ir) {
      const label = String(r?.[0] ?? '').toUpperCase();
      if (label === 'NETO HARINAS') ine.netoHarinas = n(r?.[1]);
      if (label.includes('KG HARINAS')) ine.kgHarinas = n(r?.[1]);
      if (label.includes('VALOR PROMEDIO HARINAS')) ine.promedioHarinas = n(r?.[1]);
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

    const baseRows = rowsPart('BASE DE DATOS');
    const baseObjects = objects(baseRows, ['CODIGO', 'ITEM', 'FOLIO', 'ORIGEN/DESTINO'], 120000);
    const baseInvoiceLines = [];
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
      const isInvoice = /FACTURA\s*\[FT\]|FACTURA|FT\b/i.test(String(tipo || '') + ' ' + String(docType || ''));
      if (isInvoice && folio) {
        baseInvoiceLines.push({
          fuente: sheetPart('BASE DE DATOS') || 'BASE DE DATOS',
          fecha: get(o, ['FECHA DOCTO', 'FECHA']),
          folio,
          tipo: tipo || 'Factura[FT]',
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
        });
      }
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
      if (!invoiceMap.has(key)) invoiceMap.set(key, { folio: line.folio, fecha: line.fecha, tipo: 'FACTURA', cliente: line.cliente || '', rut: line.rut || '', productos: new Set(), lineas: 0, sacos: 0, kg: 0, neto: 0, iva: 0, ivaHarina: 0, total: 0, fuente: line.fuente, estado: line.estado || '' });
      const inv = invoiceMap.get(key);
      if (line.producto) inv.productos.add(String(line.producto));
      inv.lineas += 1; inv.sacos += n(line.sacos); inv.kg += n(line.kg); inv.neto += n(line.neto); inv.iva += n(line.iva); inv.ivaHarina += n(line.ivaHarina); inv.total += n(line.total);
      if (!inv.rut && line.rut) inv.rut = line.rut;
      if (!inv.cliente && line.cliente) inv.cliente = line.cliente;
      if (!inv.fecha && line.fecha) inv.fecha = line.fecha;
    }
    for (const [key, ref] of libroByFolio.entries()) {
      if (!/FACTURA/i.test(String(ref.tipo || ''))) continue;
      if (![...invoiceMap.values()].some(x => norm(x.folio) === key)) {
        invoiceMap.set(key + '|LIBRO', { folio: ref.folio, fecha: ref.fecha, tipo: 'FACTURA', cliente: ref.cliente || '', rut: ref.rut || '', productos: new Set(), lineas: 0, sacos: 0, kg: 0, neto: ref.netoAfecto, iva: ref.iva, ivaHarina: ref.ivaHarina, total: ref.total, fuente: ref.fuente, estado: ref.estado || '' });
      }
    }
    const invoices = [...invoiceMap.values()].map(x => ({ ...x, rut: x.rut || nameToRut.get(normName(x.cliente)) || '', cliente: x.cliente || rutToName.get(norm(x.rut)) || '', productos: [...x.productos].filter(Boolean) })).sort((a,b)=>String(a.folio).localeCompare(String(b.folio),'es',{numeric:true}));

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

    post('Finalizando índices locales', 96);
    const snapshot = {
      version: '18.0',
      fileName: e.data.fileName || 'Maestro Excel',
      lastLoaded: Date.now(),
      sheets,
      metrics: { ine, sacos: { ventasSacos, kgSacos, items: sacItems }, granel: { totalGranel, items: granelItems }, iva: iv },
      documents,
      clients: [...clientsMap.values()].map(c=>({...c,zona:c.zona||'',destino:c.destino||''})).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')),
      guides,
      nc,
      invoices,
      products,
      meta: { documentCount: documents.length, invoiceCount: invoices.length, guideCount: guides.length, clientCount: clientsMap.size }
    };
    self.postMessage({ type: 'result', snapshot });
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
