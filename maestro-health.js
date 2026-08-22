(() => {
  'use strict';

  const SUPABASE_URL = 'https://dadggurateghfumfcshz.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_MtIFqV5vVxPNwkCxc82yOw_lCe5oFw4';

  async function maestroHealth() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/maestro_public_health`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: '{}',
      cache: 'no-store'
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { ok: false, raw: text }; }

    if (!response.ok) {
      throw new Error(`maestro_public_health ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
    }

    return data;
  }

  window.MolinoMaestroHealth = Object.freeze({ maestroHealth });
})();
