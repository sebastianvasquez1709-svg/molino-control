// Only the Edge environment receives the Supabase service key.
// n8n and the parser use the existing scoped header credential.
const ACTIONS = Object.freeze({
  claim: ['n8n_claim_import_jobs', ['p_worker_id', 'p_limit']],
  stage: ['n8n_stage_import_rows', ['p_job_id', 'p_worker_id', 'p_rows']],
  findings: ['n8n_append_import_errors', ['p_job_id', 'p_worker_id', 'p_errors']],
  heartbeat: ['n8n_heartbeat_import_job', ['p_job_id', 'p_worker_id']],
  finish: ['n8n_finish_import_job', ['p_job_id', 'p_worker_id', 'p_status', 'p_rows_total', 'p_rows_valid', 'p_rows_error', 'p_result_summary', 'p_last_error']],
  fail: ['n8n_fail_import_job', ['p_job_id', 'p_worker_id', 'p_error_code', 'p_retryable']],
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
class GatewayError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
async function readJson(req) {
  if (!req.headers.get('content-type')?.startsWith('application/json')) throw new GatewayError(415, 'json_required');
  if (Number(req.headers.get('content-length')) > MAX_BODY_BYTES) throw new GatewayError(413, 'body_too_large');
  const reader = req.body?.getReader();
  if (!reader) throw new GatewayError(400, 'invalid_json');
  const chunks = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new GatewayError(413, 'body_too_large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new GatewayError(400, 'invalid_json'); }
}
export function createHandler({ supabaseUrl, serviceKey, fetchFn = fetch, log = console.info, randomUUID = () => crypto.randomUUID() }) {
  return async req => {
    const requestId = randomUUID(); let action = 'unknown'; let jobId;
    const respond = (status, data) => new Response(JSON.stringify({ ...data, request_id: requestId }), {
      status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-request-id': requestId, ...(status === 429 ? {'retry-after': '60'} : {}) },
    });
    if (req.method !== 'POST') return respond(405, { ok: false, error: 'method_not_allowed' });
    if (!supabaseUrl || !serviceKey) return respond(503, { ok: false, error: 'gateway_not_configured' });
    const token = req.headers.get('x-molino-n8n-token')?.trim();
    if (!token || token.length > 1024) return respond(401, { ok: false, error: 'invalid_token' });
    const headers = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json', 'x-molino-n8n-token': token };
    const rpc = async (name, params) => {
      const response = await fetchFn(`${supabaseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST', headers, body: JSON.stringify(params), signal: AbortSignal.timeout(30000), redirect: 'error',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (data?.code === '42501') throw new GatewayError(401, 'invalid_token');
        if (data?.code === '55000') throw new GatewayError(409, 'lease_not_active');
        if (data?.code === '22023') throw new GatewayError(422, 'invalid_job_data');
        throw new GatewayError(502, 'database_unavailable');
      }
      return data;
    };
    try {
      const body = await readJson(req);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new GatewayError(400, 'invalid_body');
      action = typeof body.action === 'string' ? body.action : '';
      if (!['health', 'file', ...Object.keys(ACTIONS)].includes(action)) throw new GatewayError(400, 'invalid_action');
      if (await rpc('n8n_gateway_authorize', { p_action: action }) !== true) throw new GatewayError(429, 'rate_limit');
      const params = body.params ?? {};
      if (typeof params !== 'object' || Array.isArray(params)) throw new GatewayError(400, 'invalid_params');
      const allowed = action === 'file' ? ['p_job_id', 'p_worker_id'] : (ACTIONS[action]?.[1] || []);
      if (Object.keys(params).some(key => !allowed.includes(key))) throw new GatewayError(400, 'unexpected_parameter');
      if (action !== 'health') {
        if (typeof params.p_worker_id !== 'string' || !params.p_worker_id.trim() || params.p_worker_id.length > 200) throw new GatewayError(400, 'invalid_worker');
        if (action !== 'claim' && !UUID.test(params.p_job_id || '')) throw new GatewayError(400, 'invalid_job');
        jobId = params.p_job_id;
      }
      let data;
      if (action === 'health') {
        data = { version: '2026-09-23', gateway: 'ready', publication_enabled: false };
      } else if (action === 'file') {
        const rows = await rpc('n8n_import_file_context', params);
        const job = rows?.[0];
        if (!job) throw new GatewayError(409, 'lease_not_active');
        const path = String(job.storage_path || '');
        if (!path || path.startsWith('/') || path.split('/').some(p => !p || p === '..' || p === '.')) throw new GatewayError(422, 'invalid_storage_path');
        const storageResponse = await fetchFn(`${supabaseUrl}/storage/v1/object/sign/excel-imports/${path.split('/').map(encodeURIComponent).join('/')}`, {
          method: 'POST', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ expiresIn: 300 }), signal: AbortSignal.timeout(30000), redirect: 'error',
        });
        if (!storageResponse.ok) throw new GatewayError(storageResponse.status === 404 ? 422 : 502, 'file_unavailable');
        const signed = await storageResponse.json();
        const relative = signed.signedURL || signed.signedUrl;
        if (typeof relative !== 'string') throw new GatewayError(502, 'signed_url_unavailable');
        const url = new URL(relative.startsWith('/storage/v1/') || relative.startsWith('https://') ? relative : `/storage/v1${relative.startsWith('/') ? '' : '/'}${relative}`, supabaseUrl);
        if (url.origin !== new URL(supabaseUrl).origin || !url.pathname.startsWith('/storage/v1/object/sign/excel-imports/')) throw new GatewayError(502, 'invalid_signed_url');
        data = { ...job, signed_url: url.toString() };
      } else {
        data = await rpc(ACTIONS[action][0], params);
        if (action === 'heartbeat' && data !== true) throw new GatewayError(409, 'lease_not_active');
        if (['finish', 'fail'].includes(action) && !data?.[0]?.id) throw new GatewayError(409, 'lease_not_active');
      }
      log(JSON.stringify({ request_id: requestId, action, job_id: jobId, status: 200 }));
      return respond(200, { ok: true, data });
    } catch (error) {
      const status = error instanceof GatewayError ? error.status : 502;
      const code = error instanceof GatewayError ? error.code : 'gateway_unavailable';
      log(JSON.stringify({ request_id: requestId, action, job_id: jobId, status, error: code }));
      return respond(status, { ok: false, error: code });
    }
  };
}
