/* Molino Control · panel seguro de importaciones n8n
 * El navegador usa únicamente la sesión JWT del usuario. Nunca contiene el
 * token privado de n8n ni una service_role de Supabase.
 */
(() => {
  'use strict';
  const ROOT_ID = 'molinoAutomationImport';
  const MAX_FILE_BYTES = 50 * 1024 * 1024;
  let refreshTimer = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const fmtDate = value => value
    ? new Date(value).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
    : '—';
  const statusLabels = Object.freeze({
    pendiente: ['Pendiente', 'warn'],
    procesando: ['Procesando', 'info'],
    validado: ['Validado', 'ok'],
    rechazado: ['Rechazado', 'err'],
    publicado: ['Publicado', 'ok'],
    error: ['Error técnico', 'err'],
  });

  function sha256Hex(buffer) {
    return crypto.subtle.digest('SHA-256', buffer).then(digest =>
      [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join(''));
  }

  function safeFileName(name) {
    const cleaned = String(name || 'archivo.xlsx')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 160);
    return cleaned || 'archivo.xlsx';
  }

  function setMessage(message, kind = 'info') {
    const host = document.getElementById('automationMessage');
    if (host) host.innerHTML = `<div class="status ${kind}">${esc(message)}</div>`;
  }

  function renderJobs(rows) {
    const host = document.getElementById('automationJobs');
    if (!host) return;
    if (!rows.length) {
      host.innerHTML = '<div class="empty">Aún no hay importaciones solicitadas por este usuario.</div>';
      return;
    }
    host.innerHTML = `<div class="tableWrap"><table class="table automationTable"><thead><tr>
      <th>Archivo</th><th>Tipo</th><th>Estado</th><th>Filas</th><th>Intentos</th><th>Fecha</th><th>Detalle</th>
    </tr></thead><tbody>${rows.map(row => {
      const badge = statusLabels[row.status] || [row.status || 'Desconocido', 'info'];
      const summary = row.result_summary && typeof row.result_summary === 'object'
        ? row.result_summary : {};
      const findings = summary.findings || {};
      const detail = row.last_error || (
        summary.publication_performed === false
          ? `${Number(findings.warning || 0)} advertencias · sin publicación operacional`
          : '—'
      );
      return `<tr>
        <td><strong>${esc(row.file_name)}</strong><small>${esc(row.id)}</small></td>
        <td>${esc(row.kind || 'maestro')}</td>
        <td><span class="automationBadge ${badge[1]}">${esc(badge[0])}</span></td>
        <td>${Number(row.rows_valid || 0).toLocaleString('es-CL')} / ${Number(row.rows_total || 0).toLocaleString('es-CL')}</td>
        <td>${Number(row.attempt_count || 0)}</td>
        <td>${esc(fmtDate(row.created_at))}</td>
        <td>${esc(detail)}</td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
  }

  async function loadJobs({ quiet = false } = {}) {
    const refresh = document.getElementById('automationRefresh');
    if (refresh) refresh.disabled = true;
    try {
      const sb = await window.MolinoCloud.client();
      const { data, error } = await sb.rpc('molino_list_import_jobs', { p_limit: 25 });
      if (error) throw error;
      renderJobs(Array.isArray(data) ? data : []);
    } catch (error) {
      const host = document.getElementById('automationJobs');
      if (host) host.innerHTML = `<div class="status warn"><b>No se pudo consultar la cola.</b> ${esc(error?.message || 'No se pudo consultar la cola.')}</div>`;
      if (!quiet) setMessage('No se pudo consultar la cola. Verifica tu sesión de administrador y vuelve a intentar.', 'warn');
    } finally {
      if (refresh) refresh.disabled = false;
      scheduleRefresh();
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (document.getElementById(ROOT_ID) && !document.hidden) loadJobs({ quiet: true });
    }, 15000);
  }

  async function uploadAndQueue(file, kind) {
    if (!file) throw new Error('Selecciona un archivo Excel.');
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) throw new Error('Solo se permiten archivos XLSX o XLSM.');
    if (!file.size || file.size > MAX_FILE_BYTES) throw new Error('El archivo debe pesar entre 1 byte y 50 MiB.');

    const session = await window.MolinoCloud.getSession();
    const userId = session?.user?.id;
    if (!userId || String(session.user.role || '').toUpperCase() !== 'ADMIN') {
      throw new Error('Se requiere una sesión activa con rol ADMIN.');
    }

    setMessage('Calculando huella SHA-256 del archivo…', 'info');
    const checksum = await sha256Hex(await file.arrayBuffer());
    const fileName = safeFileName(file.name);
    const storagePath = `${userId}/${checksum}/${fileName}`;
    const sb = await window.MolinoCloud.client();
    let uploadedNow = false;

    setMessage('Subiendo el Excel original al almacenamiento privado…', 'info');
    const upload = await sb.storage.from('excel-imports').upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    if (upload.error) {
      const duplicate = String(upload.error.statusCode || '') === '409'
        || /already exists|duplicate/i.test(String(upload.error.message || ''));
      if (!duplicate) throw upload.error;
    } else {
      uploadedNow = true;
    }

    setMessage('Encolando la validación segura para n8n…', 'info');
    const queued = await sb.rpc('molino_enqueue_import', {
      p_file_name: file.name,
      p_storage_path: storagePath,
      p_checksum_sha256: checksum,
      p_kind: kind,
      p_metadata: {
        source: 'molino-control-panel',
        client_file_size: file.size,
        last_modified: file.lastModified || null,
      },
    });
    if (queued.error) {
      if (uploadedNow) await sb.storage.from('excel-imports').remove([storagePath]).catch(() => {});
      throw queued.error;
    }
    const row = Array.isArray(queued.data) ? queued.data[0] : queued.data;
    return { row, checksum };
  }

  async function submit(event) {
    event.preventDefault();
    const button = document.getElementById('automationSubmit');
    const fileInput = document.getElementById('automationFile');
    const kindInput = document.getElementById('automationKind');
    if (button) button.disabled = true;
    try {
      const result = await uploadAndQueue(fileInput?.files?.[0], kindInput?.value || 'maestro');
      setMessage(`Importación ${result.row?.status || 'pendiente'} · trabajo ${result.row?.id || ''}`, 'ok');
      if (fileInput) fileInput.value = '';
      await loadJobs({ quiet: true });
    } catch (error) {
      setMessage(error?.message || 'No se pudo crear la importación.', 'err');
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function render() {
    clearTimeout(refreshTimer);
    const host = document.getElementById('content');
    if (!host) return;
    const session = await window.MolinoCloud.getSession();
    if (String(session?.user?.role || '').toUpperCase() !== 'ADMIN') {
      host.innerHTML = '<div class="card"><div class="status err">Acceso restringido a administradores.</div></div>';
      return;
    }

    host.innerHTML = `<section id="${ROOT_ID}">
      <div class="card automationHero">
        <div class="sectionTitle"><div><h3>🤖 Automatización n8n</h3><div class="note">Carga privada, trazabilidad por trabajo y validación sin publicar datos operacionales.</div></div><span class="pill">STAGING SEGURO</span></div>
        <form id="automationForm" class="automationForm">
          <label><span>Tipo de archivo</span><select id="automationKind"><option value="maestro">Maestro Excel</option><option value="existencia">Registro de existencia</option></select></label>
          <label class="automationFile"><span>Archivo XLSX/XLSM · máximo 50 MiB</span><input id="automationFile" type="file" accept=".xlsx,.xlsm" required></label>
          <button id="automationSubmit" class="primary" type="submit">Subir y validar</button>
        </form>
        <div id="automationMessage" class="automationMessage"><div class="status info">El Excel se guarda sin modificar y se identifica por SHA-256.</div></div>
      </div>
      <div class="card" style="margin-top:14px">
        <div class="sectionTitle"><div><h3>Trabajos recientes</h3><div class="note">La fase actual solo valida y prepara staging; no publica al Maestro operacional.</div></div><button id="automationRefresh" class="secondary" type="button">Actualizar</button></div>
        <div id="automationJobs"><div class="status info">Consultando cola…</div></div>
      </div>
    </section>`;

    if (!document.getElementById('automationPanelStyles')) {
      const style = document.createElement('style');
      style.id = 'automationPanelStyles';
      style.textContent = '.automationHero{border-color:#cddcf0!important}.automationForm{display:grid;grid-template-columns:220px minmax(260px,1fr) auto;gap:12px;align-items:end}.automationForm label{display:grid;gap:6px;font-size:11px;font-weight:800;color:#475467;text-transform:uppercase;letter-spacing:.04em}.automationForm input,.automationForm select{width:100%;text-transform:none}.automationMessage{margin-top:14px}.automationBadge{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:10px;font-weight:900;white-space:nowrap}.automationBadge.ok{background:#e9f8ef;color:#137333}.automationBadge.warn{background:#fff4d6;color:#9a6700}.automationBadge.info{background:#e8f1ff;color:#174b91}.automationBadge.err{background:#fff0f0;color:#b42318}.automationTable td:first-child strong,.automationTable td:first-child small{display:block}.automationTable td:first-child small{margin-top:4px;color:#98a2b3;font-size:9px}.automationTable td{max-width:300px;overflow-wrap:anywhere}@media(max-width:850px){.automationForm{grid-template-columns:1fr}.automationForm button{width:100%}}';
      document.head.appendChild(style);
    }

    document.getElementById('automationForm')?.addEventListener('submit', submit);
    document.getElementById('automationRefresh')?.addEventListener('click', () => loadJobs());
    await loadJobs({ quiet: true });
  }

  window.MolinoAutomationImport = Object.freeze({ render });
})();
