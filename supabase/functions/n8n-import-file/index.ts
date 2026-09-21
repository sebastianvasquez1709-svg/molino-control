import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://dadggurateghfumfcshz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_MtIFqV5vVxPNwkCxc82yOw_lCe5oFw4";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BUCKET = "excel-imports";
const SIGNED_URL_TTL_SECONDS = 300;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(503, { ok: false, error: "function_not_configured" });
  }

  const token = req.headers.get("x-molino-n8n-token")?.trim() ?? "";
  if (!token) return json(401, { ok: false, error: "missing_token" });

  const authResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/n8n_authorize_request`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "content-type": "application/json",
      "x-molino-n8n-token": token,
    },
    body: "{}",
  });
  if (!authResponse.ok) return json(401, { ok: false, error: "invalid_token" });

  let body: { job_id?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  const jobId = String(body.job_id ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) {
    return json(400, { ok: false, error: "invalid_job_id" });
  }

  const jobResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/import_jobs?id=eq.${encodeURIComponent(jobId)}` +
      "&select=id,file_name,storage_path,checksum_sha256,status,metadata",
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!jobResponse.ok) return json(502, { ok: false, error: "job_lookup_failed" });

  const jobs = await jobResponse.json();
  const job = Array.isArray(jobs) ? jobs[0] : null;
  if (!job || job.status !== "procesando") {
    return json(409, { ok: false, error: "job_not_processing" });
  }

  const storagePath = String(job.storage_path ?? "");
  if (!storagePath || storagePath.startsWith("/") || storagePath.includes("..")) {
    return json(409, { ok: false, error: "invalid_storage_path" });
  }

  const signResponse = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${encodeStoragePath(storagePath)}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
    },
  );
  if (!signResponse.ok) return json(502, { ok: false, error: "signed_url_failed" });

  const signed = await signResponse.json();
  const relativeUrl = String(signed.signedURL ?? signed.signedUrl ?? "");
  if (!relativeUrl) return json(502, { ok: false, error: "signed_url_missing" });

  return json(200, {
    ok: true,
    job_id: job.id,
    file_name: job.file_name,
    checksum_sha256: job.checksum_sha256,
    kind: job.metadata?.kind ?? "maestro",
    signed_url: relativeUrl.startsWith("http") ? relativeUrl : `${SUPABASE_URL}${relativeUrl}`,
    expires_in: SIGNED_URL_TTL_SECONDS,
  });
});
