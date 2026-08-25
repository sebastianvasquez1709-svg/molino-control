# LYRA — Ejecución integral de los últimos protocolos

Fecha: 2026-08-25
Rama: `lyra/seguridad-qa-2026-08-25`

## Ejecución

Se aplicaron y validaron en conjunto los principios del protocolo maestro de ingeniería, LYRA y el modo Autonomous Principal Engineer.

### Datos y Maestro
- `BASE DE DATOS` permanece como fuente operacional principal.
- `LIBRO` se usa como fuente complementaria para NC/ND cuando corresponde.
- Las reglas de Sacos/Granel se atan a `AX`, `AF`, `U` y CODIGOS; no se fuerza AF como saco físico universal.
- Se conserva la trazabilidad de Maestro → Supabase → RPC → UI.

### Seguridad
- Se restringió la ejecución pública de funciones de reconstrucción/publicación sensibles.
- Se fijó `search_path` en funciones de normalización numérica/textual.
- Se mantuvo `sync_maestro_operational()` para usuarios autenticados.
- Se añadieron índices para claves foráneas críticas.

### Experiencia / estética / performance
- Se añadió `lyra-experience-v1.js`, capa transversal idempotente de UX.
- Se reforzaron focus states, accesibilidad básica, comportamiento responsive, feedback táctil y preferencias de movimiento reducido.
- Se añadió elevación visual contenida para tarjetas y topbar, evitando efectos excesivos.
- Se añadió una capa de skeleton reutilizable para futuras cargas diferidas.
- Se mantiene separación entre UI y lógica de datos.

### Build / QA
- Se integró la capa LYRA en `vercel-build.sh`.
- Se añadió validación estática de semántica Sacos/Granel.
- Se añadió guard de unicidad para la capa LYRA Experience.
- Se preserva la verificación de `app.js` original sin mutación durante build.
- El commit final de rama tuvo estado Vercel `success` y deployment `READY`.

## Estado de promoción

La rama fue validada antes de promoverse. El deployment de la rama quedó `READY` y el check de Vercel quedó en `success`.

## Riesgos aún no cerrados

- Migración total del login heredado hacia Supabase Auth/RBAC sigue siendo una fase separada para no romper la operación estable.
- La eliminación progresiva de parches históricos continúa como refactor posterior; no se hace un reemplazo masivo en una sola promoción.
- La protección de contraseñas filtradas de Supabase Auth requiere activación en configuración de Auth y no se modifica automáticamente desde SQL.

## Regla de continuidad

Cada nueva mejora debe pasar por: auditoría → hipótesis → cambio mínimo → pruebas → comparación → promoción → nueva auditoría. Si aparece una segunda regresión relacionada, se detiene el parcheo y se revisa la arquitectura.
