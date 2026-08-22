/* Molino Control · Cloud Data Layer
 * Browser-safe Supabase client. Never contains service_role secrets.
 */
(() => {
  'use strict';

  const SUPABASE_URL = 'https://dadggurateghfumfcshz.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_MtIFqV5vVxPNwkCxc82yOw_lCe5oFw4';

  let clientPromise;
  async function client() {
    if (!clientPromise) {
      clientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
        .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
    }
    return clientPromise;
  }

  async function getSession() {
    const sb = await client();
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function signIn(email, password) {
    const sb = await client();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const sb = await client();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  }

  async function health() {
    const sb = await client();
    const { data, error } = await sb.rpc('maestro_public_health');
    if (error) throw error;
    return data;
  }

  async function snapshot() {
    const sb = await client();
    const { data, error } = await sb.rpc('molino_app_snapshot');
    if (error) throw error;
    return data;
  }

  async function list(table, options = {}) {
    const sb = await client();
    let q = sb.from(table).select(options.select || '*');
    if (options.order) q = q.order(options.order.column, { ascending: options.order.ascending !== false });
    if (options.limit) q = q.limit(options.limit);
    if (options.eq) q = q.eq(options.eq.column, options.eq.value);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  window.MolinoCloud = Object.freeze({
    config: Object.freeze({ SUPABASE_URL }),
    client,
    getSession,
    signIn,
    signOut,
    health,
    snapshot,
    list
  });
})();
