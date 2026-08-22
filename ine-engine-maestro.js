/* Molino Control — INE engine derived from MAESTRO_2025_2026
 * Source formulas mirrored from BASE DE DATOS / INE (2) in the Maestro.
 * This module is read-only: it calculates from an uploaded Registro de Existencia
 * and never writes back to Softland.
 */
(() => {
  'use strict';

  const SUPABASE_URL = 'https://dadggurateghfumfcshz.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_MtIFqV5vVxPNwkCxc82yOw_lCe5oFw4';
  const VERSION = 'MAESTRO_2025_2026';

  const num = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = String(v).trim().replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const norm = (v) => String(v ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const normKey = (v) => norm(v).replace(/[^A-Z0-9]/g, '');

  const cleanText = (v) => String(v ?? '').trim();

  const canonicalHeader = (v) => {
    const s = norm(v);
    if (/^CODIGO$|^COD$/i.test(s)) return 'codigo';
    if (/^ITEM$/.test(s)) return 'item';
    if (/^PRODUCTO$|^DESCRIPCION$/.test(s)) return 'producto';
    if (/^DETALLE$/.test(s)) return 'detalle';
    if (/^TRANSACCION$|^MOVIMIENTO$/.test(s)) return 'transaccion';
    if (/^DOCTO$|^DOCUMENTO$|^TIPO ?DOC/.test(s)) return 'docto';
    if (/^FOLIO$|^NUMERO$|^NRO$/.test(s)) return 'folio';
    if (/VALOR ?MOVTO|VALOR ?MOVIMIENTO/.test(s)) return 'valorMovto';
    if (/^SALIDA$|^EGRESO$/.test(s)) return 'salida';
    if (/^ENTRADA$|^INGRESO$/.test(s)) return 'entrada';
    if (/^SALDO$/.test(s)) return 'saldo';
    if (/^FECHA$|FECHA ?MOV/.test(s)) return 'fecha';
    if (/^ORIGEN.?DESTINO$|^ORIGEN$|^DESTINO$/.test(s)) return 'origenDestino';
    if (/^BODEGA$/.test(s)) return 'bodega';
    if (/^UM$|UNIDAD/.test(s)) return 'um';
    return normKey(v);
  };

  const firstMatching = (obj, keys) => {
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
    }
    return '';
  };

  async function loadXlsx() {
    if (window.XLSX) return window.XLSX;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('No fue posible cargar el lector XLSX.'));
      document.head.appendChild(s);
    });
    if (!window.XLSX) throw new Error('Lector XLSX no disponible.');
    return window.XLSX;
  }

  async function getSupabaseClient() {
    if (window.__molinoIneSupabaseClient) return window.__molinoIneSupabaseClient;
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    window.__molinoIneSupabaseClient = sb;
    return sb;
  }

  async function loadMaestroParameters() {
    const sb = await getSupabaseClient();
    const { data, error } = await sb.rpc('maestro_ine_parameters');
    if (error) throw error;
    if (!data || !data.code_map || !data.controls) throw new Error('La parametrización INE del Maestro está incompleta.');
    return data;
  }

  function locateHeaderRow(rows) {
    const wanted = ['codigo', 'docto', 'valorMovto', 'salida', 'entrada', 'saldo'];
    let best = { index: -1, score: 0 };
    const max = Math.min(rows.length, 30);
    for (let i = 0; i < max; i++) {
      const mapped = rows[i].map(canonicalHeader);
      const score = wanted.reduce((n, k) => n + (mapped.includes(k) ? 1 : 0), 0);
      if (score > best.score) best = { index: i, score };
    }
    if (best.index < 0 || best.score < 3) throw new Error('No se encontró una cabecera compatible con Registro de Existencia.');
    return best.index;
  }

  function toObjects(matrix) {
    const headerRow = locateHeaderRow(matrix);
    const headers = matrix[headerRow].map(canonicalHeader);
    const rows = [];
    for (let i = headerRow + 1; i < matrix.length; i++) {
      const raw = matrix[i];
      if (!raw || raw.every(v => String(v ?? '').trim() === '')) continue;
      const obj = {};
      headers.forEach((h, j) => { if (h) obj[h] = raw[j]; });
      rows.push(obj);
    }
    return { headerRow, rows };
  }

  function codeMeta(params, code) {
    const key = cleanText(code);
    return params.code_map[key] || null;
  }

  function isSaleDoc(docto, controls) {
    const d = norm(docto);
    return [controls.invoice, controls.receipt, controls.dispatch].some(x => d === norm(x));
  }

  function isInvoiceOrDispatch(docto, controls) {
    const d = norm(docto);
    return d === norm(controls.invoice) || d === norm(controls.dispatch);
  }

  function isReceipt(docto, controls) {
    return norm(docto) === norm(controls.receipt);
  }

  function calculateSacos(row, meta, controls) {
    const salida = num(row.salida);
    if (!salida) return 0;
    const code = cleanText(row.codigo);
    const detail = cleanText(row.detalle || meta?.detalle);
    const product = cleanText(row.producto || meta?.producto);
    const originDestino = cleanText(row.origenDestino);
    const nonDivide = new Set((controls.non_divide_details || []).map(cleanText).filter(Boolean).map(norm));
    const divide800 = new Set((controls.divide_800_details || []).map(cleanText).filter(Boolean).map(norm));
    const divide10 = new Set((controls.divide_10_codes || []).map(cleanText).filter(Boolean).map(norm));

    // Exact order of the Maestro AF formula:
    // 1) detalle J2:J8 => Salida as-is
    if (nonDivide.has(norm(detail))) return salida;
    // 2) producto = I2 => /10
    const i2 = Object.values(paramsRuntime.codeControl || {}).length ? paramsRuntime.codeControl.i2 : '';
    if (norm(product) === norm(i2)) return salida / 10;
    // 3) origen/destino = J11 => /25
    if (norm(originDestino) === norm(controls.divide_customer)) return salida / 25;
    // 4) detalle J12/J13 => /800
    if (divide800.has(norm(detail))) return salida / 800;
    // 5) B = A39/A24 => /10
    if (divide10.has(norm(code))) return salida / 10;
    // 6) default => /25
    return salida / 25;
  }

  const paramsRuntime = { codeControl: {} };

  function calculateRow(row, params) {
    const controls = params.controls;
    const meta = codeMeta(params, row.codigo);
    const family = cleanText(meta?.producto || row.producto);
    const detail = cleanText(meta?.detalle || row.detalle);
    const docto = cleanText(row.docto);
    const valorMovto = num(row.valorMovto);
    const salida = num(row.salida);
    const saleDoc = isSaleDoc(docto, controls);
    const invoiceOrDispatch = isInvoiceOrDispatch(docto, controls);
    const receipt = isReceipt(docto, controls);

    const pFcv = invoiceOrDispatch ? valorMovto : 0;                  // AJ
    const fcvNetos = invoiceOrDispatch ? valorMovto * salida : 0;     // AK
    const flourFamily = family === 'HARINA GRANEL' || family === 'HARINA 25KG' || family === 'HARINA 10 KG';
    const fcvAndGuide12 = flourFamily ? fcvNetos : 0;                // AL
    const receiptRef = receipt ? valorMovto : null;                  // AM

    let pBoleta = 0;                                                 // AN
    let boletaMatched = false;
    if (receipt && receiptRef !== null) {
      const rawKey = String(receiptRef);
      const exact = params.boleta_prices?.[rawKey];
      const asNumKey = Number(receiptRef).toString();
      const numeric = params.boleta_prices?.[asNumKey];
      if (exact !== undefined || numeric !== undefined) {
        pBoleta = Number(exact ?? numeric) || 0;
        boletaMatched = true;
      }
    }

    const averageValue = pFcv + pBoleta;                             // AQ
    const neto = averageValue * salida;                              // AR
    const iva = neto * Number(controls.vat_general);                 // AS
    const ivaHarinas = fcvAndGuide12 * Number(controls.vat_flour);   // AT
    const bruto = neto + iva + ivaHarinas;                           // AU
    const sacos = calculateSacos(row, meta, controls);               // AF / AI family logic

    return {
      ...row,
      codigo: cleanText(row.codigo),
      producto: family,
      detalle,
      docto,
      folio: cleanText(row.folio),
      fecha: cleanText(row.fecha),
      salida,
      entrada: num(row.entrada),
      valorMovto,
      esVenta: saleDoc,
      excluidaINE: !saleDoc,
      pFcv,
      fcvNetos,
      fcvAndGuide12,
      receiptRef,
      pBoleta,
      boletaMatched,
      valorPromedio: averageValue,
      neto,
      iva,
      ivaHarinas,
      bruto,
      sacos,
      familiaINE: family
    };
  }

  function summarize(rows) {
    const families = ['HARINA GRANEL','HARINA 25KG','HARINA 10 KG','HARINILLA KG','GRITZ SEMOL KG','H. F. MAIZ KG','ZOOTECNICA KG','GERMEN KG'];
    const groups = new Map(families.map(f => [f, { producto: f, neto: 0, kg: 0, promedio: 0, vnPct: 0, kgPct: 0 }]));
    let totalNet = 0;
    let totalKg = 0;
    let excluded = 0;
    let boletaUnmatched = 0;
    for (const r of rows) {
      if (!r.esVenta) { excluded++; continue; }
      totalNet += r.neto;
      totalKg += r.salida;
      if (r.docto && isReceipt(r.docto, runtimeControls)) {
        if (!r.boletaMatched) boletaUnmatched++;
      }
      if (!groups.has(r.familiaINE)) groups.set(r.familiaINE, { producto: r.familiaINE || 'SIN CLASIFICAR', neto: 0, kg: 0, promedio: 0, vnPct: 0, kgPct: 0 });
      const g = groups.get(r.familiaINE);
      g.neto += r.neto;
      g.kg += r.salida;
    }
    for (const g of groups.values()) {
      g.promedio = g.kg ? g.neto / g.kg : 0;
      g.vnPct = totalNet ? g.neto / totalNet : 0;
      g.kgPct = totalKg ? g.kg / totalKg : 0;
    }
    const harinaNames = new Set(['HARINA GRANEL','HARINA 25KG','HARINA 10 KG']);
    const harinaRows = [...groups.values()].filter(g => harinaNames.has(g.producto));
    const harinaNet = harinaRows.reduce((s,g)=>s+g.neto,0);
    const harinaKg = harinaRows.reduce((s,g)=>s+g.kg,0);
    return {
      totalNet,
      totalKg,
      totalBruto: rows.filter(r => r.esVenta).reduce((s,r)=>s+r.bruto,0),
      harinaNet,
      harinaKg,
      harinaAverage: harinaKg ? harinaNet / harinaKg : 0,
      groups: [...groups.values()].filter(g => g.neto || g.kg || families.includes(g.producto)),
      rows,
      excludedRows: excluded,
      boletaUnmatched,
      formula: {
        valorPromedioHarinas: 'NETO HARINAS / KG HARINAS',
        netoHarinas: 'HARINA GRANEL + HARINA 25KG + HARINA 10 KG',
        kgHarinas: 'KG HARINA GRANEL + KG HARINA 25KG + KG HARINA 10 KG',
        vnPct: 'NETO PRODUCTO / NETO TOTAL',
        kgPct: 'KG PRODUCTO / KG TOTAL'
      }
    };
  }

  let runtimeControls = {};

  function render(result, host) {
    const wrap = document.createElement('div');
    wrap.className = 'card molino-ine-maestro-card';
    wrap.style.marginTop = '14px';
    const pct = (n) => (n * 100).toFixed(2) + '%';
    wrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <div><h3 style="margin:0;color:#123a78">INE calculado con Maestro</h3>
        <div style="font-size:12px;color:#667085;margin-top:4px">Fuente: ${VERSION} · fórmulas replicadas desde BASE DE DATOS / INE (2)</div></div>
        <span style="padding:6px 9px;border-radius:999px;background:#ecfdf3;color:#067647;font-size:12px;font-weight:800">✓ Motor Maestro activo</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px">
        <div class="kpi"><small>NETO TOTAL</small><b>$${result.totalNet.toLocaleString('es-CL',{maximumFractionDigits:0})}</b></div>
        <div class="kpi"><small>KG VENTAS</small><b>${result.totalKg.toLocaleString('es-CL',{maximumFractionDigits:2})}</b></div>
        <div class="kpi"><small>NETO HARINAS</small><b>$${result.harinaNet.toLocaleString('es-CL',{maximumFractionDigits:0})}</b></div>
        <div class="kpi"><small>VALOR PROM. HARINAS</small><b>$${result.harinaAverage.toLocaleString('es-CL',{maximumFractionDigits:2})}/kg</b></div>
      </div>
      <div style="overflow:auto;margin-top:14px">
        <table class="table"><thead><tr><th>Producto INE</th><th>NETO</th><th>KG</th><th>Promedio/kg</th><th>V.N %</th><th>KG %</th></tr></thead>
        <tbody>${result.groups.map(g => `<tr><td>${g.producto || 'SIN CLASIFICAR'}</td><td>$${g.neto.toLocaleString('es-CL',{maximumFractionDigits:0})}</td><td>${g.kg.toLocaleString('es-CL',{maximumFractionDigits:2})}</td><td>$${g.promedio.toLocaleString('es-CL',{maximumFractionDigits:2})}</td><td>${pct(g.vnPct)}</td><td>${pct(g.kgPct)}</td></tr>`).join('')}</tbody></table>
      </div>
      <div style="margin-top:14px;padding:12px;background:#f8fafc;border:1px solid #d9e2ef;border-radius:10px;font-size:12px;color:#475467">
        <b>Fórmulas exactas aplicadas:</b><br>
        P.FCV = Valor Movto cuando Docto = Factura[FT] o Guía[ST].<br>
        FCV NETOS = P.FCV × Salida.<br>
        R.BOLETA = Valor Movto cuando Docto = Boleta[BT].<br>
        P.BOLETA = búsqueda exacta R→S del Maestro CODIGOS.<br>
        VALOR PROMEDIO = P.FCV + P.BOLETA.<br>
        NETO = VALOR PROMEDIO × Salida.<br>
        IVA = NETO × 19%.<br>
        IVA HARINAS = (FCV NETOS de harina) × 12%.<br>
        BRUTO = NETO + IVA + IVA HARINAS.<br>
        NETO HARINAS = HARINA GRANEL + HARINA 25KG + HARINA 10 KG.<br>
        KG HARINAS = KG de las mismas tres familias.<br>
        VALOR PROMEDIO HARINAS = NETO HARINAS ÷ KG HARINAS.<br>
        V.N % = NETO producto ÷ NETO total; KG % = KG producto ÷ KG total.
      </div>
      ${result.boletaUnmatched ? `<div class="status warn" style="margin-top:10px">⚠ ${result.boletaUnmatched} filas de Boleta no encontraron coincidencia exacta en CODIGOS R:S y se dejaron en 0 para no inventar precios.</div>` : ''}
      ${result.excludedRows ? `<div class="note" style="margin-top:8px">Filas excluidas del INE por no corresponder a Factura, Boleta o Guía: ${result.excludedRows.toLocaleString('es-CL')}.</div>` : ''}
    `;
    host.appendChild(wrap);
    return wrap;
  }

  async function processFile(file, host) {
    const XLSX = await loadXlsx();
    const params = await loadMaestroParameters();
    runtimeControls = params.controls;
    const baseCodes = Object.keys(params.code_map || {});
    if (baseCodes.length === 0) throw new Error('El Maestro no entregó códigos de producto.');
    paramsRuntime.codeControl.i2 = (() => {
      const row = Object.values(params.code_map).find(x => norm(x.producto) === norm('HARINA 10 KG'));
      return row?.producto || 'HARINA 10 KG';
    })();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false, raw: true });
    let selected = wb.SheetNames[0];
    let rows = null;
    for (const s of wb.SheetNames) {
      const matrix = XLSX.utils.sheet_to_json(wb.Sheets[s], { header: 1, defval: '' });
      try {
        const parsed = toObjects(matrix);
        if (parsed.rows.length && Object.keys(parsed.rows[0]).some(k => ['codigo','docto','valorMovto','salida'].includes(k))) {
          selected = s;
          rows = parsed.rows;
          break;
        }
      } catch (_) {}
    }
    if (!rows) throw new Error('No encontré en el archivo una hoja con columnas compatibles de Registro de Existencia.');
    const normalized = rows.map(r => ({
      codigo: firstMatching(r,['codigo']),
      producto: firstMatching(r,['producto']),
      detalle: firstMatching(r,['detalle']),
      docto: firstMatching(r,['docto']),
      folio: firstMatching(r,['folio']),
      valorMovto: firstMatching(r,['valorMovto']),
      salida: firstMatching(r,['salida']),
      entrada: firstMatching(r,['entrada']),
      saldo: firstMatching(r,['saldo']),
      fecha: firstMatching(r,['fecha']),
      origenDestino: firstMatching(r,['origenDestino']),
      bodega: firstMatching(r,['bodega']),
      um: firstMatching(r,['um'])
    }));
    const calc = normalized.map(r => calculateRow(r, params));
    const result = summarize(calc);
    result.sourceSheet = selected;
    return result;
  }

  function isExistenceInput(input) {
    const txt = norm((input.closest('section,article,.card,.content,form,div')?.textContent || '').slice(0, 700));
    if (/REGISTRO DE EXISTENCIA|CARGAR REGISTRO|SUBIR REGISTRO/.test(txt)) return true;
    const name = norm(input.getAttribute('name') || input.id || '');
    return /EXIST|REGISTRO/.test(name);
  }

  function injectCardHost(input) {
    const host = document.createElement('div');
    host.dataset.molinoIneHost = '1';
    const parent = input.closest('section,article,.card,.content,form,div') || input.parentElement;
    parent?.appendChild(host);
    return host;
  }

  function statusHost(input) {
    let host = input.parentElement.querySelector('[data-molino-ine-status]');
    if (!host) { host = document.createElement('div'); host.dataset.molinoIneStatus='1'; host.style.cssText='margin-top:10px;font-size:12px;color:#667085'; input.parentElement.appendChild(host); }
    return host;
  }

  document.addEventListener('change', async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
    if (!isExistenceInput(input)) return;
    const file = input.files?.[0];
    if (!file) return;
    const status = statusHost(input);
    status.textContent = 'Procesando Registro de Existencia con las fórmulas del Maestro…';
    try {
      const host = injectCardHost(input);
      host.innerHTML = '';
      const result = await processFile(file, host);
      window.MolinoINE = { version: VERSION, result, parameters: true };
      window.dispatchEvent(new CustomEvent('molino:ine-ready', { detail: result }));
      status.textContent = `INE calculado desde ${result.sourceSheet} · ${result.rows.length.toLocaleString('es-CL')} filas.`;
      status.style.color = '#067647';
    } catch (err) {
      status.textContent = `INE Maestro: ${err?.message || err}`;
      status.style.color = '#b42318';
      console.error('[Molino INE Maestro]', err);
    }
  }, true);

  window.MolinoINE = { version: VERSION, processFile, loadMaestroParameters };
})();
