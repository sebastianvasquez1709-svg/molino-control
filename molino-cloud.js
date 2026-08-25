/* Molino Control · Cloud Data Layer
 * Browser-safe Supabase client. Never contains service_role secrets.
 * Compatibility bridge: the current Molino login is validated by a protected
 * database RPC until Supabase Auth users are provisioned.
 */
(() => {
  'use strict';

  const SUPABASE_URL = 'https://dadggurateghfumfcshz.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_MtIFqV5vVxPNwkCxc82yOw_lCe5oFw4';
  const SNAPSHOT_TTL_MS = 60_000;
  const REQUEST_TIMEOUT_MS = 12_000;

  let clientPromise;
  let snapshotCache = null;
  let snapshotPromise = null;
  let localSession = null;

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  async function withTimeout(promise, ms = REQUEST_TIMEOUT_MS) {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Tiempo de espera agotado (${ms} ms).`)), ms);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function retryOnce(task) {
    try {
      return await task();
    } catch (firstError) {
      await sleep(250);
      return await task().catch(secondError => {
        secondError.cause = firstError;
        throw secondError;
      });
    }
  }

  async function client() {
    if (!clientPromise) {
      clientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
        .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
    }
    return clientPromise;
  }

  async function getSession() {
    return localSession;
  }

  async function signIn(identifier, password) {
    const sb = await client();
    const { data, error } = await withTimeout(sb.rpc('molino_local_auth', {
      p_rut: String(identifier || '').trim(),
      p_pin: String(password || '')
    }));
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.message || 'Credenciales inválidas.');
    localSession = {
      local: true,
      user: {
        id: data.id,
        email: data.email,
        rut: data.rut,
        role: String(data.rol || 'operador').toUpperCase(),
        nombre: data.nombre || data.email
      }
    };
    localSession._identifier = String(identifier || '').trim();
    localSession._password = String(password || '');
    clearCache();
    return localSession;
  }

  async function signOut() {
    localSession = null;
    clearCache();
  }

  async function health() {
    return await retryOnce(async () => {
      const sb = await client();
      const { data, error } = await withTimeout(sb.rpc('maestro_public_health'));
      if (error) throw error;
      return data;
    });
  }

  async function fetchSnapshot() {
    if (!localSession) throw new Error('Sesión no iniciada.');
    const sb = await client();
    const { data, error } = await withTimeout(sb.rpc('molino_app_snapshot_local', {
      p_rut: localSession._identifier,
      p_pin: localSession._password
    }));
    if (error) throw error;
    if (!data) throw new Error('Supabase no devolvió el Maestro.');
    const docs = Array.isArray(data.documentos) ? data.documentos : [];
    const invoices = docs.filter(d => /FACTURA/i.test(String(d?.tipo || '')));
    const guides = docs.filter(d => /GU[IÍ]A/i.test(String(d?.tipo || '')));
    const boletas = docs.filter(d => /BOLETA/i.test(String(d?.tipo || '')));
    const nc = docs.filter(d => /NOTA DE CR[EÉ]DITO/i.test(String(d?.tipo || '')) || /NOTA DE D[EÉ]BITO/i.test(String(d?.tipo || '')));
    const totalNeto = docs.reduce((s,d) => s + Number(d?.neto || 0), 0);
    const totalIva = docs.reduce((s,d) => s + Number(d?.iva || 0), 0);
    const total = docs.reduce((s,d) => s + Number(d?.total || 0), 0);
    const snap = {
      source: 'supabase',
      fileName: data.maestro?.file || '',
      lastLoaded: data.maestro?.updated_at ? Date.parse(data.maestro.updated_at) : Date.now(),
      sheets: Array.from({length: Number(data.maestro?.sheets || 0)}, (_,i) => `Hoja ${i+1}`),
      metrics: {
        ine: { totalNeto: 0, totalKg: 0, totalPromedio: 0, netoHarinas: 0, kgHarinas: 0, promedioHarinas: 0, periodo: '', items: [] },
        sacos: { ventasSacos: 0, kgSacos: 0, items: [] },
        granel: { totalGranel: 0, items: [] },
        iva: { neto: totalNeto, iva: totalIva, total, docs: docs.length }
      },
      documents: docs,
      clients: (data.clientes || []).map(c => ({...c, key: c.id, nombre: c.razon_social || c.nombre_fantasia || c.rut || 'Cliente'})),
      guides,
      nc,
      invoices,
      boletas,
      products: (data.productos || []).map(p => p.nombre || p.codigo || ''),
      dispatches: (data.despachos || []).map(d => ({...d, cliente: d.cliente || '', rut: d.rut || '', producto: d.producto || '', kg: Number(d.kilos || 0), sacos: Number(d.sacos || 0)}))
    };
    snapshotCache = { data: snap, at: Date.now() };
    return snap;
  }

  async function snapshot(options = {}) {
    const force = options?.force === true;
    const maxAgeMs = Number.isFinite(Number(options?.maxAgeMs)) ? Number(options.maxAgeMs) : SNAPSHOT_TTL_MS;
    const fresh = !force && snapshotCache && (Date.now() - snapshotCache.at) < maxAgeMs;
    if (fresh) return snapshotCache.data;
    if (!snapshotPromise || force) {
      snapshotPromise = retryOnce(fetchSnapshot).finally(() => { snapshotPromise = null; });
    }
    return await snapshotPromise;
  }

  function clearCache() {
    snapshotCache = null;
    snapshotPromise = null;
  }

  function cacheInfo() {
    return Object.freeze({ cached: !!snapshotCache, ageMs: snapshotCache ? Date.now() - snapshotCache.at : null, ttlMs: SNAPSHOT_TTL_MS });
  }

  async function list(table, options = {}) {
    return await retryOnce(async () => {
      const sb = await client();
      let q = sb.from(table).select(options.select || '*');
      if (options.order) q = q.order(options.order.column, { ascending: options.order.ascending !== false });
      if (options.limit) q = q.limit(options.limit);
      if (options.eq) q = q.eq(options.eq.column, options.eq.value);
      const { data, error } = await withTimeout(q);
      if (error) throw error;
      return data || [];
    });
  }

  window.MolinoCloud = Object.freeze({
    config: Object.freeze({ SUPABASE_URL }),
    client,
    getSession,
    signIn,
    signOut,
    health,
    snapshot,
    clearCache,
    cacheInfo,
    list
  });
})();