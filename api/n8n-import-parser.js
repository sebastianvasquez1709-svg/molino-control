'use strict';

const ExcelJS = require('exceljs');
const { createHash } = require('node:crypto');
const { createWriteStream } = require('node:fs');
const { unlink } = require('node:fs/promises');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const SUPABASE_URL = 'https://dadggurateghfumfcshz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_MtIFqV5vVxPNwkCxc82yOw_lCe5oFw4';
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_SUBSTANTIVE_ROWS = 100000;
const STAGE_BATCH_SIZE = 200;

const MAESTRO_SHEETS = Object.freeze({
  'CODIGOS': { required: true, stage: true, maxColumns: 30 },
  'BASE DE DATOS': { required: true, stage: true, maxColumns: 52 },
  'GUIAS': { required: false, stage: true, maxColumns: 17 },
  'LIBRO': { required: false, stage: false, maxColumns: 26 },
  'BOLETAS': { required: false, stage: false, maxColumns: 10 },
});

function reply(res, status, body) {
  res.status(status);
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function requestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length <= 20000) return JSON.parse(req.body);
  throw new Error('invalid request body');
}

function columnLetter(number) {
  let value = Number(number);
  let out = '';
  while (value > 0) {
    value -= 1;
    out = String.fromCharCode(65 + (value % 26)) + out;
    value = Math.floor(value / 26);
  }
  return out || 'A';
}

function jsonValue(value, depth = 0) {
  if (value == null) return null;
  if (depth > 3) return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (Array.isArray(value)) return value.map(item => jsonValue(item, depth + 1));
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  if (typeof value !== 'object') return value;
  if (Object.prototype.hasOwnProperty.call(value, 'formula')) {
    return { formula: String(value.formula), result: jsonValue(value.result, depth + 1) };
  }
  if (Object.prototype.hasOwnProperty.call(value, 'sharedFormula')) {
    return { sharedFormula: String(value.sharedFormula), result: jsonValue(value.result, depth + 1) };
  }
  if (Object.prototype.hasOwnProperty.call(value, 'error')) return { error: String(value.error) };
  if (Array.isArray(value.richText)) return value.richText.map(part => part.text || '').join('');
  if (Object.prototype.hasOwnProperty.call(value, 'text')) return String(value.text ?? '');
  const out = {};
  for (const [key, item] of Object.entries(value)) out[key] = jsonValue(item, depth + 1);
  return out;
}

function flatValue(value) {
  const normalized = jsonValue(value);
  if (normalized && typeof normalized === 'object') {
    if (Object.prototype.hasOwnProperty.call(normalized, 'result')) return flatValue(normalized.result);
    if (Object.prototype.hasOwnProperty.call(normalized, 'error')) return normalized.error;
  }
  return normalized;
}

function errorValue(value, missingFormulaIsError = false) {
  if (typeof value === 'number' && Number.isNaN(value)) return '#CALCULATION_ERROR';
  if (missingFormulaIsError
      && value
      && typeof value === 'object'
      && (Object.prototype.hasOwnProperty.call(value, 'formula')
        || Object.prototype.hasOwnProperty.call(value, 'sharedFormula'))
      && !Object.prototype.hasOwnProperty.call(value, 'result')) {
    return '#CALCULATION_ERROR';
  }
  const normalized = jsonValue(value);
  if (!normalized || typeof normalized !== 'object') return null;
  if (typeof normalized.error === 'string') return normalized.error;
  if (Object.prototype.hasOwnProperty.call(value, 'result')) {
    return errorValue(value.result, missingFormulaIsError);
  }
  return null;
}

function isSubstantive(value) {
  const flat = flatValue(value);
  return flat !== null && flat !== undefined && String(flat).trim() !== '';
}

function isBusinessCell(sheetName, colNumber) {
  if (sheetName === 'LIBRO') return colNumber <= 15;
  if (sheetName === 'BOLETAS') return colNumber <= 10;
  return true;
}

function safeHeader(value, letter, used) {
  let key = String(flatValue(value) ?? '').trim();
  if (!key) key = `columna_${letter}`;
  key = key.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').slice(0, 120);
  const base = key;
  let suffix = 2;
  while (used.has(key)) key = `${base}_${suffix++}`;
  used.add(key);
  return key;
}

async function rpc(name, body, token) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'content-type': 'application/json',
      'x-molino-n8n-token': token,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`${name} failed (${response.status}): ${detail}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function downloadVerifiedFile(signedUrl, expectedChecksum, filePath) {
  const url = new URL(signedUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'dadggurateghfumfcshz.supabase.co') {
    throw new Error('signed URL host is not allowed');
  }
  if (!url.pathname.includes('/storage/v1/object/sign/excel-imports/')) {
    throw new Error('signed URL does not belong to excel-imports');
  }

  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok || !response.body) throw new Error(`file download failed (${response.status})`);

  const hash = createHash('sha256');
  let bytes = 0;
  const guard = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > MAX_FILE_BYTES) return callback(new Error('file exceeds 50 MiB'));
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body), guard, createWriteStream(filePath, { flags: 'wx' }));
  const checksum = hash.digest('hex');
  if (checksum !== expectedChecksum) throw new Error('checksum mismatch');
  return bytes;
}

function rowCells(row, maxColumns) {
  const cells = [];
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (colNumber <= maxColumns) cells.push({ colNumber, value: cell.value });
  });
  return cells;
}

function recordFormulaError(aggregates, sheetName, rowNumber, colNumber, code, severity) {
  const column = columnLetter(colNumber);
  const key = `${severity}|${sheetName}|${column}|${code}`;
  const current = aggregates.get(key) || {
    severity,
    sheet_name: sheetName,
    row_number: rowNumber,
    column_name: column,
    error_code: 'EXCEL_FORMULA_ERROR',
    message: `${code} detectado en ${sheetName}, columna ${column}`,
    details: { excel_error: code, count: 0, first_rows: [] },
  };
  current.details.count += 1;
  if (current.details.first_rows.length < 10) current.details.first_rows.push(rowNumber);
  aggregates.set(key, current);
}

async function flushStage(batch, jobId, workerId, token) {
  if (!batch.length) return 0;
  const count = await rpc('n8n_stage_import_rows', {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_rows: batch,
  }, token);
  batch.length = 0;
  return Number(count || 0);
}

async function parseWorkbook({ filePath, kind, jobId, workerId, token }) {
  const sheetStats = {};
  const seenSheets = new Set();
  const formulaErrors = new Map();
  const findings = [];
  const stageBatch = [];
  let stagedRows = 0;
  let rowsWithErrors = 0;
  let totalSubstantiveRows = 0;
  let existenceSheetSelected = false;
  let batchesSinceHeartbeat = 0;

  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    entries: 'emit',
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    styles: 'ignore',
    worksheets: 'emit',
  });

  for await (const worksheet of workbook) {
    const sheetName = String(worksheet.name || '').trim() || `Hoja ${worksheet.id || ''}`.trim();
    seenSheets.add(sheetName);
    const maestroConfig = MAESTRO_SHEETS[sheetName];
    const existenceTarget = kind === 'existencia' && !existenceSheetSelected;
    if (existenceTarget) existenceSheetSelected = true;
    const config = kind === 'maestro'
      ? maestroConfig
      : (existenceTarget ? { required: true, stage: true, maxColumns: 80 } : null);
    const shouldInspect = Boolean(config) || (kind === 'maestro' && sheetName === 'LIBRO');
    let substantiveRows = 0;
    let headerMap = null;
    let headerRowNumber = null;

    for await (const yielded of worksheet) {
      const rows = Array.isArray(yielded) ? yielded : [yielded];
      for (const row of rows) {
        if (!shouldInspect || !row || typeof row.eachCell !== 'function') continue;
        const maxColumns = config?.maxColumns || 100;
        const cells = rowCells(row, maxColumns);
        const businessSubstantive = cells.some(cell =>
          isBusinessCell(sheetName, cell.colNumber) && isSubstantive(cell.value));
        const rowErrorDetails = [];
        for (const cell of cells) {
          const code = errorValue(
            cell.value,
            businessSubstantive && sheetName === 'LIBRO',
          );
          if (!code) continue;
          const severity = sheetName === 'LIBRO' ? 'warning' : 'error';
          recordFormulaError(formulaErrors, sheetName, row.number, cell.colNumber, code, severity);
          rowErrorDetails.push({ column: columnLetter(cell.colNumber), code });
        }
        if (!businessSubstantive) continue;

        substantiveRows += 1;
        totalSubstantiveRows += 1;
        if (totalSubstantiveRows > MAX_SUBSTANTIVE_ROWS) {
          throw new Error(`substantive row limit exceeded (${MAX_SUBSTANTIVE_ROWS})`);
        }

        if (!headerMap && config?.stage) {
          const used = new Set();
          headerMap = new Map(cells.map(cell => [
            cell.colNumber,
            safeHeader(cell.value, columnLetter(cell.colNumber), used),
          ]));
          headerRowNumber = row.number;
          continue;
        }

        if (config?.stage) {
          const sourceData = {};
          const normalizedData = {};
          for (const cell of cells) {
            const letter = columnLetter(cell.colNumber);
            sourceData[letter] = jsonValue(cell.value);
            const header = headerMap.get(cell.colNumber) || `columna_${letter}`;
            normalizedData[header] = flatValue(cell.value);
          }
          const rowHasErrors = rowErrorDetails.length > 0;
          if (rowHasErrors) rowsWithErrors += 1;
          stageBatch.push({
            sheet_name: sheetName,
            row_number: row.number,
            source_data: sourceData,
            normalized_data: normalizedData,
            validation_status: rowHasErrors ? 'error' : 'valido',
            validation_errors: rowErrorDetails,
          });
          if (stageBatch.length >= STAGE_BATCH_SIZE) {
            stagedRows += await flushStage(stageBatch, jobId, workerId, token);
            batchesSinceHeartbeat += 1;
            if (batchesSinceHeartbeat >= 10) {
              await rpc('n8n_heartbeat_import_job', {
                p_job_id: jobId,
                p_worker_id: workerId,
              }, token);
              batchesSinceHeartbeat = 0;
            }
          }
        }
      }
    }

    if (shouldInspect) {
      sheetStats[sheetName] = {
        substantive_rows: substantiveRows,
        header_row: headerRowNumber,
        staged: Boolean(config?.stage),
      };
    }
  }

  stagedRows += await flushStage(stageBatch, jobId, workerId, token);

  if (kind === 'maestro') {
    for (const [sheetName, config] of Object.entries(MAESTRO_SHEETS)) {
      if (config.required && !seenSheets.has(sheetName)) {
        findings.push({
          severity: 'fatal',
          sheet_name: sheetName,
          row_number: null,
          column_name: null,
          error_code: 'REQUIRED_SHEET_MISSING',
          message: `Falta la hoja obligatoria ${sheetName}`,
          details: {},
        });
      } else if (config.required && (sheetStats[sheetName]?.substantive_rows || 0) < 2) {
        findings.push({
          severity: 'fatal',
          sheet_name: sheetName,
          row_number: null,
          column_name: null,
          error_code: 'REQUIRED_SHEET_EMPTY',
          message: `La hoja obligatoria ${sheetName} no contiene filas de datos`,
          details: sheetStats[sheetName] || {},
        });
      }
    }
  } else if (!existenceSheetSelected || stagedRows === 0) {
    findings.push({
      severity: 'fatal',
      sheet_name: null,
      row_number: null,
      column_name: null,
      error_code: 'EXISTENCE_SHEET_EMPTY',
      message: 'El Registro de Existencia no contiene filas utilizables',
      details: {},
    });
  }

  findings.push(...formulaErrors.values());
  for (let offset = 0; offset < findings.length; offset += 500) {
    await rpc('n8n_append_import_errors', {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_errors: findings.slice(offset, offset + 500),
    }, token);
  }

  const blockingFindings = findings.filter(item => item.severity === 'fatal' || item.severity === 'error');
  const findingCells = severity => findings
    .filter(item => item.severity === severity)
    .reduce((sum, item) => sum + Math.max(1, Number(item.details?.count || 1)), 0);
  const status = blockingFindings.length || rowsWithErrors ? 'rechazado' : 'validado';
  const rowsError = Math.min(rowsWithErrors, stagedRows);
  return {
    status,
    rows_total: stagedRows,
    rows_valid: Math.max(0, stagedRows - rowsError),
    rows_error: rowsError,
    summary: {
      mode: 'streaming-xlsx',
      kind,
      sheets_seen: [...seenSheets],
      sheet_stats: sheetStats,
      findings: {
        warning: findingCells('warning'),
        error: findingCells('error'),
        fatal: findingCells('fatal'),
        warning_groups: findings.filter(item => item.severity === 'warning').length,
        error_groups: findings.filter(item => item.severity === 'error').length,
        fatal_groups: findings.filter(item => item.severity === 'fatal').length,
      },
      publication_performed: false,
    },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'method_not_allowed' });
  const token = String(req.headers['x-molino-n8n-token'] || '').trim();
  if (!token) return reply(res, 401, { ok: false, error: 'missing_token' });

  let body;
  try {
    body = requestBody(req);
  } catch {
    return reply(res, 400, { ok: false, error: 'invalid_json' });
  }

  const jobId = String(body.job_id || '').trim();
  const workerId = String(body.worker_id || '').trim();
  const checksum = String(body.expected_checksum_sha256 || '').trim().toLowerCase();
  const kind = String(body.kind || 'maestro').trim().toLowerCase();
  const signedUrl = String(body.signed_url || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(jobId) || !workerId || workerId.length > 200) {
    return reply(res, 400, { ok: false, error: 'invalid_job_context' });
  }
  if (!/^[0-9a-f]{64}$/.test(checksum) || !['maestro', 'existencia'].includes(kind)) {
    return reply(res, 400, { ok: false, error: 'invalid_file_context' });
  }

  try {
    await rpc('n8n_authorize_request', {}, token);
  } catch {
    return reply(res, 401, { ok: false, error: 'invalid_token' });
  }

  const filePath = `/tmp/molino-${jobId}.xlsx`;
  try {
    const fileBytes = await downloadVerifiedFile(signedUrl, checksum, filePath);
    const result = await parseWorkbook({ filePath, kind, jobId, workerId, token });
    return reply(res, 200, {
      ok: true,
      job_id: jobId,
      file_bytes: fileBytes,
      ...result,
    });
  } catch (error) {
    console.error('n8n import parser failed', {
      job_id: jobId,
      message: error instanceof Error ? error.message : String(error),
    });
    return reply(res, 502, { ok: false, error: 'parser_failed' });
  } finally {
    await unlink(filePath).catch(() => {});
  }
};

module.exports._internals = Object.freeze({
  parseWorkbook,
  jsonValue,
  flatValue,
  errorValue,
  isBusinessCell,
});
