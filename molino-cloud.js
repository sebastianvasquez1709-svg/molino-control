/* Molino Control · Cloud Data Layer
 * Browser-safe Supabase client. Never contains service_role secrets.
 * Optimized for reuse: request coalescing, short-lived snapshot cache,
 * bounded timeouts and a single retry for transient network/RPC failures.
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
    const sb = await client();
    const { data, error } = await withTimeout(sb.auth.getSession());
    if (error) throw error;
    return data.session;
  }

  async function signIn(email, password) {
    const sb = await client();
    const { data, error } = await withTimeout(sb.auth.signInWithPassword({ email, password }));
    if (error) throw error;
    clearCache();
    return data;
  }

  async function signOut() {
    const sb = await client();
    const { error } = await withTimeout(sb.auth.signOut());
    clearCache();
    if (error) throw error;
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
    const sb = await client();
    const { data, error } = await withTimeout(sb.rpc('molino_app_snapshot'));
    if (!error) {
      snapshotCache = { data, at: Date.now() };
      return data;
    }

    // Compatibility fallback: the current database exposes maestro_public_health
    // but not molino_app_snapshot. Keep the cloud layer usable instead of failing
    // every caller when the optional aggregate RPC is absent.
    const healthData = await withTimeout(sb.rpc('maestro_public_health'));
    if (healthData.error) throw error;
    const fallback = Object.freeze({
      source: 'maestro_public_health',
      health: healthData.data,
      clients: [],
      documents: [],
      invoices: [],
      guides: [],
      boletas: [],
      existence: [],
      dispatches: []
    });
    snapshotCache = { data: fallback, at: Date.now() };
    return fallback;
  }

  async function snapshot(options = {}) {
    const force = options?.force === true;
    const maxAgeMs = Number.isFinite(Number(options?.maxAgeMs)) ? Number(options.maxAgeMs) : SNAPSHOT_TTL_MS;
    const fresh = !force && snapshotCache && (Date.now() - snapshotCache.at) < maxAgeMs;
    if (fresh) return snapshotCache.data;

    if (!snapshotPromise || force) {
      snapshotPromise = retryOnce(fetchSnapshot).finally(() => {
        snapshotPromise = null;
      });
    }
    return await snapshotPromise;
  }

  function clearCache() {
    snapshotCache = null;
    snapshotPromise = null;
  }

  function cacheInfo() {
    return Object.freeze({
      cached: !!snapshotCache,
      ageMs: snapshotCache ? Date.now() - snapshotCache.at : null,
      ttlMs: SNAPSHOT_TTL_MS
    });
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
