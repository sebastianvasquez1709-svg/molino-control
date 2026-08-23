# Auditoría integral Molino Control · 2026-08-22

## Alcance revisado

Se revisaron la aplicación web en GitHub, la capa cloud de Supabase, la integración de INE/Maestro y la entrega en Vercel. La auditoría busca mejorar seguridad, rendimiento, resiliencia y mantenibilidad sin retirar las funciones principales existentes.

## Hallazgos confirmados

### GitHub / frontend

- `app.js` sigue siendo un monolito grande (aprox. 395 KB). Esto aumenta el costo de mantenimiento y el riesgo de regresión al tocar una función aislada.
- La autenticación heredada conserva constantes embebidas en el cliente (`ADMIN_RUT` y `ACCESS_KEY`). Se mantiene por compatibilidad en esta etapa, pero debe migrarse a Supabase Auth + RBAC real antes de considerar la seguridad de producción como cerrada.
- El frontend contiene una imagen embebida en Base64 además del archivo de logo del repositorio, lo que aumenta el peso del JavaScript.

### Supabase

- Las tablas públicas revisadas tienen RLS activado.
- `private.maestro_import_tokens` tiene RLS desactivado. Supabase lo clasifica como hallazgo **CRÍTICO**. Esta corrección no se aplica automáticamente porque habilitar RLS sin políticas puede bloquear el proceso de importación; queda documentada como remediación separada.
- `public.maestro_runner_lock` tiene RLS activado sin políticas. Es un hallazgo informativo y debe mantenerse inaccesible desde el cliente salvo que exista una necesidad explícita.
- `public.norm_cliente_text` tiene `search_path` mutable.
- Hay funciones `SECURITY DEFINER` expuestas a roles `anon`/`authenticated` (`maestro_public_health`, `maestro_ine_parameters`, `molino_app_snapshot`, `sync_maestro_operational`). Debe revisarse que cada una tenga el mínimo `EXECUTE` necesario.
- La protección de contraseñas filtradas de Supabase Auth está desactivada.

### Vercel

- El deployment de producción revisado estaba en estado `READY` y el sitio respondía HTTP 200.
- No se detectaron runtime errors en la ventana revisada.

## Mejoras aplicadas sin retirar funciones

- La capa `molino-cloud.js` ahora reutiliza un snapshot reciente durante 60 segundos, comparte solicitudes simultáneas y agrega timeout/reintento para fallas transitorias.
- Se limpian las cachés de snapshot al iniciar/cerrar sesión.
- Se añadió `cacheInfo()` y `clearCache()` para diagnóstico y mantenimiento.
- El motor INE mantiene sus fórmulas y agrega protección de carga de archivos: sólo XLS/XLSX y máximo 60 MB.
- La inserción del panel INE evita duplicados cuando el usuario vuelve a cargar el mismo control.
- Se retiró de la pantalla de acceso el usuario prellenado y la exposición visual de la clave de prototipo. Esto no elimina la lógica heredada de autenticación; sólo deja de publicitar credenciales en la UI.
- Se añadió un smoke test de integridad que valida archivos críticos, presencia del motor INE y estructura de los parámetros Maestro.

## Próxima fase recomendada

1. Migrar definitivamente la autenticación de `app.js` a Supabase Auth/RBAC, manteniendo RUT como identificador visible.
2. Encapsular el acceso a funciones `SECURITY DEFINER` con privilegio mínimo.
3. Habilitar RLS en `private.maestro_import_tokens` con una política explícita compatible con el proceso de importación. Ver `SUPABASE-SECURITY-REMEDIATION.sql`.
4. Activar leaked password protection en Supabase Auth.
5. Dividir progresivamente `app.js` por módulos sin cambiar contratos de datos ni rutas.
6. Sustituir el logo Base64 embebido por el recurso ya existente en el repositorio.
