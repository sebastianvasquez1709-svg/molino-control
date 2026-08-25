# Auditoría integral Molino Control · 2026-08-25

## Estado ejecutivo

Auditoría realizada sobre GitHub, Supabase y Vercel conectados al proyecto Molino Control. No se aplicaron cambios destructivos ni cambios de datos durante esta auditoría.

**Conclusión:** la aplicación está desplegada y el último build de producción pasa las comprobaciones estáticas existentes, pero el sistema **todavía no debe considerarse cerrado para producción segura**. Existen hallazgos críticos de seguridad, deuda técnica de arquitectura y problemas de calidad de datos que deben resolverse antes de declarar el proyecto plenamente optimizado.

## 1. GitHub / código

### Crítico
- `app.js` contiene credenciales heredadas embebidas en el cliente: `ADMIN_RUT` y `ACCESS_KEY`. Al estar el repositorio público, estos valores no pueden considerarse secretos. La autenticación heredada debe migrarse definitivamente a Supabase Auth/RBAC.

### Alto
- `app.js` tiene aproximadamente 395 KB y concentra una gran parte de la aplicación. Esto eleva el riesgo de regresiones y hace más difícil probar módulos aisladamente.
- El código contiene un bloque de logo Base64 embebido, duplicando el recurso gráfico que ya existe como archivo del repositorio.
- Existen numerosos scripts/parches versionados (`patch-*`, fragmentos `.jsfrag`, variantes V3-V12) que reflejan una historia de parches acumulativos. El build actual los controla razonablemente, pero debe evolucionarse hacia módulos estables y contratos explícitos.
- Hay workflows de GitHub Actions con `contents: write` que pueden modificar y hacer push directamente sobre `main`. Esto contradice la política operativa documentada de trabajar por rama, revisar y luego integrar.

### Positivo
- El build actual es transaccional: trabaja sobre una copia aislada y verifica que `app.js` fuente no sea modificado durante el build.
- El último deployment ejecutó correctamente los checks de sintaxis, módulos, duplicación de inyecciones y ausencia de snapshots hardcodeados.

## 2. Supabase

### CRÍTICO — no corregir automáticamente
- `private.maestro_import_tokens` tiene RLS desactivado. Supabase lo clasifica como crítico. No se debe habilitar RLS a ciegas porque podría bloquear el proceso de importación; primero debe definirse la política exacta de acceso.

SQL candidato para remediación estructural, pendiente de política:

```sql
ALTER TABLE private.maestro_import_tokens ENABLE ROW LEVEL SECURITY;
```

### Alto
- Varias funciones `SECURITY DEFINER` están expuestas a `authenticated`, y algunas a `anon`. Debe aplicarse mínimo privilegio de `EXECUTE` según cada función.
- `maestro_public_health()` es ejecutable por `anon` y `authenticated` como `SECURITY DEFINER`. Debe confirmarse si realmente necesita ser público; de lo contrario, restringir ejecución.
- `molino_sacos_granel_report()` es ejecutable por `anon` como `SECURITY DEFINER`. Es un hallazgo especialmente relevante porque entrega información operacional.
- `sync_maestro_operational()` es ejecutable por `authenticated` como `SECURITY DEFINER`, aunque internamente valida administrador. Debe revisarse si conviene mantener la función expuesta o encapsularla mediante una superficie administrativa más estricta.
- `norm_cliente_text()` tiene `search_path` mutable y debe fijarse explícitamente.
- Protección de contraseñas filtradas de Supabase Auth está desactivada.

### Medio / rendimiento
- Existen varias FK sin índice de cobertura.
- Varias políticas RLS usan `auth.uid()`/funciones de auth por fila en vez de la forma optimizada `(select auth.uid())`.
- `cliente_aliases` tiene políticas permisivas duplicadas para SELECT.
- Hay índices marcados como no utilizados. No deben eliminarse automáticamente: primero hay que comprobar las consultas reales y el período de observación.
- `public.maestro_runner_lock` tiene RLS activado pero no tiene políticas; esto puede ser correcto como tabla interna, pero debe documentarse como deliberado.

## 3. Calidad de datos

Se ejecutaron comprobaciones de solo lectura sobre las tablas operativas.

- Documentos duplicados por tipo + folio: **0**.
- Duplicados por `maestro_fila_hash` en despachos: **0**.
- Notas de Crédito detectadas en documentos: **6**.
- Documentos sin `cliente_id` y sin nombre de cliente: **2.031**.
- Documentos con total negativo: **20**.
- Despachos que no cumplen literalmente `kilos = sacos × 25`: **1.196**.

La última cifra **no debe corregirse masivamente** sin distinguir productos de 10 kg, granel y Big Bag 800 kg. El análisis muestra que gran parte de las diferencias proviene precisamente de productos que no son sacos de 25 kg. Por ejemplo, aparecen productos de 10 kg, granel y Big Bag 800 kg con semánticas diferentes en los campos `kilos` y `sacos`.

Por tanto, la solución correcta es normalizar la regla de unidad por producto/código, no forzar `sacos × 25` sobre toda la tabla.

## 4. Vercel

- Producción actual: `READY`.
- Deployment revisado: commit `e971c40f902e4eee0ae98ca3002d250ca6ffc9c0`.
- El build terminó correctamente y ejecutó todos los checks definidos por `scripts/vercel-build.sh`.
- La URL de producción respondió HTTP 200.
- No se observaron runtime logs de error en la ventana consultada de 7 días.
- Históricamente existe una cadena reciente de deployments fallidos durante el endurecimiento de producción; el último deployment ya estabilizó el build.

## 5. Arquitectura

La arquitectura GitHub → Supabase → Vercel es viable y no requiere sustitución inmediata.

La prioridad es reducir deuda dentro de la arquitectura existente:

1. Supabase Auth + RBAC real como única autenticación.
2. Cerrar la superficie `SECURITY DEFINER` con mínimo privilegio.
3. Resolver RLS de `private.maestro_import_tokens` con política explícita.
4. Normalizar reglas de unidades y cantidades.
5. Dividir `app.js` progresivamente sin cambiar contratos funcionales.
6. Consolidar parches en módulos estables.
7. Separar CI de modificación automática de producción.
8. Añadir pruebas de regresión funcionales para Facturas, Boletas, Guías, NC/ND, Despachos, Maestro, Registro de Existencia e informes Sacos/Granel.

## 6. Orden de intervención recomendado

### Fase 0 — Seguridad
- Migración completa a Supabase Auth/RBAC.
- Eliminación de credenciales heredadas del frontend.
- Restricción de funciones RPC.
- RLS de `private.maestro_import_tokens` con política compatible con importación.
- Activación de protección contra contraseñas filtradas.

### Fase 1 — Integridad de datos
- Definir una única taxonomía de unidades: 10 kg, 25 kg, 800 kg y granel.
- Validar `kilos`, `sacos` y unidad contra CODIGOS del Maestro.
- Separar explícitamente NC de ventas positivas.
- Conciliar los 20 negativos y 2.031 documentos sin cliente antes de cualquier corrección masiva.

### Fase 2 — Rendimiento
- Índices FK realmente necesarios.
- Optimización de políticas RLS.
- Eliminación de políticas duplicadas.
- Revisión de índices no utilizados con evidencia de consultas.

### Fase 3 — Mantenibilidad
- Modularización progresiva de `app.js`.
- Eliminación de Base64 redundante.
- Consolidación de parches.
- Contratos de módulos y pruebas automatizadas.

### Fase 4 — QA/E2E
- Smoke tests.
- Pruebas de regresión.
- Pruebas de datos Maestro vs Supabase.
- Validación de producción desde navegador.
- Pruebas específicas de NC, Sacos/Granel y Despachos.

## Dictamen

**No se recomienda declarar Molino Control 100% optimizado todavía.**

El build y el deployment están actualmente estabilizados, pero los hallazgos de seguridad y calidad de datos son suficientemente importantes como para impedir una certificación final.

La optimización debe continuar desde la rama de auditoría, aplicando cambios pequeños, verificables y reversibles, sin tocar datos productivos de forma masiva hasta contar con una conciliación previa contra el Maestro.
