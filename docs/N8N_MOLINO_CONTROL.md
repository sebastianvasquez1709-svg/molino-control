# Molino Control + n8n

Arquitectura modular para recibir, validar y auditar archivos Excel sin exponer credenciales privilegiadas ni publicar datos operacionales antes de una aprobación explícita.

## Estado de los componentes

| Componente | Estado | Alcance |
|---|---|---|
| Workflow 01 · prueba RPC | Activo y probado | Inserta únicamente una prueba aislada mediante RPC tokenizada |
| Workflow 02 · recepción RPC | Activo y probado | Crea trabajos idempotentes; compatibilidad con el webhook actual |
| Workflow 03 · procesador streaming | Diseñado y versionado | Inactivo hasta aplicar migración, desplegar función y probar staging |
| Cola SQL segura | Diseñada y versionada | No aplicada por este commit |
| Función de URL firmada | Diseñada y versionada | No desplegada por este commit |
| Parser Vercel streaming | Diseñado y versionado | Disponible solo después del despliegue de la rama |
| Panel Molino Control | Diseñado y versionado | Solo ADMIN; no contiene token n8n |
| Publicación operacional | Bloqueada | No existe una RPC de publicación en esta fase |

## Flujo objetivo

1. Un administrador inicia sesión en Molino Control.
2. El navegador calcula SHA-256 y sube el Excel original al bucket privado `excel-imports`.
3. La RPC autenticada `molino_enqueue_import` crea un trabajo idempotente.
4. n8n reclama un trabajo con lease y reintentos acotados.
5. una Edge Function tokenizada entrega una URL firmada de cinco minutos.
6. el parser Vercel descarga, verifica checksum y lee XLSX por streaming.
7. Las filas se guardan por lotes en `import_rows_staging`; hallazgos quedan en `import_errors`.
8. n8n cierra el trabajo como `validado`, `rechazado` o `error`.
9. Ninguna ruta de esta fase escribe en las tablas operacionales del Maestro.

## Seguridad

- La credencial n8n es un Header Auth llamado `Molino Control RPC Token` y envía `x-molino-n8n-token`.
- Supabase guarda solo el SHA-256 del token en `n8n_private.webhook_secrets`.
- Los workflows usan una clave publicable de Supabase y RPCs de privilegio mínimo.
- El navegador usa únicamente su sesión JWT; no conoce el token n8n ni una `service_role`.
- El parser acepta exclusivamente URLs firmadas del bucket `excel-imports` en el proyecto Molino Control.
- El archivo debe coincidir con el checksum declarado y no superar 50 MiB.
- Los objetos se escriben en `<auth.uid()>/<checksum>/<archivo>` y no tienen política de actualización.
- Las tablas de staging conservan RLS sin acceso directo para `anon` o `authenticated`.

## Por qué no se usa directamente “Extract from File”

El nodo de n8n permite seleccionar hoja y rango, pero su implementación lee el workbook completo en memoria antes de aplicar esos filtros. El Maestro auditado expande aproximadamente 115 MiB de XML y contiene más de 229 mil fórmulas. Para reducir el riesgo de OOM, el diseño usa `ExcelJS.stream.xlsx.WorkbookReader`, descarta estilos e hipervínculos y envía lotes pequeños a Supabase.

## Archivos del paquete

- `supabase/migrations/20260920_n8n_integration_staging.sql`: tablas base aisladas.
- `supabase/migrations/20260921_n8n_scoped_queue.sql`: cola, leases, RPCs, grants y políticas privadas.
- `supabase/functions/n8n-import-file/index.ts`: URL firmada con autenticación propia.
- `api/n8n-import-parser.js`: parser XLSX streaming tokenizado.
- `molino-automation-import.js`: panel de carga para administradores.
- `n8n/molino-control-01-conexion.json`: prueba RPC.
- `n8n/molino-control-02-importacion.json`: recepción compatible.
- `n8n/molino-control-03-procesador-streaming.json`: orquestador de cola.

## Activación controlada

1. Revisar y aplicar `20260921_n8n_scoped_queue.sql`.
2. Desplegar `n8n-import-file` con `verify_jwt=false`; su código valida el token antes de usar `service_role`.
3. Desplegar la rama de staging y comprobar `/api/n8n-import-parser`.
4. Importar el workflow 03 en n8n y asignar la credencial Header Auth existente.
5. Mantener el workflow 03 inactivo.
6. Ejecutar manualmente con una copia del Maestro validado.
7. Comparar conteos, hojas, errores y métricas contra Excel.
8. Activar el workflow 03 solo después de aprobar la prueba.
9. Diseñar una fase separada de publicación con aprobación humana y rollback.

## Contrato de estados

- `pendiente`: archivo conservado y trabajo en cola.
- `procesando`: trabajo con lease temporal asignado a n8n.
- `validado`: estructura aceptada y staging completo; no publicado.
- `rechazado`: error de datos o estructura; el original queda conservado.
- `error`: agotamiento de reintentos o falla técnica.
- `publicado`: reservado para una fase futura; el procesador actual no puede producirlo.
