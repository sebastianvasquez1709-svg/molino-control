# Plan de optimización Molino Control · 2026-08-25

## Objetivo
Llevar Molino Control a una arquitectura empresarial mantenible y segura sin romper las funciones existentes.

## Bloqueadores antes de certificación

1. Migrar autenticación heredada de frontend a Supabase Auth/RBAC.
2. Resolver RLS de `private.maestro_import_tokens` con política explícita.
3. Restringir `SECURITY DEFINER` y `EXECUTE` de RPC.
4. Normalizar unidades de despacho por código/maestro.
5. Conciliar NC y documentos negativos.
6. Separar `app.js` en módulos estables.

## No hacer

- No ejecutar DELETE/UPDATE masivo sobre datos operativos.
- No imponer 25 kg a todo registro con `sacos`.
- No convertir granel a sacos.
- No eliminar índices sólo porque el advisor los marque como no usados.
- No publicar service_role/secret keys.
- No hacer que CI haga push automático a `main` para cambios funcionales sin revisión.

## Criterio de salida

Molino Control se considera optimizado cuando:

- autenticación y autorización sean backend-enforced;
- todas las superficies públicas estén protegidas por RLS/privilegios mínimos;
- los cálculos Sacos/Granel/10 kg/800 kg estén conciliados contra CODIGOS y Maestro;
- NC esté identificada y excluida donde corresponda;
- los módulos críticos tengan pruebas de regresión;
- el build sea repetible e idempotente;
- producción tenga validación E2E y no sólo estado READY.
